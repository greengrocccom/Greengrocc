import DeliverySettlement from "../models/DeliverySettlement.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import StoreOrder from "../models/StoreOrder.js";
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

// ── GET /api/delivery-managers/settlements ──────────────────────
export async function listSettlements(req, res) {
  try {
    const managerId = getManagerId(req);
    if (!managerId) {
      return res.status(401).json({ success: false, message: "Unauthorized delivery manager" });
    }

    const {
      preset,
      startDate,
      endDate,
      type,
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = "settlementDate",
      sortDir = "desc",
    } = req.query;

    const managerMatch = getManagerMatch(req);
    const query = { managerId: managerMatch };

    const dateRange = buildDateMatch(preset, startDate, endDate);
    if (dateRange) {
      query.settlementDate = dateRange;
    }

    if (type && type !== "ALL") {
      query.settlementType = type;
    }

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim(), "i");
      query.$or = [
        { settlementNumber: regex },
        { entityName: regex },
        { transactionReference: regex },
        { notes: regex },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const sortOrder = sortDir === "asc" ? 1 : -1;

    const [rows, total] = await Promise.all([
      DeliverySettlement.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      DeliverySettlement.countDocuments(query),
    ]);

    // Summary Totals
    const summaryAgg = await DeliverySettlement.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalPayable: { $sum: "$finalPayable" },
          totalPaid: { $sum: "$paidAmount" },
          totalPending: {
            $sum: {
              $cond: [{ $in: ["$status", ["Pending", "Processing", "Partially Paid"]] }, "$remainingBalance", 0],
            },
          },
        },
      },
    ]);

    const summary = summaryAgg[0] || {
      totalPayable: 0,
      totalPaid: 0,
      totalPending: 0,
    };

    return res.json({
      success: true,
      data: rows,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      summary,
    });
  } catch (err) {
    console.error("listSettlements error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to list settlements" });
  }
}

// ── POST /api/delivery-managers/settlements ─────────────────────
export async function createSettlement(req, res) {
  try {
    const managerId = getManagerId(req);
    if (!managerId) {
      return res.status(401).json({ success: false, message: "Unauthorized delivery manager" });
    }

    const {
      settlementType,
      entityName,
      entityId,
      periodStart,
      periodEnd,
      ordersCount = 0,
      grossAmount = 0,
      incentives = 0,
      allowances = 0,
      deductions = 0,
      advances = 0,
      paidAmount = 0,
      paymentMethod = "BANK_TRANSFER",
      transactionReference,
      notes,
      status = "Pending",
    } = req.body;

    if (!settlementType || !entityName || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Settlement type, entity name, and date period are required",
      });
    }

    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);

    // Prevent duplicate settlements for the same entity and settlement period
    if (entityId) {
      const existing = await DeliverySettlement.findOne({
        managerId,
        entityId,
        settlementType,
        periodStart: { $lte: pEnd },
        periodEnd: { $gte: pStart },
        status: { $ne: "Cancelled" },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `A settlement record (${existing.settlementNumber}) already exists for ${entityName} overlapping this period (${new Date(existing.periodStart).toLocaleDateString("en-IN")} to ${new Date(existing.periodEnd).toLocaleDateString("en-IN")}). Duplicate settlements are prevented.`,
        });
      }
    }

    // Mathematical payout formula
    const finalPayable = Math.max(
      0,
      Number(grossAmount || 0) +
        Number(incentives || 0) +
        Number(allowances || 0) -
        Number(deductions || 0) -
        Number(advances || 0)
    );

    const paid = Number(paidAmount || 0);
    const remainingBalance = Math.max(0, finalPayable - paid);

    let resolvedStatus = status;
    if (paid >= finalPayable && finalPayable > 0) {
      resolvedStatus = "Paid";
    } else if (paid > 0 && paid < finalPayable) {
      resolvedStatus = "Partially Paid";
    }

    // Generate unique settlement number: SET-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
    const settlementNumber = `SET-${dateStr}-${randomHex}`;

    const settlement = await DeliverySettlement.create({
      managerId,
      settlementNumber,
      settlementType,
      entityName: String(entityName).trim(),
      entityId: entityId || null,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      ordersCount: Number(ordersCount || 0),
      grossAmount: Number(grossAmount || 0),
      incentives: Number(incentives || 0),
      allowances: Number(allowances || 0),
      deductions: Number(deductions || 0),
      advances: Number(advances || 0),
      finalPayable,
      paidAmount: paid,
      remainingBalance,
      paymentMethod,
      transactionReference: String(transactionReference || "").trim(),
      settlementDate: now,
      status: resolvedStatus,
      notes: String(notes || "").trim(),
      processedBy: managerId,
      processedByName: req.manager?.name || "Delivery Manager",
    });

    return res.status(201).json({
      success: true,
      message: "Settlement record created successfully",
      data: settlement,
    });
  } catch (err) {
    console.error("createSettlement error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create settlement" });
  }
}

// ── PUT /api/delivery-managers/settlements/:id ──────────────────
export async function updateSettlement(req, res) {
  try {
    const managerId = getManagerId(req);
    const { id } = req.params;

    const settlement = await DeliverySettlement.findOne({ _id: id, managerId });
    if (!settlement) {
      return res.status(404).json({ success: false, message: "Settlement record not found" });
    }

    const {
      paidAmount,
      status,
      paymentMethod,
      transactionReference,
      notes,
    } = req.body;

    if (paidAmount !== undefined) {
      settlement.paidAmount = Number(paidAmount);
      settlement.remainingBalance = Math.max(0, settlement.finalPayable - Number(paidAmount));
      if (settlement.paidAmount >= settlement.finalPayable && settlement.finalPayable > 0) {
        settlement.status = "Paid";
      } else if (settlement.paidAmount > 0 && settlement.paidAmount < settlement.finalPayable) {
        settlement.status = "Partially Paid";
      }
    }

    if (status !== undefined) settlement.status = status;
    if (paymentMethod !== undefined) settlement.paymentMethod = paymentMethod;
    if (transactionReference !== undefined)
      settlement.transactionReference = String(transactionReference).trim();
    if (notes !== undefined) settlement.notes = String(notes).trim();

    await settlement.save();

    return res.json({
      success: true,
      message: "Settlement updated successfully",
      data: settlement,
    });
  } catch (err) {
    console.error("updateSettlement error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to update settlement" });
  }
}

// ── GET /api/delivery-managers/settlements/calculate-rider ──────
export async function calculateRiderPayable(req, res) {
  try {
    const managerId = getManagerId(req);
    const { riderId, startDate, endDate } = req.query;

    if (!riderId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "riderId, startDate and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const [ordersAgg, rider] = await Promise.all([
      StoreOrder.aggregate([
        {
          $match: {
            managerId: getManagerMatch(req),
            assignedRiderId: toObjectId(riderId) ? { $in: [toObjectId(riderId), String(riderId)] } : riderId,
            status: "delivered",
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            earnings: { $sum: { $ifNull: ["$riderDeliveryEarning", 0] } },
          },
        },
      ]),
      DeliveryBoy.findById(riderId).select("name phone employmentType monthlySalary").lean(),
    ]);

    const count = ordersAgg[0]?.count || 0;
    const deliveryEarnings = ordersAgg[0]?.earnings || 0;

    // Check prior settlements for this rider overlapping this period to prevent double payment
    const priorSettlements = await DeliverySettlement.find({
      managerId,
      entityId: riderId,
      settlementType: "RIDER_PAYOUT",
      periodStart: { $lte: end },
      periodEnd: { $gte: start },
      status: { $ne: "Cancelled" },
    }).lean();

    const alreadySettledOrders = priorSettlements.reduce((sum, s) => sum + (s.ordersCount || 0), 0);
    const alreadySettledAmount = priorSettlements.reduce((sum, s) => sum + (s.paidAmount || s.finalPayable || 0), 0);

    return res.json({
      success: true,
      rider: {
        id: rider?._id,
        name: rider?.name || rider?.phone || "Rider",
        employmentType: rider?.employmentType || "part_time",
      },
      ordersCount: Math.max(0, count - alreadySettledOrders),
      grossDeliveryEarnings: Math.max(0, deliveryEarnings - alreadySettledAmount),
      priorSettlementCount: priorSettlements.length,
      alreadySettledAmount,
    });
  } catch (err) {
    console.error("calculateRiderPayable error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to calculate rider payable" });
  }
}

