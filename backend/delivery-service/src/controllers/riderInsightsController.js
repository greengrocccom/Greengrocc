/**
 * Rider insights: attendance, performance, wallet summary.
 * Uses existing StoreOrder / DriverOfferHistory / DeliveryBoy online tracking.
 */
import DeliveryBoy from "../models/DeliveryBoy.js";
import StoreOrder from "../models/StoreOrder.js";
import DriverOfferHistory from "../models/DriverOfferHistory.js";
import Shift from "../models/Shift.js";
import {
  ensureTodayOnlineTracking,
  formatOnlineMinutes,
  istDateString,
  liveOnlineMinutes,
  listRecentIstDates,
} from "../utils/onlineHoursHelper.js";
import {
  getCurrentMinutesIST,
  isSlotEnded,
} from "../utils/shiftTimeHelper.js";
import {
  computeMonthPayroll,
  effectiveMonthlySalary,
  getActiveFullTimeRule,
  getDriverFullTimeShift,
  istMonthString,
  resolveRiderManager,
  shiftPayPolicy,
} from "../services/fullTimeService.js";

const istDayRange = (dateString) => ({
  start: new Date(`${dateString}T00:00:00+05:30`),
  end: new Date(`${dateString}T23:59:59.999+05:30`),
});

function verificationStart(rider) {
  if (rider.verifiedAt) return new Date(rider.verifiedAt);
  // Fallback: account creation if never stamped
  return rider.createdAt ? new Date(rider.createdAt) : new Date(0);
}

function pct(num, den) {
  if (!den || den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function matchBooking(booking, riderIdStr, riderPhone) {
  const bRiderId = booking.deliveryPartnerId
    ? booking.deliveryPartnerId.toString()
    : "";
  const bPhone = (booking.deliveryPartnerPhone || "").trim();
  return bRiderId === riderIdStr || (riderPhone && bPhone === riderPhone);
}

function tallyShiftsForDate(shifts, dateString, riderIdStr, riderPhone, todayStr, currentMin) {
  let booked = 0;
  let completed = 0;
  for (const shift of shifts) {
    if (shift.dateString !== dateString) continue;
    for (const slot of shift.slots || []) {
      for (const booking of slot.bookings || []) {
        if (!matchBooking(booking, riderIdStr, riderPhone)) continue;
        if (booking.status === "CANCELLED") continue;
        booked += 1;
        const pastDay = Boolean(dateString && dateString < todayStr);
        const slotEndedToday = isSlotEnded(
          slot.startTime,
          slot.endTime,
          currentMin,
          dateString,
          todayStr
        );
        if (booking.status === "COMPLETED" || pastDay || slotEndedToday) {
          completed += 1;
        }
      }
    }
  }
  return { booked, completed };
}

/** GET /api/delivery-boys/attendance/today?date=YYYY-MM-DD */
export const getAttendanceToday = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    ensureTodayOnlineTracking(rider);
    const requested = String(req.query.date || "").trim();
    const dateString = /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : istDateString();
    const todayStr = istDateString();
    const { start, end } = istDayRange(dateString);
    const currentMin = getCurrentMinutesIST();
    const riderIdStr = rider._id.toString();
    const riderPhone = (rider.phone || "").trim();

    let onlineMinutes = 0;
    if (dateString === todayStr) {
      onlineMinutes = liveOnlineMinutes(rider);
      await rider.save().catch(() => {});
    } else {
      const row = (rider.dailyActivity || []).find((r) => r.date === dateString);
      onlineMinutes = Number(row?.onlineMinutes || 0);
    }

    const trips = await StoreOrder.countDocuments({
      assignedRiderId: rider._id,
      status: "delivered",
      deliveredAt: { $gte: start, $lte: end },
    });

    // Week calendar boxes (oldest → newest) for Attendance UI
    const weekDates = listRecentIstDates(7);
    const shifts = await Shift.find({
      dateString: { $in: weekDates },
      $or: [
        { "slots.bookings.deliveryPartnerId": rider._id },
        { "slots.bookings.deliveryPartnerPhone": riderPhone },
      ],
    }).lean();

    const weekStart = istDayRange(weekDates[0]).start;
    const weekEnd = istDayRange(weekDates[weekDates.length - 1]).end;
    const weekOrders = await StoreOrder.find({
      assignedRiderId: rider._id,
      status: "delivered",
      deliveredAt: { $gte: weekStart, $lte: weekEnd },
    }).select("deliveredAt");

    const tripsByDate = {};
    for (const d of weekDates) tripsByDate[d] = 0;
    for (const o of weekOrders) {
      const d = istDateString(o.deliveredAt);
      if (tripsByDate[d] != null) tripsByDate[d] += 1;
    }

    const activityMap = new Map(
      (rider.dailyActivity || []).map((r) => [r.date, r])
    );

    const calendarDays = weekDates.map((d) => {
      const snap = activityMap.get(d);
      let mins =
        d === todayStr
          ? liveOnlineMinutes(rider)
          : Number(snap?.onlineMinutes || 0);
      const shiftStats = tallyShiftsForDate(
        shifts,
        d,
        riderIdStr,
        riderPhone,
        todayStr,
        currentMin
      );
      const dayTrips = d === dateString ? trips : tripsByDate[d] || 0;
      return {
        date: d,
        dayLabel: new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "short",
        }).format(istDayRange(d).start),
        dayNum: d.split("-")[2],
        isToday: d === todayStr,
        isSelected: d === dateString,
        totalOnlineMinutes: mins,
        totalOnlineFormatted: formatOnlineMinutes(mins),
        totalTrips: dayTrips,
        shiftsBooked: shiftStats.booked,
        shiftsCompleted: shiftStats.completed,
      };
    });

    const todayShiftStats = tallyShiftsForDate(
      shifts,
      dateString,
      riderIdStr,
      riderPhone,
      todayStr,
      currentMin
    );

    return res.json({
      success: true,
      date: dateString,
      isToday: dateString === todayStr,
      totalOnlineMinutes: onlineMinutes,
      totalOnlineFormatted: formatOnlineMinutes(onlineMinutes),
      totalTrips: trips,
      shiftsBooked: todayShiftStats.booked,
      shiftsCompleted: todayShiftStats.completed,
      status: rider.status,
      calendarDays,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/delivery-boys/performance */
export const getPerformanceStats = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const since = verificationStart(rider);

    const offerAgg = await DriverOfferHistory.aggregate([
      {
        $match: {
          driverId: rider._id,
          offeredAt: { $gte: since },
          response: { $in: ["ACCEPTED", "DECLINED", "TIMEOUT", "PENDING"] },
        },
      },
      { $group: { _id: "$response", count: { $sum: 1 } } },
    ]);

    const byResponse = Object.fromEntries(offerAgg.map((r) => [r._id, r.count]));
    const accepted = byResponse.ACCEPTED || 0;
    const declined = byResponse.DECLINED || 0;
    const timeout = byResponse.TIMEOUT || 0;
    const pending = byResponse.PENDING || 0;
    const offeredTotal = accepted + declined + timeout + pending;
    const decided = accepted + declined + timeout;

    const delivered = await StoreOrder.find({
      assignedRiderId: rider._id,
      status: "delivered",
      deliveredAt: { $gte: since },
    }).select("deliveredAt assignedAt packedAt");

    let onTime = 0;
    for (const o of delivered) {
      const start = o.assignedAt || o.packedAt;
      if (!start || !o.deliveredAt) continue;
      const mins =
        (new Date(o.deliveredAt).getTime() - new Date(start).getTime()) / 60000;
      // On-time heuristic: completed within 60 minutes of assignment
      if (mins <= 60) onTime += 1;
    }

    const cancelledByRider = await StoreOrder.countDocuments({
      assignedRiderId: rider._id,
      status: "cancelled",
      updatedAt: { $gte: since },
    });

    const failed = await StoreOrder.countDocuments({
      assignedRiderId: rider._id,
      status: "delivery_failed",
      failedAt: { $gte: since },
    });

    const completedTrips = delivered.length;
    const ratingCount = Number(rider.totalRatingsCount || 0);
    const ratingAvg = Number(rider.rating || 0);

    return res.json({
      success: true,
      since: since.toISOString(),
      acceptanceRate: pct(accepted, decided),
      declineRate: pct(declined, decided),
      cancellationRate: pct(cancelledByRider, completedTrips + cancelledByRider),
      onTimeDeliveryRate: pct(onTime, completedTrips),
      customerRating: {
        average: ratingCount > 0 ? Math.round(ratingAvg * 10) / 10 : null,
        count: ratingCount,
      },
      counts: {
        offered: offeredTotal,
        accepted,
        declined,
        timeout,
        delivered: completedTrips,
        cancelled: cancelledByRider,
        failed,
        onTime,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/delivery-boys/wallet/summary */
export const getWalletSummary = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const since = verificationStart(rider);
    const todayStr = istDateString();
    const { start: todayStart, end: todayEnd } = istDayRange(todayStr);

    const totalAgg = await StoreOrder.aggregate([
      {
        $match: {
          assignedRiderId: rider._id,
          status: "delivered",
          walletCreditPending: { $ne: true },
          deliveredAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$riderDeliveryEarning" },
          count: { $sum: 1 },
        },
      },
    ]);

    const todayAgg = await StoreOrder.aggregate([
      {
        $match: {
          assignedRiderId: rider._id,
          status: "delivered",
          walletCreditPending: { $ne: true },
          deliveredAt: { $gte: todayStart > since ? todayStart : since, $lte: todayEnd },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$riderDeliveryEarning" },
          count: { $sum: 1 },
        },
      },
    ]);

    const weekDays = [];
    let weekTotal = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setTime(d.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = istDateString(d);
      const { start, end } = istDayRange(dateString);
      const dayStart = start < since ? since : start;
      let dayTotal = 0;
      let dayCount = 0;
      if (end >= since) {
        const rows = await StoreOrder.find({
          assignedRiderId: rider._id,
          status: "delivered",
          walletCreditPending: { $ne: true },
          deliveredAt: { $gte: dayStart, $lte: end },
        }).select("riderDeliveryEarning");
        dayTotal = rows.reduce((s, o) => s + Number(o.riderDeliveryEarning || 0), 0);
        dayCount = rows.length;
      }
      weekTotal += dayTotal;
      weekDays.push({
        date: dateString,
        dayLabel: new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "short",
        }).format(start),
        dayFull: new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
        }).format(start),
        isToday: dateString === todayStr,
        beforeVerification: end < since,
        totalEarnings: dayTotal,
        orderCount: dayCount,
      });
    }

    const history = await StoreOrder.aggregate([
      {
        $match: {
          assignedRiderId: rider._id,
          status: "delivered",
          walletCreditPending: { $ne: true },
          deliveredAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$deliveredAt",
              timezone: "Asia/Kolkata",
            },
          },
          totalEarnings: { $sum: "$riderDeliveryEarning" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 60 },
    ]);

    const dailyHistory = history.map((h) => {
      const date = h._id;
      const start = new Date(`${date}T12:00:00+05:30`);
      return {
        date,
        dayLabel: new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
        }).format(start),
        displayDate: new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(start),
        totalEarnings: h.totalEarnings || 0,
        orderCount: h.orderCount || 0,
      };
    });

    let totalEarnings = Number(totalAgg[0]?.total || 0);
    let fullTime = null;
    if (rider.employmentType === "FULL_TIME") {
      const manager = await resolveRiderManager(rider);
      const [rule, shift] = manager
        ? await Promise.all([
            getActiveFullTimeRule(manager._id),
            getDriverFullTimeShift(manager._id, rider._id),
          ])
        : [null, null];
      const credits = [...(rider.salaryCredits || [])].sort((a, b) =>
        String(b.month).localeCompare(String(a.month))
      );
      const totalSalaryCredited = credits.reduce((s, c) => s + Number(c.amount || 0), 0);
      const currentMonth = istMonthString();
      totalEarnings += totalSalaryCredited;
      fullTime = {
        employmentType: "FULL_TIME",
        monthlySalary: effectiveMonthlySalary(rider, manager, shift),
        currentMonth,
        currentMonthCredited: credits.some((c) => c.month === currentMonth),
        totalSalaryCredited,
        salaryCredits: credits.map((c) => ({
          month: c.month,
          amount: c.amount,
          creditedAt: c.creditedAt,
          breakdown: c.breakdown || null,
        })),
        perKmEarnings: false,
        payPolicy: shiftPayPolicy(shift),
        currentMonthPayroll: await computeMonthPayroll({ rider, manager, shift, rule }),
      };
    }

    // Month-wise salary (set/credited by admin) + slot incentives — for every rider.
    const salaryCreditsAll = [...(rider.salaryCredits || [])];
    const incentiveCreditsAll = [...(rider.incentiveCredits || [])].sort(
      (a, b) => new Date(b.creditedAt) - new Date(a.creditedAt)
    );
    const incentiveByMonth = {};
    for (const c of incentiveCreditsAll) {
      incentiveByMonth[c.month] = (incentiveByMonth[c.month] || 0) + Number(c.amount || 0);
    }
    const totalIncentives = incentiveCreditsAll.reduce((s, c) => s + Number(c.amount || 0), 0);
    const todayIst = istDateString();
    const todayIncentives = incentiveCreditsAll
      .filter((c) => c.dateString === todayIst)
      .reduce((s, c) => s + Number(c.amount || 0), 0);
    if (rider.employmentType !== "FULL_TIME") {
      totalEarnings += salaryCreditsAll.reduce((s, c) => s + Number(c.amount || 0), 0);
    }
    totalEarnings += totalIncentives;
    const salaryMonths = [
      ...new Set([...salaryCreditsAll.map((c) => c.month), ...Object.keys(incentiveByMonth), istMonthString()]),
    ]
      .sort()
      .reverse()
      .slice(0, 12);
    const salary = {
      monthlySalary: rider.monthlySalary ?? fullTime?.monthlySalary ?? null,
      salaryAmount:
        rider.salaryAmount ?? rider.monthlySalary ?? fullTime?.monthlySalary ?? null,
      salaryPeriod: rider.salaryAmount != null ? rider.salaryPeriod || "month" : "month",
      currentMonth: istMonthString(),
      months: salaryMonths.map((month) => {
        const credit = salaryCreditsAll.find((c) => c.month === month) || null;
        return {
          month,
          salaryCredited: credit ? Number(credit.amount) || 0 : 0,
          salaryCreditedAt: credit?.creditedAt || null,
          incentives: Math.round((incentiveByMonth[month] || 0) * 100) / 100,
        };
      }),
      totalIncentives: Math.round(totalIncentives * 100) / 100,
      todayIncentives: Math.round(todayIncentives * 100) / 100,
      recentIncentives: incentiveCreditsAll.slice(0, 30).map((c) => ({
        dateString: c.dateString,
        mode: c.mode,
        rate: c.rate,
        units: c.units,
        amount: c.amount,
        label: c.label,
        creditedAt: c.creditedAt,
      })),
    };

    const withdrawEnabled = Boolean(rider.withdrawEnabled);
    const canWithdraw = withdrawEnabled && totalEarnings > 0;

    return res.json({
      success: true,
      verificationDate: since.toISOString(),
      totalEarnings,
      totalDeliveries: totalAgg[0]?.count || 0,
      todayEarnings: (todayAgg[0]?.total || 0) + salary.todayIncentives,
      todayDeliveries: todayAgg[0]?.count || 0,
      weekTotalEarnings: weekTotal,
      weekDays,
      dailyHistory,
      walletBalance: rider.walletBalance || 0,
      /** Total earnings always visible; Withdraw stays off until admin sets withdrawEnabled. */
      withdrawEnabled,
      canWithdraw,
      withdrawNote: withdrawEnabled
        ? "Withdrawals follow Delivery Manager/Admin payout policy."
        : "Withdraw stays inactive until Admin activates it for your account. Total earnings still keep updating.",
      withdrawDisabledReason: canWithdraw
        ? null
        : withdrawEnabled
          ? "No earnings available to withdraw yet."
          : "Withdraw is inactive until Admin activates it.",
      fullTime,
      salary,
    });
  } catch (error) {
    next(error);
  }
};
