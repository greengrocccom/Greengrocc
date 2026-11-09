import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Printer,
  RefreshCw,
  ShoppingBag,
  Tractor,
  Coins,
  Wallet,
  CheckCircle2,
  Store,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

export default function VendorProfitLossPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    preset: "last30",
    startDate: "",
    endDate: "",
  });
  const [storeFilter, setStoreFilter] = useState("ALL");
  const [pnlData, setPnlData] = useState(null);

  const fetchProfitLoss = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        preset: filter.preset,
        startDate: filter.startDate,
        endDate: filter.endDate,
        storeId: storeFilter,
      };
      const res = await vendorApi.getProfitLoss(params);
      if (res?.success) {
        setPnlData(res);
      } else {
        setError(res?.message || "Failed to load profit & loss statement");
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err.message || "Failed to load P&L");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfitLoss();
  }, [filter, storeFilter]);

  const k = pnlData?.kpis || {};
  const v = pnlData?.vendor || {};
  const p = pnlData?.period || {};
  const expenseBreakdown = pnlData?.expenseBreakdown || {};

  const grossSales = Number(k.grossProductSales || 0);
  const procurementCost = Number(k.farmerProcurementCost || 0);
  const grossProfit = Number(k.grossProfit || 0);
  const grossMargin = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0;

  const adminComm = Number(k.adminCommission || 0);
  const operatingProfit = Number(k.operatingProfit || 0);
  const operatingMargin = grossSales > 0 ? (operatingProfit / grossSales) * 100 : 0;

  const vendorExpenses = Number(k.vendorOperatingExpenses || 0);
  const deliveryContribution = Number(k.netDeliveryProfitContribution || 0);
  const netProfit = Number(k.netProfit || 0);
  const netMargin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Profit & Loss Statement</h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {v.vendorName || "ABC Agro"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Standard P&L accounting statement: Gross Revenue, Procurement (COGS), Commission & Operating Profit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Print P&L
          </button>
          <button
            type="button"
            onClick={fetchProfitLoss}
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

      {/* Date Filter */}
      <FinanceDateFilter
        preset={filter.preset}
        startDate={filter.startDate}
        endDate={filter.endDate}
        onFilterChange={setFilter}
      />

      {/* High-Level 3 Metric Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gross Margin</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{pct(grossMargin)}</span>
            <span className="text-xs font-medium text-slate-600">{rupee(grossProfit)}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Product Sales minus Farmer Procurement</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Operating Margin</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-2xl font-bold tabular-nums ${operatingProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
              {pct(operatingMargin)}
            </span>
            <span className="text-xs font-medium text-slate-600">{rupee(operatingProfit)}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">After {Number(k.commissionRate) || 0}% Admin Commission</p>
        </div>

        <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">Net Profit Margin</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-2xl font-bold tabular-nums ${netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
              {pct(netMargin)}
            </span>
            <span className="text-xs font-bold text-emerald-800">{rupee(netProfit)}</span>
          </div>
          <p className="text-[10px] text-emerald-700 mt-1">Final vendor bottom-line earnings</p>
        </div>
      </div>

      {/* Detailed P&L Accounting Statement Sheet */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="bg-slate-900 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Statement of Profit and Loss</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Reporting Period:{" "}
                {p.startDate ? new Date(p.startDate).toLocaleDateString("en-IN") : "All Time"} to{" "}
                {p.endDate ? new Date(p.endDate).toLocaleDateString("en-IN") : "Present"} (Asia/Kolkata)
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded">
                Currency: INR (₹)
              </span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {/* Section 1: Revenue */}
          <div className="p-4 bg-slate-50/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">1. Revenue from Sales</h3>
            <div className="space-y-1.5 pl-2">
              <div className="flex justify-between text-slate-700">
                <span>Gross Product Sales (Items Billed)</span>
                <span className="font-semibold text-slate-900 tabular-nums">{rupee(grossSales)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Cancelled Orders Value (Excluded)</span>
                <span className="text-rose-500 tabular-nums">- {rupee(k.cancelledOrdersCost)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Delivery Charges Collected from Customers</span>
                <span className="text-blue-600 tabular-nums">{rupee(k.deliveryCharges)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Net Sales Recognized</span>
                <span className="tabular-nums">{rupee(grossSales)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Cost of Procurement (COGS) */}
          <div className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">2. Cost of Procurement (COGS)</h3>
            <div className="space-y-1.5 pl-2">
              <div className="flex justify-between text-slate-700">
                <span>Farmer Sourcing & Crop Purchases</span>
                <span className="font-semibold text-amber-800 tabular-nums">- {rupee(procurementCost)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Farmer Payouts Disbursed</span>
                <span className="text-slate-600 tabular-nums">{rupee(k.farmerPaidAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Outstanding Farmer Payables</span>
                <span className="text-amber-600 tabular-nums">{rupee(k.farmerPendingPayables)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Gross Profit */}
          <div className="p-4 bg-emerald-50/30">
            <div className="flex justify-between items-center font-bold text-sm text-slate-900">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Gross Profit (Product Sales - Procurement)</span>
              </div>
              <span className={`tabular-nums ${grossProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                {rupee(grossProfit)}
              </span>
            </div>
          </div>

          {/* Section 4: Platform Commission */}
          <div className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">3. Platform Fees & Commission</h3>
            <div className="space-y-1.5 pl-2">
              <div className="flex justify-between text-slate-700">
                <span>Admin Commission ({Number(k.commissionRate) || 0}% on Product Sales)</span>
                <span className="font-semibold text-indigo-700 tabular-nums">- {rupee(adminComm)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Commission Paid to Admin</span>
                <span className="text-slate-600 tabular-nums">{rupee(k.commissionPaid)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Commission Remaining Payable</span>
                <span className="text-indigo-600 tabular-nums">{rupee(k.pendingCommission)}</span>
              </div>
            </div>
          </div>

          {/* Section 5: Operating Profit */}
          <div className="p-4 bg-slate-50/60">
            <div className="flex justify-between items-center font-bold text-sm text-slate-900">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-slate-700" />
                <span>Operating Profit (Gross Profit - Admin Commission)</span>
              </div>
              <span className={`tabular-nums ${operatingProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                {rupee(operatingProfit)}
              </span>
            </div>
          </div>

          {/* Section 6: Vendor Operating Expenses */}
          <div className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">4. Vendor Operating Expenses</h3>
            <div className="space-y-1.5 pl-2">
              {Object.entries(expenseBreakdown).map(([category, amount]) => (
                <div key={category} className="flex justify-between text-slate-700 text-xs">
                  <span>{category}</span>
                  <span className="font-medium text-rose-600 tabular-nums">- {rupee(amount)}</span>
                </div>
              ))}
              {Object.keys(expenseBreakdown).length === 0 && (
                <div className="text-slate-400 text-xs italic">No operational expenses recorded for this period</div>
              )}
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Vendor Operating Expenses</span>
                <span className="text-rose-600 tabular-nums">- {rupee(vendorExpenses)}</span>
              </div>
            </div>
          </div>

          {/* Section 7: Dark Store Contribution */}
          <div className="p-4 bg-slate-50/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
              5. Dark Store Delivery Contribution
            </h3>
            <div className="space-y-1.5 pl-2">
              <div className="flex justify-between text-slate-700">
                <span>Delivery Fees Revenue</span>
                <span className="font-semibold text-blue-700 tabular-nums">{rupee(k.deliveryRevenue)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Dark Store Operating Expenses (Riders/Dark Store)</span>
                <span className="font-semibold text-rose-600 tabular-nums">- {rupee(k.darkStoreExpenses)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Net Delivery Profit Contribution</span>
                <span className={`tabular-nums ${deliveryContribution >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {deliveryContribution >= 0 ? "+" : ""} {rupee(deliveryContribution)}
                </span>
              </div>
            </div>
          </div>

          {/* Final Row: Net Profit */}
          <div className="p-5 bg-emerald-100/60 border-t-2 border-emerald-400">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-base font-extrabold text-emerald-950 uppercase tracking-wide">
                  Net Profit (Bottom-Line Earnings)
                </span>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Operating Profit - Vendor Expenses + Dark Store Contribution
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-xl md:text-2xl font-extrabold tabular-nums ${
                    netProfit >= 0 ? "text-emerald-800" : "text-rose-700"
                  }`}
                >
                  {rupee(netProfit)}
                </span>
                <div className="text-xs font-semibold text-emerald-900">{pct(netMargin)} net margin</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

