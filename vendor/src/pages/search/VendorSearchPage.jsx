import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  Package,
  User,
  Sprout,
  Sparkles,
  ArrowRight,
  TrendingUp,
  MapPin,
  Phone,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Tag,
  Store,
  Layers,
  Code2,
  Calendar,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import { productFarmersPath, productNameOf } from "../../utils/productList";
import {
  expandQuery,
  highlightMatch,
  getSearchHistory,
  saveSearchHistory,
} from "../../utils/searchEngine";
import AjaxLiveSearchWidget from "../../components/search/AjaxLiveSearchWidget";

const PANEL = "rounded-2xl border border-slate-200/90 bg-white shadow-xs";

export default function VendorSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryFromUrl = searchParams.get("q") || "";
  const initialScope = searchParams.get("scope") || "all";

  const [q, setQ] = useState(queryFromUrl);
  const [activeTab, setActiveTab] = useState(initialScope); // 'all' | 'products' | 'farmers' | 'crops'
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState("relevance"); // 'relevance' | 'price-asc' | 'price-desc' | 'name'

  // Filter states
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedFarmerId, setSelectedFarmerId] = useState("");

  // Results state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    products: [],
    farmers: [],
    crops: [],
    suggestions: [],
  });
  const [didYouMean, setDidYouMean] = useState(null);
  const [executionMs, setExecutionMs] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Sync state when URL params change
  useEffect(() => {
    const nextQ = searchParams.get("q") || "";
    setQ(nextQ);
    const nextScope = searchParams.get("scope") || "all";
    setActiveTab(nextScope);
  }, [searchParams]);

  // Fetch search results
  const fetchSearchResults = useCallback(async (searchTerm, searchScope) => {
    setLoading(true);
    try {
      const res = await vendorApi.liveSearch({
        q: searchTerm,
        scope: searchScope,
        limit: 25,
      });
      const data = res.data || {};
      const resData = data.results || {};
      setResults({
        products: Array.isArray(resData.products) ? resData.products : [],
        farmers: Array.isArray(resData.farmers) ? resData.farmers : [],
        crops: Array.isArray(resData.crops) ? resData.crops : [],
        suggestions: Array.isArray(resData.suggestions) ? resData.suggestions : [],
      });
      setDidYouMean(data.didYouMean || null);
      setExecutionMs(data.metrics?.executionMs || 12);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.warn("Search fetch failed:", err);
      setResults({ products: [], farmers: [], crops: [], suggestions: [] });
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearchResults(q, activeTab);
  }, [q, activeTab, fetchSearchResults]);

  // Expanded query terms for highlight
  const queryMeta = useMemo(() => expandQuery(q), [q]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let list = [...results.products];

    if (inStockOnly) {
      list = list.filter((p) => p.inStock);
    }

    if (selectedCategory && selectedCategory !== "all") {
      list = list.filter((p) => String(p.category || "").toLowerCase() === selectedCategory.toLowerCase());
    }

    if (selectedFarmerId) {
      list = list.filter((p) => p.farmerId === selectedFarmerId);
    }

    if (sortBy === "price-asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Relevance
      list.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    return list;
  }, [results.products, inStockOnly, selectedCategory, selectedFarmerId, sortBy]);

  // Filtered farmers
  const filteredFarmers = useMemo(() => {
    return results.farmers;
  }, [results.farmers]);

  // Filtered crops
  const filteredCrops = useMemo(() => {
    return results.crops;
  }, [results.crops]);

  // Total visible count based on active tab
  const visibleCount = useMemo(() => {
    if (activeTab === "products") return filteredProducts.length;
    if (activeTab === "farmers") return filteredFarmers.length;
    if (activeTab === "crops") return filteredCrops.length;
    return filteredProducts.length + filteredFarmers.length + filteredCrops.length;
  }, [activeTab, filteredProducts, filteredFarmers, filteredCrops]);

  // Unique categories in results
  const availableCategories = useMemo(() => {
    const cats = new Set();
    results.products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [results.products]);

  // Unique farmers in product results
  const availableFarmers = useMemo(() => {
    const map = new Map();
    results.products.forEach((p) => {
      if (p.farmerId && p.farmerName) {
        map.set(p.farmerId, p.farmerName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [results.products]);

  const handleApplyQuery = (newQuery) => {
    setQ(newQuery);
    setSearchParams({ q: newQuery, scope: activeTab });
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ q, scope: newTab });
  };

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top Header & Drag-and-Drop Live Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>Google-Style Ajax Live Search</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Live Engine
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Instant product and farmer search with typo tolerance, Indian produce synonyms, and relevance ranking
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/vendor/farmer-products")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <Package className="h-3.5 w-3.5 text-emerald-700" />
              <span>Farmer Products</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/vendor/all-farmers")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <User className="h-3.5 w-3.5 text-emerald-700" />
              <span>Farmers Directory</span>
            </button>
          </div>
        </div>

        {/* Embedded Live Search Widget (Standalone & Draggable) */}
        <AjaxLiveSearchWidget
          mode="standalone"
          placeholder="Search products, farmers, crops (try: 'tamatar', 'aloo', 'pyaz', 'shimla apple')..."
          defaultScope={activeTab}
          isDraggable={true}
          autoFocus={!queryFromUrl}
        />
      </div>

      {/* Google-Style Query Metrics & Synonym Indicator */}
      {q && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              About <strong className="text-slate-800">{visibleCount}</strong> results (
              {executionMs} ms) for "<strong className="text-emerald-800">{q}</strong>"
            </span>

            {/* Synonym expansion alert */}
            {queryMeta.synonyms.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-200">
                <Sparkles className="h-3 w-3 text-emerald-600" />
                <span>Synonym match: {queryMeta.synonyms.slice(0, 3).join(", ")}</span>
              </span>
            )}

            {/* Did you mean suggestion */}
            {didYouMean && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                Did you mean:{" "}
                <button
                  type="button"
                  onClick={() => handleApplyQuery(didYouMean)}
                  className="underline hover:text-emerald-800 font-bold"
                >
                  {didYouMean}
                </button>
              </span>
            )}
          </div>

          {/* View Mode Toggle (Grid vs List) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-1.5 transition ${
                viewMode === "grid" ? "bg-slate-200 text-slate-800" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-1.5 transition ${
                viewMode === "list" ? "bg-slate-200 text-slate-800" : "text-slate-400 hover:text-slate-600"
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Category Tabs: Google-Style Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: "all", label: "All Results", icon: Layers, count: results.products.length + results.farmers.length + results.crops.length },
          { id: "products", label: "Farmer Products", icon: Package, count: results.products.length },
          { id: "farmers", label: "Farmer Directory", icon: User, count: results.farmers.length },
          { id: "crops", label: "Farmer Crops", icon: Sprout, count: results.crops.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                  isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar (Only shown when viewing products or all) */}
      {(activeTab === "all" || activeTab === "products") && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-slate-50/80 p-2.5 border border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            {availableCategories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
              >
                <option value="all">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Farmer Filter */}
            {availableFarmers.length > 0 && (
              <select
                value={selectedFarmerId}
                onChange={(e) => setSelectedFarmerId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
              >
                <option value="">All Farmers ({availableFarmers.length})</option>
                {availableFarmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}

            {/* In-stock toggle */}
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer pl-1">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
              />
              <span>In-stock only</span>
            </label>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="relevance">Most Relevant (Google Score)</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Results View */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="mt-3 text-xs font-medium text-slate-400">Searching across GreenGrocc catalog & farmers...</p>
        </div>
      ) : visibleCount === 0 ? (
        /* Empty Results */
        <div className="py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800">No matching results found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            We couldn't find any produce matching "{q}". Try searching with vernacular synonyms like "tamatar", "aloo", "kanda", or "palak".
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["Tomato", "Potato", "Onion", "Chilli", "Kashmiri Apple", "Organic Palak"].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleApplyQuery(term)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Results Content */
        <div className="space-y-6">
          {/* Section 1: Farmers Directory (Dedicated Farmer App Experience) */}
          {(activeTab === "all" || activeTab === "farmers") && filteredFarmers.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <User className="h-4 w-4 text-emerald-700" />
                  <span>Farmers Directory ({filteredFarmers.length})</span>
                </h2>
                {activeTab === "all" && filteredFarmers.length > 4 && (
                  <button
                    type="button"
                    onClick={() => handleTabChange("farmers")}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    View all farmers →
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFarmers.slice(0, activeTab === "all" ? 6 : 24).map((f) => (
                  <Link
                    key={f.id}
                    to={`/vendor/all-farmers/${f.id || f.farmerId}`}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-emerald-300 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 font-bold text-sm text-emerald-800">
                            {f.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3
                              className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 truncate"
                              dangerouslySetInnerHTML={{ __html: f.highlightedName || f.name }}
                            />
                            <p className="text-xs text-slate-500 truncate">{f.farmName || "GreenGrocc Partner Farm"}</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {f.status || "Active"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{f.location || "India"}</span>
                        </div>
                        {f.mobile && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>+91 {f.mobile}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-semibold text-emerald-700">
                      <span>View Farmer Profile & Crops</span>
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Section 2: Farmer Products */}
          {(activeTab === "all" || activeTab === "products") && filteredProducts.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Package className="h-4 w-4 text-emerald-700" />
                  <span>Produce & Products ({filteredProducts.length})</span>
                </h2>
                {activeTab === "all" && filteredProducts.length > 8 && (
                  <button
                    type="button"
                    onClick={() => handleTabChange("products")}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    View all products →
                  </button>
                )}
              </div>

              {viewMode === "grid" ? (
                /* Grid Layout */
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs transition hover:border-emerald-300 hover:shadow-md"
                    >
                      <div>
                        {/* Thumbnail with stock badge */}
                        <div className="relative mb-2.5 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 aspect-square flex items-center justify-center">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-800">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <span
                            className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow-xs ${
                              p.inStock ? "bg-emerald-700 text-white" : "bg-red-600 text-white"
                            }`}
                          >
                            {p.inStock ? "In Stock" : "Out of Stock"}
                          </span>

                          {p.variety && (
                            <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs">
                              {p.variety}
                            </span>
                          )}
                        </div>

                        {/* Title & Category */}
                        <h3
                          className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 line-clamp-1"
                          dangerouslySetInnerHTML={{ __html: p.highlightedName || p.name }}
                        />

                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate">{p.category}</span>
                          <span className="truncate">{p.farmerName}</span>
                        </div>
                      </div>

                      {/* Pricing and Action */}
                      <div className="mt-3 border-t border-slate-100 pt-2.5">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-sm font-extrabold text-slate-900">
                              ₹{p.price}
                            </span>
                            <span className="text-[10px] text-slate-400">/{p.unit || "kg"}</span>
                            {p.mrp > p.price && (
                              <span className="ml-1.5 text-[10px] text-slate-400 line-through">
                                ₹{p.mrp}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {p.stock} {p.unit} avail
                          </span>
                        </div>

                        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                          <Link
                            to={
                              p.farmerId
                                ? `/vendor/farmer-products?q=${encodeURIComponent(p.name)}`
                                : `/vendor/search?q=${encodeURIComponent(p.name)}`
                            }
                            className="rounded-lg border border-slate-200 bg-white py-1 text-center text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Details
                          </Link>
                          {p.farmerId ? (
                            <Link
                              to={`/vendor/all-farmers/${p.farmerId}`}
                              className="rounded-lg bg-emerald-700 py-1 text-center text-[10px] font-bold text-white shadow-xs hover:bg-emerald-800"
                            >
                              Farmer
                            </Link>
                          ) : (
                            <Link
                              to={`/vendor/products?q=${encodeURIComponent(p.name)}`}
                              className="rounded-lg bg-emerald-700 py-1 text-center text-[10px] font-bold text-white shadow-xs hover:bg-emerald-800"
                            >
                              Catalog
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List Layout */
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-xs">
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 transition hover:bg-slate-50/70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 font-bold text-emerald-800">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3
                              className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 truncate"
                              dangerouslySetInnerHTML={{ __html: p.highlightedName || p.name }}
                            />
                            {p.variety && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                                {p.variety}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500">
                            Grown by <strong className="text-slate-700">{p.farmerName}</strong> • {p.category}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-slate-900">
                            ₹{p.price}/{p.unit}
                          </p>
                          <span
                            className={`text-[10px] font-bold ${
                              p.inStock ? "text-emerald-700" : "text-red-600"
                            }`}
                          >
                            {p.inStock ? `${p.stock} ${p.unit} in stock` : "Out of stock"}
                          </span>
                        </div>

                        <Link
                          to={
                            p.farmerId
                              ? `/vendor/farmer-products?q=${encodeURIComponent(p.name)}`
                              : `/vendor/products?q=${encodeURIComponent(p.name)}`
                          }
                          className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800"
                        >
                          View Produce
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Section 3: Farmer Crops & Plantings */}
          {(activeTab === "all" || activeTab === "crops") && filteredCrops.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Sprout className="h-4 w-4 text-emerald-700" />
                  <span>Farmer Crops & Active Plantings ({filteredCrops.length})</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCrops.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                            <Sprout className="h-5 w-5" />
                          </span>
                          <div>
                            <h3
                              className="font-bold text-xs sm:text-sm text-slate-900"
                              dangerouslySetInnerHTML={{ __html: c.highlightedCrop || c.cropName }}
                            />
                            {c.variety && (
                              <p className="text-[11px] text-slate-500">Variety: {c.variety}</p>
                            )}
                          </div>
                        </div>

                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {c.status || "Growing"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p>Farmer: <strong className="text-slate-800">{c.farmerName}</strong></p>
                        {c.expectedHarvestDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>Expected Harvest: {c.expectedHarvestDate}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
                      <Link
                        to={`/vendor/farmer-crops?q=${encodeURIComponent(c.cropName)}`}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        View Crop Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
