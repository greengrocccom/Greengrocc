import axios from "axios";
import { configureRealtime, reconnectRealtime, withLiveAdapter } from "../realtime/liveClient";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5001").replace(
  /\/+$/,
  ""
);

export const api = withLiveAdapter(
  axios.create({
    baseURL: API_URL,
    headers: { "Content-Type": "application/json" },
  }),
  axios
);

const AUTH_STORAGE_KEY = "greengrocc_product_manager_auth";

function storedToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw).token || "" : "";
  } catch {
    return "";
  }
}

configureRealtime({
  url: API_URL,
  getToken: () =>
    String(api.defaults.headers.common.Authorization || "").replace(/^Bearer\s+/i, "") || storedToken(),
});

api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      const token = raw ? JSON.parse(raw).token : null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      /* ignore */
    }
  }
  return config;
});

let socketToken = null;

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
  if ((token || null) !== socketToken) {
    socketToken = token || null;
    reconnectRealtime();
  }
}

export const staffApi = {
  login: (data) => api.post("/api/staff/login", data),
  me: () => api.get("/api/staff/me"),
  inventoryRequests: (params) =>
    api.get("/api/staff/inventory-requests", { params }),
  reviewInventoryRequest: (requestId, data) =>
    api.patch(`/api/staff/inventory-requests/${requestId}`, data),
  preOrders: (params) => api.get("/api/staff/preorders", { params }),
  updatePreOrderStage: (orderId, stage) =>
    api.patch(`/api/staff/preorders/${orderId}/stage`, { stage }),
  forwardPreOrders: (orderIds, note = "") =>
    api.post("/api/staff/preorders/forward", { orderIds, note }),
  cancelPreOrder: (orderId, reason) =>
    api.post(`/api/staff/preorders/${orderId}/cancel`, { reason }),
  liveAnnouncements: (role) =>
    api
      .get("/api/admin-ops/hr/announcements/live", { params: { role } })
      .then((res) => res.data?.data || []),
  livePolicies: (role) =>
    api
      .get("/api/admin-ops/policies/live", { params: { role } })
      .then((res) => res.data?.data || []),
  submitSupport: (data) => api.post("/api/support", data).then((res) => res.data),
  liveCalendar: (role) =>
    api
      .get("/api/admin-ops/hr/calendar/live", { params: { role } })
      .then((res) => res.data?.data || []),
  applyLeave: (data) =>
    api.post("/api/admin-ops/hr/leaves/apply", data).then((res) => res.data?.data),
  myLeaves: () =>
    api.get("/api/admin-ops/hr/leaves/mine").then((res) => res.data?.data || []),
};
