import mongoose from "mongoose";
import { VendorCommissionPayment } from "./models.js";
import { Vendor, FarmerOrder, CollectionCentre } from "../../farmer-manager-service/src/models.js";
import VendorExpense from "../../farmer-manager-service/src/models/VendorExpense.js";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import StoreOrder from "../../delivery-service/src/models/StoreOrder.js";
import DeliveryExpense from "../../delivery-service/src/models/DeliveryExpense.js";

/**
 * Helper to build IST Date Range from preset or custom dates
 */
export function buildIstDateFilter(preset, startDate, endDate) {
  const now = new Date();
  // IST offset is UTC + 5h30m
  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(now.getTime() + istOffset);

  let start = null;
  let end = null;

  if (preset === "today") {
    const y = nowIst.getUTCFullYear();
    const m = String(nowIst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(nowIst.getUTCDate()).padStart(2, "0");
    start = new Date(`${y}-${m}-${d}T00:00:00.000+05:30`);
    end = new Date(`${y}-${m}-${d}T23:59:59.999+05:30`);
  } else if (preset === "week" || preset === "this_week") {
    // Last 7 days
    const past7 = new Date(nowIst.getTime() - 7 * 24 * 60 * 60 * 1000);
    const y = past7.getUTCFullYear();
    const m = String(past7.getUTCMonth() + 1).padStart(2, "0");
    const d = String(past7.getUTCDate()).padStart(2, "0");
    start = new Date(`${y}-${m}-${d}T00:00:00.000+05:30`);
    end = new Date(now.getTime());
  } else if (preset === "month" || preset === "this_month") {
    const y = nowIst.getUTCFullYear();
    const m = String(nowIst.getUTCMonth() + 1).padStart(2, "0");
    start = new Date(`${y}-${m}-01T00:00:00.000+05:30`);
    end = new Date(now.getTime());
  } else if (preset === "year" || preset === "this_year") {
    const y = nowIst.getUTCFullYear();
    start = new Date(`${y}-01-01T00:00:00.000+05:30`);
    end = new Date(now.getTime());
  } else if (startDate || endDate) {
    if (startDate) {
      const s = String(startDate).slice(0, 10);
      start = new Date(`${s}T00:00:00.000+05:30`);
    }
    if (endDate) {
      const e = String(endDate).slice(0, 10);
      end = new Date(`${e}T23:59:59.999+05:30`);
    }
  }

  if (start && end) return { $gte: start, $lte: end };
  if (start) return { $gte: start };
  if (end) return { $lte: end };
  return null;
}

/**
 * Centralized calculation service for an individual vendor's commission
 *
 * Formula:
 * Admin Commission = Eligible Product Sales × (Vendor Commission Rate / 100)
 *
 * Rules:
 * - Eligible Product Sales = sum of (item.price * item.quantity) on non-cancelled orders across all Dark Stores of this vendor
 * - Delivery charges excluded
 * - Cancelled orders excluded
 * - Rider payouts & delivery expenses excluded
 * - Farmer procurement & vendor expenses excluded
 * - Vendor commission rate from vendor.commissionRate
 */
export async function calculateVendorAdminCommission(vendorIdOrDoc, dateFilter = null) {
  let vendor = vendorIdOrDoc;
  if (!vendor || typeof vendor !== "object" || !vendor._id) {
    const vendorId = String(vendorIdOrDoc || "").trim();
    vendor = await Vendor.findOne({
      $or: [
        { id: vendorId },
        { _id: mongoose.isValidObjectId(vendorId) ? new mongoose.Types.ObjectId(vendorId) : null },
      ].filter(Boolean),
    }).lean();
  }

  if (!vendor) return null;

  const commissionRate = Number(vendor.commissionRate ?? 10);
  const isPrimaryVendor = vendor.id === "vendor-1";
  const vendorMatchIds = [vendor.id, String(vendor._id)].filter(Boolean);

  // 1. Dark Stores belonging to this Vendor
  const activeStoreFilter = {
    $or: [
      { vendorId: { $in: vendorMatchIds } },
      ...(isPrimaryVendor ? [{ vendorId: "" }, { vendorId: null }, { vendorId: { $exists: false } }] : []),
    ],
    isDeleted: { $ne: true },
    deleted: { $ne: true },
    status: { $nin: ["deleted", "DELETED"] },
  };

  const darkStores = await DeliveryManager.find(activeStoreFilter)
    .select("_id storeName name area city pincode mobile")
    .lean();

  const darkStoreIds = darkStores.map((s) => s._id);

  // Collection Centres belonging to this Vendor
  const collectionCentres = await CollectionCentre.find({
    vendorId: { $in: vendorMatchIds },
  }).lean();

  // 2. Aggregate Store Orders across Dark Stores
  const orderMatch = {
    managerId: { $in: darkStoreIds },
    isDeleted: { $ne: true },
  };
  if (dateFilter) {
    orderMatch.createdAt = dateFilter;
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
        // Customer payment total on non-cancelled orders
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
        // Eligible Product Sales: excludes cancelled orders, excludes delivery charges
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

  const grossProductSales = Number(orderKpis?.grossProductSales || 0);
  const deliveryCharges = Number(orderKpis?.totalDeliveryCharges || 0);
  const totalSale = grossProductSales + deliveryCharges;
  const eligibleCommissionSales = totalSale;
  const totalOrders = Number(orderKpis?.totalOrders || 0);
  const completedOrders = Number(orderKpis?.completedOrders || 0);
  const cancelledOrders = Number(orderKpis?.cancelledOrders || 0);
  const cancelledOrdersCost = Number(orderKpis?.cancelledOrdersCost || 0);
  const cancelledCostRaw = Number(orderKpis?.cancelledOrdersCost || 0);
  const customerPaymentTotal = Number(orderKpis?.customerPaymentTotal && Number(orderKpis.customerPaymentTotal) > totalSale ? orderKpis.customerPaymentTotal : totalSale + cancelledCostRaw);
  const deliveredSales = Number(orderKpis?.deliveredSales || 0);

  // 3. Central Admin Commission calculation on TOTAL SALE (10% of totalSale)
  const totalAdminCommission = Math.round((totalSale * commissionRate) / 100);

  // 4. Commission Payments from existing VendorCommissionPayment model
  const paymentQuery = {
    vendorId: { $in: vendorMatchIds },
  };

  const payments = await VendorCommissionPayment.find(paymentQuery)
    .sort({ paidAt: -1, createdAt: -1 })
    .lean();

  const commissionPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingCommission = Math.max(0, totalAdminCommission - commissionPaid);

  let lastPaymentDate = null;
  if (payments.length > 0 && payments[0].paidAt) {
    lastPaymentDate = payments[0].paidAt;
  }

  // Determine status: "Paid", "Partially Paid", "Pending"
  let commissionStatus = "Pending";
  if (totalAdminCommission === 0) {
    commissionStatus = "Paid";
  } else if (commissionPaid >= totalAdminCommission) {
    commissionStatus = "Paid";
  } else if (commissionPaid > 0) {
    commissionStatus = "Partially Paid";
  } else {
    commissionStatus = "Pending";
  }

  // 5. Farmer Procurement Cost for this vendor
  const statementStatusMatch = {
    $or: [
      { status: { $in: ["GRADE_CONFIRMED", "ORDER_COMPLETED", "grade_confirmed", "order_completed"] } },
      { qualityStatus: { $in: ["GRADE_CONFIRMED", "ORDER_COMPLETED"] } },
    ],
  };
  const farmerOrders = await FarmerOrder.find({
    vendorId: { $in: vendorMatchIds },
    ...statementStatusMatch,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  }).lean();

  let farmerProcurement = 0;
  for (const o of farmerOrders) {
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
    farmerProcurement += amt;
  }
  farmerProcurement = Math.round(farmerProcurement);

  // 6. Vendor & Dark Store Expenses for this vendor
  const vendorExpDocs = await VendorExpense.find({
    vendorId: { $in: vendorMatchIds },
    isDeleted: { $ne: true },
    ...(dateFilter ? { date: dateFilter } : {}),
  }).lean();
  const vendorExpenses = Math.round(vendorExpDocs.reduce((sum, e) => sum + Number(e.amount || 0), 0));

  const darkStoreExpDocs = await DeliveryExpense.find({
    managerId: { $in: darkStoreIds },
    isDeleted: { $ne: true },
    ...(dateFilter ? { expenseDate: dateFilter } : {}),
  }).lean();
  const darkStoreExpenses = Math.round(darkStoreExpDocs.reduce((sum, e) => sum + Number(e.amount || 0), 0));

  const combinedExpenses = vendorExpenses + darkStoreExpenses;
  const netProfit = totalSale - farmerProcurement - totalAdminCommission - combinedExpenses;
  const currentProfit = deliveredSales;

  return {
    vendor: {
      id: vendor.id,
      _id: String(vendor._id),
      name: vendor.vendorName || vendor.businessName || vendor.ownerName || "Unnamed Vendor",
      ownerName: vendor.ownerName || "",
      vendorName: vendor.vendorName || vendor.businessName || vendor.name || "",
      email: vendor.email || "",
      phone: vendor.mobile || vendor.phone || "",
      mobile: vendor.mobile || vendor.phone || "",
      city: vendor.city || "",
      state: vendor.state || "",
      pincode: vendor.pincode || "",
      businessAddress: vendor.businessAddress || "",
      businessName: vendor.businessName || "",
      location: [vendor.businessAddress, vendor.city, vendor.state].filter(Boolean).join(", ") || "—",
      zones: Array.isArray(vendor.zones) ? vendor.zones : [],
      vendorType: vendor.vendorType || "farmer",
      isAdminVendor: Boolean(vendor.isAdminVendor),
      commissionRate,
      isActive: vendor.isActive !== false,
      collectionCentre: collectionCentres[0] ? {
        id: collectionCentres[0].id,
        name: collectionCentres[0].name,
        city: collectionCentres[0].city,
        address: collectionCentres[0].address,
      } : null,
      collectionCentreId: collectionCentres[0]?.id || vendor.id,
    },
    collectionCentres: collectionCentres.map((c) => ({
      id: c.id,
      _id: String(c._id),
      name: c.name || "Collection Centre",
      city: c.city || "",
      address: c.address || "",
      contactMobile: c.contactMobile || "",
      stateCode: c.stateCode || "",
    })),
    collectionCentresCount: collectionCentres.length,
    darkStoresCount: darkStores.length,
    darkStores: darkStores.map((s) => ({
      _id: String(s._id),
      storeName: s.storeName || "Dark Store",
      name: s.name || "",
      area: s.area || "",
      city: s.city || "",
    })),
    customerPaymentTotal,
    cancelledOrdersCost,
    grossProductSales,
    deliveryCharges,
    totalSale,
    eligibleCommissionSales,
    isAdminVendor: Boolean(vendor.isAdminVendor),
    commissionRate,
    totalAdminCommission,
    commissionPaid,
    pendingCommission,
    commissionStatus,
    lastPaymentDate,
    totalOrders,
    completedOrders,
    cancelledOrders,
    deliveredSales,
    farmerProcurement,
    vendorExpenses,
    darkStoreExpenses,
    combinedExpenses,
    netProfit,
    currentProfit,
    paymentsCount: payments.length,
    payments,
  };
}

/**
 * Aggregates commissions across all active vendors for dashboard and vendor list
 */
export async function calculateAllVendorsCommission(dateFilter = null) {
  const vendors = await Vendor.find({ isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .lean();

  const results = [];
  let totalGrossProductSales = 0;
  let totalDeliveryCharges = 0;
  let totalSale = 0;
  let totalCustomerPaid = 0;
  let totalCancelledCost = 0;
  let totalOrders = 0;
  let completedOrders = 0;
  let cancelledOrders = 0;
  let totalEligibleCommissionSales = 0;
  let totalAdminCommission = 0;
  let totalCommissionReceived = 0;
  let totalPendingCommission = 0;
  let totalFarmerProcurement = 0;
  let totalVendorExp = 0;
  let totalDarkStoreExp = 0;
  let totalNetProfit = 0;
  let totalCurrentProfit = 0;
  let pendingVendorCount = 0;

  for (const v of vendors) {
    const calc = await calculateVendorAdminCommission(v, dateFilter);
    if (!calc) continue;
    results.push(calc);

    totalGrossProductSales += Number(calc.grossProductSales || 0);
    totalDeliveryCharges += Number(calc.deliveryCharges || 0);
    totalSale += Number(calc.totalSale || 0);
    totalCustomerPaid += Number(calc.customerPaymentTotal || 0);
    totalCancelledCost += Number(calc.cancelledOrdersCost || 0);
    totalOrders += Number(calc.totalOrders || 0);
    completedOrders += Number(calc.completedOrders || 0);
    cancelledOrders += Number(calc.cancelledOrders || 0);
    totalEligibleCommissionSales += Number(calc.eligibleCommissionSales || 0);
    totalAdminCommission += Number(calc.totalAdminCommission || 0);
    totalCommissionReceived += Number(calc.commissionPaid || 0);
    totalPendingCommission += Number(calc.pendingCommission || 0);
    totalFarmerProcurement += Number(calc.farmerProcurement || 0);
    totalVendorExp += Number(calc.vendorExpenses || 0);
    totalDarkStoreExp += Number(calc.darkStoreExpenses || 0);
    totalNetProfit += Number(calc.netProfit || 0);
    totalCurrentProfit += Number(calc.currentProfit || 0);

    if (calc.pendingCommission > 0) {
      pendingVendorCount += 1;
    }
  }

  return {
    vendors: results,
    totals: {
      totalCustomerPaid,
      totalCancelledCost,
      totalGrossProductSales,
      totalDeliveryCharges,
      totalSale,
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalEligibleCommissionSales,
      totalAdminCommission,
      totalCommissionReceived,
      totalPendingCommission,
      totalFarmerProcurement,
      totalVendorExpenses: totalVendorExp,
      totalDeliveryExpenses: totalDarkStoreExp,
      combinedExpenses: totalVendorExp + totalDarkStoreExp,
      totalNetProfit,
      totalCurrentProfit,
      totalVendorCount: vendors.length,
      pendingVendorCount,
    },
  };
}

/**
 * Returns Admin Finance Dashboard KPIs (including Farmer Procurement and Vendor Expenses)
 */
export async function getAdminFinanceDashboardData(dateFilter = null) {
  const allCommissions = await calculateAllVendorsCommission(dateFilter);

  // 1. Total Farmer Procurement Amount
  const farmerOrderMatch = {
    $or: [
      { status: { $in: ["GRADE_CONFIRMED", "ORDER_COMPLETED", "grade_confirmed", "order_completed"] } },
      { qualityStatus: { $in: ["GRADE_CONFIRMED", "ORDER_COMPLETED"] } },
    ],
  };
  if (dateFilter) {
    farmerOrderMatch.createdAt = dateFilter;
  }

  const farmerOrders = await FarmerOrder.find(farmerOrderMatch).lean();
  let totalFarmerProcurementAmount = 0;
  for (const o of farmerOrders) {
    const grades = Array.isArray(o.finalStatement) && o.finalStatement.length
      ? o.finalStatement
      : Array.isArray(o.grades) && o.grades.length
        ? o.grades
        : [];
    if (grades.length > 0) {
      const gTot = grades.reduce((sum, g) => sum + (Number(g.quantity || 0) * Number(g.rate ?? g.price ?? 0)), 0);
      totalFarmerProcurementAmount += gTot;
    } else {
      totalFarmerProcurementAmount += Number(o.totalAmount || o.orderTotal || 0);
    }
  }

  // 2. Total Vendor Expenses
  const vendorExpenseMatch = { isDeleted: { $ne: true } };
  if (dateFilter) {
    vendorExpenseMatch.date = dateFilter;
  }
  const vendorExpenses = await VendorExpense.find(vendorExpenseMatch).lean();
  const totalVendorExpenses = vendorExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // 3. Total Delivery / Dark Store Expenses
  const deliveryExpenseMatch = { isDeleted: { $ne: true } };
  if (dateFilter) {
    deliveryExpenseMatch.date = dateFilter;
  }
  const deliveryExpenses = await DeliveryExpense.find(deliveryExpenseMatch).lean();
  const totalDeliveryExpenses = deliveryExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // 4. Daily Sales & Orders Trend for Graphs
  const orderTrendMatch = { isDeleted: { $ne: true } };
  if (dateFilter) {
    orderTrendMatch.createdAt = dateFilter;
  }

  const rawDailyTrend = await StoreOrder.aggregate([
    { $match: orderTrendMatch },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" },
        },
        totalOrders: { $sum: 1 },
        deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
        cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        grossProductSales: {
          $sum: {
            $cond: [
              { $ne: ["$status", "cancelled"] },
              {
                $sum: {
                  $map: {
                    input: { $ifNull: ["$items", []] },
                    as: "it",
                    in: { $multiply: [{ $ifNull: ["$$it.price", 0] }, { $ifNull: ["$$it.quantity", 0] }] },
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
                          in: { $multiply: [{ $ifNull: ["$$it.price", 0] }, { $ifNull: ["$$it.quantity", 0] }] },
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
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const dailyTrend = rawDailyTrend.map((d) => {
    const gross = Number(d.grossProductSales || 0);
    const deliv = Number(d.deliveryCharges || 0);
    const totalSale = gross + deliv;
    const adminCommission = Math.round((totalSale * 10) / 100);
    return {
      date: d._id,
      label: d._id.slice(5),
      totalOrders: d.totalOrders,
      deliveredOrders: d.deliveredOrders,
      cancelledOrders: d.cancelledOrders,
      grossProductSales: gross,
      deliveryCharges: deliv,
      totalSale,
      adminCommission,
    };
  });

  // 5. Monthly Sales & Orders Trend for Graphs (महिनानिहाय ट्रेंड)
  const rawMonthlyTrend = await StoreOrder.aggregate([
    { $match: orderTrendMatch },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Kolkata" },
        },
        totalOrders: { $sum: 1 },
        deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
        cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        grossProductSales: {
          $sum: {
            $cond: [
              { $ne: ["$status", "cancelled"] },
              {
                $sum: {
                  $map: {
                    input: { $ifNull: ["$items", []] },
                    as: "it",
                    in: { $multiply: [{ $ifNull: ["$$it.price", 0] }, { $ifNull: ["$$it.quantity", 0] }] },
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
                          in: { $multiply: [{ $ifNull: ["$$it.price", 0] }, { $ifNull: ["$$it.quantity", 0] }] },
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
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const monthNames = {
    "01": { en: "Jan", mr: "जानेवारी" },
    "02": { en: "Feb", mr: "फेब्रुवारी" },
    "03": { en: "Mar", mr: "मार्च" },
    "04": { en: "Apr", mr: "एप्रिल" },
    "05": { en: "May", mr: "मे" },
    "06": { en: "Jun", mr: "जून" },
    "07": { en: "Jul", mr: "जुलै" },
    "08": { en: "Aug", mr: "ऑगस्ट" },
    "09": { en: "Sep", mr: "सप्टेंबर" },
    "10": { en: "Oct", mr: "ऑक्टोबर" },
    "11": { en: "Nov", mr: "नोव्हेंबर" },
    "12": { en: "Dec", mr: "डिसेंबर" },
  };

  const monthlyTrend = rawMonthlyTrend.map((m) => {
    const gross = Number(m.grossProductSales || 0);
    const deliv = Number(m.deliveryCharges || 0);
    const totalSale = gross + deliv;
    const adminCommission = Math.round((totalSale * 10) / 100);
    const [year, monthPart] = (m._id || "").split("-");
    const mInfo = monthNames[monthPart] || { en: monthPart, mr: monthPart };
    const label = `${mInfo.en} ${year}`;
    const labelMr = `${mInfo.mr} ${year}`;

    return {
      month: m._id,
      label,
      labelMr,
      year,
      monthNum: monthPart,
      totalOrders: m.totalOrders,
      deliveredOrders: m.deliveredOrders,
      cancelledOrders: m.cancelledOrders,
      grossProductSales: gross,
      deliveryCharges: deliv,
      totalSale,
      adminCommission,
    };
  });

  return {
    dailyTrend,
    monthlyTrend,
    kpis: {
      customerPaidTotal: allCommissions.totals.totalCustomerPaid,
      cancelledOrdersCost: allCommissions.totals.totalCancelledCost,
      grossProductSales: allCommissions.totals.totalGrossProductSales,
      deliveryCharges: allCommissions.totals.totalDeliveryCharges,
      totalSale: allCommissions.totals.totalSale,
      totalOrders: allCommissions.totals.totalOrders,
      completedOrders: allCommissions.totals.completedOrders,
      cancelledOrders: allCommissions.totals.cancelledOrders,
      eligibleCommissionSales: allCommissions.totals.totalEligibleCommissionSales,
      totalAdminCommission: allCommissions.totals.totalAdminCommission,
      commissionReceived: allCommissions.totals.totalCommissionReceived,
      pendingCommission: allCommissions.totals.totalPendingCommission,
      totalVendorCount: allCommissions.totals.totalVendorCount,
      vendorsWithPendingCommission: allCommissions.totals.pendingVendorCount,
      totalFarmerProcurementAmount: Math.round(totalFarmerProcurementAmount),
      totalVendorExpenses: Math.round(totalVendorExpenses),
      totalDeliveryExpenses: Math.round(totalDeliveryExpenses),
      combinedExpenses: Math.round(totalVendorExpenses + totalDeliveryExpenses),
      netProfit: allCommissions.totals.totalNetProfit,
      currentProfit: allCommissions.totals.totalCurrentProfit,
    },
    vendorsSummary: allCommissions.vendors.map((c) => ({
      vendorId: c.vendor.id,
      vendorDbId: c.vendor._id,
      vendorName: c.vendor.name,
      ownerName: c.vendor.ownerName,
      vendorType: c.vendor.vendorType,
      commissionRate: c.commissionRate,
      customerPaidTotal: c.customerPaymentTotal || 0,
      cancelledOrdersCost: c.cancelledOrdersCost || 0,
      totalOrders: c.totalOrders || 0,
      completedOrders: c.completedOrders || 0,
      cancelledOrders: c.cancelledOrders || 0,
      grossProductSales: c.grossProductSales,
      deliveryCharges: c.deliveryCharges || 0,
      totalSale: c.totalSale || c.grossProductSales,
      eligibleCommissionSales: c.eligibleCommissionSales,
      totalAdminCommission: c.totalAdminCommission,
      commissionPaid: c.commissionPaid,
      pendingCommission: c.pendingCommission,
      commissionStatus: c.commissionStatus,
      lastPaymentDate: c.lastPaymentDate,
      darkStoresCount: c.darkStores ? c.darkStores.length : 0,
      darkStores: c.darkStores || [],
      farmerProcurement: c.farmerProcurement || 0,
      vendorExpenses: c.vendorExpenses || 0,
      darkStoreExpenses: c.darkStoreExpenses || 0,
      combinedExpenses: c.combinedExpenses || 0,
      netProfit: c.netProfit || 0,
      currentProfit: c.currentProfit || 0,
      isAdminVendor: Boolean(c.vendor.isAdminVendor || c.isAdminVendor),
    })),
  };
}

/**
 * Record a commission payment with strict validation
 */
export async function recordVendorCommissionPayment({
  vendorId,
  amount,
  method = "Bank Transfer",
  reference = "",
  paidAt = new Date(),
  note = "",
}) {
  const cleanVendorId = String(vendorId || "").trim();
  if (!cleanVendorId) throw new Error("Vendor ID is required");

  const cleanAmount = Number(amount);
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    throw new Error("Payment amount must be greater than 0");
  }

  const cleanRef = String(reference || "").trim();
  if (cleanRef) {
    const exists = await VendorCommissionPayment.findOne({ reference: cleanRef });
    if (exists) {
      throw new Error(`A payment with transaction reference '${cleanRef}' already exists`);
    }
  }

  // Get current pending commission
  const currentCalc = await calculateVendorAdminCommission(cleanVendorId);
  if (!currentCalc) throw new Error("Vendor not found");

  if (cleanAmount > currentCalc.pendingCommission + 0.5) {
    throw new Error(
      `Payment amount (₹${cleanAmount}) exceeds the pending commission balance (₹${currentCalc.pendingCommission})`
    );
  }

  const payment = await VendorCommissionPayment.create({
    vendorId: currentCalc.vendor.id,
    amount: cleanAmount,
    method: String(method || "Bank Transfer").trim(),
    reference: cleanRef,
    paidAt: paidAt ? new Date(paidAt) : new Date(),
    note: String(note || "").trim(),
  });

  // Re-calculate after payment
  const updatedCalc = await calculateVendorAdminCommission(cleanVendorId);

  return {
    payment,
    pendingCommission: updatedCalc.pendingCommission,
    commissionPaid: updatedCalc.commissionPaid,
    commissionStatus: updatedCalc.commissionStatus,
  };
}

