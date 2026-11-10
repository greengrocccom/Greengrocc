import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { useLive } from "../../realtime/useLive";
import { Pagination, usePagination } from "../../components/ui/Pagination";
import { AttendanceBadge, apiError, formatDateTime, formatMoney } from "./fullTimeUi";

export default function FullTimeAssignOrdersPage() {
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [riderId, setRiderId] = useState("");
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "", skipped: [] });

  const load = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [d, o, a] = await Promise.all([
        managerApi.getFullTimeDrivers(),
        managerApi.getFullTimeAssignableOrders(),
        managerApi.getFullTimeAssignedOrders(),
      ]);
      const assignable = o.data?.orders || [];
      setDrivers(d.data?.drivers || []);
      setOrders(assignable);
      setAssigned(a.data?.orders || []);
      setSelected((prev) => prev.filter((id) => assignable.some((x) => x.id === id)));
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to load data"), skipped: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useLive(load, [load]);

  const visibleOrders = useMemo(
    () =>
      orders.filter((o) =>
        filter === "preorder" ? o.isPreOrder : filter === "regular" ? !o.isPreOrder : true
      ),
    [orders, filter]
  );
  const ordersPagination = usePagination(visibleOrders, { resetDeps: [filter] });
  const assignedPagination = usePagination(assigned);
  const activeDrivers = drivers.filter((d) => d.isActive);
  const chosenDriver = drivers.find((d) => d.id === riderId);

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((o) => selected.includes(o.id));
  const toggleAll = () =>
    setSelected((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !visibleOrders.some((o) => o.id === id))
        : [...new Set([...prev, ...visibleOrders.map((o) => o.id)])]
    );

  const assign = async () => {
    if (!riderId || !selected.length) return;
    setBusy(true);
    setNotice({ type: "", text: "", skipped: [] });
    try {
      const res = await managerApi.assignOrdersToFullTime(riderId, selected);
      setNotice({ type: "ok", text: res.data?.message, skipped: res.data?.skipped || [] });
      setSelected([]);
    } catch (err) {
      setNotice({
        type: "error",
        text: apiError(err, "Failed to assign orders"),
        skipped: err.response?.data?.skipped || [],
      });
    } finally {
      setBusy(false);
      load({ silent: true });
    }
  };

  const unassign = async (order) => {
    if (!window.confirm(`Unassign order ${order.orderNumber} from ${order.rider?.name || "driver"}?`)) return;
    setBusy(true);
    try {
      const res = await managerApi.unassignFullTimeOrder(order.id);
      setNotice({ type: "ok", text: res.data?.message, skipped: [] });
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to unassign"), skipped: [] });
    } finally {
      setBusy(false);
      load({ silent: true });
    }
  };

  return (
    <PageShell
      title="Assign Orders to Full-Time Drivers"
    >
      {notice.text && (
        <div
          className={`rounded-2xl border p-3 text-xs font-semibold ${
            notice.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <div>{notice.text}</div>
          {notice.skipped.length > 0 && (
            <ul className="mt-1 list-disc pl-5 font-normal">
              {notice.skipped.map((s) => (
                <li key={s.orderId}>
                  {s.orderNumber || s.orderId}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">1. Choose Full-Time Driver</h3>
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ) : activeDrivers.length === 0 ? (
            <p className="text-xs text-slate-500">No active Full-Time drivers.</p>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {activeDrivers.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setRiderId(d.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    riderId === d.id
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{d.name}</span>
                    <AttendanceBadge status={d.attendance.status} />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="capitalize">{String(d.status || "offline").replace(/_/g, " ")}</span>
                    <span>{d.activeAssignedOrders} active order{d.activeAssignedOrders === 1 ? "" : "s"}</span>
                  </div>
                  {d.shift && (
                    <div className="text-[10px] text-slate-400">
                      {d.shift.name} · {d.shift.startTime} – {d.shift.endTime}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">2. Select Packed Orders</h3>
            <div className="flex gap-1">
              {[
                ["all", "All"],
                ["preorder", "Pre-Orders"],
                ["regular", "Regular"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                    filter === key ? "bg-black text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ) : visibleOrders.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              No packed delivery orders waiting. Orders appear here after they are packed.
            </p>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-black text-xs font-bold uppercase tracking-wider text-white">
                  <tr>
                    <th className="px-3 py-2">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
                    </th>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Items</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Packed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ordersPagination.pageRows.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => toggle(o.id)}
                      className={`cursor-pointer align-top transition ${
                        selected.includes(o.id) ? "bg-emerald-50" : o.isPreOrder ? "bg-amber-50/50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(o.id)}
                          onChange={() => toggle(o.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/orders/${o.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-slate-900 hover:text-emerald-700"
                        >
                          {o.orderNumber}
                        </Link>
                        {o.isPreOrder && (
                          <div className="mt-0.5 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Pre-Order {o.preOrderSlot ? `· ${o.preOrderSlot}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div className="font-semibold text-slate-800">{o.customerName}</div>
                        <div className="max-w-[240px] truncate text-slate-400">{o.customerAddress}</div>
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-700">{o.itemCount}</td>
                      <td className="px-3 py-3 text-xs font-bold text-slate-900">
                        {formatMoney(o.amountToCollect)}
                        <div className="text-[10px] font-semibold uppercase text-slate-400">{o.paymentMethod}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{formatDateTime(o.packedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={ordersPagination} />
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              {selected.length} order{selected.length === 1 ? "" : "s"} selected
              {chosenDriver ? ` → ${chosenDriver.name}` : " — choose a driver"}
            </p>
            <button
              type="button"
              disabled={busy || !riderId || !selected.length}
              onClick={assign}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Assigning…" : "Assign to Driver"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">Currently with Full-Time Drivers</h3>
        {assigned.length === 0 ? (
          <p className="text-xs text-slate-500">No active Full-Time assignments.</p>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-xs font-bold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Driver</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Assigned</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignedPagination.pageRows.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <Link to={`/orders/${o.id}`} className="font-bold text-slate-900 hover:text-emerald-700">
                        {o.orderNumber}
                      </Link>
                      {o.isPreOrder && <span className="ml-2 text-[10px] font-bold text-amber-700">Pre-Order</span>}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-800">{o.rider?.name || "—"}</td>
                    <td className="px-3 py-3 text-xs capitalize text-slate-600">{o.status.replace(/_/g, " ")}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{formatDateTime(o.assignedAt)}</td>
                    <td className="px-3 py-3 text-right">
                      {o.canUnassign ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => unassign(o)}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Unassign
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Picked up</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={assignedPagination} />
          </>
        )}
      </div>
    </PageShell>
  );
}
