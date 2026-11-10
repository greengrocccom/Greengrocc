import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Loader2,
  ChevronRight,
  TrendingUp,
  History,
  Sprout,
  User,
  Package,
  GripVertical,
  SlidersHorizontal,
  ExternalLink,
  Code2,
  Check,
  Sparkles,
  Command,
  ArrowUpRight,
  AlertCircle,
  MapPin,
  Phone,
  Layers,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import {
  expandQuery,
  highlightMatch,
  getSearchHistory,
  saveSearchHistory,
  removeSearchHistoryItem,
  clearSearchHistory,
  getSavedWidgetDock,
  saveWidgetDock,
} from "../../utils/searchEngine";

/**
 * Modes supported:
 * - 'navbar': Sleek top navbar input with floating dropdown
 * - 'standalone': Full-width search bar with scope pills & draggable frame
 * - 'card': Dashboard widget card with drag handle
 * - 'compact': Small quick-search button/input
 */
export default function AjaxLiveSearchWidget({
  mode = "navbar",
  placeholder = "Search products, farmers, crops, varieties...",
  defaultScope = "all", // 'all' | 'products' | 'farmers' | 'crops'
  isDraggable = true,
  onDockChange,
  className = "",
  autoFocus = false,
}) {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(defaultScope);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    products: [],
    farmers: [],
    crops: [],
    suggestions: [],
  });
  const [didYouMean, setDidYouMean] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [executionMs, setExecutionMs] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const activeRequestRef = useRef(0);

  // Load history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  // Global hotkey: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live Ajax search fetcher
  const executeSearch = useCallback(async (q, searchScope) => {
    const trimmed = q.trim();
    const requestId = ++activeRequestRef.current;
    setLoading(true);

    try {
      const res = await vendorApi.liveSearch({
        q: trimmed,
        scope: searchScope,
        limit: 8,
      });

      if (requestId !== activeRequestRef.current) return;

      const data = res.data || {};
      const resData = data.results || {};
      setResults({
        products: Array.isArray(resData.products) ? resData.products : [],
        farmers: Array.isArray(resData.farmers) ? resData.farmers : [],
        crops: Array.isArray(resData.crops) ? resData.crops : [],
        suggestions: Array.isArray(resData.suggestions) ? resData.suggestions : [],
      });
      setDidYouMean(data.didYouMean || null);
      setTotalCount(data.total || 0);
      setExecutionMs(data.metrics?.executionMs || 0);
      setSelectedIndex(-1);
    } catch (err) {
      if (requestId !== activeRequestRef.current) return;
      console.warn("[Live Search] API fallback:", err.message);
      // Fallback: If network or offline, provide graceful empty state
      setResults({ products: [], farmers: [], crops: [], suggestions: [] });
      setTotalCount(0);
    } finally {
      if (requestId === activeRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Debounced input change
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val, scope);
    }, 160);
  };

  // Scope filter change
  const handleScopeChange = (newScope) => {
    setScope(newScope);
    executeSearch(query, newScope);
  };

  // Keyboard navigation
  const flatItems = [
    ...results.products.map((p) => ({ type: "product", data: p })),
    ...results.farmers.map((f) => ({ type: "farmer", data: f })),
    ...results.crops.map((c) => ({ type: "crop", data: c })),
  ];

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && flatItems[selectedIndex]) {
        handleSelectItem(flatItems[selectedIndex]);
      } else {
        handleFullSearch();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Navigate to selected item
  const handleSelectItem = (item) => {
    saveSearchHistory(query || item.data.name || item.data.cropName);
    setSearchHistory(getSearchHistory());
    setIsOpen(false);

    if (item.type === "product") {
      if (item.data.farmerId) {
        navigate(`/vendor/farmer-products?q=${encodeURIComponent(item.data.name || item.data.productId)}`);
      } else {
        navigate(`/vendor/search?q=${encodeURIComponent(item.data.name)}&type=product`);
      }
    } else if (item.type === "farmer") {
      navigate(`/vendor/all-farmers/${item.data.id || item.data.farmerId}`);
    } else if (item.type === "crop") {
      navigate(`/vendor/farmer-crops?q=${encodeURIComponent(item.data.cropName)}`);
    }
  };

  // Full search submission
  const handleFullSearch = (customQ) => {
    const q = (customQ !== undefined ? customQ : query).trim();
    if (q) {
      saveSearchHistory(q);
      setSearchHistory(getSearchHistory());
      navigate(`/vendor/search?q=${encodeURIComponent(q)}&scope=${scope}`);
    } else {
      navigate("/vendor/search");
    }
    setIsOpen(false);
  };

  // Clear query
  const handleClear = () => {
    setQuery("");
    setResults({ products: [], farmers: [], crops: [], suggestions: [] });
    setTotalCount(0);
    setSelectedIndex(-1);
    inputRef.current?.focus();
    executeSearch("", scope);
  };

  // Drag and drop handlers
  const handleDragStart = (e) => {
    setIsDragging(true);
    e.dataTransfer.setData("application/x-greengrocc-search-widget", "true");
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Copy widget embed code snippet
  const embedSnippet = `// Drag-and-Drop Ajax Live Search Widget
import AjaxLiveSearchWidget from "../components/search/AjaxLiveSearchWidget";

<AjaxLiveSearchWidget
  mode="standalone"
  defaultScope="all"
  placeholder="Search products, farmers, crops..."
/>`;

  const copySnippet = () => {
    navigator.clipboard?.writeText(embedSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const isNavbar = mode === "navbar";
  const isCard = mode === "card";

  return (
    <div
      ref={containerRef}
      draggable={isDraggable && isCard}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`relative select-text transition-all ${
        isDragging ? "opacity-60 scale-[0.98] ring-2 ring-emerald-500" : ""
      } ${className}`}
    >
      {/* Search Input Bar */}
      <div
        className={`group relative flex items-center transition-all ${
          isNavbar
            ? "h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-50"
            : "rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-50"
        }`}
      >
        {/* Optional Drag Handle in Card Mode */}
        {isDraggable && isCard && (
          <div
            title="Drag to reposition widget"
            className="flex h-8 w-6 cursor-grab items-center justify-center text-slate-400 hover:text-slate-600 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* Scope Pill Selector for Dedicated Farmer / Product Experience */}
        {!isNavbar && (
          <div className="hidden sm:flex items-center gap-1 pl-1 pr-2 border-r border-slate-200">
            {[
              { id: "all", label: "All" },
              { id: "products", label: "Products" },
              { id: "farmers", label: "Farmers" },
              { id: "crops", label: "Crops" },
            ].map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleScopeChange(sc.id)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                  scope === sc.id
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        )}

        {/* Left Search Icon */}
        <div className="pointer-events-none flex items-center justify-center pl-3 pr-2 text-slate-400 group-focus-within:text-emerald-700">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          ) : (
            <Search className="h-4 w-4 transition group-focus-within:scale-110" />
          )}
        </div>

        {/* Live Input Field */}
        <input
          ref={inputRef}
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            if (!query) executeSearch("", scope);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent pr-8 text-xs text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm"
          autoComplete="off"
          spellCheck="false"
        />

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1 pr-2">
          {/* Clear Button */}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Quick Keyboard Hint Pill */}
          <span className="hidden items-center gap-0.5 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline-flex">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </span>

          {/* Embed / Drag-Drop Code Button (standalone or card) */}
          {!isNavbar && (
            <button
              type="button"
              onClick={() => setShowEmbedModal(true)}
              title="Drag & Drop Widget Embed snippet"
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Code2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* AJAX Live Results Dropdown Overlay */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[540px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1">
          {/* Top Scope Filters inside Navbar mode */}
          {isNavbar && (
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] font-medium text-slate-400">Search In:</span>
                {[
                  { id: "all", label: "All" },
                  { id: "products", label: "Farmer Products" },
                  { id: "farmers", label: "Farmer Directory" },
                  { id: "crops", label: "Farmer Crops" },
                ].map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => handleScopeChange(sc.id)}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                      scope === sc.id
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>

              {query && (
                <span className="text-[10px] text-slate-400">
                  {totalCount} results {executionMs > 0 ? `(${executionMs}ms)` : ""}
                </span>
              )}
            </div>
          )}

          {/* Did You Mean Suggestion Banner */}
          {didYouMean && (
            <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-800">
              <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>
                Did you mean:{" "}
                <button
                  type="button"
                  onClick={() => {
                    setQuery(didYouMean);
                    executeSearch(didYouMean, scope);
                  }}
                  className="font-bold underline text-emerald-800 hover:text-emerald-900"
                >
                  {didYouMean}
                </button>
                ?
              </span>
            </div>
          )}

          {/* Scrollable Results Container */}
          <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto overscroll-contain p-2">
            {/* Zero state: No query typed */}
            {!query ? (
              <div className="space-y-3 p-2">
                {/* Search History */}
                {searchHistory.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between pb-1.5">
                      <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <History className="h-3 w-3" /> Recent Searches
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          clearSearchHistory();
                          setSearchHistory([]);
                        }}
                        className="text-[10px] text-slate-400 hover:text-red-600"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {searchHistory.map((h, i) => (
                        <div
                          key={i}
                          className="group/tag inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setQuery(h);
                              executeSearch(h, scope);
                            }}
                            className="font-medium"
                          >
                            {h}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = removeSearchHistoryItem(h);
                              setSearchHistory(updated);
                            }}
                            className="text-slate-300 hover:text-slate-600"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Keywords & Vernacular Hints */}
                <div>
                  <span className="flex items-center gap-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <TrendingUp className="h-3 w-3" /> Popular Produce & Synonyms
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Tomato / Tamatar", q: "tamatar" },
                      { label: "Potato / Aloo", q: "aloo" },
                      { label: "Onion / Pyaz", q: "pyaz" },
                      { label: "Shimla Apple", q: "apple" },
                      { label: "Palak / Spinach", q: "palak" },
                      { label: "Desi Wheat", q: "wheat" },
                      { label: "Grade A Organic", q: "organic" },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setQuery(item.q);
                          executeSearch(item.q, scope);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Navigation Shortcuts */}
                <div className="border-t border-slate-100 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Dedicated Farmer Experience Hub
                  </span>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        navigate("/vendor/all-farmers");
                      }}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2 text-left hover:border-emerald-200 hover:bg-emerald-50/40"
                    >
                      <User className="h-4 w-4 text-emerald-700" />
                      <div>
                        <p className="font-semibold text-slate-800">All Farmers</p>
                        <p className="text-[10px] text-slate-400">Browse verified farmer directory</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        navigate("/vendor/farmer-products");
                      }}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2 text-left hover:border-emerald-200 hover:bg-emerald-50/40"
                    >
                      <Package className="h-4 w-4 text-emerald-700" />
                      <div>
                        <p className="font-semibold text-slate-800">Farmer Products</p>
                        <p className="text-[10px] text-slate-400">Inventory & harvest approvals</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            ) : totalCount === 0 && !loading ? (
              /* No results state */
              <div className="py-8 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  No exact matches for "{query}"
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Try searching with local terms like "tamatar", "aloo", or "pyaz".
                </p>
                <button
                  type="button"
                  onClick={() => handleFullSearch()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800"
                >
                  Search Everywhere
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              /* Live Results list */
              <div className="space-y-3">
                {/* 1. Products Section */}
                {results.products.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-2 pb-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <Package className="h-3 w-3 text-emerald-600" />
                        Products ({results.products.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/vendor/search?q=${encodeURIComponent(query)}&type=products`)}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        View all
                      </button>
                    </div>

                    <div className="space-y-1">
                      {results.products.map((p, idx) => {
                        const itemIndex = idx;
                        const isSelected = selectedIndex === itemIndex;
                        return (
                          <div
                            key={p.id || idx}
                            onClick={() => handleSelectItem({ type: "product", data: p })}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            className={`group flex cursor-pointer items-center justify-between gap-3 rounded-xl p-2 transition ${
                              isSelected
                                ? "bg-emerald-50/80 ring-1 ring-emerald-200"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Product Thumbnail */}
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.name}
                                  className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p
                                    className="truncate text-xs font-bold text-slate-800"
                                    dangerouslySetInnerHTML={{
                                      __html: p.highlightedName || p.name,
                                    }}
                                  />
                                  {p.variety && (
                                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                                      {p.variety}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                  <span>{p.farmerName || "Farmer Direct"}</span>
                                  <span>•</span>
                                  <span>{p.category}</span>
                                </div>
                              </div>
                            </div>

                            {/* Price & Stock Badge */}
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-bold text-emerald-700">
                                ₹{p.price}/{p.unit || "kg"}
                              </p>
                              <span
                                className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                  p.inStock
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-600"
                                }`}
                              >
                                {p.inStock ? `${p.stock} ${p.unit} in stock` : "Out of stock"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Farmers Section (Dedicated Farmer Experience) */}
                {results.farmers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-2 pb-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <User className="h-3 w-3 text-emerald-600" />
                        Farmers Directory ({results.farmers.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/vendor/all-farmers?q=${encodeURIComponent(query)}`)}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        View all
                      </button>
                    </div>

                    <div className="space-y-1">
                      {results.farmers.map((f, idx) => {
                        const itemIndex = results.products.length + idx;
                        const isSelected = selectedIndex === itemIndex;
                        return (
                          <div
                            key={f.id || idx}
                            onClick={() => handleSelectItem({ type: "farmer", data: f })}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            className={`group flex cursor-pointer items-center justify-between gap-3 rounded-xl p-2 transition ${
                              isSelected
                                ? "bg-emerald-50/80 ring-1 ring-emerald-200"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-xs text-emerald-800">
                                {f.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p
                                    className="truncate text-xs font-bold text-slate-800"
                                    dangerouslySetInnerHTML={{
                                      __html: f.highlightedName || f.name,
                                    }}
                                  />
                                  <span className="rounded bg-emerald-50 px-1 py-0.2 text-[9px] font-semibold text-emerald-700">
                                    Verified Farmer
                                  </span>
                                </div>
                                <p className="truncate text-[11px] text-slate-500">
                                  {[f.farmName, f.location].filter(Boolean).join(" • ")}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 text-right text-xs">
                              <span className="text-slate-400 text-[10px]">
                                {f.mobile ? `+91 ${f.mobile}` : f.farmArea || ""}
                              </span>
                              <ChevronRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-emerald-700" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Crops Section */}
                {results.crops.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-2 pb-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <Sprout className="h-3 w-3 text-emerald-600" />
                        Farmer Crops & Plantings ({results.crops.length})
                      </span>
                    </div>

                    <div className="space-y-1">
                      {results.crops.map((c, idx) => {
                        const itemIndex = results.products.length + results.farmers.length + idx;
                        const isSelected = selectedIndex === itemIndex;
                        return (
                          <div
                            key={c.id || idx}
                            onClick={() => handleSelectItem({ type: "crop", data: c })}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            className={`group flex cursor-pointer items-center justify-between gap-3 rounded-xl p-2 transition ${
                              isSelected
                                ? "bg-emerald-50/80 ring-1 ring-emerald-200"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100/60 text-emerald-700">
                                <Sprout className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p
                                    className="text-xs font-bold text-slate-800"
                                    dangerouslySetInnerHTML={{
                                      __html: c.highlightedCrop || c.cropName,
                                    }}
                                  />
                                  {c.variety && (
                                    <span className="text-[10px] text-slate-400">
                                      ({c.variety})
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500">
                                  Farmer: {c.farmerName} • Status: {c.status}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-700">
                              View Crop →
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Navigate: <kbd className="rounded border bg-white px-1">↑</kbd> <kbd className="rounded border bg-white px-1">↓</kbd></span>
              <span>Select: <kbd className="rounded border bg-white px-1">Enter</kbd></span>
              <span>Exit: <kbd className="rounded border bg-white px-1">Esc</kbd></span>
            </div>

            <button
              type="button"
              onClick={() => handleFullSearch()}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
            >
              See all results for "{query}"
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Drag-and-Drop Widget Embed Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <Code2 className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Drag-and-Drop Live Search Widget</h3>
                  <p className="text-xs text-slate-500">Embed this widget anywhere across GreenGrocc</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmbedModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <p>
                This widget provides instant Ajax Live Search, Indian produce synonym dictionary, typo tolerance,
                and dedicated Farmer App search integration.
              </p>

              <div className="relative rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-slate-200">
                <pre className="overflow-x-auto">{embedSnippet}</pre>
                <button
                  type="button"
                  onClick={copySnippet}
                  className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-white hover:bg-slate-700"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    "Copy Code"
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900">
                <p className="font-semibold">💡 Drag & Drop on Dashboard:</p>
                <p className="mt-0.5 text-[11px] text-emerald-700">
                  Grab the grip handle on the left of this card to drag and drop it into any dashboard zone.
                  Position preference is saved automatically!
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEmbedModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
