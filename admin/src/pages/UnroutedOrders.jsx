import { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Route } from 'lucide-react';
import apiClient from '../api/client';
import { darkStoreApi } from '../api/darkStoreApi';
import { TH } from '../utils/ui';
import { useLive } from '../realtime/useLive';

const cell = 'px-3 py-2.5 align-top text-xs leading-5 text-slate-700';
const button = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50';

const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const fmtDateTime = (v) =>
  v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const addressLine = (a) =>
  [a?.fullAddress, a?.area, a?.city, a?.pincode].filter(Boolean).join(', ') || '—';

export default function UnroutedOrders() {
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [chosen, setChosen] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState(null);

  const load = useCallback(async ({ silent = false, force = true } = {}) => {
    if (!silent) setLoading(true);
    setLoadFailed(false);
    setNotice((current) => current?.source === 'load' ? null : current);
    try {
      const [ordersRes, storesRes] = await Promise.all([
        apiClient.get('/orders/admin/unrouted', { live: !force }),
        darkStoreApi.list({ limit: 500 }, { live: !force }),
      ]);
      setOrders(ordersRes.data?.data || []);
      setStores(
        (storesRes.stores || storesRes.data || [])
          .map((s) => ({ ...s, id: s.id || s._id }))
          .filter((s) => s.isActive !== false && s.id && s.id !== 'undefined')
          .map((s) => ({ id: s.id, label: `${s.storeName || s.name || 'Dark store'}${s.area ? ` · ${s.area}` : ''}` }))
      );
    } catch (err) {
      setLoadFailed(true);
      setNotice({ source: 'load', tone: 'error', text: err.response?.data?.message || 'Failed to load unrouted orders' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useLive(({ silent }) => load({ silent, force: false }));

  const reroute = async (order) => {
    setBusyId(order._id);
    setNotice(null);
    try {
      const storeId = chosen[order._id] || undefined;
      const { data } = await apiClient.post(`/orders/admin/${order._id}/reroute`, storeId ? { storeId } : {});
      setNotice({ tone: 'success', text: `#${order.orderNumber}: ${data.message}` });
      setOrders((list) => list.filter((o) => o._id !== order._id));
    } catch (err) {
      setNotice({ tone: 'error', text: `#${order.orderNumber}: ${err.response?.data?.message || 'Re-route failed'}` });
      load();
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Orders / Dispatch</p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-950">Unrouted orders</h1>
          <p className="mt-0.5 text-xs text-slate-600">
            Retry automatic matching or assign an order to a dark store.
          </p>
        </div>
        <button type="button" className={`${button} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} onClick={load} disabled={loading || Boolean(busyId)}>
          <RefreshCw aria-hidden="true" className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {notice ? (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-md px-3 py-2 text-xs ring-1 ${
            notice.tone === 'error' ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-emerald-50 text-emerald-800 ring-emerald-100'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="routing-queue">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
          <h2 id="routing-queue" className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <Route aria-hidden="true" className="size-3.5 text-slate-500" /> Routing queue
          </h2>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-700">
            {loading ? 'Loading' : loadFailed ? 'Unavailable' : `${orders.length} awaiting routing`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] divide-y divide-slate-200" aria-busy={loading}>
            <thead className="bg-slate-50">
              <tr>
                <th className={TH}>Order</th>
                <th className={TH}>Customer & address</th>
                <th className={TH}>Amount</th>
                <th className={TH}>Routing exception</th>
                <th className={TH}>Assign to</th>
                <th className={TH}><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-xs text-slate-600" colSpan={6}>Loading routing queue…</td>
                </tr>
              ) : loadFailed || orders.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-xs text-slate-600" colSpan={6}>
                    {loadFailed ? 'Queue unavailable. Refresh to try again.' : (
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-700" /> No orders awaiting routing.
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50/70">
                    <td className={cell}>
                      <div className="font-semibold tabular-nums text-slate-900">#{order.orderNumber}</div>
                      <div className="text-xs text-slate-500">{fmtDateTime(order.createdAt)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {order.itemsCount} items · {order.fulfillmentType === 'pickup' ? 'Pickup' : 'Delivery'}
                        {order.preOrderSlot ? ` · Pre-order ${order.preOrderSlot}` : ''}
                      </div>
                    </td>
                    <td className={cell}>
                      <div className="font-medium">{order.user?.name || order.deliveryAddress?.fullName || 'Customer'}</div>
                      <div className="text-xs text-slate-500">{order.user?.phone || order.deliveryAddress?.number || ''}</div>
                      <div className="mt-1 max-w-xs text-xs text-slate-600">{addressLine(order.deliveryAddress)}</div>
                    </td>
                    <td className={cell}>
                      <div className="font-semibold tabular-nums text-slate-900">{money(order.total)}</div>
                      <div className="text-[11px] uppercase text-slate-500">
                        {order.paymentMethod} · {order.paymentStatus}
                      </div>
                    </td>
                    <td className={cell}>
                      <div className="flex items-start gap-1.5 text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="text-xs font-medium">{order.routingError || 'Not routed yet'}</span>
                      </div>
                      {order.routingAttemptedAt ? (
                        <div className="mt-1 text-[11px] text-slate-400">Last try {fmtDateTime(order.routingAttemptedAt)}</div>
                      ) : null}
                    </td>
                    <td className={cell}>
                      <select
                        aria-label={`Destination store for order ${order.orderNumber}`}
                        className="h-8 w-full min-w-40 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus-visible:outline-2 focus-visible:outline-slate-700 disabled:opacity-50"
                        disabled={Boolean(busyId)}
                        value={chosen[order._id] || ''}
                        onChange={(e) => setChosen((c) => ({ ...c, [order._id]: e.target.value }))}
                      >
                        <option value="">Auto (nearest store)</option>
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${cell} text-right`}>
                      <button
                        type="button"
                        className={`${button} whitespace-nowrap border-slate-900 bg-slate-900 text-white hover:bg-slate-700`}
                        disabled={Boolean(busyId)}
                        onClick={() => reroute(order)}
                      >
                        {busyId === order._id ? 'Routing…' : 'Re-route'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
