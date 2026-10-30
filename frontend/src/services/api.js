import axios from "axios";
import { storeLocationParams } from "../utils/deliveryLocation";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const url = `${config.baseURL || ""}${config.url || ""}`;
  if (/\/products|\/stores|\/categories/.test(url)) {
    config.params = { ...storeLocationParams(), ...(config.params || {}) };
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
