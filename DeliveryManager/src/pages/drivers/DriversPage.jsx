import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "../../components/ui/Icon";
import { useLive } from "../../realtime/useLive";
import { subscribeToSocketEvent } from "../../services/socket";

const EMPTY = {
  name: "",
  phone: "",
  password: "",
  employmentType: "FULL_TIME",
  paymentMode: "monthly_salary",
  amount: "",
};

export default function DriversPage({ employmentType = null }) {
  const navigate = useNavigate();
  const { manager } = useAuth();
  const [riders, setRiders] = useState([]);
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    employmentType: employmentType || "FULL_TIME",
    paymentMode: employmentType === "PART_TIME" ? "per_km_commission" : "monthly_salary",
    amount: "",
  }));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState(employmentType || "ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [slotFilter, setSlotFilter] = useState("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");

  // Slots tracking
  const [assignedSlotRiderIds, setAssignedSlotRiderIds] = useState(() => new Set());
  const [assignedSlotsToday, setAssignedSlotsToday] = useState(null);

  // Interactive Payment Popover state
  const [openPaymentPopoverId, setOpenPaymentPopoverId] = useState(null);
  const [editPaymentMode, setEditPaymentMode] = useState("monthly_salary");
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentActive, setEditPaymentActive] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [bulkPaymentMode, setBulkPaymentMode] = useState(employmentType === "PART_TIME" ? "per_km_commission" : "monthly_salary");
  const [bulkPaymentAmount, setBulkPaymentAmount] = useState("");
  const [bulkPaymentActive, setBulkPaymentActive] = useState(true);
  const [savingBulkPayment, setSavingBulkPayment] = useState(false);

  // Actions menu state
  const [openActionId, setOpenActionId] = useState(null);

  const popoverRef = useRef(null);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpenPaymentPopoverId(null);
        setOpenActionId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setTypeFilter(employmentType || "ALL");
    setForm({
      ...EMPTY,
      employmentType: employmentType || "FULL_TIME",
      paymentMode: employmentType === "PART_TIME" ? "per_km_commission" : "monthly_salary",
      amount: "",
    });
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setSlotFilter("ALL");
  }, [employmentType]);

  useEffect(() => {
    if (!employmentType) return undefined;
    let active = true;
    const now = new Date();
    if (employmentType === "FULL_TIME") {
      managerApi
        .getFullTimeShifts()
        .then((res) => {
          const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
          const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
          const todayShifts = (res.data?.shifts || []).filter((s) =>
            (s.workingDays || []).includes(weekday)
          );
          const count = todayShifts.reduce((n, s) => n + (s.driverIds || []).length, 0);
          if (active)
            setAssignedSlotRiderIds(new Set(todayShifts.flatMap((s) => s.driverIds || []).map(String)));
          if (active) setAssignedSlotsToday(count);
        })
        .catch(() => {
          if (active) setAssignedSlotsToday(null);
        });
    } else {
      managerApi
        .getShifts()
        .then((res) => {
          const count = (res.data?.slots || []).reduce(
            (n, slot) => n + (slot.bookings || []).filter((b) => b.status !== "CANCELLED").length,
            0
          );
          const ids = (res.data?.slots || [])
            .flatMap((slot) =>
              (slot.bookings || [])
                .filter((b) => b.status !== "CANCELLED")
                .map((b) => String(b.deliveryPartnerId || ""))
            )
            .filter(Boolean);
          if (active) setAssignedSlotRiderIds(new Set(ids));
          if (active) setAssignedSlotsToday(count);
        })
        .catch(() => {
          if (active) setAssignedSlotsToday(null);
        });
    }
    return () => {
      active = false;
    };
  }, [employmentType]);

  useEffect(() => {
    const unsub = subscribeToSocketEvent("rider_cash_updated", () => {
      load({ silent: true });
    });
    return () => unsub?.();
  }, [load]);

  // Toggle Rider Active state
  const handleToggleActive = async (rider, e) => {
    e?.stopPropagation?.();
    const riderId = rider.id || rider._id;
    const nextActive = !(rider.isActive !== false);

    // Optimistic UI update
    setRiders((prev) =>
      prev.map((r) => ((r.id || r._id) === riderId ? { ...r, isActive: nextActive } : r))
    );

    try {
      await managerApi.toggleRiderActive(riderId);
      setMessage(`Rider status set to ${nextActive ? "Active" : "Inactive"}`);
    } catch (err) {
      // Revert on failure
      setRiders((prev) =>
        prev.map((r) => ((r.id || r._id) === riderId ? { ...r, isActive: !nextActive } : r))
      );
      setError(err.response?.data?.message || "Failed to toggle rider status");
    }
  };

  // Open Payment Mode popover for a rider
  const handleOpenPaymentPopover = (rider, e) => {
    e.stopPropagation();
    const riderId = rider.id || rider._id;
    const mode =
      rider.paymentMode || (rider.employmentType === "FULL_TIME" ? "monthly_salary" : "per_km_commission");
    const amount = mode === "monthly_salary"
      ? (rider.monthlySalary == null ? "" : String(rider.monthlySalary))
      : (rider.commissionRatePerKm == null ? "" : String(rider.commissionRatePerKm));

    setEditPaymentMode(mode);
    setEditPaymentAmount(amount);
    setEditPaymentActive(rider.paymentActive !== false);
    setOpenPaymentPopoverId(riderId);
    setOpenActionId(null);
  };

  // Save Payment Configuration
  const handleSavePayment = async (rider, e) => {
    e.preventDefault();
    e.stopPropagation();
    const riderId = rider.id || rider._id;
    setSavingPayment(true);

    try {
      const isSalary = editPaymentMode === "monthly_salary";
      const payload = {
        active: editPaymentActive,
        mode: editPaymentMode,
        monthlySalary: isSalary ? Number(editPaymentAmount || 0) : 0,
        commissionRatePerKm: !isSalary ? Number(editPaymentAmount || 0) : 0,
      };

      await managerApi.setDriverPaymentConfig(riderId, payload);

      // Update state locally
      setRiders((prev) =>
        prev.map((r) =>
          (r.id || r._id) === riderId
            ? {
                ...r,
                paymentMode: editPaymentMode,
                paymentActive: editPaymentActive,
                monthlySalary: payload.monthlySalary,
                commissionRatePerKm: payload.commissionRatePerKm,
              }
            : r
        )
      );

      setMessage("Payment configuration updated successfully!");
      setOpenPaymentPopoverId(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update payment settings");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleApplyPaymentToAll = async (e) => {
    e.preventDefault();
    if (!employmentType || !categoryRiders.length || bulkPaymentAmount === "") return;
    setSavingBulkPayment(true);
    setError("");
    setMessage("");
    const isSalary = bulkPaymentMode === "monthly_salary";
    const payment = {
      employmentType,
      active: bulkPaymentActive,
      mode: bulkPaymentMode,
      monthlySalary: isSalary ? Number(bulkPaymentAmount) : undefined,
      commissionRatePerKm: isSalary ? undefined : Number(bulkPaymentAmount),
    };
    try {
      const response = await managerApi.setBulkDriverPaymentConfig(payment);
      setRiders((current) => current.map((rider) => {
        if (rider.employmentType !== employmentType) return rider;
        return {
          ...rider,
          paymentMode: bulkPaymentMode,
          paymentActive: bulkPaymentActive,
          ...(isSalary ? { monthlySalary: payment.monthlySalary } : { commissionRatePerKm: payment.commissionRatePerKm }),
        };
      }));
      const updatedCount = response.data?.updatedCount ?? categoryRiders.length;
      setMessage(`${isSalary ? "Monthly salary" : "KM commission"} applied to ${updatedCount} ${employmentType === "FULL_TIME" ? "full-time" : "part-time"} rider${updatedCount === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not apply payment settings to all riders.");
    } finally {
      setSavingBulkPayment(false);
    }
  };

  // Create Rider Submit
  const onSubmitCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const res = await managerApi.createRider({
        name: form.name,
        phone: form.phone,
        password: form.password,
        employmentType: form.employmentType,
      });

      const newRiderId = res.data?.rider?.id || res.data?.rider?._id;
      if (newRiderId && form.amount) {
        const isSalary = form.paymentMode === "monthly_salary";
        await managerApi.setDriverPaymentConfig(newRiderId, {
          active: true,
          mode: form.paymentMode,
          monthlySalary: isSalary ? Number(form.amount) : 0,
          commissionRatePerKm: !isSalary ? Number(form.amount) : 0,
        });
      }

      setMessage(res.data?.message || "Delivery partner created successfully!");
      setForm({
        ...EMPTY,
        employmentType: employmentType || "FULL_TIME",
        paymentMode: employmentType === "PART_TIME" ? "per_km_commission" : "monthly_salary",
        amount: "",
      });
      setIsCreateOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create delivery partner");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setSlotFilter("ALL");
    setBulkPaymentMode(employmentType === "PART_TIME" ? "per_km_commission" : "monthly_salary");
    setBulkPaymentAmount("");
  };

  // Category and visibility calculations
  const categoryRiders = useMemo(() => {
    if (employmentType) {
      return riders.filter((r) => (r.employmentType || "PART_TIME") === employmentType);
    }
    return typeFilter === "ALL"
      ? riders
      : riders.filter((r) => (r.employmentType || "PART_TIME") === typeFilter);
  }, [riders, employmentType, typeFilter]);

  const visibleRiders = useMemo(() => {
    return categoryRiders
      .filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          (r.name || "").toLowerCase().includes(q) ||
          (r.phone || "").toLowerCase().includes(q) ||
          String(r.id || r._id || "").toLowerCase().includes(q)
        );
      })
      .filter((r) => {
        if (statusFilter === "ALL") return true;
        if (statusFilter === "active") return r.isActive !== false;
        if (statusFilter === "inactive") return r.isActive === false;
        return r.status === statusFilter;
      })
      .filter((r) => {
        if (paymentFilter === "ALL") return true;
        const currentMode =
          r.paymentMode || (r.employmentType === "FULL_TIME" ? "monthly_salary" : "per_km_commission");
        return currentMode === paymentFilter;
      })
      .filter((r) => {
        if (slotFilter === "ALL") return true;
        const isAssigned = assignedSlotRiderIds.has(String(r.id || r._id));
        return slotFilter === "ASSIGNED" ? isAssigned : !isAssigned;
      });
  }, [categoryRiders, searchQuery, statusFilter, paymentFilter, slotFilter, assignedSlotRiderIds]);

  // Stat calculations
  const totalRidersCount = categoryRiders.length;
  const activeRidersCount = categoryRiders.filter((r) => r.isActive !== false).length;
  const activePercent = totalRidersCount > 0 ? Math.round((activeRidersCount / totalRidersCount) * 100) : 0;
  
  const totalDeliveriesRaw = categoryRiders.reduce(
    (sum, r) => sum + (Number(r.totalDelivered) || 0),
    0
  );
  const totalDeliveriesCount = totalDeliveriesRaw;

  const isFullTime = employmentType === "FULL_TIME";
  const isPartTime = employmentType === "PART_TIME";

  const totalPayableAmount = useMemo(() => {
    return categoryRiders.reduce((sum, rider) => {
      if (rider.paymentActive === false) return sum;
      const mode = rider.paymentMode || (rider.employmentType === "FULL_TIME" ? "monthly_salary" : "per_km_commission");
      if (mode === "monthly_salary") return sum + (Number(rider.monthlySalary) || 0);
      return sum + (Number(rider.totalDistanceKm) || 0) * (Number(rider.commissionRatePerKm) || 0);
    }, 0);
  }, [categoryRiders, isFullTime]);
  const configuredPaymentModes = new Set(categoryRiders.map((rider) =>
    rider.paymentMode || (rider.employmentType === "FULL_TIME" ? "monthly_salary" : "per_km_commission")
  ));
  const payableTitle = configuredPaymentModes.size === 0 || configuredPaymentModes.size > 1
    ? "Total Payment Payable"
    : configuredPaymentModes.has("monthly_salary")
    ? "Total Salary Payable"
    : "Total Commission Payable";

  const driversWithPendingCash = riders.filter((r) => (Number(r.pendingCashAmount) || 0) > 0);
  const totalRiderPendingCash = driversWithPendingCash.reduce(
    (sum, r) => sum + (Number(r.pendingCashAmount) || 0),
    0
  );

  const pageTitle = isFullTime
    ? "Full-Time Riders"
    : isPartTime
    ? "Part-Time Riders"
    : "Delivery Partners Roster";

  const pageSubtitle = isFullTime
    ? "Manage your full-time delivery riders and track performance"
    : isPartTime
    ? "Manage your part-time delivery riders and track performance"
    : "Manage all delivery partners, track attendance, and configure payouts";

  return (
    <div className="space-y-5 pb-8 font-sans" ref={popoverRef}>
      {/* SUCCESS / ERROR NOTICES */}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* CASH COLLECTION DUE WARNING (PRESERVED CRITICAL FUNCTIONALITY) */}
      {driversWithPendingCash.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-950 font-black text-sm">
                ⚠️
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-amber-950">
                  Cash Collection Due: Collect ₹{totalRiderPendingCash.toLocaleString()} from{" "}
                  {driversWithPendingCash.length} delivery partner
                  {driversWithPendingCash.length > 1 ? "s" : ""}
                </h3>
                <p className="mt-0.5 text-xs text-amber-900/80">
                  Delivery partners have collected Cash on Delivery (COD) from customers. Ensure this cash is
                  settled before end of shift.
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
                  {d.name || d.phone}:{" "}
                  <strong className="text-amber-800">
                    ₹{(Number(d.pendingCashAmount) || 0).toLocaleString()}
                  </strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BREADCRUMB */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="hover:text-emerald-700 transition"
        >
          <Icon name="home" size="sm" className="text-slate-400 hover:text-emerald-700" />
        </button>
        <span className="text-slate-400">›</span>
        <span className="hover:text-emerald-700 cursor-pointer" onClick={() => navigate("/drivers")}>
          Riders
        </span>
        <span className="text-slate-400">›</span>
        <span className="font-semibold text-slate-800">{pageTitle}</span>
      </nav>

      {/* PAGE HEADER: ICON + TITLE + CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-[#064e3b] shadow-2xs">
            <Icon name="bike" size="lg" className="text-[#064e3b]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">{pageTitle}</h1>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{pageSubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Period selector dropdown */}
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="appearance-none flex items-center gap-2 rounded-xl border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="This Month">This Month</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="All Time">All Time</option>
            </select>
            <span className="pointer-events-none absolute left-2.5 top-2.5 text-xs text-slate-500">📅</span>
            <span className="pointer-events-none absolute right-2.5 top-2.5 text-[10px] text-slate-400">⌵</span>
          </div>

          {/* Add Rider CTA button */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#064e3b] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#053d2e] transition active:scale-98 cursor-pointer"
          >
            <span className="text-sm font-bold">+</span>
            <span>Add Rider</span>
          </button>
        </div>
      </div>

      {/* 4 TOP METRIC CARDS (PIXEL-PERFECT MATCH TO SCREENSHOT) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: TOTAL RIDERS */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/90 via-emerald-50/40 to-white p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 shadow-2xs">
              <Icon name="user" size="md" className="text-emerald-800" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Total Riders</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {loading ? "…" : totalRidersCount}
              </p>
              <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                Total registered riders
              </p>
            </div>
          </div>
        </div>

        {/* CARD 2: ACTIVE RIDERS */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 shadow-2xs">
              <Icon name="check" size="md" className="text-emerald-800" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Active Riders</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {loading ? "…" : activeRidersCount}
              </p>
              <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                {activePercent}% of total
              </p>
            </div>
          </div>
        </div>

        {/* CARD 3: TOTAL DELIVERIES */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-100/90 bg-gradient-to-br from-blue-50/80 via-sky-50/30 to-white p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-2xs">
              <Icon name="bike" size="md" className="text-blue-700" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Total Deliveries</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {loading ? "…" : totalDeliveriesCount.toLocaleString()}
              </p>
              <p className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 mt-0.5">
                Completed deliveries
              </p>
            </div>
          </div>
        </div>

        {/* CARD 4: TOTAL SALARY / COMMISSION PAYABLE */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-100/90 bg-gradient-to-br from-amber-50/80 via-orange-50/30 to-white p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-2xs">
              <Icon name="wallet" size="md" className="text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">
                {payableTitle}
              </p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                ₹{loading ? "…" : totalPayableAmount.toLocaleString()}
              </p>
              <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1 mt-0.5">
                Across {categoryRiders.length} {employmentType === "FULL_TIME" ? "full-time" : "part-time"} rider{categoryRiders.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {employmentType && (
        <form onSubmit={handleApplyPaymentToAll} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Apply payment settings to all {isFullTime ? "full-time" : "part-time"} riders</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                This updates all {categoryRiders.length} riders in this group. For individual settings, use each rider’s row below.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
              {categoryRiders.length} riders
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[190px] flex-1 text-[10px] font-bold text-slate-600">
              Payment method
              <select value={bulkPaymentMode} onChange={(e) => { setBulkPaymentMode(e.target.value); setBulkPaymentAmount(""); }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none">
                <option value="monthly_salary">Monthly Salary</option>
                <option value="per_km_commission">KM-wise Commission</option>
              </select>
            </label>
            <label className="min-w-[180px] flex-1 text-[10px] font-bold text-slate-600">
              {bulkPaymentMode === "monthly_salary" ? "Monthly salary (₹)" : "Rate per KM (₹)"}
              <input type="number" min="0" step={bulkPaymentMode === "monthly_salary" ? "100" : "0.5"}
                required value={bulkPaymentAmount} onChange={(e) => setBulkPaymentAmount(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none" />
            </label>
            <label className="flex h-10 items-center gap-2 px-1 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={bulkPaymentActive} onChange={(e) => setBulkPaymentActive(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              Payment Active
            </label>
            <button type="submit" disabled={savingBulkPayment || !categoryRiders.length || bulkPaymentAmount === ""}
              className="h-10 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
              {savingBulkPayment ? "Applying…" : "Apply to All"}
            </button>
          </div>
        </form>
      )}

      {/* FILTER BAR: SEARCH + STATUS + PAYMENT TYPE + SLOTS + RESET */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
        {/* Search input */}
        <div className="relative min-w-[240px] flex-1">
          <span className="absolute left-3.5 top-3 text-slate-400">
            <Icon name="search" size="sm" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone or ID..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[130px]"
        >
          <option value="ALL">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="online">Online</option>
          <option value="on_delivery">On Delivery</option>
          <option value="offline">Offline</option>
        </select>

        {/* Payment Type dropdown */}
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[160px]"
        >
          <option value="ALL">All Payment Type</option>
          <option value="monthly_salary">Monthly Salary</option>
          <option value="per_km_commission">KM Commission</option>
        </select>

        {/* Slots dropdown */}
        <select
          value={slotFilter}
          onChange={(e) => setSlotFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[120px]"
        >
          <option value="ALL">All Slots</option>
          <option value="ASSIGNED">Assigned Today</option>
          <option value="UNASSIGNED">No Slot Today</option>
        </select>

        {/* Reset button */}
        <button
          type="button"
          onClick={handleResetFilters}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
        >
          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Reset</span>
        </button>
      </div>

      {/* RIDERS TABLE (EXACT VISUAL MATCH TO SCREENSHOT) */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-slate-200/60 animate-pulse" />
      ) : (
        <div className="overflow-visible rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[980px]">
              <thead className="bg-[#ecfdf5] border-b border-emerald-100 text-[11px] font-bold text-slate-700 tracking-wider">
                <tr>
                  <th className="w-12 px-4 py-3.5 text-center">#</th>
                  <th className="px-4 py-3.5">Rider Details</th>
                  <th className="px-4 py-3.5">Employment Type</th>
                  <th className="px-4 py-3.5 min-w-[190px]">Payment Method</th>
                  <th className="px-4 py-3.5 min-w-[300px]">Payment Amount</th>
                  <th className="px-4 py-3.5">Total Deliveries</th>
                  <th className="px-4 py-3.5">Total KM</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleRiders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs font-semibold text-slate-400">
                      No delivery partners match this criteria.
                    </td>
                  </tr>
                ) : (
                  visibleRiders.map((r, index) => {
                    const riderId = r.id || r._id;
                    const isRiderActive = r.isActive !== false;
                    const riderType = r.employmentType || "PART_TIME";
                    const isTypeFullTime = riderType === "FULL_TIME";

                    const currentMode =
                      r.paymentMode || (isTypeFullTime ? "monthly_salary" : "per_km_commission");
                    const isPaymentPopoverOpen = openPaymentPopoverId === riderId;
                    const displayedMode = isPaymentPopoverOpen ? editPaymentMode : currentMode;
                    const isSalaryMode = displayedMode === "monthly_salary";

                    const deliveries = Number(r.totalDelivered) || 0;
                    const totalKm = Number(r.totalDistanceKm) || 0;

                    const isActionMenuOpen = openActionId === riderId;

                    return (
                      <tr
                        key={riderId}
                        onClick={() => navigate(`/drivers/${riderId}`)}
                        className="hover:bg-slate-50/80 cursor-pointer transition"
                      >
                        {/* 1. # */}
                        <td className="px-4 py-4 text-center font-bold text-slate-700">
                          {index + 1}
                        </td>

                        {/* 2. Rider Details */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800 text-xs overflow-hidden">
                              {r.selfie ? (
                                <img
                                  src={r.selfie}
                                  alt={r.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{(r.name || "R").charAt(0).toUpperCase()}</span>
                              )}
                              <span
                                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                                  isRiderActive
                                    ? r.status === "online"
                                      ? "bg-emerald-500"
                                      : r.status === "on_delivery"
                                      ? "bg-amber-500"
                                      : "bg-emerald-600"
                                    : "bg-slate-400"
                                }`}
                              />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm hover:text-emerald-700 transition">
                                {r.name || "Rider"}
                              </p>
                              <p className="font-mono text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                <span>📞</span>
                                <span>{r.phone || "—"}</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 3. Employment Type */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {isTypeFullTime ? (
                            <span className="inline-flex items-center rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-2xs">
                              Full-Time
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200 shadow-2xs">
                              Part-Time
                            </span>
                          )}
                        </td>

                        {/* 4. Payment method selector */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <select
                            aria-label={`Payment method for ${r.name || "rider"}`}
                            value={isPaymentPopoverOpen ? editPaymentMode : currentMode}
                            onFocus={(e) => handleOpenPaymentPopover(r, e)}
                            onChange={(e) => {
                              const nextMode = e.target.value;
                              setEditPaymentMode(nextMode);
                              setEditPaymentAmount(nextMode === "monthly_salary"
                                ? (r.monthlySalary == null ? "" : String(r.monthlySalary))
                                : (r.commissionRatePerKm == null ? "" : String(r.commissionRatePerKm)));
                            }}
                            className="h-9 min-w-[175px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="monthly_salary">Monthly Salary</option>
                            <option value="per_km_commission">KM-wise Commission</option>
                          </select>
                        </td>

                        {/* 5. Amount, payment activation and save */}
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex min-w-[290px] items-center gap-2">
                            <label className="flex min-w-[135px] flex-1 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs focus-within:border-emerald-500">
                              <span className="font-bold text-slate-500">₹</span>
                              <input
                                aria-label={isSalaryMode ? "Monthly salary amount" : "Commission per kilometre"}
                                type="number" min="0" step={isSalaryMode ? "100" : "0.5"}
                                value={isPaymentPopoverOpen ? editPaymentAmount : (isSalaryMode ? (r.monthlySalary ?? "") : (r.commissionRatePerKm ?? ""))}
                                onFocus={(e) => handleOpenPaymentPopover(r, e)}
                                onChange={(e) => setEditPaymentAmount(e.target.value)}
                                className="w-full min-w-0 bg-transparent font-bold text-slate-900 focus:outline-none"
                              />
                              <span className="whitespace-nowrap text-[10px] text-slate-500">{isSalaryMode ? "/ Month" : "/ KM"}</span>
                            </label>
                            <label className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-slate-700">
                              <input type="checkbox" checked={isPaymentPopoverOpen ? editPaymentActive : r.paymentActive !== false}
                                onFocus={(e) => handleOpenPaymentPopover(r, e)}
                                onChange={(e) => setEditPaymentActive(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                              Active
                            </label>
                            <button type="button" disabled={savingPayment} onClick={(e) => handleSavePayment(r, e)}
                              className="h-8 rounded-lg bg-emerald-700 px-2.5 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60">
                              {savingPayment && isPaymentPopoverOpen ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </td>

                        {/* 6. Total Deliveries */}
                        <td className="px-4 py-3.5 font-semibold text-slate-700 whitespace-nowrap">
                          {deliveries}
                        </td>

                        {/* 7. Total KM */}
                        <td className="px-4 py-3.5 font-semibold text-slate-700 whitespace-nowrap">
                          {totalKm} km
                        </td>

                        {/* 8. Status (Interactive Toggle Switch) */}
                        <td
                          className="px-4 py-3.5 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleToggleActive(r, e)}
                              className="group relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none"
                              style={{
                                backgroundColor: isRiderActive ? "#064e3b" : "#cbd5e1",
                              }}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ${
                                  isRiderActive ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs ${
                                isRiderActive ? "font-bold text-emerald-700" : "font-medium text-slate-500"
                              }`}
                            >
                              {isRiderActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>

                        {/* 9. Actions (Three Dots Popover) */}
                        <td
                          className="px-4 py-3.5 text-center whitespace-nowrap relative"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionId(isActionMenuOpen ? null : riderId)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                          >
                            <span className="text-base font-bold">⋮</span>
                          </button>

                          {isActionMenuOpen && (
                            <div className="absolute right-4 top-full z-50 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl text-left">
                              <button
                                type="button"
                                onClick={() => navigate(`/drivers/${riderId}`)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                              >
                                <span>👤</span>
                                <span>View Details</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/drivers/${riderId}?tab=shifts`)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                              >
                                <span>📅</span>
                                <span>Shift Bookings</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/drivers/${riderId}?tab=documents`)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                              >
                                <span>📋</span>
                                <span>KYC Documents</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE RIDER MODAL (MATCHING CLEAN POPUP DESIGN) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New Delivery Partner</h3>
                <p className="text-xs text-slate-500">
                  Register new rider credentials bound to {manager?.area || "Dark Store Hub"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmitCreate} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Mobile Number
                    </label>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="e.g. 9876543210"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Temporary Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Min 6 characters"
                      minLength={6}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Employment Type
                    </label>
                    <select
                      name="employmentType"
                      value={form.employmentType}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          employmentType: e.target.value,
                          paymentMode:
                            e.target.value === "PART_TIME"
                              ? "per_km_commission"
                              : "monthly_salary",
                          amount: "",
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                    >
                      <option value="FULL_TIME">Full-Time</option>
                      <option value="PART_TIME">Part-Time</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Payment Mode
                    </label>
                    <select
                      name="paymentMode"
                      value={form.paymentMode}
                      onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                    >
                      <option value="monthly_salary">Monthly Salary</option>
                      <option value="per_km_commission">KM Commission</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {form.paymentMode === "monthly_salary"
                      ? "Monthly Salary (₹)"
                      : "Commission Rate (₹ / KM)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={form.paymentMode === "monthly_salary" ? "100" : "0.5"}
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder={
                      form.paymentMode === "monthly_salary" ? "e.g. 18000" : "e.g. 5"
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
                  className="rounded-xl bg-[#064e3b] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#053d2e] disabled:opacity-60 transition cursor-pointer"
                >
                  {submitting ? "Creating Rider…" : "Create Rider Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
