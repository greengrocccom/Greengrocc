import mongoose from "mongoose";

const schema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true, index: true },
  message: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, enum: ["pending", "completed", "rejected"], default: "pending", index: true },
  adminReply: { type: String, trim: true, maxlength: 1000, default: "" },
  // Shown only to the requesting staff member so they can log in with it.
  newPassword: { type: String, select: false },
  resolvedAt: { type: Date },
  resolvedBy: { type: String, trim: true, default: "" },
}, { timestamps: true });
schema.index({ status: 1, createdAt: -1 });

export default mongoose.models.PasswordChangeRequest || mongoose.model("PasswordChangeRequest", schema);
