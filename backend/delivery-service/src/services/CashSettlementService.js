/**
 * CashSettlementService
 *
 * Manages cash liability lifecycle for deliveries paid in cash.
 *
 * IMPORTANT:
 *  - Cash collected from the customer is a LIABILITY, not rider earnings.
 *  - Only the Dark Store manager can confirm physical cash receipt.
 *  - All financial mutations use atomic MongoDB operations.
 */

import mongoose from "mongoose";
import CashSettlement from "../models/CashSettlement.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import StoreOrder from "../models/StoreOrder.js";
import { getIO } from "../../../socket.js";

/**
 * Create a cash settlement record when a rider collects cash.
 * Also atomically increments rider.pendingCashAmount.
 *
 * @param {object} params
 * @param {string|ObjectId} params.darkStoreId
 * @param {string|ObjectId} params.riderId
 * @param {string|ObjectId} params.orderId
 * @param {string} params.orderNumber
 * @param {number} params.amount  - cash collected from customer
 * @returns {Promise<CashSettlement>}
 */
export async function createCashLiability({ darkStoreId, riderId, orderId, orderNumber, amount, notes = "" }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Create settlement record
    const [settlement] = await CashSettlement.create(
      [
        {
          darkStoreId,
          riderId: riderId || null,
          orderId,
          orderNumber: orderNumber || "",
          amount,
          status: "PENDING",
          collectedAt: new Date(),
          notes,
        },
      ],
      { session }
    );

    if (riderId) {
      await DeliveryBoy.findByIdAndUpdate(
        riderId,
        { $inc: { pendingCashAmount: amount } },
        { session }
      );
    }

    await session.commitTransaction();

    if (!riderId) return settlement;
    try {
      const io = getIO();
      const updatedRider = await DeliveryBoy.findById(riderId).select("pendingCashAmount");
      const payload = {
        riderId: String(riderId),
        pendingCashAmount: updatedRider?.pendingCashAmount || 0,
        addedAmount: amount,
        message: `Cash collected: ₹${amount}. Hand over to darkstore manager till end of the day.`,
      };
      io.to(`rider_${riderId}`).emit("rider_cash_updated", payload);
      io.to(`rider:${riderId}`).emit("rider_cash_updated", payload);
      io.to(`store_${darkStoreId}`).emit("store_cash_updated", payload);
    } catch (_) {}

    return settlement;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Mark all PENDING settlements for a rider as SUBMITTED
 * (rider has physically brought cash to dark store, awaiting manager confirmation).
 *
 * @param {string|ObjectId} riderId
 * @param {string|ObjectId} darkStoreId
 * @returns {Promise<{modifiedCount: number}>}
 */
export async function riderSubmitsCash(riderId, darkStoreId) {
  const result = await CashSettlement.updateMany(
    { riderId, darkStoreId, status: "PENDING" },
    { $set: { status: "SUBMITTED", submittedAt: new Date() } }
  );
  return { modifiedCount: result.modifiedCount };
}

/**
 * Dark Store manager confirms receipt of cash.
 * Atomically marks settlements as COMPLETED and reduces rider.pendingCashAmount.
 *
 * @param {object} params
 * @param {string|ObjectId} params.darkStoreId
 * @param {string|ObjectId} params.riderId
 * @param {string|ObjectId} params.managerId
 * @param {string[]|ObjectId[]} [params.settlementIds] - specific settlements to confirm; if empty, confirms all SUBMITTED ones
 * @returns {Promise<{confirmed: number, totalAmount: number}>}
 */
export async function confirmCashReceipt({ darkStoreId, riderId, managerId, settlementIds = [] }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const filter = {
      darkStoreId,
      riderId,
      status: { $in: ["SUBMITTED", "PENDING"] },
    };
    if (settlementIds.length > 0) {
      filter._id = { $in: settlementIds };
    }

    const settlements = await CashSettlement.find(filter).session(session);
    if (settlements.length === 0) {
      await session.abortTransaction();
      return { confirmed: 0, totalAmount: 0 };
    }

    const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
    const ids = settlements.map((s) => s._id);

    await CashSettlement.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: "COMPLETED",
          confirmedAt: new Date(),
          confirmedBy: managerId,
        },
      },
      { session }
    );

    // Reduce rider pending cash — clamp to 0 to avoid negative values
    const rider = await DeliveryBoy.findById(riderId).session(session);
    if (rider) {
      rider.pendingCashAmount = Math.max(0, (rider.pendingCashAmount || 0) - totalAmount);
      await rider.save({ session });
    }

    await session.commitTransaction();

    try {
      const io = getIO();
      const payload = {
        riderId: String(riderId),
        pendingCashAmount: rider?.pendingCashAmount || 0,
        confirmedAmount: totalAmount,
        message: `Dark store manager confirmed cash deposit of ₹${totalAmount}.`,
      };
      io.to(`rider_${riderId}`).emit("rider_cash_updated", payload);
      io.to(`rider:${riderId}`).emit("rider_cash_updated", payload);
      io.to(`store_${darkStoreId}`).emit("store_cash_updated", payload);
    } catch (_) {}

    return { confirmed: settlements.length, totalAmount };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Manager confirms physical cash for one delivered COD order.
 * Creates a settlement if missing, then marks it COMPLETED.
 */
export async function confirmCashForOrder({ darkStoreId, managerId, orderId }) {
  const order = await StoreOrder.findById(orderId);
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }
  if (String(order.managerId) !== String(darkStoreId)) {
    const err = new Error("Order does not belong to your dark store");
    err.statusCode = 403;
    throw err;
  }
  if (order.status !== "delivered") {
    const err = new Error("Only delivered orders can have cash confirmed");
    err.statusCode = 400;
    throw err;
  }
  if (String(order.paymentMethod || "").toUpperCase() !== "COD") {
    const err = new Error("Order is not COD / physical cash");
    err.statusCode = 400;
    throw err;
  }
  let settlement = await CashSettlement.findOne({ orderId: order._id });
  if (!order.assignedRiderId) {
    if (!settlement) {
      const err = new Error("No cash record for this order");
      err.statusCode = 400;
      throw err;
    }
    if (settlement.status !== "COMPLETED") {
      settlement.status = "COMPLETED";
      settlement.confirmedAt = new Date();
      settlement.confirmedBy = managerId;
      await settlement.save();
    }
    return { confirmed: 1, alreadyConfirmed: false, totalAmount: settlement.amount, settlement, order };
  }

  if (settlement?.status === "COMPLETED") {
    return {
      confirmed: 0,
      alreadyConfirmed: true,
      totalAmount: settlement.amount,
      settlement,
      order,
    };
  }

  const amount =
    Number(settlement?.amount) ||
    Number(order.amountCollected) ||
    Number(order.amountToCollect) ||
    0;

  if (amount <= 0) {
    const err = new Error("No cash amount to confirm for this order");
    err.statusCode = 400;
    throw err;
  }

  if (!settlement) {
    settlement = await createCashLiability({
      darkStoreId,
      riderId: order.assignedRiderId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount,
    });
  }

  const result = await confirmCashReceipt({
    darkStoreId,
    riderId: order.assignedRiderId,
    managerId,
    settlementIds: [settlement._id],
  });

  order.paymentStatus = "collected";
  if (!order.amountCollected) order.amountCollected = amount;
  await order.save();

  const updated = await CashSettlement.findById(settlement._id);
  return {
    confirmed: result.confirmed,
    alreadyConfirmed: false,
    totalAmount: result.totalAmount || amount,
    settlement: updated,
    order,
  };
}

/**
 * Failed delivery: flag the open cash record for review (rider still holds the cash).
 * Returned to store: close it and take the amount off the rider's pending cash.
 */
export async function resolveCashForOrder({ orderId, outcome, note = "" }) {
  const settlement = await CashSettlement.findOne({
    orderId,
    status: { $in: ["PENDING", "SUBMITTED", "DISPUTED"] },
  });
  if (!settlement) return null;

  const stamp = `[${new Date().toISOString()}] ${note}`.trim();
  settlement.notes = [settlement.notes, stamp].filter(Boolean).join("\n");

  if (outcome === "flag") {
    settlement.status = "DISPUTED";
    await settlement.save();
  } else if (outcome === "cancel") {
    settlement.status = "CANCELLED";
    await settlement.save();
    if (settlement.riderId) {
      const rider = await DeliveryBoy.findById(settlement.riderId);
      if (rider) {
        rider.pendingCashAmount = Math.max(0, (rider.pendingCashAmount || 0) - settlement.amount);
        await rider.save();
      }
    }
  }

  try {
    getIO().to(`store_${settlement.darkStoreId}`).emit("store_cash_updated", {
      riderId: settlement.riderId ? String(settlement.riderId) : null,
      orderId: String(orderId),
      status: settlement.status,
    });
  } catch (_) {}
  return settlement;
}

/**
 * Fetch pending/submitted cash summary for a rider at a specific dark store.
 *
 * @param {string|ObjectId} riderId
 * @param {string|ObjectId} darkStoreId
 * @returns {Promise<{totalPending: number, settlements: CashSettlement[]}>}
 */
export async function getRiderPendingCash(riderId, darkStoreId) {
  const settlements = await CashSettlement.find({
    riderId,
    darkStoreId,
    status: { $in: ["PENDING", "SUBMITTED"] },
  }).sort({ createdAt: 1 });

  const totalPending = settlements.reduce((sum, s) => sum + s.amount, 0);
  return { totalPending, settlements };
}

/**
 * Fetch all pending/submitted cash across all riders for a dark store (manager view).
 *
 * @param {string|ObjectId} darkStoreId
 * @returns {Promise<object[]>}
 */
export async function getDarkStorePendingCash(darkStoreId) {
  const settlements = await CashSettlement.find({
    darkStoreId,
    status: { $in: ["PENDING", "SUBMITTED", "DISPUTED"] },
  })
    .populate("riderId", "name phone")
    .populate("orderId", "orderNumber")
    .sort({ createdAt: -1 });

  // Group by rider
  const byRider = new Map();
  for (const s of settlements) {
    const rId = s.riderId?._id?.toString() || s.riderId?.toString() || "store";
    if (!byRider.has(rId)) {
      byRider.set(rId, {
        riderId: rId === "store" ? null : rId,
        riderName: rId === "store" ? "Store (no rider)" : s.riderId?.name || "Unknown",
        riderPhone: s.riderId?.phone || "",
        totalPending: 0,
        settlements: [],
      });
    }
    const entry = byRider.get(rId);
    entry.totalPending += s.amount;
    entry.settlements.push(s.toSafeJSON ? s.toSafeJSON() : s);
  }

  return Array.from(byRider.values());
}
