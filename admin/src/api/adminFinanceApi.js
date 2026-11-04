import apiClient, { API_ORIGIN, readAdminToken } from './client';

export const adminFinanceApi = {
  getDashboard: (params = {}) => apiClient.get('/admin/finance/dashboard', { params }).then((res) => res.data),
  listVendors: (params = {}) => apiClient.get('/admin/finance/vendors', { params }).then((res) => res.data),
  getVendorCommissionDetail: (vendorId, params = {}) =>
    apiClient.get(`/admin/finance/vendors/${vendorId}/commission`, { params }).then((res) => res.data),
  recordPayment: (data) => apiClient.post('/admin/finance/commission-payment', data).then((res) => res.data),
  getPaymentHistory: (params = {}) =>
    apiClient.get('/admin/finance/payment-history', { params }).then((res) => res.data),
  getSalesReport: (params = {}) => apiClient.get('/admin/finance/sales-report', { params }).then((res) => res.data),
  getFinancialReports: (params = {}) =>
    apiClient.get('/admin/finance/financial-reports', { params }).then((res) => res.data),
  downloadSalesCsv: (params = {}) => {
    const query = new URLSearchParams({ ...params, exportCsv: 'true' }).toString();
    const token = readAdminToken();
    return fetch(`${API_ORIGIN}/api/admin/finance/sales-report?${query}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to export CSV');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `admin_sales_report_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      });
  },
};

export default adminFinanceApi;

