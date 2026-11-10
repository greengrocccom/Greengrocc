import { useCallback, useEffect, useMemo, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { Icon } from "../../components/ui/Icon";
import { Pagination, usePagination } from "../../components/ui/Pagination";

const money = (value) =>
  `₹${(Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

const prettyDate = (date) => {
  if (!date) return "—";
  try {
    return new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      weekday: "short",
    });
  } catch (e) {
    return date;
  }
};

const formatTime = (isoString) => {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return "—";
  }
};

export default function MonthlyPaymentsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState("FULL_TIME");
  const [data, setData] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState("");
  const [payoutFilter, setPayoutFilter] = useState("ALL");

  // Modal state for detailed Daily Attendance or Daily KM Breakdown
  const [selectedRiderForModal, setSelectedRiderForModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await managerApi.getMonthlyRiderPayments({ month, employmentType: type });
      setData({ rows: res.data?.rows || [], totals: res.data?.totals || {} });
    } catch (err) {
      setError(err.response?.data?.message || "Could not load salary data.");
    } finally {
      setLoading(false);
    }
  }, [month, type]);

  useEffect(() => {
    load();
  }, [load]);

  const fullTime = type === "FULL_TIME";

  // Calculations for stats
  const totalRiders = data.rows.length;
  const totalPayable = data.rows.reduce((sum, rider) => sum + (Number(rider.payable) || 0), 0);
  const totalKm = data.rows.reduce((sum, rider) => sum + (Number(rider.totalDeliveryKm) || 0), 0);
  const paidRows = data.rows.filter((r) => r.paid);
  const pendingRows = data.rows.filter((r) => !r.paid);
  const totalPaidAmount = paidRows.reduce((sum, r) => sum + (Number(r.paidAmount ?? r.payable) || 0), 0);
  const totalPendingAmount = pendingRows.reduce((sum, r) => sum + (Number(r.payable) || 0), 0);

  // Filtered rows
  const visibleRows = useMemo(() => {
    return data.rows
      .filter((rider) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          (rider.name || "").toLowerCase().includes(q) ||
          (rider.phone || "").toLowerCase().includes(q) ||
          String(rider.riderId || "").toLowerCase().includes(q)
        );
      })
      .filter((rider) => {
        if (payoutFilter === "PAID") return rider.paid;
        if (payoutFilter === "PENDING") return !rider.paid;
        return true;
      });
  }, [data.rows, searchQuery, payoutFilter]);

  const pagination = usePagination(visibleRows, {
    resetDeps: [month, type, searchQuery, payoutFilter],
  });

  const monthYearLabel = useMemo(() => {
    try {
      const [y, m] = month.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return month;
    }
  }, [month]);

  return (
    <PageShell title={null}>
      {/* ERROR ALERT */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}



      {/* 4 TOP STAT CARDS (COMPACT SLEEK HEIGHT) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: TOTAL RIDERS */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/80 via-emerald-50/30 to-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <Icon name="user" size="sm" className="text-emerald-800" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Total {fullTime ? "Full-Time" : "Part-Time"}</p>
              <p className="text-lg font-black text-slate-900 leading-tight">{loading ? "…" : totalRiders}</p>
              <p className="text-[10px] font-semibold text-emerald-700 leading-tight mt-0.5">
                {fullTime ? "Salaried Payroll" : "Commission Roster"}
              </p>
            </div>
          </div>
          <svg className="h-6 w-14 stroke-emerald-500/80 shrink-0" fill="none" viewBox="0 0 80 36">
            <path d="M2 30 Q 20 28, 30 20 T 55 18 T 78 6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* CARD 2: NET PAYABLE */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/70 via-teal-50/20 to-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <Icon name="cash" size="sm" className="text-emerald-800" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Net Payable</p>
              <p className="text-lg font-black text-slate-900 leading-tight">{loading ? "…" : money(totalPayable)}</p>
              <p className="text-[10px] font-semibold text-emerald-700 leading-tight mt-0.5">
                {fullTime ? "Base − deductions" : `${totalKm.toFixed(1)} km recorded`}
              </p>
            </div>
          </div>
          <svg className="h-6 w-14 stroke-emerald-500/80 shrink-0" fill="none" viewBox="0 0 80 36">
            <path d="M2 28 Q 18 26, 32 18 T 58 14 T 78 8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* CARD 3: ALREADY PAID */}
        <div className="relative overflow-hidden rounded-xl border border-blue-100/90 bg-gradient-to-br from-blue-50/70 via-sky-50/20 to-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Icon name="check" size="sm" className="text-blue-700" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Disbursed (Paid)</p>
              <p className="text-lg font-black text-slate-900 leading-tight">{loading ? "…" : money(totalPaidAmount)}</p>
              <p className="text-[10px] font-semibold text-blue-600 leading-tight mt-0.5">
                {paidRows.length} of {totalRiders} settled
              </p>
            </div>
          </div>
          <svg className="h-6 w-14 stroke-blue-500/80 shrink-0" fill="none" viewBox="0 0 80 36">
            <path d="M2 32 Q 22 30, 32 22 T 56 16 T 78 8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* CARD 4: PENDING SETTLEMENT */}
        <div className="relative overflow-hidden rounded-xl border border-amber-100/90 bg-gradient-to-br from-amber-50/70 via-orange-50/20 to-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Icon name="clock" size="sm" className="text-amber-700" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Pending Settlement</p>
              <p className="text-lg font-black text-slate-900 leading-tight">{loading ? "…" : money(totalPendingAmount)}</p>
              <p className="text-[10px] font-semibold text-amber-600 leading-tight mt-0.5">
                {pendingRows.length} awaiting admin
              </p>
            </div>
          </div>
          <svg className="h-6 w-14 stroke-amber-500/80 shrink-0" fill="none" viewBox="0 0 80 36">
            <path d="M2 30 Q 18 28, 30 20 T 52 24 T 78 12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* FILTER CONTROLS BAR: SEGMENTED FULL-TIME/PART-TIME + SEARCH + STATUS */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
        {/* Full-Time vs Part-Time Toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setType("FULL_TIME")}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
              type === "FULL_TIME"
                ? "bg-[#064e3b] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            Full-Time Riders
          </button>
          <button
            type="button"
            onClick={() => setType("PART_TIME")}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
              type === "PART_TIME"
                ? "bg-[#064e3b] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            Part-Time Riders
          </button>
        </div>

        {/* Month, Search & Status Filter */}
        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          {/* Month Selector */}
          <div className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500">Month:</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="font-bold text-xs text-emerald-800 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>

          <div className="relative min-w-[200px] max-w-sm flex-1 sm:flex-initial">
            <span className="absolute left-3 top-2.5 text-slate-400">
              <Icon name="search" size="sm" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rider by name or phone..."
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none shadow-2xs"
            />
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

          {/* Payout Status Filter Dropdown */}
          <select
            value={payoutFilter}
            onChange={(e) => setPayoutFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Status ({data.rows.length})</option>
            <option value="PENDING">Unpaid ({pendingRows.length})</option>
            <option value="PAID">Paid ({paidRows.length})</option>
          </select>
        </div>
      </div>

      {/* SALARY & PAYOUTS TABLE */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-slate-200/60 animate-pulse" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[900px]">
              <thead className="bg-[#ecfdf5] border-b border-emerald-100 text-[11px] font-bold text-slate-700 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 whitespace-nowrap">RIDER</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">{fullTime ? "BASE SALARY" : "TOTAL DISTANCE"}</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">
                    {fullTime ? "ATTENDANCE & LEAVES" : "RATE & DISTANCE"}
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap">
                    {fullTime ? "DEDUCTIONS" : "COMMISSION"}
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap">NET PAYABLE</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">PAYOUT STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs font-semibold text-slate-400">
                      No {fullTime ? "Full-Time" : "Part-Time"} riders match the current criteria.
                    </td>
                  </tr>
                ) : (
                  pagination.pageRows.map((rider) => {
                    const isPaid = Boolean(rider.paid);

                    return (
                      <tr
                        key={rider.riderId}
                        className="hover:bg-slate-50/80 transition cursor-pointer"
                        onClick={() => setSelectedRiderForModal(rider)}
                      >
                        {/* 1. Rider Details: Picture + Name + Phone (No phone icon, No full-time/part-time tag) */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-emerald-50 flex items-center justify-center">
                              {rider.selfie ? (
                                <img
                                  src={rider.selfie}
                                  alt={rider.name || "Rider"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-800">
                                  {(rider.name || "R").charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex flex-col justify-center">
                              <span className="text-xs font-bold text-slate-900 leading-tight">
                                {rider.name || "Delivery Partner"}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">
                                {rider.phone || "—"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Base Salary / Total Distance */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {fullTime ? (
                            <div>
                              <span className="font-bold text-slate-900 text-xs">
                                {money(rider.salaryAssigned ?? rider.payroll?.baseSalary ?? 0)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium ml-1">/ month</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-900 text-xs">
                                {Number(rider.totalDeliveryKm || 0).toFixed(1)} km
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium block">
                                {rider.completedDeliveries || 0} orders
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 3. Attendance: Total --Attendance out of-- in normal format and button below */}
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          {fullTime ? (
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-xs font-semibold text-slate-800">
                                {rider.payroll?.presentDays ?? 0} out of {rider.payroll?.scheduledWorkingDays || 30} Days
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedRiderForModal(rider)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                              >
                                <span>View Details</span>
                                <span className="text-[10px]">→</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-xs font-semibold text-slate-800">
                                {money(rider.commissionRatePerKm || 5)} / km
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedRiderForModal(rider)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                              >
                                <span>View Details</span>
                                <span className="text-[10px]">→</span>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 4. Deductions / Commission */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {fullTime ? (
                            <div>
                              <span className="font-bold text-slate-800 text-xs">
                                {Number(rider.payroll?.deductions) > 0
                                  ? `−${money(rider.payroll?.deductions)}`
                                  : "₹0"}
                              </span>
                              <span className="block text-[10px] text-slate-400">Leaves &amp; fines</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-800 text-xs">
                                {money(rider.commission)}
                              </span>
                              <span className="block text-[10px] text-slate-400">Total earned</span>
                            </div>
                          )}
                        </td>

                        {/* 5. Net Payable */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-black text-slate-900 text-xs">
                          {money(rider.payable)}
                        </td>

                        {/* 6. Payout Status: Disabled Unpaid / Disabled Paid badge (Admin will pay) */}
                        <td className="px-5 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {isPaid ? (
                            <div className="flex flex-col items-start">
                              <span
                                className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 cursor-not-allowed select-none opacity-90"
                                title="Marked as paid by Admin"
                              >
                                Paid
                              </span>
                              {rider.paidAt && (
                                <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                  {new Date(rider.paidAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span
                              className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 cursor-not-allowed select-none"
                              title="Payouts are processed by Admin"
                            >
                              Unpaid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} className="border-t border-slate-100 px-5" />
        </div>
      )}

      {/* DETAILED DAILY ATTENDANCE & DISTANCE BREAKDOWN MODAL */}
      {selectedRiderForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-[#ecfdf5] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-emerald-100 flex items-center justify-center">
                  {selectedRiderForModal.selfie ? (
                    <img
                      src={selectedRiderForModal.selfie}
                      alt={selectedRiderForModal.name || "Rider"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-emerald-900">
                      {(selectedRiderForModal.name || "R").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {selectedRiderForModal.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedRiderForModal.phone || "—"} · Month: {monthYearLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRiderForModal(null)}
                className="rounded-full bg-white/80 p-2 text-slate-400 hover:bg-white hover:text-slate-700 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Financial Summary Strip */}
            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-4 text-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {selectedRiderForModal.employmentType === "FULL_TIME" ? "Base Salary" : "Rate / KM"}
                </p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">
                  {selectedRiderForModal.employmentType === "FULL_TIME"
                    ? money(selectedRiderForModal.salaryAssigned ?? selectedRiderForModal.payroll?.baseSalary)
                    : money(selectedRiderForModal.commissionRatePerKm)}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {selectedRiderForModal.employmentType === "FULL_TIME" ? "Deductions" : "Deliveries"}
                </p>
                <p className="text-sm font-bold text-rose-600 mt-0.5">
                  {selectedRiderForModal.employmentType === "FULL_TIME"
                    ? `−${money(selectedRiderForModal.payroll?.deductions)}`
                    : `${selectedRiderForModal.completedDeliveries || 0} orders`}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Payable</p>
                <p className="text-sm font-black text-emerald-700 mt-0.5">
                  {money(selectedRiderForModal.payable)}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payout Status</p>
                <div className="mt-1">
                  {selectedRiderForModal.paid ? (
                    <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      Unpaid
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Day-by-Day Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selectedRiderForModal.employmentType === "FULL_TIME" ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Day-by-Day Attendance Record ({monthYearLabel})
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className="text-emerald-700">
                        {selectedRiderForModal.payroll?.presentDays ?? 0} Present
                      </span>
                      <span>·</span>
                      <span className="text-rose-600">
                        {selectedRiderForModal.payroll?.absentDays ?? 0} Absent
                      </span>
                      <span>·</span>
                      <span className="text-sky-700">
                        {selectedRiderForModal.payroll?.paidLeaves ?? 0} Paid Leave
                      </span>
                    </div>
                  </div>

                  {(!selectedRiderForModal.attendance || selectedRiderForModal.attendance.length === 0) ? (
                    <p className="py-8 text-center text-xs text-slate-400 font-semibold">
                      No attendance records found for this month.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedRiderForModal.attendance.map((day) => {
                        const isPresent = day.status === "present";
                        const isAbsent = day.status === "absent";
                        const isLeave = day.status === "leave";

                        return (
                          <div
                            key={day.date}
                            className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition ${
                              isPresent
                                ? "border-emerald-200 bg-emerald-50/60"
                                : isAbsent
                                ? "border-rose-200 bg-rose-50/60"
                                : isLeave
                                ? "border-sky-200 bg-sky-50/60"
                                : "border-slate-200 bg-slate-50/50"
                            }`}
                          >
                            <div>
                              <p className="font-bold text-slate-800">{prettyDate(day.date)}</p>
                              {day.markedAt && (
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  Marked at: {formatTime(day.markedAt)}
                                </p>
                              )}
                            </div>
                            <span
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                isPresent
                                  ? "bg-emerald-200 text-emerald-900"
                                  : isAbsent
                                  ? "bg-rose-200 text-rose-900"
                                  : isLeave
                                  ? "bg-sky-200 text-sky-900"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {day.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Day-by-Day Delivery Distance &amp; KM ({monthYearLabel})
                    </h4>
                    <span className="text-xs font-bold text-slate-800">
                      Total: {Number(selectedRiderForModal.totalDeliveryKm || 0).toFixed(2)} km
                    </span>
                  </div>

                  {(!selectedRiderForModal.dailyKm ||
                    selectedRiderForModal.dailyKm.filter((d) => d.km > 0).length === 0) ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-semibold rounded-2xl border border-slate-100 bg-slate-50">
                      No delivery distance logged for this period.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedRiderForModal.dailyKm
                        .filter((day) => day.km > 0)
                        .map((day) => (
                          <div
                            key={day.date}
                            className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-800">{prettyDate(day.date)}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {day.deliveries} completed delivery order{day.deliveries > 1 ? "s" : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-slate-900 text-sm">
                                {Number(day.km).toFixed(2)} km
                              </p>
                              <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                                ≈ {money(day.km * (selectedRiderForModal.commissionRatePerKm || 5))}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setSelectedRiderForModal(null)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
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
