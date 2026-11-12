import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import {
  getCartStepForItem,
  getDecreasedCartQuantityForProduct,
  resolveCartDefaults,
} from "../utils/cartDefaults";
import { isMultiVariant } from "../utils/productPricing";

function findCartLine(items, product) {
  if (!product?._id) return null;

  const { variantName, colorName } = resolveCartDefaults(product);
  const exact =
    items.find(
      (item) =>
        String(item._id) === String(product._id) &&
        (item.variantName || "") === variantName &&
        (item.colorName || "") === colorName &&
        (item.preOrderSlot || "") === (product.preOrderSlot || "")
    ) || null;

  if (exact) return exact;

  if (product.preOrderSlot) {
    const slotMatch = items.find((item) => String(item._id) === String(product._id) && (item.preOrderSlot || "") === product.preOrderSlot);
    if (slotMatch) return slotMatch;
  }

  return items.find((item) => String(item._id) === String(product._id)) || null;
}

export function useProductCartActions() {
  const { openAuthModal } = useAuth();
  const { items, addToCart, incrementCartItem, decrementCartItem } = useCart();

  const getCartLine = useCallback((product) => findCartLine(items, product), [items]);

  const getCartQuantity = useCallback(
    (product) => {
      if (!product?._id) return 0;

      if (isMultiVariant(product)) {
        return items
          .filter((item) => String(item._id) === String(product._id))
          .reduce((sum, item) => sum + (item.quantity || 0), 0);
      }

      return getCartLine(product)?.quantity || 0;
    },
    [items, getCartLine]
  );

  const handleAdd = useCallback(
    async (product, flySource) => {
      if (!product?._id) return null;

      const { variantName, colorName, quantity } = resolveCartDefaults(product);
      const result = await addToCart(product, quantity, {
        variantName,
        colorName,
        flySource,
        preOrderSlot: product.preOrderSlot || "",
      });

      if (result?.requiresLogin) {
        openAuthModal("login");
      }

      return result;
    },
    [addToCart, openAuthModal]
  );

  const handleIncrease = useCallback(
    async (product, flySource) => {
      if (!product?._id) return null;

      const line = getCartLine(product);
      const { variantName, colorName, quantity } = resolveCartDefaults(product);

      // The fly-to-cart animation only plays on the first add; repeated + taps stay instant.
      if (line) {
        const step = getCartStepForItem(line);
        await incrementCartItem({
          productId: line._id,
          variantName: line.variantName || "",
          colorName: line.colorName || "",
          step,
          preOrderSlot: line.preOrderSlot || "",
        });
        return { success: true };
      }

      const result = await addToCart(product, quantity, {
        variantName,
        colorName,
        flySource,
        preOrderSlot: product.preOrderSlot || "",
      });

      if (result?.requiresLogin) {
        openAuthModal("login");
      }

      return result;
    },
    [getCartLine, addToCart, incrementCartItem, openAuthModal]
  );

  const handleDecrease = useCallback(
    async (product) => {
      const line = getCartLine(product);
      if (!line) return;

      await decrementCartItem({
        productId: line._id,
        variantName: line.variantName || "",
        colorName: line.colorName || "",
        preOrderSlot: line.preOrderSlot || "",
        resolveNextQuantity: (currentQty) =>
          getDecreasedCartQuantityForProduct(product, currentQty, line.variantName || ""),
      });
    },
    [getCartLine, decrementCartItem]
  );

  return {
    getCartLine,
    getCartQuantity,
    handleAdd,
    handleIncrease,
    handleDecrease,
  };
}
