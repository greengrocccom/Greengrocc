import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bike, ChevronRight, Loader2, Search, Store } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';

function initials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-[#217346]',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.slate}`}>{children || '—'}</span>;
}

function liveTone(status) {
  if (status === 'online') return 'green';
  if (status === 'on_delivery') return 'blue';
  if (status === 'rejected' || status === 'offline') return 'rose';
  if (status === 'pending') return 'amber';
  if (status === 'approved') return 'green';
  return 'slate';
}

function pretty(value) {
  return String(value || '—').replaceAll('_', ' ');
}

export default function DeliveryTeamPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'riders' ? 'riders' : 'stores';
  const filter = params.get('filter') || 'all';
  const [managers, setManagers] = useState([]);
  const [boys, setBoys] = useState([]);
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState(params.get('q') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const setView = (nextView, nextFilter = 'all') => {
    const next = new URLSearchParams(params);
    next.set('view', nextView);
    if (nextFilter === 'all') next.delete('filter');
    else next.set('filter', nextFilter);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let alive = true;
    opsApi
      .list('delivery/team')
      .then((res) => {
        if (!alive) return;
        setManagers(res.data?.managers || []);
        setBoys(res.data?.boys || []);
        setStats(res.stats || null);
      })
      .catch((err) => alive && setError(err.response?.data?.message || 'Failed to load delivery team'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const needle = q.trim().toLowerCase();
  const stores = useMemo(
    () =>
      managers.filter((m) => {
        if (filter === 'inactive' && m.isActive) return false;
        if (filter === 'active' && !m.isActive) return false;
        if (!needle) return true;
        return [m.name, m.phone, m.email, m.storeName, m.area, m.city].join(' ').toLowerCase().includes(needle);
      }),
    [managers, needle, filter]
  );
  const riders = useMemo(
    () =>
      boys.filter((b) => {
        if (filter === 'online' && b.status !== 'online') return false;
        if (filter === 'on_delivery' && b.status !== 'on_delivery') return false;
        if (filter === 'kyc' && b.verificationStatus !== 'pending') return false;
        if (filter === 'unassigned' && b.manager?.id) return false;
        if (!needle) return true;
        return [b.name, b.phone, b.area, b.city, b.vehicleType, b.manager?.name, b.manager?.storeName].join(' ').toLowerCase().includes(needle);
      }),
    [boys, needle, filter]
  );

  const cards = [
    { label: 'Stores', value: stats?.managers ?? managers.length, view: 'stores', filter: 'all' },
    { label: 'Riders', value: stats?.boys ?? boys.length, view: 'riders', filter: 'all' },
    { label: 'Online now', value: stats?.online ?? 0, view: 'riders', filter: 'online' },
    { label: 'On delivery', value: stats?.onDelivery ?? 0, view: 'riders', filter: 'on_delivery' },
    { label: 'KYC pending', value: stats?.pendingVerification ?? 0, view: 'riders', filter: 'kyc' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={PAGE_KICKER}>Delivery operations</p>
          <h1 className={PAGE_TITLE}>Delivery team</h1>
          <p className={PAGE_SUB}>Open a store to see its riders, or open a rider for live status, KYC, and orders.</p>
        </div>
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={view === 'stores' ? 'Search store, manager, area' : 'Search rider, phone, store'}
            className={`${INPUT} pl-9`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => {
          const selected = view === card.view && filter === card.filter;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => setView(card.view, card.filter)}
              className={`${PANEL} px-4 py-3 text-left transition hover:bg-slate-50 ${
                selected ? 'border-emerald-200 ring-2 ring-emerald-700/20' : ''
              }`}
            >
              <p className="text-xs text-[#6B7280]">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold ${selected ? 'text-[#217346]' : 'text-[#1F2937]'}`}>{card.value}</p>
            </button>
          );
        })}
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div> : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {[
            { id: 'stores', label: 'Stores', icon: Store },
            { id: 'riders', label: 'Riders', icon: Bike },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id, tab.id === view ? filter : 'all')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                view === tab.id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        {view === 'stores' ? (
          <select value={filter === 'online' || filter === 'on_delivery' || filter === 'kyc' || filter === 'unassigned' ? 'all' : filter} onChange={(e) => setView('stores', e.target.value)} className={`${INPUT} max-w-[150px]`}>
            <option value="all">All stores</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        ) : (
          <select value={['online', 'on_delivery', 'kyc', 'unassigned', 'all'].includes(filter) ? filter : 'all'} onChange={(e) => setView('riders', e.target.value)} className={`${INPUT} max-w-[170px]`}>
            <option value="all">All riders</option>
            <option value="online">Online</option>
            <option value="on_delivery">On delivery</option>
            <option value="kyc">KYC pending</option>
            <option value="unassigned">Unassigned</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className={`${PANEL} flex justify-center py-16 text-slate-400`}>
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : view === 'stores' ? (
        <div className={PANEL}>
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead className="bg-[#F2F2F2]">
                <tr>
                  {['Store', 'Manager', 'Location', 'Riders', 'Orders', 'Status', ''].map((h) => (
                    <th key={h || 'a'} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-[#F9F9F9]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#217346]">
                          <Store className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <Link to={`/delivery-team/managers/${m.id}`} className="block truncate font-semibold text-[#217346] hover:underline">
                            {m.storeName || m.name}
                          </Link>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span>{m.deliveryRadiusKm || 0} km radius</span>
                            {m.vendorId ? (
                              <>
                                <span>·</span>
                                <Link to={`/multi-vendor/${m.vendorId}`} className="font-medium text-emerald-700 hover:underline">
                                  Vendor
                                </Link>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-800">{m.name}</p>
                      <p className="text-xs text-slate-400">{m.phone || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{[m.area, m.city].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-3 py-2.5 tabular-nums">{m.riderCount || 0}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {m.deliveredCount || 0} delivered
                      <p className="text-slate-400">{m.orderCount || 0} total</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={m.isActive ? 'green' : 'slate'}>{m.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link to={`/delivery-team/managers/${m.id}`} className="inline-flex items-center text-xs font-semibold text-[#217346] hover:underline">
                        Open <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!stores.length ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-sm text-slate-400">No stores match this view</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={PANEL}>
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-[#F2F2F2]">
                <tr>
                  {['Rider', 'Store', 'Live', 'KYC', 'Work', ''].map((h) => (
                    <th key={h || 'a'} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riders.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0 hover:bg-[#F9F9F9]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-[#217346]">
                          {initials(b.name)}
                        </span>
                        <div className="min-w-0">
                          <Link to={`/delivery-team/boys/${b.id}`} className="block truncate font-semibold text-[#217346] hover:underline">
                            {b.name}
                          </Link>
                          <p className="text-[11px] text-slate-400">{b.phone} · {pretty(b.vehicleType)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {b.manager?.id ? (
                        <Link to={`/delivery-team/managers/${b.manager.id}`} className="font-medium text-slate-800 hover:text-[#217346] hover:underline">
                          {b.manager.storeName || b.manager.name}
                        </Link>
                      ) : (
                        <span className="text-amber-700">Unassigned</span>
                      )}
                      <p className="text-slate-400">{[b.area, b.city].filter(Boolean).join(', ') || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={liveTone(b.status)}>{pretty(b.status)}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={liveTone(b.verificationStatus)}>{pretty(b.verificationStatus)}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {b.deliveredCount || 0} delivered
                      <p className="text-slate-400">{money(b.totalLifetimeEarnings)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link to={`/delivery-team/boys/${b.id}`} className="inline-flex items-center text-xs font-semibold text-[#217346] hover:underline">
                        Open <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!riders.length ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-12 text-center text-sm text-slate-400">No riders match this view</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
