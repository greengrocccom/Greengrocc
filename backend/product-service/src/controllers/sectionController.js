import Section from "../models/Section.js";
import Category from "../models/Category.js";

export const DEFAULT_SECTIONS = [
  {
    sectionName: "Preorder",
    slug: "preorder",
    description: "All products & categories available for preorder",
    emoji: "🛒",
    badge: "Preorder",
    color: "#10B981",
    order: 1,
    isActive: true,
  },
  {
    sectionName: "Ready2Cook",
    slug: "ready2cook",
    description: "Pre-cut, peeled & sliced vegetables & meal kits for fast cooking",
    emoji: "🍳",
    badge: "Ready 2 Cook",
    color: "#EA580C",
    order: 2,
    isActive: true,
  },
  {
    sectionName: "Instant Order",
    slug: "instantorder",
    description: "Instant delivery from SuperMall & Dark Stores",
    emoji: "⚡",
    badge: "Instant Order",
    color: "#2563EB",
    order: 3,
    isActive: true,
  },
];

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Auto-seed default sections if the database collection is empty
 */
export async function seedDefaultSectionsIfEmpty() {
  try {
    // Migration: update existing section with slug "greengrocc" to "preorder"
    await Section.updateMany(
      { slug: "greengrocc" },
      { $set: { slug: "preorder", sectionName: "Preorder" } }
    );
    await Section.updateMany(
      { slug: "supermall" },
      { $set: { slug: "instantorder", sectionName: "Instant Order" } }
    );

    const count = await Section.countDocuments();
    if (count === 0) {
      console.log("[SectionService] Seeding default sections...");
      await Section.insertMany(DEFAULT_SECTIONS);
      console.log(`[SectionService] Successfully seeded ${DEFAULT_SECTIONS.length} default sections`);
    } else {
      for (const defSec of DEFAULT_SECTIONS) {
        const exists = await Section.findOne({ slug: defSec.slug });
        if (!exists) {
          await Section.create(defSec);
        }
      }
    }
  } catch (error) {
    console.error("[SectionService] Failed to seed default sections:", error.message);
  }
}

/**
 * GET /api/sections
 * Returns active sections with category counts
 */
export const getSections = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const filter = {};

    if (includeInactive !== "true") {
      filter.isActive = true;
    }

    const sections = await Section.find(filter).sort({ order: 1, sectionName: 1 });

    // Aggregate category counts per section
    const categoryCounts = await Category.aggregate([
      { $match: { isActive: { $ne: false } } },
      { $group: { _id: { $toLower: { $ifNull: ["$section", "preorder"] } }, count: { $sum: 1 } } },
    ]);

    const countMap = {};
    categoryCounts.forEach((item) => {
      if (item._id) countMap[item._id] = item.count;
    });
    countMap["preorder"] = (countMap["preorder"] || 0) + (countMap["greengrocc"] || 0);

    const sectionsWithCounts = sections.map((sec) => {
      const secObj = sec.toObject();
      const secSlug = (sec.slug || "").toLowerCase();
      secObj.categoryCount = countMap[secSlug] || 0;
      return secObj;
    });

    res.status(200).json({
      success: true,
      count: sectionsWithCounts.length,
      data: sectionsWithCounts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/sections/all (Admin endpoint with search, pagination, and category count)
 */
export const getAllSections = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search?.trim()) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      filter.$or = [
        { sectionName: searchRegex },
        { slug: searchRegex },
        { description: searchRegex },
      ];
    }

    if (req.query.status === "active") {
      filter.isActive = true;
    } else if (req.query.status === "inactive") {
      filter.isActive = false;
    }

    const [total, sections, categoryCounts] = await Promise.all([
      Section.countDocuments(filter),
      Section.find(filter)
        .sort({ order: 1, sectionName: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Category.aggregate([
        { $match: { isActive: { $ne: false } } },
        { $group: { _id: { $toLower: { $ifNull: ["$section", "preorder"] } }, count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = {};
    categoryCounts.forEach((item) => {
      if (item._id) countMap[item._id] = item.count;
    });
    countMap["preorder"] = (countMap["preorder"] || 0) + (countMap["greengrocc"] || 0);

    const sectionsWithCounts = sections.map((sec) => {
      const secObj = sec.toObject();
      const secSlug = (sec.slug || "").toLowerCase();
      secObj.categoryCount = countMap[secSlug] || 0;
      return secObj;
    });

    res.status(200).json({
      success: true,
      data: sectionsWithCounts,
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
 * GET /api/sections/:id
 */
export const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    let section = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      section = await Section.findById(id);
    }
    if (!section) {
      section = await Section.findOne({ slug: id.toLowerCase() });
    }

    if (!section) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }

    const categoryCount = await Category.countDocuments({
      section: new RegExp(`^${section.slug}$`, "i"),
    });

    const secObj = section.toObject();
    secObj.categoryCount = categoryCount;

    res.status(200).json({ success: true, data: secObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/sections
 * Creates a new section
 */
export const createSection = async (req, res) => {
  try {
    const {
      sectionName,
      slug,
      description,
      emoji,
      badge,
      color,
      order,
      isActive,
    } = req.body;

    if (!sectionName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Section name is required",
      });
    }

    const trimmedName = sectionName.trim();
    const finalSlug = (slug?.trim() || generateSlug(trimmedName)).toLowerCase();

    // Check if section already exists
    const existing = await Section.findOne({
      $or: [
        { sectionName: new RegExp(`^${trimmedName}$`, "i") },
        { slug: finalSlug },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Section "${trimmedName}" or slug "${finalSlug}" already exists`,
      });
    }

    const section = await Section.create({
      sectionName: trimmedName,
      slug: finalSlug,
      description: description?.trim() || "",
      emoji: emoji?.trim() || "🌿",
      badge: badge?.trim() || "",
      color: color?.trim() || "#10B981",
      order: typeof order === "number" ? order : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.status(201).json({
      success: true,
      message: "Section created successfully",
      data: section,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Section name or slug already exists",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/sections/:id
 * Updates an existing section
 */
export const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sectionName,
      slug,
      description,
      emoji,
      badge,
      color,
      order,
      isActive,
    } = req.body;

    const updates = {};

    let oldSection = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      oldSection = await Section.findById(id);
    } else {
      oldSection = await Section.findOne({ slug: id.toLowerCase() });
    }

    if (!oldSection) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    if (sectionName !== undefined) {
      if (!sectionName?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Section name cannot be empty",
        });
      }
      updates.sectionName = sectionName.trim();
    }

    if (slug !== undefined && slug.trim()) {
      updates.slug = generateSlug(slug.trim());
    }

    if (description !== undefined) updates.description = description.trim();
    if (emoji !== undefined) updates.emoji = emoji.trim();
    if (badge !== undefined) updates.badge = badge.trim();
    if (color !== undefined) updates.color = color.trim();
    if (order !== undefined) updates.order = Number(order) || 0;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const section = await Section.findByIdAndUpdate(oldSection._id, updates, {
      returnDocument: 'after',
      runValidators: true,
    });

    // If slug or name changed, update linked categories' section fields
    if (
      (updates.slug && updates.slug !== oldSection.slug) ||
      (updates.sectionName && updates.sectionName !== oldSection.sectionName)
    ) {
      await Category.updateMany(
        { section: oldSection.slug },
        {
          $set: {
            section: updates.slug || oldSection.slug,
            sectionName: updates.sectionName || oldSection.sectionName,
          },
        }
      );
    }

    res.status(200).json({
      success: true,
      message: "Section updated successfully",
      data: section,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Section name or slug already exists",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/sections/:id
 * Deletes a section
 */
export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    let section = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      section = await Section.findById(id);
    } else {
      section = await Section.findOne({ slug: id.toLowerCase() });
    }

    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    const linkedCategoriesCount = await Category.countDocuments({
      section: new RegExp(`^${section.slug}$`, "i"),
    });

    await Section.findByIdAndDelete(section._id);

    res.status(200).json({
      success: true,
      message: `Section "${section.sectionName}" deleted successfully`,
      data: {
        id: section._id,
        sectionName: section.sectionName,
        slug: section.slug,
        linkedCategoriesCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/sections/seed
 * Resets / re-seeds default sections
 */
export const seedSections = async (_req, res) => {
  try {
    const existing = await Section.find();
    const existingSlugs = new Set(existing.map((s) => s.slug.toLowerCase()));

    const toInsert = DEFAULT_SECTIONS.filter(
      (s) => !existingSlugs.has(s.slug.toLowerCase())
    );

    if (toInsert.length > 0) {
      await Section.insertMany(toInsert);
    }

    const all = await Section.find().sort({ order: 1, sectionName: 1 });
    res.status(200).json({
      success: true,
      message: `Seeded ${toInsert.length} new sections`,
      data: all,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
