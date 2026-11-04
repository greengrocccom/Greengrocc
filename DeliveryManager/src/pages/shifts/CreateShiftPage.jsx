import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { managerApi } from "../../api/managerApi";

const getTodayString = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const getNextDayString = (baseDateStr) => {
  try {
    const base = baseDateStr ? new Date(baseDateStr + "T12:00:00") : new Date();
    base.setDate(base.getDate() + 1);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(base);
  } catch (e) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
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

const isAfterMidnightTime = (type, slots = []) => {
  if (type === "late_night") return true;
  if (!slots || slots.length === 0) return false;
  const firstSlotStart = slots[0]?.startTime;
  if (!firstSlotStart) return false;
  const mins = parseTimeToMinutes(firstSlotStart);
  return mins >= 0 && mins < 300;
};

const formatDateWithDay = (dateStr) => {
  if (!dateStr) return { formatted: "", dayName: "" };
  try {
    const d = new Date(dateStr + "T00:00:00");
    const formatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const dayName = d.toLocaleDateString("en-GB", { weekday: "short" });
    return { formatted, dayName };
  } catch (e) {
    return { formatted: dateStr, dayName: "" };
  }
};

const SHIFT_TYPES = [
  { id: "early_morning", label: "Early Morning Shift", defaultStart: "06:00 AM", defaultEnd: "09:00 AM" },
  { id: "morning", label: "Morning Shift", defaultStart: "09:00 AM", defaultEnd: "01:00 PM" },
  { id: "afternoon", label: "Afternoon Shift", defaultStart: "01:00 PM", defaultEnd: "05:00 PM" },
  { id: "evening", label: "Evening Shift", defaultStart: "05:00 PM", defaultEnd: "09:00 PM" },
  { id: "night", label: "Night Shift", defaultStart: "09:00 PM", defaultEnd: "12:00 AM" },
  { id: "late_night", label: "Late Night Shift", defaultStart: "12:00 AM", defaultEnd: "04:00 AM" },
  { id: "custom", label: "Custom Shift", defaultStart: "09:00 AM", defaultEnd: "05:00 PM" },
];

const NO_INCENTIVE = {
  incentiveMode: "none",
  incentiveRate: "",
  incentiveAfterKm: "",
  incentiveAudience: "all",
  incentiveEligibleRiderIds: [],
};

const INCENTIVE_OPTIONS = [
  { id: "none", label: "No incentive" },
  { id: "per_km", label: "₹ per KM delivered" },
  { id: "per_hour", label: "₹ per hour online" },
];

const INCENTIVE_AUDIENCE_OPTIONS = [
  { id: "all", label: "All Drivers" },
  { id: "top_performers", label: "Good Performance (★ 4.0+)" },
  { id: "specific", label: "Specific Drivers" },
];

const RECURRENCE = [
  { id: "single_day", label: "Single day" },
  { id: "full_week", label: "Full week" },
  { id: "full_month", label: "Full month" },
];

const WEEK_DAYS = [
  { num: 1, label: "Mon" },
  { num: 2, label: "Tue" },
  { num: 3, label: "Wed" },
  { num: 4, label: "Thu" },
  { num: 5, label: "Fri" },
  { num: 6, label: "Sat" },
  { num: 0, label: "Sun" },
];

const LABEL = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5";
const FIELD =
  "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 disabled:bg-slate-50 disabled:text-slate-400";

function Card({ title, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const EMPLOYMENT_OPTIONS = [
  ["ALL", "All"], ["FULL_TIME", "Full-Time"], ["PART_TIME", "Part-Time"],
];

function RiderSelection({ riders, employmentType, onEmploymentChange, loading, error, onRetry, selectedIds, onChange }) {
  const [search, setSearch] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const query = search.trim().toLowerCase();
  const selected = new Set(selectedIds);
  const visible = riders.filter((rider) =>
    (employmentType === "ALL" || rider.employmentType === employmentType) &&
    (showUnavailable || !rider.reason) &&
    `${rider.name} ${rider.phone}`.toLowerCase().includes(query));
  const eligibleIds = visible.filter((rider) => !rider.reason).map((rider) => rider.id);
  const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));
  const fullTimeCount = riders.filter((rider) => selected.has(rider.id) && rider.employmentType === "FULL_TIME").length;

  return (
    <Card title="Assign delivery boys">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-44">
          <span className={LABEL}>Employment type</span>
          <select value={employmentType} onChange={(event) => onEmploymentChange(event.target.value)} className={FIELD}>
            {EMPLOYMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-48 flex-1">
          <span className={LABEL}>Search delivery boys</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or phone" className={FIELD} />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={showUnavailable} onChange={(event) => setShowUnavailable(event.target.checked)} className="accent-emerald-600" />
          Show unavailable
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs" aria-live="polite">
        <span className="font-semibold text-slate-900">{selectedIds.length} selected</span>
        {employmentType === "ALL" && <span className="text-slate-600">Full-Time {fullTimeCount} · Part-Time {selectedIds.length - fullTimeCount}</span>}
      </div>
      {loading ? <p className="py-6 text-center text-sm text-slate-500" role="status">Checking availability for this schedule…</p>
        : error ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            {error}
            <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>
          </div>
        ) : !visible.length ? <p className="py-6 text-center text-sm text-slate-500">
          {showUnavailable ? "No delivery boys match these filters." : "No eligible delivery boys match these filters. Show unavailable riders to see why."}
        </p> : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-3">
                    <input type="checkbox" aria-label="Select all eligible delivery boys in this view" checked={allSelected} disabled={!eligibleIds.length}
                      onChange={() => onChange(allSelected ? selectedIds.filter((id) => !eligibleIds.includes(id)) : [...new Set([...selectedIds, ...eligibleIds])])} className="accent-emerald-600" />
                  </th>
                  {['Delivery boy', 'Employment type', 'Availability', 'Existing assigned shift', 'Selection status'].map((label) => <th key={label} scope="col" className="px-3 py-3 font-semibold">{label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((rider) => {
                  const checked = selected.has(rider.id);
                  const fullTime = rider.employmentType === "FULL_TIME";
                  const status = { online: "Online", offline: "Offline", on_delivery: "On delivery" }[rider.status];
                  return (
                    <tr key={rider.id} className={checked ? "bg-emerald-50/60" : "hover:bg-slate-50"}>
                      <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${rider.name}`} checked={checked} disabled={Boolean(rider.reason)}
                        onChange={() => onChange(checked ? selectedIds.filter((id) => id !== rider.id) : [...selectedIds, rider.id])} className="accent-emerald-600" /></td>
                      <th scope="row" className="px-3 py-3 font-semibold text-slate-900">{rider.name}<span className="block text-xs font-normal text-slate-500">{rider.phone}</span></th>
                      <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${fullTime ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>{fullTime ? "Full-Time" : "Part-Time"}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-700">{rider.reason ? "Unavailable" : "Available"}{status && <span className="block text-slate-500">{status}</span>}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{rider.existingShift || "—"}</td>
                      <td className={`px-3 py-3 text-xs font-medium ${rider.reason ? "text-amber-800" : checked ? "text-emerald-700" : "text-slate-500"}`}>{rider.reason || (checked ? "Selected" : "Ready to select")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </Card>
  );
}

function SlotIncentiveDriverModal({ isOpen, onClose, riders, selectedIds, onSave }) {
  const [tempSelected, setTempSelected] = useState(selectedIds || []);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTempSelected(selectedIds || []);
  }, [selectedIds, isOpen]);

  if (!isOpen) return null;

  const q = search.trim().toLowerCase();
  const filtered = riders.filter(
    (r) => (r.name || "").toLowerCase().includes(q) || String(r.phone || "").includes(q)
  );

  const toggle = (id) => {
    setTempSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    const allFiltered = filtered.map((r) => r.id);
    const allSelected = allFiltered.length > 0 && allFiltered.every((id) => tempSelected.includes(id));
    setTempSelected(
      allSelected
        ? tempSelected.filter((id) => !allFiltered.includes(id))
        : [...new Set([...tempSelected, ...allFiltered])]
    );
  };

  const selectGoodPerformers = () => {
    const goodIds = riders.filter((r) => r.isGoodPerformance).map((r) => r.id);
    setTempSelected(goodIds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Select Drivers for Slot Incentive</h3>
            <p className="text-xs text-slate-500 mt-0.5">Only selected delivery boys will receive this slot incentive</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50/60">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search driver by name or phone..."
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex items-center justify-between text-xs px-1">
            <button
              type="button"
              onClick={toggleAll}
              className="font-semibold text-emerald-700 hover:underline cursor-pointer"
            >
              Toggle All
            </button>
            <button
              type="button"
              onClick={selectGoodPerformers}
              className="font-semibold text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              ⭐ Pick Good Performance (★ 4.0+)
            </button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No drivers match your search</p>
          ) : (
            filtered.map((r) => {
              const checked = tempSelected.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-3 p-2.5 rounded-xl transition ${
                    checked ? "bg-emerald-50/80" : "hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 accent-emerald-600 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 truncate">{r.name}</span>
                      {r.isGoodPerformance ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                          ★ {Number(r.rating || 5).toFixed(1)} High
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-500">
                          ★ {Number(r.rating || 5).toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{r.phone}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-3">
          <span className="text-xs font-medium text-slate-500">
            {tempSelected.length} of {riders.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(tempSelected);
                onClose();
              }}
              className="h-8 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              Apply Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateShiftPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [toast, setToast] = useState({ msg: "", ok: true });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFixedPayConfirm, setShowFixedPayConfirm] = useState(false);

  const [newShiftType, setNewShiftType] = useState("morning");
  const [newShiftName, setNewShiftName] = useState("Morning Shift");
  const [newCapacity, setNewCapacity] = useState(10);
  const [recurrenceMode, setRecurrenceMode] = useState("single_day");
  const [targetDate, setTargetDate] = useState(getTodayString());
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState([1, 2, 3, 4, 5]);
  const [slotsList, setSlotsList] = useState([
    { startTime: "09:00 AM", endTime: "01:00 PM", capacity: 10, ...NO_INCENTIVE },
  ]);
  const [modalSlotIndex, setModalSlotIndex] = useState(null);
  const [employmentType, setEmploymentType] = useState(() =>
    searchParams.get("employmentType") === "FULL_TIME" ? "FULL_TIME" : "ALL");
  const [riders, setRiders] = useState([]);
  const [preview, setPreview] = useState({ key: "", error: "" });
  const [refreshPreview, setRefreshPreview] = useState(0);
  const [selectedRiderIds, setSelectedRiderIds] = useState([]);
  const [assignmentIssues, setAssignmentIssues] = useState([]);

  const today = getTodayString();
  const scheduleKey = JSON.stringify({
    type: newShiftType,
    recurrenceMode,
    targetDate: recurrenceMode === "single_day" && targetDate === today && isAfterMidnightTime(newShiftType, slotsList)
      ? getNextDayString(today) : targetDate,
    daysOfWeek: selectedDaysOfWeek,
    customSlots: slotsList.map(({ startTime, endTime }) => ({ startTime, endTime })),
  });
  const ridersLoading = preview.key !== scheduleKey;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await managerApi.getAssignableRiders({ schedule: scheduleKey });
        if (cancelled) return;
        const rows = res.data?.riders || [];
        const eligible = new Set(rows.filter((rider) => !rider.reason).map((rider) => rider.id));
        setRiders(rows);
        setSelectedRiderIds((ids) => ids.filter((id) => eligible.has(id)));
        setPreview({ key: scheduleKey, error: "" });
      } catch (err) {
        if (cancelled) return;
        setRiders([]);
        setPreview({ key: scheduleKey, error: err.response?.data?.message || "Could not check rider availability." });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scheduleKey, refreshPreview]);

  const changeEmploymentType = (type) => {
    setEmploymentType(type);
    if (type !== "ALL") {
      const matching = new Set(riders.filter((rider) => rider.employmentType === type).map((rider) => rider.id));
      setSelectedRiderIds((ids) => ids.filter((id) => matching.has(id)));
    }
  };

  const reloadAvailability = () => {
    setPreview({ key: "", error: "" });
    setRefreshPreview((value) => value + 1);
  };

  const showToast = (msg, ok = false) => {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 4000);
  };

  const handleShiftTypeChange = (typeId) => {
    setNewShiftType(typeId);
    const found = SHIFT_TYPES.find((t) => t.id === typeId);
    if (found) {
      setNewShiftName(found.label);
      const newSlots = [
        {
          startTime: found.defaultStart,
          endTime: found.defaultEnd,
          capacity: parseInt(newCapacity, 10) || 10,
          ...NO_INCENTIVE,
        },
      ];
      setSlotsList(newSlots);

      // If shift is after 12 AM (e.g. Late Night Shift 12:00 AM - 04:00 AM), advance date to next day
      if (typeId === "late_night" || isAfterMidnightTime(typeId, newSlots)) {
        setTargetDate(getNextDayString(getTodayString()));
      } else {
        if (targetDate === getNextDayString(getTodayString())) {
          setTargetDate(getTodayString());
        }
      }
    }
  };

  const addSlotRow = () => {
    if (slotsList.length >= 4) {
      showToast("Maximum 4 slots allowed per shift");
      return;
    }
    setSlotsList([
      ...slotsList,
      { startTime: "01:00 PM", endTime: "05:00 PM", capacity: parseInt(newCapacity, 10) || 10, ...NO_INCENTIVE },
    ]);
  };

  const removeSlotRow = (index) => {
    if (slotsList.length <= 1) return;
    setSlotsList(slotsList.filter((_, i) => i !== index));
  };

  const updateSlotRow = (index, field, value) => {
    const updated = [...slotsList];
    updated[index] = { ...updated[index], [field]: value };
    setSlotsList(updated);

    if (field === "startTime" && index === 0) {
      const mins = parseTimeToMinutes(value);
      if (mins >= 0 && mins < 300) {
        const todayStr = getTodayString();
        if (targetDate === todayStr) {
          setTargetDate(getNextDayString(todayStr));
        }
      }
    }
  };

  const toggleDayOfWeek = (dayNum) => {
    setSelectedDaysOfWeek((prev) => (prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum]));
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    if (isSubmitting || ridersLoading || preview.error || selectedRiderIds.length === 0) {
      showToast("Select at least one driver for this slot");
      return;
    }
    for (let i = 0; i < slotsList.length; i++) {
      const s = slotsList[i];
      if (s.incentiveMode !== "none" && !(Number(s.incentiveRate) > 0)) {
        showToast(`Slot ${i + 1}: enter the incentive amount (₹) or choose "No incentive"`);
        return;
      }
      if (s.incentiveMode === "per_km" && s.incentiveAfterKm !== "" && !(Number(s.incentiveAfterKm) >= 0)) {
        showToast(`Slot ${i + 1}: "After km" must be 0 or more`);
        return;
      }
      if (s.incentiveMode !== "none" && s.incentiveAudience === "specific" && (!s.incentiveEligibleRiderIds || s.incentiveEligibleRiderIds.length === 0)) {
        showToast(`Slot ${i + 1}: select at least one driver for specific driver incentive, or switch to All Drivers / Good Performance`);
        return;
      }
    }

    setShowFixedPayConfirm(true);
  };

  const confirmCreateShift = async () => {
    setShowFixedPayConfirm(false);

    setIsSubmitting(true);
    setAssignmentIssues([]);
    try {
      const res = await managerApi.createShift({
        ...JSON.parse(scheduleKey),
        name: newShiftName,
        employmentType,
        capacity: parseInt(newCapacity, 10) || 10,
        customSlots: slotsList.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          capacity: parseInt(s.capacity || newCapacity, 10) || 10,
          incentiveMode: s.incentiveMode || "none",
          incentiveRate: s.incentiveMode === "none" ? 0 : Number(s.incentiveRate) || 0,
          incentiveAfterKm: s.incentiveMode === "per_km" ? Number(s.incentiveAfterKm) || 0 : 0,
          incentiveAudience: s.incentiveAudience || "all",
          incentiveEligibleRiderIds: Array.isArray(s.incentiveEligibleRiderIds) ? s.incentiveEligibleRiderIds : [],
        })),
        riderIds: selectedRiderIds,
      });

      showToast(res.data.message || "Shift created successfully!", true);
      const skipped = res.data.skipped || [];
      if (skipped.length) {
        setAssignmentIssues(skipped);
        setSelectedRiderIds([]);
        reloadAvailability();
      } else {
        setSelectedRiderIds([]);
        setTimeout(() => navigate("/shifts"), 900);
      }
    } catch (err) {
      setAssignmentIssues(err.response?.data?.skipped || []);
      reloadAvailability();
      showToast(err.response?.data?.message || "Failed to assign shift");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCreateShift} className="w-full space-y-5 pb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            <Link to="/shifts" className="hover:text-emerald-700">
              Shifts & Slots
            </Link>{" "}
            / Create
          </p>
          <h1 className="mt-0.5 text-xl font-bold text-slate-900">Create Shift & Time Slots</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/shifts"
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || ridersLoading || Boolean(preview.error) || selectedRiderIds.length === 0}
            className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? "Assigning…" : "Assign Shift"}
          </button>
        </div>
      </div>

      {toast.msg ? (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
            toast.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {toast.msg}
        </div>
      ) : null}

      <Card title="Shift details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={LABEL}>Shift preset</label>
            <select value={newShiftType} onChange={(e) => handleShiftTypeChange(e.target.value)} className={FIELD}>
              {SHIFT_TYPES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Display name</label>
            <input type="text" required value={newShiftName} onChange={(e) => setNewShiftName(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Capacity per slot</label>
            <input
              type="number"
              min="1"
              required
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              className={FIELD}
            />
          </div>
        </div>
      </Card>

      <Card
        title="Time slots"
        action={
          <button
            type="button"
            onClick={addSlotRow}
            className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            + Add slot
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-10 pb-2">#</th>
                <th className="pb-2 pr-3">Start time</th>
                <th className="pb-2 pr-3">End time</th>
                <th className="pb-2 pr-3">Capacity</th>
                <th className="pb-2 pr-3">Incentive</th>
                <th className="pb-2 pr-3">Rate</th>
                <th className="pb-2 pr-3">Pay after</th>
                <th className="pb-2 pr-3 min-w-[200px]">Incentive Eligibility</th>
                <th className="w-10 pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slotsList.map((cs, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 text-xs font-semibold text-slate-400">{idx + 1}</td>
                  <td className="py-2.5 pr-3">
                    <input
                      type="text"
                      value={cs.startTime}
                      onChange={(e) => updateSlotRow(idx, "startTime", e.target.value)}
                      placeholder="06:00 AM"
                      className={FIELD}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <input
                      type="text"
                      value={cs.endTime}
                      onChange={(e) => updateSlotRow(idx, "endTime", e.target.value)}
                      placeholder="02:00 PM"
                      className={FIELD}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <input
                      type="number"
                      min="1"
                      value={cs.capacity}
                      onChange={(e) => updateSlotRow(idx, "capacity", e.target.value)}
                      className={FIELD}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={cs.incentiveMode || "none"}
                      onChange={(e) => updateSlotRow(idx, "incentiveMode", e.target.value)}
                      className={FIELD}
                    >
                      {INCENTIVE_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        disabled={!cs.incentiveMode || cs.incentiveMode === "none"}
                        value={cs.incentiveRate}
                        onChange={(e) => updateSlotRow(idx, "incentiveRate", e.target.value)}
                        placeholder="0"
                        className={`${FIELD} pl-7 pr-14`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        {cs.incentiveMode === "per_hour" ? "/ hr" : cs.incentiveMode === "per_km" ? "/ km" : ""}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        disabled={cs.incentiveMode !== "per_km"}
                        value={cs.incentiveMode === "per_km" ? cs.incentiveAfterKm : ""}
                        onChange={(e) => updateSlotRow(idx, "incentiveAfterKm", e.target.value)}
                        placeholder="0"
                        title="Km the rider must deliver in this slot before each further km is paid"
                        className={`${FIELD} pr-10`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        km
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    {cs.incentiveMode === "none" ? (
                      <span className="text-xs text-slate-300 font-medium">—</span>
                    ) : (
                      <div className="space-y-1">
                        <select
                          value={cs.incentiveAudience || "all"}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateSlotRow(idx, "incentiveAudience", val);
                            if (val === "specific" && (!cs.incentiveEligibleRiderIds || cs.incentiveEligibleRiderIds.length === 0)) {
                              setModalSlotIndex(idx);
                            }
                          }}
                          className={`${FIELD} text-xs font-semibold`}
                        >
                          {INCENTIVE_AUDIENCE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {cs.incentiveAudience === "specific" && (
                          <button
                            type="button"
                            onClick={() => setModalSlotIndex(idx)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                          >
                            <span>{(cs.incentiveEligibleRiderIds || []).length} drivers selected</span>
                            <span>· Edit</span>
                          </button>
                        )}
                        {cs.incentiveAudience === "top_performers" && (
                          <span className="block text-[10px] text-amber-700 font-semibold">
                            Only drivers with rating ≥ 4.0
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeSlotRow(idx)}
                      disabled={slotsList.length <= 1}
                      className="h-9 w-9 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Remove slot"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Schedule">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div>
            <label className={LABEL}>Repeat</label>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {RECURRENCE.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setRecurrenceMode(rec.id)}
                  className={`h-8 rounded-md px-4 text-xs font-semibold transition ${
                    recurrenceMode === rec.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>

          {recurrenceMode === "single_day" ? (
            <div className="w-full max-w-xs">
              <label className={LABEL}>Date</label>
              <input type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={FIELD} />
              {isAfterMidnightTime(newShiftType, slotsList) && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1.5 text-xs text-purple-900">
                  <span>🌙</span>
                  <span className="font-semibold">
                    After 12:00 AM Shift: Scheduled for Next Day ({formatDateWithDay(targetDate).formatted || targetDate})
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className={LABEL}>Active days</label>
              <div className="flex flex-wrap gap-1.5">
                {WEEK_DAYS.map((day) => {
                  const active = selectedDaysOfWeek.includes(day.num);
                  return (
                    <button
                      key={day.num}
                      type="button"
                      onClick={() => toggleDayOfWeek(day.num)}
                      className={`h-10 w-12 rounded-lg border text-xs font-semibold transition ${
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {assignmentIssues.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <p className="font-semibold">Riders who could not be assigned</p>
          <ul className="mt-1 list-disc pl-5">
            {assignmentIssues.map((issue) => <li key={issue.riderId}>{issue.name || 'Selected rider'} — {issue.reason}</li>)}
          </ul>
        </div>
      )}
      <RiderSelection riders={riders} employmentType={employmentType} onEmploymentChange={changeEmploymentType}
        loading={ridersLoading} error={preview.error} onRetry={reloadAvailability} selectedIds={selectedRiderIds} onChange={setSelectedRiderIds} />

      <SlotIncentiveDriverModal
        isOpen={modalSlotIndex !== null}
        onClose={() => setModalSlotIndex(null)}
        riders={riders.filter((rider) => rider.employmentType === "PART_TIME")}
        selectedIds={modalSlotIndex !== null ? (slotsList[modalSlotIndex]?.incentiveEligibleRiderIds || []) : []}
        onSave={(newIds) => {
          if (modalSlotIndex !== null) {
            updateSlotRow(modalSlotIndex, "incentiveEligibleRiderIds", newIds);
            updateSlotRow(modalSlotIndex, "incentiveAudience", "specific");
          }
        }}
      />

      {showFixedPayConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="fixed-pay-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="fixed-pay-title" className="text-base font-bold text-slate-900">Rider payment is fixed</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Rider Payment Settings determine salary and per-kilometre commission. Slot incentives apply to eligible Part-Time riders.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowFixedPayConfirm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Review shift</button>
              <button type="button" disabled={isSubmitting} onClick={confirmCreateShift} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{isSubmitting ? "Assigning…" : "Confirm & Assign"}</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
