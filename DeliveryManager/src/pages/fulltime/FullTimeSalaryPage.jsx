import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { apiError, currentMonthIst, formatMoney, salarySourceLabel } from "./fullTimeUi";

export default function FullTimeSalaryPage() {
  const [salary, setSalary] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await managerApi.getFullTimeConfig();
        const val = res.data?.fullTimeMonthlySalary ?? 0;
        setSalary(val);
        setInputValue(String(val));
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load salary config");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const res = await managerApi.setFullTimeConfig({ fullTimeMonthlySalary: Number(inputValue) });
      const updated = res.data?.fullTimeMonthlySalary ?? Number(inputValue);
      setSalary(updated);
      setInputValue(String(updated));
      setMessage(res.data?.message || "Monthly salary updated successfully!");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update salary");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="Full-Time Employee Salary">
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
          to="/fulltime/attendance"
          className="pb-2.5 px-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition whitespace-nowrap"
        >
          Employee Attendance
        </Link>
        <Link
          to="/fulltime/salary"
          className="pb-2.5 px-0.5 border-b-2 border-emerald-600 text-emerald-700 font-bold transition whitespace-nowrap"
        >
          Employee Salary
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
      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-xs flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* Current Salary Stat Card */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-4 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Monthly Salary</p>
          {loading ? (
            <div className="mt-1 h-6 w-24 rounded bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-600">₹{salary.toLocaleString("en-IN")}</span>
              <span className="text-xs font-medium text-slate-400">/ month</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-100 bg-white px-4 py-4 shadow-2xs flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Applies To</p>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
              Full-Time Drivers
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            This salary is shown to all Full-Time riders in their app.
          </p>
        </div>
      </div>

      {/* Update Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-1">Update Monthly Salary</h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Set the fixed monthly salary for all Full-Time delivery partners in your hub.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="max-w-xs">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Monthly Salary (₹)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={submitting || loading}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {submitting ? "Saving…" : "Save Configuration"}
            </button>
          </div>
        </form>
      </div>

      <DriverSalaryTable refreshKey={salary} />
    </PageShell>
  );
}

function DriverSalaryTable({ refreshKey }) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [month, setMonth] = useState(currentMonthIst());
  const [notice, setNotice] = useState({ type: "", text: "" });

  const load = async () => {
    try {
      const res = await managerApi.getFullTimeDrivers();
      setDrivers(res.data?.drivers || []);
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to load Full-Time drivers") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const saveOverride = async (driver, value) => {
    setBusyId(driver.id);
    setNotice({ type: "", text: "" });
    try {
      await managerApi.setFullTimeDriverSalary(driver.id, value === "" ? null : Number(value));
      setDrafts((d) => ({ ...d, [driver.id]: undefined }));
      setNotice({ type: "ok", text: `Salary updated for ${driver.name}` });
      await load();
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to update salary") });
    } finally {
      setBusyId(null);
    }
  };

  const credit = async (driver) => {
    const isCurrent = month === currentMonthIst();
    const amountText =
      isCurrent && driver.payroll
        ? `${formatMoney(driver.payroll.netSalary)} (after ${formatMoney(driver.payroll.totalDeductions)} deductions)`
        : "the net salary (after leave / late deductions)";
    if (!window.confirm(`Credit ${amountText} for ${month} to ${driver.name}'s wallet?`)) return;
    setBusyId(driver.id);
    setNotice({ type: "", text: "" });
    try {
      const res = await managerApi.creditFullTimeSalary(driver.id, { month });
      setNotice({ type: "ok", text: res.data?.message || "Salary credited" });
      await load();
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to credit salary") });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Per-Driver Salary</h3>
          <p className="text-[11px] text-slate-500">
            Leave the override blank to use the store salary above. Crediting adds the salary to the driver&apos;s
            wallet once per month.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Salary Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {notice.text && (
        <div
          className={`rounded-xl border p-2.5 text-xs font-semibold ${
            notice.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : drivers.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">No Full-Time drivers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black text-xs font-bold uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-2">Driver</th>
                <th className="px-4 py-2">Effective Salary</th>
                <th className="px-4 py-2">Override (₹)</th>
                <th className="px-4 py-2">This Month (net)</th>
                <th className="px-4 py-2 text-right">Wallet Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.map((d) => {
                const draft = drafts[d.id];
                const value = draft !== undefined ? draft : d.salaryOverride ?? "";
                const dirty = draft !== undefined && String(draft) !== String(d.salaryOverride ?? "");
                const creditedThisMonth = d.salaryCreditedThisMonth && month === currentMonthIst();
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/drivers/${d.id}`} className="font-bold text-slate-900 hover:text-emerald-700">
                        {d.name}
                      </Link>
                      <div className="text-[11px] text-slate-400">{d.phone}</div>
                    </td>
                    <td className="px-4 py-3 font-black text-emerald-600">
                      {formatMoney(d.monthlySalary)}
                      <div className="text-[10px] font-semibold text-slate-400">
                        {salarySourceLabel(d.salarySource)}
                        {d.shift?.name ? ` · ${d.shift.name}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          placeholder="Store default"
                          value={value}
                          onChange={(e) => setDrafts((p) => ({ ...p, [d.id]: e.target.value }))}
                          className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                        />
                        {dirty && (
                          <button
                            type="button"
                            disabled={busyId === d.id}
                            onClick={() => saveOverride(d, draft)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                      {d.payroll ? (
                        <>
                          <div className="font-black text-slate-900">{formatMoney(d.payroll.netSalary)}</div>
                          {d.payroll.totalDeductions > 0 && (
                            <div className="text-[10px] font-bold text-rose-600">
                              −{formatMoney(d.payroll.totalDeductions)}
                              {d.payroll.leave.unpaid > 0 && ` · ${d.payroll.leave.unpaid} unpaid leave`}
                              {d.payroll.late.count > 0 && ` · ${d.payroll.late.count} late`}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400">
                            {d.monthPresentDays} present
                            {d.payroll.leave.enabled &&
                              ` · ${d.payroll.leave.taken} leave (${d.payroll.leave.paid} paid)`}
                          </div>
                        </>
                      ) : (
                        <>{d.monthPresentDays} present</>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {creditedThisMonth ? (
                        <span className="text-[11px] font-bold text-emerald-700">
                          ✓ {formatMoney(d.salaryCreditedThisMonth.amount)} credited
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === d.id || !(d.monthlySalary > 0)}
                          onClick={() => credit(d)}
                          className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Credit {month}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
