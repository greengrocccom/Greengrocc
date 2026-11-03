import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../../components/layout/ManagerLayout";
import { managerApi } from "../../api/managerApi";
import { apiError, formatDays, formatMinutes } from "../fulltime/fullTimeUi";

export const SHIFT_PALETTE = {
  early_morning: {
    key: "early_morning",
    label: "Early Morning",
    hex: "#F6DCC5",
    isDark: false,
    textClass: "text-slate-900",
    subtextClass: "text-slate-600",
    borderClass: "border-l-4 border-l-[#d4aa8c]",
    dotClass: "bg-[#b8825e]",
  },
  morning: {
    key: "morning",
    label: "Morning",
    hex: "#DCEEFF",
    isDark: false,
    textClass: "text-slate-900",
    subtextClass: "text-slate-600",
    borderClass: "border-l-4 border-l-[#9bc2e8]",
    dotClass: "bg-[#6ba0d6]",
  },
  afternoon: {
    key: "afternoon",
    label: "Afternoon",
    hex: "#FFF0C2",
    isDark: false,
    textClass: "text-slate-900",
    subtextClass: "text-slate-600",
    borderClass: "border-l-4 border-l-[#ebd07a]",
    dotClass: "bg-[#d6af38]",
  },
  evening: {
    key: "evening",
    label: "Evening",
    hex: "#F4DCEC",
    isDark: false,
    textClass: "text-slate-900",
    subtextClass: "text-slate-600",
    borderClass: "border-l-4 border-l-[#d6a9c8]",
    dotClass: "bg-[#b876a3]",
  },
  night: {
    key: "night",
    label: "Night",
    hex: "#202B4A",
    isDark: true,
    textClass: "text-white",
    subtextClass: "text-slate-200",
    borderClass: "border-l-4 border-l-[#415383]",
    dotClass: "bg-[#6c85c2]",
  },
  late_night: {
    key: "late_night",
    label: "Late Night",
    hex: "#17172F",
    isDark: true,
    textClass: "text-white",
    subtextClass: "text-slate-200",
    borderClass: "border-l-4 border-l-[#444473]",
    dotClass: "bg-[#6e6ea3]",
  },
  expired: {
    key: "expired",
    label: "Expired",
    hex: "#E2E8F0",
    isDark: false,
    textClass: "text-slate-700",
    subtextClass: "text-slate-500",
    borderClass: "border-l-4 border-l-slate-400",
    dotClass: "bg-slate-400",
  },
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const match = String(timeStr).match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const getShiftTypeTheme = (shift) => {
  const nameStr = (shift?.name || "").toLowerCase();
  const startMin = parseTimeToMinutes(shift?.startTime);

  if (nameStr.includes("late night") || (startMin >= 0 && startMin < 300)) {
    return SHIFT_PALETTE.late_night;
  }
  if (nameStr.includes("early morning") || (startMin >= 300 && startMin < 540)) {
    return SHIFT_PALETTE.early_morning;
  }
  if (nameStr.includes("morning") || (startMin >= 540 && startMin < 780)) {
    return SHIFT_PALETTE.morning;
  }
  if (nameStr.includes("afternoon") || (startMin >= 780 && startMin < 1020)) {
    return SHIFT_PALETTE.afternoon;
  }
  if (nameStr.includes("evening") || (startMin >= 1020 && startMin < 1260)) {
    return SHIFT_PALETTE.evening;
  }
  if (nameStr.includes("night") || startMin >= 1260) {
    return SHIFT_PALETTE.night;
  }
  return SHIFT_PALETTE.morning;
};

const getFullTimeShiftCategory = (shift) => {
  if (shift?.status === "inactive" || shift?.isActive === false) return "expired";
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const istTime = now.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false });
  const [h, m] = istTime.split(":").map(Number);
  const currentMins = h * 60 + m;
  const startMins = parseTimeToMinutes(shift?.startTime);
  let endMins = parseTimeToMinutes(shift?.endTime);
  if (endMins <= startMins) endMins += 24 * 60; // Overnight shift
  const startDate = shift?.scheduleStartDate || "0000-01-01";
  const endDate = shift?.scheduleEndDate || "9999-12-31";
  const excluded = new Set(shift?.excludedDates || []);
  const activeDays = shift?.workingDays?.length ? shift.workingDays : [0, 1, 2, 3, 4, 5, 6];
  const isScheduled = (date) => date >= startDate && date <= endDate && !excluded.has(date) && activeDays.includes(new Date(`${date}T12:00:00`).getDay());
  if (isScheduled(today)) {
    let adjustedCur = currentMins;
    if (currentMins < startMins && endMins > 24 * 60) adjustedCur += 24 * 60;
    if (adjustedCur >= startMins && adjustedCur < endMins) return "active";
    if (adjustedCur < startMins) return "upcoming";
  }
  const cursor = new Date(`${today}T12:00:00`);
  for (let i = 0; i < 370; i += 1) {
    cursor.setDate(cursor.getDate() + 1);
    const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (date > endDate) break;
    if (isScheduled(date)) return "upcoming";
  }
  return "expired";
};

const scheduleLabel = (shift) => {
  const mode = shift?.scheduleMode || "full_week";
  const days = formatDays(shift?.workingDays);
  if (mode === "single_day") return `One day · ${shift.scheduleStartDate || "Date not set"}`;
  const range = shift.scheduleStartDate && shift.scheduleEndDate ? `${shift.scheduleStartDate} – ${shift.scheduleEndDate}` : "Repeats weekly";
  const skipped = (shift?.excludedDates || []).length ? ` · Skip ${(shift.excludedDates || []).join(", ")}` : "";
  return `${mode === "full_month" ? "Month" : "Week"} · ${range} · ${days}${skipped}`;
};

export default function FullTimeShiftManagementPage() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await managerApi.getFullTimeShifts();
      setShifts(res.data.shifts || []);
    } catch (err) {
      setError(apiError(err, "Failed to load Full-Time shifts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (shift) => {
    if (!window.confirm(`Remove Full-Time shift "${shift.name}"?`)) return;
    try {
      await managerApi.deleteFullTimeShift(shift.id);
      load();
    } catch (err) {
      setError(apiError(err, "Failed to remove shift"));
    }
  };

  const activeCount = useMemo(
    () => shifts.filter((s) => getFullTimeShiftCategory(s) === "active").length,
    [shifts]
  );
  const upcomingCount = useMemo(
    () => shifts.filter((s) => getFullTimeShiftCategory(s) === "upcoming").length,
    [shifts]
  );
  const expiredCount = useMemo(
    () => shifts.filter((s) => getFullTimeShiftCategory(s) === "expired").length,
    [shifts]
  );

  const shiftTypeCounts = useMemo(
    () => ({
      early_morning: shifts.filter((s) => getShiftTypeTheme(s).key === "early_morning").length,
      morning: shifts.filter((s) => getShiftTypeTheme(s).key === "morning").length,
      afternoon: shifts.filter((s) => getShiftTypeTheme(s).key === "afternoon").length,
      evening: shifts.filter((s) => getShiftTypeTheme(s).key === "evening").length,
      night: shifts.filter((s) => getShiftTypeTheme(s).key === "night").length,
      late_night: shifts.filter((s) => getShiftTypeTheme(s).key === "late_night").length,
    }),
    [shifts]
  );

  const availableShiftTypes = useMemo(
    () =>
      [
        {
          key: "early_morning",
          label: "Early Morning",
          count: shiftTypeCounts.early_morning,
          dot: "bg-[#b8825e]",
          hex: "#F6DCC5",
          isDark: false,
        },
        {
          key: "morning",
          label: "Morning",
          count: shiftTypeCounts.morning,
          dot: "bg-[#6ba0d6]",
          hex: "#DCEEFF",
          isDark: false,
        },
        {
          key: "afternoon",
          label: "Afternoon",
          count: shiftTypeCounts.afternoon,
          dot: "bg-[#d6af38]",
          hex: "#FFF0C2",
          isDark: false,
        },
        {
          key: "evening",
          label: "Evening",
          count: shiftTypeCounts.evening,
          dot: "bg-[#b876a3]",
          hex: "#F4DCEC",
          isDark: false,
        },
        {
          key: "night",
          label: "Night",
          count: shiftTypeCounts.night,
          dot: "bg-[#6c85c2]",
          hex: "#202B4A",
          isDark: true,
        },
        {
          key: "late_night",
          label: "Late Night",
          count: shiftTypeCounts.late_night,
          dot: "bg-[#6e6ea3]",
          hex: "#17172F",
          isDark: true,
        },
      ].filter((t) => t.count > 0),
    [shiftTypeCounts]
  );

  const filteredShifts = useMemo(() => {
    return shifts
      .filter((s) => {
        const cat = getFullTimeShiftCategory(s);
        const theme = getShiftTypeTheme(s);

        if (activeFilterTab === "active") return cat === "active";
        if (activeFilterTab === "upcoming") return cat === "upcoming";
        if (activeFilterTab === "expired") return cat === "expired";
        if (activeFilterTab !== "all") {
          return theme.key === activeFilterTab;
        }
        return true;
      })
      .filter((s) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          (s.name || "").toLowerCase().includes(q) ||
          (s.startTime || "").toLowerCase().includes(q) ||
          (s.endTime || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const catA = getFullTimeShiftCategory(a);
        const catB = getFullTimeShiftCategory(b);
        const order = { active: 1, upcoming: 2, expired: 3 };
        const diff = (order[catA] || 2) - (order[catB] || 2);
        if (diff !== 0) return diff;
        return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
      });
  }, [shifts, activeFilterTab, searchQuery]);

  return (
    <PageShell title="Full-Time Shifts">
      {/* Top Navigation Tabs */}
      <div className="flex border-b border-slate-200 -mt-2 mb-4 gap-6 text-xs font-medium text-slate-600 overflow-x-auto">
        <Link
          to="/shifts"
          className="pb-2.5 px-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition whitespace-nowrap"
        >
          Part-Time Shifts
        </Link>
        <Link
          to="/shifts/fulltime"
          className="pb-2.5 px-0.5 border-b-2 border-emerald-600 text-emerald-700 font-bold transition whitespace-nowrap"
        >
          Full-Time Shifts
        </Link>
        <Link
          to="/fulltime/rules"
          className="pb-2.5 px-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition whitespace-nowrap"
        >
          Full-Time Rules
        </Link>
        <Link
          to="/fulltime/assign-orders"
          className="pb-2.5 px-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition whitespace-nowrap"
        >
          Assign Orders
        </Link>
      </div>

      {/* STATUS DOTS SUMMARY & ADD SHIFT BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white p-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Active status button (Red blinking pulse animation) */}
          <button
            type="button"
            onClick={() => setActiveFilterTab(activeFilterTab === "active" ? "all" : "active")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${
              activeFilterTab === "active"
                ? "border-red-600 bg-red-50 text-red-900 ring-1 ring-red-500/20"
                : "border-slate-200/80 bg-slate-50/60 text-slate-700 hover:border-red-300 hover:bg-red-50/30"
            }`}
            title="Filter by Active Shifts"
          >
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            <span className="font-bold text-red-600">Active</span>
            <span className="rounded-md bg-red-100 px-1.5 py-0.2 text-[11px] font-bold text-red-900">
              {activeCount}
            </span>
          </button>

          {/* Upcoming status button (Black loading animation 3 dots) */}
          <button
            type="button"
            onClick={() => setActiveFilterTab(activeFilterTab === "upcoming" ? "all" : "upcoming")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${
              activeFilterTab === "upcoming"
                ? "border-slate-800 bg-slate-100 text-slate-900 ring-1 ring-slate-800/20"
                : "border-slate-200/80 bg-slate-50/60 text-slate-700 hover:border-slate-400 hover:bg-slate-100/50"
            }`}
            title="Filter by Upcoming Shifts"
          >
            <span className="inline-flex items-center gap-1 py-0.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-black animate-bounce"
                style={{ animationDuration: "1s", animationDelay: "0ms" }}
              />
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-black animate-bounce"
                style={{ animationDuration: "1s", animationDelay: "200ms" }}
              />
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-black animate-bounce"
                style={{ animationDuration: "1s", animationDelay: "400ms" }}
              />
            </span>
            <span>Upcoming</span>
            <span className="rounded-md bg-slate-200 px-1.5 py-0.2 text-[11px] font-bold text-slate-900">
              {upcomingCount}
            </span>
          </button>

          {/* Expired status button (Grey dot) */}
          <button
            type="button"
            onClick={() => setActiveFilterTab(activeFilterTab === "expired" ? "all" : "expired")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${
              activeFilterTab === "expired"
                ? "border-slate-400 bg-slate-200 text-slate-900 ring-1 ring-slate-400/30"
                : "border-slate-200/80 bg-slate-100/90 text-slate-700 hover:border-slate-300 hover:bg-slate-200/60"
            }`}
            title="Filter by Expired Shifts"
          >
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span>Expired</span>
            <span className="rounded-md bg-slate-200 px-1.5 py-0.2 text-[11px] font-bold text-slate-800">
              {expiredCount}
            </span>
          </button>
        </div>

        <Link
          to="/shifts/fulltime/create"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#064e3b] bg-[#064e3b] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#053d2e] transition cursor-pointer shrink-0"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Shift</span>
        </Link>
      </div>

      {/* FILTER TABS & SEARCH ROW */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pt-1 mb-4">
        {/* Shift Type Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilterTab("all")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer border ${
              activeFilterTab === "all"
                ? "bg-[#064e3b] text-white border-[#064e3b] shadow-xs"
                : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200/80"
            }`}
          >
            <span>All Shifts</span>
            <span
              className={`rounded px-1.5 py-0.2 text-[10px] ${
                activeFilterTab === "all" ? "bg-white/20 text-white font-bold" : "bg-slate-200 text-slate-700 font-semibold"
              }`}
            >
              {shifts.length}
            </span>
          </button>

          {availableShiftTypes.map((type) => {
            const isSelected = activeFilterTab === type.key;
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => setActiveFilterTab(isSelected ? "all" : type.key)}
                style={{ backgroundColor: type.hex, color: type.isDark ? "#FFFFFF" : "#0f172a" }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
                  isSelected
                    ? "ring-2 ring-emerald-600 border-emerald-700 shadow-sm"
                    : "border-black/10 hover:opacity-90"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${type.dot}`} />
                <span>{type.label}</span>
                <span
                  className={`rounded px-1.5 py-0.2 text-[10px] ${
                    type.isDark ? "bg-white/20 text-white font-bold" : "bg-black/10 text-slate-900 font-bold"
                  }`}
                >
                  {type.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex items-center min-w-[180px] sm:w-56">
          <svg className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search full-time shifts..."
            className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-white pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 mb-4">
          {error}
        </div>
      )}

      {/* FULL-TIME SHIFTS TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-400">Loading Full-Time shifts…</div>
        ) : filteredShifts.length === 0 ? (
          <div className="space-y-2 py-16 text-center text-slate-500">
            <p className="text-2xl">📅</p>
            <p className="text-sm font-bold text-slate-700">No Full-Time shifts found.</p>
            <p className="text-xs text-slate-400">Click “+ Create Full-Time Shift” to add one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8fafc] border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5 whitespace-nowrap">SHIFT</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">TIMING</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">SCHEDULE</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">STATUS</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">RULES</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">RIDER PAY</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">DRIVERS</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShifts.map((s) => {
                  const cat = getFullTimeShiftCategory(s);
                  const isExpired = cat === "expired";
                  const theme = isExpired ? SHIFT_PALETTE.expired : getShiftTypeTheme(s);
                  const isDark = !isExpired && theme.isDark;

                  return (
                    <tr
                      key={s.id}
                      style={{ backgroundColor: isExpired ? "#E2E8F0" : theme.hex }}
                      className={`${theme.borderClass} ${
                        isDark ? "text-white" : isExpired ? "text-slate-700" : "text-slate-900"
                      } transition border-b border-black/10`}
                    >
                      {/* SHIFT */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className={`font-bold text-xs sm:text-sm ${isDark ? "text-white" : isExpired ? "text-slate-600" : "text-slate-900"}`}>
                          {s.name}
                        </div>
                        {s.notes && (
                          <div className={`text-[11px] ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            {s.notes}
                          </div>
                        )}
                      </td>

                      {/* TIMING */}
                      <td className={`px-5 py-4 font-bold text-xs whitespace-nowrap ${isDark ? "text-white" : isExpired ? "text-slate-700" : "text-slate-900"}`}>
                        {s.startTime} – {s.endTime}
                      </td>

                      {/* WORKING DAYS */}
                      <td className={`px-5 py-4 text-xs font-semibold whitespace-nowrap ${isDark ? "text-slate-200" : isExpired ? "text-slate-600" : "text-slate-700"}`}>
                        {scheduleLabel(s)}
                      </td>

                      {/* STATUS (PULSE RED FOR ACTIVE, 3 BLACK LOADING DOTS FOR UPCOMING, GREY FOR EXPIRED) */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {cat === "active" && (
                          <span className="inline-flex items-center gap-2 text-xs font-bold">
                            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                            </span>
                            <span className="text-red-600 font-extrabold">Active</span>
                          </span>
                        )}
                        {cat === "upcoming" && (
                          <span className="inline-flex items-center gap-2 text-xs font-bold">
                            <span className="inline-flex items-center gap-1 py-0.5">
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full bg-black animate-bounce ${isDark ? "ring-1 ring-white/70" : ""}`}
                                style={{ animationDuration: "1s", animationDelay: "0ms" }}
                              />
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full bg-black animate-bounce ${isDark ? "ring-1 ring-white/70" : ""}`}
                                style={{ animationDuration: "1s", animationDelay: "200ms" }}
                              />
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full bg-black animate-bounce ${isDark ? "ring-1 ring-white/70" : ""}`}
                                style={{ animationDuration: "1s", animationDelay: "400ms" }}
                              />
                            </span>
                            <span className={isDark ? "text-slate-200" : "text-slate-900"}>Upcoming</span>
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            <span>Expired</span>
                          </span>
                        )}
                      </td>

                      {/* RULES */}
                      <td className={`px-5 py-4 text-xs ${isDark ? "text-slate-200" : "text-slate-600"}`}>
                        <Link to="/fulltime/rules" className="font-semibold text-emerald-700 hover:underline">Managed in Full-Time Rules</Link>
                      </td>

                      {/* RIDER PAY */}
                      <td className={`px-5 py-4 text-xs ${isDark ? "text-slate-200" : "text-slate-600"}`}>
                        <span className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-600"}`}>Set per rider</span>
                      </td>

                      {/* DRIVERS */}
                      <td className="px-5 py-4 text-xs">
                        {s.drivers.length === 0 ? (
                          <span className={isDark ? "text-slate-400" : "text-slate-400"}>No drivers</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {s.drivers.map((d) => (
                              <Link
                                key={d.id}
                                to={`/drivers/${d.id}`}
                                className={`rounded-full px-2 py-0.5 font-bold transition ${
                                  isDark
                                    ? "bg-white/20 text-white hover:bg-white/30"
                                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                }`}
                              >
                                {d.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <Link
                          to={`/shifts/fulltime/${s.id}/edit`}
                          className={`mr-2 rounded-lg px-2.5 py-1 text-xs font-bold transition shadow-2xs ${
                            isDark
                              ? "bg-white/20 border border-white/30 text-white hover:bg-white/30"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition shadow-2xs ${
                            isDark
                              ? "bg-rose-900/50 border border-rose-400/40 text-rose-200 hover:bg-rose-900/80"
                              : "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                          }`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
