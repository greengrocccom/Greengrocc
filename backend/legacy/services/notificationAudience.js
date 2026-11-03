import Order from "../models/order/Order.js";
import Cart from "../models/Cart.js";

export const SEGMENTS = ["all", "inactive", "never_purchased", "buy_now_abandoned", "cart_abandoned", "checkout_abandoned"];

export function parseSegment(input = {}) {
  const segment = input.segment || "all";
  const days = Number(input.days ?? 30);
  if (!SEGMENTS.includes(segment) || !Number.isInteger(days) || days < 1 || days > 3650) {
    const error = new Error("Choose a valid audience filter and a whole number of days from 1 to 3650");
    error.status = 400;
    throw error;
  }
  return { segment, days };
}

export async function resolveNotificationAudience(baseFilter, input = {}) {
  const { segment, days } = parseSegment(input);
  if (segment === "all") return baseFilter;
  const cutoff = new Date(Date.now() - days * 86400000);
  const purchased = { status: { $in: ["confirm", "processing", "shipping", "delivered", "return"] } };
  if (segment === "never_purchased" || segment === "inactive") {
    const buyers = await Order.distinct("user", purchased);
    if (segment === "never_purchased") return { ...baseFilter, _id: { $nin: buyers } };
    const recent = await Order.distinct("user", { ...purchased, createdAt: { $gte: cutoff } });
    return { ...baseFilter, _id: { $in: buyers, $nin: recent } };
  }
  // Require activity to have been idle for at least the chosen number of days.
  // A later purchase removes the user even if an old attempt/cart remains.
  const source = segment === "cart_abandoned" ? Cart : Order;
  const match = segment === "cart_abandoned"
    ? { "items.0": { $exists: true } }
    : { status: "attempted", ...(segment === "buy_now_abandoned" ? { checkoutMode: "buyNow" } : {}) };
  const rows = await source.aggregate([
    { $match: match },
    { $group: { _id: "$user", activityAt: { $max: "$updatedAt" } } },
    { $match: { activityAt: { $lte: cutoff } } },
    { $lookup: { from: Order.collection.name, let: { customer: "$_id", activity: "$activityAt" }, pipeline: [
      { $match: { ...purchased, $expr: { $and: [{ $eq: ["$user", "$$customer"] }, { $gte: ["$updatedAt", "$$activity"] }] } } },
      { $limit: 1 },
    ], as: "purchases" } },
    { $match: { "purchases.0": { $exists: false } } },
  ]);
  return { ...baseFilter, _id: { $in: rows.map((row) => row._id) } };
}
