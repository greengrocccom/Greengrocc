import mongoose from "mongoose";

export const VENDOR_SETTLEMENT_TYPES = [
  "farmer_vendor",
  "delivery_manager",
  "admin_commission",
  "vendor_operational",
  "other",
];

export const VENDOR_SETTLEMENT_STATUSES = [
  "Pending",
  "Processing",
  "Partially Paid",
  "Paid",
  "Failed",
  "Cancelled",
];

const vendorSettlementSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    settlementNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    settlementType: {
      type: String,
      required: true,
      enum: VENDOR_SETTLEMENT_TYPES,
      default: "farmer_vendor",
      index: true,
    },
    entityId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    entityName: {
      type: String,
      required: true,
      trim: true,
    },
    period: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    commission: {
      type: Number,
      default: 0,
      min: 0,
    },
    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalPayable: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["Bank Transfer", "UPI", "NEFT/RTGS", "Cash", "Cheque", "Other"],
      default: "Bank Transfer",
    },
    transactionReference: {
      type: String,
      default: "",
      trim: true,
    },
    settlementDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: VENDOR_SETTLEMENT_STATUSES,
      default: "Pending",
      index: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    approvedBy: {
      type: String,
      default: "",
      trim: true,
    },
    history: [
      {
        amount: Number,
        paidAt: { type: Date, default: Date.now },
        reference: String,
        method: String,
        notes: String,
      },
    ],
  },
  { timestamps: true }
);

vendorSettlementSchema.index({ vendorId: 1, settlementType: 1, status: 1 });
vendorSettlementSchema.index({ vendorId: 1, entityId: 1, "period.from": 1, "period.to": 1 });

export const VendorSettlement =
  mongoose.models.VendorSettlement ||
  mongoose.model("VendorSettlement", vendorSettlementSchema);

export default VendorSettlement;

