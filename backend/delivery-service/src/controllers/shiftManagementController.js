import Shift from "../models/Shift.js";
import DeliveryManager from "../models/DeliveryManager.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import StoreOrder from "../models/StoreOrder.js";
import { validateEarningSlabs } from "../services/ShiftEarningService.js";
import {
  getCurrentMinutesIST,
  getSlotLifecycle,
  timeToMinutes,
} from "../utils/shiftTimeHelper.js";
import { istDateString, listRecentIstDates } from "../utils/onlineHoursHelper.js";
import { riderQuery } from "./managerDashboardController.js";
import {
  assignSlotToRiders,
  refreshRiderCurrentBooking,
  unassignRiderFromSlot,
} from "../services/slotAssignmentService.js";
import { notifyRiders } from "../services/RiderNotificationService.js";

// Admin routes set req.managerOverride so the same handlers work for any dark store.
const getManager = async (req) => {
  if (req.managerOverride) return req.managerOverride;
  const manager = await DeliveryManager.findById(req.user.id);
  if (!manager) {
    const err = new Error("Delivery manager not found");
    err.statusCode = 404;
    throw err;
  }
  return manager;
};

const formatDateString = (d) => {
  const date = d ? new Date(d) : new Date();
  if (isNaN(date.getTime())) {
    return istDateString();
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const INCENTIVE_MODES = ["none", "per_km", "per_hour"];

export function normalizeSlotIncentive(s = {}) {
  const mode = INCENTIVE_MODES.includes(s.incentiveMode) ? s.incentiveMode : "none";
  const rate = Math.max(0, Number(s.incentiveRate) || 0);
  const finalMode = rate > 0 ? mode : "none";
  const afterKm = Math.max(0, Number(s.incentiveAfterKm) || 0);
  return {
    incentiveMode: finalMode,
    incentiveRate: finalMode === "none" ? 0 : rate,
    incentiveAfterKm: finalMode === "per_km" ? Math.round(afterKm * 100) / 100 : 0,
  };
}

/** Default time slots generator for standard shift types */
const getDefaultSlotsForType = (type, customSlots = [], defaultCapacity = 10) => {
  if (customSlots && customSlots.length > 0) {
    return customSlots.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: parseInt(s.capacity, 10) || defaultCapacity,
      bookedCount: 0,
      status: "AVAILABLE",
      bookings: [],
      ...normalizeSlotIncentive(s),
    }));
  }

  switch (type) {
    case "early_morning":
      return [
        { startTime: "06:00 AM", endTime: "08:00 AM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
        { startTime: "08:00 AM", endTime: "09:00 AM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
      ];
    case "morning":
      return [
        { startTime: "09:00 AM", endTime: "11:00 AM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
        { startTime: "11:00 AM", endTime: "01:00 PM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
      ];
    case "afternoon":
      return [
        { startTime: "01:00 PM", endTime: "03:00 PM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
        { startTime: "03:00 PM", endTime: "05:00 PM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
      ];
    case "evening":
      return [
        { startTime: "05:00 PM", endTime: "07:00 PM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
        { startTime: "07:00 PM", endTime: "09:00 PM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
      ];
    case "night":
      return [
        { startTime: "09:00 PM", endTime: "10:30 PM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
        { startTime: "10:30 PM", endTime: "12:00 AM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
      ];
    case "late_night":
      return [
        { startTime: "12:00 AM", endTime: "02:00 AM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
        { startTime: "02:00 AM", endTime: "04:00 AM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
      ];
    default:
      return [
        { startTime: "09:00 AM", endTime: "01:00 PM", capacity: defaultCapacity, bookedCount: 0, status: "AVAILABLE", bookings: [] },
      ];
  }
};

/** Convert shift date + "09:00 AM" into a real Date in IST. */
function istDateAtMinutes(dateString, minutesFromMidnight) {
  const h = Math.floor(Math.max(0, minutesFromMidnight) / 60);
  const m = Math.max(0, minutesFromMidnight) % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return new Date(`${dateString}T${hh}:${mm}:00+05:30`);
}

function addOneIstDay(dateString) {
  const d = new Date(`${dateString}T12:00:00+05:30`);
  d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
  return istDateString(d);
}

/** Inclusive window for a slot on a given IST date. */
function slotTimeWindow(dateString, startTime, endTime) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const start = istDateAtMinutes(dateString, startMin);
  let end;
  if (endMin > startMin) {
    end = istDateAtMinutes(dateString, endMin);
  } else {
    // Overnight — ends next calendar morning
    end = istDateAtMinutes(addOneIstDay(dateString), endMin || 24 * 60);
  }
  // End exclusive → use end of last minute
  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }
  return { start, end };
}

function lifecycleToLabel(lifecycle) {
  if (lifecycle === "past") return "Expired";
  if (lifecycle === "current") return "Live";
  return "Upcoming";
}

/**
 * Merge new slot templates into an existing shift WITHOUT wiping rider bookings.
 * History (drivers, times, earnings slabs) is kept until manager explicitly deletes.
 */
function mergeSlotsPreserveBookings(existingSlots = [], nextTemplates = []) {
  const preserved = [];
  const usedExisting = new Set();

  for (const template of nextTemplates) {
    const matchIdx = (existingSlots || []).findIndex(
      (s, idx) =>
        !usedExisting.has(idx) &&
        s.startTime === template.startTime &&
        s.endTime === template.endTime &&
        s.status !== "CANCELLED"
    );

    if (matchIdx >= 0) {
      usedExisting.add(matchIdx);
      const existing = existingSlots[matchIdx];
      const bookings = Array.isArray(existing.bookings)
        ? existing.bookings
        : [];
      preserved.push({
        _id: existing._id,
        startTime: existing.startTime,
        endTime: existing.endTime,
        capacity: parseInt(template.capacity, 10) || existing.capacity || 10,
        status: existing.status === "CANCELLED" ? "AVAILABLE" : existing.status,
        bookings,
        bookedCount: bookings.filter((b) => b.status !== "CANCELLED").length,
        incentiveMode: template.incentiveMode ?? existing.incentiveMode ?? "none",
        incentiveRate: template.incentiveRate ?? existing.incentiveRate ?? 0,
        incentiveAfterKm: template.incentiveAfterKm ?? existing.incentiveAfterKm ?? 0,
      });
    } else {
      preserved.push({
        startTime: template.startTime,
        endTime: template.endTime,
        capacity: parseInt(template.capacity, 10) || 10,
        bookedCount: 0,
        status: "AVAILABLE",
        bookings: [],
        incentiveMode: template.incentiveMode || "none",
        incentiveRate: template.incentiveRate || 0,
        incentiveAfterKm: template.incentiveAfterKm || 0,
      });
    }
  }

  // Keep any existing slots that still have bookings (even if times changed in template)
  (existingSlots || []).forEach((s, idx) => {
    if (usedExisting.has(idx)) return;
    if (s.status === "CANCELLED") return;
    const activeBookings = (s.bookings || []).filter(
      (b) => b.status !== "CANCELLED"
    );
    if (activeBookings.length > 0 || (s.bookings || []).length > 0) {
      preserved.push(s);
    }
  });

  return preserved;
}

/** Generates date-wise Shift documents directly in single Shift collection */
const SALARY_PERIODS = {
  day: { unit: "day", perMonth: 30 },
  week: { unit: "week", perMonth: 30 / 7 },
  month: { unit: "month", perMonth: 1 },
};

export const generateDateWiseShifts = async ({
  name,
  type,
  capacity,
  customSlots,
  deliveryEarningSlabs,
  manager,
  recurrenceMode,
  targetDate,
  targetMonth,
  daysOfWeek = [],
  salary,
}) => {
  const createdShifts = [];
  const now = new Date();
  const datesToGenerate = [];

  if (recurrenceMode === "single_day") {
    const dStr = targetDate || formatDateString(now);
    datesToGenerate.push(dStr);
  } else if (recurrenceMode === "full_week") {
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dayNum = d.getDay();
      if (daysOfWeek.length === 0 || daysOfWeek.includes(dayNum)) {
        datesToGenerate.push(formatDateString(d));
      }
    }
  } else if (recurrenceMode === "full_month") {
    const [yrStr, moStr] = (targetMonth || formatDateString(now)).split("-");
    const year = parseInt(yrStr, 10) || now.getFullYear();
    const month = parseInt(moStr, 10) - 1 || now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(year, month, day));
      const dayNum = d.getUTCDay();
      if (daysOfWeek.length === 0 || daysOfWeek.includes(dayNum)) {
        datesToGenerate.push(formatDateString(d));
      }
    }
  }

  const defaultSlots = getDefaultSlotsForType(type, customSlots, capacity);

  for (const dateStr of datesToGenerate) {
    const slotDate = new Date(`${dateStr}T00:00:00.000Z`);

    const existing = await Shift.findOne({
      managerId: manager._id,
      dateString: dateStr,
      type,
    });

    if (!existing) {
      const newShift = await Shift.create({
        managerId: manager._id,
        storeId: manager._id.toString(),
        name,
        type,
        date: slotDate,
        dateString: dateStr,
        slots: defaultSlots,
        deliveryEarningSlabs: deliveryEarningSlabs || [],
        ...(salary || {}),
      });
      createdShifts.push(newShift);
    } else {
      // Update metadata / slabs / capacity — NEVER wipe rider booking history
      existing.name = name || existing.name;
      existing.slots = mergeSlotsPreserveBookings(existing.slots, defaultSlots);
      if (deliveryEarningSlabs !== undefined) {
        existing.deliveryEarningSlabs = deliveryEarningSlabs;
      }
      if (salary) Object.assign(existing, salary);
      existing.markModified("slots");
      await existing.save();
      createdShifts.push(existing);
    }
  }

  return createdShifts;
};

export const createShift = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const {
      name,
      type = "morning",
      capacity = 10,
      maxCapacityPerSlot = 10,
      customSlots = [],
      recurrenceMode = "single_day",
      targetDate,
      targetMonth,
      daysOfWeek = [],
      deliveryEarningSlabs,
      riderIds = [],
    } = req.body;

    if (deliveryEarningSlabs !== undefined && deliveryEarningSlabs.length) {
      const slabValidation = validateEarningSlabs(deliveryEarningSlabs);
      if (!slabValidation.valid) {
        return res.status(400).json({ success: false, message: slabValidation.message });
      }
    }

    let salary;
    const salaryRaw = req.body.salaryAmount ?? req.body.monthlySalary;
    if (salaryRaw !== undefined && salaryRaw !== null && salaryRaw !== "") {
      const amount = Number(salaryRaw);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ success: false, message: "Salary must be 0 or more" });
      }
      const period = req.body.salaryAmount != null ? String(req.body.salaryPeriod || "month") : "month";
      if (!SALARY_PERIODS[period]) {
        return res.status(400).json({ success: false, message: "Salary period must be day, week or month" });
      }
      salary = {
        salaryAmount: Math.round(amount),
        salaryPeriod: period,
        monthlySalary: Math.round(amount * SALARY_PERIODS[period].perMonth),
      };
    }

    const requestedRiderIds = Array.isArray(riderIds)
      ? [...new Set(riderIds.map(String).filter(Boolean))]
      : [];
    const riders = requestedRiderIds.length
      ? await DeliveryBoy.find(riderQuery(manager, { _id: { $in: requestedRiderIds } })).select("_id name")
      : [];
    if (requestedRiderIds.length && riders.length !== requestedRiderIds.length) {
      return res.status(400).json({
        success: false,
        message: "Some selected drivers do not belong to this Delivery Manager",
      });
    }

    const shiftType = String(type).toLowerCase();
    const shiftName = name || `${shiftType.replace("_", " ").toUpperCase()} Shift`;
    const slotCapacity = parseInt(capacity || maxCapacityPerSlot, 10) || 10;

    const generatedShifts = await generateDateWiseShifts({
      name: shiftName,
      type: shiftType,
      capacity: slotCapacity,
      customSlots,
      deliveryEarningSlabs: deliveryEarningSlabs || [],
      manager,
      recurrenceMode,
      targetDate,
      targetMonth,
      daysOfWeek,
      salary,
    });

    let assignedSlots = 0;
    if (riders.length) {
      const riderIdList = riders.map((r) => r._id);
      const assignedBy = req.managerOverride ? "admin" : "manager";
      for (const shift of generatedShifts) {
        for (const slot of shift.slots) {
          if (slot.status === "CANCELLED") continue;
          try {
            const fresh = await Shift.findById(shift._id);
            const result = await assignSlotToRiders({
              shift: fresh,
              slotId: slot._id,
              riderIds: riderIdList,
              assignedBy,
              notify: false,
            });
            if (result.assigned.length) assignedSlots += 1;
          } catch (_) {
            // Slot already ended today — nothing to assign.
          }
        }
      }

      if (salary) {
        await DeliveryBoy.updateMany({ _id: { $in: riderIdList } }, { $set: salary });
      }
      for (const id of riderIdList) await refreshRiderCurrentBooking(id).catch(() => {});

      const first = generatedShifts[0];
      const timeText = (first?.slots || []).map((s) => `${s.startTime} – ${s.endTime}`).join(", ");
      const dateText =
        generatedShifts.length > 1
          ? `${generatedShifts[0].dateString} to ${generatedShifts[generatedShifts.length - 1].dateString}`
          : first?.dateString || "";
      const salaryText = salary?.salaryAmount
        ? ` · ₹${salary.salaryAmount}/${SALARY_PERIODS[salary.salaryPeriod].unit}`
        : "";
      await notifyRiders({
        riderIds: riderIdList,
        type: "SHIFT_ASSIGNED",
        title: "New slot assigned",
        message: `${shiftName}: ${timeText} · ${dateText}${salaryText}`,
        priority: "high",
        dedupeKey: `shift-create:${first?._id}`,
        data: { screen: "shifts", event: "shift_assigned" },
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: riders.length
        ? `Created '${shiftName}' for ${generatedShifts.length} day(s) and assigned ${riders.length} driver(s)`
        : `Created '${shiftName}' for ${generatedShifts.length} day(s)`,
      generatedCount: generatedShifts.length,
      assignedDrivers: riders.length,
      assignedSlots,
      shifts: generatedShifts.map((s) => s.toSafeJSON()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List shifts for manager.
 * query.filter: all | upcoming | current | past
 * query.date: YYYY-MM-DD (for all / date-scoped views)
 * query.days: lookback for past (default 60)
 */
export const listShifts = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const filter = String(req.query.filter || "all").toLowerCase();
    const todayStr = istDateString();
    const currentMin = getCurrentMinutesIST();
    const dateInput = req.query.date
      ? formatDateString(req.query.date)
      : todayStr;
    const lookbackDays = Math.min(
      120,
      Math.max(7, parseInt(req.query.days, 10) || 60)
    );

    let dateQuery;
    if (filter === "past") {
      const dates = listRecentIstDates(lookbackDays).filter((d) => d <= todayStr);
      dateQuery = { dateString: { $in: dates } };
    } else if (filter === "upcoming") {
      const future = [];
      for (let i = 0; i <= 30; i++) {
        const d = new Date();
        d.setTime(d.getTime() + i * 24 * 60 * 60 * 1000);
        future.push(formatDateString(d));
      }
      dateQuery = { dateString: { $in: future } };
    } else if (filter === "current") {
      const yesterday = listRecentIstDates(2)[0];
      dateQuery = { dateString: { $in: [yesterday, todayStr] } };
    } else {
      dateQuery = { dateString: dateInput };
    }

    // Default date-wise view: only that day's shifts (fast path)
    const shifts = await Shift.find({
      managerId: manager._id,
      ...dateQuery,
    }).sort({ dateString: -1, createdAt: 1 });

    const annotate = (shiftJson) => {
      const slots = (shiftJson.slots || [])
        .filter((sl) => sl.status !== "CANCELLED")
        .map((slot) => {
          const lifecycle = getSlotLifecycle(
            shiftJson.dateString,
            slot.startTime,
            slot.endTime,
            todayStr,
            currentMin
          );
          return {
            ...slot,
            lifecycle,
            statusLabel: lifecycleToLabel(lifecycle),
            isExpired: lifecycle === "past",
            isLive: lifecycle === "current",
            shiftName: shiftJson.name || shiftJson.shiftName,
            shiftType: shiftJson.type,
            dateString: shiftJson.dateString,
            deliveryEarningSlabs: shiftJson.deliveryEarningSlabs || [],
          };
        })
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      return { ...shiftJson, slots };
    };

    // Badge counts only when filter tabs are used
    let counts = { upcoming: 0, current: 0, past: 0, total: 0 };
    if (filter !== "all") {
      const badgeDates = new Set([
        ...listRecentIstDates(lookbackDays),
        ...Array.from({ length: 31 }, (_, i) => {
          const d = new Date();
          d.setTime(d.getTime() + i * 24 * 60 * 60 * 1000);
          return formatDateString(d);
        }),
      ]);
      const badgeShifts = await Shift.find({
        managerId: manager._id,
        dateString: { $in: [...badgeDates] },
      });
      const badgeSlots = [];
      for (const s of badgeShifts) {
        const json = annotate(s.toSafeJSON());
        for (const slot of json.slots || []) badgeSlots.push(slot);
      }
      counts = {
        upcoming: badgeSlots.filter((s) => s.lifecycle === "upcoming").length,
        current: badgeSlots.filter((s) => s.lifecycle === "current").length,
        past: badgeSlots.filter((s) => s.lifecycle === "past").length,
        total: badgeSlots.length,
      };
    } else {
      const daySlots = [];
      for (const s of shifts) {
        const json = annotate(s.toSafeJSON());
        for (const slot of json.slots || []) daySlots.push(slot);
      }
      counts = {
        upcoming: daySlots.filter((s) => s.lifecycle === "upcoming").length,
        current: daySlots.filter((s) => s.lifecycle === "current").length,
        past: daySlots.filter((s) => s.lifecycle === "past").length,
        total: daySlots.length,
      };
    }

    let safeShifts = shifts
      .map((s) => annotate(s.toSafeJSON()))
      .filter((s) => (s.slots || []).length > 0);

    if (filter === "upcoming" || filter === "current" || filter === "past") {
      safeShifts = safeShifts
        .map((s) => ({
          ...s,
          slots: (s.slots || []).filter((sl) => sl.lifecycle === filter),
        }))
        .filter((s) => (s.slots || []).length > 0);
    }

    const allSlots = [];
    for (const shiftJson of safeShifts) {
      for (const slot of shiftJson.slots) {
        allSlots.push(slot);
      }
    }

    if (filter === "past") {
      allSlots.sort((a, b) =>
        String(b.dateString).localeCompare(String(a.dateString))
      );
      safeShifts.sort((a, b) =>
        String(b.dateString).localeCompare(String(a.dateString))
      );
    } else if (filter === "upcoming") {
      allSlots.sort((a, b) =>
        String(a.dateString).localeCompare(String(b.dateString))
      );
    } else {
      // Date-wise: sort slots by start time
      allSlots.sort(
        (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
      );
    }

    return res.json({
      success: true,
      date: dateInput,
      today: todayStr,
      filter,
      storeName: manager.storeName || `${manager.area} Dark Store`,
      storeAddress: manager.storeAddress || `${manager.area}, ${manager.city}`,
      shifts: safeShifts,
      slots: allSlots,
      counts,
    });
  } catch (error) {
    next(error);
  }
};

export const listManagerSlots = async (req, res, next) => {
  return listShifts(req, res, next);
};

export const updateSlotDateWise = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { slotId } = req.params;
    const { capacity, status, startTime, endTime, deliveryEarningSlabs } = req.body;

    const shift = await Shift.findOne({
      managerId: manager._id,
      $or: [{ _id: slotId }, { "slots._id": slotId }],
    });

    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift slot not found" });
    }

    const slot = shift.slots.find((s) => s._id.toString() === slotId || shift._id.toString() === slotId);

    // Validate earning slabs if provided
    if (deliveryEarningSlabs !== undefined) {
      const slabValidation = validateEarningSlabs(deliveryEarningSlabs);
      if (!slabValidation.valid) {
        return res.status(400).json({ success: false, message: slabValidation.message });
      }
      shift.deliveryEarningSlabs = deliveryEarningSlabs;
    }

    if (slot) {
      if (capacity !== undefined) {
        const capNum = parseInt(capacity, 10);
        if (capNum < slot.bookedCount) {
          return res.status(400).json({
            success: false,
            message: `Cannot reduce capacity below currently booked count (${slot.bookedCount})`,
          });
        }
        slot.capacity = capNum;
      }
      if (status) slot.status = status;
      if (startTime) slot.startTime = startTime;
      if (endTime) slot.endTime = endTime;
      if (
        req.body.incentiveMode !== undefined ||
        req.body.incentiveRate !== undefined ||
        req.body.incentiveAfterKm !== undefined
      ) {
        Object.assign(
          slot,
          normalizeSlotIncentive({
            incentiveMode: req.body.incentiveMode ?? slot.incentiveMode,
            incentiveRate: req.body.incentiveRate ?? slot.incentiveRate,
            incentiveAfterKm: req.body.incentiveAfterKm ?? slot.incentiveAfterKm,
          })
        );
      }
      shift.isCustomized = true;

      await shift.save();
    } else {
      // No slot matched but deliveryEarningSlabs may have been updated
      await shift.save();
    }

    return res.json({
      success: true,
      message: "Shift slot updated independently for this date",
      shift: shift.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

async function notifyRidersSlotCancelled(slot, dateString) {
  const activeBookings = (slot.bookings || []).filter(
    (b) => String(b.status || "").toUpperCase() !== "CANCELLED"
  );
  if (!activeBookings.length) return 0;

  const message = `Slot ${slot.startTime} – ${slot.endTime} on ${dateString} has been cancelled. Your Delivery Manager will assign you another slot.`;
  let notified = 0;

  for (const booking of activeBookings) {
    const riderId = booking.deliveryPartnerId || booking.deliveryPartnerId;
    if (!riderId) continue;
    const rider = await DeliveryBoy.findById(riderId);
    if (!rider) continue;

    rider.pendingSlotAlerts = rider.pendingSlotAlerts || [];
    rider.pendingSlotAlerts.push({
      message,
      startTime: slot.startTime,
      endTime: slot.endTime,
      dateString,
      seen: false,
      createdAt: new Date(),
    });

    if (
      rider.currentBooking?.slotId &&
      rider.currentBooking.slotId.toString() === slot._id.toString()
    ) {
      rider.currentBooking = undefined;
    }

    await rider.save();
    notified += 1;
  }

  return notified;
}

async function removeSlotFromShift(shift, slot) {
  await notifyRidersSlotCancelled(slot, shift.dateString);
  if (shift.slots.length <= 1) {
    await Shift.deleteOne({ _id: shift._id });
    return;
  }
  await Shift.updateOne({ _id: shift._id }, { $pull: { slots: { _id: slot._id } } });
}

export const deleteSlotDateWise = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { slotId } = req.params;
    const scope = String(req.body?.scope || req.query?.scope || "this_date")
      .trim()
      .toLowerCase();

    const shift = await Shift.findOne({
      managerId: manager._id,
      $or: [{ _id: slotId }, { "slots._id": slotId }],
    });

    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift slot not found" });
    }

    const slot = shift.slots.find(
      (s) => s._id.toString() === slotId || shift._id.toString() === slotId
    );
    if (!slot) {
      return res.status(404).json({ success: false, message: "Shift slot not found" });
    }

    const startTime = slot.startTime;
    const endTime = slot.endTime;
    const shiftType = shift.type;

    if (scope === "all_weeks") {
      const matchingShifts = await Shift.find({
        managerId: manager._id,
        type: shiftType,
        dateString: { $gte: shift.dateString },
      });

      let removed = 0;
      for (const s of matchingShifts) {
        const matches = (s.slots || []).filter(
          (sl) => sl.startTime === startTime && sl.endTime === endTime
        );
        for (const m of matches) {
          await removeSlotFromShift(s, m);
          removed += 1;
        }
      }

      return res.json({
        success: true,
        message: `Deleted this slot for ${removed} date(s) across available weeks.`,
        scope: "all_weeks",
        removedCount: removed,
      });
    }

    await removeSlotFromShift(shift, slot);

    return res.json({
      success: true,
      message: "Shift slot deleted for this date",
      scope: "this_date",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/delivery-managers/shifts/:shiftId/earning-slabs
 * Return the earning slabs for a specific shift.
 */
export const getShiftEarningSlabs = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { shiftId } = req.params;

    const shift = await Shift.findOne({ _id: shiftId, managerId: manager._id });
    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    return res.json({
      success: true,
      shiftId: shift._id.toString(),
      shiftName: shift.name,
      dateString: shift.dateString,
      deliveryEarningSlabs: (shift.deliveryEarningSlabs || []).map((s) => ({
        id: s._id ? s._id.toString() : undefined,
        minKm: s.minKm,
        maxKm: s.maxKm,
        riderAmount: s.riderAmount,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/delivery-managers/shifts/:shiftId/earning-slabs
 * Replace all earning slabs for a shift.
 * Validates for overlaps and invalid ranges.
 * Historical orders are NOT affected (earning is stored on each order at delivery time).
 */
export const updateShiftEarningSlabs = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { shiftId } = req.params;
    const { deliveryEarningSlabs } = req.body;

    if (!Array.isArray(deliveryEarningSlabs)) {
      return res.status(400).json({ success: false, message: "deliveryEarningSlabs must be an array" });
    }

    const validation = validateEarningSlabs(deliveryEarningSlabs);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const shift = await Shift.findOne({ _id: shiftId, managerId: manager._id });
    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    shift.deliveryEarningSlabs = deliveryEarningSlabs;
    await shift.save();

    return res.json({
      success: true,
      message: "Delivery earning slabs updated. Future deliveries under this shift will use these rates.",
      shiftId: shift._id.toString(),
      deliveryEarningSlabs: (shift.deliveryEarningSlabs || []).map((s) => ({
        id: s._id ? s._id.toString() : undefined,
        minKm: s.minKm,
        maxKm: s.maxKm,
        riderAmount: s.riderAmount,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getSlotDetailsWithRiders = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { slotId } = req.params;
    const todayStr = istDateString();
    const currentMin = getCurrentMinutesIST();

    const shift = await Shift.findOne({
      managerId: manager._id,
      $or: [{ _id: slotId }, { "slots._id": slotId }],
    });

    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift slot not found" });
    }

    const slot =
      shift.slots.find((s) => s._id.toString() === slotId) ||
      (shift._id.toString() === slotId ? shift.slots[0] : null) ||
      shift.slots[0];

    if (!slot) {
      return res.status(404).json({ success: false, message: "Slot not found on shift" });
    }

    const lifecycle = getSlotLifecycle(
      shift.dateString,
      slot.startTime,
      slot.endTime,
      todayStr,
      currentMin
    );
    const { start: windowStart, end: windowEnd } = slotTimeWindow(
      shift.dateString,
      slot.startTime,
      slot.endTime
    );

    const ridersList = (slot.bookings || [])
      .filter((b) => b.status !== "CANCELLED")
      .map((b) => ({
        bookingId: b._id.toString(),
        deliveryPartnerId: b.deliveryPartnerId.toString(),
        deliveryPartnerName: b.deliveryPartnerName || "Delivery Partner",
        deliveryPartnerPhone: b.deliveryPartnerPhone,
        deliveryPartnerProfileImage: b.deliveryPartnerProfileImage || "",
        bookedAt: b.bookedAt,
        status: b.status,
        assignedBy: b.assignedBy || "rider",
        onlineAt: b.onlineAt || null,
        completedAt: b.completedAt || null,
      }));

    const riderIds = ridersList
      .map((r) => r.deliveryPartnerId)
      .filter(Boolean);

    // Orders for this store during the shift time window
    const ordersInWindow = await StoreOrder.find({
      managerId: manager._id,
      createdAt: { $gte: windowStart, $lte: windowEnd },
    })
      .select(
        "orderNumber customerName status assignedRiderId assignedAt deliveredAt packedAt riderDeliveryEarning createdAt"
      )
      .lean();

    // Also include orders assigned/delivered in window even if created earlier
    const assignedInWindow = await StoreOrder.find({
      managerId: manager._id,
      $or: [
        { assignedAt: { $gte: windowStart, $lte: windowEnd } },
        { deliveredAt: { $gte: windowStart, $lte: windowEnd } },
      ],
    })
      .select(
        "orderNumber customerName status assignedRiderId assignedAt deliveredAt packedAt riderDeliveryEarning createdAt"
      )
      .lean();

    const orderMap = new Map();
    for (const o of [...ordersInWindow, ...assignedInWindow]) {
      orderMap.set(o._id.toString(), o);
    }
    const allOrders = [...orderMap.values()];

    const ordersReceived = allOrders.length;
    const ordersTaken = allOrders.filter((o) => o.assignedRiderId).length;
    const ordersCompleted = allOrders.filter((o) => o.status === "delivered").length;

    const formatOrder = (o) => ({
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      customerName: o.customerName || "Customer",
      status: o.status,
      assignedRiderId: o.assignedRiderId ? o.assignedRiderId.toString() : "",
      assignedAt: o.assignedAt || null,
      deliveredAt: o.deliveredAt || null,
      earning: Number(o.riderDeliveryEarning || 0),
    });

    const deliveryPartners = ridersList.map((rider) => {
      const riderOrders = allOrders.filter(
        (o) =>
          o.assignedRiderId &&
          o.assignedRiderId.toString() === rider.deliveryPartnerId
      );
      const taken = riderOrders;
      const completed = riderOrders.filter((o) => o.status === "delivered");
      return {
        ...rider,
        ordersTaken: taken.length,
        ordersCompleted: completed.length,
        earnings: completed.reduce(
          (s, o) => s + Number(o.riderDeliveryEarning || 0),
          0
        ),
        orders: taken.map(formatOrder),
        completedOrders: completed.map(formatOrder),
      };
    });

    // Riders who took orders in this window but weren't in bookings (edge case)
    const bookedIdSet = new Set(riderIds);
    const extraRiderIds = [
      ...new Set(
        allOrders
          .filter((o) => o.assignedRiderId)
          .map((o) => o.assignedRiderId.toString())
          .filter((id) => !bookedIdSet.has(id))
      ),
    ];
    if (extraRiderIds.length) {
      const extras = await DeliveryBoy.find({ _id: { $in: extraRiderIds } })
        .select("name phone")
        .lean();
      for (const boy of extras) {
        const id = boy._id.toString();
        const riderOrders = allOrders.filter(
          (o) => o.assignedRiderId && o.assignedRiderId.toString() === id
        );
        const completed = riderOrders.filter((o) => o.status === "delivered");
        deliveryPartners.push({
          bookingId: `extra_${id}`,
          deliveryPartnerId: id,
          deliveryPartnerName: boy.name || "Delivery Partner",
          deliveryPartnerPhone: boy.phone || "",
          deliveryPartnerProfileImage: "",
          bookedAt: null,
          status: "ACTIVE",
          ordersTaken: riderOrders.length,
          ordersCompleted: completed.length,
          earnings: completed.reduce(
            (s, o) => s + Number(o.riderDeliveryEarning || 0),
            0
          ),
          orders: riderOrders.map(formatOrder),
          completedOrders: completed.map(formatOrder),
          notBookedOnSlot: true,
        });
      }
    }

    return res.json({
      success: true,
      shift: shift.toSafeJSON(),
      slotId: slot._id.toString(),
      shiftName: shift.name,
      dateString: shift.dateString,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      bookedCount: slot.bookedCount,
      remainingCapacity: Math.max(0, slot.capacity - slot.bookedCount),
      incentiveMode: slot.incentiveMode || "none",
      incentiveRate: Number(slot.incentiveRate) || 0,
      incentiveAfterKm: Number(slot.incentiveAfterKm) || 0,
      lifecycle,
      statusLabel: lifecycleToLabel(lifecycle),
      isExpired: lifecycle === "past",
      window: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
      },
      summary: {
        ridersJoined: ridersList.length,
        ordersReceived,
        ordersTaken,
        ordersCompleted,
      },
      ordersReceivedList: allOrders.map(formatOrder),
      deliveryPartners,
      deliveryEarningSlabs: (shift.deliveryEarningSlabs || []).map((s) => ({
        minKm: s.minKm,
        maxKm: s.maxKm,
        riderAmount: s.riderAmount,
      })),
    });
  } catch (error) {
    next(error);
  }
};

const findShiftForSlot = (manager, slotId) =>
  Shift.findOne({ managerId: manager._id, "slots._id": slotId });

/** Part-time riders of this dark store that can be assigned to slots. */
export const listAssignableRiders = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const riders = await DeliveryBoy.find(
      riderQuery(manager, { isActive: true, employmentType: { $ne: "FULL_TIME" } })
    )
      .select("name phone status vehicleType employmentType")
      .sort({ name: 1 })
      .lean();
    return res.json({
      success: true,
      riders: riders.map((r) => ({
        id: String(r._id),
        name: r.name || "Delivery Partner",
        phone: r.phone || "",
        status: r.status,
        vehicleType: r.vehicleType,
        employmentType: r.employmentType || "PART_TIME",
      })),
    });
  } catch (error) {
    next(error);
  }
};

/** POST /shifts/slots/:slotId/assign  body: { riderIds: [...] } or { all: true } */
export const assignSlotRiders = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const shift = await findShiftForSlot(manager, req.params.slotId);
    if (!shift) {
      return res.status(404).json({ success: false, message: "Slot not found" });
    }

    const all = req.body?.all === true;
    const requested = Array.isArray(req.body?.riderIds)
      ? [...new Set(req.body.riderIds.map(String).filter(Boolean))]
      : [];
    if (!all && !requested.length) {
      return res.status(400).json({ success: false, message: "Select at least one delivery partner" });
    }

    const filter = all
      ? { isActive: true, employmentType: { $ne: "FULL_TIME" } }
      : { _id: { $in: requested } };
    const riders = await DeliveryBoy.find(riderQuery(manager, filter)).select("_id");
    if (!riders.length) {
      return res.status(400).json({
        success: false,
        message: "No delivery partners found under this Delivery Manager",
      });
    }

    const result = await assignSlotToRiders({
      shift,
      slotId: req.params.slotId,
      riderIds: riders.map((r) => r._id),
      assignedBy: req.managerOverride ? "admin" : "manager",
    });
    return res.json({
      success: true,
      message: `${result.assigned.length} delivery partner(s) assigned`,
      ...result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/** DELETE /shifts/slots/:slotId/assign/:riderId */
export const unassignSlotRider = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const shift = await findShiftForSlot(manager, req.params.slotId);
    if (!shift) {
      return res.status(404).json({ success: false, message: "Slot not found" });
    }
    const result = await unassignRiderFromSlot({
      shift,
      slotId: req.params.slotId,
      riderId: req.params.riderId,
    });
    return res.json({ success: true, message: "Delivery partner removed from slot", ...result });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

