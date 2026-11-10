import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowUpDown,
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Package,
  Store,
  SlidersHorizontal,
  Layers,
  Settings,
  History,
  Trash2,
  ChevronRight,
  Eye,
  Info,
  Zap,
  Sprout,
  Building2,
  Leaf,
  Filter,
  CheckSquare,
  X,
  FileCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { vendorApi } from "../../api/vendorApi";
import { useVendorSettings } from "../../context/VendorSettingsContext";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  parseCSV,
  generateCSV,
  parseXML,
  generateXML,
  generateShopConfigXML,
  parseShopConfigXML,
  validateProductRecords,
  getImportHistory,
  saveImportHistoryEntry,
  clearImportHistory,
  triggerDownload,
  SAMPLE_PRODUCTS_DATA,
  SAMPLE_PRODUCTS_CSV,
  SAMPLE_PRODUCTS_XML,
  EXISTING_SHOP_PRESETS,
} from "../../utils/exportImportEngine";

const PANEL = "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs";

export default function VendorExportImportPage() {
  const { settings, updateSettings } = useVendorSettings();
  const { vendor } = useVendorAuth();

  const [activeTab, setActiveTab] = useState("products"); // 'products' | 'shop-config' | 'history'

  // Products State
  const [products, setProducts] = useState(SAMPLE_PRODUCTS_DATA);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv"); // 'csv' | 'xml'
  const [exportFilter, setExportFilter] = useState("all"); // 'all' | 'in-stock' | 'grade-a'

  // Import State
  const [importFormat, setImportFormat] = useState("auto"); // 'auto' | 'csv' | 'xml'
  const [importText, setImportText] = useState("");
  const [importedFileName, setImportedFileName] = useState("");
  const [parsedValidation, setParsedValidation] = useState(null);
  const [duplicateAction, setDuplicateAction] = useState("overwrite"); // 'overwrite' | 'skip' | 'append'
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccessResult, setImportSuccessResult] = useState(null);

  // Shop Config State
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [importedShopConfig, setImportedShopConfig] = useState(null);
  const [configDiffPreview, setConfigDiffPreview] = useState(null);
  const [configExportFormat, setConfigExportFormat] = useState("json"); // 'json' | 'xml'

  // History State
  const [historyLogs, setHistoryLogs] = useState([]);

  const fileInputRef = useRef(null);
  const shopConfigFileInputRef = useRef(null);

  // Load live products from vendor catalog if available
  useEffect(() => {
    let isMounted = true;
    setLoadingProducts(true);
    vendorApi
      .getProducts()
      .then((res) => {
        if (!isMounted) return;
        const data = res.data || {};
        const list = Array.isArray(data.products) ? data.products : [];
        if (list.length > 0) {
          // Normalize to common format
          const formatted = list.map((p) => ({
            sku: p.sku || p.productId || `SKU-${p.id}`,
            name: p.name || p.productName || "Product",
            variety: p.variety || "",
            brandName: p.brandName || "GreenGrocc Farms",
            category: p.category || (Array.isArray(p.categories) ? p.categories[0] : "Vegetables"),
            subcategory: p.subcategory || "",
            price: Number(p.sellingPrice || p.price || 0),
            discountedPrice: Number(p.discountedPrice || p.sellingPrice || p.price || 0),
            mrp: Number(p.mrp || p.sellingPrice || 0),
            stock: Number(p.stock || 0),
            unit: p.unit || "Kg",
            grade: p.grade || "Grade A",
            isActive: p.isActive !== false && p.status !== "Rejected",
            farmerName: p.farmerName || "Farmer Direct",
            produceType: p.produceType || "Organic",
            harvestDate: p.harvestDate || "",
            description: p.description || "",
          }));
          setProducts(formatted);
        }
      })
      .catch(() => {
        // Fall back to sample/cached products
      })
      .finally(() => {
        if (isMounted) setLoadingProducts(false);
      });

    setHistoryLogs(getImportHistory());

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter products for export
  const exportableProducts = useMemo(() => {
    if (exportFilter === "in-stock") {
      return products.filter((p) => p.stock > 0);
    }
    if (exportFilter === "grade-a") {
      return products.filter((p) => String(p.grade || "").toLowerCase().includes("a"));
    }
    return products;
  }, [products, exportFilter]);

  // --------------------------------------------------------------------
  // PRODUCTS EXPORT HANDLERS (CSV & XML)
  // --------------------------------------------------------------------
  const handleExportProducts = (format = exportFormat) => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const count = exportableProducts.length;

    if (count === 0) {
      toast.error("No products match the selected export filter.");
      return;
    }

    if (format === "csv") {
      const csvContent = generateCSV(exportableProducts);
      triggerDownload(csvContent, `greengrocc-products-${dateStr}.csv`, "text/csv;charset=utf-8;");
      toast.success(`Exported ${count} products to CSV!`);
      saveImportHistoryEntry({
        type: "export",
        entity: "products",
        format: "CSV",
        recordCount: count,
        fileName: `greengrocc-products-${dateStr}.csv`,
        status: "Completed",
      });
      setHistoryLogs(getImportHistory());
    } else {
      const xmlContent = generateXML(exportableProducts, vendor?.vendorName || "GreenGrocc Vendor Portal");
      triggerDownload(xmlContent, `greengrocc-products-${dateStr}.xml`, "application/xml;charset=utf-8;");
      toast.success(`Exported ${count} products to XML!`);
      saveImportHistoryEntry({
        type: "export",
        entity: "products",
        format: "XML",
        recordCount: count,
        fileName: `greengrocc-products-${dateStr}.xml`,
        status: "Completed",
      });
      setHistoryLogs(getImportHistory());
    }
  };

  // --------------------------------------------------------------------
  // PRODUCTS IMPORT HANDLERS (CSV & XML)
  // --------------------------------------------------------------------
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setImportText(content);
      processImportContent(content, ext === "xml" ? "xml" : ext === "csv" ? "csv" : "auto");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const processImportContent = (content, format) => {
    if (!content.trim()) {
      setParsedValidation(null);
      return;
    }

    try {
      let parsed = [];
      const isXml =
        format === "xml" ||
        (format === "auto" && (content.trim().startsWith("<?xml") || content.trim().startsWith("<")));

      if (isXml) {
        parsed = parseXML(content);
      } else {
        parsed = parseCSV(content);
      }

      if (parsed.length === 0) {
        toast.error("No valid product records found in file.");
        setParsedValidation(null);
        return;
      }

      const validation = validateProductRecords(parsed);
      setParsedValidation(validation);
      setImportSuccessResult(null);
      toast.success(`Parsed ${validation.totalRecords} products (${validation.validRecords} valid)`);
    } catch (err) {
      toast.error(err.message || "Failed to parse import content.");
      setParsedValidation(null);
    }
  };

  const handleApplyProductsImport = () => {
    if (!parsedValidation || parsedValidation.items.length === 0) return;

    setIsProcessing(true);

    setTimeout(() => {
      const newItems = parsedValidation.items;
      let updatedList = [...products];

      if (duplicateAction === "overwrite") {
        const newSkuMap = new Map(newItems.map((item) => [String(item.sku).toLowerCase(), item]));
        updatedList = updatedList.map((item) => {
          const key = String(item.sku).toLowerCase();
          return newSkuMap.has(key) ? { ...item, ...newSkuMap.get(key) } : item;
        });
        // Append novel items
        const existingSkus = new Set(products.map((p) => String(p.sku).toLowerCase()));
        newItems.forEach((item) => {
          if (!existingSkus.has(String(item.sku).toLowerCase())) {
            updatedList.push(item);
          }
        });
      } else if (duplicateAction === "skip") {
        const existingSkus = new Set(products.map((p) => String(p.sku).toLowerCase()));
        newItems.forEach((item) => {
          if (!existingSkus.has(String(item.sku).toLowerCase())) {
            updatedList.push(item);
          }
        });
      } else {
        // Append all
        updatedList = [...updatedList, ...newItems];
      }

      setProducts(updatedList);
      setIsProcessing(false);
      setImportSuccessResult({
        totalImported: newItems.length,
        catalogTotal: updatedList.length,
        timestamp: new Date().toLocaleTimeString(),
      });

      saveImportHistoryEntry({
        type: "import",
        entity: "products",
        format: importedFileName.endsWith(".xml") ? "XML" : "CSV",
        recordCount: newItems.length,
        fileName: importedFileName || "Pasted Catalog Content",
        status: "Applied",
      });
      setHistoryLogs(getImportHistory());

      toast.success(`Successfully imported ${newItems.length} products!`);
    }, 400);
  };

  // --------------------------------------------------------------------
  // SHOP CONFIGURATION EXPORT & IMPORT (From Existing Shops)
  // --------------------------------------------------------------------
  const handleExportShopConfig = (format = configExportFormat) => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const shopName = vendor?.vendorName || "GreenGrocc Shop";

    const fullConfig = {
      ...settings,
      shopName,
      vendorId: vendor?.id || "vendor-1",
      exportedAt: new Date().toISOString(),
      storeType: vendor?.storeType || "standard",
      businessType: "Agricultural Fresh Produce",
      deliveryRadiusKm: 15,
      minimumOrderValue: 150,
      markupPercentage: 10,
    };

    if (format === "xml") {
      const xml = generateShopConfigXML(fullConfig, shopName);
      triggerDownload(xml, `shop-config-${dateStr}.xml`, "application/xml;charset=utf-8;");
      toast.success("Shop configuration exported as XML!");
    } else {
      const json = JSON.stringify(fullConfig, null, 2);
      triggerDownload(json, `shop-config-${dateStr}.json`, "application/json;charset=utf-8;");
      toast.success("Shop configuration exported as JSON!");
    }

    saveImportHistoryEntry({
      type: "export",
      entity: "shop_configuration",
      format: format.toUpperCase(),
      recordCount: 1,
      fileName: `shop-config-${dateStr}.${format}`,
      status: "Completed",
    });
    setHistoryLogs(getImportHistory());
  };

  const handleShopConfigFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target.result;
      try {
        let parsedConfig = null;
        if (ext === "xml" || content.trim().startsWith("<")) {
          parsedConfig = parseShopConfigXML(content);
        } else {
          parsedConfig = JSON.parse(content);
        }

        setImportedShopConfig(parsedConfig);
        generateConfigDiff(parsedConfig);
        toast.success(`Loaded configuration from ${file.name}`);
      } catch (err) {
        toast.error("Failed to parse shop configuration file. Ensure valid JSON or XML.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setImportedShopConfig(preset.config);
    generateConfigDiff(preset.config);
  };

  const generateConfigDiff = (newCfg) => {
    const diffs = [
      {
        section: "Operations",
        key: "Auto-Confirm Pre-orders",
        current: settings.operations?.autoConfirmPreorders ? "Enabled" : "Disabled",
        imported: newCfg.operations?.autoConfirmPreorders ? "Enabled" : "Disabled",
      },
      {
        section: "Operations",
        key: "Auto-Assign Drivers",
        current: settings.operations?.autoAssignDrivers ? "Enabled" : "Disabled",
        imported: newCfg.operations?.autoAssignDrivers ? "Enabled" : "Disabled",
      },
      {
        section: "Operations",
        key: "Batch Size",
        current: settings.operations?.defaultBatchSize || 5,
        imported: newCfg.operations?.defaultBatchSize || 5,
      },
      {
        section: "Quality Control",
        key: "Require Quality Photos",
        current: settings.operations?.requireQualityPhotos ? "Required" : "Optional",
        imported: newCfg.operations?.requireQualityPhotos ? "Required" : "Optional",
      },
      {
        section: "Notifications",
        key: "Low Stock Alert Threshold",
        current: `${settings.notifications?.lowStockThresholdKg || 50} Kg`,
        imported: `${newCfg.notifications?.lowStockThresholdKg || 50} Kg`,
      },
      {
        section: "Display",
        key: "Theme & Refresh Interval",
        current: `${settings.display?.theme || "light"} (${settings.display?.autoRefreshInterval || 0}s)`,
        imported: `${newCfg.display?.theme || "light"} (${newCfg.display?.autoRefreshInterval || 0}s)`,
      },
    ];
    setConfigDiffPreview(diffs);
  };

  const handleApplyShopConfig = () => {
    if (!importedShopConfig) return;

    try {
      const merged = {
        ...settings,
        display: { ...settings.display, ...(importedShopConfig.display || {}) },
        operations: { ...settings.operations, ...(importedShopConfig.operations || {}) },
        notifications: { ...settings.notifications, ...(importedShopConfig.notifications || {}) },
        security: { ...settings.security, ...(importedShopConfig.security || {}) },
        integrations: { ...settings.integrations, ...(importedShopConfig.integrations || {}) },
      };

      updateSettings(merged);

      saveImportHistoryEntry({
        type: "import",
        entity: "shop_configuration",
        format: selectedPreset ? "PRESET" : "FILE",
        recordCount: 1,
        fileName: selectedPreset?.name || "Imported Shop Config",
        status: "Applied",
      });
      setHistoryLogs(getImportHistory());

      toast.success("Shop configuration imported and applied successfully!");
      setImportedShopConfig(null);
      setConfigDiffPreview(null);
      setSelectedPreset(null);
    } catch (err) {
      toast.error("Failed to apply shop configuration.");
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Vendor Export & Import Hub</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Frontend Client
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Export and import products in CSV & XML formats, or transfer configurations from existing shops — zero backend access required.
          </p>
        </div>

        {/* Quick Sample Downloads Header */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => triggerDownload(SAMPLE_PRODUCTS_CSV, "sample-products.csv", "text/csv;charset=utf-8;")}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-emerald-300"
          >
            <Download className="h-3.5 w-3.5 text-emerald-700" />
            <span>Sample CSV</span>
          </button>
          <button
            type="button"
            onClick={() => triggerDownload(SAMPLE_PRODUCTS_XML, "sample-products.xml", "application/xml;charset=utf-8;")}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-emerald-300"
          >
            <Download className="h-3.5 w-3.5 text-emerald-700" />
            <span>Sample XML</span>
          </button>
        </div>
      </div>

      {/* Clutter-Free Primary Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        {[
          { id: "products", label: "Products (CSV & XML)", icon: Package, badge: `${products.length} Items` },
          { id: "shop-config", label: "Shop Configurations", icon: Store, badge: "Existing Shops" },
          { id: "history", label: "Activity & History", icon: History, badge: `${historyLogs.length}` },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                isActive
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: PRODUCTS IMPORT & EXPORT (CSV & XML)                     */}
      {/* ============================================================== */}
      {activeTab === "products" && (
        <div className="space-y-6">
          {/* Two-Column Grid: Export Card on Left, Import Card on Right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. EXPORT PRODUCTS CARD */}
            <div className={PANEL}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <Download className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Export Vendor Catalog</h2>
                    <p className="text-xs text-slate-500">Generate clean CSV or XML files</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {exportableProducts.length} Products
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {/* Format Selector Pills */}
                <div>
                  <label className="text-xs font-bold text-slate-700">Export File Format</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportFormat("csv")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition ${
                        exportFormat === "csv"
                          ? "border-emerald-700 bg-emerald-50 text-emerald-800 shadow-xs"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                      <span>CSV Format (.csv)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat("xml")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition ${
                        exportFormat === "xml"
                          ? "border-emerald-700 bg-emerald-50 text-emerald-800 shadow-xs"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <FileCode className="h-4 w-4 text-emerald-700" />
                      <span>XML Format (.xml)</span>
                    </button>
                  </div>
                </div>

                {/* Filter Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700">Filter Products</label>
                  <select
                    value={exportFilter}
                    onChange={(e) => setExportFilter(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
                  >
                    <option value="all">All Products in Catalog ({products.length})</option>
                    <option value="in-stock">In-Stock Only ({products.filter((p) => p.stock > 0).length})</option>
                    <option value="grade-a">Grade A Certified Only ({products.filter((p) => String(p.grade).includes("A")).length})</option>
                  </select>
                </div>

                {/* Summary Info */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Selected Format:</span>
                    <strong className="uppercase font-mono text-slate-800">{exportFormat}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Records to Export:</span>
                    <strong className="text-slate-800">{exportableProducts.length} rows</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Encoding:</span>
                    <strong className="text-slate-800">UTF-8 Standard</strong>
                  </div>
                </div>

                {/* Export Action Button */}
                <button
                  type="button"
                  onClick={() => handleExportProducts(exportFormat)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-emerald-800 active:scale-[0.99]"
                >
                  <Download className="h-4 w-4" />
                  <span>Download {exportFormat.toUpperCase()} File</span>
                </button>
              </div>
            </div>

            {/* 2. IMPORT PRODUCTS CARD */}
            <div className={PANEL}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <Upload className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Import Products</h2>
                    <p className="text-xs text-slate-500">Supports CSV and XML formats</p>
                  </div>
                </div>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Auto-Detect Format
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {/* Drag-and-Drop File Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center transition hover:border-emerald-600 hover:bg-emerald-50/30"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xml,text/csv,text/xml,application/xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-xs group-hover:scale-110 transition">
                    <Upload className="h-5 w-5 text-emerald-700" />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-800">
                    {importedFileName ? importedFileName : "Click or drag CSV / XML file here"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Accepts .csv (RFC 4180) and .xml (shop_catalog, Google Shopping, RSS)
                  </p>
                </div>

                {/* Paste / Direct text alternative */}
                <div>
                  <div className="flex items-center justify-between pb-1">
                    <label className="text-xs font-bold text-slate-700">Or Paste Raw CSV / XML Data</label>
                    {importText && (
                      <button
                        type="button"
                        onClick={() => {
                          setImportText("");
                          setImportedFileName("");
                          setParsedValidation(null);
                        }}
                        className="text-[10px] text-red-600 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={importText}
                    onChange={(e) => {
                      setImportText(e.target.value);
                      processImportContent(e.target.value, importFormat);
                    }}
                    placeholder="Paste CSV rows with headers, or XML <product> tags..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-mono text-[11px] text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>

                {/* Duplicate Policy */}
                <div>
                  <label className="text-xs font-bold text-slate-700">Duplicate SKU Handling</label>
                  <div className="mt-1 grid grid-cols-3 gap-1.5 text-xs">
                    {[
                      { id: "overwrite", label: "Update Matching" },
                      { id: "skip", label: "Skip Duplicates" },
                      { id: "append", label: "Append as New" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDuplicateAction(opt.id)}
                        className={`rounded-lg border px-2 py-1.5 text-center font-semibold transition ${
                          duplicateAction === opt.id
                            ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parse Validation Overview */}
                {parsedValidation && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60">
                      <span className="font-bold text-emerald-950 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Ready to Import
                      </span>
                      <span className="font-mono font-bold text-emerald-800">
                        {parsedValidation.validRecords} / {parsedValidation.totalRecords} Valid
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div className="rounded-lg bg-white p-1.5 border border-emerald-100">
                        <p className="text-slate-400">Total Rows</p>
                        <p className="font-bold text-slate-800">{parsedValidation.totalRecords}</p>
                      </div>
                      <div className="rounded-lg bg-white p-1.5 border border-emerald-100">
                        <p className="text-slate-400">Warnings</p>
                        <p className="font-bold text-amber-700">{parsedValidation.warningCount}</p>
                      </div>
                      <div className="rounded-lg bg-white p-1.5 border border-emerald-100">
                        <p className="text-slate-400">Duplicates</p>
                        <p className="font-bold text-sky-700">{parsedValidation.duplicateCount}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleApplyProductsImport}
                      className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2 font-bold text-white shadow-xs hover:bg-emerald-800 transition"
                    >
                      {isProcessing ? "Importing Products..." : `Apply & Import ${parsedValidation.totalRecords} Records`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Import Success Banner */}
          {importSuccessResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <FileCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-emerald-950">
                    Import Completed Successfully at {importSuccessResult.timestamp}
                  </h3>
                  <p className="text-xs text-emerald-700">
                    {importSuccessResult.totalImported} products merged. Your vendor catalog now contains{" "}
                    <strong>{importSuccessResult.catalogTotal}</strong> items.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportSuccessResult(null)}
                className="text-emerald-700 hover:text-emerald-900"
              >
                &times;
              </button>
            </div>
          )}

          {/* Live Preview Table of Current / Imported Products */}
          <div className={PANEL}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {parsedValidation ? "Import File Preview (First 25 Records)" : "Current Vendor Catalog Preview"}
                </h3>
                <p className="text-xs text-slate-500">
                  {parsedValidation ? "Review before finalizing import" : "Click 'Export' above to download this exact catalog"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  Showing {(parsedValidation ? parsedValidation.items : products).slice(0, 25).length} of{" "}
                  {(parsedValidation ? parsedValidation.items : products).length} items
                </span>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Variety</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-right">Stock</th>
                    <th className="py-2.5 px-3">Farmer</th>
                    <th className="py-2.5 px-3">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(parsedValidation ? parsedValidation.items : products).slice(0, 25).map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-2 px-3 font-mono text-[11px] font-semibold text-slate-600">{p.sku}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{p.name}</td>
                      <td className="py-2 px-3">{p.category}</td>
                      <td className="py-2 px-3 text-slate-500">{p.variety || "—"}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">₹{p.price}/{p.unit}</td>
                      <td className="py-2 px-3 text-right font-semibold">{p.stock} {p.unit}</td>
                      <td className="py-2 px-3 text-slate-600">{p.farmerName || "—"}</td>
                      <td className="py-2 px-3">
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          {p.grade || "Grade A"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: SHOP CONFIGURATIONS (IMPORT FROM EXISTING SHOPS / BACKUP) */}
      {/* ============================================================== */}
      {activeTab === "shop-config" && (
        <div className="space-y-6">
          {/* Header Card for Configurations */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Import from Existing Shop */}
            <div className={`lg:col-span-2 ${PANEL}`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <Store className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Import Configurations from Existing Shops</h2>
                    <p className="text-xs text-slate-500">
                      Copy settings from existing shop exports or choose a verified shop preset
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {/* Drag-and-Drop Config File Upload */}
                <div>
                  <label className="text-xs font-bold text-slate-700">Upload Existing Shop File (JSON or XML)</label>
                  <div
                    onClick={() => shopConfigFileInputRef.current?.click()}
                    className="mt-1 cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4 text-center hover:border-emerald-600 hover:bg-emerald-50/30 transition"
                  >
                    <input
                      ref={shopConfigFileInputRef}
                      type="file"
                      accept=".json,.xml,application/json,application/xml,text/xml"
                      onChange={handleShopConfigFileUpload}
                      className="hidden"
                    />
                    <Upload className="mx-auto h-5 w-5 text-emerald-700" />
                    <p className="mt-1 text-xs font-bold text-slate-800">Click to upload shop configuration (.json or .xml)</p>
                    <p className="text-[10px] text-slate-400">Transfers operating hours, notifications, grading, and display rules</p>
                  </div>
                </div>

                {/* Preset Existing Shops */}
                <div>
                  <label className="text-xs font-bold text-slate-700">Or Select from Existing Shop Templates</label>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {EXISTING_SHOP_PRESETS.map((preset) => {
                      const isSelected = selectedPreset?.id === preset.id;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => handleSelectPreset(preset)}
                          className={`cursor-pointer rounded-xl border p-3 transition ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-50/70 shadow-xs"
                              : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/60"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">{preset.name}</h4>
                              <p className="text-[10px] font-semibold text-emerald-700">{preset.shopType}</p>
                            </div>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-500 line-clamp-2">{preset.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Diff Preview before applying */}
                {configDiffPreview && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-emerald-700" />
                        Configuration Comparison Preview
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setConfigDiffPreview(null);
                          setSelectedPreset(null);
                          setImportedShopConfig(null);
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-emerald-200/80 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                            <th className="p-2">Setting</th>
                            <th className="p-2">Current Shop</th>
                            <th className="p-2 text-emerald-700">Imported Shop</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {configDiffPreview.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2 font-medium text-slate-700">{d.key}</td>
                              <td className="p-2 text-slate-500">{String(d.current)}</td>
                              <td className="p-2 font-bold text-emerald-800">{String(d.imported)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyShopConfig}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 font-bold text-xs text-white shadow-xs hover:bg-emerald-800 transition"
                    >
                      <Check className="h-4 w-4" />
                      <span>Confirm & Apply Shop Configuration</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right 1 Col: Export Current Configuration */}
            <div className={PANEL}>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <Settings className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Backup Current Shop</h3>
                  <p className="text-xs text-slate-500">Export settings for migration</p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-xs text-slate-600">
                  Export all your current store preferences, collection hours, display settings, and notification rules into a transferable file.
                </p>

                {/* Format selector */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setConfigExportFormat("json")}
                    className={`rounded-xl border p-2 font-bold transition ${
                      configExportFormat === "json"
                        ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    JSON Spec (.json)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfigExportFormat("xml")}
                    className={`rounded-xl border p-2 font-bold transition ${
                      configExportFormat === "xml"
                        ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    XML Spec (.xml)
                  </button>
                </div>

                {/* Active Store Summary */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Store Name:</span>
                    <strong className="text-slate-800">{vendor?.vendorName || "GreenGrocc Vendor"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Opening Hours:</span>
                    <strong className="text-slate-800">{settings.operations?.collectionCenterOpening || "08:00"} – {settings.operations?.collectionCenterClosing || "20:00"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Driver Auto-Assign:</span>
                    <strong className="text-slate-800">{settings.operations?.autoAssignDrivers ? "Active" : "Manual"}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportShopConfig(configExportFormat)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Configuration ({configExportFormat.toUpperCase()})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: ACTIVITY & IMPORT HISTORY LOG                           */}
      {/* ============================================================== */}
      {activeTab === "history" && (
        <div className={PANEL}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <History className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Export & Import Activity History</h3>
                <p className="text-xs text-slate-500">Log of recent files processed directly in your browser</p>
              </div>
            </div>

            {historyLogs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearImportHistory();
                  setHistoryLogs([]);
                  toast.success("History log cleared.");
                }}
                className="flex items-center gap-1 text-xs text-red-600 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          <div className="mt-4">
            {historyLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <History className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-semibold">No recent export or import activity recorded.</p>
                <p className="text-[11px] text-slate-400">Perform a CSV/XML product export or import to see entries here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-2.5">Date & Time</th>
                      <th className="p-2.5">Operation</th>
                      <th className="p-2.5">Entity</th>
                      <th className="p-2.5">Format</th>
                      <th className="p-2.5">File / Source</th>
                      <th className="p-2.5 text-right">Records</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {historyLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-500">
                          {new Date(log.timestamp).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              log.type === "export"
                                ? "bg-sky-50 text-sky-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {log.type}
                          </span>
                        </td>
                        <td className="p-2.5 capitalize">{log.entity?.replace("_", " ")}</td>
                        <td className="p-2.5 font-mono text-[11px]">{log.format}</td>
                        <td className="p-2.5 font-medium truncate max-w-xs">{log.fileName}</td>
                        <td className="p-2.5 text-right font-bold">{log.recordCount}</td>
                        <td className="p-2.5 text-right">
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            {log.status || "Completed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
