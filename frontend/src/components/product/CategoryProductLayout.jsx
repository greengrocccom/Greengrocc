import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { groupBaseProducts } from "../../utils/baseProducts";
import { buildStoreProductUrl } from "../../utils/storeSection";
import DealProductCard from "./DealProductCard";
import SidebarCategoryImage from "./SidebarCategoryImage";
import CategoryHeaderSection from "./CategoryHeaderSection";
import ProductFiltersBar from "./ProductFiltersBar";
import { useProductFilters } from "../../hooks/useProductFilters";
import ShopTopSlidingBanners from "./ShopTopSlidingBanners";
import MobileCategoryBrowse from "./MobileCategoryBrowse";
import OptimizedImg from "../common/OptimizedImg";
function buildCategoryUrl(categoryName, params = {}, storeParam = "") {
  const search = new URLSearchParams();
  search.set("categoryName", categoryName);
  if (storeParam) search.set("store", storeParam);
  if (params.subcategory) search.set("subcategory", params.subcategory);
  if (params.brand) search.set("brand", params.brand);
  if (params.sort) search.set("sort", params.sort);
  return `/product?${search.toString()}`;
}

function useCategoryFilters(products) {
  return useProductFilters(products);
}

function useAllProductsFilters(products) {
  return useProductFilters(products);
}

function CategoryFilterToolbar() {
  return null;
}

function AllProductsFilterToolbar() {
  return null;
}

function useLoadMoreOnVisible({ enabled, onLoadMore }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled || !onLoadMore) return undefined;

    const node = sentinelRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: "800px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onLoadMore]);

  return sentinelRef;
}

function ProductResultsGrid({
  products,
  loading,
  onAdd,
  onGetCartQuantity,
  onIncrease,
  onDecrease,
  emptyMessage,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}) {
  const loadMoreRef = useLoadMoreOnVisible({
    enabled: Boolean(hasNextPage && !isFetchingNextPage && !loading && onLoadMore),
    onLoadMore,
  });

  if (loading && products.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-[260px] animate-pulse rounded-xl border border-border-light bg-white"
          />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return <p className="py-12 text-center text-sm text-text-secondary">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 [&>div]:h-full">
        {products.map((product) => (
          <DealProductCard
            key={product._id}
            product={product}
            onAdd={onAdd}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            cartQuantity={onGetCartQuantity ? onGetCartQuantity(product) : 0}
            layout="grid"
          />
        ))}
      </div>
      {hasNextPage ? <div ref={loadMoreRef} className="h-2 w-full" aria-hidden="true" /> : null}
      {isFetchingNextPage ? (
        <p className="py-4 text-center text-sm text-text-secondary">Loading more products...</p>
      ) : null}
    </>
  );
}

function shopCategoryUrl(pathname, searchParams, categoryName = "") {
  const params = new URLSearchParams(searchParams);
  params.delete("categoryName");
  params.delete("base");
  params.delete("view");
  if (categoryName) params.set("shopCategory", categoryName);
  else params.delete("shopCategory");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function CategoryListBox({ categories, activeCategory, variant = "desktop" }) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const allActive = !activeCategory;
  const allUrl = shopCategoryUrl(pathname, searchParams);

  if (variant === "mobile") {
    return (
      <aside className="flex h-full min-h-0 w-[78px] shrink-0 flex-col overflow-hidden border-r border-gray-100 bg-white">
        <nav
          className="hide-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain px-1.5 py-2.5 pb-3"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Link
            to={allUrl}
            className={`group flex shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] transition-all duration-200 ${
              allActive
                ? "bg-[#0C831F]/10 font-bold text-[#0C831F]"
                : "font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            }`}
          >
            <SidebarCategoryImage showGrid name="All Products" size="sm" active={allActive} />
            <span className="text-center leading-tight tracking-tight">All</span>
          </Link>
          {categories.map((cat) => {
            const isActive =
              activeCategory.toLowerCase() === String(cat.categoryName || "").toLowerCase();
            return (
              <Link
                key={cat._id || cat.categoryName}
                to={shopCategoryUrl(pathname, searchParams, cat.categoryName)}
                className={`group flex shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] transition-all duration-200 ${
                  isActive
                    ? "bg-[#0C831F]/10 font-bold text-[#0C831F]"
                    : "font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                <SidebarCategoryImage
                  image={cat.categoryImage}
                  name={cat.categoryName}
                  size="sm"
                  active={isActive}
                />
                <span className="line-clamp-2 w-full text-center leading-tight tracking-tight">
                  {cat.categoryName}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Browse</p>
        <h2 className="mt-0.5 text-[15px] font-bold tracking-tight text-gray-900">Categories</h2>
      </div>

      <nav className="hide-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-2.5">
        <Link
          to={allUrl}
          className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-200 ${
            allActive
              ? "bg-[#0C831F]/10 text-[#0C831F]"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          {allActive ? (
            <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[#0C831F]" />
          ) : null}
          <SidebarCategoryImage showGrid name="All Products" size="md" active={allActive} />
          <span
            className={`min-w-0 flex-1 truncate text-[13px] leading-snug ${
              allActive ? "font-bold" : "font-semibold"
            }`}
          >
            All Products
          </span>
        </Link>

        {categories.map((cat) => {
          const isActive =
            activeCategory.toLowerCase() === String(cat.categoryName || "").toLowerCase();
          return (
            <Link
              key={cat._id || cat.categoryName}
              to={shopCategoryUrl(pathname, searchParams, cat.categoryName)}
              className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-200 ${
                isActive
                  ? "bg-[#0C831F]/10 text-[#0C831F]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {isActive ? (
                <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[#0C831F]" />
              ) : null}
              <SidebarCategoryImage
                image={cat.categoryImage}
                name={cat.categoryName}
                size="md"
                active={isActive}
              />
              <span
                className={`min-w-0 flex-1 truncate text-[13px] leading-snug ${
                  isActive ? "font-bold" : "font-semibold"
                }`}
              >
                {cat.categoryName}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function DesktopCategorySidebar({ categories, activeCategory }) {
  return <CategoryListBox categories={categories} activeCategory={activeCategory} variant="desktop" />;
}

function CategoryProductMain({
  categories,
  activeCategory,
  categoryName,
  products,
  loading,
  onAdd,
  onGetCartQuantity,
  onIncrease,
  onDecrease,
  emptyMessage,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) {
  const [searchParams] = useSearchParams();
  const baseKey = searchParams.get("base") || "";
  const storeParam = searchParams.get("store") || "";
  const categoryFilters = useProductFilters(products);
  const baseCards = groupBaseProducts(categoryFilters.sortedProducts);
  const activeBase = baseKey ? baseCards.find((card) => card.id === baseKey) : null;
  const filters = useCategoryFilters(activeBase ? activeBase.items : products, categoryName);
  const activeCategoryDoc = categories.find(
    (cat) => cat.categoryName.toLowerCase() === categoryName.toLowerCase()
  );
  const categoryUrl = buildStoreProductUrl({ categoryName, store: storeParam });
  const loadMoreRef = useLoadMoreOnVisible({
    enabled: Boolean(!activeBase && hasNextPage && !isFetchingNextPage && !loading && onLoadMore),
    onLoadMore,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-2 pt-1 pb-24 lg:px-3 lg:pt-1">
        <div className="mb-2">
          <ShopTopSlidingBanners />
          <CategoryHeaderSection
            category={activeCategoryDoc}
            categoryName={activeBase?.title || categoryName}
            subcategories={[]}
            activeSubcategory=""
          />
        </div>
        <ProductFiltersBar products={products} />
        {activeBase ? (
          <Link to={categoryUrl} className="mb-3 inline-flex text-sm font-semibold text-emerald-800">
            ← {categoryName}
          </Link>
        ) : null}
        {activeBase ? (
          <ProductResultsGrid
            products={filters.sortedProducts}
            loading={loading}
            onAdd={onAdd}
            onGetCartQuantity={onGetCartQuantity}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            emptyMessage={emptyMessage}
            hasNextPage={false}
            isFetchingNextPage={false}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {baseCards.map((card) => (
              <Link
                key={card.id}
                to={buildStoreProductUrl({
                  categoryName,
                  store: storeParam,
                  extraParams: { base: card.id },
                })}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white"
              >
                {card.image ? (
                  <OptimizedImg src={card.image} alt="" className="aspect-[5/4] w-full object-contain" />
                ) : (
                  <div className="aspect-[5/4] w-full bg-slate-50" />
                )}
                <div className="px-3 pb-3 pt-1">
                  <p className="truncate text-[15px] font-semibold text-slate-900">{card.title}</p>
                  <p className="text-[12px] text-slate-400">({card.countLabel})</p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {!activeBase && hasNextPage ? <div ref={loadMoreRef} className="h-2 w-full" aria-hidden="true" /> : null}
        {!activeBase && isFetchingNextPage ? (
          <p className="py-4 text-center text-sm text-text-secondary">Loading more products...</p>
        ) : null}
      </div>
    </div>
  );
}

function AllProductsMain({
  products,
  loading,
  onAdd,
  onGetCartQuantity,
  onIncrease,
  onDecrease,
  emptyMessage,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) {
  const filters = useAllProductsFilters(products);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-2 pt-1 pb-24 lg:px-3 lg:pt-1">
        <div className="mb-2">
          <ShopTopSlidingBanners />
        </div>
        <ProductFiltersBar products={products} />
        <ProductResultsGrid
          products={filters.sortedProducts}
          loading={loading}
          onAdd={onAdd}
          onGetCartQuantity={onGetCartQuantity}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          emptyMessage={emptyMessage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
        />
      </div>
    </div>
  );
}

export {
  buildCategoryUrl,
  CategoryFilterToolbar,
  CategoryListBox,
  DesktopCategorySidebar,
  ProductResultsGrid,
};

function ProductPageTwoBoxLayout({ categories, activeCategory, children }) {
  return (
    <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[232px_1fr] items-start bg-white xl:grid-cols-[248px_1fr]">
      <div
        className="sticky z-30 overflow-hidden rounded-br-2xl border-r border-gray-100 bg-white transition-[top,height] duration-300 ease-out"
        style={{
          top: "var(--gg-nav-offset, 56px)",
          height: "calc(100vh - var(--gg-nav-offset, 56px))",
        }}
      >
        <CategoryListBox categories={categories} activeCategory={activeCategory} variant="desktop" />
      </div>
      <div className="flex min-w-0 flex-col bg-white">{children}</div>
    </div>
  );
}

export default function CategoryProductLayout({
  categories,
  activeCategory,
  categoryName,
  products,
  loading,
  onAdd,
  onGetCartQuantity,
  onIncrease,
  onDecrease,
  emptyMessage,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) {
  return (
    <div className="hidden lg:block">
      <ProductPageTwoBoxLayout categories={categories} activeCategory={activeCategory}>
        <CategoryProductMain
          categories={categories}
          activeCategory={activeCategory}
          categoryName={categoryName}
          products={products}
          loading={loading}
          onAdd={onAdd}
          onGetCartQuantity={onGetCartQuantity}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          emptyMessage={emptyMessage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
        />
      </ProductPageTwoBoxLayout>
    </div>
  );
}

export function AllProductsLayout({
  categories,
  activeCategory = "",
  products,
  loading,
  onAdd,
  onGetCartQuantity,
  onIncrease,
  onDecrease,
  emptyMessage,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) {
  return (
    <>
      <div className="hidden lg:block">
        <ProductPageTwoBoxLayout categories={categories} activeCategory={activeCategory}>
          <AllProductsMain
            products={products}
            loading={loading}
            onAdd={onAdd}
            onGetCartQuantity={onGetCartQuantity}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            emptyMessage={emptyMessage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={onLoadMore}
          />
        </ProductPageTwoBoxLayout>
      </div>
      <div className="lg:hidden flex items-start">
        <div className="sticky top-[70px] h-[calc(100vh-70px-var(--gg-bottom-nav-h,65px)-env(safe-area-inset-bottom,0px))] shrink-0 overflow-hidden">
          <CategoryListBox categories={categories} activeCategory={activeCategory} variant="mobile" />
        </div>
        <div className="flex-1 flex flex-col bg-white px-1 pb-1 pt-0 min-w-0">
          <AllProductsMain
            products={products}
            loading={loading}
            onAdd={onAdd}
            onGetCartQuantity={onGetCartQuantity}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            emptyMessage={emptyMessage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={onLoadMore}
          />
        </div>
      </div>
    </>
  );
}

export function MobileCategoryProductLayout({
  categories,
  categoryName,
  products,
  loading,
  onAdd,
  onGetCartQuantity,
  onIncrease,
  onDecrease,
  emptyMessage,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) {
  return (
    <div className="lg:hidden">
      <MobileCategoryBrowse
        categories={categories}
        categoryName={categoryName}
        products={products}
        loading={loading}
      />
    </div>
  );
}
