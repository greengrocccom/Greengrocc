import mongoose from "mongoose";
import DeliveryManager from "../../../delivery-service/src/models/DeliveryManager.js";
import StoreOrder from "../../../delivery-service/src/models/StoreOrder.js";
import DeliveryExpense from "../../../delivery-service/src/models/DeliveryExpense.js";
import DeliverySettlement from "../../../delivery-service/src/models/DeliverySettlement.js";
import { Vendor, Farmer, FarmerOrder, FarmerEarning } from "../models.js";
import { VendorCommissionPayment } from "../../../admin-ops-service/src/models.js";
import VendorExpense from "../models/VendorExpense.js";
import VendorSettlement from "../models/VendorSettlement.js";

// Helper for IST Date Parsing & Filtering
export const parseIstDate = (val, endOfDay = false) => {
  if (!val) return null;
  const s = String(val).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = s.slice(0, 10);
  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  return new Date(`${iso}T${time}+05:30`);
};

export const buildDateRange = (preset, startDate, endDate) => {
  const offsetMs = 330 * 60 * 1000;
  const now = new Date();
  const istNow = new Date(now.getTime() + offsetMs);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();

  const startOfIstDay = (year, month, day) => new Date(Date.UTC(year, month, day) - offsetMs);
  const endOfIstDay = (year, month, day) =>
    new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - offsetMs);

  let from = null;
  let to = null;

  switch (preset) {
    case "today":
      from = startOfIstDay(y, m, d);
      to = endOfIstDay(y, m, d);
      break;
    case "yesterday":
      from = startOfIstDay(y, m, d - 1);
      to = endOfIstDay(y, m, d - 1);
      break;
    case "last7":
      from = startOfIstDay(y, m, d - 6);
      to = endOfIstDay(y, m, d);
      break;
    case "last15":
      from = startOfIstDay(y, m, d - 14);
      to = endOfIstDay(y, m, d);
      break;
    case "last30":
      from = startOfIstDay(y, m, d - 29);
      to = endOfIstDay(y, m, d);
      break;
    case "thisMonth":
      from = startOfIstDay(y, m, 1);
      to = endOfIstDay(y, m, d);
      break;
    case "lastMonth": {
      const lastMonthDate = new Date(Date.UTC(y, m, 0));
      const lmY = lastMonthDate.getUTCFullYear();
      const lmM = lastMonthDate.getUTCMonth();
      const lmLastDay = lastMonthDate.getUTCDate();
      from = startOfIstDay(lmY, lmM, 1);
      to = endOfIstDay(lmY, lmM, lmLastDay);
      break;
    }
    case "thisYear":
      from = startOfIstDay(y, 0, 1);
      to = endOfIstDay(y, m, d);
      break;
    case "all":
      from = null;
      to = null;
      break;
    case "custom":
    default:
      if (startDate) from = parseIstDate(startDate, false);
      if (endDate) to = parseIstDate(endDate, true);
      break;
  }

  const match = {};
  if (from && to) {
    match.$gte = from;
    match.$lte = to;
  } else if (from) {
    match.$gte = from;
  } else if (to) {
    match.$lte = to;
  }
  return Object.keys(match).length ? match : null;
};

/**
 * Centralized Vendor Financial Calculation Engine
 * Reusable across Dashboard, Sales Reports, P&L, Farmer Payments, and Settlements.
 */
export async function calculateVendorFinancials({
  vendorId,
  preset = "last30",
  startDate,
  endDate,
  storeId,
}) {
  if (!vendorId) {
    throw new Error("vendorId is required for financial calculation");
  }

  // 1. Fetch Vendor Profile for commissionRate and status
  const vendor = await Vendor.findOne({
    $or: [{ id: vendorId }, { _id: mongoose.isValidObjectId(vendorId) ? vendorId : null }].filter(
      Boolean
    ),
  }).lean();

  if (!vendor) {
    throw new Error("Vendor account not found");
  }

  const commissionRate = Number(vendor.commissionRate || 10);
  const dateMatch = buildDateRange(preset, startDate, endDate);

  // 2. Fetch all Dark Stores belonging to this Vendor
  const isPrimaryVendor = vendor.id === "vendor-1";
  const vendorMatchIds = [vendor.id, String(vendor._id)].filter(Boolean);
  const activeStoreFilter = {
    $or: [
      { vendorId: { $in: vendorMatchIds } },
      ...(isPrimaryVendor ? [{ vendorId: "" }, { vendorId: null }, { vendorId: { $exists: false } }] : []),
    ],
    isDeleted: { $ne: true },
    deleted: { $ne: true },
    status: { $nin: ["deleted", "DELETED"] },
  };

  if (storeId && storeId !== "ALL" && storeId !== "all") {
    if (mongoose.isValidObjectId(storeId)) {
      activeStoreFilter._id = new mongoose.Types.ObjectId(storeId);
    }
  }

  const darkStores = await DeliveryManager.find(activeStoreFilter)
    .select("_id storeName name area city pincode mobile")
    .lean();

  const darkStoreIds = darkStores.map((s) => s._id);

  // 3. Aggregate Store Orders across Dark Stores
  const orderMatch = {
    managerId: { $in: darkStoreIds },
    isDeleted: { $ne: true },
  };
  if (dateMatch) {
    orderMatch.createdAt = dateMatch;
  }

  const [orderKpis] = await StoreOrder.aggregate([
    { $match: orderMatch },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        completedOrders: {
          $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
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
        // Eligible Product Sales (Excludes cancelled orders and excludes delivery charges)
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
        // Delivery Charges on non-cancelled orders
        totalDeliveryCharges: {
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
                      vars: {
                        diff: { $subtract: ["$$rawPaid", "$$itemsSum"] },
                      },
                      in: { $cond: [{ $gt: ["$$diff", 0] }, "$$diff", 0] },
                    },
                  },
                },
              },
              0,
            ],
          },
        },
        // Total customer payments collected on non-cancelled orders
        customerPaymentTotal: {
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
                      vars: {
                        diff: { $subtract: ["$$rawPaid", "$$itemsSum"] },
                      },
                      in: {
                        $add: [
                          "$$itemsSum",
                          { $cond: [{ $gt: ["$$diff", 0] }, "$$diff", 0] },
                        ],
                      },
                    },
                  },
                },
              },
              0,
            ],
          },
        },
        // Delivered sales (only completed delivered orders)
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
        totalRefunds: {
          $sum: { $ifNull: ["$refundDue", 0] },
        },
      },
    },
  ]) || {
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    cancelledOrdersCost: 0,
    grossProductSales: 0,
    totalDeliveryCharges: 0,
    customerPaymentTotal: 0,
    deliveredSales: 0,
    totalRefunds: 0,
  };

  const grossProductSales = orderKpis?.grossProductSales || 0;
  const deliveryCharges = orderKpis?.totalDeliveryCharges || 0;
  const customerPaymentTotal = orderKpis?.customerPaymentTotal || 0;
  const totalRefunds = orderKpis?.totalRefunds || 0;
  const netProductSales = Math.max(0, grossProductSales - totalRefunds);

  // 4. Admin Commission Calculation (Standardized formula)
  // Admin Commission = Total Eligible Product Sales * Vendor.commissionRate / 100
  const eligibleCommissionSales = grossProductSales;
  const adminCommission = Math.round((eligibleCommissionSales * commissionRate) / 100);

  // Reconcile Commission Paid from VendorCommissionPayment and VendorSettlement
  const commQuery = {
    vendorId: { $in: [vendor.id, String(vendor._id)] },
  };
  const [commPaymentAgg] = await VendorCommissionPayment.aggregate([
    { $match: commQuery },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const [settledCommAgg] = await VendorSettlement.aggregate([
    {
      $match: {
        vendorId: { $in: [vendor.id, String(vendor._id)] },
        settlementType: "admin_commission",
        status: "Paid",
      },
    },
    { $group: { _id: null, total: { $sum: "$paidAmount" } } },
  ]);

  const commissionPaid = (commPaymentAgg?.total || 0) + (settledCommAgg?.total || 0);
  const pendingCommission = Math.max(0, adminCommission - commissionPaid);

  // 5. Farmer Procurement Cost & Farmer Payables (Earning Statement Total: ORDER_COMPLETED or GRADE_CONFIRMED)
  const statementStatusMatch = {
    $or: [
      { status: { $in: ["GRADE_CONFIRMED", "ORDER_COMPLETED", "grade_confirmed", "order_completed"] } },
      { qualityStatus: { $in: ["GRADE_CONFIRMED", "ORDER_COMPLETED"] } },
    ],
  };

  // Sourced orders matching Earning Statement across all time for this vendor
  const allStatementOrders = await FarmerOrder.find({
    vendorId: { $in: [vendor.id, String(vendor._id)] },
    ...statementStatusMatch,
  }).lean();

  const computeStatementOrderAmt = (o) => {
    const grades = Array.isArray(o.finalStatement) && o.finalStatement.length
      ? o.finalStatement
      : Array.isArray(o.grades) && o.grades.length
        ? o.grades
        : [];
    let amt = 0;
    if (grades.length > 0) {
      const gTot = grades.reduce((sum, g) => {
        const q = Number(g.quantity || 0);
        const r = Number(g.rate ?? g.price ?? 0);
        const a = Number(g.amount || 0);
        return sum + (a > 0 ? a : q * r);
      }, 0);
      if (gTot > 0) amt = gTot;
    }
    if (!amt) {
      amt = Number(o.orderValue || o.totalAmount || (Number(o.orderedQuantity || 0) * Number(o.price || 0)) || 0);
    }
    return amt;
  };

  // If a date filter is applied, check for period statement orders; if none or all-time, use allStatementOrders
  let activeStatementOrders = allStatementOrders;
  if (dateMatch) {
    const periodOrders = allStatementOrders.filter((o) => {
      const d = o.createdAt ? new Date(o.createdAt) : null;
      if (!d) return false;
      if (dateMatch.$gte && d < dateMatch.$gte) return false;
      if (dateMatch.$lte && d > dateMatch.$lte) return false;
      return true;
    });
    if (periodOrders.length > 0) {
      activeStatementOrders = periodOrders;
    }
  }

  let totalFarmerProcurement = 0;
  let farmerPaidFromOrders = 0;

  activeStatementOrders.forEach((o) => {
    const amt = computeStatementOrderAmt(o);
    totalFarmerProcurement += amt;

    const payStatus = String(o.paymentStatus || "").toUpperCase();
    if (["PAID", "COMPLETED", "SETTLED"].includes(payStatus)) {
      farmerPaidFromOrders += amt;
    }
  });

  // Farmer settlements paid
  const [farmerSettledAgg] = await VendorSettlement.aggregate([
    {
      $match: {
        vendorId: { $in: [vendor.id, String(vendor._id)] },
        settlementType: "farmer_vendor",
        status: { $in: ["Paid", "Partially Paid"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$paidAmount" } } },
  ]);

  const farmerPaidAmount = farmerPaidFromOrders + (farmerSettledAgg?.total || 0);
  const farmerPendingPayables = Math.max(
    0,
    totalFarmerProcurement - farmerPaidAmount
  );

  // 6. Vendor's Own Operating Expenses (VendorExpense)
  const vendorExpQuery = {
    vendorId: { $in: [vendor.id, String(vendor._id)] },
    status: { $in: ["Approved", "Paid"] },
  };
  if (dateMatch) {
    vendorExpQuery.expenseDate = dateMatch;
  }

  const [vendorExpAgg] = await VendorExpense.aggregate([
    { $match: vendorExpQuery },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const vendorOperatingExpenses = vendorExpAgg?.total || 0;

  // 7. Dark Store / Delivery Manager Expenses (from DeliveryExpense)
  const storeExpQuery = {
    managerId: { $in: darkStoreIds },
    status: { $in: ["Approved", "Paid"] },
  };
  if (dateMatch) {
    storeExpQuery.expenseDate = dateMatch;
  }

  const [storeExpAgg] = await DeliveryExpense.aggregate([
    { $match: storeExpQuery },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const darkStoreExpenses = storeExpAgg?.total || 0;

  // Delivery Contribution of Dark Stores:
  const deliveryContribution = deliveryCharges - darkStoreExpenses;

  // 8. Vendor Profit & Loss Equations:
  // Standard Formula: NET PROFIT = TOTAL SALE - TOTAL PROCUREMENT VALUE - ADMIN COMMISSION - TOTAL VENDOR EXPENSES - DELIVERY MANAGER EXPENSES
  const grossProductProfit = Math.max(0, netProductSales - totalFarmerProcurement);
  const vendorOperatingProfit = grossProductProfit - adminCommission - vendorOperatingExpenses;
  const vendorNetProfit = totalSale - totalFarmerProcurement - adminCommission - vendorOperatingExpenses - darkStoreExpenses;

  // 9. Pending Settlements Total
  const [pendingSettlementAgg] = await VendorSettlement.aggregate([
    {
      $match: {
        vendorId: { $in: [vendor.id, String(vendor._id)] },
        status: { $in: ["Pending", "Processing", "Partially Paid"] },
      },
    },
    {
      $group: {
        _id: null,
        totalRemaining: {
          $sum: {
            $subtract: ["$finalPayable", { $ifNull: ["$paidAmount", 0] }],
          },
        },
      },
    },
  ]);
  const pendingSettlements = pendingSettlementAgg?.totalRemaining || 0;

  return {
    vendor: {
      id: vendor.id,
      name: vendor.ownerName || vendor.vendorName,
      vendorName: vendor.vendorName,
      commissionRate,
      status: vendor.status,
    },
    period: {
      preset,
      startDate: dateMatch?.$gte || null,
      endDate: dateMatch?.$lte || null,
    },
    darkStoresCount: darkStores.length,
    kpis: {
      totalOrders: orderKpis?.totalOrders || 0,
      completedOrders: orderKpis?.completedOrders || 0,
      cancelledOrders: orderKpis?.cancelledOrders || 0,
      cancelledOrdersCost: orderKpis?.cancelledOrdersCost || 0,
      grossProductSales,
      deliveryCharges,
      customerPaymentTotal,
      totalSale: grossProductSales + deliveryCharges,
      deliveredSales: orderKpis?.deliveredSales || 0,
      currentProfit: orderKpis?.deliveredSales || 0,
      netProductSales,
      refunds: totalRefunds,
      farmerProcurementCost: totalFarmerProcurement,
      farmerPaidAmount,
      farmerPendingPayables,
      adminCommission,
      commissionRate,
      commissionPaid,
      pendingCommission,
      vendorOperatingExpenses,
      darkStoreExpenses,
      totalExpense: darkStoreExpenses + vendorOperatingExpenses,
      deliveryContribution,
      grossProductProfit,
      operatingProfit: vendorOperatingProfit,
      netProfit: vendorNetProfit,
      pendingSettlements,
    },
  };
}
