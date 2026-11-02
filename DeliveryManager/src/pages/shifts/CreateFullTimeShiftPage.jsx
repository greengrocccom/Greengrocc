import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../../components/layout/ManagerLayout";
import { managerApi } from "../../api/managerApi";
import {
  DayPicker,
  apiError,
  formatMoney,
  inputCls,
  labelCls,
  to24h,
} from "../fulltime/fullTimeUi";

const EMPTY = {
  name: "Full-Time Day Shift",
  startTime: "09:00",
  endTime: "18:00",
  workingDays: [1, 2, 3, 4, 5, 6],
  requireAttendance: true,
  requireLocationValidation: true,
  attendanceRadiusMeters: "",
  compulsoryDailyOnlineHours: "",
  notes: "",
  driverIds: [],
  monthlySalary: "",
  leavePolicyEnabled: false,
  paidLeavesPerMonth: 2,
  unpaidLeaveDeductionPerDay: "",
  latePenaltyEnabled: false,
  lateAfterHours: 2,
  lateAfterMins: 0,
  latePenaltyAmount: "",
};

const formatLateThreshold = (h, m) =>
  [Number(h) ? `${Number(h)} hr${Number(h) > 1 ? "s" : ""}` : "", Number(m) ? `${Number(m)} min` : ""]
    .filter(Boolean)
    .join(" ") || "0 min";

export default function CreateFullTimeShiftPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [drivers, setDrivers] = useState([]);
  const [storeSalary, setStoreSalary] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [driversRes, shiftsRes, configRes] = await Promise.all([
          managerApi.getFullTimeDrivers(),
          isEdit ? managerApi.getFullTimeShifts() : Promise.resolve(null),
          managerApi.getFullTimeConfig().catch(() => null),
        ]);
        if (cancelled) return;
        setDrivers(driversRes.data.drivers || []);
        setStoreSalary(Number(configRes?.data?.fullTimeMonthlySalary) || 0);
        if (isEdit) {
          const shift = (shiftsRes?.data.shifts || []).find((s) => s.id === id);
          if (!shift) {
            setError("Full-Time shift not found");
          } else {
            setForm({
              name: shift.name,
              startTime: to24h(shift.startTime),
              endTime: to24h(shift.endTime),
              workingDays: shift.workingDays || [],
              requireAttendance: shift.requireAttendance,
              requireLocationValidation: shift.requireLocationValidation,
              attendanceRadiusMeters: shift.attendanceRadiusMeters ?? "",
              compulsoryDailyOnlineHours: shift.compulsoryDailyOnlineHours ?? "",
              notes: shift.notes || "",
              driverIds: shift.driverIds || [],
              monthlySalary: shift.monthlySalary ?? "",
              leavePolicyEnabled: Boolean(shift.leavePolicyEnabled),
              paidLeavesPerMonth: shift.paidLeavesPerMonth ?? 0,
              unpaidLeaveDeductionPerDay: shift.unpaidLeaveDeductionPerDay ?? "",
              latePenaltyEnabled: Boolean(shift.latePenaltyEnabled),
              lateAfterHours: Math.floor((shift.lateAfterMinutes ?? 120) / 60),
              lateAfterMins: (shift.lateAfterMinutes ?? 120) % 60,
              latePenaltyAmount: shift.latePenaltyAmount || "",
            });
          }
        }
      } catch (err) {
        if (!cancelled) setError(apiError(err, "Failed to load data"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggleDriver = (driverId) =>
    set(
      "driverIds",
      form.driverIds.includes(driverId)
        ? form.driverIds.filter((d) => d !== driverId)
        : [...form.driverIds, driverId]
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.workingDays.length) {
      setError("Select at least one working day");
      return;
    }
    const lateAfterMinutes = Number(form.lateAfterHours || 0) * 60 + Number(form.lateAfterMins || 0);
    if (form.latePenaltyEnabled) {
      if (lateAfterMinutes < 1) {
        setError("Set how late (hours / minutes) before the penalty applies");
        return;
      }
      if (!(Number(form.latePenaltyAmount) > 0)) {
        setError("Enter the amount to cut for late attendance");
        return;
      }
    }
    setSaving(true);
    setError("");
    const { lateAfterHours, lateAfterMins, ...rest } = form;
    const payload = {
      ...rest,
      attendanceRadiusMeters:
        form.attendanceRadiusMeters === "" ? null : Number(form.attendanceRadiusMeters),
      compulsoryDailyOnlineHours:
        form.compulsoryDailyOnlineHours === "" ? null : Number(form.compulsoryDailyOnlineHours),
      monthlySalary: form.monthlySalary === "" ? null : Number(form.monthlySalary),
      paidLeavesPerMonth: Number(form.paidLeavesPerMonth || 0),
      unpaidLeaveDeductionPerDay:
        form.unpaidLeaveDeductionPerDay === "" ? null : Number(form.unpaidLeaveDeductionPerDay),
      lateAfterMinutes: lateAfterMinutes || 120,
      latePenaltyAmount: Number(form.latePenaltyAmount || 0),
    };
    try {
      if (isEdit) await managerApi.updateFullTimeShift(id, payload);
      else await managerApi.createFullTimeShift(payload);
      navigate("/shifts/fulltime");
    } catch (err) {
      setError(apiError(err, "Failed to save shift"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      title={isEdit ? "Edit Full-Time Shift" : "Create Full-Time Shift"}
    >
      <div className="flex items-center gap-3">
        <Link
          to="/shifts/fulltime"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          ← Back
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs font-semibold text-slate-400">Loading…</div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Shift Name</label>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start Time</label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>End Time</label>
              <input
                type="time"
                required
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Working Days</label>
            <DayPicker value={form.workingDays} onChange={(v) => set("workingDays", v)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={form.requireAttendance}
                onChange={(e) => set("requireAttendance", e.target.checked)}
              />
              Attendance required
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={form.requireLocationValidation}
                onChange={(e) => set("requireLocationValidation", e.target.checked)}
              />
              Must be at dark store (GPS)
            </label>
            <div>
              <input
                type="number"
                min="10"
                placeholder="Radius (m) — blank uses rule default"
                value={form.attendanceRadiusMeters}
                onChange={(e) => set("attendanceRadiusMeters", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <input
                type="number"
                min="1"
                max="24"
                step="0.5"
                placeholder="Compulsory Daily Online Hours (e.g. 8)"
                value={form.compulsoryDailyOnlineHours}
                onChange={(e) => set("compulsoryDailyOnlineHours", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <SalaryLeaveSection form={form} set={set} storeSalary={storeSalary} />

          <div>
            <label className={labelCls}>Applicable Full-Time Drivers</label>
            {drivers.length === 0 ? (
              <p className="text-xs text-slate-500">No Full-Time drivers yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {drivers.map((d) => {
                  const otherShift = d.shift && d.shift.id !== id ? d.shift.name : null;
                  return (
                    <label
                      key={d.id}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                        form.driverIds.includes(d.id)
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={form.driverIds.includes(d.id)}
                        onChange={() => toggleDriver(d.id)}
                      />
                      <span>
                        <span className="block font-bold text-slate-900">{d.name}</span>
                        <span className="block text-slate-500">{d.phone}</span>
                        {otherShift && (
                          <span className="block text-[10px] font-semibold text-amber-700">
                            Currently on “{otherShift}” — will be moved
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            <Link
              to="/shifts/fulltime"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Full-Time Shift"}
            </button>
          </div>
        </form>
      )}
    </PageShell>
  );
}

function SalaryLeaveSection({ form, set, storeSalary }) {
  const salary = form.monthlySalary === "" ? storeSalary : Number(form.monthlySalary) || 0;
  const daysPerMonth = Math.round((form.workingDays.length || 0) * 4.33);
  const autoPerDay = daysPerMonth ? Math.round(salary / daysPerMonth) : 0;
  const perDay =
    form.unpaidLeaveDeductionPerDay === "" ? autoPerDay : Number(form.unpaidLeaveDeductionPerDay) || 0;
  const paid = Number(form.paidLeavesPerMonth) || 0;
  const lateLabel = formatLateThreshold(form.lateAfterHours, form.lateAfterMins);
  const toggleCls =
    "flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none";

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Salary &amp; Leave Policy</h3>
        <p className="text-[11px] text-slate-500">
          All optional. Drivers on this shift see these rules and their salary breakdown in the Delivery App.
        </p>
      </div>

      <div className="max-w-xs">
        <label className={labelCls}>Monthly Salary (₹)</label>
        <input
          type="number"
          min="0"
          step="100"
          placeholder={`Blank = store salary (${formatMoney(storeSalary)})`}
          value={form.monthlySalary}
          onChange={(e) => set("monthlySalary", e.target.value)}
          className={inputCls}
        />
        <p className="mt-1 text-[10px] text-slate-400">A driver&apos;s personal salary override still takes priority.</p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
        <label className={toggleCls}>
          <input
            type="checkbox"
            checked={form.leavePolicyEnabled}
            onChange={(e) => set("leavePolicyEnabled", e.target.checked)}
          />
          Monthly leave policy
        </label>
        {form.leavePolicyEnabled && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Paid Leaves / Month</label>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set("paidLeavesPerMonth", n)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                        paid === n
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="0"
                    max="31"
                    value={form.paidLeavesPerMonth}
                    onChange={(e) => set("paidLeavesPerMonth", e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Cut per Unpaid Leave (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder={`Blank = 1 day salary (~${formatMoney(autoPerDay)})`}
                  value={form.unpaidLeaveDeductionPerDay}
                  onChange={(e) => set("unpaidLeaveDeductionPerDay", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Missing attendance on a working day counts as a leave. First <b>{paid}</b> leave
              {paid === 1 ? "" : "s"} each month {paid === 1 ? "is" : "are"} paid; every extra leave cuts{" "}
              <b>{formatMoney(perDay)}</b>
              {form.unpaidLeaveDeductionPerDay === "" && " (salary ÷ working days that month)"}.
            </p>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
        <label className={toggleCls}>
          <input
            type="checkbox"
            checked={form.latePenaltyEnabled}
            onChange={(e) => set("latePenaltyEnabled", e.target.checked)}
          />
          Late attendance penalty
        </label>
        {form.latePenaltyEnabled && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Late By (Hours)</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={form.lateAfterHours}
                  onChange={(e) => set("lateAfterHours", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>+ Minutes</label>
                <select
                  value={form.lateAfterMins}
                  onChange={(e) => set("lateAfterMins", Number(e.target.value))}
                  className={inputCls}
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Amount to Cut (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="10"
                  placeholder="e.g. 100"
                  value={form.latePenaltyAmount}
                  onChange={(e) => set("latePenaltyAmount", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Marking attendance <b>{lateLabel}</b> or more after{" "}
              <b>{form.startTime || "shift start"}</b> cuts{" "}
              <b>{formatMoney(form.latePenaltyAmount)}</b> per late day.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
