import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import inventoryApi from '../../api/inventoryApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';

const TYPE_META = {
  farmers: { label: 'Farmer', hubType: 'farmers', back: '/inventory?type=farmers' },
  vendors: { label: 'Vendor', hubType: 'vendors', back: '/inventory?type=vendors' },
  'dark-stores': { label: 'Dark store', hubType: 'dark-stores', back: '/inventory?type=dark-stores' },
};

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

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('out')) return 'rose';
  if (value.includes('low')) return 'amber';
  if (value.includes('in stock') || value.includes('active')) return 'green';
  return 'slate';
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function InventoryDetailPage() {
  const { type, id } = useParams();
  const meta = TYPE_META[type] || TYPE_META.farmers;
  const [entity, setEntity] = useState(null);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ stockCount: '', change: '', reason: '', price: '', lowStockThreshold: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    sku: '',
    name: '',
    category: 'General',
    unit: 'pcs',
    price: '',
    stockCount: '',
    lowStockThreshold: '10',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (type === 'farmers') {
        const res = await inventoryApi.getFarmer(id);
        setEntity(res.entity || null);
        setItems(res.data || []);
        setStats(res.stats || null);
      } else if (type === 'vendors') {
        const res = await inventoryApi.getVendor(id);
        setEntity(res.entity || null);
        setItems(res.data || []);
        setStats(res.stats || null);
      } else {
        const res = await inventoryApi.getDarkStore(id);
        const inventory = res.inventory || [];
        setEntity({
          type: 'dark-store',
          id: res.store?.id || id,
          name: res.store?.storeName || res.store?.name || 'Dark store',
          mobile: res.store?.phone || '',
          location: [res.store?.area, res.store?.city, res.store?.state].filter(Boolean).join(', '),
          status: res.store?.isActive === false ? 'Inactive' : 'Active',
        });
        setItems(
          inventory.map((row) => ({
            id: row.id,
            productId: row.sku,
            productName: row.name,
            category: row.category,
            grade: row.unit,
            unit: row.unit,
            currentStock: row.stockCount,
            price: row.price,
            lowStockLimit: row.lowStockThreshold,
            status: row.stockCount <= 0 ? 'Out of Stock' : row.isLowStock ? 'Low Stock' : 'In Stock',
            sku: row.sku,
            isActive: row.isActive,
          }))
        );
        setStats(res.stats || null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory');
      setEntity(null);
      setItems([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [type, id]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((row) => {
      if (filter === 'low' && row.status !== 'Low Stock') return false;
      if (filter === 'out' && Number(row.currentStock) > 0) return false;
      if (filter === 'in' && Number(row.currentStock) <= 0) return false;
      if (!needle) return true;
      return [row.productName, row.category, row.grade, row.sku, row.farmerName, row.productId]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [items, query, filter]);

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      stockCount: String(row.currentStock ?? ''),
      change: '',
      reason: '',
      price: row.price != null ? String(row.price) : '',
      lowStockThreshold: row.lowStockLimit != null ? String(row.lowStockLimit) : '',
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      if (type === 'dark-stores') {
        await inventoryApi.updateDarkStoreItem(id, editing.id, {
          stockCount: form.stockCount === '' ? undefined : Number(form.stockCount),
          price: form.price === '' ? undefined : Number(form.price),
          lowStockThreshold: form.lowStockThreshold === '' ? undefined : Number(form.lowStockThreshold),
        });
      } else if (type === 'farmers') {
        await inventoryApi.adjustFarmer(id, {
          productId: editing.productId,
          gradeId: editing.gradeId,
          grade: editing.grade,
          stockCount: Number(form.stockCount),
          reason: form.reason || 'Admin stock set',
        });
      } else {
        await inventoryApi.adjustVendor(id, {
          productId: editing.productId,
          farmerId: editing.farmerId,
          gradeId: editing.gradeId,
          grade: editing.grade,
          stockCount: Number(form.stockCount),
          reason: form.reason || 'Admin stock set',
        });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update inventory');
    } finally {
      setSaving(false);
    }
  };

  const quickAdjust = async (row, delta) => {
    setSaving(true);
    setError('');
    try {
      if (type === 'dark-stores') {
        await inventoryApi.adjustDarkStoreItem(id, row.id, { change: delta });
      } else if (type === 'farmers') {
        await inventoryApi.adjustFarmer(id, {
          productId: row.productId,
          gradeId: row.gradeId,
          grade: row.grade,
          change: delta,
          reason: delta > 0 ? 'Quick add' : 'Quick remove',
        });
      } else {
        await inventoryApi.adjustVendor(id, {
          productId: row.productId,
          farmerId: row.farmerId,
          gradeId: row.gradeId,
          grade: row.grade,
          change: delta,
          reason: delta > 0 ? 'Quick add' : 'Quick remove',
        });
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const createItem = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await inventoryApi.createDarkStoreItem(id, {
        sku: createForm.sku,
        name: createForm.name,
        category: createForm.category,
        unit: createForm.unit,
        price: Number(createForm.price) || 0,
        stockCount: Number(createForm.stockCount) || 0,
        lowStockThreshold: Number(createForm.lowStockThreshold) || 10,
      });
      setCreateOpen(false);
      setCreateForm({
        sku: '',
        name: '',
        category: 'General',
        unit: 'pcs',
        price: '',
        stockCount: '',
        lowStockThreshold: '10',
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create inventory item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Link to={meta.back} className={BTN}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to {meta.label.toLowerCase()}s
            </Link>
          </div>
          <p className={PAGE_KICKER}>Inventory · {meta.label}</p>
          <h1 className={PAGE_TITLE}>{entity?.name || 'Inventory details'}</h1>
          <p className={PAGE_SUB}>
            {[entity?.location, entity?.mobile, entity?.status].filter(Boolean).join(' · ') ||
              'View stock levels and update quantities.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {type === 'dark-stores' ? (
            <button type="button" className={BTN_PRIMARY} onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add SKU
            </button>
          ) : null}
          <button type="button" onClick={load} className={BTN}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'SKUs', value: stats?.skuCount ?? items.length },
          { label: 'In stock', value: stats?.inStockSkus ?? 0 },
          { label: 'Low stock', value: stats?.lowStockSkus ?? 0 },
          { label: 'Total units', value: stats?.totalUnits ?? 0 },
        ].map((card) => (
          <div key={card.label} className={`${PANEL} px-4 py-3`}>
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {Number(card.value || 0).toLocaleString('en-IN')}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${INPUT} pl-9`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, grades, or SKUs"
          />
        </div>
        {[
          { key: 'all', label: 'All' },
          { key: 'in', label: 'In stock' },
          { key: 'low', label: 'Low' },
          { key: 'out', label: 'Out' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === item.key
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={PANEL}>
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Package className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No inventory items</p>
            <p className="mt-1 text-xs text-slate-500">
              {type === 'dark-stores' ? 'Add a SKU to start tracking store stock.' : 'No products found for this profile.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F2F2F2]">
                <tr>
                  {['Product', type === 'vendors' ? 'Farmer' : 'Details', 'Stock', 'Status', ''].map((heading) => (
                    <th key={heading || 'actions'} className={TH}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{row.productName}</p>
                      <p className="text-[11px] text-slate-400">
                        {[row.category, row.sku || row.productId].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {type === 'vendors' ? (
                        <>
                          <p>{row.farmerName || row.farmerId || '—'}</p>
                          <p className="mt-0.5">{row.grade || row.unit || '—'}</p>
                        </>
                      ) : (
                        <>
                          <p>{row.grade || row.unit || '—'}</p>
                          {row.price != null ? <p className="mt-0.5">{money(row.price)}</p> : null}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-base font-bold tabular-nums text-slate-900">
                        {Number(row.currentStock || 0).toLocaleString('en-IN')}
                        <span className="ml-1 text-xs font-medium text-slate-400">{row.unit || ''}</span>
                      </p>
                      {row.lowStockLimit != null ? (
                        <p className="text-[11px] text-slate-400">Low at {row.lowStockLimit}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <Pill tone={statusTone(row.status)}>{row.status}</Pill>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          disabled={saving}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-[#217346]"
                          title="Decrease"
                          onClick={() => quickAdjust(row, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-[#217346]"
                          title="Increase"
                          onClick={() => quickAdjust(row, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-[#217346]"
                          title="Edit"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={saveEdit} className={`w-full max-w-md ${PANEL} p-5`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit stock</h2>
                <p className="text-xs text-slate-500">{editing.productName}</p>
              </div>
              <button type="button" className="rounded-lg p-1 text-slate-400" onClick={() => setEditing(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                Set stock quantity
                <input
                  required
                  type="number"
                  min="0"
                  className={`${INPUT} mt-1.5`}
                  value={form.stockCount}
                  onChange={(e) => setForm((prev) => ({ ...prev, stockCount: e.target.value }))}
                />
              </label>
              {type === 'dark-stores' ? (
                <>
                  <label className="block text-xs font-semibold text-slate-600">
                    Price
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${INPUT} mt-1.5`}
                      value={form.price}
                      onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Low-stock threshold
                    <input
                      type="number"
                      min="0"
                      className={`${INPUT} mt-1.5`}
                      value={form.lowStockThreshold}
                      onChange={(e) => setForm((prev) => ({ ...prev, lowStockThreshold: e.target.value }))}
                    />
                  </label>
                </>
              ) : (
                <label className="block text-xs font-semibold text-slate-600">
                  Reason
                  <input
                    className={`${INPUT} mt-1.5`}
                    value={form.reason}
                    onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Optional note"
                  />
                </label>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={createItem} className={`w-full max-w-md ${PANEL} p-5`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">Add dark store SKU</h2>
              <button type="button" className="rounded-lg p-1 text-slate-400" onClick={() => setCreateOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                ['sku', 'SKU', true],
                ['name', 'Name', true],
                ['category', 'Category', false],
                ['unit', 'Unit', false],
                ['price', 'Price', false],
                ['stockCount', 'Opening stock', false],
                ['lowStockThreshold', 'Low-stock threshold', false],
              ].map(([key, label, required]) => (
                <label key={key} className="block text-xs font-semibold text-slate-600">
                  {label}
                  <input
                    required={required}
                    type={['price', 'stockCount', 'lowStockThreshold'].includes(key) ? 'number' : 'text'}
                    min={['price', 'stockCount', 'lowStockThreshold'].includes(key) ? '0' : undefined}
                    className={`${INPUT} mt-1.5`}
                    value={createForm[key]}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN} onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Saving…' : 'Add SKU'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
