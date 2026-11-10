import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Lock,
  Mail,
  Moon,
  Palmtree,
  Phone,
  Power,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
  X,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  EXCEL_BTN,
  EXCEL_BTN_PRIMARY,
  EXCEL_INPUT,
  EXCEL_PAGE_SUB,
  EXCEL_PAGE_TITLE,
  EXCEL_PANEL,
  EXCEL_PANEL_HEAD,
  EXCEL_SELECT,
} from "../../utils/excelStyles";

const VACATION_REASONS = [
  "Annual Vacation / Holiday",
  "Farm Maintenance & Infrastructure Work",
  "Seasonal Crop Transition & Replenishment",
  "Personal & Family Emergency",
  "Festive Season Closure (Diwali / Holi / New Year)",
  "Inventory Audit & Dark Store Overhaul",
  "Temporary Weather / Transportation Disruption",
];

const QUICK_DURATIONS = [
  { label: "3 Days", days: 3 },
  { label: "1 Week", days: 7 },
  { label: "10 Days", days: 10 },
  { label: "2 Weeks", days: 14 },
  { label: "1 Month", days: 30 },
];

const PRESET_MESSAGES = {
  standard:
    "We are currently on vacation! Store operations and fresh harvests will resume upon our return. You can still browse our farm catalog, and orders will be processed promptly on our reopening date.",
  maintenance:
    "Our farm and collection facility is undergoing scheduled maintenance to upgrade sorting and cooling systems. All pending dispatch will resume immediately after.",
  festival:
    "Wishing all our valued customers a joyful festive season! Our farm operations are taking a short holiday break. We look forward to serving you fresh harvest very soon.",
};

export default function VendorVacationPage() {
  const { vendor } = useVendorAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [form, setForm] = useState({
    enabled: false,
    startDate: new Date().toISOString().slice(0, 10),
    returnDate: "",
    reason: VACATION_REASONS[0],
    noticeMessage: PRESET_MESSAGES.standard,
    offlineMode: "browse_only", // "full_offline" | "browse_only"
    autoReopen: true,
    emergencyPhone: "",
    emergencyEmail: "",
  });

  const loadVacation = async () => {
    setLoading(true);
    try {
      const res = await vendorApi.getVacation();
      if (res?.vacation) {
        setForm({
          enabled: Boolean(res.vacation.enabled),
          startDate: res.vacation.startDate || new Date().toISOString().slice(0, 10),
          returnDate: res.vacation.returnDate || "",
          reason: res.vacation.reason || VACATION_REASONS[0],
          noticeMessage: res.vacation.noticeMessage || PRESET_MESSAGES.standard,
          offlineMode: res.vacation.offlineMode || "browse_only",
          autoReopen: res.vacation.autoReopen !== undefined ? Boolean(res.vacation.autoReopen) : true,
          emergencyPhone: res.vacation.emergencyPhone || "",
          emergencyEmail: res.vacation.emergencyEmail || "",
        });
      }
    } catch {
      // Keep default values if fresh
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVacation();
  }, []);

  const handleQuickDuration = (days) => {
    const start = form.startDate ? new Date(form.startDate) : new Date();
    const target = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setForm((prev) => ({
      ...prev,
      returnDate: target.toISOString().slice(0, 10),
    }));
  };

  const handleSave = async (overrideEnabled = null) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        enabled: overrideEnabled !== null ? overrideEnabled : form.enabled,
      };

      if (payload.enabled && !payload.returnDate) {
        toast.error("Please specify an estimated return date for vacation mode.");
        setSaving(false);
        return;
      }

      const res = await vendorApi.updateVacation(payload);
      setForm((prev) => ({
        ...prev,
        enabled: payload.enabled,
      }));
      toast.success(res?.message || (payload.enabled ? "Vacation mode activated" : "Store is now online"));
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update vacation settings");
    } finally {
      setSaving(false);
    }
  };

  const storeName = vendor?.businessName || vendor?.vendorName || "GreenGrocc Vendor Partner";

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-7 w-7 animate-spin text-[#217346]" />
          <p className="text-sm font-medium text-slate-500">Loading vacation configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-slate-400">
            <Link to="/dashboard" className="hover:text-emerald-700">Vendor Portal</Link>
            <span className="mx-1.5">/</span>
            <span className="font-semibold text-slate-600">Store Vacation</span>
          </nav>
          <div className="flex items-center gap-2.5">
            <h1 className={EXCEL_PAGE_TITLE}>Vendor Vacation & Offline Mode</h1>
            {form.enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 animate-pulse">
                <Palmtree className="h-3.5 w-3.5 text-amber-600" />
                Vacation Mode Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Store Live & Open
              </span>
            )}
          </div>
          <p className={`mt-0.5 ${EXCEL_PAGE_SUB}`}>
            Take your store and products offline temporarily while on vacation or closed. Manage customer notices and auto-resumption.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className={`${EXCEL_BTN} gap-1.5 text-xs`}
            title="Preview how customer sees store notice"
          >
            <Eye className="h-3.5 w-3.5 text-slate-600" />
            <span>Storefront Preview</span>
          </button>

          {form.enabled ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
            >
              <Power className="h-3.5 w-3.5" />
              <span>Resume Store Now</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600 bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700"
            >
              <Palmtree className="h-3.5 w-3.5" />
              <span>Activate Vacation</span>
            </button>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className={`${EXCEL_BTN_PRIMARY} gap-1.5 text-xs`}
          >
            <Save className={`h-3.5 w-3.5 ${saving ? "animate-spin" : ""}`} />
            <span>{saving ? "Saving…" : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* Main Status Hero Card */}
      <div
        className={`overflow-hidden rounded-2xl border transition-all ${
          form.enabled
            ? "border-amber-300 bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-white shadow-sm"
            : "border-slate-200 bg-white shadow-xs"
        }`}
      >
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-xs ${
                  form.enabled
                    ? "bg-amber-500 text-white shadow-amber-200"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {form.enabled ? <Palmtree className="h-6 w-6" /> : <Store className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                  {form.enabled ? "Vacation Mode is Currently Active" : "Store is Online and Accepting Orders"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
                  {form.enabled ? (
                    <>
                      Your store is temporarily offline until{" "}
                      <strong className="font-semibold text-amber-900">
                        {form.returnDate || "your specified return date"}
                      </strong>
                      . Mode:{" "}
                      <span className="font-medium underline">
                        {form.offlineMode === "full_offline" ? "Full Catalog Hidden" : "Browsing with Vacation Notice"}
                      </span>
                      .
                    </>
                  ) : (
                    "Your products are active in the customer app, search results, and dark store inventory. Click below to plan a vacation break."
                  )}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-xs font-semibold text-slate-700">
                {form.enabled ? "Vacation Active" : "Vacation Off"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.enabled}
                onClick={() => setForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  form.enabled ? "bg-amber-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    form.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Vacation Configuration Panel */}
      <div className={EXCEL_PANEL}>
        <div className={EXCEL_PANEL_HEAD}>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-700" />
            <span>1. Vacation Schedule & Timing</span>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Vacation Start Date *
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                className={EXCEL_INPUT}
              />
              <span className="mt-1 block text-[10px] text-slate-400">Date from which store operations halt</span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Return & Reopening Date *
              </label>
              <input
                type="date"
                value={form.returnDate}
                min={form.startDate || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm((prev) => ({ ...prev, returnDate: e.target.value }))}
                className={`${EXCEL_INPUT} border-emerald-300 font-semibold text-emerald-900 focus:border-emerald-600`}
              />
              <span className="mt-1 block text-[10px] text-slate-400">Date when fulfillment and deliveries resume</span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Vacation Reason / Type
              </label>
              <select
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                className={EXCEL_SELECT}
              >
                {VACATION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[10px] text-slate-400">Internal & customer record classification</span>
            </div>
          </div>

          {/* Quick Preset Durations */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-slate-500">Quick Duration:</span>
            {QUICK_DURATIONS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleQuickDuration(preset.days)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800"
              >
                +{preset.label}
              </button>
            ))}
          </div>

          {/* Auto Re-open Switch */}
          <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div>
              <p className="text-xs font-bold text-slate-800">Auto-Reactivate Store on Return Date</p>
              <p className="text-[11px] text-slate-500">
                When the clock strikes 00:00 on your Return Date, vacation mode will automatically deactivate and orders will resume without manual login.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.autoReopen}
              onClick={() => setForm((prev) => ({ ...prev, autoReopen: !prev.autoReopen }))}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                form.autoReopen ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  form.autoReopen ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Offline Mode Selection Panel */}
      <div className={EXCEL_PANEL}>
        <div className={EXCEL_PANEL_HEAD}>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-emerald-700" />
            <span>2. Offline Catalog Behavior</span>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <p className="mb-3 text-xs text-slate-500">
            Choose how your products behave in the customer marketplace while vacation mode is active:
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Mode A: Browse Only */}
            <div
              onClick={() => setForm((prev) => ({ ...prev, offlineMode: "browse_only" }))}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                form.offlineMode === "browse_only"
                  ? "border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    <Eye className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 sm:text-sm">
                    Catalog Browsing Active (Recommended)
                  </h3>
                </div>
                <input
                  type="radio"
                  name="offlineMode"
                  checked={form.offlineMode === "browse_only"}
                  onChange={() => {}}
                  className="h-4 w-4 text-emerald-600"
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Customers can still see your farm store, explore varieties, and add items to wishlist or future pre-orders. A prominent vacation banner informs them that shipment begins upon your return date.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Preserves SEO rankings & customer discovery</span>
              </div>
            </div>

            {/* Mode B: Full Offline */}
            <div
              onClick={() => setForm((prev) => ({ ...prev, offlineMode: "full_offline" }))}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                form.offlineMode === "full_offline"
                  ? "border-amber-600 bg-amber-50/40 ring-1 ring-amber-600"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                    <Lock className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 sm:text-sm">
                    Complete Store Offline (Full Shutdown)
                  </h3>
                </div>
                <input
                  type="radio"
                  name="offlineMode"
                  checked={form.offlineMode === "full_offline"}
                  onChange={() => {}}
                  className="h-4 w-4 text-amber-600"
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                All products are temporarily hidden from search listings, cart checkouts are blocked, and visiting the store URL displays a "Store Temporarily Closed for Vacation" page.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Strict zero-order placement policy</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Announcement Notice Panel */}
      <div className={EXCEL_PANEL}>
        <div className={EXCEL_PANEL_HEAD}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-700" />
            <span>3. Customer Vacation Announcement Banner</span>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Custom Storefront Announcement Message *
              </label>
              <span className="text-[10px] text-slate-400">
                {form.noticeMessage.length} characters (Recommended: 80–250)
              </span>
            </div>
            <textarea
              rows={3}
              value={form.noticeMessage}
              onChange={(e) => setForm((prev) => ({ ...prev, noticeMessage: e.target.value }))}
              placeholder="Write a friendly note to your customers informing them about the closure..."
              className={`${EXCEL_INPUT} resize-none leading-relaxed`}
            />
          </div>

          {/* Quick preset message buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Insert Template:</span>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, noticeMessage: PRESET_MESSAGES.standard }))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
            >
              Standard Holiday
            </button>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, noticeMessage: PRESET_MESSAGES.maintenance }))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
            >
              Farm Maintenance
            </button>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, noticeMessage: PRESET_MESSAGES.festival }))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
            >
              Festive Greeting
            </button>
          </div>

          {/* Live Preview Box of the Customer Banner */}
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Live Customer Storefront Banner Preview:
            </p>
            <div className="overflow-hidden rounded-xl border border-amber-300 bg-gradient-to-r from-amber-500 to-amber-600 p-3.5 text-white shadow-sm sm:p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-xs">
                  <Palmtree className="h-4.5 w-4.5 text-white" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-100 sm:text-sm">
                      {storeName} — On Vacation Break
                    </p>
                    {form.returnDate ? (
                      <span className="rounded bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Reopening: {form.returnDate}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-amber-50">
                    {form.noticeMessage || "We are currently on vacation break."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Contact Information (Optional) */}
      <div className={EXCEL_PANEL}>
        <div className={EXCEL_PANEL_HEAD}>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-emerald-700" />
            <span>4. Emergency Wholesale Support (Optional)</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Emergency Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                value={form.emergencyPhone}
                onChange={(e) => setForm((prev) => ({ ...prev, emergencyPhone: e.target.value }))}
                placeholder="e.g. +91 98765 43210"
                className={`${EXCEL_INPUT} pl-9`}
              />
            </div>
            <span className="mt-1 block text-[10px] text-slate-400">
              Displayed only to B2B dark store managers for critical batch coordination
            </span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Emergency Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={form.emergencyEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, emergencyEmail: e.target.value }))}
                placeholder="e.g. operations@farmfresh.com"
                className={`${EXCEL_INPUT} pl-9`}
              />
            </div>
            <span className="mt-1 block text-[10px] text-slate-400">
              Emergency alerts will be routed here while the office is closed
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Save & Activate Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Info className="h-4 w-4 text-emerald-700" />
          <span>
            Changes to vacation status update your storefront and marketplace catalog instantly.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {form.enabled ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Turn Off Vacation
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="rounded-lg border border-amber-600 bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700"
            >
              Turn On Vacation
            </button>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className={`${EXCEL_BTN_PRIMARY} px-5 py-2 text-xs font-bold`}
          >
            <Save className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
            <span>{saving ? "Saving Changes…" : "Save All Settings"}</span>
          </button>
        </div>
      </div>

      {/* Customer Storefront Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <Store className="h-4.5 w-4.5 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Customer Storefront View Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Realistic Mock Store Page */}
            <div className="max-h-[75vh] overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Store Page Hero */}
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold">
                    {storeName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold sm:text-lg">{storeName}</h4>
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <ShieldCheck className="h-3 w-3" /> Verified Partner
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">Direct Farm Fresh Produce • 4.8 ★★★★★ (48 Reviews)</p>
                  </div>
                </div>
              </div>

              {/* Vacation Banner in Store */}
              <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-500 to-amber-600 p-4 text-white shadow-sm">
                <div className="flex items-start gap-3">
                  <Palmtree className="h-6 w-6 shrink-0 text-amber-100" />
                  <div>
                    <h5 className="text-sm font-bold uppercase tracking-wider text-amber-100">
                      Store Notice — Currently On Vacation Break
                    </h5>
                    <p className="mt-1 text-xs leading-relaxed text-amber-50">
                      {form.noticeMessage}
                    </p>
                    <p className="mt-2 text-[11px] font-bold text-white bg-black/20 inline-block px-2.5 py-1 rounded">
                      Expected Return & Order Fulfillment Date: {form.returnDate || "Coming Soon"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mock Product Catalog view */}
              <div>
                <p className="mb-2 text-xs font-bold text-slate-700">Store Products (Customer Perspective):</p>
                {form.offlineMode === "full_offline" ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    <Lock className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-2 text-xs font-semibold text-slate-700">
                      Product Catalog is Hidden
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Products will be revealed automatically on {form.returnDate || "reopening"}.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {["Hybrid Tomato 1kg", "Nashik Red Onion 5kg", "Fresh Palak Bunch"].map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                        <div className="h-20 rounded-lg bg-slate-100 flex items-center justify-center text-2xl">
                          {idx === 0 ? "🍅" : idx === 1 ? "🧅" : "🥬"}
                        </div>
                        <p className="mt-2 text-xs font-bold text-slate-800">{item}</p>
                        <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                          Dispatches on {form.returnDate || "Reopening"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
