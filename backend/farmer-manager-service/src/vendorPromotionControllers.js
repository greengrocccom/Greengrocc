import mongoose from "mongoose";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import { DEFAULT_COUPONS, isUnlimitedRedemptionLimit } from "../../legacy/controllers/couponController.js";
import { generateGiftCode } from "../../admin-ops-service/src/giftCardService.js";
import { createRefund, listRefunds, updateRefund } from "../../admin-ops-service/src/financeControllers.js";
import { VendorCoupon, VendorGiftCard, VendorPricingRule, VendorRewardSetting } from "./vendorPromotionModels.js";

function vendorIdOf(req) {
  return String(req.user?.vendorId || req.user?.id || "");
}

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function searchRegex(q) {
  const value = String(q || "").trim();
  if (!value) return null;
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

// ------------------------------------
// COUPONS
// ------------------------------------

function parseRedemptionLimit(value, fieldName) {
  if (value === undefined) return undefined;
  if (isUnlimitedRedemptionLimit(value)) return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) return { error: `${fieldName} must be a positive whole number or unlimited` };
  return num;
}

function parseCouponBody(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.code !== undefined) {
    out.code = String(body.code || "").trim().toUpperCase();
    if (!out.code) return { error: "Coupon code is required" };
  }
  if (body.title !== undefined) out.title = String(body.title || "").trim();
  if (!partial || body.discountType !== undefined) {
    if (!["percentage", "fixed"].includes(body.discountType)) return { error: "Discount type must be percentage or fixed" };
    out.discountType = body.discountType;
  }
  if (!partial || body.discountValue !== undefined) {
    const value = Number(body.discountValue);
    if (!Number.isFinite(value) || value < 0) return { error: "Discount value must be zero or greater" };
    if ((out.discountType || body.discountType) === "percentage" && value > 100) {
      return { error: "Percentage discount cannot exceed 100" };
    }
    out.discountValue = value;
  }
  if (!partial || body.startDate !== undefined || body.endDate !== undefined) {
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (Number.isNaN(start.getTime())) return { error: "Valid start date is required" };
    if (Number.isNaN(end.getTime())) return { error: "Valid end date is required" };
    if (end <= start) return { error: "End date must be after start date" };
    out.startDate = start;
    out.endDate = end;
  }
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  if (body.minOrderAmount !== undefined) out.minOrderAmount = Number(body.minOrderAmount) || 0;
  for (const [key, label] of [
    ["maxRedemptionsPerUser", "Max redemptions per user"],
    ["maxTotalRedemptions", "Max total redemptions"],
  ]) {
    const parsed = parseRedemptionLimit(body[key], label);
    if (parsed?.error) return parsed;
    if (parsed !== undefined) out[key] = parsed;
    else if (!partial) out[key] = null;
  }
  return out;
}

export async function listVendorCoupons(req, res) {
  try {
    const coupons = await VendorCoupon.find({ vendorId: vendorIdOf(req) }).sort({ createdAt: -1 }).lean();
    const data = coupons.map((coupon) => ({ ...coupon, totalRedemptions: 0 }));
    res.json({ success: true, data, pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 } });
  } catch (err) {
    fail(res, 500, err.message || "Failed to load coupons");
  }
}

export async function createVendorCoupon(req, res) {
  try {
    const payload = parseCouponBody(req.body);
    if (payload.error) return fail(res, 400, payload.error);
    const coupon = await VendorCoupon.create({ ...payload, vendorId: vendorIdOf(req) });
    res.status(201).json({ success: true, data: coupon });
  } catch (err) {
    if (err.code === 11000) return fail(res, 400, "Coupon code already exists");
    fail(res, 500, err.message || "Failed to create coupon");
  }
}

export async function updateVendorCoupon(req, res) {
  try {
    if (!isObjectId(req.params.id)) return fail(res, 404, "Coupon not found");
    const payload = parseCouponBody(req.body, { partial: true });
    if (payload.error) return fail(res, 400, payload.error);
    const coupon = await VendorCoupon.findOneAndUpdate(
      { _id: req.params.id, vendorId: vendorIdOf(req) },
      { $set: payload },
      { returnDocument: 'after', runValidators: true }
    );
    if (!coupon) return fail(res, 404, "Coupon not found");
    ok(res, coupon);
  } catch (err) {
    if (err.code === 11000) return fail(res, 400, "Coupon code already exists");
    fail(res, 500, err.message || "Failed to update coupon");
  }
}

export async function deleteVendorCoupon(req, res) {
  try {
    if (!isObjectId(req.params.id)) return fail(res, 404, "Coupon not found");
    const coupon = await VendorCoupon.findOneAndDelete({ _id: req.params.id, vendorId: vendorIdOf(req) });
    if (!coupon) return fail(res, 404, "Coupon not found");
    res.json({ success: true, message: "Coupon deleted" });
  } catch (err) {
    fail(res, 500, err.message || "Failed to delete coupon");
  }
}

export async function seedVendorCoupons(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const existing = new Set((await VendorCoupon.find({ vendorId }).select("code").lean()).map((c) => c.code));
    const toInsert = DEFAULT_COUPONS.filter((c) => !existing.has(String(c.code).toUpperCase())).map((c) => ({
      ...c,
      vendorId,
    }));
    if (toInsert.length) await VendorCoupon.insertMany(toInsert);
    const all = await VendorCoupon.find({ vendorId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, message: `Seeded ${toInsert.length} new coupons`, data: all });
  } catch (err) {
    fail(res, 500, err.message || "Failed to seed coupons");
  }
}

// ------------------------------------
// GIFT CARDS
// ------------------------------------

export async function listVendorGiftCards(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const filter = { vendorId };
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    const q = searchRegex(req.query.search);
    if (q) filter.$or = [{ code: q }, { issuedToName: q }, { issuedToPhone: q }];
    const [cards, all] = await Promise.all([
      VendorGiftCard.find(filter).sort({ createdAt: -1 }).lean(),
      VendorGiftCard.find({ vendorId }).select("amount balance status").lean(),
    ]);
    ok(res, cards, {
      stats: {
        count: cards.length,
        totalIssued: all.reduce((sum, c) => sum + (c.amount || 0), 0),
        activeBalance: all.filter((c) => c.status === "active").reduce((sum, c) => sum + (c.balance || 0), 0),
        redeemed: all.filter((c) => c.status === "redeemed").length,
      },
    });
  } catch (err) {
    fail(res, 500, err.message || "Failed to load gift cards");
  }
}

export async function createVendorGiftCard(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 1) return fail(res, 400, "Amount must be at least ₹1");
    let code = String(req.body.code || "").trim().toUpperCase() || generateGiftCode();
    while (await VendorGiftCard.exists({ vendorId, code })) code = generateGiftCode();
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    const card = await VendorGiftCard.create({
      vendorId,
      code,
      amount,
      balance: amount,
      status: "active",
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      issuedToName: String(req.body.issuedToName || "").trim(),
      issuedToPhone: String(req.body.issuedToPhone || "").trim(),
      note: String(req.body.note || "").trim(),
    });
    res.status(201).json({ success: true, data: card });
  } catch (err) {
    fail(res, 500, err.message || "Failed to create gift card");
  }
}

export async function updateVendorGiftCard(req, res) {
  try {
    if (!isObjectId(req.params.id)) return fail(res, 404, "Gift card not found");
    const card = await VendorGiftCard.findOne({ _id: req.params.id, vendorId: vendorIdOf(req) });
    if (!card) return fail(res, 404, "Gift card not found");
    ["status", "issuedToName", "issuedToPhone", "note"].forEach((key) => {
      if (req.body[key] !== undefined) card[key] = req.body[key] || "";
    });
    if (req.body.expiresAt !== undefined) card.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    await card.save();
    ok(res, card);
  } catch (err) {
    fail(res, 500, err.message || "Failed to update gift card");
  }
}

export async function deleteVendorGiftCard(req, res) {
  try {
    if (!isObjectId(req.params.id)) return fail(res, 404, "Gift card not found");
    const card = await VendorGiftCard.findOneAndDelete({ _id: req.params.id, vendorId: vendorIdOf(req) });
    if (!card) return fail(res, 404, "Gift card not found");
    ok(res, { id: req.params.id });
  } catch (err) {
    fail(res, 500, err.message || "Failed to delete gift card");
  }
}

// ------------------------------------
// DYNAMIC PRICING
// ------------------------------------

function parsePricingBody(body) {
  const minQuantity = Number(body.minQuantity);
  const discountValue = Number(body.discountValue);
  if (!String(body.name || "").trim()) return { error: "Name is required" };
  if (!Number.isFinite(minQuantity) || minQuantity < 1) return { error: "Min quantity must be at least 1" };
  if (!Number.isFinite(discountValue) || discountValue < 0) return { error: "Discount value is required" };
  if (body.discountType !== "fixed" && discountValue > 100) return { error: "Percentage discount cannot exceed 100" };
  return {
    name: String(body.name).trim(),
    enabled: body.enabled !== false,
    minQuantity,
    discountType: body.discountType === "fixed" ? "fixed" : "percentage",
    discountValue,
    applyTo: ["all", "products", "categories"].includes(body.applyTo) ? body.applyTo : "all",
    productIds: Array.isArray(body.productIds) ? body.productIds.filter(isObjectId) : [],
    categoryNames: (Array.isArray(body.categoryNames) ? body.categoryNames : String(body.categoryNames || "").split(","))
      .map((name) => String(name).trim())
      .filter(Boolean),
    startDate: body.startDate ? new Date(body.startDate) : null,
    endDate: body.endDate ? new Date(body.endDate) : null,
  };
}

export async function listVendorPricingRules(req, res) {
  try {
    const rules = await VendorPricingRule.find({ vendorId: vendorIdOf(req) }).sort({ createdAt: -1 }).lean();
    ok(res, rules, { stats: { count: rules.length, enabled: rules.filter((r) => r.enabled).length } });
  } catch (err) {
    fail(res, 500, err.message || "Failed to load pricing rules");
  }
}

export async function createVendorPricingRule(req, res) {
  try {
    const payload = parsePricingBody(req.body);
    if (payload.error) return fail(res, 400, payload.error);
    const rule = await VendorPricingRule.create({ ...payload, vendorId: vendorIdOf(req) });
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    fail(res, 500, err.message || "Failed to create pricing rule");
  }
}

export async function updateVendorPricingRule(req, res) {
  try {
    if (!isObjectId(req.params.id)) return fail(res, 404, "Pricing rule not found");
    const rule = await VendorPricingRule.findOne({ _id: req.params.id, vendorId: vendorIdOf(req) });
    if (!rule) return fail(res, 404, "Pricing rule not found");
    const payload = parsePricingBody({ ...rule.toObject(), ...req.body });
    if (payload.error) return fail(res, 400, payload.error);
    Object.assign(rule, payload);
    await rule.save();
    ok(res, rule);
  } catch (err) {
    fail(res, 500, err.message || "Failed to update pricing rule");
  }
}

export async function deleteVendorPricingRule(req, res) {
  try {
    if (!isObjectId(req.params.id)) return fail(res, 404, "Pricing rule not found");
    const rule = await VendorPricingRule.findOneAndDelete({ _id: req.params.id, vendorId: vendorIdOf(req) });
    if (!rule) return fail(res, 404, "Pricing rule not found");
    ok(res, { id: req.params.id });
  } catch (err) {
    fail(res, 500, err.message || "Failed to delete pricing rule");
  }
}

// ------------------------------------
// REWARD POINTS
// ------------------------------------

const REWARD_FIELDS = [
  "enabled",
  "minOrderAmountToEarn",
  "pointValueInRupees",
  "minPointsToRedeem",
  "maxRedemptionPercent",
  "maxPointsPerOrder",
  "minOrderAmountToRedeem",
  "welcomeBonusPoints",
];

async function rewardSettingsFor(vendorId) {
  return (
    (await VendorRewardSetting.findOne({ vendorId })) ||
    VendorRewardSetting.create({ vendorId })
  );
}

export async function getVendorRewardSettings(req, res) {
  try {
    ok(res, await rewardSettingsFor(vendorIdOf(req)));
  } catch (err) {
    fail(res, 500, err.message || "Failed to load reward settings");
  }
}

export async function updateVendorRewardSettings(req, res) {
  try {
    const settings = await rewardSettingsFor(vendorIdOf(req));
    REWARD_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) settings[key] = req.body[key];
    });
    if (req.body.earningRate) {
      if (req.body.earningRate.spendAmount !== undefined) settings.earningRate.spendAmount = req.body.earningRate.spendAmount;
      if (req.body.earningRate.pointsEarned !== undefined) settings.earningRate.pointsEarned = req.body.earningRate.pointsEarned;
    }
    if (Array.isArray(req.body.termsAndConditions)) {
      settings.termsAndConditions = req.body.termsAndConditions.map((t) => String(t).trim()).filter(Boolean);
    }
    await settings.save();
    ok(res, settings);
  } catch (err) {
    if (err.name === "ValidationError") return fail(res, 400, Object.values(err.errors)[0]?.message || err.message);
    fail(res, 500, err.message || "Failed to save reward settings");
  }
}

export async function getVendorRewardStats(_req, res) {
  ok(res, { totalPointsIssued: 0, totalPointsRedeemed: 0, activeLiabilityPoints: 0, totalUsersWithPoints: 0 });
}

export async function listVendorRewardTransactions(_req, res) {
  res.json({ success: true, data: [], page: 1, totalPages: 1, total: 0 });
}

// ------------------------------------
// RETURN & WARRANTY (scoped to the vendor's dark stores)
// ------------------------------------

async function withVendorStores(req) {
  const stores = await DeliveryManager.find({ vendorId: vendorIdOf(req) }).select("_id").lean();
  req.refundStoreIds = stores.map((s) => String(s._id));
}

const scoped = (handler) => async (req, res, next) => {
  try {
    await withVendorStores(req);
    return handler(req, res, next);
  } catch (err) {
    return fail(res, 500, err.message || "Request failed");
  }
};

export const listVendorRefunds = scoped(listRefunds);
export const createVendorRefund = scoped(createRefund);
export const updateVendorRefund = scoped(updateRefund);
