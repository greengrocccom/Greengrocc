import { useCallback, useState } from "react";
import { useLive } from "../../realtime/useLive";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Filter,
  IdCard,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  ShoppingCart,
  Sparkles,
  Sprout,
  Store,
  Tractor,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
  XCircle,
  GripVertical,
  Move,
  Layers,
} from "lucide-react";
import { PageShell } from "../../components/layout/ProductManagerLayout";
import { vendorApi } from "../../api/vendorApi";
import { staffApi } from "../../api/staffApi";
import StatusBadge from "../../components/ui/StatusBadge";
import CopyId from "../../components/ui/CopyId";
import { EXCEL_PANEL, EXCEL_HEAD, EXCEL_CELL } from "../../utils/excelStyles";
import AjaxLiveSearchWidget from "../../components/search/AjaxLiveSearchWidget";
import QualityGradeRejectionChart from "../../components/dashboard/QualityGradeRejectionChart";
import { useVendorAuth } from "../../context/VendorAuthContext";

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

const DATE_RANGE_OPTIONS = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "this_year", label: "This Year" },
  { id: "custom", label: "Custom Range" },
];

function MultiMetricCard({ title, mainValue, subItems = [], icon: Icon, iconBg, to }) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs transition hover:border-emerald-300 hover:bg-slate-50/30 sm:p-3"
    >
      <div>
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500 line-clamp-1">{title}</p>
            <p className="mt-0.5 text-base sm:text-lg font-semibold text-slate-800">
              {mainValue}
            </p>
          </div>
          {Icon ? (
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
          ) : null}
        </div>

        {/* Sub metrics list */}
        {subItems.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-1.5">
            {subItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px]">
                <span className="truncate text-slate-500">{item.label}</span>
                <span className={`ml-1 shrink-0 font-medium ${item.color || "text-slate-700"}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const auth = useVendorAuth();
  const isSeller = auth?.vendor?.vendorType === 'seller';
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyId, setBusyId] = useState("");

  // Date Range Filter State
  const [range, setRange] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customApplied, setCustomApplied] = useState(false);
  // Filter the data is loaded for; custom dates only count once applied, not while typing.
  const [applied, setApplied] = useState({ range: "all", start: "", end: "" });

  // Drag & Drop Live Search Widget Dock State
  const [searchWidgetDock, setSearchWidgetDock] = useState(() => {
    try {
      return localStorage.getItem("greengroo_vendor_search_widget_dock") || "hero";
    } catch {
      return "hero";
    }
  });
  const [isOverHeroDrop, setIsOverHeroDrop] = useState(false);
  const [isOverBottomDrop, setIsOverBottomDrop] = useState(false);

  const handleWidgetDrop = (targetZone) => {
    setSearchWidgetDock(targetZone);
    setIsOverHeroDrop(false);
    setIsOverBottomDrop(false);
    try {
      localStorage.setItem("greengroo_vendor_search_widget_dock", targetZone);
    } catch {}
  };

  const loadAll = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    const { range: activeRange, start: activeStart, end: activeEnd } = applied;

    try {
      const params = {};
      if (activeRange && activeRange !== "all") params.range = activeRange;
      if (activeRange === "custom" && activeStart && activeEnd) {
        params.startDate = activeStart;
        params.endDate = activeEnd;
      }

      const [dashRes, reqRes] = await Promise.all([
        vendorApi.getDashboard(params).catch(() => ({ data: {} })),
        staffApi.inventoryRequests().catch(() => ({ data: { requests: [] } })),
      ]);
      setData(dashRes.data || {});
      setRequests(reqRes.data?.requests || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applied]);

  useLive(({ initial }) => loadAll(!initial), [loadAll]);

  const applyFilter = (next) =>
    setApplied((prev) =>
      prev.range === next.range && prev.start === next.start && prev.end === next.end ? prev : next
    );

  const handleRangeChange = (newRange) => {
    setRange(newRange);
    if (newRange !== "custom") {
      setCustomApplied(false);
      applyFilter({ range: newRange, start: "", end: "" });
    }
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) return;
    setCustomApplied(true);
    applyFilter({ range: "custom", start: customStart, end: customEnd });
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequestsCount = requests.filter((r) => r.status === "approved").length;

  const reviewRestock = async (requestId, decision) => {
    setBusyId(`${requestId}-${decision}`);
    try {
      const res = await staffApi.reviewInventoryRequest(requestId, { decision });
      setToast(res.data?.message || `Request ${decision}`);
      await loadAll(true);
    } catch (err) {
      setToast(err.response?.data?.message || "Action failed");
    } finally {
      setBusyId("");
      window.setTimeout(() => setToast(""), 4000);
    }
  };

  const d = data || {};
  const recentOrders = Array.isArray(d.recentOrders) ? d.recentOrders : [];
  const lowStock = Array.isArray(d.lowStockProducts) ? d.lowStockProducts : [];

  // Grade totals calculation
  const gradeA = Number(d.grades?.gradeA || 0);
  const gradeB = Number(d.grades?.gradeB || 0);
  const gradeC = Number(d.grades?.gradeC || 0);
  const rejected = Number(d.grades?.rejected || 0);
  const totalGraded = Number(d.grades?.total || gradeA + gradeB + gradeC + rejected);
  const rejectionRate = Number(d.grades?.rejectionRate ?? (totalGraded > 0 ? ((rejected / totalGraded) * 100).toFixed(1) : 0));
  const gradeAPercent = totalGraded > 0 ? Math.round((gradeA / totalGraded) * 100) : 0;
  const gradeBPercent = totalGraded > 0 ? Math.round((gradeB / totalGraded) * 100) : 0;
  const gradeCPercent = totalGraded > 0 ? Math.round((gradeC / totalGraded) * 100) : 0;
  const rejectedPercent = totalGraded > 0 ? Math.round((rejected / totalGraded) * 100) : 0;

  return (
    <PageShell>
      {/* Toast Alert */}
      {toast ? (
        <div className="animate-in fade-in slide-in-from-top-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{toast}</span>
          </div>
          <button type="button" onClick={() => setToast("")} className="text-emerald-700 hover:text-emerald-900">
            &times;
          </button>
        </div>
      ) : null}

      {/* Error Alert */}
      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")} className="text-red-700 hover:text-red-900">
            &times;
          </button>
        </div>
      ) : null}

      {/* Top Controls Strip (Quick Operations + Date Filter directly attached to Navbar with no gap) */}
      <div className="-mx-3 -mt-3 mb-4 sm:-mx-4 sm:-mt-4 lg:-mx-5 lg:-mt-5 border-b border-slate-200/90 bg-white shadow-xs divide-y divide-slate-100">
        {/* Row 1: Quick Operations */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
            </span>
            <span className="text-xs font-bold text-slate-800">Quick Operations</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Link to="/sales" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Sales Summary</Link>
            {!isSeller ? (
              <>
                <Link
                  to="/vendor/all-farmers/add"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Add Farmer</span>
                </Link>
                <Link
                  to="/vendor/farmer-managers/add"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Add Manager</span>
                </Link>
                <Link
                  to="/vendor/farmer-products"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Package className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Farmer Products</span>
                </Link>
              </>
            ) : null}

            <Link
              to="/vendor/orders/create"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <ShoppingCart className="h-3.5 w-3.5 text-emerald-700" />
              <span>Create Order</span>
            </Link>

            {!isSeller ? (
              <Link
                to="/vendor/crops"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <Sprout className="h-3.5 w-3.5 text-emerald-700" />
                <span>Add Crop</span>
              </Link>
            ) : null}

            <Link
              to="/vendor/products"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <Package className="h-3.5 w-3.5 text-emerald-700" />
              <span>Add Product</span>
            </Link>

            {isSeller ? (
              <>
                <Link
                  to="/vendor/dark-stores"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Store className="h-3.5 w-3.5 text-blue-700" />
                  <span>My Dark Stores</span>
                </Link>
                <Link
                  to="/vendor/my-products"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Package className="h-3.5 w-3.5 text-emerald-700" />
                  <span>My Supply Products</span>
                </Link>
              </>
            ) : null}

            {!isSeller ? (
              <Link
                to="/vendor/pickups/ready"
                className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 md:inline-flex"
              >
                <Truck className="h-3.5 w-3.5 text-sky-700" />
                <span>Pickups</span>
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => loadAll(false)}
              disabled={refreshing}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              title="Refresh dashboard metrics"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-emerald-700" : ""}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Date Filter Bar (seamlessly joined without margin/gap) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 sm:px-5 bg-slate-50/40">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-emerald-700" />
            <span className="text-xs font-bold text-slate-700">Filter by Date:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleRangeChange(opt.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  range === opt.id
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker Input */}
          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 w-full lg:w-auto border-t lg:border-t-0 border-slate-200">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-emerald-600"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={handleApplyCustom}
                disabled={!customStart || !customEnd}
                className="h-7 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
              >
                Apply Range
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drag & Drop Ajax Live Search Widget – Hero Zone */}
      {searchWidgetDock === "hero" ? (
        <div className="mb-4">
          <div className="flex items-center justify-between pb-1.5 px-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span>Ajax Live Search • Produce & Farmer Radar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Drag grip handle to reposition widget
              </span>
              <button
                type="button"
                onClick={() => handleWidgetDrop("bottom")}
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Dock Below Cards ↓
              </button>
            </div>
          </div>
          <AjaxLiveSearchWidget
            mode="card"
            isDraggable={true}
            placeholder="Instant produce search (e.g. 'tamatar', 'aloo', 'shimla apple', farmer name)..."
          />
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOverHeroDrop(true);
          }}
          onDragLeave={() => setIsOverHeroDrop(false)}
          onDrop={(e) => {
            e.preventDefault();
            handleWidgetDrop("hero");
          }}
          className={`mb-4 rounded-2xl border-2 border-dashed p-3 text-center transition ${
            isOverHeroDrop
              ? "border-emerald-500 bg-emerald-50/70 text-emerald-800 scale-[1.01]"
              : "border-slate-200 bg-slate-50/40 text-slate-400 hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-semibold">Drop Ajax Live Search Widget here (Top Hero Zone)</p>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${isSeller ? 'lg:grid-cols-5' : 'md:grid-cols-4 lg:grid-cols-5'}`}>
        {!isSeller ? (
          <>
            {/* Card 1 – Total Farmer Managers */}
            <MultiMetricCard
              title="Total Farmer Managers"
              mainValue={loading ? "…" : d.totalManagers ?? 0}
              icon={Users}
              iconBg="bg-teal-50 text-teal-700"
              to="/vendor/farmer-managers"
              subItems={[
                { label: "Active Managers", value: d.activeManagers ?? 0, color: "text-emerald-700" },
                { label: "Inactive / Pending", value: d.inactiveManagers ?? 0, color: "text-slate-500" },
              ]}
            />

            {/* Card 2 – Total Farmers */}
            <MultiMetricCard
              title="Total Farmers"
              mainValue={loading ? "…" : d.totalFarmers ?? 0}
              icon={Tractor}
              iconBg="bg-emerald-50 text-emerald-700"
              to="/vendor/all-farmers"
              subItems={[
                { label: "Farmer Approval Pending", value: d.farmerApprovalPending ?? 0, color: "text-amber-600" },
                { label: "Manager Assign Pending", value: d.farmerManagerAssignPending ?? 0, color: "text-sky-700" },
              ]}
            />

            {/* Card 3 – Total Crops */}
            <MultiMetricCard
              title="Farmer Crops"
              mainValue={loading ? "…" : d.totalCrops ?? 0}
              icon={Sprout}
              iconBg="bg-emerald-50 text-emerald-700"
              to="/vendor/farmer-crops"
              subItems={[
                { label: "Growing / Sowing", value: d.growingCrops ?? 0, color: "text-sky-700" },
                { label: "Ready for Harvest", value: d.harvestReadyCrops ?? 0, color: "text-emerald-700" },
              ]}
            />
          </>
        ) : null}

        {/* Card 4 – Total Products */}
        <MultiMetricCard
          title={isSeller ? "Supply Products" : "Farmer Products"}
          mainValue={loading ? "…" : d.totalProducts ?? 0}
          icon={Package}
          iconBg="bg-amber-50 text-amber-700"
          to={isSeller ? "/vendor/my-products" : "/vendor/farmer-products"}
          subItems={[
            { label: "Products Approval Pending", value: d.productsApprovalPending ?? 0, color: "text-amber-600" },
            { label: "Active / In Stock", value: d.activeProducts ?? 0, color: "text-emerald-700" },
          ]}
        />

        {/* Card 5 – Available Inventory */}
        <MultiMetricCard
          title="Available Inventory"
          mainValue={loading ? "…" : `${(d.totalInventory ?? 0).toLocaleString("en-IN")} Kg`}
          icon={ClipboardList}
          iconBg="bg-emerald-50 text-emerald-700"
          to="/vendor/inventory"
          subItems={[
            { label: "Number of Products", value: `${d.inventoryProductsCount ?? 0} items`, color: "text-slate-700" },
            { label: "Low Stock Count", value: d.lowStockCount ?? 0, color: "text-red-600" },
          ]}
        />

        {/* Card 6 – Total Orders */}
        <MultiMetricCard
          title="Total Orders"
          mainValue={loading ? "…" : d.totalOrders ?? 0}
          icon={ShoppingCart}
          iconBg="bg-indigo-50 text-indigo-700"
          to={isSeller ? "/vendor/orders/products" : "/vendor/orders"}
          subItems={[
            { label: "Pending Orders", value: d.pendingOrders ?? 0, color: "text-amber-600" },
            { label: "Rejected Orders", value: d.rejectedOrders ?? 0, color: "text-red-600" },
            { label: "Completed Orders", value: d.completedOrders ?? 0, color: "text-emerald-700" },
          ]}
        />

        {isSeller ? (
          <>
            {/* Seller Card – Pre-orders */}
            <MultiMetricCard
              title="Customer Pre-orders"
              mainValue={loading ? "…" : d.preOrdersCount ?? 0}
              icon={CalendarClock}
              iconBg="bg-purple-50 text-purple-700"
              to="/vendor/preorders"
              subItems={[
                { label: "Active Pre-orders", value: d.preOrdersActive ?? 0, color: "text-emerald-700" },
                { label: "Delivery Slots", value: "Configured", color: "text-slate-500" },
              ]}
            />

            {/* Seller Card – Dark Store Restock */}
            <MultiMetricCard
              title="Dark Store Restock"
              mainValue={loading ? "…" : pendingRequests.length}
              icon={Store}
              iconBg="bg-sky-50 text-sky-700"
              to="/vendor/inventory-requests"
              subItems={[
                { label: "Pending Requests", value: pendingRequests.length, color: "text-amber-600" },
                { label: "Dark Stores", value: "Connected", color: "text-emerald-700" },
              ]}
            />
          </>
        ) : (
          <>
            {/* Card 7 – Total Driver */}
            <MultiMetricCard
              title="Total Driver"
              mainValue={loading ? "…" : d.totalDrivers ?? 0}
              icon={IdCard}
              iconBg="bg-cyan-50 text-cyan-700"
              to="/vendor/drivers"
              subItems={[
                { label: "Driver Approval Pending", value: d.driverApprovalPending ?? 0, color: "text-amber-600" },
                { label: "Active Drivers", value: d.activeDrivers ?? 0, color: "text-emerald-700" },
              ]}
            />

            {/* Card 8 – Ready for Pickup */}
            <MultiMetricCard
              title="Ready for Pickup"
              mainValue={loading ? "…" : d.readyPickups ?? 0}
              icon={Truck}
              iconBg="bg-amber-50 text-amber-700"
              to="/vendor/pickups/ready"
              subItems={[
                { label: "Assigned Pickups", value: d.assignedPickups ?? 0, color: "text-sky-700" },
              ]}
            />

            {/* Card 9 – All Pickups */}
            <MultiMetricCard
              title="All Pickups"
              mainValue={loading ? "…" : d.totalPickups ?? 0}
              icon={RotateCcw}
              iconBg="bg-sky-50 text-sky-700"
              to="/vendor/pickups/all"
              subItems={[
                { label: "Incoming Pickups", value: d.incomingPickups ?? 0, color: "text-indigo-600" },
                { label: "Pickups at Center", value: d.centrePickups ?? 0, color: "text-emerald-700" },
              ]}
            />

            {/* Card 10 – Quality & Grading */}
            <MultiMetricCard
              title="Quality & Grading"
              mainValue={loading ? "…" : d.totalInspections ?? ((d.qualityPending ?? 0) + (d.qualityInProcess ?? 0) + (d.qualityCompleted ?? 0))}
              icon={BadgeCheck}
              iconBg="bg-purple-50 text-purple-700"
              to="/vendor/quality/pending"
              subItems={[
                { label: "Pending Inspection", value: d.qualityPending ?? 0, color: "text-amber-600" },
                { label: "Completed QC", value: d.qualityCompleted ?? 0, color: "text-emerald-700" },
                {
                  label: "Rejection Rate",
                  value: `${rejectionRate}%`,
                  color: rejectionRate > 5 ? "text-red-600" : "text-emerald-700",
                },
              ]}
            />
          </>
        )}
      </div>

      {/* Drag & Drop Ajax Live Search Widget – Bottom Zone */}
      {searchWidgetDock === "bottom" ? (
        <div className="mb-4">
          <div className="flex items-center justify-between pb-1.5 px-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span>Ajax Live Search • Produce & Farmer Radar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Drag grip handle to reposition widget
              </span>
              <button
                type="button"
                onClick={() => handleWidgetDrop("hero")}
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Dock at Top ↑
              </button>
            </div>
          </div>
          <AjaxLiveSearchWidget
            mode="card"
            isDraggable={true}
            placeholder="Instant produce search (e.g. 'tamatar', 'aloo', 'shimla apple', farmer name)..."
          />
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOverBottomDrop(true);
          }}
          onDragLeave={() => setIsOverBottomDrop(false)}
          onDrop={(e) => {
            e.preventDefault();
            handleWidgetDrop("bottom");
          }}
          className={`mb-4 rounded-2xl border-2 border-dashed p-3 text-center transition ${
            isOverBottomDrop
              ? "border-emerald-500 bg-emerald-50/70 text-emerald-800 scale-[1.01]"
              : "border-slate-200/80 bg-slate-50/30 text-slate-400 hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-semibold">Drop Ajax Live Search Widget here (Below Summary Cards)</p>
        </div>
      )}

      {/* Operational Pipeline Tracker Banner */}
      <div className={`${EXCEL_PANEL} overflow-hidden p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
              {isSeller ? "Seller Fulfilment Pipeline" : "Agricultural Supply Chain Pipeline"}
            </h3>
            <p className="text-xs text-slate-500">
              {isSeller
                ? "Live tracker of seller orders, inventory and dark store dispatch"
                : "Live tracker of orders moving from harvest to dark store dispatch"}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live Sync Active
          </span>
        </div>

        <div className={`mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 ${isSeller ? 'lg:grid-cols-3' : 'lg:grid-cols-6'}`}>
          <Link
            to={isSeller ? "/vendor/orders/products" : "/vendor/orders"}
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">
                {isSeller ? "1. Orders" : "1. Harvest Orders"}
              </span>
              <ShoppingCart className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{d.pendingOrders ?? 0}</p>
            <p className="text-[10px] text-slate-500">Pending / Confirmed</p>
          </Link>

          {!isSeller ? (
            <>
              <Link
                to="/vendor/pickups/ready"
                className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">2. Ready Pickups</span>
                  <Truck className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">{d.readyPickups ?? 0}</p>
                <p className="text-[10px] text-slate-500">Awaiting Driver</p>
              </Link>

              <Link
                to="/vendor/pickups/incoming"
                className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">3. In-Transit / Centre</span>
                  <RotateCcw className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">{(d.transitPickups ?? 0) + (d.centrePickups ?? 0)}</p>
                <p className="text-[10px] text-slate-500">En route / At Hub</p>
              </Link>

              <Link
                to="/vendor/quality/pending"
                className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">4. Quality & Grading</span>
                  <BadgeCheck className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">{(d.qualityPending ?? 0) + (d.qualityInProcess ?? 0)}</p>
                <p className="text-[10px] text-slate-500">Inspection & Grading</p>
              </Link>
            </>
          ) : null}

          <Link
            to="/vendor/inventory"
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">
                {isSeller ? "2. Warehouse Stock" : "5. Warehouse Stock"}
              </span>
              <ClipboardList className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">{(d.totalInventory ?? 0).toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-slate-500">Kg Available Stock</p>
          </Link>

          <Link
            to="/vendor/orders/darkstore"
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">
                {isSeller ? "3. Dark Store Restock" : "6. Dark Store Restock"}
              </span>
              <Store className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <p className="mt-2 text-xl font-bold text-amber-700">{pendingRequests.length}</p>
            <p className="text-[10px] text-slate-500">Requests Pending</p>
          </Link>
        </div>
      </div>

      {/* Two Columns: Grade Analytics & Fleet/Logistics (Farmer Vendors only) */}
      {!isSeller ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Quality, Grade & Rejection Rate Analytics with Interactive Pie Chart */}
          <QualityGradeRejectionChart
            grades={d.grades || {}}
            byProduct={d.byProduct || []}
            byFarmer={d.byFarmer || []}
            rejectionByProduct={d.rejectionByProduct || []}
            rejectionByFarmer={d.rejectionByFarmer || []}
            rejectionReasonsOverall={d.rejectionReasonsOverall || []}
            qualityPending={d.qualityPending ?? 0}
            qualityInProcess={d.qualityInProcess ?? 0}
            qualityCompleted={d.qualityCompleted ?? 0}
          />

          {/* Fleet & Logistics Overview */}
          <div className={`${EXCEL_PANEL} p-4 sm:p-5`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <Truck className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Fleet & Pickup Logistics</h3>
                  <p className="text-xs text-slate-500">Real-time driver dispatch and collection centre status</p>
                </div>
              </div>
              <Link to="/vendor/pickups/all" className="text-xs font-semibold text-emerald-700 hover:underline">
                View All Pickups &rarr;
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Link
                to="/vendor/pickups/ready"
                className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-center transition hover:bg-amber-100/60"
              >
                <p className="text-[11px] font-semibold text-amber-800">Ready</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">{d.readyPickups ?? 0}</p>
                <p className="text-[10px] text-amber-700">To Assign</p>
              </Link>

              <Link
                to="/vendor/pickups/assigned"
                className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-center transition hover:bg-sky-100/60"
              >
                <p className="text-[11px] font-semibold text-sky-800">Assigned</p>
                <p className="mt-1 text-2xl font-bold text-sky-900">{d.assignedPickups ?? 0}</p>
                <p className="text-[10px] text-sky-700">To Drivers</p>
              </Link>

              <Link
                to="/vendor/pickups/incoming"
                className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-center transition hover:bg-indigo-100/60"
              >
                <p className="text-[11px] font-semibold text-indigo-800">In Transit</p>
                <p className="mt-1 text-2xl font-bold text-indigo-900">{d.incomingPickups ?? 0}</p>
                <p className="text-[10px] text-indigo-700">On The Road</p>
              </Link>

              <Link
                to="/vendor/pickups/centre"
                className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-center transition hover:bg-emerald-100/60"
              >
                <p className="text-[11px] font-semibold text-emerald-800">At Centre</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{d.centrePickups ?? 0}</p>
                <p className="text-[10px] text-emerald-700">Receiving</p>
              </Link>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Driver Fleet Status</span>
                <Link to="/vendor/drivers" className="text-[11px] font-semibold text-emerald-700 hover:underline">
                  Manage Drivers &rarr;
                </Link>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Available: {d.activeDrivers ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Pending Approval: {d.driverApprovalPending ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span>Total Drivers: {d.totalDrivers ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Two Column Section: Dark Store Restock Requests & Low Stock Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Dark Store Restock Requests Hub */}
        <div className={`${EXCEL_PANEL} flex flex-col justify-between overflow-hidden`}>
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <Store className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 sm:text-base">Dark Store Restock Queue</h3>
                  <p className="text-xs text-slate-500">Incoming stock refill requests from delivery managers</p>
                </div>
              </div>
              <Link to="/vendor/orders/darkstore" className="text-xs font-semibold text-emerald-700 hover:underline">
                View All ({requests.length})
              </Link>
            </div>

            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {loading ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">Loading restock requests…</p>
              ) : pendingRequests.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/80" />
                  <p className="mt-2 text-sm font-semibold text-slate-800">All caught up!</p>
                  <p className="text-xs text-slate-500">No pending restock requests from dark stores at the moment.</p>
                </div>
              ) : (
                pendingRequests.slice(0, 5).map((request) => (
                  <article key={request.id} className="flex flex-col justify-between gap-2 p-3 sm:p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-bold text-slate-900 sm:text-sm">{request.productName}</p>
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                          {request.quantity} {request.unit}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {request.storeName}
                        {request.managerName ? ` · ${request.managerName}` : ""}
                      </p>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-slate-400">
                        <span>{request.requestNumber}</span>
                        <span>·</span>
                        <span>{formatWhen(request.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
                      <button
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => reviewRestock(request.id, "approved")}
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {busyId === `${request.id}-approved` ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => reviewRestock(request.id, "rejected")}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {busyId === `${request.id}-rejected` ? "…" : "Reject"}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/60 p-3 text-center">
            <Link to="/vendor/orders/darkstore" className="text-xs font-semibold text-emerald-700 hover:underline">
              Open Full Restock Request Desk &rarr;
            </Link>
          </div>
        </div>

        {/* Low Stock & Inventory Alerts */}
        <div className={`${EXCEL_PANEL} flex flex-col justify-between overflow-hidden`}>
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 sm:text-base">Low Stock & Inventory Alerts</h3>
                  <p className="text-xs text-slate-500">Products currently below safety stock threshold</p>
                </div>
              </div>
              <Link to="/vendor/inventory" className="text-xs font-semibold text-emerald-700 hover:underline">
                View Inventory &rarr;
              </Link>
            </div>

            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {loading ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">Loading inventory status…</p>
              ) : lowStock.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/80" />
                  <p className="mt-2 text-sm font-semibold text-slate-800">Inventory levels are healthy</p>
                  <p className="text-xs text-slate-500">All catalog products have sufficient stock.</p>
                </div>
              ) : (
                lowStock.map((item) => (
                  <article key={item.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-bold text-slate-900 sm:text-sm">{item.name}</p>
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          Low Stock
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        Farmer: {item.farmerName} · {item.category}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{item.stock} Kg</p>
                      <p className="text-[10px] text-slate-400">Limit: {item.lowStockLimit} Kg</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/60 p-3 text-center">
            <Link to="/vendor/orders/create" className="text-xs font-semibold text-emerald-700 hover:underline">
              Create Harvest Order to Restock &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Harvest Orders Table */}
      <div className={`${EXCEL_PANEL} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 sm:text-base">Recent Harvest Orders</h3>
              <p className="text-xs text-slate-500">Latest orders placed with farmers across your network</p>
            </div>
          </div>
          <Link to="/vendor/orders" className="text-xs font-semibold text-emerald-700 hover:underline">
            View All Orders &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={EXCEL_HEAD}>
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Farmer</th>
                <th className="px-4 py-3">Product / Crop</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading orders…
                  </td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No harvest orders found for selected date range.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">
                      <CopyId value={order.orderNumber || order.id} breakAll />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{order.farmerName}</td>
                    <td className="px-4 py-3 text-slate-700">{order.productName}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {order.totalQuantity} {order.unit || "Kg"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">
                      ₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatWhen(order.orderDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/vendor/orders/detail/${encodeURIComponent(order.id)}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        <span>Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
