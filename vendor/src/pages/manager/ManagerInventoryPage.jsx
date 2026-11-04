import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowRight,
  Bell,
  BellOff,
  BellRing,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  Layers,
  Loader2,
  Minus,
  MinusCircle,
  Package,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { listManagerQuality } from "../../api/managerPortApi";
import { vendorApi } from "../../api/vendorApi";
import { useVendorAuth } from "../../context/VendorAuthContext";
import CopyId, { CopyButton } from "../../components/ui/CopyId";
import EmptyState from "../../components/ui/EmptyState";
import InventoryAlertModal from "../../components/inventory/InventoryAlertModal";
import { formatProductBusinessId } from "../../utils/cropLinks";
import { EXCEL_PAGE_TITLE, EXCEL_PAGE_SUB, EXCEL_INPUT } from "../../utils/excelStyles";
import { CATALOG_SECTIONS, catalogSectionName, catalogSectionRank, groupBySection } from "../products/catalogSections";

/* =========================================================================
   COMMON STYLES & HELPERS
   ========================================================================= */
const TH =
  "border border-[#E5E7EB] bg-[#F3F4F6] px-1 py-1.5 text-left text-[9px] font-semibold text-[#374151] sm:px-3 sm:py-3 sm:text-[12px]";
const TD =
  "border border-[#E5E7EB] px-1 py-1.5 text-[9px] leading-tight text-[#1F2937] sm:px-3 sm:py-3 sm:text-[12px]";
const GRADE_TH =
  "border px-1 py-1.5 text-center text-[9px] font-semibold sm:px-3 sm:py-3 sm:text-[12px]";
const GRADE_TD = "border px-1 py-1.5 text-center sm:px-3 sm:py-3";

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function renderExpiryWithDays(expiryDate) {
  if (!expiryDate) return <span className="text-slate-400 font-normal">No Expiry</span>;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  if (Number.isNaN(exp.getTime())) return <span className="text-slate-700">{expiryDate}</span>;

  const diffDays = Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = formatShortDate(expiryDate);

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="font-bold text-rose-700">{dateStr}</span>
        <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-extrabold text-rose-800">
          Expired ({Math.abs(diffDays)}d ago)
        </span>
      </span>
    );
  }
  if (diffDays === 0) {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="font-bold text-amber-700">{dateStr}</span>
        <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-extrabold text-amber-800">
          Expires Today
        </span>
      </span>
    );
  }
  if (diffDays === 1) {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="font-bold text-amber-700">{dateStr}</span>
        <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 border border-amber-200">
          1 day left
        </span>
      </span>
    );
  }
  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="font-bold text-amber-700">{dateStr}</span>
        <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 border border-amber-200">
          {diffDays} days left
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <span className="font-bold text-emerald-700">{dateStr}</span>
      <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 border border-emerald-200">
        {diffDays} days left
      </span>
    </span>
  );
}

function ProductThumb({ src, name }) {
  if (src) {
    return <img src={src} alt={name} loading="lazy" className="h-9 w-9 shrink-0 rounded border border-gray-200 object-cover" />;
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#E8F5E9] text-xs font-bold text-[#217346]">
      {String(name || "P").charAt(0).toUpperCase()}
    </div>
  );
}

const SECTION_BADGES = {
  preorder: { label: "Pre-order", tone: "bg-purple-50 text-purple-700 border-purple-200", icon: "📦" },
  ready2cook: { label: "Ready2Cook", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: "🍳" },
  instantorder: { label: "Instant Order", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "⚡" },
};

function getSectionMeta(sectionKey) {
  const key = String(sectionKey || "").toLowerCase();
  if (SECTION_BADGES[key]) return SECTION_BADGES[key];
  const name = catalogSectionName(sectionKey) || sectionKey || "General";
  return { label: name, tone: "bg-slate-50 text-slate-700 border-slate-200", icon: "🏷️" };
}

/* =========================================================================
   SELLER STOCK EDIT MODAL
   ========================================================================= */
function SellerStockModal({ product, onClose, onSaved }) {
  const [stockVal, setStockVal] = useState(
    product.stock !== null && product.stock !== undefined ? String(product.stock) : "0"
  );
  const [costVal, setCostVal] = useState(
    product.purchaseCost !== null && product.purchaseCost !== undefined && Number(product.purchaseCost) > 0
      ? String(product.purchaseCost)
      : product.latestPurchaseCost
      ? String(product.latestPurchaseCost)
      : ""
  );
  const [inStock, setInStock] = useState(product.inStock !== false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const handleSave = async (e) => {
    e?.preventDefault();
    const cleanNum = stockVal === "" ? 0 : Number(stockVal);
    if (!Number.isFinite(cleanNum) || cleanNum < 0) {
      setModalError("Please enter a valid stock quantity (0 or greater).");
      return;
    }
    const cleanCost = costVal === "" ? null : Number(costVal);
    if (cleanCost !== null && (!Number.isFinite(cleanCost) || cleanCost < 0)) {
      setModalError("Please enter a valid purchase cost (0 or greater).");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      const payload = {
        stock: Math.floor(cleanNum),
        inStock: cleanNum > 0 ? inStock : false,
      };
      if (cleanCost !== null) {
        payload.purchaseCost = cleanCost;
      }
      const res = await vendorApi.updateMyProduct(product.productId, payload);
      onSaved(
        res.data || {
          ...product,
          stock: Math.floor(cleanNum),
          inStock: cleanNum > 0 ? inStock : false,
          purchaseCost: cleanCost ?? product.purchaseCost,
        }
      );
      onClose();
    } catch (err) {
      setModalError(err?.response?.data?.message || "Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  const adjustQty = (amount) => {
    const cur = Number(stockVal || 0);
    const next = Math.max(0, cur + amount);
    setStockVal(String(next));
    if (next > 0) setInStock(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <ProductThumb src={product.image} name={product.name} />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{product.name}</h3>
              <p className="font-mono text-[10px] text-emerald-700">{product.sku || product.productId}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {modalError ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">
            {modalError}
          </div>
        ) : null}

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Stock Quantity ({product.unit || "Units"}) *
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustQty(-1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-bold"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min="0"
                step="1"
                value={stockVal}
                onChange={(e) => {
                  setStockVal(e.target.value);
                  if (Number(e.target.value) > 0) setInStock(true);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                placeholder="0"
                required
              />
              <button
                type="button"
                onClick={() => adjustQty(1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-bold"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Increment Buttons */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400">Quick add:</span>
              {[5, 10, 25, 50, 100].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => adjustQty(step)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  +{step}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Purchase Cost / खरेदी दर (₹ / {product.unit || "Unit"})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costVal}
                onChange={(e) => setCostVal(e.target.value)}
                className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                placeholder="0.00"
              />
            </div>
            {Number(costVal) > 0 && Number(stockVal || 0) > 0 ? (
              <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                एकूण खरेदी मूल्य: ₹{(Number(costVal) * Number(stockVal || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">In-Stock Availability</p>
                <p className="text-[11px] text-slate-500">Show as available for orders on store</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={inStock}
                  onChange={(e) => setInStock(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-xs disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   SELLER ADD STOCK MODAL (WITH BATCH GENERATION & PACKAGING/EXPIRY TRACKING)
   ========================================================================= */
function formatBatchIdWithCount(receivedDateStr, count = 1) {
  let d = new Date();
  if (receivedDateStr) {
    const raw = String(receivedDateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const [y, m, day] = raw.slice(0, 10).split("-");
      d = new Date(Number(y), Number(m) - 1, Number(day));
    } else {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) d = parsed;
    }
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `GG-BAT-${yyyy}${mm}${dd}-${String(count).padStart(4, "0")}`;
}

function AddStockModal({ initialProduct = null, myProducts = [], onClose, onProductAdded }) {
  const [productList, setProductList] = useState(myProducts && myProducts.length > 0 ? myProducts : []);
  const [loadingProducts, setLoadingProducts] = useState(!initialProduct && (!myProducts || myProducts.length === 0));
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(initialProduct || null);

  // Batch Tracking Date state
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Live Batch ID based on Stock Received Date & Batch Count: GG-BAT-YYYYMMDD-0001
  const [batchIdVal, setBatchIdVal] = useState(() =>
    formatBatchIdWithCount(new Date().toISOString().slice(0, 10), 1)
  );

  // Fetch next sequential batch ID whenever receivedDate changes
  useEffect(() => {
    let active = true;
    const fetchNextId = async () => {
      try {
        const res = await vendorApi.getNextBatchId(receivedDate);
        if (active && res.data?.batchId) {
          setBatchIdVal(res.data.batchId);
          return;
        }
      } catch (_) {}
      if (active) {
        setBatchIdVal(formatBatchIdWithCount(receivedDate, 1));
      }
    };
    fetchNextId();
    return () => {
      active = false;
    };
  }, [receivedDate]);

  // Form Fields - Basic
  const [stockVal, setStockVal] = useState("50");
  const [productSectionFilter, setProductSectionFilter] = useState("");
  const [sectionVal, setSectionVal] = useState(initialProduct?.section || "preorder");
  const [unitVal, setUnitVal] = useState(initialProduct?.unit || "Kg");
  const [priceVal, setPriceVal] = useState(initialProduct?.price ? String(initialProduct.price) : "");
  const [discountedPriceVal, setDiscountedPriceVal] = useState(
    initialProduct?.discountedPrice ? String(initialProduct.discountedPrice) : initialProduct?.price ? String(initialProduct.price) : ""
  );
  const [inStock, setInStock] = useState(true);

  // Batch Tracking Fields
  const [mfgDate, setMfgDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [packagingType, setPackagingType] = useState("Box");
  const [numberOfPackages, setNumberOfPackages] = useState("1");
  const [packageSize, setPackageSize] = useState("");
  const [qualityGrade, setQualityGrade] = useState("Grade A");
  const [stockSource, setStockSource] = useState("Supplier");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [totalPurchaseCost, setTotalPurchaseCost] = useState("");
  const [storageLocation, setStorageLocation] = useState("Main Darkstore");

  const handlePurchaseCostChange = (val) => {
    setPurchaseCost(val);
    const num = Number(val);
    const qty = Number(stockVal || 0);
    if (val !== "" && Number.isFinite(num) && qty > 0) {
      setTotalPurchaseCost(String(Math.round(num * qty * 100) / 100));
    } else if (val === "") {
      setTotalPurchaseCost("");
    }
  };

  const handleTotalCostChange = (val) => {
    setTotalPurchaseCost(val);
    const num = Number(val);
    const qty = Number(stockVal || 0);
    if (val !== "" && Number.isFinite(num) && qty > 0) {
      setPurchaseCost(String(Math.round((num / qty) * 100) / 100));
    } else if (val === "") {
      setPurchaseCost("");
    }
  };
  const [remarks, setRemarks] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Load My Products only if not provided or empty
  useEffect(() => {
    if (initialProduct) return;
    if (myProducts && myProducts.length > 0) {
      setProductList(myProducts);
      setLoadingProducts(false);
      return;
    }
    let active = true;
    const fetchMyProducts = async () => {
      setLoadingProducts(true);
      setLoadError("");
      try {
        const res = await vendorApi.getMyProducts();
        if (active) {
          setProductList(res.data?.products || []);
        }
      } catch (err) {
        if (active) {
          setLoadError(err?.response?.data?.message || "Failed to load My Products");
        }
      } finally {
        if (active) setLoadingProducts(false);
      }
    };
    fetchMyProducts();
    return () => {
      active = false;
    };
  }, [initialProduct, myProducts]);

  const handleSelectProduct = (p) => {
    setSelectedProduct(p);
    setStockVal("10");
    setSectionVal(p.section || "preorder");
    setUnitVal(p.unit || "Kg");
    setPriceVal(String(p.price ?? ""));
    setDiscountedPriceVal(String(p.discountedPrice ?? p.price ?? ""));
    setInStock(true);
    setFormError("");
  };

  const adjustQty = (amount) => {
    const cur = Number(stockVal || 0);
    const next = Math.max(0, cur + amount);
    setStockVal(String(next));
    if (next > 0) setInStock(true);
    if (purchaseCost && next > 0) {
      setTotalPurchaseCost(String(Math.round(Number(purchaseCost) * next * 100) / 100));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedProduct) {
      setFormError("Please select a product first");
      return;
    }
    const cleanNum = stockVal === "" ? 0 : Number(stockVal);
    if (!Number.isFinite(cleanNum) || cleanNum <= 0) {
      setFormError("Please enter a valid stock quantity (greater than 0).");
      return;
    }

    if (mfgDate && expiryDate && new Date(expiryDate) <= new Date(mfgDate)) {
      setFormError("Expiry date must be after manufacturing / harvest date.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const res = await vendorApi.addStockProduct({
        productId: selectedProduct.productId,
        batchId: batchIdVal,
        quantity: Math.floor(cleanNum),
        stock: Math.floor(cleanNum),
        section: selectedProduct.section || sectionVal || "preorder",
        unit: unitVal,
        receivedDate,
        mfgDate: mfgDate || undefined,
        expiryDate: expiryDate || undefined,
        packagingType,
        numberOfPackages: Number(numberOfPackages) || 1,
        packageSize,
        qualityGrade,
        stockSource,
        purchaseCost: purchaseCost !== "" ? Number(purchaseCost) : 0,
        totalPurchaseCost: totalPurchaseCost !== "" ? Number(totalPurchaseCost) : (purchaseCost !== "" ? Number(purchaseCost) * cleanNum : 0),
        storageLocation,
        remarks,
        price: priceVal !== "" ? Number(priceVal) : undefined,
        discountedPrice: discountedPriceVal !== "" ? Number(discountedPriceVal) : undefined,
        inStock: cleanNum > 0 ? inStock : false,
      });
      onProductAdded(res.data?.product, res.data?.products, res.data?.batch, res.data?.transaction);
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to add stock");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productList.filter((p) => {
      if (productSectionFilter && (p.section || "preorder") !== productSectionFilter) {
        return false;
      }
      if (!q) return true;
      return [p.name, p.sku, p.productId, p.category, p.subcategory, p.brandName, p.varietyName].some((v) =>
        String(v || "").toLowerCase().includes(q)
      );
    });
  }, [productList, search, productSectionFilter]);

  const modalSectionCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = productList.filter((p) => {
      if (!q) return true;
      return [p.name, p.sku, p.productId, p.category, p.subcategory, p.brandName, p.varietyName].some((v) =>
        String(v || "").toLowerCase().includes(q)
      );
    });
    return searched.reduce((acc, p) => {
      const sec = p.section || "preorder";
      acc[sec] = (acc[sec] || 0) + 1;
      return acc;
    }, {});
  }, [productList, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-emerald-700" /> Add Stock & Batch / नवीन स्टॉक व बॅच नोंदणी
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-800 border border-emerald-300">
                {batchIdVal}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Generates a unique immutable batch with packaging, expiry, and traceability parameters
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}

          {/* STEP 1: Product Selection (if none selected) */}
          {!selectedProduct ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Step 1: Choose Product from My Products / माझ्या उत्पादनांमधून निवडा
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} available
                </span>
              </div>

              {/* Section Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "", label: "All Sections / सर्व", icon: "📑", count: productList.length },
                  { key: "preorder", label: "Pre-order", icon: "📦", count: modalSectionCounts["preorder"] || 0 },
                  { key: "ready2cook", label: "Ready2Cook", icon: "🍳", count: modalSectionCounts["ready2cook"] || 0 },
                  { key: "instantorder", label: "Instant Order", icon: "⚡", count: modalSectionCounts["instantorder"] || 0 },
                ].map((tab) => {
                  const active = productSectionFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setProductSectionFilter(tab.key)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-emerald-700 bg-emerald-700 text-white shadow-2xs"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
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

              {/* Search box */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search my products by name, SKU, category..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition"
                  autoFocus
                />
              </div>

              {/* Product List */}
              {loadingProducts ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
                  <p className="mt-2 text-xs font-medium text-slate-500">Loading your products...</p>
                </div>
              ) : loadError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                  {loadError}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">
                  {search ? (
                    `No products found matching "${search}" in My Products.`
                  ) : (
                    <div className="py-2">
                      <p className="font-bold text-slate-700">No products found in My Products yet.</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Please add products to your store from All Products catalog first.
                      </p>
                      <Link
                        to="/vendor/products"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Go to All Products
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-h-64 sm:max-h-80 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 p-1.5 bg-slate-50/30">
                  {filteredProducts.map((p) => {
                    const stockNum = Number(p.stock ?? 0);
                    return (
                      <div
                        key={p.productId}
                        onClick={() => handleSelectProduct(p)}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-2.5 hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer transition shadow-2xs group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ProductThumb src={p.image} name={p.name} />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-900 group-hover:text-emerald-800 truncate">
                              {p.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                              <span className="font-mono text-emerald-700 font-bold">{p.sku || p.productId}</span>
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-700">
                                {getSectionMeta(p.section).icon} {getSectionMeta(p.section).label}
                              </span>
                              {p.category ? <span>• {p.category}</span> : null}
                              {p.unit ? <span>• {p.unit}</span> : null}
                              <span>
                                • Current Stock: <strong className="text-slate-800">{stockNum} {p.unit || ""}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-xs text-slate-900">
                            {formatPrice(p.discountedPrice || p.price)}
                          </span>
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white group-hover:bg-emerald-800 transition"
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Stock & Batch configuration */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected Product Card */}
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProductThumb src={selectedProduct.image} name={selectedProduct.name} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{selectedProduct.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-600 flex-wrap">
                      <span className="font-mono text-emerald-700 font-bold">{selectedProduct.sku || selectedProduct.productId}</span>
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100/90 px-1.5 py-0.2 text-[9px] font-bold text-emerald-900 border border-emerald-300">
                        {getSectionMeta(selectedProduct.section || sectionVal).icon} {getSectionMeta(selectedProduct.section || sectionVal).label}
                      </span>
                      {selectedProduct.category ? <span>• {selectedProduct.category}</span> : null}
                      <span>• Current Stock: <strong className="text-slate-900">{selectedProduct.stock ?? 0} {selectedProduct.unit || unitVal}</strong></span>
                    </div>
                  </div>
                </div>
                {!initialProduct && (
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Assigned Batch ID Display */}
              <div className="rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-emerald-50 p-3.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-emerald-600" />
                      Assigned Batch ID / बॅच क्रमांक *
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-base font-extrabold text-emerald-950 tracking-wider bg-white border-2 border-emerald-400 px-3 py-1 rounded-lg shadow-xs select-all">
                        {batchIdVal}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await vendorApi.getNextBatchId(receivedDate);
                            if (res.data?.batchId) {
                              setBatchIdVal(res.data.batchId);
                              return;
                            }
                          } catch (_) {}
                          setBatchIdVal(formatBatchIdWithCount(receivedDate, 1));
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100/70 transition shadow-2xs"
                        title="Refresh Batch ID for selected received date"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Sync ID
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 max-w-xs">
                    <p className="font-bold text-emerald-900 font-mono">
                      Format: GG-BAT-[ReceivedDate]-[BatchCount]
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Auto-generated from Stock Received Date ({receivedDate.replace(/-/g, "")}) + sequential batch count (0001, 0002...).
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. Stock Quantity & Purchase Cost (किती घेतला आणि कितीला घेतला) */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    1. Stock Quantity & Purchase Price / स्टॉक प्रमाण व खरेदी किंमत *
                  </label>
                  <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Creates New Batch
                  </span>
                </div>

                {/* A. Quantity & Unit (किती स्टॉक घेतला) */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                    A. किती स्टॉक घेतला (Quantity & Unit) *
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustQty(-1)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={stockVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStockVal(val);
                          if (Number(val) > 0) setInStock(true);
                          if (purchaseCost && Number(val) > 0) {
                            setTotalPurchaseCost(String(Math.round(Number(purchaseCost) * Number(val) * 100) / 100));
                          }
                        }}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-center text-lg font-extrabold text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        placeholder="0"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => adjustQty(1)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div>
                      <select
                        value={unitVal}
                        onChange={(e) => setUnitVal(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                      >
                        {["Kg", "Gram", "Pieces", "Litres", "Boxes", "Bags", "Packet", "Bunch", "Dozen"].map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Stock Addition Breakdown */}
                  {selectedProduct ? (
                    <div className="mt-2 rounded-lg bg-emerald-50/70 p-2.5 border border-emerald-200 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <span className="text-slate-600">
                          Current Stock: <strong className="text-slate-800">{selectedProduct.stock ?? 0} {unitVal}</strong>
                        </span>
                        <span className="text-emerald-700 font-bold">
                          + Adding: {Number(stockVal || 0)} {unitVal}
                        </span>
                        <span className="text-emerald-900 font-extrabold bg-white px-2 py-0.5 rounded border border-emerald-300">
                          = New Total Stock: {Math.max(0, Number(selectedProduct.stock ?? 0) + Number(stockVal || 0))} {unitVal}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Quick Increment Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                    <span className="text-[10px] font-semibold text-slate-400">Quick add:</span>
                    {[10, 25, 50, 100, 250].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => adjustQty(step)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 transition cursor-pointer"
                      >
                        +{step}
                      </button>
                    ))}
                  </div>
                </div>

                {/* B. Purchase Price / कितीला घेतला (खरेदी दर व एकूण खरेदी रक्कम) */}
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                    B. कितीला घेतला (Purchase Cost & Procurement Rate)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Rate per Unit */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-2.5">
                      <label className="block text-[10.5px] font-bold text-amber-900 mb-1">
                        प्रति एकक खरेदी दर (Rate / {unitVal})
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={purchaseCost}
                          onChange={(e) => handlePurchaseCostChange(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-amber-300 bg-white pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <span className="text-[9.5px] text-amber-700 mt-1 block">
                        १ {unitVal} किती रुपयांना खरेदी केला
                      </span>
                    </div>

                    {/* Total Purchase Amount */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5">
                      <label className="block text-[10.5px] font-bold text-emerald-900 mb-1">
                        एकूण खरेदी रक्कम (Total Cost for {Number(stockVal || 0)} {unitVal})
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={totalPurchaseCost}
                          onChange={(e) => handleTotalCostChange(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-emerald-300 bg-white pl-6 pr-2.5 py-1.5 text-xs font-bold text-emerald-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <span className="text-[9.5px] text-emerald-700 mt-1 block font-medium">
                        {Number(stockVal || 0)} {unitVal} × ₹{Number(purchaseCost || 0)} = ₹{Number(totalPurchaseCost || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>


                </div>
              </div>

              {/* 2. Dates & Expiry (FEFO Traceability) */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  2. Dates & Expiry / दिनांक व मुदत (FEFO Tracking) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Stock Received Date
                    </label>
                    <input
                      type="date"
                      value={receivedDate}
                      onChange={(e) => setReceivedDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-emerald-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Harvest / Mfg Date
                    </label>
                    <input
                      type="date"
                      value={mfgDate}
                      onChange={(e) => setMfgDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-rose-700 mb-1">
                      Expiry / Best Before *
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full rounded-lg border border-rose-300 bg-rose-50/30 px-3 py-1.5 text-xs outline-none focus:border-rose-600"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Packaging & Quality Specification */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  3. Packaging & Source Details / पॅकेजिंग व स्रोत
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Packaging Type</label>
                    <select
                      value={packagingType}
                      onChange={(e) => setPackagingType(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600"
                    >
                      {["Box", "Bag", "Pouch", "Crate", "Sack", "Loose", "Pack"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">No. of Packages</label>
                    <input
                      type="number"
                      min="1"
                      value={numberOfPackages}
                      onChange={(e) => setNumberOfPackages(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Package Size</label>
                    <input
                      type="text"
                      value={packageSize}
                      onChange={(e) => setPackageSize(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600"
                      placeholder="e.g. 25 kg sack"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Quality Grade</label>
                    <select
                      value={qualityGrade}
                      onChange={(e) => setQualityGrade(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600"
                    >
                      {["Grade A", "Grade B", "Grade C", "Premium", "Standard"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Stock Source</label>
                    <select
                      value={stockSource}
                      onChange={(e) => setStockSource(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600"
                    >
                      {["Farmer", "Vendor", "Supplier", "Purchase", "Return", "Other"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Purchase Cost (₹/unit)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchaseCost}
                      onChange={(e) => handlePurchaseCostChange(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Storage Location</label>
                    <input
                      type="text"
                      value={storageLocation}
                      onChange={(e) => setStorageLocation(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600"
                      placeholder="Main Darkstore / Bay A"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Store Section (Locked to Selected Product) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-emerald-700" />
                    Store Section / स्टोअर विभाग (पूर्वनिर्धारित)
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    हा विभाग उत्पादनाच्या कॅटलॉग सेक्शननुसार आपोआप सेट झाला आहे (बदलण्याची आवश्यकता नाही)
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-2xs shrink-0">
                  <span>{getSectionMeta(selectedProduct.section || sectionVal).icon}</span>
                  <span>{getSectionMeta(selectedProduct.section || sectionVal).label}</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    Locked
                  </span>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Remarks / टिपण्णी</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Received from Supplier Fresh Harvest, quality verified"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-emerald-600"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-xs disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Create Batch & Add Stock / बॅच तयार करा
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   SELLER DEDUCT STOCK MODAL (FEFO VALIDATION & BATCH DEDUCTION)
   ========================================================================= */
const DEDUCT_REASONS = [
  { value: "Order Fulfillment", label: "Order Fulfillment (ग्राहक ऑर्डर पूर्तता)", desc: "Customer order delivery" },
  { value: "Damaged Stock", label: "Damaged Stock (खराब / नुकसान झालेला माल)", desc: "Damaged during handling" },
  { value: "Expired Stock", label: "Expired Stock (मुदत संपलेला माल)", desc: "Expired batch write-off" },
  { value: "Quality Rejection", label: "Quality Rejection (गुणवत्ता नाकारलेला माल)", desc: "QC rejection" },
  { value: "Internal Usage", label: "Internal Usage (अंतर्गत वापर / सॅम्पल)", desc: "Store / demo consumption" },
  { value: "Stock Correction", label: "Stock Correction (स्टॉक दुरुस्ती / ऑडिट)", desc: "Physical audit adjustment" },
  { value: "Return to Supplier", label: "Return to Supplier (सप्लायरला परत)", desc: "Returned to vendor/supplier" },
  { value: "Other", label: "Other (इतर कारण)", desc: "Miscellaneous reason" },
];

function DeductStockModal({ product, initialBatchId = null, onClose, onStockDeducted }) {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [error, setError] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatchId || "");
  const [deductQty, setDeductQty] = useState("");
  const [reason, setReason] = useState("Order Fulfillment");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fefoRecommendedBatchId, setFefoRecommendedBatchId] = useState(null);

  // Load batches for this product
  useEffect(() => {
    let active = true;
    const fetchBatches = async () => {
      setLoadingBatches(true);
      setError("");
      try {
        const res = await vendorApi.getStockBatches({ productId: product.productId });
        if (active) {
          const list = res.data?.batches || [];
          setBatches(list);
          const fefoId = res.data?.fefoRecommendedBatchId || null;
          setFefoRecommendedBatchId(fefoId);
          if (initialBatchId) {
            setSelectedBatchId(initialBatchId);
          } else if (fefoId) {
            setSelectedBatchId(fefoId);
          } else if (list.length > 0) {
            const firstAvail = list.find((b) => b.status !== "Depleted" && b.status !== "Expired") || list[0];
            setSelectedBatchId(firstAvail.batchId);
          }
        }
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.message || "Failed to load product batches");
        }
      } finally {
        if (active) setLoadingBatches(false);
      }
    };
    fetchBatches();
    return () => {
      active = false;
    };
  }, [product.productId, initialBatchId]);

  const selectedBatch = useMemo(
    () => batches.find((b) => b.batchId === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const isExpired = selectedBatch?.status === "Expired";
  const isDepleted = selectedBatch?.status === "Depleted" || (selectedBatch && Number(selectedBatch.availableQuantity) <= 0);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedBatch) {
      setError("Please select a batch to deduct from");
      return;
    }
    const cleanQty = Number(deductQty);
    if (!Number.isFinite(cleanQty) || cleanQty <= 0) {
      setError("Deduction quantity must be a positive number greater than 0");
      return;
    }
    if (cleanQty > Number(selectedBatch.availableQuantity)) {
      setError(
        `Cannot deduct ${cleanQty} ${selectedBatch.unit}. Available batch stock is only ${selectedBatch.availableQuantity} ${selectedBatch.unit}.`
      );
      return;
    }
    if (isDepleted) {
      setError("This batch is depleted and has 0 stock available.");
      return;
    }
    if (isExpired && reason === "Order Fulfillment") {
      setError(
        "This batch has expired! Expired stock cannot be fulfilled for customer orders. Choose 'Expired Stock' write-off or 'Return to Supplier'."
      );
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await vendorApi.deductStockProduct({
        productId: product.productId,
        batchId: selectedBatch.batchId,
        quantity: Math.floor(cleanQty),
        unit: selectedBatch.unit,
        reason,
        remarks,
      });
      onStockDeducted(res.data?.product, res.data?.batch, res.data?.transaction, res.data?.products);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to deduct stock");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/80">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-rose-600" /> Deduct Stock / स्टॉक वजा करा
            </h3>
            <p className="text-[11px] text-slate-500">
              Select specific batch and reason to deduct stock with immutable transaction audit log
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Product Info */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-3 min-w-0">
              <ProductThumb src={product.image} name={product.name} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{product.name}</p>
                <p className="text-[11px] text-slate-500 font-mono">{product.sku || product.productId}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Available Stock</p>
              <p className="text-sm font-extrabold text-slate-900">
                {product.stock ?? 0} {product.unit || "Units"}
              </p>
            </div>
          </div>

          {loadingBatches ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
              <p className="mt-2 text-xs font-medium text-slate-500">Loading batch details...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-xs text-slate-500">
              No batches found for this product. Please add stock to create an active batch.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Batch Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Select Batch (FEFO - Earliest Expiry First) *
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-1 border rounded-xl border-slate-200 bg-slate-50/30">
                  {batches.map((b) => {
                    const isSelected = b.batchId === selectedBatchId;
                    const bExpired = b.status === "Expired";
                    const bDepleted = b.status === "Depleted" || Number(b.availableQuantity) <= 0;
                    const isFefo = b.batchId === fefoRecommendedBatchId;

                    return (
                      <div
                        key={b.batchId}
                        onClick={() => !bDepleted && setSelectedBatchId(b.batchId)}
                        className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between text-xs ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600"
                            : bDepleted
                            ? "border-slate-100 bg-slate-100/60 opacity-60 cursor-not-allowed"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{b.batchId}</span>
                            {isFefo ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                                <Sparkles className="h-2.5 w-2.5" /> FEFO Recommended
                              </span>
                            ) : null}
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                bExpired
                                  ? "bg-rose-100 text-rose-800"
                                  : bDepleted
                                  ? "bg-slate-200 text-slate-700"
                                  : b.status === "Low Stock"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 mt-1 text-[10px] text-slate-500 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-400 font-semibold">Exp:</span>
                              {renderExpiryWithDays(b.expiryDate)}
                            </span>
                            <span>• Loc: {b.storageLocation || "Darkstore"}</span>
                            <span>• Grade: {b.qualityGrade || "A"}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-mono font-extrabold text-xs text-slate-900">
                            {b.availableQuantity} {b.unit}
                          </p>
                          <p className="text-[10px] text-slate-400">Available</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Deduction Quantity */}
              {selectedBatch ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      Deduction Quantity ({selectedBatch.unit}) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setDeductQty(String(selectedBatch.availableQuantity))}
                      className="text-[10px] font-bold text-emerald-700 hover:underline"
                    >
                      Deduct All ({selectedBatch.availableQuantity} {selectedBatch.unit})
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={selectedBatch.availableQuantity}
                      step="1"
                      value={deductQty}
                      onChange={(e) => setDeductQty(e.target.value)}
                      placeholder={`Max: ${selectedBatch.availableQuantity}`}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-center text-lg font-extrabold text-slate-900 outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600"
                      required
                    />
                    <span className="shrink-0 text-xs font-bold text-slate-600 px-2">{selectedBatch.unit}</span>
                  </div>

                  {/* Warning on high quantity */}
                  {Number(deductQty) > selectedBatch.availableQuantity ? (
                    <p className="text-[11px] font-semibold text-rose-600">
                      Cannot deduct more than available batch stock ({selectedBatch.availableQuantity} {selectedBatch.unit}).
                    </p>
                  ) : null}

                  {isExpired && reason === "Order Fulfillment" ? (
                    <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800 border border-amber-200 flex items-start gap-1.5">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <span>
                        This batch is expired. It cannot be used for Order Fulfillment. Please choose "Expired Stock" write-off or "Return to Supplier".
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Deduction Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Reason for Deduction / कपातीचे कारण *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                  required
                >
                  {DEDUCT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / टिपण्णी</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter order reference or deduction notes..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-emerald-600"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedBatch || isDepleted || (isExpired && reason === "Order Fulfillment")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 shadow-xs disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MinusCircle className="h-3.5 w-3.5" />}
                  Confirm Stock Deduction / स्टॉक वजा करा
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   SELLER PRODUCT BATCHES & AUDIT HISTORY MODAL
   ========================================================================= */
function ProductBatchesModal({ product, onClose, onDeductFromBatch }) {
  const [activeTab, setActiveTab] = useState("batches"); // 'batches' | 'history'
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [error, setError] = useState("");
  const [txnTypeFilter, setTxnTypeFilter] = useState("all");

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    setError("");
    try {
      const res = await vendorApi.getStockBatches({ productId: product.productId });
      setBatches(res.data?.batches || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load product batches");
    } finally {
      setLoadingBatches(false);
    }
  }, [product.productId]);

  const loadTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    try {
      const params = { productId: product.productId };
      if (txnTypeFilter !== "all") params.transactionType = txnTypeFilter;
      const res = await vendorApi.getStockTransactions(params);
      setTransactions(res.data?.transactions || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load stock transactions");
    } finally {
      setLoadingTransactions(false);
    }
  }, [product.productId, txnTypeFilter]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (activeTab === "history") {
      loadTransactions();
    }
  }, [activeTab, loadTransactions]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <ProductThumb src={product.image} name={product.name} />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">{product.name}</h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {product.sku || product.productId} • Total Available: <strong>{product.stock ?? 0} {product.unit || "Units"}</strong>
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 pt-3 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab("batches")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === "batches"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Boxes className="inline h-3.5 w-3.5 mr-1" /> Product Batches ({batches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === "history"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="inline h-3.5 w-3.5 mr-1" /> Stock Audit Trail ({transactions.length})
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          {/* TAB 1: BATCHES */}
          {activeTab === "batches" && (
            <div>
              {loadingBatches ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
                  <p className="mt-2 text-xs font-medium text-slate-500">Loading batches...</p>
                </div>
              ) : batches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500">
                  No batches have been created for this product yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {batches.map((b) => {
                    const bExpired = b.status === "Expired";
                    const bDepleted = b.status === "Depleted" || Number(b.availableQuantity) <= 0;

                    return (
                      <div
                        key={b.batchId}
                        className={`p-3.5 rounded-xl border transition shadow-2xs ${
                          bDepleted
                            ? "border-slate-200 bg-slate-50/50 opacity-70"
                            : bExpired
                            ? "border-rose-200 bg-rose-50/30"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                              {b.batchId}
                            </span>
                            <CopyButton value={b.batchId} />
                            {b.fefoRecommended ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                                <Sparkles className="h-3 w-3" /> FEFO Recommended Pick
                              </span>
                            ) : null}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                bExpired
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : bDepleted
                                  ? "bg-slate-200 text-slate-700"
                                  : b.status === "Low Stock"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Available:</span>
                            <span className="text-sm font-extrabold text-slate-900 font-mono">
                              {b.availableQuantity} / {b.quantity} {b.unit}
                            </span>
                            {!bDepleted && onDeductFromBatch && (
                              <button
                                type="button"
                                onClick={() => onDeductFromBatch(b.batchId)}
                                className="ml-2 inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                              >
                                <MinusCircle className="h-3 w-3" /> Deduct
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Batch Details Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2.5 text-[11px] text-slate-600">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Received Date</span>
                            <span className="font-medium text-slate-800">
                              {b.receivedDate ? new Date(b.receivedDate).toLocaleDateString() : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Expiry Date</span>
                            <div className="mt-0.5">
                              {renderExpiryWithDays(b.expiryDate)}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Purchase / खरेदी दर</span>
                            <span className="font-extrabold text-slate-900 block">
                              {Number(b.purchaseCost || 0) > 0 ? formatPrice(b.purchaseCost) : "₹0.00"}
                            </span>
                            {Number(b.purchaseCost || 0) > 0 && Number(b.quantity || 0) > 0 ? (
                              <span className="block text-[10px] text-emerald-700 font-medium">
                                एकूण: {formatPrice(Number(b.totalPurchaseCost || (Number(b.purchaseCost) * Number(b.quantity))))}
                              </span>
                            ) : null}
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Packaging</span>
                            <span className="font-medium text-slate-800">
                              {b.packagingType || "Box"} ({b.numberOfPackages || 1} pkgs {b.packageSize ? `• ${b.packageSize}` : ""})
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Location & Grade</span>
                            <span className="font-medium text-slate-800">
                              {b.storageLocation || "Darkstore"} • {b.qualityGrade || "Grade A"}
                            </span>
                          </div>
                        </div>

                        {b.remarks ? (
                          <p className="mt-2 text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded">
                            "{b.remarks}"
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AUDIT HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Immutable Stock Ledger</span>
                <div className="flex items-center gap-1.5">
                  {["all", "ADD", "DEDUCT"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTxnTypeFilter(t)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        txnTypeFilter === t
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {loadingTransactions ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
                  <p className="mt-2 text-xs font-medium text-slate-500">Loading audit history...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500">
                  No stock transactions recorded for this product yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Batch ID</th>
                        <th className="px-3 py-2">Dates & Expiry</th>
                        <th className="px-3 py-2 text-center">Type</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2 text-right">Purchase / खरेदी दर</th>
                        <th className="px-3 py-2">Stock Balance</th>
                        <th className="px-3 py-2">Reason</th>
                        <th className="px-3 py-2">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((tx) => (
                        <tr key={tx.transactionId} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-[11px] text-emerald-800 font-bold">
                            {tx.batchId}
                            <span className="block text-[8px] text-slate-400 font-sans mt-0.5">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[10px]">
                            <p className="text-slate-800 font-semibold">Recv: {formatShortDate(tx.receivedDate || tx.createdAt)}</p>
                            {tx.mfgDate ? (
                              <p className="text-slate-500">Mfg: {formatShortDate(tx.mfgDate)}</p>
                            ) : null}
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-slate-400 font-semibold">Exp:</span>
                              {renderExpiryWithDays(tx.expiryDate)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                                tx.transactionType === "ADD"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {tx.transactionType}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900">
                            {tx.transactionType === "ADD" ? "+" : "-"}
                            {tx.quantity} {tx.unit}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            <span className="font-extrabold text-slate-900 block">
                              {Number(tx.purchaseCost || 0) > 0 ? formatPrice(tx.purchaseCost) : "₹0.00"}
                            </span>
                            {Number(tx.purchaseCost || 0) > 0 && Number(tx.quantity || 0) > 0 ? (
                              <span className="block text-[10px] text-emerald-700 font-medium">
                                एकूण: {formatPrice(Number(tx.totalPurchaseCost || (Number(tx.purchaseCost) * Number(tx.quantity))))}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                            {tx.previousStock} <ArrowRight className="inline h-2.5 w-2.5 mx-0.5 text-slate-400" /> {tx.updatedStock}
                          </td>
                          <td className="px-3 py-2 text-slate-800 font-medium">
                            {tx.reason}
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-[10px] max-w-xs truncate">
                            {tx.remarks || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   SELLER GLOBAL STOCK TRANSACTION AUDIT MODAL (ALL PRODUCTS)
   ========================================================================= */
function VendorStockHistoryModal({ onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (typeFilter !== "all") params.transactionType = typeFilter;
      if (reasonFilter !== "all") params.reason = reasonFilter;
      const res = await vendorApi.getStockTransactions(params);
      setTransactions(res.data?.transactions || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, reasonFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) =>
      [t.transactionId, t.batchId, t.productName, t.sku, t.reason, t.remarks].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [transactions, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/80">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-700" /> Stock Audit Ledger / स्टॉक व्यवहार नोंद वही
            </h3>
            <p className="text-[11px] text-slate-500">
              Complete immutable record of all Add Stock & Deduct Stock operations across all batches
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Type:</span>
            {["all", "ADD", "DEDUCT"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  typeFilter === t
                    ? "bg-emerald-700 text-white shadow-2xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {t === "all" ? "All Operations" : t}
              </button>
            ))}

            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium outline-none focus:border-emerald-600 ml-2"
            >
              <option value="all">All Reasons</option>
              {[
                "New Purchase / Stock Addition",
                "Order Fulfillment",
                "Damaged Stock",
                "Expired Stock",
                "Quality Rejection",
                "Internal Usage",
                "Stock Correction",
                "Return to Supplier",
                "Other",
              ].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search TXN, Batch, Product..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-y-auto p-5">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 mb-3">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
              <p className="mt-2 text-xs font-medium text-slate-500">Loading ledger...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-500">
              No stock transactions found matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Batch ID</th>
                    <th className="px-3 py-2.5">Product & SKU</th>
                    <th className="px-3 py-2.5">Dates & Expiry</th>
                    <th className="px-3 py-2.5 text-center">Type</th>
                    <th className="px-3 py-2.5">Quantity</th>
                    <th className="px-3 py-2.5 text-right">Purchase / खरेदी दर</th>
                    <th className="px-3 py-2.5">Stock Balance</th>
                    <th className="px-3 py-2.5">Reason</th>
                    <th className="px-3 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((tx) => (
                    <tr key={tx.transactionId} className="hover:bg-slate-50/80 transition">
                      <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-emerald-800">
                        {tx.batchId}
                        <span className="block text-[8px] text-slate-400 font-sans mt-0.5">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-slate-800 truncate max-w-xs">{tx.productName || "Product"}</p>
                        <span className="font-mono text-[10px] text-slate-400">{tx.sku}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[10px]">
                        <p className="text-slate-800 font-semibold">Recv: {formatShortDate(tx.receivedDate || tx.createdAt)}</p>
                        {tx.mfgDate ? (
                          <p className="text-slate-500">Mfg: {formatShortDate(tx.mfgDate)}</p>
                        ) : null}
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-slate-400 font-semibold">Exp:</span>
                          {renderExpiryWithDays(tx.expiryDate)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                            tx.transactionType === "ADD"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {tx.transactionType === "ADD" ? "+" : "-"}
                        {tx.quantity} {tx.unit}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        <span className="font-extrabold text-slate-900 block">
                          {Number(tx.purchaseCost || 0) > 0 ? formatPrice(tx.purchaseCost) : "₹0.00"}
                        </span>
                        {Number(tx.purchaseCost || 0) > 0 && Number(tx.quantity || 0) > 0 ? (
                          <span className="block text-[10px] text-emerald-700 font-medium">
                            एकूण: {formatPrice(Number(tx.totalPurchaseCost || (Number(tx.purchaseCost) * Number(tx.quantity))))}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {tx.previousStock} <ArrowRight className="inline h-2.5 w-2.5 mx-0.5 text-slate-400" /> {tx.updatedStock}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">
                        {tx.reason}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-[10px] max-w-xs truncate">
                        {tx.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* =========================================================================
   SELLER INVENTORY VIEW (MY PRODUCTS SECTION-WISE + STOCK EDIT)
   ========================================================================= */
function SellerInventoryView() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [q, setQ] = useState("");
  const [section, setSection] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'

  // Modals State
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addStockInitialProduct, setAddStockInitialProduct] = useState(null);
  const [deductProduct, setDeductProduct] = useState(null);
  const [deductInitialBatchId, setDeductInitialBatchId] = useState(null);
  const [batchesProduct, setBatchesProduct] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState(null);

  // Inline Stock Edit State
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineStockVal, setInlineStockVal] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);

  const existingProductIds = useMemo(() => new Set(products.map((p) => p.productId)), [products]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await vendorApi.getMyProducts();
      setProducts(res.data?.products || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load seller products stock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleQuickInlineSave = async (product) => {
    const cleanNum = inlineStockVal === "" ? 0 : Number(inlineStockVal);
    if (!Number.isFinite(cleanNum) || cleanNum < 0) {
      setError("Please enter a valid stock number (0 or more)");
      return;
    }
    setInlineSaving(true);
    setError("");
    try {
      const res = await vendorApi.updateMyProduct(product.productId, {
        stock: Math.floor(cleanNum),
        inStock: cleanNum > 0,
      });
      const updated = res.data || { ...product, stock: Math.floor(cleanNum), inStock: cleanNum > 0 };
      setProducts((prev) =>
        prev.map((p) => (p.productId === product.productId ? { ...p, ...updated, stock: Math.floor(cleanNum), inStock: cleanNum > 0 } : p))
      );
      setInlineEditId(null);
      setNotice(`Stock for "${product.name}" updated to ${Math.floor(cleanNum)} ${product.unit || "Units"}`);
      setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update stock");
    } finally {
      setInlineSaving(false);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = products.length;
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    products.forEach((p) => {
      const s = Number(p.stock ?? 0);
      const isAvail = p.inStock !== false && s > 0;
      if (!isAvail || s <= 0) {
        outOfStock += 1;
      } else if (s <= 10) {
        lowStock += 1;
        inStock += 1;
      } else {
        inStock += 1;
      }
    });
    return { total, inStock, lowStock, outOfStock };
  }, [products]);

  // Search & Filter
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products.filter((p) => {
      // Section filter
      if (section && (p.section || "") !== section) return false;

      // Status filter
      const s = Number(p.stock ?? 0);
      const isAvail = p.inStock !== false && s > 0;
      if (statusFilter === "in_stock" && !isAvail) return false;
      if (statusFilter === "low_stock" && (s <= 0 || s > 10 || !isAvail)) return false;
      if (statusFilter === "out_of_stock" && isAvail) return false;
      if (statusFilter === "alert" && isAvail && s > 10) return false;

      // Search query
      if (!query) return true;
      return [p.name, p.sku, p.productId, p.category, p.subcategory, p.brandName, p.varietyName].some((v) =>
        String(v || "").toLowerCase().includes(query)
      );
    });
  }, [products, q, section, statusFilter]);

  // Section tabs counts based on all products matching search (before section filtering)
  const sectionCounts = useMemo(() => {
    const query = q.trim().toLowerCase();
    const searchedOnly = products.filter((p) => {
      if (!query) return true;
      return [p.name, p.sku, p.productId, p.category, p.subcategory, p.brandName, p.varietyName].some((v) =>
        String(v || "").toLowerCase().includes(query)
      );
    });
    return searchedOnly.reduce((acc, p) => ({ ...acc, [p.section || ""]: (acc[p.section || ""] || 0) + 1 }), {});
  }, [products, q]);

  const sectionTabs = useMemo(() => {
    const totalMatching = Object.values(sectionCounts).reduce((a, b) => a + b, 0);
    const tabs = [{ key: "", name: "All sections", icon: "📑", count: totalMatching }];
    CATALOG_SECTIONS.forEach((s) => {
      tabs.push({ ...s, icon: SECTION_BADGES[s.key]?.icon || "🏷️", count: sectionCounts[s.key] || 0 });
    });
    // Add any unexpected sections present in products
    Object.keys(sectionCounts).forEach((k) => {
      if (k && !CATALOG_SECTIONS.some((cs) => cs.key === k)) {
        tabs.push({ key: k, name: k.charAt(0).toUpperCase() + k.slice(1), icon: "🏷️", count: sectionCounts[k] || 0 });
      }
    });
    return tabs;
  }, [sectionCounts]);

  // Group products by section when viewing "All sections"
  const groupedSections = useMemo(() => {
    if (section) {
      return [{ section, items: filtered }];
    }
    const sorted = [...filtered].sort((a, b) => catalogSectionRank(a.section) - catalogSectionRank(b.section));
    return groupBySection(sorted);
  }, [filtered, section]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Top Header - Matching Farmer Inventory View */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={EXCEL_PAGE_TITLE}>Stock Overview / स्टॉक व्यवस्थापन</h1>
            <span className="rounded-full bg-[#E8F5E9] px-2.5 py-0.5 text-xs font-bold text-[#217346] ring-1 ring-[#A7F3D0]">
              Seller Stock
            </span>
          </div>
          <p className={EXCEL_PAGE_SUB}>Product-wise stock and inventory management · My Products</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${EXCEL_INPUT} w-full sm:w-60`}
            placeholder="Search product, SKU…"
          />
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setAddStockInitialProduct(null);
              setAddStockOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#217346] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#1b5e39] transition"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add Stock
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            Audit Ledger
          </button>
          <Link
            to="/vendor/products"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            All Products
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Alert Banner for Low Stock / Out of Stock (Farmer Style) */}
      {!loading && (stats.lowStock > 0 || stats.outOfStock > 0) ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
              <BellRing className="h-4 w-4" />
              {stats.lowStock + stats.outOfStock} product{stats.lowStock + stats.outOfStock > 1 ? "s" : ""} below alert level / need restock
            </p>
            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === "alert" ? "all" : "alert"))}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
            >
              {statusFilter === "alert" ? "Show all products" : "Show only alerts"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Section Filters (Excel style pills) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
          <Layers className="h-3.5 w-3.5 text-slate-400" /> Section:
        </span>
        {sectionTabs.map((tab) => {
          const active = section === tab.key;
          return (
            <button
              key={tab.key || "all"}
              type="button"
              onClick={() => setSection(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition ${
                active
                  ? "border-[#217346] bg-[#217346] text-white shadow-2xs"
                  : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FBF9]"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  active ? "bg-white/25 text-white" : "bg-[#F3F4F6] text-[#6B7280]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Stock Content Table (Excel Table - Farmer Style) */}
      {loading ? (
        <p className="py-8 text-center text-sm text-[#6B7280]">Loading…</p>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products in My Products yet"
          description="Add products from the admin catalog to start managing your commercial store inventory and stock levels."
        />
      ) : (
        <div className="w-full overflow-x-auto border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[920px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[24%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
              <col className="w-[14%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={`${TH} text-center`}>#</th>
                <th className={TH}>Product</th>
                <th className={`${TH} text-center sm:text-left`}>Category</th>
                <th className={`${TH} text-center`}>Section</th>
                <th className={`${TH} text-center sm:text-right`}>Purchase / खरेदी दर</th>
                <th className={`${TH} text-center`}>Available Stock</th>
                <th className={`${TH} text-center`}>Unit</th>
                <th className={`${TH} text-center`}>Status</th>
                <th className={`${TH} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const stockNum = Number(p.stock ?? 0);
                const isAvail = p.inStock !== false && stockNum > 0;
                const isLow = isAvail && stockNum <= 10;
                const isInlineEditing = inlineEditId === p.productId;
                const meta = getSectionMeta(p.section);

                return (
                  <tr
                    key={p.productId}
                    role="button"
                    tabIndex={0}
                    className={`cursor-pointer ${
                      !isAvail || isLow ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-[#F9FBF9]"
                    }`}
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (p.productId) params.set("productId", p.productId);
                      if (p.sku) params.set("sku", p.sku);
                      if (p.name) params.set("name", p.name);
                      navigate(`/vendor/inventory/history?${params.toString()}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const params = new URLSearchParams();
                        if (p.productId) params.set("productId", p.productId);
                        if (p.sku) params.set("sku", p.sku);
                        if (p.name) params.set("name", p.name);
                        navigate(`/vendor/inventory/history?${params.toString()}`);
                      }
                    }}
                  >
                    <td className={`${TD} text-center align-middle text-[#9CA3AF]`}>{idx + 1}</td>
                    <td className={`${TD} min-w-0 align-middle`}>
                      <div className="flex items-center gap-2">
                        <ProductThumb src={p.image} name={p.name} />
                        <div className="min-w-0">
                          <span className="block break-words font-bold leading-snug text-[#111827] text-[10px] sm:text-[13px]">
                            {p.name}
                          </span>
                          <div className="mt-0.5 min-w-0 max-w-full" onClick={(e) => e.stopPropagation()}>
                            <ProductIdTwoLines value={p.sku || p.productId} />
                          </div>
                          {p.brandName || p.varietyName ? (
                            <span className="text-[10px] text-slate-500 block truncate">
                              {[p.brandName, p.varietyName].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className={`${TD} align-middle text-center sm:text-left text-[#374151]`}>
                      <span className="block font-medium truncate">{p.category || "—"}</span>
                      {p.subcategory ? (
                        <span className="block text-[10px] text-slate-400 truncate">{p.subcategory}</span>
                      ) : null}
                    </td>
                    <td className={`${TD} align-middle text-center`}>
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                    </td>
                    {/* Purchase Rate / खरेदी दर */}
                    <td className={`${TD} align-middle text-center sm:text-right font-medium`}>
                      <div className="flex flex-col items-center sm:items-end">
                        <span className="font-extrabold text-[#111827] text-xs sm:text-sm">
                          {Number(p.purchaseCost || p.latestPurchaseCost || 0) > 0 ? (
                            formatPrice(p.purchaseCost || p.latestPurchaseCost)
                          ) : (
                            <span className="text-slate-400 font-normal">₹0.00</span>
                          )}
                        </span>
                        {Number(p.purchaseCost || p.latestPurchaseCost || 0) > 0 && stockNum > 0 ? (
                          <span className="block text-[10px] text-emerald-700 font-medium">
                            एकूण: {formatPrice(Number(p.totalPurchaseValue || (Number(p.purchaseCost || p.latestPurchaseCost) * stockNum)))}
                          </span>
                        ) : (
                          <span className="block text-[9px] text-slate-400">खरेदी किंमत</span>
                        )}
                      </div>
                    </td>



                    {/* Available Stock */}
                    <td className={`${TD} align-middle text-center tabular-nums`} onClick={(e) => e.stopPropagation()}>
                      {isInlineEditing ? (
                        <div className="inline-flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={inlineStockVal}
                            onChange={(e) => setInlineStockVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleQuickInlineSave(p);
                              if (e.key === "Escape") setInlineEditId(null);
                            }}
                            className="w-16 rounded border border-[#217346] bg-white px-1.5 py-0.5 text-center text-xs font-bold text-slate-900 outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={inlineSaving}
                            onClick={() => handleQuickInlineSave(p)}
                            className="flex h-6 w-6 items-center justify-center rounded bg-[#217346] text-white hover:bg-[#1b5e39]"
                            title="Save"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineEditId(null)}
                            className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <span className="font-extrabold text-[12px] sm:text-[14px] text-[#111827] font-mono">
                              {p.stock === null || p.stock === undefined ? "0" : Number(p.stock).toLocaleString("en-IN")}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setInlineEditId(p.productId);
                                setInlineStockVal(String(p.stock ?? 0));
                              }}
                              className="rounded p-0.5 text-slate-400 hover:bg-[#E8F5E9] hover:text-[#217346] transition"
                              title="Quick edit stock"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                          {Number(p.purchaseCost || p.latestPurchaseCost || 0) > 0 && stockNum > 0 ? (
                            <span
                              className="text-[9px] text-slate-500 font-medium truncate max-w-full"
                              title={`Procurement Value: ${formatPrice(Number(p.totalPurchaseValue || (Number(p.purchaseCost || p.latestPurchaseCost) * stockNum)))}`}
                            >
                              मूल्य: {formatPrice(Number(p.totalPurchaseValue || (Number(p.purchaseCost || p.latestPurchaseCost) * stockNum)))}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className={`${TD} align-middle text-center font-semibold text-[#374151]`}>
                      {p.unit || "Kg"}
                    </td>
                    <td className={`${TD} align-middle text-center`}>
                      {isAvail ? (
                        <span className="inline-flex flex-col items-center font-semibold leading-tight text-[#217346]">
                          <span>In</span>
                          <span>Stock</span>
                          {isLow && <span className="text-[9px] text-amber-600 font-bold">(Low)</span>}
                        </span>
                      ) : (
                        <span className="inline-flex flex-col items-center font-semibold leading-tight text-[#DC2626]">
                          <span>Out of</span>
                          <span>Stock</span>
                        </span>
                      )}
                    </td>
                    <td className={`${TD} align-middle text-center`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-center justify-center gap-1 py-1 w-full max-w-[80px] mx-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setAddStockInitialProduct(p);
                            setAddStockOpen(true);
                          }}
                          className="w-full inline-flex items-center justify-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#065F46] hover:bg-[#D1FAE5] whitespace-nowrap transition shadow-2xs"
                          title="Add stock batch"
                        >
                          <Plus className="h-3 w-3 shrink-0" />
                          <span>Add</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeductProduct(p);
                            setDeductInitialBatchId(null);
                          }}
                          className="w-full inline-flex items-center justify-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 whitespace-nowrap transition shadow-2xs"
                          title="Deduct stock"
                        >
                          <Minus className="h-3 w-3 shrink-0" />
                          <span>Deduct</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchesProduct(p)}
                          className="w-full inline-flex items-center justify-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#374151] hover:bg-slate-50 whitespace-nowrap transition shadow-2xs"
                          title="Batches & History"
                        >
                          <Boxes className="h-3 w-3 text-slate-500 shrink-0" />
                          <span>Batches</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProduct(p)}
                          className="w-full inline-flex items-center justify-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#374151] hover:border-[#217346] hover:bg-[#E8F5E9] hover:text-[#217346] whitespace-nowrap transition shadow-2xs"
                          title="Edit stock details"
                        >
                          <Edit3 className="h-3 w-3 shrink-0" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#6B7280]">No products match filter.</p>
          ) : null}
        </div>
      )}

      {/* Add Stock Modal */}
      {addStockOpen ? (
        <AddStockModal
          initialProduct={addStockInitialProduct}
          myProducts={products}
          onClose={() => {
            setAddStockOpen(false);
            setAddStockInitialProduct(null);
          }}
          onProductAdded={(newProd, fullList, batch, transaction) => {
            if (fullList && Array.isArray(fullList) && fullList.length > 0) {
              setProducts(fullList);
            } else if (newProd) {
              setProducts((prev) => {
                const idx = prev.findIndex((p) => p.productId === newProd.productId);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { ...next[idx], ...newProd };
                  return next;
                }
                return [newProd, ...prev];
              });
            }
            setAddStockOpen(false);
            setAddStockInitialProduct(null);
            setNotice(
              batch
                ? `Stock Batch "${batch.batchId}" created with ${batch.quantity} ${batch.unit}!`
                : `Stock added successfully for "${newProd?.name || "Product"}"!`
            );
            setTimeout(() => setNotice(""), 4500);
          }}
        />
      ) : null}

      {/* Deduct Stock Modal */}
      {deductProduct ? (
        <DeductStockModal
          product={deductProduct}
          initialBatchId={deductInitialBatchId}
          onClose={() => {
            setDeductProduct(null);
            setDeductInitialBatchId(null);
          }}
          onStockDeducted={(updatedProd, updatedBatch, transaction, fullList) => {
            if (fullList && Array.isArray(fullList) && fullList.length > 0) {
              setProducts(fullList);
            } else if (updatedProd) {
              setProducts((prev) =>
                prev.map((p) => (p.productId === updatedProd.productId ? { ...p, ...updatedProd } : p))
              );
            }
            setDeductProduct(null);
            setDeductInitialBatchId(null);
            setNotice(
              `Deducted ${transaction?.quantity || ""} ${transaction?.unit || ""} from Batch ${updatedBatch?.batchId} (${transaction?.reason || "Deducted"}).`
            );
            setTimeout(() => setNotice(""), 4500);
          }}
        />
      ) : null}

      {/* Product Batches & History Modal */}
      {batchesProduct ? (
        <ProductBatchesModal
          product={batchesProduct}
          onClose={() => setBatchesProduct(null)}
          onDeductFromBatch={(batchId) => {
            const prod = batchesProduct;
            setBatchesProduct(null);
            setDeductProduct(prod);
            setDeductInitialBatchId(batchId);
          }}
        />
      ) : null}

      {/* Full Audit History Modal */}
      {historyOpen ? (
        <VendorStockHistoryModal onClose={() => setHistoryOpen(false)} />
      ) : null}

      {/* Stock Edit Modal */}
      {editingProduct ? (
        <SellerStockModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={(updated) => {
            setProducts((prev) =>
              prev.map((p) => (p.productId === updated.productId ? { ...p, ...updated } : p))
            );
            setNotice(`Stock for "${editingProduct.name}" updated successfully!`);
            setTimeout(() => setNotice(""), 3500);
          }}
        />
      ) : null}
    </div>
  );
}

/* =========================================================================
   FARMER INVENTORY VIEW (100% UNCHANGED FOR FARMER VENDORS)
   ========================================================================= */
function productNameOf(row = {}) {
  return row.productName || row.product || row.name || "Product";
}

function productGroupKey(row = {}) {
  const id = String(row.productId || "").trim();
  if (id && !/^[a-f0-9]{24}$/i.test(id)) return id.toUpperCase();
  const biz = formatProductBusinessId(row);
  if (biz && biz !== "—" && !/^[a-f0-9]{24}$/i.test(biz)) return String(biz).toUpperCase();
  return `${productNameOf(row).trim().toLowerCase()}|${String(row.variety || "").trim().toLowerCase()}`;
}

function gradeLetterQty(row, letter) {
  const label = `Grade ${letter}`;
  const fromAssigned = Number(
    row[`grade${letter}Quantity`] ?? row[`grade${letter}Qty`] ?? row[`grade${letter}Assigned`] ?? 0
  );
  const grades = Array.isArray(row.grades) ? row.grades : [];
  const fromGrades = grades.find((g) => {
    const key = String(g.grade || g.label || "")
      .replace(/grade\s*/i, "")
      .trim()
      .toUpperCase();
    return key === letter || String(g.label || "").trim() === label;
  });
  const finalRows = Array.isArray(row.finalStatement) ? row.finalStatement : [];
  const fromFinal = finalRows.find((g) => {
    const key = String(g.grade || g.label || "")
      .replace(/grade\s*/i, "")
      .trim()
      .toUpperCase();
    return key === letter || String(g.label || "").trim() === label;
  });
  const gq = row.gradeQuality && typeof row.gradeQuality === "object" ? row.gradeQuality : {};
  const rejected = Number(gq[label]?.rejectedQuantity || fromFinal?.rejectedQuantity || 0);
  const base = Number(
    fromFinal?.finalQty ??
      fromFinal?.quantity ??
      fromFinal?.qty ??
      fromGrades?.quantity ??
      fromGrades?.qty ??
      (fromAssigned > 0 ? fromAssigned : 0)
  );
  const qty = Math.max(0, base - (fromFinal?.finalQty != null ? 0 : rejected));
  return Number.isFinite(qty) ? qty : 0;
}

function formatQty(qty, min) {
  const n = Number(qty || 0);
  return (
    <span
      className={`font-bold tabular-nums text-[10px] sm:text-[13px] ${min ? "text-[#DC2626]" : "text-[#111827]"}`}
      title={min ? `Below alert level of ${min}` : undefined}
    >
      {n.toLocaleString("en-IN")}
      {min ? <span className="ml-0.5 align-top text-[8px] sm:text-[10px]">▼</span> : null}
    </span>
  );
}

function splitProductId(value) {
  const text = String(value || "").trim();
  if (!text || text === "—") return { line1: "—", line2: "" };
  const parts = text.split("-");
  if (parts.length < 4) {
    const mid = Math.ceil(text.length / 2);
    return { line1: text.slice(0, mid), line2: text.slice(mid) };
  }
  const mid = Math.ceil(parts.length / 2);
  return {
    line1: parts.slice(0, mid).join("-"),
    line2: parts.slice(mid).join("-"),
  };
}

function ProductIdTwoLines({ value }) {
  const { line1, line2 } = splitProductId(value);
  const full = String(value || "").trim() || "—";
  return (
    <span className="inline-flex min-w-0 max-w-full items-start gap-0.5">
      <span
        className="min-w-0 font-mono text-[7px] font-semibold leading-snug tracking-wide text-[#217346] sm:text-[10px]"
        title={full}
      >
        <span className="hidden truncate sm:block">{full}</span>
        <span className="block sm:hidden">{line1}</span>
        {line2 ? <span className="block sm:hidden">{line2}</span> : null}
      </span>
      <CopyButton value={full === "—" ? "" : full} />
    </span>
  );
}

function stockStatusOf(gradeA, gradeB, gradeC) {
  const total = Number(gradeA || 0) + Number(gradeB || 0) + Number(gradeC || 0);
  return total > 0 ? "In Stock" : "Out of Stock";
}

function alertBreaches(row, alert) {
  if (!alert || alert.enabled === false) return {};
  const breaches = {};
  if (alert.minGradeA > 0 && row.gradeA < alert.minGradeA) breaches.A = alert.minGradeA;
  if (alert.minGradeB > 0 && row.gradeB < alert.minGradeB) breaches.B = alert.minGradeB;
  if (alert.minGradeC > 0 && row.gradeC < alert.minGradeC) breaches.C = alert.minGradeC;
  const total = row.gradeA + row.gradeB + row.gradeC;
  if (alert.minTotal > 0 && total < alert.minTotal) breaches.total = alert.minTotal;
  return breaches;
}

function formatShortDate(val) {
  if (!val) return "—";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function expiryBadge(expiryDate) {
  if (!expiryDate) return <span className="text-[#9CA3AF]">—</span>;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  if (Number.isNaN(exp.getTime())) return <span className="font-medium text-slate-800">{expiryDate}</span>;
  const diffDays = Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dateFormatted = formatShortDate(expiryDate);

  if (diffDays < 0) {
    return (
      <span className="inline-flex flex-col items-center leading-tight">
        <span className="font-semibold text-red-700 tabular-nums">{dateFormatted}</span>
        <span className="rounded bg-red-100 px-1 py-0.5 text-[8px] font-bold text-red-800">
          Expired ({Math.abs(diffDays)}d)
        </span>
      </span>
    );
  }
  if (diffDays <= 3) {
    return (
      <span className="inline-flex flex-col items-center leading-tight">
        <span className="font-semibold text-amber-700 tabular-nums">{dateFormatted}</span>
        <span className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-800">
          {diffDays === 0 ? "Today" : `${diffDays}d left`}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span className="font-semibold text-[#1F2937] tabular-nums">{dateFormatted}</span>
      <span className="text-[8px] font-medium text-emerald-700">
        {diffDays}d left
      </span>
    </span>
  );
}

function breachText(row, breaches) {
  const unit = row.unit || "Kg";
  return Object.entries(breaches)
    .map(([key, min]) =>
      key === "total"
        ? `Total ${row.gradeA + row.gradeB + row.gradeC} < ${min} ${unit}`
        : `Grade ${key} ${row[`grade${key}`]} < ${min} ${unit}`
    )
    .join(" · ");
}

function FarmerInventoryView() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [alerts, setAlerts] = useState({});
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  useEffect(() => {
    setLoading(true);
    listManagerQuality({ bucket: "completed" })
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    vendorApi
      .getInventoryAlerts()
      .then((res) => {
        const list = Array.isArray(res?.data?.items) ? res.data.items : [];
        setAlerts(Object.fromEntries(list.map((a) => [a.productKey, a])));
      })
      .catch(() => setAlerts({}));
  }, []);

  const rows = useMemo(() => {
    const map = new Map();
    items.forEach((row) => {
      const key = productGroupKey(row);
      const unit = row.unit || "Kg";
      const gradeA = gradeLetterQty(row, "A");
      const gradeB = gradeLetterQty(row, "B");
      const gradeC = gradeLetterQty(row, "C");
      const packagingDate = row.packagingDate || row.packingDate || row.receivedDate || "";
      const expiryDate = row.expiryDate || "";
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          productLabel: productNameOf(row),
          variety: row.variety || "",
          productBizId: formatProductBusinessId(row),
          productId: row.productId || "",
          unit,
          gradeA,
          gradeB,
          gradeC,
          orderId: row.orderId || row.orderDisplayId || "",
          packagingDate,
          expiryDate,
        });
        return;
      }
      existing.gradeA += gradeA;
      existing.gradeB += gradeB;
      existing.gradeC += gradeC;
      if (!existing.packagingDate && packagingDate) existing.packagingDate = packagingDate;
      if (!existing.expiryDate && expiryDate) existing.expiryDate = expiryDate;
      if (!existing.productBizId || existing.productBizId === "—") {
        existing.productBizId = formatProductBusinessId(row);
      }
      if (!existing.orderId) existing.orderId = row.orderId || row.orderDisplayId || "";
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        status: stockStatusOf(row.gradeA, row.gradeB, row.gradeC),
        alert: alerts[row.key] || null,
        breaches: alertBreaches(row, alerts[row.key]),
      }))
      .sort((a, b) => a.productLabel.localeCompare(b.productLabel));
  }, [items, alerts]);

  const triggered = useMemo(() => rows.filter((row) => Object.keys(row.breaches).length), [rows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (alertsOnly && triggered.length ? triggered : rows).filter((row) => {
      if (!q) return true;
      return (
        row.productLabel.toLowerCase().includes(q) ||
        String(row.variety || "").toLowerCase().includes(q) ||
        String(row.productBizId || "").toLowerCase().includes(q)
      );
    });
  }, [rows, triggered, alertsOnly, query]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={EXCEL_PAGE_TITLE}>All Inventory</h1>
          <p className={EXCEL_PAGE_SUB}>Product-wise stock from Quality &amp; Grading · Completed</p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${EXCEL_INPUT} w-full sm:max-w-xs`}
          placeholder="Search product…"
        />
      </div>

      {!loading && triggered.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
              <BellRing className="h-4 w-4" />
              {triggered.length} product{triggered.length > 1 ? "s" : ""} below alert level
            </p>
            <button
              type="button"
              onClick={() => setAlertsOnly(!alertsOnly)}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
            >
              {alertsOnly ? "Show all products" : "Show only these"}
            </button>
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-red-700">
            {triggered.map((row) => (
              <li key={row.key}>
                <span className="font-semibold">
                  {row.productLabel}
                  {row.variety ? ` (${row.variety})` : ""}
                </span>
                : {breachText(row, row.breaches)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-[#6B7280]">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No graded inventory yet"
          description="Completed Quality & Grading stock will appear here product-wise."
        />
      ) : (
        <div className="w-full overflow-hidden border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[17%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={`${TH} text-center`}>#</th>
                <th className={TH}>Product</th>
                <th className={`${TH} text-center sm:text-left`}>Variety</th>
                <th className={`${GRADE_TH} border-[#A7F3D0] bg-[#D1FAE5] text-[#065F46]`}>
                  <span className="sm:hidden">A</span>
                  <span className="hidden sm:inline">Grade A</span>
                </th>
                <th className={`${GRADE_TH} border-[#BFDBFE] bg-[#DBEAFE] text-[#1E40AF]`}>
                  <span className="sm:hidden">B</span>
                  <span className="hidden sm:inline">Grade B</span>
                </th>
                <th className={`${GRADE_TH} border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]`}>
                  <span className="sm:hidden">C</span>
                  <span className="hidden sm:inline">Grade C</span>
                </th>
                <th className={`${TH} text-center`}>
                  <span className="sm:hidden">Recv</span>
                  <span className="hidden sm:inline">Receiving Date</span>
                </th>
                <th className={`${TH} text-center`}>
                  <span className="sm:hidden">Exp</span>
                  <span className="hidden sm:inline">Expiry Date</span>
                </th>
                <th className={`${TH} text-center`}>Unit</th>
                <th className={`${TH} text-center`}>Status</th>
                <th className={`${TH} text-center`}>Alert</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => (
                <tr
                  key={row.key}
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer ${
                    Object.keys(row.breaches).length ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-[#F9FBF9]"
                  }`}
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (row.productId) params.set("productId", row.productId);
                    if (row.productBizId) params.set("productBizId", row.productBizId);
                    if (row.productLabel) params.set("name", row.productLabel);
                    if (row.variety) params.set("variety", row.variety);
                    navigate(`/vendor/inventory/history?${params.toString()}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const params = new URLSearchParams();
                      if (row.productId) params.set("productId", row.productId);
                      if (row.productBizId) params.set("productBizId", row.productBizId);
                      if (row.productLabel) params.set("name", row.productLabel);
                      if (row.variety) params.set("variety", row.variety);
                      navigate(`/vendor/inventory/history?${params.toString()}`);
                    }
                  }}
                >
                  <td className={`${TD} text-center align-middle text-[#9CA3AF]`}>{idx + 1}</td>
                  <td className={`${TD} min-w-0 align-middle`}>
                    <span className="block break-words font-bold leading-snug text-[#111827] text-[10px] sm:text-[13px]">
                      {row.productLabel}
                    </span>
                    <div className="mt-0.5 min-w-0 max-w-full" onClick={(e) => e.stopPropagation()}>
                      <ProductIdTwoLines value={row.productBizId} />
                    </div>
                  </td>
                  <td className={`${TD} align-middle break-words text-center font-medium text-[#374151] sm:text-left`}>
                    {row.variety || "—"}
                  </td>
                  <td className={`${GRADE_TD} align-middle border-[#A7F3D0] bg-[#ECFDF5]`}>
                    {formatQty(row.gradeA, row.breaches.A)}
                  </td>
                  <td className={`${GRADE_TD} align-middle border-[#BFDBFE] bg-[#EFF6FF]`}>
                    {formatQty(row.gradeB, row.breaches.B)}
                  </td>
                  <td className={`${GRADE_TD} align-middle border-[#FDE68A] bg-[#FFFBEB]`}>
                    {formatQty(row.gradeC, row.breaches.C)}
                  </td>
                  <td className={`${TD} align-middle text-center tabular-nums text-[#374151]`}>
                    {formatShortDate(row.packagingDate)}
                  </td>
                  <td className={`${TD} align-middle text-center`}>
                    {expiryBadge(row.expiryDate)}
                  </td>
                  <td className={`${TD} align-middle text-center font-semibold text-[#374151]`}>{row.unit || "Kg"}</td>
                  <td className={`${TD} align-middle text-center`}>
                    {row.status === "In Stock" ? (
                      <span className="inline-flex flex-col items-center font-semibold leading-tight text-[#217346]">
                        <span>In</span>
                        <span>Stock</span>
                      </span>
                    ) : (
                      <span className="inline-flex flex-col items-center font-semibold leading-tight text-[#DC2626]">
                        <span>Out of</span>
                        <span>Stock</span>
                      </span>
                    )}
                  </td>
                  <td className={`${TD} align-middle text-center`}>
                    <AlertButton row={row} onClick={() => setEditingRow(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#6B7280]">No products match.</p>
          ) : null}
        </div>
      )}

      {editingRow ? (
        <InventoryAlertModal
          row={editingRow}
          alert={alerts[editingRow.key]}
          onClose={() => setEditingRow(null)}
          onSaved={(item) => {
            setAlerts((prev) => ({ ...prev, [item.productKey]: item }));
            setEditingRow(null);
          }}
          onDeleted={(item) => {
            setAlerts((prev) => {
              const next = { ...prev };
              delete next[item.productKey];
              return next;
            });
            setEditingRow(null);
          }}
        />
      ) : null}
    </div>
  );
}

function AlertButton({ row, onClick }) {
  const breached = Object.keys(row.breaches).length > 0;
  const Icon = !row.alert ? Bell : row.alert.enabled === false ? BellOff : breached ? BellRing : Bell;
  const tone = breached
    ? "bg-red-100 text-red-600 ring-red-200"
    : row.alert && row.alert.enabled !== false
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-slate-50 text-slate-400 ring-slate-200";
  const title = breached
    ? breachText(row, row.breaches)
    : row.alert
      ? row.alert.enabled === false
        ? "Alert is off — click to edit"
        : "Alert set — click to edit"
      : "Set stock alert";
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 transition hover:scale-105 sm:h-8 sm:w-8 ${tone}`}
    >
      <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${breached ? "animate-pulse" : ""}`} />
    </button>
  );
}

/* =========================================================================
   MAIN EXPORT (ROUTER BETWEEN SELLER & FARMER)
   ========================================================================= */
export default function ManagerInventoryPage() {
  const { vendor } = useVendorAuth();
  const isSeller = vendor?.vendorType === "seller";

  if (isSeller) {
    return <SellerInventoryView />;
  }

  return <FarmerInventoryView />;
}
