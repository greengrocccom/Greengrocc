import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  Store,
  Percent,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';
import adminFinanceApi from '../../api/adminFinanceApi';

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'delivered', label: 'Delivered (Completed)' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_transit', label: 'In Transit' },
  { id: 'cancelled', label: 'Cancelled (Excluded)' },
];

export default function AdminFinanceSalesReportsPage() {
  const [preset, setPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 25;

  const [vendorsList, setVendorsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ orders: [], summary: {}, pagination: {} });

  // Load vendors list for filter
  useEffect(() => {
    adminFinanceApi.listVendors().then((res) => {
      setVendorsList(res?.vendors || []);
    }).catch(() => {});
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
        status: statusFilter,
        vendorId: vendorFilter,
      };
      if (preset && preset !== 'custom') {
        params.preset = preset;
      } else if (preset === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await adminFinanceApi.getSalesReport(params);
      setData(res || { orders: [], summary: {}, pagination: {} });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load sales report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [preset, startDate, endDate, vendorFilter, statusFilter, page]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = {
        status: statusFilter,
        vendorId: vendorFilter,
      };
      if (preset && preset !== 'custom') {
        params.preset = preset;
      } else if (preset === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      await adminFinanceApi.downloadSalesCsv(params);
    } catch (err) {
      alert(err.message || 'Failed to download CSV');
    } finally {
      setExporting(false);
    }
  };

  const formatInr = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const orders = data.orders || [];
  const summary = data.summary || {};
  const pagination = data.pagination || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Admin Sales & Commission Reports</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Detailed dark store sales audit, eligible commission transactions & CSV export
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 shadow-2xs hover:bg-purple-100 disabled:opacity-50 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? 'Generating CSV…' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={loadReports}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-semibold text-slate-400 block">Total Gross Sales</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatInr(summary.totalGrossSales)}
          </div>
          <span className="text-[11px] text-slate-400">All matched orders across dark stores</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-800 block">Eligible Commission Sales</span>
          <div className="text-2xl font-black text-emerald-950 mt-1">
            {formatInr(summary.totalEligibleSales)}
          </div>
          <span className="text-[11px] text-emerald-700">Strictly non-cancelled product sales</span>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-2xs">
          <span className="text-xs font-semibold text-indigo-800 block">Admin Commission Generated</span>
          <div className="text-2xl font-black text-indigo-950 mt-1">
            {formatInr(summary.totalCommissionGenerated)}
          </div>
          <span className="text-[11px] text-indigo-700">Earned by marketplace based on vendor rates</span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Vendor Filter */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Vendor:</span>
            <select
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">All Vendors</option>
              {vendorsList.map((v) => (
                <option key={v.vendor.id} value={v.vendor.id}>
                  {v.vendor.name} ({v.vendor.id})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Order Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-bold mr-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Period:
            </span>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPreset(p.id);
                  setPage(1);
                }}
                className={`rounded-md px-2 py-0.5 text-xs font-medium transition ${
                  preset === p.id
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="rounded border border-slate-300 px-2 py-0.5 text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="rounded border border-slate-300 px-2 py-0.5 text-xs"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Order Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Dark Store</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-3 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Product Sales</th>
                <th className="px-4 py-3 text-right">Eligible Sales</th>
                <th className="px-3 py-3 text-center">Comm. Rate</th>
                <th className="px-4 py-3 text-right font-black text-indigo-800">Admin Commission</th>
                <th className="px-3 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Loading sales records…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No orders matching criteria.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.orderId} className={`hover:bg-slate-50 transition ${!o.isEligible ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {new Date(o.createdAt).toLocaleDateString('en-IN')} {new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{o.darkStore}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{o.vendorName}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{o.itemsCount}</td>
                    <td className="px-4 py-3 text-right text-slate-700 font-medium">{formatInr(o.productSales)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatInr(o.eligibleCommissionSales)}</td>
                    <td className="px-3 py-3 text-center font-bold text-indigo-700">{o.commissionRate}%</td>
                    <td className="px-4 py-3 text-right font-black text-indigo-900 text-sm">
                      {o.isEligible ? formatInr(o.adminCommission) : '₹0'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          o.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800 line-through'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div>
              Showing {orders.length} of {pagination.total} orders
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-slate-900">
                {page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

