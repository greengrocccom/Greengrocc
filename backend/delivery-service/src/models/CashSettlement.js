/**
 * CashSettlement
 *
 * Tracks cash collected from customers by a delivery rider on a per-order basis.
 *
 * Lifecycle:
 *   PENDING   → rider collected cash; owes it to the Dark Store
 *   SUBMITTED → rider has physically brought cash to the store (optional intermediate state)
 *   COMPLETED → Dark Store manager has confirmed physical receipt of the cash
 *   DISPUTED  → there is a mismatch that needs manual resolution
 *
 * Cash is a LIABILITY (rider owes money to the store).
 * It is NOT the rider's delivery earning.
 */
import mongoose from "mongoose";

const cashSettlementSchema = new mongoose.Schema(
  {
    darkStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
    },
    /** Null when an order was closed manually without a rider — the store itself holds the cash. */
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreOrder",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      default: "",
    },
    /** Amount of cash collected from the customer for this order */
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUBMITTED", "COMPLETED", "DISPUTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    /** When the rider confirmed cash collection from the customer */
    collectedAt: { type: Date, default: Date.now },
    /** When the rider marked cash as submitted at the store */
    submittedAt: { type: Date },
    /** When the Dark Store manager confirmed receipt */
    confirmedAt: { type: Date },
    /** Manager who confirmed the receipt */
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

cashSettlementSchema.index({ darkStoreId: 1, riderId: 1, status: 1 });
cashSettlementSchema.index({ riderId: 1, status: 1, createdAt: -1 });

cashSettlementSchema.methods.toSafeJSON = function () {
  return {
    id: this._id.toString(),
    darkStoreId: this.darkStoreId.toString(),
    riderId: this.riderId ? this.riderId.toString() : null,
    orderId: this.orderId.toString(),
    orderNumber: this.orderNumber || "",
    amount: this.amount,
    status: this.status,
    collectedAt: this.collectedAt,
    submittedAt: this.submittedAt,
    confirmedAt: this.confirmedAt,
    confirmedBy: this.confirmedBy ? this.confirmedBy.toString() : null,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

if (mongoose.models.CashSettlement) {
  delete mongoose.models.CashSettlement;
}

const CashSettlement = mongoose.model("CashSettlement", cashSettlementSchema);

export default CashSettlement;
