import mongoose from "mongoose";
import Product from "../../../legacy/models/Product.js";
import StoreInventory from "../models/StoreInventory.js";
import DeliveryManager from "../models/DeliveryManager.js";
import { VendorProduct } from "../../../farmer-manager-service/src/models.js";

/**
 * A dark store sells the admin catalog products approved for its vendor (VendorProduct)
 * plus its own products. Approving a product for a vendor lists it in each of that
 * vendor's stores at 0 stock; removing it switches those rows off. Rows are never
 * deleted here, so physical stock and history survive a re-approval.
 */

export const INACTIVE_REASON = {
  VENDOR_REMOVED: "vendor_removed",
  PRODUCT_ARCHIVED: "product_archived",
};

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isAdminProduct = (product) => Boolean(product?._id) && !product.ownerManagerId;

const hasValue = (value) => value !== null && value !== undefined && value !== "";

export function toObjectId(id) {
  const raw = id?._id ?? id;
  if (raw instanceof mongoose.Types.ObjectId) return raw;
  const text = String(raw || "").trim();
  return mongoose.Types.ObjectId.isValid(text) && /^[0-9a-f]{24}$/i.test(text)
    ? new mongoose.Types.ObjectId(text)
    : null;
}

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

/** Selling price and MRP a vendor's stores charge: the vendor's own values when set, else the catalog's. */
export function vendorStorePricing(product, vendorProduct) {
  const catalogMrp = Number(product?.price) || 0;
  const catalogSelling = Number(product?.discountedPrice ?? product?.price) || 0;
  const mrp = hasValue(vendorProduct?.price) ? Number(vendorProduct.price) : catalogMrp;
  let price = hasValue(vendorProduct?.discountedPrice) ? Number(vendorProduct.discountedPrice) : catalogSelling;
  if (mrp > 0 && price > mrp) price = mrp;
  return { price: Math.max(0, price), mrp: Math.max(0, mrp) };
}

/**
 * Attach the product id to rows that only carry this product's exact SKU.
 * Rows already linked to another product are left alone.
 */
export async function linkRowsToProduct(product, filter = {}, session = null) {
  const sku = inventorySkuForProduct(product);
  if (!product?._id || !sku) return 0;
  const result = await StoreInventory.updateMany(
    { ...filter, productId: null, sku: { $regex: `^${escapeRegex(sku)}$`, $options: "i" } },
    { $set: { productId: product._id } },
    { session }
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

async function vendorStoreIds(vendorId, session) {
  const id = String(vendorId || "").trim();
  if (!id) return [];
  const stores = await DeliveryManager.find({ vendorId: id }).select("_id").session(session).lean();
  return stores.map((store) => store._id);
}

const PRODUCT_SYNC_FIELDS =
  "_id sku name categories subcategory unit price discountedPrice isActive ownerManagerId ownerVendorId";

/**
 * Make every store of `vendorId` match that vendor's approval for one catalog product:
 * approved + active → row on (created at 0 stock if missing, price/MRP refreshed);
 * otherwise → row switched off. Pass `managerIds` to limit it to some of the vendor's stores.
 */
export async function syncVendorProductToStores(vendorId, productId, { session = null, managerIds = null } = {}) {
  const result = { listed: 0, created: 0, switchedOff: 0, skipped: [] };
  const vid = String(vendorId || "").trim();
  const pid = toObjectId(productId);
  if (!vid || !pid) return result;

  let storeIds = await vendorStoreIds(vid, session);
  if (managerIds) {
    const wanted = new Set(managerIds.map(String));
    storeIds = storeIds.filter((id) => wanted.has(String(id)));
  }
  if (!storeIds.length) return result;

  // Sequential: operations sharing a transaction session must not run in parallel.
  const product = await Product.findById(pid).select(PRODUCT_SYNC_FIELDS).session(session).lean();
  const link = await VendorProduct.findOne({ vendorId: vid, productId: pid }).session(session).lean();
  const ownedByOtherVendor = Boolean(product?.ownerVendorId) && product.ownerVendorId !== vid;
  const sellable = Boolean(link && product && isAdminProduct(product) && product.isActive !== false && !ownedByOtherVendor);

  if (!sellable) {
    const reason = link && product && product.isActive === false
      ? INACTIVE_REASON.PRODUCT_ARCHIVED
      : INACTIVE_REASON.VENDOR_REMOVED;
    const off = await StoreInventory.updateMany(
      { managerId: { $in: storeIds }, productId: pid, isActive: true },
      { $set: { isActive: false, inactiveReason: reason } },
      { session }
    );
    result.switchedOff = off.modifiedCount || 0;
    return result;
  }

  const sku = inventorySkuForProduct(product);
  const { price, mrp } = vendorStorePricing(product, link);
  const fields = {
    name: product.name,
    category: product.categories?.[0] || product.subcategory || "General",
    unit: link.customUnit || product.unit || "pcs",
    price,
    mrp,
    isActive: true,
    inactiveReason: "",
  };

  for (const managerId of storeIds) {
    await linkRowsToProduct(product, { managerId }, session);
    const existing = await StoreInventory.findOne({ managerId, productId: pid }).select("_id").session(session).lean();
    if (existing) {
      await StoreInventory.updateOne({ _id: existing._id }, { $set: fields }, { session });
      result.listed += 1;
      continue;
    }
    // (managerId, sku) is unique: a row for another product holding this SKU blocks the insert.
    const clash = await StoreInventory.exists({
      managerId,
      sku: { $regex: `^${escapeRegex(sku)}$`, $options: "i" },
    }).session(session);
    if (clash) {
      result.skipped.push({ managerId: String(managerId), sku, reason: "sku_in_use" });
      continue;
    }
    await StoreInventory.create(
      [{ managerId, productId: pid, sku, ...fields, stockCount: 0, lowStockThreshold: 10 }],
      { session }
    );
    result.created += 1;
    result.listed += 1;
  }
  if (result.skipped.length) {
    console.warn("[catalogStoreInventory] SKU already used by another stock row:", JSON.stringify(result.skipped));
  }
  return result;
}

/**
 * Whether a dark store may stock a product: one of its own products, or an active catalog
 * product approved for its vendor. SKUs with no catalog product are stock-only rows that
 * customers never see, so they are allowed.
 */
export async function storeMaySellProduct(managerId, productId) {
  const pid = toObjectId(productId);
  if (!pid) return { allowed: true };
  const product = await Product.findById(pid).select("name ownerManagerId ownerVendorId isActive").lean();
  if (!product || product.isActive === false) {
    return { allowed: false, reason: "This product is not active in the catalog" };
  }
  if (product.ownerManagerId) {
    return String(product.ownerManagerId) === String(managerId)
      ? { allowed: true }
      : { allowed: false, reason: "This product belongs to another dark store" };
  }
  const manager = await DeliveryManager.findById(managerId).select("vendorId").lean();
  const vendorId = String(manager?.vendorId || "").trim();
  const approved = vendorId && (await VendorProduct.exists({ vendorId, productId: pid }));
  return approved
    ? { allowed: true }
    : { allowed: false, reason: `"${product.name}" is not approved for this store's vendor` };
}

/** Re-sync every vendor approved for this product (after a catalog edit, archive or restore). */
export async function syncProductForAllVendors(productId, { session = null } = {}) {
  const pid = toObjectId(productId);
  if (!pid) return 0;
  const vendorIds = await VendorProduct.distinct("vendorId", { productId: pid }).session(session);
  for (const vendorId of vendorIds) {
    await syncVendorProductToStores(vendorId, pid, { session });
  }
  return vendorIds.length;
}

/** Switch off every product of a vendor in that vendor's stores (vendor deleted / unlinked). */
export async function switchOffVendorProducts(vendorId, { session = null } = {}) {
  const storeIds = await vendorStoreIds(vendorId, session);
  if (!storeIds.length) return 0;
  const productIds = await VendorProduct.distinct("productId", { vendorId: String(vendorId) }).session(session);
  if (!productIds.length) return 0;
  const off = await StoreInventory.updateMany(
    { managerId: { $in: storeIds }, productId: { $in: productIds }, isActive: true },
    { $set: { isActive: false, inactiveReason: INACTIVE_REASON.VENDOR_REMOVED } },
    { session }
  );
  return off.modifiedCount || 0;
}

/**
 * Keep store rows in step with an edited catalog product: follow a SKU change, refresh
 * name/unit/category, switch rows off while it is archived and back on when restored.
 * Rows of approved vendors get that vendor's price; it never adds the product to new stores.
 */
export async function refreshProductInStores(product, previous = null, { session = null } = {}) {
  if (!isAdminProduct(product)) return 0;
  const sku = inventorySkuForProduct(product);
  if (previous) await linkRowsToProduct(previous, {}, session);
  await linkRowsToProduct(product, {}, session);

  const alreadyHasNew = await StoreInventory.distinct("managerId", {
    sku,
    productId: { $ne: product._id },
  }).session(session);
  await StoreInventory.updateMany(
    { productId: product._id, sku: { $ne: sku }, managerId: { $nin: alreadyHasNew } },
    { $set: { sku } },
    { session }
  );

  if (product.isActive === false) {
    const off = await StoreInventory.updateMany(
      { productId: product._id, isActive: true },
      { $set: { isActive: false, inactiveReason: INACTIVE_REASON.PRODUCT_ARCHIVED } },
      { session }
    );
    return off.modifiedCount || 0;
  }

  await StoreInventory.updateMany(
    { productId: product._id, inactiveReason: INACTIVE_REASON.PRODUCT_ARCHIVED },
    { $set: { isActive: true, inactiveReason: "" } },
    { session }
  );
  await StoreInventory.updateMany({ productId: product._id }, { $set: catalogFields(product) }, { session });
  return syncProductForAllVendors(product._id, { session });
}

/** List every product approved for this store's vendor (new stores, backfills). */
export async function addVendorCatalogToStore(managerOrId) {
  const manager =
    managerOrId && typeof managerOrId === "object" && "vendorId" in managerOrId
      ? managerOrId
      : await DeliveryManager.findById(managerOrId?._id || managerOrId).select("_id vendorId").lean();
  if (!manager?._id || !manager.vendorId) return 0;

  const links = await VendorProduct.find({ vendorId: manager.vendorId }).select("productId").lean();
  let created = 0;
  for (const link of links) {
    const result = await syncVendorProductToStores(manager.vendorId, link.productId, { managerIds: [manager._id] });
    created += result.created;
  }
  return created;
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
