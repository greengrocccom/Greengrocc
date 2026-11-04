import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Percent,
  TrendingUp,
  CreditCard,
  Calendar,
  RefreshCw,
  Printer,
  Download,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Building2,
  Warehouse,
  MapPin,
  Phone,
  User,
  Store,
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

export default function AdminFinancialReportsPage() {
  const [activeTab, setActiveTab] = useState('commission'); // 'commission' | 'sales' | 'payments'
  const [preset, setPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    commissionSummary: {},
    vendorsCommission: [],
    recentPayments: [],
  });

  const loadReports = async () => {
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

      const res = await adminFinanceApi.getFinancialReports(params);
      setData(res || { commissionSummary: {}, vendorsCommission: [], recentPayments: [] });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load financial reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [preset, startDate, endDate]);

  const formatInr = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const commSummary = data.commissionSummary || {};
  const vendors = data.vendorsCommission || [];
  const payments = data.recentPayments || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-teal-100 p-2 text-teal-700">
              <BarChart3 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Admin Financial Statements & Reports</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Audited statements for Vendor Commissions, Product Sales, and Payment Settlements
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report</span>
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

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Statement Period:
          </span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                preset === p.id
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
              className="rounded border border-slate-300 px-2 py-0.5 text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block">Gross Product Sales</span>
          <span className="text-xl font-black text-slate-900 mt-1 block">
            {formatInr(commSummary.totalGrossProductSales)}
          </span>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-indigo-700 block">Total Admin Commission</span>
          <span className="text-xl font-black text-indigo-950 mt-1 block">
            {formatInr(commSummary.totalAdminCommission)}
          </span>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-blue-700 block">Commission Settled</span>
          <span className="text-xl font-black text-blue-950 mt-1 block">
            {formatInr(commSummary.totalCommissionReceived)}
          </span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-700 block">Pending Balance</span>
          <span className="text-xl font-black text-amber-950 mt-1 block">
            {formatInr(commSummary.totalPendingCommission)}
          </span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('commission')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition ${
            activeTab === 'commission'
              ? 'border-teal-700 text-teal-800 bg-teal-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Percent className="h-4 w-4" />
          <span>1. Commission Report</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition ${
            activeTab === 'sales'
              ? 'border-teal-700 text-teal-800 bg-teal-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>2. Sales Report</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition ${
            activeTab === 'payments'
              ? 'border-teal-700 text-teal-800 bg-teal-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>3. Payment Report</span>
        </button>
      </div>

      {/* Tab 1: Commission Report */}
      {activeTab === 'commission' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase">Vendor-wise Commission Summary</h2>
            <span className="text-xs text-slate-500">Centralized Calculation Service</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Collection Centre / Vendor (कलेक्शन सेंटर)</th>
                  <th className="px-4 py-2.5">Owner / Contact (मालक व संपर्क)</th>
                  <th className="px-4 py-2.5">Location (स्थान)</th>
                  <th className="px-4 py-2.5 text-right">Eligible Sales</th>
                  <th className="px-3 py-2.5 text-center">Rate %</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-900">Commission</th>
                  <th className="px-4 py-2.5 text-right font-bold text-blue-700">Received (जमा)</th>
                  <th className="px-4 py-2.5 text-right font-black text-amber-700">Pending from Vendor (येणे बाकी)</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {vendors.map((v) => (
                  <tr key={v.vendorId} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {v.vendorType === 'seller' ? (
                          <Store className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                        ) : (
                          <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-slate-900">
                              {v.vendorName}
                            </p>
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                v.vendorType === 'seller'
                                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              }`}
                            >
                              {v.vendorType === 'seller' ? 'Seller Vendor' : 'Farmer Vendor'}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-500">
                            {v.collectionCentre?.id || v.collectionCentreId || v.vendorId}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <p className="font-semibold text-slate-800">{v.ownerName || '—'}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{v.mobile || '—'}</p>
                      {v.email ? <p className="text-[11px] text-slate-500">{v.email}</p> : null}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {v.location && v.location !== '—' ? (
                        <p className="flex items-start gap-1 text-xs">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                          {v.location}
                        </p>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatInr(v.eligibleCommissionSales)}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-indigo-700">{v.commissionRate}%</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">
                      {formatInr(v.totalAdminCommission)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">
                      {formatInr(v.commissionPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-amber-700 text-sm">
                      {formatInr(v.pendingCommission)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          v.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : v.status === 'Partially Paid'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Sales Report */}
      {activeTab === 'sales' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase">Vendor Sales Performance Statement</h2>
            <Link to="/finance/sales-reports" className="text-xs font-bold text-purple-700 hover:underline">
              Open Full Sales Ledger →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-xs">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Vendor Name</th>
                  <th className="px-4 py-2.5 text-right">Gross Product Sales</th>
                  <th className="px-4 py-2.5 text-right">Eligible Commission Sales</th>
                  <th className="px-4 py-2.5 text-right">Admin Commission Generated</th>
                  <th className="px-4 py-2.5 text-center">Commission Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {vendors.map((v) => {
                  const share =
                    commSummary.totalGrossProductSales > 0
                      ? Math.round((v.grossProductSales / commSummary.totalGrossProductSales) * 100)
                      : 0;
                  return (
                    <tr key={v.vendorId} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{v.vendorName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{v.vendorId}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatInr(v.grossProductSales)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-800">
                        {formatInr(v.eligibleCommissionSales)}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-indigo-900">
                        {formatInr(v.totalAdminCommission)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {share}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Payment Report */}
      {activeTab === 'payments' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase">Commission Payment Transactions Statement</h2>
            <Link to="/finance/payments" className="text-xs font-bold text-blue-700 hover:underline">
              Open Full Payment Logs →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-xs">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Vendor</th>
                  <th className="px-4 py-2.5 text-right">Amount Settled</th>
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5">Reference ID</th>
                  <th className="px-4 py-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No payments found in selected period.
                    </td>
                  </tr>
                ) : (
                  payments.map((p, idx) => (
                    <tr key={p._id || idx} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-600">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{p.vendorName}</td>
                      <td className="px-4 py-3 text-right font-black text-blue-900 text-sm">
                        {formatInr(p.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 font-medium">
                          {p.method || 'Bank Transfer'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{p.reference || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{p.note || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

