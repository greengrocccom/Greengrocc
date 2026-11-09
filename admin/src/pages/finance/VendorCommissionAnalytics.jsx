import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  ChevronDown,
  ChevronRight,
  Gauge,
  IndianRupee,
  Layers,
  Loader2,
  MapPin,
  Percent,
  PieChart as PieIcon,
  Store,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import adminFinanceApi from '../../api/adminFinanceApi';

const C = {
  emerald: '#059669',
  indigo: '#4f46e5',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  rose: '#e11d48',
  violet: '#7c3aed',
  slate: '#94a3b8',
  teal: '#0d9488',
};
const ZONE_PALETTE = ['#4f46e5', '#059669', '#0ea5e9', '#f59e0b', '#7c3aed', '#e11d48', '#0d9488', '#ea580c', '#64748b', '#db2777'];
const STATUS_COLORS = { Paid: C.emerald, 'Partially Paid': C.sky, Pending: C.amber };
const BAND_COLORS = ['#cbd5e1', '#93c5fd', '#6366f1', '#7c3aed', '#4c1d95'];
const TOOLTIP_STYLE = { backgroundColor: '#0f172a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 };
const TOOLTIP_LABEL = { color: '#cbd5e1', fontWeight: 600, marginBottom: 4 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const inr = (v) => `₹${Math.round(Number(v || 0)).toLocaleString('en-IN')}`;
function inrCompact(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `₹${Math.round(n)}`;
}
const pctText = (v, digits = 1) => `${Number(v || 0).toFixed(digits)}%`;
function periodLabel(key, unit) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  return unit === 'month' ? `${MONTHS[Number(m) - 1]} ${y.slice(2)}` : `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}
const shortName = (name, max = 18) => (name && name.length > max ? `${name.slice(0, max - 1)}…` : name || '—');

function Panel({ title, subtitle, icon: Icon, right, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-2xs ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-start gap-2.5">
          {Icon ? (
            <span className="mt-0.5 rounded-lg bg-slate-100 p-1.5 text-slate-600">
              <Icon className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {subtitle ? <p className="text-[11px] text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ text = 'No data for this period' }) {
  return <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-slate-400">{text}</div>;
}

function Kpi({ label, value, sub, icon: Icon, tone = 'slate', progress }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    sky: 'bg-sky-100 text-sky-700',
    violet: 'bg-violet-100 text-violet-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`rounded-lg p-1.5 ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 text-xl font-black tracking-tight text-slate-900">{value}</div>
      {progress != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
      {sub ? <p className="mt-1.5 text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function MiniBar({ value, color = C.indigo }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold text-slate-700">{pctText(value)}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const cls =
    status === 'Paid'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'Partially Paid'
        ? 'bg-sky-100 text-sky-800'
        : 'bg-amber-100 text-amber-800';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{status}</span>;
}

export default function VendorCommissionAnalytics({ preset, startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openZone, setOpenZone] = useState('');
  const [leaderSort, setLeaderSort] = useState('commission');

  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (preset && preset !== 'custom') params.preset = preset;
    if (preset === 'custom') {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    }
    setLoading(true);
    setError('');
    adminFinanceApi
      .getCommissionAnalytics(params)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err?.response?.data?.message || err?.message || 'Failed to load analytics'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [preset, startDate, endDate]);

  const view = useMemo(() => {
    if (!data) return null;
    const vendors = data.vendors || [];
    const zones = (data.zones || []).filter((z) => z.stores > 0 || z.commission > 0);
    const unit = data.period?.unit || 'month';
    return {
      unit,
      trend: (data.trend || []).map((p) => ({ ...p, label: periodLabel(p.period, unit) })),
      topByRate: [...vendors]
        .sort((a, b) => b.commissionRate - a.commissionRate || b.commission - a.commission)
        .slice(0, 10)
        .map((v) => ({ ...v, short: shortName(v.vendorName) })),
      topByCommission: vendors
        .filter((v) => v.commission > 0)
        .slice(0, 10)
        .map((v) => ({ ...v, short: shortName(v.vendorName) })),
      zones,
      zoneChart: zones.map((z) => ({ ...z, short: shortName(z.zoneName, 16) })),
      zonePie: zones.filter((z) => z.commission > 0),
      statusPie: (data.statusBreakdown || []).filter((s) => s.vendors > 0),
      typePie: (data.typeBreakdown || []).filter((t) => t.vendors > 0),
      leaderboard: [...vendors].sort((a, b) => {
        if (leaderSort === 'rate') return b.commissionRate - a.commissionRate || b.commission - a.commission;
        if (leaderSort === 'pending') return b.pending - a.pending;
        if (leaderSort === 'collection') return a.collectionRate - b.collectionRate;
        return b.commission - a.commission;
      }),
    };
  }, [data, leaderSort]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Building commission analytics…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" /> {error}
      </div>
    );
  }
  if (!data || !view) return null;

  const k = data.kpis || {};
  const hasTrend = view.trend.some((p) => p.sales || p.commission || p.received);

  return (
    <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Commission earned"
          value={inr(k.totalCommission)}
          sub={`On ${inr(k.eligibleSales)} eligible sales · ${Number(k.orders || 0).toLocaleString('en-IN')} orders`}
          icon={IndianRupee}
          tone="indigo"
        />
        <Kpi
          label="Effective commission rate"
          value={pctText(k.effectiveRate, 2)}
          sub={`Avg ${pctText(k.averageRate)} · Median ${pctText(k.medianRate)} · Range ${pctText(k.lowestRate, 0)}–${pctText(k.highestRate, 0)}`}
          icon={Percent}
          tone="violet"
        />
        <Kpi
          label="Collection efficiency"
          value={pctText(k.collectionRate)}
          sub={`${inr(k.received)} received of ${inr(k.totalCommission)}`}
          icon={Gauge}
          tone="emerald"
          progress={k.collectionRate}
        />
        <Kpi
          label="Pending receivable"
          value={inr(k.pending)}
          sub={`${k.vendorsWithPending || 0} vendor${k.vendorsWithPending === 1 ? '' : 's'} with an open balance`}
          icon={Wallet}
          tone="amber"
        />
        <Kpi
          label="Earning vendors"
          value={`${k.vendorsWithSales || 0} / ${k.totalVendors || 0}`}
          sub="Vendors with eligible sales this period"
          icon={Users}
          tone="sky"
        />
        <Kpi
          label="Zones covered"
          value={`${k.zonesWithStores || 0} / ${k.totalZones || 0}`}
          sub={`${k.darkStores || 0} dark store${k.darkStores === 1 ? '' : 's'} linked to vendors`}
          icon={MapPin}
          tone="emerald"
        />
        <Kpi
          label="Top vendor share"
          value={pctText(k.topVendorShare)}
          sub={view.topByCommission[0] ? `${view.topByCommission[0].vendorName}` : 'No commission yet'}
          icon={Award}
          tone="indigo"
        />
        <Kpi
          label="Top 5 concentration"
          value={pctText(k.top5Share)}
          sub="Share of commission from the 5 biggest vendors"
          icon={Target}
          tone="slate"
          progress={k.top5Share}
        />
      </div>

      {/* Trend + status */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Commission trend"
          subtitle={`Eligible sales, commission earned and commission received · by ${view.unit}`}
          icon={TrendingUp}
        >
          <div className="h-72">
            {hasTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={view.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.emerald} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis yAxisId="sales" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={inrCompact} axisLine={false} tickLine={false} width={56} />
                  <YAxis yAxisId="comm" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={inrCompact} axisLine={false} tickLine={false} width={56} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={(v, name) => [inr(v), name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Area yAxisId="sales" type="monotone" dataKey="sales" name="Eligible sales" stroke={C.emerald} strokeWidth={1.5} fill="url(#salesGrad)" />
                  <Bar yAxisId="comm" dataKey="commission" name="Commission earned" fill={C.indigo} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line yAxisId="comm" type="monotone" dataKey="received" name="Commission received" stroke={C.sky} strokeWidth={2.5} dot={{ r: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </div>
        </Panel>

        <Panel title="Collection status" subtitle="Vendors by settlement status" icon={PieIcon}>
          {view.statusPie.length ? (
            <>
              <div className="relative h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={view.statusPie} dataKey="vendors" nameKey="status" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                      {view.statusPie.map((s) => (
                        <Cell key={s.status} fill={STATUS_COLORS[s.status]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v} vendor${v === 1 ? '' : 's'}`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-slate-900">{pctText(k.collectionRate, 0)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">collected</span>
                </div>
              </div>
              <ul className="mt-2 space-y-2">
                {(data.statusBreakdown || []).map((s) => (
                  <li key={s.status} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />
                      {s.status} · {s.vendors}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {s.status === 'Paid' ? inr(s.commission) : `${inr(s.pending)} due`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty text="No vendors yet" />
          )}
        </Panel>
      </div>

      {/* Top vendors */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Top vendors by commission %" subtitle="Highest agreed commission rates" icon={Percent}>
          <div className="h-80">
            {view.topByRate.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.topByRate} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} domain={[0, 'dataMax']} />
                  <YAxis type="category" dataKey="short" tick={{ fontSize: 11, fill: '#334155' }} width={130} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL}
                    labelFormatter={(_, p) => p?.[0]?.payload?.vendorName || ''}
                    formatter={(v, _n, p) => [`${v}% · earned ${inr(p.payload.commission)}`, 'Commission rate']}
                  />
                  <Bar dataKey="commissionRate" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {view.topByRate.map((v, i) => (
                      <Cell key={v.vendorId} fill={i === 0 ? C.violet : '#a78bfa'} />
                    ))}
                    <LabelList dataKey="commissionRate" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="No vendors yet" />
            )}
          </div>
        </Panel>

        <Panel title="Top vendors by commission earned" subtitle="Label shows each vendor's share of total commission" icon={Award}>
          <div className="h-80">
            {view.topByCommission.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.topByCommission} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={inrCompact} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="short" tick={{ fontSize: 11, fill: '#334155' }} width={130} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL}
                    labelFormatter={(_, p) => p?.[0]?.payload?.vendorName || ''}
                    formatter={(v, _n, p) => [
                      `${inr(v)} · ${pctText(p.payload.shareOfCommission)} share · rate ${p.payload.commissionRate}%`,
                      'Commission',
                    ]}
                  />
                  <Bar dataKey="commission" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {view.topByCommission.map((v, i) => (
                      <Cell key={v.vendorId} fill={i < 3 ? C.indigo : '#818cf8'} />
                    ))}
                    <LabelList dataKey="shareOfCommission" position="right" formatter={(v) => pctText(v)} style={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="No commission earned in this period" />
            )}
          </div>
        </Panel>
      </div>

      {/* Zone-wise */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Zone-wise commission"
          subtitle="Commission from each zone's dark stores, with the effective commission rate"
          icon={Layers}
        >
          <div className="h-72">
            {view.zoneChart.some((z) => z.commission > 0 || z.sales > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={view.zoneChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis yAxisId="amt" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={inrCompact} axisLine={false} tickLine={false} width={56} />
                  <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL}
                    labelFormatter={(_, p) => p?.[0]?.payload?.zoneName || ''}
                    formatter={(v, name) => [name === 'Effective rate' ? pctText(v, 2) : inr(v), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Bar yAxisId="amt" dataKey="sales" name="Eligible sales" fill="#c7d2fe" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar yAxisId="amt" dataKey="commission" name="Commission" fill={C.indigo} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Line yAxisId="rate" type="monotone" dataKey="effectiveRate" name="Effective rate" stroke={C.amber} strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="No zone sales in this period" />
            )}
          </div>
        </Panel>

        <Panel title="Commission share by zone" subtitle="Where admin commission comes from" icon={MapPin}>
          {view.zonePie.length ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={view.zonePie} dataKey="commission" nameKey="zoneName" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                      {view.zonePie.map((z, i) => (
                        <Cell key={z.zoneKey} fill={ZONE_PALETTE[i % ZONE_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n, p) => [`${inr(v)} · ${pctText(p.payload.shareOfCommission)}`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto pr-1">
                {view.zonePie.map((z, i) => (
                  <li key={z.zoneKey} className="flex items-center justify-between text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ZONE_PALETTE[i % ZONE_PALETTE.length] }} />
                      <span className="truncate">{z.zoneName}</span>
                    </span>
                    <span className="font-semibold text-slate-800">{pctText(z.shareOfCommission)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty text="No zone commission yet" />
          )}
        </Panel>
      </div>

      <Panel
        title="Zone details"
        subtitle="Vendors, dark stores and commission per zone · expand a zone to see its vendors"
        icon={MapPin}
      >
        {view.zones.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Zone</th>
                  <th className="px-3 py-2 text-center">Vendors</th>
                  <th className="px-3 py-2 text-center">Dark stores</th>
                  <th className="px-3 py-2 text-right">Orders</th>
                  <th className="px-3 py-2 text-right">Eligible sales</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2 text-center">Effective rate</th>
                  <th className="px-3 py-2">Share of total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view.zones.map((z, i) => {
                  const open = openZone === z.zoneKey;
                  return (
                    <Fragment key={z.zoneKey}>
                      <tr
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setOpenZone(open ? '' : z.zoneKey)}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ZONE_PALETTE[i % ZONE_PALETTE.length] }} />
                            <span className="font-semibold text-slate-900">{z.zoneName}</span>
                            {z.state ? <span className="text-[11px] text-slate-400">{z.state}</span> : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{z.vendorCount}</td>
                        <td className="px-3 py-2.5 text-center text-slate-700">
                          {z.stores}
                          {z.activeStores !== z.stores ? <span className="text-[10px] text-slate-400"> ({z.activeStores} active)</span> : null}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{z.orders.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{inr(z.sales)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">{inr(z.commission)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-800">
                            {pctText(z.effectiveRate, 2)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <MiniBar value={z.shareOfCommission} color={ZONE_PALETTE[i % ZONE_PALETTE.length]} />
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-slate-50/70">
                          <td colSpan={8} className="px-3 py-3">
                            {z.vendors.length ? (
                              <table className="w-full text-[11px]">
                                <thead className="text-[10px] font-bold uppercase text-slate-400">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Vendor in {z.zoneName}</th>
                                    <th className="px-2 py-1 text-center">Rate</th>
                                    <th className="px-2 py-1 text-center">Stores</th>
                                    <th className="px-2 py-1 text-right">Orders</th>
                                    <th className="px-2 py-1 text-right">Sales</th>
                                    <th className="px-2 py-1 text-right">Commission</th>
                                    <th className="px-2 py-1">Share of zone</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {z.vendors.map((v) => (
                                    <tr key={v.vendorId} className="border-t border-slate-200/70">
                                      <td className="px-2 py-1.5">
                                        <Link to={`/finance/commissions/${v.vendorId}`} className="font-semibold text-slate-800 hover:text-emerald-700 hover:underline">
                                          {v.vendorName}
                                        </Link>
                                      </td>
                                      <td className="px-2 py-1.5 text-center font-bold text-indigo-700">{v.commissionRate}%</td>
                                      <td className="px-2 py-1.5 text-center">{v.stores}</td>
                                      <td className="px-2 py-1.5 text-right">{v.orders.toLocaleString('en-IN')}</td>
                                      <td className="px-2 py-1.5 text-right">{inr(v.sales)}</td>
                                      <td className="px-2 py-1.5 text-right font-bold text-slate-900">{inr(v.commission)}</td>
                                      <td className="px-2 py-1.5">
                                        <MiniBar value={v.shareOfZone} />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-[11px] text-slate-500">No vendor dark stores in this zone yet.</p>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No approved zones or vendor dark stores yet" />
        )}
      </Panel>

      {/* Distributions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Commission rate distribution" subtitle="How many vendors sit in each rate band" icon={Percent}>
          <div className="h-56">
            {(data.rateBands || []).some((b) => b.vendors > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.rateBands} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(b) => `${b}%`} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL}
                    labelFormatter={(_, p) => p?.[0]?.payload?.label || ''}
                    formatter={(v, _n, p) => [`${v} vendor${v === 1 ? '' : 's'} · ${inr(p.payload.commission)}`, 'Vendors']}
                  />
                  <Bar dataKey="vendors" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {data.rateBands.map((b, i) => (
                      <Cell key={b.band} fill={BAND_COLORS[i]} />
                    ))}
                    <LabelList dataKey="vendors" position="top" style={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="No vendors yet" />
            )}
          </div>
        </Panel>

        <Panel title="Seller vs farmer vendors" subtitle="Commission by vendor type" icon={Store}>
          {view.typePie.some((t) => t.commission > 0) ? (
            <div className="flex h-56 items-center gap-2">
              <div className="h-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={view.typePie} dataKey="commission" nameKey="label" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
                      {view.typePie.map((t) => (
                        <Cell key={t.type} fill={t.type === 'seller' ? C.sky : C.emerald} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [inr(v), n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-36 space-y-3 text-xs">
                {view.typePie.map((t) => (
                  <li key={t.type}>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                      {t.type === 'seller' ? <Store className="h-3 w-3 text-sky-600" /> : <Warehouse className="h-3 w-3 text-emerald-600" />}
                      {t.label}
                    </span>
                    <span className="block text-sm font-black text-slate-900">{inr(t.commission)}</span>
                    <span className="text-[11px] text-slate-500">
                      {t.vendors} vendor{t.vendors === 1 ? '' : 's'} · {inrCompact(t.sales)} sales
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty text="No commission yet" />
          )}
        </Panel>

        <Panel title="Collections by payment method" subtitle="Commission received from vendors in this period" icon={Wallet}>
          {data.paymentMethods?.length ? (
            <ul className="space-y-3">
              {data.paymentMethods.map((m) => {
                const total = data.paymentMethods.reduce((s, x) => s + x.amount, 0);
                const share = total > 0 ? (m.amount / total) * 100 : 0;
                return (
                  <li key={m.method}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{m.method}</span>
                      <span className="font-bold text-slate-900">{inr(m.amount)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${share}%` }} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {m.count} payment{m.count === 1 ? '' : 's'} · {pctText(share)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty text="No payments recorded in this period" />
          )}
        </Panel>
      </div>

      {/* Leaderboard */}
      <Panel
        title="Vendor commission leaderboard"
        subtitle="Every vendor with its zones, rate, contribution and collection health"
        icon={Award}
        right={
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'commission', label: 'Commission' },
              { id: 'rate', label: 'Rate %' },
              { id: 'pending', label: 'Pending' },
              { id: 'collection', label: 'Lowest collection' },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setLeaderSort(o.id)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                  leaderSort === o.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      >
        {view.leaderboard.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-center">#</th>
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2">Zones</th>
                  <th className="px-3 py-2 text-center">Rate</th>
                  <th className="px-3 py-2 text-right">Eligible sales</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2">Share</th>
                  <th className="px-3 py-2">Collected</th>
                  <th className="px-3 py-2 text-right">Pending</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view.leaderboard.map((v, i) => (
                  <tr key={v.vendorId} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
                          i === 0 ? 'bg-amber-100 text-amber-800' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-800' : 'text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {v.vendorType === 'seller' ? <Store className="h-3.5 w-3.5 text-sky-600" /> : <Warehouse className="h-3.5 w-3.5 text-emerald-600" />}
                        <div>
                          <p className="font-semibold text-slate-900">{v.vendorName}</p>
                          <p className="text-[10px] text-slate-500">
                            {[v.city, v.state].filter(Boolean).join(', ') || v.vendorId} · {v.darkStoresCount} store
                            {v.darkStoresCount === 1 ? '' : 's'} · {v.orders.toLocaleString('en-IN')} orders
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {v.zones.length ? (
                        <div className="flex max-w-[200px] flex-wrap gap-1">
                          {v.zones.slice(0, 3).map((z) => (
                            <span key={z} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                              {z}
                            </span>
                          ))}
                          {v.zones.length > 3 ? <span className="text-[10px] text-slate-500">+{v.zones.length - 3}</span> : null}
                        </div>
                      ) : (
                        <span className="text-[10px] italic text-slate-400">No zone</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">{v.commissionRate}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{inr(v.sales)}</td>
                    <td className="px-3 py-2.5 text-right font-black text-slate-900">{inr(v.commission)}</td>
                    <td className="px-3 py-2.5">
                      <MiniBar value={v.shareOfCommission} />
                    </td>
                    <td className="px-3 py-2.5">
                      <MiniBar value={v.collectionRate} color={v.collectionRate >= 100 ? C.emerald : v.collectionRate >= 50 ? C.sky : C.amber} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-700">{inr(v.pending)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusPill status={v.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        to={`/finance/commissions/${v.vendorId}`}
                        className="inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-600 hover:text-emerald-700"
                      >
                        Details <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No vendors yet" />
        )}
      </Panel>
    </div>
  );
}
