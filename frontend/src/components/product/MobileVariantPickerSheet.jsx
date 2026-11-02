import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import {
  getDecreasedCartQuantityForProduct,
  getCartStepForProduct,
} from "../../utils/cartDefaults";
import {
  getAvailableColors,
  getMinOrderQuantity,
  getProductListPriceInfo,
  isProductInStock,
} from "../../utils/productPricing";
import ProductImageFrame from "./ProductImageFrame";
import ProductPriceDisplay from "./ProductPriceDisplay";
import AddToCartButton from "./AddToCartButton";

function findVariantCartLine(items, product, variantName) {
  const productId = String(product?._id || "");
  const name = (variantName || "").trim();
  if (!productId || !name) return null;

  return (
    items.find(
      (item) =>
        String(item._id) === productId && (item.variantName || "").trim() === name
    ) || null
  );
}

function resolveColorForVariant(product, variant, variantName) {
  const fromVariant = variant?.colors?.[0]?.name?.trim();
  if (fromVariant) return fromVariant;
  return getAvailableColors(product, variantName)[0]?.name?.trim() || "";
}

function VariantRow({ product, variant, image, onClose, preOrderSlot }) {
  const { items, addToCart, incrementCartItem, decrementCartItem } = useCart();
  const isBulkUser = user?.accountType === "bulk";
  const { openAuthModal } = useAuth();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const variantName = (variant.name || "").trim();
  const inStock = isProductInStock(product, variantName);
  const colorName = resolveColorForVariant(product, variant, variantName);
  const { hasDiscount, originalPrice, salePrice } = getProductListPriceInfo(
    product,
    variantName
  );
  const discountPct =
    hasDiscount && originalPrice > 0
      ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
      : 0;

  const cartLine = findVariantCartLine(items, product, variantName);
  const quantity = cartLine?.quantity || 0;

  const handleAdd = async (event) => {
    if (!inStock || adding) return;

    setError("");
    setAdding(true);
    const flySource = event.currentTarget;

    try {
      const moq = getMinOrderQuantity(product, variantName, 1, isBulkUser);
      const result = await addToCart(product, moq, {
        variantName,
        colorName,
        flySource,
        preOrderSlot,
      });

      if (result?.requiresLogin) {
        openAuthModal("login");
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Could not add to cart");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleIncrease = async () => {
    if (!cartLine) return;
    const step = getCartStepForProduct(product, variantName);
    await incrementCartItem({
      productId: cartLine._id,
      variantName: cartLine.variantName || "",
      colorName: cartLine.colorName || "",
      step,
      preOrderSlot: cartLine.preOrderSlot || "",
    });
  };

  const handleDecrease = async () => {
    if (!cartLine) return;

    await decrementCartItem({
      productId: cartLine._id,
      variantName: cartLine.variantName || "",
      colorName: cartLine.colorName || "",
      preOrderSlot: cartLine.preOrderSlot || "",
      resolveNextQuantity: (currentQty) =>
        getDecreasedCartQuantityForProduct(product, currentQty, cartLine.variantName || ""),
    });
  };

  return (
    <div className="flex items-center gap-2 border-b border-gray-100 py-2 last:border-b-0">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-gray-100 bg-white">
        <ProductImageFrame src={image} alt={variantName} className="!aspect-square !h-full !w-full" />
        {discountPct > 0 ? (
          <span className="absolute left-0 top-0 rounded-br bg-blue-600 px-0.5 py-px text-[8px] font-bold leading-none text-white">
            {discountPct}% OFF
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-gray-900">{variantName}</p>
        <ProductPriceDisplay
          product={product}
          variantName={variantName}
          size="sm"
          className="mt-0.5 [&_span:first-child]:text-[10px] [&_span:last-child]:text-xs"
        />
        {!inStock ? (
          <p className="mt-0.5 text-[10px] font-medium text-red-500">Out of stock</p>
        ) : error ? (
          <p className="mt-0.5 text-[10px] font-medium text-red-500">{error}</p>
        ) : null}
      </div>

      <div className="shrink-0">
        {quantity > 0 ? (
          <div className="inline-flex w-[88px] items-center overflow-hidden rounded-lg border border-border-light bg-white">
            <button
              type="button"
              onClick={handleDecrease}
              className="flex h-8 w-8 items-center justify-center text-base text-text-secondary transition hover:bg-mobile-surface hover:text-text-primary"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="flex h-8 min-w-[28px] flex-1 items-center justify-center border-x border-border-light text-sm font-bold text-text-primary">
              {quantity}
            </span>
            <button
              type="button"
              onClick={handleIncrease}
              disabled={!inStock}
              className="flex h-8 w-8 items-center justify-center text-base text-text-secondary transition hover:bg-mobile-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        ) : (
          <AddToCartButton
            variant="outline"
            onClick={handleAdd}
            disabled={!inStock || adding}
            className="!min-h-[32px] !px-2.5 !py-1.5 !text-[10px]"
          />
        )}
      </div>
    </div>
  );
}

function MobileVariantPickerSheet({ product, open, onClose, preOrderSlot = "" }) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open || !product) return null;

  const image = product.productImages?.[0];
  const variants = product.variants || [];

  return createPortal(
    <div
      className="fixed inset-0 z-[220] bg-black/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[72vh] w-full max-w-md lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pb-1.5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900/90 text-white shadow-lg"
            aria-label="Close"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-hidden rounded-t-xl bg-white shadow-2xl lg:rounded-xl">
          <div className="border-b border-gray-100 px-3 py-2.5">
            <h2 className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">
              {product.name}
            </h2>
            <p className="mt-0.5 text-[10px] text-gray-500">Choose a variant</p>
          </div>

          <div className="max-h-[48vh] overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {variants.map((variant) => (
              <VariantRow
                key={variant.name}
                product={product}
                variant={variant}
                image={image}
                onClose={onClose}
                preOrderSlot={preOrderSlot}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default MobileVariantPickerSheet;
