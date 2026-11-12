import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { getCartStepForItem, getDecreasedCartQuantityForItem } from "../../utils/cartDefaults";
import AddToCartButton from "./AddToCartButton";
import ProductImageFrame from "./ProductImageFrame";

function orderItemToCartProduct(item) {
  return {
    _id: item.productId,
    name: item.name,
    price: item.price,
    discountedPrice: item.price,
    productImages: item.image ? [item.image] : [],
  };
}

function findBuyAgainCartLine(items, item) {
  return (
    items.find(
      (cartItem) =>
        String(cartItem._id) === String(item.productId) &&
        (cartItem.variantName || "") === (item.variantName || "") &&
        (cartItem.colorName || "") === (item.colorName || "")
    ) || null
  );
}

function formatPrice(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function BuyAgainCard({ item }) {
  const { openAuthModal } = useAuth();
  const { items, addToCart, incrementCartItem, decrementCartItem } = useCart();

  const cartLine = findBuyAgainCartLine(items, item);
  const cartQuantity = cartLine?.quantity || 0;
  const productUrl = `/product/${item.productId}`;

  const handleAdd = async (flySource) => {
    const result = await addToCart(orderItemToCartProduct(item), item.quantity || 1, {
      variantName: item.variantName || "",
      colorName: item.colorName || "",
      flySource,
    });

    if (result?.requiresLogin) {
      openAuthModal("login");
    }
  };

  const handleIncrease = async (flySource) => {
    if (cartLine) {
      await incrementCartItem({
        productId: cartLine._id,
        variantName: cartLine.variantName || "",
        colorName: cartLine.colorName || "",
        preOrderSlot: cartLine.preOrderSlot || "",
        step: getCartStepForItem(cartLine),
      });
      return;
    }

    await handleAdd(flySource);
  };

  const handleDecrease = async () => {
    if (!cartLine) return;

    await decrementCartItem({
      productId: cartLine._id,
      variantName: cartLine.variantName || "",
      colorName: cartLine.colorName || "",
      preOrderSlot: cartLine.preOrderSlot || "",
      resolveNextQuantity: (currentQty) =>
        getDecreasedCartQuantityForItem({ ...cartLine, quantity: currentQty }),
    });
  };

  return (
    <div className="flex w-[140px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border-light bg-white">
      <Link to={productUrl} className="block aspect-square overflow-hidden border-b border-border-light">
        <ProductImageFrame src={item.image} alt={item.name} />
      </Link>

      <div className="flex flex-1 flex-col p-2">
        <Link to={productUrl} className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-text-primary">
            {item.name}
          </p>
          <p className="mt-1 text-xs font-bold text-primary">{formatPrice(item.price)}</p>
        </Link>

        <div className="mt-2">
          {cartQuantity > 0 ? (
            <div className="inline-flex h-9 w-full items-stretch overflow-hidden rounded-lg border border-border-light bg-white">
              <button
                type="button"
                onClick={handleDecrease}
                className="flex h-full w-8 shrink-0 items-center justify-center text-base text-text-secondary transition hover:bg-mobile-surface"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="flex h-full min-w-0 flex-1 items-center justify-center border-x border-border-light text-xs font-bold text-text-primary">
                {cartQuantity}
              </span>
              <button
                type="button"
                onClick={() => handleIncrease()}
                className="flex h-full w-8 shrink-0 items-center justify-center text-base text-text-secondary transition hover:bg-mobile-surface"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <AddToCartButton
              onClick={(e) => handleAdd(e.currentTarget)}
              className="w-full !px-1.5 !text-[9px]"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default BuyAgainCard;
