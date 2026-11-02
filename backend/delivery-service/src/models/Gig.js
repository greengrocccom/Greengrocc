import mongoose from "mongoose";

const tierSchema = new mongoose.Schema(
  {
    minTarget: {
      type: Number,
      required: true,
    },
    bonusAmount: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const gigSchema = new mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
      index: true,
    },
    storeId: {
      type: String,
      default: "",
    },
    area: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      required: [true, "Gig title is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["hours_bonus", "earnings_target", "custom"],
      default: "hours_bonus",
    },
    dateString: {
      type: String,
      required: true,
      index: true, // "YYYY-MM-DD" e.g. "2026-08-18"
    },
    startTime: {
      type: String,
      default: "06:00 PM",
    },
    endTime: {
      type: String,
      default: "10:00 PM",
    },
    targetHours: {
      type: Number,
      default: 3,
    },
    targetEarnings: {
      type: Number,
      default: 500,
    },
    bonusAmount: {
      type: Number,
      default: 100,
    },
    tierMetric: {
      type: String,
      enum: ["orders", "earnings"],
      default: "orders",
    },
    tiers: [tierSchema],
    description: {
      type: String,
      default: "",
    },
    targetAudience: {
      type: String,
      enum: ["all", "top_performers", "specific"],
      default: "all",
    },
    eligibleRiderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryBoy",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

gigSchema.index({ managerId: 1, dateString: 1 });

gigSchema.methods.toSafeJSON = function toSafeJSON() {
  const safeTiers = (this.tiers || []).map((t) => ({
    minTarget: Number(t.minTarget) || 0,
    bonusAmount: Number(t.bonusAmount) || 0,
  }));

  const maxBonus = safeTiers.length > 0 
    ? Math.max(...safeTiers.map((t) => t.bonusAmount))
    : this.bonusAmount;

  return {
    id: this._id.toString(),
    gigId: this._id.toString(),
    managerId: this.managerId.toString(),
    storeId: this.storeId || this.managerId.toString(),
    area: this.area,
    title: this.title,
    type: this.type,
    dateString: this.dateString,
    startTime: this.startTime,
    endTime: this.endTime,
    targetHours: this.targetHours,
    targetEarnings: this.targetEarnings,
    bonusAmount: maxBonus || this.bonusAmount,
    tierMetric: this.tierMetric || "orders",
    tiers: safeTiers,
    targetAudience: this.targetAudience || "all",
    eligibleRiderIds: (this.eligibleRiderIds || []).map((id) => (id?._id || id).toString()),
    description: this.description,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

if (mongoose.models.Gig) {
  delete mongoose.models.Gig;
}

const Gig = mongoose.model("Gig", gigSchema);

export default Gig;
