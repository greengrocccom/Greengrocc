import { useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useCategoriesQuery } from "../hooks/queries/useCategoriesQuery";
import { useInfiniteProductsQuery } from "../hooks/queries/useProductsQuery";
import { useProductFilters } from "../hooks/useProductFilters";
import { useProductListParams } from "../hooks/useProductListParams";
import { useProductCartActions } from "../hooks/useProductCartActions";
import {
  AllProductsLayout,
  DesktopCategorySidebar,
  ProductResultsGrid,
} from "../components/product/CategoryProductLayout";
import CatalogFlow from "../components/product/CatalogFlow";
import ProductFiltersBar from "../components/product/ProductFiltersBar";
import { addCategoryVisit } from "../utils/categoryVisits";
import { sectionToStoreKey, storeToSection } from "../utils/storeSection";

function FilterIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4.5h18M6 9.75h12M9 15h6M10.5 20.25h3"
      />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  );
}

function MobileProductToolbar({
  title,
  backTo,
  onToggleSort,
  onToggleFilter,
  showActions = true,
  filterActive = false,
  sortActive = false,
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2 bg-white px-3 py-2.5">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="inline-flex min-w-0 shrink items-center gap-0.5 text-text-primary"
      >
        <svg
          className="h-[18px] w-[18px] shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
        {title ? (
          <span className="truncate text-[15px] font-bold leading-none">{title}</span>
        ) : null}
      </button>

      {showActions && (
        <>
          <button
            type="button"
            onClick={onToggleFilter}
            className={`ml-auto flex shrink-0 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              filterActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border-light text-text-primary"
            }`}
          >
            <FilterIcon />
            Filter
          </button>
          <button
            type="button"
            onClick={onToggleSort}
            className={`flex shrink-0 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              sortActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border-light text-text-primary"
            }`}
          >
            <SortIcon />
            Sort
          </button>
        </>
      )}
    </div>
  );
}

function FilteredProductsView({
  products,
  categories,
  loading,
  pageTitle,
  emptyMessage,
  backTo = "/",
  onGetCartQuantity,
  onIncrease,
  onDecrease,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  showBrandFilter = true,
}) {
  const filters = useProductFilters(products);
  const sortedProducts = filters.sortedProducts;

  return (
    <div className="min-h-screen bg-mobile-bg pb-6 lg:pb-0">
      <div className="lg:hidden">
        <MobileProductToolbar title={pageTitle} backTo={backTo} showActions={false} />
        <ProductFiltersBar products={products} showBrand={showBrandFilter} />
        <div className="bg-mobile-bg px-3 py-3">
          <ProductResultsGrid
            products={sortedProducts}
            loading={loading}
            onAdd={onIncrease}
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

      <div className="hidden lg:block">
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[232px_1fr] items-start bg-white xl:grid-cols-[248px_1fr]">
          <div
            className="sticky z-30 overflow-hidden rounded-br-2xl border-r border-gray-100 bg-white transition-[top,height] duration-300 ease-out"
            style={{
              top: "var(--gg-nav-offset, 96px)",
              height: "calc(100vh - var(--gg-nav-offset, 96px))",
            }}
          >
            <DesktopCategorySidebar categories={categories} activeCategory="" />
          </div>
          <div className="min-h-0 flex-1 bg-white">
            <div className="border-b border-border-light px-3 py-4 lg:px-6 lg:py-5">
              <h1 className="mb-3 text-xl font-bold text-text-primary">{pageTitle}</h1>
              <ProductFiltersBar products={products} showBrand={showBrandFilter} className="px-0" />
            </div>
            <div className="px-3 py-4 lg:px-6 lg:py-5">
              <ProductResultsGrid
                products={sortedProducts}
                loading={loading}
                onAdd={onIncrease}
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
        </div>
      </div>
    </div>
  );
}

function SearchResultsView(props) {
  const { searchQuery, ...rest } = props;

  return (
    <FilteredProductsView
      {...rest}
      pageTitle={`Results for "${searchQuery}"`}
      emptyMessage={`No products found for "${searchQuery}".`}
      backTo="/product"
      brandParamKey="brand"
      preserveKeys={["q"]}
      showBrandFilter
    />
  );
}

function resolveShopSection(pathname, storeParam) {
  const path = String(pathname || "").toLowerCase();
  if (storeParam) return storeToSection(sectionToStoreKey(storeParam));
  if (path.startsWith("/ready2cook")) return "ready2cook";
  if (path.startsWith("/super-mall")) return "supermall";
  return "greengrocc";
}

function Product() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const categoryName = searchParams.get("categoryName")?.trim() || "";
  const shopCategory = searchParams.get("shopCategory")?.trim() || "";
  const searchQuery = searchParams.get("q")?.trim() || "";
  const brandName = searchParams.get("brandName")?.trim() || "";
  const storeParam = searchParams.get("store")?.trim()?.toLowerCase() || "";
  const shopSection = resolveShopSection(location.pathname, storeParam);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (categoryName) addCategoryVisit(categoryName);
  }, [categoryName, searchQuery, brandName, storeParam]);

  const { getCartQuantity, handleIncrease, handleDecrease } = useProductCartActions();
  const productParams = useProductListParams(searchParams);
  const scopedProductParams = useMemo(() => {
    const next = { ...productParams, section: productParams.section || shopSection };
    delete next.categoryName;
    return next;
  }, [productParams, shopSection]);

  const { data: apiCategories = [], isLoading: categoriesLoading } = useCategoriesQuery({
    section: shopSection,
  });
  const {
    data,
    isLoading: productsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteProductsQuery(scopedProductParams);

  const apiProducts = useMemo(
    () => data?.pages.flatMap((page) => page.products) ?? [],
    [data]
  );

  const categories = useMemo(
    () =>
      (apiCategories || [])
        .filter((cat) => cat.categoryName?.toLowerCase() !== "most purchase")
        .map((cat) => ({
          _id: cat._id,
          categoryName: cat.categoryName,
          categoryImage: cat.categoryImage,
          slug: cat.categoryName,
        })),
    [apiCategories]
  );

  // Product list for right product grid
  const products = useMemo(() => {
    let baseList = apiProducts;

    const selectedCategory = categoryName || shopCategory;
    if (selectedCategory) {
      const target = selectedCategory.toLowerCase();
      return baseList.filter((p) => {
        const pCats = [
          ...(Array.isArray(p.categories) ? p.categories : []),
          p.categoryName,
          p.storeCategory,
        ].filter(Boolean);
        return pCats.some((c) => String(c).toLowerCase() === target);
      });
    }

    return baseList;
  }, [apiProducts, categoryName, shopCategory]);

  const loading =
    categoriesLoading ||
    (productsLoading && apiProducts.length === 0 && products.length === 0);
  const infiniteScrollProps = {
    hasNextPage: apiProducts.length > 0 ? Boolean(hasNextPage) : false,
    isFetchingNextPage: apiProducts.length > 0 ? isFetchingNextPage : false,
    onLoadMore: apiProducts.length > 0 ? fetchNextPage : undefined,
  };

  if (brandName && !categoryName && !searchQuery) {
    return (
      <FilteredProductsView
        products={products}
        categories={categories}
        loading={loading}
        pageTitle={brandName}
        emptyMessage={`No products found for brand "${brandName}".`}
        backTo="/"
        onGetCartQuantity={getCartQuantity}
        onIncrease={handleIncrease}
        onDecrease={handleDecrease}
        brandParamKey="brandName"
        preserveKeys={["brandName", "store"]}
        showBrandFilter
        {...infiniteScrollProps}
      />
    );
  }

  if (searchQuery && !categoryName) {
    return (
      <SearchResultsView
        products={products}
        categories={categories}
        loading={loading}
        searchQuery={searchQuery}
        onGetCartQuantity={getCartQuantity}
        onIncrease={handleIncrease}
        onDecrease={handleDecrease}
        {...infiniteScrollProps}
      />
    );
  }

  if (categoryName && !shopCategory) {
    return (
      <div className="bg-white lg:pb-0">
        <CatalogFlow
          categories={categories}
          categoryName={categoryName}
          products={products}
          loading={loading}
          onAdd={handleIncrease}
          onGetCartQuantity={getCartQuantity}
          onIncrease={handleIncrease}
          onDecrease={handleDecrease}
          {...infiniteScrollProps}
        />
      </div>
    );
  }

  return (
    <div className="bg-white lg:pb-0">
      <AllProductsLayout
        categories={categories}
        activeCategory={shopCategory}
        products={products}
        loading={loading || categoriesLoading}
        onAdd={handleIncrease}
        onGetCartQuantity={getCartQuantity}
        onIncrease={handleIncrease}
        onDecrease={handleDecrease}
        emptyMessage="No products available yet."
        {...infiniteScrollProps}
      />
    </div>
  );
}

export default Product;
