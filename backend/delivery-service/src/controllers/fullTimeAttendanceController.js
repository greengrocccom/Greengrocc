import DeliveryBoy from "../models/DeliveryBoy.js";
import FullTimeRule from "../models/FullTimeRule.js";
import FullTimeAttendance from "../models/FullTimeAttendance.js";
import StoreOrder from "../models/StoreOrder.js";
import { haversineKm } from "../services/darkStoreResolver.js";
import {
  FULL_TIME_ACTIVE_ORDER_STATUSES,
  attendanceStatusFor,
  computeMonthPayroll,
  effectiveMonthlySalary,
  getActiveFullTimeRule,
  getDriverFullTimeShift,
  istDateString,
  lateMinutesFor,
  monthAttendanceSummary,
  resolveAttendanceRequirement,
  resolveRiderManager,
  salarySource,
  shiftPayPolicy,
} from "../services/fullTimeService.js";

const darkStoreName = (manager) =>
  manager ? manager.storeName || `${manager.area} Dark Store` : "";

const shiftPayload = (shift) =>
  shift
    ? {
        id: shift._id.toString(),
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        workingDays: shift.workingDays || [],
        requireAttendance: shift.requireAttendance !== false,
        requireLocationValidation: shift.requireLocationValidation !== false,
        attendanceRadiusMeters: shift.attendanceRadiusMeters ?? null,
        notes: shift.notes || "",
      }
    : null;

const formatLate = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || "0m";
};

async function loadFullTimeContext(rider) {
  const manager = await resolveRiderManager(rider);
  const [rule, shift] = manager
    ? await Promise.all([
        getActiveFullTimeRule(manager._id),
        getDriverFullTimeShift(manager._id, rider._id),
      ])
    : [null, null];
  return { manager, rule, shift, requirement: resolveAttendanceRequirement({ rule, shift }) };
}

/** POST /api/delivery-boys/attendance/mark */
export const markFullTimeAttendance = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });

    if (rider.employmentType !== 'FULL_TIME') {
      return res.status(400).json({
        success: false,
        message: "This endpoint is only for Full-Time drivers",
      });
    }

    const today = istDateString();
    const { manager, shift, requirement } = await loadFullTimeContext(rider);
    const existing = await FullTimeAttendance.findOne({ deliveryBoyId: rider._id, date: today });
    const state = attendanceStatusFor({ record: existing, requirement, dateString: today });

    if (state.status === "present") {
      return res.json({
        success: true,
        message: "Attendance already marked for today",
        attendance: {
          date: existing.date,
          status: existing.status,
          markedAt: existing.markedAt,
          distanceFromStoreMeters: existing.distanceFromStoreMeters,
          validationPassed: existing.validationPassed,
        },
      });
    }
    if (state.status === "not_required") {
      return res.status(400).json({
        success: false,
        code: "ATTENDANCE_NOT_REQUIRED",
        message: "Attendance is not required for your shift",
      });
    }
    if (state.status === "off_day") {
      return res.status(400).json({
        success: false,
        code: "ATTENDANCE_OFF_DAY",
        message: "Today is not a working day for you",
      });
    }
    if (!state.canMark) {
      const closed = state.phase === "after";
      return res.status(400).json({
        success: false,
        code: closed ? "ATTENDANCE_WINDOW_CLOSED" : "ATTENDANCE_WINDOW_NOT_OPEN",
        message: closed
          ? `Attendance window closed at ${requirement?.endTime}`
          : `Attendance opens shortly before ${requirement?.startTime}`,
        requirement,
      });
    }

    const lat = parseFloat(req.body.lat ?? req.body.latitude);
    const lng = parseFloat(req.body.lng ?? req.body.longitude);
    let distanceFromStoreMeters = null;
    let validationPassed = true;

    if (requirement?.requireLocationValidation && manager) {
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          message: "GPS coordinates required for attendance (lat, lng)",
        });
      }

      if (manager.latitude != null && manager.longitude != null) {
        distanceFromStoreMeters = haversineKm(lat, lng, manager.latitude, manager.longitude) * 1000;
        const allowedRadius = requirement.attendanceRadiusMeters || 200;
        validationPassed = distanceFromStoreMeters <= allowedRadius;

        if (!validationPassed) {
          return res.status(400).json({
            success: false,
            code: "OUT_OF_ATTENDANCE_RADIUS",
            message: `You are ${Math.round(distanceFromStoreMeters)}m from the dark store. Must be within ${allowedRadius}m to mark attendance.`,
            distanceFromStoreMeters,
            allowedRadius,
          });
        }
      }
    }

    const markedAt = new Date();
    const lateMinutes = requirement ? lateMinutesFor(requirement.startTime, markedAt) : 0;
    const attendance = await FullTimeAttendance.findOneAndUpdate(
      { deliveryBoyId: rider._id, date: today },
      {
        $set: {
          managerId: manager?._id || rider.managerId || null,
          status: "present",
          markedAt,
          locationLat: !isNaN(lat) ? lat : null,
          locationLng: !isNaN(lng) ? lng : null,
          distanceFromStoreMeters,
          validationPassed,
          lateMinutes,
        },
      },
      { upsert: true, new: true }
    );

    const policy = shiftPayPolicy(shift);
    const latePenalty =
      policy.latePenaltyEnabled && policy.latePenaltyAmount > 0 && lateMinutes >= policy.lateAfterMinutes
        ? policy.latePenaltyAmount
        : 0;
    let message = "Attendance marked successfully";
    if (latePenalty) {
      message = `Attendance marked — you are ${formatLate(lateMinutes)} late. ₹${latePenalty} will be deducted from your salary.`;
    } else if (lateMinutes > 0) {
      message = `Attendance marked — ${formatLate(lateMinutes)} late.`;
    }

    return res.json({
      success: true,
      message,
      attendance: {
        date: attendance.date,
        status: attendance.status,
        markedAt: attendance.markedAt,
        distanceFromStoreMeters: attendance.distanceFromStoreMeters,
        validationPassed: attendance.validationPassed,
        lateMinutes,
        latePenalty,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/delivery-boys/attendance/fulltime-today */
export const getFullTimeAttendanceToday = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });

    const today = istDateString();
    const [{ manager, rule, shift, requirement }, attendance, month] = await Promise.all([
      loadFullTimeContext(rider),
      FullTimeAttendance.findOne({ deliveryBoyId: rider._id, date: today }),
      monthAttendanceSummary(rider._id),
    ]);
    const state = attendanceStatusFor({ record: attendance, requirement, dateString: today });
    const payroll = await computeMonthPayroll({ rider, manager, shift, rule });

    return res.json({
      success: true,
      today,
      attendance: attendance
        ? {
            date: attendance.date,
            status: attendance.status,
            markedAt: attendance.markedAt,
            distanceFromStoreMeters: attendance.distanceFromStoreMeters,
            validationPassed: attendance.validationPassed,
            lateMinutes: attendance.lateMinutes ?? null,
          }
        : { date: today, status: "pending", markedAt: null },
      rule: rule
        ? {
            ruleName: rule.ruleName,
            attendanceStartTime: rule.attendanceStartTime,
            attendanceEndTime: rule.attendanceEndTime,
            requireLocationValidation: rule.requireLocationValidation,
            attendanceRadiusMeters: rule.attendanceRadiusMeters,
            workingDays: rule.workingDays,
            minimumAttendanceDays: rule.minimumAttendanceDays,
          }
        : null,
      darkStore: manager
        ? {
            name: darkStoreName(manager),
            latitude: manager.latitude,
            longitude: manager.longitude,
            monthlySalary: effectiveMonthlySalary(rider, manager, shift),
          }
        : null,
      shift: shiftPayload(shift),
      requirement,
      todayStatus: state.status,
      canMark: state.canMark,
      windowPhase: state.phase,
      month: { ...month, minimumAttendanceDays: rule?.minimumAttendanceDays ?? null },
      payPolicy: shiftPayPolicy(shift),
      payroll,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/delivery-boys/fulltime-rules */
export const getFullTimeRulesForRider = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });

    const { manager, rule, shift, requirement } = await loadFullTimeContext(rider);
    const [rules, payroll] = await Promise.all([
      manager
        ? FullTimeRule.find({ managerId: manager._id, isActive: true }).sort({ updatedAt: -1 })
        : [],
      computeMonthPayroll({ rider, manager, shift, rule }),
    ]);

    return res.json({
      success: true,
      rules,
      monthlySalary: effectiveMonthlySalary(rider, manager, shift),
      salarySource: salarySource(rider, shift),
      darkStoreName: darkStoreName(manager),
      shift: shiftPayload(shift),
      requirement,
      customRules: rules.flatMap((r) => r.customRules || []),
      orderAssignmentMode: "manual",
      payPolicy: shiftPayPolicy(shift),
      payroll,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/delivery-boys/fulltime/assigned-orders — active manual assignments + delivered today. */
export const getFullTimeAssignedOrdersForRider = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });

    const todayStart = new Date(`${istDateString()}T00:00:00+05:30`);
    const [active, deliveredToday] = await Promise.all([
      StoreOrder.find({
        assignedRiderId: rider._id,
        status: { $in: FULL_TIME_ACTIVE_ORDER_STATUSES },
      }).sort({ batchSequence: 1, assignedAt: 1 }),
      StoreOrder.find({
        assignedRiderId: rider._id,
        status: "delivered",
        deliveredAt: { $gte: todayStart },
      }).sort({ deliveredAt: -1 }),
    ]);

    const toRow = (o) => {
      const delivered = o.status === "delivered";
      const unlocked = Boolean(o.customerAddressUnlocked) && !delivered;
      return {
        id: o._id.toString(),
        orderNumber: o.orderNumber,
        status: o.status,
        isPreOrder: Boolean(o.isPreOrder),
        preOrderDate: o.preOrderDate || "",
        preOrderSlot: o.preOrderSlot || "",
        itemCount: (o.items || []).reduce((n, i) => n + Number(i.quantity || 0), 0),
        amountToCollect: Number(o.amountToCollect || 0),
        paymentMethod: o.paymentMethod || "",
        area: o.area || "",
        customerName: delivered ? "Customer" : o.customerName || "Customer",
        customerPhone: unlocked ? o.customerPhone || "" : "",
        customerAddress: unlocked ? o.customerAddress || "" : "",
        customerAddressUnlocked: unlocked,
        pickupQrScanned: Boolean(o.pickupQrScanned || o.qrScannedAt),
        fullTimeDelivery: Boolean(o.fullTimeDelivery),
        assignedAt: o.assignedAt,
        deliveredAt: o.deliveredAt,
      };
    };

    return res.json({
      success: true,
      activeCount: active.length,
      deliveredTodayCount: deliveredToday.length,
      orders: active.map(toRow),
      deliveredToday: deliveredToday.map(toRow),
    });
  } catch (err) {
    next(err);
  }
};
