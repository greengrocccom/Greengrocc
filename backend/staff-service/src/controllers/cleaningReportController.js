import sharp from "sharp";
import Staff from "../models/Staff.js";
import CustomRole from "../models/CustomRole.js";
import CleaningReport from "../models/CleaningReport.js";

export function isCleaner(staff, customRole) {
  const normalize = (value) => String(value || "").trim().toLowerCase();
  return Boolean(staff && staff.isActive !== false && (
    normalize(staff.role) === "cleaner" ||
    (customRole?.isActive !== false && normalize(customRole?.displayName) === "cleaner")
  ));
}

async function eligibleStaff(id) {
  const staff = await Staff.findById(id).lean();
  const role = staff ? await CustomRole.findOne({ roleKey: staff.role }).lean() : null;
  return isCleaner(staff, role);
}

export async function listMyCleaningReports(req, res, next) {
  try {
    const eligible = await eligibleStaff(req.user.id);
    const reports = eligible ? await CleaningReport.find({ staffId: req.user.id })
      .sort({ createdAt: -1 }).limit(30).lean() : [];
    return res.json({ success: true, data: { eligible, reports } });
  } catch (error) { next(error); }
}

export async function submitCleaningReport(req, res, next) {
  try {
    if (!await eligibleStaff(req.user.id)) {
      return res.status(403).json({ success: false, message: "An active cleaner account is required" });
    }
    const { note, photoBase64, source } = req.body;
    if (typeof note !== "string" || !note.trim() || note.trim().length > 2000) {
      return res.status(400).json({ success: false, message: "A note of 1–2000 characters is required" });
    }
    if (source !== "camera" || typeof photoBase64 !== "string" ||
        !photoBase64.length || photoBase64.length > 7_000_000 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(photoBase64)) {
      return res.status(400).json({ success: false, message: "Take a photo with the phone camera (maximum 5 MB)" });
    }
    let photo;
    try {
      const bytes = Buffer.from(photoBase64, "base64");
      if (bytes.length > 5 * 1024 * 1024) throw new Error("Photo too large");
      photo = await sharp(bytes, { limitInputPixels: 25_000_000, failOn: "error" })
        .rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 }).toBuffer();
    } catch {
      return res.status(400).json({ success: false, message: "The photo is invalid or too large. Please take another photo." });
    }
    // Assign the reporting day on the server in the company's timezone.
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const report = await CleaningReport.create({ staffId: req.user.id, date, note: note.trim(), photo });
    return res.status(201).json({ success: true, data: {
      _id: report.id, date: report.date, note: report.note, createdAt: report.createdAt,
    } });
  } catch (error) { next(error); }
}

export async function getCleaningReportPhoto(req, res, next) {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role !== "admin") filter.staffId = req.user.id;
    const report = await CleaningReport.findOne(filter).select("+photo");
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    res.set("Cache-Control", "private, no-store");
    return res.type("jpeg").send(report.photo);
  } catch (error) { next(error); }
}

export async function listCleaningReports(req, res, next) {
  try {
    const reports = await CleaningReport.find().sort({ createdAt: -1 }).limit(100)
      .populate("staffId", "name role").lean();
    return res.json({ success: true, data: reports });
  } catch (error) { next(error); }
}
