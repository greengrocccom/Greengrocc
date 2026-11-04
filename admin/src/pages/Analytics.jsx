import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  ChartPie,
  Download,
  Info,
  Loader2,
  Package,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sprout,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
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
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import opsApi from '../api/opsApi';
import { downloadAnalyticsExcel } from '../utils/analyticsExcel';
import { BTN, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TD, TH } from '../utils/ui';

const COLORS = ['#047857', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#64748b', '#ec4899', '#84cc16'];
const GRID = '#E2E8F0';
const AXIS = '#94A3B8';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: '12 months' },
  { id: 'custom', label: 'Custom' },
];

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'sales', label: 'Sales', icon: Wallet },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'supply', label: 'Supply chain', icon: Sprout },
  { id: 'finance', label: 'Finance & support', icon: ChartPie },
];

/** Which filters each tab actually honours, so the UI can say so instead of silently ignoring them. */
const TAB_FILTERS = {
  overview: 'all',
  sales: 'all',
  products: 'all',
  customers: 'all',
  delivery: ['city', 'store', 'department', 'payment'],
  supply: [],
  finance: ['store', 'accountType'],
};

const FILTER_LABELS = {
  city: 'City',
  store: 'Dark store',
  department: 'Department',
  payment: 'Payment',
  accountType: 'Customer type',
};

const DEPARTMENT_LABELS = {
  preorder: 'Preorder',
  ready2cook: 'Ready2Cook',
  instant: 'Instant Order',
  unassigned: 'Not tagged',
};

const STATUS_LABELS = {
  attempted: 'Abandoned checkout',
  confirm: 'Confirmed',
  processing: 'Processing',
  shipping: 'Shipping',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return: 'Returned',
  preorder_hold: 'Preorder hold',
  incoming: 'Incoming',
  order_received: 'Received',
  stock_issue: 'Stock issue',
  packed: 'Packed',
  offered: 'Offered',
  assigned: 'Assigned',
  pickup_verified: 'Picked up',
  out_for_delivery: 'Out for delivery',
  delivery_failed: 'Failed',
  on_delivery: 'On delivery',
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function presetRange(preset) {
  const today = new Date();
  const back = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d;
  };
  switch (preset) {
    case 'today':
      return { from: ymd(today), to: ymd(today) };
    case '7d':
      return { from: ymd(back(6)), to: ymd(today) };
    case '90d':
      return { from: ymd(back(89)), to: ymd(today) };
    case 'month':
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
    case 'year':
      return { from: ymd(back(364)), to: ymd(today) };
    case '30d':
    default:
      return { from: ymd(back(29)), to: ymd(today) };
  }
}

const humanize = (s) => {
  const raw = String(s || '').trim();
  if (!raw) return '—';
  if (STATUS_LABELS[raw]) return STATUS_LABELS[raw];
  const spaced = raw.replace(/[_-]+/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const num = (n) => Number(n || 0).toLocaleString('en-IN');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const sharePct = (part, total, digits = 1) => {
  if (!total) return 0;
  const f = 10 ** digits;
  return Math.round((Number(part || 0) / total) * 100 * f) / f;
};

function inrShort(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return `₹${Math.round(v)}`;
}

function bucketLabel(date, unit) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  if (unit === 'month') return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return unit === 'week' ? `Wk ${label}` : label;
}

const prettyDate = (s) =>
  s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const FORMATTERS = {
  inr,
  num,
  pct: (v) => `${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`,
  min: (v) => `${num(v)} min`,
};

/* ─────────────────────────────── building blocks ─────────────────────────────── */

function KpiCard({ label, kpi, format = 'num', invert = false, hint }) {
  const value = kpi?.value ?? 0;
  const change = kpi?.change;
  const fmt = FORMATTERS[format] || num;
  let badge = null;
  if (change === null && value) {
    badge = <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">New</span>;
  } else if (typeof change === 'number' && change !== 0) {
    const up = change > 0;
    const good = invert ? !up : up;
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    badge = (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}
      >
        <Icon className="h-3 w-3" />
        {Math.abs(change).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%
      </span>
    );
  }
  return (
    <div className={`${PANEL} px-4 py-3.5`} title={hint || ''}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        {badge}
      </div>
      <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{fmt(value)}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">Previous period: {fmt(kpi?.previous ?? 0)}</p>
    </div>
  );
}

function StatTile({ label, value, sub }) {
  return (
    <div className={`${PANEL} px-4 py-3.5`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

function ChartCard({ title, subtitle, action, className = '', children }) {
  return (
    <section className={`${PANEL} flex flex-col p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function Empty({ text = 'No data for these filters yet.', height = 'h-56' }) {
  return <div className={`flex ${height} items-center justify-center text-sm text-slate-400`}>{text}</div>;
}

function ChartTooltip({ active, payload, label, labelFormatter, valueFormat = {} }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label != null ? (
        <p className="mb-1 font-semibold text-slate-800">{labelFormatter ? labelFormatter(label) : label}</p>
      ) : null}
      {payload.map((p) => {
        const key = p.dataKey;
        const fmt = FORMATTERS[valueFormat[key] || valueFormat.default || 'num'] || num;
        return (
          <p key={`${key}-${p.name}`} className="flex items-center gap-2 text-slate-600">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
            <span>{p.name}:</span>
            <span className="font-semibold text-slate-900">{fmt(p.value)}</span>
          </p>
        );
      })}
    </div>
  );
}

function Donut({ data, nameKey, valueKey, format = 'num', labels, height = 220 }) {
  const rows = (data || []).filter((d) => Number(d[valueKey]) > 0);
  const total = rows.reduce((s, d) => s + Number(d[valueKey] || 0), 0);
  if (!rows.length) return <Empty />;
  const fmt = FORMATTERS[format] || num;
  const name = (d) => (labels ? labels(d[nameKey]) : humanize(d[nameKey]));
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="relative w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey={valueKey} nameKey={nameKey} innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none">
              {rows.map((d, i) => (
                <Cell key={String(d[nameKey])} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <p className="font-semibold text-slate-800">{name(payload[0].payload)}</p>
                    <p className="text-slate-600">
                      {fmt(payload[0].value)} · {total ? Math.round((payload[0].value / total) * 100) : 0}%
                    </p>
                  </div>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</span>
          <span className="text-base font-bold text-slate-900">{format === 'inr' ? inrShort(total) : num(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 sm:w-1/2">
        {rows.map((d, i) => (
          <li key={String(d[nameKey])} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="truncate">{name(d)}</span>
            </span>
            <span className="shrink-0 font-semibold text-slate-800">
              {fmt(d[valueKey])}
              <span className="ml-1 font-normal text-slate-400">{total ? Math.round((d[valueKey] / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HBars({ data, nameKey, valueKey, format = 'num', color = COLORS[0], height, labels, showShare = false }) {
  const rows = (data || []).filter((d) => Number(d[valueKey]) > 0);
  if (!rows.length) return <Empty />;
  const h = height || Math.max(160, rows.length * 34 + 20);
  const fmt = FORMATTERS[format] || num;
  const total = rows.reduce((s, d) => s + Number(d[valueKey] || 0), 0);
  const label = (v) => (labels ? labels(v) : humanize(v));
  const valueWithShare = (value) => {
    const pct = sharePct(value, total);
    return showShare ? `${fmt(value)} · ${pct}%` : fmt(value);
  };
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: showShare ? 96 : 24, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" fontSize={11} stroke={AXIS} tickFormatter={format === 'inr' ? inrShort : undefined} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey={nameKey}
            width={120}
            fontSize={11}
            stroke={AXIS}
            tickFormatter={(v) => {
              const t = label(v);
              return t.length > 18 ? `${t.slice(0, 17)}…` : t;
            }}
          />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-slate-800">{label(payload[0].payload[nameKey])}</p>
                  <p className="text-slate-600">{valueWithShare(payload[0].value)}</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey={valueKey} fill={color} maxBarSize={22}>
            {showShare ? (
              <LabelList
                dataKey={valueKey}
                position="right"
                content={({ x, y, width, height: barH, value }) => {
                  if (value == null || x == null || y == null) return null;
                  return (
                    <text x={x + width + 6} y={y + barH / 2} dominantBaseline="middle" fontSize={10} fill="#334155">
                      {valueWithShare(value)}
                    </text>
                  );
                }}
              />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Heatmap({ cells }) {
  const grid = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const c of cells || []) {
      if (c.dow >= 1 && c.dow <= 7 && c.hour >= 0 && c.hour < 24) m[c.dow - 1][c.hour] += c.orders;
    }
    return m;
  }, [cells]);
  const max = Math.max(0, ...grid.flat());
  if (!max) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="ml-10 grid gap-[3px] text-[9px] text-slate-400" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center">
              {h % 3 === 0 ? `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` : ''}
            </span>
          ))}
        </div>
        {grid.map((row, d) => (
          <div key={DOW[d]} className="mt-[3px] flex items-center">
            <span className="w-10 shrink-0 text-[11px] text-slate-500">{DOW[d]}</span>
            <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {row.map((v, h) => (
                <div
                  key={h}
                  className="h-6 rounded-[4px]"
                  style={{ background: v ? `rgba(4, 120, 87, ${0.12 + (v / max) * 0.88})` : '#F1F5F9' }}
                  title={`${DOW[d]} ${pad(h)}:00–${pad(h)}:59 · ${v} order${v === 1 ? '' : 's'}`}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
          Fewer
          {[0.15, 0.35, 0.55, 0.75, 1].map((a) => (
            <span key={a} className="h-3 w-3 rounded-[3px]" style={{ background: `rgba(4, 120, 87, ${a})` }} />
          ))}
          More
        </div>
      </div>
    </div>
  );
}

function ShareBar({ value, max, color = COLORS[0] }) {
  const pct = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function DataTable({ columns, rows, empty = 'No data for these filters yet.' }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/80">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`${TH} ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={row.id || row.key || i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                {columns.map((c) => (
                  <td key={c.key} className={`${TD} ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                    {c.render ? c.render(row, i) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-slate-400">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TrendChart({ data, unit, series, height = 300 }) {
  const hasData = (data || []).some((row) => series.some((s) => Number(row[s.key]) > 0));
  if (!hasData) return <Empty height="h-72" />;
  const valueFormat = Object.fromEntries(series.map((s) => [s.key, s.format || 'num']));
  const leftInr = series.some((s) => s.axis !== 'right' && s.format === 'inr');
  const hasRight = series.some((s) => s.axis === 'right');
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="date" fontSize={11} stroke={AXIS} tickFormatter={(v) => bucketLabel(v, unit)} minTickGap={18} />
          <YAxis yAxisId="left" fontSize={11} stroke={AXIS} tickFormatter={leftInr ? inrShort : undefined} allowDecimals={false} width={56} />
          {hasRight ? <YAxis yAxisId="right" orientation="right" fontSize={11} stroke={AXIS} allowDecimals={false} width={36} /> : null}
          <Tooltip content={<ChartTooltip labelFormatter={(v) => bucketLabel(v, unit)} valueFormat={valueFormat} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) =>
            s.type === 'bar' ? (
              <Bar key={s.key} yAxisId={s.axis || 'left'} dataKey={s.key} name={s.name} fill={s.color} maxBarSize={18} />
            ) : s.type === 'line' ? (
              <Line key={s.key} yAxisId={s.axis || 'left'} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
            ) : (
              <Area
                key={s.key}
                yAxisId={s.axis || 'left'}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#g-${s.key})`}
              />
            )
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-[10px] px-2.5 py-1 text-xs font-medium transition ${
            value === o.id ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────── tabs ─────────────────────────────── */

function OverviewTab({ data }) {
  const { kpis, sales, products, delivery, range } = data;
  const topProducts = products.top.slice(0, 6);
  const maxRev = Math.max(0, ...topProducts.map((p) => p.revenue));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Revenue (delivered)" kpi={kpis.revenue} format="inr" hint="Total of delivered customer orders" />
        <KpiCard label="Order value" kpi={kpis.gmv} format="inr" hint="All placed orders except cancelled / returned" />
        <KpiCard label="Orders" kpi={kpis.orders} hint="Placed orders, excluding abandoned checkouts" />
        <KpiCard label="Avg order value" kpi={kpis.aov} format="inr" />
        <KpiCard label="Ordering customers" kpi={kpis.customers} />
        <KpiCard label="New sign-ups" kpi={kpis.newCustomers} />
        <KpiCard label="Cancellation rate" kpi={kpis.cancellationRate} format="pct" invert />
        <KpiCard label="Delivery success" kpi={kpis.successRate} format="pct" hint="Delivered ÷ (delivered + failed) dark-store orders" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Revenue & orders" subtitle={`Per ${range.unit}, delivered revenue vs. total order value`}>
          <TrendChart
            data={sales.trend}
            unit={range.unit}
            series={[
              { key: 'gmv', name: 'Order value', color: COLORS[1], format: 'inr' },
              { key: 'revenue', name: 'Revenue (delivered)', color: COLORS[0], format: 'inr' },
              { key: 'orders', name: 'Orders', color: COLORS[2], type: 'bar', axis: 'right' },
            ]}
          />
        </ChartCard>
        <ChartCard title="Order status" subtitle="Every customer order in the period">
          <Donut data={sales.statuses} nameKey="status" valueKey="orders" />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Sales by department" subtitle="Item value, excluding cancelled orders">
          <Donut data={sales.departments} nameKey="department" valueKey="value" format="inr" labels={(k) => DEPARTMENT_LABELS[k] || humanize(k)} />
        </ChartCard>
        <ChartCard title="Top products" subtitle="By item revenue">
          {topProducts.length ? (
            <ul className="space-y-3">
              {topProducts.map((p) => (
                <li key={p.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-slate-700">{p.name}</span>
                    <span className="shrink-0 font-semibold text-slate-900">{inr(p.revenue)}</span>
                  </div>
                  <ShareBar value={p.revenue} max={maxRev} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard title="Dark store performance" subtitle="Orders handled and delivery success">
          {delivery.stores.length ? (
            <ul className="space-y-3">
              {delivery.stores.slice(0, 6).map((s) => (
                <li key={s.id} className="text-xs">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-700">{s.name}</span>
                    <span className="shrink-0 text-slate-500">
                      {num(s.orders)} orders ·{' '}
                      <span className="font-semibold text-slate-900">{s.successRate == null ? '—' : `${s.successRate}%`}</span>
                    </span>
                  </div>
                  <ShareBar value={s.successRate || 0} max={100} color={s.successRate >= 90 ? COLORS[0] : s.successRate >= 70 ? COLORS[2] : COLORS[4]} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function SalesTab({ data }) {
  const { kpis, sales, range } = data;
  const [metric, setMetric] = useState('value');
  const p = sales.promotions;
  const series =
    metric === 'value'
      ? [
          { key: 'gmv', name: 'Order value', color: COLORS[1], format: 'inr' },
          { key: 'revenue', name: 'Revenue (delivered)', color: COLORS[0], format: 'inr' },
        ]
      : [
          { key: 'orders', name: 'Orders', color: COLORS[0], type: 'bar' },
          { key: 'delivered', name: 'Delivered', color: COLORS[1], type: 'line' },
          { key: 'cancelled', name: 'Cancelled / returned', color: COLORS[4], type: 'line' },
        ];
  const maxArea = Math.max(0, ...sales.areas.map((a) => a.orders));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Order value" kpi={kpis.gmv} format="inr" />
        <KpiCard label="Revenue (delivered)" kpi={kpis.revenue} format="inr" />
        <KpiCard label="Avg order value" kpi={kpis.aov} format="inr" />
        <KpiCard label="Abandoned checkouts" kpi={kpis.abandoned} invert hint="Checkout started but payment never completed" />
        <KpiCard label="Discounts given" kpi={kpis.discounts} format="inr" invert hint="Coupons + reward points + gift cards" />
      </div>

      <ChartCard
        title="Sales trend"
        subtitle={`Per ${range.unit}`}
        action={
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { id: 'value', label: 'Value' },
              { id: 'orders', label: 'Orders' },
            ]}
          />
        }
      >
        <TrendChart data={sales.trend} unit={range.unit} series={series} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Payment method" subtitle="Order value by how customers paid">
          <Donut data={sales.payments} nameKey="method" valueKey="value" format="inr" labels={(k) => (k === 'cod' ? 'Cash on delivery' : k === 'online' ? 'Online' : humanize(k))} />
        </ChartCard>
        <ChartCard title="Fulfilment" subtitle="Home delivery vs. store pickup (orders)">
          <Donut data={sales.fulfilment} nameKey="type" valueKey="orders" labels={(k) => (k === 'pickup' ? 'Store pickup' : 'Home delivery')} />
        </ChartCard>
        <ChartCard title="Order status value" subtitle="Value sitting in each status — rupees and share">
          <HBars data={sales.statuses} nameKey="status" valueKey="value" format="inr" color={COLORS[3]} showShare />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Order value by city" subtitle="From the delivery address — rupees and share">
          <HBars data={sales.cities} nameKey="city" valueKey="gmv" format="inr" labels={(v) => v} showShare />
        </ChartCard>
        <ChartCard title="Busiest areas" subtitle="Top delivery areas by orders, with dark store ID">
          {sales.areas.length ? (
            <ul className="space-y-3">
              {sales.areas.map((a) => (
                <li key={`${a.darkStoreId || a.storeName}-${a.area}-${a.city}`} className="text-xs">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">
                        {a.area}
                        {a.city ? <span className="font-normal text-slate-400"> · {a.city}</span> : null}
                      </p>
                      {a.storeName ? <p className="truncate text-[11px] text-slate-500">{a.storeName}</p> : null}
                      <p className="truncate font-mono text-[10px] text-slate-400" title={a.darkStoreId || ''}>
                        {a.darkStoreId ? `ID ${a.darkStoreId}` : 'Dark store ID unavailable'}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-slate-500">
                      {num(a.orders)} orders
                      <span className="block font-semibold text-slate-900">{inr(a.gmv)}</span>
                    </span>
                  </div>
                  <ShareBar value={a.orders} max={maxArea} color={COLORS[1]} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </ChartCard>
      </div>

      <ChartCard title="When customers order" subtitle="Orders by weekday and hour (IST) — darker means busier">
        <Heatmap cells={sales.heatmap} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Promotions & charges" subtitle="Across non-cancelled orders">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            {[
              ['Coupon discount', inr(p.couponDiscount)],
              ['Reward discount', inr(p.rewardDiscount)],
              ['Gift card discount', inr(p.giftCardDiscount)],
              ['Delivery charges', inr(p.deliveryCharges)],
              ['GST collected', inr(p.gst)],
              ['Orders with coupon', `${num(p.couponOrders)} / ${num(p.orders)}`],
              ['Points earned', num(p.pointsEarned)],
              ['Points redeemed', num(p.pointsUsed)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </ChartCard>
        <ChartCard className="lg:col-span-2" title="Coupon performance" subtitle="Most used coupon codes">
          <DataTable
            empty="No coupons were used in this period."
            rows={p.coupons.map((c) => ({ ...c, key: c.code }))}
            columns={[
              { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-semibold text-slate-900">{r.code}</span> },
              { key: 'uses', label: 'Uses', align: 'right', render: (r) => num(r.uses) },
              { key: 'discount', label: 'Discount given', align: 'right', render: (r) => inr(r.discount) },
              { key: 'value', label: 'Order value', align: 'right', render: (r) => inr(r.value) },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function ProductsTab({ data }) {
  const { products, sales } = data;
  const [by, setBy] = useState('revenue');
  const total = products.top.reduce((s, p) => s + p.revenue, 0);
  const ranked = [...products.top].sort((a, b) => b[by] - a[by]);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Best sellers"
          subtitle="Top 15 products in the period"
          action={
            <Segmented
              value={by}
              onChange={setBy}
              options={[
                { id: 'revenue', label: 'Revenue' },
                { id: 'units', label: 'Units' },
                { id: 'orders', label: 'Orders' },
              ]}
            />
          }
        >
          <HBars data={ranked.slice(0, 10)} nameKey="name" valueKey={by} format={by === 'revenue' ? 'inr' : 'num'} labels={(v) => v} />
        </ChartCard>
        <ChartCard title="Units by department" subtitle="Excluding cancelled orders">
          <Donut data={sales.departments} nameKey="department" valueKey="units" labels={(k) => DEPARTMENT_LABELS[k] || humanize(k)} />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Product leaderboard">
          <DataTable
            rows={ranked}
            columns={[
              { key: 'rank', label: '#', render: (_, i) => <span className="text-slate-400">{i + 1}</span> },
              { key: 'name', label: 'Product', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
              { key: 'department', label: 'Department', render: (r) => DEPARTMENT_LABELS[r.department] || (r.department ? humanize(r.department) : 'Not tagged') },
              { key: 'units', label: 'Units', align: 'right', render: (r) => num(r.units) },
              { key: 'orders', label: 'Orders', align: 'right', render: (r) => num(r.orders) },
              { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => inr(r.revenue) },
              {
                key: 'share',
                label: 'Share',
                align: 'right',
                render: (r) => (
                  <div className="ml-auto flex w-28 items-center gap-2">
                    <ShareBar value={r.revenue} max={total} />
                    <span className="w-9 text-right text-xs text-slate-500">{total ? Math.round((r.revenue / total) * 100) : 0}%</span>
                  </div>
                ),
              },
            ]}
          />
        </ChartCard>
        <ChartCard title="Most cancelled / returned" subtitle="Units in cancelled or returned orders">
          <HBars data={products.cancelled} nameKey="name" valueKey="units" color={COLORS[4]} labels={(v) => v} />
        </ChartCard>
      </div>
    </div>
  );
}

function CustomersTab({ data }) {
  const { kpis, customers, range } = data;
  const nvr = customers.newVsReturning;
  const ordering = nvr.reduce((s, r) => s + r.customers, 0);
  const returning = nvr.find((r) => r.type === 'returning')?.customers || 0;
  const bulk = customers.byType.find((t) => t.type === 'bulk');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Ordering customers" kpi={kpis.customers} />
        <KpiCard label="New sign-ups" kpi={kpis.newCustomers} />
        <StatTile label="Returning customers" value={num(returning)} sub={ordering ? `${Math.round((returning / ordering) * 100)}% had ordered before this period` : 'No orders in period'} />
        <StatTile label="Bulk buyers" value={num(bulk?.customers || 0)} sub={bulk ? `${inr(bulk.gmv)} order value` : 'No bulk orders in period'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="New sign-ups" subtitle={`Customer accounts created per ${range.unit}`}>
          <TrendChart data={customers.signups} unit={range.unit} series={[{ key: 'signups', name: 'Sign-ups', color: COLORS[3] }]} height={260} />
        </ChartCard>
        <ChartCard title="New vs. returning" subtitle="Customers who ordered in the period">
          <Donut data={nvr} nameKey="type" valueKey="customers" labels={(k) => (k === 'new' ? 'First-time in period' : 'Returning')} />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Retail vs. bulk" subtitle="Order value by customer type">
          <Donut data={customers.byType} nameKey="type" valueKey="gmv" format="inr" labels={(k) => (k === 'bulk' ? 'Bulk / B2B' : 'Retail')} />
        </ChartCard>
        <ChartCard className="xl:col-span-2" title="Top customers" subtitle="By spend on non-cancelled orders">
          <DataTable
            rows={customers.top}
            columns={[
              {
                key: 'name',
                label: 'Customer',
                render: (r) => (
                  <div>
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.phone}</p>
                  </div>
                ),
              },
              {
                key: 'type',
                label: 'Type',
                render: (r) => (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.accountType === 'bulk' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                    {r.accountType === 'bulk' ? 'Bulk' : 'Retail'}
                  </span>
                ),
              },
              { key: 'orders', label: 'Orders', align: 'right', render: (r) => num(r.orders) },
              { key: 'spend', label: 'Spend', align: 'right', render: (r) => inr(r.spend) },
              { key: 'last', label: 'Last order', align: 'right', render: (r) => (r.last ? new Date(r.last).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—') },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function DeliveryTab({ data }) {
  const { kpis, delivery, range } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Dark-store orders" kpi={kpis.storeOrders} />
        <KpiCard label="Delivery success" kpi={kpis.successRate} format="pct" />
        <KpiCard label="Median delivery time" kpi={kpis.deliveryMinutes} format="min" invert hint="From rider assignment (or packing) to delivered" />
        <KpiCard label="Failed deliveries" kpi={kpis.failed} invert />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Delivery trend" subtitle={`Dark-store orders per ${range.unit}`}>
          <TrendChart
            data={delivery.trend}
            unit={range.unit}
            series={[
              { key: 'created', name: 'Received', color: COLORS[6], type: 'bar' },
              { key: 'delivered', name: 'Delivered', color: COLORS[0], type: 'line' },
              { key: 'failed', name: 'Failed', color: COLORS[4], type: 'line' },
            ]}
          />
        </ChartCard>
        <ChartCard title="Pipeline status" subtitle="Where dark-store orders are right now">
          <HBars data={delivery.statuses} nameKey="status" valueKey="orders" color={COLORS[1]} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Delivery time distribution" subtitle="Delivered orders by minutes taken">
          {delivery.durations.some((d) => d.orders) ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={delivery.durations}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="bucket" fontSize={11} stroke={AXIS} />
                  <YAxis fontSize={11} stroke={AXIS} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} content={<ChartTooltip />} />
                  <Bar dataKey="orders" name="Orders" maxBarSize={48}>
                    {delivery.durations.map((d, i) => (
                      <Cell key={d.bucket} fill={i < 2 ? COLORS[0] : i < 4 ? COLORS[2] : COLORS[4]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard title="Failure reasons" subtitle="Reasons riders gave for failed deliveries">
          <HBars data={delivery.failureReasons} nameKey="reason" valueKey="orders" color={COLORS[4]} labels={(v) => v} />
        </ChartCard>
      </div>

      <ChartCard title="Dark store scorecard">
        <DataTable
          rows={delivery.stores}
          columns={[
            {
              key: 'name',
              label: 'Dark store',
              render: (r) => (
                <div>
                  <p className="font-medium text-slate-900">{r.name}</p>
                  {r.city ? <p className="text-xs text-slate-400">{r.city}</p> : null}
                </div>
              ),
            },
            { key: 'orders', label: 'Orders', align: 'right', render: (r) => num(r.orders) },
            { key: 'delivered', label: 'Delivered', align: 'right', render: (r) => num(r.delivered) },
            { key: 'failed', label: 'Failed', align: 'right', render: (r) => num(r.failed) },
            { key: 'cancelled', label: 'Cancelled', align: 'right', render: (r) => num(r.cancelled) },
            { key: 'value', label: 'Delivered value', align: 'right', render: (r) => inr(r.value) },
            { key: 'avgMinutes', label: 'Avg time', align: 'right', render: (r) => (r.avgMinutes == null ? '—' : `${num(r.avgMinutes)} min`) },
            {
              key: 'successRate',
              label: 'Success',
              align: 'right',
              render: (r) =>
                r.successRate == null ? (
                  '—'
                ) : (
                  <div className="ml-auto flex w-28 items-center gap-2">
                    <ShareBar value={r.successRate} max={100} color={r.successRate >= 90 ? COLORS[0] : r.successRate >= 70 ? COLORS[2] : COLORS[4]} />
                    <span className="w-11 text-right text-xs font-semibold text-slate-700">{r.successRate}%</span>
                  </div>
                ),
            },
          ]}
        />
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Rider leaderboard" subtitle="Riders by deliveries completed in the period">
          <DataTable
            rows={delivery.riders}
            columns={[
              { key: 'rank', label: '#', render: (_, i) => <span className="text-slate-400">{i + 1}</span> },
              { key: 'name', label: 'Rider', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
              { key: 'assigned', label: 'Assigned', align: 'right', render: (r) => num(r.assigned) },
              { key: 'delivered', label: 'Delivered', align: 'right', render: (r) => num(r.delivered) },
              { key: 'failed', label: 'Failed', align: 'right', render: (r) => num(r.failed) },
              { key: 'km', label: 'Distance', align: 'right', render: (r) => `${r.km} km` },
              { key: 'earnings', label: 'Earnings', align: 'right', render: (r) => inr(r.earnings) },
            ]}
          />
        </ChartCard>
        <ChartCard title="Fleet right now" subtitle="Live rider status (not date-filtered)">
          <Donut data={delivery.fleet.status} nameKey="status" valueKey="riders" height={180} />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
            <div>
              <p className="mb-1.5 font-semibold text-slate-500">Verification</p>
              {delivery.fleet.verification.map((v) => (
                <p key={v.status} className="flex justify-between text-slate-600">
                  <span>{humanize(v.status)}</span>
                  <span className="font-semibold text-slate-900">{num(v.riders)}</span>
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1.5 font-semibold text-slate-500">Vehicles</p>
              {delivery.fleet.vehicles.map((v) => (
                <p key={v.vehicle} className="flex justify-between text-slate-600">
                  <span>{humanize(v.vehicle)}</span>
                  <span className="font-semibold text-slate-900">{num(v.riders)}</span>
                </p>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function SupplyTab({ data }) {
  const { supply, range } = data;
  const c = supply.counts;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Vendors / collection centres" value={num(c.vendors)} sub="All time" />
        <StatTile label="Farmers" value={num(c.farmers)} sub="Active registry" />
        <StatTile label="Farmer managers" value={num(c.farmerManagers)} sub="All time" />
        <StatTile label="Collection centres (ERP)" value={num(c.collectionCentres)} sub="All time" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Farmer status">
          <Donut data={supply.farmers} nameKey="status" valueKey="count" />
        </ChartCard>
        <ChartCard title="Farmer verification">
          <Donut data={supply.farmerVerification} nameKey="status" valueKey="count" />
        </ChartCard>
        <ChartCard title="Vendor status">
          <Donut data={supply.vendors} nameKey="status" valueKey="count" />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Farmer orders" subtitle="Procurement orders placed in the period, by status">
          {supply.farmerOrders.length ? (
            <div style={{ height: Math.max(200, supply.farmerOrders.length * 38 + 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supply.farmerOrders} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                  <XAxis type="number" fontSize={11} stroke={AXIS} allowDecimals={false} />
                  <YAxis type="category" dataKey="status" width={130} fontSize={11} stroke={AXIS} tickFormatter={humanize} />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} content={<ChartTooltip labelFormatter={humanize} valueFormat={{ value: 'inr', orders: 'num' }} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="orders" name="Orders" fill={COLORS[0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
          {supply.farmerOrders.length ? (
            <p className="mt-2 text-xs text-slate-500">
              Total procurement value: <span className="font-semibold text-slate-800">{inr(supply.farmerOrders.reduce((s, o) => s + o.value, 0))}</span>
            </p>
          ) : null}
        </ChartCard>
        <ChartCard title="Farm pickups" subtitle="Pickups created in the period, by status">
          <HBars data={supply.pickups} nameKey="status" valueKey="pickups" color={COLORS[5]} />
        </ChartCard>
      </div>

      <ChartCard title="Farmers onboarded" subtitle={`New farmer registrations per ${range.unit}`}>
        <TrendChart data={supply.farmerJoins} unit={range.unit} series={[{ key: 'joined', name: 'Farmers joined', color: COLORS[8] }]} height={240} />
      </ChartCard>
    </div>
  );
}

function FinanceTab({ data }) {
  const { finance, kpis, range } = data;
  const t = finance.totals;
  const claimTotal = finance.claims.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Revenue (delivered)" value={inr(kpis.revenue.value)} sub="Customer orders" />
        <StatTile label="Other income" value={inr(t.income)} sub="Finance ledger" />
        <StatTile label="Expenses" value={inr(t.expense)} sub="Finance ledger" />
        <StatTile label="Payouts" value={inr(t.payout)} sub="Finance ledger" />
        <StatTile label="Settlements" value={inr(t.settlement)} sub="Finance ledger" />
      </div>

      <ChartCard title="Ledger movements" subtitle={`Finance ledger entries per ${range.unit}`}>
        <TrendChart
          data={finance.trend}
          unit={range.unit}
          series={[
            { key: 'income', name: 'Income', color: COLORS[0], type: 'bar', format: 'inr' },
            { key: 'expense', name: 'Expenses', color: COLORS[4], type: 'bar', format: 'inr' },
            { key: 'payout', name: 'Payouts', color: COLORS[3], type: 'bar', format: 'inr' },
            { key: 'settlement', name: 'Settlements', color: COLORS[1], type: 'bar', format: 'inr' },
          ]}
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Refund & warranty claims" subtitle={`${inr(claimTotal)} claimed in the period`}>
          <Donut data={finance.claims} nameKey="status" valueKey="claims" />
        </ChartCard>
        <ChartCard title="Claim value by type">
          <Donut data={finance.claimTypes} nameKey="type" valueKey="amount" format="inr" />
        </ChartCard>
        <ChartCard title="Support tickets" subtitle={`${num(finance.returnPickups)} return pickups scheduled in the period`}>
          <Donut data={finance.support} nameKey="status" valueKey="tickets" />
        </ChartCard>
      </div>
    </div>
  );
}

/* ─────────────────────────────── page ─────────────────────────────── */

const FILTER_KEYS = ['city', 'store', 'department', 'payment', 'accountType'];

export default function Analytics() {
  const [params, setParams] = useSearchParams();
  const preset = params.get('range') || '30d';
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';
  const range = preset === 'custom' ? { from: params.get('from') || presetRange('30d').from, to: params.get('to') || presetRange('30d').to } : presetRange(preset);
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const update = useCallback(
    (patch) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(patch)) {
        if (v === '' || v == null) next.delete(k);
        else next.set(k, v);
      }
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  const query = useMemo(
    () => ({ from: range.from, to: range.to, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.from, range.to, ...FILTER_KEYS.map((k) => filters[k])]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    opsApi
      .list('analytics', query)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load analytics.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, reloadKey]);

  const options = data?.options || { cities: [], stores: [], departments: [] };
  const storeOptions = filters.city
    ? options.stores.filter((s) => s.city.toLowerCase() === filters.city.toLowerCase() || s.id === filters.store)
    : options.stores;
  const activeFilters = FILTER_KEYS.filter((k) => filters[k]);
  const honoured = TAB_FILTERS[tab];
  const ignored = honoured === 'all' ? [] : activeFilters.filter((k) => !honoured.includes(k));

  const filterLabel = (k) => {
    const v = filters[k];
    if (k === 'store') return options.stores.find((s) => s.id === v)?.name || 'Selected store';
    if (k === 'department') return DEPARTMENT_LABELS[v] || v;
    if (k === 'payment') return v === 'cod' ? 'Cash on delivery' : 'Online';
    if (k === 'accountType') return v === 'bulk' ? 'Bulk' : 'Retail';
    return v;
  };

  const TabBody = { overview: OverviewTab, sales: SalesTab, products: ProductsTab, customers: CustomersTab, delivery: DeliveryTab, supply: SupplyTab, finance: FinanceTab }[tab];

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={PAGE_KICKER}>Insights</p>
          <h1 className={PAGE_TITLE}>Analytics</h1>
          <p className={PAGE_SUB}>Live numbers from every panel: orders, delivery, customers, supply chain and finance.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {data?.range ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2">
              <CalendarRange className="h-3.5 w-3.5" />
              {prettyDate(data.range.from)} – {prettyDate(data.range.to)}
              <span className="text-slate-400">vs. {prettyDate(data.range.previousFrom)} – {prettyDate(data.range.previousTo)}</span>
            </span>
          ) : null}
          <button
            type="button"
            className={BTN}
            disabled={!data || loading}
            onClick={() => data && downloadAnalyticsExcel(data)}
            title="Download Excel for every analytics section"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Excel
          </button>
          <button type="button" className={BTN} onClick={() => setReloadKey((k) => k + 1)} disabled={loading} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className={`${PANEL} space-y-3 p-3 sm:p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={preset} onChange={(id) => update({ range: id === '30d' ? '' : id, ...(id === 'custom' ? { from: range.from, to: range.to } : { from: '', to: '' }) })} options={PRESETS} />
          {preset === 'custom' ? (
            <div className="flex items-center gap-2">
              <input type="date" className={`${INPUT} !w-auto !py-1.5`} value={range.from} max={range.to} onChange={(e) => e.target.value && update({ from: e.target.value })} />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" className={`${INPUT} !w-auto !py-1.5`} value={range.to} min={range.from} onChange={(e) => e.target.value && update({ to: e.target.value })} />
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <select className={INPUT} value={filters.city} onChange={(e) => update({ city: e.target.value, store: '' })}>
            <option value="">All cities</option>
            {options.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className={INPUT} value={filters.store} onChange={(e) => update({ store: e.target.value })}>
            <option value="">All dark stores</option>
            {storeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.city ? ` · ${s.city}` : ''}
              </option>
            ))}
          </select>
          <select className={INPUT} value={filters.department} onChange={(e) => update({ department: e.target.value })}>
            <option value="">All departments</option>
            {options.departments.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABELS[d] || d}
              </option>
            ))}
          </select>
          <select className={INPUT} value={filters.payment} onChange={(e) => update({ payment: e.target.value })}>
            <option value="">All payment methods</option>
            <option value="cod">Cash on delivery</option>
            <option value="online">Online</option>
          </select>
          <select className={INPUT} value={filters.accountType} onChange={(e) => update({ accountType: e.target.value })}>
            <option value="">All customers</option>
            <option value="retail">Retail</option>
            <option value="bulk">Bulk / B2B</option>
          </select>
          <button
            type="button"
            className={BTN}
            disabled={!activeFilters.length && preset === '30d'}
            onClick={() => update({ range: '', from: '', to: '', ...Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])) })}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset
          </button>
        </div>
        {activeFilters.length ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            {activeFilters.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => update({ [k]: '', ...(k === 'city' ? { store: '' } : {}) })}
                className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 hover:bg-emerald-100"
                title="Remove filter"
              >
                {FILTER_LABELS[k]}: {filterLabel(k)} ×
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => update({ tab: t.id === 'overview' ? '' : t.id })}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {ignored.length || (honoured !== 'all' && !honoured.length) ? (
        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {honoured.length
            ? `This tab uses the date range and ${honoured.map((k) => FILTER_LABELS[k].toLowerCase()).join(', ')} filters. ${ignored.map((k) => FILTER_LABELS[k]).join(', ')} ${ignored.length === 1 ? "doesn't" : "don't"} apply here.`
            : 'Supply-chain data is not tied to dark stores or customers, so only the date range applies here.'}
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div> : null}

      {!data && loading ? (
        <div className="flex justify-center py-24 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : data ? (
        <div className={`transition-opacity ${loading ? 'pointer-events-none opacity-60' : ''}`}>
          <TabBody data={data} />
        </div>
      ) : null}
    </div>
  );
}
