import mongoose from "mongoose";
import { addressSnapshotSchema } from "../address/Address.js";
import Product from "../Product.js";
import {
  DEPARTMENT_KEYS,
  FULFILLMENT_TYPES,
  ORDER_TYPES,
  collectDepartments,
  deriveCustomerOrderType,
  sectionToDepartment,
} from "../../utils/departmentHelpers.js";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GreenGroccProduct",
      required: true,
    },
    name: { type: String, required: true },
    brandName: { type: String, default: "" },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    variantName: { type: String, default: "" },
    colorName: { type: String, default: "" },
    image: { type: String, default: "" },
    department: {
      type: String,
      enum: ["", ...DEPARTMENT_KEYS],
      default: "",
    },
    departmentId: { type: String, default: "" },
  },
  { _id: true }
);

const orderGiftHamperGiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    image: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { _id: false }
);

const orderGiftHamperSchema = new mongoose.Schema(
  {
    minOrderAmount: { type: Number, required: true, min: 0 },
    gift: {
      type: orderGiftHamperGiftSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserBulkMart",
      default: null,
    },
    adminNote: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserBulkMart",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      validate: {
        validator(value) {
          return !value || /^\d{6}$/.test(value);
        },
        message: "Order number must be a 6-digit number",
      },
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator(v) {
          return v.length > 0;
        },
        message: "Order must have at least one item",
      },
    },
    deliveryAddress: {
      type: addressSnapshotSchema,
      required: true,
    },
    checkoutMode: { type: String, enum: ["cart", "buyNow"], default: "cart" },
    paymentMethod: {
      type: String,
      enum: ["cod", "online"],
      required: true,
    },
    subtotal: { type: Number, required: true },
    couponCode: { type: String, default: "", trim: true, uppercase: true },
    couponDiscount: { type: Number, default: 0, min: 0 },
    rewardPointsUsed: { type: Number, default: 0, min: 0 },
    rewardDiscount: { type: Number, default: 0, min: 0 },
    rewardPointsEarned: { type: Number, default: 0, min: 0 },
    giftCardCode: { type: String, default: "", trim: true, uppercase: true },
    giftCardDiscount: { type: Number, default: 0, min: 0 },
    deliveryCharges: { type: Number, default: 0 },
    heavyHandlingFee: { type: Number, default: 0, min: 0 },
    packagingFee: { type: Number, default: 0, min: 0 },
    bundleDiscount: { type: Number, default: 0, min: 0 },
    loyaltyDiscount: { type: Number, default: 0, min: 0 },
    dynamicDiscount: { type: Number, default: 0, min: 0 },
    freeAddon: { type: mongoose.Schema.Types.Mixed, default: null },
    dynamicPricingDetails: { type: mongoose.Schema.Types.Mixed, default: null },
    gstAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["attempted", "confirm", "processing", "shipping", "delivered", "cancelled", "return"],
      default: "confirm",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid_10", "paid", "refundable", "pending_verification"],
      default: "unpaid",
    },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    codAdvanceAmount: { type: Number, default: 0, min: 0 },
    razorpayPaidAmount: { type: Number, default: 0, min: 0 },
    codAdvanceRazorpayPaymentId: { type: String, default: "" },
    codAdvancePaidAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    /** Partial refunds owed for lines the dark store could not supply. */
    refunds: {
      type: [
        new mongoose.Schema(
          {
            amount: { type: Number, required: true, min: 0 },
            reason: { type: String, default: "", trim: true, maxlength: 300 },
            items: {
              type: [
                new mongoose.Schema(
                  { name: String, quantity: Number, amount: Number },
                  { _id: false }
                ),
              ],
              default: [],
            },
            storeOrderId: { type: mongoose.Schema.Types.ObjectId, default: null },
            status: { type: String, enum: ["pending", "refunded"], default: "pending" },
            createdAt: { type: Date, default: Date.now },
            refundedAt: { type: Date, default: null },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    /** Why the last dark-store routing attempt failed; empty once routed. */
    routingError: { type: String, default: "" },
    routingAttemptedAt: { type: Date, default: null },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    shipment: {
      type: new mongoose.Schema(
        {
          provider: { type: String, default: "" },
          carrier: { type: String, default: "" },
          service: { type: String, default: "" },
          shipmentId: { type: String, default: "" },
          trackingNumber: { type: String, default: "" },
          trackUrl: { type: String, default: "" },
          labelUrl: { type: String, default: "" },
          status: { type: String, default: "" },
          statusMessage: { type: String, default: "" },
          syncedAt: { type: Date, default: null },
          events: {
            type: [
              new mongoose.Schema(
                {
                  status: { type: String, default: "" },
                  date: { type: String, default: "" },
                  location: { type: String, default: "" },
                  description: { type: String, default: "" },
                },
                { _id: false }
              ),
            ],
            default: () => [],
          },
          note: { type: String, default: "", trim: true, maxlength: 500 },
          evidenceUrl: { type: String, default: "", trim: true, maxlength: 500 },
          evidenceName: { type: String, default: "", trim: true, maxlength: 200 },
          manualTracking: {
            type: new mongoose.Schema(
              {
                enabled: { type: Boolean, default: false },
                note: { type: String, default: "", trim: true, maxlength: 500 },
                evidenceUrl: { type: String, default: "", trim: true, maxlength: 500 },
                evidenceName: { type: String, default: "", trim: true, maxlength: 200 },
                updatedAt: { type: Date, default: null },
              },
              { _id: false }
            ),
            default: () => ({
              enabled: false,
              note: "",
              evidenceUrl: "",
              evidenceName: "",
              updatedAt: null,
            }),
          },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    giftHamper: {
      type: orderGiftHamperSchema,
      default: null,
    },
    /** 4-digit OTP shown to customer; driver must enter it to complete delivery */
    deliveryOtp: {
      type: String,
      default: "",
      trim: true,
      maxlength: 8,
    },
    /** Last time the delivery OTP was SMSed to the customer (resend cooldown). */
    deliveryOtpSmsSentAt: { type: Date, default: null },
    preOrderSlot: {
      type: String,
      default: "",
      trim: true,
    },
    /** Delivery day for pre-orders, YYYY-MM-DD in IST */
    preOrderDate: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    /** Pre-order part progress mirrored from the store order (awaiting_vendor, confirmed, at_store, …) */
    preOrderProgress: {
      type: String,
      default: "",
      trim: true,
    },
    /** Departments present in this order (preorder / ready2cook / instant) */
    departments: {
      type: [{ type: String, enum: DEPARTMENT_KEYS }],
      default: [],
      index: true,
    },
    /** Home delivery by a rider, or the customer collects it from the dark store */
    fulfillmentType: {
      type: String,
      enum: FULFILLMENT_TYPES,
      default: "delivery",
      index: true,
    },
    /** ready_to_cook | instant get live rider tracking; preorder gets status updates only */
    orderType: {
      type: String,
      enum: ORDER_TYPES,
      index: true,
    },
  },

  { timestamps: true }
);

function applyDeliveredPaymentRule(update) {
  if (!update) return;

  const $set = update.$set || update;
  if ($set.status === "delivered") {
    if (update.$set) {
      update.$set.paymentStatus = "paid";
    } else {
      update.paymentStatus = "paid";
    }
  }
}

orderSchema.pre("findOneAndUpdate", function setPaidOnDeliveredUpdate() {
  applyDeliveredPaymentRule(this.getUpdate());
});

/**
 * Stamp each line with its product's department (preorder / ready2cook / instant).
 * The pre-order slot only applies to the preorder lines of a mixed cart.
 */
async function stampDepartments(order) {
  const items = order.items || [];
  if (!items.length) return;
  const ids = items.map((item) => item.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: ids } })
    .select("section storeType departmentId")
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  for (const item of items) {
    const product = byId.get(String(item.product));
    item.department = sectionToDepartment(product?.section, product?.storeType);
    item.departmentId = product?.departmentId || item.departmentId || "";
  }
  order.departments = collectDepartments(items);
}

orderSchema.pre("save", async function preSaveOrder() {
  if (
    this.isModified("items") ||
    this.isModified("preOrderSlot") ||
    !this.departments?.length
  ) {
    await stampDepartments(this);
  }

  if (
    this.isNew ||
    this.isModified("items") ||
    this.isModified("preOrderSlot") ||
    this.isModified("departments")
  ) {
    this.orderType = deriveCustomerOrderType(this);
  }

  if (this.isModified("status") && this.status === "delivered") {
    this.paymentStatus = "paid";
  }

  if (
    this.isModified("status") &&
    (this.status === "cancelled" || this.status === "return") &&
    this.paymentMethod === "online" &&
    this.paymentStatus === "paid"
  ) {
    this.paymentStatus = "refundable";
  }

  // Once assigned, an order number is permanent, including legacy formats.
  if (String(this.orderNumber || "").trim()) return;

  const OrderModel = this.constructor;
  let orderNumber;
  let exists = true;

  while (exists) {
    orderNumber = String(Math.floor(100000 + Math.random() * 900000));
    exists = await OrderModel.exists({ orderNumber });
  }

  this.orderNumber = orderNumber;
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
