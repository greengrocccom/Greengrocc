import axios from "axios";
import { getApiBaseUrl } from "../config/env";
import { withLiveAdapter } from "../realtime/liveClient";
import { setRealtimeTokenSource, syncRealtimeToken } from "../realtime/setup";

export const api = withLiveAdapter(
  axios.create({
    headers: { "Content-Type": "application/json" },
  }),
  axios
);

export function getActiveAuthToken() {
  const keys = [
    "greengrocc_vendor_auth",
    "greengrocc_product_manager_auth",
    "greengrocc_driver_auth",
    "token",
  ];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) return parsed.token;
      } else if (raw.length > 20) {
        return raw;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

setRealtimeTokenSource(getActiveAuthToken);

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  syncRealtimeToken();
  const token = getActiveAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export const staffApi = {
  login: (data) => api.post("/api/staff/login", data),
  me: () => api.get("/api/staff/me"),
  list: (params) => api.get("/api/staff", { params }),
  create: (data) => api.post("/api/staff", data),
  hierarchy: () => api.get("/api/staff/hierarchy"),
  inventoryRequests: (params) =>
    api.get("/api/staff/inventory-requests", { params }),
  reviewInventoryRequest: (requestId, data) =>
    api.patch(`/api/staff/inventory-requests/${requestId}`, data),
  liveAnnouncements: (role) =>
    api
      .get("/api/admin-ops/hr/announcements/live", { params: { role } })
      .then((res) => res.data?.data || []),
  liveCalendar: (role) =>
    api
      .get("/api/admin-ops/hr/calendar/live", { params: { role } })
      .then((res) => res.data?.data || []),
};
