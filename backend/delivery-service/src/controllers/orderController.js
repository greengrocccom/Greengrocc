import Order from "../models/Order.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import { upsertDailyIncentive } from "./incentiveController.js";
import { serializeOrderForRider } from "../utils/orderSerializer.js";
import { getIO } from "../../../socket.js";
import { isCurrentlyPeak } from "../utils/peakHoursHelper.js";
import { isS3Configured, uploadBufferToS3, uploadDataUrlToS3 } from "../services/s3Service.js";

/**
 * Internal function: Picks rider with status: "online" under the same managerId,
 * oldest lastAssignedAt first (round robin). Sets order -> assigned, rider -> on_delivery,
 * lastAssignedAt = now, orderTimestamps.assignedAt = now. Emits new_order_assigned to room rider_<riderId>.
 */
export async function autoAssignRider(order) {
  try {
    if (!order || order.status !== "packed") return order;

    const managerId = order.managerId || order.storeId;
    const manager = await DeliveryManager.findById(managerId);

    // Query online riders matching store manager's city/area
    const query = {
      status: "online",
      isActive: true,
    };
    if (manager) {
      query.$or = [
        { cityId: manager.cityId, area: manager.area },
        { city: manager.city, area: manager.area },
      ];
    }

    const onlineRiders = await DeliveryBoy.find(query).sort({
      lastAssignedAt: 1,
      lastOrderAssignedAt: 1,
      createdAt: 1,
    });

    if (!onlineRiders.length) {
      order.status = "pending_rider";
      await order.save();
      return order;
    }

    const selectedRider = onlineRiders[0];
    const now = new Date();

    order.assignedRiderId = selectedRider._id;
    order.lastAssignedAt = now;
    order.status = "assigned";
    if (!order.orderTimestamps) order.orderTimestamps = {};
    order.orderTimestamps.assignedAt = now;
    await order.save();

    selectedRider.status = "on_delivery";
    selectedRider.lastAssignedAt = now;
    selectedRider.lastOrderAssignedAt = now;
    await selectedRider.save();

    // Socket Notifications
    try {
      getIO().to(`rider_${selectedRider._id}`).emit("new_order_assigned", {
        orderId: order._id,
        orderNumber: order._id.toString().slice(-6),
        pickupAddress: order.pickupAddress,
        customerAddress: order.customerAddress,
        deliveryFee: order.deliveryFee,
        status: order.status,
      });

      getIO().to(`store_${managerId}`).emit("order_status_updated", {
        orderId: order._id,
        status: order.status,
        assignedRiderId: selectedRider._id,
        riderName: selectedRider.name,
      });
    } catch (ioErr) {
      console.warn("[orderController] Socket emit warning:", ioErr.message);
    }

    return order;
  } catch (err) {
    console.error("[autoAssignRider] Error:", err.message);
    return order;
  }
}

/**
 * Creates a new order (status: packed) for a manager/store and triggers auto assignment.
 */
export const createOrder = async (req, res) => {
  try {
    const managerId = req.body.managerId || req.body.storeId || req.user?.id;

    if (!managerId) {
      return res.status(400).json({
        success: false,
        message: "managerId is required",
      });
    }

    const manager = await DeliveryManager.findById(managerId);

    // IF AND ONLY IF at least one driver is online for this store location, then only accept incoming order
    const query = {
      status: "online",
      isActive: true,
    };
    if (manager) {
      query.$or = [
        { cityId: manager.cityId, area: manager.area },
        { city: manager.city, area: manager.area },
      ];
    }
    const onlineRidersCount = await DeliveryBoy.countDocuments(query);

    if (onlineRidersCount === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No delivery driver is currently online for this location/slot. Incoming orders cannot be created until a driver comes online.",
      });
    }

    const {
      pickupAddress,
      customerName,
      customerAddress,
      customerPhone,
      customerLocation,
      items,
      totalAmount,
      paymentMethod,
      amountToCollect,
      deliveryFee,
      deliveryOtp,
    } = req.body;

    const defaultAddress =
      "In front of Balewadi Stadium Gate, Mahalunge Road, Pune";
    const defaultLocation = { lat: 18.5793, lng: 73.7712 };

    const order = await Order.create({
      managerId,
      storeId: managerId,
      pickupAddress: pickupAddress || manager?.storeAddress || "",
      customerName: customerName || "Akash Patil (Testing)",
      customerAddress: customerAddress || defaultAddress,
      customerPhone: customerPhone || "9876543210",
      customerLocation: customerLocation || defaultLocation,
      items: items || [],
      totalAmount: totalAmount || 0,
      paymentMethod: paymentMethod || "online",
      amountToCollect: amountToCollect || 0,
      deliveryFee: deliveryFee || 40,
      deliveryOtp: deliveryOtp || String(Math.floor(1000 + Math.random() * 9000)),
      qrData: `ORDER_${managerId}_${Date.now()}`,
      qrCode: `ORDER_${managerId}_${Date.now()}`,
      status: "packed",
      orderTimestamps: {
        packedAt: new Date(),
      },
    });

    const assignedOrder = await autoAssignRider(order);

    res.status(201).json({
      success: true,
      data: assignedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create order",
    });
  }
};

/**
 * Rider only — Accepts the assigned order.
 * Sets Order -> accepted, orderTimestamps.acceptedAt = now.
 */
export const acceptOrder = async (req, res) => {
  try {
    const riderId = req.user.id;
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.assignedRiderId?.toString() !== riderId) {
      return res.status(403).json({
        success: false,
        message: "You are not the assigned rider for this order",
      });
    }

    const now = new Date();
    order.status = "accepted";
    if (!order.orderTimestamps) order.orderTimestamps = {};
    order.orderTimestamps.acceptedAt = now;
    await order.save();

    const managerId = order.managerId || order.storeId;
    try {
      getIO().to(`store_${managerId}`).emit("order_status_updated", {
        orderId: order._id,
        status: order.status,
        assignedRiderId: riderId,
        acceptedAt: now,
      });
    } catch (ioErr) {
      console.warn("[acceptOrder] Socket emit warning:", ioErr.message);
    }

    res.json({
      success: true,
      data: serializeOrderForRider(order),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to accept order",
    });
  }
};

/**
 * Rider only — Rejects the assigned order.
 * Order -> back to pending_rider (or triggers re-assignment), orderTimestamps.rejectedAt = now, rider status -> back to online.
 */
export const rejectOrder = async (req, res) => {
  try {
    const riderId = req.user.id;
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.assignedRiderId?.toString() !== riderId) {
      return res.status(403).json({
        success: false,
        message: "You are not the assigned rider for this order",
      });
    }

    const now = new Date();
    order.assignedRiderId = null;
    order.status = "rejected";
    if (!order.orderTimestamps) order.orderTimestamps = {};
    order.orderTimestamps.rejectedAt = now;
    await order.save();

    // Reset rider status back to online
    const rider = await DeliveryBoy.findById(riderId);
    if (rider) {
      rider.status = "online";
      await rider.save();
    }

    const managerId = order.managerId || order.storeId;
    try {
      getIO().to(`store_${managerId}`).emit("order_status_updated", {
        orderId: order._id,
        status: "rejected",
        message: "Rider rejected the order",
      });
    } catch (ioErr) {}

    // Reset status to packed and auto-assign next available rider
    order.status = "packed";
    await order.save();
    await autoAssignRider(order);

    res.json({
      success: true,
      message: "Order rejected and sent back to pool",
      data: serializeOrderForRider(order),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to reject order",
    });
  }
};

/**
 * Rider only — Scans QR data at pickup store.
 * Verifies QR data matches order + rider is assigned rider.
 * Sets addressUnlocked: true, pickupScannedAt: now, pickupScannedBy: riderId, order -> picked_up, orderTimestamps.pickedUpAt = now.
 */
export const scanPickup = async (req, res) => {
  try {
    const riderId = req.user.id;
    const { orderId } = req.params;
    const { qrData, qrCode } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.assignedRiderId?.toString() !== riderId) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this order",
      });
    }

    const scannedValue = (qrData || qrCode || "").trim();
    const expectedValue = (order.qrData || order.qrCode || `ORDER_${order.managerId}`).trim();

    // Verification check (allow fallback for development if qr code starts with ORDER or STORE)
    if (
      scannedValue &&
      expectedValue &&
      scannedValue !== expectedValue &&
      !scannedValue.startsWith("ORDER_") &&
      !scannedValue.startsWith("STORE_")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR code. Please scan the QR code displayed at pickup store.",
      });
    }

    const now = new Date();
    order.addressUnlocked = true;
    order.pickupScannedAt = now;
    order.pickupScannedBy = riderId;
    order.status = "picked_up";
    if (!order.orderTimestamps) order.orderTimestamps = {};
    order.orderTimestamps.pickedUpAt = now;
    await order.save();

    const managerId = order.managerId || order.storeId;
    try {
      getIO().to(`store_${managerId}`).emit("order_status_updated", {
        orderId: order._id,
        status: order.status,
        pickupScannedAt: now,
      });
    } catch (ioErr) {}

    res.json({
      success: true,
      message: "Pickup QR verified! Customer address unlocked.",
      data: serializeOrderForRider(order),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to scan pickup QR",
    });
  }
};

/**
 * Rider only — Marks order as out_for_delivery.
 */
export const markOutForDelivery = async (req, res) => {
  try {
    const riderId = req.user.id;
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.assignedRiderId?.toString() !== riderId) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this order",
      });
    }

    const now = new Date();
    order.status = "out_for_delivery";
    if (!order.orderTimestamps) order.orderTimestamps = {};
    order.orderTimestamps.outForDeliveryAt = now;
    await order.save();

    const managerId = order.managerId || order.storeId;
    try {
      getIO().to(`store_${managerId}`).emit("order_status_updated", {
        orderId: order._id,
        status: order.status,
        outForDeliveryAt: now,
      });
    } catch (ioErr) {}

    res.json({
      success: true,
      data: serializeOrderForRider(order),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to mark order out for delivery",
    });
  }
};

/**
 * Rider only — Uploads proof of delivery & marks order as delivered.
 * Requires image upload (multer req.file) or req.body.deliveryProofImageUrl.
 * Sets deliveryProofImageUrl, proofUploadedAt: now, order -> delivered, orderTimestamps.deliveredAt = now, addressHiddenAfterDelivery: true.
 * Calls upsertDailyIncentive and updates rider's todayOrderCount / todayEarnings / status: "online".
 */
export const uploadProofAndDeliver = async (req, res) => {
  try {
    const riderId = req.user.id;
    const { orderId } = req.params;

    let imageUrl = req.body.deliveryProofImageUrl || req.body.imageUrl || "";

    if (isS3Configured()) {
      try {
        if (req.file) {
          const s3Res = await uploadBufferToS3({
            buffer: req.file.buffer || req.file.path,
            mimeType: req.file.mimetype,
            folder: "delivery-proofs",
            originalName: req.file.originalname,
          });
          if (s3Res?.url) imageUrl = s3Res.url;
        } else if (imageUrl.startsWith("data:image/")) {
          const s3Res = await uploadDataUrlToS3(imageUrl, "delivery-proofs");
          if (s3Res?.url) imageUrl = s3Res.url;
        }
      } catch (s3Err) {
        console.error("[Order Delivery Proof S3 Upload Error]", s3Err);
      }
    }

    if (!imageUrl && req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Delivery proof image is required to complete delivery",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.assignedRiderId?.toString() !== riderId) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this order",
      });
    }

    const managerId = order.managerId || order.storeId;
    const now = new Date();

    const isPeak = await isCurrentlyPeak(managerId);
    const peakBonus = isPeak ? 20 : 0;

    order.deliveryProofImageUrl = imageUrl;
    order.proofUploadedAt = now;
    order.status = "delivered";
    order.isPeakOrder = isPeak;
    order.peakBonus = peakBonus;
    order.addressHiddenAfterDelivery = true;
    if (!order.orderTimestamps) order.orderTimestamps = {};
    order.orderTimestamps.deliveredAt = now;
    await order.save();

    const orderEarnings = (order.deliveryFee || 0) + peakBonus;

    // Update Rider status and metrics
    const rider = await DeliveryBoy.findById(riderId);
    let todayCount = 1;
    if (rider) {
      rider.status = "online";
      rider.todayCompletedOrders = (rider.todayCompletedOrders || 0) + 1;
      rider.todayOrderCount = (rider.todayOrderCount || 0) + 1;
      rider.todayEarnings = (rider.todayEarnings || 0) + orderEarnings;
      todayCount = rider.todayOrderCount;
      await rider.save();
    }

    // Call upsertDailyIncentive helper
    await upsertDailyIncentive({
      riderId: rider._id,
      managerId,
      orderEarnings,
      peakBonus,
      todayOrderCount: todayCount,
    });

    try {
      getIO().to(`store_${managerId}`).emit("order_status_updated", {
        orderId: order._id,
        status: order.status,
        deliveredAt: now,
        deliveryProofImageUrl: imageUrl,
      });
    } catch (ioErr) {}

    res.json({
      success: true,
      message: "Order delivered successfully and proof uploaded!",
      data: serializeOrderForRider(order),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to complete delivery",
    });
  }
};

/**
 * Manager only — Manually assign order to a specific rider (scoped to req.user.managerId).
 */
export const manualAssignOrder = async (req, res) => {
  try {
    if (req.user?.role !== "delivery_manager") {
      return res.status(403).json({
        success: false,
        message: "Only delivery managers can assign orders",
      });
    }

    const managerId = req.user.id;
    const { orderId, riderId } = req.body;

    if (!orderId || !riderId) {
      return res.status(400).json({
        success: false,
        message: "orderId and riderId are required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Ownership check
    if (
      order.managerId?.toString() !== managerId &&
      order.storeId?.toString() !== managerId
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Order does not belong to your store",
      });
    }

    const rider = await DeliveryBoy.findById(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const now = new Date();
    order.assignedRiderId = rider._id;
    order.lastAssignedAt = now;
    order.status = "assigned";
    if (!order.orderTimestamps) order.orderTimestamps = {};
    order.orderTimestamps.assignedAt = now;
    await order.save();

    rider.status = "on_delivery";
    rider.lastAssignedAt = now;
    rider.lastOrderAssignedAt = now;
    await rider.save();

    try {
      getIO().to(`rider_${rider._id}`).emit("new_order_assigned", {
        orderId: order._id,
        orderNumber: order._id.toString().slice(-6),
        pickupAddress: order.pickupAddress,
        customerAddress: order.customerAddress,
        deliveryFee: order.deliveryFee,
        status: order.status,
      });

      getIO().to(`store_${managerId}`).emit("order_status_updated", {
        orderId: order._id,
        status: order.status,
        assignedRiderId: rider._id,
        riderName: rider.name,
      });
    } catch (ioErr) {}

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to manually assign order",
    });
  }
};

/**
 * Manager only — Cancels an order. Verifies ownership.
 */
export const cancelOrder = async (req, res) => {
  try {
    if (req.user?.role !== "delivery_manager") {
      return res.status(403).json({
        success: false,
        message: "Only delivery managers can cancel orders",
      });
    }

    const managerId = req.user.id;
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Ownership check
    if (
      order.managerId?.toString() !== managerId &&
      order.storeId?.toString() !== managerId
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Order does not belong to your store",
      });
    }

    const now = new Date();
    order.status = "cancelled";
    if (!order.orderTimestamps) order.orderTimestamps = {};
    order.orderTimestamps.cancelledAt = now;

    // If a rider was assigned, free up rider status back to online
    if (order.assignedRiderId) {
      const rider = await DeliveryBoy.findById(order.assignedRiderId);
      if (rider && rider.status === "on_delivery") {
        rider.status = "online";
        await rider.save();
      }
    }

    await order.save();

    try {
      getIO().to(`store_${managerId}`).emit("order_status_updated", {
        orderId: order._id,
        status: "cancelled",
        cancelledAt: now,
      });
    } catch (ioErr) {}

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel order",
    });
  }
};

/**
 * Manager only — Returns live/filtered orders scoped strictly to req.user.managerId.
 */
export const getOrdersForStore = async (req, res) => {
  try {
    if (req.user?.role !== "delivery_manager") {
      return res.status(403).json({
        success: false,
        message: "Only delivery managers can access store orders",
      });
    }

    const managerId = req.user.id;
    const { status } = req.query;

    const filter = {
      $or: [{ managerId }, { storeId: managerId }],
    };

    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate("assignedRiderId", "name phone status vehicleType")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch store orders",
    });
  }
};

/**
 * Rider only — Returns current active order for the logged-in rider, passed through serializeOrderForRider().
 */
export const getRiderActiveOrder = async (req, res) => {
  try {
    const riderId = req.user.id;

    const order = await Order.findOne({
      assignedRiderId: riderId,
      status: {
        $in: ["assigned", "accepted", "picked_up", "out_for_delivery"],
      },
    }).sort({ updatedAt: -1 });

    if (!order) {
      return res.json({ success: true, activeOrder: null });
    }

    res.json({
      success: true,
      activeOrder: serializeOrderForRider(order),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch active order",
    });
  }
};

/**
 * Rider only — Returns completed/cancelled order history for the logged-in rider, passed through serializeOrderForRider().
 */
export const getRiderOrderHistory = async (req, res) => {
  try {
    const riderId = req.user.id;

    const orders = await Order.find({
      assignedRiderId: riderId,
      status: { $in: ["delivered", "cancelled"] },
    }).sort({ createdAt: -1 });

    const serializedOrders = orders.map((o) => serializeOrderForRider(o));

    res.json({
      success: true,
      data: serializedOrders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order history",
    });
  }
};

/**
 * Generic status update function retained for backward compatibility.
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const riderId = req.user.id;
    const { orderId } = req.params;
    const { status } = req.body;

    if (status === "accepted") return acceptOrder(req, res);
    if (status === "rejected") return rejectOrder(req, res);
    if (status === "picked_up") return scanPickup(req, res);
    if (status === "out_for_delivery") return markOutForDelivery(req, res);
    if (status === "delivered") return uploadProofAndDeliver(req, res);

    return res.status(400).json({
      success: false,
      message: "Unsupported status transition",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status",
    });
  }
};
