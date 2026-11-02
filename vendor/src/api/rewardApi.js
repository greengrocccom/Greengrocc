import apiClient from './client';

export const rewardApi = {
  // Get full reward settings for admin
  getAdminSettings: async () => {
    const response = await apiClient.get('/rewards/admin/settings');
    return response.data;
  },

  // Update reward settings (earning rate, redemption rate, caps, and T&C)
  updateAdminSettings: async (settingsData) => {
    const response = await apiClient.put('/rewards/admin/settings', settingsData);
    return response.data;
  },

  // Get reward program analytics & overview stats
  getAdminStats: async () => {
    const response = await apiClient.get('/rewards/admin/stats');
    return response.data;
  },

  // Get paginated transaction logs
  getAdminTransactions: async (params = {}) => {
    const response = await apiClient.get('/rewards/admin/transactions', { params });
    return response.data;
  },

  // Manually adjust points for a user (+ or -)
  adjustUserPoints: async (payload) => {
    const response = await apiClient.post('/rewards/admin/adjust', payload);
    return response.data;
  },
};

export default rewardApi;
