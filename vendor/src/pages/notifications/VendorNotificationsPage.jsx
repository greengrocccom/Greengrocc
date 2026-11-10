import { useMemo, useState } from "react";
import { Bell, CalendarDays, Check, CheckCheck, Megaphone, RefreshCw, Search, StickyNote } from "lucide-react";
import {
  formatNotificationTime,
  notificationMeta,
  useVendorNotifications,
} from "../../context/VendorNotificationsContext";
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from "../../utils/ui";

const KIND_FILTERS = [
  { id: "all", label: "All", icon: Bell },
  { id: "announcement", label: "Announcements", icon: Megaphone },
  { id: "holiday", label: "Holidays", icon: CalendarDays },
  { id: "note", label: "Notes & shifts", icon: StickyNote },
];

const matchesKind = (item, kind) => {
  if (kind === "all") return true;
  if (kind === "note") return item.kind === "note" || item.kind === "shift";
  if (kind === "announcement") return !["holiday", "note", "shift"].includes(item.kind);
  return item.kind === kind;
};

const fullDate = (item) =>
  Number.isNaN(item.time)
    ? ""
    : new Date(item.time).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

export default function VendorNotificationsPage() {
  const { items, unreadCount, loading, refresh, markRead, markAllRead } = useVendorNotifications();
  const [kind, setKind] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (unreadOnly && item.read) return false;
      if (!matchesKind(item, kind)) return false;
      if (!q) return true;
      return `${item.title} ${item.body}`.toLowerCase().includes(q);
    });
  }, [items, kind, unreadOnly, query]);

  const counts = useMemo(
    () => Object.fromEntries(KIND_FILTERS.map((f) => [f.id, items.filter((i) => matchesKind(i, f.id)).length])),
    [items],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const summary = [
    ["Total (7 days)", items.length, "text-slate-900"],
    ["Unread", unreadCount, "text-rose-600"],
    ["Announcements", counts.announcement, "text-violet-700"],
    ["Holidays", counts.holiday, "text-rose-700"],
  ];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className={PAGE_KICKER}>Inbox</div>
          <h1 className={PAGE_TITLE}>Notifications</h1>
          <p className={PAGE_SUB}>Announcements, holidays and notes from GreenGrocc admin. Items older than 7 days are hidden.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onRefresh} className={`${BTN} gap-1.5`} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={markAllRead} disabled={!unreadCount} className={`${BTN_PRIMARY} gap-1.5`}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map(([label, value, tone]) => (
          <div key={label} className={`${PANEL} px-4 py-3`}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${tone}`}>{value ?? 0}</div>
          </div>
        ))}
      </div>

      <div className={`${PANEL} flex flex-col gap-3 p-3 lg:flex-row lg:items-center`}>
        <div className="flex flex-wrap gap-1.5">
          {KIND_FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                kind === id
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
              <span className={`rounded-full px-1.5 text-[10px] ${kind === id ? "bg-white/20" : "bg-slate-100"}`}>{counts[id]}</span>
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 lg:ml-auto">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Unread only
        </label>
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${INPUT} pl-9`} placeholder="Search notifications" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className={`${PANEL} overflow-hidden`}>
        {loading ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">Loading notifications…</p>
        ) : visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Bell className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {unreadOnly ? "No unread notifications" : "No notifications in the last 7 days"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((item) => {
              const meta = notificationMeta(item.kind, item.status);
              return (
                <li key={item.key} className={`flex gap-3 px-5 py-4 ${item.read ? "" : "bg-emerald-50/40"}`}>
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? "bg-slate-200" : meta.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${meta.tone}`}>
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-slate-400" title={fullDate(item)}>
                        {formatNotificationTime(item)}
                      </span>
                      {!item.read ? <span className="text-[10px] font-bold uppercase text-rose-600">New</span> : null}
                    </div>
                    <p className={`mt-1 text-sm ${item.read ? "font-medium text-slate-700" : "font-semibold text-slate-900"}`}>{item.title}</p>
                    {item.body ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{item.body}</p> : null}
                  </div>
                  {!item.read ? (
                    <button
                      type="button"
                      onClick={() => markRead(item.key)}
                      className={`${BTN} h-8 shrink-0 gap-1 self-start px-2.5 py-1 text-xs`}
                    >
                      <Check className="h-3.5 w-3.5" /> Mark read
                    </button>
                  ) : (
                    <span className="shrink-0 self-start text-[11px] font-medium text-slate-400">Read</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
