import BaseProduct from "../models/BaseProduct.js";
import Product from "../../../legacy/models/Product.js";
import Category from "../models/Category.js";
import { resolveImageUrl } from '../../../legacy/utils/urlResolver.js';

/** Must match `baseProductKey` in admin Products.jsx so saved base products and product fields line up. */
export function baseProductKey(category = "", name = "") {
  const slug = `${category}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug ? `bp-${slug}` : "";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Creates entries for base products that so far only exist as fields on products. */
export async function backfillBaseProductsFromProducts() {
  try {
    const groups = await Product.aggregate([
      { $match: { baseProductId: { $nin: [null, ""] }, baseProductName: { $nin: [null, ""] } } },
      {
        $group: {
          _id: "$baseProductId",
          name: { $first: "$baseProductName" },
          image: { $max: "$baseProductImage" },
          category: { $first: { $ifNull: [{ $arrayElemAt: ["$categories", 0] }, "$category"] } },
        },
      },
    ]);
    if (!groups.length) return;

    const existing = new Set(
      (await BaseProduct.find({ key: { $in: groups.map((g) => g._id) } }, { key: 1 }).lean()).map((d) => d.key)
    );
    const missing = groups.filter((g) => !existing.has(g._id));
    if (!missing.length) return;

    const categories = await Category.find({}, { categoryName: 1, section: 1 }).lean();
    const sectionByCategory = new Map(
      categories.map((c) => [String(c.categoryName || "").toLowerCase(), c.section || ""])
    );

    await BaseProduct.insertMany(
      missing.map((g) => ({
        key: g._id,
        name: g.name,
        image: g.image || "",
        category: g.category || "",
        section: sectionByCategory.get(String(g.category || "").toLowerCase()) || "",
      })),
      { ordered: false }
    );
    console.log(`[BaseProduct] backfilled ${missing.length} base product(s) from products`);
  } catch (error) {
    console.warn("[BaseProduct] backfill failed:", error.message);
  }
}

export const getBaseProducts = async (req, res) => {
  try {
    const { section, category, search } = req.query;
    const filter = {};
    if (section) filter.section = String(section).trim().toLowerCase();
    if (category) filter.category = new RegExp(`^${escapeRegex(String(category).trim())}$`, "i");
    if (search) filter.name = new RegExp(escapeRegex(String(search).trim()), "i");

    const items = await BaseProduct.find(filter).sort({ name: 1 }).lean();

    const counts = await Product.aggregate([
      { $match: { baseProductId: { $in: items.map((item) => item.key) } } },
      { $group: { _id: "$baseProductId", count: { $sum: 1 } } },
    ]);
    const countByKey = new Map(counts.map((row) => [row._id, row.count]));

    res.json({
      success: true,
      data: items.map((item) => ({ ...item, image: resolveImageUrl(item.image) || '', productCount: countByKey.get(item.key) || 0 })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBaseProduct = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const category = String(req.body.category || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Base product name is required" });
    if (!category) return res.status(400).json({ success: false, message: "Category is required" });

    const key = baseProductKey(category, name);
    if (await BaseProduct.exists({ key })) {
      return res.status(409).json({ success: false, message: `"${name}" already exists in ${category}` });
    }

    const item = await BaseProduct.create({
      name,
      key,
      category,
      section: String(req.body.section || "").trim().toLowerCase(),
      image: String(req.body.image || "").trim(),
      isActive: req.body.isActive !== false,
    });

    res.status(201).json({ success: true, data: { ...item.toObject(), image: resolveImageUrl(item.image) || '' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Name/image edits are copied onto every product linked to this base product. */
export const updateBaseProduct = async (req, res) => {
  try {
    const item = await BaseProduct.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Base product not found" });

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: "Base product name is required" });
      item.name = name;
    }
    if (req.body.image !== undefined) item.image = String(req.body.image || "").trim();
    if (req.body.isActive !== undefined) item.isActive = Boolean(req.body.isActive);
    await item.save();

    await Product.updateMany(
      { baseProductId: item.key },
      { $set: { baseProductName: item.name, baseProductImage: item.image } }
    );

    res.json({ success: true, data: { ...item.toObject(), image: resolveImageUrl(item.image) || '' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBaseProduct = async (req, res) => {
  try {
    const item = await BaseProduct.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Base product not found" });

    const linked = await Product.countDocuments({ baseProductId: item.key });
    if (linked > 0) {
      return res.status(409).json({
        success: false,
        message: `${linked} product(s) still use "${item.name}". Move them to another base product first.`,
      });
    }

    await item.deleteOne();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
