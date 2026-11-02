import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Search,
  RefreshCw,
  Store,
  Pencil,
  ExternalLink,
  Loader2,
  X,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  Warehouse,
  Plus,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import darkStoreApi from '../api/darkStoreApi';
import opsApi from '../api/opsApi';
import { PendingDarkStoreRequestsBanner } from './ops/multiVendorShared';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../utils/ui';

const DEFAULT_LAT = 18.559;
const DEFAULT_LNG = 73.7868;

const emptyForm = {
  storeName: '',
  name: '',
  state: '',
  city: '',
  area: '',
  storeAddress: '',
  latitude: '',
  longitude: '',
  geofenceRadius: 500,
  isActive: true,
  vendorId: '',
  email: '',
  phone: '',
  password: '',
};

const UNASSIGNED = '__none__';

function isDefaultPin(store) {
  const lat = Number(store?.latitude);
  const lng = Number(store?.longitude);
  return Math.abs(lat - DEFAULT_LAT) < 0.001 && Math.abs(lng - DEFAULT_LNG) < 0.001;
}

function mapsUrl(store) {
  const lat = Number(store?.latitude);
  const lng = Number(store?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    format: 'json',
    lat: String(lat),
    lon: String(lng),
    zoom: '18',
    addressdetails: '1',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const addr = data?.address || {};
  return {
    city: addr.city || addr.town || addr.village || addr.county || '',
    state: addr.state || '',
    area: addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.village || '',
    storeAddress: data?.display_name || '',
  };
}

function Field({ label, children }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}

function StoreFormFields({ form, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Store name">
          <input name="storeName" value={form.storeName} onChange={onChange} className={`${INPUT} mt-1`} />
        </Field>
        <Field label="Manager name">
          <input name="name" value={form.name} onChange={onChange} className={`${INPUT} mt-1`} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="State">
          <input name="state" value={form.state} onChange={onChange} className={`${INPUT} mt-1`} />
        </Field>
        <Field label="City">
          <input name="city" value={form.city} onChange={onChange} className={`${INPUT} mt-1`} />
        </Field>
        <Field label="Area / locality">
          <input name="area" value={form.area} onChange={onChange} className={`${INPUT} mt-1`} />
        </Field>
      </div>
      <Field label="Store address">
        <textarea
          name="storeAddress"
          rows={2}
          value={form.storeAddress}
          onChange={onChange}
          className={`${INPUT} mt-1`}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Latitude">
          <input
            name="latitude"
            type="number"
            step="any"
            value={form.latitude}
            onChange={onChange}
            className={`${INPUT} mt-1`}
          />
        </Field>
        <Field label="Longitude">
          <input
            name="longitude"
            type="number"
            step="any"
            value={form.longitude}
            onChange={onChange}
            className={`${INPUT} mt-1`}
          />
        </Field>
        <Field label="Service radius (m)">
          <input
            name="geofenceRadius"
            type="number"
            min={50}
            max={50000}
            value={form.geofenceRadius}
            onChange={onChange}
            className={`${INPUT} mt-1`}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name="isActive"
          checked={form.isActive}
          onChange={onChange}
          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
        />
        Store is active and can receive orders
      </label>
    </div>
  );
}

export default function DarkStores() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [centreFilter, setCentreFilter] = useState('all');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [formError, setFormError] = useState('');

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [data, vendorRes] = await Promise.all([
        darkStoreApi.list(),
        opsApi.list('vendors').catch(() => ({ data: [] })),
      ]);
      setStores(data.stores || []);
      setVendors(Array.isArray(vendorRes.data) ? vendorRes.data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dark stores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (location.state?.createFor === undefined) return;
    openCreate(location.state.createFor || '');
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const centreKeyOf = useCallback(
    (store) => (store.vendorId && vendorById.has(store.vendorId) ? store.vendorId : UNASSIGNED),
    [vendorById]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((store) => {
      if (statusFilter === 'active' && !store.isActive) return false;
      if (statusFilter === 'inactive' && store.isActive) return false;
      if (centreFilter !== 'all' && centreKeyOf(store) !== centreFilter) return false;
      if (!q) return true;
      return [
        store.storeName,
        store.name,
        store.email,
        store.phone,
        store.city,
        store.area,
        store.state,
        store.storeAddress,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [stores, search, statusFilter, centreFilter, centreKeyOf]);

  const groups = useMemo(() => {
    const byCentre = new Map();
    filtered.forEach((store) => {
      const key = centreKeyOf(store);
      if (!byCentre.has(key)) byCentre.set(key, []);
      byCentre.get(key).push(store);
    });
    const showEmpty = !search.trim() && statusFilter === 'all';
    const list = vendors
      .filter((v) => (centreFilter === 'all' || centreFilter === v.id) && (showEmpty || byCentre.has(v.id)))
      .map((v) => ({ key: v.id, vendor: v, stores: byCentre.get(v.id) || [] }));
    if (byCentre.has(UNASSIGNED)) list.push({ key: UNASSIGNED, vendor: null, stores: byCentre.get(UNASSIGNED) });
    return list;
  }, [filtered, vendors, centreFilter, centreKeyOf, search, statusFilter]);

  const stats = useMemo(() => {
    const active = stores.filter((s) => s.isActive).length;
    const needPin = stores.filter((s) => isDefaultPin(s)).length;
    const skus = stores.reduce((sum, s) => sum + (s.skuCount || 0), 0);
    return { total: stores.length, active, needPin, skus };
  }, [stores]);

  const openCreate = (vendorId = '') => {
    setFormError('');
    setEditing({ isNew: true });
    setForm({ ...emptyForm, vendorId });
  };

  const openEdit = (store) => {
    setFormError('');
    setEditing(store);
    setForm({
      ...emptyForm,
      storeName: store.storeName || '',
      name: store.name || '',
      state: store.state || '',
      city: store.city || '',
      area: store.area || '',
      storeAddress: store.storeAddress || '',
      latitude: store.latitude ?? '',
      longitude: store.longitude ?? '',
      geofenceRadius: store.geofenceRadius ?? 500,
      isActive: store.isActive !== false,
      vendorId: store.vendorId || '',
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const applyDetected = async (lat, lng) => {
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    try {
      const geo = await reverseGeocode(lat, lng);
      if (!geo) return;
      setForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        city: geo.city || prev.city,
        state: geo.state || prev.state,
        area: geo.area || prev.area,
        storeAddress: geo.storeAddress || prev.storeAddress,
      }));
    } catch {
      // coords still applied
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Location is not supported in this browser');
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await applyDetected(position.coords.latitude, position.coords.longitude);
        setDetecting(false);
      },
      () => {
        setDetecting(false);
        showToast('Allow location access to set this store pin');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const saveLocation = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setFormError('');
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || form.latitude === '' || form.longitude === '') {
      setFormError('Enter a valid latitude and longitude (or use current location)');
      return;
    }
    if (!form.city.trim() || !form.area.trim() || !form.state.trim()) {
      setFormError('State, city and area are required');
      return;
    }
    if (editing.isNew && !form.storeName.trim()) {
      setFormError('Store name is required');
      return;
    }
    const payload = {
      storeName: form.storeName,
      name: form.name,
      state: form.state,
      city: form.city,
      area: form.area,
      storeAddress: form.storeAddress,
      latitude: lat,
      longitude: lng,
      geofenceRadius: Number(form.geofenceRadius),
      isActive: form.isActive,
      vendorId: form.vendorId,
    };
    setSaving(true);
    try {
      const data = editing.isNew
        ? await opsApi.create('dark-stores', { ...payload, email: form.email, phone: form.phone, password: form.password })
        : await darkStoreApi.updateLocation(editing.id, payload);
      showToast(data.message || (editing.isNew ? 'Dark store created' : 'Store updated'));
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save dark store');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={PAGE_KICKER}>Multi Vendor · Fulfilment</p>
          <h1 className={PAGE_TITLE}>Dark Stores</h1>
          <p className={PAGE_SUB}>
            Dark stores grouped by the collection centre that supplies them
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className={BTN}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={() => openCreate()} className={BTN_PRIMARY}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Dark Store
          </button>
        </div>
      </div>

      <PendingDarkStoreRequestsBanner />

      {toast ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {toast}
        </div>
      ) : null}
      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Dark stores', value: stats.total, hint: 'Registered hubs' },
          { label: 'Active', value: stats.active, hint: 'Can receive orders' },
          { label: 'Need pin', value: stats.needPin, hint: 'Still on default map pin' },
          { label: 'Catalog SKUs', value: stats.skus, hint: 'Across all stores' },
        ].map((item) => (
          <div key={item.label} className={`${PANEL} p-4`}>
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{item.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className={`${PANEL} p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search store, city, area, manager…"
              className={`${INPUT} pl-9`}
            />
          </div>
          <select
            value={centreFilter}
            onChange={(e) => setCentreFilter(e.target.value)}
            className={`${INPUT} sm:w-64`}
          >
            <option value="all">All collection centres</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendorName || v.businessName || v.ownerName}
              </option>
            ))}
            <option value={UNASSIGNED}>Not assigned</option>
          </select>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {['all', 'active', 'inactive'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  statusFilter === key
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Showing {filtered.length} of {stores.length} stores
        </p>
      </div>

      {loading ? (
        <div className={`${PANEL} flex justify-center py-20 text-slate-400`}>
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className={`${PANEL} px-6 py-16 text-center`}>
          <Store className="mx-auto h-10 w-10 text-emerald-600/30" />
          <h2 className="mt-3 text-base font-semibold text-slate-800">No dark stores found</h2>
          <p className="mt-1 text-sm text-slate-400">
            Register a delivery manager or clear the search.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
                <Warehouse className={`h-4 w-4 ${group.vendor ? 'text-emerald-700' : 'text-slate-400'}`} />
                {group.vendor ? (
                  <Link
                    to={`/multi-vendor/${group.vendor.id}`}
                    className="text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                  >
                    {group.vendor.vendorName || group.vendor.businessName || group.vendor.ownerName}
                  </Link>
                ) : (
                  <span className="text-sm font-bold text-slate-500">Not assigned to any collection centre</span>
                )}
                {group.vendor?.collectionCentre?.id ? (
                  <span className="text-xs text-slate-400">{group.vendor.collectionCentre.id}</span>
                ) : null}
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {group.stores.length} dark store{group.stores.length === 1 ? '' : 's'}
                </span>
                {group.vendor ? (
                  <button
                    type="button"
                    onClick={() => openCreate(group.vendor.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add dark store
                  </button>
                ) : null}
              </div>
              {group.stores.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-400">
                  No dark store linked yet. Edit a dark store and choose this collection centre.
                </p>
              ) : (
          <div className="grid gap-3 lg:grid-cols-2">
          {group.stores.map((store) => {
            const unpinned = isDefaultPin(store);
            return (
              <article key={store.id} className={`${PANEL} p-5 transition hover:border-emerald-300`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <Store className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-slate-900">
                          {store.storeName}
                        </h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                            store.isActive
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-slate-100 text-slate-500 ring-slate-200'
                          }`}
                        >
                          {store.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {unpinned ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                            Default pin
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-sm text-emerald-700">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {[store.area, store.city, store.state].filter(Boolean).join(', ') || 'Location not set'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(store)}
                    className={`${BTN_PRIMARY} h-9 min-h-0 shrink-0 px-3 text-xs`}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>

                <p className="mt-3 line-clamp-2 text-xs text-slate-500">
                  {store.storeAddress || 'No address on file'}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {[
                    {
                      label: 'Coords',
                      value: `${Number(store.latitude).toFixed(4)}, ${Number(store.longitude).toFixed(4)}`,
                      mono: true,
                    },
                    { label: 'Radius', value: `${store.geofenceRadius || 500} m` },
                    { label: 'Catalog', value: `${store.inStockSkus || 0}/${store.skuCount || 0} SKUs` },
                    { label: 'Manager', value: store.name || '—' },
                  ].map((cell) => (
                    <div key={cell.label} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {cell.label}
                      </p>
                      <p
                        className={`mt-0.5 truncate font-semibold text-slate-800 ${
                          cell.mono ? 'font-mono text-[11px]' : ''
                        }`}
                      >
                        {cell.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  {store.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3 text-slate-400" /> {store.email}
                    </span>
                  ) : null}
                  {store.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3 text-slate-400" /> {store.phone}
                    </span>
                  ) : null}
                  {mapsUrl(store) ? (
                    <a
                      href={mapsUrl(store)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                    >
                      Open map <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
          </div>
              )}
            </section>
          ))}
        </div>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <form
            onSubmit={saveLocation}
            className={`max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl ${PANEL} p-5 shadow-xl sm:rounded-3xl sm:p-6`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className={PAGE_KICKER}>Dark store</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  {editing.isNew ? 'Add dark store' : 'Edit dark store'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Choose its collection centre. Orders near this pin and area are assigned to this store.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={detecting}
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
            >
              {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {detecting ? 'Detecting…' : 'Use current location'}
            </button>

            <Field label="Collection centre (supplies this dark store)">
              <select name="vendorId" value={form.vendorId} onChange={handleChange} className={`${INPUT} mt-1 mb-3`}>
                <option value="">Not assigned</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorName || v.businessName || v.ownerName}
                    {v.collectionCentre?.id ? ` (${v.collectionCentre.id})` : ''}
                  </option>
                ))}
              </select>
            </Field>

            {editing.isNew ? (
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Manager mobile *">
                  <input name="phone" value={form.phone} onChange={handleChange} maxLength={10} className={`${INPUT} mt-1`} required />
                </Field>
                <Field label="Manager email *">
                  <input name="email" type="email" value={form.email} onChange={handleChange} className={`${INPUT} mt-1`} required />
                </Field>
                <Field label="Login password *">
                  <input
                    name="password"
                    type="password"
                    minLength={6}
                    value={form.password}
                    onChange={handleChange}
                    className={`${INPUT} mt-1`}
                    required
                  />
                </Field>
              </div>
            ) : null}

            <StoreFormFields form={form} onChange={handleChange} />

            {formError ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setEditing(null)} className={BTN}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : editing.isNew ? (
                  'Create dark store'
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
