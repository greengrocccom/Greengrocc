import { useEffect, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Truck,
  Building2,
  Cpu,
  Layers,
  ShoppingBag,
  HelpCircle,
  RefreshCw,
  FileText,
} from "lucide-react";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function ProfitLossPage() {
  const [filter, setFilter] = useState({
    preset: "last30",
    startDate: "",
    endDate: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    completedOrders: 0,
    totalKmCovered: 0,
    grossProductSales: 0,
    refunds: 0,
    netProductSalesHandled: 0,
    customerDeliveryCharges: 0,
    recognizedDeliveryRevenue: 0,
    deliveryExpenses: 0,
    riderDeliveryPayouts: 0,
    recordedDeliveryExpenses: 0,
    storeExpenses: 0,
    packagingExpenses: 0,
    technologyExpenses: 0,
    otherExpenses: 0,
    totalOperatingExpenses: 0,
    deliveryOperatingProfit: 0,
    netProfit: 0,
    netProfitMargin: 0,
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await managerApi.getProfitLoss(filter);
      if (res.data?.success) {
        setData(res.data.metrics || {});
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load profit and loss");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const isNetProfitPositive = data.netProfit >= 0;

  return (
    <PageShell
      title="Profit & Loss Statement"
      meta="Operational finance statement tracking recognized delivery revenue, dark store expenses, and net profit"
      actions={
        <button type="button" onClick={loadData} className="btn-outline" title="Refresh Statement">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      }
    >
      {/* Date Filter Bar */}
      <FinanceDateFilter
        preset={filter.preset}
        startDate={filter.startDate}
        endDate={filter.endDate}
        onFilterChange={(newFilter) => setFilter(newFilter)}
      />

      {/* Primary Profit KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Delivery Revenue */}
        <div className="card p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Recognized Delivery Revenue</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="stat-value text-slate-900 mt-1">
            {rupee(data.recognizedDeliveryRevenue)}
          </p>
          <span className="text-[11px] text-slate-400">
            From {data.completedOrders} fulfilled delivery orders
          </span>
        </div>

        {/* Operating Expenses */}
        <div className="card p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Total Operating Expenses</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <p className="stat-value text-rose-600 mt-1">
            {rupee(data.totalOperatingExpenses)}
          </p>
          <span className="text-[11px] text-slate-400">
            Rider payouts, fuel, rent, bags & tech
          </span>
        </div>

        {/* Net Profit */}
        <div className={`card p-4 border-l-4 ${isNetProfitPositive ? "border-l-emerald-500" : "border-l-rose-500"}`}>
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Delivery Net Profit</span>
            {isNetProfitPositive ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-600" />
            )}
          </div>
          <p className={`stat-value mt-1 ${isNetProfitPositive ? "text-emerald-700" : "text-rose-700"}`}>
            {rupee(data.netProfit)}
          </p>
          <span className="text-[11px] text-slate-500 font-semibold">
            Margin: {data.netProfitMargin}%
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Main Income & Expense Breakdown Table */}
      <div className="card overflow-hidden">
        <div className="card-header bg-slate-50">
          <span className="card-title">Income & Expense Ledger</span>
          <span className="text-xs text-slate-500 font-medium">
            Timezone: Asia/Kolkata (IST)
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-6 text-xs">
          {/* Section 1: Revenue Recognized */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 border-b border-emerald-100 pb-1 mb-2">
              1. Delivery Revenue Recognized
            </h3>
            <div className="space-y-1.5 pl-2">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-700">Customer Delivery Charges Collected</span>
                <span className="font-semibold text-slate-900">{rupee(data.customerDeliveryCharges)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-700">Dark Store Dispatch & Fulfillment Income</span>
                <span className="font-semibold text-slate-900">
                  {rupee(Math.max(0, data.recognizedDeliveryRevenue - data.customerDeliveryCharges))}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 font-bold bg-emerald-50/60 px-2 rounded-md text-emerald-950">
                <span>Total Recognized Revenue (A)</span>
                <span>{rupee(data.recognizedDeliveryRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Operating Expenses */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 border-b border-rose-100 pb-1 mb-2">
              2. Dark Store Operating Expenses
            </h3>
            <div className="space-y-1.5 pl-2">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-700">Delivery Boy Direct Payouts (Orders & Km)</span>
                <span className="font-semibold text-slate-900">{rupee(data.riderDeliveryPayouts)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-700">Recorded Delivery Expenses (Fuel, Maintenance, Allowances)</span>
                <span className="font-semibold text-slate-900">{rupee(data.recordedDeliveryExpenses)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-700">Store Operating Expenses (Rent, Staff, Electricity, Internet)</span>
                <span className="font-semibold text-slate-900">{rupee(data.storeExpenses)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-700">Packaging Expenses (Bags, Boxes, Labels)</span>
                <span className="font-semibold text-slate-900">{rupee(data.packagingExpenses)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-700">Technology Expenses (Maps API, Devices, Communication)</span>
                <span className="font-semibold text-slate-900">{rupee(data.technologyExpenses)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-700">Other Miscellaneous Expenses</span>
                <span className="font-semibold text-slate-900">{rupee(data.otherExpenses)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 font-bold bg-rose-50/60 px-2 rounded-md text-rose-950">
                <span>Total Operating Expenses (B)</span>
                <span>{rupee(data.totalOperatingExpenses)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Profit Calculation */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              3. Operational Profit Summary
            </h3>
            <div className="flex items-center justify-between py-1 text-slate-700">
              <span>Delivery Operating Profit (Revenue − Delivery Direct Costs)</span>
              <span className="font-bold text-slate-900">{rupee(data.deliveryOperatingProfit)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-slate-200 text-sm font-extrabold text-slate-950">
              <span>Delivery Manager Net Profit (A − B)</span>
              <span className={isNetProfitPositive ? "text-emerald-700" : "text-rose-700"}>
                {rupee(data.netProfit)}
              </span>
            </div>
          </div>

          {/* Informational Callout: Product Sales Managed */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <ShoppingBag className="h-4 w-4 text-amber-700" />
              <span>Customer Product Sales Handled (Operational Context)</span>
            </div>
            <p className="text-[11px] text-amber-800">
              During this period, your dark store fulfilled <b>{rupee(data.netProductSalesHandled)}</b> in net customer product orders ({data.completedOrders} orders). In accordance with platform governance, product sales belong to vendors/partners and are not merged into delivery operational profit.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

