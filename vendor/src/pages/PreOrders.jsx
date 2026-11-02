import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Search, Settings2 } from 'lucide-react';
import apiClient from '../api/client';
import { useLive } from '../realtime/useLive';
import { INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TD, TH } from '../utils/ui';

const istDate = (offsetDays) =>
  new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const fmtDay = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) : '—';
const fmtDateTime = (v) =>
  v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtClock = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return String(t || '').trim();
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};
/** "13:02 - 17:01" → "1:02 PM – 5:01 PM" */
const fmtSlot = (label) => {
  const parts = String(label || '').split(/\s+-\s+/);
  return parts.length === 2 ? `${fmtClock(parts[0])} – ${fmtClock(parts[1])}` : String(label || '');
};

const CLOSED_PROGRESS = new Set(['cancelled', 'rejected', 'failed']);

const STATUS_TABS = [
  { key: 'all', label: 'All', match: null },
  { key: 'awaiting', label: 'Awaiting vendor', match: ['awaiting_vendor'] },
  { key: 'confirmed', label: 'Confirmed', match: ['confirmed'] },
  { key: 'packed', label: 'Packed', match: ['preparing'] },
  { key: 'to_store', label: 'Shipped', match: ['dispatched'] },
  { key: 'at_store', label: 'At dark store', match: ['at_store'] },
  { key: 'delivering', label: 'Out for delivery', match: ['rider_assigned', 'out_for_delivery'] },
  { key: 'delivered', label: 'Delivered', match: ['delivered'] },
  { key: 'closed', label: 'Cancelled / rejected', match: ['cancelled', 'rejected', 'failed'] },
];

const PROGRESS_OPTIONS = [
  { key: 'awaiting_vendor', label: 'Awaiting vendor' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Packed' },
  { key: 'dispatched', label: 'Shipped' },
  { key: 'at_store', label: 'At dark store' },
  { key: 'rider_assigned', label: 'Rider assigned' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];
const LOCKED_PROGRESS = new Set(['delivered', 'cancelled', 'rejected', 'failed']);

function ProgressControl({ order, busy, onChange }) {
  if (LOCKED_PROGRESS.has(order.preOrderProgress)) {
    return <div className="text-xs font-medium text-slate-800">{order.preOrderProgressLabel || order.status}</div>;
  }
  return (
    <select
      className={`${INPUT} w-auto min-w-[150px] py-1 text-xs`}
      value={order.preOrderProgress || ''}
      disabled={busy}
      onChange={(e) => onChange(order, e.target.value)}
    >
      {!PROGRESS_OPTIONS.some((p) => p.key === order.preOrderProgress) ? (
        <option value={order.preOrderProgress || ''}>{order.preOrderProgressLabel || order.status}</option>
      ) : null}
      {PROGRESS_OPTIONS.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

const VENDOR_TONE = {
  confirmed: 'border-emerald-200 text-emerald-700',
  rejected: 'border-red-200 text-red-700',
  pending: 'border-amber-200 text-amber-700',
};

function SlotBoard({ date, slots, orders, activeSlot, onPick }) {
  const rows = useMemo(() => {
    const byLabel = new Map(
      slots.map((s) => [s.label, { ...s, awaiting: 0, confirmed: 0, closed: 0 }]),
    );
    for (const o of orders) {
      if (!byLabel.has(o.preOrderSlot)) {
        byLabel.set(o.preOrderSlot, {
          label: o.preOrderSlot,
          capacity: 0,
          booked: 0,
          remaining: null,
          isActive: false,
          removed: true,
          awaiting: 0,
          confirmed: 0,
          closed: 0,
        });
      }
      const row = byLabel.get(o.preOrderSlot);
      if (CLOSED_PROGRESS.has(o.preOrderProgress)) row.closed += 1;
      else if (o.preOrderProgress === 'awaiting_vendor') row.awaiting += 1;
      else row.confirmed += 1;
    }
    return [...byLabel.values()];
  }, [slots, orders]);

  return (
    <div className={`${PANEL} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Slot availability · {fmtDay(date)}</h2>
        <Link
          to="/pre-order-slots"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <Settings2 size={13} /> Manage slots
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No pre-order slots are configured.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map((row) => {
            const active = activeSlot === row.label;
            const fill = row.capacity > 0 ? Math.min(100, (row.booked / row.capacity) * 100) : 0;
            return (
              <button
                key={row.label}
                type="button"
                onClick={() => onPick(active ? '' : row.label)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{fmtSlot(row.label)}</span>
                  {row.removed ? (
                    <span className="rounded border border-slate-200 px-1.5 text-[10px] font-semibold text-slate-500">REMOVED</span>
                  ) : !row.isActive ? (
                    <span className="rounded border border-slate-200 px-1.5 text-[10px] font-semibold text-slate-500">INACTIVE</span>
                  ) : row.isFull ? (
                    <span className="rounded border border-red-200 px-1.5 text-[10px] font-semibold text-red-600">FULL</span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-900">{row.booked}</span>
                  <span className="text-xs text-slate-500">
                    {row.capacity > 0 ? `/ ${row.capacity} booked` : 'booked · no limit'}
                  </span>
                </div>
                {row.capacity > 0 ? (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-100">
                      <div className={`h-full ${row.isFull ? 'bg-red-500' : 'bg-emerald-600'}`} style={{ width: `${fill}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">{row.remaining ?? 0} seats left</div>
                  </>
                ) : null}
                <div className="mt-2 text-[11px] text-slate-500">
                  {row.awaiting} awaiting vendor · {row.confirmed} confirmed · {row.closed} cancelled
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PreOrders() {
  const [when, setWhen] = useState('tomorrow');
  const [customDate, setCustomDate] = useState('');
  const [slot, setSlot] = useState('');
  const [zone, setZone] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  const [orders, setOrders] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  const changeProgress = async (order, progress) => {
    if (!progress || progress === order.preOrderProgress) return;
    const label = PROGRESS_OPTIONS.find((p) => p.key === progress)?.label || progress;
    let reason = '';
    if (progress === 'cancelled' || progress === 'delivered') {
      const verb = progress === 'cancelled' ? 'cancelling' : 'marking delivered';
      reason = window.prompt(`Reason for ${verb} #${order.orderNumber}?`)?.trim() || '';
      if (!reason) return;
    } else if (!window.confirm(`Move #${order.orderNumber} to "${label}"?`)) {
      return;
    }

    setBusyId(order.id);
    setError('');
    setNotice('');
    try {
      const { data } = await apiClient.patch(`/staff/preorders/${order.id}/admin-progress`, { progress, reason });
      if (data?.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...data.order } : o)));
      }
      setNotice(data?.message || 'Status updated');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setBusyId('');
    }
  };

  const date = when === 'today' ? istDate(0) : when === 'date' && customDate ? customDate : istDate(1);

  useLive(
    async ({ silent }) => {
      if (!silent) setLoading(true);
      try {
        const [ordersRes, slotsRes] = await Promise.all([
          apiClient.get('/staff/preorders', { params: { date } }),
          apiClient.get('/settings/preorder-slots/admin', { params: { date } }),
        ]);
        setOrders(ordersRes.data?.orders || []);
        setSlots(slotsRes.data?.data?.slots || []);
        setError('');
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load pre-orders');
      } finally {
        setLoading(false);
      }
    },
    [date],
  );

  const zones = useMemo(
    () => [...new Set(orders.map((o) => o.store?.zone).filter(Boolean))].sort(),
    [orders],
  );
  const slotOptions = useMemo(
    () => [...new Set([...slots.map((s) => s.label), ...orders.map((o) => o.preOrderSlot)].filter(Boolean))].sort(),
    [slots, orders],
  );

  const zoneScoped = useMemo(
    () => (zone ? orders.filter((o) => o.store?.zone === zone) : orders),
    [orders, zone],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return zoneScoped.filter((o) => {
      if (slot && o.preOrderSlot !== slot) return false;
      if (!q) return true;
      return [o.orderNumber, o.customerName, o.customerPhone, o.store?.storeName, ...(o.items || []).map((i) => i.name)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [zoneScoped, slot, query]);

  const counts = useMemo(() => {
    const c = {};
    for (const t of STATUS_TABS) {
      c[t.key] = t.match ? filtered.filter((o) => t.match.includes(o.preOrderProgress)).length : filtered.length;
    }
    return c;
  }, [filtered]);

  const activeTab = STATUS_TABS.find((t) => t.key === tab) || STATUS_TABS[0];
  const visible = activeTab.match ? filtered.filter((o) => activeTab.match.includes(o.preOrderProgress)) : filtered;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <div className={PAGE_KICKER}>Orders</div>
        <h1 className={PAGE_TITLE}>Pre-orders</h1>
        <p className={PAGE_SUB}>
          Next-day slot orders across every dark store: slot bookings against capacity, vendor confirmation and delivery
          progress.
        </p>
      </div>

      <div className={`${PANEL} flex flex-wrap items-center gap-2 p-4`}>
        {[
          ['today', 'Today'],
          ['tomorrow', 'Tomorrow'],
          ['date', 'Pick date'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setWhen(key)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
              when === key ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
        {when === 'date' ? (
          <input type="date" className={`${INPUT} w-auto py-1.5`} value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
        ) : null}
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <CalendarClock size={13} /> {fmtDay(date)}
        </span>
        <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
          <select className={`${INPUT} w-auto py-1.5`} value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <select className={`${INPUT} w-auto py-1.5`} value={slot} onChange={(e) => setSlot(e.target.value)}>
            <option value="">All slots</option>
            {slotOptions.map((s) => (
              <option key={s} value={s}>
                {fmtSlot(s)}
              </option>
            ))}
          </select>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${INPUT} py-1.5 pl-8`}
              placeholder="Order, customer, phone, store, item"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div>
      ) : null}

      <SlotBoard date={date} slots={slots} orders={zoneScoped} activeSlot={slot} onPick={setSlot} />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab.key === t.key ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className={`${PANEL} overflow-x-auto`}>
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Loading pre-orders…</p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No pre-orders for this day and filter.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className={TH}>Order</th>
                <th className={TH}>Customer</th>
                <th className={TH}>Dark store</th>
                <th className={TH}>Delivery slot</th>
                <th className={TH}>Items</th>
                <th className={TH}>Amount</th>
                <th className={TH}>Vendor</th>
                <th className={TH}>Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((o) => {
                const units = (o.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
                return (
                  <tr key={o.id} className="align-top">
                    <td className={TD}>
                      <div className="font-semibold text-slate-900">#{o.orderNumber}</div>
                      <div className="text-[11px] text-slate-500">{fmtDateTime(o.createdAt)}</div>
                    </td>
                    <td className={TD}>
                      <div className="font-medium text-slate-800">{o.customerName || '—'}</div>
                      <div className="text-xs text-slate-500">{o.customerPhone || ''}</div>
                    </td>
                    <td className={TD}>
                      <div className="font-medium text-slate-800">{o.store?.storeName || '—'}</div>
                      <div className="text-xs text-slate-500">
                        {[o.store?.city, o.store?.zone].filter(Boolean).join(', ')}
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="font-medium text-slate-800">{fmtSlot(o.preOrderSlot) || '—'}</div>
                      <div className="text-xs text-slate-500">{fmtDay(o.preOrderDate)}</div>
                    </td>
                    <td className={TD}>
                      <div className="max-w-[240px] text-xs text-slate-700">
                        {(o.items || [])
                          .slice(0, 3)
                          .map((i) => `${i.name} × ${i.quantity}`)
                          .join(', ')}
                        {(o.items || []).length > 3 ? ` +${o.items.length - 3} more` : ''}
                      </div>
                      <div className="text-[11px] text-slate-400">{units} units</div>
                    </td>
                    <td className={TD}>
                      <div className="font-semibold text-slate-900">{money(o.orderTotal)}</div>
                      <div className="text-xs text-slate-500">{o.paymentMethod || ''}</div>
                    </td>
                    <td className={TD}>
                      <span
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-semibold capitalize ${
                          VENDOR_TONE[o.vendorStatus] || VENDOR_TONE.pending
                        }`}
                      >
                        {o.vendorStatus || 'pending'}
                      </span>
                      {o.vendorActionByName ? (
                        <div className="mt-0.5 text-[11px] text-slate-500">by {o.vendorActionByName}</div>
                      ) : null}
                      {o.vendorRejectReason ? (
                        <div className="mt-0.5 max-w-[180px] text-[11px] text-red-600">{o.vendorRejectReason}</div>
                      ) : null}
                    </td>
                    <td className={TD}>
                      <ProgressControl order={o} busy={busyId === o.id} onChange={changeProgress} />
                      {o.assignedRider ? (
                        <div className="text-[11px] text-slate-500">Rider: {o.assignedRider.name}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
