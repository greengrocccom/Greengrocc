import Product from "../models/Product.js";
import { transformProductResponse } from "../utils/urlResolver.js";
import Category from "../models/Category.js";
import Order from "../models/order/Order.js";
import mongoose from "mongoose";
import { normalizeOptionalQuantity, resolvePricingFields } from "../utils/productPricing.js";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination.js";
import {
  attachStoreAvailability,
  loadNearestStoreCatalog,
  storeProductScope,
} from "../../delivery-service/src/services/nearestStoreCatalog.js";
import {
  addProductToAllStores,
  syncProductToStores,
} from "../../delivery-service/src/services/catalogStoreInventory.js";
import { attachQuantityDiscounts } from "../../admin-ops-service/src/pricingAttach.js";
import { DynamicPricingRule } from "../../admin-ops-service/src/models.js";
import { VendorProduct } from "../../farmer-manager-service/src/models.js";
import StoreInventory from "../../delivery-service/src/models/StoreInventory.js";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import { createMemoryCache } from "../../shared/cache/memoryCache.js";
import { buildDepartmentId, normalizeDeptToken } from "../utils/departmentHelpers.js";
import {
  cropCodeFromName,
  varietyCodeFromName,
  resolveCategoryCode,
} from "../../erp-service/src/config/idRegistry.js";

const MOST_PURCHASE_TAG = "Most Purchase";

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeProductFlag = (value) => value === true || value === "true";

const normalizeShowFarmerTraceability = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === false || value === 0 || value === "0") return false;
  if (typeof value === "string" && value.trim().toLowerCase() === "false") return false;
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string" && value.trim().toLowerCase() === "true") return true;
  return fallback;
};

const VENDOR_FARMER_OVERRIDE_KEYS = [
  "showFarmerTraceability",
  "farmerName",
  "farmerLocation",
  "farmerImage",
  "farmImage",
  "harvestingDate",
  "packingDate",
  "certification",
  "nutritionNote",
  "nutritionFacts",
  "farmerDetails",
];

function applyVendorFarmerOverride(product, overrides) {
  if (!overrides || typeof overrides !== "object") return product;
  const next = { ...product };
  for (const key of VENDOR_FARMER_OVERRIDE_KEYS) {
    if (!(key in overrides) || overrides[key] === undefined) continue;
    next[key] = key === "showFarmerTraceability"
      ? normalizeShowFarmerTraceability(overrides[key], true)
      : overrides[key];
  }
  return next;
}

async function attachVendorFarmerOverride(product, catalog) {
  const vendorId = String(catalog?.manager?.vendorId || "").trim();
  const productId = String(product?._id || product?.id || "").trim();
  if (!vendorId || !productId) return product;
  try {
    const row = await VendorProduct.findOne({ vendorId, productId }).select("overrides").lean();
    if (!row?.overrides) return product;
    return transformProductResponse(applyVendorFarmerOverride(product, row.overrides));
  } catch {
    return product;
  }
}

export async function generateAdminProductId({ categoryName = "", name = "", varietyName = "" } = {}) {
  const catCode = resolveCategoryCode(categoryName || name);
  const cropCode = cropCodeFromName(name);
  const varCode = varietyName?.trim() ? varietyCodeFromName(varietyName) : "NAN";
  const prefix = `GGC-ART-${catCode}-${cropCode}-${varCode}-`;

  const prefixRegex = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`, "i");

  const [products, farmerProducts] = await Promise.all([
    Product.find({
      $or: [{ productId: prefixRegex }, { sku: prefixRegex }],
    })
      .select("productId sku")
      .lean()
      .catch(() => []),
    mongoose.models.FarmerProduct
      ? mongoose.models.FarmerProduct.find({
          $or: [{ productId: prefixRegex }, { sku: prefixRegex }],
        })
          .select("productId sku")
          .lean()
          .catch(() => [])
      : [],
  ]);

  let maxSerial = 0;
  const checkId = (id) => {
    if (!id) return;
    const match = String(id).toUpperCase().match(new RegExp(`^${escapeRegex(prefix)}(\\d+)$`));
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxSerial) {
        maxSerial = num;
      }
    }
  };

  products.forEach((p) => {
    checkId(p.productId);
    checkId(p.sku);
  });
  farmerProducts.forEach((p) => {
    checkId(p.productId);
    checkId(p.sku);
  });

  const nextSerial = maxSerial + 1;
  return `${prefix}${nextSerial}`;
}

const normalizeImages = (productImages, images) => {
  const source = productImages ?? images;
  if (!Array.isArray(source)) return [];
  return source
    .map((img) => (typeof img === "string" ? img.trim() : ""))
    .filter(Boolean);
};

const normalizeVideoUrl = (value) => {
  if (value == null) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
};

const normalizeFeatures = (features) => {
  if (!Array.isArray(features)) return [];
  return features
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const normalizeSpecifications = (specifications) => {
  if (!Array.isArray(specifications)) return [];

  const normalized = [];
  const seen = new Set();

  specifications.forEach((item) => {
    const name = item?.name?.trim();
    const value = item?.value?.trim();
    if (!name || !value) return;

    const key = `${name.toLowerCase()}::${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({ name, value });
  });

  return normalized;
};

const normalizeColors = (colors) => {
  if (!Array.isArray(colors)) return [];

  return colors
    .map((color) => {
      if (typeof color === "string") {
        const name = color.trim();
        return name ? { name, hex: "#cccccc" } : null;
      }

      const name = color?.name?.trim();
      if (!name) return null;

      const hex = color?.hex?.trim() || "#cccccc";
      return { name, hex };
    })
    .filter(Boolean);
};

const normalizeCategories = (categories, categoryName, category) => {
  let list = [];

  if (Array.isArray(categories)) {
    list = categories
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  } else if (Array.isArray(categoryName)) {
    list = categoryName
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  } else if (typeof categoryName === "string" && categoryName.trim()) {
    list = [categoryName.trim()];
  } else if (typeof category === "string" && category.trim()) {
    list = [category.trim()];
  }

  const unique = [];
  const seen = new Set();

  list.forEach((name) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(name);
    }
  });

  return unique;
};

const normalizeSubcategories = (body) => {
  if (Array.isArray(body?.subcategories)) {
    const unique = [];
    const seen = new Set();

    body.subcategories.forEach((item) => {
      const name = typeof item === "string" ? item.trim() : "";
      if (!name) return;
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(name);
      }
    });

    return unique;
  }

  if (typeof body?.subcategory === "string" && body.subcategory.trim()) {
    return [body.subcategory.trim()];
  }

  return [];
};

const normalizeInStock = (value, legacyStock) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (legacyStock !== undefined && legacyStock !== null && legacyStock !== "") {
    return Number(legacyStock) > 0;
  }
  return true;
};

const normalizeBulkGrades = (grades, enableBulkGrades) => {
  const enabled = enableBulkGrades === true || enableBulkGrades === "true";
  if (!enabled) {
    return { enableBulkGrades: false, bulkGrades: [] };
  }

  const byGrade = new Map();
  const source = Array.isArray(grades) ? grades : [];

  for (const entry of source) {
    const grade = String(entry?.grade || "").trim().toUpperCase();
    if (!["A", "B", "C"].includes(grade)) continue;

    const price = Number(entry.price);
    const mrp = Number(entry.mrp);
    const stock = Number(entry.stock);
    const minOrderQuantity = normalizeOptionalQuantity(entry.minOrderQuantity) || 1;
    const isAvailable =
      entry.isAvailable === true ||
      entry.isAvailable === "true" ||
      (entry.isAvailable == null && Number.isFinite(price) && price > 0);

    byGrade.set(grade, {
      grade,
      variety: String(entry.variety || "").trim(),
      price: Number.isFinite(price) && price >= 0 ? price : 0,
      mrp: Number.isFinite(mrp) && mrp >= 0 ? mrp : 0,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      unit: String(entry.unit || "1 Kg").trim() || "1 Kg",
      isAvailable,
      minOrderQuantity,
    });
  }

  const bulkGrades = ["A", "B", "C"].map((grade) => {
    if (byGrade.has(grade)) return byGrade.get(grade);
    return {
      grade,
      variety: "",
      price: 0,
      mrp: 0,
      stock: 0,
      unit: "1 Kg",
      isAvailable: false,
      minOrderQuantity: 1,
    };
  });

  const hasAvailable = bulkGrades.some((g) => g.isAvailable);
  return {
    enableBulkGrades: hasAvailable,
    bulkGrades,
  };
};

const legacyStockFromInStock = (inStock) => (inStock ? 1 : 0);

const findCategoryByName = async (categoryName) =>
  Category.findOne({
    categoryName: {
      $regex: new RegExp(`^${escapeRegex(categoryName.trim())}$`, "i"),
    },
  });

const validateCategoriesAndSubcategories = async (categories, subcategories) => {
  if (!categories.length) {
    return { valid: false, message: "At least one category is required" };
  }

  if (!subcategories.length) {
    return { valid: false, message: "At least one subcategory is required" };
  }

  const mainCategoryName = categories[0];
  const mainCategory = await findCategoryByName(mainCategoryName);

  if (!mainCategory) {
    return {
      valid: false,
      message: `Main category "${mainCategoryName}" not found`,
    };
  }

  const normalizedSubcategories = [];

  for (const subcategoryName of subcategories) {
    const trimmedSub = subcategoryName?.trim();
    if (!trimmedSub) continue;

    const matchedSub = mainCategory.subcategories.find(
      (sub) => sub.toLowerCase() === trimmedSub.toLowerCase()
    );

    if (!matchedSub && mainCategory.subcategories.length > 0) {
      return {
        valid: false,
        message: `Subcategory "${trimmedSub}" must be one of: ${mainCategory.subcategories.join(", ")}`,
      };
    }

    const resolved = matchedSub || trimmedSub;
    if (!normalizedSubcategories.some((sub) => sub.toLowerCase() === resolved.toLowerCase())) {
      normalizedSubcategories.push(resolved);
    }
  }

  if (!normalizedSubcategories.length) {
    return { valid: false, message: "At least one subcategory is required" };
  }

  const normalizedCategories = [];

  for (const categoryName of categories) {
    const categoryDoc = await findCategoryByName(categoryName);

    if (!categoryDoc) {
      return {
        valid: false,
        message: `Category "${categoryName}" not found`,
      };
    }

    normalizedCategories.push(categoryDoc.categoryName);
  }

  return {
    valid: true,
    categories: normalizedCategories,
    subcategories: normalizedSubcategories,
    subcategory: normalizedSubcategories[0],
  };
};

const buildProductPayload = (body) => {
  const variantType = body.variantType === "multi" ? "multi" : "single";
  const pricingType = body.pricingType === "bulk" ? "bulk" : "single";
  const sku = body.sku?.trim().toUpperCase() ?? "";
  const productId = body.productId?.trim().toUpperCase() ?? "";

  const mapBulkPricingInput = (bulkPricing) => ({
    slabs: bulkPricing?.slabs || [],
  });

  const mapQuantityFields = (source = {}) => ({
    minOrderQuantity: normalizeOptionalQuantity(
      source.minOrderQuantity ?? source.bulkPricing?.minOrderQuantity
    ),
    bulkMinOrderQuantity: normalizeOptionalQuantity(
      source.bulkMinOrderQuantity ?? source.bulkPricing?.bulkMinOrderQuantity
    ),
    maxOrderQuantity: normalizeOptionalQuantity(
      source.maxOrderQuantity ?? source.maxOrderQty ?? source.bulkPricing?.maxOrderQuantity
    ),
    stepByQuantity: normalizeOptionalQuantity(
      source.stepByQuantity ?? source.bulkPricing?.stepByQuantity
    ),
  });

  return {
    productId,
    name: body.name?.trim(),
    marathiName: String(body.marathiName || "").trim(),
    sku,
    categories: normalizeCategories(
      body.categories,
      body.categoryName,
      body.category
    ),
    subcategory: body.subcategory?.trim(),
    subcategories: normalizeSubcategories(body),
    brandName: (body.brandName ?? body.brand)?.trim(),
    variantType,
    variants: Array.isArray(body.variants)
      ? body.variants.map((variant) => ({
          name: variant.name?.trim(),
          quantity: variant.quantity != null ? Number(variant.quantity) || 1 : 1,
          unitType: (variant.unitType || "Piece").trim(),
          pricingType: variant.pricingType === "bulk" ? "bulk" : "single",
          bulkPricing:
            variant.pricingType === "bulk"
              ? mapBulkPricingInput(variant.bulkPricing)
              : { slabs: [] },
          ...mapQuantityFields(variant),
          price: variant.price,
          discountedPrice: variant.discountedPrice,
          discountedPercent: variant.discountedPercent,
          stock: variant.stock,
          inStock: normalizeInStock(variant.inStock, variant.stock),
          image: String(variant.image || "").trim(),
          colors: normalizeColors(variant.colors),
        }))
      : [],
    pricingType,
    bulkPricing:
      pricingType === "bulk"
        ? mapBulkPricingInput(body.bulkPricing)
        : { slabs: [] },
    ...mapQuantityFields(body),
    ...normalizeBulkGrades(body.bulkGrades, body.enableBulkGrades),
    price: body.price ?? body.original_price,
    discountedPrice: body.discountedPrice ?? body.discounted_price,
    discountedPercent: body.discountedPercent ?? body.discount_percent,
    ratings: body.ratings,
    stock: body.stock,
    inStock: normalizeInStock(body.inStock, body.stock),
    colors: normalizeColors(body.colors),
    productImages: normalizeImages(body.productImages, body.images),
    videoUrl: normalizeVideoUrl(body.videoUrl),
    description: body.description?.trim() ?? "",
    features: normalizeFeatures(body.features),
    specifications: normalizeSpecifications(body.specifications),
    warranty: body.warranty?.trim() ?? "",
    isActive: body.isActive !== false,
    justArrived: normalizeProductFlag(body.justArrived),
    hotSelling: normalizeProductFlag(body.hotSelling),
    cardGlowColor: (body.cardGlowColor ?? body.glowColor)?.trim() ?? "",
    badge: body.badge?.trim() ?? "",
    unit: body.unit?.trim() || "1 pc",
    unitImage: String(body.unitImage || "").trim(),
    varietyGroupId: body.varietyGroupId != null ? String(body.varietyGroupId).trim() : "",
    varietyName: body.varietyName != null ? String(body.varietyName).trim() : "",
    baseProductId: body.baseProductId != null ? String(body.baseProductId).trim() : "",
    baseProductName: body.baseProductName != null ? String(body.baseProductName).trim() : "",
    baseProductImage: body.baseProductImage != null ? String(body.baseProductImage).trim() : "",
    section: (body.section || body.department || "greengrocc").trim().toLowerCase(),
    storeType: (body.storeType || "").trim() || undefined,
    deptNumber: normalizeDeptToken(body.deptNumber),
    rackRow: normalizeDeptToken(body.rackRow, 6).replace(/^R/, ""),
    rackColumn: normalizeDeptToken(body.rackColumn, 6).replace(/^C/, ""),
    showFarmerTraceability: normalizeShowFarmerTraceability(body.showFarmerTraceability, true),
    farmerName: body.farmerName?.trim() || body.farmerDetails?.name?.trim() || "",
    farmerLocation: body.farmerLocation?.trim() || body.farmerDetails?.location?.trim() || "",
    farmerImage: body.farmerImage?.trim() || body.farmerDetails?.farmerImage?.trim() || "",
    farmImage: body.farmImage?.trim() || body.farmerDetails?.farmImage?.trim() || "",
    harvestingDate: body.harvestingDate?.trim() || body.farmerDetails?.harvestingDate?.trim() || "",
    packingDate: String(body.packingDate || "").trim(),
    certification: String(body.certification || "").trim(),
    nutritionNote: String(body.nutritionNote || "").trim(),
    nutritionFacts: Array.isArray(body.nutritionFacts)
      ? body.nutritionFacts
          .map((item) => ({
            label: String(item?.label || "").trim(),
            value: String(item?.value || "").trim(),
          }))
          .filter((item) => item.label || item.value)
      : [],
    farmerDetails: {
      name: body.farmerDetails?.name?.trim() || body.farmerName?.trim() || "",
      location: body.farmerDetails?.location?.trim() || body.farmerLocation?.trim() || "",
      farmerImage: body.farmerDetails?.farmerImage?.trim() || body.farmerImage?.trim() || "",
      farmImage: body.farmerDetails?.farmImage?.trim() || body.farmImage?.trim() || "",
      totalArea: body.farmerDetails?.totalArea?.trim() || "",
      cultivationArea: body.farmerDetails?.cultivationArea?.trim() || "",
      cropCycle: body.farmerDetails?.cropCycle?.trim() || "",
      agricultureMethod: body.farmerDetails?.agricultureMethod?.trim() || "",
      lastCropTaken: body.farmerDetails?.lastCropTaken?.trim() || "",
      currentCrop: body.farmerDetails?.currentCrop?.trim() || "",
      waterSource: body.farmerDetails?.waterSource?.trim() || "",
      soilType: body.farmerDetails?.soilType?.trim() || "",
      farmTools: body.farmerDetails?.farmTools?.trim() || "",
      harvestingDate: body.farmerDetails?.harvestingDate?.trim() || body.harvestingDate?.trim() || "",
      experience: body.farmerDetails?.experience?.trim() || "",
      bio: body.farmerDetails?.bio?.trim() || "",
      crops: Array.isArray(body.farmerDetails?.crops)
        ? body.farmerDetails.crops
            .map((item) => ({
              name: String(item?.name || item?.cropName || "").trim(),
              variety: String(item?.variety || "").trim(),
              area: String(item?.area || "").trim(),
              status: String(item?.status || "").trim(),
            }))
            .filter((item) => item.name || item.variety || item.area)
        : [],
    },
  };
};

const resolveProductPricing = (payload) => {
  if (payload.variantType === "multi") {
    const namedVariants = payload.variants.filter((variant) => variant.name);

    if (namedVariants.length < 2) {
      return { error: "At least 2 variants are required for multi variant products" };
    }

    const names = new Set();
    for (const variant of namedVariants) {
      const key = variant.name.toLowerCase();
      if (names.has(key)) {
        return { error: `Duplicate variant name "${variant.name}"` };
      }
      names.add(key);
    }

    const productMinOrderQuantity = normalizeOptionalQuantity(payload.minOrderQuantity) || 1;
    const productBulkMinOrderQuantity = normalizeOptionalQuantity(payload.bulkMinOrderQuantity) || 10;
    const productMaxOrderQuantity = normalizeOptionalQuantity(payload.maxOrderQuantity);
    const productStepByQuantity = normalizeOptionalQuantity(payload.stepByQuantity);
    const resolvedVariants = [];

    for (const variant of namedVariants) {
      const inStock = normalizeInStock(variant.inStock, variant.stock);
      const variantStock = Number(variant.stock);
      const resolvedStock = Number.isFinite(variantStock)
        ? Math.max(0, variantStock)
        : legacyStockFromInStock(inStock);

      const pricing = resolvePricingFields({
        pricingType: variant.pricingType,
        bulkPricing: variant.bulkPricing,
        minOrderQuantity:
          variant.pricingType === "bulk" ? productMinOrderQuantity : null,
        maxOrderQuantity:
          variant.pricingType === "bulk" ? productMaxOrderQuantity : null,
        stepByQuantity: null,
        price: variant.price,
        discountedPrice: variant.discountedPrice,
        discountedPercent: variant.discountedPercent,
      });

      if (pricing.error) {
        return { error: `Variant "${variant.name}": ${pricing.error}` };
      }

      resolvedVariants.push({
        name: variant.name,
        quantity: variant.quantity != null ? Number(variant.quantity) || 1 : 1,
        unitType: (variant.unitType || "Piece").trim() || "Piece",
        pricingType: pricing.pricingType,
        bulkPricing: pricing.bulkPricing,
        minOrderQuantity: null,
        maxOrderQuantity: null,
        stepByQuantity: null,
        price: pricing.price,
        discountedPrice: pricing.discountedPrice,
        discountedPercent: pricing.discountedPercent,
        inStock,
        stock: resolvedStock,
        colors: normalizeColors(variant.colors),
        image: String(variant.image || "").trim(),
      });
    }

    const productInStock = resolvedVariants.some((variant) => variant.inStock);
    const productStock = resolvedVariants.reduce(
      (sum, variant) => sum + (Number(variant.stock) || 0),
      0
    );

    const minDiscounted = Math.min(
      ...resolvedVariants.map((variant) => variant.discountedPrice)
    );
    const maxPrice = Math.max(...resolvedVariants.map((variant) => variant.price));
    const hasBulk = resolvedVariants.some((variant) => variant.pricingType === "bulk");

    return {
      variantType: "multi",
      variants: resolvedVariants,
      inStock: productInStock,
      stock: productStock > 0 ? productStock : legacyStockFromInStock(productInStock),
      colors: [],
      pricingType: hasBulk ? "bulk" : "single",
      bulkPricing: { slabs: [] },
      minOrderQuantity: productMinOrderQuantity,
      maxOrderQuantity: productMaxOrderQuantity,
      stepByQuantity: productStepByQuantity,
      price: maxPrice,
      discountedPrice: minDiscounted,
      discountedPercent:
        maxPrice > 0
          ? Math.round(((maxPrice - minDiscounted) / maxPrice) * 100)
          : 0,
    };
  }

  const pricing = resolvePricingFields(payload);
  if (pricing.error) {
    return { error: pricing.error };
  }

  const inStock = normalizeInStock(payload.inStock, payload.stock);
  const stockNum = Number(payload.stock);
  const resolvedStock = Number.isFinite(stockNum)
    ? Math.max(0, stockNum)
    : legacyStockFromInStock(inStock);

  return {
    variantType: "single",
    variants: [],
    inStock,
    stock: resolvedStock,
    colors: normalizeColors(payload.colors),
    pricingType: pricing.pricingType,
    bulkPricing: pricing.bulkPricing,
    minOrderQuantity: pricing.minOrderQuantity,
    maxOrderQuantity: normalizeOptionalQuantity(payload.maxOrderQuantity),
    stepByQuantity: pricing.stepByQuantity,
    price: pricing.price,
    discountedPrice: pricing.discountedPrice,
    discountedPercent: pricing.discountedPercent,
  };
};

const validateRequiredFields = (payload) => {
  const missing = [];

  if (!payload.name) missing.push("name");
  if (!payload.categories.length) missing.push("categories");
  if (payload.categories.length > 4) missing.push("categories (max 4)");
  if (!payload.subcategories?.length && !payload.subcategory) {
    missing.push("subcategories");
  }
  if (!payload.brandName) missing.push("brandName");
  if (!payload.productImages.length) missing.push("productImages");

  if (missing.length > 0) {
    return `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`;
  }

  return null;
};

const sortOptions = { "categories.0": 1, subcategory: 1, createdAt: -1 };

export async function getPurchaseCountsByProductIds(productIds = []) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  const counts = await Order.aggregate([
    {
      $match: {
        status: { $nin: ["attempted", "cancelled", "return"] },
        "items.product": { $in: productIds },
      },
    },
    { $unwind: "$items" },
    { $match: { "items.product": { $in: productIds } } },
    {
      $group: {
        _id: "$items.product",
        purchaseCount: { $sum: "$items.quantity" },
      },
    },
  ]);

  return new Map(
    counts.map((entry) => [String(entry._id), Number(entry.purchaseCount) || 0])
  );
}

const LOCATION_QUERY_KEYS = new Set([
  "lat", "lng", "latitude", "longitude", "city", "area", "pincode", "address", "fullAddress", "fulfillment",
]);
const PRODUCTS_COLLECTION = Product.collection.collectionName.toLowerCase();
const INVENTORY_COLLECTION = StoreInventory.collection.collectionName.toLowerCase();
const STORE_WIDE_COLLECTIONS = new Set([
  PRODUCTS_COLLECTION,
  DeliveryManager.collection.collectionName.toLowerCase(),
  DynamicPricingRule.collection.collectionName.toLowerCase(),
]);

/**
 * Customer product lists, keyed by dark store + filters. A stock change clears
 * only that store's lists; purchase counts may lag by up to the TTL.
 */
const productListCache = createMemoryCache({
  name: "customer-product-lists",
  ttlMs: 60_000,
  maxEntries: 500,
  maxBytes: 8_000_000,
  maxTotalBytes: 150_000_000,
  invalidateOn: ({ coll, doc }) => {
    if (STORE_WIDE_COLLECTIONS.has(coll)) return true;
    if (coll !== INVENTORY_COLLECTION) return false;
    if (!doc?.managerId) return true;
    const prefix = `${String(doc.managerId)}|`;
    return (key) => key.startsWith(prefix);
  },
});

function productListCacheKey(catalog, query) {
  const store = catalog.manager?._id ? String(catalog.manager._id) : `none-${catalog.needsLocation ? 1 : 0}`;
  const filters = Object.keys(query)
    .filter((key) => !LOCATION_QUERY_KEYS.has(key))
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join("&");
  return `${store}|${filters}`;
}

export const getProducts = async (req, res) => {
  try {
    const catalog = await loadNearestStoreCatalog(req.query);
    const filter = { isActive: true };

    if (req.query.justArrived === "true") {
      filter.justArrived = true;
    }

    if (req.query.hotSelling === "true") {
      filter.hotSelling = true;
    }

    if (req.query.section?.trim()) {
      const targetSection = req.query.section.trim().toLowerCase();
      if (targetSection === "all") {
        // "all" shows all products across all departments!
      } else if (targetSection === "preorder" || targetSection === "main" || targetSection === "greengrocc") {
        filter.$and = filter.$and || [];
        filter.$and.push({
          section: { $nin: ["ready2cook", "ready-2-cook", "festive", "instantorder", "instant", "supermall", "mall", "instantorders"] },
          storeType: { $nin: ["festive", "mall"] },
        });
      } else if (targetSection === "ready2cook" || targetSection === "ready-2-cook" || targetSection === "festive") {
        filter.$or = [
          { section: "ready2cook" },
          { section: "ready-2-cook" },
          { section: "festive" },
          { storeType: "festive" },
        ];
      } else if (targetSection === "instantorder" || targetSection === "instant" || targetSection === "supermall" || targetSection === "mall") {
        filter.$or = [
          { section: "instantorder" },
          { section: "instant" },
          { section: "supermall" },
          { storeType: "mall" },
        ];
      } else {
        filter.section = targetSection;
      }
    } else if (req.query.storeType?.trim()) {
      const sType = req.query.storeType.trim().toLowerCase();
      if (sType === "festive" || sType === "ready2cook") {
        filter.$or = [{ section: "ready2cook" }, { storeType: "festive" }];
      } else if (sType === "mall" || sType === "supermall" || sType === "instantorder" || sType === "instant") {
        filter.$or = [{ section: "supermall" }, { section: "instantorder" }, { storeType: "mall" }];
      } else if (sType === "preorder" || sType === "main") {
        filter.$and = filter.$and || [];
        filter.$and.push({
          section: { $nin: ["ready2cook", "ready-2-cook", "festive", "instantorder", "instant", "supermall", "mall", "instantorders"] },
          storeType: { $nin: ["festive", "mall"] },
        });
      }
    }

    if (req.query.ids) {
      const ids = String(req.query.ids)
        .split(",")
        .map((id) => id.trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id));

      if (ids.length) {
        filter._id = { $in: ids };
      }
    }

    if (
      req.query.mostPurchase === "true" ||
      req.query.categoryName?.trim().toLowerCase() ===
        MOST_PURCHASE_TAG.toLowerCase()
    ) {
      filter.categories = MOST_PURCHASE_TAG;
    } else if (req.query.categoryName?.trim()) {
      filter.categories = req.query.categoryName.trim();
    }

    filter.$and = filter.$and || [];

    if (req.query.subcategory?.trim()) {
      const subRegex = new RegExp(
        `^${escapeRegex(req.query.subcategory.trim())}$`,
        "i"
      );
      filter.$and.push({
        $or: [{ subcategory: subRegex }, { subcategories: subRegex }],
      });
    }

    if (req.query.q?.trim()) {
      const term = escapeRegex(req.query.q.trim());
      const regex = new RegExp(term, "i");
      filter.$and.push({
        $or: [
          { name: regex },
          { brandName: regex },
          { subcategory: regex },
          { categories: regex },
          { description: regex },
          { sku: regex },
        ],
      });
    }

    if (req.query.brandName?.trim()) {
      filter.brandName = {
        $regex: new RegExp(
          `^${escapeRegex(req.query.brandName.trim())}$`,
          "i"
        ),
      };
    }

    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      filter.discountedPrice = {};
      if (Number.isFinite(minPrice)) filter.discountedPrice.$gte = minPrice;
      if (Number.isFinite(maxPrice)) filter.discountedPrice.$lte = maxPrice;
    }

    const minDiscount = Number(req.query.minDiscount || req.query.discount);
    if (Number.isFinite(minDiscount) && minDiscount > 0) {
      filter.discountedPercent = { $gte: minDiscount };
    }

    if (req.query.inStock === "true" || req.query.inStockOnly === "true") {
      filter.inStock = true;
    }

    filter.$and.push(storeProductScope(catalog));

    let sort = { createdAt: -1, name: 1 };
    const sortParam = String(req.query.sort || "newest").trim();
    if (sortParam === "price-asc") sort = { discountedPrice: 1, name: 1 };
    else if (sortParam === "price-desc") sort = { discountedPrice: -1, name: 1 };
    else if (sortParam === "newest") sort = { createdAt: -1, name: 1 };
    else if (sortParam === "oldest") sort = { createdAt: 1, name: 1 };
    else if (sortParam === "name") sort = { name: 1 };
    else if (sortParam === "brand") sort = { brandName: 1, name: 1 };

    const usePagination =
      req.query.page !== undefined &&
      req.query.page !== null &&
      String(req.query.page).trim() !== "";

    const decorate = async (products) => {
      const purchaseCounts = await getPurchaseCountsByProductIds(products.map((item) => item._id));
      return attachQuantityDiscounts(
        attachStoreAvailability(
          products.map((item) => ({
            ...transformProductResponse(item),
            purchaseCount: purchaseCounts.get(String(item._id)) || 0,
          })),
          catalog
        )
      );
    };

    const payload = await productListCache.get(productListCacheKey(catalog, req.query), async () => {
      if (usePagination) {
        const { page, limit: requestedLimit, skip } = getPaginationParams(req.query, 50);
        const limit = Math.min(requestedLimit, 50);
        const [total, products] = await Promise.all([
          Product.countDocuments(filter),
          Product.find(filter).sort(sort).skip(skip).limit(limit),
        ]);
        return buildPaginatedResponse(await decorate(products), total, page, limit);
      }

      let query = Product.find(filter).sort(sort);
      if (req.query.limit) {
        const limit = Math.min(parseInt(req.query.limit, 10) || 15, 50);
        query = query.limit(limit);
      }
      return { success: true, data: await decorate(await query) };
    });

    res.status(200).json({ ...payload, store: catalog.store });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search, category, sortBy, sortDir, status } = req.query;

    const buildBaseFilter = () => {
      const filter = {};
      const andClauses = [];

      if (category && category !== "all") {
        filter.categories = category;
      }

      if (req.query.section && req.query.section !== "all") {
        const targetSec = req.query.section.trim().toLowerCase();
        if (targetSec === "preorder" || targetSec === "main" || targetSec === "greengrocc") {
          andClauses.push({
            section: { $nin: ["ready2cook", "ready-2-cook", "festive", "instantorder", "instant", "supermall", "mall", "instantorders"] },
            storeType: { $nin: ["festive", "mall"] },
          });
        } else if (targetSec === "ready2cook" || targetSec === "ready-2-cook" || targetSec === "festive") {
          filter.$or = [
            { section: "ready2cook" },
            { section: "ready-2-cook" },
            { section: "festive" },
            { storeType: "festive" },
          ];
        } else if (targetSec === "instantorder" || targetSec === "instant" || targetSec === "supermall" || targetSec === "mall") {
          filter.$or = [
            { section: "instantorder" },
            { section: "instant" },
            { section: "supermall" },
            { storeType: "mall" },
          ];
        } else {
          filter.section = new RegExp(`^${escapeRegex(targetSec)}$`, "i");
        }
      }

      const query = typeof search === "string" ? search.trim() : "";
      if (query) {
        const pattern = new RegExp(escapeRegex(query), "i");
        andClauses.push({
          $or: [
            { name: pattern },
            { brandName: pattern },
            { subcategory: pattern },
            { subcategories: pattern },
            { categories: pattern },
            { sku: pattern },
          ],
        });
      }

      if (andClauses.length) {
        const rootClauses = Object.entries(filter).map(([key, value]) => ({ [key]: value }));
        Object.keys(filter).forEach((key) => delete filter[key]);
        filter.$and = [...rootClauses, ...andClauses];
      }

      return filter;
    };

    const mergeProductFilters = (baseFilter, extraFilter) => {
      if (!Object.keys(baseFilter).length) return { ...extraFilter };
      if (!Object.keys(extraFilter).length) return { ...baseFilter };
      return { $and: [baseFilter, extraFilter] };
    };

    const getStatusExtraFilter = (statusFilter) => {
      if (statusFilter === "inactive") {
        return { isActive: false };
      }
      if (statusFilter === "out_of_stock") {
        return { $or: [{ inStock: false }, { stock: { $lte: 0 } }] };
      }
      if (statusFilter === "low_stock") {
        return { isActive: true, inStock: true, stock: { $gt: 0, $lte: 5 } };
      }
      if (statusFilter === "active") {
        return { isActive: true, inStock: true, stock: { $gt: 0 } };
      }
      return {};
    };

    const baseFilter = buildBaseFilter();
    const statusFilter = typeof status === "string" ? status.trim().toLowerCase() : "";
    const filter = mergeProductFilters(baseFilter, getStatusExtraFilter(statusFilter));

    const sortMap = {
      name: "name",
      price: "discountedPrice",
      stock: "inStock",
      brand: "brandName",
      sku: "sku",
      createdAt: "createdAt",
      status: "isActive",
    };
    const sortField = sortMap[sortBy] || "createdAt";
    const sortOrder = sortDir === "asc" ? 1 : -1;

    const [total, products, allCount, activeCount, inactiveCount, outOfStockCount, lowStockCount] =
      await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter).sort({ [sortField]: sortOrder, _id: sortOrder }).skip(skip).limit(limit),
        Product.countDocuments(baseFilter),
        Product.countDocuments(mergeProductFilters(baseFilter, getStatusExtraFilter("active"))),
        Product.countDocuments(mergeProductFilters(baseFilter, getStatusExtraFilter("inactive"))),
        Product.countDocuments(
          mergeProductFilters(baseFilter, getStatusExtraFilter("out_of_stock"))
        ),
        Product.countDocuments(mergeProductFilters(baseFilter, getStatusExtraFilter("low_stock"))),
      ]);

    const response = buildPaginatedResponse(products, total, page, limit);
    response.statusCounts = {
      all: allCount,
      active: activeCount,
      inactive: inactiveCount,
      out_of_stock: outOfStockCount,
      low_stock: lowStockCount,
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const catalog = await loadNearestStoreCatalog(req.query);
    const purchaseCounts = await getPurchaseCountsByProductIds([product._id]);
    const [decorated] = await attachQuantityDiscounts(
      attachStoreAvailability(
        [
          {
            ...transformProductResponse(product),
            purchaseCount: purchaseCounts.get(String(product._id)) || 0,
          },
        ],
        catalog
      )
    );

    const payload = decorated || {
      ...transformProductResponse(product),
      purchaseCount: purchaseCounts.get(String(product._id)) || 0,
      inStock: false,
      stock: 0,
      storeStock: 0,
      storeName: catalog.store?.storeName,
    };

    res.status(200).json({
      success: true,
      data: await attachVendorFarmerOverride(payload, catalog),
      store: catalog.store,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductVarieties = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const normalizeVarietyBase = (name) =>
      String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s*[-–]?\s*var(?:iety|ity|ieties)?[-.\s]*\d*$/i, "")
        .replace(/\s+/g, " ")
        .trim();

    const groupId = String(product.varietyGroupId || "").trim();
    const byId = new Map();

    const looksLikeVarietyProduct = (p) =>
      Boolean(String(p?.varietyName || "").trim()) ||
      Boolean(String(p?.varietyGroupId || "").trim()) ||
      /\bvar(?:iety|ity|ieties)\b/i.test(String(p?.name || ""));

    // Explicit links from admin "Add variety"
    if (groupId) {
      const linkedQuery = {
        isActive: { $ne: false },
        $or: [{ varietyGroupId: groupId }, { varietyGroupId: String(product._id) }],
      };
      if (mongoose.Types.ObjectId.isValid(groupId)) {
        linkedQuery.$or.push({ _id: groupId });
      }
      const linked = await Product.find(linkedQuery).sort({ createdAt: 1 }).lean();
      linked.forEach((p) => byId.set(String(p._id), p));
    }

    // Name-based fallback only for clear variety clones (e.g. "palak varity-1")
    const baseName = normalizeVarietyBase(product.name);
    const primaryCat = Array.isArray(product.categories) ? product.categories[0] : "";
    if (baseName.length >= 2) {
      const candidates = await Product.find({
        isActive: { $ne: false },
        ...(primaryCat ? { categories: primaryCat } : {}),
        name: { $regex: `^${escapeRegex(baseName)}`, $options: "i" },
      })
        .sort({ createdAt: 1 })
        .lean();

      const sameBase = candidates.filter((p) => normalizeVarietyBase(p.name) === baseName);
      const groupHasVarietySignal =
        byId.size > 0 ||
        sameBase.some((p) => looksLikeVarietyProduct(p));

      // Only surface Select Variety when there are 2+ siblings AND a variety signal exists
      if (sameBase.length > 1 && groupHasVarietySignal) {
        sameBase.forEach((p) => byId.set(String(p._id), p));
      }
    }

    byId.set(String(product._id), product);

    const list = [...byId.values()];
    if (list.length < 2) {
      return res.status(200).json({
        success: true,
        data: [],
        varietyGroupId: "",
      });
    }

    const catalog = await loadNearestStoreCatalog(req.query);
    const decorated = attachStoreAvailability(list, catalog);

    res.status(200).json({
      success: true,
      data: decorated,
      varietyGroupId: groupId || String(product._id),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSimilarProductLimit = (rawLimit) =>
  Math.min(Math.max(parseInt(rawLimit, 10) || 12, 1), 24);

const getRelevantCategories = (product) =>
  (product.categories || [])
    .map((category) => String(category || "").trim())
    .filter(
      (category) =>
        category && category.toLowerCase() !== MOST_PURCHASE_TAG.toLowerCase()
    );

const getRelevantSubcategories = (product) => [
  ...new Set(
    [product.subcategory, ...(product.subcategories || [])]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ),
];

const buildSubcategoryMatch = (subcategories) => {
  if (!subcategories.length) return null;

  const matches = [];
  subcategories.forEach((subcategory) => {
    const regex = new RegExp(`^${escapeRegex(subcategory)}$`, "i");
    matches.push({ subcategory: regex }, { subcategories: regex });
  });

  return { $or: matches };
};

const fetchSimilarProductBatch = async ({ filter, limit, excludeIds }) => {
  if (limit <= 0) return [];

  return Product.find({
    ...filter,
    _id: { $nin: excludeIds },
  })
    .sort({ ratings: -1, hotSelling: -1, createdAt: -1 })
    .limit(limit);
};

export const getSimilarProducts = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const limit = getSimilarProductLimit(req.query.limit);
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const catalog = await loadNearestStoreCatalog(req.query);
    const baseFilter = { isActive: true, $and: [storeProductScope(catalog)] };
    const excludeIds = [product._id];
    const similar = [];
    const subcategories = getRelevantSubcategories(product);
    const categories = getRelevantCategories(product);
    const subcategoryMatch = buildSubcategoryMatch(subcategories);

    if (subcategoryMatch) {
      const matches = await fetchSimilarProductBatch({
        filter: { ...baseFilter, ...subcategoryMatch },
        limit: limit - similar.length,
        excludeIds,
      });
      similar.push(...matches);
      excludeIds.push(...matches.map((item) => item._id));
    }

    if (similar.length < limit && categories.length) {
      const matches = await fetchSimilarProductBatch({
        filter: { ...baseFilter, categories: { $in: categories } },
        limit: limit - similar.length,
        excludeIds,
      });
      similar.push(...matches);
      excludeIds.push(...matches.map((item) => item._id));
    }

    if (similar.length < limit && product.brandName?.trim()) {
      const brandRegex = new RegExp(
        `^${escapeRegex(product.brandName.trim())}$`,
        "i"
      );
      const matches = await fetchSimilarProductBatch({
        filter: { ...baseFilter, brandName: brandRegex },
        limit: limit - similar.length,
        excludeIds,
      });
      similar.push(...matches);
      excludeIds.push(...matches.map((item) => item._id));
    }

    if (similar.length < limit) {
      const matches = await fetchSimilarProductBatch({
        filter: baseFilter,
        limit: limit - similar.length,
        excludeIds,
      });
      similar.push(...matches);
    }

    res.status(200).json({
      success: true,
      data: attachStoreAvailability(similar, catalog),
      store: catalog.store,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resolveStoreType = (section, storeType) => {
  if (storeType && String(storeType).trim()) return String(storeType).trim().toLowerCase();
  const sec = String(section || "").toLowerCase();
  if (sec === "ready2cook" || sec === "ready-2-cook" || sec === "festive") return "festive";
  if (sec === "supermall" || sec === "instantorder" || sec === "instant" || sec === "mall") {
    return "mall";
  }
  return "main";
};

const buildPersistedProductFields = (payload, pricingFields, categoryCheck) => ({
  productId: payload.productId || payload.sku || "",
  name: payload.name,
  sku: payload.sku || payload.productId || "",
  categories: categoryCheck.categories,
  subcategory: categoryCheck.subcategory,
  subcategories: categoryCheck.subcategories,
  brandName: payload.brandName,
  variantType: pricingFields.variantType,
  variants: pricingFields.variants,
  pricingType: pricingFields.pricingType,
  bulkPricing: pricingFields.bulkPricing,
  minOrderQuantity: pricingFields.minOrderQuantity ?? normalizeOptionalQuantity(payload.minOrderQuantity) ?? 1,
  bulkMinOrderQuantity: pricingFields.bulkMinOrderQuantity ?? normalizeOptionalQuantity(payload.bulkMinOrderQuantity) ?? 10,
  maxOrderQuantity: pricingFields.maxOrderQuantity,
  stepByQuantity: pricingFields.stepByQuantity,
  price: pricingFields.price,
  discountedPrice: pricingFields.discountedPrice,
  discountedPercent: pricingFields.discountedPercent,
  ratings: payload.ratings ?? 0,
  inStock: pricingFields.inStock ?? payload.inStock ?? true,
  stock: pricingFields.stock ?? legacyStockFromInStock(payload.inStock),
  colors: pricingFields.colors ?? [],
  productImages: payload.productImages,
  videoUrl: payload.videoUrl,
  description: payload.description,
  features: payload.features,
  specifications: payload.specifications,
  warranty: payload.warranty,
  isActive: payload.isActive ?? true,
  justArrived: payload.justArrived,
  hotSelling: payload.hotSelling,
  cardGlowColor: payload.cardGlowColor,
  badge: payload.badge,
  enableBulkGrades: payload.enableBulkGrades,
  bulkGrades: payload.bulkGrades,
  unit: payload.unit || "1 pc",
  unitImage: payload.unitImage || "",
  marathiName: payload.marathiName || "",
  varietyGroupId: payload.varietyGroupId || "",
  varietyName: payload.varietyName || "",
  baseProductId: payload.baseProductId || "",
  baseProductName: payload.baseProductName || "",
  baseProductImage: payload.baseProductImage || "",
  section: payload.section || "greengrocc",
  storeType: resolveStoreType(payload.section, payload.storeType),
  deptNumber: payload.deptNumber || "",
  rackRow: payload.rackRow || "",
  rackColumn: payload.rackColumn || "",
  departmentId: buildDepartmentId({
    section: payload.section,
    storeType: resolveStoreType(payload.section, payload.storeType),
    deptNumber: payload.deptNumber,
    rackRow: payload.rackRow,
    rackColumn: payload.rackColumn,
  }),
  showFarmerTraceability: payload.showFarmerTraceability !== false,
  farmerName: payload.farmerName || "",
  farmerLocation: payload.farmerLocation || "",
  farmerImage: payload.farmerImage || "",
  farmImage: payload.farmImage || "",
  harvestingDate: payload.harvestingDate || "",
  packingDate: payload.packingDate || "",
  certification: payload.certification || "",
  nutritionNote: payload.nutritionNote || "",
  nutritionFacts: payload.nutritionFacts || [],
  farmerDetails: payload.farmerDetails || {},
});

const productErrorResult = (error) => {
  if (error.code === 11000 && error.keyPattern?.sku) {
    return {
      status: 400,
      body: { success: false, message: "A product with this SKU already exists" },
    };
  }
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((err) => err.message)
      .join(", ");
    return { status: 400, body: { success: false, message } };
  }
  return { status: 500, body: { success: false, message: error.message } };
};

const badRequest = (message) => ({ status: 400, body: { success: false, message } });

/**
 * Validate + create a product. Returns { status, body, product? }.
 * `ownerManagerId` scopes the product to one dark store (Delivery Manager products).
 */
async function syncBaseProductSiblings(product) {
  const id = String(product?.baseProductId || "").trim();
  const name = String(product?.baseProductName || "").trim();
  if (!id || !name) return;
  await Product.updateMany(
    { baseProductId: id, _id: { $ne: product._id } },
    {
      $set: {
        baseProductName: name,
        baseProductImage: String(product.baseProductImage || "").trim(),
      },
    }
  );
}

export async function createProductRecord(body, { ownerManagerId = null } = {}) {
  try {
    const payload = buildProductPayload(body);

    if (!ownerManagerId) {
      const isCanonicalPattern = (id) =>
        /^GGC-ART-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-\d+$/i.test(String(id || "").trim());

      let finalId = "";
      if (isCanonicalPattern(payload.productId)) {
        finalId = payload.productId;
      } else if (isCanonicalPattern(payload.sku)) {
        finalId = payload.sku;
      }

      if (finalId) {
        const existing = await Product.findOne({
          $or: [{ sku: finalId }, { productId: finalId }],
        }).select("_id");
        if (existing) {
          finalId = "";
        }
      }

      if (!finalId) {
        const primaryCat =
          payload.categories?.[0] || body.categoryName || body.category || payload.name;
        finalId = await generateAdminProductId({
          categoryName: primaryCat,
          name: payload.name,
          varietyName: payload.varietyName,
        });
      }

      payload.productId = finalId;
      payload.sku = finalId;
    }

    const requiredError = validateRequiredFields(payload);
    if (requiredError) return badRequest(requiredError);

    const categoryCheck = await validateCategoriesAndSubcategories(
      payload.categories,
      payload.subcategories?.length ? payload.subcategories : [payload.subcategory].filter(Boolean)
    );
    if (!categoryCheck.valid) return badRequest(categoryCheck.message);

    const pricingFields = resolveProductPricing(payload);
    if (pricingFields.error) return badRequest(pricingFields.error);

    const product = await Product.create({
      ...buildPersistedProductFields(payload, pricingFields, categoryCheck),
      ownerManagerId: ownerManagerId || null,
    });

    await syncBaseProductSiblings(product).catch((error) =>
      console.warn("[Product] base product sync failed:", error.message)
    );

    // When creating a variety sibling, ensure the source product shares the same group id
    const groupId = String(payload.varietyGroupId || "").trim();
    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
      await Product.updateOne(
        {
          _id: groupId,
          $or: [{ varietyGroupId: "" }, { varietyGroupId: null }, { varietyGroupId: { $exists: false } }],
        },
        { $set: { varietyGroupId: groupId } }
      );
    }

    await addProductToAllStores(product).catch((error) =>
      console.warn("[Product] dark store inventory sync failed:", error.message)
    );

    return { status: 201, body: { success: true, data: product }, product };
  } catch (error) {
    return productErrorResult(error);
  }
}

export const addProduct = async (req, res) => {
  const result = await createProductRecord(req.body);
  res.status(result.status).json(result.body);
};

export const updateProduct = async (req, res) => {
  const result = await updateProductRecord(req.params.id, req.body);
  res.status(result.status).json(result.body);
};

/**
 * Validate + update a product. When `ownerManagerId` is given, only that manager's
 * own products can be edited.
 */
export async function updateProductRecord(id, body = {}, { ownerManagerId = null } = {}) {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { status: 404, body: { success: false, message: "Product not found" } };
    }
    const existing = await Product.findById(id);

    if (
      !existing ||
      (ownerManagerId && String(existing.ownerManagerId || "") !== String(ownerManagerId))
    ) {
      return { status: 404, body: { success: false, message: "Product not found" } };
    }

    const payload = buildProductPayload({
      name: body.name ?? existing.name,
      marathiName:
        body.marathiName !== undefined ? body.marathiName : existing.marathiName,
      categories: body.categories ?? existing.categories,
      categoryName: body.categoryName,
      category: body.category,
      subcategory: body.subcategory ?? existing.subcategory,
      subcategories: body.subcategories ?? existing.subcategories,
      brandName: body.brandName ?? body.brand ?? existing.brandName,
      variantType: body.variantType ?? existing.variantType,
      variants: body.variants ?? existing.variants,
      pricingType: body.pricingType ?? existing.pricingType,
      bulkPricing: body.bulkPricing ?? existing.bulkPricing,
      price: body.price ?? body.original_price ?? existing.price,
      discountedPrice:
        body.discountedPrice ??
        body.discounted_price ??
        existing.discountedPrice,
      discountedPercent:
        body.discountedPercent ??
        body.discount_percent ??
        existing.discountedPercent,
      ratings: body.ratings ?? existing.ratings,
      stock: body.stock ?? existing.stock,
      inStock: body.inStock ?? existing.inStock,
      colors: body.colors ?? existing.colors,
      productImages:
        body.productImages ?? body.images ?? existing.productImages,
      videoUrl:
        body.videoUrl !== undefined
          ? normalizeVideoUrl(body.videoUrl)
          : existing.videoUrl,
      description: body.description ?? existing.description,
      features: body.features ?? existing.features,
      specifications: body.specifications ?? existing.specifications,
      warranty: body.warranty ?? existing.warranty,
      isActive: body.isActive ?? existing.isActive,
      justArrived:
        body.justArrived !== undefined
          ? body.justArrived
          : existing.justArrived,
      hotSelling:
        body.hotSelling !== undefined
          ? body.hotSelling
          : existing.hotSelling,
      productId: body.productId ?? existing.productId ?? existing.sku,
      sku: body.sku ?? existing.sku,
      minOrderQuantity:
        body.minOrderQuantity !== undefined
          ? body.minOrderQuantity
          : existing.minOrderQuantity,
      bulkMinOrderQuantity:
        body.bulkMinOrderQuantity !== undefined
          ? body.bulkMinOrderQuantity
          : existing.bulkMinOrderQuantity,
      maxOrderQuantity:
        body.maxOrderQuantity !== undefined
          ? body.maxOrderQuantity
          : existing.maxOrderQuantity,
      stepByQuantity:
        body.stepByQuantity !== undefined
          ? body.stepByQuantity
          : existing.stepByQuantity,
      cardGlowColor:
        body.cardGlowColor !== undefined
          ? body.cardGlowColor
          : existing.cardGlowColor,
      badge:
        body.badge !== undefined
          ? body.badge
          : existing.badge,
      enableBulkGrades:
        body.enableBulkGrades !== undefined
          ? body.enableBulkGrades
          : existing.enableBulkGrades,
      bulkGrades:
        body.bulkGrades !== undefined
          ? body.bulkGrades
          : existing.bulkGrades,
      unit: body.unit !== undefined ? body.unit : existing.unit,
      unitImage: body.unitImage !== undefined ? body.unitImage : existing.unitImage,
      varietyGroupId:
        body.varietyGroupId !== undefined
          ? body.varietyGroupId
          : existing.varietyGroupId,
      varietyName:
        body.varietyName !== undefined
          ? body.varietyName
          : existing.varietyName,
      baseProductId:
        body.baseProductId !== undefined
          ? body.baseProductId
          : existing.baseProductId,
      baseProductName:
        body.baseProductName !== undefined
          ? body.baseProductName
          : existing.baseProductName,
      baseProductImage:
        body.baseProductImage !== undefined
          ? body.baseProductImage
          : existing.baseProductImage,
      section:
        body.section !== undefined
          ? body.section
          : body.department !== undefined
            ? body.department
            : existing.section,
      storeType:
        body.storeType !== undefined ? body.storeType : existing.storeType,
      showFarmerTraceability:
        body.showFarmerTraceability !== undefined
          ? normalizeShowFarmerTraceability(body.showFarmerTraceability, existing.showFarmerTraceability !== false)
          : existing.showFarmerTraceability !== false,
      farmerName:
        body.farmerName !== undefined ? body.farmerName : existing.farmerName,
      farmerLocation:
        body.farmerLocation !== undefined
          ? body.farmerLocation
          : existing.farmerLocation,
      farmerImage:
        body.farmerImage !== undefined ? body.farmerImage : existing.farmerImage,
      farmImage:
        body.farmImage !== undefined ? body.farmImage : existing.farmImage,
      harvestingDate:
        body.harvestingDate !== undefined
          ? body.harvestingDate
          : existing.harvestingDate,
      packingDate:
        body.packingDate !== undefined ? body.packingDate : existing.packingDate,
      certification:
        body.certification !== undefined ? body.certification : existing.certification,
      nutritionNote:
        body.nutritionNote !== undefined ? body.nutritionNote : existing.nutritionNote,
      nutritionFacts:
        body.nutritionFacts !== undefined ? body.nutritionFacts : existing.nutritionFacts,
      farmerDetails:
        body.farmerDetails !== undefined
          ? body.farmerDetails
          : existing.farmerDetails,
      deptNumber: body.deptNumber !== undefined ? body.deptNumber : existing.deptNumber,
      rackRow: body.rackRow !== undefined ? body.rackRow : existing.rackRow,
      rackColumn: body.rackColumn !== undefined ? body.rackColumn : existing.rackColumn,
    });

    const requiredError = validateRequiredFields(payload);
    if (requiredError) return badRequest(requiredError);

    const categoryCheck = await validateCategoriesAndSubcategories(
      payload.categories,
      payload.subcategories?.length ? payload.subcategories : [payload.subcategory].filter(Boolean)
    );
    if (!categoryCheck.valid) return badRequest(categoryCheck.message);

    const pricingFields = resolveProductPricing(payload);
    if (pricingFields.error) return badRequest(pricingFields.error);

    const product = await Product.findByIdAndUpdate(
      id,
      buildPersistedProductFields(payload, pricingFields, categoryCheck),
      { new: true, runValidators: true }
    );

    if (product) {
      await syncBaseProductSiblings(product).catch((error) =>
        console.warn("[Product] base product sync failed:", error.message)
      );
      await syncProductToStores(product, existing).catch((error) =>
        console.warn("[Product] dark store inventory sync failed:", error.message)
      );
    }

    return { status: 200, body: { success: true, data: product }, product };
  } catch (error) {
    return productErrorResult(error);
  }
}

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getNextProductId = async (req, res) => {
  try {
    const { name, category, categoryName, variety, varietyName } = req.query;
    const productId = await generateAdminProductId({
      categoryName: category || categoryName || "",
      name: name || "",
      varietyName: variety || varietyName || "",
    });
    res.status(200).json({ success: true, productId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

