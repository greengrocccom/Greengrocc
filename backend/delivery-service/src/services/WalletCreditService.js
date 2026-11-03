/**
 * WalletCreditService
 *
 * Implements the 5-minute delayed wallet credit for delivery riders.
 * When an order is successfully delivered:
 *  1. The earning is NOT credited immediately.
 *  2. A 5-minute delayed timer is scheduled (and stored on the order in MongoDB).
 *  3. After 5 minutes (300,000 ms):
 *     - The earning amount is credited to rider's walletBalance, todayEarnings, and totalLifetimeEarnings.
 *     - The order is marked walletCreditPending: false, walletCreditedAt: new Date().
 *     - A notification is sent to the rider: "₹[amount] credited to your wallet for Order #[orderNumber]".
 *     - Real-time socket events ('wallet_updated' and 'rider_wallet_credited') are emitted.
 *  4. A background recovery cron runs every 30 seconds to catch any orders that matured
 *     during server restart or network interruptions.
 */

import StoreOrder from "../models/StoreOrder.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { notifyWalletCredited } from "./RiderNotificationService.js";
import { getIO } from "../../../socket.js";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// In-memory timer registry to avoid duplicate execution
const activeTimers = new Map();

/**
 * Schedule 5-minute delayed wallet credit for a delivered order.
 *
 * @param {object} params
 * @param {string|import("mongoose").Types.ObjectId} params.orderId
 * @param {string|import("mongoose").Types.ObjectId} params.riderId
 * @param {number} params.amount
 * @param {string} params.orderNumber
 * @param {number} [params.delayMs]
 */
export async function scheduleWalletCredit({
  orderId,
  riderId,
  amount,
  orderNumber,
  delayMs = FIVE_MINUTES_MS,
}) {
  const roundedAmount = Math.round(Number(amount) || 0);
  if (roundedAmount <= 0 || !riderId || !orderId) {
    return { scheduled: false, reason: "zero_or_invalid_amount" };
  }

  const orderIdStr = String(orderId);
  const creditAt = new Date(Date.now() + delayMs);

  // Persist pending status on StoreOrder document
  await StoreOrder.findByIdAndUpdate(orderIdStr, {
    walletCreditPending: true,
    walletCreditAmount: roundedAmount,
    walletCreditAt: creditAt,
  });

  // Clear existing in-memory timer if any
  if (activeTimers.has(orderIdStr)) {
    clearTimeout(activeTimers.get(orderIdStr));
  }

  // Set 5-minute timer
  const timer = setTimeout(async () => {
    activeTimers.delete(orderIdStr);
    try {
      await executeWalletCredit(orderIdStr);
    } catch (err) {
      console.error(`[WalletCreditService] Failed executing credit for order ${orderIdStr}:`, err.message);
    }
  }, Math.max(0, delayMs));

  activeTimers.set(orderIdStr, timer);

  console.log(
    `[WalletCreditService] Scheduled ₹${roundedAmount} wallet credit for rider ${riderId} (Order #${orderNumber}) in ${Math.round(delayMs / 1000)}s`
  );

  return { scheduled: true, creditAt, amount: roundedAmount };
}

/**
 * Atomically execute the wallet credit for an order.
 * Safe to call multiple times (idempotent via { walletCreditPending: true }).
 *
 * @param {string} orderIdStr
 */
export async function executeWalletCredit(orderIdStr) {
  if (!orderIdStr) return;

  // 1. Atomically claim and mark the order as credited
  const order = await StoreOrder.findOneAndUpdate(
    {
      _id: orderIdStr,
      walletCreditPending: true,
    },
    {
      $set: {
        walletCreditPending: false,
        walletCreditedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!order) {
    // Either already credited or not marked pending
    return;
  }

  const amount = Math.round(
    Number(order.walletCreditAmount || order.riderDeliveryEarning) || 0
  );
  const riderId = order.assignedRiderId;

  if (amount <= 0 || !riderId) {
    return;
  }

  const riderIdStr = String(riderId);

  // 2. Atomically increment rider's walletBalance, todayEarnings, totalLifetimeEarnings
  const updatedRider = await DeliveryBoy.findByIdAndUpdate(
    riderIdStr,
    {
      $inc: {
        walletBalance: amount,
        todayEarnings: amount,
        totalLifetimeEarnings: amount,
      },
    },
    { returnDocument: 'after' }
  );

  console.log(
    `[WalletCreditService] ✓ Credited ₹${amount} to rider ${riderIdStr} for Order #${order.orderNumber}. New balance: ₹${updatedRider?.walletBalance ?? 0}`
  );

  // 3. Send Notification to Rider ("amount comes in wallet")
  try {
    await notifyWalletCredited(riderIdStr, {
      amount,
      orderId: order._id,
      orderNumber: order.orderNumber,
      reason: "order_delivery_earning",
    });
  } catch (notifErr) {
    console.warn(`[WalletCreditService] Notification error for rider ${riderIdStr}:`, notifErr.message);
  }

  // 4. Emit real-time socket events to update wallet balance on rider app
  try {
    const io = getIO();
    const payload = {
      riderId: riderIdStr,
      amount,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      walletBalance: updatedRider?.walletBalance ?? 0,
      todayEarnings: updatedRider?.todayEarnings ?? 0,
      totalLifetimeEarnings: updatedRider?.totalLifetimeEarnings ?? 0,
      message: `₹${amount} credited to your wallet for Order #${order.orderNumber}`,
      timestamp: new Date().toISOString(),
    };

    io.to(`rider_${riderIdStr}`).emit("wallet_updated", payload);
    io.to(`rider:${riderIdStr}`).emit("wallet_updated", payload);
    io.to(`rider_${riderIdStr}`).emit("rider_wallet_credited", payload);
    io.to(`rider:${riderIdStr}`).emit("rider_wallet_credited", payload);
  } catch (sockErr) {
    // Non-blocking socket emission
  }
}

/**
 * Background recovery job:
 * Runs periodically to process any pending credits whose 5-minute window has elapsed.
 * Handles server restarts or timer skips seamlessly.
 */
export async function processPendingWalletCredits() {
  try {
    const now = new Date();
    const dueOrders = await StoreOrder.find({
      status: "delivered",
      walletCreditPending: true,
      walletCreditAt: { $lte: now },
    }).select("_id");

    for (const ord of dueOrders) {
      await executeWalletCredit(String(ord._id));
    }

    // For any orders still waiting in the future that aren't yet in activeTimers, schedule their timers
    const futureOrders = await StoreOrder.find({
      status: "delivered",
      walletCreditPending: true,
      walletCreditAt: { $gt: now },
    }).select("_id assignedRiderId walletCreditAmount orderNumber walletCreditAt");

    for (const ord of futureOrders) {
      const idStr = String(ord._id);
      if (!activeTimers.has(idStr)) {
        const remainingMs = Math.max(0, new Date(ord.walletCreditAt).getTime() - Date.now());
        const timer = setTimeout(async () => {
          activeTimers.delete(idStr);
          try {
            await executeWalletCredit(idStr);
          } catch (err) {
            console.error(`[WalletCreditService] Error executing recovered credit:`, err.message);
          }
        }, remainingMs);
        activeTimers.set(idStr, timer);
      }
    }
  } catch (err) {
    console.error("[WalletCreditService] Error in processPendingWalletCredits:", err.message);
  }
}

/**
 * Initialize periodic check for pending wallet credits (runs every 30 seconds).
 */
export function initWalletCreditCron() {
  // Run once immediately on startup
  processPendingWalletCredits().catch(() => {});

  // Run every 30 seconds
  setInterval(() => {
    processPendingWalletCredits().catch(() => {});
  }, 30 * 1000);

  console.log("[WalletCreditService] 5-minute delayed wallet credit scheduler initialized.");
}
