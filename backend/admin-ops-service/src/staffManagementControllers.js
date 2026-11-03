import mongoose from "mongoose";
import bcrypt from "bcrypt";
import CustomRole from "../../staff-service/src/models/CustomRole.js";
import StaffNotification from "../../staff-service/src/models/StaffNotification.js";
import Staff from "../../staff-service/src/models/Staff.js";
import { HrEmployment } from "./models.js";
import { ROLE_LABELS, STAFF_ROLES } from "../../staff-service/src/constants/roles.js";
import { sendStaffPushNotification } from "../../staff-service/src/controllers/staffAppControllers.js";

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

/** List all available roles (standard + custom) with employee counts */
export async function listStaffRoles(req, res, next) {
  try {
    const customRoles = await CustomRole.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    
    // Count staff per role
    const staffCounts = await Staff.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);
    const countsMap = {};
    staffCounts.forEach((sc) => {
      if (sc._id) countsMap[sc._id] = sc.count;
    });

    const standard = STAFF_ROLES.map((roleKey) => ({
      value: roleKey,
      label: ROLE_LABELS[roleKey] || roleKey.replace(/_/g, " "),
      department: "Operations",
      isCustom: false,
      count: countsMap[roleKey] || 0,
    }));

    const custom = customRoles.map((cr) => ({
      id: cr._id.toString(),
      value: cr.roleKey,
      label: cr.displayName,
      department: cr.department || "Operations",
      description: cr.description || "",
      isCustom: true,
      count: countsMap[cr.roleKey] || 0,
      createdAt: cr.createdAt,
    }));

    return ok(res, {
      all: [...standard, ...custom],
      standard,
      custom,
    });
  } catch (error) {
    next(error);
  }
}

/** Create a new custom role */
export async function createCustomRole(req, res, next) {
  try {
    const displayName = String(req.body.displayName || "").trim();
    let roleKey = String(req.body.roleKey || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_");

    if (!displayName) {
      return fail(res, 400, "Role display name is required");
    }

    if (!roleKey) {
      roleKey = displayName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    }

    if (STAFF_ROLES.includes(roleKey)) {
      return fail(res, 400, "A standard role with this key already exists");
    }

    const existing = await CustomRole.findOne({ roleKey });
    if (existing) {
      return fail(res, 409, "A custom role with this key already exists");
    }

    const created = await CustomRole.create({
      roleKey,
      displayName,
      department: String(req.body.department || "Operations").trim(),
      description: String(req.body.description || "").trim(),
      createdBy: req.user?.email || "admin",
    });

    return ok(res, created, { message: `Custom role '${displayName}' created successfully` });
  } catch (error) {
    next(error);
  }
}

/** Delete a custom role */
export async function deleteCustomRole(req, res, next) {
  try {
    const { id } = req.params;
    const role = await CustomRole.findById(id);
    if (!role) {
      return fail(res, 404, "Custom role not found");
    }

    // Check if staff are currently assigned to this role
    const assignedCount = await Staff.countDocuments({ role: role.roleKey });
    if (assignedCount > 0) {
      return fail(
        res,
        400,
        `Cannot delete role because ${assignedCount} staff member(s) are currently assigned to it`
      );
    }

    await CustomRole.findByIdAndDelete(id);
    return ok(res, { id }, { message: `Role '${role.displayName}' deleted` });
  } catch (error) {
    next(error);
  }
}

/** List all staff accounts */
export async function listStaffUsers(req, res, next) {
  try {
    const roleFilter = String(req.query.role || "").trim();
    const query = String(req.query.query || "").trim().toLowerCase();

    const mongoFilter = {};
    if (roleFilter && roleFilter !== "all") {
      mongoFilter.role = roleFilter;
    }

    const staffList = await Staff.find(mongoFilter).sort({ createdAt: -1 }).lean();
    const customRoles = await CustomRole.find().lean();
    const customRoleMap = {};
    customRoles.forEach((cr) => {
      customRoleMap[cr.roleKey] = cr;
    });

    // Fetch employment records for salary / department details
    const staffIds = staffList.map((s) => s._id.toString());
    const employments = await HrEmployment.find({
      employeeType: "staff",
      employeeId: { $in: staffIds },
    }).lean();
    const empMap = {};
    employments.forEach((emp) => {
      empMap[emp.employeeId] = emp;
    });

    let results = staffList.map((s) => {
      const cr = customRoleMap[s.role];
      const emp = empMap[s._id.toString()] || {};
      return {
        id: s._id.toString(),
        name: s.name,
        email: s.email,
        phone: s.phone,
        role: s.role,
        roleLabel: cr ? cr.displayName : (ROLE_LABELS[s.role] || s.role.replace(/_/g, " ")),
        department: emp.department || (cr ? cr.department : "Operations"),
        monthlySalary: emp.monthlySalary || 0,
        joiningDate: emp.joiningDate || "",
        isActive: s.isActive !== false,
        isCustomRole: Boolean(cr),
        createdAt: s.createdAt,
      };
    });

    if (query) {
      results = results.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.email.toLowerCase().includes(query) ||
          r.phone.includes(query) ||
          r.roleLabel.toLowerCase().includes(query) ||
          r.department.toLowerCase().includes(query)
      );
    }

    return ok(res, results, { total: results.length });
  } catch (error) {
    next(error);
  }
}

/** Create a staff login (supports standard + custom roles) */
export async function createStaffUser(req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").replace(/\D/g, "").slice(-10);
    const role = String(req.body.role || "").trim();
    const password = String(req.body.password || "Staff@123").trim();

    if (!name) return fail(res, 400, "Name is required");
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "Valid email is required");
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) return fail(res, 400, "Valid 10-digit Indian phone is required");
    if (!role) return fail(res, 400, "Role is required");
    if (password.length < 6) return fail(res, 400, "Password must be at least 6 characters");

    // Check duplicate email or phone
    const existing = await Staff.findOne({
      $or: [{ email }, { phone }],
    });
    if (existing) {
      return fail(res, 409, "A staff account with this email or phone already exists");
    }

    const staff = await Staff.create({
      name,
      email,
      phone,
      role,
      password,
      createdBy: req.user?.id || null,
      createdByRole: "admin",
      isActive: true,
      meta: req.body.meta || {},
    });

    // Attach employment record if provided
    const customRoleDoc = await CustomRole.findOne({ roleKey: role }).lean();
    const roleLabel = customRoleDoc ? customRoleDoc.displayName : (ROLE_LABELS[role] || role);

    await HrEmployment.findOneAndUpdate(
      { employeeType: "staff", employeeId: staff._id.toString() },
      {
        $set: {
          name,
          role: roleLabel,
          department: String(req.body.department || (customRoleDoc ? customRoleDoc.department : "Operations")).trim(),
          joiningDate: String(req.body.joiningDate || new Date().toISOString().slice(0, 10)).trim(),
          monthlySalary: Number(req.body.monthlySalary || 0),
          workNotes: String(req.body.notes || "").trim(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return ok(res, staff.toSafeJSON(), { message: "Staff account created successfully" });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, "Email or phone already registered");
    next(error);
  }
}

/** Toggle staff active status */
export async function toggleStaffStatus(req, res, next) {
  try {
    const { id } = req.params;
    const staff = await Staff.findById(id);
    if (!staff) return fail(res, 404, "Staff not found");

    staff.isActive = !staff.isActive;
    await staff.save();

    return ok(res, { id: staff._id.toString(), isActive: staff.isActive }, {
      message: `Staff account is now ${staff.isActive ? "Active" : "Inactive"}`,
    });
  } catch (error) {
    next(error);
  }
}

/** Reset staff password */
export async function resetStaffPassword(req, res, next) {
  try {
    const { id } = req.params;
    const password = String(req.body.password || "").trim();
    if (!password || password.length < 6) {
      return fail(res, 400, "Password must be at least 6 characters");
    }

    const staff = await Staff.findById(id);
    if (!staff) return fail(res, 404, "Staff not found");

    staff.password = password;
    await staff.save();

    return ok(res, { id }, { message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
}

/** Send custom notification to staff */
export async function sendCustomStaffNotification(req, res, next) {
  try {
    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();
    const targetType = ["all", "role", "staff"].includes(req.body.targetType)
      ? req.body.targetType
      : "all";
    const targetRole = String(req.body.targetRole || "").trim();
    const targetStaffId = String(req.body.targetStaffId || "").trim();
    const priority = ["normal", "important", "urgent"].includes(req.body.priority)
      ? req.body.priority
      : "normal";
    const category = ["general", "salary", "meeting", "policy", "shift", "holiday"].includes(req.body.category)
      ? req.body.category
      : "general";

    if (!title) return fail(res, 400, "Notification title is required");
    if (!message) return fail(res, 400, "Notification message is required");
    if (targetType === "role" && !targetRole) {
      return fail(res, 400, "Please select a target role");
    }
    if (targetType === "staff" && !targetStaffId) {
      return fail(res, 400, "Please select a target staff member");
    }

    const notif = await StaffNotification.create({
      title,
      message,
      targetType,
      targetRole,
      targetStaffId,
      priority,
      category,
      sentBy: req.user?.name || req.user?.email || "Admin Operations",
    });

    // Dispatch live push notification to matching staff devices
    sendStaffPushNotification(
      { targetType, targetRole, targetStaffId },
      {
        title,
        body: message,
        data: {
          category,
          priority,
          notificationId: notif._id.toString(),
        },
      }
    ).catch((err) => console.error("[StaffPush] Custom notification failed:", err.message));

    return ok(res, notif, { message: "Custom notification sent successfully" });
  } catch (error) {
    next(error);
  }
}

/** List sent custom notifications */
export async function listStaffNotifications(req, res, next) {
  try {
    const list = await StaffNotification.find().sort({ createdAt: -1 }).limit(100).lean();
    return ok(res, list);
  } catch (error) {
    next(error);
  }
}

/** Delete a sent notification */
export async function deleteStaffNotification(req, res, next) {
  try {
    const { id } = req.params;
    await StaffNotification.findByIdAndDelete(id);
    return ok(res, { id }, { message: "Notification deleted" });
  } catch (error) {
    next(error);
  }
}
