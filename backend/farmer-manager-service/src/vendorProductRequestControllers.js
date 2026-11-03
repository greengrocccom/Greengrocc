import crypto from "crypto";
import mongoose from "mongoose";
import Product from "../../legacy/models/Product.js";
import { Farmer, FarmerProduct, Vendor, VendorProduct, VendorProductRequest } from "./models.js";
import { generateId } from "../../erp-service/src/services/idGenerator.js";
import { categoryFromName, cropCodeFromName, varietyCodeFromName } from "../../erp-service/src/config/idRegistry.js";
import { pushFarmerProductReview } from "./farmerPush.js";

const CATALOG_FIELDS =
  "name sku categories subcategory section productImages price discountedPrice unit stock inStock isActive brandName varietyName";
const ADMIN_CATALOG_FILTER = { isActive: { $ne: false }, ownerManagerId: null };
const CATALOG_SECTION_ORDER = ["preorder", "ready2cook", "instantorder"];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function vendorIdOf(req) {
  return req.user?.vendorId || req.user?.id || "";
}

export function catalogProductSummary(p) {
  return {
    productId: String(p._id),
    name: p.name,
    sku: p.sku || "",
    category: p.categories?.[0] || "",
    categories: p.categories || [],
    subcategory: p.subcategory || "",
    section: p.section || "",
    image: p.productImages?.[0] || "",
    price: p.price ?? 0,
    discountedPrice: p.discountedPrice ?? p.price ?? 0,
    unit: p.unit || "",
    stock: p.stock ?? 0,
    inStock: p.inStock !== false,
    isActive: p.isActive !== false,
    brandName: p.brandName || "",
    varietyName: p.varietyName || "",
    description: p.description || "",
  };
}

export function serializeVendorProductRequest(doc) {
  const { _id, __v, ...rest } = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return rest;
}

const VENDOR_PRICING_FIELDS = ["price", "discountedPrice", "stock"];
// Name, brand, variety, category and subcategory always come from the admin catalog.
const VENDOR_TEXT_FIELDS = [{ field: "description", key: "customDescription", label: "Description", max: 1000 }];
const VENDOR_UNIT_TYPES = [
  "Piece", "Kg", "Gram", "Liter", "ML", "Box", "Pack", "Packet", "Bag",
  "Set", "Pair", "Dozen", "Bundle", "Bunch", "Meter", "CM",
];

const hasOverride = (value) => value !== null && value !== undefined;

function parseVendorUnit(value) {
  const text = String(value ?? "").trim();
  if (!text) return { value: "" };
  const match = text.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);
  const qty = match ? Number(match[1]) : NaN;
  const type = match ? VENDOR_UNIT_TYPES.find((t) => t.toLowerCase() === match[2].toLowerCase()) : null;
  if (!type || !(qty > 0)) return { error: "Unit must be a quantity and a unit type, e.g. 500 Gram" };
  return { value: `${qty} ${type}` };
}

const CUSTOM_KEYS = [
  ...VENDOR_PRICING_FIELDS,
  ...VENDOR_TEXT_FIELDS.map((f) => f.key),
  "customUnit",
  "customInStock",
];

// Section, category, subcategory, base product, store, visibility and IDs stay admin-controlled even in a vendor's own copy.
const OVERRIDE_BLOCKED_KEYS = new Set([
  "_id", "id", "productId", "section", "storeType", "isActive", "ownerManagerId", "ownerVendorId", "departmentId",
  "categories", "category", "subcategory", "subcategories", "baseProductId", "baseProductName", "baseProductImage",
]);
const OVERRIDE_MAX_BYTES = 200 * 1024;

function sanitizeOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Product details are missing" };
  const clean = Object.fromEntries(Object.entries(raw).filter(([key]) => !OVERRIDE_BLOCKED_KEYS.has(key)));
  if (!String(clean.name || "").trim()) return { error: "Product name is required" };
  if (Buffer.byteLength(JSON.stringify(clean)) > OVERRIDE_MAX_BYTES) return { error: "Product details are too large" };
  return { value: clean };
}

function summaryFromOverrides(o) {
  if (!o) return {};
  const out = {};
  if (o.name) out.name = String(o.name);
  if (o.sku) out.sku = String(o.sku);
  if (Array.isArray(o.productImages) && o.productImages[0]) out.image = o.productImages[0];
  if ("brandName" in o) out.brandName = String(o.brandName || "");
  if ("varietyName" in o) out.varietyName = String(o.varietyName || "");
  return out;
}

/**
 * VendorProduct rows merged with live catalog data; `catalogMissing` marks products admin removed or disabled.
 * Every editable field is this vendor's own value when set, otherwise the catalog's; `catalog` holds the
 * untouched catalog values for reference.
 */
export async function vendorProductsWithCatalog(vendorId) {
  const rows = await VendorProduct.find({ vendorId }).sort({ createdAt: -1 }).lean();
  const ids = rows.map((r) => r.productId).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const products = ids.length
    ? await Product.find({ _id: { $in: ids } }).select(`${CATALOG_FIELDS} description`).lean()
    : [];
  const byId = new Map(products.map((p) => [String(p._id), catalogProductSummary(p)]));
  return rows.map(({ _id, __v, ...row }) => {
    const live = byId.get(row.productId);
    const base = live || { name: row.productName, image: row.productImage, category: row.category, unit: row.unit };
    const effective = {};
    for (const field of VENDOR_PRICING_FIELDS) {
      effective[field] = hasOverride(row[field]) ? row[field] : base[field] ?? null;
    }
    if (!hasOverride(row.discountedPrice) && hasOverride(row.price) && Number(effective.discountedPrice) > Number(row.price)) {
      effective.discountedPrice = row.price;
    }
    for (const { field, key } of VENDOR_TEXT_FIELDS) effective[field] = row[key] || base[field] || "";
    effective.unit = row.customUnit || base.unit || "";
    effective.inStock = hasOverride(row.customInStock) ? row.customInStock : base.inStock !== false;
    const catalog = {
      name: base.name || "",
      brandName: base.brandName || "",
      varietyName: base.varietyName || "",
      category: base.category || "",
      subcategory: base.subcategory || "",
      description: base.description || "",
      unit: base.unit || "",
      price: live?.price ?? null,
      discountedPrice: live?.discountedPrice ?? null,
      stock: live?.stock ?? null,
      inStock: live ? live.inStock : null,
    };
    return {
      ...row,
      ...base,
      ...summaryFromOverrides(row.overrides),
      ...effective,
      catalog,
      catalogPrice: catalog.price,
      catalogDiscountedPrice: catalog.discountedPrice,
      catalogStock: catalog.stock,
      catalogUnit: catalog.unit,
      customPricing: Boolean(row.overrides) || CUSTOM_KEYS.some((key) => hasOverride(row[key]) && row[key] !== ""),
      catalogMissing: !live || !live.isActive,
    };
  });
}

function parseOptionalAmount(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") return { value: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { error: `${label} must be a number of 0 or more` };
  return { value: Math.round(n * 100) / 100 };
}

export async function updateVendorMyProduct(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const productId = String(req.params.productId || "").trim();
    const row = await VendorProduct.findOne({ vendorId, productId });
    if (!row) return res.status(404).json({ message: "This product is not in your products" });

    const update = {};
    const body = req.body || {};
    if (body.reset === true) {
      for (const field of VENDOR_PRICING_FIELDS) update[field] = null;
      for (const { key } of VENDOR_TEXT_FIELDS) update[key] = "";
      update.customUnit = "";
      update.customInStock = null;
      update.overrides = null;
    } else if ("overrides" in body) {
      const parsed = sanitizeOverrides(body.overrides);
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      const o = parsed.value;
      for (const field of VENDOR_PRICING_FIELDS) {
        const amount = parseOptionalAmount(o[field], field);
        if (amount.error) return res.status(400).json({ message: amount.error });
        update[field] = field === "stock" && amount.value !== null ? Math.floor(amount.value) : amount.value;
      }
      update.customDescription = String(o.description || "").trim().slice(0, 1000);
      update.customUnit = String(o.unit || "").trim();
      update.customInStock = typeof o.inStock === "boolean" ? o.inStock : null;
      update.overrides = o;
    } else {
      for (const { field, key, label, max } of VENDOR_TEXT_FIELDS) {
        if (!(field in body)) continue;
        const text = String(body[field] ?? "").trim();
        if (text.length > max) return res.status(400).json({ message: `${label} can be at most ${max} characters` });
        update[key] = text;
      }
      if ("unit" in body) {
        const parsed = parseVendorUnit(body.unit);
        if (parsed.error) return res.status(400).json({ message: parsed.error });
        update.customUnit = parsed.value;
      }
      if ("inStock" in body) {
        if (body.inStock !== null && typeof body.inStock !== "boolean") {
          return res.status(400).json({ message: "In stock must be true or false" });
        }
        update.customInStock = body.inStock;
      }
      const labels = { price: "MRP", discountedPrice: "Selling price", stock: "Stock" };
      for (const field of VENDOR_PRICING_FIELDS) {
        if (!(field in (req.body || {}))) continue;
        const parsed = parseOptionalAmount(req.body[field], labels[field]);
        if (parsed.error) return res.status(400).json({ message: parsed.error });
        update[field] = field === "stock" && parsed.value !== null ? Math.floor(parsed.value) : parsed.value;
      }
      if (!Object.keys(update).length) return res.status(400).json({ message: "Nothing to update" });
    }

    const nextPrice = "price" in update ? update.price : row.price;
    const nextSelling = "discountedPrice" in update ? update.discountedPrice : row.discountedPrice;
    if (hasOverride(nextPrice) && hasOverride(nextSelling) && nextSelling > nextPrice) {
      return res.status(400).json({ message: "Selling price cannot be more than MRP" });
    }

    Object.assign(row, update, { pricingUpdatedAt: new Date() });
    await row.save();
    const products = await vendorProductsWithCatalog(vendorId);
    res.json(products.find((p) => p.productId === productId) || null);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update product" });
  }
}

/** Direct stock addition for Seller Vendors (Seller can add catalog products directly with stock) */
export async function addVendorStockProduct(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const vendor = await Vendor.findOne({ id: vendorId }).lean();
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    // Allow seller vendors direct stock creation (farmer vendors remain unchanged)
    const isSeller = vendor.vendorType === "seller";
    if (!isSeller) {
      return res.status(403).json({ message: "Direct stock addition is only enabled for seller vendors" });
    }

    const { productId, stock, price, discountedPrice, unit, inStock, section } = req.body || {};
    if (!productId) {
      return res.status(400).json({ message: "Product selection is required" });
    }

    const catalogProd = await Product.findById(productId).lean();
    if (!catalogProd) {
      return res.status(404).json({ message: "Catalog product not found" });
    }

    if (section && (!catalogProd.section || catalogProd.section === "general")) {
      await Product.findByIdAndUpdate(catalogProd._id, { section }).catch(() => {});
    }

    const qty = Number(stock ?? 0);
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ message: "Stock quantity must be a non-negative number" });
    }

    let row = await VendorProduct.findOne({ vendorId, productId: String(catalogProd._id) });
    if (row) {
      row.stock = Math.floor(qty);
      if (price !== undefined && price !== null && price !== "") row.price = Number(price);
      if (discountedPrice !== undefined && discountedPrice !== null && discountedPrice !== "") row.discountedPrice = Number(discountedPrice);
      if (unit) row.customUnit = unit;
      row.customInStock = inStock !== undefined ? Boolean(inStock) : qty > 0;
      await row.save();
    } else {
      row = await VendorProduct.create({
        id: `vp-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        vendorId,
        productId: String(catalogProd._id),
        productName: catalogProd.name,
        productImage: catalogProd.productImages?.[0] || "",
        category: catalogProd.categories?.[0] || "",
        unit: unit || catalogProd.unit || "Piece",
        price: price !== undefined && price !== null && price !== "" ? Number(price) : (catalogProd.price ?? 0),
        discountedPrice: discountedPrice !== undefined && discountedPrice !== null && discountedPrice !== "" ? Number(discountedPrice) : (catalogProd.discountedPrice ?? catalogProd.price ?? 0),
        stock: Math.floor(qty),
        customInStock: inStock !== undefined ? Boolean(inStock) : qty > 0,
        addedBy: "seller-stock-add",
      });
    }

    // Auto-approve any pending product request for this vendor & product
    await VendorProductRequest.updateMany(
      { vendorId, productId: String(catalogProd._id), status: "Pending" },
      { $set: { status: "Approved", reviewedAt: new Date(), notes: "Added directly via Seller Stock" } }
    );

    const products = await vendorProductsWithCatalog(vendorId);
    const item = products.find((p) => p.productId === String(catalogProd._id));
    return res.json({ success: true, product: item, products });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to add product to stock" });
  }
}

/** Full catalog product with this vendor's edits applied, for the product editor. */
export async function getVendorMyProductFull(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const productId = String(req.params.productId || "").trim();
    const row = await VendorProduct.findOne({ vendorId, productId }).lean();
    if (!row) return res.status(404).json({ message: "This product is not in your products" });
    const catalog = mongoose.Types.ObjectId.isValid(productId) ? await Product.findById(productId).lean() : null;
    if (!catalog && !row.overrides) return res.status(404).json({ message: "This product is no longer in the admin catalog" });

    const product = { ...(catalog || {}), ...(row.overrides || {}) };
    if (catalog) for (const key of OVERRIDE_BLOCKED_KEYS) if (key in catalog) product[key] = catalog[key];
    for (const field of VENDOR_PRICING_FIELDS) if (hasOverride(row[field])) product[field] = row[field];
    if (row.customDescription) product.description = row.customDescription;
    if (row.customUnit) product.unit = row.customUnit;
    if (hasOverride(row.customInStock)) product.inStock = row.customInStock;
    product._id = productId;
    product.section = catalog?.section || product.section || "";
    res.json({ product, hasOverrides: Boolean(row.overrides) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load product" });
  }
}

export async function deleteVendorMyProduct(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const productId = String(req.params.productId || "").trim();
    const removed = await VendorProduct.findOneAndDelete({
      vendorId,
      $or: [{ productId }, { id: productId }],
    });
    if (!removed) {
      return res.status(404).json({ message: "Product not found in your products" });
    }
    res.json({ success: true, message: "Product removed from your products" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to remove product" });
  }
}

export async function listVendorCatalogProducts(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const section = String(req.query.section || "").trim().toLowerCase();
    const sectionFilter = section ? { ...ADMIN_CATALOG_FILTER, section } : ADMIN_CATALOG_FILTER;
    const filter = { ...sectionFilter };
    if (req.query.category) filter.categories = String(req.query.category);
    const q = String(req.query.q || "").trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { sku: rx }, { subcategory: rx }, { brandName: rx }, { varietyName: rx }];
    }
    const sectionCountFilter = { ...filter };
    delete sectionCountFilter.section;
    const [products, total, categories, sectionCounts, added, pending] = await Promise.all([
      Product.aggregate([
        { $match: filter },
        { $addFields: { _sectionRank: { $indexOfArray: [CATALOG_SECTION_ORDER, "$section"] } } },
        { $addFields: { _sectionRank: { $cond: [{ $lt: ["$_sectionRank", 0] }, 99, "$_sectionRank"] } } },
        { $sort: { _sectionRank: 1, name: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: Object.fromEntries(CATALOG_FIELDS.split(" ").map((f) => [f, 1])) },
      ]),
      Product.countDocuments(filter),
      Product.distinct("categories", sectionFilter),
      Product.aggregate([{ $match: sectionCountFilter }, { $group: { _id: "$section", count: { $sum: 1 } } }]),
      VendorProduct.find({ vendorId }).select("productId").lean(),
      VendorProductRequest.find({ vendorId, status: "Pending" }).select("productId").lean(),
    ]);
    const addedIds = new Set(added.map((r) => r.productId));
    const pendingIds = new Set(pending.map((r) => r.productId));
    res.json({
      page,
      limit,
      total,
      sections: Object.fromEntries(sectionCounts.filter((s) => s._id).map((s) => [s._id, s.count])),
      categories: categories.filter(Boolean).sort(),
      products: products.map((p) => {
        const summary = catalogProductSummary(p);
        return { ...summary, added: addedIds.has(summary.productId), requested: pendingIds.has(summary.productId) };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load catalog products" });
  }
}

export async function listVendorMyProducts(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const [products, requests] = await Promise.all([
      vendorProductsWithCatalog(vendorId),
      VendorProductRequest.find({ vendorId }).sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ products, requests: requests.map(serializeVendorProductRequest) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load products" });
  }
}

export async function createVendorProductRequest(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const productId = String(req.body?.productId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: "Select a product from the catalog" });
    const product = await Product.findOne({ _id: productId, ...ADMIN_CATALOG_FILTER }).select(CATALOG_FIELDS).lean();
    if (!product) return res.status(404).json({ message: "This product is not available in the admin catalog" });

    const [alreadyAdded, pending] = await Promise.all([
      VendorProduct.exists({ vendorId, productId }),
      VendorProductRequest.exists({ vendorId, productId, status: "Pending" }),
    ]);
    if (alreadyAdded) return res.status(409).json({ message: "This product is already in your products" });
    if (pending) return res.status(409).json({ message: "A request for this product is already waiting for approval" });

    const summary = catalogProductSummary(product);
    const request = await VendorProductRequest.create({
      id: `vpr-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      vendorId,
      productId,
      productName: summary.name,
      productImage: summary.image,
      category: summary.category,
      unit: summary.unit,
      notes: String(req.body?.notes || "").trim().slice(0, 500),
      status: "Pending",
    });
    res.status(201).json(serializeVendorProductRequest(request));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to send product request" });
  }
}

export async function cancelVendorProductRequest(req, res) {
  try {
    const request = await VendorProductRequest.findOne({ id: req.params.requestId, vendorId: vendorIdOf(req) });
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "Pending") {
      return res.status(400).json({ message: `This request is already ${request.status.toLowerCase()}` });
    }
    request.status = "Cancelled";
    await request.save();
    res.json(serializeVendorProductRequest(request));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to cancel request" });
  }
}

export async function listFarmerVendorProducts(req, res) {
  try {
    const farmerId = req.user?.farmerId || req.user?.id || req.params.farmerId || req.query.farmerId;
    const farmer = await Farmer.findOne({
      $or: [{ id: farmerId }, { farmerId }, { _id: mongoose.Types.ObjectId.isValid(farmerId) ? farmerId : null }].filter(Boolean),
    }).select("id vendorId").lean();
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    if (!farmer.vendorId) {
      return res.json({ success: true, vendorId: "", total: 0, products: [] });
    }

    const [vendorProds, myProducts] = await Promise.all([
      vendorProductsWithCatalog(farmer.vendorId),
      FarmerProduct.find({
        farmerId: farmer.id,
        isDeleted: { $ne: true },
      })
        .select("id productId name productName status rejectionReason sellingPrice stock availableQuantity")
        .lean(),
    ]);

    const myProductByKey = new Map();
    for (const p of myProducts) {
      const pid = String(p.productId || p.id || "").trim().toLowerCase();
      const pname = String(p.productName || p.name || "").trim().toLowerCase();
      if (pid) myProductByKey.set(pid, p);
      if (pname) myProductByKey.set(pname, p);
    }

    const seenKeys = new Set();
    const result = [];

    for (const vp of vendorProds) {
      const name = String(vp.productName || vp.name || "").trim();
      const pid = String(vp.productId || vp.id || "").trim();
      const key = `${name.toLowerCase()}:::${String(vp.variety || vp.varietyName || "").toLowerCase()}`;
      if (!name || seenKeys.has(key)) continue;
      seenKeys.add(key);

      const myProd = myProductByKey.get(pid.toLowerCase()) || myProductByKey.get(name.toLowerCase());
      const myStatus = String(myProd?.status || "").trim();
      const isAdded = myStatus === "Active" || myStatus === "Approved" || myStatus === "Published";
      const isPending = myStatus === "Pending Approval" || myStatus === "Pending" || myStatus === "PENDING_APPROVAL";
      const isRejected = myStatus === "Rejected";

      result.push({
        id: pid || vp.id,
        productId: pid,
        productName: name,
        name,
        category: vp.category || "Vegetables",
        variety: vp.variety || vp.varietyName || "",
        unit: vp.unit || "Kg",
        image: vp.image || vp.productImage || "",
        imageUrl: vp.image || vp.productImage || "",
        price: Number(vp.price || vp.mrp || 0),
        mrp: Number(vp.price || vp.mrp || 0),
        discountedPrice: Number(vp.discountedPrice || vp.sellingPrice || 0),
        sellingPrice: Number(vp.discountedPrice || vp.sellingPrice || 0),
        description: vp.description || "",
        inStock: vp.inStock !== false,
        isAdded,
        isPending,
        isRejected,
        status: isAdded ? "Active" : isPending ? "Pending Approval" : isRejected ? "Rejected" : "Available",
        rejectionReason: isRejected ? (myProd?.rejectionReason || "") : "",
        myProductId: myProd?.id || "",
      });
    }

    res.json({
      success: true,
      vendorId: farmer.vendorId,
      total: result.length,
      products: result,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load vendor products" });
  }
}

export async function listManagerVendorProductsCatalog(req, res) {
  try {
    const vendorId = req.user?.vendorId || "";
    if (!vendorId) return res.json([]);
    const products = await vendorProductsWithCatalog(vendorId);
    const seen = new Set();
    const result = [];
    for (const vp of products) {
      const name = String(vp.productName || vp.name || "").trim();
      const variety = String(vp.variety || vp.varietyName || vp.catalog?.varietyName || "").trim();
      const key = `${name.toLowerCase()}:::${variety.toLowerCase()}`;
      if (!name || seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: vp.productId || vp.id,
        productId: vp.productId || vp.id,
        productName: name,
        name,
        variety,
        category: vp.category || "",
        unit: vp.unit || "Kg",
        image: vp.image || vp.productImage || "",
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load collection centre products" });
  }
}

export async function requestFarmerProduct(req, res) {
  try {
    const farmerId = req.user?.farmerId || req.user?.id || req.params.farmerId || req.body?.farmerId || req.query.farmerId;
    const farmer = await Farmer.findOne({
      $or: [{ id: farmerId }, { farmerId }, { _id: mongoose.Types.ObjectId.isValid(farmerId) ? farmerId : null }].filter(Boolean),
    });
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });
    if (!farmer.vendorId) {
      return res.status(400).json({ message: "You are not assigned to a collection centre / vendor yet." });
    }

    const payload = req.body || {};
    const productName = String(payload.productName || payload.name || "").trim();
    if (!productName) {
      return res.status(400).json({ message: "Product name is required" });
    }

    const productId = String(payload.productId || "").trim();

    // Verify that the requested product is approved and assigned to the farmer's vendor
    const vendorProd = await VendorProduct.findOne({
      vendorId: farmer.vendorId,
      $or: [
        ...(productId ? [{ productId }, { id: productId }] : []),
        { name: new RegExp(`^${escapeRegex(productName)}$`, "i") },
        { productName: new RegExp(`^${escapeRegex(productName)}$`, "i") },
      ],
    }).lean();

    if (!vendorProd) {
      return res.status(400).json({ message: "This product is not approved in your vendor's catalog." });
    }

    const boundProductId = vendorProd.productId || vendorProd.id || productId;
    const finalProductName = vendorProd.productName || vendorProd.name || productName;

    const existing = await FarmerProduct.findOne({
      farmerId: farmer.id,
      isDeleted: { $ne: true },
      $or: [
        ...(boundProductId ? [{ productId: boundProductId }, { id: boundProductId }] : []),
        { name: new RegExp(`^${escapeRegex(finalProductName)}$`, "i") },
        { productName: new RegExp(`^${escapeRegex(finalProductName)}$`, "i") },
      ],
    });

    if (existing) {
      const st = existing.status;
      if (st === "Active" || st === "Approved" || st === "Published") {
        return res.status(409).json({ message: "This product is already active in your products." });
      }
      if (st === "Pending Approval" || st === "Pending" || st === "PENDING_APPROVAL") {
        return res.status(409).json({ message: "A request for this product is already pending vendor approval." });
      }
      // Re-request if previously rejected
      existing.status = "Pending Approval";
      existing.rejectionReason = "";
      existing.sellingPrice = Number(payload.sellingPrice || payload.pricePerKg) || existing.sellingPrice || vendorProd.discountedPrice || vendorProd.price || 0;
      existing.pricePerKg = existing.sellingPrice;
      existing.stock = Number(payload.stock || payload.availableQuantity) || existing.stock || 10;
      existing.availableQuantity = existing.stock;
      if (payload.unit || vendorProd.unit) existing.unit = payload.unit || vendorProd.unit;
      if (payload.image || payload.imageUrl || vendorProd.productImage || vendorProd.image) {
        existing.image = payload.image || payload.imageUrl || vendorProd.productImage || vendorProd.image;
      }
      existing.grades = [
        { id: "g-a", label: "Grade A", quantity: existing.stock || 0 }
      ];
      await existing.save();
      try { pushFarmerProductReview(existing); } catch (_) {}
      return res.json({
        success: true,
        message: "Product request re-submitted successfully for vendor approval.",
        product: existing,
      });
    }

    const id = await generateId({
      module: "ART",
      category: categoryFromName(vendorProd.category || payload.category || finalProductName),
      crop: cropCodeFromName(finalProductName),
      variety: varietyCodeFromName(payload.variety || vendorProd.variety || vendorProd.varietyName || ""),
    });

    const stock = Number(payload.stock || payload.availableQuantity || payload.quantity) || 10;
    const price = Number(payload.sellingPrice || payload.pricePerKg || payload.price) || Number(vendorProd.discountedPrice || vendorProd.price) || 0;
    const mrp = Number(payload.mrp || payload.price || price) || Number(vendorProd.price || price) || price;
    const image = payload.image || payload.imageUrl || vendorProd.productImage || vendorProd.image || "";

    const newProduct = new FarmerProduct({
      id,
      productId: boundProductId,
      vendorId: farmer.vendorId,
      managerId: farmer.managerId || "",
      farmerId: farmer.id,
      name: finalProductName,
      productName: finalProductName,
      category: vendorProd.category || payload.category || "Vegetables",
      subCategory: vendorProd.subcategory || payload.subCategory || "Fresh Produce",
      variety: payload.variety || vendorProd.variety || vendorProd.varietyName || "",
      unit: payload.unit || vendorProd.unit || "Kg",
      sellingPrice: price,
      pricePerKg: price,
      mrp,
      stock,
      availableQuantity: stock,
      status: "Pending Approval",
      image,
      images: image ? [image] : [],
      cropName: payload.cropLinked || payload.cropName || finalProductName,
      farmingType: payload.farmingType || "Conventional",
      produceType: payload.farmingType === "Organic" ? "organic" : "non-organic",
      farmName: farmer.farmName || "",
      farmLocation: farmer.farmLocation || "",
      grades: [
        { id: "g-a", label: "Grade A", quantity: stock }
      ],
      gradeAQty: stock,
      minimumOrderQuantity: Number(payload.minimumOrderQuantity) || 1,
      harvestDate: payload.harvestDate || new Date().toISOString().split("T")[0],
    });

    await newProduct.save();
    try { pushFarmerProductReview(newProduct); } catch (_) {}

    res.status(201).json({
      success: true,
      message: "Product request submitted successfully for vendor approval.",
      product: newProduct,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to submit product request" });
  }
}
