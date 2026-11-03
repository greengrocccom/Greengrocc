import { useEffect, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";
import {
  Download,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Truck,
  CheckCircle2,
  XCircle,
  CreditCard,
  RefreshCw,
  FileSpreadsheet,
  ArrowUpRight,
  Coins,
} from "lucide-react";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function SalesReportsPage() {
  const [filter, setFilter] = useState({
    preset: "last30",
    startDate: "",
    endDate: "",
  });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [riderFilter, setRiderFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [kpis, setKpis] = useState({
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    customerPaymentTotal: 0,
    cancelledOrdersCost: 0,
    deliveryCharges: 0,
    grossProductSales: 0,
    totalSale: 0,
    totalExpense: 0,
    netProfit: 0,
    currentProfit: 0,
    deliveredSales: 0,
    discounts: 0,
    refunds: 0,
    netProductSales: 0,
  });

  const [charts, setCharts] = useState({
    dailyTrend: [],
    statusBreakdown: [],
    paymentBreakdown: [],
  });

  const [tableData, setTableData] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [ridersList, setRidersList] = useState([]);

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await managerApi.getSalesReports({
        ...filter,
        status: statusFilter,
        paymentMethod: paymentFilter,
        riderId: riderFilter,
        search,
        page,
        limit: 15,
      });

      if (res.data?.success) {
        setKpis(res.data.kpis || {});
        setCharts(res.data.charts || {});
        setTableData(res.data.data || []);
        setPagination({
          total: res.data.total || 0,
          pages: res.data.pages || 1,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  };

  const loadRiders = async () => {
    try {
      const res = await managerApi.riders();
      const list = res.data?.riders || res.data?.data || res.data || [];
      if (Array.isArray(list)) setRidersList(list);
    } catch {}
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, statusFilter, paymentFilter, riderFilter, page]);

  useEffect(() => {
    loadRiders();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadReport();
  };

  // CSV Export utility
  const exportToCSV = () => {
    if (!tableData.length) {
      alert("No data available to export");
      return;
    }

    const headers = [
      "Date",
      "Order Number",
      "Customer",
      "Vendor Type",
      "Rider",
      "Product Sales",
      "Discount",
      "Refund",
      "Delivery Charge",
      "Customer Paid",
      "Status",
      "Payment Method",
    ];

    const rows = tableData.map((row) => [
      new Date(row.createdAt).toLocaleDateString("en-IN"),
      row.orderNumber,
      `"${row.customerName}"`,
      row.vendor,
      `"${row.deliveryBoy}"`,
      row.productSales,
      row.discount,
      row.refund,
      row.deliveryCharge,
      row.customerPaidAmount,
      row.status,
      row.paymentMethod,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Sales_Report_${filter.preset || "custom"}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageShell
      title="Sales Reports"
      meta="Comprehensive customer sales analytics, delivery collections, and order fulfillment tracking"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={loadReport}
            className="btn-outline"
            title="Refresh Report"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      }
    >
      {/* Date Filter Bar */}
      <FinanceDateFilter
        preset={filter.preset}
        startDate={filter.startDate}
        endDate={filter.endDate}
        onFilterChange={(newFilter) => {
          setFilter(newFilter);
          setPage(1);
        }}
      />

      {/* KPI Cards Grid - Compact & Responsive 8-Cards Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
        {/* 1. Customer Paid Total */}
        <div className="card p-2 sm:p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Customer Paid Total">
              Customer Paid
            </span>
            <CreditCard className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-emerald-700 truncate tabular-nums">
            {rupee(kpis.customerPaymentTotal)}
          </p>
          <span className="text-[9.5px] font-medium text-emerald-600 truncate block">
            Total orders placed
          </span>
        </div>

        {/* 2. Cancelled Orders Cost */}
        <div className="card p-2 sm:p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Cancelled Orders Cost">
              Cancelled Cost
            </span>
            <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-rose-600 truncate tabular-nums">
            {rupee(kpis.cancelledOrdersCost)}
          </p>
          <span className="text-[9.5px] font-medium text-rose-500 truncate block">
            - {rupee(kpis.cancelledOrdersCost)} ({kpis.cancelledOrders || 0} ord)
          </span>
        </div>

        {/* 3. Gross Product Sales */}
        <div className="card p-2 sm:p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Gross Product Sales">
              Product Sales
            </span>
            <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate tabular-nums">
            {rupee(kpis.grossProductSales)}
          </p>
          <span className="text-[9.5px] text-slate-400 truncate block">
            Total items billed
          </span>
        </div>

        {/* 4. Delivery Charges */}
        <div className="card p-2 sm:p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Delivery Charges">
              Delivery Fee
            </span>
            <Truck className="h-3.5 w-3.5 shrink-0 text-sky-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate tabular-nums">
            {rupee(kpis.deliveryCharges)}
          </p>
          <span className="text-[9.5px] text-slate-400 truncate block">
            Delivery service fees
          </span>
        </div>

        {/* 5. Total Sale */}
        <div className="card p-2 sm:p-2.5 flex flex-col justify-between border-emerald-200/60 bg-emerald-50/20">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 truncate" title="Total Sale">
              Total Sale
            </span>
            <Coins className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-emerald-700 truncate tabular-nums">
            {rupee(kpis.totalSale || Number(kpis.grossProductSales || 0) + Number(kpis.deliveryCharges || 0))}
          </p>
          <span className="text-[9.5px] font-medium text-emerald-600 truncate block">
            Items + Delivery
          </span>
        </div>

        {/* 6. Total Expense */}
        <div className="card p-2 sm:p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Total Expense">
              Total Expense
            </span>
            <TrendingDown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-amber-600 truncate tabular-nums">
            {rupee(kpis.totalExpense)}
          </p>
          <span className="text-[9.5px] text-slate-400 truncate block">
            Store & ops costs
          </span>
        </div>

        {/* 7. Net Profit */}
        <div className="card p-2 sm:p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title="Net Profit">
              Net Profit
            </span>
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className={`mt-1 text-base sm:text-lg font-bold tracking-tight truncate tabular-nums ${Number(kpis.netProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
            {rupee(kpis.netProfit)}
          </p>
          <span className="text-[9.5px] font-medium text-emerald-600 truncate block">
            Sale - Expenses
          </span>
        </div>

        {/* 8. Current Profit (Delivered & Payment Arrived) */}
        <div className="card p-2 sm:p-2.5 flex flex-col justify-between border-emerald-300 bg-emerald-50/40">
          <div className="flex items-center justify-between gap-1 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 truncate" title="Current Profit">
              Current Profit
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold tracking-tight text-emerald-700 truncate tabular-nums">
            {rupee(kpis.currentProfit || kpis.deliveredSales || 0)}
          </p>
          <span className="text-[9.5px] font-medium text-emerald-700 truncate block">
            {kpis.completedOrders || 0} Delivered & Paid
          </span>
        </div>
      </div>

      {/* Analytics Breakdown Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Daily Sales Trend Breakdown */}
        <div className="card p-4 md:col-span-2 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-800">Daily Sales Activity</span>
            <span className="text-[11px] font-medium text-slate-400">
              {charts.dailyTrend.length} Active Days
            </span>
          </div>

          {charts.dailyTrend.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              No sales activity for this time range.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {charts.dailyTrend.map((day) => {
                const maxVal = Math.max(...charts.dailyTrend.map((d) => d.salesAmount || 1));
                const pct = Math.min(100, Math.round((day.salesAmount / maxVal) * 100));
                return (
                  <div key={day._id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-800">{day._id}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-medium">
                          {day.completedCount} / {day.ordersCount} orders
                        </span>
                        <span className="font-bold text-slate-900">{rupee(day.salesAmount)}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Methods & Order Status Breakdown */}
        <div className="card p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <span className="text-xs font-bold text-slate-800">Payment Breakdown</span>
              <span className="text-[10px] font-medium text-slate-400">Items + Delivery</span>
            </div>
            {charts.paymentBreakdown.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-1">No payment data</p>
            ) : (
              <div className="space-y-2">
                {charts.paymentBreakdown.map((pm) => (
                  <div key={pm._id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 capitalize">{pm._id}</span>
                      <span className="font-bold text-slate-900">{rupee(pm.amount)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{pm.count} orders</span>
                      <div className="flex items-center gap-2">
                        <span>Items: <strong className="text-slate-700">{rupee(pm.productSales)}</strong></span>
                        <span>•</span>
                        <span>Delivery: <strong className="text-sky-700">{rupee(pm.deliveryCharges)}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-2 flex items-center justify-between text-[11px] font-semibold text-slate-700 border-t border-slate-100">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Truck className="h-3 w-3 text-sky-600 inline" />
                    Total Delivery Charges
                  </span>
                  <span className="text-sky-700 font-bold">{rupee(kpis.deliveryCharges)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="border-b border-slate-100 pb-2 mb-2">
              <span className="text-xs font-bold text-slate-800">Status Distribution</span>
            </div>
            {charts.statusBreakdown.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-1">No status data</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {charts.statusBreakdown.map((st) => (
                  <span
                    key={st._id}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    <span className="capitalize">{st._id.replace(/_/g, " ")}</span>:{" "}
                    <span className="text-slate-900 font-bold">{st.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Order Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="ALL">All Order Statuses</option>
            <option value="delivered">Delivered</option>
            <option value="out_for_delivery">Out For Delivery</option>
            <option value="packed">Packed</option>
            <option value="order_received">Order Received</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="ALL">All Payments</option>
            <option value="COD">Cash on Delivery (COD)</option>
            <option value="online">Online Payment</option>
            <option value="wallet">Wallet</option>
          </select>

          {/* Rider Filter */}
          <select
            value={riderFilter}
            onChange={(e) => {
              setRiderFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none max-w-[160px]"
          >
            <option value="ALL">All Riders</option>
            {ridersList.map((r) => (
              <option key={r._id || r.id} value={r._id || r.id}>
                {r.name || r.phone || "Rider"}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order #, customer..."
              className="w-48 sm:w-64 rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 transition"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Orders Sales Table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="card-title">Order Sales Breakdown ({pagination.total})</span>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs font-medium text-slate-400">
            Loading sales report data...
          </div>
        ) : tableData.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No orders match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5">Date</th>
                  <th className="px-3.5 py-2.5">Order ID</th>
                  <th className="px-3.5 py-2.5">Customer</th>
                  <th className="px-3.5 py-2.5">Vendor</th>
                  <th className="px-3.5 py-2.5">Delivery Boy</th>
                  <th className="px-3.5 py-2.5 text-right">Items Total</th>
                  <th className="px-3.5 py-2.5 text-right">Refund Due</th>
                  <th className="px-3.5 py-2.5 text-right">Delivery Fee</th>
                  <th className="px-3.5 py-2.5 text-right">Customer Paid</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                  <th className="px-3.5 py-2.5">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableData.map((row) => (
                  <tr key={row._id} className="hover:bg-slate-50 transition">
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600 font-medium">
                      {new Date(row.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] font-bold text-slate-800">
                      {row.orderNumber}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <p className="font-semibold text-slate-900">{row.customerName}</p>
                      {row.customerPhone && (
                        <span className="text-[10px] text-slate-400">{row.customerPhone}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">{row.vendor}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="font-medium text-slate-800">{row.deliveryBoy}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-medium text-slate-800 tabular-nums">
                      {rupee(row.productSales)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-medium text-rose-600 tabular-nums">
                      {row.refund > 0 ? rupee(row.refund) : "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-600 tabular-nums">
                      {rupee(row.deliveryCharge)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700 tabular-nums">
                      {rupee(row.customerPaidAmount)}
                    </td>
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          row.status === "delivered"
                            ? "bg-emerald-100 text-emerald-800"
                            : row.status === "out_for_delivery"
                            ? "bg-sky-100 text-sky-800"
                            : row.status === "cancelled"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600 text-[11px]">
                      <span className="font-semibold uppercase">{row.paymentMethod}</span>
                      <span className="block text-[9px] text-slate-400 capitalize">
                        {row.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Strip */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs">
            <span className="text-slate-500">
              Page {page} of {pagination.pages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-200 px-2.5 py-1 font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                className="rounded border border-slate-200 px-2.5 py-1 font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

