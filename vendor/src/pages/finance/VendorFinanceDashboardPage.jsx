import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Truck,
  CheckCircle2,
  XCircle,
  CreditCard,
  RefreshCw,
  Coins,
  Store,
  Tractor,
  Wallet,
  ArrowUpRight,
  Clock,
  Layers,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function VendorFinanceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    preset: "last30",
    startDate: "",
    endDate: "",
  });
  const [storeFilter, setStoreFilter] = useState("ALL");
  const [dashboardData, setDashboardData] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        preset: filter.preset,
        startDate: filter.startDate,
        endDate: filter.endDate,
        storeId: storeFilter,
      };
      const res = await vendorApi.getFinanceDashboard(params);
      if (res?.success) {
        setDashboardData(res);
      } else {
        setError(res?.message || "Failed to load finance data");
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err.message || "Failed to load finance dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [filter, storeFilter]);

  const k = dashboardData?.kpis || {};
  const v = dashboardData?.vendor || {};

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Vendor Finance Dashboard</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              {v.vendorName || v.name || "Vendor"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time business revenue, dark store sales, procurement costs, commission & net profit
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dashboardData?.darkStores?.length > 1 && (
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs"
            >
              <option value="ALL">All Dark Stores ({dashboardData.darkStores.length})</option>
              {dashboardData.darkStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.area || s.city})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={fetchDashboard}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* Date Filter Component */}
      <FinanceDateFilter
        preset={filter.preset}
        startDate={filter.startDate}
        endDate={filter.endDate}
        onFilterChange={setFilter}
      />

      {/* Primary KPI Strip - Compact & Responsive 8-Cards Layout */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
        {/* 1. Customer Paid Total */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Customer Paid Total">
              Customer Paid
            </span>
            <CreditCard className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-emerald-700 truncate tabular-nums">
            {loading ? "..." : rupee(k.customerPaymentTotal)}
          </p>
          <span className="text-[9.5px] font-medium text-emerald-600 truncate block">
            {k.totalOrders || 0} orders placed
          </span>
        </div>

        {/* 2. Cancelled Orders Cost */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Cancelled Orders Cost">
              Cancelled Cost
            </span>
            <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-rose-600 truncate tabular-nums">
            {loading ? "..." : rupee(k.cancelledOrdersCost)}
          </p>
          <span className="text-[9.5px] font-medium text-rose-500 truncate block">
            - {rupee(k.cancelledOrdersCost)} ({k.cancelledOrders || 0} ord)
          </span>
        </div>

        {/* 3. Gross Product Sales */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Gross Product Sales">
              Product Sales
            </span>
            <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate tabular-nums">
            {loading ? "..." : rupee(k.grossProductSales)}
          </p>
          <span className="text-[9.5px] text-slate-400 truncate block">
            Items billed
          </span>
        </div>

        {/* 4. Farmer Procurement Cost */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 truncate" title="Farmer Procurement Cost">
              Procurement
            </span>
            <Tractor className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-amber-700 truncate tabular-nums">
            {loading ? "..." : rupee(k.farmerProcurementCost)}
          </p>
          <span className="text-[9.5px] text-slate-400 truncate block">
            Paid: {rupee(k.farmerPaidAmount)}
          </span>
        </div>

        {/* 5. Admin Commission */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 truncate" title="Admin Commission">
              Admin Comm ({Number(k.commissionRate) || 0}%)
            </span>
            <Coins className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-indigo-700 truncate tabular-nums">
            {loading ? "..." : rupee(k.adminCommission)}
          </p>
          <span className="text-[9.5px] font-medium text-slate-400 truncate block">
            Pending: {rupee(k.pendingCommission)}
          </span>
        </div>

        {/* 6. Vendor Operating Expenses */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Vendor Operating Expenses">
              Expenses
            </span>
            <Wallet className="h-3.5 w-3.5 shrink-0 text-rose-500" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-rose-600 truncate tabular-nums">
            {loading ? "..." : rupee(k.vendorOperatingExpenses)}
          </p>
          <span className="text-[9.5px] text-slate-400 truncate block">
            Store & staff costs
          </span>
        </div>

        {/* 7. Operating Profit */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate" title="Operating Profit">
              Operating Profit
            </span>
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className={`mt-1 text-base sm:text-lg font-bold tracking-tight truncate tabular-nums ${Number(k.operatingProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
            {loading ? "..." : rupee(k.operatingProfit)}
          </p>
          <span className="text-[9.5px] font-medium text-slate-500 truncate block">
            Sales - Cost - Comm
          </span>
        </div>

        {/* 8. Net Profit */}
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 truncate" title="Net Vendor Profit">
              Net Profit
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className={`mt-1 text-base sm:text-lg font-bold tracking-tight truncate tabular-nums ${Number(k.netProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
            {loading ? "..." : rupee(k.netProfit)}
          </p>
          <span className="text-[9.5px] font-medium text-emerald-700 truncate block">
            Ops + Dark Store Contrib
          </span>
        </div>
      </div>

      {/* Middle Analytical Grid: Revenue Breakdown & Farmer Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Quick Finance Flow Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">Financial Performance Breakdown</h3>
            <span className="text-xs text-slate-400">Standardized IST Boundaries</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 p-3 space-y-2 border border-slate-100">
              <span className="font-bold text-slate-700 block">Product Business Inflows</span>
              <div className="flex justify-between text-slate-600">
                <span>Gross Product Sales:</span>
                <span className="font-semibold text-slate-900">{rupee(k.grossProductSales)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Farmer Procurement Cost:</span>
                <span className="font-semibold text-amber-700">- {rupee(k.farmerProcurementCost)}</span>
              </div>
              <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1 font-bold">
                <span>Gross Product Margin:</span>
                <span className="text-emerald-700">{rupee(k.grossProductProfit)}</span>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 space-y-2 border border-slate-100">
              <span className="font-bold text-slate-700 block">Operating Deductions & Contributions</span>
              <div className="flex justify-between text-slate-600">
                <span>Admin Commission ({k.commissionRate}%):</span>
                <span className="font-semibold text-rose-600">- {rupee(k.adminCommission)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Vendor Operating Expenses:</span>
                <span className="font-semibold text-rose-600">- {rupee(k.vendorOperatingExpenses)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Dark Store Delivery Contrib:</span>
                <span className="font-semibold text-sky-700">+ {rupee(k.deliveryContribution)}</span>
              </div>
              <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1 font-bold">
                <span>Final Net Profit:</span>
                <span className={Number(k.netProfit) >= 0 ? "text-emerald-700" : "text-rose-600"}>
                  {rupee(k.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Trend Mini-Bar */}
          {dashboardData?.monthlyTrend?.length > 0 && (
            <div className="pt-2">
              <span className="text-xs font-bold text-slate-800 block mb-2">Monthly Sales Trend</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {dashboardData.monthlyTrend.map((m) => {
                  const maxSales = Math.max(...dashboardData.monthlyTrend.map((d) => d.sales || 1));
                  const pct = Math.min(100, Math.round((m.sales / maxSales) * 100));
                  return (
                    <div key={m.month} className="flex items-center gap-3 text-xs">
                      <span className="w-16 font-semibold text-slate-600">{m.month}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-20 text-right font-bold text-slate-900">{rupee(m.sales)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Quick Action Links & Pending Settlements */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">Settlements & Payables</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-100">
              <div>
                <span className="font-bold text-amber-900 block">Farmer Pending Payables</span>
                <span className="text-[10px] text-amber-700">Dues to supply farmers</span>
              </div>
              <span className="text-sm font-bold text-amber-800">{rupee(k.farmerPendingPayables)}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50 border border-indigo-100">
              <div>
                <span className="font-bold text-indigo-900 block">Pending Admin Commission</span>
                <span className="text-[10px] text-indigo-700">Due to GreenGrocc Admin</span>
              </div>
              <span className="text-sm font-bold text-indigo-800">{rupee(k.pendingCommission)}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 block">Pending Settlements</span>
                <span className="text-[10px] text-slate-500">Unprocessed settlements</span>
              </div>
              <span className="text-sm font-bold text-slate-800">{rupee(k.pendingSettlements)}</span>
            </div>
          </div>

          {/* Navigation Quick Links */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs font-semibold">
            <Link
              to="/vendor/finance/sales-reports"
              className="flex items-center justify-between p-2 rounded-lg text-slate-700 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                Detailed Sales Reports
              </span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              to="/vendor/finance/farmer-payments"
              className="flex items-center justify-between p-2 rounded-lg text-slate-700 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <Tractor className="h-4 w-4 text-amber-600" />
                Farmer Vendor Payments
              </span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              to="/vendor/finance/delivery-manager-reports"
              className="flex items-center justify-between p-2 rounded-lg text-slate-700 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4 text-sky-600" />
                Dark Store Performance
              </span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              to="/vendor/finance/expenses"
              className="flex items-center justify-between p-2 rounded-lg text-slate-700 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-rose-500" />
                Vendor Expense Management
              </span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>

          </div>
        </div>
      </div>
    </div>
  );
}

