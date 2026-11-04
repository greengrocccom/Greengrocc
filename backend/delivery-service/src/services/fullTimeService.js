import FullTimeRule from "../models/FullTimeRule.js";
import FullTimeShift from "../models/FullTimeShift.js";
import FullTimeAttendance from "../models/FullTimeAttendance.js";
import StoreOrder from "../models/StoreOrder.js";
import DeliveryManager from "../models/DeliveryManager.js";
import { getCurrentMinutesIST, timeToMinutes } from "../utils/shiftTimeHelper.js";
import { istDateString, listIstDatesInMonth } from "../utils/onlineHoursHelper.js";
import { resolveStoreIdForRider } from "../utils/storeResolver.js";

/** Attendance can be marked this many minutes before the required start time. */
export const ATTENDANCE_EARLY_MINUTES = 30;
export const FULL_TIME_ATTENDANCE_RADIUS_METERS = 200;

export const FULL_TIME_ACTIVE_ORDER_STATUSES = ["assigned", "pickup_verified", "out_for_delivery"];

export { istDateString };

export function istMonthString(d = new Date()) {
  return istDateString(d).slice(0, 7);
}

/** 0 = Sunday … 6 = Saturday, in IST. */
export function istDayOfWeek(dateString = istDateString()) {
  return new Date(`${dateString}T12:00:00+05:30`).getUTCDay();
}

/** Rider payment setting → store default. */
export function effectiveMonthlySalary(rider, manager) {
  if (rider?.monthlySalary != null) return Number(rider.monthlySalary) || 0;
  return Number(manager?.fullTimeMonthlySalary) || 0;
}

export function salarySource(rider) {
  if (rider?.monthlySalary != null) return "driver";
  return "store";
}

/** Leave and late-penalty policy is managed centrally in Full-Time Rules. */
export function shiftPayPolicy(rule) {
  return {
    leavePolicyEnabled: Boolean(rule?.leavePolicyEnabled),
    paidLeavesPerMonth: Number(rule?.paidLeavesPerMonth) || 0,
    unpaidLeaveDeductionPerDay: rule?.unpaidLeaveDeductionPerDay ?? null,
    latePenaltyEnabled: false,
    lateAfterMinutes: 120,
    latePenaltyAmount: 0,
  };
}

/** Minutes after `startTime` (IST) that `markedAt` happened; 0 when on time or early. */
export function lateMinutesFor(startTime, markedAt) {
  if (!startTime || !markedAt) return 0;
  let diff = getCurrentMinutesIST(new Date(markedAt)) - timeToMinutes(startTime);
  // Overnight shifts marked after midnight (e.g. start 10 PM, marked 12:30 AM)
  if (diff < -ATTENDANCE_EARLY_MINUTES) diff += 24 * 60;
  return Math.max(0, diff);
}

/** The rider's dark store: explicit managerId first, otherwise the area match the manager uses. */
export async function resolveRiderManager(rider) {
  if (!rider) return null;
  if (rider.managerId) {
    const m = await DeliveryManager.findById(rider.managerId);
    if (m) return m;
  }
  const storeId = await resolveStoreIdForRider(rider);
  return storeId ? DeliveryManager.findById(storeId) : null;
}

export async function getActiveFullTimeRule(managerId) {
  if (!managerId) return null;
  return FullTimeRule.findOne({ managerId, isActive: true }).sort({ updatedAt: -1 });
}

export async function getDriverFullTimeShift(managerId, riderId) {
  if (!managerId || !riderId) return null;
  const shifts = await FullTimeShift.find({ managerId, isActive: true, driverIds: riderId }).sort({
    updatedAt: -1,
  });
  return shifts[0] || null;
}

/**
 * The attendance requirement a Full-Time driver must follow today.
 * Returns the store-wide attendance rule, or null when none is configured.
 */
export function resolveAttendanceRequirement({ rule, shift }) {
  if (!rule) return null;
  return {
    source: shift ? "shift" : "rule",
    startTime: shift?.startTime || null,
    endTime: shift?.endTime || null,
    hasAssignedSchedule: Boolean(shift),
    workingDays: shift?.workingDays || [],
    scheduleStartDate: shift?.scheduleStartDate || "",
    scheduleEndDate: shift?.scheduleEndDate || "",
    excludedDates: shift?.excludedDates || [],
    requireAttendance: rule.requireAttendance !== false,
    requireLocationValidation: rule.requireLocationValidation !== false,
    attendanceRadiusMeters: FULL_TIME_ATTENDANCE_RADIUS_METERS,
    shiftName: shift?.name || "",
  };
}

function windowPhase(requirement, now = new Date()) {
  const cur = getCurrentMinutesIST(now);
  const start = timeToMinutes(requirement.startTime);
  const end = timeToMinutes(requirement.endTime);
  const openFrom = Math.max(0, start - ATTENDANCE_EARLY_MINUTES);
  if (end > start) {
    if (cur < openFrom) return "before";
    if (cur >= end) return "after";
    return "open";
  }
  // Overnight window (e.g. 10 PM – 6 AM)
  if (cur >= openFrom || cur < end) return "open";
  return "before";
}

/**
 * present | absent | pending | off_day | not_required
 * `canMark` tells the app whether the Mark Attendance button should be enabled.
 */
export function attendanceStatusFor({ record, requirement, dateString, now = new Date() }) {
  const today = istDateString(now);
  if (record?.status === "present") {
    return { status: "present", canMark: false, phase: "done" };
  }
  if (!requirement) {
    return { status: "pending", canMark: dateString === today, phase: "open" };
  }
  if (!requirement.requireAttendance) {
    return { status: "not_required", canMark: false, phase: "none" };
  }
  if (requirement.scheduleStartDate && dateString < requirement.scheduleStartDate) {
    return { status: "off_day", canMark: false, phase: "none" };
  }
  if (requirement.scheduleEndDate && dateString > requirement.scheduleEndDate) {
    return { status: "off_day", canMark: false, phase: "none" };
  }
  if ((requirement.excludedDates || []).includes(dateString)) {
    return { status: "off_day", canMark: false, phase: "none" };
  }
  const days = requirement.workingDays || [];
  if (days.length && !days.includes(istDayOfWeek(dateString))) {
    return { status: "off_day", canMark: false, phase: "none" };
  }
  if (dateString < today) return { status: "absent", canMark: false, phase: "after" };
  if (dateString > today) return { status: "pending", canMark: false, phase: "before" };
  if (!requirement.hasAssignedSchedule) return { status: "pending", canMark: true, phase: "open" };
  const phase = windowPhase(requirement, now);
  if (phase === "after") return { status: "absent", canMark: false, phase };
  return { status: "pending", canMark: phase === "open", phase };
}

export async function monthAttendanceSummary(riderId, month = istMonthString()) {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  const dates = listIstDatesInMonth(y, m);
  const presentDays = await FullTimeAttendance.countDocuments({
    deliveryBoyId: riderId,
    date: { $in: dates },
    status: "present",
  });
  return { month, presentDays, daysInMonth: dates.length };
}

const roundMoney = (n) => Math.round(Number(n) || 0);

/**
 * Month salary breakdown for one Full-Time driver from preloaded attendance `records`.
 * Leaves = scheduled working days (from the later of month start / joining / shift creation,
 * up to today) without a "present" record. Deductions only apply when the shift enables them.
 */
export function buildMonthPayroll({ rider, manager, shift, rule, month, records = [], now = new Date() }) {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  const dates = listIstDatesInMonth(y, m);
  const requirement = resolveAttendanceRequirement({ rule, shift });
  const policy = shiftPayPolicy(rule);
  const baseSalary = effectiveMonthlySalary(rider, manager);

  const workingDays = requirement?.workingDays?.length ? requirement.workingDays : [0, 1, 2, 3, 4, 5, 6];
  const scheduled = dates.filter((d) => {
    if (requirement?.hasAssignedSchedule && !workingDays.includes(istDayOfWeek(d))) return false;
    if (requirement?.scheduleStartDate && d < requirement.scheduleStartDate) return false;
    if (requirement?.scheduleEndDate && d > requirement.scheduleEndDate) return false;
    return !(requirement?.excludedDates || []).includes(d);
  });
  const trackFrom = [
    dates[0],
    rider?.createdAt ? istDateString(rider.createdAt) : "",
    shift?.createdAt ? istDateString(shift.createdAt) : "",
  ].sort().pop();

  const byDate = new Map(records.map((r) => [r.date, r]));
  const tracked = Boolean(requirement?.requireAttendance);
  let presentDays = 0;
  let absentDays = 0;
  let remainingDays = 0;
  const absentDates = [];
  for (const d of scheduled) {
    if (d < trackFrom) continue;
    const { status } = attendanceStatusFor({ record: byDate.get(d), requirement, dateString: d, now });
    if (status === "present") presentDays += 1;
    else if (status === "absent") {
      absentDays += 1;
      absentDates.push(d);
    } else if (status === "pending") remainingDays += 1;
  }

  const leaveOn = tracked && policy.leavePolicyEnabled;
  const paidLeaves = leaveOn ? Math.min(absentDays, policy.paidLeavesPerMonth) : 0;
  const unpaidLeaves = leaveOn ? absentDays - paidLeaves : 0;
  const deductionPerDay =
    policy.unpaidLeaveDeductionPerDay != null
      ? roundMoney(policy.unpaidLeaveDeductionPerDay)
      : scheduled.length
        ? roundMoney(baseSalary / scheduled.length)
        : 0;
  const leaveDeduction = unpaidLeaves * deductionPerDay;

  const lateOn = tracked && policy.latePenaltyEnabled && policy.latePenaltyAmount > 0;
  const lateDays = [];
  if (lateOn) {
    for (const r of records) {
      if (r.status !== "present" || r.date < trackFrom) continue;
      const mins = r.lateMinutes ?? lateMinutesFor(requirement?.startTime, r.markedAt);
      if (mins >= policy.lateAfterMinutes) lateDays.push({ date: r.date, lateMinutes: mins });
    }
    lateDays.sort((a, b) => a.date.localeCompare(b.date));
  }
  const lateDeduction = lateDays.length * roundMoney(policy.latePenaltyAmount);

  const totalDeductions = leaveDeduction + lateDeduction;
  const credit = (rider?.salaryCredits || []).find((c) => c.month === month) || null;

  return {
    month,
    baseSalary,
    salarySource: salarySource(rider),
    scheduledWorkingDays: scheduled.length,
    presentDays,
    absentDays,
    remainingDays,
    attendanceTracked: tracked,
    leave: {
      enabled: leaveOn,
      allowedPaid: policy.paidLeavesPerMonth,
      taken: absentDays,
      paid: paidLeaves,
      unpaid: unpaidLeaves,
      paidRemaining: leaveOn ? Math.max(0, policy.paidLeavesPerMonth - absentDays) : 0,
      deductionPerDay,
      deductionIsAuto: policy.unpaidLeaveDeductionPerDay == null,
      deduction: leaveDeduction,
      dates: absentDates,
    },
    late: {
      enabled: lateOn,
      afterMinutes: policy.lateAfterMinutes,
      penaltyAmount: roundMoney(policy.latePenaltyAmount),
      count: lateDays.length,
      deduction: lateDeduction,
      days: lateDays,
    },
    totalDeductions,
    netSalary: Math.max(0, baseSalary - totalDeductions),
    credited: credit
      ? { amount: credit.amount, creditedAt: credit.creditedAt }
      : null,
  };
}

export async function computeMonthPayroll({ rider, manager, shift, rule, month = istMonthString(), now }) {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  const records = await FullTimeAttendance.find({
    deliveryBoyId: rider._id,
    date: { $in: listIstDatesInMonth(y, m) },
  });
  return buildMonthPayroll({ rider, manager, shift, rule, month, records, now });
}

export async function countActiveAssignedOrders(riderId) {
  return StoreOrder.countDocuments({
    assignedRiderId: riderId,
    status: { $in: FULL_TIME_ACTIVE_ORDER_STATUSES },
  });
}

export function serializeFullTimeShift(shift, driverMap = new Map()) {
  return {
    id: shift._id.toString(),
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    workingDays: shift.workingDays || [],
    scheduleMode: shift.scheduleMode || "full_week",
    scheduleStartDate: shift.scheduleStartDate || "",
    scheduleEndDate: shift.scheduleEndDate || "",
    excludedDates: shift.excludedDates || [],
    notes: shift.notes || "",
    isActive: shift.isActive !== false,
    driverIds: (shift.driverIds || []).map(String),
    drivers: (shift.driverIds || [])
      .map((id) => driverMap.get(String(id)))
      .filter(Boolean),
    createdAt: shift.createdAt,
    updatedAt: shift.updatedAt,
  };
}
