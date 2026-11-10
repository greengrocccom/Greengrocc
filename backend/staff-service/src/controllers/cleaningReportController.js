import mongoose from "mongoose";
import sharp from "sharp";
import Staff from "../models/Staff.js";
import CustomRole from "../models/CustomRole.js";
import CleaningReport from "../models/CleaningReport.js";

/** Matches cleaner, cleaning, cleaning staff, and similar role names. */
export function roleLooksLikeCleaner(...values) {
  return values.some((value) =>
    /\bclean(?:er|ers|ing)?\b/.test(String(value || "").toLowerCase().replace(/[_-]+/g, " "))
  );
}

export function isCleaner(staff, customRole) {
  return Boolean(
    staff &&
      staff.isActive !== false &&
      roleLooksLikeCleaner(staff.role, customRole?.roleKey, customRole?.displayName)
  );
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
    const { note, photoBase64, source, capturedAt: capturedAtRaw } = req.body;
    const uploadSource = String(source || "").trim().toLowerCase();
    if (typeof note !== "string" || !note.trim() || note.trim().length > 2000) {
      return res.status(400).json({ success: false, message: "A note of 1–2000 characters is required" });
    }
    if (uploadSource !== "camera" || typeof photoBase64 !== "string" ||
        !photoBase64.length || photoBase64.length > 7_000_000 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(photoBase64)) {
      return res.status(400).json({ success: false, message: "Take the cleaning photo with the in-app camera (maximum 5 MB)" });
    }
    const capturedAt = new Date(typeof capturedAtRaw === "string" ? capturedAtRaw : NaN);
    if (Number.isNaN(capturedAt.getTime())) {
      return res.status(400).json({ success: false, message: "Photo time is missing. Please update the staff app and take a new photo." });
    }
    const ageMs = Date.now() - capturedAt.getTime();
    if (ageMs < -5 * 60 * 1000 || ageMs > 6 * 60 * 60 * 1000) {
      return res.status(400).json({ success: false, message: "Photo time is wrong. Check your phone's date and time, then retake the photo." });
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
    // Reporting day follows the photo's capture time in the company's timezone.
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(capturedAt);
    const report = await CleaningReport.create({ staffId: req.user.id, date, note: note.trim(), capturedAt, photo });
    return res.status(201).json({ success: true, data: {
      _id: report.id, date: report.date, note: report.note, capturedAt: report.capturedAt, createdAt: report.createdAt,
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

async function cleanerDirectory() {
  const [people, roles] = await Promise.all([
    Staff.find().select("name phone email role isActive").lean(),
    CustomRole.find().select("roleKey displayName").lean(),
  ]);
  const byKey = new Map(roles.map((role) => [role.roleKey, role]));
  return people
    .filter((person) => isCleaner(person, byKey.get(person.role)))
    .map((person) => ({
      id: person._id.toString(),
      name: person.name || "Cleaner",
      phone: person.phone || "",
      email: person.email || "",
      role: person.role,
      roleLabel: byKey.get(person.role)?.displayName || String(person.role || "").replace(/_/g, " "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function buildCleaningGallery({ date = "", staffId = "" } = {}) {
  const cleaners = await cleanerDirectory();
  const filter = {};
  if (date) filter.date = date;
  if (staffId) filter.staffId = staffId;
  const rows = await CleaningReport.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(date ? 500 : 400)
    .populate("staffId", "name phone email role")
    .lean();

  const reports = rows.map((row) => {
    const staff = row.staffId && typeof row.staffId === "object" ? row.staffId : null;
    return {
      id: row._id.toString(),
      date: row.date,
      note: row.note,
      capturedAt: row.capturedAt || null,
      createdAt: row.createdAt,
      staff: {
        id: staff?._id?.toString() || String(row.staffId || ""),
        name: staff?.name || "Unknown",
        phone: staff?.phone || "",
        email: staff?.email || "",
        role: staff?.role || "",
      },
    };
  });

  return { cleaners, reports };
}

export async function listCleaningReports(req, res, next) {
  try {
    const gallery = await buildCleaningGallery();
    return res.json({ success: true, data: gallery.reports });
  } catch (error) { next(error); }
}

export async function listCleaningReportsForAdmin(req, res, next) {
  try {
    const date = String(req.query.date || "").trim();
    const staffId = String(req.query.staffId || "").trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Date must be YYYY-MM-DD" });
    }
    if (staffId && !mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({ success: false, message: "Invalid staff member" });
    }
    const gallery = await buildCleaningGallery({ date, staffId });
    return res.json({ success: true, data: gallery });
  } catch (error) { next(error); }
}

export async function getCleaningReportPhotoForAdmin(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    const report = await CleaningReport.findById(req.params.id).select("+photo");
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    res.set("Cache-Control", "private, max-age=3600");
    return res.type("jpeg").send(report.photo);
  } catch (error) { next(error); }
}
