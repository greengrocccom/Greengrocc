import { useEffect, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  DollarSign,
  TrendingDown,
  Layers,
  Calendar,
  X,
  AlertCircle,
} from "lucide-react";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const EXPENSE_CATEGORIES = [
  {
    category: "Delivery Expenses",
    subCategories: [
      "Delivery Boy Salary",
      "Per-Order Delivery Payout",
      "Rider Incentives",
      "Fuel",
      "Transportation",
      "Vehicle Maintenance",
      "Travel Allowance",
    ],
  },
  {
    category: "Store Expenses",
    subCategories: [
      "Store Rent",
      "Electricity",
      "Internet",
      "Store Staff Salary",
      "Cleaning",
      "Maintenance",
    ],
  },
  {
    category: "Packaging Expenses",
    subCategories: [
      "Packaging Bags",
      "Boxes",
      "Labels",
      "Packing Material",
      "Special Packaging",
    ],
  },
  {
    category: "Technology Expenses",
    subCategories: [
      "Google Maps API",
      "GPS Tracking",
      "Communication",
      "Devices",
      "Other Technology Costs",
    ],
  },
  {
    category: "Other Expenses",
    subCategories: [
      "Failed Delivery",
      "Return Handling",
      "Damaged Products",
      "Miscellaneous Expenses",
    ],
  },
];

export default function ExpensesPage() {
  const [filter, setFilter] = useState({
    preset: "all",
    startDate: "",
    endDate: "",
  });
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({
    totalExpense: 0,
    approvedExpense: 0,
    pendingExpense: 0,
    byCategory: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const [ridersList, setRidersList] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    category: "Delivery Expenses",
    subCategory: "Fuel",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    riderId: "",
    orderId: "",
    paymentMethod: "CASH",
    paidBy: "",
    payee: "",
    receiptUrl: "",
    notes: "",
    status: "Approved",
  });

  const loadExpenses = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await managerApi.listExpenses({
        ...filter,
        category: categoryFilter,
        status: statusFilter,
        search,
        page,
        limit: 15,
      });
      if (res.data?.success) {
        setExpenses(res.data.data || []);
        setSummary(res.data.summary || {});
        setPagination({
          total: res.data.total || 0,
          pages: res.data.pages || 1,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const loadRiders = async () => {
    try {
      const res = await managerApi.riders();
      const list = res.data?.riders || res.data?.data || res.data || [];
      if (Array.isArray(list)) setRidersList(list);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, categoryFilter, statusFilter, page]);

  useEffect(() => {
    loadRiders();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadExpenses();
  };

  const openCreateModal = () => {
    setEditingExpense(null);
    setFormData({
      title: "",
      category: "Delivery Expenses",
      subCategory: "Fuel",
      amount: "",
      expenseDate: new Date().toISOString().slice(0, 10),
      riderId: "",
      orderId: "",
      paymentMethod: "CASH",
      paidBy: "",
      payee: "",
      receiptUrl: "",
      notes: "",
      status: "Approved",
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setFormData({
      title: exp.title || "",
      category: exp.category || "Delivery Expenses",
      subCategory: exp.subCategory || "",
      amount: exp.amount || "",
      expenseDate: exp.expenseDate ? new Date(exp.expenseDate).toISOString().slice(0, 10) : "",
      riderId: exp.riderId || "",
      orderId: exp.orderId || "",
      paymentMethod: exp.paymentMethod || "CASH",
      paidBy: exp.paidBy || "",
      payee: exp.payee || "",
      receiptUrl: exp.receiptUrl || "",
      notes: exp.notes || "",
      status: exp.status || "Approved",
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) {
      setModalError("Please provide both title and amount");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      if (editingExpense) {
        await managerApi.updateExpense(editingExpense._id, formData);
      } else {
        await managerApi.createExpense(formData);
      }
      setIsModalOpen(false);
      loadExpenses();
    } catch (err) {
      setModalError(err.response?.data?.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense record?")) return;
    try {
      await managerApi.deleteExpense(id);
      loadExpenses();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete expense");
    }
  };

  const currentCategorySubs =
    EXPENSE_CATEGORIES.find((c) => c.category === formData.category)?.subCategories || [];

  return (
    <PageShell
      title="Expense Management"
      meta="Record, monitor and control all dark store operational and delivery costs"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Expense</span>
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

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="card p-3.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Total Expense</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="stat-value text-slate-900">{rupee(summary.totalExpense)}</p>
          <span className="text-[10px] text-slate-400">All recorded</span>
        </div>

        <div className="card p-3.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Approved & Paid</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="stat-value text-emerald-700">{rupee(summary.approvedExpense)}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Affecting Profit</span>
        </div>

        <div className="card p-3.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Pending Approval</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="stat-value text-amber-600">{rupee(summary.pendingExpense)}</p>
          <span className="text-[10px] text-slate-400">Needs review</span>
        </div>

        <div className="card p-3.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Delivery Costs</span>
            <TrendingDown className="h-4 w-4 text-sky-600" />
          </div>
          <p className="stat-value text-slate-900">
            {rupee(summary.byCategory?.["Delivery Expenses"] || 0)}
          </p>
          <span className="text-[10px] text-slate-400">Riders, Fuel, Maintenance</span>
        </div>

        <div className="card p-3.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="stat-label">Store & Ops</span>
            <Layers className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="stat-value text-slate-900">
            {rupee(
              (summary.byCategory?.["Store Expenses"] || 0) +
                (summary.byCategory?.["Packaging Expenses"] || 0)
            )}
          </p>
          <span className="text-[10px] text-slate-400">Rent, Bags, Utilities</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expense #, title, payee..."
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

      {/* Expenses Table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="card-title">Expense Records ({pagination.total})</span>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs font-medium text-slate-400">
            Loading expense records...
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No expenses found for the selected filters. Click "Add Expense" to record a new cost.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5">Date</th>
                  <th className="px-3.5 py-2.5">Expense ID</th>
                  <th className="px-3.5 py-2.5">Title & Subcategory</th>
                  <th className="px-3.5 py-2.5">Category</th>
                  <th className="px-3.5 py-2.5 text-right">Amount</th>
                  <th className="px-3.5 py-2.5">Payee / Rider</th>
                  <th className="px-3.5 py-2.5">Payment</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <tr key={exp._id} className="hover:bg-slate-50 transition">
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600 font-medium">
                      {new Date(exp.expenseDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] font-bold text-slate-700">
                      {exp.expenseNumber}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <p className="font-semibold text-slate-800">{exp.title}</p>
                      {exp.subCategory && (
                        <span className="text-[10px] text-slate-400">{exp.subCategory}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                      {rupee(exp.amount)}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700">
                      {exp.payee || exp.riderName || "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 text-[11px]">
                      {exp.paymentMethod}
                    </td>
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          exp.status === "Approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : exp.status === "Paid"
                            ? "bg-sky-100 text-sky-800"
                            : exp.status === "Pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {exp.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(exp)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp._id)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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

      {/* Add / Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">
                {editingExpense ? "Edit Expense Record" : "Record New Expense"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-3.5 text-xs">
              {modalError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Expense Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Fuel allowance for morning shift"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      const subs =
                        EXPENSE_CATEGORIES.find((c) => c.category === newCat)?.subCategories || [];
                      setFormData({
                        ...formData,
                        category: newCat,
                        subCategory: subs[0] || "",
                      });
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.category} value={c.category}>
                        {c.category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Subcategory
                  </label>
                  <select
                    value={formData.subCategory}
                    onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600"
                  >
                    {currentCategorySubs.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none"
                  />
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
                    <option value="CASH">CASH</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="CARD">CARD</option>
                    <option value="PETTY_CASH">PETTY CASH</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Payee / Vendor Name
                  </label>
                  <input
                    type="text"
                    value={formData.payee}
                    onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                    placeholder="e.g. Bharat Petroleum / City Power"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>

                {formData.category === "Delivery Expenses" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Associated Rider (Optional)
                    </label>
                    <select
                      value={formData.riderId}
                      onChange={(e) => setFormData({ ...formData, riderId: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none"
                    >
                      <option value="">None / Dark Store Wide</option>
                      {ridersList.map((r) => (
                        <option key={r._id || r.id} value={r._id || r.id}>
                          {r.name || r.phone || "Rider"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none"
                  >
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Notes / Remarks
                  </label>
                  <textarea
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes or invoice reference..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 outline-none"
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
                  {saving ? "Saving..." : editingExpense ? "Update Expense" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}

