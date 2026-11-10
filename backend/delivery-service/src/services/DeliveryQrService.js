import { randomUUID } from "node:crypto";
import StoreOrder from "../models/StoreOrder.js";

export function doorstepAmount(order) {
  return Number(order.amountToCollect || order.partTotal || 0) ||
    (order.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
}

async function razorpayQr(path = "", method = "GET", body) {
  const { RAZORPAY_KEY_ID: key, RAZORPAY_KEY_SECRET: secret } = process.env;
  if (!key || !secret) throw new Error("Razorpay is not configured");
  const response = await fetch(`https://api.razorpay.com/v1/payments/qr_codes${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Razorpay QR API returned ${response.status}`);
  return response.json();
}

/**
 * What the rider app needs to show the QR: the raw UPI string to draw as a plain QR
 * (Razorpay's image_url is a branded poster page). Razorpay sends image_content only for
 * live keys; with test keys the QR can't be paid from a real UPI app, so say so.
 */
function qrDisplay(content, amountPaise) {
  const qrContent = String(content || "").trim();
  if (!qrContent.startsWith("upi://")) {
    return {
      amount: amountPaise / 100,
      qrContent: "",
      testMode: true,
      notice: "Razorpay is in test mode, so this QR can't be paid from a UPI app. Use live Razorpay keys.",
    };
  }
  return { amount: amountPaise / 100, qrContent };
}

export async function processDeliveryQr(order, action, allowedStatuses) {
  const eligible = {
    _id: order._id,
    assignedRiderId: order.assignedRiderId,
    status: { $in: allowedStatuses },
    customerOtpVerified: true,
    paymentStatus: { $nin: ["paid_online", "collected"] },
  };
  let qr = order.deliveryPaymentQr;
  if (qr?.token && !qr.id && qr.reservedAt < new Date(Date.now() - 120000)) {
    const cleared = await StoreOrder.updateOne({
      ...eligible,
      "deliveryPaymentQr.token": qr.token,
      "deliveryPaymentQr.id": null,
    }, { $unset: { deliveryPaymentQr: 1 } });
    if (!cleared.matchedCount) return { message: "Payment changed. Try again." };
    qr = null;
  }
  if (!qr?.token) {
    if (action !== "create") return { message: "Open the payment QR first." };
    const amount = Math.round(doorstepAmount(order) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) return { message: "No amount to collect for this order." };
    const token = randomUUID();
    const reserved = await StoreOrder.findOneAndUpdate({
      ...eligible,
      "deliveryPaymentQr.token": null,
      "onlinePaymentClaim.status": { $ne: "pending" },
    }, { $set: { deliveryPaymentQr: { token, amount, reservedAt: new Date() } } });
    if (!reserved) return { message: "Payment changed. Refresh the order and try again." };

    try {
      const created = await razorpayQr("", "POST", {
        type: "upi_qr",
        name: "GreenGrocc Delivery",
        usage: "single_use",
        fixed_amount: true,
        payment_amount: amount,
        close_by: Math.floor(Date.now() / 1000) + 900,
        notes: { store_order_id: String(order._id) },
      });
      qr = { token, amount, id: created.id, imageUrl: created.image_url, content: created.image_content || "" };
      if (!qr.id) throw new Error("Incomplete Razorpay QR response");
      const saved = await StoreOrder.updateOne(
        { ...eligible, "deliveryPaymentQr.token": token },
        { $set: { deliveryPaymentQr: qr } },
      );
      if (!saved.matchedCount) throw new Error("Order changed while creating QR");
      return qrDisplay(qr.content, amount);
    } catch (error) {
      // A QR whose details were never saved was never shown to the customer.
      await StoreOrder.updateOne(
        { _id: order._id, "deliveryPaymentQr.token": token, "deliveryPaymentQr.id": null },
        { $unset: { deliveryPaymentQr: 1 } },
      );
      throw error;
    }
  }

  if (!qr.id) return { message: "The QR is being created. Try again shortly." };
  const path = `/${encodeURIComponent(qr.id)}`;
  let remote = await razorpayQr(path);
  if (action === "close" && remote.status === "active") {
    try {
      remote = await razorpayQr(`${path}/close`, "POST");
    } catch (error) {
      remote = await razorpayQr(path);
      if (remote.status !== "closed") throw error;
    }
  }

  const { items = [] } = await razorpayQr(`${path}/payments`);
  const captured = items.find((payment) =>
    payment.status === "captured" && payment.currency === "INR" && payment.amount === qr.amount
  );
  const current = { ...eligible, "deliveryPaymentQr.id": qr.id };
  if (captured) {
    const saved = await StoreOrder.updateOne(current, {
      $set: {
        paymentMethod: "online",
        paymentStatus: "paid_online",
        amountCollected: qr.amount / 100,
        "deliveryPaymentQr.paymentId": captured.id,
      },
    });
    if (saved.matchedCount || await StoreOrder.exists({
      _id: order._id, "deliveryPaymentQr.paymentId": captured.id, paymentStatus: "paid_online",
    })) return { paymentStatus: "paid_online" };
    return { message: "Payment was received, but the order changed. Contact your Delivery Manager." };
  }

  if (remote.status === "closed" && remote.payments_count_received === 0 &&
      items.every((payment) => payment.status === "failed")) {
    const cleared = await StoreOrder.updateOne(current, { $unset: { deliveryPaymentQr: 1 } });
    if (!cleared.matchedCount) return { message: "Payment changed. Refresh the order and try again." };
    return { closed: true };
  }
  if (action === "create" && remote.status === "active") {
    return qrDisplay(qr.content || remote.image_content, qr.amount);
  }
  return { message: "Razorpay has not confirmed the payment yet. Check again before collecting cash." };
}
