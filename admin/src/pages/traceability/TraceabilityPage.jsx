import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Loader2,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Copy,
  Check,
  User,
  MapPin,
  Calendar,
  Package,
  ShieldCheck,
  Phone,
  Code2,
  RefreshCw,
  SlidersHorizontal,
  Warehouse,
  HelpCircle,
  Receipt,
  Bookmark,
  Zap,
  Plus,
  Trash2,
} from 'lucide-react';
import erpApi from '../../api/erpApi';
import OrderTraceView from './OrderTraceView';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, PANEL_HEAD, TH } from '../../utils/ui';

const CATEGORY_TABS = [
  { id: 'all', label: 'All Entities' },
  { id: 'farmer', label: 'Farmers & Growers' },
  { id: 'batch', label: 'Batches & Expiry' },
  { id: 'product', label: 'Products & SKUs' },
  { id: 'invoice', label: 'Tax Invoices & Billing' },
  { id: 'grn', label: 'GRN Inwarding' },
  { id: 'order', label: 'Orders & POS' },
  { id: 'store', label: 'Stores & Hubs' },
];

const SAVED_SEARCHES_KEY = 'greengrocc_trace_saved_searches';

function when(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function money(value) {
  if (value === undefined || value === null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : String(value);
}

function qty(amount, unit) {
  if (amount === undefined || amount === null || amount === '') return '—';
  return `${amount} ${unit || ''}`.trim();
}

function joinParts(...parts) {
  return parts.filter(Boolean).join(', ');
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function Field({ label, children, mono = false, strong = false }) {
  const empty = children === undefined || children === null || children === '';
  return (
    <div className="min-w-0">
      <span className="text-slate-400 font-medium">{label}</span>
      <p className={`break-words ${strong ? 'font-bold text-slate-900 text-sm' : 'font-semibold text-slate-800'} ${mono ? 'font-mono' : ''}`}>
        {empty ? '—' : children}
      </p>
    </div>
  );
}

function Card({ icon: Icon, title, aside, children }) {
  return (
    <div className={`${PANEL} overflow-hidden`}>
      <div className={`${PANEL_HEAD} flex items-center justify-between gap-2`}>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-emerald-700" />
          {title}
        </span>
        {aside}
      </div>
      <div className="p-4 space-y-3 text-xs">{children}</div>
    </div>
  );
}

function EmptyNote({ children }) {
  return <p className="text-slate-400 text-center py-4">{children}</p>;
}

function Row({ cols = 2, children, last = false }) {
  const grid = cols === 3 ? 'grid-cols-3' : cols === 4 ? 'grid-cols-4' : 'grid-cols-2';
  return <div className={`grid ${grid} gap-3 ${last ? '' : 'pb-3 border-b border-slate-100'}`}>{children}</div>;
}

export default function TraceabilityPage() {
  const [params, setParams] = useSearchParams();
  const initialQ = params.get('q') || '';
  const initialType = params.get('type') || 'all';

  const [query, setQuery] = useState(initialQ);
  const [activeCategory, setActiveCategory] = useState(initialType);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawSearchFilter, setRawSearchFilter] = useState('');

  const [savedSearches, setSavedSearches] = useState(() => {
    try {
      const s = localStorage.getItem(SAVED_SEARCHES_KEY);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const persistSavedSearches = (next) => {
    setSavedSearches(next);
    try {
      localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // Private mode: saved searches last for this session only.
    }
  };

  const saveCurrentTraceSearch = () => {
    if (!query.trim()) return;
    const item = {
      id: `trace-custom-${Date.now()}`,
      label: `${activeCategory !== 'all' ? `${activeCategory.toUpperCase()}: ` : ''}${query.trim()}`,
      q: query.trim(),
      type: activeCategory,
    };
    persistSavedSearches([item, ...savedSearches]);
  };

  const deleteSavedSearch = (id) => {
    persistSavedSearches(savedSearches.filter((s) => s.id !== id));
  };

  const executeSearch = async (val, entityType = activeCategory) => {
    const q = String(val ?? query).trim();
    if (!q) return;

    setLoading(true);
    setError('');
    try {
      const apiParams = { q };
      if (entityType && entityType !== 'all') {
        apiParams.entity = entityType;
      }
      const res = await erpApi.search(q, apiParams);
      setResult(res.data);
      setParams({ q, type: entityType });
    } catch (err) {
      console.error('Search error:', err);
      setError(err.response?.data?.message || 'Traceability search failed. Check network or search term.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQ) {
      executeSearch(initialQ, initialType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const graph = result?.graph || {};
  const current = result?.current || {};
  const isMulti = Boolean(result?.isMultiMatch);
  const matches = result?.matches || [];

  const filteredMatches = useMemo(() => {
    if (!isMulti || !matches.length) return [];
    if (activeCategory === 'all') return matches;
    return matches.filter((m) => m.type === activeCategory);
  }, [isMulti, matches, activeCategory]);

  const selectMatch = (match) => {
    const target = match.entityId || match.id;
    setQuery(target);
    executeSearch(target, match.type);
  };

  const firstOf = (value) => (Array.isArray(value) ? value[0] || null : value || null);
  const farmer = graph.farmer || firstOf(graph.farmers);
  const farm = graph.farm || firstOf(graph.farms);
  const crop = graph.crop || firstOf(graph.crops);
  const product = graph.product || graph.article || null;
  const batch = graph.batch || firstOf(graph.batches);
  const grn = graph.grn || firstOf(graph.grns);
  const quality = firstOf(graph.quality);
  const storeInventories = Array.isArray(graph.storeInventories) ? graph.storeInventories : [];
  const store = graph.store || storeInventories[0]?.managerId || null;
  const warehouse = graph.warehouse || null;
  const order = graph.order || firstOf(graph.orders);
  const customer = graph.customer || order?.customer || null;
  const invoice = graph.invoice || firstOf(graph.invoices);
  const payment = graph.payment || firstOf(graph.payments);
  const delivery = firstOf(graph.deliveries);
  const dispatch = firstOf(graph.dispatch) || firstOf(graph.dispatches);
  const qualityParams = quality?.qualityParameters || {};
  const farmerAddress = farmer?.address || {};
  const storeName = store?.storeName || store?.name || batch?.storeName || '';

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={PAGE_KICKER}>ERP & SUPPLY CHAIN TRACEABILITY</p>
          <h1 className={PAGE_TITLE}>Omni-Search & Complete Traceability</h1>
          <p className={PAGE_SUB}>
            Search across farmers, phones, batches, SKUs, products, GRNs, farms, QR codes, invoices and orders.
          </p>
        </div>
        {result?.found && !isMulti && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className={`${BTN} text-xs gap-1.5`}
            >
              <Code2 className="h-4 w-4 text-slate-600" />
              {showRawJson ? 'Hide Raw JSON' : 'Inspect Raw Data'}
            </button>
            <button
              type="button"
              onClick={() => executeSearch(query)}
              className={`${BTN} text-xs gap-1`}
              title="Refresh Trace Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Search Form */}
      <div className={`${PANEL} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 mr-1" />
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveCategory(tab.id);
                if (query.trim()) executeSearch(query, tab.id);
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                activeCategory === tab.id
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeSearch(query);
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything: order #, farmer name, phone, batch, SKU, product, GRN, invoice, village..."
              className={`${INPUT} pl-10 text-sm`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" disabled={loading || !query.trim()} className={`${BTN_PRIMARY} px-6`}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
            Trace Everything
          </button>
        </form>

        {/* Saved Searches */}
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
                <Bookmark className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  Saved Searches
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[9px] font-semibold text-slate-700">
                    {savedSearches.length}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">Save a search to rerun it with one click.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={saveCurrentTraceSearch}
              disabled={!query.trim()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition shrink-0 self-start sm:self-auto"
            >
              <Plus className="h-3 w-3 text-emerald-600" />
              Save Current
            </button>
          </div>

          {savedSearches.length ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {savedSearches.map((item) => (
                <div key={item.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(item.q);
                      setActiveCategory(item.type || 'all');
                      executeSearch(item.q, item.type || 'all');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-mono transition border ${
                      query === item.q && activeCategory === (item.type || 'all')
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-900'
                    }`}
                  >
                    <Zap className="h-3 w-3 text-emerald-500" />
                    <span>{item.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSavedSearch(item.id);
                    }}
                    className="ml-1 text-slate-300 hover:text-rose-600 p-0.5 rounded transition"
                    title="Delete saved search"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 pt-1">No saved searches yet. Run a search and click Save Current.</p>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2.5">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Search could not be completed</p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* No Record Found */}
      {result && !result.found && (
        <div className={`${PANEL} px-6 py-14 text-center space-y-2`}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <HelpCircle className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold text-slate-800">No matching record found</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            We searched farmers, batches, catalog products, GRNs, orders, and facilities for{' '}
            <span className="font-mono font-bold text-slate-800">"{result.id}"</span>, but no records matched.
            Try searching by partial name, 10-digit mobile number, or batch code.
          </p>
        </div>
      )}

      {/* MULTI-MATCH RESULT GRID */}
      {isMulti && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Found {result.totalMatches} Matching Records for "{result.query}"
            </h2>
            <span className="text-xs text-slate-400">Click any card to load its complete trace</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMatches.map((m, idx) => (
              <div
                key={`${m.id}-${idx}`}
                onClick={() => selectMatch(m)}
                className={`${PANEL} p-4 cursor-pointer hover:border-emerald-500 hover:shadow-md transition group space-y-2.5`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
                    {m.badge || m.type}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 group-hover:text-emerald-700 transition">
                    ID: {m.id}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition">
                    {m.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{m.subtitle}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-semibold text-emerald-700">
                  <span>Trace Complete Chain</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
                </div>
              </div>
            ))}
          </div>

          {!filteredMatches.length && (
            <div className={`${PANEL} p-8 text-center text-xs text-slate-400`}>
              No {activeCategory} records found matching "{result.query}". Try clicking "All Entities".
            </div>
          )}
        </div>
      )}

      {/* SINGLE TRACE VIEW */}
      {result?.found && !isMulti && (
        <div className="space-y-6">
          {graph.orderTrace ? (
            <OrderTraceView trace={graph.orderTrace} />
          ) : (
          <>
          {/* Overview Header */}
          <div className={`${PANEL} p-5 space-y-4`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      {result.entity?.toUpperCase() || 'TRACE RECORD'}
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-900">{result.id}</span>
                    <CopyButton text={result.id} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Farm-to-consumer traceability record</p>
                </div>
              </div>

              {current.status ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  {current.status}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2 border-t border-slate-100 text-xs">
              <Field label="Product / Name">
                {current.productName || product?.name || batch?.productName || farmer?.name}
              </Field>
              <Field label="Current Location">{current.locationType}</Field>
              <Field label="Quality & Grade">{current.grade}</Field>
              <Field label="Available Quantity">{qty(current.quantity, current.unit)}</Field>
            </div>
          </div>

          {/* Provenance pipeline */}
          <div className={`${PANEL} p-4 overflow-x-auto`}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Provenance Pipeline (steps with records are highlighted)
            </p>
            <div className="flex min-w-max items-center gap-2">
              {[
                { title: '1. Farmer', active: Boolean(farmer), id: farmer?.name || farmer?.farmerId },
                { title: '2. Farm', active: Boolean(farm), id: farm?.farmName || farm?.farmId },
                { title: '3. Crop & Harvest', active: Boolean(crop), id: crop?.cropName },
                { title: '4. Quality Check', active: Boolean(quality), id: quality?.grade || quality?.status },
                { title: '5. Batch Inwarding', active: Boolean(batch || grn), id: batch?.batchNumber || batch?.batchId || grn?.grnNumber },
                { title: '6. Storage', active: Boolean(warehouse || store), id: warehouse?.warehouseName || warehouse?.name || storeName },
                { title: '7. Packaging & QR', active: Boolean(graph.crate || graph.crates?.length || graph.qr), id: graph.qr?.qrId || graph.crate?.crateId },
                { title: '8. Dispatch', active: Boolean(dispatch || delivery), id: dispatch?.dispatchId || delivery?.deliveryId },
                { title: '9. Dark Store Stock', active: Boolean(storeInventories.length), id: storeInventories.length ? `${storeInventories.length} store(s)` : '' },
                { title: '10. Order & Invoice', active: Boolean(order || invoice), id: invoice?.invoiceNumber || order?.orderId || order?.orderNumber },
              ].map((step, idx, arr) => (
                <div key={step.title} className="flex items-center gap-2">
                  <div
                    className={`rounded-xl px-3 py-2 border transition ${
                      step.active
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {step.active ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}
                      <p className="text-[11px] font-bold uppercase tracking-wider">{step.title}</p>
                    </div>
                    {step.active && step.id ? (
                      <p className="font-mono text-[10px] mt-0.5 truncate max-w-[130px]">{step.id}</p>
                    ) : null}
                  </div>
                  {idx < arr.length - 1 && <span className="text-slate-300 font-bold">→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Detail cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Farmer */}
            <Card
              icon={User}
              title="Farmer & Producer Profile"
              aside={farmer ? <span className="font-mono text-xs text-slate-500">ID: {farmer.farmerId || farmer.id || '—'}</span> : null}
            >
              {farmer ? (
                <>
                  <Row>
                    <Field label="Full Name" strong>{farmer.name}</Field>
                    <div>
                      <span className="text-slate-400 font-medium">Contact Phone</span>
                      <p className="font-semibold text-slate-900 flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {farmer.mobile || '—'}
                        {farmer.mobile && <CopyButton text={farmer.mobile} />}
                      </p>
                      {farmer.email && <p className="text-slate-500 truncate">{farmer.email}</p>}
                    </div>
                  </Row>
                  <Row>
                    <div>
                      <span className="text-slate-400 font-medium">Address</span>
                      <p className="font-medium text-slate-800 flex items-start gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>
                          {joinParts(farmerAddress.village, farmerAddress.taluka, farmerAddress.district, farmerAddress.state, farmerAddress.pincode) ||
                            farmer.farmLocation ||
                            '—'}
                        </span>
                      </p>
                    </div>
                    <Field label="Farm">{joinParts(farmer.farmName, farmer.farmArea, farmer.farmType)}</Field>
                  </Row>
                  <Row last>
                    <Field label="Status / KYC">{joinParts(farmer.status, farmer.kycStatus && `KYC ${farmer.kycStatus}`)}</Field>
                    <Field label="Field Manager">{graph.manager?.name || farmer.managerId}</Field>
                  </Row>
                </>
              ) : (
                <EmptyNote>No farmer record linked to this result</EmptyNote>
              )}
            </Card>

            {/* Crop & farm */}
            <Card
              icon={Calendar}
              title="Crop & Farm"
              aside={crop?.cropId ? <span className="font-mono text-xs text-slate-500">Crop ID: {crop.cropId}</span> : null}
            >
              {crop || farm ? (
                <>
                  <Row>
                    <Field label="Crop & Variety" strong>{joinParts(crop?.cropName, crop?.variety)}</Field>
                    <Field label="Farming Method">{joinParts(crop?.farmingMethod, crop?.farmingType)}</Field>
                  </Row>
                  <Row>
                    <Field label="Sowing Date">{crop?.sowingDate ? formatDateOnly(crop.sowingDate) : ''}</Field>
                    <Field label="Harvest Date">
                      {crop?.actualHarvestDate || crop?.expectedHarvestDate
                        ? formatDateOnly(crop.actualHarvestDate || crop.expectedHarvestDate)
                        : ''}
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Farm">{joinParts(farm?.farmName, farm?.farmNumber)}</Field>
                    <Field label="Farm Area">
                      {farm?.area ? `${farm.area} ${farm.areaUnit || ''}` : crop?.area ? `${crop.area} ${crop.areaUnit || ''}` : ''}
                    </Field>
                  </Row>
                  <Row last>
                    <Field label="Soil / Irrigation">
                      {joinParts(farm?.soilType, farm?.irrigationType || crop?.irrigationType, farm?.waterSource)}
                    </Field>
                    <Field label="Expected / Available Quantity">
                      {joinParts(
                        crop?.estimatedQuantity || crop?.expectedProduction ? qty(crop.estimatedQuantity || crop.expectedProduction, crop.unit) : '',
                        crop?.availableQuantity ? `${crop.availableQuantity} available` : ''
                      )}
                    </Field>
                  </Row>
                </>
              ) : (
                <EmptyNote>No crop or farm record linked to this result</EmptyNote>
              )}
            </Card>

            {/* Batch & GRN */}
            <Card
              icon={Package}
              title="Batch & Goods Receipt Note (GRN)"
              aside={batch ? <span className="font-mono text-xs font-bold text-emerald-800">{batch.batchNumber || batch.batchId}</span> : null}
            >
              {batch || grn ? (
                <>
                  <Row>
                    <div>
                      <Field label="Batch Number" mono strong>{batch?.batchNumber || batch?.batchId}</Field>
                      <p className="text-slate-500 font-mono text-[11px]">SKU: {batch?.sku || product?.sku || '—'}</p>
                    </div>
                    <div>
                      <Field label="GRN Reference" mono>{batch?.grnNumber || grn?.grnNumber || grn?.grnId}</Field>
                      <p className="text-slate-500">Supplier: {batch?.supplierName || grn?.supplierName || '—'}</p>
                    </div>
                  </Row>
                  <Row cols={3}>
                    <Field label="Mfg / Pack Date">{batch?.mfgDate ? formatDateOnly(batch.mfgDate) : ''}</Field>
                    <Field label="Expiry Date">{batch?.expiryDate ? formatDateOnly(batch.expiryDate) : ''}</Field>
                    <div>
                      <span className="text-slate-400 font-medium">Status</span>
                      <p className="mt-0.5">
                        {batch?.status ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              batch.status === 'expired'
                                ? 'bg-rose-100 text-rose-800'
                                : batch.status === 'near_expiry'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {String(batch.status).toUpperCase()}
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-800">—</span>
                        )}
                      </p>
                    </div>
                  </Row>
                  <Row cols={3} last>
                    <Field label="Initial Inward">{qty(batch?.initialQty ?? batch?.quantity, batch?.unit)}</Field>
                    <Field label="Current Balance">{qty(batch?.currentQty, batch?.unit)}</Field>
                    <Field label="Unit Cost / MRP">
                      {batch?.unitCost != null || batch?.mrp != null ? `${money(batch?.unitCost)} / ${money(batch?.mrp)}` : ''}
                    </Field>
                  </Row>
                </>
              ) : (
                <EmptyNote>No batch or GRN record linked to this result</EmptyNote>
              )}
            </Card>

            {/* Quality */}
            <Card
              icon={ShieldCheck}
              title="Quality Inspection"
              aside={quality?.inspectionId || quality?.qualityCheckId ? (
                <span className="font-mono text-xs text-slate-500">{quality.inspectionId || quality.qualityCheckId}</span>
              ) : null}
            >
              {quality ? (
                <>
                  <Row>
                    <Field label="Grade" strong>{quality.grade || qualityParams.overallQuality}</Field>
                    <Field label="Status">{quality.status}</Field>
                  </Row>
                  <Row cols={3}>
                    <Field label="Freshness">{quality.freshness || qualityParams.freshness}</Field>
                    <Field label="Moisture">{quality.moisture || qualityParams.moisture}</Field>
                    <Field label="Damage">{quality.damage || qualityParams.damage}</Field>
                  </Row>
                  <Row cols={3}>
                    <Field label="Grade A / B / C Qty">
                      {quality.gradeAQuantity != null
                        ? `${quality.gradeAQuantity || 0} / ${quality.gradeBQuantity || 0} / ${quality.gradeCQuantity || 0}`
                        : ''}
                    </Field>
                    <Field label="Rejected Qty">{quality.rejectedQuantity}</Field>
                    <Field label="Lab Reports">{quality.labReports?.length ? `${quality.labReports.length} file(s)` : ''}</Field>
                  </Row>
                  <Row last>
                    <Field label="Inspector">{quality.inspectorName || quality.inspectorId}</Field>
                    <Field label="Inspected At">
                      {when(quality.inspectionCompletedAt || quality.inspectionDate || quality.createdAt)}
                    </Field>
                  </Row>
                  {quality.qualityRemarks || quality.remarks ? (
                    <p className="text-slate-600">Remarks: {quality.qualityRemarks || quality.remarks}</p>
                  ) : null}
                </>
              ) : (
                <EmptyNote>No quality inspection recorded for this result</EmptyNote>
              )}
            </Card>

            {/* Storage & dark store stock */}
            <Card
              icon={Warehouse}
              title="Storage & Dark Store Stock"
              aside={storeName ? <span className="font-mono text-xs text-slate-500">{storeName}</span> : null}
            >
              {store || warehouse || storeInventories.length || batch?.currentQty != null ? (
                <>
                  <Row>
                    <div>
                      <Field label="Dark Store" strong>{storeName}</Field>
                      {store ? <p className="text-slate-500">{joinParts(store.storeAddress, store.area, store.city)}</p> : null}
                    </div>
                    <Field label="Warehouse">{warehouse?.warehouseName || warehouse?.name || warehouse?.warehouseId}</Field>
                  </Row>
                  {storeInventories.length ? (
                    <div className="rounded-lg border border-slate-200/80 overflow-hidden">
                      <table className="min-w-full text-[11px]">
                        <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-1 px-2 text-left">Store</th>
                            <th className="py-1 px-2 text-right">On Hand</th>
                            <th className="py-1 px-2 text-right">Reserved</th>
                            <th className="py-1 px-2 text-right">Available</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {storeInventories.map((inv) => {
                            const onHand = Number(inv.stockCount) || 0;
                            const held = Number(inv.heldCount) || 0;
                            return (
                              <tr key={inv._id}>
                                <td className="py-1 px-2 font-medium text-slate-800">
                                  {inv.managerId?.storeName || inv.managerId?.name || '—'}
                                </td>
                                <td className="py-1 px-2 text-right font-mono">{qty(onHand, inv.unit)}</td>
                                <td className="py-1 px-2 text-right font-mono">{held}</td>
                                <td className="py-1 px-2 text-right font-mono font-semibold">{Math.max(0, onHand - held)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Row cols={2} last>
                      <Field label="Batch On Hand">{qty(batch?.currentQty, batch?.unit)}</Field>
                      <Field label="Store Location">{batch?.storageLocation}</Field>
                    </Row>
                  )}
                </>
              ) : (
                <EmptyNote>No storage or dark store stock linked to this result</EmptyNote>
              )}
            </Card>

            {/* Invoice / order */}
            <Card
              icon={Receipt}
              title="Invoice & Order"
              aside={(invoice || order) ? (
                <span className="font-mono text-xs font-bold text-emerald-700 flex items-center gap-1">
                  {invoice?.invoiceNumber || invoice?.invoiceId || order?.orderId || order?.orderNumber}
                  <CopyButton text={invoice?.invoiceNumber || invoice?.invoiceId || order?.orderId || order?.orderNumber} />
                </span>
              ) : null}
            >
              {invoice ? (
                <>
                  <Row>
                    <div>
                      <Field label="Invoice Number" mono strong>{invoice.invoiceNumber || invoice.invoiceId}</Field>
                      <p className="text-slate-500">Channel: <span className="capitalize font-medium text-slate-700">{invoice.channel?.replace('_', ' ') || '—'}</span></p>
                    </div>
                    <div>
                      <Field label="Customer">{invoice.customerName || customer?.name}</Field>
                      <p className="text-slate-500 font-mono">{invoice.customerPhone || customer?.phone || '—'}</p>
                    </div>
                  </Row>
                  <Row cols={3}>
                    <div>
                      <Field label="Counter / Register">{invoice.counterName}</Field>
                      <p className="text-[11px] text-slate-400">Cashier: {invoice.cashierName || '—'}</p>
                    </div>
                    <div>
                      <Field label="Payment Method">{invoice.paymentMethod}</Field>
                      <p className="text-[11px] text-slate-400 capitalize">Status: {invoice.paymentStatus || '—'}</p>
                    </div>
                    <Field label="Billed At">{when(invoice.createdAt)}</Field>
                  </Row>

                  {Array.isArray(invoice.items) && invoice.items.length > 0 && (
                    <div className="pb-3 border-b border-slate-100">
                      <span className="text-slate-400 font-medium block mb-1.5">Billed Items ({invoice.items.length})</span>
                      <div className="rounded-lg border border-slate-200/80 overflow-hidden bg-slate-50/50">
                        <table className="min-w-full text-[11px]">
                          <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-1 px-2 text-left">Item</th>
                              <th className="py-1 px-2 text-center">Qty</th>
                              <th className="py-1 px-2 text-right">Rate</th>
                              <th className="py-1 px-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {invoice.items.map((it, i) => {
                              const itemQty = Number(it.qty ?? it.quantity) || 0;
                              return (
                                <tr key={i}>
                                  <td className="py-1 px-2 font-medium text-slate-800">{it.name}</td>
                                  <td className="py-1 px-2 text-center font-mono">{qty(itemQty, it.unit)}</td>
                                  <td className="py-1 px-2 text-right font-mono">{money(it.price)}</td>
                                  <td className="py-1 px-2 text-right font-mono font-semibold">
                                    {money(it.total ?? itemQty * (Number(it.price) || 0))}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <Row cols={4} last>
                    <Field label="Subtotal">{money(invoice.subtotal)}</Field>
                    <Field label="Discount">{invoice.discount ? `-${money(invoice.discount)}` : ''}</Field>
                    <Field label="Tax">{money(invoice.gstTax ?? invoice.taxAmount)}</Field>
                    <Field label="Grand Total" strong>{money(invoice.grandTotal ?? invoice.amount)}</Field>
                  </Row>
                </>
              ) : order ? (
                <>
                  <Row>
                    <div>
                      <Field label="Order" mono strong>{order.orderId || order.orderNumber || order.id}</Field>
                      <p className="text-slate-500">{order.customerName || customer?.name || '—'}</p>
                    </div>
                    <div>
                      <Field label="Status">{order.status}</Field>
                      <p className="text-slate-500">{order.paymentMethod || payment?.paymentMethod || payment?.method || '—'}</p>
                    </div>
                  </Row>
                  <Row cols={3} last>
                    <Field label="Delivery">{delivery ? joinParts(delivery.deliveryId, delivery.deliveryStatus) : ''}</Field>
                    <Field label="Driver / Vehicle">{delivery ? joinParts(delivery.driverId, delivery.vehicleId) : ''}</Field>
                    <Field label="Order Total" strong>{money(order.totalAmount ?? order.total)}</Field>
                  </Row>
                </>
              ) : (
                <EmptyNote>No invoice or order linked to this result</EmptyNote>
              )}
            </Card>
          </div>

          {/* Timeline */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <GitBranch className="h-4 w-4 text-emerald-700" />
              Chronological Audit Trail & State Transitions
            </h2>

            {!result.timeline?.length ? (
              <div className={`${PANEL} p-6 text-center text-xs text-slate-400`}>
                No timeline events recorded for this entity
              </div>
            ) : (
              <ol className="relative border-l border-emerald-200 ml-4 space-y-4">
                {(result.timeline || []).map((ev, idx) => (
                  <li key={`${ev.title}-${idx}`} className="ml-6">
                    <span className="absolute -left-2.5 mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 ring-4 ring-white">
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                    <div className={`${PANEL} p-3.5 space-y-1`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-slate-900 text-xs">{ev.title}</p>
                        <span className="text-[11px] text-slate-400 font-medium">{when(ev.at)}</span>
                      </div>
                      {ev.id && <p className="font-mono text-[11px] text-emerald-700 font-semibold">{ev.id}</p>}
                      {ev.status && <p className="text-[11px] text-slate-500">Status: {ev.status}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
          </>
          )}

          {/* Audit history */}
          {(result.audits || []).length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">System Audit History</h2>
              <div className={`${PANEL} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        {['Audit ID', 'Action', 'Field Changed', 'User / System', 'Timestamp'].map((h) => (
                          <th key={h} className={TH}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.audits.map((row) => (
                        <tr key={row.auditId || row._id} className="hover:bg-slate-50/60 transition">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{row.auditId || '—'}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.action || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.fieldChanged || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.changedBy || row.userId || '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{when(row.dateTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Raw data inspector */}
          {showRawJson && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
              <div className="relative flex flex-col w-full max-w-4xl max-h-[85vh] bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-950">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Raw Database Payload</h3>
                      <p className="text-[11px] text-slate-400">Complete graph returned for this search.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={JSON.stringify(result.rawPayload || graph, null, 2)} label="Copy All JSON" />
                    <button
                      type="button"
                      onClick={() => setShowRawJson(false)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border-b border-slate-800">
                  <input
                    type="text"
                    value={rawSearchFilter}
                    onChange={(e) => setRawSearchFilter(e.target.value)}
                    placeholder="Filter JSON keys or values..."
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
                  <pre className="text-emerald-400">
                    {JSON.stringify(
                      rawSearchFilter
                        ? Object.fromEntries(
                            Object.entries(result.rawPayload || graph).filter(
                              ([k, v]) =>
                                k.toLowerCase().includes(rawSearchFilter.toLowerCase()) ||
                                JSON.stringify(v).toLowerCase().includes(rawSearchFilter.toLowerCase())
                            )
                          )
                        : result.rawPayload || graph,
                      null,
                      2
                    )}
                  </pre>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5 bg-slate-950 text-[11px] text-slate-400">
                  <span>Total JSON Bytes: {JSON.stringify(result.rawPayload || graph).length.toLocaleString()} bytes</span>
                  <button
                    type="button"
                    onClick={() => setShowRawJson(false)}
                    className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
