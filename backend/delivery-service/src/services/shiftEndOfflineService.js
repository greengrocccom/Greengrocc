import DeliveryBoy from "../models/DeliveryBoy.js";
import FullTimeRule from "../models/FullTimeRule.js";
import Shift from "../models/Shift.js";
import { getIO } from "../../../socket.js";
import {
  applyGigStatusChange,
  emitRiderStatusUpdated,
} from "./riderSocketService.js";
import { istDateString } from "../utils/onlineHoursHelper.js";
import { getDriverFullTimeShift, istDayOfWeek } from "./fullTimeService.js";
import {
  getCurrentMinutesIST,
  isSlotEnded,
  timeToMinutes,
} from "../utils/shiftTimeHelper.js";
import { findLiveGigForManager } from "../controllers/gigManagementController.js";
import { getRiderManager } from "../controllers/shiftController.js";

const POLL_MS = 5000;
/** Rider stays online this many minutes after shift/gig end, then auto-offline. */
const END_GRACE_MINUTES = 5;
let _running = false;
let _timer = null;

/**
 * Minutes past slot end (IST). Returns -1 if slot has not ended yet.
 * Auto-offline should run when this is >= END_GRACE_MINUTES.
 */
function minutesPastSlotEnd(
  startTime,
  endTime,
  currentMinutes,
  dateString = "",
  todayStr = ""
) {
  if (
    !isSlotEnded(startTime, endTime, currentMinutes, dateString, todayStr)
  ) {
    return -1;
  }

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  if (dateString && todayStr && dateString < todayStr) {
    // Overnight slot that spilled into today morning
    if (endMin <= startMin) {
      const d = new Date(`${dateString}T12:00:00+05:30`);
      d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
      const nextDay = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
      if (todayStr === nextDay && currentMinutes < endMin) return -1;
      if (todayStr === nextDay) return currentMinutes - endMin;
    }
    return 9999;
  }

  if (endMin > startMin) {
    return currentMinutes - endMin;
  }

  // Overnight: ended after midnight on next calendar day
  return currentMinutes >= endMin ? currentMinutes - endMin : 9999;
}

function shouldForceOfflineAfterEnd(
  startTime,
  endTime,
  currentMinutes,
  dateString = "",
  todayStr = ""
) {
  const past = minutesPastSlotEnd(
    startTime,
    endTime,
    currentMinutes,
    dateString,
    todayStr
  );
  return past >= END_GRACE_MINUTES;
}

/**
 * Force a rider offline after their booked shift slot ends.
 * Updates profile status, marks booking COMPLETED, notifies rider + manager dashboards.
 */
async function forceRiderOfflineForEndedShift(rider, shift, slot, booking) {
  const wasOnline = rider.status === "online";
  const wasOnDelivery = rider.status === "on_delivery";

  // Mark booking completed on the shift
  if (booking && booking.status !== "COMPLETED" && booking.status !== "CANCELLED") {
    booking.status = "COMPLETED";
    booking.completedAt = new Date();
  }

  // Clear booking pointer on rider
  rider.currentBooking = {
    shiftId: null,
    slotId: null,
    bookingId: null,
  };

  if (wasOnline) {
    await applyGigStatusChange(rider, "offline");
  } else if (wasOnDelivery) {
    // Don't interrupt active delivery — stay on_delivery but booking is cleared.
    // After delivery completes they won't remain "shift-online".
    rider.lastStatusAt = new Date();
  }

  await rider.save();
  if (shift) await shift.save().catch(() => {});

  const extras = { reason: "shift_ended", todayOnlineMinutes: rider.todayOnlineMinutes || 0 };
  await emitRiderStatusUpdated(rider, extras);

  try {
    const io = getIO();
    io.to(`rider_${rider._id}`).emit("forced_offline", {
      reason: "shift_ended",
      message:
        "Your shift has ended. You were kept online for 5 more minutes and are now offline.",
      status: rider.status,
      endTime: slot?.endTime || "",
      dateString: shift?.dateString || "",
      graceMinutes: END_GRACE_MINUTES,
    });
    if (wasOnline) {
      io.to(`rider_${rider._id}`).emit("status_updated", {
        status: "offline",
        reason: "shift_ended",
      });
    }
  } catch (_) {}

  console.log(
    `[ShiftEndOffline] Rider ${rider._id} (${rider.phone || rider.name}) — shift ended${
      wasOnline ? ", forced OFFLINE" : " (on delivery, booking cleared)"
    }`
  );
}

async function processRiderWithBooking(rider) {
  const shiftId = rider.currentBooking?.shiftId;
  if (!shiftId) return false;

  const shift = await Shift.findById(shiftId);
  if (!shift) {
    // Orphan pointer — clear and offline if online
    rider.currentBooking = { shiftId: null, slotId: null, bookingId: null };
    if (rider.status === "online") {
      await applyGigStatusChange(rider, "offline");
    }
    await rider.save();
    await emitRiderStatusUpdated(rider, { reason: "shift_missing" });
    return true;
  }

  const todayStr = istDateString();
  const currentMin = getCurrentMinutesIST();

  // Past-day bookings are always ended
  const pastDay = shift.dateString && shift.dateString < todayStr;

  const slot =
    (rider.currentBooking.slotId && shift.slots.id(rider.currentBooking.slotId)) ||
    null;

  if (!slot) {
    rider.currentBooking = { shiftId: null, slotId: null, bookingId: null };
    if (rider.status === "online") {
      await applyGigStatusChange(rider, "offline");
    }
    await rider.save();
    await emitRiderStatusUpdated(rider, { reason: "slot_missing" });
    return true;
  }

  const booking =
    (rider.currentBooking.bookingId &&
      (slot.bookings.id(rider.currentBooking.bookingId) ||
        slot.bookings.find(
          (b) =>
            b._id?.toString() === rider.currentBooking.bookingId.toString() ||
            b.bookingId === rider.currentBooking.bookingId.toString()
        ))) ||
    slot.bookings.find(
      (b) => b.deliveryPartnerId?.toString() === rider._id.toString()
    );

  const forceNow =
    pastDay ||
    shouldForceOfflineAfterEnd(
      slot.startTime,
      slot.endTime,
      currentMin,
      shift.dateString,
      todayStr
    );

  if (!forceNow) return false;

  await forceRiderOfflineForEndedShift(rider, shift, slot, booking);
  return true;
}

/**
 * Also catch online riders whose booking pointer is missing but today's shift slot ended.
 */
async function processOnlineRidersWithoutPointer() {
  const todayStr = istDateString();
  const currentMin = getCurrentMinutesIST();

  const onlineRiders = await DeliveryBoy.find({
    status: "online",
    $or: [
      { "currentBooking.shiftId": null },
      { "currentBooking.shiftId": { $exists: false } },
    ],
  }).limit(200);

  if (!onlineRiders.length) return;

  const shifts = await Shift.find({
    dateString: todayStr,
    "slots.bookings.deliveryPartnerId": {
      $in: onlineRiders.map((r) => r._id),
    },
  });

  for (const rider of onlineRiders) {
    let matched = null;
    for (const shift of shifts) {
      for (const slot of shift.slots || []) {
        const booking = (slot.bookings || []).find(
          (b) =>
            b.deliveryPartnerId?.toString() === rider._id.toString() &&
            b.status !== "CANCELLED" &&
            b.status !== "COMPLETED"
        );
        if (!booking) continue;
        if (
          shouldForceOfflineAfterEnd(
            slot.startTime,
            slot.endTime,
            currentMin,
            shift.dateString,
            todayStr
          )
        ) {
          matched = { shift, slot, booking };
          break;
        }
      }
      if (matched) break;
    }
    if (matched) {
      await forceRiderOfflineForEndedShift(
        rider,
        matched.shift,
        matched.slot,
        matched.booking
      );
    }
  }
}

/**
 * Gig-only online riders (no shift booking): force offline 5 min after live gig ends,
 * or immediately if there is no live gig and no active shift today.
 */
async function processGigOnlyOnlineRiders() {
  const todayStr = istDateString();
  const currentMin = getCurrentMinutesIST();

  const onlineRiders = await DeliveryBoy.find({
    status: "online",
    // Full-Time drivers have no Part-Time bookings/gigs by design.
    employmentType: { $ne: "FULL_TIME" },
    $or: [
      { "currentBooking.shiftId": null },
      { "currentBooking.shiftId": { $exists: false } },
    ],
  }).limit(200);

  for (const rider of onlineRiders) {
    try {
      // Still has a non-ended shift booking today → leave alone
      const shift = await Shift.findOne({
        dateString: todayStr,
        "slots.bookings.deliveryPartnerId": rider._id,
      });
      let hasActiveOrGraceShift = false;
      if (shift) {
        for (const slot of shift.slots || []) {
          const booking = (slot.bookings || []).find(
            (b) =>
              b.deliveryPartnerId?.toString() === rider._id.toString() &&
              b.status !== "CANCELLED" &&
              b.status !== "COMPLETED"
          );
          if (!booking) continue;
          const past = minutesPastSlotEnd(
            slot.startTime,
            slot.endTime,
            currentMin,
            shift.dateString,
            todayStr
          );
          if (past < END_GRACE_MINUTES) {
            hasActiveOrGraceShift = true;
            break;
          }
        }
      }
      if (hasActiveOrGraceShift) continue;

      const manager = await getRiderManager(rider).catch(() => null);
      if (!manager?._id) {
        await applyGigStatusChange(rider, "offline");
        await rider.save();
        await emitRiderStatusUpdated(rider, { reason: "no_shift_or_gig" });
        continue;
      }

      const liveGig = await findLiveGigForManager(manager._id);
      if (liveGig) continue;

      // No live gig — check today's gigs for 5-min grace after end
      const Gig = (await import("../models/Gig.js")).default;
      const gigs = await Gig.find({
        isActive: true,
        managerId: manager._id,
        dateString: todayStr,
      });
      let inGrace = false;
      for (const g of gigs) {
        if (!g.startTime || !g.endTime) continue;
        const past = minutesPastSlotEnd(
          g.startTime,
          g.endTime,
          currentMin,
          g.dateString,
          todayStr
        );
        if (past >= 0 && past < END_GRACE_MINUTES) {
          inGrace = true;
          break;
        }
      }
      if (inGrace) continue;

      await applyGigStatusChange(rider, "offline");
      await rider.save();
      await emitRiderStatusUpdated(rider, { reason: "gig_ended" });
      try {
        const io = getIO();
        io.to(`rider_${rider._id}`).emit("forced_offline", {
          reason: "gig_ended",
          message:
            "Your gig window has ended. You were kept online for 5 more minutes and are now offline.",
          status: "offline",
          graceMinutes: END_GRACE_MINUTES,
        });
      } catch (_) {}
      console.log(
        `[ShiftEndOffline] Rider ${rider._id} — no live gig/shift, forced OFFLINE`
      );
    } catch (err) {
      console.warn(
        `[ShiftEndOffline] Gig-only check failed for ${rider._id}:`,
        err.message
      );
    }
  }
}

async function processFullTimeRuleEndRiders() {
  const riders = await DeliveryBoy.find({ status: "online", employmentType: "FULL_TIME", isActive: true }).limit(300);
  if (!riders.length) return;
  const today = istDateString();
  const yesterdayDate = new Date(`${today}T12:00:00+05:30`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = istDateString(yesterdayDate);
  const day = istDayOfWeek(today);
  const previousDay = (day + 6) % 7;
  const current = getCurrentMinutesIST();

  for (const rider of riders) {
    try {
      const manager = await getRiderManager(rider);
      if (!manager) continue;
      const shift = await getDriverFullTimeShift(manager._id, rider._id);
      // Full-Time Rules have no shared end time. Only an individual assigned
      // shift can automatically end this rider's online session.
      if (!shift) continue;
      if (shift.scheduleStartDate && today < shift.scheduleStartDate) continue;
      if (shift.scheduleEndDate && today > shift.scheduleEndDate) continue;
      if ((shift.excludedDates || []).includes(today)) continue;
      const days = shift.workingDays?.length ? shift.workingDays : [0, 1, 2, 3, 4, 5, 6];
      const scheduledToday = days.includes(day);
      const scheduledYesterday = days.includes(previousDay);
      const overnight = timeToMinutes(shift.endTime) <= timeToMinutes(shift.startTime);
      const ended = (scheduledToday && shouldForceOfflineAfterEnd(shift.startTime, shift.endTime, current, today, today)) ||
        (overnight && scheduledYesterday && shouldForceOfflineAfterEnd(shift.startTime, shift.endTime, current, yesterday, today));
      if (!ended) continue;

      await applyGigStatusChange(rider, "offline");
      await rider.save();
      await emitRiderStatusUpdated(rider, { todayOnlineMinutes: rider.todayOnlineMinutes || 0 });
      try {
        getIO().to(`rider_${rider._id}`).emit("forced_offline", {
          reason: "full_time_shift_ended",
          message: "Your assigned Full-Time shift has ended. You are now offline.",
          status: "offline",
          graceMinutes: END_GRACE_MINUTES,
        });
      } catch (_) {}
    } catch (err) {
      console.warn(`[FullTimeShiftEnd] Failed for rider ${rider._id}:`, err.message);
    }
  }
}

export async function forceOfflineEndedShiftRiders() {
  if (_running) return;
  _running = true;
  try {
    const riders = await DeliveryBoy.find({
      status: { $in: ["online", "on_delivery"] },
      "currentBooking.shiftId": { $ne: null },
    }).limit(300);

    for (const rider of riders) {
      try {
        await processRiderWithBooking(rider);
      } catch (err) {
        console.warn(
          `[ShiftEndOffline] Failed for rider ${rider._id}:`,
          err.message
        );
      }
    }

    try {
      await processOnlineRidersWithoutPointer();
    } catch (err) {
      console.warn("[ShiftEndOffline] Fallback scan failed:", err.message);
    }

    try {
      await processGigOnlyOnlineRiders();
    } catch (err) {
      console.warn("[ShiftEndOffline] Gig-only scan failed:", err.message);
    }

    try {
      await processFullTimeRuleEndRiders();
    } catch (err) {
      console.warn("[FullTimeRuleEnd] Sweep failed:", err.message);
    }
  } catch (err) {
    console.error("[ShiftEndOffline] Tick error:", err.message);
  } finally {
    _running = false;
  }
}

/** Poll every 5 seconds; force offline 5 minutes after shift/gig end. */
export function initShiftEndOfflineCron() {
  if (_timer) return;
  _timer = setInterval(() => {
    forceOfflineEndedShiftRiders();
  }, POLL_MS);
  // First run shortly after boot
  setTimeout(() => forceOfflineEndedShiftRiders(), 2000);
  console.log(
    `[ShiftEndOffline] Auto-offline job scheduled (every 5s; ${END_GRACE_MINUTES} min grace after shift/gig end).`
  );
}
