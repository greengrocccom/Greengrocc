import mongoose from "mongoose";

export const VENDOR_EXPENSE_CATEGORIES = [
  // Farmer Vendor Expenses
  "Procurement Handling",
  "Farmer Transport",
  "Loading/Unloading",
  "Supply Expenses",
  // Vendor Business Expenses
  "Staff Salary",
  "Office Rent",
  "Electricity",
  "Internet",
  "Maintenance",
  "Packaging",
  "Transportation",
  "Marketing",
  "Operational Expenses",
  "Technology Expenses",
  "Other Expenses",
];

export const VENDOR_EXPENSE_STATUSES = ["Pending", "Approved", "Rejected", "Paid"];

const vendorExpenseSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      required: true,
      index: true,
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
      enum: VENDOR_EXPENSE_CATEGORIES,
      default: "Operational Expenses",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    expenseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    farmerVendorId: {
      type: String,
      default: "",
      trim: true,
    },
    deliveryManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
    },
    orderId: {
      type: String,
      default: "",
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["Bank Transfer", "UPI", "Cash", "Cheque", "Other"],
      default: "Bank Transfer",
    },
    paidBy: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    receiptUrl: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: VENDOR_EXPENSE_STATUSES,
      default: "Approved",
      index: true,
    },
    approvedBy: {
      type: String,
      default: "",
      trim: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

vendorExpenseSchema.index({ vendorId: 1, expenseDate: -1 });
vendorExpenseSchema.index({ vendorId: 1, category: 1, status: 1 });

export const VendorExpense =
  mongoose.models.VendorExpense || mongoose.model("VendorExpense", vendorExpenseSchema);

export default VendorExpense;

