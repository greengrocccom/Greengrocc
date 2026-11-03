import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Store,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Tag,
  Package,
  Sparkles,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import {
  BTN,
  BTN_PRIMARY,
  INPUT,
  PAGE_KICKER,
  PAGE_SUB,
  PAGE_TITLE,
  PANEL,
  PANEL_HEAD,
  TH,
  TD,
} from '../../utils/ui';

const normalizeCrop = (str = '') =>
  String(str || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .trim();

const stripMarathi = (str = '') =>
  String(str || '')
    .replace(/[\u0900-\u097F]+/g, '')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const isGreenGrooRecord = (row) =>
  Boolean(row?.isGreenGroo) ||
  String(row?.marketName || '').toLowerCase().includes('greengroo');

const localToday = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// Multiplier to a per-Quintal price; null for units that are not weight based.
const perQuintalFactor = (unit = '') => {
  const u = String(unit || '').trim().toLowerCase();
  if (!u || u === 'quintal' || u === 'qtl') return 1;
  if (u === 'kg' || u === 'kgs') return 100;
  if (u === 'ton' || u === 'tonne') return 0.1;
  return null;
};

const comparableUnit = (unit) => (perQuintalFactor(unit) != null ? 'Quintal' : unit || 'Unit');

const comparablePrice = (row, value = row?.price) =>
  Number(value || 0) * (perQuintalFactor(row?.unit) ?? 1);

const analysisKey = (row) => {
  const name = normalizeCrop(stripMarathi(row?.productName || ''));
  return perQuintalFactor(row?.unit) != null ? name : `${name}|${String(row?.unit || '').toLowerCase()}`;
};

// Newest quote per market; rows arrive newest first so ties keep the latest update.
const latestPerMarket = (list) => {
  const map = new Map();
  list.forEach((row) => {
    const key = stripMarathi(row.marketName || '').toLowerCase();
    const prev = map.get(key);
    if (!prev || String(row.priceDate || '') > String(prev.priceDate || '')) map.set(key, row);
  });
  return Array.from(map.values());
};

const GREENGROO_HUBS = [
  'GreenGroo Direct Center',
  'GreenGroo Hub - Pune',
  'GreenGroo Hub - Nashik',
  'GreenGroo Hub - Mumbai',
  'GreenGroo Hub - Kolhapur',
];

const MARKET_SUGGESTIONS = [
  'GreenGroo Direct Center',
  'Pune APMC',
  'Mumbai Vashi APMC',
  'Nashik APMC',
  'Kolhapur APMC',
  'Solapur APMC',
  'Sangli APMC',
  'Ahmednagar APMC',
  'Nagpur APMC',
  'Aurangabad APMC',
  'Jalgaon APMC',
];

const PRODUCT_SUGGESTIONS = [
  'Tomato',
  'Onion',
  'Potato',
  'Green Chilli',
  'Ginger',
  'Garlic',
  'Soybean',
  'Wheat',
  'Pomegranate',
  'Turmeric',
  'Coriander',
  'Fenugreek',
  'Cauliflower',
  'Cabbage',
];

const VARIETY_SUGGESTIONS = [
  'Hybrid',
  'Desi',
  'Garwa',
  'Red Onion',
  'G4 Green',
  'Bhagwa',
  'Grade A',
  'Regular',
];

const UNIT_OPTIONS = [
  { value: 'Quintal', label: 'Quintal (100 kg)' },
  { value: 'Kg', label: 'Kg' },
  { value: 'Box', label: 'Box' },
  { value: 'Bag', label: 'Bag' },
  { value: 'Dozen', label: 'Dozen' },
  { value: 'Ton', label: 'Ton' },
];

const makeInitialForm = () => ({
  marketName: '',
  productName: '',
  variety: '',
  price: '',
  minPrice: '',
  maxPrice: '',
  unit: 'Quintal',
  priceDate: localToday(),
  district: 'Pune',
  state: 'Maharashtra',
  trend: 'stable',
  arrivalQuantity: '',
  arrivalUnit: 'Quintal',
  notes: '',
  isActive: true,
  isGreenGroo: false,
});

export default function MarketPricesPage() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all', 'greengroo', 'apmc'
  const [marketFilter, setMarketFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isGreenGrooMode, setIsGreenGrooMode] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(makeInitialForm);
  const [formErrors, setFormErrors] = useState({});
  const [filterOptions, setFilterOptions] = useState({ markets: [], products: [], dates: [] });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (marketFilter !== 'all') params.marketName = marketFilter;
      if (productFilter !== 'all') params.productName = productFilter;
      if (dateFilter !== 'all') params.priceDate = dateFilter;

      const res = await opsApi.list('market-prices', params);
      setRows(Array.isArray(res.data) ? res.data : []);
      setStats(res.stats || null);
      setFilterOptions({
        markets: Array.isArray(res.filters?.markets) ? res.filters.markets : [],
        products: Array.isArray(res.filters?.products) ? res.filters.products : [],
        dates: Array.isArray(res.filters?.dates) ? res.filters.dates : [],
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load market prices.');
    } finally {
      setLoading(false);
    }
  }, [marketFilter, productFilter, statusFilter, dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unique markets, products, and dates (full lists from the server so filters never shrink the choices)
  const uniqueMarkets = useMemo(() => {
    const source = filterOptions.markets.length ? filterOptions.markets : rows.map((r) => r.marketName);
    return Array.from(new Set(source.filter(Boolean))).sort();
  }, [filterOptions.markets, rows]);

  const uniqueProducts = useMemo(() => {
    const source = filterOptions.products.length ? filterOptions.products : rows.map((r) => r.productName);
    return Array.from(new Set(source.filter(Boolean))).sort();
  }, [filterOptions.products, rows]);

  const uniqueDates = useMemo(() => {
    const source = filterOptions.dates.length
      ? filterOptions.dates
      : rows.map((r) => (r.priceDate ? String(r.priceDate).slice(0, 10) : ''));
    return Array.from(new Set(source.filter(Boolean))).sort().reverse();
  }, [filterOptions.dates, rows]);

  // Product price comparison (GreenGroo vs APMC) on each market's latest active quote, per Quintal
  const productAnalysis = useMemo(() => {
    const groups = {};
    rows.forEach((row) => {
      if (row.isActive === false || !(Number(row.price) > 0)) return;
      const rawName = stripMarathi(row.productName || '').trim();
      if (!rawName) return;
      const key = analysisKey(row);
      if (!groups[key]) {
        groups[key] = { key, productName: rawName, unit: comparableUnit(row.unit), rows: [] };
      }
      groups[key].rows.push(row);
    });

    return Object.values(groups).map((p) => {
      const latest = latestPerMarket(p.rows);
      const greenGrooRow =
        latest
          .filter((r) => isGreenGrooRecord(r))
          .sort((a, b) => comparablePrice(b) - comparablePrice(a))[0] || null;
      const apmcRows = latest.filter((r) => !isGreenGrooRecord(r));
      const apmcPrices = apmcRows.map((r) => comparablePrice(r)).filter((x) => x > 0);
      const apmcMin = apmcPrices.length ? Math.min(...apmcPrices) : 0;
      const apmcMax = apmcPrices.length ? Math.max(...apmcPrices) : 0;
      const apmcAvg = apmcPrices.length ? apmcPrices.reduce((a, b) => a + b, 0) / apmcPrices.length : 0;

      const ggPrice = greenGrooRow ? comparablePrice(greenGrooRow) : 0;
      let diffPercent = 0;
      let diffAmount = 0;
      let status = 'none';

      if (ggPrice > 0 && apmcAvg > 0) {
        diffAmount = ggPrice - apmcAvg;
        diffPercent = (diffAmount / apmcAvg) * 100;
        if (diffPercent > 0.05) status = 'higher';
        else if (diffPercent < -0.05) status = 'lower';
        else status = 'equal';
      }

      return {
        ...p,
        greenGrooRow,
        apmcRows,
        apmcMin,
        apmcMax,
        apmcAvg,
        ggPrice,
        diffPercent,
        diffAmount,
        status,
      };
    });
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const isGg = isGreenGrooRecord(row);

      if (scopeFilter === 'greengroo' && !isGg) return false;
      if (scopeFilter === 'apmc' && isGg) return false;

      const matchesSearch =
        !q ||
        [row.marketName, row.productName, row.variety, row.district, row.notes]
          .some((v) => String(v || '').toLowerCase().includes(q));

      const matchesMarket = marketFilter === 'all' || row.marketName === marketFilter;
      const matchesProduct = productFilter === 'all' || row.productName === productFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && row.isActive) ||
        (statusFilter === 'inactive' && !row.isActive);
      const matchesDate =
        dateFilter === 'all' ||
        (row.priceDate && String(row.priceDate).slice(0, 10) === dateFilter);

      return matchesSearch && matchesMarket && matchesProduct && matchesStatus && matchesDate;
    });
  }, [rows, search, scopeFilter, marketFilter, productFilter, statusFilter, dateFilter]);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm({ ...makeInitialForm(), isGreenGroo: false });
    setIsGreenGrooMode(false);
    setFormErrors({});
    setModalOpen(true);
  };

  const openGreenGrooModal = (prefillProduct = '') => {
    setEditingItem(null);
    setForm({
      ...makeInitialForm(),
      marketName: 'GreenGroo Direct Center',
      productName: prefillProduct || 'Tomato',
      variety: 'Hybrid',
      district: 'Pune',
      state: 'Maharashtra',
      unit: 'Quintal',
      trend: 'up',
      notes: 'Direct procurement, 0% commission.',
      isGreenGroo: true,
      isActive: true,
    });
    setIsGreenGrooMode(true);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    const isGg = isGreenGrooRecord(item);
    setIsGreenGrooMode(isGg);
    setForm({
      marketName: stripMarathi(item.marketName || ''),
      productName: stripMarathi(item.productName || ''),
      variety: stripMarathi(item.variety || ''),
      price: item.price !== undefined ? String(item.price) : '',
      minPrice: item.minPrice !== undefined ? String(item.minPrice) : '',
      maxPrice: item.maxPrice !== undefined ? String(item.maxPrice) : '',
      unit: item.unit || 'Quintal',
      priceDate: item.priceDate ? String(item.priceDate).slice(0, 10) : localToday(),
      district: item.district || 'Pune',
      state: item.state || 'Maharashtra',
      trend: item.trend || 'stable',
      arrivalQuantity: item.arrivalQuantity !== undefined ? String(item.arrivalQuantity) : '',
      arrivalUnit: item.arrivalUnit || 'Quintal',
      notes: item.notes || '',
      isActive: item.isActive !== false,
      isGreenGroo: isGg,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  // Live comparison inside modal
  const apmcRatesForCurrentProduct = useMemo(() => {
    if (!form.productName) return [];
    const key = analysisKey({ productName: form.productName, unit: form.unit });
    return latestPerMarket(
      rows.filter(
        (r) =>
          r.isActive !== false &&
          Number(r.price) > 0 &&
          !isGreenGrooRecord(r) &&
          r._id !== editingItem?._id &&
          analysisKey(r) === key
      )
    );
  }, [form.productName, form.unit, rows, editingItem]);

  const apmcAvgForCurrentProduct = useMemo(() => {
    if (!apmcRatesForCurrentProduct.length) return 0;
    const sum = apmcRatesForCurrentProduct.reduce((acc, r) => acc + comparablePrice(r), 0);
    return sum / apmcRatesForCurrentProduct.length;
  }, [apmcRatesForCurrentProduct]);

  const liveComparison = useMemo(() => {
    const enteredPrice = comparablePrice({ unit: form.unit }, form.price);
    if (!enteredPrice || apmcAvgForCurrentProduct <= 0) return null;
    const diffAmount = enteredPrice - apmcAvgForCurrentProduct;
    const diffPercent = (diffAmount / apmcAvgForCurrentProduct) * 100;
    return {
      diffAmount,
      diffPercent,
      status: diffPercent > 0.01 ? 'higher' : diffPercent < -0.01 ? 'lower' : 'equal',
      apmcAvg: apmcAvgForCurrentProduct,
      count: apmcRatesForCurrentProduct.length,
    };
  }, [form.price, form.unit, apmcAvgForCurrentProduct, apmcRatesForCurrentProduct.length]);

  const validateForm = () => {
    const errors = {};
    if (!form.marketName?.trim()) errors.marketName = 'Market name is required';
    if (!form.productName?.trim()) errors.productName = 'Product name is required';
    if (!form.variety?.trim()) errors.variety = 'Variety is required';
    if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0) {
      errors.price = 'Valid price is required';
    }
    const minValue = form.minPrice !== '' ? Number(form.minPrice) : Number(form.price);
    const maxValue = form.maxPrice !== '' ? Number(form.maxPrice) : Number(form.price);
    if (Number.isFinite(minValue) && Number.isFinite(maxValue) && minValue > maxValue) {
      errors.price = 'Min price cannot be more than Max price';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        minPrice: form.minPrice !== '' ? Number(form.minPrice) : Number(form.price),
        maxPrice: form.maxPrice !== '' ? Number(form.maxPrice) : Number(form.price),
        arrivalQuantity: form.arrivalQuantity !== '' ? Number(form.arrivalQuantity) : 0,
      };

      if (editingItem) {
        await opsApi.update('market-prices', editingItem._id, payload);
        setSuccessMsg(`Updated ${form.productName} price.`);
      } else {
        await opsApi.create('market-prices', payload);
        setSuccessMsg(`Added ${form.productName} price.`);
      }

      setModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save market price.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete price for ${item.productName} (${item.marketName})?`)) {
      return;
    }
    try {
      await opsApi.remove('market-prices', item._id);
      setSuccessMsg('Price deleted.');
      await loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete price.');
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      await opsApi.update('market-prices', item._id, { isActive: !item.isActive });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    }
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Top Header - Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className={PAGE_KICKER}>Catalog & Mandi</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
              Live
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Market Prices</h1>
          <p className="text-xs text-slate-500">
            APMC mandi rates, GreenGroo procurement prices, and % comparison.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            className={`${BTN} text-xs py-1.5 px-3 whitespace-nowrap`}
            title="Refresh data"
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => openGreenGrooModal()}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition active:scale-[0.98] whitespace-nowrap"
            title="Set GreenGroo Direct Procurement Price"
          >
            <Sparkles className="mr-1 h-3.5 w-3.5 text-emerald-200" />
            🌿 GreenGroo Price
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className={`${BTN_PRIMARY} text-xs py-1.5 px-3 whitespace-nowrap`}
          >
            <Plus className="mr-1 h-3.5 w-3.5 stroke-[2.5]" />
            Add APMC Price
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Compact Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className={`${PANEL} p-3`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Quotes</p>
              <Tag className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="mt-1 text-lg font-black text-slate-900">{stats.total ?? rows.length}</p>
          </div>

          <div className={`${PANEL} p-3`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">APMC Markets</p>
              <Store className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <p className="mt-1 text-lg font-black text-slate-900">{stats.totalMarkets ?? uniqueMarkets.length}</p>
          </div>

          <div className={`${PANEL} p-3`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Commodities</p>
              <Package className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="mt-1 text-lg font-black text-slate-900">{stats.totalProducts ?? uniqueProducts.length}</p>
          </div>

          <div className={`${PANEL} p-3`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today Updates</p>
              <Calendar className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <p className="mt-1 text-lg font-black text-slate-900">{stats.todayUpdates ?? 0}</p>
          </div>
        </div>
      )}

      {/* Price Comparison Cards (GreenGroo vs APMC) - Compact */}
      <div className={`${PANEL} p-3.5`}>
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              GreenGroo vs APMC Price Comparison
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            {productAnalysis.length} crops analyzed
          </span>
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productAnalysis.map((item) => {
            const hasGg = Boolean(item.greenGrooRow);
            return (
              <div
                key={item.key}
                className={`rounded-lg border p-2.5 transition text-xs ${
                  hasGg
                    ? item.status === 'higher'
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : item.status === 'lower'
                      ? 'border-rose-200 bg-rose-50/30'
                      : 'border-slate-200 bg-white'
                    : 'border-dashed border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{item.productName}</span>
                  <span className="text-[10px] text-slate-400 font-normal">/{item.unit}</span>
                </div>

                <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="bg-white/80 p-1.5 rounded border border-slate-100">
                    <span className="text-[10px] text-emerald-700 font-bold block">GreenGroo</span>
                    <span className="font-extrabold text-emerald-950">
                      {hasGg ? `₹${Math.round(item.ggPrice).toLocaleString('en-IN')}` : '-'}
                    </span>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block">APMC Avg</span>
                    <span className="font-bold text-slate-700">
                      {item.apmcAvg > 0 ? `₹${Math.round(item.apmcAvg).toLocaleString('en-IN')}` : '-'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  {hasGg ? (
                    item.status === 'higher' ? (
                      <span className="text-[10.5px] font-bold text-emerald-700 flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" />
                        +{item.diffPercent.toFixed(1)}% Higher (+₹{Math.round(item.diffAmount)})
                      </span>
                    ) : item.status === 'lower' ? (
                      <span className="text-[10.5px] font-bold text-rose-700 flex items-center gap-0.5">
                        <TrendingDown className="h-3 w-3" />
                        -{Math.abs(item.diffPercent).toFixed(1)}% Lower (-₹{Math.round(Math.abs(item.diffAmount))})
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-medium text-slate-600">Equal (0.0%)</span>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-400">Not set</span>
                  )}

                  {hasGg ? (
                    <button
                      type="button"
                      onClick={() => openEditModal(item.greenGrooRow)}
                      className="text-[10.5px] font-semibold text-emerald-700 hover:underline"
                    >
                      Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openGreenGrooModal(item.productName)}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      + Set
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!loading && productAnalysis.length === 0 && (
          <p className="mt-3 text-center text-[11px] text-slate-400">
            No active prices yet. Add an APMC or GreenGroo price to see the comparison.
          </p>
        )}
      </div>

      {/* Scope Filter Tabs - Compact */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 text-xs">
        <button
          type="button"
          onClick={() => setScopeFilter('all')}
          className={`rounded-lg px-3 py-1.5 font-medium transition ${
            scopeFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({rows.length})
        </button>
        <button
          type="button"
          onClick={() => setScopeFilter('greengroo')}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-medium transition ${
            scopeFilter === 'greengroo'
              ? 'bg-emerald-600 text-white'
              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
          }`}
        >
          🌿 GreenGroo ({rows.filter((r) => isGreenGrooRecord(r)).length})
        </button>
        <button
          type="button"
          onClick={() => setScopeFilter('apmc')}
          className={`rounded-lg px-3 py-1.5 font-medium transition ${
            scopeFilter === 'apmc'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          APMC Mandis ({rows.filter((r) => !isGreenGrooRecord(r)).length})
        </button>
      </div>

      {/* Filters Bar - Compact */}
      <div className={`${PANEL} p-2.5`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search market, product, variety..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${INPUT} pl-8 py-1.5 text-xs`}
            />
          </div>

          {/* Market Dropdown */}
          <div className="min-w-[150px]">
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className={`${INPUT} py-1.5 text-xs`}
            >
              <option value="all">All Markets</option>
              {uniqueMarkets.map((m) => (
                <option key={m} value={m}>
                  {stripMarathi(m) || m}
                </option>
              ))}
            </select>
          </div>

          {/* Product Dropdown */}
          <div className="min-w-[140px]">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className={`${INPUT} py-1.5 text-xs`}
            >
              <option value="all">All Products</option>
              {uniqueProducts.map((p) => (
                <option key={p} value={p}>
                  {stripMarathi(p) || p}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="min-w-[110px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${INPUT} py-1.5 text-xs`}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Date Dropdown & Picker */}
          <div className="flex items-center gap-1">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className={`${INPUT} py-1.5 text-xs font-medium text-slate-700 min-w-[130px]`}
            >
              <option value="all">📅 All Dates</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  {d === localToday() ? `📍 Today (${d})` : d}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFilter !== 'all' ? dateFilter : ''}
              onChange={(e) => setDateFilter(e.target.value || 'all')}
              className={`${INPUT} py-1 px-2 text-xs font-medium text-slate-700 w-auto`}
              title="Select custom date"
            />
          </div>

          {/* Reset */}
          {(search ||
            marketFilter !== 'all' ||
            productFilter !== 'all' ||
            statusFilter !== 'all' ||
            dateFilter !== 'all' ||
            scopeFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setScopeFilter('all');
                setMarketFilter('all');
                setProductFilter('all');
                setStatusFilter('all');
                setDateFilter('all');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table - Compact */}
      <div className={PANEL}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className={`${TH} py-2.5 px-3`}>Market</th>
                <th className={`${TH} py-2.5 px-3`}>Product</th>
                <th className={`${TH} py-2.5 px-3`}>Variety</th>
                <th className={`${TH} py-2.5 px-3`}>Price</th>
                <th className={`${TH} py-2.5 px-3`}>Min - Max</th>
                <th className={`${TH} py-2.5 px-3`}>vs APMC / GreenGroo</th>
                <th className={`${TH} py-2.5 px-3`}>Trend</th>
                <th className={`${TH} py-2.5 px-3`}>Arrivals</th>
                <th className={`${TH} py-2.5 px-3`}>Date</th>
                <th className={`${TH} py-2.5 px-3`}>Status</th>
                <th className={`${TH} py-2.5 px-3 text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-emerald-600 mb-1" />
                    <span>Loading...</span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    <p className="font-semibold text-slate-600">No price records found</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isGg = isGreenGrooRecord(row);
                  const displayMarket = stripMarathi(row.marketName);
                  const displayProduct = stripMarathi(row.productName);
                  const displayVariety = stripMarathi(row.variety) || 'Standard';

                  return (
                    <tr
                      key={row._id}
                      className={`transition-colors ${
                        isGg ? 'bg-emerald-50/40 hover:bg-emerald-100/40' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Market */}
                      <td className={`${TD} py-2.5 px-3`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold ${isGg ? 'text-emerald-950' : 'text-slate-900'}`}>
                            {isGg ? `🌿 ${displayMarket}` : displayMarket}
                          </span>
                          {isGg && (
                            <span className="rounded bg-emerald-600 px-1.5 py-0.2 text-[9.5px] font-bold text-white">
                              Direct
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {row.district ? `${row.district}, ` : ''}
                          {row.state || 'MH'}
                        </span>
                      </td>

                      {/* Product */}
                      <td className={`${TD} py-2.5 px-3 font-semibold text-slate-900`}>
                        {displayProduct}
                      </td>

                      {/* Variety */}
                      <td className={`${TD} py-2.5 px-3 text-slate-600`}>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                          {displayVariety}
                        </span>
                      </td>

                      {/* Price */}
                      <td className={`${TD} py-2.5 px-3 font-bold ${isGg ? 'text-emerald-700' : 'text-slate-900'}`}>
                        ₹{Number(row.price).toLocaleString('en-IN')}
                        <span className="text-[10px] font-normal text-slate-400 ml-0.5">/{row.unit || 'Qtl'}</span>
                      </td>

                      {/* Min - Max */}
                      <td className={`${TD} py-2.5 px-3 text-slate-500 text-[11px]`}>
                        ₹{Number(row.minPrice || row.price).toLocaleString('en-IN')} - ₹
                        {Number(row.maxPrice || row.price).toLocaleString('en-IN')}
                      </td>

                      {/* Comparison vs APMC / GreenGroo */}
                      <td className={`${TD} py-2.5 px-3`}>
                        {(() => {
                          const analysis = productAnalysis.find((a) => a.key === analysisKey(row));

                          if (isGg) {
                            if (!analysis || analysis.apmcRows.length === 0) {
                              return <span className="text-[11px] text-slate-400">Base</span>;
                            }
                            if (analysis.status === 'higher') {
                              return (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-800 bg-emerald-100">
                                  <TrendingUp className="h-3 w-3 text-emerald-700" />
                                  +{analysis.diffPercent.toFixed(1)}% Higher
                                </span>
                              );
                            } else if (analysis.status === 'lower') {
                              return (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-rose-800 bg-rose-100">
                                  <TrendingDown className="h-3 w-3 text-rose-700" />
                                  -{Math.abs(analysis.diffPercent).toFixed(1)}% Lower
                                </span>
                              );
                            } else {
                              return <span className="text-[11px] text-slate-600 font-medium">Equal (0%)</span>;
                            }
                          } else {
                            if (analysis && analysis.ggPrice > 0) {
                              const diffFromGg = ((comparablePrice(row) - analysis.ggPrice) / analysis.ggPrice) * 100;
                              if (diffFromGg < -0.05) {
                                return (
                                  <span className="text-[10.5px] text-amber-800 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                                    {Math.abs(diffFromGg).toFixed(1)}% below GreenGroo
                                  </span>
                                );
                              } else if (diffFromGg > 0.05) {
                                return (
                                  <span className="text-[10.5px] text-blue-800 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                                    +{diffFromGg.toFixed(1)}% above GreenGroo
                                  </span>
                                );
                              } else {
                                return <span className="text-[11px] text-slate-500">Same as GreenGroo</span>;
                              }
                            }
                            return <span className="text-slate-400">-</span>;
                          }
                        })()}
                      </td>

                      {/* Trend */}
                      <td className={`${TD} py-2.5 px-3`}>
                        {row.trend === 'up' ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold">
                            <TrendingUp className="h-3 w-3" /> Up
                          </span>
                        ) : row.trend === 'down' ? (
                          <span className="inline-flex items-center gap-0.5 text-rose-700 font-semibold">
                            <TrendingDown className="h-3 w-3" /> Down
                          </span>
                        ) : (
                          <span className="text-slate-500">Stable</span>
                        )}
                      </td>

                      {/* Arrivals */}
                      <td className={`${TD} py-2.5 px-3 text-slate-600 text-[11px]`}>
                        {row.arrivalQuantity ? `${Number(row.arrivalQuantity).toLocaleString('en-IN')} ${row.arrivalUnit || 'Qtl'}` : '-'}
                      </td>

                      {/* Date */}
                      <td className={`${TD} py-2.5 px-3 text-slate-500 font-mono text-[11px]`}>
                        {row.priceDate ? String(row.priceDate).slice(0, 10) : '-'}
                      </td>

                      {/* Status */}
                      <td className={`${TD} py-2.5 px-3`}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(row)}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                            row.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${row.isActive ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                          {row.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className={`${TD} py-2.5 px-3 text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Compact & English Only */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-xl border border-slate-200 my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-white">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {isGreenGrooMode
                    ? editingItem
                      ? 'Edit GreenGroo Price'
                      : 'Set GreenGroo Procurement Price'
                    : editingItem
                    ? 'Edit Market Price'
                    : 'Add Market Price'}
                </h3>
                {isGreenGrooMode && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-800">
                    Direct
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form id="market-price-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {/* Market Name */}
              <div>
                <label className="font-semibold text-slate-700 block">
                  {isGreenGrooMode ? 'GreenGroo Center / Hub' : 'Market / APMC Name'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  list="market-suggestions"
                  placeholder="e.g. Pune APMC or GreenGroo Direct Center"
                  value={form.marketName}
                  onChange={(e) => setForm({ ...form, marketName: e.target.value })}
                  className={`${INPUT} mt-1 py-1.5 text-xs`}
                  autoFocus
                />
                <datalist id="market-suggestions">
                  {(isGreenGrooMode ? GREENGROO_HUBS : MARKET_SUGGESTIONS).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                {formErrors.marketName && (
                  <p className="mt-1 text-[11px] text-rose-500">{formErrors.marketName}</p>
                )}

                {/* Quick Hub Chips */}
                <div className="mt-1 flex flex-wrap gap-1">
                  {(isGreenGrooMode
                    ? GREENGROO_HUBS
                    : ['Pune APMC', 'Mumbai Vashi APMC', 'Nashik APMC', 'Kolhapur APMC']
                  ).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setForm({ ...form, marketName: chip })}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product & Variety */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block">
                    Product <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="product-suggestions"
                    placeholder="e.g. Tomato, Onion"
                    value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  />
                  <datalist id="product-suggestions">
                    {PRODUCT_SUGGESTIONS.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                  {formErrors.productName && (
                    <p className="mt-1 text-[11px] text-rose-500">{formErrors.productName}</p>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block">
                    Variety <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="variety-suggestions"
                    placeholder="e.g. Hybrid, Desi"
                    value={form.variety}
                    onChange={(e) => setForm({ ...form, variety: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  />
                  <datalist id="variety-suggestions">
                    {VARIETY_SUGGESTIONS.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                  {formErrors.variety && (
                    <p className="mt-1 text-[11px] text-rose-500">{formErrors.variety}</p>
                  )}
                </div>
              </div>

              {/* Price, Min, Max, Unit */}
              <div className="grid grid-cols-4 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block">
                    Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="2400"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs font-bold`}
                  />
                  {formErrors.price && (
                    <p className="mt-1 text-[11px] text-rose-500">{formErrors.price}</p>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block">Min (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="2200"
                    value={form.minPrice}
                    onChange={(e) => setForm({ ...form, minPrice: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block">Max (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="2600"
                    value={form.maxPrice}
                    onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Comparison Box - Minimal & English */}
              {liveComparison && (
                <div
                  className={`rounded-lg border p-2.5 text-xs transition ${
                    liveComparison.status === 'higher'
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                      : liveComparison.status === 'lower'
                      ? 'border-rose-200 bg-rose-50/60 text-rose-900'
                      : 'border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      APMC Comparison ({liveComparison.count} markets)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Avg: ₹{Math.round(liveComparison.apmcAvg)}/{comparableUnit(form.unit)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-1 font-bold">
                    {liveComparison.status === 'higher' ? (
                      <span className="text-emerald-700 flex items-center gap-0.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        +{liveComparison.diffPercent.toFixed(1)}% Higher (+₹
                        {Math.round(liveComparison.diffAmount)} advantage)
                      </span>
                    ) : liveComparison.status === 'lower' ? (
                      <span className="text-rose-700 flex items-center gap-0.5">
                        <TrendingDown className="h-3.5 w-3.5" />
                        -{Math.abs(liveComparison.diffPercent).toFixed(1)}% Lower (-₹
                        {Math.round(Math.abs(liveComparison.diffAmount))})
                      </span>
                    ) : (
                      <span className="text-slate-700">Equal to APMC average</span>
                    )}
                  </div>
                </div>
              )}

              {/* Date, Trend, District, State */}
              <div className="grid grid-cols-4 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block">Date</label>
                  <input
                    type="date"
                    value={form.priceDate}
                    onChange={(e) => setForm({ ...form, priceDate: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block">Trend</label>
                  <select
                    value={form.trend}
                    onChange={(e) => setForm({ ...form, trend: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  >
                    <option value="stable">Stable</option>
                    <option value="up">Up</option>
                    <option value="down">Down</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block">District</label>
                  <input
                    type="text"
                    placeholder="Pune"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block">State</label>
                  <input
                    type="text"
                    placeholder="Maharashtra"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  />
                </div>
              </div>

              {/* Arrival & Active */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="font-semibold text-slate-700 block">Arrival Volume (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={form.arrivalQuantity}
                    onChange={(e) => setForm({ ...form, arrivalQuantity: e.target.value })}
                    className={`${INPUT} mt-1 py-1.5 text-xs`}
                  />
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Active (visible on farmer app)</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-semibold text-slate-700 block">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Good arrivals, steady demand"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`${INPUT} mt-1 py-1.5 text-xs`}
                />
              </div>
            </form>

            {/* Modal Footer */}
            <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className={`${BTN} py-1.5 px-3 text-xs`}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="market-price-form"
                className={`${BTN_PRIMARY} py-1.5 px-4 text-xs`}
                disabled={saving}
              >
                {saving ? 'Saving...' : editingItem ? 'Update Price' : 'Save Price'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
