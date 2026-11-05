import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { subscribeToSocketEvent } from "../../services/socket";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const money = (amount) => rupees.format(Number(amount) || 0);

const formatIstDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const getTodayStr = () => formatIstDate(new Date());

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return formatIstDate(d);
};

const addMonths = (dateStr, months) => {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00+05:30`);
  d.setMonth(d.getMonth() + months);
  return formatIstDate(d);
};

const formatDateTime = (dateVal) => {
  if (!dateVal) return "—";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(d);
  } catch {
    return "—";
  }
};

const canReceive = (record) => record.status === "PENDING" || record.status === "SUBMITTED";

export default function CashCollectionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [saving, setSaving] = useState(false);

  // Period: "day" | "week" | "month"
  const [period, setPeriod] = useState("day");
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  // Search & Status filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "received" | "pending"

  const request = useRef(0);
  const todayStr = useMemo(() => getTodayStr(), []);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      const res = await managerApi.getCashCollection({
        period,
        date: selectedDate,
      });
      if (id !== request.current) return;
      setData(res.data);
      setError("");
    } catch (err) {
      if (id === request.current) {
        setError(err.response?.data?.message || "Could not load cash collections.");
      }
    } finally {
      if (id === request.current) {
        setLoading(false);
      }
    }
  }, [period, selectedDate]);

  useEffect(() => {
    load();
    const offCash = subscribeToSocketEvent("store_cash_updated", load);
    const offConnect = subscribeToSocketEvent("connect", load);
    return () => {
      request.current++;
      offCash();
      offConnect();
    };
  }, [load]);

  const confirm = async () => {
    if (!receipt || saving) return;
    setSaving(true);
    setError("");
    try {
      const { rider, records } = receipt;
      const res = rider?.riderId
        ? await managerApi.confirmCashCollection(
            rider.riderId,
            records.map((record) => record.id)
          )
        : await managerApi.confirmOrderCash(records[0].orderId);
      setNotice(res.data.message || "Cash receipt recorded successfully.");
      setReceipt(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm cash receipt.");
    } finally {
      setSaving(false);
    }
  };

  // Period navigation helpers
  const handlePrev = () => {
    if (period === "day") setSelectedDate((prev) => addDays(prev, -1));
    else if (period === "week") setSelectedDate((prev) => addDays(prev, -7));
    else if (period === "month") setSelectedDate((prev) => addMonths(prev, -1));
  };

  const handleNext = () => {
    if (period === "day") setSelectedDate((prev) => addDays(prev, 1));
    else if (period === "week") setSelectedDate((prev) => addDays(prev, 7));
    else if (period === "month") setSelectedDate((prev) => addMonths(prev, 1));
  };

  const handleGoToday = () => {
    setSelectedDate(todayStr);
  };

  const isTodaySelected = period === "day" && selectedDate === todayStr;

  // Flattened transaction records from response
  const rawRecords = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data.records) && data.records.length > 0) {
      return data.records;
    }
    const list = [];
    (data.riders || []).forEach((r) => {
      (r.settlements || []).forEach((s) => {
        list.push({
          id: s.id,
          orderId: s.orderId,
          orderNumber: s.orderNumber,
          riderId: r.riderId,
          driverName: r.name,
          driverPhone: r.phone,
          amount: s.amount,
          status: s.status,
          isReceived: s.status === "COMPLETED",
          receivedAmount: s.status === "COMPLETED" ? s.amount : 0,
          collectedAt: s.collectedAt,
          confirmedAt: s.confirmedAt,
          submittedAt: s.submittedAt,
        });
      });
    });
    return list;
  }, [data]);

  // Filtered records based on search and status
  const filteredRecords = useMemo(() => {
    let list = rawRecords;

    if (statusFilter === "received") {
      list = list.filter((r) => r.isReceived || r.status === "COMPLETED");
    } else if (statusFilter === "pending") {
      list = list.filter((r) => !r.isReceived && r.status !== "COMPLETED");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.driverName && r.driverName.toLowerCase().includes(q)) ||
          (r.driverPhone && r.driverPhone.includes(q)) ||
          (r.orderNumber && r.orderNumber.toLowerCase().includes(q)) ||
          (r.orderId && r.orderId.toLowerCase().includes(q))
      );
    }

    return list;
  }, [rawRecords, statusFilter, searchQuery]);

  // Totals for filtered records
  const pageTotals = useMemo(() => {
    const totalCollected = filteredRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalReceived = filteredRecords.reduce((sum, r) => sum + (Number(r.receivedAmount) || 0), 0);
    const totalPending = filteredRecords.reduce(
      (sum, r) => sum + (!r.isReceived && r.status !== "COMPLETED" ? Number(r.amount) || 0 : 0),
      0
    );
    return {
      collected: totalCollected,
      received: totalReceived,
      pending: totalPending,
      count: filteredRecords.length,
    };
  }, [filteredRecords]);

  // Overall backend totals
  const totals = data?.totals || {
    collected: 0,
    received: 0,
    pending: 0,
    riderCount: 0,
  };

  return (
    <PageShell
      title="Cash Collection"
      meta="Physical COD cash collected on orders and handover verification to store manager"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      }
    >
      {error && !receipt && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 flex justify-between items-center">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">✕</button>
        </div>
      )}

      {/* ─── COMPACT PERIOD SELECTOR & DATE BAR ─── */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Day / Week / Month Switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setPeriod("day")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                period === "day"
                  ? "bg-white text-emerald-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📅 Day (Daily)
            </button>
            <button
              type="button"
              onClick={() => setPeriod("week")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                period === "week"
                  ? "bg-white text-emerald-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📆 Week (Weekly)
            </button>
            <button
              type="button"
              onClick={() => setPeriod("month")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                period === "month"
                  ? "bg-white text-emerald-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🗓️ Month (Monthly)
            </button>
          </div>

          {/* Date Navigation & Current Label */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
              title="Previous period"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={handleGoToday}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                isTodaySelected
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {period === "day" ? "Today" : period === "week" ? "This Week" : "This Month"}
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
              title="Next period"
            >
              ›
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none"
            />

            <span className="font-bold text-slate-800 text-xs ml-1">
              {data?.periodLabel || selectedDate}
            </span>
            {isTodaySelected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── SUMMARY KPI CARDS (FULL DAY / PERIOD TOTALS) ─── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {/* Total Collected */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              {period === "day" ? "Collected Today" : "Total Cash Collected"}
            </p>
            <span className="rounded-full bg-slate-100 p-1.5 text-xs">💵</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">
            {money(totals.collected)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Physical COD cash collected by drivers
          </p>
        </div>

        {/* Received by Manager */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
              {period === "day" ? "Received Today" : "Received by Manager"}
            </p>
            <span className="rounded-full bg-emerald-100 p-1.5 text-xs text-emerald-700">✓</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-900">
            {money(totals.received)}
          </p>
          <p className="mt-1 text-[11px] text-emerald-700">
            Cash confirmed & received by manager
          </p>
        </div>

        {/* Awaiting Receipt / Pending */}
        <div className={`rounded-xl border p-4 shadow-2xs ${
          totals.pending > 0 ? "border-amber-300 bg-amber-50/60" : "border-slate-200/90 bg-white"
        }`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-bold uppercase tracking-wide ${totals.pending > 0 ? "text-amber-800" : "text-slate-600"}`}>
              Awaiting Handover
            </p>
            <span className="rounded-full bg-amber-100 p-1.5 text-xs text-amber-700">⏳</span>
          </div>
          <p className={`mt-2 text-2xl font-extrabold tabular-nums ${totals.pending > 0 ? "text-amber-900" : "text-slate-900"}`}>
            {money(totals.pending)}
          </p>
          <p className={`mt-1 text-[11px] ${totals.pending > 0 ? "text-amber-700 font-semibold" : "text-slate-500"}`}>
            {totals.pending > 0 ? "Cash still with drivers" : "All collections handed over"}
          </p>
        </div>

        {/* Active Riders */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              Active Riders
            </p>
            <span className="rounded-full bg-slate-100 p-1.5 text-xs">🛵</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">
            {totals.riderCount || 0}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Riders with cash collections
          </p>
        </div>
      </div>

      {/* ─── SEARCH & FILTER CONTROLS ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === "all"
                ? "border-slate-800 bg-slate-900 text-white"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            All Collections ({rawRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("received")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === "received"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            }`}
          >
            ✓ Received ({rawRecords.filter((r) => r.isReceived || r.status === "COMPLETED").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === "pending"
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-amber-50 hover:text-amber-800"
            }`}
          >
            ⏳ Pending Handover ({rawRecords.filter((r) => !r.isReceived && r.status !== "COMPLETED").length})
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search driver, phone, order #..."
            className="w-64 rounded-lg border border-slate-200 bg-slate-50/60 pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ─── CLEAN, STRUCTURED TABLE (NO INTRUSIVE BANNER ROWS) ─── */}
      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-400">
            Loading physical cash collections...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <p className="text-3xl">💵</p>
            <p className="text-sm font-bold text-slate-700">No cash collection records found</p>
            <p className="text-xs text-slate-400">
              {searchQuery || statusFilter !== "all"
                ? "Try changing your search query or status filter."
                : `No COD cash collections logged for ${data?.periodLabel || selectedDate}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">DRIVER & PHONE</th>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">ORDER #</th>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">CASH COLLECTED (CUSTOMER)</th>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">CASH RECEIVED TO MANAGER?</th>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">HOW MUCH RECEIVED</th>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">WHICH DAY DRIVER GAVE TO MANAGER</th>
                  <th scope="col" className="px-4 py-3.5 text-right whitespace-nowrap">ACTION</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => {
                  const isReceived = r.isReceived || r.status === "COMPLETED";
                  const isPending = canReceive(r);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition text-slate-700">
                      {/* 1. Driver Name & Phone Number */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                            {(r.driverName || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs">{r.driverName}</p>
                            {r.driverPhone ? (
                              <p className="text-[11px] text-slate-500 font-medium">📞 {r.driverPhone}</p>
                            ) : (
                              <p className="text-[11px] text-slate-400">Direct Store</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Order # */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {r.orderId ? (
                          <Link
                            to={`/orders/${r.orderId}`}
                            className="font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                          >
                            #{r.orderNumber || r.orderId.slice(-6)}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-600">
                            #{r.orderNumber || "—"}
                          </span>
                        )}
                      </td>

                      {/* 3. Cash Collected (Customer) & Date/Time */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-extrabold text-xs text-slate-900 tabular-nums">
                          {money(r.amount)}
                        </p>
                        <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                          📅 {formatDateTime(r.collectedAt)}
                        </p>
                      </td>

                      {/* 4. Cash Received to Manager or Not */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isReceived ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            Received
                          </span>
                        ) : r.status === "SUBMITTED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Not Received (Pending)
                          </span>
                        )}
                      </td>

                      {/* 5. How Much Received */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isReceived ? (
                          <span className="font-extrabold text-xs text-emerald-700 tabular-nums">
                            {money(r.receivedAmount || r.amount)}
                          </span>
                        ) : (
                          <div>
                            <span className="font-semibold text-xs text-slate-400 tabular-nums">
                              ₹0.00
                            </span>
                            <span className="text-[10px] text-amber-700 block font-medium">
                              ({money(r.amount)} due)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 6. Which Day Driver Gave to Manager */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {r.confirmedAt ? (
                          <div>
                            <span className="font-extrabold text-xs text-emerald-800 block">
                              📅 {formatDateTime(r.confirmedAt)}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-semibold block">
                              Verified Handover
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">
                            Pending Handover
                          </span>
                        )}
                      </td>

                      {/* 7. Action Button */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() =>
                              setReceipt({
                                rider: {
                                  riderId: r.riderId,
                                  name: r.driverName,
                                  phone: r.driverPhone,
                                },
                                records: [r],
                              })
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer"
                          >
                            Mark Received
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <span>✓</span>
                            <span>Done</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* ─── FULL DAY TOTALS TABLE FOOTER ─── */}
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                <tr>
                  <td className="px-4 py-3.5 text-xs uppercase tracking-wider text-slate-700 font-extrabold" colSpan={2}>
                    Total Summary ({data?.periodLabel || selectedDate})
                  </td>
                  <td className="px-4 py-3.5 text-xs font-extrabold text-slate-900 tabular-nums">
                    {money(pageTotals.collected)}
                    <span className="block text-[10px] font-normal text-slate-500">Total Collected</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-bold text-slate-600">
                    {filteredRecords.filter((r) => r.isReceived || r.status === "COMPLETED").length} of {filteredRecords.length} Received
                  </td>
                  <td className="px-4 py-3.5 text-xs font-extrabold text-emerald-800 tabular-nums">
                    {money(pageTotals.received)}
                    <span className="block text-[10px] font-normal text-emerald-600">Total Received</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-extrabold text-amber-800 tabular-nums" colSpan={2}>
                    {money(pageTotals.pending)}
                    <span className="block text-[10px] font-normal text-amber-600">Outstanding Balance</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ─── CONFIRM PHYSICAL RECEIPT MODAL ─── */}
      {receipt && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cash-receipt-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 id="cash-receipt-title" className="text-base font-bold text-slate-900">
                Confirm Cash Handover to Manager
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setReceipt(null);
                  setError("");
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Confirm that driver <strong>{receipt.rider.name}</strong> ({receipt.rider.phone || "—"}) has physically handed over{" "}
              <strong className="text-emerald-800 text-sm font-extrabold">
                {money(receipt.records.reduce((sum, record) => sum + record.amount, 0))}
              </strong>{" "}
              cash for {receipt.records.length} COD order{receipt.records.length === 1 ? "" : "s"} to the store manager.
            </p>

            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1.5">
              {receipt.records.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs text-slate-700">
                  <span className="font-semibold">Order #{r.orderNumber || r.orderId.slice(-6)}</span>
                  <span className="font-bold text-emerald-800 tabular-nums">{money(r.amount)}</span>
                </div>
              ))}
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setReceipt(null);
                  setError("");
                }}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirm}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
              >
                {saving ? "Confirming…" : "Confirm Cash Received"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}