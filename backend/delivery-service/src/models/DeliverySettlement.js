import mongoose from "mongoose";

const deliverySettlementSchema = new mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
      index: true,
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
      enum: [
        "RIDER_PAYOUT",
        "VENDOR_SETTLEMENT",
        "FARMER_VENDOR_SETTLEMENT",
        "ADMIN_SETTLEMENT",
        "OPERATIONAL_PAYMENT",
      ],
      index: true,
    },
    entityName: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    ordersCount: {
      type: Number,
      default: 0,
    },
    grossAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    incentives: {
      type: Number,
      default: 0,
    },
    allowances: {
      type: Number,
      default: 0,
    },
    deductions: {
      type: Number,
      default: 0,
    },
    advances: {
      type: Number,
      default: 0,
    },
    finalPayable: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["BANK_TRANSFER", "UPI", "CASH", "WALLET", "OTHER"],
      default: "BANK_TRANSFER",
    },
    transactionReference: {
      type: String,
      trim: true,
      default: "",
    },
    settlementDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Partially Paid", "Paid", "Failed", "Cancelled"],
      default: "Pending",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
    },
    processedByName: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

deliverySettlementSchema.index({ managerId: 1, settlementDate: -1 });
deliverySettlementSchema.index({ managerId: 1, settlementType: 1, status: 1 });

if (mongoose.models.DeliverySettlement) {
  delete mongoose.models.DeliverySettlement;
}

const DeliverySettlement = mongoose.model("DeliverySettlement", deliverySettlementSchema);

export default DeliverySettlement;

