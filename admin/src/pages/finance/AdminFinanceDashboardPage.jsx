import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Percent,
  CreditCard,
  AlertCircle,
  Users,
  Calendar,
  RefreshCw,
  Wallet,
  ShoppingBag,
  Truck,
  Coins,
  XCircle,
  TrendingDown,
  FileSpreadsheet,
  Search,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    kpis: {
      customerPaidTotal: 0,
      cancelledOrdersCost: 0,
      grossProductSales: 0,
      deliveryCharges: 0,
      totalSale: 0,
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
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
      netProfit: 0,
      currentProfit: 0,
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

  const formatInr = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const allVendors = useMemo(() => {
    return Array.isArray(data.vendorsSummary) ? data.vendorsSummary : [];
  }, [data.vendorsSummary]);

  // Filtered vendors by search query
  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return allVendors;
    const q = searchQuery.toLowerCase();
    return allVendors.filter(
      (v) =>
        v.vendorName?.toLowerCase().includes(q) ||
        v.ownerName?.toLowerCase().includes(q) ||
        v.vendorId?.toLowerCase().includes(q)
    );
  }, [allVendors, searchQuery]);

  // KPIs across ALL Vendors (सर्व व्हेंडरची एकूण बेरीज)
  const scopedKpis = useMemo(() => {
    const list = allVendors;
    const customerPaidTotal = list.reduce((sum, v) => sum + Number(v.customerPaidTotal || 0), 0);
    const cancelledOrdersCost = list.reduce((sum, v) => sum + Number(v.cancelledOrdersCost || 0), 0);
    const grossProductSales = list.reduce((sum, v) => sum + Number(v.grossProductSales || 0), 0);
    const deliveryCharges = list.reduce((sum, v) => sum + Number(v.deliveryCharges || 0), 0);
    const totalSale = list.reduce((sum, v) => sum + Number(v.totalSale || 0), 0);
    const totalOrders = list.reduce((sum, v) => sum + Number(v.totalOrders || 0), 0);
    const completedOrders = list.reduce((sum, v) => sum + Number(v.completedOrders || 0), 0);
    const cancelledOrders = list.reduce((sum, v) => sum + Number(v.cancelledOrders || 0), 0);
    const totalAdminCommission = list.reduce((sum, v) => sum + Number(v.totalAdminCommission || 0), 0);
    const commissionReceived = list.reduce((sum, v) => sum + Number(v.commissionPaid || 0), 0);
    const pendingCommission = list.reduce((sum, v) => sum + Number(v.pendingCommission || 0), 0);
    const farmerProcurement = list.reduce((sum, v) => sum + Number(v.farmerProcurement || 0), 0);
    const vendorExpenses = list.reduce((sum, v) => sum + Number(v.vendorExpenses || 0), 0);
    const darkStoreExpenses = list.reduce((sum, v) => sum + Number(v.darkStoreExpenses || 0), 0);
    const combinedExpenses = vendorExpenses + darkStoreExpenses;
    const netProfit = list.reduce((sum, v) => sum + Number(v.netProfit || 0), 0);
    const currentProfit = list.reduce((sum, v) => sum + Number(v.currentProfit || 0), 0);

    return {
      customerPaidTotal: customerPaidTotal || Number(data.kpis?.customerPaidTotal || 0),
      cancelledOrdersCost: cancelledOrdersCost || Number(data.kpis?.cancelledOrdersCost || 0),
      grossProductSales: grossProductSales || Number(data.kpis?.grossProductSales || 0),
      deliveryCharges: deliveryCharges || Number(data.kpis?.deliveryCharges || 0),
      totalSale: totalSale || Number(data.kpis?.totalSale || 0),
      totalOrders: totalOrders || Number(data.kpis?.totalOrders || 0),
      completedOrders: completedOrders || Number(data.kpis?.completedOrders || 0),
      cancelledOrders: cancelledOrders || Number(data.kpis?.cancelledOrders || 0),
      totalAdminCommission: totalAdminCommission || Number(data.kpis?.totalAdminCommission || 0),
      commissionReceived: commissionReceived || Number(data.kpis?.commissionReceived || 0),
      pendingCommission: pendingCommission || Number(data.kpis?.pendingCommission || 0),
      farmerProcurement: farmerProcurement || Number(data.kpis?.totalFarmerProcurementAmount || 0),
      vendorExpenses: vendorExpenses || Number(data.kpis?.totalVendorExpenses || 0),
      darkStoreExpenses: darkStoreExpenses || Number(data.kpis?.totalDeliveryExpenses || 0),
      combinedExpenses: combinedExpenses || Number(data.kpis?.combinedExpenses || 0),
      netProfit: netProfit || Number(data.kpis?.netProfit || 0),
      currentProfit: currentProfit || Number(data.kpis?.currentProfit || 0),
      totalVendorCount: list.length || Number(data.kpis?.totalVendorCount || 0),
    };
  }, [allVendors, data.kpis]);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Admin Finance Dashboard</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              All Vendors Overview
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor customer paid total, gross product sales, delivery charges, admin commission & net profit across all vendors
          </p>
        </div>

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
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

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
              onClick={() => setPreset(p.id)}
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

      {/* Primary KPI Strip - Neatly Structured in 3 Rows Across ALL VENDORS */}
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
            <span className="text-[10px] font-medium text-indigo-800 truncate block mt-0.5">
              10% on TOTAL SALE ({formatInr(scopedKpis.totalSale)})
            </span>
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

      {/* Main Breakdown Table - VENDOR WISE SALES & EXPENSES (Each row is a Vendor) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-white">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-50 p-1 text-emerald-700">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
              VENDOR WISE SALES & EXPENSES
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
              {allVendors.length} Vendors
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 py-1 text-xs text-slate-700 shadow-2xs focus:border-emerald-600 focus:outline-none w-48 sm:w-56"
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">VENDOR</th>
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
                    Loading vendor reports...
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    No vendors found.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((v) => {
                  return (
                    <tr key={v.vendorId} onClick={() => navigate(`/finance/commissions/${v.vendorId}`)} className="hover:bg-emerald-50/40 transition cursor-pointer" title="Click to view full vendor sales dashboard">
                      {/* 1. Vendor Details */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Users className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">
                              {v.vendorName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {v.ownerName ? `${v.ownerName} • ` : ''}
                              <span className="font-mono text-[10px]">{v.vendorId}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Orders (Delivered / Cancelled) */}
                      <td className="px-4 py-3 text-center">
                        <div className="font-bold text-slate-900">{v.totalOrders || 0} total</div>
                        <div className="text-[10px] font-medium text-slate-500">
                          <span className="text-emerald-700 font-semibold">{v.completedOrders || 0} del</span>
                          {' • '}
                          <span className="text-rose-600 font-semibold">{v.cancelledOrders || 0} can</span>
                        </div>
                      </td>

                      {/* 3. Customer Paid */}
                      <td className="px-4 py-3 text-right font-bold text-emerald-800 tabular-nums">
                        {formatInr(v.customerPaidTotal)}
                      </td>

                      {/* 4. Gross Product Sales */}
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                        {formatInr(v.grossProductSales)}
                      </td>

                      {/* 5. Delivery Charges */}
                      <td className="px-4 py-3 text-right font-semibold text-blue-700 tabular-nums">
                        {formatInr(v.deliveryCharges)}
                      </td>

                      {/* 6. Total Sale */}
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums text-xs sm:text-sm">
                        {formatInr(v.totalSale)}
                      </td>

                      {/* 7. Admin Commission */}
                      <td className="px-4 py-3 text-right font-bold text-indigo-700 tabular-nums text-xs sm:text-sm">
                        {formatInr(v.totalAdminCommission)}
                      </td>

                      {/* 8. Dark Store Expenses */}
                      <td className="px-4 py-3 text-right font-semibold text-rose-600 tabular-nums">
                        {formatInr(v.darkStoreExpenses || v.combinedExpenses)}
                      </td>

                      {/* 9. Net Profit */}
                      <td
                        className={`px-4 py-3 text-right font-bold tabular-nums text-xs sm:text-sm ${
                          (v.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {formatInr(v.netProfit)}
                      </td>

                      {/* 10. Current Profit */}
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                        {formatInr(v.currentProfit)}
                      </td>

                      {/* 11. Action */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => navigate(`/finance/commissions/${v.vendorId}`)}
                          className="inline-flex items-center justify-center rounded-md bg-[#00704A] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#005a3b] transition cursor-pointer"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Summary Footer Row */}
            {filteredVendors.length > 0 && (
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
                    {formatInr(scopedKpis.darkStoreExpenses || scopedKpis.combinedExpenses)}
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
    </div>
  );
}
