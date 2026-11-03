import { useEffect, useState } from "react";
import { managerApi } from "../../api/managerApi";

export default function PaymentConfigPanel({ driver, onSaved, compact = false }) {
  const [mode, setMode] = useState(driver.paymentMode || (driver.employmentType === "FULL_TIME" ? "monthly_salary" : "per_km_commission"));
  const [active, setActive] = useState(driver.paymentActive !== false);
  const [salary, setSalary] = useState(driver.monthlySalary ?? "");
  const [rate, setRate] = useState(driver.commissionRatePerKm ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setMode(driver.paymentMode || (driver.employmentType === "FULL_TIME" ? "monthly_salary" : "per_km_commission"));
    setActive(driver.paymentActive !== false);
    setSalary(driver.monthlySalary ?? "");
    setRate(driver.commissionRatePerKm ?? "");
  }, [driver]);

  const save = async (event) => {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await managerApi.setDriverPaymentConfig(driver.id, {
        active, mode,
        monthlySalary: Number(salary || 0),
        commissionRatePerKm: Number(rate || 0),
      });
      setNotice("Payment configuration saved.");
      onSaved?.();
    } catch (err) {
      setNotice(err.response?.data?.message || "Could not save payment configuration.");
    } finally { setBusy(false); }
  };

  const history = driver.paymentConfigHistory?.length > 0 && (
    <details className="border-t border-slate-100 pt-2">
      <summary className="cursor-pointer text-[10px] font-bold text-slate-600">Payment history</summary>
      <ul className="mt-2 space-y-1 text-[10px] text-slate-500">
        {[...driver.paymentConfigHistory].reverse().slice(0, 6).map((entry, i) => (
          <li key={`${entry.changedAt || "history"}-${i}`}>
            {entry.changedAt ? new Date(entry.changedAt).toLocaleString("en-IN") : "—"} · {entry.active ? "Active" : "Inactive"} · {entry.mode === "monthly_salary" ? `Salary ${money(entry.monthlySalary)}/month` : `Commission ${money(entry.commissionRatePerKm)}/KM`}
          </li>
        ))}
      </ul>
    </details>
  );

  if (compact) {
    return (
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="min-w-[390px] space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[10px] font-bold text-slate-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="peer sr-only" />
            <span className={`relative h-5 w-9 rounded-full transition ${active ? "bg-emerald-600" : "bg-slate-300"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${active ? "left-[18px]" : "left-0.5"}`} />
            </span>
            <span>{active ? "Active" : "Inactive"}</span>
          </label>
          <select aria-label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-800 shadow-sm">
            <option value="monthly_salary">Monthly Salary</option>
            <option value="per_km_commission">KM-wise Commission</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-[10px] font-bold text-slate-500">
            {mode === "monthly_salary" ? "Monthly salary (₹)" : "Commission rate (₹ / KM)"}
            <input type="number" min="0" step={mode === "monthly_salary" ? "100" : "0.25"}
              value={mode === "monthly_salary" ? salary : rate}
              onChange={(e) => mode === "monthly_salary" ? setSalary(e.target.value) : setRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-900 shadow-sm" />
          </label>
          <button disabled={busy} className="h-9 rounded-lg bg-emerald-700 px-3.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
        </div>
        {notice && <p className="text-[10px] text-slate-600" role="status">{notice}</p>}
        {history}
      </form>
    );
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Rider Payment</h2>
          <p className="mt-0.5 text-xs text-slate-500">Choose one payment method. Completed-order rates are saved with each delivery.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
          Active
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`rounded-xl border p-3 text-xs font-bold ${mode === "monthly_salary" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
          <input type="radio" name="paymentMode" value="monthly_salary" checked={mode === "monthly_salary"} onChange={() => setMode("monthly_salary")} className="mr-2 accent-emerald-600" />Monthly fixed salary
          <input type="number" min="0" step="100" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Monthly salary (₹)" className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
        </label>
        <label className={`rounded-xl border p-3 text-xs font-bold ${mode === "per_km_commission" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
          <input type="radio" name="paymentMode" value="per_km_commission" checked={mode === "per_km_commission"} onChange={() => setMode("per_km_commission")} className="mr-2 accent-emerald-600" />Per-kilometre commission
          <input type="number" min="0" step="0.25" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Commission rate (₹/KM)" className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500" role="status">{notice}</p>
        <button disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{busy ? "Saving…" : "Save Payment Settings"}</button>
      </div>
      {history}
    </form>
  );
}

const money = (value) => `₹${(Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
