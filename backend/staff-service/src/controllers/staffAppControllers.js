import Staff from "../models/Staff.js";
import CustomRole from "../models/CustomRole.js";
import StaffNotification from "../models/StaffNotification.js";
import {
  HrAnnouncement,
  HrAttendance,
  HrEmployment,
  HrLeavePolicy,
  HrLeaveRequest,
  HrMeeting,
  HrPayroll,
  HrShift,
} from "../../../admin-ops-service/src/models.js";
import { ROLE_LABELS } from "../constants/roles.js";
import { isCleaner } from "./cleaningReportController.js";
import { getStaffFirebaseMessaging } from "../../../legacy/config/firebaseAdmin.js";

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

function todayYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Get staff home dashboard overview */
export async function getStaffOverview(req, res, next) {
  try {
    const staffId = req.user.id;
    const staff = await Staff.findById(staffId).lean();
    if (!staff) return fail(res, 404, "Staff not found");

    const roleKey = staff.role;
    const [customRole, employment] = await Promise.all([
      CustomRole.findOne({ roleKey }).lean(),
      HrEmployment.findOne({ employeeId: staffId, employeeType: "staff" }).lean(),
    ]);
    const roleLabel = customRole ? customRole.displayName : (ROLE_LABELS[roleKey] || roleKey.replace(/_/g, " "));

    const today = todayYmd();

    // Check today's attendance punch
    const todayAttendance = await HrAttendance.findOne({
      employeeId: staffId,
      date: today,
    }).lean();

    const isClockedIn = Boolean(todayAttendance && !todayAttendance.clockOut);

    // Today's shift
    const todayShift = await HrShift.findOne({
      $or: [
        { employeeId: staffId, date: today },
        { roleKey: { $in: [roleKey, "all"] }, date: today },
      ],
    }).lean();

    // Latest announcement or holiday
    const latestFeed = await HrAnnouncement.findOne({
      status: "published",
      roleKey: { $in: [roleKey, "all"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Upcoming meeting
    const upcomingMeeting = await HrMeeting.findOne({
      roles: { $in: [roleKey, "all"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Unread custom notifications count
    const unreadCount = await StaffNotification.countDocuments({
      $and: [
        {
          $or: [
            { targetType: "all" },
            { targetType: "role", targetRole: roleKey },
            { targetType: "staff", targetStaffId: staffId },
          ],
        },
        { readBy: { $ne: staffId } },
      ],
    });

    return ok(res, {
      profile: {
        id: staff._id.toString(),
        name: staff.name || "",
        email: staff.email || "",
        phone: staff.phone || "",
        role: roleKey,
        roleLabel,
        department: employment?.department || customRole?.department || "",
        designation: employment?.designation || roleLabel,
        joiningDate: employment?.joiningDate || "",
        isActive: staff.isActive !== false,
        createdAt: staff.createdAt || null,
        isCustomRole: Boolean(customRole),
        isCleaner: isCleaner(staff, customRole),
      },
      today: {
        date: today,
        isClockedIn,
        clockInTime: todayAttendance?.clockIn || null,
        clockOutTime: todayAttendance?.clockOut || null,
        attendanceId: todayAttendance?._id ? todayAttendance._id.toString() : null,
      },
      shift: todayShift
        ? {
            name: todayShift.shiftName || "General Shift",
            startTime: todayShift.startTime || "09:00",
            endTime: todayShift.endTime || "18:00",
            notes: todayShift.notes || "",
          }
        : {
            name: "General Shift",
            startTime: "09:00",
            endTime: "18:00",
            notes: "Standard office shift",
          },
      latestFeed: latestFeed
        ? {
            id: latestFeed._id.toString(),
            title: latestFeed.title,
            body: latestFeed.body,
            category: latestFeed.category || "announcement",
            publishedAt: latestFeed.publishedAt || latestFeed.createdAt,
          }
        : null,
      upcomingMeeting: upcomingMeeting
        ? {
            id: upcomingMeeting._id.toString(),
            title: upcomingMeeting.title || "Team Sync",
            time: upcomingMeeting.time || "",
            date: upcomingMeeting.date || "",
            link: upcomingMeeting.link || "",
            meetingId: upcomingMeeting.meetingId || "",
            password: upcomingMeeting.password || "",
          }
        : null,
      unreadNotificationsCount: unreadCount,
    });
  } catch (error) {
    next(error);
  }
}

/** Get Announcements, Holidays, and Notes feed */
export async function getStaffFeed(req, res, next) {
  try {
    const roleKey = req.user.role || "";
    const items = await HrAnnouncement.find({
      status: "published",
      $or: [
        { roleKey: "all" },
        { roleKey: roleKey },
        { roleKey: "" },
        { roleKey: null },
        { roleKey: { $exists: false } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    const announcements = [];
    const holidays = [];
    const notes = [];

    items.forEach((item) => {
      const row = {
        id: item._id.toString(),
        title: item.title,
        body: item.body || "",
        category: item.category || "announcement",
        scheduledAt: item.scheduledAt || "",
        publishedAt: item.publishedAt || item.createdAt,
        createdBy: item.createdBy || "HR Operations",
      };
      if (item.category === "holiday") {
        holidays.push(row);
      } else if (item.category === "note") {
        notes.push(row);
      } else {
        announcements.push(row);
      }
    });

    return ok(res, { announcements, holidays, notes });
  } catch (error) {
    next(error);
  }
}

/** Get staff shifts */
export async function getStaffShifts(req, res, next) {
  try {
    const staffId = req.user.id;
    const roleKey = req.user.role || "";
    const shifts = await HrShift.find({
      $or: [
        { employeeId: staffId },
        { roleKey: { $in: [roleKey, "all"] } },
      ],
    })
      .sort({ date: -1 })
      .limit(30)
      .lean();

    return ok(res, shifts);
  } catch (error) {
    next(error);
  }
}

/** Get staff attendance history */
export async function getStaffAttendance(req, res, next) {
  try {
    const staffId = req.user.id;
    const records = await HrAttendance.find({ employeeId: staffId })
      .sort({ date: -1 })
      .limit(60)
      .lean();

    const today = todayYmd();
    const todayPunch = records.find((r) => r.date === today);

    return ok(res, {
      records,
      todayPunch: todayPunch || null,
      isClockedIn: Boolean(todayPunch && !todayPunch.clockOut),
    });
  } catch (error) {
    next(error);
  }
}

/** Punch In / Punch Out */
export async function punchStaffAttendance(req, res, next) {
  try {
    const staffId = req.user.id;
    const staff = await Staff.findById(staffId).lean();
    if (!staff) return fail(res, 404, "Staff not found");

    const today = todayYmd();
    const action = String(req.body.action || "").toLowerCase(); // "in" or "out"

    let attendance = await HrAttendance.findOne({
      employeeId: staffId,
      date: today,
    });

    if (action === "in") {
      if (attendance && !attendance.clockOut) {
        return ok(res, attendance, { message: "Already punched in for today" });
      }
      if (!attendance) {
        attendance = await HrAttendance.create({
          employeeId: staffId,
          employeeType: "staff",
          name: staff.name,
          role: staff.role,
          date: today,
          clockIn: new Date(),
          clockOut: null,
          notes: req.body.notes || "Mobile App Punch In",
        });
      } else {
        // Re-clock in if previously clocked out
        attendance.clockIn = new Date();
        attendance.clockOut = null;
        await attendance.save();
      }
      return ok(res, attendance, { message: "Punched In successfully" });
    } else if (action === "out") {
      if (!attendance) {
        return fail(res, 400, "You haven't punched in today");
      }
      attendance.clockOut = new Date();
      await attendance.save();
      return ok(res, attendance, { message: "Punched Out successfully" });
    } else {
      return fail(res, 400, "Action must be 'in' or 'out'");
    }
  } catch (error) {
    next(error);
  }
}

/** Get staff leave balances & history */
export async function getStaffLeaves(req, res, next) {
  try {
    const staffId = String(req.user?.id || req.user?._id || "");
    const roleKey = req.user?.role || "";

    const [policy, requests] = await Promise.all([
      HrLeavePolicy.findOne({ roleKey }).lean(),
      HrLeaveRequest.find({
        $or: [
          { employeeId: staffId },
          ...(req.user?.id ? [{ employeeId: req.user.id }] : []),
          ...(req.user?._id ? [{ employeeId: req.user._id }] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const casualTotal = policy?.casualDays ?? 12;
    const sickTotal = policy?.sickDays ?? 12;
    const earnedTotal = policy?.earnedDays ?? 15;

    // Calculate leaves taken this year
    // Approved & Pending requests deduct from the remaining balance.
    // If Admin REJECTS a request (status === 'rejected'), it is EXCLUDED here,
    // which automatically adds the days back into the remaining leave balance.
    let casualApproved = 0;
    let sickApproved = 0;
    let earnedApproved = 0;

    let casualPending = 0;
    let sickPending = 0;
    let earnedPending = 0;

    requests.forEach((reqRow) => {
      const days = Number(reqRow.days) || 1;
      if (reqRow.status === "approved") {
        if (reqRow.leaveType === "casual") casualApproved += days;
        if (reqRow.leaveType === "sick") sickApproved += days;
        if (reqRow.leaveType === "earned") earnedApproved += days;
      } else if (reqRow.status === "pending") {
        if (reqRow.leaveType === "casual") casualPending += days;
        if (reqRow.leaveType === "sick") sickPending += days;
        if (reqRow.leaveType === "earned") earnedPending += days;
      }
      // Note: If reqRow.status === "rejected", it is excluded from used/pending,
      // so the rejected leave days are fully available / added back to the balance.
    });

    const casualUsed = casualApproved + casualPending;
    const sickUsed = sickApproved + sickPending;
    const earnedUsed = earnedApproved + earnedPending;

    return ok(res, {
      balances: {
        casual: {
          total: casualTotal,
          approved: casualApproved,
          pending: casualPending,
          used: casualUsed,
          remaining: Math.max(0, casualTotal - casualUsed),
        },
        sick: {
          total: sickTotal,
          approved: sickApproved,
          pending: sickPending,
          used: sickUsed,
          remaining: Math.max(0, sickTotal - sickUsed),
        },
        earned: {
          total: earnedTotal,
          approved: earnedApproved,
          pending: earnedPending,
          used: earnedUsed,
          remaining: Math.max(0, earnedTotal - earnedUsed),
        },
      },
      requests: requests.map((r) => ({
        id: r._id.toString(),
        leaveType: r.leaveType,
        fromDate: r.fromDate,
        toDate: r.toDate,
        days: r.days,
        reason: r.reason,
        status: r.status,
        adminNotes: r.adminNotes,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/** Apply for leave */
export async function applyStaffLeave(req, res, next) {
  try {
    const staffId = req.user?.id || req.user?._id;
    let staff = null;
    try {
      staff = await Staff.findById(staffId).lean();
    } catch (_) {}

    const staffName = staff?.name || req.user?.name || req.user?.email || "Staff Member";
    const staffRole = staff?.role || req.user?.role || "staff";

    const fromDate = String(req.body.fromDate || "").trim().slice(0, 10);
    const toDate = String(req.body.toDate || fromDate).trim().slice(0, 10);
    const leaveType = ["casual", "sick", "earned", "unpaid"].includes(req.body.leaveType)
      ? req.body.leaveType
      : "casual";
    const reason = String(req.body.reason || "").trim();

    if (!fromDate) return fail(res, 400, "From date is required");
    if (!reason) return fail(res, 400, "Reason is required");

    const days = Math.max(
      1,
      Math.round((new Date(`${toDate}T00:00:00`) - new Date(`${fromDate}T00:00:00`)) / 86400000) + 1
    );

    // Deduplication check: prevent accidental double-clicks within 15 seconds
    const existing = await HrLeaveRequest.findOne({
      employeeId: String(staffId),
      fromDate,
      toDate,
      status: "pending",
      createdAt: { $gte: new Date(Date.now() - 15000) },
    }).lean();

    if (existing) {
      return ok(res, existing, { message: "Leave application already submitted" });
    }

    const leave = await HrLeaveRequest.create({
      employeeId: String(staffId),
      employeeType: "staff",
      name: staffName,
      role: staffRole,
      roleKey: staffRole,
      leaveType,
      fromDate,
      toDate,
      days,
      reason,
      status: "pending",
    });

    return ok(res, leave, { message: "Leave application submitted successfully" });
  } catch (error) {
    next(error);
  }
}

/** Get staff salary & pay slips */
export async function getStaffSalary(req, res, next) {
  try {
    const staffId = req.user.id;
    const [employment, payrolls] = await Promise.all([
      HrEmployment.findOne({ employeeId: staffId, employeeType: "staff" }).lean(),
      HrPayroll.find({ employeeId: staffId, employeeType: "staff" }).sort({ month: -1 }).lean(),
    ]);

    return ok(res, {
      employment: employment
        ? {
            monthlySalary: employment.monthlySalary || 0,
            salaryTax: employment.salaryTax || 0,
            salaryDate: employment.salaryDate || "1st of every month",
            department: employment.department || "",
            joiningDate: employment.joiningDate || "",
            bankAccount: employment.bankAccount ? `•••• ${employment.bankAccount.slice(-4)}` : "—",
            ifsc: employment.ifsc || "—",
            upi: employment.upi || "—",
            workNotes: employment.workNotes || "",
          }
        : null,
      payrolls: payrolls.map((p) => ({
        id: p._id.toString(),
        month: p.month,
        gross: p.gross,
        deductions: p.deductions || 0,
        net: p.net,
        tax: p.tax || 0,
        status: p.status,
        paidAt: p.paidAt,
        notes: p.notes,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/** Get meetings scheduled for this staff role */
export async function getStaffMeetings(req, res, next) {
  try {
    const roleKey = req.user.role || "";
    const meetings = await HrMeeting.find({
      roles: { $in: [roleKey, "all"] },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return ok(res, meetings);
  } catch (error) {
    next(error);
  }
}

/** Get custom notifications sent to this staff member / role */
export async function getStaffNotifications(req, res, next) {
  try {
    const staffId = req.user.id;
    const roleKey = req.user.role || "";

    const [notifications, recentAnnouncements] = await Promise.all([
      StaffNotification.find({
        $or: [
          { targetType: "all" },
          { targetRole: "all" },
          { targetRole: roleKey },
          { targetType: "role", targetRole: roleKey },
          { targetType: "staff", targetStaffId: staffId },
          { targetStaffId: staffId },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      HrAnnouncement.find({
        status: "published",
        $or: [
          { roleKey: "all" },
          { roleKey: roleKey },
          { roleKey: "" },
          { roleKey: null },
          { roleKey: { $exists: false } },
        ],
      })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const existingAnnouncementIds = new Set(
      notifications
        .filter((n) => n.category === "announcement" && n.data?.id)
        .map((n) => n.data.id.toString())
    );

    const merged = [...notifications];
    recentAnnouncements.forEach((a) => {
      if (!existingAnnouncementIds.has(a._id.toString())) {
        merged.push({
          _id: a._id,
          title: `📢 ${a.title}`,
          message: a.body || "New company announcement published.",
          priority: "important",
          category: "announcement",
          data: { type: "announcement", id: a._id.toString() },
          sentBy: a.createdBy || "HR Operations",
          createdAt: a.publishedAt || a.createdAt,
          readBy: [],
        });
      }
    });

    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const results = merged.map((n) => ({
      id: n._id.toString(),
      title: n.title,
      message: n.message,
      priority: n.priority,
      category: n.category,
      data: n.data || {},
      sentBy: n.sentBy,
      createdAt: n.createdAt,
      isRead: (n.readBy || []).includes(staffId),
    }));

    return ok(res, results);
  } catch (error) {
    next(error);
  }
}

/** Mark custom notification read */
export async function markStaffNotificationRead(req, res, next) {
  try {
    const staffId = req.user.id;
    const { id } = req.params;

    await StaffNotification.findByIdAndUpdate(id, {
      $addToSet: { readBy: staffId },
    });

    return ok(res, { id, isRead: true });
  } catch (error) {
    next(error);
  }
}

/** Save / register staff device FCM token */
export async function updateStaffFcmToken(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) return fail(res, 400, "Device token is required");

    await Staff.findByIdAndUpdate(req.user.id, {
      $addToSet: { fcmTokens: token },
    });

    return ok(res, null, { message: "FCM token registered successfully" });
  } catch (error) {
    next(error);
  }
}

/** Helper function to send push notification to staff (single staff, by role, or all staff) */
export async function sendStaffPushNotification(target, { title, body, data = {} }) {
  try {
    const messaging = getStaffFirebaseMessaging();
    if (!messaging) return;

    let query = { isActive: true };
    if (typeof target === "string") {
      query._id = target;
    } else if (target && typeof target === "object") {
      if (target.targetType === "staff" && target.targetStaffId) {
        query._id = target.targetStaffId;
      } else if (target.targetType === "role" && target.targetRole && target.targetRole !== "all") {
        query.role = target.targetRole;
      } else if (Array.isArray(target.targetRoles) && target.targetRoles.length > 0) {
        if (!target.targetRoles.includes("all")) {
          query.role = { $in: target.targetRoles };
        }
      }
    }

    const staffMembers = await Staff.find(query).select("fcmTokens").lean();
    const tokens = (staffMembers || [])
      .flatMap((s) => s.fcmTokens || [])
      .filter((t) => typeof t === "string" && t.trim().length > 0);

    if (!tokens.length) return;

    const uniqueTokens = [...new Set(tokens)];

    const response = await messaging.sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title, body },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "staff_notifications",
          priority: "high",
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
      ),
    });
    console.log(`[StaffPush] Sent push notification: ${response?.successCount || 0} succeeded, ${response?.failureCount || 0} failed`);

    if (response && response.responses) {
      const deadTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            deadTokens.push(uniqueTokens[idx]);
          }
        }
      });
      if (deadTokens.length > 0) {
        Staff.updateMany(
          { fcmTokens: { $in: deadTokens } },
          { $pull: { fcmTokens: { $in: deadTokens } } }
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[StaffPush] Notification delivery error:", err.message);
  }
}
