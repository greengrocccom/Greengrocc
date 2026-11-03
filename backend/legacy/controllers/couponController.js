import Coupon from "../models/Coupon.js";
import Order from "../models/order/Order.js";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination.js";

const REDEEMED_ORDER_STATUSES = ["confirm", "processing", "shipping", "delivered"];

function normalizeCouponCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
}

export function isUnlimitedRedemptionLimit(limit) {
  if (limit === null || limit === undefined) return true;
  if (typeof limit === "string") {
    const normalized = limit.trim().toLowerCase();
    if (!normalized || normalized === "infinity" || normalized === "∞" || normalized === "unlimited") {
      return true;
    }
  }
  if (limit === -1) return true;
  return false;
}

function parseRedemptionLimit(value, fieldName) {
  if (value === undefined) return undefined;
  if (isUnlimitedRedemptionLimit(value)) return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    return { error: `${fieldName} must be a positive whole number or unlimited` };
  }
  return num;
}

export async function countCouponRedemptions(couponCode, { userId, excludeOrderId } = {}) {
  const query = {
    couponCode: normalizeCouponCode(couponCode),
    couponDiscount: { $gt: 0 },
    status: { $in: REDEEMED_ORDER_STATUSES },
  };

  if (userId) {
    query.user = userId;
  }

  if (excludeOrderId) {
    query._id = { $ne: excludeOrderId };
  }

  return Order.countDocuments(query);
}

async function checkRedemptionLimits(coupon, { userId, excludeOrderId } = {}) {
  if (!isUnlimitedRedemptionLimit(coupon.maxTotalRedemptions)) {
    const totalRedemptions = await countCouponRedemptions(coupon.code);
    if (totalRedemptions >= coupon.maxTotalRedemptions) {
      return { error: "This coupon has reached its maximum redemptions" };
    }
  }

  if (userId && !isUnlimitedRedemptionLimit(coupon.maxRedemptionsPerUser)) {
    const userRedemptions = await countCouponRedemptions(coupon.code, {
      userId,
      excludeOrderId,
    });
    if (userRedemptions >= coupon.maxRedemptionsPerUser) {
      return {
        error: "You have already used this coupon the maximum number of times",
      };
    }
  }

  return null;
}

function validateCouponPayload(body, { partial = false } = {}) {
  const errors = [];
  const discountType = body.discountType;
  const discountValue = Number(body.discountValue);
  const startDate = body.startDate ? new Date(body.startDate) : null;
  const endDate = body.endDate ? new Date(body.endDate) : null;

  if (!partial || body.code !== undefined) {
    if (!normalizeCouponCode(body.code)) {
      errors.push("Coupon code is required");
    }
  }

  if (!partial || body.discountType !== undefined) {
    if (!["percentage", "fixed"].includes(discountType)) {
      errors.push("Discount type must be percentage or fixed");
    }
  }

  if (!partial || body.discountValue !== undefined) {
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      errors.push("Discount value must be zero or greater");
    }
    if (discountType === "percentage" && discountValue > 100) {
      errors.push("Percentage discount cannot exceed 100");
    }
  }

  if (!partial || body.startDate !== undefined || body.endDate !== undefined) {
    if (!startDate || Number.isNaN(startDate.getTime())) {
      errors.push("Valid start date is required");
    }
    if (!endDate || Number.isNaN(endDate.getTime())) {
      errors.push("Valid end date is required");
    }
    if (startDate && endDate && endDate <= startDate) {
      errors.push("End date must be after start date");
    }
  }

  if (!partial || body.maxRedemptionsPerUser !== undefined) {
    const parsed = parseRedemptionLimit(
      body.maxRedemptionsPerUser,
      "Max redemptions per user"
    );
    if (parsed?.error) errors.push(parsed.error);
  }

  if (!partial || body.maxTotalRedemptions !== undefined) {
    const parsed = parseRedemptionLimit(body.maxTotalRedemptions, "Max total redemptions");
    if (parsed?.error) errors.push(parsed.error);
  }

  return errors;
}

export function getCouponStatus(coupon, now = new Date()) {
  if (!coupon?.isActive) return "inactive";
  const start = new Date(coupon.startDate);
  const end = new Date(coupon.endDate);
  if (now < start) return "scheduled";
  if (now > end) return "expired";
  return "active";
}

export function calculateCouponDiscount(coupon, subtotal) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (!coupon || safeSubtotal <= 0) return 0;

  if (safeSubtotal < Number(coupon.minOrderAmount || 0)) return 0;

  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = (safeSubtotal * Number(coupon.discountValue)) / 100;
  } else {
    discount = Number(coupon.discountValue);
  }

  return Math.min(Math.max(0, Math.round(discount * 100) / 100), safeSubtotal);
}

export async function resolveCouponForCheckout(code, subtotal, options = {}) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) {
    return { error: "Coupon code is required" };
  }

  const coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon) {
    return { error: "Invalid coupon code" };
  }

  const status = getCouponStatus(coupon);
  if (status === "inactive") {
    return { error: "This coupon is inactive" };
  }
  if (status === "scheduled") {
    return { error: "This coupon is not active yet" };
  }
  if (status === "expired") {
    return { error: "This coupon has expired" };
  }

  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (safeSubtotal < Number(coupon.minOrderAmount || 0)) {
    return {
      error: `Minimum order amount is ₹${coupon.minOrderAmount}`,
    };
  }

  const redemptionError = await checkRedemptionLimits(coupon, {
    userId: options.userId,
    excludeOrderId: options.excludeOrderId,
  });
  if (redemptionError) {
    return redemptionError;
  }

  const couponDiscount = calculateCouponDiscount(coupon, safeSubtotal);

  return {
    couponCode: coupon.code,
    couponDiscount,
    couponTitle: coupon.title || "",
  };
}

function mapAvailableCoupon(coupon, subtotal = 0, redemptionMeta = {}) {
  const minOrderAmount = Number(coupon.minOrderAmount || 0);
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const amountNeeded = Math.max(0, minOrderAmount - safeSubtotal);
  const meetsMinOrder = safeSubtotal >= minOrderAmount;
  const redemptionBlocked = redemptionMeta.redemptionBlocked || "";
  const unlocked = meetsMinOrder && !redemptionBlocked;

  return {
    code: coupon.code,
    title: coupon.title || "",
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderAmount,
    startDate: coupon.startDate,
    endDate: coupon.endDate,
    appliesToAllProducts: coupon.appliesToAllProducts !== false,
    maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
    maxTotalRedemptions: coupon.maxTotalRedemptions,
    perUserUnlimited: isUnlimitedRedemptionLimit(coupon.maxRedemptionsPerUser),
    totalUnlimited: isUnlimitedRedemptionLimit(coupon.maxTotalRedemptions),
    userRedemptions: redemptionMeta.userRedemptions ?? null,
    totalRedemptions: redemptionMeta.totalRedemptions ?? null,
    unlocked,
    amountNeeded,
    redemptionBlocked,
    discountAmount: unlocked ? calculateCouponDiscount(coupon, safeSubtotal) : 0,
  };
}

export const getAvailableCoupons = async (req, res) => {
  try {
    const now = new Date();
    const subtotal = Math.max(0, Number(req.query.subtotal) || 0);
    const userId = req.user?._id;

    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ minOrderAmount: 1, discountValue: -1, createdAt: -1 })
      .lean();

    const mapped = await Promise.all(
      coupons.map(async (coupon) => {
        let redemptionMeta = {};

        if (userId) {
          const [userRedemptions, totalRedemptions] = await Promise.all([
            countCouponRedemptions(coupon.code, { userId }),
            countCouponRedemptions(coupon.code),
          ]);

          let redemptionBlocked = "";
          if (
            !isUnlimitedRedemptionLimit(coupon.maxTotalRedemptions) &&
            totalRedemptions >= coupon.maxTotalRedemptions
          ) {
            redemptionBlocked = "This coupon has reached its maximum redemptions";
          } else if (
            !isUnlimitedRedemptionLimit(coupon.maxRedemptionsPerUser) &&
            userRedemptions >= coupon.maxRedemptionsPerUser
          ) {
            redemptionBlocked = "You have already used this coupon the maximum number of times";
          }

          redemptionMeta = { userRedemptions, totalRedemptions, redemptionBlocked };
        }

        return mapAvailableCoupon(coupon, subtotal, redemptionMeta);
      })
    );

    res.status(200).json({
      success: true,
      data: mapped,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllCoupons = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const [total, coupons] = await Promise.all([
      Coupon.countDocuments({}),
      Coupon.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const redemptionCounts = await Order.aggregate([
      {
        $match: {
          couponDiscount: { $gt: 0 },
          status: { $in: REDEEMED_ORDER_STATUSES },
          couponCode: { $ne: "" },
        },
      },
      {
        $group: {
          _id: "$couponCode",
          count: { $sum: 1 },
        },
      },
    ]);

    const redemptionCountMap = new Map(
      redemptionCounts.map((entry) => [entry._id, entry.count])
    );

    const data = coupons.map((coupon) => ({
      ...coupon,
      totalRedemptions: redemptionCountMap.get(coupon.code) || 0,
    }));

    res.status(200).json(buildPaginatedResponse(data, total, page, limit));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const errors = validateCouponPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors[0] });
    }

    const maxRedemptionsPerUser = parseRedemptionLimit(
      req.body.maxRedemptionsPerUser,
      "Max redemptions per user"
    );
    if (maxRedemptionsPerUser?.error) {
      return res.status(400).json({ success: false, message: maxRedemptionsPerUser.error });
    }

    const maxTotalRedemptions = parseRedemptionLimit(
      req.body.maxTotalRedemptions,
      "Max total redemptions"
    );
    if (maxTotalRedemptions?.error) {
      return res.status(400).json({ success: false, message: maxTotalRedemptions.error });
    }

    const coupon = await Coupon.create({
      code: normalizeCouponCode(req.body.code),
      title: req.body.title?.trim() || "",
      discountType: req.body.discountType,
      discountValue: Number(req.body.discountValue),
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate),
      isActive: req.body.isActive ?? true,
      appliesToAllProducts: true,
      minOrderAmount: Number(req.body.minOrderAmount) || 0,
      maxRedemptionsPerUser:
        maxRedemptionsPerUser === undefined ? null : maxRedemptionsPerUser,
      maxTotalRedemptions:
        maxTotalRedemptions === undefined ? null : maxTotalRedemptions,
    });

    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const errors = validateCouponPayload(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors[0] });
    }

    const updates = {};
    if (req.body.code !== undefined) updates.code = normalizeCouponCode(req.body.code);
    if (req.body.title !== undefined) updates.title = req.body.title?.trim() || "";
    if (req.body.discountType !== undefined) updates.discountType = req.body.discountType;
    if (req.body.discountValue !== undefined) {
      updates.discountValue = Number(req.body.discountValue);
    }
    if (req.body.startDate !== undefined) updates.startDate = new Date(req.body.startDate);
    if (req.body.endDate !== undefined) updates.endDate = new Date(req.body.endDate);
    if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
    if (req.body.minOrderAmount !== undefined) {
      updates.minOrderAmount = Number(req.body.minOrderAmount) || 0;
    }
    if (req.body.maxRedemptionsPerUser !== undefined) {
      const parsed = parseRedemptionLimit(
        req.body.maxRedemptionsPerUser,
        "Max redemptions per user"
      );
      if (parsed?.error) {
        return res.status(400).json({ success: false, message: parsed.error });
      }
      updates.maxRedemptionsPerUser = parsed;
    }
    if (req.body.maxTotalRedemptions !== undefined) {
      const parsed = parseRedemptionLimit(
        req.body.maxTotalRedemptions,
        "Max total redemptions"
      );
      if (parsed?.error) {
        return res.status(400).json({ success: false, message: parsed.error });
      }
      updates.maxTotalRedemptions = parsed;
    }

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.status(200).json({ success: true, data: coupon });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.status(200).json({ success: true, message: "Coupon deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const validateCoupon = async (req, res) => {
  try {
    const code = normalizeCouponCode(req.body.code);
    const subtotal = Number(req.body.subtotal) || 0;

    if (!code) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ code });
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid coupon code" });
    }

    const status = getCouponStatus(coupon);
    if (status === "inactive") {
      return res.status(400).json({ success: false, message: "This coupon is inactive" });
    }
    if (status === "scheduled") {
      return res.status(400).json({ success: false, message: "This coupon is not active yet" });
    }
    if (status === "expired") {
      return res.status(400).json({ success: false, message: "This coupon has expired" });
    }

    if (subtotal < Number(coupon.minOrderAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ₹${coupon.minOrderAmount}`,
      });
    }

    const redemptionError = await checkRedemptionLimits(coupon, {
      userId: req.user?._id,
    });
    if (redemptionError) {
      return res.status(400).json({ success: false, message: redemptionError.error });
    }

    const discountAmount = calculateCouponDiscount(coupon, subtotal);

    res.status(200).json({
      success: true,
      data: {
        code: coupon.code,
        title: coupon.title,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        appliesToAllProducts: coupon.appliesToAllProducts,
        startDate: coupon.startDate,
        endDate: coupon.endDate,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }
    res.status(200).json({ success: true, data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const DEFAULT_COUPONS = [
  {
    code: "GREEN10",
    title: "10% Instant Discount on Fresh Produce",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 199,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    appliesToAllProducts: true,
    maxRedemptionsPerUser: null,
    maxTotalRedemptions: null,
  },
  {
    code: "FRESH50",
    title: "Flat ₹50 OFF on Ready2Cook & Daily Veggies",
    discountType: "fixed",
    discountValue: 50,
    minOrderAmount: 399,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    appliesToAllProducts: true,
    maxRedemptionsPerUser: null,
    maxTotalRedemptions: null,
  },
  {
    code: "SUPER100",
    title: "Flat ₹100 Mega Discount on SuperMall Pantry",
    discountType: "fixed",
    discountValue: 100,
    minOrderAmount: 699,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    appliesToAllProducts: true,
    maxRedemptionsPerUser: null,
    maxTotalRedemptions: null,
  },
  {
    code: "WELCOME20",
    title: "Welcome Offer: 20% OFF on First Order",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 299,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    appliesToAllProducts: true,
    maxRedemptionsPerUser: 1,
    maxTotalRedemptions: null,
  },
  {
    code: "FESTIVE150",
    title: "Festive Special: Flat ₹150 OFF on ₹999+",
    discountType: "fixed",
    discountValue: 150,
    minOrderAmount: 999,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    appliesToAllProducts: true,
    maxRedemptionsPerUser: null,
    maxTotalRedemptions: null,
  },
];

export async function seedDefaultCouponsIfEmpty() {
  try {
    const count = await Coupon.countDocuments();
    if (count === 0) {
      console.log("[CouponService] Seeding default coupons...");
      await Coupon.insertMany(DEFAULT_COUPONS);
      console.log(`[CouponService] Successfully seeded ${DEFAULT_COUPONS.length} default coupons`);
    }
  } catch (error) {
    console.error("[CouponService] Failed to seed default coupons:", error.message);
  }
}

export const seedCoupons = async (_req, res) => {
  try {
    const existing = await Coupon.find();
    const existingCodes = new Set(existing.map((c) => c.code.toUpperCase()));

    const toInsert = DEFAULT_COUPONS.filter(
      (c) => !existingCodes.has(c.code.toUpperCase())
    );

    if (toInsert.length > 0) {
      await Coupon.insertMany(toInsert);
    }

    const all = await Coupon.find().sort({ minOrderAmount: 1, discountValue: -1 });
    res.status(200).json({
      success: true,
      message: `Seeded ${toInsert.length} new coupons`,
      data: all,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

