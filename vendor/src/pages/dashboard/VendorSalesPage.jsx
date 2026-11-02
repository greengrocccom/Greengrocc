import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw, TrendingUp, ShoppingBag, CheckCircle, Clock } from 'lucide-react';
import { vendorApi } from '../../api/vendorApi';
import { BTN, BTN_PRIMARY, INPUT, PANEL, PAGE_TITLE, PAGE_SUB, TH, TD } from '../../utils/ui';

const ranges = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['7d', 'Last 7 days'], ['month', 'This month'], ['last_month', 'Last month'], ['30d', 'Last 30 days'], ['year', 'This year'], ['custom', 'Custom dates']];
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export default function VendorSalesPage() {
  const [filters, setFilters] = useState({ range: 'month', groupBy: 'day', storeId: 'all' });
  const [draft, setDraft] = useState({ startDate: '', endDate: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const update = (key, value) => setFilters((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    vendorApi.getSalesSummary(filters, controller.signal).then((response) => {
      if (!controller.signal.aborted) setData(response.data);
    }).catch((err) => {
      if (!controller.signal.aborted) { setData(null); setError(err.response?.data?.message || 'Unable to load sales. Please retry.'); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, refresh]);
  const exportCsv = () => {
    if (!data || loading) return;
    const cell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [['Vendor sales summary'], ['Start date', data.filters.startDate, 'End date', data.filters.endDate], ['Delivered sales', data.totals.sales], ['Pending order value', data.totals.pendingValue], ['Period', 'Orders', 'Delivered', 'Cancelled', 'Delivered sales', 'Pending value', 'Average delivered order']];
    data.timeline.forEach((row) => lines.push([row.key, row.orders, row.delivered, row.cancelled, row.sales, row.pendingValue, row.aov]));
    lines.push([], ['Dark store', 'Orders', 'Delivered', 'Cancelled', 'Delivered sales', 'Pending value']);
    data.stores.forEach((row) => lines.push([row.name, row.orders, row.delivered, row.cancelled, row.sales, row.pendingValue]));
    const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.map((row) => row.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Sales_${data.filters.startDate}_${data.filters.endDate}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const totals = data?.totals || {};
  const peak = Math.max(1, ...(data?.timeline || []).map((row) => row.sales));
  return <div className="space-y-6 pb-16">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link to="/dashboard" className="text-sm font-medium text-emerald-700">Dashboard</Link><h1 className={PAGE_TITLE}>Sales Summary</h1><p className={PAGE_SUB}>Track customer sales across your dark stores.</p></div>
      <div className="flex gap-2"><button type="button" className={BTN} disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button><button type="button" className={BTN_PRIMARY} disabled={!data || loading} onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</button></div>
    </div>
    <section className={`${PANEL} space-y-4 p-4`} aria-label="Sales filters">
      <div className="flex flex-wrap gap-2">{ranges.map(([id, label]) => <button type="button" key={id} className={filters.range === id ? BTN_PRIMARY : BTN} onClick={() => { if (id === 'custom') setDraft((value) => ({ ...value, open: true })); else { update('range', id); setDraft((value) => ({ ...value, open: false })); } }}>{label}</button>)}</div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-600">Dark store<select className={`${INPUT} mt-1 block`} value={filters.storeId} onChange={(event) => update('storeId', event.target.value)}><option value="all">All my dark stores</option>{data?.filterOptions.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Group sales by<select className={`${INPUT} mt-1 block`} value={filters.groupBy} onChange={(event) => update('groupBy', event.target.value)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
        {(draft.open || filters.range === 'custom') && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); if (draft.startDate > draft.endDate) { setError('End date must be on or after start date.'); return; } setFilters((value) => ({ ...value, range: 'custom', startDate: draft.startDate, endDate: draft.endDate })); }}>
          <label className="text-xs font-semibold text-slate-600">From<input required type="date" className={`${INPUT} mt-1 block`} value={draft.startDate} onChange={(event) => setDraft((value) => ({ ...value, startDate: event.target.value }))} /></label>
          <label className="text-xs font-semibold text-slate-600">To<input required type="date" min={draft.startDate} className={`${INPUT} mt-1 block`} value={draft.endDate} onChange={(event) => setDraft((value) => ({ ...value, endDate: event.target.value }))} /></label><button className={BTN_PRIMARY}>Apply dates</button>
        </form>}
      </div>
      <p className="text-xs text-slate-500">All dates use India Standard Time. Sales are delivered order values grouped by order placement date. Pending orders are shown separately; cancelled, returned, deleted and orphaned orders do not contribute to sales.</p>
    </section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading ? <div role="status" className={`${PANEL} p-12 text-center text-slate-500`}>Loading sales summary...</div> : data && <>
      <p className="text-sm text-slate-500">{data.filters.startDate} to {data.filters.endDate} · Updated {new Date(data.generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Delivered sales', money(totals.sales), TrendingUp], ['Total order parts', totals.orders || 0, ShoppingBag], ['Delivered order parts', totals.delivered || 0, CheckCircle], ['Pending order value', money(totals.pendingValue), Clock],
      ].map(([label, value, Icon]) => <div key={label} className={`${PANEL} p-5`}><div className="flex items-center justify-between text-sm text-slate-500">{label}<Icon className="h-5 w-5 text-emerald-600" /></div><p className="mt-3 text-2xl font-bold text-slate-900">{value}</p></div>)}</div>
      <p className="text-sm text-slate-600">Average delivered order part: <strong>{money(totals.aov)}</strong> · Cancelled / returned parts: <strong>{totals.cancelled}</strong></p>
      <section className={`${PANEL} p-5`}><h2 className="text-lg font-semibold">Sales trend</h2><p className="mb-4 text-xs text-slate-500">{filters.groupBy === 'week' ? 'Weeks start on Monday; boundary weeks include only selected dates.' : 'Delivered sales for the selected period.'}</p>
        {!totals.orders && <p className="mb-4 text-sm text-slate-500">No orders found for this selection.</p>}
        <div className="overflow-x-auto"><div className="flex h-48 items-end gap-2 border-b border-slate-200 pb-1" style={{ minWidth: Math.max(300, data.timeline.length * 38) }}>{data.timeline.map((row) => <div key={row.key} className="flex h-full flex-1 flex-col justify-end" title={`${row.key}: ${money(row.sales)}`}><div className="min-h-0 rounded-t bg-emerald-500" style={{ height: `${row.sales / peak * 85}%` }} /><span className="mt-2 truncate text-center text-[10px] text-slate-500">{row.key.slice(5) || row.key}</span></div>)}</div></div>
      </section>
      <section className={`${PANEL} overflow-hidden`}><h2 className="p-5 text-lg font-semibold">{filters.groupBy === 'day' ? 'Daily' : filters.groupBy === 'week' ? 'Weekly' : 'Monthly'} breakdown</h2><div className="max-h-96 overflow-auto"><table className="min-w-full text-left text-sm"><thead><tr>{['Period', 'Order parts', 'Delivered', 'Cancelled', 'Sales', 'Pending value'].map((label) => <th key={label} className={TH}>{label}</th>)}</tr></thead><tbody>{data.timeline.map((row) => <tr key={row.key} className="border-t border-slate-100"><td className={TD}>{row.key}</td><td className={TD}>{row.orders}</td><td className={TD}>{row.delivered}</td><td className={TD}>{row.cancelled}</td><td className={TD}>{money(row.sales)}</td><td className={TD}>{money(row.pendingValue)}</td></tr>)}</tbody></table></div></section>
      <section className={`${PANEL} overflow-hidden`}><h2 className="p-5 text-lg font-semibold">Dark-store performance</h2><div className="overflow-auto"><table className="min-w-full text-left text-sm"><thead><tr>{['Dark store', 'Order parts', 'Delivered', 'Sales', 'Pending value'].map((label) => <th key={label} className={TH}>{label}</th>)}</tr></thead><tbody>{data.stores.map((store) => <tr key={store.id} className="border-t border-slate-100"><td className={TD}>{store.name}<span className="block text-xs text-slate-400">{store.city}</span></td><td className={TD}>{store.orders}</td><td className={TD}>{store.delivered}</td><td className={TD}>{money(store.sales)}</td><td className={TD}>{money(store.pendingValue)}</td></tr>)}</tbody></table>{!data.stores.length && <p className="p-6 text-center text-sm text-slate-500">No dark stores assigned to your account.</p>}</div></section>
    </>}
  </div>;
}
