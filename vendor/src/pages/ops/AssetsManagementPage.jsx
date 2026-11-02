import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bike,
  Boxes,
  Building2,
  ChevronRight,
  Loader2,
  MapPinned,
  Plus,
  Search,
  Store,
  Trash2,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';

const ROLES = [
  {
    key: 'delivery_manager',
    title: 'Delivery manager',
    description: 'Assets issued to the dark store manager.',
    icon: UserCog,
  },
  {
    key: 'delivery_boy',
    title: 'Delivery boy',
    description: 'Bikes, bags, phones, and gear for riders.',
    icon: Bike,
  },
  {
    key: 'customer',
    title: 'Customer',
    description: 'Assets linked to customers of this store.',
    icon: Users,
  },
  {
    key: 'admin',
    title: 'Admin',
    description: 'Assets created for admin / ops staff.',
    icon: UserRound,
  },
];

const ASSET_TYPES = [
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'phone', label: 'Phone' },
  { value: 'uniform', label: 'Uniform' },
  { value: 'bag', label: 'Bag' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'helmet', label: 'Helmet' },
  { value: 'id_card', label: 'ID card' },
  { value: 'other', label: 'Other' },
];

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
];

const STATUSES = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'returned', label: 'Returned' },
  { value: 'lost', label: 'Lost' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'under_repair', label: 'Under repair' },
];

function roleLabel(key) {
  return ROLES.find((r) => r.key === key)?.title || key;
}

function pretty(value) {
  return String(value || '—').replaceAll('_', ' ');
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Breadcrumb({ items }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-300" /> : null}
            {item.to && !isLast ? (
              <Link to={item.to} className="font-medium text-slate-600 transition hover:text-emerald-700">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-semibold text-slate-800' : ''}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className={`${PANEL} flex items-center gap-3 px-4 py-3`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#217346]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className={`${PANEL} px-6 py-14 text-center`}>
      <p className="text-base font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

const emptyForm = {
  assigneeRefId: '',
  assigneeName: '',
  assigneePhone: '',
  assetName: '',
  assetType: 'vehicle',
  assetCode: '',
  serialNumber: '',
  quantity: '1',
  condition: 'good',
  status: 'assigned',
  assignedAt: new Date().toISOString().slice(0, 10),
  notes: '',
};

/** Step 1 — Zones */
export function AssetsZonesPage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    opsApi
      .list('assets-management/zones')
      .then((res) => alive && setZones(res.data || []))
      .catch((err) => alive && setError(err.response?.data?.message || 'Failed to load zones'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return zones;
    return zones.filter((z) => [z.name, z.city, z.cityId].join(' ').toLowerCase().includes(needle));
  }, [zones, q]);

  return (
    <div className="space-y-5">
      <div>
        <p className={PAGE_KICKER}>Operations</p>
        <h1 className={PAGE_TITLE}>Assets management</h1>
        <p className={PAGE_SUB}>Select a zone, then a dark store, then a role to assign assets.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Zones" value={zones.length} icon={MapPinned} />
        <StatCard
          label="Dark stores"
          value={zones.reduce((s, z) => s + (z.storeCount || 0), 0)}
          icon={Store}
        />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${INPUT} pl-9`}
          placeholder="Search zone (Mumbai, Pune…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading zones…
        </div>
      ) : error ? (
        <EmptyState title="Could not load zones" subtitle={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No zones found" subtitle="Add dark stores with a city first." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((zone) => (
            <Link
              key={zone.zoneKey}
              to={`/assets-management/zones/${encodeURIComponent(zone.zoneKey)}`}
              className={`${PANEL} group flex items-center gap-4 p-4 transition hover:border-emerald-300 hover:shadow-md`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-slate-900">{zone.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {zone.storeCount} store{zone.storeCount === 1 ? '' : 's'}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-600" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Step 2 — Dark stores */
export function AssetsStoresPage() {
  const { zoneKey } = useParams();
  const decodedZone = decodeURIComponent(zoneKey || '');
  const [stores, setStores] = useState([]);
  const [zone, setZone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    opsApi
      .list(`assets-management/zones/${encodeURIComponent(decodedZone)}/stores`)
      .then((res) => {
        if (!alive) return;
        setStores(res.data || []);
        setZone(res.zone || { name: decodedZone, zoneKey: decodedZone });
      })
      .catch((err) => alive && setError(err.response?.data?.message || 'Failed to load stores'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [decodedZone]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stores;
    return stores.filter((s) =>
      [s.storeName, s.name, s.area, s.phone].join(' ').toLowerCase().includes(needle)
    );
  }, [stores, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: 'Assets management', to: '/assets-management' },
              { label: zone?.name || decodedZone },
            ]}
          />
          <h1 className={PAGE_TITLE}>Dark stores</h1>
          <p className={PAGE_SUB}>Choose a store in {zone?.name || decodedZone} to manage assets.</p>
        </div>
        <Link to="/assets-management" className={BTN}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Zones
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${INPUT} pl-9`}
          placeholder="Search store or area…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading stores…
        </div>
      ) : error ? (
        <EmptyState title="Could not load stores" subtitle={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No stores in this zone" subtitle="Try another zone." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((store) => (
            <Link
              key={store.id}
              to={`/assets-management/zones/${encodeURIComponent(decodedZone)}/stores/${store.id}`}
              className={`${PANEL} group flex items-center gap-4 p-4 transition hover:border-emerald-300 hover:shadow-md`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#217346]">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-slate-900">{store.storeName}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {store.area || '—'}
                  {store.assetCount ? ` · ${store.assetCount} assets` : ''}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-600" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Step 3 — Role selection */
export function AssetsRolesPage() {
  const { zoneKey, storeId } = useParams();
  const decodedZone = decodeURIComponent(zoneKey || '');
  const [store, setStore] = useState(null);

  useEffect(() => {
    opsApi
      .list(`assets-management/stores/${storeId}/people`, { role: 'delivery_manager' })
      .then((res) => setStore(res.store || null))
      .catch(() => setStore(null));
  }, [storeId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: 'Assets management', to: '/assets-management' },
              {
                label: store?.city || decodedZone,
                to: `/assets-management/zones/${encodeURIComponent(decodedZone)}`,
              },
              { label: store?.storeName || 'Store' },
            ]}
          />
          <h1 className={PAGE_TITLE}>Select role</h1>
          <p className={PAGE_SUB}>
            Who should receive assets at {store?.storeName || 'this dark store'}?
          </p>
        </div>
        <Link
          to={`/assets-management/zones/${encodeURIComponent(decodedZone)}`}
          className={BTN}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Stores
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <Link
              key={role.key}
              to={`/assets-management/zones/${encodeURIComponent(decodedZone)}/stores/${storeId}/roles/${role.key}`}
              className={`${PANEL} group flex flex-col gap-4 p-5 transition hover:border-emerald-300 hover:shadow-md`}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#217346]">
                  <Icon className="h-6 w-6" />
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{role.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{role.description}</p>
              </div>
              <span className="text-sm font-semibold text-[#217346]">Manage assets →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Step 4 — List + create assets for role */
export function AssetsListPage() {
  const { zoneKey, storeId, role } = useParams();
  const decodedZone = decodeURIComponent(zoneKey || '');
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [assets, setAssets] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [assetsRes, peopleRes] = await Promise.all([
        opsApi.list(`assets-management/stores/${storeId}/assets`, {
          role,
          search: q.trim() || undefined,
        }),
        opsApi.list(`assets-management/stores/${storeId}/people`, { role }),
      ]);
      setAssets(assetsRes.data || []);
      setStore(assetsRes.store || peopleRes.store || null);
      setPeople(peopleRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, role]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const pickPerson = (personId) => {
    const person = people.find((p) => String(p.id) === String(personId));
    if (!person) {
      setField('assigneeRefId', '');
      return;
    }
    setForm((prev) => ({
      ...prev,
      assigneeRefId: person.id,
      assigneeName: person.name || prev.assigneeName,
      assigneePhone: person.phone || prev.assigneePhone,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await opsApi.create(`assets-management/stores/${storeId}/assets`, {
        role,
        zoneKey: decodedZone,
        assigneeRefId: form.assigneeRefId,
        assigneeName: form.assigneeName.trim(),
        assigneePhone: form.assigneePhone.trim(),
        assetName: form.assetName.trim(),
        assetType: form.assetType,
        assetCode: form.assetCode.trim(),
        serialNumber: form.serialNumber.trim(),
        quantity: Number(form.quantity) || 1,
        condition: form.condition,
        status: form.status,
        assignedAt: form.assignedAt || undefined,
        notes: form.notes.trim(),
      });
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save asset');
    } finally {
      setSaving(false);
    }
  };

  const removeAsset = async (id) => {
    if (!window.confirm('Delete this asset record?')) return;
    try {
      await opsApi.remove('assets-management/assets', id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete asset');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: 'Assets management', to: '/assets-management' },
              {
                label: store?.city || decodedZone,
                to: `/assets-management/zones/${encodeURIComponent(decodedZone)}`,
              },
              {
                label: store?.storeName || 'Store',
                to: `/assets-management/zones/${encodeURIComponent(decodedZone)}/stores/${storeId}`,
              },
              { label: roleLabel(role) },
            ]}
          />
          <h1 className={PAGE_TITLE}>{roleLabel(role)} assets</h1>
          <p className={PAGE_SUB}>
            Assign and track assets for {roleLabel(role).toLowerCase()}s at{' '}
            {store?.storeName || 'this store'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN}
            onClick={() =>
              navigate(`/assets-management/zones/${encodeURIComponent(decodedZone)}/stores/${storeId}`)
            }
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Roles
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {showForm ? 'Hide form' : 'Add asset'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Assets" value={assets.length} icon={Boxes} />
        <StatCard label="People suggestions" value={people.length} icon={Users} />
        <StatCard label="Store area" value={store?.area || '—'} icon={MapPinned} />
      </div>

      {showForm ? (
        <form onSubmit={submit} className={`${PANEL} space-y-4 p-4 sm:p-5`}>
          <div>
            <h2 className="text-base font-bold text-slate-900">Add asset</h2>
            <p className="text-sm text-slate-500">Fill required fields to assign an asset to this role.</p>
          </div>

          {people.length > 0 ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Pick person (optional)
              </label>
              <select
                className={INPUT}
                value={form.assigneeRefId}
                onChange={(e) => pickPerson(e.target.value)}
              >
                <option value="">Type name & phone manually</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.phone ? `· ${p.phone}` : ''} {p.label ? `(${p.label})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                className={INPUT}
                required
                value={form.assigneeName}
                onChange={(e) => setField('assigneeName', e.target.value)}
                placeholder="Person name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Phone <span className="text-rose-500">*</span>
              </label>
              <input
                className={INPUT}
                required
                inputMode="numeric"
                maxLength={10}
                value={form.assigneePhone}
                onChange={(e) => setField('assigneePhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Asset name <span className="text-rose-500">*</span>
              </label>
              <input
                className={INPUT}
                required
                value={form.assetName}
                onChange={(e) => setField('assetName', e.target.value)}
                placeholder="e.g. Electric scooter, Delivery bag"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Asset type <span className="text-rose-500">*</span>
              </label>
              <select
                className={INPUT}
                required
                value={form.assetType}
                onChange={(e) => setField('assetType', e.target.value)}
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Asset code / ID</label>
              <input
                className={INPUT}
                value={form.assetCode}
                onChange={(e) => setField('assetCode', e.target.value)}
                placeholder="GG-BIKE-001"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Serial number</label>
              <input
                className={INPUT}
                value={form.serialNumber}
                onChange={(e) => setField('serialNumber', e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Quantity</label>
              <input
                type="number"
                min="1"
                className={INPUT}
                value={form.quantity}
                onChange={(e) => setField('quantity', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Assigned date</label>
              <input
                type="date"
                className={INPUT}
                value={form.assignedAt}
                onChange={(e) => setField('assignedAt', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Condition</label>
              <select
                className={INPUT}
                value={form.condition}
                onChange={(e) => setField('condition', e.target.value)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
              <select
                className={INPUT}
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Notes</label>
              <textarea
                className={`${INPUT} min-h-[80px]`}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Any extra details…"
              />
            </div>
          </div>

          {formError ? <p className="text-sm font-medium text-rose-600">{formError}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className={BTN_PRIMARY} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Save asset
            </button>
            <button
              type="button"
              className={BTN}
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
                setFormError('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${INPUT} pl-9`}
            placeholder="Search name, phone, asset…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <button type="button" className={BTN} onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading assets…
        </div>
      ) : error ? (
        <EmptyState title="Could not load assets" subtitle={error} />
      ) : assets.length === 0 ? (
        <EmptyState
          title="No assets yet"
          subtitle="Click Add asset to assign the first item for this role."
        />
      ) : (
        <div className={`${PANEL} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  <th className={TH}>Person</th>
                  <th className={TH}>Phone</th>
                  <th className={TH}>Asset</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Qty</th>
                  <th className={TH}>Condition</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Assigned</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {assets.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{row.assigneeName}</p>
                      {row.assetCode ? <p className="text-xs text-slate-500">{row.assetCode}</p> : null}
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-slate-800">{row.assigneePhone}</td>
                    <td className="px-3 py-3 text-sm text-slate-800">
                      <p className="font-medium">{row.assetName}</p>
                      {row.serialNumber ? (
                        <p className="text-xs text-slate-500">S/N {row.serialNumber}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-sm capitalize text-slate-700">{pretty(row.assetType)}</td>
                    <td className="px-3 py-3 text-sm text-slate-800">{row.quantity}</td>
                    <td className="px-3 py-3 text-sm capitalize text-slate-700">{pretty(row.condition)}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-700">
                        {pretty(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-700">{formatDate(row.assignedAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => removeAsset(row.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
