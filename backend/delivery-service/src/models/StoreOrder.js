import crypto from "crypto";
import mongoose from "mongoose";
import { ORDER_TYPES, deriveOrderType } from "../../../legacy/utils/departmentHelpers.js";
import {
  isVendorConfirmed,
  preOrderProgressKey,
  preOrderProgressLabel,
} from "../services/preOrderProgress.js";

export function randomDeliveryOtp() {
  return String(crypto.randomInt(1000, 10000));
}

const auditSchema = new mongoose.Schema(
  {
    byId: { type: mongoose.Schema.Types.ObjectId, default: null },
    byRole: { type: String, default: "" },
    byName: { type: String, default: "" },
    reason: { type: String, default: "", trim: true },
    at: { type: Date, default: null },
  },
  { _id: false }
);

/** Last known rider position for live tracking (GeoJSON Point, [lng, lat]). */
const driverLocationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: undefined },
    heading: { type: Number, default: null },
    speed: { type: Number, default: null },
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, default: "pcs" },
    price: { type: Number, default: 0 },
    customerInformed: { type: Boolean, default: false },
    customerInformedAt: { type: Date },
    /** preorder | ready2cook | instant */
    department: { type: String, trim: true, default: "" },
    /** Department-wise product id, e.g. "PR-28-R2C3" */
    departmentId: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const storeOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
    },
    /** Same as managerId — Dark Store ownership key */
    darkStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      index: true,
    },
    city: { type: String, trim: true, default: "" },
    cityId: { type: String, trim: true, default: "", index: true },
    area: { type: String, trim: true, default: "", index: true },
    customerName: { type: String, trim: true, default: "Customer" },
    customerPhone: { type: String, trim: true, default: "" },
    customerAddress: { type: String, required: true, trim: true },
    items: {
      type: [orderItemSchema],
      validate: [(v) => v.length > 0, "Order must have at least one item"],
    },
    status: {
      type: String,
      enum: [
        /** Pre-order still with the Product Manager — not actionable by the Delivery Manager */
        "preorder_hold",
        "incoming",
        "order_received",
        "stock_issue",
        "packed",
        "offered",
        "assigned",
        "pickup_verified",
        "out_for_delivery",
        "delivered",
        "delivery_failed",
        "cancelled",
      ],
      default: "order_received",
      index: true,
    },
    assignmentStatus: {
      type: String,
      enum: [
        "NONE",
        "SEARCHING_FOR_DRIVER",
        "WAITING_FOR_DRIVER",
        "OFFER_SENT",
        "DRIVER_ACCEPTED",
        "DRIVER_ASSIGNED",
        "DRIVER_AT_STORE",
        "PICKUP_PENDING",
        "PICKUP_VERIFIED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "FAILED",
        "BATCH_WAITING",
      ],
      default: "NONE",
      index: true,
    },
    currentOfferDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null,
    },
    offerStartedAt: { type: Date },
    excludedDriverIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryBoy",
      },
    ],
    /** Drivers who declined this order — never re-offer to them (not cleared on retry). */
    declinedDriverIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryBoy",
      },
    ],
    pickupVerified: { type: Boolean, default: false },
    pickupVerifiedAt: { type: Date },
    pickupVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
    },
    customerAddressUnlocked: { type: Boolean, default: false },
    offeredRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null,
    },
    offerExpiresAt: { type: Date },
    roundRobinRidersAttempted: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryBoy",
      },
    ],
    assignedRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null,
    },
    darkStoreQrCode: { type: String, default: "" },
    qrScannedAt: { type: Date },
    pickupQrScanned: { type: Boolean, default: false },
    pickupQrScannedAt: { type: Date },
    pickupProofImageUrl: { type: String, default: "" },
    pickupProofStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    pickupProofSubmittedAt: { type: Date },
    pickupProofApprovedAt: { type: Date },
    pickupProofApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
    },
    customerLat: { type: Number, default: null },
    customerLng: { type: Number, default: null },
    distanceKm: { type: Number, default: null },
    otpCode: { type: String, default: () => randomDeliveryOtp() },
    packedAt: { type: Date },
    stockDeductedAt: { type: Date },
    /** Stock was taken from the store when the order arrived; packing confirms it. */
    stockReservedAt: { type: Date, default: null },
    assignedAt: { type: Date },
    deliveredAt: { type: Date },
    notes: { type: String, default: "" },
    /** Optional rider note on successful delivery */
    deliveryComment: { type: String, default: "", trim: true },
    /** Required when status is delivery_failed */
    failureReason: { type: String, default: "", trim: true },
    failureKind: { type: String, enum: ["", "rider_emergency"], default: "" },
    failedAt: { type: Date },
    failedByRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null,
    },
    /** Manager's decision on a failed delivery: pending → returned (cancelled) or reattempt (back to queue). */
    failureResolution: {
      status: { type: String, enum: ["", "pending", "returned", "reattempt"], default: "" },
      byName: { type: String, default: "" },
      note: { type: String, default: "", trim: true },
      at: { type: Date, default: null },
    },
    deliveryAttempts: { type: Number, default: 0 },
    /** Admin/manager closed the order without the rider OTP/proof flow. */
    manualCompletion: { type: auditSchema, default: undefined },
    /** Rider says the customer paid online at the door; needs a verified payment or manager approval. */
    deliveryPaymentQr: {
      token: String,
      id: String,
      imageUrl: String,
      amount: Number,
      paymentId: String,
      reservedAt: Date,
    },
    onlinePaymentClaim: {
      status: { type: String, enum: ["", "pending", "approved", "rejected"], default: "" },
      riderId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", default: null },
      claimedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedByName: { type: String, default: "" },
      note: { type: String, default: "", trim: true },
    },
    /** DB-level assignment lock so concurrent servers don't assign the same order twice. */
    assignmentLockUntil: { type: Date, default: null },
    otpFailedTotal: { type: Number, default: 0 },
    /** Rider-reported delay; the manager decides when to forward it to the customer */
    deliveryDelay: {
      minutes: { type: Number, default: 0 },
      reason: { type: String, default: "", trim: true },
      reportedAt: { type: Date },
      expectedBy: { type: Date },
      customerNotifiedAt: { type: Date },
    },
    /** ETA promised when the rider left with the parcel; delay is measured against it */
    dispatchEta: {
      seconds: { type: Number, default: null },
      distanceMeters: { type: Number, default: null },
      expectedAt: { type: Date, default: null },
      computedAt: { type: Date, default: null },
      source: { type: String, default: "" },
    },

    // ── Same-route batching ─────────────────────────────────────────────────
    routeBatchWindowEndsAt: { type: Date },
    /** False until 5-min same-route wait ends OR a companion is batched */
    pickupQrUnlocked: { type: Boolean, default: false },
    batchId: { type: String, default: "", index: true },
    batchSequence: { type: Number, default: 0 },
    /** Linked primary order when this was attached as same-route companion */
    batchPrimaryOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreOrder",
      default: null,
      index: true,
    },
    routeCompatibility: {
      compatible: { type: Boolean, default: false },
      score: { type: Number, default: 0 },
      reason: { type: String, default: "" },
      distanceBetweenKm: { type: Number, default: null },
      suggestedSequence: { type: [String], default: [] },
    },

    sourceOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    /**
     * A mixed cart becomes two store orders for one customer order:
     * "now" (Ready2Cook / Instant, sent immediately) and "preorder" (held for the slot).
     * Empty for single-department orders.
     */
    sourcePart: { type: String, enum: ["", "now", "preorder"], default: "" },
    /** "delivery" = rider takes it home; "pickup" = customer collects at the dark store */
    fulfillmentType: {
      type: String,
      enum: ["delivery", "pickup"],
      default: "delivery",
      index: true,
    },
    /** Departments in this order (preorder / ready2cook / instant) */
    departments: { type: [String], default: [], index: true },
    /** ready_to_cook | instant get live rider tracking; preorder gets status updates only */
    orderType: { type: String, enum: ORDER_TYPES, index: true },
    /** Throttled copy of the rider's live position while this order is on the way */
    driverLocation: { type: driverLocationSchema, default: undefined },
    /** How the dark store was chosen, e.g. within_3km / same_pincode */
    routingReason: { type: String, trim: true, default: "" },

    // ── Pre-order (next-day slot) workflow ──────────────────────────────────
    // Vendor confirms, Product Manager prepares (pending → preparing → ready) and forwards,
    // Delivery Manager marks the goods received at the dark store and assigns riders
    // manually. Never auto-dispatched.
    isPreOrder: { type: Boolean, default: false, index: true },
    preOrderSlot: { type: String, default: "", trim: true },
    /** YYYY-MM-DD (IST) */
    preOrderDate: { type: String, default: "", trim: true, index: true },
    preOrderStage: {
      type: String,
      enum: ["", "pending", "preparing", "ready", "forwarded"],
      default: "",
      index: true,
    },
    preparingAt: { type: Date },
    readyAt: { type: Date },
    forwardedAt: { type: Date },
    forwardedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    forwardedByName: { type: String, default: "", trim: true },
    /** Note from Product Manager to Delivery Manager (packing / handling info) */
    preOrderNote: { type: String, default: "", trim: true, maxlength: 500 },
    /** The dark store's vendor confirms (or rejects) the pre-order before the Product Manager prepares it. */
    vendorStatus: {
      type: String,
      enum: ["", "pending", "confirmed", "rejected"],
      default: "",
      index: true,
    },
    vendorConfirmedAt: { type: Date },
    vendorActionByName: { type: String, default: "", trim: true },
    vendorRejectReason: { type: String, default: "", trim: true, maxlength: 300 },
    /** Delivery Manager confirms the forwarded goods physically reached the dark store. */
    storeReceivedAt: { type: Date },
    storeReceivedByName: { type: String, default: "", trim: true },

    // ── Full-Time driver delivery (salary-based; never earns per-KM) ─────────
    fullTimeDelivery: { type: Boolean, default: false, index: true },
    fullTimeAssignedAt: { type: Date },
    fullTimeAssignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
    },

    // ── Payment fields (extended for delivery workflow) ─────────────────────
    paymentMethod: {
      type: String,
      enum: ["COD", "online", "wallet", ""],
      default: "",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "collected", "paid_online", "failed", ""],
      default: "pending",
    },
    amountToCollect: { type: Number, default: 0 },
    amountCollected: { type: Number, default: 0 },
    /** What the customer is billed for this part (its share of the order total, delivery included). */
    partTotal: { type: Number, default: 0 },
    /** Lines dropped because the store could not supply them; amount is the billed share taken off. */
    removedItems: {
      type: [
        new mongoose.Schema(
          {
            productId: { type: mongoose.Schema.Types.ObjectId, default: null },
            sku: { type: String, default: "" },
            name: { type: String, default: "" },
            quantity: { type: Number, default: 0 },
            price: { type: Number, default: 0 },
            amount: { type: Number, default: 0 },
            removedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    /** Already-paid money owed back to the customer for removed lines. */
    refundDue: { type: Number, default: 0 },
    refundStatus: { type: String, enum: ["", "pending", "refunded"], default: "" },

    // ── Delivery proof / OTP (extended) ─────────────────────────────────────
    deliveryProofImageUrl: { type: String, default: "" },
    proofUploadedAt: { type: Date },
    /** customerOtpVerified flags OTP validated on backend */
    customerOtpVerified: { type: Boolean, default: false },
    customerOtpVerifiedAt: { type: Date },
    /** Last time the delivery OTP was SMSed to the customer (auto on out_for_delivery, or rider resend). */
    customerOtpSmsSentAt: { type: Date },
    /** OTP attempt tracking to prevent brute-force */
    otpAttempts: { type: Number, default: 0 },
    otpLockedUntil: { type: Date },

    // ── Shift reference: set when rider accepts; used for earning slab lookup ─
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
      index: true,
    },

    // ── Distance & rider earning (calculated by backend on delivery) ─────────
    deliveryDistanceKm: { type: Number, default: 0 },
    riderDeliveryEarning: { type: Number, default: 0 },
    earningSlab: {
      minKm: { type: Number, default: 0 },
      maxKm: { type: Number, default: 0 },
      riderAmount: { type: Number, default: 0 },
    },
    earningCalculatedAt: { type: Date },
    /** Immutable snapshot when earning is finalized (protects history if manager changes rates). */
    earningSnapshot: {
      darkStoreId: { type: String, default: "" },
      sourceLat: { type: Number, default: null },
      sourceLng: { type: Number, default: null },
      sourceAddress: { type: String, default: "" },
      customerLat: { type: Number, default: null },
      customerLng: { type: Number, default: null },
      customerAddress: { type: String, default: "" },
      distanceKm: { type: Number, default: 0 },
      /** Manager slab amount applied (existing KM-slab config). */
      slabMinKm: { type: Number, default: 0 },
      slabMaxKm: { type: Number, default: 0 },
      slabRiderAmount: { type: Number, default: 0 },
      shiftId: { type: String, default: "" },
      riderEarning: { type: Number, default: 0 },
      calculatedAt: { type: Date },
    },
    /** Immutable pay basis and delivery route distance used for rider payment reporting. */
    paymentSnapshot: {
      mode: { type: String, enum: ["monthly_salary", "per_km_commission", null], default: null },
      active: { type: Boolean, default: false },
      ratePerKm: { type: Number, default: 0 },
      distanceKm: { type: Number, default: 0 },
      distanceSource: { type: String, default: "" },
      commissionAmount: { type: Number, default: 0 },
      riderId: { type: String, default: "" },
      capturedAt: { type: Date, default: null },
    },

    // ── Delayed Wallet Credit (5 minutes after delivery) ─────────────
    walletCreditPending: { type: Boolean, default: false },
    walletCreditAmount: { type: Number, default: 0 },
    walletCreditAt: { type: Date },
    walletCreditedAt: { type: Date },
  },
  { timestamps: true }
);

storeOrderSchema.index({ managerId: 1, status: 1, createdAt: -1 });
storeOrderSchema.index({ sourceOrderId: 1 });
storeOrderSchema.index({ isPreOrder: 1, preOrderDate: 1, preOrderStage: 1 });
storeOrderSchema.index({ driverLocation: "2dsphere" });

storeOrderSchema.pre("validate", function deriveStoreOrderType() {
  if (
    this.isNew ||
    this.isModified("isPreOrder") ||
    this.isModified("sourcePart") ||
    this.isModified("departments")
  ) {
    this.orderType = deriveOrderType(this);
  }
});

export function deliveryDelayJSON(delay) {
  if (!delay || !(delay.minutes > 0)) return null;
  return {
    minutes: delay.minutes,
    reason: delay.reason || "",
    reportedAt: delay.reportedAt || null,
    expectedBy: delay.expectedBy || null,
    customerNotifiedAt: delay.customerNotifiedAt || null,
  };
}

storeOrderSchema.methods.toSafeJSON = function toSafeJSON(stockMap = null) {
  const items = this.items.map((item) => {
    const base = {
      id: item._id.toString(),
      productId: item.productId ? item.productId.toString() : null,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      customerInformed: item.customerInformed,
      customerInformedAt: item.customerInformedAt,
      department: item.department || "",
      departmentId: item.departmentId || "",
    };
    if (stockMap) {
      const stock =
        (item.productId && stockMap.get(`pid:${item.productId}`)) || stockMap.get(item.sku);
      const available = stock ? stock.stockCount : 0;
      const held = Boolean(this.stockReservedAt || this.stockDeductedAt);
      base.availableStock = available;
      base.stockStatus = held || available >= item.quantity ? "available" : "out_of_stock";
      if (held) base.reserved = true;
    }
    return base;
  });

  const itemsTotal = Math.round(
    (this.items || [])
      .filter((item) => !item.customerInformed)
      .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  );
  const amountToCollect = Number(this.amountToCollect || 0);
  const billed = Number(this.partTotal || 0) || amountToCollect;
  const deliveryFee = Math.max(0, Math.round(billed - itemsTotal));

  const startAt = this.assignedAt || this.packedAt || this.createdAt;
  const endAt = this.deliveredAt || null;
  let tripDurationMinutes = null;
  if (startAt && endAt) {
    tripDurationMinutes = Math.max(
      0,
      Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000)
    );
  }

  return {
    id: this._id.toString(),
    orderNumber: this.orderNumber,
    managerId: this.managerId.toString(),
    darkStoreId: (this.darkStoreId || this.managerId).toString(),
    city: this.city,
    cityId: this.cityId,
    area: this.area,
    customerName: this.customerName,
    customerPhone: this.customerPhone,
    customerAddress: this.customerAddress,
    customerLat: this.customerLat,
    customerLng: this.customerLng,
    distanceKm: this.distanceKm,
    items,
    itemsTotal,
    deliveryFee,
    orderTotal: billed > 0 ? billed : itemsTotal + deliveryFee,
    partTotal: Number(this.partTotal || 0),
    removedItems: (this.removedItems || []).map((row) => ({
      productId: row.productId ? row.productId.toString() : null,
      sku: row.sku,
      name: row.name,
      quantity: row.quantity,
      price: row.price,
      amount: row.amount,
      removedAt: row.removedAt,
    })),
    refundDue: Number(this.refundDue || 0),
    refundStatus: this.refundStatus || "",
    status: this.status,
    assignmentStatus: this.assignmentStatus || "NONE",
    currentOfferDriverId: this.currentOfferDriverId
      ? this.currentOfferDriverId.toString()
      : null,
    offerStartedAt: this.offerStartedAt,
    excludedDriverIds: (this.excludedDriverIds || []).map((id) => id.toString()),
    declinedDriverIds: (this.declinedDriverIds || []).map((id) => id.toString()),
    pickupVerified: Boolean(this.pickupVerified),
    pickupVerifiedAt: this.pickupVerifiedAt,
    customerAddressUnlocked: Boolean(this.customerAddressUnlocked),
    offeredRiderId: this.offeredRiderId ? this.offeredRiderId.toString() : null,
    offerExpiresAt: this.offerExpiresAt,
    assignedRiderId: this.assignedRiderId
      ? this.assignedRiderId.toString()
      : null,
    darkStoreQrCode: this.darkStoreQrCode || `DARKSTORE_${this.managerId}`,
    qrScannedAt: this.qrScannedAt,
    pickupQrScanned: Boolean(this.pickupQrScanned || this.qrScannedAt),
    pickupQrScannedAt: this.pickupQrScannedAt || this.qrScannedAt,
    pickupProofImageUrl: this.pickupProofImageUrl || "",
    pickupProofStatus: this.pickupProofStatus || "none",
    pickupProofSubmittedAt: this.pickupProofSubmittedAt,
    pickupProofApprovedAt: this.pickupProofApprovedAt,
    packedAt: this.packedAt,
    stockDeductedAt: this.stockDeductedAt,
    stockReservedAt: this.stockReservedAt || null,
    assignedAt: this.assignedAt,
    deliveredAt: this.deliveredAt,
    tripDurationMinutes,
    notes: this.notes,
    deliveryComment: this.deliveryComment || "",
    failureReason: this.failureReason || "",
    failureKind: this.failureKind || "",
    failedAt: this.failedAt,
    failedByRiderId: this.failedByRiderId
      ? this.failedByRiderId.toString()
      : null,
    failureResolution: this.failureResolution?.status
      ? {
          status: this.failureResolution.status,
          byName: this.failureResolution.byName || "",
          note: this.failureResolution.note || "",
          at: this.failureResolution.at || null,
        }
      : null,
    deliveryAttempts: this.deliveryAttempts || 0,
    manualCompletion: this.manualCompletion?.at
      ? {
          byRole: this.manualCompletion.byRole || "",
          byName: this.manualCompletion.byName || "",
          reason: this.manualCompletion.reason || "",
          at: this.manualCompletion.at,
        }
      : null,
    onlinePaymentClaim: this.onlinePaymentClaim?.status
      ? {
          status: this.onlinePaymentClaim.status,
          claimedAt: this.onlinePaymentClaim.claimedAt || null,
          reviewedAt: this.onlinePaymentClaim.reviewedAt || null,
          reviewedByName: this.onlinePaymentClaim.reviewedByName || "",
          note: this.onlinePaymentClaim.note || "",
        }
      : null,
    deliveryDelay: deliveryDelayJSON(this.deliveryDelay),
    dispatchEta: this.dispatchEta?.expectedAt
      ? {
          seconds: this.dispatchEta.seconds,
          distanceMeters: this.dispatchEta.distanceMeters,
          expectedAt: this.dispatchEta.expectedAt,
          source: this.dispatchEta.source || "",
        }
      : null,
    routeBatchWindowEndsAt: this.routeBatchWindowEndsAt,
    pickupQrUnlocked: Boolean(this.pickupQrUnlocked),
    batchId: this.batchId || "",
    batchSequence: this.batchSequence || 0,
    batchPrimaryOrderId: this.batchPrimaryOrderId
      ? this.batchPrimaryOrderId.toString()
      : null,
    routeCompatibility: this.routeCompatibility || null,
    sourceOrderId: this.sourceOrderId ? this.sourceOrderId.toString() : null,
    sourcePart: this.sourcePart || "",
    fulfillmentType: this.fulfillmentType || "delivery",
    departments: this.departments || [],
    orderType: this.orderType || deriveOrderType(this),
    routingReason: this.routingReason || "",
    // Pre-order
    isPreOrder: Boolean(this.isPreOrder),
    preOrderSlot: this.preOrderSlot || "",
    preOrderDate: this.preOrderDate || "",
    preOrderStage: this.preOrderStage || "",
    preparingAt: this.preparingAt,
    readyAt: this.readyAt,
    forwardedAt: this.forwardedAt,
    forwardedByName: this.forwardedByName || "",
    preOrderNote: this.preOrderNote || "",
    vendorStatus: this.isPreOrder
      ? isVendorConfirmed(this)
        ? "confirmed"
        : this.vendorStatus || "pending"
      : "",
    vendorConfirmedAt: this.vendorConfirmedAt || null,
    vendorActionByName: this.vendorActionByName || "",
    vendorRejectReason: this.vendorRejectReason || "",
    storeReceivedAt: this.storeReceivedAt || null,
    storeReceivedByName: this.storeReceivedByName || "",
    preOrderProgress: preOrderProgressKey(this),
    preOrderProgressLabel: preOrderProgressLabel(preOrderProgressKey(this)),
    fullTimeDelivery: Boolean(this.fullTimeDelivery),
    fullTimeAssignedAt: this.fullTimeAssignedAt || null,
    // Payment
    paymentMethod: this.paymentMethod || "",
    paymentStatus: this.paymentStatus || "pending",
    amountToCollect: amountToCollect,
    amountCollected: this.amountCollected || 0,
    // Delivery proof / OTP
    deliveryProofImageUrl: this.deliveryProofImageUrl || "",
    proofUploadedAt: this.proofUploadedAt,
    customerOtpVerified: Boolean(this.customerOtpVerified),
    customerOtpVerifiedAt: this.customerOtpVerifiedAt,
    // Shift & earning
    shiftId: this.shiftId ? this.shiftId.toString() : null,
    deliveryDistanceKm: this.deliveryDistanceKm || 0,
    riderDeliveryEarning: this.riderDeliveryEarning || 0,
    earningSlab: this.earningSlab
      ? { minKm: this.earningSlab.minKm, maxKm: this.earningSlab.maxKm, riderAmount: this.earningSlab.riderAmount }
      : null,
    earningCalculatedAt: this.earningCalculatedAt,
    earningSnapshot: this.earningSnapshot
      ? {
          darkStoreId: this.earningSnapshot.darkStoreId || "",
          sourceLat: this.earningSnapshot.sourceLat,
          sourceLng: this.earningSnapshot.sourceLng,
          sourceAddress: this.earningSnapshot.sourceAddress || "",
          customerLat: this.earningSnapshot.customerLat,
          customerLng: this.earningSnapshot.customerLng,
          customerAddress: this.earningSnapshot.customerAddress || "",
          distanceKm: this.earningSnapshot.distanceKm || 0,
          slabMinKm: this.earningSnapshot.slabMinKm || 0,
          slabMaxKm: this.earningSnapshot.slabMaxKm || 0,
          slabRiderAmount: this.earningSnapshot.slabRiderAmount || 0,
          shiftId: this.earningSnapshot.shiftId || "",
          riderEarning: this.earningSnapshot.riderEarning || 0,
          calculatedAt: this.earningSnapshot.calculatedAt,
        }
      : null,
    paymentSnapshot: this.paymentSnapshot ? {
      mode: this.paymentSnapshot.mode || null,
      active: Boolean(this.paymentSnapshot.active),
      ratePerKm: Number(this.paymentSnapshot.ratePerKm) || 0,
      distanceKm: Number(this.paymentSnapshot.distanceKm) || 0,
      distanceSource: this.paymentSnapshot.distanceSource || "",
      commissionAmount: Number(this.paymentSnapshot.commissionAmount) || 0,
      riderId: this.paymentSnapshot.riderId || "",
      capturedAt: this.paymentSnapshot.capturedAt || null,
    } : null,
    walletCreditPending: Boolean(this.walletCreditPending),
    walletCreditAmount: this.walletCreditAmount || 0,
    walletCreditAt: this.walletCreditAt || null,
    walletCreditedAt: this.walletCreditedAt || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const RIDER_CLOSED_STATUSES = new Set(["delivered", "cancelled", "delivery_failed"]);

/**
 * What a rider may see: customer phone from assignment, address only after the
 * pickup is approved, and neither once the order is closed.
 */
storeOrderSchema.methods.toRiderJSON = function toRiderJSON() {
  const json = this.toSafeJSON();
  const closed = RIDER_CLOSED_STATUSES.has(this.status);
  if (closed) {
    json.customerName = "Customer";
    json.customerPhone = "";
  }
  if (closed || !this.customerAddressUnlocked) {
    json.customerPhone = "";
    json.customerAddress = "";
    json.customerLat = null;
    json.customerLng = null;
    if (json.earningSnapshot) {
      json.earningSnapshot.customerAddress = "";
      json.earningSnapshot.customerLat = null;
      json.earningSnapshot.customerLng = null;
    }
  }
  return json;
};

// ── Hard Enforced State Machine Defense ─────────────────────────────────────
// INCOMING ORDERS MUST REMAIN IN 'order_received' UNTIL PACKED BY THE MANAGER.
// Under NO circumstance should any caller mutate an order to 'packed', 'offered',
// or 'assigned' unless stockDeductedAt is set (done exclusively by manager packOrder).
storeOrderSchema.pre("save", async function preSaveStoreOrder() {
  if (!this.isPreOrder && this.fulfillmentType !== "pickup") {
    if (!this.stockDeductedAt && ["packed", "offered", "assigned"].includes(this.status)) {
      console.warn(
        `[StoreOrder Schema Guardian] BLOCKED premature status '${this.status}' on order ${this.orderNumber || this._id}! Reverting to 'order_received' because Delivery Manager has not confirmed & packed it yet.`
      );
      this.status = "order_received";
      this.assignmentStatus = "NONE";
      this.currentOfferDriverId = null;
      this.offeredRiderId = null;
      this.offerStartedAt = null;
      this.offerExpiresAt = null;
      this.packedAt = undefined;
    }
  }
});

if (mongoose.models.StoreOrder) {
  delete mongoose.models.StoreOrder;
}

const StoreOrder = mongoose.model("StoreOrder", storeOrderSchema);

export default StoreOrder;
