import express from "express";
import { protect, requireAdmin, optionalAuth } from "@greengrocc/shared";
import {
  listGiftCards,
  createGiftCard,
  updateGiftCard,
  deleteGiftCard,
  validateGiftCardPublic,
  listPricingRules,
  listActivePricingPublic,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  listBulkDeals,
  createBulkDeal,
  updateBulkDeal,
  deleteBulkDeal,
  exportProductsCsv,
  exportProductsJson,
  importProductsCsv,
  importProductsJson,
  listProductsLite,
  previewPricingCalculation,
  listProductCategoriesLite,
} from "./catalogControllers.js";
import {
  listVendorsAdmin,
  createVendorAdmin,
  sendVendorVerificationOtpAdmin,
  verifyVendorVerificationOtpAdmin,
  updateVendorAdmin,
  deleteVendorAdmin,
  getVendorAdmin,
  createDarkStoreAdmin,
  listCentreFarmersAdmin,
  assignCentreFarmerAdmin,
  listCentreFarmerManagersAdmin,
  assignCentreFarmerManagerAdmin,
  listCropCatalogAdmin,
  deleteCropCatalogAdmin,
  listFarmerCropsAdmin,
  getCollectionDashboardAdmin,
  listVendorProductRequestsAdmin,
  approveVendorProductRequestAdmin,
  rejectVendorProductRequestAdmin,
  listVendorProductsAdmin,
  removeVendorProductAdmin,
  listVendorCropRequestsAdmin,
  approveVendorCropRequestAdmin,
  rejectVendorCropRequestAdmin,
  listVendorCropsAdmin,
  removeVendorCropAdmin,
  listDarkStoreRequestsAdmin,
  approveDarkStoreRequestAdmin,
  rejectDarkStoreRequestAdmin,
  getVendorDocumentAdmin,
  deleteVendorDocumentAdmin,
  listHrDirectory,
  createHrStaff,
  updateHrStaff,
  clockHrAttendance,
  listHrAttendance,
  getHrAttendanceReport,
  markManualAttendance,
  updateHrAttendance,
  deleteHrAttendance,
  upsertHrEmployment,
  listHrTasks,
  createHrTask,
  updateHrTask,
  listHrPayroll,
  runHrPayroll,
  updateHrPayroll,
  listDeliveryOrders,
  assignDeliveryOrder,
  updateDeliveryOrderStatus,
  listRidersLite,
  listDeliveryTracking,
  listDeliveryTeam,
  getDeliveryManagerAdmin,
  getDeliveryBoyAdmin,
  listStoreSupport,
  listSupportRoles,
  listSupportUserHistory,
  updateStoreSupport,
} from "./opsControllers.js";
import {
  getAdminShippingMethods,
  saveAdminShippingMethods,
} from "../../farmer-manager-service/src/shippingControllers.js";
import {
  getHrPerson,
  listHrRoles,
  listHrAnnouncements,
  listLiveHrAnnouncements,
  createHrAnnouncement,
  updateHrAnnouncement,
  deleteHrAnnouncement,
  listHrLeavePolicies,
  upsertHrLeavePolicy,
  listHrLeaves,
  createHrLeave,
  applyHrLeave,
  listMyHrLeaves,
  updateHrLeave,
  deleteHrLeave,
  listHrShifts,
  createHrShift,
  updateHrShift,
  deleteHrShift,
  listHrCalendar,
  listLiveHrCalendar,
  listHrVacancies,
  listOpenHrVacancies,
  createHrVacancy,
  updateHrVacancy,
  listHrCandidates,
  getHrCandidate,
  createHrCandidate,
  applyHrCandidate,
  updateHrCandidate,
  downloadHrCandidateCv,
  createHrMeeting,
  listHrMeetings,
  listMyHrMeetings,
  listHrPromotions,
  createHrPromotion,
  updateHrPromotion,
  deleteHrPromotion,
  listHrIncrements,
  createHrIncrement,
  updateHrIncrement,
  deleteHrIncrement,
  listHrPerformanceLogs,
  createHrPerformanceLog,
  updateHrPerformanceLog,
  deleteHrPerformanceLog,
} from "./hrExtendedControllers.js";
import {
  listB2bClients,
  listRegisteredBulkUsers,
  getB2bClient,
  createB2bClient,
  updateB2bClient,
  deleteB2bClient,
  addB2bRepresentative,
  updateB2bRepresentative,
  deleteB2bRepresentative,
  listDealStages,
  createDealStage,
  updateDealStage,
  deleteDealStage,
  reorderDealStages,
  listDeals,
  createDeal,
  updateDeal,
  moveDealStage,
  deleteDeal,
} from "./b2bControllers.js";
import {
  listFinance,
  createFinanceEntry,
  updateFinanceEntry,
  deleteFinanceEntry,
  listRefunds,
  createRefund,
  updateRefund,
  getReports,
} from "./financeControllers.js";
import * as financeSuite from "./financeSuiteControllers.js";
import {
  adjustInventoryFarmer,
  adjustInventoryVendor,
  getInventoryFarmer,
  getInventoryVendor,
  listInventoryFarmers,
  listInventoryVendors,
} from "./inventoryHubControllers.js";
import {
  listUserMgmtZones,
  listUserMgmtStores,
  listUserMgmtStoreUsers,
  toggleUserMgmtBlock,
  updateUserStatus,
  listAllUsersDirectory,
  listUnblockRequests,
  reviewUnblockRequest,
} from "./userManagementControllers.js";
import {
  listAssetZones,
  listAssetStores,
  listAssetRolePeople,
  listAssets,
  createAsset,
  updateAsset,
  deleteAsset,
} from "./assetManagementControllers.js";
import {
  listLiveRolePolicies,
  listPolicyRoles,
  listRolePolicies,
  createRolePolicy,
  updateRolePolicy,
  deleteRolePolicy,
} from "./policyControllers.js";
import {
  listGovtSchemes,
  listLiveGovtSchemes,
  getGovtScheme,
  createGovtScheme,
  updateGovtScheme,
  deleteGovtScheme,
  applyGovtScheme,
  listMyGovtSchemeApplications,
  listAllGovtSchemeApplications,
  updateGovtSchemeApplicationStatus,
  deleteGovtSchemeApplication,
} from "./govtSchemeControllers.js";
import {
  listMarketPrices,
  listLiveMarketPrices,
  getMarketPrice,
  createMarketPrice,
  updateMarketPrice,
  deleteMarketPrice,
} from "./marketPriceControllers.js";
import { getAnalytics } from "./analyticsControllers.js";
import {
  withManagerOverride,
  adminListShifts,
  adminCreateShift,
  adminUpdateSlot,
  adminDeleteSlot,
  adminSlotDetails,
  adminAssignableRiders,
  adminAssignSlotRiders,
  adminUnassignSlotRider,
  getRiderSalaryAdmin,
  setRiderMonthlySalaryAdmin,
  creditRiderSalaryAdmin,
} from "./deliverySlotsAdminControllers.js";
import {
  getBillingZonesAndStores,
  getBillingCatalog,
  getBillingCustomers,
  createBillingCustomer,
  createBillingInvoice,
  getBillingInvoices,
  getOmnichannelOverview,
} from "./billingControllers.js";
import {
  getRealtimeStock,
  getBatchExpiryTracking,
  quarantineBatch,
  getLowStockAlerts,
  getGrnList,
  createGrn,
  getDeadStockReport,
  getStockAdjustmentLogs,
  createStockAdjustment,
  getInventoryStoresAndVendors,
} from "./inventoryControllers.js";
import { requireVendor } from "../../farmer-manager-service/src/middleware.js";
import {
  listAdminVendorCatalogRequests,
  approveVendorCatalogRequest,
  rejectVendorCatalogRequest,
} from "../../farmer-manager-service/src/vendorCatalogControllers.js";
import { listZonesAdmin, approveZoneAdmin, rejectZoneAdmin } from "../../farmer-manager-service/src/vendorZoneControllers.js";
import { attachVendorHrScope } from "./hrScope.js";
import {
  listStaffRoles,
  createCustomRole,
  deleteCustomRole,
  listStaffUsers,
  createStaffUser,
  toggleStaffStatus,
  resetStaffPassword,
  sendCustomStaffNotification,
  listStaffNotifications,
  deleteStaffNotification,
} from "./staffManagementControllers.js";

const router = express.Router();

router.post("/gift-cards/validate", optionalAuth, validateGiftCardPublic);
router.get("/pricing/active", listActivePricingPublic);
router.get("/hr/announcements/live", optionalAuth, listLiveHrAnnouncements);
router.get("/hr/calendar/live", optionalAuth, listLiveHrCalendar);
router.post("/hr/leaves/apply", protect, applyHrLeave);
router.get("/hr/leaves/mine", protect, listMyHrLeaves);
router.get("/hr/vacancies/open", listOpenHrVacancies);
router.post("/hr/candidates/apply", applyHrCandidate);
router.get("/policies/live", optionalAuth, listLiveRolePolicies);
router.get("/govt-schemes/live", optionalAuth, listLiveGovtSchemes);
router.post("/govt-schemes/apply", optionalAuth, applyGovtScheme);
router.get("/govt-schemes/applications/mine", optionalAuth, listMyGovtSchemeApplications);
router.get("/market-prices/live", optionalAuth, listLiveMarketPrices);
router.get("/hr/meetings/mine", protect, listMyHrMeetings);

// Omnichannel Billing & POS routes
router.get("/billing/zones-and-stores", optionalAuth, getBillingZonesAndStores);
router.get("/billing/catalog", optionalAuth, getBillingCatalog);
router.get("/billing/customers", optionalAuth, getBillingCustomers);
router.post("/billing/customers", optionalAuth, createBillingCustomer);
router.post("/billing/invoices", optionalAuth, createBillingInvoice);
router.get("/billing/invoices", optionalAuth, getBillingInvoices);
router.get("/billing/channels-overview", optionalAuth, getOmnichannelOverview);

// Inventory & Stock Tools routes
router.get("/inventory-tools/realtime-stock", optionalAuth, getRealtimeStock);
router.get("/inventory-tools/batches", optionalAuth, getBatchExpiryTracking);
router.post("/inventory-tools/batches/:batchId/quarantine", optionalAuth, quarantineBatch);
router.get("/inventory-tools/alerts", optionalAuth, getLowStockAlerts);
router.get("/inventory-tools/low-stock-alerts", optionalAuth, getLowStockAlerts);
router.get("/inventory-tools/grn", optionalAuth, getGrnList);
router.post("/inventory-tools/grn", optionalAuth, createGrn);
router.get("/inventory-tools/dead-stock", optionalAuth, getDeadStockReport);
router.get("/inventory-tools/adjustments", optionalAuth, getStockAdjustmentLogs);
router.post("/inventory-tools/adjustments", optionalAuth, createStockAdjustment);
router.get("/inventory-tools/metadata", optionalAuth, getInventoryStoresAndVendors);

router.use(protect, requireAdmin);

router.get("/gift-cards", listGiftCards);
router.post("/gift-cards", createGiftCard);
router.put("/gift-cards/:id", updateGiftCard);
router.delete("/gift-cards/:id", deleteGiftCard);

router.get("/govt-schemes", listGovtSchemes);
router.get("/govt-schemes/applications", listAllGovtSchemeApplications);
router.put("/govt-schemes/applications/:id/status", updateGovtSchemeApplicationStatus);
router.delete("/govt-schemes/applications/:id", deleteGovtSchemeApplication);
router.get("/govt-schemes/:id", getGovtScheme);
router.post("/govt-schemes", createGovtScheme);
router.put("/govt-schemes/:id", updateGovtScheme);
router.delete("/govt-schemes/:id", deleteGovtScheme);

router.get("/market-prices", listMarketPrices);
router.get("/market-prices/:id", getMarketPrice);
router.post("/market-prices", createMarketPrice);
router.put("/market-prices/:id", updateMarketPrice);
router.delete("/market-prices/:id", deleteMarketPrice);

router.get("/policies/roles", listPolicyRoles);
router.get("/policies", listRolePolicies);
router.post("/policies", createRolePolicy);
router.put("/policies/:id", updateRolePolicy);
router.delete("/policies/:id", deleteRolePolicy);

router.get("/support/roles", listSupportRoles);
router.get("/support/history", listSupportUserHistory);
router.get("/support", listStoreSupport);
router.patch("/support/:id", updateStoreSupport);

router.get("/pricing", listPricingRules);
router.post("/pricing", createPricingRule);
router.post("/pricing/preview", previewPricingCalculation);
router.get("/pricing/categories", listProductCategoriesLite);
router.put("/pricing/:id", updatePricingRule);
router.delete("/pricing/:id", deletePricingRule);

router.get("/bulk-selling", listBulkDeals);
router.post("/bulk-selling", createBulkDeal);
router.put("/bulk-selling/:id", updateBulkDeal);
router.delete("/bulk-selling/:id", deleteBulkDeal);

router.get("/products/lite", listProductsLite);
router.get("/csv/products", exportProductsCsv);
router.post("/csv/products", importProductsCsv);
router.get("/bulk/products", exportProductsJson);
router.post("/bulk/products", importProductsJson);

router.get("/vendors", listVendorsAdmin);
router.post("/vendors/otp/send", sendVendorVerificationOtpAdmin);
router.post("/vendors/otp/verify", verifyVendorVerificationOtpAdmin);
router.post("/vendors", createVendorAdmin);
router.get("/vendors/:id", getVendorAdmin);
router.put("/vendors/:id", updateVendorAdmin);
router.delete("/vendors/:id", deleteVendorAdmin);
router.get("/vendors/:id/documents/:docId", getVendorDocumentAdmin);
router.delete("/vendors/:id/documents/:docId", deleteVendorDocumentAdmin);
router.get("/shipping-methods", getAdminShippingMethods);
router.put("/shipping-methods", saveAdminShippingMethods);
router.post("/dark-stores", createDarkStoreAdmin);
router.get("/collection-dashboard", getCollectionDashboardAdmin);
router.get("/vendor-product-requests", listVendorProductRequestsAdmin);
router.post("/vendor-product-requests/:requestId/approve", approveVendorProductRequestAdmin);
router.post("/vendor-product-requests/:requestId/reject", rejectVendorProductRequestAdmin);
router.get("/zone-requests", listZonesAdmin);
router.post("/zone-requests/:zoneId/approve", approveZoneAdmin);
router.post("/zone-requests/:zoneId/reject", rejectZoneAdmin);
router.get("/vendor-catalog-requests", listAdminVendorCatalogRequests);
router.post("/vendor-catalog-requests/:requestId/approve", approveVendorCatalogRequest);
router.post("/vendor-catalog-requests/:requestId/reject", rejectVendorCatalogRequest);
router.get("/vendors/:id/products", listVendorProductsAdmin);
router.delete("/vendors/:id/products/:productId", removeVendorProductAdmin);
router.get("/vendor-crop-requests", listVendorCropRequestsAdmin);
router.post("/vendor-crop-requests/:requestId/approve", approveVendorCropRequestAdmin);
router.post("/vendor-crop-requests/:requestId/reject", rejectVendorCropRequestAdmin);
router.get("/vendors/:id/crops", listVendorCropsAdmin);
router.delete("/vendors/:id/crops/:cropId", removeVendorCropAdmin);
router.get("/collection-farmers", listCentreFarmersAdmin);
router.put("/collection-farmers/:farmerId", assignCentreFarmerAdmin);
router.put("/collection-farmers/:farmerId/assign", assignCentreFarmerAdmin);
router.patch("/collection-farmers/:farmerId/assign", assignCentreFarmerAdmin);
router.get("/crop-catalog", listCropCatalogAdmin);
router.delete("/crop-catalog/:cropId", deleteCropCatalogAdmin);
router.get("/collection-farmer-crops", listFarmerCropsAdmin);
router.get("/collection-farmer-managers", listCentreFarmerManagersAdmin);
router.put("/collection-farmer-managers/:managerId", assignCentreFarmerManagerAdmin);
router.put("/collection-farmer-managers/:managerId/assign", assignCentreFarmerManagerAdmin);
router.patch("/collection-farmer-managers/:managerId/assign", assignCentreFarmerManagerAdmin);
router.get("/dark-store-requests", listDarkStoreRequestsAdmin);
router.post("/dark-store-requests/:requestId/approve", approveDarkStoreRequestAdmin);
router.post("/dark-store-requests/:requestId/reject", rejectDarkStoreRequestAdmin);

router.get("/inventory/farmers", listInventoryFarmers);
router.get("/inventory/farmers/:farmerId", getInventoryFarmer);
router.post("/inventory/farmers/:farmerId/adjust", adjustInventoryFarmer);
router.get("/inventory/vendors", listInventoryVendors);
router.get("/inventory/vendors/:vendorId", getInventoryVendor);
router.post("/inventory/vendors/:vendorId/adjust", adjustInventoryVendor);

router.get("/hr", listHrDirectory);
router.post("/hr", createHrStaff);
router.post("/hr/employment", upsertHrEmployment);
router.get("/hr/roles", listHrRoles);
router.get("/hr/people/:type/:id", getHrPerson);
router.get("/hr/calendar", listHrCalendar);
router.get("/hr/announcements", listHrAnnouncements);
router.post("/hr/announcements", createHrAnnouncement);
router.put("/hr/announcements/:id", updateHrAnnouncement);
router.delete("/hr/announcements/:id", deleteHrAnnouncement);
router.get("/hr/meetings", listHrMeetings);
router.post("/hr/meetings", createHrMeeting);
router.get("/hr/leave-policies", listHrLeavePolicies);
router.put("/hr/leave-policies/:roleKey", upsertHrLeavePolicy);
router.get("/hr/leaves", listHrLeaves);
router.post("/hr/leaves", createHrLeave);
router.put("/hr/leaves/:id", updateHrLeave);
router.delete("/hr/leaves/:id", deleteHrLeave);
router.get("/hr/shifts", listHrShifts);
router.post("/hr/shifts", createHrShift);
router.put("/hr/shifts/:id", updateHrShift);
router.delete("/hr/shifts/:id", deleteHrShift);
router.get("/hr/vacancies", listHrVacancies);
router.post("/hr/vacancies", createHrVacancy);
router.put("/hr/vacancies/:id", updateHrVacancy);
router.get("/hr/candidates", listHrCandidates);
router.post("/hr/candidates", createHrCandidate);
router.get("/hr/candidates/:id", getHrCandidate);
router.put("/hr/candidates/:id", updateHrCandidate);
router.get("/hr/candidates/:id/cv", downloadHrCandidateCv);
router.get("/hr/attendance", listHrAttendance);
router.post("/hr/attendance", clockHrAttendance);
router.get("/hr/attendance/report", getHrAttendanceReport);
router.post("/hr/attendance/manual", markManualAttendance);
router.put("/hr/attendance/:id", updateHrAttendance);
router.delete("/hr/attendance/:id", deleteHrAttendance);
router.get("/hr/tasks", listHrTasks);
router.post("/hr/tasks", createHrTask);
router.put("/hr/tasks/:id", updateHrTask);
router.get("/hr/payroll", listHrPayroll);
router.post("/hr/payroll/run", runHrPayroll);
router.put("/hr/payroll/:id", updateHrPayroll);
router.put("/hr/:id", updateHrStaff);

router.get("/hr/promotions", listHrPromotions);
router.post("/hr/promotions", createHrPromotion);
router.put("/hr/promotions/:id", updateHrPromotion);
router.delete("/hr/promotions/:id", deleteHrPromotion);

router.get("/hr/increments", listHrIncrements);
router.post("/hr/increments", createHrIncrement);
router.put("/hr/increments/:id", updateHrIncrement);
router.delete("/hr/increments/:id", deleteHrIncrement);

router.get("/hr/performance", listHrPerformanceLogs);
router.post("/hr/performance", createHrPerformanceLog);
router.put("/hr/performance/:id", updateHrPerformanceLog);
router.delete("/hr/performance/:id", deleteHrPerformanceLog);

// Staff Management & Custom Roles & Custom Notifications
router.get("/staff-management/roles", listStaffRoles);
router.post("/staff-management/roles", createCustomRole);
router.delete("/staff-management/roles/:id", deleteCustomRole);
router.get("/staff-management/staff", listStaffUsers);
router.post("/staff-management/staff", createStaffUser);
router.put("/staff-management/staff/:id/status", toggleStaffStatus);
router.put("/staff-management/staff/:id/password", resetStaffPassword);
router.post("/staff-management/notifications", sendCustomStaffNotification);
router.get("/staff-management/notifications", listStaffNotifications);
router.delete("/staff-management/notifications/:id", deleteStaffNotification);

router.get("/hr/b2b-clients", listB2bClients);
router.get("/hr/b2b-clients/registered-users", listRegisteredBulkUsers);
router.post("/hr/b2b-clients", createB2bClient);
router.get("/hr/b2b-clients/:id", getB2bClient);
router.put("/hr/b2b-clients/:id", updateB2bClient);
router.delete("/hr/b2b-clients/:id", deleteB2bClient);
router.post("/hr/b2b-clients/:id/representatives", addB2bRepresentative);
router.put("/hr/b2b-clients/:id/representatives/:repId", updateB2bRepresentative);
router.delete("/hr/b2b-clients/:id/representatives/:repId", deleteB2bRepresentative);

// B2B Deal Stages (Fully Customizable)
router.get("/hr/b2b-deal-stages", listDealStages);
router.post("/hr/b2b-deal-stages", createDealStage);
router.post("/hr/b2b-deal-stages/reorder", reorderDealStages);
router.put("/hr/b2b-deal-stages/:id", updateDealStage);
router.delete("/hr/b2b-deal-stages/:id", deleteDealStage);

// B2B Deals & Pipeline
router.get("/hr/b2b-deals", listDeals);
router.post("/hr/b2b-deals", createDeal);
router.put("/hr/b2b-deals/:id", updateDeal);
router.patch("/hr/b2b-deals/:id/stage", moveDealStage);
router.delete("/hr/b2b-deals/:id", deleteDeal);

router.get("/delivery/orders", listDeliveryOrders);
router.get("/delivery/riders", listRidersLite);
router.get("/delivery/team", listDeliveryTeam);
router.get("/delivery/managers/:id", getDeliveryManagerAdmin);
router.get("/delivery/boys/:id", getDeliveryBoyAdmin);
router.get("/delivery/boys/:id/salary", getRiderSalaryAdmin);
router.put("/delivery/boys/:id/salary", setRiderMonthlySalaryAdmin);
router.post("/delivery/boys/:id/salary-credits", creditRiderSalaryAdmin);
// Delivery slots of a dark store — same handlers the Delivery Manager uses
router.get("/delivery/managers/:managerId/shifts", withManagerOverride, adminListShifts);
router.post("/delivery/managers/:managerId/shifts", withManagerOverride, adminCreateShift);
router.get("/delivery/managers/:managerId/assignable-riders", withManagerOverride, adminAssignableRiders);
router.put("/delivery/managers/:managerId/shifts/slots/:slotId", withManagerOverride, adminUpdateSlot);
router.delete("/delivery/managers/:managerId/shifts/slots/:slotId", withManagerOverride, adminDeleteSlot);
router.get("/delivery/managers/:managerId/shifts/slots/:slotId/details", withManagerOverride, adminSlotDetails);
router.post("/delivery/managers/:managerId/shifts/slots/:slotId/assign", withManagerOverride, adminAssignSlotRiders);
router.delete(
  "/delivery/managers/:managerId/shifts/slots/:slotId/assign/:riderId",
  withManagerOverride,
  adminUnassignSlotRider
);
router.patch("/delivery/orders/:id/assign", assignDeliveryOrder);
router.patch("/delivery/orders/:id/status", updateDeliveryOrderStatus);
router.get("/tracking", listDeliveryTracking);

router.get("/finance", listFinance);
router.post("/finance", createFinanceEntry);
router.put("/finance/:id", updateFinanceEntry);
router.delete("/finance/:id", deleteFinanceEntry);

// Comprehensive Finance Suite Routes
router.get("/finance/estimations", financeSuite.listEstimations);
router.post("/finance/estimations", financeSuite.createEstimation);
router.put("/finance/estimations/:id", financeSuite.updateEstimation);
router.delete("/finance/estimations/:id", financeSuite.deleteEstimation);

router.get("/finance/tax-rates", financeSuite.listTaxRates);
router.post("/finance/tax-rates", financeSuite.createTaxRate);
router.put("/finance/tax-rates/:id", financeSuite.updateTaxRate);
router.delete("/finance/tax-rates/:id", financeSuite.deleteTaxRate);

router.get("/finance/tax-zones", financeSuite.listTaxZones);
router.post("/finance/tax-zones", financeSuite.createTaxZone);
router.put("/finance/tax-zones/:id", financeSuite.updateTaxZone);
router.delete("/finance/tax-zones/:id", financeSuite.deleteTaxZone);

router.get("/finance/tax-categories", financeSuite.listTaxCategories);
router.post("/finance/tax-categories", financeSuite.createTaxCategory);
router.put("/finance/tax-categories/:id", financeSuite.updateTaxCategory);
router.delete("/finance/tax-categories/:id", financeSuite.deleteTaxCategory);

router.get("/finance/tax-agencies", financeSuite.listTaxAgencies);
router.post("/finance/tax-agencies", financeSuite.createTaxAgency);
router.put("/finance/tax-agencies/:id", financeSuite.updateTaxAgency);
router.delete("/finance/tax-agencies/:id", financeSuite.deleteTaxAgency);

router.get("/finance/tax-payments", financeSuite.listTaxPayments);
router.post("/finance/tax-payments", financeSuite.createTaxPayment);
router.delete("/finance/tax-payments/:id", financeSuite.deleteTaxPayment);

router.get("/finance/expenses", financeSuite.listExpenses);
router.post("/finance/expenses", financeSuite.createExpense);
router.put("/finance/expenses/:id", financeSuite.updateExpense);
router.delete("/finance/expenses/:id", financeSuite.deleteExpense);

router.get("/finance/purchases", financeSuite.listPurchases);
router.post("/finance/purchases", financeSuite.createPurchase);
router.put("/finance/purchases/:id", financeSuite.updatePurchase);
router.delete("/finance/purchases/:id", financeSuite.deletePurchase);

router.get("/finance/accounts", financeSuite.listAccounts);
router.post("/finance/accounts", financeSuite.createAccount);
router.put("/finance/accounts/:id", financeSuite.updateAccount);

router.get("/finance/journals", financeSuite.listJournals);
router.post("/finance/journals", financeSuite.createJournal);
router.delete("/finance/journals/:id", financeSuite.deleteJournal);

router.get("/finance/contacts", financeSuite.listContacts);
router.post("/finance/contacts", financeSuite.createContact);
router.put("/finance/contacts/:id", financeSuite.updateContact);
router.delete("/finance/contacts/:id", financeSuite.deleteContact);

router.get("/finance/transfers", financeSuite.listTransfers);
router.post("/finance/transfers", financeSuite.createTransfer);

router.get("/finance/reports/ledger", financeSuite.getLedgerReport);
router.get("/finance/reports/trial-balance", financeSuite.getTrialBalance);
router.get("/finance/reports/income-statement", financeSuite.getIncomeStatement);
router.get("/finance/reports/sales-tax", financeSuite.getSalesTaxReport);
router.get("/finance/reports/balance-sheet", financeSuite.getBalanceSheet);

router.get("/refunds", listRefunds);
router.post("/refunds", createRefund);
router.put("/refunds/:id", updateRefund);

router.get("/reports", getReports);
router.get("/analytics", getAnalytics);

router.get("/user-management/zones", listUserMgmtZones);
router.get("/user-management/zones/:zoneKey/stores", listUserMgmtStores);
router.get("/user-management/stores/:storeId/users", listUserMgmtStoreUsers);
router.get("/user-management/all-users", listAllUsersDirectory);
router.patch("/user-management/users/:userId/status", updateUserStatus);
router.put("/user-management/users/:userId/status", updateUserStatus);
router.patch("/user-management/users/:userId/toggle-block", toggleUserMgmtBlock);
router.get("/user-management/unblock-requests", listUnblockRequests);
router.patch("/user-management/unblock-requests/:id/review", reviewUnblockRequest);
router.put("/user-management/unblock-requests/:id/review", reviewUnblockRequest);

router.get("/assets-management/zones", listAssetZones);
router.get("/assets-management/zones/:zoneKey/stores", listAssetStores);
router.get("/assets-management/stores/:storeId/people", listAssetRolePeople);
router.get("/assets-management/stores/:storeId/assets", listAssets);
router.post("/assets-management/stores/:storeId/assets", createAsset);
router.put("/assets-management/assets/:id", updateAsset);
router.delete("/assets-management/assets/:id", deleteAsset);

/** Vendor (collection centre) HR: same controllers, limited to the vendor's farmer managers and pickup drivers. */
const vendorHrRouter = express.Router();
vendorHrRouter.use(requireVendor, attachVendorHrScope);

vendorHrRouter.get("/hr", listHrDirectory);
vendorHrRouter.post("/hr", createHrStaff);
vendorHrRouter.post("/hr/employment", upsertHrEmployment);
vendorHrRouter.get("/hr/roles", listHrRoles);
vendorHrRouter.get("/hr/people/:type/:id", getHrPerson);
vendorHrRouter.get("/hr/calendar", listHrCalendar);
vendorHrRouter.get("/hr/announcements", listHrAnnouncements);
vendorHrRouter.post("/hr/announcements", createHrAnnouncement);
vendorHrRouter.put("/hr/announcements/:id", updateHrAnnouncement);
vendorHrRouter.delete("/hr/announcements/:id", deleteHrAnnouncement);
vendorHrRouter.get("/hr/meetings", listHrMeetings);
vendorHrRouter.post("/hr/meetings", createHrMeeting);
vendorHrRouter.get("/hr/leave-policies", listHrLeavePolicies);
vendorHrRouter.put("/hr/leave-policies/:roleKey", upsertHrLeavePolicy);
vendorHrRouter.get("/hr/leaves", listHrLeaves);
vendorHrRouter.post("/hr/leaves", createHrLeave);
vendorHrRouter.put("/hr/leaves/:id", updateHrLeave);
vendorHrRouter.delete("/hr/leaves/:id", deleteHrLeave);
vendorHrRouter.get("/hr/shifts", listHrShifts);
vendorHrRouter.post("/hr/shifts", createHrShift);
vendorHrRouter.put("/hr/shifts/:id", updateHrShift);
vendorHrRouter.delete("/hr/shifts/:id", deleteHrShift);
vendorHrRouter.get("/hr/vacancies", listHrVacancies);
vendorHrRouter.post("/hr/vacancies", createHrVacancy);
vendorHrRouter.put("/hr/vacancies/:id", updateHrVacancy);
vendorHrRouter.get("/hr/candidates", listHrCandidates);
vendorHrRouter.post("/hr/candidates", createHrCandidate);
vendorHrRouter.get("/hr/candidates/:id", getHrCandidate);
vendorHrRouter.put("/hr/candidates/:id", updateHrCandidate);
vendorHrRouter.get("/hr/candidates/:id/cv", downloadHrCandidateCv);
vendorHrRouter.get("/hr/attendance", listHrAttendance);
vendorHrRouter.post("/hr/attendance", clockHrAttendance);
vendorHrRouter.get("/hr/attendance/report", getHrAttendanceReport);
vendorHrRouter.post("/hr/attendance/manual", markManualAttendance);
vendorHrRouter.put("/hr/attendance/:id", updateHrAttendance);
vendorHrRouter.delete("/hr/attendance/:id", deleteHrAttendance);
vendorHrRouter.get("/hr/tasks", listHrTasks);
vendorHrRouter.post("/hr/tasks", createHrTask);
vendorHrRouter.put("/hr/tasks/:id", updateHrTask);
vendorHrRouter.get("/hr/payroll", listHrPayroll);
vendorHrRouter.post("/hr/payroll/run", runHrPayroll);
vendorHrRouter.put("/hr/payroll/:id", updateHrPayroll);
vendorHrRouter.put("/hr/:id", updateHrStaff);

vendorHrRouter.get("/hr/promotions", listHrPromotions);
vendorHrRouter.post("/hr/promotions", createHrPromotion);
vendorHrRouter.put("/hr/promotions/:id", updateHrPromotion);
vendorHrRouter.delete("/hr/promotions/:id", deleteHrPromotion);

vendorHrRouter.get("/hr/increments", listHrIncrements);
vendorHrRouter.post("/hr/increments", createHrIncrement);
vendorHrRouter.put("/hr/increments/:id", updateHrIncrement);
vendorHrRouter.delete("/hr/increments/:id", deleteHrIncrement);

vendorHrRouter.get("/hr/performance", listHrPerformanceLogs);
vendorHrRouter.post("/hr/performance", createHrPerformanceLog);
vendorHrRouter.put("/hr/performance/:id", updateHrPerformanceLog);
vendorHrRouter.delete("/hr/performance/:id", deleteHrPerformanceLog);

export default [
  { path: "/api/admin-ops", router },
  { path: "/api/vendor/hr-ops", router: vendorHrRouter },
];
