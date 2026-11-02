import mongoose from "mongoose";
import Order from "../../legacy/models/order/Order.js";
import Product from "../../legacy/models/Product.js";
import DeliveryBoy from "../../delivery-service/src/models/DeliveryBoy.js";
import StoreInventory from "../../delivery-service/src/models/StoreInventory.js";
import StoreOrder from "../../delivery-service/src/models/StoreOrder.js";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import ReturnPickup from "../../delivery-service/src/models/ReturnPickup.js";
import User from "../../legacy/models/user.js";
import { FinanceLedger, RefundClaim } from "./models.js";
import {
  createReturnPickupFromClaim,
  resolveDarkStoreForOrder,
} from "../../delivery-service/src/controllers/returnPickupController.js";

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

function normalizeAccountType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "bulk" || raw === "b2b" || raw === "wholesale") return "bulk";
  return "retail";
}

function normalizeClaimStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "approved") return "accepted";
  if (raw === "processed") return "successful";
  if (["pending", "accepted", "rejected", "successful"].includes(raw)) return raw;
  return "";
}

/** Set by vendor routes: the dark store ids the caller may see. Undefined means no restriction (admin). */
function inRefundScope(req, storeId) {
  if (!Array.isArray(req.refundStoreIds)) return true;
  return Boolean(storeId) && req.refundStoreIds.includes(String(storeId));
}

function serializeClaim(claim, extras = {}) {
  const row = claim?.toObject ? claim.toObject() : claim;
  const status = normalizeClaimStatus(row.status) || row.status || "pending";
  return {
    id: String(row._id),
    _id: String(row._id),
    orderId: row.orderId ? String(row.orderId) : null,
    orderNumber: row.orderNumber || "",
    userId: row.userId ? String(row.userId) : null,
    accountType: row.accountType === "bulk" ? "bulk" : "retail",
    type: row.type || "refund",
    reason: row.reason || "",
    productImage: row.productImage || "",
    amount: Number(row.amount || 0),
    status,
    customerName: row.customerName || "",
    customerPhone: row.customerPhone || "",
    customerAddress: row.customerAddress || "",
    adminNote: row.adminNote || "",
    darkStoreId: row.darkStoreId ? String(row.darkStoreId) : null,
    managerId: row.managerId ? String(row.managerId) : null,
    returnPickupId: row.returnPickupId ? String(row.returnPickupId) : null,
    acceptedAt: row.acceptedAt,
    rejectedAt: row.rejectedAt,
    successfulAt: row.successfulAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extras,
  };
}

export async function listFinance(req, res, next) {
  try {
    const filter = {};
    if (req.query.type && req.query.type !== "all") filter.type = req.query.type;
    const entries = await FinanceLedger.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    const [ledgerTotals, orderTotals] = await Promise.all([
      FinanceLedger.aggregate([
        { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { status: { $nin: ["attempted", "cancelled"] } } },
        {
          $group: {
            _id: null,
            sales: { $sum: "$total" },
            orders: { $sum: 1 },
            refundable: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "refundable"] }, "$total", 0] },
            },
          },
        },
      ]),
    ]);
    const byType = Object.fromEntries(ledgerTotals.map((row) => [row._id, row.total]));
    return ok(res, entries, {
      stats: {
        sales: orderTotals[0]?.sales || 0,
        orders: orderTotals[0]?.orders || 0,
        income: byType.income || 0,
        expense: byType.expense || 0,
        payout: byType.payout || 0,
        settlement: byType.settlement || 0,
        refundable: orderTotals[0]?.refundable || 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createFinanceEntry(req, res, next) {
  try {
    const amount = Number(req.body.amount);
    const title = String(req.body.title || "").trim();
    const type = String(req.body.type || "income");
    if (!title) return fail(res, 400, "Title is required");
    if (!Number.isFinite(amount) || amount < 0) return fail(res, 400, "Amount is required");
    if (!["income", "expense", "payout", "settlement"].includes(type)) {
      return fail(res, 400, "Invalid finance type");
    }
    const entry = await FinanceLedger.create({
      type,
      title,
      amount,
      storeName: String(req.body.storeName || "").trim(),
      vendorName: String(req.body.vendorName || "").trim(),
      reference: String(req.body.reference || "").trim(),
      notes: String(req.body.notes || "").trim(),
      date: req.body.date ? new Date(req.body.date) : new Date(),
    });
    return res.status(201).json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
}

export async function updateFinanceEntry(req, res, next) {
  try {
    const entry = await FinanceLedger.findById(req.params.id);
    if (!entry) return fail(res, 404, "Finance entry not found");
    ["type", "title", "amount", "storeName", "vendorName", "reference", "notes", "date"].forEach(
      (key) => {
        if (req.body[key] !== undefined) entry[key] = req.body[key];
      }
    );
    await entry.save();
    return ok(res, entry);
  } catch (error) {
    next(error);
  }
}

export async function deleteFinanceEntry(req, res, next) {
  try {
    const entry = await FinanceLedger.findByIdAndDelete(req.params.id);
    if (!entry) return fail(res, 404, "Finance entry not found");
    return ok(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
}

export async function listRefunds(req, res, next) {
  try {
    const filter = {};
    if (req.query.accountType || req.query.userType) {
      filter.accountType = normalizeAccountType(req.query.accountType || req.query.userType);
    }
    const status = normalizeClaimStatus(req.query.status);
    if (status) {
      filter.status =
        status === "accepted"
          ? { $in: ["accepted", "approved"] }
          : status === "successful"
            ? { $in: ["successful", "processed"] }
            : status;
    }
    if (req.query.type && req.query.type !== "all") filter.type = req.query.type;

    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        const end = new Date(req.query.dateTo);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const search = String(req.query.search || req.query.q || "").trim();
    if (search) {
      filter.$or = [
        { orderNumber: new RegExp(search, "i") },
        { customerName: new RegExp(search, "i") },
        { customerPhone: new RegExp(search, "i") },
        { reason: new RegExp(search, "i") },
      ];
    }

    if (Array.isArray(req.refundStoreIds)) {
      filter.$and = [
        { $or: [{ darkStoreId: { $in: req.refundStoreIds } }, { managerId: { $in: req.refundStoreIds } }] },
      ];
    }

    const claims = await RefundClaim.find(filter).sort({ createdAt: -1 }).lean();
    const pickupIds = claims.map((c) => c.returnPickupId).filter(Boolean);
    const pickups = pickupIds.length
      ? await ReturnPickup.find({ _id: { $in: pickupIds } }).select("status").lean()
      : [];
    const pickupMap = Object.fromEntries(pickups.map((p) => [String(p._id), p]));

    const storeIds = [
      ...new Set(claims.map((c) => c.darkStoreId || c.managerId).filter(Boolean).map(String)),
    ];
    const stores = storeIds.length
      ? await DeliveryManager.find({ _id: { $in: storeIds } })
          .select("storeName name city area")
          .lean()
      : [];
    const storeMap = Object.fromEntries(stores.map((s) => [String(s._id), s]));

    const data = claims.map((claim) => {
      const pickup = claim.returnPickupId ? pickupMap[String(claim.returnPickupId)] : null;
      const store = storeMap[String(claim.darkStoreId || claim.managerId || "")];
      return serializeClaim(claim, {
        returnStatus: pickup?.status || null,
        storeName: store?.storeName || store?.name || "",
        storeArea: store?.area || "",
        storeCity: store?.city || "",
      });
    });

    return ok(res, data, {
      count: data.length,
      stats: {
        total: data.length,
        pending: data.filter((c) => c.status === "pending").length,
        accepted: data.filter((c) => c.status === "accepted").length,
        rejected: data.filter((c) => c.status === "rejected").length,
        successful: data.filter((c) => c.status === "successful").length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createRefund(req, res, next) {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) return fail(res, 400, "Reason is required");

    let order = null;
    if (req.body.orderId) order = await Order.findById(req.body.orderId);
    if (!order && req.body.orderNumber) {
      order = await Order.findOne({ orderNumber: String(req.body.orderNumber).trim() });
    }

    let user = null;
    if (order?.user) user = await User.findById(order.user).select("name phone accountType").lean();
    if (!user && req.body.customerPhone) {
      const phone = String(req.body.customerPhone).replace(/\D/g, "").slice(-10);
      if (phone) user = await User.findOne({ phone }).select("name phone accountType").lean();
    }

    const accountType = normalizeAccountType(req.body.accountType || user?.accountType || "retail");

    let darkStoreId = req.body.darkStoreId || null;
    let managerId = req.body.managerId || darkStoreId || null;
    let customerAddress = String(req.body.customerAddress || "").trim();

    if (order?._id) {
      const resolved = await resolveDarkStoreForOrder(order._id);
      if (resolved) {
        darkStoreId = darkStoreId || resolved.darkStoreId;
        managerId = managerId || resolved.managerId;
        customerAddress = customerAddress || resolved.customerAddress || "";
      }
    }

    if (!inRefundScope(req, darkStoreId || managerId)) {
      return fail(res, 403, "This order was not delivered from one of your dark stores");
    }

    const claim = await RefundClaim.create({
      orderId: order?._id || null,
      orderNumber: order?.orderNumber || String(req.body.orderNumber || "").trim(),
      userId: user?._id || order?.user || null,
      accountType,
      type: req.body.type === "warranty" ? "warranty" : "refund",
      reason,
      amount: Number(req.body.amount || order?.total || 0),
      customerName: String(
        req.body.customerName || user?.name || order?.deliveryAddress?.fullName || ""
      ).trim(),
      customerPhone: String(
        req.body.customerPhone || user?.phone || order?.deliveryAddress?.number || ""
      ).trim(),
      customerAddress:
        customerAddress ||
        String(order?.deliveryAddress?.addressLine || order?.deliveryAddress?.fullAddress || "").trim(),
      adminNote: String(req.body.adminNote || "").trim(),
      status: "pending",
      darkStoreId: darkStoreId || null,
      managerId: managerId || null,
    });

    return res.status(201).json({ success: true, data: serializeClaim(claim) });
  } catch (error) {
    next(error);
  }
}

export async function updateRefund(req, res, next) {
  try {
    const claim = await RefundClaim.findById(req.params.id);
    if (!claim || !inRefundScope(req, claim.darkStoreId || claim.managerId)) return fail(res, 404, "Claim not found");
    if (req.body.darkStoreId && !inRefundScope(req, req.body.darkStoreId)) {
      return fail(res, 403, "You can only assign one of your own dark stores");
    }

    const nextStatus = normalizeClaimStatus(req.body.status);
    if (req.body.adminNote !== undefined) claim.adminNote = String(req.body.adminNote);
    if (req.body.amount !== undefined) claim.amount = Number(req.body.amount);
    if (req.body.darkStoreId) {
      claim.darkStoreId = req.body.darkStoreId;
      claim.managerId = req.body.darkStoreId;
    }

    if (nextStatus && nextStatus !== normalizeClaimStatus(claim.status)) {
      if (nextStatus === "accepted") {
        try {
          const pickup = await createReturnPickupFromClaim(claim, {
            managerId: claim.managerId,
            darkStoreId: claim.darkStoreId,
          });
          claim.returnPickupId = pickup._id;
          claim.managerId = pickup.managerId;
          claim.darkStoreId = pickup.darkStoreId;
          claim.status = "accepted";
          claim.acceptedAt = new Date();
        } catch (err) {
          return fail(res, 400, err.message || "Could not create return pickup for dark store");
        }
      } else if (nextStatus === "rejected") {
        claim.status = "rejected";
        claim.rejectedAt = new Date();
        if (claim.returnPickupId) {
          await ReturnPickup.findByIdAndUpdate(claim.returnPickupId, { status: "cancelled" });
        }
      } else if (nextStatus === "pending") {
        claim.status = "pending";
      } else if (nextStatus === "successful") {
        claim.status = "successful";
        claim.successfulAt = new Date();
        if (claim.returnPickupId) {
          await ReturnPickup.findByIdAndUpdate(claim.returnPickupId, {
            status: "successful",
            successfulAt: new Date(),
          });
        }
        if (claim.orderId && claim.type === "refund") {
          await Order.findByIdAndUpdate(claim.orderId, {
            status: "return",
            paymentStatus: "refundable",
          });
        }
      }
    }

    await claim.save();
    return ok(res, serializeClaim(claim));
  } catch (error) {
    next(error);
  }
}

export async function getReports(req, res, next) {
    if (req.query.zone || req.query.range || req.query.groupBy || req.query.detailed || req.query.type === "sales") {
      return getDetailedSalesReport(req, res, next);
    }
  try {
    const [orderAgg, recentOrders, productCount, riderCount, storeOrders, topProducts] =
      await Promise.all([
        Order.aggregate([
          {
            $match: {
              status: { $nin: ["attempted", "deleted", "DELETED"] },
              isDeleted: { $ne: true },
              deleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              sales: { $sum: { $cond: [{ $in: ["$status", ["cancelled", "return"]] }, 0, "$total"] } },
            },
          },
        ]),
        Order.find({
          status: { $nin: ["attempted", "deleted", "DELETED"] },
          isDeleted: { $ne: true },
          deleted: { $ne: true },
        })
          .sort({ createdAt: -1 })
          .limit(8)
          .select("orderNumber total status paymentStatus createdAt")
          .lean(),
        Product.countDocuments({
          isActive: true,
          isDeleted: { $ne: true },
          deleted: { $ne: true },
          status: { $nin: ["deleted", "DELETED"] },
        }),
        DeliveryBoy.countDocuments({
          isDeleted: { $ne: true },
          deleted: { $ne: true },
          status: { $nin: ["deleted", "DELETED"] },
        }),
        StoreOrder.aggregate([
          {
            $match: {
              isDeleted: { $ne: true },
              deleted: { $ne: true },
            },
          },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          {
            $match: {
              status: { $nin: ["attempted", "cancelled", "deleted", "DELETED"] },
              isDeleted: { $ne: true },
              deleted: { $ne: true },
            },
          },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.name",
              units: { $sum: "$items.quantity" },
              sales: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            },
          },
          { $sort: { sales: -1 } },
          { $limit: 6 },
        ]),
      ]);

    const byStatus = Object.fromEntries(orderAgg.map((row) => [row._id, row]));
    const sales = orderAgg.reduce((sum, row) => sum + (row.sales || 0), 0);
    const orders = orderAgg.reduce((sum, row) => sum + (row.count || 0), 0);

    return ok(res, {
      kpis: {
        sales,
        orders,
        products: productCount,
        riders: riderCount,
        delivered: byStatus.delivered?.count || 0,
        cancelled: byStatus.cancelled?.count || 0,
      },
      ordersByStatus: orderAgg,
      deliveryByStatus: storeOrders,
      topProducts,
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
}


// ── Detailed Sales & Zone/Dark Store Analytics Report ───────────────────────
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function computeSalesDateRange(range, customStart, customEnd) {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const curIso = istNow.toISOString().slice(0, 10);
  const [curYear, curMonth] = curIso.split("-").map(Number);

  let from, to;
  const cleanRange = String(range || "30d").toLowerCase();

  if (cleanRange === "custom" && customStart) {
    from = new Date(`${customStart}T00:00:00.000+05:30`);
    to = customEnd ? new Date(`${customEnd}T23:59:59.999+05:30`) : new Date(`${customStart}T23:59:59.999+05:30`);
  } else if (cleanRange === "today") {
    from = new Date(`${curIso}T00:00:00.000+05:30`);
    to = new Date(`${curIso}T23:59:59.999+05:30`);
  } else if (cleanRange === "yesterday") {
    const yestDate = new Date(now.getTime() - DAY_MS + IST_OFFSET_MS).toISOString().slice(0, 10);
    from = new Date(`${yestDate}T00:00:00.000+05:30`);
    to = new Date(`${yestDate}T23:59:59.999+05:30`);
  } else if (cleanRange === "7d") {
    from = new Date(now.getTime() - 7 * DAY_MS);
    to = new Date(`${curIso}T23:59:59.999+05:30`);
  } else if (cleanRange === "this_month") {
    const mStr = String(curMonth).padStart(2, "0");
    from = new Date(`${curYear}-${mStr}-01T00:00:00.000+05:30`);
    to = new Date(`${curIso}T23:59:59.999+05:30`);
  } else if (cleanRange === "last_month") {
    const prevMYear = curMonth === 1 ? curYear - 1 : curYear;
    const prevM = curMonth === 1 ? 12 : curMonth - 1;
    const mStr = String(prevM).padStart(2, "0");
    const lastDay = new Date(prevMYear, prevM, 0).getDate();
    from = new Date(`${prevMYear}-${mStr}-01T00:00:00.000+05:30`);
    to = new Date(`${prevMYear}-${mStr}-${String(lastDay).padStart(2, "0")}T23:59:59.999+05:30`);
  } else if (cleanRange === "3m") {
    from = new Date(now.getTime() - 90 * DAY_MS);
    to = new Date(`${curIso}T23:59:59.999+05:30`);
  } else if (cleanRange === "6m") {
    from = new Date(now.getTime() - 180 * DAY_MS);
    to = new Date(`${curIso}T23:59:59.999+05:30`);
  } else if (cleanRange === "1y") {
    from = new Date(now.getTime() - 365 * DAY_MS);
    to = new Date(`${curIso}T23:59:59.999+05:30`);
  } else {
    from = new Date(now.getTime() - 30 * DAY_MS);
    to = new Date(`${curIso}T23:59:59.999+05:30`);
  }

  if (isNaN(from.getTime())) from = new Date(now.getTime() - 30 * DAY_MS);
  if (isNaN(to.getTime())) to = new Date(`${curIso}T23:59:59.999+05:30`);
  if (from > to) from = new Date(to.getTime() - 30 * DAY_MS);

  return { from, to, istToday: curIso };
}

function initTimeline(from, to, groupBy = "day") {
  const buckets = [];
  const map = new Map();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const start = new Date(from);
  const end = new Date(to);

  if (groupBy === "month") {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, "0");
      const key = `${year}-${month}`;
      const label = `${monthNames[cur.getMonth()]} ${year}`;
      const item = { key, label, sales: 0, orders: 0, delivered: 0, cancelled: 0 };
      map.set(key, item);
      buckets.push(item);
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (groupBy === "week") {
    let cur = new Date(start);
    while (cur <= end) {
      const istCur = new Date(cur.getTime() + IST_OFFSET_MS);
      const isoStr = istCur.toISOString().slice(0, 10);
      const label = `${istCur.getUTCDate()} ${monthNames[istCur.getUTCMonth()]}`;
      const key = isoStr;
      const item = { key, label, sales: 0, orders: 0, delivered: 0, cancelled: 0 };
      map.set(key, item);
      buckets.push(item);
      cur = new Date(cur.getTime() + 7 * DAY_MS);
    }
  } else if (groupBy === "year") {
    let y = start.getFullYear();
    const endY = end.getFullYear();
    while (y <= endY) {
      const key = String(y);
      const item = { key, label: String(y), sales: 0, orders: 0, delivered: 0, cancelled: 0 };
      map.set(key, item);
      buckets.push(item);
      y++;
    }
  } else {
    // Default day
    let cur = new Date(start);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
    const step = totalDays > 90 ? Math.ceil(totalDays / 90) : 1;

    while (cur <= end) {
      const istCur = new Date(cur.getTime() + IST_OFFSET_MS);
      const isoStr = istCur.toISOString().slice(0, 10);
      const label = `${istCur.getUTCDate()} ${monthNames[istCur.getUTCMonth()]}`;
      const key = isoStr;
      const item = { key, label, sales: 0, orders: 0, delivered: 0, cancelled: 0 };
      map.set(key, item);
      buckets.push(item);
      cur = new Date(cur.getTime() + step * DAY_MS);
    }
  }

  return { buckets, map };
}

export async function getDetailedSalesReport(req, res, next) {
  try {
    const {
      zone = "all",
      darkStoreId = "all",
      groupBy = "day",
      range = "30d",
      startDate,
      endDate,
      status = "all",
      paymentMethod = "all",
    } = req.query;

    const { from, to, istToday } = computeSalesDateRange(range, startDate, endDate);

    // 1. Fetch dark stores (DeliveryManagers) & distinct cities from orders
    const [deliveryManagers, orderCities] = await Promise.all([
      DeliveryManager.find({
        isDeleted: { $ne: true },
        deleted: { $ne: true },
        status: { $nin: ["deleted", "DELETED"] },
      })
        .select("_id name storeName city cityId area pincode state")
        .lean(),
      Order.distinct("deliveryAddress.city", {
        isDeleted: { $ne: true },
        deleted: { $ne: true },
        status: { $nin: ["deleted", "DELETED"] },
      }),
    ]);

    const zoneSet = new Set();
    const allStores = [];
    const storesByZone = {};
    const storeMap = new Map();

    for (const dm of deliveryManagers) {
      const sId = String(dm._id);
      const zName = (dm.city || "Other Zone").trim();
      const sObj = {
        id: sId,
        _id: sId,
        name: dm.storeName || dm.name || `Store #${sId.slice(-6)}`,
        storeName: dm.storeName || dm.name || `Store #${sId.slice(-6)}`,
        zone: zName,
        area: dm.area || "",
        pincode: dm.pincode || "",
        state: dm.state || "",
      };
      storeMap.set(sId, sObj);
      allStores.push(sObj);
      zoneSet.add(zName);
      if (!storesByZone[zName]) storesByZone[zName] = [];
      storesByZone[zName].push(sObj);
    }

    for (const c of orderCities) {
      const cz = String(c || "").trim();
      if (cz) {
        zoneSet.add(cz);
        if (!storesByZone[cz]) storesByZone[cz] = [];
      }
    }

    const sortedZones = Array.from(zoneSet).sort((a, b) => a.localeCompare(b));
    const isSpecificStore = Boolean(darkStoreId && darkStoreId !== "all");
    const isSpecificZone = Boolean(zone && zone !== "all" && zone !== "All Zones");

    // 2. Query StoreOrders
    const storeOrderMatch = {
      createdAt: { $gte: from, $lte: to },
      isDeleted: { $ne: true },
      deleted: { $ne: true },
      status: { $nin: ["deleted", "DELETED"] },
    };

    if (isSpecificStore) {
      const sObjId = mongoose.isValidObjectId(darkStoreId) ? new mongoose.Types.ObjectId(darkStoreId) : darkStoreId;
      storeOrderMatch.$or = [{ managerId: sObjId }, { darkStoreId: sObjId }];
    } else if (isSpecificZone) {
      const zoneStoreIds = (storesByZone[zone] || []).map((s) =>
        mongoose.isValidObjectId(s.id) ? new mongoose.Types.ObjectId(s.id) : s.id
      );
      storeOrderMatch.$or = [
        { city: { $regex: new RegExp(`^${zone.trim()}$`, "i") } },
        ...(zoneStoreIds.length ? [{ managerId: { $in: zoneStoreIds } }, { darkStoreId: { $in: zoneStoreIds } }] : []),
      ];
    }

    if (status && status !== "all") {
      if (status === "delivered") storeOrderMatch.status = "delivered";
      else if (status === "cancelled") storeOrderMatch.status = { $in: ["cancelled", "delivery_failed", "returned"] };
      else if (status === "processing") storeOrderMatch.status = { $in: ["order_received", "packed", "assigned", "out_for_delivery"] };
      else storeOrderMatch.$and = [{ status }, { status: { $nin: ["deleted", "DELETED"] } }];
    }

    if (paymentMethod && paymentMethod !== "all") {
      if (paymentMethod.toLowerCase() === "cod") storeOrderMatch.paymentMethod = { $regex: /^cod$/i };
      else if (paymentMethod.toLowerCase() === "online") storeOrderMatch.paymentMethod = { $regex: /^(online|upi|card|netbanking)$/i };
      else storeOrderMatch.paymentMethod = { $regex: new RegExp(`^${paymentMethod}$`, "i") };
    }

    const candidateStoreOrders = await StoreOrder.find(storeOrderMatch)
      .select("orderNumber darkStoreId managerId city area status paymentMethod partTotal amountCollected amountToCollect items createdAt sourceOrderId")
      .lean();

    // Deleted customer orders can leave store-order parts behind. Only count
    // linked parts while their source order still exists and is not deleted.
    const sourceOrderIds = candidateStoreOrders.map((so) => so.sourceOrderId).filter(Boolean);
    const activeSourceOrders = sourceOrderIds.length
      ? await Order.find({
          _id: { $in: sourceOrderIds },
          isDeleted: { $ne: true },
          deleted: { $ne: true },
          status: { $nin: ["attempted", "deleted", "DELETED"] },
        }).select("_id").lean()
      : [];
    const activeSourceIds = new Set(activeSourceOrders.map((order) => String(order._id)));
    const storeOrders = candidateStoreOrders.filter(
      (so) => !so.sourceOrderId || activeSourceIds.has(String(so.sourceOrderId))
    );

    // 3. Query Customer Orders
    const orderMatch = {
      createdAt: { $gte: from, $lte: to },
      status: { $nin: ["attempted", "deleted", "DELETED"] },
      isDeleted: { $ne: true },
      deleted: { $ne: true },
    };

    if (isSpecificStore) {
      const linkedOrderIds = storeOrders.map((so) => so.sourceOrderId).filter(Boolean);
      orderMatch._id = { $in: linkedOrderIds };
    } else if (isSpecificZone) {
      orderMatch["deliveryAddress.city"] = { $regex: new RegExp(`^${zone.trim()}$`, "i") };
    }

    if (status && status !== "all") {
      if (status === "delivered") orderMatch.status = "delivered";
      else if (status === "cancelled") orderMatch.status = { $in: ["cancelled", "return"] };
      else if (status === "processing") orderMatch.status = { $in: ["confirm", "processing", "shipping"] };
      else orderMatch.$and = [{ status }, { status: { $nin: ["attempted", "deleted", "DELETED"] } }];
    }

    if (paymentMethod && paymentMethod !== "all") {
      if (paymentMethod.toLowerCase() === "cod") orderMatch.paymentMethod = "cod";
      else if (paymentMethod.toLowerCase() === "online") orderMatch.paymentMethod = "online";
    }

    const customerOrders = await Order.find(orderMatch)
      .select("orderNumber total status paymentMethod deliveryAddress items createdAt")
      .lean();

    // 4. Initialize Data Containers
    const { buckets: timelineList, map: timelineMap } = initTimeline(from, to, groupBy);

    // Zone maps
    const zoneMetricsMap = new Map();
    for (const z of sortedZones) {
      zoneMetricsMap.set(z, {
        zone: z,
        storesCount: (storesByZone[z] || []).length,
        orders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalSales: 0,
        aov: 0,
        deliveryRate: 0,
        sharePct: 0,
      });
    }

    // Store maps
    const storeMetricsMap = new Map();
    for (const s of allStores) {
      if (!isSpecificZone || s.zone.toLowerCase() === zone.toLowerCase()) {
        storeMetricsMap.set(s.id, {
          storeId: s.id,
          storeName: s.name,
          zone: s.zone,
          area: s.area,
          pincode: s.pincode,
          orders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          totalSales: 0,
          aov: 0,
          deliveryRate: 0,
          sharePct: 0,
        });
      }
    }

    const paymentMap = {
      "Online / UPI": { method: "Online / UPI", orders: 0, sales: 0, sharePct: 0 },
      "Cash on Delivery (COD)": { method: "Cash on Delivery (COD)", orders: 0, sales: 0, sharePct: 0 },
      "Wallet / Other": { method: "Wallet / Other", orders: 0, sales: 0, sharePct: 0 },
    };

    const statusCounter = {
      delivered: 0,
      processing: 0,
      confirmed: 0,
      cancelled: 0,
      other: 0,
    };

    const productsMap = new Map();
    const recentOrdersList = [];
    const linkedSourceIds = new Set(storeOrders.map((so) => String(so.sourceOrderId || "")).filter(Boolean));

    let grandTotalSales = 0;
    let grandTotalOrders = 0;
    let grandDeliveredOrders = 0;
    let grandCancelledOrders = 0;
    let grandUnitsSold = 0;

    function getTimelineKey(dateObj) {
      const istD = new Date(new Date(dateObj).getTime() + IST_OFFSET_MS);
      if (groupBy === "month") return istD.toISOString().slice(0, 7);
      if (groupBy === "year") return String(istD.getUTCFullYear());
      return istD.toISOString().slice(0, 10);
    }

    function getStoreOrderAmount(so) {
      if (typeof so.partTotal === "number" && so.partTotal > 0) return so.partTotal;
      if (typeof so.amountCollected === "number" && so.amountCollected > 0) return so.amountCollected;
      if (Array.isArray(so.items) && so.items.length > 0) {
        const sum = so.items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
        if (sum > 0) return sum;
      }
      return 0;
    }

    function categorizePayment(pm) {
      const p = String(pm || "").trim().toLowerCase();
      if (p === "cod" || p.includes("cash")) return "Cash on Delivery (COD)";
      if (p.includes("wallet")) return "Wallet / Other";
      return "Online / UPI";
    }

    function categorizeStatus(st) {
      const s = String(st || "").trim().toLowerCase();
      if (s === "delivered") return "delivered";
      if (["cancelled", "delivery_failed", "return", "refunded"].includes(s)) return "cancelled";
      if (["packed", "assigned", "out_for_delivery", "shipping", "processing"].includes(s)) return "processing";
      if (["confirm", "order_received", "incoming"].includes(s)) return "confirmed";
      return "other";
    }

    // 5. Process StoreOrders
    for (const so of storeOrders) {
      const amount = getStoreOrderAmount(so);
      const sId = String(so.darkStoreId || so.managerId || "");
      const storeObj = storeMap.get(sId);
      const zName = (so.city || storeObj?.zone || "Other Zone").trim();
      const stCat = categorizeStatus(so.status);
      const isDeliv = stCat === "delivered";
      const isCanc = stCat === "cancelled";
      const salesVal = isCanc ? 0 : amount;

      grandTotalOrders += 1;
      if (isDeliv) grandDeliveredOrders += 1;
      if (isCanc) grandCancelledOrders += 1;
      grandTotalSales += salesVal;

      statusCounter[stCat] = (statusCounter[stCat] || 0) + 1;

      const pCat = categorizePayment(so.paymentMethod);
      paymentMap[pCat].orders += 1;
      paymentMap[pCat].sales += salesVal;

      if (!zoneMetricsMap.has(zName)) {
        zoneMetricsMap.set(zName, {
          zone: zName,
          storesCount: (storesByZone[zName] || []).length,
          orders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          totalSales: 0,
          aov: 0,
          deliveryRate: 0,
          sharePct: 0,
        });
      }
      const zm = zoneMetricsMap.get(zName);
      zm.orders += 1;
      if (isDeliv) zm.deliveredOrders += 1;
      if (isCanc) zm.cancelledOrders += 1;
      zm.totalSales += salesVal;

      if (sId && storeMetricsMap.has(sId)) {
        const sm = storeMetricsMap.get(sId);
        sm.orders += 1;
        if (isDeliv) sm.deliveredOrders += 1;
        if (isCanc) sm.cancelledOrders += 1;
        sm.totalSales += salesVal;
      }

      const tKey = getTimelineKey(so.createdAt);
      if (timelineMap.has(tKey)) {
        const tb = timelineMap.get(tKey);
        tb.orders += 1;
        tb.sales += salesVal;
        if (isDeliv) tb.delivered += 1;
        if (isCanc) tb.cancelled += 1;
      }

      if (Array.isArray(so.items)) {
        for (const item of so.items) {
          const pName = String(item.name || item.sku || "Item").trim();
          const pQty = Number(item.quantity || 1);
          const pPrice = Number(item.price || 0);
          grandUnitsSold += pQty;
          if (!productsMap.has(pName)) {
            productsMap.set(pName, { name: pName, units: 0, sales: 0 });
          }
          const pEntry = productsMap.get(pName);
          pEntry.units += pQty;
          pEntry.sales += isCanc ? 0 : pPrice * pQty;
        }
      }

      if (recentOrdersList.length < 50) {
        recentOrdersList.push({
          id: String(so._id),
          _id: String(so._id),
          orderNumber: so.orderNumber || String(so._id).slice(-6),
          zone: zName,
          storeName: storeObj?.name || (sId ? `Store #${sId.slice(-6)}` : "—"),
          area: so.area || storeObj?.area || "—",
          total: amount,
          status: so.status || "order_received",
          statusCategory: stCat,
          paymentMethod: so.paymentMethod || "online",
          itemsCount: (so.items || []).length,
          createdAt: so.createdAt,
        });
      }
    }

    // 6. Process Customer Orders not in StoreOrders
    for (const co of customerOrders) {
      if (linkedSourceIds.has(String(co._id))) continue;

      const amount = Number(co.total || 0);
      const zName = (co.deliveryAddress?.city || "Other Zone").trim();
      const stCat = categorizeStatus(co.status);
      const isDeliv = stCat === "delivered";
      const isCanc = stCat === "cancelled";
      const salesVal = isCanc ? 0 : amount;

      grandTotalOrders += 1;
      if (isDeliv) grandDeliveredOrders += 1;
      if (isCanc) grandCancelledOrders += 1;
      grandTotalSales += salesVal;

      statusCounter[stCat] = (statusCounter[stCat] || 0) + 1;

      const pCat = categorizePayment(co.paymentMethod);
      paymentMap[pCat].orders += 1;
      paymentMap[pCat].sales += salesVal;

      if (!zoneMetricsMap.has(zName)) {
        zoneMetricsMap.set(zName, {
          zone: zName,
          storesCount: (storesByZone[zName] || []).length,
          orders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          totalSales: 0,
          aov: 0,
          deliveryRate: 0,
          sharePct: 0,
        });
      }
      const zm = zoneMetricsMap.get(zName);
      zm.orders += 1;
      if (isDeliv) zm.deliveredOrders += 1;
      if (isCanc) zm.cancelledOrders += 1;
      zm.totalSales += salesVal;

      const tKey = getTimelineKey(co.createdAt);
      if (timelineMap.has(tKey)) {
        const tb = timelineMap.get(tKey);
        tb.orders += 1;
        tb.sales += salesVal;
        if (isDeliv) tb.delivered += 1;
        if (isCanc) tb.cancelled += 1;
      }

      if (Array.isArray(co.items)) {
        for (const item of co.items) {
          const pName = String(item.name || "Product").trim();
          const pQty = Number(item.quantity || 1);
          const pPrice = Number(item.price || 0);
          grandUnitsSold += pQty;
          if (!productsMap.has(pName)) {
            productsMap.set(pName, { name: pName, units: 0, sales: 0 });
          }
          const pEntry = productsMap.get(pName);
          pEntry.units += pQty;
          pEntry.sales += isCanc ? 0 : pPrice * pQty;
        }
      }

      if (recentOrdersList.length < 50) {
        recentOrdersList.push({
          id: String(co._id),
          _id: String(co._id),
          orderNumber: co.orderNumber || String(co._id).slice(-6),
          zone: zName,
          storeName: "Direct Dispatch",
          area: co.deliveryAddress?.area || "—",
          total: amount,
          status: co.status || "confirm",
          statusCategory: stCat,
          paymentMethod: co.paymentMethod || "online",
          itemsCount: (co.items || []).length,
          createdAt: co.createdAt,
        });
      }
    }

    // 7. Final Calculations & Ratios
    const zonesBreakdown = Array.from(zoneMetricsMap.values())
      .map((z) => {
        const liveOrders = z.orders - z.cancelledOrders;
        z.aov = liveOrders > 0 ? Math.round(z.totalSales / liveOrders) : 0;
        z.deliveryRate = z.orders > 0 ? Math.round((z.deliveredOrders / z.orders) * 1000) / 10 : 0;
        z.sharePct = grandTotalSales > 0 ? Math.round((z.totalSales / grandTotalSales) * 1000) / 10 : 0;
        return z;
      })
      .sort((a, b) => b.totalSales - a.totalSales);

    const storesBreakdown = Array.from(storeMetricsMap.values())
      .map((s) => {
        const liveOrders = s.orders - s.cancelledOrders;
        s.aov = liveOrders > 0 ? Math.round(s.totalSales / liveOrders) : 0;
        s.deliveryRate = s.orders > 0 ? Math.round((s.deliveredOrders / s.orders) * 1000) / 10 : 0;
        s.sharePct = grandTotalSales > 0 ? Math.round((s.totalSales / grandTotalSales) * 1000) / 10 : 0;
        return s;
      })
      .sort((a, b) => b.totalSales - a.totalSales);

    const paymentBreakdown = Object.values(paymentMap).map((p) => {
      p.sharePct = grandTotalSales > 0 ? Math.round((p.sales / grandTotalSales) * 1000) / 10 : 0;
      return p;
    });

    const statusBreakdown = [
      { status: "Delivered", count: statusCounter.delivered, color: "#10B981" },
      { status: "Processing / Transit", count: statusCounter.processing, color: "#3B82F6" },
      { status: "Order Placed", count: statusCounter.confirmed, color: "#F59E0B" },
      { status: "Cancelled / Failed", count: statusCounter.cancelled, color: "#EF4444" },
    ].map((row) => ({
      ...row,
      sharePct: grandTotalOrders > 0 ? Math.round((row.count / grandTotalOrders) * 1000) / 10 : 0,
    }));

    const topProducts = Array.from(productsMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 15);

    const liveGrandOrders = grandTotalOrders - grandCancelledOrders;
    const kpis = {
      totalSales: Math.round(grandTotalSales),
      totalOrders: grandTotalOrders,
      deliveredOrders: grandDeliveredOrders,
      cancelledOrders: grandCancelledOrders,
      deliveryRate: grandTotalOrders > 0 ? Math.round((grandDeliveredOrders / grandTotalOrders) * 1000) / 10 : 0,
      cancellationRate: grandTotalOrders > 0 ? Math.round((grandCancelledOrders / grandTotalOrders) * 1000) / 10 : 0,
      aov: liveGrandOrders > 0 ? Math.round(grandTotalSales / liveGrandOrders) : 0,
      unitsSold: grandUnitsSold,
    };

    // Current inventory snapshot; sales date/status/payment filters do not apply.
    const inventoryStores = allStores.filter((store) =>
      (!isSpecificStore || store.id === darkStoreId) &&
      (!isSpecificZone || store.zone.toLowerCase() === zone.toLowerCase())
    );
    const inventoryRows = await StoreInventory.find({
      managerId: { $in: inventoryStores.map((store) => store.id) },
      isDeleted: { $ne: true },
      deleted: { $ne: true },
      status: { $nin: ["deleted", "DELETED"] },
    }).select("managerId sku name category unit stockCount lowStockThreshold updatedAt").lean();
    const stockByStore = new Map(inventoryStores.map((store) => [store.id, {
      storeId: store.id, storeName: store.name, zone: store.zone,
      trackedProducts: 0, lowStockCount: 0, outOfStockCount: 0, items: [],
    }]));
    for (const item of inventoryRows) {
      const store = stockByStore.get(String(item.managerId));
      if (!store) continue;
      store.trackedProducts += 1;
      const stock = Number(item.stockCount) || 0;
      const threshold = Number(item.lowStockThreshold ?? 10);
      const stockStatus = stock <= 0 ? "out_of_stock" : stock <= threshold ? "low_stock" : null;
      if (!stockStatus) continue;
      if (stockStatus === "out_of_stock") store.outOfStockCount += 1;
      else store.lowStockCount += 1;
      store.items.push({ id: String(item._id), sku: item.sku, name: item.name,
        category: item.category, unit: item.unit, stockCount: stock,
        lowStockThreshold: threshold, status: stockStatus });
    }
    const inventoryReport = {
      asOf: new Date().toISOString(),
      stores: Array.from(stockByStore.values()).map((store) => ({ ...store,
        items: store.items.sort((a, b) => a.stockCount - b.stockCount || a.name.localeCompare(b.name)),
      })),
    };

    recentOrdersList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return ok(res, {
      kpis,
      filters: {
        zone,
        darkStoreId,
        groupBy,
        range,
        startDate: from.toISOString().slice(0, 10),
        endDate: to.toISOString().slice(0, 10),
        status,
        paymentMethod,
      },
      filterOptions: {
        zones: ["All Zones", ...sortedZones],
        stores: allStores,
        storesByZone,
      },
      inventoryReport,
      timeline: timelineList,
      zonesBreakdown,
      storesBreakdown,
      paymentBreakdown,
      statusBreakdown,
      topProducts,
      recentOrders: recentOrdersList,
    });
  } catch (error) {
    next(error);
  }
}
