import apiClient from './client';

export const darkStoreApi = {
  list: async (params = {}) => {
    const response = await apiClient.get('/admin/dark-stores', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await apiClient.get(`/admin/dark-stores/${id}`);
    return response.data;
  },
  updateLocation: async (id, payload) => {
    const response = await apiClient.patch(`/admin/dark-stores/${id}`, payload);
    return response.data;
  },
};

export default darkStoreApi;
