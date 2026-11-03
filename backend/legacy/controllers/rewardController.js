import RewardSetting from "../models/RewardSetting.js";
import RewardTransaction from "../models/RewardTransaction.js";
import User from "../models/user.js";
import { getPaginationParams, buildPaginatedResponse } from "../utils/pagination.js";

let cachedRewardSettings = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

export async function getRewardSettings({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedRewardSettings && cacheExpiresAt > now) {
    return cachedRewardSettings;
  }

  let doc = await RewardSetting.findOne({ key: "reward_settings" });
  if (!doc) {
    doc = await RewardSetting.create({ key: "reward_settings" });
  }

  cachedRewardSettings = doc.toObject();
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedRewardSettings;
}

export function clearRewardSettingsCache() {
  cachedRewardSettings = null;
  cacheExpiresAt = 0;
}

export async function seedDefaultRewardSettingsIfEmpty() {
  try {
    const existing = await RewardSetting.findOne({ key: "reward_settings" });
    if (!existing) {
      await RewardSetting.create({ key: "reward_settings" });
      console.log("Seeded default Reward Points settings and Terms & Conditions");
    }
  } catch (error) {
    console.error("Failed to seed default reward settings:", error.message);
  }
}

// Compute discount and points validity for a given cart subtotal
export function calculateEligibleRewardDiscount(userPoints, requestedPoints, subtotal, settings) {
  if (!settings || !settings.enabled) {
    return { valid: false, pointsToUse: 0, discount: 0, reason: "Reward points program is disabled" };
  }

  const availablePoints = Math.max(0, Number(userPoints) || 0);
  const askPoints = Math.max(0, Math.floor(Number(requestedPoints) || 0));

  if (askPoints <= 0) {
    return { valid: true, pointsToUse: 0, discount: 0 };
  }

  if (askPoints > availablePoints) {
    return {
      valid: false,
      pointsToUse: 0,
      discount: 0,
      reason: `You only have ${availablePoints} reward points available`,
    };
  }

  const minOrder = Number(settings.minOrderAmountToRedeem) || 0;
  if (subtotal < minOrder) {
    return {
      valid: false,
      pointsToUse: 0,
      discount: 0,
      reason: `Minimum order amount to redeem reward points is ₹${minOrder}`,
    };
  }

  const minPoints = Number(settings.minPointsToRedeem) || 0;
  if (askPoints < minPoints) {
    return {
      valid: false,
      pointsToUse: 0,
      discount: 0,
      reason: `Minimum ${minPoints} reward points required for redemption`,
    };
  }

  const pointValue = Number(settings.pointValueInRupees) || 1.0;
  const maxPercent = Number(settings.maxRedemptionPercent) || 50;
  const maxDiscountAllowed = Math.round(((subtotal * maxPercent) / 100) * 100) / 100;
  const maxPointsByPercent = Math.floor(maxDiscountAllowed / pointValue);

  const maxPointsCap = Number(settings.maxPointsPerOrder) || 0;
  let finalMaxPoints = maxPointsByPercent;
  if (maxPointsCap > 0 && maxPointsCap < finalMaxPoints) {
    finalMaxPoints = maxPointsCap;
  }

  if (askPoints > finalMaxPoints) {
    return {
      valid: false,
      pointsToUse: 0,
      discount: 0,
      reason: `Maximum ${finalMaxPoints} points (₹${(finalMaxPoints * pointValue).toFixed(
        2
      )}) can be redeemed on this order (max ${maxPercent}% of subtotal)`,
    };
  }

  const discount = Math.round(askPoints * pointValue * 100) / 100;

  return {
    valid: true,
    pointsToUse: askPoints,
    discount,
    pointValue,
  };
}

// Public / Customer: Get program settings & T&C
export const getPublicRewardSettings = async (req, res) => {
  try {
    const settings = await getRewardSettings();
    res.status(200).json({
      success: true,
      data: {
        enabled: settings.enabled,
        earningRate: settings.earningRate,
        minOrderAmountToEarn: settings.minOrderAmountToEarn,
        pointValueInRupees: settings.pointValueInRupees,
        minPointsToRedeem: settings.minPointsToRedeem,
        maxRedemptionPercent: settings.maxRedemptionPercent,
        maxPointsPerOrder: settings.maxPointsPerOrder,
        minOrderAmountToRedeem: settings.minOrderAmountToRedeem,
        termsAndConditions: settings.termsAndConditions || [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Customer: Get my points balance, value, and transaction history
export const getMyRewardPoints = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("rewardPoints name phone");
    const settings = await getRewardSettings();

    const currentPoints = user?.rewardPoints || 0;
    const pointValue = Number(settings.pointValueInRupees) || 1.0;
    const monetaryValue = Math.round(currentPoints * pointValue * 100) / 100;

    const { page, limit, skip } = getPaginationParams(req.query);

    const [totalTransactions, transactions, earnedAgg, spentAgg] = await Promise.all([
      RewardTransaction.countDocuments({ user: userId }),
      RewardTransaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("order", "orderNumber total status createdAt"),
      RewardTransaction.aggregate([
        { $match: { user: userId, points: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$points" } } },
      ]),
      RewardTransaction.aggregate([
        { $match: { user: userId, points: { $lt: 0 } } },
        { $group: { _id: null, total: { $sum: "$points" } } },
      ]),
    ]);

    const totalEarned = earnedAgg[0]?.total || 0;
    const totalSpent = Math.abs(spentAgg[0]?.total || 0);

    res.status(200).json({
      success: true,
      data: {
        points: currentPoints,
        monetaryValue,
        pointValueInRupees: pointValue,
        totalEarned,
        totalSpent,
        settings: {
          enabled: settings.enabled,
          earningRate: settings.earningRate,
          minOrderAmountToEarn: settings.minOrderAmountToEarn,
          minPointsToRedeem: settings.minPointsToRedeem,
          maxRedemptionPercent: settings.maxRedemptionPercent,
          maxPointsPerOrder: settings.maxPointsPerOrder,
          minOrderAmountToRedeem: settings.minOrderAmountToRedeem,
          termsAndConditions: settings.termsAndConditions || [],
        },
        ...buildPaginatedResponse(transactions, totalTransactions, page, limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Calculate reward discount for a given subtotal and requested points
export const calculateRewardDiscount = async (req, res) => {
  try {
    const { points, subtotal } = req.body;
    const user = await User.findById(req.user._id).select("rewardPoints");
    const settings = await getRewardSettings();

    const result = calculateEligibleRewardDiscount(
      user?.rewardPoints || 0,
      points,
      Number(subtotal) || 0,
      settings
    );

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.reason || "Invalid points redemption request",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        pointsToUse: result.pointsToUse,
        discount: result.discount,
        pointValueInRupees: result.pointValue,
        availablePoints: user?.rewardPoints || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get complete settings
export const getAdminRewardSettings = async (_req, res) => {
  try {
    const settings = await getRewardSettings({ forceRefresh: true });
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Update settings & Terms and Conditions
export const updateAdminRewardSettings = async (req, res) => {
  try {
    const {
      enabled,
      earningRate,
      minOrderAmountToEarn,
      pointValueInRupees,
      minPointsToRedeem,
      maxRedemptionPercent,
      maxPointsPerOrder,
      minOrderAmountToRedeem,
      termsAndConditions,
      welcomeBonusPoints,
    } = req.body;

    const payload = {};

    if (enabled !== undefined) payload.enabled = Boolean(enabled);

    if (earningRate && typeof earningRate === "object") {
      const spend = Number(earningRate.spendAmount);
      const points = Number(earningRate.pointsEarned);
      if (!Number.isFinite(spend) || spend < 1 || !Number.isFinite(points) || points < 0) {
        return res.status(400).json({
          success: false,
          message: "Earning rate must have valid spendAmount (>=1) and pointsEarned (>=0)",
        });
      }
      payload.earningRate = { spendAmount: spend, pointsEarned: points };
    }

    if (minOrderAmountToEarn !== undefined) {
      const val = Number(minOrderAmountToEarn);
      if (!Number.isFinite(val) || val < 0) {
        return res.status(400).json({
          success: false,
          message: "Minimum order amount to earn must be 0 or more",
        });
      }
      payload.minOrderAmountToEarn = val;
    }

    if (pointValueInRupees !== undefined) {
      const val = Number(pointValueInRupees);
      if (!Number.isFinite(val) || val <= 0) {
        return res.status(400).json({
          success: false,
          message: "Point value in rupees must be greater than 0",
        });
      }
      payload.pointValueInRupees = val;
    }

    if (minPointsToRedeem !== undefined) {
      const val = Number(minPointsToRedeem);
      if (!Number.isFinite(val) || val < 0) {
        return res.status(400).json({
          success: false,
          message: "Minimum points to redeem must be 0 or more",
        });
      }
      payload.minPointsToRedeem = val;
    }

    if (maxRedemptionPercent !== undefined) {
      const val = Number(maxRedemptionPercent);
      if (!Number.isFinite(val) || val < 1 || val > 100) {
        return res.status(400).json({
          success: false,
          message: "Max redemption percent must be between 1 and 100",
        });
      }
      payload.maxRedemptionPercent = val;
    }

    if (maxPointsPerOrder !== undefined) {
      const val = Number(maxPointsPerOrder);
      if (!Number.isFinite(val) || val < 0) {
        return res.status(400).json({
          success: false,
          message: "Max points per order must be 0 or more",
        });
      }
      payload.maxPointsPerOrder = val;
    }

    if (minOrderAmountToRedeem !== undefined) {
      const val = Number(minOrderAmountToRedeem);
      if (!Number.isFinite(val) || val < 0) {
        return res.status(400).json({
          success: false,
          message: "Minimum order amount to redeem must be 0 or more",
        });
      }
      payload.minOrderAmountToRedeem = val;
    }

    if (termsAndConditions !== undefined) {
      if (!Array.isArray(termsAndConditions)) {
        return res.status(400).json({
          success: false,
          message: "Terms and conditions must be an array of strings",
        });
      }
      payload.termsAndConditions = termsAndConditions
        .map((t) => String(t || "").trim())
        .filter(Boolean);
    }

    if (welcomeBonusPoints !== undefined) {
      const val = Number(welcomeBonusPoints);
      if (!Number.isFinite(val) || val < 0) {
        return res.status(400).json({
          success: false,
          message: "Welcome bonus points must be 0 or more",
        });
      }
      payload.welcomeBonusPoints = val;
    }

    let doc = await RewardSetting.findOne({ key: "reward_settings" });
    if (!doc) {
      doc = await RewardSetting.create({ key: "reward_settings", ...payload });
    } else {
      Object.assign(doc, payload);
      await doc.save();
    }

    clearRewardSettingsCache();

    res.status(200).json({
      success: true,
      message: "Reward settings updated successfully",
      data: doc,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: System-wide stats for rewards
export const getAdminRewardStats = async (_req, res) => {
  try {
    const [earnedAgg, redeemedAgg, userAgg, totalUsersHoldingPoints] = await Promise.all([
      RewardTransaction.aggregate([
        { $match: { points: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$points" } } },
      ]),
      RewardTransaction.aggregate([
        { $match: { points: { $lt: 0 } } },
        { $group: { _id: null, total: { $sum: "$points" } } },
      ]),
      User.aggregate([
        { $match: { rewardPoints: { $gt: 0 } } },
        { $group: { _id: null, totalBalance: { $sum: "$rewardPoints" } } },
      ]),
      User.countDocuments({ rewardPoints: { $gt: 0 } }),
    ]);

    const totalIssued = earnedAgg[0]?.total || 0;
    const totalRedeemed = Math.abs(redeemedAgg[0]?.total || 0);
    const activeLiability = userAgg[0]?.totalBalance || 0;

    res.status(200).json({
      success: true,
      data: {
        totalPointsIssued: totalIssued,
        totalPointsRedeemed: totalRedeemed,
        activeLiabilityPoints: activeLiability,
        totalUsersWithPoints: totalUsersHoldingPoints,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Paginated audit transactions
export const getAdminRewardTransactions = async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = {};

    if (type && type !== "all") {
      filter.type = type;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const matchedUsers = await User.find({
        $or: [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }],
      }).select("_id");
      const userIds = matchedUsers.map((u) => u._id);

      filter.$or = [
        { user: { $in: userIds } },
        { description: searchRegex },
      ];
    }

    const { page, limit, skip } = getPaginationParams(req.query);

    const [total, transactions] = await Promise.all([
      RewardTransaction.countDocuments(filter),
      RewardTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "name phone email rewardPoints")
        .populate("order", "orderNumber total status"),
    ]);

    res.status(200).json(buildPaginatedResponse(transactions, total, page, limit));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Manually adjust points for a user
export const adminAdjustUserPoints = async (req, res) => {
  try {
    const { userId, points, reason } = req.body;

    const deltaPoints = Number(points);
    if (!Number.isFinite(deltaPoints) || deltaPoints === 0) {
      return res.status(400).json({
        success: false,
        message: "Points adjustment must be a non-zero number (+ to grant, - to debit)",
      });
    }

    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for points adjustment",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const currentBalance = user.rewardPoints || 0;
    const newBalance = currentBalance + deltaPoints;

    if (newBalance < 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot deduct ${Math.abs(deltaPoints)} points. User only has ${currentBalance} points.`,
      });
    }

    user.rewardPoints = newBalance;
    await user.save();

    const transaction = await RewardTransaction.create({
      user: user._id,
      type: "admin_adjustment",
      points: deltaPoints,
      balanceAfter: newBalance,
      description: `${deltaPoints > 0 ? "Admin Bonus/Adjustment" : "Admin Deduction"}: ${trimmedReason}`,
      metadata: {
        adjustedBy: req.user._id,
        reason: trimmedReason,
      },
    });

    res.status(200).json({
      success: true,
      message: `Points updated successfully. New balance: ${newBalance} points`,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          rewardPoints: user.rewardPoints,
        },
        transaction,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Calculate reward points earned for a given purchase subtotal
export function calculatePointsToEarn(subtotal, settings) {
  if (!settings || !settings.enabled) return 0;
  const numSubtotal = Number(subtotal) || 0;
  const minOrderToEarn = Number(settings.minOrderAmountToEarn) || 0;
  if (numSubtotal < minOrderToEarn) return 0;

  const spendAmount = Number(settings.earningRate?.spendAmount) || 100;
  const pointsEarnedRate = Number(settings.earningRate?.pointsEarned) || 10;
  if (spendAmount <= 0 || pointsEarnedRate <= 0) return 0;

  return Math.floor((numSubtotal / spendAmount) * pointsEarnedRate);
}

// Process points deduction and points earning when an order is finalized/placed
export async function processOrderRewardPoints(order, { rewardPointsUsed = 0, userId }) {
  if (!order || !userId) return;

  const pointsUsed = Math.max(0, Math.floor(Number(rewardPointsUsed) || 0));
  const settings = await getRewardSettings();
  const pointsEarned = calculatePointsToEarn(order.subtotal, settings);

  let currentPoints = 0;

  // 1. Deduct redeemed points if any
  if (pointsUsed > 0) {
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, rewardPoints: { $gte: pointsUsed } },
      { $inc: { rewardPoints: -pointsUsed } },
      { returnDocument: 'after' }
    );

    if (updatedUser) {
      currentPoints = updatedUser.rewardPoints;
      await RewardTransaction.create({
        user: userId,
        order: order._id,
        type: "redeemed",
        points: -pointsUsed,
        balanceAfter: currentPoints,
        description: `Redeemed on Order #${order.orderNumber || String(order._id).slice(-6)}`,
        metadata: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          discount: order.rewardDiscount,
        },
      });
    }
  }

  // 2. Award earned points if enabled and order qualifies
  if (pointsEarned > 0) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { rewardPoints: pointsEarned } },
      { returnDocument: 'after' }
    );

    if (updatedUser) {
      currentPoints = updatedUser.rewardPoints;
      await RewardTransaction.create({
        user: userId,
        order: order._id,
        type: "earned",
        points: pointsEarned,
        balanceAfter: currentPoints,
        description: `Earned from Order #${order.orderNumber || String(order._id).slice(-6)}`,
        metadata: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          subtotal: order.subtotal,
        },
      });
    }
  }

  // Update order fields
  order.rewardPointsUsed = pointsUsed;
  order.rewardPointsEarned = pointsEarned;
}

// Reverse points when an order is cancelled
export async function reverseOrderRewardPoints(order) {
  if (!order) return;

  const userId = order.user?._id || order.user;
  if (!userId) return;

  const pointsUsed = Math.max(0, Number(order.rewardPointsUsed) || 0);
  const pointsEarned = Math.max(0, Number(order.rewardPointsEarned) || 0);

  // 1. Refund redeemed points back to user
  if (pointsUsed > 0) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { rewardPoints: pointsUsed } },
      { returnDocument: 'after' }
    );

    if (updatedUser) {
      await RewardTransaction.create({
        user: userId,
        order: order._id,
        type: "refunded",
        points: pointsUsed,
        balanceAfter: updatedUser.rewardPoints,
        description: `Refunded for cancelled Order #${order.orderNumber || String(order._id).slice(-6)}`,
        metadata: {
          orderId: order._id,
          orderNumber: order.orderNumber,
        },
      });
    }
  }

  // 2. Revoke points earned from this cancelled order
  if (pointsEarned > 0) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { rewardPoints: -pointsEarned } },
      { returnDocument: 'after' }
    );

    if (updatedUser) {
      await RewardTransaction.create({
        user: userId,
        order: order._id,
        type: "reversal",
        points: -pointsEarned,
        balanceAfter: Math.max(0, updatedUser.rewardPoints),
        description: `Reversed for cancelled Order #${order.orderNumber || String(order._id).slice(-6)}`,
        metadata: {
          orderId: order._id,
          orderNumber: order.orderNumber,
        },
      });
    }
  }
}

