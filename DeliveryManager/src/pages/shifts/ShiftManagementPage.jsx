import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../../components/layout/ManagerLayout";
import { managerApi } from "../../api/managerApi";
import AssignRidersModal from "../../components/shifts/AssignRidersModal";

const incentiveLabel = (slot) =>
  slot?.incentiveMode === "per_km" && slot.incentiveRate > 0
    ? `₹${slot.incentiveRate} / km${slot.incentiveAfterKm > 0 ? ` after ${slot.incentiveAfterKm} km` : ""}`
    : slot?.incentiveMode === "per_hour" && slot.incentiveRate > 0
      ? `₹${slot.incentiveRate} / hr`
      : "—";

const getTodayString = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const lifecycleBadge = (lifecycle) => {
  if (lifecycle === "current" || lifecycle === "Live") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (lifecycle === "past" || lifecycle === "Expired") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-sky-50 text-sky-800 border-sky-200";
};

const statusDisplay = (slot) =>
  slot.statusLabel ||
  (slot.isExpired ? "Expired" : slot.isLive ? "Live" : slot.lifecycle === "past" ? "Expired" : slot.lifecycle === "current" ? "Live" : "Upcoming");

/** Default rider rate: ₹15 per KM (0–1 → ₹15, 1–2 → ₹30, …). */
const RATE_PER_KM = 15;

const defaultKmSlabs = () => [
  { minKm: 0, maxKm: 1, riderAmount: RATE_PER_KM * 1 },
  { minKm: 1, maxKm: 2, riderAmount: RATE_PER_KM * 2 },
  { minKm: 2, maxKm: 3, riderAmount: RATE_PER_KM * 3 },
  { minKm: 3, maxKm: 4, riderAmount: RATE_PER_KM * 4 },
];

const formatDateWithDay = (dateStr) => {
  if (!dateStr) return { formatted: "", dayName: "" };
  try {
    const d = new Date(dateStr + "T00:00:00");
    const formatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const dayName = d.toLocaleDateString("en-GB", { weekday: "long" });
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
  { id: "custom", label: "Custom Shift (Manager Defined)", defaultStart: "09:00 AM", defaultEnd: "05:00 PM" },
];

export default function ShiftManagementPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSlotForRiders, setSelectedSlotForRiders] = useState(null);
  const [riderDetailsModalData, setRiderDetailsModalData] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);

  // Gigs & Incentives state
  const [gigs, setGigs] = useState([]);
  const [loadingGigs, setLoadingGigs] = useState(false);
  const [isGigModalOpen, setIsGigModalOpen] = useState(false);

  // New Gig form state
  const [gigTitle, setGigTitle] = useState("");
  const [gigType, setGigType] = useState("earnings_target");
  const [gigDate, setGigDate] = useState(getTodayString());
  const [gigStartTime, setGigStartTime] = useState("05:00 PM");
  const [gigEndTime, setGigEndTime] = useState("07:00 PM");
  const [gigTargetHours, setGigTargetHours] = useState(2);
  const [gigTargetEarnings, setGigTargetEarnings] = useState(200);
  const [gigBonusAmount, setGigBonusAmount] = useState(18);
  const [gigDescription, setGigDescription] = useState("");
  const [gigTiers, setGigTiers] = useState([
    { minTarget: 200, bonusAmount: 18 },
    { minTarget: 400, bonusAmount: 60 },
  ]);

  const addGigTierRow = () => {
    if (gigTiers.length >= 5) {
      showToast("Maximum 5 incentive slabs allowed");
      return;
    }
    const lastTarget = gigTiers.length > 0 ? gigTiers[gigTiers.length - 1].minTarget : 200;
    const lastBonus = gigTiers.length > 0 ? gigTiers[gigTiers.length - 1].bonusAmount : 20;
    setGigTiers([
      ...gigTiers,
      { minTarget: lastTarget + 200, bonusAmount: lastBonus + 40 },
    ]);
  };

  const removeGigTierRow = (index) => {
    if (gigTiers.length <= 1) return;
    setGigTiers(gigTiers.filter((_, i) => i !== index));
  };

  const updateGigTierRow = (index, field, value) => {
    const updated = [...gigTiers];
    updated[index][field] = Number(value) || 0;
    setGigTiers(updated);
  };

  // New Shift form state
  const [newShiftType, setNewShiftType] = useState("morning");
  const [newShiftName, setNewShiftName] = useState("Morning Shift");
  const [newCapacity, setNewCapacity] = useState(10);
  const [recurrenceMode, setRecurrenceMode] = useState("single_day");
  const [targetDate, setTargetDate] = useState(getTodayString());
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState([1, 2, 3, 4, 5]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Slots array under shift
  const [slotsList, setSlotsList] = useState([
    { startTime: "09:00 AM", endTime: "01:00 PM", capacity: 10 },
  ]);

  // KM-based delivery earning slabs — default ₹15 / KM
  const [earningSlabs, setEarningSlabs] = useState(defaultKmSlabs);

  const addEarningSlabRow = () => {
    if (earningSlabs.length >= 8) {
      showToast("Maximum 8 KM earning slabs allowed");
      return;
    }
    const last = earningSlabs[earningSlabs.length - 1];
    const nextMin = last ? Number(last.maxKm) || 0 : 0;
    const nextMax = nextMin + 1;
    setEarningSlabs([
      ...earningSlabs,
      {
        minKm: nextMin,
        maxKm: nextMax,
        riderAmount: RATE_PER_KM * nextMax,
      },
    ]);
  };

  const removeEarningSlabRow = (index) => {
    if (earningSlabs.length <= 1) return;
    setEarningSlabs(earningSlabs.filter((_, i) => i !== index));
  };

  const updateEarningSlabRow = (index, field, value) => {
    const updated = [...earningSlabs];
    updated[index] = { ...updated[index], [field]: value === "" ? "" : Number(value) };
    setEarningSlabs(updated);
  };

  // Edit slot form state
  const [editCapacity, setEditCapacity] = useState(10);
  const [editStatus, setEditStatus] = useState("AVAILABLE");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editIncentiveMode, setEditIncentiveMode] = useState("none");
  const [editIncentiveRate, setEditIncentiveRate] = useState("");
  const [editIncentiveAfterKm, setEditIncentiveAfterKm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignSlot, setAssignSlot] = useState(null);
  const loadAssignableRiders = useCallback(() => managerApi.getAssignableRiders(), []);

  // Pagination state
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Date-wise: all shifts created for the selected day
      const res = await managerApi.getManagerSlots(selectedDate, { filter: "all" });
      setShifts(res.data.shifts || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const loadGigs = useCallback(async () => {
    setLoadingGigs(true);
    try {
      const res = await managerApi.getGigs(selectedDate);
      setGigs(res.data.gigs || []);
    } catch (err) {
      console.error("Failed to load gigs", err);
    } finally {
      setLoadingGigs(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadShifts();
    loadGigs();
  }, [loadShifts, loadGigs]);

  const handleShiftTypeChange = (typeId) => {
    setNewShiftType(typeId);
    const found = SHIFT_TYPES.find((t) => t.id === typeId);
    if (found) {
      setNewShiftName(found.label);
      setSlotsList([
        { startTime: found.defaultStart, endTime: found.defaultEnd, capacity: parseInt(newCapacity, 10) || 10 }
      ]);
    }
  };

  const addSlotRow = () => {
    if (slotsList.length >= 4) {
      showToast("Maximum 4 slots allowed per shift");
      return;
    }
    setSlotsList([
      ...slotsList,
      { startTime: "01:00 PM", endTime: "05:00 PM", capacity: parseInt(newCapacity, 10) || 10 },
    ]);
  };

  const removeSlotRow = (index) => {
    if (slotsList.length <= 1) return;
    setSlotsList(slotsList.filter((_, i) => i !== index));
  };

  const updateSlotRow = (index, field, value) => {
    const updated = [...slotsList];
    updated[index][field] = value;
    setSlotsList(updated);
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    const deliveryEarningSlabs = earningSlabs.map((s) => ({
      minKm: Number(s.minKm),
      maxKm: Number(s.maxKm),
      riderAmount: Number(s.riderAmount),
    }));

    for (let i = 0; i < deliveryEarningSlabs.length; i++) {
      const s = deliveryEarningSlabs[i];
      if (isNaN(s.minKm) || s.minKm < 0) {
        showToast(`Slab ${i + 1}: Min KM must be 0 or more`);
        return;
      }
      if (isNaN(s.maxKm) || s.maxKm <= s.minKm) {
        showToast(`Slab ${i + 1}: Max KM must be greater than Min KM`);
        return;
      }
      if (isNaN(s.riderAmount) || s.riderAmount < 0) {
        showToast(`Slab ${i + 1}: Rider earning (₹) must be 0 or more`);
        return;
      }
      for (let j = 0; j < i; j++) {
        const a = deliveryEarningSlabs[j];
        if (s.minKm < a.maxKm && s.maxKm > a.minKm) {
          showToast(
            `Slabs overlap: #${j + 1} (${a.minKm}–${a.maxKm}) and #${i + 1} (${s.minKm}–${s.maxKm}). Use 0–1, then 1–2, then 2–3.`
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const res = await managerApi.createShift({
        name: newShiftName,
        type: newShiftType,
        capacity: parseInt(newCapacity, 10) || 10,
        maxCapacityPerSlot: parseInt(newCapacity, 10) || 10,
        customSlots: slotsList.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          capacity: parseInt(s.capacity || newCapacity, 10) || 10,
        })),
        recurrenceMode,
        targetDate,
        daysOfWeek: selectedDaysOfWeek,
        deliveryEarningSlabs,
      });

      showToast(res.data.message || "Shift created successfully!");
      setIsCreateModalOpen(false);
      await loadShifts();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to create shift");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGig = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await managerApi.createGig({
        title: gigTitle,
        type: gigType,
        dateString: gigDate,
        startTime: gigStartTime,
        endTime: gigEndTime,
        targetHours: Number(gigTargetHours) || 3,
        targetEarnings: Number(gigTargetEarnings) || 500,
        bonusAmount: Number(gigBonusAmount) || 150,
        tiers: gigTiers,
        description: gigDescription,
      });

      showToast(res.data.message || "Gig incentive created successfully!");
      setIsGigModalOpen(false);
      setGigTitle("");
      setGigDescription("");
      await loadGigs();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to create gig");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGig = async (gigId) => {
    if (!window.confirm("Are you sure you want to delete this gig incentive?")) return;
    try {
      const res = await managerApi.deleteGig(gigId);
      showToast(res.data.message || "Gig incentive deleted");
      await loadGigs();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete gig");
    }
  };

  const handleOpenSlotDetails = async (slotId) => {
    try {
      const res = await managerApi.getSlotDetailsWithRiders(slotId);
      setRiderDetailsModalData(res.data);
      setSelectedSlotForRiders(true);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load shift details");
    }
  };

  const handleUpdateSlot = async (e) => {
    e.preventDefault();
    if (!editingSlot) return;
    try {
      const res = await managerApi.updateSlotDateWise(editingSlot.id || editingSlot.slotId || editingSlot._id, {
        capacity: parseInt(editCapacity, 10),
        status: editStatus,
        startTime: editStartTime,
        endTime: editEndTime,
        incentiveMode: editIncentiveMode,
        incentiveRate: editIncentiveMode === "none" ? 0 : Number(editIncentiveRate) || 0,
        incentiveAfterKm: editIncentiveMode === "per_km" ? Number(editIncentiveAfterKm) || 0 : 0,
      });
      showToast(res.data.message || "Shift slot updated!");
      setEditingSlot(null);
      await loadShifts();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update slot");
    }
  };

  const handleDeleteSlot = (slot, shift) => {
    setDeleteTarget({
      slotId: slot.id || slot.slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      dateString: shift.dateString,
    });
  };

  const handleUnassignRider = async (rider) => {
    const slotId = riderDetailsModalData?.slotId;
    if (!slotId || !window.confirm(`Remove ${rider.deliveryPartnerName} from this slot?`)) return;
    try {
      const res = await managerApi.unassignSlotRider(slotId, rider.deliveryPartnerId);
      showToast(res.data.message || "Removed from slot");
      await Promise.all([handleOpenSlotDetails(slotId), loadShifts()]);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to remove delivery partner");
    }
  };

  const confirmDeleteSlot = async (scope) => {
    if (!deleteTarget?.slotId) return;
    try {
      const res = await managerApi.deleteSlotDateWise(deleteTarget.slotId, { scope });
      showToast(res.data.message || "Shift removed");
      setDeleteTarget(null);
      await loadShifts();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete shift");
    }
  };

  const toggleDayOfWeek = (dayNum) => {
    setSelectedDaysOfWeek((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum]
    );
  };

  const currentDateObj = formatDateWithDay(getTodayString());
  const selectedDateObj = formatDateWithDay(selectedDate);

  const totalBookedToday = shifts.reduce((acc, s) => acc + (s.totalBooked || 0), 0);
  const totalCapacityToday = shifts.reduce((acc, s) => acc + (s.totalCapacity || 0), 0);
  const totalAvailableToday = shifts.reduce((acc, s) => acc + Math.max(0, (s.totalCapacity || 0) - (s.totalBooked || 0)), 0);
  const availablePercentage = totalCapacityToday > 0 ? Math.round((totalAvailableToday / totalCapacityToday) * 100) : 0;

  return (
    <PageShell>
      {toast && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-xs flex items-center gap-2">
          <span>⚡</span>
          <span>{toast}</span>
        </div>
      )}

      {/* 5 COMPACT TOP STAT CARDS WITH ONE-LINE CONTENT */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* CARD 1: CURRENT DATE */}
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Date</p>
          <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-sm font-black text-slate-900">{currentDateObj.formatted}</span>
            <span className="text-[11px] font-medium text-slate-400">({currentDateObj.dayName})</span>
          </div>
        </div>

        {/* CARD 2: SELECTED DATE */}
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Selected Date</p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200/90 bg-slate-50/70 px-2 py-1 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none cursor-pointer"
          />
        </div>

        {/* CARD 3: ACTIVE SHIFTS */}
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shifts that day</p>
          <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-base font-black text-slate-900">
              {shifts.reduce((n, s) => n + (s.slots?.length || 0), 0)}
            </span>
            <span className="text-[11px] font-medium text-slate-400">slots</span>
          </div>
        </div>

        {/* CARD 4: SLOTS AVAILABLE */}
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Slots Available</p>
          <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-base font-black text-emerald-600">{totalAvailableToday}</span>
            <span className="text-xs font-normal text-slate-400">/ {totalCapacityToday}</span>
            <span className="text-[11px] font-medium text-slate-400">({availablePercentage}%)</span>
          </div>
        </div>
        {/* CARD 5: ACTIONS */}
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Actions</p>
          <div className="flex items-center">
            <Link
              to="/shifts/create"
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition active:scale-98 whitespace-nowrap"
            >
              <span>+ Create Shift</span>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-xs text-[12px] text-slate-500">
        Showing <span className="font-bold text-slate-800">all shifts</span> for{" "}
        <span className="font-bold text-slate-800">{selectedDateObj.formatted}</span>
        {" "}({selectedDateObj.dayName}). When a slot end time passes it is marked{" "}
        <span className="font-bold text-amber-700">Expired</span>. Click a row for riders joined,
        orders received, and completed deliveries with names.
      </div>

      {/* SHIFTS TABLE CONTAINER */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-400">Loading shifts data...</div>
        ) : shifts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <p className="text-2xl">📅</p>
            <p className="text-sm font-bold text-slate-700">No shifts created for this date.</p>
            <p className="text-xs text-slate-400">
              Pick another date or click &quot;+ Create Shift&quot;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-white text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-2">SHIFT</th>
                  <th className="px-5 py-2">DATE</th>
                  <th className="px-5 py-2">TIME</th>
                  <th className="px-5 py-2">STATUS</th>
                  <th className="px-5 py-2">AVAILABLE</th>
                  <th className="px-5 py-2">ASSIGNED</th>
                  <th className="px-5 py-2">INCENTIVE</th>
                  <th className="px-5 py-2">SALARY</th>
                  <th className="px-5 py-2 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((shift) => {
                  const shiftDateObj = formatDateWithDay(shift.dateString);
                  const salaryValue = Number(shift.salaryAmount ?? shift.monthlySalary);
                  const salaryLabel =
                    salaryValue > 0
                      ? `₹${salaryValue.toLocaleString("en-IN")}/${shift.salaryPeriod || "month"}`
                      : "—";
                  return (shift.slots || []).map((slot, index) => {
                    const availableCount = Math.max(0, slot.capacity - slot.bookedCount);
                    const label = statusDisplay(slot);
                    return (
                      <tr
                        key={`${shift.id}-${slot.id || index}`}
                        className="hover:bg-emerald-50/40 transition cursor-pointer"
                        onClick={() => handleOpenSlotDetails(slot.id || slot.slotId)}
                      >
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {shift.name || shift.shiftName}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{shiftDateObj.formatted}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{shiftDateObj.dayName}</div>
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {slot.startTime} – {slot.endTime}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${lifecycleBadge(
                              label
                            )}`}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-black text-emerald-600">
                          {availableCount} / {slot.capacity}
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-emerald-700 underline">
                            {slot.bookedCount || 0} assigned · View
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-amber-700 whitespace-nowrap">
                          {incentiveLabel(slot)}
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-emerald-700 whitespace-nowrap">
                          {salaryLabel}
                        </td>
                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {label !== "Expired" && slot.status !== "CANCELLED" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setAssignSlot({
                                    ...slot,
                                    dateString: shift.dateString,
                                    assignedRiderIds: (slot.bookings || [])
                                      .filter((b) => b.status !== "CANCELLED")
                                      .map((b) => b.deliveryPartnerId),
                                  })
                                }
                                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition"
                              >
                                Assign
                              </button>
                            )}
                            {label !== "Expired" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSlot(slot);
                                  setEditCapacity(slot.capacity);
                                  setEditStatus(slot.status);
                                  setEditStartTime(slot.startTime);
                                  setEditEndTime(slot.endTime);
                                  setEditIncentiveMode(slot.incentiveMode || "none");
                                  setEditIncentiveRate(slot.incentiveRate || "");
                                  setEditIncentiveAfterKm(slot.incentiveAfterKm || "");
                                }}
                                className="rounded-lg border border-emerald-500 bg-white px-3 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteSlot(slot, shift)}
                              className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE SHIFT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Shift & Custom Time Slots</h3>
                <p className="text-xs text-slate-500">Select shift preset and customize exact start & end hours</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Select Shift Type
                </label>
                <select
                  value={newShiftType}
                  onChange={(e) => handleShiftTypeChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  {SHIFT_TYPES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Shift Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newShiftName}
                    onChange={(e) => setNewShiftName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Capacity Per Slot
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              {/* MANAGER CUSTOM TIME SLOTS CONFIGURATION */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Manager Time Slots (Start & End Time)
                    </label>
                    <p className="text-[11px] text-slate-500">Edit start and end time for this shift</p>
                  </div>
                  <button
                    type="button"
                    onClick={addSlotRow}
                    className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 transition"
                  >
                    + Add Time Slot
                  </button>
                </div>

                {slotsList.map((cs, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl bg-white p-2.5 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 w-5">#{idx + 1}</span>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Start Time</span>
                        <input
                          type="text"
                          value={cs.startTime}
                          onChange={(e) => updateSlotRow(idx, "startTime", e.target.value)}
                          placeholder="e.g. 06:00 AM"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">End Time</span>
                        <input
                          type="text"
                          value={cs.endTime}
                          onChange={(e) => updateSlotRow(idx, "endTime", e.target.value)}
                          placeholder="e.g. 02:00 PM"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-900"
                        />
                      </div>
                    </div>
                    {slotsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlotRow(idx)}
                        className="text-xs text-rose-600 font-bold p-1 hover:bg-rose-50 rounded"
                        title="Remove Slot"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* KM-BASED DELIVERY EARNING SLABS */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                      Delivery Charges / KM Earning Slabs
                    </label>
                    <p className="text-[11px] text-emerald-800/80">
                      ₹{RATE_PER_KM}/KM — till 1 KM → ₹{RATE_PER_KM}, 1–2 KM → ₹{RATE_PER_KM * 2}. Use bands 0–1, 1–2, 2–3 (not all Min=0).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addEarningSlabRow}
                    className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition"
                  >
                    + Add KM Slab
                  </button>
                </div>

                {earningSlabs.map((slab, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-xl bg-white p-2.5 border border-emerald-200"
                  >
                    <span className="text-[11px] font-bold text-emerald-800 w-5">#{idx + 1}</span>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Min KM</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          required
                          value={slab.minKm}
                          onChange={(e) => updateEarningSlabRow(idx, "minKm", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Max KM</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          required
                          value={slab.maxKm}
                          onChange={(e) => updateEarningSlabRow(idx, "maxKm", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-emerald-700 uppercase">Earn ₹</span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={slab.riderAmount}
                          onChange={(e) => updateEarningSlabRow(idx, "riderAmount", e.target.value)}
                          className="w-full rounded-lg border border-emerald-200 bg-emerald-50/40 px-2 py-1.5 text-xs font-bold text-emerald-800"
                        />
                      </div>
                    </div>
                    {earningSlabs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEarningSlabRow(idx)}
                        className="text-xs text-rose-600 font-bold p-1 hover:bg-rose-50 rounded"
                        title="Remove slab"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* RECURRENCE SCHEDULE */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">Recurrence Schedule</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "single_day", label: "Single Day" },
                    { id: "full_week", label: "Full Week" },
                    { id: "full_month", label: "Full Month" },
                  ].map((rec) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setRecurrenceMode(rec.id)}
                      className={`rounded-lg py-2 text-xs font-bold border transition-all ${
                        recurrenceMode === rec.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {rec.label}
                    </button>
                  ))}
                </div>

                {recurrenceMode === "single_day" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Target Date</label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                )}

                {(recurrenceMode === "full_week" || recurrenceMode === "full_month") && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Active Days of Week</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { num: 1, label: "Mon" },
                        { num: 2, label: "Tue" },
                        { num: 3, label: "Wed" },
                        { num: 4, label: "Thu" },
                        { num: 5, label: "Fri" },
                        { num: 6, label: "Sat" },
                        { num: 0, label: "Sun" },
                      ].map((day) => {
                        const active = selectedDaysOfWeek.includes(day.num);
                        return (
                          <button
                            key={day.num}
                            type="button"
                            onClick={() => toggleDayOfWeek(day.num)}
                            className={`h-8 w-10 rounded-lg text-xs font-bold transition-all ${
                              active ? "bg-emerald-600 text-white" : "bg-white text-slate-600 border border-slate-200"
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

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
                >
                  {isSubmitting ? "Creating Shift..." : "Create Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SLOT MODAL */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Time Slot</h3>

            <form onSubmit={handleUpdateSlot} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Start Time</label>
                  <input
                    type="text"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    placeholder="e.g. 06:00 AM"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">End Time</label>
                  <input
                    type="text"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    placeholder="e.g. 02:00 PM"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Slot Capacity</label>
                <input
                  type="number"
                  min={editingSlot.bookedCount || 0}
                  required
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">Currently assigned: {editingSlot.bookedCount || 0}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-amber-700 uppercase mb-1">Incentive</label>
                  <select
                    value={editIncentiveMode}
                    onChange={(e) => setEditIncentiveMode(e.target.value)}
                    className="w-full rounded-xl border border-amber-200 px-3 py-2 text-xs font-medium"
                  >
                    <option value="none">No incentive</option>
                    <option value="per_km">₹ per KM delivered</option>
                    <option value="per_hour">₹ per hour online</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-700 uppercase mb-1">
                    {editIncentiveMode === "per_hour" ? "₹ / hour" : "₹ / KM"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    disabled={editIncentiveMode === "none"}
                    value={editIncentiveRate}
                    onChange={(e) => setEditIncentiveRate(e.target.value)}
                    className="w-full rounded-xl border border-amber-200 px-3.5 py-2 text-xs font-medium disabled:opacity-40"
                  />
                </div>
              </div>
              {editIncentiveMode === "per_km" && (
                <div>
                  <label className="block text-xs font-bold text-amber-700 uppercase mb-1">Pay after (km in slot)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editIncentiveAfterKm}
                    onChange={(e) => setEditIncentiveAfterKm(e.target.value)}
                    placeholder="0 = from the first km"
                    className="w-full rounded-xl border border-amber-200 px-3.5 py-2 text-xs font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Status Override</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="FEW_SPOTS_LEFT">FEW_SPOTS_LEFT</option>
                  <option value="FULL">FULL (Block new bookings)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow"
                >
                  Save Slot Edits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SLOT DETAIL MODAL — riders + orders */}
      {selectedSlotForRiders && riderDetailsModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {riderDetailsModalData.shiftName || "Shift"} · {riderDetailsModalData.startTime} – {riderDetailsModalData.endTime}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {riderDetailsModalData.dateString}{" "}
                  <span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${lifecycleBadge(riderDetailsModalData.statusLabel || "")}`}>
                    {riderDetailsModalData.statusLabel || "—"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSlotForRiders(null);
                  setRiderDetailsModalData(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Assigned", riderDetailsModalData.summary?.ridersJoined ?? riderDetailsModalData.bookedCount ?? 0],
                ["Orders received", riderDetailsModalData.summary?.ordersReceived ?? 0],
                ["Orders taken", riderDetailsModalData.summary?.ordersTaken ?? 0],
                ["Completed", riderDetailsModalData.summary?.ordersCompleted ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
                  <p className="text-lg font-black text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Delivery boys on this shift
              </h4>
              {(riderDetailsModalData.deliveryPartners || []).length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400 font-semibold">
                  No delivery partners assigned to this slot yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {riderDetailsModalData.deliveryPartners.map((rider, idx) => (
                    <div
                      key={rider.bookingId}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800 text-xs">
                            {(rider.deliveryPartnerName || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {idx + 1}. {rider.deliveryPartnerName}
                            </p>
                            <p className="text-[11px] text-slate-500">📞 {rider.deliveryPartnerPhone || "—"}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                            {rider.status}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Taken {rider.ordersTaken ?? 0} · Done {rider.ordersCompleted ?? 0}
                          </p>
                          {!rider.notBookedOnSlot &&
                            !riderDetailsModalData.isExpired &&
                            rider.status !== "COMPLETED" && (
                              <button
                                type="button"
                                onClick={() => handleUnassignRider(rider)}
                                className="mt-1 text-[10px] font-bold text-rose-600 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                        </div>
                      </div>

                      {(rider.completedOrders || []).length > 0 && (
                        <div className="rounded-lg bg-white border border-slate-100 p-2 space-y-1">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Completed deliveries</p>
                          {rider.completedOrders.map((o) => (
                            <div key={o.id} className="flex justify-between text-[11px] text-slate-700 gap-2">
                              <span className="font-semibold truncate">
                                {o.orderNumber} · {o.customerName}
                              </span>
                              <span className="text-emerald-700 font-bold shrink-0">₹{o.earning || 0}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(rider.orders || []).length > 0 && (rider.completedOrders || []).length === 0 && (
                        <div className="rounded-lg bg-white border border-slate-100 p-2 space-y-1">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Orders taken</p>
                          {rider.orders.map((o) => (
                            <div key={o.id} className="flex justify-between text-[11px] text-slate-700 gap-2">
                              <span className="font-semibold truncate">
                                {o.orderNumber} · {o.customerName}
                              </span>
                              <span className="text-slate-500 shrink-0">{o.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(riderDetailsModalData.ordersReceivedList || []).length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Orders in this shift window
                </h4>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 max-h-40 overflow-y-auto">
                  {riderDetailsModalData.ordersReceivedList.map((o) => (
                    <div key={o.id} className="flex justify-between px-3 py-2 text-[11px] gap-2">
                      <span className="font-semibold text-slate-800 truncate">
                        {o.orderNumber} · {o.customerName}
                      </span>
                      <span className="text-slate-500 shrink-0">{o.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE GIG MODAL */}
      {isGigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>🎁</span>
                <span>Create Store Gig / Driver Incentive</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsGigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Incentive Title</label>
                <input
                  type="text"
                  required
                  value={gigTitle}
                  onChange={(e) => setGigTitle(e.target.value)}
                  placeholder="e.g. Friday Evening Peak Hours Bonus"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Incentive Type</label>
                <select
                  value={gigType}
                  onChange={(e) => setGigType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                >
                  <option value="hours_bonus">Peak Hours Bonus (Work X Hours for Bonus)</option>
                  <option value="earnings_target">Target Earnings Bonus (Earn ₹X Amount for Bonus)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={gigDate}
                    onChange={(e) => setGigDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Start Time</label>
                  <input
                    type="text"
                    required
                    value={gigStartTime}
                    onChange={(e) => setGigStartTime(e.target.value)}
                    placeholder="06:00 PM"
                    className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">End Time</label>
                  <input
                    type="text"
                    required
                    value={gigEndTime}
                    onChange={(e) => setGigEndTime(e.target.value)}
                    placeholder="10:00 PM"
                    className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* MULTI-LEVEL INCENTIVE SLABS / TIERS BUILDER */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-900 uppercase">
                    Incentive Slabs / Tiers ({gigTiers.length}/5)
                  </label>
                  <button
                    type="button"
                    onClick={addGigTierRow}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                  >
                    + Add Slab Tier
                  </button>
                </div>
                <p className="text-[11px] text-amber-800/80 font-medium">
                  {gigType === "hours_bonus"
                    ? "Example: Slab 1 (2 hrs => ₹18), Slab 2 (4 hrs => ₹60)"
                    : "Example: Slab 1 (₹200 => ₹18), Slab 2 (₹400 => ₹60)"}
                </p>

                <div className="space-y-2 pt-1">
                  {gigTiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-amber-200/60 shadow-2xs">
                      <span className="text-[11px] font-bold text-amber-900 w-12">Slab {idx + 1}:</span>
                      <div className="flex flex-1 items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500">{gigType === "hours_bonus" ? "Hrs" : "Target ₹"}</span>
                        <input
                          type="number"
                          required
                          min="1"
                          value={tier.minTarget}
                          onChange={(e) => updateGigTierRow(idx, "minTarget", e.target.value)}
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div className="flex flex-1 items-center gap-1">
                        <span className="text-[10px] font-bold text-emerald-700">Bonus ₹</span>
                        <input
                          type="number"
                          required
                          min="1"
                          value={tier.bonusAmount}
                          onChange={(e) => updateGigTierRow(idx, "bonusAmount", e.target.value)}
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-emerald-700"
                        />
                      </div>
                      {gigTiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGigTierRow(idx)}
                          className="text-rose-500 font-bold hover:text-rose-700 px-1 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Terms / Description</label>
                <textarea
                  rows="2"
                  value={gigDescription}
                  onChange={(e) => setGigDescription(e.target.value)}
                  placeholder="e.g. Work during peak hours and complete assigned orders to get ₹150 incentive."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGigModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-amber-700 transition cursor-pointer"
                >
                  {isSubmitting ? "Publishing..." : "Publish Gig Incentive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignSlot && (
        <AssignRidersModal
          slot={assignSlot}
          loadRiders={loadAssignableRiders}
          assign={(body) => managerApi.assignSlotRiders(assignSlot.id || assignSlot.slotId, body)}
          onClose={() => setAssignSlot(null)}
          onAssigned={async (msg) => {
            setAssignSlot(null);
            showToast(msg);
            await loadShifts();
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Delete this shift slot?</h3>
            <p className="text-sm text-slate-600">
              {deleteTarget.startTime} – {deleteTarget.endTime}
              {deleteTarget.dateString ? ` on ${deleteTarget.dateString}` : ""}.
              Drivers who booked it will be told the slot was cancelled.
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Delete only this date, or the same slot on all available weeks it was added?
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => confirmDeleteSlot("this_date")}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Only this date
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteSlot("all_weeks")}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                All available weeks
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
