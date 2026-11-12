import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { getStoreSettings } from "../../api/api";
import {
  calculateShippingCharge,
} from "../../utils/orderSettings";
import { calculateOrderTotal } from "../../utils/gst";
import { getCartStepForItem, getDecreasedCartQuantityForItem } from "../../utils/cartDefaults";
import OptimizedImg from "../common/OptimizedImg";

const lineArgs = (item) => ({
  productId: item._id,
  variantName: item.variantName || "",
  colorName: item.colorName || "",
  preOrderSlot: item.preOrderSlot || "",
});

const formatPrice = (amount) => {
  const value = Number(amount) || 0;
  const digits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

export default function CartSidebar() {
  const { cartSidebarOpen, closeCartSidebar, items, incrementCartItem, decrementCartItem } = useCart();
  const { user, setAuthModal } = useAuth();
  const navigate = useNavigate();

  const [storeSettings, setStoreSettings] = useState(null);

  useEffect(() => {
    getStoreSettings().then((res) => {
      setStoreSettings(res.data.data);
    }).catch(() => {});
  }, []);

  if (!cartSidebarOpen) return null;

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.discountedPrice || item.price) * item.quantity, 0);
  const originalSubtotal = items.reduce((sum, item) => sum + (item.price || item.discountedPrice) * item.quantity, 0);
  const totalSavings = originalSubtotal - subtotal;

  const shipping = calculateShippingCharge(subtotal, storeSettings);
  const { total: grandTotal } = calculateOrderTotal(subtotal, shipping);

  const hasItems = items.length > 0;

  const handleCheckoutClick = () => {
    closeCartSidebar();
    if (!user) {
      setAuthModal("login");
    } else {
      navigate("/cart");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-slate-900/40" onClick={closeCartSidebar} />
      <div className="fixed inset-y-0 right-0 z-[100] flex w-full flex-col border-l border-slate-200 bg-slate-50 sm:w-[400px]">

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
          <button
            onClick={closeCartSidebar}
            aria-label="Close cart"
            className="-ml-1 rounded-md p-1 text-slate-700 transition-colors hover:bg-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-base font-semibold text-slate-900">My Cart</h2>
          {hasItems && (
            <span className="text-sm text-slate-500">
              ({itemCount} item{itemCount === 1 ? "" : "s"})
            </span>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {hasItems ? (
            <>
              {/* Items List */}
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {items.map((item) => (
                  <div
                    key={`${item._id}-${item.variantName}-${item.colorName}-${item.preOrderSlot || ""}`}
                    className="flex gap-3 p-3"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-white p-1">
                      {item.productImages?.[0] ? (
                        <OptimizedImg src={item.productImages[0]} alt={item.name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="h-full w-full rounded bg-slate-50" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <h4 className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900">{item.name}</h4>
                        <p className="mt-0.5 text-xs text-slate-500">{item.variantName || "1 pc"}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatPrice(item.discountedPrice || item.price)}
                          </span>
                          {item.price > item.discountedPrice && (
                            <span className="text-xs text-slate-400 line-through">{formatPrice(item.price)}</span>
                          )}
                        </div>

                        <div className="flex h-8 w-[84px] items-center justify-between rounded-md border border-[#0C831F] text-[#0C831F]">
                          <button
                            onClick={() =>
                              decrementCartItem({
                                ...lineArgs(item),
                                resolveNextQuantity: (currentQty) =>
                                  getDecreasedCartQuantityForItem({ ...item, quantity: currentQty }),
                              })
                            }
                            aria-label="Decrease quantity"
                            className="flex h-full w-7 items-center justify-center text-base transition-colors hover:bg-[#0C831F]/5"
                          >
                            −
                          </button>
                          <span className="text-[13px] font-semibold">{item.quantity}</span>
                          <button
                            onClick={() =>
                              incrementCartItem({ ...lineArgs(item), step: getCartStepForItem(item) })
                            }
                            aria-label="Increase quantity"
                            className="flex h-full w-7 items-center justify-center text-base transition-colors hover:bg-[#0C831F]/5"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bill Details */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Bill details</h3>
                <dl className="space-y-2.5 text-[13px] text-slate-600">
                  <div className="flex items-center justify-between">
                    <dt>Items total</dt>
                    <dd className="flex items-center gap-1.5">
                      {totalSavings > 0 && (
                        <span className="text-slate-400 line-through">{formatPrice(originalSubtotal)}</span>
                      )}
                      <span className="text-slate-900">{formatPrice(subtotal)}</span>
                    </dd>
                  </div>

                  <div className="flex items-center justify-between">
                    <dt>Delivery charge</dt>
                    <dd className={shipping > 0 ? "text-slate-900" : "font-medium text-[#0C831F]"}>
                      {shipping > 0 ? formatPrice(shipping) : "Free"}
                    </dd>
                  </div>

                  {totalSavings > 0 && (
                    <div className="flex items-center justify-between">
                      <dt>You save</dt>
                      <dd className="font-medium text-[#0C831F]">{formatPrice(totalSavings)}</dd>
                    </div>
                  )}

                  <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-slate-900">
                    <dt>Grand total</dt>
                    <dd>{formatPrice(grandTotal)}</dd>
                  </div>
                </dl>
              </div>

              {/* Cancellation Policy */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-1 text-[13px] font-semibold text-slate-900">Cancellation policy</h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  Orders cannot be cancelled once packed for delivery. In case of unexpected delays, a refund will be provided, if applicable.
                </p>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4 pt-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white">
                <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="mb-1 text-base font-semibold text-slate-900">Your cart is empty</h3>
              <p className="mb-5 max-w-[250px] text-[13px] text-slate-500">Looks like you haven't added anything to your cart yet.</p>
              <button
                onClick={closeCartSidebar}
                className="rounded-md bg-[#0C831F] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0A6C19]"
              >
                Start shopping
              </button>
            </div>
          )}
        </div>

        {/* Fixed Bottom Action Bar */}
        {hasItems && (
          <div className="border-t border-slate-200 bg-white p-4">
            <button
              onClick={handleCheckoutClick}
              className="flex w-full items-center justify-between rounded-md bg-[#0C831F] px-4 py-3 text-white transition-colors hover:bg-[#0A6C19]"
            >
              <div className="flex flex-col text-left">
                <span className="text-[15px] font-semibold leading-tight">{formatPrice(grandTotal)}</span>
                <span className="mt-0.5 text-[11px] text-white/80">Total</span>
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold">
                {user ? "Proceed to checkout" : "Login to proceed"}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
