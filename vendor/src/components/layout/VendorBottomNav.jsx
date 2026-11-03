import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import QrScanModal from "../pickup/QrScanModal";
import { vendorApi } from "../../api/vendorApi";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { isBatchQrPayload, parseBatchQrPayload } from "../../utils/batchQr";
import { parseOrderQrPayload } from "../../utils/orderQr";

const ICON = "h-[22px] w-[22px]";

function StrokeIcon({ children, className = ICON }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function HomeIcon({ active }) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" className={ICON} fill="currentColor" aria-hidden>
        <path d="M12.38 3.12a.95.95 0 0 0-1.12.04L3.55 9.55A1.45 1.45 0 0 0 3 10.68V19.1c0 1.05.85 1.9 1.9 1.9H9.2v-6.35h5.6V21h4.3c1.05 0 1.9-.85 1.9-1.9v-8.42c0-.44-.2-.86-.55-1.13l-7.07-6.43z" />
      </svg>
    );
  }
  return (
    <StrokeIcon>
      <path d="M4.4 10.4 12 4.3l7.6 6.1V19.2c0 .72-.58 1.3-1.3 1.3h-4.4v-5.7H9.1v5.7H5.7c-.72 0-1.3-.58-1.3-1.3v-8.8z" />
    </StrokeIcon>
  );
}

function SearchIcon() {
  return (
    <StrokeIcon>
      <circle cx="11" cy="11" r="6.25" />
      <path d="m20 20-3.5-3.5" />
    </StrokeIcon>
  );
}

function BellIcon() {
  return (
    <StrokeIcon>
      <path d="M6.1 9a5.9 5.9 0 0 1 11.8 0c0 6.5 2.6 8.3 2.6 8.3H3.5S6.1 15.5 6.1 9" />
      <path d="M10 20.4a2.05 2.05 0 0 0 4 0" />
    </StrokeIcon>
  );
}

function HistoryIcon() {
  return (
    <StrokeIcon>
      <path d="M3.3 12a8.7 8.7 0 1 0 2.9-6.5" />
      <path d="M3.3 4.4v4.2h4.2" />
      <path d="M12 7.6V12l3.1 1.85" />
    </StrokeIcon>
  );
}

function ScanQrIcon({ className = "h-[26px] w-[26px]" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 3.5H5.4A1.9 1.9 0 0 0 3.5 5.4V8" />
      <path d="M16 3.5h2.6A1.9 1.9 0 0 1 20.5 5.4V8" />
      <path d="M8 20.5H5.4A1.9 1.9 0 0 1 3.5 18.6V16" />
      <path d="M16 20.5h2.6A1.9 1.9 0 0 0 20.5 18.6V16" />
      <rect x="7" y="7" width="4.4" height="4.4" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="12.6" y="7" width="4.4" height="4.4" rx="0.7" />
      <rect x="7" y="12.6" width="4.4" height="4.4" rx="0.7" />
      <path d="M13.1 13.1h1.7v1.7h-1.7zM16.4 13.1h1.2v1.7h-1.2zM13.1 16.3H15v1.6h-1.9zM16.2 16.3h1.4v1.6h-1.4z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const TABS = [
  { to: "/dashboard", label: "Home", icon: HomeIcon, end: true },
  { to: "/vendor/search", label: "Search", icon: SearchIcon },
  { to: "/vendor/notifications", label: "Alerts", icon: BellIcon },
  { to: "/vendor/pickups/all", label: "History", icon: HistoryIcon },
];

function TabLink({ to, label, icon: TabIcon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="flex min-h-0 flex-col items-center justify-end gap-[5px] pb-2.5 pt-2"
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? "text-[#217346]" : "text-slate-400"}>
            <TabIcon active={isActive} />
          </span>
          <span
            className={`text-[10px] leading-none tracking-[0.01em] ${
              isActive ? "font-semibold text-[#217346]" : "font-medium text-slate-400"
            }`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function isBatchQr(value) {
  return isBatchQrPayload(value);
}

function isAtCentre(pickup) {
  const status = String(pickup?.status || "").toUpperCase();
  if (["IN_TRANSIT", "ARRIVED_AT_CENTRE", "PICKED_UP", "PICKUP_CONFIRMED"].includes(status)) return true;
  return status === "COLLECTION_CENTRE_RECEIVED" && String(pickup?.receiving?.status || "").toUpperCase() !== "RECEIVED";
}

export default function VendorBottomNav() {
  const navigate = useNavigate();
  const { vendor } = useVendorAuth();
  const isSeller = vendor?.vendorType === "seller";
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState("");

  const activeTabs = isSeller
    ? [
        TABS[0],
        TABS[1],
        TABS[2],
        { to: "/vendor/inventory/history", label: "History", icon: HistoryIcon },
      ]
    : TABS;

  const openScanned = async (value) => {
    if (isBatchQr(value)) {
      const batchId = parseBatchQrPayload(value);
      if (batchId) {
        setScanOpen(false);
        setScanError("");
        navigate(`/vendor/batches/${encodeURIComponent(batchId)}`);
        return;
      }
    }

    let pickups = [];
    try {
      const res = await vendorApi.getPickups({ filter: "all" });
      pickups = Array.isArray(res.data) ? res.data : [];
    } catch {
      pickups = [];
    }

    const orderId = parseOrderQrPayload(value);
    const match = pickups.find((p) => {
      const oid = String(p.orderDisplayId || p.orderId || p.id || "");
      const qr = String(p.qrPayload || "");
      return (
        (orderId && oid && (oid === orderId || oid.includes(orderId) || orderId.includes(oid))) ||
        (qr && String(value).includes(qr)) ||
        (oid && String(value).includes(oid))
      );
    });
    if (match) {
      setScanOpen(false);
      setScanError("");
      navigate(isAtCentre(match) ? `/vendor/collection-centre/${match.id}` : `/vendor/pickups/${match.id}`);
      return;
    }

    setScanError("QR does not match a batch or order.");
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
        aria-label="Vendor shortcuts"
      >
        <div className="border-t border-black/[0.05] bg-white/95 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          <div className="relative h-[4.15rem]">
            <div className="grid h-full grid-cols-5">
              <TabLink {...activeTabs[0]} />
              <TabLink {...activeTabs[1]} />
              <div aria-hidden />
              <TabLink {...activeTabs[2]} />
              <TabLink {...activeTabs[3]} />
            </div>
            <button
              type="button"
              aria-label="Scan QR"
              onClick={() => {
                setScanError("");
                setScanOpen(true);
              }}
              className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#217346] text-white shadow-[0_8px_20px_rgba(33,115,70,0.35)] ring-[5px] ring-white transition active:scale-95"
            >
              <ScanQrIcon />
            </button>
          </div>
        </div>
      </nav>

      <QrScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan any QR"
        hint="Align a batch or order QR inside the frame"
        error={scanError}
        onScan={openScanned}
      />
    </>
  );
}
