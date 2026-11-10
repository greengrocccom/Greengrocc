import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  sendFarmerOtp,
  resendFarmerOtp,
  verifyOtp,
  normalizeIndianPhone,
  sendCommonOtp,
  MSG91_TEMPLATES,
  isPhoneOtpVerified,
  consumeVerifiedPhone,
} from "@greengrocc/shared";
import { isS3Configured, presignUpload } from "../../legacy/utils/s3Upload.js";
import { randomIdSuffix, serialId, timestampId } from "../../shared/ids.js";

function farmerSku(farmerId) {
  return `FRM-${String(farmerId).slice(-4)}-${randomIdSuffix(4).toUpperCase()}`;
}
import {
  Vendor,
  Farmer,
  FarmerManager,
  FarmerProduct,
  FarmerStockHistory,
  FarmerOrder,
  FarmerEarning,
  FarmerDocument,
  FarmerHarvestOrder,
  ensureFarmerIndexes,
  FarmerCrop,
  FarmerCropPlan,
  CROP_STATUSES,
  Pickup,
  PickupDriver,
  CollectionCentre,
  QualityInspection,
  VendorProduct,
} from "./models.js";
import { isCropAvailableForVendor, vendorAvailableCrops } from "./vendorCropRequestControllers.js";
import {
  isStaffChange,
  pushFarmerAccountStatus,
  pushFarmerCropChange,
  pushFarmerDocumentReview,
  pushFarmerOrderChange,
  pushFarmerProductChange,
  pushFarmerProductReview,
  pushFarmerStockChange,
} from "./farmerPush.js";
import { ensurePickupForOrder, ensureCentreBusinessId, ensureDefaultCentre, createManagerBusinessId, formatFarmLocation, qrPayloadFor } from "./pickupControllers.js";
import { getIO } from "../../shared/socket.js";
import { generateId } from "../../erp-service/src/services/idGenerator.js";
import { categoryFromName, cropCodeFromName, varietyCodeFromName, farmerSerialFromId } from "../../erp-service/src/config/idRegistry.js";
import {
  assignFarmerBusinessId,
  ensureFarmForFarmer,
  syncFarmerCropToErp,
  syncFarmerProductToErp,
  ensureEntityQr,
  ensureSharedCropBusinessId,
  upgradeFarmerProductId,
  productIdFromCropId,
  cropIdHasVariety,
  productIdHasVariety,
} from "../../erp-service/src/services/farmerSync.js";
import { overlayQualityOnOrder, presentInspection } from "./qualityControllers.js";
import {
  FARMER_LIST_EXCLUDE,
  PICKUP_LIST_EXCLUDE,
  CROP_LIST_EXCLUDE,
  PRODUCT_LIST_EXCLUDE,
  INSPECTION_LIST_EXCLUDE,
} from "./listProjections.js";
import { PAGE_LIMITS, isPaginationRequested, getPageParams, paginatedResponse, containsRegex } from "./pagination.js";
import { buildVendorDashboard, LOW_STOCK_EXPR } from "./dashboardStats.js";
import { createMemoryCache } from "../../shared/cache/memoryCache.js";

const cropsCatalogCache = createMemoryCache({
  name: "crops-catalog",
  ttlMs: 60_000,
  collections: [FarmerCrop.collection.collectionName],
  maxEntries: 1,
});

const JWT_SECRET = process.env.JWT_SECRET || "greengroo-secret";
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}


function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

async function generateUniqueFarmerId() {
  for (let i = 0; i < 6; i++) {
    const id = `farmer-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const exists = await Farmer.exists({ id });
    if (!exists) return id;
  }
  return `farmer-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function isAdult(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob <= cutoff;
}

async function resolveReferralCode(code) {
  const referralCode = String(code || "").trim();
  if (!referralCode) return { referralCode: "", managerId: "", vendorId: "" };
  const manager = await FarmerManager.findOne({
    $or: [{ id: referralCode }, { mobile: referralCode }],
  })
    .select("id vendorId")
    .lean();
  return {
    referralCode,
    managerId: manager?.id || "",
    vendorId: manager?.vendorId || "",
  };
}

// ----------------------------------------------------
// REMOVE KNOWN DEMO RECORDS (no dummy seed)
// ----------------------------------------------------
export async function seedInitialData() {
  try {
    const dummyFarmerIds = ["farmer-1", "farmer-2", "farmer-3"];
    const dummyManagerIds = ["mgr-1", "mgr-2"];
    const dummyProductIds = ["fp-1", "fp-2", "fp-3"];
    const dummyOrderIds = ["fo-101", "fo-102"];
    const dummyEarningIds = ["earn-1", "earn-2"];
    const dummyStockIds = ["sh-1", "sh-2"];
    const dummyDocIds = [
      "doc-farmer-1-aadhaar",
      "doc-farmer-1-pan",
      "doc-farmer-1-bank",
      "doc-farmer-1-address",
    ];

    await Promise.all([
      Farmer.deleteMany({ id: { $in: dummyFarmerIds } }),
      FarmerManager.deleteMany({ id: { $in: dummyManagerIds } }),
      FarmerProduct.deleteMany({ id: { $in: dummyProductIds } }),
      FarmerOrder.deleteMany({ id: { $in: dummyOrderIds } }),
      FarmerEarning.deleteMany({ id: { $in: dummyEarningIds } }),
      FarmerStockHistory.deleteMany({ id: { $in: dummyStockIds } }),
      FarmerDocument.deleteMany({ id: { $in: dummyDocIds } }),
    ]);

    await Promise.all([
      FarmerProduct.deleteMany({ farmerId: { $in: dummyFarmerIds } }),
      FarmerOrder.deleteMany({ farmerId: { $in: dummyFarmerIds } }),
      FarmerEarning.deleteMany({ farmerId: { $in: dummyFarmerIds } }),
      FarmerStockHistory.deleteMany({ farmerId: { $in: dummyFarmerIds } }),
      FarmerDocument.deleteMany({ farmerId: { $in: dummyFarmerIds } }),
      FarmerHarvestOrder.deleteMany({ farmerId: { $in: dummyFarmerIds } }),
    ]);

    await FarmerDocument.deleteMany({
      $or: [
        { fileUrl: { $in: [null, ""] } },
        { fileUrl: { $exists: false } },
        {
          fileUrl: {
            $regex: "^https?://.*(dummy|sample|example\\.com|placeholder|unsplash\\.com|greengrocc\\.com/docs/verified_)",
            $options: "i",
          },
        },
      ],
    });

    ensureFarmerIndexes().catch(() => {});
  } catch (err) {
    console.error("Failed to clean dummy Farmer Manager data:", err);
  }
}

function toPlain(doc) {
  if (!doc) return doc;
  return doc.toObject ? doc.toObject() : { ...doc };
}

async function aggFarmerStats(farmerIds) {
  if (!farmerIds?.length) {
    return { productStats: new Map(), orderStats: new Map(), earningStats: new Map() };
  }

  const [products, orders, earnings] = await Promise.all([
    FarmerProduct.aggregate([
      { $match: { farmerId: { $in: farmerIds } } },
      { $group: { _id: "$farmerId", count: { $sum: 1 }, stock: { $sum: { $ifNull: ["$stock", 0] } } } },
    ]),
    FarmerOrder.aggregate([
      { $match: { farmerId: { $in: farmerIds } } },
      { $group: { _id: "$farmerId", count: { $sum: 1 } } },
    ]),
    FarmerEarning.aggregate([
      { $match: { farmerId: { $in: farmerIds } } },
      { $group: { _id: "$farmerId", total: { $sum: { $ifNull: ["$netEarnings", 0] } } } },
    ]),
  ]);

  return {
    productStats: new Map(products.map((r) => [r._id, { count: r.count, stock: r.stock }])),
    orderStats: new Map(orders.map((r) => [r._id, r.count])),
    earningStats: new Map(earnings.map((r) => [r._id, r.total])),
  };
}

function assignedFarmerQuery(req) {
  const query = { isDeleted: { $ne: true } };
  if (req.user?.role === "VENDOR") {
    query.vendorId = req.user.vendorId || req.user.id || "__NONE__";
  } else if (req.user?.role === "FARMER_MANAGER") {
    query.managerId = req.user.managerId || req.user.id || "__NONE__";
    if (req.user.vendorId) query.vendorId = req.user.vendorId;
  } else {
    query.managerId = req.user?.managerId || req.user?.id || "__NONE__";
    query.vendorId = req.user?.vendorId || "__NONE__";
  }
  return query;
}

function indexFarmersByIdentity(farmers) {
  const farmerMap = new Map();
  const ids = [];
  farmers.forEach((f) => {
    [f.id, f.farmerId, f.farmerCode].filter(Boolean).forEach((id) => {
      ids.push(id);
      farmerMap.set(id, f);
    });
  });
  return { ids: [...new Set(ids)], farmerMap };
}

function farmerIdentityIds(farmer, extraId) {
  return [...new Set([farmer?.id, farmer?.farmerId, farmer?.farmerCode, extraId].filter(Boolean))];
}

function accessibleFarmerQuery(req, farmerId) {
  const query = {
    isDeleted: { $ne: true },
    $or: [{ id: farmerId }, { farmerId: farmerId }, { farmerCode: farmerId }],
  };
  if (req.user?.role === "FARMER_MANAGER") {
    query.managerId = req.user.managerId || req.user.id || "__NONE__";
    query.vendorId = req.user.vendorId || "__NONE__";
  } else if (req.user?.role === "VENDOR") {
    query.vendorId = req.user.vendorId || req.user.id || "__NONE__";
  } else if (req.user?.role === "FARMER") {
    const authId = req.user.farmerId || req.user.id || "__NONE__";
    if (farmerId && farmerId !== authId && farmerId !== req.user.farmerId && farmerId !== req.user.id) {
      query.id = "__NONE__";
    } else {
      query.$or = [{ id: authId }, { farmerId: authId }, { farmerCode: authId }];
    }
    if (req.user.vendorId) {
      query.vendorId = req.user.vendorId;
    }
  }
  return query;
}

async function getAssignedFarmers(req, select = FARMER_LIST_EXCLUDE) {
  return Farmer.find(assignedFarmerQuery(req)).select(select).sort({ createdAt: -1 }).lean();
}

function enrichProductRow(p, farmerName = "") {
  const totalQty = p.grades?.reduce((s, g) => s + Number(g.quantity || 0), 0) || Number(p.stock || 0);
  const gradesSummary = p.grades?.map((g) => `${g.label} - ${g.quantity} ${p.unit || "Kg"}`).join(", ") || "";
  const displayPid = p.productId || p.id || "";
  return {
    ...p,
    id: p.id || displayPid,
    productId: displayPid,
    totalQuantity: totalQty,
    stock: totalQty,
    availableQuantity: totalQty,
    gradesSummary,
    farmerName: farmerName || p.farmerName || "",
  };
}

function lineProductId(p = {}) {
  const raw = String(p.productId || "").trim();
  if (raw && !/^[a-f0-9]{24}$/i.test(raw)) return raw;
  const id = String(p.id || "").trim();
  if (id && !/^[a-f0-9]{24}$/i.test(id)) return id;
  return raw || "";
}

function toISODate(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ORDER_STATUS_ALIASES = {
  NEW: "NEW",
  New: "NEW",
  ACCEPTED: "ACCEPTED",
  Accepted: "ACCEPTED",
  Confirmed: "NEW",
  Approved: "NEW",
  PREPARING: "PREPARING",
  Preparing: "PREPARING",
  Processing: "PREPARING",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  "Ready for Pickup": "READY_FOR_PICKUP",
  PACKING: "PACKING",
  Packing: "PACKING",
  DRIVER_ASSIGNED: "DRIVER_ASSIGNED",
  PICKUP_SCHEDULED: "DRIVER_ASSIGNED",
  DISPATCHED: "DISPATCHED",
  Dispatched: "DISPATCHED",
  DRIVER_ARRIVED: "DRIVER_ARRIVED",
  ARRIVED: "DRIVER_ARRIVED",
  ORDER_VERIFIED: "ORDER_VERIFIED",
  QR_VERIFIED: "QR_VERIFIED",
  PICKUP_CONFIRMED: "PICKED_UP",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED_AT_CENTRE: "ARRIVED_AT_CENTRE",
  COLLECTION_CENTRE_RECEIVED: "COLLECTION_CENTRE_RECEIVED",
  RECEIVED_AT_COLLECTION_CENTRE: "COLLECTION_CENTRE_RECEIVED",
  QUALITY_PENDING: "QUALITY_PENDING",
  INSPECTION: "INSPECTION",
  GRADING: "GRADING",
  GRADE_CONFIRMED: "GRADE_CONFIRMED",
  ORDER_COMPLETED: "ORDER_COMPLETED",
  COMPLETED: "COMPLETED",
  Completed: "COMPLETED",
  REJECTED: "REJECTED",
  Rejected: "REJECTED",
  CANCELLED: "CANCELLED",
  Cancelled: "CANCELLED",
};

const ORDER_FILTERS = {
  new: ["NEW"],
  preparing: ["ACCEPTED", "PREPARING", "PACKING"],
  ready: ["READY_FOR_PICKUP", "PICKUP_SCHEDULED", "DRIVER_ASSIGNED", "DISPATCHED", "DRIVER_ARRIVED", "ORDER_VERIFIED", "QR_VERIFIED"],
  completed: ["PICKUP_CONFIRMED", "PICKED_UP", "COMPLETED", "IN_TRANSIT", "ARRIVED_AT_CENTRE", "COLLECTION_CENTRE_RECEIVED", "RECEIVED_AT_COLLECTION_CENTRE", "QUALITY_PENDING", "INSPECTION", "GRADING", "GRADE_CONFIRMED", "ORDER_COMPLETED"],
  rejected: ["REJECTED", "CANCELLED"],
};

const REJECTION_REASONS = [
  "Stock Unavailable",
  "Product Unavailable",
  "Quality Issue",
  "Pickup Issue",
  "Quantity Issue",
  "Other",
];

function normalizeOrderStatus(status) {
  return ORDER_STATUS_ALIASES[status] || status || "NEW";
}

function withCanonicalOrderStatus(order) {
  return {
    ...order,
    status: normalizeOrderStatus(order.status),
    rejectionReason: order.rejectionReason || "",
    rejectionNote: order.rejectionNote || "",
    rejectedBy: order.rejectedBy || "",
    rejectedAt: order.rejectedAt || null,
  };
}

function mapFarmerOrdersToHarvest(farmerOrders) {
  return farmerOrders.map((o) => {
    const prods =
      o.products && o.products.length > 0
        ? o.products
        : [
            {
              name: o.productName || "Farm Fresh Produce",
              quantity: o.totalQuantity || 0,
              grade: o.grade || "Grade A",
              unit: o.unit || "Kg",
              productId: o.productId || "",
            },
          ];
    const first = prods[0] || {};
    const gradesList = Array.isArray(o.grades) && o.grades.length
      ? o.grades
      : prods.map((p) => ({
          name: p.grade || p.name || "Grade A",
          label: p.grade || p.name || "Grade A",
          quantity: Number(p.quantity || 0),
        }));
    const totalQuantity =
      Number(o.totalQuantity || 0) ||
      prods.reduce((sum, p) => sum + Number(p.quantity || 0), 0) ||
      gradesList.reduce((sum, g) => sum + Number(g.quantity || 0), 0);

    return {
      id: o.id || o.orderId || String(o._id),
      orderId: o.id || o.orderId,
      vendorId: o.vendorId,
      farmerId: o.farmerId,
      farmerName: o.farmerName || "",
      productId: o.productId || lineProductId(first),
      productName: o.productName || first.name || "Farm Fresh Produce",
      category: first.category || o.category || "Produce",
      date: toISODate(o.orderDate) || toISODate(o.harvestDate) || toISODate(o.date) || toISODate(o.createdAt),
      day: o.day || "",
      unit: o.unit || first.unit || "Kg",
      grades: gradesList,
      rejectionQty: Number(o.rejectionQty || 0),
      totalQuantity,
      totalAmount: Number(o.totalAmount || o.amount || 0),
      status: normalizeOrderStatus(o.status),
      rejectionReason: o.rejectionReason || "",
      rejectionNote: o.rejectionNote || "",
      rejectedBy: o.rejectedBy || "",
      rejectedAt: o.rejectedAt || null,
      createdAt: o.createdAt,
      products: o.products,
      harvestDate: o.harvestDate || o.date || "",
      amount: o.amount || o.totalAmount || o.orderValue || 0,
      orderDate: o.orderDate,
      requiredDate: o.requiredDate || o.pickupDate || "",
      pickupDate: o.pickupDate || o.requiredDate || "",
      pickupTime: o.pickupTime || o.harvestTime || "",
      harvestTime: o.harvestTime || o.pickupTime || "",
      paymentStatus: o.paymentStatus || o.paymentDetails?.paymentStatus || "Pending",
      paymentMethod: o.paymentMethod || o.paymentDetails?.paymentMethod || "",
      paymentDetails: o.paymentDetails || null,
      transactionId: o.transactionId || o.paymentDetails?.transactionId || "",
      paymentDate: o.paymentDate || o.paymentDetails?.paymentDate || "",
      variety: o.variety || first.variety || "",
      qualityStatus: o.qualityStatus || o.status || "",
      qualityGrading: o.qualityGrading || o.grading || null,
      qualityParameters: o.qualityParameters || null,
      qualityReport: o.qualityReport || null,
      notes: o.notes || o.paymentDetails?.notes || "",
    };
  });
}

function harvestOrderKeys(item) {
  return [...new Set([item?.id, item?.orderId, item?._id ? String(item._id) : ""].filter(Boolean).map(String))];
}

function isOrderPaidString(val) {
  if (!val) return false;
  const s = String(val).toUpperCase().trim();
  return (
    s === "PAID" ||
    s === "PAYMENT_COMPLETED" ||
    s === "PAYMENT COMPLETED" ||
    s === "COMPLETED" ||
    s === "PAYMENT RECEIVED" ||
    s === "PAID_ONLINE" ||
    s === "PAID_10" ||
    s === "PAID ONLINE" ||
    s === "SETTLED" ||
    s.startsWith("PAID") ||
    s.includes("PAYMENT COMPLETED") ||
    s.includes("PAYMENT_COMPLETED")
  );
}

const DELETED_ORDER_STATUS_RX = /^\s*(DELETED|CANCELLED|CANCELED|DELETED_ORDER)\s*$/i;

function isOrderDeleted(item) {
  if (!item) return true;
  if (item.isDeleted === true || item.deleted === true) return true;
  const s = String(item.status || "").trim().toUpperCase();
  if (s === "DELETED" || s === "CANCELLED" || s === "CANCELED" || s === "DELETED_ORDER") return true;
  return false;
}

function mergeHarvestLists(harvestOrders, mappedFarmerOrders) {
  const idMap = new Map();
  const remember = (item) => {
    if (!item || isOrderDeleted(item)) return;
    const itemKeys = harvestOrderKeys(item);
    if (!itemKeys.length) return;

    let existing = null;
    for (const key of itemKeys) {
      if (idMap.has(key)) {
        existing = idMap.get(key);
        break;
      }
    }

    if (!existing) {
      itemKeys.forEach((key) => idMap.set(key, item));
    } else {
      const isPrevPaid =
        isOrderPaidString(existing.paymentStatus) ||
        isOrderPaidString(existing.paymentDetails?.paymentStatus) ||
        isOrderPaidString(existing.paymentDetails?.status);
      const isItemPaid =
        isOrderPaidString(item.paymentStatus) ||
        isOrderPaidString(item.paymentDetails?.paymentStatus) ||
        isOrderPaidString(item.paymentDetails?.status);
      const resolvedPaymentStatus = isPrevPaid || isItemPaid
        ? "Paid"
        : (item.paymentStatus || existing.paymentStatus || "Pending");

      const merged = {
        ...existing,
        ...item,
        paymentStatus: resolvedPaymentStatus,
        paymentDetails: item.paymentDetails || existing.paymentDetails || null,
        paymentMethod: item.paymentMethod || existing.paymentMethod || "",
        transactionId: item.transactionId || existing.transactionId || "",
        paymentDate: item.paymentDate || existing.paymentDate || "",
        variety: item.variety || existing.variety || "",
        qualityStatus: item.qualityStatus || existing.qualityStatus || item.status || existing.status,
        qualityGrading: item.qualityGrading || existing.qualityGrading || null,
        status: normalizeOrderStatus(item.status || existing.status),
      };
      const allKeys = [...new Set([...harvestOrderKeys(existing), ...itemKeys])];
      allKeys.forEach((k) => idMap.set(k, merged));
    }
  };

  harvestOrders.forEach((item) => remember({ ...item, status: normalizeOrderStatus(item.status) }));
  mappedFarmerOrders.forEach((item) => remember(item));

  const seen = new Set();
  const merged = [];
  idMap.forEach((item) => {
    if (isOrderDeleted(item)) return;
    const keys = harvestOrderKeys(item);
    if (!keys.length || keys.some((k) => seen.has(k))) return;
    keys.forEach((k) => seen.add(k));
    merged.push(item);
  });
  return merged.sort(
    (a, b) => new Date(b.date || b.orderDate || b.createdAt || 0) - new Date(a.date || a.orderDate || a.createdAt || 0)
  );
}

// Helper to enrich a single farmer object with calculated stats
async function enrichFarmerDoc(farmerDoc) {
  const f = toPlain(farmerDoc);
  const farmerId = f.id;

  const [manager, vendor, stats] = await Promise.all([
    f.managerId ? FarmerManager.findOne({ id: f.managerId }).select("name").lean() : null,
    f.vendorId
      ? Vendor.findOne({ $or: [{ id: f.vendorId }, { vendorId: f.vendorId }] })
          .select("id vendorId vendorName ownerName mobile phone businessName")
          .lean()
      : null,
    aggFarmerStats([farmerId]),
  ]);

  const pStat = stats.productStats.get(farmerId) || { count: 0, stock: 0 };
  delete f.password;

  return {
    ...f,
    farmerId: f.farmerId || f.id,
    loginEnabled: f.loginEnabled !== false,
    managerName: manager?.name || "—",
    vendorName: vendor?.vendorName || vendor?.businessName || vendor?.ownerName || "—",
    vendorMobile: vendor?.mobile || vendor?.phone || "",
    vendorBusinessName: vendor?.businessName || "",
    initials: initials(f.name),
    totalProducts: pStat.count,
    totalStock: pStat.stock,
    totalInventory: pStat.stock,
    totalOrders: stats.orderStats.get(farmerId) || 0,
    totalEarnings: stats.earningStats.get(farmerId) || 0,
  };
}

// Batch helper: 3 aggregations + 1 manager lookup + 1 vendor lookup instead of loading every related document
async function enrichFarmerDocsBatch(farmerDocs) {
  if (!farmerDocs || !farmerDocs.length) return [];

  const rawFarmers = farmerDocs.map(toPlain);
  const farmerIds = rawFarmers.map((f) => f.id).filter(Boolean);
  const managerIds = Array.from(new Set(rawFarmers.map((f) => f.managerId).filter(Boolean)));
  const vendorIds = Array.from(new Set(rawFarmers.map((f) => f.vendorId).filter(Boolean)));

  const [managers, vendors, stats] = await Promise.all([
    managerIds.length ? FarmerManager.find({ id: { $in: managerIds } }).select("id name").lean() : [],
    vendorIds.length
      ? Vendor.find({ $or: [{ id: { $in: vendorIds } }, { vendorId: { $in: vendorIds } }] })
          .select("id vendorId vendorName ownerName mobile phone businessName")
          .lean()
      : [],
    aggFarmerStats(farmerIds),
  ]);

  const managerMap = new Map(managers.map((m) => [m.id, m.name]));
  const vendorMap = new Map();
  vendors.forEach((v) => {
    if (v.id) vendorMap.set(String(v.id), v);
    if (v.vendorId) vendorMap.set(String(v.vendorId), v);
  });

  return rawFarmers.map((f) => {
    delete f.password;
    const pStat = stats.productStats.get(f.id) || { count: 0, stock: 0 };
    const v = f.vendorId ? vendorMap.get(String(f.vendorId)) : null;
    return {
      ...f,
      farmerId: f.farmerId || f.id,
      loginEnabled: f.loginEnabled !== false,
      managerName: managerMap.get(f.managerId) || "—",
      vendorName: v?.vendorName || v?.businessName || v?.ownerName || "—",
      vendorMobile: v?.mobile || v?.phone || "",
      vendorBusinessName: v?.businessName || "",
      initials: initials(f.name),
      totalProducts: pStat.count,
      totalStock: pStat.stock,
      totalInventory: pStat.stock,
      totalOrders: stats.orderStats.get(f.id) || 0,
      totalEarnings: stats.earningStats.get(f.id) || 0,
    };
  });
}

// ----------------------------------------------------
// FARMER CONTROLLERS
// ----------------------------------------------------
export async function getFarmers(req, res) {
  try {
    const { q = "", status = "", location = "" } = req.query;
    let managerId = req.query.managerId || "";

    let vendorId = "";
    if (req.user?.role === "VENDOR") {
      vendorId = req.user.vendorId || req.user.id || "";
      if (!vendorId) return res.json(isPaginationRequested(req.query) ? paginatedResponse([], 0, 1, 10) : []);
    } else if (req.user?.role === "FARMER_MANAGER") {
      vendorId = req.user.vendorId || "";
      managerId = req.user.managerId || req.user.id || "";
      if (!vendorId || !managerId) return res.json(isPaginationRequested(req.query) ? paginatedResponse([], 0, 1, 10) : []);
    } else if (req.user?.role === "FARMER") {
      const myId = req.user.farmerId || req.user.id || "__NONE__";
      const farmerDoc = await Farmer.findOne({
        isDeleted: { $ne: true },
        $or: [{ id: myId }, { farmerId: myId }, { farmerCode: myId }],
      }).select(FARMER_LIST_EXCLUDE).lean();
      if (!farmerDoc) return res.json(isPaginationRequested(req.query) ? paginatedResponse([], 0, 1, 10) : []);
      const enriched = await enrichFarmerDocsBatch([farmerDoc]);
      return res.json(isPaginationRequested(req.query) ? paginatedResponse(enriched, 1, 1, 10) : enriched);
    } else {
      vendorId = req.query.vendorId || "";
    }

    const query = { isDeleted: { $ne: true } };
    if (vendorId) {
      query.vendorId = vendorId;
    } else if (req.user?.role !== "ADMIN") {
      return res.json(isPaginationRequested(req.query) ? paginatedResponse([], 0, 1, 10) : []);
    }
    if (status) query.status = status;
    if (managerId) query.managerId = managerId;
    if (location) query.farmLocation = { $regex: location, $options: "i" };

    if (isPaginationRequested(req.query)) {
      const { page, limit, skip } = getPageParams(req.query, PAGE_LIMITS.farmers);
      const needle = q.trim();
      if (needle) {
        const rx = containsRegex(needle);
        const managerQuery = { name: rx };
        if (vendorId) managerQuery.vendorId = vendorId;
        const matchingManagers = await FarmerManager.find(managerQuery).select("id").lean();
        query.$or = [{ name: rx }, { mobile: rx }, { farmName: rx }, { farmerCode: rx }];
        if (matchingManagers.length) query.$or.push({ managerId: { $in: matchingManagers.map((m) => m.id) } });
      }
      const [total, pageDocs] = await Promise.all([
        Farmer.countDocuments(query),
        Farmer.find(query).select(FARMER_LIST_EXCLUDE).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      ]);
      return res.json(paginatedResponse(await enrichFarmerDocsBatch(pageDocs), total, page, limit));
    }

    let farmerDocs = await Farmer.find(query).select(FARMER_LIST_EXCLUDE).sort({ createdAt: -1 }).lean();

    let enriched = await enrichFarmerDocsBatch(farmerDocs);

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      enriched = enriched.filter(
        (f) =>
          f.name.toLowerCase().includes(needle) ||
          f.managerName.toLowerCase().includes(needle) ||
          f.mobile.includes(needle) ||
          f.farmName.toLowerCase().includes(needle) ||
          (f.farmerCode && f.farmerCode.toLowerCase().includes(needle))
      );
    }

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch farmers" });
  }
}

export async function getFarmerById(req, res) {
  try {
    const { farmerId } = req.params;
    const query = accessibleFarmerQuery(req, farmerId);
    const farmer = await Farmer.findOne(query);
    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found" });
    }
    const enriched = await enrichFarmerDoc(farmer);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch farmer" });
  }
}

export async function createFarmer(req, res) {
  try {
    const payload = req.body;
    let vendorId = payload.vendorId || "";
    if (req.user?.role === "VENDOR") {
      vendorId = req.user.vendorId || req.user.id || "";
    } else if (req.user?.role === "FARMER_MANAGER") {
      vendorId = req.user.vendorId || "";
    }
    const managerId =
      req.user?.role === "FARMER_MANAGER"
        ? req.user.managerId
        : payload.managerId || "";

    if (!payload.name || !payload.mobile) {
      return res.status(400).json({ success: false, message: "Farmer name and mobile are required" });
    }

    const cleanMobile = String(payload.mobile).trim();
    const existing = await Farmer.findOne({ mobile: cleanMobile });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Farmer with this mobile number already exists.",
      });
    }

    const rawPassword = payload.password || "123456";
    if (String(rawPassword).length < 4) {
      return res.status(400).json({ success: false, message: "Password must be at least 4 characters long" });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const { farmerId: businessId, loc } = await assignFarmerBusinessId({
      state: payload.state || payload.address?.state || "Maharashtra",
      district: payload.district || payload.address?.district || "",
      taluka: payload.taluka || payload.address?.taluka || "",
      village: payload.village || payload.address?.village || "",
    });
    const id = businessId;
    const farmerCode = businessId;

    const farmer = new Farmer({
      id,
      farmerId: businessId,
      farmerCode,
      companyId: "GGC",
      stateId: loc.stateId,
      districtId: loc.districtId,
      talukaId: loc.talukaId,
      villageId: loc.villageId,
      vendorId,
      managerId,
      name: payload.name.trim(),
      mobile: cleanMobile,
      email: payload.email || "",
      password: hashedPassword,
      loginEnabled: payload.loginEnabled !== false,
      profileImage: payload.profileImage || "",
      farmName: payload.farmName || "",
      farmLocation: payload.farmLocation || "",
      farmAddress: payload.farmAddress || "",
      farmArea: payload.farmArea || "",
      farmType: payload.farmType || "Organic",
      address: payload.address || {},
      status: payload.status || "Active",
      verificationStatus: payload.verificationStatus || "Approved",
      verificationRequired: false,
      bank: {
        accountHolder: payload.bank?.accountHolder || payload.name,
        bankName: payload.bank?.bankName || "",
        accountNumber: payload.bank?.accountNumber || "",
        ifsc: payload.bank?.ifsc || "",
      },
    });

    await farmer.save();
    await ensureFarmForFarmer(farmer, loc);
    await farmer.save();
    await ensureEntityQr({
      entityType: "FARMER",
      entityId: farmer.farmerId || farmer.id,
      links: { farmerId: farmer.farmerId || farmer.id, farmId: farmer.farm?.farmId || "" },
    });

    const enriched = await enrichFarmerDoc(farmer);
    res.status(201).json(enriched);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to create farmer" });
  }
}

export async function updateFarmer(req, res) {
  try {
    const { farmerId } = req.params;
    const payload = req.body;

    const query = accessibleFarmerQuery(req, farmerId);
    const farmer = await Farmer.findOne(query);
    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found" });
    }

    if (payload.name) farmer.name = payload.name;
    if (payload.mobile) farmer.mobile = payload.mobile;
    if (payload.email !== undefined) farmer.email = payload.email;
    if (payload.farmName !== undefined) farmer.farmName = payload.farmName;
    if (payload.farmLocation !== undefined) farmer.farmLocation = payload.farmLocation;
    if (payload.farmAddress !== undefined) farmer.farmAddress = payload.farmAddress;
    if (payload.farmArea !== undefined) farmer.farmArea = payload.farmArea;
    if (payload.farmType !== undefined) farmer.farmType = payload.farmType;
    if (payload.status) farmer.status = payload.status;
    if (payload.verificationStatus) farmer.verificationStatus = payload.verificationStatus;
    if (payload.vendorId !== undefined) farmer.vendorId = payload.vendorId;
    if (payload.managerId !== undefined) farmer.managerId = payload.managerId;
    if (payload.profileImage !== undefined) farmer.profileImage = payload.profileImage;

    if (payload.address) {
      farmer.address = { ...farmer.address, ...payload.address };
    }
    if (payload.bank) {
      farmer.bank = { ...farmer.bank, ...payload.bank };
    }

    await farmer.save();

    const updateFields = {};
    if (payload.managerId !== undefined) updateFields.managerId = payload.managerId;
    if (payload.vendorId !== undefined) updateFields.vendorId = payload.vendorId;

    if (Object.keys(updateFields).length > 0) {
      const ownerKeys = [farmer.id, farmer.farmerId, farmer.farmerCode].filter(Boolean);
      await Promise.all([
        FarmerProduct.updateMany({ farmerId: { $in: ownerKeys } }, { $set: updateFields }).catch(() => {}),
        FarmerDocument.updateMany({ farmerId: { $in: ownerKeys } }, { $set: updateFields }).catch(() => {}),
      ]);
    }

    const enriched = await enrichFarmerDoc(farmer);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update farmer" });
  }
}

export async function deleteFarmer(req, res) {
  try {
    const { farmerId } = req.params;
    const query = accessibleFarmerQuery(req, farmerId);
    const farmer = await Farmer.findOne(query);
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const targetFarmerId = farmer.id;
    await Farmer.deleteOne({ id: targetFarmerId });
    await FarmerProduct.deleteMany({ farmerId: targetFarmerId });
    await FarmerOrder.deleteMany({ farmerId: targetFarmerId });
    await FarmerEarning.deleteMany({ farmerId: targetFarmerId });
    await FarmerDocument.deleteMany({ farmerId: targetFarmerId });
    await FarmerStockHistory.deleteMany({ farmerId: targetFarmerId });
    res.json({ success: true, message: "Farmer deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete farmer" });
  }
}

export async function setFarmerStatus(req, res) {
  try {
    const { farmerId } = req.params;
    const { status } = req.body;
    const query = accessibleFarmerQuery(req, farmerId);
    const farmer = await Farmer.findOne(query);
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const previousStatus = farmer.status;
    farmer.status = status;
    await farmer.save();
    if (status && status !== previousStatus) pushFarmerAccountStatus(farmer);
    const enriched = await enrichFarmerDoc(farmer);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update status" });
  }
}

export async function sendFarmerOtpController(req, res) {
  try {
    const rawMobile = req.body.mobile || req.body.phone;
    const mobile = normalizeIndianPhone(rawMobile);
    const purpose = String(req.body.purpose || req.body.mode || "login").trim().toLowerCase();

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit mobile number is required",
      });
    }

    const isRegister = purpose === "register" || purpose === "signup";
    const farmer = await Farmer.findOne({ mobile });

    if (isRegister) {
      if (farmer) {
        return res.status(400).json({
          success: false,
          message: "A farmer account already exists with this mobile number. Please log in.",
        });
      }
    } else {
      if (!farmer) {
        return res.status(404).json({
          success: false,
          message: "No farmer account found with this mobile number. Please register first.",
        });
      }
      if (farmer.loginEnabled === false) {
        return res.status(403).json({
          success: false,
          message: "Farmer login is currently disabled. Please contact your manager.",
        });
      }
      if (farmer.status !== "Active") {
        return res.status(403).json({
          success: false,
          message: `Farmer account is currently ${farmer.status.toLowerCase()}. Please contact your manager.`,
        });
      }
    }

    const result = await sendFarmerOtp(mobile, isRegister ? "register" : "login");
    return res.json({
      success: true,
      message: result.message || "OTP sent successfully",
      mobile,
      purpose: isRegister ? "register" : "login",
      devMock: result.devMock,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to send farmer OTP" });
  }
}

export async function resendFarmerOtpController(req, res) {
  try {
    const rawMobile = req.body.mobile || req.body.phone;
    const mobile = normalizeIndianPhone(rawMobile);
    const purpose = String(req.body.purpose || req.body.mode || "login").trim().toLowerCase();

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit mobile number is required",
      });
    }

    const isRegister = purpose === "register" || purpose === "signup";
    const farmer = await Farmer.findOne({ mobile });

    if (isRegister) {
      if (farmer) {
        return res.status(400).json({
          success: false,
          message: "A farmer account already exists with this mobile number. Please log in.",
        });
      }
    } else {
      if (!farmer) {
        return res.status(404).json({
          success: false,
          message: "No farmer account found with this mobile number. Please register first.",
        });
      }
      if (farmer.loginEnabled === false) {
        return res.status(403).json({
          success: false,
          message: "Farmer login is currently disabled. Please contact your manager.",
        });
      }
      if (farmer.status !== "Active") {
        return res.status(403).json({
          success: false,
          message: `Farmer account is currently ${farmer.status.toLowerCase()}. Please contact your manager.`,
        });
      }
    }

    const result = await resendFarmerOtp(mobile, isRegister ? "register" : "login");
    return res.json({
      success: true,
      message: result.message || "OTP resent successfully",
      mobile,
      purpose: isRegister ? "register" : "login",
      devMock: result.devMock,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to resend farmer OTP" });
  }
}

export async function verifyFarmerOtpController(req, res) {
  try {
    const rawMobile = req.body.mobile || req.body.phone;
    const mobile = normalizeIndianPhone(rawMobile);
    const otp = String(req.body.otp || "").trim();
    const purpose = String(req.body.purpose || req.body.mode || "login").trim().toLowerCase();

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and OTP are required",
      });
    }

    const verification = await verifyOtp({ phone: mobile, otp, purpose });
    if (!verification.ok) {
      return res.status(400).json({
        success: false,
        message: verification.message || "Invalid OTP",
      });
    }

    const isRegister = purpose === "register" || purpose === "signup";
    if (isRegister) {
      return res.json({
        success: true,
        verified: true,
        mobile,
        message: "Mobile number verified successfully. You can complete registration.",
      });
    }

    const farmer = await Farmer.findOne({ mobile });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer account not found. Please register.",
      });
    }

    if (farmer.loginEnabled === false) {
      return res.status(403).json({
        success: false,
        message: "Farmer login is currently disabled. Please contact your manager.",
      });
    }

    if (farmer.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: `Farmer account is currently ${farmer.status.toLowerCase()}. Please contact your manager.`,
      });
    }

    const token = signToken({
      id: farmer.id,
      farmerId: farmer.id,
      vendorId: farmer.vendorId,
      managerId: farmer.managerId || "",
      role: "FARMER",
      name: farmer.name,
    });

    const enriched = await enrichFarmerDoc(farmer);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      farmer: enriched,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to verify farmer OTP" });
  }
}

export async function farmerLogin(req, res) {
  try {
    const { mobile, password, otp } = req.body;
    if (!mobile || (!password && !otp)) {
      return res.status(400).json({ success: false, message: "Mobile number and password or OTP are required" });
    }

    const cleanMobile = String(mobile).trim();
    const farmer = await Farmer.findOne({ mobile: cleanMobile });
    if (!farmer) {
      return res.status(401).json({ success: false, message: "Invalid mobile number or credentials" });
    }

    if (farmer.loginEnabled === false) {
      return res.status(403).json({
        success: false,
        message: "Farmer login is currently disabled. Please contact your manager.",
      });
    }

    if (farmer.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: `Farmer account is currently ${farmer.status.toLowerCase()}. Please contact your manager.`,
      });
    }

    if (otp) {
      const verification = await verifyOtp({ phone: cleanMobile, otp, purpose: "login" });
      if (!verification.ok) {
        return res.status(401).json({ success: false, message: verification.message || "Invalid OTP" });
      }
    } else {
      let isMatch = false;
      if (farmer.password && (farmer.password.startsWith("$2a$") || farmer.password.startsWith("$2b$"))) {
        isMatch = await bcrypt.compare(password, farmer.password);
      } else {
        isMatch = farmer.password === password;
        if (isMatch) {
          farmer.password = await bcrypt.hash(password, 10);
          await farmer.save();
        }
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid mobile number or password" });
      }
    }

    const token = signToken({
      id: farmer.id,
      farmerId: farmer.id,
      vendorId: farmer.vendorId,
      managerId: farmer.managerId || "",
      role: "FARMER",
      name: farmer.name,
    });

    const enriched = await enrichFarmerDoc(farmer);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      farmer: enriched,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Login failed" });
  }
}

async function _legacyFarmerLoginOriginal(req, res) {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      return res.status(400).json({ success: false, message: "Mobile number and password are required" });
    }

    const cleanMobile = String(mobile).trim();
    const farmer = await Farmer.findOne({ mobile: cleanMobile });
    if (!farmer) {
      return res.status(401).json({ success: false, message: "Invalid mobile number or password" });
    }

    if (farmer.loginEnabled === false) {
      return res.status(403).json({
        success: false,
        message: "Farmer login is currently disabled. Please contact your manager.",
      });
    }

    if (farmer.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: `Farmer account is currently ${farmer.status.toLowerCase()}. Please contact your manager.`,
      });
    }

    let isMatch = false;
    if (farmer.password && (farmer.password.startsWith("$2a$") || farmer.password.startsWith("$2b$"))) {
      isMatch = await bcrypt.compare(password, farmer.password);
    } else {
      isMatch = farmer.password === password;
      if (isMatch) {
        farmer.password = await bcrypt.hash(password, 10);
        await farmer.save();
      }
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid mobile number or password" });
    }

    const token = signToken({
      id: farmer.id,
      farmerId: farmer.id,
      vendorId: farmer.vendorId,
      managerId: farmer.managerId || "",
      role: "FARMER",
      name: farmer.name,
    });

    const enriched = await enrichFarmerDoc(farmer);

    res.json({
      success: true,
      message: "Login successful",
      token,
      farmer: enriched,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Login failed" });
  }
}

const SELF_REGISTER_GENDERS = ["Male", "Female", "Other"];

export async function registerFarmer(req, res) {
  try {
    const payload = req.body || {};
    const name = String(payload.name || "").trim();
    const dateOfBirth = String(payload.dateOfBirth || "").trim();
    const gender = String(payload.gender || "").trim();
    const cleanMobile = String(payload.mobile || "").replace(/\D/g, "");
    const village = String(payload.village || payload.address?.village || "").trim();
    const taluka = String(payload.taluka || payload.address?.taluka || "").trim();
    const district = String(payload.district || payload.address?.district || "").trim();
    const pincode = String(payload.pincode || payload.address?.pincode || "").trim();
    const profileImage = String(payload.profileImage || payload.photo || "").trim();
    const state = String(payload.state || payload.address?.state || "Maharashtra").trim();

    if (!name || name.length < 3) {
      return res.status(400).json({ success: false, message: "Enter farmer full name (min 3 characters)" });
    }
    if (!dateOfBirth || !isAdult(dateOfBirth)) {
      return res.status(400).json({ success: false, message: "Enter a valid date of birth. Farmer must be 18 or older." });
    }
    if (!SELF_REGISTER_GENDERS.includes(gender)) {
      return res.status(400).json({ success: false, message: "Select a valid gender" });
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({ success: false, message: "Enter a valid 10-digit mobile number" });
    }
    if (!village || !taluka || !district) {
      return res.status(400).json({ success: false, message: "Village, taluka and district are required" });
    }
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, message: "Enter a valid 6-digit pincode" });
    }
    if (!profileImage) {
      return res.status(400).json({ success: false, message: "Farmer photo is required" });
    }
    const rawPassword = String(payload.password || "");
    if (rawPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const existing = await Farmer.findOne({ mobile: cleanMobile }).select("id").lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A farmer account already exists with this mobile number.",
      });
    }

    const referral = await resolveReferralCode(payload.referralCode || payload.agentCode);
    // Do not auto-assign collection centre / vendor on signup; Admin assigns collection centre & manager manually
    const vendorId = "";
    const managerId = "";
    const { farmerId, loc } = await assignFarmerBusinessId({
      state,
      district,
      taluka,
      village,
    });
    const farmerCode = farmerId;
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const farmLocation = [village, district, state].filter(Boolean).join(", ");

    const farmer = new Farmer({
      id: farmerId,
      farmerId,
      farmerCode,
      companyId: "GGC",
      stateId: loc.stateId,
      districtId: loc.districtId,
      talukaId: loc.talukaId,
      villageId: loc.villageId,
      vendorId: "",
      managerId: "",
      name,
      mobile: cleanMobile,
      email: payload.email || "",
      password: hashedPassword,
      loginEnabled: true,
      profileImage,
      farmName: payload.farmName || "",
      farmLocation,
      farmAddress: [village, taluka, district, state, pincode].filter(Boolean).join(", "),
      farmArea: payload.farmArea || "",
      farmType: payload.farmType || "Organic",
      dateOfBirth,
      gender,
      referralCode: referral.referralCode,
      preferredLanguage: payload.preferredLanguage || "",
      bankVerificationStatus: "PENDING",
      farm: {
        farmId: "",
        farmName: payload.farmName || "",
        totalFarmAreaUnit: "Acre",
        cultivatedAreaUnit: "Acre",
        farmingType: payload.farmType || "",
      },
      farmGeo: {
        village,
        taluka,
        district,
        pincode,
        farmAddress: [village, taluka, district, state, pincode].filter(Boolean).join(", "),
      },
      address: {
        village,
        taluka,
        district,
        state,
        pincode,
      },
      status: "Active",
      verificationStatus: "Pending",
      verificationRequired: false,
      registrationStatus: "REGISTERED",
      kycStatus: "PENDING",
      authType: "direct",
      mobileVerified: false,
      role: "FARMER",
      bank: {
        accountHolder: "",
        bankName: "",
        accountNumber: "",
        ifsc: "",
      },
    });

    await farmer.save();
    await ensureFarmForFarmer(farmer, loc);
    await farmer.save();
    await ensureEntityQr({
      entityType: "FARMER",
      entityId: farmer.farmerId || farmer.id,
      links: { farmerId: farmer.farmerId || farmer.id, farmId: farmer.farm?.farmId || "" },
    });

    const token = signToken({
      id: farmer.id,
      farmerId: farmer.id,
      vendorId: farmer.vendorId,
      managerId: farmer.managerId || "",
      role: "FARMER",
      name: farmer.name,
    });

    const { password: _pw, ...farmerData } = farmer.toObject();

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      farmer: {
        ...farmerData,
        farmerId: farmer.id,
        role: "FARMER",
        registrationStatus: "REGISTERED",
        kycStatus: "PENDING",
        initials: initials(farmer.name),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Registration failed" });
  }
}

function authFarmerId(req) {
  return req.user?.farmerId || req.user?.id || "";
}

function areaInAcres(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return String(unit).toLowerCase() === "hectare" ? n * 2.47105 : n;
}

function publicFarmLocation(farmer) {
  const geo = farmer.farmGeo || {};
  return {
    village: geo.village || farmer.address?.village || "",
    taluka: geo.taluka || farmer.address?.taluka || "",
    district: geo.district || farmer.address?.district || "",
    pincode: geo.pincode || farmer.address?.pincode || "",
    farmAddress: geo.farmAddress || farmer.farmAddress || "",
    latitude: geo.latitude ?? null,
    longitude: geo.longitude ?? null,
    hasPin: geo.latitude != null && geo.longitude != null,
    confirmed: Boolean(geo.confirmed),
  };
}

async function buildSelfFarmerPayload(farmer) {
  const enriched = await enrichFarmerDoc(farmer);
  const bankDoc = await FarmerDocument.findOne({ farmerId: farmer.id, type: "bank" }).select("status").lean();
  let bankVerificationStatus = farmer.bankVerificationStatus || "PENDING";
  if (bankDoc?.status === "Approved" || bankDoc?.status === "approved") bankVerificationStatus = "VERIFIED";
  if (bankDoc?.status === "Rejected" || bankDoc?.status === "rejected") bankVerificationStatus = "REJECTED";

  return {
    ...enriched,
    farmerId: farmer.id,
    farm: farmer.farm || {},
    farmLocation: publicFarmLocation(farmer),
    bankVerificationStatus,
    kycStatus: farmer.kycStatus || "PENDING",
  };
}

export async function getFarmerMe(req, res) {
  try {
    const farmer = await Farmer.findOne({ id: authFarmerId(req) }).select("-password").lean();
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    res.json(await buildSelfFarmerPayload(farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load farmer profile" });
  }
}

export async function updateFarmerSelfProfile(req, res) {
  try {
    const farmer = await Farmer.findOne({ id: authFarmerId(req) });
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const payload = req.body || {};
    const name = String(payload.name || "").trim();
    const cleanMobile = String(payload.mobile || farmer.mobile || "").replace(/\D/g, "");
    const village = String(payload.village || payload.address?.village || "").trim();
    const taluka = String(payload.taluka || payload.address?.taluka || "").trim();
    const district = String(payload.district || payload.address?.district || "").trim();
    const pincode = String(payload.pincode || payload.address?.pincode || "").trim();
    const preferredLanguage = String(payload.preferredLanguage || "").trim();

    if (!name || name.length < 3) {
      return res.status(400).json({ message: "Farmer name is required" });
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({ message: "Enter a valid 10-digit mobile number" });
    }
    if (!village) return res.status(400).json({ message: "Village is required" });
    if (!taluka) return res.status(400).json({ message: "Taluka is required" });
    if (!district) return res.status(400).json({ message: "District is required" });
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ message: "Enter a valid 6-digit pincode" });
    }
    if (!preferredLanguage) {
      return res.status(400).json({ message: "Preferred language is required" });
    }

    if (cleanMobile !== farmer.mobile) {
      const taken = await Farmer.findOne({ mobile: cleanMobile, id: { $ne: farmer.id } }).select("id").lean();
      if (taken) {
        return res.status(409).json({ message: "A farmer account already exists with this mobile number." });
      }
    }

    farmer.name = name;
    farmer.mobile = cleanMobile;
    farmer.preferredLanguage = preferredLanguage;
    if (payload.profileImage !== undefined) farmer.profileImage = payload.profileImage;
    farmer.address = {
      ...(farmer.address || {}),
      village,
      taluka,
      district,
      pincode,
      state: farmer.address?.state || "Maharashtra",
    };
    if (payload.bank) {
      farmer.bank = {
        ...(farmer.bank || {}),
        ...payload.bank,
        accountHolder: payload.bank.accountHolder || farmer.name || farmer.bank?.accountHolder || "",
      };
      if (payload.bank.bankName || payload.bank.accountNumber) {
        farmer.bankVerificationStatus = farmer.bankVerificationStatus === "VERIFIED" ? "VERIFIED" : "PENDING";
      }
    }
    if (payload.aadhaarNumber !== undefined) farmer.aadhaarNumber = String(payload.aadhaarNumber).trim();
    if (payload.panNumber !== undefined) farmer.panNumber = String(payload.panNumber).trim().toUpperCase();
    if (payload.aadhaar !== undefined && !farmer.aadhaarNumber) farmer.aadhaarNumber = String(payload.aadhaar).trim();
    if (payload.pan !== undefined && !farmer.panNumber) farmer.panNumber = String(payload.pan).trim().toUpperCase();

    await farmer.save();
    res.json(await buildSelfFarmerPayload(farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update farmer profile" });
  }
}

export async function updateFarmerFarmProfile(req, res) {
  try {
    const farmer = await Farmer.findOne({ id: authFarmerId(req) });
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const payload = req.body || {};
    const farmName = String(payload.farmName || "").trim();
    const totalFarmArea = Number(payload.totalFarmArea);
    const cultivatedArea = Number(payload.cultivatedArea);
    const totalFarmAreaUnit = payload.totalFarmAreaUnit === "Hectare" ? "Hectare" : "Acre";
    const cultivatedAreaUnit = payload.cultivatedAreaUnit === "Hectare" ? "Hectare" : "Acre";
    const soilType = String(payload.soilType || "").trim();
    const irrigationType = String(payload.irrigationType || "").trim();
    const waterSource = String(payload.waterSource || "").trim();
    const farmingMethod = String(payload.farmingMethod || "").trim();
    const farmingType = String(payload.farmingType || "").trim();
    const mainCrops = String(payload.mainCrops || "").trim();

    if (!farmName) return res.status(400).json({ message: "Farm name is required" });
    if (!Number.isFinite(totalFarmArea) || totalFarmArea <= 0) {
      return res.status(400).json({ message: "Total farm area must be greater than 0" });
    }
    if (!Number.isFinite(cultivatedArea) || cultivatedArea <= 0) {
      return res.status(400).json({ message: "Cultivated area must be greater than 0" });
    }
    if (areaInAcres(cultivatedArea, cultivatedAreaUnit) > areaInAcres(totalFarmArea, totalFarmAreaUnit) + 0.0001) {
      return res.status(400).json({ message: "Cultivated area cannot be greater than total farm area" });
    }
    if (!soilType || soilType === "Other") return res.status(400).json({ message: "Soil type is required" });
    if (!irrigationType || irrigationType === "Other") return res.status(400).json({ message: "Irrigation type is required" });
    if (!waterSource || waterSource === "Other") return res.status(400).json({ message: "Water source is required" });
    if (!farmingMethod || farmingMethod === "Other") return res.status(400).json({ message: "Farming method is required" });
    if (!farmingType || farmingType === "Other") return res.status(400).json({ message: "Farming type is required" });

    const farmPhotos = Array.isArray(payload.farmPhotos) ? payload.farmPhotos.filter(Boolean).slice(0, 4) : farmer.farm?.farmPhotos || [];
    const farmVideos = Array.isArray(payload.farmVideos) ? payload.farmVideos.filter(Boolean).slice(0, 2) : farmer.farm?.farmVideos || [];

    farmer.farm = {
      farmId: farmer.farm?.farmId || `farm-${farmer.id}`,
      farmName,
      totalFarmArea,
      totalFarmAreaUnit,
      cultivatedArea,
      cultivatedAreaUnit,
      soilType,
      irrigationType,
      waterSource,
      farmingMethod,
      farmingType,
      mainCrops,
      farmPhotos,
      farmVideos,
    };
    farmer.farmName = farmName;
    farmer.farmArea = `${totalFarmArea} ${totalFarmAreaUnit}`;
    farmer.farmType = farmingType || farmer.farmType;
    farmer.markModified("farm");
    await farmer.save();

    res.json(await buildSelfFarmerPayload(farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update farm profile" });
  }
}

function validateFarmLocationPayload(payload, farmer, requirePin) {
  const village = String(payload.village || "").trim();
  const taluka = String(payload.taluka || "").trim();
  const district = String(payload.district || "").trim();
  const pincode = String(payload.pincode || "").trim();
  const farmAddress = String(payload.farmAddress || "").trim();
  const latitude = payload.latitude != null ? Number(payload.latitude) : farmer.farmGeo?.latitude;
  const longitude = payload.longitude != null ? Number(payload.longitude) : farmer.farmGeo?.longitude;

  if (!village) return { error: "Village is required" };
  if (!taluka) return { error: "Taluka is required" };
  if (!district) return { error: "District is required" };
  if (!/^\d{6}$/.test(pincode)) return { error: "Enter a valid 6-digit pincode" };
  if (!farmAddress) return { error: "Farm address is required" };
  if (requirePin && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
    return { error: "Select and confirm the farm location on the map" };
  }
  return { village, taluka, district, pincode, farmAddress, latitude, longitude };
}

export async function updateFarmerFarmLocation(req, res) {
  try {
    const farmer = await Farmer.findOne({ id: authFarmerId(req) });
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const parsed = validateFarmLocationPayload(req.body || {}, farmer, false);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    farmer.farmGeo = {
      ...(farmer.farmGeo || {}),
      village: parsed.village,
      taluka: parsed.taluka,
      district: parsed.district,
      pincode: parsed.pincode,
      farmAddress: parsed.farmAddress,
      latitude: Number.isFinite(parsed.latitude) ? parsed.latitude : farmer.farmGeo?.latitude ?? null,
      longitude: Number.isFinite(parsed.longitude) ? parsed.longitude : farmer.farmGeo?.longitude ?? null,
      confirmed: false,
    };
    farmer.farmAddress = parsed.farmAddress;
    farmer.farmLocation = [parsed.village, parsed.district].filter(Boolean).join(", ");
    if (!farmer.address?.village && !farmer.address?.district) {
      farmer.address = {
        ...(farmer.address || {}),
        village: parsed.village,
        taluka: parsed.taluka,
        district: parsed.district,
        pincode: parsed.pincode,
      };
    }
    farmer.markModified("farmGeo");
    await farmer.save();
    await Farm.updateOne(
      { farmerId: farmer.farmerId || farmer.id },
      {
        $set: {
          address: parsed.farmAddress,
          farmLocation: farmer.farmLocation,
          latitude: Number.isFinite(parsed.latitude) ? parsed.latitude : null,
          longitude: Number.isFinite(parsed.longitude) ? parsed.longitude : null,
        },
      }
    ).catch(() => {});
    res.json(await buildSelfFarmerPayload(farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to save farm location" });
  }
}

export async function confirmFarmerFarmLocation(req, res) {
  try {
    const farmer = await Farmer.findOne({ id: authFarmerId(req) });
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const parsed = validateFarmLocationPayload(req.body || {}, farmer, true);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    farmer.farmGeo = {
      village: parsed.village,
      taluka: parsed.taluka,
      district: parsed.district,
      pincode: parsed.pincode,
      farmAddress: parsed.farmAddress,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      confirmed: true,
    };
    farmer.farmAddress = parsed.farmAddress;
    farmer.farmLocation = [parsed.village, parsed.district].filter(Boolean).join(", ");
    if (!farmer.address?.village && !farmer.address?.district) {
      farmer.address = {
        ...(farmer.address || {}),
        village: parsed.village,
        taluka: parsed.taluka,
        district: parsed.district,
        pincode: parsed.pincode,
      };
    }
    farmer.markModified("farmGeo");
    await farmer.save();
    await Farm.updateOne(
      { farmerId: farmer.farmerId || farmer.id },
      {
        $set: {
          address: parsed.farmAddress,
          farmLocation: farmer.farmLocation,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        },
      }
    ).catch(() => {});
    res.json(await buildSelfFarmerPayload(farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to confirm farm location" });
  }
}

const CROP_STATUS_FLOW = {
  Planned: ["Planned", "Growing"],
  Growing: ["Growing", "Ready for Harvest"],
  "Ready for Harvest": ["Ready for Harvest", "Harvested"],
  Harvested: ["Harvested", "Completed"],
  Completed: ["Completed"],
};

function sanitizeCropPhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p) => typeof p === "string" && p.length > 20 && p.length < 2_500_000)
    .filter((p) => p.startsWith("data:image/") || p.startsWith("http://") || p.startsWith("https://"))
    .slice(0, 4);
}

function deriveCropStatus(sowingDate, harvestDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (harvestDate && harvestDate <= today) return "Ready for Harvest";
  if (sowingDate && sowingDate <= today) return "Growing";
  return "Planned";
}

// Mutates each lean crop's status in place; write failures are ignored so the list still loads.
async function persistDerivedCropStatuses(crops) {
  const updates = [];
  for (const crop of crops) {
    const derived = deriveCropStatus(crop.sowingDate, crop.expectedHarvestDate);
    if (derived && derived !== crop.status) {
      crop.status = derived;
      updates.push({ updateOne: { filter: { id: crop.id }, update: { $set: { status: derived } } } });
    }
  }
  if (updates.length) await FarmerCrop.bulkWrite(updates, { ordered: false }).catch(() => {});
}

function validateCropPayload(payload) {
  const cropName = String(payload.cropName || payload.crop || "").trim();
  const variety = String(payload.variety || "").trim();
  const category = String(payload.category || "").trim() || "Vegetables";
  const categoryCode = String(payload.categoryCode || "").trim().toUpperCase() || (category ? categoryFromName(category) : categoryFromName(cropName));

  if (!cropName) return { error: "Crop name is required" };
  if (!variety) return { error: "Variety is required" };

  const parsedArea = Number(payload.area);
  const area = Number.isFinite(parsedArea) && parsedArea > 0 ? parsedArea : 1;
  const areaUnit = String(payload.areaUnit || "Acre").trim() || "Acre";

  const todayStr = new Date().toISOString().slice(0, 10);
  const sowingDate = String(payload.sowingDate || todayStr).trim() || todayStr;
  const defaultExpHarvest = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expectedHarvestDate = String(payload.expectedHarvestDate || defaultExpHarvest).trim() || defaultExpHarvest;

  const parsedQty = Number(payload.estimatedQuantity);
  const estimatedQuantity = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 100;
  const unit = String(payload.unit || "Kg").trim() || "Kg";
  const farmingMethod = String(payload.farmingMethod || "Conventional").trim() || "Conventional";
  const farmingType = String(payload.farmingType || "Conventional").trim() || "Conventional";
  const irrigationType = String(payload.irrigationType || "Drip").trim() || "Drip";

  return {
    cropName,
    variety,
    category,
    categoryCode,
    area,
    areaUnit,
    sowingDate,
    expectedHarvestDate,
    estimatedQuantity,
    unit,
    farmingMethod: farmingMethod === "Other" ? "Conventional" : farmingMethod,
    farmingType: farmingType === "Other" ? "Conventional" : farmingType,
    irrigationType: irrigationType === "Other" ? "Drip" : irrigationType,
    photos: sanitizeCropPhotos(payload.photos),
  };
}

function farmSummary(farmer) {
  return {
    farmId: farmer.farm?.farmId || `farm-${farmer.id}`,
    farmName: farmer.farm?.farmName || farmer.farmName || "",
    farmLocation: farmer.farmLocation || farmer.farmGeo?.farmAddress || farmer.farmAddress || "",
  };
}

function publicCrop(crop, farmer) {
  const plain = toPlain(crop);
  return {
    ...plain,
    cropId: plain.cropId || plain.id,
    farmerId: farmer?.id || plain.farmerId,
    farmerName: farmer?.name || plain.farmerName || "",
    ...farmSummary(farmer),
  };
}

function publicPlan(plan, crop) {
  const plain = toPlain(plan);
  return {
    ...plain,
    planId: plain.planId || plain.id,
    cropName: crop?.cropName || "",
    variety: crop?.variety || "",
    farmingMethod: crop?.farmingMethod || "",
    farmingType: crop?.farmingType || "",
    status: crop?.status || plain.status || "Planning Created",
    certificates: (plain.certificates && plain.certificates.length > 0) ? plain.certificates : (crop?.certificates || []),
  };
}

async function upsertCropPlan(farmerId, crop) {
  const planCropKey = crop.cropId || crop.id;
  const existing = await FarmerCropPlan.findOne({
    farmerId,
    $or: [{ cropId: crop.id }, { cropId: planCropKey }],
  });
  if (existing) {
    existing.cropId = planCropKey;
    existing.harvestDate = crop.expectedHarvestDate;
    existing.estimatedProduction = crop.estimatedQuantity;
    existing.unit = crop.unit;
    if (Number(existing.suggestedSaleQuantity) > Number(existing.estimatedProduction)) {
      existing.suggestedSaleQuantity = existing.estimatedProduction;
    }
    await existing.save();
    return existing;
  }
  const planId = `plan-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  return FarmerCropPlan.create({
    id: planId,
    planId,
    farmerId,
    cropId: planCropKey,
    harvestDate: crop.expectedHarvestDate,
    estimatedProduction: crop.estimatedQuantity,
    expectedDemand: 0,
    suggestedSaleQuantity: 0,
    unit: crop.unit,
    status: "Planned",
  });
}

async function loadOwnCrop(req, res) {
  const farmerId = authFarmerId(req);
  const cropId = req.params.cropId;
  const crop = await FarmerCrop.findOne({
    farmerId,
    $or: [{ id: cropId }, { cropId }, { previousCropId: cropId }],
  });
  if (!crop) {
    res.status(404).json({ message: "Crop not found" });
    return null;
  }
  return ensureSharedCropBusinessId(crop);
}

export async function getPublicCropsCatalog(req, res) {
  try {
    res.json(await cropsCatalogCache.get("crops:catalog", buildCropsCatalog));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load crop catalog" });
  }
}

async function buildCropsCatalog() {
  const crops = await FarmerCrop.find({}).sort({ createdAt: -1 }).lean();
  const seen = new Set();
  const catalog = [];
  for (const c of crops) {
    const name = String(c.cropName || c.name || "").trim();
    const variety = String(c.variety || "").trim();
    const key = `${name.toLowerCase()}:::${variety.toLowerCase()}`;
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const photoList = Array.isArray(c.photos) && c.photos.length > 0
      ? c.photos
      : (c.media?.mainPhoto || c.image ? [c.media?.mainPhoto || c.image] : []);
    catalog.push({
      id: c.cropId || c.id,
      cropId: c.cropId || c.id,
      cropName: name,
      variety: variety || "General",
      category: c.category || "",
      unit: c.unit || "Kg",
      areaUnit: c.areaUnit || "Acre",
      farmingMethod: c.farmingMethod || "Conventional",
      farmingType: c.farmingType || "Conventional",
      irrigationType: c.irrigationType || "Drip",
      photos: photoList,
      estimatedQuantity: c.estimatedQuantity || "",
    });
  }
  return catalog;
}

function cropAlreadyCanonical(crop) {
  return cropIdHasVariety(String(crop?.cropId || crop?.id || ""));
}

function productAlreadyCanonical(product) {
  const pid = String(product?.productId || "").trim();
  const cid = String(product?.cropId || "").trim();
  return productIdHasVariety(pid) && cid.startsWith("GGC-CRP-") && productIdFromCropId(cid) === pid;
}

async function normalizeCropList(crops) {
  const groups = new Map();
  for (const crop of crops) {
    const key = `${String(crop.cropName || "").trim().toLowerCase()}|${String(crop.variety || "").trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(crop);
  }
  const byId = new Map();
  for (const group of groups.values()) {
    if (group.every(cropAlreadyCanonical)) {
      group.forEach((crop) => byId.set(String(crop._id), crop));
      continue;
    }
    const first = await ensureSharedCropBusinessId(group[0]);
    byId.set(String(first._id), first);
    const rest = group.slice(1);
    if (rest.length) {
      const fresh = await FarmerCrop.find({ _id: { $in: rest.map((crop) => crop._id) } });
      fresh.forEach((crop) => byId.set(String(crop._id), crop));
    }
  }
  return crops.map((crop) => byId.get(String(crop._id)) || crop);
}

async function normalizeProductList(products) {
  const groups = new Map();
  for (const product of products) {
    const key = `${String(product.cropName || product.productName || product.name || "").trim().toLowerCase()}|${String(product.variety || "").trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }
  const byId = new Map();
  for (const group of groups.values()) {
    if (group.every(productAlreadyCanonical)) {
      group.forEach((product) => byId.set(String(product._id), product));
      continue;
    }
    const first = await upgradeFarmerProductId(group[0]);
    byId.set(String(first._id), first);
    const rest = group.slice(1);
    if (rest.length) {
      const fresh = await FarmerProduct.find({ _id: { $in: rest.map((product) => product._id) } });
      fresh.forEach((product) => byId.set(String(product._id), product));
    }
  }
  return products.map((product) => byId.get(String(product._id)) || product);
}

export async function listFarmerCrops(req, res) {
  try {
    const farmerId = authFarmerId(req);
    const farmer = await Farmer.findOne({ $or: [{ id: farmerId }, { farmerId }, { farmerCode: farmerId }] }).lean();
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const crops = await FarmerCrop.find({ farmerId: { $in: farmerIdentityIds(farmer, farmerId) } }).sort({ createdAt: -1 });
    const normalized = await normalizeCropList(crops);
    res.json(normalized.map((c) => publicCrop(c, farmer)));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load crops" });
  }
}

export async function getFarmerCrop(req, res) {
  try {
    const crop = await loadOwnCrop(req, res);
    if (!crop) return;
    const farmer = await Farmer.findOne({ id: crop.farmerId });
    const plan = await FarmerCropPlan.findOne({
      farmerId: crop.farmerId,
      $or: [{ cropId: crop.id }, { cropId: crop.cropId }],
    }).lean();
    res.json({ ...publicCrop(crop, farmer), plan: plan ? publicPlan(plan, crop) : null });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load crop" });
  }
}

async function resolveSharedCropBusinessId(parsed) {
  const cropName = String(parsed.cropName || "").trim();
  const variety = String(parsed.variety || "").trim();
  const catCode = String(parsed.categoryCode || categoryFromName(parsed.category || cropName)).toUpperCase();
  if (cropName) {
    const existing = await FarmerCrop.findOne({
      cropName: new RegExp(`^${cropName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      ...(variety
        ? { variety: new RegExp(`^${variety.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
        : {}),
    })
      .sort({ createdAt: 1 });
    if (existing) {
      const normalized = await ensureSharedCropBusinessId(existing);
      const shared = String(normalized?.cropId || normalized?.id || "").trim();
      if (shared.startsWith("GGC-CRP-")) return shared;
    }
  }
  return generateId({
    module: "CRP",
    category: catCode || categoryFromName(cropName),
    crop: cropCodeFromName(cropName),
    variety: varietyCodeFromName(variety),
  });
}

async function uniqueCropRecordId(cropId, farmer) {
  const base = String(cropId || "").trim();
  const taken = await FarmerCrop.exists({ id: base });
  if (!taken) return base;
  const serial = farmerSerialFromId(farmer?.farmerId || farmer?.id || "00001");
  let candidate = `${base}-F${serial}`;
  let n = 1;
  while (await FarmerCrop.exists({ id: candidate })) {
    n += 1;
    candidate = `${base}-F${serial}-${n}`;
  }
  return candidate;
}

async function uniqueProductRecordId(productId, farmer) {
  const base = String(productId || "").trim();
  const taken = await FarmerProduct.exists({ id: base });
  if (!taken) return base;
  const serial = farmerSerialFromId(farmer.farmerId || farmer.id);
  let candidate = `${base}-F${serial}`;
  let n = 1;
  while (await FarmerProduct.exists({ id: candidate })) {
    n += 1;
    candidate = `${base}-F${serial}-${n}`;
  }
  return candidate;
}

async function resolveProductIdsFromCrop(farmer, crop, cropName, variety) {
  let cropDoc = crop;
  if (cropDoc) {
    cropDoc = await ensureSharedCropBusinessId(cropDoc);
  }
  const name = cropName || cropDoc?.cropName || "";
  const varName = variety || cropDoc?.variety || "";

  // Reuse shared productId if another farmer already has this crop+variety
  if (name) {
    const existing = await FarmerProduct.find({
      $or: [
        { cropName: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        { name: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        { productName: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      ],
      ...(varName
        ? { variety: new RegExp(`^${String(varName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
        : {}),
    })
      .sort({ createdAt: 1 })
      .limit(1);
    const sharedPid = String(existing[0]?.productId || "").trim();
    if (sharedPid.startsWith("GGC-ART-")) {
      const id = await uniqueProductRecordId(sharedPid, farmer);
      return {
        id,
        productId: sharedPid,
        cropBusinessId: cropDoc?.cropId || `GGC-CRP-${sharedPid.slice("GGC-ART-".length)}`,
      };
    }
  }

  let productId = productIdFromCropId(cropDoc?.cropId || "");
  if (!productId) {
    productId = await generateId({
      module: "ART",
      category: categoryFromName(name || cropDoc?.cropName),
      crop: cropCodeFromName(name || cropDoc?.cropName),
      variety: varietyCodeFromName(varName || cropDoc?.variety),
    });
  }
  const id = await uniqueProductRecordId(productId, farmer);
  return { id, productId, cropBusinessId: cropDoc?.cropId || "" };
}

async function persistNewCrop(farmer, parsed, extras = {}) {
  const cropId = await resolveSharedCropBusinessId(parsed);
  const id = await uniqueCropRecordId(cropId, farmer);
  const crop = await FarmerCrop.create({
    id,
    cropId,
    farmerId: farmer.id,
    farmId: farmSummary(farmer).farmId,
    cropName: parsed.cropName,
    variety: parsed.variety,
    category: parsed.category || "Vegetables",
    categoryCode: parsed.categoryCode || "VEG",
    area: parsed.area,
    areaUnit: parsed.areaUnit,
    sowingDate: parsed.sowingDate,
    expectedHarvestDate: parsed.expectedHarvestDate,
    estimatedQuantity: parsed.estimatedQuantity,
    unit: parsed.unit,
    farmingMethod: parsed.farmingMethod,
    farmingType: parsed.farmingType,
    irrigationType: parsed.irrigationType,
    photos: parsed.photos,
    status: deriveCropStatus(parsed.sowingDate, parsed.expectedHarvestDate),
    approvalStatus: extras.approvalStatus || "Approved",
    requestedBy: extras.requestedBy || "",
    rejectionReason: "",
  });
  await syncFarmerCropToErp(crop, farmer);
  await ensureEntityQr({
    entityType: "CROP",
    entityId: cropId,
    links: { farmerId: farmer.farmerId || farmer.id, farmId: crop.farmId, cropId },
  });
  const plan = await upsertCropPlan(farmer.id, crop);
  return { crop, plan };
}

async function applyCropUpdate(crop, payload) {
  const parsed = validateCropPayload({ ...toPlain(crop), ...(payload || {}) });
  if (parsed.error) return { error: parsed.error };
  const nextStatus = String(payload?.status || crop.status);
  if (payload?.status) {
    if (!CROP_STATUSES.includes(nextStatus)) {
      return { error: `Invalid crop status: ${nextStatus}` };
    }
  }
  crop.cropName = parsed.cropName;
  crop.variety = parsed.variety;
  if (parsed.category) crop.category = parsed.category;
  if (parsed.categoryCode) crop.categoryCode = parsed.categoryCode;
  crop.area = parsed.area;
  crop.areaUnit = parsed.areaUnit;
  crop.sowingDate = parsed.sowingDate;
  crop.expectedHarvestDate = parsed.expectedHarvestDate;
  crop.estimatedQuantity = parsed.estimatedQuantity;
  crop.unit = parsed.unit;
  crop.farmingMethod = parsed.farmingMethod;
  crop.farmingType = parsed.farmingType;
  crop.irrigationType = parsed.irrigationType;
  if (Array.isArray(payload?.certificates)) {
    crop.certificates = payload.certificates;
  }
  crop.status = nextStatus;
  await crop.save();
  const plan = await upsertCropPlan(crop.farmerId, crop);
  if (plan) {
    if (payload?.status) plan.status = nextStatus;
    if (Array.isArray(payload?.certificates)) plan.certificates = payload.certificates;
    await plan.save();
  }
  return { crop, plan };
}

export async function createFarmerCrop(req, res) {
  try {
    const farmer = await Farmer.findOne({ id: authFarmerId(req) });
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const parsed = validateCropPayload(req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    if (!farmer.vendorId) {
      return res.status(400).json({ message: "Your account is not linked to a collection centre yet." });
    }
    const available = await vendorAvailableCrops(farmer.vendorId);
    if (!isCropAvailableForVendor(available, parsed.cropName, parsed.variety)) {
      return res.status(400).json({
        message: "This crop is not available at your collection centre. Please choose a crop from the list.",
      });
    }

    const existing = await FarmerCrop.findOne({
      farmerId: { $in: farmerIdentityIds(farmer) },
      cropName: new RegExp(`^${String(parsed.cropName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      variety: new RegExp(`^${String(parsed.variety).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });
    if (existing) {
      const approval = String(existing.approvalStatus || "Approved");
      if (approval === "Pending") {
        return res.status(409).json({ message: "A request for this crop is already waiting for collection centre approval." });
      }
      if (approval === "Approved") {
        return res.status(409).json({ message: "This crop is already in your farm." });
      }
      existing.approvalStatus = "Pending";
      existing.rejectionReason = "";
      existing.requestedBy = "farmer";
      existing.area = parsed.area;
      existing.areaUnit = parsed.areaUnit;
      existing.sowingDate = parsed.sowingDate;
      existing.expectedHarvestDate = parsed.expectedHarvestDate;
      existing.estimatedQuantity = parsed.estimatedQuantity;
      existing.unit = parsed.unit;
      existing.farmingMethod = parsed.farmingMethod;
      existing.farmingType = parsed.farmingType;
      existing.irrigationType = parsed.irrigationType;
      if (parsed.photos?.length) existing.photos = parsed.photos;
      await existing.save();
      const plan = await upsertCropPlan(farmer.id, existing);
      return res.json({
        ...publicCrop(existing, farmer),
        plan: publicPlan(plan, existing),
        message: "Crop request re-submitted to your collection centre for approval.",
      });
    }

    const { crop, plan } = await persistNewCrop(farmer, parsed, {
      approvalStatus: "Pending",
      requestedBy: "farmer",
    });
    res.status(201).json({
      ...publicCrop(crop, farmer),
      plan: publicPlan(plan, crop),
      message: "Crop request sent to your collection centre for approval.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create crop" });
  }
}

export async function updateFarmerCrop(req, res) {
  try {
    const crop = await loadOwnCrop(req, res);
    if (!crop) return;
    const updated = await applyCropUpdate(crop, req.body || {});
    if (updated.error) return res.status(400).json({ message: updated.error });
    const farmer = await Farmer.findOne({ id: crop.farmerId });
    res.json({ ...publicCrop(updated.crop, farmer), plan: publicPlan(updated.plan, updated.crop) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update crop" });
  }
}

export async function deleteFarmerCrop(req, res) {
  try {
    const crop = await loadOwnCrop(req, res);
    if (!crop) return;
    await FarmerCropPlan.deleteMany({
      farmerId: crop.farmerId,
      $or: [{ cropId: crop.id }, { cropId: crop.cropId }],
    });
    await FarmerCrop.deleteOne({ id: crop.id });
    res.json({ success: true, message: "Crop deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete crop" });
  }
}

export async function getManagedFarmerCrops(req, res) {
  try {
    const { farmerId } = req.params;
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const crops = await FarmerCrop.find({ farmerId: { $in: farmerIdentityIds(farmer, farmerId) } }).sort({ createdAt: -1 });
    const normalized = await normalizeCropList(crops);
    res.json(normalized.map((c) => publicCrop(c, farmer)));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load crops" });
  }
}

export async function getManagedFarmerCrop(req, res) {
  try {
    const { farmerId, cropId } = req.params;
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const crop = await FarmerCrop.findOne({
      farmerId: { $in: farmerIdentityIds(farmer, farmerId) },
      $or: [{ id: cropId }, { cropId }, { previousCropId: cropId }],
    });
    if (!crop) return res.status(404).json({ message: "Crop not found" });
    const normalized = await ensureSharedCropBusinessId(crop);
    const plan = await FarmerCropPlan.findOne({
      farmerId: { $in: farmerIdentityIds(farmer, farmerId) },
      $or: [{ cropId: normalized.id }, { cropId: normalized.cropId }],
    }).lean();
    res.json({ ...publicCrop(normalized, farmer), plan: plan ? publicPlan(plan, normalized) : null });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load crop" });
  }
}

export async function createManagedFarmerCrop(req, res) {
  try {
    const farmerParam = req.params.farmerId;
    const isManager = req.user?.role === "FARMER_MANAGER";
    if (isManager && (!farmerParam || farmerParam === "general")) {
      return res.status(400).json({ message: "Select a farmer to add this crop" });
    }
    let farmer = null;
    if (farmerParam && farmerParam !== "general") {
      farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerParam));
    }
    if (isManager && !farmer) {
      return res.status(404).json({ message: "Farmer not found" });
    }
    const forChosenFarmer = Boolean(farmer);
    if (!farmer) {
      if (req.user?.vendorId) {
        farmer = await Farmer.findOne({ vendorId: req.user.vendorId });
      }
      if (!farmer && req.user?.managerId) {
        farmer = await Farmer.findOne({ managerId: req.user.managerId });
      }
    }
    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found" });
    }

    const parsed = validateCropPayload(req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const vendorId = farmer.vendorId || req.user?.vendorId || "";
    const available = await vendorAvailableCrops(vendorId);
    if (!available.length) {
      return res.status(400).json({
        message: "Your collection centre has no crops yet. Ask them to add crops first.",
      });
    }
    if (!isCropAvailableForVendor(available, parsed.cropName, parsed.variety)) {
      return res.status(400).json({
        message: "Choose a crop from your collection centre crop list.",
      });
    }
    const nameRx = new RegExp(`^${String(parsed.cropName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    const varietyRx = new RegExp(`^${String(parsed.variety).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    const existing = await FarmerCrop.findOne({
      farmerId: { $in: farmerIdentityIds(farmer, farmerParam) },
      cropName: nameRx,
      variety: varietyRx,
    });
    if (existing) {
      return res.status(409).json({ message: "This crop is already added for this farmer." });
    }
    const { crop, plan } = await persistNewCrop(farmer, parsed, {
      approvalStatus: "Approved",
      requestedBy: req.user?.role || "vendor",
    });
    if (forChosenFarmer && isStaffChange(req)) pushFarmerCropChange(crop, { isNew: true });
    res.status(201).json({ ...publicCrop(crop, farmer), plan: publicPlan(plan, crop) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create crop" });
  }
}

export async function updateManagedFarmerCrop(req, res) {
  try {
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, req.params.farmerId));
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const crop = await FarmerCrop.findOne({
      farmerId: { $in: farmerIdentityIds(farmer, req.params.farmerId) },
      $or: [{ id: req.params.cropId }, { cropId: req.params.cropId }, { previousCropId: req.params.cropId }],
    });
    if (!crop) return res.status(404).json({ message: "Crop not found" });
    const updated = await applyCropUpdate(crop, req.body || {});
    if (updated.error) return res.status(400).json({ message: updated.error });
    if (isStaffChange(req)) pushFarmerCropChange(updated.crop);
    res.json({ ...publicCrop(updated.crop, farmer), plan: publicPlan(updated.plan, updated.crop) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update crop" });
  }
}

export async function updateManagedCropPlan(req, res) {
  try {
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, req.params.farmerId));
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const cropId = req.params.cropId;
    const ids = farmerIdentityIds(farmer, req.params.farmerId);
    const crop = await FarmerCrop.findOne({
      farmerId: { $in: ids },
      $or: [{ id: cropId }, { cropId }, { previousCropId: cropId }],
    });
    if (!crop) return res.status(404).json({ message: "Crop not found" });
    let plan = await FarmerCropPlan.findOne({
      farmerId: { $in: ids },
      $or: [{ cropId: crop.id }, { cropId: crop.cropId }, { id: cropId }, { planId: cropId }],
    });
    if (!plan) {
      plan = await upsertCropPlan(farmer.id, crop);
    }
    await updatePlanFields(plan, req.body || {}, crop, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || "Failed to update crop plan" });
    }
  }
}

export async function deleteManagedFarmerCrop(req, res) {
  try {
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, req.params.farmerId));
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const crop = await FarmerCrop.findOne({
      farmerId: { $in: farmerIdentityIds(farmer, req.params.farmerId) },
      $or: [{ id: req.params.cropId }, { cropId: req.params.cropId }, { previousCropId: req.params.cropId }],
    });
    if (!crop) return res.status(404).json({ message: "Crop not found" });
    await FarmerCropPlan.deleteMany({
      farmerId: { $in: farmerIdentityIds(farmer, req.params.farmerId) },
      $or: [{ cropId: crop.id }, { cropId: crop.cropId }],
    });
    await FarmerCrop.deleteOne({ id: crop.id });
    res.json({ success: true, message: "Crop deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete crop" });
  }
}

export async function listFarmerCropPlans(req, res) {
  try {
    const farmerId = authFarmerId(req);
    const plans = await FarmerCropPlan.find({ farmerId }).sort({ createdAt: -1 }).lean();
    const cropIds = plans.map((p) => p.cropId);
    const crops = await FarmerCrop.find({
      farmerId,
      $or: [{ id: { $in: cropIds } }, { cropId: { $in: cropIds } }],
    }).lean();
    const cropMap = new Map();
    crops.forEach((c) => {
      cropMap.set(c.id, c);
      if (c.cropId) cropMap.set(c.cropId, c);
    });
    res.json(plans.map((p) => publicPlan(p, cropMap.get(p.cropId))));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load crop plans" });
  }
}

export async function getFarmerCropPlan(req, res) {
  try {
    const farmerId = authFarmerId(req);
    const planId = req.params.planId;
    const plan = await FarmerCropPlan.findOne({ farmerId, $or: [{ id: planId }, { planId }, { cropId: planId }] });
    if (!plan) return res.status(404).json({ message: "Crop plan not found" });
    const crop = await FarmerCrop.findOne({ farmerId, id: plan.cropId });
    res.json(publicPlan(plan, crop));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load crop plan" });
  }
}

export async function createFarmerCropPlan(req, res) {
  try {
    const farmerId = authFarmerId(req);
    const cropId = String(req.body?.cropId || "").trim();
    const crop = await FarmerCrop.findOne({ farmerId, $or: [{ id: cropId }, { cropId }] });
    if (!crop) return res.status(404).json({ message: "Crop not found" });
    const plan = await upsertCropPlan(farmerId, crop);
    if (req.body?.expectedDemand != null || req.body?.suggestedSaleQuantity != null) {
      await updatePlanFields(plan, req.body, crop, res);
      return;
    }
    res.status(201).json(publicPlan(plan, crop));
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || "Failed to create crop plan" });
    }
  }
}

async function updatePlanFields(plan, payload, crop, res) {
  if (payload.status) {
    const nextStatus = String(payload.status).trim();
    if (!CROP_STATUSES.includes(nextStatus)) {
      res.status(400).json({ message: `Invalid crop status: ${nextStatus}` });
      return;
    }
    plan.status = nextStatus;
    if (crop) {
      crop.status = nextStatus;
      await crop.save();
    }
  }

  if (Array.isArray(payload.certificates)) {
    plan.certificates = payload.certificates;
    if (crop) {
      crop.certificates = payload.certificates;
      await crop.save();
    }
  }

  if (payload.estimatedProduction != null || payload.expectedDemand != null || payload.suggestedSaleQuantity != null) {
    const estimatedProduction = Number(payload.estimatedProduction ?? plan.estimatedProduction);
    const expectedDemand = Number(payload.expectedDemand ?? plan.expectedDemand);
    const suggestedSaleQuantity = Number(payload.suggestedSaleQuantity ?? plan.suggestedSaleQuantity);
    if (!Number.isFinite(estimatedProduction) || estimatedProduction <= 0) {
      res.status(400).json({ message: "Estimated production must be greater than 0" });
      return;
    }
    if (!Number.isFinite(expectedDemand) || expectedDemand < 0) {
      res.status(400).json({ message: "Expected demand cannot be negative" });
      return;
    }
    if (!Number.isFinite(suggestedSaleQuantity) || suggestedSaleQuantity < 0) {
      res.status(400).json({ message: "Suggested sale quantity cannot be negative" });
      return;
    }
    if (suggestedSaleQuantity > estimatedProduction) {
      res.status(400).json({ message: "Suggested sale quantity cannot be greater than estimated production" });
      return;
    }
    plan.estimatedProduction = estimatedProduction;
    plan.expectedDemand = expectedDemand;
    plan.suggestedSaleQuantity = suggestedSaleQuantity;
  }

  if (payload.harvestDate) plan.harvestDate = String(payload.harvestDate);
  if (payload.unit && ["Kg", "Quintal", "Ton"].includes(payload.unit)) plan.unit = payload.unit;
  if (!payload.status && !plan.status) {
    plan.status = "Updated";
  }
  const saved = await plan.save();
  res.json(publicPlan(saved, crop));
}

export async function updateFarmerCropPlan(req, res) {
  try {
    const farmerId = authFarmerId(req);
    const planId = req.params.planId;
    const plan = await FarmerCropPlan.findOne({ farmerId, $or: [{ id: planId }, { planId }, { cropId: planId }] });
    if (!plan) return res.status(404).json({ message: "Crop plan not found" });
    const crop = await FarmerCrop.findOne({ farmerId, id: plan.cropId });
    await updatePlanFields(plan, req.body || {}, crop, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || "Failed to update crop plan" });
    }
  }
}

const PRODUCT_STATUS_ALIASES = {
  DRAFT: "Draft",
  Draft: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  "Pending Approval": "Pending Approval",
  Pending: "Pending Approval",
  ACTIVE: "Active",
  Active: "Active",
  Approved: "Active",
  REJECTED: "Rejected",
  Rejected: "Rejected",
  LOW_STOCK: "Low Stock",
  "Low Stock": "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
  "Out of Stock": "Out of Stock",
  PAUSED: "Paused",
  Paused: "Paused",
  Inactive: "Paused",
};

const PRODUCT_UNITS_ALLOWED = ["Kg", "Quintal", "Ton"];
const LIFECYCLE_LOCKED = ["Draft", "Pending Approval", "Paused"];

function normalizeProductStatus(status) {
  return PRODUCT_STATUS_ALIASES[status] || status || "Draft";
}

function sanitizeProductImages(list, max = 4) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => typeof p === "string" && p.length > 20 && p.length < 2_500_000)
    .filter((p) => p.startsWith("data:image/") || p.startsWith("http://") || p.startsWith("https://") || p.startsWith("/"))
    .slice(0, max);
}

function sanitizeProductVideos(list, max = 2) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => typeof p === "string" && p.length > 20 && p.length < 20_000_000)
    .filter((p) => p.startsWith("data:video/") || p.startsWith("http://") || p.startsWith("https://"))
    .slice(0, max);
}

function gradeLetterOf(value, idx = 0) {
  const raw = String(value || "").replace(/grade\s*/i, "").trim();
  const grade = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
  return grade || String.fromCharCode(65 + idx);
}

function normalizeProductGrades(grades = []) {
  const source = Array.isArray(grades) && grades.length ? grades : [];
  return source.map((g, idx) => {
    const fromLabel = gradeLetterOf(g.label || g.name, idx);
    const fromGrade = gradeLetterOf(g.grade, idx);
    // Prefer the label when it names A–D. Mongoose defaults every subdoc `grade` to "A".
    const grade = /^[A-D]$/.test(fromLabel) ? fromLabel : fromGrade;
    return {
      id: g.id || `g-${grade.toLowerCase()}-${idx}`,
      grade,
      label: g.label || `Grade ${grade}`,
      quantity: Number(g.quantity) || 0,
      price: Number(g.price ?? g.pricePerKg ?? 0) || 0,
    };
  });
}

function totalGradeQty(grades) {
  return (grades || []).reduce((sum, g) => sum + Number(g.quantity || 0), 0);
}

function qtyForGrade(grades, letter) {
  return Number((grades || []).find((g) => String(g.grade || "").toUpperCase() === letter)?.quantity) || 0;
}

function priceForGrade(grades, letter) {
  return Number((grades || []).find((g) => String(g.grade || "").toUpperCase() === letter)?.price) || 0;
}

function applyGradeQtyFields(product, grades) {
  product.gradeAQty = qtyForGrade(grades, "A");
  product.gradeBQty = qtyForGrade(grades, "B");
  product.gradeCQty = qtyForGrade(grades, "C");
  product.gradeAPrice = priceForGrade(grades, "A");
  product.gradeBPrice = priceForGrade(grades, "B");
  product.gradeCPrice = priceForGrade(grades, "C");
}

function ensureAbcGrades(grades, fallbackPrice = 0) {
  const by = new Map((grades || []).map((g) => [String(g.grade || "").toUpperCase(), g]));
  return ["A", "B", "C"].map((letter, idx) => {
    const existing = by.get(letter);
    if (existing) return existing;
    return {
      id: `g-${letter.toLowerCase()}-${idx}`,
      grade: letter,
      label: `Grade ${letter}`,
      quantity: 0,
      price: letter === "A" ? Number(fallbackPrice) || 0 : 0,
    };
  });
}

function applyStockDrivenStatus(currentStatus, quantity, lowStockLimit) {
  const lifecycle = normalizeProductStatus(currentStatus);
  if (LIFECYCLE_LOCKED.includes(lifecycle)) return lifecycle;
  const qty = Number(quantity) || 0;
  const limit = Number(lowStockLimit) || 10;
  if (qty <= 0) return "Out of Stock";
  if (qty <= limit) return "Low Stock";
  return "Active";
}

function stockStatusOf(product) {
  const lifecycle = normalizeProductStatus(product.status);
  if (lifecycle === "Paused") return "Paused";
  const qty = Math.max(
    0,
    Number(product.availableQuantity ?? product.stock ?? 0) - Number(product.reservedQuantity || 0)
  );
  const limit = Number(product.lowStockLimit || 10);
  if (qty <= 0) return "Out of Stock";
  if (qty <= limit) return "Low Stock";
  return lifecycle === "Draft" || lifecycle === "Pending Approval" ? lifecycle : "Active";
}

function farmingTypeOf(product) {
  if (product.farmingType) return product.farmingType;
  if (product.produceType === "non-organic") return "Conventional";
  if (product.produceType === "organic") return "Organic";
  return "";
}

function publicMyProduct(product, farmer, crop) {
  const plain = toPlain(product);
  const grades = stockGradesOf(plain);
  const quantity = grades.length ? totalGradeQty(grades) : Number(plain.availableQuantity ?? plain.stock ?? 0);
  const status = normalizeProductStatus(plain.status);
  const media = plain.media || {};
  const mainPhoto = media.mainPhoto || plain.image || plain.images?.[0] || "";
  return {
    ...plain,
    productId: plain.productId || plain.id,
    productName: plain.productName || plain.name,
    cropName: plain.cropName || crop?.cropName || "",
    categoryCode: categoryFromName(plain.cropName || crop?.cropName || ""),
    variety: plain.variety || crop?.variety || "",
    availableQuantity: quantity,
    stock: quantity,
    reservedQuantity: Number(plain.reservedQuantity || 0),
    sellableQuantity: Math.max(0, quantity - Number(plain.reservedQuantity || 0)),
    pricePerKg: Number(plain.pricePerKg || plain.sellingPrice || 0),
    sellingPrice: Number(plain.pricePerKg || plain.sellingPrice || 0),
    minimumOrderQuantity: Number(plain.minimumOrderQuantity || 1),
    farmingType: farmingTypeOf(plain),
    grades,
    gradeAQty: grades.length ? qtyForGrade(grades, "A") : Number(plain.gradeAQty) || 0,
    gradeBQty: grades.length ? qtyForGrade(grades, "B") : Number(plain.gradeBQty) || 0,
    gradeCQty: grades.length ? qtyForGrade(grades, "C") : Number(plain.gradeCQty) || 0,
    gradeAPrice: grades.length ? priceForGrade(grades, "A") : Number(plain.gradeAPrice || plain.sellingPrice || plain.pricePerKg) || 0,
    gradeBPrice: grades.length ? priceForGrade(grades, "B") : Number(plain.gradeBPrice) || 0,
    gradeCPrice: grades.length ? priceForGrade(grades, "C") : Number(plain.gradeCPrice) || 0,
    media: {
      mainPhoto,
      farmPhotos: media.farmPhotos || [],
      cropPhotos: media.cropPhotos || [],
      harvestPhotos: media.harvestPhotos || [],
      videos: media.videos || [],
    },
    image: mainPhoto,
    images: [mainPhoto, ...(plain.images || [])].filter(Boolean),
    status,
    stockStatus: stockStatusOf({ ...plain, status, availableQuantity: quantity }),
    farmId: plain.farmId || farmer?.farm?.farmId || "",
    farmName: farmer?.farm?.farmName || farmer?.farmName || "",
    farmLocation: plain.farmLocation || farmer?.farmLocation || farmer?.farmGeo?.farmAddress || "",
    crop: crop
      ? {
          cropId: crop.cropId || crop.id,
          cropName: crop.cropName,
          variety: crop.variety,
          sowingDate: crop.sowingDate || "",
          expectedHarvestDate: crop.expectedHarvestDate || "",
          estimatedQuantity: crop.estimatedQuantity,
          unit: crop.unit,
          farmingType: crop.farmingType,
          photos: crop.photos || [],
        }
      : null,
  };
}

async function loadOwnProduct(req, res) {
  const productId = req.params.productId;
  if (req.params.farmerId) {
    const loaded = await loadAccessibleFarmerProduct(req, res);
    return loaded?.product || null;
  }
  const farmerId = authFarmerId(req);
  const farmer = await Farmer.findOne({ $or: [{ id: farmerId }, { farmerId }, { farmerCode: farmerId }] });
  const ids = farmerIdentityIds(farmer, farmerId);
  const product = await FarmerProduct.findOne({
    farmerId: { $in: ids },
    isDeleted: { $ne: true },
    $or: [{ id: productId }, { productId }, { previousProductId: productId }],
  });
  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return null;
  }
  return product;
}

function parseProductMedia(payload, existing = {}) {
  const media = payload.media || {};
  const mainPhoto = sanitizeProductImages(
    [media.mainPhoto || payload.image || payload.imageUrl || existing.mainPhoto || ""].filter(Boolean),
    1
  )[0] || "";
  return {
    mainPhoto,
    farmPhotos: sanitizeProductImages(media.farmPhotos ?? existing.farmPhotos, 4),
    cropPhotos: sanitizeProductImages(media.cropPhotos ?? existing.cropPhotos, 4),
    harvestPhotos: sanitizeProductImages(media.harvestPhotos ?? existing.harvestPhotos, 4),
    videos: sanitizeProductVideos(media.videos ?? existing.videos, 2),
  };
}

function validateMyProductPayload(payload, { publish } = {}) {
  const productName = String(payload.productName || payload.name || "").trim();
  const cropId = String(payload.cropId || "").trim();
  const cropName = String(payload.cropName || payload.crop || "").trim();
  const variety = String(payload.variety || "").trim();
  const unit = PRODUCT_UNITS_ALLOWED.includes(payload.unit) ? payload.unit : "";
  const grades = ensureAbcGrades(normalizeProductGrades(payload.grades), Number(payload.pricePerKg ?? payload.sellingPrice) || 0);
  if (payload.gradeAQty != null) {
    const row = grades.find((g) => g.grade === "A");
    if (row) row.quantity = Number(payload.gradeAQty) || 0;
  }
  if (payload.gradeBQty != null) {
    const row = grades.find((g) => g.grade === "B");
    if (row) row.quantity = Number(payload.gradeBQty) || 0;
  }
  if (payload.gradeCQty != null) {
    const row = grades.find((g) => g.grade === "C");
    if (row) row.quantity = Number(payload.gradeCQty) || 0;
  }
  if (payload.gradeAPrice != null) {
    const row = grades.find((g) => g.grade === "A");
    if (row) row.price = Number(payload.gradeAPrice) || 0;
  }
  if (payload.gradeBPrice != null) {
    const row = grades.find((g) => g.grade === "B");
    if (row) row.price = Number(payload.gradeBPrice) || 0;
  }
  if (payload.gradeCPrice != null) {
    const row = grades.find((g) => g.grade === "C");
    if (row) row.price = Number(payload.gradeCPrice) || 0;
  }
  const availableQuantity = grades.length ? totalGradeQty(grades) : Number(payload.availableQuantity);
  const gradePrice = Number(grades.find((g) => Number(g.price) > 0)?.price);
  const pricePerKg = Number(payload.pricePerKg ?? payload.sellingPrice) || (Number.isFinite(gradePrice) ? gradePrice : 0);
  const minimumOrderQuantity = Number(payload.minimumOrderQuantity);
  const harvestDate = String(payload.harvestDate || "").trim();
  const farmingType = String(payload.farmingType || "").trim();
  const availableFrom = String(payload.availableFrom || "").trim();
  const availableUntil = String(payload.availableUntil || "").trim();
  const media = parseProductMedia(payload);

  if (!productName) return { error: "Product name is required" };
  if (!cropId && !cropName) return { error: "Crop is required" };

  if (publish) {
    if (!variety) return { error: "Variety is required" };
    if (!Number.isFinite(availableQuantity) || availableQuantity <= 0) return { error: "Quantity must be greater than 0" };
    if (!unit) return { error: "Unit is required" };
    if (!harvestDate) return { error: "Harvest date is required" };
    if (!grades.length) return { error: "Add at least one grade" };
    if (!farmingType) return { error: "Farming type is required" };
    if (!availableFrom) return { error: "Available from date is required" };
    if (!availableUntil) return { error: "Available until date is required" };
    if (availableUntil && availableFrom && availableUntil < availableFrom) {
      return { error: "Available until cannot be before available from" };
    }
    if (!media.mainPhoto) return { error: "Main product photo is required" };
  }

  return {
    productName,
    cropId,
    cropName,
    variety,
    unit: unit || "Kg",
    grades,
    availableQuantity: Number.isFinite(availableQuantity) ? availableQuantity : 0,
    pricePerKg: Number.isFinite(pricePerKg) ? pricePerKg : 0,
    minimumOrderQuantity: Number.isFinite(minimumOrderQuantity) && minimumOrderQuantity > 0 ? minimumOrderQuantity : 1,
    harvestDate,
    farmingType,
    availableFrom,
    availableUntil,
    media,
    lowStockLimit: Number(payload.lowStockLimit) > 0 ? Number(payload.lowStockLimit) : 10,
  };
}

function applyProductFields(product, parsed, farmer, crop) {
  product.productName = parsed.productName;
  product.name = parsed.productName;
  product.cropId = crop?.cropId || parsed.cropId || crop?.id || product.cropId || "";
  product.cropName = parsed.cropName || crop?.cropName || product.cropName || "";
  product.variety = parsed.variety || crop?.variety || product.variety || "";
  product.unit = parsed.unit;
  const grades = ensureAbcGrades(parsed.grades, parsed.pricePerKg);
  product.grades = grades;
  product.availableQuantity = parsed.availableQuantity;
  product.stock = parsed.availableQuantity;
  applyGradeQtyFields(product, grades);
  product.pricePerKg = parsed.pricePerKg;
  product.sellingPrice = parsed.pricePerKg;
  product.minimumOrderQuantity = parsed.minimumOrderQuantity;
  product.harvestDate = parsed.harvestDate;
  product.farmingType = parsed.farmingType;
  product.produceType = parsed.farmingType === "Conventional" ? "non-organic" : "organic";
  product.availableFrom = parsed.availableFrom;
  product.availableUntil = parsed.availableUntil;
  product.media = parsed.media;
  product.image = parsed.media.mainPhoto || "";
  product.images = [parsed.media.mainPhoto, ...(parsed.media.cropPhotos || [])].filter(Boolean);
  product.lowStockLimit = parsed.lowStockLimit;
  product.farmId = product.farmId || farmer?.farm?.farmId || `farm-${farmer?.id || ""}`;
  product.farmLocation = product.farmLocation || farmer?.farmLocation || farmer?.farmGeo?.farmAddress || "";
  product.markModified("grades");
  product.markModified("media");
}

export async function listMyProducts(req, res) {
  try {
    const farmerId = authFarmerId(req);
    const farmer = await Farmer.findOne({ $or: [{ id: farmerId }, { farmerId }, { farmerCode: farmerId }] }).lean();
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const ids = farmerIdentityIds(farmer, farmerId);
    const query = { farmerId: { $in: ids }, isDeleted: { $ne: true } };
    if (req.query?.status) {
      query.status = req.query.status;
    }
    const products = await FarmerProduct.find(query).sort({ createdAt: -1 });
    const upgraded = await normalizeProductList(products);
    const cropIds = [...new Set(products.map((p) => p.cropId).filter(Boolean))];
    const crops = cropIds.length
      ? await FarmerCrop.find({ farmerId: { $in: ids }, $or: [{ id: { $in: cropIds } }, { cropId: { $in: cropIds } }] }).lean()
      : [];
    const cropMap = new Map(crops.map((c) => [c.id, c]));
    crops.forEach((c) => cropMap.set(c.cropId, c));
    res.json(upgraded.map((p) => publicMyProduct(p, farmer, cropMap.get(p.cropId))));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load products" });
  }
}

export async function getMyProduct(req, res) {
  try {
    const product = await loadOwnProduct(req, res);
    if (!product) return;
    const upgraded = await upgradeFarmerProductId(product);
    const farmer = await Farmer.findOne({ id: upgraded.farmerId });
    const crop = upgraded.cropId
      ? await FarmerCrop.findOne({ farmerId: upgraded.farmerId, $or: [{ id: upgraded.cropId }, { cropId: upgraded.cropId }] })
      : null;
    res.json(publicMyProduct(upgraded, farmer, crop));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load product" });
  }
}

export async function createMyProduct(req, res) {
  try {
    const farmerId = authFarmerId(req);
    const farmer = await Farmer.findOne({ id: farmerId });
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const publish = Boolean(req.body?.publish);
    const parsed = validateMyProductPayload(req.body || {}, { publish });
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    let crop = null;
    if (parsed.cropId) {
      crop = await FarmerCrop.findOne({ farmerId, $or: [{ id: parsed.cropId }, { cropId: parsed.cropId }] });
      if (!crop) return res.status(400).json({ message: "Selected crop was not found on your farm" });
      parsed.cropName = parsed.cropName || crop.cropName;
      parsed.variety = parsed.variety || crop.variety;
    }

    const { id, productId, cropBusinessId } = await resolveProductIdsFromCrop(
      farmer,
      crop,
      parsed.cropName,
      parsed.variety
    );
    if (cropBusinessId) parsed.cropId = cropBusinessId;
    else if (crop) parsed.cropId = crop.cropId || crop.id;

    const status = publish ? "Pending Approval" : "Draft";
    const product = new FarmerProduct({
      id,
      productId,
      vendorId: farmer.vendorId,
      managerId: farmer.managerId,
      farmerId,
      sku: farmerSku(farmerId),
      status,
    });
    applyProductFields(product, parsed, farmer, crop);
    if (!publish) {
      product.status = "Draft";
    }
    await product.save();
    await upgradeFarmerProductId(product);
    await syncFarmerProductToErp(product, farmer, crop);
    res.status(201).json(publicMyProduct(product, farmer, crop));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create product" });
  }
}

export async function createManagedFarmerProduct(req, res) {
  try {
    const { farmerId } = req.params;
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const publish = Boolean(req.body?.publish);
    const parsed = validateMyProductPayload(req.body || {}, { publish });
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    let crop = null;
    if (parsed.cropId) {
      crop = await FarmerCrop.findOne({
        farmerId: { $in: farmerIdentityIds(farmer, farmerId) },
        $or: [{ id: parsed.cropId }, { cropId: parsed.cropId }],
      });
      if (!crop) return res.status(400).json({ message: "Selected crop was not found on this farm" });
      parsed.cropName = parsed.cropName || crop.cropName;
      parsed.variety = parsed.variety || crop.variety;
    }

    const { id, productId, cropBusinessId } = await resolveProductIdsFromCrop(
      farmer,
      crop,
      parsed.cropName,
      parsed.variety
    );
    if (cropBusinessId) parsed.cropId = cropBusinessId;
    else if (crop) parsed.cropId = crop.cropId || crop.id;

    const product = new FarmerProduct({
      id,
      productId,
      vendorId: farmer.vendorId,
      managerId: farmer.managerId,
      farmerId: farmer.id,
      sku: farmerSku(farmer.id),
      status: "Draft",
    });
    applyProductFields(product, parsed, farmer, crop);
    if (publish) {
      product.status = applyStockDrivenStatus("Active", parsed.availableQuantity, parsed.lowStockLimit);
      product.reviewedBy = req.user?.name || req.user?.role || "";
      product.reviewedAt = new Date();
    } else {
      product.status = "Draft";
    }
    await product.save();
    await upgradeFarmerProductId(product);
    await syncFarmerProductToErp(product, farmer, crop);
    if (isStaffChange(req)) pushFarmerProductChange(product, { isNew: true });
    res.status(201).json(publicMyProduct(product, farmer, crop));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create product" });
  }
}

export async function updateManagedFarmerProduct(req, res) {
  try {
    const loaded = await loadAccessibleFarmerProduct(req, res);
    if (!loaded) return;
    const { farmer, product } = loaded;
    const current = normalizeProductStatus(product.status);
    if (current === "Pending Approval") {
      return res.status(400).json({ message: "Product is pending approval and cannot be edited" });
    }

    const publish = Boolean(req.body?.publish);
    const parsed = validateMyProductPayload({ ...toPlain(product), ...(req.body || {}), media: req.body?.media || product.media }, { publish });
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    let crop = null;
    if (parsed.cropId) {
      crop = await FarmerCrop.findOne({
        farmerId: { $in: farmerIdentityIds(farmer, req.params.farmerId) },
        $or: [{ id: parsed.cropId }, { cropId: parsed.cropId }],
      });
      if (!crop) return res.status(400).json({ message: "Selected crop was not found on this farm" });
      crop = await ensureSharedCropBusinessId(crop);
      parsed.cropId = crop.cropId || crop.id;
    }

    applyProductFields(product, parsed, farmer, crop);
    if (req.body?.farmLocation) product.farmLocation = String(req.body.farmLocation).trim();
    if (req.body?.availableForDelivery !== undefined) {
      product.availableForDelivery = req.body.availableForDelivery === true || req.body.availableForDelivery === "yes";
    }
    if (req.body?.category) product.category = String(req.body.category).trim();
    if (req.body?.produceType) {
      product.produceType = String(req.body.produceType);
      product.organic = product.produceType !== "non-organic";
    } else if (req.body?.organic !== undefined) {
      product.organic = Boolean(req.body.organic);
      product.produceType = product.organic ? "organic" : "non-organic";
    }
    if (publish) {
      product.status = "Pending Approval";
      product.rejectionReason = "";
    } else if (req.body?.status) {
      const next = normalizeProductStatus(req.body.status);
      if (next === "Pending Approval") {
        const published = validateMyProductPayload({ ...toPlain(product), ...parsed, media: parsed.media }, { publish: true });
        if (published.error) return res.status(400).json({ message: published.error });
        product.status = "Pending Approval";
      } else {
        product.status = next;
      }
    } else if (!LIFECYCLE_LOCKED.includes(current)) {
      product.status = applyStockDrivenStatus(current, parsed.availableQuantity, parsed.lowStockLimit);
    }
    await product.save();
    if (isStaffChange(req)) pushFarmerProductChange(product);
    res.json(publicMyProduct(product, farmer, crop));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update product" });
  }
}

export async function updateMyProduct(req, res) {
  try {
    const product = await loadOwnProduct(req, res);
    if (!product) return;
    const current = normalizeProductStatus(product.status);
    if (current === "Pending Approval") {
      return res.status(400).json({ message: "Product is pending approval and cannot be edited" });
    }

    const publish = Boolean(req.body?.publish);
    const parsed = validateMyProductPayload({ ...toPlain(product), ...(req.body || {}), media: req.body?.media || product.media }, { publish });
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const farmer = await Farmer.findOne({ id: product.farmerId });
    let crop = null;
    if (parsed.cropId) {
      crop = await FarmerCrop.findOne({ farmerId: product.farmerId, $or: [{ id: parsed.cropId }, { cropId: parsed.cropId }] });
      if (crop) {
        crop = await ensureSharedCropBusinessId(crop);
        parsed.cropId = crop.cropId || crop.id;
      }
    }

    applyProductFields(product, parsed, farmer, crop);
    if (publish) {
      product.status = "Pending Approval";
      product.rejectionReason = "";
    } else if (req.body?.status) {
      const next = normalizeProductStatus(req.body.status);
      if (next === "Pending Approval") {
        const published = validateMyProductPayload({ ...toPlain(product), ...parsed, media: parsed.media }, { publish: true });
        if (published.error) return res.status(400).json({ message: published.error });
        product.status = "Pending Approval";
      }
    } else if (!LIFECYCLE_LOCKED.includes(current)) {
      product.status = applyStockDrivenStatus(current, parsed.availableQuantity, parsed.lowStockLimit);
    }
    await product.save();
    res.json(publicMyProduct(product, farmer, crop));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update product" });
  }
}

export async function deleteMyProduct(req, res) {
  try {
    const product = await loadOwnProduct(req, res);
    if (!product) return;
    const status = normalizeProductStatus(product.status);
    if (status !== "Draft" && status !== "Rejected") {
      return res.status(400).json({ message: "Only draft or rejected products can be deleted" });
    }
    await FarmerProduct.deleteOne({ id: product.id, farmerId: product.farmerId });
    await FarmerStockHistory.deleteMany({ productId: product.id, farmerId: product.farmerId });
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete product" });
  }
}

export async function patchMyProductPrice(req, res) {
  try {
    const product = await loadOwnProduct(req, res);
    if (!product) return;
    const status = normalizeProductStatus(product.status);
    if (status === "Pending Approval") {
      return res.status(400).json({ message: "Price cannot be updated while pending approval" });
    }
    const pricePerKg = Number(req.body?.pricePerKg ?? req.body?.sellingPrice);
    if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
      return res.status(400).json({ message: "Selling price must be greater than 0" });
    }
    const nextGrades = req.body?.grades
      ? normalizeProductGrades(req.body.grades).map((g, idx) => ({
          ...(product.grades[idx] ? toPlain(product.grades[idx]) : {}),
          ...g,
          quantity: Number(product.grades[idx]?.quantity ?? g.quantity) || 0,
        }))
      : normalizeProductGrades(product.grades).map((g) => ({
          ...g,
          price: Number(req.body?.grades?.find?.((x) => x.grade === g.grade)?.price ?? g.price) || 0,
        }));

    product.priceHistory = [
      ...(product.priceHistory || []),
      { pricePerKg: product.pricePerKg || product.sellingPrice || 0, grades: normalizeProductGrades(product.grades), at: new Date() },
    ].slice(-20);
    product.pricePerKg = pricePerKg;
    product.sellingPrice = pricePerKg;
    if (req.body?.grades) {
      product.grades = normalizeProductGrades(req.body.grades).map((g, idx) => ({
        ...g,
        quantity: Number(product.grades[idx]?.quantity ?? g.quantity) || 0,
      }));
      product.markModified("grades");
    } else if (product.grades?.length) {
      product.grades = product.grades.map((g) => {
        const row = toPlain(g);
        return { ...row, price: row.price || pricePerKg };
      });
      product.markModified("grades");
    }
    product.markModified("priceHistory");
    await product.save();
    const farmer = await Farmer.findOne({ id: product.farmerId });
    res.json(publicMyProduct(product, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update price" });
  }
}

export async function patchMyProductStock(req, res) {
  try {
    const product = await loadOwnProduct(req, res);
    if (!product) return;
    const status = normalizeProductStatus(product.status);
    if (status === "Pending Approval") {
      return res.status(400).json({ message: "Stock cannot be updated while pending approval" });
    }

    if (Array.isArray(req.body?.adjustments)) {
      return applyProductStockAdjustments(req, res, product, status);
    }

    let grades = normalizeProductGrades(product.grades);
    if (Array.isArray(req.body?.grades) && req.body.grades.length) {
      grades = normalizeProductGrades(req.body.grades);
    } else if (req.body?.availableQuantity != null) {
      const qty = Number(req.body.availableQuantity);
      if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ message: "Available quantity cannot be negative" });
      if (grades.length) {
        grades[0].quantity = qty;
        grades = grades.map((g, idx) => (idx === 0 ? g : { ...g, quantity: 0 }));
      } else {
        grades = [{ id: "g-a", grade: "A", label: "Grade A", quantity: qty, price: product.pricePerKg || 0 }];
      }
    }
    if (grades.some((g) => g.quantity < 0)) {
      return res.status(400).json({ message: "Grade quantity cannot be negative" });
    }

    const previous = Number(product.availableQuantity || product.stock || 0);
    const nextQty = totalGradeQty(grades);
    product.grades = grades;
    product.availableQuantity = nextQty;
    product.stock = nextQty;
    applyGradeQtyFields(product, grades);
    if (req.body?.lowStockLimit != null) {
      const limit = Number(req.body.lowStockLimit);
      if (!Number.isFinite(limit) || limit < 0) return res.status(400).json({ message: "Low stock threshold cannot be negative" });
      product.lowStockLimit = limit;
    }
    if (req.body?.availableFrom) product.availableFrom = String(req.body.availableFrom);
    if (req.body?.availableUntil) product.availableUntil = String(req.body.availableUntil);
    if (req.body?.minimumOrderQuantity != null) {
      const moq = Number(req.body.minimumOrderQuantity);
      if (!Number.isFinite(moq) || moq <= 0) return res.status(400).json({ message: "Minimum order quantity must be greater than 0" });
      product.minimumOrderQuantity = moq;
    }
    product.status = applyStockDrivenStatus(status, nextQty, product.lowStockLimit);
    product.markModified("grades");
    await product.save();

    if (previous !== nextQty) {
      await FarmerStockHistory.create({
        id: `sh-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`,
        vendorId: product.vendorId,
        managerId: product.managerId,
        farmerId: product.farmerId,
        productId: product.id,
        productName: product.name,
        grade: "All Grades",
        action: nextQty > previous ? "Stock Added" : "Stock Reduced",
        previousStock: previous,
        changedQuantity: nextQty - previous,
        newStock: nextQty,
        reason: "Manual Update",
        updatedBy: "Farmer",
        reference: "STOCK",
      });
    }

    const farmer = await Farmer.findOne({ id: product.farmerId });
    res.json(publicMyProduct(product, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update stock" });
  }
}

/** The product's grades, falling back to A/B/C built from the legacy per-grade quantity fields. */
function stockGradesOf(product) {
  const price = Number(product.pricePerKg || product.sellingPrice || product.gradeAPrice || 0);
  const grades = normalizeProductGrades(product.grades);
  if (grades.length) return ensureAbcGrades(grades, price);
  return ensureAbcGrades(
    [
      { grade: "A", quantity: Number(product.gradeAQty) || 0, price: Number(product.gradeAPrice) || price },
      { grade: "B", quantity: Number(product.gradeBQty) || 0, price: Number(product.gradeBPrice) || 0 },
      { grade: "C", quantity: Number(product.gradeCQty) || 0, price: Number(product.gradeCPrice) || 0 },
    ],
    price
  );
}

const gradeKeyOf = (value) =>
  String(value || "").replace(/grade\s*/i, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();

/**
 * Body: { adjustments: [{ grade: "A", change: 10 }, { grade: "B", change: -5 }], reason? }.
 * Each change is added to (positive) or deducted from (negative) that grade's current quantity;
 * the total is always the sum of the grades.
 */
async function applyProductStockAdjustments(req, res, product, status) {
  const grades = stockGradesOf(product);
  const unit = product.unit || "Kg";
  const changes = [];
  for (const adj of req.body.adjustments) {
    const key = gradeKeyOf(adj?.grade || adj?.label);
    const change = Math.round(Number(adj?.change) * 1000) / 1000;
    if (!key) return res.status(400).json({ message: "Each stock change needs a grade" });
    if (!Number.isFinite(change)) return res.status(400).json({ message: `Enter a valid quantity for Grade ${key}` });
    if (change === 0) continue;
    let idx = grades.findIndex((g) => g.grade === key);
    if (idx < 0) {
      if (change < 0) return res.status(400).json({ message: `Grade ${key} has no stock to deduct` });
      grades.push({ id: `g-${key.toLowerCase()}-${grades.length}`, grade: key, label: `Grade ${key}`, quantity: 0, price: 0 });
      idx = grades.length - 1;
    }
    const previous = Number(grades[idx].quantity) || 0;
    const next = Math.round((previous + change) * 1000) / 1000;
    if (next < 0) {
      return res.status(400).json({
        message: `Grade ${key} has only ${previous} ${unit} — cannot deduct ${Math.abs(change)} ${unit}`,
      });
    }
    grades[idx].quantity = next;
    changes.push({ label: grades[idx].label, previous, change, next });
  }
  if (!changes.length) return res.status(400).json({ message: "Enter a quantity to add or deduct" });

  const nextGrades = ensureAbcGrades(grades, Number(product.pricePerKg || product.sellingPrice) || 0);
  const total = totalGradeQty(nextGrades);
  product.grades = nextGrades;
  product.availableQuantity = total;
  product.stock = total;
  applyGradeQtyFields(product, nextGrades);
  product.status = applyStockDrivenStatus(status, total, product.lowStockLimit);
  product.markModified("grades");
  await product.save();

  const reason = String(req.body?.reason || "").trim().slice(0, 200);
  const stamp = Date.now();
  await FarmerStockHistory.insertMany(
    changes.map((c, i) => ({
      id: `sh-${stamp}-${i}-${crypto.randomBytes(2).toString("hex")}`,
      vendorId: product.vendorId,
      managerId: product.managerId,
      farmerId: product.farmerId,
      productId: product.id,
      productName: product.name,
      grade: c.label,
      action: c.change > 0 ? "Stock Added" : "Stock Reduced",
      previousStock: c.previous,
      changedQuantity: c.change,
      newStock: c.next,
      reason: reason || (c.change > 0 ? "Stock added by farmer" : "Stock deducted by farmer"),
      updatedBy: "Farmer",
      reference: "STOCK",
      at: new Date(),
    }))
  );

  const farmer = await Farmer.findOne({ id: product.farmerId });
  return res.json(publicMyProduct(product, farmer));
}

/** Every product stock of the vendor's farmers, grade-wise, for the vendor "All Farmer Inventory" page. */
export async function listVendorFarmerInventory(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    const farmers = await Farmer.find({ vendorId }).select("id farmerId farmerCode name mobile address.village").lean();
    const { ids, farmerMap } = indexFarmersByIdentity(farmers);
    if (!ids.length) return res.json({ items: [] });
    const products = await FarmerProduct.find({ farmerId: { $in: ids }, isDeleted: { $ne: true } })
      .select("id productId sku name productName variety category unit grades gradeAQty gradeBQty gradeCQty gradeAPrice gradeBPrice gradeCPrice stock availableQuantity reservedQuantity lowStockLimit status farmerId updatedAt")
      .sort({ updatedAt: -1 })
      .lean();
    const items = products.map((p) => {
      const f = farmerMap.get(p.farmerId) || {};
      const grades = stockGradesOf(p).map(({ grade, label, quantity, price }) => ({ grade, label, quantity, price }));
      const total = totalGradeQty(grades);
      const reserved = Number(p.reservedQuantity || 0);
      return {
        id: p.id,
        productId: p.productId || p.id,
        sku: p.sku || "",
        name: p.name || p.productName || "",
        variety: p.variety || "",
        category: p.category || "",
        unit: p.unit || "Kg",
        grades,
        gradeAQty: qtyForGrade(grades, "A"),
        gradeBQty: qtyForGrade(grades, "B"),
        gradeCQty: qtyForGrade(grades, "C"),
        totalQuantity: total,
        reservedQuantity: reserved,
        availableQuantity: Math.max(0, total - reserved),
        lowStockLimit: Number(p.lowStockLimit || 10),
        status: stockStatusOf({ ...p, availableQuantity: total }),
        farmerId: f.id || p.farmerId,
        farmerCode: f.farmerCode || f.farmerId || "",
        farmerName: f.name || "",
        farmerMobile: f.mobile || "",
        farmerVillage: f.address?.village || "",
        updatedAt: p.updatedAt,
      };
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch farmer inventory" });
  }
}

export async function patchMyProductStatus(req, res) {
  try {
    const product = await loadOwnProduct(req, res);
    if (!product) return;
    const current = normalizeProductStatus(product.status);
    const next = normalizeProductStatus(req.body?.status);
    const allowed = {
      Draft: ["Draft", "Pending Approval"],
      Rejected: ["Rejected", "Draft", "Pending Approval"],
      "Pending Approval": ["Pending Approval"],
      Active: ["Active", "Paused"],
      "Low Stock": ["Low Stock", "Paused", "Active"],
      "Out of Stock": ["Out of Stock", "Paused"],
      Paused: ["Paused", "Active"],
    };
    if (!(allowed[current] || []).includes(next)) {
      return res.status(400).json({ message: `Cannot change status from ${current} to ${next}` });
    }
    if (next === "Pending Approval") {
      const parsed = validateMyProductPayload({ ...toPlain(product), media: product.media }, { publish: true });
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      product.rejectionReason = "";
    }
    if (next === "Active") {
      product.status = applyStockDrivenStatus("Active", product.availableQuantity, product.lowStockLimit);
    } else {
      product.status = next;
    }
    await product.save();
    const farmer = await Farmer.findOne({ id: product.farmerId });
    res.json(publicMyProduct(product, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update status" });
  }
}

async function resolveFarmerIdentity(farmerId) {
  const farmer = await Farmer.findOne({
    $or: [{ id: farmerId }, { farmerId }],
  }).lean();
  const ids = [...new Set([farmerId, farmer?.id, farmer?.farmerId].filter(Boolean))];
  return { farmer, ids };
}

function productSellable(product) {
  const physical = Number(product?.availableQuantity ?? product?.stock ?? 0);
  const reserved = Number(product?.reservedQuantity || 0);
  return Math.max(0, physical - reserved);
}

function flattenOrderFields(order) {
  const plain = toPlain(order);
  const first = plain.products?.[0] || {};
  const orderedQuantity = Number(plain.orderedQuantity || plain.totalQuantity || first.quantity || 0);
  const price = Number(plain.price || first.price || 0);
  const orderValue = Number(plain.orderValue || first.total || plain.totalAmount || plain.amount || orderedQuantity * price);
  return {
    productId: plain.productId || first.id || first.productId || "",
    productName: plain.productName || first.name || "",
    variety: plain.variety || "",
    grade: plain.grade || first.grade || "",
    orderedQuantity,
    unit: plain.unit || first.unit || "Kg",
    price,
    orderValue,
  };
}

function publicMyOrder(order, extra = {}) {
  const plain = toPlain(order);
  const flat = flattenOrderFields(plain);
  const status = normalizeOrderStatus(plain.status);
  return {
    ...plain,
    ...flat,
    orderId: plain.orderId || plain.id,
    status,
    customerName: plain.customer?.name || "Customer",
    customerDeliveryArea: plain.customerDeliveryArea || plain.customer?.address || "",
    requiredDate: plain.requiredDate || plain.harvestDate || "",
    pickupDate: plain.pickupDate || "",
    collectionCentre: plain.collectionCentre || "",
    reservedQuantity: Number(plain.reservedQuantity || 0),
    packedQuantity: Number(plain.packedQuantity || 0),
    preparationStatus: plain.preparationStatus || (status === "NEW" ? "NOT_STARTED" : status === "READY_FOR_PICKUP" ? "READY_FOR_PICKUP" : status === "PACKING" ? "PACKING" : status === "PREPARING" || status === "ACCEPTED" ? "PREPARING" : "NOT_STARTED"),
    packingDetails: plain.packingDetails || {},
    ...extra,
    qrPayload: extra.qrPayload || qrPayloadFor(order, extra) || `greengrocc:order:${plain.orderId || plain.id}`,
  };
}

async function loadOwnOrder(req, res) {
  let ids = [];
  if (req.user?.role === "FARMER_MANAGER") {
    const farmers = await getAssignedFarmers(req);
    ids = farmers.flatMap((f) => [f.id, f.farmerId].filter(Boolean));
  } else {
    const farmerId = authFarmerId(req);
    const resolved = await resolveFarmerIdentity(farmerId);
    ids = resolved.ids;
  }
  const orderId = req.params.orderId;
  let order = await FarmerOrder.findOne({
    farmerId: { $in: ids },
    $or: [{ id: orderId }, { orderId }],
  });
  if (!order) {
    const token = String(orderId || "").replace(/^ggp\./i, "");
    const pickup = await Pickup.findOne({
      farmerId: { $in: ids },
      $or: [{ qrPayload: orderId }, { qrToken: token }, { qrPayload: `ggp.${token}` }],
    }).lean();
    if (pickup) {
      order = await FarmerOrder.findOne({
        farmerId: { $in: ids },
        $or: [{ id: pickup.orderId }, { orderId: pickup.orderId }],
      });
    }
  }
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return null;
  }
  return order;
}

function pushOrderTimeline(order, status, note) {
  order.timeline = [...(order.timeline || []), { status, at: new Date(), note }];
}

async function syncLinkedHarvestOrder(order, patch) {
  const ids = [...new Set([order.id, order.orderId].filter(Boolean))];
  if (!ids.length) return;
  await FarmerHarvestOrder.updateMany({ id: { $in: ids } }, { $set: patch });
}

async function emitOrderStatusUpdate(order, extra = {}) {
  try {
    const io = getIO();
    const plain = toPlain(order) || order;
    const farmer = await Farmer.findOne({
      $or: [{ id: plain.farmerId }, { farmerId: plain.farmerId }],
    })
      .select("id farmerId managerId vendorId")
      .lean();
    const payload = {
      orderId: plain.id || plain.orderId,
      farmerId: plain.farmerId,
      vendorId: plain.vendorId || farmer?.vendorId || "",
      managerId: farmer?.managerId || "",
      status: normalizeOrderStatus(plain.status),
      rejectionReason: plain.rejectionReason || "",
      rejectionNote: plain.rejectionNote || "",
      rejectedBy: plain.rejectedBy || "",
      ...extra,
    };
    const rooms = new Set();
    [plain.farmerId, farmer?.id, farmer?.farmerId]
      .filter(Boolean)
      .forEach((id) => rooms.add(`farmer_${id}`));
    if (payload.managerId) rooms.add(`manager_${payload.managerId}`);
    if (payload.vendorId) rooms.add(`vendor_${payload.vendorId}`);
    rooms.forEach((room) => io.to(room).emit("order_updated", payload));
  } catch {
    // Socket is optional; panels poll as fallback.
  }
}

async function persistOrderStatusSideEffects(order, extra = {}) {
  await syncLinkedHarvestOrder(order, {
    status: normalizeOrderStatus(order.status),
    rejectionReason: order.rejectionReason || "",
  });
  await emitOrderStatusUpdate(order, extra);
}

async function loadOrderProduct(order) {
  const flat = flattenOrderFields(order);
  if (!flat.productId) return null;
  return FarmerProduct.findOne({
    farmerId: order.farmerId,
    $or: [{ id: flat.productId }, { productId: flat.productId }],
  });
}

function cachedProduct(products, farmerId, productId) {
  if (!productId || !products?.length) return null;
  const fid = String(farmerId || "");
  const pid = String(productId);
  return products.find((p) => String(p.farmerId) === fid && (String(p.id) === pid || String(p.productId) === pid)) || null;
}

async function enrichOwnOrder(order, farmer, inspectionDoc = null, preloaded = null) {
  const flat = flattenOrderFields(order);
  const product = preloaded
    ? cachedProduct(preloaded.products, order.farmerId, flat.productId)
    : await loadOrderProduct(order);
  const pickup = preloaded
    ? preloaded.pickups.get(String(order.id)) || preloaded.pickups.get(String(order.orderId || "")) || null
    : await Pickup.findOne({
        $or: [{ orderId: order.id }, { orderId: order.orderId }],
      }).lean();
  const driver = preloaded
    ? (pickup?.driverId ? preloaded.drivers.get(String(pickup.driverId)) || null : null)
    : pickup?.driverId
      ? await PickupDriver.findOne({ id: pickup.driverId })
          .select("name mobile vehicleNumber vehicleType licenseNumber assignedArea")
          .lean()
      : null;
  let inspection = inspectionDoc;
  if (!inspection && !preloaded) {
    inspection = await QualityInspection.findOne({
      $or: [{ orderId: order.id }, { orderId: order.orderId }],
    }).lean();
  }
  const sellable = productSellable(product);
  const qualityOverlay = overlayQualityOnOrder(toPlain(order), inspection);
  const qrPayload = qrPayloadFor(order, {
    farmer,
    pickup,
    farmerName: farmer?.name || "",
    farmerMobile: farmer?.mobile || "",
    farmerLocation: pickup?.pickupLocation || "",
    collectionCentreName: order.collectionCentre || "",
    packedQuantity: pickup?.packedQuantity || order.packedQuantity,
    packageCount: pickup?.packageCount || order?.packingDetails?.packageCount,
    driverId: pickup?.driverId || "",
    driverName: driver?.name || pickup?.driverName || "",
    vehicleNumber: driver?.vehicleNumber || pickup?.vehicleNumber || "",
  });
  const farmerCode = farmer?.farmerCode || farmer?.farmerId || farmer?.id || order.farmerId || "";
  const farmerVillage = farmer?.farmGeo?.village || farmer?.address?.village || farmer?.farmLocation || "";
  const farmerAddress = farmer?.farmAddress || [
    farmer?.address?.village,
    farmer?.address?.taluka,
    farmer?.address?.district,
    farmer?.address?.state,
  ].filter(Boolean).join(", ") || farmer?.farmLocation || "";
  const vendorId = order.vendorId || farmer?.vendorId || "";
  const vendor = preloaded?.vendors
    ? (vendorId ? preloaded.vendors.get(String(vendorId)) || null : null)
    : vendorId
      ? await Vendor.findOne({ $or: [{ id: vendorId }, { vendorId }] })
          .select("id vendorId vendorCode vendorName ownerName mobile phone businessName businessAddress city state pincode email gstNumber")
          .lean()
      : null;

  return publicMyOrder(order, {
    farmerId: farmer?.id || order.farmerId || "",
    farmerCode,
    farmerName: farmer?.name || "",
    farmerMobile: farmer?.mobile || "",
    farmerEmail: farmer?.email || "",
    farmerVillage,
    farmerTaluka: farmer?.address?.taluka || farmer?.farmGeo?.taluka || "",
    farmerDistrict: farmer?.address?.district || farmer?.farmGeo?.district || "",
    farmerState: farmer?.address?.state || farmer?.farmGeo?.state || "",
    farmerPincode: farmer?.address?.pincode || "",
    farmerAddress,
    farmerFarmName: farmer?.farmName || "",
    farmerFarmArea: farmer?.farmArea || "",
    farmerFarmType: farmer?.farmType || "",
    farmerLocation: farmer?.farmLocation || farmerAddress || farmerVillage,
    farmerBank: farmer?.bank || null,
    vendorId,
    vendorCode: vendor?.vendorCode || vendor?.vendorId || vendorId || "",
    vendorName: vendor?.vendorName || vendor?.businessName || vendor?.ownerName || (vendorId ? "Assigned Vendor" : ""),
    vendorOwnerName: vendor?.ownerName || vendor?.vendorName || "",
    vendorMobile: vendor?.mobile || vendor?.phone || "",
    vendorPhone: vendor?.mobile || vendor?.phone || "",
    vendorEmail: vendor?.email || "",
    vendorBusinessName: vendor?.businessName || "",
    vendorAddress: vendor?.businessAddress || [vendor?.city, vendor?.state, vendor?.pincode].filter(Boolean).join(", ") || "",
    vendorCity: vendor?.city || "",
    vendorState: vendor?.state || "",
    vendorPincode: vendor?.pincode || "",
    vendorGstNumber: vendor?.gstNumber || "",
    timeline: order.timeline || [],
    customerName: order.customer?.name || "Customer",
    customerPhone: order.customer?.phone || "",
    customerAddress: order.customer?.address || order.customerDeliveryArea || "",
    harvestDate: order.harvestDate || product?.harvestDate || "",
    availableStock: sellable,
    productStock: product
      ? {
          productId: product.id,
          productName: product.productName || product.name,
          availableQuantity: Number(product.availableQuantity ?? product.stock ?? 0),
          reservedQuantity: Number(product.reservedQuantity || 0),
          sellableQuantity: sellable,
          unit: product.unit || "Kg",
        }
      : null,
    pickup: pickup
      ? {
          pickupId: pickup.pickupId || pickup.id,
          status: pickup.status,
          driverStatus: pickup.driverStatus || pickup.status || "",
          liveStatus:
            {
              READY_FOR_PICKUP: "Ready for pickup",
              DRIVER_ASSIGNED: "Assigned",
              PICKUP_SCHEDULED: "Assigned",
              DISPATCHED: "On the way to farm",
              DRIVER_ARRIVED: "Reached the farm",
              ORDER_VERIFIED: "Order checked",
              QR_VERIFIED: "QR verified",
              PICKED_UP: "Pickup confirmed",
              PICKUP_CONFIRMED: "Pickup confirmed",
              IN_TRANSIT: "On the way to centre",
              ARRIVED_AT_CENTRE: "At collection centre",
              COLLECTION_CENTRE_RECEIVED: "Received",
              RECEIVED_AT_COLLECTION_CENTRE: "Received",
            }[pickup.status] || String(pickup.status || "").replace(/_/g, " "),
          driverId: pickup.driverId || "",
          driverName: driver?.name || pickup?.driverName || "",
          driverMobile: driver?.mobile || pickup?.driverMobile || "",
          vehicleNumber: driver?.vehicleNumber || pickup?.vehicleNumber || "",
          vehicleType: driver?.vehicleType || "",
          licenseNumber: driver?.licenseNumber || "",
          assignedArea: driver?.assignedArea || "",
          pickupDate: pickup.pickupDate || pickup.scheduledDate || "",
          pickupTime: pickup.pickupTime || pickup.scheduledTime || "",
          pickupLocation: pickup.pickupLocation || "",
          packageCount: pickup.packageCount || 0,
          packedQuantity: pickup.packedQuantity || 0,
          collectionCentreId: pickup.collectionCentreId || "",
          pickupConfirmed: Boolean(pickup.pickupConfirmed),
          assignedAt: pickup.assignedAt || null,
          dispatchStartedAt: pickup.dispatchStartedAt || pickup.startedAt || null,
          arrivedAt: pickup.arrivedAt || null,
          orderVerifiedAt: pickup.orderVerifiedAt || null,
          qrVerifiedAt: pickup.qrVerifiedAt || null,
          pickupConfirmedAt: pickup.pickupConfirmedAt || null,
          pickupInstructions: pickup.pickupInstructions || "",
          qrPayload,
          timeline: pickup.timeline || [],
          confirmationPhotos: pickup.confirmationPhotos || [],
        }
      : null,
    pickupDate: pickup?.pickupDate || pickup?.scheduledDate || order.pickupDate || "",
    pickupTime: pickup?.pickupTime || pickup?.scheduledTime || order.pickupTime || "",
    driverId: pickup?.driverId || "",
    driverName: driver?.name || pickup?.driverName || order.driverName || "",
    driverMobile: driver?.mobile || pickup?.driverMobile || order.driverMobile || order.driverPhone || "",
    driverPhone: driver?.mobile || pickup?.driverMobile || order.driverMobile || order.driverPhone || "",
    vehicleNumber: driver?.vehicleNumber || pickup?.vehicleNumber || order.vehicleNumber || "",
    driverStatus: pickup?.driverStatus || pickup?.status || "",
    hasDriverAssigned: Boolean(
      (driver?.name && driver.name.trim().length > 0) ||
      (pickup?.driverName && pickup.driverName.trim().length > 0) ||
      (pickup?.driverId && pickup.driverId.trim().length > 0)
    ),
    qrPayload,
    ...qualityOverlay,
  });
}

export async function listMyOrders(req, res) {
  try {
    const filter = String(req.query.filter || "").toLowerCase();
    const q = String(req.query.q || "").trim().toLowerCase();

    let farmers = [];
    let ids = [];
    if (req.user?.role === "FARMER_MANAGER") {
      farmers = attachFarmerMeta(await getAssignedFarmers(req));
      ids = farmers.flatMap((f) => [f.id, f.farmerId].filter(Boolean));
    } else {
      const farmerId = authFarmerId(req);
      const resolved = await resolveFarmerIdentity(farmerId);
      if (resolved.farmer) farmers = [resolved.farmer];
      ids = resolved.ids;
    }

    const orderQuery = { farmerId: { $in: ids }, isDeleted: { $ne: true } };

    // Farmer App rule: Only the farmer's assigned vendor can send orders to the farmer.
    // If the requester is a farmer (or farmer app), only return orders from their assigned vendor.
    if (req.user?.role === "FARMER" || (!req.user?.role && ids.length)) {
      const farmerDoc = farmers[0];
      const assignedVendorId = String(farmerDoc?.vendorId || "").trim();
      if (!assignedVendorId) {
        // Farmer has no assigned vendor; no one can send orders to this farmer.
        return res.json([]);
      }
      orderQuery.vendorId = assignedVendorId;
    }

    const orders = await FarmerOrder.find(orderQuery).sort({ createdAt: -1, orderDate: -1 }).lean();
    const orderIds = [...new Set(orders.flatMap((o) => [o.id, o.orderId].filter(Boolean)).map(String))];
    const productIds = [...new Set(orders.map((o) => flattenOrderFields(o).productId).filter(Boolean))];
    const vendorIds = [...new Set(orders.map((o) => o.vendorId).filter(Boolean).map(String))];

    const [inspections, pickups, products, vendors] = await Promise.all([
      orderIds.length ? QualityInspection.find({ orderId: { $in: orderIds } }).select(INSPECTION_LIST_EXCLUDE).lean() : [],
      orderIds.length ? Pickup.find({ orderId: { $in: orderIds } }).select(PICKUP_LIST_EXCLUDE).lean() : [],
      productIds.length
        ? FarmerProduct.find({
            farmerId: { $in: ids },
            $or: [{ id: { $in: productIds } }, { productId: { $in: productIds } }],
          })
            .select("id productId farmerId productName name availableQuantity stock reservedQuantity unit harvestDate")
            .lean()
        : [],
      vendorIds.length
        ? Vendor.find({ $or: [{ id: { $in: vendorIds } }, { vendorId: { $in: vendorIds } }] })
            .select("id vendorId vendorCode vendorName ownerName mobile phone businessName businessAddress city state pincode email gstNumber")
            .lean()
        : [],
    ]);
    const inspectionByOrder = new Map();
    inspections.forEach((item) => {
      if (item?.orderId) inspectionByOrder.set(String(item.orderId), item);
    });
    const pickupByOrder = new Map();
    pickups.forEach((item) => {
      if (item?.orderId) pickupByOrder.set(String(item.orderId), item);
    });
    const driverIds = [...new Set(pickups.map((item) => item.driverId).filter(Boolean).map(String))];

    const vendorMap = new Map();
    vendors.forEach((v) => {
      if (v.id) vendorMap.set(String(v.id), v);
      if (v.vendorId) vendorMap.set(String(v.vendorId), v);
    });

    const farmerMap = new Map();
    farmers.forEach((f) => {
      if (f.id) farmerMap.set(String(f.id), f);
      if (f.farmerId) farmerMap.set(String(f.farmerId), f);
    });
    const missingFarmerIds = [...new Set(orders.map((order) => String(order.farmerId || "")).filter((id) => id && !farmerMap.has(id)))];

    const [drivers, extraFarmers] = await Promise.all([
      driverIds.length
        ? PickupDriver.find({ id: { $in: driverIds } })
            .select("id name mobile vehicleNumber vehicleType licenseNumber assignedArea")
            .lean()
        : [],
      missingFarmerIds.length
        ? Farmer.find({
            $or: [{ id: { $in: missingFarmerIds } }, { farmerId: { $in: missingFarmerIds } }],
          })
            .select(FARMER_LIST_EXCLUDE)
            .lean()
        : [],
    ]);
    const driverById = new Map(drivers.map((driver) => [String(driver.id), driver]));
    extraFarmers.forEach((f) => {
      if (f.id) farmerMap.set(String(f.id), f);
      if (f.farmerId) farmerMap.set(String(f.farmerId), f);
    });
    const preloaded = { products, pickups: pickupByOrder, drivers: driverById, vendors: vendorMap };

    let rows = [];
    for (const order of orders) {
      const status = normalizeOrderStatus(order.status);
      if (filter && ORDER_FILTERS[filter] && !ORDER_FILTERS[filter].includes(status)) continue;
      const inspection =
        inspectionByOrder.get(String(order.id)) || inspectionByOrder.get(String(order.orderId || "")) || null;
      const farmer =
        farmerMap.get(String(order.farmerId)) ||
        farmers[0];
      const row = await enrichOwnOrder(order, farmer, inspection, preloaded);
      if (q) {
        const hay = `${row.orderId} ${row.productName} ${row.customerName} ${row.variety} ${farmer?.name || ""}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      rows.push(row);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load orders" });
  }
}

export async function getMyOrder(req, res) {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    const farmer = await Farmer.findOne({ $or: [{ id: order.farmerId }, { farmerId: order.farmerId }] });
    res.json(await enrichOwnOrder(order, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load order" });
  }
}

export async function getMyQualityReport(req, res) {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    const farmer = await Farmer.findOne({ id: order.farmerId });
    const pickup = await Pickup.findOne({
      $or: [{ orderId: order.id }, { orderId: order.orderId }],
    }).lean();
    const inspection = await QualityInspection.findOne({
      $or: [{ orderId: order.id }, { orderId: order.orderId }],
    }).lean();
    if (!inspection || !["GRADE_CONFIRMED", "ORDER_COMPLETED"].includes(inspection.status)) {
      return res.status(404).json({ message: "Quality report is available after grading is confirmed" });
    }
    const centre = pickup?.collectionCentreId
      ? await CollectionCentre.findOne({ id: pickup.collectionCentreId }).lean()
      : null;
    const presented = await presentInspection(inspection, pickup, order, farmer, centre);
    const overlay = overlayQualityOnOrder(toPlain(order), inspection);
    const enriched = await enrichOwnOrder(order, farmer, inspection);
    res.json({
      ...presented,
      order: enriched,
      orderedGrades: overlay.orderedGrades?.length ? overlay.orderedGrades : presented.orderedGrades,
      finalStatement: overlay.finalStatement?.length
        ? overlay.finalStatement
        : overlay.grades?.length
          ? overlay.grades
          : presented.finalStatement || [],
      grades: overlay.grades?.length ? overlay.grades : presented.grades,
      gradeAAssigned: overlay.gradeAAssigned ?? presented.gradeAAssigned ?? presented.gradeAQuantity,
      gradeBAssigned: overlay.gradeBAssigned ?? presented.gradeBAssigned ?? presented.gradeBQuantity,
      gradeCAssigned: overlay.gradeCAssigned ?? presented.gradeCAssigned ?? presented.gradeCQuantity,
      gradeARejected: overlay.gradeARejected ?? 0,
      gradeBRejected: overlay.gradeBRejected ?? 0,
      gradeCRejected: overlay.gradeCRejected ?? 0,
      totalAmount: overlay.totalAmount ?? presented.finalAmount,
      orderValue: overlay.orderValue ?? presented.finalAmount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load quality report" });
  }
}

export async function deductFarmerOrderInventory(order, linkedProduct = null) {
  if (!order || order.inventoryDeducted) return;
  const flat = flattenOrderFields(order);
  const qty = Number(flat.orderedQuantity || order.orderedQuantity || order.quantity || order.totalQuantity || 0);
  if (!(qty > 0)) return;

  const product = linkedProduct || (await loadOrderProduct(order));
  if (!product) return;

  // Grade deductions
  const gradeDeductions = {};
  const rawGrades = Array.isArray(order.grades) && order.grades.length
    ? order.grades
    : (Array.isArray(order.orderedGrades) && order.orderedGrades.length ? order.orderedGrades : null);

  if (rawGrades) {
    for (const g of rawGrades) {
      if (!g) continue;
      const gLabel = String(g.label || g.grade || g.gradeName || g.name || "").trim().toUpperCase();
      const gQty = Number(g.quantity ?? g.qty ?? g.assignedQuantity ?? 0);
      if (gQty > 0) {
        const key = gLabel.includes("B") ? "Grade B" : (gLabel.includes("C") ? "Grade C" : "Grade A");
        gradeDeductions[key] = (gradeDeductions[key] || 0) + gQty;
      }
    }
  }

  if (!Object.keys(gradeDeductions).length && Array.isArray(order.products) && order.products.length) {
    for (const p of order.products) {
      if (!p) continue;
      const pGrade = String(p.grade || p.gradeName || "").trim().toUpperCase();
      const pQty = Number(p.quantity ?? p.qty ?? 0);
      if (pQty > 0) {
        const key = pGrade.includes("B") ? "Grade B" : (pGrade.includes("C") ? "Grade C" : "Grade A");
        gradeDeductions[key] = (gradeDeductions[key] || 0) + pQty;
      }
    }
  }

  if (!Object.keys(gradeDeductions).length) {
    const orderGrade = String(flat.grade || order.grade || "").trim().toUpperCase();
    const key = orderGrade.includes("B") ? "Grade B" : (orderGrade.includes("C") ? "Grade C" : "Grade A");
    gradeDeductions[key] = qty;
  }

  if (!Array.isArray(product.grades) || !product.grades.length) {
    product.grades = [
      { id: "g-a", grade: "A", label: "Grade A", quantity: Number(product.gradeAQty || product.stock || 0), price: Number(product.pricePerKg || product.sellingPrice || 0) },
      { id: "g-b", grade: "B", label: "Grade B", quantity: Number(product.gradeBQty || 0), price: 0 },
      { id: "g-c", grade: "C", label: "Grade C", quantity: 0, price: 0 },
    ];
  }

  const stockHistoryRows = [];
  for (const [gradeKey, deductAmount] of Object.entries(gradeDeductions)) {
    if (!(deductAmount > 0)) continue;
    let gItem = product.grades.find((g) => {
      const lbl = String(g.label || g.grade || g.name || "").trim().toUpperCase();
      if (gradeKey === "Grade A" && (lbl === "A" || lbl.includes("GRADE A") || lbl.includes("GRADE_A"))) return true;
      if (gradeKey === "Grade B" && (lbl === "B" || lbl.includes("GRADE B") || lbl.includes("GRADE_B"))) return true;
      if (gradeKey === "Grade C" && (lbl === "C" || lbl.includes("GRADE C") || lbl.includes("GRADE_C"))) return true;
      return false;
    });

    if (!gItem) {
      const letter = gradeKey.slice(-1);
      gItem = { id: `g-${letter.toLowerCase()}`, grade: letter, label: gradeKey, quantity: 0, price: 0 };
      product.grades.push(gItem);
    }

    const prevQty = Number(gItem.quantity || 0);
    const newQty = Math.max(0, prevQty - deductAmount);
    gItem.quantity = newQty;

    stockHistoryRows.push({
      grade: gradeKey,
      prev: prevQty,
      deduct: deductAmount,
      next: newQty,
    });
  }

  const gradeAItem = product.grades.find((g) => {
    const lbl = String(g.label || g.grade || "").trim().toUpperCase();
    return lbl === "A" || lbl.includes("GRADE A") || lbl.includes("GRADE_A");
  });
  const gradeBItem = product.grades.find((g) => {
    const lbl = String(g.label || g.grade || "").trim().toUpperCase();
    return lbl === "B" || lbl.includes("GRADE B") || lbl.includes("GRADE_B");
  });

  if (gradeAItem) product.gradeAQty = Number(gradeAItem.quantity || 0);
  if (gradeBItem) product.gradeBQty = Number(gradeBItem.quantity || 0);

  const totalStock = product.grades.reduce((sum, g) => sum + Math.max(0, Number(g.quantity || 0)), 0);
  product.stock = totalStock;
  product.availableQuantity = totalStock;
  if (totalStock <= 0) {
    product.status = "Out of Stock";
  }
  product.markModified("grades");
  await product.save();

  for (const h of stockHistoryRows) {
    try {
      await FarmerStockHistory.create({
        id: `fsh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        vendorId: product.vendorId || order.vendorId || "vendor-1",
        managerId: product.managerId || order.managerId || "",
        farmerId: order.farmerId,
        productId: product.id || product.productId || String(product._id),
        productName: product.productName || product.name || flat.productName,
        grade: h.grade,
        action: "Order Accepted",
        previousStock: h.prev,
        changedQuantity: -h.deduct,
        newStock: h.next,
        reason: `Order #${order.orderId || order.id} accepted`,
        updatedBy: "Farmer",
        reference: order.orderId || order.id,
      });
    } catch (histErr) {
      console.warn("[deductFarmerOrderInventory] Stock history logging warning:", histErr.message);
    }
  }

  order.inventoryDeducted = true;
}

/** Farmer managers can act on a farmer's order; tell the farmer when they do. */
function pushIfManagerActed(req, order) {
  if (String(req.user?.role || "").toUpperCase() !== "FARMER_MANAGER") return;
  const plain = toPlain(order);
  pushFarmerOrderChange(
    { ...plain, status: normalizeOrderStatus(plain.status), rejectedBy: plain.rejectedBy === "FARMER" ? "FARMER_MANAGER" : plain.rejectedBy },
    { statusChanged: true }
  );
}

export async function acceptMyOrder(req, res) {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    const current = normalizeOrderStatus(order.status);
    if (current !== "NEW") {
      return res.status(400).json({ message: "Only new orders can be accepted" });
    }

    const flat = flattenOrderFields(order);
    const qty = Number(flat.orderedQuantity || 0);
    if (!(qty > 0)) return res.status(400).json({ message: "Ordered quantity is invalid" });

    const product = await loadOrderProduct(order);
    if (!product) {
      return res.status(400).json({ message: "Ordered product was not found on your farm" });
    }

    await deductFarmerOrderInventory(order, product);

    order.status = "PREPARING";
    order.reservedQuantity = qty;
    order.productId = flat.productId || product.id;
    order.productName = flat.productName || product.productName || product.name;
    order.variety = order.variety || product.variety || "";
    order.grade = flat.grade;
    order.orderedQuantity = qty;
    order.price = flat.price;
    order.orderValue = flat.orderValue;
    order.unit = flat.unit;
    order.acceptedAt = new Date();
    order.preparationStatus = "PREPARING";
    order.preparedAt = new Date();
    if (!order.qrToken) order.qrToken = crypto.randomBytes(12).toString("hex");
    pushOrderTimeline(order, "ACCEPTED", `Order accepted. Deducted ${qty} ${flat.unit || "Kg"} from inventory.`);
    pushOrderTimeline(order, "PREPARING", "Preparation started.");
    await order.save();

    await persistOrderStatusSideEffects(order, { event: "ACCEPTED" });
    pushIfManagerActed(req, order);
    const farmer = await Farmer.findOne({ id: order.farmerId });
    res.json(await enrichOwnOrder(order, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to accept order" });
  }
}

export async function rejectMyOrder(req, res) {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    const current = normalizeOrderStatus(order.status);
    if (current !== "NEW") {
      return res.status(400).json({ message: "Only new orders can be rejected" });
    }
    const reason = String(req.body?.rejectionReason || "").trim();
    const note = String(req.body?.rejectionNote || "").trim();
    if (!REJECTION_REASONS.includes(reason)) {
      return res.status(400).json({ message: "Select a valid rejection reason" });
    }
    if (reason === "Other" && !note) {
      return res.status(400).json({ message: "Enter the other rejection reason" });
    }

    order.status = "REJECTED";
    order.rejectionReason = reason;
    order.rejectionNote = note;
    order.rejectedBy = "FARMER";
    order.rejectedAt = new Date();
    order.deliveryStatus = "Cancelled";
    pushOrderTimeline(order, "REJECTED", `${reason}${note ? ` — ${note}` : ""}`);
    await order.save();

    await persistOrderStatusSideEffects(order, { event: "REJECTED" });
    pushIfManagerActed(req, order);
    const farmer = await Farmer.findOne({ id: order.farmerId });
    res.json(await enrichOwnOrder(order, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to reject order" });
  }
}

export async function prepareMyOrder(req, res) {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    const current = normalizeOrderStatus(order.status);
    if (!["ACCEPTED", "PREPARING", "PACKING"].includes(current)) {
      return res.status(400).json({ message: "Order must be accepted before preparation" });
    }
    order.status = "PREPARING";
    order.preparationStatus = "PREPARING";
    order.preparedAt = order.preparedAt || new Date();
    if (req.body?.packedQuantity != null) {
      const packed = Number(req.body.packedQuantity);
      const cap = Number(order.reservedQuantity || flattenOrderFields(order).orderedQuantity || 0);
      if (!Number.isFinite(packed) || packed < 0) {
        return res.status(400).json({ message: "Packed quantity cannot be negative" });
      }
      if (packed > cap) {
        return res.status(400).json({ message: "Packed quantity cannot exceed the reserved quantity" });
      }
      order.packedQuantity = packed;
    }
    pushOrderTimeline(order, "PREPARING", req.body?.note || "Preparation updated.");
    await order.save();
    if (current !== "PREPARING") pushIfManagerActed(req, order);
    const farmer = await Farmer.findOne({ id: order.farmerId });
    res.json(await enrichOwnOrder(order, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update preparation" });
  }
}

export async function packMyOrder(req, res) {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    const current = normalizeOrderStatus(order.status);
    if (!["ACCEPTED", "PREPARING", "PACKING"].includes(current)) {
      return res.status(400).json({ message: "Packing can be added after the order is accepted" });
    }
    const packedQuantity = Number(req.body?.packedQuantity ?? order.packedQuantity ?? 0);
    const cap = Number(order.reservedQuantity || flattenOrderFields(order).orderedQuantity || 0);
    if (!Number.isFinite(packedQuantity) || packedQuantity < 0) {
      return res.status(400).json({ message: "Packed quantity cannot be negative" });
    }
    if (packedQuantity > cap) {
      return res.status(400).json({ message: "Packed quantity cannot exceed the reserved quantity" });
    }
    const details = req.body?.packingDetails || req.body || {};
    order.packedQuantity = packedQuantity;
    order.packingDetails = {
      packageCount: Number(details.packageCount || 0),
      packageType: String(details.packageType || "").trim(),
      packageWeight: Number(details.packageWeight || 0),
      packingDate: String(details.packingDate || "").trim(),
      notes: String(details.notes || details.packingNotes || "").trim(),
    };
    order.status = "PACKING";
    order.preparationStatus = "PACKING";
    order.markModified("packingDetails");
    pushOrderTimeline(order, "PACKING", "Packing details saved.");
    await order.save();
    if (current !== "PACKING") pushIfManagerActed(req, order);
    const farmer = await Farmer.findOne({ id: order.farmerId });
    res.json(await enrichOwnOrder(order, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to save packing details" });
  }
}

export async function readyMyOrder(req, res) {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    const current = normalizeOrderStatus(order.status);
    if (!["PREPARING", "PACKING", "ACCEPTED"].includes(current)) {
      return res.status(400).json({ message: "Order must be in preparation before marking ready for pickup" });
    }
    const packed = Number(order.packedQuantity || req.body?.packedQuantity || 0);
    const cap = Number(order.reservedQuantity || flattenOrderFields(order).orderedQuantity || 0);
    if (!(packed > 0)) {
      return res.status(400).json({ message: "Add packing details and packed quantity before marking ready" });
    }
    if (packed > cap) {
      return res.status(400).json({ message: "Packed quantity cannot exceed the reserved quantity" });
    }
    order.status = "READY_FOR_PICKUP";
    order.preparationStatus = "READY_FOR_PICKUP";
    order.readyForPickupAt = new Date();
    pushOrderTimeline(order, "READY_FOR_PICKUP", "Order marked ready for pickup.");
    await order.save();
    pushIfManagerActed(req, order);
    const farmer = await Farmer.findOne({ id: order.farmerId });
    await ensurePickupForOrder(order, farmer);
    res.json(await enrichOwnOrder(order, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to mark order ready for pickup" });
  }
}

export async function updateFarmerPassword(req, res) {
  try {
    const { farmerId } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 4) {
      return res.status(400).json({ success: false, message: "Password must be at least 4 characters long" });
    }
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer not found" });

    farmer.password = await bcrypt.hash(newPassword, 10);
    await farmer.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to update password" });
  }
}

export async function updateFarmerLoginStatus(req, res) {
  try {
    const { farmerId } = req.params;
    const { loginEnabled } = req.body;

    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer not found" });

    farmer.loginEnabled = Boolean(loginEnabled);
    await farmer.save();

    const enriched = await enrichFarmerDoc(farmer);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to update login status" });
  }
}

export async function getFarmerDashboard(req, res) {
  try {
    const { farmerId } = req.params;
    if (req.user?.role === "VENDOR" || req.user?.role === "FARMER_MANAGER" || req.user?.role === "FARMER") {
      const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
      if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    }
    const [[productFacet], orderAgg, earningAgg, recentOrders, recentEarnings] = await Promise.all([
      FarmerProduct.aggregate([
        { $match: { farmerId } },
        {
          $facet: {
            totals: [{ $group: { _id: null, totalProducts: { $sum: 1 }, availableStock: { $sum: { $ifNull: ["$stock", 0] } } } }],
            lowStock: [
              { $match: { $expr: LOW_STOCK_EXPR } },
              { $project: { id: 1, name: 1, stock: 1, lowStockLimit: 1, grades: 1, unit: 1 } },
            ],
          },
        },
      ]),
      FarmerOrder.aggregate([
        { $match: { farmerId } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            pendingOrders: { $sum: { $cond: [{ $in: ["$status", ["New", "NEW", "Confirmed", "Approved", "Processing"]] }, 1, 0] } },
            completedOrders: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
          },
        },
      ]),
      FarmerEarning.aggregate([
        { $match: { farmerId } },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: { $ifNull: ["$netEarnings", 0] } },
            pendingEarnings: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, { $ifNull: ["$netEarnings", 0] }, 0] } },
          },
        },
      ]),
      FarmerOrder.find({ farmerId }).sort({ orderDate: -1 }).limit(5).lean(),
      FarmerEarning.find({ farmerId }).sort({ date: -1 }).limit(5).lean(),
    ]);

    const p = productFacet.totals[0] || { totalProducts: 0, availableStock: 0 };
    const lowStockProducts = productFacet.lowStock;
    const o = orderAgg[0] || { totalOrders: 0, pendingOrders: 0, completedOrders: 0 };
    const e = earningAgg[0] || { totalEarnings: 0, pendingEarnings: 0 };

    res.json({
      totalProducts: p.totalProducts,
      availableStock: p.availableStock,
      totalInventory: p.availableStock,
      totalOrders: o.totalOrders,
      pendingOrders: o.pendingOrders,
      completedOrders: o.completedOrders,
      totalEarnings: e.totalEarnings,
      pendingEarnings: e.pendingEarnings,
      recentOrders,
      lowStockProducts,
      recentEarnings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch dashboard" });
  }
}

// ----------------------------------------------------
// PRODUCT CONTROLLERS
// ----------------------------------------------------
export async function getFarmerProducts(req, res) {
  try {
    const { farmerId } = req.params;
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const ids = farmerIdentityIds(farmer, farmerId);
    const products = await FarmerProduct.find({
      farmerId: { $in: ids },
      isDeleted: { $ne: true },
    }).sort({ createdAt: -1 });
    const upgraded = await normalizeProductList(products);
    const cropIds = [...new Set(upgraded.map((p) => p.cropId).filter(Boolean))];
    const crops = cropIds.length
      ? await FarmerCrop.find({
          farmerId: { $in: ids },
          $or: [{ id: { $in: cropIds } }, { cropId: { $in: cropIds } }],
        }).lean()
      : [];
    const cropMap = new Map();
    crops.forEach((c) => {
      cropMap.set(c.id, c);
      if (c.cropId) cropMap.set(c.cropId, c);
    });
    res.json(
      upgraded.map((p) =>
        enrichProductRow(publicMyProduct(p, farmer, cropMap.get(p.cropId)), farmer.name)
      )
    );
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch products" });
  }
}

export async function getFarmerProductById(req, res) {
  try {
    const loaded = await loadAccessibleFarmerProduct(req, res);
    if (!loaded) return;
    const { farmer, product } = loaded;
    const upgraded = await upgradeFarmerProductId(product);
    const crop = upgraded.cropId
      ? await FarmerCrop.findOne({
          farmerId: { $in: farmerIdentityIds(farmer, req.params.farmerId) },
          $or: [{ id: upgraded.cropId }, { cropId: upgraded.cropId }],
        })
      : null;
    res.json(publicMyProduct(upgraded, farmer, crop));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch product" });
  }
}

async function loadAccessibleFarmerProduct(req, res) {
  const { farmerId, productId } = req.params;
  const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
  if (!farmer) {
    res.status(404).json({ message: "Farmer not found" });
    return null;
  }
  const product = await FarmerProduct.findOne({
    farmerId: { $in: farmerIdentityIds(farmer, farmerId) },
    isDeleted: { $ne: true },
    $or: [{ id: productId }, { productId }, { previousProductId: productId }],
  });
  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return null;
  }
  return { farmer, product };
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function reviewFarmerProduct(req, res) {
  try {
    const loaded = await loadAccessibleFarmerProduct(req, res);
    if (!loaded) return;
    const { farmer, product } = loaded;
    const current = normalizeProductStatus(product.status);
    if (!["Pending Approval", "Draft", "Pending"].includes(current)) {
      return res.status(400).json({ message: "Only pending or draft products can be reviewed" });
    }

    const decision = String(req.body?.decision || req.body?.status || "").trim().toLowerCase();
    const reviewer = req.user?.name || req.user?.role || "";
    if (["approved", "approve", "active"].includes(decision)) {
      // Verify product has not already been assigned to that farmer
      const targetProductId = String(product.productId || product.id || "").trim();
      const targetName = String(product.name || product.productName || "").trim();
      const existingApproved = await FarmerProduct.findOne({
        farmerId: farmer.id,
        _id: { $ne: product._id },
        isDeleted: { $ne: true },
        status: { $in: ["Active", "Approved", "Published"] },
        $or: [
          ...(targetProductId ? [{ productId: targetProductId }, { id: targetProductId }] : []),
          ...(targetName ? [
            { name: new RegExp(`^${escapeRegex(targetName)}$`, "i") },
            { productName: new RegExp(`^${escapeRegex(targetName)}$`, "i") },
          ] : []),
        ],
      });
      if (existingApproved) {
        return res.status(409).json({
          message: "This product is already active/approved for this farmer.",
        });
      }

      const qty = Number(product.availableQuantity ?? product.stock ?? 0);
      product.status = applyStockDrivenStatus("Active", qty, product.lowStockLimit);
      product.rejectionReason = "";
      product.reviewedBy = reviewer;
      product.reviewedAt = new Date();
    } else if (["rejected", "reject"].includes(decision)) {
      product.status = "Rejected";
      product.rejectionReason = String(req.body?.reason || req.body?.rejectionReason || "").trim();
      product.reviewedBy = reviewer;
      product.reviewedAt = new Date();
    } else {
      return res.status(400).json({ message: "Decision must be approved or rejected" });
    }

    await product.save();
    pushFarmerProductReview(product);
    res.json(publicMyProduct(product, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to review product" });
  }
}

export async function createFarmerProduct(req, res) {
  try {
    const { farmerId } = req.params;
    const payload = req.body;
    const farmer = await Farmer.findOne({ id: farmerId });
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    let grades = normalizeProductGrades(payload.grades);
    if (!grades.length) {
      grades = normalizeProductGrades([
        { grade: "A", quantity: Number(payload.gradeAQty) || 0, price: Number(payload.gradeAPrice || payload.sellingPrice) || 0 },
        { grade: "B", quantity: Number(payload.gradeBQty) || 0, price: Number(payload.gradeBPrice) || 0 },
        { grade: "C", quantity: Number(payload.gradeCQty) || 0, price: Number(payload.gradeCPrice) || 0 },
      ]);
    }
    grades = ensureAbcGrades(grades, Number(payload.sellingPrice || payload.pricePerKg) || 0);
    const totalStock = totalGradeQty(grades);
    const cropName = payload.cropName || payload.name || "";
    const id = await generateId({
      module: "ART",
      category: categoryFromName(cropName),
      crop: cropCodeFromName(cropName),
      variety: varietyCodeFromName(payload.variety),
    });

    const product = new FarmerProduct({
      id,
      productId: id,
      vendorId: farmer.vendorId,
      managerId: farmer.managerId,
      farmerId,
      sku: payload.sku || farmerSku(farmerId),
      name: payload.name || payload.productName || cropName,
      productName: payload.productName || payload.name || cropName,
      category: payload.category || "Vegetables",
      subCategory: payload.subCategory || "Fresh Produce",
      description: payload.description || "",
      image: payload.image || payload.imageUrl || "",
      images: payload.images?.length ? payload.images : [payload.image || payload.imageUrl || ""],
      unit: payload.unit || "Kg",
      harvestDate: payload.harvestDate || new Date().toISOString().split("T")[0],
      produceType: payload.produceType || (payload.farmingType === "Conventional" ? "non-organic" : "organic"),
      farmingType: payload.farmingType || "",
      farmLocation: payload.farmLocation || farmer.farmLocation || "",
      cropId: payload.cropId || "",
      cropName,
      variety: payload.variety || "",
      status: payload.status || "Approved",
      sellingPrice: Number(payload.sellingPrice) || 0,
      pricePerKg: Number(payload.pricePerKg || payload.sellingPrice) || 0,
      mrp: Number(payload.mrp) || 0,
      lowStockLimit: Number(payload.lowStockLimit) || 10,
      stock: totalStock,
      availableQuantity: totalStock,
      availableFrom: payload.availableFrom || "",
      availableUntil: payload.availableUntil || "",
      sowingDate: payload.sowingDate || "",
      media: payload.media || {},
      grades,
    });
    applyGradeQtyFields(product, grades);

    await product.save();
    await syncFarmerProductToErp(product, farmer, null);

    // Log stock history for created product
    for (const g of grades) {
      if (g.quantity > 0) {
        await FarmerStockHistory.create({
          id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          vendorId: farmer.vendorId,
          managerId: farmer.managerId,
          farmerId,
          productId: product.id,
          productName: product.name,
          grade: g.label,
          action: "Stock Added",
          previousStock: 0,
          changedQuantity: g.quantity,
          newStock: g.quantity,
          reason: "Initial Harvest",
          updatedBy: "Farmer",
          reference: "HARV-NEW",
        });
      }
    }

    res.status(201).json(publicMyProduct(product, farmer, null));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create product" });
  }
}

export async function updateFarmerProduct(req, res) {
  try {
    const { farmerId, productId } = req.params;
    const payload = req.body;

    const product = await FarmerProduct.findOne({
      farmerId,
      $or: [{ id: productId }, { productId }, { previousProductId: productId }],
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (payload.name || payload.productName) {
      product.name = payload.productName || payload.name;
      product.productName = payload.productName || payload.name;
    }
    if (payload.variety !== undefined) product.variety = String(payload.variety);
    if (payload.cropName !== undefined) product.cropName = String(payload.cropName);
    if (payload.farmingType !== undefined) product.farmingType = String(payload.farmingType);
    if (payload.harvestDate !== undefined) product.harvestDate = String(payload.harvestDate);
    if (payload.availableFrom !== undefined) product.availableFrom = String(payload.availableFrom);
    if (payload.availableUntil !== undefined) product.availableUntil = String(payload.availableUntil);
    if (payload.sowingDate !== undefined) product.sowingDate = String(payload.sowingDate);
    if (payload.category) product.category = payload.category;
    if (payload.subCategory) product.subCategory = payload.subCategory;
    if (payload.description !== undefined) product.description = payload.description;
    if (payload.image !== undefined) product.image = payload.image;
    if (payload.images) product.images = payload.images;
    if (payload.unit) product.unit = payload.unit;
    if (payload.sellingPrice !== undefined) product.sellingPrice = Number(payload.sellingPrice);
    if (payload.mrp !== undefined) product.mrp = Number(payload.mrp);
    if (payload.lowStockLimit !== undefined) product.lowStockLimit = Number(payload.lowStockLimit);
    if (payload.status) product.status = payload.status;

    const stockChanges = [];
    if (payload.grades || payload.gradeAQty != null || payload.gradeBQty != null || payload.gradeCQty != null) {
      const prevGrades = normalizeProductGrades(product.grades);
      const nextGrades = ensureAbcGrades(
        normalizeProductGrades(payload.grades),
        Number(product.sellingPrice || product.pricePerKg) || 0
      );
      if (payload.gradeAQty != null) {
        const row = nextGrades.find((g) => g.grade === "A");
        if (row) row.quantity = Number(payload.gradeAQty) || 0;
      }
      if (payload.gradeBQty != null) {
        const row = nextGrades.find((g) => g.grade === "B");
        if (row) row.quantity = Number(payload.gradeBQty) || 0;
      }
      if (payload.gradeCQty != null) {
        const row = nextGrades.find((g) => g.grade === "C");
        if (row) row.quantity = Number(payload.gradeCQty) || 0;
      }
      if (payload.gradeAPrice != null) {
        const row = nextGrades.find((g) => g.grade === "A");
        if (row) row.price = Number(payload.gradeAPrice) || 0;
      }
      if (payload.gradeBPrice != null) {
        const row = nextGrades.find((g) => g.grade === "B");
        if (row) row.price = Number(payload.gradeBPrice) || 0;
      }
      if (payload.gradeCPrice != null) {
        const row = nextGrades.find((g) => g.grade === "C");
        if (row) row.price = Number(payload.gradeCPrice) || 0;
      }

      // Check differences for history
      for (let i = 0; i < nextGrades.length; i++) {
        const prevQty = Number(prevGrades.find((g) => g.grade === nextGrades[i].grade)?.quantity) || 0;
        const nextQty = Number(nextGrades[i]?.quantity) || 0;
        if (prevQty !== nextQty) {
          const diff = nextQty - prevQty;
          stockChanges.push({ grade: nextGrades[i].label, change: diff, next: nextQty });
          await FarmerStockHistory.create({
            id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            vendorId: product.vendorId,
            managerId: product.managerId,
            farmerId,
            productId: product.id,
            productName: product.name,
            grade: nextGrades[i].label,
            action: diff > 0 ? "Stock Added" : "Stock Reduced",
            previousStock: prevQty,
            changedQuantity: diff,
            newStock: nextQty,
            reason: "Manual Update",
            updatedBy: "Farmer",
            reference: "EDIT",
          });
        }
      }

      product.grades = nextGrades;
      const totalStock = totalGradeQty(nextGrades);
      product.stock = totalStock;
      product.availableQuantity = totalStock;
      applyGradeQtyFields(product, nextGrades);
      product.markModified("grades");
    }

    await product.save();
    if (isStaffChange(req)) {
      if (stockChanges.length) {
        pushFarmerStockChange({
          farmerId,
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          changes: stockChanges,
        });
      } else {
        pushFarmerProductChange(product);
      }
    }
    const farmer = await Farmer.findOne({ id: farmerId }).lean();
    res.json(publicMyProduct(product, farmer, null));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update product" });
  }
}

export async function deleteFarmerProduct(req, res) {
  try {
    const loaded = await loadAccessibleFarmerProduct(req, res);
    if (!loaded) return;
    const { farmer, product } = loaded;
    await FarmerProduct.deleteOne({ id: product.id, farmerId: product.farmerId });
    await FarmerStockHistory.deleteMany({ productId: product.id, farmerId: { $in: farmerIdentityIds(farmer, req.params.farmerId) } });
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete product" });
  }
}

// ----------------------------------------------------
// INVENTORY & STOCK CONTROLLERS
// ----------------------------------------------------
export async function getFarmerInventory(req, res) {
  try {
    const { farmerId } = req.params;
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const products = await FarmerProduct.find({
      farmerId: { $in: farmerIdentityIds(farmer, farmerId) },
      isDeleted: { $ne: true },
    }).select("-images -description").lean();
    const inventoryList = [];

    products.forEach((p) => {
      const grades = p.grades && p.grades.length ? p.grades : [{ id: "g-a", label: "Grade A", quantity: p.stock || 0 }];
      grades.forEach((g) => {
        const qty = Number(g.quantity || 0);
        const reserved = Math.round(qty * 0.1);
        const sold = Math.round(qty * 0.3);
        inventoryList.push({
          id: `inv-${p.id}-${g.id}`,
          vendorId: p.vendorId,
          managerId: p.managerId,
          farmerId: p.farmerId,
          productId: p.id,
          productName: p.name,
          gradeId: g.id,
          grade: g.label,
          unit: p.unit || "Kg",
          currentStock: qty,
          reservedStock: reserved,
          soldStock: sold,
          totalStock: qty + reserved + sold,
          status: qty <= 0 ? "Out of Stock" : qty < (p.lowStockLimit || 20) ? "Low Stock" : "In Stock",
          lastUpdated: p.updatedAt,
        });
      });
    });

    res.json(inventoryList);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch inventory" });
  }
}

export async function adjustFarmerStock(req, res) {
  try {
    const { farmerId } = req.params;
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
    if (!farmer && (req.user?.role === "VENDOR" || req.user?.role === "FARMER_MANAGER" || req.user?.role === "FARMER")) {
      return res.status(404).json({ message: "Farmer not found" });
    }
    const { productId, gradeId, change, grade, updatedBy = "Vendor", reason = "Manual Update", reference = "—" } = req.body;
    const farmerIds = farmer ? farmerIdentityIds(farmer, farmerId) : [farmerId];

    const product = await FarmerProduct.findOne({
      farmerId: { $in: farmerIds },
      $or: [{ id: productId }, { productId }],
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const delta = Number(change) || 0;
    if (!delta) return res.status(400).json({ message: "Enter a valid non-zero quantity to adjust" });

    let grades = product.grades && product.grades.length ? [...product.grades] : [
      { id: "g-a", label: "Grade A", quantity: product.gradeAQty || 0 },
      { id: "g-b", label: "Grade B", quantity: product.gradeBQty || 0 },
    ];

    let gIdx = grades.findIndex((g) => g.id === gradeId || g.label === gradeId || g.label === grade);
    if (gIdx < 0) {
      const targetLabel = grade || "Grade A";
      grades.push({ id: `g-${Date.now()}`, label: targetLabel, quantity: 0 });
      gIdx = grades.length - 1;
    }

    const prevStock = Number(grades[gIdx].quantity) || 0;
    const nextStock = Math.max(0, prevStock + delta);
    const appliedChange = nextStock - prevStock;

    if (appliedChange === 0 && delta < 0) {
      return res.status(400).json({ message: "Not enough available stock to remove" });
    }

    grades[gIdx].quantity = nextStock;
    product.grades = grades;

    const totalStock = totalGradeQty(grades);
    product.stock = totalStock;
    product.availableQuantity = totalStock;
    applyGradeQtyFields(product, grades);
    if (totalStock <= 0) product.status = "Out of Stock";

    await product.save();

    const historyEntry = new FarmerStockHistory({
      id: `sh-${Date.now()}`,
      vendorId: product.vendorId,
      managerId: product.managerId,
      farmerId: product.farmerId || farmer?.id || farmerId,
      productId: product.id || productId,
      productName: product.name || product.productName,
      grade: grades[gIdx].label,
      action: appliedChange >= 0 ? "Stock Added" : "Stock Reduced",
      previousStock: prevStock,
      changedQuantity: appliedChange,
      newStock: nextStock,
      reason,
      updatedBy,
      reference,
      at: new Date(),
    });

    await historyEntry.save();
    if (isStaffChange(req)) {
      pushFarmerStockChange({
        farmerId,
        productId,
        productName: product.name,
        unit: product.unit,
        changes: [{ grade: grades[gIdx].label, change: appliedChange, next: nextStock }],
      });
    }

    res.json({ product, history: historyEntry });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to adjust stock" });
  }
}

export async function getStockHistory(req, res) {
  try {
    const { farmerId } = req.params;
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
    if (!farmer && (req.user?.role === "VENDOR" || req.user?.role === "FARMER_MANAGER" || req.user?.role === "FARMER")) {
      return res.status(404).json({ message: "Farmer not found" });
    }
    const { productId } = req.query;
    const farmerIds = farmer ? farmerIdentityIds(farmer, farmerId) : [farmerId];

    const query = { farmerId: { $in: farmerIds } };
    if (productId) query.productId = { $in: [productId] };

    if (isPaginationRequested(req.query)) {
      const { page, limit, skip } = getPageParams(req.query, PAGE_LIMITS.stockHistory);
      const [total, history] = await Promise.all([
        FarmerStockHistory.countDocuments(query),
        FarmerStockHistory.find(query).sort({ at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      ]);
      return res.json(paginatedResponse(history, total, page, limit));
    }

    const history = await FarmerStockHistory.find(query).sort({ at: -1 }).lean();
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch stock history" });
  }
}

export async function updateFarmerInventoryItem(req, res) {
  try {
    const { farmerId, inventoryId } = req.params;
    const { currentStock, reservedStock, soldStock, gradeId, productId } = req.body;

    if (productId) {
      const product = await FarmerProduct.findOne({ id: productId, farmerId });
      if (product && currentStock !== undefined) {
        const gIdx = product.grades.findIndex((g) => g.id === gradeId);
        if (gIdx >= 0) {
          const prevQty = Number(product.grades[gIdx].quantity || 0);
          product.grades[gIdx].quantity = Number(currentStock);
          const total = product.grades.reduce((s, g) => s + Number(g.quantity || 0), 0);
          product.stock = total;
          product.availableQuantity = total;
          await product.save();
          if (isStaffChange(req)) {
            pushFarmerStockChange({
              farmerId,
              productId,
              productName: product.name,
              unit: product.unit,
              changes: [{ grade: product.grades[gIdx].label, change: Number(currentStock) - prevQty, next: Number(currentStock) }],
            });
          }
        }
      }
    }

    res.json({ success: true, id: inventoryId, currentStock, reservedStock, soldStock });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update inventory item" });
  }
}

// ----------------------------------------------------
// ORDER CONTROLLERS
// ----------------------------------------------------
export async function getFarmerOrders(req, res) {
  try {
    const { farmerId } = req.params;
    const { ids } = await resolveFarmerIdentity(farmerId);
    const farmer = await Farmer.findOne({
      isDeleted: { $ne: true },
      $or: [{ id: farmerId }, { farmerId }, { id: { $in: ids } }, { farmerId: { $in: ids } }],
    });
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const { status, q } = req.query;
    const query = {
      farmerId: { $in: ids.length ? ids : [farmerId] },
      isDeleted: { $ne: true },
    };

    // Farmer App rule: In farmer app, only orders from the farmer's assigned vendor can be received/viewed.
    const isFarmerRequest = req.user?.role === "FARMER" || !req.user?.role || req.user?.role === "USER";
    if (isFarmerRequest) {
      const assignedVendorId = String(farmer.vendorId || "").trim();
      if (!assignedVendorId) {
        // Farmer has no assigned vendor; return empty list since no one can send them orders.
        return res.json(isPaginationRequested(req.query) ? paginatedResponse([], 0, 1, 10) : []);
      }
      query.vendorId = assignedVendorId;
    } else if (req.user?.role === "VENDOR") {
      const callerVendorId = String(req.user.vendorId || req.user.id || "").trim();
      if (callerVendorId) {
        query.vendorId = callerVendorId;
      }
    }

    if (status) {
      const wanted = normalizeOrderStatus(status);
      query.status = { $in: [...new Set([status, wanted])] };
    } else {
      query.status = { $nin: ["DELETED", "Deleted", "deleted", "CANCELLED", "Cancelled", "cancelled"] };
    }

    let orders;
    let paged = null;
    if (isPaginationRequested(req.query)) {
      paged = getPageParams(req.query, PAGE_LIMITS.orders);
      const conditions = [{ deleted: { $ne: true } }, { status: { $not: DELETED_ORDER_STATUS_RX } }];
      if (q) {
        const rx = containsRegex(q);
        conditions.push({ $or: [{ id: rx }, { "customer.name": rx }] });
      }
      query.$and = conditions;
      const [total, pageOrders] = await Promise.all([
        FarmerOrder.countDocuments(query),
        FarmerOrder.find(query).sort({ orderDate: -1, createdAt: -1, _id: -1 }).skip(paged.skip).limit(paged.limit).lean(),
      ]);
      paged.total = total;
      orders = pageOrders;
    } else {
      orders = await FarmerOrder.find(query).sort({ orderDate: -1, createdAt: -1 }).lean();
      if (q) {
        const needle = q.toLowerCase();
        orders = orders.filter(
          (o) =>
            String(o.id || "").toLowerCase().includes(needle) ||
            (o.customer?.name && o.customer.name.toLowerCase().includes(needle))
        );
      }
    }

    const orderIds = [...new Set(orders.flatMap((o) => [o.id, o.orderId]).filter(Boolean).map(String))];
    const vendorIds = [...new Set(orders.map((o) => o.vendorId).filter(Boolean).map(String))];

    const [pickups, vendors] = await Promise.all([
      orderIds.length
        ? Pickup.find({ orderId: { $in: orderIds } }).select(PICKUP_LIST_EXCLUDE).lean()
        : [],
      vendorIds.length
        ? Vendor.find({ $or: [{ id: { $in: vendorIds } }, { vendorId: { $in: vendorIds } }] })
            .select("id vendorId vendorCode vendorName ownerName mobile phone businessName businessAddress city state pincode email gstNumber")
            .lean()
        : [],
    ]);

    const pickupByOrder = new Map();
    pickups.forEach((p) => {
      if (p.orderId) pickupByOrder.set(String(p.orderId), p);
    });

    const vendorMap = new Map();
    vendors.forEach((v) => {
      if (v.id) vendorMap.set(String(v.id), v);
      if (v.vendorId) vendorMap.set(String(v.vendorId), v);
    });

    const driverIds = [...new Set(pickups.map((p) => p.driverId).filter(Boolean).map(String))];
    const drivers = driverIds.length
      ? await PickupDriver.find({ id: { $in: driverIds } }).select("id name mobile vehicleNumber").lean()
      : [];
    const driverById = new Map(drivers.map((d) => [String(d.id), d]));

    const mapped = orders.filter((o) => !isOrderDeleted(o)).map((o) => {
      const canonical = withCanonicalOrderStatus(o);
      const p = pickupByOrder.get(String(o.id)) || pickupByOrder.get(String(o.orderId || ""));
      const d = p?.driverId ? driverById.get(String(p.driverId)) : null;
      const v = o.vendorId ? vendorMap.get(String(o.vendorId)) : null;

      const driverName = d?.name || p?.driverName || o.driverName || "";
      const driverMobile = d?.mobile || p?.driverMobile || o.driverMobile || o.driverPhone || "";
      const vehicleNumber = d?.vehicleNumber || p?.vehicleNumber || o.vehicleNumber || "";
      const driverStatus = p?.driverStatus || p?.status || o.driverStatus || "";

      const vendorName = v?.vendorName || v?.businessName || v?.ownerName || (o.vendorId ? "Assigned Vendor" : "");
      const vendorPhone = v?.mobile || v?.phone || "";
      const vendorBusinessName = v?.businessName || "";
      const vendorAddress = v?.businessAddress || [v?.city, v?.state, v?.pincode].filter(Boolean).join(", ") || "";

      return {
        ...canonical,
        vendorId: o.vendorId || "",
        vendorCode: v?.vendorCode || v?.vendorId || o.vendorId || "",
        vendorName,
        vendorOwnerName: v?.ownerName || v?.vendorName || "",
        vendorPhone,
        vendorMobile: vendorPhone,
        vendorEmail: v?.email || "",
        vendorBusinessName,
        vendorAddress,
        vendorCity: v?.city || "",
        vendorState: v?.state || "",
        vendorPincode: v?.pincode || "",
        vendorGstNumber: v?.gstNumber || "",
        timeline: o.timeline || [],
        customerName: o.customer?.name || "Customer",
        customerPhone: o.customer?.phone || "",
        customerAddress: o.customer?.address || o.customerDeliveryArea || "",
        pickupDate: p?.pickupDate || p?.scheduledDate || o.pickupDate || "",
        pickupTime: p?.pickupTime || p?.scheduledTime || o.pickupTime || "",
        pickupSlot: p?.pickupTime || p?.scheduledTime || o.pickupSlot || o.pickupTime || "",
        day: o.day || "",
        driverId: p?.driverId || o.driverId || "",
        driverName,
        driverMobile,
        driverPhone: driverMobile,
        vehicleNumber,
        driverStatus,
        hasDriverAssigned: Boolean((driverName && driverName.trim().length > 0) || (driverMobile && driverMobile.trim().length > 0) || p?.driverId),
        pickup: p
          ? {
              ...p,
              driverName,
              driverMobile,
              vehicleNumber,
              driverStatus,
            }
          : null,
      };
    });

    if (paged) return res.json(paginatedResponse(mapped, paged.total, paged.page, paged.limit));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch orders" });
  }
}

export async function getFarmerOrderById(req, res) {
  try {
    const { farmerId, orderId } = req.params;
    const { ids } = await resolveFarmerIdentity(farmerId);
    const farmer = await Farmer.findOne({
      $or: [{ id: farmerId }, { farmerId }, { id: { $in: ids } }, { farmerId: { $in: ids } }],
    })
      .select("name farmerId id vendorId mobile state district taluka village farmAddress farmLocation farmGeo address")
      .lean();
    const farmerName = farmer?.name || "";
    const geo = farmer?.farmGeo || {};
    const farmerLocation = formatFarmLocation(farmer);
    const mapsUrl =
      geo.latitude != null && geo.longitude != null
        ? `https://www.google.com/maps/search/?api=1&query=${geo.latitude},${geo.longitude}`
        : farmerLocation
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(farmerLocation)}`
          : "";

    const attachCentreVendor = async (plain) => {
      const vendorId = plain.vendorId || farmer?.vendorId || "";
      let collectionCentreId = plain.collectionCentreId || "";
      let collectionCentre = plain.collectionCentre || "";

      const [pickup, vendorDoc] = await Promise.all([
        Pickup.findOne({
          $or: [{ orderId: plain.id }, { orderId: plain.orderId }, { id: plain.pickupId }],
        })
          .lean()
          .catch(() => null),
        vendorId
          ? Vendor.findOne({ $or: [{ id: vendorId }, { vendorId }] })
              .select("id vendorId vendorCode vendorName ownerName mobile phone businessName businessAddress city state pincode email gstNumber")
              .lean()
              .catch(() => null)
          : null,
      ]);

      if (pickup?.collectionCentreId) collectionCentreId = collectionCentreId || pickup.collectionCentreId;

      let centre = null;
      if (collectionCentreId) {
        centre = await CollectionCentre.findOne({ id: collectionCentreId }).catch(() => null);
      }
      if (!centre && (vendorId || pickup?.vendorId)) {
        centre = await ensureDefaultCentre(vendorId || pickup.vendorId, {
          farmer,
          city: farmer?.farmAddress?.district || farmer?.district || "",
        });
      } else if (centre) {
        centre = await ensureCentreBusinessId(centre, {
          city: centre.city || farmer?.farmAddress?.district || "",
          farmer: farmer || null,
        });
      }

      return {
        ...plain,
        farmerName: plain.farmerName || farmerName,
        farmerMobile: farmer?.mobile || "",
        farmerLocation,
        farmAddress: geo.farmAddress || farmerLocation,
        farmGeo: geo,
        latitude: geo.latitude ?? null,
        longitude: geo.longitude ?? null,
        mapsUrl,
        vendorId: vendorId || centre?.vendorId || pickup?.vendorId || "",
        vendorCode: vendorDoc?.vendorCode || vendorDoc?.vendorId || vendorId || "",
        vendorName: vendorDoc?.vendorName || vendorDoc?.businessName || vendorDoc?.ownerName || (vendorId ? "Assigned Vendor" : ""),
        vendorOwnerName: vendorDoc?.ownerName || vendorDoc?.vendorName || "",
        vendorPhone: vendorDoc?.mobile || vendorDoc?.phone || "",
        vendorMobile: vendorDoc?.mobile || vendorDoc?.phone || "",
        vendorEmail: vendorDoc?.email || "",
        vendorBusinessName: vendorDoc?.businessName || "",
        vendorAddress: vendorDoc?.businessAddress || [vendorDoc?.city, vendorDoc?.state, vendorDoc?.pincode].filter(Boolean).join(", ") || "",
        vendorCity: vendorDoc?.city || "",
        vendorState: vendorDoc?.state || "",
        vendorPincode: vendorDoc?.pincode || "",
        vendorGstNumber: vendorDoc?.gstNumber || "",
        timeline: plain.timeline || [],
        customerName: plain.customer?.name || "Customer",
        customerPhone: plain.customer?.phone || "",
        customerAddress: plain.customer?.address || plain.customerDeliveryArea || "",
        collectionCentreId: centre?.id || collectionCentreId || "",
        collectionCentre: centre?.name || collectionCentre || (vendorId ? "Main Collection Centre" : ""),
        packingDetails: plain.packingDetails || {},
        pickup: pickup
          ? {
              pickupId: pickup.pickupId || pickup.id,
              id: pickup.id,
              status: pickup.status,
              driverName: pickup.driverName || "",
              driverMobile: pickup.driverMobile || "",
              vehicleNumber: pickup.vehicleNumber || "",
              farmerLocation: pickup.pickupLocation || farmerLocation,
              mapsUrl,
              packedQuantity: pickup.packedQuantity,
              packageCount: pickup.packageCount,
              pickupDate: pickup.pickupDate || pickup.scheduledDate || "",
              pickupTime: pickup.pickupTime || pickup.scheduledTime || "",
            }
          : null,
      };
    };

    const orderQuery = {
      farmerId: { $in: ids.length ? ids : [farmerId] },
      $or: [{ id: orderId }, { orderId }],
    };

    const isFarmerRequest = req.user?.role === "FARMER" || !req.user?.role || req.user?.role === "USER";
    if (isFarmerRequest && farmer?.vendorId) {
      orderQuery.vendorId = farmer.vendorId;
    }

    const order = await FarmerOrder.findOne(orderQuery);
    if (order) {
      const plain = order.toObject ? order.toObject() : order;
      return res.json(await attachCentreVendor(plain));
    }

    const harvest = await FarmerHarvestOrder.findOne({ farmerId, id: orderId }).lean();
    if (!harvest) return res.status(404).json({ message: "Order not found" });

    return res.json(
      await attachCentreVendor({
        ...harvest,
        orderId: harvest.id,
        orderDate: harvest.date || harvest.orderDate || "",
        orderedQuantity: harvest.totalQuantity || 0,
        orderValue: harvest.totalAmount || 0,
        grades: (harvest.grades || []).map((g) => ({
          ...g,
          label: g.label || g.name || "Grade A",
          price: g.price ?? g.rate ?? 0,
          rate: g.rate ?? g.price ?? 0,
        })),
      })
    );
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch order" });
  }
}

export async function updateFarmerOrderStatus(req, res) {
  try {
    const { farmerId, orderId } = req.params;
    const { status, note } = req.body;

    const order = await FarmerOrder.findOne({ id: orderId, farmerId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const previousStatus = normalizeOrderStatus(order.status);
    order.status = status;
    order.timeline.push({
      status,
      at: new Date(),
      note: note || `Status updated to ${status}`,
    });

    if (String(status).trim().toUpperCase() === "ACCEPTED") {
      await deductFarmerOrderInventory(order);
    }

    await order.save();
    const nextStatus = normalizeOrderStatus(order.status);
    if (nextStatus !== previousStatus && isStaffChange(req)) {
      pushFarmerOrderChange({ ...toPlain(order), status: nextStatus }, { statusChanged: true });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update order status" });
  }
}

export async function updateFarmerOrder(req, res) {
  try {
    const { farmerId, orderId } = req.params;
    const {
      products,
      harvestDate,
      day,
      unit,
      rejectionQty,
      status,
      grades,
    } = req.body;

    const query = {
      farmerId,
      $or: [{ id: orderId }, { orderId: orderId }],
    };
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      query.$or.push({ _id: orderId });
    }

    let order = await FarmerOrder.findOne(query);
    if (!order) {
      const harvestOrder = await FarmerHarvestOrder.findOne(query);
      if (harvestOrder) {
        if (harvestDate !== undefined) harvestOrder.harvestDate = harvestDate;
        if (unit !== undefined) harvestOrder.unit = unit;
        if (rejectionQty !== undefined) harvestOrder.rejectionQty = Number(rejectionQty || 0);
        if (status !== undefined) harvestOrder.status = status;
        if (grades !== undefined) harvestOrder.grades = grades;
        await harvestOrder.save();
        return res.json(harvestOrder);
      }
      return res.status(404).json({ message: "Harvest order not found" });
    }

    const previousStatus = normalizeOrderStatus(order.status);
    if (harvestDate !== undefined) order.harvestDate = harvestDate;
    if (day !== undefined) order.day = day;
    if (unit !== undefined) order.unit = unit;
    if (rejectionQty !== undefined) order.rejectionQty = Number(rejectionQty || 0);
    if (status !== undefined) order.status = status;
    if (grades !== undefined) order.grades = grades;

    if (Array.isArray(products) && products.length > 0) {
      order.products = products.map((p) => ({
        id: p.id || p.productId || "",
        name: p.name || "",
        grade: p.grade || "Grade A",
        quantity: Number(p.quantity || 0),
        unit: p.unit || order.unit || "Kg",
        price: Number(p.price || 0),
        total: Number(p.total || (Number(p.price || 0) * Number(p.quantity || 1)) || 0),
        grades: p.grades || [],
      }));
      order.totalQuantity = order.products.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
    }

    order.markModified("products");
    order.markModified("grades");
    await order.save();
    if (status !== undefined) {
      await persistOrderStatusSideEffects(order, { event: "MANAGER_UPDATE" });
      const nextStatus = normalizeOrderStatus(order.status);
      if (nextStatus !== previousStatus && isStaffChange(req)) {
        pushFarmerOrderChange({ ...toPlain(order), status: nextStatus }, { statusChanged: true });
      }
    }
    return res.json(withCanonicalOrderStatus(toPlain(order)));
  } catch (err) {
    console.error("Error updating harvest order:", err);
    return res.status(500).json({ message: err.message || "Failed to update harvest order" });
  }
}

export async function createFarmerOrder(req, res) {
  try {
    const { farmerId } = req.params;
    const {
      customer,
      products,
      harvestDate = "",
      harvestTime = "",
      day = "",
      unit = "Kg",
      rejectionQty = 0,
      rejectionReason = "",
      status = "NEW",
      paymentStatus = "Pending",
      deliveryStatus = "Pending",
      orderDate: orderDateRaw = "",
      pickupDate = "",
      requiredDate = "",
      pickupTime = "",
    } = req.body;

    const { ids } = await resolveFarmerIdentity(farmerId);
    const farmer = await Farmer.findOne({
      isDeleted: { $ne: true },
      $or: [{ id: farmerId }, { farmerId }, { id: { $in: ids } }, { farmerId: { $in: ids } }],
    });
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer not found" });

    // Strict Rule: In farmer app, only the farmer's assigned vendor can send orders to the farmer.
    const assignedVendorId = String(farmer.vendorId || "").trim();
    if (!assignedVendorId) {
      return res.status(400).json({
        success: false,
        message: "या शेतकऱ्याला कोणताही व्हेंडर नियुक्त (assigned) केलेला नाही. फक्त शेतकऱ्याचा नियुक्त व्हेंडरच ऑर्डर पाठवू शकतो.",
      });
    }

    const callerRole = String(req.user?.role || "").toUpperCase();
    const callerVendorId = String(req.user?.vendorId || (callerRole === "VENDOR" ? (req.user?.id || req.user?.vendorId) : "") || "").trim();

    if (callerRole === "FARMER_MANAGER") {
      return res.status(403).json({
        success: false,
        message: "शेतकऱ्याला ऑर्डर फक्त त्याचा नियुक्त व्हेंडरच पाठवू शकतो. फार्मर मॅनेजर किंवा इतर कोणालाही ऑर्डर पाठवण्याची परवानगी नाही.",
      });
    }

    if (callerRole !== "VENDOR" && callerRole !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "शेतकऱ्याला ऑर्डर फक्त त्याचा नियुक्त व्हेंडरच पाठवू शकतो. इतर कोणालाही ऑर्डर पाठवण्याची परवानगी नाही.",
      });
    }

    if (callerRole === "VENDOR" && callerVendorId !== assignedVendorId) {
      return res.status(403).json({
        success: false,
        message: "तुम्ही या शेतकऱ्याचे नियुक्त व्हेंडर नाही आहात. फक्त या शेतकऱ्याचा नियुक्त व्हेंडरच ऑर्डर पाठवू शकतो.",
      });
    }

    const lineItems = products || [];
    const totalQuantity = lineItems.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
    const totalAmount = lineItems.reduce(
      (sum, p) => sum + Number(p.total || (Number(p.price || 0) * Number(p.quantity || 1)) || 0),
      0
    );
    const first = lineItems[0] || {};
    const productId = String(req.body.productId || first.productId || first.id || "").trim();
    const productName = String(req.body.productName || first.name || "Produce").trim();
    const grades = Array.isArray(req.body.grades) && req.body.grades.length
      ? req.body.grades
      : lineItems.map((p) => ({
          name: p.grade || p.name || "Grade A",
          label: p.grade || p.name || "Grade A",
          quantity: Number(p.quantity || 0),
          rate: Number(p.price || 0),
        }));

    const today = new Date();
    const localOrderDate =
      String(orderDateRaw || "").slice(0, 10) ||
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const id = await generateId({
      module: "ORD",
      date: localOrderDate.replace(/-/g, ""),
    });
    const pickupOrRequired = String(pickupDate || requiredDate || "").slice(0, 10);
    const requiredOrPickup = String(requiredDate || pickupDate || "").slice(0, 10);
    const pickupAt = String(pickupTime || harvestTime || "").trim();
    const gradeLabel =
      grades
        .filter((g) => Number(g.quantity || 0) > 0)
        .map((g) => g.label || g.name)
        .filter(Boolean)
        .join(", ") || first.grade || "Grade A";

    let variety = String(req.body.variety || "").trim();
    if (!variety && productId) {
      const linkedProduct = await FarmerProduct.findOne({
        farmerId,
        $or: [{ id: productId }, { productId }],
      })
        .select("variety")
        .lean();
      variety = linkedProduct?.variety || "";
    }

    const rawStatus = String(status || "NEW").trim();
    const isPreAccepted = ["ACCEPTED", "PREPARING", "PACKING", "READY_FOR_PICKUP", "PICKUP_SCHEDULED", "DRIVER_ASSIGNED", "DISPATCHED", "COMPLETED"].includes(rawStatus);
    const orderStatus = isPreAccepted ? rawStatus : "NEW";

    const order = new FarmerOrder({
      id,
      orderId: id,
      vendorId: assignedVendorId,
      farmerId: farmer.id,
      productId,
      productName,
      variety,
      grade: gradeLabel,
      orderedQuantity: totalQuantity,
      grades,
      customer: {
        name: customer?.name || "Daily Harvest / Store Order",
        phone: customer?.phone || farmer.mobile || "",
        address: customer?.address || farmer.farmLocation || "",
      },
      products: lineItems.map((p) => ({
        id: p.id || p.productId || productId || "",
        productId: p.productId || p.id || productId || "",
        name: p.name || productName,
        grade: p.grade || "Grade A",
        quantity: Number(p.quantity || 1),
        unit: p.unit || unit || "Kg",
        price: Number(p.price || 0),
        total: Number(p.total || (Number(p.price || 0) * Number(p.quantity || 1)) || 0),
      })),
      orderDate: localOrderDate,
      harvestDate: localOrderDate,
      harvestTime: pickupAt,
      pickupDate: pickupOrRequired,
      requiredDate: requiredOrPickup,
      pickupTime: pickupAt,
      day: day || "Today",
      unit: unit || "Kg",
      rejectionQty: Number(rejectionQty || 0),
      rejectionReason: String(rejectionReason || ""),
      totalQuantity,
      totalAmount,
      amount: totalAmount,
      orderValue: totalAmount,
      status: orderStatus,
      deliveryStatus,
      paymentStatus,
      preparationStatus: orderStatus === "NEW" ? "NOT_STARTED" : "PREPARING",
      timeline: [
        {
          status: orderStatus,
          at: new Date(),
          note: "Order created by assigned Vendor",
        },
      ],
      sourceStoreOrderId: String(req.body.sourceStoreOrderId || ""),
      sourceOrderNumber: String(req.body.sourceOrderNumber || ""),
    });

    await order.save();
    pushFarmerOrderChange(order, { isNew: true });

    const createdAsNew = ["NEW", "New"].includes(String(orderStatus));
    if (!createdAsNew) {
    // Deduct stock from FarmerProduct grades if available
    for (const item of lineItems) {
      const prodId = item.productId || item.id || productId;
      if (prodId) {
        const prod = await FarmerProduct.findOne({
          farmerId,
          $or: [{ id: prodId }, { productId: prodId }],
        });
        if (prod) {
          const gradeItem = prod.grades?.find((g) => g.label === item.grade);
          if (gradeItem) {
            gradeItem.quantity = Math.max(0, Number(gradeItem.quantity || 0) - Number(item.quantity || 0));
          }
          prod.stock = Math.max(0, Number(prod.stock || 0) - Number(item.quantity || 0));
          await prod.save();

          // Log stock history
          await FarmerStockHistory.create({
            id: `sh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            vendorId: farmer.vendorId || req.user?.vendorId || "",
            managerId: farmer.managerId || "",
            farmerId,
            productId: prod.id,
            productName: prod.name,
            grade: item.grade || "All Grades",
            action: "Order Deduction",
            previousStock: Number(prod.stock || 0) + Number(item.quantity || 0),
            changedQuantity: -Number(item.quantity || 0),
            newStock: prod.stock,
            reason: `Order #${id}`,
            updatedBy: req.user?.role === "FARMER_MANAGER" ? "Manager" : "Vendor",
            reference: id,
            at: new Date(),
          }).catch(() => {});
        }
      }
    }
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create order" });
  }
}

export async function deleteFarmerOrder(req, res) {
  try {
    const { farmerId, orderId } = req.params;
    let farmerIds = [];
    if (farmerId && farmerId !== "all" && farmerId !== "ALL") {
      const { ids } = await resolveFarmerIdentity(farmerId);
      farmerIds = ids.length ? ids : [farmerId];
    }
    const orderOr = [{ id: orderId }, { orderId: orderId }];
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      orderOr.push({ _id: orderId });
    }

    const query = { $or: orderOr };
    if (farmerIds.length) {
      query.farmerId = { $in: farmerIds };
    }

    const res1 = await FarmerOrder.deleteMany(query);
    if (res1.deletedCount === 0) {
      await FarmerOrder.deleteMany({ $or: orderOr });
    }
    await FarmerHarvestOrder.deleteMany({ $or: orderOr }).catch(() => {});
    await FarmerEarning.deleteMany({ $or: [{ orderId }, { id: orderId }] }).catch(() => {});
    await Pickup.deleteMany({ $or: [{ orderId }, { id: orderId }] }).catch(() => {});
    return res.json({ success: true, message: "Harvest order deleted successfully" });
  } catch (err) {
    console.error("Error deleting harvest order:", err);
    return res.status(500).json({ message: err.message || "Failed to delete harvest order" });
  }
}

// ----------------------------------------------------
// EARNINGS CONTROLLERS
// ----------------------------------------------------
export async function getFarmerEarnings(req, res) {
  try {
    const { farmerId } = req.params;
    if (req.user?.role === "VENDOR" || req.user?.role === "FARMER_MANAGER" || req.user?.role === "FARMER") {
      const farmer = await Farmer.findOne(accessibleFarmerQuery(req, farmerId));
      if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    }
    const earningsList = await FarmerEarning.find({ farmerId }).sort({ date: -1 }).lean();

    const totalEarnings = earningsList.reduce((s, r) => s + Number(r.netEarnings || 0), 0);
    const paidEarnings = earningsList
      .filter((r) => r.status === "Paid")
      .reduce((s, r) => s + Number(r.netEarnings || 0), 0);
    const pendingEarnings = earningsList
      .filter((r) => r.status === "Pending")
      .reduce((s, r) => s + Number(r.netEarnings || 0), 0);
    const availableEarnings = earningsList
      .filter((r) => r.status === "Available")
      .reduce((s, r) => s + Number(r.netEarnings || 0), 0);

    res.json({
      summary: { totalEarnings, paidEarnings, pendingEarnings, availableEarnings },
      transactions: earningsList,
      totalEarnings,
      paidEarnings,
      pendingEarnings,
      availableEarnings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch earnings" });
  }
}

// ----------------------------------------------------
// DOCUMENT CONTROLLERS
// ----------------------------------------------------
const DEFAULT_FARMER_DOCS = [
  {
    type: "aadhaar",
    name: "Aadhaar Card (आधार कार्ड)",
    fileName: "",
    fileUrl: "",
    status: "Pending",
  },
  {
    type: "farmer_id",
    name: "Farmer ID (शेतकरी ओळखपत्र)",
    fileName: "",
    fileUrl: "",
    status: "Pending",
  },
  {
    type: "land_712",
    name: "7/12 Extract (७/१२ उतारा)",
    fileName: "",
    fileUrl: "",
    status: "Pending",
  },
  {
    type: "land_8a",
    name: "8A Extract (८-अ उतारा)",
    fileName: "",
    fileUrl: "",
    status: "Pending",
  },
  {
    type: "bank",
    name: "Bank Passbook (बँक पासबुक)",
    fileName: "",
    fileUrl: "",
    status: "Pending",
  },
  {
    type: "farmer_photo",
    name: "Farmer Photo (शेतकरी फोटो)",
    fileName: "",
    fileUrl: "",
    status: "Pending",
  },
  {
    type: "address_proof",
    name: "Address Proof (रहिवासी दाखला)",
    fileName: "",
    fileUrl: "",
    status: "Pending",
  },
  {
    type: "pan",
    name: "PAN Card (पॅन कार्ड)",
    fileName: "",
    fileUrl: "",
    status: "Pending",
  },
  {
    type: "video_kyc",
    name: "Live Video KYC Verification (थेट व्हिडिओ केवायसी)",
    fileName: "",
    fileUrl: "",
    status: "Pending",
  },
];

const DUMMY_DOCUMENT_URL = /^https?:\/\/.*(dummy|sample|example\.com|placeholder|unsplash\.com|greengrocc\.com\/docs\/verified_)/i;

export function isRealFarmerDocument(doc) {
  const url = String(doc?.fileUrl || "").trim();
  if (!url || DUMMY_DOCUMENT_URL.test(url)) return false;
  const status = String(doc?.status || "").toLowerCase().replace(/[\s_]+/g, " ");
  if (status === "not uploaded") return false;
  return true;
}

async function resolveFarmerRecord(farmerKey) {
  const key = String(farmerKey || "").trim();
  if (!key || key === "me") return null;
  return Farmer.findOne({
    isDeleted: { $ne: true },
    $or: [{ id: key }, { farmerId: key }, { farmerCode: key }],
  });
}

function documentOwnerKeys(farmer, fallback) {
  return [...new Set([fallback, farmer?.id, farmer?.farmerId, farmer?.farmerCode].filter(Boolean))];
}

export async function getFarmerDocuments(req, res) {
  try {
    const { farmerId } = req.params;
    const farmer = await resolveFarmerRecord(farmerId);
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    if (req.user?.role === "VENDOR") {
      const vId = req.user.vendorId || req.user.id || "";
      if (!vId || farmer.vendorId !== vId) {
        return res.status(403).json({ message: "Forbidden — not your farmer" });
      }
    } else if (req.user?.role === "FARMER_MANAGER") {
      const mgrId = req.user.managerId || req.user.id || "";
      const vId = req.user.vendorId || "";
      if (!mgrId || !vId || farmer.managerId !== mgrId || farmer.vendorId !== vId) {
        return res.status(403).json({ message: "Forbidden — not your farmer" });
      }
    } else if (req.user?.role === "FARMER") {
      const myId = req.user.farmerId || req.user.id || "";
      if (!myId || (farmer.id !== myId && farmer.farmerId !== myId)) {
        return res.status(403).json({ message: "Forbidden — not your account" });
      }
    }
    const keys = documentOwnerKeys(farmer, farmerId);
    if (farmer.vendorId || farmer.managerId) {
      const syncFields = {};
      if (farmer.vendorId) syncFields.vendorId = farmer.vendorId;
      if (farmer.managerId) syncFields.managerId = farmer.managerId;
      await FarmerDocument.updateMany(
        {
          farmerId: { $in: keys },
          $or: [{ vendorId: "" }, { vendorId: { $exists: false } }, { managerId: "" }, { managerId: { $exists: false } }],
        },
        { $set: syncFields }
      ).catch(() => {});
    }
    const docs = await FarmerDocument.find({ farmerId: { $in: keys } }).sort({ uploadedAt: -1, createdAt: -1 }).lean();
    res.json(docs.filter(isRealFarmerDocument));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch documents" });
  }
}

const KYC_DOCUMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

function farmerDocumentAccessError(req, farmer) {
  const role = req.user?.role;
  if (role === "VENDOR") {
    const vId = req.user.vendorId || req.user.id || "";
    if (!vId || farmer.vendorId !== vId) return "Forbidden — not your farmer";
  } else if (role === "FARMER_MANAGER") {
    const mgrId = req.user.managerId || req.user.id || "";
    const vId = req.user.vendorId || "";
    if (!mgrId || !vId || farmer.managerId !== mgrId || farmer.vendorId !== vId) return "Forbidden — not your farmer";
  } else if (role === "FARMER") {
    const myId = req.user.farmerId || req.user.id || "";
    if (!myId || (farmer.id !== myId && farmer.farmerId !== myId)) return "Forbidden — not your account";
  } else {
    return "Login required";
  }
  return "";
}

// Videos are too large to go through the API (proxy body limits), so the client PUTs them straight to S3.
export async function createFarmerDocumentUploadUrl(req, res) {
  try {
    const { farmerId } = req.params;
    const mimeType = String(req.body?.mimeType || "").toLowerCase();
    if (!KYC_DOCUMENT_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ message: "Upload a JPG, PNG, WEBP, PDF, MP4, MOV or WEBM file" });
    }
    if (!isS3Configured()) {
      return res.status(503).json({ message: "File storage is not configured on the server" });
    }
    const farmer = await resolveFarmerRecord(farmerId);
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const accessError = farmerDocumentAccessError(req, farmer);
    if (accessError) return res.status(accessError === "Login required" ? 401 : 403).json({ message: accessError });

    const result = await presignUpload({ mimeType, folder: "farmer-kyc", expiresIn: 600 });
    res.json({ uploadUrl: result.uploadUrl, fileUrl: result.cloudFrontUrl, key: result.key, expiresIn: result.expiresIn });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create upload URL" });
  }
}

export async function uploadFarmerDocument(req, res) {
  try {
    const { farmerId } = req.params;
    const { type, fileName, fileUrl, name, status } = req.body;
    if (!type) return res.status(400).json({ message: "Document type is required" });
    if (!fileName && !fileUrl) return res.status(400).json({ message: "Choose a file to upload" });
    if (!String(fileUrl || "").trim() || DUMMY_DOCUMENT_URL.test(String(fileUrl))) {
      return res.status(400).json({ message: "Choose a real document file to upload" });
    }
    // Stored inline in MongoDB, which caps a record at 16 MB.
    if (String(fileUrl).length > 14_000_000) {
      return res.status(413).json({ message: "File too large (max 10 MB)" });
    }

    const farmer = await resolveFarmerRecord(farmerId);
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    if (req.user?.role === "VENDOR") {
      const vId = req.user.vendorId || req.user.id || "";
      if (!vId || farmer.vendorId !== vId) {
        return res.status(403).json({ message: "Forbidden — not your farmer" });
      }
    } else if (req.user?.role === "FARMER_MANAGER") {
      const mgrId = req.user.managerId || req.user.id || "";
      const vId = req.user.vendorId || "";
      if (!mgrId || !vId || farmer.managerId !== mgrId || farmer.vendorId !== vId) {
        return res.status(403).json({ message: "Forbidden — not your farmer" });
      }
    } else if (req.user?.role === "FARMER") {
      const myId = req.user.farmerId || req.user.id || "";
      if (!myId || (farmer.id !== myId && farmer.farmerId !== myId)) {
        return res.status(403).json({ message: "Forbidden — not your account" });
      }
    }

    const canonicalId = farmer?.id || farmerId;
    const ownerKeys = documentOwnerKeys(farmer, farmerId);
    const vendorId = farmer?.vendorId || req.user?.vendorId || "";
    const managerId = farmer?.managerId || req.user?.managerId || "";

    const names = {
      aadhaar: "Aadhaar Card (आधार कार्ड)",
      farmer_id: "Farmer ID (शेतकरी ओळखपत्र)",
      land_712: "7/12 Extract (७/१२ उतारा)",
      land_8a: "8A Extract (८-अ उतारा)",
      bank: "Bank Passbook (बँक पासबुक)",
      farmer_photo: "Farmer Photo (शेतकरी फोटो)",
      address_proof: "Address Proof (रहिवासी दाखला)",
      pan: "PAN Card (पॅन कार्ड)",
      video_kyc: "Live Video KYC Verification (थेट व्हिडिओ केवायसी)",
      soil_report: "Soil Testing Report (मृदा परीक्षण अहवाल)",
      organic_cert: "Organic Farming Certificate (सेंद्रिय शेती प्रमाणपत्र)",
      crop_insurance: "Crop Insurance Certificate (पीक विमा पावती)",
      water_testing: "Water Testing Report (पाणी चाचणी अहवाल)",
      gap_cert: "GAP / APEDA Quality Certificate (जीएपी / गुणवत्ता प्रमाणपत्र)",
      pesticide_report: "Pesticide Residue Free Certificate (कीटकनाशक अवशेषमुक्त प्रमाणपत्र)",
      other: "Other Certificate / Document",
    };
    const docType = String(type || "other").trim().toLowerCase();

    let doc = await FarmerDocument.findOne({ farmerId: { $in: ownerKeys }, type: docType });
    if (!doc) {
      doc = new FarmerDocument({
        id: `doc-${canonicalId}-${docType}-${Date.now()}`,
        vendorId,
        managerId,
        farmerId: canonicalId,
        name: name || names[docType] || docType.toUpperCase(),
        type: docType,
      });
    }
    doc.farmerId = canonicalId;
    if (vendorId) doc.vendorId = vendorId;
    if (managerId) doc.managerId = managerId;

    doc.name = name || doc.name || names[docType] || docType.toUpperCase();
    doc.fileName = fileName || doc.fileName || `${docType}_document`;
    doc.fileUrl = fileUrl || doc.fileUrl || "";
    doc.uploadedAt = new Date();
    doc.status = status === "Approved" || status === "approved" ? "Approved" : "Pending";
    doc.rejectionReason = "";
    doc.uploadedBy = req.user?.role || "FARMER";

    await doc.save();
    await syncFarmerKycFromDocuments(farmer, ownerKeys);
    emitFarmerDocumentUpdate(farmer, doc);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to upload document" });
  }
}

export async function submitFarmerKyc(req, res) {
  try {
    const { farmerId } = req.params;
    const farmer = await resolveFarmerRecord(farmerId);
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer not found" });

    const docs = await FarmerDocument.find({ farmerId: { $in: documentOwnerKeys(farmer, farmerId) } }).lean();
    const required = ["aadhaar", "pan", "address_proof", "bank"];
    const missing = required.filter((type) => {
      const doc = docs.find((d) => d.type === type);
      return !doc || doc.status === "Not Uploaded" || !doc.fileName;
    });

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: "Upload all required KYC documents before submitting",
        missing,
      });
    }

    farmer.kycStatus = "SUBMITTED";
    farmer.verificationStatus = "Pending";
    await farmer.save();

    const { password: _pw, ...farmerData } = farmer.toObject();
    res.json({
      success: true,
      message: "KYC submitted for verification",
      kycStatus: farmer.kycStatus,
      farmer: { ...farmerData, farmerId: farmer.id, role: farmer.role || "FARMER" },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to submit KYC" });
  }
}

const REQUIRED_KYC_DOC_TYPES = ["aadhaar", "pan", "address_proof", "bank"];
const DOC_STATUS_MAP = { approved: "Approved", rejected: "Rejected", pending: "Pending" };

async function syncFarmerKycFromDocuments(farmer, ownerKeys) {
  if (!farmer) return;
  const docs = (await FarmerDocument.find({ farmerId: { $in: ownerKeys } }).lean()).filter(isRealFarmerDocument);
  const byType = Object.fromEntries(docs.map((d) => [d.type, d]));
  const required = REQUIRED_KYC_DOC_TYPES.map((type) => byType[type]);

  if (required.every((d) => d?.status === "Approved")) {
    farmer.verificationStatus = "Approved";
    farmer.kycStatus = "APPROVED";
    farmer.status = "Active";
  } else if (required.some((d) => d?.status === "Rejected")) {
    farmer.verificationStatus = "Rejected";
    farmer.kycStatus = "REJECTED";
  } else if (required.every(Boolean)) {
    farmer.verificationStatus = "Pending";
    farmer.kycStatus = "SUBMITTED";
  }

  const bank = byType.bank?.status;
  if (bank === "Approved") farmer.bankVerificationStatus = "VERIFIED";
  else if (bank === "Rejected") farmer.bankVerificationStatus = "REJECTED";
  else if (bank === "Pending") farmer.bankVerificationStatus = "PENDING";

  await farmer.save();
}

function emitFarmerDocumentUpdate(farmer, doc) {
  try {
    const io = getIO();
    const payload = {
      farmerId: farmer?.id || doc.farmerId,
      documentId: doc.id,
      type: doc.type,
      status: doc.status,
      rejectionReason: doc.rejectionReason || "",
      kycStatus: farmer?.kycStatus || "",
    };
    const rooms = new Set();
    [doc.farmerId, farmer?.id, farmer?.farmerId]
      .filter(Boolean)
      .forEach((id) => rooms.add(`farmer_${id}`));
    if (farmer?.managerId) rooms.add(`manager_${farmer.managerId}`);
    if (farmer?.vendorId) rooms.add(`vendor_${farmer.vendorId}`);
    rooms.forEach((room) => io.to(room).emit("farmer_document_status_updated", payload));
  } catch {
    // Socket is optional; the farmer app also refreshes on pull.
  }
}

export async function updateFarmerDocumentStatus(req, res) {
  try {
    const { farmerId, documentId } = req.params;
    const { rejectionReason } = req.body;
    const status = DOC_STATUS_MAP[String(req.body.status || "").trim().toLowerCase()];
    if (!status) {
      return res.status(400).json({ message: "Status must be Approved, Rejected or Pending" });
    }
    if (status === "Rejected" && !String(rejectionReason || "").trim()) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }
    const farmerRecord = await resolveFarmerRecord(farmerId);
    const ownerKeys = documentOwnerKeys(farmerRecord, farmerId);

    let doc = await FarmerDocument.findOne({
      farmerId: { $in: ownerKeys },
      $or: [
        { id: documentId },
        { type: documentId },
        { id: `doc-${farmerId}-${documentId}` },
        { id: `doc-${farmerRecord?.id || farmerId}-${documentId}` },
      ],
    });

    if (!doc && mongoose.isValidObjectId(documentId)) {
      doc = await FarmerDocument.findOne({ _id: documentId, farmerId: { $in: ownerKeys } });
    }

    if (!doc || !isRealFarmerDocument(doc)) {
      return res.status(404).json({ message: "Uploaded document not found" });
    }
    doc.farmerId = farmerRecord?.id || doc.farmerId;

    doc.status = status;
    doc.rejectionReason = status === "Rejected" ? String(rejectionReason).trim() : "";
    doc.adminRemarks = String(req.body.adminRemarks ?? doc.adminRemarks ?? "");
    await doc.save();

    await syncFarmerKycFromDocuments(farmerRecord, ownerKeys);
    emitFarmerDocumentUpdate(farmerRecord, doc);
    pushFarmerDocumentReview(doc);

    const leanDoc = {
      id: doc.id,
      _id: doc._id,
      farmerId: doc.farmerId,
      type: doc.type,
      name: doc.name,
      fileName: doc.fileName,
      status: doc.status,
      rejectionReason: doc.rejectionReason,
      adminRemarks: doc.adminRemarks,
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
      kycStatus: farmerRecord?.kycStatus,
      bankVerificationStatus: farmerRecord?.bankVerificationStatus,
    };
    if (doc.fileUrl && !doc.fileUrl.startsWith("data:")) {
      leanDoc.fileUrl = doc.fileUrl;
    }

    res.json(leanDoc);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update document status" });
  }
}

/** Vendor approve/reject: only for farmers registered under the logged-in vendor. */
export async function updateVendorFarmerDocumentStatus(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    const farmer = await resolveFarmerRecord(req.params.farmerId);
    if (!farmer || !vendorId || farmer.vendorId !== vendorId) {
      return res.status(404).json({ message: "Farmer not found for this collection centre" });
    }
    return updateFarmerDocumentStatus(req, res);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update document status" });
  }
}

export async function deleteFarmerDocument(req, res) {
  try {
    const { farmerId, documentId } = req.params;
    const doc = await FarmerDocument.findOne({ id: documentId, farmerId });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (doc.status === "Approved") {
      return res.status(400).json({ message: "Approved documents cannot be deleted" });
    }

    doc.fileName = "";
    doc.fileUrl = "";
    doc.uploadedAt = null;
    doc.status = "Not Uploaded";
    doc.rejectionReason = "";
    await doc.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete document" });
  }
}

// ----------------------------------------------------
// MANAGER CONTROLLERS
// ----------------------------------------------------
async function enrichManagerDoc(mgrDoc) {
  const m = toPlain(mgrDoc);
  const farmers = await Farmer.find({ managerId: m.id, vendorId: m.vendorId }).select("id status").lean();
  const farmerIds = farmers.map((f) => f.id);
  const stats = await aggFarmerStats(farmerIds);

  let totalProducts = 0;
  let inventoryQty = 0;
  let totalOrders = 0;
  let totalEarnings = 0;
  farmerIds.forEach((fid) => {
    const p = stats.productStats.get(fid) || { count: 0, stock: 0 };
    totalProducts += p.count;
    inventoryQty += p.stock;
    totalOrders += stats.orderStats.get(fid) || 0;
    totalEarnings += stats.earningStats.get(fid) || 0;
  });

  delete m.password;

  return {
    ...m,
    initials: initials(m.name),
    totalFarmers: farmers.length,
    activeFarmers: farmers.filter((f) => f.status === "Active").length,
    totalProducts,
    totalInventory: inventoryQty,
    totalOrders,
    totalEarnings,
  };
}

async function enrichManagerDocsBatch(mgrDocs) {
  if (!mgrDocs || !mgrDocs.length) return [];

  const rawManagers = mgrDocs.map(toPlain);
  const managerIds = rawManagers.map((m) => m.id).filter(Boolean);

  const farmers = await Farmer.find({ managerId: { $in: managerIds } }).select("id managerId status").lean();
  const farmerIds = farmers.map((f) => f.id);
  const stats = await aggFarmerStats(farmerIds);

  const farmerToManager = new Map();
  const managerFarmersMap = new Map();
  farmers.forEach((f) => {
    farmerToManager.set(f.id, f.managerId);
    const list = managerFarmersMap.get(f.managerId) || [];
    list.push(f);
    managerFarmersMap.set(f.managerId, list);
  });

  const managerProductStats = new Map();
  const managerOrderCount = new Map();
  const managerEarnings = new Map();

  farmerIds.forEach((fid) => {
    const mgrId = farmerToManager.get(fid);
    if (!mgrId) return;
    const p = stats.productStats.get(fid) || { count: 0, stock: 0 };
    const cur = managerProductStats.get(mgrId) || { count: 0, stock: 0 };
    cur.count += p.count;
    cur.stock += p.stock;
    managerProductStats.set(mgrId, cur);
    managerOrderCount.set(mgrId, (managerOrderCount.get(mgrId) || 0) + (stats.orderStats.get(fid) || 0));
    managerEarnings.set(mgrId, (managerEarnings.get(mgrId) || 0) + (stats.earningStats.get(fid) || 0));
  });

  return rawManagers.map((m) => {
    delete m.password;
    const fList = managerFarmersMap.get(m.id) || [];
    const pStat = managerProductStats.get(m.id) || { count: 0, stock: 0 };
    return {
      ...m,
      initials: initials(m.name),
      totalFarmers: fList.length,
      activeFarmers: fList.filter((f) => f.status === "Active").length,
      totalProducts: pStat.count,
      totalInventory: pStat.stock,
      totalOrders: managerOrderCount.get(m.id) || 0,
      totalEarnings: managerEarnings.get(m.id) || 0,
    };
  });
}

export async function getManagers(req, res) {
  try {
    const { q = "", status = "" } = req.query;
    let vendorId = "";
    if (req.user?.role === "VENDOR") {
      vendorId = req.user.vendorId || req.user.id || "";
      if (!vendorId) return res.json([]);
    } else if (req.user?.role === "FARMER_MANAGER") {
      vendorId = req.user.vendorId || "";
      if (!vendorId) return res.json([]);
    } else {
      vendorId = req.query.vendorId || "";
    }

    const query = {};
    if (vendorId) {
      query.vendorId = vendorId;
    } else if (req.user?.role !== "ADMIN") {
      return res.json([]);
    }
    if (status) query.status = status;

    const mgrDocs = await FarmerManager.find(query).select("-password").sort({ createdAt: -1 }).lean();
    let enriched = await enrichManagerDocsBatch(mgrDocs);

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      enriched = enriched.filter(
        (m) =>
          m.name.toLowerCase().includes(needle) ||
          m.mobile.includes(needle) ||
          m.email.toLowerCase().includes(needle) ||
          String(m.id || "").toLowerCase().includes(needle) ||
          String(m.managerCode || "").toLowerCase().includes(needle) ||
          (m.location && m.location.toLowerCase().includes(needle))
      );
    }

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch managers" });
  }
}

export async function getManagerById(req, res) {
  try {
    const { managerId } = req.params;
    const query = { id: managerId };
    if (req.user?.role === "VENDOR") {
      const vId = req.user.vendorId || req.user.id || "";
      if (!vId) return res.status(404).json({ message: "Manager not found" });
      query.vendorId = vId;
    }
    const manager = await FarmerManager.findOne(query);
    if (!manager) return res.status(404).json({ message: "Manager not found" });
    const enriched = await enrichManagerDoc(manager);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch manager" });
  }
}

export async function createManager(req, res) {
  try {
    const payload = req.body;
    let vendorId = payload.vendorId || "";
    if (req.user?.role === "VENDOR") {
      vendorId = req.user.vendorId || req.user.id || "";
    }
    const location = [payload.city, payload.state].filter(Boolean).join(", ") || payload.location || "";

    if (!payload.name || !payload.mobile) {
      return res.status(400).json({ message: "Manager name and mobile are required" });
    }

    const existing = await FarmerManager.findOne({ mobile: String(payload.mobile).trim(), vendorId });
    if (existing) {
      return res.status(409).json({ message: "A manager with this mobile number already exists" });
    }

    const businessId = await createManagerBusinessId({
      vendorId,
      name: payload.name,
      collectionCentreId: payload.collectionCentreId || "",
      city: payload.city || "",
      state: payload.state || "",
      address: payload.address || "",
    });

    const rawPassword = payload.password || "manager123";
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const manager = new FarmerManager({
      id: businessId.id,
      managerCode: businessId.managerCode,
      collectionCentreId: businessId.collectionCentreId,
      vendorId,
      name: payload.name,
      profileImage: payload.profileImage || "",
      mobile: String(payload.mobile).trim(),
      email: payload.email || "",
      address: payload.address || "",
      city: payload.city || "",
      state: payload.state || "",
      pincode: payload.pincode || "",
      location,
      joiningDate: payload.joiningDate || new Date().toISOString().split("T")[0],
      status: payload.status || "Active",
      authType: payload.authType || "password",
      password: hashedPassword,
      role: "FARMER_MANAGER",
    });

    await manager.save();
    const enriched = await enrichManagerDoc(manager);
    res.status(201).json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create manager" });
  }
}

export async function updateManager(req, res) {
  try {
    const { managerId } = req.params;
    const payload = req.body;

    const query = { id: managerId };
    if (req.user?.role === "VENDOR") {
      const vId = req.user.vendorId || req.user.id || "";
      if (!vId) return res.status(404).json({ message: "Manager not found" });
      query.vendorId = vId;
    }
    const manager = await FarmerManager.findOne(query);
    if (!manager) return res.status(404).json({ message: "Manager not found" });

    if (payload.name) manager.name = payload.name;
    if (payload.mobile) manager.mobile = payload.mobile;
    if (payload.email !== undefined) manager.email = payload.email;
    if (payload.address !== undefined) manager.address = payload.address;
    if (payload.city !== undefined) manager.city = payload.city;
    if (payload.state !== undefined) manager.state = payload.state;
    if (payload.pincode !== undefined) manager.pincode = payload.pincode;
    if (payload.status) manager.status = payload.status;

    manager.location = [manager.city, manager.state].filter(Boolean).join(", ") || payload.location || manager.location;

    await manager.save();
    const enriched = await enrichManagerDoc(manager);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update manager" });
  }
}

export async function setManagerStatus(req, res) {
  try {
    const { managerId } = req.params;
    const { status } = req.body;
    const query = { id: managerId };
    if (req.user?.role === "VENDOR") {
      const vId = req.user.vendorId || req.user.id || "";
      if (!vId) return res.status(404).json({ message: "Manager not found" });
      query.vendorId = vId;
    }
    const manager = await FarmerManager.findOne(query);
    if (!manager) return res.status(404).json({ message: "Manager not found" });
    manager.status = status;
    await manager.save();
    const enriched = await enrichManagerDoc(manager);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update manager status" });
  }
}

export async function deleteManager(req, res) {
  try {
    const { managerId } = req.params;
    const query = { id: managerId };
    if (req.user?.role === "VENDOR") {
      const vId = req.user.vendorId || req.user.id || "";
      if (!vId) return res.status(404).json({ message: "Manager not found" });
      query.vendorId = vId;
    }
    const manager = await FarmerManager.findOne(query);
    if (!manager) return res.status(404).json({ message: "Manager not found" });

    const linkedFarmers = await Farmer.countDocuments({ managerId });
    if (linkedFarmers > 0) {
      return res.status(400).json({ message: "Remove or reassign farmers before deleting this manager" });
    }
    await FarmerManager.deleteOne({ id: managerId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete manager" });
  }
}

// ----------------------------------------------------
// VENDOR AUTH CONTROLLERS
// ----------------------------------------------------
export async function vendorLogin(req, res) {
  try {
    const { mobile, password, otp } = req.body;
    if (!mobile) {
      return res.status(400).json({ message: "Mobile number is required" });
    }
    const cleanMobile = String(mobile).replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({ message: "Enter a valid 10-digit mobile number" });
    }

    const vendor = await Vendor.findOne({
      $or: [{ mobile: cleanMobile }, { mobile: String(mobile).trim() }],
    });
    if (!vendor) {
      return res.status(401).json({ message: "Vendor account not found with this mobile number" });
    }
    if (vendor.status !== "Active") {
      return res.status(403).json({ message: `Vendor account is ${vendor.status.toLowerCase()}` });
    }

    // MODE 1: Login with OTP
    if (otp) {
      const verifyResult = await verifyOtp({
        phone: cleanMobile,
        otp: String(otp).trim(),
        purpose: "vendor_login",
      });
      if (!verifyResult.ok) {
        return res.status(400).json({ message: verifyResult.message || "Invalid or expired OTP" });
      }
    }
    // MODE 2: Login with Password
    else if (password) {
      let isMatch = false;
      if (vendor.password && (vendor.password.startsWith("$2a$") || vendor.password.startsWith("$2b$"))) {
        isMatch = await bcrypt.compare(password, vendor.password);
      } else {
        isMatch = vendor.password === password;
        if (isMatch) {
          vendor.password = await bcrypt.hash(password, 10);
          await vendor.save();
        }
      }
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid mobile or password" });
      }
    } else {
      return res.status(400).json({ message: "Either password or OTP is required to sign in" });
    }

    const token = signToken({
      id: vendor.id,
      vendorId: vendor.id,
      role: "VENDOR",
      name: vendor.ownerName,
      vendorName: vendor.vendorName,
    });
    const { password: _pw, ...vendorData } = vendor.toObject();
    return res.json({ success: true, token, vendor: vendorData });
  } catch (err) {
    res.status(500).json({ message: err.message || "Vendor login failed" });
  }
}

export async function vendorSendLoginOtp(req, res) {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ message: "Mobile number is required" });
    }
    const cleanMobile = String(mobile).replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({ message: "Enter a valid 10-digit mobile number" });
    }

    const vendor = await Vendor.findOne({
      $or: [{ mobile: cleanMobile }, { mobile: String(mobile).trim() }],
    });
    if (!vendor) {
      return res.status(401).json({ message: "No active vendor found with this mobile number" });
    }
    if (vendor.status !== "Active") {
      return res.status(403).json({ message: `Vendor account is ${vendor.status.toLowerCase()}` });
    }

    const otpResult = await sendCommonOtp(cleanMobile, "vendor_login");
    return res.json({
      success: true,
      requireOtp: true,
      mobile: cleanMobile,
      message: "Verification OTP sent successfully via GreenGrocc Common OTP (GREGRC_Common_OTP)",
      template: "GreenGrocc Common OTP (GREGRC_Common_OTP)",
      templateId: MSG91_TEMPLATES.COMMON_OTP,
      devMock: otpResult.devMock,
      code: otpResult.devMock ? otpResult.code : undefined,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to send OTP" });
  }
}

export async function vendorResendLoginOtp(req, res) {
  return vendorSendLoginOtp(req, res);
}

export async function getVendorMe(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    const vendor = await Vendor.findOne({ id: vendorId }).lean();
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    const { password: _pw, ...vendorData } = vendor;
    res.json(vendorData);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed" });
  }
}

export async function updateVendorMe(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    const vendor = await Vendor.findOne({ id: vendorId });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const payload = req.body || {};
    const allowed = [
      "vendorName",
      "ownerName",
      "email",
      "phone",
      "businessName",
      "businessAddress",
      "city",
      "state",
      "pincode",
      "gstNumber",
      "panNumber",
      "profileImage",
    ];

    for (const key of allowed) {
      if (payload[key] !== undefined) {
        vendor[key] = typeof payload[key] === "string" ? payload[key].trim() : payload[key];
      }
    }

    if (payload.bank && typeof payload.bank === "object") {
      const currentBank = vendor.bank && typeof vendor.bank === "object" ? vendor.bank : {};
      vendor.bank = {
        accountHolder: payload.bank.accountHolder !== undefined ? String(payload.bank.accountHolder).trim() : currentBank.accountHolder || "",
        bankName: payload.bank.bankName !== undefined ? String(payload.bank.bankName).trim() : currentBank.bankName || "",
        accountNumber: payload.bank.accountNumber !== undefined ? String(payload.bank.accountNumber).trim() : currentBank.accountNumber || "",
        ifsc: payload.bank.ifsc !== undefined ? String(payload.bank.ifsc).trim().toUpperCase() : currentBank.ifsc || "",
      };
      vendor.markModified("bank");
    }

    if (payload.settings && typeof payload.settings === "object") {
      const currentSettings = vendor.settings && typeof vendor.settings === "object" ? vendor.settings : {};
      vendor.settings = { ...currentSettings, ...payload.settings };
      vendor.markModified("settings");
    }

    if (payload.password && typeof payload.password === "string" && payload.password.trim()) {
      vendor.password = await bcrypt.hash(payload.password.trim(), 10);
    }

    await vendor.save();
    const { password: _pw, ...vendorData } = vendor.toObject();
    res.json({ success: true, vendor: vendorData });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update profile" });
  }
}

export async function getVendorSettings(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    const vendor = await Vendor.findOne({ id: vendorId }).lean();
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const defaultSettings = {
      display: {
        theme: "light",
        compactMode: false,
        autoRefreshInterval: 0,
        dateFormat: "DD/MM/YYYY",
        currency: "INR",
        defaultLandingPage: "/dashboard",
      },
      operations: {
        autoAssignDrivers: false,
        defaultBatchSize: 5,
        collectionCenterOpening: "08:00",
        collectionCenterClosing: "20:00",
        autoConfirmPreorders: false,
        requireQualityPhotos: true,
        strictGradingConfirmation: true,
      },
      notifications: {
        orderReceivedSound: true,
        emailNotifications: true,
        smsAlerts: false,
        lowStockThresholdKg: 50,
        notifyDriverArrival: true,
        notifyQualityCompleted: true,
        dailySummaryEmail: false,
      },
      security: {
        twoFactorAuth: false,
        autoLogoutMinutes: 60,
        ipRestrictionEnabled: false,
        allowedIps: "",
      },
      integrations: {
        erpWebhookUrl: "",
        exportFormat: "excel",
        realtimeSync: true,
      },
    };

    const saved = vendor.settings && typeof vendor.settings === "object" ? vendor.settings : {};
    const merged = {
      display: { ...defaultSettings.display, ...(saved.display || {}) },
      operations: { ...defaultSettings.operations, ...(saved.operations || {}) },
      notifications: { ...defaultSettings.notifications, ...(saved.notifications || {}) },
      security: { ...defaultSettings.security, ...(saved.security || {}) },
      integrations: { ...defaultSettings.integrations, ...(saved.integrations || {}) },
    };

    res.json({ success: true, settings: merged });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load settings" });
  }
}

export async function updateVendorSettings(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    const vendor = await Vendor.findOne({ id: vendorId });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const payload = req.body || {};
    const current = vendor.settings && typeof vendor.settings === "object" ? vendor.settings : {};

    vendor.settings = {
      ...current,
      ...payload,
      display: { ...(current.display || {}), ...(payload.display || {}) },
      operations: { ...(current.operations || {}), ...(payload.operations || {}) },
      notifications: { ...(current.notifications || {}), ...(payload.notifications || {}) },
      security: { ...(current.security || {}), ...(payload.security || {}) },
      integrations: { ...(current.integrations || {}), ...(payload.integrations || {}) },
    };

    vendor.markModified("settings");
    await vendor.save();

    res.json({ success: true, settings: vendor.settings });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to save settings" });
  }
}


export async function getVendors(req, res) {
  try {
    const vendors = await Vendor.find().lean();
    res.json(vendors.map(({ password: _pw, ...v }) => v));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed" });
  }
}

export async function createVendor(_req, res) {
  return res.status(403).json({ message: "Multivendors must be created by admin from the admin panel." });
}

export async function updateVendor(req, res) {
  try {
    const { vendorId } = req.params;
    const payload = req.body;
    const vendor = await Vendor.findOne({ id: vendorId });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    Object.assign(vendor, payload);
    if (payload.password) vendor.password = await bcrypt.hash(payload.password, 10);
    await vendor.save();
    const { password: _pw, ...vendorData } = vendor.toObject();
    res.json(vendorData);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update vendor" });
  }
}

export async function getVendorDashboard(req, res) {
  try {
    res.json(await buildVendorDashboard(req.user?.vendorId, req.query));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load dashboard" });
  }
}

export async function getVendorAllCrops(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id || "";
    if (!vendorId) return res.json({ farmers: [], crops: [] });

    const farmers = await Farmer.find({ vendorId, isDeleted: { $ne: true } })
      .select("id farmerId name mobile farmName farmLocation location farmerCode managerName")
      .sort({ createdAt: -1 })
      .lean();

    if (!farmers.length) {
      return res.json({ farmers: [], crops: [] });
    }

    const farmerMap = new Map();
    const vendorFarmerIds = [];
    farmers.forEach((f) => {
      [f.id, f.farmerId, f.farmerCode].filter(Boolean).forEach((id) => {
        farmerMap.set(id, f);
        vendorFarmerIds.push(id);
      });
    });

    const crops = await FarmerCrop.find({
      $or: [{ vendorId }, { farmerId: { $in: vendorFarmerIds } }],
      approvalStatus: { $nin: ["Pending", "Rejected"] },
    })
      .select(CROP_LIST_EXCLUDE)
      .sort({ createdAt: -1 })
      .lean();

    await persistDerivedCropStatuses(crops);
    res.json({
      farmers,
      crops: crops.map((c) => {
        const f = farmerMap.get(c.farmerId) || {};
        return {
          ...c,
          farmerId: f.id || f.farmerId || c.farmerId,
          farmerName: f.name || c.farmerName || "—",
          farmerMobile: f.mobile || c.farmerMobile || "",
          farmerCode: f.farmerCode || f.farmerId || f.id || c.farmerId,
          farmerLocation: f.farmLocation || f.location || c.farmerLocation || "",
          farmName: f.farmName || "",
          managerName: f.managerName || c.managerName || "—",
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch crops" });
  }
}

function serializeVendorFarmerCrop(crop, farmer = {}) {
  return {
    ...crop,
    farmerId: farmer.id || farmer.farmerId || crop.farmerId,
    farmerName: farmer.name || crop.farmerName || "—",
    farmerMobile: farmer.mobile || crop.farmerMobile || "",
    farmerCode: farmer.farmerCode || farmer.farmerId || farmer.id || crop.farmerId,
    farmerLocation: farmer.farmLocation || farmer.location || crop.farmerLocation || "",
    managerName: farmer.managerName || crop.managerName || "—",
    approvalStatus: crop.approvalStatus || "Approved",
  };
}

export async function getVendorFarmerCropRequests(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id || "";
    if (!vendorId) return res.json({ farmers: [], crops: [], stats: { pending: 0, approved: 0, rejected: 0 } });

    const farmers = await Farmer.find({ vendorId, isDeleted: { $ne: true } })
      .select("id farmerId name mobile farmName farmLocation location farmerCode managerName")
      .sort({ createdAt: -1 })
      .lean();

    const farmerMap = new Map();
    const vendorFarmerIds = [];
    farmers.forEach((f) => {
      [f.id, f.farmerId, f.farmerCode].filter(Boolean).forEach((id) => {
        farmerMap.set(id, f);
        vendorFarmerIds.push(id);
      });
    });

    const requested = { approvalStatus: { $in: ["Pending", "Approved", "Rejected"] } };
    const cropFilter = vendorFarmerIds.length
      ? { $and: [{ $or: [{ vendorId }, { farmerId: { $in: vendorFarmerIds } }] }, requested] }
      : { vendorId, ...requested };

    const allRequested = vendorFarmerIds.length || vendorId
      ? await FarmerCrop.find(cropFilter).select(CROP_LIST_EXCLUDE).sort({ createdAt: -1 }).lean()
      : [];

    const stats = { pending: 0, approved: 0, rejected: 0 };
    allRequested.forEach((crop) => {
      const key = String(crop.approvalStatus || "").toLowerCase();
      if (key === "pending") stats.pending += 1;
      else if (key === "rejected") stats.rejected += 1;
      else stats.approved += 1;
    });

    const status = String(req.query.status || "Pending").trim();
    const crops = (status && status !== "all"
      ? allRequested.filter((crop) => String(crop.approvalStatus || "") === status)
      : allRequested
    ).map((crop) => serializeVendorFarmerCrop(crop, farmerMap.get(crop.farmerId) || {}));

    res.json({ farmers, crops, stats });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load farmer crop requests" });
  }
}

export async function reviewFarmerCrop(req, res) {
  try {
    const farmer = await Farmer.findOne(accessibleFarmerQuery(req, req.params.farmerId));
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    const crop = await FarmerCrop.findOne({
      farmerId: { $in: farmerIdentityIds(farmer, req.params.farmerId) },
      $or: [{ id: req.params.cropId }, { cropId: req.params.cropId }, { previousCropId: req.params.cropId }],
    });
    if (!crop) return res.status(404).json({ message: "Crop not found" });
    if (String(crop.approvalStatus || "") !== "Pending") {
      return res.status(400).json({ message: "Only pending crop requests can be reviewed" });
    }

    const decision = String(req.body?.decision || req.body?.status || "").trim().toLowerCase();
    const reviewer = req.user?.name || req.user?.role || "";
    if (["approved", "approve", "active"].includes(decision)) {
      crop.approvalStatus = "Approved";
      crop.rejectionReason = "";
    } else if (["rejected", "reject"].includes(decision)) {
      crop.approvalStatus = "Rejected";
      crop.rejectionReason = String(req.body?.reason || req.body?.rejectionReason || "").trim();
    } else {
      return res.status(400).json({ message: "Decision must be approved or rejected" });
    }
    crop.reviewedBy = reviewer;
    crop.reviewedAt = new Date();
    await crop.save();
    if (isStaffChange(req)) pushFarmerCropChange(crop);
    res.json(publicCrop(crop, farmer));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to review crop request" });
  }
}

function applyProductPageFilters(filter, { status, category, q } = {}) {
  if (status) filter.status = String(status);
  if (category) filter.category = String(category);
  const needle = String(q || "").trim();
  if (needle) {
    const rx = containsRegex(needle);
    filter.$or = [{ name: rx }, { productName: rx }, { cropName: rx }, { variety: rx }, { sku: rx }, { productId: rx }];
  }
  return filter;
}

async function findProductPage(filter, query) {
  const { page, limit, skip } = getPageParams(query, PAGE_LIMITS.products);
  const [total, products] = await Promise.all([
    FarmerProduct.countDocuments(filter),
    FarmerProduct.find(filter).select(PRODUCT_LIST_EXCLUDE).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
  ]);
  return { page, limit, total, products };
}

export async function getVendorAllProducts(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id || "";
    if (!vendorId) {
      return res.json(isPaginationRequested(req.query) ? { page: 1, limit: 10, total: 0, products: [], farmers: [] } : { farmers: [], products: [] });
    }

    const farmers = await Farmer.find({ vendorId, isDeleted: { $ne: true } })
      .select("id farmerId farmerCode name mobile farmName farmLocation location")
      .sort({ createdAt: -1 })
      .lean();
    const { ids: farmerIds, farmerMap } = indexFarmersByIdentity(farmers);

    const scopedIds = req.query.farmerId
      ? farmerIdentityIds(farmerMap.get(String(req.query.farmerId)), String(req.query.farmerId)).filter((id) => farmerIds.includes(id))
      : farmerIds;
    const farmerProductScope = scopedIds.length
      ? { farmerId: { $in: scopedIds }, isDeleted: { $ne: true } }
      : { farmerId: "__none__", isDeleted: { $ne: true } };

    const withFarmer = (p) => {
      const f = farmerMap.get(p.farmerId) || {};
      return enrichProductRow({
        ...p,
        farmerId: f.id || p.farmerId,
        farmerName: f.name || p.farmerName || "—",
      }, f.name || p.farmerName || "—");
    };

    if (isPaginationRequested(req.query)) {
      const filter = applyProductPageFilters({ ...farmerProductScope }, req.query);
      const { page, limit, total, products } = await findProductPage(filter, req.query);
      return res.json({ ...paginatedResponse(products.map(withFarmer), total, page, limit), farmers });
    }

    if (!farmerIds.length) return res.json({ farmers, products: [] });
    const products = await FarmerProduct.find(farmerProductScope)
      .select(PRODUCT_LIST_EXCLUDE)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      farmers,
      products: products.map(withFarmer),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch products" });
  }
}

// ----------------------------------------------------
// MANAGER AUTH CONTROLLERS
// ----------------------------------------------------
export async function managerLogin(req, res) {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      return res.status(400).json({ message: "Mobile and password are required" });
    }
    const manager = await FarmerManager.findOne({ mobile: String(mobile).trim() });
    if (!manager) {
      return res.status(401).json({ message: "Invalid mobile or password" });
    }
    if (manager.status !== "Active") {
      return res.status(403).json({ message: `Manager account is ${manager.status.toLowerCase()}` });
    }
    let isMatch = false;
    if (manager.password && (manager.password.startsWith("$2a$") || manager.password.startsWith("$2b$"))) {
      isMatch = await bcrypt.compare(password, manager.password);
    } else {
      isMatch = manager.password === password;
      if (isMatch) {
        manager.password = await bcrypt.hash(password, 10);
        await manager.save();
      }
    }
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid mobile or password" });
    }
    const token = signToken({
      id: manager.id,
      managerId: manager.id,
      vendorId: manager.vendorId,
      role: "FARMER_MANAGER",
      name: manager.name,
    });
    const { password: _pw, ...managerData } = manager.toObject();
    res.json({
      success: true,
      token,
      // Return in same shape as farmer login so the farmer app can handle it
      farmer: {
        ...managerData,
        id: manager.id,
        role: "FARMER_MANAGER",
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Manager login failed" });
  }
}

export async function getManagerMe(req, res) {
  try {
    const manager = await FarmerManager.findOne({ id: req.user.managerId }).lean();
    if (!manager) return res.status(404).json({ message: "Manager not found" });
    const { password: _pw, ...managerData } = manager;
    res.json(managerData);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed" });
  }
}

// ----------------------------------------------------
// MANAGER-SCOPED CONTROLLERS
// ----------------------------------------------------
export async function getManagerFarmers(req, res) {
  try {
    const { q = "", status = "", lite = "" } = req.query;
    const query = assignedFarmerQuery(req);
    if (status) query.status = status;
    const isLite = lite === "1" || lite === "true";
    const toRows = async (docs) =>
      isLite
        ? docs.map((f) => ({
            ...f,
            loginEnabled: f.loginEnabled !== false,
            initials: initials(f.name),
          }))
        : enrichFarmerDocsBatch(docs);

    if (isPaginationRequested(req.query)) {
      const { page, limit, skip } = getPageParams(req.query, PAGE_LIMITS.farmers);
      const needle = q.trim();
      if (needle) {
        const rx = containsRegex(needle);
        query.$or = [{ name: rx }, { mobile: rx }, { farmName: rx }, { farmerCode: rx }, { farmerId: rx }, { id: rx }];
      }
      const [total, pageDocs] = await Promise.all([
        Farmer.countDocuments(query),
        Farmer.find(query).select(FARMER_LIST_EXCLUDE).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      ]);
      return res.json(paginatedResponse(await toRows(pageDocs), total, page, limit));
    }

    const farmerDocs = await Farmer.find(query).select(FARMER_LIST_EXCLUDE).sort({ createdAt: -1 }).lean();
    let enriched = await toRows(farmerDocs);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      enriched = enriched.filter(
        (f) => f.name.toLowerCase().includes(needle) || f.mobile.includes(needle)
      );
    }
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch farmers" });
  }
}

export async function getManagerDashboard(req, res) {
  try {
    const farmers = await Farmer.find(assignedFarmerQuery(req)).select("id farmerId name status").lean();
    const { ids: farmerIds } = indexFarmersByIdentity(farmers);
    const farmerNameMap = new Map();
    farmers.forEach((f) => {
      farmerNameMap.set(f.id, f.name);
      if (f.farmerId) farmerNameMap.set(f.farmerId, f.name);
    });

    if (!farmerIds.length) {
      return res.json({
        totalFarmers: 0,
        activeFarmers: 0,
        totalProducts: 0,
        totalInventory: 0,
        totalOrders: 0,
        pendingOrders: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        recentOrders: [],
        lowStock: [],
        pendingProductApprovals: 0,
      });
    }

    const [[productFacet], orderAgg, earningAgg, farmerOrders, harvestRows] = await Promise.all([
      FarmerProduct.aggregate([
        { $match: { farmerId: { $in: farmerIds } } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalProducts: { $sum: 1 },
                  totalInventory: { $sum: { $ifNull: ["$stock", 0] } },
                  pendingProductApprovals: {
                    $sum: { $cond: [{ $in: ["$status", ["Pending Approval", "Pending", "PENDING_APPROVAL"]] }, 1, 0] },
                  },
                },
              },
            ],
            lowStock: [
              { $match: { $expr: LOW_STOCK_EXPR } },
              { $limit: 20 },
              { $project: { farmerId: 1, name: 1, grades: 1, stock: 1, lowStockLimit: 1 } },
            ],
          },
        },
      ]),
      FarmerOrder.aggregate([
        { $match: { farmerId: { $in: farmerIds } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            pendingOrders: { $sum: { $cond: [{ $in: ["$status", ["New", "NEW", "Confirmed", "Approved", "Processing"]] }, 1, 0] } },
          },
        },
      ]),
      FarmerEarning.aggregate([
        { $match: { farmerId: { $in: farmerIds } } },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: { $ifNull: ["$netEarnings", 0] } },
            pendingEarnings: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, { $ifNull: ["$netEarnings", 0] }, 0] } },
          },
        },
      ]),
      FarmerOrder.find({ farmerId: { $in: farmerIds } })
        .sort({ createdAt: -1, orderDate: -1 })
        .limit(20)
        .lean(),
      FarmerHarvestOrder.find({ farmerId: { $in: farmerIds } })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const p = productFacet.totals[0] || { totalProducts: 0, totalInventory: 0, pendingProductApprovals: 0 };
    const { pendingProductApprovals } = p;
    const lowStockProducts = productFacet.lowStock;
    const o = orderAgg[0] || { totalOrders: 0, pendingOrders: 0 };
    const e = earningAgg[0] || { totalEarnings: 0, pendingEarnings: 0 };
    const named = (ord) => ({
      ...ord,
      status: normalizeOrderStatus(ord.status),
      farmerName: farmerNameMap.get(ord.farmerId) || ord.farmerName || "—",
    });
    const recentOrders = mergeHarvestLists(
      harvestRows.map(named),
      mapFarmerOrdersToHarvest(farmerOrders).map(named)
    )
      .slice(0, 10)
      .map((ord) => ({
        ...ord,
        orderId: ord.orderId || ord.id,
        productName: ord.productName || ord.products?.[0]?.name || "—",
        totalQuantity: Number(ord.totalQuantity || ord.orderedQuantity || 0),
        totalAmount: Number(ord.totalAmount || ord.orderValue || ord.amount || 0),
        orderDate: ord.orderDate || ord.date || ord.createdAt,
      }));

    res.json({
      totalFarmers: farmers.length,
      activeFarmers: farmers.filter((f) => f.status === "Active").length,
      totalProducts: p.totalProducts,
      totalInventory: p.totalInventory,
      totalOrders: o.totalOrders,
      pendingOrders: o.pendingOrders,
      totalEarnings: e.totalEarnings,
      pendingEarnings: e.pendingEarnings,
      pendingProductApprovals,
      recentOrders,
      lowStock: lowStockProducts.map((prod) => ({
        farmerId: prod.farmerId,
        farmerName: farmerNameMap.get(prod.farmerId) || "—",
        productName: prod.name,
        grades: prod.grades,
        currentStock: prod.stock || 0,
        status: "Low Stock",
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed" });
  }
}

function attachFarmerMeta(farmers) {
  return farmers.map((f) => ({
    ...f,
    loginEnabled: f.loginEnabled !== false,
    initials: initials(f.name),
  }));
}

export async function getManagerAllCrops(req, res) {
  try {
    const assignedFarmers = await getAssignedFarmers(req);
    const { ids: farmerIds, farmerMap } = indexFarmersByIdentity(assignedFarmers);
    const farmers = attachFarmerMeta(assignedFarmers);
    if (!farmerIds.length) {
      return res.json({ farmers: [], crops: [] });
    }
    const crops = await FarmerCrop.find({ farmerId: { $in: farmerIds } })
      .select(CROP_LIST_EXCLUDE)
      .sort({ createdAt: -1 })
      .lean();

    await persistDerivedCropStatuses(crops);
    res.json({
      farmers,
      crops: crops.map((c) => {
        const f = farmerMap.get(c.farmerId) || {};
        return {
          ...c,
          farmerId: f.id || c.farmerId,
          farmerName: f.name || c.farmerName || "—",
          farmerMobile: f.mobile || c.farmerMobile || "",
          farmerCode: f.farmerCode || f.farmerId || f.id || c.farmerId,
          farmerLocation: f.farmLocation || f.location || c.farmerLocation || "",
          managerName: f.managerName || c.managerName || "—",
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch crops" });
  }
}

export async function getManagerAllProducts(req, res) {
  try {
    const assignedFarmers = await getAssignedFarmers(req);
    const { ids: farmerIds, farmerMap } = indexFarmersByIdentity(assignedFarmers);
    const farmers = attachFarmerMeta(assignedFarmers);
    if (isPaginationRequested(req.query)) {
      const requested = req.query.farmerId ? String(req.query.farmerId) : "";
      const scopedIds = requested
        ? farmerIdentityIds(farmerMap.get(requested), requested).filter((id) => farmerIds.includes(id))
        : farmerIds;
      if (!scopedIds.length) {
        const { page, limit } = getPageParams(req.query, PAGE_LIMITS.products);
        return res.json({ ...paginatedResponse([], 0, page, limit), farmers });
      }
      const filter = applyProductPageFilters({ farmerId: { $in: scopedIds } }, req.query);
      const { page, limit, total, products } = await findProductPage(filter, req.query);
      const rows = products.map((p) => {
        const f = farmerMap.get(p.farmerId) || {};
        return enrichProductRow(p, f.name || p.farmerName || "—");
      });
      return res.json({ ...paginatedResponse(rows, total, page, limit), farmers });
    }
    if (!farmerIds.length) return res.json({ farmers, products: [] });
    const products = await FarmerProduct.find({ farmerId: { $in: farmerIds } })
      .select(PRODUCT_LIST_EXCLUDE)
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      farmers,
      products: products.map((p) => {
        const f = farmerMap.get(p.farmerId) || {};
        return enrichProductRow({
          ...p,
          farmerId: f.id || p.farmerId,
          farmerName: f.name || p.farmerName || "—",
        }, f.name || p.farmerName || "—");
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch products" });
  }
}

export async function getManagerAllOrders(req, res) {
  try {
    const farmers = attachFarmerMeta(await getAssignedFarmers(req));
    const farmerIds = farmers.map((f) => f.id);
    const farmerMap = new Map(farmers.map((f) => [f.id, f]));
    const withFarmer = (o) => {
      const f = farmerMap.get(o.farmerId);
      return {
        ...o,
        farmerName: f?.name || "—",
        farmerMobile: f?.mobile || "",
        farmerLocation: f?.farmLocation || "",
      };
    };
    if (isPaginationRequested(req.query)) {
      const { page, limit, skip } = getPageParams(req.query, PAGE_LIMITS.orders);
      if (!farmerIds.length) return res.json({ ...paginatedResponse([], 0, page, limit), farmers });
      const filter = {
        farmerId: { $in: farmerIds },
        isDeleted: { $ne: true },
        deleted: { $ne: true },
        status: { $not: DELETED_ORDER_STATUS_RX },
      };
      const [total, orders] = await Promise.all([
        FarmerOrder.countDocuments(filter),
        FarmerOrder.find(filter).sort({ orderDate: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      ]);
      return res.json({ ...paginatedResponse(orders.map(withFarmer), total, page, limit), farmers });
    }
    if (!farmerIds.length) return res.json({ farmers, orders: [] });
    const orders = await FarmerOrder.find({
      farmerId: { $in: farmerIds },
      isDeleted: { $ne: true },
      status: { $nin: ["DELETED", "Deleted", "deleted", "CANCELLED", "Cancelled", "cancelled"] },
    })
      .sort({ orderDate: -1 })
      .lean();
    res.json({
      farmers,
      orders: orders.filter((o) => !isOrderDeleted(o)).map(withFarmer),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch orders" });
  }
}

export async function getManagerAllInventory(req, res) {
  try {
    const farmers = attachFarmerMeta(await getAssignedFarmers(req));
    const { ids: farmerIds, farmerMap } = indexFarmersByIdentity(farmers);
    if (!farmerIds.length) return res.json({ farmers, inventory: [] });
    const products = await FarmerProduct.find({ farmerId: { $in: farmerIds } })
      .select("-images -description")
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      farmers,
      inventory: products.map((p) => {
        const f = farmerMap.get(p.farmerId) || {};
        return enrichProductRow({
          ...p,
          farmerId: f.id || p.farmerId,
          farmerName: f.name || f.fullName || p.farmerName || "—",
        }, f.name || f.fullName || "—");
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch inventory" });
  }
}

export async function getManagerAllDocuments(req, res) {
  try {
    const farmers = attachFarmerMeta(await getAssignedFarmers(req));
    const farmerIds = farmers.map((f) => f.id);
    if (!farmerIds.length) return res.json({ farmers, documents: [] });

    const allIds = [...new Set([...farmerIds, ...farmers.map((f) => f.farmerId).filter(Boolean)])];
    const documents = await FarmerDocument.find({
      farmerId: { $in: allIds },
    }).lean();
    res.json({ farmers, documents: documents.filter(isRealFarmerDocument) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch documents" });
  }
}

export async function getManagerAllStockHistory(req, res) {
  try {
    const farmers = attachFarmerMeta(await getAssignedFarmers(req));
    const { ids: farmerIds, farmerMap } = indexFarmersByIdentity(farmers);
    const { farmerId } = req.query;
    const ids = farmerId ? farmerIds.filter((id) => id === farmerId) : farmerIds;
    const paged = isPaginationRequested(req.query) ? getPageParams(req.query, PAGE_LIMITS.stockHistory) : null;
    if (!ids.length) {
      if (paged) return res.json({ ...paginatedResponse([], 0, paged.page, paged.limit), farmers });
      return res.json({ farmers, history: [] });
    }
    const historyFilter = { farmerId: { $in: ids } };
    const [history, total] = await Promise.all([
      paged
        ? FarmerStockHistory.find(historyFilter).sort({ at: -1, _id: -1 }).skip(paged.skip).limit(paged.limit).lean()
        : FarmerStockHistory.find(historyFilter).sort({ at: -1 }).limit(500).lean(),
      paged ? FarmerStockHistory.countDocuments(historyFilter) : null,
    ]);

    const refs = [
      ...new Set(
        history
          .map((h) => String(h.reference || "").trim())
          .filter((r) => r && r !== "—")
      ),
    ];
    const [orders, inspections, pickups, centres] = await Promise.all([
      refs.length
        ? FarmerOrder.find({
            $or: [{ id: { $in: refs } }, { orderId: { $in: refs } }],
          }).lean()
        : [],
      refs.length
        ? QualityInspection.find({
            $or: [{ orderId: { $in: refs } }, { inspectionId: { $in: refs } }],
          }).lean()
        : [],
      refs.length
        ? Pickup.find({
            $or: [{ orderId: { $in: refs } }, { pickupId: { $in: refs } }, { id: { $in: refs } }],
          }).lean()
        : [],
      CollectionCentre.find({}).lean(),
    ]);

    const orderByRef = new Map();
    orders.forEach((o) => {
      if (o.id) orderByRef.set(String(o.id), o);
      if (o.orderId) orderByRef.set(String(o.orderId), o);
    });
    const inspectionByOrder = new Map();
    inspections.forEach((ins) => {
      if (ins.orderId) inspectionByOrder.set(String(ins.orderId), ins);
      if (ins.inspectionId) inspectionByOrder.set(String(ins.inspectionId), ins);
    });
    const pickupByOrder = new Map();
    pickups.forEach((p) => {
      if (p.orderId) pickupByOrder.set(String(p.orderId), p);
      if (p.pickupId) pickupByOrder.set(String(p.pickupId), p);
      if (p.id) pickupByOrder.set(String(p.id), p);
    });
    const centreById = new Map(
      centres.map((c) => [String(c.id || c.centreId || c.collectionCentreId || ""), c])
    );

    const enriched = history.map((h) => {
      const ref = String(h.reference || "").trim();
      const order = orderByRef.get(ref) || null;
      const orderKey = order?.orderId || order?.id || ref;
      const inspection = inspectionByOrder.get(ref) || inspectionByOrder.get(String(orderKey)) || null;
      const pickup =
        pickupByOrder.get(ref) ||
        pickupByOrder.get(String(order?.id || "")) ||
        pickupByOrder.get(String(order?.orderId || "")) ||
        pickupByOrder.get(String(inspection?.pickupId || "")) ||
        null;
      const centreId =
        inspection?.collectionCentreId ||
        pickup?.collectionCentreId ||
        order?.collectionCentreId ||
        "";
      const centre = centreById.get(String(centreId)) || null;
      const batchId =
        inspection?.batchId ||
        pickup?.collectionBatchId ||
        pickup?.batchId ||
        "";
      const orderDisplayId = order?.orderId || order?.id || (ref && ref !== "—" ? ref : "");
      const reason = String(h.reason || "");
      const isQuality = /quality|grading/i.test(reason) || Boolean(inspection);
      const sourceType = isQuality
        ? "Quality & Grading"
        : /order/i.test(String(h.action || "")) || /order/i.test(reason)
          ? "Order"
          : String(h.updatedBy || "").toLowerCase() === "farmer"
            ? "Farmer Stock"
            : "Manual Update";
      const fObj = farmerMap.get(h.farmerId);
      const sourceFrom = fObj?.name || fObj?.fullName || h.farmerId || "—";
      const centreName =
        centre?.name ||
        centre?.centreName ||
        order?.collectionCentre ||
        pickup?.collectionCentreName ||
        "";
      const sourceDetail = [
        sourceType,
        sourceFrom ? `from ${sourceFrom}` : "",
        orderDisplayId ? `Order ${orderDisplayId}` : "",
        batchId ? `Batch ${batchId}` : "",
        centreName ? `Centre ${centreName}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        ...h,
        farmerName: sourceFrom,
        farmerId: h.farmerId,
        sourceType,
        sourceFrom,
        sourceDetail: sourceDetail || reason || h.action || "—",
        orderId: orderDisplayId || "",
        batchId: batchId || "",
        pickupId: pickup?.pickupId || pickup?.id || inspection?.pickupId || "",
        collectionCentreId: centreId || "",
        collectionCentreName: centreName || "",
        variety: order?.variety || inspection?.variety || "",
        unit: order?.unit || "Kg",
      };
    });

    if (paged) return res.json({ ...paginatedResponse(enriched, total, paged.page, paged.limit), farmers });
    res.json({
      farmers,
      history: enriched,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch stock history" });
  }
}

export async function getManagerAllHarvestOrders(req, res) {
  try {
    const farmers = attachFarmerMeta(await getAssignedFarmers(req));
    const { ids: farmerIds, farmerMap } = indexFarmersByIdentity(farmers);
    if (!farmerIds.length) return res.json({ farmers, orders: [] });
    const notDeletedQuery = {
      farmerId: { $in: farmerIds },
      isDeleted: { $ne: true },
      status: { $nin: ["DELETED", "Deleted", "deleted", "CANCELLED", "Cancelled", "cancelled"] },
    };
    const [harvestOrders, farmerOrders, earnings] = await Promise.all([
      FarmerHarvestOrder.find(notDeletedQuery).sort({ createdAt: -1 }).lean(),
      FarmerOrder.find(notDeletedQuery).sort({ orderDate: -1 }).lean(),
      FarmerEarning.find({ farmerId: { $in: farmerIds } }).lean().catch(() => []),
    ]);

    const earningPaidMap = new Map();
    (earnings || []).forEach((e) => {
      if (isOrderPaidString(e.status) && (e.orderId || e.id)) {
        if (e.orderId) earningPaidMap.set(String(e.orderId), true);
        if (e.id) earningPaidMap.set(String(e.id), true);
      }
    });

    const mapped = mapFarmerOrdersToHarvest(farmerOrders)
      .filter((o) => !isOrderDeleted(o))
      .map((o) => {
        const f = farmerMap.get(o.farmerId);
        const isPaidFromEarning = earningPaidMap.get(String(o.id)) || earningPaidMap.get(String(o.orderId));
        const payStatus = isPaidFromEarning ? "Paid" : (o.paymentStatus || "Pending");
        return {
          ...o,
          paymentStatus: isOrderPaidString(payStatus) ? "Paid" : payStatus,
          farmerName: o.farmerName || f?.name || "—",
          farmerMobile: f?.mobile || "",
        };
      });
    const harvestWithNames = harvestOrders
      .filter((o) => !isOrderDeleted(o))
      .map((o) => {
        const f = farmerMap.get(o.farmerId);
        const isPaidFromEarning = earningPaidMap.get(String(o.id)) || earningPaidMap.get(String(o.orderId));
        const payStatus = isPaidFromEarning ? "Paid" : (o.paymentStatus || "Pending");
        return {
          ...o,
          paymentStatus: isOrderPaidString(payStatus) ? "Paid" : payStatus,
          status: normalizeOrderStatus(o.status),
          farmerName: o.farmerName || f?.name || "—",
          farmerMobile: f?.mobile || "",
        };
      });
    const finalOrders = mergeHarvestLists(harvestWithNames, mapped).filter((o) => !isOrderDeleted(o));
    res.json({ farmers, orders: finalOrders });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch harvest orders" });
  }
}

export async function getManagerAllEarnings(req, res) {
  try {
    const farmers = attachFarmerMeta(await getAssignedFarmers(req));
    const farmerIds = farmers.map((f) => f.id);
    if (!farmerIds.length) return res.json({ farmers, earnings: [], transactions: [] });
    const earnings = await FarmerEarning.find({ farmerId: { $in: farmerIds } }).sort({ date: -1 }).lean();
    const farmerNameMap = new Map(farmers.map((f) => [f.id, f.name]));
    const transactions = earnings.map((e) => ({ ...e, farmerName: farmerNameMap.get(e.farmerId) || "—" }));
    const totalEarnings = transactions.reduce((s, r) => s + Number(r.netEarnings || 0), 0);
    const paidEarnings = transactions.filter((r) => r.status === "Paid").reduce((s, r) => s + Number(r.netEarnings || 0), 0);
    const pendingEarnings = transactions.filter((r) => r.status === "Pending").reduce((s, r) => s + Number(r.netEarnings || 0), 0);
    res.json({
      farmers,
      transactions,
      earnings: transactions,
      summary: { totalEarnings, paidEarnings, pendingEarnings },
      totalEarnings,
      paidEarnings,
      pendingEarnings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch earnings" });
  }
}

export async function assignFarmerManager(req, res) {
  try {
    const { farmerId } = req.params;
    const { managerId } = req.body;
    let vendorId = req.query.vendorId || "";
    if (req.user?.role === "VENDOR") {
      vendorId = req.user.vendorId || req.user.id || "";
    }
    const query = { id: farmerId };
    if (vendorId) query.vendorId = vendorId;
    const farmer = await Farmer.findOne(query);
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    if (managerId) {
      const managerQuery = { id: managerId };
      if (vendorId) managerQuery.vendorId = vendorId;
      const manager = await FarmerManager.findOne(managerQuery);
      if (!manager) return res.status(404).json({ message: "Manager not found" });
    }
    farmer.managerId = managerId || "";
    await farmer.save();
    const ownerKeys = [farmer.id, farmer.farmerId, farmer.farmerCode].filter(Boolean);
    await Promise.all([
      FarmerProduct.updateMany({ farmerId: { $in: ownerKeys } }, { $set: { managerId: farmer.managerId } }).catch(() => {}),
      FarmerDocument.updateMany({ farmerId: { $in: ownerKeys } }, { $set: { managerId: farmer.managerId } }).catch(() => {}),
    ]);
    res.json({ success: true, farmer });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to assign manager" });
  }
}

// ----------------------------------------------------
// HARVEST ORDERS CONTROLLERS
// ----------------------------------------------------
export async function getHarvestOrders(req, res) {
  try {
    let ids = [];
    let assignedFarmers = [];
    if (req.user?.role === "FARMER_MANAGER") {
      assignedFarmers = await getAssignedFarmers(req);
      ids = assignedFarmers.flatMap((f) => [f.id, f.farmerId].filter(Boolean));
    } else if (req.user?.role === "VENDOR") {
      const vendorId = req.user.vendorId || req.user.id || "";
      assignedFarmers = await Farmer.find({ vendorId, isDeleted: { $ne: true } })
        .select("id farmerId name mobile farmName farmLocation")
        .lean();
      const vendorFarmerIds = assignedFarmers.flatMap((f) => [f.id, f.farmerId].filter(Boolean));
      const farmerId = req.params.farmerId || req.query.farmerId;
      if (farmerId && farmerId !== "all" && farmerId !== "ALL") {
        const { ids: resolvedIds } = await resolveFarmerIdentity(farmerId);
        const candidateIds = resolvedIds.length ? resolvedIds : [farmerId];
        ids = candidateIds.filter((id) => vendorFarmerIds.includes(id));
      } else {
        ids = vendorFarmerIds;
      }
    } else {
      const farmerId = req.params.farmerId || req.query.farmerId || req.user?.farmerId || req.user?.id;
      if (farmerId && farmerId !== "all" && farmerId !== "ALL") {
        const { ids: resolvedIds } = await resolveFarmerIdentity(farmerId);
        ids = resolvedIds.length ? resolvedIds : [farmerId];
      }
    }

    if ((req.user?.role === "VENDOR" || req.user?.role === "FARMER_MANAGER") && !ids.length) {
      return res.json([]);
    }

    const filter = ids.length ? { farmerId: { $in: ids } } : {};
    const notDeletedQuery = {
      ...filter,
      isDeleted: { $ne: true },
      status: { $nin: ["DELETED", "Deleted", "deleted", "CANCELLED", "Cancelled", "cancelled"] },
    };

    const [harvestOrders, farmerOrders, earnings] = await Promise.all([
      FarmerHarvestOrder.find(notDeletedQuery).sort({ createdAt: -1 }).lean(),
      FarmerOrder.find(notDeletedQuery).sort({ orderDate: -1, createdAt: -1 }).lean(),
      FarmerEarning.find(filter).lean().catch(() => []),
    ]);

    const earningPaidMap = new Map();
    (earnings || []).forEach((e) => {
      if (isOrderPaidString(e.status) && (e.orderId || e.id)) {
        if (e.orderId) earningPaidMap.set(String(e.orderId), true);
        if (e.id) earningPaidMap.set(String(e.id), true);
      }
    });

    const mapped = mapFarmerOrdersToHarvest(farmerOrders)
      .filter((o) => !isOrderDeleted(o))
      .map((o) => {
        const isPaidFromEarning = earningPaidMap.get(String(o.id)) || earningPaidMap.get(String(o.orderId));
        const payStatus = isPaidFromEarning ? "Paid" : (o.paymentStatus || "Pending");
        return {
          ...o,
          paymentStatus: isOrderPaidString(payStatus) ? "Paid" : payStatus,
        };
      });

    const harvestWithNames = harvestOrders
      .filter((o) => !isOrderDeleted(o))
      .map((o) => {
        const isPaidFromEarning = earningPaidMap.get(String(o.id)) || earningPaidMap.get(String(o.orderId));
        const payStatus = isPaidFromEarning ? "Paid" : (o.paymentStatus || "Pending");
        return {
          ...o,
          paymentStatus: isOrderPaidString(payStatus) ? "Paid" : payStatus,
          status: normalizeOrderStatus(o.status),
        };
      });

    const farmerMap = new Map();
    assignedFarmers.forEach((f) => {
      if (f.id) farmerMap.set(String(f.id), f);
      if (f.farmerId) farmerMap.set(String(f.farmerId), f);
    });

    const combined = mergeHarvestLists(harvestWithNames, mapped)
      .filter((row) => !isOrderDeleted(row))
      .map((row) => {
        const f = farmerMap.get(String(row.farmerId));
        return {
          ...row,
          farmerName: f?.name || row.farmerName || "",
          farmerCode: f?.farmerId || f?.id || row.farmerId || "",
          farmerMobile: f?.mobile || "",
          farmerLocation: f?.farmLocation || f?.farmGeo?.village || "",
        };
      });
    res.json(combined);
  } catch (err) {
    console.error("Error in getHarvestOrders:", err);
    res.status(500).json({ message: err.message || "Failed to fetch harvest orders" });
  }
}

export async function createHarvestOrder(req, res) {
  try {
    const payload = req.body;
    const targetFarmerId = payload.farmerId || req.params.farmerId;
    const { ids, farmer } = await resolveFarmerIdentity(targetFarmerId);
    const farmerDoc = farmer || await Farmer.findOne({
      isDeleted: { $ne: true },
      $or: [{ id: targetFarmerId }, { farmerId: targetFarmerId }, { id: { $in: ids } }],
    });
    if (!farmerDoc) return res.status(404).json({ message: "Farmer not found" });

    const assignedVendorId = String(farmerDoc.vendorId || "").trim();
    if (!assignedVendorId) {
      return res.status(400).json({
        message: "या शेतकऱ्याला कोणताही व्हेंडर नियुक्त (assigned) केलेला नाही. फक्त शेतकऱ्याचा नियुक्त व्हेंडरच ऑर्डर पाठवू शकतो.",
      });
    }

    const callerRole = String(req.user?.role || "").toUpperCase();
    const callerVendorId = String(req.user?.vendorId || (callerRole === "VENDOR" ? (req.user?.id || req.user?.vendorId) : "") || "").trim();

    if (callerRole === "FARMER_MANAGER") {
      return res.status(403).json({
        message: "शेतकऱ्याला ऑर्डर फक्त त्याचा नियुक्त व्हेंडरच पाठवू शकतो. मॅनेजर ऑर्डर पाठवू शकत नाही.",
      });
    }

    if (callerRole !== "VENDOR" && callerRole !== "ADMIN") {
      return res.status(403).json({
        message: "शेतकऱ्याला ऑर्डर फक्त त्याचा नियुक्त व्हेंडरच पाठवू शकतो. इतर कोणालाही ऑर्डर पाठवण्याची परवानगी नाही.",
      });
    }

    if (callerRole === "VENDOR" && callerVendorId !== assignedVendorId) {
      return res.status(403).json({
        message: "तुम्ही या शेतकऱ्याचे नियुक्त व्हेंडर नाही आहात. फक्त या शेतकऱ्याचा नियुक्त व्हेंडरच ऑर्डर पाठवू शकतो.",
      });
    }

    const id = timestampId("ho");
    const order = new FarmerHarvestOrder({
      id,
      vendorId: assignedVendorId,
      farmerId: farmerDoc.id,
      productId: payload.productId,
      productName: payload.productName,
      category: payload.category || "Vegetables",
      date: payload.date || new Date().toISOString().split("T")[0],
      day: payload.day || "",
      unit: payload.unit || "Kg",
      grades: payload.grades || [],
      rejectionQty: Number(payload.rejectionQty) || 0,
      totalQuantity: Number(payload.totalQuantity) || 0,
      totalAmount: Number(payload.totalAmount) || 0,
      status: payload.status || "Approved",
    });

    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create harvest order" });
  }
}

export async function updateHarvestOrder(req, res) {
  try {
    const { id } = req.params;
    const payload = req.body;
    const query = { id };
    if (req.user?.role === "VENDOR") {
      const vendorId = req.user.vendorId || req.user.id || "";
      if (vendorId) query.vendorId = vendorId;
    }
    const order = await FarmerHarvestOrder.findOne(query);
    if (!order) return res.status(404).json({ message: "Harvest order not found" });

    if (payload.productId) order.productId = payload.productId;
    if (payload.productName) order.productName = payload.productName;
    if (payload.category) order.category = payload.category;
    if (payload.date) order.date = payload.date;
    if (payload.day !== undefined) order.day = payload.day;
    if (payload.unit) order.unit = payload.unit;
    if (payload.grades) order.grades = payload.grades;
    if (payload.rejectionQty !== undefined) order.rejectionQty = Number(payload.rejectionQty);
    if (payload.totalQuantity !== undefined) order.totalQuantity = Number(payload.totalQuantity);
    if (payload.totalAmount !== undefined) order.totalAmount = Number(payload.totalAmount);
    if (payload.status) order.status = payload.status;

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update harvest order" });
  }
}

export async function deleteHarvestOrder(req, res) {
  try {
    const { id, orderId } = req.params;
    const targetId = id || orderId;
    const orderOr = [{ id: targetId }, { orderId: targetId }];
    if (mongoose.Types.ObjectId.isValid(targetId)) {
      orderOr.push({ _id: targetId });
    }
    const baseQuery = { $or: orderOr };
    if (req.user?.role === "VENDOR") {
      const vendorId = req.user.vendorId || req.user.id || "";
      if (vendorId) baseQuery.vendorId = vendorId;
    }
    await FarmerHarvestOrder.deleteMany(baseQuery);
    await FarmerOrder.deleteMany(baseQuery).catch(() => {});
    await FarmerEarning.deleteMany({ $or: [{ orderId: targetId }, { id: targetId }] }).catch(() => {});
    await Pickup.deleteMany({ $or: [{ orderId: targetId }, { id: targetId }] }).catch(() => {});
    res.json({ success: true, message: "Harvest order deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete harvest order" });
  }
}


export async function getVendorCustomerSupport(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    const vendor = await Vendor.findOne({ id: vendorId }).lean();
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    let globalConfig = null;
    try {
      const GlobalSupportConfig = mongoose.models.GlobalSupportConfig || mongoose.model("GlobalSupportConfig");
      globalConfig = await GlobalSupportConfig.findOne({ key: "default" }).lean();
    } catch {
      // ignore
    }

    const fallbackGlobal = {
      phone: "+91 74002 22233",
      whatsapp: "+91 74002 22233",
      whatsappMessage: "Hi, I need support with my GreenGrocc order.",
      email: "greengrocc@gmail.com",
      hours: "Mon – Sat · 10 AM – 10 PM",
    };

    const global = { ...fallbackGlobal, ...(globalConfig || {}) };
    const currentSupport = vendor.support || {};

    res.json({
      success: true,
      support: {
        phone: currentSupport.phone || "",
        whatsapp: currentSupport.whatsapp || "",
        whatsappMessage: currentSupport.whatsappMessage || "Hi, I need support with my GreenGrocc order.",
        email: currentSupport.email || "",
        hours: currentSupport.hours || "Mon – Sat · 9 AM – 9 PM",
        isActive: currentSupport.isActive !== false,
      },
      globalDefaults: global,
      vendor: {
        id: vendor.id,
        vendorName: vendor.vendorName || vendor.ownerName,
        mobile: vendor.mobile,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to load support settings" });
  }
}

export async function updateVendorCustomerSupport(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    const vendor = await Vendor.findOne({ id: vendorId });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const { phone, whatsapp, whatsappMessage, email, hours, isActive } = req.body || {};

    vendor.support = {
      phone: String(phone ?? vendor.support?.phone ?? "").trim(),
      whatsapp: String(whatsapp ?? vendor.support?.whatsapp ?? "").trim(),
      whatsappMessage: String(
        whatsappMessage ?? vendor.support?.whatsappMessage ?? "Hi, I need support with my GreenGrocc order."
      ).trim(),
      email: String(email ?? vendor.support?.email ?? "").trim(),
      hours: String(hours ?? vendor.support?.hours ?? "Mon – Sat · 9 AM – 9 PM").trim(),
      isActive: isActive !== undefined ? Boolean(isActive) : vendor.support?.isActive !== false,
    };

    vendor.markModified("support");
    await vendor.save();

    res.json({
      success: true,
      message: "Customer support channels updated successfully",
      support: vendor.support,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to update support settings" });
  }
}
