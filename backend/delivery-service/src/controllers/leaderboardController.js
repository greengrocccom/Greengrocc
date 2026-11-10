import DeliveryBoy from "../models/DeliveryBoy.js";
import StoreOrder from "../models/StoreOrder.js";
import DriverOfferHistory from "../models/DriverOfferHistory.js";
import { getManager, riderQuery } from "./managerDashboardController.js";

const PERIOD_DAYS = { week: 7, month: 30 };

/** Same bar as the "Top performers" incentive audience (gigs, slot incentives). */
const GOOD_PERFORMANCE_RATING = 4;

/** Score weights. A rider with no data for a part (no offers, no ratings) is scored on the rest. */
const WEIGHTS = { deliveries: 50, success: 20, acceptance: 15, rating: 15 };

const round1 = (n) => Math.round(n * 10) / 10;

function weightedScore(parts) {
  let total = 0;
  let weight = 0;
  for (const [key, value] of Object.entries(parts)) {
    if (value == null) continue;
    total += value * WEIGHTS[key];
    weight += WEIGHTS[key];
  }
  return weight ? Math.round((total / weight) * 100) : 0;
}

/**
 * GET /leaderboard?period=week|month|all
 * This store's riders ranked by delivered orders, delivery success, offer acceptance
 * and customer rating. Only real recorded activity is counted.
 */
export const getRiderLeaderboard = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const period = PERIOD_DAYS[req.query.period] ? req.query.period : req.query.period === "all" ? "all" : "week";
    const since = period === "all" ? null : new Date(Date.now() - PERIOD_DAYS[period] * 86400000);

    const riders = await DeliveryBoy.find(riderQuery(manager, { isActive: { $ne: false } })).select(
      "name phone vehicleType employmentType status rating totalRatingsCount"
    );
    const riderIds = riders.map((r) => r._id);

    const [deliveredStats, failedStats, offerStats] = await Promise.all([
      StoreOrder.aggregate([
        {
          $match: {
            assignedRiderId: { $in: riderIds },
            status: "delivered",
            ...(since ? { deliveredAt: { $gte: since } } : {}),
          },
        },
        {
          $group: {
            _id: "$assignedRiderId",
            delivered: { $sum: 1 },
            distanceKm: { $sum: { $ifNull: ["$deliveryDistanceKm", 0] } },
            earnings: { $sum: { $ifNull: ["$riderDeliveryEarning", 0] } },
          },
        },
      ]),
      StoreOrder.aggregate([
        {
          $match: {
            status: "delivery_failed",
            failureKind: { $ne: "rider_emergency" },
            $or: [{ failedByRiderId: { $in: riderIds } }, { assignedRiderId: { $in: riderIds } }],
            ...(since ? { failedAt: { $gte: since } } : {}),
          },
        },
        { $group: { _id: { $ifNull: ["$failedByRiderId", "$assignedRiderId"] }, failed: { $sum: 1 } } },
      ]),
      DriverOfferHistory.aggregate([
        {
          $match: {
            driverId: { $in: riderIds },
            response: { $in: ["ACCEPTED", "DECLINED", "TIMEOUT"] },
            ...(since ? { offeredAt: { $gte: since } } : {}),
          },
        },
        {
          $group: {
            _id: "$driverId",
            offers: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ["$response", "ACCEPTED"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const byId = (rows) => new Map(rows.map((row) => [String(row._id), row]));
    const delivered = byId(deliveredStats);
    const failed = byId(failedStats);
    const offers = byId(offerStats);
    const maxDelivered = Math.max(1, ...deliveredStats.map((row) => row.delivered));

    const rows = riders.map((r) => {
      const id = String(r._id);
      const d = delivered.get(id);
      const deliveredCount = d?.delivered || 0;
      const failedCount = failed.get(id)?.failed || 0;
      const offer = offers.get(id);
      const ratingsCount = r.totalRatingsCount || 0;
      const rating = ratingsCount > 0 ? round1(Number(r.rating) || 0) : null;
      const attempts = deliveredCount + failedCount;
      const successRate = attempts ? deliveredCount / attempts : null;
      const acceptanceRate = offer?.offers ? offer.accepted / offer.offers : null;

      return {
        id,
        name: r.name || "Delivery Partner",
        phone: r.phone || "",
        vehicleType: r.vehicleType || "",
        employmentType: r.employmentType || "PART_TIME",
        status: r.status || "offline",
        delivered: deliveredCount,
        failed: failedCount,
        distanceKm: round1(d?.distanceKm || 0),
        earnings: Math.round(d?.earnings || 0),
        offers: offer?.offers || 0,
        successRate: successRate == null ? null : Math.round(successRate * 100),
        acceptanceRate: acceptanceRate == null ? null : Math.round(acceptanceRate * 100),
        rating,
        ratingsCount,
        isGoodPerformance: Number(r.rating ?? 5) >= GOOD_PERFORMANCE_RATING,
        score: attempts || offer?.offers
          ? weightedScore({
              deliveries: deliveredCount / maxDelivered,
              success: successRate,
              acceptance: acceptanceRate,
              rating: rating == null ? null : rating / 5,
            })
          : 0,
      };
    });

    rows.sort((a, b) => b.score - a.score || b.delivered - a.delivered || (b.rating ?? 0) - (a.rating ?? 0));
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });

    return res.json({
      success: true,
      period,
      since,
      weights: WEIGHTS,
      goodPerformanceRating: GOOD_PERFORMANCE_RATING,
      riders: rows,
    });
  } catch (error) {
    next(error);
  }
};
