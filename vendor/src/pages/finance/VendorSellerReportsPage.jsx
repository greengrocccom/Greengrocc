import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  IndianRupee,
  Package,
  Boxes,
  CalendarClock,
  AlertTriangle,
  Search,
  RefreshCw,
  Download,
  Layers,
  ExternalLink,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  TrendingUp,
  X,
  PlusCircle,
  History,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";

const rupee = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const SECTION_BADGES = {
  preorder: { label: "Pre-order", tone: "bg-purple-50 text-purple-700 border-purple-200", icon: "📦" },
  ready2cook: { label: "Ready2Cook", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: "🍳" },
  instantorder: { label: "Instant Order", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "⚡" },
};

function getSectionMeta(sectionKey) {
  const key = String(sectionKey || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key.includes("preorder") || key.includes("pre-order")) return SECTION_BADGES.preorder;
  if (key.includes("ready") || key.includes("cook")) return SECTION_BADGES.ready2cook;
  if (key.includes("instant")) return SECTION_BADGES.instantorder;
  return { label: sectionKey || "General", tone: "bg-slate-50 text-slate-700 border-slate-200", icon: "🏷️" };
}

function ProductThumb({ src, name }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover shadow-2xs"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
      {String(name || "P").charAt(0).toUpperCase()}
    </div>
  );
}

/* Batch Detail Modal */
function BatchDetailModal({ product, onClose }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await vendorApi.getStockBatches({ productId: product.productId });
        if (active) {
          setBatches(res.data?.batches || []);
        }
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.message || "Failed to load product batches");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [product.productId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50">
          <div className="flex items-center gap-3">
            <ProductThumb src={product.image} name={product.name} />
            <div>
              <h3 className="text-sm font-bold text-slate-900">{product.name}</h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {product.sku || product.productId} • Available:{" "}
                <strong className="text-slate-900">
                  {product.stock} {product.unit}
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-3">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-xs text-slate-500">Loading batch details...</p>
          ) : batches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">
              No batches found for this product.
            </div>
          ) : (
            <div className="space-y-2.5">
              {batches.map((b) => (
                <div
                  key={b.batchId}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {b.batchId}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          b.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : b.status === "Low Stock"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">खरेदी मूल्य (Valuation)</span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {rupee((Number(b.availableQuantity) || 0) * (Number(b.purchaseCost) || Number(product.purchaseCost) || 0))}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Received Qty</span>
                      <span className="font-semibold text-slate-700">
                        {b.quantity} {b.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Available Qty</span>
                      <span className="font-bold text-emerald-700">
                        {b.availableQuantity} {b.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Recv Date</span>
                      <span className="text-slate-600">
                        {b.receivedDate ? new Date(b.receivedDate).toLocaleDateString() : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Expiry</span>
                      <span className="text-slate-600">
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VendorSellerReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("valuation_desc");
  const [viewMode, setViewMode] = useState("products"); // 'products' (Stock Overview) | 'batches' (Stock Additions)
  const [batchModalProduct, setBatchModalProduct] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await vendorApi.getFinanceSellerReports({
        search,
        section: sectionFilter,
        status: statusFilter,
        sortBy,
        onlyAdded: "true",
      });
      if (res?.success) {
        setData(res);
      } else {
        setError(res?.message || "Failed to load seller stock report");
      }
    } catch (err) {
      console.error("Seller stock report error:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load seller stock report");
    } finally {
      setLoading(false);
    }
  }, [search, sectionFilter, statusFilter, sortBy]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const kpis = data?.kpis || {
    totalProcurementValuation: 0,
    totalStockUnits: 0,
    totalProducts: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalBatchesCount: 0,
    sectionCounts: { all: 0, preorder: 0, ready2cook: 0, instantorder: 0, other: 0 },
  };

  const products = data?.products || [];
  const batches = data?.batches || [];

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    let list = batches;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.batchId.toLowerCase().includes(q) ||
          b.productName.toLowerCase().includes(q) ||
          b.sku.toLowerCase().includes(q)
      );
    }
    if (sectionFilter && sectionFilter !== "all") {
      const targetSec = sectionFilter.toLowerCase().replace(/[^a-z0-9]/g, "");
      list = list.filter((b) => {
        const bSec = String(b.section || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (targetSec === "preorder") return bSec.includes("preorder") || bSec.includes("pre-order");
        if (targetSec === "ready2cook") return bSec.includes("ready") || bSec.includes("cook");
        if (targetSec === "instantorder") return bSec.includes("instant");
        return bSec === targetSec;
      });
    }
    return list;
  }, [batches, search, sectionFilter]);

  // CSV Export
  const handleExportCSV = () => {
    if (viewMode === "batches") {
      if (!filteredBatches.length) return;
      const headers = [
        "Batch ID",
        "Product Name",
        "SKU",
        "Stock Received Date",
        "Expiry Date",
        "Quantity Added",
        "Available Quantity",
        "Unit",
        "Procurement Valuation (INR)",
        "Batch Status",
      ];
      const rows = filteredBatches.map((b) => [
        `"${b.batchId}"`,
        `"${(b.productName || "").replace(/"/g, '""')}"`,
        `"${b.sku || ""}"`,
        `"${b.receivedDate ? new Date(b.receivedDate).toLocaleDateString() : ""}"`,
        `"${b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : ""}"`,
        b.quantity,
        b.availableQuantity,
        `"${b.unit}"`,
        b.totalPurchaseCost || 0,
        `"${b.status}"`,
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `vendor_stock_additions_batches_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (!products.length) return;
    const headers = [
      "Product Name",
      "SKU",
      "Category",
      "Subcategory",
      "Section",
      "Available Stock",
      "Unit",
      "Procurement Valuation (INR)",
      "Stock Status",
      "Batches Count",
      "Latest Batch ID",
      "Latest Batch Recv Date",
    ];

    const rows = products.map((p) => [
      `"${(p.name || "").replace(/"/g, '""')}"`,
      `"${p.sku || ""}"`,
      `"${p.category || ""}"`,
      `"${p.subcategory || ""}"`,
      `"${p.section || ""}"`,
      p.stock || 0,
      `"${p.unit || ""}"`,
      p.totalPurchaseValue || 0,
      `"${p.stockStatus || ""}"`,
      p.batchesCount || 0,
      `"${p.latestBatch?.batchId || ""}"`,
      `"${p.latestBatch?.receivedDate ? new Date(p.latestBatch.receivedDate).toLocaleDateString() : ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `vendor_seller_stock_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sectionTabs = [
    { key: "all", name: "All Sections / सर्व विभाग", count: kpis.sectionCounts?.all ?? kpis.totalProducts, icon: "📋" },
    { key: "preorder", name: "Pre-order", count: kpis.sectionCounts?.preorder ?? 0, icon: "📦" },
    { key: "ready2cook", name: "Ready2Cook", count: kpis.sectionCounts?.ready2cook ?? 0, icon: "🍳" },
    { key: "instantorder", name: "Instant Order", count: kpis.sectionCounts?.instantorder ?? 0, icon: "⚡" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>Vendor Finance / विक्रेता वित्त</span>
            <span>›</span>
            <span className="text-emerald-800 font-bold">Vendor Seller Report / विक्रेता खरेदी व स्टॉक अहवाल</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <span className="text-[#217346]">Vendor Seller Report</span>
            <span className="text-sm font-normal text-slate-500">/ विक्रेता खरेदी व साठा अहवाल</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            फक्त ॲड केलेल्या साठ्याचे खरेदी विवरण (Procurement Stock Valuation).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={viewMode === "batches" ? !filteredBatches.length : !products.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          <Link
            to="/vendor/inventory"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100/70 transition"
          >
            <Boxes className="h-3.5 w-3.5 text-emerald-700" />
            Stock Overview
          </Link>

          <Link
            to="/vendor/inventory/history"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            Audit Ledger
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* ── KPI Summary Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Total Stock Procurement Valuation */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 via-white to-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              खरेदी भांडवल मूल्य
            </span>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-800">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-950 font-mono tracking-tight">
            {rupee(kpis.totalProcurementValuation)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-700">
            <span>Total Procurement Value</span>
            <span className="font-semibold text-emerald-900 bg-emerald-100/60 px-1.5 py-0.5 rounded text-[10px]">
              Active Valuation
            </span>
          </div>
        </div>

        {/* 2. Total Available Stock Units */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              एकूण उपलब्ध साठा
            </span>
            <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {Number(kpis.totalStockUnits || 0).toLocaleString()} <span className="text-xs font-semibold text-slate-400">Units</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Total units across all added items</p>
        </div>

        {/* 3. Total Products with Stock Added */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              साठा ॲड केलेली उत्पादने
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {kpis.totalProducts} <span className="text-xs font-semibold text-slate-400">Products</span>
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="text-emerald-700 font-bold">{kpis.inStockCount} In Stock</span>
            <span>•</span>
            <span className="text-rose-600 font-bold">{kpis.outOfStockCount} Out</span>
          </div>
        </div>

        {/* 4. Active Batches Count */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              खरेदी बॅचेस नोंदी
            </span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-700">
              <CalendarClock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {kpis.totalBatchesCount} <span className="text-xs font-semibold text-slate-400">Batches</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Total batches created via Add Stock</p>
        </div>

        {/* 5. Low / Reorder Alerts */}
        <div
          className={`relative overflow-hidden rounded-2xl border p-5 shadow-xs ${
            kpis.lowStockCount > 0 || kpis.outOfStockCount > 0
              ? "border-amber-200 bg-amber-50/50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              साठा सूचना / Alerts
            </span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-amber-950 tracking-tight">
            {kpis.lowStockCount + kpis.outOfStockCount}{" "}
            <span className="text-xs font-semibold text-amber-800">Need Stock</span>
          </p>
          <p className="mt-1 text-[11px] text-amber-800">
            {kpis.lowStockCount} low stock, {kpis.outOfStockCount} depleted
          </p>
        </div>
      </div>

      {/* ── Section Filter Pills ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
          <Layers className="h-3.5 w-3.5 text-slate-400" /> Section / स्टोअर विभाग:
        </span>
        {sectionTabs.map((tab) => {
          const active = sectionFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSectionFilter(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                active
                  ? "border-[#217346] bg-[#217346] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search & Filter Controls Bar ──────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product name, SKU, category, batch ID..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition"
          />
        </div>

        {/* View Switcher & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("products")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === "products"
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📦 Stock Overview
            </button>
            <button
              type="button"
              onClick={() => setViewMode("batches")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === "batches"
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📋 Stock Additions ({batches.length})
            </button>
          </div>

          {/* Status Dropdown (only in products view) */}
          {viewMode === "products" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-600"
              >
                <option value="all">All Status (सर्व)</option>
                <option value="in_stock">In Stock (उपलब्ध साठा)</option>
                <option value="low_stock">Low Stock (कमी साठा)</option>
                <option value="out_of_stock">Out of Stock (साठा संपला)</option>
                <option value="alert">Alerts (Low + Out of Stock)</option>
              </select>
            </div>
          ) : null}

          {/* Sort Dropdown (only in products view) */}
          {viewMode === "products" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-600"
              >
                <option value="valuation_desc">Valuation: High to Low (जास्त खरेदी मूल्य)</option>
                <option value="valuation_asc">Valuation: Low to High (कमी खरेदी मूल्य)</option>
                <option value="stock_desc">Available Stock: High to Low (जास्त साठा)</option>
                <option value="stock_asc">Available Stock: Low to High (कमी साठा)</option>
                <option value="name">Product Name (A-Z)</option>
              </select>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Main Data Table ────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {viewMode === "products"
                ? "Stock Overview & Procurement Financials / खरेदी व साठा विवरण"
                : "Stock Additions & Batches / ॲड केलेल्या साठ्याची आवक नोंदी"}
            </h2>
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.2 text-[10px] font-bold">
              {viewMode === "products" ? `${products.length} Products` : `${filteredBatches.length} Batches`}
            </span>
          </div>

          <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            ✓ फक्त ॲड केलेला साठा दर्शविला आहे (Only Added Stock)
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-emerald-700" />
            <p className="mt-3 text-xs font-medium text-slate-600">Loading Vendor Seller Report...</p>
          </div>
        ) : viewMode === "products" ? (
          /* ================= VIEW 1: PRODUCTS STOCK OVERVIEW (NO PURCHASE RATE COLUMN - ONLY VALUATION) ================= */
          products.length === 0 ? (
            <div className="py-20 text-center">
              <Boxes className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">कोणताही ॲड केलेला साठा सापडला नाही</p>
              <p className="mt-1 text-xs text-slate-500">
                स्टॉक व्यवस्थापन (Stock Overview) मध्ये जाऊन उत्पादनाचा साठा ॲड करा.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[950px] table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[28%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50/90 text-[10px] font-bold uppercase text-slate-600">
                  <tr>
                    <th className="px-3.5 py-3 text-center">#</th>
                    <th className="px-3.5 py-3">Product & SKU / उत्पादन</th>
                    <th className="px-3.5 py-3">Category / वर्ग</th>
                    <th className="px-3.5 py-3 text-center">Section / विभाग</th>
                    <th className="px-3.5 py-3 text-center">Available Stock</th>
                    <th className="px-3.5 py-3 text-right">खरेदी मूल्य (Valuation)</th>
                    <th className="px-3.5 py-3 text-center">Batches / तपशील</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p, idx) => {
                    const secMeta = getSectionMeta(p.section);
                    const isLow = p.stockStatus === "Low Stock";
                    const isOut = p.stockStatus === "Out of Stock";

                    return (
                      <tr
                        key={p.productId}
                        className="hover:bg-slate-50/80 transition duration-150"
                      >
                        {/* Index */}
                        <td className="px-3.5 py-3.5 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Product & SKU */}
                        <td className="px-3.5 py-3.5">
                          <div className="flex items-center gap-3">
                            <ProductThumb src={p.image} name={p.name} />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate" title={p.name}>
                                {p.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  {p.sku || p.productId}
                                </span>
                                {p.brandName ? (
                                  <span className="text-[10px] text-slate-400 font-medium truncate max-w-[100px]">
                                    {p.brandName}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-3.5 py-3.5">
                          <p className="font-bold text-slate-800 truncate">{p.category || "General"}</p>
                          {p.subcategory ? (
                            <span className="text-[10px] text-slate-400 block truncate">{p.subcategory}</span>
                          ) : null}
                        </td>

                        {/* Section */}
                        <td className="px-3.5 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${secMeta.tone}`}
                          >
                            <span>{secMeta.icon}</span>
                            <span>{secMeta.label}</span>
                          </span>
                        </td>

                        {/* Available Stock & Status */}
                        <td className="px-3.5 py-3.5 text-center">
                          <div className="inline-block text-center">
                            <span
                              className={`text-sm font-extrabold ${
                                isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                              }`}
                            >
                              {p.stock}{" "}
                              <span className="text-[11px] font-medium text-slate-500">{p.unit}</span>
                            </span>
                            <span
                              className={`block text-[9px] font-bold uppercase mt-0.5 rounded px-1.5 py-0.2 ${
                                isOut
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : isLow
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {p.stockStatus}
                            </span>
                          </div>
                        </td>

                        {/* Total Procurement Value / खरेदी मूल्य (ONLY VALUATION) */}
                        <td className="px-3.5 py-3.5 text-right">
                          <div className="inline-block text-right">
                            <span className="text-sm font-black text-slate-900 font-mono">
                              {rupee(p.totalPurchaseValue)}
                            </span>
                            <span className="block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 mt-0.5">
                              खरेदी मूल्य
                            </span>
                          </div>
                        </td>

                        {/* Batches / Action Details */}
                        <td className="px-3.5 py-3.5 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setBatchModalProduct(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-300 transition cursor-pointer"
                              title="View all batches for this product"
                            >
                              <Eye className="h-3 w-3 text-slate-400" />
                              <span>{p.batchesCount || 0} Batches</span>
                            </button>
                            {p.latestBatch?.batchId ? (
                              <span className="font-mono text-[9px] text-slate-400 truncate max-w-[110px]" title={p.latestBatch.batchId}>
                                {p.latestBatch.batchId}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ================= VIEW 2: STOCK ADDITIONS & BATCHES (NO PURCHASE RATE - ONLY VALUATION) ================= */
          filteredBatches.length === 0 ? (
            <div className="py-20 text-center">
              <CalendarClock className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">कोणत्याही आवक बॅच नोंदी सापडल्या नाहीत</p>
              <p className="mt-1 text-xs text-slate-500">
                Add Stock द्वारे ॲड केलेल्या सर्व बॅचेसची नोंद येथे दिसेल.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[950px] table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[16%]" />
                  <col className="w-[26%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50/90 text-[10px] font-bold uppercase text-slate-600">
                  <tr>
                    <th className="px-3.5 py-3 text-center">#</th>
                    <th className="px-3.5 py-3">Batch ID / क्रमांक</th>
                    <th className="px-3.5 py-3">Product / उत्पादन</th>
                    <th className="px-3.5 py-3">Dates & Expiry / मुदत</th>
                    <th className="px-3.5 py-3 text-center">किती स्टॉक घेतला</th>
                    <th className="px-3.5 py-3 text-right">खरेदी मूल्य (Valuation)</th>
                    <th className="px-3.5 py-3 text-center">शिल्लक साठा & स्थिती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.map((b, idx) => (
                    <tr key={b.batchId} className="hover:bg-slate-50/80 transition duration-150">
                      {/* Index */}
                      <td className="px-3.5 py-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Batch ID */}
                      <td className="px-3.5 py-3.5 font-mono text-xs font-bold text-emerald-800">
                        {b.batchId}
                        <span className="block text-[9px] text-slate-400 font-sans mt-0.5">
                          {b.receivedDate ? new Date(b.receivedDate).toLocaleDateString() : ""}
                        </span>
                      </td>

                      {/* Product */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb src={b.image} name={b.productName} />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{b.productName}</p>
                            <span className="font-mono text-[10px] text-slate-400">{b.sku}</span>
                          </div>
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-3.5 py-3.5 text-[11px]">
                        <p className="text-slate-800 font-medium">
                          Recv: {b.receivedDate ? new Date(b.receivedDate).toLocaleDateString() : "-"}
                        </p>
                        {b.expiryDate ? (
                          <p className="text-rose-600 font-semibold text-[10px]">
                            Exp: {new Date(b.expiryDate).toLocaleDateString()}
                          </p>
                        ) : null}
                      </td>

                      {/* Quantity Added (किती स्टॉक घेतला) */}
                      <td className="px-3.5 py-3.5 text-center">
                        <span className="inline-block rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                          +{b.quantity} {b.unit}
                        </span>
                      </td>

                      {/* Total Purchase Cost / खरेदी मूल्य (ONLY VALUATION) */}
                      <td className="px-3.5 py-3.5 text-right">
                        <div className="inline-block text-right">
                          <span className="font-mono font-black text-slate-900 text-xs">
                            {rupee(b.totalPurchaseCost || (b.quantity * b.purchaseCost))}
                          </span>
                          <span className="block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 mt-0.5">
                            खरेदी मूल्य
                          </span>
                        </div>
                      </td>

                      {/* Available Qty & Status */}
                      <td className="px-3.5 py-3.5 text-center">
                        <p className="font-bold text-slate-800 text-xs">
                          {b.availableQuantity} {b.unit}
                        </p>
                        <span
                          className={`inline-block text-[9px] font-bold uppercase mt-0.5 rounded px-1.5 py-0.2 ${
                            b.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : b.status === "Low Stock"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Table Footer with Aggregate Valuation */}
        {!loading && (
          <div className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-600 font-medium">
              {viewMode === "products" ? (
                <>
                  Showing <strong>{products.length}</strong> products with stock added
                </>
              ) : (
                <>
                  Showing <strong>{filteredBatches.length}</strong> stock addition batches
                </>
              )}
            </span>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Active Valuation</span>
                <span className="text-base font-black text-emerald-900 font-mono">
                  {rupee(
                    viewMode === "products"
                      ? products.reduce((acc, p) => acc + (Number(p.totalPurchaseValue) || 0), 0)
                      : filteredBatches.reduce((acc, b) => acc + (Number(b.availableValuation) || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Product Batch Detail Modal ────────────────────────────── */}
      {batchModalProduct ? (
        <BatchDetailModal
          product={batchModalProduct}
          onClose={() => setBatchModalProduct(null)}
        />
      ) : null}
    </div>
  );
}
