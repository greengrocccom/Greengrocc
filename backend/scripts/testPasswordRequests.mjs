import test from "node:test";
import assert from "node:assert/strict";
import Staff from "../staff-service/src/models/Staff.js";
import StaffNotification from "../staff-service/src/models/StaffNotification.js";
import PasswordChangeRequest from "../staff-service/src/models/PasswordChangeRequest.js";
import {
  createMyPasswordRequest,
  resolvePasswordRequest,
  rejectPasswordRequest,
} from "../staff-service/src/controllers/passwordRequestController.js";

const staffId = "507f1f77bcf86cd799439011";
const requestId = "507f1f77bcf86cd799439022";
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; } };
}
const fail = (error) => { throw error; };
const originals = {
  findById: Staff.findById, exists: PasswordChangeRequest.exists, create: PasswordChangeRequest.create,
  requestFindById: PasswordChangeRequest.findById, notify: StaffNotification.create,
};
const notifications = [];
StaffNotification.create = async (data) => { notifications.push(data); return data; };

try {
  await test("staff cannot open a second request while one is pending", async () => {
    Staff.findById = () => ({ select: () => ({ lean: async () => ({ _id: staffId, isActive: true }) }) });
    PasswordChangeRequest.exists = async () => true;
    const res = response();
    await createMyPasswordRequest({ user: { id: staffId }, body: { message: "Forgot it" } }, res, fail);
    assert.equal(res.statusCode, 409);
  });

  await test("staff request is saved against the logged-in staff member", async () => {
    PasswordChangeRequest.exists = async () => false;
    let saved;
    PasswordChangeRequest.create = async (data) => { saved = data; return { _id: requestId, status: "pending", ...data }; };
    const res = response();
    await createMyPasswordRequest({ user: { id: staffId }, body: { message: "  Forgot it  ", staffId: "someone-else" } }, res, fail);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(saved, { staffId, message: "Forgot it" });
  });

  await test("admin resolve sets the staff password, stores the reply and notifies without the password", async () => {
    const staff = { name: "Ravi", password: "old", save: async () => {} };
    const request = { id: requestId, staffId, status: "pending", save: async () => {} };
    Staff.findById = async () => staff;
    PasswordChangeRequest.findById = async () => request;
    const res = response();
    await resolvePasswordRequest({ params: { id: requestId }, user: { name: "Admin" }, body: { newPassword: "NewPass@1", reply: "Done" } }, res, fail);
    assert.equal(res.statusCode, 200);
    assert.equal(staff.password, "NewPass@1");
    assert.equal(request.status, "completed");
    assert.equal(request.newPassword, "NewPass@1");
    assert.equal(request.adminReply, "Done");
    const sent = notifications.at(-1);
    assert.equal(sent.targetStaffId, staffId);
    assert.equal(sent.message.includes("NewPass@1"), false);
  });

  await test("answered requests cannot be answered again and short passwords are rejected", async () => {
    PasswordChangeRequest.findById = async () => ({ status: "completed" });
    const again = response();
    await resolvePasswordRequest({ params: { id: requestId }, body: { newPassword: "Another@1" } }, again, fail);
    assert.equal(again.statusCode, 409);
    const short = response();
    await resolvePasswordRequest({ params: { id: requestId }, body: { newPassword: "123" } }, short, fail);
    assert.equal(short.statusCode, 400);
  });

  await test("reject requires a reply", async () => {
    const res = response();
    await rejectPasswordRequest({ params: { id: requestId }, body: { reply: "  " } }, res, fail);
    assert.equal(res.statusCode, 400);
  });
} finally {
  Staff.findById = originals.findById;
  PasswordChangeRequest.exists = originals.exists;
  PasswordChangeRequest.create = originals.create;
  PasswordChangeRequest.findById = originals.requestFindById;
  StaffNotification.create = originals.notify;
}
