import apiClient from './client';

export const darkStoreApi = {
  list: async (params = {}, config = {}) => {
    const response = await apiClient.get('/admin/dark-stores', { ...config, params });
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
  listCoverage: async () => {
    const response = await apiClient.get('/admin/dark-stores/coverage');
    return response.data;
  },
  updateCoverage: async (id, payload) => {
    const response = await apiClient.put(`/admin/dark-stores/${id}/coverage`, payload);
    return response.data;
  },
  checkCoverage: async (payload) => {
    const response = await apiClient.post('/admin/dark-stores/coverage/check', payload);
    return response.data;
  },
};

export default darkStoreApi;
