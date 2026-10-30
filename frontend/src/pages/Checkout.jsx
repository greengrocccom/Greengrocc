import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Banknote, Bike, Check, Coins, CreditCard, Gift, Receipt, Store, Tag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useAvailableCouponsQuery } from "../hooks/queries/useAvailableCouponsQuery";
import { queryKeys } from "../hooks/queries/queryKeys";
import { queryClient } from "../lib/queryClient";
import {
  BillRow,
  Card,
  CheckoutLine,
  CouponRow,
  DashedDivider,
  SectionLabel,
  SlideToPay,
} from "../components/checkout/CheckoutParts";
import { formatCouponHeadline, formatCouponUnlockMessage } from "../utils/couponDisplay";
import { getCartStepForItem, getDecreasedCartQuantityForItem } from "../utils/cartDefaults";
import {
  getAddresses,
  addAddress,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getStoreSettings,
  createCheckoutAttempt,
  validateCoupon,
  validateGiftCard,
  placeOrder,
  getMyRewardPoints,
  getRewardSettings,
  getNearestStore,
  getPreOrderSlotAvailability,
} from "../api/api";
import { formatPreOrderDay, formatSlotLabel, slotAvailabilityText } from "../utils/preOrderSlots";
import {
  DEPARTMENT,
  FULFILLMENT,
  departmentEtaText,
  departmentForItem,
  groupItemsByDepartment,
  nearestStoreParams,
} from "../utils/departments";
import {
  DarkStoreCard,
  DepartmentGroupHeader,
  FulfillmentChoice,
} from "../components/checkout/CheckoutFulfillment";
import { loadRazorpayScript, openRazorpayCheckout } from "../utils/razorpay";
import AddressForm, { ADDRESS_FORM_FIELDS } from "../components/address/AddressForm";
import RewardPointsModal from "../components/rewards/RewardPointsModal";
import { readDeliveryLocation } from "../utils/deliveryLocation";
import { isLocalProductId } from "../utils/localProductId";
import {
  clearBuyNowCheckout,
  getBuyNowCheckout,
} from "../utils/checkoutSession";
import {
  formatAddressLine,
  getAddressFullName,
} from "../utils/addressDisplay";
import {
  calculateShippingCharge,
  getMinimumOrderShortfall,
  meetsMinimumOrder,
  mergeStoreSettings,
  nextCheaperShippingSlab,
} from "../utils/orderSettings";
import { calculateOrderTotal } from "../utils/gst";
import {
  getCheckoutPaymentMethod,
  PAYMENT_PLAN,
} from "../utils/payment";

const MAX_ORDER_NOTE_LENGTH = 200;
const PAYMENT_PLAN_STORAGE_KEY = "gg_checkout_payment_plan";

const DELIVERY_INSTRUCTIONS = [
  { key: "avoidCalling", label: "Avoid calling" },
  { key: "dontRingBell", label: "Don't ring the bell" },
  { key: "leaveAtGuard", label: "Leave at guard" },
];

function readSavedPaymentPlan() {
  try {
    const saved = window.localStorage.getItem(PAYMENT_PLAN_STORAGE_KEY);
    return Object.values(PAYMENT_PLAN).includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function checkoutCustomerLocation() {
  const loc = readDeliveryLocation();
  if (!loc) return undefined;
  const lat = Number(loc.lat ?? loc.latitude);
  const lng = Number(loc.lng ?? loc.longitude);
  const payload = {
    city: loc.city || "",
    area: loc.area || "",
    state: loc.state || "",
    pincode: loc.pincode || "",
    fullAddress: loc.address || "",
  };
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    payload.lat = lat;
    payload.lng = lng;
    payload.location = { lat, lng };
  }
  if (!payload.city && !payload.area && payload.lat == null) return undefined;
  return payload;
}

const formatPrice = (amount, fractionDigits = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);

const safeTrim = (value) => String(value ?? "").trim();

/* ──────────────────────────────────────────────
   Confetti Burst (CSS-only)
   ────────────────────────────────────────────── */
const CONFETTI_COLORS = ["#0C831F", "#22c55e", "#4ade80", "#fbbf24", "#f87171", "#818cf8", "#fb923c"];

function ConfettiBurst() {
  const pieces = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * 360;
      const rad = (angle * Math.PI) / 180;
      const dist = 40 + Math.random() * 50;
      return {
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        x: Math.cos(rad) * dist,
        y: Math.sin(rad) * dist - 30,
        r: 180 + Math.random() * 360,
        delay: Math.random() * 0.15,
      };
    });
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            backgroundColor: p.color,
            "--confetti-x": `${p.x}px`,
            "--confetti-y": `${p.y}px`,
            "--confetti-r": `${p.r}deg`,
            animationDelay: `${p.delay}s`,
            borderRadius: p.id % 3 === 0 ? "50%" : "1px",
            width: p.id % 2 === 0 ? "6px" : "4px",
            height: p.id % 2 === 0 ? "6px" : "8px",
          }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Modal
   ────────────────────────────────────────────── */
function CheckoutModal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 sm:items-center sm:px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="scale-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border-light px-4 py-3 sm:px-5">
          <h3 className="text-base font-bold text-text-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-secondary transition hover:bg-mobile-surface hover:text-text-primary"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border-light px-4 py-3 sm:px-5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Checkout Page
   ────────────────────────────────────────────── */
function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const {
    items,
    loading: cartLoading,
    loadCart,
    resetCart,
    incrementCartItem,
    decrementCartItem,
    removeFromCart,
  } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const buyNowItem = getBuyNowCheckout();
  const isBuyNow = Boolean(buyNowItem);
  const checkoutItems = isBuyNow ? [buyNowItem].filter(Boolean) : items;
  const checkoutItemsPayload = useMemo(
    () =>
      checkoutItems.map((item) => {
        const productId = item.productId || item._id;
        const payload = {
          productId,
          quantity: item.quantity,
          variantName: item.variantName || "",
          colorName: item.colorName || "",
        };

        if (isLocalProductId(productId)) {
          payload.name = item.name;
          payload.price = item.price;
          payload.discountedPrice = item.discountedPrice;
          payload.brandName = item.brandName || "";
          payload.image = item.productImages?.[0] || "";
        }

        return payload;
      }),
    [checkoutItems]
  );

  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState(readSavedPaymentPlan);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const paymentMethod = getCheckoutPaymentMethod(paymentPlan || PAYMENT_PLAN.COD);
  const [formError, setFormError] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [orderSuccessNote, setOrderSuccessNote] = useState("");
  const [orderStore, setOrderStore] = useState(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busyLine, setBusyLine] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState({
    avoidCalling: false,
    dontRingBell: false,
    leaveAtGuard: false
  });
  // Instructions travel to the store inside the order note.
  const message = useMemo(
    () =>
      [
        safeTrim(note),
        ...DELIVERY_INSTRUCTIONS.filter((opt) => deliveryInstructions[opt.key]).map((opt) => opt.label),
      ]
        .filter(Boolean)
        .join(" | "),
    [note, deliveryInstructions]
  );
  const [storeSettings, setStoreSettings] = useState(null);
  const [attemptedOrderId, setAttemptedOrderId] = useState(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [giftCardInput, setGiftCardInput] = useState("");
  const [appliedGiftCard, setAppliedGiftCard] = useState(null);
  const [giftCardError, setGiftCardError] = useState("");
  const [applyingGiftCard, setApplyingGiftCard] = useState(false);

  const departmentGroups = useMemo(() => groupItemsByDepartment(checkoutItems), [checkoutItems]);
  const hasPreOrderItems = useMemo(
    () => checkoutItems.some((item) => departmentForItem(item) === DEPARTMENT.PREORDER),
    [checkoutItems]
  );
  const hasNowItems = useMemo(
    () => checkoutItems.some((item) => departmentForItem(item) !== DEPARTMENT.PREORDER),
    [checkoutItems]
  );
  const [pickedPreOrderSlot, setSelectedPreOrderSlot] = useState("");
  const [slotAvailability, setSlotAvailability] = useState(null);
  const loadSlotAvailability = useCallback(async () => {
    try {
      const { data } = await getPreOrderSlotAvailability();
      setSlotAvailability(data?.data || null);
    } catch {
      setSlotAvailability(null);
    }
  }, []);
  useEffect(() => {
    if (hasPreOrderItems) loadSlotAvailability();
  }, [hasPreOrderItems, loadSlotAvailability]);
  const preOrderSlots = useMemo(() => {
    if (slotAvailability?.slots) return slotAvailability.slots;
    return (storeSettings?.preOrderSlots || [])
      .filter((s) => s.isActive)
      .map((s) => ({ label: `${s.startTime} - ${s.endTime}`, remaining: null, isFull: false }));
  }, [slotAvailability, storeSettings]);
  const isBookableSlot = useCallback(
    (label) => preOrderSlots.some((s) => s.label === label && !s.isFull),
    [preOrderSlots]
  );
  const cartPreOrderSlot = useMemo(() => {
    const fromCart = checkoutItems.map((item) => item.preOrderSlot).find(Boolean) || "";
    return isBookableSlot(fromCart) ? fromCart : "";
  }, [checkoutItems, isBookableSlot]);
  const selectedPreOrderSlot = isBookableSlot(pickedPreOrderSlot) ? pickedPreOrderSlot : cartPreOrderSlot;
  const [fulfillment] = useState(FULFILLMENT.DELIVERY);
  const isPickup = fulfillment === FULFILLMENT.PICKUP;
  const [storeLookup, setStoreLookup] = useState({ key: "", store: null });

  // Reward Points state
  const [rewardSettings, setRewardSettings] = useState(null);
  const [userRewardPoints, setUserRewardPoints] = useState(user?.rewardPoints || 0);
  const [useRewards, setUseRewards] = useState(false);
  const [rewardPointsInput, setRewardPointsInput] = useState(0);
  const [showRewardTermsModal, setShowRewardTermsModal] = useState(false);
  const rewardPointsToUseRef = useRef(0);

  const messageRef = useRef("");
  const attemptedOrderIdRef = useRef(null);
  const appliedCouponRef = useRef(null);
  const appliedGiftCardRef = useRef(null);
  const hasAutoOpenedAddressRef = useRef(false);

  const checkoutAttemptKey = useMemo(
    () =>
      JSON.stringify({
        addressId: selectedAddressId,
        paymentMethod,
        paymentPlan,
        items: checkoutItems.map((item) => ({
          productId: item.productId || item._id,
          quantity: item.quantity,
          variantName: item.variantName || "",
          colorName: item.colorName || "",
        })),
        couponCode: appliedCoupon?.code || "",
        giftCardCode: appliedGiftCard?.code || "",
        rewardPointsToUse: useRewards ? rewardPointsInput : 0,
        fulfillment,
        preOrderSlot: selectedPreOrderSlot,
      }),
    [selectedAddressId, paymentMethod, paymentPlan, checkoutItems, appliedCoupon, appliedGiftCard, useRewards, rewardPointsInput, fulfillment, selectedPreOrderSlot]
  );
  const checkoutAttemptKeyRef = useRef(checkoutAttemptKey);
  checkoutAttemptKeyRef.current = checkoutAttemptKey;
  // Delivery fee priced by the server from the serving dark store's vendor shipping rules.
  const [serverDelivery, setServerDelivery] = useState({ key: "", charges: null });

  const storeParams = useMemo(
    () =>
      nearestStoreParams(addresses.find((addr) => addr._id === selectedAddressId) || null, {
        hasNowItems,
        fulfillment,
      }),
    [addresses, selectedAddressId, hasNowItems, fulfillment]
  );
  const storeKey = JSON.stringify(storeParams);
  const darkStoreLoading = storeLookup.key !== storeKey;
  const darkStore = darkStoreLoading ? null : storeLookup.store;

  useEffect(() => {
    if (addressesLoading || checkoutItems.length === 0) return undefined;
    let active = true;
    getNearestStore(storeParams)
      .then(({ data }) => {
        if (!active) return;
        const body = data?.data && typeof data.data === "object" ? data.data : data;
        setStoreLookup({ key: storeKey, store: body?.store || null });
      })
      .catch(() => {
        if (active) setStoreLookup({ key: storeKey, store: null });
      });
    return () => {
      active = false;
    };
  }, [storeParams, storeKey, addressesLoading, checkoutItems.length]);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    attemptedOrderIdRef.current = attemptedOrderId;
  }, [attemptedOrderId]);

  useEffect(() => {
    appliedCouponRef.current = appliedCoupon;
  }, [appliedCoupon]);

  useEffect(() => {
    appliedGiftCardRef.current = appliedGiftCard;
  }, [appliedGiftCard]);

  // Load Reward Points and settings for the authenticated user
  useEffect(() => {
    if (!user) return;
    setUserRewardPoints(user.rewardPoints || 0);
    getMyRewardPoints()
      .then(({ data }) => {
        if (data?.data) {
          setUserRewardPoints(data.data.points || 0);
          if (data.data.settings) {
            setRewardSettings(data.data.settings);
          }
        }
      })
      .catch(() => {
        getRewardSettings()
          .then(({ data }) => {
            if (data?.data) setRewardSettings(data.data);
          })
          .catch(() => {});
      });
  }, [user]);

  const subtotal = checkoutItems.reduce(
    (sum, item) => sum + item.discountedPrice * item.quantity,
    0
  );
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  const subtotalAfterCoupon = Math.max(0, subtotal - couponDiscount);

  const rewardsActive = rewardSettings?.enabled === true;

  // Maximum reward points allowed for redemption on this cart
  const maxRedeemablePoints = useMemo(() => {
    if (!rewardsActive || !userRewardPoints) return 0;
    if (subtotal < (rewardSettings.minOrderAmountToRedeem || 0)) return 0;
    if (userRewardPoints < (rewardSettings.minPointsToRedeem || 0)) return 0;

    const pointValue = rewardSettings.pointValueInRupees || 1.0;
    const maxDiscountAllowed =
      (subtotalAfterCoupon * (rewardSettings.maxRedemptionPercent || 50)) / 100;
    let maxPoints = Math.floor(maxDiscountAllowed / pointValue);

    if (rewardSettings.maxPointsPerOrder > 0) {
      maxPoints = Math.min(maxPoints, rewardSettings.maxPointsPerOrder);
    }
    return Math.max(0, Math.min(userRewardPoints, maxPoints));
  }, [rewardsActive, rewardSettings, userRewardPoints, subtotal, subtotalAfterCoupon]);

  const effectiveRewardPoints = rewardsActive && useRewards ? Math.min(rewardPointsInput, maxRedeemablePoints) : 0;
  const rewardDiscount =
    Math.round(effectiveRewardPoints * (rewardSettings?.pointValueInRupees || 1.0) * 100) / 100;

  rewardPointsToUseRef.current = effectiveRewardPoints;

  // Reward points earned on this order
  const pointsToEarn = useMemo(() => {
    if (!rewardsActive) return 0;
    if (subtotal < (rewardSettings?.minOrderAmountToEarn || 0)) return 0;
    const spend = rewardSettings?.earningRate?.spendAmount || 100;
    const rate = rewardSettings?.earningRate?.pointsEarned || 10;
    return Math.floor((subtotal / spend) * rate);
  }, [rewardsActive, rewardSettings, subtotal]);

  const giftCardDiscount = Math.min(
    Number(appliedGiftCard?.discountAmount || 0),
    Math.max(0, subtotalAfterCoupon - rewardDiscount)
  );
  const discountedSubtotal = Math.max(0, subtotalAfterCoupon - rewardDiscount - giftCardDiscount);
  const serverPriced =
    !isPickup && serverDelivery.key === checkoutAttemptKey && serverDelivery.charges != null;
  const deliveryCharges = isPickup
    ? 0
    : serverPriced
      ? serverDelivery.charges
      : calculateShippingCharge(subtotal, storeSettings);
  // Settings-based estimate isn't shown until the admin settings have loaded.
  const deliveryFeeKnown = isPickup || serverPriced || storeSettings != null;
  // Delivery nudge only when the fee follows the store's slabs.
  const cheaperSlab =
    !isPickup &&
    storeSettings &&
    (!serverPriced || deliveryCharges === calculateShippingCharge(subtotal, storeSettings))
      ? nextCheaperShippingSlab(subtotal, storeSettings)
      : null;
  const { total: orderTotal } = calculateOrderTotal(discountedSubtotal, deliveryCharges);
  const minimumOrderMet = meetsMinimumOrder(subtotal, storeSettings);
  const minimumOrderShortfall = getMinimumOrderShortfall(subtotal, storeSettings);
  const minimumOrderValue = mergeStoreSettings(storeSettings).minimumOrderValue;
  const savings = checkoutItems.reduce((sum, item) => {
    const original = item.price ?? item.discountedPrice;
    const diff = Math.max(0, original - item.discountedPrice);
    return sum + diff * item.quantity;
  }, 0);
  const mrpTotal = subtotal + savings;
  const totalSaved = savings + couponDiscount + rewardDiscount;

  const { data: availableCoupons = [] } = useAvailableCouponsQuery(subtotal, {
    enabled: Boolean(user) && subtotal > 0,
  });
  // Biggest unlocked coupon, else the one closest to unlocking.
  const suggestedCoupon = useMemo(() => {
    const usable = availableCoupons.filter(
      (c) => c.code !== appliedCoupon?.code && !safeTrim(c.redemptionBlocked)
    );
    const unlocked = usable
      .filter((c) => c.unlocked && Number(c.discountAmount) > 0)
      .sort((a, b) => b.discountAmount - a.discountAmount);
    if (unlocked.length) {
      return appliedCoupon && appliedCoupon.discountAmount >= unlocked[0].discountAmount
        ? null
        : unlocked[0];
    }
    if (appliedCoupon) return null;
    return (
      usable
        .filter((c) => !c.unlocked && Number(c.amountNeeded) > 0)
        .sort((a, b) => a.amountNeeded - b.amountNeeded)[0] || null
    );
  }, [availableCoupons, appliedCoupon]);

  const lineArgs = (item) => ({
    productId: item.productId || item._id,
    variantName: item.variantName || "",
    colorName: item.colorName || "",
    preOrderSlot: item.preOrderSlot || "",
  });

  const changeLineQuantity = async (item, lineKey, direction) => {
    setBusyLine(lineKey);
    try {
      if (direction === "up") {
        await incrementCartItem({ ...lineArgs(item), step: getCartStepForItem(item) });
      } else {
        await decrementCartItem({
          ...lineArgs(item),
          resolveNextQuantity: (currentQty) =>
            getDecreasedCartQuantityForItem({ ...item, quantity: currentQty }),
        });
      }
    } finally {
      setBusyLine("");
    }
  };

  const moveLineToWishlist = async (item, lineKey) => {
    setBusyLine(lineKey);
    try {
      if (!isWishlisted(item._id)) {
        const result = await toggleWishlist(item);
        if (!result?.success) return;
      }
      const { productId, variantName, colorName, preOrderSlot } = lineArgs(item);
      await removeFromCart(productId, variantName, colorName, preOrderSlot);
    } finally {
      setBusyLine("");
    }
  };

  const choosePaymentPlan = (plan) => {
    setPaymentPlan(plan);
    setShowPaymentSheet(false);
    try {
      window.localStorage.setItem(PAYMENT_PLAN_STORAGE_KEY, plan);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  const loadAddresses = async () => {
    setAddressesLoading(true);
    try {
      const { data } = await getAddresses();
      const list = data.data || [];
      setAddresses(list);
      const defaultAddr = list.find((a) => a.isDefault) || list[0];
      if (defaultAddr) setSelectedAddressId(defaultAddr._id);
    } catch {
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      setBootstrapping(true);
      return;
    }

    let active = true;
    getStoreSettings()
      .then(({ data }) => {
        if (active) setStoreSettings(data.data);
      })
      .catch(() => {
        if (active) setStoreSettings(null);
      });

    return () => {
      active = false;
    };
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) {
      setBootstrapping(true);
      return;
    }

    if (user) {
      const bootstrap = async () => {
        setBootstrapping(true);
        try {
          await Promise.all([loadCart(), loadAddresses()]);
        } finally {
          setBootstrapping(false);
        }
      };
      bootstrap();
    } else {
      setBootstrapping(false);
    }
  }, [user, authLoading, loadCart]);

  useEffect(() => {
    if (addressesLoading || hasAutoOpenedAddressRef.current) return;

    hasAutoOpenedAddressRef.current = true;
    if (addresses.length === 0) {
      setShowAddressForm(true);
    }
  }, [addressesLoading, addresses.length]);

  useEffect(() => {
    if (
      !authLoading &&
      user &&
      !bootstrapping &&
      !cartLoading &&
      checkoutItems.length === 0 &&
      !orderPlaced
    ) {
      navigate(isBuyNow ? "/product" : "/cart", { replace: true });
    }
  }, [
    authLoading,
    user,
    bootstrapping,
    cartLoading,
    checkoutItems.length,
    navigate,
    orderPlaced,
    isBuyNow,
  ]);

  const syncCheckoutAttempt = useCallback(async () => {
    if (
      authLoading ||
      bootstrapping ||
      !user ||
      orderPlaced ||
      checkoutItems.length === 0
    ) {
      return attemptedOrderIdRef.current;
    }

    const requestKey = checkoutAttemptKeyRef.current;
    try {
      const { data } = await createCheckoutAttempt({
        addressId: selectedAddressId || undefined,
        paymentMethod,
        checkoutItems: checkoutItemsPayload,
        checkoutMode: isBuyNow ? "buyNow" : "cart",
        buyNow: isBuyNow,
        couponCode: appliedCouponRef.current?.code || undefined,
        giftCardCode: appliedGiftCardRef.current?.code || undefined,
        rewardPointsToUse: rewardPointsToUseRef.current || undefined,
        customerLocation: checkoutCustomerLocation(),
        preOrderSlot: hasPreOrderItems ? selectedPreOrderSlot : undefined,
        fulfillmentType: fulfillment,
      });
      const orderId = data?.data?._id;
      const charges = Number(data?.data?.deliveryCharges);
      if (Number.isFinite(charges)) {
        setServerDelivery({ key: requestKey, charges });
      }
      if (orderId) {
        setAttemptedOrderId(orderId);
        attemptedOrderIdRef.current = orderId;
        return orderId;
      }
    } catch (err) {
      console.warn("Checkout attempt sync failed:", err.response?.data?.message || err.message);
    }

    return attemptedOrderIdRef.current;
  }, [
    authLoading,
    bootstrapping,
    user,
    orderPlaced,
    checkoutItems.length,
    selectedAddressId,
    paymentMethod,
    checkoutItemsPayload,
    isBuyNow,
    hasPreOrderItems,
    selectedPreOrderSlot,
    fulfillment,
  ]);

  useEffect(() => {
    syncCheckoutAttempt();
  }, [syncCheckoutAttempt, checkoutAttemptKey]);

  useEffect(() => {
    if (!appliedCoupon?.code) return undefined;

    let active = true;
    validateCoupon({ code: appliedCoupon.code, subtotal })
      .then(({ data }) => {
        if (!active) return;
        setAppliedCoupon(data.data);
        setCouponError("");
      })
      .catch((err) => {
        if (!active) return;
        setAppliedCoupon(null);
        setCouponError(err.response?.data?.message || "Coupon is no longer valid");
      });

    return () => {
      active = false;
    };
  }, [subtotal, appliedCoupon?.code]);

  const handleApplyCoupon = () => applyCouponCode(couponInput);

  const applyCouponCode = async (rawCode) => {
    const code = String(rawCode || "").trim();
    if (!code) {
      setCouponError("Enter a coupon code");
      return;
    }

    setApplyingCoupon(true);
    setCouponError("");
    try {
      const { data } = await validateCoupon({ code, subtotal });
      setAppliedCoupon(data.data);
      setCouponInput(data.data.code);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.response?.data?.message || "Invalid coupon code");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const handleApplyGiftCard = async () => {
    const code = giftCardInput.trim();
    if (!code) {
      setGiftCardError("Enter a gift card code");
      return;
    }
    setApplyingGiftCard(true);
    setGiftCardError("");
    try {
      const payable = Math.max(0, subtotalAfterCoupon - rewardDiscount);
      const { data } = await validateGiftCard({ code, payableAmount: payable, subtotal: payable });
      setAppliedGiftCard(data.data);
      setGiftCardInput(data.data.code);
    } catch (err) {
      setAppliedGiftCard(null);
      setGiftCardError(err.response?.data?.message || "Invalid gift card");
    } finally {
      setApplyingGiftCard(false);
    }
  };

  const handleRemoveGiftCard = () => {
    setAppliedGiftCard(null);
    setGiftCardInput("");
    setGiftCardError("");
  };

  useEffect(() => {
    const code = String(location.state?.applyCouponCode || "").trim().toUpperCase();
    if (!code || authLoading || subtotal <= 0) return;

    let active = true;

    validateCoupon({ code, subtotal })
      .then(({ data }) => {
        if (!active) return;
        setAppliedCoupon(data.data);
        setCouponInput(data.data.code);
        setCouponError("");
      })
      .catch((err) => {
        if (!active) return;
        setCouponError(err.response?.data?.message || "Invalid coupon code");
      })
      .finally(() => {
        navigate(location.pathname, { replace: true, state: null });
      });

    return () => {
      active = false;
    };
  }, [location.state?.applyCouponCode, authLoading, subtotal, navigate, location.pathname]);

  const completeOrderSuccess = async (note = "") => {
    setOrderSuccessNote(
      note ||
        (isPickup
          ? "Your order has been placed. Collect it from the dark store with the OTP in My Orders."
          : "Your order has been placed and will be delivered soon.")
    );
    setOrderStore(isPickup ? darkStore : null);
    setOrderPlaced(true);
    clearBuyNowCheckout();
    resetCart();
    await loadCart();
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    setShowSuccessModal(true);
  };

  const handleRazorpayPayment = async () => {
    const paymentMode = paymentPlan;

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      throw new Error("Failed to load payment gateway");
    }

    const { data } = await createRazorpayOrder({
      addressId: selectedAddressId,
      paymentMode,
      checkoutItems: checkoutItemsPayload,
      checkoutMode: isBuyNow ? "buyNow" : "cart",
      buyNow: isBuyNow,
      couponCode: appliedCouponRef.current?.code || undefined,
      giftCardCode: appliedGiftCardRef.current?.code || undefined,
      rewardPointsToUse: rewardPointsToUseRef.current || undefined,
      customerLocation: checkoutCustomerLocation(),
      preOrderSlot: hasPreOrderItems ? selectedPreOrderSlot : undefined,
        fulfillmentType: fulfillment,
    });
    const paymentData = data.data;

    if (paymentData.attemptedOrderId) {
      setAttemptedOrderId(paymentData.attemptedOrderId);
      attemptedOrderIdRef.current = paymentData.attemptedOrderId;
    }

    setPlacingOrder(false);

    openRazorpayCheckout({
      keyId: paymentData.keyId,
      amount: paymentData.amount,
      razorpayOrderId: paymentData.razorpayOrderId,
      user,
      description: "Full order payment via Razorpay",
      onSuccess: async (response) => {
        setPlacingOrder(true);
        setOrderError("");
        try {
          await verifyRazorpayPayment({
            addressId: selectedAddressId,
            paymentMode,
            customerMessage: safeTrim(messageRef.current),
            checkoutItems: checkoutItemsPayload,
            checkoutMode: isBuyNow ? "buyNow" : "cart",
            buyNow: isBuyNow,
            attemptedOrderId: attemptedOrderIdRef.current,
            couponCode: appliedCouponRef.current?.code || undefined,
            giftCardCode: appliedGiftCardRef.current?.code || undefined,
            rewardPointsToUse: rewardPointsToUseRef.current || undefined,
            customerLocation: checkoutCustomerLocation(),
            preOrderSlot: hasPreOrderItems ? selectedPreOrderSlot : undefined,
        fulfillmentType: fulfillment,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          await completeOrderSuccess("");
        } catch (err) {
          setOrderError(
            err.response?.data?.message || "Payment verified but order failed. Contact support."
          );
        } finally {
          setPlacingOrder(false);
        }
      },
      onDismiss: async () => {
        setPlacingOrder(false);
        setOrderError("Payment cancelled. Your order was not placed.");
        await syncCheckoutAttempt();
      },
    });
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId || placingOrder || !minimumOrderMet) return;
    if (hasPreOrderItems && !selectedPreOrderSlot) return;
    if (isPickup && !darkStore) return;
    if (!paymentPlan) {
      setShowPaymentSheet(true);
      return;
    }
    setOrderError("");
    setPlacingOrder(true);
    await loadCart();
    try {
      await syncCheckoutAttempt();
      
      if (paymentPlan === PAYMENT_PLAN.COD) {
        await placeOrder({
          addressId: selectedAddressId,
          paymentMethod: "cod",
          customerMessage: safeTrim(messageRef.current),
          checkoutItems: checkoutItemsPayload,
          checkoutMode: isBuyNow ? "buyNow" : "cart",
          buyNow: isBuyNow,
          attemptedOrderId: attemptedOrderIdRef.current,
          couponCode: appliedCouponRef.current?.code || undefined,
          giftCardCode: appliedGiftCardRef.current?.code || undefined,
          rewardPointsToUse: rewardPointsToUseRef.current || undefined,
          customerLocation: checkoutCustomerLocation(),
          preOrderSlot: hasPreOrderItems ? selectedPreOrderSlot : undefined,
        fulfillmentType: fulfillment,
        });

        await completeOrderSuccess(
          isPickup
            ? "Order confirmed. Pay at the store when you pick it up."
            : "Order confirmed. Pay the full amount on delivery."
        );
      } else {
        await handleRazorpayPayment();
      }
    } catch (err) {
      setOrderError(err.response?.data?.message || "Failed to start payment. Please try again.");
      if (String(err.response?.data?.code || "").startsWith("PREORDER_SLOT")) {
        loadSlotAvailability();
      }
      setPlacingOrder(false);
    }
  };

  const handleSaveAddress = async (formData) => {
    setSavingAddress(true);
    setFormError("");
    try {
      const loc = readDeliveryLocation();
      const lat = Number(loc?.lat ?? loc?.latitude);
      const lng = Number(loc?.lng ?? loc?.longitude);
      const payload = { ...formData, isDefault: addresses.length === 0 };
      if (!payload.location?.lat && Number.isFinite(lat) && Number.isFinite(lng)) {
        payload.location = { lat, lng };
      }
      if (!payload.area && loc?.area) payload.area = loc.area;
      const { data } = await addAddress(payload);
      const newAddress = data.data;
      setAddresses((prev) => [newAddress, ...prev]);
      setSelectedAddressId(newAddress._id);
      setShowAddressForm(false);
      setShowAddressPicker(false);
      setFormError("");
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const closeAddressForm = () => {
    setShowAddressForm(false);
    setFormError("");
  };

  const closeAddressPicker = () => {
    setShowAddressPicker(false);
  };

  const openAddressForm = () => {
    setShowAddressPicker(false);
    setShowAddressForm(true);
  };

  const selectedAddress = addresses.find((addr) => addr._id === selectedAddressId) || null;

  const addressFormInitial = {
    ...ADDRESS_FORM_FIELDS,
    fullName: user?.name || "",
    number: user?.phone || "",
    email: user?.email || "",
  };

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-mobile-bg px-4 py-16 text-text-primary sm:px-6">
        <div className="scale-in mx-auto max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg ring-1 ring-slate-100">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50">
            <svg className="h-8 w-8 text-[#0C831F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0V10.5M4.5 10.5h15v8.25a1.5 1.5 0 01-1.5 1.5h-12a1.5 1.5 0 01-1.5-1.5V10.5z" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Checkout</h1>
          <p className="mb-6 text-sm text-text-secondary">Please login to proceed with checkout.</p>
          <button
            type="button"
            onClick={() => openAuthModal("login")}
            className="w-full rounded-xl bg-gradient-to-r from-[#0C831F] to-[#16a34a] px-8 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            Login / Sign Up
          </button>
        </div>
      </div>
    );
  }

  const headerTitle = isPickup
    ? `Pickup from ${darkStore?.storeName || "dark store"}`
    : selectedAddress
      ? safeTrim(selectedAddress.shopName) || getAddressFullName(selectedAddress)
      : addressesLoading
        ? "Loading address…"
        : "Add delivery address";
  const headerLine = selectedAddress
    ? formatAddressLine(selectedAddress)
    : readDeliveryLocation()?.address || "Choose where to deliver your order";
  const openAddressChooser = () =>
    addresses.length ? setShowAddressPicker(true) : setShowAddressForm(true);

  let payBlocker = "";
  if (!minimumOrderMet) {
    payBlocker = `Add ${formatPrice(minimumOrderShortfall)} more to reach the minimum order of ${formatPrice(minimumOrderValue)}`;
  } else if (!selectedAddressId) {
    payBlocker = "Add a delivery address to continue";
  } else if (hasPreOrderItems && !selectedPreOrderSlot) {
    payBlocker = "Choose a pre-order slot to continue";
  } else if (isPickup && !darkStore && !darkStoreLoading) {
    payBlocker = "No dark store found for pickup at this address";
  }
  const readyToPay = !payBlocker && deliveryFeeKnown && !placingOrder && !(isPickup && !darkStore);
  const paymentLabel =
    paymentPlan === PAYMENT_PLAN.COD
      ? isPickup
        ? "Pay at store"
        : "Cash on Delivery"
      : paymentPlan === PAYMENT_PLAN.FULL
        ? "Pay now · UPI / Card"
        : "";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F1F2F6] text-slate-900">
      {/* Processing overlay */}
      {placingOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40">
          <div className="scale-in flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-8 shadow-2xl ring-1 ring-slate-100">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-100 border-t-[#047857]" />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900">Processing your order</p>
              <p className="mt-1 text-xs text-slate-500">Please don't close this page…</p>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
          <div className="scale-in relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-8 text-center shadow-2xl ring-1 ring-slate-100">
            <ConfettiBurst />
            <div className="success-ring mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-50 shadow-lg shadow-green-100">
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path className="checkmark-draw" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-2xl font-bold text-slate-900">Order Confirmed!</h3>
            <p className="mb-6 text-sm leading-relaxed text-slate-500">{orderSuccessNote}</p>
            {orderStore ? (
              <div className="mb-5 text-left">
                <DarkStoreCard store={orderStore} />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => navigate("/orders", { replace: true, state: { orderPlaced: true } })}
              className="w-full rounded-xl bg-[#047857] py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#065F46]"
            >
              View My Orders
            </button>
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* Address picker modal */}
      <CheckoutModal
        open={showAddressPicker}
        title="Select Delivery Address"
        onClose={closeAddressPicker}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={openAddressForm}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#047857] hover:underline"
            >
              + Add new address
            </button>
            <button
              type="button"
              onClick={closeAddressPicker}
              disabled={!selectedAddressId}
              className="rounded-xl bg-[#047857] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#065F46] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use this address
            </button>
          </div>
        }
      >
        <ul className="space-y-2">
          {addresses.map((addr) => (
            <li key={addr._id}>
              <label
                className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-all ${
                  selectedAddressId === addr._id
                    ? "border-[#047857] bg-emerald-50/60 ring-1 ring-emerald-200"
                    : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="checkoutAddressPicker"
                  value={addr._id}
                  checked={selectedAddressId === addr._id}
                  onChange={() => {
                    setSelectedAddressId(addr._id);
                    setShowAddressPicker(false);
                  }}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#047857]"
                />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="overflow-hidden break-words font-semibold text-slate-900">{getAddressFullName(addr)}</p>
                    {addr.isDefault ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#047857]">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 overflow-hidden break-words text-slate-500">{formatAddressLine(addr)}</p>
                  <p className="text-slate-500">+91 {addr.number}</p>
                </div>
              </label>
            </li>
          ))}
        </ul>
      </CheckoutModal>

      {/* Address form modal */}
      <CheckoutModal open={showAddressForm} title="Delivery Address" onClose={closeAddressForm}>
        {formError ? (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
        ) : null}
        <AddressForm
          plain
          initial={addressFormInitial}
          onSubmit={handleSaveAddress}
          onCancel={closeAddressForm}
          submitting={savingAddress}
        />
      </CheckoutModal>

      {/* Payment method chooser */}
      <CheckoutModal
        open={showPaymentSheet}
        title="Payment Options"
        onClose={() => setShowPaymentSheet(false)}
      >
        <div className="space-y-2.5">
          {[
            {
              plan: PAYMENT_PLAN.COD,
              title: isPickup ? "Pay at store" : "Cash on Delivery",
              subtitle: isPickup
                ? "Cash or UPI when you collect your order"
                : "Cash or UPI when your order arrives",
              icon: <Banknote className="h-5 w-5" strokeWidth={2} />,
            },
            {
              plan: PAYMENT_PLAN.FULL,
              title: "Pay now",
              subtitle: `${formatPrice(orderTotal, 2)} by UPI or card`,
              icon: <CreditCard className="h-5 w-5" strokeWidth={2} />,
            },
          ].map((option) => {
            const selected = paymentPlan === option.plan;
            return (
              <button
                key={option.plan}
                type="button"
                onClick={() => choosePaymentPlan(option.plan)}
                className={`flex w-full items-center gap-3.5 rounded-xl border p-4 text-left transition-all ${
                  selected
                    ? "border-[#047857] bg-emerald-50/60 ring-1 ring-emerald-200"
                    : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    selected ? "bg-emerald-100 text-[#047857]" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {option.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{option.subtitle}</span>
                </span>
                <span
                  className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                    selected ? "border-[#047857] bg-[#047857] ring-[3px] ring-inset ring-white" : "border-slate-300"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </CheckoutModal>

      {/* Header: address with dropdown */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-2 py-2">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(isBuyNow ? "/product" : "/cart"))}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-900 hover:bg-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={openAddressChooser}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-1 text-left hover:bg-slate-50"
          >
            <svg className="h-5 w-5 shrink-0 text-[#047857]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21.7 2.3a1 1 0 00-1.05-.23l-18 7a1 1 0 00.08 1.89l7.6 2.11 2.11 7.6a1 1 0 001.89.08l7-18a1 1 0 00-.23-1.05z" />
            </svg>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-0.5">
                <span className="truncate text-[15.5px] font-extrabold">{headerTitle}</span>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
              <span className="block truncate text-xs font-medium text-slate-500">{headerLine}</span>
            </span>
          </button>
        </div>
      </header>

      {totalSaved > 0 ? (
        <div className="flex items-center justify-center gap-1.5 bg-[#E6F6EC] py-2 text-sm font-extrabold text-[#0B7A3B]">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1l2.4 2.2 3.2-.5.9 3.1 2.9 1.5-1.2 3 1.2 3-2.9 1.5-.9 3.1-3.2-.5L12 21l-2.4-2.2-3.2.5-.9-3.1-2.9-1.5 1.2-3-1.2-3 2.9-1.5.9-3.1 3.2.5L12 1zm-1.2 13.6l5.3-5.3-1.4-1.4-3.9 3.9-1.9-1.9-1.4 1.4 3.3 3.3z" />
          </svg>
          {formatPrice(totalSaved)} saved!
        </div>
      ) : null}

      <section className="mx-auto max-w-5xl px-3 pb-44 pt-3 lg:pb-10">
        {cartLoading && !isBuyNow ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shimmer-loading h-36 rounded-2xl" />
              ))}
            </div>
            <div className="shimmer-loading h-[420px] rounded-2xl" />
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              {!minimumOrderMet ? (
                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/70">
                  Add {formatPrice(minimumOrderShortfall)} more to reach the minimum order of{" "}
                  {formatPrice(minimumOrderValue)}.{" "}
                  <Link to="/product" className="font-extrabold underline">
                    Add items
                  </Link>
                </p>
              ) : null}

              {/* Items */}
              <Card>
                {departmentGroups.map((group, index) => (
                  <div key={group.department} className={index > 0 ? "mt-3" : ""}>
                    <DepartmentGroupHeader
                      department={group.department}
                      itemCount={group.items.length}
                      etaText={departmentEtaText(group.department, {
                        pickup: isPickup,
                        preOrderSlot: selectedPreOrderSlot,
                      })}
                    />
                    <ul className="divide-y divide-slate-100">
                      {group.items.map((item) => {
                        const lineKey = `${item.productId || item._id}-${item.variantName || ""}-${item.colorName || ""}-${item.preOrderSlot || ""}`;
                        return (
                          <CheckoutLine
                            key={lineKey}
                            item={item}
                            editable={!isBuyNow}
                            busy={placingOrder || busyLine === lineKey}
                            onIncrease={() => changeLineQuantity(item, lineKey, "up")}
                            onDecrease={() => changeLineQuantity(item, lineKey, "down")}
                            onMoveToWishlist={
                              isBuyNow || isLocalProductId(item._id)
                                ? undefined
                                : () => moveLineToWishlist(item, lineKey)
                            }
                          />
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {hasPreOrderItems && hasNowItems ? (
                  <p className="pb-2 text-xs text-slate-500">
                    Pre-order and quick items arrive separately, but you pay once for the whole order.
                  </p>
                ) : null}
                <div className="border-t border-slate-100">
                  <Link
                    to="/product"
                    className="flex items-center gap-2.5 py-3 text-sm font-bold text-slate-900 hover:text-[#047857]"
                  >
                    <span className="text-lg leading-none">+</span>
                    Add more items
                  </Link>
                </div>
                <div className="border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNote((open) => !open)}
                    className="flex w-full items-center gap-2.5 py-3 text-left text-sm font-bold text-slate-900 hover:text-[#047857]"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                    </svg>
                    <span className="truncate">{safeTrim(note) ? `Note: ${safeTrim(note)}` : "Add a note for the store"}</span>
                  </button>
                  {showNote ? (
                    <textarea
                      value={note}
                      maxLength={MAX_ORDER_NOTE_LENGTH}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="Any special instructions for your order..."
                      className="mb-2 w-full resize-none rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  ) : null}
                </div>
              </Card>

              {/* Pre-order slot */}
              {hasPreOrderItems ? (
                <Card title={isPickup ? "Pre-order pickup slot" : "Pre-order delivery slot"}>
                  <p className="mb-3 text-xs text-slate-500">
                    Pre-order items are {isPickup ? "ready for pickup" : "delivered"}
                    {slotAvailability?.date ? ` on ${formatPreOrderDay(slotAvailability.date)}` : " tomorrow"}.
                    Pick a time slot:
                  </p>
                  {preOrderSlots.length === 0 ? (
                    <p className="text-xs font-semibold text-red-600">No slots available right now.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {preOrderSlots.map((slot) => {
                        const isSelected = selectedPreOrderSlot === slot.label;
                        return (
                          <button
                            key={slot.label}
                            type="button"
                            disabled={slot.isFull}
                            onClick={() => setSelectedPreOrderSlot(slot.label)}
                            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                              isSelected ? "border-[#047857] bg-emerald-50/60" : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <span className={`text-sm ${isSelected ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                              {formatSlotLabel(slot.label)}
                            </span>
                            <span
                              className={`shrink-0 text-[11px] ${
                                slot.isFull ? "font-medium text-red-600" : isSelected ? "font-medium text-[#047857]" : "text-slate-500"
                              }`}
                            >
                              {isSelected ? "Selected" : slotAvailabilityText(slot)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ) : null}

              {/* Delivery instructions (sent with the order note) */}
              {!isPickup ? (
                <Card title="Delivery instructions">
                  <div className="flex flex-wrap gap-2">
                    {DELIVERY_INSTRUCTIONS.map((option) => {
                      const active = Boolean(deliveryInstructions[option.key]);
                      return (
                        <button
                          key={option.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setDeliveryInstructions((prev) => ({ ...prev, [option.key]: !prev[option.key] }))
                          }
                          className={`inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? "border-[#047857] bg-emerald-50 text-[#047857]"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ) : null}

              {/* Savings corner */}
              <div>
                <SectionLabel>SAVINGS CORNER</SectionLabel>
                <Card>
                  {appliedCoupon ? (
                    <CouponRow
                      title={`You saved ${formatPrice(appliedCoupon.discountAmount)} with '${appliedCoupon.code}'`}
                      subtitle={appliedCoupon.title || "Coupon applied"}
                      actionLabel="Remove"
                      actionClass="text-red-600"
                      onAction={handleRemoveCoupon}
                    />
                  ) : null}
                  {appliedCoupon && suggestedCoupon ? <div className="my-3 border-t border-slate-100" /> : null}
                  {suggestedCoupon ? (
                    <CouponRow
                      title={
                        suggestedCoupon.unlocked
                          ? `Save ${formatPrice(suggestedCoupon.discountAmount)} with '${suggestedCoupon.code}'`
                          : formatCouponHeadline(suggestedCoupon)
                      }
                      subtitle={
                        suggestedCoupon.unlocked
                          ? formatCouponHeadline(suggestedCoupon)
                          : formatCouponUnlockMessage(suggestedCoupon)
                      }
                      actionLabel={suggestedCoupon.unlocked ? "Apply" : null}
                      disabled={applyingCoupon}
                      onAction={() => applyCouponCode(suggestedCoupon.code)}
                    />
                  ) : null}
                  {!appliedCoupon ? (
                    <div className={suggestedCoupon ? "mt-3" : ""}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => {
                            setCouponInput(e.target.value.toUpperCase());
                            if (couponError) setCouponError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleApplyCoupon();
                            }
                          }}
                          placeholder="Enter coupon code"
                          className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-2.5 text-sm uppercase outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={applyingCoupon || !couponInput.trim()}
                          className="shrink-0 px-2 text-sm font-extrabold text-[#047857] disabled:opacity-40"
                        >
                          {applyingCoupon ? "…" : "APPLY"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {couponError ? <p className="mt-2 text-xs text-red-600">{couponError}</p> : null}

                  {/* Gift card */}
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {appliedGiftCard ? (
                      <CouponRow
                        title={`Gift card '${appliedGiftCard.code}'`}
                        subtitle={`Balance used ${formatPrice(giftCardDiscount)}`}
                        actionLabel="Remove"
                        actionClass="text-red-600"
                        onAction={handleRemoveGiftCard}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={giftCardInput}
                          onChange={(e) => {
                            setGiftCardInput(e.target.value.toUpperCase());
                            if (giftCardError) setGiftCardError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleApplyGiftCard();
                            }
                          }}
                          placeholder="Have a gift card?"
                          className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-2.5 text-sm uppercase outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <button
                          type="button"
                          onClick={handleApplyGiftCard}
                          disabled={applyingGiftCard || !giftCardInput.trim()}
                          className="shrink-0 px-2 text-sm font-extrabold text-[#047857] disabled:opacity-40"
                        >
                          {applyingGiftCard ? "…" : "APPLY"}
                        </button>
                      </div>
                    )}
                    {giftCardError ? <p className="mt-2 text-xs text-red-600">{giftCardError}</p> : null}
                  </div>

                  {/* Reward points */}
                  {rewardsActive ? (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold text-slate-900">
                          <Coins className="h-4 w-4 text-amber-500" strokeWidth={2.2} />
                          Reward points{" "}
                          <span className="font-semibold text-slate-500">
                            · {userRewardPoints} pts ({formatPrice((userRewardPoints || 0) * (rewardSettings?.pointValueInRupees || 1), 2)})
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowRewardTermsModal(true)}
                          className="text-[11px] font-medium text-slate-500 underline hover:text-[#047857]"
                        >
                          T&C
                        </button>
                      </div>
                      {userRewardPoints <= 0 ? (
                        <p className="text-xs text-slate-500">Earn points on this order and redeem them next time.</p>
                      ) : subtotal < (rewardSettings?.minOrderAmountToRedeem || 0) ? (
                        <p className="text-xs text-amber-700">
                          Minimum order of {formatPrice(rewardSettings.minOrderAmountToRedeem)} required to redeem points.
                        </p>
                      ) : userRewardPoints < (rewardSettings?.minPointsToRedeem || 0) ? (
                        <p className="text-xs text-slate-500">
                          Minimum {rewardSettings.minPointsToRedeem} points required to redeem.
                        </p>
                      ) : (
                        <>
                          <label className="flex cursor-pointer items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={useRewards}
                              onChange={(e) => {
                                setUseRewards(e.target.checked);
                                setRewardPointsInput(e.target.checked ? maxRedeemablePoints : 0);
                              }}
                              className="mt-0.5 h-4 w-4 accent-[#047857]"
                            />
                            <span className="text-xs text-slate-600">
                              Use up to <strong>{maxRedeemablePoints}</strong> points (max{" "}
                              {rewardSettings?.maxRedemptionPercent || 50}% of order)
                            </span>
                          </label>
                          {useRewards ? (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max={maxRedeemablePoints}
                                value={rewardPointsInput || ""}
                                onChange={(e) =>
                                  setRewardPointsInput(Math.max(0, Math.min(maxRedeemablePoints, Number(e.target.value))))
                                }
                                className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-200"
                              />
                              <button
                                type="button"
                                onClick={() => setRewardPointsInput(maxRedeemablePoints)}
                                className="shrink-0 rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-200"
                              >
                                Max
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}

                  <Link
                    to="/coupons"
                    className="mt-3 flex items-center gap-2.5 border-t border-slate-100 pt-3 text-sm font-bold text-slate-900 hover:text-[#047857]"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current text-[10px] font-black">
                      %
                    </span>
                    <span className="flex-1">View all coupons & offers</span>
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </Card>
              </div>
            </div>

            {/* Right column */}
            <div className="min-w-0 space-y-4 lg:sticky lg:top-20">
              <div>
                <SectionLabel>BILL DETAILS</SectionLabel>
                <Card>
                  <BillRow
                    icon={<Receipt />}
                    label="Item Total"
                    struck={savings > 0 ? formatPrice(mrpTotal) : null}
                    value={formatPrice(subtotal)}
                  />
                  {couponDiscount > 0 ? (
                    <BillRow
                      icon={<Tag />}
                      label={`Coupon (${appliedCoupon?.code})`}
                      value={`-${formatPrice(couponDiscount)}`}
                      valueClass="text-[#0B7A3B]"
                    />
                  ) : null}
                  {giftCardDiscount > 0 ? (
                    <BillRow
                      icon={<Gift />}
                      label="Gift card"
                      value={`-${formatPrice(giftCardDiscount)}`}
                      valueClass="text-[#0B7A3B]"
                    />
                  ) : null}
                  {rewardDiscount > 0 ? (
                    <BillRow
                      icon={<Coins />}
                      label={`Reward points (${effectiveRewardPoints} pts)`}
                      value={`-${formatPrice(rewardDiscount, 2)}`}
                      valueClass="text-[#0B7A3B]"
                    />
                  ) : null}
                  <BillRow
                    icon={isPickup ? <Store /> : <Bike />}
                    label={isPickup ? "Store pickup" : "Delivery Fee"}
                    value={!deliveryFeeKnown ? "Calculating…" : deliveryCharges <= 0 ? "FREE" : formatPrice(deliveryCharges)}
                    valueClass={deliveryFeeKnown && deliveryCharges <= 0 ? "text-[#0B7A3B]" : "text-slate-900"}
                    note={
                      cheaperSlab
                        ? `Add ${formatPrice(cheaperSlab.orderAmount - subtotal)} more for ${
                            cheaperSlab.shippingCharge <= 0
                              ? "FREE delivery"
                              : `${formatPrice(cheaperSlab.shippingCharge)} delivery`
                          }`
                        : null
                    }
                  />
                  <p className="pl-8 text-[11px] text-slate-500">GST included in item prices</p>
                  <DashedDivider />
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-[15px] font-extrabold">To Pay</span>
                    {totalSaved > 0 && deliveryFeeKnown ? (
                      <span className="text-xs font-medium text-slate-400 line-through">
                        {formatPrice(mrpTotal + deliveryCharges)}
                      </span>
                    ) : null}
                    <span className="text-[15px] font-extrabold">{formatPrice(orderTotal)}</span>
                  </div>
                  {rewardsActive && pointsToEarn > 0 ? (
                    <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                      <Coins className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={2.2} />
                      You will earn +{pointsToEarn} reward points on this order
                    </p>
                  ) : null}
                </Card>
              </div>

              <Card>
                <p className="text-xs font-extrabold text-slate-500">NOTE:</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  You can cancel this order until the store starts packing it. Once it is packed, it can no
                  longer be cancelled.
                </p>
                <Link
                  to="/terms-and-conditions"
                  className="mt-1.5 inline-block text-xs font-extrabold text-[#047857] underline underline-offset-2"
                >
                  READ CANCELLATION POLICY
                </Link>
              </Card>

              {orderError ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600 ring-1 ring-red-100">
                  {orderError}
                </p>
              ) : null}

              {/* Pay bar: fixed on mobile, in the column on desktop */}
              <div className="fixed inset-x-0 bottom-0 z-50 bg-white px-3.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2.5 shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.15)] lg:static lg:rounded-2xl lg:p-4 lg:shadow-none">
                <div className="mx-auto max-w-5xl">
                  {payBlocker ? (
                    <p
                      className={`mb-2 text-center text-[11.5px] font-semibold ${
                        minimumOrderMet ? "text-slate-500" : "text-orange-800"
                      }`}
                    >
                      {payBlocker}
                    </p>
                  ) : null}
                  <div className="mb-2 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-bold tracking-wider text-slate-500">PAY USING</p>
                      <p className="flex items-center gap-1.5 truncate text-sm font-extrabold">
                        {paymentPlan ? (
                          paymentPlan === PAYMENT_PLAN.COD ? (
                            <Banknote className="h-4 w-4 shrink-0 text-[#047857]" strokeWidth={2.2} aria-hidden="true" />
                          ) : (
                            <CreditCard className="h-4 w-4 shrink-0 text-[#047857]" strokeWidth={2.2} aria-hidden="true" />
                          )
                        ) : null}
                        <span className="truncate">{paymentLabel || "Choose payment method"}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPaymentSheet(true)}
                      className="shrink-0 px-1 text-sm font-extrabold text-[#047857]"
                    >
                      {paymentPlan ? "Change" : "Choose"}
                    </button>
                  </div>
                  <SlideToPay
                    label={
                      !paymentPlan
                        ? "Slide to choose payment"
                        : paymentPlan === PAYMENT_PLAN.COD
                          ? "Slide to Place Order"
                          : "Slide to Pay"
                    }
                    amount={deliveryFeeKnown ? formatPrice(orderTotal) : "…"}
                    enabled={readyToPay}
                    onComplete={() => (paymentPlan ? handlePlaceOrder() : setShowPaymentSheet(true))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {showRewardTermsModal && (
        <RewardPointsModal
          open={showRewardTermsModal}
          onClose={() => setShowRewardTermsModal(false)}
        />
      )}
    </div>
  );
}

export default Checkout;
