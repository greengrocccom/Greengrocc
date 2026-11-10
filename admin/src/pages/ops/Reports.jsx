import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronRight,
  CreditCard,
  Download,
  Filter,
  Layers,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TD, TH } from '../../utils/ui';

const PRESET_RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: '3m', label: 'Last 3 Months' },
  { id: '6m', label: 'Last 6 Months' },
  { id: 'custom', label: 'Custom Range' },
];

const GROUP_OPTIONS = [
  { id: 'day', label: 'Day-wise' },
  { id: 'week', label: 'Week-wise' },
  { id: 'month', label: 'Month-wise' },
  { id: 'year', label: 'Year-wise' },
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'processing', label: 'In Transit / Processing' },
  { id: 'cancelled', label: 'Cancelled / Returned' },
];

const PAYMENT_OPTIONS = [
  { id: 'all', label: 'All Payments' },
  { id: 'online', label: 'Online / UPI' },
  { id: 'cod', label: 'Cash on Delivery (COD)' },
];

const CHART_COLORS = ['#047857', '#0284C7', '#D97706', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters state
  const [range, setRange] = useState('30d');
  const [groupBy, setGroupBy] = useState('day');
  const [zone, setZone] = useState('all');
  const [darkStoreId, setDarkStoreId] = useState('all');
  const [status, setStatus] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState('zones'); // 'zones' | 'stores' | 'products' | 'orders'

  const [tabFilters, setTabFilters] = useState({});
  const tabFilter = tabFilters[activeTab] || {};
  const updateTabFilter = (key, value) => setTabFilters((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], [key]: value } }));
  const loadReport = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const params = {
        range,
        groupBy,
        zone: zone === 'All Zones' ? 'all' : zone,
        darkStoreId: darkStoreId === 'All Stores' ? 'all' : darkStoreId,
        status,
        paymentMethod,
      };

      if (range === 'custom' && customStart) {
        params.startDate = customStart;
        if (customEnd) params.endDate = customEnd;
      }

      const res = await opsApi.list('reports/sales', params);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load sales report', err);
      // Fallback to /reports
      try {
        const fallbackRes = await opsApi.list('reports', {
          range,
          groupBy,
          zone: zone === 'All Zones' ? 'all' : zone,
          darkStoreId: darkStoreId === 'All Stores' ? 'all' : darkStoreId,
          status,
          paymentMethod,
        });
        setData(fallbackRes.data);
      } catch (fallbackErr) {
        setError(fallbackErr.response?.data?.message || err.response?.data?.message || 'Failed to load sales report');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [range, groupBy, zone, darkStoreId, status, paymentMethod]);

  // When selected zone changes, filter dark stores belonging to the new zone
  const availableStoresForZone = useMemo(() => {
    if (!data?.filterOptions?.stores) return [];
    if (!zone || zone === 'all' || zone === 'All Zones') {
      return data.filterOptions.stores;
    }
    return data.filterOptions.stores.filter(
      (s) => (s.zone || '').toLowerCase() === zone.toLowerCase()
    );
  }, [data?.filterOptions?.stores, zone]);

  // Handle Zone Change
  const handleZoneChange = (newZone) => {
    setZone(newZone);
    setDarkStoreId('all');
  };

  // Quick drill-down to a zone from the table
  const handleDrilldownZone = (zoneName) => {
    setZone(zoneName);
    setDarkStoreId('all');
    setActiveTab('stores');
  };

  // Quick filter to a store from the table
  const handleFilterStore = (storeId) => {
    setDarkStoreId(storeId);
    setActiveTab('orders');
  };

  // Export to CSV Function
  const exportToCSV = () => {
    if (!data) return;

    const kpis = data.kpis || {};
    const filters = data.filters || {};
    const lines = [];

    // Header & Summary
    lines.push('GREENGROCC DETAILED SALES & DARK STORE REPORT');
    lines.push(`Generated At,${new Date().toLocaleString('en-IN')}`);
    lines.push(`Date Range,${filters.startDate || ''} to ${filters.endDate || ''} (${range})`);
    lines.push(`Zone Filter,${zone}`);
    lines.push(`Dark Store Filter,${darkStoreId}`);
    lines.push(`Time Grouping,${groupBy}`);
    lines.push('');

    // KPIs
    lines.push('--- EXECUTIVE KPIS ---');
    lines.push('Metric,Value');
    lines.push(`Net Sales (INR),${kpis.totalSales || 0}`);
    lines.push(`Total Orders,${kpis.totalOrders || 0}`);
    lines.push(`Delivered Orders,${kpis.deliveredOrders || 0}`);
    lines.push(`Cancelled Orders,${kpis.cancelledOrders || 0}`);
    lines.push(`Delivery Success Rate (%),${kpis.deliveryRate || 0}%`);
    lines.push(`Cancellation Rate (%),${kpis.cancellationRate || 0}%`);
    lines.push(`Average Order Value (AOV INR),${kpis.aov || 0}`);
    lines.push(`Total Units Dispatched,${kpis.unitsSold || 0}`);
    lines.push('');

    // Zone Breakdown
    lines.push('--- ZONE-WISE SALES BREAKDOWN ---');
    lines.push('Zone Name,Dark Stores Count,Total Orders,Delivered Orders,Cancelled Orders,Net Sales (INR),AOV (INR),Delivery Rate (%),Revenue Share (%)');
    (filteredRows.zones).forEach((z) => {
      lines.push(
        `"${z.zone}",${z.storesCount || 0},${z.orders || 0},${z.deliveredOrders || 0},${z.cancelledOrders || 0},${z.totalSales || 0},${z.aov || 0},${z.deliveryRate || 0}%,${z.sharePct || 0}%`
      );
    });
    lines.push('');

    // Dark Store Breakdown
    lines.push('--- DARKSTORE-WISE DETAILED BREAKDOWN ---');
    lines.push('Dark Store Name,Zone,Area,Pincode,Total Orders,Delivered,Cancelled,Net Sales (INR),AOV (INR),Delivery Rate (%),Zone Share (%)');
    (filteredRows.stores).forEach((s) => {
      lines.push(
        `"${s.storeName}","${s.zone}","${s.area || ''}","${s.pincode || ''}",${s.orders || 0},${s.deliveredOrders || 0},${s.cancelledOrders || 0},${s.totalSales || 0},${s.aov || 0},${s.deliveryRate || 0}%,${s.sharePct || 0}%`
      );
    });
    lines.push('');

    // Timeline Sales Trend
    lines.push(`--- TIMELINE SALES TREND (${groupBy.toUpperCase()}-WISE) ---`);
    lines.push('Period Label,Period Key,Net Sales (INR),Total Orders,Delivered Orders,Cancelled Orders');
    (data.timeline || []).forEach((t) => {
      lines.push(`"${t.label}","${t.key}",${t.sales || 0},${t.orders || 0},${t.delivered || 0},${t.cancelled || 0}`);
    });
    lines.push('');

    // Top Products
    lines.push('--- TOP SELLING PRODUCTS ---');
    lines.push('Product Name,Units Sold,Revenue Generated (INR)');
    (filteredRows.products).forEach((p) => {
      lines.push(`"${p.name}",${p.units || 0},${p.sales || 0}`);
    });
    lines.push('');

    // Recent Orders
    lines.push('--- RECENT ORDERS IN SCOPE ---');
    lines.push('Order Number,Zone,Dark Store,Area,Total Amount (INR),Status,Payment Method,Items Count,Created At');
    (filteredRows.orders).forEach((o) => {
      lines.push(
        `"${o.orderNumber}","${o.zone}","${o.storeName}","${o.area || ''}",${o.total || 0},"${o.status}","${o.paymentMethod}",${o.itemsCount || 0},"${o.createdAt}"`
      );
    });

    lines.push('');
    lines.push('--- CURRENT DARK STORE STOCK REPORT ---');
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    lines.push('Dark Store,Zone,Tracked Products,Low Stock Products,Out of Stock Products');
    (filteredRows.stock).forEach((store) => {
      lines.push([store.storeName, store.zone, store.trackedProducts, store.lowStockCount, store.outOfStockCount].map(csvCell).join(','));
    });
    lines.push('Dark Store,Zone,Product,SKU,Available,Unit,Low Stock Threshold,Status');
    (filteredRows.stock).forEach((store) => store.items.forEach((item) => {
      lines.push([store.storeName, store.zone, item.name, item.sku, item.stockCount, item.unit, item.lowStockThreshold, item.status === 'out_of_stock' ? 'Out of stock' : 'Low stock'].map(csvCell).join(','));
    }));

    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sales_Report_${zone}_${range}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = data?.kpis || {};
  const timelineData = data?.timeline || [];
  const zonesBreakdown = data?.zonesBreakdown || [];
  const storesBreakdown = data?.storesBreakdown || [];
  const paymentBreakdown = data?.paymentBreakdown || [];
  const statusBreakdown = data?.statusBreakdown || [];
  const topProducts = data?.topProducts || [];
  const recentOrders = data?.recentOrders || [];

  const sourceRows = { zones: zonesBreakdown, stores: storesBreakdown, products: topProducts, orders: recentOrders, stock: data?.inventoryReport?.stores || [] };
  const filteredRows = Object.fromEntries(Object.entries(sourceRows).map(([tab, rows]) => {
    const f = tabFilters[tab] || {};
    const search = (row) => !f.search?.trim() || [row.zone, row.storeName, row.area, row.pincode, row.name, row.sku, row.orderNumber].some((value) => String(value || '').toLowerCase().includes(f.search.trim().toLowerCase()));
    const amount = (row) => Number(row.totalSales ?? row.sales ?? row.total ?? 0);
    const result = tab === 'stock' ? rows.map((store) => ({ ...store, items: store.items.filter((item) => search({ ...item, storeName: store.storeName, zone: store.zone }) && (!f.status || item.status === f.status) && (!f.category || item.category === f.category)) })).filter((store) => (!f.zone || store.zone === f.zone) && (!(f.search?.trim() || f.status || f.category) || store.items.length))
      : rows.filter((row) => search(row) && (!f.zone || row.zone === f.zone) && (!f.status || row.status === f.status) && (!f.payment || row.paymentMethod === f.payment) && (!f.min || amount(row) >= Number(f.min))).sort((a,b) => f.sort === 'high' ? amount(b)-amount(a) : f.sort === 'low' ? amount(a)-amount(b) : 0);
    return [tab, result];
  }));
  const optionsFor = (key) => [...new Set(sourceRows[activeTab].map((row) => row[key]).filter(Boolean))].sort().map((value) => [value, value]);
  const filterSelect = (label, key, options) => <label className="text-xs font-medium text-slate-600">{label}<select className={`${INPUT} mt-1 block`} value={tabFilter[key] || ''} onChange={(e) => updateTabFilter(key, e.target.value)}><option value="">All</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header & Actions ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={PAGE_KICKER}>Operations & Analytics</p>
          <h1 className={PAGE_TITLE}>Sales & Dark Store Reports</h1>
          <p className={PAGE_SUB}>
            Zone-wise and darkstore-wise revenue, delivery metrics, and fulfillment analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadReport(true)}
            disabled={refreshing || loading}
            className={`${BTN} gap-2 text-slate-700`}
            title="Refresh current report"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={exportToCSV}
            disabled={!data || loading}
            className={`${BTN_PRIMARY} gap-2`}
            title="Download detailed sales report CSV"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* ── Filter Toolbar ──────────────────────────────────────────────── */}
      <div className={`${PANEL} p-4 space-y-4`}>
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Filter className="h-4 w-4 text-emerald-600" />
          <span>Report Filters & Controls</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {/* Time Frequency / GroupBy */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Time Grouping</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className={INPUT}
            >
              {GROUP_OPTIONS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Preset */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Date Range</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className={INPUT}
            >
              {PRESET_RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Zone Selector */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Zone / City</label>
            <select
              value={zone}
              onChange={(e) => handleZoneChange(e.target.value)}
              className={INPUT}
            >
              <option value="all">All Zones</option>
              {(data?.filterOptions?.zones || [])
                .filter((z) => z !== 'All Zones')
                .map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
            </select>
          </div>

          {/* Dark Store Selector */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Dark Store {zone !== 'all' ? `(${zone})` : ''}
            </label>
            <select
              value={darkStoreId}
              onChange={(e) => setDarkStoreId(e.target.value)}
              className={INPUT}
            >
              <option value="all">
                {zone !== 'all' ? `All ${zone} Stores` : 'All Dark Stores'}
              </option>
              {availableStoresForZone.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.area ? `(${s.area})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Order Status */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Order Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={INPUT}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Payment Mode</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={INPUT}
            >
              {PAYMENT_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Pickers if 'custom' is active */}
        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className={`${INPUT} max-w-[170px] py-1.5`}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={`${INPUT} max-w-[170px] py-1.5`}
              />
            </div>
            <button
              type="button"
              onClick={() => loadReport(false)}
              className={`${BTN_PRIMARY} min-h-9 py-1 px-3 text-xs`}
            >
              Apply Custom Range
            </button>
          </div>
        )}

        {/* Active Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Active Scope:</span>
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 border border-emerald-200">
            {groupBy.toUpperCase()} Breakdown
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-800">
            Range: {data?.filters?.startDate || ''} to {data?.filters?.endDate || ''}
          </span>
          <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-800 border border-blue-200">
            Zone: {zone === 'all' ? 'All Zones' : zone}
          </span>
          {darkStoreId !== 'all' && (
            <span className="rounded-md bg-purple-50 px-2 py-0.5 font-medium text-purple-800 border border-purple-200">
              Store:{' '}
              {data?.filterOptions?.stores?.find((s) => s.id === darkStoreId)?.name || darkStoreId}
            </span>
          )}
          {status !== 'all' && (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-800 border border-amber-200 capitalize">
              Status: {status}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Metric Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Net Sales */}
        <div className={`${PANEL} p-4 relative overflow-hidden`}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Net Sales</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
            {formatCurrency(kpis.totalSales)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Delivered & active orders</p>
        </div>

        {/* Total Orders */}
        <div className={`${PANEL} p-4 relative overflow-hidden`}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
            {Number(kpis.totalOrders || 0).toLocaleString('en-IN')}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-block rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
              {kpis.deliveryRate || 0}% delivered
            </span>
          </div>
        </div>

        {/* Delivered Orders */}
        <div className={`${PANEL} p-4 relative overflow-hidden`}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Delivered</span>
            <PackageCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-xl font-bold text-emerald-700 sm:text-2xl">
            {Number(kpis.deliveredOrders || 0).toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Completed deliveries</p>
        </div>

        {/* Average Order Value (AOV) */}
        <div className={`${PANEL} p-4 relative overflow-hidden`}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Order Value</span>
            <CreditCard className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
            {formatCurrency(kpis.aov)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Revenue per live order</p>
        </div>

        {/* Cancelled Orders */}
        <div className={`${PANEL} p-4 relative overflow-hidden`}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Cancelled / Failed</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-xl font-bold text-rose-600 sm:text-2xl">
            {Number(kpis.cancelledOrders || 0).toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-[11px] text-rose-500 font-medium">
            {kpis.cancellationRate || 0}% rate
          </p>
        </div>

        {/* Total Units Dispatched */}
        <div className={`${PANEL} p-4 relative overflow-hidden`}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Units Sold</span>
            <Package className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
            {Number(kpis.unitsSold || 0).toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Products packaged</p>
        </div>
      </div>

      {/* ── Main Graphical Visualizations ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales & Orders Timeline Chart (2 Cols) */}
        <div className={`${PANEL} p-5 lg:col-span-2 space-y-3`}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-emerald-100 p-2 text-emerald-800">
                <BarChart3 className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Sales Revenue & Orders Trend
                </h2>
                <p className="text-xs text-slate-500">
                  {groupBy.toUpperCase()} progression of revenue (₹) and order volumes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-3 w-3 rounded-sm bg-emerald-700" /> Sales (₹)
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-3 w-3 rounded-full bg-blue-600" /> Orders
              </span>
            </div>
          </div>

          <div className="h-80 w-full pt-2">
            {loading ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => Math.round(val)}
                  />
                  <Tooltip
                    formatter={(val, name) => [
                      name === 'sales' ? formatCurrency(val) : Number(val).toLocaleString('en-IN'),
                      name === 'sales' ? 'Net Sales' : name === 'orders' ? 'Orders Placed' : 'Delivered',
                    ]}
                    labelFormatter={(label) => `Period: ${label}`}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="sales"
                    fill="#047857"
                    maxBarSize={45}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#2563EB' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No sales data recorded for the selected period
              </div>
            )}
          </div>
        </div>

        {/* Payment & Order Status Distribution (1 Col) */}
        <div className={`${PANEL} p-5 space-y-4 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-blue-100 p-2 text-blue-800">
                <CreditCard className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Payment & Status Breakdown</h2>
                <p className="text-xs text-slate-500">Distribution across settlement channels</p>
              </div>
            </div>

            {/* Payment Method Bars */}
            <div className="mt-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Payment Modes
              </p>
              {paymentBreakdown.map((pm) => (
                <div key={pm.method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{pm.method}</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(pm.sales)} ({pm.sharePct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, pm.sharePct || 0))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Breakdown Pills */}
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Fulfillment Status
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {statusBreakdown.map((st) => (
                <div key={st.status} className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: st.color || '#6B7280' }}
                    />
                    <span className="text-[11px] font-medium text-slate-600 truncate">
                      {st.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {Number(st.count || 0).toLocaleString('en-IN')}
                    <span className="ml-1 text-[10px] font-normal text-slate-500">
                      ({st.sharePct}%)
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Zone-wise & Darkstore-wise Comparative Charts ─────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Zone Performance Comparison Bar Chart */}
        <div className={`${PANEL} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-teal-100 p-2 text-teal-800">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Zone-wise Sales Comparison</h2>
                <p className="text-xs text-slate-500">Total revenue (₹) delivered per territory</p>
              </div>
            </div>
            {zone !== 'all' && (
              <button
                type="button"
                onClick={() => handleZoneChange('all')}
                className="text-xs text-emerald-700 hover:underline font-medium"
              >
                Clear Zone Filter
              </button>
            )}
          </div>

          <div className="h-64 w-full pt-2">
            {zonesBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={zonesBreakdown.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis
                    type="number"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <YAxis type="category" dataKey="zone" stroke="#475569" fontSize={11} width={80} />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), 'Net Sales']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="totalSales"
                    onClick={(entry) => handleZoneChange(entry.zone)}
                    className="cursor-pointer"
                  >
                    {zonesBreakdown.slice(0, 8).map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No zone metrics available
              </div>
            )}
          </div>
        </div>

        {/* Dark Store Performance Bar Chart */}
        <div className={`${PANEL} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-purple-100 p-2 text-purple-800">
                <Store className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Dark Store Sales Comparison
                </h2>
                <p className="text-xs text-slate-500">
                  {zone !== 'all' ? `Stores within ${zone}` : 'Top stores overall'}
                </p>
              </div>
            </div>
            {darkStoreId !== 'all' && (
              <button
                type="button"
                onClick={() => setDarkStoreId('all')}
                className="text-xs text-emerald-700 hover:underline font-medium"
              >
                Clear Store Filter
              </button>
            )}
          </div>

          <div className="h-64 w-full pt-2">
            {storesBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={storesBreakdown.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis
                    type="number"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="storeName"
                    stroke="#475569"
                    fontSize={11}
                    width={100}
                    tickFormatter={(v) => (v.length > 14 ? `${v.slice(0, 14)}...` : v)}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), 'Net Sales']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="totalSales"
                    fill="#7C3AED"
                    onClick={(entry) => handleFilterStore(entry.storeId)}
                    className="cursor-pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No dark store metrics available for this selection
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detailed Tables with Tabs ───────────────────────────────────── */}
      <div className={`${PANEL} overflow-hidden`}>
        {/* Tab Headers */}
        <div className="flex flex-wrap items-center border-b border-slate-200 bg-slate-50/90 px-4 pt-2">
          {[
            { id: 'zones', label: `Zone-wise Breakdown (${filteredRows.zones.length})`, icon: MapPin },
            { id: 'stores', label: `Darkstore-wise Breakdown (${filteredRows.stores.length})`, icon: Store },
            { id: 'products', label: `Top Products (${filteredRows.products.length})`, icon: Package },
            { id: 'stock', label: 'Low / Out of Stock', icon: Package },
            { id: 'orders', label: `Filtered Order Ledger (${filteredRows.orders.length})`, icon: ShoppingBag },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                  active
                    ? 'border-emerald-600 bg-white text-emerald-800 shadow-sm rounded-t-lg'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <label className="min-w-52 flex-1 text-xs font-medium text-slate-600">Search<input className={`${INPUT} mt-1 w-full`} value={tabFilter.search || ''} onChange={(e) => updateTabFilter('search', e.target.value)} placeholder={activeTab === 'stock' ? 'Product, SKU, dark store or zone' : activeTab === 'products' ? 'Product name' : activeTab === 'zones' ? 'Zone name' : 'Order number, dark store, zone or area'} /></label>
          {['stores', 'orders', 'stock'].includes(activeTab) && filterSelect('Zone', 'zone', optionsFor('zone'))}
          {activeTab === 'stock' ? <>
            {filterSelect('Stock status', 'status', [['low_stock', 'Low stock only'], ['out_of_stock', 'Out of stock only']])}
            {filterSelect('Category', 'category', [...new Set(sourceRows.stock.flatMap((store) => store.items.map((item) => item.category)).filter(Boolean))].sort().map((value) => [value, value]))}
          </> : <>
            <label className="text-xs font-medium text-slate-600">Minimum amount (INR)<input type="number" min="0" className={`${INPUT} mt-1 block w-36`} value={tabFilter.min || ''} onChange={(e) => updateTabFilter('min', e.target.value)} placeholder="Any amount" /></label>
            {filterSelect('Sort by amount', 'sort', [['high', 'High to low'], ['low', 'Low to high']])}
          </>}
          {activeTab === 'orders' && <>{filterSelect('Order status', 'status', optionsFor('status'))}{filterSelect('Payment', 'payment', optionsFor('paymentMethod'))}</>}
          <button type="button" className={BTN} onClick={() => setTabFilters((prev) => ({ ...prev, [activeTab]: {} }))}>Clear tab filters</button>
          <p className="w-full text-xs text-slate-500">Showing {filteredRows[activeTab].length} of {sourceRows[activeTab].length} {activeTab === 'stock' ? 'stores' : 'rows'}. Each tab keeps its own filters. CSV detail rows follow these filters.</p>
        </div>

        {activeTab === 'stock' && (
          <div className="space-y-4 p-4">
            <p className="text-sm text-slate-500">Current stock for each dark store in the selected zone/store. Sales date, order status and payment filters do not apply. Low stock means available quantity is at or below the product�s threshold.</p>
            {filteredRows.stock.map((store) => (
              <div key={store.storeId} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-4">
                  <div><h3 className="font-semibold text-slate-900">{store.storeName}</h3><p className="text-xs text-slate-500">{store.zone} � {store.trackedProducts} tracked products</p></div>
                  <div className="flex gap-3 text-sm"><span className="text-amber-700">Low stock: {store.lowStockCount}</span><span className="text-red-700">Out of stock: {store.outOfStockCount}</span></div>
                </div>
                {store.items.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
                  <thead><tr>{['Product', 'SKU', 'Category', 'Available', 'Low-stock threshold', 'Status'].map((label) => <th key={label} className={TH}>{label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">{store.items.map((item) => <tr key={item.id}>
                    <td className={TD}>{item.name}</td><td className={TD}>{item.sku}</td><td className={TD}>{item.category}</td>
                    <td className={TD}>{item.stockCount} {item.unit}</td><td className={TD}>{item.lowStockThreshold} {item.unit}</td>
                    <td className={TD}><span className={item.status === 'out_of_stock' ? 'text-red-700' : 'text-amber-700'}>{item.status === 'out_of_stock' ? 'Out of stock' : 'Low stock'}</span></td>
                  </tr>)}</tbody>
                </table></div> : <p className="p-4 text-sm text-slate-500">{store.trackedProducts ? 'No low-stock or out-of-stock products.' : 'No inventory tracked for this store.'}</p>}
              </div>
            ))}
            {!filteredRows.stock.length && <p className="py-6 text-center text-sm text-slate-500">No dark stores in this selection.</p>}
          </div>
        )}

        {/* Tab 1: Zone-wise Breakdown Table */}
        {activeTab === 'zones' && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70">
                <tr>
                  <th className={TH}>Zone Name</th>
                  <th className={TH}>Dark Stores</th>
                  <th className={TH}>Orders</th>
                  <th className={TH}>Delivered</th>
                  <th className={TH}>Cancelled</th>
                  <th className={TH}>Net Sales (₹)</th>
                  <th className={TH}>AOV (₹)</th>
                  <th className={TH}>Delivery Rate</th>
                  <th className={TH}>Revenue Share</th>
                  <th className={TH}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.zones.map((row) => (
                  <tr
                    key={row.zone}
                    className={`hover:bg-slate-50/80 transition ${
                      zone.toLowerCase() === row.zone.toLowerCase() ? 'bg-emerald-50/50' : ''
                    }`}
                  >
                    <td className="px-3 py-3 font-semibold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{row.zone}</span>
                    </td>
                    <td className={TD}>{row.storesCount || 0} stores</td>
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {Number(row.orders || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-emerald-700 font-medium">
                      {Number(row.deliveredOrders || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-rose-600">
                      {Number(row.cancelledOrders || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-900">
                      {formatCurrency(row.totalSales)}
                    </td>
                    <td className={TD}>{formatCurrency(row.aov)}</td>
                    <td className={TD}>
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {row.deliveryRate}%
                      </span>
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">{row.sharePct}%</span>
                        <div className="h-1.5 w-14 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{ width: `${Math.min(100, row.sharePct)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <button
                        type="button"
                        onClick={() => handleDrilldownZone(row.zone)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                      >
                        <span>View Stores</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredRows.zones.length && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      No zone sales found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Darkstore-wise Breakdown Table */}
        {activeTab === 'stores' && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70">
                <tr>
                  <th className={TH}>Dark Store</th>
                  <th className={TH}>Zone</th>
                  <th className={TH}>Area / Pincode</th>
                  <th className={TH}>Total Orders</th>
                  <th className={TH}>Delivered</th>
                  <th className={TH}>Cancelled</th>
                  <th className={TH}>Net Sales (₹)</th>
                  <th className={TH}>AOV (₹)</th>
                  <th className={TH}>Delivery Rate</th>
                  <th className={TH}>Share</th>
                  <th className={TH}>Filter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.stores.map((row) => (
                  <tr
                    key={row.storeId}
                    className={`hover:bg-slate-50/80 transition ${
                      darkStoreId === row.storeId ? 'bg-purple-50/50' : ''
                    }`}
                  >
                    <td className="px-3 py-3 font-semibold text-slate-900 flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-purple-600" />
                      <span>{row.storeName}</span>
                    </td>
                    <td className={TD}>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {row.zone}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {row.area || '—'} {row.pincode ? `(${row.pincode})` : ''}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {Number(row.orders || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-emerald-700 font-medium">
                      {Number(row.deliveredOrders || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-rose-600">
                      {Number(row.cancelledOrders || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-900">
                      {formatCurrency(row.totalSales)}
                    </td>
                    <td className={TD}>{formatCurrency(row.aov)}</td>
                    <td className={TD}>
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {row.deliveryRate}%
                      </span>
                    </td>
                    <td className={TD}>
                      <span className="font-semibold text-slate-700">{row.sharePct}%</span>
                    </td>
                    <td className={TD}>
                      <button
                        type="button"
                        onClick={() => handleFilterStore(row.storeId)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 hover:underline"
                      >
                        <span>Select</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredRows.stores.length && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                      No dark stores recorded for this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Top Products Table */}
        {activeTab === 'products' && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70">
                <tr>
                  <th className={TH}>Rank</th>
                  <th className={TH}>Product Name</th>
                  <th className={TH}>Units Sold</th>
                  <th className={TH}>Revenue Generated (₹)</th>
                  <th className={TH}>Avg Item Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.products.map((p, index) => {
                  const avgPrice = p.units > 0 ? Math.round(p.sales / p.units) : 0;
                  return (
                    <tr key={p.name} className="hover:bg-slate-50/80 transition">
                      <td className="px-3 py-3 text-xs font-bold text-slate-400">#{index + 1}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="px-3 py-3 font-medium text-slate-700">
                        {Number(p.units || 0).toLocaleString('en-IN')} units
                      </td>
                      <td className="px-3 py-3 font-bold text-emerald-800">
                        {formatCurrency(p.sales)}
                      </td>
                      <td className={TD}>{formatCurrency(avgPrice)}</td>
                    </tr>
                  );
                })}
                {!filteredRows.products.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No product sales recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Filtered Order Ledger */}
        {activeTab === 'orders' && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70">
                <tr>
                  <th className={TH}>Order #</th>
                  <th className={TH}>Zone</th>
                  <th className={TH}>Dark Store</th>
                  <th className={TH}>Area</th>
                  <th className={TH}>Items</th>
                  <th className={TH}>Payment</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Date & Time</th>
                  <th className={TH}>Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.orders.map((ord) => (
                  <tr key={ord.id || ord._id} className="hover:bg-slate-50/80 transition">
                    <td className="px-3 py-3 font-bold text-slate-900">{ord.orderNumber}</td>
                    <td className={TD}>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {ord.zone}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium text-slate-800">
                      {ord.storeName}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{ord.area}</td>
                    <td className={TD}>{ord.itemsCount || 1} items</td>
                    <td className="px-3 py-3 text-xs capitalize text-slate-600">
                      {ord.paymentMethod}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                          ord.statusCategory === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.statusCategory === 'cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : ord.statusCategory === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {String(ord.status || '').replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-900">
                      {formatCurrency(ord.total)}
                    </td>
                  </tr>
                ))}
                {!filteredRows.orders.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No orders found in the selected scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
