const DEFAULT_SINGLE_MOQ = 1;

export function isMultiVariant(product) {
  return product?.variantType === "multi" && Array.isArray(product?.variants) && product.variants.length > 0;
}

export function parseBulkGradeKey(variantName = "") {
  if (!variantName) return null;
  const match = String(variantName)
    .trim()
    .match(/^Grade\s*([ABC])(?:\s*[·•\-–:].*)?$/i);
  return match ? match[1].toUpperCase() : null;
}

export function buildBulkGradeVariantName(grade, variety = "") {
  const key = String(grade || "").trim().toUpperCase();
  const varietyLabel = String(variety || "").trim();
  if (!["A", "B", "C"].includes(key)) return "";
  return varietyLabel ? `Grade ${key} · ${varietyLabel}` : `Grade ${key}`;
}

export function getBulkGrade(product, gradeOrVariantName = "") {
  const grade =
    parseBulkGradeKey(gradeOrVariantName) ||
    String(gradeOrVariantName || "").trim().toUpperCase();
  if (!["A", "B", "C"].includes(grade)) return null;
  if (!Array.isArray(product?.bulkGrades)) return null;
  return product.bulkGrades.find((entry) => entry.grade === grade) || null;
}

export function getAvailableBulkGrades(product) {
  if (!product?.enableBulkGrades || !Array.isArray(product?.bulkGrades)) return [];
  return product.bulkGrades.filter(
    (entry) =>
      entry.isAvailable !== false &&
      Number(entry.price) >= 0 &&
      ["A", "B", "C"].includes(entry.grade)
  );
}

export function hasBulkGradePricing(product) {
  return getAvailableBulkGrades(product).length > 0;
}

export function getVariant(product, variantName) {
  if (!isMultiVariant(product) || !variantName) return null;

  const target = String(variantName).trim().toLowerCase();
  return (
    product.variants.find(
      (variant) => variant.name?.trim().toLowerCase() === target
    ) || null
  );
}

export function isProductInStock(product, variantName = "") {
  const bulkGrade = getBulkGrade(product, variantName);
  if (bulkGrade && product?.enableBulkGrades) {
    if (bulkGrade.isAvailable === false) return false;
    return (bulkGrade.stock ?? 0) > 0 || bulkGrade.isAvailable === true;
  }

  if (isMultiVariant(product)) {
    const variant = getVariant(product, variantName);
    if (!variant) return false;
    if (typeof variant.inStock === "boolean") return variant.inStock;
    return (variant.stock ?? 0) > 0;
  }

  if (typeof product?.inStock === "boolean") return product.inStock;
  return (product?.stock ?? 0) > 0;
}

const IN_STOCK_MAX_QTY = 9999;

export function getVariantStock(product, variantName = "") {
  const storeStock = Number(product?.storeStock);
  if (Number.isFinite(storeStock) && storeStock >= 0) {
    return storeStock;
  }
  return isProductInStock(product, variantName) ? IN_STOCK_MAX_QTY : 0;
}

export function getAvailableColors(product, variantName = "") {
  if (isMultiVariant(product)) {
    const variant = getVariant(product, variantName);
    return Array.isArray(variant?.colors) ? variant.colors : [];
  }

  return Array.isArray(product?.colors) ? product.colors : [];
}

export function getTotalProductStock(product) {
  const storeStock = Number(product?.storeStock);
  if (Number.isFinite(storeStock) && storeStock >= 0) {
    return storeStock;
  }

  if (isMultiVariant(product)) {
    return product.variants.some((variant) =>
      typeof variant.inStock === "boolean" ? variant.inStock : (variant.stock ?? 0) > 0
    )
      ? IN_STOCK_MAX_QTY
      : 0;
  }

  return isProductInStock(product) ? IN_STOCK_MAX_QTY : 0;
}

export function getPricingSource(product, variantName = "") {
  const productMoq =
    product?.minOrderQuantity ?? product?.bulkPricing?.minOrderQuantity ?? null;
  const productBulkMoq = product?.bulkMinOrderQuantity ?? product?.bulkPricing?.bulkMinOrderQuantity ?? null;
  const productMax =
    product?.maxOrderQuantity ?? product?.maxOrderQty ?? product?.bulkPricing?.maxOrderQuantity ?? null;
  const productStep =
    product?.stepByQuantity ?? product?.bulkPricing?.stepByQuantity ?? null;

  const bulkGrade = getBulkGrade(product, variantName);
  if (bulkGrade && (product?.enableBulkGrades || parseBulkGradeKey(variantName))) {
    const mrp = Number(bulkGrade.mrp);
    const price = Number(bulkGrade.price) || 0;
    return {
      pricingType: "single",
      bulkPricing: { slabs: [] },
      price: Number.isFinite(mrp) && mrp > 0 ? mrp : price,
      discountedPrice: price,
      minOrderQuantity: bulkGrade.minOrderQuantity ?? productMoq,
      maxOrderQuantity: productMax,
      stepByQuantity: productStep,
    };
  }

  if (isMultiVariant(product)) {
    const variant = getVariant(product, variantName);
    if (!variant) return null;

    return {
      pricingType: variant.pricingType,
      bulkPricing: variant.bulkPricing,
      price: variant.price,
      discountedPrice: variant.discountedPrice,
      minOrderQuantity:
        productMoq ??
        variant.minOrderQuantity ??
        variant.bulkPricing?.minOrderQuantity ??
        null,
      maxOrderQuantity:
        productMax ??
        variant.maxOrderQuantity ??
        variant.bulkPricing?.maxOrderQuantity ??
        null,
      stepByQuantity:
        productStep ??
        variant.stepByQuantity ??
        variant.bulkPricing?.stepByQuantity ??
        null,
    };
  }

  return {
    pricingType: product?.pricingType,
    bulkPricing: product?.bulkPricing,
    price: product?.price,
    discountedPrice: product?.discountedPrice ?? product?.salePrice,
    minOrderQuantity: productMoq,
      bulkMinOrderQuantity: productBulkMoq,
    maxOrderQuantity: productMax,
    stepByQuantity: productStep,
  };
}

export function applyQuantityDiscounts(basePrice, quantity, discounts = []) {
  const qty = Number(quantity);
  const price = Number(basePrice) || 0;
  if (!Array.isArray(discounts) || discounts.length === 0 || !Number.isFinite(qty) || qty < 1) {
    return price;
  }

  const applicable = discounts
    .filter((rule) => qty >= Number(rule.minQuantity || 0))
    .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity));
  const rule = applicable[0];
  if (!rule) return price;

  if (rule.discountType === "fixed") {
    return Math.max(0, Math.round((price - Number(rule.discountValue || 0)) * 100) / 100);
  }

  return Math.max(
    0,
    Math.round(price * (1 - Number(rule.discountValue || 0) / 100) * 100) / 100
  );
}

export function getUnitPriceForQuantity(product, quantity, variantName = "") {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) return 0;

  const source = getPricingSource(product, variantName);
  if (!source) return 0;

  let unitPrice = 0;
  if (source.pricingType === "bulk" && source.bulkPricing?.slabs?.length) {
    const slabs = [...source.bulkPricing.slabs].sort(
      (a, b) => a.minQuantity - b.minQuantity
    );

    for (let i = slabs.length - 1; i >= 0; i -= 1) {
      const slab = slabs[i];
      const inRange =
        qty >= slab.minQuantity &&
        (slab.maxQuantity == null || qty <= slab.maxQuantity);

      if (inRange) {
        unitPrice = slab.pricePerUnit;
        break;
      }
    }

    if (!unitPrice) {
      const belowFirstSlab = qty < Number(slabs[0]?.minQuantity);
      unitPrice =
        (belowFirstSlab ? slabs[0] : slabs[slabs.length - 1])?.pricePerUnit ?? 0;
    }
  } else {
    unitPrice = source.discountedPrice ?? source.price ?? 0;
  }

  return applyQuantityDiscounts(unitPrice, qty, product?.quantityDiscounts);
}

export function getMinOrderQuantity() {
  return DEFAULT_SINGLE_MOQ;
}

export function getMaxOrderQuantity(product, variantName = "", fallback = 50) {
  const source = getPricingSource(product, variantName);
  const max = Number(source?.maxOrderQuantity ?? product?.maxOrderQuantity ?? product?.maxOrderQty);
  if (Number.isFinite(max) && max > 0) {
    return max;
  }

  const stock = Number(product?.stock);
  if (Number.isFinite(stock) && stock > 0) {
    return Math.min(stock, fallback);
  }

  return fallback;
}

export function hasConfiguredMaxOrderQuantity(product, variantName = "") {
  const source = getPricingSource(product, variantName);
  if (!source) return false;
  const max = Number(source.maxOrderQuantity);
  return Number.isFinite(max) && max > 0;
}

export function getQuantityStep(product, variantName = "", fallback = DEFAULT_SINGLE_MOQ) {
  const source = getPricingSource(product, variantName);
  if (!source) return fallback;

  const step = Number(source.stepByQuantity);
  if (Number.isFinite(step) && step > 0) {
    return step;
  }

  return fallback;
}

export function getCartAdjustStep(product, variantName = "", fallback = DEFAULT_SINGLE_MOQ) {
  const source = getPricingSource(product, variantName);
  if (!source) return fallback;

  const step = Number(source.stepByQuantity);
  if (Number.isFinite(step) && step > 0) {
    return step;
  }

  return fallback;
}

export function hasConfiguredQuantityStep(product, variantName = "") {
  const source = getPricingSource(product, variantName);
  if (!source) return false;

  const step = Number(source.stepByQuantity);
  return Number.isFinite(step) && step > 1;
}

export function getDisplayPriceForSource(source) {
  if (!source) return 0;

  if (source.pricingType === "bulk" && source.bulkPricing?.slabs?.length) {
    return Math.min(...source.bulkPricing.slabs.map((slab) => slab.pricePerUnit));
  }

  return source.discountedPrice ?? source.price ?? 0;
}

export function getDisplayPrice(product, variantName = "") {
  if (isMultiVariant(product) && !variantName) {
    return Math.min(
      ...product.variants.map((variant) =>
        getDisplayPriceForSource({
          pricingType: variant.pricingType,
          bulkPricing: variant.bulkPricing,
          price: variant.price,
          discountedPrice: variant.discountedPrice,
        })
      )
    );
  }

  return getDisplayPriceForSource(getPricingSource(product, variantName));
}

export function getSortedBulkSlabs(product, variantName = "") {
  const source = getPricingSource(product, variantName);
  if (!source || source.pricingType !== "bulk" || !source.bulkPricing?.slabs?.length) {
    return [];
  }

  return [...source.bulkPricing.slabs].sort((a, b) => a.minQuantity - b.minQuantity);
}

export function getLastBulkSlab(product, variantName = "") {
  const slabs = getSortedBulkSlabs(product, variantName);
  return slabs.length ? slabs[slabs.length - 1] : null;
}

export function getOriginalPriceForQuantity(product, quantity, variantName = "") {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) return 0;

  const source = getPricingSource(product, variantName);
  if (!source) return 0;

  if (source.pricingType === "bulk" && source.bulkPricing?.slabs?.length) {
    const slabs = [...source.bulkPricing.slabs].sort(
      (a, b) => a.minQuantity - b.minQuantity
    );

    for (let i = slabs.length - 1; i >= 0; i -= 1) {
      const slab = slabs[i];
      const inRange =
        qty >= slab.minQuantity &&
        (slab.maxQuantity == null || qty <= slab.maxQuantity);

      if (inRange) {
        const original = Number(slab.originalPricePerUnit);
        return Number.isFinite(original) && original > 0 ? original : 0;
      }
    }

    return 0;
  }

  return Number(source.price) || 0;
}

/** Variant a list card represents: the one matching the product's unit, else the cheapest. */
function getListingVariantName(product) {
  if (!isMultiVariant(product)) return "";
  const unit = String(product.unit || "").trim().toLowerCase();
  const byUnit = unit && product.variants.find((v) => v.name?.trim().toLowerCase() === unit);
  if (byUnit) return byUnit.name;
  const priceOf = (v) => Number(v.discountedPrice ?? v.price) || Infinity;
  return [...product.variants].sort((a, b) => priceOf(a) - priceOf(b))[0]?.name || "";
}

export function getProductListPriceInfo(product, variantName = "") {
  const source = getPricingSource(product, variantName || getListingVariantName(product));
  if (!source) {
    return { originalPrice: 0, salePrice: 0, hasDiscount: false, isBulk: false };
  }

  const isBulk = source.pricingType === "bulk" && source.bulkPricing?.slabs?.length > 0;

  if (isBulk) {
    const lastSlab = getLastBulkSlab(product, variantName);
    const salePrice = lastSlab?.pricePerUnit ?? 0;
    const original = Number(lastSlab?.originalPricePerUnit);
    const originalPrice = Number.isFinite(original) && original > 0 ? original : 0;
    const hasDiscount = originalPrice > salePrice && salePrice > 0;

    return { originalPrice, salePrice, hasDiscount, isBulk: true };
  }

  const salePrice = getDisplayPriceForSource(source);
  const originalPrice = Number(source.price) || salePrice;
  const hasDiscount = originalPrice > salePrice && salePrice > 0;

  return { originalPrice, salePrice, hasDiscount, isBulk: false };
}

export function isBulkPricing(product, variantName = "") {
  const source = getPricingSource(product, variantName);
  return source?.pricingType === "bulk" && source.bulkPricing?.slabs?.length > 0;
}

export function getBulkTierRows(product, variantName = "") {
  const source = getPricingSource(product, variantName);
  if (!source || source.pricingType !== "bulk" || !source.bulkPricing?.slabs?.length) {
    return [];
  }

  return [...source.bulkPricing.slabs]
    .sort((a, b) => a.minQuantity - b.minQuantity)
    .map((slab) => ({
    key: `${slab.minQuantity}-${slab.maxQuantity ?? "plus"}`,
    minQuantity: slab.minQuantity,
    price: slab.pricePerUnit,
    originalPrice: slab.originalPricePerUnit ?? slab.pricePerUnit,
    hasDiscount:
      Number(slab.originalPricePerUnit) > Number(slab.pricePerUnit) &&
      Number(slab.pricePerUnit) > 0,
  }));
}

export function formatProductPriceLabel(product, formatPrice, variantName = "") {
  const amount = getDisplayPrice(product, variantName);
  return formatPrice(amount);
}

export function buildProductPricingView(product, variantName = "") {
  const source = getPricingSource(product, variantName);
  if (!source) return null;

  return {
    pricingType: source.pricingType,
    bulkPricing: source.bulkPricing,
    price: source.price,
    discountedPrice: source.discountedPrice,
  };
}
