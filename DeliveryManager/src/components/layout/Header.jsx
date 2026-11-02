import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "../ui/Icon";

const getPageTitle = (pathname) => {
  if (pathname === "/shifts") return "Part-Time Shifts & Slots";
  if (pathname === "/shifts/create") return "Create Part-Time Shift";
  if (pathname === "/shifts/fulltime") return "Full-Time Shifts";
  if (pathname.startsWith("/shifts/fulltime/")) return "Full-Time Shift Setup";
  if (pathname === "/fulltime/attendance") return "Full-Time Employee Attendance";
  if (pathname === "/fulltime/salary") return "Full-Time Employee Salary";
  if (pathname === "/fulltime/rules") return "Full-Time Rules";
  if (pathname === "/fulltime/assign-orders") return "Assign Orders";
  if (pathname === "/drivers") return "Delivery Partners Roster";
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
  const { manager } = useAuth();
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const locationStr = [manager?.area, manager?.city].filter(Boolean).join(", ");

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
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-sm md:text-base font-bold text-slate-900">{pageTitle}</h1>
          <p className="truncate text-[11px] text-slate-500 font-medium">
            {locationStr || "Dark Store Hub"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
    </header>
  );
}
