import { useEffect, useMemo, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";

const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const money = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
function rangeFor(date, period) {
  const day = new Date(`${date}T00:00:00Z`);
  if (period === "day") return { from: date, to: date };
  if (period === "week") {
    const offset = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - offset);
    const from = day.toISOString().slice(0, 10);
    day.setUTCDate(day.getUTCDate() + 6);
    return { from, to: day.toISOString().slice(0, 10) };
  }
  const from = `${date.slice(0, 7)}-01`;
  const end = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0);
  return { from, to: end.toISOString().slice(0, 10) };
}

export default function RiderDistanceReportPage() {
  const [date, setDate] = useState(todayIst());
  const [period, setPeriod] = useState("day");
  const [type, setType] = useState("");
  const [data, setData] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const range = useMemo(() => rangeFor(date, period), [date, period]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    managerApi.getRiderDistanceReport({ ...range, ...(type ? { employmentType: type } : {}) })
      .then((res) => { if (active) setData({ rows: res.data?.rows || [], totals: res.data?.totals || {} }); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Could not load distance report."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range, type]);
  return (
    <PageShell title="Delivery Distance & Commission">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-bold text-slate-600">Period<select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
        <label className="text-xs font-bold text-slate-600">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-bold text-slate-600">Rider type<select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">All riders</option><option value="FULL_TIME">Full-Time</option><option value="PART_TIME">Part-Time</option></select></label>
        <p className="ml-auto text-xs text-slate-500">{range.from} through {range.to} · road route distance only</p>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Riders", data.totals.riders], ["Completed deliveries", data.totals.deliveries], ["Delivery KM", Number(data.totals.deliveryKm || 0).toFixed(2)], ["Recorded commission", money(data.totals.commission)]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-100 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{loading ? "…" : value ?? 0}</p></div>)}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["Date", "Rider", "Type", "Deliveries", "Road KM", "Rate / KM", "Commission"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && data.rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No completed deliveries in this period.</td></tr>}
            {data.rows.map((r) => <tr key={`${r.riderId}-${r.date}`} className="text-slate-700"><td className="px-4 py-3">{r.date}</td><td className="px-4 py-3 font-bold text-slate-900">{r.name}</td><td className="px-4 py-3">{r.employmentType === "FULL_TIME" ? "Full-Time" : "Part-Time"}</td><td className="px-4 py-3">{r.deliveries}</td><td className="px-4 py-3">{Number(r.totalDeliveryKm).toFixed(2)}</td><td className="px-4 py-3">{money(r.commissionRatePerKm)}</td><td className="px-4 py-3 font-black">{money(r.commission)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
