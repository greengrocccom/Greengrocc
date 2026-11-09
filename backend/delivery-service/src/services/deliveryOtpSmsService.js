import StoreOrder, { randomDeliveryOtp } from "../models/StoreOrder.js";
import { sendDeliveryVerificationOtp } from "@greengrocc/shared";

/** Customer's 10-digit phone: delivery address number first, then account phone, then the store copy. */
export async function resolveCustomerPhone(order) {
  let phone = "";
  if (order.sourceOrderId) {
    try {
      const { default: EcommerceOrder } = await import("../../../legacy/models/order/Order.js");
      const ecomOrder = await EcommerceOrder.findById(order.sourceOrderId).populate("user", "phone").lean();
      phone =
        ecomOrder?.deliveryAddress?.number ||
        ecomOrder?.deliveryAddress?.phone ||
        ecomOrder?.user?.phone ||
        "";
    } catch (err) {
      console.warn("[deliveryOtpSms] could not fetch customer phone from Order:", err.message);
    }
  }
  if (!phone) phone = order.customerPhone || "";
  return String(phone).replace(/\D/g, "").slice(-10);
}

/**
 * SMS the delivery verification OTP (MSG91_TEMPLATE_DELIVERY_VERIFY) to the customer.
 * The customer reads it out to the rider at the door to complete delivery.
 */
export async function sendDeliveryOtpSms(order) {
  if (order.customerOtpVerified) return { success: true, alreadyVerified: true };

  const customerPhone = await resolveCustomerPhone(order);
  if (!customerPhone) {
    return { success: false, status: 400, message: "Customer phone number not available for this order" };
  }

  const otpCode = String(order.otpCode || randomDeliveryOtp()).trim();
  const result = await sendDeliveryVerificationOtp(customerPhone, otpCode);

  await StoreOrder.updateOne(
    { _id: order._id },
    { $set: { otpCode, customerOtpSmsSentAt: new Date() } }
  );
  order.otpCode = otpCode;

  // The app/website shows Order.deliveryOtp — keep it the same code the SMS carried.
  if (order.sourceOrderId) {
    try {
      const { default: EcommerceOrder } = await import("../../../legacy/models/order/Order.js");
      await EcommerceOrder.updateOne(
        { _id: order.sourceOrderId },
        { $set: { deliveryOtp: otpCode, deliveryOtpSmsSentAt: new Date() } }
      );
    } catch (err) {
      console.warn("[deliveryOtpSms] could not sync OTP to customer order:", err.message);
    }
  }

  return { success: true, customerPhone, devMock: result.devMock };
}

/**
 * Fire-and-forget hook for status transitions into out_for_delivery; sends at most once per
 * order. A failed send releases the claim so the rider's or customer's resend can go out.
 */
export function sendDeliveryOtpSmsOnDispatch(order) {
  if (!order || order.customerOtpVerified || order.customerOtpSmsSentAt) return;
  const label = order.orderNumber || order._id;
  const releaseClaim = () =>
    StoreOrder.updateOne({ _id: order._id }, { $unset: { customerOtpSmsSentAt: 1 } }).catch(() => {});
  StoreOrder.updateOne(
    { _id: order._id, customerOtpSmsSentAt: { $exists: false } },
    { $set: { customerOtpSmsSentAt: new Date() } }
  )
    .then((claim) => (claim.modifiedCount ? sendDeliveryOtpSms(order) : null))
    .then(async (r) => {
      if (!r) return;
      if (r.success && !r.alreadyVerified) {
        console.log(`[deliveryOtpSms] OTP SMS sent for ${label} to ****${r.customerPhone.slice(-4)}`);
      } else if (!r.success) {
        await releaseClaim();
        console.warn(`[deliveryOtpSms] skipped for ${label}: ${r.message}`);
      }
    })
    .catch(async (err) => {
      await releaseClaim();
      console.warn(`[deliveryOtpSms] failed for ${label}:`, err.message);
    });
}
