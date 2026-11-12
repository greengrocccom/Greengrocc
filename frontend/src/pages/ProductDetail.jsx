import { useEffect, useMemo, useState } from "react";
import { addRecentlyViewed } from "../utils/recentlyViewed";
import { addCategoryVisit } from "../utils/categoryVisits";
import { Link, useNavigate, useParams } from "react-router-dom";
import { buildApiUrl, getProductById, getProductReviews, getProductVarieties } from "../api/api";
import { translateUnitToMarathi } from "../utils/productLocalization";
import { formatProduceDate } from "../utils/produceDates";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import WishlistButton from "../components/product/WishlistButton";
import ProductPriceDisplay from "../components/product/ProductPriceDisplay";
import { useCanViewProductPrice } from "../hooks/useCanViewProductPrice";
import {
  buildBulkGradeVariantName,
  getAvailableBulkGrades,
  getAvailableColors,
  getBulkTierRows,
  getMinOrderQuantity,
  getMaxOrderQuantity,
  getCartAdjustStep,
  hasConfiguredMaxOrderQuantity,
  hasConfiguredQuantityStep,
  getUnitPriceForQuantity,
  getVariantStock,
  getProductListPriceInfo,
  isBulkPricing,
  isMultiVariant,
} from "../utils/productPricing";
import {
  getDecreasedCartQuantityForProduct,
} from "../utils/cartDefaults";
import ProductImageFrame from "../components/product/ProductImageFrame";
import ProductVideo from "../components/product/ProductVideo";
import ProductDescriptionContent from "../components/product/ProductDescriptionContent";
import SimilarProducts from "../components/product/SimilarProducts";
import ProductReviews from "../components/product/ProductReviews";
import ProductFarmerTraceabilitySection from "../components/product/ProductFarmerTraceabilitySection";
import WhatMakesUsDifferent from "../components/home/WhatMakesUsDifferent";
import { normalizeProductImages } from "../utils/productImage";
import ProductShareMenu from "../components/product/ProductShareMenu";
import ProductAdminShareMenu from "../components/product/ProductAdminShareMenu";
import { updateProductShareMeta } from "../utils/productShare";
import { tryOpenProductInApp } from "../utils/openMobileApp";
import { onCatalogEvent } from "../realtime/useCatalogSync";
import { getDummyProductById } from "../data/dummyCategoryProducts";
import { getProductDisplayDetails } from "../utils/productLocalization";
import { catalogUrls } from "../components/product/CatalogFlow";
import { buildStoreProductUrl, sectionToStoreKey } from "../utils/storeSection";
import { baseGroupKey } from "../utils/baseProducts";
import OptimizedImg from "../components/common/OptimizedImg";

const DEFAULT_MOQ = 1;
const REVIEW_COUNT = 128;

const formatPrice = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

function productSku(product) {
  if (product.sku?.trim()) {
    return product.sku.trim().toUpperCase();
  }
  const code = (product.subcategory || product.brandName || "SKU")
    .replace(/\s+/g, "-")
    .toUpperCase();
  return `BMM-${code}`;
}

function ProductSkuRow({ product }) {
  const [copied, setCopied] = useState(false);
  const sku = productSku(product);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sku);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <p className="text-sm text-text-secondary">
        SKU: <span className="font-medium text-text-primary">{sku}</span>
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1 rounded-md border border-border-light px-2 py-0.5 text-xs font-medium text-text-secondary transition hover:border-primary/40 hover:text-primary"
        aria-label="Copy SKU"
      >
        {copied ? (
          "Copied"
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  );
}

function getImageExtension(url) {
  const match = url?.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i);
  return match ? match[1].toLowerCase() : "jpg";
}

function getMimeType(ext) {
  const types = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return types[ext] || "image/jpeg";
}

function buildImageFilename(productName, imageUrl, imageIndex) {
  const ext = getImageExtension(imageUrl);
  const safeName = (productName || "product")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  return `${safeName || "product"}-${imageIndex + 1}.${ext}`;
}

function getResolvedSpecifications(product) {
  if (Array.isArray(product?.specifications) && product.specifications.length > 0) {
    return product.specifications.filter(
      (spec) => spec?.name && spec?.value && !/subcategor/i.test(spec.name)
    );
  }

  const fallback = [];
  if (product?.brandName) fallback.push({ name: "Brand", value: product.brandName });
  if (product?.categories?.[0]) fallback.push({ name: "Category", value: product.categories[0] });
  if (product?.warranty) fallback.push({ name: "Warranty", value: product.warranty });
  if (Array.isArray(product?.features)) {
    product.features.forEach((feature, index) => {
      if (feature?.trim()) {
        fallback.push({ name: `Feature ${index + 1}`, value: feature.trim() });
      }
    });
  }
  return fallback;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function buildProxyDownloadUrl(imageUrl, filename) {
  const params = new URLSearchParams({
    url: imageUrl,
    filename,
  });
  return buildApiUrl(`/api/proxy/image/download?${params.toString()}`);
}

function triggerBlobDownload(blob, filename, mimeType) {
  const objectUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function downloadProductImage(imageUrl, productName, imageIndex) {
  if (!imageUrl) return false;

  const filename = buildImageFilename(productName, imageUrl, imageIndex);
  const blob = await fetchImageBlob(imageUrl);

  if (!blob) {
    try {
      const response = await fetch(buildProxyDownloadUrl(imageUrl, filename));
      if (response.ok) {
        const fallbackBlob = await response.blob();
        triggerBlobDownload(
          fallbackBlob,
          filename,
          getMimeType(getImageExtension(imageUrl))
        );
        return true;
      }
    } catch {
      // fall through to direct navigation download
    }

    window.location.assign(buildProxyDownloadUrl(imageUrl, filename));
    return true;
  }

  const ext = getImageExtension(imageUrl);
  const mimeType = blob.type?.startsWith("image/") ? blob.type : getMimeType(ext);
  const file = new File([blob], filename, { type: mimeType });

  if (isMobileDevice() && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
    }
  }

  if (isMobileDevice()) {
    window.location.assign(buildProxyDownloadUrl(imageUrl, filename));
    return true;
  }

  triggerBlobDownload(blob, filename, mimeType);
  return true;
}

async function fetchImageBlob(imageUrl) {
  if (!imageUrl) return null;

  try {
    const proxyResponse = await fetch(
      buildApiUrl(`/api/proxy/image?url=${encodeURIComponent(imageUrl)}`)
    );
    if (proxyResponse.ok) {
      return await proxyResponse.blob();
    }
  } catch {
    // fall through to direct fetch
  }

  try {
    const directResponse = await fetch(imageUrl);
    if (!directResponse.ok) return null;
    return await directResponse.blob();
  } catch {
    return null;
  }
}

function DownloadIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
      />
    </svg>
  );
}

function StarRating({ rating, reviewCount }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 text-primary" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`h-4 w-4 ${star <= Math.floor(rating) ? "fill-current" : "fill-none"}`}
            viewBox="0 0 20 20"
            stroke="currentColor"
            strokeWidth={1.2}
          >
            <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.9l-4.94 2.81.94-5.5-4-3.9 5.53-.8L10 1.5z" />
          </svg>
        ))}
      </div>
      <span className="text-sm text-text-secondary">
        {rating.toFixed(1)} ({reviewCount})
      </span>
    </div>
  );
}

function ProductImage({ src, alt }) {
  return (
    <ProductImageFrame
      src={src}
      alt={alt}
      fit="contain"
      className="max-h-[min(70vh,520px)]"
    />
  );
}

const TABS = [
  { id: "description", label: "Description" },
  { id: "specifications", label: "Specifications" },
  { id: "reviews", label: "Reviews" },
  { id: "shipping", label: "Shipping & Delivery", shortLabel: "Shipping" },
];

function MediaThumbnailCarousel({ items, activeIndex, onSelect }) {
  if (items.length <= 1) return null;

  const canNext = activeIndex < items.length - 1;

  return (
    <div className="relative flex items-center gap-2">
      <div className="hide-scrollbar flex min-w-0 flex-1 gap-2.5 overflow-x-auto py-0.5">
        {items.map((item, index) => (
          <button
            key={`${item.type}-${item.url}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            aria-label={
              item.type === "video"
                ? "View product video"
                : `View image ${index} of ${items.length}`
            }
            aria-current={activeIndex === index ? "true" : undefined}
            className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border bg-white ${
              activeIndex === index ? "border-[#0C831F]" : "border-[#E5E5E5]"
            }`}
          >
            {item.type === "video" ? (
              <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-white">
                <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            ) : (
              <OptimizedImg
                src={item.url}
                alt=""
                className="h-full w-full object-contain p-1"
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>
      {canNext ? (
        <button
          type="button"
          onClick={() => onSelect(Math.min(items.length - 1, activeIndex + 1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#1a1a1a] shadow-sm"
          aria-label="Next image"
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

function WhyShopFromGreenGrocc() {
  const points = [
    {
      title: "Round The Clock Delivery",
      text: "Get items delivered to your doorstep from stores near you, whenever you need them.",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v8H3V7zm11 3h3l3 3v2h-6v-5z" />
        </svg>
      ),
    },
    {
      title: "Best Prices & Offers",
      text: "Best price destination with offers directly from trusted suppliers.",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 7h5a3 3 0 010 6H8m0 0h6a3 3 0 010 6H8" />
        </svg>
      ),
    },
    {
      title: "Wide Assortment",
      text: "Choose from fresh fruits, veggies, dairy, organic staples and more.",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      ),
    },
  ];

  return (
    <section>
      <h2 className="text-[15px] font-bold text-slate-900 sm:text-base">Why shop from GreenGrocc?</h2>
      <ul className="mt-3 space-y-3">
        {points.map((point) => (
          <li
            key={point.title}
            className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              {point.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-900">{point.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{point.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function hasText(value) {
  return Boolean(String(value || "").trim());
}

function FarmerDetailsCard({ product }) {
  if (product?.showFarmerTraceability === false) return null;
  const name = String(product?.farmerName || product?.farmerDetails?.name || "").trim();
  const location = String(product?.farmerLocation || product?.farmerDetails?.location || "").trim();
  const farmerImage = String(product?.farmerImage || product?.farmerDetails?.farmerImage || "").trim();
  const farmImage = String(product?.farmImage || product?.farmerDetails?.farmImage || "").trim();
  const harvestingDate = formatProduceDate(
    product?.harvestingDate || product?.farmerDetails?.harvestingDate
  );
  const details = product?.farmerDetails || {};

  const rows = [
    { label: "Total Area", value: details.totalArea },
    { label: "Area Under Cultivation", value: details.cultivationArea },
    { label: "Crop Cycle", value: details.cropCycle },
    { label: "Agriculture Method", value: details.agricultureMethod },
    { label: "Last Crop Taken", value: details.lastCropTaken },
    { label: "Current Crop", value: details.currentCrop },
    { label: "Water Source", value: details.waterSource },
    { label: "Soil Type", value: details.soilType },
    { label: "Farm Tools", value: details.farmTools },
    { label: "Harvesting Date", value: harvestingDate },
  ].filter((row) => hasText(row.value));

  const bio = String(details.bio || "").trim();
  const hasAnyFarmerInfo =
    hasText(name) ||
    hasText(location) ||
    hasText(farmerImage) ||
    hasText(farmImage) ||
    rows.length > 0 ||
    hasText(bio);

  if (!hasAnyFarmerInfo) return null;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-slate-900 sm:text-base">
          Farmer details
        </h3>
        {hasText(name) ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
            Traceable
          </span>
        ) : null}
      </div>

      {(farmerImage || farmImage) ? (
        <div className={`mt-4 grid gap-3 ${farmerImage && farmImage ? "grid-cols-2" : "grid-cols-1"}`}>
          {farmerImage ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-50">
              <OptimizedImg
                src={farmerImage}
                alt={name || "Farmer"}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                Farmer
              </span>
            </div>
          ) : null}
          {farmImage ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-50">
              <OptimizedImg
                src={farmImage}
                alt="Farm land"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                Farm land
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {(name || location) ? (
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          {name ? <h4 className="text-[15px] font-bold text-slate-900">{name}</h4> : null}
          {location ? (
            <p className="text-xs font-medium text-slate-500 sm:text-sm">{location}</p>
          ) : null}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[13px] text-slate-700">
          {rows.map((row) => (
            <li key={row.label} className="flex gap-2">
              <span className="shrink-0 font-semibold text-slate-900">{row.label}:</span>
              <span className="min-w-0 text-slate-600">{row.value}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {bio ? (
        <p className="mt-3 border-t border-slate-100 pt-3 text-[13px] leading-relaxed text-slate-600">
          {bio}
        </p>
      ) : null}
    </section>
  );
}

function FarmerQuickCard({ product }) {
  const name = String(product?.farmerName || product?.farmerDetails?.name || "").trim();
  const location = String(product?.farmerLocation || product?.farmerDetails?.location || "").trim();
  const farmerImage = String(product?.farmerImage || product?.farmerDetails?.farmerImage || "").trim();
  if (!name && !location) return null;

  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-emerald-100 ring-2 ring-white">
        {farmerImage ? (
          <OptimizedImg
            src={farmerImage}
            alt={name || "Farmer"}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-emerald-700">
            {(name || "F").charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Direct from farmer
        </p>
        {name ? (
          <h4 className="truncate text-sm font-bold text-slate-900">{name}</h4>
        ) : null}
        {location ? (
          <p className="truncate text-xs text-slate-500">{location}</p>
        ) : null}
      </div>
    </div>
  );
}

function displayQuantityLabel(label) {
  return String(label || "")
    .replace(/\bgrams?\b/gi, "g")
    .replace(/\bkilograms?\b/gi, "kg")
    .replace(/\bmilliliters?\b/gi, "ml")
    .replace(/\bliters?\b/gi, "L")
    .replace(/\s+/g, " ")
    .trim();
}

function QuantityOptionCard({ label, salePrice, originalPrice, selected, image, onClick }) {
  const englishLabel = displayQuantityLabel(label);
  const marathiLabel = translateUnitToMarathi(label);
  const format = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-max shrink-0 flex-col overflow-hidden rounded-xl border text-left transition ${
        selected
          ? "border-emerald-600 bg-[#e7f3d4] shadow-sm"
          : "border-[#e4edd6] bg-[#f4f8ea]"
      }`}
    >
      {image ? (
        <OptimizedImg src={image} alt="" className="block h-[84px] w-full object-cover object-center" />
      ) : (
        <div className="h-[84px] w-full bg-white" />
      )}
      <div className="flex items-center justify-between gap-3 whitespace-nowrap px-2 py-1.5">
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-medium text-slate-900">{englishLabel}</span>
          {marathiLabel ? (
            <span className="mt-0.5 text-[12px] font-medium text-slate-600">{marathiLabel}</span>
          ) : null}
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="text-[15px] font-bold text-slate-900">{format(salePrice)}</span>
          {originalPrice > salePrice ? (
            <span className="text-[12px] font-medium text-slate-400 line-through">
              {format(originalPrice)}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function UnitOptionCard({ label, salePrice, originalPrice, selected, discountPct, onClick }) {
  const format = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-w-[104px] rounded-xl border px-3 py-2.5 text-left transition ${
        selected ? "border-[#0C831F] bg-[#F6FBF7]" : "border-[#E5E5E5] bg-white"
      }`}
    >
      {discountPct > 0 ? (
        <span className="absolute -top-2 left-2 rounded bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-bold text-white">
          {discountPct}% OFF
        </span>
      ) : null}
      <p className="text-[13px] font-semibold text-[#1a1a1a]">{label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[15px] font-bold text-[#1a1a1a]">{format(salePrice)}</span>
        {originalPrice > salePrice ? (
          <span className="text-[12px] text-[#9CA3AF] line-through">{format(originalPrice)}</span>
        ) : null}
      </div>
    </button>
  );
}

function GalleryNavButton({ direction, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous image" : "Next image"}
      className="absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border-light bg-white/95 text-lg text-text-secondary transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      style={direction === "prev" ? { left: "0.5rem" } : { right: "0.5rem" }}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}

function QuantitySelector({ quantity, min, max, onDecrease, onIncrease, disabled }) {
  return (
    <div className="flex w-full items-center justify-between gap-2 py-1 sm:gap-3">
      <span className="shrink-0 text-xs font-semibold text-text-primary sm:text-sm">
        Quantity (Pieces)
      </span>
      <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border border-border-light">
        <button
          type="button"
          onClick={onDecrease}
          disabled={disabled || quantity <= min}
          aria-label="Decrease quantity"
          className="flex h-8 w-8 items-center justify-center border-r border-border-light bg-white text-base text-text-secondary transition hover:bg-mobile-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <span className="flex h-8 min-w-[2.25rem] items-center justify-center border-r border-border-light bg-white px-1.5 text-sm font-bold text-text-primary">
          {quantity}
        </span>
        <button
          type="button"
          onClick={onIncrease}
          disabled={disabled || quantity >= max}
          aria-label="Increase quantity"
          className="flex h-8 w-8 items-center justify-center bg-white text-base text-text-secondary transition hover:bg-mobile-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function CartActionQuantity({ quantity, min, max, disabled, onDecrease, onIncrease }) {
  return (
    <div className="flex flex-1 items-center justify-between gap-2 rounded-md border-2 border-primary bg-white px-4 py-2.5">
      <button
        type="button"
        onClick={onDecrease}
        disabled={disabled}
        aria-label="Decrease cart quantity"
        className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-medium text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-[2rem] text-center text-sm font-bold text-text-primary">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={disabled || quantity >= max}
        aria-label="Increase cart quantity"
        className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-medium text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

function ProductDetailsSection({
  productType,
  detailsOpen,
  onToggleDetails,
  product,
  specifications,
  className = "",
}) {
  const harvestingDate = formatProduceDate(
    product?.harvestingDate || product?.farmerDetails?.harvestingDate
  );
  const unit = String(product?.unit || product?.sub || product?.weight || "").trim();
  const brand = String(product?.brandName || "").trim();
  const category = Array.isArray(product?.categories)
    ? String(product.categories[0] || "").trim()
    : "";
  const metaItems = [
    productType ? { label: "Type", value: productType } : null,
    category ? { label: "Category", value: category } : null,
    brand ? { label: "Brand", value: brand } : null,
    unit ? { label: "Unit", value: unit } : null,
    harvestingDate ? { label: "Harvest", value: harvestingDate, accent: true } : null,
  ].filter(Boolean);

  return (
    <section className={className}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
          <h2 className="text-[15px] font-bold text-slate-900 sm:text-base">Product Details</h2>
          <button
            type="button"
            onClick={onToggleDetails}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-emerald-700 ring-1 ring-slate-200 transition hover:bg-emerald-50"
          >
            {detailsOpen ? "Less" : "More"}
            <svg
              className={`h-3.5 w-3.5 transition ${detailsOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {metaItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {metaItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {item.label}
                  </p>
                  <p
                    className={`mt-0.5 truncate text-[13px] font-semibold ${
                      item.accent ? "text-emerald-700" : "text-slate-800"
                    }`}
                    title={item.value}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {detailsOpen ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  Description
                </p>
                <div className="text-[13px] leading-relaxed text-slate-600 sm:text-[14px] [&_li]:text-slate-600 [&_p]:text-slate-600 [&_ul]:mt-2">
                  <ProductDescriptionContent
                    description={product.description}
                    features={product.features}
                    fallback={`Fresh ${product.name} from GreenGrocc. Quality checked and ready for delivery.`}
                  />
                </div>
              </div>

              {specifications.length > 0 ? (
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                    Specifications
                  </p>
                  <div className="overflow-hidden rounded-xl ring-1 ring-slate-100">
                    <dl className="divide-y divide-slate-100">
                      {specifications.map((spec, index) => (
                        <div
                          key={`${spec.name}-${index}`}
                          className="grid grid-cols-[110px_1fr] gap-3 bg-white px-3 py-2.5 sm:grid-cols-[140px_1fr]"
                        >
                          <dt className="text-[12px] font-semibold text-slate-500 sm:text-[13px]">
                            {spec.name}
                          </dt>
                          <dd className="text-[12px] text-slate-800 sm:text-[13px]">{spec.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">
              Tap More to read the full description and specifications.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ActionButtons({
  inStock,
  inCart,
  cartQuantity,
  min,
  max,
  onAddToCart,
  onDecrease,
  onIncrease,
  product,
  shareImageUrl,
  className = "",
}) {
  return (
    <div className={className}>
      {inCart ? (
        <CartActionQuantity
          quantity={cartQuantity}
          min={min}
          max={max}
          disabled={!inStock}
          onDecrease={onDecrease}
          onIncrease={onIncrease}
        />
      ) : (
        <button
          type="button"
          onClick={(e) => onAddToCart(e.currentTarget)}
          disabled={!inStock}
          className="flex-1 rounded-md bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inStock ? "Add to Cart" : "Out of Stock"}
        </button>
      )}
      <ProductAdminShareMenu
        className="flex-1 [&>button]:h-full [&>button]:w-full [&>button]:rounded-md [&>button]:border-2 [&>button]:border-primary [&>button]:bg-white [&>button]:px-6 [&>button]:py-3.5 [&>button]:text-sm [&>button]:font-bold [&>button]:text-primary [&>button]:transition hover:[&>button]:bg-primary/5"
        product={product}
        imageUrl={shareImageUrl}
      />
    </div>
  );
}

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, items: cartItems, incrementCartItem, decrementCartItem } = useCart();
  const { openAuthModal, user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMedia, setActiveMedia] = useState(0);
  const [activeTab, setActiveTab] = useState("description");
  const [quantity, setQuantity] = useState(DEFAULT_MOQ);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [varietyOptions, setVarietyOptions] = useState([]);
  const [reviewStats, setReviewStats] = useState({ average: 0, count: 0 });
  const canViewPrice = useCanViewProductPrice(product);
  const isBulkUser = user?.accountType === "bulk";

  useEffect(() => {
    if (!id || String(id).startsWith("dummy-") || String(id).startsWith("deal-")) return;
    tryOpenProductInApp(id);
  }, [id]);

  useEffect(() => {
    const productId = product?._id;
    setReviewStats({ average: 0, count: 0 });
    if (!productId || String(productId).startsWith("dummy-") || String(productId).startsWith("deal-")) return;
    let active = true;
    getProductReviews(productId)
      .then(({ data }) => {
        if (active && data?.stats) setReviewStats(data.stats);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [product?._id]);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError("");
      try {
        const dummy = typeof getDummyProductById === "function" ? getDummyProductById(id) : null;
        let nextProduct = dummy;
        if (!nextProduct && !String(id).startsWith("deal-") && !String(id).startsWith("dummy-")) {
          const res = await getProductById(id);
          nextProduct = res?.data?.data || res?.data;
        }

        if (!nextProduct || !nextProduct._id) {
          throw new Error("Product not found");
        }

        const availableGrades = getAvailableBulkGrades(nextProduct);
        const useBulkGrades =
          user?.accountType === "bulk" && availableGrades.length > 0;

        const initialVariant = useBulkGrades
          ? buildBulkGradeVariantName(availableGrades[0].grade, availableGrades[0].variety)
          : nextProduct?.variantType === "multi"
            ? nextProduct.variants?.[0]?.name || ""
            : "";
        const initialColors = getAvailableColors(nextProduct, initialVariant);

        setProduct(nextProduct);
        setSelectedVariant(initialVariant);
        setSelectedColor(initialColors[0]?.name || "");
        setActiveMedia(0);
        setActiveTab("description");

        if (nextProduct?._id && !String(nextProduct._id).startsWith("dummy-")) {
          addRecentlyViewed(nextProduct._id);
          const productCategory = Array.isArray(nextProduct.categories)
            ? String(nextProduct.categories[0] || "").trim()
            : "";
          if (productCategory) addCategoryVisit(productCategory);
        }
      } catch (err) {
        console.error("fetchProduct error:", err);
        setProduct(null);
        setSelectedVariant("");
        setSelectedColor("");
        setError("Product not found.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, user?.accountType]);

  useEffect(
    () =>
      onCatalogEvent((event) => {
        if (event.entity !== "product" || !event.data || String(event.id) !== String(id)) return;
        setProduct((prev) => (prev && String(prev._id) === String(event.id) ? { ...prev, ...event.data } : prev));
      }),
    [id]
  );

  useEffect(() => {
    let cancelled = false;
    const loadVarieties = async () => {
      if (
        !product?._id ||
        String(product._id).startsWith("dummy-") ||
        String(product._id).startsWith("deal-")
      ) {
        setVarietyOptions([]);
        return;
      }
      try {
        const res = await getProductVarieties(product._id);
        const list = res?.data?.data || res?.data || [];
        const items = Array.isArray(list) ? list : [];
        // Only keep a real multi-variety group
        if (!cancelled) {
          setVarietyOptions(items.length > 1 ? items : []);
        }
      } catch {
        if (!cancelled) setVarietyOptions([]);
      }
    };
    loadVarieties();
    return () => {
      cancelled = true;
    };
  }, [product?._id]);

  const handleVariantChange = (variantName) => {
    setSelectedVariant(variantName);
    if (product) {
      const colors = getAvailableColors(product, variantName);
      setSelectedColor(colors[0]?.name || "");
    }
  };

  const images = useMemo(
    () => normalizeProductImages(product?.productImages),
    [product?.productImages]
  );

  const videoUrl = product?.videoUrl?.trim() || "";

  const galleryItems = useMemo(() => {
    const items = images.map((url) => ({ type: "image", url }));
    if (videoUrl) {
      items.push({ type: "video", url: videoUrl });
    }
    return items;
  }, [images, videoUrl]);

  useEffect(() => {
    setActiveMedia((prev) => {
      if (!galleryItems.length) return 0;
      return prev < galleryItems.length ? prev : 0;
    });
  }, [galleryItems]);

  const activeGalleryItem = galleryItems[activeMedia];
  const isVideoActive = activeGalleryItem?.type === "video";
  const imageOnlyIndex = activeMedia;

  const availableBulkGrades = useMemo(
    () => (product && isBulkUser ? getAvailableBulkGrades(product) : []),
    [product, isBulkUser]
  );
  const showBulkGrades = availableBulkGrades.length > 0;

  const activeVariantName = showBulkGrades
    ? selectedVariant
    : product && isMultiVariant(product)
      ? selectedVariant
      : "";

  const shareUrl =
    typeof window !== "undefined" && product?._id
      ? `${window.location.origin}/product/${product._id}?openInApp=1`
      : "";

  const shareImageUrl = images[0] || "";
  const specifications = useMemo(() => getResolvedSpecifications(product), [product]);

  useEffect(() => {
    if (!product) return undefined;

    updateProductShareMeta({
      product,
      shareUrl,
      imageUrl: shareImageUrl,
      variantName: activeVariantName,
    });

    return () => {
      document.title = "GreenGrocc";
    };
  }, [product, shareUrl, shareImageUrl, activeVariantName]);

  const availableColors = useMemo(() => {
    if (!product) return [];
    return getAvailableColors(product, activeVariantName);
  }, [product, activeVariantName]);

  const bulkTiers = useMemo(() => {
    if (!product || !isBulkPricing(product, activeVariantName)) return [];
    return getBulkTierRows(product, activeVariantName);
  }, [product, activeVariantName]);

  const minOrderQuantity = product
    ? getMinOrderQuantity(product, activeVariantName, DEFAULT_MOQ)
    : DEFAULT_MOQ;
  const quantityStep = product
    ? getCartAdjustStep(product, activeVariantName, DEFAULT_MOQ)
    : DEFAULT_MOQ;
  const showStepByQty = product
    ? hasConfiguredQuantityStep(product, activeVariantName)
    : false;

  const getCartLine = () => {
    if (!product?._id) return null;
    return (
      cartItems.find(
        (item) =>
          item._id === product._id &&
          (item.variantName || "") === activeVariantName &&
          (item.colorName || "") === selectedColor
      ) || null
    );
  };

  const cartLineQuantity = useMemo(() => {
    if (!product?._id) return null;
    const line = cartItems.find(
      (item) =>
        item._id === product._id &&
        (item.variantName || "") === activeVariantName &&
        (item.colorName || "") === selectedColor
    );
    return line?.quantity ?? null;
  }, [cartItems, product?._id, activeVariantName, selectedColor]);

  useEffect(() => {
    if (!product) return;
    const moq = getMinOrderQuantity(product, activeVariantName, DEFAULT_MOQ, isBulkUser);
    setQuantity(cartLineQuantity ?? moq);
  }, [product, activeVariantName, selectedColor, cartLineQuantity]);

  const currentUnitPrice = product
    ? getUnitPriceForQuantity(product, quantity, activeVariantName)
    : 0;

  const handleAddToCart = async (flySource) => {
    if (!product) return;
    if (availableColors.length > 0 && !selectedColor) return;

    const result = await addToCart(product, quantity, {
      variantName: activeVariantName,
      colorName: selectedColor,
      flySource,
    });
    if (result?.requiresLogin) {
      openAuthModal("login");
    }
  };

  const handleQuantityDecrease = async () => {
    if (!product) return;
    const line = getCartLine();
    const step = quantityStep;

    if (line) {
      await decrementCartItem({
        productId: product._id,
        variantName: activeVariantName,
        colorName: selectedColor,
        preOrderSlot: line.preOrderSlot || "",
        resolveNextQuantity: (currentQty) =>
          getDecreasedCartQuantityForProduct(product, currentQty, activeVariantName),
      });
      return;
    }

    setQuantity((prev) => Math.max(minOrderQuantity, prev - step));
  };

  const handleQuantityIncrease = async () => {
    if (!product) return;
    const line = getCartLine();
    const step = quantityStep;
    const variantStock = getVariantStock(product, activeVariantName);
    const maxOrderQty = getMaxOrderQuantity(product, activeVariantName, 50);
    const maxQty =
      variantStock > 0
        ? Math.min(variantStock, maxOrderQty)
        : minOrderQuantity;

    if (line) {
      await incrementCartItem({
        productId: product._id,
        variantName: activeVariantName,
        colorName: selectedColor,
        preOrderSlot: line.preOrderSlot || "",
        step,
        maxQuantity: maxQty,
      });
      return;
    }

    setQuantity((prev) => Math.min(maxQty, prev + step));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-28 lg:pb-10">
        <div className="mx-auto w-full max-w-7xl px-3 pb-8 pt-4 sm:px-4 md:px-5 lg:px-6 xl:px-8">
          <div className="animate-pulse">
            <div className="h-6 w-32 rounded bg-slate-200" />
            <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="h-96 rounded-2xl bg-slate-200" />
              <div className="space-y-4">
                <div className="h-8 w-3/4 rounded bg-slate-200" />
                <div className="h-6 w-1/4 rounded bg-slate-200" />
                <div className="h-24 rounded bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="mb-6 text-text-secondary">{error || "Product not found."}</p>
          <Link to="/product" className="text-sm font-medium text-primary hover:underline">
            ← Back to products
          </Link>
        </div>
      </div>
    );
  }

  const category = product.categories?.[0] || "Products";
  const variantStock = getVariantStock(product, activeVariantName);
  const inStock = variantStock > 0;
  const rating = Number(
    reviewStats.count > 0 ? reviewStats.average : product.ratings || product.rating || 0
  );
  const ratingCount = Number(reviewStats.count || product.reviewCount || product.numReviews || 0);
  const ratingCountLabel =
    ratingCount >= 1000 ? `${(ratingCount / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(ratingCount);
  const maxOrderQty = getMaxOrderQuantity(product, activeVariantName, 50);
  const maxQuantity = inStock
    ? Math.min(variantStock, maxOrderQty)
    : minOrderQuantity;
  const unitLabel = product.sub || product.unit || product.weight || "1 pc";
  const coverImage = Array.isArray(product.productImages) ? product.productImages[0] || "" : "";
  const displayInfo = getProductDisplayDetails(product, unitLabel);
  const priceInfo = getProductListPriceInfo(product, activeVariantName);

  const unitOptions = showBulkGrades
    ? availableBulkGrades.map((grade) => {
        const variantName = buildBulkGradeVariantName(grade.grade, grade.variety);
        const info = getProductListPriceInfo(product, variantName);
        const discountPct =
          info.hasDiscount && info.originalPrice > 0
            ? Math.round(((info.originalPrice - info.salePrice) / info.originalPrice) * 100)
            : 0;
        return {
          key: variantName,
          label: grade.variety
            ? `Grade ${grade.grade} · ${grade.variety}`
            : `Grade ${grade.grade}`,
          salePrice: info.salePrice,
          originalPrice: info.originalPrice,
          discountPct,
          selected: selectedVariant === variantName,
          onSelect: () => handleVariantChange(variantName),
          unitHint: grade.unit,
        };
      })
    : isMultiVariant(product)
    ? (product.variants || []).map((variant) => {
        const info = getProductListPriceInfo(product, variant.name);
        const discountPct =
          info.hasDiscount && info.originalPrice > 0
            ? Math.round(((info.originalPrice - info.salePrice) / info.originalPrice) * 100)
            : 0;
        return {
          key: variant.name,
          label: variant.name,
          image: variant.image || coverImage,
          salePrice: info.salePrice,
          originalPrice: info.originalPrice,
          discountPct,
          selected: selectedVariant === variant.name,
          onSelect: () => handleVariantChange(variant.name),
        };
      })
    : [
        {
          key: "default",
          label: unitLabel,
          image: product.unitImage || coverImage,
          salePrice: priceInfo.salePrice,
          originalPrice: priceInfo.originalPrice,
          discountPct:
            priceInfo.hasDiscount && priceInfo.originalPrice > 0
              ? Math.round(
                  ((priceInfo.originalPrice - priceInfo.salePrice) / priceInfo.originalPrice) * 100
                )
              : 0,
          selected: true,
          onSelect: () => {},
        },
      ];

  const productType =
    specifications.find((s) => /type|category/i.test(s.name) && !/subcategor/i.test(s.name))?.value ||
    category;

  const goBack = () => {
    if (typeof window.history.state?.idx === "number" && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }
    const store = sectionToStoreKey(product?.storeType || product?.section);
    const baseKey = baseGroupKey(product);
    if (category && baseKey && !baseKey.startsWith("product:")) {
      navigate(catalogUrls({ categoryName: category, baseId: baseKey, store }).productsUrl, { replace: true });
      return;
    }
    if (category && category !== "Products") {
      navigate(buildStoreProductUrl({ categoryName: category, store }), { replace: true });
      return;
    }
    navigate(buildStoreProductUrl({ store }), { replace: true });
  };

  return (
    <div className="min-h-screen bg-white pb-24 text-[#1a1a1a] lg:pb-10">
      {/* lg sticky offset accounts for sticky upper TopNav bar */}
      <div className="mx-auto w-full max-w-6xl px-0 pt-0 sm:px-5 lg:px-6 lg:pt-6">
        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:items-start lg:gap-10">
          {/* Left — sticky product image on desktop */}
          <div className="min-w-0 lg:sticky lg:top-[52px] lg:self-start">
            <div className="relative overflow-hidden rounded-none sm:rounded-2xl bg-white border-b border-slate-100 sm:border-none">
              <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Go back"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white/95 text-[#1a1a1a] shadow-sm transition hover:bg-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <WishlistButton product={product} size="md" />
                  <ProductShareMenu
                    className="[&_button]:bg-white/95"
                    product={product}
                    shareUrl={shareUrl}
                    imageUrl={shareImageUrl}
                    variantName={activeVariantName}
                  />
                </div>
              </div>
              <div className="flex w-full items-center justify-center bg-white">
                {isVideoActive ? (
                  <ProductVideo url={activeGalleryItem.url} embedded />
                ) : (
                  <ProductImage src={activeGalleryItem?.url} alt={product.name} />
                )}
              </div>
            </div>
            <div className="mt-3 px-4 sm:px-0">
              <MediaThumbnailCarousel
                items={galleryItems}
                activeIndex={activeMedia}
                onSelect={setActiveMedia}
              />
            </div>
          </div>

          {/* Right — product info, details, farmer */}
          <aside className="min-w-0 space-y-5 bg-white px-4 pb-2 sm:px-0">
            <div>
              <nav className="mb-2 flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
                <Link to="/" className="hover:text-emerald-700">
                  Home
                </Link>
                <span>/</span>
                <Link
                  to={`/product?categoryName=${encodeURIComponent(category)}`}
                  className="hover:text-emerald-700"
                >
                  {category}
                </Link>
                <span>/</span>
                <span className="text-slate-800">{product.name}</span>
              </nav>

              <div className="space-y-1 mb-2">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="min-w-0 text-[22px] font-bold leading-snug tracking-tight text-slate-900 sm:text-[26px]">
                    {displayInfo.primaryTitle}
                  </h1>
                  {rating > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const reviewsTab = document.getElementById("product-reviews-tab");
                        reviewsTab?.click();
                        reviewsTab?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[13px] font-semibold text-slate-800 sm:text-[14px]"
                      aria-label={`Rated ${rating.toFixed(1)} out of 5${ratingCount ? ` from ${ratingCount} reviews` : ""}`}
                    >
                      <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.77l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.5z" />
                      </svg>
                      <span>{rating.toFixed(1)}</span>
                      {ratingCount > 0 ? (
                        <span className="font-medium text-slate-500">({ratingCountLabel})</span>
                      ) : null}
                    </button>
                  ) : null}
                </div>
                <div
                  onClick={() => {
                    const unitSection = document.getElementById("product-unit-selection");
                    if (unitSection) {
                      unitSection.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-[15px] sm:text-[17px] font-bold text-slate-800 cursor-pointer hover:text-emerald-800 transition select-none"
                  title="Click to select unit or variety"
                >
                  <span>{displayInfo.secondaryTitle || unitLabel}</span>
                  <svg
                    className="w-4 h-4 text-slate-700 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
              {(() => {
                const raw =
                  product.shortDescription ||
                  product.description ||
                  "";
                const short = String(raw)
                  .replace(/<[^>]+>/g, "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 140);
                if (!short) return null;
                return (
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">
                    {short}
                    {String(raw).replace(/<[^>]+>/g, "").trim().length > 140 ? "…" : ""}
                  </p>
                );
              })()}
            </div>

            {/* Price + ATC — directly under description */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 sm:p-4">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-slate-600">
                    {displayInfo.secondaryTitle || unitLabel}
                  </p>
                  {canViewPrice ? (
                    <>
                      <div className="mt-1 flex flex-wrap items-baseline gap-2">
                        <p className="text-[26px] font-extrabold leading-none text-slate-900 sm:text-[28px]">
                          {formatPrice(priceInfo.salePrice).replace(".00", "")}
                        </p>
                        {priceInfo.originalPrice > priceInfo.salePrice ? (
                          <span className="text-[14px] font-medium text-slate-400 line-through sm:text-[15px]">
                            {formatPrice(priceInfo.originalPrice).replace(".00", "")}
                          </span>
                        ) : null}
                        {priceInfo.hasDiscount && priceInfo.originalPrice > 0 ? (
                          <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                            {Math.round(
                              ((priceInfo.originalPrice - priceInfo.salePrice) /
                                priceInfo.originalPrice) *
                                100
                            )}
                            % OFF
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 sm:text-[12px]">
                        (Inclusive of all taxes)
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">Login to view price</p>
                  )}
                </div>

                {cartLineQuantity != null ? (
                  <div className="w-[140px] shrink-0 sm:w-[160px]">
                    <CartActionQuantity
                      quantity={cartLineQuantity}
                      min={minOrderQuantity}
                      max={maxQuantity}
                      disabled={!inStock}
                      onDecrease={handleQuantityDecrease}
                      onIncrease={handleQuantityIncrease}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleAddToCart(e.currentTarget)}
                    disabled={!inStock}
                    className="h-12 min-w-[130px] shrink-0 rounded-xl bg-emerald-700 px-5 text-[14px] font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[150px] sm:text-[15px]"
                  >
                    {inStock ? "Add to cart" : "Out of Stock"}
                  </button>
                )}
              </div>

              {Array.isArray(product.quantityDiscounts) && product.quantityDiscounts.length > 0 ? (
                <p className="mt-2 text-xs font-semibold text-emerald-700">
                  {product.quantityDiscounts
                    .map((rule) =>
                      rule.discountType === "fixed"
                        ? `Buy ${rule.minQuantity}+ · ₹${rule.discountValue} off / unit`
                        : `Buy ${rule.minQuantity}+ · Get ${rule.discountValue}% off`
                    )
                    .join(" · ")}
                </p>
              ) : null}

              {showStepByQty && (
                <p className="mt-2 text-[12px] text-slate-500">Step: {quantityStep}</p>
              )}
            </div>

            <div id="product-unit-selection">
              <p className="mb-3 text-[18px] font-bold tracking-tight text-slate-900">
                {showBulkGrades ? "Select Grade" : "Select quantity"}
              </p>
              {showBulkGrades ? (
                <p className="mb-2.5 text-[12px] text-slate-500">
                  Bulk pricing by quality grade — each grade can have its own variety and rate.
                </p>
              ) : null}
              <div className={showBulkGrades ? "flex flex-wrap gap-2.5" : "flex gap-2 overflow-x-auto pb-1"}>
                {unitOptions.map((opt) =>
                  showBulkGrades ? (
                    <UnitOptionCard
                      key={opt.key}
                      label={opt.label}
                      salePrice={opt.salePrice}
                      originalPrice={opt.originalPrice}
                      selected={opt.selected}
                      discountPct={opt.discountPct}
                      onClick={opt.onSelect}
                    />
                  ) : (
                    <QuantityOptionCard
                      key={opt.key}
                      label={opt.label}
                      image={opt.image}
                      salePrice={opt.salePrice}
                      originalPrice={opt.originalPrice}
                      selected={opt.selected}
                      onClick={opt.onSelect}
                    />
                  )
                )}
              </div>
            </div>

            {varietyOptions.length > 1 ? (
              <div>
                <p className="mb-2.5 text-[14px] font-semibold text-slate-900">
                  Select Variety
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {varietyOptions.map((v) => {
                    const info = getProductListPriceInfo(v);
                    const discountPct =
                      info.hasDiscount && info.originalPrice > 0
                        ? Math.round(
                            ((info.originalPrice - info.salePrice) / info.originalPrice) * 100
                          )
                        : 0;
                    const label =
                      (v.varietyName && String(v.varietyName).trim()) ||
                      (v.name && String(v.name).trim()) ||
                      v.unit ||
                      "Variety";
                    return (
                      <UnitOptionCard
                        key={v._id}
                        label={label}
                        salePrice={info.salePrice}
                        originalPrice={info.originalPrice}
                        selected={String(v._id) === String(product._id)}
                        discountPct={discountPct}
                        onClick={() => {
                          if (String(v._id) !== String(product._id)) {
                            navigate(`/product/${v._id}`);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}

            {availableColors.length > 0 ? (
              <div>
                <p className="mb-2 text-[14px] font-semibold text-slate-900">Select color</p>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => {
                    const isActive = selectedColor === color.name;
                    return (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setSelectedColor(color.name)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                          isActive
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 text-slate-800"
                        }`}
                      >
                        {color.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <ProductFarmerTraceabilitySection
              product={product}
              specifications={specifications}
            />

          </aside>
        </div>

        {/* App मध्ये खास वैशिष्ट्ये & Why Choose GreenGrocc? Section */}
        <div className="mt-8 sm:mt-10 border-t border-slate-100 pt-6 sm:pt-8">
          <WhatMakesUsDifferent />
        </div>

        <div className="mt-8 border-t border-slate-100 px-0 pt-6 sm:px-0">
          <SimilarProducts
            productId={product._id}
            categoryName={product.categories?.[0] || product.subcategory || ""}
          />
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
