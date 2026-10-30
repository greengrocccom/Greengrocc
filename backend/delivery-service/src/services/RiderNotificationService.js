/**
 * Central Delivery Partner notification system.
 *
 * EVENT → DB row → Socket (app open) → FCM (app closed/background)
 * Never show a system tray banner from the Flutter foreground handler —
 * inbox + badge only when open; FCM tray only when background/terminated.
 */
import mongoose from "mongoose";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryBoyNotification from "../models/DeliveryBoyNotification.js";
import { getIO } from "../../../socket.js";

async function getFirebaseMessagingSafe() {
  try {
    const mod = await import("../../../legacy/config/firebaseAdmin.js");
    return mod.getFirebaseMessaging?.() || null;
  } catch (err) {
    console.warn("[PartnerNotify] Firebase Admin unavailable:", err.message);
    return null;
  }
}

function stringifyData(data = {}) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v == null) continue;
    out[String(k)] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

function screenForType(type) {
  switch (type) {
    case "ORDER_RECEIVED":
      return "home";
    case "ORDER_ASSIGNED":
      return "assigned_orders";
    case "ORDER_COMPLETED":
    case "WALLET_CREDITED":
    case "SALARY_CREDITED":
    case "INCENTIVE_CREDITED":
      return "wallet";
    case "NEW_GIG":
      return "gigs";
    case "SHIFT_STARTED":
    case "SHIFT_REMINDER":
    case "SHIFT_ASSIGNED":
      return "shifts";
    case "VERIFICATION_COMPLETED":
      return "home";
    default:
      return "notifications";
  }
}

const announcementSyncAt = new Map();

/**
 * Copies live admin announcements (published within 30 days) into the rider's inbox once each,
 * so ones published before the rider joined — or before fan-out existed — still show up.
 * Synced ids are remembered so a deleted notification is not recreated.
 */
export async function syncAnnouncementsToInbox(riderId) {
  const key = String(riderId || "");
  if (!key) return 0;
  const last = announcementSyncAt.get(key) || 0;
  if (Date.now() - last < 60_000) return 0;
  announcementSyncAt.set(key, Date.now());
  try {
    const { HrAnnouncement } = await import("../../../admin-ops-service/src/models.js");
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [rider, rows] = await Promise.all([
      DeliveryBoy.findById(key).select("syncedAnnouncementIds").lean(),
      HrAnnouncement.find({
        status: "published",
        roleKey: { $in: ["all", "delivery_boy"] },
        vendorId: { $in: ["", null] },
        $or: [{ publishedAt: { $gte: since } }, { publishedAt: null, createdAt: { $gte: since } }],
      })
        .sort({ publishedAt: 1, createdAt: 1 })
        .limit(20)
        .select("title body publishedAt createdAt")
        .lean(),
    ]);
    if (!rider || !rows.length) return 0;
    const synced = new Set(rider.syncedAnnouncementIds || []);
    const pending = rows.filter((row) => !synced.has(String(row._id)));
    if (!pending.length) return 0;

    let created = 0;
    for (const row of pending) {
      const id = String(row._id);
      const dedupeKey = `ANNOUNCEMENT:${key}:announcement:${id}`;
      const exists = await DeliveryBoyNotification.exists({ deliveryPartnerId: key, dedupeKey });
      if (!exists) {
        const message = row.body || "You have a new announcement";
        await DeliveryBoyNotification.create({
          deliveryPartnerId: key,
          deliveryBoyId: key,
          type: "ANNOUNCEMENT",
          title: row.title || "New announcement",
          message,
          body: message,
          priority: "normal",
          dedupeKey,
          // Backfilled history: listed, but never raises the unread badge.
          isRead: true,
          readAt: new Date(),
          data: { announcementId: id, screen: "notifications" },
        }).catch(() => {});
        created += 1;
      }
    }
    await DeliveryBoy.updateOne(
      { _id: key },
      { $addToSet: { syncedAnnouncementIds: { $each: pending.map((row) => String(row._id)) } } }
    );
    return created;
  } catch (err) {
    console.warn("[PartnerNotify] announcement sync failed:", err.message);
    return 0;
  }
}

/**
 * Create + fan-out notifications for one or many partners.
 */
export async function notifyRiders({
  riderIds,
  type = "SYSTEM",
  title,
  body = "",
  message,
  data = {},
  orderId = null,
  gigId = null,
  amount = null,
  priority = "normal",
  dedupeKey = "",
  sendPush = true,
}) {
  const ids = [
    ...new Set(
      (Array.isArray(riderIds) ? riderIds : [riderIds]).filter(Boolean).map(String)
    ),
  ];
  const text = message || body || "";
  if (!ids.length || !title) {
    return { created: 0, notifications: [], skipped: 0 };
  }

  const screen = data.screen || screenForType(type);
  const created = [];
  const newlyCreated = [];
  let skipped = 0;

  for (const partnerId of ids) {
    const key = dedupeKey
      ? `${type}:${partnerId}:${dedupeKey}`
      : "";

    if (key) {
      const existing = await DeliveryBoyNotification.findOne({
        deliveryPartnerId: partnerId,
        dedupeKey: key,
      });
      if (existing) {
        skipped += 1;
        continue;
      }
    }

    try {
      const doc = await DeliveryBoyNotification.create({
        deliveryPartnerId: partnerId,
        deliveryBoyId: partnerId,
        type,
        title,
        message: text,
        body: text,
        orderId: mongoose.isValidObjectId(orderId)
          ? orderId
          : mongoose.isValidObjectId(data?.orderId)
          ? data.orderId
          : null,
        gigId: gigId || data.gigId || null,
        amount: amount != null ? Number(amount) : data.amount != null ? Number(data.amount) : null,
        priority,
        dedupeKey: key,
        data: {
          ...data,
          screen,
          type,
          title,
          message: text,
          body: text,
        },
        isRead: false,
      });
      created.push(doc);
      newlyCreated.push(doc);
    } catch (err) {
      if (err?.code === 11000 && key) {
        skipped += 1;
        continue;
      }
      console.warn("[PartnerNotify] create failed:", err.message);
    }
  }

  const messaging = sendPush ? await getFirebaseMessagingSafe() : null;
  const riders = await DeliveryBoy.find({ _id: { $in: ids } })
    .select("fcmToken name")
    .lean();
  const tokenById = new Map(riders.map((r) => [String(r._id), r.fcmToken || ""]));

  let io = null;
  try {
    io = getIO();
  } catch (_) {}

  for (const notif of newlyCreated) {
    const payload = notif.toSafeJSON();
    const riderId = String(notif.deliveryPartnerId || notif.deliveryBoyId);

    try {
      io?.to(`rider_${riderId}`).emit("rider_notification", payload);
      io?.to(`rider:${riderId}`).emit("rider_notification", payload);
      io?.to(`rider_${riderId}`).emit("notification_badge", {
        unreadDelta: 1,
      });
      io?.to(`rider:${riderId}`).emit("notification_badge", {
        unreadDelta: 1,
      });
    } catch (_) {}

    if (!sendPush || !messaging) continue;

    const token = tokenById.get(riderId);
    if (!token) continue;

    try {
      await messaging.send({
        token,
        notification: {
          title: notif.title,
          body: notif.message || notif.body || "",
        },
        data: stringifyData({
          ...(notif.data || {}),
          notificationId: notif._id.toString(),
          type: notif.type,
          title: notif.title,
          message: notif.message || notif.body || "",
          body: notif.message || notif.body || "",
          screen: notif.data?.screen || screenForType(notif.type),
          orderId: notif.orderId ? String(notif.orderId) : "",
          gigId: notif.gigId ? String(notif.gigId) : "",
          amount: notif.amount != null ? String(notif.amount) : "",
        }),
        android: {
          priority: "high",
          notification: {
            channelId: "high_importance_channel",
            sound: "default",
            priority: "high",
            // Opens MainActivity (must match AndroidManifest intent-filter).
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
      });
      notif.pushSent = true;
      await notif.save();
    } catch (err) {
      notif.pushError = String(err.message || err).slice(0, 300);
      await notif.save();
      console.warn(`[PartnerNotify] FCM failed for ${riderId}:`, err.message);
    }
  }

  return {
    created: newlyCreated.length,
    skipped,
    notifications: newlyCreated.map((n) => n.toSafeJSON()),
  };
}

export async function notifyStoreRiders({
  managerId,
  type,
  title,
  body,
  message,
  data = {},
  gigId = null,
  priority = "normal",
  dedupeKey = "",
  sendPush = true,
}) {
  if (!managerId) return { created: 0, notifications: [], skipped: 0 };
  const riders = await DeliveryBoy.find({
    managerId,
    isActive: { $ne: false },
  }).select("_id");
  return notifyRiders({
    riderIds: riders.map((r) => r._id),
    type,
    title,
    body,
    message,
    data,
    gigId,
    priority,
    dedupeKey,
    sendPush,
  });
}

/** Typed helpers — short professional copy */
export async function notifyVerificationCompleted(riderId) {
  try {
    const io = getIO();
    const updatePayload = {
      documentType: "verification",
      verificationStatus: "approved",
      remarks: "Verified by delivery manager",
    };
    io.to(`rider_${riderId}`).emit("document_review_update", updatePayload);
    io.to(`rider:${riderId}`).emit("document_review_update", updatePayload);
  } catch (_) {}

  return notifyRiders({
    riderIds: [riderId],
    type: "VERIFICATION_COMPLETED",
    title: "You're Verified!",
    message: "You can now receive orders.",
    priority: "high",
    dedupeKey: "verified",
    data: { screen: "home", badge: "new", verificationStatus: "approved" },
  });
}

export async function notifyShiftStarted(riderId, { shiftId, slotId, startTime, endTime, dateString } = {}) {
  return notifyRiders({
    riderIds: [riderId],
    type: "SHIFT_STARTED",
    title: "Time to go online",
    message: `Your slot ${startTime || ""}${endTime ? ` – ${endTime}` : ""} has started. Go online to receive orders.`,
    priority: "high",
    dedupeKey: `${shiftId || ""}:${slotId || ""}:start`,
    data: {
      screen: "shifts",
      badge: "online",
      shiftId: shiftId ? String(shiftId) : "",
      slotId: slotId ? String(slotId) : "",
      startTime: startTime || "",
      endTime: endTime || "",
      dateString: dateString || "",
      event: "shift_started",
    },
  });
}

export async function notifyShiftReminder(riderId, { shiftId, slotId, startTime, endTime, dateString, minutesLeft } = {}) {
  return notifyRiders({
    riderIds: [riderId],
    type: "SHIFT_REMINDER",
    title: "Shift starting soon",
    message: `Your shift starts in about ${minutesLeft || 15} min. Be ready to go online.`,
    priority: "normal",
    dedupeKey: `${shiftId || ""}:${slotId || ""}:reminder`,
    data: {
      screen: "shifts",
      shiftId: shiftId ? String(shiftId) : "",
      slotId: slotId ? String(slotId) : "",
      startTime: startTime || "",
      endTime: endTime || "",
      dateString: dateString || "",
      minutesLeft: String(minutesLeft || 15),
      event: "shift_reminder",
    },
  });
}

export async function notifyOrderReceived(riderId, { orderId, orderNumber, estimatedEarnings } = {}) {
  return notifyRiders({
    riderIds: [riderId],
    type: "ORDER_RECEIVED",
    title: "New Order",
    message: "You have a new order request.",
    orderId: orderId || null,
    amount: estimatedEarnings != null ? Number(estimatedEarnings) : null,
    priority: "high",
    dedupeKey: `${orderId || orderNumber || ""}:offer`,
    data: {
      screen: "home",
      badge: "new",
      orderId: orderId ? String(orderId) : "",
      orderNumber: orderNumber || "",
      estimatedEarnings: estimatedEarnings != null ? String(estimatedEarnings) : "",
      event: "order_received",
    },
  });
}

/** Manager manually assigned one or more orders (Full-Time orders or pre-orders). */
export async function notifyOrdersAssigned(riderId, { orders = [], preOrder = false, storeName = "" } = {}) {
  if (!orders.length) return { created: 0, notifications: [], skipped: 0 };
  const numbers = orders.map((o) => o.orderNumber).filter(Boolean);
  const single = orders.length === 1;
  const store = storeName ? ` at ${storeName}` : " at the dark store";
  return notifyRiders({
    riderIds: [riderId],
    type: "ORDER_ASSIGNED",
    title: preOrder
      ? `Delivery Manager assigned you ${orders.length} pre-order${single ? "" : "s"}`
      : single
        ? "New Order Assigned"
        : `${orders.length} New Orders Assigned`,
    message: preOrder
      ? `Collect ${single ? "it" : "them"}${store}. Scan each order's QR to see that customer's address.`
      : single
        ? `Order #${numbers[0] || ""} has been assigned to you.`
        : `Orders ${numbers.map((n) => `#${n}`).join(", ")} have been assigned to you.`,
    orderId: single ? (orders[0]._id || orders[0].orderId) : null,
    priority: "high",
    dedupeKey: `${orders.map((o) => String(o._id || o.orderId)).sort().join(",")}:assigned`,
    data: {
      screen: preOrder ? "preorder_deliveries" : "assigned_orders",
      badge: "new",
      orderId: single ? String(orders[0]._id || orders[0].orderId) : "",
      orderIds: orders.map((o) => String(o._id || o.orderId)).join(","),
      orderNumbers: numbers.join(","),
      orderCount: String(orders.length),
      event: "order_assigned",
    },
  });
}

export async function notifyOrderCompleted(riderId, { orderId, orderNumber, amount } = {}) {
  const amt = Math.round(Number(amount) || 0);
  return notifyRiders({
    riderIds: [riderId],
    type: "ORDER_COMPLETED",
    title: "Order Completed",
    message: `You earned ₹${amt}. Added to your wallet.`,
    orderId: orderId || null,
    amount: amt,
    priority: "high",
    dedupeKey: `${orderId || orderNumber || ""}:completed`,
    data: {
      screen: "wallet",
      orderId: orderId ? String(orderId) : "",
      orderNumber: orderNumber || "",
      amount: String(amt),
      event: "order_completed",
    },
  });
}

export async function notifyWalletCredited(riderId, { amount, orderId, reason } = {}) {
  const amt = Math.round(Number(amount) || 0);
  return notifyRiders({
    riderIds: [riderId],
    type: "WALLET_CREDITED",
    title: `₹${amt} Added`,
    message: "Your earnings have been added to your wallet.",
    orderId: orderId || null,
    amount: amt,
    priority: "normal",
    dedupeKey: `${orderId || reason || Date.now()}:wallet`,
    data: {
      screen: "wallet",
      amount: String(amt),
      orderId: orderId ? String(orderId) : "",
      reason: reason || "",
      event: "wallet_credited",
    },
  });
}

export async function notifyNewGig(managerId, { gigId, title } = {}) {
  return notifyStoreRiders({
    managerId,
    type: "NEW_GIG",
    title: "New Gig Available",
    message: "A new gig is available near you.",
    gigId: gigId || null,
    priority: "normal",
    dedupeKey: `${gigId || ""}:gig`,
    data: {
      screen: "gigs",
      badge: "new",
      gigId: gigId ? String(gigId) : "",
      gigTitle: title || "",
      event: "new_gig",
    },
  });
}

export async function listRiderNotifications(riderId, { limit = 50, skip = 0 } = {}) {
  const filter = {
    $or: [{ deliveryPartnerId: riderId }, { deliveryBoyId: riderId }],
  };
  const [items, unreadCount] = await Promise.all([
    DeliveryBoyNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(100, Number(limit) || 50)),
    DeliveryBoyNotification.countDocuments({ ...filter, isRead: false }),
  ]);
  return {
    notifications: items.map((n) => n.toSafeJSON()),
    unreadCount,
  };
}

export async function getUnreadCount(riderId) {
  return DeliveryBoyNotification.countDocuments({
    $or: [{ deliveryPartnerId: riderId }, { deliveryBoyId: riderId }],
    isRead: false,
  });
}

export async function markNotificationRead(riderId, notificationId) {
  const doc = await DeliveryBoyNotification.findOneAndUpdate(
    {
      _id: notificationId,
      $or: [{ deliveryPartnerId: riderId }, { deliveryBoyId: riderId }],
    },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );
  return doc ? doc.toSafeJSON() : null;
}

export async function markAllNotificationsRead(riderId) {
  const result = await DeliveryBoyNotification.updateMany(
    {
      $or: [{ deliveryPartnerId: riderId }, { deliveryBoyId: riderId }],
      isRead: false,
    },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { modified: result.modifiedCount || 0 };
}

export async function deleteNotification(riderId, notificationId) {
  const result = await DeliveryBoyNotification.deleteOne({
    _id: notificationId,
    $or: [{ deliveryPartnerId: riderId }, { deliveryBoyId: riderId }],
  });
  return { deleted: result.deletedCount || 0 };
}
