import { useCallback, useMemo, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { useLive } from "../../realtime/useLive";
import { Pagination, usePagination } from "../../components/ui/Pagination";

const REQUEST_STATUS = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  inprocessed: "bg-blue-50 text-blue-700 border-blue-200",
  packed: "bg-purple-50 text-purple-700 border-purple-200",
  completed: "bg-green-100 text-green-800 border-green-300",
};

export default function StockPage() {
  const [inventory, setInventory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [view, setView] = useState("inventory");
  
  const [requestItem, setRequestItem] = useState(null);
  const [gradeA, setGradeA] = useState(0);
  const [gradeB, setGradeB] = useState(0);
  const [gradeC, setGradeC] = useState(0);
  const [otherQty, setOtherQty] = useState(0);
  const [requestNote, setRequestNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // For viewing an existing request
  const [viewingRequest, setViewingRequest] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const load = useCallback(async () => {
    try {
      const [inv, req] = await Promise.all([
        managerApi.inventory(),
        managerApi.listInventoryRequests(),
      ]);
      setInventory(inv.data.inventory || []);
      setRequests(req.data.requests || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, []);

  useLive(load, [load]);

  const categories = Array.from(new Set(inventory.map((i) => i.category).filter(Boolean)));
  const pendingSkuSet = useMemo(
    () => new Set(requests.filter((r) => r.status === "pending").map((r) => r.sku)),
    [requests]
  );

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      (item.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.sku || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const inventoryPagination = usePagination(filteredInventory, { resetDeps: [search, categoryFilter] });
  const requestsPagination = usePagination(requests);

  const openRequest = (item) => {
    const suggested = item.stockCount === 0 ? 30 : Math.max(20, (item.lowStockThreshold || 10) * 2);
    setRequestItem(item);
    setGradeA(suggested);
    setGradeB(0);
    setGradeC(0);
    setOtherQty(0);
    setRequestNote(
      item.stockCount === 0
        ? "Out of stock — need restock to fulfil orders"
        : "Low stock — replenish dark store inventory"
    );
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!requestItem) return;
    
    const totalReq = Number(gradeA) + Number(gradeB) + Number(gradeC) + Number(otherQty);
    if (totalReq <= 0) {
      showToast("Total requested quantity must be at least 1");
      return;
    }

    setSubmitting(true);
    try {
      const res = await managerApi.requestInventory({
        sku: requestItem.sku,
        productName: requestItem.name,
        unit: requestItem.unit,
        category: requestItem.category,
        quantity: totalReq,
        gradeAQuantity: Number(gradeA),
        gradeBQuantity: Number(gradeB),
        gradeCQuantity: Number(gradeC),
        otherQuantity: Number(otherQty),
        note: requestNote,
      });
      showToast(res.data.message || "Request sent to your vendor");
      setRequestItem(null);
      setView("requests");
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Store Stock & Inventory Management"
    >
      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {view === "inventory"
                ? `Catalog Inventory (${filteredInventory.length} Products)`
                : `Restock Requests (${requests.length})`}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setView("inventory")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  view === "inventory" ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                Inventory
              </button>
              <button
                type="button"
                onClick={() => setView("requests")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  view === "requests" ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                My Requests
                {pendingSkuSet.size > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] text-slate-900">
                    {pendingSkuSet.size}
                  </span>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {view === "inventory" && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product name or SKU..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  categoryFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                    categoryFilter === cat
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl bg-slate-200/60 animate-pulse" />
      ) : view === "requests" ? (
        <>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black text-white text-xs font-bold uppercase tracking-wider">
                <th className="py-2 px-4">Request</th>
                <th className="py-2 px-4">Product</th>
                <th className="py-2 px-4">Qty</th>
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4">Note</th>
                <th className="py-2 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">
                    No restock requests yet. Open Inventory and tap Request Stock.
                  </td>
                </tr>
              ) : (
                requestsPagination.pageRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setViewingRequest(row)}>
                    <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-800">
                      {row.requestNumber}
                      <div className="font-sans font-normal text-[10px] text-slate-400">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{row.productName}</div>
                      <div className="font-mono text-[11px] text-slate-400">{row.sku}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${
                          REQUEST_STATUS[row.status] || REQUEST_STATUS.pending
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">
                      {row.reviewNote || row.note || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">View Details</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={requestsPagination} />
        </>
      ) : filteredInventory.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <h3 className="text-base font-bold text-slate-800">No Matching Stock Items</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query or category filter.
          </p>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black text-white text-xs font-bold uppercase tracking-wider">
                <th className="py-2 px-4">SKU Code</th>
                <th className="py-2 px-4">Product Name</th>
                <th className="py-2 px-4">Category</th>
                <th className="py-2 px-4">Stock Level</th>
                <th className="py-2 px-4 text-right">Unit Price</th>
                <th className="py-2 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventoryPagination.pageRows.map((row) => {
                const isZero = row.stockCount === 0;
                const isLow = row.isLowStock;
                const pending = pendingSkuSet.has(row.sku);

                return (
                  <tr key={row.id || row.sku} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 font-semibold text-[11px]">
                      {row.sku}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">{row.name}</td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px]">
                        {row.category || "General"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isZero ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                          Out of Stock (0 {row.unit})
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                          Low Stock ({row.stockCount} {row.unit})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                          {row.stockCount} {row.unit}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                      ₹{row.price}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {pending ? (
                        <span className="text-[11px] font-bold text-amber-700">Pending PM</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openRequest(row)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                        >
                          Request Stock
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination pagination={inventoryPagination} />
        </>
      )}

      {requestItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <form
            onSubmit={submitRequest}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Request inventory</h3>
              <p className="mt-1 text-xs text-slate-500">
                Sends a restock request to your Vendor for approval:{" "}
                <span className="font-semibold">{requestItem.name}</span>
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Current stock: <strong>{requestItem.stockCount} {requestItem.unit}</strong> · SKU{" "}
              {requestItem.sku}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-xs font-bold text-slate-700">
                Grade A Qty
                <input
                  type="number" min={0} value={gradeA} onChange={(e) => setGradeA(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Grade B Qty
                <input
                  type="number" min={0} value={gradeB} onChange={(e) => setGradeB(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Grade C Qty
                <input
                  type="number" min={0} value={gradeC} onChange={(e) => setGradeC(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Other Qty
                <input
                  type="number" min={0} value={otherQty} onChange={(e) => setOtherQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            <div className="text-right text-xs font-bold text-emerald-700">
              Total Requested: {Number(gradeA) + Number(gradeB) + Number(gradeC) + Number(otherQty)} {requestItem.unit}
            </div>

            <label className="block text-xs font-bold text-slate-700">
              Note for vendor
              <textarea
                rows={2}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRequestItem(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Viewing Details Modal */}
      {viewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Details</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {viewingRequest.requestNumber}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${
                  REQUEST_STATUS[viewingRequest.status] || REQUEST_STATUS.pending
                }`}
              >
                {viewingRequest.status}
              </span>
            </div>
            
            <div className="rounded-xl bg-slate-50 p-4 space-y-2">
              <div className="font-bold text-slate-900">{viewingRequest.productName}</div>
              <div className="text-xs text-slate-500">SKU: {viewingRequest.sku}</div>
              <hr className="border-slate-200 my-2" />
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-slate-500">Grade A:</div>
                <div className="font-semibold">{viewingRequest.gradeAQuantity || 0} {viewingRequest.unit}</div>
                
                <div className="text-slate-500">Grade B:</div>
                <div className="font-semibold">{viewingRequest.gradeBQuantity || 0} {viewingRequest.unit}</div>
                
                <div className="text-slate-500">Grade C:</div>
                <div className="font-semibold">{viewingRequest.gradeCQuantity || 0} {viewingRequest.unit}</div>
                
                <div className="text-slate-500">Other:</div>
                <div className="font-semibold">{viewingRequest.otherQuantity || 0} {viewingRequest.unit}</div>
                
                <div className="text-slate-500 font-bold mt-2">Total Qty:</div>
                <div className="font-bold mt-2">{viewingRequest.quantity} {viewingRequest.unit}</div>
              </div>
            </div>

            {viewingRequest.note && (
              <div className="text-sm">
                <div className="font-bold text-slate-700 text-xs">Note:</div>
                <div className="text-slate-600 mt-1">{viewingRequest.note}</div>
              </div>
            )}
            
            {viewingRequest.reviewNote && (
              <div className="text-sm rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                <div className="font-bold text-emerald-800 text-xs">Reviewer Note:</div>
                <div className="text-emerald-700 mt-1">{viewingRequest.reviewNote}</div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingRequest(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
