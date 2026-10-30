/**
 * DeliveryBoyNotification (Delivery Partner Notification)
 *
 * ONE central inbox for every partner alert.
 * Flow: EVENT → save DB → FCM (background) + socket (foreground) → Notification page
 */
import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "VERIFICATION_COMPLETED",
  "SHIFT_STARTED",
  "SHIFT_REMINDER",
  "SHIFT_ASSIGNED",
  "SALARY_CREDITED",
  "INCENTIVE_CREDITED",
  "ORDER_RECEIVED",
  "ORDER_COMPLETED",
  "ORDER_ASSIGNED",
  "WALLET_CREDITED",
  "NEW_GIG",
  "ANNOUNCEMENT",
  "SUPPORT",
  "QUERY",
  "SYSTEM",
];

export const NOTIFICATION_PRIORITIES = ["low", "normal", "high"];

const deliveryBoyNotificationSchema = new mongoose.Schema(
  {
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
    },
    /** Legacy alias field kept in sync for older queries */
    deliveryBoyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: "SYSTEM",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: "", trim: true },
    /** Legacy body alias */
    body: { type: String, default: "", trim: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreOrder",
      default: null,
      index: true,
    },
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gig",
      default: null,
    },
    amount: { type: Number, default: null },
    priority: {
      type: String,
      enum: NOTIFICATION_PRIORITIES,
      default: "normal",
    },
    /** Deep-link / action payload for the app */
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Dedup key: type + partner + entity (order/gig/shift) */
    dedupeKey: { type: String, default: "", index: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    pushSent: { type: Boolean, default: false },
    pushError: { type: String, default: "" },
  },
  { timestamps: true }
);

deliveryBoyNotificationSchema.index({ deliveryPartnerId: 1, createdAt: -1 });
deliveryBoyNotificationSchema.index({ deliveryPartnerId: 1, isRead: 1, createdAt: -1 });
deliveryBoyNotificationSchema.index(
  { deliveryPartnerId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string", $gt: "" } } }
);

deliveryBoyNotificationSchema.methods.toSafeJSON = function toSafeJSON() {
  const message = this.message || this.body || "";
  return {
    id: this._id.toString(),
    deliveryPartnerId: (this.deliveryPartnerId || this.deliveryBoyId)?.toString?.() || "",
    deliveryBoyId: (this.deliveryBoyId || this.deliveryPartnerId)?.toString?.() || "",
    type: this.type,
    title: this.title,
    message,
    body: message,
    orderId: this.orderId ? this.orderId.toString() : null,
    gigId: this.gigId ? this.gigId.toString() : null,
    amount: this.amount != null ? Number(this.amount) : null,
    priority: this.priority || "normal",
    data: this.data || {},
    isRead: Boolean(this.isRead),
    readAt: this.readAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

if (mongoose.models.DeliveryBoyNotification) {
  delete mongoose.models.DeliveryBoyNotification;
}

const DeliveryBoyNotification = mongoose.model(
  "DeliveryBoyNotification",
  deliveryBoyNotificationSchema
);

export default DeliveryBoyNotification;
