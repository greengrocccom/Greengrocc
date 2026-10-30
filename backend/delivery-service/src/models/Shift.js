import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
    },
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
    },
    deliveryPartnerPhone: {
      type: String,
      default: "",
    },
    deliveryPartnerName: {
      type: String,
      default: "",
    },
    deliveryPartnerProfileImage: {
      type: String,
      default: "",
    },
    bookedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"],
      default: "UPCOMING",
    },
    notificationEnabled: {
      type: Boolean,
      default: false,
    },
    notificationTimeMinutes: {
      type: Number,
      default: 15,
    },
    onlineAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    /** Set when "shift started" push was sent (avoid duplicate FCM). */
    shiftStartNotifiedAt: {
      type: Date,
      default: null,
    },
    /** Set when pre-shift reminder push was sent. */
    shiftReminderNotifiedAt: {
      type: Date,
      default: null,
    },
    /** Who put the rider on this slot: the rider (legacy self-booking), a manager or admin. */
    assignedBy: {
      type: String,
      enum: ["rider", "manager", "admin"],
      default: "rider",
    },
    /** Per-hour slot incentive has been paid for online time up to this moment. */
    hourIncentivePaidUntil: {
      type: Date,
      default: null,
    },
    /** Delivered km counted for the per-km incentive in this slot. */
    kmDelivered: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: true, timestamps: true }
);

const slotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true, // e.g. "09:00 AM"
    },
    endTime: {
      type: String,
      required: true, // e.g. "11:00 AM"
    },
    capacity: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
    },
    bookedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["AVAILABLE", "FEW_SPOTS_LEFT", "FULL", "CANCELLED"],
      default: "AVAILABLE",
    },
    /** Extra pay on top of order earnings: per km delivered, or per hour online in the slot. */
    incentiveMode: {
      type: String,
      enum: ["none", "per_km", "per_hour"],
      default: "none",
    },
    incentiveRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** per_km only: km a rider must deliver in this slot before each further km is paid. 0 = from the first km. */
    incentiveAfterKm: {
      type: Number,
      default: 0,
      min: 0,
    },
    bookings: [bookingSchema],
  },
  { _id: true, timestamps: true }
);

const shiftSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: [true, "Shift name is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "early_morning",
        "morning",
        "afternoon",
        "evening",
        "night",
        "late_night",
        "custom",
      ],
      default: "morning",
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    dateString: {
      type: String,
      required: true,
      index: true, // "YYYY-MM-DD" e.g. "2026-08-12"
    },
    slots: [slotSchema],

    /**
     * KM-based delivery earning slabs configured by the Dark Store manager.
     * Example: [{ minKm: 0, maxKm: 2, riderAmount: 30 }, ...]
     * The backend always uses these values — Flutter must never submit an earning amount.
     */
    deliveryEarningSlabs: {
      type: [
        {
          minKm: { type: Number, required: true, min: 0 },
          maxKm: { type: Number, required: true, min: 0 },
          riderAmount: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
      validate: {
        validator: function (slabs) {
          for (let i = 0; i < slabs.length; i++) {
            if (slabs[i].maxKm <= slabs[i].minKm) return false;
            for (let j = i + 1; j < slabs.length; j++) {
              // overlap check: [a.min, a.max) overlaps [b.min, b.max)
              if (slabs[i].minKm < slabs[j].maxKm && slabs[i].maxKm > slabs[j].minKm) return false;
            }
          }
          return true;
        },
        message: "Delivery earning slabs must not overlap and maxKm must be greater than minKm",
      },
    },

    isCustomized: {
      type: Boolean,
      default: false,
    },
    /** Slot pay is a salary (no per-order KM slabs) when set; monthlySalary is its monthly equivalent. */
    monthlySalary: {
      type: Number,
      default: null,
      min: 0,
    },
    salaryAmount: { type: Number, default: null, min: 0 },
    salaryPeriod: { type: String, enum: ["day", "week", "month"], default: "month" },
    shiftCategory: {
      type: String,
      enum: ['PART_TIME', 'FULL_TIME'],
      default: 'PART_TIME',
    },
  },
  { timestamps: true }
);

shiftSchema.index({ managerId: 1, dateString: 1 });
shiftSchema.index({ "slots.bookings.deliveryPartnerId": 1, dateString: 1 });

shiftSchema.methods.toSafeJSON = function toSafeJSON() {
  const safeSlots = (this.slots || []).map((slot) => {
    const remaining = Math.max(0, slot.capacity - slot.bookedCount);
    let computedStatus = slot.status;

    if (slot.status !== "CANCELLED") {
      if (remaining === 0) {
        computedStatus = "FULL";
      } else if (remaining <= 3) {
        computedStatus = "FEW_SPOTS_LEFT";
      } else {
        computedStatus = "AVAILABLE";
      }
    }

    const safeBookings = (slot.bookings || []).map((b) => ({
      bookingId: b._id ? b._id.toString() : b.bookingId,
      deliveryPartnerId: b.deliveryPartnerId ? b.deliveryPartnerId.toString() : "",
      deliveryPartnerPhone: b.deliveryPartnerPhone,
      deliveryPartnerName: b.deliveryPartnerName,
      deliveryPartnerProfileImage: b.deliveryPartnerProfileImage,
      bookedAt: b.bookedAt,
      status: b.status,
      notificationEnabled: b.notificationEnabled,
      notificationTimeMinutes: b.notificationTimeMinutes,
      assignedBy: b.assignedBy || "rider",
      kmDelivered: b.kmDelivered || 0,
    }));

    return {
      id: slot._id.toString(),
      slotId: slot._id.toString(),
      shiftId: this._id.toString(),
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      bookedCount: slot.bookedCount,
      remainingCapacity: remaining,
      spotsRemaining: remaining,
      status: computedStatus,
      incentiveMode: slot.incentiveMode || "none",
      incentiveRate: slot.incentiveRate || 0,
      incentiveAfterKm: slot.incentiveAfterKm || 0,
      bookingsCount: safeBookings.length,
      bookings: safeBookings,
    };
  });

  const totalBooked = safeSlots.reduce((acc, s) => acc + s.bookedCount, 0);
  const totalCapacity = safeSlots.reduce((acc, s) => acc + s.capacity, 0);

  return {
    id: this._id.toString(),
    shiftId: this._id.toString(),
    managerId: this.managerId.toString(),
    storeId: this.storeId || this.managerId.toString(),
    name: this.name,
    shiftName: this.name,
    type: this.type,
    shiftType: this.type,
    date: this.date,
    dateString: this.dateString,
    slotsCount: safeSlots.length,
    slots: safeSlots,
    totalBooked,
    totalCapacity,
    isCustomized: this.isCustomized,
    monthlySalary: this.monthlySalary ?? null,
    salaryAmount: this.salaryAmount ?? this.monthlySalary ?? null,
    salaryPeriod: this.salaryAmount != null ? this.salaryPeriod || "month" : "month",
    shiftCategory: this.shiftCategory || 'PART_TIME',
    deliveryEarningSlabs: (this.deliveryEarningSlabs || []).map((s) => ({
      id: s._id ? s._id.toString() : undefined,
      minKm: s.minKm,
      maxKm: s.maxKm,
      riderAmount: s.riderAmount,
    })),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

if (mongoose.models.Shift) {
  delete mongoose.models.Shift;
}

const Shift = mongoose.model("Shift", shiftSchema);

export default Shift;
