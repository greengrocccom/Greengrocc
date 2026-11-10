import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDriverAuth } from "../../context/DriverAuthContext";
import { driverApi } from "../../api/driverApi";
import RoleAnnouncements from "../RoleAnnouncements";

const NAV = [
  { to: "/driver", label: "Dashboard", short: "Home", end: true },
  { to: "/driver/assigned", label: "Assigned Pickups", short: "Assigned" },
  { to: "/driver/progress", label: "In Progress", short: "Progress" },
  { to: "/driver/completed", label: "Completed Pickups", short: "Done" },
  { to: "/driver/history", label: "Pickup History", short: "History" },
  { to: "/driver/policies", label: "Policies", short: "Policies" },
  { to: "/driver/leave", label: "Apply Leave", short: "Leave" },
];

export default function DriverLayout() {
  const { driver, logout } = useDriverAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/vendor/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <aside className="fixed left-0 top-0 hidden h-screen w-56 flex-col bg-green-dark text-white md:flex">
        <div className="px-5 py-6">
          <p className="text-sm font-bold">GreenGrocc</p>
          <p className="text-xs text-white/60">Pickup Orders</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm ${isActive ? "bg-green-primary font-medium" : "text-white/80 hover:bg-white/10"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-3 py-4">
          <p className="mb-2 truncate px-3 text-xs text-white/60">{driver?.name}</p>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <div>
          <p className="text-sm font-bold text-gray-900">GreenGrocc</p>
          <p className="text-[11px] text-gray-500">{driver?.name || "Pickup Orders"}</p>
        </div>
        <button type="button" className="text-xs font-semibold text-[#217346]" onClick={onLogout}>
          Logout
        </button>
      </header>

      <div className="min-h-screen pb-20 md:ml-56 md:pb-0">
        <div className="px-4 pt-4">
          <RoleAnnouncements
            roleKey="pickup_driver"
            load={() => driverApi.liveAnnouncements()}
            loadCalendar={() => driverApi.liveCalendar()}
          />
        </div>
        <Outlet />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-gray-200 bg-white md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-14 items-center justify-center px-0.5 text-center text-[10px] font-semibold ${
                isActive ? "bg-[#E8F5E9] text-[#217346]" : "text-gray-500"
              }`
            }
          >
            {item.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
