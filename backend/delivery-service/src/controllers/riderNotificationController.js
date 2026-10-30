import {
  getUnreadCount,
  listRiderNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  syncAnnouncementsToInbox,
} from "../services/RiderNotificationService.js";

export const listMyNotifications = async (req, res, next) => {
  try {
    await syncAnnouncementsToInbox(req.user.id);
    const limit = Number(req.query.limit) || 50;
    const skip = Number(req.query.skip) || 0;
    const result = await listRiderNotifications(req.user.id, { limit, skip });
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyUnreadNotificationCount = async (req, res, next) => {
  try {
    await syncAnnouncementsToInbox(req.user.id);
    const unreadCount = await getUnreadCount(req.user.id);
    return res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
};

export const markMyNotificationRead = async (req, res, next) => {
  try {
    const notification = await markNotificationRead(
      req.user.id,
      req.params.notificationId
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    const unreadCount = await getUnreadCount(req.user.id);
    return res.json({ success: true, notification, unreadCount });
  } catch (error) {
    next(error);
  }
};

export const markAllMyNotificationsRead = async (req, res, next) => {
  try {
    const result = await markAllNotificationsRead(req.user.id);
    return res.json({ success: true, ...result, unreadCount: 0 });
  } catch (error) {
    next(error);
  }
};

export const deleteMyNotification = async (req, res, next) => {
  try {
    const result = await deleteNotification(req.user.id, req.params.notificationId);
    if (!result.deleted) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    const unreadCount = await getUnreadCount(req.user.id);
    return res.json({ success: true, deleted: true, unreadCount });
  } catch (error) {
    next(error);
  }
};
