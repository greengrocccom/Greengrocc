import { useState, useEffect } from "react";
import {
  Wallet,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  CreditCard,
  FileText,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const SETTLEMENT_TYPES = [
  { id: "farmer_vendor", label: "Farmer Vendor Sourcing" },
  { id: "delivery_manager", label: "Delivery Manager / Dark Store" },
  { id: "admin_commission", label: "Admin Platform Commission" },
  { id: "vendor_operational", label: "Vendor Operational Settlement" },
];

export default function VendorSettlementsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settlementTypeFilter, setSettlementTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [settlementData, setSettlementData] = useState(null);

  // Create Settlement Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    settlementType: "farmer_vendor",
    entityId: "",
    entityName: "",
    periodFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    periodTo: new Date().toISOString().slice(0, 10),
    grossAmount: "",
    commission: "0",
    deductions: "0",
    paymentMethod: "Bank Transfer",
    notes: "",
  });

  // Record Payment Modal
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    transactionReference: "",
    paymentMethod: "Bank Transfer",
    notes: "",
  });

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        settlementType: settlementTypeFilter,
        status: statusFilter,
        page,
        limit: 20,
      };
      const res = await vendorApi.getSettlements(params);
      if (res?.success) {
        setSettlementData(res);
      } else {
        setError(res?.message || "Failed to load settlements");
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err.message || "Failed to load settlements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [settlementTypeFilter, statusFilter, page]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.entityName || !createForm.grossAmount) {
      alert("Please fill all required fields");
      return;
    }
    setCreateLoading(true);
    try {
      await vendorApi.createSettlement(createForm);
      setIsCreateOpen(false);
      fetchSettlements();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create settlement");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenPayModal = (s) => {
    setSelectedSettlement(s);
    setPayForm({
      amount: String(s.remainingBalance || 0),
      transactionReference: "",
      paymentMethod: s.paymentMethod || "Bank Transfer",
      notes: "",
    });
    setIsPayOpen(true);
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payForm.amount || Number(payForm.amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    setPayLoading(true);
    try {
      await vendorApi.recordSettlementPayment(selectedSettlement._id, payForm);
      setIsPayOpen(false);
      fetchSettlements();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to record payment");
    } finally {
      setPayLoading(false);
    }
  };

  const settlements = settlementData?.settlements || [];
  const totalCount = settlementData?.totalCount || 0;

  // Compute summary totals on the fly
  let totalGross = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  settlements.forEach((s) => {
    totalGross += s.finalPayable || 0;
    totalPaid += s.paidAmount || 0;
    totalRemaining += s.remainingBalance || 0;
  });

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Vendor Settlements Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage payouts & balance reconciliation for farmers, dark stores, and admin commission
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Settlement
          </button>
          <button
            type="button"
            onClick={fetchSettlements}
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

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Settlements</span>
            <FileText className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold text-slate-900 tabular-nums">
            {loading ? "..." : totalCount}
          </p>
          <span className="text-[9.5px] text-slate-400">Total settlement files</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Net Payable</span>
            <Wallet className="h-3.5 w-3.5 text-slate-700" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold text-slate-900 tabular-nums">
            {loading ? "..." : rupee(totalGross)}
          </p>
          <span className="text-[9.5px] text-slate-400">Reconciled payables</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Settled & Paid</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold text-emerald-700 tabular-nums">
            {loading ? "..." : rupee(totalPaid)}
          </p>
          <span className="text-[9.5px] text-emerald-600">Disbursed successfully</span>
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50/40 p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Remaining Balance
            </span>
            <Clock className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-bold text-amber-700 tabular-nums">
            {loading ? "..." : rupee(totalRemaining)}
          </p>
          <span className="text-[9.5px] text-amber-600">Pending disbursement</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={settlementTypeFilter}
            onChange={(e) => {
              setSettlementTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="ALL">All Settlement Types</option>
            {SETTLEMENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">Showing {settlements.length} settlements</div>
      </div>

      {/* Settlements Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Settlement #</th>
                <th className="px-3 py-2.5">Type & Entity</th>
                <th className="px-3 py-2.5">Period</th>
                <th className="px-3 py-2.5 text-right">Gross Amount</th>
                <th className="px-3 py-2.5 text-right">Net Payable</th>
                <th className="px-3 py-2.5 text-right">Paid Amount</th>
                <th className="px-3 py-2.5 text-right">Balance Due</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50/60 transition">
                  <td className="px-3 py-2 font-mono font-medium text-slate-900">{s.settlementNumber}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-900">{s.entityName}</div>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] uppercase font-semibold text-slate-600">
                      {s.settlementType?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-[11px]">
                    {new Date(s.period.from).toLocaleDateString("en-IN")} —{" "}
                    {new Date(s.period.to).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{rupee(s.grossAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                    {rupee(s.finalPayable)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700">
                    {rupee(s.paidAmount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-amber-700">
                    {rupee(s.remainingBalance)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        s.status === "Paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : s.status === "Partially Paid"
                          ? "bg-blue-100 text-blue-800"
                          : s.status === "Pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {s.remainingBalance > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleOpenPayModal(s)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-800 cursor-pointer shadow-2xs"
                      >
                        <CreditCard className="h-3 w-3" /> Pay
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-semibold flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && settlements.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                    No settlement records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Settlement Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Create New Settlement</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Settlement Type *</label>
                <select
                  value={createForm.settlementType}
                  onChange={(e) => setCreateForm({ ...createForm, settlementType: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  {SETTLEMENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Entity / Payee Name *</label>
                  <input
                    type="text"
                    required
                    value={createForm.entityName}
                    onChange={(e) => setCreateForm({ ...createForm, entityName: e.target.value })}
                    placeholder="e.g. Ramesh Kumar (Farmer) or Store #1"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Entity ID (Optional)</label>
                  <input
                    type="text"
                    value={createForm.entityId}
                    onChange={(e) => setCreateForm({ ...createForm, entityId: e.target.value })}
                    placeholder="e.g. farmer-123"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Period From *</label>
                  <input
                    type="date"
                    required
                    value={createForm.periodFrom}
                    onChange={(e) => setCreateForm({ ...createForm, periodFrom: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Period To *</label>
                  <input
                    type="date"
                    required
                    value={createForm.periodTo}
                    onChange={(e) => setCreateForm({ ...createForm, periodTo: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gross Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={createForm.grossAmount}
                    onChange={(e) => setCreateForm({ ...createForm, grossAmount: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Commission (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.commission}
                    onChange={(e) => setCreateForm({ ...createForm, commission: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.deductions}
                    onChange={(e) => setCreateForm({ ...createForm, deductions: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={createForm.paymentMethod}
                  onChange={(e) => setCreateForm({ ...createForm, paymentMethod: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="Optional settlement notes or reference..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition cursor-pointer disabled:opacity-50"
                >
                  {createLoading ? "Creating..." : "Create Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPayOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Settlement Payment</h3>
                <p className="text-xs text-slate-500">
                  {selectedSettlement.settlementNumber} — {selectedSettlement.entityName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPayOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-3 rounded-lg bg-slate-50 p-2.5 text-xs border border-slate-200 flex justify-between">
              <div>
                <span className="text-slate-500 block">Total Net Due:</span>
                <span className="font-semibold text-slate-800">{rupee(selectedSettlement.finalPayable)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Already Paid:</span>
                <span className="font-semibold text-emerald-700">{rupee(selectedSettlement.paidAmount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Remaining:</span>
                <span className="font-bold text-amber-700">{rupee(selectedSettlement.remainingBalance)}</span>
              </div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  max={selectedSettlement.remainingBalance}
                  step="0.01"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transaction Ref / UTR / Cheque #</label>
                <input
                  type="text"
                  value={payForm.transactionReference}
                  onChange={(e) => setPayForm({ ...payForm, transactionReference: e.target.value })}
                  placeholder="e.g. UTR29384729384 or CHEQUE#928374"
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
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
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
                  onClick={() => setIsPayOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition cursor-pointer disabled:opacity-50"
                >
                  {payLoading ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

