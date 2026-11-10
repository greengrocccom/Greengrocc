import mongoose from "mongoose";
import Staff from "../models/Staff.js";
import StaffNotification from "../models/StaffNotification.js";
import PasswordChangeRequest from "../models/PasswordChangeRequest.js";
import { sendStaffPushNotification } from "./staffAppControllers.js";

const fail = (res, status, message) => res.status(status).json({ success: false, message });

function toStaffView(row) {
  return {
    _id: row._id.toString(),
    message: row.message || "",
    status: row.status,
    adminReply: row.adminReply || "",
    newPassword: row.status === "completed" ? row.newPassword || "" : "",
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt || null,
  };
}

export async function listMyPasswordRequests(req, res, next) {
  try {
    const rows = await PasswordChangeRequest.find({ staffId: req.user.id })
      .select("+newPassword")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    return res.json({ success: true, data: rows.map(toStaffView) });
  } catch (error) { next(error); }
}

export async function createMyPasswordRequest(req, res, next) {
  try {
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (message.length > 500) return fail(res, 400, "Message must be 500 characters or fewer");
    const staff = await Staff.findById(req.user.id).select("_id isActive").lean();
    if (!staff || staff.isActive === false) return fail(res, 403, "An active staff account is required");
    const pending = await PasswordChangeRequest.exists({ staffId: req.user.id, status: "pending" });
    if (pending) return fail(res, 409, "You already have a pending password request. Please wait for the admin to reply.");
    const row = await PasswordChangeRequest.create({ staffId: req.user.id, message });
    return res.status(201).json({ success: true, data: toStaffView(row), message: "Password change request sent to admin" });
  } catch (error) { next(error); }
}

export async function listPasswordRequestsForAdmin(req, res, next) {
  try {
    const status = String(req.query.status || "").trim();
    if (status && !["pending", "completed", "rejected"].includes(status)) {
      return fail(res, 400, "Invalid status");
    }
    const rows = await PasswordChangeRequest.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("staffId", "name phone email role")
      .lean();
    const data = rows.map((row) => {
      const staff = row.staffId && typeof row.staffId === "object" ? row.staffId : null;
      return {
        id: row._id.toString(),
        message: row.message || "",
        status: row.status,
        adminReply: row.adminReply || "",
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt || null,
        resolvedBy: row.resolvedBy || "",
        staff: {
          id: staff?._id?.toString() || String(row.staffId || ""),
          name: staff?.name || "Unknown",
          phone: staff?.phone || "",
          email: staff?.email || "",
          role: staff?.role || "",
        },
      };
    });
    return res.json({ success: true, data });
  } catch (error) { next(error); }
}

async function loadPending(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    fail(res, 404, "Request not found");
    return null;
  }
  const request = await PasswordChangeRequest.findById(req.params.id);
  if (!request) {
    fail(res, 404, "Request not found");
    return null;
  }
  if (request.status !== "pending") {
    fail(res, 409, "This request has already been answered");
    return null;
  }
  return request;
}

async function notifyStaff(staffId, title, message, requestId) {
  const targetStaffId = staffId.toString();
  await StaffNotification.create({
    title,
    message,
    targetType: "staff",
    targetStaffId,
    priority: "important",
    category: "general",
    data: { type: "password_request", requestId },
  });
  sendStaffPushNotification(
    { targetType: "staff", targetStaffId },
    { title, body: message, data: { type: "password_request", requestId } }
  ).catch((err) => console.error("[StaffPush] Password request notification failed:", err.message));
}

export async function resolvePasswordRequest(req, res, next) {
  try {
    const newPassword = String(req.body.newPassword || "").trim();
    const reply = String(req.body.reply || "").trim();
    if (newPassword.length < 6) return fail(res, 400, "Password must be at least 6 characters");
    if (reply.length > 1000) return fail(res, 400, "Reply must be 1000 characters or fewer");

    const request = await loadPending(req, res);
    if (!request) return;
    const staff = await Staff.findById(request.staffId);
    if (!staff) return fail(res, 404, "Staff not found");

    staff.password = newPassword;
    await staff.save();

    request.status = "completed";
    request.newPassword = newPassword;
    request.adminReply = reply;
    request.resolvedAt = new Date();
    request.resolvedBy = req.user?.name || req.user?.email || "Admin";
    await request.save();

    await notifyStaff(
      request.staffId,
      "Your password has been changed",
      "Admin has set a new password for your account. Open Profile > Change Password to see it.",
      request.id
    );
    return res.json({ success: true, data: { id: request.id, status: request.status }, message: `Password updated for ${staff.name || "staff member"}` });
  } catch (error) { next(error); }
}

export async function rejectPasswordRequest(req, res, next) {
  try {
    const reply = String(req.body.reply || "").trim();
    if (!reply) return fail(res, 400, "Please write a reply explaining why");
    if (reply.length > 1000) return fail(res, 400, "Reply must be 1000 characters or fewer");

    const request = await loadPending(req, res);
    if (!request) return;
    request.status = "rejected";
    request.adminReply = reply;
    request.resolvedAt = new Date();
    request.resolvedBy = req.user?.name || req.user?.email || "Admin";
    await request.save();

    await notifyStaff(
      request.staffId,
      "Password request answered",
      "Admin replied to your password change request. Open Profile > Change Password to read it.",
      request.id
    );
    return res.json({ success: true, data: { id: request.id, status: request.status }, message: "Reply sent" });
  } catch (error) { next(error); }
}
