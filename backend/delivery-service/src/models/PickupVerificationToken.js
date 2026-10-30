import mongoose from "mongoose";

const pickupVerificationTokenSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreOrder",
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
      index: true,
    },
    darkStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
      index: true,
    },
    verificationToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenExpiresAt: { type: Date, required: true },
    /**
     * rider = QR in the rider app, only the store manager may scan it.
     * store = QR on the manager screen / printed bag label, only the rider may scan it.
     */
    issuedFor: { type: String, enum: ["rider", "store"], default: "rider" },
    used: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
    },
  },
  { timestamps: true }
);

const PickupVerificationToken =
  mongoose.models.PickupVerificationToken ||
  mongoose.model("PickupVerificationToken", pickupVerificationTokenSchema);

export default PickupVerificationToken;
