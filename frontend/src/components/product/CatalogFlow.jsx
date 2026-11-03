import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { SHOP_BY_CATEGORY_ITEMS } from "../home/ShopByCategory";
import { buildStoreProductUrl, sectionToStoreKey } from "../../utils/storeSection";
import { groupBaseProducts, productImage } from "../../utils/baseProducts";
import { getProductDisplayDetails } from "../../utils/productLocalization";
import { getProductListPriceInfo, isMultiVariant } from "../../utils/productPricing";
import { useCart } from "../../context/CartContext";
import ProductFiltersBar from "./ProductFiltersBar";
import { useProductFilters } from "../../hooks/useProductFilters";
import WishlistButton from "./WishlistButton";
import QuickCommerceProductCard from "./QuickCommerceProductCard";
import OptimizedImg from "../common/OptimizedImg";

export function catalogUrls({ categoryName = "", baseId = "", store = "" } = {}) {
  const categoryUrl = buildStoreProductUrl({ categoryName, store });
  const baseUrl = baseId
    ? buildStoreProductUrl({ categoryName, store, extraParams: { base: baseId } })
    : "";
  const productsUrl = baseId
    ? buildStoreProductUrl({
        categoryName,
        store,
        extraParams: { base: baseId, view: "products" },
      })
    : "";
  return { categoryUrl, baseUrl, productsUrl };
}

export function CatalogFlowTrail({
  current,
  categoryName,
  baseName = "",
  baseId = "",
  productName = "",
  store = "",
}) {
  const { categoryUrl, productsUrl } = catalogUrls({ categoryName, baseId, store });
  const steps = [
    { id: "category", label: "Category", text: categoryName, href: categoryUrl },
    { id: "base", label: "Base product", text: baseName, href: productsUrl },
    { id: "products", label: "Products", text: "Products", href: productsUrl },
    { id: "details", label: "Product details", text: productName, href: "" },
  ];
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <nav aria-label="Catalog flow" className="flex flex-wrap items-center gap-1.5 text-[12px]">
      {steps.map((step, index) => {
        const reached = index < currentIndex && step.href && step.text;
        const active = step.id === current;
        return (
          <span key={step.id} className="inline-flex items-center gap-1.5">
            {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-300" /> : null}
            {reached ? (
              <Link to={step.href} className="font-semibold text-emerald-800 hover:underline">
                {step.text || step.label}
              </Link>
            ) : (
              <span className={active ? "font-semibold text-slate-900" : "text-slate-400"}>
                {active ? step.text || step.label : step.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

const PAGE_WIDTH = "max-w-lg sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl";

const PRODUCT_FILTERS = [
  { id: "all", label: "All" },
  { id: "regular", label: "Regular" },
  { id: "premium", label: "Premium" },
  { id: "bestseller", label: "Bestseller" },
];

function productTier(product) {
  const blob = `${product?.name || ""} ${product?.varietyName || ""} ${product?.badge || ""}`.toLowerCase();
  if (product?.hotSelling || /bestseller|best seller/.test(blob)) return "bestseller";
  if (/premium|royal|alphonso|kesar|special/.test(blob)) return "premium";
  return "regular";
}

function isOrganicProduct(product) {
  return /organic/i.test(
    `${product?.name || ""} ${product?.badge || ""} ${product?.certification || ""} ${(product?.categories || []).join(" ")}`
  );
}

function formatInr(amount) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(Number(amount) || 0));
}

function marathiLabel(product, unit) {
  const stored = String(product?.marathiName || "").trim();
  if (stored) return stored;
  const fromCatalog = String(getProductDisplayDetails(product, unit).marathiBase || "").trim();
  return /[\u0900-\u097F]/.test(fromCatalog) ? fromCatalog : "";
}

function heroTagline(items = []) {
  const raw = String(items.find((item) => item.description)?.description || "").replace(/<[^>]+>/g, "");
  const sentence = raw.split(/[.]/)[0].replace(/\s+/g, " ").trim();
  if (sentence.length > 8 && sentence.length <= 42) return sentence;
  return "Fresh, juicy, naturally yours";
}

function ProductRow({ product, quantity, onAdd, onDecrease }) {
  const image = productImage(product);
  const priceInfo = getProductListPriceInfo(product);
  const variety = String(product.varietyName || "").trim();
  const unit = String(product.unit || "").trim();
  const marathi = marathiLabel(product, unit);
  const optionCount = isMultiVariant(product) ? product.variants.length : 0;
  const organic = isOrganicProduct(product);
  const sale = priceInfo.salePrice > 0 ? priceInfo.salePrice : null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <Link to={`/product/${product._id}`} className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-xl bg-slate-50">
        {image ? <OptimizedImg src={image} alt="" className="h-full w-full object-cover" /> : null}
        {organic ? (
          <span className="absolute bottom-1 left-1 rounded-full bg-[#1f8a3b] px-1.5 py-0.5 text-[8px] font-semibold leading-none text-white">
            100% Organic
          </span>
        ) : null}
      </Link>
      <Link to={`/product/${product._id}`} className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900">{product.name}</p>
        {marathi ? <p className="truncate text-[12px] font-medium text-[#0a6c38]">{marathi}</p> : null}
        {variety ? <p className="truncate text-[12px] text-slate-400">({variety})</p> : null}
        {unit || optionCount > 1 ? (
          <p className="text-[12px] text-slate-400">
            {unit}
            {optionCount > 1 ? `${unit ? " · " : ""}${optionCount} options` : ""}
          </p>
        ) : null}
        {sale != null ? (
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold text-slate-900">₹ {formatInr(sale)}</span>
            {priceInfo.hasDiscount ? (
              <span className="text-[12px] font-medium text-slate-400 line-through">₹ {formatInr(priceInfo.originalPrice)}</span>
            ) : null}
          </p>
        ) : null}
      </Link>
      <div className="flex shrink-0 flex-col items-end justify-between self-stretch py-0.5">
        <WishlistButton product={product} className="!h-8 !w-8 !border-0 !bg-transparent text-slate-500 shadow-none" />
        {quantity > 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-[#1f6b3a] px-2 py-1 text-white">
            <button type="button" onClick={(event) => onDecrease?.(product, event.currentTarget)} className="px-1 text-sm font-bold" aria-label="Decrease">
              −
            </button>
            <span className="min-w-4 text-center text-sm font-semibold">{quantity}</span>
            <button type="button" onClick={(event) => onAdd?.(product, event.currentTarget)} className="px-1 text-sm font-bold" aria-label="Increase">
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(event) => onAdd?.(product, event.currentTarget)}
            className="rounded-lg bg-[#1f6b3a] px-4 py-1.5 text-[13px] font-bold tracking-wide text-white"
          >
            ADD
          </button>
        )}
      </div>
    </div>
  );
}

const BASE_FILTERS = [
  { id: "all", label: "All" },
  { id: "seasonal", label: "Seasonal" },
  { id: "organic", label: "Organic" },
  { id: "popular", label: "Popular" },
];

function bannerCopy(categoryName) {
  const key = String(categoryName || "").toLowerCase();
  if (key.includes("fruit")) {
    return { title: "Nature's Sweetness\nin Every Bite", kicker: "Premium | Organic | Farm Fresh" };
  }
  if (key.includes("veg")) {
    return { title: "Farm Fresh Greens\nin Every Basket", kicker: "Premium | Organic | Farm Fresh" };
  }
  return { title: categoryName || "Shop", kicker: "Premium | Organic | Farm Fresh" };
}

function matchesBaseFilter(card, filter) {
  if (filter === "seasonal") return card.items.some((product) => product.justArrived);
  if (filter === "organic") {
    return card.items.some((product) =>
      /organic/i.test(
        `${product.name || ""} ${product.badge || ""} ${product.certification || ""} ${(product.categories || []).join(" ")}`
      )
    );
  }
  if (filter === "popular") return card.items.some((product) => product.hotSelling || product.badge);
  return true;
}

function CatalogFlow({
  categories = [],
  categoryName,
  products = [],
  loading,
  onAdd,
  onGetCartQuantity,
  onIncrease,
  onDecrease,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const store = sectionToStoreKey(searchParams.get("store"));
  const baseKey = searchParams.get("base") || "";
  const view = searchParams.get("view") || "";
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [baseFilter, setBaseFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const { cartCount } = useCart();
  const productFilters = useProductFilters(products);

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && onLoadMore) onLoadMore();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  useEffect(() => {
    setQuery("");
    window.scrollTo({ top: 0 });
  }, [categoryName, baseKey, view]);

  const shopItem = SHOP_BY_CATEGORY_ITEMS.find(
    (item) =>
      item.name.toLowerCase() === String(categoryName || "").toLowerCase() ||
      item.categoryFilter.toLowerCase() === String(categoryName || "").toLowerCase()
  );
  const categoryDoc = categories.find(
    (item) => String(item.categoryName || "").toLowerCase() === String(categoryName || "").toLowerCase()
  );
  const categoryImage = categoryDoc?.categoryImage || shopItem?.image || "";
  const baseCards = useMemo(() => groupBaseProducts(products), [products]);
  const activeBase = baseKey ? baseCards.find((card) => card.id === baseKey) : null;
  const { categoryUrl, productsUrl } = catalogUrls({
    categoryName,
    baseId: activeBase?.id || baseKey,
    store,
  });

  useEffect(() => {
    if (baseKey && view !== "products") navigate(categoryUrl, { replace: true });
  }, [baseKey, view, categoryUrl, navigate]);

  const needle = query.trim().toLowerCase();

  if (baseKey && view === "products") {
    const source = activeBase?.items || [];
    const items = productFilters.sortedProducts.filter((product) => {
      if (!source.includes(product)) return false;
      if (productFilter !== "all" && productTier(product) !== productFilter) return false;
      return needle ? String(product.name || "").toLowerCase().includes(needle) : true;
    });
    const heroImage = activeBase?.image || productImage(source[0]) || categoryImage;
    return (
      <div className="min-h-screen bg-[#f4f6f3] pb-8 lg:pt-4">
        <div className={`relative mx-auto h-[230px] w-full overflow-hidden bg-slate-200 sm:h-[280px] lg:h-[340px] lg:rounded-3xl ${PAGE_WIDTH}`}>
          {heroImage ? <OptimizedImg src={heroImage} alt="" className="h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/25" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 py-3 text-white">
            <button
              type="button"
              onClick={() => {
                const backTo = location.state?.backTo || categoryUrl;
                if (location.state?.backTo && window.history.state?.idx > 0) {
                  navigate(-1);
                  return;
                }
                navigate(backTo, { replace: true });
              }}
              className="relative z-20 flex h-9 w-9 items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSearchOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center" aria-label="Search">
                <Search className="h-5 w-5" />
              </button>
              <Link to="/cart" className="relative flex h-9 w-9 items-center justify-center" aria-label="Cart">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                {cartCount > 0 ? <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#1f8a3b] ring-2 ring-white" /> : null}
              </Link>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-8 px-4 text-white sm:px-6 lg:bottom-10 lg:px-10">
            <h1 className="truncate text-[28px] font-semibold leading-none sm:text-[34px] lg:text-[42px]">{activeBase?.title || "Products"}</h1>
            <p className="mt-1 text-[13px] text-white/90 sm:text-[15px]">{heroTagline(source)}</p>
          </div>
        </div>

        <div className={`relative z-10 mx-auto -mt-6 w-full rounded-t-[28px] bg-[#f4f6f3] px-3 pt-4 sm:px-5 lg:px-8 ${PAGE_WIDTH}`}>
          {searchOpen ? (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              className="mb-3 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-emerald-600"
              autoFocus
            />
          ) : null}
          <ProductFiltersBar products={source} />
          <div className="flex gap-2 overflow-x-auto pb-3">
            {PRODUCT_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setProductFilter(filter.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold ${
                  productFilter === filter.id ? "bg-[#1f6b3a] text-white" : "bg-[#e7f0e8] text-slate-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {loading && items.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Loading products…</p>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No products in this list yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-4">
              {items.map((product) => (
                <QuickCommerceProductCard
                  key={product._id}
                  product={product}
                  layout="grid"
                  cartQuantity={onGetCartQuantity ? onGetCartQuantity(product) : 0}
                  onAdd={onAdd}
                  onIncrease={onIncrease || onAdd}
                  onDecrease={onDecrease}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const banner = bannerCopy(categoryName);
  const cards = baseCards.filter((card) => {
    if (!matchesBaseFilter(card, baseFilter)) return false;
    return needle ? card.title.toLowerCase().includes(needle) : true;
  });

  return (
    <div className="min-h-screen bg-[#f7f6f2] pb-6">
      <header className="sticky top-0 z-40 bg-white px-3 py-2.5 lg:static lg:bg-transparent lg:pt-5">
        <div className={`mx-auto grid w-full grid-cols-[40px_1fr_auto] items-center sm:px-2 lg:px-5 ${PAGE_WIDTH}`}>
          <button
            type="button"
            onClick={() => {
              if (typeof window.history.state?.idx === "number" && window.history.state.idx > 0) {
                navigate(-1);
                return;
              }
              navigate(store === "main" ? "/" : `/?store=${store}`, { replace: true });
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-800"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-center text-[18px] font-semibold text-slate-900 lg:text-left lg:text-[24px] lg:font-bold">{categoryName}</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-800"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              to="/cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-800"
              aria-label="Cart"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                />
              </svg>
              {cartCount > 0 ? (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#1f8a3b] ring-2 ring-white" />
              ) : null}
            </Link>
          </div>
        </div>
        {searchOpen ? (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search in ${categoryName}`}
            className={`mx-auto mt-2 block w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-emerald-600 ${PAGE_WIDTH}`}
            autoFocus
          />
        ) : null}
      </header>

      <div className={`mx-auto w-full px-3 pt-2 sm:px-5 lg:px-8 ${PAGE_WIDTH}`}>
        <div className="relative overflow-hidden rounded-[22px] bg-[#f3ecdc] lg:rounded-3xl">
          {categoryImage ? (
            <OptimizedImg src={categoryImage} alt="" className="absolute inset-y-0 right-0 h-full w-[58%] object-cover lg:w-[45%]" />
          ) : null}
          <div className="absolute inset-y-0 right-0 w-[58%] bg-gradient-to-r from-[#f3ecdc] via-[#f3ecdc]/35 to-transparent lg:w-[45%]" />
          <div className="relative z-10 max-w-[62%] px-4 py-5 sm:px-6 sm:py-8 lg:max-w-[55%] lg:px-10 lg:py-12">
            <h2 className="whitespace-pre-line font-serif text-[26px] font-semibold leading-[1.05] text-[#163528] sm:text-[32px] lg:text-[42px]">
              {banner.title}
            </h2>
            <p className="mt-2 text-[11px] font-medium tracking-wide text-[#3e6b4f] sm:text-[13px]">{banner.kicker}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {BASE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setBaseFilter(filter.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold ${
                baseFilter === filter.id ? "bg-[#1f6b3a] text-white" : "bg-[#eef1ee] text-slate-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {loading && cards.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">Loading {categoryName}…</p>
      ) : cards.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">No base products in {categoryName} yet.</p>
      ) : (
        <div className={`mx-auto grid w-full grid-cols-2 gap-3 px-3 pt-2 sm:grid-cols-3 sm:gap-4 sm:px-5 md:grid-cols-4 lg:grid-cols-5 lg:px-8 lg:pt-4 xl:grid-cols-6 ${PAGE_WIDTH}`}>
          {cards.map((card) => (
            <Link
              key={card.id}
              to={catalogUrls({ categoryName, baseId: card.id, store }).productsUrl}
              state={{ backTo: categoryUrl }}
              className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_6px_18px_rgba(15,23,42,0.1)]"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
                {card.image ? (
                  <OptimizedImg
                    src={card.image}
                    alt={card.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}
                {card.discount > 0 ? (
                  <span className="absolute left-0 top-0 rounded-br-xl bg-[#2f6fe4] px-2 py-1 text-center text-[10px] font-extrabold leading-[1.05] text-white shadow-sm">
                    {card.discount}%
                    <br />
                    OFF
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold leading-tight text-slate-900">{card.title}</p>
                  <p className="mt-0.5 text-[12px] text-slate-400">
                    {card.count} {card.count === 1 ? "Type" : "Types"}
                  </p>
                </div>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef6ef] text-[#1f6b3a]">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default CatalogFlow;
