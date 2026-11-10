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
  return raw.replace(/^batch[:#\s]+/i, "").trim();
}

export function isBatchQrPayload(payload) {
  const json = parseQrJson(payload);
  if (json?.t === "order") return false;
  if (json?.t === "batch") return true;
  const raw = String(payload || "");
  return /greengro(?:o|cc):batch:|ggp\.batch\.|\/batches\//i.test(raw) || /^GGC-BAT-/i.test(raw.trim());
}

export function buildBatchQrPayload(record = {}, batchId = "") {
  const existing = parseQrJson(record.qrPayload);
  const id =
    parseBatchQrPayload(record.qrPayload || record.batchId || record.lotId || record.collectionBatchId || batchId) ||
    String(batchId || record.batchId || record.lotId || record.collectionBatchId || "").trim();
  if (!id) return existing ? JSON.stringify(existing) : "";
  const pickups = Array.isArray(record.pickups) ? record.pickups : [];
  const farmers = record.farmers?.length
    ? record.farmers
    : [...new Set(pickups.map((p) => p.farmerName).filter(Boolean))];
  const products = record.products?.length
    ? record.products
    : [...new Set(pickups.map((p) => p.productName).filter(Boolean))];
  const first = pickups[0] || record;
  const driver = first.driver || {};
  const orderIds = [
    ...(Array.isArray(record.orderIds) ? record.orderIds : []),
    ...pickups.map((p) => p.orderDisplayId || p.orderId).filter(Boolean),
  ];
  return JSON.stringify(
    compactQr({
      v: 1,
      t: "batch",
      id,
      orders: pickups.length || record.orderCount || existing?.orders || undefined,
      orderIds: [...new Set(orderIds)].slice(0, 20),
      farmers: farmers.length ? farmers : existing?.farmers,
      products: products.length ? products : existing?.products,
      driverId: record.driverId || first.driverId || driver.id || driver.driverId || existing?.driverId || "",
      driver: record.driverName || first.driverName || driver.name || existing?.driver || "",
      vehicleId: record.vehicleId || first.vehicleId || driver.vehicleId || existing?.vehicleId || "",
      vehicle: record.vehicleNumber || first.vehicleNumber || driver.vehicleNumber || existing?.vehicle || "",
      centre: record.collectionCentreName || first.collectionCentreName || existing?.centre || "",
    })
  );
}

export function batchQrEncodeValue(value, record) {
  if (record && typeof record === "object") {
    return buildBatchQrPayload(record, value);
  }
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (parseQrJson(raw)?.t === "batch") return raw;
  return buildBatchQrPayload({ batchId: parseBatchQrPayload(raw) || raw, qrPayload: raw });
}

export function batchQrLabel(id) {
  const batchId = parseBatchQrPayload(id);
  return batchId ? `greengrocc:batch:${batchId}` : String(id || "");
}

export function batchScanPath(id) {
  const batchId = parseBatchQrPayload(id);
  return batchId ? `/vendor/batches/${encodeURIComponent(batchId)}` : "/vendor/collection-centre";
}

export function batchScanUrl(id) {
  const path = batchScanPath(id);
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function batchQrFacts(payloadOrRecord) {
  const json =
    payloadOrRecord && typeof payloadOrRecord === "object" && payloadOrRecord.t !== "batch" && payloadOrRecord.t !== "order"
      ? parseQrJson(buildBatchQrPayload(payloadOrRecord))
      : parseQrJson(payloadOrRecord);
  if (!json || json.t === "order") return "";
  const farmers = Array.isArray(json.farmers) ? json.farmers.join(", ") : json.farmers;
  const products = Array.isArray(json.products) ? json.products.join(", ") : json.products;
  return [farmers, products, json.orders != null ? `${json.orders} orders` : "", json.driver, json.vehicle].filter(Boolean).join(" · ");
}
