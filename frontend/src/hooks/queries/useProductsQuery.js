import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getProducts, getMyOrders } from "../../api/api";
import { getMostViewedIds, getRecentlyViewedIds } from "../../utils/recentlyViewed";
import { extractPurchasedProductIds } from "../../utils/orderItems";
import { queryKeys } from "./queryKeys";
import { useDeliveryLocationKey } from "../../context/LocationContext";
import { useAuth } from "../../context/AuthContext";

const HOME_PRODUCT_LIMIT = 12;
export const MOST_VIEWED_LIMIT = 16;
export const PRODUCTS_PAGE_SIZE = 50;

async function fetchProductsByIds(ids, limit = HOME_PRODUCT_LIMIT, params = {}) {
  if (!ids.length) return [];

  const { data } = await getProducts({
    ...params,
    ids: ids.join(","),
    limit,
  });
  const fetched = data.data || [];
  const byId = new Map(fetched.map((product) => [String(product._id), product]));

  return ids
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .slice(0, limit);
}

/** Tops a short list up to `limit` with the newest catalog products (no duplicates). */
export async function fillWithNewest(products, limit = HOME_PRODUCT_LIMIT, params = {}) {
  const list = Array.isArray(products) ? products.slice(0, limit) : [];
  if (list.length >= limit) return list;

  try {
    const { data } = await getProducts({ ...params, sort: "newest", limit: Math.min(limit * 2, 50) });
    const seen = new Set(list.map((product) => String(product._id)));
    for (const product of data.data || []) {
      if (list.length >= limit) break;
      if (seen.has(String(product._id))) continue;
      seen.add(String(product._id));
      list.push(product);
    }
  } catch {
    // keep what we already have
  }
  return list;
}

export function useInfiniteProductsQuery(params, options = {}) {
  const locationKey = useDeliveryLocationKey();

  return useInfiniteQuery({
    queryKey: queryKeys.products.infiniteList({ ...params, locationKey }),
    queryFn: async ({ pageParam = 1 }) => {
      // Fetch the matching catalog together for mobile-style local weight/discount sorting.
      const needsLocalCatalog = Boolean(params?.weightSize || /^(weight|discount)-/.test(params?.sort || ""));
      const apiParams = { ...params };
      delete apiParams.weightSize;
      const { data } = await getProducts({
        ...apiParams,
        ...(!needsLocalCatalog ? { page: pageParam, limit: PRODUCTS_PAGE_SIZE } : {}),
      });

      return {
        products: data.data || [],
        pagination: data.pagination || {
          page: pageParam,
          limit: PRODUCTS_PAGE_SIZE,
          total: data.data?.length || 0,
          totalPages: 1,
        },
        store: data.store || null,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page = 1, totalPages = 1 } = lastPage.pagination || {};
      return page < totalPages ? page + 1 : undefined;
    },
    ...options,
  });
}

export function useProductsQuery(params, options = {}) {
  const locationKey = useDeliveryLocationKey();

  return useQuery({
    queryKey: queryKeys.products.list({ ...params, locationKey }),
    queryFn: async () => {
      const { data } = await getProducts(params);
      return data.data || [];
    },
    ...options,
  });
}

/** `section` limits the list to one storefront section (e.g. "greengrocc", "supermall"). */
export function useHotSellingProductsQuery(options = {}, section = null) {
  const locationKey = useDeliveryLocationKey();

  return useQuery({
    queryKey: [...queryKeys.products.hotSelling, locationKey, section || "all"],
    queryFn: async () => {
      const { data } = await getProducts({
        ...(section ? { section } : {}),
        hotSelling: true,
        limit: HOME_PRODUCT_LIMIT,
      });
      return (data.data || []).slice(0, HOME_PRODUCT_LIMIT);
    },
    ...options,
  });
}

export function useRecentlyViewedProductsQuery(options = {}) {
  const ids = getRecentlyViewedIds().slice(0, HOME_PRODUCT_LIMIT);
  const locationKey = useDeliveryLocationKey();

  return useQuery({
    queryKey: [...queryKeys.products.recentlyViewed(ids), locationKey],
    queryFn: () => fetchProductsByIds(ids, HOME_PRODUCT_LIMIT),
    enabled: ids.length > 0,
    ...options,
  });
}

export function useMostViewedProductsQuery(options = {}, section = null) {
  const ids = getMostViewedIds(MOST_VIEWED_LIMIT);
  const locationKey = useDeliveryLocationKey();
  const scope = section ? { section } : {};

  return useQuery({
    queryKey: [...queryKeys.products.mostViewed(ids), locationKey, section || "all"],
    queryFn: async () => {
      const viewed = await fetchProductsByIds(ids, MOST_VIEWED_LIMIT, scope);
      const withPopular = await fillWithNewest(viewed, MOST_VIEWED_LIMIT, { ...scope, hotSelling: true });
      return fillWithNewest(withPopular, MOST_VIEWED_LIMIT, scope);
    },
    ...options,
  });
}

export function usePurchasedProductsQuery(options = {}) {
  const { user } = useAuth();
  const locationKey = useDeliveryLocationKey();

  return useQuery({
    queryKey: [...queryKeys.products.purchased(user?._id || "guest"), locationKey],
    queryFn: async () => {
      const { data } = await getMyOrders();
      const ids = extractPurchasedProductIds(data.data || [], HOME_PRODUCT_LIMIT);
      return fetchProductsByIds(ids, HOME_PRODUCT_LIMIT);
    },
    enabled: Boolean(user),
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

