import mongoose from "mongoose";
import InventoryRequest from "../models/InventoryRequest.js";
import StoreInventory from "../models/StoreInventory.js";
import { productIdForSku, storeMaySellProduct } from "../services/catalogStoreInventory.js";
import DeliveryManager from "../models/DeliveryManager.js";
import Staff from "../../../staff-service/src/models/Staff.js";
import { Vendor } from "../../../farmer-manager-service/src/models.js";

const REVIEWER_ROLES = new Set([
  "vendor",
  "admin",
]);

const isReviewerRole = (role) => {
  if (!role) return false;
  return REVIEWER_ROLES.has(String(role).trim().toLowerCase());
};

const isVendorRole = (role) => String(role || "").trim().toLowerCase() === "vendor";

/** Returns null when the caller may see every store, otherwise the dark store ids the vendor supplies. */
const scopedManagerIds = async (req) => {
  if (!isVendorRole(req.user?.role)) return null;
  const vendorId = String(req.user?.vendorId || req.user?.id || "").trim();
  if (!vendorId) return [];

  const stores = await DeliveryManager.find({ vendorId }).select("_id").lean();
  const storeIds = stores.map((store) => store._id);

  // Also check approved DarkStoreRequest associated with this vendor
  try {
    const dsrList = await mongoose.connection.collection("darkstorerequests")
      .find({ vendorId, status: "Approved" })
      .project({ darkStoreId: 1 })
      .toArray();
    for (const d of dsrList) {
      if (d.darkStoreId && mongoose.isValidObjectId(d.darkStoreId)) {
        if (!storeIds.some((id) => String(id) === String(d.darkStoreId))) {
          storeIds.push(new mongoose.Types.ObjectId(d.darkStoreId));
        }
      }
    }
  } catch (err) {
    console.warn("[scopedManagerIds] DSR lookup warning:", err?.message);
  }

  return storeIds;
};

const makeRequestNumber = () =>
  `INV-${Date.now().toString().slice(-8)}-${Math.floor(100 + Math.random() * 900)}`;

const resolveManager = async (req) => {
  let manager = null;
  if (mongoose.isValidObjectId(req.user?.id)) {
    manager = await DeliveryManager.findById(req.user.id);
  }
  if (!manager && req.user?.email) {
    manager = await DeliveryManager.findOne({ email: req.user.email });
  }
  return manager;
};

export const createInventoryRequest = async (req, res, next) => {
  try {
    const manager = await resolveManager(req);
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Delivery manager not found",
      });
    }

    // Proactively resolve vendorId if missing on delivery manager
    let vendorId = String(manager.vendorId || "").trim();
    if (!vendorId) {
      try {
        const dsr = await mongoose.connection.collection("darkstorerequests").findOne({
          $or: [
            { darkStoreId: String(manager._id) },
            { email: manager.email },
            { phone: manager.phone },
          ],
        });
        if (dsr?.vendorId) {
          vendorId = String(dsr.vendorId).trim();
          manager.vendorId = vendorId;
          await manager.save();
        }
      } catch (err) {
        console.warn("[createInventoryRequest] vendorId resolution warning:", err?.message);
      }
    }

    const sku = String(req.body.sku || "").trim();
    const quantity = Number(req.body.quantity) || 0;
    const gradeAQuantity = Number(req.body.gradeAQuantity) || 0;
    const gradeBQuantity = Number(req.body.gradeBQuantity) || 0;
    const gradeCQuantity = Number(req.body.gradeCQuantity) || 0;
    const otherQuantity = Number(req.body.otherQuantity) || 0;
    
    const note = String(req.body.note || "").trim();
    const productName = String(req.body.productName || req.body.name || "").trim();
    const unit = String(req.body.unit || "pcs").trim() || "pcs";
    const category = String(req.body.category || "General").trim() || "General";

    if (!sku) {
      return res.status(400).json({
        success: false,
        message: "SKU is required",
      });
    }

    const totalQuantity = quantity || (gradeAQuantity + gradeBQuantity + gradeCQuantity + otherQuantity);

    if (totalQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Request quantity must be at least 1",
      });
    }

    let item = await StoreInventory.findOne({
      managerId: manager._id,
      sku,
    });
    const requestedProductId = item?.productId || (await productIdForSku(sku));
    const permission = await storeMaySellProduct(manager._id, requestedProductId);
    if (!permission.allowed) {
      return res.status(403).json({ success: false, message: permission.reason });
    }
    if (!item) {
      item = await StoreInventory.create({
        managerId: manager._id,
        productId: requestedProductId,
        sku,
        name: productName || sku,
        category,
        unit,
        stockCount: 0,
        isActive: true,
      });
    }

    const existingPending = await InventoryRequest.findOne({
      managerId: manager._id,
      sku,
      status: "pending",
    });
    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: `A pending request already exists for ${item.name} (${existingPending.requestNumber})`,
        request: existingPending.toSafeJSON(),
      });
    }

    const request = await InventoryRequest.create({
      requestNumber: makeRequestNumber(),
      managerId: manager._id,
      vendorId: vendorId || manager.vendorId || "",
      storeName: manager.storeName || `${manager.area} Store`,
      managerName: manager.name || "",
      city: manager.city || "",
      area: manager.area || "",
      sku: item.sku,
      productName: item.name,
      category: item.category || "General",
      unit: item.unit || "pcs",
      quantity: Math.floor(totalQuantity),
      gradeAQuantity: Math.floor(gradeAQuantity),
      gradeBQuantity: Math.floor(gradeBQuantity),
      gradeCQuantity: Math.floor(gradeCQuantity),
      otherQuantity: Math.floor(otherQuantity),
      currentStock: item.stockCount || 0,
      note,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: `Inventory request ${request.requestNumber} sent to Vendor for approval`,
      request: request.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const listMyInventoryRequests = async (req, res, next) => {
  try {
    const manager = await resolveManager(req);
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Delivery manager not found",
      });
    }

    const status = String(req.query.status || "").trim();
    const filter = { managerId: manager._id };
    if (["pending", "approved", "rejected", "inprocessed", "packed", "completed"].includes(status)) {
      filter.status = status;
    }

    const requests = await InventoryRequest.find(filter).sort({ createdAt: -1 });
    return res.json({
      success: true,
      count: requests.length,
      requests: requests.map((r) => r.toSafeJSON()),
    });
  } catch (error) {
    next(error);
  }
};

export const listAllInventoryRequests = async (req, res, next) => {
  try {
    const userRole = String(req.user?.role || "").trim().toLowerCase();

    // Product managers are explicitly restricted: dark store requests go to vendors only
    if (userRole === "product_manager") {
      return res.json({
        success: true,
        count: 0,
        requests: [],
        message: "Dark store inventory requests are routed to the assigned vendor only for approval.",
      });
    }

    if (!isReviewerRole(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned vendor (or admin) can review inventory requests",
      });
    }

    const status = String(req.query.status || "").trim();
    const filter = {};
    if (["pending", "approved", "rejected", "inprocessed", "packed", "completed"].includes(status)) {
      filter.status = status;
    }

    const managerIds = await scopedManagerIds(req);
    const rawTargetId = String(
      req.query.storeId || req.query.darkStoreId || req.query.managerId || ""
    ).trim();

    let targetStoreId = rawTargetId;
    if (rawTargetId && !mongoose.isValidObjectId(rawTargetId)) {
      try {
        const dsr = await mongoose.connection.collection("darkstorerequests").findOne({ id: rawTargetId });
        if (dsr?.darkStoreId && mongoose.isValidObjectId(dsr.darkStoreId)) {
          targetStoreId = String(dsr.darkStoreId);
        }
      } catch {
        // ignore
      }
    }

    if (isVendorRole(userRole)) {
      const vendorId = String(req.user?.vendorId || req.user?.id || "").trim();
      if (!vendorId && (!managerIds || managerIds.length === 0)) {
        return res.json({ success: true, count: 0, requests: [] });
      }

      if (targetStoreId && mongoose.isValidObjectId(targetStoreId)) {
        const inScope = (managerIds || []).some((id) => String(id) === targetStoreId);
        if (!inScope) {
          return res.json({ success: true, count: 0, requests: [] });
        }
        filter.managerId = targetStoreId;
      } else {
        filter.$or = [
          ...(vendorId ? [{ vendorId }] : []),
          ...((managerIds && managerIds.length > 0) ? [{ managerId: { $in: managerIds } }] : []),
        ];
      }
    } else if (targetStoreId && mongoose.isValidObjectId(targetStoreId)) {
      filter.managerId = targetStoreId;
    }

    const requests = await InventoryRequest.find(filter).sort({ createdAt: -1 });
    return res.json({
      success: true,
      count: requests.length,
      requests: requests.map((r) => r.toSafeJSON()),
    });
  } catch (error) {
    next(error);
  }
};

export const reviewInventoryRequest = async (req, res, next) => {
  try {
    const userRole = String(req.user?.role || "").trim().toLowerCase();

    // Prevent product managers from approving dark store requests
    if (userRole === "product_manager") {
      return res.status(403).json({
        success: false,
        message: "Dark store inventory requests must be approved by the assigned vendor, not product managers.",
      });
    }

    if (!isReviewerRole(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned vendor (or admin) can review inventory requests",
      });
    }

    const decision = String(req.body.decision || req.body.status || "")
      .trim()
      .toLowerCase();
    const reviewNote = String(req.body.note || req.body.reviewNote || "").trim();

    const allowedStatuses = ["pending", "approved", "rejected", "inprocessed", "packed", "completed"];
    if (!allowedStatuses.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status decision",
      });
    }

    const request = await InventoryRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Inventory request not found",
      });
    }

    // Verify that this dark store belongs to THIS vendor only
    if (isVendorRole(userRole)) {
      const vendorId = String(req.user?.vendorId || req.user?.id || "").trim();
      const managerIds = await scopedManagerIds(req);
      const isMine =
        (request.vendorId && String(request.vendorId) === vendorId) ||
        (managerIds && managerIds.some((id) => String(id) === String(request.managerId)));
      if (!isMine) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to approve this dark store's request. Only the assigned vendor may approve it.",
        });
      }
    }

    if (request.status === decision) {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status}`,
      });
    }

    let reviewerName = "Vendor";
    if (isVendorRole(userRole)) {
      const vendorId = String(req.user?.vendorId || req.user?.id || "").trim();
      try {
        const vendorDoc = await Vendor.findOne({ id: vendorId }).select("vendorName ownerName").lean();
        reviewerName = vendorDoc?.vendorName || vendorDoc?.ownerName || req.user?.name || "Vendor";
      } catch {
        reviewerName = req.user?.name || "Vendor";
      }
    } else if (userRole === "admin") {
      reviewerName = req.user?.name || req.user?.email || "Admin";
    }

    if (decision === "approved" && request.status !== "approved") {
      const existingRow = await StoreInventory.findOne({ managerId: request.managerId, sku: request.sku })
        .select("productId")
        .lean();
      const rowProductId = existingRow?.productId || (await productIdForSku(request.sku));
      const permission = await storeMaySellProduct(request.managerId, rowProductId);
      if (!permission.allowed) {
        return res.status(409).json({ success: false, message: `${permission.reason}. Reject this request instead.` });
      }

      const updated = await StoreInventory.findOneAndUpdate(
        { managerId: request.managerId, sku: request.sku },
        { $inc: { stockCount: request.quantity }, $set: { isActive: true, inactiveReason: "" } },
        { returnDocument: 'after' }
      );

      if (!updated) {
        await StoreInventory.create({
          managerId: request.managerId,
          productId: rowProductId,
          sku: request.sku,
          name: request.productName,
          category: request.category || "General",
          unit: request.unit || "pcs",
          stockCount: request.quantity,
          isActive: true,
        });
      }
    }

    request.status = decision;
    request.reviewedBy = req.user.id;
    request.reviewedByName = reviewerName;
    request.reviewNote = reviewNote;
    request.reviewedAt = new Date();
    await request.save();

    let successMessage = `Inventory request updated to ${decision}`;
    if (decision === "approved") {
      successMessage = `Approved by ${reviewerName} — ${request.quantity} ${request.unit} added to ${request.storeName}`;
    }

    return res.json({
      success: true,
      message: successMessage,
      request: request.toSafeJSON(),
    });
  } catch (error) {
    console.error("Error in reviewInventoryRequest:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};
