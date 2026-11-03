import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import StoreOrder from "../models/StoreOrder.js";
import DriverOfferHistory from "../models/DriverOfferHistory.js";
import { haversineKm } from "./darkStoreResolver.js";
import { getIO } from "../../../socket.js";
import {
  LOCATION_FRESHNESS_MS,
  MAX_ASSIGNMENT_DISTANCE_M,
  MIN_ASSIGNMENT_DISTANCE_M,
  OFFER_TIMEOUT_SECONDS,
} from "../config/orderAssignmentConfig.js";
import { estimateOfferEarning } from "./ShiftEarningService.js";

const activeOfferTimers = new Map();
const currentlyAssigningOrders = new Set();

/** DB lock lifetime — long enough for one assignment pass, short enough to recover from a crash. */
const ASSIGNMENT_LOCK_MS = 15 * 1000;
const SWEEP_INTERVAL_MS = 30 * 1000;
/** Grace after offer expiry before the sweeper takes over from a missed in-memory timer. */
const OFFER_EXPIRY_GRACE_MS = 5 * 1000;
/** Riders who just finished a drop and are heading back can be offered from further out. */
const RETURNING_RIDER_WINDOW_MS = 20 * 60 * 1000;
const RETURNING_RIDER_RADIUS_M = Number(process.env.RETURNING_RIDER_RADIUS_M || 3000);

function darkStoreIdOf(orderOrManager) {
  return String(orderOrManager?.darkStoreId || orderOrManager?.managerId || "");
}

function metersBetween(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

function formatDistance(meters) {
  if (meters == null) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function waitingSince(driver) {
  return (
    driver.lastOrderCompletedAt ||
    driver.lastOrderAssignedAt ||
    driver.lastOnlineAt ||
    driver.onlineSince ||
    driver.createdAt
  );
}

function assignmentMaxDistanceM(darkStore) {
  const geofence = Number(darkStore?.geofenceRadius);
  if (Number.isFinite(geofence) && geofence > 0) {
    return geofence;
  }
  return MAX_ASSIGNMENT_DISTANCE_M; // Default 500m
}

function escapeRegex(value) {
  return value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function findEligibleDrivers(darkStore, excludedIds = []) {
  const storeLat = darkStore.latitude;
  const storeLng = darkStore.longitude;
  const storeId = darkStore._id;
  const maxDistanceM = assignmentMaxDistanceM(darkStore);

  if (storeLat == null || storeLng == null) {
    console.warn(
      `[assignment] store ${storeId} missing latitude/longitude — no drivers can be matched`
    );
    return [];
  }

  const now = new Date();
  const storeAreaRegex = darkStore.area ? new RegExp(escapeRegex(darkStore.area), "i") : null;
  const unattachedLocalMatch = [
    ...(storeAreaRegex ? [{ area: { $regex: storeAreaRegex } }] : []),
    ...(darkStore.cityId ? [{ cityId: darkStore.cityId }] : []),
    ...(darkStore.city ? [{ city: darkStore.city }] : []),
  ];

  const drivers = await DeliveryBoy.find({
    isActive: true,
    status: "online",
    activeOrderId: null,
    employmentType: { $ne: "FULL_TIME" },
    _id: { $nin: [...new Set(excludedIds.map(String))] },
    $and: [
      {
        // This store's riders, or riders not attached to any store who are local to it.
        $or: [
          { managerId: storeId },
          { storeId: String(storeId) },
          ...(unattachedLocalMatch.length
            ? [{ managerId: { $in: [null, undefined] }, $or: unattachedLocalMatch }]
            : []),
        ],
      },
      {
        $or: [
          { verificationStatus: "approved" },
          { verificationStatus: { $exists: false } },
        ],
      },
      {
        $or: [
          { pendingOfferExpiresAt: null },
          { pendingOfferExpiresAt: { $exists: false } },
          { pendingOfferExpiresAt: { $lt: now } },
        ],
      },
    ],
  });

  const nowMs = now.getTime();
  const inRadius = [];
  const returning = [];

  for (const driver of drivers) {
    const loc = driver.currentLocation;
    if (loc?.lat == null || loc?.lng == null) continue;

    const locUpdatedAt = loc.updatedAt || driver.lastStatusAt || driver.lastOnlineAt;
    if (!locUpdatedAt || nowMs - new Date(locUpdatedAt).getTime() > LOCATION_FRESHNESS_MS) continue;

    const distanceM = metersBetween(storeLat, storeLng, loc.lat, loc.lng);
    if (distanceM == null || distanceM < MIN_ASSIGNMENT_DISTANCE_M) continue;

    if (distanceM <= maxDistanceM) {
      inRadius.push({ driver, distanceM });
      continue;
    }

    const justDelivered =
      driver.lastOrderCompletedAt &&
      nowMs - new Date(driver.lastOrderCompletedAt).getTime() <= RETURNING_RIDER_WINDOW_MS &&
      String(driver.managerId || "") === String(storeId);
    if (justDelivered && distanceM <= RETURNING_RIDER_RADIUS_M) {
      returning.push({ driver, distanceM, returning: true });
    }
  }

  const byRotation = (a, b) => {
    // 1) Round-robin rotation across eligible drivers
    const rrA = a.driver.roundRobinPosition ?? 0;
    const rrB = b.driver.roundRobinPosition ?? 0;
    if (rrA !== rrB) return rrA - rrB;
    // 2) Longest waiting next
    const waitA = new Date(waitingSince(a.driver)).getTime();
    const waitB = new Date(waitingSince(b.driver)).getTime();
    if (waitA !== waitB) return waitA - waitB;
    // 3) Nearest distance tie-break
    return a.distanceM - b.distanceM;
  };

  inRadius.sort(byRotation);
  if (inRadius.length) return inRadius;
  // Nobody at the store: riders on their way back, nearest first.
  returning.sort((a, b) => a.distanceM - b.distanceM);
  return returning;
}

function clearOfferTimer(orderId) {
  const key = String(orderId);
  if (activeOfferTimers.has(key)) {
    clearTimeout(activeOfferTimers.get(key));
    activeOfferTimers.delete(key);
  }
}

async function recordOfferResponse(orderId, driverId, response) {
  await DriverOfferHistory.findOneAndUpdate(
    { orderId, driverId, response: "PENDING" },
    { response, respondedAt: new Date() },
    { sort: { createdAt: -1 } }
  );
}

/** Atomically holds the rider for this offer; fails if another order already holds them. */
async function reserveRider(driverId, orderId, expiresAt) {
  const now = new Date();
  return DeliveryBoy.findOneAndUpdate(
    {
      _id: driverId,
      status: "online",
      activeOrderId: null,
      $or: [
        { pendingOfferExpiresAt: null },
        { pendingOfferExpiresAt: { $exists: false } },
        { pendingOfferExpiresAt: { $lt: now } },
        { pendingOfferOrderId: orderId },
      ],
    },
    { $set: { pendingOfferOrderId: orderId, pendingOfferExpiresAt: expiresAt } },
    { returnDocument: 'after' }
  );
}

async function releaseRider(driverId, orderId) {
  if (!driverId) return;
  await DeliveryBoy.updateOne(
    { _id: driverId, pendingOfferOrderId: orderId },
    { $set: { pendingOfferOrderId: null, pendingOfferExpiresAt: null } }
  ).catch(() => {});
}

/** Cross-server lock on one order's assignment pass. */
async function acquireAssignmentLock(orderId) {
  const now = new Date();
  const locked = await StoreOrder.findOneAndUpdate(
    {
      _id: orderId,
      $or: [
        { assignmentLockUntil: null },
        { assignmentLockUntil: { $exists: false } },
        { assignmentLockUntil: { $lt: now } },
      ],
    },
    { $set: { assignmentLockUntil: new Date(now.getTime() + ASSIGNMENT_LOCK_MS) } },
    { returnDocument: 'after' }
  );
  return Boolean(locked);
}

async function releaseAssignmentLock(orderId) {
  await StoreOrder.updateOne({ _id: orderId }, { $set: { assignmentLockUntil: null } }).catch(() => {});
}

export async function startAssignmentForOrder(orderId) {
  return assignNextDriver(orderId);
}

/**
 * Pre-orders are assigned manually only. When an offer is declined or expires,
 * put the order back in the manager's "ready to assign" queue instead of rotating.
 */
async function returnPreOrderToManualQueue(order, message) {
  order.status = "packed";
  order.assignmentStatus = "NONE";
  order.currentOfferDriverId = null;
  order.offeredRiderId = null;
  order.offerStartedAt = null;
  order.offerExpiresAt = null;
  await order.save();

  try {
    getIO()
      .to(`store_${order.managerId}`)
      .emit("order_status_updated", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: "packed",
        assignmentStatus: "NONE",
        isPreOrder: true,
        message,
      });
  } catch (_) {}
}

export async function assignNextDriver(orderId, opts = {}) {
  const orderKey = String(orderId);
  if (currentlyAssigningOrders.has(orderKey)) {
    return { success: false, message: "Assignment already in progress for this order" };
  }
  currentlyAssigningOrders.add(orderKey);
  let dbLocked = false;

  try {
    dbLocked = await acquireAssignmentLock(orderId);
    if (!dbLocked) {
      return { success: false, message: "Assignment already in progress for this order" };
    }

    const timedOutDriverId = opts.timedOutDriverId
      ? String(opts.timedOutDriverId)
      : null;

    const order = await StoreOrder.findById(orderId);
    if (!order) return { success: false, message: "Order not found" };

    if (order.isPreOrder) {
      return {
        success: false,
        manualOnly: true,
        message: "Pre-orders are assigned manually by the Delivery Manager",
      };
    }

    if (!["packed", "offered"].includes(order.status)) {
      return {
        success: false,
        message: `Order is in state '${order.status}', cannot assign. Order must be packed first by Delivery Manager.`,
      };
    }

    // An open offer to someone else is still running — leave it alone.
    if (
      order.status === "offered" &&
      order.currentOfferDriverId &&
      order.offerExpiresAt &&
      new Date(order.offerExpiresAt) > new Date()
    ) {
      return { success: false, message: "Offer already open for this order" };
    }

    if (!order.stockDeductedAt && order.fulfillmentType !== "pickup") {
      return {
        success: false,
        message: `Order must be packed and stock deducted by Delivery Manager before driver assignment.`,
      };
    }

    const darkStore = await DeliveryManager.findById(order.managerId || order.darkStoreId);
    if (!darkStore) return { success: false, message: "Dark store not found" };

    clearOfferTimer(order._id);

    const declinedIds = (order.declinedDriverIds || []).map(String);
    const softExcluded = [
      ...(order.excludedDriverIds || order.roundRobinRidersAttempted || []),
    ].map(String);
    // Hard exclude: anyone who declined this order (never re-offer to them)
    const excludedIds = [...new Set([...declinedIds, ...softExcluded])];

    let eligible = await findEligibleDrivers(darkStore, excludedIds);

    // Soft cycle (timeouts only) — clear soft exclusions so next round-robin pass can run
    if (!eligible.length && softExcluded.length) {
      order.excludedDriverIds = [];
      order.roundRobinRidersAttempted = [];
      await order.save();
      eligible = await findEligibleDrivers(darkStore, declinedIds);
    }

    // Timeout + no other online driver → re-show Accept/Decline on the previous driver
    if (
      !eligible.length &&
      timedOutDriverId &&
      !declinedIds.includes(timedOutDriverId)
    ) {
      const prev = await DeliveryBoy.findById(timedOutDriverId);
      if (prev && prev.isActive && prev.status === "online" && !prev.activeOrderId) {
        order.excludedDriverIds = (order.excludedDriverIds || []).filter(
          (id) => String(id) !== timedOutDriverId
        );
        order.roundRobinRidersAttempted = (
          order.roundRobinRidersAttempted || []
        ).filter((id) => String(id) !== timedOutDriverId);
        await order.save();

        const distanceM =
          metersBetween(
            darkStore.latitude,
            darkStore.longitude,
            prev.currentLocation?.lat,
            prev.currentLocation?.lng
          ) ?? 0;

        const reOffer = await sendOfferToDriver(order, prev, darkStore, distanceM);
        if (reOffer.success) return reOffer;
      }
    }

    // Try riders in rotation order until one can be reserved for this offer.
    for (const { driver, distanceM } of eligible) {
      const result = await sendOfferToDriver(order, driver, darkStore, distanceM);
      if (result.success) {
        await DeliveryBoy.updateOne(
          { _id: driver._id },
          { $set: { roundRobinPosition: Date.now() } }
        ).catch(() => {});
        return result;
      }
      if (!result.riderBusy) return result;
    }

    order.status = "packed";
    order.assignmentStatus = "WAITING_FOR_DRIVER";
    order.currentOfferDriverId = null;
    order.offeredRiderId = null;
    order.offerStartedAt = null;
    order.offerExpiresAt = null;
    await order.save();

    try {
      getIO()
        .to(`store_${darkStore._id}`)
        .emit("search_driver", {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          assignmentStatus: "WAITING_FOR_DRIVER",
          message: "Waiting for nearby Delivery Partner...",
        });
      getIO()
        .to(`store_${darkStore._id}`)
        .emit("dispatch_no_riders_available", {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          message: "Waiting for nearby Delivery Partner...",
        });
    } catch (err) {
      console.warn("[assignment] socket emit failed:", err.message);
    }

    return {
      success: false,
      noRiders: true,
      message: "Waiting for nearby Delivery Partner...",
    };
  } catch (error) {
    console.error("[assignment] assignNextDriver error:", error);
    return { success: false, error: error.message };
  } finally {
    if (dbLocked) await releaseAssignmentLock(orderId);
    currentlyAssigningOrders.delete(orderKey);
  }
}

/**
 * Send Accept/Decline offer to a specific online driver (never force-assign).
 */
export async function offerToSpecificDriver(orderId, driverId) {
  try {
    const order = await StoreOrder.findById(orderId);
    if (!order) return { success: false, message: "Order not found" };

    if (order.status === "preorder_hold") {
      return {
        success: false,
        message: "Pre-order is still with the vendor — wait until it is shipped",
      };
    }

    if (
      ["assigned", "pickup_verified", "out_for_delivery", "delivered", "delivery_failed", "cancelled"].includes(
        order.status
      )
    ) {
      return {
        success: false,
        message: `Order already ${order.status} — cannot send offer`,
      };
    }

    const driver = await DeliveryBoy.findById(driverId);
    if (!driver || !driver.isActive) {
      return { success: false, message: "Driver not found" };
    }
    if (driver.status !== "online") {
      return { success: false, message: "Driver must be online to receive an offer" };
    }
    if (driver.activeOrderId) {
      return { success: false, message: "Driver already has an active delivery" };
    }

    const darkStore = await DeliveryManager.findById(order.managerId || order.darkStoreId);
    if (!darkStore) return { success: false, message: "Dark store not found" };

    // Withdraw any open offer on this order before offering it to the chosen rider.
    if (order.status === "offered" && order.currentOfferDriverId) {
      await releaseRider(order.currentOfferDriverId, order._id);
    }
    clearOfferTimer(order._id);

    const distanceM =
      metersBetween(
        darkStore.latitude,
        darkStore.longitude,
        driver.currentLocation?.lat ?? driver.latitude,
        driver.currentLocation?.lng ?? driver.longitude
      ) ?? 0;

    const result = await sendOfferToDriver(order, driver, darkStore, distanceM);
    if (result.riderBusy) {
      return { success: false, message: "This rider already has another offer open — try again in a few seconds" };
    }
    return result;
  } catch (error) {
    console.error("[assignment] offerToSpecificDriver error:", error);
    return { success: false, message: error.message };
  }
}

async function handleOfferExpired(orderId, driverId) {
  // Atomic claim: only one of the in-memory timer or the sweeper handles this expiry.
  const fresh = await StoreOrder.findOneAndUpdate(
    { _id: orderId, status: "offered", currentOfferDriverId: driverId },
    {
      $set: {
        currentOfferDriverId: null,
        offeredRiderId: null,
        offerStartedAt: null,
        offerExpiresAt: null,
        assignmentStatus: "SEARCHING_FOR_DRIVER",
      },
    },
    { returnDocument: 'after' }
  );
  if (!fresh) return;

  await releaseRider(driverId, fresh._id);
  await recordOfferResponse(fresh._id, driverId, "TIMEOUT");
  try {
    const payload = { orderId: fresh._id.toString() };
    getIO().to(`rider_${driverId}`).emit("driver_offer_timeout", payload);
    getIO().to(`rider_${driverId}`).emit("order_offer_expired", payload);
  } catch (_) {}

  if (fresh.isPreOrder) {
    const rider = await DeliveryBoy.findById(driverId).select("name");
    await returnPreOrderToManualQueue(fresh, `${rider?.name || "Rider"} did not respond — assign another rider`);
    return;
  }
  setImmediate(() => assignNextDriver(fresh._id, { timedOutDriverId: driverId }));
}

async function sendOfferToDriver(order, selectedDriver, darkStore, distanceM) {
  try {
    const offerDurationMs = OFFER_TIMEOUT_SECONDS * 1000;
    const startedAt = new Date();
    const expiresAt = new Date(Date.now() + offerDurationMs);

    const reserved = await reserveRider(selectedDriver._id, order._id, expiresAt);
    if (!reserved) {
      return { success: false, riderBusy: true, message: "Rider is busy with another offer" };
    }

    order.status = "offered";
    order.assignmentStatus = "OFFER_SENT";
    order.currentOfferDriverId = selectedDriver._id;
    order.offeredRiderId = selectedDriver._id;
    order.offerStartedAt = startedAt;
    order.offerExpiresAt = expiresAt;
    order.assignedRiderId = null;
    if (!order.excludedDriverIds) order.excludedDriverIds = [];
    if (!order.roundRobinRidersAttempted) order.roundRobinRidersAttempted = [];
    if (!order.excludedDriverIds.some((id) => String(id) === String(selectedDriver._id))) {
      order.excludedDriverIds.push(selectedDriver._id);
    }
    if (!order.roundRobinRidersAttempted.some((id) => String(id) === String(selectedDriver._id))) {
      order.roundRobinRidersAttempted.push(selectedDriver._id);
    }
    await order.save();

    await DriverOfferHistory.create({
      orderId: order._id,
      darkStoreId: darkStore._id,
      driverId: selectedDriver._id,
      offeredAt: startedAt,
      response: "PENDING",
      distanceMeters: distanceM,
    });

    let estimatedEarnings = 0;
    try {
      const shiftId =
        order.shiftId ||
        selectedDriver.currentBooking?.shiftId ||
        null;
      const estimate = await estimateOfferEarning({
        shiftId,
        managerId: order.managerId || darkStore?._id,
        riderId: selectedDriver._id,
        storeLat: darkStore.latitude,
        storeLng: darkStore.longitude,
        customerLat: order.customerLat,
        customerLng: order.customerLng,
      });
      estimatedEarnings = Math.round(estimate.earnUpTo || estimate.estimatedEarnings || 0);
    } catch (_) {
      estimatedEarnings = 0;
    }
    // Unknown earning is shown as nothing rather than a guess.
    const shownEarnings = estimatedEarnings > 0 ? estimatedEarnings : null;

    const offerPayload = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      darkStoreId: darkStoreIdOf(order),
      darkStoreName: darkStore.storeName || `${darkStore.area} Dark Store`,
      darkStoreAddress: darkStore.storeAddress || `${darkStore.area}, ${darkStore.city}`,
      darkStoreLat: darkStore.latitude,
      darkStoreLng: darkStore.longitude,
      itemCount: order.items.length,
      itemsSummary: order.items.map((i) => `${i.quantity}x ${i.name}`).join(", "),
      estimatedEarnings: shownEarnings,
      earnUpTo: shownEarnings,
      distanceMeters: Math.round(distanceM),
      distanceKm: formatDistance(distanceM),
      offerStartedAt: startedAt.toISOString(),
      offerExpiresAt: expiresAt.toISOString(),
      timeoutSeconds: OFFER_TIMEOUT_SECONDS,
      remainingSeconds: OFFER_TIMEOUT_SECONDS,
      ...(order.isPreOrder
        ? {
            isPreOrder: true,
            preOrderSlot: order.preOrderSlot || "",
            preOrderDate: order.preOrderDate || "",
          }
        : {}),
    };

    try {
      getIO()
        .to(`rider_${selectedDriver._id}`)
        .emit("driver_order_offer", offerPayload);
      getIO()
        .to(`rider_${selectedDriver._id}`)
        .emit("order_offer_received", offerPayload);

      getIO()
        .to(`store_${darkStore._id}`)
        .emit("order_status_updated", {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          status: "offered",
          assignmentStatus: "OFFER_SENT",
          offeredRider: {
            id: selectedDriver._id.toString(),
            name: selectedDriver.name || selectedDriver.phone,
            phone: selectedDriver.phone,
            distanceMeters: Math.round(distanceM),
          },
          offerExpiresAt: expiresAt.toISOString(),
        });
    } catch (err) {
      console.warn("[assignment] socket emit failed:", err.message);
    }

    try {
      const { notifyOrderReceived } = await import("./RiderNotificationService.js");
      await notifyOrderReceived(selectedDriver._id, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        estimatedEarnings: shownEarnings,
      });
    } catch (err) {
      console.warn("[assignment] rider notification failed:", err.message);
    }

    clearOfferTimer(order._id);
    const timerId = setTimeout(() => {
      activeOfferTimers.delete(String(order._id));
      handleOfferExpired(order._id, selectedDriver._id).catch((err) =>
        console.warn("[assignment] offer timeout handler failed:", err.message)
      );
    }, offerDurationMs);
    activeOfferTimers.set(String(order._id), timerId);

    return {
      success: true,
      offered: true,
      offeredRider: {
        id: selectedDriver._id.toString(),
        name: selectedDriver.name,
        distanceMeters: Math.round(distanceM),
      },
      timeoutSeconds: OFFER_TIMEOUT_SECONDS,
    };
  } catch (error) {
    console.error("[assignment] sendOfferToDriver error:", error);
    await releaseRider(selectedDriver?._id, order?._id);
    return { success: false, error: error.message };
  }
}

export async function acceptDriverOffer(orderId, driverId) {
  const now = new Date();
  clearOfferTimer(orderId);

  // Resolve the rider's active shift booking (used for delivery earning calculation)
  const acceptingDriver = await DeliveryBoy.findById(driverId).select("currentBooking");
  const riderShiftId = acceptingDriver?.currentBooking?.shiftId || null;

  const order = await StoreOrder.findOneAndUpdate(
    {
      _id: orderId,
      status: "offered",
      currentOfferDriverId: driverId,
      offerExpiresAt: { $gt: now },
    },
    {
      $set: {
        status: "assigned",
        assignmentStatus: "DRIVER_ASSIGNED",
        assignedRiderId: driverId,
        assignedAt: now,
        currentOfferDriverId: null,
        offeredRiderId: null,
        offerStartedAt: null,
        offerExpiresAt: null,
        pickupVerified: false,
        customerAddressUnlocked: false,
        // Store rider's active shift so earning slabs can be resolved on delivery
        ...(riderShiftId ? { shiftId: riderShiftId } : {}),
      },
    },
    { returnDocument: 'after' }
  );

  if (!order) {
    return { success: false, message: "Offer expired or already taken" };
  }

  // The rider joins this store only once they accept.
  const driver = await DeliveryBoy.findOneAndUpdate(
    {
      _id: driverId,
      status: "online",
      activeOrderId: null,
    },
    {
      $set: {
        status: "on_delivery",
        activeOrderId: order._id,
        managerId: order.managerId,
        storeId: order.managerId.toString(),
        lastOrderAssignedAt: now,
        lastAssignedAt: now,
        lastStatusAt: now,
        roundRobinPosition: Date.now(),
        pendingOfferOrderId: null,
        pendingOfferExpiresAt: null,
      },
    },
    { returnDocument: 'after' }
  );

  if (!driver) {
    // Rider went offline or got another order in between — put this order straight back in the queue.
    await releaseRider(driverId, order._id);
    await recordOfferResponse(order._id, driverId, "TIMEOUT").catch(() => {});
    order.status = "packed";
    order.assignmentStatus = "SEARCHING_FOR_DRIVER";
    order.assignedRiderId = null;
    order.assignedAt = null;
    await order.save();
    if (order.isPreOrder) {
      await returnPreOrderToManualQueue(order, "Rider became unavailable — assign another rider");
    } else {
      setImmediate(() => assignNextDriver(order._id));
    }
    return { success: false, message: "Driver no longer available" };
  }

  await recordOfferResponse(order._id, driverId, "ACCEPTED");

  const darkStore = await DeliveryManager.findById(order.managerId);

  // 5-min same-route window starts AFTER accept, before pickup QR scan
  let sameRoute = null;
  try {
    const { openSameRouteWindowAfterAccept } = await import(
      "./sameRouteAttachService.js"
    );
    sameRoute = await openSameRouteWindowAfterAccept(order, darkStore);
    if (sameRoute?.routeBatchWindowEndsAt) {
      order.routeBatchWindowEndsAt = sameRoute.routeBatchWindowEndsAt;
    }
    if (typeof sameRoute?.pickupQrUnlocked === "boolean") {
      order.pickupQrUnlocked = sameRoute.pickupQrUnlocked;
    }
  } catch (err) {
    console.warn("[assignment] same-route window failed:", err.message);
  }

  try {
    const io = getIO();
    io
      .to(`store_${order.managerId}`)
      .emit("driver_assigned", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: "assigned",
        assignmentStatus: "DRIVER_ASSIGNED",
        assignedRider: {
          id: driver._id.toString(),
          name: driver.name || driver.phone,
          phone: driver.phone,
        },
        assignedRiderId: driver._id.toString(),
        routeBatchWindowEndsAt: order.routeBatchWindowEndsAt,
        pickupQrUnlocked: Boolean(order.pickupQrUnlocked),
      });
    io
      .to(`store_${order.managerId}`)
      .emit("order_status_updated", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: "assigned",
        assignmentStatus: "DRIVER_ASSIGNED",
        assignedRider: {
          id: driver._id.toString(),
          name: driver.name || driver.phone,
          phone: driver.phone,
        },
        assignedRiderId: driver._id.toString(),
        assignedAt: order.assignedAt,
        routeBatchWindowEndsAt: order.routeBatchWindowEndsAt,
        pickupQrUnlocked: Boolean(order.pickupQrUnlocked),
      });

    // Realtime notification to delivery rider rooms
    const riderPayload = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: "assigned",
      assignmentStatus: "DRIVER_ASSIGNED",
      pickupQrUnlocked: Boolean(order.pickupQrUnlocked),
    };
    io.to(`rider_${driver._id}`).emit("new_order_assigned", riderPayload);
    io.to(`rider:${driver._id}`).emit("new_order_assigned", riderPayload);
    io.to(`rider_${driver._id}`).emit("active_delivery_updated", {
      reason: "order_assigned",
      orderId: order._id.toString(),
    });
    io.to(`rider:${driver._id}`).emit("active_delivery_updated", {
      reason: "order_assigned",
      orderId: order._id.toString(),
    });
  } catch (err) {
    console.warn("[assignment] socket emit failed:", err.message);
  }

  try {
    const { notifyOrdersAssigned } = await import("./RiderNotificationService.js");
    await notifyOrdersAssigned(driver._id, {
      orders: [order],
      storeName: darkStore?.storeName || `${darkStore?.area || "Store"} Dark Store`,
    });
  } catch (err) {
    console.warn("[assignment] notifyOrdersAssigned error:", err.message);
  }

  return { success: true, order, driver, darkStore, sameRoute };
}

export async function declineDriverOffer(orderId, driverId) {
  const order = await StoreOrder.findOne({
    _id: orderId,
    status: "offered",
    currentOfferDriverId: driverId,
  });

  if (!order) return { success: true, rotated: false };

  clearOfferTimer(orderId);
  await releaseRider(driverId, order._id);
  await recordOfferResponse(order._id, driverId, "DECLINED");

  if (!order.declinedDriverIds) order.declinedDriverIds = [];
  if (!order.declinedDriverIds.some((id) => String(id) === String(driverId))) {
    order.declinedDriverIds.push(driverId);
  }
  if (!order.excludedDriverIds) order.excludedDriverIds = [];
  if (!order.excludedDriverIds.some((id) => String(id) === String(driverId))) {
    order.excludedDriverIds.push(driverId);
  }

  if (order.isPreOrder) {
    const decliner = await DeliveryBoy.findById(driverId).select("name phone");
    await returnPreOrderToManualQueue(
      order,
      `${decliner?.name || decliner?.phone || "Rider"} declined — assign another rider`
    );
    return { success: true, rotated: false };
  }

  order.currentOfferDriverId = null;
  order.offeredRiderId = null;
  order.offerStartedAt = null;
  order.offerExpiresAt = null;
  order.assignmentStatus = "SEARCHING_FOR_DRIVER";
  await order.save();

  try {
    getIO()
      .to(`store_${order.managerId}`)
      .emit("order_status_updated", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        assignmentStatus: "SEARCHING_FOR_DRIVER",
        message: "Driver declined — offering next partner",
      });
  } catch (_) {}

  setImmediate(() => assignNextDriver(order._id));
  return { success: true, rotated: true };
}

function waitingOrdersFilter(extra = {}) {
  return {
    isPreOrder: { $ne: true },
    fulfillmentType: { $ne: "pickup" },
    stockDeductedAt: { $ne: null },
    ...extra,
    $or: [
      { status: "packed", assignmentStatus: { $in: ["WAITING_FOR_DRIVER", "SEARCHING_FOR_DRIVER", null] } },
      { status: "offered", $or: [{ offerExpiresAt: null }, { offerExpiresAt: { $lt: new Date() } }] },
    ],
  };
}

export async function retryWaitingAssignmentsForStore(darkStoreId) {
  const waitingOrders = await StoreOrder.find(waitingOrdersFilter({ managerId: darkStoreId }))
    .sort({ packedAt: 1, createdAt: 1 })
    .limit(20)
    .select("_id");

  for (const order of waitingOrders) {
    await assignNextDriver(order._id);
  }
}

let sweeperTimer = null;

/**
 * Background safety net (every 30s): expires offers whose in-memory timer was lost
 * (restart / other server) and retries orders still waiting for a rider.
 */
export async function sweepStuckAssignments() {
  const now = Date.now();

  const expiredOffers = await StoreOrder.find({
    status: "offered",
    currentOfferDriverId: { $ne: null },
    offerExpiresAt: { $lt: new Date(now - OFFER_EXPIRY_GRACE_MS) },
  })
    .limit(50)
    .select("_id currentOfferDriverId");
  for (const row of expiredOffers) {
    clearOfferTimer(row._id);
    await handleOfferExpired(row._id, row.currentOfferDriverId).catch((err) =>
      console.warn("[assignment-sweep] expire failed:", err.message)
    );
  }

  // Offer state without a rider or expiry (old crash leftovers) is treated as waiting.
  const waiting = await StoreOrder.find(
    waitingOrdersFilter({
      updatedAt: { $lt: new Date(now - 20 * 1000) },
      $and: [
        {
          $or: [
            { assignmentLockUntil: null },
            { assignmentLockUntil: { $exists: false } },
            { assignmentLockUntil: { $lt: new Date(now) } },
          ],
        },
      ],
    })
  )
    .sort({ packedAt: 1, createdAt: 1 })
    .limit(50)
    .select("_id");
  for (const row of waiting) {
    await assignNextDriver(row._id).catch(() => {});
  }

  // Reservations whose offer is gone.
  await DeliveryBoy.updateMany(
    { pendingOfferExpiresAt: { $lt: new Date(now - OFFER_EXPIRY_GRACE_MS) } },
    { $set: { pendingOfferOrderId: null, pendingOfferExpiresAt: null } }
  ).catch(() => {});
}

export function startAssignmentSweeper() {
  if (sweeperTimer) return;
  sweeperTimer = setInterval(() => {
    sweepStuckAssignments().catch((err) =>
      console.warn("[assignment-sweep] failed:", err.message)
    );
  }, SWEEP_INTERVAL_MS);
  sweeperTimer.unref?.();
}

/** @deprecated use assignNextDriver */
export const dispatchNextRider = assignNextDriver;
