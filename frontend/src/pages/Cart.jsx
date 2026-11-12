import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { clearBuyNowCheckout } from "../utils/checkoutSession";
import {
  getCartStepForItem,
  getDecreasedCartQuantityForItem,
} from "../utils/cartDefaults";
import {
  calculateShippingCharge,
  getMinimumOrderShortfall,
  meetsMinimumOrder,
  mergeStoreSettings,
  nextCheaperShippingSlab,
} from "../utils/orderSettings";
import { calculateOrderTotal } from "../utils/gst";
import { formatCouponHeadline, formatCouponUnlockMessage } from "../utils/couponDisplay";
import { useStoreSettingsQuery } from "../hooks/queries/useStoreSettingsQuery";
import { useAvailableCouponsQuery } from "../hooks/queries/useAvailableCouponsQuery";
import OptimizedImg from "../components/common/OptimizedImg";

const BRAND = "#0C831F";

const formatPrice = (amount) => {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const lineKey = (item) =>
  `${item._id}-${item.variantName || "default"}-${item.colorName || "default"}`;

function Card({ className = "", children }) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
      {children}
    </p>
  );
}

function Stepper({ quantity, disabled, onDecrease, onIncrease }) {
  const btn =
    "flex h-full w-8 items-center justify-center text-white transition active:bg-black/10 disabled:opacity-50";
  return (
    <div
      className="flex h-8 w-[88px] items-center justify-between overflow-hidden rounded-lg shadow-sm"
      style={{ backgroundColor: BRAND }}
    >
      <button
        type="button"
        onClick={onDecrease}
        disabled={disabled}
        aria-label={quantity <= 1 ? "Remove item" : "Decrease quantity"}
        className={btn}
      >
        {quantity <= 1 ? (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4h6v3" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" d="M5 12h14" />
          </svg>
        )}
      </button>
      <span className="text-[13px] font-bold tabular-nums text-white">{quantity}</span>
      <button type="button" onClick={onIncrease} disabled={disabled} aria-label="Increase quantity" className={btn}>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

function CartLine({ item, disabled, onIncrease, onDecrease }) {
  const unit = Number(item.discountedPrice) || 0;
  const mrp = Number(item.price) || 0;
  const hasDiscount = mrp > unit;
  const meta = [item.variantName, item.colorName].filter(Boolean).join(" · ");

  return (
    <li className="flex gap-3 px-4 py-3.5">
      <Link
        to={`/product/${item._id}`}
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100"
      >
        {item.productImages?.[0] ? (
          <OptimizedImg src={item.productImages[0]} alt={item.name} className="h-full w-full object-contain p-1" />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to={`/product/${item._id}`}
          className="line-clamp-2 break-words text-[13.5px] font-semibold leading-snug text-slate-900"
        >
          {item.name}
        </Link>
        {meta ? <p className="mt-0.5 text-[12px] text-slate-500">{meta}</p> : null}
        <div className="mt-auto flex items-baseline gap-1.5 pt-1.5">
          <span className="text-[13px] font-bold text-slate-900">{formatPrice(unit)}</span>
          {hasDiscount ? (
            <>
              <span className="text-[11.5px] text-slate-400 line-through">{formatPrice(mrp)}</span>
              <span className="text-[11px] font-bold" style={{ color: BRAND }}>
                {Math.round(((mrp - unit) / mrp) * 100)}% off
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <Stepper
          quantity={item.quantity}
          disabled={disabled}
          onDecrease={() => onDecrease(item)}
          onIncrease={() => onIncrease(item)}
        />
        <span className="text-[13.5px] font-bold text-slate-900">
          {formatPrice(unit * item.quantity)}
        </span>
      </div>
    </li>
  );
}

function DeliveryNudge({ subtotal, settings }) {
  if (!settings) return null;
  const slab = nextCheaperShippingSlab(subtotal, settings);
  const shipping = calculateShippingCharge(subtotal, settings);

  if (!slab) {
    if (shipping > 0) return null;
    return (
      <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
        <TruckIcon className="h-5 w-5 shrink-0" />
        <p className="text-[12.5px] font-semibold text-emerald-900">Yay! You get FREE delivery on this order</p>
      </div>
    );
  }

  const remaining = Math.max(0, slab.orderAmount - subtotal);
  const progress = Math.min(100, Math.round((subtotal / slab.orderAmount) * 100));
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
      <div className="flex items-center gap-2.5">
        <TruckIcon className="h-5 w-5 shrink-0" />
        <p className="text-[12.5px] text-slate-700">
          Add <strong className="text-slate-900">{formatPrice(remaining)}</strong> more for{" "}
          <strong style={{ color: BRAND }}>
            {slab.shippingCharge <= 0 ? "FREE delivery" : `${formatPrice(slab.shippingCharge)} delivery`}
          </strong>
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: BRAND }} />
      </div>
    </div>
  );
}

function TruckIcon({ className }) {
  return (
    <svg className={className} style={{ color: BRAND }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  );
}

function CouponsCard({ coupons }) {
  const usable = coupons.filter((c) => !String(c.redemptionBlocked || "").trim());
  const best =
    usable.filter((c) => c.unlocked).sort((a, b) => (b.discountAmount || 0) - (a.discountAmount || 0))[0] ||
    usable.filter((c) => !c.unlocked).sort((a, b) => (a.amountNeeded || 0) - (b.amountNeeded || 0))[0];

  return (
    <Card>
      <Link to="/coupons" className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50" style={{ color: BRAND }}>
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          {best ? (
            <>
              <p className="truncate text-[13px] font-bold text-slate-900">{formatCouponHeadline(best)}</p>
              <p className={`truncate text-[11.5px] font-medium ${best.unlocked ? "text-emerald-700" : "text-amber-700"}`}>
                {formatCouponUnlockMessage(best)} · Code <span className="font-bold">{best.code}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-bold text-slate-900">Apply coupon</p>
              <p className="text-[11.5px] text-slate-500">Browse offers available for you</p>
            </>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-bold" style={{ color: BRAND }}>
          {usable.length > 1 ? `${usable.length} offers` : "View"}
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </span>
      </Link>
    </Card>
  );
}

function BillRow({ label, children, muted }) {
  return (
    <div className={`flex items-center justify-between text-[13px] ${muted ? "text-slate-500" : "text-slate-700"}`}>
      <span>{label}</span>
      <span className="flex items-center gap-1.5">{children}</span>
    </div>
  );
}

function BillCard({ itemCount, subtotal, mrpTotal, shipping, total, settingsReady }) {
  return (
    <Card className="px-4 py-4">
      <div className="space-y-2.5">
        <BillRow label={`Item total (${itemCount} ${itemCount === 1 ? "item" : "items"})`}>
          {mrpTotal > subtotal ? (
            <span className="text-[12px] text-slate-400 line-through">{formatPrice(mrpTotal)}</span>
          ) : null}
          <span className="font-semibold text-slate-900">{formatPrice(subtotal)}</span>
        </BillRow>
        <BillRow label="Delivery fee">
          {!settingsReady ? (
            <span className="text-slate-400">Calculating…</span>
          ) : shipping > 0 ? (
            <span className="font-semibold text-slate-900">{formatPrice(shipping)}</span>
          ) : (
            <span className="font-bold" style={{ color: BRAND }}>FREE</span>
          )}
        </BillRow>
        <BillRow label="Taxes & charges" muted>
          <span>Included</span>
        </BillRow>
      </div>
      <div className="my-3 border-t border-dashed border-slate-200" />
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-slate-900">To pay</span>
        <span className="text-[16px] font-extrabold text-slate-900">{formatPrice(total)}</span>
      </div>
    </Card>
  );
}

function CheckoutButton({ canCheckout, user, openAuthModal, className = "", children }) {
  const base = `flex items-center justify-center gap-1.5 rounded-xl text-[14.5px] font-bold text-white transition active:scale-[0.99] ${className}`;
  if (!canCheckout) {
    return (
      <button type="button" disabled className={`${base} cursor-not-allowed bg-slate-300`}>
        {children}
      </button>
    );
  }
  if (!user) {
    return (
      <button type="button" onClick={() => openAuthModal("login")} className={base} style={{ backgroundColor: BRAND }}>
        Login to continue
      </button>
    );
  }
  return (
    <Link to="/checkout" onClick={() => clearBuyNowCheckout()} className={base} style={{ backgroundColor: BRAND }}>
      {children}
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

function EmptyCart() {
  return (
    <Card className="mx-auto max-w-md px-6 py-14 text-center">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50" style={{ color: BRAND }}>
        <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
        </svg>
      </div>
      <h2 className="text-[17px] font-bold text-slate-900">Your cart is empty</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-[13px] text-slate-500">
        Fresh fruits, vegetables and daily essentials are just a tap away.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white"
        style={{ backgroundColor: BRAND }}
      >
        Start shopping
      </Link>
    </Card>
  );
}

function Cart() {
  const { user, openAuthModal } = useAuth();
  const { items, removeFromCart, incrementCartItem, decrementCartItem, loading, loadCart } = useCart();
  const navigate = useNavigate();
  const [clearing, setClearing] = useState(false);
  const { data: storeSettings = null, isSuccess: settingsReady } = useStoreSettingsQuery();

  useEffect(() => {
    clearBuyNowCheckout();
    if (user) loadCart();
  }, [user, loadCart]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.discountedPrice * item.quantity, 0);
  const mrpTotal = items.reduce(
    (sum, item) => sum + Math.max(item.price || 0, item.discountedPrice) * item.quantity,
    0
  );
  const savings = Math.max(0, mrpTotal - subtotal);
  const shipping = calculateShippingCharge(subtotal, storeSettings);
  const { total } = calculateOrderTotal(subtotal, shipping);
  const canCheckout = items.length > 0 && meetsMinimumOrder(subtotal, storeSettings);
  const shortfall = getMinimumOrderShortfall(subtotal, storeSettings);
  const minimumOrderValue = mergeStoreSettings(storeSettings).minimumOrderValue;

  const { data: coupons = [] } = useAvailableCouponsQuery(subtotal, { enabled: items.length > 0 });

  const handleBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate("/", { replace: true });
  };

  const handleClearCart = async () => {
    if (!items.length || clearing) return;
    if (!window.confirm("Remove all items from your cart?")) return;
    setClearing(true);
    try {
      // Sequential to avoid concurrent writes to the same cart document.
      for (const item of items) {
        await removeFromCart(item._id, item.variantName, item.colorName, item.preOrderSlot || "");
      }
    } finally {
      setClearing(false);
    }
  };

  const busy = loading || clearing;
  const increase = (item) =>
    incrementCartItem({
      productId: item._id,
      variantName: item.variantName || "",
      colorName: item.colorName || "",
      preOrderSlot: item.preOrderSlot || "",
      step: getCartStepForItem(item),
    });
  const decrease = (item) =>
    decrementCartItem({
      productId: item._id,
      variantName: item.variantName || "",
      colorName: item.colorName || "",
      preOrderSlot: item.preOrderSlot || "",
      resolveNextQuantity: (currentQty) =>
        getDecreasedCartQuantityForItem({ ...item, quantity: currentQty }),
    });

  const minimumWarning =
    !canCheckout && items.length > 0 && shortfall > 0 ? (
      <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-[12.5px] text-amber-900">
          Add <strong>{formatPrice(shortfall)}</strong> more to place your order. Minimum order is{" "}
          {formatPrice(minimumOrderValue)}.
        </p>
      </div>
    ) : null;

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#F3F5F9] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 sm:px-4">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="text-[16px] font-bold">My Cart</h1>
            {itemCount > 0 ? (
              <p className="truncate text-[11.5px] text-slate-500">
                {itemCount} {itemCount === 1 ? "item" : "items"}
                {savings > 0 ? (
                  <>
                    {" · "}
                    <span className="font-semibold" style={{ color: BRAND }}>
                      Saving {formatPrice(savings)}
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={handleClearCart}
              disabled={busy}
              className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-6xl px-3 pb-32 pt-3 sm:px-4 lg:pb-12 lg:pt-6">
        {loading && !items.length ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer-loading h-24 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="pt-6">
            <EmptyCart />
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
            <div className="min-w-0 space-y-3">
              {savings > 0 ? (
                <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2.5 ring-1 ring-emerald-100">
                  <span className="text-base" aria-hidden="true">🎉</span>
                  <p className="text-[12.5px] font-semibold text-emerald-900">
                    You&apos;re saving <span style={{ color: BRAND }}>{formatPrice(savings)}</span> on this order
                  </p>
                </div>
              ) : null}

              <DeliveryNudge subtotal={subtotal} settings={storeSettings} />

              <Card>
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <CartLine
                      key={lineKey(item)}
                      item={item}
                      disabled={clearing}
                      onIncrease={increase}
                      onDecrease={decrease}
                    />
                  ))}
                </ul>
                <Link
                  to="/"
                  className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-[13px] font-semibold"
                  style={{ color: BRAND }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}>
                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                  Add more items
                </Link>
              </Card>
            </div>

            <aside className="min-w-0 space-y-3 lg:sticky lg:top-20">
              <div>
                <SectionLabel>Offers & benefits</SectionLabel>
                <CouponsCard coupons={coupons} />
              </div>
              <div>
                <SectionLabel>Bill details</SectionLabel>
                <BillCard
                  itemCount={itemCount}
                  subtotal={subtotal}
                  mrpTotal={mrpTotal}
                  shipping={shipping}
                  total={total}
                  settingsReady={settingsReady}
                />
              </div>
              {minimumWarning}
              <p className="px-1 text-[11px] leading-relaxed text-slate-500">
                Review your order before checkout. Prices and availability are confirmed at the next step.
              </p>
              <CheckoutButton
                canCheckout={canCheckout}
                user={user}
                openAuthModal={openAuthModal}
                className="hidden h-12 w-full lg:flex"
              >
                Proceed to checkout
              </CheckoutButton>
            </aside>
          </div>
        )}
      </main>

      {items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pt-2.5 shadow-[0_-6px_20px_rgba(15,23,42,0.06)] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 leading-tight">
              <p className="text-[17px] font-extrabold text-slate-900">{formatPrice(total)}</p>
              <p className="text-[11px] font-medium text-slate-500">
                {savings > 0 ? (
                  <span style={{ color: BRAND }}>Saved {formatPrice(savings)}</span>
                ) : (
                  "Total to pay"
                )}
              </p>
            </div>
            <CheckoutButton
              canCheckout={canCheckout}
              user={user}
              openAuthModal={openAuthModal}
              className="ml-auto h-12 flex-1"
            >
              Proceed to checkout
            </CheckoutButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Cart;
