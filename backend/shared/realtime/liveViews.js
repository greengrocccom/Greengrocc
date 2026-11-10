import crypto from "crypto";
import { changeFeed } from "./changeFeed.js";
import { diff } from "./diff.js";
import { identityFromToken, extractToken } from "./identity.js";

/**
 * Live views: a client subscribes (over its socket) to a GET endpoint it
 * displays. The server runs that endpoint as the subscriber, then re-runs it
 * whenever a MongoDB collection the route depends on changes, and pushes
 * only the per-entity differences. The browser never polls or re-GETs.
 *
 * Identical subscriptions (same token + URL) share one computation.
 *
 * Every response version has a `hash`. A client that kept a copy (memory or
 * device storage) subscribes with that hash and gets back `unchanged`, only
 * the ops from its version (when that version is still in `snapshots`), or
 * the full data as a last resort.
 */

const DEBOUNCE_MS = 120;
const MAX_CONCURRENT = 6;
const BURST_WINDOW_MS = 10000;
const BURST_LIMIT = 12;
const SNAPSHOT_MAX_ENTRIES = 500;
const SNAPSHOT_MAX_BYTES = 64_000_000;

let routes = [];
let baseUrl = "";
const views = new Map();
const queue = [];
let active = 0;

const sha = (value) => crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 16);

/** Recent past versions of views, keyed `${viewId}#${hash}`, bounded by count and size. */
const snapshots = new Map();
let snapshotBytes = 0;

function setViewData(view, data) {
  const json = JSON.stringify(data) ?? "null";
  if (view.data !== undefined && view.hash) rememberSnapshot(view.id, view.hash, view.data, view.bytes);
  view.data = data;
  view.hash = sha(json);
  view.bytes = json.length;
}

function rememberSnapshot(viewId, hash, data, bytes = 0) {
  const key = `${viewId}#${hash}`;
  const existing = snapshots.get(key);
  if (existing) {
    snapshots.delete(key);
    snapshotBytes -= existing.bytes;
  }
  if (bytes > SNAPSHOT_MAX_BYTES / 8) return;
  snapshots.set(key, { data, bytes });
  snapshotBytes += bytes;
  while (snapshots.size > SNAPSHOT_MAX_ENTRIES || snapshotBytes > SNAPSHOT_MAX_BYTES) {
    const [oldestKey, oldest] = snapshots.entries().next().value;
    snapshots.delete(oldestKey);
    snapshotBytes -= oldest.bytes;
  }
}

/** What to send a subscriber who already holds the version `clientHash`. */
function catchUpReply(view, clientHash) {
  const base = { ok: true, rev: view.rev, hash: view.hash };
  if (clientHash && clientHash === view.hash) return { ...base, unchanged: true };
  const known = clientHash ? snapshots.get(`${view.id}#${clientHash}`) : null;
  if (known) return { ...base, ops: diff(known.data, view.data, { entity: view.route.entity }) };
  return { ...base, data: view.data };
}

function pathOf(url) {
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

function matchRoute(url) {
  const path = pathOf(url);
  return routes.find((route) =>
    route.exact ? path === route.path : path === route.path || path.startsWith(`${route.path}/`)
  );
}

function sendToSubscribers(view, event, payloadFor) {
  view.subscribers.forEach((keys, socket) => {
    keys.forEach((key) => socket.emit(event, payloadFor(key)));
  });
}

async function fetchView(view) {
  const headers = { Accept: "application/json", "x-greengrocc-live": "1" };
  if (view.token) headers.Authorization = `Bearer ${view.token}`;
  const res = await fetch(`${baseUrl}${view.url}`, { headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, ok: res.ok, body };
}

function pump() {
  while (active < MAX_CONCURRENT && queue.length) {
    const job = queue.shift();
    active += 1;
    job().finally(() => {
      active -= 1;
      pump();
    });
  }
}

const enqueue = (job) =>
  new Promise((resolve, reject) => {
    queue.push(() => job().then(resolve, reject));
    pump();
  });

function dropView(view) {
  clearTimeout(view.timer);
  views.delete(view.id);
  if (view.data !== undefined && view.hash) rememberSnapshot(view.id, view.hash, view.data, view.bytes);
}

async function recompute(view) {
  view.timer = null;
  if (!views.has(view.id)) return;
  if (view.running) {
    view.pending = true;
    return;
  }
  view.running = true;
  view.pending = false;
  view.lastRunAt = Date.now();
  view.runs = view.runs.filter((t) => view.lastRunAt - t < BURST_WINDOW_MS);
  view.runs.push(view.lastRunAt);

  try {
    const result = await enqueue(() => fetchView(view));
    if (!views.has(view.id)) return;
    if (result.status === 401 || result.status === 403) {
      sendToSubscribers(view, "live:error", (key) => ({ key, status: result.status }));
      dropView(view);
      return;
    }
    if (!result.ok) return;
    const ops = diff(view.data, result.body, { entity: view.route.entity });
    if (!ops.length) return;
    const baseHash = view.hash;
    setViewData(view, result.body);
    view.rev += 1;
    sendToSubscribers(view, "live:patch", (key) => ({ key, rev: view.rev, ops, baseHash, hash: view.hash }));
  } catch (err) {
    console.warn(`[realtime] live view ${view.url} failed:`, err.message);
  } finally {
    view.running = false;
    if (view.pending && views.has(view.id)) schedule(view);
  }
}

function schedule(view) {
  if (view.timer) return;
  const minGap = view.runs.length >= BURST_LIMIT ? 3000 : view.route.minIntervalMs || 400;
  const wait = Math.max(DEBOUNCE_MS, (view.lastRunAt || 0) + minGap - Date.now());
  view.timer = setTimeout(() => recompute(view), wait);
}

function affects(view, change) {
  const { route } = view;
  if (change.coll === "*") return true;
  const coll = change.coll.toLowerCase();
  if (!route.deps.has(coll)) return false;
  const ignored = route.ignoreFields?.[coll];
  if (ignored && change.op === "update" && change.updatedFields?.length) {
    const relevant = change.updatedFields.some(
      (field) => !ignored.some((prefix) => field === prefix || field.startsWith(`${prefix}.`))
    );
    if (!relevant) return false;
  }
  if (route.scope && change.doc) {
    try {
      return route.scope(change.doc, view.identity, coll) !== false;
    } catch {
      return true;
    }
  }
  return true;
}

function onChange(change) {
  views.forEach((view) => {
    if (!affects(view, change)) return;
    if (view.data === undefined) view.changedDuringLoad = true;
    else schedule(view);
  });
}

async function subscribe(socket, payload, ack) {
  const reply = typeof ack === "function" ? ack : () => {};
  const key = String(payload?.key || "");
  const url = String(payload?.url || "");
  if (!key || !url.startsWith("/api/")) return reply({ ok: false, reason: "bad_request" });

  const route = matchRoute(url);
  if (!route) return reply({ ok: false, reason: "not_live" });

  const token = extractToken(payload?.token);
  let identity = null;
  if (token) {
    identity = await identityFromToken(token);
    if (!identity) return reply({ ok: false, reason: "unauthorized", status: 401 });
  } else if (!route.public) {
    return reply({ ok: false, reason: "unauthorized", status: 401 });
  }

  const id = `${token ? sha(token) : "public"} ${url}`;
  let view = views.get(id);
  if (!view) {
    view = {
      id,
      url,
      token,
      identity,
      route,
      subscribers: new Map(),
      data: undefined,
      hash: "",
      bytes: 0,
      rev: 0,
      runs: [],
      lastRunAt: 0,
      timer: null,
      running: false,
      pending: false,
      ready: null,
    };
    views.set(id, view);
  }
  if (!view.subscribers.has(socket)) view.subscribers.set(socket, new Set());
  view.subscribers.get(socket).add(key);
  socket.data.liveKeys = socket.data.liveKeys || new Map();
  socket.data.liveKeys.set(key, id);

  try {
    if (view.data === undefined) {
      view.ready =
        view.ready ||
        enqueue(() => fetchView(view)).then((result) => {
          if (result.ok) {
            setViewData(view, result.body);
            view.lastRunAt = Date.now();
            if (view.changedDuringLoad) schedule(view);
          }
          view.changedDuringLoad = false;
          return result;
        });
      const result = await view.ready;
      view.ready = null;
      if (!result.ok) {
        unsubscribe(socket, key);
        return reply({ ok: false, reason: "http_error", status: result.status });
      }
    }
    return reply(catchUpReply(view, String(payload?.hash || "")));
  } catch (err) {
    unsubscribe(socket, key);
    return reply({ ok: false, reason: "error", message: err.message });
  }
}

function unsubscribe(socket, key) {
  const viewId = socket.data.liveKeys?.get(key);
  if (!viewId) return;
  socket.data.liveKeys.delete(key);
  const view = views.get(viewId);
  if (!view) return;
  const keys = view.subscribers.get(socket);
  keys?.delete(key);
  if (keys && !keys.size) view.subscribers.delete(socket);
  if (!view.subscribers.size) dropView(view);
}

function unsubscribeAll(socket) {
  [...(socket.data.liveKeys?.keys() || [])].forEach((key) => unsubscribe(socket, key));
}

export function registerLiveSocket(socket) {
  socket.on("live:subscribe", (payload, ack) => {
    subscribe(socket, payload, ack).catch(() => ack?.({ ok: false, reason: "error" }));
  });
  socket.on("live:unsubscribe", (payload) => unsubscribe(socket, String(payload?.key || "")));
  socket.on("disconnect", () => unsubscribeAll(socket));
}

/**
 * @param {{ port: number|string, routes: Array<{ path: string, deps: string[], exact?: boolean,
 *   public?: boolean, entity?: string, minIntervalMs?: number,
 *   ignoreFields?: Record<string, string[]>, scope?: (doc, identity, coll) => boolean }> }} options
 */
export function startLiveViews({ port, routes: routeList }) {
  baseUrl = `http://127.0.0.1:${port}`;
  routes = routeList
    .map((route) => ({
      ...route,
      deps: new Set(route.deps.map((d) => d.toLowerCase())),
      ignoreFields: route.ignoreFields
        ? Object.fromEntries(Object.entries(route.ignoreFields).map(([k, v]) => [k.toLowerCase(), v]))
        : null,
    }))
    .sort((a, b) => b.path.length - a.path.length);
  changeFeed.on("change", onChange);
}

export function liveViewStats() {
  return { views: views.size, queued: queue.length, active };
}
