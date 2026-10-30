import { useEffect, useState } from "react";

const LEAVE_TYPES = [
  { value: "casual", label: "Casual" },
  { value: "sick", label: "Sick" },
  { value: "earned", label: "Earned" },
  { value: "unpaid", label: "Unpaid" },
];

function statusTone(status) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

function formatDates(row) {
  if (Array.isArray(row.dates) && row.dates.length) return row.dates.join(", ");
  if (row.fromDate && row.toDate && row.fromDate !== row.toDate) {
    return `${row.fromDate} → ${row.toDate}`;
  }
  return row.fromDate || "—";
}

export default function ApplyLeaveSection({
  title = "Apply for leave",
  applicantName = "",
  applyLeave,
  listMyLeaves,
}) {
  const [leaveType, setLeaveType] = useState("casual");
  const [reason, setReason] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [dates, setDates] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await listMyLeaves();
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addDate = () => {
    const day = String(dateInput || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    setDates((prev) => [...new Set([...prev, day])].sort());
    setDateInput("");
  };

  const removeDate = (day) => {
    setDates((prev) => prev.filter((d) => d !== day));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!dates.length) {
      setError("Add at least one leave date");
      return;
    }
    setSaving(true);
    setSuccess("");
    try {
      await applyLeave({
        leaveType,
        reason,
        dates,
        name: applicantName || undefined,
      });
      setReason("");
      setDates([]);
      setLeaveType("casual");
      setSuccess("Leave request submitted");
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not submit leave");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{success}</div>
      ) : null}

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <label className="block text-xs font-semibold text-slate-600">
          Type of leave
          <select
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50"
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
          >
            {LEAVE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          Reason
          <textarea
            required
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50"
            placeholder="Why do you need leave?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <div>
          <p className="text-xs font-semibold text-slate-600">Leave dates</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Add one or more dates. Non-continuous days are supported.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="date"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />
            <button
              type="button"
              onClick={addDate}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              + Add date
            </button>
          </div>
          {dates.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {dates.map((day) => (
                <span key={day} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {day}
                  <button type="button" onClick={() => removeDate(day)} className="rounded-full px-1 hover:bg-emerald-100" aria-label={`Remove ${day}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">No dates added yet</p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {saving ? "Submitting…" : "Submit leave request"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">My leave requests</h2>
        {loading ? (
          <p className="mt-4 text-center text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No leave requests yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <article key={row._id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold capitalize text-slate-900">{row.leaveType} leave</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusTone(row.status)}`}>{row.status}</span>
                </div>
                <p className="mt-1 text-xs tabular-nums text-slate-500">{formatDates(row)}</p>
                {row.reason ? <p className="mt-1 text-sm text-slate-600">{row.reason}</p> : null}
                {row.adminNotes ? (
                  <p className="mt-1 text-xs text-slate-500"><span className="font-semibold">Admin note:</span> {row.adminNotes}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
