import apiClient from './client';

const unwrap = (response) => response.data;

export const couponApi = {
  getAllCoupons: (params = {}) => apiClient.get('/coupons', { params }).then(unwrap),
  createCoupon: (data) => apiClient.post('/coupons', data).then(unwrap),
  updateCoupon: (id, data) => apiClient.put(`/coupons/${id}`, data).then(unwrap),
  deleteCoupon: (id) => apiClient.delete(`/coupons/${id}`).then(unwrap),
  seedDefaultCoupons: () => apiClient.post('/coupons/seed').then(unwrap),
};

export const rewardApi = {
  getAdminSettings: () => apiClient.get('/rewards/admin/settings').then(unwrap),
  updateAdminSettings: (data) => apiClient.put('/rewards/admin/settings', data).then(unwrap),
  getAdminStats: () => apiClient.get('/rewards/admin/stats').then(unwrap),
  getAdminTransactions: (params = {}) => apiClient.get('/rewards/admin/transactions', { params }).then(unwrap),
  adjustUserPoints: (payload) => apiClient.post('/rewards/admin/adjust', payload).then(unwrap),
};

export const promoOpsApi = {
  list: (path, params = {}) => apiClient.get(`/admin-ops/${path}`, { params }).then(unwrap),
  create: (path, body) => apiClient.post(`/admin-ops/${path}`, body).then(unwrap),
  update: (path, id, body) => apiClient.put(`/admin-ops/${path}/${id}`, body).then(unwrap),
  remove: (path, id) => apiClient.delete(`/admin-ops/${path}/${id}`).then(unwrap),
};
