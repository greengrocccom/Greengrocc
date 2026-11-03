import mongoose from "mongoose";
import StoreOrder from "../models/StoreOrder.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import OrderFeedback from "../models/OrderFeedback.js";
import ProductReview from "../../../legacy/models/ProductReview.js";
import User from "../../../legacy/models/user.js";
import { refreshProductRating } from "../../../legacy/controllers/reviewController.js";
import { resolveCustomerOrderForViewer } from "../services/orderTrackingService.js";

const RIDER_TAGS = new Set([
  "On time",
  "Polite",
  "Careful with items",
  "Followed instructions",
  "Late",
  "Rude",
  "Damaged items",
  "Did not call",
]);

function clampRating(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

function orderProducts(customerOrder) {
  const seen = new Map();
  for (const item of customerOrder.items || []) {
    const id = item.product ? String(item.product) : "";
    if (!id || seen.has(id)) continue;
    seen.set(id, { productId: id, name: item.name || "Product", image: item.image || "" });
  }
  return [...seen.values()];
}

/** The rider who completed the order (latest delivered part wins for split carts). */
async function deliveredStoreOrder(customerOrderId) {
  return StoreOrder.findOne({
    sourceOrderId: customerOrderId,
    status: "delivered",
    assignedRiderId: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .select("_id assignedRiderId")
    .lean();
}

function feedbackJson(doc) {
  if (!doc) return null;
  return {
    riderRating: doc.riderRating,
    riderComment: doc.riderComment || "",
    riderTags: doc.riderTags || [],
    products: (doc.products || []).map((p) => ({
      productId: String(p.product),
      name: p.name || "",
      rating: p.rating,
      comment: p.comment || "",
    })),
    skipped: !!doc.skipped,
    createdAt: doc.createdAt,
  };
}

async function loadAccess(req, res) {
  const access = await resolveCustomerOrderForViewer(req.params.id, req.user);
  if (!access.ok) {
    res.status(access.statusCode).json({ success: false, code: access.code, message: access.message });
    return null;
  }
  return access.customerOrder;
}

/** GET /api/orders/:id/feedback — what can be rated, and any feedback already given. */
export async function getOrderFeedback(req, res) {
  try {
    const customerOrder = await loadAccess(req, res);
    if (!customerOrder) return;

    const [existing, storeOrder] = await Promise.all([
      OrderFeedback.findOne({ order: customerOrder._id, user: customerOrder.user }).lean(),
      deliveredStoreOrder(customerOrder._id),
    ]);
    const rider = storeOrder?.assignedRiderId
      ? await DeliveryBoy.findById(storeOrder.assignedRiderId).select("name").lean()
      : null;

    return res.json({
      success: true,
      data: {
        orderId: String(customerOrder._id),
        orderNumber: customerOrder.orderNumber || "",
        eligible: customerOrder.status === "delivered",
        submitted: !!existing && !existing.skipped,
        skipped: !!existing?.skipped,
        rider: rider ? { name: rider.name || "Delivery partner" } : null,
        riderTags: [...RIDER_TAGS],
        products: orderProducts(customerOrder),
        feedback: feedbackJson(existing),
      },
    });
  } catch (err) {
    console.error("[feedback] getOrderFeedback failed:", err);
    return res.status(500).json({ success: false, message: "Could not load feedback" });
  }
}

/**
 * POST /api/orders/:id/feedback — rate the delivery partner and the products.
 * Body: { riderRating, riderComment, riderTags, products: [{ productId, rating, comment }] }
 * or { skip: true } to stop being asked. Accepted once per order.
 */
export async function submitOrderFeedback(req, res) {
  try {
    const customerOrder = await loadAccess(req, res);
    if (!customerOrder) return;
    if (String(customerOrder.user) !== String(req.user?.id || "")) {
      return res.status(403).json({ success: false, message: "Only the customer can rate this order" });
    }
    if (customerOrder.status !== "delivered") {
      return res.status(400).json({ success: false, message: "You can rate the order after it is delivered" });
    }

    const existing = await OrderFeedback.findOne({ order: customerOrder._id, user: customerOrder.user });
    if (existing && !existing.skipped) {
      return res.status(409).json({ success: false, message: "Feedback already submitted for this order" });
    }

    const body = req.body || {};
    if (body.skip === true) {
      if (!existing) {
        await OrderFeedback.create({ order: customerOrder._id, user: customerOrder.user, skipped: true });
      }
      return res.json({ success: true, message: "Okay, we won't ask again" });
    }

    const riderRating = clampRating(body.riderRating);
    const allowedProducts = new Map(orderProducts(customerOrder).map((p) => [p.productId, p]));
    const products = [];
    for (const row of Array.isArray(body.products) ? body.products : []) {
      const id = String(row?.productId || "");
      const rating = clampRating(row?.rating);
      const product = allowedProducts.get(id);
      if (!product || !rating || products.some((p) => String(p.product) === id)) continue;
      products.push({
        product: new mongoose.Types.ObjectId(id),
        name: product.name,
        rating,
        comment: String(row?.comment || "").trim().slice(0, 1000),
      });
    }
    if (!riderRating && !products.length) {
      return res.status(400).json({ success: false, message: "Rate the delivery partner or at least one product" });
    }

    const storeOrder = riderRating ? await deliveredStoreOrder(customerOrder._id) : null;
    const riderTags = (Array.isArray(body.riderTags) ? body.riderTags : [])
      .map((t) => String(t).trim())
      .filter((t) => RIDER_TAGS.has(t));

    const payload = {
      order: customerOrder._id,
      user: customerOrder.user,
      storeOrderId: storeOrder?._id || null,
      riderId: storeOrder?.assignedRiderId || null,
      riderRating: storeOrder ? riderRating : null,
      riderComment: storeOrder ? String(body.riderComment || "").trim().slice(0, 1000) : "",
      riderTags: storeOrder ? riderTags : [],
      products,
      skipped: false,
    };
    const feedback = existing
      ? await OrderFeedback.findByIdAndUpdate(existing._id, payload, { returnDocument: 'after', runValidators: true })
      : await OrderFeedback.create(payload);

    if (payload.riderId && payload.riderRating) {
      const rider = await DeliveryBoy.findById(payload.riderId).select("rating totalRatingsCount");
      if (rider) {
        const count = Number(rider.totalRatingsCount) || 0;
        const current = count > 0 ? Number(rider.rating) || 0 : 0;
        const next = (current * count + payload.riderRating) / (count + 1);
        await DeliveryBoy.updateOne(
          { _id: rider._id },
          { $set: { rating: Math.round(next * 10) / 10 }, $inc: { totalRatingsCount: 1 } }
        );
      }
    }

    if (products.length) {
      const user = await User.findById(customerOrder.user).select("name").lean();
      const userName = String(user?.name || "Customer").trim();
      for (const p of products) {
        await ProductReview.findOneAndUpdate(
          { product: p.product, user: customerOrder.user },
          {
            product: p.product,
            user: customerOrder.user,
            userName,
            rating: p.rating,
            comment: p.comment || `Rated ${p.rating} star${p.rating === 1 ? "" : "s"}`,
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
        );
        await refreshProductRating(p.product);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Thanks for your feedback!",
      data: feedbackJson(feedback),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Feedback already submitted for this order" });
    }
    console.error("[feedback] submitOrderFeedback failed:", err);
    return res.status(500).json({ success: false, message: "Could not save feedback" });
  }
}
