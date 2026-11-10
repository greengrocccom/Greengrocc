import { useCallback, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { useLive } from "../../realtime/useLive";
import { PageShell } from "../../components/layout/ManagerLayout";
import { Icon } from "../../components/ui/Icon";
import { Pagination, usePagination } from "../../components/ui/Pagination";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const loadAlerts = useCallback(async () => {
    try {
      const params = filter === "unread" ? { unreadOnly: "true" } : {};
      const res = await managerApi.getAlerts(params);
      setAlerts(res.data?.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load store alerts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useLive(loadAlerts, [loadAlerts]);

  const pagination = usePagination(alerts, { resetDeps: [filter] });

  const onMarkRead = async (alertId) => {
    try {
      await managerApi.markAlertRead(alertId);
      await loadAlerts();
    } catch (err) {
      console.error("Failed to mark alert as read:", err);
    }
  };

  return (
    <PageShell
      title="Store Operational Alerts"
    >
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Alert Notifications ({alerts.length})</h2>
            <p className="text-xs text-slate-500">System generated alerts for stock delays, rider updates, and order exceptions</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  filter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Alerts
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  filter === "unread" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Unread Only
              </button>
            </div>

            <button
              type="button"
              onClick={loadAlerts}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-xs text-slate-500">Loading alerts feed…</p>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <p className="text-sm font-semibold text-slate-700">No alerts</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black text-white text-xs font-bold uppercase tracking-wider">
                  <th className="py-2 px-4">Timestamp</th>
                  <th className="py-2 px-4">Alert Type</th>
                  <th className="py-2 px-4">Message / Details</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pageRows.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-extrabold text-[10px] uppercase tracking-wider rounded-md bg-rose-50 px-2 py-0.5 text-rose-700 border border-rose-200">
                        {item.type || "SYSTEM ALERT"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{item.message}</div>
                      {item.relatedOrderId && (
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                          Order Status: <span className="font-semibold text-slate-700">{item.relatedOrderId.status || "Active"}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.isRead ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                          READ
                        </span>
                      ) : (
                        <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-bold text-white uppercase animate-pulse">
                          UNREAD
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => onMarkRead(item._id)}
                          className="rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                        >
                          Mark Read
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} />
          </>
        )}
      </div>
    </PageShell>
  );
}