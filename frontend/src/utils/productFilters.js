export const PRODUCT_FILTER_KEYS = ['brand', 'brandName', 'sort', 'minPrice', 'maxPrice', 'minDiscount', 'weightSize', 'inStock', 'onSale'];

export const PRODUCT_SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'discount-asc', label: 'Discount: Low to High' },
  { id: 'discount-desc', label: 'Discount: High to Low' },
  { id: 'weight-asc', label: 'Weight: Low to High' },
  { id: 'weight-desc', label: 'Weight: High to Low' },
  { id: 'name', label: 'Name: A to Z' },
  { id: 'brand', label: 'Brand: A to Z' },
];

export function readProductFilters(params) {
  return {
    selectedBrand: params.get('brandName')?.trim() || params.get('brand')?.trim() || '',
    sortBy: params.get('sort') || 'newest',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    minDiscount: params.get('minDiscount') || '',
    weightSize: params.get('weightSize') || '',
    inStock: params.get('inStock') === 'true',
    onSale: params.get('onSale') === 'true',
  };
}

const price = product => Number(product.discountedPrice ?? product.price ?? 0);
export function productDiscount(product) {
  if (product.discountedPercent != null) return Number(product.discountedPercent) || 0;
  const original = Number(product.price) || 0;
  return original > 0 ? Math.max(0, (original - price(product)) / original * 100) : 0;
}
const sizeText = product => `${product.variants?.[0]?.name || ''} ${product.subcategory || ''} ${product.name || ''}`;

export function productWeight(product) {
  const text = sizeText(product);
  for (const [pattern, scale] of [
    [/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/i, 1000],
    [/(\d+(?:\.\d+)?)\s*(?:g|gm|gms)\b/i, 1],
    [/(\d+(?:\.\d+)?)\s*(?:l|ltr|litre)\b/i, 1000],
    [/(\d+(?:\.\d+)?)\s*ml\b/i, 1],
    [/(\d+)\s*(?:pc|pcs|piece|pieces|pack)\b/i, 100],
  ]) {
    const match = text.match(pattern);
    if (match) return Number(match[1]) * scale;
  }
  return 0;
}

export function extractWeightsAndSizes(products) {
  const sizes = new Set();
  const pattern = /\b(\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|ml|l|ltr|litre|pc|pcs|pack))\b/gi;
  for (const product of products) {
    for (const variant of product.variants || []) if (variant.name?.trim()) sizes.add(variant.name.trim());
    if (product.subcategory?.match(pattern)) sizes.add(product.subcategory.trim());
    for (const match of (product.name || '').matchAll(pattern)) sizes.add(match[1].trim());
  }
  return [...sizes].sort((a, b) => Number(a.match(/\d+(?:\.\d+)?/)?.[0] || 0) - Number(b.match(/\d+(?:\.\d+)?/)?.[0] || 0));
}

export function filterAndSortProducts(products, filters) {
  const list = products.filter(product => {
    if (filters.selectedBrand && (product.brandName || '').toLowerCase() !== filters.selectedBrand.toLowerCase()) return false;
    if (filters.minPrice !== '' && filters.minPrice != null && price(product) < Number(filters.minPrice)) return false;
    if (filters.maxPrice !== '' && filters.maxPrice != null && price(product) > Number(filters.maxPrice)) return false;
    if (filters.minDiscount && productDiscount(product) < Number(filters.minDiscount)) return false;
    if (filters.onSale && productDiscount(product) <= 0) return false;
    if (filters.weightSize) {
      const needle = filters.weightSize.trim().toLowerCase();
      const text = `${product.name || ''} ${product.subcategory || ''} ${(product.variants || []).map(variant => variant.name || '').join(' ')}`.toLowerCase();
      if (!text.includes(needle)) return false;
    }
    if (filters.inStock && (product.isActive === false || Number(product.storeStock ?? product.stock ?? (product.inStock ? 1 : 0)) <= 0)) return false;
    return true;
  });
  const comparators = {
    'price-asc': (a, b) => price(a) - price(b),
    'price-desc': (a, b) => price(b) - price(a),
    'discount-asc': (a, b) => productDiscount(a) - productDiscount(b),
    'discount-desc': (a, b) => productDiscount(b) - productDiscount(a),
    'weight-asc': (a, b) => productWeight(a) - productWeight(b),
    'weight-desc': (a, b) => productWeight(b) - productWeight(a),
    newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    oldest: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
    name: (a, b) => (a.name || '').localeCompare(b.name || ''),
    brand: (a, b) => (a.brandName || '').localeCompare(b.brandName || ''),
  };
  return list.sort(comparators[filters.sortBy] || comparators.newest);
}
