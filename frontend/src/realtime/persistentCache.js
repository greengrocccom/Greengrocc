/**
 * Device copy of live data (IndexedDB), so a reload shows the last data
 * instantly and the server only has to confirm it or send what changed.
 * Every call fails soft: without IndexedDB the app simply loads from the network.
 */

const DB_NAME = "greengrocc-live-cache";
const STORE = "entries";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;
const WRITE_DEBOUNCE_MS = 300;

let dbPromise = null;
const pendingWrites = new Map();
let writeTimer = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("savedAt", "savedAt");
      };
      request.onsuccess = () => {
        resolve(request.result);
        setTimeout(prune, 5000);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run(mode, action) {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(STORE, mode);
          const request = action(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(request?.result);
          tx.onerror = () => resolve(undefined);
          tx.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      })
  );
}

/** `{ data, hash, savedAt }` for a key, or null when missing / too old. */
export async function readPersisted(key) {
  if (pendingWrites.has(key)) {
    const pending = pendingWrites.get(key);
    return pending.removed ? null : pending;
  }
  const row = await run("readonly", (store) => store.get(key));
  if (!row || Date.now() - row.savedAt > MAX_AGE_MS) return null;
  return row;
}

function flushWrites() {
  writeTimer = null;
  const rows = [...pendingWrites.values()];
  pendingWrites.clear();
  if (!rows.length) return;
  run("readwrite", (store) => {
    rows.forEach((row) => (row.removed ? store.delete(row.key) : store.put(row)));
  });
}

function queue(row) {
  pendingWrites.set(row.key, row);
  if (!writeTimer) writeTimer = setTimeout(flushWrites, WRITE_DEBOUNCE_MS);
}

export function writePersisted(key, data, hash) {
  if (data === undefined) return;
  queue({ key, data, hash: hash || "", savedAt: Date.now() });
}

export function removePersisted(key) {
  queue({ key, removed: true });
}

export async function clearPersisted() {
  pendingWrites.clear();
  await run("readwrite", (store) => store.clear());
}

/** Drop expired rows and keep only the newest MAX_ENTRIES. */
async function prune() {
  const cutoff = Date.now() - MAX_AGE_MS;
  await run("readwrite", (store) => {
    const keep = [];
    const request = store.index("savedAt").openCursor(null, "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.savedAt < cutoff || keep.length >= MAX_ENTRIES) cursor.delete();
      else keep.push(cursor.primaryKey);
      cursor.continue();
    };
    return request;
  });
}
