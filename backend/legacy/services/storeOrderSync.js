import StoreOrder from "../../delivery-service/src/models/StoreOrder.js";
import { applyStoreOrderStatus } from "../../delivery-service/src/services/storeOrderLifecycle.js";
import { restoreOrderStock } from "../../delivery-service/src/services/storeStockService.js";
import { dispatchDeliveryOrder } from "./deliveryDispatcher.js";
import { getIO } from "../../socket.js";
import Order from "../models/order/Order.js";

/** Store-side statuses where nothing has been packed or handed to a rider yet. */
export const STORE_PARTS_NOT_STARTED = new Set([
  "preorder_hold",
  "incoming",
  "order_received",
  "stock_issue",
]);

const CLOSED = new Set(["cancelled", "delivered"]);

async function openParts(orderId) {
  const parts = await StoreOrder.find({ sourceOrderId: orderId });
  return parts.filter((part) => !CLOSED.has(part.status));
}

/** Admin edits that change what the dark store packs, where it goes, or what it collects. */
export function editTouchesStoreOrder(body = {}, existingOrder) {
  if (
    body.items !== undefined ||
    body.deliveryCharges !== undefined ||
    body.couponCode !== undefined ||
    body.deliveryAddress !== undefined
  ) {
    return true;
  }
  return (
    body.paymentStatus !== undefined &&
    body.paymentStatus !== existingOrder.paymentStatus &&
    body.paymentStatus !== "paid"
  );
}

/** Null when the edit is allowed; otherwise the reason it is blocked. */
export async function storeEditBlockReason(existingOrder) {
  const open = await openParts(existingOrder._id);
  if (open.some((part) => !STORE_PARTS_NOT_STARTED.has(part.status))) {
    return "The dark store has already packed this order or handed it to a rider. Cancel it instead of editing.";
  }
  return null;
}

function emitRemoved(part) {
  try {
    getIO().to(`store_${part.managerId}`).emit("order_status_updated", {
      orderId: part._id.toString(),
      orderNumber: part.orderNumber,
      status: "cancelled",
      replacedByAdminEdit: true,
    });
  } catch (_) {}
}

/**
 * Rebuild the not-yet-started store parts from the edited customer order:
 * new items, amounts, address routing. The customer's delivery OTP is kept.
 */
async function rebuildParts(order) {
  const parts = await StoreOrder.find({ sourceOrderId: order._id });
  if (parts.some((part) => !STORE_PARTS_NOT_STARTED.has(part.status) && part.status !== "cancelled")) {
    return null;
  }
  const keepOtp = parts.find((part) => part.otpCode)?.otpCode || order.deliveryOtp || "";

  for (const part of parts) {
    if (part.stockReservedAt || part.stockDeductedAt) {
      await restoreOrderStock(part.managerId, part);
    }
  }
  await StoreOrder.deleteMany({ _id: { $in: parts.map((part) => part._id) } });
  parts.filter((part) => part.status !== "cancelled").forEach(emitRemoved);

  const created = await dispatchDeliveryOrder(order);
  if (created && keepOtp) {
    await StoreOrder.updateMany({ sourceOrderId: order._id }, { $set: { otpCode: keepOtp } });
    await Order.updateOne({ _id: order._id }, { $set: { deliveryOtp: keepOtp } });
  }
  if (created && order.paymentStatus === "paid") {
    await markPartsPaid(order._id);
  }
  return created;
}

function markPartsPaid(orderId) {
  return StoreOrder.updateMany(
    { sourceOrderId: orderId, status: { $nin: [...CLOSED] } },
    { $set: { paymentStatus: "paid_online", amountToCollect: 0 } }
  );
}

/**
 * Carry an admin edit of the customer order over to its dark-store order(s).
 * Call after the customer order has been saved.
 */
export async function syncStorePartsAfterAdminEdit({ previous, order, body = {} }) {
  const orderId = order._id;
  const statusChanged = body.status !== undefined && body.status !== previous.status;

  if (statusChanged && order.status === "cancelled") {
    for (const part of await openParts(orderId)) {
      await applyStoreOrderStatus({ storeOrderId: part._id, status: "cancelled", restoreStockOnCancel: true });
    }
    return;
  }

  if (statusChanged && order.status === "delivered") {
    for (const part of await openParts(orderId)) {
      await applyStoreOrderStatus({
        storeOrderId: part._id,
        status: "delivered",
        skipCompletionGuards: true,
        reason: "Customer order marked delivered by admin",
        actor: { role: "admin", name: "Admin (order edit)" },
      });
    }
    return;
  }

  const existing = await StoreOrder.countDocuments({ sourceOrderId: orderId });
  if (!existing) {
    if (previous.status === "attempted" && ["confirm", "processing"].includes(order.status)) {
      await dispatchDeliveryOrder(order);
    }
    return;
  }

  if (editTouchesStoreOrder(body, previous)) {
    await rebuildParts(order);
    return;
  }

  if (body.paymentStatus === "paid" && previous.paymentStatus !== "paid") {
    await markPartsPaid(orderId);
  }
}
