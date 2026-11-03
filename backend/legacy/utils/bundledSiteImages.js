import { configuredCdnBase } from './imageUrlConfig.js';

// These files ship in frontend/public/categories; they are not S3 uploads.
const SITE_IMAGES = new Set([
  '/categories/bakery.webp',
  '/categories/beverages.webp',
  '/categories/cat_dairy_farm.jpg',
  '/categories/cat_exotic_vegetables.jpg',
  '/categories/cat_fruits.jpg',
  '/categories/cat_leafy_greens.jpg',
  '/categories/cat_organic_products.jpg',
  '/categories/cat_organic_vegetables.jpg',
  '/categories/cat_pulses_grains.jpg',
  '/categories/category_beverages.jpg',
  '/categories/category_combo_packs.jpg',
  '/categories/category_dairy_eggs.png',
  '/categories/category_exotic_vegetables.jpg',
  '/categories/category_fruits.jpg',
  '/categories/category_oils_ghee.jpg',
  '/categories/category_organic_range.jpg',
  '/categories/category_pulses_grains.jpg',
  '/categories/category_spices_dry_fruits.jpg',
  '/categories/category_vegetables.jpg',
  '/categories/dairy.webp',
  '/categories/dry-fruits.webp',
  '/categories/dry_fruits.webp',
  '/categories/fruits.webp',
  '/categories/grains.webp',
  '/categories/grocery.webp',
  '/categories/oils.webp',
  '/categories/organic.webp',
  '/categories/pulses.webp',
  '/categories/shop_beverages.jpg',
  '/categories/shop_combo_packs.jpg',
  '/categories/shop_dairy.jpg',
  '/categories/shop_dairy_eggs.jpg',
  '/categories/shop_dairy_eggs.png',
  '/categories/shop_dry_fruits.jpg',
  '/categories/shop_exotic_veg.jpg',
  '/categories/shop_fruits.jpg',
  '/categories/shop_grains.jpg',
  '/categories/shop_grocery.jpg',
  '/categories/shop_oils.jpg',
  '/categories/shop_organic_range.jpg',
  '/categories/shop_pulses.jpg',
  '/categories/shop_spices.jpg',
  '/categories/shop_vegetables.jpg',
  '/categories/spices.webp',
  '/categories/vegetables.webp',
]);

export function bundledSiteImageUrl(value) {
  let pathname = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const cdnHost = configuredCdnBase() ? new URL(configuredCdnBase()).hostname : '';
      if (!['cdn.greengrocc.com', 'cdn.greengrocc.in', cdnHost].includes(url.hostname) || url.search) return null;
      pathname = url.pathname;
    } catch { return null; }
  }
  if (!SITE_IMAGES.has(pathname)) return null;
  const configured = (process.env.WEBSITE_ASSET_URL || 'https://greengrocc.com').trim().replace(/\/+$/, '');
  const base = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  return `${base}${pathname}`;
}
