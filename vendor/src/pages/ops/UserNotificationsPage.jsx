import { Link, useParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Send,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import apiClient from '../../api/client';
import { BTN, BTN_PRIMARY, INPUT, PAGE_SUB, PAGE_TITLE, PANEL, PANEL_HEAD, TD, TH } from '../../utils/ui';

const TITLE_MAX = 200;
const BODY_MAX = 1000;

const LINK_TARGETS = [
  { value: 'none', label: 'Just open the app' },
  { value: 'home', label: 'Home screen' },
  { value: 'hot_selling', label: 'Hot selling products' },
  { value: 'product', label: 'A specific product' },
];

const EMPTY_FORM = {
  title: '',
  body: '',
  imageUrl: '',
  linkTarget: 'none',
  productId: '',
  timing: 'now',
  scheduleAt: '',
};

/** `datetime-local` value for a Date, in the admin's own timezone. */
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function normalizeType(type) {
  return String(type || '').toLowerCase() === 'bulk' ? 'bulk' : 'retail';
}

function accountLabel(type) {
  return type === 'bulk' ? 'Bulk user' : 'Normal user';
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className={`${PANEL} flex items-center gap-3 px-4 py-3`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#217346]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function PhonePreview({ title, body, imageUrl }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Preview on phone</p>
      <div className="rounded-xl bg-white/95 p-3 shadow">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="flex h-4 w-4 items-center justify-center rounded bg-emerald-600 text-[9px] font-bold text-white">G</span>
          GreenGrocc · now
        </div>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">{title || 'Notification title'}</p>
        <p className="mt-0.5 whitespace-pre-line text-[13px] leading-snug text-slate-600">
          {body || 'Your message will appear here.'}
        </p>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="mt-2 max-h-40 w-full rounded-lg object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function UserNotificationsPage() {
  const { accountType: rawType } = useParams();
  const accountType = normalizeType(rawType);
  const label = accountLabel(accountType);

  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [cancellingId, setCancellingId] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const loadMeta = useCallback(async () => {
    const params = { accountType };
    const [statsRes, historyRes, scheduledRes] = await Promise.allSettled([
      apiClient.get('/admin/notifications/promotional/audience', { params }),
      apiClient.get('/admin/notifications/promotional/history', { params: { ...params, limit: 20 } }),
      apiClient.get('/admin/notifications/promotional/scheduled', { params }),
    ]);
    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data?.data || null);
    if (historyRes.status === 'fulfilled') setHistory(historyRes.value.data?.data || []);
    if (scheduledRes.status === 'fulfilled') setScheduled(scheduledRes.value.data?.data || []);
    setHistoryLoading(false);
  }, [accountType]);

  useEffect(() => {
    setForm(EMPTY_FORM);
    setResult(null);
    setError('');
    setHistoryLoading(true);
    loadMeta();
  }, [loadMeta]);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const title = form.title.trim();
    const body = form.body.trim();
    if (!title) {
      setError('Title is required.');
      return;
    }
    if (form.linkTarget === 'product' && !form.productId.trim()) {
      setError('Enter the product ID to open when the notification is tapped.');
      return;
    }

    let scheduleAt = null;
    if (form.timing === 'schedule') {
      const when = new Date(form.scheduleAt);
      if (!form.scheduleAt || Number.isNaN(when.getTime())) {
        setError('Pick the date and time to send.');
        return;
      }
      if (when.getTime() - Date.now() < 60 * 1000) {
        setError('Scheduled time must be at least 1 minute from now.');
        return;
      }
      scheduleAt = when.toISOString();
    }

    const audienceCount = stats?.totalUsers ?? 0;
    const who = `${audienceCount} ${label.toLowerCase()}${audienceCount === 1 ? '' : 's'}`;
    const confirmed = window.confirm(
      scheduleAt
        ? `Schedule "${title}" for ${who} on ${formatDateTime(scheduleAt)}?`
        : `Send "${title}" to ${who} now?`
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const { data } = await apiClient.post(
        '/admin/notifications/promotional/send',
        {
          accountType,
          title,
          body,
          imageUrl: form.imageUrl.trim(),
          linkTarget: form.linkTarget,
          productId: form.linkTarget === 'product' ? form.productId.trim() : '',
          ...(scheduleAt ? { scheduleAt } : {}),
        },
        { timeout: 120000 }
      );
      setResult(data?.data || {});
      setForm(EMPTY_FORM);
      loadMeta();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleCancelScheduled = async (item) => {
    if (!window.confirm(`Cancel the scheduled notification "${item.title}"?`)) return;
    setCancellingId(item.id);
    try {
      await apiClient.delete(`/admin/notifications/promotional/scheduled/${item.id}`);
      setScheduled((prev) => prev.filter((s) => s.id !== item.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel scheduled notification');
    } finally {
      setCancellingId('');
    }
  };

  const setTiming = (timing) =>
    setForm((prev) => ({
      ...prev,
      timing,
      scheduleAt:
        timing === 'schedule' && !prev.scheduleAt
          ? toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000))
          : prev.scheduleAt,
    }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
            <Link to="/user-management" className="font-medium text-slate-600 hover:text-emerald-700">
              User management
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <Link to={`/user-management/${accountType}`} className="font-medium text-slate-600 hover:text-emerald-700">
              {label}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="font-semibold text-slate-800">Notifications</span>
          </nav>
          <h1 className={PAGE_TITLE}>{label} notifications</h1>
          <p className={PAGE_SUB}>
            Push notification to every {label.toLowerCase()}&apos;s phone, even when the app is closed, and saved in
            their in-app notification list. Send instantly or schedule it for a date and time.
          </p>
        </div>
        <Link to={`/user-management/${accountType}`} className={BTN}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={`${label}s`} value={stats?.totalUsers} icon={Users} />
        <StatCard label="Push enabled phones" value={stats?.pushEnabledUsers} icon={Smartphone} />
        <StatCard label="In-app only" value={stats?.inAppOnlyUsers} icon={BellRing} />
      </div>

      {result?.scheduled ? (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Notification scheduled</p>
            <p className="mt-0.5">
              &ldquo;{result.item?.title}&rdquo; will be sent to {label.toLowerCase()}s on{' '}
              {formatDateTime(result.item?.sendAt)}.
            </p>
          </div>
        </div>
      ) : result ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Notification sent</p>
            <p className="mt-0.5">
              Delivered to {result.pushDelivered ?? 0} phone{result.pushDelivered === 1 ? '' : 's'} · saved in-app for{' '}
              {result.inAppSaved ?? 0} user{result.inAppSaved === 1 ? '' : 's'}
              {result.noToken ? ` · ${result.noToken} without the app / notifications off` : ''}
              {result.pushFailed ? ` · ${result.pushFailed} failed` : ''}
            </p>
            {result.error ? <p className="mt-0.5 text-amber-700">{result.error}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit} className={`${PANEL} space-y-4 p-5`}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
            <input
              className={INPUT}
              value={form.title}
              maxLength={TITLE_MAX}
              onChange={update('title')}
              placeholder="e.g. Fresh mangoes are here 🥭"
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">
              {form.title.length}/{TITLE_MAX}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Message <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              className={`${INPUT} min-h-28 resize-y`}
              value={form.body}
              maxLength={BODY_MAX}
              onChange={update('body')}
              placeholder="e.g. Get 20% off on Alphonso mangoes today only."
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">
              {form.body.length}/{BODY_MAX}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Image URL <span className="font-normal text-slate-400">(optional, https)</span>
            </label>
            <input
              className={INPUT}
              value={form.imageUrl}
              onChange={update('imageUrl')}
              placeholder="https://…/banner.jpg"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">When tapped, open</label>
              <select className={INPUT} value={form.linkTarget} onChange={update('linkTarget')}>
                {LINK_TARGETS.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
            </div>
            {form.linkTarget === 'product' ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Product ID</label>
                <input
                  className={INPUT}
                  value={form.productId}
                  onChange={update('productId')}
                  placeholder="Product _id from the Products page"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">When to send</label>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: 'now', label: 'Send instantly', icon: Send },
                { value: 'schedule', label: 'Schedule for later', icon: CalendarClock },
              ].map((option) => {
                const Icon = option.icon;
                const active = form.timing === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTiming(option.value)}
                    className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="mr-1.5 h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
              {form.timing === 'schedule' ? (
                <input
                  type="datetime-local"
                  className={`${INPUT} w-auto`}
                  value={form.scheduleAt}
                  min={toLocalInputValue(new Date(Date.now() + 60 * 1000))}
                  onChange={update('scheduleAt')}
                />
              ) : null}
            </div>
          </div>

          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div className="flex justify-end">
            <button type="submit" className={BTN_PRIMARY} disabled={sending}>
              {sending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : form.timing === 'schedule' ? (
                <CalendarClock className="mr-1.5 h-4 w-4" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              {sending
                ? form.timing === 'schedule'
                  ? 'Scheduling…'
                  : 'Sending…'
                : form.timing === 'schedule'
                  ? 'Schedule notification'
                  : `Send now to ${label.toLowerCase()}s`}
            </button>
          </div>
        </form>

        <PhonePreview title={form.title.trim()} body={form.body.trim()} imageUrl={form.imageUrl.trim()} />
      </div>

      {scheduled.length ? (
        <div className={PANEL}>
          <div className={PANEL_HEAD}>Scheduled for {label.toLowerCase()}s</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className={TH}>Send at</th>
                  <th className={TH}>Title</th>
                  <th className={TH}>Message</th>
                  <th className={TH}>Status</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduled.map((item) => (
                  <tr key={item.id}>
                    <td className={`${TD} whitespace-nowrap`}>{formatDateTime(item.sendAt)}</td>
                    <td className={`${TD} font-medium text-slate-900`}>{item.title}</td>
                    <td className={`${TD} max-w-md truncate`} title={item.body}>
                      {item.body || '—'}
                    </td>
                    <td className={TD}>
                      {item.status === 'failed' ? (
                        <span className="text-red-600" title={item.error}>
                          Failed
                        </span>
                      ) : item.status === 'sending' ? (
                        'Sending…'
                      ) : (
                        'Scheduled'
                      )}
                    </td>
                    <td className={`${TD} text-right`}>
                      {item.status !== 'sending' ? (
                        <button
                          type="button"
                          className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          disabled={cancellingId === item.id}
                          onClick={() => handleCancelScheduled(item)}
                        >
                          <X className="mr-1 h-4 w-4" />
                          {item.status === 'failed' ? 'Dismiss' : 'Cancel'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className={PANEL}>
        <div className={PANEL_HEAD}>Recently sent to {label.toLowerCase()}s</div>
        {historyLoading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No notifications sent to {label.toLowerCase()}s yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className={TH}>Sent</th>
                  <th className={TH}>Title</th>
                  <th className={TH}>Message</th>
                  <th className={TH}>Opens</th>
                  <th className={TH}>Users</th>
                  <th className={TH}>Push delivered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => (
                  <tr key={`${item.createdAt}-${item.title}`}>
                    <td className={`${TD} whitespace-nowrap`}>{formatDateTime(item.createdAt)}</td>
                    <td className={`${TD} font-medium text-slate-900`}>{item.title}</td>
                    <td className={`${TD} max-w-md truncate`} title={item.body}>
                      {item.body}
                    </td>
                    <td className={TD}>
                      {LINK_TARGETS.find((t) => t.value === item.linkTarget)?.label || 'Just open the app'}
                    </td>
                    <td className={TD}>{item.recipients}</td>
                    <td className={TD}>{item.pushDelivered}</td>
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
