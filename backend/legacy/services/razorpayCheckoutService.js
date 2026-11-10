import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import Order from "../models/order/Order.js";
import { finalizeOrder } from "../utils/orderHelpers.js";

/** Marks Razorpay orders created for customer checkout (not delivery QR or others). */
export const CHECKOUT_PURPOSE = "checkout";

const CLAIM_WAIT_MS = 500;
const CLAIM_WAIT_TRIES = 10;

function hmacHex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqualHex(expected, received) {
  const a = Buffer.from(String(expected || ""), "utf8");
  const b = Buffer.from(String(received || ""), "utf8");
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Checkout handler signature: HMAC(order_id|payment_id) with the key secret. */
export function isValidCheckoutSignature(razorpayOrderId, razorpayPaymentId, signature) {
  const expected = hmacHex(process.env.RAZORPAY_KEY_SECRET || "", `${razorpayOrderId}|${razorpayPaymentId}`);
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC(raw body) with the webhook secret. */
export function isValidWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody) return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature);
}

/**
 * Confirm with Razorpay that the payment belongs to this order, is for the order's full
 * amount and succeeded; capture it if it is only authorized. Returns { payment } or { error }.
 */
export async function confirmPayment(paymentId, razorpayOrder) {
  let payment = await razorpay.payments.fetch(paymentId);
  if (!payment || payment.order_id !== razorpayOrder.id) {
    return { error: "This payment does not belong to the checkout order." };
  }
  if (payment.currency !== "INR" || Number(payment.amount) !== Number(razorpayOrder.amount)) {
    return { error: "Paid amount does not match the order amount." };
  }
  if (payment.status === "authorized") {
    payment = await razorpay.payments.capture(payment.id, payment.amount, payment.currency);
  }
  if (payment.status !== "captured") {
    return { error: `Payment is ${payment.status || "not complete"}.` };
  }
  return { payment };
}

/** Full refund for a captured payment that could not become an order. */
export async function refundPayment(payment, reason) {
  try {
    const refund = await razorpay.payments.refund(payment.id, {
      amount: payment.amount,
      notes: { reason: String(reason || "Order could not be placed").slice(0, 250) },
    });
    return { refunded: true, refundId: refund?.id || "" };
  } catch (err) {
    console.error(`[razorpay] refund failed for ${payment.id}:`, err?.error?.description || err.message);
    return { refunded: false };
  }
}

/** The finished order already created for this payment, if any. */
export function findOrderForPayment(paymentId) {
  return Order.findOne({ razorpayPaymentId: paymentId, status: { $ne: "attempted" } });
}

async function waitForFinalized(orderId) {
  for (let i = 0; i < CLAIM_WAIT_TRIES; i += 1) {
    const current = await Order.findById(orderId);
    if (current && current.status !== "attempted") return current;
    await new Promise((resolve) => setTimeout(resolve, CLAIM_WAIT_MS));
  }
  return null;
}

/**
 * Place the order exactly as priced when the Razorpay order was created (the checkout
 * attempt bound to it), so a later price/stock/coupon change cannot strand a payment.
 * Safe to call from both the checkout callback and the webhook: only one caller claims
 * the attempt (`placed: true`, it sends the notifications), the other gets the finished order.
 * Returns { order, placed }, or null when there is no usable attempt for this payment.
 */
export async function finalizeFromCheckoutAttempt({ userId, razorpayOrder, payment, message = "" }) {
  const attempt = await Order.findOne({ user: userId, razorpayOrderId: razorpayOrder.id });
  if (!attempt) return null;
  if (attempt.status !== "attempted") {
    return attempt.razorpayPaymentId === payment.id ? { order: attempt, placed: false } : null;
  }
  if (Math.round(Number(attempt.total) * 100) !== Number(razorpayOrder.amount)) return null;

  const claim = await Order.updateOne(
    { _id: attempt._id, status: "attempted", razorpayPaymentId: { $in: ["", null] } },
    { $set: { razorpayPaymentId: payment.id } }
  );
  if (!claim.modifiedCount) {
    const finished = await waitForFinalized(attempt._id);
    return finished?.razorpayPaymentId === payment.id ? { order: finished, placed: false } : null;
  }

  const snapshot = attempt.toObject();
  const order = await finalizeOrder({
    userId,
    orderItems: snapshot.items,
    deliveryAddress: snapshot.deliveryAddress,
    subtotal: snapshot.subtotal,
    couponCode: snapshot.couponCode,
    couponDiscount: snapshot.couponDiscount,
    rewardPointsUsed: snapshot.rewardPointsUsed,
    rewardDiscount: snapshot.rewardDiscount,
    rewardPointsEarned: snapshot.rewardPointsEarned,
    giftCardCode: snapshot.giftCardCode,
    giftCardDiscount: snapshot.giftCardDiscount,
    deliveryCharges: snapshot.deliveryCharges,
    heavyHandlingFee: snapshot.heavyHandlingFee,
    packagingFee: snapshot.packagingFee,
    bundleDiscount: snapshot.bundleDiscount,
    loyaltyDiscount: snapshot.loyaltyDiscount,
    dynamicDiscount: snapshot.dynamicDiscount,
    freeAddon: snapshot.freeAddon,
    dynamicPricingDetails: snapshot.dynamicPricingDetails,
    gstAmount: snapshot.gstAmount,
    total: snapshot.total,
    cart: null,
    checkoutMode: snapshot.checkoutMode,
    paymentMethod: "online",
    paymentStatus: "paid",
    razorpayOrderId: razorpayOrder.id,
    razorpayPaymentId: payment.id,
    razorpayPaidAmount: Number(payment.amount) / 100,
    paidAt: new Date(),
    message,
    attemptedOrderId: attempt._id,
  });
  return { order, placed: true };
}
