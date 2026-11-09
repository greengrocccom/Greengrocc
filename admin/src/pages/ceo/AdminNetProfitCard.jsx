import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Loader2 } from 'lucide-react';
import adminFinanceApi from '../../api/adminFinanceApi';
import { PANEL } from '../../utils/ui';

const DAY_MS = 24 * 60 * 60 * 1000;
const istDate = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** CEO dashboard periods (today / 7d / 30d / all) as finance date-filter params. */
function financeParams(period) {
  if (period === 'today') return { preset: 'today' };
  const days = Number.parseInt(period, 10);
  return Number.isFinite(days) ? { startDate: istDate(days - 1) } : {};
}

const inr = (val) => `₹${Math.round(Number(val || 0)).toLocaleString('en-IN')}`;

export default function AdminNetProfitCard({ period, periodLabel }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    adminFinanceApi
      .getAdminNetProfit(financeParams(period))
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err?.response?.data?.message || 'Unable to load net profit'));
    return () => {
      cancelled = true;
    };
  }, [period]);

  const net = Number(data?.netProfit || 0);

  return (
    <button
      type="button"
      onClick={() => navigate('/finance')}
      className={`${PANEL} w-full p-5 text-left transition hover:border-emerald-500 hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Admin Net Profit (आपला नफा)
          {periodLabel ? <span className="ml-2 font-semibold normal-case text-slate-400">{periodLabel}</span> : null}
        </span>
        <div className="rounded-xl bg-teal-50 p-2 text-teal-700">
          <Landmark className="h-4 w-4" />
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>
      ) : !data ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculating…
        </p>
      ) : (
        <>
          <p className={`mt-2 text-4xl font-black tabular-nums ${net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {inr(net)}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2.5 text-xs">
            <span className="text-indigo-700">
              Vendors' commission <strong className="tabular-nums">+ {inr(data.commission)}</strong>
            </span>
            <span className="text-emerald-700">
              Own vendor delivered sales <strong className="tabular-nums">+ {inr(data.ownVendorDelivered)}</strong>
            </span>
            <span className="text-rose-600">
              Expenses <strong className="tabular-nums">− {inr(data.totalExpenses)}</strong>
            </span>
          </div>
        </>
      )}
    </button>
  );
}
