import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Package,
  Layers,
  Gift,
  Crown,
  Weight,
  Plus,
  Trash2,
  Edit3,
  Search,
  RefreshCw,
  Play,
  Calendar,
  AlertCircle,
  X,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  FolderTree,
  Folder,
  Tag,
  Filter,
  ArrowRight,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_SUB, PAGE_TITLE, PANEL, TH, TD } from '../../utils/ui';

const STRATEGIES = [
  {
    id: 'quantity_discount',
    label: 'Quantity-based',
    shortLabel: 'Quantity',
    icon: Package,
    color: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Volume discounts on single products or categories (e.g. Buy 10+ units, get 5% off).',
    example: 'Buy 10+ units → Get 5% off',
  },
  {
    id: 'bundle_pricing',
    label: 'Bundle Pricing',
    shortLabel: 'Bundle',
    icon: Layers,
    color: 'indigo',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Fixed bundle price for multiple units with exceptions (e.g. 3 items for ₹299, with exclusions).',
    example: 'Buy 3 items for ₹299 (Exceptions apply)',
  },
  {
    id: 'tiered_quantity',
    label: 'Tiered Quantity',
    shortLabel: 'Tiered',
    icon: BadgePercent,
    color: 'purple',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Multiple quantity slabs (e.g. 2–5 units at 10% off, 6+ units at 20% off).',
    example: '2–5 units at 10%, 6+ units at 20%',
  },
  {
    id: 'free_addon',
    label: 'Free / Discounted Add-on',
    shortLabel: 'Add-on Item',
    icon: Gift,
    color: 'amber',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Complimentary or discounted item when purchase criteria met (e.g. Free mint with orders > ₹499).',
    example: 'Free herb bunch with orders over ₹499',
  },
  {
    id: 'loyalty_discount',
    label: 'Lifetime Loyalty',
    shortLabel: 'Loyalty',
    icon: Crown,
    color: 'rose',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'VIP lifetime savings unlocked after a set number of completed orders (e.g. 10% off after 5 orders).',
    example: '10% lifetime discount after 5 orders',
  },
  {
    id: 'heavy_handling_fee',
    label: 'Heavy Item Handling Fee',
    shortLabel: 'Heavy Fee',
    icon: Weight,
    color: 'slate',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Extra handling surcharge applied to heavy or bulky goods (e.g. +₹40 handling fee for items ≥ 5kg).',
    example: '+₹40 handling fee on heavy items (≥5kg)',
  },
];

/**
 * CASCADING TARGET PICKER:
 * Allows drill-down: Category -> Subcategory -> Specific Product
 * with search and multi-target selection chips.
 */
function CascadingTargetPicker({
  applyTo,
  onChangeApplyTo,
  selectedCategoryNames = [],
  onChangeCategoryNames,
  selectedProductIds = [],
  onChangeProductIds,
  categories = [],
  subcategoriesByCategory = {},
  allSubcategories = [],
  products = [],
  isExceptionMode = false,
  title = 'Applies To (Target Products)',
}) {
  const [drillCategory, setDrillCategory] = useState('');
  const [drillSubcategory, setDrillSubcategory] = useState('');
  const [drillProductId, setDrillProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Subcategories available for chosen category
  const availableSubcategories = useMemo(() => {
    if (drillCategory && subcategoriesByCategory[drillCategory]) {
      return subcategoriesByCategory[drillCategory];
    }
    return allSubcategories;
  }, [drillCategory, subcategoriesByCategory, allSubcategories]);

  // Products filtered by selected Category & Subcategory + search
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (drillCategory) {
        const prodCats = Array.isArray(prod.categories) ? prod.categories : [prod.category].filter(Boolean);
        const matchCat = prodCats.some((c) => String(c).toLowerCase() === drillCategory.toLowerCase());
        if (!matchCat) return false;
      }
      if (drillSubcategory) {
        const matchSub = String(prod.subcategory || '').toLowerCase() === drillSubcategory.toLowerCase();
        if (!matchSub) return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.trim().toLowerCase();
        const matchName = String(prod.name || '').toLowerCase().includes(q);
        const matchSku = String(prod.sku || '').toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }
      return true;
    });
  }, [products, drillCategory, drillSubcategory, productSearch]);

  const addCategory = (catName) => {
    if (!catName) return;
    const clean = String(catName).trim();
    if (!selectedCategoryNames.includes(clean)) {
      onChangeCategoryNames([...selectedCategoryNames, clean]);
      if (applyTo === 'all') onChangeApplyTo('custom');
    }
  };

  const removeCategory = (catName) => {
    onChangeCategoryNames(selectedCategoryNames.filter((c) => c !== catName));
  };

  const addProduct = (prodId) => {
    if (!prodId) return;
    const clean = String(prodId).trim();
    if (!selectedProductIds.includes(clean)) {
      onChangeProductIds([...selectedProductIds, clean]);
      if (applyTo === 'all') onChangeApplyTo('custom');
    }
  };

  const removeProduct = (prodId) => {
    onChangeProductIds(selectedProductIds.filter((id) => id !== prodId));
  };

  const getProductName = (id) => {
    const found = products.find((p) => String(p._id) === String(id));
    return found ? `${found.name} (₹${found.discountedPrice || found.price})` : `Product ${id.slice(-6)}`;
  };

  return (
    <div className={`rounded-2xl border p-4 space-y-4 ${isExceptionMode ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-2">
          <FolderTree className={`h-4 w-4 ${isExceptionMode ? 'text-amber-700' : 'text-emerald-700'}`} />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {title}
          </h4>
        </div>

        {!isExceptionMode && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold">Scope:</span>
            <select
              value={applyTo}
              onChange={(e) => onChangeApplyTo(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value="all">All Catalog Products (Store-wide)</option>
              <option value="categories">Selected Categories / Subcategories</option>
              <option value="products">Selected Products Only</option>
              <option value="custom">Custom Mix (Categories + Products)</option>
            </select>
          </div>
        )}
      </div>

      {(!isExceptionMode && applyTo === 'all') ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>Currently applies to <strong>all products</strong> across the entire catalog.</span>
          </div>
          <button
            type="button"
            onClick={() => onChangeApplyTo('custom')}
            className="text-xs font-bold text-emerald-900 underline hover:text-emerald-700"
          >
            Narrow to specific categories or products
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[11px] text-slate-500">
            Select a <strong>Category</strong>, drill down to its <strong>Subcategories</strong>, and pick <strong>Specific Products</strong> below:
          </p>

          {/* Cascading Dropdowns */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* 1. Category Dropdown */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                1. Select Category ({categories.length})
              </label>
              <select
                value={drillCategory}
                onChange={(e) => {
                  setDrillCategory(e.target.value);
                  setDrillSubcategory('');
                  setDrillProductId('');
                }}
                className={`${INPUT} mt-1 text-xs bg-white`}
              >
                <option value="">-- All Categories --</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    📁 {c}
                  </option>
                ))}
              </select>
              {drillCategory && (
                <button
                  type="button"
                  onClick={() => addCategory(drillCategory)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-200"
                >
                  <Plus className="h-3 w-3" />
                  Add All "{drillCategory}"
                </button>
              )}
            </div>

            {/* 2. Subcategory Dropdown */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                2. Select Subcategory ({availableSubcategories.length})
              </label>
              <select
                value={drillSubcategory}
                onChange={(e) => {
                  setDrillSubcategory(e.target.value);
                  setDrillProductId('');
                }}
                className={`${INPUT} mt-1 text-xs bg-white`}
              >
                <option value="">
                  {drillCategory ? `-- Subcategories of ${drillCategory} --` : '-- Select Subcategory --'}
                </option>
                {availableSubcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    📂 {sub}
                  </option>
                ))}
              </select>
              {drillSubcategory && (
                <button
                  type="button"
                  onClick={() => addCategory(drillSubcategory)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800 hover:bg-purple-200"
                >
                  <Plus className="h-3 w-3" />
                  Add Subcategory "{drillSubcategory}"
                </button>
              )}
            </div>

            {/* 3. Product Dropdown */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                3. Select Specific Product ({filteredProducts.length})
              </label>
              <select
                value={drillProductId}
                onChange={(e) => setDrillProductId(e.target.value)}
                className={`${INPUT} mt-1 text-xs bg-white`}
              >
                <option value="">-- Choose Product --</option>
                {filteredProducts.slice(0, 150).map((prod) => (
                  <option key={prod._id} value={prod._id}>
                    🎯 {prod.name} (₹{prod.discountedPrice || prod.price})
                  </option>
                ))}
              </select>
              {drillProductId && (
                <button
                  type="button"
                  onClick={() => {
                    addProduct(drillProductId);
                    setDrillProductId('');
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800 hover:bg-indigo-200"
                >
                  <Plus className="h-3 w-3" />
                  Add Chosen Product
                </button>
              )}
            </div>
          </div>

          {/* Product Quick Search Bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by title or SKU to filter dropdown..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className={`${INPUT} pl-8 py-1.5 text-xs bg-white`}
            />
          </div>

          {/* ACTIVE TARGET CHIPS */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Selected Targets ({selectedCategoryNames.length} Categories/Subcategories, {selectedProductIds.length} Products):
              </span>
              {(selectedCategoryNames.length > 0 || selectedProductIds.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeCategoryNames([]);
                    onChangeProductIds([]);
                  }}
                  className="text-[11px] text-rose-600 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {selectedCategoryNames.length === 0 && selectedProductIds.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                {isExceptionMode
                  ? 'No exclusions selected. The bundle applies to all qualifying items.'
                  : 'No specific targets added yet. Use the dropdowns above to add categories, subcategories, or products.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedCategoryNames.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs"
                  >
                    <Folder className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => removeCategory(cat)}
                      className="ml-1 text-emerald-600 hover:text-emerald-950"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {selectedProductIds.map((pid) => (
                  <span
                    key={pid}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 shadow-2xs"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="line-clamp-1 max-w-[220px]">{getProductName(pid)}</span>
                    <button
                      type="button"
                      onClick={() => removeProduct(pid)}
                      className="ml-1 text-indigo-600 hover:text-indigo-950"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DynamicPricing() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('all');

  // Products and Categories cache for pickers
  const [productsList, setProductsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [subcategoriesList, setSubcategoriesList] = useState([]);
  const [subcategoriesMap, setSubcategoriesMap] = useState({});

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    description: '',
    ruleType: 'quantity_discount',
    enabled: true,
    applyTo: 'all',
    categoryNames: [],
    productIds: [],
    startDate: '',
    endDate: '',
    minQuantity: 10,
    discountType: 'percentage',
    discountValue: 5,
    bundleQuantity: 3,
    bundlePrice: 299,
    exceptionProductIds: [],
    exceptionCategoryNames: [],
    tiers: [
      { minQuantity: 2, maxQuantity: 5, discountType: 'percentage', discountValue: 10 },
      { minQuantity: 6, maxQuantity: '', discountType: 'percentage', discountValue: 20 },
    ],
    triggerType: 'min_spend',
    minSpend: 499,
    triggerProductIds: [],
    triggerCategoryNames: [],
    addonProductId: '',
    addonProductName: '',
    addonQuantity: 1,
    addonDiscountType: 'free',
    addonDiscountValue: 100,
    minCompletedOrders: 5,
    maxDiscountAmount: 300,
    minOrderValue: 199,
    feeAmount: 40,
    feeType: 'per_order',
    heavyWeightThresholdKg: 5,
  });

  // Simulator Modal State
  const [simOpen, setSimOpen] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simItems, setSimItems] = useState([
    { name: 'Fresh Tomato (Hybrid)', price: 40, quantity: 4, productId: '' },
    { name: 'Basmati Rice 5kg Sack', price: 450, quantity: 1, productId: '', weight: 5, isHeavy: true },
  ]);
  const [simResult, setSimResult] = useState(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await opsApi.list('pricing');
      setRules(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dynamic pricing rules');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalogMasters = useCallback(async () => {
    try {
      const [prodsRes, catsRes] = await Promise.allSettled([
        opsApi.list('products/lite'),
        opsApi.list('pricing/categories'),
      ]);
      if (prodsRes.status === 'fulfilled' && Array.isArray(prodsRes.value?.data)) {
        setProductsList(prodsRes.value.data);
      }
      if (catsRes.status === 'fulfilled' && catsRes.value?.data) {
        const catData = catsRes.value.data;
        setCategoriesList(catData.categories || []);
        setSubcategoriesList(catData.subcategories || []);
        setSubcategoriesMap(catData.subcategoriesByCategory || {});
      }
    } catch (e) {
      console.warn('Failed to load catalog masters:', e);
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadCatalogMasters();
  }, [loadRules, loadCatalogMasters]);

  const strategyCounts = useMemo(() => {
    const counts = { all: rules.length };
    STRATEGIES.forEach((s) => {
      counts[s.id] = rules.filter((r) => (r.ruleType || 'quantity_discount') === s.id).length;
    });
    return counts;
  }, [rules]);

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      const type = rule.ruleType || 'quantity_discount';
      if (selectedStrategy !== 'all' && type !== selectedStrategy) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const matchName = String(rule.name || '').toLowerCase().includes(q);
      const matchType = String(type).toLowerCase().includes(q);
      const matchCategory = Array.isArray(rule.categoryNames)
        ? rule.categoryNames.some((c) => String(c).toLowerCase().includes(q))
        : false;
      return matchName || matchType || matchCategory;
    });
  }, [rules, selectedStrategy, search]);

  const openCreateModal = (presetType = null) => {
    setEditingRule(null);
    setForm({
      name: '',
      description: '',
      ruleType: presetType || (selectedStrategy !== 'all' ? selectedStrategy : 'quantity_discount'),
      enabled: true,
      applyTo: presetType === 'heavy_handling_fee' ? 'weight_threshold' : 'all',
      categoryNames: [],
      productIds: [],
      startDate: '',
      endDate: '',
      minQuantity: 10,
      discountType: 'percentage',
      discountValue: 5,
      bundleQuantity: 3,
      bundlePrice: 299,
      exceptionProductIds: [],
      exceptionCategoryNames: [],
      tiers: [
        { minQuantity: 2, maxQuantity: 5, discountType: 'percentage', discountValue: 10 },
        { minQuantity: 6, maxQuantity: '', discountType: 'percentage', discountValue: 20 },
      ],
      triggerType: 'min_spend',
      minSpend: 499,
      triggerProductIds: [],
      triggerCategoryNames: [],
      addonProductId: '',
      addonProductName: '',
      addonQuantity: 1,
      addonDiscountType: 'free',
      addonDiscountValue: 100,
      minCompletedOrders: 5,
      maxDiscountAmount: 300,
      minOrderValue: 199,
      feeAmount: 40,
      feeType: 'per_order',
      heavyWeightThresholdKg: 5,
    });
    setModalOpen(true);
  };

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name || '',
      description: rule.description || '',
      ruleType: rule.ruleType || 'quantity_discount',
      enabled: rule.enabled !== false,
      applyTo: rule.applyTo || 'all',
      categoryNames: Array.isArray(rule.categoryNames) ? rule.categoryNames : [],
      productIds: Array.isArray(rule.productIds) ? rule.productIds.map((id) => String(id?._id || id)) : [],
      startDate: rule.startDate ? rule.startDate.slice(0, 10) : '',
      endDate: rule.endDate ? rule.endDate.slice(0, 10) : '',
      minQuantity: rule.minQuantity ?? 10,
      discountType: rule.discountType || 'percentage',
      discountValue: rule.discountValue ?? 5,
      bundleQuantity: rule.bundleQuantity ?? 3,
      bundlePrice: rule.bundlePrice ?? 299,
      exceptionProductIds: Array.isArray(rule.exceptionProductIds) ? rule.exceptionProductIds.map((id) => String(id?._id || id)) : [],
      exceptionCategoryNames: Array.isArray(rule.exceptionCategoryNames) ? rule.exceptionCategoryNames : [],
      tiers: Array.isArray(rule.tiers) && rule.tiers.length ? rule.tiers : [
        { minQuantity: 2, maxQuantity: 5, discountType: 'percentage', discountValue: 10 },
        { minQuantity: 6, maxQuantity: '', discountType: 'percentage', discountValue: 20 },
      ],
      triggerType: rule.triggerType || 'min_spend',
      minSpend: rule.minSpend ?? 499,
      triggerProductIds: Array.isArray(rule.triggerProductIds) ? rule.triggerProductIds.map((id) => String(id?._id || id)) : [],
      triggerCategoryNames: Array.isArray(rule.triggerCategoryNames) ? rule.triggerCategoryNames : [],
      addonProductId: rule.addonProductId ? String(rule.addonProductId?._id || rule.addonProductId) : '',
      addonProductName: rule.addonProductName || '',
      addonQuantity: rule.addonQuantity ?? 1,
      addonDiscountType: rule.addonDiscountType || 'free',
      addonDiscountValue: rule.addonDiscountValue ?? 100,
      minCompletedOrders: rule.minCompletedOrders ?? 5,
      maxDiscountAmount: rule.maxDiscountAmount ?? 300,
      minOrderValue: rule.minOrderValue ?? 199,
      feeAmount: rule.feeAmount ?? 40,
      feeType: rule.feeType || 'per_order',
      heavyWeightThresholdKg: rule.heavyWeightThresholdKg ?? 5,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingRule) {
        await opsApi.update('pricing', editingRule._id, form);
      } else {
        await opsApi.create('pricing', form);
      }
      setModalOpen(false);
      await loadRules();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save pricing rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (rule) => {
    try {
      await opsApi.update('pricing', rule._id, { enabled: !rule.enabled });
      await loadRules();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle rule');
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Delete pricing rule "${rule.name}"?`)) return;
    try {
      await opsApi.remove('pricing', rule._id);
      await loadRules();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete rule');
    }
  };

  // Tier helpers
  const handleAddTier = () => {
    setForm((prev) => {
      const last = prev.tiers[prev.tiers.length - 1];
      const nextMin = last && Number(last.maxQuantity) ? Number(last.maxQuantity) + 1 : 10;
      return {
        ...prev,
        tiers: [
          ...prev.tiers,
          { minQuantity: nextMin, maxQuantity: '', discountType: 'percentage', discountValue: 25 },
        ],
      };
    });
  };

  const handleRemoveTier = (index) => {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateTier = (index, key, val) => {
    setForm((prev) => {
      const nextTiers = [...prev.tiers];
      nextTiers[index] = { ...nextTiers[index], [key]: val };
      return { ...prev, tiers: nextTiers };
    });
  };

  // Simulator Run
  const handleRunSimulation = async () => {
    setSimLoading(true);
    setSimResult(null);
    try {
      const subtotal = simItems.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 1), 0);
      const res = await opsApi.create('pricing/preview', {
        items: simItems,
        subtotal,
        userId: 'simulation_user',
      });
      setSimResult({ ...res.data, subtotal });
    } catch (err) {
      setError('Simulation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSimLoading(false);
    }
  };

  const renderRuleSummary = (rule) => {
    const type = rule.ruleType || 'quantity_discount';
    switch (type) {
      case 'quantity_discount':
        return (
          <div>
            <span className="font-semibold text-slate-900">
              Buy {rule.minQuantity}+ units
            </span>
            <span className="ml-1.5 inline-block rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-800">
              {rule.discountType === 'fixed' ? `₹${rule.discountValue} off` : `${rule.discountValue}% off`}
            </span>
          </div>
        );
      case 'bundle_pricing':
        return (
          <div>
            <span className="font-semibold text-slate-900">
              {rule.bundleQuantity} items bundle for
            </span>
            <span className="ml-1.5 inline-block rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-800">
              ₹{rule.bundlePrice} fixed
            </span>
            {rule.exceptionCategoryNames?.length || rule.exceptionProductIds?.length ? (
              <span className="ml-1.5 text-[11px] text-amber-700 font-medium">
                ({(rule.exceptionCategoryNames || []).join(', ') || 'Exceptions excluded'})
              </span>
            ) : null}
          </div>
        );
      case 'tiered_quantity':
        return (
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-purple-900">
              {rule.tiers?.length || 0} Tier Slabs:
            </span>
            <div className="flex flex-wrap gap-1">
              {(rule.tiers || []).map((t, idx) => (
                <span
                  key={idx}
                  className="rounded bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 border border-purple-200"
                >
                  {t.minQuantity}{t.maxQuantity ? `–${t.maxQuantity}` : '+'} units → {t.discountValue}{t.discountType === 'fixed' ? '₹' : '%'}
                </span>
              ))}
            </div>
          </div>
        );
      case 'free_addon':
        return (
          <div>
            <span className="font-semibold text-slate-900">
              {rule.addonDiscountType === 'free' || rule.addonDiscountValue >= 100 ? 'Free' : `${rule.addonDiscountValue}% off`}:
            </span>{' '}
            <span className="text-amber-900 font-medium">
              {rule.addonProductName || 'Complimentary Gift'}
            </span>
            <p className="text-[11px] text-slate-500">
              Trigger: {rule.triggerType === 'min_spend' ? `Cart spend ≥ ₹${rule.minSpend}` : rule.triggerType}
            </p>
          </div>
        );
      case 'loyalty_discount':
        return (
          <div>
            <span className="font-semibold text-slate-900">
              After {rule.minCompletedOrders}+ orders:
            </span>
            <span className="ml-1.5 inline-block rounded-md bg-rose-100 px-1.5 py-0.5 text-xs font-bold text-rose-800">
              {rule.discountType === 'fixed' ? `₹${rule.discountValue} off` : `${rule.discountValue}% Lifetime`}
            </span>
            {rule.maxDiscountAmount ? (
              <span className="ml-1 text-[11px] text-slate-500">
                (Up to ₹{rule.maxDiscountAmount})
              </span>
            ) : null}
          </div>
        );
      case 'heavy_handling_fee':
        return (
          <div>
            <span className="font-bold text-slate-900">
              +₹{rule.feeAmount} Surcharge
            </span>
            <span className="ml-1.5 text-xs text-slate-600">
              ({rule.feeType === 'per_item' ? 'per item' : rule.feeType === 'per_kg_over_threshold' ? 'per excess kg' : 'flat per order'})
            </span>
            <p className="text-[11px] text-slate-500">
              Criteria: Weight ≥ {rule.heavyWeightThresholdKg} kg or heavy goods
            </p>
          </div>
        );
      default:
        return <span>Custom rule</span>;
    }
  };

  const getStrategyMeta = (type) => {
    return STRATEGIES.find((s) => s.id === type) || STRATEGIES[0];
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-sm">
            <BadgePercent className="h-5 w-5" />
          </div>
          <h1 className={PAGE_TITLE}>Dynamic Pricing & Promotions</h1>
          <p className={PAGE_SUB}>
            Configure quantity-based discounts, bundle pricing with exclusions, progressive tiered slabs, complimentary add-ons, lifetime loyalty discounts, and heavy item handling fees.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSimOpen(true);
              handleRunSimulation();
            }}
            className={`${BTN} border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100/70`}
          >
            <Play className="mr-1.5 h-4 w-4 text-indigo-600" />
            Test Live Simulator
          </button>
          <button type="button" onClick={loadRules} className={BTN}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className={BTN_PRIMARY}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create Pricing Rule
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto text-rose-500 hover:text-rose-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Top 6 Strategy Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {STRATEGIES.map((strat) => {
          const Icon = strat.icon;
          const count = strategyCounts[strat.id] || 0;
          const isSelected = selectedStrategy === strat.id;
          return (
            <button
              key={strat.id}
              type="button"
              onClick={() => setSelectedStrategy(isSelected ? 'all' : strat.id)}
              className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`inline-flex rounded-lg p-2 ${strat.badgeClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-lg font-bold text-slate-900">{count}</span>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-800">{strat.shortLabel}</p>
                <p className="line-clamp-2 mt-0.5 text-[11px] text-slate-500">{strat.example}</p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                <span>{isSelected ? 'Active Filter' : 'Filter by this'}</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Table Panel */}
      <div className={PANEL}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Strategy:
            </span>
            <button
              type="button"
              onClick={() => setSelectedStrategy('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedStrategy === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Strategies ({strategyCounts.all || 0})
            </button>
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStrategy(s.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  selectedStrategy === s.id
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.shortLabel} ({strategyCounts[s.id] || 0})
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search rules, categories, types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${INPUT} pl-9 text-xs`}
            />
          </div>
        </div>

        {/* Table content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />
              <p className="text-sm">Loading dynamic pricing rules...</p>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="py-16 text-center">
              <BadgePercent className="mx-auto mb-2 h-10 w-10 text-slate-300" />
              <p className="text-base font-semibold text-slate-800">No pricing rules found</p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedStrategy !== 'all'
                  ? `No rules configured under ${getStrategyMeta(selectedStrategy).label}.`
                  : 'Get started by creating your first quantity discount, bundle, tiered slab, or heavy surcharge.'}
              </p>
              <button
                type="button"
                onClick={() => openCreateModal(selectedStrategy !== 'all' ? selectedStrategy : null)}
                className={`${BTN_PRIMARY} mt-4 text-xs`}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Create {selectedStrategy !== 'all' ? getStrategyMeta(selectedStrategy).shortLabel : ''} Rule
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className={TH}>Rule Name & Type</th>
                  <th className={TH}>Rule Configuration</th>
                  <th className={TH}>Applies To</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Validity</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRules.map((rule) => {
                  const type = rule.ruleType || 'quantity_discount';
                  const meta = getStrategyMeta(type);
                  const Icon = meta.icon;
                  return (
                    <tr key={rule._id} className="hover:bg-slate-50/70 transition">
                      <td className={TD}>
                        <div className="flex items-start gap-2.5">
                          <div className={`mt-0.5 inline-flex rounded-lg p-1.5 ${meta.badgeClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{rule.name}</p>
                            <span className="inline-block mt-0.5 rounded text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              {meta.label}
                            </span>
                            {rule.description ? (
                              <p className="text-xs text-slate-500 line-clamp-1">{rule.description}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className={TD}>{renderRuleSummary(rule)}</td>
                      <td className={TD}>
                        <div>
                          <span className="font-medium text-slate-800 capitalize">
                            {rule.applyTo === 'all'
                              ? 'All Products'
                              : rule.applyTo === 'products'
                              ? `${rule.productIds?.length || 0} Products`
                              : rule.applyTo === 'categories'
                              ? `${rule.categoryNames?.length || 0} Categories`
                              : rule.applyTo === 'custom'
                              ? `Custom (${rule.categoryNames?.length || 0} cats, ${rule.productIds?.length || 0} prods)`
                              : rule.applyTo === 'weight_threshold'
                              ? `Weight ≥ ${rule.heavyWeightThresholdKg} kg`
                              : rule.applyTo}
                          </span>
                          {rule.categoryNames?.length && (rule.applyTo === 'categories' || rule.applyTo === 'custom') ? (
                            <p className="text-[11px] text-slate-500 line-clamp-1">
                              {rule.categoryNames.join(', ')}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className={TD}>
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(rule)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                            rule.enabled
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              rule.enabled ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}
                          />
                          {rule.enabled ? 'Live' : 'Paused'}
                        </button>
                      </td>
                      <td className={TD}>
                        <div className="text-xs text-slate-500">
                          {rule.startDate || rule.endDate ? (
                            <span>
                              {rule.startDate ? rule.startDate.slice(0, 10) : 'Now'} →{' '}
                              {rule.endDate ? rule.endDate.slice(0, 10) : 'Ongoing'}
                            </span>
                          ) : (
                            <span className="text-slate-400">Always active</span>
                          )}
                        </div>
                      </td>
                      <td className={`${TD} text-right`}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(rule)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Edit Rule"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(rule)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete Rule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CREATE & EDIT RULE MODAL */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="inline-flex rounded-xl bg-emerald-100 p-2 text-emerald-800">
                  <BadgePercent className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingRule ? `Edit Rule: ${editingRule.name}` : 'Create Dynamic Pricing Rule'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choose one of 6 dynamic pricing strategies and configure targets with linked category, subcategory, and product dropdowns.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-6">
              {/* Step 1: Strategy Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Step 1: Choose Dynamic Pricing Strategy
                </label>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {STRATEGIES.map((strat) => {
                    const Icon = strat.icon;
                    const isSelected = form.ruleType === strat.id;
                    return (
                      <button
                        key={strat.id}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            ruleType: strat.id,
                            applyTo: strat.id === 'heavy_handling_fee' ? 'weight_threshold' : prev.applyTo,
                          }));
                        }}
                        className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-600'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className={`rounded-lg p-1.5 ${strat.badgeClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-700" />}
                        </div>
                        <p className="mt-2 text-xs font-bold text-slate-900">{strat.label}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">{strat.example}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Basic Rule Info */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Buy 10 units · Get 5% off"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={`${INPUT} mt-1`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Description / Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Optional internal note or customer banner label"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className={`${INPUT} mt-1`}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className={`${INPUT} mt-1`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className={`${INPUT} mt-1`}
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.enabled}
                        onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Enable Rule Immediately
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* STRATEGY SPECIFIC FIELDS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-700" />
                  Step 2: Strategy Configuration ({getStrategyMeta(form.ruleType).label})
                </h4>

                {/* 1. QUANTITY-BASED DISCOUNT */}
                {form.ruleType === 'quantity_discount' && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Min Quantity to Qualify *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={form.minQuantity}
                          onChange={(e) => setForm({ ...form, minQuantity: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">e.g. 10 units</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Discount Type
                        </label>
                        <select
                          value={form.discountType}
                          onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                          className={`${INPUT} mt-1`}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Rupee (₹ off)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Discount Value *
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={form.discountType === 'percentage' ? 100 : 100000}
                          required
                          value={form.discountValue}
                          onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          {form.discountType === 'percentage' ? 'e.g. 5%' : 'e.g. ₹50 off per unit'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. BUNDLE PRICING */}
                {form.ruleType === 'bundle_pricing' && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Bundle Quantity *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={form.bundleQuantity}
                          onChange={(e) => setForm({ ...form, bundleQuantity: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">e.g. 3 items in the bundle</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Fixed Bundle Price (₹) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={form.bundlePrice}
                          onChange={(e) => setForm({ ...form, bundlePrice: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          e.g. ₹299 for all 3 items combined
                        </p>
                      </div>
                    </div>

                    {/* Exclusions / Exceptions with Cascading Picker */}
                    <CascadingTargetPicker
                      title="Exceptions & Exclusions (Items excluded from this bundle)"
                      isExceptionMode={true}
                      applyTo="custom"
                      onChangeApplyTo={() => {}}
                      selectedCategoryNames={form.exceptionCategoryNames}
                      onChangeCategoryNames={(cats) => setForm({ ...form, exceptionCategoryNames: cats })}
                      selectedProductIds={form.exceptionProductIds}
                      onChangeProductIds={(pids) => setForm({ ...form, exceptionProductIds: pids })}
                      categories={categoriesList}
                      subcategoriesByCategory={subcategoriesMap}
                      allSubcategories={subcategoriesList}
                      products={productsList}
                    />
                  </div>
                )}

                {/* 3. TIERED QUANTITY */}
                {form.ruleType === 'tiered_quantity' && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-700">
                        Define Progressive Quantity Slabs (e.g. 2–5 units at 10%, 6+ units at 20%)
                      </p>
                      <button
                        type="button"
                        onClick={handleAddTier}
                        className={`${BTN} text-xs py-1 px-2.5 text-emerald-700 border-emerald-300`}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add Slab Tier
                      </button>
                    </div>

                    <div className="space-y-2">
                      {form.tiers.map((tier, idx) => (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs"
                        >
                          <span className="font-bold text-slate-500 w-12">Slab {idx + 1}:</span>
                          <div className="flex items-center gap-1">
                            <span>From</span>
                            <input
                              type="number"
                              min="1"
                              value={tier.minQuantity}
                              onChange={(e) => handleUpdateTier(idx, 'minQuantity', Number(e.target.value))}
                              className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1"
                            />
                            <span>to</span>
                            <input
                              type="number"
                              placeholder="Any"
                              value={tier.maxQuantity}
                              onChange={(e) => handleUpdateTier(idx, 'maxQuantity', e.target.value)}
                              className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1"
                            />
                            <span>units</span>
                          </div>

                          <div className="flex items-center gap-1 ml-auto">
                            <span>Get</span>
                            <input
                              type="number"
                              min="0"
                              value={tier.discountValue}
                              onChange={(e) => handleUpdateTier(idx, 'discountValue', Number(e.target.value))}
                              className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1"
                            />
                            <select
                              value={tier.discountType}
                              onChange={(e) => handleUpdateTier(idx, 'discountType', e.target.value)}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1"
                            >
                              <option value="percentage">% off</option>
                              <option value="fixed">₹ off</option>
                            </select>
                            {form.tiers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTier(idx)}
                                className="rounded p-1 text-slate-400 hover:text-rose-600 ml-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. FREE / DISCOUNTED ADD-ON */}
                {form.ruleType === 'free_addon' && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Trigger Condition
                        </label>
                        <select
                          value={form.triggerType}
                          onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
                          className={`${INPUT} mt-1`}
                        >
                          <option value="min_spend">Minimum Cart Spend (₹)</option>
                          <option value="specific_categories">When buying from specific categories</option>
                          <option value="specific_products">When buying specific product(s)</option>
                          <option value="any_order">Any order</option>
                        </select>
                      </div>

                      {form.triggerType === 'min_spend' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Minimum Order Spend (₹) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={form.minSpend}
                            onChange={(e) => setForm({ ...form, minSpend: Number(e.target.value) })}
                            className={`${INPUT} mt-1`}
                          />
                          <p className="mt-1 text-[11px] text-slate-400">e.g. ₹499</p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                      <p className="text-xs font-bold text-amber-900">
                        Pick Complimentary Add-on Product
                      </p>
                      
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700">
                            Choose from Catalog (Category $\rightarrow$ Product):
                          </label>
                          <select
                            value={form.addonProductId}
                            onChange={(e) => {
                              const pid = e.target.value;
                              const prod = productsList.find((p) => String(p._id) === pid);
                              setForm({
                                ...form,
                                addonProductId: pid,
                                addonProductName: prod ? prod.name : form.addonProductName,
                              });
                            }}
                            className={`${INPUT} mt-1 bg-white text-xs`}
                          >
                            <option value="">-- Choose Catalog Product ({productsList.length}) --</option>
                            {productsList.slice(0, 200).map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name} · ₹{p.discountedPrice || p.price} ({p.subcategory || p.categories?.[0] || 'General'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={form.addonQuantity}
                            onChange={(e) => setForm({ ...form, addonQuantity: Number(e.target.value) })}
                            className={`${INPUT} mt-1 bg-white`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Or Enter Custom Display Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Fresh Mint Leaves (Pudina)"
                          value={form.addonProductName}
                          onChange={(e) => setForm({ ...form, addonProductName: e.target.value })}
                          className={`${INPUT} mt-1 bg-white`}
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Pricing for Add-on
                          </label>
                          <select
                            value={form.addonDiscountType}
                            onChange={(e) => setForm({ ...form, addonDiscountType: e.target.value })}
                            className={`${INPUT} mt-1 bg-white`}
                          >
                            <option value="free">100% Free (Complimentary)</option>
                            <option value="percentage">Discounted (%)</option>
                            <option value="fixed_price">Special Flat Price (₹)</option>
                          </select>
                        </div>
                        {form.addonDiscountType !== 'free' && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-700">
                              Value ({form.addonDiscountType === 'percentage' ? '%' : '₹'})
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={form.addonDiscountValue}
                              onChange={(e) => setForm({ ...form, addonDiscountValue: Number(e.target.value) })}
                              className={`${INPUT} mt-1 bg-white`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. LIFETIME LOYALTY */}
                {form.ruleType === 'loyalty_discount' && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Completed Orders Required *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={form.minCompletedOrders}
                          onChange={(e) => setForm({ ...form, minCompletedOrders: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">e.g. 5 orders</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Discount Type
                        </label>
                        <select
                          value={form.discountType}
                          onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                          className={`${INPUT} mt-1`}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Rupee (₹ off)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Discount Value *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={form.discountValue}
                          onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          {form.discountType === 'percentage' ? 'e.g. 10% lifetime' : 'e.g. ₹50 off'}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Max Discount Cap (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0 = Unlimited"
                          value={form.maxDiscountAmount}
                          onChange={(e) => setForm({ ...form, maxDiscountAmount: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">Optional cap per order (e.g. ₹300)</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Min Order Value (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0 = None"
                          value={form.minOrderValue}
                          onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">Order minimum to apply loyalty savings</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. HEAVY HANDLING FEE */}
                {form.ruleType === 'heavy_handling_fee' && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Handling Fee Amount (₹) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={form.feeAmount}
                          onChange={(e) => setForm({ ...form, feeAmount: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">e.g. ₹40</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Fee Structure
                        </label>
                        <select
                          value={form.feeType}
                          onChange={(e) => setForm({ ...form, feeType: e.target.value })}
                          className={`${INPUT} mt-1`}
                        >
                          <option value="per_order">Flat per order containing heavy items</option>
                          <option value="per_item">Per heavy item unit in cart</option>
                          <option value="per_kg_over_threshold">Per excess kg over threshold</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Weight Threshold (kg) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={form.heavyWeightThresholdKg}
                          onChange={(e) => setForm({ ...form, heavyWeightThresholdKg: Number(e.target.value) })}
                          className={`${INPUT} mt-1`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">e.g. 5 kg</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: CASCADING TARGET PICKER (Category -> Subcategory -> Product) */}
              {form.ruleType !== 'heavy_handling_fee' && (
                <CascadingTargetPicker
                  title="Step 3: Target Scope (Category → Subcategory → Product)"
                  applyTo={form.applyTo}
                  onChangeApplyTo={(scope) => setForm({ ...form, applyTo: scope })}
                  selectedCategoryNames={form.categoryNames}
                  onChangeCategoryNames={(cats) => setForm({ ...form, categoryNames: cats })}
                  selectedProductIds={form.productIds}
                  onChangeProductIds={(pids) => setForm({ ...form, productIds: pids })}
                  categories={categoriesList}
                  subcategoriesByCategory={subcategoriesMap}
                  allSubcategories={subcategoriesList}
                  products={productsList}
                />
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={BTN_PRIMARY}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingRule ? (
                    'Update Rule'
                  ) : (
                    'Create Rule'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* SIMULATOR MODAL */}
      {simOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
                  <Play className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Dynamic Pricing Cart Simulator
                  </h3>
                  <p className="text-xs text-slate-500">
                    Test live calculation across active rules, bundles, loyalty, and heavy fees.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSimOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Mock Cart Items
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSimItems([
                        ...simItems,
                        { name: 'Fresh Produce', price: 60, quantity: 2 },
                      ])
                    }
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {simItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs"
                    >
                      <input
                        type="text"
                        value={item.name}
                        placeholder="Item name"
                        onChange={(e) => {
                          const next = [...simItems];
                          next[idx].name = e.target.value;
                          setSimItems(next);
                        }}
                        className="flex-1 rounded border border-slate-300 bg-white px-2 py-1"
                      />
                      <span className="text-slate-400">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const next = [...simItems];
                          next[idx].quantity = Number(e.target.value);
                          setSimItems(next);
                        }}
                        className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1"
                      />
                      <span className="text-slate-400">₹:</span>
                      <input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(e) => {
                          const next = [...simItems];
                          next[idx].price = Number(e.target.value);
                          setSimItems(next);
                        }}
                        className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1"
                      />
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 ml-1">
                        <input
                          type="checkbox"
                          checked={item.isHeavy || false}
                          onChange={(e) => {
                            const next = [...simItems];
                            next[idx].isHeavy = e.target.checked;
                            next[idx].weight = e.target.checked ? 6 : 1;
                            setSimItems(next);
                          }}
                        />
                        Heavy
                      </label>
                      {simItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSimItems(simItems.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={simLoading}
                className={`${BTN_PRIMARY} w-full text-xs py-2`}
              >
                {simLoading ? 'Evaluating Rules...' : 'Calculate Live Pricing'}
              </button>

              {/* Simulation Output */}
              {simResult && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                    <span className="text-xs font-bold text-emerald-950 uppercase">
                      Calculation Breakdown
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Subtotal: ₹{simResult.subtotal}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {simResult.breakdown?.length === 0 ? (
                      <p className="text-slate-500 italic">No rules matched these mock items.</p>
                    ) : (
                      simResult.breakdown.map((b, i) => (
                        <div key={i} className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-slate-900">{b.ruleName}</span>
                            <p className="text-[11px] text-slate-600">{b.details}</p>
                          </div>
                          <span
                            className={`font-bold ${
                              b.savings ? 'text-emerald-700' : 'text-slate-700'
                            }`}
                          >
                            {b.savings ? `-₹${b.savings}` : `+₹${b.fee}`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2 border-t border-emerald-200 flex items-center justify-between font-bold text-slate-900">
                    <span>Total Dynamic Savings:</span>
                    <span className="text-emerald-700">-₹{simResult.totalDiscount}</span>
                  </div>
                  {simResult.heavyHandlingFee > 0 && (
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Heavy Handling Surcharge:</span>
                      <span className="text-amber-800">+₹{simResult.heavyHandlingFee}</span>
                    </div>
                  )}
                  {simResult.freeAddon && (
                    <div className="rounded-lg bg-amber-100 p-2 text-xs font-semibold text-amber-900">
                      🎁 Eligible Complimentary Add-on: {simResult.freeAddon.name} (Qty {simResult.freeAddon.quantity})
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
