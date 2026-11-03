import { getIO } from "../../../socket.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import StoreOrder from "../models/StoreOrder.js";
import PeakHoursConfig from "../models/PeakHoursConfig.js";
import { areaMatchForManager } from "../utils/storeResolver.js";
import { isCurrentlyPeak } from "../utils/peakHoursHelper.js";

const DOC_KEYS = ["aadhaar", "pan", "passport", "license", "rc", "insurance"];

const getManager = async (req) => {
  const manager = await DeliveryManager.findById(req.user.id);
  if (!manager) {
    const err = new Error("Delivery manager not found");
    err.statusCode = 404;
    throw err;
  }
  return manager;
};

/** POST /manager/rider/:riderId/document-status */
export const updateRiderDocumentStatus = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { riderId } = req.params;
    const documentType = String(req.body.documentType || "").trim();
    const verificationStatus = String(req.body.verificationStatus || "").trim();
    const remarks = String(req.body.remarks || "").trim();

    const allowedTypes = [...DOC_KEYS, "selfie"];
    if (!allowedTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: `documentType must be one of: ${allowedTypes.join(", ")}`,
      });
    }

    if (!["verified", "rejected", "pending"].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'verificationStatus must be "verified", "rejected", or "pending"',
      });
    }

    const rider = await DeliveryBoy.findOne({
      _id: riderId,
      $and: [areaMatchForManager(manager)],
    });
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    if (documentType === "selfie") {
      if (!rider.selfie) rider.selfie = {};
      rider.selfie.status = verificationStatus;
    } else {
      if (!rider.documents[documentType]) rider.documents[documentType] = {};
      rider.documents[documentType].status = verificationStatus;
    }

    await rider.save();

    const allVerified = DOC_KEYS.every((k) => rider.documents?.[k]?.status === "verified");
    if (allVerified && rider.selfie?.status === "verified") {
      rider.verificationStatus = "approved";
      rider.isActive = true;
      rider.verifiedAt = new Date();
      await rider.save();
      try {
        const { notifyVerificationCompleted } = await import(
          "../services/RiderNotificationService.js"
        );
        await notifyVerificationCompleted(rider._id);
      } catch (err) {
        console.warn("[liveOps] notifyVerificationCompleted error:", err.message);
      }
    }

    const storeId = manager._id.toString();
    try {
      const io = getIO();
      io.to(`store_${storeId}`).emit("rider_document_updated", {
        riderId: rider._id.toString(),
        documentType,
        verificationStatus: rider.verificationStatus || verificationStatus,
        updatedAt: new Date().toISOString(),
      });
      io.to(`rider_${rider._id}`).emit("document_review_update", {
        documentType,
        verificationStatus: rider.verificationStatus || verificationStatus,
        remarks,
      });
      io.to(`rider:${rider._id}`).emit("document_review_update", {
        documentType,
        verificationStatus: rider.verificationStatus || verificationStatus,
        remarks,
      });
    } catch (err) {
      console.warn("[socket] document emit failed:", err.message);
    }

    return res.json({
      success: true,
      riderId: rider._id.toString(),
      documentType,
      verificationStatus: rider.verificationStatus || verificationStatus,
      remarks,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /manager/order/assign — manual assign with live push to rider */
export const manualAssignOrder = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const orderId = String(req.body.orderId || "");
    const riderId = String(req.body.riderId || "");

    if (!orderId || !riderId) {
      return res.status(400).json({
        success: false,
        message: "orderId and riderId are required",
      });
    }

    const order = await StoreOrder.findOne({
      _id: orderId,
      managerId: manager._id,
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const rider = await DeliveryBoy.findOne({
      _id: riderId,
      $and: [areaMatchForManager(manager), { isActive: true }],
    });
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    order.assignedRiderId = rider._id;
    order.assignedAt = new Date();
    order.status = "assigned";
    await order.save();

    rider.status = "on_delivery";
    rider.lastStatusAt = new Date();
    await rider.save();

    const orderPayload = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      items: order.items,
      totalAmount: order.totalAmount,
      assignedAt: order.assignedAt,
      status: order.status,
    };

    try {
      const io = getIO();
      io.to(`rider_${rider._id}`).emit("new_order_assigned", orderPayload);
      io.to(`rider:${rider._id}`).emit("new_order_assigned", orderPayload);
      io.to(`rider_${rider._id}`).emit("active_delivery_updated", {
        reason: "order_assigned",
        orderId: order._id.toString(),
      });
      io.to(`rider:${rider._id}`).emit("active_delivery_updated", {
        reason: "order_assigned",
        orderId: order._id.toString(),
      });
    } catch (err) {
      console.warn("[socket] new_order_assigned emit failed:", err.message);
    }

    try {
      const { notifyOrdersAssigned } = await import(
        "../services/RiderNotificationService.js"
      );
      await notifyOrdersAssigned(rider._id, {
        orders: [order],
        storeName: manager.storeName || `${manager.area || "Store"} Dark Store`,
      });
    } catch (err) {
      console.warn("[liveOps] notifyOrdersAssigned error:", err.message);
    }

    return res.json({
      success: true,
      message: `Order assigned to ${rider.name || rider.phone}`,
      order: orderPayload,
      rider: {
        id: rider._id.toString(),
        name: rider.name,
        phone: rider.phone,
        status: rider.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** POST /manager/peak-hours */
export const setPeakHours = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const storeId = String(req.body.storeId || manager._id.toString());
    const peakHours = Array.isArray(req.body.peakHours) ? req.body.peakHours : [];

    if (storeId !== manager._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update peak hours for your store",
      });
    }

    const config = await PeakHoursConfig.findOneAndUpdate(
      { storeId },
      { $set: { peakHours } },
      { upsert: true, returnDocument: 'after' }
    );

    return res.json({
      success: true,
      storeId,
      peakHours: config.peakHours,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /peak-hours?storeId= */
export const getPeakHours = async (req, res, next) => {
  try {
    const storeId = String(req.query.storeId || "");
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId query param is required",
      });
    }

    const config = await PeakHoursConfig.findOne({ storeId });
    const isPeak = await isCurrentlyPeak(storeId);

    return res.json({
      success: true,
      storeId,
      peakHours: config?.peakHours || [],
      isPeak,
    });
  } catch (error) {
    next(error);
  }
};


