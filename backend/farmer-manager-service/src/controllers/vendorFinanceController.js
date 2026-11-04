import mongoose from "mongoose";
import DeliveryManager from "../../../delivery-service/src/models/DeliveryManager.js";
import StoreOrder from "../../../delivery-service/src/models/StoreOrder.js";
import DeliveryExpense from "../../../delivery-service/src/models/DeliveryExpense.js";
import { Vendor, Farmer, FarmerOrder, FarmerEarning } from "../models.js";
import VendorExpense from "../models/VendorExpense.js";
import VendorSettlement from "../models/VendorSettlement.js";
import {
  calculateVendorFinancials,
  buildDateRange,
  parseIstDate,
} from "../services/vendorFinanceCalculationService.js";

// Helper to extract authenticated vendor ID
export function getAuthenticatedVendorId(req) {
  return req.user?.vendorId || req.user?.id || req.user?._id;
}

// ── 1. GET /api/vendor/finance/dashboard ────────────────────────
export async function getVendorFinanceDashboard(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    if (!vendorId) {
      return res.status(403).json({ success: false, message: "Vendor authentication required" });
    }

    const { preset = "last30", startDate, endDate, storeId } = req.query;

    const data = await calculateVendorFinancials({
      vendorId,
      preset,
      startDate,
      endDate,
      storeId,
    });

    // Dark Stores list for filter dropdown
    const isPrimaryVendor = data.vendor.id === "vendor-1";
    const darkStores = await DeliveryManager.find({
      $or: [
        { vendorId: { $in: [data.vendor.id, String(vendorId)] } },
        ...(isPrimaryVendor ? [{ vendorId: "" }, { vendorId: null }, { vendorId: { $exists: false } }] : []),
      ],
      isDeleted: { $ne: true },
      deleted: { $ne: true },
      status: { $nin: ["deleted", "DELETED"] },
    })
      .select("_id storeName name area city pincode")
      .lean();

    // Monthly Sales vs Expenses breakdown (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const storeIds = darkStores.map((s) => s._id);

    const monthlySalesAgg = await StoreOrder.aggregate([
      {
        $match: {
          managerId: { $in: storeIds },
          createdAt: { $gte: sixMonthsAgo },
          status: { $ne: "cancelled" },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Kolkata" },
          },
          sales: {
            $sum: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$items", []] },
                  as: "it",
                  in: {
                    $multiply: [
                      { $ifNull: ["$$it.price", 0] },
                      { $ifNull: ["$$it.quantity", 0] },
                    ],
                  },
                },
              },
            },
          },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyExpensesAgg = await VendorExpense.aggregate([
      {
        $match: {
          vendorId: { $in: [data.vendor.id, String(vendorId)] },
          expenseDate: { $gte: sixMonthsAgo },
          status: { $in: ["Approved", "Paid"] },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$expenseDate", timezone: "Asia/Kolkata" },
          },
          expenses: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Merge monthly trend
    const monthMap = new Map();
    monthlySalesAgg.forEach((m) => {
      monthMap.set(m._id, { month: m._id, sales: m.sales, ordersCount: m.ordersCount, expenses: 0 });
    });
    monthlyExpensesAgg.forEach((e) => {
      if (monthMap.has(e._id)) {
        monthMap.get(e._id).expenses = e.expenses;
      } else {
        monthMap.set(e._id, { month: e._id, sales: 0, ordersCount: 0, expenses: e.expenses });
      }
    });

    const monthlyTrend = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    // Recent Settlements
    const recentSettlements = await VendorSettlement.find({
      vendorId: { $in: [data.vendor.id, String(vendorId)] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return res.json({
      success: true,
      ...data,
      darkStores: darkStores.map((s) => ({
        id: String(s._id),
        name: s.storeName || s.name,
        area: s.area,
        city: s.city,
      })),
      monthlyTrend,
      recentSettlements,
    });
  } catch (err) {
    console.error("getVendorFinanceDashboard error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load finance dashboard" });
  }
}

// ── 2. GET /api/vendor/finance/sales-reports ───────────────────
export async function getVendorSalesReports(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    if (!vendorId) {
      return res.status(403).json({ success: false, message: "Vendor authentication required" });
    }

    const {
      preset = "last30",
      startDate,
      endDate,
      storeId,
      status,
      paymentMethod,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const data = await calculateVendorFinancials({
      vendorId,
      preset,
      startDate,
      endDate,
      storeId,
    });

    const isPrimaryVendor = data.vendor.id === "vendor-1";
    const darkStores = await DeliveryManager.find({
      $or: [
        { vendorId: { $in: [data.vendor.id, String(vendorId)] } },
        ...(isPrimaryVendor ? [{ vendorId: "" }, { vendorId: null }, { vendorId: { $exists: false } }] : []),
      ],
      isDeleted: { $ne: true },
      deleted: { $ne: true },
      status: { $nin: ["deleted", "DELETED"] },
    })
      .select("_id storeName name area city")
      .lean();

    const storeIds = storeId && storeId !== "ALL" && storeId !== "all" && mongoose.isValidObjectId(storeId)
      ? [new mongoose.Types.ObjectId(storeId)]
      : darkStores.map((s) => s._id);

    const dateMatch = buildDateRange(preset, startDate, endDate);
    const query = {
      managerId: { $in: storeIds },
      isDeleted: { $ne: true },
    };
    if (dateMatch) {
      query.createdAt = dateMatch;
    }
    if (status && status !== "ALL") {
      query.status = status;
    }
    if (paymentMethod && paymentMethod !== "ALL") {
      query.paymentMethod = paymentMethod;
    }
    if (search && String(search).trim()) {
      const q = String(search).trim();
      query.$or = [
        { orderNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
      ];
    }

    // Daily Sales Activity Trend
    const dailyTrend = await StoreOrder.aggregate([
      { $match: { managerId: { $in: storeIds }, ...(dateMatch ? { createdAt: dateMatch } : {}) } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" },
          },
          ordersCount: { $sum: 1 },
          completedCount: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          salesAmount: {
            $sum: {
              $cond: [
                { $ne: ["$status", "cancelled"] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "it",
                      in: {
                        $multiply: [
                          { $ifNull: ["$$it.price", 0] },
                          { $ifNull: ["$$it.quantity", 0] },
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Payment Method Breakdown with Items and Delivery split
    const paymentBreakdown = await StoreOrder.aggregate([
      { $match: { managerId: { $in: storeIds }, status: { $ne: "cancelled" }, ...(dateMatch ? { createdAt: dateMatch } : {}) } },
      {
        $group: {
          _id: { $ifNull: ["$paymentMethod", "UNSPECIFIED"] },
          count: { $sum: 1 },
          productSales: {
            $sum: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$items", []] },
                  as: "it",
                  in: {
                    $multiply: [
                      { $ifNull: ["$$it.price", 0] },
                      { $ifNull: ["$$it.quantity", 0] },
                    ],
                  },
                },
              },
            },
          },
          deliveryCharges: {
            $sum: {
              $let: {
                vars: {
                  rawPaid: {
                    $cond: [
                      { $gt: [{ $ifNull: ["$partTotal", 0] }, 0] },
                      "$partTotal",
                      { $ifNull: ["$amountToCollect", 0] },
                    ],
                  },
                  itemsSum: {
                    $sum: {
                      $map: {
                        input: { $ifNull: ["$items", []] },
                        as: "it",
                        in: {
                          $multiply: [
                            { $ifNull: ["$$it.price", 0] },
                            { $ifNull: ["$$it.quantity", 0] },
                          ],
                        },
                      },
                    },
                  },
                },
                in: {
                  $let: {
                    vars: { diff: { $subtract: ["$$rawPaid", "$$itemsSum"] } },
                    in: { $cond: [{ $gt: ["$$diff", 0] }, "$$diff", 0] },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          productSales: 1,
          deliveryCharges: 1,
          amount: { $add: ["$productSales", "$deliveryCharges"] },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    // Paginated Table Data
    const skip = (Number(page) - 1) * Number(limit);
    const totalOrdersCount = await StoreOrder.countDocuments(query);
    const orders = await StoreOrder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("managerId", "storeName name city area")
      .lean();

    const storeMap = new Map(darkStores.map((s) => [String(s._id), s.storeName || s.name]));

    const tableRows = orders.map((o) => {
      const itemsSum = (o.items || []).reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
        0
      );
      const rawPaid = Number(o.partTotal || o.amountToCollect || 0);
      const deliveryCharge = rawPaid > itemsSum ? rawPaid - itemsSum : 0;
      const customerPaid = itemsSum + deliveryCharge;
      const storeName = o.managerId?.storeName || o.managerId?.name || storeMap.get(String(o.managerId)) || "Dark Store";
      const comm = Math.round((itemsSum * (data.kpis.commissionRate || 10)) / 100);

      return {
        _id: o._id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        deliveredAt: o.deliveredAt,
        customerName: o.customerName || "Customer",
        customerPhone: o.customerPhone,
        storeName,
        productSales: itemsSum,
        deliveryCharge,
        customerPaidAmount: customerPaid,
        adminCommission: o.status === "cancelled" ? 0 : comm,
        refund: Number(o.refundDue || 0),
        status: o.status,
        paymentMethod: o.paymentMethod || "COD",
        itemsCount: (o.items || []).length,
      };
    });

    // Dark Store Wise Sales & Expenses breakdown
    const allStoreIds = darkStores.map((s) => s._id);
    const storeWiseAgg = await StoreOrder.aggregate([
      {
        $match: {
          managerId: { $in: allStoreIds },
          isDeleted: { $ne: true },
          ...(dateMatch ? { createdAt: dateMatch } : {}),
        },
      },
      {
        $group: {
          _id: "$managerId",
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          cancelledOrdersCost: {
            $sum: {
              $cond: [
                { $eq: ["$status", "cancelled"] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "it",
                      in: {
                        $multiply: [
                          { $ifNull: ["$$it.price", 0] },
                          { $ifNull: ["$$it.quantity", 0] },
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
          grossProductSales: {
            $sum: {
              $cond: [
                { $ne: ["$status", "cancelled"] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "it",
                      in: {
                        $multiply: [
                          { $ifNull: ["$$it.price", 0] },
                          { $ifNull: ["$$it.quantity", 0] },
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
          deliveryCharges: {
            $sum: {
              $cond: [
                { $ne: ["$status", "cancelled"] },
                {
                  $let: {
                    vars: {
                      rawPaid: {
                        $cond: [
                          { $gt: [{ $ifNull: ["$partTotal", 0] }, 0] },
                          "$partTotal",
                          { $ifNull: ["$amountToCollect", 0] },
                        ],
                      },
                      itemsSum: {
                        $sum: {
                          $map: {
                            input: { $ifNull: ["$items", []] },
                            as: "it",
                            in: {
                              $multiply: [
                                { $ifNull: ["$$it.price", 0] },
                                { $ifNull: ["$$it.quantity", 0] },
                              ],
                            },
                          },
                        },
                      },
                    },
                    in: {
                      $let: {
                        vars: { diff: { $subtract: ["$$rawPaid", "$$itemsSum"] } },
                        in: { $cond: [{ $gt: ["$$diff", 0] }, "$$diff", 0] },
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
          deliveredSales: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "it",
                      in: {
                        $multiply: [
                          { $ifNull: ["$$it.price", 0] },
                          { $ifNull: ["$$it.quantity", 0] },
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
        },
      },
    ]);

    // Store expenses from DeliveryExpense
    const storeExpAgg = await DeliveryExpense.aggregate([
      {
        $match: {
          managerId: { $in: allStoreIds },
          status: { $in: ["Approved", "Paid"] },
          ...(dateMatch ? { expenseDate: dateMatch } : {}),
        },
      },
      {
        $group: {
          _id: "$managerId",
          totalExpenses: { $sum: "$amount" },
        },
      },
    ]);

    const storeExpMap = new Map(storeExpAgg.map((e) => [String(e._id), e.totalExpenses]));
    const storeOrderMap = new Map(storeWiseAgg.map((o) => [String(o._id), o]));

    const totalVendorProcurement = data.kpis?.farmerProcurementCost || 0;
    const totalVendorGrossSales = data.kpis?.grossProductSales || 0;
    const vendorRate = data.kpis?.commissionRate || 10;

    const darkStoreBreakdown = darkStores.map((s) => {
      const o = storeOrderMap.get(String(s._id)) || {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        cancelledOrdersCost: 0,
        grossProductSales: 0,
        deliveryCharges: 0,
        deliveredSales: 0,
      };
      const exp = storeExpMap.get(String(s._id)) || 0;
      const totalSale = o.grossProductSales + o.deliveryCharges;
      const customerPaymentTotal = totalSale + o.cancelledOrdersCost;
      const storeProcurement = totalVendorGrossSales > 0
        ? Math.round((totalVendorProcurement * o.grossProductSales) / totalVendorGrossSales)
        : (darkStores.length === 1 ? totalVendorProcurement : 0);
      const storeCommission = Math.round((customerPaymentTotal * vendorRate) / 100);
      // All deductions: Procurement + Commission + Dark Store Expenses
      const netProfit = totalSale - storeProcurement - storeCommission - exp;
      const currentProfit = o.deliveredSales;

      return {
        id: String(s._id),
        name: s.storeName || s.name || "Dark Store",
        storeName: s.storeName || s.name || "Dark Store",
        area: s.area || "",
        city: s.city || "",
        totalOrders: o.totalOrders,
        completedOrders: o.completedOrders,
        cancelledOrders: o.cancelledOrders,
        cancelledOrdersCost: o.cancelledOrdersCost,
        customerPaymentTotal,
        grossProductSales: o.grossProductSales,
        deliveryCharges: o.deliveryCharges,
        totalSale,
        totalExpense: exp,
        netProfit,
        currentProfit,
      };
    });

    return res.json({
      success: true,
      kpis: data.kpis,
      charts: {
        dailyTrend,
        paymentBreakdown,
      },
      data: tableRows,
      total: totalOrdersCount,
      page: Number(page),
      pages: Math.ceil(totalOrdersCount / Number(limit)) || 1,
      darkStores: darkStores.map((s) => ({
        id: String(s._id),
        name: s.storeName || s.name,
        area: s.area,
        city: s.city,
      })),
      darkStoreBreakdown,
    });
  } catch (err) {
    console.error("getVendorSalesReports error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load sales reports" });
  }
}

// Helper to check if an order has a completed/confirmed grading statement
function isStatementOrder(order) {
  const status = String(order.status || "").trim().toUpperCase();
  const quality = String(order.qualityStatus || "").trim().toUpperCase();
  return (
    status === "GRADE_CONFIRMED" ||
    status === "ORDER_COMPLETED" ||
    quality === "GRADE_CONFIRMED" ||
    quality === "ORDER_COMPLETED"
  );
}

function isOrderPaid(order) {
  if (!order) return false;
  const candidates = [
    order.paymentStatus,
    order.payment_status,
    order.paymentDetails?.paymentStatus,
    order.paymentDetails?.status,
    order.payment?.status,
    order.payment?.paymentStatus,
    order.earningStatus,
    order.earningsStatus,
    order.settlementStatus,
  ].filter(Boolean);

  return candidates.some((val) => {
    const s = String(val).toUpperCase().trim();
    return (
      s === "PAID" ||
      s === "PAYMENT_COMPLETED" ||
      s === "PAYMENT COMPLETED" ||
      s === "COMPLETED" ||
      s === "PAYMENT RECEIVED" ||
      s === "PAID_ONLINE" ||
      s === "PAID ONLINE" ||
      s === "PAID_10" ||
      s === "SETTLED" ||
      s.startsWith("PAID") ||
      s.includes("PAYMENT COMPLETED") ||
      s.includes("PAYMENT_COMPLETED")
    );
  });
}

function getOrderStatementAmount(order) {
  // Check finalStatement or grades array
  const grades = Array.isArray(order.finalStatement) && order.finalStatement.length
    ? order.finalStatement
    : Array.isArray(order.grades) && order.grades.length
    ? order.grades
    : [];

  if (grades.length > 0) {
    const gradeTotal = grades.reduce((sum, g) => {
      const q = Number(g.quantity || 0);
      const r = Number(g.rate ?? g.price ?? 0);
      const amt = Number(g.amount || 0);
      return sum + (amt > 0 ? amt : q * r);
    }, 0);
    if (gradeTotal > 0) return gradeTotal;
  }

  return Number(order.orderValue || order.totalAmount || (Number(order.orderedQuantity || 0) * Number(order.price || 0)) || 0);
}

// ── 3. GET /api/vendor/finance/farmer-payments ─────────────────
export async function getVendorFarmerPayments(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    if (!vendorId) {
      return res.status(403).json({ success: false, message: "Vendor authentication required" });
    }

    const { preset = "all", startDate, endDate, search, status, viewMode = "statements" } = req.query;
    const vendorMatch = { $in: [vendorId, String(vendorId)] };

    // Fetch farmers assigned to this vendor
    const farmers = await Farmer.find({
      vendorId: vendorMatch,
      isDeleted: { $ne: true },
    })
      .select("id name mobile farmName farmLocation address bank verificationStatus status")
      .lean();

    const farmerIds = farmers.map((f) => f.id);

    // Fetch all orders for this vendor's farmers
    const dateMatch = buildDateRange(preset, startDate, endDate);
    const orderQuery = {
      vendorId: vendorMatch,
      farmerId: { $in: farmerIds },
      status: { $nin: ["CANCELLED", "REJECTED", "cancelled", "rejected"] },
    };
    if (dateMatch) {
      orderQuery.createdAt = dateMatch;
    }

    const allOrders = await FarmerOrder.find(orderQuery).lean();

    // Settlements paid per farmer
    const settlementQuery = {
      vendorId: vendorMatch,
      settlementType: "farmer_vendor",
      status: { $in: ["Paid", "Partially Paid"] },
    };
    if (dateMatch) {
      settlementQuery.createdAt = dateMatch;
    }

    const settlements = await VendorSettlement.find(settlementQuery).lean();
    const settleMap = new Map();
    settlements.forEach((s) => {
      settleMap.set(s.entityId, (settleMap.get(s.entityId) || 0) + Number(s.paidAmount || 0));
    });

    // 1. Calculate Earning Statement figures (exact ManagerEarningsPage logic)
    const statementOrders = allOrders.filter(isStatementOrder);

    let stmtProcurementTotal = 0;
    let stmtPaidTotal = 0;
    let stmtQuantityTotal = 0;
    let stmtOrdersTotal = statementOrders.length;

    // 2. Calculate All Orders figures (pipeline)
    let allProcurementTotal = 0;
    let allPaidTotal = 0;
    let allQuantityTotal = 0;
    let allOrdersTotal = allOrders.length;

    // Pre-group orders by farmer
    const farmerOrdersMap = new Map();
    const farmerStatementOrdersMap = new Map();

    farmers.forEach((f) => {
      farmerOrdersMap.set(f.id, []);
      farmerStatementOrdersMap.set(f.id, []);
    });

    allOrders.forEach((o) => {
      if (farmerOrdersMap.has(o.farmerId)) {
        farmerOrdersMap.get(o.farmerId).push(o);
      }
      if (isStatementOrder(o) && farmerStatementOrdersMap.has(o.farmerId)) {
        farmerStatementOrdersMap.get(o.farmerId).push(o);
      }
    });

    const isStatementMode = viewMode !== "all";

    const farmerRows = farmers
      .map((f) => {
        const fAllOrders = farmerOrdersMap.get(f.id) || [];
        const fStmtOrders = farmerStatementOrdersMap.get(f.id) || [];
        const settledPaid = settleMap.get(f.id) || 0;

        // Earning Statement amounts
        let stmtProc = 0;
        let stmtPaid = 0;
        let stmtQty = 0;
        fStmtOrders.forEach((o) => {
          const amt = getOrderStatementAmount(o);
          stmtProc += amt;
          stmtQty += Number(o.orderedQuantity || o.quantity || 0);
          if (isOrderPaid(o)) {
            stmtPaid += amt;
          }
        });
        stmtPaid += settledPaid;
        const stmtPending = Math.max(0, stmtProc - stmtPaid);

        stmtProcurementTotal += stmtProc;
        stmtPaidTotal += stmtPaid;
        stmtQuantityTotal += stmtQty;

        // All Orders amounts
        let allProc = 0;
        let allPaid = 0;
        let allQty = 0;
        fAllOrders.forEach((o) => {
          const amt = getOrderStatementAmount(o);
          allProc += amt;
          allQty += Number(o.orderedQuantity || o.quantity || 0);
          if (isOrderPaid(o)) {
            allPaid += amt;
          }
        });
        allPaid += settledPaid;
        const allPending = Math.max(0, allProc - allPaid);

        allProcurementTotal += allProc;
        allPaidTotal += allPaid;
        allQuantityTotal += allQty;

        // Active values based on selected viewMode (default: statements)
        const activeOrdersCount = isStatementMode ? fStmtOrders.length : fAllOrders.length;
        const activeQuantity = isStatementMode ? stmtQty : allQty;
        const procurementAmount = isStatementMode ? stmtProc : allProc;
        const paidAmount = isStatementMode ? stmtPaid : allPaid;
        const pendingAmount = isStatementMode ? stmtPending : allPending;

        const percentPaid = procurementAmount > 0
          ? Math.min(100, Math.round((paidAmount / procurementAmount) * 100))
          : (paidAmount > 0 ? 100 : 0);

        const latestOrder = (isStatementMode ? fStmtOrders : fAllOrders)[0];

        return {
          farmerId: f.id,
          name: f.name,
          mobile: f.mobile || "—",
          farmName: f.farmName || f.name,
          location: f.farmLocation || f.address?.district || f.address?.city || "Local Farm",
          bankAccount: f.bank?.accountNumber ? `•••• ${f.bank.accountNumber.slice(-4)}` : "Not Added",
          bank: f.bank || {},
          totalOrders: activeOrdersCount,
          totalQuantity: activeQuantity,
          procurementAmount,
          paidAmount,
          pendingAmount,
          percentPaid,
          statementDetails: {
            statementOrdersCount: fStmtOrders.length,
            statementProcurement: stmtProc,
            statementPaid: stmtPaid,
            statementPending: stmtPending,
          },
          allOrdersDetails: {
            allOrdersCount: fAllOrders.length,
            allProcurement: allProc,
            allPaid: allPaid,
            allPending: allPending,
          },
          lastSupplyDate: latestOrder?.createdAt || null,
          settlementStatus: pendingAmount === 0 && procurementAmount > 0 ? "Settled" : pendingAmount > 0 ? "Pending" : "No Dues",
        };
      })
      .filter((row) => {
        if (!search) return true;
        const q = String(search).toLowerCase();
        return (
          row.name.toLowerCase().includes(q) ||
          row.farmerId.toLowerCase().includes(q) ||
          row.mobile.includes(q) ||
          row.location.toLowerCase().includes(q)
        );
      });

    const activeProcurementTotal = isStatementMode ? stmtProcurementTotal : allProcurementTotal;
    const activePaidTotal = isStatementMode ? stmtPaidTotal : allPaidTotal;
    const activePendingTotal = Math.max(0, activeProcurementTotal - activePaidTotal);
    const activeQuantityTotal = isStatementMode ? stmtQuantityTotal : allQuantityTotal;
    const activeOrdersTotal = isStatementMode ? stmtOrdersTotal : allOrdersTotal;

    const activeFarmersCount = farmerRows.filter((f) => f.totalOrders > 0 || f.procurementAmount > 0).length;
    const farmersWithDuesCount = farmerRows.filter((f) => f.pendingAmount > 0).length;

    return res.json({
      success: true,
      viewMode: isStatementMode ? "statements" : "all",
      summary: {
        totalFarmers: farmers.length,
        activeFarmers: activeFarmersCount,
        farmersWithDues: farmersWithDuesCount,
        totalOrders: activeOrdersTotal,
        totalQuantity: activeQuantityTotal,
        totalProcurement: activeProcurementTotal,
        totalPaid: activePaidTotal,
        pendingPayments: activePendingTotal,
        earningStatement: {
          totalProcurement: stmtProcurementTotal,
          totalPaid: stmtPaidTotal,
          pendingPayments: Math.max(0, stmtProcurementTotal - stmtPaidTotal),
          totalOrders: stmtOrdersTotal,
          totalQuantity: stmtQuantityTotal,
        },
        allPipeline: {
          totalProcurement: allProcurementTotal,
          totalPaid: allPaidTotal,
          pendingPayments: Math.max(0, allProcurementTotal - allPaidTotal),
          totalOrders: allOrdersTotal,
          totalQuantity: allQuantityTotal,
        },
      },
      farmers: farmerRows,
    });
  } catch (err) {
    console.error("getVendorFarmerPayments error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load farmer payments" });
  }
}

// ── 4. GET /api/vendor/finance/farmer-payments/:farmerId ───────
export async function getVendorFarmerDetail(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const { farmerId } = req.params;

    const farmer = await Farmer.findOne({
      id: farmerId,
      vendorId: { $in: [vendorId, String(vendorId)] },
    }).lean();

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    // Orders supplied by this farmer
    const orders = await FarmerOrder.find({
      farmerId,
      vendorId: { $in: [vendorId, String(vendorId)] },
      status: { $nin: ["CANCELLED", "REJECTED", "cancelled", "rejected"] },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Settlements for this farmer
    const settlements = await VendorSettlement.find({
      entityId: farmerId,
      vendorId: { $in: [vendorId, String(vendorId)] },
      settlementType: "farmer_vendor",
    })
      .sort({ createdAt: -1 })
      .lean();

    // Separate into Earning Statement orders vs in-progress orders
    const statementOrders = orders.filter(isStatementOrder);

    let stmtProc = 0;
    let stmtPaid = 0;
    let stmtQty = 0;
    statementOrders.forEach((o) => {
      const amt = getOrderStatementAmount(o);
      stmtProc += amt;
      stmtQty += Number(o.orderedQuantity || o.quantity || 0);
      if (isOrderPaid(o)) {
        stmtPaid += amt;
      }
    });

    const settledPaid = settlements
      .filter((s) => ["Paid", "Partially Paid"].includes(s.status))
      .reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);

    stmtPaid += settledPaid;
    const stmtPending = Math.max(0, stmtProc - stmtPaid);

    // All orders totals
    let allProc = 0;
    let allPaid = 0;
    let allQty = 0;
    orders.forEach((o) => {
      const amt = getOrderStatementAmount(o);
      allProc += amt;
      allQty += Number(o.orderedQuantity || o.quantity || 0);
      if (isOrderPaid(o)) {
        allPaid += amt;
      }
    });
    allPaid += settledPaid;
    const allPending = Math.max(0, allProc - allPaid);

    return res.json({
      success: true,
      farmer,
      summary: {
        totalProcurement: stmtProc,
        totalQuantity: stmtQty,
        totalOrders: statementOrders.length,
        totalPaid: stmtPaid,
        pendingAmount: stmtPending,
        earningStatement: {
          totalProcurement: stmtProc,
          totalPaid: stmtPaid,
          pendingAmount: stmtPending,
          totalOrders: statementOrders.length,
          totalQuantity: stmtQty,
        },
        allPipeline: {
          totalProcurement: allProc,
          totalPaid: allPaid,
          pendingAmount: allPending,
          totalOrders: orders.length,
          totalQuantity: allQty,
        },
      },
      orders,
      statementOrders,
      settlements,
    });
  } catch (err) {
    console.error("getVendorFarmerDetail error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load farmer details" });
  }
}

// ── 5. GET /api/vendor/finance/delivery-manager-reports ────────
export async function getVendorDarkStoreReports(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const { preset = "last30", startDate, endDate } = req.query;

    const vendor = await Vendor.findOne({
      $or: [{ id: vendorId }, { _id: mongoose.isValidObjectId(vendorId) ? vendorId : null }].filter(Boolean),
    }).lean();

    const isPrimaryVendor = vendor?.id === "vendor-1";
    const darkStores = await DeliveryManager.find({
      $or: [
        { vendorId: { $in: [vendor?.id, String(vendorId)] } },
        ...(isPrimaryVendor ? [{ vendorId: "" }, { vendorId: null }, { vendorId: { $exists: false } }] : []),
      ],
      isDeleted: { $ne: true },
      deleted: { $ne: true },
      status: { $nin: ["deleted", "DELETED"] },
    }).lean();

    const dateMatch = buildDateRange(preset, startDate, endDate);
    const storeIds = darkStores.map((s) => s._id);

    // Dark store orders aggregation
    const storeOrdersAgg = await StoreOrder.aggregate([
      {
        $match: {
          managerId: { $in: storeIds },
          isDeleted: { $ne: true },
          ...(dateMatch ? { createdAt: dateMatch } : {}),
        },
      },
      {
        $group: {
          _id: "$managerId",
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          cancelledOrdersCost: {
            $sum: {
              $cond: [
                { $eq: ["$status", "cancelled"] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "it",
                      in: {
                        $multiply: [
                          { $ifNull: ["$$it.price", 0] },
                          { $ifNull: ["$$it.quantity", 0] },
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
          productSales: {
            $sum: {
              $cond: [
                { $ne: ["$status", "cancelled"] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "it",
                      in: {
                        $multiply: [
                          { $ifNull: ["$$it.price", 0] },
                          { $ifNull: ["$$it.quantity", 0] },
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
          deliveryCharges: {
            $sum: {
              $cond: [
                { $ne: ["$status", "cancelled"] },
                {
                  $let: {
                    vars: {
                      rawPaid: {
                        $cond: [
                          { $gt: [{ $ifNull: ["$partTotal", 0] }, 0] },
                          "$partTotal",
                          { $ifNull: ["$amountToCollect", 0] },
                        ],
                      },
                      itemsSum: {
                        $sum: {
                          $map: {
                            input: { $ifNull: ["$items", []] },
                            as: "it",
                            in: {
                              $multiply: [
                                { $ifNull: ["$$it.price", 0] },
                                { $ifNull: ["$$it.quantity", 0] },
                              ],
                            },
                          },
                        },
                      },
                    },
                    in: {
                      $let: {
                        vars: { diff: { $subtract: ["$$rawPaid", "$$itemsSum"] } },
                        in: { $cond: [{ $gt: ["$$diff", 0] }, "$$diff", 0] },
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
          deliveredSales: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "it",
                      in: {
                        $multiply: [
                          { $ifNull: ["$$it.price", 0] },
                          { $ifNull: ["$$it.quantity", 0] },
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
        },
      },
    ]);

    const orderMap = new Map(storeOrdersAgg.map((o) => [String(o._id), o]));

    // Dark store expenses aggregation from DeliveryExpense
    const storeExpensesAgg = await DeliveryExpense.aggregate([
      {
        $match: {
          managerId: { $in: storeIds },
          status: { $in: ["Approved", "Paid"] },
          ...(dateMatch ? { expenseDate: dateMatch } : {}),
        },
      },
      {
        $group: {
          _id: "$managerId",
          totalExpenses: { $sum: "$amount" },
        },
      },
    ]);

    const expenseMap = new Map(storeExpensesAgg.map((e) => [String(e._id), e.totalExpenses]));

    let totalOrders = 0;
    let completedDeliveries = 0;
    let cancelledOrders = 0;
    let grossProductSales = 0;
    let totalDeliveryRevenue = 0;
    let totalDarkStoreExpenses = 0;
    let totalDeliveredSales = 0;

    const storeRows = darkStores.map((s) => {
      const ord = orderMap.get(String(s._id)) || {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        cancelledOrdersCost: 0,
        productSales: 0,
        deliveryCharges: 0,
        deliveredSales: 0,
      };
      const exp = expenseMap.get(String(s._id)) || 0;
      const totalSale = ord.productSales + ord.deliveryCharges;
      const customerPaymentTotal = totalSale + ord.cancelledOrdersCost;
      const netProfit = totalSale - exp;
      const netDeliveryProfit = ord.deliveryCharges - exp;
      const currentProfit = ord.deliveredSales;

      totalOrders += ord.totalOrders;
      completedDeliveries += ord.completedOrders;
      cancelledOrders += ord.cancelledOrders;
      grossProductSales += ord.productSales;
      totalDeliveryRevenue += ord.deliveryCharges;
      totalDarkStoreExpenses += exp;
      totalDeliveredSales += ord.deliveredSales;

      return {
        id: String(s._id),
        name: s.name || s.storeName || "Dark Store",
        storeName: s.storeName || s.name,
        managerName: s.name || "Store Manager",
        phone: s.phone || s.mobile || "",
        email: s.email || "",
        area: s.area || "City",
        city: s.city || "",
        pincode: s.pincode || "",
        totalOrders: ord.totalOrders,
        completedOrders: ord.completedOrders,
        cancelledOrders: ord.cancelledOrders,
        cancelledOrdersCost: ord.cancelledOrdersCost,
        customerPaymentTotal,
        productSales: ord.productSales,
        deliveryRevenue: ord.deliveryCharges,
        totalSale,
        expenses: exp,
        netProfit,
        netDeliveryProfit,
        currentProfit,
        deliveredSales: ord.deliveredSales,
        status: s.status || "Active",
      };
    });

    const overallTotalSale = grossProductSales + totalDeliveryRevenue;

    return res.json({
      success: true,
      summary: {
        vendorName: vendor?.name || vendor?.vendorName || "Vendor",
        vendorId: vendor?.id || String(vendorId),
        totalDarkStores: darkStores.length,
        activeDarkStores: darkStores.filter((s) => s.status !== "Inactive").length,
        totalOrders,
        completedDeliveries,
        cancelledOrders,
        customerPaymentTotal: overallTotalSale,
        grossProductSales,
        deliveryRevenue: totalDeliveryRevenue,
        totalSale: overallTotalSale,
        deliveryExpenses: totalDarkStoreExpenses,
        netProfit: overallTotalSale - totalDarkStoreExpenses,
        netDeliveryProfit: totalDeliveryRevenue - totalDarkStoreExpenses,
        currentProfit: totalDeliveredSales,
      },
      stores: storeRows,
    });
  } catch (err) {
    console.error("getVendorDarkStoreReports error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load dark store reports" });
  }
}

// ── 5B. GET /api/vendor/finance/delivery-manager-reports/:storeId ──
export async function getVendorDarkStoreDetail(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const { storeId } = req.params;

    const vendor = await Vendor.findOne({
      $or: [{ id: vendorId }, { _id: mongoose.isValidObjectId(vendorId) ? vendorId : null }].filter(Boolean),
    }).lean();

    const isPrimaryVendor = vendor?.id === "vendor-1";
    const store = await DeliveryManager.findOne({
      _id: storeId,
      $or: [
        { vendorId: { $in: [vendor?.id, String(vendorId)] } },
        ...(isPrimaryVendor ? [{ vendorId: "" }, { vendorId: null }, { vendorId: { $exists: false } }] : []),
      ],
      isDeleted: { $ne: true },
    }).lean();

    if (!store) {
      return res.status(404).json({ success: false, message: "Dark store not found" });
    }

    const orders = await StoreOrder.find({
      managerId: store._id,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const expenses = await DeliveryExpense.find({
      managerId: store._id,
      status: { $in: ["Approved", "Paid"] },
    })
      .sort({ expenseDate: -1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      store: {
        id: String(store._id),
        name: store.storeName || store.name,
        managerName: store.name,
        phone: store.phone || store.mobile,
        email: store.email,
        address: store.address,
        area: store.area,
        city: store.city,
        pincode: store.pincode,
        status: store.status,
      },
      orders: orders.map((o) => {
        const itemsSum = (o.items || []).reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
        const rawPaid = Number(o.partTotal || o.amountToCollect || 0);
        const delFee = rawPaid > itemsSum ? rawPaid - itemsSum : 0;
        return {
          _id: o._id,
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          customerName: o.customerName || "Customer",
          customerPhone: o.customerPhone,
          itemsCount: (o.items || []).length,
          productSales: itemsSum,
          deliveryCharge: delFee,
          totalAmount: itemsSum + delFee,
          paymentMethod: o.paymentMethod || "COD",
          status: o.status,
        };
      }),
      expenses: expenses.map((e) => ({
        _id: e._id,
        title: e.title,
        amount: e.amount,
        category: e.category,
        expenseDate: e.expenseDate,
        status: e.status,
        paymentMethod: e.paymentMethod,
        notes: e.notes,
      })),
    });
  } catch (err) {
    console.error("getVendorDarkStoreDetail error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load dark store detail" });
  }
}

// ── 6. GET & CRUD /api/vendor/finance/expenses ─────────────────
export async function getVendorExpenses(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const { preset, startDate, endDate, category, status, search, page = 1, limit = 20 } = req.query;

    const dateMatch = buildDateRange(preset, startDate, endDate);
    const query = { vendorId: { $in: [vendorId, String(vendorId)] } };

    if (dateMatch) {
      query.expenseDate = dateMatch;
    }
    if (category && category !== "ALL") {
      query.category = category;
    }
    if (status && status !== "ALL") {
      query.status = status;
    }
    if (search && String(search).trim()) {
      query.title = { $regex: String(search).trim(), $options: "i" };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const totalCount = await VendorExpense.countDocuments(query);
    const expenses = await VendorExpense.find(query)
      .sort({ expenseDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Summary totals by category
    const categoryTotalsAgg = await VendorExpense.aggregate([
      { $match: { vendorId: { $in: [vendorId, String(vendorId)] }, status: { $in: ["Approved", "Paid"] } } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]);

    const totalApproved = categoryTotalsAgg.reduce((sum, c) => sum + c.total, 0);

    return res.json({
      success: true,
      expenses,
      totalCount,
      totalApproved,
      categoryTotals: categoryTotalsAgg,
      page: Number(page),
      pages: Math.ceil(totalCount / Number(limit)) || 1,
    });
  } catch (err) {
    console.error("getVendorExpenses error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load expenses" });
  }
}

export async function createVendorExpense(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const {
      title,
      category,
      amount,
      expenseDate,
      farmerVendorId,
      deliveryManagerId,
      orderId,
      paymentMethod,
      paidBy,
      notes,
      receiptUrl,
      status,
    } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ success: false, message: "Title and amount are required" });
    }

    const expense = await VendorExpense.create({
      vendorId: String(vendorId),
      title: String(title).trim(),
      category: category || "Operational Expenses",
      amount: Number(amount),
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      farmerVendorId: farmerVendorId || "",
      deliveryManagerId: deliveryManagerId && mongoose.isValidObjectId(deliveryManagerId) ? deliveryManagerId : null,
      orderId: orderId || "",
      paymentMethod: paymentMethod || "Bank Transfer",
      paidBy: paidBy || "",
      notes: notes || "",
      receiptUrl: receiptUrl || "",
      status: status || "Approved",
      approvedBy: req.user?.name || "Vendor",
      approvedAt: new Date(),
    });

    return res.status(201).json({ success: true, expense });
  } catch (err) {
    console.error("createVendorExpense error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create expense" });
  }
}

export async function updateVendorExpense(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const { id } = req.params;

    const expense = await VendorExpense.findOneAndUpdate(
      { _id: id, vendorId: { $in: [vendorId, String(vendorId)] } },
      { $set: req.body },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    return res.json({ success: true, expense });
  } catch (err) {
    console.error("updateVendorExpense error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to update expense" });
  }
}

export async function deleteVendorExpense(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const { id } = req.params;

    const result = await VendorExpense.findOneAndDelete({
      _id: id,
      vendorId: { $in: [vendorId, String(vendorId)] },
    });

    if (!result) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    return res.json({ success: true, message: "Expense deleted successfully" });
  } catch (err) {
    console.error("deleteVendorExpense error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to delete expense" });
  }
}

// ── 7. GET /api/vendor/finance/profit-loss ─────────────────────
export async function getVendorProfitLoss(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const { preset = "last30", startDate, endDate, storeId } = req.query;

    const data = await calculateVendorFinancials({
      vendorId,
      preset,
      startDate,
      endDate,
      storeId,
    });

    // Breakdown of Vendor Expenses by Category
    const vendorExpAgg = await VendorExpense.aggregate([
      {
        $match: {
          vendorId: { $in: [data.vendor.id, String(vendorId)] },
          status: { $in: ["Approved", "Paid"] },
          ...(data.period.startDate && data.period.endDate
            ? { expenseDate: { $gte: data.period.startDate, $lte: data.period.endDate } }
            : {}),
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const expenseBreakdown = {};
    vendorExpAgg.forEach((e) => {
      expenseBreakdown[e._id] = e.total;
    });

    return res.json({
      success: true,
      ...data,
      expenseBreakdown,
    });
  } catch (err) {
    console.error("getVendorProfitLoss error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load profit & loss statement" });
  }
}

// ── 8. GET & CRUD /api/vendor/finance/settlements ──────────────
export async function getVendorSettlements(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const { settlementType, status, page = 1, limit = 20 } = req.query;

    const query = { vendorId: { $in: [vendorId, String(vendorId)] } };
    if (settlementType && settlementType !== "ALL") {
      query.settlementType = settlementType;
    }
    if (status && status !== "ALL") {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const totalCount = await VendorSettlement.countDocuments(query);
    const settlements = await VendorSettlement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      settlements,
      totalCount,
      page: Number(page),
      pages: Math.ceil(totalCount / Number(limit)) || 1,
    });
  } catch (err) {
    console.error("getVendorSettlements error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load settlements" });
  }
}

export async function createVendorSettlement(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const {
      settlementType,
      entityId,
      entityName,
      periodFrom,
      periodTo,
      grossAmount,
      commission,
      deductions,
      paymentMethod,
      notes,
    } = req.body;

    if (!entityName || !periodFrom || !periodTo || grossAmount === undefined) {
      return res.status(400).json({ success: false, message: "Missing required settlement fields" });
    }

    const fromDate = new Date(periodFrom);
    const toDate = new Date(periodTo);

    // Prevent duplicate settlements for same entity and overlapping period
    const existing = await VendorSettlement.findOne({
      vendorId: { $in: [vendorId, String(vendorId)] },
      settlementType,
      entityId: entityId || "",
      status: { $ne: "Cancelled" },
      $or: [
        { "period.from": { $lte: toDate }, "period.to": { $gte: fromDate } },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `An active settlement (${existing.settlementNumber}) already exists for this entity in this period.`,
      });
    }

    const finalPayable = Math.max(0, Number(grossAmount) - Number(commission || 0) - Number(deductions || 0));
    const settlementNumber = `VSET-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const settlement = await VendorSettlement.create({
      vendorId: String(vendorId),
      settlementNumber,
      settlementType: settlementType || "farmer_vendor",
      entityId: entityId || "",
      entityName: String(entityName).trim(),
      period: { from: fromDate, to: toDate },
      grossAmount: Number(grossAmount),
      commission: Number(commission || 0),
      deductions: Number(deductions || 0),
      finalPayable,
      paidAmount: 0,
      remainingBalance: finalPayable,
      paymentMethod: paymentMethod || "Bank Transfer",
      status: "Pending",
      notes: notes || "",
      approvedBy: req.user?.name || "Vendor",
    });

    return res.status(201).json({ success: true, settlement });
  } catch (err) {
    console.error("createVendorSettlement error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create settlement" });
  }
}

export async function recordSettlementPayment(req, res) {
  try {
    const vendorId = getAuthenticatedVendorId(req);
    const { id } = req.params;
    const { amount, transactionReference, paymentMethod, notes } = req.body;

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid payment amount is required" });
    }

    const settlement = await VendorSettlement.findOne({
      _id: id,
      vendorId: { $in: [vendorId, String(vendorId)] },
    });

    if (!settlement) {
      return res.status(404).json({ success: false, message: "Settlement not found" });
    }

    const newPaidAmount = settlement.paidAmount + payAmount;
    const newRemainingBalance = Math.max(0, settlement.finalPayable - newPaidAmount);
    const newStatus = newRemainingBalance === 0 ? "Paid" : "Partially Paid";

    settlement.paidAmount = newPaidAmount;
    settlement.remainingBalance = newRemainingBalance;
    settlement.status = newStatus;
    if (transactionReference) settlement.transactionReference = transactionReference;
    if (paymentMethod) settlement.paymentMethod = paymentMethod;

    settlement.history.push({
      amount: payAmount,
      paidAt: new Date(),
      reference: transactionReference || "",
      method: paymentMethod || settlement.paymentMethod,
      notes: notes || "",
    });

    await settlement.save();

    return res.json({ success: true, settlement });
  } catch (err) {
    console.error("recordSettlementPayment error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to record payment" });
  }
}

