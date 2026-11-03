import { parseSegment, resolveNotificationAudience } from "../services/notificationAudience.js";
import User from "../models/user.js";
import Order from "../models/order/Order.js";
import Payment from "../models/payment/Payment.js";
import SupportMessage from "../models/support/SupportMessage.js";
import Notification from "../models/Notification.js";
import ScheduledNotification from "../models/ScheduledNotification.js";
import AdminAlertState from "../models/AdminAlertState.js";
import {
  HrPayroll,
  HrMeeting,
  HrCandidate,
  HrLeaveRequest,
  B2bClient,
} from "../../admin-ops-service/src/models.js";
import {
  sendCustomNotification,
  sendOffer,
  sendToMultipleTokens,
} from "../services/notificationService.js";
import {
  AUDIENCE_LABELS,
  armScheduler,
  audienceFilter,
  broadcastPromotionalNotification,
  normalizeAudience,
} from "../services/promotionalBroadcast.js";

const MIN_SCHEDULE_LEAD_MS = 60 * 1000;
const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

const PROMOTIONAL_TYPES = new Set(["offer", "promotional"]);

function parseSinceDate(value) {
  if (!value) return null;
  const sinceDate = new Date(value);
  if (Number.isNaN(sinceDate.getTime())) {
    return null;
  }
  return sinceDate;
}

function buildSinceFilter(sinceDate) {
  return sinceDate ? { createdAt: { $gt: sinceDate } } : {};
}

export const getAdminInboxSummary = async (req, res) => {
  try {
    const {
      supportSince,
      placedSince,
      attemptedSince,
      paymentSince,
    } = req.query;

    const supportDate = parseSinceDate(supportSince);
    const placedDate = parseSinceDate(placedSince);
    const attemptedDate = parseSinceDate(attemptedSince);
    const paymentDate = parseSinceDate(paymentSince);

    const mapRecentOrder = (order) => ({
      id: order._id,
      orderNumber: order.orderNumber || "",
      customerName:
        order.user?.name || order.deliveryAddress?.fullName || "A customer",
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });

    const attemptedSinceFilter = attemptedDate
      ? { updatedAt: { $gt: attemptedDate } }
      : {};

    const [supportCount, placedCount, attemptedCount, paymentCount, recentPlaced, recentAttempted] =
      await Promise.all([
        SupportMessage.countDocuments(buildSinceFilter(supportDate)),
        Order.countDocuments({
          status: { $ne: "attempted" },
          ...buildSinceFilter(placedDate),
        }),
        Order.countDocuments({
          status: "attempted",
          ...attemptedSinceFilter,
        }),
        Payment.countDocuments({ status: "pending", ...buildSinceFilter(paymentDate) }),
        Order.find({
          status: { $ne: "attempted" },
          ...buildSinceFilter(placedDate),
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("user", "name")
          .select("orderNumber status createdAt updatedAt deliveryAddress.fullName user"),
        Order.find({
          status: "attempted",
          ...attemptedSinceFilter,
        })
          .sort({ updatedAt: -1 })
          .limit(10)
          .populate("user", "name")
          .select("orderNumber status createdAt updatedAt deliveryAddress.fullName user"),
      ]);

    return res.json({
      success: true,
      data: {
        support: { count: supportCount },
        orders: {
          placedCount,
          attemptedCount,
          count: placedCount + attemptedCount,
          recentPlaced: recentPlaced.map(mapRecentOrder),
          recentAttempted: recentAttempted.map(mapRecentOrder),
        },
        payments: { count: paymentCount },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load admin inbox summary",
    });
  }
};

function mapAdminInboxAlert(notification) {
  return {
    id: notification._id,
    type: notification.type,
    title: notification.data?.showTitle === false ? "" : notification.title,
    message: notification.body,
    link: notification.data?.link || "",
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

export const getAdminInboxAlerts = async (req, res) => {
  try {
    const alerts = await Notification.find({
      user: req.user._id,
      isRead: false,
      "data.channel": "admin_inbox",
    })
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json({
      success: true,
      data: alerts.map(mapAdminInboxAlert),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load admin notifications",
    });
  }
};

export const createAdminInboxAlert = async (req, res) => {
  try {
    const { type, title, message, link = "", order = null, eventKey = "" } = req.body;

    if (!type || !message) {
      return res.status(400).json({
        success: false,
        message: "Notification type and message are required",
      });
    }

    const notificationData = {
      user: req.user._id,
      title: title || message,
      body: message,
      type,
      order: order || null,
      isRead: false,
      data: {
        channel: "admin_inbox",
        eventKey: eventKey || undefined,
        link,
        showTitle: Boolean(title),
      },
    };

    const notification = eventKey
      ? await Notification.findOneAndUpdate(
          {
            user: req.user._id,
            "data.channel": "admin_inbox",
            "data.eventKey": String(eventKey),
          },
          { $setOnInsert: notificationData },
          { new: true, upsert: true, runValidators: true }
        )
      : await Notification.create(notificationData);

    return res.status(201).json({
      success: true,
      data: mapAdminInboxAlert(notification),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save admin notification",
    });
  }
};

export const markAdminInboxAlertRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
        "data.channel": "admin_inbox",
      },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update admin notification",
    });
  }
};

export const markAllAdminInboxAlertsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        user: req.user._id,
        isRead: false,
        "data.channel": "admin_inbox",
      },
      { $set: { isRead: true } }
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to clear admin notifications",
    });
  }
};

function normalizeUserIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((id) => String(id).trim()).filter(Boolean))];
}

function buildPromotionalPayload({ linkTarget = "none", productId = "" } = {}) {
  const normalizedTarget = String(linkTarget || "none").trim().toLowerCase();
  const data = {
    linkTarget: normalizedTarget,
    type: "offer",
  };

  if (normalizedTarget === "product" && productId) {
    data.offerId = String(productId).trim();
  }

  return data;
}

function normalizeImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const getPromotionalAudienceStats = async (req, res) => {
  try {
    const audience = normalizeAudience(req.query.accountType);
    const filter = await resolveNotificationAudience(audienceFilter(audience), req.query);
    const [totalUsers, pushEnabledUsers] = await Promise.all([
      User.countDocuments(filter),
      User.countDocuments({
        ...filter,
        $or: [{ fcmToken: { $type: "string", $ne: "" } }, { "fcmTokens.0": { $exists: true } }],
      }),
    ]);

    return res.json({
      success: true,
      data: {
        audience,
        audienceLabel: AUDIENCE_LABELS[audience],
        totalUsers,
        pushEnabledUsers,
        inAppOnlyUsers: Math.max(totalUsers - pushEnabledUsers, 0),
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load promotional audience stats",
    });
  }
};

export const getPromotionalNotificationHistory = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const audience = req.query.accountType ? normalizeAudience(req.query.accountType) : null;
    const history = await Notification.aggregate([
      {
        $match: {
          type: { $in: [...PROMOTIONAL_TYPES] },
          ...(audience ? { "data.audience": audience } : {}),
        },
      },
      {
        $group: {
          _id: {
            title: "$title",
            body: "$body",
            linkTarget: "$data.linkTarget",
            offerId: "$data.offerId",
            audience: "$data.audience",
            segment: "$data.segment",
            days: "$data.days",
            imageUrl: "$data.imageUrl",
            minuteBucket: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M",
                date: "$createdAt",
                timezone: "Asia/Kolkata",
              },
            },
          },
          recipients: { $sum: 1 },
          pushDelivered: {
            $sum: {
              $cond: [{ $eq: ["$fcmSent", true] }, 1, 0],
            },
          },
          createdAt: { $max: "$createdAt" },
          type: { $first: "$type" },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
    ]);

    return res.json({
      success: true,
      data: history.map((item) => ({
        title: item._id.title,
        body: item._id.body,
        type: item.type,
        linkTarget: item._id.linkTarget || "none",
        productId: item._id.offerId || "",
        audience: item._id.audience || "all",
        segment: item._id.segment || "all",
        days: item._id.days ?? 30,
        imageUrl: item._id.imageUrl || "",
        recipients: item.recipients,
        pushDelivered: item.pushDelivered,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load promotional notification history",
    });
  }
};

function mapScheduled(job) {
  return {
    id: job._id,
    audience: job.audience,
    segment: job.data?.segment || "all",
    days: job.data?.days ?? 30,
    title: job.title,
    body: job.body,
    imageUrl: job.imageUrl,
    linkTarget: job.data?.linkTarget || "none",
    productId: job.data?.offerId || "",
    sendAt: job.sendAt,
    status: job.status,
    summary: job.summary,
    error: job.error,
    sentAt: job.sentAt,
    createdAt: job.createdAt,
  };
}

export const getScheduledNotifications = async (req, res) => {
  try {
    const audience = normalizeAudience(req.query.accountType);
    const jobs = await ScheduledNotification.find({
      audience,
      status: { $in: ["scheduled", "sending", "failed"] },
    })
      .sort({ sendAt: 1 })
      .limit(50);
    return res.json({ success: true, data: jobs.map(mapScheduled) });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load scheduled notifications",
    });
  }
};

export const cancelScheduledNotification = async (req, res) => {
  try {
    const job = await ScheduledNotification.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ["scheduled", "failed"] } },
      { $set: { status: "cancelled" } },
      { new: true }
    );
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Scheduled notification not found or already sent",
      });
    }
    void armScheduler();
    return res.json({ success: true, data: mapScheduled(job) });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel scheduled notification",
    });
  }
};

export const sendPromotionalNotification = async (req, res) => {
  try {
    const {
      title,
      body = "",
      linkTarget = "none",
      productId = "",
      accountType,
      imageUrl,
      scheduleAt,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    let sendAt = null;
    if (scheduleAt) {
      sendAt = new Date(scheduleAt);
      const lead = sendAt.getTime() - Date.now();
      if (Number.isNaN(sendAt.getTime()) || lead < MIN_SCHEDULE_LEAD_MS) {
        return res.status(400).json({
          success: false,
          message: "Scheduled time must be at least 1 minute in the future",
        });
      }
      if (lead > MAX_SCHEDULE_AHEAD_MS) {
        return res.status(400).json({
          success: false,
          message: "Notifications can be scheduled up to 90 days ahead",
        });
      }
    }

    const normalizedImageUrl = normalizeImageUrl(imageUrl);
    if (normalizedImageUrl === null) {
      return res.status(400).json({
        success: false,
        message: "Image URL must be a valid https:// link",
      });
    }
    const audience = normalizeAudience(accountType);
    const selection = parseSegment(req.body);

    const trimmedTitle = title.trim().slice(0, 200);
    const trimmedBody = String(body || "").trim().slice(0, 1000);
    const normalizedTarget = String(linkTarget || "none").trim().toLowerCase();

    if (normalizedTarget === "product" && !String(productId || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required when link target is Product",
      });
    }

    const data = { ...buildPromotionalPayload({
      linkTarget: normalizedTarget,
      productId,
    }), ...selection };

    if (sendAt) {
      const job = await ScheduledNotification.create({
        audience,
        title: trimmedTitle,
        body: trimmedBody,
        imageUrl: normalizedImageUrl,
        data,
        sendAt,
        createdBy: req.user?._id || null,
      });
      void armScheduler();
      return res.status(201).json({
        success: true,
        message: `Notification scheduled for ${AUDIENCE_LABELS[audience].toLowerCase()}`,
        data: { scheduled: true, item: mapScheduled(job) },
      });
    }

    const summary = await broadcastPromotionalNotification({
      title: trimmedTitle,
      body: trimmedBody,
      data,
      audience,
      imageUrl: normalizedImageUrl,
      ...selection,
    });

    return res.status(200).json({
      success: true,
      message: `Notification sent to ${AUDIENCE_LABELS[audience].toLowerCase()}`,
      data: summary,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to send promotional notification",
    });
  }
};

export const sendAdminNotification = async (req, res) => {
  try {
    const {
      mode = "single",
      userId,
      userIds = [],
      title,
      body,
      type = "custom",
      data = {},
      broadcast = false,
    } = req.body;

    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({
        success: false,
        message: "title and body are required",
      });
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const notificationType = type.trim() || "custom";

    if (broadcast === true || mode === "broadcast") {
      const payloadData =
        notificationType === "offer"
          ? buildPromotionalPayload({
              linkTarget: data?.linkTarget || "none",
              productId: data?.offerId || data?.productId || "",
            })
          : { ...data, type: notificationType };

      const summary = await broadcastPromotionalNotification({
        title: trimmedTitle,
        body: trimmedBody,
        data: payloadData,
        audience: normalizeAudience(req.body.accountType),
      });

      return res.status(200).json({
        success: true,
        message: "Broadcast notification processed",
        data: summary,
      });
    }

    if (mode === "multiple") {
      const ids = normalizeUserIds(userIds);
      if (!ids.length) {
        return res.status(400).json({
          success: false,
          message: "userIds are required for multiple mode",
        });
      }

      const results = await Promise.all(
        ids.map((id) =>
          notificationType === "offer"
            ? sendOffer(id, { title: trimmedTitle, body: trimmedBody, data })
            : sendCustomNotification(id, {
                title: trimmedTitle,
                body: trimmedBody,
                type: notificationType,
                data,
              })
        )
      );

      return res.status(200).json({
        success: true,
        message: "Notifications sent to selected users",
        data: { results },
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required for single mode",
      });
    }

    const result =
      notificationType === "offer"
        ? await sendOffer(userId, { title: trimmedTitle, body: trimmedBody, data })
        : await sendCustomNotification(userId, {
            title: trimmedTitle,
            body: trimmedBody,
            type: notificationType,
            data,
          });

    res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send notification",
    });
  }
};

export const sendAdminMulticast = async (req, res) => {
  try {
    const { tokens = [], title, body, data = {} } = req.body;

    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({
        success: false,
        message: "title and body are required",
      });
    }

    const result = await sendToMultipleTokens(tokens, {
      title: title.trim(),
      body: body.trim(),
      data,
    });

    res.status(200).json({
      success: true,
      message: "Multicast notification processed",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send multicast notification",
    });
  }
};

/**
 * Aggregates live system alerts across ERP, HR (employee due salaries, meetings, interviews, leave),
 * compliance (B2B KYC), and operations.
 */
export const getAdminSystemAlerts = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const userId = String(req.user?._id || "admin");

    const [
      payrollRows,
      meetings,
      candidates,
      leaveRequests,
      b2bClients,
      pendingPayments,
      customNotifs,
      alertStates,
    ] = await Promise.all([
      HrPayroll.find({ status: "pending" }).sort({ createdAt: -1 }).limit(100).lean().catch(() => []),
      HrMeeting.find({}).sort({ createdAt: -1 }).limit(50).lean().catch(() => []),
      HrCandidate.find({ $or: [{ section: "finalize" }, { stage: "interview" }] }).sort({ updatedAt: -1 }).limit(50).lean().catch(() => []),
      HrLeaveRequest.find({ status: "pending" }).sort({ createdAt: -1 }).limit(50).lean().catch(() => []),
      B2bClient.find({ status: "pending_verification" }).sort({ createdAt: -1 }).limit(50).lean().catch(() => []),
      Payment.find({ status: "pending" }).sort({ createdAt: -1 }).limit(30).lean().catch(() => []),
      Notification.find({ "data.channel": "admin_inbox" }).sort({ createdAt: -1 }).limit(50).lean().catch(() => []),
      AdminAlertState.find({ userId }).lean().catch(() => []),
    ]);

    const stateMap = new Map();
    alertStates.forEach((s) => stateMap.set(s.alertKey, s));

    const rawAlerts = [];

    // 1. Employee Due Payments (HrPayroll status: "pending")
    payrollRows.forEach((row) => {
      const alertKey = `payroll:${row._id}`;
      const state = stateMap.get(alertKey);
      if (state?.isDismissed) return;

      const isOverdue = Boolean(row.month && row.month < currentMonth);
      rawAlerts.push({
        id: alertKey,
        alertKey,
        category: "payroll",
        priority: isOverdue ? "critical" : "high",
        title: `Salary Payment Due: ${row.name || "Employee"}`,
        message: `Net salary of ₹${(row.net || 0).toLocaleString("en-IN")} pending disbursement for ${row.month || "current month"} (${row.role || row.employeeType || "Staff"}).`,
        timestamp: row.createdAt || new Date(),
        dueDate: row.month ? `${row.month}-28` : null,
        isRead: Boolean(state?.isRead),
        actionLabel: "Disburse Salary",
        actionLink: `/hr-management/payroll?role=${row.roleKey || ""}&employee=${row.employeeId || ""}`,
        badge: {
          label: isOverdue ? "OVERDUE PAYMENT" : "SALARY DUE",
          color: isOverdue ? "rose" : "amber",
        },
        metadata: {
          employeeId: row.employeeId,
          employeeType: row.employeeType,
          name: row.name,
          month: row.month,
          gross: row.gross,
          deductions: row.deductions,
          net: row.net,
        },
      });
    });

    // 2. Scheduled Meetings (HrMeeting)
    meetings.forEach((m) => {
      const alertKey = `meeting:${m._id}`;
      const state = stateMap.get(alertKey);
      if (state?.isDismissed) return;

      const roleLabels = Array.isArray(m.roles) && m.roles.length > 0 ? m.roles.join(", ") : "All Roles";
      rawAlerts.push({
        id: alertKey,
        alertKey,
        category: "meeting",
        priority: "normal",
        title: `Scheduled Meeting: ${m.note || roleLabels}`,
        message: `Online meeting scheduled for ${roleLabels}. Meeting ID: ${m.meetingId || "Direct URL"}.`,
        timestamp: m.createdAt || new Date(),
        isRead: Boolean(state?.isRead),
        actionLabel: m.link ? "Join Meeting" : "View Meetings",
        actionLink: m.link || "/hr-management/meetings",
        badge: {
          label: "MEETING",
          color: "blue",
        },
        metadata: {
          meetingId: m.meetingId,
          roles: m.roles,
          link: m.link,
          password: m.password,
          note: m.note,
        },
      });
    });

    // 3. Candidate Interviews / Finalize (HrCandidate)
    candidates.forEach((c) => {
      const alertKey = `candidate:${c._id}`;
      const state = stateMap.get(alertKey);
      if (state?.isDismissed) return;

      rawAlerts.push({
        id: alertKey,
        alertKey,
        category: "meeting",
        priority: "high",
        title: `Candidate Interview: ${c.name || "Candidate"}`,
        message: `Candidate shortlisted for ${c.roleKey || "open vacancy"}. Stage: ${c.finalizeStatus || c.stage || "Interview"}.`,
        timestamp: c.updatedAt || c.createdAt || new Date(),
        isRead: Boolean(state?.isRead),
        actionLabel: "Review Candidate",
        actionLink: "/hr-management/recruitment",
        badge: {
          label: "INTERVIEW",
          color: "purple",
        },
        metadata: {
          candidateId: c._id,
          name: c.name,
          roleKey: c.roleKey,
          rating: c.rating,
        },
      });
    });

    // 4. Employee Leave Requests Pending (HrLeaveRequest)
    leaveRequests.forEach((lv) => {
      const alertKey = `leave:${lv._id}`;
      const state = stateMap.get(alertKey);
      if (state?.isDismissed) return;

      rawAlerts.push({
        id: alertKey,
        alertKey,
        category: "hr",
        priority: "high",
        title: `Leave Approval Pending: ${lv.name}`,
        message: `${lv.days || 1} day(s) ${lv.leaveType || "casual"} leave from ${lv.fromDate} to ${lv.toDate}. Reason: ${lv.reason || "Not specified"}.`,
        timestamp: lv.createdAt || new Date(),
        isRead: Boolean(state?.isRead),
        actionLabel: "Review Leave",
        actionLink: "/hr-management/leave",
        badge: {
          label: "LEAVE REQUEST",
          color: "amber",
        },
        metadata: {
          leaveId: lv._id,
          name: lv.name,
          days: lv.days,
          fromDate: lv.fromDate,
          toDate: lv.toDate,
          leaveType: lv.leaveType,
        },
      });
    });

    // 5. B2B Client KYC Reviews Pending (B2bClient)
    b2bClients.forEach((client) => {
      const alertKey = `b2b:${client._id}`;
      const state = stateMap.get(alertKey);
      if (state?.isDismissed) return;

      rawAlerts.push({
        id: alertKey,
        alertKey,
        category: "compliance",
        priority: "high",
        title: `B2B Client KYC Pending: ${client.companyName}`,
        message: `GSTIN (${client.gstin || "Pending"}) & documentation under review for corporate credit terms.`,
        timestamp: client.createdAt || new Date(),
        isRead: Boolean(state?.isRead),
        actionLabel: "Review Client",
        actionLink: "/hr-management/b2b-users",
        badge: {
          label: "KYC VERIFICATION",
          color: "teal",
        },
        metadata: {
          clientId: client._id,
          companyName: client.companyName,
          category: client.category,
        },
      });
    });

    // 6. Pending Payments & Orders
    pendingPayments.forEach((p) => {
      const alertKey = `payment:${p._id}`;
      const state = stateMap.get(alertKey);
      if (state?.isDismissed) return;

      rawAlerts.push({
        id: alertKey,
        alertKey,
        category: "payment",
        priority: "normal",
        title: `Payment Awaiting Clearance: ₹${(p.amount || 0).toLocaleString("en-IN")}`,
        message: `Payment reference ${p.transactionId || p._id} in pending state via ${p.paymentMethod || "gateway"}.`,
        timestamp: p.createdAt || new Date(),
        isRead: Boolean(state?.isRead),
        actionLabel: "View Payment",
        actionLink: "/billing",
        badge: {
          label: "PENDING PAYMENT",
          color: "blue",
        },
        metadata: {
          paymentId: p._id,
          amount: p.amount,
          method: p.paymentMethod,
        },
      });
    });

    // 7. Custom / Inbox Alerts (Notification collection)
    customNotifs.forEach((n) => {
      const alertKey = `notif:${n._id}`;
      const state = stateMap.get(alertKey);
      if (state?.isDismissed) return;

      rawAlerts.push({
        id: alertKey,
        alertKey,
        category: n.type === "alert" ? "general" : n.type || "general",
        priority: n.data?.priority || "normal",
        title: n.title || "System Alert",
        message: n.body || "",
        timestamp: n.createdAt || new Date(),
        isRead: state ? state.isRead : Boolean(n.isRead),
        actionLabel: n.data?.actionLabel || (n.data?.link ? "View Details" : ""),
        actionLink: n.data?.link || "",
        badge: {
          label: n.data?.badge || "SYSTEM ALERT",
          color: "indigo",
        },
        metadata: n.data || {},
      });
    });

    // Sort: unread first, then by priority (critical > high > normal), then newest first
    const priorityWeight = { critical: 3, high: 2, normal: 1, low: 0 };
    rawAlerts.sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      const pwA = priorityWeight[a.priority] || 0;
      const pwB = priorityWeight[b.priority] || 0;
      if (pwA !== pwB) return pwB - pwA;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const metrics = {
      totalAlerts: rawAlerts.length,
      unreadCount: rawAlerts.filter((a) => !a.isRead).length,
      duePaymentsCount: rawAlerts.filter((a) => a.category === "payroll").length,
      duePaymentsTotal: rawAlerts
        .filter((a) => a.category === "payroll")
        .reduce((sum, a) => sum + (Number(a.metadata?.net) || 0), 0),
      meetingsCount: rawAlerts.filter((a) => a.category === "meeting").length,
      urgentCount: rawAlerts.filter((a) => a.priority === "critical" || a.priority === "high").length,
    };

    return res.json({
      success: true,
      metrics,
      data: rawAlerts,
    });
  } catch (error) {
    console.error("Failed to load admin system alerts:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load admin system alerts",
    });
  }
};

/**
 * Mark a system alert as read
 */
export const markAdminSystemAlertRead = async (req, res) => {
  try {
    const alertKey = decodeURIComponent(req.params.id);
    const userId = String(req.user?._id || "admin");

    await AdminAlertState.findOneAndUpdate(
      { alertKey, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { upsert: true, new: true }
    );

    // If it's a Notification collection item, also update it
    if (alertKey.startsWith("notif:")) {
      const notifId = alertKey.replace("notif:", "");
      await Notification.findByIdAndUpdate(notifId, { $set: { isRead: true } });
    }

    return res.json({ success: true, message: "Alert marked as read" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to mark alert as read",
    });
  }
};

/**
 * Dismiss / Hide a system alert from list
 */
export const dismissAdminSystemAlert = async (req, res) => {
  try {
    const alertKey = decodeURIComponent(req.params.id);
    const userId = String(req.user?._id || "admin");

    await AdminAlertState.findOneAndUpdate(
      { alertKey, userId },
      { $set: { isDismissed: true, dismissedAt: new Date(), isRead: true } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: "Alert dismissed" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to dismiss alert",
    });
  }
};

/**
 * Mark all active alerts as read
 */
export const markAllAdminSystemAlertsRead = async (req, res) => {
  try {
    const userId = String(req.user?._id || "admin");
    const { alertKeys = [] } = req.body;

    if (Array.isArray(alertKeys) && alertKeys.length > 0) {
      const bulkOps = alertKeys.map((key) => ({
        updateOne: {
          filter: { alertKey: key, userId },
          update: { $set: { isRead: true, readAt: new Date() } },
          upsert: true,
        },
      }));
      await AdminAlertState.bulkWrite(bulkOps);
    }

    // Also update any unread Notification docs
    await Notification.updateMany(
      { "data.channel": "admin_inbox", isRead: false },
      { $set: { isRead: true } }
    );

    return res.json({ success: true, message: "All alerts marked as read" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to mark all alerts as read",
    });
  }
};

/**
 * Create a custom manual alert/announcement with optional sound/priority
 */
export const createCustomSystemAlert = async (req, res) => {
  try {
    const {
      title,
      message,
      category = "general",
      priority = "normal",
      actionLabel = "",
      actionLink = "",
      badge = "ALERT",
    } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    const notif = await Notification.create({
      user: req.user?._id || null,
      title: title.trim(),
      body: message.trim(),
      type: category === "payroll" ? "payroll" : "alert",
      isRead: false,
      data: {
        channel: "admin_inbox",
        priority,
        actionLabel,
        link: actionLink,
        badge,
        category,
        sound: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Custom alert published successfully",
      data: notif,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create custom alert",
    });
  }
};

