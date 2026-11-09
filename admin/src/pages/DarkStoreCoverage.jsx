import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Hash,
  Loader2,
  MapPin,
  Radar,
  RefreshCw,
  Save,
  Search,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import darkStoreApi from '../api/darkStoreApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, PANEL_HEAD } from '../utils/ui';

const DEFAULT_CENTER = [18.5204, 73.8567];
const RADIUS_COLOR = '#15803d';
const PINCODE_COLOR = '#7c3aed';
const MUTED_COLOR = '#94a3b8';
const DEFAULT_LIMITS = { minRadiusKm: 0.5, maxRadiusKm: 50, maxPincodes: 500 };

const hasPin = (store) => Number.isFinite(store?.latitude) && Number.isFinite(store?.longitude);

function parsePincodeText(text) {
  const tokens = String(text || '')
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const valid = [...new Set(tokens.filter((t) => /^\d{6}$/.test(t)))];
  const invalid = [...new Set(tokens.filter((t) => !/^\d{6}$/.test(t)))];
  return { valid, invalid };
}

function draftFor(store) {
  return {
    coverageMode: store?.coverageMode === 'pincode' ? 'pincode' : 'radius',
    deliveryRadiusKm: store?.deliveryRadiusKm ?? 5,
    pincodeText: (store?.servicePincodes || []).join(', '),
  };
}

function coverageLabel(store) {
  return store.coverageMode === 'pincode'
    ? `${store.servicePincodes.length} pincode${store.servicePincodes.length === 1 ? '' : 's'}`
    : `${store.deliveryRadiusKm} km radius`;
}

/** Fits the map to all stores once, then follows the selected store (its whole radius when in radius mode). */
function MapFocus({ stores, focus, radiusKm }) {
  const map = useMap();
  const storeCount = stores.length;

  useEffect(() => {
    const points = stores.filter(hasPin).map((s) => [s.latitude, s.longitude]);
    if (points.length === 1) map.setView(points[0], 12);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40] });
    // Only on first load / store count change, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, storeCount]);

  useEffect(() => {
    if (!focus || !hasPin(focus)) return;
    const center = L.latLng(focus.latitude, focus.longitude);
    if (radiusKm) map.flyToBounds(center.toBounds(radiusKm * 2000), { padding: [30, 30], duration: 0.6 });
    else map.flyTo(center, Math.max(map.getZoom(), 13), { duration: 0.6 });
    // Re-focus when the selection changes, not while the radius slider moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus?.id]);

  return null;
}

function MapClick({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng) });
  return null;
}

function ModeBadge({ store }) {
  const pincode = store.coverageMode === 'pincode';
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold ${
        pincode ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {pincode ? <Hash size={10} /> : <Radar size={10} />}
      {coverageLabel(store)}
    </span>
  );
}

export default function DarkStoreCoverage() {
  const [stores, setStores] = useState([]);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(draftFor(null));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [overlaps, setOverlaps] = useState([]);
  const [probe, setProbe] = useState(null);
  const [probePincode, setProbePincode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await darkStoreApi.listCoverage();
      setStores(data.stores || []);
      setLimits({ ...DEFAULT_LIMITS, ...(data.limits || {}) });
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load dark stores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => stores.find((s) => s.id === selectedId) || null, [stores, selectedId]);

  const selectStore = (store) => {
    setSelectedId(store.id);
    setDraft(draftFor(store));
    setNotice(null);
    setOverlaps([]);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      [s.storeName, s.city, s.area, s.vendorName, s.pincode, ...s.servicePincodes].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [stores, search]);

  const parsedPincodes = useMemo(() => parsePincodeText(draft.pincodeText), [draft.pincodeText]);
  const radiusNumber = Number(draft.deliveryRadiusKm);
  const radiusValid =
    Number.isFinite(radiusNumber) && radiusNumber >= limits.minRadiusKm && radiusNumber <= limits.maxRadiusKm;

  const dirty = useMemo(() => {
    if (!selected) return false;
    if (draft.coverageMode !== selected.coverageMode) return true;
    if (draft.coverageMode === 'radius') return Number(draft.deliveryRadiusKm) !== selected.deliveryRadiusKm;
    return parsedPincodes.valid.join(',') !== selected.servicePincodes.join(',');
  }, [draft, selected, parsedPincodes]);

  const canSave =
    selected &&
    dirty &&
    !saving &&
    (draft.coverageMode === 'radius'
      ? radiusValid && hasPin(selected)
      : parsedPincodes.valid.length > 0 && parsedPincodes.invalid.length === 0);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setNotice(null);
    setOverlaps([]);
    try {
      const payload =
        draft.coverageMode === 'radius'
          ? { coverageMode: 'radius', deliveryRadiusKm: radiusNumber }
          : { coverageMode: 'pincode', servicePincodes: parsedPincodes.valid };
      const data = await darkStoreApi.updateCoverage(selected.id, payload);
      setStores((prev) => prev.map((s) => (s.id === selected.id ? { ...s, ...data.store, vendorName: s.vendorName } : s)));
      setDraft(draftFor({ ...selected, ...data.store }));
      setOverlaps(data.overlaps || []);
      setNotice({ type: 'success', text: data.message || 'Coverage saved' });
      setProbe(null);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not save coverage' });
    } finally {
      setSaving(false);
    }
  };

  const runProbe = async (payload, point = null) => {
    setProbe({ loading: true, point, pincode: payload.pincode || '' });
    try {
      const data = await darkStoreApi.checkCoverage(payload);
      setProbe({ loading: false, point, pincode: payload.pincode || '', ...data });
    } catch (err) {
      setProbe({ loading: false, point, error: err.response?.data?.message || 'Check failed' });
    }
  };

  const onMapPick = (latlng) => runProbe({ lat: latlng.lat, lng: latlng.lng }, [latlng.lat, latlng.lng]);

  const mappedStores = stores.filter(hasPin);
  const unmappedCount = stores.length - mappedStores.length;
  const previewRadiusKm = selected && draft.coverageMode === 'radius' && radiusValid ? radiusNumber : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={PAGE_KICKER}>Delivery &amp; Dark Stores</p>
          <h1 className={PAGE_TITLE}>Store Coverage</h1>
          <p className={PAGE_SUB}>
            Decide where each dark store delivers: a radius around the store, or a fixed list of pincodes. Only one rule
            is used per store.
          </p>
        </div>
        <button type="button" onClick={load} className={BTN} disabled={loading}>
          <RefreshCw size={13} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loadError ? (
        <div className="flex items-center gap-2 border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertTriangle size={14} /> {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className={PANEL}>
            <div className={PANEL_HEAD}>Dark stores ({stores.length})</div>
            <div className="border-b border-slate-100 p-3">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search store, city, vendor or pincode"
                  className={`${INPUT} pl-8`}
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin" /> Loading stores…
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">No dark stores found.</p>
              ) : (
                filtered.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => selectStore(store)}
                    className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                      store.id === selectedId ? 'bg-emerald-50/60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold text-slate-800">{store.storeName}</span>
                      <ModeBadge store={store} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {[store.vendorName, store.area, store.city].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                      {!store.isActive ? <span className="bg-slate-100 px-1.5 py-0.5 text-slate-500">Inactive</span> : null}
                      {!hasPin(store) ? (
                        <span className="bg-amber-50 px-1.5 py-0.5 text-amber-700">No map location</span>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className={PANEL}>
            <div className={PANEL_HEAD}>{selected ? `Coverage · ${selected.storeName}` : 'Coverage'}</div>
            {!selected ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">Select a dark store to set its coverage.</p>
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Coverage rule</p>
                  <div className="grid grid-cols-2 border border-slate-200">
                    {[
                      { mode: 'radius', label: 'Radius', icon: Radar },
                      { mode: 'pincode', label: 'Pincodes', icon: Hash },
                    ].map(({ mode, label, icon: Icon }) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, coverageMode: mode }))}
                        className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                          draft.coverageMode === mode ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {draft.coverageMode === 'radius'
                      ? 'Customers within this distance of the store pin are served. Pincodes are ignored.'
                      : 'Only customers whose address pincode is in this list are served. Distance is ignored.'}
                  </p>
                </div>

                {draft.coverageMode === 'radius' ? (
                  hasPin(selected) ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={limits.minRadiusKm}
                          max={limits.maxRadiusKm}
                          step={0.5}
                          value={radiusValid ? radiusNumber : limits.minRadiusKm}
                          onChange={(e) => setDraft((d) => ({ ...d, deliveryRadiusKm: e.target.value }))}
                          className="flex-1 accent-emerald-700"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={limits.minRadiusKm}
                            max={limits.maxRadiusKm}
                            step={0.5}
                            value={draft.deliveryRadiusKm}
                            onChange={(e) => setDraft((d) => ({ ...d, deliveryRadiusKm: e.target.value }))}
                            className={`${INPUT} w-20 text-right`}
                          />
                          <span className="text-xs text-slate-500">km</span>
                        </div>
                      </div>
                      {!radiusValid ? (
                        <p className="text-[11px] text-rose-600">
                          Radius must be between {limits.minRadiusKm} and {limits.maxRadiusKm} km.
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500">The green circle on the map shows this radius live.</p>
                      )}
                    </div>
                  ) : (
                    <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      This store has no map location yet, so a radius cannot be drawn.{' '}
                      <Link to="/dark-stores" className="font-semibold underline">
                        Set its location
                      </Link>{' '}
                      or use pincodes.
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={draft.pincodeText}
                      onChange={(e) => setDraft((d) => ({ ...d, pincodeText: e.target.value }))}
                      placeholder="411057, 411045, 411027"
                      className={INPUT}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>
                        {parsedPincodes.valid.length} pincode{parsedPincodes.valid.length === 1 ? '' : 's'}
                        {` (max ${limits.maxPincodes})`}
                      </span>
                      {selected.pincode && !parsedPincodes.valid.includes(selected.pincode) ? (
                        <button
                          type="button"
                          className="font-semibold text-violet-700 hover:underline"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              pincodeText: [d.pincodeText.trim(), selected.pincode].filter(Boolean).join(', '),
                            }))
                          }
                        >
                          + Add store's own pincode ({selected.pincode})
                        </button>
                      ) : null}
                    </div>
                    {parsedPincodes.valid.length ? (
                      <div className="flex flex-wrap gap-1">
                        {parsedPincodes.valid.map((pin) => (
                          <span key={pin} className="inline-flex items-center gap-1 bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700">
                            {pin}
                            <button
                              type="button"
                              aria-label={`Remove ${pin}`}
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  pincodeText: parsePincodeText(d.pincodeText).valid.filter((p) => p !== pin).join(', '),
                                }))
                              }
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {parsedPincodes.invalid.length ? (
                      <p className="text-[11px] text-rose-600">
                        Not 6-digit pincodes: {parsedPincodes.invalid.slice(0, 8).join(', ')}
                      </p>
                    ) : null}
                  </div>
                )}

                {notice ? (
                  <div
                    className={`flex items-start gap-2 border px-3 py-2 text-[11px] ${
                      notice.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {notice.type === 'success' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {notice.text}
                  </div>
                ) : null}

                {overlaps.length ? (
                  <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    <p className="font-semibold">Also served by another store (the nearest one gets the order):</p>
                    <ul className="mt-1 space-y-0.5">
                      {overlaps.slice(0, 10).map((o) => (
                        <li key={`${o.pincode}-${o.storeId}`}>
                          {o.pincode} — {o.storeName}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className={BTN}
                    disabled={!dirty || saving}
                    onClick={() => {
                      setDraft(draftFor(selected));
                      setNotice(null);
                    }}
                  >
                    Reset
                  </button>
                  <button type="button" className={BTN_PRIMARY} disabled={!canSave} onClick={save}>
                    {saving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
                    Save coverage
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className={`${PANEL} flex flex-wrap items-center gap-2 px-3 py-2`}>
            <Crosshair size={14} className="text-slate-500" />
            <span className="text-xs text-slate-600">Test a location: click the map, or check a pincode</span>
            <form
              className="ml-auto flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (/^\d{6}$/.test(probePincode)) runProbe({ pincode: probePincode });
              }}
            >
              <input
                value={probePincode}
                onChange={(e) => setProbePincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Pincode"
                className={`${INPUT} w-24`}
              />
              <button type="submit" className={BTN} disabled={!/^\d{6}$/.test(probePincode)}>
                Check
              </button>
            </form>
          </div>

          {probe ? (
            <div
              className={`flex items-center gap-2 border px-3 py-2 text-xs ${
                probe.loading
                  ? 'border-slate-200 bg-white text-slate-600'
                  : probe.error || !probe.served
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {probe.loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Checking…
                </>
              ) : probe.error ? (
                probe.error
              ) : probe.served ? (
                <>
                  <CheckCircle2 size={13} />
                  {probe.pincode ? `Pincode ${probe.pincode}` : 'This point'} is served by <b>{probe.storeName}</b>
                  {probe.distanceKm != null ? ` (${probe.distanceKm} km away)` : ''}
                </>
              ) : (
                <>
                  <AlertTriangle size={13} />
                  {probe.pincode ? `Pincode ${probe.pincode}` : 'This point'} is not served by any dark store
                </>
              )}
              <button type="button" className="ml-auto text-slate-500 hover:text-slate-700" onClick={() => setProbe(null)}>
                <X size={13} />
              </button>
            </div>
          ) : null}

          <div className={`${PANEL} overflow-hidden`}>
            <MapContainer center={DEFAULT_CENTER} zoom={11} scrollWheelZoom className="h-[560px] w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFocus stores={mappedStores} focus={selected} radiusKm={previewRadiusKm} />
              <MapClick onPick={onMapPick} />

              {mappedStores.map((store) => {
                const isSelected = store.id === selectedId;
                const mode = isSelected ? draft.coverageMode : store.coverageMode;
                const color = !store.isActive ? MUTED_COLOR : mode === 'pincode' ? PINCODE_COLOR : RADIUS_COLOR;
                const radiusKm = isSelected ? previewRadiusKm : store.deliveryRadiusKm;
                return (
                  <Fragment key={store.id}>
                    {mode === 'radius' && radiusKm ? (
                      <Circle
                        center={[store.latitude, store.longitude]}
                        radius={radiusKm * 1000}
                        pathOptions={{
                          color,
                          weight: isSelected ? 2.5 : 1,
                          fillOpacity: isSelected ? 0.15 : 0.06,
                          dashArray: store.isActive ? undefined : '4 4',
                        }}
                        eventHandlers={{ click: () => selectStore(store) }}
                      />
                    ) : null}
                    <CircleMarker
                      center={[store.latitude, store.longitude]}
                      radius={isSelected ? 9 : 7}
                      pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }}
                      eventHandlers={{ click: () => selectStore(store) }}
                    >
                      <Tooltip direction="top" offset={[0, -6]}>
                        <div className="text-xs">
                          <p className="font-semibold">{store.storeName}</p>
                          <p>
                            {mode === 'pincode'
                              ? `Pincodes: ${store.servicePincodes.slice(0, 8).join(', ') || '—'}${store.servicePincodes.length > 8 ? '…' : ''}`
                              : `Radius: ${radiusKm ?? store.deliveryRadiusKm} km`}
                          </p>
                          {!store.isActive ? <p className="text-slate-500">Inactive</p> : null}
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  </Fragment>
                );
              })}

              {probe?.point ? (
                <CircleMarker
                  center={probe.point}
                  radius={6}
                  pathOptions={{ color: '#0f172a', weight: 2, fillColor: probe.served ? '#22c55e' : '#ef4444', fillOpacity: 1 }}
                />
              ) : null}
            </MapContainer>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: RADIUS_COLOR }} /> Radius coverage
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PINCODE_COLOR }} /> Pincode coverage
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: MUTED_COLOR }} /> Inactive store
            </span>
            {unmappedCount ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <MapPin size={11} /> {unmappedCount} store{unmappedCount === 1 ? '' : 's'} without a map location
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
