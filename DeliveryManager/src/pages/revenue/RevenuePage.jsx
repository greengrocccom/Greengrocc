import { useEffect, useMemo, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import FinanceDateFilter from "../../components/finance/FinanceDateFilter";
import { Icon } from "../../components/ui/Icon";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const TZ = "Asia/Kolkata";

const PERIODS = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
];

const COLUMNS = [
  { key: "start", label: "Period", align: "left" },
  { key: "orders", label: "Orders" },
  { key: "revenue", label: "Revenue" },
  { key: "cod", label: "COD" },
  { key: "online", label: "Online" },
  { key: "avgOrder", label: "Avg order" },
  { key: "riderPayout", label: "Rider payout" },
];

const fmt = (date, opts) => new Date(date).toLocaleDateString("en-IN", { timeZone: TZ, ...opts });

function periodLabel(start, period) {
  if (period === "month") return fmt(start, { month: "long", year: "numeric" });
  if (period === "week") {
    const end = new Date(new Date(start).getTime() + 6 * 86400000);
    return `${fmt(start, { day: "2-digit", month: "short" })} – ${fmt(end, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
  }
  return fmt(start, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

export default function RevenuePage() {
  const [period, setPeriod] = useState("day");
  const [dateFilter, setDateFilter] = useState({
    preset: "all",
    startDate: "",
    endDate: "",
  });

  const [data, setData] = useState({ rows: [], totals: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "start", dir: "desc" });

  const load = async () => {
    setLoading(true);
    try {
      const res = await managerApi.revenue({
        period,
        preset: dateFilter.preset,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        from: dateFilter.startDate,
        to: dateFilter.endDate,
      });
      setData({ rows: res.data?.rows || [], totals: res.data?.totals || null });
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load revenue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, dateFilter]);

  const rows = useMemo(() => {
    const list = [...data.rows];
    const { key, dir } = sort;
    list.sort((a, b) => {
      const av = key === "start" ? new Date(a.start).getTime() : Number(a[key] || 0);
      const bv = key === "start" ? new Date(b.start).getTime() : Number(b[key] || 0);
      return dir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [data.rows, sort]);

  const rangeTotal = useMemo(
    () =>
      data.rows.reduce(
        (acc, r) => ({
          orders: acc.orders + r.orders,
          revenue: acc.revenue + r.revenue,
          cod: acc.cod + r.cod,
          online: acc.online + r.online,
          riderPayout: acc.riderPayout + r.riderPayout,
        }),
        { orders: 0, revenue: 0, cod: 0, online: 0, riderPayout: 0 }
      ),
    [data.rows]
  );

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  const t = data.totals || {};
  const cards = [
    { label: "Today", value: t.today, orders: t.todayOrders },
    { label: "This week", value: t.week, orders: t.weekOrders },
    { label: "This month", value: t.month, orders: t.monthOrders },
    { label: "Till date", value: t.allTime, orders: t.allTimeOrders, highlight: true },
  ];

  return (
    <PageShell
      title="Revenue"
      actions={
        <button type="button" onClick={load} className="btn-outline">
          Refresh
        </button>
      }
    >
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`card p-4 ${c.highlight ? "border-emerald-200 bg-emerald-50/60" : ""}`}
          >
            <p className="stat-label">{c.label}</p>
            <p className={`stat-value ${c.highlight ? "text-emerald-700" : ""}`}>
              {data.totals ? rupee(c.value) : "—"}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">{c.orders ?? 0} orders delivered</p>
          </div>
        ))}
      </div>

            {/* Unified Date Filter */}
      <FinanceDateFilter
        preset={dateFilter.preset}
        startDate={dateFilter.startDate}
        endDate={dateFilter.endDate}
        onFilterChange={(newFilter) => setDateFilter(newFilter)}
      />

      <section className="card">
        <div className="card-header flex-wrap gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  period === p.id ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-500">Grouping: <span className="capitalize text-slate-800">{period}</span></span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-semibold ${col.align === "left" ? "text-left" : "text-right"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1 uppercase hover:text-slate-900 ${
                        sort.key === col.key ? "text-slate-900" : ""
                      }`}
                    >
                      {col.label}
                      <span className="text-[10px]">
                        {sort.key === col.key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Icon name="chart" size="sm" className="text-slate-400" />
                      No delivered orders in this range
                    </span>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.start} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{periodLabel(r.start, period)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.orders}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">{rupee(r.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{rupee(r.cod)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{rupee(r.online)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{rupee(r.avgOrder)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{rupee(r.riderPayout)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && rows.length > 0 && (
              <tfoot className="bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td className="px-4 py-3">Total ({rows.length})</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rangeTotal.orders}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupee(rangeTotal.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupee(rangeTotal.cod)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupee(rangeTotal.online)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {rupee(rangeTotal.orders ? Math.round(rangeTotal.revenue / rangeTotal.orders) : 0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupee(rangeTotal.riderPayout)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </PageShell>
  );
}
