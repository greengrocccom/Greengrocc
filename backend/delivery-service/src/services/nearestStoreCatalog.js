import StoreInventory from "../models/StoreInventory.js";
import DeliveryManager from "../models/DeliveryManager.js";
import Product from "../../../legacy/models/Product.js";
import { createMemoryCache } from "../../../shared/cache/memoryCache.js";
import { resolveDarkStoreForOrder } from "./darkStoreResolver.js";
import { inventorySkuForProduct } from "./catalogStoreInventory.js";
import { sectionToDepartment } from "../../../legacy/utils/departmentHelpers.js";
import { geocodeAddressString } from "../../../legacy/services/reverseGeocodeService.js";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const CATEGORY_ALIASES = {
  staples: ["staples", "grains"],
  grains: ["staples", "grains"],
  grocery: ["staples", "snacks", "household", "ready to cook", "grocery"],
  pulses: ["staples", "pulses"],
  oils: ["staples", "oils"],
  bakery: ["bakery"],
  "ready to cook": ["ready to cook"],
  "personal care": ["personal care"],
  household: ["household"],
  beverages: ["beverages"],
  snacks: ["snacks"],
};

/** Active stock rows of one dark store (cached; treat the result as read-only). */
export function loadStoreInventory(storeId) {
  const key = String(storeId);
  return storeInventoryCache.get(key, () =>
    StoreInventory.find({ managerId: storeId, isActive: true }).lean()
  );
}

export function addressFromQuery(query = {}) {
  const lat = toNumber(query.lat ?? query.latitude);
  const lng = toNumber(query.lng ?? query.longitude);
  return {
    city: String(query.city || "").trim(),
    area: String(query.area || "").trim(),
    pincode: String(query.pincode || "").trim(),
    fullAddress: String(query.address || query.fullAddress || "").trim(),
    landmark: String(query.area || "").trim(),
    lat,
    lng,
    location: lat != null && lng != null ? { lat, lng } : null,
  };
}

export function hasLocationHint(address = {}) {
  return Boolean(
    address.city ||
      address.area ||
      address.pincode ||
      address.fullAddress ||
      (address.lat != null && address.lng != null) ||
      address.location?.lat != null
  );
}

export function storePublicPayload(manager, extra = {}) {
  if (!manager) return null;
  const storeName = manager.storeName || `${manager.area || "Dark"} Store`;
  return {
    id: manager._id?.toString?.() || manager.id,
    storeName,
    area: manager.area || "",
    city: manager.city || "",
    state: manager.state || "",
    pincode: manager.pincode || "",
    phone: manager.phone || "",
    address:
      manager.storeAddress ||
      [storeName, manager.area, manager.city, manager.state, manager.pincode]
        .filter(Boolean)
        .join(", "),
    latitude: manager.latitude,
    longitude: manager.longitude,
    ...extra,
  };
}

/** Products that own one of these stock rows: by linked product id, else exact SKU. */
export function mongoMatchForInventory(items) {
  if (!items.length) return { _id: { $in: [] } };

  const ids = [...new Set(items.map((item) => item.productId).filter(Boolean).map(String))];
  const skus = [
    ...new Set(
      items
        .filter((item) => !item.productId)
        .flatMap((item) => {
          const sku = String(item.sku || "").trim();
          if (!sku) return [];
          return [sku, sku.toUpperCase(), sku.toLowerCase()];
        })
    ),
  ];

  const or = [];
  if (ids.length) or.push({ _id: { $in: ids } });
  if (skus.length) or.push({ sku: { $in: skus } });
  return or.length ? { $or: or } : { _id: { $in: [] } };
}

/** The stock row for a product: the row linked to it, else an unlinked row with its exact SKU. */
export function matchProductToItem(product, items) {
  const id = String(product?._id || "");
  if (id) {
    const linked = items.find((item) => item.productId && String(item.productId) === id);
    if (linked) return linked;
  }
  const sku = inventorySkuForProduct(product).toUpperCase();
  if (!sku) return null;
  return (
    items.find(
      (item) => !item.productId && String(item.sku || "").trim().toUpperCase() === sku
    ) || null
  );
}

function filterItemsByCategory(items, categoryName) {
  const wanted = String(categoryName || "").trim().toLowerCase();
  if (!wanted || wanted === "most purchase") return items;
  const accepted = new Set([wanted, ...(CATEGORY_ALIASES[wanted] || [])]);
  return items.filter((item) => accepted.has(String(item.category || "").toLowerCase()));
}

export async function resolveMatchingProducts(items) {
  if (!items.length) return [];
  const found = await Product.find({ isActive: true, ...mongoMatchForInventory(items) })
    .select("_id sku name")
    .lean();
  return found.filter((product) => matchProductToItem(product, items));
}

function applyStoreStock(doc, item, catalog) {
  const hasStore = Boolean(catalog?.store?.id || catalog?.store?._id || catalog?.manager);
  // No location yet → keep catalog stock as-is. A known location with no dark
  // store serving it falls through and shows everything out of stock.
  if (!hasStore && catalog?.needsLocation !== false) {
    return {
      ...doc,
      storeStock: null,
      storeSku: "",
      storeCategory: "",
      storeId: null,
      storeName: "",
      storeArea: "",
    };
  }

  const storeStock = item ? Number(item.stockCount) || 0 : 0;
  const inStock = storeStock > 0;
  const storePrice = Number(item?.price);
  const variants = Array.isArray(doc.variants)
    ? doc.variants.map((variant) => ({
        ...variant,
        inStock,
        stock: storeStock,
      }))
    : doc.variants;
  return {
    ...doc,
    variants,
    inStock,
    stock: storeStock,
    storeStock,
    storeSku: item?.sku || "",
    storeCategory: item?.category || "",
    storeId: catalog?.store?.id || catalog?.store?._id || null,
    storeName: catalog?.store?.storeName || "",
    storeArea: catalog?.store?.area || "",
    ...(item && Number.isFinite(storePrice) && storePrice > 0
      ? { discountedPrice: storePrice, price: Math.max(doc.price || storePrice, storePrice) }
      : {}),
  };
}

export function attachStoreAvailability(products, catalog) {
  const list = Array.isArray(products) ? products : [];
  if (!catalog?.requested) return list;

  const items = Array.isArray(catalog.items) ? catalog.items : [];
  return list.map((product) => {
    const doc = product?.toObject ? product.toObject() : { ...product };
    const item = items.length ? matchProductToItem(doc, items) : null;
    return applyStoreStock(doc, item, catalog);
  });
}

const MANAGERS = DeliveryManager.collection.collectionName.toLowerCase();
const INVENTORY = StoreInventory.collection.collectionName.toLowerCase();

/** Address → resolved dark store. Any dark-store edit can move coverage, so it clears everything. */
const storeResolutionCache = createMemoryCache({
  name: "nearest-store-resolution",
  ttlMs: 5 * 60_000,
  maxEntries: 2000,
  invalidateOn: ({ coll }) => coll === MANAGERS,
});

/** Dark store → its stock rows. Only the store whose stock changed is cleared. */
const storeInventoryCache = createMemoryCache({
  name: "dark-store-inventory",
  ttlMs: 60_000,
  maxEntries: 200,
  maxBytes: 10_000_000,
  invalidateOn: ({ coll, doc }) => {
    if (coll !== INVENTORY) return false;
    if (!doc?.managerId) return true;
    const storeId = String(doc.managerId);
    return (key) => key === storeId;
  },
});

const roundCoord = (value) => (value == null ? "" : Number(value).toFixed(4));

function resolutionKey(address, department, pickup) {
  return [
    department,
    pickup ? "pickup" : "delivery",
    roundCoord(address.lat),
    roundCoord(address.lng),
    address.pincode,
    address.city.toLowerCase(),
    address.area.toLowerCase(),
    address.fullAddress.toLowerCase(),
  ].join("|");
}

async function resolveStore(address, department, pickup, needsLocation) {
  if (pickup && !needsLocation && address.lat == null) {
    const text = [address.fullAddress, address.area, address.city, address.pincode]
      .filter(Boolean)
      .join(", ");
    const coords = await geocodeAddressString(text).catch(() => null);
    if (coords) {
      address.lat = coords.lat;
      address.lng = coords.lng;
      address.location = coords;
    }
  }
  const resolved = await resolveDarkStoreForOrder(address, {
    allowPincodeFallback: department === "preorder",
    anyDistance: pickup,
  });
  const manager = resolved.manager?.toObject ? resolved.manager.toObject() : resolved.manager || null;
  return { manager, distanceKm: resolved.distanceKm, reason: resolved.reason };
}

export async function loadNearestStoreCatalog(query = {}) {
  const address = addressFromQuery(query);
  const needsLocation = !hasLocationHint(address);
  const pickup = String(query.fulfillment || "").trim().toLowerCase() === "pickup";
  const department = sectionToDepartment(query.section, query.storeType);

  const resolved = await storeResolutionCache.get(resolutionKey(address, department, pickup), () =>
    resolveStore(address, department, pickup, needsLocation)
  );
  const manager = resolved.manager;
  if (!manager) {
    return {
      requested: true,
      needsLocation,
      manager: null,
      store: null,
      items: [],
      productIds: [],
      productMatch: { _id: { $in: [] } },
      reason: resolved.reason || "no_store",
    };
  }

  const inventory = await loadStoreInventory(manager._id);

  const inStockItems = inventory.filter((item) => Number(item.stockCount) > 0);

  return {
    requested: true,
    needsLocation,
    manager,
    store: storePublicPayload(manager, {
      distanceKm: resolved.distanceKm,
      reason: resolved.reason,
      inStockCount: inStockItems.length,
      categories: [...new Set(inventory.map((item) => item.category).filter(Boolean))],
    }),
    items: inventory,
    inStockItems,
    productIds: [],
    productMatch: null,
    reason: resolved.reason,
  };
}

/**
 * Products a customer may see: the whole admin catalog, plus the resolved dark
 * store's own products. Admin products the store doesn't stock still show —
 * attachStoreAvailability marks them out of stock.
 * UPDATE: To hide out-of-stock products completely until approved, we only
 * show admin products if they have > 0 stock.
 */
export function storeProductScope(catalog) {
  const manager = catalog?.manager;
  if (!manager) return { ownerManagerId: null };
  const inStockMatch = mongoMatchForInventory(catalog.inStockItems || []);
  return { 
    $or: [
      { ownerManagerId: manager._id },
      { $and: [{ ownerManagerId: null }, inStockMatch] }
    ]
  };
}

export function mergeStoreFilter(baseFilter, _catalog) {
  return baseFilter;
}
