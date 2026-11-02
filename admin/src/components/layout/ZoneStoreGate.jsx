import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  MapPinned,
  Phone,
  RefreshCw,
  Search,
  Store,
  Warehouse,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import darkStoreApi from '../../api/darkStoreApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';

const STORAGE_KEY = 'greengroo_admin_last_zone_store';

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

export default function ZoneStoreGate({
  kicker = 'Operations',
  title = 'Module',
  subtitle = 'Select a zone and dark store to manage this module.',
  basePath,
  children,
}) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const zoneKey = params.zoneKey || '';
  const storeId = params.storeId || '';
  const decodedZone = decodeURIComponent(zoneKey || '').trim();

  // Determine base path if not explicitly provided
  const effectiveBasePath = useMemo(() => {
    if (basePath) return basePath;
    const path = location.pathname;
    const idx = path.indexOf('/zones/');
    if (idx !== -1) return path.slice(0, idx);
    return path;
  }, [basePath, location.pathname]);

  // Data states
  const [zones, setZones] = useState([]);
  const [stores, setStores] = useState([]);
  const [zoneMeta, setZoneMeta] = useState(null);
  const [currentStore, setCurrentStore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  // Read saved selection from localStorage
  const lastSaved = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  }, []);

  // Fetch zones when zoneKey is missing
  useEffect(() => {
    if (decodedZone) return;
    let alive = true;
    setLoading(true);
    setError('');

    opsApi
      .list('assets-management/zones')
      .then((res) => {
        if (!alive) return;
        const list = res?.data || [];
        if (list.length > 0) {
          setZones(list);
        } else {
          // Fallback to darkStoreApi
          darkStoreApi.list().then((storeRes) => {
            if (!alive) return;
            const allStores = Array.isArray(storeRes?.data) ? storeRes.data : Array.isArray(storeRes) ? storeRes : [];
            const byZone = new Map();
            for (const s of allStores) {
              const city = String(s.city || '').trim() || 'General';
              const key = city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              const entry = byZone.get(key) || { zoneKey: key, name: city, city, storeCount: 0 };
              entry.storeCount += 1;
              byZone.set(key, entry);
            }
            setZones([...byZone.values()]);
          });
        }
      })
      .catch((err) => {
        if (!alive) return;
        // Try fallback
        darkStoreApi
          .list()
          .then((storeRes) => {
            if (!alive) return;
            const allStores = Array.isArray(storeRes?.data) ? storeRes.data : Array.isArray(storeRes) ? storeRes : [];
            const byZone = new Map();
            for (const s of allStores) {
              const city = String(s.city || '').trim() || 'General';
              const key = city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              const entry = byZone.get(key) || { zoneKey: key, name: city, city, storeCount: 0 };
              entry.storeCount += 1;
              byZone.set(key, entry);
            }
            setZones([...byZone.values()]);
          })
          .catch((fErr) => {
            if (alive) setError(err.response?.data?.message || err.message || 'Failed to load zones');
          });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [decodedZone]);

  // Fetch stores when zoneKey is present
  useEffect(() => {
    if (!decodedZone) {
      setStores([]);
      setZoneMeta(null);
      return;
    }

    let alive = true;
    setLoading(!storeId); // Don't block UI if storeId is already known
    setError('');

    opsApi
      .list(`assets-management/zones/${encodeURIComponent(decodedZone)}/stores`)
      .then((res) => {
        if (!alive) return;
        const storeList = res?.data || [];
        setStores(storeList);
        setZoneMeta(res?.zone || { name: decodedZone, zoneKey: decodedZone });

        // If storeId is specified, match currentStore
        if (storeId && storeList.length > 0) {
          const match = storeList.find((s) => String(s._id) === String(storeId));
          if (match) {
            setCurrentStore(match);
            // Save last active
            try {
              localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                  zoneKey: decodedZone,
                  zoneName: res?.zone?.name || decodedZone,
                  storeId: match._id,
                  storeName: match.storeName || match.name,
                })
              );
            } catch {
              // ignore
            }
          }
        }
      })
      .catch((err) => {
        if (!alive) return;
        // Fallback to darkStoreApi filter
        darkStoreApi
          .list()
          .then((storeRes) => {
            if (!alive) return;
            const all = Array.isArray(storeRes?.data) ? storeRes.data : Array.isArray(storeRes) ? storeRes : [];
            const matchStores = all.filter(
              (s) =>
                String(s.city || '').toLowerCase() === decodedZone.toLowerCase() ||
                String(s.cityId || '').toLowerCase() === decodedZone.toLowerCase()
            );
            setStores(matchStores);
            setZoneMeta({ name: decodedZone, zoneKey: decodedZone });
            if (storeId) {
              const m = matchStores.find((s) => String(s._id) === String(storeId));
              if (m) setCurrentStore(m);
            }
          })
          .catch((fErr) => {
            if (alive) setError(err.response?.data?.message || 'Failed to load dark stores');
          });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [decodedZone, storeId]);

  // Search filter for zones
  const filteredZones = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return zones;
    return zones.filter((z) => [z.name, z.city, z.cityId, z.zoneKey].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [zones, q]);

  // Search filter for stores
  const filteredStores = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stores;
    return stores.filter((s) =>
      [s.storeName, s.name, s.area, s.city, ...(s.pincodes || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [stores, q]);

  // ----------------------------------------------------
  // STEP 1: Admin needs to select a Zone
  // ----------------------------------------------------
  if (!decodedZone) {
    return (
      <div className="space-y-6">
        <div>
          <p className={PAGE_KICKER}>{kicker}</p>
          <h1 className={PAGE_TITLE}>{title}</h1>
          <p className={PAGE_SUB}>{subtitle}</p>
        </div>

        {/* Quick jump to previously selected store if available */}
        {lastSaved?.zoneKey && lastSaved?.storeId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Recently Active</p>
                <p className="text-sm font-bold text-slate-900">
                  {lastSaved.zoneName || lastSaved.zoneKey} &rsaquo; {lastSaved.storeName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                navigate(
                  `${effectiveBasePath}/zones/${encodeURIComponent(lastSaved.zoneKey)}/stores/${lastSaved.storeId}`
                )
              }
              className={`${BTN_PRIMARY} gap-1.5 shadow-none text-xs`}
            >
              Continue with this store
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Total Zones" value={zones.length} icon={MapPinned} />
          <StatCard
            label="Total Dark Stores"
            value={zones.reduce((sum, z) => sum + (z.storeCount || 0), 0)}
            icon={Store}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${INPUT} pl-9`}
              placeholder="Search zone (e.g. Pune, Mumbai, Delhi)..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">Step 1 of 2: Select Zone</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> Loading zones...
          </div>
        ) : error ? (
          <div className={`${PANEL} p-8 text-center`}>
            <p className="text-base font-semibold text-rose-600">Could not load zones</p>
            <p className="mt-1 text-xs text-slate-500">{error}</p>
          </div>
        ) : filteredZones.length === 0 ? (
          <div className={`${PANEL} p-12 text-center`}>
            <MapPinned className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-semibold text-slate-800">No zones found</p>
            <p className="mt-1 text-xs text-slate-500">Please configure dark stores with cities first.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredZones.map((z) => {
              const targetKey = z.zoneKey || z.name;
              return (
                <button
                  type="button"
                  key={targetKey}
                  onClick={() => navigate(`${effectiveBasePath}/zones/${encodeURIComponent(targetKey)}`)}
                  className={`${PANEL} group flex items-center justify-between p-4 text-left transition hover:border-emerald-400 hover:shadow-md`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#217346] transition group-hover:bg-emerald-600 group-hover:text-white">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-900 group-hover:text-emerald-800">
                        {z.name || z.city}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {z.storeCount || 0} dark store{z.storeCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP 2: Zone is selected, admin needs to select Dark Store
  // ----------------------------------------------------
  if (!storeId) {
    const zoneDisplayName = zoneMeta?.name || decodedZone;
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: title, to: effectiveBasePath },
              { label: `Zone: ${zoneDisplayName}` },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div>
              <p className={PAGE_KICKER}>{kicker} &rsaquo; {zoneDisplayName}</p>
              <h1 className={PAGE_TITLE}>Select Dark Store</h1>
              <p className={PAGE_SUB}>
                Choose a dark store in <strong>{zoneDisplayName}</strong> to manage {title.toLowerCase()}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(effectiveBasePath)}
              className={BTN}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Change Zone
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Selected Zone" value={zoneDisplayName} icon={MapPinned} />
          <StatCard label="Dark Stores in Zone" value={stores.length} icon={Store} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${INPUT} pl-9`}
              placeholder="Search store by name, area, or pincode..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">Step 2 of 2: Select Dark Store</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> Loading stores in {zoneDisplayName}...
          </div>
        ) : error ? (
          <div className={`${PANEL} p-8 text-center`}>
            <p className="text-base font-semibold text-rose-600">Could not load dark stores</p>
            <p className="mt-1 text-xs text-slate-500">{error}</p>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className={`${PANEL} p-12 text-center`}>
            <Store className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-semibold text-slate-800">No dark stores found in {zoneDisplayName}</p>
            <p className="mt-1 text-xs text-slate-500">Add dark stores in this zone to proceed.</p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate(effectiveBasePath)}
                className={BTN}
              >
                Choose another zone
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStores.map((store) => {
              const displayName = store.storeName || store.name || 'Dark Store';
              const locationText = [store.area, store.city].filter(Boolean).join(', ');
              return (
                <button
                  type="button"
                  key={store._id}
                  onClick={() => {
                    try {
                      localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify({
                          zoneKey: decodedZone,
                          zoneName: zoneDisplayName,
                          storeId: store._id,
                          storeName: displayName,
                        })
                      );
                    } catch {
                      // ignore
                    }
                    navigate(
                      `${effectiveBasePath}/zones/${encodeURIComponent(decodedZone)}/stores/${store._id}`
                    );
                  }}
                  className={`${PANEL} group flex flex-col justify-between p-4 text-left transition hover:border-emerald-400 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#217346] transition group-hover:bg-emerald-600 group-hover:text-white">
                      <Store className="h-5 w-5" />
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        store.isActive !== false ? 'bg-emerald-50 text-[#217346]' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {store.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mt-3 min-w-0">
                    <p className="truncate text-base font-bold text-slate-900 group-hover:text-emerald-800">
                      {displayName}
                    </p>
                    {locationText && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{locationText}</span>
                      </p>
                    )}
                    {store.phone && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{store.phone}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-[#217346]">
                    <span>Manage {title} &rarr;</span>
                    <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP 3: Both Zone and Dark Store are selected!
  // Render sticky / prominent Scope Bar + Module Content
  // ----------------------------------------------------
  const zoneDisplayName = zoneMeta?.name || decodedZone;
  const storeDisplayName = currentStore?.storeName || currentStore?.name || 'Selected Dark Store';

  return (
    <div className="space-y-6">
      {/* Top Scope Navigation & Quick Switcher Bar */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Store className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Link to={effectiveBasePath} className="hover:text-emerald-700 font-medium transition">
                  {title}
                </Link>
                <span>&rsaquo;</span>
                <Link
                  to={`${effectiveBasePath}/zones/${encodeURIComponent(decodedZone)}`}
                  className="hover:text-emerald-700 font-medium transition"
                >
                  {zoneDisplayName}
                </Link>
                <span>&rsaquo;</span>
                <span className="font-semibold text-slate-800 truncate">{storeDisplayName}</span>
              </div>
              <p className="text-sm font-bold text-slate-900 truncate">
                {storeDisplayName}
                <span className="ml-2 font-normal text-xs text-slate-500">
                  ({zoneDisplayName}{currentStore?.area ? ` • ${currentStore.area}` : ''})
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Switch Store Dropdown */}
            {stores.length > 1 && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Switch store:</label>
                <select
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                  value={storeId}
                  onChange={(e) => {
                    const newStoreId = e.target.value;
                    const match = stores.find((s) => String(s._id) === String(newStoreId));
                    if (match) {
                      try {
                        localStorage.setItem(
                          STORAGE_KEY,
                          JSON.stringify({
                            zoneKey: decodedZone,
                            zoneName: zoneDisplayName,
                            storeId: match._id,
                            storeName: match.storeName || match.name,
                          })
                        );
                      } catch {
                        // ignore
                      }
                    }
                    navigate(`${effectiveBasePath}/zones/${encodeURIComponent(decodedZone)}/stores/${newStoreId}`);
                  }}
                >
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.storeName || s.name} {s.area ? `(${s.area})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate(`${effectiveBasePath}/zones/${encodeURIComponent(decodedZone)}`)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              All Stores in Zone
            </button>

            <button
              type="button"
              onClick={() => navigate(effectiveBasePath)}
              className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-[#217346] shadow-sm transition hover:bg-emerald-100"
            >
              Change Zone
            </button>
          </div>
        </div>
      </div>

      {/* Actual Page Component */}
      <div>
        {React.isValidElement(children)
          ? React.cloneElement(children, {
              zoneKey: decodedZone,
              storeId,
              activeZone: zoneMeta,
              activeStore: currentStore,
            })
          : children}
      </div>
    </div>
  );
}

