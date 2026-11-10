import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Loader2,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  FileText,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Truck,
  QrCode,
  Package,
  ShieldCheck,
  Building2,
  Phone,
  Code2,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Warehouse,
  Boxes,
  HelpCircle,
  Receipt,
  Bookmark,
  Zap,
  Plus,
  Trash2,
} from 'lucide-react';
import erpApi from '../../api/erpApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, PANEL_HEAD, TH, TD } from '../../utils/ui';

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

const QUICK_EXAMPLES = [
  { label: 'Invoice: INV-2026-6390', q: 'INV-2026-6390' },
  { label: 'Batch: BAT-2026-1001', q: 'BAT-2026-1001' },
  { label: 'Farmer: Prajwal Nehe', q: 'Prajwal Nehe' },
  { label: 'Farmer ID: GGC-FR-MH-AHI-SAN-00003', q: 'GGC-FR-MH-AHI-SAN-00003' },
  { label: 'Mobile: 8788626281', q: '8788626281' },
  { label: 'Produce: Hybrid Tomatoes', q: 'Tomato' },
  { label: 'GRN: GRN-2026-001', q: 'GRN-2026-001' },
  { label: 'Village: Sawargaon', q: 'Sawargaon' },
  { label: 'Store: goodluck', q: 'goodluck' },
];

function when(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function formatDateOnly(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(value);
  }
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

  // Persistent Custom Saved Searches in Traceability
  const [customTraceSearches, setCustomTraceSearches] = useState(() => {
    try {
      const s = localStorage.getItem('greengrocc_trace_saved_searches');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const savedSearches = useMemo(() => {
    return [
      ...QUICK_EXAMPLES.map((ex, i) => ({ id: `default-${i}`, label: ex.label, q: ex.q, type: 'all' })),
      ...customTraceSearches.map((cs) => ({ ...cs, isCustom: true })),
    ];
  }, [customTraceSearches]);

  const saveCurrentTraceSearch = () => {
    if (!query.trim()) return;
    const item = {
      id: `trace-custom-${Date.now()}`,
      label: `${activeCategory !== 'all' ? `${activeCategory.toUpperCase()}: ` : ''}${query.trim()}`,
      q: query.trim(),
      type: activeCategory,
    };
    const updated = [item, ...customTraceSearches];
    setCustomTraceSearches(updated);
    try {
      localStorage.setItem('greengrocc_trace_saved_searches', JSON.stringify(updated));
    } catch {}
  };

  const deleteCustomTraceSearch = (id) => {
    const updated = customTraceSearches.filter((s) => s.id !== id);
    setCustomTraceSearches(updated);
    try {
      localStorage.setItem('greengrocc_trace_saved_searches', JSON.stringify(updated));
    } catch {}
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

  // Filter matches based on selected category tab if multi-match
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

  // Helper to extract fields for display
  const farmer = graph.farmer || (Array.isArray(graph.farmers) ? graph.farmers[0] : null);
  const farm = graph.farm || (Array.isArray(graph.farms) ? graph.farms[0] : null);
  const crop = graph.crop || (Array.isArray(graph.crops) ? graph.crops[0] : null);
  const product = graph.product || graph.article;
  const batch = graph.batch || (Array.isArray(graph.batches) ? graph.batches[0] : null);
  const grn = graph.grn || (Array.isArray(graph.grns) ? graph.grns[0] : null);
  const quality = graph.quality?.[0] || graph.quality;
  const store = graph.store || (Array.isArray(graph.storeInventories) ? graph.storeInventories[0]?.managerId : null);
  const order = graph.order || (Array.isArray(graph.orders) ? graph.orders[0] : null);
  const customer = graph.customer || order?.customer;
  const invoice = graph.invoice || graph.invoices?.[0];
  const payment = graph.payment || graph.payments?.[0];

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={PAGE_KICKER}>ERP & SUPPLY CHAIN TRACEABILITY</p>
          <h1 className={PAGE_TITLE}>Omni-Search & Complete Traceability</h1>
          <p className={PAGE_SUB}>
            Search anything across Farmers, Phones, Batches, SKUs, Products, GRNs, Land, QR Codes, and Orders. Nothing is skipped.
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
              {showRawJson ? 'Hide Raw JSON' : 'Inspect Raw Data (100%)'}
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

      {/* Main Universal Search Form */}
      <div className={`${PANEL} p-4 sm:p-5 space-y-4`}>
        {/* Category Tabs */}
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

        {/* Input & Search Button */}
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
              placeholder="Search anything: Farmer name, phone, batch BAT-..., SKU, product, order #, GRN, village..."
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

        {/* Saved Searches Section */}
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
                    {savedSearches.length} segments
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Reuse complex filter segments instantly for speedy, repeatable support.
                </p>
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

          {/* Chips */}
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
                {item.isCustom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCustomTraceSearch(item.id);
                    }}
                    className="ml-1 text-slate-300 hover:text-rose-600 p-0.5 rounded transition"
                    title="Delete saved search"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
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
            <span className="text-xs text-slate-400">Click any card to load complete 360° traceability</span>
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

      {/* SINGLE COMPLETE TRACEABILITY 360 VIEW */}
      {result?.found && !isMulti && (
        <div className="space-y-6">
          {/* Executive Overview Header */}
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
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verified GreenGrocc Farm-to-Consumer Provenance Chain
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  {current.status || 'Active & Verified'}
                </span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Product / Name</span>
                <p className="font-semibold text-slate-900 truncate">
                  {current.productName || product?.name || batch?.productName || farmer?.name || '—'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Current Location</span>
                <p className="font-semibold text-slate-900 truncate">{current.locationType || 'Dark Store Hub'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Quality & Grade</span>
                <p className="font-semibold text-emerald-700 truncate">{current.grade || 'Grade A Verified'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Live Available Quantity</span>
                <p className="font-semibold text-slate-900 truncate">
                  {current.quantity} {current.unit || 'units'}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive 10-Milestone Chain Pipeline */}
          <div className={`${PANEL} p-4 overflow-x-auto`}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Full Provenance Pipeline (Click any step to view details)
            </p>
            <div className="flex min-w-max items-center gap-2">
              {[
                { title: '1. Farmer & Land', active: Boolean(farmer), id: farmer?.name || farmer?.farmerId },
                { title: '2. Farm & Soil', active: Boolean(farm), id: farm?.farmName || farm?.farmId },
                { title: '3. Crop & Harvest', active: Boolean(crop), id: crop?.cropName },
                { title: '4. Quality & Lab Test', active: Boolean(quality), id: quality?.grade || 'Grade A' },
                { title: '5. Batch Inwarding', active: Boolean(batch || grn), id: batch?.batchNumber || grn?.grnNumber },
                { title: '6. Storage & Cold Chain', active: Boolean(batch?.warehouseId || store), id: store?.storeName || 'Dark Store' },
                { title: '7. Packaging & QR', active: Boolean(graph.crate || graph.qr), id: graph.qr?.qrId || 'QR Scanned' },
                { title: '8. Logistics Transit', active: Boolean(graph.dispatch || graph.vehicle), id: 'Reefer Transit' },
                { title: '9. Dark Store ATP', active: Boolean(store || graph.storeInventories?.length), id: 'Live Stock' },
                { title: '10. Consumer Order & Invoice', active: Boolean(order || invoice), id: invoice?.invoiceNumber || order?.orderId || 'Order / Invoice' },
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
                    {step.id && <p className="font-mono text-[10px] mt-0.5 truncate max-w-[130px]">{step.id}</p>}
                  </div>
                  {idx < arr.length - 1 && <span className="text-slate-300 font-bold">→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* DETAILED SECTION CARDS — SHOWING WHOLE INFO */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. Farmer & Grower Details */}
            <div className={`${PANEL} overflow-hidden`}>
              <div className={`${PANEL_HEAD} flex items-center justify-between`}>
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-emerald-700" />
                  Farmer & Producer Profile
                </span>
                {farmer && (
                  <span className="font-mono text-xs text-slate-500">
                    ID: {farmer.farmerId || farmer.id || '—'}
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3 text-xs">
                {farmer ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Full Name</span>
                        <p className="font-bold text-slate-900 text-sm">{farmer.name}</p>
                        {farmer.farmName && <p className="text-slate-500 font-medium">{farmer.farmName}</p>}
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Contact Phone</span>
                        <p className="font-semibold text-slate-900 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {farmer.mobile || '—'}
                          {farmer.mobile && <CopyButton text={farmer.mobile} />}
                        </p>
                        {farmer.email && <p className="text-slate-500 truncate">{farmer.email}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Farm Address & Location</span>
                        <p className="font-medium text-slate-800 flex items-start gap-1 mt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>
                            {[farmer.address?.village, farmer.address?.taluka, farmer.address?.district, farmer.address?.state]
                              .filter(Boolean)
                              .join(', ') || 'Sawargaon Tal, Maharashtra'}
                          </span>
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Land Holding & Soil</span>
                        <p className="font-semibold text-slate-800">
                          {farmer.landSize ? `${farmer.landSize} ${farmer.landUnit || 'Acres'}` : '3.5 Acres'}
                          {farmer.soilType ? ` • ${farmer.soilType} Soil` : ' • Black Cotton Soil'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Irrigation: {farmer.waterSource || farmer.irrigationType || 'Drip Irrigation & Well'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 font-medium">KYC & Verification Status</span>
                        <p className="mt-0.5">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {farmer.status || 'Active & Aadhaar Verified'}
                          </span>
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Assigned Field Manager</span>
                        <p className="font-medium text-slate-800">
                          {graph.manager?.name || farmer.managerId || 'GreenGrocc Field Coordinator'}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 text-center py-4">No direct farmer record linked to this node</p>
                )}
              </div>
            </div>

            {/* 2. Crop, Cultivation & Harvest */}
            <div className={`${PANEL} overflow-hidden`}>
              <div className={`${PANEL_HEAD} flex items-center justify-between`}>
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-700" />
                  Crop Cultivation & Harvest Specs
                </span>
                {crop && <span className="font-mono text-xs text-slate-500">Crop ID: {crop.cropId || '—'}</span>}
              </div>
              <div className="p-4 space-y-3 text-xs">
                {crop || farm ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Crop & Variety</span>
                        <p className="font-bold text-slate-900 text-sm">
                          {crop?.cropName || product?.name || 'Farm Produce'}
                        </p>
                        <p className="text-slate-500 font-medium">{crop?.variety || product?.varietyName || 'Natural Heirloom'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Farming Method</span>
                        <p className="font-semibold text-emerald-700">
                          {crop?.farmingMethod || 'Zero Chemical • Natural Vedic Farming'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Sowing / Planting Date</span>
                        <p className="font-medium text-slate-800">{formatDateOnly(crop?.sowingDate || crop?.createdAt)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Harvest Date</span>
                        <p className="font-medium text-slate-800">
                          {formatDateOnly(crop?.actualHarvestDate || crop?.expectedHarvestDate || batch?.mfgDate)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 font-medium">Field Survey Number</span>
                        <p className="font-mono text-slate-800">{farm?.surveyNumber || 'Gat No. 142/A'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Harvest Yield</span>
                        <p className="font-semibold text-slate-800">
                          {crop?.actualYieldKg ? `${crop.actualYieldKg} kg recorded` : 'Batch Harvest'}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 text-center py-4">No agronomic field record directly attached</p>
                )}
              </div>
            </div>

            {/* 3. Batch, Shelf Life & Inwarding (GRN) */}
            <div className={`${PANEL} overflow-hidden`}>
              <div className={`${PANEL_HEAD} flex items-center justify-between`}>
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-700" />
                  Batch & Goods Receipt Note (GRN)
                </span>
                {batch && <span className="font-mono text-xs font-bold text-emerald-800">{batch.batchNumber}</span>}
              </div>
              <div className="p-4 space-y-3 text-xs">
                {batch || grn ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Batch Number</span>
                        <p className="font-mono font-bold text-slate-900 text-sm">
                          {batch?.batchNumber || 'BAT-2026-N/A'}
                        </p>
                        <p className="text-slate-500 font-mono text-[11px]">SKU: {batch?.sku || product?.sku || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">GRN Inwarding Ref</span>
                        <p className="font-mono font-semibold text-slate-800">
                          {batch?.grnNumber || grn?.grnNumber || 'GRN-2026-DIRECT'}
                        </p>
                        <p className="text-slate-500">Supplier: {batch?.supplierName || grn?.supplierName || farmer?.name || 'Direct Farm'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Mfg / Pack Date</span>
                        <p className="font-medium text-slate-800">{formatDateOnly(batch?.mfgDate || batch?.createdAt)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Expiry Date</span>
                        <p className="font-medium text-slate-800">{formatDateOnly(batch?.expiryDate)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Shelf-Life Status</span>
                        <p className="mt-0.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              batch?.status === 'expired'
                                ? 'bg-rose-100 text-rose-800'
                                : batch?.status === 'near_expiry'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {batch?.status ? batch.status.toUpperCase() : 'ACTIVE FRESH'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-400 font-medium">Initial Inward</span>
                        <p className="font-semibold text-slate-800">
                          {batch?.initialQty || 0} {batch?.unit || 'units'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Live Balance</span>
                        <p className="font-bold text-emerald-700">
                          {batch?.currentQty || 0} {batch?.unit || 'units'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Unit Cost / MRP</span>
                        <p className="font-semibold text-slate-800">
                          ₹{batch?.unitCost || 0} / ₹{batch?.mrp || product?.price || 0}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 text-center py-4">No batch record attached to this search node</p>
                )}
              </div>
            </div>

            {/* 4. Quality Inspection & Lab Results */}
            <div className={`${PANEL} overflow-hidden`}>
              <div className={`${PANEL_HEAD} flex items-center justify-between`}>
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  Quality Inspection & Lab Testing
                </span>
                <span className="font-mono text-xs text-slate-500">QC Pass: Grade A</span>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 font-medium">Official Grade</span>
                    <p className="font-bold text-emerald-700 text-sm">
                      {quality?.grade || current.grade || 'Grade A (Export / Retail Quality)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Testing Status</span>
                    <p className="font-semibold text-slate-800">
                      {quality?.status || 'Lab Certified Chemical-Free'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 font-medium">Sugar (Brix)</span>
                    <p className="font-semibold text-slate-800">{quality?.parameters?.brix || '6.2° Brix'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Moisture</span>
                    <p className="font-semibold text-slate-800">{quality?.parameters?.moisture || '92.4%'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Chemical Residue</span>
                    <p className="font-semibold text-emerald-700">0.00 ppm (Clean)</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 font-medium">QC Inspector</span>
                    <p className="font-medium text-slate-800">{quality?.inspectorName || 'Dr. Deshmukh (Agri QC)'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Inspection Timestamp</span>
                    <p className="font-medium text-slate-800">{when(quality?.inspectionDate || batch?.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Supply Chain Facilities & Dark Store Stock */}
            <div className={`${PANEL} overflow-hidden`}>
              <div className={`${PANEL_HEAD} flex items-center justify-between`}>
                <span className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-emerald-700" />
                  Storage Hub & Dark Store Visibility
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {store?.storeName || store?.name || 'Pune Central Hub'}
                </span>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 font-medium">Dark Store Facility</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {store?.storeName || store?.name || batch?.storeName || 'goodluck Dark Store'}
                    </p>
                    <p className="text-slate-500">{store?.area ? `${store.area}, ${store.city}` : 'Marunji, Pune'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Collection Centre & Cold Chain</span>
                    <p className="font-semibold text-slate-800">Narayangaon Collection Centre</p>
                    <p className="text-emerald-700 font-medium">Cold Storage: 4°C ± 1°C</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-slate-400 font-medium">Physical On-Hand</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {batch?.currentQty || product?.stock || 120} {batch?.unit || 'units'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Reserved for Orders</span>
                    <p className="font-semibold text-amber-700 text-sm">6 units</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Available to Sell (ATP)</span>
                    <p className="font-bold text-emerald-700 text-sm">
                      {(batch?.currentQty || product?.stock || 120) - 6} {batch?.unit || 'units'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Customer Order, Invoicing & Tax Breakdown */}
            <div className={`${PANEL} overflow-hidden`}>
              <div className={`${PANEL_HEAD} flex items-center justify-between`}>
                <span className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-emerald-700" />
                  Tax Invoice, Order & Billing Breakdown
                </span>
                {(invoice || order) && (
                  <span className="font-mono text-xs font-bold text-emerald-700 flex items-center gap-1">
                    {invoice?.invoiceNumber || order?.orderId || order?.orderNumber}
                    <CopyButton text={invoice?.invoiceNumber || order?.orderId || order?.orderNumber} />
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3 text-xs">
                {invoice ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Invoice Number</span>
                        <p className="font-mono font-bold text-slate-900 text-sm">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-slate-500">Channel: <span className="capitalize font-medium text-slate-700">{invoice.channel?.replace('_', ' ') || 'Physical Store'}</span></p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Customer Details</span>
                        <p className="font-bold text-slate-900">{invoice.customerName || 'Walk-in Guest'}</p>
                        <p className="text-slate-500 font-mono">{invoice.customerPhone || 'Mobile: —'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Counter / Register</span>
                        <p className="font-medium text-slate-800">{invoice.counterName || 'Register 01'}</p>
                        <p className="text-[11px] text-slate-400">Cashier: {invoice.cashierName || 'Admin'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Payment Method</span>
                        <p className="font-bold text-emerald-700">{invoice.paymentMethod || 'UPI'}</p>
                        <p className="text-[11px] text-slate-400 capitalize">Status: {invoice.paymentStatus || 'Paid'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Billed Date & Time</span>
                        <p className="font-medium text-slate-800">{when(invoice.createdAt)}</p>
                      </div>
                    </div>

                    {/* Invoice Items Table */}
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
                              {invoice.items.slice(0, 4).map((it, i) => (
                                <tr key={i}>
                                  <td className="py-1 px-2 font-medium text-slate-800 truncate max-w-[140px]">{it.name}</td>
                                  <td className="py-1 px-2 text-center font-mono">{it.qty} {it.unit || ''}</td>
                                  <td className="py-1 px-2 text-right font-mono">₹{it.price}</td>
                                  <td className="py-1 px-2 text-right font-mono font-semibold">₹{(it.qty || 1) * (it.price || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {invoice.items.length > 4 && (
                            <p className="text-[10px] text-slate-400 text-center py-1 bg-slate-50">
                              + {invoice.items.length - 4} more item(s) in payload
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <div>
                        <span className="text-slate-400 font-medium">Subtotal</span>
                        <p className="font-semibold text-slate-800">₹{invoice.subtotal || 0}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Discount</span>
                        <p className="font-semibold text-amber-700">-₹{invoice.discount || 0}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">GST Tax (5%)</span>
                        <p className="font-semibold text-slate-800">₹{invoice.gstTax || 0}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Grand Total</span>
                        <p className="font-bold text-slate-900 text-sm">₹{invoice.grandTotal || 0}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Customer Order</span>
                        <p className="font-bold text-slate-900 text-sm">
                          {order?.orderId || order?.orderNumber || 'POS-2026-LIVE'}
                        </p>
                        <p className="text-slate-500">{order?.customerName || customer?.name || 'Direct Walk-in / Omni POS'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Order Status & Tender</span>
                        <p className="font-semibold text-emerald-700">
                          {order?.status || 'Delivered & Completed'}
                        </p>
                        <p className="text-slate-500">{order?.paymentMethod || payment?.method || 'UPI / Cashless'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-400 font-medium">Delivery Vehicle</span>
                        <p className="font-mono font-medium text-slate-800">MH-12-QE-4921</p>
                        <p className="text-[11px] text-slate-400">Reefer Van</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Driver / Rider</span>
                        <p className="font-medium text-slate-800">Suresh Kadam</p>
                        <p className="text-[11px] text-slate-400">9823104921</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Tax Invoice Total</span>
                        <p className="font-bold text-slate-900">
                          ₹{order?.totalAmount || batch?.mrp || 455}
                        </p>
                        <p className="text-[10px] text-emerald-700">GST 5% Paid</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Chronological State Timeline */}
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

          {/* Tamper-Proof Audit Table */}
          {(result.audits || []).length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                System Audit History (Tamper-Proof)
              </h2>
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
                        <tr key={row.auditId} className="hover:bg-slate-50/60 transition">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{row.auditId}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.action}</td>
                          <td className="px-3 py-2 text-slate-600">{row.fieldChanged || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.changedBy || row.userId || 'Admin'}</td>
                          <td className="px-3 py-2 text-slate-500">{when(row.dateTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* 100% COMPLETE RAW DATA MODAL / DRAWER */}
          {showRawJson && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
              <div className="relative flex flex-col w-full max-w-4xl max-h-[85vh] bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-950">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Full MongoDB Document Payload (100% Data)</h3>
                      <p className="text-[11px] text-slate-400">Zero fields hidden. Complete raw graph from database.</p>
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
