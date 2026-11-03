import mongoose from "mongoose";
import DeliveryExpense from "../models/DeliveryExpense.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import StoreOrder from "../models/StoreOrder.js";

export const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
};

export const getManagerId = (req) =>
  req.manager?._id || req.manager?.id || req.user?._id || req.user?.id;

export const getManagerMatch = (req) => {
  const rawId = getManagerId(req);
  if (!rawId) return null;
  const objId = toObjectId(rawId);
  return objId ? { $in: [objId, String(rawId)] } : rawId;
};

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

// ── GET /api/delivery-managers/expenses ─────────────────────────
export async function listExpenses(req, res) {
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
      category,
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = "expenseDate",
      sortDir = "desc",
    } = req.query;

    const query = { managerId: managerMatch };

    const dateRange = buildDateMatch(preset, startDate, endDate);
    if (dateRange) {
      query.expenseDate = dateRange;
    }

    if (category && category !== "ALL") {
      query.category = category;
    }

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim(), "i");
      query.$or = [
        { expenseNumber: regex },
        { title: regex },
        { subCategory: regex },
        { payee: regex },
        { paidBy: regex },
        { riderName: regex },
        { orderNumber: regex },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const sortOrder = sortDir === "asc" ? 1 : -1;

    const [rows, total] = await Promise.all([
      DeliveryExpense.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      DeliveryExpense.countDocuments(query),
    ]);

    // Aggregate Summary by Category for the selected filter
    const summaryAgg = await DeliveryExpense.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          approvedAmount: {
            $sum: { $cond: [{ $in: ["$status", ["Approved", "Paid"]] }, "$amount", 0] },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalExpense = 0;
    let approvedExpense = 0;
    let pendingExpense = 0;
    const categoryTotals = {};

    summaryAgg.forEach((item) => {
      totalExpense += item.totalAmount;
      approvedExpense += item.approvedAmount;
      categoryTotals[item._id] = item.totalAmount;
    });

    const pendingAgg = await DeliveryExpense.aggregate([
      { $match: { ...query, status: "Pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    if (pendingAgg.length > 0) {
      pendingExpense = pendingAgg[0].total;
    }

    return res.json({
      success: true,
      data: rows,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      summary: {
        totalExpense,
        approvedExpense,
        pendingExpense,
        byCategory: categoryTotals,
      },
    });
  } catch (err) {
    console.error("listExpenses error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to list expenses" });
  }
}

// ── POST /api/delivery-managers/expenses ────────────────────────
export async function createExpense(req, res) {
  try {
    const managerId = getManagerId(req);
    if (!managerId) {
      return res.status(401).json({ success: false, message: "Unauthorized delivery manager" });
    }

    const {
      title,
      category,
      subCategory,
      amount,
      expenseDate,
      riderId,
      orderId,
      paymentMethod,
      paidBy,
      payee,
      receiptUrl,
      notes,
      status = "Approved",
    } = req.body;

    if (!title || !category || amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: "Title, category and amount are required",
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
    }

    let riderName = "";
    if (riderId) {
      const rider = await DeliveryBoy.findById(riderId).select("name phone").lean();
      if (rider) riderName = rider.name || rider.phone || "";
    }

    let orderNumber = "";
    if (orderId) {
      const order = await StoreOrder.findById(orderId).select("orderNumber").lean();
      if (order) orderNumber = order.orderNumber || "";
    }

    // Generate unique expense number: EXP-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
    const expenseNumber = `EXP-${dateStr}-${randomHex}`;

    const expDate = expenseDate ? new Date(expenseDate) : new Date();

    const expense = await DeliveryExpense.create({
      managerId,
      expenseNumber,
      title: String(title).trim(),
      category,
      subCategory: String(subCategory || "").trim(),
      amount: Number(amount),
      expenseDate: Number.isNaN(expDate.getTime()) ? new Date() : expDate,
      riderId: riderId || null,
      riderName,
      orderId: orderId || null,
      orderNumber,
      paymentMethod: paymentMethod || "CASH",
      paidBy: String(paidBy || req.manager?.name || "Delivery Manager").trim(),
      payee: String(payee || "").trim(),
      receiptUrl: String(receiptUrl || "").trim(),
      notes: String(notes || "").trim(),
      status: status || "Approved",
      approvedBy: status === "Approved" ? managerId : null,
      approvedByName: status === "Approved" ? req.manager?.name || "Delivery Manager" : "",
      approvedAt: status === "Approved" ? new Date() : null,
    });

    return res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      data: expense,
    });
  } catch (err) {
    console.error("createExpense error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create expense" });
  }
}

// ── PUT /api/delivery-managers/expenses/:id ─────────────────────
export async function updateExpense(req, res) {
  try {
    const managerId = getManagerId(req);
    const { id } = req.params;

    const expense = await DeliveryExpense.findOne({ _id: id, managerId });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense record not found" });
    }

    const {
      title,
      category,
      subCategory,
      amount,
      expenseDate,
      riderId,
      orderId,
      paymentMethod,
      paidBy,
      payee,
      receiptUrl,
      notes,
      status,
    } = req.body;

    if (title !== undefined) expense.title = String(title).trim();
    if (category !== undefined) expense.category = category;
    if (subCategory !== undefined) expense.subCategory = String(subCategory).trim();
    if (amount !== undefined && Number(amount) > 0) expense.amount = Number(amount);
    if (expenseDate) {
      const d = new Date(expenseDate);
      if (!Number.isNaN(d.getTime())) expense.expenseDate = d;
    }
    if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
    if (paidBy !== undefined) expense.paidBy = String(paidBy).trim();
    if (payee !== undefined) expense.payee = String(payee).trim();
    if (receiptUrl !== undefined) expense.receiptUrl = String(receiptUrl).trim();
    if (notes !== undefined) expense.notes = String(notes).trim();

    if (riderId !== undefined) {
      expense.riderId = riderId || null;
      if (riderId) {
        const rider = await DeliveryBoy.findById(riderId).select("name").lean();
        expense.riderName = rider?.name || "";
      } else {
        expense.riderName = "";
      }
    }

    if (orderId !== undefined) {
      expense.orderId = orderId || null;
      if (orderId) {
        const order = await StoreOrder.findById(orderId).select("orderNumber").lean();
        expense.orderNumber = order?.orderNumber || "";
      } else {
        expense.orderNumber = "";
      }
    }

    if (status !== undefined) {
      expense.status = status;
      if (status === "Approved") {
        expense.approvedBy = managerId;
        expense.approvedByName = req.manager?.name || "Delivery Manager";
        expense.approvedAt = new Date();
      }
    }

    await expense.save();

    return res.json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (err) {
    console.error("updateExpense error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to update expense" });
  }
}

// ── DELETE /api/delivery-managers/expenses/:id ──────────────────
export async function deleteExpense(req, res) {
  try {
    const managerId = getManagerId(req);
    const { id } = req.params;

    const result = await DeliveryExpense.findOneAndDelete({ _id: id, managerId });
    if (!result) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    return res.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (err) {
    console.error("deleteExpense error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to delete expense" });
  }
}

