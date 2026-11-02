import apiClient from './client';

export const couponApi = {
  // Get all coupons (with search, pagination, status filter)
  getAllCoupons: async (params = {}) => {
    const response = await apiClient.get('/coupons', { params });
    return response.data;
  },

  // Get active/available coupons list
  getAvailableCoupons: async (params = {}) => {
    const response = await apiClient.get('/coupons/available', { params });
    return response.data;
  },

  // Get single coupon by ID
  getCouponById: async (id) => {
    const response = await apiClient.get(`/coupons/${id}`);
    return response.data;
  },

  // Create a new coupon
  createCoupon: async (couponData) => {
    const response = await apiClient.post('/coupons', couponData);
    return response.data;
  },

  // Update existing coupon
  updateCoupon: async (id, couponData) => {
    const response = await apiClient.put(`/coupons/${id}`, couponData);
    return response.data;
  },

  // Delete coupon
  deleteCoupon: async (id) => {
    const response = await apiClient.delete(`/coupons/${id}`);
    return response.data;
  },

  // Seed default coupons
  seedDefaultCoupons: async () => {
    const response = await apiClient.post('/coupons/seed');
    return response.data;
  },
};

export default couponApi;
