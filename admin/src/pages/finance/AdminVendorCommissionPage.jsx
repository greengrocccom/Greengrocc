import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Percent,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  ArrowUpDown,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ExternalLink,
  X,
  FileSpreadsheet,
  Building2,
  Warehouse,
  MapPin,
  Phone,
  Mail,
  User,
  Store,
} from 'lucide-react';
import adminFinanceApi from '../../api/adminFinanceApi';
import VendorCommissionAnalytics from './VendorCommissionAnalytics';

const VIEW_TABS = [
  { id: 'analytics', label: 'Analytics & Insights' },
  { id: 'ledger', label: 'Vendor Commission Ledger' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'pending', label: 'Pending' },
  { id: 'partially_paid', label: 'Partially Paid' },
  { id: 'paid', label: 'Paid' },
];

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom' },
];

export default function AdminVendorCommissionPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('analytics');

  // Filters & State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [preset, setPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('totalAdminCommission');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const limit = 15;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ vendors: [], totals: {}, pagination: {} });

  // Record Payment Modal
  const [selectedVendorForPayment, setSelectedVendorForPayment] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payReference, setPayReference] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payModalError, setPayModalError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const loadCommissions = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
        search,
        status: statusFilter,
        sortBy,
        sortOrder,
      };
      if (preset && preset !== 'custom') {
        params.preset = preset;
      } else if (preset === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await adminFinanceApi.listVendors(params);
      setData(res || { vendors: [], totals: {}, pagination: {} });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load vendor commissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommissions();
  }, [search, statusFilter, preset, startDate, endDate, sortBy, sortOrder, page]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const openPaymentModal = (calc) => {
    setSelectedVendorForPayment(calc);
    setPayAmount(String(calc.pendingCommission > 0 ? calc.pendingCommission : ''));
    setPayMethod('Bank Transfer');
    setPayReference(`COMM-${Date.now().toString().slice(-6)}`);
    setPayNote(`Admin Commission Settlement for ${calc.vendor.name}`);
    setPayModalError('');
  };

  const handleRecordPayment = async (e) => {
    e?.preventDefault();
    const cleanAmount = Number(payAmount);
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      setPayModalError('Please enter a valid payment amount greater than 0');
      return;
    }
    if (cleanAmount > selectedVendorForPayment.pendingCommission + 0.5) {
      setPayModalError(
        `Payment cannot exceed pending commission balance of ₹${selectedVendorForPayment.pendingCommission}`
      );
      return;
    }

    setPaySubmitting(true);
    setPayModalError('');
    try {
      await adminFinanceApi.recordPayment({
        vendorId: selectedVendorForPayment.vendor.id,
        amount: cleanAmount,
        method: payMethod,
        reference: payReference.trim(),
        note: payNote.trim(),
        paidAt: new Date(),
      });

      setSelectedVendorForPayment(null);
      setToastMessage(`Payment of ₹${cleanAmount.toLocaleString('en-IN')} recorded successfully!`);
      setTimeout(() => setToastMessage(''), 4000);
      loadCommissions();
    } catch (err) {
      setPayModalError(err?.response?.data?.message || err?.message || 'Failed to record payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  const formatInr = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const vendors = data.vendors || [];
  const totals = data.totals || {};
  const pagination = data.pagination || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <Percent className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Admin Vendor Commission Management</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Track eligible sales, calculate Admin commission, verify payouts, and manage balances
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/finance/payments"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-emerald-700 transition"
          >
            <CreditCard className="h-3.5 w-3.5 text-blue-600" />
            Payment Logs
          </Link>
          <button
            type="button"
            onClick={loadCommissions}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="block text-[11px] font-semibold text-slate-400">Total Product Sales</span>
          <span className="mt-1 block text-lg font-black text-slate-900">
            {formatInr(totals.totalGrossProductSales)}
          </span>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-2xs">
          <span className="block text-[11px] font-semibold text-emerald-700">Eligible Sales</span>
          <span className="mt-1 block text-lg font-black text-emerald-950">
            {formatInr(totals.totalEligibleCommissionSales)}
          </span>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 shadow-2xs">
          <span className="block text-[11px] font-semibold text-indigo-700">Total Commission</span>
          <span className="mt-1 block text-lg font-black text-indigo-950">
            {formatInr(totals.totalAdminCommission)}
          </span>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 shadow-2xs">
          <span className="block text-[11px] font-semibold text-blue-700">Commission Received (जमा कमिशन)</span>
          <span className="mt-1 block text-lg font-black text-blue-950">
            {formatInr(totals.totalCommissionReceived)}
          </span>
        </div>
        <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 shadow-2xs sm:col-span-1">
          <span className="block text-[11px] font-semibold text-amber-700">Pending from Vendors (येणे बाकी)</span>
          <span className="mt-1 block text-lg font-black text-amber-950">
            {formatInr(totals.totalPendingCommission)}
          </span>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {VIEW_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-bold transition ${
              view === t.id
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        {view === 'ledger' ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by vendor name, owner, or ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 mr-1">Status:</span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStatusFilter(s.id);
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  statusFilter === s.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        ) : null}

        {/* Date Presets Bar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 text-xs ${
            view === 'ledger' ? 'border-t border-slate-100 pt-2.5' : ''
          }`}
        >
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
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
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
      </div>

      {view === 'analytics' ? (
        <VendorCommissionAnalytics preset={preset} startDate={startDate} endDate={endDate} />
      ) : null}

      {view === 'ledger' && error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Vendor Commission Table */}
      <div className={`rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden ${view === 'ledger' ? '' : 'hidden'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] text-left text-xs">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 select-none">
              <tr>
                <th className="px-4 py-3">Collection Centre / Vendor (कलेक्शन सेंटर)</th>
                <th className="px-4 py-3">Owner / Contact (मालक व संपर्क)</th>
                <th className="px-4 py-3">Location (स्थान)</th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-slate-200/70 transition"
                  onClick={() => handleSort('eligibleCommissionSales')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Product Sales</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-3 py-3 text-center">Commission %</th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-slate-200/70 transition"
                  onClick={() => handleSort('totalAdminCommission')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Commission</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-slate-200/70 transition"
                  onClick={() => handleSort('commissionPaid')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Commission Received</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-slate-200/70 transition"
                  onClick={() => handleSort('pendingCommission')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Pending from Vendor</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Loading vendor commission data…
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No vendor commission records found.
                  </td>
                </tr>
              ) : (
                vendors.map((c) => (
                  <tr key={c.vendor.id} className="hover:bg-slate-50/80 transition align-top">
                    <td className="px-4 py-3.5 w-[260px]">
                      <div className="flex items-start gap-2.5">
                        {c.vendor.vendorType === 'seller' ? (
                          <Store className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                        ) : (
                          <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">{c.vendor.name}</span>
                            <span
                              className={`whitespace-nowrap inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                c.vendor.vendorType === 'seller'
                                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              }`}
                            >
                              {c.vendor.vendorType === 'seller' ? 'Seller Vendor' : 'Farmer Vendor'}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-500 whitespace-nowrap mt-1">{c.vendor.collectionCentre?.id || c.vendor.collectionCentreId || c.vendor.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Owner / Contact */}
                    <td className="px-4 py-3.5 text-slate-700 w-[180px]">
                      <p className="font-semibold text-slate-800 text-xs whitespace-nowrap">{c.vendor.ownerName || '—'}</p>
                      <p className="text-[11px] text-slate-500 font-mono whitespace-nowrap mt-0.5">{c.vendor.mobile || '—'}</p>
                      {c.vendor.email ? <p className="text-[11px] text-slate-500">{c.vendor.email}</p> : null}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3.5 text-slate-700 w-[260px] leading-relaxed">
                      {c.vendor.location && c.vendor.location !== '—' ? (
                        <p className="flex items-start gap-1 text-xs">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                          {c.vendor.location}
                        </p>
                      ) : (
                        '—'
                      )}
                      {c.vendor.zones && c.vendor.zones.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.vendor.zones.map((z, zi) => (
                            <span
                              key={zi}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                            >
                              <MapPin className="h-2.5 w-2.5 text-emerald-600" />
                              {z}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[10px] text-slate-400 italic">No zones assigned</p>
                      )}
                    </td>

                    {/* Product Sales */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap w-[140px]">
                      <div className="font-bold text-slate-900">{formatInr(c.eligibleCommissionSales)}</div>
                      {c.grossProductSales !== c.eligibleCommissionSales && (
                        <div className="text-[10px] text-slate-400">Gross: {formatInr(c.grossProductSales)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-center whitespace-nowrap w-[90px] font-bold text-indigo-700">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 border border-indigo-200">
                        {c.commissionRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap w-[140px] font-black text-slate-900 text-sm">
                      {formatInr(c.totalAdminCommission)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap w-[130px] font-bold text-blue-700 text-xs">
                      {formatInr(c.commissionPaid)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap w-[140px] font-black text-amber-700 text-sm">
                      {formatInr(c.pendingCommission)}
                    </td>
                    
                    <td className="px-3 py-3.5 text-center whitespace-nowrap w-[110px]">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.commissionStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.commissionStatus === 'Partially Paid'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.commissionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap w-[130px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/finance/commissions/${c.vendor.id}`)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          title="View complete commission breakdown"
                        >
                          <span>Details</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                        {c.pendingCommission > 0 && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(c)}
                            className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-800 transition"
                            title="Record commission settlement"
                          >
                            <CreditCard className="h-3 w-3" />
                            <span>Collect</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div>
              Showing {vendors.length} of {pagination.total} vendors
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

      {/* Record Commission Payment Modal */}
      {selectedVendorForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Commission Received from Vendor (कमिशन जमा नोंदवा)</h3>
                <p className="text-xs text-slate-500">
                  Vendor: <span className="font-bold text-slate-700">{selectedVendorForPayment.vendor.name}</span> ({selectedVendorForPayment.vendor.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVendorForPayment(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3.5 text-xs">
              {payModalError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-red-700 font-semibold border border-red-200">
                  {payModalError}
                </div>
              )}

              {/* Outstanding Balance Banner */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-amber-800 font-medium">Pending Receivable from Vendor (येणे बाकी):</span>
                  <div className="text-base font-black text-amber-950">
                    {formatInr(selectedVendorForPayment.pendingCommission)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Total Commission:</span>
                  <span className="text-xs font-bold text-slate-800">
                    {formatInr(selectedVendorForPayment.totalAdminCommission)}
                  </span>
                </div>
              </div>

              {/* Payment Amount Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Amount Received from Vendor (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedVendorForPayment.pendingCommission + 0.5}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount to pay"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                <div className="flex gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(selectedVendorForPayment.pendingCommission))}
                    className="text-[10px] text-emerald-700 font-bold hover:underline"
                  >
                    Pay Full Outstanding (₹{selectedVendorForPayment.pendingCommission})
                  </button>
                  {selectedVendorForPayment.pendingCommission > 1000 && (
                    <>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setPayAmount(String(Math.round(selectedVendorForPayment.pendingCommission / 2)))}
                        className="text-[10px] text-slate-600 font-medium hover:underline"
                      >
                        50% (₹{Math.round(selectedVendorForPayment.pendingCommission / 2)})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Internal Ledger Transfer">Internal Ledger Transfer</option>
                </select>
              </div>

              {/* Transaction Reference ID */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Transaction / Reference ID
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. UTR / Bank Reference No."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Admin Note */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Admin Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Optional payment remarks..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedVendorForPayment(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-1.5 font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50"
                >
                  {paySubmitting ? 'Recording…' : 'Confirm Collection (जमा नोंदवा)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

