import crypto from "crypto";
import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Address from "../models/address/Address.js";
import Order from "../models/order/Order.js";
import Product from "../models/Product.js";
import User from "../models/user.js";
import { isLocalProductId } from "./localProductId.js";
import {
  PRE_ORDER_PROGRESS_STEPS,
  preOrderProgressInfo,
  buildPreOrderTimeline,
} from "../../delivery-service/src/services/preOrderProgress.js";
import {
  getAvailableColors,
  getUnitPriceForQuantity,
  getVariant,
  getVariantStock,
  isMultiVariant,
  PRODUCT_PRICING_SELECT,
} from "./productPricing.js";
import {
  calculateShippingCharge,
  getStoreSettings,
  meetsMinimumOrder,
} from "./storeSettingsHelpers.js";
import { calculateOrderTotal } from "./gstHelpers.js";
import { getRecordedAdvancePaidAmount } from "./paymentHelpers.js";
import { resolveCouponForCheckout } from "../controllers/couponController.js";
import { geocodeAddressString } from "../services/reverseGeocodeService.js";
import {
  getRewardSettings,
  calculateEligibleRewardDiscount,
  calculatePointsToEarn,
  processOrderRewardPoints,
} from "../controllers/rewardController.js";
import { resolveGiftHamperForOrder, getCustomerVisibleGiftHamper } from "../../../shared/store/giftHamper.js";
import { dispatchDeliveryOrder } from "../services/deliveryDispatcher.js";
import { previewGiftCard, consumeGiftCard } from "../../admin-ops-service/src/giftCardService.js";
import { computePreOrderDate, normalizePreOrderSlot } from "./preOrderHelpers.js";
import { normalizeFulfillmentType } from "./departmentHelpers.js";

/** Vendor zone / dark-store shipping rules for the store serving `options.shippingAddress`, or null. */
async function quoteVendorShippingSafe(subtotal, options) {
  if (!options.shippingAddress) return null;
  try {
    const { quoteVendorShipping } = await import(
      "../../farmer-manager-service/src/shippingControllers.js"
    );
    const hasPastOrder = options.userId
      ? await Order.exists({ user: options.userId, status: { $nin: ["attempted", "cancelled"] } })
      : true;
    return await quoteVendorShipping({
      address: options.shippingAddress,
      items: options.items || [],
      subtotal,
      userType: hasPastOrder ? "retail" : "first_order",
    });
  } catch (err) {
    console.warn("Vendor shipping quote failed, using store settings:", err.message);
    return null;
  }
}

async function computeOrderPricing(subtotal, couponCode, options = {}) {
  const storeSettings = await getStoreSettings();
  let resolvedCouponCode = "";
  let couponDiscount = 0;

  if (couponCode) {
    const couponResult = await resolveCouponForCheckout(couponCode, subtotal, {
      userId: options.userId,
      excludeOrderId: options.excludeOrderId,
    });
    if (couponResult.error) {
      return {
        error: couponResult.error,
        status: 400,
        code: "INVALID_COUPON",
      };
    }
    resolvedCouponCode = couponResult.couponCode;
    couponDiscount = couponResult.couponDiscount;
  }

  let rewardPointsUsed = 0;
  let rewardDiscount = 0;

  if (options.rewardPointsToUse && options.userId) {
    const rewardSettings = await getRewardSettings();
    const user = await User.findById(options.userId).select("rewardPoints");
    const subtotalAfterCoupon = Math.max(0, subtotal - couponDiscount);
    const rewardResult = calculateEligibleRewardDiscount(
      user?.rewardPoints || 0,
      options.rewardPointsToUse,
      subtotalAfterCoupon,
      rewardSettings
    );
    if (!rewardResult.valid) {
      return {
        error: rewardResult.reason || "Invalid reward points redemption",
        status: 400,
        code: "INVALID_REWARD_POINTS",
      };
    }
    rewardPointsUsed = rewardResult.pointsToUse;
    rewardDiscount = rewardResult.discount;
  }

  let giftCardCode = "";
  let giftCardDiscount = 0;
  if (options.giftCardCode) {
    const payableAfterOffers = Math.max(0, subtotal - couponDiscount - rewardDiscount);
    const giftResult = await previewGiftCard(options.giftCardCode, payableAfterOffers);
    if (giftResult.error) {
      return {
        error: giftResult.error,
        status: 400,
        code: "INVALID_GIFT_CARD",
      };
    }
    giftCardCode = giftResult.code;
    giftCardDiscount = giftResult.discountAmount;
  }

  // Evaluate Dynamic Pricing Rules (Quantity discounts, Bundle deals with exceptions, Tiered volume discounts, Free/discounted add-ons, Lifetime loyalty, Heavy item fees)
  let dynamicPricing = {
    bundleDiscount: 0,
    loyaltyDiscount: 0,
    quantityDiscount: 0,
    tieredDiscount: 0,
    totalDiscount: 0,
    heavyHandlingFee: 0,
    freeAddon: null,
    appliedRules: [],
  };

  try {
    const { evaluateDynamicPricingForCart } = await import(
      "../../admin-ops-service/src/pricingAttach.js"
    );
    dynamicPricing = await evaluateDynamicPricingForCart({
      items: options.items || [],
      userId: options.userId,
      subtotal,
    });
  } catch (err) {
    console.warn("Dynamic pricing evaluation warning:", err.message);
  }

  const bundleDiscount = dynamicPricing.bundleDiscount || 0;
  const loyaltyDiscount = dynamicPricing.loyaltyDiscount || 0;
  const quantityDiscount = (dynamicPricing.quantityDiscount || 0) + (dynamicPricing.tieredDiscount || 0);
  const totalDynamicDiscount = dynamicPricing.totalDiscount || 0;
  const heavyHandlingFee = dynamicPricing.heavyHandlingFee || 0;
  const freeAddon = dynamicPricing.freeAddon || null;

  const isPickup = normalizeFulfillmentType(options.fulfillmentType) === "pickup";
  const vendorShipping = isPickup ? null : await quoteVendorShippingSafe(subtotal, options);
  if (vendorShipping && !vendorShipping.serviceable) {
    return {
      error: "Delivery is not available to this address. Please choose a different address.",
      status: 400,
      code: "ADDRESS_NOT_SERVICEABLE",
    };
  }
  const baseDeliveryCharges = isPickup
    ? 0
    : vendorShipping
      ? vendorShipping.shippingCost
      : calculateShippingCharge(subtotal, storeSettings);
  const deliveryCharges = baseDeliveryCharges + heavyHandlingFee;

  const discountedSubtotal = Math.max(
    0,
    subtotal - couponDiscount - rewardDiscount - giftCardDiscount - totalDynamicDiscount
  );
  const { gstAmount, total } = calculateOrderTotal(discountedSubtotal, deliveryCharges);

  const rewardSettings = await getRewardSettings();
  const rewardPointsEarned = calculatePointsToEarn(subtotal, rewardSettings);

  return {
    storeSettings,
    deliveryCharges: baseDeliveryCharges,
    heavyHandlingFee,
    gstAmount,
    total,
    couponCode: resolvedCouponCode,
    couponDiscount,
    rewardPointsUsed,
    rewardDiscount,
    rewardPointsEarned,
    giftCardCode,
    giftCardDiscount,
    bundleDiscount,
    loyaltyDiscount,
    quantityDiscount,
    dynamicDiscount: totalDynamicDiscount,
    freeAddon,
    dynamicPricingDetails: dynamicPricing,
  };
}

const normalizeVariantName = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeColorName = (value) =>
  typeof value === "string" ? value.trim() : "";

const matchesOrderedItem = (cartItem, orderItem) => {
  const cartProductId = String(cartItem?.product?._id || cartItem?.product || "");
  const orderProductId = String(orderItem?.product?._id || orderItem?.product || "");

  return (
    cartProductId === orderProductId &&
    normalizeVariantName(cartItem.variantName) ===
      normalizeVariantName(orderItem.variantName) &&
    normalizeColorName(cartItem.colorName) === normalizeColorName(orderItem.colorName)
  );
};

export function resolveCheckoutMode(options = {}) {
  if (options.checkoutMode === "buyNow" || options.buyNow === true) {
    return "buyNow";
  }
  return "cart";
}

export function normalizeOrderMessage(body = {}) {
  const raw = body.customerMessage ?? body.message ?? body.customerNote ?? "";
  return typeof raw === "string" ? raw.trim().slice(0, 500) : "";
}

const populateCart = (query) =>
  query.populate({
    path: "items.product",
    select: PRODUCT_PRICING_SELECT,
  });

export const populateOrderItems = (query) =>
  query.populate({
    path: "items.product",
    select: "productImages",
  });

export function enrichOrderForResponse(
  order,
  { customerView = false, verifiedAdvancePayment = null } = {}
) {
  const doc = typeof order.toObject === "function" ? order.toObject() : { ...order };
  const giftHamper = customerView
    ? getCustomerVisibleGiftHamper(doc.giftHamper)
    : doc.giftHamper ?? null;
  const advancePaidAmount = getRecordedAdvancePaidAmount(doc, verifiedAdvancePayment);

  return {
    ...doc,
    advancePaidAmount,
    giftHamper,
    deliveryOtp: doc.deliveryOtp || "",
    items: (doc.items || []).map((item) => {
      const productImages =
        item.product && typeof item.product === "object" ? item.product.productImages || [] : [];
      const productImage = productImages[0] || "";
      const storedImage = (item.image || "").trim();

      return {
        ...item,
        image: storedImage || productImage,
        productImage,
        product: item.product?._id || item.product,
      };
    }),
  };
}

/**
 * Attach dark-store details from StoreOrder for customer-facing responses:
 * delivery OTP (backfills older orders), the store's name / phone / address, and
 * the store-side parts (a mixed cart has a "now" and a "preorder" part).
 */
export async function attachCustomerDeliveryOtps(enriched) {
  const list = Array.isArray(enriched) ? enriched : [enriched];
  const withIds = list.filter((o) => o?._id);
  if (!withIds.length) return enriched;

  try {
    const StoreOrder = (await import("../../delivery-service/src/models/StoreOrder.js")).default;
    const DeliveryManager = (await import("../../delivery-service/src/models/DeliveryManager.js")).default;
    const storeOrders = await StoreOrder.find({
      sourceOrderId: { $in: withIds.map((o) => o._id) },
    })
      .select(
        "sourceOrderId sourcePart managerId orderNumber status otpCode isPreOrder preOrderSlot preOrderDate preOrderStage vendorStatus vendorConfirmedAt vendorActionByName preparingAt readyAt forwardedAt forwardedByName storeReceivedAt storeReceivedByName assignedAt fullTimeAssignedAt outForDeliveryAt deliveredAt packedAt fulfillmentType departments createdAt updatedAt"
      )
      .sort({ createdAt: 1 })
      .lean();

    const managerIds = [...new Set(storeOrders.map((s) => String(s.managerId)))];
    const managers = managerIds.length
      ? await DeliveryManager.find({ _id: { $in: managerIds } })
          .select("storeName storeAddress area city state pincode phone latitude longitude")
          .lean()
      : [];
    const managerById = new Map(managers.map((m) => [String(m._id), m]));

    const bySource = new Map();
    for (const row of storeOrders) {
      const key = String(row.sourceOrderId);
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push(row);
    }

    for (const order of withIds) {
      const parts = bySource.get(String(order._id)) || [];
      if (!parts.length) continue;
      if (!order.deliveryOtp) {
        const otp = String(parts[0].otpCode || "").trim();
        if (otp) order.deliveryOtp = otp;
      }
      const manager = managerById.get(String(parts[0].managerId));
      if (manager) {
        const storeName = manager.storeName || `${manager.area} Store`;
        order.darkStore = {
          id: String(manager._id),
          storeName,
          phone: manager.phone || "",
          address:
            manager.storeAddress ||
            [storeName, manager.area, manager.city, manager.state, manager.pincode]
              .filter(Boolean)
              .join(", "),
          latitude: manager.latitude ?? null,
          longitude: manager.longitude ?? null,
        };
      }
      order.storeParts = parts.map((part) => {
        const progress = part.isPreOrder ? preOrderProgressInfo(part) : null;
        const timeline = part.isPreOrder ? buildPreOrderTimeline(part, order) : [];
        return {
          orderNumber: part.orderNumber,
          part: part.sourcePart || "",
          status: part.status,
          isPreOrder: Boolean(part.isPreOrder),
          preOrderSlot: part.preOrderSlot || "",
          preOrderDate: part.preOrderDate || "",
          preOrderProgress: progress?.key || "",
          preOrderProgressLabel: progress?.label || "",
          preOrderProgressStep: progress?.step ?? -1,
          vendorConfirmedAt: part.vendorConfirmedAt || null,
          vendorActionByName: part.vendorActionByName || "",
          preparingAt: part.preparingAt || part.readyAt || null,
          forwardedAt: part.forwardedAt || null,
          forwardedByName: part.forwardedByName || "",
          storeReceivedAt: part.storeReceivedAt || null,
          storeReceivedByName: part.storeReceivedByName || "",
          assignedAt: part.assignedAt || part.fullTimeAssignedAt || null,
          outForDeliveryAt: part.outForDeliveryAt || null,
          deliveredAt: part.deliveredAt || null,
          preOrderTimeline: timeline,
          fulfillmentType: part.fulfillmentType || "delivery",
          departments: part.departments || [],
        };
      });
      const preOrderPart = order.storeParts.find((part) => part.isPreOrder);
      if (preOrderPart) {
        order.preOrderProgress = preOrderPart.preOrderProgress;
        order.preOrderProgressLabel = preOrderPart.preOrderProgressLabel;
        order.preOrderProgressStep = preOrderPart.preOrderProgressStep;
        order.preOrderProgressSteps = PRE_ORDER_PROGRESS_STEPS;
        order.preOrderTimeline = preOrderPart.preOrderTimeline;
      }
    }
  } catch (err) {
    console.warn("[attachCustomerDeliveryOtps]", err.message);
  }
  return Array.isArray(enriched) ? list : list[0];
}

function toCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordsFromSource(source = {}) {
  const lat = toCoord(
    source.location?.lat ?? source.lat ?? source.latitude
  );
  const lng = toCoord(
    source.location?.lng ?? source.lng ?? source.longitude
  );
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

export function mergeCustomerLocation(snapshot, customerLocation) {
  if (!snapshot) return snapshot;
  const next = { ...snapshot };

  if (customerLocation && typeof customerLocation === "object") {
    if (customerLocation.address || customerLocation.fullAddress) {
      const addrStr = String(customerLocation.address || customerLocation.fullAddress).trim();
      if (addrStr.length > 0 && addrStr !== "Main Address" && addrStr !== "Address to be confirmed") {
        next.fullAddress = addrStr;
      }
    }
    if (customerLocation.area) {
      const areaStr = String(customerLocation.area).trim();
      if (areaStr.length > 0 && areaStr !== "Near Location") {
        next.area = areaStr;
        if (!next.landmark || next.landmark === "Near Location") {
          next.landmark = areaStr;
        }
      }
    }
    if (customerLocation.city) {
      const cityStr = String(customerLocation.city).trim();
      if (cityStr.length > 0 && cityStr !== "City") {
        next.city = cityStr;
      }
    }
    if (customerLocation.state) {
      const stateStr = String(customerLocation.state).trim();
      if (stateStr.length > 0 && stateStr !== "State") {
        next.state = stateStr;
      }
    }
    if (customerLocation.pincode) {
      const pinStr = String(customerLocation.pincode).trim();
      if (pinStr.length > 0 && pinStr !== "110001") {
        next.pincode = pinStr;
      }
    }
    if (customerLocation.lat && customerLocation.lng) {
      next.location = { lat: customerLocation.lat, lng: customerLocation.lng };
    }
  }

  return next;
}

export function addressToSnapshot(address, customerLocation) {
  const raw = typeof address.toObject === "function" ? address.toObject() : address;
  const coords = coordsFromSource(raw);

  const snapshot = {
    fullName: (raw.fullName || raw.name || "Customer").trim(),
    number: String(raw.number || raw.phone || "9876543210").trim(),
    email: String(raw.email || "customer@greengrocc.com").trim().toLowerCase(),
    shopNo: (raw.shopNo || "Main").trim(),
    shopName: (raw.shopName || "Home/Work").trim(),
    fullAddress: (raw.fullAddress || raw.streetArea || raw.landmark || "Main Address").trim(),
    landmark: (raw.landmark || raw.area || "Near Location").trim(),
    city: (raw.city || "City").trim(),
    state: (raw.state || "State").trim(),
    pincode: String(raw.pincode || "110001").trim(),
    area: (raw.area || raw.landmark || "Near Location").trim(),
    ...(coords ? { location: coords } : {}),
  };

  return mergeCustomerLocation(snapshot, customerLocation);
}

function formatSnapshotForGeocode(snapshot = {}) {
  return [
    snapshot.shopNo,
    snapshot.shopName,
    snapshot.fullAddress,
    snapshot.landmark,
    snapshot.area,
    snapshot.city,
    snapshot.state,
    snapshot.pincode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

export async function ensureDeliveryAddressCoords(deliveryAddress) {
  if (!deliveryAddress) return deliveryAddress;
  if (coordsFromSource(deliveryAddress)) return deliveryAddress;

  const query = formatSnapshotForGeocode(deliveryAddress);
  if (!query) return deliveryAddress;

  const geocoded = await geocodeAddressString(query);
  if (!geocoded) return deliveryAddress;

  return {
    ...deliveryAddress,
    location: geocoded,
  };
}

export function listUnavailableCartItems(items = []) {
  const unavailable = [];
  const available = [];

  for (const item of items) {
    if (!item?.product) {
      unavailable.push({
        productId: item?.product,
        name: "Unavailable product",
        reason: "missing",
      });
      continue;
    }

    if (item.product.isActive === false) {
      unavailable.push({
        productId: item.product._id,
        name: item.product.name || "Unavailable product",
        reason: "inactive",
      });
      continue;
    }

    available.push(item);
  }

  return { unavailable, available };
}

export async function pruneUnavailableCartItems(cart) {
  if (!cart?.items?.length) {
    return { removed: [], changed: false };
  }

  const { unavailable, available } = listUnavailableCartItems(cart.items);
  if (!unavailable.length) {
    return { removed: [], changed: false };
  }

  cart.items = available;
  await cart.save();
  return { removed: unavailable, changed: true };
}

function localCatalogProductId(localId) {
  const hash = crypto.createHash("md5").update(String(localId)).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hash);
}

function buildCatalogProductFromEntry(entry) {
  const localId = entry.productId || entry._id;
  const unitPrice = Number(entry.discountedPrice ?? entry.price);
  const name = String(entry.name || "").trim();

  if (!localId || !name || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return null;
  }

  const images = Array.isArray(entry.productImages)
    ? entry.productImages.filter(Boolean)
    : entry.image
      ? [entry.image]
      : [];

  return {
    _id: localCatalogProductId(localId),
    name,
    brandName: String(entry.brandName || "").trim(),
    price: Number(entry.price ?? unitPrice),
    discountedPrice: unitPrice,
    isActive: true,
    inStock: true,
    stock: 9999,
    productImages: images,
  };
}

async function resolveCheckoutItems(rawItems, { skipStockCheck = false } = {}) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "No items to checkout", status: 400 };
  }

  const resolved = [];

  for (const entry of rawItems) {
    const productId = entry.productId || entry._id;
    const normalizedVariantName = normalizeVariantName(entry.variantName);
    const normalizedColorName = normalizeColorName(entry.colorName);
    const qty = Number(entry.quantity);

    if (!productId || !Number.isFinite(qty) || qty < 1) {
      return { error: "Invalid checkout item", status: 400 };
    }

    let product = null;

    if (isLocalProductId(productId)) {
      product = buildCatalogProductFromEntry(entry);
      if (!product) {
        return { error: "Invalid checkout item", status: 400 };
      }
    } else {
      try {
        product = await Product.findById(productId).select(PRODUCT_PRICING_SELECT);
      } catch (_) {
        product = null;
      }
      if (!product || !product.isActive) {
        product = buildCatalogProductFromEntry(entry);
        if (!product) {
          return {
            error: "One or more products are no longer available",
            status: 404,
          };
        }
      }
    }

    if (isMultiVariant(product)) {
      if (!normalizedVariantName) {
        return {
          error: "Variant selection is required for this product",
          status: 400,
        };
      }

      if (!getVariant(product, normalizedVariantName)) {
        return {
          error: "Selected variant is not available",
          status: 400,
        };
      }
    }

    const availableColors = getAvailableColors(product, normalizedVariantName);
    if (availableColors.length > 0) {
      if (!normalizedColorName) {
        return {
          error: "Color selection is required for this product",
          status: 400,
        };
      }

      const colorMatch = availableColors.some(
        (color) =>
          color.name?.trim().toLowerCase() === normalizedColorName.toLowerCase()
      );

      if (!colorMatch) {
        return {
          error: "Selected color is not available",
          status: 400,
        };
      }
    }

    const availableStock = getVariantStock(product, normalizedVariantName);
    if (!skipStockCheck && qty > availableStock) {
      return {
        error: `Only ${availableStock} units available in stock`,
        status: 400,
      };
    }

    resolved.push({
      product,
      quantity: qty,
      variantName: normalizedVariantName,
      colorName: normalizedColorName,
    });
  }

  return { items: resolved };
}

function buildOrderItemsFromResolved(items) {
  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    if (!item.product || item.product.isActive === false) {
      return {
        error: "One or more products are no longer available",
        status: 400,
        code: "CART_ITEMS_UNAVAILABLE",
      };
    }

    const variantName = item.variantName || "";
    const colorName = item.colorName || "";
    const price = getUnitPriceForQuantity(item.product, item.quantity, variantName);
    subtotal += price * item.quantity;

    orderItems.push({
      product: item.product._id,
      name: item.product.name,
      brandName: item.product.brandName || "",
      variantName,
      colorName,
      price,
      quantity: item.quantity,
      image: item.product.productImages?.[0] || "",
    });
  }

  return { orderItems, subtotal };
}

export async function prepareOrderData(userId, addressId, options = {}) {
  const user = await User.findById(userId);
  if (!user) {
    return { error: "User not found", status: 404 };
  }

  let address = null;
  const isDummyAddress = (id) =>
    !id || id === "default_address" || id === "defult_address" || !mongoose.Types.ObjectId.isValid(id);

  if (!isDummyAddress(addressId)) {
    try {
      address = await Address.findOne({ _id: addressId, user: userId });
    } catch (_) {
      address = null;
    }
  }

  if (!address) {
    try {
      address =
        (await Address.findOne({ user: userId, isDefault: true })) ||
        (await Address.findOne({ user: userId }));
    } catch (_) {
      address = null;
    }
  }

  if (!address) {
    const rawPhone = String(user.phone || "").trim().replace(/\D/g, "").slice(-10);
    const phone = /^[6789]\d{9}$/.test(rawPhone) ? rawPhone : "9876543210";
    const rawEmail = String(user.email || "").trim().toLowerCase();
    const email = /^\S+@\S+\.\S+$/.test(rawEmail)
      ? rawEmail
      : `user_${userId.toString().slice(-6)}@greengrocc.com`;
    const custLoc = options.customerLocation || {};

    try {
      address = await Address.create({
        user: userId,
        fullName: (user.name || "Customer").trim(),
        number: phone,
        email: email,
        shopNo: custLoc.shopNo || "Main",
        shopName: custLoc.shopName || "Home/Work",
        fullAddress: custLoc.fullAddress || custLoc.address || "Main Street",
        landmark: custLoc.landmark || custLoc.area || "Near Location",
        city: custLoc.city || "City",
        state: custLoc.state || "State",
        pincode:
          custLoc.pincode && /^\d{6}$/.test(custLoc.pincode)
            ? custLoc.pincode
            : "110001",
        area: custLoc.area || "",
        isDefault: true,
      });
    } catch (e) {
      console.warn("Failed to auto-create address for user:", e.message);
    }
  }

  const resolvedItems = await resolveItemsForCheckout(userId, options);
  if (resolvedItems.error) {
    return resolvedItems;
  }

  const { itemsToProcess, cart, checkoutMode } = resolvedItems;

  const built = buildOrderItemsFromResolved(itemsToProcess);
  if (built.error) {
    return built;
  }

  const { orderItems, subtotal } = built;

  const fulfillmentType = normalizeFulfillmentType(options.fulfillmentType);
  const pricing = await computeOrderPricing(subtotal, options.couponCode, {
    userId,
    rewardPointsToUse: options.rewardPointsToUse,
    giftCardCode: options.giftCardCode,
    fulfillmentType,
    items: orderItems,
    shippingAddress: address
      ? addressToSnapshot(address, options.customerLocation)
      : mergeCustomerLocation(buildPendingDeliveryAddress(user, null), options.customerLocation),
  });
  if (pricing.error) {
    return pricing;
  }

  const {
    storeSettings,
    deliveryCharges,
    heavyHandlingFee,
    gstAmount,
    total,
    couponCode,
    couponDiscount,
    rewardPointsUsed,
    rewardDiscount,
    rewardPointsEarned,
    giftCardCode,
    giftCardDiscount,
    bundleDiscount,
    loyaltyDiscount,
    quantityDiscount,
    dynamicDiscount,
    freeAddon,
    dynamicPricingDetails,
  } = pricing;

  if (!meetsMinimumOrder(subtotal, storeSettings)) {
    return {
      error: `Minimum order value is ₹${storeSettings.minimumOrderValue}. Please add more items to your cart.`,
      status: 400,
      code: "MINIMUM_ORDER_NOT_MET",
      minimumOrderValue: storeSettings.minimumOrderValue,
    };
  }

  let deliveryAddress;
  if (address) {
    deliveryAddress = await ensureDeliveryAddressCoords(
      addressToSnapshot(address, options.customerLocation)
    );
  } else {
    deliveryAddress = buildPendingDeliveryAddress(user, null);
  }

  const rawPhone = String(user.phone || "").trim().replace(/\D/g, "").slice(-10);
  const fallbackPhone = /^[6789]\d{9}$/.test(rawPhone) ? rawPhone : "9876543210";
  const rawEmail = String(user.email || "").trim().toLowerCase();
  const fallbackEmail = /^\S+@\S+\.\S+$/.test(rawEmail)
    ? rawEmail
    : `user_${userId.toString().slice(-6)}@greengrocc.com`;

  deliveryAddress.fullName = (deliveryAddress.fullName || user.name || "Customer").trim();
  deliveryAddress.number = (deliveryAddress.number || fallbackPhone).trim();
  deliveryAddress.email = (deliveryAddress.email || fallbackEmail).trim();
  deliveryAddress.shopNo = (deliveryAddress.shopNo && deliveryAddress.shopNo !== "Main" ? deliveryAddress.shopNo : "").trim();
  deliveryAddress.shopName = (deliveryAddress.shopName && deliveryAddress.shopName !== "Home/Work" ? deliveryAddress.shopName : "").trim();
  deliveryAddress.fullAddress = (
    deliveryAddress.fullAddress ||
    options.customerLocation?.address ||
    options.customerLocation?.fullAddress ||
    ""
  ).trim();
  deliveryAddress.landmark = (
    deliveryAddress.landmark && deliveryAddress.landmark !== "Near Location"
      ? deliveryAddress.landmark
      : (options.customerLocation?.area || "")
  ).trim();
  deliveryAddress.city = (
    deliveryAddress.city && deliveryAddress.city !== "City"
      ? deliveryAddress.city
      : (options.customerLocation?.city || "")
  ).trim();
  deliveryAddress.state = (
    deliveryAddress.state && deliveryAddress.state !== "State"
      ? deliveryAddress.state
      : (options.customerLocation?.state || "")
  ).trim();
  deliveryAddress.pincode = (
    deliveryAddress.pincode && deliveryAddress.pincode !== "110001"
      ? deliveryAddress.pincode
      : (options.customerLocation?.pincode || "")
  ).trim();

  if (options.requireDarkStore) {
    const { findStoreForOrder, findStoreShortages } = await import("../services/deliveryDispatcher.js");
    const routing = await findStoreForOrder({
      address: deliveryAddress,
      items: orderItems,
      fulfillmentType,
    });
    if (!routing.manager) {
      return {
        error:
          fulfillmentType === "pickup"
            ? "No dark store is available for pickup near this address. Please choose another address."
            : "We don't deliver to this address yet — no dark store serves it. Please choose another address or pick up from a store.",
        status: 400,
        code: "NO_DARK_STORE",
        reason: routing.reason,
      };
    }

    const shortages = await findStoreShortages({
      managerId: routing.manager._id,
      items: orderItems,
      itemDepartments: routing.itemDepartments,
    });
    if (shortages.length) {
      const storeName = routing.manager.storeName || `${routing.manager.area || "your"} store`;
      const list = shortages
        .map((s) => (s.available > 0 ? `${s.name} (only ${s.available} left)` : `${s.name} (out of stock)`))
        .join(", ");
      return {
        error: `Not enough stock at ${storeName}: ${list}. Please update your cart.`,
        status: 409,
        code: "STORE_OUT_OF_STOCK",
        shortages,
        storeId: String(routing.manager._id),
      };
    }
  }

  return {
    orderItems,
    deliveryAddress,
    subtotal,
    couponCode,
    couponDiscount,
    rewardPointsUsed: rewardPointsUsed || 0,
    rewardDiscount: rewardDiscount || 0,
    rewardPointsEarned: rewardPointsEarned || 0,
    giftCardCode: giftCardCode || "",
    giftCardDiscount: giftCardDiscount || 0,
    deliveryCharges,
    heavyHandlingFee: heavyHandlingFee || 0,
    bundleDiscount: bundleDiscount || 0,
    loyaltyDiscount: loyaltyDiscount || 0,
    quantityDiscount: quantityDiscount || 0,
    dynamicDiscount: dynamicDiscount || 0,
    freeAddon: freeAddon || null,
    dynamicPricingDetails: dynamicPricingDetails || null,
    gstAmount,
    total,
    cart,
    checkoutMode,
    fulfillmentType,
  };
}

export async function rebuildOrderFromItemsInput(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "Order must have at least one item", status: 400 };
  }

  const resolved = await resolveCheckoutItems(rawItems, { skipStockCheck: true });
  if (resolved.error) {
    return resolved;
  }

  const built = buildOrderItemsFromResolved(resolved.items);
  if (built.error) {
    return built;
  }

  const storeSettings = await getStoreSettings();
  const deliveryCharges = calculateShippingCharge(built.subtotal, storeSettings);
  const { gstAmount, total } = calculateOrderTotal(built.subtotal, deliveryCharges);

  return {
    orderItems: built.orderItems,
    subtotal: built.subtotal,
    deliveryCharges,
    gstAmount,
    total,
  };
}

function buildPendingDeliveryAddress(user, address = null) {
  if (address) {
    const snapshot = addressToSnapshot(address);
    const fields = [
      "fullName",
      "number",
      "email",
      "shopNo",
      "shopName",
      "fullAddress",
      "landmark",
      "city",
      "state",
      "pincode",
    ];
    if (fields.every((field) => snapshot[field])) {
      return snapshot;
    }
  }

  const rawPhone = String(user?.phone || "").trim();
  const phone = /^[6789]\d{9}$/.test(rawPhone) ? rawPhone : "6000000000";
  const rawEmail = String(user?.email || "").trim().toLowerCase();
  const email = /^\S+@\S+\.\S+$/.test(rawEmail) ? rawEmail : "customer@example.com";

  return {
    fullName: (user?.name || "Customer").trim(),
    number: phone,
    email,
    shopNo: "Pending",
    shopName: "Checkout in progress",
    fullAddress: "Address to be confirmed",
    landmark: "Pending",
    city: "Pending",
    state: "Pending",
    pincode: "110001",
  };
}

async function resolveItemsForCheckout(userId, options = {}) {
  const checkoutMode = resolveCheckoutMode(options);
  const clientItems = Array.isArray(options.checkoutItems) ? options.checkoutItems : [];
  const cart = await populateCart(Cart.findOne({ user: userId }));

  if (checkoutMode === "buyNow" || clientItems.length > 0) {
    const resolved = await resolveCheckoutItems(clientItems, {
      skipStockCheck: Boolean(options.skipStockCheck || options.requireDarkStore),
    });
    if (resolved.error) {
      return resolved;
    }
    return {
      itemsToProcess: resolved.items,
      cart,
      checkoutMode,
    };
  }

  if (!cart?.items?.length) {
    return { error: "Your cart is empty", status: 400 };
  }

  if (!options.skipStockCheck) {
    const { removed } = await pruneUnavailableCartItems(cart);
    if (removed.length) {
      const names = removed.map((item) => item.name).join(", ");
      return {
        error: `These items are no longer available: ${names}. They were removed from your cart. Please review and try again.`,
        status: 400,
        code: "CART_ITEMS_UNAVAILABLE",
        removedItems: removed,
      };
    }

    if (!cart.items.length) {
      return { error: "Your cart is empty", status: 400 };
    }

    return { itemsToProcess: cart.items, cart, checkoutMode };
  }

  const { unavailable, available } = listUnavailableCartItems(cart.items);
  if (unavailable.length && !available.length) {
    const names = unavailable.map((item) => item.name).join(", ");
    return {
      error: `These items are no longer available: ${names}`,
      status: 400,
      code: "CART_ITEMS_UNAVAILABLE",
      removedItems: unavailable,
    };
  }

  const itemsToProcess = available.length ? available : cart.items;
  return { itemsToProcess, cart, checkoutMode };
}

export async function prepareCheckoutAttemptData(userId, options = {}) {
  const user = await User.findById(userId);
  if (!user) {
    return { error: "User not found", status: 404 };
  }

  let address = null;
  const isDummyAddress = (id) =>
    !id || id === "default_address" || id === "defult_address" || !mongoose.Types.ObjectId.isValid(id);

  if (!isDummyAddress(options.addressId)) {
    try {
      address = await Address.findOne({ _id: options.addressId, user: userId });
    } catch (_) {
      address = null;
    }
  }

  if (!address) {
    try {
      address =
        (await Address.findOne({ user: userId, isDefault: true })) ||
        (await Address.findOne({ user: userId }).sort({ updatedAt: -1 }));
    } catch (_) {
      address = null;
    }
  }

  const resolvedItems = await resolveItemsForCheckout(userId, {
    ...options,
    skipStockCheck: true,
  });
  if (resolvedItems.error) {
    return resolvedItems;
  }

  const { itemsToProcess, cart, checkoutMode } = resolvedItems;
  const built = buildOrderItemsFromResolved(itemsToProcess);
  if (built.error) {
    return built;
  }

  const { orderItems, subtotal } = built;

  const attemptedOrder = await Order.findOne({ user: userId, status: "attempted" })
    .sort({ updatedAt: -1 })
    .select("_id")
    .lean();

  const fulfillmentType = normalizeFulfillmentType(options.fulfillmentType);
  const pricing = await computeOrderPricing(subtotal, options.couponCode, {
    userId,
    excludeOrderId: attemptedOrder?._id,
    rewardPointsToUse: options.rewardPointsToUse,
    giftCardCode: options.giftCardCode,
    fulfillmentType,
    items: orderItems,
    shippingAddress: mergeCustomerLocation(
      buildPendingDeliveryAddress(user, address),
      options.customerLocation
    ),
  });
  if (pricing.error) {
    return pricing;
  }

  const {
    deliveryCharges,
    heavyHandlingFee,
    gstAmount,
    total,
    couponCode,
    couponDiscount,
    rewardPointsUsed,
    rewardDiscount,
    rewardPointsEarned,
    giftCardCode,
    giftCardDiscount,
    bundleDiscount,
    loyaltyDiscount,
    quantityDiscount,
    dynamicDiscount,
    freeAddon,
    dynamicPricingDetails,
  } = pricing;

  return {
    orderItems,
    deliveryAddress: mergeCustomerLocation(
      buildPendingDeliveryAddress(user, address),
      options.customerLocation
    ),
    subtotal,
    couponCode,
    couponDiscount,
    rewardPointsUsed: rewardPointsUsed || 0,
    rewardDiscount: rewardDiscount || 0,
    rewardPointsEarned: rewardPointsEarned || 0,
    giftCardCode: giftCardCode || "",
    giftCardDiscount: giftCardDiscount || 0,
    deliveryCharges,
    gstAmount,
    total,
    cart,
    checkoutMode,
    preOrderSlot: normalizePreOrderSlot(options.preOrderSlot),
    fulfillmentType,
  };
}

export async function upsertCheckoutAttemptOrder(userId, prepared, paymentMethod = "cod") {
  const normalizedPaymentMethod = paymentMethod === "online" ? "online" : "cod";
  const payload = {
    items: prepared.orderItems,
    deliveryAddress: prepared.deliveryAddress,
    subtotal: prepared.subtotal,
    couponCode: prepared.couponCode || "",
    couponDiscount: prepared.couponDiscount || 0,
    rewardPointsUsed: prepared.rewardPointsUsed || 0,
    rewardDiscount: prepared.rewardDiscount || 0,
    rewardPointsEarned: prepared.rewardPointsEarned || 0,
    giftCardCode: prepared.giftCardCode || "",
    giftCardDiscount: prepared.giftCardDiscount || 0,
    deliveryCharges: prepared.deliveryCharges,
    heavyHandlingFee: prepared.heavyHandlingFee || 0,
    bundleDiscount: prepared.bundleDiscount || 0,
    loyaltyDiscount: prepared.loyaltyDiscount || 0,
    dynamicDiscount: prepared.dynamicDiscount || 0,
    freeAddon: prepared.freeAddon || null,
    dynamicPricingDetails: prepared.dynamicPricingDetails || null,
    gstAmount: prepared.gstAmount ?? 0,
    total: prepared.total,
    paymentMethod: normalizedPaymentMethod,
    paymentStatus: "unpaid",
    status: "attempted",
    preOrderSlot: normalizePreOrderSlot(prepared.preOrderSlot),
    fulfillmentType: normalizeFulfillmentType(prepared.fulfillmentType),
  };

  const existing = await Order.findOne({ user: userId, status: "attempted" })
    .sort({ updatedAt: -1 })
    .select("_id")
    .lean();

  // Atomic update: concurrent syncs from the checkout page would otherwise
  // race on document.save() and fail with a VersionError.
  let order = existing
    ? await Order.findOneAndUpdate(
        { _id: existing._id, status: "attempted" },
        { $set: payload },
        { new: true, runValidators: true }
      )
    : null;

  if (order) {
    return order;
  }

  order = await Order.create({
    user: userId,
    ...payload,
  });

  await User.findByIdAndUpdate(userId, {
    $addToSet: { orders: order._id },
  });

  return order;
}

async function clearCartAfterCheckout(cart, checkoutMode, orderItems, userId) {
  if (checkoutMode === "cart") {
    if (cart) {
      cart.items = [];
      await cart.save();
      return;
    }

    if (userId) {
      await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });
    }
    return;
  }

  if (!cart) return;

  cart.items = cart.items.filter(
    (item) => !orderItems.some((ordered) => matchesOrderedItem(item, ordered))
  );

  await cart.save();
}

export async function findAttemptedOrderForCheckout(userId, attemptedOrderId) {
  if (attemptedOrderId) {
    const explicit = await Order.findOne({
      _id: attemptedOrderId,
      user: userId,
    });
    if (explicit) {
      return explicit;
    }
  }

  return Order.findOne({ user: userId, status: "attempted" }).sort({ updatedAt: -1 });
}

async function resolveGiftHamperSnapshot(total) {
  const storeSettings = await getStoreSettings();
  return resolveGiftHamperForOrder(total, storeSettings);
}

export async function completeAttemptedOrder({
  attemptedOrderId,
  userId,
  orderItems,
  deliveryAddress,
  subtotal,
  couponCode = "",
  couponDiscount = 0,
  rewardPointsUsed = 0,
  rewardDiscount = 0,
  rewardPointsEarned = 0,
  giftCardCode = "",
  giftCardDiscount = 0,
  deliveryCharges,
  heavyHandlingFee = 0,
  bundleDiscount = 0,
  loyaltyDiscount = 0,
  dynamicDiscount = 0,
  freeAddon = null,
  dynamicPricingDetails = null,
  gstAmount = 0,
  total,
  cart,
  checkoutMode = "cart",
  paymentMethod,
  paymentStatus,
  status = "confirm",
  razorpayOrderId,
  razorpayPaymentId,
  codAdvanceAmount = 0,
  codAdvanceRazorpayPaymentId = "",
  razorpayPaidAmount = 0,
  codAdvancePaidAt = null,
  paidAt,
  message = "",
  preOrderSlot,
  fulfillmentType,
}) {
  const order = await findAttemptedOrderForCheckout(userId, attemptedOrderId);

  if (!order) {
    return null;
  }

  if (order.status !== "attempted") {
    await clearCartAfterCheckout(cart, checkoutMode, orderItems, userId);
    return order;
  }

  const orderMessage =
    typeof message === "string" ? message.trim().slice(0, 500) : "";

  order.items = orderItems;
  order.deliveryAddress = deliveryAddress;
  order.subtotal = subtotal;
  order.couponCode = couponCode || "";
  order.couponDiscount = couponDiscount > 0 ? couponDiscount : 0;
  order.rewardPointsUsed = rewardPointsUsed > 0 ? rewardPointsUsed : 0;
  order.rewardDiscount = rewardDiscount > 0 ? rewardDiscount : 0;
  order.rewardPointsEarned = rewardPointsEarned > 0 ? rewardPointsEarned : 0;
  order.giftCardCode = giftCardCode || "";
  order.giftCardDiscount = giftCardDiscount > 0 ? giftCardDiscount : 0;
  order.deliveryCharges = deliveryCharges;
  order.heavyHandlingFee = heavyHandlingFee > 0 ? heavyHandlingFee : 0;
  order.bundleDiscount = bundleDiscount > 0 ? bundleDiscount : 0;
  order.loyaltyDiscount = loyaltyDiscount > 0 ? loyaltyDiscount : 0;
  order.dynamicDiscount = dynamicDiscount > 0 ? dynamicDiscount : 0;
  order.freeAddon = freeAddon || null;
  order.dynamicPricingDetails = dynamicPricingDetails || null;
  order.gstAmount = gstAmount > 0 ? gstAmount : 0;
  order.total = total;
  order.paymentMethod = paymentMethod;
  order.paymentStatus = paymentStatus;
  order.status = status;
  order.message = orderMessage;
  order.razorpayOrderId = razorpayOrderId || "";
  order.razorpayPaymentId = razorpayPaymentId || "";
  order.codAdvanceAmount = codAdvanceAmount > 0 ? codAdvanceAmount : 0;
  order.razorpayPaidAmount = razorpayPaidAmount > 0 ? razorpayPaidAmount : 0;
  order.codAdvanceRazorpayPaymentId = codAdvanceRazorpayPaymentId || "";
  order.codAdvancePaidAt = codAdvancePaidAt || null;
  order.paidAt = paidAt || null;
  // Payment callbacks may omit the slot — keep the one recorded on the checkout attempt.
  order.preOrderSlot =
    preOrderSlot !== undefined
      ? normalizePreOrderSlot(preOrderSlot)
      : normalizePreOrderSlot(order.preOrderSlot);
  order.preOrderDate =
    order.preOrderSlot && status !== "attempted" ? computePreOrderDate() : "";
  order.fulfillmentType = normalizeFulfillmentType(
    fulfillmentType !== undefined ? fulfillmentType : order.fulfillmentType
  );

  if (status !== "attempted") {
    order.createdAt = new Date();
    order.giftHamper = await resolveGiftHamperSnapshot(total);
    await processOrderRewardPoints(order, { rewardPointsUsed, userId });
    if (giftCardCode && giftCardDiscount > 0) {
      await consumeGiftCard(giftCardCode, giftCardDiscount, { orderId: order._id });
    }
  }

  await order.save();
  await clearCartAfterCheckout(cart, checkoutMode, orderItems, userId);

  return order;
}

export async function finalizeOrder({
  userId,
  orderItems,
  deliveryAddress,
  subtotal,
  couponCode = "",
  couponDiscount = 0,
  rewardPointsUsed = 0,
  rewardDiscount = 0,
  rewardPointsEarned = 0,
  giftCardCode = "",
  giftCardDiscount = 0,
  deliveryCharges,
  heavyHandlingFee = 0,
  bundleDiscount = 0,
  loyaltyDiscount = 0,
  dynamicDiscount = 0,
  freeAddon = null,
  dynamicPricingDetails = null,
  gstAmount = 0,
  total,
  cart,
  checkoutMode = "cart",
  paymentMethod,
  paymentStatus,
  status = "confirm",
  razorpayOrderId,
  razorpayPaymentId,
  codAdvanceAmount = 0,
  codAdvanceRazorpayPaymentId = "",
  razorpayPaidAmount = 0,
  codAdvancePaidAt = null,
  paidAt,
  message = "",
  attemptedOrderId,
  preOrderSlot,
  fulfillmentType,
}) {
  const completed = await completeAttemptedOrder({
    attemptedOrderId,
    userId,
    orderItems,
    deliveryAddress,
    subtotal,
    couponCode,
    couponDiscount,
    rewardPointsUsed,
    rewardDiscount,
    rewardPointsEarned,
    giftCardCode,
    giftCardDiscount,
    deliveryCharges,
    heavyHandlingFee,
    bundleDiscount,
    loyaltyDiscount,
    dynamicDiscount,
    freeAddon,
    dynamicPricingDetails,
    gstAmount,
    total,
    cart,
    checkoutMode,
    paymentMethod,
    paymentStatus,
    status,
    razorpayOrderId,
    razorpayPaymentId,
    codAdvanceAmount,
    codAdvanceRazorpayPaymentId,
    razorpayPaidAmount,
    codAdvancePaidAt,
    paidAt,
    message,
    preOrderSlot,
    fulfillmentType,
  });

  if (completed) {
    void dispatchDeliveryOrder(completed).catch(err => console.error(err));
    return completed;
  }

  const orderMessage =
    typeof message === "string" ? message.trim().slice(0, 500) : "";

  const giftHamper = await resolveGiftHamperSnapshot(total);
  const normalizedSlot = normalizePreOrderSlot(preOrderSlot);

  const order = await Order.create({
    user: userId,
    items: orderItems,
    deliveryAddress,
    paymentMethod,
    subtotal,
    couponCode: couponCode || "",
    couponDiscount: couponDiscount > 0 ? couponDiscount : 0,
    rewardPointsUsed: rewardPointsUsed > 0 ? rewardPointsUsed : 0,
    rewardDiscount: rewardDiscount > 0 ? rewardDiscount : 0,
    rewardPointsEarned: rewardPointsEarned > 0 ? rewardPointsEarned : 0,
    giftCardCode: giftCardCode || "",
    giftCardDiscount: giftCardDiscount > 0 ? giftCardDiscount : 0,
    deliveryCharges,
    heavyHandlingFee: heavyHandlingFee > 0 ? heavyHandlingFee : 0,
    bundleDiscount: bundleDiscount > 0 ? bundleDiscount : 0,
    loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : 0,
    dynamicDiscount: dynamicDiscount > 0 ? dynamicDiscount : 0,
    freeAddon: freeAddon || null,
    dynamicPricingDetails: dynamicPricingDetails || null,
    gstAmount: gstAmount > 0 ? gstAmount : 0,
    total,
    status,
    paymentStatus,
    message: orderMessage,
    fulfillmentType: normalizeFulfillmentType(fulfillmentType),
    ...(giftHamper ? { giftHamper } : {}),
    ...(razorpayOrderId && { razorpayOrderId }),
    ...(razorpayPaymentId && { razorpayPaymentId }),
    ...(codAdvanceAmount > 0 && { codAdvanceAmount }),
    ...(razorpayPaidAmount > 0 && { razorpayPaidAmount }),
    ...(codAdvanceRazorpayPaymentId && { codAdvanceRazorpayPaymentId }),
    ...(codAdvancePaidAt && { codAdvancePaidAt }),
    ...(paidAt && { paidAt }),
    ...(normalizedSlot && {
      preOrderSlot: normalizedSlot,
      preOrderDate: status !== "attempted" ? computePreOrderDate() : "",
    }),
  });

  if (status !== "attempted") {
    await processOrderRewardPoints(order, { rewardPointsUsed, userId });
    if (giftCardCode && giftCardDiscount > 0) {
      await consumeGiftCard(giftCardCode, giftCardDiscount, { orderId: order._id });
    }
    await order.save();
  }

  await User.findByIdAndUpdate(userId, {
    $addToSet: { orders: order._id },
  });

  await clearCartAfterCheckout(cart, checkoutMode, orderItems, userId);

  void dispatchDeliveryOrder(order).catch(err => console.error(err));

  return order;
}
