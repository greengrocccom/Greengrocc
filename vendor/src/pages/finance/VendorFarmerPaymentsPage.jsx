import { useState, useEffect } from "react";
import {
  Tractor,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Eye,
  RefreshCw,
  X,
  CreditCard,
  FileText,
  DollarSign,
  ArrowUpRight,
  TrendingUp,
  Percent,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function VendorFarmerPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    preset: "last30",
    startDate: "",
    endDate: "",
  });
  const [statusTab, setStatusTab] = useState("ALL"); // ALL, PENDING, SETTLED
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState(null);
  const [farmers, setFarmers] = useState([]);

  // Detail Modal
  const [selectedFarmerId, setSelectedFarmerId] = useState(null);
  const [farmerDetail, setFarmerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Quick Pay Modal
  const [payModalFarmer, setPayModalFarmer] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: "",
    paymentMethod: "Bank Transfer",
    transactionReference: "",
    notes: "",
  });

  const fetchFarmerPayments = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        preset: filter.preset,
        startDate: filter.startDate,
        endDate: filter.endDate,
        search,
      };
      const res = await vendorApi.getFarmerPayments(params);
      if (res?.success) {
        setSummary(res.summary);
        setFarmers(res.farmers || []);
      } else {
        setError(res?.message || "Failed to load farmer payments");
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err.message || "Failed to load farmer payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmerPayments();
  }, [filter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchFarmerPayments();
  };

  const handleOpenDetail = async (farmerId) => {
    setSelectedFarmerId(farmerId);
    setDetailLoading(true);
    try {
      const res = await vendorApi.getFarmerPaymentDetail(farmerId);
      if (res?.success) {
        setFarmerDetail(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedFarmerId(null);
    setFarmerDetail(null);
  };

  // Open Quick Pay Modal
  const handleOpenPayModal = (farmer) => {
    setPayModalFarmer(farmer);
    setPayForm({
      amount: String(farmer.pendingAmount || 0),
      paymentMethod: "Bank Transfer",
      transactionReference: "",
      notes: `Settlement payment to farmer ${farmer.name}`,
    });
  };

  const handleClosePayModal = () => {
    setPayModalFarmer(null);
  };

  const handleQuickPaySubmit = async (e) => {
    e.preventDefault();
    const amountNum = Number(payForm.amount);
    if (!amountNum || amountNum <= 0) {
      alert("Please enter a valid payment amount");
      return;
    }
    setPayLoading(true);
    try {
      // 1. Create settlement record
      const settleRes = await vendorApi.createSettlement({
        settlementType: "farmer_vendor",
        entityId: payModalFarmer.farmerId,
        entityName: payModalFarmer.name,
        periodFrom: filter.startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        periodTo: filter.endDate || new Date().toISOString().slice(0, 10),
        grossAmount: amountNum,
        commission: 0,
        deductions: 0,
        paymentMethod: payForm.paymentMethod,
        notes: payForm.notes,
      });

      if (settleRes?.settlement?._id) {
        // 2. Record payment immediately
        await vendorApi.recordSettlementPayment(settleRes.settlement._id, {
          amount: amountNum,
          transactionReference: payForm.transactionReference,
          paymentMethod: payForm.paymentMethod,
          notes: payForm.notes,
        });
      }

      alert(`Payment of ${rupee(amountNum)} recorded for ${payModalFarmer.name}`);
      handleClosePayModal();
      fetchFarmerPayments();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to process farmer payment");
    } finally {
      setPayLoading(false);
    }
  };

  // Filter farmers by status tab
  const filteredFarmers = farmers.filter((f) => {
    if (statusTab === "PENDING") return f.pendingAmount > 0;
    if (statusTab === "SETTLED") return f.settlementStatus === "Settled" || (f.procurementAmount > 0 && f.pendingAmount === 0);
    if (statusTab === "NO_DUES") return f.procurementAmount === 0 && f.pendingAmount === 0;
    return true;
  });

  const totalProc = summary?.totalProcurement || 0;
  const totalPaid = summary?.totalPaid || 0;
  const totalPending = summary?.pendingPayments || 0;
  const percentOverallPaid = totalProc > 0 ? Math.round((totalPaid / totalProc) * 100) : 0;

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Farmer Vendor Payments</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Procurement & Payout Reconciliation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor crop procurement values, total amounts paid, and exact pending payables to farmers
          </p>
        </div>

        <button
          type="button"
          onClick={fetchFarmerPayments}
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

      {/* 3 Prominent Metric Cards: Procurement vs Paid vs To Be Paid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Procurement */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Total Procurement Value
            </span>
            <Wallet className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? "..." : rupee(totalProc)}
            </p>
            <span className="text-xs text-slate-500 block mt-0.5">
              एकूण शेतीमाल खरेदी (Total crops procured)
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Active Suppliers:</span>
            <strong className="text-slate-800">{summary?.activeFarmers || 0} farmers</strong>
          </div>
        </div>

        {/* Card 2: Total Paid to Farmers (दिलेली रक्कम) */}
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
              Total Paid to Farmers (दिलेली रक्कम)
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-emerald-700 tabular-nums">
              {loading ? "..." : rupee(totalPaid)}
            </p>
            <span className="text-xs font-medium text-emerald-700 block mt-0.5">
              Disbursed & settled payments
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800">
            <span>Settled Ratio:</span>
            <span className="font-bold">{percentOverallPaid}% Paid</span>
          </div>
        </div>

        {/* Card 3: Pending Due to Farmers (देणे बाकी) */}
        <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Pending Due (शेतकऱ्यांना देणे बाकी)
            </span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-amber-700 tabular-nums">
              {loading ? "..." : rupee(totalPending)}
            </p>
            <span className="text-xs font-medium text-amber-700 block mt-0.5">
              Outstanding payables to be paid
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800">
            <span>Dues Status:</span>
            <span className="font-bold text-amber-800">{100 - percentOverallPaid}% Pending</span>
          </div>
        </div>

        {/* Card 4: Farmers Count & Overview */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Farmers Network
            </span>
            <Tractor className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? "..." : summary?.totalFarmers || 0}
            </p>
            <span className="text-xs text-slate-500 block mt-0.5">
              Registered Farmer Vendors
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>With Pending Dues:</span>
            <strong className="text-amber-700">
              {farmers.filter((f) => f.pendingAmount > 0).length} farmers
            </strong>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusTab("ALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              statusTab === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Farmers ({farmers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("PENDING")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              statusTab === "PENDING"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Pending Due / देणे बाकी ({farmers.filter((f) => f.pendingAmount > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("SETTLED")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              statusTab === "SETTLED"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Fully Settled / पूर्ण दिलेले ({farmers.filter((f) => f.settlementStatus === "Settled" || (f.procurementAmount > 0 && f.pendingAmount === 0)).length})
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search farmer by name, mobile, or ID..."
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
      </div>

      {/* Farmers Table with Prominent Paid and Pending Columns */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3.5 py-3">Farmer & Farm Name</th>
                <th className="px-3.5 py-3">Mobile & Bank</th>
                <th className="px-3.5 py-3 text-right">Orders / Qty</th>
                <th className="px-3.5 py-3 text-right font-bold text-slate-900">Total Procurement</th>
                <th className="px-3.5 py-3 text-right font-bold text-emerald-800 bg-emerald-50/60">
                  PAID AMOUNT (दिलेले)
                </th>
                <th className="px-3.5 py-3 text-right font-bold text-amber-900 bg-amber-50/60">
                  PENDING DUE (देणे बाकी)
                </th>
                <th className="px-3.5 py-3 text-center">Progress</th>
                <th className="px-3.5 py-3 text-center">Status</th>
                <th className="px-3.5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFarmers.map((f) => {
                const percent = f.procurementAmount > 0 ? Math.min(100, Math.round((f.paidAmount / f.procurementAmount) * 100)) : 0;
                const hasPending = f.pendingAmount > 0;

                return (
                  <tr key={f.farmerId} className="hover:bg-slate-50/60 transition">
                    <td className="px-3.5 py-2.5">
                      <div className="font-bold text-slate-900 text-xs">{f.name}</div>
                      <div className="text-[10.5px] text-slate-500">{f.farmName || f.location}</div>
                      <span className="text-[9.5px] font-mono text-slate-400">ID: {f.farmerId}</span>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-mono text-slate-700 font-medium">{f.mobile || "—"}</div>
                      <div className="text-[10px] text-slate-400">A/C: {f.bankAccount}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-700">
                      <div className="font-medium text-slate-800">{f.totalOrders} orders</div>
                      {f.totalQuantity > 0 && <div className="text-[10px] text-slate-400">{f.totalQuantity} kg supplied</div>}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums font-bold text-slate-900">
                      {rupee(f.procurementAmount)}
                    </td>

                    {/* Paid Column */}
                    <td className="px-3.5 py-2.5 text-right tabular-nums bg-emerald-50/30">
                      <span className="inline-block rounded-md bg-emerald-100/80 px-2 py-0.5 text-xs font-bold text-emerald-800">
                        {rupee(f.paidAmount)}
                      </span>
                    </td>

                    {/* Pending Due Column */}
                    <td className="px-3.5 py-2.5 text-right tabular-nums bg-amber-50/30">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                          hasPending
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {rupee(f.pendingAmount)}
                      </span>
                    </td>

                    {/* Progress Bar */}
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="w-16 mx-auto">
                        <div className="flex justify-between text-[9px] text-slate-500 mb-0.5 font-medium">
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${percent === 100 ? "bg-emerald-600" : percent > 0 ? "bg-blue-600" : "bg-slate-300"}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          f.settlementStatus === "Settled"
                            ? "bg-emerald-100 text-emerald-800"
                            : hasPending
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {f.settlementStatus}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        {hasPending ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPayModal(f)}
                            className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 transition cursor-pointer shadow-xs"
                          >
                            <CreditCard className="h-3 w-3" /> Pay
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-semibold px-2 py-1">
                            ✓ Clear
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(f.farmerId)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                        >
                          <Eye className="h-3 w-3" /> Ledger
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredFarmers.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                    No farmer records found for this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK PAY FARMER MODAL */}
      {payModalFarmer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pay Farmer: {payModalFarmer.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  ID: {payModalFarmer.farmerId} | Mobile: {payModalFarmer.mobile}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClosePayModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Farmer Dues Snapshot */}
            <div className="my-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Total Procurement:</span>
                <span className="font-semibold text-slate-800">{rupee(payModalFarmer.procurementAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Already Paid:</span>
                <span className="font-semibold text-emerald-700">{rupee(payModalFarmer.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-amber-900 font-bold border-t border-amber-200 pt-1">
                <span>Pending Balance Due (देणे बाकी):</span>
                <span>{rupee(payModalFarmer.pendingAmount)}</span>
              </div>
            </div>

            <form onSubmit={handleQuickPaySubmit} className="space-y-3 pt-1 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={payModalFarmer.pendingAmount}
                  step="0.01"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payForm.paymentMethod}
                  onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI Payment</option>
                  <option value="Cash">Cash in Hand</option>
                  <option value="Cheque">Bank Cheque</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Transaction Ref / UTR / Cheque #
                </label>
                <input
                  type="text"
                  value={payForm.transactionReference}
                  onChange={(e) => setPayForm({ ...payForm, transactionReference: e.target.value })}
                  placeholder="e.g. UTR29384729384"
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  placeholder="Optional payment notes..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleClosePayModal}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition cursor-pointer disabled:opacity-50"
                >
                  {payLoading ? "Processing..." : "Confirm & Pay Farmer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Farmer Detail / Ledger Modal */}
      {selectedFarmerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Farmer Ledger: {farmerDetail?.farmer?.name || "Farmer"}
                </h3>
                <p className="text-xs text-slate-500">
                  ID: {selectedFarmerId} | {farmerDetail?.farmer?.mobile} | {farmerDetail?.farmer?.farmLocation || farmerDetail?.farmer?.address?.district}
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
              <div className="py-12 text-center text-xs text-slate-500">Loading farmer records...</div>
            ) : (
              <div className="space-y-4 pt-4">
                {/* Bank Details Strip */}
                <div className="rounded-lg bg-slate-50 p-3 text-xs flex flex-wrap gap-4 text-slate-700 border border-slate-200">
                  <div>
                    <span className="font-semibold text-slate-500 block">Bank Name:</span>
                    <span>{farmerDetail?.farmer?.bank?.bankName || "Not Provided"}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Account #:</span>
                    <span>{farmerDetail?.farmer?.bank?.accountNumber || "Not Provided"}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">IFSC:</span>
                    <span>{farmerDetail?.farmer?.bank?.ifscCode || "Not Provided"}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Branch:</span>
                    <span>{farmerDetail?.farmer?.bank?.branchName || "—"}</span>
                  </div>
                </div>

                {/* Orders Sourced */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Procurement Orders ({farmerDetail?.orders?.length || 0})
                  </h4>
                  <div className="rounded-lg border border-slate-200 overflow-x-auto max-h-44">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-semibold text-slate-500">
                        <tr>
                          <th className="px-2.5 py-1.5">Order ID</th>
                          <th className="px-2.5 py-1.5">Date</th>
                          <th className="px-2.5 py-1.5">Crop</th>
                          <th className="px-2.5 py-1.5 text-right">Qty</th>
                          <th className="px-2.5 py-1.5 text-right">Value</th>
                          <th className="px-2.5 py-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(farmerDetail?.orders || []).map((ord) => (
                          <tr key={ord._id}>
                            <td className="px-2.5 py-1.5 font-mono">{ord.id || ord._id}</td>
                            <td className="px-2.5 py-1.5 text-slate-500">
                              {new Date(ord.createdAt).toLocaleDateString("en-IN")}
                            </td>
                            <td className="px-2.5 py-1.5 font-medium">{ord.cropName || ord.productName || "Crop"}</td>
                            <td className="px-2.5 py-1.5 text-right">{ord.orderedQuantity || ord.quantity || 0} kg</td>
                            <td className="px-2.5 py-1.5 text-right font-medium text-slate-900">
                              {rupee(ord.orderValue || (ord.price * (ord.orderedQuantity || 0)) || 0)}
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] uppercase font-semibold text-slate-700">
                                {ord.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!farmerDetail?.orders || farmerDetail.orders.length === 0) && (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">
                              No procurement orders recorded
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Earnings & Payments */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Earnings & Payments Disbursed ({farmerDetail?.earnings?.length || 0})
                  </h4>
                  <div className="rounded-lg border border-slate-200 overflow-x-auto max-h-40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-semibold text-slate-500">
                        <tr>
                          <th className="px-2.5 py-1.5">Date</th>
                          <th className="px-2.5 py-1.5">Order Ref</th>
                          <th className="px-2.5 py-1.5 text-right">Gross Earnings</th>
                          <th className="px-2.5 py-1.5 text-right">Net Paid</th>
                          <th className="px-2.5 py-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(farmerDetail?.earnings || []).map((e) => (
                          <tr key={e._id}>
                            <td className="px-2.5 py-1.5 text-slate-500">
                              {new Date(e.createdAt).toLocaleDateString("en-IN")}
                            </td>
                            <td className="px-2.5 py-1.5 font-mono">{e.orderId || "—"}</td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums">{rupee(e.grossEarnings)}</td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold text-emerald-700">
                              {rupee(e.netEarnings)}
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-semibold ${
                                  e.status === "Paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {e.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!farmerDetail?.earnings || farmerDetail.earnings.length === 0) && (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400">
                              No earnings records found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Settlements Recorded */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Settlements Recorded ({farmerDetail?.settlements?.length || 0})
                  </h4>
                  <div className="rounded-lg border border-slate-200 overflow-x-auto max-h-40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-semibold text-slate-500">
                        <tr>
                          <th className="px-2.5 py-1.5">Settlement #</th>
                          <th className="px-2.5 py-1.5">Payable</th>
                          <th className="px-2.5 py-1.5">Paid</th>
                          <th className="px-2.5 py-1.5">Balance</th>
                          <th className="px-2.5 py-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(farmerDetail?.settlements || []).map((s) => (
                          <tr key={s._id}>
                            <td className="px-2.5 py-1.5 font-mono">{s.settlementNumber}</td>
                            <td className="px-2.5 py-1.5 font-medium">{rupee(s.finalPayable)}</td>
                            <td className="px-2.5 py-1.5 text-emerald-700 font-medium">{rupee(s.paidAmount)}</td>
                            <td className="px-2.5 py-1.5 text-amber-700 font-medium">{rupee(s.remainingBalance)}</td>
                            <td className="px-2.5 py-1.5 text-center">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] uppercase font-semibold">
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!farmerDetail?.settlements || farmerDetail.settlements.length === 0) && (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400">
                              No settlements recorded yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
