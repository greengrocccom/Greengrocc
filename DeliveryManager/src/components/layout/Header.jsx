import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "../ui/Icon";

const getPageTitle = (pathname) => {
  if (pathname === "/shifts") return "Part-Time Shifts & Slots";
  if (pathname === "/shifts/create") return "Create Part-Time Shift";
  if (pathname === "/shifts/fulltime") return "Full-Time Shifts";
  if (pathname.startsWith("/shifts/fulltime/")) return "Full-Time Shift Setup";
  if (pathname === "/fulltime/rules") return "Full-Time Rules";
  if (pathname === "/fulltime/assign-orders") return "Assign Orders";
  if (pathname === "/drivers") return "Delivery Partners Roster";
  if (pathname === "/drivers/fulltime") return "Full-Time Riders";
  if (pathname === "/drivers/parttime") return "Part-Time Riders";
  if (pathname.startsWith("/drivers/pending")) return "Rider KYC Verification";
  if (pathname.startsWith("/drivers/")) return "Delivery Partner Details";
  if (pathname === "/dashboard") return "Operations Dashboard";
  if (pathname === "/orders") return "Orders Management";
  if (pathname.startsWith("/orders/")) return "Order Details";
  if (pathname === "/revenue") return "Revenue Reports";
  if (pathname === "/products") return "Products Catalog";
  if (pathname === "/stock") return "Inventory & Stock";
  if (pathname === "/preorders") return "Pre-Orders";
  if (pathname === "/return-pickups") return "Return Pickups";
  if (pathname.startsWith("/incentives")) return "Gigs & Incentives";
  if (pathname === "/alerts") return "Alerts";
  return "GreenRow Store Manager";
};

export default function Header({ onMobileMenuToggle }) {
  const { manager, logout } = useAuth();
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const locationStr = [manager?.area, manager?.city].filter(Boolean).join(", ");
  const isRiderRosterPage = ["/drivers/fulltime", "/drivers/parttime"].includes(location.pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
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
        {isRiderRosterPage ? (
          <div className="relative w-64 md:w-80">
            <span className="absolute left-3 top-2.5 text-slate-400">
              <Icon name="search" size="sm" />
            </span>
            <input
              type="text"
              placeholder="Search riders, orders, packages..."
              className="h-9 w-full rounded-full border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-xs text-slate-700 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
            />
          </div>
        ) : (
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-sm md:text-base font-bold text-slate-900">{pageTitle}</h1>
            <p className="truncate text-[11px] text-slate-500 font-medium">{locationStr || "Dark Store Hub"}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <a
          href="/alerts"
          className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
          title="Alerts"
        >
          <Icon name="bell" size="sm" />
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            3
          </span>
        </a>

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 shadow-2xs">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#064e3b] text-xs font-bold text-white">
            {manager?.name ? manager.name.charAt(0).toUpperCase() : "M"}
          </div>
          <span className="text-xs font-semibold text-slate-800">
            {manager?.name || "Manager"}
          </span>
          <span className="text-[10px] text-slate-400">⌵</span>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
    </header>
  );
}
