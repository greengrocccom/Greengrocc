import { configuredCdnBase, publicImageUrl } from './imageUrlConfig.js';
import { bundledSiteImageUrl } from './bundledSiteImages.js';

export const resolveImageUrl = (imageKey) => {
  if (!imageKey || typeof imageKey !== "string") return null;

  const cleanKey = imageKey.trim();
  if (!cleanKey) return null;
  const siteImage = bundledSiteImageUrl(cleanKey);
  if (siteImage) return siteImage;
  if (/^https?:\/\//i.test(cleanKey)) {
    try {
      const url = new URL(cleanKey);
      const s3Host = /\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname);
      // An explicitly configured CDN serves copied S3 object keys. Preserve
      // signed/versioned URLs and external URLs, whose origins are authoritative.
      if (s3Host && configuredCdnBase() && !url.search) return publicImageUrl(url.pathname);
      return cleanKey;
    } catch { return null; }
  }
  if (/^data:image\//i.test(cleanKey)) return cleanKey;
  return publicImageUrl(cleanKey);
};

export const resolveImageArray = (images) => {
  if (!Array.isArray(images)) return [];
  return images.map(resolveImageUrl).filter(Boolean);
};

export const transformProductResponse = (product) => {
  if (!product) return product;
  const isMongoose = typeof product.toObject === 'function';
  const data = isMongoose ? product.toObject() : { ...product };

  data.productId = data.productId || data.sku || "";

  if (data.productImages) {
    data.productImages = resolveImageArray(data.productImages);
  }
  if (data.baseProductImage) data.baseProductImage = resolveImageUrl(data.baseProductImage);
  if (data.image) data.image = resolveImageUrl(data.image);
  if (Array.isArray(data.variants)) {
    data.variants = data.variants.map(variant => ({ ...variant, ...(variant.image ? { image: resolveImageUrl(variant.image) } : {}) }));
  }
  if (data.farmerImage) {
    data.farmerImage = resolveImageUrl(data.farmerImage);
  }
  if (data.farmImage) {
    data.farmImage = resolveImageUrl(data.farmImage);
  }
  if (data.farmerDetails) {
    data.farmerDetails = { ...data.farmerDetails };
    if (data.farmerDetails.farmerImage) {
      data.farmerDetails.farmerImage = resolveImageUrl(data.farmerDetails.farmerImage);
    }
    if (data.farmerDetails.farmImage) {
      data.farmerDetails.farmImage = resolveImageUrl(data.farmerDetails.farmImage);
    }
  }
  return data;
};

export const transformCategoryResponse = (category) => {
  if (!category) return category;
  const isMongoose = typeof category.toObject === 'function';
  const data = isMongoose ? category.toObject() : { ...category };
  if (data.image) {
    data.image = resolveImageUrl(data.image);
  }
  if (data.imageUrl) {
    data.imageUrl = resolveImageUrl(data.imageUrl);
  }
  if (data.categoryImage) {
    data.categoryImage = resolveImageUrl(data.categoryImage);
  }
  if (data.coverImage) {
    data.coverImage = resolveImageUrl(data.coverImage);
  }
  return data;
};

export const transformBannerResponse = (banner) => {
  if (!banner) return banner;
  const isMongoose = typeof banner.toObject === 'function';
  const data = isMongoose ? banner.toObject() : { ...banner };
  if (data.image) {
    data.image = resolveImageUrl(data.image);
  }
  return data;
};

export const transformBrandResponse = (brand) => {
  if (!brand) return brand;
  const isMongoose = typeof brand.toObject === 'function';
  const data = isMongoose ? brand.toObject() : { ...brand };
  if (data.logo) {
    data.logo = resolveImageUrl(data.logo);
  }
  if (data.brandImage) {
    data.brandImage = resolveImageUrl(data.brandImage);
  }
  return data;
};
