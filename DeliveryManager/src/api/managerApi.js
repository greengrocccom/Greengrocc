import axios from "axios";
import { getApiBaseUrl } from "../config/apiBase.js";
import { configureRealtime, withLiveAdapter } from "../realtime/liveClient";

const API_URL = getApiBaseUrl();

export const api = withLiveAdapter(
  axios.create({
    baseURL: API_URL,
    headers: { "Content-Type": "application/json" },
  }),
  axios
);

configureRealtime({
  url: API_URL,
  getToken: () => String(api.defaults.headers.common.Authorization || "").replace(/^Bearer\s+/i, ""),
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

const BASE = "/api/delivery-managers";

export const managerApi = {
  register: (data) => api.post(`${BASE}/register`, data),
  login: (data) => api.post(`${BASE}/login`, data),
  me: () => api.get(`${BASE}/me`),
  dashboard: () => api.get(`${BASE}/dashboard`),
  revenue: (params) => api.get(`${BASE}/revenue`, { params }),
  liveAnnouncements: () =>
    api
      .get("/api/admin-ops/hr/announcements/live", { params: { role: "delivery_manager" } })
      .then((res) => res.data?.data || []),
  livePolicies: () =>
    api
      .get("/api/admin-ops/policies/live", { params: { role: "delivery_manager" } })
      .then((res) => res.data?.data || []),
  submitSupport: (data) => api.post("/api/support", data).then((res) => res.data),
  liveCalendar: () =>
    api
      .get("/api/admin-ops/hr/calendar/live", { params: { role: "delivery_manager" } })
      .then((res) => res.data?.data || []),
  applyLeave: (data) =>
    api.post("/api/admin-ops/hr/leaves/apply", data).then((res) => res.data?.data),
  myLeaves: () =>
    api.get("/api/admin-ops/hr/leaves/mine").then((res) => res.data?.data || []),
  orders: (params) => api.get(`${BASE}/orders`, { params }),
  preOrders: (params) => api.get(`${BASE}/preorders`, { params }),
  inventory: () => api.get(`${BASE}/inventory`),
  products: (params) => api.get(`${BASE}/products`, { params }),
  createProduct: (data) => api.post(`${BASE}/products`, data),
  updateProduct: (id, data) => api.put(`${BASE}/products/${id}`, data),
  deleteProduct: (id) => api.delete(`${BASE}/products/${id}`),
  setProductStock: (id, stock) => api.put(`${BASE}/products/${id}/stock`, { stock }),
  sections: () => api.get("/api/sections"),
  categories: (section) => api.get("/api/categories", { params: { section } }),
  uploadMedia: (files, folder = "products") => {
    const form = new FormData();
    [...files].forEach((file) => form.append("files", file));
    form.append("folder", folder);
    return api.post("/api/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  listInventoryRequests: (params) =>
    api.get(`${BASE}/inventory-requests`, { params }),
  requestInventory: (data) => api.post(`${BASE}/inventory-requests`, data),
  riders: () => api.get(`${BASE}/riders`),
  getDriverDetails: (driverId) => api.get(`${BASE}/drivers/${driverId}`),
  getDriverActivityHistory: (driverId, range = "week") =>
    api.get(`${BASE}/drivers/${driverId}/activity-history`, { params: { range } }),
  toggleRiderActive: (driverId) => api.post(`${BASE}/drivers/${driverId}/toggle-active`),
  createRider: (data) => api.post(`${BASE}/riders`, data),
  pendingRiders: () => api.get(`${BASE}/riders/pending`),
  verifyRider: (riderId, body) =>
    api.post(`${BASE}/riders/${riderId}/verify`, body),
  informCustomer: (orderId, itemId) =>
    api.post(`${BASE}/orders/${orderId}/inform-customer`, { itemId }),
  packOrder: (orderId, body = {}) =>
    api.post(`${BASE}/orders/${orderId}/pack`, body),
  createDemoOrder: (body) => api.post(`${BASE}/orders/demo`, body || {}),
  assignOrder: (orderId, riderId) =>
    api.post(`${BASE}/orders/${orderId}/assign`, { riderId }),
  assignPreOrders: (riderId, orderIds) =>
    api.post(`${BASE}/preorders/assign`, { riderId, orderIds }),
  receivePreOrders: (orderIds) => api.post(`${BASE}/preorders/receive`, { orderIds }),
  preOrdersOutForDelivery: (orderIds) => api.post(`${BASE}/preorders/out-for-delivery`, { orderIds }),
  deliverPreOrders: (orderIds, reason) => api.post(`${BASE}/preorders/deliver`, { orderIds, reason }),
  routeSuggestions: () => api.get(`${BASE}/orders/route-suggestions`),
  dispatchOrderNow: (orderId) =>
    api.post(`${BASE}/orders/${orderId}/dispatch-now`),
  assignSameRoute: (body) =>
    api.post(`${BASE}/orders/assign-same-route`, body),
  markDelivered: (orderId, reason) =>
    api.patch(`${BASE}/orders/${orderId}/delivered`, { reason }),
  resolveFailedOrder: (orderId, action, note = "") =>
    api.post(`${BASE}/orders/${orderId}/failed/${action}`, { note }),
  reviewOnlinePayment: (orderId, decision, note = "") =>
    api.post(`${BASE}/orders/${orderId}/online-payment/${decision}`, { note }),
  handOverPickup: (orderId, otp) =>
    api.post(`${BASE}/orders/${orderId}/pickup-handover`, { otp }),
  cancelOrder: (orderId) =>
    api.post(`${BASE}/orders/${orderId}/cancel`),
  notifyCustomerOfDelay: (orderId, message = "") =>
    api.post(`${BASE}/orders/${orderId}/delay/notify-customer`, { message }),
  orderTracking: (orderId) => api.get(`${BASE}/orders/${orderId}/tracking`),
  getPickupQr: (orderId) => api.get(`${BASE}/orders/${orderId}/pickup-qr`),
  verifyPickup: (orderId, qrPayload) =>
    api.post(`${BASE}/orders/${orderId}/verify-pickup`, { qrPayload }),
  approvePickupProof: (orderId) =>
    api.post(`${BASE}/orders/${orderId}/approve-pickup-proof`),
  confirmOrderCash: (orderId) =>
    api.post(`${BASE}/orders/${orderId}/confirm-cash`),

  returnPickups: (params) => api.get(`${BASE}/return-pickups`, { params }),
  returnPickup: (id) => api.get(`${BASE}/return-pickups/${id}`),
  assignReturnPickup: (id, riderId) =>
    api.post(`${BASE}/return-pickups/${id}/assign`, { riderId }),
  getReturnPickupQr: (id) => api.get(`${BASE}/return-pickups/${id}/pickup-qr`),
  approveReturnProof: (id) => api.post(`${BASE}/return-pickups/${id}/approve-proof`),
  markReturnSuccessful: (id, body = {}) =>
    api.post(`${BASE}/return-pickups/${id}/mark-successful`, body),

  // Shift & Slot Management APIs
  createShift: (data) => api.post(`${BASE}/shifts`, data),
  getShifts: () => api.get(`${BASE}/shifts`),
  getManagerSlots: (date, params = {}) =>
    api.get(`${BASE}/shifts/slots`, { params: { date, ...params } }),
  updateSlotDateWise: (slotId, data) => api.put(`${BASE}/shifts/slots/${slotId}`, data),
  deleteSlotDateWise: (slotId, data = {}) =>
    api.delete(`${BASE}/shifts/slots/${slotId}`, { data }),
  getSlotDetailsWithRiders: (slotId) => api.get(`${BASE}/shifts/slots/${slotId}/details`),
  getAssignableRiders: () => api.get(`${BASE}/shifts/assignable-riders`),
  assignSlotRiders: (slotId, body) => api.post(`${BASE}/shifts/slots/${slotId}/assign`, body),
  unassignSlotRider: (slotId, riderId) =>
    api.delete(`${BASE}/shifts/slots/${slotId}/assign/${riderId}`),
  getShiftEarningSlabs: (shiftId) => api.get(`${BASE}/shifts/${shiftId}/earning-slabs`),
  updateShiftEarningSlabs: (shiftId, deliveryEarningSlabs) =>
    api.put(`${BASE}/shifts/${shiftId}/earning-slabs`, { deliveryEarningSlabs }),

  // Gig & Incentive Management APIs
  createGig: (data) => api.post(`${BASE}/gigs`, data),
  getGigs: (date) => api.get(`${BASE}/gigs`, { params: { date } }),
  updateGig: (gigId, data) => api.put(`${BASE}/gigs/${gigId}`, data),
  deleteGig: (gigId) => api.delete(`${BASE}/gigs/${gigId}`),

  // Alerts & Incentives APIs
  getAlerts: (params) => api.get(`/api/alerts`, { params }),
  markAlertRead: (alertId) => api.patch(`/api/alerts/${alertId}/read`),
  getStoreIncentives: (params) => api.get(`/api/incentives/store-summary`, { params }),
  getRiderIncentives: (riderId, params) => api.get(`/api/incentives/rider`, { params: { riderId, ...params } }),

  // Full-Time Management APIs
  getFullTimeConfig: () => api.get(`${BASE}/fulltime-config`),
  setFullTimeConfig: (data) => api.put(`${BASE}/fulltime-config`, data),
  getFullTimeRules: () => api.get(`${BASE}/fulltime-rules`),
  createFullTimeRule: (data) => api.post(`${BASE}/fulltime-rules`, data),
  updateFullTimeRule: (id, data) => api.put(`${BASE}/fulltime-rules/${id}`, data),
  deleteFullTimeRule: (id) => api.delete(`${BASE}/fulltime-rules/${id}`),
  getFullTimeShifts: () => api.get(`${BASE}/fulltime/shifts`),
  createFullTimeShift: (data) => api.post(`${BASE}/fulltime/shifts`, data),
  updateFullTimeShift: (id, data) => api.put(`${BASE}/fulltime/shifts/${id}`, data),
  deleteFullTimeShift: (id) => api.delete(`${BASE}/fulltime/shifts/${id}`),
  getFullTimeDrivers: () => api.get(`${BASE}/fulltime/drivers`),
  getFullTimeDriver: (driverId) => api.get(`${BASE}/fulltime/drivers/${driverId}`),
  setFullTimeDriverSalary: (driverId, monthlySalary) =>
    api.put(`${BASE}/fulltime/drivers/${driverId}/salary`, { monthlySalary }),
  creditFullTimeSalary: (driverId, body = {}) =>
    api.post(`${BASE}/fulltime/drivers/${driverId}/credit-salary`, body),
  setDriverEmploymentType: (driverId, employmentType) =>
    api.put(`${BASE}/drivers/${driverId}/employment-type`, { employmentType }),
  getFullTimeAttendance: (date) => api.get(`${BASE}/fulltime/attendance`, { params: { date } }),
  getFullTimeAssignableOrders: () => api.get(`${BASE}/fulltime/assignable-orders`),
  getFullTimeAssignedOrders: (riderId) =>
    api.get(`${BASE}/fulltime/assigned-orders`, { params: riderId ? { riderId } : {} }),
  assignOrdersToFullTime: (riderId, orderIds) =>
    api.post(`${BASE}/fulltime/assign-orders`, { riderId, orderIds }),
  unassignFullTimeOrder: (orderId) => api.post(`${BASE}/fulltime/orders/${orderId}/unassign`),
};
