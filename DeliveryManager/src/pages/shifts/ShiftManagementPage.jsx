import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../../components/layout/ManagerLayout";
import { managerApi } from "../../api/managerApi";
import AssignRidersModal from "../../components/shifts/AssignRidersModal";
import { Pagination, usePagination } from "../../components/ui/Pagination";

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

const formatDateWithDay = (dateStr) => {
  if (!dateStr) return { formatted: "", dayName: "", ddmmyyyy: "" };
  try {
    const d = new Date(dateStr + "T00:00:00");
    const formatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const dayName = d.toLocaleDateString("en-GB", { weekday: "short" });
    const parts = dateStr.split("-");
    const ddmmyyyy = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : formatted;
    return { formatted, dayName, ddmmyyyy };
  } catch (e) {
    return { formatted: dateStr, dayName: "", ddmmyyyy: dateStr };
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

const getDurationText = (startTime, endTime) => {
  if (!startTime || !endTime) return "";
  const startMin = parseTimeToMinutes(startTime);
  let endMin = parseTimeToMinutes(endTime);
  if (endMin <= startMin) endMin += 24 * 60; // Crosses midnight
  const diffHours = (endMin - startMin) / 60;
  if (diffHours % 1 === 0) {
    return `${diffHours} hrs`;
  }
  return `${diffHours.toFixed(1)} hrs`;
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

const getShiftTypeTheme = (row) => {
  const typeStr = (row?.shiftType || row?.type || row?.parentShift?.type || "").toLowerCase();
  const nameStr = (row?.shiftName || "").toLowerCase();
  const startMin = parseTimeToMinutes(row?.startTime);

  // 1. Late Night (12 AM - 5 AM or type)
  if (typeStr.includes("late_night") || nameStr.includes("late night") || (startMin >= 0 && startMin < 300)) {
    return SHIFT_PALETTE.late_night;
  }

  // 2. Early Morning (approx 5 AM - 9 AM)
  if (typeStr.includes("early_morning") || nameStr.includes("early morning") || (startMin >= 300 && startMin < 540)) {
    return SHIFT_PALETTE.early_morning;
  }

  // 3. Morning (approx 9 AM - 1 PM)
  if (typeStr.includes("morning") || nameStr.includes("morning") || (startMin >= 540 && startMin < 780)) {
    return SHIFT_PALETTE.morning;
  }

  // 4. Afternoon (approx 1 PM - 5 PM)
  if (typeStr.includes("afternoon") || nameStr.includes("afternoon") || (startMin >= 780 && startMin < 1020)) {
    return SHIFT_PALETTE.afternoon;
  }

  // 5. Evening (approx 5 PM - 9 PM)
  if (typeStr.includes("evening") || nameStr.includes("evening") || (startMin >= 1020 && startMin < 1260)) {
    return SHIFT_PALETTE.evening;
  }

  // 6. Night (approx 9 PM - 12 AM)
  if (typeStr.includes("night") || nameStr.includes("night") || startMin >= 1260) {
    return SHIFT_PALETTE.night;
  }

  return SHIFT_PALETTE.morning;
};

export default function ShiftManagementPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Filter & Search states matching reference UI
  const [activeFilterTab, setActiveFilterTab] = useState("all");
  const [selectedZone, setSelectedZone] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMenu, setActionMenu] = useState(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showFixedPayConfirm, setShowFixedPayConfirm] = useState(false);
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
      // Date-wise: ONLY real shifts created for the selected day!
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

  useEffect(() => {
    const handleDismiss = () => {
      if (actionMenu) setActionMenu(null);
    };
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [actionMenu]);

  const handleShiftTypeChange = (typeId) => {
    setNewShiftType(typeId);
    const found = SHIFT_TYPES.find((t) => t.id === typeId);
    if (found) {
      setNewShiftName(found.label);
      const newSlots = [
        { startTime: found.defaultStart, endTime: found.defaultEnd, capacity: parseInt(newCapacity, 10) || 10 }
      ];
      setSlotsList(newSlots);

      // If shift is after 12 AM (e.g. Late Night Shift 12:00 AM - 04:00 AM), advance date to next day
      if (typeId === "late_night" || isAfterMidnightTime(typeId, newSlots)) {
        setTargetDate(getNextDayString(selectedDate || getTodayString()));
      } else {
        if (targetDate === getNextDayString(selectedDate || getTodayString())) {
          setTargetDate(selectedDate || getTodayString());
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

    if (field === "startTime" && index === 0) {
      const mins = parseTimeToMinutes(value);
      if (mins >= 0 && mins < 300) {
        const baseDate = selectedDate || getTodayString();
        if (targetDate === baseDate) {
          setTargetDate(getNextDayString(baseDate));
        }
      }
    }
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    setShowFixedPayConfirm(true);
  };

  const confirmCreateShift = async () => {
    setShowFixedPayConfirm(false);
    let finalTargetDate = targetDate;
    const isAfterMidnight = isAfterMidnightTime(newShiftType, slotsList);
    const baseDate = selectedDate || getTodayString();
    if (isAfterMidnight && recurrenceMode === "single_day" && targetDate === baseDate) {
      finalTargetDate = getNextDayString(baseDate);
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
        targetDate: finalTargetDate,
        daysOfWeek: selectedDaysOfWeek,
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

  // Flatten all slots across shifts for clean row-by-row rendering
  const allSlotRows = shifts.flatMap((shift) =>
    (shift.slots || []).map((slot, index) => {
      const slotDate = slot.dateString || shift.dateString;
      return {
        ...slot,
        parentShift: shift,
        dateString: slotDate,
        shiftName: shift.name || shift.shiftName || slot.shiftName || "Shift",
        uniqueRowKey: `${shift._id || shift.id || "shift"}-${slot._id || slot.id || slot.slotId || index}`,
      };
    })
  );

  const getSlotCategory = (slot) => {
    if (slot.isLive || slot.lifecycle === "current" || slot.statusLabel === "Live" || slot.statusLabel === "In Progress") {
      return "active";
    }
    if (slot.isExpired || slot.lifecycle === "past" || slot.statusLabel === "Expired") {
      return "expired";
    }
    return "upcoming";
  };

  const activeCount = allSlotRows.filter((r) => getSlotCategory(r) === "active").length;
  const upcomingCount = allSlotRows.filter((r) => getSlotCategory(r) === "upcoming").length;
  const expiredCount = allSlotRows.filter((r) => getSlotCategory(r) === "expired").length;
  const availableCount = allSlotRows.filter(
    (r) => (Number(r.capacity) || 0) > (Number(r.bookedCount) || 0) && getSlotCategory(r) !== "expired"
  ).length;

  const shiftTypeCounts = {
    early_morning: allSlotRows.filter((r) => getShiftTypeTheme(r).key === "early_morning").length,
    morning: allSlotRows.filter((r) => getShiftTypeTheme(r).key === "morning").length,
    afternoon: allSlotRows.filter((r) => getShiftTypeTheme(r).key === "afternoon").length,
    evening: allSlotRows.filter((r) => getShiftTypeTheme(r).key === "evening").length,
    night: allSlotRows.filter((r) => getShiftTypeTheme(r).key === "night").length,
    late_night: allSlotRows.filter((r) => getShiftTypeTheme(r).key === "late_night").length,
  };

  const availableShiftTypes = [
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
  ].filter((t) => t.count > 0);

  const filteredSlotRows = allSlotRows.filter((row) => {
    const shiftTheme = getShiftTypeTheme(row);
    const category = getSlotCategory(row);

    // 1. Category Tab Filter
    if (activeFilterTab === "available") {
      const isAvailable =
        (Number(row.capacity) || 0) > (Number(row.bookedCount) || 0) && category !== "expired";
      if (!isAvailable) return false;
    } else if (activeFilterTab === "active" || activeFilterTab === "upcoming" || activeFilterTab === "expired") {
      if (category !== activeFilterTab) return false;
    } else if (activeFilterTab !== "all") {
      if (shiftTheme.key !== activeFilterTab) return false;
    }
    // 2. Zone Filter
    if (selectedZone !== "all") {
      if (row.zone && row.zone !== selectedZone) return false;
      if (row.parentShift?.zone && row.parentShift.zone !== selectedZone) return false;
    }
    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const shiftName = (row.shiftName || "").toLowerCase();
      const matchShift = shiftName.includes(q);
      const matchRider = (row.bookings || []).some(
        (b) =>
          (b.deliveryPartnerName || "").toLowerCase().includes(q) ||
          (b.deliveryPartnerPhone || "").toLowerCase().includes(q)
      );
      if (!matchShift && !matchRider) return false;
    }
    return true;
  });

  // Sort rows: Active first, Upcoming second, Expired ALWAYS at the very bottom (last row)!
  filteredSlotRows.sort((a, b) => {
    if (activeFilterTab === "available") {
      const remA = (Number(a.capacity) || 0) - (Number(a.bookedCount) || 0);
      const remB = (Number(b.capacity) || 0) - (Number(b.bookedCount) || 0);
      return remB - remA;
    }

    const catA = getSlotCategory(a);
    const catB = getSlotCategory(b);

    // Expired shifts ALWAYS go to the end / last rows
    const order = { active: 1, upcoming: 2, expired: 3 };
    const diff = (order[catA] || 2) - (order[catB] || 2);
    if (diff !== 0) return diff;

    // Within the same status category, sort chronologically by time
    const startA = parseTimeToMinutes(a.startTime);
    const startB = parseTimeToMinutes(b.startTime);
    return startA - startB;
  });

  const pagination = usePagination(filteredSlotRows, {
    resetDeps: [selectedDate, activeFilterTab, selectedZone, searchQuery],
  });

  return (
    <PageShell>
      {toast && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-xs flex items-center gap-2">
          <span>⚡</span>
          <span>{toast}</span>
        </div>
      )}

      {/* STATUS DOTS SUMMARY & ADD SHIFT BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white p-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Active status dot (Green blinking pulse animation) */}
          <button
            type="button"
            onClick={() => setActiveFilterTab(activeFilterTab === "active" ? "all" : "active")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${
              activeFilterTab === "active"
                ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500/20"
                : "border-slate-200/80 bg-slate-50/60 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/30"
            }`}
            title="Filter by Active Shifts"
          >
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            <span className="font-bold text-emerald-700">Active</span>
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.2 text-[11px] font-bold text-emerald-900">{activeCount}</span>
          </button>

          {/* Upcoming status dot (Black loading animation 3 dots) */}
          <button
            type="button"
            onClick={() => setActiveFilterTab(activeFilterTab === "upcoming" ? "all" : "upcoming")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${activeFilterTab === "upcoming"
              ? "border-slate-800 bg-slate-100 text-slate-900 ring-1 ring-slate-800/20"
              : "border-slate-200/80 bg-slate-50/60 text-slate-700 hover:border-slate-400 hover:bg-slate-100/50"
              }`}
            title="Filter by Upcoming Shifts"
          >
            <span className="inline-flex items-center gap-1 py-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-black animate-bounce" style={{ animationDuration: "1s", animationDelay: "0ms" }} />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-black animate-bounce" style={{ animationDuration: "1s", animationDelay: "200ms" }} />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-black animate-bounce" style={{ animationDuration: "1s", animationDelay: "400ms" }} />
            </span>
            <span>Upcoming</span>
            <span className="rounded-md bg-slate-200 px-1.5 py-0.2 text-[11px] font-bold text-slate-900">{upcomingCount}</span>
          </button>

          {/* Expired status dot (Grey dot) */}
          <button
            type="button"
            onClick={() => setActiveFilterTab(activeFilterTab === "expired" ? "all" : "expired")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${activeFilterTab === "expired"
              ? "border-slate-400 bg-slate-200 text-slate-900 ring-1 ring-slate-400/30"
              : "border-slate-200/80 bg-slate-100/90 text-slate-700 hover:border-slate-300 hover:bg-slate-200/60"
              }`}
            title="Filter by Expired Shifts"
          >
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span>Expired</span>
            <span className="rounded-md bg-slate-200 px-1.5 py-0.2 text-[11px] font-bold text-slate-800">{expiredCount}</span>
          </button>
        </div>

        {/* Add Shift Action Button */}
        <Link
          to="/shifts/create"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#064e3b] bg-[#064e3b] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#053d2e] transition cursor-pointer shrink-0"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Shift</span>
        </Link>
      </div>

      {/* FILTER TABS & CONTROLS ROW */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pt-1">
        {/* Segmented Filter Pills (Shift Types & All Shifts) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilterTab("all")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer border ${activeFilterTab === "all"
              ? "bg-[#064e3b] text-white border-[#064e3b] shadow-xs"
              : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200/80"
              }`}
          >
            <span>All Shifts</span>
            <span
              className={`rounded px-1.5 py-0.2 text-[10px] ${activeFilterTab === "all" ? "bg-white/20 text-white font-bold" : "bg-slate-200 text-slate-700 font-semibold"
                }`}
            >
              {allSlotRows.length}
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
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${isSelected
                  ? "ring-2 ring-emerald-600 border-emerald-700 shadow-sm"
                  : "border-black/10 hover:opacity-90"
                  }`}
              >
                <span className={`h-2 w-2 rounded-full ${type.dot}`} />
                <span>{type.label}</span>
                <span
                  className={`rounded px-1.5 py-0.2 text-[10px] ${type.isDark
                    ? "bg-white/20 text-white font-bold"
                    : "bg-black/10 text-slate-900 font-bold"
                    }`}
                >
                  {type.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side controls: Date Picker, Zone dropdown, Search input — all in the same line */}
        <div className="flex flex-nowrap items-center gap-2">
          {/* Date Picker Button / Input */}
          <div className="relative inline-flex items-center shrink-0">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 transition pointer-events-none whitespace-nowrap">
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{selectedDateObj.ddmmyyyy || selectedDateObj.formatted || selectedDate}</span>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Select Date"
            />
          </div>

          {/* Zone Dropdown */}
          <div className="relative inline-flex items-center shrink-0">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 transition pointer-events-none whitespace-nowrap">
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{selectedZone === "all" ? "All Zones" : selectedZone}</span>
              <svg className="h-3 w-3 text-slate-400 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            >
              <option value="all">All Zones</option>
              <option value="Zone 1 - Hinjewadi">Zone 1 - Hinjewadi</option>
              <option value="Zone 2 - Baner">Zone 2 - Baner</option>
              <option value="Zone 3 - Wakad">Zone 3 - Wakad</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative flex items-center min-w-[150px] sm:w-44 md:w-52">
            <svg className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by rider or shift..."
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
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
          {error}
        </div>
      )}

      {/* SHIFTS TABLE CONTAINER */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-400">Loading shifts data...</div>
        ) : filteredSlotRows.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <p className="text-2xl">📅</p>
            <p className="text-sm font-bold text-slate-700">No shifts match your filter.</p>
            <p className="text-xs text-slate-400">
              Try switching tabs or click &quot;+ Create Shift&quot;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8fafc] border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3.5 whitespace-nowrap">SHIFT</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">DATE</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">TIME</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">RIDERS</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">STATUS</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">ASSIGNED</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pageRows.map((row) => {
                  const rowCategory = getSlotCategory(row);
                  const isExpired = rowCategory === "expired";
                  const slotDateObj = formatDateWithDay(row.dateString);
                  const durationText = getDurationText(row.startTime, row.endTime);
                  const theme = isExpired ? SHIFT_PALETTE.expired : getShiftTypeTheme(row);
                  const isDark = !isExpired && theme.isDark;

                  return (
                    <tr
                      key={row.uniqueRowKey}
                      style={{ backgroundColor: isExpired ? "#E2E8F0" : theme.hex }}
                      className={`${theme.borderClass} ${isDark ? "text-white" : isExpired ? "text-slate-700" : "text-slate-900"
                        } transition border-b border-black/10 cursor-pointer hover:opacity-95`}
                      onClick={() => handleOpenSlotDetails(row.id || row.slotId)}
                    >
                      {/* SHIFT */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className={`font-bold text-xs sm:text-sm ${isDark ? "text-white" : isExpired ? "text-slate-600" : "text-slate-900"}`}>
                          {row.shiftName || "Shift"}
                        </p>
                      </td>

                      {/* DATE */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`font-semibold text-xs block ${isDark ? "text-white" : isExpired ? "text-slate-700" : "text-slate-800"}`}>
                          {slotDateObj.formatted}
                        </span>
                        <span className={`text-[11px] block mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                          ({slotDateObj.dayName})
                        </span>
                      </td>

                      {/* TIME */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`font-semibold text-xs block ${isDark ? "text-white" : isExpired ? "text-slate-700" : "text-slate-800"}`}>
                          {row.startTime} – {row.endTime}
                        </span>
                        <span className={`text-[11px] block mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                          ({durationText})
                        </span>
                      </td>

                      {/* RIDERS */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <svg className={`h-4.5 w-4.5 shrink-0 ${isDark ? "text-slate-200" : isExpired ? "text-slate-500" : "text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <div className="flex flex-col leading-tight">
                            <span className={`font-bold text-xs ${isDark ? "text-white" : isExpired ? "text-slate-700" : "text-slate-900"}`}>
                              {row.bookedCount || 0}
                            </span>
                            <span className={`text-[10px] font-medium ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                              of {row.capacity}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* STATUS (PULSE GREEN FOR ACTIVE, 3 BLACK LOADING DOTS FOR UPCOMING, GREY FOR EXPIRED - ICON/ANIMATION ONLY) */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {rowCategory === "active" && (
                          <span className="inline-flex items-center" title="Active Shift">
                            <span className="relative flex h-3 w-3 items-center justify-center">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
                            </span>
                          </span>
                        )}
                        {rowCategory === "upcoming" && (
                          <span className="inline-flex items-center gap-1 py-0.5" title="Upcoming Shift">
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
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center" title="Expired Shift">
                            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                          </span>
                        )}
                      </td>

                      {/* ASSIGNED */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {(row.bookedCount || 0) > 0 ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <svg className={`h-4 w-4 ${isDark ? "text-slate-300" : "text-slate-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                              {row.bookedCount} assigned
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSlotDetails(row.id || row.slotId);
                              }}
                              className={`${isDark ? "text-emerald-300 hover:text-white" : "text-emerald-700 hover:text-emerald-800"} font-semibold underline ml-1 cursor-pointer`}
                            >
                              View
                            </button>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-1.5 text-xs ${isDark ? "text-slate-400" : "text-slate-400"}`}>
                            <svg className={`h-4 w-4 ${isDark ? "text-slate-400" : "text-slate-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>-</span>
                          </div>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenSlotDetails(row.id || row.slotId)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${isDark
                              ? "bg-white/15 border border-white/30 text-white hover:bg-white/25"
                              : "bg-white border border-emerald-600/30 text-emerald-700 hover:bg-emerald-50/70"
                              }`}
                          >
                            View Details
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (actionMenu?.key === row.uniqueRowKey) {
                                setActionMenu(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActionMenu({
                                  key: row.uniqueRowKey,
                                  row,
                                  top: rect.bottom + 4,
                                  right: window.innerWidth - rect.right,
                                });
                              }
                            }}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${isDark ? "text-slate-300 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              }`}
                          >
                            ⋮
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && <Pagination pagination={pagination} className="px-4" />}
      </div>

      {/* FLOATING ACTION DROPDOWN (Outside overflow container so it is NEVER clipped) */}
      {actionMenu && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/5"
            onClick={() => setActionMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              top: `${actionMenu.top}px`,
              right: `${actionMenu.right}px`,
            }}
            className="z-50 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-2xl ring-1 ring-black/5 divide-y divide-slate-100 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {getSlotCategory(actionMenu.row) !== "expired" && actionMenu.row.status !== "CANCELLED" && (
              <button
                type="button"
                onClick={() => {
                  const targetRow = actionMenu.row;
                  setActionMenu(null);
                  setAssignSlot({
                    ...targetRow,
                    dateString: targetRow.dateString || targetRow.parentShift?.dateString,
                    assignedRiderIds: (targetRow.bookings || [])
                      .filter((b) => b.status !== "CANCELLED")
                      .map((b) => b.deliveryPartnerId),
                  });
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
              >
                <span className="text-emerald-600 font-bold text-sm leading-none">+</span>
                <span>Assign Riders</span>
              </button>
            )}
            {getSlotCategory(actionMenu.row) !== "expired" && (
              <button
                type="button"
                onClick={() => {
                  const targetRow = actionMenu.row;
                  setActionMenu(null);
                  setEditingSlot(targetRow);
                  setEditCapacity(targetRow.capacity);
                  setEditStatus(targetRow.status);
                  setEditStartTime(targetRow.startTime);
                  setEditEndTime(targetRow.endTime);
                  setEditIncentiveMode(targetRow.incentiveMode || "none");
                  setEditIncentiveRate(targetRow.incentiveRate || "");
                  setEditIncentiveAfterKm(targetRow.incentiveAfterKm || "");
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <span>✏️</span>
                <span>Edit Slot</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const targetRow = actionMenu.row;
                setActionMenu(null);
                handleDeleteSlot(targetRow, targetRow.parentShift);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <span>🗑️</span>
              <span>Delete Shift</span>
            </button>
          </div>
        </>
      )}

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

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-900">
                Rider salary or KM commission is fixed in Rider Payment Settings. Creating this shift will not change the rider&apos;s payment amount.
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
                      className={`rounded-lg py-2 text-xs font-bold border transition-all ${recurrenceMode === rec.id
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
                    {isAfterMidnightTime(newShiftType, slotsList) && (
                      <p className="mt-1.5 text-[11px] font-semibold text-purple-700 flex items-center gap-1">
                        <span>🌙 Shift after 12:00 AM — Scheduled for Next Day: {formatDateWithDay(targetDate).formatted || targetDate}</span>
                      </p>
                    )}
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
                            className={`h-8 w-10 rounded-lg text-xs font-bold transition-all ${active ? "bg-emerald-600 text-white" : "bg-white text-slate-600 border border-slate-200"
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

      {showFixedPayConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="fixed-shift-pay-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="fixed-shift-pay-title" className="text-base font-bold text-slate-900">Rider payment amount is fixed</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Salary or KM commission is already set in Rider Payment Settings. This shift will not change those amounts.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowFixedPayConfirm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Review shift</button>
              <button type="button" disabled={isSubmitting} onClick={confirmCreateShift} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{isSubmitting ? "Creating…" : "Confirm & Create Shift"}</button>
            </div>
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
