import mongoose from "mongoose";
import StoreOrder from "../models/StoreOrder.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import EcommerceOrder from "../../../legacy/models/order/Order.js";
import {
  deriveCustomerOrderType,
  deriveOrderType,
  isTrackableOrderType,
} from "../../../legacy/utils/departmentHelpers.js";
import { getIO } from "../../../socket.js";
import { clearRouteCache, getRouteAndEta, getRouteViaStop, toPoint } from "./directionsService.js";
import { isVendorConfirmed, preOrderProgressInfo, buildPreOrderTimeline } from "./preOrderProgress.js";

/** Rider has the parcel. */
export const LIVE_TRACKING_STATUSES = ["pickup_verified", "out_for_delivery"];
/** Rider's GPS is streamed and shown from assignment (riding to the store) until delivery. */
export const RIDER_EN_ROUTE_STATUSES = ["assigned", ...LIVE_TRACKING_STATUSES];

/** "to_store" while the rider rides to the dark store, "to_customer" once it has the parcel. */
export function riderPhaseOf(status) {
  if (LIVE_TRACKING_STATUSES.includes(status)) return "to_customer";
  if (RIDER_EN_ROUTE_STATUSES.includes(status)) return "to_store";
  return null;
}
export const CLOSED_STATUSES = ["delivered", "cancelled", "delivery_failed"];
export const ROUTE_REFRESH_SECONDS = 45;

const LOCATION_DB_WRITE_MS = 12_000;
const RIDER_LOCATION_MAX_AGE_MS = 3 * 60_000;
const STATUS_DEDUPE_MS = 3000;
const MAX_TRACKED_KEYS = 5000;

const ADMIN_ROLES = new Set(["admin", "super_admin", "superadmin"]);

export const TIMELINE_STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "confirmed", label: "Order confirmed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];
const TIMELINE_INDEX = Object.fromEntries(TIMELINE_STEPS.map((step, i) => [step.key, i]));

const TIMELINE_KEY_BY_STORE_STATUS = {
  preorder_hold: "confirmed",
  preorder_vendor_confirmed: "confirmed",
  preorder_preparing: "confirmed",
  preorder_at_store: "packed",
  incoming: "confirmed",
  order_received: "confirmed",
  stock_issue: "confirmed",
  packed: "packed",
  offered: "packed",
  assigned: "packed",
  pickup_verified: "packed",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
  delivery_failed: "cancelled",
};

const TIMELINE_KEY_BY_CUSTOMER_STATUS = {
  attempted: "placed",
  confirm: "confirmed",
  processing: "packed",
  shipping: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
  return: "cancelled",
};

const latestLocations = new Map();
const lastDbWriteAt = new Map();
const closedOrders = new Set();
const recentStatusEmits = new Map();

function remember(collection, key, value) {
  if (collection.size >= MAX_TRACKED_KEYS) {
    const oldest = collection.keys().next().value;
    collection.delete(oldest);
  }
  if (collection instanceof Set) collection.add(key);
  else collection.set(key, value);
}

const idOf = (value) => (value ? String(value._id || value) : "");

export const isAdminRole = (role) => ADMIN_ROLES.has(String(role || "").toLowerCase());
export const orderRoom = (customerOrderId) => `order_${customerOrderId}`;

export function resolveStoreOrderType(storeOrder) {
  return deriveOrderType(storeOrder || {});
}

export function resolveCustomerOrderType(customerOrder) {
  return customerOrder?.orderType || deriveCustomerOrderType(customerOrder || {});
}

/** Live map is offered only for ready_to_cook / instant home deliveries. */
export function isStoreOrderTrackable(storeOrder) {
  if (!storeOrder || storeOrder.fulfillmentType === "pickup") return false;
  return isTrackableOrderType(resolveStoreOrderType(storeOrder));
}

export function timelineKeyForStoreStatus(status) {
  return TIMELINE_KEY_BY_STORE_STATUS[status] || "confirmed";
}

/** A held pre-order stays "placed" for the customer until the vendor confirms it. */
export function timelineKeyForStoreOrder(storeOrder, status = storeOrder?.status) {
  if (storeOrder?.isPreOrder && status === "preorder_hold" && !isVendorConfirmed(storeOrder)) {
    return "placed";
  }
  return timelineKeyForStoreStatus(status);
}

export function timelineKeyForCustomerStatus(status) {
  return TIMELINE_KEY_BY_CUSTOMER_STATUS[status] || "placed";
}

/** Room id for a store order: the customer order, so every part shares one room. */
export function customerOrderIdOf(storeOrder) {
  return idOf(storeOrder?.sourceOrderId) || idOf(storeOrder);
}

// ── Closed orders / location state ───────────────────────────────────────────

export function markOrderClosed(storeOrderId) {
  const id = idOf(storeOrderId);
  if (!id) return;
  remember(closedOrders, id);
  latestLocations.delete(id);
  lastDbWriteAt.delete(id);
  clearRouteCache(`order:${id}`);
}

export function isOrderClosed(storeOrderId) {
  return closedOrders.has(idOf(storeOrderId));
}

function locationFromDoc(storeOrder) {
  const coords = storeOrder?.driverLocation?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  return {
    lat: coords[1],
    lng: coords[0],
    heading: storeOrder.driverLocation.heading ?? null,
    speed: storeOrder.driverLocation.speed ?? null,
    updatedAt: storeOrder.driverLocation.updatedAt || null,
  };
}

/** Freshest known rider position for an order: memory → order doc → rider profile. */
export function getLatestLocation(storeOrder, rider = null) {
  const live = latestLocations.get(idOf(storeOrder));
  if (live) return live;
  const stored = locationFromDoc(storeOrder);
  if (stored) return stored;
  const current = rider?.currentLocation;
  if (current?.lat != null && current?.lng != null && current.updatedAt) {
    const age = Date.now() - new Date(current.updatedAt).getTime();
    if (age <= RIDER_LOCATION_MAX_AGE_MS) {
      return { lat: current.lat, lng: current.lng, heading: null, speed: null, updatedAt: current.updatedAt };
    }
  }
  return null;
}

/**
 * Broadcast a rider GPS fix to the customer's order room (every fix) and persist it
 * on the order as GeoJSON at most once every 12 s.
 */
export async function recordDriverLocation({ storeOrder, rider, lat, lng, heading = null, speed = null }) {
  const storeOrderId = idOf(storeOrder);
  const customerOrderId = customerOrderIdOf(storeOrder);
  const now = new Date();
  const location = {
    lat,
    lng,
    heading: Number.isFinite(heading) ? heading : null,
    speed: Number.isFinite(speed) ? speed : null,
    updatedAt: now.toISOString(),
  };
  remember(latestLocations, storeOrderId, location);

  try {
    const io = getIO();
    const rooms = io.to(orderRoom(customerOrderId));
    if (storeOrderId && storeOrderId !== customerOrderId) {
      rooms.to(orderRoom(storeOrderId));
    }
    rooms.emit("location_update", {
      orderId: customerOrderId,
      storeOrderId,
      ...location,
    });
    if (storeOrder.managerId) {
      io.to(`store_${storeOrder.managerId}`).emit("rider_location_updated", {
        riderId: idOf(rider),
        name: rider?.name || rider?.phone || "",
        status: "on_delivery",
        activeOrderId: storeOrderId,
        location: { lat, lng, updatedAt: location.updatedAt },
      });
    }
  } catch (err) {
    console.warn("[tracking] location broadcast failed:", err.message);
  }

  const last = lastDbWriteAt.get(storeOrderId) || 0;
  if (Date.now() - last < LOCATION_DB_WRITE_MS) return { persisted: false };
  remember(lastDbWriteAt, storeOrderId, Date.now());

  try {
    await Promise.all([
      StoreOrder.updateOne(
        { _id: storeOrderId, status: { $in: RIDER_EN_ROUTE_STATUSES } },
        {
          $set: {
            driverLocation: {
              type: "Point",
              coordinates: [lng, lat],
              heading: location.heading,
              speed: location.speed,
              riderId: rider?._id || null,
              updatedAt: now,
            },
          },
        },
        { timestamps: false }
      ),
      rider?._id
        ? DeliveryBoy.updateOne(
            { _id: rider._id },
            { $set: { currentLocation: { lat, lng, updatedAt: now }, lastSeenAt: now } },
            { timestamps: false }
          )
        : null,
    ]);
    return { persisted: true };
  } catch (err) {
    lastDbWriteAt.delete(storeOrderId);
    console.warn("[tracking] location persist failed:", err.message);
    return { persisted: false };
  }
}

/** Customer drop point of a store order, from the order or its customer order. */
export async function storeOrderDestination(storeOrder, customerOrder = null) {
  const direct = toPoint({ lat: storeOrder?.customerLat, lng: storeOrder?.customerLng });
  if (direct) return direct;
  const source =
    customerOrder ||
    (storeOrder?.sourceOrderId
      ? await EcommerceOrder.findById(storeOrder.sourceOrderId).select("deliveryAddress").lean()
      : null);
  return toPoint(source?.deliveryAddress?.location) || toPoint(source?.deliveryAddress) || null;
}

/**
 * Save the ETA promised at dispatch (store → customer) once, so the delay can be
 * measured against it while live and after delivery.
 */
export async function recordDispatchEta(storeOrder, { origin = null } = {}) {
  if (!storeOrder?._id || storeOrder.dispatchEta?.expectedAt) return storeOrder?.dispatchEta || null;
  try {
    const [manager, destination] = await Promise.all([
      origin ? null : DeliveryManager.findById(storeOrder.managerId).select("latitude longitude").lean(),
      storeOrderDestination(storeOrder),
    ]);
    const from = toPoint(origin) || toPoint(manager);
    if (!from || !destination) return null;
    const route = await getRouteAndEta({ origin: from, destination });
    if (!route?.etaSeconds) return null;

    const startedAt = storeOrder.pickupVerifiedAt || storeOrder.pickupProofApprovedAt || new Date();
    const dispatchEta = {
      seconds: route.etaSeconds,
      distanceMeters: route.distanceMeters ?? null,
      expectedAt: new Date(new Date(startedAt).getTime() + route.etaSeconds * 1000),
      computedAt: new Date(),
      source: route.source || "",
    };
    await StoreOrder.updateOne(
      { _id: storeOrder._id, "dispatchEta.expectedAt": { $in: [null] } },
      { $set: { dispatchEta } },
      { timestamps: false }
    );
    storeOrder.dispatchEta = dispatchEta;
    return dispatchEta;
  } catch (err) {
    console.warn("[tracking] dispatch ETA failed:", err.message);
    return null;
  }
}

// ── Order status events ──────────────────────────────────────────────────────

export function buildStatusPayload(storeOrder, storeStatus = storeOrder?.status) {
  const trackingEnabled = isStoreOrderTrackable(storeOrder);
  return {
    orderId: customerOrderIdOf(storeOrder),
    storeOrderId: idOf(storeOrder),
    part: storeOrder.sourcePart || "",
    orderType: resolveStoreOrderType(storeOrder),
    status: timelineKeyForStoreOrder(storeOrder, storeStatus),
    storeStatus,
    ...(storeOrder.isPreOrder
      ? {
          preOrderProgress: preOrderProgressInfo(storeOrder),
          preOrderTimeline: buildPreOrderTimeline(storeOrder),
        }
      : {}),
    trackingEnabled,
    liveTracking: trackingEnabled && RIDER_EN_ROUTE_STATUSES.includes(storeStatus),
    riderPhase: trackingEnabled ? riderPhaseOf(storeStatus) : null,
    at: new Date().toISOString(),
  };
}

function alreadyEmitted(key) {
  const last = recentStatusEmits.get(key);
  if (last && Date.now() - last < STATUS_DEDUPE_MS) return true;
  remember(recentStatusEmits, key, Date.now());
  return false;
}

/** `order_status` to the customer's order room, for every order type. */
export function emitOrderStatus(storeOrder, storeStatus = storeOrder?.status) {
  if (!storeOrder || !storeStatus) return;
  if (CLOSED_STATUSES.includes(storeStatus)) markOrderClosed(storeOrder);
  if (alreadyEmitted(`${idOf(storeOrder)}:${storeStatus}`)) return;
  try {
    const payload = buildStatusPayload(storeOrder, storeStatus);
    const rooms = getIO().to(orderRoom(payload.orderId));
    if (payload.storeOrderId && payload.storeOrderId !== payload.orderId) {
      rooms.to(orderRoom(payload.storeOrderId));
    }
    rooms.emit("order_status", payload);
  } catch (err) {
    console.warn("[tracking] order_status emit failed:", err.message);
  }
}

/** Status change on a customer order that has no store order yet (or an admin edit). */
export function emitCustomerOrderStatus(customerOrder) {
  if (!customerOrder?._id || !customerOrder.status) return;
  const orderId = idOf(customerOrder);
  if (alreadyEmitted(`customer:${orderId}:${customerOrder.status}`)) return;
  const orderType = resolveCustomerOrderType(customerOrder);
  const trackingEnabled = isTrackableOrderType(orderType) && customerOrder.fulfillmentType !== "pickup";
  try {
    getIO().to(orderRoom(orderId)).emit("order_status", {
      orderId,
      storeOrderId: null,
      part: "",
      orderType,
      status: timelineKeyForCustomerStatus(customerOrder.status),
      customerStatus: customerOrder.status,
      trackingEnabled,
      liveTracking: false,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[tracking] customer order_status emit failed:", err.message);
  }
}

// ── Access checks ────────────────────────────────────────────────────────────

/**
 * Resolve an id the customer app sent (customer order id, or a store order id)
 * to the customer order, and check that it belongs to `identity`.
 */
export async function resolveCustomerOrderForViewer(id, identity) {
  if (!id || !mongoose.isValidObjectId(id)) {
    return { ok: false, statusCode: 400, code: "INVALID_ID", message: "Invalid order id" };
  }
  let customerOrder = await EcommerceOrder.findById(id);
  let requestedStoreOrder = null;
  if (!customerOrder) {
    requestedStoreOrder = await StoreOrder.findById(id);
    if (requestedStoreOrder?.sourceOrderId) {
      customerOrder = await EcommerceOrder.findById(requestedStoreOrder.sourceOrderId);
    }
  }
  if (!customerOrder) {
    return { ok: false, statusCode: 404, code: "NOT_FOUND", message: "Order not found" };
  }
  const owner = String(customerOrder.user || "") === String(identity?.id || "");
  if (!owner && !isAdminRole(identity?.role)) {
    return { ok: false, statusCode: 403, code: "FORBIDDEN", message: "This order does not belong to you" };
  }
  return { ok: true, customerOrder, requestedStoreOrder };
}

/** Can this rider stream GPS for this order right now? */
export async function authorizeDriverForOrder({ riderId, orderId }) {
  if (!orderId || !mongoose.isValidObjectId(orderId)) {
    return { ok: false, code: "INVALID_ID", message: "Invalid order id" };
  }
  let storeOrder = await StoreOrder.findById(orderId);
  if (!storeOrder) {
    // The app may send the customer order id; pick this rider's part of it.
    storeOrder = await StoreOrder.findOne({ sourceOrderId: orderId, assignedRiderId: riderId }).sort({
      updatedAt: -1,
    });
  }
  if (!storeOrder) return { ok: false, code: "NOT_FOUND", message: "Order not found" };
  if (String(storeOrder.assignedRiderId || "") !== String(riderId)) {
    return { ok: false, code: "NOT_ASSIGNED", message: "You are not assigned to this order" };
  }
  if (!isStoreOrderTrackable(storeOrder)) {
    return { ok: false, code: "NOT_TRACKABLE", message: "Live tracking is off for pre-orders and pickups" };
  }
  if (CLOSED_STATUSES.includes(storeOrder.status)) {
    markOrderClosed(storeOrder);
    return { ok: false, code: "ORDER_CLOSED", message: "Order is already closed" };
  }
  if (!RIDER_EN_ROUTE_STATUSES.includes(storeOrder.status)) {
    return { ok: false, code: "NOT_PICKED_UP", message: "Tracking starts once the order is assigned to you" };
  }
  return { ok: true, storeOrder };
}

// ── Tracking snapshot (GET /api/orders/:id/tracking) ─────────────────────────

function pickPrimaryPart(storeOrders, part) {
  if (!storeOrders.length) return null;
  if (part) {
    const match = storeOrders.find((row) => (row.sourcePart || "") === part);
    if (match) return match;
  }
  const open = storeOrders.filter((row) => !CLOSED_STATUSES.includes(row.status));
  return (
    open.find((row) => isStoreOrderTrackable(row)) ||
    open[0] ||
    storeOrders.find((row) => row.sourcePart !== "preorder") ||
    storeOrders[0]
  );
}

function stepTime(key, customerOrder, storeOrder) {
  switch (key) {
    case "placed":
      return customerOrder?.createdAt || storeOrder?.createdAt || null;
    case "confirmed":
      return (storeOrder?.isPreOrder && storeOrder.vendorConfirmedAt) || storeOrder?.createdAt || null;
    case "packed":
      return storeOrder?.packedAt || storeOrder?.readyAt || null;
    case "out_for_delivery":
      return storeOrder?.pickupProofApprovedAt || storeOrder?.pickupVerifiedAt || null;
    case "delivered":
      return storeOrder?.deliveredAt || null;
    default:
      return null;
  }
}

export function buildTimeline({ customerOrder, storeOrder, statusKey }) {
  if (statusKey === "cancelled") {
    return [
      { key: "placed", label: "Order placed", done: true, current: false, at: stepTime("placed", customerOrder, storeOrder) },
      { key: "cancelled", label: "Cancelled", done: true, current: true, at: storeOrder?.updatedAt || customerOrder?.updatedAt || null },
    ];
  }
  const reached = TIMELINE_INDEX[statusKey] ?? 0;
  return TIMELINE_STEPS.map((step, index) => ({
    ...step,
    done: index <= reached,
    current: index === reached,
    at: index <= reached ? stepTime(step.key, customerOrder, storeOrder) : null,
  }));
}

function preOrderInfo(storeOrder, customerOrder) {
  const progress = storeOrder ? preOrderProgressInfo(storeOrder) : null;
  return {
    date: storeOrder?.preOrderDate || customerOrder?.preOrderDate || "",
    slot: storeOrder?.preOrderSlot || customerOrder?.preOrderSlot || "",
    progress: progress?.key || customerOrder?.preOrderProgress || "",
    progressLabel: progress?.label || "",
    progressStep: progress?.step ?? -1,
    progressSteps: progress?.steps || [],
  };
}

/** Only delays the manager chose to forward are shown to the customer. */
function customerDelayInfo(storeOrder, closed) {
  const delay = storeOrder?.deliveryDelay;
  if (closed || !delay?.customerNotifiedAt || !(delay.minutes > 0)) return null;
  return {
    minutes: delay.minutes,
    expectedBy: delay.expectedBy || null,
    notifiedAt: delay.customerNotifiedAt,
  };
}

export async function buildTrackingSnapshot({ customerOrder, storeOrders = [], part = "" }) {
  const primary = pickPrimaryPart(storeOrders, part);
  const orderType = primary ? resolveStoreOrderType(primary) : resolveCustomerOrderType(customerOrder);
  const isPickup = (primary?.fulfillmentType || customerOrder?.fulfillmentType) === "pickup";
  const trackingEnabled = isTrackableOrderType(orderType) && !isPickup;
  const statusKey = primary
    ? timelineKeyForStoreOrder(primary)
    : timelineKeyForCustomerStatus(customerOrder?.status);
  const closed = statusKey === "delivered" || statusKey === "cancelled";
  const liveTracking = Boolean(
    trackingEnabled && primary?.assignedRiderId && RIDER_EN_ROUTE_STATUSES.includes(primary.status)
  );
  const riderPhase = liveTracking ? riderPhaseOf(primary.status) : null;

  const contactOpen = !closed && primary?.status !== "delivery_failed";
  const [rider, manager] = await Promise.all([
    contactOpen && primary?.assignedRiderId
      ? DeliveryBoy.findById(primary.assignedRiderId).select("name phone vehicleType currentLocation").lean()
      : null,
    trackingEnabled && primary?.managerId
      ? DeliveryManager.findById(primary.managerId).select("storeName latitude longitude").lean()
      : null,
  ]);

  const storePoint = toPoint(manager);
  const store = manager ? { name: manager.storeName || "Dark store", ...(storePoint || {}) } : null;
  const destination = trackingEnabled
    ? toPoint({ lat: primary?.customerLat, lng: primary?.customerLng }) ||
      toPoint(customerOrder?.deliveryAddress?.location) ||
      toPoint(customerOrder?.deliveryAddress)
    : null;

  const lastLocation = liveTracking ? getLatestLocation(primary, rider) : null;
  let eta = null;
  let route = null;
  if (trackingEnabled && !closed && destination) {
    const cacheKey = `order:${idOf(primary) || idOf(customerOrder)}`;
    const viaStore = riderPhase === "to_store" && lastLocation && storePoint;
    const origin = lastLocation || storePoint;
    const result = viaStore
      ? await getRouteViaStop({ cacheKey, origin: lastLocation, stop: storePoint, destination })
      : origin
        ? await getRouteAndEta({ cacheKey, origin, destination })
        : null;
    if (result) {
      eta = {
        seconds: result.etaSeconds,
        text: result.etaText,
        distanceMeters: result.distanceMeters,
        source: result.source,
        fromStore: !lastLocation,
        ...(viaStore ? { toStoreSeconds: result.stopEtaSeconds } : {}),
      };
      route = { polyline: result.polyline, source: result.source };
    }
  }

  const otherParts = storeOrders
    .filter((row) => idOf(row) !== idOf(primary))
    .map((row) => {
      const type = resolveStoreOrderType(row);
      return {
        storeOrderId: idOf(row),
        part: row.sourcePart || "",
        orderType: type,
        status: timelineKeyForStoreOrder(row),
        storeStatus: row.status,
        trackingEnabled: isStoreOrderTrackable(row),
        preOrder: type === "preorder" ? preOrderInfo(row, customerOrder) : null,
      };
    });

  return {
    orderId: idOf(customerOrder) || customerOrderIdOf(primary),
    storeOrderId: primary ? idOf(primary) : null,
    part: primary?.sourcePart || "",
    orderNumber: customerOrder?.orderNumber || primary?.orderNumber || "",
    orderType,
    trackingEnabled,
    liveTracking,
    riderPhase,
    status: statusKey,
    storeStatus: primary?.status || null,
    customerStatus: customerOrder?.status || null,
    timeline: buildTimeline({ customerOrder, storeOrder: primary, statusKey }),
    preOrder: orderType === "preorder" ? preOrderInfo(primary, customerOrder) : null,
    otherParts,
    driver: rider
      ? { id: idOf(rider), name: rider.name || "Delivery partner", phone: rider.phone || "", vehicleType: rider.vehicleType || "" }
      : null,
    store,
    destination,
    lastLocation,
    eta,
    delay: customerDelayInfo(primary, closed),
    route,
    refreshRouteSeconds: ROUTE_REFRESH_SECONDS,
    serverTime: new Date().toISOString(),
  };
}
