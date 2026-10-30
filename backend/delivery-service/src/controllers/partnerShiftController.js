import Shift from "../models/Shift.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import { getIO } from "../../../socket.js";
import { emitRiderStatusUpdated, applyGigStatusChange } from "../services/riderSocketService.js";
import { checkInToBooking, formatDateStringIST } from "./shiftController.js";
import { checkAndTrackIncentive } from "./incentiveController.js";
import { findLiveGigForManager } from "./gigManagementController.js";
import {
  getCurrentMinutesIST,
  isSlotEnded,
  isWithinSlot,
  timeToMinutes,
} from "../utils/shiftTimeHelper.js";

/** Calculates distance in meters between two lat/lng coordinates (Haversine formula) */
const calculateHaversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

/** Helper to resolve the exact DeliveryManager for a rider */
const getRiderManager = async (rider) => {
  if (!rider) return null;
  let manager = null;

  // 1. If rider has booked a shift today, resolve the manager directly from that shift
  const todayStr = formatDateStringIST(new Date());
  const bookedShift = await Shift.findOne({
    dateString: todayStr,
    "slots.bookings.deliveryPartnerId": rider._id,
  });
  if (bookedShift && bookedShift.managerId) {
    manager = await DeliveryManager.findById(bookedShift.managerId);
    if (manager && manager.isActive) {
      if (!rider.managerId || rider.managerId.toString() !== manager._id.toString()) {
        rider.managerId = manager._id;
        rider.storeId = manager._id.toString();
        await rider.save().catch(() => {});
      }
      return manager;
    }
  }

  // 2. If rider already has a manager assigned, respect and keep it
  if (rider.managerId) {
    manager = await DeliveryManager.findById(rider.managerId);
    if (manager && manager.isActive) {
      return manager;
    }
  }

  // 3. Match by cityId / area / city
  if (rider.cityId || rider.area || rider.city) {
    const escapedArea = (rider.area || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    manager = await DeliveryManager.findOne({
      isActive: true,
      $or: [
        ...(escapedArea ? [{ area: { $regex: new RegExp(`^${escapedArea}$`, "i") } }] : []),
        { cityId: rider.cityId, area: rider.area },
        { city: rider.city, area: rider.area },
        ...(rider.city ? [{ city: { $regex: new RegExp(`^${rider.city.trim()}$`, "i") } }] : []),
      ],
    }).sort({ createdAt: -1 });

    if (manager) {
      rider.managerId = manager._id;
      rider.storeId = manager._id.toString();
      await rider.save().catch(() => {});
      return manager;
    }
  }

  // 4. Fallback: Any active dark store manager
  manager = await DeliveryManager.findOne({ isActive: true }).sort({ createdAt: -1 });
  if (manager) {
    rider.managerId = manager._id;
    rider.storeId = manager._id.toString();
    await rider.save().catch(() => {});
  }
  return manager;
};

export const getAvailableSlots = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const todayStr = formatDateStringIST(new Date());
    const queryDateStr = req.query.date ? formatDateStringIST(req.query.date) : todayStr;

    const manager = await getRiderManager(rider);

    if (!manager) {
      return res.json({
        success: true,
        serverTime: new Date().toISOString(),
        serverDateString: todayStr,
        date: queryDateStr,
        storeName: "No Store Assigned",
        storeAddress: "",
        slots: [],
        shifts: [],
        userHasBookingForDate: false,
        activeBooking: null,
      });
    }

    // QUERY SHIFTS STRICTLY FOR THIS RIDER'S ASSIGNED STORE MANAGER
    const shifts = await Shift.find({
      managerId: manager._id,
      dateString: queryDateStr,
    }).sort({ createdAt: 1 });

    const now = new Date();
    const currentMinutes = getCurrentMinutesIST(now);
    const isToday = queryDateStr === todayStr;

    const availableSlots = [];
    let riderActiveBooking = null;

    for (const shift of shifts) {
      const shiftJson = shift.toSafeJSON();

      for (const slot of shiftJson.slots) {
        if (slot.status === "CANCELLED") continue;

        const endMin = timeToMinutes(slot.endTime);

        // Check if rider already booked this slot
        const userBooking = (slot.bookings || []).find(
          (b) => b.deliveryPartnerId === rider._id.toString() && b.status !== "CANCELLED"
        );

        if (userBooking) {
          riderActiveBooking = {
            id: userBooking.bookingId,
            bookingId: userBooking.bookingId,
            slotId: slot.id,
            shiftId: shift._id.toString(),
            dateString: queryDateStr,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: userBooking.status,
            storeName: manager?.storeName || `${manager?.area || "Dark"} Store`,
            storeAddress: manager?.storeAddress || `${manager?.area || ""}, ${manager?.city || ""}`,
            notificationEnabled: userBooking.notificationEnabled,
            notificationTimeMinutes: userBooking.notificationTimeMinutes,
          };
        }

        let slotStatus = slot.status;
        if (isToday && isSlotEnded(slot.startTime, slot.endTime, currentMinutes)) {
          slotStatus = "ENDED";
        }

        availableSlots.push({
          ...slot,
          status: slotStatus,
          shiftName: shift.name,
          shiftType: shift.type,
          storeName: manager?.storeName || `${manager?.area || "Dark"} Store`,
          isBookedByMe: !!userBooking,
        });
      }
    }

    return res.json({
      success: true,
      serverTime: new Date().toISOString(),
      serverDateString: todayStr,
      date: queryDateStr,
      storeName: manager?.storeName || "Dark Store Hub",
      storeAddress: manager?.storeAddress || "",
      slots: availableSlots,
      shifts: shifts.map((s) => s.toSafeJSON()),
      userHasBookingForDate: !!riderActiveBooking,
      activeBooking: riderActiveBooking,
    });
  } catch (error) {
    next(error);
  }
};

export const bookSlot = async (req, res, next) => {
  try {
    const targetSlotId = req.body.slotId || req.body.shiftId;
    if (!targetSlotId) {
      return res.status(400).json({ success: false, message: "slotId is required" });
    }

    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Delivery partner not found" });
    }

    if (rider.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your delivery partner profile is inactive.",
      });
    }

    const manager = await getRiderManager(rider);

    const shiftDoc = await Shift.findOne({
      $or: [{ _id: targetSlotId }, { "slots._id": targetSlotId }],
    });

    if (!shiftDoc) {
      return res.status(404).json({ success: false, message: "Shift slot is no longer available" });
    }

    if (manager && shiftDoc.managerId && shiftDoc.managerId.toString() !== manager._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "This shift belongs to another store hub in a different area.",
      });
    }

    if (manager && !shiftDoc.managerId) {
      shiftDoc.managerId = manager._id;
      shiftDoc.storeId = manager._id.toString();
    }

    const slotDoc = shiftDoc.slots.find(
      (s) => s._id.toString() === targetSlotId || shiftDoc._id.toString() === targetSlotId
    );

    if (!slotDoc || slotDoc.status === "CANCELLED") {
      return res.status(404).json({ success: false, message: "Shift slot is no longer available" });
    }

    const dateStr = shiftDoc.dateString;
    const now = new Date();
    const todayStr = formatDateStringIST(now);
    const currentMin = getCurrentMinutesIST(now);

    // Check only THIS date — booking Mon must not block Tue–Sun
    const allShiftsForDate = await Shift.find({
      managerId: shiftDoc.managerId,
      dateString: dateStr,
    });
    let alreadyBooked = false;

    for (const sh of allShiftsForDate) {
      for (const sl of sh.slots) {
        const isSlotExpired =
          (dateStr === todayStr && isSlotEnded(sl.startTime, sl.endTime, currentMin)) ||
          dateStr < todayStr;

        const found = sl.bookings.find((b) => {
          if (b.deliveryPartnerId.toString() !== rider._id.toString()) return false;
          if (b.status === "CANCELLED" || b.status === "EXPIRED" || b.status === "COMPLETED") return false;
          if (isSlotExpired) return false;
          return true;
        });

        if (found) {
          if (sl._id.toString() !== slotDoc._id.toString()) {
            alreadyBooked = true;
          }
          break;
        }
      }
    }

    if (alreadyBooked) {
      return res.status(400).json({
        success: false,
        message: `You already have a shift booked for ${dateStr}. Other days are still available.`,
      });
    }

    if (dateStr < todayStr) {
      return res.status(400).json({ success: false, message: "Cannot book shifts in the past" });
    }

    const newBookingObj = {
      bookingId: `BK-${Date.now()}`,
      deliveryPartnerId: rider._id,
      deliveryPartnerPhone: rider.phone,
      deliveryPartnerName: rider.name || "Delivery Partner",
      deliveryPartnerProfileImage: rider.profileImage || "",
      bookedAt: new Date(),
      status: "UPCOMING",
      notificationEnabled: false,
      notificationTimeMinutes: 15,
    };

    const freshShift = await Shift.findById(shiftDoc._id);
    const freshSlot = freshShift?.slots.id(slotDoc._id);

    if (!freshSlot || freshSlot.bookedCount >= freshSlot.capacity) {
      return res.status(400).json({
        success: false,
        message: "FULLY BOOKED! Capacity reached for this shift slot. Please select another slot.",
      });
    }

    freshSlot.bookedCount += 1;
    freshSlot.bookings.push(newBookingObj);
    if (freshSlot.bookedCount >= freshSlot.capacity) freshSlot.status = "FULL";
    await freshShift.save();

    const bookedBookingObj = freshSlot.bookings[freshSlot.bookings.length - 1];
    rider.shiftBooking = {
      slot: `${slotDoc.startTime} - ${slotDoc.endTime}`,
      date: shiftDoc.date,
      bookedAt: newBookingObj.bookedAt,
      bookingId: newBookingObj.bookingId,
    };
    rider.currentBooking = {
      shiftId: freshShift._id,
      slotId: freshSlot._id,
      bookingId: bookedBookingObj?._id || freshSlot._id,
    };
    await rider.save();

    try {
      getIO().to(`store_${shiftDoc.managerId}`).emit("rider_shift_booked", {
        bookingId: newBookingObj.bookingId,
        shiftId: shiftDoc._id.toString(),
        slotId: slotDoc._id.toString(),
        riderId: rider._id.toString(),
        name: rider.name || rider.phone,
        startTime: slotDoc.startTime,
        endTime: slotDoc.endTime,
      });
    } catch (e) {}

    return res.status(201).json({
      success: true,
      message: "Shift Booked Successfully!",
      booking: {
        id: newBookingObj.bookingId,
        slotId: slotDoc._id.toString(),
        shiftId: shiftDoc._id.toString(),
        dateString: dateStr,
        startTime: slotDoc.startTime,
        endTime: slotDoc.endTime,
        status: "UPCOMING",
        storeName: "Dark Store",
        storeAddress: "",
      },
      shift: freshShift.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const todayStr = formatDateStringIST(new Date());

    const shifts = await Shift.find({
      dateString: { $gte: todayStr },
      "slots.bookings.deliveryPartnerId": rider._id,
    }).populate("managerId", "storeName storeAddress latitude longitude geofenceRadius");

    const upcomingBookings = [];
    let todayBooking = null;

    for (const shift of shifts) {
      for (const slot of shift.slots) {
        const userBooking = slot.bookings.find(
          (b) => b.deliveryPartnerId.toString() === rider._id.toString() && b.status !== "CANCELLED"
        );

        if (userBooking) {
          const bookingInfo = {
            id: userBooking._id ? userBooking._id.toString() : userBooking.bookingId,
            bookingId: userBooking.bookingId,
            slotId: slot._id.toString(),
            shiftId: shift._id.toString(),
            dateString: shift.dateString,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: userBooking.status,
            storeName: shift.managerId?.storeName || `${shift.managerId?.area || "Dark"} Store`,
            storeAddress: shift.managerId?.storeAddress || `${shift.managerId?.area || ""}, ${shift.managerId?.city || ""}`,
            notificationEnabled: userBooking.notificationEnabled,
            notificationTimeMinutes: userBooking.notificationTimeMinutes,
            bookedAt: userBooking.bookedAt,
          };

          if (shift.dateString === todayStr) {
            todayBooking = bookingInfo;
          } else if (shift.dateString > todayStr) {
            upcomingBookings.push(bookingInfo);
          }
        }
      }
    }

    return res.json({
      success: true,
      todayBooking,
      upcomingBookings,
    });
  } catch (error) {
    next(error);
  }
};

export const toggleNotification = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { notificationEnabled = true, notificationTimeMinutes = 15 } = req.body;

    const shift = await Shift.findOne({
      "slots.bookings._id": bookingId,
    });

    if (!shift) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    for (const slot of shift.slots) {
      const b = slot.bookings.find((x) => x._id.toString() === bookingId || x.bookingId === bookingId);
      if (b) {
        b.notificationEnabled = Boolean(notificationEnabled);
        b.notificationTimeMinutes = parseInt(notificationTimeMinutes, 10) || 15;
        break;
      }
    }

    await shift.save();

    return res.json({
      success: true,
      message: notificationEnabled
        ? `Reminder set for ${notificationTimeMinutes} minutes before shift starts!`
        : "Shift reminder disabled.",
    });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const shift = await Shift.findOne({
      "slots.bookings._id": bookingId,
    });

    if (!shift) {
      return res.status(404).json({ success: false, message: "Active booking not found" });
    }

    for (const slot of shift.slots) {
      const bIndex = slot.bookings.findIndex(
        (x) => x._id.toString() === bookingId || x.bookingId === bookingId
      );

      if (bIndex !== -1) {
        slot.bookings.splice(bIndex, 1);
        slot.bookedCount = Math.max(0, slot.bookedCount - 1);
        if (slot.status === "FULL") slot.status = "AVAILABLE";
        break;
      }
    }

    await shift.save();

    await DeliveryBoy.findByIdAndUpdate(req.user.id, {
      shiftBooking: { slot: "", date: null, bookedAt: null, bookingId: null },
    });

    return res.json({
      success: true,
      message: "Shift booking cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const goOnline = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "Current latitude and longitude are required to verify location before going online",
      });
    }

    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Delivery partner not found" });
    }

    if (rider.verificationStatus !== "approved" || !rider.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your profile is pending manager verification. You cannot go online yet.",
      });
    }

    const manager = await getRiderManager(rider);
    if (!manager) {
      return res.status(400).json({
        success: false,
        code: "NO_STORE_ASSIGNED",
        message: "No active dark store found for your registered area. Please contact support.",
      });
    }

    const todayStr = formatDateStringIST(new Date());
    const liveGig = await findLiveGigForManager(manager._id);

    // A rider can be assigned slots in several shifts today — pick the earliest that hasn't ended.
    const todayShifts = await Shift.find({
      dateString: todayStr,
      "slots.bookings.deliveryPartnerId": rider._id,
    }).populate("managerId");

    let shift = null;
    let todayBooking = null;
    let targetSlot = null;

    const nowTime = new Date();
    const currentMinCheck = getCurrentMinutesIST(nowTime);

    for (const candidateShift of todayShifts) {
      for (const slot of candidateShift.slots) {
        if (slot.status === "CANCELLED") continue;
        const isExpired = isSlotEnded(slot.startTime, slot.endTime, currentMinCheck);
        if (isExpired) continue;

        const found = slot.bookings.find(
          (b) =>
            b.deliveryPartnerId.toString() === rider._id.toString() &&
            b.status !== "CANCELLED" &&
            b.status !== "EXPIRED"
        );
        if (
          found &&
          (!targetSlot || timeToMinutes(slot.startTime) < timeToMinutes(targetSlot.startTime))
        ) {
          shift = candidateShift;
          todayBooking = found;
          targetSlot = slot;
        }
      }
    }

    const isFullTime = rider.employmentType === "FULL_TIME";

    if (!todayBooking || !targetSlot) {
      if (!liveGig && !isFullTime) {
        return res.status(400).json({
          success: false,
          code: "NO_SHIFT_BOOKED",
          message:
            "No slot is assigned to you for today. Your Delivery Manager assigns slots — you can also go online when a live gig is running.",
        });
      }
    }

    const now = new Date();
    const currentMin = getCurrentMinutesIST(now);
    const startMin = targetSlot ? timeToMinutes(targetSlot.startTime) : timeToMinutes(liveGig?.startTime);
    const endMin = targetSlot ? timeToMinutes(targetSlot.endTime) : timeToMinutes(liveGig?.endTime);

    if (todayBooking && targetSlot) {
      const allowedEarlyMin = Math.max(0, startMin - 30);
      if (!isWithinSlot(targetSlot.startTime, targetSlot.endTime, currentMin, 30) && currentMin < allowedEarlyMin) {
        return res.status(400).json({
          success: false,
          code: "SHIFT_NOT_STARTED",
          message: `Your shift (${targetSlot.startTime} - ${targetSlot.endTime}) starts at ${targetSlot.startTime}. Online check-in opens 30 mins before start time.`,
        });
      }

      if (isSlotEnded(targetSlot.startTime, targetSlot.endTime, currentMin)) {
        return res.status(400).json({
          success: false,
          code: "SHIFT_EXPIRED",
          message: `Your shift (${targetSlot.startTime} - ${targetSlot.endTime}) has already ended for today.`,
        });
      }
    }

    let storeLat = manager?.latitude ?? 18.559;
    let storeLng = manager?.longitude ?? 73.7868;
    // Set allowed radius to at least 25 km (25000m) for store delivery hub operations
    let allowedRadius = Math.max(manager?.geofenceRadius ?? 0, 25000);

    const partnerLat = parseFloat(latitude);
    const partnerLng = parseFloat(longitude);

    const isDefaultStoreCoords =
      Math.abs(storeLat - 18.559) < 0.001 && Math.abs(storeLng - 73.7868) < 0.001;

    if (isDefaultStoreCoords && !isNaN(partnerLat) && !isNaN(partnerLng)) {
      manager.latitude = partnerLat;
      manager.longitude = partnerLng;
      await manager.save().catch(() => {});
      storeLat = partnerLat;
      storeLng = partnerLng;
    }

    const distanceMeters = calculateHaversineDistanceMeters(
      partnerLat,
      partnerLng,
      storeLat,
      storeLng
    );

    if (distanceMeters > allowedRadius) {
      return res.status(400).json({
        success: false,
        code: "OUT_OF_GEOFENCE",
        message: `You are too far (${Math.round(distanceMeters / 1000)} km) from the assigned store (${manager?.storeName || "Dark Store"}). Allowed check-in radius is ${Math.round(allowedRadius / 1000)} km.`,
        distanceMeters,
        allowedRadius,
        storeName: manager?.storeName || "Dark Store",
      });
    }

    // Bank any open session before resetting lastOnlineAt (re-check-in / refresh)
    const { ensureTodayOnlineTracking, addOnlineMinutesSince, liveOnlineMinutes } =
      await import("../utils/onlineHoursHelper.js");
    ensureTodayOnlineTracking(rider);
    if (
      (rider.status === "online" || rider.status === "on_delivery") &&
      rider.lastOnlineAt
    ) {
      rider.todayOnlineMinutes =
        (rider.todayOnlineMinutes || 0) +
        addOnlineMinutesSince(rider, rider.lastOnlineAt, new Date());
    }

    rider.status = "online";
    rider.lastOnlineAt = new Date();
    rider.onlineSince = rider.onlineSince || new Date();
    rider.currentLocation = {
      lat: partnerLat,
      lng: partnerLng,
      updatedAt: new Date(),
    };
    await rider.save();

    const { retryWaitingAssignmentsForStore } = await import(
      "../services/OrderAssignmentService.js"
    );
    if (manager?._id) {
      retryWaitingAssignmentsForStore(manager._id).catch(() => {});
    }

    if (todayBooking && shift) {
      todayBooking.status = "ACTIVE";
      todayBooking.onlineAt = new Date();
      await shift.save();
      await checkInToBooking(rider).catch(() => {});
    }
    if (!isFullTime) {
      await checkAndTrackIncentive(rider._id, manager._id).catch(() => {});
    }

    await emitRiderStatusUpdated(rider, {
      todayOnlineMinutes: liveOnlineMinutes(rider),
    });

    const minutesUntilStart =
      targetSlot && startMin > currentMin ? startMin - currentMin : 0;
    let shiftMessage = "";
    if (isFullTime && !targetSlot) {
      shiftMessage = `Location verified at ${manager?.storeName || "Store"} (${distanceMeters}m away)! You are ONLINE 🟢. Orders are assigned to you by your Delivery Manager.`;
    } else if (liveGig && !targetSlot) {
      shiftMessage = `You're online for ${liveGig.title} (${liveGig.startTime} - ${liveGig.endTime}). No booking needed — stay online to earn the gig bonus.`;
    } else if (minutesUntilStart > 0) {
      shiftMessage = `Location verified at ${manager?.storeName || "Store"} (${distanceMeters}m away)! Your shift (${targetSlot.startTime} - ${targetSlot.endTime}) starts in ${minutesUntilStart} minute${minutesUntilStart > 1 ? "s" : ""} at ${targetSlot.startTime}. You are checked in and ONLINE 🟢!`;
    } else {
      shiftMessage = `Location verified at ${manager?.storeName || "Store"} (${distanceMeters}m away)! Your shift (${targetSlot.startTime} - ${targetSlot.endTime}) is ACTIVE. You are now ONLINE 🟢 and ready to receive orders!`;
    }

    return res.json({
      success: true,
      message: shiftMessage,
      status: "ONLINE",
      distanceMeters,
      allowedRadius,
      minutesUntilStart,
      startTime: targetSlot?.startTime || (isFullTime ? undefined : liveGig?.startTime),
      endTime: targetSlot?.endTime || (isFullTime ? undefined : liveGig?.endTime),
      deliveryBoy: rider.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const goOffline = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    await applyGigStatusChange(rider, "offline");
    await rider.save();

    await emitRiderStatusUpdated(rider, {
      todayOnlineMinutes: rider.todayOnlineMinutes || 0,
    });

    const { creditHourIncentiveOnOffline } = await import("../services/slotAssignmentService.js");
    await creditHourIncentiveOnOffline(rider._id);

    return res.json({
      success: true,
      message: "You are now OFFLINE 🔴",
      status: "OFFLINE",
      deliveryBoy: rider.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};
