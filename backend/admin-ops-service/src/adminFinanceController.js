import mongoose from "mongoose";
import {
  buildIstDateFilter,
  calculateVendorAdminCommission,
  calculateAllVendorsCommission,
  getAdminFinanceDashboardData,
  recordVendorCommissionPayment,
} from "./adminCommissionService.js";
import { VendorCommissionPayment } from "./models.js";
import { Vendor } from "../../farmer-manager-service/src/models.js";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import StoreOrder from "../../delivery-service/src/models/StoreOrder.js";

/**
 * 1. GET /api/admin/finance/dashboard
 */
export async function getAdminFinanceDashboard(req, res) {
  try {
    const { preset, startDate, endDate } = req.query;
    const dateFilter = buildIstDateFilter(preset, startDate, endDate);
    const data = await getAdminFinanceDashboardData(dateFilter);
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("[AdminFinance] getAdminFinanceDashboard error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load dashboard data" });
  }
}

/**
 * 2. GET /api/admin/finance/vendors
 * Table of all vendors with commission, sales, filters, search, pagination
 */
export async function listAdminVendorCommissions(req, res) {
  try {
    const {
      preset,
      startDate,
      endDate,
      search = "",
      status = "all", // "all" | "pending" | "partially_paid" | "paid"
      sortBy = "totalAdminCommission",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    const dateFilter = buildIstDateFilter(preset, startDate, endDate);
    const { vendors, totals } = await calculateAllVendorsCommission(dateFilter);

    // Filter
    let filtered = vendors;
    const q = String(search || "").trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (v) =>
          v.vendor.name?.toLowerCase().includes(q) ||
          v.vendor.ownerName?.toLowerCase().includes(q) ||
          v.vendor.id?.toLowerCase().includes(q)
      );
    }

    if (status && status !== "all") {
      const targetStatus = status.toLowerCase();
      filtered = filtered.filter((v) => {
        const s = v.commissionStatus.toLowerCase().replace(/\s+/g, "_");
        return s === targetStatus || v.commissionStatus.toLowerCase() === targetStatus;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let valA = a[sortBy] ?? a.vendor[sortBy] ?? 0;
      let valB = b[sortBy] ?? b.vendor[sortBy] ?? 0;
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    // Paginate
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({
      success: true,
      vendors: paginated,
      totals,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (err) {
    console.error("[AdminFinance] listAdminVendorCommissions error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to list vendor commissions" });
  }
}

/**
 * 3. GET /api/admin/finance/vendors/:vendorId/commission
 * Detailed breakdown for single vendor including order-level audit and dark stores
 */
export async function getAdminVendorCommissionDetail(req, res) {
  try {
    const { vendorId } = req.params;
    const { preset, startDate, endDate, page = 1, limit = 25 } = req.query;

    const dateFilter = buildIstDateFilter(preset, startDate, endDate);
    const calc = await calculateVendorAdminCommission(vendorId, dateFilter);

    if (!calc) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    // Dark store IDs for orders query
    const darkStoreIds = calc.darkStores.map((s) => new mongoose.Types.ObjectId(s._id));
    const storeMap = new Map(calc.darkStores.map((s) => [s._id, s.storeName]));

    const orderQuery = {
      managerId: { $in: darkStoreIds },
      isDeleted: { $ne: true },
    };
    if (dateFilter) {
      orderQuery.createdAt = dateFilter;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 25);

    const [totalOrdersCount, rawOrders] = await Promise.all([
      StoreOrder.countDocuments(orderQuery),
      StoreOrder.find(orderQuery)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    const orders = rawOrders.map((o) => {
      const isCancelled = o.status === "cancelled";
      const productAmount = (o.items || []).reduce(
        (sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)),
        0
      );
      const eligibleSales = isCancelled ? 0 : productAmount;
      const orderCommission = Math.round((eligibleSales * calc.commissionRate) / 100);

      return {
        orderId: o._id,
        orderNumber: o.orderNumber || String(o._id),
        createdAt: o.createdAt,
        storeName: storeMap.get(String(o.managerId)) || "Dark Store",
        status: o.status,
        isEligible: !isCancelled,
        itemsCount: (o.items || []).length,
        itemsSummary: (o.items || []).map((it) => `${it.name} (${it.quantity})`).join(", "),
        totalProductAmount: productAmount,
        eligibleSales,
        commissionRate: calc.commissionRate,
        calculatedCommission: orderCommission,
        customerAmountCollected: o.partTotal || o.amountToCollect || 0,
      };
    });

    return res.json({
      success: true,
      commission: calc,
      orders,
      pagination: {
        total: totalOrdersCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalOrdersCount / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("[AdminFinance] getAdminVendorCommissionDetail error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load vendor commission details" });
  }
}

/**
 * 4. POST /api/admin/finance/commission-payment
 * Record a commission payment against pending balance
 */
export async function recordAdminCommissionPayment(req, res) {
  try {
    const { vendorId, amount, method, reference, paidAt, note } = req.body || {};

    const result = await recordVendorCommissionPayment({
      vendorId,
      amount,
      method,
      reference,
      paidAt,
      note,
    });

    return res.status(201).json({
      success: true,
      message: "Commission payment recorded successfully",
      ...result,
    });
  } catch (err) {
    console.error("[AdminFinance] recordAdminCommissionPayment error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to record payment" });
  }
}

/**
 * 5. GET /api/admin/finance/payment-history
 * All commission payments across all vendors with pagination
 */
export async function listAdminCommissionPayments(req, res) {
  try {
    const { vendorId, preset, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = {};
    if (vendorId && vendorId !== "all") {
      const vendor = await Vendor.findOne({
        $or: [{ id: vendorId }, { _id: mongoose.isValidObjectId(vendorId) ? vendorId : null }].filter(Boolean),
      }).lean();
      if (vendor) {
        query.vendorId = { $in: [vendor.id, String(vendor._id)] };
      } else {
        query.vendorId = vendorId;
      }
    }

    const dateFilter = buildIstDateFilter(preset, startDate, endDate);
    if (dateFilter) {
      query.paidAt = dateFilter;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    const [totalCount, payments, totalAgg, { vendors: allVendorsCalc, totals: commissionTotals }] = await Promise.all([
      VendorCommissionPayment.countDocuments(query),
      VendorCommissionPayment.find(query)
        .sort({ paidAt: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      VendorCommissionPayment.aggregate([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      calculateAllVendorsCommission(dateFilter),
    ]);

    // Build vendor commission map
    const vendorCalcMap = new Map();
    allVendorsCalc.forEach((vc) => {
      vendorCalcMap.set(vc.vendor.id, vc);
      vendorCalcMap.set(String(vc.vendor._id), vc);
    });

    const enriched = payments.map((p) => {
      const vc = vendorCalcMap.get(p.vendorId);
      const v = vc?.vendor || {};
      return {
        ...p,
        vendorName: v.name || v.ownerName || p.vendorId,
        ownerName: v.ownerName || "",
        commissionRate: vc?.commissionRate ?? 10,
        totalAdminCommission: vc?.totalAdminCommission ?? 0,
        pendingCommission: vc?.pendingCommission ?? 0,
      };
    });

    // Vendor-wise commission summary list
    let vendorWiseSummary = allVendorsCalc.map((vc) => ({
      vendorId: vc.vendor.id,
      vendorDbId: vc.vendor._id,
      vendorName: vc.vendor.name || vc.vendor.vendorName || vc.vendor.ownerName || "Unnamed Vendor",
      ownerName: vc.vendor.ownerName || "",
      phone: vc.vendor.phone || vc.vendor.mobile || "",
      mobile: vc.vendor.mobile || vc.vendor.phone || "",
      email: vc.vendor.email || "",
      city: vc.vendor.city || "",
      state: vc.vendor.state || "",
      location: vc.vendor.location || "—",
      zones: vc.vendor.zones || [],
      collectionCentre: vc.vendor.collectionCentre || null,
      collectionCentreId: vc.vendor.collectionCentreId || vc.vendor.id,
      businessAddress: vc.vendor.businessAddress || "",
      vendorType: vc.vendor.vendorType || "farmer",
      collectionCentres: vc.collectionCentres || [],
      collectionCentresCount: vc.collectionCentresCount || 0,
      darkStores: vc.darkStores || [],
      darkStoresCount: vc.darkStoresCount || 0,
      commissionRate: vc.commissionRate,
      grossProductSales: vc.grossProductSales,
      eligibleCommissionSales: vc.eligibleCommissionSales,
      totalAdminCommission: vc.totalAdminCommission,
      commissionPaid: vc.commissionPaid,
      pendingCommission: vc.pendingCommission,
      commissionStatus: vc.commissionStatus,
      lastPaymentDate: vc.lastPaymentDate,
      paymentsCount: vc.paymentsCount,
    }));

    if (vendorId && vendorId !== "all") {
      vendorWiseSummary = vendorWiseSummary.filter((v) => v.vendorId === vendorId || v.vendorDbId === vendorId);
    }

    return res.json({
      success: true,
      payments: enriched,
      totalPaidAmount: totalAgg?.[0]?.totalAmount || 0,
      vendorWiseSummary,
      commissionTotals,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("[AdminFinance] listAdminCommissionPayments error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load payment history" });
  }
}

/**
 * 6. GET /api/admin/finance/sales-report
 * Order-wise and store-wise sales report with CSV export
 */
export async function getAdminFinanceSalesReports(req, res) {
  try {
    const {
      vendorId,
      storeId,
      status,
      preset,
      startDate,
      endDate,
      page = 1,
      limit = 30,
      exportCsv = false,
    } = req.query;

    const dateFilter = buildIstDateFilter(preset, startDate, endDate);
    const query = { isDeleted: { $ne: true } };

    if (dateFilter) {
      query.createdAt = dateFilter;
    }
    if (status && status !== "all") {
      query.status = status;
    }

    // Resolve storeIds
    let storeIds = null;
    if (storeId && storeId !== "all") {
      if (mongoose.isValidObjectId(storeId)) {
        storeIds = [new mongoose.Types.ObjectId(storeId)];
      }
    } else if (vendorId && vendorId !== "all") {
      const vendor = await Vendor.findOne({
        $or: [{ id: vendorId }, { _id: mongoose.isValidObjectId(vendorId) ? vendorId : null }].filter(Boolean),
      }).lean();
      if (vendor) {
        const isPrimary = vendor.id === "vendor-1";
        const stores = await DeliveryManager.find({
          $or: [
            { vendorId: { $in: [vendor.id, String(vendor._id)] } },
            ...(isPrimary ? [{ vendorId: "" }, { vendorId: null }, { vendorId: { $exists: false } }] : []),
          ],
        }).select("_id");
        storeIds = stores.map((s) => s._id);
      }
    }

    if (storeIds) {
      query.managerId = { $in: storeIds };
    }

    // Delivery Manager lookup
    const allStores = await DeliveryManager.find({}).select("_id storeName name vendorId").lean();
    const storeMap = new Map(allStores.map((s) => [String(s._id), s]));

    // Vendors lookup
    const allVendors = await Vendor.find({}).select("id name ownerName commissionRate").lean();
    const vendorMap = new Map();
    allVendors.forEach((v) => {
      vendorMap.set(v.id, v);
      vendorMap.set(String(v._id), v);
    });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = exportCsv ? 10000 : Math.max(1, parseInt(limit, 10) || 30);

    const [totalCount, rawOrders] = await Promise.all([
      StoreOrder.countDocuments(query),
      StoreOrder.find(query)
        .sort({ createdAt: -1 })
        .skip(exportCsv ? 0 : (pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    let totalGrossSales = 0;
    let totalEligibleSales = 0;
    let totalCommissionGenerated = 0;

    const formattedOrders = rawOrders.map((o) => {
      const isCancelled = o.status === "cancelled";
      const productAmount = (o.items || []).reduce(
        (sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)),
        0
      );
      const eligibleSales = isCancelled ? 0 : productAmount;
      const store = storeMap.get(String(o.managerId)) || {};
      const vendor = vendorMap.get(store.vendorId) || vendorMap.get("vendor-1") || {};
      const rate = Number(vendor.commissionRate ?? 10);
      const commission = Math.round((eligibleSales * rate) / 100);

      totalGrossSales += productAmount;
      totalEligibleSales += eligibleSales;
      totalCommissionGenerated += commission;

      return {
        orderId: o._id,
        orderNumber: o.orderNumber || String(o._id),
        createdAt: o.createdAt,
        darkStore: store.storeName || "Dark Store",
        vendorName: vendor.name || vendor.ownerName || "Primary Vendor",
        status: o.status,
        isEligible: !isCancelled,
        itemsCount: (o.items || []).length,
        productSales: productAmount,
        eligibleCommissionSales: eligibleSales,
        commissionRate: rate,
        adminCommission: commission,
        amountCollected: o.partTotal || o.amountToCollect || 0,
      };
    });

    if (exportCsv) {
      const header = "Order Number,Date,Dark Store,Vendor,Status,Items,Product Sales (INR),Eligible Sales (INR),Commission Rate (%),Admin Commission (INR),Collected (INR)\n";
      const rows = formattedOrders.map((r) =>
        `"${r.orderNumber}","${new Date(r.createdAt).toLocaleString("en-IN")}","${r.darkStore}","${r.vendorName}","${r.status}","${r.itemsCount}","${r.productSales}","${r.eligibleCommissionSales}","${r.commissionRate}%","${r.adminCommission}","${r.amountCollected}"`
      ).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="admin_sales_report.csv"');
      return res.send(header + rows);
    }

    return res.json({
      success: true,
      orders: formattedOrders,
      summary: {
        totalGrossSales,
        totalEligibleSales,
        totalCommissionGenerated,
      },
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("[AdminFinance] getAdminFinanceSalesReports error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load sales report" });
  }
}

/**
 * 7. GET /api/admin/finance/financial-reports
 * Comprehensive report with Commission, Sales, and Payment summaries
 */
export async function getAdminFinancialReports(req, res) {
  try {
    const { preset, startDate, endDate } = req.query;
    const dateFilter = buildIstDateFilter(preset, startDate, endDate);

    const [commissionsResult, paymentsResult] = await Promise.all([
      calculateAllVendorsCommission(dateFilter),
      VendorCommissionPayment.find(dateFilter ? { paidAt: dateFilter } : {})
        .sort({ paidAt: -1 })
        .lean(),
    ]);

    const vendorsLookup = await Vendor.find({}).select("id name ownerName").lean();
    const vMap = new Map();
    vendorsLookup.forEach((v) => {
      vMap.set(v.id, v.name || v.ownerName);
      vMap.set(String(v._id), v.name || v.ownerName);
    });

    const enrichedPayments = paymentsResult.map((p) => ({
      ...p,
      vendorName: vMap.get(p.vendorId) || p.vendorId,
    }));

    return res.json({
      success: true,
      commissionSummary: commissionsResult.totals,
      vendorsCommission: commissionsResult.vendors.map((v) => ({
        vendorId: v.vendor.id,
        vendorName: v.vendor.name || v.vendor.vendorName || v.vendor.ownerName || "Unnamed Vendor",
        ownerName: v.vendor.ownerName || "",
        phone: v.vendor.phone || v.vendor.mobile || "",
        mobile: v.vendor.mobile || v.vendor.phone || "",
        email: v.vendor.email || "",
        city: v.vendor.city || "",
        state: v.vendor.state || "",
        location: v.vendor.location || [v.vendor.city, v.vendor.state].filter(Boolean).join(", ") || "N/A",
        businessAddress: v.vendor.businessAddress || "",
        vendorType: v.vendor.vendorType || "farmer",
        collectionCentres: v.collectionCentres || [],
        collectionCentresCount: v.collectionCentresCount || 0,
        darkStores: v.darkStores || [],
        darkStoresCount: v.darkStoresCount || 0,
        commissionRate: v.commissionRate,
        grossProductSales: v.grossProductSales,
        eligibleCommissionSales: v.eligibleCommissionSales,
        totalAdminCommission: v.totalAdminCommission,
        commissionPaid: v.commissionPaid,
        pendingCommission: v.pendingCommission,
        status: v.commissionStatus,
        lastPaymentDate: v.lastPaymentDate,
      })),
      recentPayments: enrichedPayments.slice(0, 50),
    });
  } catch (err) {
    console.error("[AdminFinance] getAdminFinancialReports error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load financial reports" });
  }
}

