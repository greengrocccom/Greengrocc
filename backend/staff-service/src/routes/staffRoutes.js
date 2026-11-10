import express from "express";
import { listMyCleaningReports, submitCleaningReport, getCleaningReportPhoto, listCleaningReports } from "../controllers/cleaningReportController.js";
import { listMyPasswordRequests, createMyPasswordRequest } from "../controllers/passwordRequestController.js";
import { protect, requireRoles } from "@greengrocc/shared";
import {
  createAccount,
  getHierarchy,
  listStaff,
  login,
  me,
  getVendorBatches,
} from "../controllers/staffController.js";
import {
  getStaffOverview,
  getStaffFeed,
  getStaffShifts,
  getStaffAttendance,
  punchStaffAttendance,
  getStaffLeaves,
  applyStaffLeave,
  getStaffSalary,
  getStaffMeetings,
  getStaffNotifications,
  markStaffNotificationRead,
  updateStaffFcmToken,
} from "../controllers/staffAppControllers.js";
import {
  listAllInventoryRequests,
  reviewInventoryRequest,
} from "../../../delivery-service/src/controllers/inventoryRequestController.js";
import {
  adminSetPreOrderProgress,
  cancelPreOrderByStaff,
  forwardPreOrders,
  listPreOrdersForStaff,
  updatePreOrderStage,
} from "../../../delivery-service/src/controllers/preOrderController.js";

const PRE_ORDER_ROLES = ["product_manager", "segregation_manager", "admin"];

const router = express.Router();

router.get("/hierarchy", getHierarchy);
router.post("/login", login);

router.use(protect);

router.get("/me", me);
router.get("/my/cleaning-reports", listMyCleaningReports);
router.post("/my/cleaning-reports", submitCleaningReport);
router.get("/cleaning-reports", requireRoles("admin"), listCleaningReports);
router.get("/cleaning-reports/:id/photo", getCleaningReportPhoto);

// Staff Mobile App Endpoints
router.get("/my/overview", getStaffOverview);
router.get("/my/feed", getStaffFeed);
router.get("/my/shifts", getStaffShifts);
router.get("/my/attendance", getStaffAttendance);
router.post("/my/attendance/punch", punchStaffAttendance);
router.get("/my/leaves", getStaffLeaves);
router.post("/my/leaves", applyStaffLeave);
router.post("/my/leaves/apply", applyStaffLeave);
router.get("/my/salary", getStaffSalary);
router.get("/my/meetings", getStaffMeetings);
router.get("/my/notifications", getStaffNotifications);
router.post("/my/notifications/:id/read", markStaffNotificationRead);
router.post("/my/fcm-token", updateStaffFcmToken);
router.get("/my/password-requests", listMyPasswordRequests);
router.post("/my/password-requests", createMyPasswordRequest);
router.get("/", listStaff);
router.post("/", createAccount);
router.get(
  "/inventory-requests",
  requireRoles("product_manager", "vendor", "segregation_manager", "admin"),
  listAllInventoryRequests
);
router.patch(
  "/inventory-requests/:requestId",
  requireRoles("vendor", "admin"),
  reviewInventoryRequest
);

router.get("/preorders", requireRoles(...PRE_ORDER_ROLES), listPreOrdersForStaff);
router.get("/vendor-batches", requireRoles(...PRE_ORDER_ROLES), getVendorBatches);
router.post("/preorders/forward", requireRoles(...PRE_ORDER_ROLES), forwardPreOrders);
router.patch("/preorders/:orderId/stage", requireRoles(...PRE_ORDER_ROLES), updatePreOrderStage);
router.post("/preorders/:orderId/cancel", requireRoles(...PRE_ORDER_ROLES), cancelPreOrderByStaff);
router.patch("/preorders/:orderId/admin-progress", requireRoles("admin"), adminSetPreOrderProgress);

export default router;
