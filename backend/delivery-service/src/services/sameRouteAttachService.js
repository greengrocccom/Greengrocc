/**
 * Attach a companion order to the same rider as an assigned primary
 * while the same-route window is open (after accept, before QR unlock).
 *
 * Flow:
 * 1) Rider accepts → 5-min window (pickup QR locked)
 * 2) Same-route packed order within window → batch both → unlock QR for both
 * 3) Window ends with no match → unlock QR for the single order
 * 4) Different-route orders keep normal round-robin to other drivers
 */
import DeliveryBoy from "../models/DeliveryBoy.js";
import StoreOrder from "../models/StoreOrder.js";
import { getIO } from "../../../socket.js";
import {
  BATCHING_WAIT_MS,
  evaluateRouteCompatibility,
  findAssignableRouteAnchors,
  makeBatchId,
  buildSuggestionPayload,
} from "./routeBatchingService.js";

const batchWindowTimers = new Map();

function isBeforePickupQr(order) {
  return !(order?.pickupQrScanned || order?.qrScannedAt);
}

function windowStillOpen(order, now = new Date()) {
  if (!order?.routeBatchWindowEndsAt) return false;
  return new Date(order.routeBatchWindowEndsAt).getTime() > now.getTime();
}

export function isPickupQrReady(order, now = new Date()) {
  if (!order) return false;
  if (order.pickupQrScanned || order.qrScannedAt) return true;
  // If route batch window exists and has not expired yet, QR is strictly NOT ready.
  if (
    order.routeBatchWindowEndsAt &&
    new Date(order.routeBatchWindowEndsAt).getTime() > now.getTime()
  ) {
    return false;
  }
  if (order.pickupQrUnlocked === true) return true;
  if (order.pickupQrUnlocked === false) {
    if (
      order.routeBatchWindowEndsAt &&
      new Date(order.routeBatchWindowEndsAt).getTime() <= now.getTime()
    ) {
      return true;
    }
    return false;
  }
  // Legacy orders created before pickupQrUnlocked existed
  return true;
}

function clearBatchWindowTimer(orderId) {
  const key = String(orderId);
  if (batchWindowTimers.has(key)) {
    clearTimeout(batchWindowTimers.get(key));
    batchWindowTimers.delete(key);
  }
}

/**
 * Unlock pickup QR for an order (after 5-min wait or same-route batch).
 */
export async function unlockPickupQr(order, { reason = "window_ended" } = {}) {
  if (!order) return null;
  clearBatchWindowTimer(order._id);
  order.pickupQrUnlocked = true;
  order.routeBatchWindowEndsAt = undefined;
  await order.save();

  try {
    const payload = {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      reason,
      pickupQrUnlocked: true,
      routeBatchWindowEndsAt: null,
      batchId: order.batchId || "",
    };
    getIO().to(`store_${order.managerId}`).emit("pickup_qr_unlocked", payload);
    getIO().to(`store_${order.managerId}`).emit("order_batch_window_ended", {
      ...payload,
      pickupQrUnlocked: true,
    });
    getIO().to(`store_${order.managerId}`).emit("order_status_updated", {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      status: order.status,
      assignmentStatus: order.assignmentStatus,
      pickupQrUnlocked: true,
      routeBatchWindowEndsAt: null,
    });
    if (order.assignedRiderId) {
      getIO().to(`rider_${order.assignedRiderId}`).emit("pickup_qr_unlocked", payload);
      getIO()
        .to(`rider_${order.assignedRiderId}`)
        .emit("active_delivery_updated", payload);
    }
  } catch (_) {}

  return order;
}

function schedulePickupQrUnlock(order) {
  if (!order?.routeBatchWindowEndsAt) return;
  clearBatchWindowTimer(order._id);
  const ms = Math.max(
    0,
    new Date(order.routeBatchWindowEndsAt).getTime() - Date.now()
  );
  const timerId = setTimeout(async () => {
    batchWindowTimers.delete(String(order._id));
    try {
      const fresh = await StoreOrder.findById(order._id);
      if (!fresh) return;
      if (fresh.pickupQrUnlocked || fresh.pickupQrScanned) return;
      if (
        fresh.routeBatchWindowEndsAt &&
        new Date(fresh.routeBatchWindowEndsAt).getTime() > Date.now() + 500
      ) {
        return;
      }
      if (["assigned"].includes(fresh.status)) {
        await unlockPickupQr(fresh, { reason: "same_route_window_ended" });
      } else {
        fresh.routeBatchWindowEndsAt = undefined;
        await fresh.save();
      }
    } catch (err) {
      console.warn("[batch] scheduled QR unlock failed:", err.message);
    }
  }, ms + 50);
  batchWindowTimers.set(String(order._id), timerId);
}

/** Why an order can't join a batch, or "" when it can (packed with stock taken, not yet picked up). */
export function batchBlockReason(order, riderId) {
  const label = `#${order.orderNumber}`;
  if (["delivered", "delivery_failed", "cancelled"].includes(order.status)) return `${label} is already ${order.status}`;
  if (["pickup_verified", "out_for_delivery"].includes(order.status)) return `${label} is already picked up`;
  if (!["packed", "offered", "assigned"].includes(order.status)) return `${label} must be packed first`;
  if (!order.isPreOrder && order.fulfillmentType !== "pickup" && !order.stockDeductedAt) {
    return `${label} must be packed first`;
  }
  if (order.assignedRiderId && riderId && String(order.assignedRiderId) !== String(riderId)) {
    return `${label} is assigned to another rider`;
  }
  return "";
}

/**
 * Force-assign both orders onto one rider as a multi-stop batch,
 * then unlock pickup QR for both so manager can show QR codes.
 */
export async function attachOrdersToSameRider({
  primary,
  companion,
  rider,
  manager,
  compat,
}) {
  const blocked = batchBlockReason(primary, rider._id) || batchBlockReason(companion, rider._id);
  if (blocked) {
    const err = new Error(blocked);
    err.statusCode = 400;
    throw err;
  }
  // Withdraw open offers to other riders so their reservations don't linger.
  for (const order of [primary, companion]) {
    if (order.status === "offered" && order.currentOfferDriverId && String(order.currentOfferDriverId) !== String(rider._id)) {
      await DeliveryBoy.updateOne(
        { _id: order.currentOfferDriverId, pendingOfferOrderId: order._id },
        { $set: { pendingOfferOrderId: null, pendingOfferExpiresAt: null } }
      ).catch(() => {});
    }
  }
  const seq = compat?.suggestedSequence || ["A", "B"];
  const batchId = primary.batchId || companion.batchId || makeBatchId(primary._id);
  const now = new Date();

  const primaryEndsAt = primary.routeBatchWindowEndsAt;
  const isPrimaryWindowActive =
    primaryEndsAt && new Date(primaryEndsAt).getTime() > now.getTime();
  const effectiveEndsAt = isPrimaryWindowActive
    ? primaryEndsAt
    : companion.routeBatchWindowEndsAt && new Date(companion.routeBatchWindowEndsAt).getTime() > now.getTime()
      ? companion.routeBatchWindowEndsAt
      : null;
  const stillWaiting = Boolean(effectiveEndsAt && new Date(effectiveEndsAt).getTime() > now.getTime());

  const applyAssign = async (order, sequence) => {
    if (["delivered", "delivery_failed", "cancelled"].includes(order.status)) {
      return order;
    }
    clearBatchWindowTimer(order._id);
    order.currentOfferDriverId = null;
    order.offeredRiderId = null;
    order.offerExpiresAt = null;
    order.offerStartedAt = null;
    order.assignedRiderId = rider._id;
    order.assignedAt = order.assignedAt || now;
    if (["packed", "offered"].includes(order.status)) {
      order.status = "assigned";
    }
    order.assignmentStatus = "DRIVER_ASSIGNED";
    order.batchId = batchId;
    order.batchSequence = sequence;
    order.batchPrimaryOrderId = primary._id;
    if (stillWaiting) {
      order.routeBatchWindowEndsAt = effectiveEndsAt;
      order.pickupQrUnlocked = false;
      schedulePickupQrUnlock(order);
    } else {
      order.routeBatchWindowEndsAt = undefined;
      order.pickupQrUnlocked = true;
    }
    order.routeCompatibility = {
      compatible: Boolean(compat?.compatible),
      score: compat?.score ?? 0,
      reason: compat?.reason || "same_route_attach",
      distanceBetweenKm: compat?.distanceBetweenKm ?? null,
      suggestedSequence: compat?.suggestedSequence || seq,
    };
    await order.save();
    return order;
  };

  const primarySeq = seq[0] === "A" ? 1 : 2;
  const companionSeq = seq[0] === "A" ? 2 : 1;
  await applyAssign(primary, primarySeq);
  await applyAssign(companion, companionSeq);

  rider.status = "on_delivery";
  rider.activeOrderId = primarySeq === 1 ? primary._id : companion._id;
  rider.lastStatusAt = now;
  await rider.save();

  const payload = {
    batchId,
    primaryOrderId: String(primary._id),
    companionOrderId: String(companion._id),
    riderId: String(rider._id),
    riderName: rider.name || rider.phone,
    multiStop: true,
    pickupQrUnlocked: !stillWaiting,
    routeBatchWindowEndsAt: stillWaiting ? effectiveEndsAt : null,
  };

  try {
    getIO().to(`rider_${rider._id}`).emit("new_order_assigned", {
      orderId: companion._id.toString(),
      batchId,
      multiStop: true,
      pickupQrUnlocked: !stillWaiting,
      routeBatchWindowEndsAt: stillWaiting ? effectiveEndsAt : null,
    });
    getIO().to(`rider_${rider._id}`).emit("active_delivery_updated", {
      batchId,
      orderIds: [String(primary._id), String(companion._id)],
      pickupQrUnlocked: !stillWaiting,
      routeBatchWindowEndsAt: stillWaiting ? effectiveEndsAt : null,
    });
    if (!stillWaiting) {
      getIO().to(`rider_${rider._id}`).emit("pickup_qr_unlocked", {
        orderId: String(primary._id),
        companionOrderId: String(companion._id),
        batchId,
        reason: "same_route_batched",
        pickupQrUnlocked: true,
      });
    }
    getIO().to(`store_${manager._id}`).emit("same_route_assigned", payload);
    if (!stillWaiting) {
      getIO().to(`store_${manager._id}`).emit("pickup_qr_unlocked", {
        orderId: String(primary._id),
        companionOrderId: String(companion._id),
        batchId,
        reason: "same_route_batched",
        pickupQrUnlocked: true,
      });
    }
    getIO().to(`store_${manager._id}`).emit("order_status_updated", {
      orderId: String(companion._id),
      orderNumber: companion.orderNumber,
      status: "assigned",
      assignmentStatus: "DRIVER_ASSIGNED",
      pickupQrUnlocked: !stillWaiting,
      routeBatchWindowEndsAt: stillWaiting ? effectiveEndsAt : null,
      assignedRider: {
        id: String(rider._id),
        name: rider.name || rider.phone,
        phone: rider.phone,
      },
      batchId,
    });
    getIO().to(`store_${manager._id}`).emit("driver_assigned", {
      orderId: String(companion._id),
      orderNumber: companion.orderNumber,
      status: "assigned",
      assignmentStatus: "DRIVER_ASSIGNED",
      pickupQrUnlocked: !stillWaiting,
      routeBatchWindowEndsAt: stillWaiting ? effectiveEndsAt : null,
      assignedRider: {
        id: String(rider._id),
        name: rider.name || rider.phone,
        phone: rider.phone,
      },
    });
  } catch (_) {}

  try {
    const { notifyOrderReceived } = await import("./RiderNotificationService.js");
    await notifyOrderReceived(rider._id, {
      orderId: companion._id,
      orderNumber: companion.orderNumber,
    });
  } catch (_) {}

  return { batchId, primary, companion, rider, payload };
}

/**
 * After rider accepts: open 5-min same-route hold (QR locked),
 * auto-attach any already-packed compatible companions.
 */
export async function openSameRouteWindowAfterAccept(order, manager) {
  if (!order || !manager) return { windowOpened: false, attached: [] };

  // Scheduled pre-orders are prepared in advance — no same-route wait, QR ready at once.
  if (order.isPreOrder) {
    order.pickupQrUnlocked = true;
    order.routeBatchWindowEndsAt = undefined;
    await order.save();
    return { windowOpened: false, attached: [], routeBatchWindowEndsAt: null, pickupQrUnlocked: true };
  }

  const now = new Date();
  order.pickupQrUnlocked = false;
  order.routeBatchWindowEndsAt = new Date(now.getTime() + BATCHING_WAIT_MS);
  await order.save();
  schedulePickupQrUnlock(order);

  try {
    getIO().to(`store_${manager._id}`).emit("order_status_updated", {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      status: order.status,
      assignmentStatus: order.assignmentStatus,
      routeBatchWindowEndsAt: order.routeBatchWindowEndsAt,
      pickupQrUnlocked: false,
      assignedRiderId: order.assignedRiderId ? String(order.assignedRiderId) : null,
      message:
        "Same-route search (5 min) — pickup QR unlocks when window ends or a match is found",
    });
    getIO().to(`store_${manager._id}`).emit("same_route_window_started", {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      routeBatchWindowEndsAt: order.routeBatchWindowEndsAt,
      pickupQrUnlocked: false,
      assignedRiderId: order.assignedRiderId ? String(order.assignedRiderId) : null,
    });
    if (order.assignedRiderId) {
      getIO().to(`rider_${order.assignedRiderId}`).emit("same_route_window_started", {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        routeBatchWindowEndsAt: order.routeBatchWindowEndsAt,
        pickupQrUnlocked: false,
      });
    }
  } catch (_) {}

  const attached = [];
  if (!order.assignedRiderId || !isBeforePickupQr(order)) {
    return {
      windowOpened: true,
      attached,
      routeBatchWindowEndsAt: order.routeBatchWindowEndsAt,
      pickupQrUnlocked: false,
    };
  }

  const rider = await DeliveryBoy.findById(order.assignedRiderId);
  if (!rider) {
    return {
      windowOpened: true,
      attached,
      routeBatchWindowEndsAt: order.routeBatchWindowEndsAt,
      pickupQrUnlocked: false,
    };
  }

  const candidates = await StoreOrder.find({
    managerId: manager._id,
    _id: { $ne: order._id },
    isPreOrder: { $ne: true },
    status: "packed",
    assignmentStatus: { $nin: ["OFFER_SENT", "DRIVER_ASSIGNED"] },
    currentOfferDriverId: null,
    assignedRiderId: null,
  }).sort({ packedAt: 1 });

  for (const companion of candidates) {
    const compat = evaluateRouteCompatibility(order, companion, manager);
    if (!compat.compatible) continue;
    const primary = await StoreOrder.findById(order._id);
    if (!primary || !isBeforePickupQr(primary) || !windowStillOpen(primary)) break;

    const result = await attachOrdersToSameRider({
      primary,
      companion,
      rider,
      manager,
      compat,
    });
    attached.push(result.payload);
    break;
  }

  const fresh = await StoreOrder.findById(order._id);
  const stillWaiting =
    fresh?.routeBatchWindowEndsAt &&
    new Date(fresh.routeBatchWindowEndsAt).getTime() > Date.now();
  return {
    windowOpened: Boolean(stillWaiting),
    attached,
    routeBatchWindowEndsAt: fresh?.routeBatchWindowEndsAt || null,
    pickupQrUnlocked: Boolean(fresh?.pickupQrUnlocked),
  };
}

/**
 * When packing a new order: if an assigned primary still has an open
 * same-route window (accepted, QR not unlocked yet), auto-attach.
 * Different-route orders return autoAttached:false → normal dispatch to other drivers.
 */
export async function tryAutoAttachOnPack(newOrder, manager) {
  if (!newOrder || newOrder.isPreOrder || newOrder.fulfillmentType === "pickup") {
    return { autoAttached: false, suggestion: null };
  }

  const now = new Date();
  const anchors = await findAssignableRouteAnchors(StoreOrder, manager._id, {
    excludeId: newOrder._id,
  });

  let suggestion = null;
  for (const anchor of anchors) {
    const compat = evaluateRouteCompatibility(anchor, newOrder, manager);
    if (!compat.compatible) continue;

    suggestion = buildSuggestionPayload(anchor, newOrder, manager, compat);

    const canAuto =
      anchor.status === "assigned" &&
      anchor.assignedRiderId &&
      isBeforePickupQr(anchor) &&
      windowStillOpen(anchor, now) &&
      !anchor.pickupQrUnlocked;

    if (!canAuto) continue;

    const rider = await DeliveryBoy.findById(anchor.assignedRiderId);
    if (!rider || !rider.isActive) continue;

    newOrder.routeCompatibility = {
      compatible: true,
      score: compat.score,
      reason: compat.reason,
      distanceBetweenKm: compat.distanceBetweenKm,
      suggestedSequence: compat.suggestedSequence,
    };
    await newOrder.save();

    const result = await attachOrdersToSameRider({
      primary: anchor,
      companion: newOrder,
      rider,
      manager,
      compat,
    });

    const stillWaiting = Boolean(result?.payload?.routeBatchWindowEndsAt);
    return {
      autoAttached: true,
      suggestion,
      result,
      message: stillWaiting
        ? `Same-route match — both orders assigned to ${rider.name || rider.phone}. 5-min route matching active.`
        : `Same-route match — both orders assigned to ${rider.name || rider.phone}. Pickup QR unlocked.`,
    };
  }

  return { autoAttached: false, suggestion };
}

/** Clear same-route wait when pickup QR is scanned. */
export async function clearSameRouteWindowOnQrScan(order) {
  if (!order) return order;
  clearBatchWindowTimer(order._id);
  if (order.routeBatchWindowEndsAt) {
    order.routeBatchWindowEndsAt = undefined;
  }
  order.pickupQrUnlocked = true;
  return order;
}

/** Flush expired windows for a store and unlock QR on assigned orders. */
export async function flushExpiredSameRouteWindows(managerId) {
  const now = new Date();
  const expired = await StoreOrder.find({
    managerId,
    routeBatchWindowEndsAt: { $lte: now, $ne: null },
  });
  for (const o of expired) {
    if (o.status === "assigned" && !o.pickupQrUnlocked && !o.pickupQrScanned) {
      await unlockPickupQr(o, { reason: "same_route_window_ended" });
    } else {
      clearBatchWindowTimer(o._id);
      o.routeBatchWindowEndsAt = undefined;
      await o.save();
      try {
        getIO().to(`store_${managerId}`).emit("order_batch_window_ended", {
          orderId: o._id.toString(),
          orderNumber: o.orderNumber,
        });
      } catch (_) {}
    }
  }
  return expired.length;
}
