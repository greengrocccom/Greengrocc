import mongoose from "mongoose";
import StoreOrder from "../models/StoreOrder.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import Staff from "../../../staff-service/src/models/Staff.js";
import { getIO } from "../../../socket.js";
import { applyStoreOrderStatus, releaseAssignedRider } from "../services/storeOrderLifecycle.js";
import { syncCustomerOrderFromStore } from "../services/syncCustomerOrderFromStore.js";
import { sendDeliveryOtpSmsOnDispatch } from "../services/deliveryOtpSmsService.js";
import { isVendorConfirmed } from "../services/preOrderProgress.js";
import { getManager } from "./managerDashboardController.js";
import {
  formatIndiaDateString,
  shiftIndiaDateString,
} from "../../../../shared/date/indiaDate.js";

/**
 * Pre-order lifecycle
 *   Customer places next-day slot order → StoreOrder { status: "preorder_hold", preOrderStage: "pending", vendorStatus: "pending" }
 *   Vendor owning the dark store confirms (or rejects) → vendorStatus: "confirmed"
 *     (optionally sends a FarmerOrder to one of their farmers when short of stock)
 *   Vendor packs → preOrderStage: "ready"
 *   Vendor ships → { status: "packed", preOrderStage: "forwarded" } lands in the Delivery Manager's Pre-Orders tab
 *   Delivery Manager marks the goods received, assigns a rider, then marks out for delivery / delivered
 *   Rider completes out_for_delivery → delivered only with the customer's OTP
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CLOSED_STATUSES = ["delivered", "cancelled", "delivery_failed"];
const PREPARABLE_STAGES = ["pending", "preparing", "ready"];
const STAGE_TRANSITIONS = {
  pending: ["preparing", "ready"],
  preparing: ["ready", "pending"],
  ready: ["preparing"],
};

const todayIst = () => formatIndiaDateString();

function parseDate(value) {
  const s = String(value || "").trim();
  return DATE_RE.test(s) ? s : "";
}

/** Upcoming + still-open pre-orders when no explicit date is requested. */
function defaultDateScope() {
  const since = shiftIndiaDateString(todayIst(), -2);
  return {
    $or: [{ preOrderDate: { $gte: since } }, { status: { $nin: CLOSED_STATUSES } }],
  };
}

function sortPreOrders(a, b) {
  const byDate = String(a.preOrderDate || "").localeCompare(String(b.preOrderDate || ""));
  if (byDate) return byDate;
  const bySlot = String(a.preOrderSlot || "").localeCompare(String(b.preOrderSlot || ""));
  if (bySlot) return bySlot;
  return new Date(a.createdAt) - new Date(b.createdAt);
}

async function loadRiderMap(orders) {
  const ids = [
    ...new Set(
      orders.flatMap((o) =>
        [o.assignedRiderId, o.currentOfferDriverId].filter(Boolean).map(String)
      )
    ),
  ];
  if (!ids.length) return new Map();
  const riders = await DeliveryBoy.find({ _id: { $in: ids } }).select("name phone status");
  return new Map(riders.map((r) => [r._id.toString(), r]));
}

function riderSummary(rider) {
  return rider
    ? { id: rider._id.toString(), name: rider.name || rider.phone, phone: rider.phone, status: rider.status }
    : null;
}

const STORE_FIELDS = "storeName area city cityId state pincode name phone isActive zoneId zoneName";

/** Zone = the dark store's approved vendor zone, or its state for stores created before zones. */
function storeSummary(store) {
  return {
    id: store._id.toString(),
    storeName: store.storeName || `${store.area} Store`,
    area: store.area || "",
    city: store.city || "",
    state: store.state || "",
    zone: store.zoneName || store.state || "Other",
    pincode: store.pincode || "",
    managerName: store.name || "",
    managerPhone: store.phone || "",
  };
}

function serializePreOrder(order, { riderMap, storeMap } = {}) {
  const json = order.toSafeJSON();
  const assigned = order.assignedRiderId ? riderMap?.get(String(order.assignedRiderId)) : null;
  const offered = order.currentOfferDriverId
    ? riderMap?.get(String(order.currentOfferDriverId))
    : null;
  const store = storeMap?.get(String(order.managerId));
  return {
    ...json,
    assignedRider: riderSummary(assigned),
    offeredRider: riderSummary(offered),
    ...(storeMap
      ? {
          store: store ? storeSummary(store) : null,
        }
      : {}),
  };
}

function countSummary(orders) {
  const summary = {
    total: orders.length,
    awaitingVendor: 0,
    pending: 0,
    preparing: 0,
    ready: 0,
    awaitingReceipt: 0,
    readyToAssign: 0,
    offered: 0,
    onTheWay: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const o of orders) {
    if (o.status === "preorder_hold") {
      if (!isVendorConfirmed(o)) summary.awaitingVendor += 1;
      else if (summary[o.preOrderStage] != null) summary[o.preOrderStage] += 1;
    } else if (o.status === "packed") {
      if (o.storeReceivedAt) summary.readyToAssign += 1;
      else summary.awaitingReceipt += 1;
    }
    else if (o.status === "offered") summary.offered += 1;
    else if (["assigned", "pickup_verified", "out_for_delivery"].includes(o.status)) summary.onTheWay += 1;
    else if (o.status === "delivered") summary.delivered += 1;
    else if (["cancelled", "delivery_failed"].includes(o.status)) summary.cancelled += 1;
  }
  return summary;
}

async function staffDisplayName(req) {
  let name = req.user?.email || "Admin";
  if (req.user?.role !== "admin" && req.user?.id) {
    const staff = await Staff.findById(req.user.id).select("name email");
    if (staff) name = staff.name || staff.email || name;
  }
  return name;
}

function emitToStore(managerId, event, payload) {
  try {
    getIO().to(`store_${managerId}`).emit(event, payload);
  } catch (err) {
    console.warn(`[preorder] socket emit ${event} failed:`, err.message);
  }
}

// ── Delivery Manager ────────────────────────────────────────────────────────

/** GET /api/delivery-managers/preorders?date=YYYY-MM-DD */
export const listManagerPreOrders = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const date = parseDate(req.query.date);
    const filter = {
      managerId: manager._id,
      isPreOrder: true,
      ...(date ? { preOrderDate: date } : defaultDateScope()),
    };

    const orders = (await StoreOrder.find(filter)).sort(sortPreOrders);
    const riderMap = await loadRiderMap(orders);

    return res.json({
      success: true,
      today: todayIst(),
      tomorrow: shiftIndiaDateString(todayIst(), 1),
      darkStoreName: manager.storeName || `${manager.area} Dark Store`,
      summary: countSummary(orders),
      orders: orders.map((o) => serializePreOrder(o, { riderMap })),
    });
  } catch (error) {
    next(error);
  }
};

// ── Product Manager (staff) ─────────────────────────────────────────────────

/** GET /api/staff/preorders?date=&stage=&storeId= */
export const listPreOrdersForStaff = async (req, res, next) => {
  try {
    const date = parseDate(req.query.date);
    const stage = String(req.query.stage || "").trim().toLowerCase();
    const storeId = String(req.query.storeId || "").trim();

    const filter = {
      isPreOrder: true,
      ...(date ? { preOrderDate: date } : defaultDateScope()),
    };
    if (storeId && mongoose.Types.ObjectId.isValid(storeId)) {
      filter.managerId = storeId;
    }

    const orders = (await StoreOrder.find(filter)).sort(sortPreOrders);
    const [riderMap, stores] = await Promise.all([
      loadRiderMap(orders),
      DeliveryManager.find({ isActive: true }).select(STORE_FIELDS),
    ]);
    const storeMap = new Map(stores.map((s) => [s._id.toString(), s]));
    for (const id of new Set(orders.map((o) => String(o.managerId)))) {
      if (!storeMap.has(id)) {
        const extra = await DeliveryManager.findById(id).select(STORE_FIELDS);
        if (extra) storeMap.set(id, extra);
      }
    }

    const summary = countSummary(orders);
    const held = (o) => o.status === "preorder_hold";
    const visible = PREPARABLE_STAGES.includes(stage)
      ? orders.filter((o) => held(o) && isVendorConfirmed(o) && (o.preOrderStage || "pending") === stage)
      : stage === "awaiting_vendor"
        ? orders.filter((o) => held(o) && !isVendorConfirmed(o))
        : stage === "forwarded"
          ? orders.filter((o) => o.preOrderStage === "forwarded")
          : orders;

    return res.json({
      success: true,
      today: todayIst(),
      tomorrow: shiftIndiaDateString(todayIst(), 1),
      summary,
      stores: stores.map(storeSummary),
      orders: visible.map((o) => serializePreOrder(o, { riderMap, storeMap })),
    });
  } catch (error) {
    next(error);
  }
};

const VENDOR_OWNS_PACKING =
  "Pre-orders are now packed and shipped by the vendor from the vendor panel";

/** PATCH /api/staff/preorders/:orderId/stage  body { stage: "pending" | "preparing" | "ready" } — admin only */
export const updatePreOrderStage = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: VENDOR_OWNS_PACKING });
    }
    const { orderId } = req.params;
    const nextStage = String(req.body.stage || "").trim().toLowerCase();
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    if (!PREPARABLE_STAGES.includes(nextStage)) {
      return res.status(400).json({
        success: false,
        message: 'stage must be "pending", "preparing" or "ready"',
      });
    }

    const order = await StoreOrder.findOne({ _id: orderId, isPreOrder: true });
    if (!order) {
      return res.status(404).json({ success: false, message: "Pre-order not found" });
    }
    if (order.status !== "preorder_hold") {
      return res.status(400).json({
        success: false,
        message:
          order.status === "cancelled"
            ? "This pre-order was cancelled"
            : "This pre-order has already been forwarded to the Delivery Manager",
      });
    }
    if (!isVendorConfirmed(order)) {
      return res.status(400).json({
        success: false,
        message: "Waiting for the vendor to confirm this pre-order",
      });
    }

    const current = order.preOrderStage || "pending";
    if (current === nextStage) {
      return res.json({ success: true, message: "Stage unchanged", order: order.toSafeJSON() });
    }
    if (!(STAGE_TRANSITIONS[current] || []).includes(nextStage)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move pre-order from ${current} to ${nextStage}`,
      });
    }

    const now = new Date();
    order.preOrderStage = nextStage;
    if (nextStage === "preparing" && !order.preparingAt) order.preparingAt = now;
    if (nextStage === "ready") {
      if (!order.preparingAt) order.preparingAt = now;
      order.readyAt = now;
    }
    if (nextStage !== "ready") order.readyAt = undefined;
    await order.save();

    if (nextStage !== "pending") {
      await syncCustomerOrderFromStore(order, "preorder_preparing").catch((err) =>
        console.warn("[preorder] customer sync failed:", err.message)
      );
    }

    emitToStore(order.managerId, "preorder_updated", {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      preOrderStage: order.preOrderStage,
    });

    return res.json({
      success: true,
      message:
        nextStage === "ready"
          ? `#${order.orderNumber} marked ready — forward it to the Delivery Manager`
          : nextStage === "preparing"
            ? `Preparing #${order.orderNumber}`
            : `#${order.orderNumber} moved back to pending`,
      order: order.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Moves held pre-orders to { status: "packed", preOrderStage: "forwarded" } — the goods are on
 * their way to the dark store and the order shows up in the Delivery Manager's Pre-Orders tab.
 */
async function shipHeldPreOrders({ orderIds, note, forwardedByName, forwardedBy, scope = {}, stages = PREPARABLE_STAGES, vendorId }) {
  const forwarded = [];
  const failed = [];

  for (const id of orderIds) {
    const now = new Date();
    const order = await StoreOrder.findOneAndUpdate(
      {
        _id: id,
        ...scope,
        isPreOrder: true,
        status: "preorder_hold",
        vendorStatus: "confirmed",
        preOrderStage: { $in: stages },
      },
      {
        $set: {
          status: "packed",
          packedAt: now,
          assignmentStatus: "NONE",
          preOrderStage: "forwarded",
          forwardedAt: now,
          forwardedBy,
          forwardedByName,
          pickupQrUnlocked: false,
          ...(note ? { preOrderNote: note } : {}),
        },
        $unset: { routeBatchWindowEndsAt: "" },
      },
      { returnDocument: 'after' }
    );

    if (!order) {
      const existing = await StoreOrder.findOne({ _id: id, ...scope }).select(
        "orderNumber status preOrderStage isPreOrder vendorStatus"
      );
      failed.push({
        id,
        orderNumber: existing?.orderNumber || "",
        message: !existing || !existing.isPreOrder
          ? "Pre-order not found"
          : existing.status === "cancelled"
            ? "Cancelled"
            : existing.status === "preorder_hold" && !isVendorConfirmed(existing)
              ? "Confirm the pre-order first"
              : existing.status === "preorder_hold"
                ? "Pack the pre-order before shipping"
                : "Already shipped",
      });
      continue;
    }

    if (!order.readyAt || !order.preparingAt) {
      order.preparingAt = order.preparingAt || now;
      order.readyAt = order.readyAt || now;
      await order.save();
    }

    await syncCustomerOrderFromStore(order, "packed").catch((err) =>
      console.warn("[preorder] customer sync failed:", err.message)
    );

    const payload = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: "packed",
      assignmentStatus: "NONE",
      isPreOrder: true,
      preOrderSlot: order.preOrderSlot,
      preOrderDate: order.preOrderDate,
      forwardedByName,
    };
    emitToStore(order.managerId, "preorder_forwarded", payload);
    emitPreOrderChange(order, "order_status_updated", payload, vendorId);

    forwarded.push(order.toSafeJSON());
  }
  return { forwarded, failed };
}

/**
 * POST /api/staff/preorders/forward  body { orderIds: string[], note?: string } — admin only;
 * vendors ship their own pre-orders from the vendor panel.
 */
export const forwardPreOrders = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: VENDOR_OWNS_PACKING });
    }
    const orderIds = readOrderIds(req, res);
    if (!orderIds) return;

    const { forwarded, failed } = await shipHeldPreOrders({
      orderIds,
      note: String(req.body.note || "").trim().slice(0, 500),
      forwardedByName: await staffDisplayName(req),
      forwardedBy: mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : null,
    });

    return res.status(forwarded.length ? 200 : 400).json({
      success: forwarded.length > 0,
      message: forwarded.length
        ? `${plural(forwarded.length)} forwarded to Delivery Manager${failed.length ? ` · ${failed.length} skipped` : ""}`
        : failed[0]?.message || "Nothing forwarded",
      forwarded,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/staff/preorders/:orderId/cancel  body { reason } — only before forwarding */
export const cancelPreOrderByStaff = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const reason = String(req.body.reason || "").trim().slice(0, 300);
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: "A cancellation reason is required" });
    }

    const order = await StoreOrder.findOne({ _id: orderId, isPreOrder: true });
    if (!order) {
      return res.status(404).json({ success: false, message: "Pre-order not found" });
    }
    if (order.status !== "preorder_hold") {
      return res.status(400).json({
        success: false,
        message: "Only pre-orders that are not yet forwarded can be cancelled here",
      });
    }

    const byName = await staffDisplayName(req);
    const byRole = req.user?.role === "admin" ? "Admin" : "Staff";
    order.notes = [order.notes, `Cancelled by ${byName} (${byRole}): ${reason}`]
      .filter(Boolean)
      .join("\n");
    await order.save();

    const result = await applyStoreOrderStatus({
      storeOrderId: order._id,
      status: "cancelled",
      restoreStockOnCancel: false,
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      message: `Pre-order #${order.orderNumber} cancelled`,
      order: result.order.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// ── Admin override ──────────────────────────────────────────────────────────

const ADMIN_PROGRESS_TARGETS = [
  "awaiting_vendor",
  "confirmed",
  "preparing",
  "dispatched",
  "at_store",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
  "cancelled",
];
const HELD_PROGRESS = { awaiting_vendor: "pending", confirmed: "pending", preparing: "preparing" };

function clearRiderFields(order) {
  order.assignedRiderId = null;
  order.assignedAt = undefined;
  order.currentOfferDriverId = null;
  order.offeredRiderId = null;
  order.offerStartedAt = null;
  order.offerExpiresAt = null;
  order.pickupVerified = false;
  order.customerAddressUnlocked = false;
  order.pickupQrUnlocked = false;
  order.assignmentStatus = "NONE";
}

/**
 * PATCH /api/staff/preorders/:orderId/admin-progress  body { progress, reason? }
 * Admin-only: move a pre-order to any stage (forward or back), bypassing the
 * vendor / Product Manager / Delivery Manager hand-offs.
 */
export const adminSetPreOrderProgress = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const target = String(req.body?.progress || "").trim().toLowerCase();
    const reason = String(req.body?.reason || "").trim().slice(0, 300);
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    if (!ADMIN_PROGRESS_TARGETS.includes(target)) {
      return res.status(400).json({ success: false, message: "Unknown pre-order status" });
    }

    const order = await StoreOrder.findOne({ _id: orderId, isPreOrder: true });
    if (!order) {
      return res.status(404).json({ success: false, message: "Pre-order not found" });
    }
    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `This pre-order is already ${order.status} and can no longer be changed`,
      });
    }

    const byName = await staffDisplayName(req);
    const note = `Status set to "${target}" by ${byName} (Admin)${reason ? `: ${reason}` : ""}`;
    order.notes = [order.notes, note].filter(Boolean).join("\n");

    if (target === "cancelled" || target === "delivered") {
      if (target === "cancelled" && !reason) {
        return res.status(400).json({ success: false, message: "A cancellation reason is required" });
      }
      if (target === "delivered" && !reason) {
        return res.status(400).json({ success: false, message: "A reason is required to mark delivered" });
      }
      await order.save();
      const result = await applyStoreOrderStatus({
        storeOrderId: order._id,
        status: target,
        skipCompletionGuards: true,
        restoreStockOnCancel: false,
        reason,
        actor: { id: req.user?.id || null, role: "admin", name: byName },
      });
      if (!result.success) {
        return res.status(result.statusCode || 400).json({ success: false, message: result.message });
      }
      emitPreOrderChange(result.order, "preorder_updated", {
        orderId: result.order._id.toString(),
        orderNumber: result.order.orderNumber,
        status: result.order.status,
      });
      return res.json({
        success: true,
        message: `#${result.order.orderNumber} marked ${target}`,
        order: result.order.toSafeJSON(),
      });
    }

    if (["rider_assigned", "out_for_delivery"].includes(target) && !order.assignedRiderId) {
      return res.status(400).json({
        success: false,
        message: "No rider is assigned yet — assign one from the Delivery Manager first",
      });
    }

    const now = new Date();
    let syncStatus;

    if (HELD_PROGRESS[target]) {
      await releaseAssignedRider(order);
      clearRiderFields(order);
      order.status = "preorder_hold";
      order.preOrderStage = HELD_PROGRESS[target];
      order.forwardedAt = undefined;
      order.packedAt = undefined;
      order.storeReceivedAt = undefined;
      order.storeReceivedByName = "";
      if (target === "awaiting_vendor") {
        order.vendorStatus = "pending";
        order.vendorConfirmedAt = undefined;
        order.vendorRejectReason = "";
      } else {
        order.vendorStatus = "confirmed";
        if (!order.vendorConfirmedAt) order.vendorConfirmedAt = now;
        order.vendorActionByName = order.vendorActionByName || `${byName} (Admin)`;
      }
      if (target === "preparing") {
        if (!order.preparingAt) order.preparingAt = now;
      } else {
        order.preparingAt = undefined;
      }
      order.readyAt = undefined;
      syncStatus =
        target === "preparing"
          ? "preorder_preparing"
          : target === "confirmed"
            ? "preorder_vendor_confirmed"
            : "preorder_hold";
    } else if (target === "dispatched" || target === "at_store") {
      await releaseAssignedRider(order);
      clearRiderFields(order);
      order.status = "packed";
      order.preOrderStage = "forwarded";
      order.vendorStatus = "confirmed";
      if (!order.vendorConfirmedAt) order.vendorConfirmedAt = now;
      if (!order.preparingAt) order.preparingAt = now;
      if (!order.readyAt) order.readyAt = now;
      if (!order.forwardedAt) order.forwardedAt = now;
      if (!order.forwardedByName) order.forwardedByName = `${byName} (Admin)`;
      if (!order.packedAt) order.packedAt = now;
      if (target === "at_store") {
        if (!order.storeReceivedAt) order.storeReceivedAt = now;
        if (!order.storeReceivedByName) order.storeReceivedByName = `${byName} (Admin)`;
        syncStatus = "preorder_at_store";
      } else {
        order.storeReceivedAt = undefined;
        order.storeReceivedByName = "";
        syncStatus = "packed";
      }
    } else if (target === "rider_assigned") {
      order.status = "assigned";
      order.assignmentStatus = "DRIVER_ASSIGNED";
      if (!order.assignedAt) order.assignedAt = now;
      order.pickupQrUnlocked = true;
      order.customerAddressUnlocked = false;
      syncStatus = "assigned";
    } else {
      order.status = "out_for_delivery";
      order.assignmentStatus = "OUT_FOR_DELIVERY";
      order.customerAddressUnlocked = true;
      syncStatus = "out_for_delivery";
    }

    await order.save();
    await syncCustomerOrderFromStore(order, syncStatus).catch((err) =>
      console.warn("[preorder] customer sync failed:", err.message)
    );
    if (order.status === "out_for_delivery") sendDeliveryOtpSmsOnDispatch(order);
    emitPreOrderChange(order, "preorder_updated", {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      vendorStatus: order.vendorStatus,
      preOrderStage: order.preOrderStage,
    });
    emitToStore(order.managerId, "order_status_updated", {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      isPreOrder: true,
    });

    return res.json({
      success: true,
      message: `#${order.orderNumber} moved to ${target.replace(/_/g, " ")}`,
      order: order.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

function readOrderIds(req, res) {
  const raw = Array.isArray(req.body?.orderIds)
    ? req.body.orderIds
    : req.params.orderId
      ? [req.params.orderId]
      : [];
  const orderIds = [...new Set(raw.map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!orderIds.length) {
    res.status(400).json({ success: false, message: "Select at least one pre-order" });
    return null;
  }
  if (orderIds.length > 200) {
    res.status(400).json({ success: false, message: "Select at most 200 pre-orders at once" });
    return null;
  }
  return orderIds;
}

const plural = (n) => `${n} pre-order${n === 1 ? "" : "s"}`;

/**
 * POST /api/delivery-managers/preorders/receive  body { orderIds: string[] }
 * The forwarded goods physically reached this dark store — the orders become assignable.
 */
export const markPreOrdersReceived = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const orderIds = readOrderIds(req, res);
    if (!orderIds) return;

    const receivedByName = manager.name || manager.storeName || "Delivery Manager";
    const received = [];
    const failed = [];
    for (const id of orderIds) {
      const order = await StoreOrder.findOneAndUpdate(
        { _id: id, managerId: manager._id, isPreOrder: true, status: "packed", storeReceivedAt: null },
        { $set: { storeReceivedAt: new Date(), storeReceivedByName: receivedByName } },
        { returnDocument: 'after' }
      );
      if (!order) {
        const existing = await StoreOrder.findOne({ _id: id, managerId: manager._id }).select(
          "orderNumber status isPreOrder storeReceivedAt"
        );
        failed.push({
          id,
          orderNumber: existing?.orderNumber || "",
          message: !existing?.isPreOrder
            ? "Pre-order not found"
            : existing.storeReceivedAt
              ? "Already received"
              : existing.status === "preorder_hold"
                ? "Not yet shipped by the vendor"
                : `Cannot receive (status: ${existing.status})`,
        });
        continue;
      }

      await syncCustomerOrderFromStore(order, "preorder_at_store").catch((err) =>
        console.warn("[preorder] customer sync failed:", err.message)
      );
      emitToStore(manager._id, "order_status_updated", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        isPreOrder: true,
        storeReceivedAt: order.storeReceivedAt,
      });
      received.push(order.toSafeJSON());
    }

    return res.status(received.length ? 200 : 400).json({
      success: received.length > 0,
      message: received.length
        ? `${plural(received.length)} marked received at the dark store${failed.length ? ` · ${failed.length} skipped` : ""}`
        : failed[0]?.message || "Nothing received",
      received,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

const RIDER_HELD_STATUSES = ["assigned", "pickup_verified"];

/**
 * POST /api/delivery-managers/preorders/out-for-delivery  body { orderIds: string[] }
 * The assigned rider has left with the goods; the rider then completes delivery with the customer's OTP.
 */
export const markPreOrdersOutForDelivery = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const orderIds = readOrderIds(req, res);
    if (!orderIds) return;

    const updated = [];
    const failed = [];
    for (const id of orderIds) {
      const order = await StoreOrder.findOneAndUpdate(
        {
          _id: id,
          managerId: manager._id,
          isPreOrder: true,
          status: { $in: RIDER_HELD_STATUSES },
          assignedRiderId: { $ne: null },
        },
        {
          $set: {
            status: "out_for_delivery",
            assignmentStatus: "OUT_FOR_DELIVERY",
            customerAddressUnlocked: true,
            pickupVerified: true,
          },
        },
        { returnDocument: 'after' }
      );
      if (!order) {
        const existing = await StoreOrder.findOne({ _id: id, managerId: manager._id }).select(
          "orderNumber status isPreOrder assignedRiderId"
        );
        failed.push({
          id,
          orderNumber: existing?.orderNumber || "",
          message: !existing?.isPreOrder
            ? "Pre-order not found"
            : existing.status === "out_for_delivery"
              ? "Already out for delivery"
              : ["preorder_hold"].includes(existing.status)
                ? "The vendor has not shipped this pre-order yet"
                : !existing.assignedRiderId || ["packed", "offered"].includes(existing.status)
                  ? "Assign a delivery boy first"
                  : `Cannot mark out for delivery (status: ${existing.status})`,
        });
        continue;
      }

      await syncCustomerOrderFromStore(order, "out_for_delivery").catch((err) =>
        console.warn("[preorder] customer sync failed:", err.message)
      );
      sendDeliveryOtpSmsOnDispatch(order);
      emitPreOrderChange(order, "order_status_updated", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        isPreOrder: true,
      });
      updated.push(order.toSafeJSON());
    }

    return res.status(updated.length ? 200 : 400).json({
      success: updated.length > 0,
      message: updated.length
        ? `${plural(updated.length)} out for delivery${failed.length ? ` · ${failed.length} skipped` : ""}`
        : failed[0]?.message || "Nothing updated",
      updated,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/delivery-managers/preorders/deliver  body { orderIds: string[] } — manager closes a pre-order as delivered. */
export const markPreOrdersDelivered = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const orderIds = readOrderIds(req, res);
    if (!orderIds) return;

    const byName = manager.name || manager.storeName || "Delivery Manager";
    const reason = String(req.body?.reason || "").trim().slice(0, 300);
    if (!reason) {
      return res.status(400).json({ success: false, message: "A reason is required to mark pre-orders delivered" });
    }
    const delivered = [];
    const failed = [];
    for (const id of orderIds) {
      const order = await StoreOrder.findOne({ _id: id, managerId: manager._id, isPreOrder: true });
      if (!order) {
        failed.push({ id, orderNumber: "", message: "Pre-order not found" });
        continue;
      }
      if (![...RIDER_HELD_STATUSES, "out_for_delivery"].includes(order.status)) {
        failed.push({
          id,
          orderNumber: order.orderNumber,
          message:
            order.status === "delivered"
              ? "Already delivered"
              : order.status === "preorder_hold"
                ? "The vendor has not shipped this pre-order yet"
                : ["packed", "offered"].includes(order.status)
                  ? "Assign a delivery boy first"
                  : `Cannot mark delivered (status: ${order.status})`,
        });
        continue;
      }

      const result = await applyStoreOrderStatus({
        storeOrderId: order._id,
        status: "delivered",
        skipCompletionGuards: true,
        reason,
        actor: { id: manager._id, role: "delivery_manager", name: byName },
      });
      if (!result.success) {
        failed.push({ id, orderNumber: order.orderNumber, message: result.message });
        continue;
      }
      emitPreOrderChange(result.order, "order_status_updated", {
        orderId: result.order._id.toString(),
        orderNumber: result.order.orderNumber,
        status: "delivered",
        isPreOrder: true,
      });
      delivered.push(result.order.toSafeJSON());
    }

    return res.status(delivered.length ? 200 : 400).json({
      success: delivered.length > 0,
      message: delivered.length
        ? `${plural(delivered.length)} marked delivered${failed.length ? ` · ${failed.length} skipped` : ""}`
        : failed[0]?.message || "Nothing updated",
      delivered,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

// ── Vendor (owner of the dark stores) ───────────────────────────────────────

const vendorIdOf = (req) => String(req.user?.vendorId || req.user?.id || "");
const vendorNameOf = (req) => req.user?.vendorName || req.user?.name || "Vendor";

/** Dark stores linked to this vendor, plus stores no vendor has been linked to yet (shared by every vendor). */
async function vendorStores(req) {
  const vendorId = vendorIdOf(req);
  if (!vendorId) return [];
  return DeliveryManager.find({
    $or: [{ vendorId }, { vendorId: "" }, { vendorId: null }, { vendorId: { $exists: false } }],
  }).select(STORE_FIELDS);
}

function emitPreOrderChange(order, event, payload, vendorId) {
  emitToStore(order.managerId, event, payload);
  try {
    const io = getIO();
    io.to("role:product_manager").emit(event, payload);
    if (vendorId) io.to(`vendor_${vendorId}`).emit(event, payload);
  } catch (err) {
    console.warn(`[preorder] socket emit ${event} failed:`, err.message);
  }
}

/** GET /api/vendor/preorders?date=YYYY-MM-DD&storeId= — pre-orders of every dark store this vendor owns. */
export const listVendorPreOrders = async (req, res, next) => {
  try {
    const stores = await vendorStores(req);
    const storeMap = new Map(stores.map((s) => [s._id.toString(), s]));
    const storeId = String(req.query.storeId || "").trim();
    const managerIds = storeId && storeMap.has(storeId) ? [storeId] : [...storeMap.keys()];
    const date = parseDate(req.query.date);

    const orders = managerIds.length
      ? (
          await StoreOrder.find({
            isPreOrder: true,
            managerId: { $in: managerIds },
            ...(date ? { preOrderDate: date } : defaultDateScope()),
          })
        ).sort(sortPreOrders)
      : [];
    const riderMap = await loadRiderMap(orders);

    return res.json({
      success: true,
      today: todayIst(),
      tomorrow: shiftIndiaDateString(todayIst(), 1),
      stores: stores.map(storeSummary),
      summary: countSummary(orders),
      orders: orders.map((o) => serializePreOrder(o, { riderMap, storeMap })),
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/vendor/preorders/confirm  body { orderIds: string[] } */
export const confirmVendorPreOrders = async (req, res, next) => {
  try {
    const orderIds = readOrderIds(req, res);
    if (!orderIds) return;
    const vendorId = vendorIdOf(req);
    const storeIds = (await vendorStores(req)).map((s) => s._id);
    const byName = vendorNameOf(req);

    const confirmed = [];
    const failed = [];
    for (const id of orderIds) {
      const order = await StoreOrder.findOneAndUpdate(
        {
          _id: id,
          isPreOrder: true,
          managerId: { $in: storeIds },
          status: "preorder_hold",
          vendorStatus: { $nin: ["confirmed", "rejected"] },
        },
        { $set: { vendorStatus: "confirmed", vendorConfirmedAt: new Date(), vendorActionByName: byName } },
        { returnDocument: 'after' }
      );
      if (!order) {
        const existing = await StoreOrder.findOne({ _id: id, managerId: { $in: storeIds } }).select(
          "orderNumber status isPreOrder vendorStatus"
        );
        failed.push({
          id,
          orderNumber: existing?.orderNumber || "",
          message: !existing?.isPreOrder
            ? "Pre-order not found in your dark stores"
            : existing.status === "cancelled"
              ? "Cancelled"
              : "Already confirmed",
        });
        continue;
      }

      await syncCustomerOrderFromStore(order, "preorder_vendor_confirmed").catch((err) =>
        console.warn("[preorder] customer sync failed:", err.message)
      );
      emitPreOrderChange(
        order,
        "preorder_updated",
        {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          vendorStatus: "confirmed",
          preOrderStage: order.preOrderStage,
        },
        vendorId
      );
      confirmed.push(order.toSafeJSON());
    }

    return res.status(confirmed.length ? 200 : 400).json({
      success: confirmed.length > 0,
      message: confirmed.length
        ? `${plural(confirmed.length)} confirmed${failed.length ? ` · ${failed.length} skipped` : ""}`
        : failed[0]?.message || "Nothing confirmed",
      confirmed,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/vendor/preorders/pack  body { orderIds: string[] } — confirmed → packed */
export const packVendorPreOrders = async (req, res, next) => {
  try {
    const orderIds = readOrderIds(req, res);
    if (!orderIds) return;
    const vendorId = vendorIdOf(req);
    const storeIds = (await vendorStores(req)).map((s) => s._id);

    const packed = [];
    const failed = [];
    for (const id of orderIds) {
      const now = new Date();
      const order = await StoreOrder.findOneAndUpdate(
        {
          _id: id,
          isPreOrder: true,
          managerId: { $in: storeIds },
          status: "preorder_hold",
          vendorStatus: "confirmed",
          preOrderStage: { $in: ["pending", null, ""] },
        },
        { $set: { preOrderStage: "ready", readyAt: now } },
        { returnDocument: 'after' }
      );
      if (order && !order.preparingAt) {
        order.preparingAt = now;
        await order.save();
      }
      if (!order) {
        const existing = await StoreOrder.findOne({ _id: id, managerId: { $in: storeIds } }).select(
          "orderNumber status isPreOrder vendorStatus preOrderStage"
        );
        failed.push({
          id,
          orderNumber: existing?.orderNumber || "",
          message: !existing?.isPreOrder
            ? "Pre-order not found in your dark stores"
            : existing.status === "cancelled"
              ? "Cancelled"
              : existing.status === "preorder_hold" && !isVendorConfirmed(existing)
                ? "Confirm the pre-order first"
                : existing.status === "preorder_hold"
                  ? "Already packed"
                  : "Already shipped",
        });
        continue;
      }

      await syncCustomerOrderFromStore(order, "preorder_preparing").catch((err) =>
        console.warn("[preorder] customer sync failed:", err.message)
      );
      emitPreOrderChange(
        order,
        "preorder_updated",
        { orderId: order._id.toString(), orderNumber: order.orderNumber, preOrderStage: "ready" },
        vendorId
      );
      packed.push(order.toSafeJSON());
    }

    return res.status(packed.length ? 200 : 400).json({
      success: packed.length > 0,
      message: packed.length
        ? `${plural(packed.length)} packed${failed.length ? ` · ${failed.length} skipped` : ""}`
        : failed[0]?.message || "Nothing packed",
      packed,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/vendor/preorders/ship  body { orderIds: string[], note? } — packed → shipped to the dark store */
export const shipVendorPreOrders = async (req, res, next) => {
  try {
    const orderIds = readOrderIds(req, res);
    if (!orderIds) return;
    const storeIds = (await vendorStores(req)).map((s) => s._id);

    const { forwarded, failed } = await shipHeldPreOrders({
      orderIds,
      note: String(req.body?.note || "").trim().slice(0, 500),
      forwardedByName: `${vendorNameOf(req)} (Vendor)`,
      forwardedBy: null,
      scope: { managerId: { $in: storeIds } },
      stages: ["preparing", "ready"],
      vendorId: vendorIdOf(req),
    });

    return res.status(forwarded.length ? 200 : 400).json({
      success: forwarded.length > 0,
      message: forwarded.length
        ? `${plural(forwarded.length)} shipped to the dark store${failed.length ? ` · ${failed.length} skipped` : ""}`
        : failed[0]?.message || "Nothing shipped",
      shipped: forwarded,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/vendor/preorders/:orderId/reject  body { reason } — only before the order is packed */
export const rejectVendorPreOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const reason = String(req.body?.reason || "").trim().slice(0, 300);
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: "A reason is required to reject a pre-order" });
    }
    const storeIds = (await vendorStores(req)).map((s) => s._id);
    const order = await StoreOrder.findOne({ _id: orderId, isPreOrder: true, managerId: { $in: storeIds } });
    if (!order) {
      return res.status(404).json({ success: false, message: "Pre-order not found in your dark stores" });
    }
    if (order.status !== "preorder_hold" || !["", "pending"].includes(order.preOrderStage || "")) {
      return res.status(400).json({
        success: false,
        message: "Only pre-orders that are not yet packed can be rejected",
      });
    }

    const byName = vendorNameOf(req);
    order.vendorStatus = "rejected";
    order.vendorActionByName = byName;
    order.vendorRejectReason = reason;
    order.notes = [order.notes, `Rejected by ${byName} (Vendor): ${reason}`].filter(Boolean).join("\n");
    await order.save();

    const result = await applyStoreOrderStatus({
      storeOrderId: order._id,
      status: "cancelled",
      restoreStockOnCancel: false,
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, message: result.message });
    }
    emitPreOrderChange(
      order,
      "preorder_updated",
      { orderId: order._id.toString(), orderNumber: order.orderNumber, vendorStatus: "rejected" },
      vendorIdOf(req)
    );

    return res.json({
      success: true,
      message: `Pre-order #${order.orderNumber} rejected — the customer has been informed`,
      order: result.order.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};
