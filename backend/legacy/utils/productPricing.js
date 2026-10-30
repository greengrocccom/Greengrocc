export function normalizeBulkSlabInput(slabs = []) {
  if (!Array.isArray(slabs)) return [];

  return slabs
    .map((slab) => ({
      maxQuantity:
        slab.maxQuantity === "" || slab.maxQuantity == null
          ? null
          : Number(slab.maxQuantity),
      pricePerUnit: Number(
        slab.price ?? slab.pricePerUnit ?? slab.discountedPrice ?? slab.discounted_price
      ),
      originalPricePerUnit:
        slab.originalPricePerUnit !== undefined &&
        slab.originalPricePerUnit !== null &&
        slab.originalPricePerUnit !== ""
          ? Number(slab.originalPricePerUnit)
          : null,
    }))
    .filter(
      (slab) => Number.isFinite(slab.pricePerUnit) && slab.pricePerUnit >= 0
    );
}

export function buildBulkSlabs(rawSlabs = [], minOrderQuantity = null) {
  const configuredMin = Number(minOrderQuantity);
  const entries = normalizeBulkSlabInput(rawSlabs);

  if (entries.length === 0) {
    return { error: "At least one pricing slab is required for bulk pricing" };
  }

  const slabs = [];
  let nextMin =
    Number.isFinite(configuredMin) && configuredMin >= 1 ? configuredMin : 1;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;

    if (!isLast && !Number.isFinite(entry.maxQuantity)) {
      return { error: `Slab ${i + 1} must have a max quantity` };
    }

    if (Number.isFinite(entry.maxQuantity) && entry.maxQuantity < nextMin) {
      return {
        error: `Slab ${i + 1} max quantity must be at least ${nextMin}`,
      };
    }

    slabs.push({
      minQuantity: nextMin,
      maxQuantity: entry.maxQuantity,
      pricePerUnit: entry.pricePerUnit,
      ...(Number.isFinite(entry.originalPricePerUnit) && entry.originalPricePerUnit > 0
        ? { originalPricePerUnit: entry.originalPricePerUnit }
        : {}),
    });

    if (Number.isFinite(entry.maxQuantity)) {
      nextMin = entry.maxQuantity + 1;
    }
  }

  return { slabs };
}

export function normalizeOptionalQuantity(value) {
  if (value === "" || value == null || value === undefined) {
    return null;
  }

  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) {
    return null;
  }

  return num;
}

export function validateBulkPricing(bulkPricing, minOrderQuantity = null) {
  const built = buildBulkSlabs(bulkPricing?.slabs || [], minOrderQuantity);

  if (built.error) {
    return { valid: false, message: built.error };
  }

  return {
    valid: true,
    bulkPricing: {
      slabs: built.slabs,
    },
  };
}

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

export function getBulkGrade(product, gradeOrVariantName = "") {
  const grade =
    parseBulkGradeKey(gradeOrVariantName) ||
    String(gradeOrVariantName || "").trim().toUpperCase();
  if (!["A", "B", "C"].includes(grade)) return null;
  if (!Array.isArray(product?.bulkGrades)) return null;
  return product.bulkGrades.find((entry) => entry.grade === grade) || null;
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
  if (bulkGrade && (product?.enableBulkGrades || parseBulkGradeKey(variantName))) {
    if (bulkGrade.isAvailable === false) return false;
    return true;
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
  if (isMultiVariant(product)) {
    return product.variants.some((variant) =>
      typeof variant.inStock === "boolean" ? variant.inStock : (variant.stock ?? 0) > 0
    )
      ? IN_STOCK_MAX_QTY
      : 0;
  }

  return isProductInStock(product) ? IN_STOCK_MAX_QTY : 0;
}

export function getPricingSource(product, variantName) {
  const productMoq =
    product?.minOrderQuantity ?? product?.bulkPricing?.minOrderQuantity ?? null;
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
    discountedPrice: product?.discountedPrice,
    minOrderQuantity: productMoq,
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
  return 1;
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

export function getQuantityStep(product, variantName = "", fallback = 1) {
  const source = getPricingSource(product, variantName);
  if (!source) return fallback;

  const step = Number(source.stepByQuantity);
  if (Number.isFinite(step) && step > 0) {
    return step;
  }

  return fallback;
}

export function getCartAdjustStep(product, variantName = "", fallback = 1) {
  const source = getPricingSource(product, variantName);
  if (!source) return fallback;

  const step = Number(source.stepByQuantity);
  if (Number.isFinite(step) && step > 0) {
    return step;
  }

  return fallback;
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

export function deriveSinglePriceFieldsFromBulk(bulkPricing) {
  const slabs = bulkPricing.slabs;
  const minUnit = Math.min(...slabs.map((slab) => slab.pricePerUnit));
  const maxUnit = Math.max(...slabs.map((slab) => slab.pricePerUnit));

  return {
    price: maxUnit,
    discountedPrice: minUnit,
    discountedPercent:
      maxUnit > 0 ? Math.round(((maxUnit - minUnit) / maxUnit) * 100) : 0,
  };
}

export function resolvePricingFields(payload) {
  const minOrderQuantity = normalizeOptionalQuantity(payload.minOrderQuantity);
  const stepByQuantity = normalizeOptionalQuantity(payload.stepByQuantity);

  if (payload.pricingType === "bulk") {
    const bulkCheck = validateBulkPricing(payload.bulkPricing, minOrderQuantity);
    if (!bulkCheck.valid) {
      return { error: bulkCheck.message };
    }

    const derived = deriveSinglePriceFieldsFromBulk(bulkCheck.bulkPricing);
    const price =
      payload.price !== undefined && payload.price !== null && payload.price !== ""
        ? Number(payload.price)
        : derived.price;
    const discountedPrice =
      payload.discountedPrice !== undefined &&
      payload.discountedPrice !== null &&
      payload.discountedPrice !== ""
        ? Number(payload.discountedPrice)
        : derived.discountedPrice;
    const discountedPercent =
      payload.discountedPercent !== undefined &&
      payload.discountedPercent !== null &&
      payload.discountedPercent !== ""
        ? Number(payload.discountedPercent)
        : price > 0
          ? Math.round(((price - discountedPrice) / price) * 100)
          : 0;

    return {
      pricingType: "bulk",
      bulkPricing: bulkCheck.bulkPricing,
      minOrderQuantity,
      stepByQuantity,
      price,
      discountedPrice,
      discountedPercent: Math.max(0, Math.min(100, discountedPercent)),
    };
  }

  const missing = [];
  if (payload.price === undefined || payload.price === null || payload.price === "") {
    missing.push("price");
  }
  if (
    payload.discountedPrice === undefined ||
    payload.discountedPrice === null ||
    payload.discountedPrice === ""
  ) {
    missing.push("discountedPrice");
  }

  if (missing.length > 0) {
    return {
      error: `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required for single pricing`,
    };
  }

  const price = Number(payload.price);
  const discountedPrice = Number(payload.discountedPrice);
  const discountedPercent =
    payload.discountedPercent === undefined ||
    payload.discountedPercent === null ||
    payload.discountedPercent === ""
      ? price > 0
        ? Math.round(((price - discountedPrice) / price) * 100)
        : 0
      : Number(payload.discountedPercent);

  return {
    pricingType: "single",
    bulkPricing: { slabs: [] },
    minOrderQuantity,
    stepByQuantity,
    price,
    discountedPrice,
    discountedPercent: Math.max(0, Math.min(100, discountedPercent)),
  };
}

export const PRODUCT_PRICING_SELECT =
  "name brandName price discountedPrice discountedPercent productImages videoUrl stock inStock subcategory subcategories pricingType bulkPricing variantType variants colors minOrderQuantity maxOrderQuantity stepByQuantity cardGlowColor badge isActive section storeType";
