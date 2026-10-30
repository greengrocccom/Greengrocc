import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "../ui/Icon";

const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function Header({ onMobileMenuToggle }) {
  const { manager } = useAuth();
  const [time, setTime] = useState(clock());

  useEffect(() => {
    const timer = setInterval(() => setTime(clock()), 30000);
    return () => clearInterval(timer);
  }, []);

  const location = [manager?.area, manager?.city].filter(Boolean).join(", ");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 lg:hidden"
            title="Menu"
          >
            <Icon name="menu" size="sm" />
          </button>
        )}
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-slate-900">{manager?.storeName || "Dark Store"}</p>
          {location && <p className="truncate text-xs text-slate-500">{location}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 sm:inline-block">
          {time}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>
    </header>
  );
}
