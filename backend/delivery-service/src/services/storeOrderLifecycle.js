import StoreOrder from "../models/StoreOrder.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { completeDelivery } from "./DeliveryCompletionService.js";
import { restoreOrderStock } from "./storeStockService.js";
import { syncCustomerOrderFromStore } from "./syncCustomerOrderFromStore.js";
import { sendDeliveryOtpSmsOnDispatch } from "./deliveryOtpSmsService.js";
import { getIO } from "../../../socket.js";

const ASSIGNMENT_BY_STATUS = {
  preorder_hold: "NONE",
  incoming: "NONE",
  order_received: "NONE",
  stock_issue: "NONE",
  packed: "SEARCHING_FOR_DRIVER",
  offered: "OFFER_SENT",
  assigned: "DRIVER_ASSIGNED",
  pickup_verified: "PICKUP_VERIFIED",
  out_for_delivery: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  cancelled: "NONE",
};

export async function releaseAssignedRider(storeOrder) {
  if (!storeOrder?.assignedRiderId) return;
  const rider = await DeliveryBoy.findById(storeOrder.assignedRiderId);
  if (!rider) return;
  const activeId = rider.activeOrderId ? String(rider.activeOrderId) : "";
  if (rider.status === "on_delivery" || activeId === String(storeOrder._id)) {
    rider.status = "online";
    rider.activeOrderId = null;
    rider.lastStatusAt = new Date();
    await rider.save();
  }
}

function emitStoreStatus(storeOrder, extra = {}) {
  try {
    getIO().to(`store_${storeOrder.managerId}`).emit("order_status_updated", {
      orderId: storeOrder._id.toString(),
      orderNumber: storeOrder.orderNumber,
      status: storeOrder.status,
      assignmentStatus: storeOrder.assignmentStatus,
      ...extra,
    });
  } catch (_) {}
}

/**
 * Manager decision on a failed delivery.
 *  - "return": goods are back at the store → stock restored, cash record closed, customer order cancelled.
 *  - "reattempt": goods are back at the store → order goes back to the assignment queue.
 */
export async function resolveFailedDelivery({ orderId, managerId, action, note = "", byName = "" }) {
  if (!["return", "reattempt"].includes(action)) {
    return { success: false, statusCode: 400, message: "Action must be return or reattempt" };
  }
  const order = await StoreOrder.findOne({ _id: orderId, managerId });
  if (!order) return { success: false, statusCode: 404, message: "Order not found" };
  if (order.status !== "delivery_failed") {
    return { success: false, statusCode: 400, message: "Only failed deliveries can be resolved" };
  }

  const now = new Date();
  const cleanNote = String(note || "").trim().slice(0, 300);
  const { resolveCashForOrder } = await import("./CashSettlementService.js");
  if (order.paymentStatus === "collected") {
    await resolveCashForOrder({
      orderId: order._id,
      outcome: "cancel",
      note: `${action === "return" ? "Returned to store" : "Reattempt"} — cash handed back by rider${cleanNote ? `: ${cleanNote}` : ""}`,
    });
    order.paymentStatus = "pending";
    order.amountCollected = 0;
  }

  order.failureResolution = { status: action === "return" ? "returned" : "reattempt", byName, note: cleanNote, at: now };

  if (action === "return") {
    await restoreOrderStock(order.managerId, order);
    order.status = "cancelled";
    order.assignmentStatus = "NONE";
    order.notes = [order.notes, `Returned to store by ${byName || "manager"}${cleanNote ? `: ${cleanNote}` : ""}`]
      .filter(Boolean)
      .join("\n");
    await order.save();
    await syncCustomerOrderFromStore(order, "cancelled");
    emitStoreStatus(order, { failureResolution: "returned" });
    return { success: true, message: "Order returned to store — stock restored", order };
  }

  const failedRider = order.failedByRiderId || order.assignedRiderId;
  order.status = "packed";
  order.assignmentStatus = order.isPreOrder ? "NONE" : "SEARCHING_FOR_DRIVER";
  order.assignedRiderId = null;
  order.assignedAt = null;
  order.currentOfferDriverId = null;
  order.offeredRiderId = null;
  order.offerStartedAt = null;
  order.offerExpiresAt = null;
  order.pickupQrScanned = false;
  order.pickupQrScannedAt = undefined;
  order.qrScannedAt = undefined;
  order.pickupProofStatus = "none";
  order.pickupProofImageUrl = "";
  order.pickupVerified = false;
  order.customerAddressUnlocked = false;
  order.pickupQrUnlocked = false;
  order.routeBatchWindowEndsAt = undefined;
  order.batchId = "";
  order.batchSequence = 0;
  order.batchPrimaryOrderId = null;
  order.deliveryProofImageUrl = "";
  order.customerOtpVerified = false;
  order.otpAttempts = 0;
  order.otpLockedUntil = undefined;
  order.onlinePaymentClaim = { status: "", riderId: null, claimedAt: null, reviewedAt: null, reviewedByName: "", note: "" };
  order.excludedDriverIds = failedRider ? [failedRider] : [];
  order.roundRobinRidersAttempted = [];
  order.notes = [order.notes, `Reattempt ordered by ${byName || "manager"}${cleanNote ? `: ${cleanNote}` : ""}`]
    .filter(Boolean)
    .join("\n");
  await order.save();
  await syncCustomerOrderFromStore(order, "packed");
  emitStoreStatus(order, { failureResolution: "reattempt" });

  if (!order.isPreOrder) {
    const { assignNextDriver } = await import("./OrderAssignmentService.js");
    setImmediate(() => assignNextDriver(order._id).catch(() => {}));
  }
  return {
    success: true,
    message: order.isPreOrder
      ? "Pre-order is back in the ready-to-assign list"
      : "Order sent back for a new rider",
    order,
  };
}

function cashOwed(order) {
  if (order.paymentStatus === "paid_online") return 0;
  if (String(order.paymentMethod || "").toUpperCase() === "ONLINE") return 0;
  return Math.round(Number(order.amountCollected || order.amountToCollect || order.partTotal || 0));
}

/**
 * Manual close keeps the money traceable: COD becomes a cash record against the rider,
 * or against the store itself when nobody was assigned.
 */
async function recordManualCash(order) {
  const amount = cashOwed(order);
  if (amount <= 0) return;
  order.paymentMethod = order.paymentMethod || "COD";
  order.paymentStatus = "collected";
  order.amountCollected = amount;
  await order.save();

  const { createCashLiability } = await import("./CashSettlementService.js");
  const CashSettlement = (await import("../models/CashSettlement.js")).default;
  const existing = await CashSettlement.findOne({ orderId: order._id });
  if (existing) return;
  await createCashLiability({
    darkStoreId: order.darkStoreId || order.managerId,
    riderId: order.assignedRiderId || null,
    orderId: order._id,
    orderNumber: order.orderNumber,
    amount,
    notes: order.assignedRiderId ? "Marked delivered manually" : "Marked delivered manually — no rider, collect at store",
  });
}

/**
 * Admin or manager driven status change. Completing delivery without the rider's
 * OTP/proof needs a reason and is logged on the order.
 */
export async function applyStoreOrderStatus({
  storeOrderId,
  status,
  skipCompletionGuards = false,
  restoreStockOnCancel = true,
  actor = null,
  reason = "",
}) {
  const allowed = StoreOrder.schema.path("status").enumValues;
  if (!allowed.includes(status)) {
    return { success: false, statusCode: 400, message: "Invalid order status" };
  }

  const order = await StoreOrder.findById(storeOrderId);
  if (!order) {
    return { success: false, statusCode: 404, message: "Delivery order not found" };
  }

  if (order.status === status) {
    return { success: true, message: "Status unchanged", order };
  }

  if (status === "delivered") {
    const why = String(reason || "").trim().slice(0, 300);
    if (skipCompletionGuards && !why) {
      return {
        success: false,
        statusCode: 400,
        message: "A reason is required to mark an order delivered without the rider's OTP",
      };
    }
    if (["cancelled", "delivery_failed"].includes(order.status)) {
      return {
        success: false,
        statusCode: 400,
        message: `Order is ${order.status.replace("_", " ")} — it cannot be marked delivered`,
      };
    }
    const audit = skipCompletionGuards
      ? {
          byId: actor?.id || null,
          byRole: actor?.role || "",
          byName: actor?.name || "",
          reason: why,
          at: new Date(),
        }
      : null;

    if (order.assignedRiderId) {
      const result = await completeDelivery({
        orderId: order._id,
        riderId: order.assignedRiderId,
        skipConditionCheck: skipCompletionGuards,
      });
      if (!result.success) return { ...result, statusCode: 400 };
      if (result.alreadyDelivered) return { success: true, message: result.message, order: result.order };
      if (audit) {
        result.order.manualCompletion = audit;
        result.order.notes = [result.order.notes, `Marked delivered by ${audit.byName || audit.byRole}: ${why}`]
          .filter(Boolean)
          .join("\n");
        await result.order.save();
        await recordManualCash(result.order);
      }
      await syncCustomerOrderFromStore(result.order, "delivered");
      return { success: true, message: "Order marked delivered and completed", order: result.order };
    }

    const now = new Date();
    const closed = await StoreOrder.findOneAndUpdate(
      { _id: order._id, status: { $nin: ["delivered", "cancelled", "delivery_failed"] } },
      {
        $set: {
          status: "delivered",
          assignmentStatus: "DELIVERED",
          deliveredAt: now,
          ...(audit ? { manualCompletion: audit } : {}),
        },
      },
      { new: true }
    );
    if (!closed) {
      return { success: false, statusCode: 409, message: "Order was already closed" };
    }
    if (audit) {
      closed.notes = [closed.notes, `Marked delivered by ${audit.byName || audit.byRole}: ${why}`]
        .filter(Boolean)
        .join("\n");
      await closed.save();
      await recordManualCash(closed);
    }
    await syncCustomerOrderFromStore(closed, "delivered");
    emitStoreStatus(closed, { deliveredAt: now });
    return { success: true, message: "Order marked delivered and completed", order: closed };
  }

  if (status === "cancelled") {
    if (order.status === "delivered") {
      return { success: false, statusCode: 400, message: "Delivered orders cannot be cancelled" };
    }
    const now = new Date();
    if (restoreStockOnCancel) {
      await restoreOrderStock(order.managerId, order);
    }
    await releaseAssignedRider(order);
    order.status = "cancelled";
    order.assignmentStatus = "NONE";
    order.currentOfferDriverId = null;
    order.offeredRiderId = null;
    await order.save();
    await syncCustomerOrderFromStore(order, "cancelled");
    emitStoreStatus(order, { cancelledAt: now });
    return { success: true, message: "Order cancelled", order };
  }

  order.status = status;
  if (ASSIGNMENT_BY_STATUS[status]) order.assignmentStatus = ASSIGNMENT_BY_STATUS[status];
  if (status === "packed" && !order.packedAt) order.packedAt = new Date();
  if (status === "assigned" && !order.assignedAt) order.assignedAt = new Date();
  if (status === "out_for_delivery") order.customerAddressUnlocked = true;
  await order.save();
  await syncCustomerOrderFromStore(order, status);
  if (status === "out_for_delivery") sendDeliveryOtpSmsOnDispatch(order);
  emitStoreStatus(order);
  return { success: true, message: "Order status updated", order };
}
