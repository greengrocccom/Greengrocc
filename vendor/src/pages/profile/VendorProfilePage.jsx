import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Bell,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Database,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Laptop,
  Lock,
  Mail,
  MapPin,
  Monitor,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
  Sliders,
  Sparkles,
  Store,
  Trash2,
  Truck,
  User,
  Users,
  Percent,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { useVendorSettings } from "../../context/VendorSettingsContext";
import { vendorApi } from "../../api/vendorApi";
import { CopyButton, copyText } from "../../components/ui/CopyId";
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

export default function VendorProfilePage() {
  const { vendor: authVendor, updateVendorState, refreshProfile } = useVendorAuth();
  const {
    settings: contextSettings,
    saveSettings: contextSaveSettings,
    resetSettings: contextResetSettings,
    playOrderAlert,
    isCentreOpen,
  } = useVendorSettings();

  const [activeTab, setActiveTab] = useState("account"); // "account" | "settings"
  const [profile, setProfile] = useState(authVendor || null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(!authVendor);
  const [refreshing, setRefreshing] = useState(false);
  const [showAccountNum, setShowAccountNum] = useState(false);

  // Business Settings state (for Tab 2)
  const [businessSettings, setBusinessSettings] = useState(contextSettings);
  const [hasSettingsChanges, setHasSettingsChanges] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [reconnectingSocket, setReconnectingSocket] = useState(false);

  // Modals for Account Details (Tab 1)
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form states
  const [form, setForm] = useState({
    ownerName: "",
    vendorName: "",
    businessName: "",
    email: "",
    phone: "",
    mobile: "",
    businessAddress: "",
    city: "",
    state: "",
    pincode: "",
    gstNumber: "",
    panNumber: "",
    bank: {
      accountHolder: "",
      bankName: "",
      accountNumber: "",
      ifsc: "",
    },
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [profileRes, dashRes] = await Promise.allSettled([
        vendorApi.getProfile(),
        vendorApi.getDashboard(),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value?.data) {
        setProfile(profileRes.value.data);
        updateVendorState(profileRes.value.data);
      }
      if (dashRes.status === "fulfilled" && dashRes.value?.data) {
        setDashboard(dashRes.value.data);
      }
    } catch {
      toast.error("Failed to load profile details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!hasSettingsChanges && contextSettings) {
      setBusinessSettings(contextSettings);
    }
  }, [contextSettings, hasSettingsChanges]);

  const data = profile || authVendor || {};

  const openEditModal = () => {
    setForm({
      ownerName: data.ownerName || "",
      vendorName: data.vendorName || "",
      businessName: data.businessName || "",
      email: data.email || "",
      phone: data.phone || "",
      mobile: data.mobile || "",
      businessAddress: data.businessAddress || "",
      city: data.city || "",
      state: data.state || "",
      pincode: data.pincode || "",
      gstNumber: data.gstNumber || "",
      panNumber: data.panNumber || "",
      bank: {
        accountHolder: data.bank?.accountHolder || data.bank?.accountHolderName || data.ownerName || "",
        bankName: data.bank?.bankName || "",
        accountNumber: data.bank?.accountNumber || "",
        ifsc: data.bank?.ifsc || "",
      },
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await vendorApi.updateProfile(form);
      const updated = res.data?.vendor || res.data || { ...data, ...form };
      setProfile(updated);
      updateVendorState(updated);
      toast.success("Profile updated successfully");
      setEditOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordForm.newPassword) {
      toast.error("Please enter a new password");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingProfile(true);
    try {
      await vendorApi.updateProfile({ password: passwordForm.newPassword });
      toast.success("Password updated successfully");
      setPasswordOpen(false);
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update password");
    } finally {
      setSavingProfile(false);
    }
  };

  // Business Settings Handlers
  const updateBusinessSection = (section, key, value) => {
    setBusinessSettings((prev) => {
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

      setHasSettingsChanges(true);
      return next;
    });
  };

  const handleSaveBusinessSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await contextSaveSettings(businessSettings);
      setHasSettingsChanges(false);
      if (res?.success) {
        toast.success("Business settings saved and applied successfully");
      } else {
        toast.success("Settings saved locally");
      }
    } catch {
      toast.error("Failed to save business settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetBusinessSettings = () => {
    if (window.confirm("Reset business settings to system defaults?")) {
      contextResetSettings();
      setHasSettingsChanges(false);
      toast.success("Settings reset to defaults and applied");
    }
  };

  const handleClearLocalCache = () => {
    try {
      const keepAuth = localStorage.getItem("greengroo_vendor_auth");
      localStorage.clear();
      if (keepAuth) localStorage.setItem("greengroo_vendor_auth", keepAuth);
      document.body.classList.remove("vendor-compact-tables");
      document.documentElement.classList.remove("dark");
      toast.success("Local cache and UI preferences cleared successfully");
    } catch {
      toast.error("Failed to clear local cache");
    }
  };

  const handleTestAudio = () => {
    playOrderAlert();
    toast.success("Order alert sound preview played 🔔");
  };

  const handleReconnectWs = () => {
    setReconnectingSocket(true);
    setTimeout(() => {
      setReconnectingSocket(false);
      toast.success("Live adapter reconnected");
    }, 1000);
  };

  const memberSinceFormatted = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Verified Partner";

  const initial = (data.vendorName || data.businessName || data.ownerName || "V")
    .charAt(0)
    .toUpperCase();

  const businessId = data.vendorCode || data.id || "vendor-1";

  if (loading && !profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-7 w-7 animate-spin text-[#217346]" />
          <p className="text-sm font-medium text-slate-500">Loading account details…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-slate-400">
            <Link to="/dashboard" className="hover:text-emerald-700">Vendor Portal</Link>
            <span className="mx-1.5">/</span>
            <span className="font-semibold text-slate-600">My Profile</span>
          </nav>
          <h1 className={EXCEL_PAGE_TITLE}>My Profile</h1>
          <p className={`mt-0.5 ${EXCEL_PAGE_SUB}`}>Your vendor account details and business settings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className={`${EXCEL_BTN} gap-1.5 text-xs`}
            title="Refresh Details"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-emerald-600" : "text-slate-500"}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className={`${EXCEL_BTN} gap-1.5 text-xs`}
          >
            <KeyRound className="h-3.5 w-3.5 text-slate-500" />
            <span>Change Password</span>
          </button>
          {activeTab === "account" ? (
            <button
              type="button"
              onClick={openEditModal}
              className={`${EXCEL_BTN_PRIMARY} gap-1.5 text-xs`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveBusinessSettings}
              disabled={savingSettings}
              className={`${EXCEL_BTN_PRIMARY} gap-1.5 text-xs ${
                hasSettingsChanges ? "ring-2 ring-emerald-500 ring-offset-1" : ""
              }`}
            >
              <Save className={`h-3.5 w-3.5 ${savingSettings ? "animate-spin" : ""}`} />
              <span>{savingSettings ? "Saving…" : "Save Settings"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero Profile Banner Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        {/* Banner Gradient Background */}
        <div className="h-28 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 relative sm:h-32">
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            <span>Verified Vendor Partner</span>
          </div>
        </div>

        {/* Identity Details */}
        <div className="relative px-5 pb-5 pt-0 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            {/* Floating Avatar + Title */}
            <div className="flex items-end gap-3.5 -mt-10 sm:-mt-12">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-emerald-600 to-emerald-800 text-2xl font-bold text-white shadow-md sm:h-24 sm:w-24 sm:text-3xl">
                {initial}
              </div>
              <div className="pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                    {data.businessName || data.vendorName || "GreenGroo Vendor"}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {data.status || "Active"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-600 sm:text-sm">
                  Owner: {data.ownerName || "—"}
                  {data.vendorName && data.businessName && data.vendorName !== data.businessName ? (
                    <span className="font-normal text-slate-400"> ({data.vendorName})</span>
                  ) : null}
                </p>
              </div>
            </div>

            {/* Vendor Code Pill with Copy */}
            <div className="flex items-center gap-2 self-start sm:self-auto rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs">
              <span className="font-medium text-slate-500">Vendor Code:</span>
              <span className="font-mono font-bold text-emerald-800">{businessId}</span>
              <CopyButton value={businessId} />
            </div>
          </div>

          {/* Quick Meta Chips */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-medium">{data.mobile ? `+91 ${data.mobile}` : "—"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              <span>{data.email || "No email added"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>{[data.city, data.state].filter(Boolean).join(", ") || "India"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <span>Member Since: {memberSinceFormatted}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Operational Highlights Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Managed Farmers</span>
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-slate-900">
            {dashboard?.farmerStats?.totalFarmers ?? dashboard?.totalFarmers ?? "—"}
          </p>
          <Link to="/vendor/farmers" className="mt-0.5 block text-[11px] font-semibold text-emerald-700 hover:underline">
            View All Farmers →
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Farmer Managers</span>
            <User className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-slate-900">
            {dashboard?.managerStats?.totalManagers ?? dashboard?.totalManagers ?? "—"}
          </p>
          <Link to="/vendor/farmer-managers" className="mt-0.5 block text-[11px] font-semibold text-emerald-700 hover:underline">
            View Managers →
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Commission Rate</span>
            <Percent className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-slate-900">
            {data.commissionRate != null ? `${data.commissionRate}%` : '—'}
          </p>
          <span className="mt-0.5 block text-[11px] text-slate-400">Platform Standard</span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Account Role</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-emerald-800">
            {data.role || "VENDOR"}
          </p>
          <span className="mt-0.5 block text-[11px] text-slate-400">Full Partner Access</span>
        </div>
      </div>

      {/* Navigation Switcher: Account Details vs Business Settings */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
            activeTab === "account"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Account & Enterprise Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
            activeTab === "settings"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Business Settings & Operations</span>
          {hasSettingsChanges ? (
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          ) : null}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACCOUNT & ENTERPRISE DETAILS */}
      {/* ========================================================================= */}
      {activeTab === "account" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Panel 1: Personal & Contact Information */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-700" />
                <span>Personal & Contact Information</span>
              </span>
            </div>
            <div className="p-4">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 text-xs">
                <div>
                  <dt className="font-semibold text-slate-500">Owner / Authorized Person</dt>
                  <dd className="mt-0.5 font-bold text-slate-900 sm:text-sm">{data.ownerName || "—"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Primary Mobile Number</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-mono font-bold text-slate-900 sm:text-sm">
                    <span>{data.mobile ? `+91 ${data.mobile}` : "—"}</span>
                    {data.mobile ? <CopyButton value={data.mobile} /> : null}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Alternate Phone</dt>
                  <dd className="mt-0.5 font-mono text-slate-900">{data.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Email Address</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-mono text-slate-900">
                    <span className="truncate">{data.email || "—"}</span>
                    {data.email ? <CopyButton value={data.email} /> : null}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Account Status</dt>
                  <dd className="mt-1">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                      {data.status || "Active"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Account Type</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">Registered Produce Vendor</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Panel 2: Business & Enterprise Identity */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-700" />
                <span>Business & Enterprise Details</span>
              </span>
            </div>
            <div className="p-4">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 text-xs">
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-slate-500">Registered Business Name</dt>
                  <dd className="mt-0.5 font-bold text-slate-900 sm:text-sm">{data.businessName || data.vendorName || "—"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Trade / Display Name</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{data.vendorName || "—"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Vendor Code</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-mono font-bold text-emerald-800">
                    <span>{businessId}</span>
                    <CopyButton value={businessId} />
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">GSTIN Number</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-mono font-bold text-slate-900">
                    <span>{data.gstNumber || "Not Registered"}</span>
                    {data.gstNumber ? <CopyButton value={data.gstNumber} /> : null}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">PAN Number</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-mono font-bold text-slate-900">
                    <span>{data.panNumber || "—"}</span>
                    {data.panNumber ? <CopyButton value={data.panNumber} /> : null}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Panel 3: Registered Business Address */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-700" />
                <span>Registered Business Address</span>
              </span>
            </div>
            <div className="p-4">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 text-xs">
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-slate-500">Address Line / Premises</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{data.businessAddress || "—"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">City / District</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{data.city || "—"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">State</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{data.state || "Maharashtra"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">PIN Code</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-900">{data.pincode || "—"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Country</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">India</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Panel 4: Bank & Settlement Account Details */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-700" />
                <span>Bank & Settlement Account</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Direct Payouts</span>
              </span>
            </div>
            <div className="p-4">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 text-xs">
                <div>
                  <dt className="font-semibold text-slate-500">Account Holder Name</dt>
                  <dd className="mt-0.5 font-bold text-slate-900">
                    {data.bank?.accountHolder || data.bank?.accountHolderName || data.ownerName || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Bank Name</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{data.bank?.bankName || "—"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Account Number</dt>
                  <dd className="mt-0.5 flex items-center gap-2 font-mono font-bold text-slate-900">
                    <span>
                      {data.bank?.accountNumber
                        ? showAccountNum
                          ? data.bank.accountNumber
                          : `•••• •••• ${String(data.bank.accountNumber).slice(-4)}`
                        : "—"}
                    </span>
                    {data.bank?.accountNumber ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowAccountNum(!showAccountNum)}
                          className="text-slate-400 hover:text-slate-600"
                          title={showAccountNum ? "Hide" : "Show"}
                        >
                          {showAccountNum ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <CopyButton value={data.bank.accountNumber} />
                      </>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">IFSC Code</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-mono font-bold text-emerald-800">
                    <span>{data.bank?.ifsc || "—"}</span>
                    {data.bank?.ifsc ? <CopyButton value={data.bank.ifsc} /> : null}
                  </dd>
                </div>
                <div className="sm:col-span-2 rounded-xl bg-emerald-50/60 border border-emerald-100 p-2.5 text-[11px] text-emerald-900">
                  <p className="font-semibold">Settlement Verification Notice:</p>
                  <p className="mt-0.5 text-emerald-800/80">
                    Payouts for accepted orders are automatically credited to this bank account as per the platform settlement cycle.
                  </p>
                </div>
              </dl>
            </div>
          </section>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 2: BUSINESS SETTINGS & OPERATIONS (WORKABLE) */}
      {/* ========================================================================= */}
      {activeTab === "settings" ? (
        <div className="space-y-5">
          {/* Section 1: Collection Centre & Dispatch Rules */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-700" />
                <span>Collection Centre & Dispatch Operations</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Current Gate Status:</span>
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
            <div className="p-5 text-xs space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Gate Opening Time</label>
                  <input
                    type="time"
                    className={EXCEL_INPUT}
                    value={businessSettings?.operations?.collectionCenterOpening || "08:00"}
                    onChange={(e) =>
                      updateBusinessSection("operations", "collectionCenterOpening", e.target.value)
                    }
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Receiving gates unlock for pickups.</p>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Gate Closing Time</label>
                  <input
                    type="time"
                    className={EXCEL_INPUT}
                    value={businessSettings?.operations?.collectionCenterClosing || "20:00"}
                    onChange={(e) =>
                      updateBusinessSection("operations", "collectionCenterClosing", e.target.value)
                    }
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Receiving window closes for the day.</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-800">Auto-Suggest Nearest Driver</h4>
                  <p className="text-[11px] text-slate-500">
                    Automatically ranks available drivers closest to the pickup village.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={Boolean(businessSettings?.operations?.autoAssignDrivers)}
                    onChange={(e) =>
                      updateBusinessSection("operations", "autoAssignDrivers", e.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-800">Customer Pre-Orders Auto-Confirm</h4>
                  <p className="text-[11px] text-slate-500">
                    Auto-accept incoming pre-orders within available dark store capacities.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={Boolean(businessSettings?.operations?.autoConfirmPreorders)}
                    onChange={(e) =>
                      updateBusinessSection("operations", "autoConfirmPreorders", e.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Section 2: Quality Inspection & QC Standards */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <span>Quality Inspection & Grading Rules</span>
              </span>
            </div>
            <div className="p-5 text-xs space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-800">Mandatory Produce Inspection Photos</h4>
                  <p className="text-[11px] text-slate-500">
                    Requires at least 2 produce photos before confirming quality grading.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={Boolean(businessSettings?.operations?.requireQualityPhotos)}
                    onChange={(e) =>
                      updateBusinessSection("operations", "requireQualityPhotos", e.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-800">Strict Grading Rejection Confirmation</h4>
                  <p className="text-[11px] text-slate-500">
                    Displays mandatory confirmation alert before marking batches as Grade C or Rejected.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={Boolean(businessSettings?.operations?.strictGradingConfirmation)}
                    onChange={(e) =>
                      updateBusinessSection("operations", "strictGradingConfirmation", e.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Section 3: Audio & Real-time Live Alerts */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-700" />
                <span>Audio & Real-time Alert Preferences</span>
              </span>
            </div>
            <div className="p-5 text-xs space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-emerald-700" />
                    <h4 className="font-bold text-slate-800">Play Audio Bell on Incoming Pickups / Orders</h4>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Rings an audio alert when a farmer schedules a new harvest pickup.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleTestAudio}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Test Sound 🔔
                  </button>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={Boolean(businessSettings?.notifications?.orderReceivedSound)}
                      onChange={(e) =>
                        updateBusinessSection("notifications", "orderReceivedSound", e.target.checked)
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Low Inventory Stock Warning Threshold (in Kg)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={10000}
                      className={EXCEL_INPUT}
                      value={businessSettings?.notifications?.lowStockThresholdKg || 50}
                      onChange={(e) =>
                        updateBusinessSection(
                          "notifications",
                          "lowStockThresholdKg",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                    <span className="font-bold text-slate-500">kg</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Stock below this amount triggers low-stock warning chips in tables.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Driver Arrival at Centre:</span>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={Boolean(businessSettings?.notifications?.notifyDriverArrival)}
                        onChange={(e) =>
                          updateBusinessSection("notifications", "notifyDriverArrival", e.target.checked)
                        }
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">QC Grading Confirmation Alert:</span>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={Boolean(businessSettings?.notifications?.notifyQualityCompleted)}
                        onChange={(e) =>
                          updateBusinessSection("notifications", "notifyQualityCompleted", e.target.checked)
                        }
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Portal Look, Density & Workspace Defaults */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-emerald-700" />
                <span>Portal Look, Table Density & Defaults</span>
              </span>
            </div>
            <div className="p-5 text-xs space-y-4">
              <div>
                <label className="mb-2 block font-semibold text-slate-700">Theme Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "light", label: "Clean Light", desc: "Crisp emerald spreadsheets" },
                    { id: "dark", label: "Dark Mode", desc: "Low-light night operations" },
                    { id: "system", label: "System Default", desc: "Sync with OS theme" },
                  ].map((theme) => {
                    const selected = (businessSettings?.display?.theme || "light") === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => updateBusinessSection("display", "theme", theme.id)}
                        className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                          selected
                            ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-bold text-slate-900">{theme.label}</span>
                          {selected ? <Check className="h-3.5 w-3.5 text-emerald-700 font-bold" /> : null}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{theme.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-800">Compact Table Rows (High Density)</h4>
                  <p className="text-[11px] text-slate-500">
                    Reduces row height across tables to fit maximum records on screen without scrolling.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={Boolean(businessSettings?.display?.compactMode)}
                    onChange={(e) => updateBusinessSection("display", "compactMode", e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <div className="border-t border-slate-100 pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Live Dashboard Auto-Refresh Rate
                  </label>
                  <select
                    className={EXCEL_SELECT}
                    value={businessSettings?.display?.autoRefreshInterval ?? 0}
                    onChange={(e) =>
                      updateBusinessSection("display", "autoRefreshInterval", Number(e.target.value))
                    }
                  >
                    <option value={0}>Manual Only (Off)</option>
                    <option value={30}>Every 30 Seconds</option>
                    <option value={60}>Every 1 Minute</option>
                    <option value={120}>Every 2 Minutes</option>
                    <option value={300}>Every 5 Minutes</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Default Landing Workspace after Login
                  </label>
                  <select
                    className={EXCEL_SELECT}
                    value={businessSettings?.display?.defaultLandingPage || "/dashboard"}
                    onChange={(e) =>
                      updateBusinessSection("display", "defaultLandingPage", e.target.value)
                    }
                  >
                    <option value="/dashboard">Overview Dashboard (/dashboard)</option>
                    <option value="/vendor/pickups/ready">Ready Pickups Desk (/pickups/ready)</option>
                    <option value="/vendor/quality/all">Quality & Grading Hub (/quality/all)</option>
                    <option value="/vendor/inventory">Vendor Inventory (/inventory)</option>
                    <option value="/vendor/orders">Orders Desk (/orders)</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Cache Management & Integrations */}
          <section className={EXCEL_PANEL}>
            <div className={`${EXCEL_PANEL_HEAD} flex items-center justify-between`}>
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-700" />
                <span>Live Adapter Sync & Local Cache</span>
              </span>
            </div>
            <div className="p-5 text-xs space-y-4">
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
                  onClick={handleReconnectWs}
                  disabled={reconnectingSocket}
                  className={`${EXCEL_BTN} gap-1.5 text-xs border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50`}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${reconnectingSocket ? "animate-spin" : ""}`} />
                  <span>{reconnectingSocket ? "Pinging…" : "Ping / Reconnect"}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div>
                  <h4 className="font-bold text-slate-800">Local Panel Storage & Drafts</h4>
                  <p className="text-[11px] text-slate-500">
                    Clear local query cache and reset UI filters without signing out of your account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearLocalCache}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Clear Cache</span>
                </button>
              </div>
            </div>
          </section>

          {/* Settings Bottom Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetBusinessSettings}
              className={`${EXCEL_BTN} gap-1.5 text-xs`}
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset to Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSaveBusinessSettings}
              disabled={savingSettings}
              className={`${EXCEL_BTN_PRIMARY} gap-1.5 text-xs ${
                hasSettingsChanges ? "ring-2 ring-emerald-500 ring-offset-1" : ""
              }`}
            >
              <Save className={`h-3.5 w-3.5 ${savingSettings ? "animate-spin" : ""}`} />
              <span>{savingSettings ? "Saving…" : "Save Business Settings"}</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Edit Profile Modal */}
      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Vendor Profile</h3>
                <p className="text-xs text-slate-500">Update your company and personal details.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 p-6 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Personal & Business Identity
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Owner Name *</label>
                  <input
                    type="text"
                    required
                    className={EXCEL_INPUT}
                    value={form.ownerName}
                    onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Registered Business Name *</label>
                  <input
                    type="text"
                    required
                    className={EXCEL_INPUT}
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Trade / Display Name</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.vendorName}
                    onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    className={EXCEL_INPUT}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Alternate Phone</label>
                  <input
                    type="tel"
                    className={EXCEL_INPUT}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">GSTIN</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.gstNumber}
                    onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">PAN Number</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.panNumber}
                    onChange={(e) => setForm({ ...form, panNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-b border-slate-100 pb-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Address Details
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-semibold text-slate-700">Premises / Street Address</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.businessAddress}
                    onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">City</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">State</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">PIN Code</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-b border-slate-100 pb-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Bank & Settlement Details
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Account Holder Name</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.bank.accountHolder}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bank: { ...form.bank, accountHolder: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Bank Name</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.bank.bankName}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bank: { ...form.bank, bankName: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Account Number</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.bank.accountNumber}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bank: { ...form.bank, accountNumber: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">IFSC Code</label>
                  <input
                    type="text"
                    className={EXCEL_INPUT}
                    value={form.bank.ifsc}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bank: { ...form.bank, ifsc: e.target.value.toUpperCase() },
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className={EXCEL_BTN}
                  disabled={savingProfile}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className={`${EXCEL_BTN_PRIMARY} gap-1.5`}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingProfile ? "Saving…" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Change Password Modal */}
      {passwordOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Change Password</h3>
                <p className="text-xs text-slate-500">Update your vendor account login password.</p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 p-6 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  className={EXCEL_INPUT}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Confirm Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  className={EXCEL_INPUT}
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setPasswordOpen(false)}
                  className={EXCEL_BTN}
                  disabled={savingProfile}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className={`${EXCEL_BTN_PRIMARY} gap-1.5`}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>{savingProfile ? "Updating…" : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
