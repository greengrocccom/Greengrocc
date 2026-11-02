import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Boxes,
  Clock3,
  AlertTriangle,
  ClipboardList,
  BarChart3,
  FileSpreadsheet,
  Search,
  RefreshCw,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  Calendar,
  Layers,
  Store,
  Tag,
  Building2,
  ArrowUpDown,
  Check,
  Package,
  IndianRupee,
  ShieldCheck,
  Clock,
  Trash2,
  AlertOctagon,
  FileText,
} from 'lucide-react';
import {
  PANEL,
  PANEL_HEAD,
  INPUT,
  BTN,
  BTN_PRIMARY,
  PAGE_KICKER,
  PAGE_TITLE,
  PAGE_SUB,
  TH,
  TD,
} from '../../utils/ui';
import inventoryToolsApi from '../../api/inventoryToolsApi';

export default function InventoryToolsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();

  // Active Tab mapping
  const currentTab = useMemo(() => {
    if (tab === 'batches') return 'batches';
    if (tab === 'alerts') return 'alerts';
    if (tab === 'grn') return 'grn';
    if (tab === 'dead-stock') return 'dead-stock';
    if (tab === 'adjustments') return 'adjustments';
    return 'realtime'; // default
  }, [tab]);

  const setTab = (key) => {
    if (key === 'realtime') navigate('/inventory-tools');
    else navigate(`/inventory-tools/${key}`);
  };

  // Global filters & metadata
  const [stores, setStores] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState([]);

  // Data states
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Tab 1: Real-time stock
  const [stockStats, setStockStats] = useState({});
  const [stockList, setStockList] = useState([]);

  // Tab 2: Batches
  const [batchStats, setBatchStats] = useState({});
  const [batchList, setBatchList] = useState([]);
  const [quarantineModal, setQuarantineModal] = useState({ open: false, batch: null, reason: '' });

  // Tab 3: Alerts
  const [alertStats, setAlertStats] = useState({});
  const [alertList, setAlertList] = useState([]);

  // Tab 4: GRN
  const [grnStats, setGrnStats] = useState({});
  const [grnList, setGrnList] = useState([]);
  const [grnModalOpen, setGrnModalOpen] = useState(false);
  const [newGrn, setNewGrn] = useState({
    storeId: '',
    supplierName: '',
    supplierType: 'vendor',
    poNumber: '',
    invoiceNumber: '',
    notes: '',
    items: [],
  });

  // Tab 5: Dead-stock
  const [deadStockStats, setDeadStockStats] = useState({});
  const [deadStockList, setDeadStockList] = useState([]);

  // Tab 6: Adjustments
  const [adjustStats, setAdjustStats] = useState({});
  const [adjustList, setAdjustList] = useState([]);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [newAdjustment, setNewAdjustment] = useState({
    storeId: '',
    sku: '',
    productName: '',
    adjustedQty: 0,
    unitCost: 50,
    reason: 'cycle_count',
    notes: '',
  });

  // Notification toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load Metadata (stores, vendors, product master)
  useEffect(() => {
    let mounted = true;
    inventoryToolsApi
      .getMetadata()
      .then((data) => {
        if (!mounted) return;
        setStores(data?.stores || []);
        setVendors(data?.vendors || []);
        setCatalogProducts(data?.products || []);
      })
      .catch((err) => console.error('Failed to load metadata:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch data per active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (selectedStore && selectedStore !== 'ALL') params.storeId = selectedStore;
    if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
    if (searchQuery.trim()) params.search = searchQuery.trim();

    try {
      if (currentTab === 'realtime') {
        const res = await inventoryToolsApi.getRealtimeStock(params);
        setStockStats(res?.stats || {});
        setStockList(res?.products || []);
        if (res?.categories?.length) setCategories(res.categories);
      } else if (currentTab === 'batches') {
        const res = await inventoryToolsApi.getBatches(params);
        setBatchStats(res?.stats || {});
        setBatchList(res?.batches || []);
      } else if (currentTab === 'alerts') {
        const res = await inventoryToolsApi.getLowStockAlerts(params);
        setAlertStats(res?.stats || {});
        setAlertList(res?.alerts || []);
      } else if (currentTab === 'grn') {
        const res = await inventoryToolsApi.getGrnList(params);
        setGrnStats(res?.stats || {});
        setGrnList(res?.grns || []);
      } else if (currentTab === 'dead-stock') {
        const res = await inventoryToolsApi.getDeadStock(params);
        setDeadStockStats(res?.stats || {});
        setDeadStockList(res?.deadStock || []);
      } else if (currentTab === 'adjustments') {
        const res = await inventoryToolsApi.getAdjustments(params);
        setAdjustStats(res?.stats || {});
        setAdjustList(res?.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch inventory tools data:', err);
      showToast(err.response?.data?.message || 'Error loading live data', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentTab, selectedStore, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Quarantine Action
  const handleQuarantineConfirm = async () => {
    if (!quarantineModal.batch) return;
    try {
      await inventoryToolsApi.quarantineBatch(quarantineModal.batch.id, quarantineModal.reason);
      showToast(`Batch ${quarantineModal.batch.batchNumber} quarantined successfully`);
      setQuarantineModal({ open: false, batch: null, reason: '' });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to quarantine batch', 'error');
    }
  };

  // Open Adjust Modal from Stock Table or Alerts
  const openAdjustForProduct = (item) => {
    setNewAdjustment({
      storeId: item.storeId || stores[0]?.id || '',
      sku: item.sku,
      productName: item.name || item.productName,
      adjustedQty: 0,
      unitCost: item.costPrice || item.price || 50,
      reason: 'cycle_count',
      notes: '',
      currentStock: item.stockCount !== undefined ? item.stockCount : item.currentStock,
    });
    setAdjustModalOpen(true);
  };

  // Submit Stock Adjustment
  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!newAdjustment.storeId || !newAdjustment.sku) {
      showToast('Store and Product SKU are required', 'error');
      return;
    }
    if (Number(newAdjustment.adjustedQty) === 0) {
      showToast('Adjustment quantity cannot be 0', 'error');
      return;
    }
    try {
      await inventoryToolsApi.createAdjustment({
        storeId: newAdjustment.storeId,
        sku: newAdjustment.sku,
        adjustedQty: Number(newAdjustment.adjustedQty),
        reason: newAdjustment.reason,
        unitCost: Number(newAdjustment.unitCost) || 0,
        notes: newAdjustment.notes || 'Manual stock reconciliation',
      });
      showToast('Stock adjustment logged & inventory updated successfully');
      setAdjustModalOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save adjustment', 'error');
    }
  };

  // Open GRN Modal with prefilled item (from Low-Stock Alert)
  const openGrnForReplenish = (alertItem) => {
    setNewGrn({
      storeId: alertItem.storeId || stores[0]?.id || '',
      supplierName: vendors[0]?.name || 'Direct Collection Centre',
      supplierType: 'vendor',
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
      notes: `Restock order triggered from low stock deficit (${alertItem.deficitQty} units needed)`,
      items: [
        {
          sku: alertItem.sku,
          name: alertItem.name,
          category: alertItem.category || 'General',
          unit: alertItem.unit || 'kg',
          orderedQty: alertItem.deficitQty || 50,
          receivedQty: alertItem.deficitQty || 50,
          rejectedQty: 0,
          acceptedQty: alertItem.deficitQty || 50,
          unitCost: Math.round((alertItem.unitPrice || 60) * 0.7),
          batchNumber: `BAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          expiryDays: 20,
        },
      ],
    });
    setGrnModalOpen(true);
  };

  // Add line item to GRN
  const addGrnLineItem = () => {
    const prod = catalogProducts[0] || {};
    setNewGrn((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          sku: prod.sku || '',
          name: prod.name || '',
          category: prod.category || 'General',
          unit: prod.unit || 'kg',
          orderedQty: 50,
          receivedQty: 50,
          rejectedQty: 0,
          acceptedQty: 50,
          unitCost: 45,
          batchNumber: `BAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          expiryDays: 25,
        },
      ],
    }));
  };

  const updateGrnItem = (idx, field, value) => {
    setNewGrn((prev) => {
      const copy = [...(prev.items || [])];
      const item = { ...copy[idx], [field]: value };
      if (field === 'receivedQty' || field === 'rejectedQty') {
        const rec = Number(field === 'receivedQty' ? value : item.receivedQty) || 0;
        const rej = Number(field === 'rejectedQty' ? value : item.rejectedQty) || 0;
        item.acceptedQty = Math.max(0, rec - rej);
      }
      copy[idx] = item;
      return { ...prev, items: copy };
    });
  };

  const removeGrnItem = (idx) => {
    setNewGrn((prev) => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== idx),
    }));
  };

  // Submit GRN
  const handleSaveGrn = async (e) => {
    e.preventDefault();
    if (!newGrn.storeId) {
      showToast('Select destination store', 'error');
      return;
    }
    if (!newGrn.supplierName) {
      showToast('Supplier name is required', 'error');
      return;
    }
    if (!newGrn.items?.length) {
      showToast('Add at least one line item to the GRN', 'error');
      return;
    }

    try {
      const payload = {
        storeId: newGrn.storeId,
        supplierName: newGrn.supplierName,
        supplierType: newGrn.supplierType,
        poNumber: newGrn.poNumber,
        invoiceNumber: newGrn.invoiceNumber,
        invoiceDate: new Date(),
        notes: newGrn.notes,
        items: (newGrn.items || []).map((it) => {
          const expDate = new Date();
          expDate.setDate(expDate.getDate() + (Number(it.expiryDays) || 20));
          return {
            sku: it.sku,
            name: it.name,
            category: it.category || 'General',
            unit: it.unit || 'kg',
            orderedQty: Number(it.orderedQty),
            receivedQty: Number(it.receivedQty),
            rejectedQty: Number(it.rejectedQty),
            acceptedQty: Number(it.acceptedQty),
            unitCost: Number(it.unitCost),
            totalCost: Number(it.acceptedQty) * Number(it.unitCost),
            batchNumber: it.batchNumber,
            mfgDate: new Date(),
            expiryDate: expDate,
          };
        }),
      };
      await inventoryToolsApi.createGrn(payload);
      showToast('GRN processed! Stock and batches inwarded successfully.');
      setGrnModalOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit GRN', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-700 text-white'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className={`${PANEL} p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={PAGE_KICKER}>Supply Chain & Warehouse</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Live Real-Time
              </span>
            </div>
            <h1 className={PAGE_TITLE}>Inventory & Stock Tools</h1>
            <p className={PAGE_SUB}>
              Real-time stock visibility, batch shelf-life & expiry tracking, low-stock alerts, purchase GRN handling, dead-stock, and adjustment audit logs.
            </p>
          </div>

          {/* Store Selector & Refresh */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs">
              <Store className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-semibold text-slate-600">Store / Hub:</span>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="bg-transparent font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">All Dark Stores & Hubs</option>
                {(stores || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.zone || s.city || 'Hub'})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              title="Refresh live data"
              className={`${BTN} gap-1.5 px-3 py-1.5 text-xs font-semibold`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-700' : 'text-slate-600'}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 6 Sub-Tabs Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          {[
            {
              id: 'realtime',
              label: 'Real-Time Stock',
              icon: Boxes,
              badge: stockStats?.totalSkus,
            },
            {
              id: 'batches',
              label: 'Batch & Expiry',
              icon: Clock3,
              badge: batchStats?.nearExpiryCount ? `${batchStats.nearExpiryCount}` : null,
              badgeColor: 'bg-amber-100 text-amber-800',
            },
            {
              id: 'alerts',
              label: 'Low-Stock Alerts',
              icon: AlertTriangle,
              badge: alertStats?.criticalCount ? `${alertStats.criticalCount}` : null,
              badgeColor: 'bg-rose-100 text-rose-800',
            },
            {
              id: 'grn',
              label: 'Purchase & GRN',
              icon: ClipboardList,
              badge: grnStats?.totalGrns,
            },
            {
              id: 'dead-stock',
              label: 'Dead-Stock Reports',
              icon: BarChart3,
              badge: deadStockStats?.deadStockCount,
            },
            {
              id: 'adjustments',
              label: 'Adjustment Logs',
              icon: FileSpreadsheet,
              badge: adjustStats?.totalLogs,
            },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = currentTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`group flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{t.label}</span>
                {t.badge !== undefined && t.badge !== null && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive ? 'bg-emerald-800 text-emerald-100' : t.badgeColor || 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Real-Time Stock Visibility */}
      {currentTab === 'realtime' && (
        <div className="space-y-4">
          {/* Summary Metric Chips */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Total Catalog SKUs</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-900">{stockStats?.totalSkus ?? 0}</span>
                <Boxes className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Tracked in live inventory</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">In Stock SKUs</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-emerald-700">{stockStats?.inStockSkus ?? 0}</span>
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">Healthy</span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Available to sell</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Low & Zero Stock</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-amber-700">
                  {(stockStats?.lowStockSkus ?? 0) + (stockStats?.outOfStockSkus ?? 0)}
                </span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Action Req</span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">{stockStats?.outOfStockSkus ?? 0} completely out</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Total Stock Units</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-900">
                  {(stockStats?.totalStockUnits ?? 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-slate-500">Physical count</span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Total physical on-hand</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Inventory Valuation</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-emerald-800">
                  ₹{Math.round(stockStats?.totalValuation ?? 0).toLocaleString('en-IN')}
                </span>
                <IndianRupee className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Asset value at retail</div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className={`${PANEL} p-3`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by SKU, product name, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
                >
                  <option value="All">All Categories</option>
                  {(categories || []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    const firstProd = stockList[0] || {};
                    setNewAdjustment({
                      storeId: stores[0]?.id || '',
                      sku: firstProd.sku || '',
                      productName: firstProd.name || '',
                      adjustedQty: 0,
                      unitCost: firstProd.costPrice || firstProd.price || 50,
                      reason: 'cycle_count',
                      notes: 'Routine shelf count audit',
                      currentStock: firstProd.stockCount || 0,
                    });
                    setAdjustModalOpen(true);
                  }}
                  className={`${BTN_PRIMARY} gap-1.5 px-3 py-2 text-xs font-semibold`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Log Adjustment</span>
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Table */}
          <div className={`${PANEL} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className={TH}>Product & SKU</th>
                    <th className={TH}>Category</th>
                    <th className={TH}>Store / Hub</th>
                    <th className={`${TH} text-right`}>Physical Stock</th>
                    <th className={`${TH} text-right`}>Reserved</th>
                    <th className={`${TH} text-right font-bold text-slate-800`}>ATP Units</th>
                    <th className={`${TH} text-right`}>Price</th>
                    <th className={`${TH} text-right`}>Valuation</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-center`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(stockList || []).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-xs text-slate-500">
                        {loading ? 'Fetching real-time inventory from database...' : 'No products found matching filters.'}
                      </td>
                    </tr>
                  ) : (
                    (stockList || []).map((item, idx) => (
                      <tr key={item.id || `${item.sku}-${item.storeId || idx}`} className="transition hover:bg-slate-50/60">
                        <td className={TD}>
                          <div className="flex items-center gap-2.5">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-8 w-8 rounded-lg object-cover border border-slate-200"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">{item.name}</div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {item.sku} {item.unit ? `• ${item.unit}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={TD}>
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {item.category || 'General'}
                          </span>
                        </td>
                        <td className={TD}>
                          <div className="text-xs font-medium text-slate-800">{item.storeName}</div>
                          <div className="text-[10px] text-slate-400">{item.location}</div>
                        </td>
                        <td className={`${TD} text-right font-medium text-slate-700`}>{item.stockCount}</td>
                        <td className={`${TD} text-right text-slate-500`}>
                          {item.reservedCount > 0 ? (
                            <span className="text-amber-700 font-medium">-{item.reservedCount}</span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className={`${TD} text-right font-bold text-slate-900`}>{item.atp}</td>
                        <td className={`${TD} text-right text-xs`}>₹{item.price}</td>
                        <td className={`${TD} text-right font-semibold text-emerald-800`}>
                          ₹{Math.round(item.valuation).toLocaleString('en-IN')}
                        </td>
                        <td className={TD}>
                          {item.status === 'in_stock' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              In Stock
                            </span>
                          ) : item.status === 'low_stock' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              Out of Stock
                            </span>
                          )}
                        </td>
                        <td className={`${TD} text-center`}>
                          <button
                            onClick={() => openAdjustForProduct(item)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-700"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Batch & Expiry Tracking */}
      {currentTab === 'batches' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Active Batches</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{batchStats?.totalBatches ?? 0}</div>
              <div className="text-[11px] text-slate-500">Currently in dark store bins</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Expiring in &lt; 7 Days</div>
              <div className="mt-1 text-xl font-bold text-amber-700">{batchStats?.nearExpiryCount ?? 0}</div>
              <div className="text-[11px] text-amber-600 font-medium">Prioritize FIFO dispatch</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Expired Batches</div>
              <div className="mt-1 text-xl font-bold text-rose-700">{batchStats?.expiredCount ?? 0}</div>
              <div className="text-[11px] text-rose-600 font-medium">Remove from shelf immediate</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Quarantined</div>
              <div className="mt-1 text-xl font-bold text-slate-700">{batchStats?.quarantinedCount ?? 0}</div>
              <div className="text-[11px] text-slate-500">Held for quality audit</div>
            </div>
          </div>

          {/* Batches Table */}
          <div className={`${PANEL} overflow-hidden`}>
            <div className={PANEL_HEAD}>Live Batch Ledger with Shelf-Life Remaining</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className={TH}>Batch Number</th>
                    <th className={TH}>Product Name</th>
                    <th className={TH}>Store / Facility</th>
                    <th className={`${TH} text-right`}>Initial Qty</th>
                    <th className={`${TH} text-right`}>Remaining Qty</th>
                    <th className={TH}>Inward Date</th>
                    <th className={TH}>Expiry Date</th>
                    <th className={TH}>Shelf Life Status</th>
                    <th className={`${TH} text-center`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(batchList || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                        {loading ? 'Loading batch tracking records...' : 'No batches found.'}
                      </td>
                    </tr>
                  ) : (
                    (batchList || []).map((batch, idx) => {
                      const daysLeft = batch.daysToExpiry;
                      const isExpired = batch.status === 'expired';
                      const isNearExpiry = batch.status === 'near_expiry';
                      const isQuarantined = batch.status === 'quarantined';

                      return (
                        <tr key={batch.id || `${batch.batchNumber}-${idx}`} className="transition hover:bg-slate-50/60">
                          <td className={TD}>
                            <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                              {batch.batchNumber}
                            </span>
                          </td>
                          <td className={TD}>
                            <div className="font-medium text-slate-900">{batch.productName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{batch.sku}</div>
                          </td>
                          <td className={TD}>
                            <div className="text-xs text-slate-800">{batch.storeName}</div>
                          </td>
                          <td className={`${TD} text-right text-slate-600`}>{batch.initialQty}</td>
                          <td className={`${TD} text-right font-bold text-slate-900`}>{batch.currentQty}</td>
                          <td className={TD}>
                            <span className="text-xs text-slate-600">
                              {batch.mfgDate ? new Date(batch.mfgDate).toLocaleDateString('en-IN') : 'N/A'}
                            </span>
                          </td>
                          <td className={TD}>
                            <span className="text-xs font-semibold text-slate-800">
                              {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('en-IN') : 'N/A'}
                            </span>
                          </td>
                          <td className={TD}>
                            {isQuarantined ? (
                              <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-800">
                                Quarantined
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                                Expired ({Math.abs(daysLeft)}d ago)
                              </span>
                            ) : isNearExpiry ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                                {daysLeft} Days Left
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                                Fresh ({daysLeft}d left)
                              </span>
                            )}
                          </td>
                          <td className={`${TD} text-center`}>
                            {isQuarantined ? (
                              <span className="text-[11px] italic text-slate-400">Locked</span>
                            ) : (
                              <button
                                onClick={() => setQuarantineModal({ open: true, batch, reason: 'Suspected quality issue' })}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                Quarantine
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Low-Stock Alerts */}
      {currentTab === 'alerts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Critical Shortfalls</div>
              <div className="mt-1 text-xl font-bold text-rose-700">{alertStats?.criticalCount ?? 0}</div>
              <div className="text-[11px] text-rose-600 font-medium">Zero stock — high sales loss risk</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Urgent Reorder Required</div>
              <div className="mt-1 text-xl font-bold text-amber-700">{alertStats?.urgentCount ?? 0}</div>
              <div className="text-[11px] text-slate-500">Stock &lt; 25% threshold</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Total Deficit Units</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {(alertStats?.totalDeficitUnits ?? 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500">Units needed for safe buffer</div>
            </div>
          </div>

          {/* Alerts Table */}
          <div className={`${PANEL} overflow-hidden`}>
            <div className={PANEL_HEAD}>Reorder Shortfall Matrix & Replenishment Actions</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className={TH}>Severity</th>
                    <th className={TH}>Product & SKU</th>
                    <th className={TH}>Store / Dark Store</th>
                    <th className={`${TH} text-right`}>Current Stock</th>
                    <th className={`${TH} text-right`}>Threshold (ROP)</th>
                    <th className={`${TH} text-right font-bold text-rose-700`}>Deficit</th>
                    <th className={`${TH} text-right`}>Target Safe Stock</th>
                    <th className={`${TH} text-right`}>Est. PO Cost</th>
                    <th className={`${TH} text-center`}>Immediate Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(alertList || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                        {loading ? 'Scanning inventory for replenishment triggers...' : 'All inventory levels are optimal! Zero low-stock alerts.'}
                      </td>
                    </tr>
                  ) : (
                    (alertList || []).map((alert, idx) => (
                      <tr key={alert.id || `${alert.sku}-${alert.storeId || idx}`} className="transition hover:bg-slate-50/60">
                        <td className={TD}>
                          {alert.severity === 'critical' ? (
                            <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-800">
                              Critical
                            </span>
                          ) : alert.severity === 'urgent' ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                              Urgent
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                              Warning
                            </span>
                          )}
                        </td>
                        <td className={TD}>
                          <div className="font-semibold text-slate-900">{alert.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{alert.sku}</div>
                        </td>
                        <td className={TD}>
                          <div className="text-xs font-medium text-slate-800">{alert.storeName}</div>
                          <div className="text-[10px] text-slate-400">{alert.location}</div>
                        </td>
                        <td className={`${TD} text-right font-bold text-slate-800`}>{alert.currentStock}</td>
                        <td className={`${TD} text-right text-slate-500`}>{alert.threshold}</td>
                        <td className={`${TD} text-right font-bold text-rose-700`}>-{alert.deficitQty}</td>
                        <td className={`${TD} text-right font-bold text-emerald-800`}>{alert.targetSafeStock}</td>
                        <td className={`${TD} text-right font-medium text-slate-800`}>
                          ₹{Math.round(alert.reorderEstimateCost).toLocaleString('en-IN')}
                        </td>
                        <td className={`${TD} text-center`}>
                          <button
                            onClick={() => openGrnForReplenish(alert)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800"
                          >
                            <span>1-Click GRN</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Purchase & GRN Handling */}
      {currentTab === 'grn' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 flex-1">
              <div className={`${PANEL} p-3`}>
                <div className="text-[11px] font-semibold uppercase text-slate-500">Total GRNs</div>
                <div className="mt-0.5 text-lg font-bold text-slate-900">{grnStats?.totalGrns ?? 0}</div>
              </div>
              <div className={`${PANEL} p-3`}>
                <div className="text-[11px] font-semibold uppercase text-slate-500">Inwarded Units</div>
                <div className="mt-0.5 text-lg font-bold text-emerald-700">
                  {(grnStats?.totalItemsReceived ?? 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className={`${PANEL} p-3`}>
                <div className="text-[11px] font-semibold uppercase text-slate-500">Total Inward Value</div>
                <div className="mt-0.5 text-lg font-bold text-slate-900">
                  ₹{Math.round(grnStats?.totalInwardValue ?? 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const first = stockList[0] || catalogProducts[0] || {};
                setNewGrn({
                  storeId: stores[0]?.id || '',
                  supplierName: vendors[0]?.name || 'Sahyadri Farmers Network',
                  supplierType: 'vendor',
                  poNumber: `PO-${Date.now().toString().slice(-6)}`,
                  invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
                  notes: 'Direct physical delivery from vendor partner',
                  items: [
                    {
                      sku: first.sku || 'SKU-001',
                      name: first.name || 'Alibag White Onion',
                      category: first.category || 'Vegetables',
                      unit: first.unit || 'kg',
                      orderedQty: 50,
                      receivedQty: 50,
                      rejectedQty: 0,
                      acceptedQty: 50,
                      unitCost: 40,
                      batchNumber: `BAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                      expiryDays: 25,
                    },
                  ],
                });
                setGrnModalOpen(true);
              }}
              className={`${BTN_PRIMARY} gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap`}
            >
              <Plus className="h-4 w-4" />
              <span>Receive Inbound (New GRN)</span>
            </button>
          </div>

          {/* GRN List Table */}
          <div className={`${PANEL} overflow-hidden`}>
            <div className={PANEL_HEAD}>Goods Receipt Notes (GRN) Inward History</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className={TH}>GRN Number</th>
                    <th className={TH}>PO Reference</th>
                    <th className={TH}>Supplier & Dark Store</th>
                    <th className={TH}>Inward Date</th>
                    <th className={`${TH} text-center`}>Line Items</th>
                    <th className={`${TH} text-right`}>Accepted Qty</th>
                    <th className={`${TH} text-right`}>Rejected Qty</th>
                    <th className={`${TH} text-right`}>Total Net Value</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(grnList || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                        {loading ? 'Fetching GRN records...' : 'No Goods Receipt Notes created yet.'}
                      </td>
                    </tr>
                  ) : (
                    (grnList || []).map((grn, idx) => (
                      <tr key={grn.id || `${grn.grnNumber}-${idx}`} className="transition hover:bg-slate-50/60">
                        <td className={TD}>
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                            {grn.grnNumber}
                          </span>
                        </td>
                        <td className={TD}>
                          <div className="font-mono text-xs text-slate-800">{grn.poNumber || 'DIRECT'}</div>
                          <div className="text-[10px] text-slate-400">Inv: {grn.invoiceNumber || 'N/A'}</div>
                        </td>
                        <td className={TD}>
                          <div className="text-xs font-semibold text-slate-900">{grn.supplierName}</div>
                          <div className="text-[11px] text-slate-500">Hub: {grn.storeName}</div>
                        </td>
                        <td className={TD}>
                          <span className="text-xs text-slate-700">
                            {grn.createdAt ? new Date(grn.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                          </span>
                        </td>
                        <td className={`${TD} text-center`}>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                            {grn.itemsCount || grn.items?.length || 0} items
                          </span>
                        </td>
                        <td className={`${TD} text-right font-bold text-emerald-800`}>
                          {grn.totalAcceptedQty} units
                        </td>
                        <td className={`${TD} text-right font-medium ${grn.totalRejectedQty > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                          {grn.totalRejectedQty}
                        </td>
                        <td className={`${TD} text-right font-bold text-slate-900`}>
                          ₹{Math.round(grn.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className={TD}>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                            {grn.status || 'Verified'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Dead-Stock Reports */}
      {currentTab === 'dead-stock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Non-Moving SKUs</div>
              <div className="mt-1 text-xl font-bold text-rose-700">{deadStockStats?.deadStockCount ?? 0}</div>
              <div className="text-[11px] text-slate-500">&gt; 30 days zero velocity</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Tied-Up Working Capital</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                ₹{Math.round(deadStockStats?.capitalTiedUp ?? 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500">Locked inventory value</div>
            </div>

            <div className={`${PANEL} p-3.5`}>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Critical Stagnant Items</div>
              <div className="mt-1 text-xl font-bold text-amber-700">{deadStockStats?.criticalStagnantCount ?? 0} SKUs</div>
              <div className="text-[11px] text-slate-500">&gt; 60 days idle in bin</div>
            </div>
          </div>

          {/* Dead Stock Table */}
          <div className={`${PANEL} overflow-hidden`}>
            <div className={PANEL_HEAD}>Zero-Velocity Aging & Clearance Recommendation</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className={TH}>Product & Category</th>
                    <th className={TH}>Store / Hub</th>
                    <th className={`${TH} text-right`}>Unsold Units</th>
                    <th className={TH}>Last Movement</th>
                    <th className={`${TH} text-right`}>Inactive Days</th>
                    <th className={`${TH} text-right`}>Capital Locked</th>
                    <th className={TH}>Recommended Strategy</th>
                    <th className={`${TH} text-center`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(deadStockList || []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                        {loading ? 'Analyzing inventory movement cycles...' : 'No dead stock detected! Catalog velocity is high.'}
                      </td>
                    </tr>
                  ) : (
                    (deadStockList || []).map((item, idx) => (
                      <tr key={item.id || `${item.sku}-${item.storeId || idx}`} className="transition hover:bg-slate-50/60">
                        <td className={TD}>
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.sku} • {item.category}
                          </div>
                        </td>
                        <td className={TD}>
                          <div className="text-xs text-slate-800">{item.storeName}</div>
                        </td>
                        <td className={`${TD} text-right font-bold text-slate-900`}>{item.stockCount}</td>
                        <td className={TD}>
                          <span className="text-xs text-slate-600">
                            {item.lastMovementDate ? new Date(item.lastMovementDate).toLocaleDateString('en-IN') : 'Never sold'}
                          </span>
                        </td>
                        <td className={`${TD} text-right font-bold text-rose-700`}>
                          {item.daysWithoutSale || item.idleDays || 30} days
                        </td>
                        <td className={`${TD} text-right font-bold text-slate-900`}>
                          ₹{Math.round(item.valuation).toLocaleString('en-IN')}
                        </td>
                        <td className={TD}>
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                            {item.recommendation || 'Clearance Discount 35%'}
                          </span>
                        </td>
                        <td className={`${TD} text-center`}>
                          <button
                            onClick={() => openAdjustForProduct(item)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Salvage / Adjust
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Stock Adjustment Logs */}
      {currentTab === 'adjustments' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 flex-1">
              <div className={`${PANEL} p-3`}>
                <div className="text-[11px] font-semibold uppercase text-slate-500">Audit Logs Count</div>
                <div className="mt-0.5 text-lg font-bold text-slate-900">{adjustStats?.totalLogs ?? 0}</div>
              </div>
              <div className={`${PANEL} p-3`}>
                <div className="text-[11px] font-semibold uppercase text-slate-500">Net Quantity Adjusted</div>
                <div className="mt-0.5 text-lg font-bold text-slate-800">
                  {adjustStats?.netQtyAdjusted > 0 ? `+${adjustStats.netQtyAdjusted}` : adjustStats?.netQtyAdjusted ?? 0} units
                </div>
              </div>
              <div className={`${PANEL} p-3`}>
                <div className="text-[11px] font-semibold uppercase text-slate-500">Net Cost Impact</div>
                <div className="mt-0.5 text-lg font-bold text-slate-900">
                  ₹{Math.round(adjustStats?.netFinancialImpact ?? 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const first = stockList[0] || {};
                setNewAdjustment({
                  storeId: stores[0]?.id || '',
                  sku: first.sku || '',
                  productName: first.name || '',
                  adjustedQty: 0,
                  unitCost: first.costPrice || first.price || 50,
                  reason: 'cycle_count',
                  notes: 'Cycle count physical audit',
                });
                setAdjustModalOpen(true);
              }}
              className={`${BTN_PRIMARY} gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap`}
            >
              <Plus className="h-4 w-4" />
              <span>Record Stock Adjustment</span>
            </button>
          </div>

          {/* Adjustments Table */}
          <div className={`${PANEL} overflow-hidden`}>
            <div className={PANEL_HEAD}>Tamper-Proof Stock Adjustment Audit Trail</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className={TH}>Timestamp</th>
                    <th className={TH}>Product & Store</th>
                    <th className={TH}>Reason Category</th>
                    <th className={`${TH} text-right`}>Prev Stock</th>
                    <th className={`${TH} text-right`}>Change</th>
                    <th className={`${TH} text-right`}>New Stock</th>
                    <th className={`${TH} text-right`}>Value Impact</th>
                    <th className={TH}>Audit Notes</th>
                    <th className={TH}>Adjusted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(adjustList || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                        {loading ? 'Retrieving stock adjustment history...' : 'No stock adjustments logged yet.'}
                      </td>
                    </tr>
                  ) : (
                    (adjustList || []).map((log, idx) => {
                      const isPositive = log.adjustedQty > 0;
                      return (
                        <tr key={log.id || log._id || `${log.adjustmentNumber}-${idx}`} className="transition hover:bg-slate-50/60">
                          <td className={TD}>
                            <div className="text-xs font-medium text-slate-800">
                              {log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </td>
                          <td className={TD}>
                            <div className="font-semibold text-slate-900">{log.productName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {log.sku} • {log.storeName}
                            </div>
                          </td>
                          <td className={TD}>
                            <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800">
                              {log.reason?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className={`${TD} text-right text-slate-600`}>{log.prevStock}</td>
                          <td className={`${TD} text-right font-bold ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isPositive ? `+${log.adjustedQty}` : log.adjustedQty}
                          </td>
                          <td className={`${TD} text-right font-bold text-slate-900`}>{log.newStock}</td>
                          <td className={`${TD} text-right font-semibold text-slate-800`}>
                            ₹{Math.round(log.financialImpact || 0).toLocaleString('en-IN')}
                          </td>
                          <td className={TD}>
                            <span className="text-xs text-slate-600 max-w-xs truncate block" title={log.notes}>
                              {log.notes || 'Routine correction'}
                            </span>
                          </td>
                          <td className={TD}>
                            <span className="text-xs font-medium text-slate-700">{log.adjustedBy || 'Admin'}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Record Stock Adjustment */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Stock Adjustment</h3>
                <p className="text-xs text-slate-500">Atomic inventory update with complete audit trail</p>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Dark Store / Hub *</label>
                <select
                  value={newAdjustment.storeId}
                  onChange={(e) => setNewAdjustment({ ...newAdjustment, storeId: e.target.value })}
                  className={INPUT}
                  required
                >
                  <option value="">Select Dark Store</option>
                  {(stores || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.zone || s.city || 'Hub'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Product *</label>
                {newAdjustment.productName ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
                    {newAdjustment.productName} ({newAdjustment.sku})
                    {newAdjustment.currentStock !== undefined && (
                      <span className="ml-2 font-normal text-slate-500">(Current: {newAdjustment.currentStock} units)</span>
                    )}
                  </div>
                ) : (
                  <select
                    value={newAdjustment.sku}
                    onChange={(e) => {
                      const sel = stockList.find((it) => it.sku === e.target.value) || catalogProducts.find((p) => p.sku === e.target.value);
                      setNewAdjustment({
                        ...newAdjustment,
                        sku: e.target.value,
                        productName: sel?.name || '',
                        unitCost: sel?.costPrice || sel?.price || 50,
                      });
                    }}
                    className={INPUT}
                    required
                  >
                    <option value="">Select Product</option>
                    {(stockList || []).map((it, idx) => (
                      <option key={it.id || `${it.sku}-${it.storeId || idx}`} value={it.sku}>
                        {it.name} ({it.sku}){it.storeName ? ` • ${it.storeName}` : ''} - Current: {it.stockCount}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Adjustment Reason Category *</label>
                <select
                  value={newAdjustment.reason}
                  onChange={(e) => setNewAdjustment({ ...newAdjustment, reason: e.target.value })}
                  className={INPUT}
                  required
                >
                  <option value="cycle_count">Physical Count / Reconciliation (Cycle Count)</option>
                  <option value="damage">Damaged / Produce Spoilage (Write-off)</option>
                  <option value="shrinkage">Shrinkage / Theft / Unaccounted Loss</option>
                  <option value="expired">Expired Shelf Life Removal</option>
                  <option value="customer_return">Customer Return Restocked</option>
                  <option value="internal_transfer">Internal Hub Transfer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Quantity Adjustment *
                    <span className="block text-[10px] font-normal text-slate-400">Use negative (-5) for write-off</span>
                  </label>
                  <input
                    type="number"
                    value={newAdjustment.adjustedQty}
                    onChange={(e) => setNewAdjustment({ ...newAdjustment, adjustedQty: e.target.value })}
                    className={INPUT}
                    placeholder="-5 or +10"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Unit Cost (₹)</label>
                  <input
                    type="number"
                    value={newAdjustment.unitCost}
                    onChange={(e) => setNewAdjustment({ ...newAdjustment, unitCost: e.target.value })}
                    className={INPUT}
                    placeholder="50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Audit Notes / Explanation *</label>
                <textarea
                  rows={2}
                  value={newAdjustment.notes}
                  onChange={(e) => setNewAdjustment({ ...newAdjustment, notes: e.target.value })}
                  placeholder="e.g., Physical cycle count in rack B-12 showed difference."
                  className={INPUT}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setAdjustModalOpen(false)} className={BTN}>
                  Cancel
                </button>
                <button type="submit" className={BTN_PRIMARY}>
                  Confirm & Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Receive Goods Receipt Note (GRN) */}
      {grnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Goods Receipt Note (GRN) Receiving</h3>
                <p className="text-xs text-slate-500">Inward incoming shipments directly into live dark store stock</p>
              </div>
              <button
                onClick={() => setGrnModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrn} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Destination Dark Store *</label>
                  <select
                    value={newGrn.storeId}
                    onChange={(e) => setNewGrn({ ...newGrn, storeId: e.target.value })}
                    className={INPUT}
                    required
                  >
                    <option value="">Select Destination Store</option>
                    {(stores || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.zone || s.city || 'Hub'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Supplier Name *</label>
                  <input
                    type="text"
                    value={newGrn.supplierName}
                    onChange={(e) => setNewGrn({ ...newGrn, supplierName: e.target.value })}
                    placeholder="e.g. Fresh Valley Farms Pune"
                    className={INPUT}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Purchase Order (PO) Ref</label>
                  <input
                    type="text"
                    value={newGrn.poNumber}
                    onChange={(e) => setNewGrn({ ...newGrn, poNumber: e.target.value })}
                    placeholder="PO-202610-001"
                    className={INPUT}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Vendor Invoice / Challan #</label>
                  <input
                    type="text"
                    value={newGrn.invoiceNumber}
                    onChange={(e) => setNewGrn({ ...newGrn, invoiceNumber: e.target.value })}
                    placeholder="INV-9921"
                    className={INPUT}
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800">Inward Line Items & Verification</span>
                  <button
                    type="button"
                    onClick={addGrnLineItem}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="p-3 space-y-3">
                  {(newGrn.items || []).map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 p-3 bg-white space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <label className="block text-[11px] font-semibold text-slate-600">Product *</label>
                          {item.name && item.sku ? (
                            <div className="text-xs font-bold text-slate-800">{item.name} ({item.sku})</div>
                          ) : (
                            <select
                              value={item.sku}
                              onChange={(e) => {
                                const prod = stockList.find((p) => p.sku === e.target.value) || catalogProducts.find((p) => p.sku === e.target.value);
                                updateGrnItem(idx, 'sku', e.target.value);
                                if (prod) {
                                  updateGrnItem(idx, 'name', prod.name);
                                  updateGrnItem(idx, 'category', prod.category || 'General');
                                  updateGrnItem(idx, 'unit', prod.unit || 'kg');
                                  updateGrnItem(idx, 'unitCost', prod.costPrice || 45);
                                }
                              }}
                              className={INPUT}
                              required
                            >
                              <option value="">Select product to inward</option>
                              {(stockList || []).map((it, idx) => (
                                <option key={it.id || `${it.sku}-${it.storeId || idx}`} value={it.sku}>
                                  {it.name} ({it.sku}){it.storeName ? ` • ${it.storeName}` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {newGrn.items?.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeGrnItem(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500">Ordered Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.orderedQty}
                            onChange={(e) => updateGrnItem(idx, 'orderedQty', e.target.value)}
                            className={INPUT}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500">Received Qty</label>
                          <input
                            type="number"
                            min="0"
                            value={item.receivedQty}
                            onChange={(e) => updateGrnItem(idx, 'receivedQty', e.target.value)}
                            className={INPUT}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500">Rejected (QC)</label>
                          <input
                            type="number"
                            min="0"
                            value={item.rejectedQty}
                            onChange={(e) => updateGrnItem(idx, 'rejectedQty', e.target.value)}
                            className={INPUT}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-800">Accepted Qty</label>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                            {item.acceptedQty} units
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500">Unit Cost (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={item.unitCost}
                            onChange={(e) => updateGrnItem(idx, 'unitCost', e.target.value)}
                            className={INPUT}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500">Assigned Batch #</label>
                          <input
                            type="text"
                            value={item.batchNumber}
                            onChange={(e) => updateGrnItem(idx, 'batchNumber', e.target.value)}
                            className={INPUT}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500">Shelf-Life (Days from today)</label>
                          <input
                            type="number"
                            min="1"
                            value={item.expiryDays}
                            onChange={(e) => updateGrnItem(idx, 'expiryDays', e.target.value)}
                            className={INPUT}
                            placeholder="25"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Remarks / Receiving Notes</label>
                <textarea
                  rows={2}
                  value={newGrn.notes}
                  onChange={(e) => setNewGrn({ ...newGrn, notes: e.target.value })}
                  className={INPUT}
                  placeholder="Produce temperature checked, truck seal verified intact."
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="text-xs text-slate-500">
                  Total GRN Inward Value:{' '}
                  <span className="font-bold text-slate-900">
                    ₹
                    {(newGrn.items || [])
                      .reduce((acc, it) => acc + (Number(it.acceptedQty) || 0) * (Number(it.unitCost) || 0), 0)
                      .toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setGrnModalOpen(false)} className={BTN}>
                    Cancel
                  </button>
                  <button type="submit" className={BTN_PRIMARY}>
                    Confirm & Inward Goods
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Quarantine Batch Confirmation */}
      {quarantineModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Quarantine Batch</h3>
                <p className="text-xs text-slate-500">Immediately freeze batch from order fulfillment</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div>
                <span className="font-semibold text-slate-600">Batch Number:</span>{' '}
                <span className="font-mono font-bold text-slate-900">{quarantineModal.batch?.batchNumber}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Product:</span>{' '}
                <span className="font-medium text-slate-800">{quarantineModal.batch?.productName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Remaining Units:</span>{' '}
                <span className="font-bold text-rose-700">{quarantineModal.batch?.currentQty} units</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Quarantine Reason *</label>
              <textarea
                rows={2}
                value={quarantineModal.reason}
                onChange={(e) => setQuarantineModal({ ...quarantineModal, reason: e.target.value })}
                className={INPUT}
                placeholder="e.g. Visual quality degradation, packaging seal tear, customer complaint."
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setQuarantineModal({ open: false, batch: null, reason: '' })}
                className={BTN}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuarantineConfirm}
                className="rounded-xl border border-rose-700 bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-800"
              >
                Confirm Quarantine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
