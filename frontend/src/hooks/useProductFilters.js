import { useSearchParams } from 'react-router-dom';
import { extractWeightsAndSizes, filterAndSortProducts, PRODUCT_FILTER_KEYS, readProductFilters } from '../utils/productFilters';

export function useProductFilters(products = []) {
  const [params, setParams] = useSearchParams();
  const values = readProductFilters(params);
  const brandParamKey = params.has('brandName') ? 'brandName' : 'brand';
  const isBrandPage = params.has('brandName') && !params.get('categoryName') && !params.get('q');
  const applyFilters = changes => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value !== '' && value != null && value !== false && value !== 'false') next.set(key, String(value));
      else next.delete(key);
      if (key === brandParamKey) next.delete(brandParamKey === 'brand' ? 'brandName' : 'brand');
    }
    setParams(next, { replace: true });
  };
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    PRODUCT_FILTER_KEYS.forEach(key => { if (key !== 'brandName' || !isBrandPage) next.delete(key); });
    setParams(next, { replace: true });
  };
  const activeFiltersCount = [!isBrandPage && values.selectedBrand, values.sortBy !== 'newest', values.minPrice, values.maxPrice, values.minDiscount, values.weightSize, values.inStock, values.onSale].filter(Boolean).length;
  return {
    ...values, products, brandParamKey, activeFiltersCount, searchQuery: params.get('q') || '',
    hasActiveFilters: activeFiltersCount > 0,
    weightsSizes: extractWeightsAndSizes(products),
    sortedProducts: filterAndSortProducts(products, values),
    updateParam: (key, value) => applyFilters({ [key]: value }),
    applyFilters, clearFilters,
  };
}
