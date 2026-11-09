import { io } from "socket.io-client";
import { clearPersisted, readPersisted, removePersisted, writePersisted } from "./persistentCache";

/**
 * Push-based data layer (no polling).
 *
 * GET requests made while a live task runs (see useLive) are served over the
 * socket as live subscriptions: the server sends the response once, then
 * pushes per-entity ops `{ type, entity, id, data }` whenever MongoDB changes.
 * Ops are applied to this local cache and the tasks re-run against the cache,
 * so the UI updates without any further HTTP request.
 *
 * Every cached response carries the server's version `hash` and is also kept
 * on the device (see persistentCache). A reload serves that copy instantly;
 * subscribing again sends the hash, so the server answers "unchanged" or with
 * only the ops since that version. Reconnects work the same way, and tasks
 * re-run only when something actually changed.
 */

export const LIVE_FALLBACK = Symbol("live-fallback");

const CONNECT_WAIT_MS = 4000;
const SUBSCRIBE_TIMEOUT_MS = 15000;
const RELEASE_GRACE_MS = 15000;
const RERUN_DEBOUNCE_MS = 30;
// A tab hidden this long drops its socket so the server stops recomputing views nobody sees;
// becoming visible reconnects and catches up from the cached versions.
const HIDDEN_DISCONNECT_MS = 60000;
const DROP_STALE_STATUSES = new Set([401, 403, 404]);

const settings = { url: "", getToken: () => "" };
let socket = null;
let hasConnected = false;
let authedToken;

const entries = new Map();
const tasks = new Set();
const runningTasks = new Set();
const nonLivePaths = new Set();
const syncListeners = new Set();
const connectListeners = new Set();

// ---- entity ops (must mirror backend/shared/realtime/diff.js) -------------

const ID_FIELDS = ["_id", "id", "inspectionId", "pickupId", "requestNumber", "orderId", "farmerId", "batchId", "sku"];

export function idOf(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  for (const field of ID_FIELDS) {
    const value = item[field];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return null;
}

function getAt(root, path) {
  return path.reduce((node, key) => (node == null ? undefined : node[key]), root);
}

function setAt(root, path, value) {
  if (!path.length) return value;
  const next = Array.isArray(root) ? [...root] : { ...(root || {}) };
  const [head, ...rest] = path;
  next[head] = rest.length ? setAt(next[head], rest, value) : value;
  if (value === undefined && !rest.length) delete next[head];
  return next;
}

function applyListOps(list, ops) {
  const out = Array.isArray(list) ? [...list] : [];
  for (const op of ops) {
    if (op.op === "remove") {
      const at = out.findIndex((item) => idOf(item) === op.id);
      if (at >= 0) out.splice(at, 1);
    } else if (op.op === "upsert") {
      const at = out.findIndex((item) => idOf(item) === op.id);
      if (at >= 0) out[at] = op.data;
      else out.splice(Math.min(Math.max(op.index ?? out.length, 0), out.length), 0, op.data);
    } else if (op.op === "order") {
      const byId = new Map(out.map((item) => [idOf(item), item]));
      return op.ids.map((id) => byId.get(id)).filter(Boolean);
    }
  }
  return out;
}

export function applyOps(data, ops = []) {
  let root = data;
  const listGroups = new Map();
  const flushList = (key) => {
    const group = listGroups.get(key);
    if (!group) return;
    root = setAt(root, group.path, applyListOps(getAt(root, group.path), group.ops));
    listGroups.delete(key);
  };

  for (const op of ops) {
    if (op.op === "replace") {
      listGroups.clear();
      root = op.data;
    } else if (op.op === "set") {
      listGroups.forEach((_group, key) => flushList(key));
      root = setAt(root, op.path, op.data);
    } else {
      const key = JSON.stringify(op.path || []);
      if (!listGroups.has(key)) listGroups.set(key, { path: op.path || [], ops: [] });
      listGroups.get(key).ops.push(op);
    }
  }
  listGroups.forEach((_group, key) => flushList(key));
  return root;
}

// ---- socket ---------------------------------------------------------------

export function configureRealtime({ url, getToken }) {
  settings.url = String(url || "").replace(/\/+$/, "").replace(/\/api$/, "");
  if (getToken) settings.getToken = getToken;
}

function dropEntry(entry, { forget = false } = {}) {
  clearTimeout(entry.releaseTimer);
  if (entries.get(entry.key) === entry) entries.delete(entry.key);
  if (forget) removePersisted(entry.key);
}

function rerunRefs(entry) {
  entry.refs.forEach((task) => scheduleRerun(task));
}

function handleConnect() {
  if ((settings.getToken() || undefined) !== authedToken) {
    // The token changed while this connection was authenticating.
    socket.disconnect();
    socket.connect();
    return;
  }
  const reconnect = hasConnected;
  hasConnected = true;
  // The server keeps no subscriptions across connections: resubscribe with our
  // versions so it only sends what changed while we were away.
  entries.forEach((entry) => {
    if (!entry.refs.size && entry.releaseTimer) return dropEntry(entry);
    entry.live = false;
    entry.promise = null;
    if (entry.data !== undefined) ensureSubscribed(entry);
  });
  tasks.forEach((task) => {
    if (task.needsLive) scheduleRerun(task);
  });
  connectListeners.forEach((listener) => listener({ reconnect }));
}

function handleDisconnect() {
  entries.forEach((entry) => {
    entry.live = false;
  });
}

function handlePatch(payload) {
  const entry = entries.get(payload?.key);
  if (!entry || entry.data === undefined) return;
  if (payload.baseHash && entry.hash && payload.baseHash !== entry.hash) {
    // Missed an earlier patch; catch up from our version instead of guessing.
    entry.live = false;
    ensureSubscribed(entry);
    return;
  }
  entry.data = applyOps(entry.data, payload.ops);
  entry.hash = payload.hash || "";
  writePersisted(entry.key, entry.data, entry.hash);
  rerunRefs(entry);
}

function handleLiveError(payload) {
  const entry = entries.get(payload?.key);
  if (!entry) return;
  dropEntry(entry, { forget: true });
  rerunRefs(entry);
}

export function getSocket() {
  if (socket) return socket;
  socket = io(settings.url, {
    transports: ["websocket", "polling"],
    auth: (cb) => {
      authedToken = settings.getToken() || undefined;
      cb({ token: authedToken });
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  socket.on("live:patch", handlePatch);
  socket.on("live:error", handleLiveError);
  socket.on("sync", (event) => syncListeners.forEach((listener) => listener(event)));
  pauseWhileHidden(socket);
  return socket;
}

function pauseWhileHidden(s) {
  if (typeof document === "undefined") return;
  let hiddenTimer = null;
  let paused = false;
  document.addEventListener("visibilitychange", () => {
    clearTimeout(hiddenTimer);
    if (document.visibilityState === "hidden") {
      hiddenTimer = setTimeout(() => {
        if (!s.active) return;
        paused = true;
        s.disconnect();
      }, HIDDEN_DISCONNECT_MS);
    } else if (paused) {
      paused = false;
      s.connect();
    }
  });
}

/** Re-authenticate the socket after login / logout. Logging out wipes the device copy. */
export function reconnectRealtime() {
  if (!settings.getToken()) clearLiveCache();
  if (!socket) {
    getSocket();
    return;
  }
  // Closing a socket mid-handshake aborts it ("WebSocket is closed before the connection is
  // established"); a socket that isn't connected yet reads the token when it authenticates.
  if (!socket.connected) {
    if (!socket.active) socket.connect();
    return;
  }
  if ((settings.getToken() || undefined) === authedToken) return;
  socket.disconnect();
  socket.connect();
}

/** Forget every cached response, in memory and on the device. */
export function clearLiveCache() {
  entries.forEach((entry) => clearTimeout(entry.releaseTimer));
  entries.clear();
  clearPersisted();
}

/** Listen to server-pushed entity events (`{ type, entity, action, id, data }`). */
export function onSync(listener) {
  getSocket();
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

export function onRealtimeConnect(listener) {
  getSocket();
  connectListeners.add(listener);
  return () => connectListeners.delete(listener);
}

function waitForConnect(ms) {
  const s = getSocket();
  if (s.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (value) => {
      clearTimeout(timer);
      s.off("connect", onConnect);
      resolve(value);
    };
    const onConnect = () => done(true);
    const timer = setTimeout(() => done(false), ms);
    s.on("connect", onConnect);
  });
}

// ---- live cache -----------------------------------------------------------

function fingerprint(token) {
  if (!token) return "anon";
  let hash = 5381;
  for (let i = 0; i < token.length; i += 1) hash = ((hash << 5) + hash + token.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

const clone = (value) => (value === undefined ? value : structuredClone(value));

function retain(key, task) {
  const entry = entries.get(key);
  if (!entry) return;
  entry.refs.add(task);
  clearTimeout(entry.releaseTimer);
  entry.releaseTimer = null;
}

function release(key, task) {
  const entry = entries.get(key);
  if (!entry) return;
  entry.refs.delete(task);
  if (entry.refs.size || entry.releaseTimer) return;
  entry.releaseTimer = setTimeout(() => {
    if (entry.refs.size || entries.get(key) !== entry) return;
    entries.delete(key);
    if (entry.live) socket?.emit("live:unsubscribe", { key });
  }, RELEASE_GRACE_MS);
}

function newEntry(key, url, token) {
  const entry = {
    key, url, token, data: undefined, hash: "", live: false, refs: new Set(), promise: null, releaseTimer: null,
  };
  entries.set(key, entry);
  return entry;
}

function applySubscribeReply(entry, res) {
  const hadData = entry.data !== undefined;
  let changed = false;
  if (res.unchanged) {
    // Our copy is current.
  } else if (Array.isArray(res.ops)) {
    entry.data = applyOps(entry.data, res.ops);
    changed = res.ops.length > 0;
  } else {
    changed = !hadData || res.hash !== entry.hash || !res.hash;
    entry.data = res.data;
  }
  entry.hash = res.hash || "";
  entry.live = true;
  if (changed || !hadData) writePersisted(entry.key, entry.data, entry.hash);
  if (changed && hadData) rerunRefs(entry);
}

function subscribeEntry(entry) {
  entry.seq = (entry.seq || 0) + 1;
  const seq = entry.seq;
  return new Promise((resolve) => {
    const payload = { key: entry.key, url: entry.url, token: entry.token };
    if (entry.data !== undefined && entry.hash) payload.hash = entry.hash;
    getSocket()
      .timeout(SUBSCRIBE_TIMEOUT_MS)
      .emit("live:subscribe", payload, (err, res) => {
        if (entries.get(entry.key) !== entry || entry.seq !== seq) return resolve();
        if (!err && res?.ok) {
          applySubscribeReply(entry, res);
          return resolve();
        }
        if (res?.reason === "not_live") nonLivePaths.add(entry.url.split("?")[0]);
        const rejected = res?.reason === "not_live" || DROP_STALE_STATUSES.has(res?.status);
        // A device copy stays on screen through timeouts and server hiccups.
        if (entry.data === undefined || rejected) {
          dropEntry(entry, { forget: rejected });
          if (entry.data !== undefined) rerunRefs(entry);
        }
        resolve();
      });
  });
}

function ensureSubscribed(entry) {
  if (!entry.promise) {
    const promise = subscribeEntry(entry).finally(() => {
      if (entry.promise === promise) entry.promise = null;
    });
    entry.promise = promise;
  }
  return entry.promise;
}

function retainOwners(owners, key) {
  // Loaders that don't await their requests finish before the entry exists.
  owners.forEach((task) => {
    if (task.alive && !task.running && task.keys.has(key)) retain(key, task);
  });
}

/**
 * Resolve a GET from the live cache, subscribing first if needed.
 * Throws LIVE_FALLBACK when the caller should use a normal HTTP request.
 */
export async function liveGet(url, token) {
  if (!url || !url.startsWith("/api/") || nonLivePaths.has(url.split("?")[0])) throw LIVE_FALLBACK;
  const key = `${fingerprint(token)}|${url}`;
  const owners = [...runningTasks];
  owners.forEach((task) => task.keys.add(key));

  let entry = entries.get(key);
  if (entry?.data !== undefined) return clone(entry.data);
  if (!entry && !owners.length) throw LIVE_FALLBACK;

  if (!entry) {
    const saved = await readPersisted(key);
    entry = entries.get(key);
    if (!entry && saved) {
      entry = newEntry(key, url, token);
      entry.data = saved.data;
      entry.hash = saved.hash || "";
      retainOwners(owners, key);
      if (getSocket().connected) ensureSubscribed(entry);
      return clone(entry.data);
    }
    if (entry?.data !== undefined) return clone(entry.data);
  }

  if (!(await waitForConnect(CONNECT_WAIT_MS))) {
    owners.forEach((task) => {
      task.needsLive = true;
    });
    throw LIVE_FALLBACK;
  }

  entry = entries.get(key) || newEntry(key, url, token);
  retainOwners(owners, key);
  await ensureSubscribed(entry);
  if (entry.data === undefined) throw LIVE_FALLBACK;
  return clone(entry.data);
}

// ---- tasks ----------------------------------------------------------------

function scheduleRerun(task) {
  if (!task.alive || task.timer) return;
  task.timer = setTimeout(() => {
    task.timer = null;
    task.run();
  }, RERUN_DEBOUNCE_MS);
}

/**
 * A loader whose GETs stay live. `run()` executes it; afterwards it re-runs
 * automatically (served from the cache) whenever pushed data changes.
 * The loader receives `{ initial }` — true only for the first run.
 */
export function createLiveTask(fn) {
  const task = {
    keys: new Set(),
    timer: null,
    alive: true,
    running: false,
    again: false,
    needsLive: false,
    runs: 0,
  };

  task.run = async () => {
    if (!task.alive) return;
    if (task.running) {
      task.again = true;
      return;
    }
    task.running = true;
    task.needsLive = false;
    const previous = task.keys;
    task.keys = new Set();
    runningTasks.add(task);
    const initial = task.runs === 0;
    task.runs += 1;
    try {
      await fn({ initial });
      // axios dispatches after async interceptors; keep collecting un-awaited GETs.
      await new Promise((resolve) => setTimeout(resolve, 0));
    } catch {
      // Loaders surface their own errors.
    } finally {
      runningTasks.delete(task);
      task.running = false;
      task.keys.forEach((key) => retain(key, task));
      previous.forEach((key) => {
        if (!task.keys.has(key)) release(key, task);
      });
      if (task.again && task.alive) {
        task.again = false;
        scheduleRerun(task);
      }
    }
  };

  task.stop = () => {
    task.alive = false;
    clearTimeout(task.timer);
    tasks.delete(task);
    task.keys.forEach((key) => release(key, task));
  };

  tasks.add(task);
  getSocket();
  return task;
}

// ---- HTTP client integration ---------------------------------------------

function bearer(value) {
  const raw = String(value || "").trim();
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw;
}

export function relativeApiUrl(absoluteUrl) {
  try {
    const parsed = new URL(absoluteUrl, window.location.origin);
    return parsed.pathname.startsWith("/api/") ? `${parsed.pathname}${parsed.search}` : null;
  } catch {
    return null;
  }
}

/** Route an axios instance's GETs through the live cache when possible. */
export function withLiveAdapter(instance, axiosLib) {
  const httpAdapter = axiosLib.getAdapter(instance.defaults.adapter || axiosLib.defaults.adapter);
  instance.defaults.adapter = async (config) => {
    if (String(config.method || "get").toLowerCase() === "get" && config.live !== false) {
      const url = relativeApiUrl(instance.getUri(config));
      if (url) {
        const headers = config.headers || {};
        const auth = headers.get?.("Authorization") ?? headers.Authorization ?? headers.authorization;
        try {
          const data = await liveGet(url, bearer(auth));
          return { data, status: 200, statusText: "OK", headers: {}, config, request: null };
        } catch (err) {
          if (err !== LIVE_FALLBACK) throw err;
        }
      }
    }
    return httpAdapter(config);
  };
  return instance;
}
