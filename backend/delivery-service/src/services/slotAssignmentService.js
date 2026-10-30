/**
 * Slot assignment (Admin / Delivery Manager → riders) and slot incentives.
 *
 * Assigned slots are stored as regular Shift.slots[].bookings so every existing
 * reader (go-online gate, shift reminders, auto-offline, earnings) keeps working.
 */
import mongoose from "mongoose";
import Shift from "../models/Shift.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { getIO } from "../../../socket.js";
import { notifyRiders } from "./RiderNotificationService.js";
import { timeToMinutes } from "../utils/shiftTimeHelper.js";
import { istDateString } from "../utils/onlineHoursHelper.js";

const ACTIVE_BOOKING = (b) => b.status !== "CANCELLED";

function istDateAtMinutes(dateString, minutes) {
  const m = Math.max(0, minutes);
  const hh = String(Math.floor(m / 60) % 24).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  const base = new Date(`${dateString}T${hh}:${mm}:00+05:30`);
  if (m >= 24 * 60) base.setTime(base.getTime() + 24 * 60 * 60 * 1000);
  return base;
}

/** Real start/end Dates of a slot on its IST date (handles overnight slots). */
export function slotWindow(dateString, startTime, endTime) {
  const startMin = timeToMinutes(startTime);
  let endMin = timeToMinutes(endTime);
  if (endMin <= startMin) endMin += 24 * 60;
  return {
    start: istDateAtMinutes(dateString, startMin),
    end: istDateAtMinutes(dateString, endMin),
  };
}

function emit(rooms, event, payload) {
  try {
    const io = getIO();
    for (const room of rooms) io.to(room).emit(event, payload);
  } catch (_) {}
}

/**
 * Point rider.currentBooking at the earliest booking that has not ended yet,
 * so the go-online gate and earning slabs pick the right slot.
 */
export async function refreshRiderCurrentBooking(riderId) {
  const rider = await DeliveryBoy.findById(riderId);
  if (!rider) return null;
  const today = istDateString();
  const now = Date.now();
  const shifts = await Shift.find({
    dateString: { $gte: today },
    "slots.bookings.deliveryPartnerId": rider._id,
  });

  let best = null;
  for (const shift of shifts) {
    for (const slot of shift.slots || []) {
      if (slot.status === "CANCELLED") continue;
      const booking = (slot.bookings || []).find(
        (b) =>
          String(b.deliveryPartnerId) === String(rider._id) &&
          !["CANCELLED", "COMPLETED"].includes(b.status)
      );
      if (!booking) continue;
      const { start, end } = slotWindow(shift.dateString, slot.startTime, slot.endTime);
      if (end.getTime() <= now) continue;
      if (!best || start.getTime() < best.start) {
        best = { start: start.getTime(), shiftId: shift._id, slotId: slot._id, bookingId: booking._id };
      }
    }
  }

  rider.currentBooking = best
    ? { shiftId: best.shiftId, slotId: best.slotId, bookingId: best.bookingId }
    : { shiftId: null, slotId: null, bookingId: null };
  await rider.save();
  return rider.currentBooking;
}

/**
 * Assign one slot to many riders. Riders already on the slot are skipped;
 * capacity grows automatically when the manager assigns more riders than planned.
 */
export async function assignSlotToRiders({
  shift,
  slotId,
  riderIds,
  assignedBy = "manager",
  notify = true,
}) {
  const slot = shift.slots.id(slotId);
  if (!slot) {
    const err = new Error("Slot not found");
    err.statusCode = 404;
    throw err;
  }
  if (slot.status === "CANCELLED") {
    const err = new Error("This slot is cancelled");
    err.statusCode = 400;
    throw err;
  }
  const { end } = slotWindow(shift.dateString, slot.startTime, slot.endTime);
  if (end.getTime() <= Date.now()) {
    const err = new Error("This slot has already ended");
    err.statusCode = 400;
    throw err;
  }

  const riders = await DeliveryBoy.find({ _id: { $in: riderIds } });
  const assigned = [];
  const skipped = [];

  for (const rider of riders) {
    const existing = (slot.bookings || []).find(
      (b) => String(b.deliveryPartnerId) === String(rider._id)
    );
    if (existing && ACTIVE_BOOKING(existing)) {
      skipped.push({ riderId: String(rider._id), reason: "Already assigned" });
      continue;
    }
    if (existing) {
      existing.status = "UPCOMING";
      existing.assignedBy = assignedBy;
      existing.bookedAt = new Date();
      existing.notificationEnabled = true;
      assigned.push({ rider, bookingId: existing._id });
      continue;
    }
    const oid = new mongoose.Types.ObjectId();
    slot.bookings.push({
      _id: oid,
      bookingId: oid.toString(),
      deliveryPartnerId: rider._id,
      deliveryPartnerPhone: rider.phone || "",
      deliveryPartnerName: rider.name || "Delivery Partner",
      deliveryPartnerProfileImage: rider.selfie?.imageBase64 || "",
      bookedAt: new Date(),
      status: "UPCOMING",
      notificationEnabled: true,
      notificationTimeMinutes: 15,
      assignedBy,
    });
    assigned.push({ rider, bookingId: oid });
  }

  slot.bookedCount = slot.bookings.filter(ACTIVE_BOOKING).length;
  if (slot.capacity < slot.bookedCount) slot.capacity = slot.bookedCount;
  shift.markModified("slots");
  await shift.save();

  for (const { rider, bookingId } of assigned) {
    if (notify) await refreshRiderCurrentBooking(rider._id).catch(() => {});
    emit([`store_${shift.managerId}`], "rider_shift_booked", {
      shiftId: String(shift._id),
      slotId: String(slot._id),
      bookingId: String(bookingId),
      riderId: String(rider._id),
      name: rider.name,
      phone: rider.phone,
      bookedAt: new Date(),
      assignedBy,
    });
    emit([`rider_${rider._id}`, `rider:${rider._id}`], "active_delivery_updated", {
      reason: "shift_assigned",
    });
  }
  emit([`store_${shift.managerId}`], "shift_updated", { shiftId: String(shift._id) });

  if (assigned.length && notify) {
    const incentive =
      slot.incentiveMode === "per_km"
        ? slot.incentiveAfterKm > 0
          ? ` · ₹${slot.incentiveRate}/km after ${slot.incentiveAfterKm} km`
          : ` · ₹${slot.incentiveRate}/km incentive`
        : slot.incentiveMode === "per_hour"
          ? ` · ₹${slot.incentiveRate}/hr incentive`
          : "";
    await notifyRiders({
      riderIds: assigned.map((a) => a.rider._id),
      type: "SHIFT_ASSIGNED",
      title: "New slot assigned",
      message: `${shift.dateString} · ${slot.startTime} – ${slot.endTime}${incentive}`,
      priority: "high",
      dedupeKey: `${slot._id}:assigned:${assigned.map((a) => String(a.bookingId)).sort().join(",")}`,
      data: {
        screen: "shifts",
        shiftId: String(shift._id),
        slotId: String(slot._id),
        dateString: shift.dateString,
        startTime: slot.startTime,
        endTime: slot.endTime,
        event: "shift_assigned",
      },
    }).catch(() => {});
  }

  return {
    assigned: assigned.map((a) => ({ riderId: String(a.rider._id), name: a.rider.name, phone: a.rider.phone })),
    skipped,
    slot: { id: String(slot._id), bookedCount: slot.bookedCount, capacity: slot.capacity },
  };
}

export async function unassignRiderFromSlot({ shift, slotId, riderId }) {
  const slot = shift.slots.id(slotId);
  if (!slot) {
    const err = new Error("Slot not found");
    err.statusCode = 404;
    throw err;
  }
  const booking = (slot.bookings || []).find(
    (b) => String(b.deliveryPartnerId) === String(riderId) && ACTIVE_BOOKING(b)
  );
  if (!booking) {
    const err = new Error("Rider is not assigned to this slot");
    err.statusCode = 404;
    throw err;
  }
  booking.status = "CANCELLED";
  slot.bookedCount = slot.bookings.filter(ACTIVE_BOOKING).length;
  shift.markModified("slots");
  await shift.save();
  await refreshRiderCurrentBooking(riderId).catch(() => {});

  emit([`store_${shift.managerId}`], "rider_shift_cancelled", {
    shiftId: String(shift._id),
    slotId: String(slot._id),
    riderId: String(riderId),
  });
  emit([`rider_${riderId}`, `rider:${riderId}`], "active_delivery_updated", {
    reason: "shift_unassigned",
  });
  await notifyRiders({
    riderIds: [riderId],
    type: "SHIFT_ASSIGNED",
    title: "Slot removed",
    message: `You were removed from ${shift.dateString} · ${slot.startTime} – ${slot.endTime}`,
    dedupeKey: `${slot._id}:removed:${Date.now()}`,
    data: { screen: "shifts", event: "shift_unassigned" },
  }).catch(() => {});

  return { slot: { id: String(slot._id), bookedCount: slot.bookedCount } };
}

/** Credit an incentive straight to the wallet (no 5-minute hold) and tell the app. */
export async function creditSlotIncentive({
  riderId,
  amount,
  mode,
  rate,
  units,
  shiftId,
  slotId,
  orderId = null,
  dateString,
  label,
}) {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  if (value <= 0 || !riderId) return null;
  const day = dateString || istDateString();

  const rider = await DeliveryBoy.findByIdAndUpdate(
    riderId,
    {
      $inc: { walletBalance: value, todayEarnings: value, totalLifetimeEarnings: value },
      $push: {
        incentiveCredits: {
          month: day.slice(0, 7),
          dateString: day,
          mode,
          rate,
          units,
          amount: value,
          shiftId,
          slotId,
          orderId,
          label,
          creditedAt: new Date(),
        },
      },
    },
    { new: true }
  );
  if (!rider) return null;

  const payload = {
    riderId: String(riderId),
    amount: value,
    reason: "slot_incentive",
    walletBalance: rider.walletBalance ?? 0,
    todayEarnings: rider.todayEarnings ?? 0,
    totalLifetimeEarnings: rider.totalLifetimeEarnings ?? 0,
    message: `₹${value} incentive credited — ${label}`,
    timestamp: new Date().toISOString(),
  };
  emit([`rider_${riderId}`, `rider:${riderId}`], "wallet_updated", payload);
  emit([`rider_${riderId}`, `rider:${riderId}`], "rider_wallet_credited", payload);

  await notifyRiders({
    riderIds: [riderId],
    type: "INCENTIVE_CREDITED",
    title: `₹${value} incentive added`,
    message: label,
    amount: value,
    dedupeKey: orderId ? `${slotId || ""}:${orderId}` : `${slotId || ""}:${mode}:${Date.now()}`,
    data: { screen: "wallet", amount: String(value), event: "incentive_credited" },
  }).catch(() => {});

  return value;
}

/** Find the rider's booked slot whose window contains `at`. */
async function findSlotAt(riderId, at = new Date()) {
  const day = istDateString(at);
  const yesterday = istDateString(new Date(at.getTime() - 24 * 60 * 60 * 1000));
  const shifts = await Shift.find({
    dateString: { $in: [day, yesterday] },
    "slots.bookings.deliveryPartnerId": riderId,
  });
  for (const shift of shifts) {
    for (const slot of shift.slots || []) {
      const booking = (slot.bookings || []).find(
        (b) => String(b.deliveryPartnerId) === String(riderId) && ACTIVE_BOOKING(b)
      );
      if (!booking) continue;
      const { start, end } = slotWindow(shift.dateString, slot.startTime, slot.endTime);
      if (at >= start && at <= end) return { shift, slot, booking };
    }
  }
  return null;
}

/** Per-km slot incentive for a delivered order (called on delivery completion). */
export async function creditKmIncentiveForOrder(order, riderId) {
  try {
    if (!order || !riderId) return null;
    const match = await findSlotAt(riderId, new Date());
    if (!match || match.slot.incentiveMode !== "per_km" || !(match.slot.incentiveRate > 0)) {
      return null;
    }
    const km = Number(order.distanceKm ?? order.earningSnapshot?.distanceKm ?? 0);
    if (!(km > 0)) return null;
    const orderKm = Math.round(km * 100) / 100;

    const alreadyCounted = await DeliveryBoy.exists({
      _id: riderId,
      incentiveCredits: { $elemMatch: { orderId: order._id, mode: "per_km" } },
    });
    if (alreadyCounted) return null;

    const updated = await Shift.findOneAndUpdate(
      { _id: match.shift._id },
      { $inc: { "slots.$[s].bookings.$[b].kmDelivered": orderKm } },
      {
        new: true,
        arrayFilters: [{ "s._id": match.slot._id }, { "b._id": match.booking._id }],
      }
    );
    const total =
      Number(
        updated?.slots?.id(match.slot._id)?.bookings?.id(match.booking._id)?.kmDelivered
      ) || orderKm;
    const before = Math.max(0, total - orderKm);
    const afterKm = Math.max(0, Number(match.slot.incentiveAfterKm) || 0);
    const units = Math.round(Math.max(0, total - Math.max(before, afterKm)) * 100) / 100;
    if (!(units > 0)) return null;

    const rate = match.slot.incentiveRate;
    return creditSlotIncentive({
      riderId,
      amount: units * rate,
      mode: "per_km",
      rate,
      units,
      shiftId: match.shift._id,
      slotId: match.slot._id,
      orderId: order._id,
      dateString: match.shift.dateString,
      label: afterKm > 0
        ? `${units} km beyond ${afterKm} km × ₹${rate}/km · Order #${order.orderNumber || ""}`
        : `${units} km × ₹${rate}/km · Order #${order.orderNumber || ""}`,
    });
  } catch (err) {
    console.warn("[slotIncentive] km credit failed:", err.message);
    return null;
  }
}

/** True when the rider's latest online session in this slot has not been paid yet. */
function hasUnpaidSession(booking) {
  if (!booking?.onlineAt) return false;
  const paidUntil = booking.hourIncentivePaidUntil;
  return !paidUntil || new Date(booking.onlineAt) > new Date(paidUntil);
}

/**
 * Per-hour slot incentive: hours online inside the slot window × rate.
 * Each online session is paid when the rider goes offline or the slot ends.
 */
export async function creditHourIncentiveForBooking(shift, slot, booking, endAt = new Date()) {
  try {
    if (slot.incentiveMode !== "per_hour" || !(slot.incentiveRate > 0)) return null;
    if (!hasUnpaidSession(booking)) return null;
    const { start, end } = slotWindow(shift.dateString, slot.startTime, slot.endTime);
    const from = Math.max(start.getTime(), new Date(booking.onlineAt).getTime());
    const to = Math.min(end.getTime(), endAt.getTime());
    const hours = Math.round((Math.max(0, to - from) / 3600000) * 100) / 100;

    const previous = booking.hourIncentivePaidUntil || null;
    const claimed = await Shift.updateOne(
      { _id: shift._id, "slots._id": slot._id },
      { $set: { "slots.$[s].bookings.$[b].hourIncentivePaidUntil": new Date(to) } },
      {
        arrayFilters: [
          { "s._id": slot._id },
          { "b._id": booking._id, "b.hourIncentivePaidUntil": previous },
        ],
      }
    );
    if (!claimed.modifiedCount || hours <= 0) return null;

    return creditSlotIncentive({
      riderId: booking.deliveryPartnerId,
      amount: hours * slot.incentiveRate,
      mode: "per_hour",
      rate: slot.incentiveRate,
      units: hours,
      shiftId: shift._id,
      slotId: slot._id,
      dateString: shift.dateString,
      label: `${hours} hr × ₹${slot.incentiveRate}/hr · ${slot.startTime} – ${slot.endTime}`,
    });
  } catch (err) {
    console.warn("[slotIncentive] hour credit failed:", err.message);
    return null;
  }
}

/** Rider went offline in the middle of a per-hour slot: pay the hours worked so far. */
export async function creditHourIncentiveOnOffline(riderId, at = new Date()) {
  try {
    const match = await findSlotAt(riderId, at);
    if (!match) return null;
    return creditHourIncentiveForBooking(match.shift, match.slot, match.booking, at);
  } catch (err) {
    console.warn("[slotIncentive] offline hour credit failed:", err.message);
    return null;
  }
}

/** Pay hour incentives for every ended slot that has unpaid online bookings. */
export async function settleEndedHourIncentives() {
  const today = istDateString();
  const yesterday = istDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const shifts = await Shift.find({
    dateString: { $in: [today, yesterday] },
    "slots.incentiveMode": "per_hour",
  });
  const now = new Date();
  for (const shift of shifts) {
    for (const slot of shift.slots || []) {
      if (slot.incentiveMode !== "per_hour") continue;
      const { end } = slotWindow(shift.dateString, slot.startTime, slot.endTime);
      if (end > now) continue;
      for (const booking of slot.bookings || []) {
        if (!ACTIVE_BOOKING(booking) || !hasUnpaidSession(booking)) continue;
        await creditHourIncentiveForBooking(shift, slot, booking, end);
      }
    }
  }
}