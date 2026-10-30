import mongoose from "mongoose";
import {
  HR_ROLE_KEYS,
  HrAnnouncement,
  HrAttendance,
  HrCandidate,
  HrLeavePolicy,
  HrLeaveRequest,
  HrPayroll,
  HrShift,
  HrTask,
  HrVacancy,
  HrMeeting,
  HrVendorLeavePolicy,
  HrEmployment,
  HrPromotion,
  HrIncrement,
  HrPerformanceLog,
} from "./models.js";
import { ROLE_LABELS } from "../../staff-service/src/constants/roles.js";
import CustomRole from "../../staff-service/src/models/CustomRole.js";
import StaffNotification from "../../staff-service/src/models/StaffNotification.js";
import { sendStaffPushNotification } from "../../staff-service/src/controllers/staffAppControllers.js";
import { loadScopedHrPeople } from "./opsControllers.js";
import {
  VENDOR_HR_ROLE_KEYS,
  allowedHrRole,
  canManageHrEmployee,
  hrEmployeeFilter,
  hrOwnerFilter,
  hrOwnerId,
  isVendorScope,
  liveHrOwnerFilter,
  ownsHrRecord,
  scopedRoles,
  withHrScope,
} from "./hrScope.js";

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

async function notifyDeliveryBoysAnnouncement(row) {
  try {
    if (row.vendorId) return;
    const roleKey = String(row.roleKey || "all").toLowerCase();
    if (roleKey !== "all" && roleKey !== "delivery_boy") return;

    const DeliveryBoy = (await import("../../delivery-service/src/models/DeliveryBoy.js")).default;
    const { notifyRiders } = await import(
      "../../delivery-service/src/services/RiderNotificationService.js"
    );
    const riders = await DeliveryBoy.find({ isActive: { $ne: false } }).select("_id");
    if (!riders.length) return;
    await notifyRiders({
      riderIds: riders.map((r) => r._id),
      type: "ANNOUNCEMENT",
      title: row.title || "New announcement",
      message: row.body || "You have a new announcement",
      priority: "normal",
      dedupeKey: `announcement:${String(row._id || "")}`,
      data: {
        announcementId: String(row._id || ""),
        screen: "notifications",
        badge: "new",
      },
    });
    await DeliveryBoy.updateMany(
      { _id: { $in: riders.map((r) => r._id) } },
      { $addToSet: { syncedAnnouncementIds: String(row._id || "") } }
    );
  } catch (err) {
    console.warn("[HR] announcement notify failed:", err.message);
  }
}

export const HR_ROLES = [
  { value: "all", label: "All roles" },
  ...HR_ROLE_KEYS.map((value) => ({ value, label: ROLE_LABELS[value] || value.replaceAll("_", " ") })),
];

function daysBetween(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 1;
  return Math.round((to - from) / 86400000) + 1;
}

async function ensureLeavePolicies() {
  const existing = await HrLeavePolicy.find().lean();
  const have = new Set(existing.map((row) => row.roleKey));
  const missing = HR_ROLE_KEYS.filter((role) => !have.has(role));
  if (missing.length) {
    await HrLeavePolicy.insertMany(
      missing.map((roleKey) => ({
        roleKey,
        casualDays: 12,
        sickDays: 12,
        earnedDays: 15,
        notes: "Default annual leave policy",
      }))
    );
  }
  return HrLeavePolicy.find().sort({ roleKey: 1 }).lean();
}

async function ensureVendorLeavePolicies(vendorId) {
  const existing = await HrVendorLeavePolicy.find({ vendorId }).lean();
  const have = new Set(existing.map((row) => row.roleKey));
  const missing = VENDOR_HR_ROLE_KEYS.filter((role) => !have.has(role));
  if (missing.length) {
    await HrVendorLeavePolicy.insertMany(
      missing.map((roleKey) => ({
        vendorId,
        roleKey,
        casualDays: 12,
        sickDays: 12,
        earnedDays: 15,
        notes: "Default annual leave policy",
      }))
    );
  }
  return HrVendorLeavePolicy.find({ vendorId }).sort({ roleKey: 1 }).lean();
}

export async function getHrPerson(req, res, next) {
  try {
    const { type, id } = req.params;
    const { people } = await loadScopedHrPeople(req);
    const person = people.find((row) => row.employeeType === type && String(row.id) === String(id));
    if (!person) return fail(res, 404, "Employee not found");
    const [attendance, leaves, payroll, tasks, shifts, meetings, promotions, increments, performanceLogs] = await Promise.all([
      HrAttendance.find({ employeeId: id }).sort({ clockIn: -1 }).limit(40).lean(),
      HrLeaveRequest.find({ employeeId: id }).sort({ fromDate: -1 }).limit(40).lean(),
      HrPayroll.find({ employeeId: id }).sort({ month: -1 }).limit(24).lean(),
      HrTask.find({ employeeId: id }).sort({ createdAt: -1 }).limit(40).lean(),
      HrShift.find({ employeeId: id }).sort({ date: -1 }).limit(40).lean(),
      HrMeeting.find({ roles: { $in: [person.roleKey || "all", "all"] }, ...hrOwnerFilter(req) })
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
      HrPromotion.find({ employeeId: id }).sort({ effectiveDate: -1, createdAt: -1 }).limit(40).lean(),
      HrIncrement.find({ employeeId: id }).sort({ effectiveDate: -1, createdAt: -1 }).limit(40).lean(),
      HrPerformanceLog.find({ employeeId: id }).sort({ reviewDate: -1, createdAt: -1 }).limit(40).lean(),
    ]);
    return ok(res, { person, attendance, leaves, payroll, tasks, shifts, meetings, promotions, increments, performanceLogs });
  } catch (error) {
    next(error);
  }
}

export async function listHrRoles(req, res, next) {
  try {
    const { people } = await loadScopedHrPeople(req);
    const counts = {};
    people.forEach((person) => {
      const key = person.roleKey || "other";
      counts[key] = (counts[key] || 0) + 1;
    });
    const roles = scopedRoles(req, HR_ROLES).filter((role) => role.value !== "all").map((role) => ({
      ...role,
      count: counts[role.value] || 0,
    }));

    if (!isVendorScope(req)) {
      const customRoles = await CustomRole.find({ isActive: true }).lean().catch(() => []);
      customRoles.forEach((cr) => {
        roles.push({
          value: cr.roleKey,
          label: cr.displayName,
          department: cr.department || "Operations",
          isCustom: true,
          count: counts[cr.roleKey] || 0,
        });
      });
    }

    return ok(res, roles, { stats: { total: people.length } });
  } catch (error) {
    next(error);
  }
}

function mapJwtRoleToHrKey(role) {
  const raw = String(role || "").trim();
  if (HR_ROLE_KEYS.includes(raw.toLowerCase())) return raw.toLowerCase();
  const compact = raw.replace(/[\s-]/g, "_").toUpperCase();
  const map = {
    VENDOR: "vendor",
    SEGREGATION_MANAGER: "segregation_manager",
    PRODUCT_MANAGER: "product_manager",
    FARMER_MANAGER: "farmer_manager",
    FARMER: "farmer",
    DRIVER: "pickup_driver",
    PICKUP_DRIVER: "pickup_driver",
    DELIVERY_MANAGER: "delivery_manager",
    DELIVERY_BOY: "delivery_boy",
    ADMIN: "admin",
  };
  return map[compact] || null;
}

function roleKeyToEmployeeType(roleKey) {
  if (roleKey === "delivery_boy") return "delivery_boy";
  if (roleKey === "delivery_manager") return "delivery_manager";
  if (roleKey === "pickup_driver") return "pickup_driver";
  if (roleKey === "farmer_manager") return "farmer_manager";
  return "staff";
}

function normalizeLeaveDates({ dates, fromDate, toDate }) {
  let list = Array.isArray(dates)
    ? dates.map((d) => String(d || "").trim().slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    : [];
  if (!list.length) {
    const from = String(fromDate || "").trim().slice(0, 10);
    const to = String(toDate || fromDate || "").trim().slice(0, 10);
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(to) && to !== from) {
        const cursor = new Date(`${from}T00:00:00`);
        const last = new Date(`${to}T00:00:00`);
        while (cursor <= last) {
          list.push(todayYmd(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        list = [from];
      }
    }
  }
  list = [...new Set(list)].sort();
  return {
    dates: list,
    fromDate: list[0] || "",
    toDate: list[list.length - 1] || "",
    days: list.length || 1,
  };
}

function todayYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Date-only YYYY-MM-DD is due on that calendar day; full timestamps use wall-clock. */
function isScheduleDue(scheduledAt, now = new Date()) {
  const raw = String(scheduledAt || "").trim();
  if (!raw) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw <= todayYmd(now);
  const when = new Date(raw);
  return !Number.isNaN(when.getTime()) && when <= now;
}

function resolveAnnouncementStatus({ status, scheduledAt }) {
  const date = String(scheduledAt || "").trim();
  const wanted = String(status || "").trim().toLowerCase();
  if (wanted === "draft") return "draft";
  if (wanted === "published") return "published";
  if (date) return isScheduleDue(date) ? "published" : "scheduled";
  if (wanted === "scheduled") return "draft";
  // Default: publish immediately so role apps/panels can see it
  return "published";
}

async function publishDueAnnouncements() {
  const now = new Date();
  const scheduled = await HrAnnouncement.find({ status: "scheduled" })
    .select("_id scheduledAt title body roleKey category")
    .lean();
  const due = scheduled.filter((row) => isScheduleDue(row.scheduledAt, now));
  const dueIds = due.map((row) => row._id);
  if (dueIds.length) {
    await HrAnnouncement.updateMany(
      { _id: { $in: dueIds } },
      { $set: { status: "published", publishedAt: now } }
    );
    for (const row of due) {
      notifyDeliveryBoysAnnouncement({ ...row, status: "published" }).catch(() => {});
    }
  }
}

async function publishDueShifts() {
  const filter = { status: "scheduled", date: { $lte: todayYmd() } };
  if (!(await HrShift.exists(filter))) return;
  await HrShift.updateMany(filter, { $set: { status: "published" } });
}

function announcementKind(row) {
  const cat = String(row.category || "announcement").toLowerCase();
  if (cat === "holiday" || cat === "note") return cat;
  return "announcement";
}

function normalizeAnnouncementCategory(value) {
  const cat = String(value || "announcement").toLowerCase().trim();
  if (cat === "holiday" || cat === "note" || cat === "announcement") return cat;
  return "announcement";
}

export async function listLiveHrAnnouncements(req, res, next) {
  try {
    await publishDueAnnouncements();
    const queried = String(req.query.role || "").trim().toLowerCase();
    const roleKey = HR_ROLE_KEYS.includes(queried) ? queried : mapJwtRoleToHrKey(req.user?.role);
    if (!roleKey) return fail(res, 400, "role is required");
    const today = todayYmd();
    const rows = await HrAnnouncement.find({
      status: "published",
      roleKey: { $in: ["all", roleKey] },
      ...liveHrOwnerFilter(req.user),
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(40)
      .select("title body roleKey category scheduledAt publishedAt createdAt")
      .lean();
    const live = rows.filter((row) => {
      const date = String(row.scheduledAt || row.publishedAt || row.createdAt || "").slice(0, 10);
      return !date || date >= today;
    });
    return ok(
      res,
      live.slice(0, 20).map((row) => ({
        ...row,
        kind: announcementKind(row),
        category: announcementKind(row),
      }))
    );
  } catch (error) {
    next(error);
  }
}

export async function listHrAnnouncements(req, res, next) {
  try {
    await publishDueAnnouncements();
    const filter = { ...hrOwnerFilter(req) };
    if (req.query.roleKey && req.query.roleKey !== "all") {
      filter.$or = [{ roleKey: req.query.roleKey }, { roleKey: "all" }];
    }
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    const rows = await HrAnnouncement.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, rows, {
      roles: scopedRoles(req, HR_ROLES),
      stats: {
        draft: rows.filter((row) => row.status === "draft").length,
        scheduled: rows.filter((row) => row.status === "scheduled").length,
        published: rows.filter((row) => row.status === "published").length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createHrAnnouncement(req, res, next) {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return fail(res, 400, "Title is required");
    const scheduledAt = String(req.body.scheduledAt || "").trim();
    const status = resolveAnnouncementStatus({ status: req.body.status, scheduledAt });
    const category = normalizeAnnouncementCategory(req.body.category || req.body.kind);
    const roleKey = String(req.body.roleKey || "all").trim() || "all";
    if (!allowedHrRole(req, roleKey, { allowAll: true })) return fail(res, 400, "Choose a role from your team");
    const row = await HrAnnouncement.create({
      title,
      body: String(req.body.body || "").trim(),
      roleKey,
      category,
      status,
      scheduledAt,
      publishedAt: status === "published" ? new Date() : null,
      createdBy: req.user?.email || req.user?.name || (isVendorScope(req) ? "vendor" : "admin"),
      vendorId: hrOwnerId(req),
    });
    if (row.status === "published") {
      notifyDeliveryBoysAnnouncement(row).catch(() => {});
      StaffNotification.create({
        title: `📢 ${row.title}`,
        message: row.body || "New company announcement published.",
        targetType: row.roleKey && row.roleKey !== "all" ? "role" : "all",
        targetRole: row.roleKey && row.roleKey !== "all" ? row.roleKey : "",
        priority: "important",
        category: "announcement",
        data: { type: "announcement", id: row._id.toString() },
        sentBy: row.createdBy || "Admin",
      }).catch((e) => console.error("[StaffNotif] Announcement create error:", e.message));
      sendStaffPushNotification(
        row.roleKey && row.roleKey !== "all" ? { targetType: "role", targetRole: row.roleKey } : { targetType: "all" },
        {
          title: `📢 ${row.title}`,
          body: row.body || "New company announcement published.",
          data: { type: "announcement", id: row._id.toString() },
        }
      ).catch(() => {});
    }
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function updateHrAnnouncement(req, res, next) {
  try {
    const row = await HrAnnouncement.findById(req.params.id);
    if (!row || !ownsHrRecord(req, row)) return fail(res, 404, "Announcement not found");
    if (req.body.roleKey !== undefined && !allowedHrRole(req, req.body.roleKey, { allowAll: true })) {
      return fail(res, 400, "Choose a role from your team");
    }
    ["title", "body", "roleKey", "scheduledAt"].forEach((key) => {
      if (req.body[key] !== undefined) row[key] = req.body[key];
    });
    if (req.body.category !== undefined || req.body.kind !== undefined) {
      row.category = normalizeAnnouncementCategory(req.body.category || req.body.kind);
    }
    if (req.body.status !== undefined || req.body.scheduledAt !== undefined) {
      const status = resolveAnnouncementStatus({
        status: req.body.status !== undefined ? req.body.status : row.status,
        scheduledAt: row.scheduledAt,
      });
      row.status = status;
      if (status === "published" && !row.publishedAt) row.publishedAt = new Date();
    }
    await row.save();
    if (row.status === "published") {
      notifyDeliveryBoysAnnouncement(row).catch(() => {});
      StaffNotification.create({
        title: `📢 ${row.title}`,
        message: row.body || "New company announcement published.",
        targetType: row.roleKey && row.roleKey !== "all" ? "role" : "all",
        targetRole: row.roleKey && row.roleKey !== "all" ? row.roleKey : "",
        priority: "important",
        category: "announcement",
        data: { type: "announcement", id: row._id.toString() },
        sentBy: "Admin",
      }).catch((e) => console.error("[StaffNotif] Announcement update error:", e.message));
      sendStaffPushNotification(
        row.roleKey && row.roleKey !== "all" ? { targetType: "role", targetRole: row.roleKey } : { targetType: "all" },
        {
          title: `📢 ${row.title}`,
          body: row.body || "New company announcement published.",
          data: { type: "announcement", id: row._id.toString() },
        }
      ).catch(() => {});
    }
    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function deleteHrAnnouncement(req, res, next) {
  try {
    const row = await HrAnnouncement.findOneAndDelete({ _id: req.params.id, ...hrOwnerFilter(req) });
    if (!row) return fail(res, 404, "Announcement not found");
    return ok(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
}

export async function listHrLeavePolicies(req, res, next) {
  try {
    const rows = isVendorScope(req) ? await ensureVendorLeavePolicies(hrOwnerId(req)) : await ensureLeavePolicies();
    return ok(
      res,
      rows.map((row) => ({
        ...row,
        role: ROLE_LABELS[row.roleKey] || row.roleKey,
      }))
    );
  } catch (error) {
    next(error);
  }
}

export async function upsertHrLeavePolicy(req, res, next) {
  try {
    const roleKey = String(req.body.roleKey || req.params.roleKey || "").trim();
    if (!HR_ROLE_KEYS.includes(roleKey) || !allowedHrRole(req, roleKey)) return fail(res, 400, "Invalid role");
    const Model = isVendorScope(req) ? HrVendorLeavePolicy : HrLeavePolicy;
    const row = await Model.findOneAndUpdate(
      isVendorScope(req) ? { vendorId: hrOwnerId(req), roleKey } : { roleKey },
      {
        $set: {
          casualDays: Math.max(0, Number(req.body.casualDays ?? 12)),
          sickDays: Math.max(0, Number(req.body.sickDays ?? 12)),
          earnedDays: Math.max(0, Number(req.body.earnedDays ?? 15)),
          notes: String(req.body.notes || "").trim(),
        },
      },
      { new: true, upsert: true }
    );
    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function listHrLeaves(req, res, next) {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.roleKey && req.query.roleKey !== "all") filter.roleKey = req.query.roleKey;
    const scopeFilter = await hrEmployeeFilter(req);
    const rows = await HrLeaveRequest.find(withHrScope(filter, scopeFilter)).sort({ createdAt: -1 }).limit(400).lean();
    const allForStats =
      req.query.roleKey && req.query.roleKey !== "all"
        ? await HrLeaveRequest.find(withHrScope({}, scopeFilter)).select("roleKey status").lean()
        : rows;
    const byRole = {};
    allForStats.forEach((row) => {
      const key = String(row.roleKey || "other").trim() || "other";
      if (!byRole[key]) byRole[key] = { total: 0, pending: 0, approved: 0, rejected: 0 };
      byRole[key].total += 1;
      if (row.status === "pending") byRole[key].pending += 1;
      else if (row.status === "approved") byRole[key].approved += 1;
      else if (row.status === "rejected") byRole[key].rejected += 1;
    });
    return ok(res, rows, {
      roles: scopedRoles(req, HR_ROLES).filter((role) => role.value !== "all"),
      byRole,
      stats: {
        pending: rows.filter((row) => row.status === "pending").length,
        approved: rows.filter((row) => row.status === "approved").length,
        rejected: rows.filter((row) => row.status === "rejected").length,
        total: rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createHrLeave(req, res, next) {
  try {
    const employeeId = String(req.body.employeeId || "").trim();
    const name = String(req.body.name || "").trim();
    const normalized = normalizeLeaveDates({
      dates: req.body.dates,
      fromDate: req.body.fromDate,
      toDate: req.body.toDate,
    });
    if (!employeeId || !name) return fail(res, 400, "Employee is required");
    if (!normalized.fromDate) return fail(res, 400, "Leave dates are required");
    if (!(await canManageHrEmployee(req, req.body.employeeType || "staff", employeeId))) {
      return fail(res, 403, "This employee is not in your team");
    }
    const status = req.body.status === "approved" || req.body.assign ? "approved" : "pending";
    const row = await HrLeaveRequest.create({
      employeeId,
      employeeType: req.body.employeeType || "staff",
      name,
      role: String(req.body.role || "").trim(),
      roleKey: String(req.body.roleKey || "").trim(),
      leaveType: ["casual", "sick", "earned", "unpaid"].includes(req.body.leaveType) ? req.body.leaveType : "casual",
      fromDate: normalized.fromDate,
      toDate: normalized.toDate,
      dates: normalized.dates,
      days: normalized.days,
      reason: String(req.body.reason || "").trim(),
      status,
      assignedBy: status === "approved" ? req.user?.email || req.user?.name || (isVendorScope(req) ? "vendor" : "admin") : "",
    });
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function applyHrLeave(req, res, next) {
  try {
    if (!req.user?.id) return fail(res, 401, "Login required");
    const roleKey = mapJwtRoleToHrKey(req.user.role);
    if (!roleKey) return fail(res, 403, "Your role cannot apply for leave here");
    const normalized = normalizeLeaveDates({
      dates: req.body.dates,
      fromDate: req.body.fromDate,
      toDate: req.body.toDate,
    });
    if (!normalized.dates.length) return fail(res, 400, "Add at least one leave date");
    const name =
      String(req.body.name || "").trim() ||
      String(req.user.email || "").trim() ||
      "Employee";
    const row = await HrLeaveRequest.create({
      employeeId: String(req.user.id),
      employeeType: roleKeyToEmployeeType(roleKey),
      name,
      role: ROLE_LABELS[roleKey] || roleKey.replaceAll("_", " "),
      roleKey,
      leaveType: ["casual", "sick", "earned", "unpaid"].includes(req.body.leaveType)
        ? req.body.leaveType
        : "casual",
      fromDate: normalized.fromDate,
      toDate: normalized.toDate,
      dates: normalized.dates,
      days: normalized.days,
      reason: String(req.body.reason || "").trim(),
      status: "pending",
    });
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function listMyHrLeaves(req, res, next) {
  try {
    if (!req.user?.id) return fail(res, 401, "Login required");
    const rows = await HrLeaveRequest.find({ employeeId: String(req.user.id) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok(res, rows);
  } catch (error) {
    next(error);
  }
}

export async function updateHrLeave(req, res, next) {
  try {
    const row = await HrLeaveRequest.findById(req.params.id);
    if (!row || !(await canManageHrEmployee(req, row.employeeType, row.employeeId))) {
      return fail(res, 404, "Leave request not found");
    }
    ["leaveType", "fromDate", "toDate", "reason", "adminNotes", "status"].forEach((key) => {
      if (req.body[key] !== undefined) row[key] = req.body[key];
    });
    if (row.fromDate && row.toDate) row.days = daysBetween(row.fromDate, row.toDate);
    if (req.body.status === "approved" || req.body.status === "rejected") {
      row.assignedBy =
        req.user?.email || req.user?.name || row.assignedBy || (isVendorScope(req) ? "vendor" : "admin");

      try {
        const StaffNotification = mongoose.models.StaffNotification;
        if (StaffNotification && row.employeeId) {
          const isRej = req.body.status === "rejected";
          await StaffNotification.create({
            title: isRej ? "Leave Request Rejected" : "Leave Request Approved",
            message: isRej
              ? `Your ${String(row.leaveType || "leave").toUpperCase()} request (${row.fromDate} to ${row.toDate}) for ${row.days || 1} day(s) was rejected. The days have been credited back to your leave balance.`
              : `Your ${String(row.leaveType || "leave").toUpperCase()} request (${row.fromDate} to ${row.toDate}) for ${row.days || 1} day(s) has been approved.`,
            targetType: "staff",
            targetStaffId: String(row.employeeId),
            priority: isRej ? "urgent" : "important",
            category: "leave",
            data: {
              type: "leave",
              leaveId: row._id.toString(),
              status: req.body.status,
            },
            sentBy: row.assignedBy || "HR Management",
          });

          sendStaffPushNotification(
            String(row.employeeId),
            {
              title: isRej ? "Leave Request Rejected" : "Leave Request Approved",
              body: isRej
                ? `Your ${String(row.leaveType || "leave").toUpperCase()} request (${row.fromDate} to ${row.toDate}) was rejected.`
                : `Your ${String(row.leaveType || "leave").toUpperCase()} request (${row.fromDate} to ${row.toDate}) was approved!`,
              data: {
                type: "leave",
                leaveId: row._id.toString(),
                status: req.body.status,
              },
            }
          ).catch((e) => console.error("[StaffPush] Leave push error:", e.message));
        }
      } catch (_) {}
    }
    await row.save();
    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function deleteHrLeave(req, res, next) {
  try {
    const existing = await HrLeaveRequest.findById(req.params.id).lean();
    if (!existing || !(await canManageHrEmployee(req, existing.employeeType, existing.employeeId))) {
      return fail(res, 404, "Leave request not found");
    }
    const row = await HrLeaveRequest.findByIdAndDelete(req.params.id);
    if (!row) return fail(res, 404, "Leave request not found");
    return ok(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
}

export async function listHrShifts(req, res, next) {
  try {
    const filter = {};
    if (req.query.roleKey && req.query.roleKey !== "all") filter.roleKey = req.query.roleKey;
    if (req.query.date) filter.date = req.query.date;
    const rows = await HrShift.find(withHrScope(filter, await hrEmployeeFilter(req)))
      .sort({ date: -1, startTime: 1 })
      .limit(400)
      .lean();
    return ok(res, rows);
  } catch (error) {
    next(error);
  }
}

export async function createHrShift(req, res, next) {
  try {
    const employeeId = String(req.body.employeeId || "").trim();
    const name = String(req.body.name || "").trim();
    const date = String(req.body.date || "").trim();
    if (!employeeId || !name || !date) return fail(res, 400, "Employee and date are required");
    if (!(await canManageHrEmployee(req, req.body.employeeType || "staff", employeeId))) {
      return fail(res, 403, "This employee is not in your team");
    }
    let status = req.body.status === "scheduled" ? "scheduled" : "published";
    if (status === "scheduled" && isScheduleDue(date)) status = "published";
    const row = await HrShift.create({
      employeeId,
      employeeType: req.body.employeeType || "staff",
      name,
      role: String(req.body.role || "").trim(),
      roleKey: String(req.body.roleKey || "").trim(),
      date,
      startTime: String(req.body.startTime || "09:00"),
      endTime: String(req.body.endTime || "18:00"),
      shiftName: String(req.body.shiftName || "General").trim(),
      notes: String(req.body.notes || "").trim(),
      status,
    });
    if ((!row.employeeType || row.employeeType === "staff") && row.employeeId) {
      StaffNotification.create({
        title: "📅 New Shift Assigned",
        message: `You have been assigned to ${row.shiftName || "a shift"} on ${row.date} (${row.startTime} - ${row.endTime}).`,
        targetType: "staff",
        targetStaffId: String(row.employeeId),
        priority: "important",
        category: "shift",
        data: { type: "shift", shiftId: row._id.toString(), date: row.date },
        sentBy: "HR Management",
      }).catch((e) => console.error("[StaffNotif] Shift create error:", e.message));
      sendStaffPushNotification(
        String(row.employeeId),
        {
          title: "📅 New Shift Assigned",
          body: `You have been assigned to ${row.shiftName || "a shift"} on ${row.date} (${row.startTime} - ${row.endTime}).`,
          data: {
            type: "shift",
            shiftId: row._id.toString(),
            date: row.date,
          },
        }
      ).catch((e) => console.error("[StaffPush] Shift push error:", e.message));
    }
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function updateHrShift(req, res, next) {
  try {
    const row = await HrShift.findById(req.params.id);
    if (!row || !(await canManageHrEmployee(req, row.employeeType, row.employeeId))) {
      return fail(res, 404, "Shift not found");
    }
    ["date", "startTime", "endTime", "shiftName", "notes", "name", "role", "roleKey"].forEach((key) => {
      if (req.body[key] !== undefined) row[key] = req.body[key];
    });
    if (req.body.status !== undefined) {
      let status = req.body.status === "scheduled" ? "scheduled" : "published";
      if (status === "scheduled" && isScheduleDue(row.date)) status = "published";
      row.status = status;
    }
    await row.save();
    if ((!row.employeeType || row.employeeType === "staff") && row.employeeId) {
      StaffNotification.create({
        title: "📅 Shift Schedule Updated",
        message: `Your shift (${row.shiftName || "Shift"}) on ${row.date} is updated to ${row.startTime} - ${row.endTime}.`,
        targetType: "staff",
        targetStaffId: String(row.employeeId),
        priority: "important",
        category: "shift",
        data: { type: "shift", shiftId: row._id.toString(), date: row.date },
        sentBy: "HR Management",
      }).catch((e) => console.error("[StaffNotif] Shift update error:", e.message));
      sendStaffPushNotification(
        String(row.employeeId),
        {
          title: "📅 Shift Schedule Updated",
          body: `Your shift (${row.shiftName || "Shift"}) on ${row.date} is updated to ${row.startTime} - ${row.endTime}.`,
          data: {
            type: "shift",
            shiftId: row._id.toString(),
            date: row.date,
          },
        }
      ).catch((e) => console.error("[StaffPush] Shift update push error:", e.message));
    }
    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function deleteHrShift(req, res, next) {
  try {
    const existing = await HrShift.findById(req.params.id).lean();
    if (!existing || !(await canManageHrEmployee(req, existing.employeeType, existing.employeeId))) {
      return fail(res, 404, "Shift not found");
    }
    const row = await HrShift.findByIdAndDelete(req.params.id);
    if (!row) return fail(res, 404, "Shift not found");
    return ok(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
}

export async function listHrCalendar(req, res, next) {
  try {
    await publishDueAnnouncements();
    await publishDueShifts();
    const month = String(req.query.month || todayYmd().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(month)) return fail(res, 400, "month must be YYYY-MM");
    const roleKey = String(req.query.roleKey || "all").trim();
    const monthStart = new Date(`${month}-01T00:00:00`);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const { people } = await loadScopedHrPeople(req);
    const scopeFilter = await hrEmployeeFilter(req);
    const peopleByKey = new Map(
      people.map((person) => [`${person.employeeType}:${String(person.id)}`, person])
    );
    const resolvedRole = (row) => {
      const stored = String(row.roleKey || "").trim();
      if (stored) return stored;
      const person = peopleByKey.get(`${row.employeeType}:${String(row.employeeId || "")}`);
      return String(person?.roleKey || "all").trim() || "all";
    };
    const matchesRole = (row) => {
      const key = resolvedRole(row);
      if (!roleKey || roleKey === "all") return true;
      return key === roleKey || key === "all";
    };
    const inMonth = (value) => {
      const day = String(value || "").slice(0, 10);
      return day.startsWith(month);
    };
    const [announcements, shifts] = await Promise.all([
      HrAnnouncement.find({
        ...hrOwnerFilter(req),
        $or: [
          { scheduledAt: { $regex: `^${month}` } },
          { publishedAt: { $gte: monthStart, $lt: monthEnd } },
          {
            $and: [
              { $or: [{ scheduledAt: "" }, { scheduledAt: null }, { scheduledAt: { $exists: false } }] },
              { createdAt: { $gte: monthStart, $lt: monthEnd } },
            ],
          },
        ],
      }).lean(),
      HrShift.find(withHrScope({ date: { $regex: `^${month}` } }, scopeFilter)).lean(),
    ]);
    const events = [
      ...announcements
        .filter(matchesRole)
        .map((row) => {
          const date = (row.scheduledAt || row.publishedAt || row.createdAt || "")
            .toString()
            .slice(0, 10);
          const kind = announcementKind(row);
          return {
            id: String(row._id),
            kind,
            title: row.title,
            date,
            roleKey: resolvedRole(row),
            status: row.status,
            body: row.body || "",
            meta: row,
          };
        })
        .filter((row) => inMonth(row.date)),
      ...shifts.filter(matchesRole).map((row) => ({
        id: String(row._id),
        kind: "shift",
        title: `${row.name} · ${row.shiftName}`,
        date: row.date,
        roleKey: resolvedRole(row),
        status: row.status || "published",
        body: `${row.startTime || ""}–${row.endTime || ""}`.trim(),
        meta: row,
      })),
    ];
    return ok(res, events, { month, roleKey, roles: scopedRoles(req, HR_ROLES) });
  } catch (error) {
    next(error);
  }
}

/** Role apps/panels: upcoming calendar notes + shifts for this role (role-scoped). */
export async function listLiveHrCalendar(req, res, next) {
  try {
    await publishDueAnnouncements();
    await publishDueShifts();
    const queried = String(req.query.role || "").trim().toLowerCase();
    const roleKey = HR_ROLE_KEYS.includes(queried) ? queried : mapJwtRoleToHrKey(req.user?.role);
    if (!roleKey) return fail(res, 400, "role is required");
    const today = todayYmd();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    const until = todayYmd(horizon);
    const viewerVendorId = String(req.user?.vendorId || "").trim();
    const teamShiftFilter =
      viewerVendorId && VENDOR_HR_ROLE_KEYS.includes(roleKey)
        ? await hrEmployeeFilter({ hrScope: { vendorId: viewerVendorId } })
        : null;

    const [announcements, shifts] = await Promise.all([
      HrAnnouncement.find({
        status: { $in: ["published", "scheduled"] },
        roleKey: { $in: ["all", roleKey] },
        ...liveHrOwnerFilter(req.user),
      })
        .sort({ scheduledAt: 1, publishedAt: -1, createdAt: -1 })
        .limit(40)
        .select("title body roleKey category status scheduledAt publishedAt createdAt")
        .lean(),
      HrShift.find(
        withHrScope(
          {
            roleKey: { $in: ["all", roleKey] },
            date: { $gte: today, $lte: until },
            $or: [{ status: "published" }, { status: { $exists: false } }, { status: null }],
          },
          teamShiftFilter
        )
      )
        .sort({ date: 1, startTime: 1 })
        .limit(40)
        .lean(),
    ]);

    const announcementEvents = announcements
      .map((row) => {
        const date = (row.scheduledAt || row.publishedAt || row.createdAt || "")
          .toString()
          .slice(0, 10);
        if (!date) return null;
        if (row.status === "scheduled") {
          if (date < today || date > until) return null;
        } else if (date < today) {
          return null;
        }
        const kind = announcementKind(row);
        return {
          id: String(row._id),
          kind,
          category: kind,
          title: row.title,
          body: row.body || "",
          date,
          roleKey: row.roleKey || "all",
          status: row.status,
        };
      })
      .filter(Boolean);

    const shiftEvents = shifts.map((row) => ({
      id: String(row._id),
      kind: "shift",
      title: `${row.name || "Shift"} · ${row.shiftName || "General"}`,
      body: `${row.startTime || ""}–${row.endTime || ""}`.trim(),
      date: row.date,
      roleKey: row.roleKey || roleKey,
      status: row.status || "published",
    }));

    const events = [...announcementEvents, ...shiftEvents].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );

    return ok(res, events.slice(0, 20));
  } catch (error) {
    next(error);
  }
}

export async function listHrVacancies(req, res, next) {
  try {
    const filter = { ...hrOwnerFilter(req) };
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.roleKey && req.query.roleKey !== "all") filter.roleKey = req.query.roleKey;
    const rows = await HrVacancy.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, rows, { roles: scopedRoles(req, HR_ROLES).filter((role) => role.value !== "all") });
  } catch (error) {
    next(error);
  }
}

/** Public: open vacancies for the customer Careers page */
export async function listOpenHrVacancies(_req, res, next) {
  try {
    const rows = await HrVacancy.find({ status: "open" }).sort({ createdAt: -1 }).lean();
    const data = rows.map((row) => ({
      _id: row._id,
      title: row.title,
      roleKey: row.roleKey,
      roleLabel: ROLE_LABELS[row.roleKey] || String(row.roleKey || "").replaceAll("_", " "),
      openings: row.openings,
      location: row.location,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
    return ok(res, data);
  } catch (error) {
    next(error);
  }
}

/** Public: candidate applies from Careers page */
export async function applyHrCandidate(req, res, next) {
  try {
    const vacancyId = String(req.body.vacancyId || "").trim();
    if (!vacancyId) return fail(res, 400, "Choose a vacancy to apply for");
    const vacancy = await HrVacancy.findById(vacancyId).lean();
    if (!vacancy || vacancy.status !== "open") {
      return fail(res, 404, "This vacancy is no longer open");
    }

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    if (!name) return fail(res, 400, "Your name is required");
    if (!email && !phone) return fail(res, 400, "Provide at least email or phone");

    const resumeUrl = String(req.body.resumeUrl || "").trim();
    const resumeData = String(req.body.resumeData || "").slice(0, 2_000_000);
    const resumeName = String(req.body.resumeName || "").trim();
    if (!resumeUrl && !resumeData) {
      return fail(res, 400, "Upload a resume or provide a resume URL");
    }

    const by = email || phone || "careers";
    const row = await HrCandidate.create({
      name,
      email,
      phone,
      roleKey: vacancy.roleKey,
      vacancyId: String(vacancy._id),
      vendorId: vacancy.vendorId || "",
      section: "applied",
      applicationStatus: "pending",
      finalizeStatus: "",
      stage: "applied",
      rating: 0,
      notes: "",
      adminNotes: "",
      address: String(req.body.address || "").trim(),
      city: String(req.body.city || "").trim(),
      experience: String(req.body.experience || "").trim(),
      education: String(req.body.education || "").trim(),
      currentCompany: String(req.body.currentCompany || "").trim(),
      expectedCtc: String(req.body.expectedCtc || "").trim(),
      noticePeriod: String(req.body.noticePeriod || "").trim(),
      coverLetter: String(req.body.coverLetter || "").trim(),
      linkedin: String(req.body.linkedin || "").trim(),
      resumeName: resumeName || (resumeUrl ? "resume-link" : "resume"),
      resumeUrl,
      resumeData,
      stageHistory: [
        {
          section: "applied",
          status: "pending",
          label: "Application received (Careers page)",
          notes: "",
          by,
          at: new Date(),
        },
      ],
    });

    return res.status(201).json({
      success: true,
      data: {
        _id: row._id,
        name: row.name,
        vacancyId: row.vacancyId,
        section: row.section,
        applicationStatus: row.applicationStatus,
        createdAt: row.createdAt,
      },
      message: "Application submitted",
    });
  } catch (error) {
    next(error);
  }
}

export async function createHrVacancy(req, res, next) {
  try {
    const title = String(req.body.title || "").trim();
    const roleKey = String(req.body.roleKey || "").trim();
    if (!title) return fail(res, 400, "Vacancy title is required");
    if (!HR_ROLE_KEYS.includes(roleKey) || !allowedHrRole(req, roleKey)) {
      return fail(res, 400, "Choose a role for this vacancy");
    }
    const row = await HrVacancy.create({
      title,
      roleKey,
      openings: Math.max(1, Number(req.body.openings || 1)),
      location: String(req.body.location || "").trim(),
      description: String(req.body.description || "").trim(),
      status: req.body.status === "closed" ? "closed" : "open",
      vendorId: hrOwnerId(req),
    });
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function updateHrVacancy(req, res, next) {
  try {
    const row = await HrVacancy.findById(req.params.id);
    if (!row || !ownsHrRecord(req, row)) return fail(res, 404, "Vacancy not found");
    if (req.body.roleKey !== undefined && !allowedHrRole(req, req.body.roleKey)) {
      return fail(res, 400, "Choose a role for this vacancy");
    }
    ["title", "roleKey", "location", "description", "status"].forEach((key) => {
      if (req.body[key] !== undefined) row[key] = req.body[key];
    });
    if (req.body.openings !== undefined) row.openings = Math.max(1, Number(req.body.openings) || 1);
    await row.save();
    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

function pushCandidateHistory(row, { section, status, label, notes, by }) {
  if (!Array.isArray(row.stageHistory)) row.stageHistory = [];
  row.stageHistory.push({
    section: section || row.section || "",
    status: status || "",
    label: label || status || section || "",
    notes: notes || "",
    by: by || "admin",
    at: new Date(),
  });
}

function deriveCandidateSection(row) {
  if (row.section) return row.section;
  if (row.stage === "recruited") return "recruited";
  if (row.stage === "selected") return "selected";
  if (["interview", "shortlisted", "finalize"].includes(row.stage)) return "finalize";
  return "applied";
}

export async function listHrCandidates(req, res, next) {
  try {
    const filter = { ...hrOwnerFilter(req) };
    if (req.query.stage && req.query.stage !== "all") filter.stage = req.query.stage;
    if (req.query.applicationStatus && req.query.applicationStatus !== "all") {
      filter.applicationStatus = req.query.applicationStatus;
    }
    if (req.query.finalizeStatus && req.query.finalizeStatus !== "all") {
      filter.finalizeStatus = req.query.finalizeStatus;
    }
    if (req.query.roleKey && req.query.roleKey !== "all") filter.roleKey = req.query.roleKey;
    if (req.query.vacancyId) filter.vacancyId = req.query.vacancyId;
    const rows = await HrCandidate.find(filter)
      .select("-resumeData")
      .sort({ updatedAt: -1 })
      .lean();
    let normalized = rows.map((row) => ({
      ...row,
      section: deriveCandidateSection(row),
      applicationStatus:
        row.applicationStatus ||
        (row.stage === "rejected" ? "rejected" : row.stage === "screening" ? "in_review" : "pending"),
    }));
    if (req.query.section && req.query.section !== "all") {
      normalized = normalized.filter((row) => row.section === req.query.section);
    }
    const all = await HrCandidate.find(hrOwnerFilter(req)).select("section stage applicationStatus vacancyId").lean();
    const bySection = { applied: 0, selected: 0, finalize: 0, recruited: 0 };
    const recruitedByVacancy = {};
    all.forEach((row) => {
      const section = deriveCandidateSection(row);
      bySection[section] = (bySection[section] || 0) + 1;
      if (section === "recruited" && row.vacancyId) {
        const key = String(row.vacancyId);
        recruitedByVacancy[key] = (recruitedByVacancy[key] || 0) + 1;
      }
    });
    const byStage = {};
    normalized.forEach((row) => {
      byStage[row.stage] = (byStage[row.stage] || 0) + 1;
    });
    return ok(res, normalized, {
      stats: { total: normalized.length, byStage, bySection, recruitedByVacancy },
    });
  } catch (error) {
    next(error);
  }
}

export async function getHrCandidate(req, res, next) {
  try {
    const row = await HrCandidate.findById(req.params.id).lean();
    if (!row || !ownsHrRecord(req, row)) return fail(res, 404, "Candidate not found");
    const vacancy = row.vacancyId ? await HrVacancy.findById(row.vacancyId).lean() : null;
    return ok(res, {
      ...row,
      section: deriveCandidateSection(row),
      vacancy,
      hasResume: Boolean(row.resumeData || row.resumeUrl),
      resumeData: undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function createHrCandidate(req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    const roleKey = String(req.body.roleKey || "").trim();
    if (!name) return fail(res, 400, "Candidate name is required");
    if (!HR_ROLE_KEYS.includes(roleKey) || !allowedHrRole(req, roleKey)) return fail(res, 400, "Choose a role");
    const by = req.user?.email || req.user?.name || (isVendorScope(req) ? "vendor" : "admin");
    const vacancyId = String(req.body.vacancyId || "").trim();
    if (vacancyId) {
      const vacancy = await HrVacancy.findById(vacancyId).lean().catch(() => null);
      if (!vacancy || !ownsHrRecord(req, vacancy)) return fail(res, 400, "Choose one of your vacancies");
    }
    const row = await HrCandidate.create({
      name,
      email: String(req.body.email || "").trim().toLowerCase(),
      phone: String(req.body.phone || "").trim(),
      roleKey,
      vacancyId,
      vendorId: hrOwnerId(req),
      section: "applied",
      applicationStatus: "pending",
      finalizeStatus: "",
      stage: "applied",
      rating: Math.min(5, Math.max(0, Number(req.body.rating || 0))),
      notes: String(req.body.notes || "").trim(),
      adminNotes: String(req.body.adminNotes || "").trim(),
      address: String(req.body.address || "").trim(),
      city: String(req.body.city || "").trim(),
      experience: String(req.body.experience || "").trim(),
      education: String(req.body.education || "").trim(),
      currentCompany: String(req.body.currentCompany || "").trim(),
      expectedCtc: String(req.body.expectedCtc || "").trim(),
      noticePeriod: String(req.body.noticePeriod || "").trim(),
      coverLetter: String(req.body.coverLetter || "").trim(),
      linkedin: String(req.body.linkedin || "").trim(),
      resumeName: String(req.body.resumeName || "").trim(),
      resumeUrl: String(req.body.resumeUrl || "").trim(),
      resumeData: String(req.body.resumeData || "").slice(0, 2_000_000),
      stageHistory: [
        {
          section: "applied",
          status: "pending",
          label: "Application received",
          notes: "",
          by,
          at: new Date(),
        },
      ],
    });
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function updateHrCandidate(req, res, next) {
  try {
    const row = await HrCandidate.findById(req.params.id);
    if (!row || !ownsHrRecord(req, row)) return fail(res, 404, "Candidate not found");
    if (req.body.roleKey !== undefined && !allowedHrRole(req, req.body.roleKey)) {
      return fail(res, 400, "Choose a role");
    }
    const by = req.user?.email || req.user?.name || (isVendorScope(req) ? "vendor" : "admin");
    const prevSection = deriveCandidateSection(row);
    const prevApp = row.applicationStatus || "pending";
    const prevFinalize = row.finalizeStatus || "";

    [
      "name",
      "email",
      "phone",
      "roleKey",
      "vacancyId",
      "notes",
      "adminNotes",
      "address",
      "city",
      "experience",
      "education",
      "currentCompany",
      "expectedCtc",
      "noticePeriod",
      "coverLetter",
      "linkedin",
      "resumeName",
      "resumeUrl",
    ].forEach((key) => {
      if (req.body[key] !== undefined) row[key] = req.body[key];
    });
    if (req.body.rating !== undefined) row.rating = Math.min(5, Math.max(0, Number(req.body.rating) || 0));
    if (req.body.resumeData !== undefined) row.resumeData = String(req.body.resumeData || "").slice(0, 2_000_000);

    // Application decision in Applied section
    if (req.body.applicationStatus !== undefined) {
      const next = String(req.body.applicationStatus);
      if (["pending", "in_review", "accepted", "rejected"].includes(next)) {
        row.applicationStatus = next;
        if (next === "accepted") {
          row.section = "selected";
          row.stage = "selected";
        } else if (next === "rejected") {
          row.section = "applied";
          row.stage = "rejected";
        } else if (next === "in_review") {
          row.section = "applied";
          row.stage = "in_review";
        } else {
          row.section = "applied";
          row.stage = "applied";
        }
        if (next !== prevApp) {
          pushCandidateHistory(row, {
            section: row.section,
            status: next,
            label: `Application ${next.replaceAll("_", " ")}`,
            notes: String(req.body.historyNotes || req.body.adminNotes || "").trim(),
            by,
          });
        }
      }
    }

    // Move selected → finalize
    if (req.body.section === "finalize" || req.body.moveTo === "finalize") {
      row.section = "finalize";
      row.stage = "finalize";
      if (!row.finalizeStatus) row.finalizeStatus = "selected_for_interview";
      if (prevSection !== "finalize") {
        pushCandidateHistory(row, {
          section: "finalize",
          status: row.finalizeStatus || "selected_for_interview",
          label: "Moved to finalize",
          notes: String(req.body.historyNotes || "").trim(),
          by,
        });
      }
    }

    // Finalize status updates
    if (req.body.finalizeStatus !== undefined) {
      const next = String(req.body.finalizeStatus || "");
      const allowed = [
        "",
        "selected_for_interview",
        "selected_for_training",
        "selected_for_offer",
        "on_hold",
        "cleared",
      ];
      if (allowed.includes(next)) {
        row.finalizeStatus = next;
        row.section = "finalize";
        row.stage = "finalize";
        if (next !== prevFinalize) {
          pushCandidateHistory(row, {
            section: "finalize",
            status: next || "updated",
            label: next ? prettyStatus(next) : "Finalize updated",
            notes: String(req.body.historyNotes || req.body.adminNotes || "").trim(),
            by,
          });
        }
      }
    }

    // Recruit
    if (req.body.section === "recruited" || req.body.moveTo === "recruited" || req.body.stage === "recruited") {
      row.section = "recruited";
      row.stage = "recruited";
      if (prevSection !== "recruited") {
        pushCandidateHistory(row, {
          section: "recruited",
          status: "recruited",
          label: "Recruited",
          notes: String(req.body.historyNotes || req.body.adminNotes || "").trim(),
          by,
        });
      }
    }

    // Legacy stage direct set (fallback)
    if (req.body.stage !== undefined && req.body.section === undefined && req.body.applicationStatus === undefined && req.body.moveTo === undefined) {
      row.stage = req.body.stage;
      if (req.body.stage === "selected") row.section = "selected";
      if (req.body.stage === "rejected") {
        row.section = "applied";
        row.applicationStatus = "rejected";
      }
      if (req.body.stage === "recruited") row.section = "recruited";
    }

    if (req.body.adminNotes !== undefined && req.body.applicationStatus === undefined && req.body.finalizeStatus === undefined) {
      // notes-only save still records history when historyNotes provided
      if (req.body.historyNotes) {
        pushCandidateHistory(row, {
          section: deriveCandidateSection(row),
          status: "note",
          label: "Note added",
          notes: String(req.body.historyNotes || "").trim(),
          by,
        });
      }
    }

    await row.save();
    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

function prettyStatus(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function downloadHrCandidateCv(req, res, next) {
  try {
    const row = await HrCandidate.findById(req.params.id);
    if (!row || !ownsHrRecord(req, row)) return fail(res, 404, "Candidate not found");
    if (row.resumeUrl && !row.resumeData) {
      return ok(res, { url: row.resumeUrl, name: row.resumeName || "cv" });
    }
    if (!row.resumeData) return fail(res, 404, "No CV uploaded");
    return ok(res, { data: row.resumeData, name: row.resumeName || `${row.name}-cv` });
  } catch (error) {
    next(error);
  }
}

export async function createHrMeeting(req, res, next) {
  try {
    const { roles, link, meetingId, password, note } = req.body;
    if (!roles || !roles.length) {
      return fail(res, 400, "Please select at least one role");
    }
    const roleList = (Array.isArray(roles) ? roles : [roles]).map((role) => String(role || "").trim()).filter(Boolean);
    if (roleList.some((role) => !allowedHrRole(req, role, { allowAll: true }))) {
      return fail(res, 400, "Choose roles from your team");
    }
    const meeting = await HrMeeting.create({
      roles: roleList,
      link,
      meetingId,
      password,
      note,
      createdBy: req.user?._id || req.user?.id || "",
      vendorId: hrOwnerId(req),
    });
    const isAll = roleList.includes("all") || roleList.length === 0;
    StaffNotification.create({
      title: "👥 New Meeting Scheduled",
      message: meeting.note
        ? `Team meeting scheduled: ${meeting.note}`
        : "A new team meeting has been scheduled. Check meeting details in app.",
      targetType: isAll ? "all" : (roleList.length === 1 ? "role" : "all"),
      targetRole: !isAll && roleList.length === 1 ? roleList[0] : "",
      priority: "important",
      category: "meeting",
      data: {
        type: "meeting",
        meetingId: meeting._id.toString(),
        link: meeting.link || "",
      },
      sentBy: "HR Management",
    }).catch((e) => console.error("[StaffNotif] Meeting create error:", e.message));
    sendStaffPushNotification(
      isAll ? { targetType: "all" } : { targetRoles: roleList },
      {
        title: "👥 New Meeting Scheduled",
        body: meeting.note
          ? `Team meeting scheduled: ${meeting.note}`
          : "A new team meeting has been scheduled. Check meeting details in app.",
        data: {
          type: "meeting",
          meetingId: meeting._id.toString(),
          link: meeting.link || "",
        },
      }
    ).catch((e) => console.error("[StaffPush] Meeting push error:", e.message));
    return ok(res, meeting);
  } catch (error) {
    next(error);
  }
}

export async function listHrMeetings(req, res, next) {
  try {
    const meetings = await HrMeeting.find(hrOwnerFilter(req)).sort({ createdAt: -1 }).lean();
    return ok(res, meetings);
  } catch (error) {
    next(error);
  }
}

export async function listMyHrMeetings(req, res, next) {
  try {
    const roleKey = req.user?.roleKey || req.user?.role || "all";
    const mappedRole = mapJwtRoleToHrKey(roleKey);
    const meetings = await HrMeeting.find({
      $or: [{ roles: "all" }, { roles: roleKey }, ...(mappedRole ? [{ roles: mappedRole }] : [])],
      ...liveHrOwnerFilter(req.user),
    }).sort({ createdAt: -1 }).lean();
    return ok(res, meetings);
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// Promotions Management
// -------------------------------------------------------------
export async function listHrPromotions(req, res, next) {
  try {
    const query = { ...hrOwnerFilter(req) };
    if (req.query.employeeId) query.employeeId = req.query.employeeId;
    if (req.query.employeeType && req.query.employeeType !== "all") query.employeeType = req.query.employeeType;
    if (req.query.status && req.query.status !== "all") query.status = req.query.status;

    let rows = await HrPromotion.find(query).sort({ effectiveDate: -1, createdAt: -1 }).lean();
    if (req.query.search) {
      const q = String(req.query.search).toLowerCase();
      rows = rows.filter((r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.newDesignation && r.newDesignation.toLowerCase().includes(q)) ||
        (r.newDepartment && r.newDepartment.toLowerCase().includes(q)) ||
        (r.previousDesignation && r.previousDesignation.toLowerCase().includes(q))
      );
    }
    const thisYear = new Date().getFullYear().toString();
    const stats = {
      total: rows.length,
      effective: rows.filter((r) => r.status === "effective" || r.status === "approved").length,
      thisYear: rows.filter((r) => (r.effectiveDate || "").startsWith(thisYear)).length,
    };
    return ok(res, rows, { stats });
  } catch (error) {
    next(error);
  }
}

export async function createHrPromotion(req, res, next) {
  try {
    const {
      employeeId,
      employeeType = "staff",
      name,
      previousRole = "",
      newRole = "",
      previousDesignation = "",
      newDesignation,
      previousDepartment = "",
      newDepartment = "",
      effectiveDate,
      reason = "",
      approvedBy = "",
      status = "effective",
    } = req.body;

    if (!employeeId || !name) return fail(res, 400, "Employee selection is required");
    if (!newDesignation) return fail(res, 400, "New designation is required");
    if (!effectiveDate) return fail(res, 400, "Effective date is required");

    const row = await HrPromotion.create({
      employeeId,
      employeeType,
      name,
      previousRole,
      newRole,
      previousDesignation,
      newDesignation,
      previousDepartment,
      newDepartment,
      effectiveDate,
      reason,
      approvedBy: approvedBy || req.user?.name || "Admin HR",
      status,
      vendorId: hrOwnerId(req),
    });

    if (status === "effective" || status === "approved") {
      const updateData = { designation: newDesignation };
      if (newDepartment) updateData.department = newDepartment;
      await HrEmployment.collection.updateOne(
        { employeeId, employeeType },
        { $set: updateData },
        { upsert: false }
      );
    }

    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function updateHrPromotion(req, res, next) {
  try {
    const { id } = req.params;
    const row = await HrPromotion.findById(id);
    if (!row) return fail(res, 404, "Promotion record not found");

    const allowed = [
      "newDesignation",
      "newDepartment",
      "newRole",
      "effectiveDate",
      "reason",
      "approvedBy",
      "status",
    ];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) row[k] = req.body[k];
    });
    await row.save();

    if (row.status === "effective" || row.status === "approved") {
      const updateData = { designation: row.newDesignation };
      if (row.newDepartment) updateData.department = row.newDepartment;
      await HrEmployment.collection.updateOne(
        { employeeId: row.employeeId, employeeType: row.employeeType },
        { $set: updateData },
        { upsert: false }
      );
    }

    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function deleteHrPromotion(req, res, next) {
  try {
    const { id } = req.params;
    await HrPromotion.findByIdAndDelete(id);
    return ok(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// Increments Management
// -------------------------------------------------------------
export async function listHrIncrements(req, res, next) {
  try {
    const query = { ...hrOwnerFilter(req) };
    if (req.query.employeeId) query.employeeId = req.query.employeeId;
    if (req.query.employeeType && req.query.employeeType !== "all") query.employeeType = req.query.employeeType;
    if (req.query.cycle && req.query.cycle !== "all") query.cycle = req.query.cycle;
    if (req.query.status && req.query.status !== "all") query.status = req.query.status;

    let rows = await HrIncrement.find(query).sort({ effectiveDate: -1, createdAt: -1 }).lean();
    if (req.query.search) {
      const q = String(req.query.search).toLowerCase();
      rows = rows.filter((r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.cycle && r.cycle.toLowerCase().includes(q)) ||
        (r.reason && r.reason.toLowerCase().includes(q))
      );
    }
    const thisYear = new Date().getFullYear().toString();
    const thisYearRows = rows.filter((r) => (r.effectiveDate || "").startsWith(thisYear));
    const totalIncrementAmount = rows.reduce((acc, r) => acc + (Number(r.incrementAmount) || 0), 0);
    const avgPercentage = rows.length
      ? Number((rows.reduce((acc, r) => acc + (Number(r.incrementPercentage) || 0), 0) / rows.length).toFixed(1))
      : 0;

    const stats = {
      total: rows.length,
      processed: rows.filter((r) => r.status === "processed" || r.status === "approved").length,
      thisYear: thisYearRows.length,
      totalIncrementAmount,
      avgPercentage,
    };
    return ok(res, rows, { stats });
  } catch (error) {
    next(error);
  }
}

export async function createHrIncrement(req, res, next) {
  try {
    const {
      employeeId,
      employeeType = "staff",
      name,
      previousSalary = 0,
      newSalary,
      effectiveDate,
      cycle = "Annual Appraisal",
      reason = "",
      approvedBy = "",
      status = "processed",
    } = req.body;

    if (!employeeId || !name) return fail(res, 400, "Employee selection is required");
    if (newSalary === undefined || Number(newSalary) <= 0) {
      return fail(res, 400, "Valid new salary is required");
    }
    if (!effectiveDate) return fail(res, 400, "Effective date is required");

    const prevSal = Math.max(0, Number(previousSalary) || 0);
    const newSal = Math.max(0, Number(newSalary) || 0);
    const incrementAmount = Math.max(0, newSal - prevSal);
    const incrementPercentage = prevSal > 0 ? Number(((incrementAmount / prevSal) * 100).toFixed(2)) : 0;

    const row = await HrIncrement.create({
      employeeId,
      employeeType,
      name,
      previousSalary: prevSal,
      newSalary: newSal,
      incrementAmount,
      incrementPercentage,
      effectiveDate,
      cycle,
      reason,
      approvedBy: approvedBy || req.user?.name || "Admin HR",
      status,
      vendorId: hrOwnerId(req),
    });

    if (status === "processed" || status === "approved") {
      await HrEmployment.collection.updateOne(
        { employeeId, employeeType },
        { $set: { monthlySalary: newSal } },
        { upsert: false }
      );
    }

    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function updateHrIncrement(req, res, next) {
  try {
    const { id } = req.params;
    const row = await HrIncrement.findById(id);
    if (!row) return fail(res, 404, "Increment record not found");

    if (req.body.previousSalary !== undefined) row.previousSalary = Math.max(0, Number(req.body.previousSalary) || 0);
    if (req.body.newSalary !== undefined) row.newSalary = Math.max(0, Number(req.body.newSalary) || 0);
    row.incrementAmount = Math.max(0, row.newSalary - row.previousSalary);
    row.incrementPercentage = row.previousSalary > 0
      ? Number(((row.incrementAmount / row.previousSalary) * 100).toFixed(2))
      : 0;

    if (req.body.effectiveDate !== undefined) row.effectiveDate = req.body.effectiveDate;
    if (req.body.cycle !== undefined) row.cycle = req.body.cycle;
    if (req.body.reason !== undefined) row.reason = req.body.reason;
    if (req.body.approvedBy !== undefined) row.approvedBy = req.body.approvedBy;
    if (req.body.status !== undefined) row.status = req.body.status;

    await row.save();

    if (row.status === "processed" || row.status === "approved") {
      await HrEmployment.collection.updateOne(
        { employeeId: row.employeeId, employeeType: row.employeeType },
        { $set: { monthlySalary: row.newSalary } },
        { upsert: false }
      );
    }

    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function deleteHrIncrement(req, res, next) {
  try {
    const { id } = req.params;
    await HrIncrement.findByIdAndDelete(id);
    return ok(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// Performance Logs Management
// -------------------------------------------------------------
export async function listHrPerformanceLogs(req, res, next) {
  try {
    const query = { ...hrOwnerFilter(req) };
    if (req.query.employeeId) query.employeeId = req.query.employeeId;
    if (req.query.employeeType && req.query.employeeType !== "all") query.employeeType = req.query.employeeType;
    if (req.query.reviewPeriod && req.query.reviewPeriod !== "all") query.reviewPeriod = req.query.reviewPeriod;
    if (req.query.rating) query.rating = { $gte: Number(req.query.rating) };

    let rows = await HrPerformanceLog.find(query).sort({ reviewDate: -1, createdAt: -1 }).lean();
    if (req.query.search) {
      const q = String(req.query.search).toLowerCase();
      rows = rows.filter((r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.reviewPeriod && r.reviewPeriod.toLowerCase().includes(q)) ||
        (r.achievements && r.achievements.toLowerCase().includes(q)) ||
        (r.feedback && r.feedback.toLowerCase().includes(q))
      );
    }

    const total = rows.length;
    const avgRating = total
      ? Number((rows.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / total).toFixed(1))
      : 0;
    const highPerformers = rows.filter((r) => Number(r.rating) >= 4).length;
    const needsImprovement = rows.filter((r) => Number(r.rating) <= 2.5).length;

    const stats = {
      total,
      avgRating,
      highPerformers,
      needsImprovement,
    };
    return ok(res, rows, { stats });
  } catch (error) {
    next(error);
  }
}

export async function createHrPerformanceLog(req, res, next) {
  try {
    const {
      employeeId,
      employeeType = "staff",
      name,
      reviewPeriod,
      rating,
      kpis = [],
      achievements = "",
      improvementAreas = "",
      feedback = "",
      goals = "",
      reviewedBy = "",
      reviewDate,
      status = "finalized",
    } = req.body;

    if (!employeeId || !name) return fail(res, 400, "Employee selection is required");
    if (!reviewPeriod) return fail(res, 400, "Review period is required");
    if (rating === undefined || Number(rating) < 1 || Number(rating) > 5) {
      return fail(res, 400, "Rating must be between 1 and 5");
    }
    if (!reviewDate) return fail(res, 400, "Review date is required");

    const row = await HrPerformanceLog.create({
      employeeId,
      employeeType,
      name,
      reviewPeriod,
      rating: Number(rating),
      kpis: Array.isArray(kpis) ? kpis : [],
      achievements,
      improvementAreas,
      feedback,
      goals,
      reviewedBy: reviewedBy || req.user?.name || "HR Appraiser",
      reviewDate,
      status,
      vendorId: hrOwnerId(req),
    });

    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function updateHrPerformanceLog(req, res, next) {
  try {
    const { id } = req.params;
    const row = await HrPerformanceLog.findById(id);
    if (!row) return fail(res, 404, "Performance log not found");

    const allowed = [
      "reviewPeriod",
      "rating",
      "kpis",
      "achievements",
      "improvementAreas",
      "feedback",
      "goals",
      "reviewedBy",
      "reviewDate",
      "status",
    ];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) {
        if (k === "rating") row[k] = Number(req.body[k]);
        else row[k] = req.body[k];
      }
    });
    await row.save();
    return ok(res, row);
  } catch (error) {
    next(error);
  }
}

export async function deleteHrPerformanceLog(req, res, next) {
  try {
    const { id } = req.params;
    await HrPerformanceLog.findByIdAndDelete(id);
    return ok(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

