export const DEFAULT_STORE_SETTINGS = {
  minimumOrderValue: 0,
  minimumShippingCharge: 0,
  shippingSlabs: [],
  cartNoticeEn: [
    "Please Verify Your Address Before Placing Your Order.",
    "Parcel opening video is must for return.",
    "Shipping depends on parcel weight minimum Rs {{minShipping}}.",
    "User have to pay shipping charges in advance.",
  ],
  cartNoticeHi: [
    "कृपया अपना पूरा पता ठीक से लिखें ऑर्डर करने से पहले। इसके बाद ऑर्डर करें।",
    "पार्सल वापसी के लिए पार्सल खोलने का वीडियो अनिवार्य है।",
    "शिपिंग पार्सल के वजन पर निर्भर करता है न्यूनतम {{minShipping}}/",
    "उपयोगकर्ता को शिपिंग शुल्क अग्रिम रूप से देना होगा।",
  ],
};

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export function normalizeShippingSlabs(slabs = []) {
  return [...slabs]
    .map((slab) => ({
      orderAmount: Number(slab.orderAmount),
      shippingCharge: Number(slab.shippingCharge),
    }))
    .filter(
      (slab) =>
        Number.isFinite(slab.orderAmount) &&
        Number.isFinite(slab.shippingCharge) &&
        slab.orderAmount >= 0 &&
        slab.shippingCharge >= 0
    )
    .sort((a, b) => a.orderAmount - b.orderAmount);
}

const nonNegativeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

export function mergeStoreSettings(settings) {
  const source = settings || {};
  return {
    minimumOrderValue: nonNegativeAmount(source.minimumOrderValue),
    minimumShippingCharge: nonNegativeAmount(source.minimumShippingCharge),
    shippingSlabs: normalizeShippingSlabs(source.shippingSlabs || []),
    cartNoticeEn:
      source.cartNoticeEn?.length > 0
        ? source.cartNoticeEn
        : DEFAULT_STORE_SETTINGS.cartNoticeEn,
    cartNoticeHi:
      source.cartNoticeHi?.length > 0
        ? source.cartNoticeHi
        : DEFAULT_STORE_SETTINGS.cartNoticeHi,
  };
}

export function calculateShippingCharge(subtotal, settings) {
  const amount = Number(subtotal) || 0;
  const merged = mergeStoreSettings(settings);
  const minShipping = merged.minimumShippingCharge;
  const slabs = merged.shippingSlabs;

  if (!slabs.length) {
    return minShipping;
  }

  let charge = minShipping;
  for (const slab of slabs) {
    if (amount >= slab.orderAmount) {
      charge = slab.shippingCharge;
    }
  }

  return charge;
}

/** Next slab that lowers the delivery fee, e.g. "add ₹X for FREE delivery". */
export function nextCheaperShippingSlab(subtotal, settings) {
  const amount = Number(subtotal) || 0;
  const current = calculateShippingCharge(amount, settings);
  return (
    mergeStoreSettings(settings).shippingSlabs.find(
      (slab) => slab.orderAmount > amount && slab.shippingCharge < current
    ) || null
  );
}

export function meetsMinimumOrder(subtotal, settings) {
  const amount = Number(subtotal) || 0;
  const merged = mergeStoreSettings(settings);
  return amount >= merged.minimumOrderValue;
}

export function getMinimumOrderShortfall(subtotal, settings) {
  const merged = mergeStoreSettings(settings);
  return Math.max(0, merged.minimumOrderValue - (Number(subtotal) || 0));
}

function interpolateNoticeLine(line, settings) {
  const merged = mergeStoreSettings(settings);
  return String(line || "")
    .replaceAll("{{minOrder}}", formatAmount(merged.minimumOrderValue))
    .replaceAll("{{minShipping}}", formatAmount(merged.minimumShippingCharge));
}

export function buildCartNoticeBullets(settings, language = "en") {
  const merged = mergeStoreSettings(settings);
  const lines = language === "hi" ? merged.cartNoticeHi : merged.cartNoticeEn;
  return lines.map((line) => interpolateNoticeLine(line, merged));
}
