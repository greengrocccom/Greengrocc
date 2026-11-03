import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { DayPicker, apiError, formatDays, formatMoney, inputCls, labelCls, to24h } from "./fullTimeUi";

const EMPTY_RULE = {
  ruleName: "Standard Full-Time Rule",
  attendanceStartTime: "09:00",
  attendanceEndTime: "18:00",
  requireAttendance: true,
  requireLocationValidation: true,
  attendanceRadiusMeters: 200,
  minimumAttendanceDays: 26,
  compulsoryDailyOnlineHours: 8,
  requireCompulsoryOnlineHours: true,
  leavePolicyEnabled: false,
  paidLeavesPerMonth: 0,
  unpaidLeaveDeductionPerDay: "",
  latePenaltyEnabled: false,
  lateAfterMinutes: 120,
  latePenaltyAmount: "",
  workingDays: [1, 2, 3, 4, 5, 6],
  notes: "",
  customRules: [],
};

/** "18:00" → "06:00 PM" — rules store 12-hour strings like the rest of the shift system. */
function to12h(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return value;
  const h = parseInt(m[1], 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${m[2]} ${period}`;
}

export default function FullTimeRulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await managerApi.getFullTimeRules();
      setRules(res.data?.rules || []);
      setError("");
    } catch (err) {
      setError(apiError(err, "Failed to load rules"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_RULE);
    setIsFormOpen(true);
  };

  const openEdit = (rule) => {
    setEditingId(rule._id);
    setForm({
      ruleName: rule.ruleName,
      attendanceStartTime: to24h(rule.attendanceStartTime),
      attendanceEndTime: to24h(rule.attendanceEndTime),
      requireAttendance: rule.requireAttendance !== false,
      requireLocationValidation: rule.requireLocationValidation !== false,
      attendanceRadiusMeters: rule.attendanceRadiusMeters ?? 200,
      minimumAttendanceDays: rule.minimumAttendanceDays ?? 26,
      compulsoryDailyOnlineHours: rule.compulsoryDailyOnlineHours ?? 8,
      requireCompulsoryOnlineHours: rule.requireCompulsoryOnlineHours !== false,
      leavePolicyEnabled: Boolean(rule.leavePolicyEnabled),
      paidLeavesPerMonth: rule.paidLeavesPerMonth ?? 0,
      unpaidLeaveDeductionPerDay: rule.unpaidLeaveDeductionPerDay ?? "",
      latePenaltyEnabled: Boolean(rule.latePenaltyEnabled),
      lateAfterMinutes: rule.lateAfterMinutes ?? 120,
      latePenaltyAmount: rule.latePenaltyAmount ?? "",
      workingDays: rule.workingDays || [],
      notes: rule.notes || "",
      customRules: (rule.customRules || []).map((c) => ({ title: c.title, description: c.description || "" })),
    });
    setIsFormOpen(true);
  };

  const updateCustomRule = (index, key, value) =>
    set(
      "customRules",
      form.customRules.map((c, i) => (i === index ? { ...c, [key]: value } : c))
    );

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.workingDays.length) {
      setError("Select at least one working day");
      return;
    }
    setSubmitting(true);
    setMessage("");
    setError("");
    const payload = {
      ...form,
      attendanceStartTime: to12h(form.attendanceStartTime),
      attendanceEndTime: to12h(form.attendanceEndTime),
      requireAttendance: Boolean(form.requireAttendance),
      attendanceRadiusMeters: Number(form.attendanceRadiusMeters),
      minimumAttendanceDays: Number(form.minimumAttendanceDays),
      compulsoryDailyOnlineHours: Number(form.compulsoryDailyOnlineHours || 8),
      requireCompulsoryOnlineHours: Boolean(form.requireCompulsoryOnlineHours),
      leavePolicyEnabled: Boolean(form.leavePolicyEnabled),
      paidLeavesPerMonth: Number(form.paidLeavesPerMonth || 0),
      unpaidLeaveDeductionPerDay: form.unpaidLeaveDeductionPerDay === "" ? null : Number(form.unpaidLeaveDeductionPerDay),
      latePenaltyEnabled: Boolean(form.latePenaltyEnabled),
      lateAfterMinutes: Number(form.lateAfterMinutes || 120),
      latePenaltyAmount: Number(form.latePenaltyAmount || 0),
      customRules: form.customRules.filter((c) => c.title.trim()),
    };
    try {
      if (editingId) await managerApi.updateFullTimeRule(editingId, payload);
      else await managerApi.createFullTimeRule(payload);
      setMessage(editingId ? "Rule updated." : "Full-Time rule created successfully!");
      setIsFormOpen(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(apiError(err, "Failed to save rule"));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this rule?")) return;
    try {
      await managerApi.deleteFullTimeRule(id);
      setMessage("Rule deleted.");
      await load();
    } catch (err) {
      setError(apiError(err, "Failed to delete rule"));
    }
  };

  return (
    <PageShell title="Full-Time Rules">
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
          className="pb-2.5 px-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition whitespace-nowrap"
        >
          Full-Time Shifts
        </Link>
        <Link
          to="/fulltime/rules"
          className="pb-2.5 px-0.5 border-b-2 border-emerald-600 text-emerald-700 font-bold transition whitespace-nowrap"
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
      {message && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-xs">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          The most recently updated rule is used for attendance. A driver&apos;s Full-Time shift timing, when
          assigned, takes priority over the rule timing.
        </p>
        <button
          type="button"
          onClick={() => (isFormOpen ? setIsFormOpen(false) : openCreate())}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition hover:bg-emerald-700"
        >
          {isFormOpen ? "✕ Close Form" : "+ Create Rule"}
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
            {editingId ? "Edit Rule" : "New Rule"}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Rule Name</label>
              <input required value={form.ruleName} onChange={(e) => set("ruleName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Attendance Start</label>
              <input
                type="time"
                required
                value={form.attendanceStartTime}
                onChange={(e) => set("attendanceStartTime", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Attendance End</label>
              <input
                type="time"
                required
                value={form.attendanceEndTime}
                onChange={(e) => set("attendanceEndTime", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Dark Store Radius (m)</label>
              <input
                type="number"
                min="10"
                required
                value={form.attendanceRadiusMeters}
                onChange={(e) => set("attendanceRadiusMeters", e.target.value)}
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 pt-5 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={form.requireAttendance}
                onChange={(e) => set("requireAttendance", e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              Attendance required
            </label>
            <div>
              <label className={labelCls}>Minimum Attendance Days / Month</label>
              <input
                type="number"
                min="0"
                max="31"
                required
                value={form.minimumAttendanceDays}
                onChange={(e) => set("minimumAttendanceDays", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Daily Compulsory Online Hours</label>
              <input
                type="number"
                min="1"
                max="24"
                step="0.5"
                required
                value={form.compulsoryDailyOnlineHours}
                onChange={(e) => set("compulsoryDailyOnlineHours", e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Full-Time driver must be online at least this many hours to be marked Present.
              </p>
            </div>
            <label className="flex items-center gap-2 pt-5 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={form.requireCompulsoryOnlineHours}
                onChange={(e) => set("requireCompulsoryOnlineHours", e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              Compulsory online hours required to mark Present
            </label>
            <label className="flex items-center gap-2 pt-5 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={form.requireLocationValidation}
                onChange={(e) => set("requireLocationValidation", e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              Must be present near the dark store
            </label>
          </div>

          <section className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800">Leave &amp; late attendance rules</h4>
              <p className="mt-0.5 text-[11px] text-slate-500">These rules apply across Full-Time shifts. Salary and KM rates remain configured per rider.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input type="checkbox" checked={form.leavePolicyEnabled} onChange={(e) => set("leavePolicyEnabled", e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                  Enable monthly leave policy
                </label>
                {form.leavePolicyEnabled && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="text-[10px] font-bold text-slate-500">
                      Paid leaves per month
                      <input type="number" min="0" max="31" required value={form.paidLeavesPerMonth} onChange={(e) => set("paidLeavesPerMonth", e.target.value)} className={inputCls} />
                    </label>
                    <label className="text-[10px] font-bold text-slate-500">
                      Deduction per extra leave (₹)
                      <input type="number" min="0" step="1" value={form.unpaidLeaveDeductionPerDay} onChange={(e) => set("unpaidLeaveDeductionPerDay", e.target.value)} placeholder="Use salary-based amount" className={inputCls} />
                    </label>
                  </div>
                )}
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input type="checkbox" checked={form.latePenaltyEnabled} onChange={(e) => set("latePenaltyEnabled", e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                  Enable late attendance penalty
                </label>
                {form.latePenaltyEnabled && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="text-[10px] font-bold text-slate-500">
                      Late threshold (minutes)
                      <input type="number" min="1" max="1440" required value={form.lateAfterMinutes} onChange={(e) => set("lateAfterMinutes", e.target.value)} className={inputCls} />
                    </label>
                    <label className="text-[10px] font-bold text-slate-500">
                      Penalty per late day (₹)
                      <input type="number" min="1" required value={form.latePenaltyAmount} onChange={(e) => set("latePenaltyAmount", e.target.value)} className={inputCls} />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div>
            <label className={labelCls}>Working Days</label>
            <DayPicker value={form.workingDays} onChange={(v) => set("workingDays", v)} />
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-800">Custom Rules</span>
              <button
                type="button"
                onClick={() => set("customRules", [...form.customRules, { title: "", description: "" }])}
                className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
              >
                + Add Rule
              </button>
            </div>
            {form.customRules.length === 0 && (
              <p className="text-[11px] text-slate-400">e.g. “Wear company uniform”, “Report to store manager at shift start”.</p>
            )}
            {form.customRules.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-2.5">
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    placeholder="Rule title"
                    value={c.title}
                    onChange={(e) => updateCustomRule(i, "title", e.target.value)}
                    className={inputCls}
                  />
                  <input
                    placeholder="Description (optional)"
                    value={c.description}
                    onChange={(e) => updateCustomRule(i, "description", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => set("customRules", form.customRules.filter((_, idx) => idx !== i))}
                  className="pt-2 text-sm font-bold text-rose-500 hover:text-rose-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} />
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : editingId ? "Save Changes" : "Create Rule"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" />
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-xs">
          <p className="text-sm font-bold text-slate-700">No rules configured yet</p>
          <p className="mt-1 text-xs text-slate-400">Click &quot;+ Create Rule&quot; to add requirements for Full-Time drivers.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-black text-xs font-bold uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-2">Rule Name</th>
                <th className="px-4 py-2">Hours</th>
                <th className="px-4 py-2">Attendance</th>
                <th className="px-4 py-2">Compulsory Online</th>
                <th className="px-4 py-2">Days</th>
                <th className="px-4 py-2">Location Check</th>
                <th className="px-4 py-2">Min Days</th>
                <th className="px-4 py-2">Leave &amp; Late Policy</th>
                <th className="px-4 py-2">Custom Rules</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <tr key={rule._id} className="align-top transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {rule.ruleName}
                    {rule.notes && <div className="max-w-[180px] truncate text-[11px] font-normal text-slate-400">{rule.notes}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {rule.attendanceStartTime} – {rule.attendanceEndTime}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {rule.requireAttendance !== false ? <span className="text-emerald-700">Required</span> : <span className="text-slate-400">Not required</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {rule.requireCompulsoryOnlineHours !== false ? (
                      <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {rule.compulsoryDailyOnlineHours ?? 8} hrs/day
                      </span>
                    ) : (
                      <span className="text-slate-400">Optional</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{formatDays(rule.workingDays)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        rule.requireLocationValidation
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}
                    >
                      {rule.requireLocationValidation ? `Within ${rule.attendanceRadiusMeters}m` : "Optional"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{rule.minimumAttendanceDays} days</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>{rule.leavePolicyEnabled ? `${rule.paidLeavesPerMonth ?? 0} paid leaves / month` : "Leave policy off"}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {rule.latePenaltyEnabled ? `Late after ${rule.lateAfterMinutes ?? 120} min · ${formatMoney(rule.latePenaltyAmount)} penalty` : "Late penalty off"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {(rule.customRules || []).length === 0 ? (
                      "—"
                    ) : (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {rule.customRules.map((c, i) => (
                          <li key={i}>{c.title}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(rule)}
                      className="mr-2 rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(rule._id)}
                      className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
