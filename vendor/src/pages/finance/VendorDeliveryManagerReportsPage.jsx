import { useState, useEffect } from "react";
import {
  Store,
  Truck,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  ShoppingBag,
  Coins,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Eye,
  X,
  Search,
  FileText,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function VendorDeliveryManagerReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    preset: "last30",
    startDate: "",
    endDate: "",
  });
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("ALL");
  const [summary, setSummary] = useState(null);
  const [stores, setStores] = useState([]);

  // Store Detail Modal
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [storeDetail, setStoreDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalTab, setModalTab] = useState("orders"); // orders, expenses

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        preset: filter.preset,
        startDate: filter.startDate,
        endDate: filter.endDate,
      };
      const res = await vendorApi.getDarkStoreReports(params);
      if (res?.success) {
        setSummary(res.summary);
        setStores(res.stores || []);
      } else {
        setError(res?.message || "Failed to load dark store reports");
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err.message || "Failed to load dark store reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const handleOpenDetail = async (storeId) => {
    setSelectedStoreId(storeId);
    setDetailLoading(true);
    setModalTab("orders");
    try {
      const res = await vendorApi.getDarkStoreDetail(storeId);
      if (res?.success) {
        setStoreDetail(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedStoreId(null);
    setStoreDetail(null);
  };

  // Filter stores by tab & search
  const filteredStores = stores.filter((s) => {
    if (statusTab === "ACTIVE" && s.status === "Inactive") return false;
    if (statusTab === "WITH_ORDERS" && s.totalOrders === 0) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.managerName && s.managerName.toLowerCase().includes(q)) ||
      (s.area && s.area.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q))
    );
  });

  const totalStores = summary?.totalDarkStores || 0;
  const activeStores = summary?.activeDarkStores || 0;
  const totalOrders = summary?.totalOrders || 0;
  const completedOrders = summary?.completedDeliveries || 0;
  const cancelledOrders = summary?.cancelledOrders || 0;
  const grossSales = summary?.grossProductSales || 0;
  const deliveryRev = summary?.deliveryRevenue || 0;
  const totalSale = summary?.totalSale || (grossSales + deliveryRev);
  const storeExp = summary?.deliveryExpenses || 0;
  const netContribution = summary?.netProfit !== undefined ? summary.netProfit : (totalSale - storeExp);
  const currentProfit = summary?.currentProfit || 0;

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Delivery Manager Reports</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              {summary?.vendorName || "Vendor"} Dark Store Network
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor dark store order volumes, gross product sales, delivery revenues, operational expenses & net contribution
          </p>
        </div>

        <button
          type="button"
          onClick={fetchReports}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* Date Filter */}
      <FinanceDateFilter
        preset={filter.preset}
        startDate={filter.startDate}
        endDate={filter.endDate}
        onFilterChange={setFilter}
      />

      {/* 8-Cards KPI Strip - Arranged in 2 Neat Rows (4 Cards per Row) */}
      <div className="space-y-3">
        {/* ROW 1: Store Volume & Revenue Inflows */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          {/* 1. Dark Stores Count */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Dark Stores">
                DARK STORES
              </span>
              <Store className="h-4 w-4 shrink-0 text-slate-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate tabular-nums">
              {loading ? "..." : totalStores} Stores
            </p>
            <span className="text-[10px] text-emerald-600 font-medium truncate block mt-0.5">
              {activeStores} Active Dark Stores
            </span>
          </div>

          {/* 2. Total Orders Handled */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Orders Handled">
                TOTAL ORDERS HANDLED
              </span>
              <Truck className="h-4 w-4 shrink-0 text-blue-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-blue-700 truncate tabular-nums">
              {loading ? "..." : totalOrders} Orders
            </p>
            <span className="text-[10px] text-slate-500 truncate block mt-0.5">
              <strong className="text-emerald-600">{completedOrders} delivered</strong> • {cancelledOrders} cancelled
            </span>
          </div>

          {/* 3. Gross Product Sales */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Gross Product Sales">
                GROSS PRODUCT SALES
              </span>
              <ShoppingBag className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate tabular-nums">
              {loading ? "..." : rupee(grossSales)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Products billed via Dark Stores
            </span>
          </div>

          {/* 4. Delivery Revenue */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Delivery Revenue">
                DELIVERY REVENUE
              </span>
              <Coins className="h-4 w-4 shrink-0 text-indigo-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-indigo-700 truncate tabular-nums">
              {loading ? "..." : rupee(deliveryRev)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Delivery fees collected
            </span>
          </div>
        </div>

        {/* ROW 2: Store Financials, Expenses & Net Contribution */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          {/* 5. Total Store Sale */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-900 truncate" title="Total Store Sale">
                TOTAL STORE SALE
              </span>
              <Coins className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-emerald-700 truncate tabular-nums">
              {loading ? "..." : rupee(totalSale)}
            </p>
            <span className="text-[10px] font-medium text-emerald-600 truncate block mt-0.5">
              Gross Products + Delivery
            </span>
          </div>

          {/* 6. Dark Store Expenses */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Store Expenses">
                DARK STORE EXPENSES
              </span>
              <TrendingDown className="h-4 w-4 shrink-0 text-rose-500" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-rose-600 truncate tabular-nums">
              {loading ? "..." : rupee(storeExp)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Riders, fuel & store upkeep
            </span>
          </div>

          {/* 7. Net Store Contribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Net Contribution">
                NET STORE CONTRIBUTION
              </span>
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className={`mt-1.5 text-lg sm:text-xl font-bold tracking-tight truncate tabular-nums ${netContribution >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
              {loading ? "..." : rupee(netContribution)}
            </p>
            <span className="text-[10px] font-medium text-slate-500 truncate block mt-0.5">
              Total Sale - Store Expenses
            </span>
          </div>

          {/* 8. Current Profit */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-900 truncate" title="Current Profit">
                CURRENT DELIVERED PROFIT
              </span>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-emerald-700 truncate tabular-nums">
              {loading ? "..." : rupee(currentProfit)}
            </p>
            <span className="text-[10px] font-medium text-emerald-700 truncate block mt-0.5">
              {completedOrders} Delivered & Paid orders
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusTab("ALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              statusTab === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Stores ({stores.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("ACTIVE")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              statusTab === "ACTIVE"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Active Stores ({stores.filter((s) => s.status !== "Inactive").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("WITH_ORDERS")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              statusTab === "WITH_ORDERS"
                ? "bg-blue-700 text-white shadow-xs"
                : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            With Orders ({stores.filter((s) => s.totalOrders > 0).length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dark store or manager..."
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Dark Stores Performance Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-emerald-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Dark Store & Delivery Manager Financial Performance
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredStores.length} of {stores.length} dark stores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3.5 py-3">Dark Store Name</th>
                <th className="px-3.5 py-3">Delivery Manager</th>
                <th className="px-3.5 py-3 text-center">Status</th>
                <th className="px-3.5 py-3 text-right">Orders (Del/Canc)</th>
                <th className="px-3.5 py-3 text-right">Product Sales</th>
                <th className="px-3.5 py-3 text-right">Delivery Fees</th>
                <th className="px-3.5 py-3 text-right font-bold text-emerald-800 bg-emerald-50/40">
                  Total Store Sale
                </th>
                <th className="px-3.5 py-3 text-right text-rose-700">Store Expenses</th>
                <th className="px-3.5 py-3 text-right font-bold">Net Profit</th>
                <th className="px-3.5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStores.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition">
                  {/* Store Name & Location */}
                  <td className="px-3.5 py-2.5">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                      <span>{s.storeName || s.name}</span>
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <span>{s.area} {s.city ? `• ${s.city}` : ""}</span>
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-400">ID: {s.id}</span>
                  </td>

                  {/* Manager & Contact */}
                  <td className="px-3.5 py-2.5">
                    <div className="font-medium text-slate-800">{s.managerName || "Store Manager"}</div>
                    {s.phone && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-2.5 w-2.5 text-slate-400" />
                        <span>{s.phone}</span>
                      </div>
                    )}
                    {s.email && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Mail className="h-2.5 w-2.5 text-slate-400" />
                        <span className="truncate max-w-[130px]">{s.email}</span>
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3.5 py-2.5 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        s.status === "Active" || s.status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>

                  {/* Orders */}
                  <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-700">
                    <div className="font-bold text-slate-900">{s.totalOrders} total</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      <span className="text-emerald-700 font-medium">{s.completedOrders} del</span> •{" "}
                      <span className="text-rose-600 font-medium">{s.cancelledOrders || 0} can</span>
                    </div>
                  </td>

                  {/* Product Sales */}
                  <td className="px-3.5 py-2.5 text-right tabular-nums font-medium text-slate-900">
                    {rupee(s.productSales)}
                  </td>

                  {/* Delivery Fees */}
                  <td className="px-3.5 py-2.5 text-right tabular-nums font-semibold text-blue-700">
                    {rupee(s.deliveryRevenue)}
                  </td>

                  {/* Total Sale */}
                  <td className="px-3.5 py-2.5 text-right tabular-nums font-bold text-emerald-800 bg-emerald-50/30">
                    {rupee(s.totalSale)}
                  </td>

                  {/* Store Expenses */}
                  <td className="px-3.5 py-2.5 text-right tabular-nums font-medium text-rose-600">
                    {rupee(s.expenses)}
                  </td>

                  {/* Net Profit */}
                  <td className="px-3.5 py-2.5 text-right tabular-nums font-bold">
                    <span className={s.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}>
                      {rupee(s.netProfit)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(s.id)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                    >
                      <Eye className="h-3 w-3 text-slate-500" /> Details
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredStores.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-slate-400">
                    No dark stores found for this vendor
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DARK STORE DETAIL / LEDGER MODAL */}
      {selectedStoreId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-emerald-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Dark Store: {storeDetail?.store?.name || "Dark Store"}
                  </h3>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    {storeDetail?.store?.status || "Active"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manager: {storeDetail?.store?.managerName} • Phone: {storeDetail?.store?.phone || "—"} • Area: {storeDetail?.store?.area}, {storeDetail?.store?.city}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDetail}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading dark store records...</div>
            ) : (
              <div className="space-y-4 pt-4">
                {/* Store Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    type="button"
                    onClick={() => setModalTab("orders")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      modalTab === "orders"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    Fulfilled Orders ({storeDetail?.orders?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("expenses")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      modalTab === "expenses"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Store Expenses ({storeDetail?.expenses?.length || 0})
                  </button>
                </div>

                {/* TAB 1: ORDERS */}
                {modalTab === "orders" && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Recent Orders Fulfilled by this Dark Store
                    </h4>
                    <div className="rounded-lg border border-slate-200 overflow-x-auto max-h-72">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase font-semibold text-slate-500 sticky top-0">
                          <tr>
                            <th className="px-3 py-2">Order #</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Customer</th>
                            <th className="px-3 py-2 text-right">Items</th>
                            <th className="px-3 py-2 text-right">Product Sales</th>
                            <th className="px-3 py-2 text-right">Delivery Fee</th>
                            <th className="px-3 py-2 text-right font-bold text-emerald-800">Total Paid</th>
                            <th className="px-3 py-2 text-center">Payment</th>
                            <th className="px-3 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(storeDetail?.orders || []).map((o) => (
                            <tr key={o._id} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-mono font-medium">{o.orderNumber}</td>
                              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                {new Date(o.createdAt).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </td>
                              <td className="px-3 py-2 text-slate-700 truncate max-w-[120px]">{o.customerName}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{o.itemsCount}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                                {rupee(o.productSales)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-blue-700">{rupee(o.deliveryCharge)}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">
                                {rupee(o.totalAmount)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] uppercase font-medium">
                                  {o.paymentMethod}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold capitalize ${
                                    o.status === "delivered"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : o.status === "cancelled"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {o.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(!storeDetail?.orders || storeDetail.orders.length === 0) && (
                            <tr>
                              <td colSpan={9} className="py-6 text-center text-slate-400">
                                No orders found for this dark store
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 2: EXPENSES */}
                {modalTab === "expenses" && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Operational Expenses Incurred by this Dark Store
                    </h4>
                    <div className="rounded-lg border border-slate-200 overflow-x-auto max-h-72">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase font-semibold text-slate-500 sticky top-0">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Title</th>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2">Payment Method</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(storeDetail?.expenses || []).map((exp) => (
                            <tr key={exp._id} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                {new Date(exp.expenseDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-900">{exp.title}</td>
                              <td className="px-3 py-2">
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                  {exp.category}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{exp.paymentMethod || "Bank"}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-bold text-rose-600">
                                {rupee(exp.amount)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                                    exp.status === "Approved" || exp.status === "Paid"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {exp.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(!storeDetail?.expenses || storeDetail.expenses.length === 0) && (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400">
                                No expenses recorded for this dark store
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
