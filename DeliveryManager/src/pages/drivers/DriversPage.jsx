import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { useAuth } from "../../context/AuthContext";
import { PageShell } from "../../components/layout/ManagerLayout";
import { useLive } from "../../realtime/useLive";
import { subscribeToSocketEvent } from "../../services/socket";

const EMPTY = { name: "", phone: "", password: "", employmentType: "PART_TIME" };

export default function DriversPage() {
  const navigate = useNavigate();
  const { manager } = useAuth();
  const [riders, setRiders] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const res = await managerApi.riders();
      setRiders(res.data.riders || []);
      setError("");
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || "Failed to load drivers");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useLive(load, [load]);

  useEffect(() => {
    const unsub = subscribeToSocketEvent("rider_cash_updated", () => {
      load({ silent: true });
    });
    return () => unsub?.();
  }, [load]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const res = await managerApi.createRider(form);
      setMessage(res.data?.message || "Delivery partner created successfully!");
      setForm(EMPTY);
      setIsCreateOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create delivery partner");
    } finally {
      setSubmitting(false);
    }
  };

  const onlineCount = riders.filter((r) => r.status === "online").length;
  const offlineCount = Math.max(0, riders.length - onlineCount);
  const fullTimeCount = riders.filter((r) => r.employmentType === "FULL_TIME").length;
  const driversWithPendingCash = riders.filter((r) => (Number(r.pendingCashAmount) || 0) > 0);
  const totalRiderPendingCash = driversWithPendingCash.reduce(
    (sum, r) => sum + (Number(r.pendingCashAmount) || 0),
    0
  );
  const typeTabs = [
    ["ALL", "All", riders.length],
    ["FULL_TIME", "🟢 Full-Time", fullTimeCount],
    ["PART_TIME", "🔵 Part-Time", riders.length - fullTimeCount],
  ];
  const visibleRiders = riders
    .filter((r) => typeFilter === "ALL" || (r.employmentType || "PART_TIME") === typeFilter)
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (r.name || "").toLowerCase().includes(q) || (r.phone || "").toLowerCase().includes(q);
    });

  return (
    <PageShell>
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-xs flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      ) : null}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* CASH COLLECTION DUE WARNING BANNER */}
      {driversWithPendingCash.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm animate-fade-in">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-950 font-black text-sm">
                ⚠️
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-amber-950">
                  Cash Collection Due: Collect ₹{totalRiderPendingCash.toLocaleString()} from {driversWithPendingCash.length} delivery partner{driversWithPendingCash.length > 1 ? "s" : ""} till end of the day
                </h3>
                <p className="mt-0.5 text-xs text-amber-900/80">
                  Delivery partners have collected Cash on Delivery (COD) from customers. Ensure this cash is collected and settled before end of shift.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {driversWithPendingCash.map((d) => (
                <span
                  key={d.id || d._id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  {d.name || d.phone}: <strong className="text-amber-800">₹{(Number(d.pendingCashAmount) || 0).toLocaleString()}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SINGLE COMPACT TOP ROW: ONLINE COUNT + OFFLINE COUNT + TOTAL COUNT + ACTION */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
        {/* CARD 1: ONLINE DRIVERS */}
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Online Drivers Today</p>
          <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-base font-black text-emerald-600">{onlineCount}</span>
            <span className="text-[10px] font-medium text-emerald-600">(Active Now)</span>
          </div>
        </div>

        {/* CARD 2: OFFLINE DRIVERS */}
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Offline Drivers Today</p>
          <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-base font-black text-slate-700">{offlineCount}</span>
            <span className="text-[10px] font-medium text-slate-400">(Inactive)</span>
          </div>
        </div>

        {/* CARD 3: TOTAL APPROVED DRIVERS */}
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Approved Roster</p>
          <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-base font-black text-slate-900">{riders.length}</span>
            <span className="text-[10px] font-medium text-slate-400">(Bound to Hub)</span>
          </div>
        </div>

        {/* CARD 4: ACTIONS */}
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Actions</p>
          <button
            type="button"
            onClick={() => setIsCreateOpen((prev) => !prev)}
            className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition active:scale-98 whitespace-nowrap cursor-pointer"
          >
            <span>{isCreateOpen ? "✕ Close Form" : "+ Create Delivery Partner"}</span>
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE DRIVER CREATION DROPDOWN FORM */}
      {isCreateOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Create Delivery Partner Account</h3>
              <p className="text-[11px] text-slate-500">Register new rider credentials bound to {manager?.area || "Dark Store Hub"}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Mobile Number
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  minLength={6}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Employment Type
                </label>
                <select
                  name="employmentType"
                  value={form.employmentType}
                  onChange={(e) => setForm((p) => ({ ...p, employmentType: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                >
                  <option value="PART_TIME">Part-Time</option>
                  <option value="FULL_TIME">Full-Time</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 transition cursor-pointer"
              >
                {submitting ? "Creating Credentials…" : "Create Partner Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & SEARCH CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex flex-wrap gap-1.5">
          {typeTabs.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                typeFilter === key
                  ? "bg-[#064e3b] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="h-8.5 w-60 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none shadow-2xs"
          />
          <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* DRIVER ROSTER TABLE */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-slate-200/60 animate-pulse" />
      ) : riders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-700">No approved riders yet</h3>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-5 whitespace-nowrap">Driver</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Vehicle &amp; Hub</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Rating &amp; On-Time</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Orders (Accepted / Cancelled)</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Cash in Hand (COD)</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-5 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRiders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs font-semibold text-slate-400">
                    No drivers match this filter.
                  </td>
                </tr>
              )}
              {visibleRiders.map((r) => {
                const isOnline = r.status === "online";
                const isOnDelivery = r.status === "on_delivery";
                const firstLetter = (r.name || "D").charAt(0).toUpperCase();
                return (
                  <tr
                    key={r.id || r._id}
                    onClick={() => navigate(`/drivers/${r.id || r._id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    {/* DRIVER */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800 text-xs">
                          {firstLetter}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                              isOnline ? "bg-emerald-500 animate-pulse" : isOnDelivery ? "bg-amber-500" : "bg-slate-300"
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{r.name || "Delivery Partner"}</span>
                            {r.employmentType === "FULL_TIME" ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                                🟢 Full-Time
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200">
                                🔵 Part-Time
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-slate-500 text-xs mt-0.5">{r.phone}</p>
                        </div>
                      </div>
                    </td>

                    {/* VEHICLE & HUB */}
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-800 text-xs capitalize">{r.vehicleType || "Scooter"}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">{r.area || manager?.area || "Dark Store Hub"}</p>
                    </td>

                    {/* RATING & ON-TIME */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 font-bold text-slate-900 text-xs">
                          <span className="text-amber-500">★</span>
                          <span>{Number(r.rating || 4.9).toFixed(1)}</span>
                          <span className="text-slate-400 font-normal text-[10px]">({r.totalRatingsCount || 12})</span>
                        </div>
                        <span className="inline-block text-[10px] font-bold text-emerald-700">
                          {r.onTimeRate || 98}% On-Time
                        </span>
                      </div>
                    </td>

                    {/* ORDERS (ACCEPTED / CANCELLED) */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="font-bold text-slate-800">
                          ✓ {r.totalAccepted || r.totalDelivered || 0} accepted
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {r.totalCancelled ? `✕ ${r.totalCancelled} cancelled` : "0 cancelled"}
                        </span>
                      </div>
                    </td>

                    {/* CASH IN HAND */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      {(Number(r.pendingCashAmount) || 0) > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900 shadow-2xs">
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                          ₹{Number(r.pendingCashAmount).toLocaleString()} (Collect)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">₹0 (Settled)</span>
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${
                          isOnDelivery
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : isOnline
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isOnDelivery ? "bg-amber-500 animate-pulse" : isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                          }`}
                        />
                        {isOnDelivery ? "ON DELIVERY" : isOnline ? "ONLINE" : "OFFLINE"}
                      </span>
                    </td>

                    {/* ACTION */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/drivers/${r.id || r._id}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-600 transition shadow-2xs cursor-pointer active:scale-95"
                      >
                        <span>View More</span>
                        <span>→</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
