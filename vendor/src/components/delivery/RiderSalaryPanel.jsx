import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '../../api/client';
import { PANEL, TH } from '../../utils/ui';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const monthLabel = (m) => {
  const d = new Date(`${m}-01T12:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
const currentMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date());

const input = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800';

/** Admin: set a rider's monthly salary, credit it month-wise, and see slot incentives. */
export default function RiderSalaryPanel({ riderId }) {
  const base = `/admin-ops/delivery/boys/${riderId}`;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salaryInput, setSalaryInput] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: '', text: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`${base}/salary`);
      setData(res.data?.data || null);
      setSalaryInput(res.data?.data?.monthlySalary ?? '');
    } catch (err) {
      setMsg({ tone: 'rose', text: err.response?.data?.message || 'Failed to load salary' });
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setMsg({ tone: '', text: '' });
    try {
      const res = await fn();
      setData(res.data?.data || data);
      setMsg({ tone: 'green', text: res.data?.message || 'Saved' });
    } catch (err) {
      setMsg({ tone: 'rose', text: err.response?.data?.message || 'Request failed' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center text-sm text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading salary
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {msg.text ? (
        <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${msg.tone === 'green' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
          {msg.text}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <section className={`${PANEL} p-4 space-y-3`}>
          <h2 className="text-sm font-semibold text-slate-800">Monthly salary</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="0"
              value={salaryInput}
              onChange={(e) => setSalaryInput(e.target.value)}
              placeholder="e.g. 15000"
              className={`${input} w-40`}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => apiClient.put(`${base}/salary`, { monthlySalary: salaryInput === '' ? null : Number(salaryInput) }))}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Shown to the delivery partner in the app wallet. Wallet balance: <b>{money(data?.walletBalance)}</b>
          </p>
        </section>

        <section className={`${PANEL} p-4 space-y-3`}>
          <h2 className="text-sm font-semibold text-slate-800">Credit salary to wallet</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={input} />
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={data?.monthlySalary ? `${data.monthlySalary} (default)` : 'Amount'}
              className={`${input} w-36`}
            />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={`${input} w-full`} />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await apiClient.post(`${base}/salary-credits`, { month, amount: amount === '' ? undefined : Number(amount), note });
                setAmount('');
                setNote('');
                return res;
              })
            }
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Credit {monthLabel(month)} salary
          </button>
          <p className="text-[11px] text-slate-400">One credit per month. The rider gets a notification instantly.</p>
        </section>
      </div>

      <div className={PANEL}>
        <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Month-wise</div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F2F2F2]">
            <tr>
              {['Month', 'Salary credited', 'Incentives', 'Total', 'Credited on'].map((h) => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.months || []).map((m) => (
              <tr key={m.month} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2.5 font-semibold">{monthLabel(m.month)}</td>
                <td className="px-3 py-2.5">{m.salaryCredited ? money(m.salaryCredited) : <span className="text-slate-400">Not credited</span>}</td>
                <td className="px-3 py-2.5 text-amber-700">{money(m.incentives)}</td>
                <td className="px-3 py-2.5 font-semibold">{money(m.salaryCredited + m.incentives)}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {m.salaryCreditedAt ? new Date(m.salaryCreditedAt).toLocaleDateString('en-IN') : '—'}
                  {m.note ? ` · ${m.note}` : ''}
                </td>
              </tr>
            ))}
            {!data?.months?.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">No salary or incentives yet</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className={PANEL}>
        <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Recent slot incentives</div>
        <div className="divide-y divide-slate-100">
          {(data?.recentIncentives || []).map((c, i) => (
            <div key={`${c.creditedAt}-${i}`} className="flex items-center justify-between px-4 py-2 text-xs">
              <span className="text-slate-700">{c.label}</span>
              <span className="font-semibold text-amber-700">
                {money(c.amount)} · {new Date(c.creditedAt).toLocaleString('en-IN')}
              </span>
            </div>
          ))}
          {!data?.recentIncentives?.length ? <p className="px-4 py-6 text-center text-xs text-slate-400">No incentives yet</p> : null}
        </div>
      </div>
    </div>
  );
}
