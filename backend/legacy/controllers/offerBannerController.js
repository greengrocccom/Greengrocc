import OfferBanner from "../models/OfferBanner.js";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination.js";
import { transformBannerResponse } from "../utils/urlResolver.js";

const normalizeDevice = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "mobile" || normalized === "phone") return "mobile";
  return "desktop";
};

const buildDeviceFilter = (device) => {
  if (device === "mobile") {
    return { device: "mobile" };
  }
  return { $or: [{ device: "desktop" }, { device: { $exists: false } }] };
};

export const getOfferBanners = async (req, res) => {
  try {
    const device = req.query.device === "mobile" ? "mobile" : "desktop";
    const banners = await OfferBanner.find({
      isActive: true,
      ...buildDeviceFilter(device),
    }).sort({
      order: 1,
      createdAt: -1,
    });

    res.status(200).json({ success: true, data: banners.map(transformBannerResponse) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllOfferBanners = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const device = req.query.device;
    const filter = {};

    if (device === "mobile") {
      filter.device = "mobile";
    } else if (device === "desktop") {
      Object.assign(filter, buildDeviceFilter("desktop"));
    }

    const [total, banners] = await Promise.all([
      OfferBanner.countDocuments(filter),
      OfferBanner.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit),
    ]);

    res.status(200).json(buildPaginatedResponse(banners.map(transformBannerResponse), total, page, limit));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addOfferBanner = async (req, res) => {
  try {
    const { imageUrl, title, titleHighlight, subtitle, linkUrl, alt, order, isActive, device } =
      req.body;

    if (!imageUrl?.trim()) {
      return res.status(400).json({ success: false, message: "Image URL is required" });
    }

    const bannerDevice = normalizeDevice(
      req.body.bannerFor ?? device ?? req.query.device ?? "mobile"
    );

    const banner = await OfferBanner.create({
      imageUrl: imageUrl.trim(),
      title: title?.trim() || undefined,
      titleHighlight: titleHighlight?.trim() || undefined,
      subtitle: subtitle?.trim() || undefined,
      linkUrl: linkUrl?.trim() || "",
      alt: alt?.trim() || "GreenGrocc offer banner",
      order: order ?? 0,
      isActive: isActive ?? true,
      device: bannerDevice,
    });

    res.status(201).json({ success: true, data: transformBannerResponse(banner) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOfferBanner = async (req, res) => {
  try {
    const { device, imageUrl, title, titleHighlight, subtitle, linkUrl, alt, order, isActive } =
      req.body;
    const updates = {};

    const nextDevice = req.body.bannerFor ?? device ?? req.query.device;
    if (nextDevice !== undefined) {
      updates.device = normalizeDevice(nextDevice);
    }
    if (imageUrl !== undefined) updates.imageUrl = imageUrl.trim();
    if (title !== undefined) updates.title = title.trim();
    if (titleHighlight !== undefined) updates.titleHighlight = titleHighlight.trim();
    if (subtitle !== undefined) updates.subtitle = subtitle.trim();
    if (linkUrl !== undefined) updates.linkUrl = linkUrl.trim();
    if (alt !== undefined) updates.alt = alt.trim();
    if (order !== undefined) updates.order = order;
    if (isActive !== undefined) updates.isActive = isActive;

    const banner = await OfferBanner.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!banner) {
      return res.status(404).json({ success: false, message: "Offer banner not found" });
    }

    res.status(200).json({ success: true, data: transformBannerResponse(banner) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteOfferBanner = async (req, res) => {
  try {
    const banner = await OfferBanner.findByIdAndDelete(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: "Offer banner not found" });
    }

    res.status(200).json({ success: true, message: "Offer banner deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
