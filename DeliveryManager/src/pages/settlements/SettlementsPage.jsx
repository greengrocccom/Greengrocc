import { useEffect, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";
import { PAGE_SIZE, Pagination } from "../../components/ui/Pagination";
import {
  Plus,
  Search,
  Filter,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  CreditCard,
  User,
  Calendar,
  Building,
  RefreshCw,
} from "lucide-react";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const SETTLEMENT_TYPES = [
  { id: "RIDER_PAYOUT", label: "Delivery Boy / Rider Payout" },
  { id: "VENDOR_SETTLEMENT", label: "Vendor Settlement" },
  { id: "FARMER_VENDOR_SETTLEMENT", label: "Farmer Vendor Settlement" },
  { id: "ADMIN_SETTLEMENT", label: "Admin Settlement" },
  { id: "OPERATIONAL_PAYMENT", label: "Operational Payment" },
];

export default function SettlementsPage() {
  const [filter, setFilter] = useState({
    preset: "all",
    startDate: "",
    endDate: "",
  });
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({
    totalPayable: 0,
    totalPaid: 0,
    totalPending: 0,
  });
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Create Settlement Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const [ridersList, setRidersList] = useState([]);
  const [calculatingRider, setCalculatingRider] = useState(false);

  const [formData, setFormData] = useState({
    settlementType: "RIDER_PAYOUT",
    entityName: "",
    entityId: "",
    periodStart: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
    ordersCount: 0,
    grossAmount: 0,
    incentives: 0,
    allowances: 0,
    deductions: 0,
    advances: 0,
    paidAmount: 0,
    paymentMethod: "BANK_TRANSFER",
    transactionReference: "",
    notes: "",
    status: "Pending",
  });

  const loadSettlements = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await managerApi.listSettlements({
        ...filter,
        type: typeFilter,
        status: statusFilter,
        search,
        page,
        limit: PAGE_SIZE,
      });
      if (res.data?.success) {
        setSettlements(res.data.data || []);
        setSummary(res.data.summary || {});
        setPagination({
          total: res.data.total || 0,
          pages: res.data.pages || 1,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load settlements");
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
    loadSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, typeFilter, statusFilter, page]);

  useEffect(() => {
    loadRiders();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadSettlements();
  };

  const handleRiderSelect = async (riderId) => {
    const selected = ridersList.find((r) => (r._id || r.id) === riderId);
    if (!selected) {
      setFormData((prev) => ({ ...prev, entityId: "", entityName: "" }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      entityId: riderId,
      entityName: selected.name || selected.phone || "Rider",
    }));

    if (formData.periodStart && formData.periodEnd) {
      setCalculatingRider(true);
      try {
        const res = await managerApi.calculateRiderPayable({
          riderId,
          startDate: formData.periodStart,
          endDate: formData.periodEnd,
        });
        if (res.data?.success) {
          setFormData((prev) => ({
            ...prev,
            ordersCount: res.data.ordersCount || 0,
            grossAmount: res.data.grossDeliveryEarnings || 0,
          }));
        }
      } catch {
        // Fallback
      } finally {
        setCalculatingRider(false);
      }
    }
  };

  const computedFinalPayable = Math.max(
    0,
    Number(formData.grossAmount || 0) +
      Number(formData.incentives || 0) +
      Number(formData.allowances || 0) -
      Number(formData.deductions || 0) -
      Number(formData.advances || 0)
  );

  const handleSaveSettlement = async (e) => {
    e.preventDefault();
    if (!formData.entityName) {
      setModalError("Entity name is required");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      await managerApi.createSettlement({
        ...formData,
        grossAmount: Number(formData.grossAmount || 0),
        incentives: Number(formData.incentives || 0),
        allowances: Number(formData.allowances || 0),
        deductions: Number(formData.deductions || 0),
        advances: Number(formData.advances || 0),
        paidAmount: Number(formData.paidAmount || 0),
      });
      setIsModalOpen(false);
      loadSettlements();
    } catch (err) {
      setModalError(err.response?.data?.message || "Failed to create settlement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      title="Settlement Management"
      meta="Process and audit driver payouts, operational disbursements, and platform settlements"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setModalError("");
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create Settlement</span>
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

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Total Payable</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="stat-value text-slate-900 mt-1">{rupee(summary.totalPayable)}</p>
          <span className="text-[11px] text-slate-400">All created settlements</span>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Total Paid & Disbursed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="stat-value text-emerald-700 mt-1">{rupee(summary.totalPaid)}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Completed Payouts</span>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Pending Settlements</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="stat-value text-amber-600 mt-1">{rupee(summary.totalPending)}</p>
          <span className="text-[11px] text-slate-400">Awaiting confirmation</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
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
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settlement #, recipient..."
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

      {/* Settlements Table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="card-title">Settlement Records ({pagination.total})</span>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs font-medium text-slate-400">
            Loading settlements...
          </div>
        ) : settlements.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No settlement records found. Click "Create Settlement" to generate a payout ledger.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5">Date</th>
                  <th className="px-3.5 py-2.5">Settlement ID</th>
                  <th className="px-3.5 py-2.5">Type</th>
                  <th className="px-3.5 py-2.5">Recipient / Entity</th>
                  <th className="px-3.5 py-2.5">Period</th>
                  <th className="px-3.5 py-2.5 text-right">Gross</th>
                  <th className="px-3.5 py-2.5 text-right">Payable</th>
                  <th className="px-3.5 py-2.5 text-right">Paid Amount</th>
                  <th className="px-3.5 py-2.5 text-right">Balance</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((st) => (
                  <tr key={st._id} className="hover:bg-slate-50 transition">
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600 font-medium">
                      {new Date(st.settlementDate || st.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] font-bold text-slate-800">
                      {st.settlementNumber}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {st.settlementType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                      {st.entityName}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-[11px] text-slate-500">
                      {new Date(st.periodStart).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}{" "}
                      –{" "}
                      {new Date(st.periodEnd).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-medium text-slate-800 tabular-nums">
                      {rupee(st.grossAmount)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                      {rupee(st.finalPayable)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700 tabular-nums">
                      {rupee(st.paidAmount)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-amber-600 tabular-nums">
                      {rupee(st.remainingBalance)}
                    </td>
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          st.status === "Paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : st.status === "Partially Paid"
                            ? "bg-amber-100 text-amber-800"
                            : st.status === "Processing"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {st.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <Pagination
            className="border-t border-slate-100 px-4"
            pagination={{
              page,
              pageCount: pagination.pages,
              total: pagination.total,
              start: (page - 1) * PAGE_SIZE,
              end: Math.min(page * PAGE_SIZE, pagination.total),
              setPage,
            }}
          />
        )}
      </div>

      {/* Create Settlement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">Create Settlement Record</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettlement} className="p-5 space-y-3.5 text-xs">
              {modalError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Settlement Type *
                  </label>
                  <select
                    value={formData.settlementType}
                    onChange={(e) => setFormData({ ...formData, settlementType: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none"
                  >
                    {SETTLEMENT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.settlementType === "RIDER_PAYOUT" ? (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Select Delivery Boy *
                    </label>
                    <select
                      value={formData.entityId}
                      onChange={(e) => handleRiderSelect(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none"
                    >
                      <option value="">-- Choose Rider --</option>
                      {ridersList.map((r) => (
                        <option key={r._id || r.id} value={r._id || r.id}>
                          {r.name || r.phone || "Rider"} ({r.employmentType || "part_time"})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Recipient / Entity Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.entityName}
                      onChange={(e) => setFormData({ ...formData, entityName: e.target.value })}
                      placeholder="e.g. Pune Central Vendor / Operations Team"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Period Start *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.periodStart}
                    onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Period End *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.periodEnd}
                    onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Gross Earnings / Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.grossAmount}
                    onChange={(e) => setFormData({ ...formData, grossAmount: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Incentives / Bonus (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.incentives}
                    onChange={(e) => setFormData({ ...formData, incentives: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Deductions (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.deductions}
                    onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 font-bold outline-none text-emerald-700"
                  />
                </div>

                {/* Live Formula Display */}
                <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span>Final Calculated Payable:</span>
                    <span className="text-emerald-700 text-sm font-extrabold tabular-nums">
                      {rupee(computedFinalPayable)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span>Remaining Balance:</span>
                    <span className="font-semibold text-amber-700 tabular-nums">
                      {rupee(Math.max(0, computedFinalPayable - Number(formData.paidAmount || 0)))}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none"
                  >
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">CASH</option>
                    <option value="WALLET">WALLET</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Transaction Ref (UTR/Txn ID)
                  </label>
                  <input
                    type="text"
                    value={formData.transactionReference}
                    onChange={(e) =>
                      setFormData({ ...formData, transactionReference: e.target.value })
                    }
                    placeholder="e.g. UTR847392817"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Create Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}

