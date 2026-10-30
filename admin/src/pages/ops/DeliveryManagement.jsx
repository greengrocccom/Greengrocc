import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, Truck } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { useLive } from '../../realtime/useLive';
import { BTN, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';

const STATUS_FILTERS = [
  'all',
  'order_received',
  'packed',
  'assigned',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

const STATUS_OPTIONS = [
  'incoming',
  'order_received',
  'stock_issue',
  'packed',
  'offered',
  'assigned',
  'pickup_verified',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

function pretty(value) {
  return String(value || '').replaceAll('_', ' ');
}

export default function DeliveryManagement() {
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [orderRes, riderRes] = await Promise.all([
        opsApi.list('delivery/orders', status === 'all' ? {} : { status }),
        opsApi.list('delivery/riders'),
      ]);
      setOrders(orderRes.data || []);
      setRiders(riderRes.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  useLive(load, [status]);

  const assign = async (orderId, riderId) => {
    if (!riderId) return;
    await opsApi.patch(`delivery/orders/${orderId}/assign`, { riderId });
    await load();
  };

  const updateStatus = async (orderId, nextStatus, previousStatus) => {
    if (nextStatus === previousStatus) return;
    const confirmComplete =
      nextStatus === 'delivered'
        ? 'Mark this delivery complete? The customer order will be completed even if the rider has not finished OTP or proof.'
        : nextStatus === 'cancelled'
          ? 'Cancel this order? The customer order will also be cancelled.'
          : '';
    let reason = '';
    if (nextStatus === 'delivered') {
      reason = (window.prompt(`${confirmComplete}\n\nReason (required):`) || '').trim();
      if (!reason) {
        await load();
        return;
      }
    } else if (confirmComplete && !window.confirm(confirmComplete)) {
      await load();
      return;
    }
    try {
      await opsApi.patch(`delivery/orders/${orderId}/status`, { status: nextStatus, reason });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update status');
      await load();
    }
  };

  const counts = useMemo(() => {
    return {
      total: orders.length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      active: orders.filter((o) =>
        ['assigned', 'out_for_delivery', 'packed', 'order_received'].includes(o.status)
      ).length,
    };
  }, [orders]);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={PAGE_KICKER}>Operations</p>
          <h1 className={PAGE_TITLE}>Delivery Management</h1>
          <p className={PAGE_SUB}>
            Assign riders and update dark-store status. Completing or cancelling also updates the
            customer order.
          </p>
          <Link to="/delivery-team" className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline">
            Open delivery team directory →
          </Link>
        </div>
        <button type="button" onClick={load} className={BTN}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Shown orders', value: counts.total },
          { label: 'In progress', value: counts.active },
          { label: 'Delivered', value: counts.delivered },
        ].map((item) => (
          <div key={item.label} className={`${PANEL} p-4`}>
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
              status === item
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {pretty(item)}
          </button>
        ))}
      </div>

      <div className={`${PANEL} overflow-hidden`}>
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Truck className="mx-auto h-10 w-10 text-emerald-600/30" />
            <p className="mt-3 text-sm font-semibold text-slate-800">No deliveries in this filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  {['Order', 'Customer', 'Store', 'Status', 'Assign rider'].map((h) => (
                    <th key={h} className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{order.orderNumber}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-slate-800">{order.customerName}</p>
                      <p className="text-xs text-slate-400">{order.customerPhone}</p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {order.managerId?.storeName || order.area || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order._id, e.target.value, order.status)}
                        className={`${INPUT} h-9 min-h-0 max-w-[180px] py-1 text-xs`}
                      >
                        {STATUS_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {pretty(item)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        defaultValue={order.assignedRiderId?._id || ''}
                        onChange={(e) => assign(order._id, e.target.value)}
                        className={`${INPUT} h-9 min-h-0 max-w-[200px] py-1 text-xs`}
                      >
                        <option value="">Select rider</option>
                        {riders.map((rider) => (
                          <option key={rider.id || rider._id} value={rider.id || rider._id}>
                            {rider.name || rider.phone} ({rider.status})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
