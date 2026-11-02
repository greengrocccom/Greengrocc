import apiClient from './client';

export const inventoryToolsApi = {
  // Metadata: stores, vendors, categories
  getMetadata: async () => {
    const res = await apiClient.get('/admin-ops/inventory-tools/metadata');
    return res.data;
  },

  // 1. Real-time stock visibility
  getRealtimeStock: async (params = {}) => {
    const res = await apiClient.get('/admin-ops/inventory-tools/realtime-stock', { params });
    return res.data;
  },

  // 2. Batch and expiry tracking
  getBatches: async (params = {}) => {
    const res = await apiClient.get('/admin-ops/inventory-tools/batches', { params });
    return res.data;
  },

  // Quarantine batch
  quarantineBatch: async (batchId, reason = '') => {
    const res = await apiClient.post(`/admin-ops/inventory-tools/batches/${batchId}/quarantine`, { reason });
    return res.data;
  },

  // 3. Low-stock alerts
  getLowStockAlerts: async (params = {}) => {
    const res = await apiClient.get('/admin-ops/inventory-tools/low-stock-alerts', { params });
    return res.data;
  },

  // 4. Purchase and GRN handling
  getGrnList: async (params = {}) => {
    const res = await apiClient.get('/admin-ops/inventory-tools/grn', { params });
    return res.data;
  },

  createGrn: async (grnData) => {
    const res = await apiClient.post('/admin-ops/inventory-tools/grn', grnData);
    return res.data;
  },

  // 5. Dead-stock reports
  getDeadStock: async (params = {}) => {
    const res = await apiClient.get('/admin-ops/inventory-tools/dead-stock', { params });
    return res.data;
  },

  // 6. Stock adjustment logs
  getAdjustments: async (params = {}) => {
    const res = await apiClient.get('/admin-ops/inventory-tools/adjustments', { params });
    return res.data;
  },

  createAdjustment: async (adjustmentData) => {
    const res = await apiClient.post('/admin-ops/inventory-tools/adjustments', adjustmentData);
    return res.data;
  },
};

export default inventoryToolsApi;
