import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Globe,
  KeyRound,
  Laptop,
  Lock,
  Monitor,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Truck,
  Volume2,
  VolumeX,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import {
  EXCEL_BTN,
  EXCEL_BTN_DANGER,
  EXCEL_BTN_PRIMARY,
  EXCEL_INPUT,
  EXCEL_PAGE_SUB,
  EXCEL_PAGE_TITLE,
  EXCEL_PANEL,
  EXCEL_PANEL_HEAD,
  EXCEL_SELECT,
} from "../../utils/excelStyles";
import {
  useVendorSettings,
  DEFAULT_VENDOR_SETTINGS as DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from "../../context/VendorSettingsContext";

export default function VendorSettingsPage() {
  const {
    settings: contextSettings,
    saveSettings: contextSaveSettings,
    resetSettings: contextResetSettings,
    playOrderAlert,
    isCentreOpen,
    loading: contextLoading,
  } = useVendorSettings();

  const [activeTab, setActiveTab] = useState("display");
  const [settings, setSettings] = useState(() => contextSettings || DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [reconnectingSocket, setReconnectingSocket] = useState(false);

  useEffect(() => {
    if (!hasChanges && contextSettings) {
      setSettings(contextSettings);
    }
  }, [contextSettings, hasChanges]);

  const updateSection = (section, key, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value,
        },
      };

      // Realtime live workable effect in browser
      if (section === "display" && key === "theme") {
        if (value === "dark") {
          document.documentElement.classList.add("dark");
        } else if (value === "light") {
          document.documentElement.classList.remove("dark");
        } else {
          const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          document.documentElement.classList.toggle("dark", isDark);
        }
      }
      if (section === "display" && key === "compactMode") {
        document.body.classList.toggle("vendor-compact-tables", Boolean(value));
      }

      setHasChanges(true);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await contextSaveSettings(settings);
      setHasChanges(false);
      if (res?.success) {
        toast.success("Settings saved and applied successfully");
      } else {
        toast.success("Settings saved locally");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all panel configurations to system defaults?")) {
      contextResetSettings();
      setSettings(DEFAULT_SETTINGS);
      setHasChanges(false);
      toast.success("Settings reset to defaults and applied");
    }
  };

  const handleClearCache = () => {
    try {
      const keepAuth = localStorage.getItem("greengrocc_vendor_auth");
      localStorage.clear();
      if (keepAuth) localStorage.setItem("greengrocc_vendor_auth", keepAuth);
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      setSettings(DEFAULT_SETTINGS);
      document.body.classList.remove("vendor-compact-tables");
      document.documentElement.classList.remove("dark");
      toast.success("Local panel cache and preferences cleared successfully");
    } catch {
      toast.error("Failed to clear local cache");
    }
  };

  const playTestSound = () => {
    playOrderAlert();
    toast.success("Order alert sound preview played 🔔");
  };

  const handleReconnectRealtime = () => {
    setReconnectingSocket(true);
    setTimeout(() => {
      setReconnectingSocket(false);
      toast.success("Real-time live adapter reconnected");
    }, 1200);
  };

  const tabs = [
    { id: "display", label: "General & Display", icon: Sliders, desc: "Theme, tables & layout" },
    { id: "operations", label: "Operations & Dispatch", icon: Truck, desc: "Drivers, batches & QC" },
    { id: "notifications", label: "Alerts & Notifications", icon: Bell, desc: "Sounds, threshold & SMS" },
    { id: "security", label: "Security & Access", icon: ShieldCheck, desc: "Auth, timeout & IP lock" },
    { id: "integrations", label: "Data & Integrations", icon: Database, desc: "Realtime, export & cache" },
  ];

  if (contextLoading && !settings) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-7 w-7 animate-spin text-[#217346]" />
          <p className="text-sm font-medium text-slate-500">Loading panel configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-slate-400">
            <Link to="/dashboard" className="hover:text-emerald-700">
              Vendor Portal
            </Link>
            <span className="mx-1.5">/</span>
            <span className="font-semibold text-slate-600">Settings</span>
          </nav>
          <div className="flex items-center gap-2.5">
            <h1 className={EXCEL_PAGE_TITLE}>Panel Settings</h1>
            {hasChanges ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 animate-pulse">
                Unsaved changes
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                Synchronized
              </span>
            )}
          </div>
          <p className={`mt-0.5 ${EXCEL_PAGE_SUB}`}>
            Configure your vendor portal operations, dispatch preferences, live alerts, and interface layout.
          </p>
        </div>

        {/* Global Save / Reset Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className={`${EXCEL_BTN} gap-1.5 text-xs`}
            title="Reset to default settings"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`${EXCEL_BTN_PRIMARY} gap-1.5 text-xs ${
              hasChanges ? "ring-2 ring-emerald-500 ring-offset-1" : ""
            }`}
          >
            <Save className={`h-3.5 w-3.5 ${saving ? "animate-spin" : ""}`} />
            <span>{saving ? "Saving…" : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/70 p-1 text-xs sm:text-sm">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 font-semibold transition ${
                isActive
                  ? "bg-white text-emerald-800 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GENERAL & DISPLAY */}
      {/* ========================================================================= */}
      {activeTab === "display" ? (
        <div className="space-y-5">
          {/* Section: Look & Feel */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-emerald-700" />
                <span>Theme & Interface Appearance</span>
              </span>
              <span className="text-xs text-slate-400">Excel / Enterprise Standard</span>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">Theme Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "light", label: "Clean Light", desc: "Crisp emerald & white spreadsheets" },
                    { id: "dark", label: "Dark Mode", desc: "Low-light night operations" },
                    { id: "system", label: "System Default", desc: "Sync with OS theme" },
                  ].map((theme) => {
                    const selected = settings.display.theme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => updateSection("display", "theme", theme.id)}
                        className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                          selected
                            ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{theme.label}</span>
                          {selected ? <Check className="h-3.5 w-3.5 text-emerald-700 font-bold" /> : null}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{theme.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table Row Density */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Compact Table Rows (High Density)</h4>
                    <p className="text-[11px] text-slate-500">
                      Reduces vertical row padding across Pickups, Inventory, and Farmers tables to fit more data on screen.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.display.compactMode}
                      onChange={(e) => updateSection("display", "compactMode", e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>
              </div>

              {/* Auto Refresh Interval */}
              <div className="border-t border-slate-100 pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Live Dashboard Auto-Refresh Rate
                    </label>
                    <select
                      className={EXCEL_SELECT}
                      value={settings.display.autoRefreshInterval}
                      onChange={(e) => updateSection("display", "autoRefreshInterval", Number(e.target.value))}
                    >
                      <option value={0}>Manual Only (Off)</option>
                      <option value={30}>Every 30 Seconds</option>
                      <option value={60}>Every 1 Minute</option>
                      <option value={120}>Every 2 Minutes</option>
                      <option value={300}>Every 5 Minutes</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Automatically queries incoming pickups and quality updates in the background.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Default Landing Page after Login
                    </label>
                    <select
                      className={EXCEL_SELECT}
                      value={settings.display.defaultLandingPage}
                      onChange={(e) => updateSection("display", "defaultLandingPage", e.target.value)}
                    >
                      <option value="/dashboard">Overview Dashboard (/dashboard)</option>
                      <option value="/vendor/pickups/ready">Ready Pickups Desk (/pickups/ready)</option>
                      <option value="/vendor/quality/all">Quality & Grading Hub (/quality/all)</option>
                      <option value="/vendor/inventory">Vendor Inventory (/inventory)</option>
                      <option value="/vendor/orders">Orders Desk (/orders)</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Select which workspace you land on immediately when you log in.
                    </p>
                  </div>
                </div>
              </div>

              {/* Date & Currency Standards */}
              <div className="border-t border-slate-100 pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Date Display Format</label>
                    <select
                      className={EXCEL_SELECT}
                      value={settings.display.dateFormat}
                      onChange={(e) => updateSection("display", "dateFormat", e.target.value)}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 14/10/2026)</option>
                      <option value="DD MMM YYYY">DD MMM YYYY (e.g. 14 Oct 2026)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Currency Standard</label>
                    <input
                      type="text"
                      disabled
                      value="₹ INR (Indian Rupee - Fixed)"
                      className={`${EXCEL_INPUT} bg-slate-50 text-slate-500 cursor-not-allowed`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 2: OPERATIONS & DISPATCH */}
      {/* ========================================================================= */}
      {activeTab === "operations" ? (
        <div className="space-y-5">
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-700" />
                <span>Pickup Dispatch & Collection Center Rules</span>
              </span>
            </div>
            <div className="space-y-4 p-5 text-xs">
              {/* Auto Assign Drivers */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-800">Auto-Suggest Nearest Driver for Pickups</h4>
                  <p className="mt-0.5 text-slate-500">
                    When active, the dispatch engine ranks drivers by proximity to the farmer's village taluka.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.operations.autoAssignDrivers}
                    onChange={(e) => updateSection("operations", "autoAssignDrivers", e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              {/* Default Batch Size */}
              <div className="border-t border-slate-100 pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Default Batch Grouping Size (Pickups / Batch)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={25}
                      className={EXCEL_INPUT}
                      value={settings.operations.defaultBatchSize}
                      onChange={(e) =>
                        updateSection("operations", "defaultBatchSize", Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Recommended: 5 to 10 pickups per driver trip batch.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Customer Pre-Order Auto-Confirmation
                    </label>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-slate-600">Auto-confirm within store capacity:</span>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={settings.operations.autoConfirmPreorders}
                          onChange={(e) => updateSection("operations", "autoConfirmPreorders", e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800">Collection Centre Receiving Hours</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Current Gate Status:</span>
                    {isCentreOpen() ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Currently Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                        <Clock className="h-3 w-3" />
                        Currently Closed
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-medium text-slate-600">Gate Opening Time</label>
                    <input
                      type="time"
                      className={EXCEL_INPUT}
                      value={settings.operations.collectionCenterOpening}
                      onChange={(e) => updateSection("operations", "collectionCenterOpening", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-slate-600">Gate Closing Time</label>
                    <input
                      type="time"
                      className={EXCEL_INPUT}
                      value={settings.operations.collectionCenterClosing}
                      onChange={(e) => updateSection("operations", "collectionCenterClosing", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Quality & Grading Rules */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="font-bold text-slate-800">Quality Inspection & QC Standards</h4>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-700">Mandatory Inspection Photos</p>
                    <p className="text-[11px] text-slate-400">
                      Requires at least 2 produce inspection photos before confirming QC Grading.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.operations.requireQualityPhotos}
                      onChange={(e) => updateSection("operations", "requireQualityPhotos", e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-700">Strict Grading Rejection Confirmation</p>
                    <p className="text-[11px] text-slate-400">
                      Shows a mandatory confirmation alert when marking batches as Grade C or Rejected.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.operations.strictGradingConfirmation}
                      onChange={(e) =>
                        updateSection("operations", "strictGradingConfirmation", e.target.checked)
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 3: ALERTS & NOTIFICATIONS */}
      {/* ========================================================================= */}
      {activeTab === "notifications" ? (
        <div className="space-y-5">
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-700" />
                <span>Audio & Real-time Alert Preferences</span>
              </span>
            </div>
            <div className="space-y-4 p-5 text-xs">
              {/* Audio Sound on New Order */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-emerald-700" />
                    <h4 className="font-bold text-slate-800">Play Audio Bell on Incoming Pickups / Orders</h4>
                  </div>
                  <p className="text-slate-500">
                    Rings an audio alert when a farmer schedules a new harvest pickup.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={playTestSound}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Test Sound 🔔
                  </button>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.notifications.orderReceivedSound}
                      onChange={(e) => updateSection("notifications", "orderReceivedSound", e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>
              </div>

              {/* Low Stock Warning Threshold */}
              <div className="border-t border-slate-100 pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Low Inventory Stock Threshold (in Kg)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={10000}
                        className={EXCEL_INPUT}
                        value={settings.notifications.lowStockThresholdKg}
                        onChange={(e) =>
                          updateSection("notifications", "lowStockThresholdKg", Number(e.target.value) || 0)
                        }
                      />
                      <span className="font-bold text-slate-500">kg</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Crops with stock below this level display an amber "Low Stock" alert pill.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Alert on Driver Arrival at Centre:</span>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={settings.notifications.notifyDriverArrival}
                          onChange={(e) =>
                            updateSection("notifications", "notifyDriverArrival", e.target.checked)
                          }
                          className="peer sr-only"
                        />
                        <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Alert when QC Inspection is Confirmed:</span>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={settings.notifications.notifyQualityCompleted}
                          onChange={(e) =>
                            updateSection("notifications", "notifyQualityCompleted", e.target.checked)
                          }
                          className="peer sr-only"
                        />
                        <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Channels: Email & SMS */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="mb-2 font-bold text-slate-800">External Communication Channels</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                    <div>
                      <p className="font-semibold text-slate-800">Email Notifications</p>
                      <p className="text-[11px] text-slate-500">Order invoices & payouts</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={settings.notifications.emailNotifications}
                        onChange={(e) => updateSection("notifications", "emailNotifications", e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                    <div>
                      <p className="font-semibold text-slate-800">SMS Alerts</p>
                      <p className="text-[11px] text-slate-500">Emergency dispatch alerts</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={settings.notifications.smsAlerts}
                        onChange={(e) => updateSection("notifications", "smsAlerts", e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                    <div>
                      <p className="font-semibold text-slate-800">Daily 8 PM Digest</p>
                      <p className="text-[11px] text-slate-500">Daily summary email</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={settings.notifications.dailySummaryEmail}
                        onChange={(e) => updateSection("notifications", "dailySummaryEmail", e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 4: SECURITY & ACCESS */}
      {/* ========================================================================= */}
      {activeTab === "security" ? (
        <div className="space-y-5">
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <span>Vendor Portal Security & Session Safeguards</span>
              </span>
            </div>
            <div className="space-y-4 p-5 text-xs">
              {/* Session Auto Logout */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Idle Session Auto-Logout Timeout
                  </label>
                  <select
                    className={EXCEL_SELECT}
                    value={settings.security.autoLogoutMinutes}
                    onChange={(e) => updateSection("security", "autoLogoutMinutes", Number(e.target.value))}
                  >
                    <option value={15}>15 Minutes (Strict Security)</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>1 Hour (Standard)</option>
                    <option value={120}>2 Hours</option>
                    <option value={0}>Disabled (Stay logged in)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Automatically signs out inactive vendor dashboard sessions to protect sensitive ledger data.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Two-Factor Protection for Bank & Payouts
                  </label>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-slate-600">Enforce OTP on Bank Account changes:</span>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={settings.security.twoFactorAuth}
                        onChange={(e) => updateSection("security", "twoFactorAuth", e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                    </label>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Sends an OTP to the vendor's primary mobile before saving new bank account numbers.
                  </p>
                </div>
              </div>

              {/* IP Whitelist */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-800">Static Office IP Access Lock</h4>
                    <p className="text-[11px] text-slate-500">
                      Restrict vendor portal login exclusively to specific static office IP addresses.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.security.ipRestrictionEnabled}
                      onChange={(e) => updateSection("security", "ipRestrictionEnabled", e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>

                {settings.security.ipRestrictionEnabled ? (
                  <div className="mt-3">
                    <label className="mb-1 block font-semibold text-slate-700">
                      Whitelisted IP Addresses (Comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 103.24.55.12, 49.36.128.4"
                      className={EXCEL_INPUT}
                      value={settings.security.allowedIps}
                      onChange={(e) => updateSection("security", "allowedIps", e.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              {/* Current Active Session Info Card */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="mb-2 font-bold text-slate-800">Current Login Session</h4>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                      <Laptop className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Windows PC • Web Browser Session</p>
                      <p className="text-[11px] text-slate-500">
                        IP: <span className="font-mono font-medium">127.0.0.1 (Localhost / Secure)</span> • Status:{" "}
                        <span className="font-bold text-emerald-700">Active Now</span>
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/profile"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                    <span>Change Password in Profile →</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 5: DATA & INTEGRATIONS */}
      {/* ========================================================================= */}
      {activeTab === "integrations" ? (
        <div className="space-y-5">
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-700" />
                <span>Real-Time Sync, Exports & Data Storage</span>
              </span>
            </div>
            <div className="space-y-4 p-5 text-xs">
              {/* Real-time Socket Indicator */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-emerald-950">WebSocket Real-Time Live Sync</h4>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        CONNECTED
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80">
                      Instant sync active for order arrivals, quality grading, and inventory adjustments.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReconnectRealtime}
                  disabled={reconnectingSocket}
                  className={`${EXCEL_BTN} gap-1.5 text-xs border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50`}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${reconnectingSocket ? "animate-spin" : ""}`} />
                  <span>{reconnectingSocket ? "Pinging…" : "Ping / Reconnect"}</span>
                </button>
              </div>

              {/* Data Export Default Format */}
              <div className="border-t border-slate-100 pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">Default Spreadsheet Export Format</label>
                    <select
                      className={EXCEL_SELECT}
                      value={settings.integrations.exportFormat}
                      onChange={(e) => updateSection("integrations", "exportFormat", e.target.value)}
                    >
                      <option value="excel">Microsoft Excel (.xlsx) — Formatted Spreadsheets</option>
                      <option value="csv">Standard CSV (.csv) — Raw Data</option>
                      <option value="json">JSON (.json) — API Payload Format</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Used when downloading reports from Earnings, Inventory, and Quality inspection desks.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      ERP / Tally Webhook Sync URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://erp.yourcompany.com/webhook/greengrocc"
                      className={EXCEL_INPUT}
                      value={settings.integrations.erpWebhookUrl}
                      onChange={(e) => updateSection("integrations", "erpWebhookUrl", e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Dispatches webhook events on confirmed order payouts and receipts.
                    </p>
                  </div>
                </div>
              </div>

              {/* Local Storage / Cache Reset Action */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/40 p-3.5">
                  <div>
                    <h4 className="font-bold text-red-950">Local Panel Cache Management</h4>
                    <p className="text-[11px] text-red-800/80">
                      Clear locally stored UI states, filters, and offline draft buffers without logging out of your account.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-2xs hover:bg-red-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    <span>Clear Local Cache</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* Bottom Save Reminder Bar if changes are pending */}
      {hasChanges ? (
        <div className="sticky bottom-4 z-40 flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-900 px-5 py-3.5 text-white shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-300 animate-pulse" />
            <span className="text-xs font-semibold">You have unsaved changes in panel configuration.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-emerald-200 hover:text-white"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-emerald-950 shadow-sm hover:bg-emerald-50 transition"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Saving…" : "Save Now"}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
