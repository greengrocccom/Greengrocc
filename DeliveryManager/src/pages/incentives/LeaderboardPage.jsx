import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../../components/layout/ManagerLayout";
import { managerApi } from "../../api/managerApi";
import { useLive } from "../../realtime/useLive";
import { Pagination, usePagination } from "../../components/ui/Pagination";

const PERIODS = [
  ["week", "This week"],
  ["month", "This month"],
  ["all", "All time"],
];

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "DP";

const pct = (value) => (value == null ? "—" : `${value}%`);

function Stars({ rating, count }) {
  if (rating == null) {
    return <span className="text-[11px] font-medium text-slate-400">No ratings yet</span>;
  }
  const filled = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="text-sm leading-none tracking-tight">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= filled ? "text-amber-400" : "text-slate-200"}>
            ★
          </span>
        ))}
      </span>
      <span className="text-xs font-bold text-slate-700">{rating.toFixed(1)}</span>
      <span className="text-[10px] text-slate-400">({count})</span>
    </span>
  );
}

function GoodBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 whitespace-nowrap">
      ⭐ Good performance
    </span>
  );
}

function Avatar({ name, online, size = "h-9 w-9 text-xs" }) {
  return (
    <span className={`relative inline-flex ${size} shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-800`}>
      {initials(name)}
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />}
    </span>
  );
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("week");
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(
    async ({ silent = false } = {}) => {
      try {
        const res = await managerApi.leaderboard(period);
        const rows = res.data?.riders || [];
        setRiders(rows);
        setSelected((prev) => new Set([...prev].filter((id) => rows.some((r) => r.id === id))));
        setError("");
      } catch (err) {
        if (!silent) setError(err.response?.data?.message || "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    },
    [period]
  );

  useLive(load, [load]);

  const pagination = usePagination(riders, { resetDeps: [period] });
  const goodIds = useMemo(() => riders.filter((r) => r.isGoodPerformance).map((r) => r.id), [riders]);
  const allSelected = riders.length > 0 && selected.size === riders.length;

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const giveIncentive = () => {
    navigate("/incentives/create", {
      state: allSelected ? { audience: "all" } : { audience: "specific", riderIds: [...selected] },
    });
  };

  const changePeriod = (value) => {
    setLoading(true);
    setPeriod(value);
  };

  return (
    <PageShell>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">🏆 Driver Leaderboard</h1>
          <p className="text-xs text-slate-500">
            Ranked by delivered orders, delivery success, offer acceptance and customer rating.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => changePeriod(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                period === value ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">Loading leaderboard…</div>
      ) : riders.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">
          No riders at this store yet.
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xs">
            <span className="text-xs font-bold text-slate-700">Select for incentive:</span>
            <button
              type="button"
              onClick={() => setSelected(new Set(riders.map((r) => r.id)))}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
            >
              All drivers ({riders.length})
            </button>
            <button
              type="button"
              disabled={!goodIds.length}
              onClick={() => setSelected(new Set(goodIds))}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              ⭐ Good performers ({goodIds.length})
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500">{selected.size} selected</span>
              <button
                type="button"
                disabled={!selected.size}
                onClick={giveIncentive}
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                🎁 Give incentive{selected.size ? ` to ${allSelected ? "all" : selected.size}` : ""}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(riders.map((r) => r.id)))}
                      className="h-4 w-4 accent-emerald-600"
                      aria-label="Select all drivers"
                    />
                  </th>
                  <th className="px-3 py-2.5">Rank</th>
                  <th className="px-3 py-2.5">Driver</th>
                  <th className="px-3 py-2.5">Customer rating</th>
                  <th className="px-3 py-2.5 text-right">Delivered</th>
                  <th className="px-3 py-2.5 text-right">Success</th>
                  <th className="px-3 py-2.5 text-right">Acceptance</th>
                  <th className="px-3 py-2.5 text-right">Distance</th>
                  <th className="px-3 py-2.5 text-right">Earnings</th>
                  <th className="px-3 py-2.5">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pageRows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => toggle(r.id)}
                    className={`cursor-pointer transition ${selected.has(r.id) ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 accent-emerald-600"
                        aria-label={`Select ${r.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-sm font-black text-slate-700">#{r.rank}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.name} online={r.status !== "offline"} />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{r.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {r.phone} · {r.employmentType === "FULL_TIME" ? "Full-Time" : "Part-Time"}
                          </p>
                          {r.isGoodPerformance && <div className="mt-1"><GoodBadge /></div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Stars rating={r.rating} count={r.ratingsCount} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                      {r.delivered}
                      {r.failed > 0 && <span className="ml-1 text-[10px] font-semibold text-rose-500">({r.failed} failed)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{pct(r.successRate)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-700">
                      {pct(r.acceptanceRate)}
                      {r.offers > 0 && <span className="block text-[10px] font-normal text-slate-400">{r.offers} offers</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{r.distanceKm} km</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">₹{r.earnings.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.score}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-800">{r.score}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} />

          <p className="text-[11px] text-slate-400">
            Score out of 100: deliveries 50% (compared with the top driver), delivery success 20%, offer acceptance 15%,
            customer rating 15%. "Good performance" means a customer rating of 4★ or more (drivers not rated yet count
            as 5★) — the same drivers a gig's "Good Performance" audience pays.
          </p>
        </>
      )}
    </PageShell>
  );
}
