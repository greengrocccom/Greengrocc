import Brand from "../models/Brand.js";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination.js";
import { transformBrandResponse } from "../utils/urlResolver.js";

export const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ isActive: true }).sort({
      order: 1,
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: brands.map(transformBrandResponse) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllBrands = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const filter = {};
    const [total, brands] = await Promise.all([
      Brand.countDocuments(filter),
      Brand.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit),
    ]);

    res.status(200).json(buildPaginatedResponse(brands.map(transformBrandResponse), total, page, limit));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }
    res.status(200).json({ success: true, data: transformBrandResponse(brand) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addBrand = async (req, res) => {
  try {
    const { brandName, brandImage, order, isActive, priceRequiresLogin } = req.body;

    if (!brandName?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Brand name is required" });
    }
    if (!brandImage?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Brand image is required" });
    }

    const brand = await Brand.create({
      brandName: brandName.trim(),
      brandImage: brandImage.trim(),
      order: order ?? 0,
      isActive: isActive ?? true,
      priceRequiresLogin: Boolean(priceRequiresLogin),
    });

    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "Brand name already exists" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBrand = async (req, res) => {
  try {
    const { brandName, brandImage, order, isActive, priceRequiresLogin } = req.body;
    const updates = {};

    if (brandName !== undefined) updates.brandName = brandName.trim();
    if (brandImage !== undefined) updates.brandImage = brandImage.trim();
    if (order !== undefined) updates.order = order;
    if (isActive !== undefined) updates.isActive = isActive;
    if (priceRequiresLogin !== undefined) {
      updates.priceRequiresLogin = Boolean(priceRequiresLogin);
    }

    const brand = await Brand.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    res.status(200).json({ success: true, data: transformBrandResponse(brand) });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "Brand name already exists" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    res.status(200).json({ success: true, message: "Brand deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
