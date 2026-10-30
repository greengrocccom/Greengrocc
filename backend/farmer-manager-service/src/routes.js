import express from "express";
import {
  getFarmers,
  getFarmerById,
  createFarmer,
  updateFarmer,
  deleteFarmer,
  setFarmerStatus,
  farmerLogin,
  registerFarmer,
  sendFarmerOtpController,
  resendFarmerOtpController,
  verifyFarmerOtpController,
  submitFarmerKyc,
  getFarmerMe,
  updateFarmerSelfProfile,
  updateFarmerFarmProfile,
  updateFarmerFarmLocation,
  confirmFarmerFarmLocation,
  listFarmerCrops,
  getPublicCropsCatalog,
  getFarmerCrop,
  createFarmerCrop,
  updateFarmerCrop,
  deleteFarmerCrop,
  getManagedFarmerCrops,
  getManagedFarmerCrop,
  createManagedFarmerCrop,
  updateManagedFarmerCrop,
  updateManagedCropPlan,
  deleteManagedFarmerCrop,
  listFarmerCropPlans,
  getFarmerCropPlan,
  createFarmerCropPlan,
  updateFarmerCropPlan,
  listMyProducts,
  getMyProduct,
  createMyProduct,
  updateMyProduct,
  deleteMyProduct,
  patchMyProductPrice,
  patchMyProductStock,
  patchMyProductStatus,
  listMyOrders,
  getMyOrder,
  getMyQualityReport,
  acceptMyOrder,
  rejectMyOrder,
  prepareMyOrder,
  packMyOrder,
  readyMyOrder,
  updateFarmerPassword,
  updateFarmerLoginStatus,
  getFarmerDashboard,
  getFarmerProducts,
  getFarmerProductById,
  createFarmerProduct,
  createManagedFarmerProduct,
  updateManagedFarmerProduct,
  updateFarmerProduct,
  reviewFarmerProduct,
  reviewFarmerCrop,
  deleteFarmerProduct,
  getFarmerInventory,
  adjustFarmerStock,
  getStockHistory,
  updateFarmerInventoryItem,
  getFarmerOrders,
  getFarmerOrderById,
  updateFarmerOrder,
  updateFarmerOrderStatus,
  createFarmerOrder,
  deleteFarmerOrder,
  getFarmerEarnings,
  getFarmerDocuments,
  uploadFarmerDocument,
  createFarmerDocumentUploadUrl,
  updateFarmerDocumentStatus,
  updateVendorFarmerDocumentStatus,
  deleteFarmerDocument,
  getManagers,
  getManagerById,
  createManager,
  updateManager,
  deleteManager,
  setManagerStatus,
  getHarvestOrders,
  createHarvestOrder,
  updateHarvestOrder,
  deleteHarvestOrder,
  // Vendor auth
  vendorLogin,
  vendorSendLoginOtp,
  vendorResendLoginOtp,
  getVendorMe,
  updateVendorMe,
  getVendorSettings,
  updateVendorSettings,
  getVendors,
  createVendor,
  updateVendor,
  getVendorDashboard,
  getVendorAllProducts,
  getVendorAllCrops,
  getVendorFarmerCropRequests,
  // Manager auth
  managerLogin,
  getManagerMe,
  getManagerFarmers,
  getManagerDashboard,
  getManagerAllProducts,
  getManagerAllCrops,
  getManagerAllOrders,
  getManagerAllInventory,
  listVendorFarmerInventory,
  getManagerAllDocuments,
  getManagerAllStockHistory,
  getManagerAllHarvestOrders,
  getManagerAllEarnings,
  assignFarmerManager,
} from "./controllers.js";
import {
  listVendorDrivers,
  createVendorDriver,
  getVendorDriver,
  updateVendorDriver,
  setVendorDriverStatus,
  deleteVendorDriver,
  listVendorPickups,
  getVendorPickup,
  assignVendorPickupDriver,
  reassignVendorPickupDriver,
  reserveVendorBatchId,
  createVendorPickupBatch,
  assignVendorBatchDriver,
  ungroupVendorBatch,
  startVendorPickup,
  arriveVendorPickup,
  listVendorCentres,
  createVendorCentre,
  receiveVendorPickup,
  getVendorPickupReceipt,
  listManagerPickups,
  getManagerPickup,
  verifyManagerPickupQr,
  confirmManagerPickup,
  receiveManagerPickup,
  getManagerPickupReceipt,
  listManagerDrivers,
  assignManagerPickupDriver,
  reassignManagerPickupDriver,
  driverLogin,
  getDriverMe,
  listDriverPickups,
  getDriverPickup,
  getDriverBatch,
  getVendorBatch,
  getManagerBatch,
  acceptDriverPickup,
  rejectDriverPickup,
  startDriverPickup,
  arriveDriverPickup,
  checkDriverPickupOrder,
  verifyDriverPickupQr,
  confirmDriverPickup,
  transitDriverPickup,
  arriveAtCentreDriverPickup,
} from "./pickupControllers.js";
import { requireVendor, requireManager, requireFarmer, requireFarmerOrManager, requireDriver, requireVendorOrManager, attachAuth } from "./middleware.js";
import { handleVendorLiveSearch } from "./vendorLiveSearchController.js";
import {
  listVendorDarkStoreRequests,
  createVendorDarkStoreRequest,
  cancelVendorDarkStoreRequest,
  listVendorDeliveryBoys,
  createVendorDeliveryBoy,
  deleteVendorDeliveryBoy,
} from "./darkStoreRequestControllers.js";
import {
  getVendorShippingMethods,
  saveVendorShippingMethods,
  calculateShippingRate,
} from "./shippingControllers.js";
import {
  listVendorCatalogProducts,
  listVendorMyProducts,
  updateVendorMyProduct,
  getVendorMyProductFull,
  deleteVendorMyProduct,
  createVendorProductRequest,
  cancelVendorProductRequest,
  listFarmerVendorProducts,
  listManagerVendorProductsCatalog,
  requestFarmerProduct,
} from "./vendorProductRequestControllers.js";
import {
  listVendorCatalogCrops,
  listFarmerVendorCrops,
  listVendorMyCrops,
  createVendorCropRequest,
  cancelVendorCropRequest,
  listManagerVendorCropsCatalog,
} from "./vendorCropRequestControllers.js";
import {
  listQualityPending,
  getQualityInspection,
  verifyQualityQr,
  startQualityCheck,
  saveQualityPhotos,
  saveQualityParameters,
  saveQualityGrading,
  confirmQualityGrading,
  getQualityFinalSummary,
  getOrderQualityReport,
  updateOrderPaymentStatus,
  uploadLabReport,
  deleteLabReport,
} from "./qualityControllers.js";
import {
  listInventoryAlerts,
  saveInventoryAlert,
  deleteInventoryAlert,
} from "./inventoryAlertControllers.js";
import {
  getVendorVacation,
  updateVendorVacation,
  getVendorReviews,
  replyVendorReview,
  getPublicStoreReviews,
  createPublicStoreReview,
  getPublicStoreVacation,
} from "./vendorReviewVacationControllers.js";
import {
  saveFarmerPushToken,
  deleteFarmerPushToken,
  sendFarmerTestPush,
  listFarmerNotifications,
  readAllFarmerNotifications,
  markFarmerNotificationRead,
  deleteFarmerNotification,
  clearAllFarmerNotifications,
} from "./farmerPush.js";
import {
  saveDriverPushToken,
  deleteDriverPushToken,
  sendDriverTestPush,
  listDriverNotifications,
  readAllDriverNotifications,
} from "./driverPush.js";
import {
  listVendorPreOrders,
  confirmVendorPreOrders,
  rejectVendorPreOrder,
  packVendorPreOrders,
  shipVendorPreOrders,
} from "../../delivery-service/src/controllers/preOrderController.js";
import { listPreOrderFarmerRequests, createPreOrderFarmerRequest } from "./preOrderFarmerRequestControllers.js";
import { getVendorNotificationReadState, markVendorNotificationsRead } from "./vendorNotificationControllers.js";
import {
  listVendorCoupons,
  createVendorCoupon,
  updateVendorCoupon,
  deleteVendorCoupon,
  seedVendorCoupons,
  listVendorGiftCards,
  createVendorGiftCard,
  updateVendorGiftCard,
  deleteVendorGiftCard,
  listVendorPricingRules,
  createVendorPricingRule,
  updateVendorPricingRule,
  deleteVendorPricingRule,
  getVendorRewardSettings,
  updateVendorRewardSettings,
  getVendorRewardStats,
  listVendorRewardTransactions,
  listVendorRefunds,
  createVendorRefund,
  updateVendorRefund,
} from "./vendorPromotionControllers.js";
import {
  listVendorCatalogProducts as listVendorOwnedCatalogProducts,
  listVendorCatalogCategories,
  listVendorCatalogRequests,
  createVendorCatalogRequest,
  cancelVendorCatalogRequest,
} from "./vendorCatalogControllers.js";
import { listVendorZones, createVendorZone, cancelVendorZone } from "./vendorZoneControllers.js";

const farmerRouter = express.Router();
const vendorFarmerRouter = express.Router();
const vendorManagerRouter = express.Router();
const vendorAuthRouter = express.Router();
const vendorRouter = express.Router();
const managerAuthRouter = express.Router();
const managerRouter = express.Router();
const driverAuthRouter = express.Router();
const driverRouter = express.Router();
const qualityRouter = express.Router();

// ------------------------------------
// FARMER AUTH & COMMON API
// ------------------------------------
farmerRouter.use(attachAuth);
farmerRouter.get("/live-search", handleVendorLiveSearch);
farmerRouter.post("/login", farmerLogin);
farmerRouter.post("/register", registerFarmer);
farmerRouter.post("/otp/send", sendFarmerOtpController);
farmerRouter.post("/otp/resend", resendFarmerOtpController);
farmerRouter.post("/otp/verify", verifyFarmerOtpController);
farmerRouter.get("/me", requireFarmer, getFarmerMe);
farmerRouter.put("/me/profile", requireFarmer, updateFarmerSelfProfile);
farmerRouter.put("/me/farm", requireFarmer, updateFarmerFarmProfile);
farmerRouter.put("/me/farm-location", requireFarmer, updateFarmerFarmLocation);
farmerRouter.post("/me/farm-location/confirm", requireFarmer, confirmFarmerFarmLocation);
farmerRouter.post("/push-token", requireFarmer, saveFarmerPushToken);
farmerRouter.delete("/push-token", requireFarmer, deleteFarmerPushToken);
farmerRouter.post("/push-test", requireFarmer, sendFarmerTestPush);
farmerRouter.get("/notifications", requireFarmer, listFarmerNotifications);
farmerRouter.post("/notifications/read-all", requireFarmer, readAllFarmerNotifications);
farmerRouter.patch("/notifications/:id/read", requireFarmer, markFarmerNotificationRead);
farmerRouter.delete("/notifications/:id", requireFarmer, deleteFarmerNotification);
farmerRouter.delete("/notifications", requireFarmer, clearAllFarmerNotifications);
farmerRouter.get("/crops", requireFarmer, listFarmerCrops);
farmerRouter.get("/crops/catalog", getPublicCropsCatalog);
farmerRouter.get("/crops/vendor-available", requireFarmer, listFarmerVendorCrops);
farmerRouter.post("/crops", requireFarmer, createFarmerCrop);
farmerRouter.get("/crops/:cropId", requireFarmer, getFarmerCrop);
farmerRouter.put("/crops/:cropId", requireFarmer, updateFarmerCrop);
farmerRouter.delete("/crops/:cropId", requireFarmer, deleteFarmerCrop);
farmerRouter.get("/crop-plans", requireFarmer, listFarmerCropPlans);
farmerRouter.post("/crop-plans", requireFarmer, createFarmerCropPlan);
farmerRouter.get("/crop-plans/:planId", requireFarmer, getFarmerCropPlan);
farmerRouter.put("/crop-plans/:planId", requireFarmer, updateFarmerCropPlan);
farmerRouter.get("/products", requireFarmer, listMyProducts);
farmerRouter.get("/products/vendor-available", requireFarmer, listFarmerVendorProducts);
farmerRouter.get("/:farmerId/products/vendor-available", listFarmerVendorProducts);
farmerRouter.post("/products/request", requireFarmer, requestFarmerProduct);
farmerRouter.post("/:farmerId/products/request", requestFarmerProduct);
farmerRouter.post("/products", requireFarmer, createMyProduct);
farmerRouter.get("/products/:productId", requireFarmer, getMyProduct);
farmerRouter.put("/products/:productId", requireFarmer, updateMyProduct);
farmerRouter.delete("/products/:productId", requireFarmer, deleteMyProduct);
farmerRouter.patch("/products/:productId/price", requireFarmer, patchMyProductPrice);
farmerRouter.patch("/products/:productId/stock", requireFarmer, patchMyProductStock);
farmerRouter.patch("/products/:productId/status", requireFarmer, patchMyProductStatus);
farmerRouter.get("/orders", requireFarmerOrManager, listMyOrders);
farmerRouter.get("/orders/:orderId/quality-report", requireFarmerOrManager, getMyQualityReport);
farmerRouter.get("/orders/:orderId", requireFarmerOrManager, getMyOrder);
farmerRouter.patch("/orders/:orderId/accept", requireFarmerOrManager, acceptMyOrder);
farmerRouter.patch("/orders/:orderId/reject", requireFarmerOrManager, rejectMyOrder);
farmerRouter.patch("/orders/:orderId/prepare", requireFarmerOrManager, prepareMyOrder);
farmerRouter.patch("/orders/:orderId/ready-for-pickup", requireFarmerOrManager, readyMyOrder);
farmerRouter.patch("/orders/:orderId/packing", requireFarmerOrManager, packMyOrder);
farmerRouter.get("/", getFarmers);
farmerRouter.post("/", createFarmer);
farmerRouter.get("/:farmerId", getFarmerById);
farmerRouter.put("/:farmerId", updateFarmer);
farmerRouter.delete("/:farmerId", deleteFarmer);
farmerRouter.patch("/:farmerId/status", setFarmerStatus);

farmerRouter.get("/:farmerId/dashboard", getFarmerDashboard);

// Products
farmerRouter.get("/:farmerId/products", getFarmerProducts);
farmerRouter.post("/:farmerId/products", createFarmerProduct);
farmerRouter.get("/:farmerId/products/:productId", getFarmerProductById);
farmerRouter.put("/:farmerId/products/:productId", updateFarmerProduct);
farmerRouter.delete("/:farmerId/products/:productId", deleteFarmerProduct);

// Inventory & Stock
farmerRouter.get("/:farmerId/inventory", getFarmerInventory);
farmerRouter.post("/:farmerId/inventory/adjust", adjustFarmerStock);
farmerRouter.post("/:farmerId/inventory/add", adjustFarmerStock);
farmerRouter.post("/:farmerId/inventory/remove", (req, res, next) => {
  req.body.change = -Math.abs(Number(req.body.change || req.body.quantity || 0));
  adjustFarmerStock(req, res, next);
});
farmerRouter.put("/:farmerId/inventory/:inventoryId", updateFarmerInventoryItem);
farmerRouter.get("/:farmerId/stock-history", getStockHistory);

// Orders
farmerRouter.get("/:farmerId/orders", getFarmerOrders);
farmerRouter.get("/farmers/:farmerId/orders", getFarmerOrders);
farmerRouter.post("/:farmerId/orders", createFarmerOrder);
farmerRouter.post("/farmers/:farmerId/orders", createFarmerOrder);
farmerRouter.get("/:farmerId/orders/:orderId", getFarmerOrderById);
farmerRouter.get("/farmers/:farmerId/orders/:orderId", getFarmerOrderById);
farmerRouter.put("/:farmerId/orders/:orderId", updateFarmerOrder);
farmerRouter.put("/farmers/:farmerId/orders/:orderId", updateFarmerOrder);
farmerRouter.patch("/:farmerId/orders/:orderId", updateFarmerOrder);
farmerRouter.patch("/farmers/:farmerId/orders/:orderId", updateFarmerOrder);
farmerRouter.patch("/:farmerId/orders/:orderId/status", updateFarmerOrderStatus);
farmerRouter.patch("/farmers/:farmerId/orders/:orderId/status", updateFarmerOrderStatus);
farmerRouter.delete("/:farmerId/orders/:orderId", deleteFarmerOrder);
farmerRouter.delete("/farmers/:farmerId/orders/:orderId", deleteFarmerOrder);

// Earnings
farmerRouter.get("/:farmerId/earnings", getFarmerEarnings);

// Harvest Orders
farmerRouter.get("/harvest-orders", getHarvestOrders);
farmerRouter.get("/:farmerId/harvest-orders", getHarvestOrders);
farmerRouter.post("/:farmerId/harvest-orders", createHarvestOrder);
farmerRouter.put("/:farmerId/harvest-orders/:id", updateHarvestOrder);
farmerRouter.delete("/:farmerId/harvest-orders/:id", deleteHarvestOrder);
farmerRouter.delete("/harvest-orders/:id", deleteHarvestOrder);

// Documents
farmerRouter.get("/:farmerId/documents", getFarmerDocuments);
farmerRouter.post("/:farmerId/documents", uploadFarmerDocument);
farmerRouter.post("/:farmerId/documents/upload-url", createFarmerDocumentUploadUrl);
farmerRouter.post("/:farmerId/kyc/submit", submitFarmerKyc);
farmerRouter.patch("/:farmerId/documents/:documentId/status", updateFarmerDocumentStatus);
farmerRouter.delete("/:farmerId/documents/:documentId", deleteFarmerDocument);

// ------------------------------------
// MANAGER LOGIN (unified — used by farmer panel)
// ------------------------------------
farmerRouter.post("/manager/login", managerLogin);


// ------------------------------------
// VENDOR FARMER MANAGEMENT API
// ------------------------------------
vendorFarmerRouter.use(requireVendor);
vendorFarmerRouter.get("/", getFarmers);
vendorFarmerRouter.post("/", createFarmer);
vendorFarmerRouter.get("/:farmerId", getFarmerById);
vendorFarmerRouter.put("/:farmerId", updateFarmer);
vendorFarmerRouter.delete("/:farmerId", deleteFarmer);
vendorFarmerRouter.patch("/:farmerId/status", setFarmerStatus);
vendorFarmerRouter.put("/:farmerId/password", updateFarmerPassword);
vendorFarmerRouter.put("/:farmerId/login-status", updateFarmerLoginStatus);
vendorFarmerRouter.put("/:farmerId/manager", assignFarmerManager);

vendorFarmerRouter.get("/:farmerId/products", getFarmerProducts);
vendorFarmerRouter.post("/:farmerId/products", requireVendor, createManagedFarmerProduct);
vendorFarmerRouter.get("/:farmerId/products/:productId", getFarmerProductById);
vendorFarmerRouter.put("/:farmerId/products/:productId", updateFarmerProduct);
vendorFarmerRouter.patch("/:farmerId/products/:productId/review", requireVendor, reviewFarmerProduct);
vendorFarmerRouter.delete("/:farmerId/products/:productId", deleteFarmerProduct);
vendorFarmerRouter.get("/:farmerId/crops", getManagedFarmerCrops);
vendorFarmerRouter.post("/:farmerId/crops", createManagedFarmerCrop);
vendorFarmerRouter.get("/:farmerId/crops/:cropId", getManagedFarmerCrop);
vendorFarmerRouter.put("/:farmerId/crops/:cropId", updateManagedFarmerCrop);
vendorFarmerRouter.delete("/:farmerId/crops/:cropId", deleteManagedFarmerCrop);

vendorFarmerRouter.get("/:farmerId/inventory", getFarmerInventory);
vendorFarmerRouter.post("/:farmerId/inventory/adjust", adjustFarmerStock);
vendorFarmerRouter.put("/:farmerId/inventory/:inventoryId", updateFarmerInventoryItem);

vendorFarmerRouter.get("/:farmerId/orders", getFarmerOrders);
vendorFarmerRouter.get("/:farmerId/earnings", getFarmerEarnings);
vendorFarmerRouter.get("/:farmerId/documents", getFarmerDocuments);
vendorFarmerRouter.post("/:farmerId/documents", uploadFarmerDocument);
vendorFarmerRouter.patch("/:farmerId/documents/:documentId/status", requireVendor, updateVendorFarmerDocumentStatus);
vendorFarmerRouter.get("/:farmerId/stock-history", getStockHistory);

vendorFarmerRouter.get("/:farmerId/harvest-orders", getHarvestOrders);
vendorFarmerRouter.post("/:farmerId/harvest-orders", createHarvestOrder);
vendorFarmerRouter.put("/:farmerId/harvest-orders/:id", updateHarvestOrder);
vendorFarmerRouter.delete("/:farmerId/harvest-orders/:id", deleteHarvestOrder);


// ------------------------------------
// VENDOR MANAGER MANAGEMENT API
// ------------------------------------
vendorManagerRouter.use(requireVendor);
vendorManagerRouter.get("/", getManagers);
vendorManagerRouter.post("/", createManager);
vendorManagerRouter.get("/:managerId", getManagerById);
vendorManagerRouter.put("/:managerId", updateManager);
vendorManagerRouter.delete("/:managerId", deleteManager);
vendorManagerRouter.patch("/:managerId/status", setManagerStatus);


// ------------------------------------
// VENDOR AUTH ROUTES
// ------------------------------------
vendorAuthRouter.post("/login", vendorLogin);
vendorAuthRouter.post("/login/send-otp", vendorSendLoginOtp);
vendorAuthRouter.post("/login/resend-otp", vendorResendLoginOtp);
vendorAuthRouter.get("/me", requireVendor, getVendorMe);
vendorAuthRouter.put("/me", requireVendor, updateVendorMe);
vendorAuthRouter.patch("/me", requireVendor, updateVendorMe);
vendorRouter.put("/profile", requireVendor, updateVendorMe);
vendorRouter.get("/settings", requireVendor, getVendorSettings);
vendorRouter.put("/settings", requireVendor, updateVendorSettings);
vendorRouter.patch("/settings", requireVendor, updateVendorSettings);

// Vendor Vacation
vendorRouter.get("/vacation", requireVendor, getVendorVacation);
vendorRouter.put("/vacation", requireVendor, updateVendorVacation);
vendorRouter.patch("/vacation", requireVendor, updateVendorVacation);

// Vendor Reviews & Customer Store Page Integration
vendorRouter.get("/reviews", requireVendor, getVendorReviews);
vendorRouter.post("/reviews/:reviewId/reply", requireVendor, replyVendorReview);
vendorRouter.get("/public-store/:vendorId/reviews", getPublicStoreReviews);
vendorRouter.post("/public-store/:vendorId/reviews", createPublicStoreReview);
vendorRouter.get("/public-store/:vendorId/vacation", getPublicStoreVacation);
vendorAuthRouter.post("/driver/login", driverLogin);
vendorAuthRouter.get("/driver/me", requireDriver, getDriverMe);
vendorAuthRouter.post("/driver/push-token", requireDriver, saveDriverPushToken);
vendorAuthRouter.delete("/driver/push-token", requireDriver, deleteDriverPushToken);
vendorAuthRouter.post("/driver/push-test", requireDriver, sendDriverTestPush);
vendorRouter.get("/driver-desk/notifications", requireDriver, listDriverNotifications);
vendorRouter.post("/driver-desk/notifications/read-all", requireDriver, readAllDriverNotifications);

// ------------------------------------
// VENDOR PANEL ROUTES (protected)
// ------------------------------------
vendorRouter.get("/live-search", attachAuth, handleVendorLiveSearch);
vendorRouter.get("/dashboard", requireVendor, getVendorDashboard);
vendorRouter.get("/notifications/read-state", requireVendor, getVendorNotificationReadState);
vendorRouter.post("/notifications/read", requireVendor, markVendorNotificationsRead);
vendorRouter.get("/inventory-alerts", requireVendor, listInventoryAlerts);
vendorRouter.put("/inventory-alerts", requireVendor, saveInventoryAlert);
vendorRouter.delete("/inventory-alerts/:alertId", requireVendor, deleteInventoryAlert);
vendorRouter.get("/farmer-inventory", requireVendor, listVendorFarmerInventory);
vendorRouter.get("/farmers", requireVendor, getFarmers);
vendorRouter.post("/farmers", requireVendor, createFarmer);
vendorRouter.get("/farmers/:farmerId", requireVendor, getFarmerById);
vendorRouter.put("/farmers/:farmerId", requireVendor, updateFarmer);
vendorRouter.delete("/farmers/:farmerId", requireVendor, deleteFarmer);
vendorRouter.patch("/farmers/:farmerId/status", requireVendor, setFarmerStatus);
vendorRouter.put("/farmers/:farmerId/manager", requireVendor, assignFarmerManager);
vendorRouter.get("/farmers/:farmerId/products", requireVendor, getFarmerProducts);
vendorRouter.post("/farmers/:farmerId/products", requireVendor, createManagedFarmerProduct);
vendorRouter.patch("/farmers/:farmerId/products/:productId/review", requireVendor, reviewFarmerProduct);
vendorRouter.patch("/farmers/:farmerId/crops/:cropId/review", requireVendor, reviewFarmerCrop);
vendorRouter.get("/products", requireVendor, getVendorAllProducts);
vendorRouter.get("/crops", requireVendor, getVendorAllCrops);
vendorRouter.get("/farmer-crop-requests", requireVendor, getVendorFarmerCropRequests);
vendorRouter.post("/crops", requireVendor, createManagedFarmerCrop);
vendorRouter.get("/crops/catalog", requireVendor, getPublicCropsCatalog);
vendorRouter.get("/farmers/:farmerId/crops", requireVendor, getManagedFarmerCrops);
vendorRouter.post("/farmers/:farmerId/crops", requireVendor, createManagedFarmerCrop);
vendorRouter.get("/farmers/:farmerId/crops/:cropId", requireVendor, getManagedFarmerCrop);
vendorRouter.put("/farmers/:farmerId/crops/:cropId", requireVendor, updateManagedFarmerCrop);
vendorRouter.delete("/farmers/:farmerId/crops/:cropId", requireVendor, deleteManagedFarmerCrop);
vendorRouter.get("/farmers/:farmerId/inventory", requireVendor, getFarmerInventory);
vendorRouter.post("/farmers/:farmerId/documents", requireVendor, uploadFarmerDocument);
vendorRouter.get("/farmers/:farmerId/orders", requireVendor, getFarmerOrders);
vendorRouter.post("/farmers/:farmerId/orders", requireVendor, createFarmerOrder);
vendorRouter.put("/farmers/:farmerId/orders/:orderId", requireVendor, updateFarmerOrder);
vendorRouter.delete("/farmers/:farmerId/orders/:orderId", requireVendor, deleteFarmerOrder);
vendorRouter.get("/farmers/:farmerId/earnings", requireVendor, getFarmerEarnings);
vendorRouter.get("/farmers/:farmerId/documents", requireVendor, getFarmerDocuments);

vendorRouter.get("/managers", requireVendor, getManagers);
vendorRouter.post("/managers", requireVendor, createManager);
vendorRouter.get("/managers/:managerId", requireVendor, getManagerById);
vendorRouter.put("/managers/:managerId", requireVendor, updateManager);
vendorRouter.delete("/managers/:managerId", requireVendor, deleteManager);
vendorRouter.patch("/managers/:managerId/status", requireVendor, setManagerStatus);

vendorRouter.get("/vendors", getVendors);
vendorRouter.post("/vendors", createVendor);
vendorRouter.put("/vendors/:vendorId", requireVendor, updateVendor);

vendorRouter.get("/drivers", requireVendor, listVendorDrivers);
vendorRouter.post("/drivers", requireVendor, createVendorDriver);
vendorRouter.get("/drivers/:driverId", requireVendor, getVendorDriver);
vendorRouter.put("/drivers/:driverId", requireVendor, updateVendorDriver);
vendorRouter.patch("/drivers/:driverId/status", requireVendor, setVendorDriverStatus);
vendorRouter.delete("/drivers/:driverId", requireVendor, deleteVendorDriver);
vendorRouter.get("/pickups", requireVendor, listVendorPickups);
vendorRouter.post("/pickup-batches/new", requireVendor, reserveVendorBatchId);
vendorRouter.post("/pickup-batches", requireVendor, createVendorPickupBatch);
vendorRouter.post("/pickup-batches/:batchId/assign", requireVendor, assignVendorBatchDriver);
vendorRouter.post("/pickup-batches/:batchId/ungroup", requireVendor, ungroupVendorBatch);
vendorRouter.get("/batches/:batchId", requireVendor, getVendorBatch);
vendorRouter.get("/pickups/:pickupId", requireVendor, getVendorPickup);
vendorRouter.post("/pickups/:pickupId/assign", requireVendor, assignVendorPickupDriver);
vendorRouter.post("/pickups/:pickupId/reassign", requireVendor, reassignVendorPickupDriver);
vendorRouter.post("/pickups/:pickupId/start", requireVendor, startVendorPickup);
vendorRouter.post("/pickups/:pickupId/arrive", requireVendor, arriveVendorPickup);
vendorRouter.post("/pickups/:pickupId/receive", requireVendor, receiveVendorPickup);
vendorRouter.get("/pickups/:pickupId/receipt", requireVendor, getVendorPickupReceipt);
vendorRouter.get("/collection-centres", requireVendor, listVendorCentres);
vendorRouter.post("/collection-centres", requireVendor, createVendorCentre);
vendorRouter.get("/zones", requireVendor, listVendorZones);
vendorRouter.post("/zones", requireVendor, createVendorZone);
vendorRouter.post("/zones/:zoneId/cancel", requireVendor, cancelVendorZone);
vendorRouter.get("/dark-store-requests", requireVendor, listVendorDarkStoreRequests);
vendorRouter.post("/dark-store-requests", requireVendor, createVendorDarkStoreRequest);
vendorRouter.post("/dark-store-requests/:requestId/cancel", requireVendor, cancelVendorDarkStoreRequest);
vendorRouter.get("/delivery-boys", requireVendor, listVendorDeliveryBoys);
vendorRouter.post("/delivery-boys", requireVendor, createVendorDeliveryBoy);
vendorRouter.delete("/delivery-boys/:boyId", requireVendor, deleteVendorDeliveryBoy);
vendorRouter.get("/preorders", requireVendor, listVendorPreOrders);
vendorRouter.post("/preorders/confirm", requireVendor, confirmVendorPreOrders);
vendorRouter.post("/preorders/pack", requireVendor, packVendorPreOrders);
vendorRouter.post("/preorders/ship", requireVendor, shipVendorPreOrders);
vendorRouter.get("/preorders/farmer-requests", requireVendor, listPreOrderFarmerRequests);
vendorRouter.post("/preorders/:orderId/farmer-request", requireVendor, createPreOrderFarmerRequest);
vendorRouter.post("/preorders/:orderId/reject", requireVendor, rejectVendorPreOrder);
vendorRouter.get("/catalog-products", requireVendor, listVendorCatalogProducts);
vendorRouter.get("/my-products", requireVendor, listVendorMyProducts);
vendorRouter.get("/my-products/:productId/full", requireVendor, getVendorMyProductFull);
vendorRouter.patch("/my-products/:productId", requireVendor, updateVendorMyProduct);
vendorRouter.delete("/my-products/:productId", requireVendor, deleteVendorMyProduct);
vendorRouter.post("/product-requests", requireVendor, createVendorProductRequest);
vendorRouter.get("/catalog/products", requireVendor, listVendorOwnedCatalogProducts);
vendorRouter.get("/catalog/categories", requireVendor, listVendorCatalogCategories);
vendorRouter.get("/catalog/requests", requireVendor, listVendorCatalogRequests);
vendorRouter.post("/catalog/requests", requireVendor, createVendorCatalogRequest);
vendorRouter.post("/catalog/requests/:requestId/cancel", requireVendor, cancelVendorCatalogRequest);
vendorRouter.get("/catalog-crops", requireVendor, listVendorCatalogCrops);
vendorRouter.get("/my-crops", requireVendor, listVendorMyCrops);
vendorRouter.post("/crop-requests", requireVendor, createVendorCropRequest);
vendorRouter.post("/crop-requests/:requestId/cancel", requireVendor, cancelVendorCropRequest);
vendorRouter.get("/shipping-methods", requireVendor, getVendorShippingMethods);
vendorRouter.put("/shipping-methods", requireVendor, saveVendorShippingMethods);
vendorRouter.post("/shipping-methods/calculate", attachAuth, calculateShippingRate);

vendorRouter.get("/driver-desk/pickups", requireDriver, listDriverPickups);
vendorRouter.get("/driver-desk/batches/:batchId", requireDriver, getDriverBatch);
vendorRouter.get("/driver-desk/pickups/:pickupId", requireDriver, getDriverPickup);
vendorRouter.post("/driver-desk/pickups/:pickupId/accept", requireDriver, acceptDriverPickup);
vendorRouter.post("/driver-desk/pickups/:pickupId/reject", requireDriver, rejectDriverPickup);
vendorRouter.post("/driver-desk/pickups/:pickupId/start", requireDriver, startDriverPickup);
vendorRouter.post("/driver-desk/pickups/:pickupId/arrive", requireDriver, arriveDriverPickup);
vendorRouter.post("/driver-desk/pickups/:pickupId/check-order", requireDriver, checkDriverPickupOrder);
vendorRouter.post("/driver-desk/pickups/:pickupId/verify-qr", requireDriver, verifyDriverPickupQr);
vendorRouter.post("/driver-desk/pickups/:pickupId/confirm", requireDriver, confirmDriverPickup);
vendorRouter.post("/driver-desk/pickups/:pickupId/transit", requireDriver, transitDriverPickup);
vendorRouter.post("/driver-desk/pickups/:pickupId/arrive-centre", requireDriver, arriveAtCentreDriverPickup);


// ------------------------------------
// MANAGER AUTH ROUTES
// ------------------------------------
managerAuthRouter.post("/login", managerLogin);
managerAuthRouter.get("/me", requireManager, getManagerMe);

// ------------------------------------
// MANAGER PANEL ROUTES (protected)
// ------------------------------------
managerRouter.use(requireManager);
managerRouter.get("/live-search", handleVendorLiveSearch);
managerRouter.get("/dashboard", requireManager, getManagerDashboard);
managerRouter.get("/farmers", requireManager, getManagerFarmers);
managerRouter.get("/products", requireManager, getManagerAllProducts);
managerRouter.get("/crops", requireManager, getManagerAllCrops);
managerRouter.post("/crops", requireManager, createManagedFarmerCrop);
managerRouter.get("/crops/catalog", requireManager, listManagerVendorCropsCatalog);
managerRouter.get("/vendor-crops", requireManager, listManagerVendorCropsCatalog);
managerRouter.get("/vendor-products", requireManager, listManagerVendorProductsCatalog);
managerRouter.patch("/farmers/:farmerId/products/:productId/review", requireManager, reviewFarmerProduct);
managerRouter.get("/orders", requireManager, getManagerAllOrders);
managerRouter.get("/inventory", requireManager, getManagerAllInventory);
managerRouter.get("/documents", requireManager, getManagerAllDocuments);
managerRouter.get("/stock-history", requireManager, getManagerAllStockHistory);
managerRouter.get("/harvest-orders", requireManager, getManagerAllHarvestOrders);
managerRouter.delete("/harvest-orders/:id", requireManager, deleteHarvestOrder);
managerRouter.delete("/farmers/:farmerId/harvest-orders/:id", requireManager, deleteHarvestOrder);
managerRouter.delete("/:farmerId/harvest-orders/:id", requireManager, deleteHarvestOrder);
managerRouter.get("/earnings", requireManager, getManagerAllEarnings);
managerRouter.get("/pickups", requireManager, listManagerPickups);
managerRouter.get("/batches/:batchId", requireManager, getManagerBatch);
managerRouter.get("/pickups/:pickupId", requireManager, getManagerPickup);
managerRouter.post("/pickups/:pickupId/verify-qr", requireManager, verifyManagerPickupQr);
managerRouter.post("/pickups/:pickupId/confirm", requireManager, confirmManagerPickup);
managerRouter.get("/drivers", requireManager, listManagerDrivers);
managerRouter.post("/pickups/:pickupId/assign", requireManager, assignManagerPickupDriver);
managerRouter.post("/pickups/:pickupId/reassign", requireManager, reassignManagerPickupDriver);
managerRouter.post("/pickups/:pickupId/receive", requireManager, receiveManagerPickup);
managerRouter.get("/pickups/:pickupId/receipt", requireManager, getManagerPickupReceipt);
managerRouter.post("/farmers", requireManager, createFarmer);
managerRouter.get("/farmers/:farmerId", requireManager, getFarmerById);
managerRouter.delete("/farmers/:farmerId", requireManager, deleteFarmer);
managerRouter.get("/farmers/:farmerId/products", requireManager, getFarmerProducts);
managerRouter.post("/farmers/:farmerId/products", requireManager, createManagedFarmerProduct);
managerRouter.get("/farmers/:farmerId/crops", requireManager, getManagedFarmerCrops);
managerRouter.post("/farmers/:farmerId/crops", requireManager, createManagedFarmerCrop);
managerRouter.get("/farmers/:farmerId/crops/:cropId", requireManager, getManagedFarmerCrop);
managerRouter.put("/farmers/:farmerId/crops/:cropId", requireManager, updateManagedFarmerCrop);
managerRouter.put("/farmers/:farmerId/crops/:cropId/plan", requireManager, updateManagedCropPlan);
managerRouter.delete("/farmers/:farmerId/crops/:cropId", requireManager, deleteManagedFarmerCrop);
managerRouter.get("/farmers/:farmerId/products/:productId", requireManager, getFarmerProductById);
managerRouter.put("/farmers/:farmerId/products/:productId", requireManager, updateManagedFarmerProduct);
managerRouter.delete("/farmers/:farmerId/products/:productId", requireManager, deleteMyProduct);
managerRouter.patch("/farmers/:farmerId/products/:productId/price", requireManager, patchMyProductPrice);
managerRouter.patch("/farmers/:farmerId/products/:productId/stock", requireManager, patchMyProductStock);
managerRouter.patch("/farmers/:farmerId/products/:productId/status", requireManager, patchMyProductStatus);
managerRouter.get("/farmers/:farmerId/inventory", requireManager, getFarmerInventory);
managerRouter.post("/farmers/:farmerId/inventory/adjust", requireManager, adjustFarmerStock);
managerRouter.put("/farmers/:farmerId/inventory/:inventoryId", requireManager, updateFarmerInventoryItem);
managerRouter.get("/farmers/:farmerId/stock-history", requireManager, getStockHistory);
managerRouter.get("/farmers/:farmerId/orders", requireManager, getFarmerOrders);
managerRouter.get("/:farmerId/orders", requireManager, getFarmerOrders);
managerRouter.post("/farmers/:farmerId/orders", requireManager, createFarmerOrder);
managerRouter.post("/:farmerId/orders", requireManager, createFarmerOrder);
managerRouter.get("/farmers/:farmerId/orders/:orderId", requireManager, getFarmerOrderById);
managerRouter.get("/:farmerId/orders/:orderId", requireManager, getFarmerOrderById);
managerRouter.put("/farmers/:farmerId/orders/:orderId", requireManager, updateFarmerOrder);
managerRouter.put("/:farmerId/orders/:orderId", requireManager, updateFarmerOrder);
managerRouter.patch("/farmers/:farmerId/orders/:orderId", requireManager, updateFarmerOrder);
managerRouter.patch("/:farmerId/orders/:orderId", requireManager, updateFarmerOrder);
managerRouter.patch("/farmers/:farmerId/orders/:orderId/status", requireManager, updateFarmerOrderStatus);
managerRouter.patch("/:farmerId/orders/:orderId/status", requireManager, updateFarmerOrderStatus);
managerRouter.delete("/farmers/:farmerId/orders/:orderId", requireManager, deleteFarmerOrder);
managerRouter.delete("/:farmerId/orders/:orderId", requireManager, deleteFarmerOrder);
managerRouter.get("/farmers/:farmerId/earnings", requireManager, getFarmerEarnings);
managerRouter.get("/farmers/:farmerId/documents", requireManager, getFarmerDocuments);
managerRouter.post("/farmers/:farmerId/documents", requireManager, uploadFarmerDocument);
managerRouter.patch("/farmers/:farmerId/documents/:documentId/status", requireManager, (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Managers are not authorized to approve or reject farmer documents. Verification is reserved for Admin.",
  });
});

driverAuthRouter.post("/login", driverLogin);
driverAuthRouter.get("/me", requireDriver, getDriverMe);
driverRouter.get("/pickups", requireDriver, listDriverPickups);
driverRouter.get("/pickups/:pickupId", requireDriver, getDriverPickup);
driverRouter.post("/pickups/:pickupId/accept", requireDriver, acceptDriverPickup);
driverRouter.post("/pickups/:pickupId/reject", requireDriver, rejectDriverPickup);
driverRouter.post("/pickups/:pickupId/start", requireDriver, startDriverPickup);
driverRouter.post("/pickups/:pickupId/arrive", requireDriver, arriveDriverPickup);
driverRouter.post("/pickups/:pickupId/check-order", requireDriver, checkDriverPickupOrder);
driverRouter.post("/pickups/:pickupId/verify-qr", requireDriver, verifyDriverPickupQr);
driverRouter.post("/pickups/:pickupId/confirm", requireDriver, confirmDriverPickup);
driverRouter.post("/pickups/:pickupId/transit", requireDriver, transitDriverPickup);
driverRouter.post("/pickups/:pickupId/arrive-centre", requireDriver, arriveAtCentreDriverPickup);

qualityRouter.get("/pending", requireVendorOrManager, listQualityPending);
qualityRouter.post("/verify-qr", requireVendorOrManager, verifyQualityQr);
qualityRouter.get("/:orderId/final-summary", requireVendorOrManager, getQualityFinalSummary);
qualityRouter.get("/:orderId/report", requireVendorOrManager, getOrderQualityReport);
qualityRouter.get("/:orderId/quality-report", requireVendorOrManager, getOrderQualityReport);
qualityRouter.patch("/:orderId/payment", requireVendorOrManager, updateOrderPaymentStatus);
qualityRouter.patch("/:orderId/payment-status", requireVendorOrManager, updateOrderPaymentStatus);
qualityRouter.get("/:orderId", requireVendorOrManager, getQualityInspection);
qualityRouter.post("/:orderId/start", requireVendorOrManager, startQualityCheck);
qualityRouter.post("/:orderId/photos", requireVendorOrManager, saveQualityPhotos);
qualityRouter.patch("/:orderId/parameters", requireVendorOrManager, saveQualityParameters);
qualityRouter.patch("/:orderId/grading", requireVendorOrManager, saveQualityGrading);
qualityRouter.post("/:orderId/confirm", requireVendorOrManager, confirmQualityGrading);
qualityRouter.post("/:orderId/lab-reports", requireVendorOrManager, uploadLabReport);
qualityRouter.delete("/:orderId/lab-reports/:reportId", requireVendorOrManager, deleteLabReport);

export default [
  { path: "/api/farmers", router: farmerRouter },
  { path: "/api/farmer", router: farmerRouter },
  { path: "/api/vendor/farmers", router: vendorFarmerRouter },
  { path: "/api/vendor/managers", router: vendorManagerRouter },
  // New authenticated routes
  { path: "/api/vendor/auth", router: vendorAuthRouter },
  { path: "/api/vendor", router: vendorRouter },
  { path: "/api/farmer-manager/auth", router: managerAuthRouter },
  { path: "/api/farmer-manager", router: managerRouter },
  { path: "/api/driver/auth", router: driverAuthRouter },
  { path: "/api/driver", router: driverRouter },
  { path: "/api/quality", router: qualityRouter },
];
