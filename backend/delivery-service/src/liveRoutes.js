import express from "express";
import { protect } from "@greengrocc/shared";
import { requireDeliveryManager } from "./middleware/requireDeliveryManager.js";
import { updateStatus } from "./controllers/authController.js";
import {
  bookSlot,
  getMyBooking,
} from "./controllers/shiftController.js";
import {
  getRiderCashPending,
  riderSubmitCash,
} from "./controllers/cashSettlementController.js";
import {
  listShifts,
} from "./controllers/shiftManagementController.js";
import {
  getLoginHours,
  getLiveRiders,
} from "./controllers/gigController.js";
import {
  getPeakHours,
  manualAssignOrder,
  setPeakHours,
  updateRiderDocumentStatus,
} from "./controllers/liveOpsController.js";

import {
  acceptOrderOffer,
  completeDelivery,
  declineOrderOffer,
  getActiveDelivery,
  getPendingOffer,
  uploadDeliveryProof,
  verifyCustomerOtp,
  confirmCashCollection,
  confirmOnlinePaymentForOrder,
  getOrderPaymentStatus,
  scanPickupQr,
  submitPickupProofByDriver,
  verifyPickupByManager,
  approvePickupProofByManager,
  getManagerOrderPickupQr,
} from "./controllers/riderOrderController.js";

const riderRouter = express.Router();
riderRouter.post("/status", protect, updateStatus);
riderRouter.post("/shift-booking", protect, bookSlot);
riderRouter.get("/shift-booking/:riderId", protect, getMyBooking);
riderRouter.get("/login-hours", protect, getLoginHours);
riderRouter.get("/offer", protect, getPendingOffer);
riderRouter.post("/orders/:orderId/accept", protect, acceptOrderOffer);
riderRouter.post("/orders/:orderId/decline", protect, declineOrderOffer);
riderRouter.get("/active-delivery", protect, getActiveDelivery);
riderRouter.post("/orders/:orderId/scan-pickup-qr", protect, scanPickupQr);
riderRouter.post("/orders/:orderId/pickup-proof", protect, submitPickupProofByDriver);
// Delivery completion flow
riderRouter.post("/orders/:orderId/delivery-proof", protect, uploadDeliveryProof);
riderRouter.post("/orders/:orderId/verify-otp", protect, verifyCustomerOtp);
riderRouter.post("/orders/:orderId/collect-cash", protect, confirmCashCollection);
riderRouter.post("/orders/:orderId/confirm-online-payment", protect, confirmOnlinePaymentForOrder);
riderRouter.get("/orders/:orderId/payment-status", protect, getOrderPaymentStatus);
riderRouter.post("/orders/:orderId/complete", protect, completeDelivery);
// Cash liability
riderRouter.get("/cash/pending", protect, getRiderCashPending);
riderRouter.post("/cash/submit", protect, riderSubmitCash);

const managerRouter = express.Router();
managerRouter.use(protect, requireDeliveryManager);
managerRouter.post("/rider/:riderId/document-status", updateRiderDocumentStatus);
managerRouter.post("/order/assign", manualAssignOrder);
managerRouter.post("/peak-hours", setPeakHours);
managerRouter.get("/shifts", listShifts);
managerRouter.get("/riders/live", getLiveRiders);

const shiftsRouter = express.Router();
shiftsRouter.get("/", listShifts);

const peakRouter = express.Router();
peakRouter.get("/", getPeakHours);

export default [
  { path: "/api/shifts", router: shiftsRouter },
  { path: "/api/peak-hours", router: peakRouter },
  { path: "/api/rider", router: riderRouter },
  { path: "/api/manager", router: managerRouter },
];
