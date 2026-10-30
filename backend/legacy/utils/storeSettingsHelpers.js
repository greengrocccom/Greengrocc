import StoreSettings from "../models/StoreSettings.js";
import { mergeEnviaOriginDefaults } from "../../../shared/shipping/enviaOriginAddress.js";
import { normalizeGiftHamperTiers } from "../../../shared/store/giftHamper.js";

export const DEFAULT_STORE_SETTINGS = {
  minimumOrderValue: 0,
  minimumShippingCharge: 0,
  shippingSlabs: [],
  giftHamperTiers: [],
  giftHampersEnabled: false,
  preOrderSlots: [
    { startTime: "09:00 AM", endTime: "12:00 PM", capacity: 50, isActive: true },
    { startTime: "12:00 PM", endTime: "03:00 PM", capacity: 50, isActive: true },
    { startTime: "03:00 PM", endTime: "06:00 PM", capacity: 50, isActive: true },
  ],
  merchantUpiId: "",
  merchantUpiName: "GreenGrocc",
  merchantUpiAccounts: [],
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
  envia: {
    enabled: false,
    useSandbox: true,
    apiToken: "",
    defaultCarrier: "",
    defaultService: "",
    rateCarriers: [],
    origin: mergeEnviaOriginDefaults({}),
    packageDefaults: {
      type: "box",
      content: "Mobile accessories",
      amount: 1,
      weightUnit: "KG",
      lengthUnit: "CM",
      weight: 1,
      length: 20,
      width: 15,
      height: 10,
    },
  },
};

let cachedSettings = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

function nonNegativeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

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


export function normalizeMerchantUpiAccounts(source = {}) {
  const rawAccounts = Array.isArray(source.merchantUpiAccounts)
    ? source.merchantUpiAccounts
    : [];

  const accounts = rawAccounts
    .map((account) => ({
      upiId: String(account?.upiId || "").trim(),
      label: String(account?.label || "").trim(),
      enabled: account?.enabled !== false,
    }))
    .filter((account) => account.upiId);

  let normalizedAccounts = accounts;

  if (accounts.length === 0) {
    const legacyUpiId = String(source.merchantUpiId || "").trim();
    if (!legacyUpiId) {
      return [];
    }

    normalizedAccounts = [
      {
        upiId: legacyUpiId,
        label:
          String(source.merchantUpiName || "").trim() ||
          DEFAULT_STORE_SETTINGS.merchantUpiName,
        enabled: true,
      },
    ];
  }

  let activeAssigned = false;
  return normalizedAccounts.map((account) => {
    if (account.enabled && !activeAssigned) {
      activeAssigned = true;
      return account;
    }
    return { ...account, enabled: false };
  });
}

export function serializeStoreSettings(doc, { admin = false } = {}) {
  const source = doc?.toObject ? doc.toObject() : doc || {};
  const minimumOrderValue = nonNegativeAmount(source.minimumOrderValue);
  const minimumShippingCharge = nonNegativeAmount(source.minimumShippingCharge);
  const shippingSlabs = normalizeShippingSlabs(source.shippingSlabs || []);
  const giftHamperTiers = normalizeGiftHamperTiers(
    source.giftHamperTiers?.length
      ? source.giftHamperTiers
      : DEFAULT_STORE_SETTINGS.giftHamperTiers
  );
  const allAccounts = normalizeMerchantUpiAccounts(source);
  const enabledAccounts = allAccounts.filter((account) => account.enabled);
  const primaryAccount = enabledAccounts[0] || allAccounts[0] || null;
  const defaultPayeeName =
    String(source.merchantUpiName || "").trim() ||
    DEFAULT_STORE_SETTINGS.merchantUpiName;

  const enviaSource = source.envia || {};
  const enviaToken = String(enviaSource.apiToken || "").trim();
  const envia = {
    enabled: Boolean(enviaSource.enabled),
    useSandbox: enviaSource.useSandbox !== false,
    apiToken: admin ? enviaToken : "",
    hasApiToken: Boolean(enviaToken),
    defaultCarrier: String(enviaSource.defaultCarrier || "").trim(),
    defaultService: String(enviaSource.defaultService || "").trim(),
    rateCarriers: Array.isArray(enviaSource.rateCarriers)
      ? enviaSource.rateCarriers.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [],
    origin: mergeEnviaOriginDefaults(enviaSource.origin || {}),
    packageDefaults: {
      type:
        String(enviaSource.packageDefaults?.type || "").trim() ||
        DEFAULT_STORE_SETTINGS.envia.packageDefaults.type,
      content:
        String(enviaSource.packageDefaults?.content || "").trim() ||
        DEFAULT_STORE_SETTINGS.envia.packageDefaults.content,
      amount: Number(enviaSource.packageDefaults?.amount) || 1,
      weightUnit:
        String(enviaSource.packageDefaults?.weightUnit || "").trim().toUpperCase() ||
        DEFAULT_STORE_SETTINGS.envia.packageDefaults.weightUnit,
      lengthUnit:
        String(enviaSource.packageDefaults?.lengthUnit || "").trim().toUpperCase() ||
        DEFAULT_STORE_SETTINGS.envia.packageDefaults.lengthUnit,
      weight:
        Number(enviaSource.packageDefaults?.weight) ||
        DEFAULT_STORE_SETTINGS.envia.packageDefaults.weight,
      length:
        Number(enviaSource.packageDefaults?.length) ||
        DEFAULT_STORE_SETTINGS.envia.packageDefaults.length,
      width:
        Number(enviaSource.packageDefaults?.width) ||
        DEFAULT_STORE_SETTINGS.envia.packageDefaults.width,
      height:
        Number(enviaSource.packageDefaults?.height) ||
        DEFAULT_STORE_SETTINGS.envia.packageDefaults.height,
    },
  };

  return {
    minimumOrderValue,
    minimumShippingCharge,
    shippingSlabs,
    giftHamperTiers,
    giftHampersEnabled: Boolean(source.giftHampersEnabled),
    preOrderSlots: source.preOrderSlots?.length > 0 
      ? source.preOrderSlots 
      : DEFAULT_STORE_SETTINGS.preOrderSlots,
    merchantUpiAccounts: admin ? allAccounts : enabledAccounts,
    merchantUpiId: primaryAccount?.upiId || "",
    merchantUpiName:
      primaryAccount?.label || defaultPayeeName,
    cartNoticeEn:
      source.cartNoticeEn?.length > 0
        ? source.cartNoticeEn
        : DEFAULT_STORE_SETTINGS.cartNoticeEn,
    cartNoticeHi:
      source.cartNoticeHi?.length > 0
        ? source.cartNoticeHi
        : DEFAULT_STORE_SETTINGS.cartNoticeHi,
    envia,
  };
}

export function calculateShippingCharge(subtotal, settings) {
  const amount = Number(subtotal) || 0;
  const minShipping = nonNegativeAmount(settings?.minimumShippingCharge);
  const slabs = normalizeShippingSlabs(settings?.shippingSlabs || []);

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

export function meetsMinimumOrder(subtotal, settings) {
  const amount = Number(subtotal) || 0;
  return amount >= nonNegativeAmount(settings?.minimumOrderValue);
}

export async function getStoreSettings({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && cacheExpiresAt > now) {
    return cachedSettings;
  }

  let doc = await StoreSettings.findOne({ key: "store" });
  if (!doc) {
    doc = await StoreSettings.create({ key: "store" });
  }

  cachedSettings = serializeStoreSettings(doc);
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedSettings;
}

export function clearStoreSettingsCache() {
  cachedSettings = null;
  cacheExpiresAt = 0;
}
