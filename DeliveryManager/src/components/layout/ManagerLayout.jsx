import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Icon, LogoIcon } from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import Header from "./Header";
import StoreQrModal from "../StoreQrModal";

const navSections = [
  {
    title: "Operations",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: "home", end: true },
      { to: "/orders", label: "Orders", icon: "orders" },
      { to: "/revenue", label: "Revenue", icon: "chart" },
      { to: "/preorders", label: "Pre-Orders", icon: "clock" },
      { to: "/return-pickups", label: "Return Pickups", icon: "box" },
      { to: "/alerts", label: "Alerts", icon: "bell" },
    ],
  },
  {
    title: "Riders",
    items: [
      { to: "/drivers", label: "Riders", icon: "truck", end: true },
      { to: "/drivers/pending", label: "Verification", icon: "user" },
      {
        key: "shifts",
        label: "Shifts & Slots",
        icon: "calendar",
        children: [
          { to: "/shifts", label: "Shifts & Slots", end: true },
          { to: "/shifts/create", label: "Create Shift" },
          { to: "/shifts/fulltime", label: "Full-Time Shifts", end: true },
          { to: "/shifts/fulltime/create", label: "Create Full-Time Shift" },
        ],
      },
      {
        key: "fulltime",
        label: "Full-Time Staff",
        icon: "user",
        children: [
          { to: "/fulltime/assign-orders", label: "Assign Orders" },
          { to: "/fulltime/attendance", label: "Attendance" },
          { to: "/fulltime/salary", label: "Salary" },
          { to: "/fulltime/rules", label: "Rules" },
        ],
      },
      {
        key: "gigs",
        label: "Gigs & Incentives",
        icon: "trophy",
        children: [
          { to: "/incentives", label: "My Gigs", end: true },
          { to: "/incentives/create", label: "Create Gig" },
        ],
      },
    ],
  },
  {
    title: "Store",
    items: [
      { to: "/products", label: "Products", icon: "bag" },
      { to: "/stock", label: "Stock", icon: "box" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { to: "/announcements", label: "Announcements", icon: "megaphone" },
      { to: "/policies", label: "Policies", icon: "clipboard" },
      { to: "/meetings", label: "Meetings", icon: "video" },
      { to: "/leave", label: "Leave", icon: "calendar" },
      { to: "/support", label: "Support", icon: "support" },
    ],
  },
];

const isPathActive = (pathname, item) =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

const itemClass = (active) =>
  `group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
    active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
  }`;

export default function ManagerLayout() {
  const { logout, manager } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState({});

  const toggleDropdown = (key) => {
    setOpenDropdowns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const darkStoreQr = `DARKSTORE_${manager?.id || manager?._id || ""}`;

  const renderItem = (item) => {
    if (item.children) {
      const childActive = item.children.some((c) => isPathActive(location.pathname, c));
      const isOpen = openDropdowns[item.key] ?? childActive;
      return (
        <div key={item.key}>
          <button type="button" onClick={() => toggleDropdown(item.key)} className={itemClass(childActive && !isOpen)}>
            <Icon name={item.icon} size="sm" className={childActive ? "text-emerald-400" : ""} />
            <span className="flex-1 truncate text-left">{item.label}</span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {isOpen && (
            <div className="ml-[22px] mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
              {item.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.end}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) =>
                    `block truncate rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition ${
                      isActive ? "bg-white/10 text-emerald-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
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

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={() => setIsMobileOpen(false)}
        className={({ isActive }) => itemClass(isActive)}
      >
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-emerald-400" />}
            <Icon name={item.icon} size="sm" className={isActive ? "text-emerald-400" : ""} />
            <span className="flex-1 truncate">{item.label}</span>
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col bg-slate-950 text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <LogoIcon className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">GreenRow</p>
              <p className="text-[11px] font-medium text-slate-400">Store Manager</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="rounded-md p-1 text-slate-400 hover:bg-white/10 lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
              <div className="space-y-0.5">{section.items.map(renderItem)}</div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-sm font-bold text-emerald-300">
              {manager?.name ? manager.name.charAt(0).toUpperCase() : "M"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{manager?.name || "Manager"}</p>
              <p className="truncate text-[11px] text-slate-400">{manager?.phone || manager?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              title="Logout"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-rose-400"
            >
              <Icon name="power" size="sm" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0">
          <Header onMobileMenuToggle={() => setIsMobileOpen((prev) => !prev)} />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl space-y-5">
            <Outlet />
          </div>
        </main>
      </div>

      <StoreQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        storeName={manager?.storeName}
        area={manager?.area}
        qrCode={darkStoreQr}
      />
    </div>
  );
}

export function PageShell({ title, meta, actions, children }) {
  return (
    <div className="space-y-5">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {title && <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{title}</h1>}
            {meta && <p className="mt-0.5 text-xs font-medium text-slate-500">{meta}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
