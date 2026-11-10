import mongoose from "mongoose";
import { Vendor, VendorReview } from "./models.js";

const DEFAULT_VACATION = {
  enabled: false,
  startDate: "",
  returnDate: "",
  reason: "Annual Vacation",
  noticeMessage:
    "We are currently on vacation. Store operations and deliveries will resume upon our return! You can still browse our farm-fresh catalog.",
  offlineMode: "browse_only", // "full_offline" | "browse_only"
  autoReopen: true,
  emergencyPhone: "",
  emergencyEmail: "",
  lastUpdated: new Date(),
};

// Authentic Customer Reviews & Store Vacation Controller
// No mock/dummy data seeded.


// -------------------------------------------------------------
// VENDOR VACATION CONTROLLERS
// -------------------------------------------------------------

export async function getVendorVacation(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id || req.vendor?.id;
    let vendor = null;
    if (vendorId) {
      vendor = await Vendor.findOne({
        $or: [
          { id: String(vendorId) },
          { vendorCode: String(vendorId) },
          ...(mongoose.Types.ObjectId.isValid(vendorId) ? [{ _id: vendorId }] : []),
        ],
      });
    }
    if (!vendor) {
      vendor = await Vendor.findOne();
    }

    if (!vendor) {
      return res.json({
        success: true,
        vacation: { ...DEFAULT_VACATION },
        vendorName: "GreenGrocc Vendor",
        status: "STORE_LIVE",
      });
    }

    let vac = vendor.vacation || { ...DEFAULT_VACATION };

    // Auto-reopen check if return date has passed
    if (vac.enabled && vac.autoReopen && vac.returnDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (today > vac.returnDate) {
        vac.enabled = false;
        vac.lastUpdated = new Date();
        vendor.vacation = vac;
        await vendor.save();
      }
    }

    return res.json({
      success: true,
      vacation: vac,
      vendorName: vendor.vendorName || vendor.businessName || vendor.ownerName,
      status: vac.enabled ? "VACATION_OFFLINE" : "STORE_LIVE",
    });
  } catch (err) {
    console.error("[getVendorVacation] Error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch vacation status" });
  }
}

export async function updateVendorVacation(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id || req.vendor?.id;
    let vendor = null;
    if (vendorId) {
      vendor = await Vendor.findOne({
        $or: [
          { id: String(vendorId) },
          { vendorCode: String(vendorId) },
          ...(mongoose.Types.ObjectId.isValid(vendorId) ? [{ _id: vendorId }] : []),
        ],
      });
    }
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Multivendor not found. Contact admin to create your account." });
    }

    const payload = req.body || {};
    const current = vendor.vacation || { ...DEFAULT_VACATION };

    const updated = {
      ...DEFAULT_VACATION,
      ...current,
      enabled: Boolean(payload.enabled),
      startDate: payload.startDate || current.startDate || "",
      returnDate: payload.returnDate || current.returnDate || "",
      reason: payload.reason || current.reason || "Annual Vacation",
      noticeMessage:
        payload.noticeMessage ||
        current.noticeMessage ||
        DEFAULT_VACATION.noticeMessage,
      offlineMode: ["full_offline", "browse_only"].includes(payload.offlineMode)
        ? payload.offlineMode
        : current.offlineMode || "browse_only",
      autoReopen: payload.autoReopen !== undefined ? Boolean(payload.autoReopen) : current.autoReopen,
      emergencyPhone: payload.emergencyPhone !== undefined ? String(payload.emergencyPhone) : current.emergencyPhone,
      emergencyEmail: payload.emergencyEmail !== undefined ? String(payload.emergencyEmail) : current.emergencyEmail,
      lastUpdated: new Date(),
    };

    vendor.vacation = updated;
    await vendor.save();

    return res.json({
      success: true,
      vacation: updated,
      message: updated.enabled
        ? `Vacation Mode activated. Store is set to ${
            updated.offlineMode === "full_offline" ? "Full Offline" : "Catalog Browsing with Vacation Notice"
          } until ${updated.returnDate || "further notice"}.`
        : "Vacation Mode turned off. Your store and products are now live and accepting orders!",
    });
  } catch (err) {
    console.error("[updateVendorVacation] Error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to update vacation settings" });
  }
}

// -------------------------------------------------------------
// VENDOR REVIEWS CONTROLLERS
// -------------------------------------------------------------

export async function getVendorReviews(req, res) {
  try {
    let vendorId = req.user?.vendorId || req.user?.id || req.vendor?.id;
    let vendor = null;
    if (vendorId) {
      vendor = await Vendor.findOne({
        $or: [
          { id: String(vendorId) },
          { vendorCode: String(vendorId) },
          ...(mongoose.Types.ObjectId.isValid(vendorId) ? [{ _id: vendorId }] : []),
        ],
      }).lean();
    }
    if (!vendorId && !vendor) {
      const firstVendor = await Vendor.findOne().lean();
      vendor = firstVendor;
      vendorId = firstVendor?.id || "vendor-1";
    }

    const vendorIdentifiers = [
      vendorId,
      vendor?.id,
      vendor?.vendorCode,
      vendor?._id ? String(vendor._id) : null,
    ].filter(Boolean);

    const baseVendorFilter = {
      vendorId: { $in: vendorIdentifiers },
    };

    const {
      star = "all",
      replyStatus = "all", // "all" | "replied" | "pending"
      search = "",
      sort = "recent", // "recent" | "highest" | "lowest" | "helpful"
    } = req.query;

    const query = { ...baseVendorFilter };

    if (star !== "all" && Number(star) >= 1 && Number(star) <= 5) {
      query.rating = Number(star);
    }

    if (replyStatus === "replied") {
      query["vendorReply.text"] = { $exists: true, $ne: "" };
    } else if (replyStatus === "pending") {
      query.$or = [
        { vendorReply: { $exists: false } },
        { vendorReply: null },
        { "vendorReply.text": { $in: ["", null] } },
      ];
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { customerName: regex },
            { title: regex },
            { comment: regex },
            { productName: regex },
            { orderId: regex },
          ],
        },
      ];
    }

    // Sort options
    let sortObj = { createdAt: -1 };
    if (sort === "highest") sortObj = { rating: -1, createdAt: -1 };
    if (sort === "lowest") sortObj = { rating: 1, createdAt: -1 };
    if (sort === "helpful") sortObj = { helpfulCount: -1, createdAt: -1 };

    const reviews = await VendorReview.find(query).sort(sortObj).lean();

    // Calculate overall stats across ALL authentic reviews of this vendor
    const allVendorReviews = await VendorReview.find(baseVendorFilter).lean();
    const totalReviews = allVendorReviews.length;

    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;
    let freshSum = 0;
    let packSum = 0;
    let delivSum = 0;
    let freshCount = 0;
    let packCount = 0;
    let delivCount = 0;
    let repliedCount = 0;

    allVendorReviews.forEach((r) => {
      const starVal = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5)));
      starCounts[starVal] = (starCounts[starVal] || 0) + 1;
      ratingSum += Number(r.rating) || 0;
      if (r.aspectRatings?.freshness != null) {
        freshSum += Number(r.aspectRatings.freshness);
        freshCount++;
      }
      if (r.aspectRatings?.packaging != null) {
        packSum += Number(r.aspectRatings.packaging);
        packCount++;
      }
      if (r.aspectRatings?.delivery != null) {
        delivSum += Number(r.aspectRatings.delivery);
        delivCount++;
      }
      if (r.vendorReply?.text) repliedCount += 1;
    });

    const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(1)) : 0;
    const recommendationRate =
      totalReviews > 0
        ? Math.round((((starCounts[5] || 0) + (starCounts[4] || 0)) / totalReviews) * 100)
        : 0;

    const aspectAverages = {
      freshness: freshCount > 0 ? Number((freshSum / freshCount).toFixed(1)) : 0,
      packaging: packCount > 0 ? Number((packSum / packCount).toFixed(1)) : 0,
      delivery: delivCount > 0 ? Number((delivSum / delivCount).toFixed(1)) : 0,
    };

    return res.json({
      success: true,
      stats: {
        averageRating,
        totalReviews,
        starCounts,
        recommendationRate,
        repliedCount,
        pendingReplyCount: Math.max(0, totalReviews - repliedCount),
        aspectAverages,
      },
      reviews,
      marketplaceIntegrityPolicy: {
        editableByVendor: false,
        deletableByVendor: false,
        policyNote:
          "In adherence to Gamotech Solutions Private Limited marketplace transparency rules, vendor reviews cannot be edited or deleted by vendors. This guarantees genuine, authentic customer trust.",
      },
    });
  } catch (err) {
    console.error("[getVendorReviews] Error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load reviews" });
  }
}

export async function replyVendorReview(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id || req.vendor?.id;
    const { reviewId } = req.params;
    const { replyText } = req.body;

    if (!replyText || !replyText.trim()) {
      return res.status(400).json({ success: false, message: "Reply text cannot be empty" });
    }

    let review = null;
    if (mongoose.Types.ObjectId.isValid(reviewId)) {
      review = await VendorReview.findById(reviewId);
    }
    if (!review) {
      review = await VendorReview.findOne({ _id: reviewId });
    }
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // STRICT MARKETPLACE INTEGRITY CHECK:
    // Prevent any payload tampering with customer rating, title, or review text
    if (req.body.rating || req.body.comment || req.body.title || req.body.customerName) {
      return res.status(403).json({
        success: false,
        message:
          "Security Policy Violation: Vendor is not permitted to alter customer rating or review text.",
      });
    }

    let vendor = null;
    if (vendorId) {
      vendor = await Vendor.findOne({
        $or: [
          { id: String(vendorId) },
          { vendorCode: String(vendorId) },
          ...(mongoose.Types.ObjectId.isValid(vendorId) ? [{ _id: vendorId }] : []),
        ],
      }).lean();
    }
    const vendorName = vendor?.vendorName || vendor?.businessName || vendor?.ownerName || "Store Executive";

    review.vendorReply = {
      text: replyText.trim(),
      repliedAt: new Date(),
      vendorName,
    };

    await review.save();

    return res.json({
      success: true,
      message: "Your official vendor response has been published to the review.",
      review,
    });
  } catch (err) {
    console.error("[replyVendorReview] Error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to submit review reply" });
  }
}

// -------------------------------------------------------------
// PUBLIC STOREFRONT ENDPOINTS (for customer store page view)
// -------------------------------------------------------------

export async function getPublicStoreReviews(req, res) {
  try {
    const { vendorId } = req.params;
    let vendor = null;
    if (vendorId) {
      vendor = await Vendor.findOne({
        $or: [
          { id: String(vendorId) },
          { vendorCode: String(vendorId) },
          ...(mongoose.Types.ObjectId.isValid(vendorId) ? [{ _id: vendorId }] : []),
        ],
      }).lean();
    }
    const vendorIdentifiers = [
      vendorId,
      vendor?.id,
      vendor?.vendorCode,
      vendor?._id ? String(vendor._id) : null,
    ].filter(Boolean);

    const reviews = await VendorReview.find({
      vendorId: { $in: vendorIdentifiers },
      status: "Approved",
    })
      .sort({ createdAt: -1 })
      .lean();

    const total = reviews.length;
    let ratingSum = 0;
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviews.forEach((r) => {
      ratingSum += Number(r.rating) || 0;
      const s = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5)));
      starCounts[s] = (starCounts[s] || 0) + 1;
    });

    const averageRating = total > 0 ? Number((ratingSum / total).toFixed(1)) : 0;

    return res.json({
      success: true,
      averageRating,
      totalReviews: total,
      starCounts,
      reviews,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createPublicStoreReview(req, res) {
  try {
    const { vendorId } = req.params;
    const {
      customerName,
      customerId,
      customerAvatar,
      rating,
      title,
      comment,
      productName,
      orderId,
      aspectRatings,
    } = req.body;

    const numRating = Number(rating);
    if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }
    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ success: false, message: "Review comment is required" });
    }
    if (!customerName || !String(customerName).trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }

    const review = await VendorReview.create({
      vendorId: String(vendorId),
      customerName: String(customerName).trim(),
      customerId: String(customerId || "").trim(),
      customerAvatar: String(customerAvatar || "").trim(),
      rating: Math.round(numRating),
      title: String(title || "").trim(),
      comment: String(comment).trim(),
      productName: String(productName || "").trim(),
      orderId: String(orderId || "").trim(),
      isVerifiedPurchase: Boolean(orderId),
      aspectRatings: {
        freshness: Math.min(5, Math.max(1, Math.round(Number(aspectRatings?.freshness || numRating)))),
        packaging: Math.min(5, Math.max(1, Math.round(Number(aspectRatings?.packaging || numRating)))),
        delivery: Math.min(5, Math.max(1, Math.round(Number(aspectRatings?.delivery || numRating)))),
      },
      status: "Approved",
    });

    return res.status(201).json({
      success: true,
      message: "Customer review published successfully",
      review,
    });
  } catch (err) {
    console.error("[createPublicStoreReview] Error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create review" });
  }
}

export async function getPublicStoreVacation(req, res) {
  try {
    const { vendorId } = req.params;
    const vendor = await Vendor.findOne({ id: vendorId }).lean();
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const vac = vendor.vacation || { ...DEFAULT_VACATION };
    return res.json({
      success: true,
      vacation: vac,
      vendorName: vendor.vendorName || vendor.businessName || vendor.ownerName,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function purgeLegacySeedVendorReviews() {
  try {
    const dummyNames = [
      "Rameshwar Deshmukh",
      "Sunita Anand Patil",
      "Amit Suresh Joshi",
      "Priya Nilesh Kulkarni",
      "Mahesh B. Gokhale",
      "Vikram R. Shinde",
    ];
    await VendorReview.deleteMany({
      $or: [
        { customerName: { $in: dummyNames } },
        { customerId: { $in: ["cust-101", "cust-102", "cust-103", "cust-104", "cust-105", "cust-106"] } },
      ],
    });
  } catch (_) {}
}

