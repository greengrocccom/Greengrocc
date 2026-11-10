import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import Staff from "../staff-service/src/models/Staff.js";
import CustomRole from "../staff-service/src/models/CustomRole.js";
import CleaningReport from "../staff-service/src/models/CleaningReport.js";
import { isCleaner, submitCleaningReport, listMyCleaningReports, getCleaningReportPhoto } from "../staff-service/src/controllers/cleaningReportController.js";

const staff = { _id: "507f1f77bcf86cd799439011", role: "cleaner", isActive: true };
const req = (body = {}) => ({ user: { id: staff._id, role: "cleaner" }, body });
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; } };
}
const fail = (error) => { throw error; };
const originals = { staff: Staff.findById, role: CustomRole.findOne, create: CleaningReport.create,
  find: CleaningReport.find, findOne: CleaningReport.findOne };
Staff.findById = () => ({ lean: async () => staff });
CustomRole.findOne = () => ({ lean: async () => null });

try {
  await test("cleaner eligibility uses live role and active status", () => {
    assert.equal(isCleaner(staff), true);
    assert.equal(isCleaner({ ...staff, isActive: false }), false);
    assert.equal(isCleaner({ ...staff, role: "vendor" }), false);
    assert.equal(isCleaner({ ...staff, role: "custom_cleaning" }, { displayName: "Cleaner", isActive: true }), true);
    assert.equal(isCleaner({ ...staff, role: "custom_cleaning" }, { displayName: "Cleaner", isActive: false }), false);
  });
  await test("empty and whitespace notes are rejected", async () => {
    for (const note of [undefined, "", "   ", "x".repeat(2001)]) {
      const res = response();
      await submitCleaningReport(req({ note }), res, fail);
      assert.equal(res.statusCode, 400);
    }
  });
  await test("missing, gallery, malformed and oversized photos are rejected", async () => {
    for (const photo of [{}, { source: "gallery", photoBase64: "YWJj" },
      { source: "camera", photoBase64: "not an image" },
      { source: "camera", photoBase64: "YWJj" },
      { source: "camera", photoBase64: "A".repeat(7_000_001) }]) {
      const res = response();
      await submitCleaningReport(req({ note: "Floor cleaned", ...photo }), res, fail);
      assert.equal(res.statusCode, 400);
    }
  });
  await test("gallery uploads and missing or out-of-range capture times are rejected", async () => {
    const photo = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer()).toString("base64");
    const now = Date.now();
    for (const body of [
      { source: "gallery", capturedAt: new Date(now).toISOString() },
      { source: "camera" },
      { source: "camera", capturedAt: "not a date" },
      { source: "camera", capturedAt: new Date(now + 10 * 60 * 1000).toISOString() },
      { source: "camera", capturedAt: new Date(now - 7 * 60 * 60 * 1000).toISOString() },
    ]) {
      const res = response();
      await submitCleaningReport(req({ note: "Floor cleaned", photoBase64: photo, ...body }), res, fail);
      assert.equal(res.statusCode, 400);
    }
  });
  await test("non-cleaners cannot submit and receive no report history", async () => {
    staff.role = "vendor";
    const res = response();
    await submitCleaningReport(req({ note: "Cleaned" }), res, fail);
    assert.equal(res.statusCode, 403);
    const history = response();
    await listMyCleaningReports(req(), history, fail);
    assert.deepEqual(history.body.data, { eligible: false, reports: [] });
    staff.role = "cleaner";
  });
  await test("valid report is saved against authenticated staff with capture time and normalized JPEG", async () => {
    const photo = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
    const capturedAt = new Date(Date.now() - 60 * 1000);
    let saved;
    CleaningReport.create = async (data) => { saved = data; return { ...data, id: "report-id", createdAt: new Date() }; };
    const res = response();
    await submitCleaningReport(req({ note: "  Floor cleaned  ", photoBase64: photo.toString("base64"), source: "camera", capturedAt: capturedAt.toISOString(), staffId: "someone-else", date: "2000-01-01" }), res, fail);
    assert.equal(res.statusCode, 201);
    assert.equal(saved.staffId, staff._id);
    assert.equal(saved.note, "Floor cleaned");
    assert.equal(saved.capturedAt.getTime(), capturedAt.getTime());
    assert.equal(saved.date, new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(capturedAt));
    assert.equal((await sharp(saved.photo).metadata()).format, "jpeg");
    assert.equal(res.body.data.photo, undefined);
  });
  await test("history query is restricted to authenticated staff", async () => {
    CleaningReport.find = (filter) => {
      assert.deepEqual(filter, { staffId: staff._id });
      return { sort: () => ({ limit: () => ({ lean: async () => [] }) }) };
    };
    await listMyCleaningReports(req(), response(), fail);
  });
  await test("photo cannot be read by another staff member", async () => {
    CleaningReport.findOne = (filter) => {
      assert.equal(filter.staffId, staff._id);
      return { select: async () => null };
    };
    const res = response();
    await getCleaningReportPhoto({ ...req(), params: { id: "other-report" } }, res, fail);
    assert.equal(res.statusCode, 404);
  });
} finally {
  Staff.findById = originals.staff;
  CustomRole.findOne = originals.role;
  CleaningReport.create = originals.create;
  CleaningReport.find = originals.find;
  CleaningReport.findOne = originals.findOne;
}
