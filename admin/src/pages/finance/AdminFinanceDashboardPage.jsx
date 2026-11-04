import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Percent,
  CreditCard,
  AlertCircle,
  Users,
  Store,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ShieldAlert,
  Wallet,
  ShoppingBag,
  CheckCircle2,
  Clock,
  Landmark,
  ChevronRight,
  FileSpreadsheet,
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

export default function AdminFinanceDashboardPage() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    kpis: {
      grossProductSales: 0,
      eligibleCommissionSales: 0,
      totalAdminCommission: 0,
      commissionReceived: 0,
      pendingCommission: 0,
      totalVendorCount: 0,
      vendorsWithPendingCommission: 0,
      totalFarmerProcurementAmount: 0,
      totalVendorExpenses: 0,
      totalDeliveryExpenses: 0,
      combinedExpenses: 0,
    },
    vendorsSummary: [],
  });

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (preset && preset !== 'custom') {
        params.preset = preset;
      } else if (preset === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }
      const res = await adminFinanceApi.getDashboard(params);
      if (res && res.kpis) {
        setData(res);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load finance dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [preset, startDate, endDate]);

  const kpis = data.kpis || {};

  const formatInr = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <TrendingUp className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Admin Finance Dashboard</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Centralized financial monitoring, vendor sales, admin commissions & collections
              </p>
            </div>
          </div>
        </div>

        {/* Quick Nav Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/finance/commissions"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-emerald-700 transition"
          >
            <Percent className="h-3.5 w-3.5 text-emerald-600" />
            Vendor Commission
          </Link>
          <Link
            to="/finance/payments"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-emerald-700 transition"
          >
            <CreditCard className="h-3.5 w-3.5 text-blue-600" />
            Commission Payments
          </Link>
          <Link
            to="/finance/sales-reports"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-emerald-700 transition"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-purple-600" />
            Sales Reports
          </Link>
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Date Filter:
          </span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                preset === p.id
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-slate-700 focus:border-emerald-600 focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-slate-700 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        )}
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Primary KPI Grid (9 KPIs Required by Prompt) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* KPI 1: Gross Product Sales */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Gross Product Sales</span>
            <ShoppingBag className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {loading ? '…' : formatInr(kpis.grossProductSales)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">All non-cancelled store product sales</p>
        </div>

        {/* KPI 2: Eligible Commission Sales */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
            <span>Eligible Commission Sales</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-950">
            {loading ? '…' : formatInr(kpis.eligibleCommissionSales)}
          </div>
          <p className="mt-1 text-[11px] text-emerald-700">Excludes delivery fees & cancellations</p>
        </div>

        {/* KPI 3: Total Admin Commission */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-800 text-xs font-semibold">
            <span>Total Admin Commission</span>
            <Percent className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-950">
            {loading ? '…' : formatInr(kpis.totalAdminCommission)}
          </div>
          <p className="mt-1 text-[11px] text-indigo-700">Calculated on vendor commission rates</p>
        </div>

        {/* KPI 4: Commission Received */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800 text-xs font-semibold">
            <span>Commission Received from Vendors</span>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-950">
            {loading ? '…' : formatInr(kpis.commissionReceived)}
          </div>
          <p className="mt-1 text-[11px] text-blue-700">Commission collected from vendors to Admin</p>
        </div>

        {/* KPI 5: Pending Commission */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800 text-xs font-semibold">
            <span>Pending from Vendors</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-950">
            {loading ? '…' : formatInr(kpis.pendingCommission)}
          </div>
          <p className="mt-1 text-[11px] text-amber-700">Commission owed by vendors to Admin</p>
        </div>

        {/* KPI 6: Total Vendor Count */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Vendor Count</span>
            <Users className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {loading ? '…' : kpis.totalVendorCount}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Active registered commercial vendors</p>
        </div>

        {/* KPI 7: Vendors with Pending Commission */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-rose-800 text-xs font-semibold">
            <span>Vendors with Pending Comm.</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-950">
            {loading ? '…' : kpis.vendorsWithPendingCommission}
          </div>
          <p className="mt-1 text-[11px] text-rose-700">Vendors with outstanding balances</p>
        </div>

        {/* KPI 8: Total Farmer Procurement Amount */}
        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-teal-800 text-xs font-semibold">
            <span>Total Farmer Procurement</span>
            <Wallet className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-teal-950">
            {loading ? '…' : formatInr(kpis.totalFarmerProcurementAmount)}
          </div>
          <p className="mt-1 text-[11px] text-teal-700">Completed farmer earnings & statements</p>
        </div>

        {/* KPI 9: Total Vendor Expenses */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Vendor Expenses</span>
            <Landmark className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {loading ? '…' : formatInr(kpis.combinedExpenses)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Vendor ops (₹{kpis.totalVendorExpenses}) + Store (₹{kpis.totalDeliveryExpenses})
          </p>
        </div>
      </div>

      {/* Vendors Overview Table Preview */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Vendor Sales & Commission Overview</h2>
            <p className="text-xs text-slate-500">Live breakdown of vendor product sales, rates and commission status</p>
          </div>
          <Link
            to="/finance/commissions"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
          >
            <span>View All Vendors</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Vendor</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-right">Product Sales</th>
                <th className="px-4 py-2.5 text-right">Commission Rate</th>
                <th className="px-4 py-2.5 text-right">Total Commission</th>
                <th className="px-4 py-2.5 text-right">Paid</th>
                <th className="px-4 py-2.5 text-right">Pending</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Loading vendor commissions…
                  </td>
                </tr>
              ) : data.vendorsSummary.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No vendors found.
                  </td>
                </tr>
              ) : (
                data.vendorsSummary.map((v) => (
                  <tr key={v.vendorId} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{v.vendorName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{v.vendorId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {v.vendorType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatInr(v.eligibleCommissionSales)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">
                      {v.commissionRate}%
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatInr(v.totalAdminCommission)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">
                      {formatInr(v.commissionPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-amber-700">
                      {formatInr(v.pendingCommission)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          v.commissionStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : v.commissionStatus === 'Partially Paid'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {v.commissionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => navigate(`/finance/commissions/${v.vendorId}`)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                      >
                        <span>Details</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

