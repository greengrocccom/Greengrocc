import crypto from "crypto";
import {
  Farmer,
  FarmerOrder,
  FarmerHarvestOrder,
  FarmerProduct,
  FarmerStockHistory,
  FarmerEarning,
  CollectionCentre,
  Pickup,
  QualityInspection,
} from "./models.js";
import { getIO } from "../../shared/socket.js";
import { pushFarmerOrderChange } from "./farmerPush.js";
import { syncQualityToErp } from "../../erp-service/src/services/harvestSync.js";
import { parsePickupQr } from "./pickupControllers.js";
import { FARMER_LIST_EXCLUDE, PICKUP_LIST_EXCLUDE, INSPECTION_LIST_EXCLUDE } from "./listProjections.js";
import { generateId } from "../../erp-service/src/services/idGenerator.js";
import { todayYmd } from "../../erp-service/src/config/idRegistry.js";

const QUALITY_PENDING = "QUALITY_PENDING";
const INSPECTION = "INSPECTION";
const GRADING = "GRADING";
const GRADE_CONFIRMED = "GRADE_CONFIRMED";
const ORDER_COMPLETED = "ORDER_COMPLETED";
const LOCKED_STATUSES = [GRADE_CONFIRMED, ORDER_COMPLETED];
const RECEIVED_STATUSES = ["COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE"];

export const QUALITY_PARAM_OPTIONS = {
  freshness: ["Excellent", "Good", "Average", "Poor"],
  size: ["Uniform", "Mixed", "Small", "Large"],
  colour: ["Good", "Average", "Poor"],
  appearance: ["Excellent", "Good", "Average", "Poor"],
  cleanliness: ["Clean", "Acceptable", "Poor"],
  damage: ["None", "Low", "Medium", "High"],
  moisture: ["Normal", "High", "Low"],
  weight: ["Verified", "Variation"],
  overallQuality: ["Excellent", "Good", "Average", "Poor"],
};

export const REJECTION_REASONS = [
  "Poor Quality",
  "Damaged",
  "Overripe",
  "Undersized",
  "Contamination",
  "Excess Moisture",
  "Other",
];

const REQUIRED_PARAMS = [
  "freshness",
  "size",
  "colour",
  "appearance",
  "cleanliness",
  "damage",
  "moisture",
  "weight",
  "overallQuality",
];

const FINAL_TIMELINE = [
  { key: "ACCEPTED", label: "Order Accepted" },
  { key: "PREPARING", label: "Order Preparation" },
  { key: "PACKING", label: "Packing Completed" },
  { key: "READY_FOR_PICKUP", label: "Pickup" },
  { key: "QR_VERIFIED", label: "QR Verification" },
  { key: "COLLECTION_CENTRE_RECEIVED", label: "Collection Centre Received" },
  { key: "WEIGHT_VERIFICATION", label: "Weight Verification" },
  { key: "QUALITY_CHECK", label: "Quality Check" },
  { key: "GRADING_COMPLETED", label: "Grading Completed" },
  { key: "ORDER_COMPLETED", label: "Order Completed" },
];

function vendorIdOf(req) {
  return req.user?.vendorId || req.user?.id || "";
}

function managerIdOf(req) {
  return req.user?.managerId || req.user?.id || "";
}

function actorOf(req) {
  return {
    id: req.user?.id || req.user?.managerId || req.user?.vendorId || "",
    role: req.user?.role || "",
    name: req.user?.name || req.user?.vendorName || "",
  };
}

function toPlain(doc) {
  if (!doc) return null;
  return typeof doc.toObject === "function" ? doc.toObject() : doc;
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}

async function nextQualityInspectionId(date) {
  try {
    return await generateId({ module: "QC", date: date ? todayYmd(date) : todayYmd() });
  } catch (err) {
    console.error("generateId for QC failed, falling back to date-sequence:", err);
    const dStr = todayYmd(date || new Date());
    return `GGC-QC-${dStr}-${String(Date.now()).slice(-6)}`;
  }
}

function qty(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.round(v * 1000) / 1000;
}

function flattenOrder(order) {
  const plain = toPlain(order) || {};
  const first = plain.products?.[0] || {};
  return {
    productId: plain.productId || first.id || first.productId || "",
    productName: plain.productName || first.name || "",
    variety: plain.variety || first.variety || "",
    grade: plain.grade || first.grade || "",
    orderedQuantity: Number(plain.orderedQuantity || first.quantity || plain.totalQuantity || 0),
    unit: plain.unit || first.unit || "Kg",
    price: Number(plain.price || first.price || 0),
    orderValue: Number(plain.orderValue || plain.totalAmount || plain.amount || 0),
  };
}

function toISODate(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function orderDateFromBusinessId(id) {
  const m = String(id || "").match(/GGC-ORD-(\d{4})(\d{2})(\d{2})/i);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function orderGrades(order) {
  if (Array.isArray(order?.grades) && order.grades.length) return order.grades;
  const first = order?.products?.[0];
  if (Array.isArray(first?.grades) && first.grades.length) return first.grades;
  return [];
}

function weightGradesOf(pickup, order) {
  const rec = pickup?.receiving || {};
  const rows = Array.isArray(rec.grades) ? rec.grades : [];
  const out = [];
  const seen = new Set();
  for (const g of rows) {
    const label = normalizeGradeKey(g.label || g.name) || String(g.label || g.name || "").trim();
    if (!label) continue;
    const expectedWeight = qty(g.expectedWeight);
    const actualWeight = qty(g.actualWeight);
    const acceptedWeight = qty(g.acceptedWeight);
    if (!(expectedWeight > 0 || actualWeight > 0 || acceptedWeight > 0)) continue;
    seen.add(label);
    out.push({
      label,
      expectedWeight,
      actualWeight,
      acceptedWeight,
      difference: g.difference != null && g.difference !== "" ? qty(g.difference) : qty(acceptedWeight - expectedWeight),
    });
  }
  if (!out.length) {
    for (const g of orderGrades(order)) {
      const label = normalizeGradeKey(g.label || g.name || g.grade) || String(g.label || g.name || g.grade || "").trim();
      const expectedWeight = qty(g.quantity || g.qty);
      if (!label || seen.has(label) || !(expectedWeight > 0)) continue;
      seen.add(label);
      out.push({
        label,
        expectedWeight,
        actualWeight: 0,
        acceptedWeight: 0,
        difference: qty(0 - expectedWeight),
      });
    }
  }
  const rank = { "Grade A": 0, "Grade B": 1, "Grade C": 2 };
  out.sort((a, b) => (rank[a.label] ?? 9) - (rank[b.label] ?? 9) || String(a.label).localeCompare(String(b.label)));
  return out;
}

function isWeightVerified(pickup) {
  const rec = pickup?.receiving || {};
  const received =
    RECEIVED_STATUSES.includes(pickup?.status) || rec.status === "RECEIVED";
  return Boolean(received && rec.status === "RECEIVED" && rec.receivedAt);
}

function parseQualityQr(payload) {
  return parsePickupQr(payload);
}

function qrMatches(pickup, order, raw) {
  const value = String(raw || "").trim();
  if (!value) return false;
  const parsed = parseQualityQr(value);
  if (pickup.qrPayload && value === pickup.qrPayload) return true;
  if (pickup.qrToken && (parsed.token === pickup.qrToken || value === pickup.qrToken)) return true;
  const ids = [order?.id, order?.orderId, pickup?.orderId].filter(Boolean).map(String);
  if (parsed.orderId && ids.includes(parsed.orderId)) return true;
  return ids.some((id) => value.includes(id));
}

function receivedQuantity(pickup, order) {
  const rec = pickup?.receiving || {};
  const accepted = qty(rec.acceptedWeight);
  if (accepted > 0) return accepted;
  const actual = qty(rec.actualWeight);
  if (actual > 0) return actual;
  return qty(pickup?.confirmedQuantity || pickup?.packedQuantity || order?.packedQuantity || 0);
}

function parametersComplete(params = {}) {
  return REQUIRED_PARAMS.every((key) => String(params[key] || "").trim());
}

const GRADE_KEYS = ["Grade A", "Grade B", "Grade C"];

function emptyParams() {
  return Object.fromEntries(REQUIRED_PARAMS.map((key) => [key, ""]));
}

function normalizeGradeKey(value) {
  const raw = String(value || "").trim();
  if (GRADE_KEYS.includes(raw)) return raw;
  const upper = raw.toUpperCase();
  if (upper === "A" || upper.includes("GRADE A") || upper === "PREMIUM") return "Grade A";
  if (upper === "B" || upper.includes("GRADE B") || upper === "STANDARD") return "Grade B";
  if (upper === "C" || upper.includes("GRADE C") || upper.includes("LOW")) return "Grade C";
  return "";
}

function gradeQualityOf(inspection = {}) {
  const raw = inspection.gradeQuality && typeof inspection.gradeQuality === "object" ? inspection.gradeQuality : {};
  const out = {};
  for (const key of GRADE_KEYS) {
    const row = raw[key] && typeof raw[key] === "object" ? raw[key] : {};
    out[key] = {
      parameters: { ...emptyParams(), ...(row.parameters || row.qualityParameters || {}) },
      photos: Array.isArray(row.photos) ? row.photos : [],
      remarks: String(row.remarks || ""),
      rejectedQuantity: qty(row.rejectedQuantity),
      rejectionReason: String(row.rejectionReason || ""),
      rejectionRemarks: String(row.rejectionRemarks || ""),
      expiryDate: String(row.expiryDate || inspection.expiryDate || ""),
      packagingDate: String(row.packagingDate || inspection.packagingDate || ""),
    };
  }
  const legacyParams = inspection.qualityParameters || {};
  if (!parametersComplete(out["Grade A"].parameters) && parametersComplete(legacyParams)) {
    out["Grade A"].parameters = { ...emptyParams(), ...legacyParams };
  }
  if (!(out["Grade A"].photos || []).length && Array.isArray(inspection.qualityPhotos) && inspection.qualityPhotos.length) {
    out["Grade A"].photos = inspection.qualityPhotos;
  }
  return out;
}

function flattenGradeParams(gradeQuality) {
  for (const key of GRADE_KEYS) {
    if (parametersComplete(gradeQuality?.[key]?.parameters)) return gradeQuality[key].parameters;
  }
  return gradeQuality?.["Grade A"]?.parameters || emptyParams();
}

function flattenGradePhotos(gradeQuality) {
  return GRADE_KEYS.flatMap((key) =>
    (gradeQuality?.[key]?.photos || []).map((p) => ({
      url: p.url || p.src || "",
      label: p.label || key,
      uploadedAt: p.uploadedAt,
    }))
  );
}

function gradeParametersComplete(inspection, split) {
  const gq = gradeQualityOf(inspection);
  const needed = [
    [split.gradeA, "Grade A"],
    [split.gradeB, "Grade B"],
    [split.gradeC, "Grade C"],
  ].filter(([quantity]) => quantity > 0);
  if (!needed.length) {
    return GRADE_KEYS.some((key) => parametersComplete(gq[key].parameters)) || parametersComplete(inspection.qualityParameters);
  }
  return needed.every(([, key]) => parametersComplete(gq[key].parameters));
}

function sanitizeParameters(body = {}) {
  const src = body.qualityParameters || body.parameters || body;
  const next = {};
  for (const key of REQUIRED_PARAMS) {
    const value = String(src[key] || "").trim();
    const allowed = QUALITY_PARAM_OPTIONS[key];
    if (value && !allowed.includes(value)) {
      const err = new Error(`Invalid ${key} value`);
      err.status = 400;
      throw err;
    }
    next[key] = value;
  }
  return next;
}

function sanitizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .map((p) => {
      if (typeof p === "string") return { url: p, label: "", uploadedAt: new Date() };
      return {
        url: String(p.url || p.src || ""),
        label: String(p.label || p.kind || ""),
        uploadedAt: p.uploadedAt ? new Date(p.uploadedAt) : new Date(),
      };
    })
    .filter((p) => p.url && p.url.length > 20 && p.url.length < 2_500_000)
    .filter((p) => p.url.startsWith("data:image/") || p.url.startsWith("http://") || p.url.startsWith("https://"))
    .slice(0, 8);
}

function recordAction(inspection, req, action) {
  const actor = actorOf(req);
  inspection.lastActionBy = actor.id;
  inspection.lastActionRole = actor.role;
  inspection.lastActionAt = new Date();
  inspection.actions = [
    ...(inspection.actions || []),
    { action, userId: actor.id, role: actor.role, at: new Date() },
  ];
}

async function applyOrderStatus(order, status, note) {
  if (!order) return;
  order.status = status;
  order.preparationStatus = status;
  order.timeline = [...(order.timeline || []), { status, at: new Date(), note }];
  await order.save();
  pushFarmerOrderChange(order, { statusChanged: true });
}

function emitQualityUpdate(payload) {
  try {
    const io = getIO();
    if (payload.farmerId) io.to(`farmer_${payload.farmerId}`).emit("quality_updated", payload);
    if (payload.managerId) io.to(`manager_${payload.managerId}`).emit("quality_updated", payload);
    if (payload.vendorId) io.to(`vendor_${payload.vendorId}`).emit("quality_updated", payload);
  } catch {
    // optional
  }
}

async function assertQualityAccess(req, pickup, farmer) {
  if (req.user?.role === "VENDOR") {
    if (pickup.vendorId !== vendorIdOf(req)) {
      const err = new Error("Forbidden — this order is not in your vendor scope");
      err.status = 403;
      throw err;
    }
    return;
  }
  if (req.user?.role === "FARMER_MANAGER") {
    const f = farmer || (await Farmer.findOne({ id: pickup.farmerId }).lean());
    if (!f || f.managerId !== managerIdOf(req)) {
      const err = new Error("Forbidden — this order is not assigned to you");
      err.status = 403;
      throw err;
    }
    return;
  }
  const err = new Error("Forbidden — Quality inspection requires Vendor or Manager access");
  err.status = 403;
  throw err;
}

async function scopedFarmerIds(req) {
  if (req.user?.role === "VENDOR") {
    const farmers = await Farmer.find({ vendorId: vendorIdOf(req) }).select("id").lean();
    return farmers.map((f) => f.id);
  }
  const farmers = await Farmer.find({ managerId: managerIdOf(req) }).select("id").lean();
  return farmers.map((f) => f.id);
}

async function findPickupForOrder(orderId) {
  const pickup = await Pickup.findOne({
    $or: [{ orderId }, { id: orderId }, { pickupId: orderId }],
  });
  if (pickup) return pickup;
  const order = await findOrder(orderId);
  if (!order) return null;
  return Pickup.findOne({
    $or: [{ orderId: order.id }, { orderId: order.orderId }],
  });
}

async function findOrder(orderId) {
  let ord = await FarmerOrder.findOne({ $or: [{ id: orderId }, { orderId }] });
  if (!ord) {
    ord = await FarmerHarvestOrder.findOne({ $or: [{ id: orderId }, { orderId }] });
  }
  return ord;
}

// First doc (in query order) per key, matching findOne({ $or: [{ field: key }, ...] }) semantics.
function firstByKeys(docs, fields, map = new Map()) {
  for (const doc of docs) {
    for (const field of fields) {
      const key = doc?.[field];
      if (key && !map.has(String(key))) map.set(String(key), doc);
    }
  }
  return map;
}

// Batch equivalent of findOrder(): FarmerOrder first, FarmerHarvestOrder for keys it misses.
async function loadOrdersByKeys(keys, cache) {
  const missing = [...new Set(keys.filter(Boolean).map(String))].filter((key) => !cache.has(key));
  if (!missing.length) return cache;
  const byKey = firstByKeys(
    await FarmerOrder.find({ $or: [{ id: { $in: missing } }, { orderId: { $in: missing } }] }),
    ["id", "orderId"]
  );
  const harvestKeys = missing.filter((key) => !byKey.has(key));
  if (harvestKeys.length) {
    const harvest = firstByKeys(
      await FarmerHarvestOrder.find({ $or: [{ id: { $in: harvestKeys } }, { orderId: { $in: harvestKeys } }] }),
      ["id", "orderId"]
    );
    harvestKeys.forEach((key) => {
      if (harvest.has(key)) byKey.set(key, harvest.get(key));
    });
  }
  missing.forEach((key) => cache.set(key, byKey.get(key) || null));
  return cache;
}

async function orderFromCache(cache, orderId) {
  const key = orderId ? String(orderId) : "";
  if (key && cache.has(key)) return cache.get(key);
  return findOrder(orderId);
}

async function ensureInspection(pickup, order) {
  const orderId = order?.id || pickup.orderId;
  let inspection = await QualityInspection.findOne({
    $or: [{ orderId }, { pickupId: pickup.id }, { batchId: pickup.id }],
  });
  if (inspection) {
    if (pickup.collectionBatchId && inspection.batchId !== pickup.collectionBatchId) {
      inspection.batchId = pickup.collectionBatchId;
      await inspection.save();
    }
    if (!inspection.inspectionId || !inspection.inspectionId.startsWith("GGC-QC-")) {
      try {
        inspection.inspectionId = await nextQualityInspectionId(inspection.createdAt);
        await inspection.save();
      } catch (err) {
        console.error("Failed to upgrade inspectionId for existing inspection:", err);
      }
    }
    return inspection;
  }
  const flat = flattenOrder(order || {});
  const inspectionId = await nextQualityInspectionId();
  inspection = await QualityInspection.create({
    inspectionId,
    orderId,
    farmerId: pickup.farmerId,
    productId: flat.productId || order?.productId || "",
    batchId: pickup.collectionBatchId || pickup.id,
    collectionCentreId: pickup.collectionCentreId || "",
    pickupId: pickup.id,
    vendorId: pickup.vendorId,
    status: QUALITY_PENDING,
  });
  return inspection;
}

export async function beginQualityAfterReceive(req, pickup, order) {
  if (!pickup) return null;
  if (!isWeightVerified(pickup)) return null;
  const resolvedOrder = order || (await findOrder(pickup.orderId));
  const inspection = await ensureInspection(pickup, resolvedOrder);
  if (!inspection || LOCKED_STATUSES.includes(inspection.status)) return inspection;
  if (inspection.status !== QUALITY_PENDING && inspection.status !== INSPECTION) {
    return inspection;
  }
  if (inspection.status === INSPECTION && inspection.inspectionStartedAt) {
    return inspection;
  }
  const actor = actorOf(req);
  const now = new Date();
  inspection.status = INSPECTION;
  inspection.inspectionStartedAt = inspection.inspectionStartedAt || now;
  inspection.inspectorId = actor.id;
  inspection.inspectorRole = actor.role;
  inspection.inspectorName = actor.name;
  recordAction(inspection, req, "START_QUALITY_CHECK");
  await inspection.save();
  await applyOrderStatus(resolvedOrder, INSPECTION, "Quality inspection started.");
  const farmer = await Farmer.findOne({ id: pickup.farmerId }).lean();
  emitQualityUpdate({
    orderId: resolvedOrder?.id || pickup.orderId,
    farmerId: inspection.farmerId,
    vendorId: pickup.vendorId,
    managerId: farmer?.managerId || pickup.managerId,
    status: inspection.status,
  });
  return inspection;
}

function gradeRejectedTotal(gq) {
  return qty(GRADE_KEYS.reduce((sum, key) => sum + qty(gq?.[key]?.rejectedQuantity), 0));
}

function firstGradeRejection(gq) {
  for (const key of GRADE_KEYS) {
    if (qty(gq?.[key]?.rejectedQuantity) > 0) {
      return {
        reason: String(gq[key].rejectionReason || "").trim(),
        remarks: String(gq[key].rejectionRemarks || "").trim(),
      };
    }
  }
  return { reason: "", remarks: "" };
}

function applyGradeRejectionRows(inspection, incoming) {
  if (!incoming || typeof incoming !== "object") return gradeQualityOf(inspection);
  const gq = gradeQualityOf(inspection);
  for (const key of GRADE_KEYS) {
    const row = incoming[key];
    if (!row || typeof row !== "object") continue;
    if (row.rejectedQuantity != null) gq[key].rejectedQuantity = qty(row.rejectedQuantity);
    if (row.rejectionReason != null) gq[key].rejectionReason = String(row.rejectionReason).trim();
    if (row.rejectionRemarks != null) gq[key].rejectionRemarks = String(row.rejectionRemarks).trim();
  }
  return gq;
}

function receivingGradeQty(pickup, order, label) {
  const wr = weightGradesOf(pickup, order).find((g) => g.label === label);
  if (!wr) return 0;
  if (wr.acceptedWeight > 0) return wr.acceptedWeight;
  if (wr.actualWeight > 0) return wr.actualWeight;
  return 0;
}

function clampGradesToReceived(a, b, c, totalReceived) {
  let gradeA = qty(a);
  let gradeB = qty(b);
  let gradeC = qty(c);
  const received = qty(totalReceived);
  const allocated = qty(gradeA + gradeB + gradeC);
  if (received > 0 && allocated > received + 0.001 && allocated > 0) {
    const scale = received / allocated;
    gradeA = qty(gradeA * scale);
    gradeB = qty(gradeB * scale);
    gradeC = qty(gradeC * scale);
    const drift = qty(received - (gradeA + gradeB + gradeC));
    if (drift !== 0) {
      if (gradeA >= gradeB && gradeA >= gradeC) gradeA = qty(gradeA + drift);
      else if (gradeB >= gradeC) gradeB = qty(gradeB + drift);
      else gradeC = qty(gradeC + drift);
    }
  }
  return { gradeA, gradeB, gradeC };
}

function applyAssignedGradeQuantities(inspection, pickup, order, body = {}) {
  const received = receivedQuantity(pickup, order);
  let gradeA = receivingGradeQty(pickup, order, "Grade A");
  let gradeB = receivingGradeQty(pickup, order, "Grade B");
  let gradeC = receivingGradeQty(pickup, order, "Grade C");
  if (!(gradeA + gradeB + gradeC > 0)) {
    gradeA = qty(body.gradeAQuantity);
    gradeB = qty(body.gradeBQuantity);
    gradeC = qty(body.gradeCQuantity);
  }
  const clamped = clampGradesToReceived(gradeA, gradeB, gradeC, received);
  inspection.gradeAQuantity = clamped.gradeA;
  inspection.gradeBQuantity = clamped.gradeB;
  inspection.gradeCQuantity = clamped.gradeC;
  let split = splitTotals(inspection, received);
  if (received > 0 && split.remaining > 0.001) {
    const filled = [
      ["gradeAQuantity", split.gradeA],
      ["gradeBQuantity", split.gradeB],
      ["gradeCQuantity", split.gradeC],
    ].filter(([, value]) => value > 0);
    const target = filled.sort((a, b) => b[1] - a[1])[0];
    if (target) {
      inspection[target[0]] = qty(target[1] + split.remaining);
      split = splitTotals(inspection, received);
    }
  }
  return split;
}

function splitTotals(inspection, totalReceived) {
  const gradeA = qty(inspection.gradeAQuantity);
  const gradeB = qty(inspection.gradeBQuantity);
  const gradeC = qty(inspection.gradeCQuantity);
  const gq = gradeQualityOf(inspection);
  const perGradeRejected = gradeRejectedTotal(gq);
  const rejected = perGradeRejected > 0 ? perGradeRejected : qty(inspection.rejectedQuantity);
  const allocated = qty(gradeA + gradeB + gradeC);
  const remaining = qty(totalReceived - allocated);
  return { gradeA, gradeB, gradeC, rejected, allocated, remaining, totalReceived };
}

function assignedQtyForGrade(split, label) {
  if (label === "Grade A") return qty(split.gradeA);
  if (label === "Grade B") return qty(split.gradeB);
  if (label === "Grade C") return qty(split.gradeC);
  return 0;
}

function rateForGrade(order, label) {
  const hit = orderGrades(order).find(
    (g) => normalizeGradeKey(g.label || g.name || g.grade) === label
  );
  const fromGrade = Number(hit?.price ?? hit?.rate ?? hit?.pricePerKg ?? hit?.sellingPrice ?? 0);
  if (fromGrade > 0) return fromGrade;
  const fromProduct = (Array.isArray(order?.products) ? order.products : []).find(
    (p) => normalizeGradeKey(p.grade) === label
  );
  const productRate = Number(fromProduct?.price || 0);
  if (productRate > 0) return productRate;
  const flat = flattenOrder(order);
  if (Number(flat.price) > 0) return Number(flat.price);
  const orderedQty = orderedGradeQty(order, label) || Number(flat.orderedQuantity || 0);
  if (orderedQty > 0 && Number(flat.orderValue) > 0) return qty(Number(flat.orderValue) / orderedQty);
  return 0;
}

function rejectedQtyForGrade(inspection, label) {
  return qty(gradeQualityOf(inspection)?.[label]?.rejectedQuantity);
}

function buildFinalStatementGrades(order, inspection, split = {}) {
  const labels = [...GRADE_KEYS];
  for (const g of orderGrades(order)) {
    const label = normalizeGradeKey(g.label || g.name || g.grade) || String(g.label || g.name || g.grade || "").trim();
    if (label && !labels.includes(label)) labels.push(label);
  }
  const unit = flattenOrder(order).unit || order?.unit || "Kg";
  return labels
    .map((label) => {
      const assigned = assignedQtyForGrade(split, label);
      const rejected = rejectedQtyForGrade(inspection, label);
      const ordered = orderedGradeQty(order, label);
      const rate = rateForGrade(order, label);
      const quantity = qty(Math.max(0, assigned - rejected));
      return {
        label,
        name: label,
        orderedQuantity: ordered,
        assignedQuantity: assigned,
        rejectedQuantity: rejected,
        quantity,
        price: rate,
        rate,
        amount: qty(quantity * rate),
        unit,
      };
    })
    .filter((g) => g.orderedQuantity > 0 || g.assignedQuantity > 0 || g.rejectedQuantity > 0 || g.quantity > 0);
}

function overlayQualityOnOrder(plain = {}, inspection) {
  if (!inspection || !LOCKED_STATUSES.includes(inspection.status)) return {};
  const split = {
    gradeA: qty(inspection.gradeAQuantity),
    gradeB: qty(inspection.gradeBQuantity),
    gradeC: qty(inspection.gradeCQuantity),
    rejected: qty(inspection.rejectedQuantity),
  };
  const source = {
    ...plain,
    grades:
      Array.isArray(plain.orderedGrades) && plain.orderedGrades.length
        ? plain.orderedGrades
        : plain.grades,
  };
  const grades = buildFinalStatementGrades(source, inspection, split);
  const gq = gradeQualityOf(inspection);
  const finalA = grades.find((g) => g.label === "Grade A")?.quantity || 0;
  const finalB = grades.find((g) => g.label === "Grade B")?.quantity || 0;
  const finalC = grades.find((g) => g.label === "Grade C")?.quantity || 0;
  return {
    grades,
    orderedGrades: source.grades || [],
    gradeAQuantity: finalA,
    gradeBQuantity: finalB,
    gradeCQuantity: finalC,
    gradeAAssigned: split.gradeA,
    gradeBAssigned: split.gradeB,
    gradeCAssigned: split.gradeC,
    gradeARejected: grades.find((g) => g.label === "Grade A")?.rejectedQuantity || 0,
    gradeBRejected: grades.find((g) => g.label === "Grade B")?.rejectedQuantity || 0,
    gradeCRejected: grades.find((g) => g.label === "Grade C")?.rejectedQuantity || 0,
    rejectedQuantity: qty(grades.reduce((sum, g) => sum + qty(g.rejectedQuantity), 0)) || split.rejected,
    totalQuantity: qty(finalA + finalB + finalC),
    totalAmount: qty(grades.reduce((sum, g) => sum + qty(g.amount), 0)),
    amount: qty(grades.reduce((sum, g) => sum + qty(g.amount), 0)),
    orderValue: qty(grades.reduce((sum, g) => sum + qty(g.amount), 0)),
    qualityStatus: inspection.status,
    qualityRemarks: inspection.qualityRemarks || "",
    qualityParameters: inspection.qualityParameters || flattenGradeParams(gq),
    qualityPhotos: inspection.qualityPhotos || [],
    gradeQuality: gq,
    packagingDate:
      inspection.packagingDate ||
      gq["Grade A"]?.packagingDate ||
      gq["Grade B"]?.packagingDate ||
      gq["Grade C"]?.packagingDate ||
      plain.packingDetails?.packingDate ||
      plain.packagingDate ||
      "",
    expiryDate:
      inspection.expiryDate ||
      gq["Grade A"]?.expiryDate ||
      gq["Grade B"]?.expiryDate ||
      gq["Grade C"]?.expiryDate ||
      plain.expiryDate ||
      "",
    gradingConfirmedAt: inspection.gradingConfirmedAt || null,
    finalStatement: grades,
  };
}

export { overlayQualityOnOrder, presentInspection };

async function upsertFarmerEarningFromFinalSummary({ order, farmer, grades, pickup }) {
  const farmerId = farmer?.farmerId || farmer?.id || order?.farmerId;
  const orderId = order?.orderId || order?.id;
  if (!farmerId || !orderId) return;
  const flat = flattenOrder(order);
  const quantity = qty(grades.reduce((sum, g) => sum + qty(g.quantity), 0));
  const netEarnings = qty(grades.reduce((sum, g) => sum + qty(g.amount), 0));
  const ids = [...new Set([order.id, order.orderId].filter(Boolean))];
  const existing = await FarmerEarning.findOne({ farmerId, orderId: { $in: ids } });
  const payload = {
    vendorId: farmer?.vendorId || order.vendorId || "vendor-1",
    farmerId,
    orderId,
    date: new Date().toISOString().split("T")[0],
    cropName: flat.productName || order.productName || "Produce",
    variety: order.variety || flat.variety || "",
    pickupDate: pickup?.pickupDate || pickup?.scheduledDate || order.pickupDate || "",
    pickupTime: pickup?.pickupTime || pickup?.scheduledTime || order.pickupTime || "",
    unit: flat.unit || order.unit || "Kg",
    quantity,
    ratePerKg: quantity > 0 ? Math.round(netEarnings / quantity) : 0,
    grossEarnings: netEarnings,
    deductions: qty(grades.reduce((sum, g) => sum + qty(g.rejectedQuantity), 0)),
    netEarnings,
    status: "Pending",
    grades,
  };
  if (existing) {
    Object.assign(existing, payload);
    existing.markModified("grades");
    await existing.save();
    return;
  }
  await FarmerEarning.create({
    id: `earn-${String(orderId).replace(/[^A-Za-z0-9-]/g, "")}-${Date.now()}`,
    ...payload,
  });
}

function orderedGradeQty(order, label) {
  const fromGrades = orderGrades(order)
    .filter((g) => normalizeGradeKey(g.label || g.name || g.grade) === label)
    .reduce((sum, g) => sum + qty(g.quantity || g.qty), 0);
  if (fromGrades > 0) return fromGrades;
  const products = Array.isArray(order?.products) ? order.products : [];
  const fromProducts = products
    .filter((p) => normalizeGradeKey(p.grade) === label)
    .reduce((sum, p) => sum + qty(p.quantity), 0);
  if (fromProducts > 0) return fromProducts;
  const flat = flattenOrder(order);
  if (normalizeGradeKey(flat.grade) === label) return qty(flat.orderedQuantity);
  return 0;
}

async function applyQualityToFarmerInventory({ inspection, order, farmer, split }) {
  if (inspection.inventorySyncedAt) return;
  const farmerId = farmer?.farmerId || farmer?.id || inspection.farmerId;
  const flat = flattenOrder(order);
  const productId = inspection.productId || flat.productId;
  const orderRef = order?.id || inspection.orderId;
  if (!farmerId || !orderRef) return;
  const already = await FarmerStockHistory.findOne({
    farmerId,
    reference: orderRef,
    reason: /Quality grading/i,
  }).lean();
  if (already) return;

  let product = null;
  if (productId) {
    product = await FarmerProduct.findOne({
      farmerId,
      $or: [{ id: productId }, { productId }, { previousProductId: productId }],
    });
  }
  if (!product && flat.productName) {
    product = await FarmerProduct.findOne({
      farmerId,
      name: new RegExp(`^${String(flat.productName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });
  }
  if (!product) return;

  const gq = gradeQualityOf(inspection);
  const receivedByGrade = {
    "Grade A": split.gradeA,
    "Grade B": split.gradeB,
    "Grade C": split.gradeC,
  };
  if (!Array.isArray(product.grades) || !product.grades.length) {
    product.grades = [
      { id: "g-a", label: "Grade A", quantity: product.gradeAQty || 0 },
      { id: "g-b", label: "Grade B", quantity: product.gradeBQty || 0 },
    ];
  }

  const history = [];
  for (const label of GRADE_KEYS) {
    const orderedQty = orderedGradeQty(order, label);
    const receivedQty = qty(receivedByGrade[label]);
    const rejectedQty = qty(gq[label]?.rejectedQuantity);
    const acceptedQty = qty(Math.max(0, receivedQty - rejectedQty));
    const addBack = qty(Math.max(0, (orderedQty > 0 ? orderedQty : 0) - acceptedQty));
    if (!(addBack > 0)) continue;
    let idx = product.grades.findIndex((g) => normalizeGradeKey(g.label || g.grade || g.name) === label);
    if (idx < 0) {
      product.grades.push({ id: `g-${label.slice(-1).toLowerCase()}`, label, quantity: 0 });
      idx = product.grades.length - 1;
    }
    const prev = qty(product.grades[idx].quantity);
    const next = qty(prev + addBack);
    product.grades[idx].quantity = next;
    history.push({ label, prev, addBack, next });
  }
  if (!history.length) {
    inspection.inventorySyncedAt = new Date();
    return;
  }

  const totalStock = product.grades.reduce((sum, g) => sum + qty(g.quantity), 0);
  product.stock = totalStock;
  product.availableQuantity = totalStock;
  product.gradeAQty = qty(
    product.grades.find((g) => normalizeGradeKey(g.label || g.grade) === "Grade A")?.quantity
  );
  product.gradeBQty = qty(
    product.grades.find((g) => normalizeGradeKey(g.label || g.grade) === "Grade B")?.quantity
  );
  product.markModified("grades");
  if (totalStock > 0 && product.status === "Out of Stock") product.status = "Approved";
  await product.save();

  for (const row of history) {
    await FarmerStockHistory.create({
      id: newId("sh"),
      vendorId: product.vendorId,
      managerId: product.managerId || farmer?.managerId || "",
      farmerId,
      productId: product.id,
      productName: product.name,
      grade: row.label,
      action: "Stock Added",
      previousStock: row.prev,
      changedQuantity: row.addBack,
      newStock: row.next,
      reason: `Quality grading · from farmer · Order ${order?.orderId || orderRef}${
        inspection?.batchId ? ` · Batch ${inspection.batchId}` : ""
      }`,
      updatedBy: "Manager",
      reference: orderRef,
      at: new Date(),
    }).catch(() => {});
  }
  inspection.inventorySyncedAt = new Date();
}

function assertGradeRejection(gq) {
  for (const key of GRADE_KEYS) {
    const rejected = qty(gq[key]?.rejectedQuantity);
    if (!(rejected > 0)) continue;
    const reason = String(gq[key]?.rejectionReason || "").trim();
    if (!reason || !REJECTION_REASONS.includes(reason)) {
      const err = new Error(`${key} rejected quantity requires a rejection reason`);
      err.status = 400;
      throw err;
    }
    if (reason === "Other" && !String(gq[key]?.rejectionRemarks || "").trim()) {
      const err = new Error(`${key} other reason is required when rejection reason is Other`);
      err.status = 400;
      throw err;
    }
  }
}

function assertSplitValid(split, inspection) {
  if (split.allocated > split.totalReceived + 0.001) {
    const err = new Error("Grade quantities cannot exceed the received quantity");
    err.status = 400;
    throw err;
  }
  if (Math.abs(split.remaining) > 0.001) {
    const err = new Error("Remaining quantity must be 0 before grading can be confirmed");
    err.status = 400;
    throw err;
  }
  const gq = gradeQualityOf(inspection);
  if (gradeRejectedTotal(gq) > 0) {
    assertGradeRejection(gq);
    return;
  }
  if (split.rejected > 0) {
    const reason = String(inspection.rejectionReason || "").trim();
    if (!reason || !REJECTION_REASONS.includes(reason)) {
      const err = new Error("Rejected quantity requires a rejection reason");
      err.status = 400;
      throw err;
    }
    if (reason === "Other" && !String(inspection.rejectionRemarks || "").trim()) {
      const err = new Error("Other reason is required when rejection reason is Other");
      err.status = 400;
      throw err;
    }
  }
}

function formatReceivedAt(pickup) {
  const at = pickup?.receiving?.receivedAt;
  if (!at) return { date: "", time: "" };
  const d = new Date(at);
  return {
    date: d.toLocaleDateString("en-IN"),
    time: d.toLocaleTimeString("en-IN"),
    iso: d.toISOString(),
  };
}

function buildTimeline(order, pickup, inspection) {
  const events = [
    ...(order?.timeline || []),
    ...(pickup?.timeline || []),
  ].map((e) => ({
    status: e.status,
    at: e.at,
    note: e.note || "",
  }));
  const rec = pickup?.receiving || {};
  if (rec.receivedAt) {
    events.push({ status: "COLLECTION_CENTRE_RECEIVED", at: rec.receivedAt, note: "Received at collection centre" });
    events.push({ status: "WEIGHT_VERIFICATION", at: rec.receivedAt, note: "Weight verification completed" });
  }
  if (inspection?.inspectionStartedAt) {
    events.push({ status: "QUALITY_CHECK", at: inspection.inspectionStartedAt, note: "Quality check started" });
  }
  if (inspection?.gradingConfirmedAt) {
    events.push({ status: "GRADING_COMPLETED", at: inspection.gradingConfirmedAt, note: "Grading confirmed" });
  }
  if (inspection?.status === ORDER_COMPLETED) {
    events.push({ status: "ORDER_COMPLETED", at: inspection.updatedAt || inspection.gradingConfirmedAt, note: "Order completed" });
  }

  const aliases = {
    ACCEPTED: "ACCEPTED",
    PREPARING: "PREPARING",
    PACKING: "PACKING",
    READY_FOR_PICKUP: "READY_FOR_PICKUP",
    DRIVER_ASSIGNED: "READY_FOR_PICKUP",
    DISPATCHED: "READY_FOR_PICKUP",
    DRIVER_ARRIVED: "READY_FOR_PICKUP",
    ORDER_VERIFIED: "READY_FOR_PICKUP",
    QR_VERIFIED: "QR_VERIFIED",
    PICKED_UP: "QR_VERIFIED",
    COLLECTION_CENTRE_RECEIVED: "COLLECTION_CENTRE_RECEIVED",
    RECEIVED_AT_COLLECTION_CENTRE: "COLLECTION_CENTRE_RECEIVED",
    WEIGHT_CHECK: "WEIGHT_VERIFICATION",
    WEIGHT_VERIFICATION: "WEIGHT_VERIFICATION",
    QUALITY_PENDING: "QUALITY_CHECK",
    INSPECTION: "QUALITY_CHECK",
    GRADING: "QUALITY_CHECK",
    GRADE_CONFIRMED: "GRADING_COMPLETED",
    ORDER_COMPLETED: "ORDER_COMPLETED",
  };

  const latest = {};
  for (const e of events) {
    const key = aliases[e.status] || e.status;
    const prev = latest[key];
    if (!prev || new Date(e.at || 0) > new Date(prev.at || 0)) latest[key] = { ...e, status: key };
  }

  let reached = true;
  return FINAL_TIMELINE.map((step) => {
    const hit = latest[step.key];
    if (!hit) reached = false;
    return {
      key: step.key,
      label: step.label,
      done: Boolean(hit),
      at: hit?.at || null,
      note: hit?.note || "",
    };
  }).map((step, i, arr) => {
    if (i > 0 && !arr[i - 1].done) return { ...step, done: false };
    return step;
  });
}

async function presentInspection(inspection, pickup, order, farmer, centre) {
  const rec = pickup?.receiving || {};
  const flat = flattenOrder(order || {});
  const received = formatReceivedAt(pickup);
  const totalReceived = receivedQuantity(pickup, order);
  const split = splitTotals(inspection, totalReceived);
  const unit = rec.weightUnit || pickup?.unit || flat.unit || "Kg";
  const price = flat.price;
  const payableQty = qty(Math.max(0, split.gradeA + split.gradeB + split.gradeC - split.rejected));
  const finalAmount = qty(price ? payableQty * price : (order?.orderValue || 0));
  const locked = LOCKED_STATUSES.includes(inspection.status);
  const gq = gradeQualityOf(inspection);
  for (const key of GRADE_KEYS) {
    gq[key].photos = sanitizePhotos(gq[key].photos || []);
  }
  const flatParams = flattenGradeParams(gq);
  return {
    inspectionId: inspection.inspectionId,
    orderId: order?.id || inspection.orderId,
    orderDisplayId: order?.orderId || order?.id || inspection.orderId,
    qrPayload: order?.orderId || order?.id ? `greengrocc:order:${order.orderId || order.id}` : pickup?.qrPayload || "",
    qrToken: pickup?.qrToken || "",
    farmerId: inspection.farmerId,
    farmerName: farmer?.name || "",
    farmerMobile: farmer?.mobile || "",
    productId: inspection.productId || flat.productId,
    product: flat.productName,
    productName: flat.productName,
    variety: flat.variety || pickup?.variety || "",
    orderDate:
      toISODate(order?.orderDate) ||
      toISODate(order?.createdAt) ||
      toISODate(pickup?.orderDate) ||
      orderDateFromBusinessId(order?.orderId || order?.id || pickup?.orderId) ||
      "",
    pickupDate: pickup?.pickupDate || pickup?.scheduledDate || order?.pickupDate || "",
    pickupTime: pickup?.pickupTime || pickup?.scheduledTime || order?.pickupTime || "",
    grades:
      Array.isArray(order?.orderedGrades) && order.orderedGrades.length
        ? order.orderedGrades
        : orderGrades(order),
    orderedGrades:
      Array.isArray(order?.orderedGrades) && order.orderedGrades.length
        ? order.orderedGrades
        : orderGrades(order),
    finalStatement: overlayQualityOnOrder(toPlain(order), inspection).finalStatement || [],
    orderedQuantity: qty(flat.orderedQuantity),
    receivedQuantity: totalReceived,
    actualWeight: qty(rec.actualWeight),
    acceptedWeight: qty(rec.acceptedWeight || totalReceived),
    acceptedQuantity: qty(rec.acceptedWeight || totalReceived),
    finalWeight: qty(rec.acceptedWeight || rec.actualWeight || totalReceived),
    weightGrades: weightGradesOf(pickup, order),
    batchId: pickup?.collectionBatchId || inspection.batchId || pickup?.id || "",
    pickupId: pickup?.id || inspection.pickupId || "",
    pickupStatus: pickup?.status || "",
    collectionCentreId: inspection.collectionCentreId || pickup?.collectionCentreId || "",
    collectionCentre: centre?.name || order?.collectionCentre || "Main Collection Centre",
    receivedDate: received.date,
    receivedTime: received.time,
    receivedAt: received.iso || rec.receivedAt || null,
    unit,
    inspectorId: inspection.inspectorId,
    inspectorRole: inspection.inspectorRole,
    inspectorName: inspection.inspectorName,
    gradeQuality: gq,
    packagingDate:
      inspection.packagingDate ||
      gq["Grade A"]?.packagingDate ||
      gq["Grade B"]?.packagingDate ||
      gq["Grade C"]?.packagingDate ||
      order?.packingDetails?.packingDate ||
      order?.packagingDate ||
      received.date ||
      "",
    expiryDate:
      inspection.expiryDate ||
      gq["Grade A"]?.expiryDate ||
      gq["Grade B"]?.expiryDate ||
      gq["Grade C"]?.expiryDate ||
      order?.expiryDate ||
      "",
    qualityParameters: {
      freshness: flatParams.freshness || "",
      size: flatParams.size || "",
      colour: flatParams.colour || "",
      appearance: flatParams.appearance || "",
      cleanliness: flatParams.cleanliness || "",
      damage: flatParams.damage || "",
      moisture: flatParams.moisture || "",
      weight: flatParams.weight || "",
      overallQuality: flatParams.overallQuality || "",
    },
    qualityRemarks: inspection.qualityRemarks || "",
    qualityPhotos: (inspection.qualityPhotos || []).map((p) => ({
      url: p.url,
      label: p.label || "",
      uploadedAt: p.uploadedAt,
    })),
    labReports: (inspection.labReports || []).map((r) => ({
      id: r.id || String(r._id),
      reportName: r.reportName || "",
      fileUrl: r.fileUrl || "",
      fileName: r.fileName || "",
      fileType: r.fileType || "",
      fileSize: r.fileSize || 0,
      notes: r.notes || "",
      uploadedAt: r.uploadedAt,
      uploadedBy: r.uploadedBy || "",
    })),
    gradeAQuantity: locked ? qty(Math.max(0, split.gradeA - qty(gq["Grade A"]?.rejectedQuantity))) : split.gradeA,
    gradeBQuantity: locked ? qty(Math.max(0, split.gradeB - qty(gq["Grade B"]?.rejectedQuantity))) : split.gradeB,
    gradeCQuantity: locked ? qty(Math.max(0, split.gradeC - qty(gq["Grade C"]?.rejectedQuantity))) : split.gradeC,
    gradeAAssigned: split.gradeA,
    gradeBAssigned: split.gradeB,
    gradeCAssigned: split.gradeC,
    gradeARejected: qty(gq["Grade A"]?.rejectedQuantity),
    gradeBRejected: qty(gq["Grade B"]?.rejectedQuantity),
    gradeCRejected: qty(gq["Grade C"]?.rejectedQuantity),
    rejectedQuantity: split.rejected,
    allocatedQuantity: split.allocated,
    remainingQuantity: split.remaining,
    rejectionReason: inspection.rejectionReason || "",
    rejectionRemarks: inspection.rejectionRemarks || "",
    status: inspection.status,
    qualityStatus: inspection.status,
    parametersComplete: gradeParametersComplete(inspection, split),
    weightVerified: isWeightVerified(pickup),
    locked,
    inspectionStartedAt: inspection.inspectionStartedAt,
    inspectionCompletedAt: inspection.inspectionCompletedAt,
    gradingConfirmedAt: inspection.gradingConfirmedAt,
    lastActionBy: inspection.lastActionBy,
    lastActionRole: inspection.lastActionRole,
    lastActionAt: inspection.lastActionAt,
    price,
    finalAmount,
    paymentStatus: order?.paymentStatus || "Pending",
    paymentDetails: order?.paymentDetails || null,
    paramOptions: QUALITY_PARAM_OPTIONS,
    rejectionReasons: REJECTION_REASONS,
    timeline: buildTimeline(order, pickup, inspection),
  };
}

async function loadBundleByOrderId(orderId) {
  const inspection = await QualityInspection.findOne({
    $or: [{ orderId }, { inspectionId: orderId }, { pickupId: orderId }, { batchId: orderId }],
  });
  const pickup = await findPickupForOrder(inspection?.orderId || inspection?.pickupId || orderId);
  if (!pickup) return null;
  const order = await findOrder(pickup.orderId || inspection?.orderId || orderId);
  return { inspection, pickup, order };
}

async function requireEligibleBundle(req, orderId) {
  const bundle = await loadBundleByOrderId(orderId);
  if (!bundle?.pickup) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }
  const farmer = await Farmer.findOne({ id: bundle.pickup.farmerId });
  await assertQualityAccess(req, bundle.pickup, farmer);
  if (!isWeightVerified(bundle.pickup)) {
    const err = new Error("Quality check can start only after collection centre receiving and weight verification");
    err.status = 400;
    throw err;
  }
  const order = bundle.order || (await findOrder(bundle.pickup.orderId));
  const inspection = bundle.inspection || (await ensureInspection(bundle.pickup, order));
  if (inspection && (!inspection.inspectionId || !inspection.inspectionId.startsWith("GGC-QC-"))) {
    try {
      const newQcId = await nextQualityInspectionId(inspection.createdAt);
      await QualityInspection.updateOne({ _id: inspection._id }, { $set: { inspectionId: newQcId } });
      inspection.inspectionId = newQcId;
    } catch (e) {
      console.error("Failed to upgrade inspectionId in requireEligibleBundle:", e);
    }
  }
  const centre = bundle.pickup.collectionCentreId
    ? await CollectionCentre.findOne({ id: bundle.pickup.collectionCentreId }).lean()
    : null;
  return { inspection, pickup: bundle.pickup, order, farmer, centre };
}

const BUCKETS = {
  pending: [QUALITY_PENDING],
  in_progress: [INSPECTION, GRADING],
  all: [QUALITY_PENDING, INSPECTION, GRADING],
  inspection: [INSPECTION],
  grading: [GRADING],
  completed: [GRADE_CONFIRMED, ORDER_COMPLETED],
};

export async function listQualityPending(req, res) {
  try {
    const bucket = String(req.query.bucket || req.query.stage || req.query.filter || "pending").toLowerCase();
    const statuses = BUCKETS[bucket] || BUCKETS.pending;
    const farmerIds = await scopedFarmerIds(req);
    const pickups = await Pickup.find({
      farmerId: { $in: farmerIds },
      status: { $in: RECEIVED_STATUSES },
      "receiving.status": "RECEIVED",
    })
      .select(PICKUP_LIST_EXCLUDE)
      .lean();

    const orderCache = new Map();
    if (statuses.includes(QUALITY_PENDING)) {
      await loadOrdersByKeys(pickups.map((p) => p.orderId), orderCache);
      for (const pickup of pickups) {
        const order = await orderFromCache(orderCache, pickup.orderId);
        await ensureInspection(pickup, order);
      }
    }

    const pickupIds = pickups.map((p) => p.id);
    const inspections = await QualityInspection.find({
      $or: [{ pickupId: { $in: pickupIds } }, { farmerId: { $in: farmerIds } }],
      status: { $in: statuses },
    })
      .select(INSPECTION_LIST_EXCLUDE)
      .sort({ updatedAt: -1 });

    const localPickupOf = (inspection) =>
      pickups.find((p) => p.id === inspection.pickupId || p.orderId === inspection.orderId);
    const unresolvedKeys = [
      ...new Set(inspections.filter((i) => !localPickupOf(i)).map((i) => i.orderId).filter(Boolean).map(String)),
    ];
    const extraPickups = unresolvedKeys.length
      ? firstByKeys(
          await Pickup.find({
            $or: [{ orderId: { $in: unresolvedKeys } }, { id: { $in: unresolvedKeys } }, { pickupId: { $in: unresolvedKeys } }],
          })
            .select(PICKUP_LIST_EXCLUDE)
            .lean(),
          ["orderId", "id", "pickupId"]
        )
      : new Map();

    const resolved = [];
    for (const inspection of inspections) {
      const pickup = localPickupOf(inspection)
        || (inspection.orderId && extraPickups.get(String(inspection.orderId)))
        || (await findPickupForOrder(inspection.orderId));
      if (pickup) resolved.push({ inspection, pickup });
    }

    const farmerKeys = [
      ...new Set(resolved.flatMap(({ inspection, pickup }) => [inspection.farmerId, pickup.farmerId]).filter(Boolean).map(String)),
    ];
    const centreKeys = [...new Set(resolved.map(({ pickup }) => pickup.collectionCentreId).filter(Boolean).map(String))];
    const [farmerDocs, , centreDocs] = await Promise.all([
      farmerKeys.length ? Farmer.find({ id: { $in: farmerKeys } }).select(FARMER_LIST_EXCLUDE).lean() : [],
      loadOrdersByKeys(resolved.map(({ inspection }) => inspection.orderId), orderCache),
      centreKeys.length ? CollectionCentre.find({ id: { $in: centreKeys } }).lean() : [],
    ]);
    const farmerById = firstByKeys(farmerDocs, ["id"]);
    const centreById = firstByKeys(centreDocs, ["id"]);

    const rows = [];
    for (const { inspection, pickup } of resolved) {
      try {
        await assertQualityAccess(req, pickup, farmerById.get(String(pickup.farmerId)) || null);
      } catch {
        continue;
      }
      if (!isWeightVerified(pickup)) continue;
      if (!inspection.inspectionId || !inspection.inspectionId.startsWith("GGC-QC-")) {
        try {
          const newQcId = await nextQualityInspectionId(inspection.createdAt);
          await QualityInspection.updateOne({ _id: inspection._id }, { $set: { inspectionId: newQcId } });
          inspection.inspectionId = newQcId;
        } catch (e) {
          console.error("Failed to upgrade inspectionId in listQualityPending:", e);
        }
      }
      const order = await orderFromCache(orderCache, inspection.orderId);
      const farmer = farmerById.get(String(inspection.farmerId)) || null;
      const centre = pickup.collectionCentreId ? centreById.get(String(pickup.collectionCentreId)) || null : null;
      rows.push(await presentInspection(inspection, pickup, order, farmer, centre));
    }
    res.json({ items: rows, bucket, count: rows.length });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to list quality inspections" });
  }
}

export async function getQualityInspection(req, res) {
  try {
    const { inspection, pickup, order, farmer, centre } = await requireEligibleBundle(req, req.params.orderId);
    res.json(await presentInspection(inspection, pickup, order, farmer, centre));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to load quality inspection" });
  }
}

export async function verifyQualityQr(req, res) {
  try {
    const raw = String(req.body?.qrPayload || req.body?.qr || req.body?.code || "").trim();
    if (!raw) return res.status(400).json({ message: "QR / order code is required" });
    const parsed = parseQualityQr(raw);
    let pickup = null;
    if (parsed.token) {
      pickup = await Pickup.findOne({ $or: [{ qrToken: parsed.token }, { qrPayload: raw }] });
    }
    if (!pickup && parsed.orderId) {
      pickup = await findPickupForOrder(parsed.orderId);
    }
    if (!pickup) {
      pickup = await Pickup.findOne({
        $or: [{ qrPayload: raw }, { orderId: raw }, { id: raw }],
      });
    }
    if (!pickup) return res.status(404).json({ message: "Order not found for this QR" });
    const order = await findOrder(pickup.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const farmer = await Farmer.findOne({ id: pickup.farmerId });
    await assertQualityAccess(req, pickup, farmer);
    if (order.farmerId && order.farmerId !== pickup.farmerId) {
      return res.status(400).json({ message: "QR does not match the farmer for this order" });
    }
    const flat = flattenOrder(order);
    if (pickup.productName && flat.productName && pickup.productName !== flat.productName) {
      return res.status(400).json({ message: "QR does not match the product for this order" });
    }
    if (!RECEIVED_STATUSES.includes(pickup.status) && pickup.receiving?.status !== "RECEIVED") {
      return res.status(400).json({ message: "Order has not been received by the collection centre" });
    }
    if (!isWeightVerified(pickup)) {
      return res.status(400).json({ message: "Weight verification is not completed" });
    }
    if (!qrMatches(pickup, order, raw)) {
      return res.status(400).json({ message: "QR / order code does not match this order" });
    }
    const inspection = await ensureInspection(pickup, order);
    if (LOCKED_STATUSES.includes(inspection.status)) {
      return res.status(409).json({
        message: "Quality inspection is already completed for this order",
        orderId: order.id,
        status: inspection.status,
      });
    }
    if (inspection.batchId && pickup.id && inspection.batchId !== pickup.id) {
      return res.status(400).json({ message: "QR does not match the batch for this order" });
    }
    const centre = pickup.collectionCentreId
      ? await CollectionCentre.findOne({ id: pickup.collectionCentreId }).lean()
      : null;
    res.json({
      verified: true,
      orderId: order.id,
      inspectionId: inspection.inspectionId,
      inspection: await presentInspection(inspection, pickup, order, farmer, centre),
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "QR verification failed" });
  }
}

export async function startQualityCheck(req, res) {
  try {
    const { inspection, pickup, order, farmer, centre } = await requireEligibleBundle(req, req.params.orderId);
    if (LOCKED_STATUSES.includes(inspection.status)) {
      return res.status(409).json({ message: "Quality inspection is already completed" });
    }
    if (inspection.status !== QUALITY_PENDING && inspection.status !== INSPECTION) {
      return res.status(400).json({ message: `Cannot start quality check from ${inspection.status}` });
    }
    const actor = actorOf(req);
    const now = new Date();
    inspection.status = INSPECTION;
    inspection.inspectionStartedAt = inspection.inspectionStartedAt || now;
    inspection.inspectorId = actor.id;
    inspection.inspectorRole = actor.role;
    inspection.inspectorName = actor.name;
    recordAction(inspection, req, "START_QUALITY_CHECK");
    await inspection.save();
    await applyOrderStatus(order, INSPECTION, "Quality inspection started.");
    emitQualityUpdate({
      orderId: order.id,
      farmerId: inspection.farmerId,
      vendorId: pickup.vendorId,
      managerId: farmer?.managerId || pickup.managerId,
      status: inspection.status,
    });
    res.json(await presentInspection(inspection, pickup, order, farmer, centre));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to start quality check" });
  }
}

export async function saveQualityPhotos(req, res) {
  try {
    const { inspection, pickup, order, farmer, centre } = await requireEligibleBundle(req, req.params.orderId);
    if (LOCKED_STATUSES.includes(inspection.status)) {
      return res.status(409).json({ message: "Quality inspection is locked after grading confirmation" });
    }
    if (inspection.status === QUALITY_PENDING) {
      return res.status(400).json({ message: "Start quality check before uploading photos" });
    }
    const incoming = sanitizePhotos(req.body?.photos || req.body?.qualityPhotos || []);
    const gradeKey = normalizeGradeKey(req.body?.grade);
    if (gradeKey) {
      const gq = gradeQualityOf(inspection);
      if (req.body?.replace === true) {
        gq[gradeKey].photos = incoming;
      } else {
        gq[gradeKey].photos = sanitizePhotos([...(gq[gradeKey].photos || []), ...incoming]);
      }
      if (req.body?.removeIndex != null) {
        const idx = Number(req.body.removeIndex);
        gq[gradeKey].photos = (gq[gradeKey].photos || []).filter((_, i) => i !== idx);
      }
      inspection.gradeQuality = gq;
      inspection.markModified("gradeQuality");
      inspection.qualityPhotos = sanitizePhotos(flattenGradePhotos(gq));
    } else if (req.body?.replace === true) {
      inspection.qualityPhotos = incoming;
    } else {
      inspection.qualityPhotos = sanitizePhotos([...(inspection.qualityPhotos || []), ...incoming]);
    }
    if (!gradeKey && req.body?.removeIndex != null) {
      const idx = Number(req.body.removeIndex);
      inspection.qualityPhotos = (inspection.qualityPhotos || []).filter((_, i) => i !== idx);
    }
    recordAction(inspection, req, "UPLOAD_QUALITY_PHOTOS");
    await inspection.save();
    res.json(await presentInspection(inspection, pickup, order, farmer, centre));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to save quality photos" });
  }
}

export async function saveQualityParameters(req, res) {
  try {
    const { inspection, pickup, order, farmer, centre } = await requireEligibleBundle(req, req.params.orderId);
    if (LOCKED_STATUSES.includes(inspection.status)) {
      return res.status(409).json({ message: "Quality parameters cannot be edited after grading confirmation" });
    }
    if (inspection.status === QUALITY_PENDING) {
      return res.status(400).json({ message: "Start quality check before entering parameters" });
    }
    const gq = gradeQualityOf(inspection);
    if (req.body.gradeQuality && typeof req.body.gradeQuality === "object") {
      for (const key of GRADE_KEYS) {
        const row = req.body.gradeQuality[key];
        if (!row || typeof row !== "object") continue;
        if (row.parameters || row.qualityParameters) {
          gq[key].parameters = { ...gq[key].parameters, ...sanitizeParameters({ qualityParameters: row.parameters || row.qualityParameters }) };
        }
        if (row.remarks != null) gq[key].remarks = String(row.remarks);
        if (row.rejectedQuantity != null) gq[key].rejectedQuantity = qty(row.rejectedQuantity);
        if (row.rejectionReason != null) gq[key].rejectionReason = String(row.rejectionReason).trim();
        if (row.rejectionRemarks != null) gq[key].rejectionRemarks = String(row.rejectionRemarks).trim();
        if (row.expiryDate != null) {
          gq[key].expiryDate = String(row.expiryDate).trim();
          if (!inspection.expiryDate) inspection.expiryDate = gq[key].expiryDate;
        }
        if (row.packagingDate != null) {
          gq[key].packagingDate = String(row.packagingDate).trim();
          if (!inspection.packagingDate) inspection.packagingDate = gq[key].packagingDate;
        }
        if (Array.isArray(row.photos)) gq[key].photos = sanitizePhotos(row.photos);
      }
      inspection.gradeQuality = gq;
      inspection.markModified("gradeQuality");
      inspection.qualityParameters = flattenGradeParams(gq);
      inspection.qualityPhotos = sanitizePhotos(flattenGradePhotos(gq));
    } else {
      const gradeKey = normalizeGradeKey(req.body.grade);
      const next = sanitizeParameters(req.body);
      if (gradeKey) {
        gq[gradeKey].parameters = { ...gq[gradeKey].parameters, ...next };
        if (req.body.gradeRemarks != null) gq[gradeKey].remarks = String(req.body.gradeRemarks);
        if (req.body.expiryDate != null) {
          gq[gradeKey].expiryDate = String(req.body.expiryDate).trim();
          if (!inspection.expiryDate) inspection.expiryDate = gq[gradeKey].expiryDate;
        }
        if (req.body.packagingDate != null) {
          gq[gradeKey].packagingDate = String(req.body.packagingDate).trim();
          if (!inspection.packagingDate) inspection.packagingDate = gq[gradeKey].packagingDate;
        }
        inspection.gradeQuality = gq;
        inspection.markModified("gradeQuality");
        inspection.qualityParameters = flattenGradeParams(gq);
      } else {
        inspection.qualityParameters = { ...(inspection.qualityParameters || {}), ...next };
      }
    }
    if (req.body.expiryDate) inspection.expiryDate = String(req.body.expiryDate).trim();
    if (req.body.packagingDate) inspection.packagingDate = String(req.body.packagingDate).trim();
    if (req.body.qualityRemarks != null) inspection.qualityRemarks = String(req.body.qualityRemarks);
    recordAction(inspection, req, "SAVE_QUALITY_PARAMETERS");
    await inspection.save();
    res.json(await presentInspection(inspection, pickup, order, farmer, centre));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to save quality parameters" });
  }
}

export async function saveQualityGrading(req, res) {
  try {
    const { inspection, pickup, order, farmer, centre } = await requireEligibleBundle(req, req.params.orderId);
    if (LOCKED_STATUSES.includes(inspection.status)) {
      return res.status(409).json({ message: "Grading cannot be edited after confirmation" });
    }
    if (inspection.status === QUALITY_PENDING) {
      return res.status(400).json({ message: "Start quality check before grading" });
    }
    if (req.body.gradeQuality) {
      const gq = applyGradeRejectionRows(inspection, req.body.gradeQuality);
      for (const key of GRADE_KEYS) {
        const row = req.body.gradeQuality[key];
        if (row && typeof row === "object") {
          if (row.expiryDate != null) gq[key].expiryDate = String(row.expiryDate).trim();
          if (row.packagingDate != null) gq[key].packagingDate = String(row.packagingDate).trim();
        }
      }
      inspection.gradeQuality = gq;
      inspection.markModified("gradeQuality");
      inspection.rejectedQuantity = gradeRejectedTotal(gq);
      const first = firstGradeRejection(gq);
      inspection.rejectionReason = first.reason;
      inspection.rejectionRemarks = first.remarks;
    } else {
      inspection.rejectedQuantity = qty(req.body.rejectedQuantity);
      inspection.rejectionReason = String(req.body.rejectionReason || "").trim();
      inspection.rejectionRemarks = String(req.body.rejectionRemarks || req.body.otherReason || "").trim();
    }
    if (req.body.expiryDate) inspection.expiryDate = String(req.body.expiryDate).trim();
    if (req.body.packagingDate) inspection.packagingDate = String(req.body.packagingDate).trim();
    if (req.body.qualityRemarks != null) inspection.qualityRemarks = String(req.body.qualityRemarks);
    const split = applyAssignedGradeQuantities(inspection, pickup, order, req.body);
    if (!gradeParametersComplete(inspection, split)) {
      return res.status(400).json({ message: "Complete quality parameters for every allocated grade before grading" });
    }
    if (split.allocated > split.totalReceived + 0.001) {
      return res.status(400).json({ message: "Grade quantities cannot exceed the received quantity" });
    }
    if (gradeRejectedTotal(gradeQualityOf(inspection)) > 0) {
      assertGradeRejection(gradeQualityOf(inspection));
    } else if (split.rejected > 0 && !inspection.rejectionReason) {
      return res.status(400).json({ message: "Rejected quantity requires a rejection reason" });
    }
    if (inspection.rejectionReason && !REJECTION_REASONS.includes(inspection.rejectionReason) && gradeRejectedTotal(gradeQualityOf(inspection)) <= 0) {
      return res.status(400).json({ message: "Invalid rejection reason" });
    }
    inspection.status = GRADING;
    recordAction(inspection, req, "ASSIGN_GRADE");
    await inspection.save();
    await applyOrderStatus(order, GRADING, "Grade quantities assigned.");
    emitQualityUpdate({
      orderId: order.id,
      farmerId: inspection.farmerId,
      vendorId: pickup.vendorId,
      managerId: farmer?.managerId || pickup.managerId,
      status: inspection.status,
    });
    res.json(await presentInspection(inspection, pickup, order, farmer, centre));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to save grading" });
  }
}

export async function confirmQualityGrading(req, res) {
  try {
    const { inspection, pickup, order, farmer, centre } = await requireEligibleBundle(req, req.params.orderId);
    if (LOCKED_STATUSES.includes(inspection.status)) {
      return res.status(409).json({ message: "Grading is already confirmed for this order" });
    }
    const split = applyAssignedGradeQuantities(inspection, pickup, order, inspection);
    if (!gradeParametersComplete(inspection, split)) {
      return res.status(400).json({ message: "Complete quality parameters for every allocated grade before confirming grading" });
    }
    assertSplitValid(split, inspection);
    const actor = actorOf(req);
    const now = new Date();
    const updated = await QualityInspection.findOneAndUpdate(
      {
        inspectionId: inspection.inspectionId,
        status: { $in: [INSPECTION, GRADING] },
        gradingConfirmedAt: null,
      },
      {
        $set: {
          status: GRADE_CONFIRMED,
          gradeAQuantity: split.gradeA,
          gradeBQuantity: split.gradeB,
          gradeCQuantity: split.gradeC,
          rejectedQuantity: split.rejected,
          inspectorId: inspection.inspectorId || actor.id,
          inspectorRole: inspection.inspectorRole || actor.role,
          inspectorName: inspection.inspectorName || actor.name,
          inspectionCompletedAt: now,
          gradingConfirmedAt: now,
          lastActionBy: actor.id,
          lastActionRole: actor.role,
          lastActionAt: now,
          packagingDate: inspection.packagingDate || gradeQualityOf(inspection)["Grade A"]?.packagingDate || order?.packingDetails?.packingDate || "",
          expiryDate: inspection.expiryDate || gradeQualityOf(inspection)["Grade A"]?.expiryDate || "",
        },
        $push: {
          actions: { action: "CONFIRM_GRADING", userId: actor.id, role: actor.role, at: now },
        },
      },
      { returnDocument: "after" }
    );
    if (!updated) {
      return res.status(409).json({ message: "Duplicate grading confirmation is not allowed" });
    }
    updated.gradeAQuantity = split.gradeA;
    updated.gradeBQuantity = split.gradeB;
    updated.gradeCQuantity = split.gradeC;
    updated.rejectedQuantity = split.rejected;
    const originalGrades = orderGrades(order);
    if (!Array.isArray(order.orderedGrades) || !order.orderedGrades.length) {
      order.orderedGrades = originalGrades;
      order.markModified("orderedGrades");
    }
    const finalGrades = buildFinalStatementGrades(order, updated, split);
    const finalA = finalGrades.find((g) => g.label === "Grade A")?.quantity || 0;
    const finalB = finalGrades.find((g) => g.label === "Grade B")?.quantity || 0;
    const finalC = finalGrades.find((g) => g.label === "Grade C")?.quantity || 0;
    const payableQty = qty(finalA + finalB + finalC);
    const payableAmount = qty(finalGrades.reduce((sum, g) => sum + qty(g.amount), 0));
    order.grades = finalGrades;
    order.markModified("grades");
    order.gradeAQuantity = finalA;
    order.gradeBQuantity = finalB;
    order.gradeCQuantity = finalC;
    order.gradeARejected = finalGrades.find((g) => g.label === "Grade A")?.rejectedQuantity || 0;
    order.gradeBRejected = finalGrades.find((g) => g.label === "Grade B")?.rejectedQuantity || 0;
    order.gradeCRejected = finalGrades.find((g) => g.label === "Grade C")?.rejectedQuantity || 0;
    order.rejectedQuantity = split.rejected;
    order.totalQuantity = payableQty;
    order.totalAmount = payableAmount;
    order.amount = payableAmount;
    order.orderValue = payableAmount;
    order.qualityStatus = GRADE_CONFIRMED;
    order.qualityRemarks = updated.qualityRemarks || order.qualityRemarks || "";
    order.gradeQuality = gradeQualityOf(updated);
    order.markModified("gradeQuality");
    order.packagingDate = updated.packagingDate || inspection.packagingDate || order?.packingDetails?.packingDate || "";
    order.expiryDate = updated.expiryDate || inspection.expiryDate || "";
    order.pickupDate = pickup?.pickupDate || pickup?.scheduledDate || order.pickupDate || "";
    order.pickupTime = pickup?.pickupTime || pickup?.scheduledTime || order.pickupTime || "";
    await applyOrderStatus(order, GRADE_CONFIRMED, "Grading confirmed.");
    updated.status = ORDER_COMPLETED;
    updated.actions = [
      ...(updated.actions || []),
      { action: "ORDER_COMPLETED", userId: actor.id, role: actor.role, at: new Date() },
    ];
    await updated.save();
    await applyOrderStatus(order, ORDER_COMPLETED, "Order completed after quality grading.");
    try {
      await upsertFarmerEarningFromFinalSummary({ order, farmer, grades: finalGrades, pickup });
    } catch (earnErr) {
      console.warn("[quality] farmer earning update failed:", earnErr.message);
    }
    try {
      await applyQualityToFarmerInventory({ inspection: updated, order, farmer, split });
      if (updated.inventorySyncedAt) await updated.save();
    } catch (invErr) {
      console.warn("[quality] farmer inventory update failed:", invErr.message);
    }
    await syncQualityToErp({ inspection: updated, pickup, order, farmer, centre });
    emitQualityUpdate({
      orderId: order.id,
      farmerId: updated.farmerId,
      vendorId: pickup.vendorId,
      managerId: farmer?.managerId || pickup.managerId,
      status: ORDER_COMPLETED,
    });
    res.json(await presentInspection(updated, pickup, order, farmer, centre));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to confirm grading" });
  }
}

export async function getQualityFinalSummary(req, res) {
  try {
    const { inspection, pickup, order, farmer, centre } = await requireEligibleBundle(req, req.params.orderId);
    const data = await presentInspection(inspection, pickup, order, farmer, centre);
    res.json({
      orderId: data.orderDisplayId,
      internalOrderId: data.orderId,
      qrPayload: data.qrPayload,
      farmerName: data.farmerName,
      product: data.product,
      orderedQuantity: data.orderedQuantity,
      receivedQuantity: data.receivedQuantity,
      acceptedQuantity: data.acceptedQuantity,
      gradeAQuantity: data.gradeAQuantity,
      gradeBQuantity: data.gradeBQuantity,
      gradeCQuantity: data.gradeCQuantity,
      rejectedQuantity: data.rejectedQuantity,
      finalWeight: data.finalWeight,
      finalQualityStatus: data.status,
      finalAmount: data.finalAmount,
      paymentStatus: data.paymentStatus,
      unit: data.unit,
      batchId: data.batchId,
      collectionCentre: data.collectionCentre,
      timeline: data.timeline,
      inspection: data,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to load final summary" });
  }
}

export async function getOrderQualityReport(req, res) {
  try {
    const orderId = req.params.orderId;
    let inspection = await QualityInspection.findOne({
      $or: [{ orderId }, { inspectionId: orderId }, { pickupId: orderId }, { batchId: orderId }],
    }).lean();
    let pickup = await findPickupForOrder(inspection?.orderId || inspection?.pickupId || orderId);
    let order = await findOrder(pickup?.orderId || inspection?.orderId || orderId);
    if (!order) {
      order = await FarmerOrder.findOne({ $or: [{ id: orderId }, { orderId }] });
    }
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (!pickup) {
      pickup = await findPickupForOrder(order.id || order.orderId);
    }
    const farmer = await Farmer.findOne({ $or: [{ id: order.farmerId }, { farmerId: order.farmerId }] });
    const centre = pickup?.collectionCentreId
      ? await CollectionCentre.findOne({ id: pickup.collectionCentreId }).lean()
      : null;
    const presented = await presentInspection(inspection || {}, pickup, order, farmer, centre);
    const overlay = overlayQualityOnOrder(toPlain(order), inspection || {});
    res.json({
      ...presented,
      order: toPlain(order),
      orderedGrades: overlay.orderedGrades?.length ? overlay.orderedGrades : presented.orderedGrades,
      finalStatement: overlay.finalStatement?.length
        ? overlay.finalStatement
        : overlay.grades?.length
          ? overlay.grades
          : presented.finalStatement || [],
      grades: overlay.grades?.length ? overlay.grades : presented.grades,
      gradeAAssigned: overlay.gradeAAssigned ?? presented.gradeAAssigned ?? presented.gradeAQuantity,
      gradeBAssigned: overlay.gradeBAssigned ?? presented.gradeBAssigned ?? presented.gradeBQuantity,
      gradeCAssigned: overlay.gradeCAssigned ?? presented.gradeCAssigned ?? presented.gradeCQuantity,
      gradeARejected: overlay.gradeARejected ?? 0,
      gradeBRejected: overlay.gradeBRejected ?? 0,
      gradeCRejected: overlay.gradeCRejected ?? 0,
      totalAmount: overlay.totalAmount ?? presented.finalAmount,
      orderValue: overlay.orderValue ?? presented.finalAmount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load quality report" });
  }
}

export async function updateOrderPaymentStatus(req, res) {
  try {
    const { orderId } = req.params;
    const { paymentStatus, paymentMethod, transactionId, paymentDate, notes, amount } = req.body;
    if (!paymentStatus) {
      return res.status(400).json({ message: "paymentStatus is required" });
    }
    const query = { $or: [{ id: orderId }, { orderId: orderId }] };

    let order = await FarmerOrder.findOne(query);
    let harvestOrder = await FarmerHarvestOrder.findOne(query);

    if (!order && !harvestOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    const previousPaymentStatus = String((order || harvestOrder).paymentStatus || "");

    const payDetails = {
      paymentStatus,
      paymentMethod: paymentMethod || "Bank Transfer",
      transactionId: transactionId || "",
      paymentDate: paymentDate || new Date().toISOString(),
      notes: notes || "",
      amount: amount || (order?.totalAmount || order?.orderValue || harvestOrder?.totalAmount || harvestOrder?.amount || 0),
      updatedAt: new Date(),
    };

    if (order) {
      order.paymentStatus = paymentStatus;
      if (paymentMethod) order.paymentMethod = paymentMethod;
      if (transactionId) order.transactionId = transactionId;
      order.paymentDetails = {
        ...(order.paymentDetails || {}),
        ...payDetails,
      };
      order.markModified("paymentDetails");
      await order.save();
    }

    if (harvestOrder) {
      harvestOrder.paymentStatus = paymentStatus;
      if (paymentMethod) harvestOrder.paymentMethod = paymentMethod;
      if (transactionId) harvestOrder.transactionId = transactionId;
      harvestOrder.paymentDetails = {
        ...(harvestOrder.paymentDetails || {}),
        ...payDetails,
      };
      harvestOrder.markModified("paymentDetails");
      await harvestOrder.save();
    }

    const isPaid = ["PAID", "PAYMENT_COMPLETED", "COMPLETED", "PAYMENT RECEIVED"].includes(
      String(paymentStatus || "").toUpperCase().trim()
    );

    await FarmerEarning.updateMany(
      { $or: [{ orderId: orderId }, { id: orderId }] },
      { $set: { status: isPaid ? "Paid" : "Pending" } }
    ).catch(() => {});

    if (previousPaymentStatus.toUpperCase() !== String(paymentStatus).toUpperCase().trim()) {
      pushFarmerOrderChange(order || harvestOrder, { paymentChanged: true });
    }

    return res.json({ success: true, order: order || harvestOrder, paymentStatus });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update payment status" });
  }
}

export async function uploadLabReport(req, res) {
  try {
    const { inspection, pickup, order, farmer, centre } = await requireEligibleBundle(req, req.params.orderId);
    if (LOCKED_STATUSES.includes(inspection.status)) {
      return res.status(409).json({ message: "Quality inspection is locked after grading confirmation" });
    }
    const { reportName, fileUrl, fileName, fileType, fileSize, notes } = req.body || {};
    if (!reportName || !String(reportName).trim()) {
      return res.status(400).json({ message: "Report Name is required" });
    }
    if (!fileUrl || !String(fileUrl).trim()) {
      return res.status(400).json({ message: "Report file is required" });
    }

    const actor = actorOf(req);
    const newReport = {
      id: crypto.randomUUID ? crypto.randomUUID() : new Date().getTime().toString(),
      reportName: String(reportName).trim(),
      fileUrl: String(fileUrl).trim(),
      fileName: String(fileName || "").trim(),
      fileType: String(fileType || "").trim(),
      fileSize: Number(fileSize) || 0,
      notes: String(notes || "").trim(),
      uploadedAt: new Date(),
      uploadedBy: actor.name || actor.role || "Vendor",
    };

    inspection.labReports = [...(inspection.labReports || []), newReport];
    recordAction(inspection, req, "UPLOAD_LAB_REPORT");
    await inspection.save();

    res.json(await presentInspection(inspection, pickup, order, farmer, centre));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to upload lab report" });
  }
}

export async function deleteLabReport(req, res) {
  try {
    const { inspection, pickup, order, farmer, centre } = await requireEligibleBundle(req, req.params.orderId);
    if (LOCKED_STATUSES.includes(inspection.status)) {
      return res.status(409).json({ message: "Quality inspection is locked after grading confirmation" });
    }
    const reportId = req.params.reportId;
    inspection.labReports = (inspection.labReports || []).filter(
      (r) => String(r.id || r._id) !== String(reportId)
    );
    recordAction(inspection, req, "DELETE_LAB_REPORT");
    await inspection.save();

    res.json(await presentInspection(inspection, pickup, order, farmer, centre));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to delete lab report" });
  }
}
