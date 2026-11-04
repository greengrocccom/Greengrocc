import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../../components/layout/ManagerLayout";
import { managerApi } from "../../api/managerApi";
import {
  DayPicker,
  apiError,
  inputCls,
  labelCls,
  to24h,
} from "../fulltime/fullTimeUi";

const EMPTY = {
  name: "Full-Time Day Shift",
  startTime: "09:00",
  endTime: "18:00",
  workingDays: [1, 2, 3, 4, 5, 6],
  notes: "",
  driverIds: [],
  scheduleMode: "full_week",
  scheduleDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
  excludedDates: [],
};

const dateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function scheduleRange(mode, selectedDate) {
  const date = new Date(`${selectedDate}T12:00:00`);
  if (mode === "single_day") return { start: selectedDate, end: selectedDate };
  if (mode === "full_month") {
    return {
      start: dateString(new Date(date.getFullYear(), date.getMonth(), 1)),
      end: dateString(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    };
  }
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: dateString(start), end: dateString(end) };
}

export default function EditFullTimeShiftPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFixedPayConfirm, setShowFixedPayConfirm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [driversRes, shiftsRes] = await Promise.all([
          managerApi.getFullTimeDrivers(),
          managerApi.getFullTimeShifts(),
        ]);
        if (cancelled) return;
        setDrivers(driversRes.data.drivers || []);
        const shift = (shiftsRes.data.shifts || []).find((s) => s.id === id);
        if (!shift) {
          setError("Full-Time shift not found");
          return;
        }
        setForm({
          name: shift.name,
          startTime: to24h(shift.startTime),
          endTime: to24h(shift.endTime),
          workingDays: shift.workingDays || [],
          notes: shift.notes || "",
          driverIds: shift.driverIds || [],
          scheduleMode: shift.scheduleMode || "full_week",
          scheduleDate: shift.scheduleStartDate || EMPTY.scheduleDate,
          excludedDates: shift.excludedDates || [],
        });
      } catch (err) {
        if (!cancelled) setError(apiError(err, "Failed to load data"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const activeRange = scheduleRange(form.scheduleMode, form.scheduleDate || EMPTY.scheduleDate);
  const toggleDriver = (driverId) =>
    set(
      "driverIds",
      form.driverIds.includes(driverId)
        ? form.driverIds.filter((d) => d !== driverId)
        : [...form.driverIds, driverId]
    );
  const availableDrivers = drivers.filter((driver) => !driver.shift || driver.shift.id === id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.scheduleMode !== "single_day" && !form.workingDays.length) {
      setError("Select at least one working day");
      return;
    }
    if (!form.scheduleDate) {
      setError("Choose a date for this shift schedule");
      return;
    }
    setError("");
    setShowFixedPayConfirm(true);
  };

  const confirmSave = async () => {
    setShowFixedPayConfirm(false);
    setSaving(true);
    setError("");
    const range = scheduleRange(form.scheduleMode, form.scheduleDate);
    const selectedDate = new Date(`${form.scheduleDate}T12:00:00`);
    const payload = {
      ...form,
      workingDays: form.scheduleMode === "single_day" ? [selectedDate.getDay()] : form.workingDays,
      scheduleStartDate: range.start,
      scheduleEndDate: range.end,
    };
    try {
      await managerApi.updateFullTimeShift(id, payload);
      navigate("/shifts/fulltime");
    } catch (err) {
      setError(apiError(err, "Failed to save shift"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      title="Edit Full-Time Shift"
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

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <label className={labelCls}>Schedule Period</label>
              <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-1">
                {[{ id: "single_day", label: "Single day" }, { id: "full_week", label: "Week" }, { id: "full_month", label: "Month" }].map((mode) => (
                  <button key={mode.id} type="button" onClick={() => set("scheduleMode", mode.id)} className={`rounded-md px-4 py-2 text-xs font-bold ${form.scheduleMode === mode.id ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>{mode.label}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>{form.scheduleMode === "full_month" ? "Choose month" : form.scheduleMode === "full_week" ? "Choose a date in the week" : "Shift date"}</label>
                <input type={form.scheduleMode === "full_month" ? "month" : "date"} value={form.scheduleMode === "full_month" ? form.scheduleDate.slice(0, 7) : form.scheduleDate} onChange={(e) => set("scheduleDate", form.scheduleMode === "full_month" ? `${e.target.value}-01` : e.target.value)} className={inputCls} required />
                <p className="mt-1 text-[11px] text-slate-500">{form.scheduleMode === "full_week" ? "The selected week runs Monday through Sunday." : form.scheduleMode === "full_month" ? "The shift runs for the selected calendar month." : "This shift runs only on the selected date."}</p>
              </div>
              {form.scheduleMode !== "single_day" && <div>
                <label className={labelCls}>Working Days</label>
                <DayPicker value={form.workingDays} onChange={(v) => set("workingDays", v)} />
              </div>}
            </div>
            {form.scheduleMode !== "single_day" && <div className="max-w-sm">
              <label className={labelCls}>Skip a date (optional)</label>
              <div className="flex gap-2">
                <input aria-label="Date to skip" type="date" min={activeRange.start} max={activeRange.end} id="full-time-skip-date" className={inputCls} />
                <button type="button" onClick={() => { const input = document.getElementById("full-time-skip-date"); if (input?.value && !form.excludedDates.includes(input.value)) set("excludedDates", [...form.excludedDates, input.value].sort()); if (input) input.value = ""; }} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100">Add date</button>
              </div>
              {form.excludedDates.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{form.excludedDates.map((day) => <span key={day} className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Skip {day}<button type="button" aria-label={`Remove skipped date ${day}`} onClick={() => set("excludedDates", form.excludedDates.filter((value) => value !== day))} className="font-bold">×</button></span>)}</div>}
              <p className="mt-1 text-[11px] text-slate-500">Skipped dates apply within the selected week or month.</p>
            </div>}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <label className={labelCls}>Available Full-Time Riders</label>
                <p className="text-[11px] text-slate-500">Only riders without another assigned shift are listed.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                {availableDrivers.length} available · {form.driverIds.length} selected
              </span>
            </div>
            {availableDrivers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs font-medium text-slate-500">No unassigned Full-Time riders are available.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableDrivers.map((d) => {
                  return (
                    <label
                      key={d.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-xs transition ${
                        form.driverIds.includes(d.id)
                          ? "border-emerald-400 bg-emerald-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-emerald-600"
                        checked={form.driverIds.includes(d.id)}
                        onChange={() => toggleDriver(d.id)}
                      />
                      <span>
                        <span className="block font-bold text-slate-900">{d.name}</span>
                        <span className="block text-slate-500">{d.phone}</span>
                        <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Available</span>
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
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      )}
      {showFixedPayConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="fixed-pay-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="fixed-pay-title" className="text-base font-bold text-slate-900">Rider payment is fixed</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Salary or KM commission is configured on each rider&apos;s payment settings. This shift will not change their pay amount.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowFixedPayConfirm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Review shift</button>
              <button type="button" disabled={saving} onClick={confirmSave} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{saving ? "Saving…" : "Confirm Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

