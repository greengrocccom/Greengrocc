import axios from "axios";
import { getApiBaseUrl } from "../config/env";
import { withLiveAdapter } from "../realtime/liveClient";
import { syncRealtimeToken } from "../realtime/setup";
import "./staffApi";
export const DRIVER_STORAGE_KEY = "greengrocc_driver_auth";

export const driverHttp = withLiveAdapter(
  axios.create({
    headers: { "Content-Type": "application/json" },
  }),
  axios
);

function getStoredDriverToken() {
  try {
    const raw = localStorage.getItem(DRIVER_STORAGE_KEY);
    return raw ? JSON.parse(raw)?.token : null;
  } catch {
    return null;
  }
}

driverHttp.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  syncRealtimeToken();
  const token = getStoredDriverToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

export const driverApi = {
  login: (data) => driverHttp.post("/api/vendor/auth/driver/login", data),
  me: () => driverHttp.get("/api/vendor/auth/driver/me"),
  getPickups: (params) => driverHttp.get("/api/vendor/driver-desk/pickups", { params }),
  getPickup: (id) => driverHttp.get(`/api/vendor/driver-desk/pickups/${id}`),
  getBatch: (id) => driverHttp.get(`/api/vendor/driver-desk/batches/${encodeURIComponent(id)}`),
  start: (id) => driverHttp.post(`/api/vendor/driver-desk/pickups/${id}/start`),
  arrive: (id) => driverHttp.post(`/api/vendor/driver-desk/pickups/${id}/arrive`),
  checkOrder: (id) => driverHttp.post(`/api/vendor/driver-desk/pickups/${id}/check-order`),
  verifyQr: (id, payload) => driverHttp.post(`/api/vendor/driver-desk/pickups/${id}/verify-qr`, payload),
  confirm: (id, payload = {}) => driverHttp.post(`/api/vendor/driver-desk/pickups/${id}/confirm`, payload),
  transit: (id) => driverHttp.post(`/api/vendor/driver-desk/pickups/${id}/transit`),
  arriveCentre: (id) => driverHttp.post(`/api/vendor/driver-desk/pickups/${id}/arrive-centre`),
  liveAnnouncements: () =>
    driverHttp
      .get("/api/admin-ops/hr/announcements/live", { params: { role: "pickup_driver" } })
      .then((res) => res.data?.data || []),
  livePolicies: () =>
    driverHttp
      .get("/api/admin-ops/policies/live", { params: { role: "pickup_driver" } })
      .then((res) => res.data?.data || []),
  liveCalendar: () =>
    driverHttp
      .get("/api/admin-ops/hr/calendar/live", { params: { role: "pickup_driver" } })
      .then((res) => res.data?.data || []),
  applyLeave: (data) =>
    driverHttp.post("/api/admin-ops/hr/leaves/apply", data).then((res) => res.data?.data),
  myLeaves: () =>
    driverHttp.get("/api/admin-ops/hr/leaves/mine").then((res) => res.data?.data || []),
};
