import Category from "../models/Category.js";
import Section from "../models/Section.js";
import Product from "../../../legacy/models/Product.js";
import { transformCategoryResponse } from "../../../legacy/utils/urlResolver.js";
import {
  addressFromQuery,
  hasLocationHint,
  loadNearestStoreCatalog,
  storeProductScope,
} from "../../../delivery-service/src/services/nearestStoreCatalog.js";

const nameKey = (value) => String(value || "").trim().toLowerCase();

/** Product filter for a department, mirroring GET /api/products (pre-order = everything). */
function productSectionClause(section, storeType) {
  const target = nameKey(section || storeType);
  if (["ready2cook", "ready-2-cook", "festive"].includes(target)) {
    return {
      $or: [{ section: { $in: ["ready2cook", "ready-2-cook", "festive"] } }, { storeType: "festive" }],
    };
  }
  if (["instantorder", "instant", "supermall", "mall"].includes(target)) {
    return {
      $or: [{ section: { $in: ["instantorder", "instant", "supermall"] } }, { storeType: "mall" }],
    };
  }
  if (["preorder", "main", "greengrocc"].includes(target)) {
    return {
      section: { $nin: ["ready2cook", "ready-2-cook", "festive", "instantorder", "instant", "supermall", "mall", "instantorders"] },
      storeType: { $nin: ["festive", "mall"] },
    };
  }
  return {};
}

async function categoriesFromProducts(products, includeInactive) {
  const counts = new Map();
  const labels = new Map();
  const subcategoriesByCategory = new Map();
  products.forEach((product) => {
    const subs = [product.subcategory, ...(product.subcategories || [])]
      .map((sub) => String(sub || "").trim())
      .filter(Boolean);
    (product.categories || []).forEach((category) => {
      const label = String(category || "").trim();
      const key = nameKey(label);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!labels.has(key)) labels.set(key, label);
      if (!subcategoriesByCategory.has(key)) subcategoriesByCategory.set(key, new Map());
      subs.forEach((sub) => subcategoriesByCategory.get(key).set(nameKey(sub), sub));
    });
  });

  const allCategories = await Category.find(includeInactive ? {} : { isActive: true }).sort({
    order: 1,
    categoryName: 1,
    createdAt: -1,
  });

  const listed = new Set();
  const categories = allCategories
    .filter((category) => counts.has(nameKey(category.categoryName)))
    .map((category) => {
      const doc = category.toObject();
      const key = nameKey(doc.categoryName);
      listed.add(key);
      const present = new Map(subcategoriesByCategory.get(key) || []);
      const ordered = (doc.subcategories || []).filter((sub) => present.delete(nameKey(sub)));
      return {
        ...doc,
        subcategories: [...ordered, ...present.values()],
        productCount: counts.get(key),
      };
    });

  labels.forEach((label, key) => {
    if (listed.has(key)) return;
    categories.push({
      categoryName: label,
      slug: label,
      subcategories: [...(subcategoriesByCategory.get(key)?.values() || [])],
      productCount: counts.get(key),
      isActive: true,
    });
  });

  return categories.sort((a, b) => String(a.categoryName).localeCompare(String(b.categoryName)));
}

const CATEGORY_SECTION_BY_NAME = {
  vegetables: "preorder",
  fruits: "preorder",
  dairy: "preorder",
  grains: "preorder",
  pulses: "preorder",
  grocery: "preorder",
  oils: "preorder",
  spices: "preorder",
  "dry fruits": "preorder",
  organic: "preorder",
  beverages: "preorder",
  bakery: "preorder",
  "chopped vegetables": "ready2cook",
  "cut & sliced": "ready2cook",
  "peeled & cleaned": "ready2cook",
  "cleaned bhaji & leafy": "ready2cook",
  "veggie & bhaji mix": "ready2cook",
  "supermall packaged grocery": "instantorder",
  "supermall grains & cereals": "instantorder",
  "supermall snacks & munchies": "instantorder",
  "supermall beverages & cold drinks": "instantorder",
};

function canonicalSection(value) {
  const key = nameKey(value);
  if (["greengrocc", "preorder", "main", "pre-order"].includes(key)) return "preorder";
  if (["ready2cook", "ready-2-cook", "festive"].includes(key)) return "ready2cook";
  if (["instantorder", "instant", "supermall", "mall", "instantorders"].includes(key)) return "instantorder";
  return key;
}

function resolvedCategorySection(doc) {
  const byName = CATEGORY_SECTION_BY_NAME[nameKey(doc.categoryName)];
  const usingDefault = typeof doc.$isDefault === "function" && doc.$isDefault("section");
  const stored = usingDefault ? "" : canonicalSection(doc.section);
  if (stored && stored !== "preorder") return stored;
  if (byName) return byName;
  return stored || "preorder";
}

/**
 * Active categories saved by admin for this department, including ones with no products yet,
 * plus categories owned by another department whose products are also sold here
 * (e.g. Instant Order selling Fruits).
 */
async function listCategoriesForSection(section, storeType, includeInactive = false) {
  const requested = canonicalSection(section || storeType);
  if (!requested) return null;
  const [docs, primaryCategories] = await Promise.all([
    Category.find(includeInactive ? {} : { isActive: true }).sort({ order: 1, categoryName: 1 }),
    Product.aggregate([
      { $match: { isActive: true, ...(productSectionClause(section, storeType) || {}) } },
      { $group: { _id: { $arrayElemAt: ["$categories", 0] } } },
    ]),
  ]);
  const stocked = new Set(primaryCategories.map((row) => nameKey(row._id)).filter(Boolean));
  const owned = docs.filter((doc) => resolvedCategorySection(doc) === requested);
  const borrowed = docs.filter(
    (doc) => resolvedCategorySection(doc) !== requested && stocked.has(nameKey(doc.categoryName))
  );
  return [...owned, ...borrowed].map((doc) => (typeof doc.toObject === "function" ? doc.toObject() : doc));
}

/**
 * With a customer location that resolves to a dark store, a department request
 * lists every category in that department. A request without a department stays
 * limited to categories the store actually stocks.
 */
async function loadStoreScopedCategories(query) {
  if (!hasLocationHint(addressFromQuery(query))) return null;

  const catalog = await loadNearestStoreCatalog(query);
  if (!catalog.manager) return null;

  const sectionCategories = await listCategoriesForSection(
    query.section,
    query.storeType,
    query.includeInactive === "true"
  );
  if (sectionCategories) {
    return { categories: sectionCategories, store: catalog.store };
  }

  const products = await Product.find({
    isActive: true,
    $and: [storeProductScope(catalog)],
  })
    .select("categories subcategory subcategories")
    .lean();

  return {
    categories: await categoriesFromProducts(products, query.includeInactive === "true"),
    store: catalog.store,
  };
}

const DEFAULT_CATEGORIES = [
  // --- Preorder Section Categories ---
  {
    categoryName: "Vegetables",
    slug: "Vegetables",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/vegetables.webp",
    itemCount: "150+ items",
    emoji: "🥦",
    bg: "#E2F0D9",
    bgClass: "bg-[#E2F0D9]",
    subcategories: ["Tomato, Onion & Potato", "Leafy Vegetables", "Exotics & Organic", "Cucumber & Capsicum", "Roots & Gourds"],
    storeType: "main",
    order: 1,
    isActive: true,
  },
  {
    categoryName: "Fruits",
    slug: "Fruits",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/fruits.webp",
    itemCount: "120+ items",
    emoji: "🍎",
    bg: "#F0F7ED",
    bgClass: "bg-[#F0F7ED]",
    subcategories: ["Apples & Pears", "Bananas & Mangoes", "Citrus & Oranges", "Berries & Grapes", "Exotic Fruits"],
    storeType: "main",
    order: 2,
    isActive: true,
  },
  {
    categoryName: "Dairy",
    slug: "Dairy",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/dairy.webp",
    itemCount: "80+ items",
    emoji: "🥛",
    bg: "#E8F5E9",
    bgClass: "bg-[#E8F5E9]",
    subcategories: ["Milk & Paneer", "Butter & Cheese", "Curd & Yogurt", "Ghee & Cream"],
    storeType: "main",
    order: 3,
    isActive: true,
  },
  {
    categoryName: "Grains",
    slug: "Grains",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/grains.webp",
    itemCount: "90+ items",
    emoji: "🌾",
    bg: "#E8F5E0",
    bgClass: "bg-[#E8F8E0]",
    subcategories: ["Rice & Basmati", "Wheat & Atta", "Millet & Oats", "Flours & Sooji"],
    storeType: "main",
    order: 4,
    isActive: true,
  },
  {
    categoryName: "Pulses",
    slug: "Pulses",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/pulses.webp",
    itemCount: "70+ items",
    emoji: "🌱",
    bg: "#EAF5DF",
    bgClass: "bg-[#EAF5DF]",
    subcategories: ["Toor & Moong Dal", "Chana & Rajma", "Urad & Masoor", "Organic Pulses"],
    storeType: "main",
    order: 5,
    isActive: true,
  },
  {
    categoryName: "Grocery",
    slug: "Grocery",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/grocery.webp",
    itemCount: "200+ items",
    emoji: "🧂",
    bg: "#EAF5DF",
    bgClass: "bg-[#EAF5DF]",
    subcategories: ["Salt, Sugar & Jaggery", "Poha, Daliya & Vermicelli", "Ready Meals", "Snacks & Namkeen"],
    storeType: "main",
    order: 6,
    isActive: true,
  },
  {
    categoryName: "Oils",
    slug: "Oils",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/oils.webp",
    itemCount: "45+ items",
    emoji: "🫒",
    bg: "#F7F1DC",
    bgClass: "bg-[#F7F1DC]",
    subcategories: ["Mustard & Sunflower Oil", "Groundnut & Sesame", "Olive & Rice Bran", "Cold Pressed Oils"],
    storeType: "main",
    order: 7,
    isActive: true,
  },
  {
    categoryName: "Spices",
    slug: "Spices",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/spices.webp",
    itemCount: "110+ items",
    emoji: "🌶️",
    bg: "#F7F1DC",
    bgClass: "bg-[#F7F1DC]",
    subcategories: ["Whole Spices", "Powdered Spices", "Blended Masalas", "Hing & Herbs"],
    storeType: "main",
    order: 8,
    isActive: true,
  },
  {
    categoryName: "Dry Fruits",
    slug: "Dry Fruits",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/dry-fruits.webp",
    itemCount: "60+ items",
    emoji: "🥜",
    bg: "#F5EDE0",
    bgClass: "bg-[#F5EDE0]",
    subcategories: ["Almonds & Cashews", "Walnuts & Pistachios", "Raisins & Dates", "Seeds & Mixes"],
    storeType: "main",
    order: 9,
    isActive: true,
  },
  {
    categoryName: "Organic",
    slug: "Organic",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/organic.webp",
    itemCount: "55+ items",
    emoji: "🍯",
    bg: "#E8F5DF",
    bgClass: "bg-[#E8F5DF]",
    subcategories: ["Organic Grains", "Organic Honey & Sweeteners", "Certified Vegetables", "Cold Pressed Essentials"],
    storeType: "main",
    order: 10,
    isActive: true,
  },
  {
    categoryName: "Beverages",
    slug: "Beverages",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/beverages.webp",
    itemCount: "85+ items",
    emoji: "🥤",
    bg: "#E8F4FC",
    bgClass: "bg-[#E8F4FC]",
    subcategories: ["Tea & Coffee", "Fruit Juices", "Energy Drinks", "Soft Drinks & Soda"],
    storeType: "main",
    order: 11,
    isActive: true,
  },
  {
    categoryName: "Bakery",
    slug: "Bakery",
    section: "preorder",
    sectionName: "Preorder",
    categoryImage: "/categories/bakery.webp",
    itemCount: "40+ items",
    emoji: "🍞",
    bg: "#F5EBD9",
    bgClass: "bg-[#F5EBD9]",
    subcategories: ["Bread & Pav", "Buns & Croissants", "Cookies & Rusk", "Cakes & Pastries"],
    storeType: "main",
    order: 12,
    isActive: true,
  },

  // --- Ready2Cook Section Categories ---
  {
    categoryName: "Chopped Vegetables",
    slug: "Chopped",
    section: "ready2cook",
    sectionName: "Ready2Cook",
    categoryImage: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cf?auto=format&fit=crop&w=300&h=300&q=80",
    itemCount: "25+ items",
    emoji: "🧅",
    bg: "#E8F8EE",
    bgClass: "bg-[#E8F8EE]",
    subcategories: ["Chopped Onions", "Diced Tomatoes", "Cubed Paneer", "Mixed Veggie Cubes"],
    storeType: "festive",
    order: 1,
    isActive: true,
  },
  {
    categoryName: "Cut & Sliced",
    slug: "Cut & Sliced",
    section: "ready2cook",
    sectionName: "Ready2Cook",
    categoryImage: "https://images.unsplash.com/photo-1598170845058-12ef4a457c39?auto=format&fit=crop&w=300&h=300&q=80",
    itemCount: "30+ items",
    emoji: "🥕",
    bg: "#EEFBEB",
    bgClass: "bg-[#EEFBEB]",
    subcategories: ["Sliced Carrots", "Julienned Bell Peppers", "Sliced Mushrooms", "Cut French Beans"],
    storeType: "festive",
    order: 2,
    isActive: true,
  },
  {
    categoryName: "Peeled & Cleaned",
    slug: "Peeled & Cleaned",
    section: "ready2cook",
    sectionName: "Ready2Cook",
    categoryImage: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=300&h=300&q=80",
    itemCount: "20+ items",
    emoji: "🥔",
    bg: "#EBF7FF",
    bgClass: "bg-[#EBF7FF]",
    subcategories: ["Peeled Garlic", "Peeled Small Onions", "Peeled Potatoes", "Peeled Ginger"],
    storeType: "festive",
    order: 3,
    isActive: true,
  },
  {
    categoryName: "Cleaned Bhaji & Leafy",
    slug: "Cleaned Bhaji",
    section: "ready2cook",
    sectionName: "Ready2Cook",
    categoryImage: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=300&h=300&q=80",
    itemCount: "15+ items",
    emoji: "🌿",
    bg: "#E8F8EE",
    bgClass: "bg-[#E8F8EE]",
    subcategories: ["Cleaned Palak", "Cleaned Methi", "Coriander Bunch", "Mint Leaves"],
    storeType: "festive",
    order: 4,
    isActive: true,
  },
  {
    categoryName: "Veggie & Bhaji Mix",
    slug: "Veggie Mix",
    section: "ready2cook",
    sectionName: "Ready2Cook",
    categoryImage: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&h=300&q=80",
    itemCount: "18+ items",
    emoji: "🥗",
    bg: "#FFF8E7",
    bgClass: "bg-[#FFF8E7]",
    subcategories: ["Pav Bhaji Veg Mix", "Sambar Veg Cut", "Fried Rice Mix", "Soup Mix"],
    storeType: "festive",
    order: 5,
    isActive: true,
  },

  // --- SuperMall Section Categories ---
  {
    categoryName: "SuperMall Packaged Grocery",
    slug: "Packaged Grocery",
    section: "supermall",
    sectionName: "SuperMall",
    categoryImage: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&h=400&q=80",
    itemCount: "500+ items",
    emoji: "🛒",
    bg: "#E8F8EE",
    bgClass: "bg-[#E8F8EE]",
    subcategories: ["Cooking Essentials", "Sauces & Pastes", "Instant Noodles", "Canned Foods"],
    storeType: "mall",
    order: 1,
    isActive: true,
  },
  {
    categoryName: "SuperMall Grains & Cereals",
    slug: "Mall Grains",
    section: "supermall",
    sectionName: "SuperMall",
    categoryImage: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&h=400&q=80",
    itemCount: "120+ items",
    emoji: "🌾",
    bg: "#F0FAF3",
    bgClass: "bg-[#F0FAF3]",
    subcategories: ["Branded Basmati", "Multi-grain Flours", "Oats & Muesli", "Quinoa"],
    storeType: "mall",
    order: 2,
    isActive: true,
  },
  {
    categoryName: "SuperMall Snacks & Munchies",
    slug: "Snacks & Munchies",
    section: "supermall",
    sectionName: "SuperMall",
    categoryImage: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&h=400&q=80",
    itemCount: "200+ items",
    emoji: "🍿",
    bg: "#FFF9EA",
    bgClass: "bg-[#FFF9EA]",
    subcategories: ["Chips & Crisps", "Namkeen & Bhujia", "Biscuits & Cookies", "Chocolates & Sweets"],
    storeType: "mall",
    order: 3,
    isActive: true,
  },
  {
    categoryName: "SuperMall Beverages & Cold Drinks",
    slug: "Mall Beverages",
    section: "supermall",
    sectionName: "SuperMall",
    categoryImage: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&h=400&q=80",
    itemCount: "180+ items",
    emoji: "🧃",
    bg: "#EBF7FF",
    bgClass: "bg-[#EBF7FF]",
    subcategories: ["Cold Drinks", "Fruit Juices", "Premium Teas", "Artisanal Coffee"],
    storeType: "mall",
    order: 4,
    isActive: true,
  },
];

const normalizeSubcategories = (subcategories) => {
  if (!subcategories) return [];
  if (Array.isArray(subcategories)) {
    return subcategories
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof subcategories === "string") {
    return subcategories
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

/**
 * Auto-seed default categories if the database collection is empty or missing section categories
 */
export async function seedDefaultCategoriesIfEmpty() {
  try {
    // Migration: Update all existing categories with legacy section "greengrocc" or "GreenGrocc" to "preorder" / "Preorder"
    await Category.updateMany(
      { $or: [{ section: "greengrocc" }, { sectionName: "GreenGrocc" }, { sectionName: "greengrocc" }] },
      { $set: { section: "preorder", sectionName: "Preorder" } }
    );

    const existing = await Category.find();

    const sectionLabel = (section) =>
      section === "ready2cook" ? "Ready2Cook" : section === "instantorder" ? "InstantOrder" : "PreOrder";
    const sectionStore = (section) =>
      section === "ready2cook" ? "festive" : section === "instantorder" ? "mall" : "main";

    // Keep each known category in its own section. Do not recreate categories that were removed.
    for (const cat of existing) {
      const byName = CATEGORY_SECTION_BY_NAME[nameKey(cat.categoryName)];
      const target =
        byName ||
        (cat.storeType === "festive"
          ? "ready2cook"
          : cat.storeType === "mall"
            ? "instantorder"
            : canonicalSection(cat.section) || "preorder");
      const label = sectionLabel(target);
      const store = sectionStore(target);
      let needsSave = false;
      if (cat.section !== target) {
        cat.section = target;
        needsSave = true;
      }
      if (cat.sectionName !== label) {
        cat.sectionName = label;
        needsSave = true;
      }
      if (cat.storeType !== store) {
        cat.storeType = store;
        needsSave = true;
      }
      if (needsSave) await cat.save();
    }

    if (existing.length === 0) {
      console.log(`[CategoryService] Seeding ${DEFAULT_CATEGORIES.length} default categories...`);
      await Category.insertMany(DEFAULT_CATEGORIES);
      console.log(`[CategoryService] Successfully seeded categories.`);
    }
  } catch (error) {
    console.error("[CategoryService] Failed to seed default categories:", error.message); console.error("[CategoryService] Failed to seed default categories:", error.message);
  }
}

/**
 * GET /api/categories
 * Returns all active categories sorted by order and name, optional filter by section
 */
export const getCategories = async (req, res) => {
  try {
    const scoped = await loadStoreScopedCategories(req.query);
    if (scoped) {
      return res.status(200).json({
        success: true,
        count: scoped.categories.length,
        data: scoped.categories,
        store: scoped.store,
      });
    }

    const requestedSection = String(req.query.section || req.query.storeType || "").trim();
    if (requestedSection && requestedSection.toLowerCase() !== "all") {
      const categories = await listCategoriesForSection(
        req.query.section,
        req.query.storeType,
        req.query.includeInactive === "true"
      );
      if (categories) {
        return res.status(200).json({
          success: true,
          count: categories.length,
          data: categories,
        });
      }
    }

    const { includeInactive, section, storeType } = req.query;
    const filter = {};

    if (includeInactive !== "true") {
      filter.isActive = true;
    }

    // Section filtering (support section slug, section name, or storeType)
    const targetSection = (section || "").trim().toLowerCase();
    if (targetSection && targetSection !== "all") {
      if (targetSection === "preorder" || targetSection === "main" || targetSection === "greengrocc") {
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
        filter.section = new RegExp(`^${targetSection}$`, "i");
      }
    } else if (storeType && storeType !== "all") {
      const sType = storeType.trim().toLowerCase();
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

    const categories = await Category.find(filter).sort({
      order: 1,
      categoryName: 1,
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/categories/all (Admin endpoint with search, section filter, and pagination)
 */
export const getAllCategories = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search?.trim()) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      filter.$or = [
        { categoryName: searchRegex },
        { slug: searchRegex },
        { section: searchRegex },
        { sectionName: searchRegex },
        { subcategories: searchRegex },
      ];
    }

    if (req.query.section && req.query.section !== "all") {
      const targetSec = req.query.section.trim().toLowerCase();
      if (targetSec === "preorder" || targetSec === "greengrocc" || targetSec === "main") {
        filter.$and = filter.$and || [];
        filter.$and.push({
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
        filter.section = new RegExp(`^${targetSec}$`, "i");
      }
    }

    if (req.query.status === "active") {
      filter.isActive = true;
    } else if (req.query.status === "inactive") {
      filter.isActive = false;
    }

    const [total, categories] = await Promise.all([
      Category.countDocuments(filter),
      Category.find(filter)
        .sort({ order: 1, categoryName: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      data: categories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/categories/:id
 */
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    res.status(200).json({ success: true, data: transformCategoryResponse(category) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/categories
 * Creates a new category with section association
 */
export const createCategory = async (req, res) => {
  try {
    const {
      categoryName,
      slug,
      section,
      sectionName,
      categoryImage,
      itemCount,
      emoji,
      bg,
      bgClass,
      subcategories,
      storeType,
      order,
      isActive,
    } = req.body;

    if (!categoryName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const trimmedName = categoryName.trim();
    const finalSlug = slug?.trim() || trimmedName;

    // Check if category already exists
    const existing = await Category.findOne({
      $or: [
        { categoryName: new RegExp(`^${trimmedName}$`, "i") },
        { slug: new RegExp(`^${finalSlug}$`, "i") },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Category "${trimmedName}" already exists`,
      });
    }

    // Determine section name if not supplied
    let resolvedSection = (section?.trim() || "preorder").toLowerCase();
    if (resolvedSection === "greengrocc") resolvedSection = "preorder";
    let resolvedSectionName = sectionName?.trim();

    if (!resolvedSectionName || resolvedSectionName === "GreenGrocc") {
      const parentSection = await Section.findOne({ slug: resolvedSection });
      resolvedSectionName = parentSection ? parentSection.sectionName : (
        resolvedSection === "ready2cook" ? "Ready2Cook" :
          resolvedSection === "instantorder" || resolvedSection === "supermall" ? "Instant Order" : "Preorder"
      );
    }

    const category = await Category.create({
      categoryName: trimmedName,
      slug: finalSlug,
      section: resolvedSection,
      sectionName: resolvedSectionName,
      categoryImage: categoryImage?.trim() || "",
      itemCount: itemCount?.trim() || "0+ items",
      emoji: emoji?.trim() || "🛒",
      bg: bg?.trim() || "#E8F5E9",
      bgClass: bgClass?.trim() || "",
      subcategories: normalizeSubcategories(subcategories),
      storeType: storeType?.trim() || (resolvedSection === "ready2cook" ? "festive" : resolvedSection === "supermall" ? "mall" : "main"),
      order: typeof order === "number" ? order : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category name or slug already exists",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/categories/:id
 * Updates an existing category
 */
export const updateCategory = async (req, res) => {
  try {
    const {
      categoryName,
      slug,
      section,
      sectionName,
      categoryImage,
      itemCount,
      emoji,
      bg,
      bgClass,
      subcategories,
      storeType,
      order,
      isActive,
    } = req.body;

    const updates = {};

    if (categoryName !== undefined) {
      if (!categoryName?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name cannot be empty",
        });
      }
      updates.categoryName = categoryName.trim();
      if (!slug) {
        updates.slug = categoryName.trim();
      }
    }

    if (slug !== undefined) updates.slug = slug.trim();

    if (section !== undefined) {
      updates.section = section.trim().toLowerCase();
      if (!sectionName) {
        const parentSection = await Section.findOne({ slug: updates.section });
        updates.sectionName = parentSection ? parentSection.sectionName : (
          updates.section === "ready2cook" ? "Ready2Cook" :
            updates.section === "supermall" ? "SuperMall" : "GreenGrocc"
        );
      }
    }

    if (sectionName !== undefined) updates.sectionName = sectionName.trim();
    if (categoryImage !== undefined) updates.categoryImage = categoryImage.trim();
    if (itemCount !== undefined) updates.itemCount = itemCount.trim();
    if (emoji !== undefined) updates.emoji = emoji.trim();
    if (bg !== undefined) updates.bg = bg.trim();
    if (bgClass !== undefined) updates.bgClass = bgClass.trim();
    if (subcategories !== undefined) updates.subcategories = normalizeSubcategories(subcategories);
    if (storeType !== undefined) updates.storeType = storeType.trim();
    if (order !== undefined) updates.order = Number(order) || 0;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const category = await Category.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category name already exists",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/categories/:id
 * Deletes a category
 */
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Category "${category.categoryName}" deleted successfully`,
      data: { id: req.params.id, categoryName: category.categoryName },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/categories/seed
 * Resets / re-seeds default categories
 */
export const seedCategories = async (_req, res) => {
  try {
    const existing = await Category.find();
    const existingNames = new Set(existing.map((c) => c.categoryName.toLowerCase()));

    const toInsert = DEFAULT_CATEGORIES.filter(
      (c) => !existingNames.has(c.categoryName.toLowerCase())
    );

    if (toInsert.length > 0) {
      await Category.insertMany(toInsert);
    }

    const all = await Category.find().sort({ order: 1, categoryName: 1 });
    res.status(200).json({
      success: true,
      message: `Seeded ${toInsert.length} new categories`,
      data: all,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
