import mongoose from "mongoose";
import Product from "../../../legacy/models/Product.js";
import StoreInventory from "../models/StoreInventory.js";
import {
  createProductRecord,
  updateProductRecord,
} from "../../../legacy/controllers/productController.js";
import { getManager } from "./managerDashboardController.js";
import {
  catalogFields,
  inventorySkuForProduct,
  linkRowsToProduct,
} from "../services/catalogStoreInventory.js";
import { randomIdSuffix } from "../../../shared/ids.js";

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SECTION_ALIASES = {
  preorder: ["preorder", "greengrocc", "main"],
  ready2cook: ["ready2cook", "ready-2-cook", "festive"],
  instantorder: ["instantorder", "instant", "supermall", "mall"],
};

function generateSku(manager) {
  const store = String(manager._id).slice(-4).toUpperCase();
  return `DM${store}-${Date.now().toString().slice(-7)}${randomIdSuffix(2).toUpperCase()}`;
}

/**
 * Keep the dark store's inventory row in step with the product so it shows as
 * in-stock for this store's customers and stock is deducted when orders are packed.
 */
async function syncInventory(manager, product, { previousSku = "", stock } = {}) {
  const sku = String(product.sku || "").trim();
  if (!sku) return;

  const update = {
    name: product.name,
    category: product.categories?.[0] || "General",
    unit: product.unit || "pcs",
    price: Number(product.discountedPrice || product.price || 0),
    isActive: product.isActive !== false,
  };
  if (stock !== undefined) {
    update.stockCount = Math.max(0, Number(stock) || 0);
  }

  const linked = await StoreInventory.findOne({ managerId: manager._id, productId: product._id });
  if (!linked) {
    const skus = [...new Set([sku, previousSku].filter(Boolean))];
    await StoreInventory.updateOne(
      { managerId: manager._id, productId: null, sku: { $in: skus } },
      { $set: { productId: product._id } }
    );
  }

  await StoreInventory.updateOne(
    { managerId: manager._id, productId: product._id },
    update.stockCount === undefined
      ? { $set: { sku, ...update }, $setOnInsert: { stockCount: 0 } }
      : { $set: { sku, ...update } },
    { upsert: true }
  );
}

function withStock(product, inventoryBySku) {
  const doc = product.toObject ? product.toObject() : product;
  const row =
    inventoryBySku.get(`pid:${doc._id}`) ||
    inventoryBySku.get(inventorySkuForProduct(doc).toUpperCase());
  return {
    ...doc,
    storeStock: row ? row.stockCount : 0,
    isCatalogProduct: !doc.ownerManagerId,
  };
}

/** This store's own products plus the catalog products it lists (those approved for its vendor). */
export const listManagerProducts = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const listedIds = await StoreInventory.distinct("productId", {
      managerId: manager._id,
      isActive: true,
      productId: { $ne: null },
    });
    const and = [
      {
        $or: [
          { ownerManagerId: manager._id },
          { ownerManagerId: null, isActive: true, _id: { $in: listedIds } },
        ],
      },
    ];

    const section = String(req.query.section || "").trim().toLowerCase();
    if (section && section !== "all") {
      and.push({ section: { $in: SECTION_ALIASES[section] || [section] } });
    }

    const search = String(req.query.search || "").trim();
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      and.push({
        $or: [{ name: pattern }, { sku: pattern }, { departmentId: pattern }, { categories: pattern }],
      });
    }

    const products = await Product.find({ $and: and }).sort({ createdAt: -1 }).limit(2000);
    const inventory = await StoreInventory.find({ managerId: manager._id })
      .select("sku productId stockCount")
      .lean();
    const inventoryBySku = new Map();
    for (const row of inventory) {
      if (!row.productId) inventoryBySku.set(String(row.sku).toUpperCase(), row);
      else inventoryBySku.set(`pid:${row.productId}`, row);
    }

    return res.json({
      success: true,
      data: products.map((product) => withStock(product, inventoryBySku)),
      store: {
        id: manager._id.toString(),
        storeName: manager.storeName || `${manager.area} Store`,
        pincode: manager.pincode || "",
        area: manager.area || "",
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createManagerProduct = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const body = { ...req.body };
    if (!String(body.sku || "").trim()) body.sku = generateSku(manager);

    const result = await createProductRecord(body, { ownerManagerId: manager._id });
    if (result.product) {
      await syncInventory(manager, result.product, { stock: body.stock ?? 0 });
    }
    return res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
};

export const updateManagerProduct = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const existing = mongoose.Types.ObjectId.isValid(req.params.id)
      ? await Product.findOne({ _id: req.params.id, ownerManagerId: manager._id }).select("sku")
      : null;
    if (!existing) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const result = await updateProductRecord(req.params.id, req.body, {
      ownerManagerId: manager._id,
    });
    if (result.product) {
      await syncInventory(manager, result.product, {
        previousSku: existing.sku,
        stock: req.body.stock,
      });
    }
    return res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
};

const MAX_STOCK = 100000;

/**
 * PUT /products/:id/stock  { stock } — set this store's stock for one of its own products
 * or a catalog product it lists (approved for its vendor). 0 = out of stock.
 */
export const setManagerProductStock = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const stock = Number(req.body?.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > MAX_STOCK) {
      return res.status(400).json({
        success: false,
        message: `Stock must be a whole number between 0 and ${MAX_STOCK}`,
      });
    }

    const product = mongoose.Types.ObjectId.isValid(req.params.id)
      ? await Product.findOne({
          _id: req.params.id,
          $or: [{ ownerManagerId: manager._id }, { ownerManagerId: null }],
        }).lean()
      : null;
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const ownProduct = String(product.ownerManagerId || "") === String(manager._id);
    const sku = inventorySkuForProduct(product);
    await linkRowsToProduct(product, { managerId: manager._id });
    const row = await StoreInventory.findOneAndUpdate(
      ownProduct
        ? { managerId: manager._id, productId: product._id }
        : { managerId: manager._id, productId: product._id, isActive: true },
      { $set: ownProduct ? { stockCount: stock, isActive: true } : { stockCount: stock } },
      { returnDocument: 'after' }
    );
    if (!row) {
      if (!ownProduct) {
        return res.status(404).json({
          success: false,
          message: `"${product.name}" is not approved for your vendor, so this store cannot sell it`,
        });
      }
      await StoreInventory.create({
        managerId: manager._id,
        productId: product._id,
        sku,
        ...catalogFields(product),
        stockCount: stock,
        lowStockThreshold: 10,
        isActive: true,
      });
    }

    return res.json({
      success: true,
      message: stock > 0 ? `"${product.name}" is in stock (${stock})` : `"${product.name}" marked out of stock`,
      storeStock: stock,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteManagerProduct = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      ownerManagerId: manager._id,
    });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    await StoreInventory.deleteMany({
      managerId: manager._id,
      $or: [{ productId: product._id }, ...(product.sku ? [{ productId: null, sku: product.sku }] : [])],
    });
    return res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    next(error);
  }
};
