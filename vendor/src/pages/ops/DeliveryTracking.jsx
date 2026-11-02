import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MapPinned, RefreshCw } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { useLive } from '../../realtime/useLive';
import { BTN, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';

function statusTone(status) {
  const v = String(status || '').toLowerCase();
  if (['online', 'available', 'active', 'idle'].includes(v)) return 'green';
  if (['on_delivery', 'busy', 'assigned'].includes(v)) return 'amber';
  if (['offline', 'inactive', 'blocked'].includes(v)) return 'slate';
  return 'slate';
}

function Pill({ children, tone = 'slate' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ring-1 ring-inset ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

export default function DeliveryTracking() {
  const [riders, setRiders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await opsApi.list('tracking');
      setRiders(res.data || []);
      setStats(res.stats || null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tracking');
    } finally {
      setLoading(false);
    }
  };

  useLive(load, []);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={PAGE_KICKER}>Operations</p>
          <h1 className={PAGE_TITLE}>Delivery Tracking</h1>
          <p className={PAGE_SUB}>
            Live rider status and last known GPS location. Updates instantly as riders move or change status.
          </p>
          <Link
            to="/delivery-team"
            className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
          >
            Open full team profiles →
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

      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className={`${PANEL} px-4 py-3`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {key.replaceAll('_', ' ')}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className={`${PANEL} flex justify-center py-16 text-slate-400`}>
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : riders.length === 0 ? (
        <div className={`${PANEL} px-6 py-14 text-center`}>
          <MapPinned className="mx-auto h-10 w-10 text-emerald-600/30" />
          <p className="mt-3 text-sm font-semibold text-slate-800">No riders to track yet</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {riders.map((rider) => {
            const lat = rider.currentLocation?.lat;
            const lng = rider.currentLocation?.lng;
            const maps =
              Number.isFinite(lat) && Number.isFinite(lng)
                ? `https://www.google.com/maps?q=${lat},${lng}`
                : '';
            return (
              <article key={rider.id || rider._id} className={`${PANEL} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/delivery-team/boys/${rider.id || rider._id}`}
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      {rider.name || rider.phone}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[rider.area, rider.city].filter(Boolean).join(', ') || 'No area'}
                      {rider.manager?.storeName ? ` · ${rider.manager.storeName}` : ''}
                    </p>
                  </div>
                  <Pill tone={statusTone(rider.status)}>{String(rider.status || '—')}</Pill>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {maps
                    ? `Last ping: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
                    : 'No live location yet'}
                </p>
                <p className="text-xs text-slate-400">
                  Today {rider.todayCompletedOrders || 0} delivered · KYC{' '}
                  {rider.verificationStatus || '—'}
                </p>
                {maps ? (
                  <a
                    href={maps}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Open map
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
