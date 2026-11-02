import mongoose from "mongoose";
import { VendorShippingMethod, Vendor, VendorZone } from "./models.js";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import { resolveDarkStoreForOrder } from "../../delivery-service/src/services/darkStoreResolver.js";
import Product from "../../legacy/models/Product.js";

const RULE_KEYS = ["quantityRules", "userRules", "pincodeRules", "categoryRules", "weightRules", "stateRules", "packagingRules"];

function vendorIdOf(req) {
  return String(req.user?.vendorId || req.user?.id || "");
}

const DEFAULT_SHIPPING_CONFIG = {
  isActive: true,
  quantityRules: {
    enabled: true,
    baseCost: 30,
    freeAboveQuantity: 15,
    perExtraItemFee: 5,
    slabs: [
      { minQty: 1, maxQty: 5, cost: 30 },
      { minQty: 6, maxQty: 10, cost: 50 },
      { minQty: 11, maxQty: 20, cost: 80 },
    ],
  },
  userRules: {
    enabled: true,
    defaultCost: 40,
    userTypes: [
      { userType: "retail", label: "Retail Customer", cost: 40, freeAboveOrderAmount: 499 },
      { userType: "b2b", label: "B2B / Wholesale Buyer", cost: 100, freeAboveOrderAmount: 2999 },
      { userType: "vip", label: "VIP / Prime Member", cost: 0, freeAboveOrderAmount: 0 },
      { userType: "first_order", label: "First-Time Buyer", cost: 0, freeAboveOrderAmount: 199 },
    ],
  },
  pincodeRules: {
    enabled: true,
    defaultCost: 50,
    pincodes: [
      { code: "411057", areaName: "Hinjawadi (Local Zone 1)", cost: 25, isServiceable: true },
      { code: "411045", areaName: "Baner (Local Zone 2)", cost: 35, isServiceable: true },
      { code: "411001", areaName: "Pune City Central", cost: 60, isServiceable: true },
    ],
  },
  categoryRules: {
    enabled: true,
    defaultCost: 30,
    categories: [
      { categoryName: "Fresh Vegetables", extraCost: 10, isFreeShipping: false },
      { categoryName: "Fresh Fruits", extraCost: 15, isFreeShipping: false },
      { categoryName: "Dairy & Cold Chain", extraCost: 25, isFreeShipping: false },
      { categoryName: "Heavy Grains & Pulses", extraCost: 40, isFreeShipping: false },
    ],
  },
  weightRules: {
    enabled: true,
    baseWeightKg: 1,
    baseCost: 30,
    costPerExtraKg: 15,
    slabs: [
      { minWeightKg: 0, maxWeightKg: 2, cost: 30 },
      { minWeightKg: 2, maxWeightKg: 5, cost: 60 },
      { minWeightKg: 5, maxWeightKg: 10, cost: 110 },
      { minWeightKg: 10, maxWeightKg: 25, cost: 200 },
    ],
  },
  stateRules: {
    enabled: true,
    defaultCost: 90,
    states: [
      { stateName: "Maharashtra", cost: 40, isServiceable: true },
      { stateName: "Gujarat", cost: 80, isServiceable: true },
      { stateName: "Karnataka", cost: 90, isServiceable: true },
      { stateName: "Madhya Pradesh", cost: 110, isServiceable: true },
      { stateName: "Goa", cost: 70, isServiceable: true },
    ],
  },
  packagingRules: {
    enabled: true,
    baseCost: 15,
    freeAboveOrderAmount: 499,
    perExtraItemFee: 2,
    slabs: [
      { minQty: 1, maxQty: 5, cost: 15 },
      { minQty: 6, maxQty: 10, cost: 25 },
      { minQty: 11, maxQty: 25, cost: 40 },
    ],
  },
};

function pickRules(source = {}, fallback = DEFAULT_SHIPPING_CONFIG) {
  const rules = {};
  for (const key of RULE_KEYS) {
    const value = source?.[key];
    rules[key] = value && typeof value === "object" ? value : fallback[key];
  }
  return rules;
}

/** Approved zones + dark stores that belong to the vendor (the only valid override targets). */
async function loadVendorScopes(vendorId) {
  const [zones, stores] = await Promise.all([
    VendorZone.find({ vendorId, status: "Approved" }).select("id name state cities").sort({ name: 1 }).lean(),
    DeliveryManager.find({ vendorId })
      .select("storeName name city area zoneId zoneName isActive")
      .sort({ storeName: 1 })
      .lean(),
  ]);
  return {
    zones: zones.map((z) => ({ id: z.id, name: z.name, state: z.state || "", cities: z.cities || [] })),
    stores: stores.map((s) => ({
      id: String(s._id),
      name: s.storeName || s.name || "Dark store",
      city: s.city || "",
      area: s.area || "",
      zoneId: s.zoneId || "",
      zoneName: s.zoneName || "",
      isActive: s.isActive !== false,
    })),
  };
}

function sanitizeOverrides(raw, scopes) {
  if (!Array.isArray(raw)) return [];
  const zoneById = new Map(scopes.zones.map((z) => [z.id, z]));
  const storeById = new Map(scopes.stores.map((s) => [s.id, s]));
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const scope = entry?.scope === "store" ? "store" : entry?.scope === "zone" ? "zone" : null;
    const targetId = String(entry?.targetId || "");
    const target = scope === "zone" ? zoneById.get(targetId) : scope === "store" ? storeById.get(targetId) : null;
    if (!target) continue;
    const key = `${scope}:${targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      scope,
      targetId,
      targetName: target.name,
      isActive: entry.isActive !== false,
      ...pickRules(entry),
    });
  }
  return out;
}

async function loadVendorConfig(vendorId) {
  const config = await VendorShippingMethod.findOne({ vendorId }).lean();
  return config
    ? { ...config, overrides: Array.isArray(config.overrides) ? config.overrides : [] }
    : { ...DEFAULT_SHIPPING_CONFIG, vendorId, overrides: [], isDefault: true };
}

async function saveVendorConfig(vendorId, body = {}) {
  const scopes = await loadVendorScopes(vendorId);
  const updated = await VendorShippingMethod.findOneAndUpdate(
    { vendorId },
    {
      $set: {
        vendorId,
        isActive: body.isActive !== false,
        ...pickRules(body),
        overrides: sanitizeOverrides(body.overrides, scopes),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return { config: updated, scopes };
}

/** Rule set for a dark store: store override → zone override → vendor-wide rules. */
function rulesForTarget(config, { storeId = "", zoneId = "" } = {}) {
  const overrides = Array.isArray(config?.overrides) ? config.overrides : [];
  const active = (scope, id) =>
    id && overrides.find((o) => o.scope === scope && String(o.targetId) === String(id) && o.isActive !== false);
  const storeRules = active("store", storeId);
  if (storeRules) return { rules: storeRules, scope: "store", scopeName: storeRules.targetName || "" };
  const zoneRules = active("zone", zoneId);
  if (zoneRules) return { rules: zoneRules, scope: "zone", scopeName: zoneRules.targetName || "" };
  return { rules: config, scope: "vendor", scopeName: "" };
}

/** Pure fee calculation shared by the simulator and checkout. */
export function evaluateShippingRules(config, params = {}) {
  const {
    quantity = 1,
    orderAmount = 0,
    userType = "retail",
    pincode = "",
    categories = [],
    weightKg = 1,
    state = "",
  } = params;

  const breakdown = {};
  let serviceable = true;

  if (config.quantityRules?.enabled) {
    const q = Math.max(1, Number(quantity) || 1);
    const freeAt = Number(config.quantityRules.freeAboveQuantity) || 0;
    if (freeAt > 0 && q >= freeAt) {
      breakdown.quantity = { cost: 0, reason: `Free shipping (Quantity >= ${freeAt})` };
    } else {
      const slabs = config.quantityRules.slabs || [];
      const match = slabs.find((s) => q >= s.minQty && q <= s.maxQty);
      let qCost = match ? Number(match.cost) : Number(config.quantityRules.baseCost || 0);
      const maxSlab = slabs.length > 0 ? slabs[slabs.length - 1] : null;
      if (maxSlab && q > maxSlab.maxQty) {
        const extra = (q - maxSlab.maxQty) * (Number(config.quantityRules.perExtraItemFee) || 0);
        qCost = Number(maxSlab.cost) + extra;
      }
      breakdown.quantity = { cost: qCost, reason: `Quantity slab for ${q} items` };
    }
  }

  if (config.userRules?.enabled) {
    const uTypes = config.userRules.userTypes || [];
    const match = uTypes.find((u) => u.userType === userType);
    const userCost = match ? Number(match.cost) : Number(config.userRules.defaultCost || 40);
    const freeAt = match ? Number(match.freeAboveOrderAmount || 0) : 0;
    if (freeAt > 0 && Number(orderAmount) >= freeAt) {
      breakdown.user = { cost: 0, reason: `Free for ${match?.label || userType} above ₹${freeAt}` };
    } else {
      breakdown.user = { cost: userCost, reason: `Rate for ${match?.label || userType}` };
    }
  }

  if (config.pincodeRules?.enabled) {
    const pins = config.pincodeRules.pincodes || [];
    const match = pins.find((p) => String(p.code).trim() === String(pincode).trim());
    if (match) {
      if (match.isServiceable === false) serviceable = false;
      breakdown.pincode = {
        cost: Number(match.cost),
        isServiceable: match.isServiceable !== false,
        reason: `${match.areaName || pincode} delivery zone`,
      };
    } else {
      breakdown.pincode = {
        cost: Number(config.pincodeRules.defaultCost || 50),
        isServiceable: true,
        reason: `Standard delivery for pincode ${pincode || "general"}`,
      };
    }
  }

  if (config.categoryRules?.enabled && Array.isArray(categories) && categories.length > 0) {
    const catRules = config.categoryRules.categories || [];
    let extra = 0;
    const matchedCats = [];
    for (const c of categories) {
      const found = catRules.find((r) => r.categoryName?.toLowerCase() === String(c).toLowerCase());
      if (found && !found.isFreeShipping) {
        extra += Number(found.extraCost || 0);
        matchedCats.push(`${found.categoryName} (+₹${found.extraCost})`);
      }
    }
    breakdown.category = { cost: extra, reason: matchedCats.length ? matchedCats.join(", ") : "Standard category rate" };
  }

  if (config.weightRules?.enabled) {
    const w = Math.max(0, Number(weightKg) || 1);
    const slabs = config.weightRules.slabs || [];
    const match = slabs.find((s) => w >= s.minWeightKg && w <= s.maxWeightKg);
    let wCost = match ? Number(match.cost) : Number(config.weightRules.baseCost || 30);
    const maxSlab = slabs.length > 0 ? slabs[slabs.length - 1] : null;
    if (maxSlab && w > maxSlab.maxWeightKg) {
      const extraKg = Math.ceil(w - maxSlab.maxWeightKg);
      wCost = Number(maxSlab.cost) + extraKg * (Number(config.weightRules.costPerExtraKg) || 15);
    }
    breakdown.weight = { cost: wCost, reason: `Weight tier for ${w.toFixed(1)} kg` };
  }

  if (config.stateRules?.enabled) {
    const states = config.stateRules.states || [];
    const match = states.find((s) => s.stateName?.toLowerCase() === String(state).toLowerCase());
    if (match) {
      if (match.isServiceable === false) serviceable = false;
      breakdown.state = { cost: Number(match.cost), reason: `State delivery rate for ${match.stateName}` };
    } else {
      breakdown.state = { cost: Number(config.stateRules.defaultCost || 90), reason: `Standard interstate rate for ${state}` };
    }
  }

  if (config.packagingRules?.enabled) {
    const q = Math.max(1, Number(quantity) || 1);
    const freeAt = Number(config.packagingRules.freeAboveOrderAmount) || 0;
    if (freeAt > 0 && Number(orderAmount) >= freeAt) {
      breakdown.packaging = { cost: 0, reason: `Free packaging (Order amount >= ₹${freeAt})` };
    } else {
      const slabs = config.packagingRules.slabs || [];
      const match = slabs.find((s) => q >= s.minQty && q <= s.maxQty);
      let pCost = match ? Number(match.cost) : Number(config.packagingRules.baseCost ?? 15);
      const maxSlab = slabs.length > 0 ? slabs[slabs.length - 1] : null;
      if (maxSlab && q > maxSlab.maxQty) {
        const extra = (q - maxSlab.maxQty) * (Number(config.packagingRules.perExtraItemFee) || 0);
        pCost = Number(maxSlab.cost) + extra;
      }
      breakdown.packaging = { cost: pCost, reason: `Packaging fee for ${q} items` };
    }
  }

  // Highest base rate (weight / state / pincode / quantity), then the user tier, plus category surcharges.
  const highestBase = Math.max(
    breakdown.weight?.cost ?? 0,
    breakdown.state?.cost ?? 0,
    breakdown.pincode?.cost ?? 0,
    breakdown.quantity?.cost ?? 0
  );
  const categorySurcharge = breakdown.category?.cost ?? 0;
  const userTierCost = breakdown.user?.cost != null ? breakdown.user.cost : highestBase;

  let total = Math.max(highestBase, userTierCost) + categorySurcharge;
  if (breakdown.user?.cost === 0 || breakdown.quantity?.cost === 0) total = 0;

  const packagingCost = breakdown.packaging ? Number(breakdown.packaging.cost ?? 0) : 0;
  return { shippingCost: Math.round(total), packagingCost: Math.round(packagingCost), totalCharges: Math.round(total + packagingCost), breakdown, serviceable };
}

// ── Vendor ──────────────────────────────────────────────────────────────────

/** GET /api/vendor/shipping-methods — vendor-wide rules, zone/store overrides and the vendor's zones & dark stores. */
export async function getVendorShippingMethods(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const [config, scopes] = await Promise.all([loadVendorConfig(vendorId), loadVendorScopes(vendorId)]);
    res.json({ success: true, data: config, scopes });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load shipping methods" });
  }
}

/** PUT /api/vendor/shipping-methods */
export async function saveVendorShippingMethods(req, res) {
  try {
    const { config, scopes } = await saveVendorConfig(vendorIdOf(req), req.body || {});
    res.json({ success: true, message: "Shipping methods updated successfully", data: config, scopes });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to save shipping methods" });
  }
}

// ── Admin ───────────────────────────────────────────────────────────────────

async function listVendorsForAdmin() {
  const vendors = await Vendor.find().select("id vendorName ownerName city state").sort({ vendorName: 1 }).lean();
  return vendors.map((v) => ({
    id: v.id,
    name: v.vendorName || v.ownerName || v.id,
    location: [v.city, v.state].filter(Boolean).join(", "),
  }));
}

/** GET /api/admin-ops/shipping-methods?vendorId= — any vendor's rules (defaults to the first vendor). */
export async function getAdminShippingMethods(req, res) {
  try {
    const vendors = await listVendorsForAdmin();
    const requested = String(req.query.vendorId || "");
    const vendorId = vendors.some((v) => v.id === requested) ? requested : vendors[0]?.id || "";
    if (!vendorId) return res.json({ success: true, data: null, scopes: { zones: [], stores: [] }, vendors, vendorId: "" });

    const [config, scopes] = await Promise.all([loadVendorConfig(vendorId), loadVendorScopes(vendorId)]);
    res.json({ success: true, data: config, scopes, vendors, vendorId });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load shipping methods" });
  }
}

/** PUT /api/admin-ops/shipping-methods?vendorId= */
export async function saveAdminShippingMethods(req, res) {
  try {
    const vendorId = String(req.query.vendorId || req.body?.vendorId || "");
    if (!vendorId || !(await Vendor.exists({ id: vendorId }))) {
      return res.status(400).json({ message: "Select a vendor to update shipping rules" });
    }
    const { config, scopes } = await saveVendorConfig(vendorId, req.body || {});
    res.json({ success: true, message: "Vendor shipping rules updated by admin", data: config, scopes });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to save shipping methods" });
  }
}

// ── Simulator ───────────────────────────────────────────────────────────────

/**
 * POST /api/vendor/shipping-methods/calculate
 * body.rules → evaluate unsaved rules as-is; otherwise the saved rules for vendorId (+ zoneId/storeId).
 */
export async function calculateShippingRate(req, res) {
  try {
    const body = req.body || {};
    let rules = body.rules && typeof body.rules === "object" ? body.rules : null;
    if (!rules) {
      const vendorId = String(req.user?.role === "VENDOR" ? vendorIdOf(req) : body.vendorId || "");
      const config = vendorId ? await VendorShippingMethod.findOne({ vendorId }).lean() : null;
      rules = config
        ? rulesForTarget(config, { storeId: body.storeId, zoneId: body.zoneId }).rules
        : DEFAULT_SHIPPING_CONFIG;
    }
    const result = evaluateShippingRules(rules, {
      quantity: body.quantity,
      orderAmount: body.orderAmount,
      userType: body.userType,
      pincode: body.pincode,
      categories: body.categories,
      weightKg: body.weightKg,
      state: body.state || "Maharashtra",
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to calculate shipping rate" });
  }
}

// ── Checkout ────────────────────────────────────────────────────────────────

function parseUnitKg(unit) {
  const match = String(unit || "").toLowerCase().match(/([\d.]+)\s*(kg|kgs|g|gm|gms|grams?|l|ltr|litres?|ml)\b/);
  if (!match) return 0;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return ["g", "gm", "gms", "gram", "grams", "ml"].includes(match[2]) ? n / 1000 : n;
}

/**
 * Delivery fee from the vendor that owns the dark store serving this address.
 * Returns null when no vendor rules apply (no store, store without a vendor, vendor never saved rules,
 * or rules switched off) so checkout falls back to the global store settings.
 */
export async function quoteVendorShipping({ address, items = [], subtotal = 0, userType = "retail" }) {
  const { manager } = await resolveDarkStoreForOrder(address || {}, { allowPincodeFallback: true });
  if (!manager?.vendorId) return null;

  const config = await VendorShippingMethod.findOne({ vendorId: manager.vendorId }).lean();
  if (!config || config.isActive === false) return null;

  const { rules, scope, scopeName } = rulesForTarget(config, {
    storeId: String(manager._id),
    zoneId: manager.zoneId || "",
  });

  const productIds = items.map((i) => i.product).filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select("weight unit categories").lean()
    : [];
  const byId = new Map(products.map((p) => [String(p._id), p]));

  let quantity = 0;
  let weightKg = 0;
  const categories = new Set();
  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    quantity += qty;
    const product = byId.get(String(item.product));
    if (!product) continue;
    const unitKg = Number(product.weight) > 0 ? Number(product.weight) : parseUnitKg(product.unit);
    weightKg += unitKg * qty;
    for (const c of product.categories || []) categories.add(c);
  }

  const result = evaluateShippingRules(rules, {
    quantity: quantity || 1,
    orderAmount: subtotal,
    userType,
    pincode: address?.pincode || "",
    categories: [...categories],
    weightKg: weightKg || 1,
    state: address?.state || "",
  });

  return {
    ...result,
    vendorId: manager.vendorId,
    storeId: String(manager._id),
    storeName: manager.storeName || manager.name || "",
    scope,
    scopeName,
  };
}
