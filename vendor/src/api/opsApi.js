import apiClient from './client';

const unwrap = (response) => response.data;

const adminOpsPath = (path) => {
  const clean = String(path || '').replace(/^\/+/, '');
  if (clean.startsWith('api/admin-ops/')) return `/${clean}`;
  if (clean.startsWith('admin-ops/')) {
    const rest = clean.slice('admin-ops/'.length);
    const base = apiClient.defaults?.baseURL || '';
    return String(base).endsWith('/api') ? `/admin-ops/${rest}` : `/api/admin-ops/${rest}`;
  }
  const base = apiClient.defaults?.baseURL || '';
  const prefix = String(base).endsWith('/api') ? '/admin-ops/' : '/api/admin-ops/';
  return `${prefix}${clean}`;
};

export const opsApi = {
  get: (path) => apiClient.get(adminOpsPath(path)).then(unwrap),
  list: (path, params = {}) => apiClient.get(adminOpsPath(path), { params }).then(unwrap),
  create: (path, body) => apiClient.post(adminOpsPath(path), body).then(unwrap),
  update: (path, id, body) => apiClient.put(`${adminOpsPath(path)}/${id}`, body).then(unwrap),
  patch: (path, body) => apiClient.patch(adminOpsPath(path), body).then(unwrap),
  remove: (path, id) => apiClient.delete(`${adminOpsPath(path)}/${id}`).then(unwrap),
};

export default opsApi;
