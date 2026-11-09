import razorpay, { isRazorpayConfigured } from "../config/razorpay.js";
import {
  CHECKOUT_PURPOSE,
  confirmPayment,
  finalizeFromCheckoutAttempt,
  findOrderForPayment,
  isValidCheckoutSignature,
  isValidWebhookSignature,
  refundPayment,
} from "../services/razorpayCheckoutService.js";
import Order from "../models/order/Order.js";
import Payment from "../models/payment/Payment.js";
import {
  finalizeOrder,
  normalizeOrderMessage,
  prepareOrderData,
  upsertCheckoutAttemptOrder,
} from "../utils/orderHelpers.js";
import { dispatchDeliveryOrder } from "../services/deliveryDispatcher.js";
import { resolveImageForStorage } from "../utils/imageValidation.js";
import { UPLOAD_FOLDERS } from "../utils/uploadFolders.js";
import {
  calculatePayableAmount,
  getRazorpayPaidAt,
  getRazorpayPaymentId,
  getRazorpayTransactionAmount,
  RAZORPAY_SUCCESS_PAYMENT_STATUSES,
} from "../utils/paymentHelpers.js";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination.js";
import { buildOrderSearchFilter } from "../utils/adminSearch.js";
import { validatePreOrderSlot } from "../utils/preOrderHelpers.js";
import {
  notifyOrderCreated,
  notifyPaymentFailed,
  notifyPaymentSuccess,
} from "../services/orderNotificationDispatcher.js";

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

const SUCCESSFUL_RAZORPAY_STATUSES = new Set(["captured", "authorized"]);

async function fetchRazorpayCapturedAmount(paymentId) {
  if (!isRazorpayConfigured() || !paymentId) return null;

  try {
    const payment = await razorpay.payments.fetch(paymentId);
    if (!payment || !SUCCESSFUL_RAZORPAY_STATUSES.has(payment.status)) {
      return null;
    }

    return Math.round(Number(payment.amount) / 100 * 100) / 100;
  } catch {
    return null;
  }
}

async function resolveOrderRazorpayAmount(order) {
  const paymentId = getRazorpayPaymentId(order);
  const apiAmount = await fetchRazorpayCapturedAmount(paymentId);

  if (apiAmount != null) {
    const updates = {};
    if (Number(order.razorpayPaidAmount) !== apiAmount) {
      updates.razorpayPaidAmount = apiAmount;
    }
    if (Object.keys(updates).length) {
      await Order.updateOne({ _id: order._id }, { $set: updates });
    }
    return apiAmount;
  }

  return getRazorpayTransactionAmount(order);
}

export const createRazorpayOrder = async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(500).json({
        success: false,
        message: "Online payment is not configured. Please contact support.",
      });
    }

    const {
      addressId,
      paymentMode = "online",
      checkoutItems,
      checkoutMode,
      buyNow,
      couponCode,
      rewardPointsToUse,
      giftCardCode,
      customerLocation,
      preOrderSlot,
    } = req.body;

    if (paymentMode !== "online") {
      return res.status(400).json({
        success: false,
        message: "Partial advance payment is no longer available. Pay the full amount online or choose pay on delivery.",
      });
    }

    const slotCheck = await validatePreOrderSlot(preOrderSlot);
    if (slotCheck.error) {
      return res.status(slotCheck.status).json({
        success: false,
        message: slotCheck.error,
        code: slotCheck.code,
      });
    }

    const result = await prepareOrderData(req.user._id, addressId, {
      checkoutItems,
      checkoutMode,
      buyNow,
      couponCode,
      rewardPointsToUse,
      giftCardCode,
      customerLocation,
      fulfillmentType: req.body.fulfillmentType,
      requireDarkStore: true,
    });
    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error,
        ...(result.code ? { code: result.code } : {}),
        ...(result.removedItems ? { removedItems: result.removedItems } : {}),
      });
    }

    const attemptedOrder = await upsertCheckoutAttemptOrder(
      req.user._id,
      {
        orderItems: result.orderItems,
        deliveryAddress: result.deliveryAddress,
        subtotal: result.subtotal,
        couponCode: result.couponCode,
        couponDiscount: result.couponDiscount,
        rewardPointsUsed: result.rewardPointsUsed,
        rewardDiscount: result.rewardDiscount,
        rewardPointsEarned: result.rewardPointsEarned,
        giftCardCode: result.giftCardCode,
        giftCardDiscount: result.giftCardDiscount,
        deliveryCharges: result.deliveryCharges,
        gstAmount: result.gstAmount,
        total: result.total,
        cart: result.cart,
        checkoutMode: result.checkoutMode,
        preOrderSlot: slotCheck.preOrderSlot,
        fulfillmentType: result.fulfillmentType,
      },
      "online"
    );

    const payableAmount = calculatePayableAmount(result.total);
    const amountPaise = Math.round(payableAmount * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `bmm_${Date.now()}`,
      notes: {
        purpose: CHECKOUT_PURPOSE,
        userId: req.user._id.toString(),
        attemptedOrderId: attemptedOrder._id.toString(),
        addressId: String(addressId),
        paymentMode,
      },
    });
    // Bind the priced checkout to this Razorpay order so the payment always becomes exactly this order.
    await Order.updateOne(
      { _id: attemptedOrder._id, status: "attempted" },
      { $set: { razorpayOrderId: razorpayOrder.id, razorpayPaymentId: "" } }
    );

    res.status(200).json({
      success: true,
      data: {
        keyId: process.env.RAZORPAY_KEY_ID,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        paymentMode,
        payableAmount,
        orderTotal: result.total,
        attemptedOrderId: attemptedOrder._id,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create payment order",
    });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(500).json({
        success: false,
        message: "Online payment is not configured",
      });
    }

    const {
      addressId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentMode = "online",
      checkoutItems,
      checkoutMode,
      buyNow,
      attemptedOrderId,
      couponCode,
      rewardPointsToUse,
      giftCardCode,
      customerLocation,
      preOrderSlot,
    } = req.body;
    const orderMessage = normalizeOrderMessage(req.body);

    if (paymentMode !== "online") {
      return res.status(400).json({
        success: false,
        message: "Partial advance payment is no longer available. Pay the full amount online or choose pay on delivery.",
      });
    }

    if (!addressId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment details are incomplete",
      });
    }

    if (!isValidCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Please try again.",
      });
    }

    // Same payment verified again (retry, double tap, replay): return the order it already made.
    const alreadyPlaced = await findOrderForPayment(razorpay_payment_id);
    if (alreadyPlaced) {
      if (String(alreadyPlaced.user) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: "This payment belongs to another account" });
      }
      return res.status(200).json({ success: true, message: "Order placed successfully", data: alreadyPlaced });
    }

    const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
    if (String(razorpayOrder?.notes?.userId || "") !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "This payment belongs to another account" });
    }

    const confirmed = await confirmPayment(razorpay_payment_id, razorpayOrder);
    if (confirmed.error) {
      return res.status(400).json({ success: false, message: confirmed.error });
    }
    const { payment } = confirmed;

    const fromAttempt = await finalizeFromCheckoutAttempt({
      userId: req.user._id,
      razorpayOrder,
      payment,
      message: orderMessage,
    });
    if (fromAttempt) {
      if (fromAttempt.placed) {
        void notifyOrderCreated(fromAttempt.order, { previousStatus: "attempted" });
        void notifyPaymentSuccess(fromAttempt.order, { paymentMode });
      }
      return res.status(201).json({ success: true, message: "Order placed successfully", data: fromAttempt.order });
    }

    // No checkout snapshot for this payment (e.g. the checkout was edited in another tab):
    // price the current checkout; if it no longer matches what was paid, refund in full.
    const result = await prepareOrderData(req.user._id, addressId, {
      checkoutItems,
      checkoutMode,
      buyNow,
      couponCode,
      rewardPointsToUse,
      giftCardCode,
      customerLocation,
      fulfillmentType: req.body.fulfillmentType,
    });
    const payableAmount = result.error ? 0 : calculatePayableAmount(result.total);
    if (result.error || Math.round(payableAmount * 100) !== Number(razorpayOrder.amount)) {
      const reason = result.error || "Order total changed after payment";
      const refund = await refundPayment(payment, reason);
      return res.status(409).json({
        success: false,
        refunded: refund.refunded,
        message: refund.refunded
          ? `We couldn't place your order (${reason}). Your payment of ₹${Number(payment.amount) / 100} has been refunded.`
          : `We couldn't place your order (${reason}). Please contact support with payment ID ${payment.id} for a refund.`,
        ...(result.code ? { code: result.code } : {}),
        ...(result.removedItems ? { removedItems: result.removedItems } : {}),
      });
    }

    const order = await finalizeOrder({
      userId: req.user._id,
      orderItems: result.orderItems,
      deliveryAddress: result.deliveryAddress,
      subtotal: result.subtotal,
      couponCode: result.couponCode,
      couponDiscount: result.couponDiscount,
      rewardPointsUsed: result.rewardPointsUsed,
      rewardDiscount: result.rewardDiscount,
      rewardPointsEarned: result.rewardPointsEarned,
      giftCardCode: result.giftCardCode,
      giftCardDiscount: result.giftCardDiscount,
      deliveryCharges: result.deliveryCharges,
      heavyHandlingFee: result.heavyHandlingFee,
      bundleDiscount: result.bundleDiscount,
      loyaltyDiscount: result.loyaltyDiscount,
      dynamicDiscount: result.dynamicDiscount,
      freeAddon: result.freeAddon,
      dynamicPricingDetails: result.dynamicPricingDetails,
      gstAmount: result.gstAmount,
      total: result.total,
      cart: result.cart,
      checkoutMode: result.checkoutMode,
      paymentMethod: "online",
      paymentStatus: "paid",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpayPaidAmount: payableAmount,
      paidAt: new Date(),
      message: orderMessage,
      attemptedOrderId,
      preOrderSlot,
      fulfillmentType: result.fulfillmentType,
    });

    void notifyOrderCreated(order, {
      previousStatus: attemptedOrderId ? "attempted" : null,
    });
    void notifyPaymentSuccess(order, { paymentMode });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order,
    });
  } catch (error) {
    // Another request placed the order for this payment at the same moment.
    if (error?.code === 11000 && req.body?.razorpay_payment_id) {
      const existing = await findOrderForPayment(req.body.razorpay_payment_id).catch(() => null);
      if (existing && String(existing.user) === String(req.user._id)) {
        return res.status(200).json({ success: true, message: "Order placed successfully", data: existing });
      }
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to verify payment",
    });
  }
};

/**
 * POST /api/payments/webhook — Razorpay `payment.captured` / `order.paid`.
 * Places the order when the customer paid but the app never called /verify (closed the
 * app, lost network). Needs RAZORPAY_WEBHOOK_SECRET and the webhook set up in Razorpay.
 */
export const handleRazorpayWebhook = async (req, res) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !isRazorpayConfigured()) {
    return res.status(503).json({ success: false, message: "Razorpay webhook is not configured" });
  }
  if (!isValidWebhookSignature(req.rawBody, req.get("x-razorpay-signature"))) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const event = String(req.body?.event || "");
  const payment = req.body?.payload?.payment?.entity;
  if (!["payment.captured", "order.paid"].includes(event) || !payment?.id || !payment.order_id) {
    return res.json({ success: true, ignored: true });
  }

  try {
    if (await findOrderForPayment(payment.id)) return res.json({ success: true, alreadyPlaced: true });

    const razorpayOrder = await razorpay.orders.fetch(payment.order_id);
    const userId = razorpayOrder?.notes?.userId;
    if (razorpayOrder?.notes?.purpose !== CHECKOUT_PURPOSE || !userId) {
      return res.json({ success: true, ignored: true });
    }

    const confirmed = await confirmPayment(payment.id, razorpayOrder);
    if (confirmed.error) {
      console.warn(`[razorpay webhook] ${payment.id}: ${confirmed.error}`);
      return res.json({ success: true, ignored: true });
    }

    const result = await finalizeFromCheckoutAttempt({ userId, razorpayOrder, payment: confirmed.payment });
    if (!result) {
      // The app's /verify prices the current checkout and refunds if it can't be placed.
      console.warn(`[razorpay webhook] no checkout snapshot for ${payment.order_id}; left to /verify`);
      return res.json({ success: true, pending: true });
    }
    if (result.placed) {
      void notifyOrderCreated(result.order, { previousStatus: "attempted" });
      void notifyPaymentSuccess(result.order, { paymentMode: "online", source: "webhook" });
    }
    return res.json({ success: true, orderId: String(result.order._id) });
  } catch (error) {
    console.error("[razorpay webhook] failed:", error?.error?.description || error.message);
    // Non-2xx makes Razorpay retry later.
    return res.status(500).json({ success: false });
  }
};

export const submitUpiPaymentProof = async (req, res) => {
  try {
    const {
      addressId,
      paymentMode = "online",
      checkoutItems,
      checkoutMode,
      buyNow,
      attemptedOrderId,
      couponCode,
      rewardPointsToUse,
      giftCardCode,
      customerLocation,
      preOrderSlot,
    } = req.body;
    const orderMessage = normalizeOrderMessage(req.body);
    const screenshot = typeof req.body.screenshot === "string"
      ? req.body.screenshot
      : (typeof req.body.screenshotUrl === "string" ? req.body.screenshotUrl : "");
    const screenshotName = normalizeText(req.body.screenshotName, 200);
    const upiTransactionRef = normalizeText(req.body.upiTransactionRef, 100);

    if (paymentMode !== "online") {
      return res.status(400).json({
        success: false,
        message: "Partial advance payment is no longer available. Pay the full amount online or choose pay on delivery.",
      });
    }

    if (!screenshot) {
      return res.status(400).json({
        success: false,
        message: "Payment screenshot is required",
      });
    }

    const resolvedScreenshot = await resolveImageForStorage(
      screenshot,
      UPLOAD_FOLDERS.PAYMENT_PROOFS
    );
    if (resolvedScreenshot.error) {
      return res.status(400).json({
        success: false,
        message: resolvedScreenshot.error,
      });
    }

    const result = await prepareOrderData(req.user._id, addressId, {
      checkoutItems,
      checkoutMode,
      buyNow,
      couponCode,
      rewardPointsToUse,
      giftCardCode,
      customerLocation,
      fulfillmentType: req.body.fulfillmentType,
      requireDarkStore: true,
    });
    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error,
        ...(result.code ? { code: result.code } : {}),
        ...(result.removedItems ? { removedItems: result.removedItems } : {}),
      });
    }

    const payableAmount = result.total;

    const order = await finalizeOrder({
      userId: req.user._id,
      orderItems: result.orderItems,
      deliveryAddress: result.deliveryAddress,
      subtotal: result.subtotal,
      couponCode: result.couponCode,
      couponDiscount: result.couponDiscount,
      rewardPointsUsed: result.rewardPointsUsed,
      rewardDiscount: result.rewardDiscount,
      rewardPointsEarned: result.rewardPointsEarned,
      giftCardCode: result.giftCardCode,
      giftCardDiscount: result.giftCardDiscount,
      deliveryCharges: result.deliveryCharges,
      heavyHandlingFee: result.heavyHandlingFee,
      bundleDiscount: result.bundleDiscount,
      loyaltyDiscount: result.loyaltyDiscount,
      dynamicDiscount: result.dynamicDiscount,
      freeAddon: result.freeAddon,
      dynamicPricingDetails: result.dynamicPricingDetails,
      gstAmount: result.gstAmount,
      total: result.total,
      cart: result.cart,
      checkoutMode: result.checkoutMode,
      paymentMethod: "online",
      paymentStatus: "pending_verification",
      status: "confirm",
      message: orderMessage,
      attemptedOrderId,
      preOrderSlot,
      fulfillmentType: result.fulfillmentType,
    });

    void notifyOrderCreated(order, {
      previousStatus: attemptedOrderId ? "attempted" : null,
    });

    const payment = await Payment.create({
      order: order._id,
      user: req.user._id,
      orderNumber: order.orderNumber,
      paymentMethod: "online",
      paymentType: "online",
      source: "upi_manual",
      amount: payableAmount,
      orderTotal: result.total,
      subtotal: result.subtotal,
      couponCode: result.couponCode,
      couponDiscount: result.couponDiscount,
      deliveryCharges: result.deliveryCharges,
      items: result.orderItems,
      deliveryAddress: result.deliveryAddress,
      screenshot: resolvedScreenshot.url,
      screenshotName,
      upiTransactionRef,
      customerMessage: orderMessage,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message:
        "Order confirmed. We will verify your UPI payment screenshot shortly.",
      data: {
        order,
        paymentId: payment._id,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit payment proof",
    });
  }
};

export const getPaymentUnreadCount = async (req, res) => {
  try {
    const { since } = req.query;
    const filter = { status: "pending" };

    if (since) {
      const sinceDate = new Date(since);
      if (Number.isNaN(sinceDate.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid since date" });
      }
      filter.createdAt = { $gt: sinceDate };
    }

    const count = await Payment.countDocuments(filter);

    return res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load unread payment count",
    });
  }
};

export const getAdminRazorpayTransactions = async (req, res) => {
  try {
    const { startDate, endDate, status, search } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query);
    const andClauses = [
      {
        $or: [
          { razorpayPaymentId: { $nin: ["", null] } },
          { codAdvanceRazorpayPaymentId: { $nin: ["", null] } },
        ],
      },
      {
        paymentStatus: { $in: RAZORPAY_SUCCESS_PAYMENT_STATUSES },
      },
    ];

    if (status && status !== "all") {
      andClauses.push({ status });
    }

    if (startDate || endDate) {
      const paidAtRange = {};
      if (startDate) {
        paidAtRange.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        paidAtRange.$lte = end;
      }

      andClauses.push({
        $or: [{ paidAt: paidAtRange }, { codAdvancePaidAt: paidAtRange }],
      });
    }

    const searchClause = await buildOrderSearchFilter(search);
    if (searchClause) {
      andClauses.push(searchClause);
    }

    const filter = { $and: andClauses };

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .populate("user", "name email phone")
        .sort({ paidAt: -1, codAdvancePaidAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const data = await Promise.all(
      orders.map(async (order) => {
        const razorpayTransactionAmount = await resolveOrderRazorpayAmount(order);

        return {
          ...order,
          razorpayTransactionId: getRazorpayPaymentId(order),
          razorpayTransactionAmount,
          razorpayPaidAmount: razorpayTransactionAmount || order.razorpayPaidAmount || 0,
          razorpayPaidAt: getRazorpayPaidAt(order),
        };
      })
    );

    res.status(200).json(buildPaginatedResponse(data, total, page, limit));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load Razorpay transactions",
    });
  }
};

export const getAdminPayments = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { status, orderIds } = req.query;
    const filter = {};

    if (status && ["pending", "verified", "rejected"].includes(status)) {
      filter.status = status;
    }

    if (orderIds) {
      const ids = String(orderIds)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        filter.order = { $in: ids };
      }
    }

    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "name email phone")
        .populate("order", "orderNumber status paymentStatus total")
        .lean(),
    ]);

    res.status(200).json(buildPaginatedResponse(payments, total, page, limit));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load payment records",
    });
  }
};

export const getAdminPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("order", "orderNumber status paymentStatus total paymentMethod")
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load payment record",
    });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const { status, rejectionReason = "" } = req.body;

    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be verified or rejected",
      });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This payment has already been reviewed",
      });
    }

    payment.status = status;
    payment.verifiedAt = new Date();
    payment.verifiedBy = req.user._id;

    if (status === "rejected") {
      payment.rejectionReason = normalizeText(rejectionReason, 300);
    } else {
      payment.rejectionReason = "";
    }

    await payment.save();

    const order = await Order.findById(payment.order);

    if (status === "verified") {
      if (payment.paymentType === "online") {
        await Order.findByIdAndUpdate(payment.order, {
          status: "confirm",
          paymentStatus: "paid",
          paidAt: new Date(),
        });
      } else {
        await Order.findByIdAndUpdate(payment.order, {
          status: "confirm",
          paymentStatus: "unpaid",
        });
      }

      if (order) {
        void notifyPaymentSuccess(order, { source: "upi_manual" });
        const confirmed = await Order.findById(payment.order);
        if (confirmed) {
          void dispatchDeliveryOrder(confirmed).catch((err) =>
            console.error("[paymentController] dispatch failed:", err)
          );
        }
      }
    } else {
      await Order.findByIdAndUpdate(payment.order, {
        status: "cancelled",
        paymentStatus: "unpaid",
      });

      if (order) {
        void notifyPaymentFailed(order, { source: "upi_manual", reason: "payment_rejected" });
      }
    }

    res.status(200).json({
      success: true,
      message:
        status === "verified"
          ? "Payment approved successfully"
          : "Payment proof rejected and order cancelled",
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update payment status",
    });
  }
};
