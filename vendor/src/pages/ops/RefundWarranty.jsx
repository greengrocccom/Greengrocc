import { Link, useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeType(type) {
  return String(type || '').toLowerCase() === 'bulk' ? 'bulk' : 'retail';
}

function typeLabel(type) {
  return normalizeType(type) === 'bulk' ? 'Bulk user' : 'Normal user';
}

function statusTone(status) {
  if (status === 'accepted') return 'bg-sky-50 text-sky-700';
  if (status === 'rejected') return 'bg-rose-50 text-rose-700';
  if (status === 'successful') return 'bg-emerald-50 text-[#217346]';
  return 'bg-amber-50 text-amber-700';
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
              <Link to={item.to} className="font-medium text-slate-600 hover:text-emerald-700">
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

/** Step 1 — Normal / Bulk */
export function RefundWarrantyTypePage() {
  return (
    <div className="space-y-5">
      <div>
        <p className={PAGE_KICKER}>Promotions</p>
        <h1 className={PAGE_TITLE}>Return & warranty</h1>
        <p className={PAGE_SUB}>
          Choose user type, review requests by date, then accept or reject. Accepted requests go to the
          delivery manager for pickup.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            type: 'retail',
            title: 'Normal user',
            description: 'Retail customers requesting refund or warranty pickup.',
            icon: UserRound,
          },
          {
            type: 'bulk',
            title: 'Bulk user',
            description: 'B2B / wholesale return and warranty requests.',
            icon: Package,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.type}
              to={`/refund-warranty/${card.type}`}
              className={`${PANEL} group flex flex-col gap-4 p-5 transition hover:border-emerald-300 hover:shadow-md`}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#217346]">
                  <Icon className="h-6 w-6" />
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{card.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{card.description}</p>
              </div>
              <span className="text-sm font-semibold text-[#217346]">View requests →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const emptyCreate = {
  type: 'refund',
  orderNumber: '',
  customerName: '',
  customerPhone: '',
  amount: '',
  reason: '',
  adminNote: '',
};

/** Step 2 — Date-wise request list + status actions */
export function RefundWarrantyListPage() {
  const { accountType: rawType } = useParams();
  const accountType = normalizeType(rawType);
  const navigate = useNavigate();

  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyCreate);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        accountType,
        search: q.trim() || undefined,
        status: status === 'all' ? undefined : status,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      Object.keys(params).forEach((k) => params[k] == null && delete params[k]);
      const res = await opsApi.list('refunds', params);
      setClaims(res.data || []);
      setStats(res.stats || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const claim of claims) {
      const day = claim.createdAt
        ? new Date(claim.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : 'Unknown date';
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(claim);
    }
    return [...map.entries()];
  }, [claims]);

  const setClaimStatus = async (id, nextStatus) => {
    setBusyId(id);
    setError('');
    try {
      await opsApi.update('refunds', id, { status: nextStatus });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || `Could not mark as ${nextStatus}`);
    } finally {
      setBusyId('');
    }
  };

  const createClaim = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await opsApi.create('refunds', {
        ...form,
        accountType,
        amount: Number(form.amount) || 0,
      });
      setForm(emptyCreate);
      setShowCreate(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not create request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: 'Return & warranty', to: '/refund-warranty' },
              { label: typeLabel(accountType) },
            ]}
          />
          <h1 className={PAGE_TITLE}>{typeLabel(accountType)} requests</h1>
          <p className={PAGE_SUB}>
            Accept sends the request to the dark-store delivery manager for manual return pickup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={() => navigate('/refund-warranty')}>
            Back
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New request
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total', value: stats?.total ?? claims.length },
          { label: 'Pending', value: stats?.pending ?? 0 },
          { label: 'Accepted', value: stats?.accepted ?? 0 },
          { label: 'Rejected', value: stats?.rejected ?? 0 },
          { label: 'Successful', value: stats?.successful ?? 0 },
        ].map((card) => (
          <div key={card.label} className={`${PANEL} px-4 py-3`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {showCreate ? (
        <form onSubmit={createClaim} className={`${PANEL} space-y-3 p-4`}>
          <h2 className="text-base font-bold text-slate-900">Create return / warranty request</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Type</label>
              <select
                className={INPUT}
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="refund">Return / Refund</option>
                <option value="warranty">Warranty</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Order number *</label>
              <input
                className={INPUT}
                required
                value={form.orderNumber}
                onChange={(e) => setForm((p) => ({ ...p, orderNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Customer name</label>
              <input
                className={INPUT}
                value={form.customerName}
                onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Phone</label>
              <input
                className={INPUT}
                value={form.customerPhone}
                onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Amount (₹)</label>
              <input
                type="number"
                className={INPUT}
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Reason *</label>
              <textarea
                className={`${INPUT} min-h-[72px]`}
                required
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
          </div>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="flex gap-2">
            <button type="submit" className={BTN_PRIMARY} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Create pending request
            </button>
            <button type="button" className={BTN} onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className={`${PANEL} flex flex-wrap items-end gap-3 p-4`}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${INPUT} pl-9`}
            placeholder="Search order, name, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <div className="w-40">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
          <select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="successful">Successful</option>
          </select>
        </div>
        <div className="w-40">
          <label className="mb-1 block text-xs font-semibold text-slate-500">From</label>
          <input type="date" className={INPUT} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="w-40">
          <label className="mb-1 block text-xs font-semibold text-slate-500">To</label>
          <input type="date" className={INPUT} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={load}>
          Apply
        </button>
      </div>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
        </div>
      ) : grouped.length === 0 ? (
        <div className={`${PANEL} px-6 py-14 text-center`}>
          <RotateCcw className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-800">No requests</p>
          <p className="mt-1 text-sm text-slate-500">Create a request or adjust filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, rows]) => (
            <div key={day} className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">{day}</h3>
              <div className={`${PANEL} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="border-b border-slate-100 bg-slate-50/80">
                      <tr>
                        <th className={TH}>Order</th>
                        <th className={TH}>Customer</th>
                        <th className={TH}>Type</th>
                        <th className={TH}>Amount</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Return flow</th>
                        <th className={TH}>Time</th>
                        <th className={TH}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id || row._id} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-3">
                            <div className="flex items-start gap-2.5">
                              {row.productImage ? (
                                <a
                                  href={row.productImage}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                >
                                  <img
                                    src={row.productImage}
                                    alt="Return product"
                                    className="h-11 w-11 object-cover"
                                  />
                                </a>
                              ) : null}
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">{row.orderNumber || '—'}</p>
                                <p className="text-xs text-slate-500 line-clamp-1">{row.reason}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            <p>{row.customerName || '—'}</p>
                            <p className="text-xs text-slate-500">{row.customerPhone}</p>
                          </td>
                          <td className="px-3 py-3 text-sm capitalize text-slate-700">{row.type}</td>
                          <td className="px-3 py-3 text-sm font-medium">{money(row.amount)}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {row.returnStatus ? (
                              <span className="capitalize">{String(row.returnStatus).replaceAll('_', ' ')}</span>
                            ) : (
                              '—'
                            )}
                            {row.storeName ? <p className="text-slate-400">{row.storeName}</p> : null}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600">{formatDateTime(row.createdAt)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {row.status === 'pending' ? (
                                <>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                    disabled={busyId === (row.id || row._id)}
                                    onClick={() => setClaimStatus(row.id || row._id, 'accepted')}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                    disabled={busyId === (row.id || row._id)}
                                    onClick={() => setClaimStatus(row.id || row._id, 'rejected')}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Reject
                                  </button>
                                </>
                              ) : null}
                              {row.status === 'accepted' || row.status === 'rejected' ? (
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                                  disabled={busyId === (row.id || row._id)}
                                  onClick={() => setClaimStatus(row.id || row._id, 'pending')}
                                >
                                  Set pending
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RefundWarranty() {
  return <RefundWarrantyTypePage />;
}
