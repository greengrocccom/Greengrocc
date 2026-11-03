import { useEffect, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";

const money = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date());

export default function MonthlyPaymentsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState("");
  const [data, setData] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    managerApi.getMonthlyRiderPayments({ month, ...(type ? { employmentType: type } : {}) })
      .then((res) => { if (active) setData({ rows: res.data?.rows || [], totals: res.data?.totals || {} }); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Could not load payment report."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, type]);
  return (
    <PageShell title="Monthly Rider Payments">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-bold text-slate-600">Month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-bold text-slate-600">Rider type<select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">All riders</option><option value="FULL_TIME">Full-Time</option><option value="PART_TIME">Part-Time</option></select></label>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Riders", data.totals.riders], ["Completed deliveries", data.totals.completedDeliveries], ["Total payable", money(data.totals.payable)]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-100 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{loading ? "…" : value ?? 0}</p></div>)}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["Rider", "Type", "Payment mode", "Completed", "Delivery KM", "Days · Present · Absent", "Paid / Unpaid leave", "Deductions", "Incentives", "Rate", "Payable"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && data.rows.length === 0 && <tr><td colSpan={11} className="p-8 text-center text-slate-400">No riders found for this report.</td></tr>}
            {data.rows.map((r) => <tr key={r.riderId} className="text-slate-700"><td className="px-4 py-3"><span className="font-bold text-slate-900">{r.name}</span><span className="block text-[10px] text-slate-400">{r.phone}</span></td><td className="px-4 py-3">{r.employmentType === "FULL_TIME" ? "Full-Time" : "Part-Time"}</td><td className="px-4 py-3">{r.paymentActive ? r.paymentMode === "monthly_salary" ? "Monthly salary" : "KM commission" : "Inactive"}</td><td className="px-4 py-3">{r.completedDeliveries}</td><td className="px-4 py-3">{Number(r.totalDeliveryKm).toFixed(2)}</td><td className="px-4 py-3">{r.payroll ? `${r.payroll.scheduledWorkingDays} · ${r.payroll.presentDays} · ${r.payroll.absentDays}` : "—"}</td><td className="px-4 py-3">{r.payroll ? `${r.payroll.paidLeaves} / ${r.payroll.unpaidLeaves}` : "—"}</td><td className="px-4 py-3">{money(r.payroll?.deductions)}</td><td className="px-4 py-3">{money(r.incentives)}</td><td className="px-4 py-3">{r.paymentMode === "monthly_salary" ? money(r.monthlySalary) + "/month" : money(r.commissionRatePerKm) + "/KM"}</td><td className="px-4 py-3 font-black">{money(r.payable)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
