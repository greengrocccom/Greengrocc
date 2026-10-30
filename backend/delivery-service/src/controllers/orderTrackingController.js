import mongoose from "mongoose";
import StoreOrder from "../models/StoreOrder.js";
import { applyStoreOrderStatus } from "../services/storeOrderLifecycle.js";
import {
  CLOSED_STATUSES,
  buildTrackingSnapshot,
  emitOrderStatus,
  isAdminRole,
  resolveCustomerOrderForViewer,
  resolveStoreOrderType,
  timelineKeyForStoreStatus,
} from "../services/orderTrackingService.js";

/** Friendly names the apps / ops tools may send for PATCH /status. */
const STATUS_ALIASES = {
  confirm: "order_received",
  confirmed: "order_received",
  received: "order_received",
  ready: "packed",
  shipping: "out_for_delivery",
  shipped: "out_for_delivery",
  cancel: "cancelled",
  canceled: "cancelled",
};

/**
 * Manual status moves per order type. Rider assignment (offered / assigned) and
 * pickup verification stay with their own flows; this graph only allows moving
 * forward or cancelling.
 */
const LIVE_TRANSITIONS = {
  incoming: ["order_received", "stock_issue", "packed", "cancelled"],
  order_received: ["stock_issue", "packed", "cancelled"],
  stock_issue: ["order_received", "packed", "cancelled"],
  packed: ["cancelled"],
  offered: ["cancelled"],
  assigned: ["out_for_delivery", "cancelled"],
  pickup_verified: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
};

const TRANSITIONS_BY_ORDER_TYPE = {
  ready_to_cook: LIVE_TRANSITIONS,
  instant: LIVE_TRANSITIONS,
  preorder: {
    ...LIVE_TRANSITIONS,
    preorder_hold: ["order_received", "packed", "cancelled"],
  },
};

/** A rider may only move their own order out for delivery and mark it delivered. */
const RIDER_TRANSITIONS = {
  out_for_delivery: ["delivered"],
};

export function allowedTransitions(orderType, fromStatus) {
  const graph = TRANSITIONS_BY_ORDER_TYPE[orderType] || LIVE_TRANSITIONS;
  return graph[fromStatus] || [];
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  return STATUS_ALIASES[raw] || raw;
}

async function findTargetStoreOrder(id, part) {
  const direct = await StoreOrder.findById(id);
  if (direct) return { storeOrder: direct };

  const parts = await StoreOrder.find({ sourceOrderId: id }).sort({ createdAt: 1 });
  if (!parts.length) return { error: { statusCode: 404, message: "Order not found" } };
  if (part) {
    const match = parts.find((row) => (row.sourcePart || "") === part);
    return match ? { storeOrder: match } : { error: { statusCode: 404, message: `No "${part}" part on this order` } };
  }
  if (parts.length === 1) return { storeOrder: parts[0] };
  const open = parts.filter((row) => !CLOSED_STATUSES.includes(row.status));
  if (open.length === 1) return { storeOrder: open[0] };
  return {
    error: { statusCode: 400, message: 'This order has two parts — send part: "now" or "preorder"' },
  };
}

/** GET /api/orders/:id/tracking — customer order tracking state (owner or admin). */
export async function getOrderTracking(req, res) {
  try {
    const access = await resolveCustomerOrderForViewer(req.params.id, req.user);
    if (!access.ok) {
      return res.status(access.statusCode).json({ success: false, code: access.code, message: access.message });
    }
    const storeOrders = await StoreOrder.find({ sourceOrderId: access.customerOrder._id }).sort({ createdAt: 1 });
    const part = String(req.query.part || access.requestedStoreOrder?.sourcePart || "");
    const tracking = await buildTrackingSnapshot({
      customerOrder: access.customerOrder,
      storeOrders,
      part,
    });
    return res.json({ success: true, tracking });
  } catch (err) {
    console.error("[tracking] getOrderTracking failed:", err);
    return res.status(500).json({ success: false, message: "Could not load order tracking" });
  }
}

/**
 * PATCH /api/orders/:id/status — `:id` is a delivery (store) order id or a customer
 * order id (+ body.part for split carts). Validates the move for the order type,
 * saves it through the shared lifecycle, and emits `order_status`.
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    const target = normalizeStatus(req.body?.status);
    if (!target) {
      return res.status(400).json({ success: false, message: "status is required" });
    }

    const { storeOrder, error } = await findTargetStoreOrder(id, String(req.body?.part || ""));
    if (error) return res.status(error.statusCode).json({ success: false, message: error.message });

    const role = String(req.user?.role || "").toLowerCase();
    const userId = String(req.user?.id || "");
    const isRider = role === "delivery_boy";
    if (isAdminRole(role)) {
      // full access
    } else if (role === "delivery_manager") {
      if (String(storeOrder.managerId) !== userId) {
        return res.status(403).json({ success: false, message: "This order belongs to another store" });
      }
    } else if (isRider) {
      if (String(storeOrder.assignedRiderId || "") !== userId) {
        return res.status(403).json({ success: false, message: "You are not assigned to this order" });
      }
    } else {
      return res.status(403).json({ success: false, message: "You cannot change order status" });
    }

    const orderType = resolveStoreOrderType(storeOrder);
    const from = storeOrder.status;
    if (from === target) {
      return res.json({ success: true, message: "Status unchanged", order: storeOrder.toSafeJSON() });
    }
    const allowed = isRider ? RIDER_TRANSITIONS[from] || [] : allowedTransitions(orderType, from);
    if (!allowed.includes(target)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TRANSITION",
        message: `Cannot move this ${orderType} order from ${from} to ${target}`,
        allowed,
      });
    }

    const result = await applyStoreOrderStatus({
      storeOrderId: storeOrder._id,
      status: target,
      skipCompletionGuards: !isRider,
      reason: String(req.body?.reason || "").trim(),
      actor: {
        id: req.user?.id || null,
        role,
        name: req.user?.name || req.user?.storeName || role,
      },
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, message: result.message });
    }

    emitOrderStatus(result.order, result.order.status);
    return res.json({
      success: true,
      message: result.message,
      transition: { from, to: result.order.status, orderType },
      timelineStatus: timelineKeyForStoreStatus(result.order.status),
      order: result.order.toSafeJSON(),
    });
  } catch (err) {
    console.error("[tracking] updateOrderStatus failed:", err);
    return res.status(500).json({ success: false, message: "Could not update order status" });
  }
}
