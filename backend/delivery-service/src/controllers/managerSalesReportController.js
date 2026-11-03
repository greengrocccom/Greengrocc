import StoreOrder from "../models/StoreOrder.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
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

// ── GET /api/delivery-managers/sales-reports ────────────────────
export async function getSalesReports(req, res) {
  try {
    const managerId = getManagerId(req);
    if (!managerId) {
      return res.status(401).json({ success: false, message: "Unauthorized delivery manager" });
    }
    const managerMatch = getManagerMatch(req);

    const {
      preset,
      startDate,
      endDate,
      status,
      paymentMethod,
      riderId,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortDir = "desc",
    } = req.query;

    const query = { managerId: managerMatch };

    const dateRange = buildDateMatch(preset, startDate, endDate);
    if (dateRange) {
      query.createdAt = dateRange;
    }

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (paymentMethod && paymentMethod !== "ALL") {
      query.paymentMethod = paymentMethod;
    }

    if (riderId && riderId !== "ALL") {
      const rObj = toObjectId(riderId);
      query.assignedRiderId = rObj ? { $in: [rObj, String(riderId)] } : riderId;
    }

    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim(), "i");
      query.$or = [
        { orderNumber: regex },
        { customerName: regex },
        { customerPhone: regex },
        { customerAddress: regex },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const sortOrder = sortDir === "asc" ? 1 : -1;

    const [orders, totalOrdersCount] = await Promise.all([
      StoreOrder.find(query)
        .populate("assignedRiderId", "name phone")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      StoreOrder.countDocuments(query),
    ]);

    // Financial KPI aggregation on the filtered scope
    const kpiAgg = await StoreOrder.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          // Delivered Sales (Only delivered orders whose payment has arrived)
          deliveredSales: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
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
          deliveredProductSales: {
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
          deliveredDeliveryCharges: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
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
          // Gross Product Sales (total items sum)
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
          // Delivery Charges (diff between customer total and items total, exactly 0 if free)
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
          // Customer Paid Total = All orders billed before cancellations
          customerPaymentTotal: {
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
                    vars: {
                      diff: {
                        $cond: [
                          { $ne: ["$status", "cancelled"] },
                          { $subtract: ["$$rawPaid", "$$itemsSum"] },
                          0,
                        ],
                      },
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
          },
          // Refunds Due / Processed
          totalRefunds: {
            $sum: { $ifNull: ["$refundDue", 0] },
          },
        },
      },
    ]);

    const kpi = kpiAgg[0] || {
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      cancelledOrdersCost: 0,
      grossProductSales: 0,
      customerPaymentTotal: 0,
      totalRefunds: 0,
      totalDeliveryCharges: 0,
    };

    // Total Operating Expenses recorded for this manager in this time range
    const expenseQuery = { managerId: managerMatch, status: { $in: ["Approved", "Paid"] } };
    if (dateRange) {
      expenseQuery.expenseDate = dateRange;
    }
    const [expenseAgg] = await DeliveryExpense.aggregate([
      { $match: expenseQuery },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpense = expenseAgg?.total || 0;
    const grossProductSales = kpi.grossProductSales || 0;
    const deliveryCharges = kpi.totalDeliveryCharges || 0;
    const totalSale = grossProductSales + deliveryCharges;
    const netProfit = totalSale - totalExpense;
    const currentProfit = (kpi.deliveredSales || 0) - totalExpense;

    const netProductSales = Math.max(0, kpi.grossProductSales - kpi.totalRefunds);

    // Status Breakdown (Donut Chart data)
    const statusAgg = await StoreOrder.aggregate([
      { $match: query },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Payment Method Breakdown with Product Sales and Delivery Charges
    const paymentAgg = await StoreOrder.aggregate([
      { $match: { ...query, status: { $ne: "cancelled" } } },
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
                    vars: {
                      diff: { $subtract: ["$$rawPaid", "$$itemsSum"] },
                    },
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

    // Daily Sales Trend (Matches Gross Product Sales by date)
    const dailyTrendAgg = await StoreOrder.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata",
            },
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

    // Format orders row for report table
    const tableRows = orders.map((o) => {
      const itemsSum = (o.items || []).reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
        0
      );
      const rawPaid = Number(o.partTotal || o.amountToCollect || 0);
      const deliveryCharge = rawPaid > itemsSum ? rawPaid - itemsSum : 0;
      const customerPaid = itemsSum + deliveryCharge;

      return {
        _id: o._id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        deliveredAt: o.deliveredAt,
        customerName: o.customerName || "Customer",
        customerPhone: o.customerPhone,
        customerAddress: o.customerAddress,
        vendor: o.vendorStatus ? "Partner Vendor" : "Direct Store",
        deliveryBoy: o.assignedRiderId?.name || (o.assignedRiderId ? "Assigned Rider" : "Unassigned"),
        riderPhone: o.assignedRiderId?.phone || "",
        productSales: itemsSum,
        discount: 0,
        refund: Number(o.refundDue || 0),
        deliveryCharge,
        customerPaidAmount: customerPaid,
        status: o.status,
        paymentMethod: o.paymentMethod || "COD",
        paymentStatus: o.paymentStatus || (o.status === "delivered" ? "collected" : "pending"),
      };
    });

    return res.json({
      success: true,
      kpis: {
        totalOrders: kpi.totalOrders,
        completedOrders: kpi.completedOrders,
        cancelledOrders: kpi.cancelledOrders,
        customerPaymentTotal: kpi.customerPaymentTotal,
        cancelledOrdersCost: kpi.cancelledOrdersCost || 0,
        deliveryCharges: kpi.totalDeliveryCharges,
        grossProductSales: kpi.grossProductSales,
        totalSale,
        totalExpense,
        netProfit,
        currentProfit,
        deliveredOrders: kpi.completedOrders || 0,
        deliveredSales: kpi.deliveredSales || 0,
        deliveredProductSales: kpi.deliveredProductSales || 0,
        deliveredDeliveryCharges: kpi.deliveredDeliveryCharges || 0,
        discounts: 0,
        refunds: kpi.totalRefunds,
        netProductSales,
      },
      charts: {
        dailyTrend: dailyTrendAgg,
        statusBreakdown: statusAgg,
        paymentBreakdown: paymentAgg,
      },
      data: tableRows,
      total: totalOrdersCount,
      page: Number(page),
      pages: Math.ceil(totalOrdersCount / Number(limit)),
    });
  } catch (err) {
    console.error("getSalesReports error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load sales reports" });
  }
}

