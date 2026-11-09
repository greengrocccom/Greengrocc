import mongoose from "mongoose";

const schema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
  date: { type: String, required: true },
  note: { type: String, required: true, trim: true, maxlength: 2000 },
  photo: { type: Buffer, required: true, select: false },
}, { timestamps: true });
schema.index({ staffId: 1, createdAt: -1 });

export default mongoose.models.CleaningReport || mongoose.model("CleaningReport", schema);
