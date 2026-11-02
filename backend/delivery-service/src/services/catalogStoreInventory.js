import Product from "../../../legacy/models/Product.js";
import StoreInventory from "../models/StoreInventory.js";
import DeliveryManager from "../models/DeliveryManager.js";

/**
 * Admin catalog products are listed in every dark store's inventory, starting at
 * 0 units, so each store can see them and request stock.
 */

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isAdminProduct = (product) => Boolean(product?._id) && !product.ownerManagerId;

/** Same fallback SKU the order dispatcher uses for products without one. */
export function inventorySkuForProduct(product) {
  const sku = String(product?.sku || "").trim();
  if (sku) return sku;
  const id = String(product?._id || "");
  return id ? `P-${id.slice(-8)}` : "";
}

export function catalogFields(product) {
  return {
    name: product.name,
    category: product.categories?.[0] || product.subcategory || "General",
    unit: product.unit || "pcs",
    price: Number(product.discountedPrice ?? product.price) || 0,
  };
}

/**
 * Attach the product id to rows that only carry this product's exact SKU.
 * Rows already linked to another product are left alone.
 */
export async function linkRowsToProduct(product, filter = {}) {
  const sku = inventorySkuForProduct(product);
  if (!product?._id || !sku) return 0;
  const result = await StoreInventory.updateMany(
    { ...filter, productId: null, sku: { $regex: `^${escapeRegex(sku)}$`, $options: "i" } },
    { $set: { productId: product._id } }
  );
  return result.modifiedCount || 0;
}

/** Product whose own (or fallback) SKU equals this row's SKU exactly. */
export async function productIdForSku(sku) {
  const clean = String(sku || "").trim();
  if (!clean) return null;
  const bySku = await Product.findOne({
    sku: { $regex: `^${escapeRegex(clean)}$`, $options: "i" },
  })
    .select("_id")
    .lean();
  if (bySku) return bySku._id;

  const fallback = /^P-([0-9a-f]{8})$/i.exec(clean);
  if (!fallback) return null;
  const candidates = await Product.find({ $or: [{ sku: "" }, { sku: null }, { sku: { $exists: false } }] })
    .select("_id")
    .lean();
  const tail = fallback[1].toLowerCase();
  return candidates.find((p) => String(p._id).endsWith(tail))?._id || null;
}

function zeroStockUpsert(product, managerId) {
  const sku = inventorySkuForProduct(product);
  if (!sku) return null;
  const initialStock = Number(product.stock) > 0 ? Number(product.stock) : (product.inStock !== false ? 100 : 0);
  return {
    updateOne: {
      filter: { managerId, productId: product._id },
      update: {
        $setOnInsert: {
          managerId,
          productId: product._id,
          sku,
          ...catalogFields(product),
          stockCount: initialStock,
          lowStockThreshold: 10,
          isActive: true,
        },
      },
      upsert: true,
    },
  };
}

async function writeUpserts(ops) {
  const valid = ops.filter(Boolean);
  if (!valid.length) return 0;
  try {
    const result = await StoreInventory.bulkWrite(valid, { ordered: false });
    return result.upsertedCount || 0;
  } catch (err) {
    // A store may hold an unlinked row with the same SKU for a different product.
    if (err?.code === 11000 || err?.writeErrors) return err.result?.upsertedCount || 0;
    throw err;
  }
}

async function upsertRows(product, managerIds) {
  await linkRowsToProduct(product, { managerId: { $in: managerIds } });
  return writeUpserts(managerIds.map((managerId) => zeroStockUpsert(product, managerId)));
}

async function activeStoreIds() {
  const stores = await DeliveryManager.find({ isActive: true }).select("_id").lean();
  return stores.map((store) => store._id);
}

/** Add a newly created admin product to every active dark store with 0 stock. */
export async function addProductToAllStores(product) {
  if (!isAdminProduct(product)) return 0;
  return upsertRows(product, await activeStoreIds());
}

/**
 * Keep store rows in step with an edited admin product: follow a SKU change,
 * refresh name/price/unit/category, and add the product to stores missing it.
 */
export async function syncProductToStores(product, previous = null) {
  if (!isAdminProduct(product)) return 0;
  const sku = inventorySkuForProduct(product);
  if (previous) await linkRowsToProduct(previous);
  await linkRowsToProduct(product);

  const alreadyHasNew = await StoreInventory.distinct("managerId", {
    sku,
    productId: { $ne: product._id },
  });
  await StoreInventory.updateMany(
    { productId: product._id, sku: { $ne: sku }, managerId: { $nin: alreadyHasNew } },
    { $set: { sku } }
  );

  await StoreInventory.updateMany({ productId: product._id }, { $set: catalogFields(product) });
  return upsertRows(product, await activeStoreIds());
}

/** List every active admin product in one dark store (new stores, backfills). */
export async function addCatalogToStore(managerId) {
  if (!managerId) return 0;
  const products = await Product.find({ ownerManagerId: null, isActive: true })
    .select("_id sku name categories subcategory unit price discountedPrice")
    .lean();
  for (const product of products) {
    await linkRowsToProduct(product, { managerId });
  }
  return writeUpserts(products.map((product) => zeroStockUpsert(product, managerId)));
}

/**
 * One-off backfill: link every unlinked row whose SKU exactly equals a product's
 * SKU (or its `P-xxxxxxxx` fallback). Names are never used.
 */
export async function linkAllInventoryToProducts() {
  const products = await Product.find({}).select("_id sku").lean();
  let linked = 0;
  for (const product of products) {
    linked += await linkRowsToProduct(product);
  }
  const unlinked = await StoreInventory.countDocuments({ productId: null });
  return { linked, unlinked };
}
