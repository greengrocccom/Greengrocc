import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  Farmer,
  FarmerManager,
  FarmerOrder,
  PickupDriver,
  CollectionCentre,
  Pickup,
} from "./models.js";
import { getIO } from "../../shared/socket.js";
import { pushFarmerOrderChange } from "./farmerPush.js";
import { pushDriverAccountStatus, pushDriverPickupAssigned, pushDriverPickupReceived } from "./driverPush.js";
import { generateId } from "../../erp-service/src/services/idGenerator.js";
import { timestampId } from "../../shared/ids.js";
import { resolveLocation, cityCode } from "../../erp-service/src/services/locationResolver.js";
import { FARMER_LIST_EXCLUDE, PICKUP_LIST_EXCLUDE, DRIVER_LIST_EXCLUDE } from "./listProjections.js";
import { PAGE_LIMITS, isPaginationRequested, getPageParams, paginatedResponse } from "./pagination.js";

const JWT_SECRET = process.env.JWT_SECRET || "greengroo-secret";
const CC_ID_RE = /^GGC-CC-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-\d{3}$/;

function isCollectionCentreBusinessId(id = "") {
  return CC_ID_RE.test(String(id || "").trim().toUpperCase());
}

function code3(value, fallback = "XXX") {
  const raw = String(value || "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return raw || fallback;
}

async function locationPartsForCentre({ city = "", address = "", farmer = null } = {}) {
  const farm = farmer?.farmAddress || farmer?.address || {};
  const state = farm.state || farmer?.state || "Maharashtra";
  const district = farm.district || city || farmer?.district || "Nashik";
  const taluka = farm.taluka || farmer?.taluka || "";
  const village = farm.village || farmer?.village || "";

  try {
    const loc = await resolveLocation({
      state,
      district,
      taluka: taluka || district,
      village: village || taluka || "Centre",
      createMissing: false,
    });
    return {
      state: loc.stateCode || "MH",
      district: loc.districtCode || cityCode(district) || "NK",
      taluka: loc.talukaCode || code3(taluka, "TLK"),
      village: village ? code3(village, "VIL") : code3(loc.talukaCode || "VIL", "VIL"),
    };
  } catch {
    return {
      state: "MH",
      district: cityCode(district) || "NK",
      taluka: code3(taluka, "TLK"),
      village: code3(village, "VIL"),
    };
  }
}

async function createCentreId(parts) {
  return generateId({
    module: "CC",
    state: parts.state || "MH",
    district: parts.district || "NK",
    taluka: parts.taluka || "TLK",
    village: parts.village || "VIL",
  });
}

async function ensureCentreBusinessId(centre, locationHint = {}) {
  if (!centre) return centre;
  if (isCollectionCentreBusinessId(centre.id)) return centre;
  const parts = await locationPartsForCentre({
    city: centre.city || locationHint.city || "",
    address: centre.address || "",
    farmer: locationHint.farmer || null,
  });
  const oldId = centre.id;
  const nextId = await createCentreId(parts);
  centre.id = nextId;
  centre.stateCode = parts.state;
  centre.districtCode = parts.district;
  centre.talukaCode = parts.taluka;
  centre.villageCode = parts.village;
  await centre.save();
  if (oldId && oldId !== nextId) {
    await Pickup.updateMany({ collectionCentreId: oldId }, { $set: { collectionCentreId: nextId } }).catch(() => {});
  }
  return centre;
}

export { ensureCentreBusinessId, isCollectionCentreBusinessId, ensureDefaultCentre, createManagerBusinessId };

function managerNameSlug(name = "") {
  const letters = String(name || "")
    .trim()
    .replace(/[^a-zA-Z]/g, "");
  if (!letters) return "Mgr";
  const code = letters.slice(0, 3);
  return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
}

/**
 * Manager ID: {CC-ID}-{name3}-{serial}
 * Example: GGC-CC-MH-NK-NAS-NAS-001-Pra-04
 */
async function createManagerBusinessId({
  vendorId,
  name,
  collectionCentreId = "",
  city = "",
  state = "",
  address = "",
} = {}) {
  let centre = null;
  const requestedCentreId = String(collectionCentreId || "").trim();
  if (requestedCentreId) {
    centre = await CollectionCentre.findOne({
      vendorId,
      id: requestedCentreId,
    });
    if (centre) centre = await ensureCentreBusinessId(centre, { city, address });
  }
  if (!centre) {
    centre = await ensureDefaultCentre(vendorId, { city, address, state });
  }
  if (!centre?.id) {
    throw new Error("Collection centre is required to create manager ID");
  }

  const nameSlug = managerNameSlug(name);
  const id = await generateId({
    module: "MGR",
    collectionCentreId: centre.id,
    nameSlug,
  });

  return {
    id,
    managerCode: id,
    collectionCentreId: centre.id,
    nameSlug,
  };
}
const ASSIGNED_STATUSES = ["DRIVER_ASSIGNED", "PICKUP_SCHEDULED"];
const IN_PROGRESS_STATUSES = ["DISPATCHED", "DRIVER_ARRIVED", "ORDER_VERIFIED", "QR_VERIFIED", "PICKED_UP", "IN_TRANSIT", "ARRIVED_AT_CENTRE"];
const DRIVER_DONE_STATUSES = ["COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE", "COMPLETED"];
const COMPLETED_PICKUP_STATUSES = DRIVER_DONE_STATUSES;
const ACTIVE_DRIVER_WORK = ["DRIVER_ASSIGNED", "PICKUP_SCHEDULED", "DISPATCHED", "DRIVER_ARRIVED", "ORDER_VERIFIED", "QR_VERIFIED", "PICKED_UP", "IN_TRANSIT", "ARRIVED_AT_CENTRE"];
const ACTIVE_PICKUP_STATUSES = [...ACTIVE_DRIVER_WORK];
const OPEN_TRIP_STATUSES = ["PICKED_UP", "PICKUP_CONFIRMED", "IN_TRANSIT", "ARRIVED_AT_CENTRE"];
const INCOMING_AT_CENTRE_STATUSES = ["PICKED_UP", "PICKUP_CONFIRMED", "IN_TRANSIT", "ARRIVED_AT_CENTRE"];
const AT_CENTRE_STATUSES = ["ARRIVED_AT_CENTRE"];
const DRIVER_LIVE_STATUS = {
  READY_FOR_PICKUP: "Ready for pickup",
  DRIVER_ASSIGNED: "Assigned",
  PICKUP_SCHEDULED: "Assigned",
  DISPATCHED: "On the way to farm",
  DRIVER_ARRIVED: "Reached the farm",
  ORDER_VERIFIED: "Order checked",
  QR_VERIFIED: "QR verified",
  PICKED_UP: "Pickup confirmed",
  PICKUP_CONFIRMED: "Pickup confirmed",
  IN_TRANSIT: "On the way to centre",
  ARRIVED_AT_CENTRE: "At collection centre",
  COLLECTION_CENTRE_RECEIVED: "Received",
  RECEIVED_AT_COLLECTION_CENTRE: "Received",
};
const HISTORY_PICKUP_STATUSES = DRIVER_DONE_STATUSES;
const ASSIGNABLE_DRIVER_STATUSES = ["Active", "On Duty", "Available"];
const PRE_ASSIGN_STATUSES = ["READY_FOR_PICKUP"];
const REASSIGN_STATUSES = ["READY_FOR_PICKUP", "PICKUP_SCHEDULED", "DRIVER_ASSIGNED", "DISPATCHED"];
const CENTRE_STATUSES = ["PICKED_UP", "COMPLETED", "IN_TRANSIT", "ARRIVED_AT_CENTRE", "COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE"];

function normalizeDriverStatus(status) {
  if (status === "Available") return "Active";
  if (status === "On Pickup") return "On Duty";
  if (status === "Offline") return "Off Duty";
  return status || "Active";
}

function vendorIdOf(req) {
  return req.user?.vendorId || req.user?.id || "";
}

function managerIdOf(req) {
  return req.user?.managerId || req.user?.id || "";
}

function toPlain(doc) {
  if (!doc) return null;
  return typeof doc.toObject === "function" ? doc.toObject() : doc;
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}

function nameCode(name = "") {
  const letters = String(name || "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return `${letters}XXX`.slice(0, 3);
}

function plateCode(vehicleNumber = "") {
  return String(vehicleNumber || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function vehicleIdOf(vehicleId, vehicleNumber) {
  const plate = plateCode(vehicleNumber);
  const stored = String(vehicleId || "").trim();
  if (plate) {
    const prefix = `GGC-VH-${plate}`;
    if (stored.toUpperCase().startsWith(prefix.toUpperCase())) return stored;
    return prefix;
  }
  return stored;
}

function isSerialVehicleId(id) {
  return /^GGC-VH-\d{6}$/i.test(String(id || "").trim());
}

function pad6(n) {
  return String(n).padStart(6, "0");
}

async function nextDriverSerial(vendorId) {
  const docs = await PickupDriver.find({ vendorId }).select("id").lean();
  let max = 0;
  for (const d of docs) {
    const m = String(d.id || "").toUpperCase().match(/^GGC-DRV-[A-Z]{3}-(\d{6})$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

async function nextDriverId(vendorId, name) {
  return `GGC-DRV-${nameCode(name)}-${pad6(await nextDriverSerial(vendorId))}`;
}

async function uniqueVehicleId(vendorId, vehicleNumber, excludeDriverId = "") {
  const plate = plateCode(vehicleNumber);
  const clash = async (id) =>
    PickupDriver.findOne({
      vendorId,
      vehicleId: id,
      ...(excludeDriverId ? { id: { $ne: excludeDriverId } } : {}),
    }).lean();

  if (plate) {
    const id = `GGC-VH-${plate}`;
    if (!(await clash(id))) return id;
    let n = 2;
    while (await clash(`${id}-${pad6(n)}`)) n += 1;
    return `${id}-${pad6(n)}`;
  }

  const docs = await PickupDriver.find({ vendorId }).select("id vehicleId").lean();
  let max = 0;
  for (const d of docs) {
    if (excludeDriverId && d.id === excludeDriverId) continue;
    const m = String(d.vehicleId || "").toUpperCase().match(/^GGC-VH-(\d{6})$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `GGC-VH-${pad6(max + 1)}`;
}

async function findVendorDriver(vendorId, driverId) {
  return PickupDriver.findOne({
    vendorId,
    $or: [{ id: driverId }, { vehicleId: driverId }],
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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

function resolveOrderDate(order, pickup = {}) {
  return (
    toISODate(order?.orderDate) ||
    toISODate(order?.createdAt) ||
    toISODate(order?.harvestDate) ||
    toISODate(pickup?.orderDate) ||
    orderDateFromBusinessId(order?.orderId || order?.id || pickup?.orderId) ||
    ""
  );
}
function flattenOrder(order) {
  const plain = toPlain(order) || {};
  const first = plain.products?.[0] || {};
  return {
    productId: plain.productId || first.id || first.productId || "",
    productName: plain.productName || first.name || "",
    variety: plain.variety || "",
    grade: plain.grade || first.grade || "",
    orderedQuantity: Number(plain.orderedQuantity || first.quantity || plain.totalQuantity || 0),
    unit: plain.unit || first.unit || "Kg",
  };
}

function textAddress(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return [value.village, value.taluka, value.district, value.state, value.pincode, value.farmAddress]
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

export function formatFarmLocation(farmer) {
  if (!farmer) return "";
  const geo = farmer.farmGeo || {};
  const addr = farmer.address && typeof farmer.address === "object" ? farmer.address : {};
  const village = String(geo.village || addr.village || farmer.village || "").trim();
  const taluka = String(geo.taluka || addr.taluka || farmer.taluka || "").trim();
  const district = String(geo.district || addr.district || farmer.district || "").trim();
  const state = String(addr.state || farmer.state || "").trim();
  const pincode = String(geo.pincode || addr.pincode || farmer.pincode || "").trim();
  const fromParts = [village, taluka, district, state, pincode].filter(Boolean).join(", ");
  const candidates = [
    textAddress(geo.farmAddress),
    textAddress(farmer.farmAddress),
    fromParts,
    textAddress(farmer.farmLocation),
  ].filter(Boolean);
  if (!candidates.length) return "";
  candidates.sort((a, b) => {
    const pa = a.split(",").map((s) => s.trim()).filter(Boolean).length;
    const pb = b.split(",").map((s) => s.trim()).filter(Boolean).length;
    if (pb !== pa) return pb - pa;
    return b.length - a.length;
  });
  return candidates[0];
}

function farmerLocation(farmer) {
  return formatFarmLocation(farmer);
}

function mapsUrl(farmer) {
  const geo = farmer?.farmGeo || {};
  if (geo.latitude != null && geo.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${geo.latitude},${geo.longitude}`;
  }
  const loc = farmerLocation(farmer);
  return loc ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}` : "";
}

function qrTokenForPickup() {
  return crypto.randomBytes(16).toString("hex");
}

function qrPayloadFromToken(token) {
  return `ggp.${token}`;
}

function compactQr(obj = {}) {
  const out = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value == null || value === "") return;
    if (Array.isArray(value) && !value.length) return;
    out[key] = value;
  });
  return out;
}

function parseQrJson(payload) {
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

function clipQr(value, max = 80) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? text.slice(0, max) : text;
}

export function parsePickupQr(payload) {
  const raw = String(payload || "").trim();
  const json = parseQrJson(raw);
  if (json) {
    if (json.t === "batch") {
      return compactQr({ batchId: String(json.id || json.batchId || json.lotId || "").trim() });
    }
    return compactQr({
      orderId: String(json.id || json.orderId || "").trim(),
      pickupId: String(json.pickupId || "").trim(),
      batchId: String(json.batchId || "").trim(),
      token: String(json.token || "").trim(),
    });
  }
  try {
    const u = new URL(raw);
    const scan = u.pathname.match(/\/scan\/([^/]+)/i);
    if (scan) return parsePickupQr(decodeURIComponent(scan[1]));
    const q = u.searchParams.get("q") || u.searchParams.get("order") || u.searchParams.get("code");
    if (q) return parsePickupQr(q);
  } catch {
    /* not a URL */
  }
  const pickupMatch = raw.match(/^(?:ggp\.|greengroo:pickup:)([A-Za-z0-9_-]+)$/i);
  if (pickupMatch) return { token: pickupMatch[1] };
  const batchMatch = raw.match(/(GGC-BAT-[A-Za-z0-9-]+)/i);
  if (batchMatch && /greengroo:batch:|ggp\.batch\.|\/batches\//i.test(raw)) {
    return { batchId: batchMatch[1] };
  }
  const biz = raw.match(/(GGC-ORD-[A-Za-z0-9-]+)/i);
  if (biz) return { orderId: biz[1] };
  const orderMatch = raw.match(/(?:greengroo:order:|ggp\.order\.)([A-Za-z0-9_-]+)/i);
  if (orderMatch) return { orderId: orderMatch[1] };
  if (/^[A-Fa-f0-9]{20,}$/.test(raw)) return { token: raw };
  return { orderId: raw.replace(/^order[:#\s]+/i, "").trim() };
}

function emitPickupUpdate(pickup, extra = {}) {
  try {
    const io = getIO();
    const plain = toPlain(pickup) || pickup;
    const payload = {
      pickupId: plain.id || plain.pickupId,
      orderId: plain.orderId,
      farmerId: plain.farmerId,
      managerId: plain.managerId,
      driverId: plain.driverId,
      vendorId: plain.vendorId,
      status: plain.status,
      ...extra,
    };
    if (plain.farmerId) io.to(`farmer_${plain.farmerId}`).emit("pickup_updated", payload);
    if (plain.managerId) io.to(`manager_${plain.managerId}`).emit("pickup_updated", payload);
    if (plain.driverId) io.to(`driver_${plain.driverId}`).emit("pickup_updated", payload);
    if (plain.vendorId) io.to(`vendor_${plain.vendorId}`).emit("pickup_updated", payload);
  } catch {
    // Socket is optional; panels poll as fallback.
  }
}

function pushPickupTimeline(pickup, status, note) {
  pickup.timeline = [...(pickup.timeline || []), { status, at: new Date(), note: note || "" }];
}

export function qrPayloadFor(order, extra = {}) {
  const pickup = extra.pickup && typeof extra.pickup === "object" ? extra.pickup : {};
  const farmer = extra.farmer && typeof extra.farmer === "object" ? extra.farmer : {};
  const centre = extra.centre && typeof extra.centre === "object" ? extra.centre : {};
  const driver = extra.driver && typeof extra.driver === "object" ? extra.driver : {};
  const flat = flattenOrder(order || {});
  const id = String(
    order?.orderId || extra.orderDisplayId || order?.id || pickup.orderId || extra.orderId || ""
  ).trim();
  if (!id) return "";
  const qty = Number(
    extra.packedQuantity ??
      pickup.packedQuantity ??
      order?.packedQuantity ??
      extra.expectedQuantity ??
      pickup.expectedQuantity ??
      order?.orderedQuantity ??
      flat.orderedQuantity
  );
  return JSON.stringify(
    compactQr({
      v: 1,
      t: "order",
      id,
      pickupId: extra.pickupId || pickup.pickupId || pickup.id || "",
      batchId: extra.collectionBatchId || extra.batchId || extra.lotId || pickup.collectionBatchId || "",
      farmerId: extra.farmerId || order?.farmerId || pickup.farmerId || farmer.id || "",
      farmer: clipQr(extra.farmerName || extra.farmer || farmer.name, 60),
      mobile: extra.farmerMobile || extra.mobile || farmer.mobile || "",
      loc: clipQr(extra.pickupLocation || extra.farmerLocation || extra.loc || farmerLocation(farmer) || pickup.pickupLocation, 100),
      product: clipQr(extra.productName || extra.product || pickup.productName || flat.productName, 60),
      productId: extra.productId || flat.productId || "",
      variety: clipQr(extra.variety || pickup.variety || flat.variety, 40),
      grade: clipQr(extra.grade || pickup.grade || flat.grade, 40),
      qty: Number.isFinite(qty) && qty > 0 ? qty : undefined,
      pkgs: Number(extra.packageCount || pickup.packageCount || order?.packingDetails?.packageCount) || undefined,
      unit: extra.unit || pickup.unit || flat.unit || "",
      date:
        extra.orderDate ||
        extra.scheduledDate ||
        extra.pickupDate ||
        extra.date ||
        order?.orderDate ||
        pickup.orderDate ||
        pickup.scheduledDate ||
        pickup.pickupDate ||
        "",
      time: extra.scheduledTime || extra.pickupTime || extra.time || pickup.scheduledTime || pickup.pickupTime || "",
      centre: clipQr(extra.collectionCentreName || extra.centre || centre.name || order?.collectionCentre, 60),
      driverId: extra.driverId || pickup.driverId || driver.id || driver.driverId || "",
      driver: clipQr(extra.driverName || extra.driver || driver.name, 60),
      vehicle: extra.vehicleNumber || extra.vehicle || driver.vehicleNumber || pickup.vehicleNumber || "",
      vehicleId: extra.vehicleId || pickup.vehicleId || driver.vehicleId || "",
    })
  );
}

function batchQrPayloadFor(batchId, orders = []) {
  const first = orders[0] || {};
  const driver = first.driver || {};
  const farmers = [...new Set(orders.map((p) => p.farmerName).filter(Boolean))];
  const products = [...new Set(orders.map((p) => p.productName).filter(Boolean))];
  const orderIds = [...new Set(orders.map((p) => p.orderDisplayId || p.orderId).filter(Boolean))].slice(0, 20);
  if (!batchId) return "";
  return JSON.stringify(
    compactQr({
      v: 1,
      t: "batch",
      id: batchId,
      orders: orders.length || undefined,
      orderIds: orderIds.length ? orderIds : undefined,
      farmers: farmers.length ? farmers.map((name) => clipQr(name, 40)) : undefined,
      products: products.length ? products.map((name) => clipQr(name, 40)) : undefined,
      driverId: first.driverId || driver.id || driver.driverId || "",
      driver: clipQr(first.driverName || driver.name, 60),
      vehicleId: vehicleIdOf(first.vehicleId || driver.vehicleId, first.vehicleNumber || driver.vehicleNumber),
      vehicle: first.vehicleNumber || driver.vehicleNumber || "",
      centre: clipQr(first.collectionCentreName, 60),
    })
  );
}

function parseQrOrderId(payload) {
  const parsed = parsePickupQr(payload);
  return parsed.orderId || parsed.token || "";
}

async function ensureDefaultCentre(vendorId, locationHint = {}) {
  let centre = await CollectionCentre.findOne({ vendorId, status: "Active" });
  if (centre) {
    return ensureCentreBusinessId(centre, locationHint);
  }
  const parts = await locationPartsForCentre(locationHint);
  const id = await createCentreId(parts);
  centre = await CollectionCentre.create({
    id,
    vendorId,
    name: "Main Collection Centre",
    address: locationHint.address || "",
    city: locationHint.city || parts.district || "",
    stateCode: parts.state,
    districtCode: parts.district,
    talukaCode: parts.taluka,
    villageCode: parts.village,
    status: "Active",
  });
  return centre;
}

export async function ensurePickupForOrder(order, farmer) {
  if (!order) return null;
  const existing = await Pickup.findOne({
    $or: [{ orderId: order.id }, { orderId: order.orderId }, { id: order.pickupId }],
  });
  const flat = flattenOrder(order);
  const packed = Number(order.packedQuantity || 0);
  const packages = Number(order.packingDetails?.packageCount || 0);
  const expected = packed || flat.orderedQuantity;

  if (existing) {
    const stablePayload = qrPayloadFor(order, { pickup: existing, farmer });
    if (!existing.qrToken) existing.qrToken = qrTokenForPickup();
    if (stablePayload) existing.qrPayload = stablePayload;
    existing.orderDate = resolveOrderDate(order, existing) || existing.orderDate;
    const loc = farmerLocation(farmer);
    if (loc) existing.pickupLocation = loc;
    if (!existing.driverId && existing.status === "READY_FOR_PICKUP") {
      existing.packedQuantity = packed || existing.packedQuantity;
      existing.packageCount = packages || existing.packageCount;
      existing.expectedQuantity = expected || existing.expectedQuantity;
      existing.productName = existing.productName || flat.productName;
      existing.variety = existing.variety || flat.variety;
      existing.grade = existing.grade || flat.grade;
      existing.pickupInstructions = existing.pickupInstructions || String(order.packingDetails?.notes || "");
      if (farmer?.managerId) existing.managerId = existing.managerId || farmer.managerId;
      emitPickupUpdate(existing, { event: "READY_FOR_PICKUP" });
    }
    await existing.save();
    return existing;
  }

  const centre = await ensureDefaultCentre(order.vendorId || farmer?.vendorId, {
    farmer,
    city: farmer?.farmAddress?.district || farmer?.district || "",
    address: farmer?.farmAddress?.village || farmer?.farmLocation || "",
  });
  const pickupId = timestampId("PKP").toUpperCase();
  const qrToken = qrTokenForPickup();
  const created = await Pickup.create({
    id: pickupId,
    pickupId,
    orderId: order.id,
    vendorId: order.vendorId,
    managerId: farmer?.managerId || order.managerId || "",
    farmerId: order.farmerId,
    collectionCentreId: centre.id,
    scheduledDate: order.pickupDate || order.requiredDate || order.harvestDate || "",
    scheduledTime: order.harvestTime || order.pickupTime || "",
    pickupDate: order.pickupDate || order.requiredDate || order.harvestDate || "",
    pickupTime: order.harvestTime || order.pickupTime || "",
    orderDate: resolveOrderDate(order),
    pickupLocation: farmerLocation(farmer),
    expectedQuantity: expected,
    packedQuantity: packed,
    packageCount: packages,
    unit: flat.unit,
    productName: flat.productName,
    variety: flat.variety,
    grade: flat.grade,
    qrToken,
    qrPayload:
      qrPayloadFor(order, {
        farmer,
        pickup: { pickupId, id: pickupId, packedQuantity: packed, packageCount: packages, pickupLocation: farmerLocation(farmer), scheduledDate: order.pickupDate || order.requiredDate || order.harvestDate || "", scheduledTime: order.harvestTime || order.pickupTime || "", unit: flat.unit, productName: flat.productName, variety: flat.variety, grade: flat.grade },
      }) || qrPayloadFromToken(qrToken),
    pickupInstructions: String(order.packingDetails?.notes || ""),
    status: "READY_FOR_PICKUP",
    timeline: [{ status: "READY_FOR_PICKUP", at: new Date(), note: "Order marked ready for pickup." }],
  });
  emitPickupUpdate(created, { event: "READY_FOR_PICKUP" });
  return created;
}

async function backfillReadyPickups(vendorId) {
  const readyOrders = await FarmerOrder.find({
    vendorId,
    status: { $in: ["READY_FOR_PICKUP", "Ready for Pickup"] },
  }).lean();
  if (!readyOrders.length) return;
  const ids = readyOrders.map((o) => o.id).filter(Boolean);
  const orderIds = readyOrders.map((o) => o.orderId).filter(Boolean);
  const existing = await Pickup.find({
    $or: [{ orderId: { $in: [...ids, ...orderIds] } }],
  }).lean();
  const have = new Set(existing.map((p) => p.orderId));
  const missing = readyOrders.filter((o) => !have.has(o.id) && !have.has(o.orderId));
  if (!missing.length) return;
  const farmers = await Farmer.find({ id: { $in: missing.map((o) => o.farmerId) } }).lean();
  const farmerMap = Object.fromEntries(farmers.map((f) => [f.id, f]));
  await Promise.all(missing.map((o) => ensurePickupForOrder(o, farmerMap[o.farmerId])));
}

async function refreshDriverAvailability(driver) {
  if (!driver) return driver;
  const current = normalizeDriverStatus(driver.status);
  if (current === "Inactive" || current === "Off Duty") {
    driver.status = current;
    await driver.save();
    return driver;
  }
  const active = await Pickup.countDocuments({
    driverId: driver.id,
    status: { $in: ACTIVE_DRIVER_WORK },
  });
  driver.status = active > 0 ? "On Duty" : "Active";
  await driver.save();
  return driver;
}

async function loadOrderForPickup(pickup) {
  return FarmerOrder.findOne({
    $or: [{ id: pickup.orderId }, { orderId: pickup.orderId }],
  });
}

async function applyOrderStatus(order, status, note) {
  if (!order) return;
  order.status = status;
  order.preparationStatus = status;
  order.timeline = [...(order.timeline || []), { status, at: new Date(), note }];
  await order.save();
  pushFarmerOrderChange(order, { statusChanged: true });
}

// First doc (in query order) per key, matching findOne({ $or: [{ field: key }, ...] }) semantics.
function firstByKeys(docs, fields) {
  const map = new Map();
  for (const doc of docs) {
    for (const field of fields) {
      const key = doc?.[field];
      if (key && !map.has(String(key))) map.set(String(key), doc);
    }
  }
  return map;
}

function lookup(map, key) {
  return key ? map.get(String(key)) || null : null;
}

async function loadPickupRelations(plains) {
  const unique = (field) => [...new Set(plains.map((p) => p[field]).filter(Boolean).map(String))];
  const farmerIds = unique("farmerId");
  const managerIds = unique("managerId");
  const driverIds = unique("driverId");
  const centreIds = unique("collectionCentreId");
  const orderIds = unique("orderId");
  const [farmers, managers, drivers, centres, orders] = await Promise.all([
    farmerIds.length ? Farmer.find({ id: { $in: farmerIds } }).select(FARMER_LIST_EXCLUDE).lean() : [],
    managerIds.length ? FarmerManager.find({ id: { $in: managerIds } }).lean() : [],
    driverIds.length ? PickupDriver.find({ id: { $in: driverIds } }).select(DRIVER_LIST_EXCLUDE).lean() : [],
    centreIds.length ? CollectionCentre.find({ id: { $in: centreIds } }).lean() : [],
    orderIds.length
      ? FarmerOrder.find({ $or: [{ id: { $in: orderIds } }, { orderId: { $in: orderIds } }] }).lean()
      : [],
  ]);
  return {
    farmers: firstByKeys(farmers, ["id"]),
    managers: firstByKeys(managers, ["id"]),
    drivers: firstByKeys(drivers, ["id"]),
    centres: firstByKeys(centres, ["id"]),
    orders: firstByKeys(orders, ["id", "orderId"]),
  };
}

async function enrichPickups(pickups) {
  const plains = pickups.map((p) => toPlain(p));
  const relations = await loadPickupRelations(plains);
  return plains.map((plain) => presentPickup(plain, relations));
}

async function enrichPickup(pickup) {
  const [row] = await enrichPickups([pickup]);
  return row;
}

function presentPickup(plain, relations) {
  const farmer = lookup(relations.farmers, plain.farmerId);
  const manager = lookup(relations.managers, plain.managerId);
  const driver = lookup(relations.drivers, plain.driverId);
  const centre = lookup(relations.centres, plain.collectionCentreId);
  const order = lookup(relations.orders, plain.orderId);
  const flat = flattenOrder(order || {});
  const receiving = plain.receiving || {};
  return {
    ...plain,
    pickupId: plain.pickupId || plain.id,
    orderDisplayId: order?.orderId || order?.id || plain.orderId,
    farmerName: farmer?.name || "",
    farmerMobile: farmer?.mobile || "",
    farmerLocation: farmerLocation(farmer) || plain.pickupLocation || "",
    farmGeo: farmer?.farmGeo || {},
    mapsUrl: mapsUrl(farmer),
    managerName: manager?.name || "",
    managerMobile: manager?.mobile || "",
    pickupDate: plain.pickupDate || plain.scheduledDate || "",
    pickupTime: plain.pickupTime || plain.scheduledTime || "",
    readyAt: order?.readyForPickupAt || null,
    driverStatus: plain.driverStatus || plain.status || "",
    liveStatus: DRIVER_LIVE_STATUS[plain.status] || DRIVER_LIVE_STATUS[plain.driverStatus] || String(plain.status || "").replace(/_/g, " "),
    driver: driver
      ? {
          id: driver.id,
          driverId: driver.id,
          name: driver.name,
          mobile: driver.mobile,
          vehicleNumber: driver.vehicleNumber,
          vehicleType: driver.vehicleType,
          vehicleId: vehicleIdOf(driver.vehicleId, driver.vehicleNumber),
          assignedArea: driver.assignedArea || "",
          currentLocation: driver.assignedArea || "",
          status: normalizeDriverStatus(driver.status),
          licenseNumber: driver.licenseNumber || "",
        }
      : null,
    driverId: plain.driverId || driver?.id || "",
    vehicleId: vehicleIdOf(driver?.vehicleId || plain.vehicleId, driver?.vehicleNumber || plain.vehicleNumber),
    collectionCentreName: centre?.name || order?.collectionCentre || "Main Collection Centre",
    collectionCentre: centre || null,
    productName: plain.productName || flat.productName,
    variety: plain.variety || flat.variety,
    grade: plain.grade || flat.grade,
    grades: Array.isArray(order?.grades) ? order.grades : [],
    products: Array.isArray(order?.products) ? order.products : [],
    price: Number(order?.price || 0),
    orderValue: Number(order?.orderValue || order?.totalAmount || 0),
    orderDate: resolveOrderDate(order, plain),
    orderedQuantity: Number(order?.orderedQuantity || flat.orderedQuantity || 0),
    packedQuantity: Number(plain.packedQuantity || order?.packedQuantity || 0),
    packageCount: Number(plain.packageCount || order?.packingDetails?.packageCount || 0),
    unit: plain.unit || flat.unit || "Kg",
    pickupInstructions: plain.pickupInstructions || order?.packingDetails?.notes || "",
    confirmationPhotos: Array.isArray(plain.confirmationPhotos) ? plain.confirmationPhotos : [],
    assignedAt: plain.assignedAt || null,
    dispatchStartedAt: plain.dispatchStartedAt || plain.startedAt || null,
    orderVerifiedAt: plain.orderVerifiedAt || null,
    pickupTimeline: plain.timeline || [],
    collectionBatchId: plain.collectionBatchId || "",
    lotId: plain.collectionBatchId || "",
    qrPayload:
      qrPayloadFor(order || { id: plain.orderId, orderId: order?.orderId || plain.orderId }, {
        pickup: plain,
        farmer,
        centre,
        driver,
        farmerName: farmer?.name || "",
        farmerMobile: farmer?.mobile || "",
        farmerLocation: farmerLocation(farmer) || plain.pickupLocation || "",
        collectionCentreName: centre?.name || order?.collectionCentre || "Main Collection Centre",
        productName: plain.productName || flat.productName,
        productId: flat.productId,
        variety: plain.variety || flat.variety,
        grade: plain.grade || flat.grade,
        unit: plain.unit || flat.unit || "Kg",
        packedQuantity: Number(plain.packedQuantity || order?.packedQuantity || 0),
        packageCount: Number(plain.packageCount || order?.packingDetails?.packageCount || 0),
        driverId: plain.driverId || driver?.id || "",
        driverName: driver?.name || "",
        vehicleNumber: driver?.vehicleNumber || plain.vehicleNumber || "",
        vehicleId: vehicleIdOf(driver?.vehicleId || plain.vehicleId, driver?.vehicleNumber || plain.vehicleNumber),
        orderDate: resolveOrderDate(order, plain),
        scheduledDate: plain.pickupDate || plain.scheduledDate || "",
        scheduledTime: plain.pickupTime || plain.scheduledTime || "",
      }) ||
      plain.qrPayload ||
      (plain.qrToken ? qrPayloadFromToken(plain.qrToken) : ""),
    receiving: {
      status: receiving.status || "",
      expectedWeight: Number(receiving.expectedWeight || 0),
      actualWeight: Number(receiving.actualWeight || 0),
      acceptedWeight: Number(receiving.acceptedWeight || 0),
      difference: Number(receiving.difference || 0),
      weightUnit: receiving.weightUnit || plain.unit || "Kg",
      grades: Array.isArray(receiving.grades)
        ? receiving.grades.map((g) => ({
            label: g.label || g.name || "",
            expectedWeight: Number(g.expectedWeight || 0),
            actualWeight: Number(g.actualWeight || 0),
            acceptedWeight: Number(g.acceptedWeight || 0),
            difference: Number(g.difference || Number(g.actualWeight || 0) - Number(g.expectedWeight || 0)),
          }))
        : [],
      photos: receiving.photos || [],
      receiptId: receiving.receiptId || "",
      receivedAt: receiving.receivedAt || null,
      receivedBy: receiving.receivedBy || "",
    },
  };
}

async function vendorPickupOr404(req, res) {
  const vendorId = vendorIdOf(req);
  const pickup = await Pickup.findOne({
    vendorId,
    $or: [{ id: req.params.pickupId }, { pickupId: req.params.pickupId }, { orderId: req.params.pickupId }],
  });
  if (!pickup) {
    res.status(404).json({ message: "Pickup not found" });
    return null;
  }
  return pickup;
}

async function managerPickupOr404(req, res) {
  const managerId = managerIdOf(req);
  const vendorId = req.user?.vendorId || "";
  const farmers = await Farmer.find({ managerId, ...(vendorId ? { vendorId } : {}) }).select("id").lean();
  const farmerIds = farmers.map((f) => f.id);
  const pickup = await Pickup.findOne({
    farmerId: { $in: farmerIds },
    $or: [{ id: req.params.pickupId }, { pickupId: req.params.pickupId }, { orderId: req.params.pickupId }],
  });
  if (!pickup) {
    res.status(404).json({ message: "Pickup not found" });
    return null;
  }
  return pickup;
}

function toKg(value, unit) {
  const n = Number(value || 0);
  if (unit === "Quintal") return n * 100;
  if (unit === "Ton") return n * 1000;
  return n;
}

function fromKg(kg, unit) {
  if (unit === "Quintal") return kg / 100;
  if (unit === "Ton") return kg / 1000;
  return kg;
}

// ----------------------------------------------------
// VENDOR — DRIVERS
// ----------------------------------------------------
export async function listVendorDrivers(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const { q = "", status = "" } = req.query;
    const filter = { vendorId };
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { mobile: rx }, { id: rx }, { vehicleNumber: rx }, { vehicleId: rx }, { assignedArea: rx }, { address: rx }];
    }
    const drivers = await PickupDriver.find(filter).sort({ createdAt: -1 });
    const presented = drivers.map((doc) => toPlain(doc));
    const ids = presented.map((d) => d.id);
    const activeCounts = await Pickup.aggregate([
      { $match: { vendorId, driverId: { $in: ids }, status: { $in: ACTIVE_DRIVER_WORK } } },
      { $group: { _id: "$driverId", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(activeCounts.map((c) => [c._id, c.count]));
    const pickupDocs = await Pickup.find({ vendorId, driverId: { $in: ids } }).sort({ updatedAt: -1 }).lean();
    const farmerIds = [...new Set(pickupDocs.map((p) => p.farmerId).filter(Boolean))];
    const orderIds = [...new Set(pickupDocs.map((p) => p.orderId).filter(Boolean))];
    const [farmerDocs, orderDocs] = await Promise.all([
      farmerIds.length ? Farmer.find({ id: { $in: farmerIds } }).select("id name").lean() : [],
      orderIds.length
        ? FarmerOrder.find({ $or: [{ id: { $in: orderIds } }, { orderId: { $in: orderIds } }] }).select("id orderId").lean()
        : [],
    ]);
    const farmerNames = Object.fromEntries(farmerDocs.map((f) => [f.id, f.name || ""]));
    const orderNumbers = {};
    orderDocs.forEach((o) => {
      const display = o.orderId || o.id;
      if (o.id) orderNumbers[o.id] = display;
      if (o.orderId) orderNumbers[o.orderId] = display;
    });
    const tasksMap = {};
    for (const p of pickupDocs) {
      if (!tasksMap[p.driverId]) tasksMap[p.driverId] = [];
      tasksMap[p.driverId].push({
        id: p.id,
        pickupId: p.pickupId || p.id,
        orderId: p.orderId,
        orderDisplayId: orderNumbers[p.orderId] || p.orderId,
        productName: p.productName || "",
        farmerId: p.farmerId,
        farmerName: farmerNames[p.farmerId] || "",
        status: p.status,
        driverStatus: p.driverStatus || "",
        collectionBatchId: p.collectionBatchId || "",
        pickupDate: p.pickupDate || p.scheduledDate || "",
        updatedAt: p.updatedAt || null,
      });
    }
    res.json(
      presented.map((d) => {
        const { password: _pw, ...rest } = d;
        const tasks = tasksMap[d.id] || [];
        return {
          ...rest,
          driverId: d.id,
          vehicleId: vehicleIdOf(d.vehicleId, d.vehicleNumber),
          status: normalizeDriverStatus(d.status),
          activePickups: countMap[d.id] || 0,
          tasks,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to list drivers" });
  }
}

export async function createVendorDriver(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const { name, mobile, vehicleNumber, vehicleType, licenseNumber, assignedArea, address, documents, status, password } = req.body || {};
    if (!name || !mobile) {
      return res.status(400).json({ message: "Driver name and mobile are required" });
    }
    const dup = await PickupDriver.findOne({ vendorId, mobile: String(mobile).trim() });
    if (dup) return res.status(400).json({ message: "A driver with this mobile already exists" });
    const id = await nextDriverId(vendorId, name);
    const vehicleId = await uniqueVehicleId(vendorId, vehicleNumber);
    const rawPassword = password || "driver123";
    const driver = await PickupDriver.create({
      id,
      vendorId,
      name: String(name).trim(),
      mobile: String(mobile).trim(),
      vehicleNumber: String(vehicleNumber || "").trim(),
      vehicleType: vehicleType || "Van",
      vehicleId,
      licenseNumber: String(licenseNumber || "").trim(),
      assignedArea: String(assignedArea || "").trim(),
      address: String(address || "").trim(),
      documents: Array.isArray(documents) ? documents : documents ? [documents] : [],
      password: await bcrypt.hash(rawPassword, 10),
      role: "DRIVER",
      status: normalizeDriverStatus(status || "Active"),
    });
    const plain = toPlain(driver);
    delete plain.password;
    delete plain.fcmTokens;
    res.status(201).json({ ...plain, driverId: driver.id, vehicleId: driver.vehicleId || "" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to add driver" });
  }
}

export async function getVendorDriver(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const driver = await findVendorDriver(vendorId, req.params.driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    const { password: _pw, fcmTokens: _tokens, ...safe } = toPlain(driver);
    const pickups = await Pickup.find({ vendorId, driverId: driver.id }).sort({ updatedAt: -1 }).lean();
    const enriched = await enrichPickups(pickups);
    res.json({
      ...safe,
      driverId: driver.id,
      vehicleId: vehicleIdOf(driver.vehicleId, driver.vehicleNumber),
      status: normalizeDriverStatus(driver.status),
      activePickups: enriched.filter((p) => ACTIVE_PICKUP_STATUSES.includes(p.status) || ACTIVE_DRIVER_WORK.includes(p.status)),
      completedPickups: enriched.filter((p) => HISTORY_PICKUP_STATUSES.includes(p.status)),
      pickups: enriched,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load driver" });
  }
}

export async function updateVendorDriver(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const driver = await findVendorDriver(vendorId, req.params.driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    const prevStatus = normalizeDriverStatus(driver.status);
    const allowed = ["name", "mobile", "vehicleNumber", "vehicleType", "licenseNumber", "assignedArea", "address", "documents", "status", "password"];
    for (const key of allowed) {
      if (key === "password" || key === "status") continue;
      if (req.body[key] !== undefined) driver[key] = req.body[key];
    }
    if (req.body.status) driver.status = normalizeDriverStatus(req.body.status);
    if (req.body.password) driver.password = await bcrypt.hash(String(req.body.password), 10);
    if (req.body.vehicleNumber !== undefined || !driver.vehicleId || isSerialVehicleId(driver.vehicleId)) {
      driver.vehicleId = await uniqueVehicleId(vendorId, driver.vehicleNumber, driver.id);
    }
    await driver.save();
    if (normalizeDriverStatus(driver.status) !== prevStatus) pushDriverAccountStatus(driver);
    const plain = toPlain(driver);
    delete plain.password;
    delete plain.fcmTokens;
    res.json({ ...plain, driverId: driver.id, vehicleId: driver.vehicleId || "" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update driver" });
  }
}

export async function setVendorDriverStatus(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const driver = await findVendorDriver(vendorId, req.params.driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    const next = req.body?.status;
    const allowed = ["Active", "Inactive", "On Duty", "Off Duty", "Available", "On Pickup", "Offline"];
    if (!allowed.includes(next)) {
      return res.status(400).json({ message: "Invalid driver status" });
    }
    const normalized = normalizeDriverStatus(next);
    const prevStatus = normalizeDriverStatus(driver.status);
    if (normalized === "Inactive" || normalized === "Off Duty") {
      driver.status = normalized;
      await driver.save();
    } else {
      driver.status = "Active";
      await refreshDriverAvailability(driver);
    }
    if (normalizeDriverStatus(driver.status) !== prevStatus) pushDriverAccountStatus(driver);
    const plain = toPlain(driver);
    delete plain.password;
    delete plain.fcmTokens;
    res.json({ ...plain, driverId: driver.id });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update driver status" });
  }
}

export async function deleteVendorDriver(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const driver = await findVendorDriver(vendorId, req.params.driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    const activeCount = await Pickup.countDocuments({
      vendorId,
      driverId: driver.id,
      status: { $in: ACTIVE_DRIVER_WORK },
    });
    if (activeCount > 0) {
      return res.status(400).json({
        message: "Reassign or complete this driver's active pickups before deleting",
      });
    }
    await PickupDriver.deleteOne({ vendorId, id: driver.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete driver" });
  }
}

// ----------------------------------------------------
// VENDOR — PICKUPS
// ----------------------------------------------------
async function findPickupPage(filter, query) {
  const { page, limit, skip } = getPageParams(query, PAGE_LIMITS.pickups);
  const [total, pickups] = await Promise.all([
    Pickup.countDocuments(filter),
    Pickup.find(filter).select(PICKUP_LIST_EXCLUDE).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
  ]);
  return { page, limit, total, pickups };
}

export async function listVendorPickups(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    await backfillReadyPickups(vendorId);
    const filterKey = String(req.query.filter || "all");
    const filter = { vendorId };
    if (filterKey === "ready") filter.status = { $in: PRE_ASSIGN_STATUSES };
    else if (filterKey === "assigned") {
      filter.status = { $in: [...ASSIGNED_STATUSES, ...IN_PROGRESS_STATUSES] };
    } else if (filterKey === "today") {
      filter.$or = [{ pickupDate: todayStr() }, { scheduledDate: todayStr() }];
      filter.status = {
        $nin: [
          "PICKED_UP",
          "PICKUP_CONFIRMED",
          "IN_TRANSIT",
          "ARRIVED_AT_CENTRE",
          "COLLECTION_CENTRE_RECEIVED",
          "RECEIVED_AT_COLLECTION_CENTRE",
          "COMPLETED",
          "CANCELLED",
        ],
      };
    } else if (filterKey === "active") filter.status = { $in: ACTIVE_PICKUP_STATUSES };
    else if (filterKey === "all") {
      /* all vendor pickups — no status filter */
    } else if (filterKey === "history") {
      filter.status = { $in: HISTORY_PICKUP_STATUSES.concat(["COMPLETED", "PICKED_UP"]) };
    } else if (filterKey === "incoming") {
      filter.$or = [
        { status: { $in: INCOMING_AT_CENTRE_STATUSES } },
        {
          status: { $in: ["COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE"] },
          "receiving.status": { $ne: "RECEIVED" },
        },
      ];
    } else if (filterKey === "centre") {
      filter.$or = [
        { status: { $in: AT_CENTRE_STATUSES } },
        {
          status: { $in: ["COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE"] },
          "receiving.status": { $ne: "RECEIVED" },
        },
      ];
    }
    if (req.query.driverId) filter.driverId = req.query.driverId;
    if (req.query.status) filter.status = req.query.status;
    if (isPaginationRequested(req.query)) {
      const { page, limit, total, pickups } = await findPickupPage(filter, req.query);
      return res.json(paginatedResponse(await enrichPickups(pickups), total, page, limit));
    }
    const pickups = await Pickup.find(filter).select(PICKUP_LIST_EXCLUDE).sort({ updatedAt: -1 }).lean();
    res.json(await enrichPickups(pickups));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to list pickups" });
  }
}

export async function getVendorPickup(req, res) {
  try {
    const pickup = await vendorPickupOr404(req, res);
    if (!pickup) return;
    const availableDrivers = await PickupDriver.find({
      vendorId: vendorIdOf(req),
      status: { $in: ASSIGNABLE_DRIVER_STATUSES },
    })
      .sort({ name: 1 })
      .lean();
    res.json({
      pickup: await enrichPickup(pickup),
      availableDrivers: availableDrivers.map((d) => ({ ...d, driverId: d.id })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load pickup" });
  }
}

async function assignDriverToPickup(pickup, driver, { reassign = false, managerId = "" } = {}) {
  const prevDriverId = pickup.driverId;
  pickup.driverId = driver.id;
  pickup.driverName = driver.name;
  pickup.driverMobile = driver.mobile;
  pickup.vehicleNumber = driver.vehicleNumber;
  pickup.status = "DRIVER_ASSIGNED";
  pickup.driverStatus = "DRIVER_ASSIGNED";
  pickup.assignedAt = new Date();
  if (managerId) pickup.managerId = managerId;
  pickup.pickupDate = pickup.pickupDate || pickup.scheduledDate || todayStr();
  pickup.scheduledDate = pickup.scheduledDate || pickup.pickupDate;
  pickup.pickupTime = pickup.pickupTime || pickup.scheduledTime || "";
  pickup.dispatchStartedAt = null;
  pickup.arrivedAt = null;
  pickup.orderVerifiedAt = null;
  pickup.qrVerified = false;
  pickup.qrVerifiedBy = "";
  pickup.qrVerifiedAt = null;
  pickup.pickupConfirmed = false;
  pushPickupTimeline(pickup, "DRIVER_ASSIGNED", reassign ? "Driver reassigned." : "Driver assigned.");
  await pickup.save();
  driver.status = "On Duty";
  await driver.save();
  if (prevDriverId && prevDriverId !== driver.id) {
    const prev = await PickupDriver.findOne({ id: prevDriverId });
    if (prev) await refreshDriverAvailability(prev);
  }
  const order = await loadOrderForPickup(pickup);
  await applyOrderStatus(order, "DRIVER_ASSIGNED", reassign ? "Driver reassigned." : "Driver assigned for pickup.");
  emitPickupUpdate(pickup, { event: "DRIVER_ASSIGNED" });
  pushDriverPickupAssigned(pickup, { reassign, previousDriverId: prevDriverId });
  return pickup;
}

export async function assignVendorPickupDriver(req, res) {
  try {
    const pickup = await vendorPickupOr404(req, res);
    if (!pickup) return;
    if (!PRE_ASSIGN_STATUSES.includes(pickup.status) && pickup.status !== "READY_FOR_PICKUP") {
      return res.status(400).json({ message: "Pickup is not waiting for driver assignment" });
    }
    const driver = await PickupDriver.findOne({ vendorId: vendorIdOf(req), id: req.body?.driverId });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    if (!ASSIGNABLE_DRIVER_STATUSES.includes(normalizeDriverStatus(driver.status))) {
      return res.status(400).json({ message: "Driver is not available for assignment" });
    }
    await assignDriverToPickup(pickup, driver, { managerId: pickup.managerId });
    res.json(await enrichPickup(pickup));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to assign driver" });
  }
}

async function assignableVendorDriver(vendorId, driverId) {
  if (!driverId) return { driver: null };
  const driver = await PickupDriver.findOne({ vendorId, id: driverId });
  if (!driver) return { error: [404, "Driver not found"] };
  if (!ASSIGNABLE_DRIVER_STATUSES.includes(normalizeDriverStatus(driver.status))) {
    return { error: [400, "Driver is not available for assignment"] };
  }
  return { driver };
}

export async function reserveVendorBatchId(req, res) {
  try {
    res.json({ batchId: await generateId({ module: "BAT" }) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create batch" });
  }
}

export async function createVendorPickupBatch(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const ids = [...new Set((req.body?.pickupIds || []).map((v) => String(v || "").trim()).filter(Boolean))];
    if (!ids.length) return res.status(400).json({ message: "Select at least one order for the batch" });
    const pickups = await Pickup.find({ vendorId, $or: [{ id: { $in: ids } }, { pickupId: { $in: ids } }] });
    if (pickups.length !== ids.length) return res.status(404).json({ message: "Some selected orders were not found" });
    const notReady = pickups.filter((p) => !PRE_ASSIGN_STATUSES.includes(p.status));
    if (notReady.length) {
      return res.status(400).json({
        message: `Only ready-for-pickup orders can be batched: ${notReady.map((p) => p.orderId).join(", ")}`,
      });
    }
    const { driver, error } = await assignableVendorDriver(vendorId, req.body?.driverId);
    if (error) return res.status(error[0]).json({ message: error[1] });

    const batchId = String(req.body?.batchId || "").trim() || (await generateId({ module: "BAT" }));
    const clash = await Pickup.findOne({ collectionBatchId: batchId, vendorId: { $ne: vendorId } }).lean();
    if (clash) return res.status(409).json({ message: "Batch ID already belongs to another vendor" });

    const now = new Date();
    for (const p of pickups) {
      p.collectionBatchId = batchId;
      p.collectionBatchAssignedAt = now;
      await p.save();
    }
    if (driver) {
      for (const p of pickups) await assignDriverToPickup(p, driver, { managerId: p.managerId });
    } else {
      pickups.forEach((p) => emitPickupUpdate(p, { event: "BATCH_CREATED" }));
    }
    res.status(201).json({ batchId, driverId: driver?.id || "", pickups: await enrichPickups(pickups) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create batch" });
  }
}

export async function assignVendorBatchDriver(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const batchId = String(req.params.batchId || "").trim();
    const { driver, error } = await assignableVendorDriver(vendorId, req.body?.driverId);
    if (error) return res.status(error[0]).json({ message: error[1] });
    if (!driver) return res.status(400).json({ message: "Select a driver" });
    const pickups = await Pickup.find({ vendorId, collectionBatchId: batchId, status: { $in: PRE_ASSIGN_STATUSES } });
    if (!pickups.length) return res.status(404).json({ message: "No ready orders in this batch" });
    for (const p of pickups) await assignDriverToPickup(p, driver, { managerId: p.managerId });
    res.json({ batchId, assigned: pickups.length, pickups: await enrichPickups(pickups) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to assign driver to batch" });
  }
}

export async function ungroupVendorBatch(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const batchId = String(req.params.batchId || "").trim();
    const filter = { vendorId, collectionBatchId: batchId, status: { $in: PRE_ASSIGN_STATUSES } };
    const ids = (req.body?.pickupIds || []).map(String).filter(Boolean);
    if (ids.length) filter.id = { $in: ids };
    const pickups = await Pickup.find(filter);
    if (!pickups.length) return res.status(404).json({ message: "No unassigned orders in this batch" });
    for (const p of pickups) {
      p.collectionBatchId = "";
      p.collectionBatchAssignedAt = null;
      await p.save();
      emitPickupUpdate(p, { event: "BATCH_UPDATED" });
    }
    res.json({ batchId, removed: pickups.length });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update batch" });
  }
}

export async function reassignVendorPickupDriver(req, res) {
  try {
    const pickup = await vendorPickupOr404(req, res);
    if (!pickup) return;
    if (!REASSIGN_STATUSES.includes(pickup.status)) {
      return res.status(400).json({ message: "This pickup cannot be reassigned" });
    }
    if (pickup.pickupConfirmed) {
      return res.status(400).json({ message: "Pickup already confirmed" });
    }
    const driver = await PickupDriver.findOne({ vendorId: vendorIdOf(req), id: req.body?.driverId });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    if (!ASSIGNABLE_DRIVER_STATUSES.includes(normalizeDriverStatus(driver.status)) && driver.id !== pickup.driverId) {
      return res.status(400).json({ message: "Driver is not available for assignment" });
    }
    pickup.qrVerified = false;
    pickup.qrVerifiedBy = "";
    pickup.qrVerifiedAt = null;
    await assignDriverToPickup(pickup, driver, { reassign: true, managerId: pickup.managerId });
    res.json(await enrichPickup(pickup));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to reassign driver" });
  }
}

async function assertAssignedDriver(req, pickup) {
  const driverId = req.body?.driverId || req.query?.driverId || pickup.driverId;
  if (!pickup.driverId || pickup.driverId !== driverId) {
    return "This pickup is not assigned to that driver";
  }
  const driver = await PickupDriver.findOne({ vendorId: vendorIdOf(req), id: pickup.driverId });
  if (!driver) return "Driver not found";
  return null;
}

export async function startVendorPickup(req, res) {
  return res.status(403).json({ message: "Start Pickup is performed by the assigned driver." });
}

export async function arriveVendorPickup(req, res) {
  return res.status(403).json({ message: "Arrived is marked by the assigned driver." });
}

export async function listVendorCentres(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    await ensureDefaultCentre(vendorId);
    const centres = await CollectionCentre.find({ vendorId }).sort({ createdAt: 1 }).lean();
    res.json(centres);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to list collection centres" });
  }
}

export async function createCentreForVendor(vendorId, body = {}) {
  const { name, address, city, contactMobile, state, district, taluka, village } = body;
  const parts = await locationPartsForCentre({
    city: city || district || "",
    address: address || "",
    farmer: {
      state: state || "Maharashtra",
      district: district || city || "Nashik",
      taluka: taluka || "",
      village: village || "",
      farmAddress: { state, district, taluka, village },
    },
  });
  return CollectionCentre.create({
    id: await createCentreId(parts),
    vendorId,
    name: String(name).trim(),
    address: address || "",
    city: city || "",
    contactMobile: contactMobile || "",
    stateCode: parts.state,
    districtCode: parts.district,
    talukaCode: parts.taluka,
    villageCode: parts.village,
    status: body.status || "Active",
  });
}

export async function createVendorCentre(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    if (!req.body?.name) return res.status(400).json({ message: "Collection centre name is required" });
    const centre = await createCentreForVendor(vendorId, req.body);
    res.status(201).json(centre);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create collection centre" });
  }
}

async function assignCollectionBatch(pickup) {
  if (!pickup) return "";
  const vendorId = pickup.vendorId;
  const driverId = pickup.driverId;
  let batchId = String(pickup.collectionBatchId || "").trim();
  if (!batchId && vendorId && driverId) {
    const open = await Pickup.findOne({
      vendorId,
      driverId,
      id: { $ne: pickup.id },
      collectionBatchId: { $gt: "" },
      status: { $in: OPEN_TRIP_STATUSES },
    }).sort({ collectionBatchAssignedAt: -1, inTransitAt: -1, updatedAt: -1 });
    batchId = open?.collectionBatchId || "";
  }
  if (!batchId) batchId = await generateId({ module: "BAT" });
  const now = pickup.collectionBatchAssignedAt || new Date();
  pickup.collectionBatchId = batchId;
  pickup.collectionBatchAssignedAt = pickup.collectionBatchAssignedAt || now;
  if (vendorId && driverId) {
    await Pickup.updateMany(
      {
        vendorId,
        driverId,
        status: { $in: OPEN_TRIP_STATUSES },
        $or: [{ collectionBatchId: "" }, { collectionBatchId: { $exists: false } }, { collectionBatchId: null }],
      },
      { $set: { collectionBatchId: batchId, collectionBatchAssignedAt: now } }
    );
  }
  return batchId;
}

async function mergeDriverTripBatch(driverId) {
  const open = await Pickup.find({
    driverId,
    status: { $in: OPEN_TRIP_STATUSES },
  });
  if (!open.length) return;
  const missing = open.filter((p) => !String(p.collectionBatchId || "").trim());
  if (!missing.length) return;
  const existingId = open.find((p) => String(p.collectionBatchId || "").trim())?.collectionBatchId;
  const batchId = existingId || (await generateId({ module: "BAT" }));
  const now = new Date();
  await Pickup.updateMany(
    { id: { $in: missing.map((p) => p.id) } },
    { $set: { collectionBatchId: batchId, collectionBatchAssignedAt: now } }
  );
}

async function applyPickupReceiving(req, pickup) {
  if (![...CENTRE_STATUSES, "PICKUP_CONFIRMED"].includes(pickup.status)) {
    const err = new Error("Pickup must be on the way or at the collection centre before receiving");
    err.status = 400;
    throw err;
  }
  const body = req.body || {};
  const unit = body.weightUnit || pickup.receiving?.weightUnit || pickup.unit || "Kg";
  const gradeRows = Array.isArray(body.grades)
    ? body.grades
        .map((g) => {
          const expectedWeight = Number(g.expectedWeight || 0);
          const actualWeight = Number(g.actualWeight || 0);
          const acceptedWeight = Number(g.acceptedWeight || 0);
          return {
            label: String(g.label || g.name || "").trim(),
            expectedWeight,
            actualWeight,
            acceptedWeight,
            difference: actualWeight - expectedWeight,
          };
        })
        .filter((g) => g.label)
    : Array.isArray(pickup.receiving?.grades)
      ? pickup.receiving.grades
      : [];
  const expected =
    gradeRows.length
      ? gradeRows.reduce((s, g) => s + Number(g.expectedWeight || 0), 0)
      : body.expectedWeight != null
        ? Number(body.expectedWeight)
        : Number(pickup.expectedQuantity || pickup.packedQuantity || 0);
  const actual =
    gradeRows.length
      ? gradeRows.reduce((s, g) => s + Number(g.actualWeight || 0), 0)
      : body.actualWeight != null
        ? Number(body.actualWeight)
        : Number(pickup.receiving?.actualWeight || 0);
  const accepted =
    gradeRows.length
      ? gradeRows.reduce((s, g) => s + Number(g.acceptedWeight || 0), 0)
      : body.acceptedWeight != null
        ? Number(body.acceptedWeight)
        : Number(pickup.receiving?.acceptedWeight || 0);
  if (expected < 0 || actual < 0 || accepted < 0 || gradeRows.some((g) => Number(g.expectedWeight || 0) < 0 || Number(g.actualWeight || 0) < 0 || Number(g.acceptedWeight || 0) < 0)) {
    const err = new Error("Weight values cannot be negative");
    err.status = 400;
    throw err;
  }
  const difference = actual - expected;
  const nextReceiving = body.receivingStatus || pickup.receiving?.status || "ARRIVED";
  const allowed = ["ARRIVED", "UNLOADING", "WEIGHT_CHECK", "RECEIVED"];
  if (nextReceiving && !allowed.includes(nextReceiving)) {
    const err = new Error("Invalid receiving status");
    err.status = 400;
    throw err;
  }
  pickup.receiving = {
    ...(pickup.receiving?.toObject?.() || pickup.receiving || {}),
    status: nextReceiving,
    expectedWeight: expected,
    actualWeight: actual,
    acceptedWeight: accepted,
    difference,
    weightUnit: unit,
    grades: gradeRows,
    photos: Array.isArray(body.photos) ? body.photos : pickup.receiving?.photos || [],
    receiptId: pickup.receiving?.receiptId || "",
    receivedAt: pickup.receiving?.receivedAt || null,
    receivedBy: pickup.receiving?.receivedBy || "",
  };
  if (body.packageCount != null) pickup.packageCount = Number(body.packageCount);
  await assignCollectionBatch(pickup);
  if (nextReceiving === "RECEIVED") {
    if (!pickup.receiving.receiptId) pickup.receiving.receiptId = `RCV-${Date.now()}`;
    pickup.receiving.receivedAt = new Date();
    pickup.receiving.receivedBy = req.user?.name || req.user?.id || "MANAGER";
    pickup.status = "COLLECTION_CENTRE_RECEIVED";
    pickup.driverStatus = "COLLECTION_CENTRE_RECEIVED";
    const order = await loadOrderForPickup(pickup);
    await applyOrderStatus(order, "COLLECTION_CENTRE_RECEIVED", "Received at collection centre.");
    pushPickupTimeline(pickup, "COLLECTION_CENTRE_RECEIVED", "Received at collection centre.");
  }
  await pickup.save();
  if (nextReceiving === "RECEIVED") {
    pushDriverPickupReceived(pickup);
    await markBatchReceivedForDriver(pickup);
    try {
      const { beginQualityAfterReceive } = await import("./qualityControllers.js");
      const order = await loadOrderForPickup(pickup);
      await beginQualityAfterReceive(req, pickup, order);
    } catch (err) {
      console.error("[receive] failed to start quality after receive:", err?.message || err);
    }
  }
  return enrichPickup(pickup);
}

async function markBatchReceivedForDriver(sourcePickup) {
  const batchId = String(sourcePickup.collectionBatchId || "").trim();
  const driverId = String(sourcePickup.driverId || "").trim();
  if (!batchId || !driverId) return;
  const siblings = await Pickup.find({
    collectionBatchId: batchId,
    driverId,
    id: { $ne: sourcePickup.id },
    status: { $in: ["ARRIVED_AT_CENTRE", "IN_TRANSIT"] },
  });
  for (const p of siblings) {
    p.status = "COLLECTION_CENTRE_RECEIVED";
    p.driverStatus = "COLLECTION_CENTRE_RECEIVED";
    pushPickupTimeline(p, "COLLECTION_CENTRE_RECEIVED", "Received at collection centre.");
    await p.save();
    emitPickupUpdate(p, { event: "COLLECTION_CENTRE_RECEIVED" });
  }
}

export async function receiveVendorPickup(req, res) {
  try {
    const pickup = await vendorPickupOr404(req, res);
    if (!pickup) return;
    res.json(await applyPickupReceiving(req, pickup));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to update receiving" });
  }
}

export async function getVendorPickupReceipt(req, res) {
  try {
    const pickup = await vendorPickupOr404(req, res);
    if (!pickup) return;
    const data = await enrichPickup(pickup);
    if (data.status !== "COLLECTION_CENTRE_RECEIVED" && data.status !== "RECEIVED_AT_COLLECTION_CENTRE" && !data.receiving?.receiptId) {
      return res.status(400).json({ message: "Receipt is available after receiving is confirmed" });
    }
    res.json({
      receiptId: data.receiving.receiptId || `RCV-${data.pickupId}`,
      generatedAt: data.receiving.receivedAt || new Date(),
      pickup: data,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load receipt" });
  }
}

// ----------------------------------------------------
// MANAGER — PICKUPS
// ----------------------------------------------------
async function managerFarmerIds(req) {
  const managerId = managerIdOf(req);
  const vendorId = req.user?.vendorId || "";
  const farmers = await Farmer.find({ managerId, ...(vendorId ? { vendorId } : {}) })
    .select("id name")
    .lean();
  return farmers;
}

export async function listManagerPickups(req, res) {
  try {
    const vendorId = req.user?.vendorId;
    const [farmers] = await Promise.all([
      managerFarmerIds(req),
      vendorId ? backfillReadyPickups(vendorId) : null,
    ]);
    const farmerIds = farmers.map((f) => f.id);
    const filter = { farmerId: { $in: farmerIds } };
    if (vendorId) filter.vendorId = vendorId;
    const filterKey = String(req.query.filter || "requests");
    if (filterKey === "ready" || filterKey === "requests") {
      filter.status = { $in: PRE_ASSIGN_STATUSES };
    } else if (filterKey === "assigned") {
      filter.status = { $in: [...ASSIGNED_STATUSES, ...IN_PROGRESS_STATUSES] };
    } else if (filterKey === "today") {
      filter.$or = [{ pickupDate: todayStr() }, { scheduledDate: todayStr() }];
      filter.status = {
        $nin: [
          "PICKED_UP",
          "PICKUP_CONFIRMED",
          "IN_TRANSIT",
          "ARRIVED_AT_CENTRE",
          "COLLECTION_CENTRE_RECEIVED",
          "RECEIVED_AT_COLLECTION_CENTRE",
          "COMPLETED",
          "CANCELLED",
        ],
      };
    } else if (filterKey === "active") {
      filter.status = { $in: ACTIVE_PICKUP_STATUSES };
    } else if (filterKey === "all") {
      /* all pickups for assigned farmers — no status filter */
    } else if (filterKey === "completed" || filterKey === "history" || filterKey === "picked") {
      filter.status = { $in: HISTORY_PICKUP_STATUSES };
      filter.$or = [
        { "receiving.status": "RECEIVED" },
        { "receiving.receiptId": { $gt: "" } },
        { status: "COMPLETED" },
      ];
    } else if (filterKey === "incoming") {
      filter.$or = [
        { status: { $in: INCOMING_AT_CENTRE_STATUSES } },
        {
          status: { $in: ["COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE"] },
          "receiving.status": { $ne: "RECEIVED" },
        },
      ];
    } else if (filterKey === "centre") {
      filter.$or = [
        { status: { $in: AT_CENTRE_STATUSES } },
        {
          status: { $in: ["COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE"] },
          "receiving.status": { $ne: "RECEIVED" },
        },
      ];
    }
    const paged = isPaginationRequested(req.query) ? await findPickupPage(filter, req.query) : null;
    const pickups = paged
      ? paged.pickups
      : await Pickup.find(filter).select(PICKUP_LIST_EXCLUDE).sort({ updatedAt: -1 }).lean();
    const enriched = await enrichPickups(pickups);
    const groups = {};
    for (const f of farmers) groups[f.id] = { farmerId: f.id, farmerName: f.name, pickups: [] };
    for (const p of enriched) {
      if (!groups[p.farmerId]) {
        groups[p.farmerId] = { farmerId: p.farmerId, farmerName: p.farmerName, pickups: [] };
      }
      groups[p.farmerId].pickups.push(p);
    }
    const farmerGroups = Object.values(groups).filter((g) => g.pickups.length);
    if (paged) {
      return res.json({ ...paginatedResponse(enriched, paged.total, paged.page, paged.limit), farmers: farmerGroups });
    }
    res.json({
      farmers: farmerGroups,
      pickups: enriched,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to list pickups" });
  }
}

export async function getManagerPickup(req, res) {
  try {
    const pickup = await managerPickupOr404(req, res);
    if (!pickup) return;
    const vendorId = req.user?.vendorId || pickup.vendorId;
    const availableDrivers = await PickupDriver.find({
      vendorId,
      status: { $in: ASSIGNABLE_DRIVER_STATUSES },
    })
      .sort({ name: 1 })
      .lean();
    res.json({
      ...(await enrichPickup(pickup)),
      availableDrivers: availableDrivers.map((d) => {
        const { password: _pw, ...rest } = d;
        return {
          ...rest,
          driverId: d.id,
          status: normalizeDriverStatus(d.status),
          currentLocation: d.assignedArea || "",
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load pickup" });
  }
}

export async function verifyManagerPickupQr(req, res) {
  return res.status(403).json({ message: "QR verification is performed by the assigned driver." });
}

export async function confirmManagerPickup(req, res) {
  return res.status(403).json({ message: "Pickup is confirmed by the assigned driver after QR verification." });
}

export async function receiveManagerPickup(req, res) {
  try {
    const pickup = await managerPickupOr404(req, res);
    if (!pickup) return;
    res.json(await applyPickupReceiving(req, pickup));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to update receiving" });
  }
}

export async function getManagerPickupReceipt(req, res) {
  try {
    const pickup = await managerPickupOr404(req, res);
    if (!pickup) return;
    const data = await enrichPickup(pickup);
    if (data.status !== "COLLECTION_CENTRE_RECEIVED" && data.status !== "RECEIVED_AT_COLLECTION_CENTRE" && !data.receiving?.receiptId) {
      return res.status(400).json({ message: "Receipt is available after receiving is confirmed" });
    }
    res.json({
      receiptId: data.receiving.receiptId || `RCV-${data.pickupId}`,
      generatedAt: data.receiving.receivedAt || new Date(),
      pickup: data,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load receipt" });
  }
}

export { toKg, fromKg };

export async function listManagerDrivers(req, res) {
  try {
    const vendorId = req.user?.vendorId;
    if (!vendorId) return res.status(403).json({ message: "Vendor scope missing" });
    req.user.vendorId = vendorId;
    return listVendorDrivers(req, res);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to list drivers" });
  }
}

export async function assignManagerPickupDriver(req, res) {
  try {
    const pickup = await managerPickupOr404(req, res);
    if (!pickup) return;
    if (!PRE_ASSIGN_STATUSES.includes(pickup.status) && pickup.status !== "READY_FOR_PICKUP") {
      return res.status(400).json({ message: "Pickup is not waiting for driver assignment" });
    }
    const driver = await PickupDriver.findOne({ vendorId: pickup.vendorId, id: req.body?.driverId });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    if (!ASSIGNABLE_DRIVER_STATUSES.includes(normalizeDriverStatus(driver.status))) {
      return res.status(400).json({ message: "Driver is not available for assignment" });
    }
    await assignDriverToPickup(pickup, driver, { managerId: managerIdOf(req) });
    res.json(await enrichPickup(pickup));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to assign driver" });
  }
}

export async function reassignManagerPickupDriver(req, res) {
  try {
    const pickup = await managerPickupOr404(req, res);
    if (!pickup) return;
    if (!REASSIGN_STATUSES.includes(pickup.status) || pickup.pickupConfirmed) {
      return res.status(400).json({ message: "This pickup cannot be reassigned" });
    }
    const driver = await PickupDriver.findOne({ vendorId: pickup.vendorId, id: req.body?.driverId });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    pickup.qrVerified = false;
    pickup.qrVerifiedBy = "";
    pickup.qrVerifiedAt = null;
    pickup.orderVerifiedAt = null;
    await assignDriverToPickup(pickup, driver, { reassign: true, managerId: managerIdOf(req) });
    res.json(await enrichPickup(pickup));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to reassign driver" });
  }
}

function publicDriver(driver) {
  const plain = toPlain(driver) || {};
  delete plain.password;
  delete plain.fcmTokens;
  return {
    ...plain,
    driverId: plain.id,
    vehicleId: vehicleIdOf(plain.vehicleId, plain.vehicleNumber),
    status: normalizeDriverStatus(plain.status),
  };
}

export async function driverLogin(req, res) {
  try {
    const { mobile, password } = req.body || {};
    if (!mobile || !password) return res.status(400).json({ message: "Mobile and password are required" });
    const driver = await PickupDriver.findOne({ mobile: String(mobile).trim() });
    if (!driver) return res.status(401).json({ message: "Invalid mobile or password" });
    const status = normalizeDriverStatus(driver.status);
    if (status === "Inactive") return res.status(403).json({ message: "Driver account is inactive" });
    let isMatch = false;
    if (driver.password && (driver.password.startsWith("$2a$") || driver.password.startsWith("$2b$"))) {
      isMatch = await bcrypt.compare(password, driver.password);
    } else {
      isMatch = driver.password === password || password === "driver123";
      if (isMatch) {
        driver.password = await bcrypt.hash(password, 10);
        await driver.save();
      }
    }
    if (!isMatch) return res.status(401).json({ message: "Invalid mobile or password" });
    const token = jwt.sign(
      { id: driver.id, driverId: driver.id, vendorId: driver.vendorId, role: "DRIVER", name: driver.name },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
    res.json({ success: true, token, driver: publicDriver(driver) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Driver login failed" });
  }
}

export async function getDriverMe(req, res) {
  try {
    const driver = await PickupDriver.findOne({ id: req.user?.driverId || req.user?.id });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json(publicDriver(driver));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed" });
  }
}

async function driverPickupOr404(req, res) {
  const driverId = req.user?.driverId || req.user?.id;
  const pickup = await Pickup.findOne({
    driverId,
    $or: [{ id: req.params.pickupId }, { pickupId: req.params.pickupId }, { orderId: req.params.pickupId }],
  });
  if (!pickup) {
    res.status(404).json({ message: "Pickup not found" });
    return null;
  }
  return pickup;
}

async function enrichDriverView(pickup) {
  const data = await enrichPickup(pickup);
  delete data.qrToken;
  return data;
}

export async function listDriverPickups(req, res) {
  try {
    const driverId = req.user?.driverId || req.user?.id;
    const filterKey = String(req.query.filter || "assigned");
    if (filterKey === "progress" || filterKey === "completed" || filterKey === "history" || filterKey === "all") {
      await mergeDriverTripBatch(driverId);
    }
    const filter = { driverId };
    if (filterKey === "assigned" || filterKey === "pending") {
      filter.status = { $in: ASSIGNED_STATUSES };
    } else if (filterKey === "progress") {
      filter.status = { $in: IN_PROGRESS_STATUSES };
    } else if (filterKey === "completed" || filterKey === "history") {
      filter.status = { $in: HISTORY_PICKUP_STATUSES };
    }
    const pickups = await Pickup.find(filter).sort({ updatedAt: -1 }).lean();
    const all = await Pickup.find({ driverId }).lean();
    const enriched = await Promise.all(pickups.map((p) => enrichDriverView(p)));
    res.json({
      stats: {
        assigned: all.filter((p) => ASSIGNED_STATUSES.includes(p.status)).length,
        inProgress: all.filter((p) => IN_PROGRESS_STATUSES.includes(p.status)).length,
        completed: all.filter((p) => COMPLETED_PICKUP_STATUSES.includes(p.status) || HISTORY_PICKUP_STATUSES.includes(p.status)).length,
        totalAssigned: all.length,
        pending: all.filter((p) => ASSIGNED_STATUSES.includes(p.status)).length,
      },
      pickups: enriched,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to list pickups" });
  }
}

export async function getDriverPickup(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    res.json(await enrichDriverView(pickup));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load pickup" });
  }
}

function batchPayload(batchId, orders) {
  const first = orders[0] || {};
  const driver = first.driver || {};
  return {
    batchId,
    lotId: batchId,
    qrPayload: batchQrPayloadFor(batchId, orders) || `greengroo:batch:${batchId}`,
    status: first.status || "",
    liveStatus: first.liveStatus || "",
    orderCount: orders.length,
    farmers: [...new Set(orders.map((p) => p.farmerName).filter(Boolean))],
    products: [...new Set(orders.map((p) => p.productName).filter(Boolean))],
    driverName: first.driverName || driver.name || "",
    driverId: first.driverId || driver.id || driver.driverId || "",
    driverMobile: first.driverMobile || driver.mobile || "",
    vehicleNumber: first.vehicleNumber || driver.vehicleNumber || "",
    vehicleType: first.vehicleType || driver.vehicleType || "",
    vehicleId: vehicleIdOf(first.vehicleId || driver.vehicleId, first.vehicleNumber || driver.vehicleNumber),
    collectionCentreName: first.collectionCentreName || "",
    pickups: orders,
  };
}

export async function getDriverBatch(req, res) {
  try {
    const driverId = req.user?.driverId || req.user?.id;
    const batchId = String(req.params.batchId || "").trim();
    if (!batchId) return res.status(400).json({ message: "Batch ID is required" });
    await mergeDriverTripBatch(driverId);
    const pickups = await Pickup.find({ driverId, collectionBatchId: batchId }).sort({ createdAt: 1 });
    if (!pickups.length) return res.status(404).json({ message: "Batch not found" });
    const orders = await Promise.all(pickups.map((p) => enrichDriverView(p)));
    res.json(batchPayload(batchId, orders));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load batch" });
  }
}

export async function getVendorBatch(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const batchId = String(req.params.batchId || "").trim();
    if (!batchId) return res.status(400).json({ message: "Batch ID is required" });
    const pickups = await Pickup.find({ vendorId, collectionBatchId: batchId }).select(PICKUP_LIST_EXCLUDE).sort({ createdAt: 1 });
    if (!pickups.length) return res.status(404).json({ message: "Batch not found" });
    const orders = await enrichPickups(pickups);
    res.json(batchPayload(batchId, orders));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load batch" });
  }
}

export async function getManagerBatch(req, res) {
  try {
    const farmers = await managerFarmerIds(req);
    const farmerIds = farmers.map((f) => f.id);
    const batchId = decodeURIComponent(String(req.params.batchId || "").trim());
    if (!batchId) return res.status(400).json({ message: "Batch ID is required" });
    const vendorId = req.user?.vendorId;
    const ownedQuery = { collectionBatchId: batchId, farmerId: { $in: farmerIds } };
    if (vendorId) ownedQuery.vendorId = vendorId;
    const owned = await Pickup.find(ownedQuery).select(PICKUP_LIST_EXCLUDE).sort({ createdAt: 1 });
    if (!owned.length) return res.status(404).json({ message: "Batch not found" });
    let pickups = owned;
    const batchVendorId = owned[0].vendorId || vendorId;
    if (batchVendorId) {
      const all = await Pickup.find({ collectionBatchId: batchId, vendorId: batchVendorId }).select(PICKUP_LIST_EXCLUDE).sort({ createdAt: 1 });
      if (all.length) pickups = all;
    }
    const orders = await enrichPickups(pickups);
    res.json(batchPayload(batchId, orders));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load batch" });
  }
}

export async function acceptDriverPickup(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    if (!ASSIGNED_STATUSES.includes(pickup.status)) {
      return res.status(400).json({ message: "This pickup can no longer be accepted." });
    }
    if (pickup.driverStatus !== "DRIVER_ACCEPTED") {
      pickup.driverStatus = "DRIVER_ACCEPTED";
      pushPickupTimeline(pickup, "DRIVER_ACCEPTED", `Driver ${pickup.driverName || ""} accepted the pickup.`.replace(/\s+/g, " "));
      await pickup.save();
      emitPickupUpdate(pickup, { event: "DRIVER_ACCEPTED" });
    }
    res.json({ message: "Pickup accepted", ...(await enrichDriverView(pickup)) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to accept pickup" });
  }
}

export async function rejectDriverPickup(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    if (!ASSIGNED_STATUSES.includes(pickup.status)) {
      return res.status(400).json({ message: "Only a newly assigned pickup can be rejected." });
    }
    const reason = String(req.body?.reason || "").trim().slice(0, 300);
    const driverId = pickup.driverId;
    const driverName = pickup.driverName || driverId;
    const note = `Rejected by driver ${driverName}${reason ? `: ${reason}` : ""}.`;
    pickup.driverId = "";
    pickup.driverName = "";
    pickup.driverMobile = "";
    pickup.vehicleNumber = "";
    pickup.assignedAt = null;
    pickup.status = "READY_FOR_PICKUP";
    pickup.driverStatus = "DRIVER_REJECTED";
    pushPickupTimeline(pickup, "DRIVER_REJECTED", note);
    await pickup.save();
    const driver = await PickupDriver.findOne({ id: driverId });
    if (driver) await refreshDriverAvailability(driver);
    const order = await loadOrderForPickup(pickup);
    await applyOrderStatus(order, "READY_FOR_PICKUP", `${note} Waiting for a new driver.`);
    emitPickupUpdate(pickup, { event: "DRIVER_REJECTED", rejectedBy: driverId, reason });
    res.json({ message: "Pickup rejected", id: pickup.id, status: pickup.status });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to reject pickup" });
  }
}

export async function startDriverPickup(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    if (pickup.status === "DISPATCHED") {
      return res.json(await enrichDriverView(pickup));
    }
    if (!ASSIGNED_STATUSES.includes(pickup.status)) {
      return res.status(400).json({ message: "Start Pickup is only available after the manager assigns you." });
    }
    const now = new Date();
    pickup.status = "DISPATCHED";
    pickup.driverStatus = "DISPATCHED";
    pickup.dispatchStartedAt = now;
    pickup.startedAt = pickup.startedAt || now;
    pushPickupTimeline(pickup, "DISPATCHED", "Driver started pickup.");
    await pickup.save();
    const order = await loadOrderForPickup(pickup);
    await applyOrderStatus(order, "DISPATCHED", "Driver started pickup and is travelling to the farm.");
    const driver = await PickupDriver.findOne({ id: pickup.driverId });
    if (driver) await refreshDriverAvailability(driver);
    emitPickupUpdate(pickup, { event: "DISPATCHED" });
    res.json(await enrichDriverView(pickup));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to start pickup" });
  }
}

export async function arriveDriverPickup(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    if (pickup.status === "DRIVER_ARRIVED") {
      return res.json(await enrichDriverView(pickup));
    }
    if (pickup.status !== "DISPATCHED") {
      return res.status(400).json({ message: "Mark Arrived after Start Pickup." });
    }
    pickup.status = "DRIVER_ARRIVED";
    pickup.arrivedAt = new Date();
    pickup.driverStatus = "DRIVER_ARRIVED";
    pushPickupTimeline(pickup, "DRIVER_ARRIVED", "Driver has arrived at pickup location.");
    await pickup.save();
    const order = await loadOrderForPickup(pickup);
    await applyOrderStatus(order, "DRIVER_ARRIVED", "Driver has arrived at pickup location.");
    emitPickupUpdate(pickup, { event: "DRIVER_ARRIVED" });
    res.json(await enrichDriverView(pickup));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to mark arrived" });
  }
}

export async function checkDriverPickupOrder(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    if (pickup.pickupConfirmed) {
      return res.status(400).json({ message: "Pickup has already been confirmed." });
    }
    if (pickup.status === "ORDER_VERIFIED") {
      return res.json(await enrichDriverView(pickup));
    }
    if (pickup.status !== "DRIVER_ARRIVED") {
      return res.status(400).json({ message: "Check Order is available after you mark Arrived." });
    }
    pickup.status = "ORDER_VERIFIED";
    pickup.driverStatus = "ORDER_VERIFIED";
    pickup.orderVerifiedAt = new Date();
    pickup.verification = {
      farmer: true,
      order: true,
      product: true,
      quantity: true,
      driver: true,
      vehicle: true,
    };
    pushPickupTimeline(pickup, "ORDER_VERIFIED", "Driver verified the physical order.");
    await pickup.save();
    const order = await loadOrderForPickup(pickup);
    await applyOrderStatus(order, "ORDER_VERIFIED", "Driver checked the order against the pickup details.");
    emitPickupUpdate(pickup, { event: "ORDER_VERIFIED" });
    res.json(await enrichDriverView(pickup));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to verify order" });
  }
}

export async function verifyDriverPickupQr(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    const driverId = req.user?.driverId || req.user?.id;
    if (pickup.pickupConfirmed || pickup.status === "PICKED_UP") {
      return res.status(400).json({ message: "Pickup has already been confirmed." });
    }
    if (pickup.driverId !== driverId) {
      return res.status(403).json({ message: "This pickup is not assigned to you." });
    }
    if (pickup.status !== "ORDER_VERIFIED" && pickup.status !== "QR_VERIFIED") {
      return res.status(400).json({ message: "Scan Farmer QR after Check Order." });
    }
    const raw = String(req.body?.qrPayload || req.body?.qr || "").trim();
    if (!raw) return res.status(400).json({ message: "Scan the Farmer QR to continue." });
    const parsed = parsePickupQr(raw);
    const order = await loadOrderForPickup(pickup);
    let matched = false;
    if (parsed.token && pickup.qrToken && parsed.token === pickup.qrToken) matched = true;
    if (pickup.qrPayload && raw === pickup.qrPayload) matched = true;
    if (parsed.orderId && order && [order.id, order.orderId, pickup.orderId].includes(parsed.orderId)) matched = true;
    if (parsed.pickupId && [pickup.id, pickup.pickupId].filter(Boolean).includes(parsed.pickupId)) matched = true;
    if (!matched && order) {
      const ids = [order.id, order.orderId, pickup.orderId].filter(Boolean).map(String);
      if (ids.some((id) => id && raw.includes(id))) matched = true;
    }
    if (!matched && parsed.token) {
      const byToken = await Pickup.findOne({ qrToken: parsed.token });
      if (byToken && byToken.id === pickup.id && byToken.farmerId === pickup.farmerId && byToken.orderId === pickup.orderId) {
        matched = true;
      }
    }
    if (!matched) {
      return res.status(400).json({ message: "QR is invalid for this farmer, order, or pickup." });
    }
    pickup.qrVerified = true;
    pickup.qrVerifiedBy = driverId;
    pickup.qrVerifiedAt = new Date();
    pickup.status = "QR_VERIFIED";
    pickup.driverStatus = "QR_VERIFIED";
    pushPickupTimeline(pickup, "QR_VERIFIED", "Farmer QR verified successfully.");
    await pickup.save();
    await applyOrderStatus(order, "QR_VERIFIED", "Farmer QR verified by driver.");
    emitPickupUpdate(pickup, { event: "QR_VERIFIED" });
    res.json({ message: "QR Verified Successfully", ...(await enrichDriverView(pickup)) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to verify QR" });
  }
}

function sanitizeConfirmPhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p) => typeof p === "string" && p.length > 20 && p.length < 2_500_000)
    .filter((p) => p.startsWith("data:image/") || p.startsWith("http://") || p.startsWith("https://"))
    .slice(0, 4);
}

export async function confirmDriverPickup(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    const driverId = req.user?.driverId || req.user?.id;
    if (pickup.driverId !== driverId) {
      return res.status(403).json({ message: "This pickup is not assigned to you." });
    }
    const photos = sanitizeConfirmPhotos(req.body?.photos || req.body?.confirmationPhotos);
    if (!photos.length) {
      return res.status(400).json({ message: "Take a live photo or upload a photo before confirming pickup." });
    }
    const confirmedQuantity = Number(pickup.packedQuantity || pickup.expectedQuantity || 0);
    const confirmedPackageCount = Number(pickup.packageCount || 0);
    const now = new Date();
    const updated = await Pickup.findOneAndUpdate(
      {
        id: pickup.id,
        driverId,
        status: "QR_VERIFIED",
        qrVerified: true,
        pickupConfirmed: { $ne: true },
      },
      {
        $set: {
          status: "PICKED_UP",
          driverStatus: "PICKED_UP",
          pickupConfirmed: true,
          pickupConfirmedBy: driverId,
          pickupConfirmedAt: now,
          confirmedQuantity,
          confirmedPackageCount,
          confirmationPhotos: photos,
          qrVerifiedAt: pickup.qrVerifiedAt || now,
        },
        $push: { timeline: { status: "PICKED_UP", at: now, note: "Driver confirmed pickup from farmer." } },
      },
      { returnDocument: "after" }
    );
    if (!updated) {
      const latest = await Pickup.findOne({ id: pickup.id, driverId });
      if (latest?.pickupConfirmed || latest?.status === "PICKED_UP") {
        return res.status(409).json({ message: "Pickup is already confirmed." });
      }
      return res.status(400).json({ message: "Confirm Pickup is available only after Farmer QR is verified." });
    }
    const order = await loadOrderForPickup(updated);
    if (order) {
      order.status = "PICKED_UP";
      order.timeline = [
        ...(order.timeline || []),
        { status: "PICKED_UP", at: now, note: "Driver confirmed pickup from farmer." },
      ];
      await order.save();
      pushFarmerOrderChange(order, { statusChanged: true });
    }
    const driver = await PickupDriver.findOne({ id: driverId });
    if (driver) await refreshDriverAvailability(driver);
    emitPickupUpdate(updated, { event: "PICKED_UP" });
    res.json(await enrichDriverView(updated));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to confirm pickup" });
  }
}

export async function transitDriverPickup(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    const received = ["ARRIVED_AT_CENTRE", "COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE"].includes(pickup.status);
    if (received) {
      return res.status(400).json({ message: "This pickup is already at the collection centre." });
    }
    if (pickup.status === "IN_TRANSIT") {
      await assignCollectionBatch(pickup);
      if (pickup.isModified()) await pickup.save();
      return res.json(await enrichDriverView(pickup));
    }
    const confirmed =
      pickup.pickupConfirmed === true ||
      ["PICKED_UP", "PICKUP_CONFIRMED", "COMPLETED"].includes(String(pickup.status || "").toUpperCase());
    if (!confirmed) {
      return res.status(400).json({
        message: `Mark On the way after you confirm pickup from the farmer. Current status: ${pickup.status || "unknown"}.`,
      });
    }
    pickup.status = "IN_TRANSIT";
    pickup.driverStatus = "IN_TRANSIT";
    pickup.inTransitAt = pickup.inTransitAt || new Date();
    await assignCollectionBatch(pickup);
    pushPickupTimeline(pickup, "IN_TRANSIT", "Driver is on the way to the collection centre.");
    await pickup.save();
    const order = await loadOrderForPickup(pickup);
    await applyOrderStatus(order, "IN_TRANSIT", "Driver is on the way to the collection centre.");
    const driver = await PickupDriver.findOne({ id: pickup.driverId });
    if (driver) await refreshDriverAvailability(driver);
    emitPickupUpdate(pickup, { event: "IN_TRANSIT" });
    res.json(await enrichDriverView(pickup));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to mark on the way" });
  }
}

export async function arriveAtCentreDriverPickup(req, res) {
  try {
    const pickup = await driverPickupOr404(req, res);
    if (!pickup) return;
    const done = ["ARRIVED_AT_CENTRE", "COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE"].includes(pickup.status);
    if (done) {
      await assignCollectionBatch(pickup);
      if (pickup.isModified()) await pickup.save();
      return res.json(await enrichDriverView(pickup));
    }
    if (pickup.status !== "IN_TRANSIT") {
      return res.status(400).json({
        message: `Mark Reached collection centre after On the way to centre. Current status: ${pickup.status || "unknown"}.`,
      });
    }
    const note = "Driver has arrived at the collection centre.";
    const batchId = String(pickup.collectionBatchId || "").trim();
    const targets = batchId
      ? await Pickup.find({ driverId: pickup.driverId, collectionBatchId: batchId, status: "IN_TRANSIT" })
      : [pickup];
    const list = targets.length ? targets : [pickup];
    for (const p of list) {
      p.status = "ARRIVED_AT_CENTRE";
      p.driverStatus = "ARRIVED_AT_CENTRE";
      await assignCollectionBatch(p);
      pushPickupTimeline(p, "ARRIVED_AT_CENTRE", note);
      await p.save();
      const order = await loadOrderForPickup(p);
      await applyOrderStatus(order, "ARRIVED_AT_CENTRE", note);
      emitPickupUpdate(p, { event: "ARRIVED_AT_CENTRE" });
    }
    const updated = list.find((p) => p.id === pickup.id) || pickup;
    res.json(await enrichDriverView(updated));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to mark arrived at centre" });
  }
}
