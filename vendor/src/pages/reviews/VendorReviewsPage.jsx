import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Heart,
  HelpCircle,
  Lock,
  MessageCircle,
  MessageSquare,
  Package,
  RefreshCw,
  Search,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  ThumbsUp,
  User,
  Users,
  X,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  EXCEL_BTN,
  EXCEL_BTN_PRIMARY,
  EXCEL_INPUT,
  EXCEL_PAGE_SUB,
  EXCEL_PAGE_TITLE,
  EXCEL_PANEL,
  EXCEL_PANEL_HEAD,
  EXCEL_SELECT,
} from "../../utils/excelStyles";

function StarDisplay({ rating, max = 5, size = "w-4 h-4", showNumber = false }) {
  const num = Number(rating) || 0;
  const rounded = Math.round(num * 10) / 10;
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center text-amber-400">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`${size} ${
              num > 0 && s <= Math.round(num)
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-100 text-slate-300"
            }`}
          />
        ))}
      </div>
      {showNumber && (
        <span className="ml-1 text-xs font-bold text-slate-800">
          {num > 0 ? rounded.toFixed(1) : "0.0"}
        </span>
      )}
    </div>
  );
}

const QUICK_REPLY_TEMPLATES = [
  "Thank you for trusting our farm-fresh harvest! We strive to maintain the highest grading standards for all orders.",
  "We are delighted that you loved the produce freshness! Looking forward to supplying your next lot.",
  "Thank you for your valuable feedback. We take packaging protection very seriously and have added extra cushioning for transit.",
  "We sincerely appreciate your partnership with our farm collection centre. Have a wonderful harvest season!",
];

export default function VendorReviewsPage() {
  const { vendor } = useVendorAuth();
  const [activeTab, setActiveTab] = useState("reviews"); // "reviews" | "store_preview"
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    recommendationRate: 0,
    repliedCount: 0,
    pendingReplyCount: 0,
    aspectAverages: { freshness: 0, packaging: 0, delivery: 0 },
  });

  // Filters
  const [starFilter, setStarFilter] = useState("all");
  const [replyFilter, setReplyFilter] = useState("all"); // "all" | "replied" | "pending"
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // "recent" | "highest" | "lowest" | "helpful"

  // Reply Modal / Inline State
  const [replyingReviewId, setReplyingReviewId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const res = await vendorApi.getReviews({
        star: starFilter,
        replyStatus: replyFilter,
        search: searchQuery,
        sort: sortBy,
      });

      if (res?.success) {
        setReviews(res.reviews || []);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [starFilter, replyFilter, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadReviews();
  };

  const handleOpenReply = (review) => {
    setReplyingReviewId(review._id);
    setReplyText(review.vendorReply?.text || "");
  };

  const handleSubmitReply = async (reviewId) => {
    if (!replyText.trim()) {
      toast.error("Please enter your official reply text");
      return;
    }

    setSubmittingReply(true);
    try {
      const res = await vendorApi.replyReview(reviewId, replyText);
      if (res?.success) {
        toast.success("Official vendor response published successfully!");
        setReplyingReviewId(null);
        setReplyText("");
        loadReviews();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to submit response");
    } finally {
      setSubmittingReply(false);
    }
  };

  const storeName = vendor?.businessName || vendor?.vendorName || "GreenGrocc Partner Store";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-slate-400">
            <Link to="/dashboard" className="hover:text-emerald-700">Vendor Portal</Link>
            <span className="mx-1.5">/</span>
            <span className="font-semibold text-slate-600">Customer Reviews</span>
          </nav>
          <div className="flex items-center gap-2.5">
            <h1 className={EXCEL_PAGE_TITLE}>Vendor Ratings & Reviews</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              {stats.totalReviews > 0
                ? `${stats.averageRating.toFixed(1)} / 5.0 (${stats.totalReviews} ${stats.totalReviews === 1 ? "Review" : "Reviews"})`
                : "0.0 / 5.0 (0 Reviews)"}
            </span>
          </div>
          <p className={`mt-0.5 ${EXCEL_PAGE_SUB}`}>
            Customer ratings, transparent feedback, and authentic reviews. Powered by Gamotech Solutions Private Limited marketplace integrity.
          </p>
        </div>

        {/* View Switcher: Management vs Public Storefront Preview */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === "reviews"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Manage Reviews</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("store_preview")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === "store_preview"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Store className="h-3.5 w-3.5" />
            <span>Store Page Reviews Tab Preview</span>
          </button>
        </div>
      </div>

      {/* Gamotech Solutions Private Limited Authenticity Guarantee Banner */}
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-4 text-white shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300 backdrop-blur-md">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-white sm:text-base">
                  Marketplace Transparency Guarantee
                </h3>
                <span className="rounded bg-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Gamotech Solutions Private Limited
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                All customer reviews are authentic, verified by order completion, and publicly visible in a dedicated tab on your store page. In compliance with marketplace policy, <strong>reviews cannot be edited or deleted by vendors</strong>, ensuring genuine customer trust and credibility.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <Lock className="h-3 w-3" /> Immutable & Authentic
            </span>
          </div>
        </div>
      </div>

      {activeTab === "store_preview" ? (
        /* ========================================================================= */
        /* TAB 2: STORE PAGE DEDICATED REVIEWS TAB PREVIEW (Public Customer View)    */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Store Page Simulation Container */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Store Cover Header */}
            <div className="h-32 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 relative sm:h-36">
              <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
                <span>Customer Store View</span>
              </div>
            </div>

            {/* Store Info Profile Bar */}
            <div className="px-5 pb-4 pt-0 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 sm:-mt-12">
                <div className="flex items-end gap-3.5">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-emerald-700 text-3xl font-bold text-white shadow-md">
                    {storeName.charAt(0)}
                  </div>
                  <div className="pt-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{storeName}</h2>
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <StarDisplay rating={stats.averageRating} size="w-3.5 h-3.5" showNumber />
                      <span>•</span>
                      <span>
                        {stats.totalReviews} {stats.totalReviews === 1 ? "customer rating" : "customer ratings"}
                      </span>
                      <span>•</span>
                      <span className={stats.totalReviews > 0 ? "text-emerald-700 font-semibold" : "text-slate-400 font-medium"}>
                        {stats.totalReviews > 0 ? `${stats.recommendationRate}% recommended` : "No ratings yet"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Direct Farm Producer
                  </span>
                </div>
              </div>

              {/* Dedicated Navigation Tabs on the Store Page */}
              <div className="mt-6 flex items-center gap-4 border-b border-slate-200 text-xs font-bold sm:text-sm">
                <button type="button" className="pb-3 text-slate-400 hover:text-slate-600">
                  Products
                </button>
                <button type="button" className="pb-3 text-slate-400 hover:text-slate-600">
                  About Store
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 border-b-2 border-emerald-700 pb-3 text-emerald-800"
                >
                  <Star className="h-4 w-4 fill-emerald-700 text-emerald-700" />
                  <span>Reviews ({stats.totalReviews})</span>
                </button>
                <button type="button" className="pb-3 text-slate-400 hover:text-slate-600">
                  Store Policies
                </button>
              </div>

              {/* Content of the Dedicated Reviews Tab */}
              <div className="pt-6 space-y-6">
                {/* Score Summary Box */}
                <div className="grid grid-cols-1 gap-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 md:grid-cols-3">
                  <div className="flex flex-col items-center justify-center border-b border-slate-200 pb-4 md:border-b-0 md:border-r md:pb-0">
                    <span className="text-4xl font-extrabold text-slate-900 sm:text-5xl">
                      {stats.totalReviews > 0 ? stats.averageRating.toFixed(1) : "0.0"}
                    </span>
                    <div className="mt-1.5">
                      <StarDisplay rating={stats.averageRating} size="w-4 h-4" />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {stats.totalReviews > 0
                        ? `Based on ${stats.totalReviews} verified review${stats.totalReviews === 1 ? "" : "s"}`
                        : "No customer reviews yet"}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                      <ThumbsUp className="h-3 w-3" /> {stats.totalReviews > 0 ? `${stats.recommendationRate}% Recommend` : "0% Recommend"}
                    </span>
                  </div>

                  {/* Rating Breakdown Bars */}
                  <div className="space-y-1.5">
                    {[5, 4, 3, 2, 1].map((s) => {
                      const count = stats.starCounts[s] || 0;
                      const pct = stats.totalReviews > 0 ? Math.round((count / stats.totalReviews) * 100) : 0;
                      return (
                        <div key={s} className="flex items-center gap-2 text-xs">
                          <span className="w-6 font-semibold text-slate-600">{s} ★</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-amber-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-[11px] font-medium text-slate-400">
                            {count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Quality & Fulfillment Sub-ratings */}
                  <div className="flex flex-col justify-center gap-2.5 border-t border-slate-200 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Aspect Ratings</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Farm Freshness</span>
                      <span className="font-bold text-emerald-800">
                        {stats.aspectAverages.freshness > 0 ? `${stats.aspectAverages.freshness.toFixed(1)} / 5.0` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Crate Packaging</span>
                      <span className="font-bold text-emerald-800">
                        {stats.aspectAverages.packaging > 0 ? `${stats.aspectAverages.packaging.toFixed(1)} / 5.0` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">On-Time Fulfillment</span>
                      <span className="font-bold text-emerald-800">
                        {stats.aspectAverages.delivery > 0 ? `${stats.aspectAverages.delivery.toFixed(1)} / 5.0` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Reviews Feed (Public View) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Verified Customer Feedback ({reviews.length})
                    </h3>
                  </div>

                  {reviews.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                      <Store className="mx-auto h-10 w-10 text-slate-300" />
                      <h4 className="mt-2 text-sm font-bold text-slate-800">No customer reviews yet</h4>
                      <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                        This store currently has no customer reviews. Ratings and comments from verified buyers will appear here once orders are delivered.
                      </p>
                    </div>
                  ) : (
                    reviews.map((rev) => (
                      <div key={rev._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={rev.customerAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                              alt={rev.customerName}
                              className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-slate-900 sm:text-sm">{rev.customerName}</p>
                                {rev.isVerifiedPurchase && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3" /> Verified Purchase
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <StarDisplay rating={rev.rating} size="w-3.5 h-3.5" />
                                <span className="text-[11px] text-slate-400">
                                  {new Date(rev.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {rev.productName && (
                            <span className="hidden rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 sm:inline-block border border-slate-200">
                              {rev.productName}
                            </span>
                          )}
                        </div>

                        {rev.title && (
                          <h4 className="mt-3 text-xs font-bold text-slate-800 sm:text-sm">{rev.title}</h4>
                        )}
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{rev.comment}</p>

                        {/* Official Vendor Response if present */}
                        {rev.vendorReply?.text && (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                                <Store className="h-3.5 w-3.5" />
                                Official Response from {rev.vendorReply.vendorName || storeName}
                              </span>
                              <span className="text-[10px] text-emerald-700">
                                {new Date(rev.vendorReply.repliedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="mt-1 leading-relaxed text-emerald-950">{rev.vendorReply.text}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* TAB 1: REVIEWS MANAGEMENT CONSOLE (For Vendor)                            */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Rating Overview & Trust Analytics Dashboard */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Overall Rating */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Overall Rating</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  {stats.totalReviews > 0 ? stats.averageRating.toFixed(1) : "0.0"}
                </span>
                <span className="text-xs font-semibold text-slate-400">/ 5.0</span>
              </div>
              <div className="mt-1.5">
                <StarDisplay rating={stats.totalReviews > 0 ? stats.averageRating : 0} size="w-4 h-4" />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-emerald-700">
                {stats.totalReviews > 0
                  ? `★ Based on ${stats.totalReviews} verified rating${stats.totalReviews === 1 ? "" : "s"}`
                  : "Awaiting customer ratings"}
              </p>
            </div>

            {/* Card 2: Total Reviews */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Total Verified Reviews</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  {stats.totalReviews}
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  {stats.totalReviews > 0 ? "100% Verified" : "0 Received"}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {stats.totalReviews > 0
                  ? "Submitted by dark stores, retail buyers, and consumers"
                  : "Ratings submitted after order fulfillment"}
              </p>
              <p className="mt-2 text-[11px] font-medium text-slate-400">
                {stats.totalReviews > 0 ? "Publicly displayed on store page" : "Genuine marketplace data"}
              </p>
            </div>

            {/* Card 3: Recommendation Rate */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Customer Recommendation</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-800 sm:text-4xl">
                  {stats.totalReviews > 0 ? `${stats.recommendationRate}%` : "0%"}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {stats.totalReviews > 0
                  ? "Rated 4 or 5 stars out of total feedback"
                  : "Calculated from 4★ and 5★ buyer reviews"}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{stats.totalReviews > 0 ? "Calculated from completed orders" : "No recommendations yet"}</span>
              </div>
            </div>

            {/* Card 4: Reply Status & Response Rate */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Vendor Reply Rate</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  {stats.totalReviews > 0
                    ? Math.round((stats.repliedCount / stats.totalReviews) * 100)
                    : 0}
                  %
                </span>
                <span className="text-xs text-slate-500">
                  ({stats.repliedCount}/{stats.totalReviews})
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {stats.totalReviews === 0 ? (
                  <span className="text-slate-400">No reviews to answer</span>
                ) : stats.pendingReplyCount > 0 ? (
                  <span className="font-semibold text-amber-700">
                    {stats.pendingReplyCount} review(s) await your response
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-700">All customer reviews answered</span>
                )}
              </p>
              {stats.totalReviews > 0 && (
                <button
                  type="button"
                  onClick={() => setReplyFilter(replyFilter === "pending" ? "all" : "pending")}
                  className="mt-2 text-[11px] font-bold text-emerald-700 hover:underline"
                >
                  {replyFilter === "pending" ? "Show All Reviews →" : "View Pending Replies →"}
                </button>
              )}
            </div>
          </div>

          {/* Search, Filter & Star Select Toolbar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            {/* Star Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 mr-1">Star Rating:</span>
                <button
                  type="button"
                  onClick={() => setStarFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    starFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All ({stats.totalReviews})
                </button>
                {[5, 4, 3, 2, 1].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStarFilter(String(s))}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      starFilter === String(s)
                        ? "bg-amber-500 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>{s}</span>
                    <Star className="h-3 w-3 fill-current" />
                    <span className="opacity-75">({stats.starCounts[s] || 0})</span>
                  </button>
                ))}
              </div>

              {/* Reply Status Toggle */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 mr-1">Reply:</span>
                <select
                  value={replyFilter}
                  onChange={(e) => setReplyFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">All Reviews</option>
                  <option value="replied">Answered by Vendor</option>
                  <option value="pending">Awaiting Reply</option>
                </select>
              </div>
            </div>

            {/* Keyword Search & Sort Form */}
            <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reviews by customer name, product, crop, or keywords..."
                  className={`${EXCEL_INPUT} pl-9 text-xs`}
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`${EXCEL_SELECT} w-auto text-xs`}
              >
                <option value="recent">Most Recent First</option>
                <option value="highest">Highest Rating (5★ → 1★)</option>
                <option value="lowest">Lowest Rating (1★ → 5★)</option>
                <option value="helpful">Most Helpful Reviews</option>
              </select>

              <button
                type="submit"
                className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
              >
                Search
              </button>

              {(searchQuery || starFilter !== "all" || replyFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStarFilter("all");
                    setReplyFilter("all");
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              )}
            </form>
          </div>

          {/* Reviews List */}
          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-700" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
              <MessageSquare className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">
                {stats.totalReviews === 0
                  ? "No customer reviews received yet"
                  : "No reviews match your filters"}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                {stats.totalReviews === 0
                  ? "Customer reviews and 1–5★ ratings will automatically appear here once buyers place and complete orders from your store."
                  : "Try selecting a different star rating or clearing your search term."}
              </p>
              {stats.totalReviews === 0 ? (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-medium text-emerald-800">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Verified Purchases Only • Zero Dummy Data Policy</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStarFilter("all");
                    setReplyFilter("all");
                  }}
                  className="mt-3 text-xs font-bold text-emerald-700 hover:underline"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div
                  key={rev._id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300"
                >
                  {/* Top Bar: Reviewer Info + Rating */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <img
                        src={rev.customerAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                        alt={rev.customerName}
                        className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{rev.customerName}</h3>
                          {rev.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Verified Buyer
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200">
                            <Lock className="h-2.5 w-2.5" /> Authentic Review
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                          <StarDisplay rating={rev.rating} size="w-3.5 h-3.5" showNumber />
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(rev.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Pill */}
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs">
                      {rev.productName && (
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                          {rev.productName}
                        </span>
                      )}
                      {rev.orderId && (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[10px] font-semibold text-slate-600">
                          {rev.orderId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Review Text */}
                  <div className="mt-3.5">
                    {rev.title && (
                      <h4 className="text-sm font-bold text-slate-900">{rev.title}</h4>
                    )}
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
                      {rev.comment}
                    </p>
                  </div>

                  {/* Aspect Ratings Badges */}
                  {rev.aspectRatings && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5 text-[11px]">
                      <span className="text-slate-400 font-semibold">Aspects:</span>
                      <span className="rounded bg-slate-50 px-2 py-0.5 font-medium text-slate-600 border border-slate-200">
                        Freshness: {rev.aspectRatings.freshness || rev.rating}/5
                      </span>
                      <span className="rounded bg-slate-50 px-2 py-0.5 font-medium text-slate-600 border border-slate-200">
                        Packaging: {rev.aspectRatings.packaging || rev.rating}/5
                      </span>
                      <span className="rounded bg-slate-50 px-2 py-0.5 font-medium text-slate-600 border border-slate-200">
                        Fulfillment: {rev.aspectRatings.delivery || rev.rating}/5
                      </span>
                    </div>
                  )}

                  {/* Helpful Count + Authenticity Guard Notice */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <ThumbsUp className="h-3.5 w-3.5 text-slate-400" />
                      {rev.helpfulCount || 0} customers found this review helpful
                    </span>

                    <span className="text-[11px] font-medium text-slate-400 italic">
                      Reviews cannot be edited or deleted by vendors.
                    </span>
                  </div>

                  {/* Official Vendor Response Display / Reply Action */}
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    {rev.vendorReply?.text ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-700 text-white font-bold text-[10px]">
                              ✓
                            </span>
                            <span className="font-bold text-emerald-900">
                              Official Response from {rev.vendorReply.vendorName || storeName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-700 font-medium">
                              {new Date(rev.vendorReply.repliedAt).toLocaleDateString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenReply(rev)}
                              className="text-[11px] font-bold text-emerald-800 underline hover:text-emerald-950"
                            >
                              Edit Reply
                            </button>
                          </div>
                        </div>
                        <p className="mt-1.5 leading-relaxed text-emerald-950 font-medium">
                          {rev.vendorReply.text}
                        </p>
                      </div>
                    ) : (
                      <div>
                        {replyingReviewId !== rev._id ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReply(rev)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 shadow-2xs"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Reply to Customer Feedback</span>
                          </button>
                        ) : null}
                      </div>
                    )}

                    {/* Inline Reply Composer Form */}
                    {replyingReviewId === rev._id && (
                      <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/40 p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                            Compose Official Response for {rev.customerName}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReplyingReviewId(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Quick Reply Preset Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500">Quick Templates:</span>
                          {QUICK_REPLY_TEMPLATES.map((tmpl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setReplyText(tmpl)}
                              className="rounded bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200 hover:border-emerald-600 hover:text-emerald-800"
                            >
                              Template {idx + 1}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your official public reply to this review (visible to all customers on your store page)..."
                          className={`${EXCEL_INPUT} resize-none text-xs`}
                        />

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            Your response will display with an verified vendor partner badge.
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setReplyingReviewId(null)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={submittingReply}
                              onClick={() => handleSubmitReply(rev._id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
                            >
                              <Send className={`h-3 w-3 ${submittingReply ? "animate-spin" : ""}`} />
                              <span>{submittingReply ? "Posting…" : "Publish Reply"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
