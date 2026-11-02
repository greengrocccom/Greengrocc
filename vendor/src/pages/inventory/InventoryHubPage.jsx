import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Store,
  Tractor,
  Warehouse,
} from 'lucide-react';
import inventoryApi from '../../api/inventoryApi';
import { BTN, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';

const TABS = [
  {
    key: 'farmers',
    label: 'Farmers',
    description: 'Farm stock by crop and grade',
    icon: Tractor,
  },
  {
    key: 'vendors',
    label: 'Vendors',
    description: 'Vendor network inventory',
    icon: Warehouse,
  },
  {
    key: 'dark-stores',
    label: 'Dark stores',
    description: 'Store SKUs ready for delivery',
    icon: Store,
  },
];

function Pill({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-[#217346]',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

function initials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function formatUnits(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

export default function InventoryHubPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((item) => item.key === params.get('type')) ? params.get('type') : 'farmers';
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'farmers') {
        const res = await inventoryApi.listFarmers({ search: query });
        setRows(res.data || []);
        setStats(res.stats || null);
      } else if (tab === 'vendors') {
        const res = await inventoryApi.listVendors({ search: query });
        setRows(res.data || []);
        setStats(res.stats || null);
      } else {
        const res = await inventoryApi.listDarkStores({ search: query });
        const stores = (res.stores || []).map((store) => ({
          id: store.id || store._id,
          name: store.storeName || store.name || 'Dark store',
          mobile: store.phone || '',
          location: [store.area, store.city, store.state].filter(Boolean).join(', '),
          status: store.isActive === false ? 'Inactive' : 'Active',
          skuCount: store.skuCount || 0,
          totalUnits: store.totalUnits || 0,
          lowStockSkus: store.lowStockSkus || 0,
          outOfStockSkus: 0,
          inStockSkus: store.inStockSkus || 0,
        }));
        setRows(stores);
        setStats({
          count: stores.length,
          withStock: stores.filter((row) => row.totalUnits > 0 || row.inStockSkus > 0).length,
          lowStock: stores.filter((row) => row.lowStockSkus > 0).length,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory directory');
      setRows([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [tab, query]);

  const filtered = useMemo(() => {
    if (tab !== 'dark-stores') return rows;
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.name, row.mobile, row.location, row.id].join(' ').toLowerCase().includes(needle)
    );
  }, [rows, query, tab]);

  const activeTab = TABS.find((item) => item.key === tab) || TABS[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={PAGE_KICKER}>Inventory</p>
          <h1 className={PAGE_TITLE}>Inventory hub</h1>
          <p className={PAGE_SUB}>
            Choose farmers, vendors, or dark stores, then open any profile to view and edit stock.
          </p>
        </div>
        <button type="button" onClick={load} className={BTN}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setParams({ type: item.key })}
              className={`${PANEL} p-4 text-left transition ${
                active ? 'ring-2 ring-emerald-700/30 bg-emerald-50/40' : 'hover:bg-slate-50'
              }`}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#217346]">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 font-semibold text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${PANEL} px-4 py-3`}>
          <p className="text-xs text-slate-500">{activeTab.label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.count ?? filtered.length}</p>
        </div>
        <div className={`${PANEL} px-4 py-3`}>
          <p className="text-xs text-slate-500">With stock</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.withStock ?? 0}</p>
        </div>
        <div className={`${PANEL} px-4 py-3`}>
          <p className="text-xs text-slate-500">Low stock alerts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.lowStock ?? 0}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${INPUT} pl-9`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${activeTab.label.toLowerCase()}`}
          />
        </div>
      </div>

      <div className={PANEL}>
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Package className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No {activeTab.label.toLowerCase()} found</p>
            <p className="mt-1 text-xs text-slate-500">Try another search or refresh the list.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((row, index) => {
              const rowKey = row.id || row._id || `inv-row-${index}`;
              const targetId = row.id || row._id || '';
              return (
                <Link
                  key={rowKey}
                  to={`/inventory/${tab}/${encodeURIComponent(targetId)}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-[#217346]">
                  {initials(row.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">{row.name}</p>
                    <Pill tone={String(row.status).toLowerCase().includes('active') ? 'green' : 'slate'}>
                      {row.status || '—'}
                    </Pill>
                    {row.lowStockSkus > 0 ? <Pill tone="amber">{row.lowStockSkus} low</Pill> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[row.location, row.mobile].filter(Boolean).join(' · ') || row.id}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatUnits(row.skuCount)} SKUs
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {`${formatUnits(row.totalUnits)} units`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
