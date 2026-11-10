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

export function parseOrderQrPayload(payload) {
  const json = parseQrJson(payload);
  if (json) {
    if (json.t === "batch") return "";
    return String(json.id || json.orderId || "").trim();
  }
  const raw = String(payload || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const scan = u.pathname.match(/\/scan\/([^/]+)/i);
    if (scan) return parseOrderQrPayload(decodeURIComponent(scan[1]));
    const q = u.searchParams.get("q") || u.searchParams.get("order") || u.searchParams.get("code");
    if (q) return parseOrderQrPayload(q);
  } catch {
    /* not a URL */
  }
  const biz = raw.match(/(GGC-ORD-[A-Za-z0-9-]+)/i);
  if (biz) return biz[1];
  const tagged = raw.match(/(?:greengro(?:o|cc):order:|ggp\.order\.)([A-Za-z0-9_-]+)/i);
  if (tagged) return tagged[1];
  return raw.replace(/^order[:#\s]+/i, "").trim();
}

export function buildOrderQrPayload(record = {}) {
  const existing = parseQrJson(record.qrPayload);
  const pickup = record.pickup && typeof record.pickup === "object" ? record.pickup : {};
  const id =
    parseOrderQrPayload(record.qrPayload || record.orderDisplayId || record.orderId || record.id || pickup.orderId || "") ||
    String(record.orderDisplayId || record.orderId || record.id || "").trim();
  if (!id) return existing ? JSON.stringify(existing) : "";
  const qty = Number(
    record.packedQuantity ??
      pickup.packedQuantity ??
      record.expectedQuantity ??
      record.orderedQuantity ??
      record.quantity ??
      existing?.qty
  );
  const loc =
    record.pickupLocation || record.farmerLocation || record.farmLocation || pickup.pickupLocation || existing?.loc || "";
  return JSON.stringify(
    compactQr({
      v: 1,
      t: "order",
      id,
      pickupId: record.pickupId || pickup.id || pickup.pickupId || existing?.pickupId || "",
      batchId:
        record.collectionBatchId || record.lotId || record.batchId || pickup.collectionBatchId || existing?.batchId || "",
      farmerId: record.farmerId || existing?.farmerId || "",
      farmer: record.farmerName || existing?.farmer || "",
      mobile: record.farmerMobile || pickup.farmerMobile || existing?.mobile || "",
      loc: String(loc).slice(0, 100),
      product: record.productName || record.name || existing?.product || "",
      productId: record.productId || existing?.productId || "",
      variety: record.variety || existing?.variety || "",
      grade: record.grade || existing?.grade || "",
      qty: Number.isFinite(qty) && qty > 0 ? qty : undefined,
      pkgs: Number(record.packageCount || pickup.packageCount || existing?.pkgs) || undefined,
      unit: record.unit || existing?.unit || "",
      date:
        record.orderDate ||
        record.scheduledDate ||
        record.pickupDate ||
        record.harvestDate ||
        pickup.pickupDate ||
        existing?.date ||
        "",
      time: record.scheduledTime || record.pickupTime || pickup.pickupTime || existing?.time || "",
      centre:
        record.collectionCentreName || record.collectionCentre || pickup.collectionCentreName || existing?.centre || "",
      driverId: record.driverId || pickup.driverId || existing?.driverId || "",
      driver: record.driverName || pickup.driverName || existing?.driver || "",
      vehicle: record.vehicleNumber || pickup.vehicleNumber || existing?.vehicle || "",
      vehicleId: record.vehicleId || pickup.vehicleId || existing?.vehicleId || "",
    })
  );
}

export function orderQrEncodeValue(value, record) {
  if (record && typeof record === "object") return buildOrderQrPayload({ ...record, qrPayload: record.qrPayload || value });
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (parseQrJson(raw)?.t === "order") return raw;
  return buildOrderQrPayload({ orderId: parseOrderQrPayload(raw) || raw, qrPayload: raw });
}

export function orderQrLabel(payload) {
  const id = parseOrderQrPayload(payload);
  return id ? `greengrocc:order:${id}` : String(payload || "");
}

export function orderQrValue(order) {
  if (!order) return "";
  return buildOrderQrPayload(order) || String(order.qrPayload || order.orderDisplayId || order.orderId || order.id || "").trim();
}

export function orderQrFacts(payloadOrRecord) {
  const json =
    payloadOrRecord && typeof payloadOrRecord === "object" && !payloadOrRecord.t
      ? parseQrJson(buildOrderQrPayload(payloadOrRecord))
      : parseQrJson(payloadOrRecord);
  if (!json || json.t === "batch") return "";
  const qty = json.qty != null ? `${json.qty}${json.unit ? ` ${json.unit}` : ""}` : "";
  return [json.farmer, json.product, json.variety, qty, json.centre].filter(Boolean).join(" · ");
}
