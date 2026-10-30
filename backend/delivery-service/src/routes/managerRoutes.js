import express from "express";
import { protect } from "@greengrocc/shared";
import { requireDeliveryManager } from "../middleware/requireDeliveryManager.js";
import { login, me, register } from "../controllers/managerAuthController.js";
import {
  assignOrder,
  getDashboardSummary,
  informCustomer,
  listIncomingOrders,
  listInventory,
  listPendingDrivers,
  listRiders,
  markDelivered,
  handOverPickupOrder,
  cancelStoreOrder,
  notifyCustomerOfDelay,
  verifyDriver,
  getDriverDetails,
  getDriverActivityHistory,
  toggleRiderActive,
  packOrder,
  createDemoStoreOrder,
  listRouteSuggestions,
  dispatchPackedOrderNow,
  assignSameRouteOrders,
} from "../controllers/managerDashboardController.js";
import {
  getManagerOrderPickupQr,
  verifyPickupByManager,
  approvePickupProofByManager,
  reviewOnlinePaymentClaim,
  resolveFailedOrderByManager,
} from "../controllers/riderOrderController.js";
import {
  createInventoryRequest,
  listMyInventoryRequests,
} from "../controllers/inventoryRequestController.js";
import {
  listManagerPreOrders,
  markPreOrdersReceived,
  markPreOrdersOutForDelivery,
  markPreOrdersDelivered,
} from "../controllers/preOrderController.js";
import { getManagerOrderTracking } from "../controllers/managerTrackingController.js";
import {
  listManagerProducts,
  createManagerProduct,
  updateManagerProduct,
  deleteManagerProduct,
  setManagerProductStock,
} from "../controllers/managerProductController.js";
import {
  getLiveRiders,
} from "../controllers/gigController.js";
import {
  setPeakHours,
  updateRiderDocumentStatus,
  manualAssignOrder,
} from "../controllers/liveOpsController.js";
import { createDeliveryBoyByManager } from "../controllers/createRiderController.js";

import {
  createShift,
  listShifts,
  listManagerSlots,
  updateSlotDateWise,
  deleteSlotDateWise,
  getSlotDetailsWithRiders,
  updateShiftEarningSlabs,
  getShiftEarningSlabs,
  listAssignableRiders,
  assignSlotRiders,
  unassignSlotRider,
} from "../controllers/shiftManagementController.js";

import {
  createGig,
  listGigs,
  updateGig,
  deleteGig,
} from "../controllers/gigManagementController.js";
import {
  getManagerCashOverview,
  confirmRiderCash,
  confirmOrderCash,
  getRiderCashHistory,
} from "../controllers/cashSettlementController.js";
import {
  listFullTimeRules,
  createFullTimeRule,
  updateFullTimeRule,
  deleteFullTimeRule,
  getFullTimeConfig,
  setFullTimeConfig,
} from "../controllers/fullTimeRuleController.js";
import {
  listFullTimeShifts,
  createFullTimeShift,
  updateFullTimeShift,
  deleteFullTimeShift,
  listFullTimeDrivers,
  getFullTimeDriverSummary,
  setFullTimeDriverSalary,
  creditFullTimeSalary,
  setDriverEmploymentType,
  listFullTimeAttendance,
  listFullTimeAssignableOrders,
  listFullTimeAssignedOrders,
  assignOrdersToFullTimeDriver,
  assignPreOrdersToDriver,
  unassignFullTimeOrder,
} from "../controllers/fullTimeManagementController.js";
import {
  listManagerReturnPickups,
  getManagerReturnPickup,
  assignReturnPickup,
  getReturnPickupQr,
  approveReturnProof,
  markReturnSuccessful,
} from "../controllers/returnPickupController.js";
import { getRevenueReport } from "../controllers/managerRevenueController.js";

const router = express.Router();

// Public self-register enabled for delivery managers
router.post("/register", register);
router.post("/login", login);

router.use(protect, requireDeliveryManager);

router.get("/me", me);
router.get("/dashboard", getDashboardSummary);
router.get("/revenue", getRevenueReport);
router.get("/orders", listIncomingOrders);
router.get("/preorders", listManagerPreOrders);
router.post("/preorders/receive", markPreOrdersReceived);
router.post("/preorders/assign", assignPreOrdersToDriver);
router.post("/preorders/out-for-delivery", markPreOrdersOutForDelivery);
router.post("/preorders/deliver", markPreOrdersDelivered);
router.get("/inventory", listInventory);
router.get("/products", listManagerProducts);
router.post("/products", createManagerProduct);
router.put("/products/:id", updateManagerProduct);
router.delete("/products/:id", deleteManagerProduct);
router.put("/products/:id/stock", setManagerProductStock);
router.get("/inventory-requests", listMyInventoryRequests);
router.post("/inventory-requests", createInventoryRequest);
router.get("/riders", listRiders);
router.get("/drivers", listRiders);
router.get("/riders/pending", listPendingDrivers);
router.get("/riders/live", getLiveRiders);
router.get("/drivers/:driverId", getDriverDetails);
router.get("/riders/:driverId", getDriverDetails);
router.get("/drivers/:driverId/activity-history", getDriverActivityHistory);
router.get("/riders/:driverId/activity-history", getDriverActivityHistory);
router.post("/drivers/:driverId/toggle-active", toggleRiderActive);
router.post("/riders", createDeliveryBoyByManager);
router.post("/riders/:riderId/verify", verifyDriver);
router.post("/orders/:orderId/inform-customer", informCustomer);
router.post("/orders/:orderId/pack", packOrder);
router.get("/orders/route-suggestions", listRouteSuggestions);
router.post("/orders/:orderId/dispatch-now", dispatchPackedOrderNow);
router.post("/orders/assign-same-route", assignSameRouteOrders);
router.get("/orders/:orderId/pickup-qr", getManagerOrderPickupQr);
router.post("/orders/:orderId/verify-pickup", verifyPickupByManager);
router.post("/orders/:orderId/approve-pickup-proof", approvePickupProofByManager);
router.post("/orders/:orderId/online-payment/:decision", reviewOnlinePaymentClaim);
router.post("/orders/:orderId/failed/:action", resolveFailedOrderByManager);
router.post("/orders/:orderId/confirm-cash", confirmOrderCash);
router.post("/orders/demo", createDemoStoreOrder);
router.post("/orders/:orderId/assign", assignOrder);
router.patch("/orders/:orderId/delivered", markDelivered);
router.post("/orders/:orderId/pickup-handover", handOverPickupOrder);
router.post("/orders/:orderId/cancel", cancelStoreOrder);
router.post("/orders/:orderId/delay/notify-customer", notifyCustomerOfDelay);
router.get("/orders/:orderId/tracking", getManagerOrderTracking);

router.get("/return-pickups", listManagerReturnPickups);
router.get("/return-pickups/:id", getManagerReturnPickup);
router.post("/return-pickups/:id/assign", assignReturnPickup);
router.get("/return-pickups/:id/pickup-qr", getReturnPickupQr);
router.post("/return-pickups/:id/approve-proof", approveReturnProof);
router.post("/return-pickups/:id/mark-successful", markReturnSuccessful);

// Shift & Slot Management APIs
router.post("/shifts", createShift);
router.get("/shifts", listShifts);
router.get("/shifts/slots", listManagerSlots);
router.put("/shifts/slots/:slotId", updateSlotDateWise);
router.delete("/shifts/slots/:slotId", deleteSlotDateWise);
router.get("/shifts/slots/:slotId/details", getSlotDetailsWithRiders);
router.get("/shifts/assignable-riders", listAssignableRiders);
router.post("/shifts/slots/:slotId/assign", assignSlotRiders);
router.delete("/shifts/slots/:slotId/assign/:riderId", unassignSlotRider);
// Shift-level earning slabs management
router.get("/shifts/:shiftId/earning-slabs", getShiftEarningSlabs);
router.put("/shifts/:shiftId/earning-slabs", updateShiftEarningSlabs);

// Gig & Incentive Management APIs
router.post("/gigs", createGig);
router.get("/gigs", listGigs);
router.put("/gigs/:gigId", updateGig);
router.delete("/gigs/:gigId", deleteGig);

router.post("/peak-hours", setPeakHours);
router.post("/riders/:riderId/document-status", updateRiderDocumentStatus);
router.post("/order/assign", manualAssignOrder);

// Cash Settlement (Dark Store view)
router.get("/cash", getManagerCashOverview);
router.post("/cash/confirm", confirmRiderCash);
router.get("/cash/rider/:riderId", getRiderCashHistory);

// Cash Settlement — Dark Store confirms physical cash receipt from riders
router.get("/cash-settlements", getManagerCashOverview);
router.post("/cash-settlements/confirm", confirmRiderCash);

// Full-Time Management
router.get("/fulltime-config", getFullTimeConfig);
router.put("/fulltime-config", setFullTimeConfig);
router.get("/fulltime-rules", listFullTimeRules);
router.post("/fulltime-rules", createFullTimeRule);
router.put("/fulltime-rules/:id", updateFullTimeRule);
router.delete("/fulltime-rules/:id", deleteFullTimeRule);
router.get("/fulltime/shifts", listFullTimeShifts);
router.post("/fulltime/shifts", createFullTimeShift);
router.put("/fulltime/shifts/:id", updateFullTimeShift);
router.delete("/fulltime/shifts/:id", deleteFullTimeShift);
router.get("/fulltime/drivers", listFullTimeDrivers);
router.get("/fulltime/drivers/:driverId", getFullTimeDriverSummary);
router.put("/fulltime/drivers/:driverId/salary", setFullTimeDriverSalary);
router.post("/fulltime/drivers/:driverId/credit-salary", creditFullTimeSalary);
router.put("/drivers/:driverId/employment-type", setDriverEmploymentType);
router.get("/fulltime/attendance", listFullTimeAttendance);
router.get("/fulltime/assignable-orders", listFullTimeAssignableOrders);
router.get("/fulltime/assigned-orders", listFullTimeAssignedOrders);
router.post("/fulltime/assign-orders", assignOrdersToFullTimeDriver);
router.post("/fulltime/orders/:orderId/unassign", unassignFullTimeOrder);

export default router;
