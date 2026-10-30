import { useState } from "react";
import { Link } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { Icon } from "../../components/ui/Icon";
import { useLive } from "../../realtime/useLive";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const TONES = {
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

const DOTS = {
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async ({ silent = false } = {}) => {
    try {
      const res = await managerApi.dashboard();
      if (res.data?.summary) setSummary(res.data.summary);
      setError("");
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useLive(fetchDashboardData, []);

  const s = summary || {};

  const stats = [
    { label: "New orders", value: s.incomingOrders ?? 0, icon: "orders", tone: "emerald", to: "/orders" },
    { label: "Out for delivery", value: s.outForDelivery ?? 0, icon: "scooter", tone: "sky", to: "/orders" },
    { label: "Delivered today", value: s.deliveredToday ?? 0, icon: "check", tone: "emerald", to: "/orders" },
    {
      label: "Riders online",
      value: `${s.ridersOnline ?? 0}/${s.ridersTotal ?? 0}`,
      icon: "truck",
      tone: "violet",
      to: "/drivers",
    },
    { label: "Pre-orders to assign", value: s.preOrdersReadyToAssign ?? 0, icon: "clock", tone: "amber", to: "/preorders" },
    { label: "Cash pending", value: rupee(s.cashPending), icon: "cash", tone: "slate", to: "/orders" },
    { label: "Low stock items", value: s.lowStockItems ?? 0, icon: "box", tone: "rose", to: "/stock" },
    { label: "Inventory SKUs", value: s.inventorySkus ?? 0, icon: "bag", tone: "slate", to: "/stock" },
  ];

  const attention = [
    { label: "Failed deliveries awaiting decision", value: s.failedAwaitingDecision, to: "/orders", tone: "rose" },
    { label: "Online payments to approve", value: s.onlinePaymentApprovals, to: "/orders", tone: "sky" },
    { label: "Orders waiting for a rider", value: s.waitingForRider, to: "/orders", tone: "amber" },
    { label: "Pickup photos to approve", value: s.pickupProofPending, to: "/orders", tone: "amber" },
    { label: "Rider applications", value: s.pendingDrivers, to: "/drivers/pending", tone: "violet" },
    { label: "Restock requests pending", value: s.pendingInventoryRequests, to: "/stock", tone: "slate" },
    { label: "Pre-orders with vendor", value: s.preOrdersWithProductManager, to: "/preorders", tone: "slate" },
  ];
  const openItems = attention.filter((a) => Number(a.value) > 0);

  const shortcuts = [
    { to: "/orders", label: "Orders", icon: "orders" },
    { to: "/revenue", label: "Revenue", icon: "chart" },
    { to: "/preorders", label: "Pre-Orders", icon: "clock" },
    { to: "/drivers", label: "Riders", icon: "truck" },
    { to: "/stock", label: "Stock", icon: "box" },
    { to: "/shifts", label: "Shifts", icon: "calendar" },
    { to: "/alerts", label: "Alerts", icon: "bell" },
  ];

  return (
    <PageShell
      title="Dashboard"
      actions={
        <>
          <button type="button" onClick={() => fetchDashboardData()} className="btn-outline">
            Refresh
          </button>
          <Link to="/orders" className="btn-primary">
            Orders{s.incomingOrders > 0 ? ` (${s.incomingOrders})` : ""}
          </Link>
        </>
      }
    >
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <Link
        to="/revenue"
        className="card flex flex-wrap items-center justify-between gap-4 p-5 transition hover:border-emerald-300"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Icon name="chart" size="md" />
          </span>
          <div>
            <p className="stat-label">Revenue till date</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {loading ? "—" : rupee(s.revenueToDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="stat-label">Today</p>
            <p className="text-lg font-bold tabular-nums text-emerald-700">{loading ? "—" : rupee(s.revenueToday)}</p>
          </div>
          <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
            View report
            <Icon name="arrowRight" size="sm" />
          </span>
        </div>
      </Link>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-xl bg-slate-200/60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((st) => (
            <Link key={st.label} to={st.to} className="card flex items-center gap-4 p-4 transition hover:border-slate-300">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONES[st.tone]}`}>
                <Icon name={st.icon} size="md" />
              </span>
              <div className="min-w-0">
                <p className="stat-label truncate">{st.label}</p>
                <p className="stat-value">{st.value}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Needs attention</h2>
            {openItems.length > 0 && <span className="badge bg-rose-50 text-rose-700">{openItems.length}</span>}
          </div>
          {openItems.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm font-medium text-slate-500">
              <Icon name="check" size="sm" className="text-emerald-500" />
              All clear
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {openItems.map((a) => (
                <li key={a.label}>
                  <Link to={a.to} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50">
                    <span className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <span className={`h-2 w-2 rounded-full ${DOTS[a.tone]}`} />
                      {a.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-slate-900">{a.value}</span>
                      <Icon name="arrowRight" size="sm" className="text-slate-400" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Shortcuts</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 p-3">
            {shortcuts.map((sc) => (
              <Link
                key={sc.to}
                to={sc.to}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-100 px-2 py-3 text-xs font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <Icon name={sc.icon} size="md" className="text-slate-500" />
                {sc.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
