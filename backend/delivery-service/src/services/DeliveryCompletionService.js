/**
 * DeliveryCompletionService
 *
 * Orchestrates the full delivery completion flow.
 *
 * Conditions to complete delivery:
 *   1. Pickup must be verified (customerAddressUnlocked === true)
 *   2. Delivery proof photo must be uploaded (deliveryProofImageUrl set)
 *   3. Customer OTP must be verified on backend (customerOtpVerified === true)
 *   4. Payment must be settled (paid_online OR collected)
 *
 * After conditions are met:
 *   - Calculate delivery distance via GPS
 *   - Find rider's current shift and earning slabs
 *   - Calculate riderDeliveryEarning
 *   - Save permanently on Order (historical — never changed again)
 *   - Update DeliveryBoy earnings atomically
 *   - Trigger Gig/Incentive tracking (existing checkAndTrackIncentive)
 */

import mongoose from "mongoose";
import StoreOrder from "../models/StoreOrder.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import { calculateRiderEarning, applyEarningSnapshot } from "./ShiftEarningService.js";
import { validatePaymentForCompletion } from "./PaymentCollectionService.js";
import { getIO } from "../../../socket.js";
import { syncCustomerOrderFromStore } from "./syncCustomerOrderFromStore.js";
import { getRouteAndEta } from "./directionsService.js";

const MAX_OTP_ATTEMPTS = 5;

/**
 * Validate and verify the customer OTP for an order.
 *
 * @param {object} params
 * @param {string|ObjectId} params.orderId
 * @param {string|ObjectId} params.riderId
 * @param {string} params.otp
 * @returns {Promise<{success: boolean, message: string, order?: object}>}
 */
export async function verifyCustomerOtp({ orderId, riderId, otp }) {
  const order = await StoreOrder.findById(orderId);
  if (!order) return { success: false, message: "Order not found" };

  if (order.assignedRiderId?.toString() !== riderId.toString()) {
    return { success: false, message: "You are not assigned to this order" };
  }

  if (order.customerOtpVerified) {
    return { success: true, message: "OTP already verified.", order };
  }

  // OTP expiry (if set)
  if (order.otpExpiresAt && new Date() > new Date(order.otpExpiresAt)) {
    return { success: false, message: "OTP has expired. Please request a new one." };
  }

  // Brute-force protection
  if ((order.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    return { success: false, message: "Too many OTP attempts. Contact support." };
  }

  const expected = String(order.deliveryOtp || order.otpCode || "").trim();
  const submitted = String(otp || "").trim();

  if (!expected || submitted !== expected) {
    await StoreOrder.findByIdAndUpdate(orderId, { $inc: { otpAttempts: 1 } });
    const remaining = MAX_OTP_ATTEMPTS - ((order.otpAttempts || 0) + 1);
    return {
      success: false,
      message: `Invalid OTP. ${remaining > 0 ? `${remaining} attempts remaining.` : "No attempts left."}`,
    };
  }

  await StoreOrder.findByIdAndUpdate(orderId, {
    $set: {
      customerOtpVerified: true,
      customerOtpVerifiedAt: new Date(),
    },
  });

  order.customerOtpVerified = true;
  order.customerOtpVerifiedAt = new Date();
  return { success: true, message: "OTP verified successfully.", order };
}

/**
 * Validate all pre-conditions for delivery completion.
 * Returns { canComplete: boolean, missing: string[] }
 */
export function validateCompletionConditions(order) {
  const missing = [];

  if (!order.customerAddressUnlocked) {
    missing.push("Pickup not verified by manager");
  }
  if (!order.deliveryProofImageUrl) {
    missing.push("Delivery proof photo not uploaded");
  }
  if (!order.customerOtpVerified) {
    missing.push("Customer OTP not verified");
  }

  const paymentCheck = validatePaymentForCompletion(order);
  if (!paymentCheck.canProceed) {
    missing.push(paymentCheck.message || "Payment not completed");
  }

  return { canComplete: missing.length === 0, missing };
}

/**
 * Complete the delivery:
 *  - Run pre-condition checks
 *  - Calculate distance and rider earning from shift slabs
 *  - Update order as delivered with permanent earning snapshot
 *  - Update DeliveryBoy earnings atomically
 *  - Emit socket events
 *
 * @param {object} params
 * @param {string|ObjectId} params.orderId
 * @param {string|ObjectId} params.riderId
 * @param {boolean} [params.skipConditionCheck=false] - for internal/test use only
 * @returns {Promise<{success: boolean, message: string, order?: object, earningBreakdown?: object}>}
 */
export async function completeDelivery({ orderId, riderId, skipConditionCheck = false }) {
  // Resolve the earning route before opening the Mongo transaction so a remote
  // directions request cannot hold the transaction open. Only road routes from
  // Google or OSRM count toward commission; estimates are deliberately excluded.
  let routeKm = 0;
  let routeSource = "";
  try {
    const routeOrder = await StoreOrder.findById(orderId).select("managerId customerLat customerLng").lean();
    if (routeOrder?.managerId && routeOrder.customerLat != null && routeOrder.customerLng != null) {
      const store = await DeliveryManager.findById(routeOrder.managerId).select("latitude longitude").lean();
      const route = await getRouteAndEta({
        cacheKey: `delivery:${orderId}`,
        origin: { lat: store?.latitude, lng: store?.longitude },
        destination: { lat: routeOrder.customerLat, lng: routeOrder.customerLng },
      });
      if (route && ["google", "google_v2", "osrm"].includes(route.source) && Number(route.distanceMeters) > 0) {
        routeKm = Math.round((Number(route.distanceMeters) / 1000) * 100) / 100;
        routeSource = route.source;
      }
    }
  } catch (err) {
    console.warn("[completion] road distance unavailable; commission distance set to zero:", err.message);
  }
  const session = await mongoose.startSession();
  let committed = false;
  try {
    session.startTransaction();

    const order = await StoreOrder.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return { success: false, message: "Order not found" };
    }

    if (order.assignedRiderId?.toString() !== riderId.toString()) {
      await session.abortTransaction();
      return { success: false, message: "You are not assigned to this order" };
    }

    if (order.status === "delivered") {
      await session.abortTransaction();
      return { success: true, alreadyDelivered: true, message: "Order already delivered.", order };
    }

    const completable = skipConditionCheck
      ? ["assigned", "pickup_verified", "out_for_delivery"]
      : ["pickup_verified", "out_for_delivery"];
    if (!completable.includes(order.status)) {
      await session.abortTransaction();
      return {
        success: false,
        message: `Order is ${order.status.replace(/_/g, " ")} — it cannot be completed`,
      };
    }

    if (!skipConditionCheck) {
      const { canComplete, missing } = validateCompletionConditions(order);
      if (!canComplete) {
        await session.abortTransaction();
        return {
          success: false,
          message: `Cannot complete delivery: ${missing.join("; ")}`,
          missing,
        };
      }
    }

    // Fetch Dark Store for GPS coordinates
    const darkStore = await DeliveryManager.findById(order.managerId);
    const storeLat = darkStore?.latitude ?? null;
    const storeLng = darkStore?.longitude ?? null;
    const customerLat = order.customerLat ?? null;
    const customerLng = order.customerLng ?? null;

    // Determine which shift to use: order.shiftId (set at accept time) or rider's currentBooking
    const rider = await DeliveryBoy.findById(riderId).session(session);
    const shiftId = order.shiftId || rider?.currentBooking?.shiftId || null;
    const now = new Date();

    // Calculate earning (backend is source of truth)
    const rawEarningResult = await calculateRiderEarning({
      shiftId,
      managerId: order.managerId,
      riderId,
      atDate: order.assignedAt || order.packedAt || now,
      storeLat,
      storeLng,
      customerLat,
      customerLng,
    });
    // Full-Time drivers and pre-orders are salary-based: keep distance for tracking, never credit per-KM.
    const isFullTimeRider = rider?.employmentType === "FULL_TIME";
    const paymentMode = rider?.paymentMode || null;
    const paymentActive = rider?.paymentActive === true;
    const usesCommission = paymentActive && paymentMode === "per_km_commission";
    const configuredInactive = paymentMode != null && !paymentActive;
    const salaryBased = isFullTimeRider || Boolean(order.isPreOrder) ||
      (paymentActive && paymentMode === "monthly_salary");
    const earningResult = usesCommission
      ? {
          ...rawEarningResult,
          distanceKm: routeKm,
          riderEarning: routeKm > 0 ? Math.round(routeKm * (Number(rider.commissionRatePerKm) || 0) * 100) / 100 : 0,
          earningSlab: null,
          shift: null,
          distanceBasis: "dark_store_to_customer_road_route",
        }
      : (salaryBased || configuredInactive)
        ? { ...rawEarningResult, distanceKm: routeKm, riderEarning: 0, earningSlab: null, shift: null }
        : rawEarningResult;
    const stayOffline = Boolean(order.isPreOrder) && rider?.status === "offline";
    if (isFullTimeRider) order.fullTimeDelivery = true;

    const riderEarning = earningResult.riderEarning;
    const distanceKm = earningResult.distanceKm;
    const earningSlab = earningResult.earningSlab;

    // Update order to delivered — save earning permanently on order document
    order.status = "delivered";
    order.assignmentStatus = "DELIVERED";
    order.deliveredAt = now;
    applyEarningSnapshot(order, darkStore, earningResult, now);
    order.paymentSnapshot = {
      mode: paymentMode,
      active: paymentActive,
      ratePerKm: usesCommission ? Number(rider.commissionRatePerKm) || 0 : 0,
      distanceKm: routeKm,
      distanceSource: routeSource,
      commissionAmount: usesCommission ? riderEarning : 0,
      riderId: riderId.toString(),
      capturedAt: now,
    };
    if (earningResult.shift?._id && !order.shiftId) {
      order.shiftId = earningResult.shift._id;
    }
    await order.save({ session });

    // Update rider statistics atomically
    if (rider) {
      if (!stayOffline) rider.status = "online";
      rider.activeOrderId = null;
      rider.todayCompletedOrders = (rider.todayCompletedOrders || 0) + 1;
      // Delayed 5-minute wallet credit: earning is scheduled and credited after 5 minutes
      rider.lastOrderCompletedAt = now;
      rider.lastStatusAt = now;
      await rider.save({ session });
    }

    await session.commitTransaction();
    committed = true;

    {
      const { creditKmIncentiveForOrder } = await import("./slotAssignmentService.js");
      await creditKmIncentiveForOrder(order, riderId);
    }

    // 5-minute delayed wallet credit and notification
    if (riderEarning > 0) {
      try {
        const { scheduleWalletCredit } = await import("./WalletCreditService.js");
        await scheduleWalletCredit({
          orderId: order._id,
          riderId,
          amount: riderEarning,
          orderNumber: order.orderNumber,
        });
      } catch (err) {
        console.warn("[completion] scheduleWalletCredit failed:", err.message);
      }
    }

    // Emit socket events (non-blocking)
    try {
      const io = getIO();
      io.to(`store_${order.managerId}`).emit("order_delivered", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: "delivered",
        deliveredAt: now,
        deliveryDistanceKm: distanceKm,
        riderDeliveryEarning: riderEarning,
      });
      io.to(`store_${order.managerId}`).emit("order_status_updated", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: "delivered",
        assignmentStatus: "DELIVERED",
        deliveredAt: now,
      });
    } catch (_) {}

    try {
      await syncCustomerOrderFromStore(order, "delivered");
    } catch (err) {
      console.warn("[completion] customer order sync failed:", err.message);
    }

    return {
      success: true,
      message: "Order delivered successfully!",
      order,
      earningBreakdown: {
        deliveryDistanceKm: distanceKm,
        riderDeliveryEarning: riderEarning,
        earningSlab,
        hasShiftSlabs: earningResult.hasSlabs,
      },
    };
  } catch (err) {
    if (!committed) {
      try { await session.abortTransaction(); } catch (_) {}
    }
    throw err;
  } finally {
    session.endSession();
  }
}
