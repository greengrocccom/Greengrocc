import mongoose from "mongoose";

const deliveryExpenseSchema = new mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
      index: true,
    },
    expenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Delivery Expenses",
        "Store Expenses",
        "Packaging Expenses",
        "Technology Expenses",
        "Other Expenses",
      ],
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount must be positive"],
    },
    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null,
      index: true,
    },
    riderName: {
      type: String,
      trim: true,
      default: "",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreOrder",
      default: null,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "BANK_TRANSFER", "CARD", "PETTY_CASH", "OTHER"],
      default: "CASH",
    },
    paidBy: {
      type: String,
      trim: true,
      default: "",
    },
    payee: {
      type: String,
      trim: true,
      default: "",
    },
    receiptUrl: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Paid"],
      default: "Approved",
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
    },
    approvedByName: {
      type: String,
      trim: true,
      default: "",
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

deliveryExpenseSchema.index({ managerId: 1, expenseDate: -1 });
deliveryExpenseSchema.index({ managerId: 1, category: 1, status: 1 });

if (mongoose.models.DeliveryExpense) {
  delete mongoose.models.DeliveryExpense;
}

const DeliveryExpense = mongoose.model("DeliveryExpense", deliveryExpenseSchema);

export default DeliveryExpense;

