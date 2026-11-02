import Incentive from "../models/Incentive.js";
import Gig from "../models/Gig.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { formatDateStringIST, timeToMinutes, getRiderManager } from "./shiftController.js";

/**
 * PART 2 — Utility Function: checkAndTrackIncentive(riderId, storeId)
 * Checks for any active Gigs today, calculates rider's bonus progress,
 * and upserts the Incentive tracking record.
 */
export async function checkAndTrackIncentive(riderId, storeId) {
  try {
    if (!riderId) return null;

    const rider = await DeliveryBoy.findById(riderId);
    if (!rider) return null;

    const manager = await getRiderManager(rider);
    const effectiveManagerId = manager?._id || rider.managerId;
    const effectiveStoreId = storeId || rider.storeId || (effectiveManagerId ? effectiveManagerId.toString() : "");

    const now = new Date();
    const todayStrIST = formatDateStringIST(now);

    // Calculate IST start of day date object
    const todayStart = new Date(`${todayStrIST}T00:00:00.000Z`);

    const nowISTFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
    const currentMinIST = timeToMinutes(nowISTFormatter.format(now));

    // Find active Gigs for today for this store/manager/area
    const query = {
      isActive: true,
      dateString: todayStrIST,
    };

    if (effectiveManagerId) {
      query.$or = [
        { managerId: effectiveManagerId },
        { storeId: String(effectiveStoreId) },
        { area: rider.area || "" },
      ];
    }

    const gigs = await Gig.find(query);

    // Find gig active right now based on IST window
    const activeGig = gigs.find((g) => {
      const startMin = timeToMinutes(g.startTime);
      const endMin = timeToMinutes(g.endTime);
      return currentMinIST >= startMin && currentMinIST <= endMin;
    });

    const gigToTrack = activeGig || gigs[0];

    const totalOrders = rider.todayCompletedOrders || 0;
    const totalEarnings = rider.todayEarnings || 0;
    const onlineMinutes = rider.todayOnlineMinutes || 0;

    let targetBonusEarned = 0;

    // Check driver eligibility for this gig incentive
    let isEligibleForGig = true;
    if (gigToTrack) {
      if (gigToTrack.targetAudience === "top_performers") {
        const rating = rider.rating !== undefined ? Number(rider.rating) : 5;
        if (rating < 4.0) isEligibleForGig = false;
      } else if (gigToTrack.targetAudience === "specific") {
        const allowed = (gigToTrack.eligibleRiderIds || []).map((id) => (id?._id || id).toString());
        if (!allowed.includes(String(rider._id))) isEligibleForGig = false;
      }
    }

    if (gigToTrack && isEligibleForGig) {
      if (gigToTrack.tiers && gigToTrack.tiers.length > 0) {
        let valToCompare = totalEarnings;
        if (gigToTrack.type === "hours_bonus") {
          valToCompare = onlineMinutes / 60;
        } else if (gigToTrack.type === "custom" && gigToTrack.tierMetric === "orders") {
          valToCompare = totalOrders;
        }

        // Sort tiers highest minTarget first to pick the highest achieved tier
        const sortedTiers = [...gigToTrack.tiers].sort((a, b) => b.minTarget - a.minTarget);
        const matchedTier = sortedTiers.find((t) => valToCompare >= t.minTarget);

        if (matchedTier) {
          targetBonusEarned = matchedTier.bonusAmount;
        }
      } else if (gigToTrack.type === "hours_bonus") {
        const reqMin = (gigToTrack.targetHours || 0) * 60;
        if (onlineMinutes >= reqMin) {
          targetBonusEarned = gigToTrack.bonusAmount || 0;
        }
      } else if (gigToTrack.type === "earnings_target") {
        if (totalEarnings >= (gigToTrack.targetEarnings || 0)) {
          targetBonusEarned = gigToTrack.bonusAmount || 0;
        }
      }
    }

    const incentive = await Incentive.findOneAndUpdate(
      { riderId: rider._id, date: todayStart },
      {
        $setOnInsert: {
          riderId: rider._id,
          managerId: effectiveManagerId || rider._id,
          storeId: effectiveManagerId || rider._id,
          date: todayStart,
          settled: false,
        },
        $set: {
          totalOrders,
          totalEarnings,
          targetBonusEarned,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return incentive;
  } catch (error) {
    console.error("[checkAndTrackIncentive] Error:", error.message);
    return null;
  }
}

/**
 * GET /api/delivery/incentives/available — Rider home-page endpoint.
 * Returns active gig + live progress and upcoming gigs scheduled later today.
 */
export const getAvailableIncentives = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const manager = await getRiderManager(rider);
    const effectiveManagerId = manager?._id || rider.managerId;
    const todayStrIST = formatDateStringIST(new Date());

    const query = {
      isActive: true,
      dateString: todayStrIST,
    };
    if (effectiveManagerId) {
      query.$or = [
        { managerId: effectiveManagerId },
        { storeId: String(rider.storeId || effectiveManagerId) },
        { area: rider.area || "" },
      ];
    }

    const gigs = await Gig.find(query).sort({ createdAt: 1 });

    const now = new Date();
    const nowISTFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
    const currentMinIST = timeToMinutes(nowISTFormatter.format(now));

    let activeGigData = null;
    const upcomingGigs = [];

    for (const gig of gigs) {
      const startMin = timeToMinutes(gig.startTime);
      const endMin = timeToMinutes(gig.endTime);

      if (currentMinIST >= startMin && currentMinIST <= endMin) {
        // Active Gig progress details
        const totalOrders = rider.todayCompletedOrders || 0;
        const totalEarnings = rider.todayEarnings || 0;
        const onlineMinutes = rider.todayOnlineMinutes || 0;

        let currentTier = null;
        let nextTier = null;
        let bonusEarned = 0;

        if (gig.tiers && gig.tiers.length > 0) {
          let currentVal = totalEarnings;
          if (gig.type === "hours_bonus") {
            currentVal = onlineMinutes / 60;
          } else if (gig.type === "custom" && gig.tierMetric === "orders") {
            currentVal = totalOrders;
          }

          const sortedAsc = [...gig.tiers].sort((a, b) => a.minTarget - b.minTarget);

          for (const t of sortedAsc) {
            if (currentVal >= t.minTarget) {
              currentTier = t;
              bonusEarned = t.bonusAmount;
            } else if (!nextTier) {
              nextTier = t;
            }
          }
        } else if (gig.type === "hours_bonus") {
          const targetMin = (gig.targetHours || 0) * 60;
          if (onlineMinutes >= targetMin) bonusEarned = gig.bonusAmount || 0;
        } else if (gig.type === "earnings_target") {
          if (totalEarnings >= (gig.targetEarnings || 0)) bonusEarned = gig.bonusAmount || 0;
        }

        activeGigData = {
          gigId: gig._id.toString(),
          title: gig.title,
          type: gig.type,
          description: gig.description,
          startTime: gig.startTime,
          endTime: gig.endTime,
          targetHours: gig.targetHours,
          targetEarnings: gig.targetEarnings,
          bonusAmount: gig.bonusAmount,
          tierMetric: gig.tierMetric || "orders",
          tiers: gig.tiers,
          progress: {
            ordersSoFar: totalOrders,
            earningsSoFar: totalEarnings,
            onlineMinutesSoFar: onlineMinutes,
            currentTier,
            nextTier,
            bonusEarned,
          },
        };
      } else if (currentMinIST < startMin) {
        upcomingGigs.push({
          gigId: gig._id.toString(),
          title: gig.title,
          type: gig.type,
          description: gig.description,
          startTime: gig.startTime,
          endTime: gig.endTime,
          bonusAmount: gig.bonusAmount,
          tierMetric: gig.tierMetric || "orders",
          tiers: gig.tiers,
        });
      }
    }

    // Ensure Incentive record is synced
    const incentiveDoc = await checkAndTrackIncentive(rider._id, rider.storeId);

    return res.json({
      success: true,
      serverTimeIST: nowISTFormatter.format(now),
      dateString: todayStrIST,
      activeGig: activeGigData,
      upcomingGigs,
      todayIncentive: incentiveDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Legacy compatibility helper: Upserts today's Incentive record for a rider upon order completion.
 */
export async function upsertDailyIncentive({
  riderId,
  managerId,
}) {
  return checkAndTrackIncentive(riderId, managerId);
}

/**
 * Rider (their own data) or Manager (any rider under their managerId).
 * Returns incentive history, optionally filtered by date range.
 */
export const getRiderIncentives = async (req, res) => {
  try {
    let riderId = req.query.riderId;

    if (req.user?.role !== "delivery_manager") {
      riderId = req.user.id;
    } else if (!riderId) {
      return res.status(400).json({
        success: false,
        message: "riderId query parameter is required for managers",
      });
    }

    const { startDate, endDate } = req.query;

    const filter = { riderId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (req.user?.role === "delivery_manager") {
      filter.$or = [{ managerId: req.user.id }, { storeId: req.user.id }];
    }

    const incentives = await Incentive.find(filter).sort({ date: -1 });

    res.json({
      success: true,
      data: incentives,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch rider incentives",
    });
  }
};

/**
 * Manager only — Aggregates total earnings/orders across all riders under their managerId.
 */
export const getStoreIncentiveSummary = async (req, res) => {
  try {
    if (req.user?.role !== "delivery_manager") {
      return res.status(403).json({
        success: false,
        message: "Only delivery managers can access store incentive analytics",
      });
    }

    const managerId = req.query.managerId || req.query.storeId || req.user.id;

    if (managerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to another store's analytics",
      });
    }

    const { startDate, endDate } = req.query;

    const matchQuery = {
      $or: [{ managerId }, { storeId: managerId }],
    };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
    }

    const summary = await Incentive.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$managerId",
          totalOrders: { $sum: "$totalOrders" },
          totalEarnings: { $sum: "$totalEarnings" },
          totalTargetBonusEarned: { $sum: "$targetBonusEarned" },
          activeRiderCount: { $addToSet: "$riderId" },
        },
      },
      {
        $project: {
          _id: 0,
          managerId: "$_id",
          storeId: "$_id",
          totalOrders: 1,
          totalEarnings: 1,
          totalTargetBonusEarned: 1,
          totalRidersWithEarnings: { $size: "$activeRiderCount" },
        },
      },
    ]);

    const perRiderBreakdown = await Incentive.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$riderId",
          totalOrders: { $sum: "$totalOrders" },
          totalEarnings: { $sum: "$totalEarnings" },
          targetBonusEarned: { $sum: "$targetBonusEarned" },
        },
      },
      {
        $lookup: {
          from: "deliveryboys",
          localField: "_id",
          foreignField: "_id",
          as: "riderDetails",
        },
      },
      {
        $unwind: { path: "$riderDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          riderId: "$_id",
          _id: 0,
          riderName: "$riderDetails.name",
          riderPhone: "$riderDetails.phone",
          totalOrders: 1,
          totalEarnings: 1,
          targetBonusEarned: 1,
        },
      },
      { $sort: { totalEarnings: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        summary: summary[0] || {
          managerId,
          storeId: managerId,
          totalOrders: 0,
          totalEarnings: 0,
          totalTargetBonusEarned: 0,
          totalRidersWithEarnings: 0,
        },
        perRiderBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch store incentive summary",
    });
  }
};
