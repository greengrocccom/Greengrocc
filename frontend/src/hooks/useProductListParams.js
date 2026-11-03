import { useMemo } from "react";
import { sectionToStoreKey, storeToSection } from "../utils/storeSection";

export function useProductListParams(searchParams) {
  return useMemo(() => {
    const params = {};

    const categoryName = searchParams.get("categoryName")?.trim() || "";
    const searchQuery = searchParams.get("q")?.trim() || "";
    const brandName = searchParams.get("brandName")?.trim() || "";
    const brand = searchParams.get("brand")?.trim() || "";
    const minPrice = searchParams.get("minPrice")?.trim() || "";
    const maxPrice = searchParams.get("maxPrice")?.trim() || "";
    const sort = searchParams.get("sort")?.trim() || "newest";
    const storeParam = searchParams.get("store")?.trim()?.toLowerCase() || "";

    if (categoryName) params.categoryName = categoryName;
    if (searchQuery) params.q = searchQuery;
    if (brandName) params.brandName = brandName;
    else if (brand) params.brandName = brand;
    // subcategory navigation is disabled on the customer site
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    for (const key of ["minDiscount", "weightSize", "inStock"]) {
      if (searchParams.get(key)) params[key] = searchParams.get(key);
    }
    if (sort && sort !== "default") params.sort = sort;
    if (searchParams.get("justArrived") === "true") params.justArrived = true;
    if (searchParams.get("hotSelling") === "true") params.hotSelling = true;

    // Pass section so the API only returns products from the active store section
    if (storeParam) {
      const storeKey = sectionToStoreKey(storeParam);
      params.section = storeToSection(storeKey);
    }

    return params;
  }, [searchParams]);
}
