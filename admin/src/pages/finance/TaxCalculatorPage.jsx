import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FilePlus2,
  FolderOpen,
  Loader2,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Store,
  Trash2,
  Unlock,
  UserCog,
} from 'lucide-react';
import adminFinanceApi from '../../api/adminFinanceApi';

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom' },
];

const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500';

/** Starting points only — every field stays editable. */
const TEMPLATES = [
  { label: 'GST on commission income', effect: 'add', baseSource: 'admin_commission_earned', method: 'percent', basis: 'exclusive', rate: 18 },
  { label: 'TCS on vendor sales (e-commerce)', effect: 'add', baseSource: 'vendor_total_sale', method: 'percent', basis: 'exclusive', rate: 0.5 },
  { label: 'TDS on vendor sales (e-commerce)', effect: 'deduct', baseSource: 'vendor_total_sale', method: 'percent', basis: 'exclusive', rate: 0.1 },
  { label: 'Input tax credit', effect: 'deduct', baseSource: 'manual', method: 'fixed', basis: 'exclusive', rate: 0 },
  { label: 'Other tax / cess', effect: 'add', baseSource: 'manual', method: 'percent', basis: 'exclusive', rate: 0 },
];

let lineSeq = 0;
const newId = () => `l${Date.now().toString(36)}${(lineSeq += 1)}`;

function defaultLines() {
  return [
    { id: newId(), kind: 'vendor_sale', label: 'GST on vendor sales', effect: 'add', baseSource: 'vendor_total_sale', baseAmount: '', method: 'percent', basis: 'inclusive', rate: '', note: '' },
    { id: newId(), kind: 'admin_sale', label: 'GST on admin sales', effect: 'add', baseSource: 'manual', baseAmount: '', method: 'percent', basis: 'inclusive', rate: '', note: '' },
  ];
}

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const inr = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Same maths as the server (taxCalculator.computeTaxSheet) so the preview matches what gets saved. */
function computeLine(line, figures) {
  const base =
    line.baseSource && line.baseSource !== 'manual' ? Number(figures?.[line.baseSource] || 0) : Number(line.baseAmount) || 0;
  const rate = Number(line.rate) || 0;
  let tax = 0;
  if (line.method === 'fixed') tax = rate;
  else if (line.basis === 'inclusive') tax = rate > 0 ? (base * rate) / (100 + rate) : 0;
  else tax = (base * rate) / 100;
  return { base: round2(base), tax: round2(tax) };
}

function computeTotals(lines, figures) {
  const rows = lines.map((l) => ({ ...l, ...computeLine(l, figures) }));
  const sum = (pred) => round2(rows.filter(pred).reduce((s, r) => s + r.tax, 0));
  const taxOnVendorSales = sum((r) => r.kind === 'vendor_sale');
  const taxOnAdminSales = sum((r) => r.kind === 'admin_sale');
  const additionalTaxes = sum((r) => r.kind === 'custom' && r.effect === 'add');
  const deductions = sum((r) => r.effect === 'deduct');
  const grossTax = round2(taxOnVendorSales + taxOnAdminSales + additionalTaxes);
  const taxableSales = round2(
    rows.filter((r) => r.kind !== 'custom' && r.method === 'percent').reduce((s, r) => s + r.base, 0)
  );
  const netTaxPayable = round2(grossTax - deductions);
  return {
    rows,
    totals: {
      taxOnVendorSales,
      taxOnAdminSales,
      additionalTaxes,
      deductions,
      grossTax,
      netTaxPayable,
      taxableSales,
      effectiveRate: taxableSales > 0 ? round2((netTaxPayable / taxableSales) * 100) : 0,
    },
  };
}

function periodParams(preset, startDate, endDate) {
  if (preset === 'custom') return { preset, startDate, endDate };
  return { preset };
}

function SourceSelect({ value, metrics, onChange, disabled, allowManual = true }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const m of metrics) {
      if (!map.has(m.group)) map.set(m.group, []);
      map.get(m.group).push(m);
    }
    return [...map.entries()];
  }, [metrics]);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={INPUT}>
      {allowManual ? <option value="manual">Enter amount manually</option> : null}
      {groups.map(([group, items]) => (
        <optgroup key={group} label={`Platform · ${group}`}>
          {items.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label} ({inr(m.amount)})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function RateInputs({ line, taxRates, onChange, disabled }) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <select
          value={line.method}
          onChange={(e) => onChange({ method: e.target.value })}
          disabled={disabled}
          className={`${INPUT} w-24 shrink-0`}
        >
          <option value="percent">Rate %</option>
          <option value="fixed">Fixed ₹</option>
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          value={line.rate}
          onChange={(e) => onChange({ rate: e.target.value })}
          disabled={disabled}
          placeholder={line.method === 'fixed' ? 'Amount ₹' : 'e.g. 5'}
          className={`${INPUT} text-right font-semibold`}
        />
      </div>
      {line.method === 'percent' ? (
        <div className="flex rounded-lg border border-slate-200 p-0.5 text-[10px] font-semibold">
          {[
            { id: 'inclusive', label: 'Tax included in amount' },
            { id: 'exclusive', label: 'Tax on top of amount' },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ basis: b.id })}
              className={`flex-1 rounded-md px-1.5 py-1 transition ${
                line.basis === b.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      ) : null}
      {taxRates.length && line.method === 'percent' && !disabled ? (
        <div className="flex flex-wrap gap-1">
          {taxRates
            .filter((r) => r.type === 'percent')
            .slice(0, 6)
            .map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onChange({ rate: String(r.rate) })}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                title={`${r.name} · ${r.agency || ''}`}
              >
                {r.name} {r.rate}%
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function SaleCard({ icon: Icon, tone, title, subtitle, line, computed, metrics, taxRates, onChange, locked, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-2xs">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className={`rounded-lg p-1.5 ${tone}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-[10px] font-semibold uppercase text-slate-400">Tax</span>
          <span className="text-lg font-black text-slate-900">{inr(computed.tax)}</span>
        </div>
      </header>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        <label className="block text-[11px] font-bold text-slate-600">
          Tax name
          <input value={line.label} onChange={(e) => onChange({ label: e.target.value })} disabled={locked} className={`${INPUT} mt-1`} />
        </label>
        <div className="text-[11px] font-bold text-slate-600">
          Sale amount
          <div className="mt-1 space-y-1.5">{children ?? <SourceSelect value={line.baseSource} metrics={metrics} onChange={(v) => onChange({ baseSource: v })} disabled={locked} />}</div>
        </div>
        <div className="text-[11px] font-bold text-slate-600">
          Tax rate
          <div className="mt-1">
            <RateInputs line={line} taxRates={taxRates} onChange={onChange} disabled={locked} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TaxCalculatorPage() {
  const [preset, setPreset] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [platform, setPlatform] = useState(null);
  const [figuresLoading, setFiguresLoading] = useState(true);
  const [figuresError, setFiguresError] = useState('');
  const [lines, setLines] = useState(defaultLines);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [currentId, setCurrentId] = useState('');
  const [currentStatus, setCurrentStatus] = useState('draft');
  const [saved, setSaved] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showVendors, setShowVendors] = useState(false);
  const [showFigures, setShowFigures] = useState(false);

  const locked = Boolean(currentId) && currentStatus === 'final';
  const metrics = platform?.metrics || [];
  const figures = platform?.figures || {};
  const taxRates = platform?.taxRates || [];
  const { rows, totals } = useMemo(() => computeTotals(lines, figures), [lines, figures]);
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const loadFigures = useCallback(async () => {
    if (preset === 'custom' && !startDate && !endDate) return;
    setFiguresLoading(true);
    setFiguresError('');
    try {
      setPlatform(await adminFinanceApi.getTaxFigures(periodParams(preset, startDate, endDate)));
    } catch (err) {
      setFiguresError(err?.response?.data?.message || 'Could not fetch platform figures');
    } finally {
      setFiguresLoading(false);
    }
  }, [preset, startDate, endDate]);

  const loadSaved = useCallback(async () => {
    try {
      const res = await adminFinanceApi.listTaxCalculations();
      setSaved(res.data || []);
    } catch {
      setSaved([]);
    }
  }, []);

  useEffect(() => {
    loadFigures();
  }, [loadFigures]);
  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const updateLine = (id, patch) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addCustom = (template = TEMPLATES[TEMPLATES.length - 1]) =>
    setLines((prev) => [...prev, { id: newId(), kind: 'custom', baseAmount: '', note: '', ...template, rate: String(template.rate ?? '') }]);
  const removeLine = (id) => setLines((prev) => prev.filter((l) => l.id !== id));

  const vendorLine = lines.find((l) => l.kind === 'vendor_sale');
  const adminLine = lines.find((l) => l.kind === 'admin_sale');
  const customLines = lines.filter((l) => l.kind === 'custom');

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const startNew = () => {
    setLines(defaultLines());
    setTitle('');
    setNotes('');
    setCurrentId('');
    setCurrentStatus('draft');
  };

  const openSaved = async (id) => {
    try {
      const res = await adminFinanceApi.getTaxCalculation(id);
      const row = res.data;
      setPreset(row.period?.preset || 'month');
      setStartDate(row.period?.startDate || '');
      setEndDate(row.period?.endDate || '');
      setLines(
        (row.lines || []).map((l) => ({
          ...l,
          id: newId(),
          rate: String(l.rate ?? ''),
          baseAmount: l.baseSource === 'manual' ? String(l.baseAmount ?? '') : '',
        }))
      );
      setTitle(row.title || '');
      setNotes(row.notes || '');
      setCurrentId(row._id);
      setCurrentStatus(row.status || 'draft');
    } catch (err) {
      flash('error', err?.response?.data?.message || 'Could not open calculation');
    }
  };

  const save = async (status) => {
    if (!title.trim()) {
      flash('error', 'Give this calculation a name before saving');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        notes,
        status,
        period: periodParams(preset, startDate, endDate),
        lines: lines.map(({ id, ...l }) => ({ ...l, rate: Number(l.rate) || 0, baseAmount: Number(l.baseAmount) || 0 })),
      };
      const res = currentId
        ? await adminFinanceApi.updateTaxCalculation(currentId, payload)
        : await adminFinanceApi.createTaxCalculation(payload);
      setCurrentId(res.data._id);
      setCurrentStatus(res.data.status);
      flash('success', `${res.message} · Net tax ${inr(res.data.totals?.netTaxPayable)}`);
      loadSaved();
    } catch (err) {
      flash('error', err?.response?.data?.message || 'Could not save calculation');
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    try {
      const res = await adminFinanceApi.updateTaxCalculation(currentId, { status: 'draft' });
      setCurrentStatus(res.data.status);
      flash('success', 'Reopened as draft — you can edit it now');
      loadSaved();
    } catch (err) {
      flash('error', err?.response?.data?.message || 'Could not reopen');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this saved draft calculation?')) return;
    try {
      await adminFinanceApi.deleteTaxCalculation(id);
      if (id === currentId) startNew();
      loadSaved();
    } catch (err) {
      flash('error', err?.response?.data?.message || 'Could not delete');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
            <Calculator className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Tax Calculator</h1>
            <p className="text-xs text-slate-500 sm:text-sm">
              Tax on vendor sales (fetched from the platform), admin sales and any extra taxes or deductions you add
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FilePlus2 className="h-3.5 w-3.5" /> New calculation
          </button>
          <button
            type="button"
            onClick={loadFigures}
            disabled={figuresLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${figuresLoading ? 'animate-spin' : ''}`} /> Fetch platform figures
          </button>
        </div>
      </div>

      {/* Period */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 font-bold text-slate-400">
            <Calendar className="h-3 w-3" /> Tax period:
          </span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={locked}
              onClick={() => setPreset(p.id)}
              className={`rounded-md px-2 py-0.5 font-medium transition disabled:opacity-50 ${
                preset === p.id ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' ? (
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} disabled={locked} onChange={(e) => setStartDate(e.target.value)} className="rounded border border-slate-300 px-2 py-0.5" />
            <span className="text-slate-400">to</span>
            <input type="date" value={endDate} disabled={locked} onChange={(e) => setEndDate(e.target.value)} className="rounded border border-slate-300 px-2 py-0.5" />
          </div>
        ) : null}
      </div>

      {figuresError ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
          <AlertCircle className="h-4 w-4" /> {figuresError}
        </div>
      ) : null}
      {message ? (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold ${
            message.type === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      ) : null}
      {locked ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800">
          <span className="flex items-center gap-2 font-semibold">
            <Lock className="h-4 w-4" /> This calculation is final and locked.
          </span>
          <button type="button" onClick={reopen} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-bold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100">
            <Unlock className="h-3.5 w-3.5" /> Reopen as draft
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {/* 1. Vendor sale */}
          {vendorLine ? (
            <SaleCard
              icon={Store}
              tone="bg-emerald-100 text-emerald-700"
              title="1 · Tax on total vendor sale"
              subtitle="Sale amount is fetched automatically from the platform for the selected period"
              line={vendorLine}
              computed={rowById.get(vendorLine.id) || { tax: 0 }}
              metrics={metrics}
              taxRates={taxRates}
              locked={locked}
              onChange={(patch) => updateLine(vendorLine.id, patch)}
            >
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-700">
                    <Database className="h-3 w-3" /> From platform
                  </span>
                  {figuresLoading ? <Loader2 className="h-3 w-3 animate-spin text-emerald-700" /> : null}
                </div>
                <span className="block text-base font-black text-emerald-950">{inr(figures.vendor_total_sale)}</span>
                <span className="text-[10px] font-medium text-emerald-700">
                  {Number(platform?.counts?.orders || 0).toLocaleString('en-IN')} orders · product + delivery, cancelled excluded
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowVendors((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:underline"
              >
                {showVendors ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Vendor-wise sale ({platform?.vendorSales?.length || 0})
              </button>
            </SaleCard>
          ) : null}
          {showVendors && platform?.vendorSales?.length ? (
            <div className="-mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <table className="w-full text-xs">
                <thead className="text-[10px] font-bold uppercase text-slate-400">
                  <tr>
                    <th className="px-2 py-1 text-left">Vendor</th>
                    <th className="px-2 py-1 text-right">Orders</th>
                    <th className="px-2 py-1 text-right">Sale</th>
                    <th className="px-2 py-1 text-right">Tax at this rate</th>
                  </tr>
                </thead>
                <tbody>
                  {platform.vendorSales.map((v) => (
                    <tr key={v.vendorId} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-semibold text-slate-800">{v.vendorName}</td>
                      <td className="px-2 py-1.5 text-right">{v.orders}</td>
                      <td className="px-2 py-1.5 text-right">{inr(v.sales)}</td>
                      <td className="px-2 py-1.5 text-right font-bold">
                        {inr(computeLine({ ...vendorLine, baseSource: 'manual', baseAmount: v.sales }, figures).tax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* 2. Admin sale */}
          {adminLine ? (
            <SaleCard
              icon={UserCog}
              tone="bg-indigo-100 text-indigo-700"
              title="2 · Tax on admin sale"
              subtitle="Type the admin sale amount, or pick a figure the platform has calculated"
              line={adminLine}
              computed={rowById.get(adminLine.id) || { tax: 0 }}
              metrics={metrics}
              taxRates={taxRates}
              locked={locked}
              onChange={(patch) => updateLine(adminLine.id, patch)}
            >
              <SourceSelect value={adminLine.baseSource} metrics={metrics} disabled={locked} onChange={(v) => updateLine(adminLine.id, { baseSource: v })} />
              {adminLine.baseSource === 'manual' ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adminLine.baseAmount}
                  disabled={locked}
                  onChange={(e) => updateLine(adminLine.id, { baseAmount: e.target.value })}
                  placeholder="Admin sale amount ₹"
                  className={`${INPUT} text-right font-semibold`}
                />
              ) : (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-sm font-black text-indigo-950">
                  {inr(figures[adminLine.baseSource])}
                </div>
              )}
            </SaleCard>
          ) : null}

          {/* 3. Custom */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-2xs">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">3 · Additional taxes &amp; deductions</h3>
                <p className="text-[11px] text-slate-500">
                  Add any tax or deduction: your own name, amount (typed or from the platform), rate or fixed amount
                </p>
              </div>
              {!locked ? (
                <button
                  type="button"
                  onClick={() => addCustom()}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" /> Add tax / deduction
                </button>
              ) : null}
            </header>
            {!locked ? (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2 text-[11px]">
                <span className="font-semibold text-slate-400">Quick add:</span>
                {TEMPLATES.slice(0, -1).map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => addCustom(t)}
                    className={`rounded-md px-2 py-0.5 font-semibold ring-1 ${
                      t.effect === 'deduct' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    }`}
                  >
                    {t.effect === 'deduct' ? '−' : '+'} {t.label}
                  </button>
                ))}
                <span className="text-[10px] text-slate-400">(rates are editable starting points)</span>
              </div>
            ) : null}
            {customLines.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">No additional taxes or deductions yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customLines.map((line) => {
                  const r = rowById.get(line.id) || { base: 0, tax: 0 };
                  const deduct = line.effect === 'deduct';
                  return (
                    <div key={line.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1.3fr_0.8fr_1.4fr_1.4fr_auto]">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Tax name
                        <input value={line.label} disabled={locked} onChange={(e) => updateLine(line.id, { label: e.target.value })} placeholder="e.g. Professional tax" className={`${INPUT} mt-1`} />
                      </label>
                      <div className="text-[11px] font-bold text-slate-600">
                        Type
                        <div className="mt-1 flex rounded-lg border border-slate-200 p-0.5">
                          {[
                            { id: 'add', label: 'Add', icon: Plus },
                            { id: 'deduct', label: 'Deduct', icon: Minus },
                          ].map(({ id, label, icon: I }) => (
                            <button
                              key={id}
                              type="button"
                              disabled={locked}
                              onClick={() => updateLine(line.id, { effect: id })}
                              className={`flex flex-1 items-center justify-center gap-0.5 rounded-md py-1 text-[11px] transition ${
                                line.effect === id
                                  ? id === 'add'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-rose-600 text-white'
                                  : 'text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <I className="h-3 w-3" /> {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="text-[11px] font-bold text-slate-600">
                        Amount (spend / base)
                        <div className="mt-1 space-y-1.5">
                          <SourceSelect value={line.baseSource} metrics={metrics} disabled={locked} onChange={(v) => updateLine(line.id, { baseSource: v })} />
                          {line.baseSource === 'manual' ? (
                            line.method === 'percent' ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.baseAmount}
                                disabled={locked}
                                onChange={(e) => updateLine(line.id, { baseAmount: e.target.value })}
                                placeholder="Amount ₹"
                                className={`${INPUT} text-right`}
                              />
                            ) : (
                              <p className="text-[10px] font-medium text-slate-400">Fixed amount — no base needed</p>
                            )
                          ) : (
                            <p className="text-[11px] font-black text-slate-800">{inr(r.base)}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] font-bold text-slate-600">
                        Tax
                        <div className="mt-1">
                          <RateInputs line={line} taxRates={taxRates} disabled={locked} onChange={(patch) => updateLine(line.id, patch)} />
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-2 lg:flex-col lg:items-end">
                        <span className={`text-sm font-black ${deduct ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {deduct ? '−' : '+'} {inr(r.tax)}
                        </span>
                        {!locked ? (
                          <button type="button" onClick={() => removeLine(line.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Platform figures reference */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-2xs">
            <button
              type="button"
              onClick={() => setShowFigures((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Database className="h-4 w-4 text-slate-500" /> Platform figures for this period
              </span>
              {showFigures ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            </button>
            {showFigures ? (
              <div className="grid gap-2 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.map((m) => (
                  <div key={m.key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                    <span className="block text-[10px] font-semibold uppercase text-slate-400">{m.group}</span>
                    <span className="block text-xs font-semibold text-slate-700">{m.label}</span>
                    <span className="block text-sm font-black text-slate-900">{inr(m.amount)}</span>
                    <span className="block text-[10px] text-slate-500">{m.description}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        {/* Summary + save */}
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="bg-slate-900 px-4 py-4 text-white">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Net tax payable</span>
              <div className={`mt-1 text-3xl font-black ${totals.netTaxPayable < 0 ? 'text-rose-300' : ''}`}>{inr(totals.netTaxPayable)}</div>
              <span className="text-[11px] text-slate-400">
                {totals.taxableSales > 0 ? `${totals.effectiveRate}% of ${inr(totals.taxableSales)} taxable sales` : 'Add a sale amount and rate to begin'}
              </span>
            </div>
            <dl className="divide-y divide-slate-100 text-xs">
              {[
                ['Tax on vendor sales', totals.taxOnVendorSales, 'text-slate-900'],
                ['Tax on admin sales', totals.taxOnAdminSales, 'text-slate-900'],
                ['Additional taxes', totals.additionalTaxes, 'text-emerald-700', '+'],
                ['Gross tax', totals.grossTax, 'text-slate-900 font-black'],
                ['Deductions', totals.deductions, 'text-rose-700', '−'],
              ].map(([label, value, cls, sign]) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <dt className="text-slate-600">{label}</dt>
                  <dd className={`font-bold ${cls}`}>
                    {sign && value ? `${sign} ` : ''}
                    {inr(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <h3 className="mb-2 text-sm font-bold text-slate-900">{currentId ? 'Saved calculation' : 'Save calculation'}</h3>
            <div className="space-y-2">
              <input value={title} disabled={locked} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GST return — Nov 2026" className={INPUT} />
              <textarea rows={2} value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className={INPUT} />
              {!locked ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => save('draft')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save draft
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => save('final')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-2 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    <Lock className="h-3.5 w-3.5" /> Save as final
                  </button>
                </div>
              ) : null}
              <p className="text-[10px] text-slate-400">
                Saving re-fetches platform figures and recalculates on the server, so saved totals always match the platform.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-2xs">
            <h3 className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">
              <FolderOpen className="h-4 w-4 text-slate-500" /> Saved calculations ({saved.length})
            </h3>
            {saved.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-slate-400">Nothing saved yet.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {saved.map((s) => (
                  <li key={s._id} className={`flex items-center justify-between gap-2 px-4 py-2.5 ${s._id === currentId ? 'bg-emerald-50/60' : ''}`}>
                    <button type="button" onClick={() => openSaved(s._id)} className="min-w-0 text-left">
                      <span className="block truncate text-xs font-semibold text-slate-800">{s.title}</span>
                      <span className="text-[10px] text-slate-500">
                        {DATE_PRESETS.find((p) => p.id === s.period?.preset)?.label || 'Custom'}
                        {s.period?.preset === 'custom' ? ` ${s.period.startDate || '…'} → ${s.period.endDate || '…'}` : ''} · {inr(s.totals?.netTaxPayable)}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          s.status === 'final' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.status}
                      </span>
                      {s.status !== 'final' ? (
                        <button type="button" onClick={() => remove(s._id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete draft">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
