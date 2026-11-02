import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import apiClient from '../api/client';
import { darkStoreApi } from '../api/darkStoreApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TD, TH } from '../utils/ui';

const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const fmtDateTime = (v) =>
  v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const addressLine = (a = {}) =>
  [a.fullAddress, a.area, a.city, a.pincode].filter(Boolean).join(', ') || '—';

export default function UnroutedOrders() {
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [chosen, setChosen] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, storesRes] = await Promise.all([
        apiClient.get('/orders/admin/unrouted'),
        darkStoreApi.list({ limit: 500 }),
      ]);
      setOrders(ordersRes.data?.data || []);
      setStores(
        (storesRes.stores || storesRes.data || [])
          .filter((s) => s.isActive !== false)
          .map((s) => ({ id: s.id || s._id, label: `${s.storeName || s.name || 'Dark store'}${s.area ? ` · ${s.area}` : ''}` }))
      );
    } catch (err) {
      setNotice({ tone: 'error', text: err.response?.data?.message || 'Failed to load unrouted orders' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={PAGE_KICKER}>Orders</p>
          <h1 className={PAGE_TITLE}>Unrouted orders</h1>
          <p className={PAGE_SUB}>
            Confirmed orders that never reached a dark store. Re-route to retry automatic matching, or pick a store.
          </p>
        </div>
        <button type="button" className={BTN} onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {notice ? (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm ring-1 ${
            notice.tone === 'error' ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-emerald-50 text-emerald-800 ring-emerald-100'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className={`${PANEL} overflow-x-auto`}>
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/80">
            <tr>
              <th className={TH}>Order</th>
              <th className={TH}>Customer & address</th>
              <th className={TH}>Amount</th>
              <th className={TH}>Why it is stuck</th>
              <th className={TH}>Dark store</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className={`${TD} text-center text-slate-400`} colSpan={6}>Loading…</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td className={`${TD} text-center text-slate-500`} colSpan={6}>
                  Every live order has reached a dark store.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order._id} className="align-top">
                  <td className={TD}>
                    <div className="font-semibold text-slate-900">#{order.orderNumber}</div>
                    <div className="text-xs text-slate-500">{fmtDateTime(order.createdAt)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {order.itemsCount} items · {order.fulfillmentType === 'pickup' ? 'Pickup' : 'Delivery'}
                      {order.preOrderSlot ? ` · Pre-order ${order.preOrderSlot}` : ''}
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="font-medium">{order.user?.name || order.deliveryAddress?.fullName || 'Customer'}</div>
                    <div className="text-xs text-slate-500">{order.user?.phone || order.deliveryAddress?.number || ''}</div>
                    <div className="mt-1 max-w-xs text-xs text-slate-600">{addressLine(order.deliveryAddress)}</div>
                  </td>
                  <td className={TD}>
                    <div className="font-semibold">{money(order.total)}</div>
                    <div className="text-xs uppercase text-slate-500">
                      {order.paymentMethod} · {order.paymentStatus}
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex items-start gap-1.5 text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="text-xs font-medium">{order.routingError || 'Not routed yet'}</span>
                    </div>
                    {order.routingAttemptedAt ? (
                      <div className="mt-1 text-[11px] text-slate-400">Last try {fmtDateTime(order.routingAttemptedAt)}</div>
                    ) : null}
                  </td>
                  <td className={TD}>
                    <select
                      className={`${INPUT} min-w-[180px] py-1 text-xs`}
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
                  <td className={TD}>
                    <button
                      type="button"
                      className={BTN_PRIMARY}
                      disabled={busyId === order._id}
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
    </div>
  );
}
