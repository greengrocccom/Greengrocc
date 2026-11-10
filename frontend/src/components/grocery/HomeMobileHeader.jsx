import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { buildProductSearchUrl } from "../../utils/productSearch";
import { resolveStoreTheme } from "./homeHeaderThemes";
import { useSectionsQuery } from "../../hooks/queries/useSectionsQuery";
import { LOGO_URL } from "../layout/Header";
import {
  sectionToStoreKey,
  storeToSection,
  buildStoreProductUrl,
} from "../../utils/storeSection";
import OptimizedImg from "../common/OptimizedImg";
import LifetimeOrderSpend from "../layout/LifetimeOrderSpend";

export { sectionToStoreKey, storeToSection, buildStoreProductUrl };

function SearchIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

const STORE_ACCENT = {
  main: { text: "text-[#0C831F]", ring: "ring-emerald-600/15" },
  festive: { text: "text-[#B45309]", ring: "ring-amber-600/20" },
  mall: { text: "text-[#0C831F]", ring: "ring-emerald-600/15" },
};

function StoreIcon({ storeKey, className = "h-4 w-4" }) {
  const common = {
    className,
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (storeKey === "festive") {
    return (
      <svg {...common}>
        <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
        <path d="M6 17h12" />
      </svg>
    );
  }
  if (storeKey === "mall") {
    return (
      <svg {...common}>
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M12 14v3l2 1" />
    </svg>
  );
}

function ProfileButton({ theme }) {
  const { user, openAuthModal } = useAuth();
  const accent = STORE_ACCENT[theme.key] || STORE_ACCENT.main;
  const className = `flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ${accent.text} shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 transition active:scale-95`;

  const icon = (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );

  if (user) {
    return (
      <Link to="/profile" className={className} aria-label="Profile">
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => openAuthModal("login")} className={className} aria-label="Login">
      {icon}
    </button>
  );
}

function storeTabLabel(storeKey) {
  if (storeKey === "festive") return "Ready2Cook";
  if (storeKey === "mall") return "InstantOrder";
  return "PreOrder";
}

/** One segment of the store switcher — white card with the store accent when active. */
function StoreTab({ storeKey, isCurrentActive, onSelect, children }) {
  const accent = STORE_ACCENT[storeKey] || STORE_ACCENT.main;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isCurrentActive}
      onClick={() => onSelect(storeKey)}
      className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-1.5 text-[12px] tracking-tight transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10 ${
        isCurrentActive
          ? `bg-white font-bold ${accent.text} shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ${accent.ring}`
          : "font-semibold text-slate-500 hover:text-slate-700"
      }`}
    >
      <StoreIcon storeKey={storeKey} className="h-[15px] w-[15px] shrink-0" />
      {children}
    </button>
  );
}

const DEFAULT_STORE_SECTIONS = [
  { slug: "main", sectionName: "PreOrder" },
  { slug: "festive", sectionName: "Ready2Cook" },
  { slug: "mall", sectionName: "InstantOrder" },
];

/** Logo + profile + compact store tabs */
export function HomeDeliveryBar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: sections = [] } = useSectionsQuery();

  const currentStore = sectionToStoreKey(searchParams.get("store"));
  const theme = resolveStoreTheme(currentStore);

  const setStore = (storeKey) => {
    const nextParams = new URLSearchParams(searchParams);
    const key = sectionToStoreKey(storeKey);
    if (key === "main") nextParams.delete("store");
    else nextParams.set("store", key);
    nextParams.delete("categoryName");
    setSearchParams(nextParams);
  };

  const displaySections = sections.length ? sections : DEFAULT_STORE_SECTIONS;

  return (
    <div className={`${theme.deliveryBg} px-4 pb-0 pt-1.5 transition-colors duration-300`}>
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="min-w-0 shrink py-0.5 leading-none">
          <OptimizedImg
            src={LOGO_URL}
            alt="GreenGrocc"
            className="h-8 w-auto max-w-[130px] object-contain object-left sm:h-9 sm:max-w-[150px]"
          />
        </Link>
        <div className="flex items-center gap-1.5">
          <LifetimeOrderSpend compact />
          <ProfileButton theme={theme} />
        </div>
      </div>

      <div
        role="tablist"
        className="mt-2 flex w-full items-center gap-1 rounded-[12px] bg-slate-900/[0.05] p-[3px]"
      >
        {displaySections.map((sec) => {
          const storeKey = sectionToStoreKey(sec.slug || sec.storeType);
          const isCurrentActive = currentStore === storeKey;
          const label = String(sec.sectionName || "").trim() || storeTabLabel(storeKey);

          return (
            <StoreTab
              key={storeKey}
              storeKey={storeKey}
              isCurrentActive={isCurrentActive}
              onSelect={setStore}
            >
              <span className="truncate">{label}</span>
            </StoreTab>
          );
        })}
      </div>
    </div>
  );
}

/** Search + promo chip */
export function HomeSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchParams] = useSearchParams();
  const currentStore = sectionToStoreKey(searchParams.get("store"));
  const theme = resolveStoreTheme(currentStore);

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      navigate("/product");
      return;
    }
    navigate(buildProductSearchUrl(trimmed));
  };

  return (
    <div className={`${theme.searchBg || theme.contentBg} px-4 pb-1 pt-2 transition-colors duration-300`}>
      <div className="flex items-center gap-2">
        <form onSubmit={handleSearch} className="min-w-0 flex-1" role="search">
          <label className="flex h-9 items-center gap-2 rounded-[10px] bg-white px-3 ring-1 ring-slate-200 transition focus-within:ring-2 focus-within:ring-emerald-600/40">
            <SearchIcon className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={theme.placeholder}
              aria-label="Search products"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
            />
          </label>
        </form>

        <Link
          to="/coupons"
          aria-label="Offers"
          className={`flex h-9 shrink-0 items-center gap-1 rounded-[10px] bg-white px-2.5 ${(STORE_ACCENT[currentStore] || STORE_ACCENT.main).text} ring-1 ring-slate-200 transition active:scale-95`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
            <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
          </svg>
          <span className="text-[11.5px] font-bold leading-none">Offers</span>
        </Link>
      </div>
    </div>
  );
}

const STORE_PROMO_DATA = {
  main: {
    card1: {
      icon: "⚡",
      iconBg: "bg-emerald-100 text-emerald-800",
      title: "₹0 FEES",
      subtitle: "Free Delivery",
    },
    card2: {
      icon: "🏷️",
      iconBg: "bg-amber-100 text-amber-900",
      title: "Everyday Low Prices",
      subtitle: "Best Savings",
    },
    badges: ["₹0 Handling Fee", "₹0 Delivery Fee*", "₹0 Rain & Surge Fee"],
  },
  festive: {
    card1: {
      icon: "🍳",
      iconBg: "bg-amber-100 text-amber-900",
      title: "READY 2 COOK",
      subtitle: "Pre-washed & cut",
    },
    card2: {
      icon: "⏱️",
      iconBg: "bg-yellow-100 text-yellow-900",
      title: "10 MIN PREP",
      subtitle: "Save cooking time",
    },
    badges: ["100% Pre-washed", "Zero Preservatives", "Farm Fresh Daily"],
  },
};
STORE_PROMO_DATA.mall = STORE_PROMO_DATA.main;

export function ZeptoPromoSection() {
  const [searchParams] = useSearchParams();
  const currentStore = sectionToStoreKey(searchParams.get("store"));
  const theme = resolveStoreTheme(currentStore);
  const promo = STORE_PROMO_DATA[currentStore] || STORE_PROMO_DATA.main;

  return (
    <div className={`${theme.contentBg} px-4 pb-2.5 pt-1.5 transition-colors duration-300`}>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white p-2.5 shadow-xs transition hover:scale-[1.01]">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${promo.card1.iconBg}`}
          >
            {promo.card1.icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black leading-tight text-slate-900 sm:text-sm">{promo.card1.title}</p>
            <p className="mt-0.5 text-[10px] font-bold leading-none text-emerald-700">{promo.card1.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white p-2.5 shadow-xs transition hover:scale-[1.01]">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${promo.card2.iconBg}`}
          >
            {promo.card2.icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black leading-tight text-slate-900 sm:text-sm">{promo.card2.title}</p>
            <p className="mt-0.5 text-[10px] font-bold leading-none text-amber-800">{promo.card2.subtitle}</p>
          </div>
        </div>
      </div>

      <div className={`mt-2 flex items-center justify-between px-1 text-[10px] font-bold ${theme.textColor}`}>
        {promo.badges.map((label) => (
          <div key={label} className="flex items-center gap-1">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-black text-white">
              ✓
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeMobileHeader() {
  return (
    <div>
      <HomeDeliveryBar />
      <HomeSearchBar />
    </div>
  );
}

export default HomeMobileHeader;
