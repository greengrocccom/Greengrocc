import axios from "axios";
import { STORAGE_KEY } from "../utils/authStorage";
import { storeLocationParams } from "../utils/deliveryLocation";
import { configureRealtime, withLiveAdapter } from "../realtime/liveClient";

function normalizeApiBaseUrl() {
  const raw = (import.meta.env.VITE_API_URL || "http://localhost:5001").trim();
  return raw.replace(/\/+$/, "");
}

export const API_URL = normalizeApiBaseUrl();

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_URL ? `${API_URL}${normalizedPath}` : normalizedPath;
}

const api = withLiveAdapter(
  axios.create({
    baseURL: API_URL,
  }),
  axios
);

configureRealtime({ url: API_URL, getToken: () => getRequestToken() });

function getRequestToken() {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    const { token } = JSON.parse(stored);
    return token || null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = getRequestToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  const url = `${config.baseURL || ""}${config.url || ""}`;
  if (/\/api\/products|\/api\/stores|\/api\/categories/.test(url)) {
    config.params = { ...storeLocationParams(), ...(config.params || {}) };
  }

  return config;
});

export const getHeroBanners = (device = "desktop") =>
  api.get("/api/herobanners", { params: { device } });

export const getOfferBanners = (device = "desktop") =>
  api.get("/api/offerbanners", { params: { device } });

export const getBanners = (params) => api.get("/api/banners", { params });

export const getCategories = (params) => api.get("/api/categories", { params });
export const getCategoryById = (id) => api.get(`/api/categories/${id}`);
export const getSections = (params) => api.get("/api/sections", { params });

export const getBrands = () => api.get("/api/brands");
export const getTestimonials = () => api.get("/api/testimonials");

export const getStoreSettings = () => api.get("/api/settings");

export const getProducts = (params) => api.get("/api/products", { params });
export const getProductById = (id) => api.get(`/api/products/${id}`);
export const getProductReviews = (id) => api.get(`/api/products/${id}/reviews`);
export const submitProductReview = (id, data) =>
  api.post(`/api/products/${id}/reviews`, data);
export const getProductVarieties = (id, params) =>
  api.get(`/api/products/${id}/varieties`, { params });
export const getSimilarProducts = (id, params) =>
  api.get(`/api/products/${id}/similar`, { params });
export const getNearestStore = (params) =>
  api.get("/api/stores/nearest", { params });
export const getActiveDarkStores = () =>
  api.get("/api/stores/all");

export const getCart = () => api.get("/api/cart");
export const addToCartItem = (data) => api.post("/api/cart", data);
export const removeFromCartItem = (productId, variantName = "", colorName = "", preOrderSlot = "") =>
  api.delete(`/api/cart/${productId}`, { params: { variantName, colorName, preOrderSlot } });
export const updateCartItemQty = (productId, quantity, variantName = "", colorName = "", preOrderSlot = "") =>
  api.put(`/api/cart/${productId}`, { quantity, variantName, colorName, preOrderSlot });

export const getWishlist = () => api.get("/api/wishlist");
export const toggleWishlistItem = (productId) =>
  api.post("/api/wishlist/toggle", { productId });
export const removeFromWishlistItem = (productId) =>
  api.delete(`/api/wishlist/${productId}`);

export const signupUser = (data) => api.post("/api/users/signup", data);
export const loginUser = (data) => api.post("/api/users/login", data);
export const loginWithPhone = (data) => api.post("/api/users/login/phone", data);
export const sendOtpLogin = (data) => api.post("/api/users/otp/send", data);
export const resendOtpLogin = (data) => api.post("/api/users/otp/resend", data);
export const verifyOtpLogin = (data) => api.post("/api/users/otp/verify", data);
export const completeOtpSignup = (data) => api.post("/api/users/otp/complete-signup", data);
export const resetPasswordWithPhoneOtp = (data) =>
  api.post("/api/users/password/reset", data);
export const getMe = () => api.get("/api/users/me");
export const updateMe = (data) => api.patch("/api/users/me", data);

function buildAddressPayload(data) {
  const fullName = data.fullName?.trim() || data.name?.trim() || "";
  const number = data.number?.trim() || data.phone?.trim() || "";
  const email = data.email?.trim() || "";
  const shopNo = data.shopNo?.trim() || "";
  const shopName = data.shopName?.trim() || "";
  const fullAddress = data.fullAddress?.trim() || data.streetArea?.trim() || "";
  const landmark = data.landmark?.trim() || "";
  const city = data.city?.trim() || "";
  const state = data.state?.trim() || "";
  const pincode = data.pincode?.trim() || "";

  return {
    fullName,
    number,
    email,
    shopNo,
    shopName,
    fullAddress,
    landmark,
    city,
    state,
    pincode,
    area: data.area?.trim() || landmark,
    addressType: data.addressType?.trim() || "Home",
    label: data.label?.trim() || data.addressType?.trim() || "Home",
    location: data.location || null,
    isDefault: data.isDefault,
    name: fullName,
    phone: number,
    streetArea: fullAddress,
  };
}

export const getAddresses = () => api.get("/api/addresses");
export const addAddress = (data) => api.post("/api/addresses", buildAddressPayload(data));
export const updateAddress = (id, data) =>
  api.put(`/api/addresses/${id}`, buildAddressPayload(data));
export const deleteAddress = (id) => api.delete(`/api/addresses/${id}`);

export const getLocationStates = (q = "") =>
  api.get("/api/location/states", { params: { q } });
export const getLocationCities = (state, q = "") =>
  api.get("/api/location/cities", { params: { state, q } });
export const getLocationPincodes = (state, city, q = "") =>
  api.get("/api/location/pincodes", { params: { state, city, q, limit: 250 } });
export const getLocationByPincode = (pincode) =>
  api.get(`/api/location/pincode/${pincode}`);
export const reverseGeocodeLocation = (lat, lng) =>
  api.get("/api/location/reverse", { params: { lat, lng } });

export const placeOrder = (data) => api.post("/api/orders", data);
export const createCheckoutAttempt = (data) => api.post("/api/orders/checkout-attempt", data);
export const createRazorpayOrder = (data) => api.post("/api/payments/create-order", data);
export const verifyRazorpayPayment = (data) => api.post("/api/payments/verify", data);
export const submitUpiPaymentProof = (data) => api.post("/api/payments/submit-upi-proof", data);
export const getMyOrders = () => api.get("/api/orders");
export const getOrderById = (id) => api.get(`/api/orders/${id}`);
export const getOrderTracking = (id) => api.get(`/api/orders/${id}/tracking`, { live: false });
export const resendCustomerDeliveryOtp = (id) => api.post(`/api/orders/${id}/resend-delivery-otp`);
export const cancelOrder = (id) => api.patch(`/api/orders/${id}/cancel`);
export const reschedulePreOrder = (id, slot) => api.patch(`/api/orders/${id}/preorder-slot`, { slot });
export const getPreOrderSlotAvailability = (date) =>
  api.get("/api/settings/preorder-slots", { params: date ? { date } : {} });
export const createReturnClaim = (id, data) => api.post(`/api/orders/${id}/return-claim`, data);

export const validateCoupon = (data) => api.post("/api/coupons/validate", data);
export const getAvailableCoupons = (params) => api.get("/api/coupons/available", { params });
export const validateGiftCard = (data) => api.post("/api/admin-ops/gift-cards/validate", data);

export const getRewardSettings = () => api.get("/api/rewards/settings");
export const getMyRewardPoints = (params = {}) => api.get("/api/rewards/my-points", { params });
export const calculateRewardDiscount = (data) => api.post("/api/rewards/calculate-discount", data);

export const submitSupportMessage = (data) => api.post("/api/support", data);

export const uploadImageFile = (file, folder) => {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", folder);
  // Let axios set multipart boundary automatically — do not force Content-Type.
  return api.post("/api/upload/image", formData, {
    headers: { "Content-Type": undefined },
    transformRequest: [
      (data, headers) => {
        if (typeof FormData !== "undefined" && data instanceof FormData) {
          if (headers && typeof headers.delete === "function") {
            headers.delete("Content-Type");
          } else if (headers) {
            delete headers["Content-Type"];
          }
        }
        return data;
      },
    ],
  });
};

export default api;
