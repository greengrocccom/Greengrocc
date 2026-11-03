import StoreOrder from "../models/StoreOrder.js";
import DeliveryExpense from "../models/DeliveryExpense.js";
import { getManagerId, getManagerMatch, toObjectId } from "./managerExpenseController.js";

const parseIstDate = (val, endOfDay = false) => {
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

const buildDateMatch = (preset, startDate, endDate) => {
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
      if (startDate) from = parseIstDate(startDate, false);
      if (endDate) to = parseIstDate(endDate, true);
      break;
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

// ── GET /api/delivery-managers/profit-loss ──────────────────────
export async function getProfitLoss(req, res) {
  try {
    const managerId = getManagerId(req);
    if (!managerId) {
      return res.status(401).json({ success: false, message: "Unauthorized delivery manager" });
    }
    const managerMatch = getManagerMatch(req);

    const { preset = "today", startDate, endDate } = req.query;

    const orderQuery = { managerId: managerMatch, status: "delivered" };
    const expenseQuery = { managerId: managerMatch, status: { $in: ["Approved", "Paid"] } };

    const dateRange = buildDateMatch(preset, startDate, endDate);
    if (dateRange) {
      orderQuery.createdAt = dateRange;
      expenseQuery.expenseDate = dateRange;
    }

    // Orders Aggregation for Revenue & Rider Payouts
    const [ordersAgg] = await StoreOrder.aggregate([
      { $match: orderQuery },
      {
        $group: {
          _id: null,
          completedOrders: { $sum: 1 },
          // Total items sales
          grossProductSales: {
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
          // Customer Paid total
          customerPaymentTotal: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ["$partTotal", 0] }, 0] },
                "$partTotal",
                { $ifNull: ["$amountToCollect", 0] },
              ],
            },
          },
          // Total delivery distance
          totalKm: { $sum: { $ifNull: ["$deliveryDistanceKm", 0] } },
          // Total direct rider delivery payouts
          riderDeliveryPayouts: { $sum: { $ifNull: ["$riderDeliveryEarning", 0] } },
          // Total refunds
          totalRefunds: { $sum: { $ifNull: ["$refundDue", 0] } },
        },
      },
    ]);

    const ord = ordersAgg || {
      completedOrders: 0,
      grossProductSales: 0,
      customerPaymentTotal: 0,
      totalKm: 0,
      riderDeliveryPayouts: 0,
      totalRefunds: 0,
    };

    // Calculate Delivery Revenue:
    // Recognized as customer delivery charges (customerPaid - productSales) or base per-order delivery fee
    const calculatedDeliveryCharges = Math.max(
      0,
      ord.customerPaymentTotal - ord.grossProductSales
    );
    // Baseline darkstore handling + delivery income (min ₹35 per fulfilled delivery order)
    const recognizedDeliveryRevenue = Math.max(
      calculatedDeliveryCharges,
      ord.completedOrders * 35
    );

    // Expenses Aggregation by Category
    const expensesByCategory = await DeliveryExpense.aggregate([
      { $match: expenseQuery },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const expenseMap = {};
    let totalOperatingExpenses = 0;
    expensesByCategory.forEach((item) => {
      expenseMap[item._id] = item.total;
      totalOperatingExpenses += item.total;
    });

    const deliveryExpenses =
      (expenseMap["Delivery Expenses"] || 0) + ord.riderDeliveryPayouts;
    const storeExpenses = expenseMap["Store Expenses"] || 0;
    const packagingExpenses = expenseMap["Packaging Expenses"] || 0;
    const technologyExpenses = expenseMap["Technology Expenses"] || 0;
    const otherExpenses = expenseMap["Other Expenses"] || 0;

    const allExpensesTotal =
      deliveryExpenses +
      storeExpenses +
      packagingExpenses +
      technologyExpenses +
      otherExpenses;

    // Delivery Manager Operating Profit:
    // Recognized Delivery Revenue - Delivery Expenses (Riders, Fuel, Maintenance)
    const deliveryOperatingProfit = recognizedDeliveryRevenue - deliveryExpenses;

    // Net Profit for Delivery Operations:
    // Recognized Delivery Revenue - Total All Expenses
    const netProfit = recognizedDeliveryRevenue - allExpensesTotal;

    // Operational Product Sales Handled (Tracked separately, not conflated with delivery revenue)
    const netProductSales = Math.max(0, ord.grossProductSales - ord.totalRefunds);

    return res.json({
      success: true,
      period: preset,
      metrics: {
        completedOrders: ord.completedOrders,
        totalKmCovered: Math.round(ord.totalKm * 10) / 10,
        // Product Sales Handled
        grossProductSales: ord.grossProductSales,
        refunds: ord.totalRefunds,
        netProductSalesHandled: netProductSales,
        // Delivery Revenue Recognized
        customerDeliveryCharges: calculatedDeliveryCharges,
        recognizedDeliveryRevenue,
        // Operating Expenses
        deliveryExpenses,
        riderDeliveryPayouts: ord.riderDeliveryPayouts,
        recordedDeliveryExpenses: expenseMap["Delivery Expenses"] || 0,
        storeExpenses,
        packagingExpenses,
        technologyExpenses,
        otherExpenses,
        totalOperatingExpenses: allExpensesTotal,
        // Profits
        deliveryOperatingProfit,
        netProfit,
        netProfitMargin:
          recognizedDeliveryRevenue > 0
            ? Math.round((netProfit / recognizedDeliveryRevenue) * 1000) / 10
            : 0,
      },
    });
  } catch (err) {
    console.error("getProfitLoss error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to calculate profit & loss" });
  }
}

