import {
  getAvailableColors,
  getCartAdjustStep,
  getMinOrderQuantity,
  getQuantityStep,
  isMultiVariant,
  isProductInStock,
} from "./productPricing";

export function getProductPricingFromItem(item) {
  if (!item) return null;

  return {
    pricingType: item.pricingType,
    bulkPricing: item.bulkPricing,
    variantType: item.variantType,
    variants: item.variants,
    enableBulkGrades: item.enableBulkGrades,
    bulkGrades: item.bulkGrades,
    minOrderQuantity: item.minOrderQuantity,
    bulkMinOrderQuantity: item.bulkMinOrderQuantity,
    maxOrderQuantity: item.maxOrderQuantity,
    stepByQuantity: item.stepByQuantity,
  };
}

export function resolveCartDefaults(product, isBulkUser = false) {
  let variantName = "";
  if (isMultiVariant(product)) {
    const firstInStockVariant = product.variants.find((variant) =>
      isProductInStock(product, variant.name)
    );
    variantName = firstInStockVariant?.name || product.variants?.[0]?.name || "";
  }

  const availableColors = getAvailableColors(product, variantName);
  const colorName = availableColors[0]?.name || "";
  const quantity = getMinOrderQuantity(product, variantName, 1, isBulkUser);

  return { variantName, colorName, quantity };
}

export function getCartStepForProduct(product, variantName = "") {
  return getCartAdjustStep(product, variantName, 1);
}

export function getCartMoqForProduct(product, variantName = "") {
  return getMinOrderQuantity(product, variantName, 1);
}

export function getCartStepForItem(item) {
  if (!item) return 1;

  return getCartAdjustStep(
    getProductPricingFromItem(item),
    item.variantName || "",
    1
  );
}

export function getCartMoqForItem(item) {
  if (!item) return 1;

  return getMinOrderQuantity(
    getProductPricingFromItem(item),
    item.variantName || "",
    1
  );
}

export function getDecreasedCartQuantity(currentQty, step, moq) {
  const qty = Number(currentQty) || 0;
  const safeStep = Number(step) || 1;
  const floor = Number(moq ?? step) || 1;

  if (qty <= floor) return 0;

  const next = qty - safeStep;
  return next < floor ? floor : next;
}

export function getDecreasedCartQuantityForItem(item) {
  if (!item) return 0;

  const step = getCartStepForItem(item);
  const moq = getCartMoqForItem(item);
  return getDecreasedCartQuantity(item.quantity, step, moq);
}

export function getDecreasedCartQuantityForProduct(product, currentQty, variantName = "") {
  const step = getCartStepForProduct(product, variantName);
  const moq = getCartMoqForProduct(product, variantName);
  return getDecreasedCartQuantity(currentQty, step, moq);
}
