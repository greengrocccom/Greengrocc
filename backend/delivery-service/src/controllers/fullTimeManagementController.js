import mongoose from "mongoose";
import DeliveryBoy from "../models/DeliveryBoy.js";
import StoreOrder from "../models/StoreOrder.js";
import FullTimeShift from "../models/FullTimeShift.js";
import FullTimeAttendance from "../models/FullTimeAttendance.js";
import { getIO } from "../../../socket.js";
import { getManager, riderQuery } from "./managerDashboardController.js";
import { syncCustomerOrderFromStore } from "../services/syncCustomerOrderFromStore.js";
import { timeToMinutes } from "../utils/shiftTimeHelper.js";
import {
  listIstDatesInMonth,
  liveOnlineMinutes,
  formatOnlineMinutes,
  ensureTodayOnlineTracking,
} from "../utils/onlineHoursHelper.js";
import {
  FULL_TIME_ACTIVE_ORDER_STATUSES,
  attendanceStatusFor,
  buildMonthPayroll,
  computeMonthPayroll,
  effectiveMonthlySalary,
  getActiveFullTimeRule,
  getDriverFullTimeShift,
  istDateString,
  istMonthString,
  resolveAttendanceRequirement,
  salarySource,
  serializeFullTimeShift,
} from "../services/fullTimeService.js";
import {
  notifyOrdersAssigned,
  notifyWalletCredited,
} from "../services/RiderNotificationService.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const badRequest = (res, message, extra = {}) =>
  res.status(400).json({ success: false, message, ...extra });

/** Accepts "17:30" or "05:30 PM"; returns "05:30 PM" or null when invalid. */
function normalizeTime(value) {
  const raw = String(value || "").trim();
  if (!/^\d{1,2}:[0-5]\d(\s?(AM|PM))?$/i.test(raw)) return null;
  const mins = timeToMinutes(raw);
  if (!Number.isFinite(mins) || mins < 0 || mins >= 24 * 60) return null;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function normalizeWorkingDays(value) {
  if (!Array.isArray(value)) return null;
  const days = [...new Set(value.map((d) => parseInt(d, 10)))].filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6
  );
  return days.sort((a, b) => a - b);
}

const lightDriver = (r) => ({
  id: r._id.toString(),
  name: r.name || "Rider",
  phone: r.phone,
  status: r.status,
  isActive: r.isActive !== false,
  vehicleType: r.vehicleType,
  employmentType: r.employmentType || "PART_TIME",
});

const orderSummary = (o) => ({
  id: o._id.toString(),
  orderNumber: o.orderNumber,
  status: o.status,
  assignmentStatus: o.assignmentStatus || "NONE",
  customerName: o.customerName,
  customerAddress: o.customerAddress,
  customerPhone: o.customerPhone,
  itemCount: (o.items || []).reduce((n, i) => n + Number(i.quantity || 0), 0),
  amountToCollect: Number(o.amountToCollect || 0),
  paymentMethod: o.paymentMethod,
  isPreOrder: Boolean(o.isPreOrder),
  preOrderDate: o.preOrderDate || "",
  preOrderSlot: o.preOrderSlot || "",
  packedAt: o.packedAt,
  assignedAt: o.assignedAt,
  deliveredAt: o.deliveredAt,
  assignedRiderId: o.assignedRiderId ? o.assignedRiderId.toString() : null,
  fullTimeDelivery: Boolean(o.fullTimeDelivery),
  fullTimeAssignedAt: o.fullTimeAssignedAt,
  pickupQrScanned: Boolean(o.pickupQrScanned || o.qrScannedAt),
  createdAt: o.createdAt,
});

async function findFullTimeDriver(manager, driverId) {
  if (!mongoose.isValidObjectId(driverId)) return null;
  return DeliveryBoy.findOne(
    riderQuery(manager, { _id: driverId, employmentType: "FULL_TIME" })
  );
}

/** Drivers listed on a shift must be Full-Time drivers of this store. */
async function validateShiftDriverIds(manager, driverIds) {
  if (!Array.isArray(driverIds)) return { ids: [] };
  const unique = [...new Set(driverIds.map(String).filter(Boolean))];
  if (unique.some((id) => !mongoose.isValidObjectId(id))) {
    return { error: "driverIds contains an invalid id" };
  }
  if (!unique.length) return { ids: [] };
  const found = await DeliveryBoy.find(
    riderQuery(manager, { _id: { $in: unique }, employmentType: "FULL_TIME" })
  ).select("_id");
  if (found.length !== unique.length) {
    return { error: "Only Full-Time drivers of this store can be added to a Full-Time shift" };
  }
  return { ids: found.map((d) => d._id) };
}

/** A driver belongs to at most one active Full-Time shift. */
async function detachDriversFromOtherShifts(managerId, driverIds, keepShiftId) {
  if (!driverIds.length) return;
  await FullTimeShift.updateMany(
    { managerId, isActive: true, _id: { $ne: keepShiftId }, driverIds: { $in: driverIds } },
    { $pull: { driverIds: { $in: driverIds } } }
  );
}

async function driverMapFor(shifts) {
  const ids = [...new Set(shifts.flatMap((s) => (s.driverIds || []).map(String)))];
  if (!ids.length) return new Map();
  const drivers = await DeliveryBoy.find({ _id: { $in: ids } }).select(
    "name phone status isActive vehicleType employmentType"
  );
  return new Map(drivers.map((d) => [d._id.toString(), lightDriver(d)]));
}

function readShiftBody(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return { error: "Shift name is required" };
    out.name = name;
  }
  if (!partial || body.startTime !== undefined) {
    const t = normalizeTime(body.startTime);
    if (!t) return { error: "Valid startTime is required (e.g. 09:00 AM)" };
    out.startTime = t;
  }
  if (!partial || body.endTime !== undefined) {
    const t = normalizeTime(body.endTime);
    if (!t) return { error: "Valid endTime is required (e.g. 06:00 PM)" };
    out.endTime = t;
  }
  if (out.startTime && out.endTime && out.startTime === out.endTime) {
    return { error: "startTime and endTime cannot be the same" };
  }
  if (body.workingDays !== undefined) {
    const days = normalizeWorkingDays(body.workingDays);
    if (!days || !days.length) return { error: "Select at least one working day" };
    out.workingDays = days;
  }
  if (body.scheduleMode !== undefined) {
    if (!["single_day", "full_week", "full_month"].includes(body.scheduleMode)) {
      return { error: "Choose a valid schedule period" };
    }
    out.scheduleMode = body.scheduleMode;
  }
  if (body.scheduleStartDate !== undefined || body.scheduleEndDate !== undefined) {
    const start = String(body.scheduleStartDate || "");
    const end = String(body.scheduleEndDate || "");
    if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
      return { error: "Choose valid shift schedule dates" };
    }
    out.scheduleStartDate = start;
    out.scheduleEndDate = end;
  }
  if (body.excludedDates !== undefined) {
    if (!Array.isArray(body.excludedDates) || body.excludedDates.some((d) => !DATE_RE.test(String(d)))) {
      return { error: "Skipped dates must be valid dates" };
    }
    out.excludedDates = [...new Set(body.excludedDates.map(String))].sort();
  }
  if (body.requireAttendance !== undefined) out.requireAttendance = Boolean(body.requireAttendance);
  if (body.requireLocationValidation !== undefined) {
    out.requireLocationValidation = Boolean(body.requireLocationValidation);
  }
  if (body.attendanceRadiusMeters !== undefined) {
    if (body.attendanceRadiusMeters === null || body.attendanceRadiusMeters === "") {
      out.attendanceRadiusMeters = null;
    } else {
      const r = Number(body.attendanceRadiusMeters);
      if (!Number.isFinite(r) || r < 10) return { error: "attendanceRadiusMeters must be at least 10" };
      out.attendanceRadiusMeters = Math.round(r);
    }
  }
  if (body.notes !== undefined) out.notes = String(body.notes || "").trim();

  if (body.compulsoryDailyOnlineHours !== undefined) {
    if (body.compulsoryDailyOnlineHours === null || body.compulsoryDailyOnlineHours === "") {
      out.compulsoryDailyOnlineHours = null;
    } else {
      const h = Number(body.compulsoryDailyOnlineHours);
      if (!Number.isFinite(h) || h < 1 || h > 24) return { error: "Compulsory daily online hours must be between 1 and 24" };
      out.compulsoryDailyOnlineHours = Math.round(h * 10) / 10;
    }
  }

  const optionalAmount = (key, label) => {
    if (body[key] === undefined) return null;
    if (body[key] === null || body[key] === "") {
      out[key] = null;
      return null;
    }
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0) return `${label} must be 0 or more`;
    out[key] = Math.round(n);
    return null;
  };
  const salaryErr = optionalAmount("monthlySalary", "Monthly salary");
  if (salaryErr) return { error: salaryErr };

  if (body.leavePolicyEnabled !== undefined) out.leavePolicyEnabled = Boolean(body.leavePolicyEnabled);
  if (body.paidLeavesPerMonth !== undefined) {
    const n = Number(body.paidLeavesPerMonth || 0);
    if (!Number.isInteger(n) || n < 0 || n > 31) return { error: "Paid leaves per month must be 0–31" };
    out.paidLeavesPerMonth = n;
  }
  const leaveErr = optionalAmount("unpaidLeaveDeductionPerDay", "Unpaid leave deduction");
  if (leaveErr) return { error: leaveErr };

  if (body.latePenaltyEnabled !== undefined) out.latePenaltyEnabled = Boolean(body.latePenaltyEnabled);
  if (body.lateAfterMinutes !== undefined) {
    const n = Math.round(Number(body.lateAfterMinutes));
    if (!Number.isFinite(n) || n < 1 || n > 1440) return { error: "Late threshold must be between 1 minute and 24 hours" };
    out.lateAfterMinutes = n;
  }
  if (body.latePenaltyAmount !== undefined) {
    const n = Number(body.latePenaltyAmount || 0);
    if (!Number.isFinite(n) || n < 0) return { error: "Late penalty amount must be 0 or more" };
    out.latePenaltyAmount = Math.round(n);
  }
  if (out.latePenaltyEnabled && !(out.latePenaltyAmount > 0) && body.latePenaltyAmount !== undefined) {
    return { error: "Enter the amount to cut for late attendance" };
  }
  return { data: out };
}

// ─── Full-Time shifts ────────────────────────────────────────────────────────

/** GET /fulltime/shifts */
export const listFullTimeShifts = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const shifts = await FullTimeShift.find({ managerId: manager._id, isActive: true }).sort({
      createdAt: -1,
    });
    const driverMap = await driverMapFor(shifts);
    res.json({ success: true, shifts: shifts.map((s) => serializeFullTimeShift(s, driverMap)) });
  } catch (err) {
    next(err);
  }
};

/** POST /fulltime/shifts */
export const createFullTimeShift = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const parsed = readShiftBody(req.body || {});
    if (parsed.error) return badRequest(res, parsed.error);
    const drivers = await validateShiftDriverIds(manager, req.body?.driverIds);
    if (drivers.error) return badRequest(res, drivers.error);

    const shift = await FullTimeShift.create({
      ...parsed.data,
      managerId: manager._id,
      driverIds: drivers.ids,
    });
    await detachDriversFromOtherShifts(manager._id, drivers.ids, shift._id);

    const driverMap = await driverMapFor([shift]);
    res.status(201).json({ success: true, shift: serializeFullTimeShift(shift, driverMap) });
  } catch (err) {
    next(err);
  }
};

/** PUT /fulltime/shifts/:id */
export const updateFullTimeShift = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    if (!mongoose.isValidObjectId(req.params.id)) return badRequest(res, "Invalid shift id");
    const shift = await FullTimeShift.findOne({
      _id: req.params.id,
      managerId: manager._id,
      isActive: true,
    });
    if (!shift) return res.status(404).json({ success: false, message: "Full-Time shift not found" });

    const parsed = readShiftBody(req.body || {}, { partial: true });
    if (parsed.error) return badRequest(res, parsed.error);
    const start = parsed.data.startTime ?? shift.startTime;
    const end = parsed.data.endTime ?? shift.endTime;
    if (start === end) return badRequest(res, "startTime and endTime cannot be the same");

    Object.assign(shift, parsed.data);
    if (req.body?.driverIds !== undefined) {
      const drivers = await validateShiftDriverIds(manager, req.body.driverIds);
      if (drivers.error) return badRequest(res, drivers.error);
      shift.driverIds = drivers.ids;
      await detachDriversFromOtherShifts(manager._id, drivers.ids, shift._id);
    }
    await shift.save();

    const driverMap = await driverMapFor([shift]);
    res.json({ success: true, shift: serializeFullTimeShift(shift, driverMap) });
  } catch (err) {
    next(err);
  }
};

/** DELETE /fulltime/shifts/:id (soft delete) */
export const deleteFullTimeShift = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    if (!mongoose.isValidObjectId(req.params.id)) return badRequest(res, "Invalid shift id");
    const shift = await FullTimeShift.findOneAndUpdate(
      { _id: req.params.id, managerId: manager._id, isActive: true },
      { $set: { isActive: false } },
      { returnDocument: 'after' }
    );
    if (!shift) return res.status(404).json({ success: false, message: "Full-Time shift not found" });
    res.json({ success: true, message: "Full-Time shift removed" });
  } catch (err) {
    next(err);
  }
};

// ─── Full-Time drivers ───────────────────────────────────────────────────────

async function buildDriverSummaries(manager, riders, dateString = istDateString()) {
  if (!riders.length) return [];
  const ids = riders.map((r) => r._id);
  const month = dateString.slice(0, 7);
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  const monthDates = listIstDatesInMonth(y, m);

  const [rule, shifts, monthRecords, activeAgg] = await Promise.all([
    getActiveFullTimeRule(manager._id),
    FullTimeShift.find({ managerId: manager._id, isActive: true, driverIds: { $in: ids } }).sort({
      updatedAt: -1,
    }),
    FullTimeAttendance.find({ deliveryBoyId: { $in: ids }, date: { $in: monthDates } }),
    StoreOrder.aggregate([
      { $match: { assignedRiderId: { $in: ids }, status: { $in: FULL_TIME_ACTIVE_ORDER_STATUSES } } },
      { $group: { _id: "$assignedRiderId", n: { $sum: 1 } } },
    ]),
  ]);

  const activeById = new Map(activeAgg.map((a) => [String(a._id), a.n]));

  return riders.map((r) => {
    const rid = String(r._id);
    const shift = shifts.find((s) => (s.driverIds || []).some((id) => String(id) === rid)) || null;
    const requirement = resolveAttendanceRequirement({ rule, shift });
    const records = monthRecords.filter((a) => String(a.deliveryBoyId) === rid);
    const record = records.find((a) => a.date === dateString) || null;
    const att = attendanceStatusFor({ record, requirement, dateString });
    const credit = (r.salaryCredits || []).find((c) => c.month === month) || null;
    const payroll = buildMonthPayroll({ rider: r, manager, shift, rule, month, records });

    // Compulsory daily online hours: shift override or rule setting (default 8)
    const compulsoryHours = Number(rule?.compulsoryDailyOnlineHours) || 0;
    const requireCompulsory = Boolean(rule && rule.requireCompulsoryOnlineHours !== false);

    // Daily online minutes calculation
    ensureTodayOnlineTracking(r);
    let onlineMins = 0;
    const isToday = dateString === istDateString();
    if (isToday) {
      onlineMins = liveOnlineMinutes(r);
    } else {
      const pastAct = (r.dailyActivity || []).find((a) => a.date === dateString);
      onlineMins = pastAct ? Number(pastAct.onlineMinutes || 0) : Number(record?.onlineMinutes || 0);
    }

    const requiredMinutes = Math.round(compulsoryHours * 60);
    const hoursMet = onlineMins >= requiredMinutes;

    // Evaluated attendance status taking compulsory hours into account
    let evaluatedStatus = att.status;
    if (record?.manualOverride && record?.status) {
      evaluatedStatus = record.status;
    } else if (record?.status === "present") {
      evaluatedStatus = "present";
    } else if (requireCompulsory && (att.status === "present" || att.status === "pending" || att.status === "absent")) {
      if (hoursMet) {
        evaluatedStatus = "present";
      } else if (!isToday && evaluatedStatus !== "off_day" && evaluatedStatus !== "not_required") {
        evaluatedStatus = "absent";
      }
    }

    return {
      ...lightDriver(r),
      monthlySalary: effectiveMonthlySalary(r, manager),
      salarySource: salarySource(r),
      salaryOverride: r.monthlySalary ?? null,
      storeDefaultSalary: Number(manager.fullTimeMonthlySalary) || 0,
      walletBalance: Number(r.walletBalance) || 0,
      darkStore: {
        id: manager._id.toString(),
        name: manager.storeName || manager.name || "Dark Store",
      },
      shift: shift
        ? {
            id: shift._id.toString(),
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            workingDays: shift.workingDays || [],
          }
        : null,
      requirement,
      attendance: {
        date: dateString,
        status: evaluatedStatus,
        markedAt: record?.markedAt || null,
        distanceFromStoreMeters: record?.distanceFromStoreMeters ?? null,
        validationPassed: record?.validationPassed ?? null,
        lateMinutes: record?.lateMinutes ?? null,
        onlineMinutes: onlineMins,
        onlineTime: formatOnlineMinutes(onlineMins),
        compulsoryHours,
        requiredMinutes,
        hoursMet,
        hoursProgressPercent: Math.min(100, Math.round((onlineMins / Math.max(1, requiredMinutes)) * 100)),
        manualOverride: record?.manualOverride || false,
        notes: record?.notes || "",
      },
      monthPresentDays: records.filter((a) => a.status === "present").length,
      payroll,
      minimumAttendanceDays: rule?.minimumAttendanceDays ?? null,
      activeAssignedOrders: activeById.get(rid) || 0,
      salaryCreditedThisMonth: credit
        ? { month: credit.month, amount: credit.amount, creditedAt: credit.creditedAt }
        : null,
    };
  });
}

/** GET /fulltime/drivers */
export const listFullTimeDrivers = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const riders = await DeliveryBoy.find(
      riderQuery(manager, { employmentType: "FULL_TIME" })
    ).sort({ name: 1 });
    const drivers = await buildDriverSummaries(manager, riders);
    res.json({ success: true, drivers });
  } catch (err) {
    next(err);
  }
};

/** GET /fulltime/drivers/:driverId */
export const getFullTimeDriverSummary = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const rider = await findFullTimeDriver(manager, req.params.driverId);
    if (!rider) return res.status(404).json({ success: false, message: "Full-Time driver not found" });

    const [[summary], activeOrders] = await Promise.all([
      buildDriverSummaries(manager, [rider]),
      StoreOrder.find({
        managerId: manager._id,
        assignedRiderId: rider._id,
        status: { $in: FULL_TIME_ACTIVE_ORDER_STATUSES },
      }).sort({ assignedAt: 1 }),
    ]);

    const salaryCredits = [...(rider.salaryCredits || [])]
      .sort((a, b) => String(b.month).localeCompare(String(a.month)))
      .map((c) => ({
        month: c.month,
        amount: c.amount,
        creditedAt: c.creditedAt,
        breakdown: c.breakdown || null,
      }));

    res.json({
      success: true,
      driver: { ...summary, salaryCredits, assignedOrders: activeOrders.map(orderSummary) },
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /fulltime/drivers/:driverId/salary  { monthlySalary: number | null } */
export const setFullTimeDriverSalary = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const rider = await findFullTimeDriver(manager, req.params.driverId);
    if (!rider) return res.status(404).json({ success: false, message: "Full-Time driver not found" });

    const raw = req.body?.monthlySalary;
    if (raw === null || raw === "") {
      rider.monthlySalary = null;
    } else {
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        return badRequest(res, "monthlySalary must be a non-negative number, or null to use the store default");
      }
      rider.monthlySalary = Math.round(amount);
    }
    await rider.save();

    res.json({
      success: true,
      monthlySalary: effectiveMonthlySalary(rider, manager),
      salarySource: salarySource(rider),
      salaryOverride: rider.monthlySalary ?? null,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /fulltime/drivers/:driverId/credit-salary  { month?: "YYYY-MM", amount?: number } */
export const creditFullTimeSalary = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const rider = await findFullTimeDriver(manager, req.params.driverId);
    if (!rider) return res.status(404).json({ success: false, message: "Full-Time driver not found" });

    const month = String(req.body?.month || istMonthString()).trim();
    if (!MONTH_RE.test(month)) return badRequest(res, "month must be in YYYY-MM format");

    const [rule, shift] = await Promise.all([
      getActiveFullTimeRule(manager._id),
      getDriverFullTimeShift(manager._id, rider._id),
    ]);
    const payroll = await computeMonthPayroll({ rider, manager, shift, rule, month });

    const amountRaw = req.body?.amount;
    const amount =
      amountRaw === undefined || amountRaw === null || amountRaw === ""
        ? payroll.netSalary
        : Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return badRequest(
        res,
        payroll.baseSalary > 0
          ? "Salary after deductions is ₹0 — nothing to credit."
          : "Salary amount must be greater than 0. Set the monthly salary first."
      );
    }
    const rounded = Math.round(amount);
    const breakdown = {
      baseSalary: payroll.baseSalary,
      leaveDeduction: payroll.leave.deduction,
      lateDeduction: payroll.late.deduction,
      unpaidLeaves: payroll.leave.unpaid,
      paidLeaves: payroll.leave.paid,
      lateCount: payroll.late.count,
    };

    const updated = await DeliveryBoy.findOneAndUpdate(
      { _id: rider._id, employmentType: "FULL_TIME", "salaryCredits.month": { $ne: month } },
      {
        $inc: { walletBalance: rounded, totalLifetimeEarnings: rounded },
        $push: {
          salaryCredits: {
            month,
            amount: rounded,
            creditedAt: new Date(),
            creditedBy: manager._id,
            breakdown,
          },
        },
      },
      { returnDocument: 'after' }
    );
    if (!updated) {
      return res.status(409).json({
        success: false,
        code: "SALARY_ALREADY_CREDITED",
        message: `Salary for ${month} has already been credited to this driver`,
      });
    }

    notifyWalletCredited(updated._id, { amount: rounded, reason: `salary_${month}` }).catch(() => {});

    res.json({
      success: true,
      message: `₹${rounded} salary for ${month} credited to wallet`,
      credit: { month, amount: rounded, breakdown },
      walletBalance: Number(updated.walletBalance) || 0,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /drivers/:driverId/employment-type  { employmentType: "PART_TIME" | "FULL_TIME" } */
export const setDriverEmploymentType = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const employmentType = String(req.body?.employmentType || "").trim().toUpperCase();
    if (!["PART_TIME", "FULL_TIME"].includes(employmentType)) {
      return badRequest(res, 'employmentType must be "PART_TIME" or "FULL_TIME"');
    }
    if (!mongoose.isValidObjectId(req.params.driverId)) return badRequest(res, "Invalid driver id");

    const rider = await DeliveryBoy.findOne(riderQuery(manager, { _id: req.params.driverId }));
    if (!rider) return res.status(404).json({ success: false, message: "Driver not found" });

    const current = rider.employmentType || "PART_TIME";
    if (current === employmentType) {
      return res.json({ success: true, employmentType, message: "No change" });
    }

    const activeOrders = await StoreOrder.countDocuments({
      assignedRiderId: rider._id,
      status: { $in: ["offered", ...FULL_TIME_ACTIVE_ORDER_STATUSES] },
    });
    if (activeOrders > 0 || rider.status === "on_delivery") {
      return res.status(409).json({
        success: false,
        code: "DRIVER_HAS_ACTIVE_ORDERS",
        message: "Driver has active or assigned orders. Complete or unassign them first.",
      });
    }

    rider.employmentType = employmentType;
    await rider.save();

    if (employmentType === "PART_TIME") {
      await FullTimeShift.updateMany(
        { managerId: manager._id, driverIds: rider._id },
        { $pull: { driverIds: rider._id } }
      );
    }

    res.json({
      success: true,
      employmentType,
      message: `Driver is now ${employmentType === "FULL_TIME" ? "Full-Time" : "Part-Time"}`,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /drivers/:driverId/payment-config */
export const setDriverPaymentConfig = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    if (!mongoose.isValidObjectId(req.params.driverId)) return badRequest(res, "Invalid driver id");
    const rider = await DeliveryBoy.findOne(riderQuery(manager, { _id: req.params.driverId }));
    if (!rider) return res.status(404).json({ success: false, message: "Driver not found" });
    const { active, mode } = req.body || {};
    const monthlySalary = req.body?.monthlySalary;
    const commissionRatePerKm = req.body?.commissionRatePerKm;
    if (typeof active !== "boolean") return badRequest(res, "active must be true or false");
    if (!["monthly_salary", "per_km_commission"].includes(mode)) {
      return badRequest(res, 'mode must be "monthly_salary" or "per_km_commission"');
    }
    if (mode === "monthly_salary") {
      const amount = Number(monthlySalary);
      if (!Number.isFinite(amount) || amount < 0) return badRequest(res, "monthlySalary must be a non-negative number");
      rider.monthlySalary = Math.round(amount);
    } else {
      const rate = Number(commissionRatePerKm);
      if (!Number.isFinite(rate) || rate < 0) return badRequest(res, "commissionRatePerKm must be a non-negative number");
      rider.commissionRatePerKm = Math.round(rate * 100) / 100;
    }
    rider.paymentConfigHistory.push({
      mode, active, monthlySalary: rider.monthlySalary ?? null,
      commissionRatePerKm: rider.commissionRatePerKm || 0,
      changedAt: new Date(), changedBy: manager._id,
    });
    rider.paymentMode = mode;
    rider.paymentActive = active;
    await rider.save();
    res.json({ success: true, payment: { active, mode, monthlySalary: rider.monthlySalary ?? null, commissionRatePerKm: rider.commissionRatePerKm || 0 } });
  } catch (err) { next(err); }
};

/** PUT /drivers/payment-config/bulk { employmentType, active, mode, monthlySalary, commissionRatePerKm } */
export const setBulkDriverPaymentConfig = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { employmentType, active, mode } = req.body || {};
    if (!["FULL_TIME", "PART_TIME"].includes(employmentType)) {
      return badRequest(res, 'employmentType must be "FULL_TIME" or "PART_TIME"');
    }
    if (typeof active !== "boolean") return badRequest(res, "active must be true or false");
    if (!["monthly_salary", "per_km_commission"].includes(mode)) {
      return badRequest(res, 'mode must be "monthly_salary" or "per_km_commission"');
    }

    let amount;
    if (mode === "monthly_salary") {
      amount = Number(req.body?.monthlySalary);
      if (!Number.isFinite(amount) || amount < 0) return badRequest(res, "monthlySalary must be a non-negative number");
      amount = Math.round(amount);
    } else {
      amount = Number(req.body?.commissionRatePerKm);
      if (!Number.isFinite(amount) || amount < 0) return badRequest(res, "commissionRatePerKm must be a non-negative number");
      amount = Math.round(amount * 100) / 100;
    }

    const riders = await DeliveryBoy.find(riderQuery(manager, { employmentType })).select("_id").lean();
    if (!riders.length) return res.json({ success: true, updatedCount: 0 });

    const changedAt = new Date();
    const operations = riders.map(({ _id }) => ({
      updateOne: {
        filter: { _id },
        update: {
          $set: {
            paymentMode: mode,
            paymentActive: active,
            ...(mode === "monthly_salary" ? { monthlySalary: amount } : { commissionRatePerKm: amount }),
          },
          $push: {
            paymentConfigHistory: {
              mode,
              active,
              monthlySalary: mode === "monthly_salary" ? amount : null,
              commissionRatePerKm: mode === "per_km_commission" ? amount : 0,
              changedAt,
              changedBy: manager._id,
            },
          },
        },
      },
    }));
    const result = await DeliveryBoy.bulkWrite(operations);
    return res.json({ success: true, updatedCount: result.modifiedCount });
  } catch (err) {
    next(err);
  }
};

/** GET /payments/monthly?month=YYYY-MM&employmentType=FULL_TIME|PART_TIME */
export const getMonthlyRiderPayments = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const month = String(req.query.month || istMonthString());
    const employmentType = String(req.query.employmentType || "").toUpperCase();
    if (!MONTH_RE.test(month)) return badRequest(res, "month must be YYYY-MM");
    if (employmentType && !["FULL_TIME", "PART_TIME"].includes(employmentType)) return badRequest(res, "Invalid employmentType");
    const start = new Date(`${month}-01T00:00:00+05:30`);
    const [yearNum, monthNum] = month.split("-").map(Number);
    const nextMonth = monthNum === 12
      ? `${yearNum + 1}-01`
      : `${yearNum}-${String(monthNum + 1).padStart(2, "0")}`;
    const end = new Date(`${nextMonth}-01T00:00:00+05:30`);
    const riders = await DeliveryBoy.find(riderQuery(manager, employmentType ? { employmentType } : {}))
      .select("name phone employmentType paymentActive paymentMode monthlySalary commissionRatePerKm incentiveCredits")
      .sort({ name: 1 }).lean();
    const ids = riders.map((r) => r._id.toString());
    const orders = ids.length ? await StoreOrder.find({
      managerId: manager._id, assignedRiderId: { $in: ids }, status: "delivered",
      deliveredAt: { $gte: start, $lt: end },
    }).select("assignedRiderId orderNumber deliveredAt deliveryDistanceKm riderDeliveryEarning paymentSnapshot").lean() : [];
    const rule = employmentType === "PART_TIME" ? null : await getActiveFullTimeRule(manager._id);
    const rows = await Promise.all(riders.map(async (r) => {
      const completed = orders.filter((o) => String(o.assignedRiderId) === String(r._id));
      const km = completed.reduce((n, o) => n + (Number(o.paymentSnapshot?.distanceKm ?? o.deliveryDistanceKm) || 0), 0);
      const commission = completed.reduce((n, o) => n + (
        o.paymentSnapshot?.mode
          ? (Number(o.paymentSnapshot.commissionAmount) || 0)
          : (Number(o.riderDeliveryEarning) || 0)
      ), 0);
      const rate = Number(r.commissionRatePerKm) || 0;
      const mode = r.paymentMode || (r.employmentType === "FULL_TIME" ? "monthly_salary" : "per_km_commission");
      const incentives = (r.incentiveCredits || []).filter((credit) => credit.month === month)
        .reduce((n, credit) => n + (Number(credit.amount) || 0), 0);
      const shift = r.employmentType === "FULL_TIME" ? await getDriverFullTimeShift(manager._id, r._id) : null;
      const payroll = r.employmentType === "FULL_TIME"
        ? await computeMonthPayroll({ rider: r, manager, shift, rule, month })
        : null;
      return {
        riderId: String(r._id), name: r.name || "Rider", phone: r.phone,
        employmentType: r.employmentType || "PART_TIME", paymentActive: r.paymentActive === true,
        paymentMode: mode, monthlySalary: r.monthlySalary ?? null,
        commissionRatePerKm: rate, completedDeliveries: completed.length,
        totalDeliveryKm: Math.round(km * 100) / 100,
        commission: Math.round(commission * 100) / 100,
        incentives: Math.round(incentives * 100) / 100,
        payroll: payroll ? {
          scheduledWorkingDays: payroll.scheduledWorkingDays, presentDays: payroll.presentDays,
          absentDays: payroll.absentDays, paidLeaves: payroll.leave.paid,
          unpaidLeaves: payroll.leave.unpaid, deductions: payroll.totalDeductions,
          baseSalary: payroll.baseSalary, netSalary: payroll.netSalary,
        } : null,
        payable: r.paymentActive === false ? 0 : (mode === "monthly_salary"
          ? (payroll?.netSalary ?? Number(r.monthlySalary || 0))
          : Math.round(commission * 100) / 100) + incentives,
      };
    }));
    res.json({ success: true, month, rows, totals: {
      riders: rows.length, completedDeliveries: rows.reduce((n, r) => n + r.completedDeliveries, 0),
      deliveryKm: Math.round(rows.reduce((n, r) => n + r.totalDeliveryKm, 0) * 100) / 100,
      incentives: Math.round(rows.reduce((n, r) => n + r.incentives, 0) * 100) / 100,
      payable: Math.round(rows.reduce((n, r) => n + r.payable, 0) * 100) / 100,
    } });
  } catch (err) { next(err); }
};

/** GET /payments/distance?from=YYYY-MM-DD&to=YYYY-MM-DD&employmentType=... */
export const getRiderDistanceReport = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const employmentType = String(req.query.employmentType || "").toUpperCase();
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) return badRequest(res, "from and to must be valid YYYY-MM-DD dates");
    if (employmentType && !["FULL_TIME", "PART_TIME"].includes(employmentType)) return badRequest(res, "Invalid employmentType");
    const start = new Date(`${from}T00:00:00+05:30`);
    const end = new Date(`${to}T00:00:00+05:30`); end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
    const riders = await DeliveryBoy.find(riderQuery(manager, employmentType ? { employmentType } : {}))
      .select("name phone employmentType commissionRatePerKm paymentMode paymentActive").sort({ name: 1 }).lean();
    const riderById = new Map(riders.map((r) => [String(r._id), r]));
    const orders = await StoreOrder.find({
      managerId: manager._id, assignedRiderId: { $in: [...riderById.keys()] }, status: "delivered",
      deliveredAt: { $gte: start, $lt: end },
    }).select("assignedRiderId deliveredAt orderNumber paymentSnapshot deliveryDistanceKm riderDeliveryEarning").lean();
    const grouped = new Map();
    for (const order of orders) {
      const riderId = String(order.assignedRiderId);
      const rider = riderById.get(riderId);
      if (!rider) continue;
      const date = istDateString(order.deliveredAt);
      const key = `${riderId}:${date}`;
      const row = grouped.get(key) || { riderId, date, name: rider.name || "Rider", employmentType: rider.employmentType || "PART_TIME", deliveries: 0, totalDeliveryKm: 0, commission: 0 };
      row.deliveries += 1;
      row.totalDeliveryKm += Number(order.paymentSnapshot?.distanceKm ?? order.deliveryDistanceKm) || 0;
      row.commission += order.paymentSnapshot?.mode
        ? Number(order.paymentSnapshot.commissionAmount) || 0
        : Number(order.riderDeliveryEarning) || 0;
      grouped.set(key, row);
    }
    const rows = [...grouped.values()].map((row) => {
      const rider = riderById.get(row.riderId);
      return { ...row,
        totalDeliveryKm: Math.round(row.totalDeliveryKm * 100) / 100,
        commission: Math.round(row.commission * 100) / 100,
        commissionRatePerKm: Number(rider?.commissionRatePerKm) || 0,
        paymentActive: rider?.paymentActive !== false,
      };
    }).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
    res.json({ success: true, from, to, rows, totals: {
      riders: new Set(rows.map((r) => r.riderId)).size,
      deliveries: rows.reduce((n, r) => n + r.deliveries, 0),
      deliveryKm: Math.round(rows.reduce((n, r) => n + r.totalDeliveryKm, 0) * 100) / 100,
      commission: Math.round(rows.reduce((n, r) => n + r.commission, 0) * 100) / 100,
    } });
  } catch (err) { next(err); }
};

// ─── Attendance ──────────────────────────────────────────────────────────────

/** GET /fulltime/attendance?date=YYYY-MM-DD */
export const listFullTimeAttendance = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const date = String(req.query.date || istDateString()).trim();
    if (!DATE_RE.test(date)) return badRequest(res, "date must be YYYY-MM-DD");

    const riders = await DeliveryBoy.find(
      riderQuery(manager, { employmentType: "FULL_TIME" })
    ).sort({ name: 1 });
    const drivers = await buildDriverSummaries(manager, riders, date);

    const counts = drivers.reduce((acc, d) => {
      acc[d.attendance.status] = (acc[d.attendance.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      date,
      summary: {
        total: drivers.length,
        present: counts.present || 0,
        absent: counts.absent || 0,
        pending: counts.pending || 0,
        offDay: counts.off_day || 0,
        notRequired: counts.not_required || 0,
      },
      rows: drivers.map((d) => ({
        driver: { id: d.id, name: d.name, phone: d.phone, status: d.status, isActive: d.isActive },
        shift: d.shift,
        requirement: d.requirement,
        attendance: d.attendance,
        monthPresentDays: d.monthPresentDays,
        minimumAttendanceDays: d.minimumAttendanceDays,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/** POST /fulltime/attendance/mark-manual — manager manually sets or overrides driver attendance. */
export const markFullTimeAttendanceManual = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { driverId, date, status, notes } = req.body || {};
    if (!driverId || !date) return badRequest(res, "driverId and date are required");
    const allowed = ["present", "absent", "half_day", "pending"];
    if (!allowed.includes(status)) {
      return badRequest(res, `status must be one of: ${allowed.join(", ")}`);
    }

    const rider = await findFullTimeDriver(manager, driverId);
    if (!rider) return res.status(404).json({ success: false, message: "Full-Time driver not found" });

    const attendance = await FullTimeAttendance.findOneAndUpdate(
      { deliveryBoyId: rider._id, date },
      {
        $set: {
          managerId: manager._id,
          status,
          markedAt: new Date(),
          manualOverride: true,
          notes: String(notes || "").trim(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({
      success: true,
      message: `Attendance for ${rider.name || rider.phone} marked as ${status}`,
      attendance,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Manual order assignment ─────────────────────────────────────────────────

/** GET /fulltime/assignable-orders — packed delivery orders not yet with a rider. */
export const listFullTimeAssignableOrders = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const orders = await StoreOrder.find({
      managerId: manager._id,
      status: "packed",
      fulfillmentType: { $ne: "pickup" },
    }).sort({ isPreOrder: -1, packedAt: 1, createdAt: 1 });
    res.json({ success: true, orders: orders.map(orderSummary) });
  } catch (err) {
    next(err);
  }
};

/** GET /fulltime/assigned-orders?riderId= — active orders currently with Full-Time drivers. */
export const listFullTimeAssignedOrders = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const ftRiders = await DeliveryBoy.find(
      riderQuery(manager, { employmentType: "FULL_TIME" })
    ).select("name phone status isActive vehicleType employmentType");
    let riderIds = ftRiders.map((r) => r._id);
    const filterId = String(req.query.riderId || "").trim();
    if (filterId) riderIds = riderIds.filter((id) => String(id) === filterId);

    const orders = riderIds.length
      ? await StoreOrder.find({
          managerId: manager._id,
          assignedRiderId: { $in: riderIds },
          status: { $in: FULL_TIME_ACTIVE_ORDER_STATUSES },
        }).sort({ assignedAt: 1 })
      : [];
    const riderMap = new Map(ftRiders.map((r) => [r._id.toString(), lightDriver(r)]));

    res.json({
      success: true,
      orders: orders.map((o) => ({
        ...orderSummary(o),
        rider: riderMap.get(String(o.assignedRiderId)) || null,
        canUnassign: !(o.pickupQrScanned || o.qrScannedAt) && o.status === "assigned",
      })),
    });
  } catch (err) {
    next(err);
  }
};

/** POST /fulltime/assign-orders  { riderId, orderIds: [] } */
function readAssignBody(req, res) {
  const riderId = String(req.body?.riderId || "").trim();
  const orderIds = [
    ...new Set(
      (Array.isArray(req.body?.orderIds) ? req.body.orderIds : []).map(String).filter(Boolean)
    ),
  ];
  if (!riderId || !orderIds.length) {
    badRequest(res, "riderId and at least one orderId are required");
    return null;
  }
  if (orderIds.some((id) => !mongoose.isValidObjectId(id))) {
    badRequest(res, "orderIds contains an invalid id");
    return null;
  }
  return { riderId, orderIds };
}

export const assignOrdersToFullTimeDriver = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const body = readAssignBody(req, res);
    if (!body) return;

    const rider = await findFullTimeDriver(manager, body.riderId);
    if (!rider || rider.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Active Full-Time driver not found for this store",
      });
    }
    await assignOrdersDirectly({
      res,
      manager,
      rider,
      orderIds: body.orderIds,
      fullTime: true,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /preorders/assign — the manager hands several packed pre-orders to one
 * rider (any employment type) in one go; they all show up in the rider's
 * active deliveries without an Accept/Decline offer.
 */
export const assignPreOrdersToDriver = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const body = readAssignBody(req, res);
    if (!body) return;

    const rider = await DeliveryBoy.findOne(
      riderQuery(manager, { _id: body.riderId, isActive: true })
    );
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Active rider not found for this store",
      });
    }
    await assignOrdersDirectly({
      res,
      manager,
      rider,
      orderIds: body.orderIds,
      fullTime: rider.employmentType === "FULL_TIME",
      preOrdersOnly: true,
    });
  } catch (err) {
    next(err);
  }
};

export async function assignOrdersDirectly({
  res,
  manager,
  rider,
  orderIds,
  fullTime,
  preOrdersOnly = false,
}) {
  const assignableStatuses = preOrdersOnly ? ["packed", "offered"] : ["packed"];
  const orders = await StoreOrder.find({
    _id: { $in: orderIds },
    managerId: manager._id,
  });
  const now = new Date();
  const assigned = [];
  const skipped = [];

  for (const id of orderIds) {
    const order = orders.find((o) => String(o._id) === id);
    if (!order) {
      skipped.push({ orderId: id, reason: "Order not found" });
      continue;
    }
    if (preOrdersOnly && !order.isPreOrder) {
      skipped.push({
        orderId: id,
        orderNumber: order.orderNumber,
        reason: "Not a pre-order",
      });
      continue;
    }
    if (order.fulfillmentType === "pickup") {
      skipped.push({
        orderId: id,
        orderNumber: order.orderNumber,
        reason: "Customer pickup order — no rider needed",
      });
      continue;
    }
    if (!assignableStatuses.includes(order.status)) {
      skipped.push({
        orderId: id,
        orderNumber: order.orderNumber,
        reason: `Order must be packed (status: ${order.status})`,
      });
      continue;
    }
    if (order.isPreOrder && !order.storeReceivedAt) {
      skipped.push({
        orderId: id,
        orderNumber: order.orderNumber,
        reason: "Mark the pre-order goods as received at the dark store first",
      });
      continue;
    }

    const updated = await StoreOrder.findOneAndUpdate(
      { _id: order._id, managerId: manager._id, status: { $in: assignableStatuses } },
      {
        $set: {
          status: "assigned",
          assignmentStatus: "DRIVER_ASSIGNED",
          assignedRiderId: rider._id,
          assignedAt: now,
          currentOfferDriverId: null,
          offeredRiderId: null,
          offerStartedAt: null,
          offerExpiresAt: null,
          pickupVerified: false,
          customerAddressUnlocked: false,
          pickupQrUnlocked: true,
          routeBatchWindowEndsAt: null,
          darkStoreId: order.darkStoreId || manager._id,
          darkStoreQrCode: order.darkStoreQrCode || `DARKSTORE_${manager._id}`,
          ...(fullTime
            ? {
                fullTimeDelivery: true,
                fullTimeAssignedAt: now,
                fullTimeAssignedBy: manager._id,
              }
            : {}),
        },
      },
      { returnDocument: 'after' }
    );
    if (!updated) {
      skipped.push({
        orderId: id,
        orderNumber: order.orderNumber,
        reason: "Order was taken by another assignment",
      });
      continue;
    }
    assigned.push(updated);
  }

  if (assigned.length) {
    const storeRoom = `store_${manager._id}`;
    try {
      const io = getIO();
      for (const o of assigned) {
        io.to(storeRoom).emit("order_status_updated", {
          orderId: o._id.toString(),
          orderNumber: o.orderNumber,
          status: o.status,
          assignmentStatus: o.assignmentStatus,
          assignedRiderId: rider._id.toString(),
          fullTimeDelivery: fullTime,
        });
        io.to(`rider_${rider._id}`).emit("new_order_assigned", {
          orderId: o._id.toString(),
          orderNumber: o.orderNumber,
          status: o.status,
          pickupQrUnlocked: true,
          fullTimeDelivery: fullTime,
        });
      }
      io.to(`rider_${rider._id}`).emit("active_delivery_updated", {
        reason: preOrdersOnly ? "preorders_assigned" : "fulltime_orders_assigned",
        orderIds: assigned.map((o) => o._id.toString()),
      });
    } catch (err) {
      console.warn("[socket] full-time assign emit failed:", err.message);
    }

    for (const o of assigned) {
      syncCustomerOrderFromStore(o, "assigned").catch((err) =>
        console.warn("[assign] customer sync failed:", err.message)
      );
    }

    notifyOrdersAssigned(rider._id, {
      orders: assigned.map((o) => ({
        orderId: o._id,
        orderNumber: o.orderNumber,
      })),
      preOrder: preOrdersOnly,
      storeName: manager.storeName || "",
    }).catch((err) => console.warn("[fulltime] assign notify failed:", err.message));
  }

  res.status(assigned.length ? 200 : 400).json({
    success: assigned.length > 0,
    message: assigned.length
      ? `${assigned.length} order${assigned.length > 1 ? "s" : ""} assigned to ${rider.name || rider.phone}`
      : "No orders could be assigned",
    assigned: assigned.map(orderSummary),
    skipped,
    rider: lightDriver(rider),
  });
}

/** POST /fulltime/orders/:orderId/unassign — only before the rider scans the pickup QR. */
export const unassignFullTimeOrder = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    if (!mongoose.isValidObjectId(req.params.orderId)) return badRequest(res, "Invalid order id");

    const order = await StoreOrder.findOne({
      _id: req.params.orderId,
      managerId: manager._id,
      fullTimeDelivery: true,
    });
    if (!order) return res.status(404).json({ success: false, message: "Full-Time assigned order not found" });
    if (order.status !== "assigned" || order.pickupQrScanned || order.qrScannedAt) {
      return badRequest(res, "Order can only be unassigned before the driver scans the pickup QR");
    }

    const riderId = order.assignedRiderId;
    const updated = await StoreOrder.findOneAndUpdate(
      { _id: order._id, status: "assigned", pickupQrScanned: { $ne: true } },
      {
        $set: {
          status: "packed",
          assignmentStatus: "NONE",
          assignedRiderId: null,
          assignedAt: null,
          pickupQrUnlocked: false,
          fullTimeDelivery: false,
          fullTimeAssignedAt: null,
          fullTimeAssignedBy: null,
        },
      },
      { returnDocument: 'after' }
    );
    if (!updated) return badRequest(res, "Order changed state — refresh and try again");

    if (riderId) {
      const remaining = await StoreOrder.countDocuments({
        assignedRiderId: riderId,
        status: { $in: FULL_TIME_ACTIVE_ORDER_STATUSES },
      });
      if (remaining === 0) {
        await DeliveryBoy.updateOne(
          { _id: riderId, status: "on_delivery" },
          { $set: { status: "online", activeOrderId: null, lastStatusAt: new Date() } }
        );
      }
    }

    try {
      const io = getIO();
      io.to(`store_${manager._id}`).emit("order_status_updated", {
        orderId: updated._id.toString(),
        orderNumber: updated.orderNumber,
        status: updated.status,
        assignmentStatus: updated.assignmentStatus,
        assignedRiderId: null,
      });
      if (riderId) {
        io.to(`rider_${riderId}`).emit("active_delivery_updated", {
          reason: "fulltime_order_unassigned",
          orderIds: [updated._id.toString()],
        });
      }
    } catch (err) {
      console.warn("[socket] full-time unassign emit failed:", err.message);
    }

    res.json({ success: true, message: "Order returned to the packed queue", order: orderSummary(updated) });
  } catch (err) {
    next(err);
  }
};
