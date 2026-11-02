import apiClient from './client';
import opsApi from './opsApi';
import darkStoreApi from './darkStoreApi';

export const inventoryApi = {
  listFarmers: (params = {}) => opsApi.list('inventory/farmers', params),
  getFarmer: (farmerId) => opsApi.list(`inventory/farmers/${encodeURIComponent(farmerId)}`),
  adjustFarmer: (farmerId, body) => opsApi.create(`inventory/farmers/${encodeURIComponent(farmerId)}/adjust`, body),

  listVendors: (params = {}) => opsApi.list('inventory/vendors', params),
  getVendor: (vendorId) => opsApi.list(`inventory/vendors/${encodeURIComponent(vendorId)}`),
  adjustVendor: (vendorId, body) => opsApi.create(`inventory/vendors/${encodeURIComponent(vendorId)}/adjust`, body),

  listDarkStores: (params = {}) => darkStoreApi.list(params),
  getDarkStore: async (id) => {
    const response = await apiClient.get(`/admin/dark-stores/${encodeURIComponent(id)}`);
    return response.data;
  },
  listDarkStoreInventory: async (id) => {
    const response = await apiClient.get(`/admin/dark-stores/${encodeURIComponent(id)}/inventory`);
    return response.data;
  },
  updateDarkStoreItem: async (storeId, itemId, body) => {
    const response = await apiClient.patch(
      `/admin/dark-stores/${encodeURIComponent(storeId)}/inventory/${encodeURIComponent(itemId)}`,
      body
    );
    return response.data;
  },
  adjustDarkStoreItem: async (storeId, itemId, body) => {
    const response = await apiClient.post(
      `/admin/dark-stores/${encodeURIComponent(storeId)}/inventory/${encodeURIComponent(itemId)}/adjust`,
      body
    );
    return response.data;
  },
  createDarkStoreItem: async (storeId, body) => {
    const response = await apiClient.post(`/admin/dark-stores/${encodeURIComponent(storeId)}/inventory`, body);
    return response.data;
  },
};

export default inventoryApi;
