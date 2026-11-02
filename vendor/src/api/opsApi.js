import apiClient from './client';

const unwrap = (response) => response.data;

export const opsApi = {
  get: (path) => apiClient.get(`/admin-ops/${path}`).then(unwrap),
  list: (path, params = {}) => apiClient.get(`/admin-ops/${path}`, { params }).then(unwrap),
  create: (path, body) => apiClient.post(`/admin-ops/${path}`, body).then(unwrap),
  update: (path, id, body) => apiClient.put(`/admin-ops/${path}/${id}`, body).then(unwrap),
  patch: (path, body) => apiClient.patch(`/admin-ops/${path}`, body).then(unwrap),
  remove: (path, id) => apiClient.delete(`/admin-ops/${path}/${id}`).then(unwrap),
};

export default opsApi;
