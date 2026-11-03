import { Link } from "react-router-dom";
import {
  Menu,
  Plus,
  Store,
} from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { useInventoryRequests } from "../../hooks/useInventoryRequests";
import AjaxLiveSearchWidget from "../search/AjaxLiveSearchWidget";
import VendorNotificationBell from "./VendorNotificationBell";

export default function VendorTopNavbar({ onOpenMobileMenu }) {
  const { vendor } = useVendorAuth();
  const isSeller = vendor?.vendorType === 'seller';
  const { requests } = useInventoryRequests();
  const pendingRequestsCount = requests.filter((r) => r.status === "pending").length;

  const vendorName = vendor?.vendorName || vendor?.ownerName || "Vendor";
  const vendorInitial = vendorName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 py-1.5 backdrop-blur-md sm:gap-4 sm:px-5 sm:py-2 print:hidden">
      {/* Left: Mobile Menu & Breadcrumb */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700 text-xs font-bold text-white shadow-xs">
            GG
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight text-slate-900">GreenGroo</p>
            <p className="text-[10px] leading-tight text-emerald-700 font-semibold">
              {isSeller ? 'Seller Executive' : 'Vendor Executive'}
            </p>
          </div>
        </div>
      </div>

      {/* Center: Ajax Live Search Bar */}
      <div className="relative min-w-0 flex-1 max-w-xl">
        <AjaxLiveSearchWidget
          mode="navbar"
          placeholder={
            isSeller
              ? "Search products, varieties, categories (e.g. Alphonso Mango, Tomato)..."
              : "Search farmers, crops, products, varieties (e.g. tamatar, aloo)..."
          }
        />
      </div>

      {/* Right: Actions & User Profile */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Quick Restock Notification */}
        <Link
          to="/vendor/orders/darkstore"
          className="relative inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-slate-700 shadow-xs transition hover:bg-slate-50"
          title="Dark store restock requests"
        >
          <Store className="h-4 w-4" />
          {pendingRequestsCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow-xs">
              {pendingRequestsCount}
            </span>
          ) : null}
          <span className="ml-1.5 hidden text-xs font-semibold text-slate-700 md:inline">Restock</span>
        </Link>

        <VendorNotificationBell />

        {/* Create Order Quick Action */}
        <Link
          to="/vendor/orders/create"
          className="hidden items-center gap-1 rounded-xl bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800 sm:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Order</span>
        </Link>

        {/* Profile Pill */}
        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 pr-2.5 transition hover:bg-slate-50 sm:p-1 sm:pr-3"
          title="My Profile"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">
            {vendorInitial}
          </div>
          <div className="hidden text-left sm:block">
            <p className="max-w-[100px] truncate text-xs font-bold leading-tight text-slate-800">
              {vendorName}
            </p>
            <p className="text-[10px] leading-tight text-slate-400">
              {isSeller ? 'Seller' : 'Vendor'}
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
