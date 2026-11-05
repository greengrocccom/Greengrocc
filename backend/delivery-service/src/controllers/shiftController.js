import mongoose from "mongoose";
import Shift from "../models/Shift.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import { getIO } from "../../../socket.js";
import {
  getCurrentMinutesIST,
  getSlotLifecycle,
  isSlotEnded,
  isWithinSlot,
  timeToMinutes,
} from "../utils/shiftTimeHelper.js";

/** Formats Date or string into "YYYY-MM-DD" string in IST (Asia/Kolkata) timezone */
export const formatDateStringIST = (d) => {
  const date = d ? new Date(d) : new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // YYYY-MM-DD
};

/** Current clock time in IST as HH:mm (24h) */
export const formatClockTimeIST = (d = new Date()) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

/** Converts "09:30 AM" or "17:30" to minutes from start of day */
export { timeToMinutes } from "../utils/shiftTimeHelper.js";

/** Helper to resolve the exact DeliveryManager for a rider */
export const getRiderManager = async (rider) => {
  if (!rider) return null;
  let manager = null;
  const riderArea = (rider.area || "").trim().toLowerCase();

  if (rider.managerId) {
    manager = await DeliveryManager.findById(rider.managerId);
    if (manager) {
      const managerArea = (manager.area || "").trim().toLowerCase();
      if (riderArea && managerArea && riderArea !== managerArea) {
        manager = null;
      }
    }
  }

  if (!manager && (rider.cityId || rider.area || rider.city)) {
    const escapedArea = (rider.area || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    manager = await DeliveryManager.findOne({
      isActive: true,
      $or: [
        ...(escapedArea ? [{ area: { $regex: new RegExp(`^${escapedArea}$`, "i") } }] : []),
        { cityId: rider.cityId, area: rider.area },
        { city: rider.city, area: rider.area },
      ],
    }).sort({ createdAt: -1 });

    if (manager) {
      if (!rider.managerId || rider.managerId.toString() !== manager._id.toString()) {
        rider.managerId = manager._id;
        rider.storeId = manager._id.toString();
        await rider.save().catch(() => {});
      }
    } else if (rider.managerId) {
      rider.managerId = null;
      rider.storeId = "";
      await rider.save().catch(() => {});
    }
  }
  return manager;
};

const SLOTS_ASSIGNED_MESSAGE =
  "Slots are assigned by your Delivery Manager. Please contact them to change your slot.";

/** Riders no longer book or cancel slots themselves — Admin / Delivery Manager assigns them. */
export const bookSlot = async (req, res) =>
  res.status(403).json({ success: false, code: "SLOTS_ASSIGNED_BY_MANAGER", message: SLOTS_ASSIGNED_MESSAGE });

export const cancelBooking = async (req, res) =>
  res.status(403).json({ success: false, code: "SLOTS_ASSIGNED_BY_MANAGER", message: SLOTS_ASSIGNED_MESSAGE });

/**
 * 3. getMyBookings — Today's booking + future bookings only.
 * Past-day bookings (e.g. yesterday) must NEVER appear as today's shift.
 * Each calendar day requires its own booking.
 */
export const getMyBookings = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const todayStrIST = formatDateStringIST(new Date());
    const riderIdStr = rider._id.toString();

    // Only today + future shifts — never return yesterday's booking as "today"
    const shifts = await Shift.find({
      dateString: { $gte: todayStrIST },
      $or: [
        { "slots.bookings.deliveryPartnerId": rider._id },
        { "slots.bookings.deliveryPartnerId": riderIdStr },
      ],
    })
      .sort({ dateString: 1 })
      .populate("managerId", "storeName storeAddress latitude longitude geofenceRadius");

    const upcomingBookings = [];
    const todayBookings = [];
    let todayBooking = null;

    const nowMinutes = getCurrentMinutesIST();
    const bookingPhase = (dateString, slot, userBooking) => {
      if (userBooking.status === "COMPLETED") return "completed";
      const life = getSlotLifecycle(dateString, slot.startTime, slot.endTime, todayStrIST, nowMinutes);
      if (life === "past") return "completed";
      return life === "current" ? "running" : "upcoming";
    };

    const buildBookingInfo = (shift, slot, userBooking) => ({
      phase: bookingPhase(shift.dateString, slot, userBooking),
      id: userBooking._id ? userBooking._id.toString() : userBooking.bookingId,
      bookingId: userBooking._id ? userBooking._id.toString() : userBooking.bookingId,
      slotId: slot._id.toString(),
      shiftId: shift._id.toString(),
      shiftType: shift.type || "",
      shiftName: shift.name || "",
      dateString: shift.dateString,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: userBooking.status,
      storeName:
        shift.managerId?.storeName || `${shift.managerId?.area || "Dark"} Store`,
      storeAddress:
        shift.managerId?.storeAddress ||
        `${shift.managerId?.area || ""}, ${shift.managerId?.city || ""}`,
      notificationEnabled: userBooking.notificationEnabled || false,
      notificationTimeMinutes: userBooking.notificationTimeMinutes || 15,
      bookedAt: userBooking.bookedAt,
      assignedBy: userBooking.assignedBy || "rider",
      incentiveMode: slot.incentiveMode || "none",
      incentiveRate: Number(slot.incentiveRate) || 0,
      incentiveAfterKm: Number(slot.incentiveAfterKm) || 0,
      kmDelivered: Number(userBooking.kmDelivered) || 0,
    });

    for (const shift of shifts) {
      const dateStr = String(shift.dateString || "");
      for (const slot of shift.slots) {
        const userBooking = (slot.bookings || []).find(
          (b) =>
            b.deliveryPartnerId &&
            b.deliveryPartnerId.toString() === riderIdStr &&
            b.status !== "CANCELLED"
        );

        if (!userBooking) continue;

        const bookingInfo = buildBookingInfo(shift, slot, userBooking);

        if (dateStr === todayStrIST) {
          todayBookings.push(bookingInfo);
          // Prefer ACTIVE over UPCOMING if multiple slots same day
          if (
            !todayBooking ||
            (userBooking.status === "ACTIVE" && todayBooking.status !== "ACTIVE")
          ) {
            todayBooking = bookingInfo;
          }
        } else if (dateStr > todayStrIST) {
          upcomingBookings.push(bookingInfo);
        }
      }
    }

    // Fallback from rider.currentBooking — only if that shift is today or future
    if (rider.currentBooking?.shiftId) {
      const shift = await Shift.findById(rider.currentBooking.shiftId).populate(
        "managerId",
        "storeName storeAddress"
      );

      if (!shift || !shift.dateString || shift.dateString < todayStrIST) {
        // Stale pointer to a past-day shift — clear so it can't look like today's booking
        rider.currentBooking = { shiftId: null, slotId: null, bookingId: null };
        await rider.save();
      } else if (!todayBooking || shift.dateString > todayStrIST) {
        const slot = shift.slots.id(rider.currentBooking.slotId);
        if (slot) {
          const b =
            slot.bookings.id(rider.currentBooking.bookingId) ||
            slot.bookings.find(
              (x) =>
                x.deliveryPartnerId &&
                x.deliveryPartnerId.toString() === riderIdStr &&
                x.status !== "CANCELLED"
            );
          if (b && b.status !== "CANCELLED") {
            const fallbackBooking = buildBookingInfo(shift, slot, b);
            if (shift.dateString === todayStrIST && !todayBooking) {
              todayBooking = fallbackBooking;
            } else if (
              shift.dateString > todayStrIST &&
              !upcomingBookings.some((u) => u.bookingId === fallbackBooking.bookingId)
            ) {
              upcomingBookings.push(fallbackBooking);
            }
          }
        }
      }
    }

    upcomingBookings.sort((a, b) =>
      String(a.dateString).localeCompare(String(b.dateString))
    );

    todayBookings.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    return res.json({
      success: true,
      todayBooking,
      todayBookings,
      upcomingBookings,
      booking: todayBooking || upcomingBookings[0] || null,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyBooking = getMyBookings;

/**
 * 4. checkInToBooking — Helper called inside goOnline right after geofence check passes.
 * If rider has a currentBooking whose slot date/time window includes "now" (in IST),
 * sets that booking subdocument's status to "ACTIVE" and records onlineAt.
 * Non-blocking: failures or no matching booking result in a graceful no-op.
 */
export const checkInToBooking = async (rider) => {
  try {
    if (!rider || !rider.currentBooking?.shiftId) return null;

    const shift = await Shift.findById(rider.currentBooking.shiftId);
    if (!shift) return null;

    const slot = shift.slots.id(rider.currentBooking.slotId);
    if (!slot) return null;

    const booking = slot.bookings.id(rider.currentBooking.bookingId) || slot.bookings.find(
      (b) => b.deliveryPartnerId.toString() === rider._id.toString() && b.status !== "CANCELLED"
    );

    if (!booking || booking.status === "CANCELLED") return null;

    const now = new Date();
    const todayStrIST = formatDateStringIST(now);

    if (shift.dateString === todayStrIST) {
      // Calculate current time in minutes IST
      const nowISTFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      const timeStrIST = nowISTFormatter.format(now);
      const currentMinIST = timeToMinutes(timeStrIST);

      if (isWithinSlot(slot.startTime, slot.endTime, currentMinIST, 30)) {
        booking.status = "ACTIVE";
        booking.onlineAt = now;
        await shift.save();
        return booking;
      }
    }
    return null;
  } catch (err) {
    console.warn("[checkInToBooking] Non-blocking check-in warning:", err.message);
    return null;
  }
};

/**
 * Helper endpoint for riders to fetch available shifts/slots at their assigned store.
 */
export const getAvailableSlots = async (req, res, next) => {
  try {
    let rider = null;
    if (req.user?.id) {
      rider = await DeliveryBoy.findById(req.user.id).catch(() => null);
    }

    const todayStr = formatDateStringIST(new Date());
    const queryDateStr = req.query.date ? formatDateStringIST(req.query.date) : todayStr;

    let manager = rider ? await getRiderManager(rider) : null;
    if (!manager) {
      const nowTime = new Date();
      return res.json({
        success: true,
        serverTime: nowTime.toISOString(),
        serverTimeIST: formatClockTimeIST(nowTime),
        serverDateString: todayStr,
        date: queryDateStr,
        storeName: "No Store Assigned",
        storeAddress: "",
        slots: [],
        shifts: [],
        activeBooking: null,
        userHasBookingForDate: false,
        verificationPending: rider ? rider.verificationStatus !== "approved" : false,
        riderVerificationStatus: rider ? rider.verificationStatus || "pending" : "pending",
        message: "No delivery manager has registered a dark store hub in your area yet.",
      });
    }

    // Query shifts ONLY for the requested date (never pull other week days).
    // Slots are created by Admin / Delivery Manager — nothing is auto-seeded here.
    let shifts = await Shift.find({
      managerId: manager._id,
      dateString: queryDateStr,
    }).sort({ createdAt: -1 });

    // Hard filter — never leak other dates into this response
    shifts = shifts.filter((s) => s.dateString === queryDateStr);

    const now = new Date();
    const currentMinutesIST = getCurrentMinutesIST(now);
    const isToday = queryDateStr === todayStr;
    const clockIST = formatClockTimeIST(now);

    const availableSlots = [];
    let riderActiveBooking = null;

    for (const shift of shifts) {
      const shiftJson = shift.toSafeJSON();

      for (const slot of shiftJson.slots) {
        const userBooking =
          rider &&
          (slot.bookings || []).find(
            (b) =>
              b.deliveryPartnerId === rider._id.toString() &&
              b.status !== "CANCELLED" &&
              b.status !== "COMPLETED"
          );

        // activeBooking is only for the date being viewed
        if (userBooking && shift.dateString === queryDateStr) {
          riderActiveBooking = {
            id: userBooking.bookingId,
            bookingId: userBooking.bookingId,
            slotId: slot.id,
            shiftId: shift._id.toString(),
            dateString: queryDateStr,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: userBooking.status,
            storeName: manager?.storeName || "Dark Store",
            storeAddress: manager?.storeAddress || "",
          };
        }

        let slotStatus = slot.status;
        if (
          isToday &&
          isSlotEnded(
            slot.startTime,
            slot.endTime,
            currentMinutesIST,
            queryDateStr,
            queryDateStr
          )
        ) {
          slotStatus = "ENDED";
        }

        availableSlots.push({
          ...slot,
          status: slotStatus,
          shiftName: shift.name,
          shiftType: shift.type,
          dateString: queryDateStr,
          storeName: manager?.storeName || "Dark Store",
          isBookedByMe: !!userBooking,
        });
      }
    }

    return res.json({
      success: true,
      serverTime: now.toISOString(),
      serverTimeIST: clockIST,
      serverDateString: todayStr,
      date: queryDateStr,
      storeName: manager?.storeName || "Dark Store Hub",
      storeAddress: manager?.storeAddress || "",
      slots: availableSlots,
      shifts: shifts.map((s) => s.toSafeJSON()),
      userHasBookingForDate: !!riderActiveBooking,
      activeBooking: riderActiveBooking,
      verificationPending: rider ? rider.verificationStatus !== "approved" : false,
      riderVerificationStatus: rider ? rider.verificationStatus || "pending" : "pending",
    });
  } catch (error) {
    next(error);
  }
};

/** Backward-compatible export alias */
export const getShiftBooking = getMyBooking;
