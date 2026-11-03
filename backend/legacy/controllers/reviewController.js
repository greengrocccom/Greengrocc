import mongoose from "mongoose";
import ProductReview from "../models/ProductReview.js";
import Product from "../models/Product.js";

export async function refreshProductRating(productId) {
  const stats = await ProductReview.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)) } },
    {
      $group: {
        _id: "$product",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);
  const avg = stats[0] ? Math.round(Number(stats[0].avg) * 10) / 10 : 0;
  await Product.findByIdAndUpdate(productId, { ratings: avg });
  return { average: avg, count: stats[0]?.count || 0 };
}

export async function getProductReviews(req, res) {
  try {
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const reviews = await ProductReview.find({ product: productId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const stats = await ProductReview.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId) } },
      {
        $group: {
          _id: "$product",
          average: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      success: true,
      data: reviews.map((r) => ({
        id: String(r._id),
        rating: r.rating,
        title: r.title || "",
        comment: r.comment || "",
        userName: r.userName || "Customer",
        userId: r.user ? String(r.user) : null,
        createdAt: r.createdAt,
      })),
      stats: {
        average: stats[0] ? Math.round(Number(stats[0].average) * 10) / 10 : 0,
        count: stats[0]?.count || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createProductReview(req, res) {
  try {
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(productId).select("_id name").lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || req.body.text || "").trim();
    const title = String(req.body.title || "").trim();

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }
    if (!comment || comment.length < 3) {
      return res.status(400).json({ success: false, message: "Please write a short review" });
    }

    const userName = String(req.user?.name || "Customer").trim();

    const review = await ProductReview.findOneAndUpdate(
      { product: productId, user: req.user._id },
      {
        product: productId,
        user: req.user._id,
        userName,
        rating: Math.round(rating),
        title,
        comment,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    );

    const stats = await refreshProductRating(productId);

    return res.status(201).json({
      success: true,
      message: "Review submitted",
      data: {
        id: String(review._id),
        rating: review.rating,
        title: review.title || "",
        comment: review.comment || "",
        userName: review.userName || userName,
        userId: String(review.user),
        createdAt: review.createdAt,
      },
      stats,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: "You already reviewed this product" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
}
