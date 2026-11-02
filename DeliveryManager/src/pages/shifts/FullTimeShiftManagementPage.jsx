import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../../components/layout/ManagerLayout";
import { managerApi } from "../../api/managerApi";
import { apiError, formatDays, formatMinutes, formatMoney } from "../fulltime/fullTimeUi";

export default function FullTimeShiftManagementPage() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          to="/fulltime/attendance"
          className="pb-2.5 px-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition whitespace-nowrap"
        >
          Employee Attendance
        </Link>
        <Link
          to="/fulltime/salary"
          className="pb-2.5 px-0.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition whitespace-nowrap"
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

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-medium text-slate-600">
          Full-Time delivery partners earn monthly salary with daily compulsory online hours attendance.
        </div>
        <Link
          to="/shifts/fulltime/create"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
        >
          + Create Full-Time Shift
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-400">Loading…</div>
        ) : shifts.length === 0 ? (
          <div className="space-y-2 py-16 text-center text-slate-500">
            <p className="text-2xl">📅</p>
            <p className="text-sm font-bold text-slate-700">No Full-Time shifts yet.</p>
            <p className="text-xs text-slate-400">Click “+ Create Full-Time Shift” to add one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-xs font-bold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-5 py-2">Shift</th>
                  <th className="px-5 py-2">Timing</th>
                  <th className="px-5 py-2">Working Days</th>
                  <th className="px-5 py-2">Attendance</th>
                  <th className="px-5 py-2">Salary &amp; Policy</th>
                  <th className="px-5 py-2">Drivers</th>
                  <th className="px-5 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((s) => (
                  <tr key={s.id} className="align-top transition hover:bg-emerald-50/40">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      {s.notes && <div className="text-[11px] text-slate-400">{s.notes}</div>}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {s.startTime} – {s.endTime}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-700">{formatDays(s.workingDays)}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {s.requireAttendance ? "Required" : "Not required"}
                      {s.requireAttendance && s.requireLocationValidation && (
                        <div className="text-[11px] text-slate-400">
                          GPS within {s.attendanceRadiusMeters ?? "rule default"}
                          {s.attendanceRadiusMeters ? "m" : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <div className="font-bold text-emerald-700">
                        {s.monthlySalary != null ? `${formatMoney(s.monthlySalary)} / month` : "Store salary"}
                      </div>
                      {s.leavePolicyEnabled && (
                        <div className="text-[11px]">
                          {s.paidLeavesPerMonth} paid leave{s.paidLeavesPerMonth === 1 ? "" : "s"} · extra{" "}
                          {s.unpaidLeaveDeductionPerDay != null
                            ? `−${formatMoney(s.unpaidLeaveDeductionPerDay)}`
                            : "−1 day salary"}
                        </div>
                      )}
                      {s.latePenaltyEnabled && (
                        <div className="text-[11px]">
                          Late {formatMinutes(s.lateAfterMinutes)}+ → −{formatMoney(s.latePenaltyAmount)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {s.drivers.length === 0 ? (
                        <span className="text-slate-400">No drivers</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.drivers.map((d) => (
                            <Link
                              key={d.id}
                              to={`/drivers/${d.id}`}
                              className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800 hover:bg-emerald-100"
                            >
                              {d.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Link
                        to={`/shifts/fulltime/${s.id}/edit`}
                        className="mr-2 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
