import { useState, useEffect } from "react";
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  XCircle,
  CreditCard,
  Download,
  Search,
  Filter,
  RefreshCw,
  Coins,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Store,
  Layers,
  ArrowUpRight,
  Tractor,
  Wallet,
  Percent,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { Boxes } from "lucide-react";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function VendorSalesReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    preset: "last30",
    startDate: "",
    endDate: "",
  });
  const [storeFilter, setStoreFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reportData, setReportData] = useState(null);
  const auth = useVendorAuth();
  const isSeller = auth?.vendor?.vendorType === "seller" || auth?.vendor?.vendor?.vendorType === "seller" || reportData?.vendor?.vendorType === "seller" || reportData?.vendor?.isSeller;
  const [sellerValuation, setSellerValuation] = useState(null);

  useEffect(() => {
    if (isSeller) {
      vendorApi.getFinanceSellerReports({ onlyAdded: "true" })
        .then((res) => {
          if (res?.success && res?.kpis?.totalProcurementValuation !== undefined) {
            setSellerValuation(Number(res.kpis.totalProcurementValuation));
          }
        })
        .catch(() => {});
    }
  }, [isSeller]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        preset: filter.preset,
        startDate: filter.startDate,
        endDate: filter.endDate,
        storeId: storeFilter,
        status: statusFilter,
        paymentMethod: paymentFilter,
        search,
        page,
        limit: 15,
      };
      const res = await vendorApi.getFinanceSalesReports(params);
      if (res?.success) {
        setReportData(res);
      } else {
        setError(res?.message || "Failed to load sales reports");
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err.message || "Failed to load sales reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filter, storeFilter, statusFilter, paymentFilter, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReports();
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!reportData?.data?.length) return;
    const headers = [
      "Order Number",
      "Date",
      "Dark Store",
      "Customer",
      "Items Count",
      "Product Sales (INR)",
      "Delivery Fee (INR)",
      "Customer Paid (INR)",
      "Admin Commission (INR)",
      "Payment Method",
      "Status",
    ];

    const rows = reportData.data.map((o) => [
      o.orderNumber || "",
      new Date(o.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      `"${o.storeName || ""}"`,
      `"${o.customerName || ""}"`,
      o.itemsCount || 0,
      o.productSales || 0,
      o.deliveryCharge || 0,
      o.customerPaidAmount || 0,
      o.adminCommission || 0,
      o.paymentMethod || "",
      o.status || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `vendor_sales_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const k = reportData?.kpis || {};
  const orders = reportData?.data || [];
  const charts = reportData?.charts || {};
  const darkStores = reportData?.darkStores || [];
  const darkStoreBreakdown = reportData?.darkStoreBreakdown || [];

  // Compute totalSale, procurement, separate expenses & netProfit
  const grossSales = Number(k.grossProductSales || 0);
  const deliveryFee = Number(k.deliveryCharges || 0);
  const totalSale = Number(k.totalSale || grossSales + deliveryFee);
  const totalProcurement = Number(k.farmerProcurementCost || 0);
  const effectiveProcurement = isSeller
    ? (sellerValuation !== null ? sellerValuation : Number(k.sellerProcurementValuation || k.totalProcurementValue || k.farmerProcurementCost || 0))
    : totalProcurement;
  const vendorExpenses = Number(k.vendorOperatingExpenses || 0);
  const darkStoreExpenses = Number(k.darkStoreExpenses || 0);

  // Commission & Gross Customer Paid details
  const cancelledOrdersCost = Number(k.cancelledOrdersCost || 0);
  const customerPaidTotal = Number(
    k.customerPaymentTotal && Number(k.customerPaymentTotal) > totalSale
      ? k.customerPaymentTotal
      : totalSale + cancelledOrdersCost
  );
  const commissionRate = Number(k.commissionRate || reportData?.vendor?.commissionRate || 10);
  const totalDarkStoresCommission = darkStoreBreakdown.length > 0
    ? darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.adminCommission ?? d.commission ?? Math.round((Number(d.totalSale || 0) * commissionRate) / 100)) || 0), 0)
    : 0;

  const adminCommission = totalDarkStoresCommission > 0
    ? totalDarkStoresCommission
    : Number(
        k.adminCommission !== undefined && k.adminCommission !== null
          ? k.adminCommission
          : Math.round((totalSale * commissionRate) / 100)
      );

  // Formula as instructed:
  // TOTAL SALE - Total Procurement Value (एकूण शेतीमाल खरेदी) - Admin Commission - Total Vendor Expenses - Delivery Manager Expenses = Net Profit
  const netProfit = totalSale - effectiveProcurement - adminCommission - vendorExpenses - darkStoreExpenses;
  const currentProfit = Number(k.currentProfit || k.deliveredSales || 0);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Vendor Sales Reports</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Delivery Manager & Dark Store Wise
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor customer paid total, gross product sales, delivery charges, dark store expenses & net profit
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Dark Store Selector Dropdown */}
          <select
            value={storeFilter}
            onChange={(e) => {
              setStoreFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All Dark Stores ({darkStores.length})</option>
            {darkStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.area || s.city || "Store"})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!orders.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export CSV
          </button>
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

      {/* Primary KPI Strip - Neatly Structured */}
      <div className="space-y-3">
        {/* ROW 1: Orders & Sales Inflows (4 Cards) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          {/* 1. Customer Paid Total */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Customer Paid Total">
                CUSTOMER PAID TOTAL
              </span>
              <CreditCard className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-emerald-700 truncate tabular-nums">
              {loading ? "..." : rupee(customerPaidTotal)}
            </p>
            <span className="text-[10px] font-medium text-emerald-600 truncate block mt-0.5">
              {k.totalOrders || 0} Total orders placed
            </span>
          </div>

          {/* 2. Cancelled Orders Cost */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Cancelled Orders Cost">
                CANCELLED ORDERS COST
              </span>
              <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-rose-600 truncate tabular-nums">
              {loading ? "..." : rupee(k.cancelledOrdersCost)}
            </p>
            <span className="text-[10px] font-medium text-rose-500 truncate block mt-0.5">
              - {rupee(k.cancelledOrdersCost)} ({k.cancelledOrders || 0} cancelled)
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
              {loading ? "..." : rupee(k.grossProductSales)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Total items billed
            </span>
          </div>

          {/* 4. Delivery Charges */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Delivery Charges">
                DELIVERY CHARGES
              </span>
              <Truck className="h-4 w-4 shrink-0 text-blue-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-blue-700 truncate tabular-nums">
              {loading ? "..." : rupee(k.deliveryCharges)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Delivery service fees
            </span>
          </div>
        </div>

        {/* ROW 2: Total Sale, Procurement & Separate Expenses (4 Cards) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          {/* 5. Total Sale */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-900 truncate" title="Total Sale">
                TOTAL SALE
              </span>
              <Coins className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-emerald-700 truncate tabular-nums">
              {loading ? "..." : rupee(totalSale)}
            </p>
            <span className="text-[10px] font-medium text-emerald-600 truncate block mt-0.5">
              Gross Sales + Delivery
            </span>
          </div>

          {/* 6. Total Procurement Value (Earning Statement Total for Farmer / खरेदी भांडवल मूल्य for Seller) */}
          <div className="rounded-xl border border-amber-300 bg-amber-50/40 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider text-amber-900 truncate"
                title={isSeller ? "खरेदी भांडवल मूल्य (Seller Procurement Valuation)" : "Total Procurement Value (Earning Statement Total)"}
              >
                TOTAL PROCUREMENT VALUE
              </span>
              {isSeller ? (
                <Boxes className="h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <Tractor className="h-4 w-4 shrink-0 text-amber-600" />
              )}
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-amber-800 truncate tabular-nums">
              {loading ? "..." : rupee(effectiveProcurement)}
            </p>
            <span className="text-[10px] text-amber-800 font-semibold truncate block mt-0.5">
              {isSeller ? "खरेदी भांडवल मूल्य (Seller Stock Valuation)" : "Earning Statement Total (प्रमाणित खरेदी)"}
            </span>
          </div>

          {/* 7. Total Vendor Expenses (Separate) */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 truncate" title="Total Vendor Expenses">
                TOTAL VENDOR EXPENSES
              </span>
              <Wallet className="h-4 w-4 shrink-0 text-rose-500" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-rose-600 truncate tabular-nums">
              {loading ? "..." : rupee(vendorExpenses)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Store & ops costs
            </span>
          </div>

          {/* 8. Delivery Manager Expenses (Separate) */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 truncate" title="Delivery Manager Expenses">
                DELIVERY MANAGER EXPENSES
              </span>
              <TrendingDown className="h-4 w-4 shrink-0 text-amber-500" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-amber-600 truncate tabular-nums">
              {loading ? "..." : rupee(darkStoreExpenses)}
            </p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              Dark store & riders costs
            </span>
          </div>
        </div>

        {/* ROW 3: Final Profitability (Admin Commission, Net Profit & Current Profit) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Admin Commission (Calculated on CUSTOMER PAID TOTAL) */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-950 truncate" title="Admin Commission">
                TOTAL ADMIN COMMISSION (एकूण कमिशन)
              </span>
              <Percent className="h-4 w-4 shrink-0 text-indigo-600" />
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-indigo-700 truncate tabular-nums">
              {loading ? "..." : rupee(adminCommission)}
            </p>
            <span className="text-[10px] font-medium text-indigo-800 truncate block mt-0.5">
              {commissionRate}% on TOTAL SALE ({rupee(totalSale)})
            </span>
          </div>

          {/* 9. Net Profit */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 truncate" title="Net Profit">
                NET PROFIT (नक्त नफा)
              </span>
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className={`mt-1.5 text-xl sm:text-2xl font-bold tracking-tight truncate tabular-nums ${netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
              {loading ? "..." : rupee(netProfit)}
            </p>
            <span className="text-[10px] font-medium text-emerald-800 truncate block mt-0.5">
              TOTAL SALE ({rupee(totalSale)}) - {isSeller ? "खरेदी भांडवल" : "खरेदी"} ({rupee(effectiveProcurement)}) - कमिशन ({rupee(adminCommission)}) - व्हेंडर खर्च ({rupee(vendorExpenses)}) - स्टोअर खर्च ({rupee(darkStoreExpenses)})
            </span>
          </div>

          {/* 10. Current Profit */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 truncate" title="Current Profit">
                CURRENT PROFIT (वितरित नफा)
              </span>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-emerald-700 truncate tabular-nums">
              {loading ? "..." : rupee(currentProfit)}
            </p>
            <span className="text-[10px] font-medium text-emerald-700 truncate block mt-0.5">
              {k.completedOrders || 0} Delivered & Paid orders
            </span>
          </div>
        </div>
      </div>

      {/* DELIVERY MANAGER & DARK STORE WISE SALES & EXPENSES SECTION */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-emerald-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Delivery Manager & Dark Store Wise Sales & Expenses
            </h2>
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              {darkStores.length} Dark Stores
            </span>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setStoreFilter("ALL");
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                storeFilter === "ALL"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Stores
            </button>
            {darkStores.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStoreFilter(s.id);
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  storeFilter === s.id
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Dark Store Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Dark Store / Delivery Manager</th>
                <th className="px-3 py-2.5 text-right">Orders (Del/Canc)</th>
                <th className="px-3 py-2.5 text-right">Customer Paid</th>
                <th className="px-3 py-2.5 text-right">Gross Product Sales</th>
                <th className="px-3 py-2.5 text-right">Delivery Charges</th>
                <th className="px-3 py-2.5 text-right font-bold text-emerald-800">Total Sale</th>
                <th className="px-3 py-2.5 text-right font-bold text-indigo-700">Admin Commission</th>
                <th className="px-3 py-2.5 text-right text-rose-700">Dark Store Expenses</th>
                <th className="px-3 py-2.5 text-right font-bold">Net Profit</th>
                <th className="px-3 py-2.5 text-right text-emerald-700">Current Profit</th>
                <th className="px-3 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {darkStoreBreakdown.map((s) => {
                const isSelected = storeFilter === s.id;
                return (
                  <tr
                    key={s.id}
                    className={`transition ${isSelected ? "bg-emerald-50/40 font-medium" : "hover:bg-slate-50/60"}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-slate-500" />
                        <span>{s.name}</span>
                        {isSelected && (
                          <span className="rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] text-white font-semibold">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {s.area} {s.city ? `• ${s.city}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      <div>{s.totalOrders} total</div>
                      <div className="text-[10px] text-slate-400">
                        <span className="text-emerald-600">{s.completedOrders} del</span> •{" "}
                        <span className="text-rose-500">{s.cancelledOrders} can</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700">
                      {rupee(s.customerPaymentTotal)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">
                      {rupee(s.grossProductSales)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-blue-700">
                      {rupee(s.deliveryCharges)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700">
                      {rupee(s.totalSale)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-indigo-700">
                      {rupee(s.adminCommission ?? s.commission ?? Math.round((Number(s.totalSale || 0) * commissionRate) / 100))}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-rose-600">
                      {rupee(s.totalExpense)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                      <span className={s.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}>
                        {rupee(s.netProfit)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700">
                      {rupee(s.currentProfit)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setStoreFilter(isSelected ? "ALL" : s.id);
                          setPage(1);
                        }}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                            : "bg-emerald-700 text-white hover:bg-emerald-800"
                        }`}
                      >
                        {isSelected ? "Show All" : "Filter Store"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && darkStoreBreakdown.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-xs text-slate-400">
                    No dark store data in this range
                  </td>
                </tr>
              )}
            </tbody>
            {darkStoreBreakdown.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-900">
                <tr>
                  <td className="px-3 py-2.5 text-slate-800">
                    Total Vendor (एकूण व्हेंडर)
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                    {darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.totalOrders) || 0), 0)} total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-800 font-bold">
                    {rupee(darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.customerPaymentTotal) || 0), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {rupee(darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.grossProductSales) || 0), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-blue-700">
                    {rupee(darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.deliveryCharges) || 0), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 font-extrabold">
                    {rupee(darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.totalSale) || 0), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-indigo-700 font-extrabold">
                    {rupee(darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.adminCommission ?? d.commission ?? Math.round((Number(d.totalSale || 0) * commissionRate) / 100)) || 0), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-rose-600 font-bold">
                    {rupee(darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.totalExpense) || 0), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                    <span className={netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}>
                      {rupee(darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.netProfit) || 0), 0))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 font-bold">
                    {rupee(darkStoreBreakdown.reduce((sum, d) => sum + (Number(d.currentProfit) || 0), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-center text-[10px] text-slate-500 font-normal">
                    —
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Payment & Activity Breakdown Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Payment Methods */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs md:col-span-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Payment Method Breakdown
          </h2>
          <div className="space-y-2">
            {(charts?.paymentBreakdown || []).map((p) => (
              <div key={p._id} className="rounded-lg bg-slate-50 p-2.5 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span>{p._id}</span>
                  <span className="text-slate-500 font-normal">({p.count} orders)</span>
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-slate-600">
                  <span>Product Sales:</span>
                  <span className="font-medium text-slate-900">{rupee(p.productSales)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Delivery Charges:</span>
                  <span className="font-medium text-blue-700">{rupee(p.deliveryCharges)}</span>
                </div>
                <div className="mt-1 border-t border-slate-200 pt-1 flex justify-between text-[11px] font-bold text-emerald-700">
                  <span>Total Collected:</span>
                  <span>{rupee(p.productSales + p.deliveryCharges)}</span>
                </div>
              </div>
            ))}
            {(!charts?.paymentBreakdown || charts.paymentBreakdown.length === 0) && (
              <p className="text-xs text-slate-400 py-3 text-center">No payment data in this range</p>
            )}
          </div>
        </div>

        {/* Daily Sales Trend Preview */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs md:col-span-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Daily Sales Activity Trend {storeFilter !== "ALL" ? `(Filtered)` : ""}
          </h2>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {(charts?.dailyTrend || []).slice(-8).map((d) => (
              <div
                key={d._id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0"
              >
                <span className="font-medium text-slate-700">{d._id}</span>
                <span className="text-slate-500">
                  {d.ordersCount} orders ({d.completedCount} delivered)
                </span>
                <span className="font-bold text-slate-900 tabular-nums">{rupee(d.salesAmount)}</span>
              </div>
            ))}
            {(!charts?.dailyTrend || charts.dailyTrend.length === 0) && (
              <p className="text-xs text-slate-400 py-6 text-center">No daily sales in this range</p>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order # or customer..."
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="delivered">Delivered</option>
            <option value="assigned">Assigned</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="ALL">All Payments</option>
            <option value="COD">COD</option>
            <option value="ONLINE">ONLINE</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Order Sales Details {storeFilter !== "ALL" ? `— Filtered Dark Store` : `— All Stores`}
          </h3>
          <span className="text-[11px] text-slate-500">{reportData?.total || 0} total orders</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Date / Time</th>
                <th className="px-3 py-2.5">Order #</th>
                <th className="px-3 py-2.5">Dark Store (Delivery Manager)</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5 text-right">Items</th>
                <th className="px-3 py-2.5 text-right">Product Sales</th>
                <th className="px-3 py-2.5 text-right">Delivery Fee</th>
                <th className="px-3 py-2.5 text-right font-bold text-emerald-800">Customer Paid</th>
                <th className="px-3 py-2.5 text-right">Admin Comm</th>
                <th className="px-3 py-2.5 text-center">Payment</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-slate-50/60 transition">
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2 font-mono font-medium text-slate-900">{o.orderNumber || "—"}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-800">
                      <Store className="h-3 w-3 text-slate-500" />
                      {o.storeName}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700 truncate max-w-[110px]">
                    <div>{o.customerName}</div>
                    {o.customerPhone && <div className="text-[10px] text-slate-400">{o.customerPhone}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{o.itemsCount || 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                    {rupee(o.productSales)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-blue-700">{rupee(o.deliveryCharge)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">
                    {rupee(o.customerPaidAmount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-indigo-700 font-medium">
                    {rupee(o.adminCommission)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 uppercase">
                      {o.paymentMethod || "COD"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
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
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-slate-400">
                    No orders found for this criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {reportData && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
            <span>
              Showing page <strong className="text-slate-900">{reportData.page}</strong> of{" "}
              <strong className="text-slate-900">{reportData.pages}</strong> ({reportData.total} total orders)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={reportData.page <= 1}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(reportData.pages, p + 1))}
                disabled={reportData.page >= reportData.pages}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
