import mongoose from "mongoose";

const fullTimeRuleSchema = new mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
      index: true,
    },
    ruleName: {
      type: String,
      trim: true,
      default: "Standard Full-Time Rule",
    },
    attendanceStartTime: {
      type: String,
      default: "09:00 AM",
    },
    attendanceEndTime: {
      type: String,
      default: "06:00 PM",
    },
    requireLocationValidation: {
      type: Boolean,
      default: true,
    },
    attendanceRadiusMeters: {
      type: Number,
      default: 200,
    },
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5, 6],
    },
    minimumAttendanceDays: {
      type: Number,
      default: 26,
    },
    compulsoryDailyOnlineHours: {
      type: Number,
      default: 8,
      min: 1,
      max: 24,
    },
    requireCompulsoryOnlineHours: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      default: "",
    },
    /** Manager-defined operational rules shown to Full-Time drivers as-is. */
    customRules: {
      type: [
        {
          title: { type: String, trim: true, required: true },
          description: { type: String, trim: true, default: "" },
        },
      ],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

if (mongoose.models.FullTimeRule) {
  delete mongoose.models.FullTimeRule;
}

const FullTimeRule = mongoose.model("FullTimeRule", fullTimeRuleSchema);
export default FullTimeRule;
