import { getPricingSource, getUnitPriceForQuantity, getVariantStock } from "./productPricing";

/** MRP of the chosen variant (multi-size products), else the product's own MRP. */
function lineMrp(product, variantName) {
  const variantMrp = Number(getPricingSource(product, variantName)?.price);
  return Number.isFinite(variantMrp) && variantMrp > 0 ? variantMrp : product?.price;
}

export function matchesCartLine(item, productId, variantName = "", colorName = "", preOrderSlot = "") {
  return (
    String(item._id) === String(productId) &&
    (item.variantName || "") === (variantName || "") &&
    (item.colorName || "") === (colorName || "") &&
    (item.preOrderSlot || "") === (preOrderSlot || "")
  );
}

export function findCartLine(items, productId, variantName = "", colorName = "", preOrderSlot = "") {
  return items.find((item) => matchesCartLine(item, productId, variantName, colorName, preOrderSlot)) || null;
}

export function mapCartItems(cart) {
  if (!cart?.items?.length) return [];

  return cart.items
    .filter((item) => item.product && item.product.isActive !== false)
    .map((item) => {
      const variantName = item.variantName || "";
      const unitPrice = getUnitPriceForQuantity(item.product, item.quantity, variantName);

      return {
        _id: item.product._id,
        variantName,
        colorName: item.colorName || "",
        name: item.product.name,
        brandName: item.product.brandName,
        price: lineMrp(item.product, variantName),
        discountedPrice: unitPrice,
        pricingType: item.product.pricingType,
        bulkPricing: item.product.bulkPricing,
        variantType: item.product.variantType,
        variants: item.product.variants,
        enableBulkGrades: item.product.enableBulkGrades,
        bulkGrades: item.product.bulkGrades,
        minOrderQuantity: item.product.minOrderQuantity,
        maxOrderQuantity: item.product.maxOrderQuantity ?? item.product.maxOrderQty,
        stepByQuantity: item.product.stepByQuantity,
        productImages: item.product.productImages,
        stock: getVariantStock(item.product, variantName),
        quantity: item.quantity,
        preOrderSlot: item.preOrderSlot || "",
        section: item.product.section,
        storeType: item.product.storeType,
      };
    });
}

function pricingFromLine(item) {
  return {
    price: item.price,
    discountedPrice: item.discountedPrice,
    pricingType: item.pricingType,
    bulkPricing: item.bulkPricing,
    variantType: item.variantType,
    variants: item.variants,
    enableBulkGrades: item.enableBulkGrades,
    bulkGrades: item.bulkGrades,
    minOrderQuantity: item.minOrderQuantity,
    maxOrderQuantity: item.maxOrderQuantity,
    stepByQuantity: item.stepByQuantity,
  };
}

export function buildCartLine(product, quantity, variantName = "", colorName = "", preOrderSlot = "") {
  const qty = Number(quantity) || 0;

  return {
    _id: product._id,
    variantName: variantName || "",
    colorName: colorName || "",
    preOrderSlot: preOrderSlot || "",
    name: product.name,
    brandName: product.brandName,
    price: lineMrp(product, variantName),
    discountedPrice:
      getUnitPriceForQuantity(product, qty, variantName) ||
      product.salePrice ||
      product.discountedPrice ||
      product.price ||
      0,
    pricingType: product.pricingType,
    bulkPricing: product.bulkPricing,
    variantType: product.variantType,
    variants: product.variants,
    enableBulkGrades: product.enableBulkGrades,
    bulkGrades: product.bulkGrades,
    minOrderQuantity: product.minOrderQuantity,
    maxOrderQuantity: product.maxOrderQuantity ?? product.maxOrderQty,
    stepByQuantity: product.stepByQuantity,
    productImages:
      (Array.isArray(product.productImages) && product.productImages.length
        ? product.productImages
        : product.productImages) || [],
    stock: getVariantStock(product, variantName || ""),
    quantity: qty,
    section: product.section,
    storeType: product.storeType,
  };
}

export function removeLine(items, productId, variantName = "", colorName = "", preOrderSlot = "") {
  return items.filter((item) => !matchesCartLine(item, productId, variantName, colorName, preOrderSlot));
}

export function setLineQuantity(items, productId, variantName, colorName, quantity, preOrderSlot = "") {
  const qty = Number(quantity);

  if (!Number.isFinite(qty) || qty < 1) {
    return removeLine(items, productId, variantName, colorName, preOrderSlot);
  }

  return items.map((item) => {
    if (!matchesCartLine(item, productId, variantName, colorName, preOrderSlot)) return item;

    const pricing = pricingFromLine(item);
    return {
      ...item,
      quantity: qty,
      discountedPrice: getUnitPriceForQuantity(pricing, qty, variantName),
    };
  });
}

export function addOrMergeLine(items, product, quantity, variantName = "", colorName = "", preOrderSlot = "") {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) return items;

  const existing = findCartLine(items, product._id, variantName, colorName, preOrderSlot);
  if (existing) {
    return setLineQuantity(items, product._id, variantName, colorName, existing.quantity + qty, preOrderSlot);
  }

  return [...items, buildCartLine(product, qty, variantName, colorName, preOrderSlot)];
}
