import crypto from "crypto";
import PickupVerificationToken from "../models/PickupVerificationToken.js";
import StoreOrder from "../models/StoreOrder.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { getIO } from "../../../socket.js";
import { PICKUP_TOKEN_TTL_MS } from "../config/orderAssignmentConfig.js";
import { isS3Configured, uploadDataUrlToS3 } from "./s3Service.js";

const PRE_ORDER_UNLOCK_MESSAGE = "Pre-order picked up. Customer address unlocked.";
const PRE_ORDER_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const STORE_SCREEN_TOKEN_TTL_MS = 10 * 60 * 1000;

function buildQrPayload(orderId, token) {
  return `PICKUP:${orderId}:${token}`;
}

function tokenTtl(order, issuedFor) {
  // Pre-order QR labels are printed in advance, so they need to outlive a normal pickup window.
  if (order.isPreOrder) return Math.max(PICKUP_TOKEN_TTL_MS, PRE_ORDER_TOKEN_TTL_MS);
  return issuedFor === "store" ? STORE_SCREEN_TOKEN_TTL_MS : PICKUP_TOKEN_TTL_MS;
}

/**
 * issuedFor "rider": shown in the rider app, redeemable only by the manager's scan.
 * issuedFor "store": shown on the manager screen / bag label, redeemable only by the rider's scan.
 */
export async function generateDriverPickupToken(order, { issuedFor = "rider" } = {}) {
  const existing = await PickupVerificationToken.findOne({
    orderId: order._id,
    driverId: order.assignedRiderId,
    issuedFor,
    used: false,
    verified: false,
    tokenExpiresAt: { $gt: new Date() },
  });

  if (existing) {
    return {
      token: existing.verificationToken,
      qrPayload: buildQrPayload(order._id.toString(), existing.verificationToken),
      expiresAt: existing.tokenExpiresAt,
    };
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + tokenTtl(order, issuedFor));

  await PickupVerificationToken.create({
    orderId: order._id,
    driverId: order.assignedRiderId,
    darkStoreId: order.managerId,
    verificationToken: token,
    tokenExpiresAt: expiresAt,
    issuedFor,
  });

  return {
    token,
    qrPayload: buildQrPayload(order._id.toString(), token),
    expiresAt,
  };
}

/** QR scanned — address stays locked until manager approves item proof photo. */
export async function verifyPickupScan({ darkStoreId, orderId, scannedPayload, verifiedBy, scannedBy = "manager" }) {
  const raw = String(scannedPayload || "").trim();
  let token = raw;
  if (raw.startsWith("PICKUP:")) {
    const parts = raw.split(":");
    token = parts[2] || "";
  }

  if (!token) {
    return { success: false, status: 400, message: "Invalid pickup QR code" };
  }

  const order = await StoreOrder.findOne({
    _id: orderId,
    managerId: darkStoreId,
  });

  if (!order) {
    return { success: false, status: 404, message: "Order not found for this dark store" };
  }

  if (!order.assignedRiderId) {
    return { success: false, status: 400, message: "No driver assigned to this order" };
  }

  if (order.pickupQrScanned || order.qrScannedAt) {
    if (order.isPreOrder && !order.customerAddressUnlocked && order.status === "assigned") {
      await unlockForDelivery(order, { message: PRE_ORDER_UNLOCK_MESSAGE });
    }
    return { success: true, order, alreadyScanned: true };
  }

  const { isPickupQrReady } = await import("./sameRouteAttachService.js");
  if (!isPickupQrReady(order)) {
    return {
      success: false,
      status: 409,
      message:
        "Pickup QR not unlocked yet — wait for the 5-minute same-route window to finish.",
    };
  }

  if (order.status !== "assigned") {
    return {
      success: false,
      status: 400,
      message: `Order must be assigned to a driver before pickup scan (current: ${order.status})`,
    };
  }

  const record = await PickupVerificationToken.findOne({
    orderId: order._id,
    verificationToken: token,
    darkStoreId,
    driverId: order.assignedRiderId,
  });

  if (!record) {
    return { success: false, status: 400, message: "Invalid or mismatched pickup verification token" };
  }

  // Each side must scan the other side's code, so a rider can't verify their own pickup.
  const expectedIssuer = scannedBy === "rider" ? "store" : "rider";
  if ((record.issuedFor || "rider") !== expectedIssuer) {
    return {
      success: false,
      status: 403,
      message:
        scannedBy === "rider"
          ? "Scan the pickup QR shown on the store's screen or bag label — not your own QR"
          : "Scan the QR shown in the rider's app",
    };
  }

  if (record.used || record.verified) {
    if (order.pickupQrScanned || order.qrScannedAt) {
      return { success: true, order, alreadyScanned: true };
    }
    return { success: false, status: 400, message: "Pickup token already used" };
  }

  if (new Date() > new Date(record.tokenExpiresAt)) {
    return { success: false, status: 400, message: "Pickup verification token expired" };
  }

  const driver = await DeliveryBoy.findOne({
    _id: order.assignedRiderId,
    managerId: darkStoreId,
  });

  if (!driver) {
    return { success: false, status: 403, message: "Driver does not belong to this dark store" };
  }

  const now = new Date();

  record.used = true;
  record.verified = true;
  record.verifiedAt = now;
  record.verifiedBy = verifiedBy;
  await record.save();

  order.pickupQrScanned = true;
  order.pickupQrScannedAt = now;
  order.qrScannedAt = now;
  order.assignmentStatus = "PICKUP_PENDING";
  // Close same-route wait once rider starts pickup
  order.routeBatchWindowEndsAt = undefined;
  await order.save();

  // Pre-orders: each order's QR scan reveals that customer's address — no photo / approval step.
  if (order.isPreOrder) {
    await unlockForDelivery(order, { verifiedBy, message: PRE_ORDER_UNLOCK_MESSAGE });
    return {
      success: true,
      order,
      unlocked: true,
      driver: { id: driver._id.toString(), name: driver.name || driver.phone },
    };
  }

  try {
    getIO()
      .to(`rider_${order.assignedRiderId}`)
      .emit("pickup_qr_scanned", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        scannedAt: now.toISOString(),
        message: "QR scanned. Take item photo and send to manager.",
      });
    getIO()
      .to(`store_${darkStoreId}`)
      .emit("pickup_qr_scanned", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        scannedAt: now.toISOString(),
        routeBatchWindowEndsAt: null,
      });
    getIO()
      .to(`store_${darkStoreId}`)
      .emit("order_batch_window_ended", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        reason: "pickup_qr_scanned",
      });
  } catch (err) {
    console.warn("[pickup] socket emit failed:", err.message);
  }

  return {
    success: true,
    order,
    driver: {
      id: driver._id.toString(),
      name: driver.name || driver.phone,
    },
  };
}

/** Driver uploads item proof photo after QR scan. */
export async function submitPickupProof({ orderId, driverId, imageBase64 }) {
  const imageData = String(imageBase64 || "").trim();
  if (!imageData) {
    return { success: false, status: 400, message: "Item proof image is required" };
  }

  const order = await StoreOrder.findById(orderId);
  if (!order) {
    return { success: false, status: 404, message: "Order not found" };
  }

  if (String(order.assignedRiderId) !== String(driverId)) {
    return { success: false, status: 403, message: "You are not assigned to this order" };
  }

  if (!order.pickupQrScanned && !order.qrScannedAt) {
    return { success: false, status: 400, message: "Scan pickup QR at the store first" };
  }

  if (order.customerAddressUnlocked) {
    return { success: false, status: 400, message: "Customer address is already unlocked" };
  }

  if (order.pickupProofStatus === "pending") {
    return { success: true, order, alreadySubmitted: true };
  }

  if (order.pickupProofStatus === "approved") {
    return { success: false, status: 400, message: "Item proof already approved" };
  }

  let imageUrl = imageData;
  if (imageData.startsWith("data:image/") && isS3Configured()) {
    try {
      const s3Res = await uploadDataUrlToS3(imageData, "pickup-proofs");
      if (s3Res?.url) imageUrl = s3Res.url;
    } catch (err) {
      console.warn("[pickup-proof] S3 upload failed, storing data URL:", err.message);
    }
  }

  const now = new Date();
  order.pickupProofImageUrl = imageUrl;
  order.pickupProofStatus = "pending";
  order.pickupProofSubmittedAt = now;
  await order.save();

  try {
    getIO()
      .to(`store_${order.managerId}`)
      .emit("pickup_proof_submitted", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        pickupProofImageUrl: imageUrl,
        pickupProofSubmittedAt: now,
      });
    getIO()
      .to(`rider_${order.assignedRiderId}`)
      .emit("pickup_proof_submitted", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        message: "Item photo sent. Waiting for manager approval.",
      });
  } catch (err) {
    console.warn("[pickup-proof] socket emit failed:", err.message);
  }

  return { success: true, order };
}

/** Manager approves item proof — unlocks customer address for driver. */
export async function approvePickupProof({ orderId, managerId }) {
  const order = await StoreOrder.findOne({ _id: orderId, managerId });
  if (!order) {
    return { success: false, status: 404, message: "Order not found for this store" };
  }

  if (order.customerAddressUnlocked) {
    return { success: true, order, alreadyApproved: true };
  }

  if (order.pickupProofStatus !== "pending") {
    return {
      success: false,
      status: 400,
      message: "No pending item proof to approve for this order",
    };
  }

  const now = new Date();
  order.pickupProofStatus = "approved";
  order.pickupProofApprovedAt = now;
  order.pickupProofApprovedBy = managerId;
  await unlockForDelivery(order, {
    verifiedBy: managerId,
    message: "Item proof approved. Customer address unlocked.",
  });

  return { success: true, order };
}

/** Marks the order picked up and reveals the customer address to the assigned rider. */
async function unlockForDelivery(order, { verifiedBy = null, message }) {
  const now = new Date();
  const managerId = order.managerId;
  order.pickupVerified = true;
  order.pickupVerifiedAt = now;
  order.pickupVerifiedBy = verifiedBy;
  order.customerAddressUnlocked = true;
  order.status = "out_for_delivery";
  order.assignmentStatus = "OUT_FOR_DELIVERY";

  const { refreshStoreOrderCustomerCoords } = await import("./customerLocationService.js");
  await refreshStoreOrderCustomerCoords(order);
  await order.save();

  import("./orderTrackingService.js")
    .then(({ recordDispatchEta }) => recordDispatchEta(order))
    .catch(() => {});

  try {
    const { syncCustomerOrderFromStore } = await import("./syncCustomerOrderFromStore.js");
    await syncCustomerOrderFromStore(order, "out_for_delivery");
  } catch (err) {
    console.warn("[pickup] customer order sync failed:", err.message);
  }

  import("./deliveryOtpSmsService.js")
    .then(({ sendDeliveryOtpSmsOnDispatch }) => sendDeliveryOtpSmsOnDispatch(order))
    .catch(() => {});
  import("./storeStockService.js")
    .then(({ shipOrderStockOnDispatch }) => shipOrderStockOnDispatch(order))
    .catch(() => {});

  try {
    getIO()
      .to(`rider_${order.assignedRiderId}`)
      .emit("customer_address_unlocked", {
        orderId: order._id.toString(),
        customerName: order.customerName,
        customerPhone: order.customerPhone || "",
        customerAddress: order.customerAddress,
        customerLat: order.customerLat,
        customerLng: order.customerLng,
      });
    getIO()
      .to(`rider_${order.assignedRiderId}`)
      .emit("pickup_verified", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        message,
      });
    getIO()
      .to(`store_${managerId}`)
      .emit("pickup_verified", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: "out_for_delivery",
        pickupVerifiedAt: now,
      });
    getIO()
      .to(`store_${managerId}`)
      .emit("order_out_for_delivery", {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      });
  } catch (err) {
    console.warn("[pickup] socket emit failed:", err.message);
  }
}

/** Driver scans the pickup QR shown on the manager incoming-order screen. */
export async function verifyPickupByDriverScan({ driverId, scannedPayload }) {
  const raw = String(scannedPayload || "").trim();
  if (!raw.startsWith("PICKUP:")) {
    return { success: false, status: 400, message: "Invalid pickup QR code" };
  }

  const parts = raw.split(":");
  const orderId = parts[1];
  if (!orderId) {
    return { success: false, status: 400, message: "Invalid pickup QR code" };
  }

  const order = await StoreOrder.findById(orderId);
  if (!order) {
    return { success: false, status: 404, message: "Order not found for this QR" };
  }

  if (String(order.assignedRiderId) !== String(driverId)) {
    return {
      success: false,
      status: 403,
      message: "This pickup QR is not for your assigned order",
    };
  }

  return verifyPickupScan({
    darkStoreId: order.managerId,
    orderId: order._id,
    scannedPayload: raw,
    verifiedBy: null,
    scannedBy: "rider",
  });
}
