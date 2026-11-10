function compactQr(obj = {}) {
  const out = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value == null || value === "") return;
    if (Array.isArray(value) && !value.length) return;
    out[key] = value;
  });
  return out;
}

export function parseQrJson(payload) {
  const raw = String(payload || "").trim();
  if (!raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* not json */
  }
  return null;
}

export function parseBatchQrPayload(payload) {
  const json = parseQrJson(payload);
  if (json) {
    if (json.t === "order") return String(json.batchId || "").trim();
    return String(json.id || json.batchId || json.lotId || "").trim();
  }
  const raw = String(payload || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const batch = u.pathname.match(/\/batches\/([^/]+)/i);
    if (batch) return decodeURIComponent(batch[1]);
    const q = u.searchParams.get("q") || u.searchParams.get("batch") || u.searchParams.get("code");
    if (q) return parseBatchQrPayload(q);
  } catch {
    /* not a URL */
  }
  const biz = raw.match(/(GGC-BAT-[A-Za-z0-9-]+)/i);
  if (biz) return biz[1];
  const tagged = raw.match(/(?:greengro(?:o|cc):batch:|ggp\.batch\.)([A-Za-z0-9_-]+)/i);
  if (tagged) return tagged[1];
  return "";
}

export function isBatchQrPayload(payload) {
  const json = parseQrJson(payload);
  if (json?.t === "order") return false;
  if (json?.t === "batch") return true;
  const raw = String(payload || "");
  return /greengro(?:o|cc):batch:|ggp\.batch\.|\/batches\//i.test(raw) || /^GGC-BAT-/i.test(raw.trim());
}
