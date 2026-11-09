import mongoose from "mongoose";
import Product from "../../legacy/models/Product.js";
import {
  GiftCard,
  DynamicPricingRule,
  BulkSellingDeal,
} from "./models.js";
import { generateGiftCode, previewGiftCard } from "./giftCardService.js";
import { invalidatePricingCache, evaluateDynamicPricingForCart } from "./pricingAttach.js";
import { parseCsv, toCsv } from "./csv.js";
import { refreshProductInStores } from "../../delivery-service/src/services/catalogStoreInventory.js";

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

function searchRegex(q) {
  const value = String(q || "").trim();
  if (!value) return null;
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

export async function listGiftCards(req, res, next) {
  try {
    const q = searchRegex(req.query.search);
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (q) filter.$or = [{ code: q }, { issuedToName: q }, { issuedToPhone: q }];
    const cards = await GiftCard.find(filter).sort({ createdAt: -1 }).lean();
    const [issued, activeBalance, redeemed] = await Promise.all([
      GiftCard.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
      GiftCard.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: null, total: { $sum: "$balance" } } },
      ]),
      GiftCard.countDocuments({ status: "redeemed" }),
    ]);
    return ok(res, cards, {
      stats: {
        count: cards.length,
        totalIssued: issued[0]?.total || 0,
        activeBalance: activeBalance[0]?.total || 0,
        redeemed,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createGiftCard(req, res, next) {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 1) {
      return fail(res, 400, "Amount must be at least ₹1");
    }
    let code = String(req.body.code || "").trim().toUpperCase() || generateGiftCode();
    while (await GiftCard.findOne({ code })) {
      code = generateGiftCode();
    }
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    const card = await GiftCard.create({
      code,
      amount,
      balance: amount,
      status: "active",
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      issuedToName: String(req.body.issuedToName || "").trim(),
      issuedToPhone: String(req.body.issuedToPhone || "").trim(),
      note: String(req.body.note || "").trim(),
    });
    return res.status(201).json({ success: true, data: card });
  } catch (error) {
    next(error);
  }
}

export async function updateGiftCard(req, res, next) {
  try {
    const card = await GiftCard.findById(req.params.id);
    if (!card) return fail(res, 404, "Gift card not found");
    const allowed = ["status", "expiresAt", "issuedToName", "issuedToPhone", "note"];
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) card[key] = req.body[key] || (key === "expiresAt" ? null : "");
    });
    if (req.body.expiresAt) card.expiresAt = new Date(req.body.expiresAt);
    await card.save();
    return ok(res, card);
  } catch (error) {
    next(error);
  }
}

export async function deleteGiftCard(req, res, next) {
  try {
    const card = await GiftCard.findByIdAndDelete(req.params.id);
    if (!card) return fail(res, 404, "Gift card not found");
    return ok(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
}

export async function validateGiftCardPublic(req, res, next) {
  try {
    const result = await previewGiftCard(req.body.code, req.body.payableAmount ?? req.body.subtotal);
    if (result.error) return fail(res, 400, result.error);
    return ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function listPricingRules(req, res, next) {
  try {
    const rules = await DynamicPricingRule.find().sort({ createdAt: -1 }).lean();
    return ok(res, rules, { stats: { count: rules.length, enabled: rules.filter((r) => r.enabled).length } });
  } catch (error) {
    next(error);
  }
}

export async function listActivePricingPublic(_req, res, next) {
  try {
    const { getActivePricingRules } = await import("./pricingAttach.js");
    const rules = await getActivePricingRules();
    return ok(res, rules);
  } catch (error) {
    next(error);
  }
}

function parsePricingBody(body) {
  if (!String(body.name || "").trim()) return { error: "Rule name is required" };

  const ruleType = body.ruleType || "quantity_discount";
  const validRuleTypes = [
    "quantity_discount",
    "bundle_pricing",
    "tiered_quantity",
    "free_addon",
    "loyalty_discount",
    "heavy_handling_fee",
  ];
  if (!validRuleTypes.includes(ruleType)) {
    return { error: `Invalid rule type. Must be one of: ${validRuleTypes.join(", ")}` };
  }

  const payload = {
    name: String(body.name).trim(),
    description: String(body.description || "").trim(),
    ruleType,
    enabled: body.enabled !== false,
    applyTo: ["all", "products", "categories", "custom", "weight_threshold", "all_heavy"].includes(body.applyTo)
      ? body.applyTo
      : "all",
    productIds: Array.isArray(body.productIds)
      ? body.productIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [],
    categoryNames: Array.isArray(body.categoryNames)
      ? body.categoryNames.map((name) => String(name).trim()).filter(Boolean)
      : String(body.categoryNames || "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
    startDate: body.startDate ? new Date(body.startDate) : null,
    endDate: body.endDate ? new Date(body.endDate) : null,
  };

  if (ruleType === "quantity_discount") {
    const minQuantity = Number(body.minQuantity);
    const discountValue = Number(body.discountValue);
    if (!Number.isFinite(minQuantity) || minQuantity < 1) {
      return { error: "Min quantity must be at least 1" };
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return { error: "Discount value must be at least 0" };
    }
    if (body.discountType === "percentage" && discountValue > 100) {
      return { error: "Percentage discount cannot exceed 100%" };
    }
    payload.minQuantity = minQuantity;
    payload.discountType = body.discountType === "fixed" ? "fixed" : "percentage";
    payload.discountValue = discountValue;
  } else if (ruleType === "bundle_pricing") {
    const bundleQuantity = Number(body.bundleQuantity);
    const bundlePrice = Number(body.bundlePrice);
    if (!Number.isFinite(bundleQuantity) || bundleQuantity < 1) {
      return { error: "Bundle quantity must be at least 1" };
    }
    if (!Number.isFinite(bundlePrice) || bundlePrice < 0) {
      return { error: "Bundle price must be at least 0" };
    }
    payload.bundleQuantity = bundleQuantity;
    payload.bundlePrice = bundlePrice;
    payload.exceptionProductIds = Array.isArray(body.exceptionProductIds)
      ? body.exceptionProductIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];
    payload.exceptionCategoryNames = Array.isArray(body.exceptionCategoryNames)
      ? body.exceptionCategoryNames.map((name) => String(name).trim()).filter(Boolean)
      : String(body.exceptionCategoryNames || "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean);
  } else if (ruleType === "tiered_quantity") {
    const tiers = Array.isArray(body.tiers) ? body.tiers : [];
    if (!tiers.length) {
      return { error: "At least one pricing tier slab is required" };
    }
    const cleanTiers = [];
    for (const t of tiers) {
      const minQty = Number(t.minQuantity);
      const val = Number(t.discountValue);
      if (!Number.isFinite(minQty) || minQty < 1) {
        return { error: "Each tier requires a valid min quantity >= 1" };
      }
      if (!Number.isFinite(val) || val < 0) {
        return { error: "Each tier requires a valid discount value >= 0" };
      }
      cleanTiers.push({
        minQuantity: minQty,
        maxQuantity:
          Number.isFinite(Number(t.maxQuantity)) && Number(t.maxQuantity) >= minQty
            ? Number(t.maxQuantity)
            : null,
        discountType: t.discountType === "fixed" ? "fixed" : "percentage",
        discountValue: val,
      });
    }
    cleanTiers.sort((a, b) => a.minQuantity - b.minQuantity);
    payload.tiers = cleanTiers;
  } else if (ruleType === "free_addon") {
    const triggerType = [
      "min_spend",
      "specific_products",
      "specific_categories",
      "any_order",
    ].includes(body.triggerType)
      ? body.triggerType
      : "min_spend";
    payload.triggerType = triggerType;
    payload.minSpend = Number(body.minSpend) || 0;
    payload.triggerProductIds = Array.isArray(body.triggerProductIds)
      ? body.triggerProductIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];
    payload.triggerCategoryNames = Array.isArray(body.triggerCategoryNames)
      ? body.triggerCategoryNames.map((name) => String(name).trim()).filter(Boolean)
      : String(body.triggerCategoryNames || "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean);
    payload.addonProductId = mongoose.Types.ObjectId.isValid(body.addonProductId)
      ? body.addonProductId
      : null;
    payload.addonProductName = String(body.addonProductName || "").trim();
    payload.addonQuantity = Number(body.addonQuantity) >= 1 ? Number(body.addonQuantity) : 1;
    payload.addonDiscountType = ["free", "percentage", "fixed_price"].includes(body.addonDiscountType)
      ? body.addonDiscountType
      : "free";
    payload.addonDiscountValue = Number.isFinite(Number(body.addonDiscountValue))
      ? Number(body.addonDiscountValue)
      : 100;
  } else if (ruleType === "loyalty_discount") {
    const minOrders = Number(body.minCompletedOrders);
    const discountVal = Number(body.discountValue);
    if (!Number.isFinite(minOrders) || minOrders < 1) {
      return { error: "Min completed orders must be at least 1" };
    }
    if (!Number.isFinite(discountVal) || discountVal <= 0) {
      return { error: "Discount value must be greater than 0" };
    }
    payload.minCompletedOrders = minOrders;
    payload.discountType = body.discountType === "fixed" ? "fixed" : "percentage";
    payload.discountValue = discountVal;
    payload.maxDiscountAmount = Number(body.maxDiscountAmount) || 0;
    payload.minOrderValue = Number(body.minOrderValue) || 0;
  } else if (ruleType === "heavy_handling_fee") {
    const feeAmount = Number(body.feeAmount);
    if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
      return { error: "Heavy handling fee amount must be greater than 0" };
    }
    payload.feeAmount = feeAmount;
    payload.feeType = ["per_item", "per_order", "per_kg_over_threshold"].includes(body.feeType)
      ? body.feeType
      : "per_order";
    payload.heavyWeightThresholdKg =
      Number(body.heavyWeightThresholdKg) >= 0 ? Number(body.heavyWeightThresholdKg) : 5;
  }

  return payload;
}

export async function createPricingRule(req, res, next) {
  try {
    const payload = parsePricingBody(req.body);
    if (payload.error) return fail(res, 400, payload.error);
    const rule = await DynamicPricingRule.create(payload);
    invalidatePricingCache();
    return res.status(201).json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
}

export async function updatePricingRule(req, res, next) {
  try {
    const rule = await DynamicPricingRule.findById(req.params.id);
    if (!rule) return fail(res, 404, "Pricing rule not found");
    const payload = parsePricingBody({ ...rule.toObject(), ...req.body });
    if (payload.error) return fail(res, 400, payload.error);
    Object.assign(rule, payload);
    await rule.save();
    invalidatePricingCache();
    return ok(res, rule);
  } catch (error) {
    next(error);
  }
}

export async function deletePricingRule(req, res, next) {
  try {
    const rule = await DynamicPricingRule.findByIdAndDelete(req.params.id);
    if (!rule) return fail(res, 404, "Pricing rule not found");
    invalidatePricingCache();
    return ok(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
}

export async function previewPricingCalculation(req, res, next) {
  try {
    const { items = [], userId = null, subtotal = 0 } = req.body;
    const result = await evaluateDynamicPricingForCart({ items, userId, subtotal });
    return ok(res, result);
  } catch (error) {
    next(error);
  }
}

async function applyDealToProduct(deal) {
  const product = await Product.findById(deal.productId);
  if (!product) return { error: "Product not found" };
  const base = Number(product.discountedPrice || product.price || 0);
  const unit =
    Number(deal.pricePerUnit) > 0
      ? Number(deal.pricePerUnit)
      : Math.round(base * (1 - Number(deal.discountPercent || 0) / 100) * 100) / 100;
  product.pricingType = "bulk";
  product.bulkPricing = {
    slabs: [
      {
        minQuantity: deal.minQuantity,
        maxQuantity: deal.maxQuantity || null,
        pricePerUnit: unit,
        originalPricePerUnit: base,
      },
    ],
  };
  product.minOrderQuantity = deal.minQuantity;
  await product.save();
  return { productName: product.name, sku: product.sku || "", unit };
}

export async function listBulkDeals(req, res, next) {
  try {
    const deals = await BulkSellingDeal.find().sort({ createdAt: -1 }).lean();
    return ok(res, deals, { stats: { count: deals.length, enabled: deals.filter((d) => d.enabled).length } });
  } catch (error) {
    next(error);
  }
}

export async function createBulkDeal(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.body.productId)) {
      return fail(res, 400, "A valid product is required");
    }
    const minQuantity = Number(req.body.minQuantity || 10);
    const deal = await BulkSellingDeal.create({
      name: String(req.body.name || "").trim() || `Buy ${minQuantity}+ wholesale`,
      enabled: req.body.enabled !== false,
      productId: req.body.productId,
      minQuantity,
      maxQuantity: req.body.maxQuantity ? Number(req.body.maxQuantity) : null,
      discountPercent: Number(req.body.discountPercent ?? 5),
      pricePerUnit: req.body.pricePerUnit ? Number(req.body.pricePerUnit) : null,
    });
    const applied = await applyDealToProduct(deal);
    if (applied.error) return fail(res, 404, applied.error);
    deal.productName = applied.productName;
    deal.sku = applied.sku;
    await deal.save();
    return res.status(201).json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
}

export async function updateBulkDeal(req, res, next) {
  try {
    const deal = await BulkSellingDeal.findById(req.params.id);
    if (!deal) return fail(res, 404, "Bulk deal not found");
    ["name", "enabled", "productId", "minQuantity", "maxQuantity", "discountPercent", "pricePerUnit"].forEach(
      (key) => {
        if (req.body[key] !== undefined) deal[key] = req.body[key];
      }
    );
    const applied = await applyDealToProduct(deal);
    if (applied.error) return fail(res, 404, applied.error);
    deal.productName = applied.productName;
    deal.sku = applied.sku;
    await deal.save();
    return ok(res, deal);
  } catch (error) {
    next(error);
  }
}

export async function deleteBulkDeal(req, res, next) {
  try {
    const deal = await BulkSellingDeal.findByIdAndDelete(req.params.id);
    if (!deal) return fail(res, 404, "Bulk deal not found");
    return ok(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
}

const PRODUCT_CSV_HEADERS = [
  "sku",
  "name",
  "brandName",
  "categories",
  "subcategory",
  "price",
  "discountedPrice",
  "stock",
  "isActive",
];

function serializeProductRow(product) {
  return {
    sku: product.sku || "",
    name: product.name || "",
    brandName: product.brandName || "",
    categories: Array.isArray(product.categories) ? product.categories.join("|") : "",
    subcategory: product.subcategory || "",
    price: product.price ?? "",
    discountedPrice: product.discountedPrice ?? "",
    stock: product.stock ?? "",
    isActive: product.isActive !== false,
  };
}

export async function exportProductsCsv(_req, res, next) {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    const csv = toCsv(products.map(serializeProductRow), PRODUCT_CSV_HEADERS);
    return ok(res, { csv, count: products.length, headers: PRODUCT_CSV_HEADERS });
  } catch (error) {
    next(error);
  }
}

export async function exportProductsJson(_req, res, next) {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    return ok(res, products.map(serializeProductRow), { count: products.length });
  } catch (error) {
    next(error);
  }
}

async function upsertProductRow(row) {
  const sku = String(row.sku || "").trim();
  const name = String(row.name || "").trim();
  const price = Number(row.price);
  const discountedPrice = Number(row.discountedPrice ?? row.price);
  const stock = Number(row.stock);
  const brandName = String(row.brandName || "GreenGrocc").trim() || "GreenGrocc";
  const categories = String(row.categories || "Grocery")
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const subcategory = String(row.subcategory || categories[0] || "General").trim();
  const isActive = !["false", "0", "no", "inactive"].includes(String(row.isActive ?? "true").toLowerCase());

  if (!sku && !name) return { error: "sku or name is required" };

  let product = sku ? await Product.findOne({ sku }) : null;
  if (product) {
    if (name) product.name = name;
    if (brandName) product.brandName = brandName;
    if (categories.length) product.categories = categories;
    if (subcategory) product.subcategory = subcategory;
    if (Number.isFinite(price)) product.price = price;
    if (Number.isFinite(discountedPrice)) product.discountedPrice = discountedPrice;
    if (Number.isFinite(stock)) {
      product.stock = stock;
      product.inStock = stock > 0;
    }
    product.isActive = isActive;
    await product.save();
    await refreshProductInStores(product);
    return { action: "updated", sku: product.sku, name: product.name };
  }

  if (!name || !Number.isFinite(price)) {
    return { error: "New products need name and price" };
  }

  const created = await Product.create({
    sku: sku || undefined,
    name,
    brandName,
    categories: categories.length ? categories : ["Grocery"],
    subcategory,
    subcategories: [subcategory],
    price,
    discountedPrice: Number.isFinite(discountedPrice) ? discountedPrice : price,
    discountedPercent:
      price > 0 && Number.isFinite(discountedPrice)
        ? Math.max(0, Math.round(((price - discountedPrice) / price) * 100))
        : 0,
    stock: Number.isFinite(stock) ? stock : 0,
    inStock: Number.isFinite(stock) ? stock > 0 : true,
    isActive,
    productImages: [
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop",
    ],
  });
  return { action: "created", sku: created.sku, name: created.name };
}

export async function importProductsCsv(req, res, next) {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : parseCsv(req.body.csv);
    if (!rows.length) return fail(res, 400, "No CSV rows found");
    const results = [];
    for (const row of rows) {
      try {
        results.push(await upsertProductRow(row));
      } catch (error) {
        results.push({ error: error.message, sku: row.sku, name: row.name });
      }
    }
    return ok(res, results, {
      stats: {
        total: results.length,
        created: results.filter((row) => row.action === "created").length,
        updated: results.filter((row) => row.action === "updated").length,
        failed: results.filter((row) => row.error).length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function importProductsJson(req, res, next) {
  try {
    const rows = Array.isArray(req.body.products) ? req.body.products : req.body.rows;
    if (!Array.isArray(rows) || !rows.length) return fail(res, 400, "Provide a products array");
    req.body.rows = rows;
    return importProductsCsv(req, res, next);
  } catch (error) {
    next(error);
  }
}

export async function listProductsLite(_req, res, next) {
  try {
    const products = await Product.find({ isActive: true })
      .select("name sku discountedPrice price stock categories subcategory unit weight isHeavy productImages")
      .sort({ name: 1 })
      .limit(500)
      .lean();
    return ok(res, products);
  } catch (error) {
    next(error);
  }
}

export async function listProductCategoriesLite(_req, res, next) {
  try {
    const products = await Product.find({ isActive: true })
      .select("categories subcategory")
      .lean();

    const categorySet = new Set();
    const subcategorySet = new Set();
    const subcategoriesByCategory = {};

    for (const p of products) {
      const cats = Array.isArray(p.categories) ? p.categories : [p.category].filter(Boolean);
      const sub = p.subcategory ? String(p.subcategory).trim() : "";
      if (sub) subcategorySet.add(sub);

      for (const c of cats) {
        const catName = String(c || "").trim();
        if (!catName) continue;
        categorySet.add(catName);
        if (!subcategoriesByCategory[catName]) {
          subcategoriesByCategory[catName] = new Set();
        }
        if (sub) {
          subcategoriesByCategory[catName].add(sub);
        }
      }
    }

    const categories = [...categorySet].sort();
    const subcategories = [...subcategorySet].sort();
    const mapping = {};
    for (const [k, set] of Object.entries(subcategoriesByCategory)) {
      mapping[k] = [...set].sort();
    }
    const all = [...new Set([...categories, ...subcategories])].sort();

    return ok(res, {
      categories,
      subcategories,
      subcategoriesByCategory: mapping,
      all,
    });
  } catch (error) {
    next(error);
  }
}
