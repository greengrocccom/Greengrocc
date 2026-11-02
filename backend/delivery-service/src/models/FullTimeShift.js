import mongoose from "mongoose";

/**
 * Recurring Full-Time shift template (e.g. Mon–Sat 09:00 AM – 06:00 PM).
 * Kept separate from the date-wise Part-Time `Shift` collection so Part-Time
 * slot booking, earnings and auto-offline logic never see these documents.
 */
const fullTimeShiftSchema = new mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Shift name is required"],
      trim: true,
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    /** 0 = Sunday … 6 = Saturday */
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5, 6],
    },
    requireAttendance: { type: Boolean, default: true },
    compulsoryDailyOnlineHours: { type: Number, default: null, min: 1, max: 24 },
    requireLocationValidation: { type: Boolean, default: true },
    /** Falls back to the active Full-Time rule radius when null. */
    attendanceRadiusMeters: { type: Number, default: null, min: 10 },
    driverIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryBoy",
      },
    ],
    notes: { type: String, trim: true, default: "" },

    /** Salary for drivers on this shift; a driver's own override still wins. null = store default. */
    monthlySalary: { type: Number, default: null, min: 0 },

    /** Optional leave policy. Absent working days beyond the paid quota are deducted. */
    leavePolicyEnabled: { type: Boolean, default: false },
    paidLeavesPerMonth: { type: Number, default: 0, min: 0, max: 31 },
    /** null = salary ÷ scheduled working days in that month. */
    unpaidLeaveDeductionPerDay: { type: Number, default: null, min: 0 },

    /** Optional late penalty: marking attendance this many minutes after start time deducts the amount. */
    latePenaltyEnabled: { type: Boolean, default: false },
    lateAfterMinutes: { type: Number, default: 120, min: 1, max: 1440 },
    latePenaltyAmount: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

fullTimeShiftSchema.index({ managerId: 1, driverIds: 1 });

if (mongoose.models.FullTimeShift) {
  delete mongoose.models.FullTimeShift;
}

const FullTimeShift = mongoose.model("FullTimeShift", fullTimeShiftSchema);
export default FullTimeShift;
