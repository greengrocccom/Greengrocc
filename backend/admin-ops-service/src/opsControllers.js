import bcrypt from "bcrypt";
import crypto from "crypto";
import mongoose from "mongoose";
import Staff from "../../staff-service/src/models/Staff.js";
import CustomRole from "../../staff-service/src/models/CustomRole.js";
import { ROLE_LABELS, STAFF_ROLES } from "../../staff-service/src/constants/roles.js";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import DeliveryBoy from "../../delivery-service/src/models/DeliveryBoy.js";
import StoreOrder from "../../delivery-service/src/models/StoreOrder.js";
import SupportMessage, { SUPPORT_ROLE_KEYS } from "../../legacy/models/support/SupportMessage.js";
import {
  CollectionCentre,
  DarkStoreRequest,
  Farmer,
  FarmerCrop,
  FarmerDocument,
  FarmerManager,
  FarmerProduct,
  PickupDriver,
  Vendor,
  VendorDocument,
  VendorCrop,
  VendorCropRequest,
  VendorProduct,
  VendorProductRequest,
  VendorZone,
} from "../../farmer-manager-service/src/models.js";
import {
  catalogCropSummary,
  distinctCatalogCrops,
  serializeVendorCropRequest,
  vendorCropsWithCatalog,
} from "../../farmer-manager-service/src/vendorCropRequestControllers.js";
import { Crop as ErpCrop } from "../../erp-service/src/models/produce.js";
import { serializeDarkStoreRequest } from "../../farmer-manager-service/src/darkStoreRequestControllers.js";
import {
  catalogProductSummary,
  serializeVendorProductRequest,
  vendorProductsWithCatalog,
} from "../../farmer-manager-service/src/vendorProductRequestControllers.js";
import CatalogProduct from "../../legacy/models/Product.js";
import { createCentreForVendor, createManagerBusinessId } from "../../farmer-manager-service/src/pickupControllers.js";
import { seedManagerStore } from "../../delivery-service/src/services/seedManagerStore.js";
import { checkPhoneConflict } from "../../shared/utils/phoneCheck.js";
import { randomIdSuffix, serialId, timestampId } from "../../shared/ids.js";
import {
  sendCommonOtp,
  verifyOtp,
  markPhoneOtpVerified,
  consumeVerifiedPhone,
  isPhoneOtpVerified,
  MSG91_TEMPLATES,
} from "@greengrocc/shared";
import { applyStoreOrderStatus } from "../../delivery-service/src/services/storeOrderLifecycle.js";
import { FinanceLedger, HR_EMPLOYEE_TYPES, HrAttendance, HrEmployment, HrPayroll, HrTask, HrLeaveRequest, HrShift } from "./models.js";
import {
  VENDOR_HR_ROLE_KEYS,
  canManageHrEmployee,
  hrEmployeeFilter,
  hrOwnerId,
  isVendorScope,
  withHrScope,
} from "./hrScope.js";

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

function supportRoleLabel(value) {
  if (value === "admin") return "Admin";
  if (value === "customer") return "Users (Frontend)";
  return ROLE_LABELS[value] || String(value || "").replaceAll("_", " ");
}

function vendorQuery(id) {
  return mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
}

const VENDOR_DOCUMENT_TYPES = {
  aadhaar: "Owner Aadhaar Card",
  pan: "PAN Card",
  gst: "GST Certificate",
  shop_licence: "Shop / Trade Licence",
  bank: "Bank Passbook / Cancelled Cheque",
  owner_photo: "Owner Photo",
};
const MAX_DOCUMENT_DATA_URL_LENGTH = 7_000_000;

function validateVendorDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  return documents
    .filter((doc) => doc && doc.fileUrl)
    .map((doc) => {
      const type = String(doc.type || "").trim().toLowerCase();
      if (!VENDOR_DOCUMENT_TYPES[type]) throw Object.assign(new Error(`Unknown document type: ${type}`), { status: 400 });
      const fileUrl = String(doc.fileUrl);
      if (!/^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i.test(fileUrl)) {
        throw Object.assign(new Error(`${VENDOR_DOCUMENT_TYPES[type]} must be an image or PDF`), { status: 400 });
      }
      if (fileUrl.length > MAX_DOCUMENT_DATA_URL_LENGTH) {
        throw Object.assign(new Error(`${VENDOR_DOCUMENT_TYPES[type]} is too large (max 5 MB)`), { status: 400 });
      }
      return {
        type,
        fileUrl,
        name: VENDOR_DOCUMENT_TYPES[type],
        fileName: String(doc.fileName || `${type}`).slice(0, 200),
        mimeType: fileUrl.slice(5, fileUrl.indexOf(";")),
      };
    });
}

async function saveVendorDocuments(vendorId, documents, uploadedBy) {
  await Promise.all(
    documents.map((doc) =>
      VendorDocument.findOneAndUpdate(
        { vendorId, type: doc.type },
        {
          $set: { ...doc, uploadedAt: new Date(), uploadedBy, status: "Pending" },
          $setOnInsert: { id: `vdoc-${vendorId}-${doc.type}-${Date.now()}` },
        },
        { upsert: true, returnDocument: "after" }
      )
    )
  );
}

function darkStoreSummary(store) {
  return {
    id: String(store._id),
    storeName: store.storeName || `${store.area || ""} Store`.trim(),
    managerName: store.name || "",
    phone: store.phone || "",
    area: store.area || "",
    city: store.city || "",
    state: store.state || "",
    isActive: store.isActive !== false,
  };
}

function documentSummary(doc) {
  return {
    id: doc.id,
    type: doc.type,
    name: doc.name,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    status: doc.status,
    uploadedAt: doc.uploadedAt,
  };
}

export async function listVendorsAdmin(req, res, next) {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const [vendors, centres, documents, darkStores, vendorProductCounts, pendingRequestCounts] = await Promise.all([
      Vendor.find(filter).sort({ createdAt: -1 }).lean(),
      CollectionCentre.find().sort({ createdAt: 1 }).lean(),
      VendorDocument.find().select("-fileUrl").lean(),
      DeliveryManager.find({ vendorId: { $nin: ["", null] } })
        .select("storeName name phone area city state isActive vendorId")
        .sort({ storeName: 1 })
        .lean(),
      VendorProduct.aggregate([{ $group: { _id: "$vendorId", count: { $sum: 1 } } }]),
      VendorProductRequest.aggregate([
        { $match: { status: "Pending" } },
        { $group: { _id: "$vendorId", count: { $sum: 1 } } },
      ]),
    ]);
    const darkStoresByVendor = new Map();
    darkStores.forEach((store) => {
      const key = String(store.vendorId);
      if (!darkStoresByVendor.has(key)) darkStoresByVendor.set(key, []);
      darkStoresByVendor.get(key).push(darkStoreSummary(store));
    });
    const centreByVendor = new Map();
    centres.forEach((centre) => {
      const key = String(centre.vendorId || "");
      if (!centreByVendor.has(key)) centreByVendor.set(key, centre);
    });
    const documentsByVendor = new Map();
    documents.forEach((doc) => {
      const key = String(doc.vendorId || "");
      if (!documentsByVendor.has(key)) documentsByVendor.set(key, []);
      documentsByVendor.get(key).push(documentSummary(doc));
    });
    const vpMap = new Map(vendorProductCounts.map((v) => [String(v._id), v.count]));
    const prMap = new Map(pendingRequestCounts.map((v) => [String(v._id), v.count]));

    const data = vendors.map(({ password: _pw, ...vendor }) => ({
      ...vendor,
      collectionCentre: centreByVendor.get(String(vendor.id)) || null,
      documents: documentsByVendor.get(String(vendor.id)) || [],
      darkStores: darkStoresByVendor.get(String(vendor.id)) || [],
      productCount: vpMap.get(String(vendor.id)) || 0,
      pendingRequestsCount: prMap.get(String(vendor.id)) || 0,
    }));
    return ok(res, data, {
      stats: {
        total: data.length,
        active: data.filter((v) => v.status === "Active").length,
        pending: data.filter((v) => v.status === "Pending").length,
        inactive: data.filter((v) => v.status === "Inactive" || v.status === "Suspended").length,
      },
    });
  } catch (error) {
    next(error);
  }
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function centreNamesFor(vendorIds) {
  const ids = [...new Set(vendorIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const [vendors, centres] = await Promise.all([
    Vendor.find({ id: { $in: ids } }).select("id vendorName businessName ownerName").lean(),
    CollectionCentre.find({ vendorId: { $in: ids } }).select("id vendorId name").sort({ createdAt: 1 }).lean(),
  ]);
  const centreByVendor = new Map();
  centres.forEach((c) => {
    if (!centreByVendor.has(String(c.vendorId))) centreByVendor.set(String(c.vendorId), c);
  });
  return new Map(
    vendors.map((v) => [
      String(v.id),
      {
        vendorName: v.vendorName || v.businessName || v.ownerName || v.id,
        centreId: centreByVendor.get(String(v.id))?.id || "",
      },
    ])
  );
}

export async function listCentreFarmersAdmin(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter = { isDeleted: { $ne: true } };
    if (req.query.vendorId) filter.vendorId = String(req.query.vendorId);
    if (req.query.managerId) filter.managerId = String(req.query.managerId);
    if (req.query.status && req.query.status !== "all") {
      filter.status = new RegExp(`^${escapeRegex(req.query.status)}$`, "i");
    }
    const q = String(req.query.q || "").trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { name: rx },
        { mobile: rx },
        { farmerId: rx },
        { id: rx },
        { "address.village": rx },
        { "address.taluka": rx },
        { "address.district": rx },
      ];
    }
    const [items, total, perCentre] = await Promise.all([
      Farmer.find(filter)
        .select("id farmerId name mobile address status vendorId managerId createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Farmer.countDocuments(filter),
      Farmer.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: "$vendorId", count: { $sum: 1 } } }]),
    ]);
    const managerIds = [...new Set(items.map((f) => f.managerId).filter(Boolean))];
    const [centreNames, managers] = await Promise.all([
      centreNamesFor(items.map((f) => f.vendorId)),
      managerIds.length ? FarmerManager.find({ id: { $in: managerIds } }).select("id name mobile").lean() : [],
    ]);
    const managerById = new Map(managers.map((m) => [m.id, m]));
    const data = items.map((f) => ({
      id: f.farmerId || f.id,
      name: f.name,
      mobile: f.mobile,
      village: f.address?.village || "",
      taluka: f.address?.taluka || "",
      district: f.address?.district || "",
      status: f.status,
      vendorId: f.vendorId || "",
      vendorName: centreNames.get(String(f.vendorId))?.vendorName || "",
      centreId: centreNames.get(String(f.vendorId))?.centreId || "",
      managerId: f.managerId || "",
      managerName: managerById.get(f.managerId)?.name || "",
      createdAt: f.createdAt,
    }));
    return ok(res, data, {
      total,
      page,
      limit,
      perCentre: Object.fromEntries(perCentre.map((row) => [row._id || "", row.count])),
    });
  } catch (error) {
    next(error);
  }
}

export async function assignCentreFarmerAdmin(req, res, next) {
  try {
    const { farmerId } = req.params;
    const { vendorId, managerId } = req.body || {};

    const farmer = await Farmer.findOne({
      $or: [
        { farmerId: farmerId },
        { id: farmerId },
        ...(mongoose.isValidObjectId(farmerId) ? [{ _id: farmerId }] : []),
      ],
      isDeleted: { $ne: true },
    });

    if (!farmer) {
      return fail(res, 404, "Farmer not found");
    }

    // 1st Priority: Assign Vendor / Collection Centre
    if (vendorId !== undefined) {
      const vId = String(vendorId || "").trim();
      if (vId) {
        const vendor = await Vendor.findOne(vendorQuery(vId));
        if (!vendor) {
          return fail(res, 404, "Collection Centre / Vendor not found");
        }
        farmer.vendorId = vendor.id || vId;
      } else {
        farmer.vendorId = "";
      }
    }

    // 2nd Priority: Assign Farmer Manager under the selected Vendor
    if (managerId !== undefined) {
      const mId = String(managerId || "").trim();
      if (mId) {
        if (!farmer.vendorId) {
          return fail(res, 400, "Please assign a Collection Centre / Vendor first before assigning a Farmer Manager");
        }
        const manager = await FarmerManager.findOne({ id: mId });
        if (!manager) {
          return fail(res, 404, "Farmer Manager not found");
        }
        if (manager.vendorId && String(manager.vendorId) !== String(farmer.vendorId)) {
          return fail(
            res,
            400,
            `Manager "${manager.name}" belongs to vendor "${manager.vendorId}", but farmer is assigned to "${farmer.vendorId}". Farmer manager must belong to the assigned Collection Centre.`
          );
        }
        farmer.managerId = mId;
      } else {
        farmer.managerId = "";
      }
    } else if (vendorId !== undefined && farmer.managerId) {
      // If vendor was updated and no managerId was explicitly passed, verify existing manager
      const existingManager = await FarmerManager.findOne({ id: farmer.managerId });
      if (existingManager && existingManager.vendorId && String(existingManager.vendorId) !== String(farmer.vendorId)) {
        farmer.managerId = "";
      }
    }

    await farmer.save();

    const ownerKeys = [farmer.id, farmer.farmerId, farmer.farmerCode].filter(Boolean);
    await Promise.all([
      FarmerDocument.updateMany(
        { farmerId: { $in: ownerKeys } },
        { $set: { vendorId: farmer.vendorId || "", managerId: farmer.managerId || "" } }
      ).catch(() => {}),
      FarmerProduct.updateMany(
        { farmerId: { $in: ownerKeys } },
        { $set: { vendorId: farmer.vendorId || "", managerId: farmer.managerId || "" } }
      ).catch(() => {}),
    ]);

    const [centreNames, manager] = await Promise.all([
      farmer.vendorId ? centreNamesFor([farmer.vendorId]) : new Map(),
      farmer.managerId ? FarmerManager.findOne({ id: farmer.managerId }).select("id name mobile").lean() : null,
    ]);

    const centre = centreNames.get(String(farmer.vendorId));

    return ok(
      res,
      {
        id: farmer.farmerId || farmer.id,
        farmerId: farmer.farmerId || farmer.id,
        name: farmer.name,
        mobile: farmer.mobile,
        village: farmer.address?.village || "",
        taluka: farmer.address?.taluka || "",
        district: farmer.address?.district || "",
        status: farmer.status,
        vendorId: farmer.vendorId || "",
        vendorName: centre?.vendorName || "",
        centreId: centre?.centreId || "",
        managerId: farmer.managerId || "",
        managerName: manager?.name || "",
        managerMobile: manager?.mobile || "",
      },
      { message: "Farmer assignment updated successfully" }
    );
  } catch (error) {
    next(error);
  }
}

export async function listCentreFarmerManagersAdmin(req, res, next) {
  try {
    const filter = {};
    if (req.query.vendorId) filter.vendorId = String(req.query.vendorId);
    if (req.query.status && req.query.status !== "all") filter.status = String(req.query.status);
    const q = String(req.query.q || "").trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { mobile: rx }, { email: rx }, { id: rx }, { managerCode: rx }, { city: rx }];
    }
    const managers = await FarmerManager.find(filter).select("-password").sort({ createdAt: -1 }).lean();
    const ids = managers.map((m) => m.id);
    const [farmerCounts, centreNames, perCentre] = await Promise.all([
      ids.length
        ? Farmer.aggregate([
            { $match: { managerId: { $in: ids }, isDeleted: { $ne: true } } },
            { $group: { _id: "$managerId", count: { $sum: 1 } } },
          ])
        : [],
      centreNamesFor(managers.map((m) => m.vendorId)),
      FarmerManager.aggregate([{ $group: { _id: "$vendorId", count: { $sum: 1 } } }]),
    ]);
    const countByManager = new Map(farmerCounts.map((row) => [row._id, row.count]));
    const data = managers.map((m) => ({
      id: m.id,
      managerCode: m.managerCode || "",
      name: m.name,
      mobile: m.mobile,
      email: m.email || "",
      location: m.location || [m.city, m.state].filter(Boolean).join(", "),
      status: m.status,
      joiningDate: m.joiningDate || "",
      vendorId: m.vendorId || "",
      vendorName: centreNames.get(String(m.vendorId))?.vendorName || "",
      centreId: m.collectionCentreId || centreNames.get(String(m.vendorId))?.centreId || "",
      farmerCount: countByManager.get(m.id) || 0,
      createdAt: m.createdAt,
    }));
    return ok(res, data, {
      total: data.length,
      perCentre: Object.fromEntries(perCentre.map((row) => [row._id || "", row.count])),
    });
  } catch (error) {
    next(error);
  }
}

export async function assignCentreFarmerManagerAdmin(req, res, next) {
  try {
    const { managerId } = req.params;
    const { vendorId } = req.body || {};

    const manager = await FarmerManager.findOne({
      $or: [
        { id: managerId },
        { managerCode: managerId },
        ...(mongoose.isValidObjectId(managerId) ? [{ _id: managerId }] : []),
      ],
    });

    if (!manager) {
      return fail(res, 404, "Farmer Manager not found");
    }

    const vId = String(vendorId || "").trim();
    if (vId) {
      const vendor = await Vendor.findOne(vendorQuery(vId));
      if (!vendor) {
        return fail(res, 404, "Collection Centre / Vendor not found");
      }
      manager.vendorId = vendor.id || vId;
      const centre = await CollectionCentre.findOne({ vendorId: manager.vendorId }).select("id").lean();
      if (centre) {
        manager.collectionCentreId = centre.id;
      }
    } else {
      manager.vendorId = "";
      manager.collectionCentreId = "";
    }

    await manager.save();

    const [farmerCount, centreNames] = await Promise.all([
      Farmer.countDocuments({ managerId: manager.id, isDeleted: { $ne: true } }),
      manager.vendorId ? centreNamesFor([manager.vendorId]) : new Map(),
    ]);

    const centre = centreNames.get(String(manager.vendorId));

    const updatedData = {
      id: manager.id,
      managerCode: manager.managerCode || "",
      name: manager.name,
      mobile: manager.mobile,
      email: manager.email || "",
      location: manager.location || [manager.city, manager.state].filter(Boolean).join(", "),
      status: manager.status,
      joiningDate: manager.joiningDate || "",
      vendorId: manager.vendorId || "",
      vendorName: centre?.vendorName || "",
      centreId: manager.collectionCentreId || centre?.centreId || "",
      farmerCount,
      createdAt: manager.createdAt,
    };

    return ok(res, updatedData, { message: "Collection centre assigned to manager successfully" });
  } catch (error) {
    next(error);
  }
}

const CATALOG_DUMMY_FARMER_IDS = ["", "farmer-master-catalog"];

function farmerIdentityKeys(farmer, extraId) {
  return [...new Set([farmer?.id, farmer?.farmerId, farmer?.farmerCode, extraId].filter(Boolean))];
}

function catalogCropKey(crop) {
  return `${String(crop.cropName || "").trim().toLowerCase()}:::${String(crop.variety || "").trim().toLowerCase()}`;
}

export async function listCropCatalogAdmin(req, res, next) {
  try {
    const match = {};
    if (req.query.category && req.query.category !== "all") {
      match.category = new RegExp(`^${escapeRegex(String(req.query.category))}$`, "i");
    }
    const q = String(req.query.q || "").trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      match.$or = [{ cropName: rx }, { variety: rx }, { cropId: rx }, { cropCode: rx }];
    }
    const [crops, categories] = await Promise.all([
      distinctCatalogCrops(match),
      ErpCrop.distinct("category", { isDeleted: { $ne: true } }),
    ]);
    const names = [...new Set(crops.map((c) => c.cropName).filter(Boolean))];
    const planted = names.length
      ? await FarmerCrop.find({
          cropName: { $in: names },
          farmerId: { $nin: CATALOG_DUMMY_FARMER_IDS },
        })
          .select("cropName variety farmerId")
          .lean()
      : [];
    const plantedByKey = new Map();
    planted.forEach((row) => {
      const key = catalogCropKey(row);
      if (!plantedByKey.has(key)) plantedByKey.set(key, new Set());
      plantedByKey.get(key).add(row.farmerId);
    });
    const data = crops.map((crop) => ({
      ...crop,
      farmerCropCount: plantedByKey.get(catalogCropKey(crop))?.size || 0,
    }));
    return ok(res, data, { total: data.length, categories: categories.filter(Boolean).sort() });
  } catch (error) {
    next(error);
  }
}

export async function deleteCropCatalogAdmin(req, res, next) {
  try {
    const crop = await ErpCrop.findOne({ cropId: req.params.cropId, isDeleted: { $ne: true } });
    if (!crop) return fail(res, 404, "Crop not found in catalog");
    const nameRx = new RegExp(`^${escapeRegex(String(crop.cropName || "").trim())}$`, "i");
    const varRx = new RegExp(`^${escapeRegex(String(crop.variety || "").trim())}$`, "i");
    await ErpCrop.updateMany(
      { cropName: nameRx, variety: varRx, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: String(req.user?.id || req.user?._id || "admin"),
          status: "CLOSED",
        },
      }
    );
    return ok(res, { cropId: crop.cropId }, { message: "Crop removed from catalog" });
  } catch (error) {
    next(error);
  }
}

function serializeAdminFarmerCrop(crop) {
  return {
    id: crop.id,
    cropId: crop.cropId,
    cropName: crop.cropName || "",
    variety: crop.variety || "",
    category: crop.category || "",
    area: crop.area || 0,
    areaUnit: crop.areaUnit || "Acre",
    sowingDate: crop.sowingDate || "",
    expectedHarvestDate: crop.expectedHarvestDate || "",
    estimatedQuantity: crop.estimatedQuantity || 0,
    unit: crop.unit || "Kg",
    status: crop.status || "",
    createdAt: crop.createdAt,
  };
}

export async function listFarmerCropsAdmin(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const q = String(req.query.q || "").trim();
    const vendorId = String(req.query.vendorId || "").trim();
    const onlyWithCrops = String(req.query.withCrops || "1") !== "0";

    const farmerFilter = { isDeleted: { $ne: true } };
    if (vendorId) farmerFilter.vendorId = vendorId;

    const [farmers, cropRows] = await Promise.all([
      Farmer.find(farmerFilter)
        .select("id farmerId farmerCode name mobile address status vendorId createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      FarmerCrop.find({ farmerId: { $nin: CATALOG_DUMMY_FARMER_IDS } })
        .select(
          "id cropId farmerId cropName variety category area areaUnit sowingDate expectedHarvestDate estimatedQuantity unit status createdAt"
        )
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const farmerByIdentity = new Map();
    farmers.forEach((farmer) => {
      farmerIdentityKeys(farmer).forEach((id) => farmerByIdentity.set(id, farmer));
    });

    const cropsByFarmerDocId = new Map();
    const unmatched = [];
    cropRows.forEach((crop) => {
      const farmer = farmerByIdentity.get(crop.farmerId);
      if (!farmer) {
        unmatched.push(crop);
        return;
      }
      const key = farmer.id;
      if (!cropsByFarmerDocId.has(key)) cropsByFarmerDocId.set(key, []);
      cropsByFarmerDocId.get(key).push(crop);
    });

    const centreNames = await centreNamesFor(farmers.map((f) => f.vendorId));

    let rows = farmers.map((farmer) => {
      const crops = (cropsByFarmerDocId.get(farmer.id) || []).map(serializeAdminFarmerCrop);
      return {
        id: farmer.farmerId || farmer.id,
        farmerId: farmer.farmerId || farmer.id,
        name: farmer.name,
        mobile: farmer.mobile,
        village: farmer.address?.village || "",
        taluka: farmer.address?.taluka || "",
        district: farmer.address?.district || "",
        status: farmer.status,
        vendorId: farmer.vendorId || "",
        vendorName: centreNames.get(String(farmer.vendorId))?.vendorName || "",
        cropCount: crops.length,
        crops,
      };
    });

    if (unmatched.length && !vendorId) {
      const byUnknown = new Map();
      unmatched.forEach((crop) => {
        const key = crop.farmerId || "unknown";
        if (!byUnknown.has(key)) byUnknown.set(key, []);
        byUnknown.get(key).push(crop);
      });
      for (const [farmerId, crops] of byUnknown) {
        rows.push({
          id: farmerId,
          farmerId,
          name: "Unknown farmer",
          mobile: "",
          village: "",
          taluka: "",
          district: "",
          status: "",
          vendorId: "",
          vendorName: "",
          cropCount: crops.length,
          crops: crops.map(serializeAdminFarmerCrop),
        });
      }
    }

    if (onlyWithCrops) rows = rows.filter((row) => row.cropCount > 0);

    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((row) => {
        const farmerHit = [row.name, row.farmerId, row.mobile, row.village, row.district, row.vendorName].some((value) =>
          String(value || "").toLowerCase().includes(needle)
        );
        const cropHit = row.crops.some((crop) =>
          `${crop.cropName} ${crop.variety} ${crop.cropId}`.toLowerCase().includes(needle)
        );
        return farmerHit || cropHit;
      });
    }

    rows.sort((a, b) => b.cropCount - a.cropCount || String(a.name || "").localeCompare(String(b.name || "")));
    const total = rows.length;
    const totalCrops = rows.reduce((sum, row) => sum + row.cropCount, 0);
    const perCentre = {};
    rows.forEach((row) => {
      if (!row.vendorId) return;
      perCentre[row.vendorId] = (perCentre[row.vendorId] || 0) + 1;
    });
    const data = rows.slice((page - 1) * limit, page * limit);
    return ok(res, data, { total, page, limit, totalCrops, farmerCount: total, perCentre });
  } catch (error) {
    next(error);
  }
}

const lowerStatusGroup = (field) => ({
  $group: { _id: { vendorId: "$vendorId", status: { $toLower: { $ifNull: [`$${field}`, ""] } } }, count: { $sum: 1 } },
});

export async function getCollectionDashboardAdmin(req, res, next) {
  try {
    const [
      vendors,
      centres,
      farmerRows,
      unassignedFarmers,
      managerRows,
      darkStores,
      requestRows,
      recentRequests,
      docRows,
      productRequestRows,
      vendorProductRows,
      cropRequestRows,
      vendorCropRows,
    ] = await Promise.all([
        Vendor.find().select("id vendorName businessName ownerName mobile city state status createdAt").sort({ createdAt: -1 }).lean(),
        CollectionCentre.find().select("id vendorId name city status").sort({ createdAt: 1 }).lean(),
        Farmer.aggregate([{ $match: { isDeleted: { $ne: true } } }, lowerStatusGroup("status")]),
        Farmer.countDocuments({ isDeleted: { $ne: true }, managerId: { $in: ["", null] } }),
        FarmerManager.aggregate([lowerStatusGroup("status")]),
        DeliveryManager.find().select("storeName area city isActive vendorId").lean(),
        DarkStoreRequest.aggregate([{ $group: { _id: { vendorId: "$vendorId", status: "$status" }, count: { $sum: 1 } } }]),
        DarkStoreRequest.find({ status: "Pending" }).select("-passwordHash").sort({ createdAt: -1 }).limit(5).lean(),
        VendorDocument.aggregate([{ $group: { _id: "$vendorId", count: { $sum: 1 } } }]),
        VendorProductRequest.aggregate([{ $group: { _id: { vendorId: "$vendorId", status: "$status" }, count: { $sum: 1 } } }]),
        VendorProduct.aggregate([{ $group: { _id: "$vendorId", count: { $sum: 1 } } }]),
        VendorCropRequest.aggregate([{ $group: { _id: { vendorId: "$vendorId", status: "$status" }, count: { $sum: 1 } } }]),
        VendorCrop.aggregate([{ $group: { _id: "$vendorId", count: { $sum: 1 } } }]),
      ]);

    const vendorIds = new Set(vendors.map((v) => String(v.id)));
    const centreByVendor = new Map();
    centres.forEach((c) => {
      if (!centreByVendor.has(String(c.vendorId))) centreByVendor.set(String(c.vendorId), c);
    });

    const perVendor = new Map(
      vendors.map((v) => [
        String(v.id),
        {
          farmers: 0,
          activeFarmers: 0,
          managers: 0,
          activeManagers: 0,
          darkStores: 0,
          activeDarkStores: 0,
          pendingRequests: 0,
          documents: 0,
          products: 0,
          pendingProductRequests: 0,
          crops: 0,
          pendingCropRequests: 0,
        },
      ])
    );
    const bump = (vendorId, key, by = 1) => {
      const row = perVendor.get(String(vendorId || ""));
      if (row) row[key] += by;
    };

    const farmers = { total: 0, active: 0, pending: 0, inactive: 0, unassignedManager: unassignedFarmers, outsideCentres: 0 };
    farmerRows.forEach(({ _id, count }) => {
      farmers.total += count;
      if (_id.status === "active") farmers.active += count;
      else if (_id.status === "pending" || _id.status === "registered") farmers.pending += count;
      else farmers.inactive += count;
      if (!vendorIds.has(String(_id.vendorId || ""))) farmers.outsideCentres += count;
      bump(_id.vendorId, "farmers", count);
      if (_id.status === "active") bump(_id.vendorId, "activeFarmers", count);
    });

    const managers = { total: 0, active: 0, inactive: 0 };
    managerRows.forEach(({ _id, count }) => {
      managers.total += count;
      if (_id.status === "active") managers.active += count;
      else managers.inactive += count;
      bump(_id.vendorId, "managers", count);
      if (_id.status === "active") bump(_id.vendorId, "activeManagers", count);
    });

    const darkStoreStats = { total: darkStores.length, active: 0, assigned: 0, unassigned: 0 };
    darkStores.forEach((store) => {
      const active = store.isActive !== false;
      if (active) darkStoreStats.active += 1;
      if (store.vendorId && vendorIds.has(String(store.vendorId))) {
        darkStoreStats.assigned += 1;
        bump(store.vendorId, "darkStores");
        if (active) bump(store.vendorId, "activeDarkStores");
      } else {
        darkStoreStats.unassigned += 1;
      }
    });

    const requests = { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 };
    requestRows.forEach(({ _id, count }) => {
      if (requests[_id.status] !== undefined) requests[_id.status] += count;
      if (_id.status === "Pending") bump(_id.vendorId, "pendingRequests", count);
    });
    docRows.forEach(({ _id, count }) => bump(_id, "documents", count));

    const productRequests = { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 };
    productRequestRows.forEach(({ _id, count }) => {
      if (productRequests[_id.status] !== undefined) productRequests[_id.status] += count;
      if (_id.status === "Pending") bump(_id.vendorId, "pendingProductRequests", count);
    });
    let assignedProducts = 0;
    vendorProductRows.forEach(({ _id, count }) => {
      assignedProducts += count;
      bump(_id, "products", count);
    });
    const cropRequests = { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 };
    cropRequestRows.forEach(({ _id, count }) => {
      if (cropRequests[_id.status] !== undefined) cropRequests[_id.status] += count;
      if (_id.status === "Pending") bump(_id.vendorId, "pendingCropRequests", count);
    });
    vendorCropRows.forEach(({ _id, count }) => bump(_id, "crops", count));

    const vendorName = (v) => v.vendorName || v.businessName || v.ownerName || v.id;
    const nameById = new Map(vendors.map((v) => [String(v.id), vendorName(v)]));
    const centreRows = vendors.map((v) => ({
      id: v.id,
      name: vendorName(v),
      ownerName: v.ownerName,
      mobile: v.mobile,
      city: v.city || centreByVendor.get(String(v.id))?.city || "",
      state: v.state || "",
      status: v.status,
      centreId: centreByVendor.get(String(v.id))?.id || "",
      createdAt: v.createdAt,
      ...perVendor.get(String(v.id)),
    }));

    return ok(res, {
      centres: {
        total: vendors.length,
        active: vendors.filter((v) => v.status === "Active").length,
        pending: vendors.filter((v) => v.status === "Pending").length,
        inactive: vendors.filter((v) => v.status === "Inactive" || v.status === "Suspended").length,
        withoutDocuments: centreRows.filter((c) => c.documents === 0).length,
      },
      farmers,
      managers,
      darkStores: darkStoreStats,
      requests,
      productRequests,
      assignedProducts,
      cropRequests,
      documentTypes: Object.keys(VENDOR_DOCUMENT_TYPES).length,
      centreRows,
      recentRequests: recentRequests.map((r) => ({
        id: r.id,
        storeName: r.storeName,
        city: r.city,
        area: r.area,
        vendorId: r.vendorId,
        vendorName: nameById.get(String(r.vendorId)) || r.vendorId,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function sendVendorVerificationOtpAdmin(req, res, next) {
  try {
    const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return fail(res, 400, "Enter a valid 10-digit Indian mobile number");
    }

    const existing = await Vendor.findOne({ mobile });
    if (existing) {
      return fail(res, 409, "A vendor with this mobile number already exists");
    }

    const result = await sendCommonOtp(mobile, "vendor_create_verification");
    return res.json({
      success: true,
      message: "Verification OTP sent successfully via GreenGrocc Common OTP (GREGRC_Common_OTP)",
      template: "GreenGrocc Common OTP (GREGRC_Common_OTP)",
      templateId: MSG91_TEMPLATES.COMMON_OTP,
      devMock: result.devMock,
      code: result.devMock ? result.code : undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyVendorVerificationOtpAdmin(req, res, next) {
  try {
    const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
    const otp = String(req.body.otp || "").trim();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return fail(res, 400, "Enter a valid 10-digit Indian mobile number");
    }
    if (!otp) {
      return fail(res, 400, "Please enter the 6-digit OTP");
    }

    const result = await verifyOtp({
      phone: mobile,
      otp,
      purpose: "vendor_create_verification",
    });

    if (!result.ok) {
      return fail(res, 400, result.message || "Invalid or expired OTP");
    }

    markPhoneOtpVerified(mobile);
    return res.json({
      success: true,
      verified: true,
      message: "Mobile number verified successfully via GreenGrocc Common OTP (GREGRC_Common_OTP)",
    });
  } catch (error) {
    next(error);
  }
}

export async function createVendorAdmin(req, res, next) {
  try {
    const ownerName = String(req.body.ownerName || req.body.vendorName || "").trim();
    const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
    if (!ownerName) return fail(res, 400, "Owner / vendor name is required");
    if (!/^[6-9]\d{9}$/.test(mobile)) return fail(res, 400, "Enter a valid 10-digit mobile number");

    if (!isPhoneOtpVerified(mobile)) {
      return fail(res, 400, "Mobile number must be verified via GreenGrocc Common OTP (GREGRC_Common_OTP) before registering vendor");
    }

    let documents;
    try {
      documents = validateVendorDocuments(req.body.documents);
    } catch (docError) {
      return fail(res, docError.status || 400, docError.message);
    }
    const id = timestampId("vendor");
    const hashedPassword = await bcrypt.hash(String(req.body.password || "vendor123"), 10);
    const vendor = await Vendor.create({
      id,
      vendorCode: await serialId("VND"),
      vendorName: String(req.body.vendorName || ownerName).trim(),
      ownerName,
      mobile,
      email: String(req.body.email || "").trim().toLowerCase(),
      businessName: String(req.body.businessName || req.body.vendorName || ownerName).trim(),
      businessAddress: String(req.body.businessAddress || "").trim(),
      city: String(req.body.city || "").trim(),
      state: String(req.body.state || "").trim(),
      pincode: String(req.body.pincode || "").trim(),
      gstNumber: String(req.body.gstNumber || "").trim(),
      panNumber: String(req.body.panNumber || "").trim(),
      commissionRate: Number(req.body.commissionRate || 10),
      status: req.body.status || "Active",
      password: hashedPassword,
      role: "VENDOR",
    });
    consumeVerifiedPhone(mobile);
    let centre;
    try {
      centre = await createCentreForVendor(id, {
        name: vendor.vendorName,
        address: vendor.businessAddress,
        city: vendor.city,
        state: req.body.state || undefined,
        district: req.body.district || undefined,
        taluka: req.body.taluka || undefined,
        village: req.body.village || undefined,
        contactMobile: mobile,
      });
      if (centre && centre.id) {
        vendor.vendorCode = centre.id;
        await vendor.save();
      }
      await saveVendorDocuments(id, documents, "admin");
    } catch (setupError) {
      await Promise.all([
        Vendor.deleteOne({ _id: vendor._id }),
        centre ? CollectionCentre.deleteOne({ _id: centre._id }) : null,
        VendorDocument.deleteMany({ vendorId: id }),
      ]).catch(() => {});
      throw setupError;
    }
    const { password: _pw, ...data } = vendor.toObject();
    const savedDocs = await VendorDocument.find({ vendorId: id }).select("-fileUrl").lean();
    return res.status(201).json({
      success: true,
      data: { ...data, collectionCentre: centre.toObject(), documents: savedDocs.map(documentSummary) },
    });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, "A vendor with this mobile already exists");
    next(error);
  }
}

export async function updateVendorAdmin(req, res, next) {
  try {
    const vendor = await Vendor.findOne(vendorQuery(req.params.id));
    if (!vendor) return fail(res, 404, "Vendor not found");
    let documents;
    try {
      documents = validateVendorDocuments(req.body.documents);
    } catch (docError) {
      return fail(res, docError.status || 400, docError.message);
    }
    const fields = [
      "vendorName",
      "ownerName",
      "email",
      "businessName",
      "businessAddress",
      "city",
      "state",
      "pincode",
      "gstNumber",
      "panNumber",
      "status",
      "mobile",
    ];
    fields.forEach((key) => {
      if (req.body[key] !== undefined) vendor[key] = req.body[key];
    });
    if (req.body.commissionRate !== undefined) vendor.commissionRate = Number(req.body.commissionRate);
    if (req.body.password) vendor.password = await bcrypt.hash(String(req.body.password), 10);
    await vendor.save();
    let centre = await CollectionCentre.findOne({ vendorId: vendor.id }).sort({ createdAt: 1 });
    if (centre) {
      centre.name = vendor.vendorName || centre.name;
      centre.address = vendor.businessAddress || "";
      centre.city = vendor.city || "";
      centre.contactMobile = vendor.mobile || centre.contactMobile;
      await centre.save();
    } else {
      centre = await createCentreForVendor(vendor.id, {
        name: vendor.vendorName || vendor.ownerName,
        address: vendor.businessAddress,
        city: vendor.city,
        contactMobile: vendor.mobile,
      });
    }
    await saveVendorDocuments(vendor.id, documents, "admin");
    const savedDocs = await VendorDocument.find({ vendorId: vendor.id }).select("-fileUrl").lean();
    const { password: _pw, ...data } = vendor.toObject();
    return ok(res, { ...data, collectionCentre: centre.toObject(), documents: savedDocs.map(documentSummary) });
  } catch (error) {
    next(error);
  }
}

export async function deleteVendorAdmin(req, res, next) {
  try {
    const vendor = await Vendor.findOneAndDelete(vendorQuery(req.params.id));
    if (!vendor) return fail(res, 404, "Vendor not found");
    await Promise.all([
      VendorDocument.deleteMany({ vendorId: vendor.id }),
      DeliveryManager.updateMany({ vendorId: vendor.id }, { $set: { vendorId: "" } }),
      VendorProduct.deleteMany({ vendorId: vendor.id }),
      VendorProductRequest.updateMany({ vendorId: vendor.id, status: "Pending" }, { $set: { status: "Cancelled" } }),
      VendorCrop.deleteMany({ vendorId: vendor.id }),
      VendorCropRequest.updateMany({ vendorId: vendor.id, status: "Pending" }, { $set: { status: "Cancelled" } }),
    ]);
    return ok(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
}

export async function getVendorAdmin(req, res, next) {
  try {
    const vendor = await Vendor.findOne(vendorQuery(req.params.id)).select("-password").lean();
    if (!vendor) return fail(res, 404, "Vendor not found");
    const [centre, documents, darkStores] = await Promise.all([
      CollectionCentre.findOne({ vendorId: vendor.id }).sort({ createdAt: 1 }).lean(),
      VendorDocument.find({ vendorId: vendor.id }).select("-fileUrl").lean(),
      DeliveryManager.find({ vendorId: vendor.id }).sort({ storeName: 1 }).lean(),
    ]);
    return ok(res, {
      ...vendor,
      collectionCentre: centre || null,
      documents: documents.map(documentSummary),
      darkStores: darkStores.map(darkStoreSummary),
    });
  } catch (error) {
    next(error);
  }
}

export async function createDarkStoreAdmin(req, res, next) {
  try {
    const body = req.body || {};
    const storeName = String(body.storeName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
    const password = String(body.password || "");
    const state = String(body.state || "").trim();
    const city = String(body.city || "").trim();
    const area = String(body.area || "").trim();
    const vendorId = String(body.vendorId || "").trim();

    if (!storeName) return fail(res, 400, "Dark store name is required");
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "Enter a valid manager email");
    if (!/^[6-9]\d{9}$/.test(phone)) return fail(res, 400, "Enter a valid 10-digit mobile number");
    if (password.length < 6) return fail(res, 400, "Password must be at least 6 characters");
    if (!state || !city || !area) return fail(res, 400, "State, city and area are required");
    if (vendorId && !(await Vendor.exists({ id: vendorId }))) return fail(res, 400, "Selected collection centre was not found");

    const phoneConflict = await checkPhoneConflict(phone);
    if (phoneConflict.inUse) return fail(res, 409, phoneConflict.message);
    if (await DeliveryManager.exists({ email })) return fail(res, 409, "A dark store with this email already exists");

    const latitude = body.latitude === "" || body.latitude == null ? null : Number(body.latitude);
    const longitude = body.longitude === "" || body.longitude == null ? null : Number(body.longitude);
    if ((latitude === null) !== (longitude === null) || [latitude, longitude].some((n) => n !== null && !Number.isFinite(n))) {
      return fail(res, 400, "Enter both latitude and longitude, or leave both empty");
    }
    const geofenceRadius = Number(body.geofenceRadius);

    const manager = await DeliveryManager.create({
      name: String(body.name || "").trim() || storeName,
      email,
      phone,
      password,
      state,
      city,
      cityId: city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      area,
      storeName,
      storeAddress: String(body.storeAddress || "").trim(),
      pincode: String(body.pincode || "").trim(),
      latitude,
      longitude,
      ...(geofenceRadius >= 50 && geofenceRadius <= 50000 ? { geofenceRadius } : {}),
      isActive: body.isActive !== false,
      vendorId,
    });
    await seedManagerStore(manager).catch((error) => console.warn("[DarkStore] seed failed:", error.message));
    return res.status(201).json({ success: true, message: "Dark store created", data: manager.toSafeJSON() });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, "A dark store with this email or mobile already exists");
    next(error);
  }
}

export async function listDarkStoreRequestsAdmin(req, res, next) {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const [requests, vendors, pending] = await Promise.all([
      DarkStoreRequest.find(filter).sort({ createdAt: -1 }).lean(),
      Vendor.find().select("id vendorName businessName ownerName mobile").lean(),
      DarkStoreRequest.countDocuments({ status: "Pending" }),
    ]);
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const data = requests.map((request) => {
      const vendor = vendorById.get(request.vendorId);
      return {
        ...serializeDarkStoreRequest(request),
        vendorName: vendor ? vendor.vendorName || vendor.businessName || vendor.ownerName : "",
        vendorMobile: vendor?.mobile || "",
      };
    });
    return ok(res, data, { stats: { pending } });
  } catch (error) {
    next(error);
  }
}

export async function approveDarkStoreRequestAdmin(req, res, next) {
  try {
    const request = await DarkStoreRequest.findOne({ id: req.params.requestId });
    if (!request) return fail(res, 404, "Request not found");
    if (request.status !== "Pending") return fail(res, 400, `This request is already ${request.status.toLowerCase()}`);
    if (!(await Vendor.exists({ id: request.vendorId }))) {
      return fail(res, 400, "The collection centre that sent this request no longer exists");
    }
    const phoneConflict = await checkPhoneConflict(request.phone, {
      excludeModel: "DarkStoreRequest",
      excludeId: request.id,
    });
    if (phoneConflict.inUse) {
      return fail(res, 409, `${phoneConflict.message}. Reject this request instead.`);
    }
    if (await DeliveryManager.exists({ email: request.email })) {
      return fail(res, 409, "A dark store with this email already exists. Reject this request instead.");
    }
    const zone = request.zoneId
      ? await VendorZone.findOne({ id: request.zoneId, vendorId: request.vendorId }).lean()
      : null;
    if (request.zoneId && zone?.status !== "Approved") {
      return fail(res, 400, "The zone for this dark store is not approved. Approve the zone first or reject this request.");
    }

    // Placeholder password satisfies the schema; the vendor-chosen hash is written afterwards so the
    // pre-save hook does not hash it a second time.
    const manager = await DeliveryManager.create({
      name: request.managerName || request.storeName,
      email: request.email,
      phone: request.phone,
      password: crypto.randomBytes(12).toString("hex"),
      state: request.state,
      city: request.city,
      cityId: request.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      area: request.area,
      storeName: request.storeName,
      storeAddress: request.storeAddress,
      pincode: request.pincode,
      latitude: request.latitude,
      longitude: request.longitude,
      vendorId: request.vendorId,
      zoneId: zone?.id || "",
      zoneName: zone?.name || "",
    });
    await DeliveryManager.updateOne({ _id: manager._id }, { $set: { password: request.passwordHash } });
    await seedManagerStore(manager).catch((error) => console.warn("[DarkStoreRequest] seed failed:", error.message));

    request.status = "Approved";
    request.darkStoreId = String(manager._id);
    request.adminRemarks = String(req.body?.remarks || "").trim();
    request.reviewedAt = new Date();
    await request.save();
    return ok(res, serializeDarkStoreRequest(request), { message: "Dark store approved and created" });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, "A dark store with this email or mobile already exists");
    next(error);
  }
}

export async function rejectDarkStoreRequestAdmin(req, res, next) {
  try {
    const request = await DarkStoreRequest.findOne({ id: req.params.requestId });
    if (!request) return fail(res, 404, "Request not found");
    if (request.status !== "Pending") return fail(res, 400, `This request is already ${request.status.toLowerCase()}`);
    const remarks = String(req.body?.remarks || "").trim();
    if (!remarks) return fail(res, 400, "Please give a reason for rejecting");
    request.status = "Rejected";
    request.adminRemarks = remarks;
    request.reviewedAt = new Date();
    await request.save();
    return ok(res, serializeDarkStoreRequest(request), { message: "Request rejected" });
  } catch (error) {
    next(error);
  }
}

export async function listVendorProductRequestsAdmin(req, res, next) {
  try {
    const filter = req.query.status && req.query.status !== "all" ? { status: req.query.status } : {};
    if (req.query.vendorId) filter.vendorId = String(req.query.vendorId);
    const [requests, vendorProducts, vendors, centres, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      VendorProductRequest.find(filter).sort({ createdAt: -1 }).lean(),
      VendorProduct.find(req.query.vendorId ? { vendorId: req.query.vendorId } : {}).sort({ createdAt: -1 }).lean(),
      Vendor.find().select("id vendorCode vendorName businessName ownerName mobile email city state status").lean(),
      CollectionCentre.find().select("id vendorId name").sort({ createdAt: 1 }).lean(),
      VendorProductRequest.countDocuments({ status: "Pending" }),
      VendorProductRequest.countDocuments({ status: "Approved" }),
      VendorProductRequest.countDocuments({ status: "Rejected" }),
    ]);

    const requestProductIds = requests.map((r) => r.productId);
    const vpProductIds = vendorProducts.map((vp) => vp.productId);
    const productIds = [...new Set([...requestProductIds, ...vpProductIds])].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const products = productIds.length
      ? await CatalogProduct.find({ _id: { $in: productIds } })
          .select("name sku categories subcategory productImages price discountedPrice unit stock inStock isActive brandName varietyName")
          .lean()
      : [];
    const productById = new Map(products.map((p) => [String(p._id), catalogProductSummary(p)]));
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const centreByVendor = new Map(centres.map((c) => [String(c.vendorId), c]));

    const requestKeySet = new Set(requests.map((r) => `${r.vendorId}:::${r.productId}`));

    const data = requests.map((request) => {
      const vendor = vendorById.get(request.vendorId);
      return {
        ...serializeVendorProductRequest(request),
        vendorName: vendor ? (vendor.vendorName || vendor.businessName || vendor.ownerName) : request.vendorId,
        vendorCode: vendor?.vendorCode || "",
        vendorOwnerName: vendor?.ownerName || "",
        vendorMobile: vendor?.mobile || "",
        vendorEmail: vendor?.email || "",
        vendorCity: vendor?.city || "",
        vendorState: vendor?.state || "",
        catalog: productById.get(request.productId) || null,
      };
    });

    // If status filter is 'all' or 'Approved', also include active VendorProducts not in requests list
    if (!req.query.status || req.query.status === "all" || req.query.status === "Approved") {
      for (const vp of vendorProducts) {
        const key = `${vp.vendorId}:::${vp.productId}`;
        if (requestKeySet.has(key)) continue;
        const vendor = vendorById.get(vp.vendorId);
        const catalog = productById.get(vp.productId) || null;
        data.push({
          id: vp.id || `vp-${vp.vendorId}-${vp.productId}`,
          vendorId: vp.vendorId,
          productId: vp.productId,
          productName: vp.productName || catalog?.name || "Product",
          productImage: vp.productImage || catalog?.image || "",
          category: vp.category || catalog?.category || "",
          unit: vp.customUnit || vp.unit || catalog?.unit || "Kg",
          status: "Approved",
          notes: "Approved and active in vendor catalog",
          adminRemarks: "",
          createdAt: vp.createdAt || new Date(),
          vendorName: vendor ? (vendor.vendorName || vendor.businessName || vendor.ownerName) : vp.vendorId,
          vendorCode: vendor?.vendorCode || "",
          vendorOwnerName: vendor?.ownerName || "",
          vendorMobile: vendor?.mobile || "",
          vendorEmail: vendor?.email || "",
          vendorCity: vendor?.city || "",
          vendorState: vendor?.state || "",
          catalog,
          isAssignedProduct: true,
        });
      }
    }

    const enrichedVendors = vendors.map((v) => {
      const c = centreByVendor.get(String(v.id));
      return {
        ...v,
        collectionCentreName: c?.name || "",
        collectionCentreId: c?.id || "",
      };
    });

    const pendingTotal = data.filter((d) => d.status === "Pending").length;
    const approvedTotal = data.filter((d) => d.status === "Approved").length;
    const rejectedTotal = data.filter((d) => d.status === "Rejected").length;

    return ok(res, data, {
      stats: {
        pending: pendingTotal,
        approved: approvedTotal,
        rejected: rejectedTotal,
        totalVendors: vendors.length,
        totalProducts: data.length,
      },
      vendors: enrichedVendors,
    });
  } catch (error) {
    next(error);
  }
}

export async function approveVendorProductRequestAdmin(req, res, next) {
  try {
    const request = await VendorProductRequest.findOne({ id: req.params.requestId });
    if (!request) return fail(res, 404, "Request not found");
    if (request.status !== "Pending") return fail(res, 400, `This request is already ${request.status.toLowerCase()}`);
    if (!(await Vendor.exists({ id: request.vendorId }))) {
      return fail(res, 400, "The collection centre that sent this request no longer exists");
    }
    const product = mongoose.Types.ObjectId.isValid(request.productId)
      ? await CatalogProduct.findOne({ _id: request.productId, isActive: { $ne: false } }).lean()
      : null;
    if (!product) return fail(res, 400, "This product is no longer active in the catalog");

    const summary = catalogProductSummary(product);
    await VendorProduct.findOneAndUpdate(
      { vendorId: request.vendorId, productId: request.productId },
      {
        $set: { productName: summary.name, productImage: summary.image, category: summary.category, unit: summary.unit },
        $setOnInsert: {
          id: `vp-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
          requestId: request.id,
          addedBy: String(req.user?.id || req.user?._id || "admin"),
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    request.status = "Approved";
    request.adminRemarks = String(req.body?.remarks || "").trim();
    request.reviewedAt = new Date();
    await request.save();
    return ok(res, serializeVendorProductRequest(request), { message: "Product added to the collection centre" });
  } catch (error) {
    next(error);
  }
}

export async function rejectVendorProductRequestAdmin(req, res, next) {
  try {
    const request = await VendorProductRequest.findOne({ id: req.params.requestId });
    if (!request) return fail(res, 404, "Request not found");
    if (request.status !== "Pending") return fail(res, 400, `This request is already ${request.status.toLowerCase()}`);
    const remarks = String(req.body?.remarks || "").trim();
    if (!remarks) return fail(res, 400, "Please give a reason for rejecting");
    request.status = "Rejected";
    request.adminRemarks = remarks;
    request.reviewedAt = new Date();
    await request.save();
    return ok(res, serializeVendorProductRequest(request), { message: "Request rejected" });
  } catch (error) {
    next(error);
  }
}

export async function listVendorProductsAdmin(req, res, next) {
  try {
    const vendor = await Vendor.findOne(vendorQuery(req.params.id)).select("id").lean();
    if (!vendor) return fail(res, 404, "Vendor not found");
    return ok(res, await vendorProductsWithCatalog(vendor.id));
  } catch (error) {
    next(error);
  }
}

export async function removeVendorProductAdmin(req, res, next) {
  try {
    const vendor = await Vendor.findOne(vendorQuery(req.params.id)).select("id").lean();
    if (!vendor) return fail(res, 404, "Vendor not found");
    const removed = await VendorProduct.findOneAndDelete({ vendorId: vendor.id, productId: req.params.productId });
    if (!removed) return fail(res, 404, "Product is not assigned to this collection centre");
    return ok(res, { productId: req.params.productId }, { message: "Product removed from the collection centre" });
  } catch (error) {
    next(error);
  }
}

export async function listVendorCropRequestsAdmin(req, res, next) {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    if (req.query.vendorId) filter.vendorId = String(req.query.vendorId);
    const [requests, vendors, pending] = await Promise.all([
      VendorCropRequest.find(filter).sort({ createdAt: -1 }).lean(),
      Vendor.find().select("id vendorName businessName ownerName mobile").lean(),
      VendorCropRequest.countDocuments({ status: "Pending" }),
    ]);
    const cropIds = [...new Set(requests.map((r) => r.cropId))];
    const crops = cropIds.length ? await ErpCrop.find({ cropId: { $in: cropIds }, isDeleted: { $ne: true } }).lean() : [];
    const cropById = new Map(crops.map((c) => [c.cropId, catalogCropSummary(c)]));
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const data = requests.map((request) => {
      const vendor = vendorById.get(request.vendorId);
      return {
        ...serializeVendorCropRequest(request),
        vendorName: vendor ? vendor.vendorName || vendor.businessName || vendor.ownerName : "",
        vendorMobile: vendor?.mobile || "",
        catalog: cropById.get(request.cropId) || null,
      };
    });
    return ok(res, data, { stats: { pending } });
  } catch (error) {
    next(error);
  }
}

export async function approveVendorCropRequestAdmin(req, res, next) {
  try {
    const request = await VendorCropRequest.findOne({ id: req.params.requestId });
    if (!request) return fail(res, 404, "Request not found");
    if (request.status !== "Pending") return fail(res, 400, `This request is already ${request.status.toLowerCase()}`);
    if (!(await Vendor.exists({ id: request.vendorId }))) {
      return fail(res, 400, "The collection centre that sent this request no longer exists");
    }
    const crop = await ErpCrop.findOne({ cropId: request.cropId, isDeleted: { $ne: true } }).lean();
    if (!crop) return fail(res, 400, "This crop is no longer in the admin crop list");

    const summary = catalogCropSummary(crop);
    await VendorCrop.findOneAndUpdate(
      { vendorId: request.vendorId, cropId: request.cropId },
      {
        $set: { cropName: summary.cropName, variety: summary.variety, category: summary.category },
        $setOnInsert: {
          id: `vc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
          requestId: request.id,
          addedBy: String(req.user?.id || req.user?._id || "admin"),
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    request.status = "Approved";
    request.adminRemarks = String(req.body?.remarks || "").trim();
    request.reviewedAt = new Date();
    await request.save();
    return ok(res, serializeVendorCropRequest(request), { message: "Crop added to the collection centre" });
  } catch (error) {
    next(error);
  }
}

export async function rejectVendorCropRequestAdmin(req, res, next) {
  try {
    const request = await VendorCropRequest.findOne({ id: req.params.requestId });
    if (!request) return fail(res, 404, "Request not found");
    if (request.status !== "Pending") return fail(res, 400, `This request is already ${request.status.toLowerCase()}`);
    const remarks = String(req.body?.remarks || "").trim();
    if (!remarks) return fail(res, 400, "Please give a reason for rejecting");
    request.status = "Rejected";
    request.adminRemarks = remarks;
    request.reviewedAt = new Date();
    await request.save();
    return ok(res, serializeVendorCropRequest(request), { message: "Request rejected" });
  } catch (error) {
    next(error);
  }
}

export async function listVendorCropsAdmin(req, res, next) {
  try {
    const vendor = await Vendor.findOne(vendorQuery(req.params.id)).select("id").lean();
    if (!vendor) return fail(res, 404, "Vendor not found");
    return ok(res, await vendorCropsWithCatalog(vendor.id));
  } catch (error) {
    next(error);
  }
}

export async function removeVendorCropAdmin(req, res, next) {
  try {
    const vendor = await Vendor.findOne(vendorQuery(req.params.id)).select("id").lean();
    if (!vendor) return fail(res, 404, "Vendor not found");
    const removed = await VendorCrop.findOneAndDelete({ vendorId: vendor.id, cropId: req.params.cropId });
    if (!removed) return fail(res, 404, "Crop is not assigned to this collection centre");
    return ok(res, { cropId: req.params.cropId }, { message: "Crop removed from the collection centre" });
  } catch (error) {
    next(error);
  }
}

export async function getVendorDocumentAdmin(req, res, next) {
  try {
    const vendor = await Vendor.findOne(vendorQuery(req.params.id)).select("id").lean();
    if (!vendor) return fail(res, 404, "Vendor not found");
    const doc = await VendorDocument.findOne({ vendorId: vendor.id, id: req.params.docId }).lean();
    if (!doc) return fail(res, 404, "Document not found");
    return ok(res, { ...documentSummary(doc), fileUrl: doc.fileUrl });
  } catch (error) {
    next(error);
  }
}

export async function deleteVendorDocumentAdmin(req, res, next) {
  try {
    const vendor = await Vendor.findOne(vendorQuery(req.params.id)).select("id").lean();
    if (!vendor) return fail(res, 404, "Vendor not found");
    const doc = await VendorDocument.findOneAndDelete({ vendorId: vendor.id, id: req.params.docId });
    if (!doc) return fail(res, 404, "Document not found");
    return ok(res, { id: req.params.docId });
  } catch (error) {
    next(error);
  }
}

const OFFICE_STAFF_ROLES = STAFF_ROLES.filter((role) => role !== "farmer");
const currentPayrollMonth = () => new Date().toISOString().slice(0, 7);

function withEmployment(person, employment) {
  if (!employment) return person;
  return {
    ...person,
    department: employment.department || person.department || "",
    designation: employment.designation || person.role,
    joiningDate: employment.joiningDate || "",
    salaryDate: employment.salaryDate || "",
    monthlySalary: Number(employment.monthlySalary || 0),
    salaryTax: Number(employment.salaryTax ?? employment.tax ?? 0),
    finalSalary: Math.max(0, Number(employment.monthlySalary || 0) - Number(employment.salaryTax ?? employment.tax ?? 0)),
    bankAccount: employment.bankAccount || "",
    ifsc: employment.ifsc || "",
    upi: employment.upi || "",
    workNotes: employment.workNotes || "",
  };
}

/** `vendorId` limits the directory to that vendor's farmer managers and pickup drivers. */
export async function loadHrPeople({ vendorId = "" } = {}) {
  const teamFilter = vendorId ? { vendorId } : {};
  const none = Promise.resolve([]);
  const [staff, farmerManagers, pickupDrivers, managers, riders, employments, openTasks] = await Promise.all([
    vendorId ? none : Staff.find({ role: { $ne: "farmer" } }).sort({ createdAt: -1 }).lean(),
    FarmerManager.find(teamFilter).select("-password").sort({ createdAt: -1 }).lean(),
    PickupDriver.find(teamFilter).select("-password").sort({ createdAt: -1 }).lean(),
    vendorId ? none : DeliveryManager.find().select("name email phone city area storeName isActive createdAt").lean(),
    vendorId
      ? none
      : DeliveryBoy.find()
          .select("name phone city area status isActive verificationStatus managerId createdAt")
          .populate("managerId", "name storeName")
          .lean(),
    HrEmployment.collection.find({}).toArray(),
    HrTask.find({ status: { $ne: "done" } }).lean(),
  ]);
  const employmentMap = new Map(employments.map((row) => [`${row.employeeType}:${String(row.employeeId)}`, row]));
  const openTaskCount = new Map();
  openTasks.forEach((task) => {
    const key = `${task.employeeType}:${task.employeeId}`;
    openTaskCount.set(key, (openTaskCount.get(key) || 0) + 1);
  });
  const people = [
    ...staff.map((item) => ({
      id: String(item._id),
      employeeType: "staff",
      team: "office",
      name: item.name,
      email: item.email,
      phone: item.phone,
      role: ROLE_LABELS[item.role] || item.role,
      roleKey: item.role,
      isActive: item.isActive !== false,
      location: "",
      createdAt: item.createdAt,
    })),
    ...farmerManagers.map((item) => ({
      id: String(item.id || item._id),
      employeeType: "farmer_manager",
      team: "field",
      name: item.name,
      email: item.email || "",
      phone: item.mobile || "",
      role: "Farmer Manager",
      roleKey: "farmer_manager",
      isActive: item.status !== "Inactive",
      location: [item.location, item.city, item.state].filter(Boolean).join(", "),
      joiningDate: item.joiningDate || "",
      createdAt: item.createdAt,
    })),
    ...pickupDrivers.map((item) => ({
      id: String(item.id || item._id),
      employeeType: "pickup_driver",
      team: "field",
      name: item.name,
      email: "",
      phone: item.mobile || "",
      role: "Pickup Driver",
      roleKey: "pickup_driver",
      isActive: item.status !== "Inactive",
      location: [item.assignedArea, item.vehicleType, item.vehicleNumber].filter(Boolean).join(" · "),
      createdAt: item.createdAt,
    })),
    ...managers.map((item) => ({
      id: String(item._id),
      employeeType: "delivery_manager",
      team: "delivery",
      name: item.name || item.storeName || "Store manager",
      email: item.email,
      phone: item.phone,
      role: "Delivery Manager",
      roleKey: "delivery_manager",
      isActive: item.isActive !== false,
      location: [item.storeName, item.area, item.city].filter(Boolean).join(", "),
      createdAt: item.createdAt,
      href: `/hr-management/employees/delivery_manager/${item._id}`,
    })),
    ...riders.map((item) => ({
      id: String(item._id),
      employeeType: "delivery_boy",
      team: "delivery",
      name: item.name || "Delivery partner",
      email: "",
      phone: item.phone,
      role: "Delivery Boy",
      roleKey: "delivery_boy",
      isActive: item.isActive !== false,
      location: [item.managerId?.storeName, item.area, item.city].filter(Boolean).join(", "),
      createdAt: item.createdAt,
      href: `/hr-management/employees/delivery_boy/${item._id}`,
    })),
  ].map((person) => {
    const key = `${person.employeeType}:${person.id}`;
    return {
      ...withEmployment(person, employmentMap.get(key)),
      openWork: openTaskCount.get(key) || 0,
      href: vendorId
        ? `/vendor/hr-management/employees/${person.employeeType}/${person.id}`
        : person.href || `/hr-management/employees/${person.employeeType}/${person.id}`,
    };
  });
  return { people, staff, farmerManagers, pickupDrivers, managers, riders };
}

export const loadScopedHrPeople = (req) => loadHrPeople({ vendorId: hrOwnerId(req) });

const VENDOR_HR_DIRECTORY_ROLES = [
  { value: "farmer_manager", label: "Farmer Manager", employeeType: "farmer_manager" },
  { value: "pickup_driver", label: "Pickup Driver", employeeType: "pickup_driver" },
];

export async function listHrDirectory(req, res, next) {
  try {
    const scopeFilter = await hrEmployeeFilter(req);
    const [{ people, staff, farmerManagers, pickupDrivers, managers, riders }, openAttendance] = await Promise.all([
      loadScopedHrPeople(req),
      HrAttendance.find(withHrScope({ clockOut: null }, scopeFilter)).sort({ clockIn: -1 }).lean(),
    ]);
    const salaryBill = people.reduce((sum, person) => sum + Number(person.monthlySalary || 0), 0);
    const openWork = people.reduce((sum, person) => sum + Number(person.openWork || 0), 0);
    return ok(res, people, {
      stats: {
        total: people.length,
        staff: staff.length,
        farmerManagers: farmerManagers.length,
        pickupDrivers: pickupDrivers.length,
        managers: managers.length,
        riders: riders.length,
        clockedIn: openAttendance.length,
        monthlySalaryBill: salaryBill,
        openWork,
        withSalary: people.filter((person) => Number(person.monthlySalary) > 0).length,
      },
      attendance: openAttendance,
      month: currentPayrollMonth(),
      roles: isVendorScope(req)
        ? VENDOR_HR_DIRECTORY_ROLES
        : [
            ...OFFICE_STAFF_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] || role, employeeType: "staff" })),
            ...(await CustomRole.find({ isActive: true }).lean().catch(() => [])).map((cr) => ({
              value: cr.roleKey,
              label: cr.displayName,
              employeeType: "staff",
              isCustom: true,
            })),
            { value: "pickup_driver", label: "Pickup Driver", employeeType: "pickup_driver" },
            { value: "delivery_manager", label: "Delivery Manager", employeeType: "delivery_manager" },
            { value: "delivery_boy", label: "Delivery Boy", employeeType: "delivery_boy" },
          ],
    });
  } catch (error) {
    next(error);
  }
}

async function attachEmployment(employeeId, employeeType, name, roleLabel, body) {
  const monthlySalary = Number(body.monthlySalary || 0);
  await upsertEmployment({
    employeeId,
    employeeType,
    name,
    role: roleLabel,
    department: body.department,
    joiningDate: body.joiningDate,
    salaryDate: body.salaryDate,
    monthlySalary: Number.isFinite(monthlySalary) ? monthlySalary : 0,
    salaryTax: body.salaryTax,
    bankAccount: body.bankAccount,
    ifsc: body.ifsc,
    upi: body.upi,
    workNotes: body.workNotes,
  });
}

export async function createHrStaff(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || req.body.mobile || "").replace(/\D/g, "").slice(-10);
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "Staff@123");
    const role = String(req.body.role || (isVendorScope(req) ? "farmer_manager" : "product_manager")).trim();
    if (isVendorScope(req)) {
      if (!VENDOR_HR_ROLE_KEYS.includes(role)) return fail(res, 400, "Vendors can add farmer managers or pickup drivers");
      req.body.vendorId = hrOwnerId(req);
    }
    if (!name) return fail(res, 400, "Name is required");
    if (!/^[6-9]\d{9}$/.test(phone)) return fail(res, 400, "Valid 10-digit phone is required");
    if (password.length < 6) return fail(res, 400, "Password must be at least 6 characters");

    let employeeId = "";
    let employeeType = "staff";
    let payload = null;

    if (role === "farmer_manager") {
      const vendorId = String(req.body.vendorId || "vendor-1").trim() || "vendor-1";
      const businessId = await createManagerBusinessId({
        vendorId,
        name,
        collectionCentreId: String(req.body.collectionCentreId || "").trim(),
        city: String(req.body.city || "").trim(),
        state: String(req.body.state || "").trim(),
        address: String(req.body.address || "").trim(),
      });
      const hashedPassword = await bcrypt.hash(password, 10);
      const created = await FarmerManager.create({
        id: businessId.id,
        managerCode: businessId.managerCode,
        collectionCentreId: businessId.collectionCentreId,
        vendorId,
        name,
        mobile: phone,
        email,
        address: String(req.body.address || "").trim(),
        city: String(req.body.city || "").trim(),
        state: String(req.body.state || "").trim(),
        pincode: String(req.body.pincode || "").trim(),
        location: String(req.body.location || req.body.city || "").trim(),
        joiningDate: String(req.body.joiningDate || "").trim(),
        status: "Active",
        password: hashedPassword,
        role: "FARMER_MANAGER",
      });
      employeeId = String(created.id || created._id);
      employeeType = "farmer_manager";
      payload = created.toObject();
      delete payload.password;
    } else if (role === "pickup_driver") {
      const created = await PickupDriver.create({
        id: timestampId("drv"),
        vendorId: String(req.body.vendorId || "vendor-1").trim() || "vendor-1",
        name,
        mobile: phone,
        vehicleNumber: String(req.body.vehicleNumber || "").trim(),
        vehicleType: String(req.body.vehicleType || "Van").trim(),
        licenseNumber: String(req.body.licenseNumber || "").trim(),
        assignedArea: String(req.body.assignedArea || req.body.area || "").trim(),
        password,
        role: "DRIVER",
        status: "Active",
      });
      employeeId = String(created.id || created._id);
      employeeType = "pickup_driver";
      payload = created.toObject();
      delete payload.password;
    } else if (role === "delivery_manager") {
      if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "Valid email is required");
      const state = String(req.body.state || "").trim();
      const city = String(req.body.city || "").trim();
      const area = String(req.body.area || "").trim();
      if (!state || !city || !area) return fail(res, 400, "State, city and area are required");
      const manager = await DeliveryManager.create({
        name,
        email,
        phone,
        password,
        state,
        city,
        cityId: String(req.body.cityId || city).trim().toLowerCase().replace(/\s+/g, "-"),
        area,
        storeName: String(req.body.storeName || `${area} Store`).trim(),
        storeAddress: String(req.body.storeAddress || "").trim(),
        pincode: String(req.body.pincode || "").trim(),
      });
      await seedManagerStore(manager);
      employeeId = String(manager._id);
      employeeType = "delivery_manager";
      payload = manager.toSafeJSON();
    } else if (role === "delivery_boy") {
      const managerId = String(req.body.managerId || "").trim();
      const boy = await DeliveryBoy.create({
        name,
        phone,
        password,
        city: String(req.body.city || "").trim(),
        cityId: String(req.body.cityId || "").trim(),
        area: String(req.body.area || "").trim(),
        managerId: managerId || undefined,
        vehicleType: ["motorcycle", "bicycle", "electric", "van", "no_vehicle"].includes(req.body.vehicleType)
          ? req.body.vehicleType
          : "",
        verificationStatus: "pending",
      });
      employeeId = String(boy._id);
      employeeType = "delivery_boy";
      payload = boy.toSafeJSON ? boy.toSafeJSON() : { id: employeeId, name, phone };
    } else {
      const isCustomRole = await CustomRole.exists({ roleKey: role });
      if (!OFFICE_STAFF_ROLES.includes(role) && !isCustomRole) return fail(res, 400, "Invalid staff role");
      if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "Valid email is required");
      const staff = await Staff.create({
        name,
        email,
        phone,
        password,
        role,
        createdBy: req.user?.id,
        createdByRole: req.user?.role || "admin",
        meta: req.body.meta && typeof req.body.meta === "object" ? req.body.meta : {},
      });
      employeeId = staff._id.toString();
      employeeType = "staff";
      payload = staff.toSafeJSON();
    }

    const customRoleDoc = await CustomRole.findOne({ roleKey: role }).lean().catch(() => null);
    const roleTitle = customRoleDoc ? customRoleDoc.displayName : (ROLE_LABELS[role] || role);
    await attachEmployment(employeeId, employeeType, name, roleTitle, req.body);
    return res.status(201).json({ success: true, data: payload });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, "Email or phone already registered");
    next(error);
  }
}

async function updateVendorHrPerson(req, res) {
  const vendorId = hrOwnerId(req);
  const id = String(req.params.id || "");
  const Model = (await FarmerManager.exists({ id, vendorId })) ? FarmerManager : PickupDriver;
  const person = await Model.findOne({ id, vendorId });
  if (!person) return fail(res, 404, "Employee not found");
  if (typeof req.body.isActive === "boolean") person.status = req.body.isActive ? "Active" : "Inactive";
  if (req.body.name) person.name = String(req.body.name).trim();
  await person.save();
  const payload = person.toObject();
  delete payload.password;
  return ok(res, payload);
}

export async function updateHrStaff(req, res, next) {
  try {
    if (isVendorScope(req)) return await updateVendorHrPerson(req, res);
    const staff = await Staff.findById(req.params.id);
    if (!staff) return fail(res, 404, "Staff member not found");
    if (req.body.name) staff.name = String(req.body.name).trim();
    if (req.body.email) staff.email = String(req.body.email).trim().toLowerCase();
    if (req.body.phone) staff.phone = String(req.body.phone).replace(/\D/g, "").slice(-10);
    if (req.body.role && STAFF_ROLES.includes(req.body.role)) staff.role = req.body.role;
    if (typeof req.body.isActive === "boolean") staff.isActive = req.body.isActive;
    if (req.body.password) staff.password = String(req.body.password);
    await staff.save();
    if (
      req.body.monthlySalary !== undefined ||
      req.body.salaryTax !== undefined ||
      req.body.department !== undefined ||
      req.body.joiningDate !== undefined ||
      req.body.salaryDate !== undefined ||
      req.body.bankAccount !== undefined
    ) {
      await upsertEmployment({
        employeeId: staff._id.toString(),
        employeeType: "staff",
        name: staff.name,
        role: ROLE_LABELS[staff.role] || staff.role,
        ...req.body,
      });
    }
    return ok(res, staff.toSafeJSON());
  } catch (error) {
    next(error);
  }
}

export async function clockHrAttendance(req, res, next) {
  try {
    const employeeId = String(req.body.employeeId || "").trim();
    const name = String(req.body.name || "").trim();
    if (!employeeId || !name) return fail(res, 400, "Employee is required");
    if (!(await canManageHrEmployee(req, req.body.employeeType || "staff", employeeId))) {
      return fail(res, 403, "This employee is not in your team");
    }
    const today = req.body.date ? String(req.body.date).trim() : new Date().toISOString().slice(0, 10);
    const open = await HrAttendance.findOne({ employeeId, clockOut: null }).sort({ clockIn: -1 });
    if (req.body.action === "out") {
      if (!open) return fail(res, 400, "No open attendance to clock out");
      open.clockOut = new Date();
      open.notes = String(req.body.notes || open.notes || "").trim();
      if (open.clockIn) {
        open.workDurationMinutes = Math.max(0, Math.round((open.clockOut.getTime() - open.clockIn.getTime()) / 60000));
      }
      await open.save();
      return ok(res, open);
    }
    if (open) return fail(res, 400, "Already clocked in");
    const record = await HrAttendance.create({
      employeeId,
      employeeType: req.body.employeeType || "staff",
      name,
      role: String(req.body.role || "").trim(),
      date: today,
      clockIn: new Date(),
      clockOut: null,
      notes: String(req.body.notes || "").trim(),
      source: String(req.body.source || "admin"),
      status: "present",
    });
    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

export async function listHrAttendance(req, res, next) {
  try {
    const filter = {};
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.employeeType && req.query.employeeType !== "all") filter.employeeType = req.query.employeeType;
    if (req.query.date) filter.date = req.query.date;
    else if (req.query.month) filter.date = new RegExp(`^${req.query.month}`);
    else if (req.query.startDate && req.query.endDate) {
      filter.date = { $gte: req.query.startDate, $lte: req.query.endDate };
    }
    if (req.query.source && req.query.source !== "all") filter.source = req.query.source;

    const limit = Number(req.query.limit) || 500;
    const rows = await HrAttendance.find(withHrScope(filter, await hrEmployeeFilter(req)))
      .sort({ date: -1, clockIn: -1 })
      .limit(limit)
      .lean();

    const formattedRows = rows.map((r) => {
      const start = r.clockIn ? new Date(r.clockIn).getTime() : 0;
      const end = r.clockOut ? new Date(r.clockOut).getTime() : Date.now();
      const durationMinutes = start > 0 ? Math.max(0, Math.round((end - start) / 60000)) : 0;
      return {
        ...r,
        durationMinutes,
        source: r.source || (r.notes && r.notes.includes("Mobile App") ? "staff_app" : "staff_app"),
      };
    });

    const targetDate = req.query.date || new Date().toISOString().slice(0, 10);
    const dateRows = req.query.date ? formattedRows : formattedRows.filter((r) => r.date === targetDate);

    const leavesOnDate = await HrLeaveRequest.find({
      fromDate: { $lte: targetDate },
      toDate: { $gte: targetDate },
      status: "approved",
    }).lean().catch(() => []);

    const stats = {
      targetDate,
      totalRecords: formattedRows.length,
      presentCount: dateRows.length,
      currentlyWorking: dateRows.filter((r) => !r.clockOut).length,
      completedShift: dateRows.filter((r) => Boolean(r.clockOut)).length,
      onLeaveCount: leavesOnDate.length,
      staffAppPunches: dateRows.filter((r) => r.source === "staff_app").length,
      adminPunches: dateRows.filter((r) => r.source === "admin").length,
    };

    return ok(res, formattedRows, { stats });
  } catch (error) {
    next(error);
  }
}

export async function getHrAttendanceReport(req, res, next) {
  try {
    const { employeeId, filterType = "monthly", date, startDate, endDate, month } = req.query;
    if (!employeeId) return fail(res, 400, "Employee selection is required");

    const { people } = await loadScopedHrPeople(req);
    const person = people.find((p) => String(p.id) === String(employeeId));
    if (!person) return fail(res, 404, "Employee not found");

    const todayStr = new Date().toISOString().slice(0, 10);
    let startD, endD;
    const reportDays = [];

    if (filterType === "daily") {
      const targetDate = date || todayStr;
      startD = targetDate;
      endD = targetDate;
      reportDays.push(targetDate);
    } else if (filterType === "weekly") {
      if (startDate && endDate) {
        startD = startDate;
        endD = endDate;
      } else {
        const now = new Date();
        const day = now.getDay();
        const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(now.setDate(diffToMon));
        startD = mon.toISOString().slice(0, 10);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        endD = sun.toISOString().slice(0, 10);
      }
      const cur = new Date(`${startD}T00:00:00`);
      const end = new Date(`${endD}T00:00:00`);
      while (cur <= end) {
        reportDays.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      const targetMonth = month || todayStr.slice(0, 7);
      const [yearStr, mStr] = targetMonth.split("-");
      const y = parseInt(yearStr, 10);
      const m = parseInt(mStr, 10);
      const daysInMonth = new Date(y, m, 0).getDate();
      startD = `${targetMonth}-01`;
      endD = `${targetMonth}-${String(daysInMonth).padStart(2, "0")}`;
      for (let d = 1; d <= daysInMonth; d++) {
        reportDays.push(`${targetMonth}-${String(d).padStart(2, "0")}`);
      }
    }

    const [attendanceRecords, leaveRecords, shifts] = await Promise.all([
      HrAttendance.find({
        employeeId,
        date: { $gte: startD, $lte: endD },
      }).sort({ clockIn: 1 }).lean(),
      HrLeaveRequest.find({
        employeeId,
        status: "approved",
        fromDate: { $lte: endD },
        toDate: { $gte: startD },
      }).lean(),
      HrShift.find({
        employeeId,
        date: { $gte: startD, $lte: endD },
      }).lean(),
    ]);

    const attMap = new Map();
    attendanceRecords.forEach((att) => {
      attMap.set(att.date, att);
    });

    const shiftMap = new Map();
    shifts.forEach((s) => {
      shiftMap.set(s.date, s);
    });

    const leaveDates = new Set();
    leaveRecords.forEach((lr) => {
      const cur = new Date(`${lr.fromDate}T00:00:00`);
      const to = new Date(`${lr.toDate}T00:00:00`);
      while (cur <= to) {
        leaveDates.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    });

    let totalMinutesWorked = 0;
    let presentDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let weekendDays = 0;
    let staffAppPunches = 0;

    const dayNameFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

    const timeline = reportDays.map((dStr) => {
      const dObj = new Date(`${dStr}T00:00:00`);
      const dayOfWeek = dObj.getDay();
      const isWeekend = dayOfWeek === 0;
      const dayName = dayNameFormatter.format(dObj);
      const att = attMap.get(dStr);
      const onLeave = leaveDates.has(dStr);
      const shift = shiftMap.get(dStr) || null;

      let status = "absent";
      let durationMinutes = 0;
      let clockIn = null;
      let clockOut = null;
      let source = "none";
      let notes = "";

      if (att) {
        status = att.clockOut ? "present" : "active";
        clockIn = att.clockIn;
        clockOut = att.clockOut;
        notes = att.notes || "";
        source = att.source || (notes.includes("Mobile App") ? "staff_app" : "staff_app");

        const start = clockIn ? new Date(clockIn).getTime() : 0;
        const end = clockOut ? new Date(clockOut).getTime() : (dStr === todayStr ? Date.now() : start);
        durationMinutes = start > 0 ? Math.max(0, Math.round((end - start) / 60000)) : 0;

        totalMinutesWorked += durationMinutes;
        presentDays += 1;
        if (source === "staff_app") staffAppPunches += 1;
      } else if (onLeave) {
        status = "on_leave";
        leaveDays += 1;
      } else if (isWeekend) {
        status = "off";
        weekendDays += 1;
      } else {
        if (dStr <= todayStr) {
          status = "absent";
          absentDays += 1;
        } else {
          status = "upcoming";
        }
      }

      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      const durationFormatted = durationMinutes > 0 ? `${hours}h ${mins}m` : "—";

      return {
        date: dStr,
        dayName,
        isWeekend,
        isToday: dStr === todayStr,
        status,
        clockIn,
        clockOut,
        durationMinutes,
        durationFormatted,
        source,
        notes,
        shift,
      };
    });

    const workingDaysCount = Math.max(1, presentDays + absentDays);
    const attendancePercentage = Number(((presentDays / workingDaysCount) * 100).toFixed(1));
    const totalHours = Number((totalMinutesWorked / 60).toFixed(1));
    const avgDailyHours = presentDays > 0 ? Number((totalHours / presentDays).toFixed(1)) : 0;

    return ok(res, {
      person,
      filterType,
      dateRange: { start: startD, end: endD },
      stats: {
        totalDays: reportDays.length,
        presentDays,
        leaveDays,
        absentDays,
        weekendDays,
        totalHours,
        totalMinutesWorked,
        avgDailyHours,
        attendancePercentage,
        staffAppPunches,
      },
      timeline,
    });
  } catch (error) {
    next(error);
  }
}

export async function markManualAttendance(req, res, next) {
  try {
    const { employeeId, employeeType = "staff", name, role = "", date, clockIn, clockOut, notes = "", status = "present" } = req.body;
    if (!employeeId || !date) return fail(res, 400, "Employee ID and date are required");

    const cin = clockIn ? new Date(`${date}T${clockIn}`) : new Date(`${date}T09:00:00`);
    const cout = clockOut ? new Date(`${date}T${clockOut}`) : null;
    const durationMinutes = cout && cin ? Math.max(0, Math.round((cout.getTime() - cin.getTime()) / 60000)) : 0;

    let row = await HrAttendance.findOne({ employeeId, date });
    if (row) {
      row.clockIn = cin;
      row.clockOut = cout;
      row.notes = notes;
      row.status = status;
      row.source = "admin";
      row.workDurationMinutes = durationMinutes;
      await row.save();
    } else {
      row = await HrAttendance.create({
        employeeId,
        employeeType,
        name: name || "Staff Member",
        role,
        date,
        clockIn: cin,
        clockOut: cout,
        notes: notes || "Manual attendance recorded by HR",
        source: "admin",
        status,
        workDurationMinutes: durationMinutes,
      });
    }

    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function updateHrAttendance(req, res, next) {
  try {
    const { id } = req.params;
    const row = await HrAttendance.findById(id);
    if (!row) return fail(res, 404, "Attendance record not found");

    if (req.body.clockIn) row.clockIn = new Date(req.body.clockIn);
    if (req.body.clockOut !== undefined) {
      row.clockOut = req.body.clockOut ? new Date(req.body.clockOut) : null;
    }
    if (req.body.notes !== undefined) row.notes = req.body.notes;
    if (req.body.status) row.status = req.body.status;

    if (row.clockIn && row.clockOut) {
      row.workDurationMinutes = Math.max(0, Math.round((new Date(row.clockOut).getTime() - new Date(row.clockIn).getTime()) / 60000));
    }
    await row.save();
    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function deleteHrAttendance(req, res, next) {
  try {
    const { id } = req.params;
    await HrAttendance.findByIdAndDelete(id);
    return ok(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}


async function upsertEmployment(payload) {
  const employeeId = String(payload.employeeId || "").trim();
  const employeeType = String(payload.employeeType || "staff").trim();
  if (!employeeId || !HR_EMPLOYEE_TYPES.includes(employeeType)) {
    throw Object.assign(new Error("Employee is required"), { status: 400 });
  }
  const monthlySalary = Number(payload.monthlySalary ?? 0);
  const gross = Number.isFinite(monthlySalary) ? Math.max(0, monthlySalary) : 0;
  const salaryTax = Math.max(0, Number(payload.salaryTax ?? payload.tax ?? 0) || 0);
  const now = new Date();
  const update = {
    name: String(payload.name || "").trim(),
    department: String(payload.department || "").trim(),
    designation: String(payload.designation || payload.role || "").trim(),
    joiningDate: String(payload.joiningDate || "").trim(),
    salaryDate: String(payload.salaryDate || "").trim(),
    monthlySalary: gross,
    bankAccount: String(payload.bankAccount || "").trim(),
    ifsc: String(payload.ifsc || "").trim(),
    upi: String(payload.upi || "").trim(),
    workNotes: String(payload.workNotes ?? "").trim(),
    updatedAt: now,
  };
  if (payload.salaryTax !== undefined || payload.tax !== undefined) update.salaryTax = salaryTax;
  if (payload.workNotes === undefined) delete update.workNotes;
  await HrEmployment.collection.updateOne(
    { employeeId, employeeType },
    { $set: update, $setOnInsert: { employeeId, employeeType, createdAt: now } },
    { upsert: true }
  );
  return HrEmployment.collection.findOne({ employeeId, employeeType });
}

export async function upsertHrEmployment(req, res, next) {
  try {
    if (!(await canManageHrEmployee(req, req.body.employeeType || "staff", req.body.employeeId))) {
      return fail(res, 403, "This employee is not in your team");
    }
    const record = await upsertEmployment(req.body);
    return ok(res, record);
  } catch (error) {
    if (error.status) return fail(res, error.status, error.message);
    next(error);
  }
}

export async function listHrTasks(req, res, next) {
  try {
    const filter = {};
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    const rows = await HrTask.find(withHrScope(filter, await hrEmployeeFilter(req)))
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    return ok(res, rows, {
      stats: {
        open: rows.filter((row) => row.status === "open").length,
        in_progress: rows.filter((row) => row.status === "in_progress").length,
        done: rows.filter((row) => row.status === "done").length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createHrTask(req, res, next) {
  try {
    const title = String(req.body.title || "").trim();
    const employeeId = String(req.body.employeeId || "").trim();
    const name = String(req.body.name || "").trim();
    const employeeType = String(req.body.employeeType || "staff").trim();
    if (!title) return fail(res, 400, "Work title is required");
    if (!employeeId || !name) return fail(res, 400, "Assign this work to a person");
    if (!HR_EMPLOYEE_TYPES.includes(employeeType)) return fail(res, 400, "Invalid employee type");
    if (!(await canManageHrEmployee(req, employeeType, employeeId))) {
      return fail(res, 403, "This employee is not in your team");
    }
    const task = await HrTask.create({
      title,
      details: String(req.body.details || "").trim(),
      dueDate: String(req.body.dueDate || "").trim(),
      employeeId,
      employeeType,
      name,
      status: req.body.status === "in_progress" ? "in_progress" : "open",
    });
    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

export async function updateHrTask(req, res, next) {
  try {
    const task = await HrTask.findById(req.params.id);
    if (!task || !(await canManageHrEmployee(req, task.employeeType, task.employeeId))) {
      return fail(res, 404, "Work item not found");
    }
    ["title", "details", "dueDate", "status"].forEach((key) => {
      if (req.body[key] !== undefined) task[key] = req.body[key];
    });
    if (task.status && !["open", "in_progress", "done"].includes(task.status)) {
      return fail(res, 400, "Invalid work status");
    }
    await task.save();
    return ok(res, task);
  } catch (error) {
    next(error);
  }
}

export async function listHrPayroll(req, res, next) {
  try {
    const filter = {};
    if (req.query.month) filter.month = req.query.month;
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.roleKey && req.query.roleKey !== "all") filter.roleKey = req.query.roleKey;
    const rows = await HrPayroll.find(withHrScope(filter, await hrEmployeeFilter(req)))
      .sort({ month: -1, name: 1 })
      .lean();
    const pending = rows.filter((row) => row.status !== "paid");
    const paid = rows.filter((row) => row.status === "paid");
    return ok(res, rows, {
      stats: {
        count: rows.length,
        pendingCount: pending.length,
        paidCount: paid.length,
        pendingAmount: pending.reduce((sum, row) => sum + Number(row.net || 0), 0),
        paidAmount: paid.reduce((sum, row) => sum + Number(row.net || 0), 0),
        taxAmount: rows.reduce((sum, row) => sum + Number(row.tax || 0), 0),
        payruns: [...new Set(rows.map((row) => row.payrunId).filter(Boolean))],
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function runHrPayroll(req, res, next) {
  try {
    const month = String(req.body.month || currentPayrollMonth()).trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return fail(res, 400, "Use month as YYYY-MM");
    const { people } = await loadScopedHrPeople(req);
    const roleKey = String(req.body.roleKey || "").trim();
    const employeeId = String(req.body.employeeId || "").trim();
    const employeeType = String(req.body.employeeType || "").trim();
    let payable = people.filter((person) => person.isActive && Number(person.monthlySalary) > 0);
    if (roleKey) payable = payable.filter((person) => person.roleKey === roleKey);
    if (employeeId) {
      payable = people.filter((person) => person.id === employeeId && Number(person.monthlySalary) > 0);
      if (employeeType) payable = payable.filter((person) => person.employeeType === employeeType);
    }
    if (!payable.length) return fail(res, 400, "Set monthly salaries before generating payroll");
    const existing = await HrPayroll.find({ month }).lean();
    const seen = new Set(existing.map((row) => `${row.employeeType}:${row.employeeId}`));
    const payrunId = `PR-${month}-${Date.now().toString().slice(-6)}-${randomIdSuffix(2).toUpperCase()}`;
    const created = [];
    for (const person of payable) {
      const key = `${person.employeeType}:${person.id}`;
      if (seen.has(key)) continue;
      const gross = Number(person.monthlySalary);
      const tax = Math.min(gross, Math.max(0, Number(person.salaryTax || 0)));
      const net = Math.max(0, gross - tax);
      created.push(
        await HrPayroll.create({
          employeeId: person.id,
          employeeType: person.employeeType,
          name: person.name,
          role: person.role,
          roleKey: person.roleKey || "",
          month,
          gross,
          deductions: 0,
          tax,
          net,
          payrunId,
          status: "pending",
        })
      );
    }
    return ok(res, created, { month, payrunId, created: created.length, already: existing.length });
  } catch (error) {
    next(error);
  }
}

export async function updateHrPayroll(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return fail(res, 404, "Payroll row not found");
    }
    const objectId = new mongoose.Types.ObjectId(String(req.params.id));
    const row = await HrPayroll.collection.findOne({ _id: objectId });
    if (!row || !(await canManageHrEmployee(req, row.employeeType, row.employeeId))) {
      return fail(res, 404, "Payroll row not found");
    }
    const patch = {};
    if (req.body.deductions !== undefined) patch.deductions = Math.max(0, Number(req.body.deductions) || 0);
    if (req.body.gross !== undefined) patch.gross = Math.max(0, Number(req.body.gross) || 0);
    if (req.body.tax !== undefined) patch.tax = Math.max(0, Number(req.body.tax) || 0);
    const gross = patch.gross !== undefined ? patch.gross : Number(row.gross || 0);
    const deductions = patch.deductions !== undefined ? patch.deductions : Number(row.deductions || 0);
    const tax = patch.tax !== undefined ? patch.tax : Number(row.tax || 0);
    patch.net = Math.max(0, gross - deductions - tax);
    if (req.body.notes !== undefined) patch.notes = String(req.body.notes || "").trim();
    if (req.body.status === "paid" && row.status !== "paid") {
      patch.status = "paid";
      patch.paidAt = new Date();
      if (!isVendorScope(req)) await FinanceLedger.create({
        type: "payout",
        title: `Salary · ${row.name} · ${row.month}`,
        amount: patch.net,
        reference: String(row._id),
        notes: `${row.role || "Staff"} payroll`,
        date: new Date(),
      });
    } else if (req.body.status === "pending") {
      patch.status = "pending";
      patch.paidAt = null;
    }
    patch.updatedAt = new Date();
    await HrPayroll.collection.updateOne({ _id: objectId }, { $set: patch });
    return ok(res, await HrPayroll.collection.findOne({ _id: objectId }));
  } catch (error) {
    next(error);
  }
}

export async function listDeliveryOrders(req, res, next) {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    const orders = await StoreOrder.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("assignedRiderId", "name phone status currentLocation")
      .populate("managerId", "name storeName city area")
      .lean();
    const counts = await StoreOrder.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    return ok(res, orders, {
      stats: {
        total: orders.length,
        byStatus: Object.fromEntries(counts.map((row) => [row._id, row.count])),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function assignDeliveryOrder(req, res, next) {
  try {
    const order = await StoreOrder.findById(req.params.id);
    if (!order) return fail(res, 404, "Delivery order not found");
    const rider = await DeliveryBoy.findById(req.body.riderId);
    if (!rider) return fail(res, 404, "Delivery partner not found");
    order.assignedRiderId = rider._id;
    order.assignedAt = new Date();
    order.status = order.status === "incoming" || order.status === "order_received" ? "assigned" : order.status;
    order.assignmentStatus = "DRIVER_ASSIGNED";
    await order.save();
    rider.status = "on_delivery";
    await rider.save();
    return ok(res, order);
  } catch (error) {
    next(error);
  }
}

export async function updateDeliveryOrderStatus(req, res, next) {
  try {
    const status = String(req.body.status || "").trim();
    const result = await applyStoreOrderStatus({
      storeOrderId: req.params.id,
      status,
      skipCompletionGuards: true,
      restoreStockOnCancel: true,
      reason: String(req.body.reason || "").trim(),
      actor: {
        id: req.user?._id || req.user?.id || null,
        role: "admin",
        name: req.user?.name || req.user?.email || "Admin",
      },
    });
    if (!result.success) return fail(res, result.statusCode || 400, result.message);
    return ok(res, result.order, { message: result.message });
  } catch (error) {
    next(error);
  }
}

export async function listRidersLite(_req, res, next) {
  try {
    const riders = await DeliveryBoy.find()
      .select("-password -fcmToken")
      .populate("managerId", "name storeName city area phone")
      .sort({ name: 1 })
      .lean();
    return ok(
      res,
      riders.map((rider) => serializeDeliveryBoy(rider))
    );
  } catch (error) {
    next(error);
  }
}

export async function listDeliveryTracking(_req, res, next) {
  try {
    const riders = await DeliveryBoy.find()
      .select("-password -fcmToken")
      .populate("managerId", "name storeName city area")
      .sort({ status: 1, name: 1 })
      .lean();
    const data = riders.map((rider) => serializeDeliveryBoy(rider));
    return ok(res, data, {
      stats: {
        total: data.length,
        online: data.filter((r) => r.status === "online").length,
        onDelivery: data.filter((r) => r.status === "on_delivery").length,
        offline: data.filter((r) => r.status === "offline").length,
        withLocation: data.filter((r) => r.currentLocation?.lat && r.currentLocation?.lng).length,
        pendingVerification: data.filter((r) => r.verificationStatus === "pending").length,
      },
    });
  } catch (error) {
    next(error);
  }
}

function documentRows(docs = {}) {
  return Object.entries(docs || {}).map(([type, meta]) => ({
    type,
    url: meta?.url || "",
    status: meta?.status || "pending",
    capturedAt: meta?.capturedAt || null,
  }));
}

function serializeDeliveryManager(manager, extras = {}) {
  if (!manager) return null;
  return {
    id: String(manager._id),
    name: manager.name || manager.storeName || "Delivery manager",
    email: manager.email || "",
    phone: manager.phone || "",
    state: manager.state || "",
    city: manager.city || "",
    cityId: manager.cityId || "",
    area: manager.area || "",
    storeName: manager.storeName || `${manager.area || "Store"} Store`,
    storeAddress: manager.storeAddress || "",
    pincode: manager.pincode || "",
    latitude: manager.latitude ?? null,
    longitude: manager.longitude ?? null,
    deliveryRadiusKm: manager.deliveryRadiusKm ?? 5,
    geofenceRadius: manager.geofenceRadius ?? 500,
    vendorId: manager.vendorId || "",
    isActive: manager.isActive !== false,
    createdAt: manager.createdAt,
    updatedAt: manager.updatedAt,
    ...extras,
  };
}

function serializeDeliveryBoy(boy, extras = {}) {
  if (!boy) return null;
  const manager = boy.managerId && typeof boy.managerId === "object" && boy.managerId._id ? boy.managerId : null;
  return {
    id: String(boy._id),
    name: boy.name || "Delivery partner",
    phone: boy.phone || "",
    language: boy.language || "en",
    city: boy.city || "",
    cityId: boy.cityId || "",
    area: boy.area || "",
    storeId: boy.storeId || (manager ? String(manager._id) : ""),
    vendorId: boy.vendorId || (manager?.vendorId ? String(manager.vendorId) : ""),
    vehicleType: boy.vehicleType || "",
    rating: boy.rating ?? 5,
    totalRatingsCount: boy.totalRatingsCount || 0,
    status: boy.status || "offline",
    isActive: boy.isActive !== false,
    verificationStatus: boy.verificationStatus || "pending",
    verifiedAt: boy.verifiedAt || null,
    verificationNote: boy.verificationNote || "",
    onboardingComplete: Boolean(boy.onboardingComplete),
    onboardingStep: boy.onboardingStep || "",
    livenessPassed: Boolean(boy.livenessPassed),
    lastSeenAt: boy.lastSeenAt,
    lastOnlineAt: boy.lastOnlineAt,
    lastOfflineAt: boy.lastOfflineAt,
    currentLocation: boy.currentLocation?.lat != null && boy.currentLocation?.lng != null ? boy.currentLocation : null,
    todayOnlineMinutes: boy.todayOnlineMinutes || 0,
    todayCompletedOrders: boy.todayCompletedOrders || 0,
    todayOrderCount: boy.todayOrderCount || boy.todayCompletedOrders || 0,
    todayEarnings: boy.todayEarnings || 0,
    walletBalance: boy.walletBalance || 0,
    totalLifetimeEarnings: boy.totalLifetimeEarnings || 0,
    lastOrderAssignedAt: boy.lastOrderAssignedAt || boy.lastAssignedAt || null,
    lastOrderCompletedAt: boy.lastOrderCompletedAt || null,
    activeOrderId: boy.activeOrderId ? String(boy.activeOrderId) : null,
    bankDetails: boy.bankDetails || {},
    selfie: boy.selfie || {},
    documents: documentRows(boy.documents),
    manager: manager
      ? {
          id: String(manager._id),
          name: manager.name || "",
          storeName: manager.storeName || "",
          area: manager.area || "",
          city: manager.city || "",
          phone: manager.phone || "",
        }
      : null,
    createdAt: boy.createdAt,
    updatedAt: boy.updatedAt,
    ...extras,
  };
}

function orderLite(order) {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    status: order.status,
    assignmentStatus: order.assignmentStatus,
    area: order.area,
    city: order.city,
    assignedAt: order.assignedAt,
    deliveredAt: order.deliveredAt,
    createdAt: order.createdAt,
  };
}

export async function listDeliveryTeam(_req, res, next) {
  try {
    const [managers, boys, boyOrders, managerOrders] = await Promise.all([
      DeliveryManager.find().select("-password").sort({ createdAt: -1 }).lean(),
      DeliveryBoy.find().select("-password -fcmToken").populate("managerId", "name storeName city area phone email").sort({ createdAt: -1 }).lean(),
      StoreOrder.aggregate([
        { $match: { assignedRiderId: { $ne: null } } },
        { $group: { _id: "$assignedRiderId", total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } } } },
      ]),
      StoreOrder.aggregate([
        { $group: { _id: "$managerId", total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } } } },
      ]),
    ]);
    const boyStats = Object.fromEntries(boyOrders.map((row) => [String(row._id), row]));
    const managerStats = Object.fromEntries(managerOrders.map((row) => [String(row._id), row]));
    const boysByManager = {};
    for (const boy of boys) {
      const key = boy.managerId?._id ? String(boy.managerId._id) : "unassigned";
      boysByManager[key] = (boysByManager[key] || 0) + 1;
    }
    const managerItems = managers.map((manager) =>
      serializeDeliveryManager(manager, {
        riderCount: boysByManager[String(manager._id)] || 0,
        orderCount: managerStats[String(manager._id)]?.total || 0,
        deliveredCount: managerStats[String(manager._id)]?.delivered || 0,
      })
    );
    const boyItems = boys.map((boy) =>
      serializeDeliveryBoy(boy, {
        orderCount: boyStats[String(boy._id)]?.total || 0,
        deliveredCount: boyStats[String(boy._id)]?.delivered || 0,
      })
    );
    return ok(res, { managers: managerItems, boys: boyItems }, {
      stats: {
        managers: managerItems.length,
        activeManagers: managerItems.filter((m) => m.isActive).length,
        boys: boyItems.length,
        online: boyItems.filter((b) => b.status === "online").length,
        onDelivery: boyItems.filter((b) => b.status === "on_delivery").length,
        pendingVerification: boyItems.filter((b) => b.verificationStatus === "pending").length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDeliveryManagerAdmin(req, res, next) {
  try {
    const manager = await DeliveryManager.findById(req.params.id).select("-password").lean();
    if (!manager) return fail(res, 404, "Delivery manager not found");
    const [boys, orders] = await Promise.all([
      DeliveryBoy.find({ managerId: manager._id }).select("-password -fcmToken").sort({ createdAt: -1 }).lean(),
      StoreOrder.find({ managerId: manager._id }).sort({ createdAt: -1 }).limit(40).lean(),
    ]);
    return ok(res, {
      manager: serializeDeliveryManager(manager, {
        riderCount: boys.length,
        orderCount: orders.length,
      }),
      riders: boys.map((boy) => serializeDeliveryBoy({ ...boy, managerId: manager })),
      orders: orders.map(orderLite),
    });
  } catch (error) {
    next(error);
  }
}

export async function getDeliveryBoyAdmin(req, res, next) {
  try {
    const boy = await DeliveryBoy.findById(req.params.id)
      .select("-password -fcmToken")
      .populate("managerId", "name storeName city area phone email storeAddress pincode")
      .lean();
    if (!boy) return fail(res, 404, "Delivery partner not found");
    const orders = await StoreOrder.find({ assignedRiderId: boy._id }).sort({ createdAt: -1 }).limit(40).lean();
    return ok(res, {
      rider: serializeDeliveryBoy(boy, {
        orderCount: orders.length,
        deliveredCount: orders.filter((o) => o.status === "delivered").length,
      }),
      manager: serializeDeliveryManager(boy.managerId && boy.managerId._id ? boy.managerId : null),
      orders: orders.map(orderLite),
    });
  } catch (error) {
    next(error);
  }
}

export async function listSupportRoles(req, res, next) {
  try {
    // Treat legacy tickets (no roleKey) as customer
    await SupportMessage.updateMany(
      { $or: [{ roleKey: { $exists: false } }, { roleKey: null }, { roleKey: "" }] },
      { $set: { roleKey: "customer" } }
    );

    const grouped = await SupportMessage.aggregate([
      { $match: { roleKey: { $in: SUPPORT_ROLE_KEYS } } },
      {
        $group: {
          _id: "$roleKey",
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
          updatedAt: { $max: "$updatedAt" },
        },
      },
    ]);

    const byRole = Object.fromEntries(grouped.map((g) => [g._id, g]));
    const data = SUPPORT_ROLE_KEYS.map((roleKey) => {
      const stats = byRole[roleKey] || {};
      return {
        roleKey,
        label: supportRoleLabel(roleKey),
        total: stats.total || 0,
        open: stats.open || 0,
        resolved: stats.resolved || 0,
        updatedAt: stats.updatedAt || null,
      };
    });

    return ok(res, data, { count: data.length });
  } catch (error) {
    next(error);
  }
}

export async function listStoreSupport(req, res, next) {
  try {
    // Roles overview via existing /support path (avoids stale-route 404s)
    if (String(req.query.overview || "").trim().toLowerCase() === "roles") {
      return listSupportRoles(req, res, next);
    }

    const filter = {};
    const status = String(req.query.status || "all").trim().toLowerCase();
    const roleRaw = String(req.query.roleKey || req.query.role || "all").trim().toLowerCase();

    if (status && status !== "all") {
      if (!["open", "resolved"].includes(status)) return fail(res, 400, "Invalid status");
      filter.status = status;
    }

    let roleMeta = null;
    if (roleRaw && roleRaw !== "all") {
      const roleKey = SUPPORT_ROLE_KEYS.includes(roleRaw) ? roleRaw : null;
      if (!roleKey) return fail(res, 400, "Invalid role");
      filter.roleKey = roleKey;
      roleMeta = { roleKey, label: supportRoleLabel(roleKey) };
    }

    const q = String(req.query.q || "").trim();
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: rx },
        { email: rx },
        { phone: rx },
        { orderId: rx },
        { message: rx },
      ];
    }

    const issueTypeRaw = String(req.query.issueType || "").trim();
    if (issueTypeRaw && issueTypeRaw !== "all") {
      const types = issueTypeRaw.split(",").map((t) => t.trim()).filter(Boolean);
      filter.issueType = types.length === 1 ? types[0] : { $in: types };
    }

    if (req.query.hasAttachment === "true" || req.query.hasAttachment === true) {
      filter["attachments.0"] = { $exists: true };
    }

    const dateRange = String(req.query.dateRange || "").trim().toLowerCase();
    if (dateRange === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      filter.createdAt = { $gte: start };
    } else if (dateRange === "7d") {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: start };
    } else if (dateRange === "30d") {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: start };
    }

    const tickets = await SupportMessage.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    return ok(res, tickets, {
      role: roleMeta,
      stats: {
        total: tickets.length,
        open: tickets.filter((t) => t.status === "open").length,
        resolved: tickets.filter((t) => t.status === "resolved").length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listSupportUserHistory(req, res, next) {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    const phone = String(req.query.phone || "").trim().replace(/\D/g, "");
    const userId = String(req.query.userId || req.query.user || "").trim();
    const excludeId = String(req.query.excludeId || "").trim();

    const or = [];
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      or.push({ user: new mongoose.Types.ObjectId(userId) });
    }
    if (email) or.push({ email });
    if (phone.length >= 10) {
      const last10 = phone.slice(-10);
      or.push({ phone: { $regex: `${last10}$` } });
    }

    if (!or.length) {
      return fail(res, 400, "Provide email, phone, or userId to load history");
    }

    const filter = { $or: or };
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const tickets = await SupportMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return ok(res, tickets, {
      count: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStoreSupport(req, res, next) {
  try {
    const ticket = await SupportMessage.findById(req.params.id);
    if (!ticket) return fail(res, 404, "Support ticket not found");
    if (req.body.status && ["open", "resolved"].includes(req.body.status)) {
      ticket.status = req.body.status;
    }
    if (req.body.adminNote !== undefined) ticket.adminNote = String(req.body.adminNote);
    await ticket.save();
    return ok(res, ticket);
  } catch (error) {
    next(error);
  }
}
