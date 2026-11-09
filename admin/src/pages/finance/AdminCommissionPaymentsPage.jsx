import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Search,
  Calendar,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpRight,
  Receipt,
  CheckCircle2,
  Percent,
  Clock,
  Plus,
  X,
  TrendingUp,
  Store,
  Users,
  Building2,
  Warehouse,
  MapPin,
  Phone,
  Mail,
  User,
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

export default function AdminCommissionPaymentsPage() {
  const [preset, setPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    payments: [],
    totalPaidAmount: 0,
    vendorWiseSummary: [],
    commissionTotals: {},
    pagination: {},
  });

  // Record Payment Modal
  const [selectedVendorForPayment, setSelectedVendorForPayment] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payReference, setPayReference] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payModalError, setPayModalError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const loadPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      if (vendorFilter && vendorFilter !== 'all') params.vendorId = vendorFilter;
      if (preset && preset !== 'custom') {
        params.preset = preset;
      } else if (preset === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await adminFinanceApi.getPaymentHistory(params);
      setData(
        res || {
          payments: [],
          totalPaidAmount: 0,
          vendorWiseSummary: [],
          commissionTotals: {},
          pagination: {},
        }
      );
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load commission payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [preset, startDate, endDate, vendorFilter, page]);

  const openPaymentModal = (vendorSummary) => {
    setSelectedVendorForPayment(vendorSummary);
    setPayAmount(String(vendorSummary.pendingCommission > 0 ? vendorSummary.pendingCommission : ''));
    setPayMethod('Bank Transfer');
    setPayReference(`COMM-${Date.now().toString().slice(-6)}`);
    setPayNote(`Admin Commission Settlement for ${vendorSummary.vendorName}`);
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
        vendorId: selectedVendorForPayment.vendorId,
        amount: cleanAmount,
        method: payMethod,
        reference: payReference.trim(),
        note: payNote.trim(),
        paidAt: new Date(),
      });

      setSelectedVendorForPayment(null);
      setToastMessage(`Payment of ₹${cleanAmount.toLocaleString('en-IN')} recorded successfully!`);
      setTimeout(() => setToastMessage(''), 4000);
      loadPayments();
    } catch (err) {
      setPayModalError(err?.response?.data?.message || err?.message || 'Failed to record payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  const formatInr = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const payments = data.payments || [];
  const vendorWiseSummary = data.vendorWiseSummary || [];
  const commTotals = data.commissionTotals || {};
  const pagination = data.pagination || {};

  // Filter vendor summary list by search input
  const filteredVendors = vendorWiseSummary.filter((v) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      v.vendorName?.toLowerCase().includes(q) ||
      v.ownerName?.toLowerCase().includes(q) ||
      v.vendorId?.toLowerCase().includes(q) ||
      v.phone?.toLowerCase().includes(q) ||
      v.mobile?.toLowerCase().includes(q) ||
      v.city?.toLowerCase().includes(q) ||
      v.location?.toLowerCase().includes(q) ||
      v.collectionCentres?.some((c) => c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <CreditCard className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Commission Payment History</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Track & record commission received from vendors on product sales
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/finance/commissions"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <Percent className="h-3.5 w-3.5 text-emerald-600" />
            Vendor Commission Table
          </Link>
          <button
            type="button"
            onClick={loadPayments}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Highlights Banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-semibold text-slate-400 block">Total Eligible Sales</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatInr(commTotals.totalEligibleCommissionSales)}
          </div>
          <span className="text-[11px] text-slate-400">Excludes cancellations & delivery fees</span>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-2xs">
          <span className="text-xs font-semibold text-indigo-700 block">Total Commission Generated</span>
          <div className="text-2xl font-black text-indigo-950 mt-1">
            {formatInr(commTotals.totalAdminCommission)}
          </div>
          <span className="text-[11px] text-indigo-700">Calculated on vendor commission rates</span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <span className="text-xs font-semibold text-blue-700 block">Commission Received (व्हेंडरकडून जमा)</span>
          <div className="text-2xl font-black text-blue-950 mt-1">
            {formatInr(commTotals.totalCommissionReceived || data.totalPaidAmount)}
          </div>
          <span className="text-[11px] text-blue-700">Commission collected from vendors to Admin</span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-2xs">
          <span className="text-xs font-semibold text-amber-700 block">Pending from Vendors (येणे बाकी कमिशन)</span>
          <div className="text-2xl font-black text-amber-950 mt-1">
            {formatInr(commTotals.totalPendingCommission)}
          </div>
          <span className="text-[11px] text-amber-700">Commission owed by vendors to Admin</span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Vendor Filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-600">Filter Vendor:</span>
              <select
                value={vendorFilter}
                onChange={(e) => {
                  setVendorFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
              >
                <option value="all">All Vendors ({vendorWiseSummary.length})</option>
                {vendorWiseSummary.map((v) => (
                  <option key={v.vendorId} value={v.vendorId}>
                    {v.vendorName} ({v.vendorId})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Vendor */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
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
                    ? 'bg-blue-700 text-white shadow-2xs'
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

      {/* SECTION 1: VENDOR-WISE COMMISSION OVERVIEW TABLE (USER REQUEST: "proper cummission show krr vendor wise") */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/40">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-indigo-700" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Vendor-wise Commission Summary (विक्रेता कमिशन विवरण)
              </h2>
              <p className="text-[11px] text-slate-500">
                Product sales, commission rate %, admin commission, received collections and pending receivables from vendors
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-600">
            {filteredVendors.length} Vendors
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] text-left text-xs">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-4 py-3 w-[260px]">Collection Centre / Vendor (कलेक्शन सेंटर)</th>
                <th className="px-4 py-3 w-[180px]">Owner / Contact (मालक व संपर्क)</th>
                <th className="px-4 py-3 w-[260px]">Location (स्थान)</th>
                <th className="px-4 py-3 text-right w-[140px]">Product Sales (विक्री)</th>
                <th className="px-3 py-3 text-center w-[90px]">Commission %</th>
                <th className="px-4 py-3 text-right w-[140px] font-black text-slate-900">Admin Commission (एकूण ॲडमिन कमिशन)</th>
                <th className="px-4 py-3 text-right w-[130px] font-bold text-blue-700">Received (जमा झालेले कमिशन)</th>
                <th className="px-4 py-3 text-right w-[140px] font-black text-amber-700">Pending from Vendor (येणे बाकी)</th>
                <th className="px-3 py-3 text-center w-[110px]">Status</th>
                <th className="px-4 py-3 text-center w-[130px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Loading vendor commission breakdown…
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No vendor commission data found.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr key={v.vendorId} className="hover:bg-slate-50/80 transition align-top">
                    {/* 1. COLLECTION CENTRE / VENDOR */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2.5">
                        {v.vendorType === 'seller' ? (
                          <Store className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                        ) : (
                          <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">
                              {v.vendorName}
                            </span>
                            <span
                              className={`whitespace-nowrap inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                v.vendorType === 'seller'
                                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              }`}
                            >
                              {v.vendorType === 'seller' ? 'Seller Vendor' : 'Farmer Vendor'}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-500 whitespace-nowrap mt-1">
                            {v.collectionCentre?.id || v.collectionCentreId || v.vendorId}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* 2. OWNER / CONTACT */}
                    <td className="px-4 py-3.5 text-slate-700">
                      <p className="font-semibold text-slate-800 text-xs whitespace-nowrap">{v.ownerName || '—'}</p>
                      <p className="text-[11px] text-slate-500 font-mono whitespace-nowrap mt-0.5">{v.mobile || '—'}</p>
                      {v.email ? (
                        <p className="text-[11px] text-slate-500 truncate max-w-[170px] mt-0.5" title={v.email}>
                          {v.email}
                        </p>
                      ) : null}
                    </td>

                    {/* 3. LOCATION */}
                    <td className="px-4 py-3.5 text-slate-700">
                      {v.location && v.location !== '—' ? (
                        <p className="flex items-start gap-1 text-xs leading-relaxed text-slate-700 max-w-[250px]">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>{v.location}</span>
                        </p>
                      ) : (
                        '—'
                      )}
                      {v.zones && v.zones.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {v.zones.map((z, zi) => (
                            <span
                              key={zi}
                              className="whitespace-nowrap inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
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

                    {/* 4. PRODUCT SALES */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="font-bold text-slate-900 text-xs">{formatInr(v.eligibleCommissionSales)}</div>
                      {v.grossProductSales !== v.eligibleCommissionSales && (
                        <div className="text-[10px] text-slate-400 mt-0.5">Gross: {formatInr(v.grossProductSales)}</div>
                      )}
                    </td>

                    {/* 5. COMMISSION RATE */}
                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
                      <span className="inline-block rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
                        {v.commissionRate}%
                      </span>
                    </td>

                    {/* 6. TOTAL COMMISSION GENERATED */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="font-black text-slate-900 text-sm">
                        {formatInr(v.totalAdminCommission)}
                      </span>
                    </td>

                    {/* 7. PAID DISBURSEMENTS */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="font-bold text-blue-700 text-xs">
                        {formatInr(v.commissionPaid)}
                      </span>
                    </td>

                    {/* 8. PENDING BALANCES */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="font-black text-amber-700 text-sm">
                        {formatInr(v.pendingCommission)}
                      </span>
                    </td>

                    {/* 9. STATUS */}
                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
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

                    {/* 10. ACTION */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          to={`/finance/commissions/${v.vendorId}`}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          title="View order commission audit"
                        >
                          <span>Details</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                        {v.pendingCommission > 0 && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(v)}
                            className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-800 transition"
                            title="व्हेंडरकडून कमिशन जमा नोंदवा (Record commission receipt from vendor)"
                          >
                            <CreditCard className="h-3 w-3" />
                            <span>Pay</span>
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
      </div>

      {/* SECTION 2: COMMISSION PAYMENT TRANSACTION HISTORY LOG */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-700" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Commission Collections Ledger (कमिशन जमा / वसुली इतिहास)
              </h2>
              <p className="text-[11px] text-slate-500">
                Receipts of commission collected from vendors to Admin with UTR and reference numbers
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-700">
            Total Collected: {formatInr(data.totalPaidAmount)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Date Received (तारीख)</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-3 py-3 text-center">Comm. Rate</th>
                <th className="px-4 py-3 text-right">Amount Received (जमा रक्कम)</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Reference / Transaction ID</th>
                <th className="px-4 py-3">Admin Remarks / Notes</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Loading payments…
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No payment transactions recorded.
                  </td>
                </tr>
              ) : (
                payments.map((p, idx) => (
                  <tr key={p._id || idx} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{p.vendorName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{p.vendorId}</div>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-indigo-700">
                      {p.commissionRate != null ? `${p.commissionRate}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-blue-900 text-sm">
                      {formatInr(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 font-semibold">
                        {p.method || 'Bank Transfer'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {p.reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.note || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        to={`/finance/commissions/${p.vendorId}`}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                      >
                        <span>Vendor Detail</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
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
              Showing {payments.length} of {pagination.total} payment records
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

      {/* Record Payment Modal */}
      {selectedVendorForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Commission Received from Vendor (कमिशन जमा नोंदवा)</h3>
                <p className="text-xs text-slate-500">
                  Vendor: <span className="font-bold text-slate-700">{selectedVendorForPayment.vendorName}</span> ({selectedVendorForPayment.vendorId})
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
                  placeholder="Enter amount received from vendor"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                <div className="flex gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(selectedVendorForPayment.pendingCommission))}
                    className="text-[10px] text-emerald-700 font-bold hover:underline"
                  >
                    Collect Full Pending (सर्व ₹{selectedVendorForPayment.pendingCommission})
                  </button>
                </div>
              </div>

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
                  {paySubmitting ? 'Recording…' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
