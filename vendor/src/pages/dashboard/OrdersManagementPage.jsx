import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, RefreshCw, Download, X } from 'lucide-react';
import { vendorApi } from '../../api/vendorApi';
import { BTN, BTN_PRIMARY, INPUT, PANEL, PAGE_TITLE, PAGE_SUB, TH, TD } from '../../utils/ui';
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const label = (value) => String(value || 'Unknown').replaceAll('_', ' ');
const time = (value) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not yet';
export default function OrdersManagementPage() {
  const [filters, setFilters] = useState({ range: 'month', storeId: 'all', status: 'all', payment: 'all', fulfillment: 'all', search: '', page: 1, areaKey: '' });
  const detailRef = useRef(null);
  const [search, setSearch] = useState('');
  const [dates, setDates] = useState({ startDate: '', endDate: '' });
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0), [selected, setSelected] = useState(null);
  const change = (key, value) => { setSelected(null); setFilters((previous) => ({ ...previous, [key]: value, page: 1, ...(key === 'storeId' ? { areaKey: '' } : {}) })); };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    vendorApi.getOrderManagement(filters, controller.signal).then(({ data: result }) => { if (!controller.signal.aborted) setData(result); }).catch((err) => { if (!controller.signal.aborted) { setData(null); setError(err.response?.data?.message || 'Unable to load orders.'); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, refresh]);
  useEffect(() => {
    if (!selected) return;
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    detailRef.current?.focus({ preventScroll: true });
    const close = (event) => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close);
  }, [selected]);
  const select = (title, key, options) => <label className="text-xs font-semibold text-slate-600">{title}<select className={`${INPUT} mt-1 block`} value={filters[key]} onChange={(event) => change(key, event.target.value)}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  const exportAreas = () => {
    const rows = [['Dark store', 'Customer area', 'City', 'Pincode', 'Customer orders', 'Delivered orders', 'Store share %', 'Delivered sales'], ...(data?.areaDemand || []).map((row) => [row.storeName, row.area, row.city, row.pincode, row.orders, row.delivered, row.share, row.sales])];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'Customer_Area_Demand.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  const summary = data?.summary || {};
  const knownAreas = (data?.areaDemand || []).filter((row) => row.area !== 'Unknown area');
  const topArea = knownAreas[0];
  const unknownOrders = (data?.areaDemand || []).filter((row) => row.area === 'Unknown area').reduce((sum, row) => sum + row.orders, 0);
  const peak = Math.max(1, ...(data?.areaDemand || []).map((row) => row.orders));
  return <div className="space-y-6 pb-16">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className={PAGE_TITLE}>Orders Management</h1><p className={PAGE_SUB}>Monitor fulfilment, payments and the customer areas driving demand for your dark stores.</p></div><button className={BTN} disabled={loading} onClick={() => { setSelected(null); setRefresh((value) => value + 1); }}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
    <div className="flex flex-wrap gap-2"><Link className={BTN} to="/sales">Sales Summary</Link><Link className={BTN} to="/vendor/preorders">Customer Pre-orders</Link><Link className={BTN} to="/vendor/orders/farmer">Farmer Orders</Link><Link className={BTN} to="/vendor/delivery-boys">Delivery Team</Link></div>
    <section className={`${PANEL} space-y-4 p-4`} aria-label="Order filters">
      <div className="flex flex-wrap items-end gap-3">
        {select('Period', 'range', [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['7d', 'Last 7 days'], ['month', 'This month'], ['last_month', 'Last month'], ['30d', 'Last 30 days'], ['year', 'This year'], ...(filters.range === 'custom' ? [['custom', 'Custom dates']] : [])])}
        {select('Dark store', 'storeId', [['all', 'All my dark stores'], ...(data?.stores || []).map((store) => [store.id, `${store.name} - ${store.location}`])])}
        {select('Order status', 'status', [['all', 'All statuses'], ...(data?.statusOptions || []).map((status) => [status, label(status)])])}
        {select('Payment', 'payment', [['all', 'All payments'], ['cod', 'Cash on delivery'], ['online', 'Online']])}
        {select('Fulfilment', 'fulfillment', [['all', 'All types'], ['delivery', 'Delivery'], ['pickup', 'Store pickup']])}
      </div>
      <div className="flex flex-wrap items-end gap-3"><form className="flex flex-1 items-end gap-2" onSubmit={(event) => { event.preventDefault(); change('search', search); }}><label className="min-w-48 flex-1 text-xs font-semibold text-slate-600">Search orders<input className={`${INPUT} mt-1`} placeholder="Order number, customer, phone, area or pincode" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className={BTN_PRIMARY}>Search</button></form>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (dates.startDate > dates.endDate) { setError('End date must follow start date.'); return; } setFilters((previous) => ({ ...previous, ...dates, range: 'custom', page: 1 })); }}>
          <label className="text-xs font-semibold text-slate-600">From<input type="date" required className={`${INPUT} mt-1`} value={dates.startDate} onChange={(event) => setDates((previous) => ({ ...previous, startDate: event.target.value }))} /></label><label className="text-xs font-semibold text-slate-600">To<input type="date" required min={dates.startDate} className={`${INPUT} mt-1`} value={dates.endDate} onChange={(event) => setDates((previous) => ({ ...previous, endDate: event.target.value }))} /></label><button className={BTN}>Apply dates</button>
        </form>
        <button className={BTN} onClick={() => { setFilters({ range: 'month', storeId: 'all', status: 'all', payment: 'all', fulfillment: 'all', search: '', page: 1, areaKey: '' }); setSearch(''); setSelected(null); }}>Reset</button>
      </div>
    </section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {loading ? <p role="status" className={`${PANEL} p-12 text-center`}>Loading order management...</p> : data && <>
      <p className="text-xs text-slate-500">{data.filters.startDate} to {data.filters.endDate} (IST). Deleted records and parts with missing parent orders are excluded.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[['Customer orders', summary.customerOrders], ['Order parts', summary.orderParts], ['Pending parts', summary.pending], ['Cancelled / failed parts', summary.cancelled], ['Delivered sales', money(summary.sales)]].map(([title, value]) => <div key={title} className={`${PANEL} p-4`}><p className="text-xs text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
      <div className="flex flex-wrap gap-2" aria-label="Order status breakdown">{Object.entries(data.statusCounts).map(([status, count]) => <button key={status} className={filters.status === status ? BTN_PRIMARY : BTN} onClick={() => change('status', filters.status === status ? 'all' : status)}>{label(status)} ({count})</button>)}</div>
      <section className={`${PANEL} overflow-hidden`}>
        <div className="flex flex-wrap items-start justify-between gap-3 p-5"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-emerald-600" />Where are most orders coming from?</h2><p className="mt-1 text-sm text-slate-500">Customer delivery areas ranked within each dark store. Select an area to view its orders.</p></div><button className={BTN} onClick={exportAreas}><Download className="mr-2 h-4 w-4" />Export areas</button></div>
        {topArea && <div className="mx-5 mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-900"><p className="text-xs font-semibold uppercase">Highest-demand known area / store pair</p><p className="mt-1 text-xl font-bold">{topArea.area}{topArea.pincode ? ` (${topArea.pincode})` : ''}</p><p className="text-sm">{topArea.storeName}: {topArea.orders} customer orders · {topArea.share}% of this store's delivery orders</p></div>}
        <p className="px-5 pb-4 text-xs text-slate-500">Counts include cancelled orders as demand and deduplicate split parts per customer order per store. Store pickups are excluded. {unknownOrders > 0 ? `${unknownOrders} store/customer-order combinations have no saved customer area; they appear as Unknown area.` : ''} Area drill-down changes the ledger only.</p>
        <div className="max-h-[28rem] overflow-auto"><table className="min-w-full text-left text-sm"><thead><tr>{['Rank', 'Customer area', 'Dark store', 'Orders', 'Share in store', 'Delivered', 'Delivered sales', ''].map((title, index) => <th key={index} className={TH}>{title}</th>)}</tr></thead><tbody>{data.areaDemand.map((row, index) => <tr key={row.key} className="border-t border-slate-100"><td className={TD}>{index + 1}</td><td className={TD}><strong>{row.area}</strong><span className="block text-xs text-slate-500">{[row.city, row.pincode].filter(Boolean).join(' - ')}</span><div className="mt-1 h-1 w-28 rounded bg-slate-100"><div className="h-1 rounded bg-emerald-500" style={{ width: `${row.orders / peak * 100}%` }} /></div></td><td className={TD}>{row.storeName}</td><td className={TD}>{row.orders}</td><td className={TD}>{row.share}%</td><td className={TD}>{row.delivered}</td><td className={TD}>{money(row.sales)}</td><td className={TD}><button className="font-semibold text-emerald-700" onClick={() => setFilters((previous) => ({ ...previous, storeId: row.storeId, areaKey: row.areaKey, page: 1 }))}>View orders</button></td></tr>)}</tbody></table>{!data.areaDemand.length && <p className="p-8 text-center text-slate-500">No delivery orders in this selection.</p>}</div>
      </section>
      <section className={`${PANEL} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-2 p-5"><h2 className="text-lg font-semibold">Order ledger ({data.pagination.total} parts)</h2>{filters.areaKey && <button className={BTN} onClick={() => change('areaKey', '')}>Clear customer-area filter</button>}</div>
        <div className="overflow-auto"><table className="min-w-full text-left text-sm"><thead><tr>{['Order', 'Customer', 'Dark store / customer area', 'Status', 'Payment', 'Value', 'Placed (IST)', ''].map((title, index) => <th key={index} className={TH}>{title}</th>)}</tr></thead><tbody>{data.orders.map((order) => <tr key={order.id} className="border-t border-slate-100"><td className={TD}><strong>{order.orderNumber}</strong><span className="block text-xs text-slate-500">{order.isPreOrder ? 'Pre-order' : label(order.fulfillmentType || 'delivery')}</span></td><td className={TD}>{order.customerName}<span className="block text-xs text-slate-500">{order.customerPhone}</span></td><td className={TD}>{order.storeName}<span className="block text-xs text-slate-500">{order.area} {order.pincode}</span></td><td className={TD}><span className={`rounded px-2 py-1 text-xs capitalize ${order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : order.status === 'cancelled' || order.status === 'delivery_failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{label(order.status)}</span></td><td className={TD}>{label(order.paymentMethod)}<span className="block text-xs text-slate-500">{label(order.paymentStatus)}</span></td><td className={TD}>{money(order.amount)}</td><td className={TD}>{time(order.createdAt)}</td><td className={TD}><button className="font-semibold text-emerald-700" onClick={() => setSelected(order)}>Details</button></td></tr>)}</tbody></table>{!data.orders.length && <p className="p-8 text-center text-slate-500">No orders match these filters.</p>}</div>
        <div className="flex items-center justify-between border-t border-slate-100 p-4"><button className={BTN} disabled={data.pagination.page <= 1} onClick={() => setFilters((previous) => ({ ...previous, page: data.pagination.page - 1 }))}>Previous</button><span className="text-xs text-slate-500">Page {data.pagination.page} of {data.pagination.pages}</span><button className={BTN} disabled={data.pagination.page >= data.pagination.pages} onClick={() => setFilters((previous) => ({ ...previous, page: data.pagination.page + 1 }))}>Next</button></div>
      </section>
    </>}
    {selected && <section ref={detailRef} tabIndex={-1} className={`${PANEL} p-5`} aria-label="Order details"><div className="flex justify-between"><div><h2 className="text-lg font-semibold">Order {selected.orderNumber}</h2><p className="text-xs text-slate-500">Existing ID: {selected.id}</p></div><button className={BTN} aria-label="Close order details" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button></div>
      <div className="my-4 grid gap-4 sm:grid-cols-3"><div><h3 className="font-semibold">Customer & delivery</h3><p>{selected.customerName} · {selected.customerPhone}</p><p className="text-sm text-slate-600">{selected.customerAddress}</p><p className="text-sm">{selected.area} {selected.pincode}</p><p className="text-xs text-slate-500">Distance: {selected.distanceKm ?? 'Unknown'} km</p></div><div><h3 className="font-semibold">Payment</h3><p>{money(selected.amount)} · {label(selected.paymentMethod)}</p><p className="text-sm">{label(selected.paymentStatus)}</p><p className="text-sm">To collect: {money(selected.amountToCollect)} · Collected: {money(selected.amountCollected)}</p></div><div><h3 className="font-semibold">Fulfilment</h3><p className="capitalize">{label(selected.status)}</p><p className="text-sm">Assignment: {label(selected.assignmentStatus)}</p><p className="text-sm">{selected.storeName}</p>{selected.preOrderSlot && <p className="text-sm">Pre-order slot: {selected.preOrderSlot}</p>}</div></div>
      <div className="overflow-auto"><table className="min-w-full text-left text-sm"><thead><tr>{['Item', 'Quantity', 'Unit price', 'Total'].map((title) => <th key={title} className={TH}>{title}</th>)}</tr></thead><tbody>{selected.items?.map((item, index) => <tr key={item._id || `${item.productId || item.sku || item.name}-${index}`}><td className={TD}>{item.name}</td><td className={TD}>{item.quantity} {item.unit}</td><td className={TD}>{money(item.price)}</td><td className={TD}>{money((Number(item.price) || 0) * (Number(item.quantity) || 0))}</td></tr>)}</tbody></table></div>
      <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-4">{[['Placed', selected.createdAt], ['Packed', selected.packedAt], ['Assigned', selected.assignedAt], ['Delivered', selected.deliveredAt]].map(([title, value]) => <p key={title}><strong>{title}</strong><br />{time(value)}</p>)}</div>{selected.failureReason && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Failure reason: {selected.failureReason}</p>}{selected.notes && <p className="mt-3 text-sm text-slate-600">Notes: {selected.notes}</p>}
    </section>}
  </div>;
}
