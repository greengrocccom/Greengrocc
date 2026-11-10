import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  BadgeCheck,
  FileText,
  Landmark,
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Sprout,
  Truck,
  UserRound,
  IdCard,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { SIDEBAR_ITEMS, MANAGER_SIDEBAR_ITEMS } from "../../utils/constants";
import { setSidebarCollapsed, toggleSidebar, selectIsManager } from "../../store/farmerSlice";

const ICONS = {
  documents: FileText,
  dashboard: LayoutDashboard,
  market: TrendingUp,
  community: Users,
  schemes: Landmark,
  products: Package,
  crops: Sprout,
  harvest: ClipboardList,
  inventory: ClipboardList,
  orders: ShoppingCart,
  earnings: Wallet,
  profile: UserRound,
  farmers: Users,
  pickup: Truck,
  driver: IdCard,
  quality: BadgeCheck,
  calendar: CalendarDays,
};

function NavGroup({ item, collapsed, onNavigate }) {
  const location = useLocation();
  const path = location.pathname;
  const excluded = (item.excludeMatch || []).some((p) => path.startsWith(p));
  const isChildActive = !excluded && Boolean(
    (item.match && path.startsWith(item.match)) ||
      item.children?.some((child) => path.startsWith(String(child.to || "").split("?")[0]))
  );
  const [open, setOpen] = useState(isChildActive);
  const Icon = ICONS[item.icon] || Package;

  if (collapsed) {
    return (
      <NavLink
        to={item.children?.[0]?.to || "#"}
        title={item.label}
        onClick={onNavigate}
        className={() =>
          `group relative mx-2 mb-1 flex items-center justify-center rounded-xl px-2.5 py-2.5 text-sm font-medium transition ${
            isChildActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100"
          }`
        }
      >
        <Icon className={`h-5 w-5 shrink-0 ${isChildActive ? "text-emerald-700" : "text-slate-500"}`} strokeWidth={isChildActive ? 2.25 : 1.75} />
      </NavLink>
    );
  }

  return (
    <div className="mx-2 mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          isChildActive ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${isChildActive ? "text-emerald-700" : "text-slate-500"}`} strokeWidth={isChildActive ? 2.25 : 1.75} />
        <span className="flex-1 text-left leading-tight">{item.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-3">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `block rounded-lg px-2.5 py-2 text-sm transition ${
                  isActive ? "bg-white font-semibold text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function FarmerSidebar({ mobileOpen, onCloseMobile }) {
  const dispatch = useDispatch();
  const collapsed = useSelector((s) => s.farmer.sidebarCollapsed);
  const isManager = useSelector(selectIsManager);
  const farmer = useSelector((s) => s.farmer.farmer);

  const items = isManager ? MANAGER_SIDEBAR_ITEMS : SIDEBAR_ITEMS;
  const panelLabel = isManager ? "Manager Panel" : "Farmer Panel";
  const vendorName = isManager ? (farmer?.vendorName || "GreenGrocc") : "GreenGrocc";
  const compact = collapsed && !mobileOpen;

  const onNavigate = () => {
    onCloseMobile?.();
    if (window.innerWidth < 1024) dispatch(setSidebarCollapsed(false));
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden print:hidden"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-xl transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-0 lg:shadow-none print:hidden ${
          compact ? "w-[76px]" : "w-[min(272px,86vw)]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-100 px-3">
          {!compact ? (
            <div className="min-w-0 flex-1 px-1">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-xs font-bold text-white">
                  GG
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight text-slate-900">{vendorName}</p>
                  <p className="truncate text-xs leading-tight text-slate-500">{panelLabel}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-xs font-bold text-white">
                GG
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:inline-flex"
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            title={compact ? "Expand" : "Collapse"}
          >
            {compact ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="farmer-scrollbar flex-1 overflow-y-auto py-3">
          {items.map((item) => {
            if (item.children) {
              return <NavGroup key={item.id} item={item} collapsed={compact} onNavigate={onNavigate} />;
            }
            const Icon = ICONS[item.icon] || Package;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={compact ? item.label : undefined}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group relative mx-2 mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    compact ? "justify-center px-2.5" : ""
                  } ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-5 w-5 shrink-0 ${isActive ? "text-emerald-700" : "text-slate-500 group-hover:text-slate-700"}`}
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    {!compact ? <span className="truncate">{item.label}</span> : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export default FarmerSidebar;
