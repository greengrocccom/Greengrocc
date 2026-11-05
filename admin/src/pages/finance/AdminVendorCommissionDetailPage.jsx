import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Percent,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Store,
  RefreshCw,
  ShoppingBag,
  Truck,
  Coins,
  XCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
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

export default function AdminVendorCommissionDetailPage() {
  const { vendorId } = useParams();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Collect Commission Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payReference, setPayReference] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      if (preset && preset !== 'custom') {
        params.preset = preset;
      } else if (preset === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }
      if (storeFilter && storeFilter !== 'ALL') {
        params.storeId = storeFilter;
      }

      const res = await adminFinanceApi.getVendorCommissionDetail(vendorId, params);
      setData(res);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load vendor sales dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [vendorId, preset, startDate, endDate, storeFilter, page]);

  const openPayModal = () => {
    if (!data?.commission) return;
    const pending = data.commission.pendingCommission || 0;
    setPayAmount(pending > 0 ? String(pending) : '');
    setPayMethod('Bank Transfer');
    setPayReference(`COMM-${Date.now().toString().slice(-6)}`);
    setPayNote(`Admin Commission Settlement for ${data.commission.vendor.name}`);
    setPayError('');
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e?.preventDefault();
    const cleanAmount = Number(payAmount);
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      setPayError('Please enter a valid payment amount greater than 0');
      return;
    }
    const pending = data?.commission?.pendingCommission || 0;
    if (cleanAmount > pending + 0.5) {
      setPayError(`Payment cannot exceed pending commission balance of ₹${pending}`);
      return;
    }

    setPaySubmitting(true);
    setPayError('');
    try {
      await adminFinanceApi.recordPayment({
        vendorId: data.commission.vendor.id,
        amount: cleanAmount,
        method: payMethod,
        reference: payReference.trim(),
        note: payNote.trim(),
        paidAt: new Date(),
      });

      setPaymentModalOpen(false);
      setToastMessage(`Payment of ₹${cleanAmount.toLocaleString('en-IN')} recorded successfully!`);
      setTimeout(() => setToastMessage(''), 4000);
      loadDetail();
    } catch (err) {
      setPayError(err?.response?.data?.message || err?.message || 'Failed to record payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  const formatInr = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const commission = data?.commission || {};
  const vendor = commission.vendor || {};
  const darkStores = commission.darkStores || [];
  const darkStoreBreakdown = Array.isArray(data?.darkStoreBreakdown) ? data.darkStoreBreakdown : [];
  const orders = data?.orders || [];
  const pagination = data?.pagination || {};

  // Filtered store breakdown based on storeFilter
  const filteredBreakdown = useMemo(() => {
    if (storeFilter === 'ALL') return darkStoreBreakdown;
    return darkStoreBreakdown.filter((s) => s.id === storeFilter);
  }, [darkStoreBreakdown, storeFilter]);

  // Dynamic KPIs (matching Vendor Sales Reports)
  const scopedKpis = useMemo(() => {
    const list = filteredBreakdown.length > 0 ? filteredBreakdown : darkStoreBreakdown;
    const customerPaidTotal = list.reduce((sum, s) => sum + Number(s.customerPaymentTotal || 0), 0) || Number(commission.customerPaymentTotal || 0);
    const cancelledOrdersCost = list.reduce((sum, s) => sum + Number(s.cancelledOrdersCost || 0), 0) || Number(commission.cancelledOrdersCost || 0);
    const grossProductSales = list.reduce((sum, s) => sum + Number(s.grossProductSales || 0), 0) || Number(commission.grossProductSales || 0);
    const deliveryCharges = list.reduce((sum, s) => sum + Number(s.deliveryCharges || 0), 0) || Number(commission.deliveryCharges || 0);
    const totalSale = list.reduce((sum, s) => sum + Number(s.totalSale || 0), 0) || Number(commission.totalSale || 0);
    const totalOrders = list.reduce((sum, s) => sum + Number(s.totalOrders || 0), 0) || Number(commission.totalOrders || 0);
    const completedOrders = list.reduce((sum, s) => sum + Number(s.completedOrders || 0), 0) || Number(commission.completedOrders || 0);
    const cancelledOrders = list.reduce((sum, s) => sum + Number(s.cancelledOrders || 0), 0) || Number(commission.cancelledOrders || 0);
    const totalAdminCommission = list.reduce((sum, s) => sum + Number(s.adminCommission || 0), 0) || Number(commission.totalAdminCommission || 0);
    const farmerProcurement = Number(commission.farmerProcurement || 0);
    const vendorExpenses = Number(commission.vendorExpenses || 0);
    const darkStoreExpenses = list.reduce((sum, s) => sum + Number(s.darkStoreExpenses || 0), 0) || Number(commission.darkStoreExpenses || 0);
    const combinedExpenses = vendorExpenses + darkStoreExpenses;
    const netProfit = totalSale - farmerProcurement - totalAdminCommission - combinedExpenses;
    const currentProfit = list.reduce((sum, s) => sum + Number(s.currentProfit || 0), 0) || Number(commission.currentProfit || 0);
    const commissionRate = Number(commission.commissionRate || 10);

    return {
      customerPaidTotal,
      cancelledOrdersCost,
      grossProductSales,
      deliveryCharges,
      totalSale,
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalAdminCommission,
      commissionReceived: Number(commission.commissionPaid || 0),
      pendingCommission: Number(commission.pendingCommission || 0),
      farmerProcurement,
      vendorExpenses,
      darkStoreExpenses,
      combinedExpenses,
      netProfit,
      currentProfit,
      commissionRate,
    };
  }, [filteredBreakdown, darkStoreBreakdown, commission]);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/finance')}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer"
            title="Back to Admin Finance Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                {vendor.name || vendor.vendorName || 'Vendor Sales Reports'}
              </h1>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Delivery Manager & Dark Store Wise
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ID: {vendor.id} {vendor.email ? `• ${vendor.email}` : ''} {vendor.phone ? `• ${vendor.phone}` : ''} • Owner: {vendor.ownerName || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {scopedKpis.pendingCommission > 0 && (
            <button
              type="button"
              onClick={openPayModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              <span>Record Settlement Payment</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadDetail}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
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

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Date Filter:
          </span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPreset(p.id);
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
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
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-slate-700"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-slate-700"
            />
          </div>
        )}
      </div>

      {/* Primary KPI Strip - Exact 3-Row Structure matching Vendor Sales Reports */}
      <div className="space-y-3">
        {/* ROW 1: Orders & Sales Inflows (4 Cards) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          {/* 1. Customer Paid Total */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate"
                title="Customer Paid Total"
              >
                CUSTOMER PAID TOTAL
              </span>
              <CreditCard className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-emerald-700 truncate tabular-nums">
              {loading ? '...' : formatInr(scopedKpis.customerPaidTotal)}
            </p>
            <span className="text-[10px] font-medium text-emerald-600 truncate block mt-0.5">
              {scopedKpis.totalOrders} Total orders placed
            </span>
          </div>

          {/* 2. Cancelled Orders Cost */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate"
                title="Cancelled Orders Cost"
              >
                CANCELLED ORDERS COST
              </span>
              <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-rose-600 truncate tabular-nums">
              {loading ? '...' : `- ${formatInr(scopedKpis.cancelledOrdersCost)}`}
            </p>
            <span className="text-[10px] font-medium text-rose-500 truncate block mt-0.5">
              - {formatInr(scopedKpis.cancelledOrdersCost)} ({scopedKpis.cancelledOrders} cancelled)
            </span>
          </div>

          {/* 3. Gross Product Sales */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate"
                title="Gross Product Sales"
              >
                GROSS PRODUCT SALES
              </span>
              <ShoppingBag className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate tabular-nums">
              {loading ? '...' : formatInr(scopedKpis.grossProductSales)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Total items billed
            </span>
          </div>

          {/* 4. Delivery Charges */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate"
                title="Delivery Charges"
              >
                DELIVERY CHARGES
              </span>
              <Truck className="h-4 w-4 shrink-0 text-blue-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-blue-700 truncate tabular-nums">
              {loading ? '...' : formatInr(scopedKpis.deliveryCharges)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Delivery service fees
            </span>
          </div>
        </div>

        {/* ROW 2: Total Sale, Procurement & Separate Expenses (4 Cards) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          {/* 5. Total Sale */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-900 truncate"
                title="Total Sale"
              >
                TOTAL SALE
              </span>
              <Coins className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-emerald-700 truncate tabular-nums">
              {loading ? '...' : formatInr(scopedKpis.totalSale)}
            </p>
            <span className="text-[10px] font-medium text-emerald-600 truncate block mt-0.5">
              Gross Sales + Delivery
            </span>
          </div>

          {/* 6. Total Procurement Value */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate"
                title="Total Procurement Value"
              >
                TOTAL FARMER PROCUREMENT
              </span>
              <Wallet className="h-4 w-4 shrink-0 text-amber-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-amber-700 truncate tabular-nums">
              {loading ? '...' : formatInr(scopedKpis.farmerProcurement)}
            </p>
            <span className="text-[10px] text-amber-800 font-semibold truncate block mt-0.5">
              Earning Statement Total (प्रमाणित खरेदी)
            </span>
          </div>

          {/* 7. Total Vendor Expenses */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 truncate"
                title="Total Vendor Expenses"
              >
                TOTAL VENDOR EXPENSES
              </span>
              <Wallet className="h-4 w-4 shrink-0 text-rose-500" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-rose-600 truncate tabular-nums">
              {loading ? '...' : formatInr(scopedKpis.vendorExpenses)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Store & ops costs
            </span>
          </div>

          {/* 8. Delivery Manager Expenses */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 truncate"
                title="Delivery Manager Expenses"
              >
                DELIVERY MANAGER EXPENSES
              </span>
              <TrendingDown className="h-4 w-4 shrink-0 text-amber-500" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-amber-600 truncate tabular-nums">
              {loading ? '...' : formatInr(scopedKpis.darkStoreExpenses)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Dark store & riders costs
            </span>
          </div>
        </div>

        {/* ROW 3: Final Profitability (Admin Commission, Net Profit & Current Profit) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Admin Commission Card */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[11px] font-bold uppercase tracking-wider text-indigo-950 truncate"
                title="Total Admin Commission"
              >
                TOTAL ADMIN COMMISSION (एकूण कमिशन)
              </span>
              <Percent className="h-4 w-4 shrink-0 text-indigo-600" />
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-indigo-700 truncate tabular-nums">
              {loading ? '...' : formatInr(scopedKpis.totalAdminCommission)}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1">
              <span className="text-[10.5px] font-medium text-indigo-800 truncate block">
                {scopedKpis.commissionRate}% on TOTAL SALE ({formatInr(scopedKpis.totalSale)})
              </span>
              <span className="text-[9.5px] font-medium text-slate-500">
                Paid: {formatInr(scopedKpis.commissionReceived)} • Pending:{' '}
                {formatInr(scopedKpis.pendingCommission)}
              </span>
            </div>
          </div>

          {/* Net Profit */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 truncate"
                title="Net Profit"
              >
                NET PROFIT (नक्त नफा)
              </span>
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p
              className={`mt-1.5 text-xl sm:text-2xl font-bold tracking-tight truncate tabular-nums ${
                scopedKpis.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {loading ? '...' : formatInr(scopedKpis.netProfit)}
            </p>
            <span className="text-[10px] font-medium text-emerald-800 truncate block mt-0.5">
              TOTAL SALE ({formatInr(scopedKpis.totalSale)}) - खरेदी ({formatInr(scopedKpis.farmerProcurement)}) - कमिशन ({formatInr(scopedKpis.totalAdminCommission)}) - खर्च ({formatInr(scopedKpis.combinedExpenses)})
            </span>
          </div>

          {/* Current Profit */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 truncate"
                title="Current Profit"
              >
                CURRENT PROFIT (वितरित नफा)
              </span>
              <Coins className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-emerald-700 truncate tabular-nums">
              {loading ? '...' : formatInr(scopedKpis.currentProfit)}
            </p>
            <span className="text-[10px] font-medium text-emerald-800 truncate block mt-0.5">
              Delivered product sales ({scopedKpis.completedOrders} orders delivered)
            </span>
          </div>
        </div>
      </div>

      {/* Main Table: DELIVERY MANAGER & DARK STORE WISE SALES & EXPENSES */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-white">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-50 p-1 text-emerald-700">
              <Store className="h-4 w-4" />
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
              DELIVERY MANAGER & DARK STORE WISE SALES & EXPENSES
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
              {darkStores.length} Dark Stores
            </span>
          </div>

          {/* Store Quick Selector Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStoreFilter('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                storeFilter === 'ALL'
                  ? 'bg-[#00704A] text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              All Stores
            </button>
            {darkStores.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => setStoreFilter(String(s._id))}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  storeFilter === String(s._id)
                    ? 'bg-[#00704A] text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s.storeName}
              </button>
            ))}
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">DARK STORE / DELIVERY MANAGER</th>
                <th className="px-4 py-3 text-center">ORDERS (DEL/CANC)</th>
                <th className="px-4 py-3 text-right">CUSTOMER PAID</th>
                <th className="px-4 py-3 text-right">GROSS PRODUCT SALES</th>
                <th className="px-4 py-3 text-right">DELIVERY CHARGES</th>
                <th className="px-4 py-3 text-right text-emerald-800 font-bold">TOTAL SALE</th>
                <th className="px-4 py-3 text-right text-indigo-700 font-bold">ADMIN COMMISSION</th>
                <th className="px-4 py-3 text-right text-rose-700 font-bold">DARK STORE EXPENSES</th>
                <th className="px-4 py-3 text-right text-emerald-800 font-bold">NET PROFIT</th>
                <th className="px-4 py-3 text-right text-emerald-700 font-bold">CURRENT PROFIT</th>
                <th className="px-4 py-3 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-1 text-emerald-600" />
                    Loading delivery manager & dark store reports...
                  </td>
                </tr>
              ) : filteredBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    No dark stores found for this vendor.
                  </td>
                </tr>
              ) : (
                filteredBreakdown.map((s) => {
                  const location = [s.area, s.city].filter(Boolean).join(' • ') || '—';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      {/* 1. Dark Store & Delivery Manager */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Store className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">
                              {s.storeName}
                            </div>
                            <div className="text-[11px] text-slate-400">{location}</div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Orders (Delivered / Cancelled) */}
                      <td className="px-4 py-3 text-center">
                        <div className="font-bold text-slate-900">{s.totalOrders || 0} total</div>
                        <div className="text-[10px] font-medium text-slate-500">
                          <span className="text-emerald-700 font-semibold">{s.completedOrders || 0} del</span>
                          {' • '}
                          <span className="text-rose-600 font-semibold">{s.cancelledOrders || 0} can</span>
                        </div>
                      </td>

                      {/* 3. Customer Paid */}
                      <td className="px-4 py-3 text-right font-bold text-emerald-800 tabular-nums">
                        {formatInr(s.customerPaymentTotal)}
                      </td>

                      {/* 4. Gross Product Sales */}
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                        {formatInr(s.grossProductSales)}
                      </td>

                      {/* 5. Delivery Charges */}
                      <td className="px-4 py-3 text-right font-semibold text-blue-700 tabular-nums">
                        {formatInr(s.deliveryCharges)}
                      </td>

                      {/* 6. Total Sale */}
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums text-xs sm:text-sm">
                        {formatInr(s.totalSale)}
                      </td>

                      {/* 7. Admin Commission */}
                      <td className="px-4 py-3 text-right font-bold text-indigo-700 tabular-nums text-xs sm:text-sm">
                        {formatInr(s.adminCommission)}
                      </td>

                      {/* 8. Dark Store Expenses */}
                      <td className="px-4 py-3 text-right font-semibold text-rose-600 tabular-nums">
                        {formatInr(s.darkStoreExpenses)}
                      </td>

                      {/* 9. Net Profit */}
                      <td
                        className={`px-4 py-3 text-right font-bold tabular-nums text-xs sm:text-sm ${
                          s.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {formatInr(s.netProfit)}
                      </td>

                      {/* 10. Current Profit */}
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                        {formatInr(s.currentProfit)}
                      </td>

                      {/* 11. Action */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setStoreFilter(s.id)}
                          className="inline-flex items-center justify-center rounded-md bg-[#00704A] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#005a3b] transition cursor-pointer"
                        >
                          Filter Store
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Summary Footer Row */}
            {filteredBreakdown.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-white font-bold text-slate-900">
                <tr>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900 text-xs">
                      Total Vendor
                      <br />
                      <span className="text-slate-700 font-semibold">(एकूण व्हेंडर)</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">
                    {scopedKpis.totalOrders} total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-800 tabular-nums">
                    {formatInr(scopedKpis.customerPaidTotal)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                    {formatInr(scopedKpis.grossProductSales)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 tabular-nums">
                    {formatInr(scopedKpis.deliveryCharges)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums text-xs sm:text-sm">
                    {formatInr(scopedKpis.totalSale)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-700 tabular-nums text-xs sm:text-sm">
                    {formatInr(scopedKpis.totalAdminCommission)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600 tabular-nums">
                    {formatInr(scopedKpis.darkStoreExpenses)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold tabular-nums text-xs sm:text-sm ${
                      scopedKpis.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {formatInr(scopedKpis.netProfit)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                    {formatInr(scopedKpis.currentProfit)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Order-wise Commission Breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Order-wise Transaction Breakdown</h2>
            <p className="text-xs text-slate-500">
              Audit trail of customer orders, product sales and commission generated
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600">
            Total Orders: {pagination.total || orders.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Order Number</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Dark Store</th>
                <th className="px-3 py-2.5 text-center">Items</th>
                <th className="px-4 py-2.5 text-right">Product Total</th>
                <th className="px-4 py-2.5 text-right">Eligible Sales</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right font-black text-emerald-800">Admin Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading order breakdown…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No orders recorded for this vendor in the selected period.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.orderId} className={`hover:bg-slate-50 transition ${!o.isEligible ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      #{o.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {o.storeName}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold" title={o.itemsSummary}>
                        {o.itemsCount} items
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {formatInr(o.totalProductAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatInr(o.eligibleSales)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          o.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-700 tabular-nums">
                      {formatInr(o.calculatedCommission)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 bg-slate-50 text-xs">
            <span className="text-slate-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} orders)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1 || loading}
                className="rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Collect Commission Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Record Commission Payment</h3>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {payError && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                {payError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Pending Balance: {formatInr(scopedKpis.pendingCommission)}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Deduction at Source">Deduction at Source</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reference / UTR Number</label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. UTR123456789"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Note (Optional)</label>
                <textarea
                  rows={2}
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Add payment notes..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition"
                >
                  {paySubmitting ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
