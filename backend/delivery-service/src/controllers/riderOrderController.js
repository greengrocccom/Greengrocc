import StoreOrder, { deliveryDelayJSON, randomDeliveryOtp } from "../models/StoreOrder.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import {
  acceptDriverOffer,
  assignNextDriver,
  declineDriverOffer,
  retryWaitingAssignmentsForStore,
} from "../services/OrderAssignmentService.js";
import {
  generateDriverPickupToken,
  verifyPickupByDriverScan,
  verifyPickupScan,
  submitPickupProof,
  approvePickupProof,
} from "../services/PickupVerificationService.js";
import { isPickupQrReady } from "../services/sameRouteAttachService.js";
import { refreshStoreOrderCustomerCoords } from "../services/customerLocationService.js";
import { OFFER_TIMEOUT_SECONDS } from "../config/orderAssignmentConfig.js";
import { getIO } from "../../../socket.js";
import { checkAndTrackIncentive } from "./incentiveController.js";
import { calculateRiderEarning, applyEarningSnapshot, estimateOfferEarning } from "../services/ShiftEarningService.js";
import { createCashLiability } from "../services/CashSettlementService.js";
import { getPaymentSummary } from "../services/PaymentCollectionService.js";
import { isS3Configured, uploadDataUrlToS3, uploadBufferToS3 } from "../services/s3Service.js";
import { resolveStoreOrderType, isStoreOrderTrackable } from "../services/orderTrackingService.js";
import { sendDeliveryOtpSms } from "../services/deliveryOtpSmsService.js";
import { syncCustomerOrderFromStore } from "../services/syncCustomerOrderFromStore.js";
import { resolveCashForOrder } from "../services/CashSettlementService.js";

const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000;
const OTP_HARD_LOCK_MS = 2 * 60 * 60 * 1000;
const OTP_HARD_LOCK_AFTER = 15;
const OTP_STATUSES = ["pickup_verified", "out_for_delivery"];

/**
 * Checks the customer OTP with lockouts; repeated lockouts lock the order for hours and alert the store.
 * Returns null when the OTP is correct, otherwise { status, body } to send back.
 */
async function checkCustomerOtp(order, otp) {
  const now = new Date();
  if (order.otpLockedUntil && order.otpLockedUntil > now) {
    const waitMins = Math.ceil((order.otpLockedUntil - now) / 60000);
    return {
      status: 429,
      body: { success: false, message: `Too many incorrect OTP attempts. Try again in ${waitMins} min.` },
    };
  }

  const expectedOtp = String(order.otpCode || order.deliveryOtp || "").trim();
  if (expectedOtp && otp === expectedOtp) return null;

  order.otpAttempts = (order.otpAttempts || 0) + 1;
  order.otpFailedTotal = (order.otpFailedTotal || 0) + 1;
  let lockedFor = 0;
  if (order.otpFailedTotal >= OTP_HARD_LOCK_AFTER) {
    lockedFor = OTP_HARD_LOCK_MS;
  } else if (order.otpAttempts >= MAX_OTP_ATTEMPTS) {
    lockedFor = OTP_LOCK_MS;
  }
  if (lockedFor) {
    order.otpLockedUntil = new Date(now.getTime() + lockedFor);
    order.otpAttempts = 0;
  }
  await order.save();

  if (lockedFor) {
    try {
      getIO().to(`store_${order.managerId}`).emit("otp_lockout_alert", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        riderId: order.assignedRiderId ? String(order.assignedRiderId) : null,
        failedAttempts: order.otpFailedTotal,
        lockedUntil: order.otpLockedUntil,
      });
    } catch (_) {}
    return {
      status: 429,
      body: {
        success: false,
        message: `Too many incorrect OTP attempts. Locked for ${Math.round(lockedFor / 60000)} min — your Delivery Manager has been alerted.`,
      },
    };
  }

  const remaining = Math.max(0, MAX_OTP_ATTEMPTS - order.otpAttempts);
  return {
    status: 400,
    body: {
      success: false,
      message: `Incorrect OTP. Ask the customer for the code in their GreenGroo order. ${remaining} attempt(s) remaining.`,
      attemptsRemaining: remaining,
    },
  };
}

function distanceLabel(meters) {
  if (meters == null) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export const getPendingOffer = async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const now = new Date();
    const requestedOrderId = String(req.query.orderId || "").trim();

    let order = await StoreOrder.findOne({
      currentOfferDriverId: riderId,
      status: "offered",
      offerExpiresAt: { $gt: now },
    });

    // Notification tap with orderId: verify this offer still belongs to rider & is pending
    if (!order && requestedOrderId) {
      const probed = await StoreOrder.findById(requestedOrderId);
      if (!probed) {
        return res.json({
          success: true,
          offer: null,
          reason: "not_found",
          message: "Assignment not found",
        });
      }
      const offeredToMe =
        probed.currentOfferDriverId &&
        String(probed.currentOfferDriverId) === String(riderId);
      const stillOpen =
        probed.status === "offered" &&
        probed.offerExpiresAt &&
        new Date(probed.offerExpiresAt) > now;
      if (!offeredToMe || !stillOpen) {
        return res.json({
          success: true,
          offer: null,
          reason:
            probed.status === "assigned" &&
            String(probed.assignedRiderId) === String(riderId)
              ? "already_accepted"
              : probed.status === "cancelled"
                ? "cancelled"
                : "expired_or_reassigned",
          message:
            probed.status === "assigned" &&
            String(probed.assignedRiderId) === String(riderId)
              ? "You already accepted this order"
              : "This assignment is no longer available",
          orderStatus: probed.status,
          assignmentStatus: probed.assignmentStatus,
        });
      }
      order = probed;
    }

    if (!order) {
      return res.json({ success: true, offer: null, reason: "none" });
    }

    const manager = await DeliveryManager.findById(order.managerId);
    const rider = await DeliveryBoy.findById(riderId).select("currentBooking");

    const remainingMs = new Date(order.offerExpiresAt).getTime() - Date.now();
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    let estimatedEarnings = 0;
    try {
      const estimate = await estimateOfferEarning({
        shiftId: order.shiftId || rider?.currentBooking?.shiftId || null,
        managerId: order.managerId,
        riderId,
        storeLat: manager?.latitude,
        storeLng: manager?.longitude,
        customerLat: order.customerLat,
        customerLng: order.customerLng,
      });
      estimatedEarnings = Math.round(estimate.earnUpTo || estimate.estimatedEarnings || 0);
    } catch (_) {}

    return res.json({
      success: true,
      offer: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        darkStoreId: (order.darkStoreId || order.managerId).toString(),
        darkStoreName: manager?.storeName || `${order.area} Dark Store`,
        darkStoreAddress: manager?.storeAddress || `${order.area}, ${order.city}`,
        darkStoreLat: manager?.latitude,
        darkStoreLng: manager?.longitude,
        itemCount: order.items.length,
        itemsSummary: order.items.map((i) => `${i.quantity}x ${i.name}`).join(", "),
        estimatedEarnings: estimatedEarnings > 0 ? estimatedEarnings : null,
        earnUpTo: estimatedEarnings > 0 ? estimatedEarnings : null,
        distanceKm: order.distanceKm != null ? `${order.distanceKm} km` : "nearby",
        remainingSeconds,
        timeoutSeconds: OFFER_TIMEOUT_SECONDS,
        offerExpiresAt: order.offerExpiresAt,
        offerStartedAt: order.offerStartedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const acceptOrderOffer = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;

    const result = await acceptDriverOffer(orderId, riderId);
    if (!result.success) {
      if (result.message?.includes("expired")) {
        assignNextDriver(orderId);
      }
      return res.status(400).json({ success: false, message: result.message });
    }

    const { order, darkStore } = result;

    // Store the rider's active shift booking on the order for earning slab lookup later
    try {
      const rider = await DeliveryBoy.findById(riderId).select("currentBooking");
      if (rider?.currentBooking?.shiftId && !order.shiftId) {
        await StoreOrder.findByIdAndUpdate(order._id, { shiftId: rider.currentBooking.shiftId });
        order.shiftId = rider.currentBooking.shiftId;
      }
    } catch (shiftErr) {
      console.warn("[acceptOrderOffer] shiftId linkage warning:", shiftErr.message);
    }

    // Fresh order after same-route window open (QR locked for 5 min)
    const fresh = await StoreOrder.findById(order._id);
    const qrReady = isPickupQrReady(fresh);
    let pickupQrPayload = null;
    if (qrReady) {
      const pickupQr = await generateDriverPickupToken(fresh);
      pickupQrPayload = pickupQr.qrPayload;
    }

    return res.json({
      success: true,
      message: qrReady
        ? "Order accepted! Proceed to the Dark Store for pickup verification."
        : "Order accepted! Waiting up to 5 minutes for a same-route companion — pickup QR unlocks after that.",
      order: {
        id: fresh._id.toString(),
        orderNumber: fresh.orderNumber,
        status: fresh.status,
        assignmentStatus: fresh.assignmentStatus,
        darkStoreId: (fresh.darkStoreId || fresh.managerId).toString(),
        darkStoreName: darkStore?.storeName || `${fresh.area} Dark Store`,
        darkStoreAddress: darkStore?.storeAddress || `${fresh.area}, ${fresh.city}`,
        darkStoreLat: darkStore?.latitude,
        darkStoreLng: darkStore?.longitude,
        pickupQrPayload,
        pickupQrUnlocked: qrReady,
        routeBatchWindowEndsAt: fresh.routeBatchWindowEndsAt,
        isCustomerLocationLocked: true,
        customerAddressUnlocked: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const declineOrderOffer = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;
    await declineDriverOffer(orderId, riderId);
    return res.json({ success: true, message: "Order offer declined." });
  } catch (error) {
    next(error);
  }
};

export const getDriverPickupQr = async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const { orderId } = req.params;

    const order = await StoreOrder.findOne({
      _id: orderId,
      assignedRiderId: riderId,
      status: "assigned",
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Active assigned order not found" });
    }

    if (!isPickupQrReady(order)) {
      return res.status(409).json({
        success: false,
        message:
          "Pickup QR unlocks after the 5-minute same-route wait (or when a same-route order is batched).",
        pickupQrUnlocked: false,
        routeBatchWindowEndsAt: order.routeBatchWindowEndsAt,
      });
    }

    const pickupQr = await generateDriverPickupToken(order);
    return res.json({
      success: true,
      pickupQrPayload: pickupQr.qrPayload,
      expiresAt: pickupQr.expiresAt,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    next(error);
  }
};

const RIDER_ACTIVE_STATUSES = ["assigned", "pickup_verified", "out_for_delivery"];

/**
 * Pre-order as the rider sees it: customer name, phone and address appear only after
 * that order's QR is scanned, and disappear again once it is delivered or failed.
 */
function preOrderRiderJSON(order) {
  const active = RIDER_ACTIVE_STATUSES.includes(order.status);
  const scanned = Boolean(order.pickupQrScanned || order.qrScannedAt);
  const unlocked = Boolean(order.customerAddressUnlocked);
  const showCustomer = active && unlocked;
  const items = order.items || [];
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    preOrderDate: order.preOrderDate || "",
    preOrderSlot: order.preOrderSlot || "",
    itemCount: items.reduce((n, i) => n + Number(i.quantity || 0), 0),
    itemsSummary: items.map((i) => `${i.quantity}× ${i.name}`).join(", "),
    paymentMethod: order.paymentMethod || "",
    paymentStatus: order.paymentStatus || "pending",
    amountToCollect: Number(order.amountToCollect || 0),
    distanceKm: order.distanceKm ?? null,
    scanned,
    unlocked,
    delivered: order.status === "delivered",
    failed: order.status === "delivery_failed",
    deliveredAt: order.deliveredAt || null,
    customerName: showCustomer ? order.customerName || "Customer" : "",
    customerPhone: showCustomer ? order.customerPhone || "" : "",
    customerAddress: showCustomer ? order.customerAddress || "" : "",
    customerLat: showCustomer ? order.customerLat ?? null : null,
    customerLng: showCustomer ? order.customerLng ?? null : null,
  };
}

function istDayStart(date = new Date()) {
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(date.getTime() + IST_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_MS);
}

/** GET /preorders — every pre-order assigned to this rider: still to deliver + finished today. */
export const getRiderPreOrders = async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const orders = await StoreOrder.find({
      assignedRiderId: riderId,
      isPreOrder: true,
      $or: [
        { status: { $in: RIDER_ACTIVE_STATUSES } },
        {
          status: { $in: ["delivered", "delivery_failed"] },
          updatedAt: { $gte: istDayStart() },
        },
      ],
    }).sort({ assignedAt: 1, createdAt: 1 });

    const rank = (o) => (o.status === "out_for_delivery" ? 0 : o.status === "assigned" ? 1 : 2);
    const rows = orders
      .map(preOrderRiderJSON)
      .sort((a, b) => {
        const r = rank(a) - rank(b);
        if (r) return r;
        return (Number(a.distanceKm) || 0) - (Number(b.distanceKm) || 0);
      });

    const managerIds = [...new Set(orders.map((o) => String(o.managerId)))];
    const managers = managerIds.length
      ? await DeliveryManager.find({ _id: { $in: managerIds } }).select("storeName storeAddress phone")
      : [];
    const store = managers[0] || null;

    return res.json({
      success: true,
      store: store
        ? {
            name: store.storeName || "Dark store",
            address: store.storeAddress || "",
            phone: store.phone || "",
          }
        : null,
      summary: {
        total: rows.length,
        toScan: rows.filter((r) => r.status === "assigned").length,
        outForDelivery: rows.filter((r) => r.status === "out_for_delivery" || r.status === "pickup_verified").length,
        delivered: rows.filter((r) => r.delivered).length,
        failed: rows.filter((r) => r.failed).length,
      },
      orders: rows,
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveDelivery = async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const rider = await DeliveryBoy.findById(riderId);

    let orders = await StoreOrder.find({
      assignedRiderId: riderId,
      status: { $in: ["assigned", "pickup_verified", "out_for_delivery"] },
    }).sort({ batchSequence: 1, assignedAt: 1, updatedAt: -1 });

    if (!orders.length && rider?.activeOrderId) {
      const one = await StoreOrder.findOne({
        _id: rider.activeOrderId,
        assignedRiderId: riderId,
      });
      if (one && !["delivered", "delivery_failed", "cancelled"].includes(one.status)) {
        orders = [one];
      }
    }

    if (!orders.length) {
      if (rider?.activeOrderId) {
        await DeliveryBoy.findByIdAndUpdate(riderId, {
          $set: { activeOrderId: null, status: "online" },
        });
      }
      return res.json({
        success: true,
        activeDelivery: null,
        activeDeliveries: [],
      });
    }

    // Pre-orders don't need the rider to be online: an offline rider carrying only
    // pre-orders stays offline instead of being flipped to on_delivery.
    const offlinePreOrderRun = rider?.status === "offline" && orders.every((o) => o.isPreOrder);
    if (rider && !offlinePreOrderRun && (!rider.activeOrderId || rider.status !== "on_delivery")) {
      await DeliveryBoy.findByIdAndUpdate(riderId, {
        $set: { activeOrderId: orders[0]._id, status: "on_delivery" },
      });
    }

    const managerCache = new Map();
    const buildSafe = async (order) => {
      let manager = managerCache.get(String(order.managerId));
      if (!manager) {
        manager = await DeliveryManager.findById(order.managerId);
        managerCache.set(String(order.managerId), manager);
      }
      const unlocked = Boolean(order.customerAddressUnlocked);
      if (unlocked && (order.customerLat == null || order.customerLng == null)) {
        await refreshStoreOrderCustomerCoords(order);
      }
      let pickupQrPayload = null;
      const qrScanned = Boolean(order.pickupQrScanned || order.qrScannedAt);
      const pickupQrUnlocked = isPickupQrReady(order);
      if (!qrScanned && order.status === "assigned" && pickupQrUnlocked) {
        const pickupQr = await generateDriverPickupToken(order);
        pickupQrPayload = pickupQr.qrPayload;
      }
      const proofStatus = order.pickupProofStatus || "none";
      const itemsTotal = (order.items || []).reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );
      const amountToCollect = Number(order.amountToCollect || 0);
      const deliveryFee = Math.max(0, Math.round(amountToCollect - itemsTotal));
      const orderType = resolveStoreOrderType(order);
      return {
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        assignmentStatus: order.assignmentStatus,
        sourceOrderId: order.sourceOrderId ? order.sourceOrderId.toString() : null,
        orderType,
        trackingEnabled: isStoreOrderTrackable(order),
        isPreOrder: Boolean(order.isPreOrder),
        preOrderSlot: order.preOrderSlot || "",
        preOrderDate: order.preOrderDate || "",
        batchId: order.batchId || "",
        batchSequence: order.batchSequence || 0,
        distanceKm: order.distanceKm,
        darkStoreId: (order.darkStoreId || order.managerId).toString(),
        darkStoreName: manager?.storeName || `${order.area} Dark Store`,
        darkStoreAddress: manager?.storeAddress || `${order.area}, ${order.city}`,
        darkStorePhone: manager?.phone || null,
        darkStoreLat: manager?.latitude,
        darkStoreLng: manager?.longitude,
        pickupQrPayload,
        pickupQrUnlocked,
        routeBatchWindowEndsAt: order.routeBatchWindowEndsAt || null,
        items: order.items,
        pickupQrScanned: qrScanned,
        pickupQrScannedAt: order.pickupQrScannedAt || order.qrScannedAt,
        pickupProofStatus: proofStatus,
        pickupProofSubmittedAt: order.pickupProofSubmittedAt,
        pickupVerified: Boolean(order.pickupVerified),
        pickupVerifiedAt: order.pickupVerifiedAt,
        isCustomerLocationLocked: !unlocked,
        customerAddressUnlocked: unlocked,
        customerName: order.customerName || "Customer",
        customerPhone: unlocked ? (order.customerPhone || "") : "",
        customerAddress: unlocked
          ? order.customerAddress
          : order.isPreOrder
            ? "Scan this order's QR at the store to unlock the customer's address"
          : qrScanned && proofStatus === "pending"
            ? "Waiting for manager to approve your item photo"
            : qrScanned
              ? "Take item photo and send to manager to unlock address"
              : pickupQrUnlocked
                ? "Customer address unlocks after QR scan + manager item approval"
                : "Waiting for same-route search (up to 5 min) — then scan pickup QR",
        customerLat: unlocked ? order.customerLat : null,
        customerLng: unlocked ? order.customerLng : null,
        deliveryProofImageUrl: order.deliveryProofImageUrl || "",
        customerOtpVerified: Boolean(order.customerOtpVerified),
        deliveryComment: order.deliveryComment || "",
        failureReason: order.failureReason || "",
        deliveryDelay: deliveryDelayJSON(order.deliveryDelay),
        paymentMethod: order.paymentMethod || "",
        paymentStatus: order.paymentStatus || "pending",
        amountToCollect,
        amountCollected: order.amountCollected || 0,
        itemsTotal: Math.round(itemsTotal),
        deliveryFee,
        otpCode: null,
      };
    };

    const activeDeliveries = [];
    for (const o of orders) {
      activeDeliveries.push(await buildSafe(o));
    }
    activeDeliveries.sort((a, b) => {
      if ((a.batchSequence || 0) !== (b.batchSequence || 0)) {
        return (a.batchSequence || 0) - (b.batchSequence || 0);
      }
      return (Number(a.distanceKm) || 0) - (Number(b.distanceKm) || 0);
    });

    return res.json({
      success: true,
      activeDelivery: activeDeliveries[0] || null,
      activeDeliveries,
    });
  } catch (error) {
    next(error);
  }
};

export const scanPickupQr = async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const { orderId } = req.params;
    const scannedPayload = String(
      req.body.qrPayload || req.body.qrData || req.body.qrCode || ""
    ).trim();

    if (!scannedPayload) {
      return res.status(400).json({ success: false, message: "QR payload is required" });
    }

    const result = await verifyPickupByDriverScan({ driverId: riderId, scannedPayload });
    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }

    if (orderId && String(result.order._id) !== String(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Scanned QR does not match this order",
      });
    }

    const manager = await DeliveryManager.findById(result.order.managerId);

    if (result.order.isPreOrder) {
      const o = result.order;
      const unlocked = Boolean(o.customerAddressUnlocked);
      return res.json({
        success: true,
        message: unlocked
          ? `#${o.orderNumber} picked up — customer address unlocked`
          : "Pickup QR already scanned",
        preOrder: preOrderRiderJSON(o),
        activeDelivery: {
          id: o._id.toString(),
          orderNumber: o.orderNumber,
          status: o.status,
          darkStoreName: manager?.storeName || `${o.area} Dark Store`,
          darkStoreAddress: manager?.storeAddress || "",
          pickupQrScanned: true,
          pickupProofStatus: o.pickupProofStatus || "none",
          isCustomerLocationLocked: !unlocked,
          customerAddressUnlocked: unlocked,
        },
      });
    }

    return res.json({
      success: true,
      message: result.alreadyScanned
        ? "Pickup QR already scanned. Take item photo for manager approval."
        : "Pickup QR scanned! Now capture item photo for manager approval.",
      activeDelivery: {
        id: result.order._id.toString(),
        orderNumber: result.order.orderNumber,
        status: result.order.status,
        darkStoreName: manager?.storeName || `${result.order.area} Dark Store`,
        darkStoreAddress: manager?.storeAddress || "",
        pickupQrScanned: true,
        pickupProofStatus: result.order.pickupProofStatus || "none",
        isCustomerLocationLocked: true,
        customerAddressUnlocked: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getManagerOrderPickupQr = async (req, res, next) => {
  try {
    const managerId = req.user.id;
    const { orderId } = req.params;

    const order = await StoreOrder.findOne({
      _id: orderId,
      managerId,
      status: "assigned",
      assignedRiderId: { $ne: null },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Assigned order not found or not ready for pickup QR",
      });
    }

    if (!isPickupQrReady(order)) {
      return res.status(409).json({
        success: false,
        message:
          "Pickup QR is locked during the 5-minute same-route search. It unlocks when the wait ends or a same-route order is batched.",
        pickupQrUnlocked: false,
        routeBatchWindowEndsAt: order.routeBatchWindowEndsAt,
      });
    }

    const pickupQr = await generateDriverPickupToken(order, { issuedFor: "store" });
    const rider = await DeliveryBoy.findById(order.assignedRiderId).select("name phone");

    return res.json({
      success: true,
      orderNumber: order.orderNumber,
      pickupQrPayload: pickupQr.qrPayload,
      expiresAt: pickupQr.expiresAt,
      driverName: rider?.name || rider?.phone || "Delivery Partner",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload delivery proof photo (rider captures photo at customer location).
 * Saves to order.deliveryProofImageUrl. Must be called before OTP verification.
 */
export const uploadDeliveryProof = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;

    const imageBase64 = String(
      req.body.imageBase64 || req.body.image || req.body.deliveryProofImage || ""
    ).trim();

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: "Delivery proof image is required" });
    }

    const order = await StoreOrder.findOne({
      _id: orderId,
      assignedRiderId: riderId,
      status: { $in: ["assigned", "pickup_verified", "out_for_delivery"] },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Active order not found or not in delivery state",
      });
    }

    if (!order.customerAddressUnlocked) {
      return res.status(400).json({
        success: false,
        message: "Customer address must be unlocked before uploading delivery proof",
      });
    }

    // Upload to S3 if configured, otherwise store as-is (base64 data URL)
    let proofUrl = imageBase64;
    try {
      if (isS3Configured() && imageBase64.startsWith("data:")) {
        const s3Res = await uploadDataUrlToS3(imageBase64, "delivery-proofs");
        if (s3Res?.url) {
          proofUrl = s3Res.url;
        } else if (typeof s3Res === "string") {
          proofUrl = s3Res;
        }
      }
    } catch (err) {
      console.warn("[delivery-proof] S3 upload failed, storing data URL:", err.message);
    }

    order.deliveryProofImageUrl = String(proofUrl);
    order.proofUploadedAt = new Date();
    await order.save();

    return res.json({
      success: true,
      message: "Delivery proof uploaded. Please ask customer for OTP.",
      deliveryProofImageUrl: order.deliveryProofImageUrl,
      proofUploadedAt: order.proofUploadedAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify customer OTP (backend validates — never trust Flutter).
 * OTP is rate-limited to MAX_OTP_ATTEMPTS.
 */
export const verifyCustomerOtp = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;
    const otp = String(req.body.otp || "").trim();

    if (!otp) {
      return res.status(400).json({ success: false, message: "OTP is required" });
    }

    const order = await StoreOrder.findOne({
      _id: orderId,
      assignedRiderId: riderId,
      status: { $in: OTP_STATUSES },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "OTP can be checked only after pickup, when the order is out for delivery",
      });
    }

    if (order.customerOtpVerified) {
      return res.json({ success: true, alreadyVerified: true, message: "OTP already verified" });
    }

    const otpError = await checkCustomerOtp(order, otp);
    if (otpError) return res.status(otpError.status).json(otpError.body);

    const now = new Date();
    order.customerOtpVerified = true;
    order.customerOtpVerifiedAt = now;
    order.otpAttempts = 0;
    order.otpLockedUntil = undefined;
    await order.save();

    return res.json({
      success: true,
      message: "OTP verified successfully. You can now complete the delivery.",
      customerOtpVerified: true,
      customerOtpVerifiedAt: order.customerOtpVerifiedAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send / Resend Delivery Verification OTP to customer via MSG91 (Template: Delivery_verification_OTP)
 */
export const sendCustomerDeliveryOtp = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;

    const order = await StoreOrder.findOne({
      _id: orderId,
      assignedRiderId: riderId,
      status: { $in: OTP_STATUSES },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "OTP can be sent only after pickup, when the order is out for delivery",
      });
    }

    if (order.customerOtpVerified) {
      return res.json({ success: true, alreadyVerified: true, message: "OTP already verified" });
    }

    const result = await sendDeliveryOtpSms(order);
    if (!result.success) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      message: "Delivery verification OTP sent to customer via SMS",
      customerPhoneHint: result.customerPhone.slice(-4),
      devMock: result.devMock,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm cash collection from customer.
 * Updates order payment fields and creates a CashSettlement record.
 * Backend remains source of truth — Flutter cannot submit arbitrary amounts.
 */
export const confirmCashCollection = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;

    const existing = await StoreOrder.findOne({ _id: orderId, assignedRiderId: riderId });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Active order not found" });
    }
    if (existing.paymentStatus === "paid_online") {
      return res.status(400).json({
        success: false,
        message: "This order is already paid online. No cash collection required.",
      });
    }
    if (existing.paymentStatus === "collected") {
      return res.json({ success: true, alreadyCollected: true, message: "Cash already marked as collected" });
    }
    if (!OTP_STATUSES.includes(existing.status)) {
      return res.status(400).json({
        success: false,
        message: "Collect cash only at the customer's door, after pickup",
      });
    }
    if (!existing.customerOtpVerified) {
      return res.status(400).json({
        success: false,
        message: "Verify the customer's OTP before collecting cash",
      });
    }

    let amount = Math.round(Number(existing.amountToCollect || 0));
    if (amount <= 0) {
      // Older orders: the billed part total already includes the delivery fee.
      const itemsTotal = (existing.items || []).reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );
      amount = Math.round(Number(existing.partTotal || 0) || itemsTotal);
      if (amount <= 0) {
        return res.status(400).json({ success: false, message: "No amount to collect for this order" });
      }
    }

    const order = await StoreOrder.findOneAndUpdate(
      {
        _id: orderId,
        assignedRiderId: riderId,
        status: { $in: OTP_STATUSES },
        customerOtpVerified: true,
        paymentStatus: { $nin: ["collected", "paid_online"] },
      },
      {
        $set: {
          paymentMethod: "COD",
          paymentStatus: "collected",
          amountToCollect: amount,
          amountCollected: amount,
        },
      },
      { new: true }
    );
    if (!order) {
      return res.json({ success: true, alreadyCollected: true, message: "Cash already marked as collected" });
    }

    // Create cash liability record and increment rider's pending cash
    const darkStoreId = order.darkStoreId || order.managerId;
    await createCashLiability({
      orderId: order._id,
      riderId,
      darkStoreId,
      amount: order.amountToCollect,
      orderNumber: order.orderNumber,
    });

    return res.json({
      success: true,
      message: `Cash ₹${order.amountToCollect} collected. This amount must be submitted to the Dark Store.`,
      amountCollected: order.amountToCollect,
      paymentStatus: "collected",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Main delivery completion endpoint.
 *
 * Pre-conditions enforced by backend (not trusted from Flutter):
 *   1. Order is in valid delivery state
 *   2. Rider is assigned to this order
 *   3. Customer address was unlocked (pickup verified)
 *   4. Delivery proof photo uploaded
 *   5. Customer OTP verified by backend
 *   6. Payment: either paid_online OR cash collected (paymentStatus = collected)
 *
 * On success:
 *   - Order status → delivered
 *   - Calculate delivery distance and earning from Shift slabs
 *   - Update rider statistics (todayEarnings, totalLifetimeEarnings, todayCompletedOrders)
 *   - Note: Gig/incentive bonus is calculated separately via checkAndTrackIncentive
 */
export const completeDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;

    let order = await StoreOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.assignedRiderId?.toString() !== riderId) {
      return res.status(403).json({ success: false, message: "You are not assigned to this order" });
    }

    // Already delivered?
    if (order.status === "delivered") {
      return res.json({ success: true, alreadyDelivered: true, message: "Order already delivered", order: order.toRiderJSON() });
    }

    if (!OTP_STATUSES.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order is ${order.status.replace(/_/g, " ")} — it cannot be completed`,
      });
    }

    // ── Condition 1: Customer address must have been unlocked ──────────────
    if (!order.customerAddressUnlocked) {
      return res.status(400).json({
        success: false,
        message: "Pickup must be verified and item proof approved before delivery",
      });
    }

    // ── Condition 2: Delivery proof photo must be uploaded ─────────────────
    if (!order.deliveryProofImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Delivery proof photo is required. Capture a photo at the customer's location.",
      });
    }

    // ── Condition 3: Customer OTP must be verified ─────────────────────────
    if (!order.customerOtpVerified) {
      const otp = String(req.body.otp || "").trim();
      if (!otp) {
        return res.status(400).json({
          success: false,
          message: "Ask the customer for the Delivery OTP shown in their order screen.",
        });
      }

      const otpError = await checkCustomerOtp(order, otp);
      if (otpError) return res.status(otpError.status).json(otpError.body);
    }

    // ── Condition 4: Payment must be resolved ──────────────────────────────
    const itemsTotal = (order.items || []).reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
    const amountDue = Number(order.amountToCollect || 0) || Number(order.partTotal || 0) || itemsTotal;
    const paymentOk =
      order.paymentStatus === "paid_online" ||
      order.paymentStatus === "collected" ||
      amountDue <= 0;

    if (!paymentOk) {
      return res.status(400).json({
        success: false,
        message:
          order.onlinePaymentClaim?.status === "pending"
            ? "Online payment is waiting for your Delivery Manager's approval"
            : "Payment must be collected or confirmed before completing delivery",
      });
    }

    const now = new Date();
    const comment = String(req.body.deliveryComment || req.body.comment || "")
      .trim()
      .slice(0, 500);

    // Only one request can move the order to delivered — retries and double taps stop here.
    const claimed = await StoreOrder.findOneAndUpdate(
      { _id: order._id, assignedRiderId: riderId, status: { $in: OTP_STATUSES } },
      {
        $set: {
          status: "delivered",
          assignmentStatus: "DELIVERED",
          deliveredAt: now,
          customerOtpVerified: true,
          customerOtpVerifiedAt: order.customerOtpVerifiedAt || now,
          otpAttempts: 0,
          ...(comment ? { deliveryComment: comment } : {}),
        },
        $unset: { otpLockedUntil: 1 },
      },
      { new: true }
    );
    if (!claimed) {
      const fresh = await StoreOrder.findById(order._id);
      if (fresh?.status === "delivered") {
        return res.json({ success: true, alreadyDelivered: true, message: "Order already delivered", order: fresh.toRiderJSON() });
      }
      return res.status(409).json({ success: false, message: "Order changed — refresh and try again" });
    }
    order = claimed;

    // ── Calculate rider delivery earning from Shift KM slabs ───────────────
    const rider = await DeliveryBoy.findById(riderId);
    const darkStore = await DeliveryManager.findById(order.managerId);

    const shiftIdForCalc = order.shiftId || rider?.currentBooking?.shiftId || null;
    const rawEarningResult = await calculateRiderEarning({
      shiftId: shiftIdForCalc,
      managerId: order.managerId,
      riderId,
      atDate: order.assignedAt || order.packedAt || now,
      storeLat: darkStore?.latitude ?? null,
      storeLng: darkStore?.longitude ?? null,
      customerLat: order.customerLat ?? null,
      customerLng: order.customerLng ?? null,
    });
    // Full-Time drivers and pre-orders are salary-based: keep distance for tracking, never credit per-KM.
    const isFullTimeRider = rider?.employmentType === "FULL_TIME";
    const salaryBased = isFullTimeRider || Boolean(order.isPreOrder);
    const earningResult = salaryBased
      ? { ...rawEarningResult, riderEarning: 0, earningSlab: null, shift: null }
      : rawEarningResult;
    if (isFullTimeRider) order.fullTimeDelivery = true;
    const stayOffline = Boolean(order.isPreOrder) && rider?.status === "offline";

    const distanceKm = earningResult.distanceKm;
    const riderDeliveryEarning = earningResult.riderEarning;
    const earningSlab = earningResult.earningSlab;

    applyEarningSnapshot(order, darkStore, earningResult, now);
    if (earningResult.shift?._id && !order.shiftId) {
      order.shiftId = earningResult.shift._id;
    }
    if (shiftIdForCalc && !order.shiftId) order.shiftId = shiftIdForCalc;

    await order.save();
    try {
      await syncCustomerOrderFromStore(order, "delivered");
    } catch (syncErr) {
      console.warn("[completeDelivery] syncCustomerOrderFromStore error:", syncErr?.message || syncErr);
    }

    // ── Update rider statistics ────────────────────────────────────────────
    if (rider) {
      if (!stayOffline) rider.status = "online";
      rider.activeOrderId = null;
      rider.todayCompletedOrders = (rider.todayCompletedOrders || 0) + 1;
      // Delayed 5-minute wallet credit: delivery earning credited after 5 minutes
      rider.lastOrderCompletedAt = now;
      rider.lastStatusAt = now;
      if (!stayOffline) rider.onlineSince = rider.onlineSince || now;
      await rider.save();
    }

    // ── Gig / Incentive bonus (separate from delivery earning) ─────────────
    if (!salaryBased) {
      await checkAndTrackIncentive(riderId, order.managerId).catch(() => {});
    }
    {
      const { creditKmIncentiveForOrder } = await import("../services/slotAssignmentService.js");
      await creditKmIncentiveForOrder(order, riderId);
    }

    if (riderDeliveryEarning > 0) {
      try {
        const { scheduleWalletCredit } = await import("../services/WalletCreditService.js");
        await scheduleWalletCredit({
          orderId: order._id,
          riderId,
          amount: riderDeliveryEarning,
          orderNumber: order.orderNumber,
        });
      } catch (err) {
        console.warn("[completeDelivery] scheduleWalletCredit failed:", err.message);
      }
    }

    // ── Notify Dark Store ──────────────────────────────────────────────────
    try {
      getIO().to(`store_${order.managerId}`).emit("order_delivered", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: "delivered",
        deliveredAt: order.deliveredAt,
        deliveryComment: order.deliveryComment || "",
        deliveryDistanceKm: order.deliveryDistanceKm,
        riderDeliveryEarning: order.riderDeliveryEarning,
      });
      getIO().to(`store_${order.managerId}`).emit("order_status_updated", {
        orderId: order._id.toString(),
        status: "delivered",
      });
    } catch (err) {}

    // If rider still has other active stops in a batch, keep them on_delivery
    if (rider && !stayOffline) {
      const otherActive = await StoreOrder.findOne({
        assignedRiderId: riderId,
        _id: { $ne: order._id },
        status: {
          $in: ["assigned", "pickup_verified", "out_for_delivery"],
        },
      }).select("_id");
      if (otherActive) {
        rider.status = "on_delivery";
        rider.activeOrderId = otherActive._id;
        await rider.save();
      }
    }

    retryWaitingAssignmentsForStore(order.managerId).catch(() => {});

    return res.json({
      success: true,
      message: "Order delivered successfully!",
      order: order.toRiderJSON(),
      deliverySummary: {
        distanceKm: order.deliveryDistanceKm,
        riderDeliveryEarning: order.riderDeliveryEarning,
        earningSlab: order.earningSlab,
        paymentStatus: order.paymentStatus,
        amountCollected: order.amountCollected,
        deliveryComment: order.deliveryComment || "",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark delivery as failed with a required reason (customer unavailable, etc.).
 */
export const failDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;
    const reason = String(req.body.failureReason || req.body.reason || req.body.comment || "")
      .trim()
      .slice(0, 800);

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Failure reason / comment is required",
      });
    }

    const order = await StoreOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.assignedRiderId?.toString() !== riderId) {
      return res.status(403).json({ success: false, message: "You are not assigned to this order" });
    }
    if (["delivered", "delivery_failed", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order already ${order.status}`,
      });
    }
    if (!OTP_STATUSES.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "You haven't picked this order up yet — ask your Delivery Manager to reassign it",
      });
    }

    const now = new Date();
    const failed = await StoreOrder.findOneAndUpdate(
      { _id: order._id, assignedRiderId: riderId, status: { $in: OTP_STATUSES } },
      {
        $set: {
          status: "delivery_failed",
          assignmentStatus: "FAILED",
          failureReason: reason,
          failedAt: now,
          failedByRiderId: riderId,
          failureResolution: { status: "pending", byName: "", note: "", at: null },
        },
        $inc: { deliveryAttempts: 1 },
      },
      { new: true }
    );
    if (!failed) {
      return res.status(409).json({ success: false, message: "Order changed — refresh and try again" });
    }
    if (failed.paymentStatus === "collected") {
      await resolveCashForOrder({
        orderId: failed._id,
        outcome: "flag",
        note: `Delivery failed after cash was collected: ${reason}`,
      }).catch(() => {});
    }

    const rider = await DeliveryBoy.findById(riderId);
    if (rider) {
      const otherActive = await StoreOrder.findOne({
        assignedRiderId: riderId,
        _id: { $ne: order._id },
        status: {
          $in: ["assigned", "pickup_verified", "out_for_delivery"],
        },
      }).select("_id");
      if (otherActive) {
        rider.activeOrderId = otherActive._id;
        rider.status = "on_delivery";
      } else {
        rider.activeOrderId = null;
        rider.status = "online";
      }
      rider.lastStatusAt = now;
      await rider.save();
    }

    retryWaitingAssignmentsForStore(order.managerId).catch(() => {});

    try {
      getIO().to(`store_${order.managerId}`).emit("order_delivery_failed", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: "delivery_failed",
        failureReason: reason,
        failedAt: now,
        riderId: String(riderId),
      });
      getIO().to(`store_${order.managerId}`).emit("order_status_updated", {
        orderId: order._id.toString(),
        status: "delivery_failed",
        failureReason: reason,
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: "Delivery marked as failed — bring the order back to the store",
      order: failed.toRiderJSON(),
    });
  } catch (error) {
    next(error);
  }
};

const DELAY_REPORTABLE_STATUSES = new Set(["assigned", "pickup_verified", "out_for_delivery"]);
const MAX_DELAY_MINUTES = 12 * 60;

/** POST /orders/:orderId/delay  { hours, minutes, reason } — rider tells the store the order will be late. */
export const reportDeliveryDelay = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;
    const hours = Math.max(0, Math.floor(Number(req.body.hours) || 0));
    const mins = Math.max(0, Math.floor(Number(req.body.minutes) || 0));
    const total = hours * 60 + mins;
    const reason = String(req.body.reason || "").trim().slice(0, 300);

    if (total < 1 || total > MAX_DELAY_MINUTES) {
      return res.status(400).json({
        success: false,
        message: "Delay must be between 1 minute and 12 hours",
      });
    }

    const order = await StoreOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.assignedRiderId?.toString() !== riderId) {
      return res.status(403).json({ success: false, message: "You are not assigned to this order" });
    }
    if (!DELAY_REPORTABLE_STATUSES.has(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot report a delay — order is ${order.status}`,
      });
    }

    const now = new Date();
    order.deliveryDelay = {
      minutes: total,
      reason,
      reportedAt: now,
      expectedBy: new Date(now.getTime() + total * 60000),
      customerNotifiedAt: null,
    };
    await order.save();

    try {
      getIO().to(`store_${order.managerId}`).emit("order_delay_reported", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        riderId: String(riderId),
        deliveryDelay: deliveryDelayJSON(order.deliveryDelay),
      });
      getIO().to(`store_${order.managerId}`).emit("order_status_updated", {
        orderId: order._id.toString(),
        status: order.status,
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: "Delay sent to your Delivery Manager",
      deliveryDelay: deliveryDelayJSON(order.deliveryDelay),
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPickupByManager = async (req, res, next) => {
  try {
    const managerId = req.user.id;
    const { orderId } = req.params;
    const scannedPayload = String(req.body.qrPayload || req.body.token || "").trim();

    const result = await verifyPickupScan({
      darkStoreId: managerId,
      orderId,
      scannedPayload,
      verifiedBy: managerId,
    });

    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }

    return res.json({
      success: true,
      message: result.alreadyScanned
        ? "Pickup QR already scanned for this order."
        : "Pickup QR scanned. Driver should send item photo for approval.",
      order: result.order.toSafeJSON(),
      driver: result.driver,
    });
  } catch (error) {
    next(error);
  }
};

export const submitPickupProofByDriver = async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const { orderId } = req.params;
    const imageBase64 = String(
      req.body.imageBase64 || req.body.pickupProofImage || req.body.image || ""
    ).trim();

    const result = await submitPickupProof({ orderId, driverId: riderId, imageBase64 });
    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }

    return res.json({
      success: true,
      message: result.alreadySubmitted
        ? "Item photo already sent. Waiting for manager approval."
        : "Item photo sent to manager. Address unlocks after approval.",
      activeDelivery: {
        id: result.order._id.toString(),
        orderNumber: result.order.orderNumber,
        pickupQrScanned: true,
        pickupProofStatus: result.order.pickupProofStatus,
        isCustomerLocationLocked: true,
        customerAddressUnlocked: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const approvePickupProofByManager = async (req, res, next) => {
  try {
    const managerId = req.user.id;
    const { orderId } = req.params;

    const result = await approvePickupProof({ orderId, managerId });
    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }

    return res.json({
      success: true,
      message: result.alreadyApproved
        ? "Item proof already approved."
        : "Item proof approved. Driver can now navigate to customer.",
      order: result.order.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rider confirms online payment from customer (e.g. UPI/Razorpay at delivery).
 * Backend must be the source of truth — Flutter cannot set paymentStatus directly.
 * POST /rider/orders/:orderId/confirm-online-payment
 */
export const confirmOnlinePaymentForOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;

    const order = await StoreOrder.findOne({
      _id: orderId,
      assignedRiderId: riderId,
    });

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.paymentStatus === "collected") {
      return res.status(400).json({ success: false, message: "Cash already collected for this order." });
    }
    if (order.paymentStatus === "paid_online") {
      return res.json({ success: true, message: "Order already marked as paid online.", paymentStatus: "paid_online" });
    }
    if (!OTP_STATUSES.includes(order.status) || !order.customerOtpVerified) {
      return res.status(400).json({
        success: false,
        message: "Verify the customer's OTP at the door before confirming payment",
      });
    }

    // A Razorpay payment confirmed on the customer order (webhook / checkout verify) is the only automatic proof.
    if (order.sourceOrderId) {
      const { default: EcommerceOrder } = await import("../../../legacy/models/order/Order.js");
      const customerOrder = await EcommerceOrder.findById(order.sourceOrderId)
        .select("paymentStatus razorpayPaymentId")
        .lean();
      if (customerOrder?.paymentStatus === "paid" && customerOrder?.razorpayPaymentId) {
        order.paymentMethod = "online";
        order.paymentStatus = "paid_online";
        order.amountCollected = order.amountToCollect || 0;
        order.onlinePaymentClaim = {
          ...(order.onlinePaymentClaim?.toObject?.() || {}),
          status: "approved",
          reviewedAt: new Date(),
          reviewedByName: "Razorpay",
        };
        await order.save();
        return res.json({
          success: true,
          message: "Online payment verified.",
          paymentStatus: "paid_online",
          amountCollected: order.amountCollected,
        });
      }
    }

    const claim = order.onlinePaymentClaim || {};
    if (claim.status === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Your Delivery Manager rejected the online payment — collect cash from the customer",
      });
    }
    if (claim.status !== "pending") {
      order.onlinePaymentClaim = {
        status: "pending",
        riderId,
        claimedAt: new Date(),
        reviewedAt: null,
        reviewedByName: "",
        note: "",
      };
      await order.save();
      try {
        getIO().to(`store_${order.managerId}`).emit("online_payment_claim", {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          amount: order.amountToCollect || 0,
          riderId: String(riderId),
        });
        getIO().to(`store_${order.managerId}`).emit("order_status_updated", {
          orderId: order._id.toString(),
          status: order.status,
        });
      } catch (_) {}
    }

    return res.status(409).json({
      success: false,
      pendingApproval: true,
      message: "Online payment sent to your Delivery Manager for approval. Tap Online again once it is approved.",
    });
  } catch (error) {
    next(error);
  }
};

/** POST /orders/:orderId/failed/:action (return | reattempt) — manager decides what happens to a failed delivery. */
export const resolveFailedOrderByManager = async (req, res, next) => {
  try {
    const managerId = req.user.id;
    const manager = await DeliveryManager.findById(managerId).select("name storeName");
    const { resolveFailedDelivery } = await import("../services/storeOrderLifecycle.js");
    const result = await resolveFailedDelivery({
      orderId: req.params.orderId,
      managerId,
      action: req.params.action,
      note: req.body?.note,
      byName: manager?.name || manager?.storeName || "Delivery Manager",
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, message: result.message });
    }
    return res.json({ success: true, message: result.message, order: result.order.toSafeJSON() });
  } catch (error) {
    next(error);
  }
};

/** POST /orders/:orderId/online-payment/:decision (approve | reject) — manager reviews a rider's online-payment claim. */
export const reviewOnlinePaymentClaim = async (req, res, next) => {
  try {
    const managerId = req.user.id;
    const { orderId, decision } = req.params;
    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({ success: false, message: "Decision must be approve or reject" });
    }
    const order = await StoreOrder.findOne({ _id: orderId, managerId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.onlinePaymentClaim?.status !== "pending") {
      return res.status(400).json({ success: false, message: "No online payment waiting for approval" });
    }

    const manager = await DeliveryManager.findById(managerId).select("name storeName");
    const now = new Date();
    order.onlinePaymentClaim.status = decision === "approve" ? "approved" : "rejected";
    order.onlinePaymentClaim.reviewedAt = now;
    order.onlinePaymentClaim.reviewedByName = manager?.name || manager?.storeName || "Delivery Manager";
    order.onlinePaymentClaim.note = String(req.body?.note || "").trim().slice(0, 300);
    if (decision === "approve") {
      order.paymentMethod = "online";
      order.paymentStatus = "paid_online";
      order.amountCollected = order.amountToCollect || 0;
    }
    await order.save();

    try {
      const payload = {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        decision,
        message:
          decision === "approve"
            ? "Online payment approved — you can complete the delivery"
            : "Online payment rejected — collect cash from the customer",
      };
      getIO().to(`rider_${order.assignedRiderId}`).emit("online_payment_reviewed", payload);
      getIO().to(`rider_${order.assignedRiderId}`).emit("active_delivery_updated", {
        reason: "online_payment_reviewed",
        orderId: order._id.toString(),
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: decision === "approve" ? "Online payment approved" : "Online payment rejected",
      order: order.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment status for an order (rider view).
 * GET /rider/orders/:orderId/payment-status
 */
export const getOrderPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const riderId = req.user.id;

    const order = await StoreOrder.findOne({ _id: orderId, assignedRiderId: riderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    return res.json({
      success: true,
      payment: getPaymentSummary(order),
    });
  } catch (error) {
    next(error);
  }
};
