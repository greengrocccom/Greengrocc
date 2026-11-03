import { useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { useLive } from "../../realtime/useLive";
import FullTimeDriverPanel from "../fulltime/FullTimeDriverPanel";
import PaymentConfigPanel from "./PaymentConfigPanel";

export default function DriverDetailPage() {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateLoading, setDateLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const initialLoadDone = useRef(false);

  // Tab navigation: 'performance' | 'profile' | 'documents' | 'shifts' | 'timeline'
  const activeTab = searchParams.get("tab") || "performance";

  const handleTabChange = (tabKey) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tabKey === "performance") {
          next.delete("tab");
        } else {
          next.set("tab", tabKey);
        }
        return next;
      },
      { replace: false }
    );
  };

  const todayStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayStr);

  const loadDriverDetails = useCallback(
    async ({ silent = false, dateToFetch = selectedDate } = {}) => {
      try {
        if (!silent && !initialLoadDone.current) setLoading(true);
        const res = await managerApi.getDriverDetails(driverId, { date: dateToFetch });
        if (res.data?.success) {
          setData(res.data.data);
          setError("");
          initialLoadDone.current = true;
        } else if (!silent) {
          setError(res.data?.message || "Failed to load driver details");
        }
      } catch (err) {
        if (!silent) {
          setError(err.response?.data?.message || "Error loading driver details");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [driverId, selectedDate]
  );

  useLive(loadDriverDetails, [driverId, selectedDate]);

  const handleDateChange = async (newDate) => {
    if (!newDate || newDate === selectedDate) return;
    setSelectedDate(newDate);
    try {
      setDateLoading(true);
      const res = await managerApi.getDriverDetails(driverId, { date: newDate });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("Error updating date stats:", err);
    } finally {
      setDateLoading(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      setActionLoading(true);
      setActionMessage("");
      const res = await managerApi.toggleRiderActive(driverId);
      if (res.data?.success) {
        setActionMessage(res.data.message || "Driver status updated");
        await loadDriverDetails({ silent: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update driver status");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (_) {
      return "—";
    }
  };

  const formatTimeOnly = (dateVal) => {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (_) {
      return "—";
    }
  };

  const formatDayTitle = (dateStr) => {
    if (!dateStr) return "Today";
    try {
      const d = new Date(`${dateStr}T12:00:00+05:30`);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
    } catch (_) {
      return dateStr;
    }
  };

  const getYesterdayStr = (dateStr) => {
    try {
      const d = new Date(`${dateStr}T12:00:00+05:30`);
      d.setDate(d.getDate() - 1);
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch (_) {
      return "";
    }
  };

  const maskAccountNumber = (accNo) => {
    if (!accNo || typeof accNo !== "string" || accNo.trim().length === 0) {
      return "Not provided";
    }
    const clean = accNo.trim();
    if (clean.length <= 4) return clean;
    const lastFour = clean.slice(-4);
    return `XXXX XXXX ${lastFour}`;
  };

  if (loading) {
    return (
      <PageShell>
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-40 bg-slate-200 rounded-md" />
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-20 bg-slate-100 rounded-xl" />
          </div>
          <div className="h-56 bg-slate-100 rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center max-w-lg mx-auto my-8">
          <h3 className="text-sm font-bold text-rose-800">
            {error || "Driver Not Found"}
          </h3>
          <p className="mt-1 text-xs text-rose-600">
            Could not retrieve details for driver ID: {driverId}
          </p>
          <button
            onClick={() => navigate("/drivers")}
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            Back to Drivers List
          </button>
        </div>
      </PageShell>
    );
  }

  const {
    driver = {},
    datePerformance = {},
    wallet = {},
    documents = {},
    selfie = {},
    bankDetails = {},
    todayShifts = [],
    recentShifts = [],
  } = data;

  const isOnline = driver.status === "online";
  const isOnDelivery = driver.status === "on_delivery";
  const isApproved = (driver.verificationStatus || "approved") === "approved";
  const isPending = driver.verificationStatus === "pending";
  const isRejected = driver.verificationStatus === "rejected";
  const isSelectedToday = selectedDate === todayStr;

  const docList = [
    { key: "aadhaar", label: "Aadhaar Card", meta: documents.aadhaar },
    { key: "pan", label: "PAN Card", meta: documents.pan },
    { key: "passport", label: "Passport", meta: documents.passport },
    { key: "license", label: "Driving License", meta: documents.license },
    { key: "rc", label: "Vehicle RC", meta: documents.rc },
    { key: "insurance", label: "Vehicle Insurance", meta: documents.insurance },
    { key: "policeVerification", label: "Police Verification", meta: documents.policeVerification },
    { key: "selfie", label: "Selfie Capture", meta: selfie },
  ];

  const hasLocation =
    driver.currentLocation?.lat != null && driver.currentLocation?.lng != null;

  const perf = datePerformance || {};
  const ordersList = perf.orders || [];
  const comp = perf.comparison || {
    prevDate: getYesterdayStr(selectedDate),
    current: {
      delivered: perf.deliveredCount || 0,
      earnings: perf.totalEarnings || 0,
      onlineMins: perf.onlineMinutes || 0,
      onTimeRate: perf.onTimeRate || 100,
    },
    previous: {
      delivered: 0,
      earnings: 0,
      onlineMins: 0,
      onTimeRate: 100,
    },
  };

  const calcDelta = (curr, prev) => {
    if (!prev || prev === 0) {
      return curr > 0 ? { text: "+100%", isPositive: true } : { text: "0%", isPositive: true };
    }
    const diff = Math.round(((curr - prev) / prev) * 100);
    return {
      text: diff >= 0 ? `+${diff}%` : `${diff}%`,
      isPositive: diff >= 0,
    };
  };

  const deliveredDelta = calcDelta(comp.current?.delivered || 0, comp.previous?.delivered || 0);
  const earningsDelta = calcDelta(comp.current?.earnings || 0, comp.previous?.earnings || 0);
  const onlineMinsDelta = calcDelta(comp.current?.onlineMins || 0, comp.previous?.onlineMins || 0);

  const ratingVal = Number(perf.rating || driver.rating || 4.9);
  const ratingsCount = perf.totalRatingsCount || driver.totalRatingsCount || 12;

  const displayId = driver.id || driver._id || driverId || "";
  const shortId = displayId ? String(displayId).slice(-6).toUpperCase() : "";

  return (
    <PageShell>
      {/* Alert Banner */}
      {actionMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 flex items-center justify-between mb-4">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage("")}
            className="text-emerald-700 hover:text-emerald-900 text-xs ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/drivers")}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition mb-2 inline-block"
            >
              ← Back to Drivers List
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center">
                {(driver.name || "D")[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-snug">
                  {driver.name || "Delivery Partner"}{" "}
                  {shortId && (
                    <span className="text-xs font-normal text-slate-400 font-mono">
                      (ID: #{shortId})
                    </span>
                  )}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>Phone: <strong className="text-slate-700 font-medium">{driver.phone || "—"}</strong></span>
                  <span>•</span>
                  <span>Vehicle: <strong className="text-slate-700 font-medium capitalize">{driver.vehicleType || "Motorcycle"}</strong></span>
                  <span>•</span>
                  <span>Hub: <strong className="text-slate-700 font-medium">{driver.area || driver.city || "Main Store"}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                isOnDelivery
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : isOnline
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {isOnDelivery ? "On Delivery" : isOnline ? "Online" : "Offline"}
            </span>

            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border capitalize ${
                isApproved
                  ? "bg-sky-50 text-sky-700 border-sky-200"
                  : isPending
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : isRejected
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {driver.verificationStatus || "Approved"}
            </span>

            <button
              onClick={() => loadDriverDetails({ dateToFetch: selectedDate })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Refresh
            </button>

            <button
              onClick={handleToggleActive}
              disabled={actionLoading}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white transition active:scale-95 ${
                driver.isActive !== false
                  ? "bg-slate-800 hover:bg-slate-900"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {actionLoading
                ? "Updating…"
                : driver.isActive !== false
                ? "Deactivate Driver"
                : "Activate Driver"}
            </button>
          </div>
        </div>

        {/* Clean Navigation Tabs */}
        <div className="flex border-b border-slate-200 mt-5 -mb-2 gap-6 text-xs font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabChange("performance")}
            className={`pb-2.5 px-0.5 border-b-2 transition whitespace-nowrap ${
              activeTab === "performance"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Performance Overview
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("profile")}
            className={`pb-2.5 px-0.5 border-b-2 transition whitespace-nowrap ${
              activeTab === "profile"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Driver Profile & Bank
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("documents")}
            className={`pb-2.5 px-0.5 border-b-2 transition whitespace-nowrap ${
              activeTab === "documents"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            KYC Documents ({docList.filter((d) => d.meta?.verificationStatus === "verified" || d.meta?.status === "verified").length}/{docList.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("shifts")}
            className={`pb-2.5 px-0.5 border-b-2 transition whitespace-nowrap ${
              activeTab === "shifts"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Shift Bookings ({recentShifts.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("timeline")}
            className={`pb-2.5 px-0.5 border-b-2 transition whitespace-nowrap ${
              activeTab === "timeline"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Live Timeline
          </button>
        </div>
      </div>

      {/* TAB 1: DATE-WISE PERFORMANCE OVERVIEW */}
      {activeTab === "performance" && (
        <div className="space-y-4">
          {/* Top Date Filter Bar */}
          <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date:
                </span>

                <input
                  type="date"
                  max={todayStr}
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition"
                />

                <button
                  type="button"
                  onClick={() => handleDateChange(todayStr)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
                    isSelectedToday
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => handleDateChange(getYesterdayStr(todayStr))}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
                    selectedDate === getYesterdayStr(todayStr)
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Yesterday
                </button>
              </div>

              <div className="flex items-center gap-2">
                {dateLoading && (
                  <span className="text-xs text-emerald-700 font-medium">
                    Loading stats…
                  </span>
                )}
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800">
                    {formatDayTitle(selectedDate)}
                  </span>
                  {isSelectedToday ? (
                    <span className="ml-2 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      LIVE
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-medium">
                      Historical
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 1: Attendance, Online/Offline Time & Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Attendance Status */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Attendance
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    perf.attendance === "Present"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {perf.attendance || "Absent"}
                </span>
              </div>
              <div className="mt-1.5">
                <p className="text-lg font-bold text-slate-900">
                  {perf.attendance === "Present" ? "On Duty" : "Off Duty"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {perf.shiftsBooked || 0} shift booked • {perf.shiftsCompleted || 0} completed
                </p>
              </div>
            </div>

            {/* Online Time */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Online Time
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Active</span>
              </div>
              <div className="mt-1.5">
                <p className="text-lg font-bold text-emerald-700">
                  {perf.onlineTime || "0m"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Logged on duty ({perf.onlineMinutes || 0} mins)
                </p>
              </div>
            </div>

            {/* Offline Time */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Offline Time
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Rest</span>
              </div>
              <div className="mt-1.5">
                <p className="text-lg font-bold text-slate-700">
                  {perf.offlineTime || "24h 0m"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Non-working hours
                </p>
              </div>
            </div>

            {/* Driver Rating */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Driver Rating
                </span>
                <span className="text-[10px] font-bold text-amber-700">
                  {ratingVal.toFixed(1)} / 5.0
                </span>
              </div>
              <div className="mt-1.5">
                <p className="text-lg font-bold text-amber-700">
                  {ratingVal.toFixed(1)} <span className="text-xs font-normal text-slate-500">out of 5.0</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {ratingsCount} verified reviews
                </p>
              </div>
            </div>
          </div>

          {/* Row 2: Orders Performance Breakdown (6 Cards) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Order Fulfillment
              </h2>
              <span className="text-xs text-slate-500">
                Total Assigned: <strong className="text-slate-800">{perf.totalAssigned || 0}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Assigned
                </p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">
                  {perf.totalAssigned || 0}
                </p>
                <span className="text-[11px] text-slate-500">Total routed</span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Delivered
                </p>
                <p className="text-lg font-bold text-emerald-700 mt-0.5">
                  {perf.deliveredCount || 0}
                </p>
                <span className="text-[11px] text-emerald-700/80">Completed</span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                  Cancelled / Failed
                </p>
                <p className="text-lg font-bold text-rose-700 mt-0.5">
                  {perf.cancelledCount || 0}
                </p>
                <span className="text-[11px] text-rose-700/80">Not delivered</span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                  Accepted
                </p>
                <p className="text-lg font-bold text-sky-800 mt-0.5">
                  {perf.acceptedCount || 0}
                </p>
                <span className="text-[11px] text-sky-700/80">Accepted</span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Rejected / Skipped
                </p>
                <p className="text-lg font-bold text-slate-700 mt-0.5">
                  {perf.rejectedCount || 0}
                </p>
                <span className="text-[11px] text-slate-500">Declined</span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  On-Time Rate
                </p>
                <p className="text-lg font-bold text-amber-800 mt-0.5">
                  {perf.onTimeRate ?? 100}%
                </p>
                <span className="text-[11px] text-amber-700/80">
                  {perf.delayedCount || 0} delays
                </span>
              </div>
            </div>
          </div>

          {/* Row 3: Financial & Commission Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Total Commission
              </span>
              <p className="text-lg font-bold text-emerald-700 mt-1">
                ₹{perf.totalEarnings || 0}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Earnings for {formatDayTitle(selectedDate)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Distance Traveled
              </span>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {perf.totalKm || 0} <span className="text-xs font-normal text-slate-500">km</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculated as Distance × Rate
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Cash Collected (COD)
              </span>
              <p className="text-lg font-bold text-slate-800 mt-1">
                ₹{perf.cashCollectedToday || 0}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Collected from customers on {selectedDate}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Cash Pending Settlement
              </span>
              <p className="text-lg font-bold text-amber-800 mt-1">
                ₹{perf.pendingCashToCollect || 0}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Due to be handed to store manager
              </p>
            </div>
          </div>

          {/* Row 4: Day-over-Day Comparison */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Performance vs Previous Day
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparing {selectedDate} with {comp.prevDate || "yesterday"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Delivered Orders</span>
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
                      deliveredDelta.isPositive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {deliveredDelta.text}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between text-xs">
                  <span>Current: <strong className="text-slate-900 font-bold">{comp.current?.delivered || 0}</strong></span>
                  <span className="text-slate-500">Prev: {comp.previous?.delivered || 0}</span>
                </div>
                <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          10,
                          ((comp.current?.delivered || 0) /
                            Math.max(1, (comp.current?.delivered || 0) + (comp.previous?.delivered || 0))) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Earnings</span>
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
                      earningsDelta.isPositive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {earningsDelta.text}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between text-xs">
                  <span>Current: <strong className="text-emerald-700 font-bold">₹{comp.current?.earnings || 0}</strong></span>
                  <span className="text-slate-500">Prev: ₹{comp.previous?.earnings || 0}</span>
                </div>
                <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          10,
                          ((comp.current?.earnings || 0) /
                            Math.max(1, (comp.current?.earnings || 0) + (comp.previous?.earnings || 0))) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Online Hours</span>
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
                      onlineMinsDelta.isPositive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {onlineMinsDelta.text}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between text-xs">
                  <span>Current: <strong className="text-slate-900 font-bold">{Math.round((comp.current?.onlineMins || 0) / 60 * 10) / 10}h</strong></span>
                  <span className="text-slate-500">Prev: {Math.round((comp.previous?.onlineMins || 0) / 60 * 10) / 10}h</span>
                </div>
                <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-700 h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          10,
                          ((comp.current?.onlineMins || 0) /
                            Math.max(1, (comp.current?.onlineMins || 0) + (comp.previous?.onlineMins || 0))) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">On-Time %</span>
                  <span className="text-[11px] font-semibold text-slate-500">Target: 95%</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between text-xs">
                  <span>Current: <strong className="text-amber-800 font-bold">{comp.current?.onTimeRate ?? 100}%</strong></span>
                  <span className="text-slate-500">Prev: {comp.previous?.onTimeRate ?? 95}%</span>
                </div>
                <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full"
                    style={{ width: `${comp.current?.onTimeRate ?? 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 5: Orders on Selected Date Table */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Orders Handled on {selectedDate}
                </h3>
                <p className="text-xs text-slate-500">
                  {ordersList.length} total orders recorded for this date
                </p>
              </div>

              {ordersList.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 font-medium">
                    {ordersList.filter((o) => o.status === "delivered").length} Delivered
                  </span>
                  <span className="rounded bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 font-medium">
                    ₹{ordersList.reduce((sum, o) => sum + (Number(o.earning) || 0), 0)} Total Payout
                  </span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Order #</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Customer & Area</th>
                    <th className="py-2.5 px-3">Distance</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3">Commission</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ordersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 font-normal">
                        No orders recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    ordersList.map((ord, idx) => (
                      <tr key={ord.id || idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          #{ord.orderNumber || (ord.id ? ord.id.slice(-6).toUpperCase() : `ORD-${idx + 1}`)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {formatTimeOnly(ord.deliveredAt || ord.assignedAt || ord.createdAt)}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-slate-800">{ord.customerName || "Customer"}</p>
                          <p className="text-[11px] text-slate-500 truncate max-w-xs">{ord.customerAddress || "Store order"}</p>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {ord.distanceKm ? `${Number(ord.distanceKm).toFixed(1)} km` : "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              String(ord.paymentMode).toLowerCase() === "cod" || String(ord.paymentMode).toLowerCase() === "cash"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {ord.paymentMode || "Online"} (₹{ord.amount || 0})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-700">
                          ₹{ord.earning || 0}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold border ${
                              ord.status === "delivered"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : ord.status === "cancelled" || ord.status === "delivery_failed"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-sky-50 text-sky-700 border-sky-200"
                            }`}
                          >
                            {ord.status || "Assigned"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DRIVER PROFILE, WALLET & BANK */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          <PaymentConfigPanel
            driver={driver}
            onSaved={() => loadDriverDetails({ silent: true, dateToFetch: selectedDate })}
          />
          <FullTimeDriverPanel
            driverId={driverId}
            employmentType={driver.employmentType || "PART_TIME"}
            onChanged={() => loadDriverDetails({ silent: true, dateToFetch: selectedDate })}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Driver Profile & Wallet
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between gap-3">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-semibold text-slate-900">{driver.name || "—"}</span>
                </div>
                <div className="py-2 flex justify-between gap-3">
                  <span className="text-slate-500">Phone Number</span>
                  <span className="font-semibold text-slate-900">{driver.phone || "—"}</span>
                </div>
                <div className="py-2 flex justify-between gap-3">
                  <span className="text-slate-500">Vehicle</span>
                  <span className="font-semibold text-slate-900 capitalize">{driver.vehicleType || "—"}</span>
                </div>
                <div className="py-2 flex justify-between gap-3">
                  <span className="text-slate-500">Assigned Hub</span>
                  <span className="font-semibold text-slate-900">{driver.area || driver.city || "—"}</span>
                </div>
                <div className="py-2 flex justify-between gap-3">
                  <span className="text-slate-500">Current Wallet Balance</span>
                  <span className="font-bold text-emerald-700">₹{wallet.balance || 0}</span>
                </div>
                <div className="py-2 flex justify-between gap-3">
                  <span className="text-slate-500">Lifetime Earnings</span>
                  <span className="font-semibold text-slate-900">₹{wallet.lifetimeEarnings || 0}</span>
                </div>
                <div className="py-2 flex justify-between gap-3">
                  <span className="text-slate-500">Account Active</span>
                  <span className="font-semibold text-slate-900">{driver.isActive !== false ? "Yes" : "No"}</span>
                </div>
                <div className="py-2 flex justify-between gap-3">
                  <span className="text-slate-500">Registered On</span>
                  <span className="text-slate-700">{formatDate(driver.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Location & Bank Information
                </h2>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2 flex justify-between gap-3">
                    <span className="text-slate-500">GPS Coordinates</span>
                    <span className="font-mono text-slate-700">
                      {hasLocation
                        ? `${Number(driver.currentLocation.lat).toFixed(5)}, ${Number(driver.currentLocation.lng).toFixed(5)}`
                        : "Not available"}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between gap-3">
                    <span className="text-slate-500">Bank Name</span>
                    <span className="font-semibold text-slate-900">{bankDetails.bankName || "Not provided"}</span>
                  </div>
                  <div className="py-2 flex justify-between gap-3">
                    <span className="text-slate-500">Account Holder</span>
                    <span className="font-semibold text-slate-900">{bankDetails.accountHolderName || "Not provided"}</span>
                  </div>
                  <div className="py-2 flex justify-between gap-3">
                    <span className="text-slate-500">Account Number</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {maskAccountNumber(bankDetails.accountNumber)}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between gap-3">
                    <span className="text-slate-500">IFSC Code</span>
                    <span className="font-mono font-semibold text-slate-800">{bankDetails.ifsc || "—"}</span>
                  </div>
                </div>
              </div>

              {todayShifts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">Today's Assigned Slots</h3>
                  <div className="space-y-1.5">
                    {todayShifts.map((s, i) => (
                      <div
                        key={i}
                        className="rounded border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs flex justify-between items-center"
                      >
                        <span className="font-medium text-slate-800">{s.shiftName || s.shiftType}</span>
                        <span className="font-mono text-slate-600">{s.startTime} – {s.endTime}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KYC DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            KYC Verification Documents
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Document</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docList.map((doc) => {
                  const status = doc.meta?.verificationStatus || doc.meta?.status || "missing";
                  const url = doc.meta?.url || doc.meta?.imageUrl || doc.meta?.imageBase64;
                  return (
                    <tr key={doc.key} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-medium text-slate-800">{doc.label}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            status === "verified"
                              ? "bg-emerald-100 text-emerald-800"
                              : status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {url ? (
                          <a
                            href={
                              String(url).startsWith("data:") || String(url).startsWith("http")
                                ? url
                                : `data:image/jpeg;base64,${url}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                          >
                            View Document ↗
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SHIFT BOOKINGS */}
      {activeTab === "shifts" && (
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Shift Bookings History
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Shift Name</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Time Slot</th>
                  <th className="py-2.5 px-3">Booking Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentShifts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-normal">
                      No shift bookings recorded for this delivery partner.
                    </td>
                  </tr>
                ) : (
                  recentShifts.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{s.shiftName || s.shiftType}</td>
                      <td className="py-2.5 px-3 text-slate-600">{s.dateString}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {s.startTime} - {s.endTime}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold border ${
                            s.bookingStatus === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : s.bookingStatus === "ACTIVE"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : s.bookingStatus === "CANCELLED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {s.bookingStatus || "UPCOMING"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: LIVE TIMELINE */}
      {activeTab === "timeline" && (
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Live Activity Timeline
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Current Status</span>
              <span className="font-semibold text-slate-900 capitalize">{driver.status || "offline"}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Last Status Change</span>
              <span className="text-slate-700">{formatDate(driver.lastStatusAt)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Last Online At</span>
              <span className="text-slate-700">{formatDate(driver.lastOnlineAt)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Last Offline At</span>
              <span className="text-slate-700">{formatDate(driver.lastOfflineAt)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Last Seen At</span>
              <span className="text-slate-700">{formatDate(driver.lastSeenAt)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Last Order Assigned At</span>
              <span className="text-slate-700">{formatDate(driver.lastOrderAssignedAt)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Active Order ID</span>
              <span className="font-mono font-semibold text-slate-800">
                {driver.activeOrderId ? `ORD_${driver.activeOrderId}` : "No active order"}
              </span>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
