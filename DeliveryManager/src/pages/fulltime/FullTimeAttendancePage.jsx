import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { AttendanceBadge, apiError, formatDateTime, todayIst } from "./fullTimeUi";

export default function FullTimeAttendancePage() {
  const [date, setDate] = useState(todayIst());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await managerApi.getFullTimeAttendance(date);
      setData(res.data);
    } catch (err) {
      setError(apiError(err, "Failed to load attendance"));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const handleManualMark = async (driverId, status) => {
    try {
      setUpdatingId(driverId);
      setMessage("");
      setError("");
      const res = await managerApi.markFullTimeAttendanceManual({
        driverId,
        date,
        status,
        notes: `Manager marked ${status}`,
      });
      if (res.data?.success) {
        setMessage(res.data.message || "Attendance updated");
        await load();
      }
    } catch (err) {
      setError(apiError(err, "Failed to update attendance"));
    } finally {
      setUpdatingId(null);
    }
  };

  const summary = data?.summary || {};
  const stats = [
    ["Total Full-Time Staff", summary.total, "text-slate-900"],
    ["Present", summary.present, "text-emerald-700"],
    ["Absent", summary.absent, "text-rose-700"],
    ["Pending / Ongoing", summary.pending, "text-amber-700"],
    ["Off Day / Leave", (summary.offDay || 0) + (summary.notRequired || 0), "text-slate-500"],
  ];

  return (
    <PageShell title="Full-Time Employee Attendance">
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
          className="pb-2.5 px-0.5 border-b-2 border-emerald-600 text-emerald-700 font-bold transition whitespace-nowrap"
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

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 flex items-center justify-between mb-3">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} className="text-emerald-700 hover:text-emerald-900 ml-2">✕</button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 flex items-center justify-between mb-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-rose-700 hover:text-rose-900 ml-2">✕</button>
        </div>
      )}

      {/* Date Filter Bar */}
      <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Viewing Date:</label>
          <input
            type="date"
            value={date}
            max={todayIst()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
          />
          <button
            type="button"
            onClick={() => setDate(todayIst())}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
              date === todayIst()
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Compulsory Online Hours Rule applies: driver must be online for required shift hours to be marked Present.
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 mb-4">
        {stats.map(([label, value, cls]) => (
          <div key={label} className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`mt-0.5 text-lg font-bold ${cls}`}>{loading ? "…" : value ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Attendance Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
        {loading ? (
          <div className="py-12 text-center text-xs font-medium text-slate-400">Loading attendance data…</div>
        ) : !data?.rows?.length ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-600">No Full-Time drivers found for this hub.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Shift & Required Hours</th>
                  <th className="px-4 py-3">Online Time Logged</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Location Check</th>
                  <th className="px-4 py-3">Monthly Total</th>
                  <th className="px-4 py-3 text-right">Manual Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row) => {
                  const att = row.attendance || {};
                  const compulsoryHours = att.compulsoryHours ?? 8;
                  const isUpdating = updatingId === row.driver.id;

                  return (
                    <tr key={row.driver.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3">
                        <Link to={`/drivers/${row.driver.id}`} className="font-bold text-slate-900 hover:text-emerald-700">
                          {row.driver.name}
                        </Link>
                        <div className="text-[11px] text-slate-400">{row.driver.phone}</div>
                      </td>

                      <td className="px-4 py-3">
                        {row.requirement ? (
                          <>
                            <div className="font-semibold text-slate-800">
                              {row.requirement.startTime} – {row.requirement.endTime}
                            </div>
                            <div className="text-[11px] text-emerald-700 font-medium">
                              Compulsory: {compulsoryHours} hrs/day
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">Standard (8 hrs)</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {att.onlineTime || "0m"}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            / {compulsoryHours}h
                          </span>
                          {att.hoursMet ? (
                            <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2">
                              Met
                            </span>
                          ) : (
                            <span className="rounded bg-slate-100 text-slate-600 text-[10px] font-medium px-1.5 py-0.2">
                              {att.hoursProgressPercent ?? 0}%
                            </span>
                          )}
                        </div>
                        {/* Progress Bar */}
                        <div className="w-28 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full transition-all ${
                              att.hoursMet ? "bg-emerald-600" : "bg-amber-500"
                            }`}
                            style={{ width: `${Math.min(100, att.hoursProgressPercent ?? 0)}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <AttendanceBadge status={att.status} />
                        {att.manualOverride && (
                          <div className="text-[10px] text-slate-400 mt-0.5">Manager set</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {att.distanceFromStoreMeters != null ? (
                          <span>{Math.round(att.distanceFromStoreMeters)}m from store</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {row.monthPresentDays} days
                        {row.minimumAttendanceDays != null && (
                          <span className="text-slate-400 text-xs font-normal"> / {row.minimumAttendanceDays} min</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isUpdating || att.status === "present"}
                            onClick={() => handleManualMark(row.driver.id, "present")}
                            className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition"
                          >
                            Mark Present
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating || att.status === "absent"}
                            onClick={() => handleManualMark(row.driver.id, "absent")}
                            className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition"
                          >
                            Mark Absent
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating || att.status === "half_day"}
                            onClick={() => handleManualMark(row.driver.id, "half_day")}
                            className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition"
                          >
                            Half Day
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
      </div>
    </PageShell>
  );
}
