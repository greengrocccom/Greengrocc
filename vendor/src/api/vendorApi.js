import axios from "axios";
import { getApiBaseUrl } from "../config/env";
import { withLiveAdapter } from "../realtime/liveClient";
import { syncRealtimeToken } from "../realtime/setup";
import "./staffApi";
const VENDOR_STORAGE_KEY = "greengroo_vendor_auth";

export const api = withLiveAdapter(
  axios.create({
    headers: { "Content-Type": "application/json" },
  }),
  axios
);

export function setVendorToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

function getStoredVendorToken() {
  try {
    const raw = localStorage.getItem(VENDOR_STORAGE_KEY);
    return raw ? JSON.parse(raw)?.token : null;
  } catch { return null; }
}

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  syncRealtimeToken();
  const token = getStoredVendorToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

export const vendorApi = {
  getOrderManagement: (params, signal) => api.get("/api/vendor/orders-management", { params, signal }),
  // Auth & Profile
  login: (data) => api.post("/api/vendor/auth/login", data),
  sendLoginOtp: (data) => api.post("/api/vendor/auth/login/send-otp", data),
  resendLoginOtp: (data) => api.post("/api/vendor/auth/login/resend-otp", data),
  me: () => api.get("/api/vendor/auth/me"),
  getProfile: () => api.get("/api/vendor/auth/me"),
  updateProfile: (data) => api.put("/api/vendor/auth/me", data),
  getSettings: () => api.get("/api/vendor/settings"),
  updateSettings: (data) => api.put("/api/vendor/settings", data),

  // Vacation Mode
  getVacation: () => api.get("/api/vendor/vacation").then((res) => res.data),
  updateVacation: (data) => api.put("/api/vendor/vacation", data).then((res) => res.data),

  // Vendor Reviews
  getReviews: (params) => api.get("/api/vendor/reviews", { params }).then((res) => res.data),
  replyReview: (reviewId, replyText) =>
    api.post(`/api/vendor/reviews/${encodeURIComponent(reviewId)}/reply`, { replyText }).then((res) => res.data),
  getPublicStoreReviews: (vendorId) =>
    api.get(`/api/vendor/public-store/${encodeURIComponent(vendorId)}/reviews`).then((res) => res.data),
  createPublicStoreReview: (vendorId, data) =>
    api.post(`/api/vendor/public-store/${encodeURIComponent(vendorId)}/reviews`, data).then((res) => res.data),
  getPublicStoreVacation: (vendorId) =>
    api.get(`/api/vendor/public-store/${encodeURIComponent(vendorId)}/vacation`).then((res) => res.data),

  getSalesSummary: (params, signal) => api.get("/api/vendor/sales-summary", { params, signal }),

  // Dashboard
  getDashboard: (params) => api.get("/api/vendor/dashboard", { params }),
  getInventoryAlerts: () => api.get("/api/vendor/inventory-alerts"),
  saveInventoryAlert: (data) => api.put("/api/vendor/inventory-alerts", data),
  deleteInventoryAlert: (alertId) => api.delete(`/api/vendor/inventory-alerts/${encodeURIComponent(alertId)}`),
  getAllFarmerInventory: () => api.get("/api/vendor/farmer-inventory"),
  getNotificationReadState: () =>
    api.get("/api/vendor/notifications/read-state").then((res) => res.data?.readIds || []),
  markNotificationsRead: (ids) =>
    api.post("/api/vendor/notifications/read", { ids }).then((res) => res.data?.readIds || []),
  liveAnnouncements: () =>
    api
      .get("/api/admin-ops/hr/announcements/live", { params: { role: "vendor" } })
      .then((res) => res.data?.data || []),
  livePolicies: () =>
    api
      .get("/api/admin-ops/policies/live", { params: { role: "vendor" } })
      .then((res) => res.data?.data || []),
  submitSupport: (data) => api.post("/api/support", { ...data, roleKey: data.roleKey || "vendor" }).then((res) => res.data),
  getCustomerSupport: () => api.get("/api/vendor/customer-support").then((res) => res.data),
  updateCustomerSupport: (data) => api.put("/api/vendor/customer-support", data).then((res) => res.data),
  liveCalendar: () =>
    api
      .get("/api/admin-ops/hr/calendar/live", { params: { role: "vendor" } })
      .then((res) => res.data?.data || []),
  applyLeave: (data) =>
    api.post("/api/admin-ops/hr/leaves/apply", data).then((res) => res.data?.data),
  myLeaves: () =>
    api.get("/api/admin-ops/hr/leaves/mine").then((res) => res.data?.data || []),

  // Managers
  getManagers: (params) => api.get("/api/vendor/managers", { params }),
  getManagerById: (id) => api.get(`/api/vendor/managers/${encodeURIComponent(id)}`),
  createManager: (data) => api.post("/api/vendor/managers", data),
  updateManager: (id, data) => api.put(`/api/vendor/managers/${encodeURIComponent(id)}`, data),
  deleteManager: (id) => api.delete(`/api/vendor/managers/${encodeURIComponent(id)}`),
  setManagerStatus: (id, status) =>
    api.patch(`/api/vendor/managers/${encodeURIComponent(id)}/status`, { status }),

  // Farmers
  getFarmers: (params) => api.get("/api/vendor/farmers", { params }),
  getFarmerById: (id) => api.get(`/api/vendor/farmers/${id}`),
  getCrops: () => api.get("/api/vendor/crops"),
  getAllCrops: () => api.get("/api/vendor/crops"),
  getFarmerCropRequests: (params) => api.get("/api/vendor/farmer-crop-requests", { params }),
  reviewFarmerCrop: (farmerId, cropId, decision, reason = "") =>
    api.patch(
      `/api/vendor/farmers/${encodeURIComponent(farmerId)}/crops/${encodeURIComponent(cropId)}/review`,
      { decision, reason }
    ),
  getCropsCatalog: () => api.get("/api/vendor/crops/catalog").then((res) => res.data || []).catch(() => []),
  getFarmerCrops: (id) => api.get(`/api/vendor/farmers/${encodeURIComponent(id)}/crops`),
  getFarmerCrop: (farmerId, cropId) => api.get(`/api/vendor/farmers/${encodeURIComponent(farmerId)}/crops/${encodeURIComponent(cropId)}`),
  createFarmerCrop: (farmerId, data) => api.post(`/api/vendor/farmers/${encodeURIComponent(farmerId)}/crops`, data),
  updateFarmerCrop: (farmerId, cropId, data) => api.put(`/api/vendor/farmers/${encodeURIComponent(farmerId)}/crops/${encodeURIComponent(cropId)}`, data),
  deleteFarmerCrop: (farmerId, cropId) => api.delete(`/api/vendor/farmers/${encodeURIComponent(farmerId)}/crops/${encodeURIComponent(cropId)}`),
  getFarmerProducts: (id) => api.get(`/api/vendor/farmers/${encodeURIComponent(id)}/products`),
  createFarmerProduct: (farmerId, data) =>
    api.post(`/api/vendor/farmers/${encodeURIComponent(farmerId)}/products`, data),
  reviewFarmerProduct: (farmerId, productId, decision, reason = "") =>
    api.patch(`/api/vendor/farmers/${encodeURIComponent(farmerId)}/products/${encodeURIComponent(productId)}/review`, { decision, reason }),
  getProducts: () => api.get("/api/vendor/products"),
  liveSearch: (params) => api.get("/api/vendor/live-search", { params }),
  getFarmerInventory: (id) => api.get(`/api/vendor/farmers/${encodeURIComponent(id)}/inventory`),
  getFarmerOrders: (id) => api.get(`/api/vendor/farmers/${encodeURIComponent(id)}/orders`),
  getFarmerEarnings: (id) => api.get(`/api/vendor/farmers/${encodeURIComponent(id)}/earnings`),
  getFarmerDocuments: (id) => api.get(`/api/vendor/farmers/${encodeURIComponent(id)}/documents`),
  uploadFarmerDocument: (id, data) => api.post(`/api/vendor/farmers/${encodeURIComponent(id)}/documents`, data),
  updateFarmerDocumentStatus: (id, docId, status, rejectionReason = "") =>
    api.patch(`/api/vendor/farmers/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}/status`, { status, rejectionReason }),
  createFarmer: (data) => api.post("/api/vendor/farmers", data),
  updateFarmer: (id, data) => api.put(`/api/vendor/farmers/${id}`, data),
  deleteFarmer: (id) => api.delete(`/api/vendor/farmers/${id}`),
  setFarmerStatus: (id, status) => api.patch(`/api/vendor/farmers/${id}/status`, { status }),
  assignFarmerManager: (farmerId, managerId) => api.put(`/api/vendor/farmers/${farmerId}/manager`, { managerId }),

  // Drivers (Pickup Drivers from Farmers)
  getDrivers: (params) => api.get("/api/vendor/drivers", { params }),
  getDriverById: (id) => api.get(`/api/vendor/drivers/${id}`),
  createDriver: (data) => api.post("/api/vendor/drivers", data),
  updateDriver: (id, data) => api.put(`/api/vendor/drivers/${id}`, data),
  setDriverStatus: (id, status) => api.patch(`/api/vendor/drivers/${id}/status`, { status }),
  deleteDriver: (id) => api.delete(`/api/vendor/drivers/${id}`),

  // Delivery Boys (Orders to Customers from Dark Stores)
  getDeliveryBoys: (params) => api.get("/api/vendor/delivery-boys", { params }),
  createDeliveryBoy: (data) => api.post("/api/vendor/delivery-boys", data),
  deleteDeliveryBoy: (id) => api.delete(`/api/vendor/delivery-boys/${encodeURIComponent(id)}`),

  // Shipping Methods (Quantity, User, Pin Code, Category, Weight, State)
  getShippingMethods: () => api.get("/api/vendor/shipping-methods"),
  saveShippingMethods: (data) => api.put("/api/vendor/shipping-methods", data),
  calculateShipping: (data) => api.post("/api/vendor/shipping-methods/calculate", data),

  // Pickups
  getPickups: (params) => api.get("/api/vendor/pickups", { params }),
  getPickup: (id) => api.get(`/api/vendor/pickups/${id}`),
  getBatch: (id) => api.get(`/api/vendor/batches/${encodeURIComponent(id)}`),
  assignPickupDriver: (id, driverId) => api.post(`/api/vendor/pickups/${id}/assign`, { driverId }),
  reservePickupBatchId: () => api.post("/api/vendor/pickup-batches/new"),
  createPickupBatch: (data) => api.post("/api/vendor/pickup-batches", data),
  assignPickupBatchDriver: (batchId, driverId) =>
    api.post(`/api/vendor/pickup-batches/${encodeURIComponent(batchId)}/assign`, { driverId }),
  ungroupPickupBatch: (batchId, pickupIds) =>
    api.post(`/api/vendor/pickup-batches/${encodeURIComponent(batchId)}/ungroup`, { pickupIds }),
  reassignPickupDriver: (id, driverId) => api.post(`/api/vendor/pickups/${id}/reassign`, { driverId }),
  startPickup: (id, driverId) => api.post(`/api/vendor/pickups/${id}/start`, { driverId }),
  arrivePickup: (id, driverId) => api.post(`/api/vendor/pickups/${id}/arrive`, { driverId }),
  receivePickup: (id, data) => api.post(`/api/vendor/pickups/${id}/receive`, data),
  getPickupReceipt: (id) => api.get(`/api/vendor/pickups/${id}/receipt`),
  getCollectionCentres: () => api.get("/api/vendor/collection-centres"),
  createCollectionCentre: (data) => api.post("/api/vendor/collection-centres", data),

  // Dark stores (created only after admin approval)
  getZones: () => api.get("/api/vendor/zones"),
  createZone: (data) => api.post("/api/vendor/zones", data),
  cancelZone: (id) => api.post(`/api/vendor/zones/${id}/cancel`),
  getDarkStoreRequests: () => api.get("/api/vendor/dark-store-requests"),
  createDarkStoreRequest: (data) => api.post("/api/vendor/dark-store-requests", data),
  cancelDarkStoreRequest: (id) => api.post(`/api/vendor/dark-store-requests/${id}/cancel`),

  // Customer pre-orders for the vendor's dark stores
  getPreOrders: (params) => api.get("/api/vendor/preorders", { params }),
  confirmPreOrders: (orderIds) => api.post("/api/vendor/preorders/confirm", { orderIds }),
  packPreOrders: (orderIds) => api.post("/api/vendor/preorders/pack", { orderIds }),
  shipPreOrders: (orderIds) => api.post("/api/vendor/preorders/ship", { orderIds }),
  getPreOrderFarmerRequests: () => api.get("/api/vendor/preorders/farmer-requests"),
  createPreOrderFarmerRequest: (orderId, data) =>
    api.post(`/api/vendor/preorders/${encodeURIComponent(orderId)}/farmer-request`, data),
  rejectPreOrder: (orderId, reason) =>
    api.post(`/api/vendor/preorders/${encodeURIComponent(orderId)}/reject`, { reason }),
  getPreOrderSlotAvailability: (date) =>
    api.get("/api/settings/preorder-slots", { params: date ? { date } : {} }),

  // Products from the admin catalog (added only after admin approval)
  getMyProducts: () => api.get("/api/vendor/my-products"),
  addStockProduct: (data) => api.post("/api/vendor/stock/add", data),
  deductStockProduct: (data) => api.post("/api/vendor/stock/deduct", data),
  getStockBatches: (params) => api.get("/api/vendor/stock/batches", { params }),
  getStockTransactions: (params) => api.get("/api/vendor/stock/transactions", { params }),
  getNextBatchId: (receivedDate) =>
    api.get("/api/vendor/stock/next-batch-id", { params: receivedDate ? { receivedDate } : {} }),
  updateMyProduct: (productId, data) => api.patch(`/api/vendor/my-products/${productId}`, data),
  getMyProductFull: (productId) => api.get(`/api/vendor/my-products/${encodeURIComponent(productId)}/full`),
  deleteMyProduct: (productId) => api.delete(`/api/vendor/my-products/${encodeURIComponent(productId)}`),
  getCatalogProducts: (params) => api.get("/api/vendor/catalog-products", { params }),
  createProductRequest: (data) => api.post("/api/vendor/product-requests", data),
  cancelProductRequest: (id) => api.post(`/api/vendor/product-requests/${id}/cancel`),

  // Crops from the admin crop list (added only after admin approval)
  getMyCrops: () => api.get("/api/vendor/my-crops"),
  getCatalogCrops: (params) => api.get("/api/vendor/catalog-crops", { params }),
  createCropRequest: (data) => api.post("/api/vendor/crop-requests", data),
  cancelCropRequest: (id) => api.post(`/api/vendor/crop-requests/${id}/cancel`),

  // Quality & Grading
  getQualityPending: (params) => api.get("/api/quality/pending", { params }),
  getQuality: (orderId) => api.get(`/api/quality/${orderId}`),
  startQuality: (orderId) => api.post(`/api/quality/${orderId}/start`),
  uploadQualityPhotos: (orderId, data) => api.post(`/api/quality/${orderId}/photos`, data),
  saveQualityParameters: (orderId, data) => api.patch(`/api/quality/${orderId}/parameters`, data),
  saveQualityGrading: (orderId, data) => api.patch(`/api/quality/${orderId}/grading`, data),
  confirmQuality: (orderId) => api.post(`/api/quality/${orderId}/confirm`),
  getQualitySummary: (orderId) => api.get(`/api/quality/${orderId}/final-summary`),
  getQualityReport: (orderId) => api.get(`/api/quality/${orderId}/report`),
  updateOrderPayment: (orderId, data) => api.patch(`/api/quality/${orderId}/payment`, data),
  verifyQualityQr: (data) => api.post("/api/quality/verify-qr", data),
  uploadLabReport: (orderId, data) => api.post(`/api/quality/${orderId}/lab-reports`, data),
  deleteLabReport: (orderId, reportId) => api.delete(`/api/quality/${orderId}/lab-reports/${reportId}`),

  // Market Prices (APMC Mandi Rates & Trends)
  getLiveMarketPrices: (params) => api.get("/api/admin-ops/market-prices/live", { params }).then((res) => res.data),
  getMarketPrices: (params) => api.get("/api/admin-ops/market-prices", { params }).then((res) => res.data),

  // Pre-Order Slots Configuration
  getPreOrderSlots: () => api.get("/api/settings").then((res) => res.data?.data?.preOrderSlots || res.data?.preOrderSlots || []),
  savePreOrderSlots: (slots) => api.put("/api/settings", { preOrderSlots: slots }).then((res) => res.data),

  // Bulk & CSV Import / Export
  exportProductsJson: () => api.get("/api/admin-ops/bulk/products").then((res) => res.data),
  importProductsJson: (products) => api.post("/api/admin-ops/bulk/products", { products }).then((res) => res.data),
  exportProductsCsv: () => api.get("/api/admin-ops/csv/products").then((res) => res.data),
  importProductsCsv: (csv) => api.post("/api/admin-ops/csv/products", { csv }).then((res) => res.data),
  // ── Vendor Finance & Profit Management ────────────────────────
  getFinanceDashboard: (params) => api.get("/api/vendor/finance/dashboard", { params }).then((res) => res.data),
  getFinanceSalesReports: (params) => api.get("/api/vendor/finance/sales-reports", { params }).then((res) => res.data),
  getFinanceSellerReports: (params) => api.get("/api/vendor/finance/seller-reports", { params }).then((res) => res.data),
  getFarmerPayments: (params) => api.get("/api/vendor/finance/farmer-payments", { params }).then((res) => res.data),
  getFarmerPaymentDetail: (farmerId) => api.get(`/api/vendor/finance/farmer-payments/${encodeURIComponent(farmerId)}`).then((res) => res.data),
  getDarkStoreReports: (params) => api.get("/api/vendor/finance/delivery-manager-reports", { params }).then((res) => res.data),
  getDarkStoreDetail: (storeId) => api.get(`/api/vendor/finance/delivery-manager-reports/${encodeURIComponent(storeId)}`).then((res) => res.data),
  getExpenses: (params) => api.get("/api/vendor/finance/expenses", { params }).then((res) => res.data),
  createExpense: (data) => api.post("/api/vendor/finance/expenses", data).then((res) => res.data),
  updateExpense: (id, data) => api.put(`/api/vendor/finance/expenses/${encodeURIComponent(id)}`, data).then((res) => res.data),
  deleteExpense: (id) => api.delete(`/api/vendor/finance/expenses/${encodeURIComponent(id)}`).then((res) => res.data),
  getProfitLoss: (params) => api.get("/api/vendor/finance/profit-loss", { params }).then((res) => res.data),
  getSettlements: (params) => api.get("/api/vendor/finance/settlements", { params }).then((res) => res.data),
  createSettlement: (data) => api.post("/api/vendor/finance/settlements", data).then((res) => res.data),
  recordSettlementPayment: (id, data) => api.post(`/api/vendor/finance/settlements/${encodeURIComponent(id)}/pay`, data).then((res) => res.data),

};

export { VENDOR_STORAGE_KEY };
