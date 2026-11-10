import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  Sprout,
  X,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Award,
  Lock,
  Package,
  Truck,
  Check,
  ArrowRight,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyOrders } from "../../api/api";
import { getOrderDisplayCode, isPlacedOrder } from "../../utils/orderUtils";
import ProductReviews from "./ProductReviews";
import { formatProduceDate, isProduceDate } from "../../utils/produceDates";
import ProductDescriptionContent from "./ProductDescriptionContent";
import { getProductDisplayDetails } from "../../utils/productLocalization";
import OptimizedImg from "../common/OptimizedImg";

function getPreOrderTraceStatus(order) {
  const p = String(order?.preOrderProgress || "").toLowerCase().trim();
  const s = String(order?.status || "").toLowerCase().trim();

  if (s === "delivered" || p === "delivered") {
    return {
      statusKey: "delivered",
      stepIndex: 7,
      badgeText: "Delivered",
      badgeMarathi: "यशस्वीरीत्या पोहोचली (Delivered)",
      badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
      headline: "ऑर्डर यशस्वीरीत्या पोहोचली आहे (Delivered with OTP)",
      step1: true,
      step2: true,
      step3: true,
      step4: true,
      step5: true,
      lineWidth: "w-full",
    };
  }
  if (s === "out_for_delivery" || p === "out_for_delivery") {
    return {
      statusKey: "out_for_delivery",
      stepIndex: 6,
      badgeText: "Out for Delivery",
      badgeMarathi: "डिलिव्हरीसाठी बाहेर पडले (Out for Delivery)",
      badgeColor: "bg-emerald-50 text-[#0a6c38] border-emerald-300 ring-1 ring-emerald-400/40",
      headline: "डिलिव्हरी पार्टनर घराकडे निघाला आहे (Out for Delivery)",
      step1: true,
      step2: true,
      step3: true,
      step4: true,
      step5: false,
      lineWidth: "w-[85%]",
    };
  }
  if (s === "assigned" || s === "pickup_verified" || p === "rider_assigned") {
    return {
      statusKey: "rider_assigned",
      stepIndex: 5,
      badgeText: "Partner Assigned",
      badgeMarathi: "डिलिव्हरी पार्टनर नियुक्त (Partner Assigned)",
      badgeColor: "bg-emerald-50 text-[#0a6c38] border-emerald-200",
      headline: "डार्क स्टोअरमधून डिलिव्हरी पार्टनर नियुक्त करण्यात आला आहे",
      step1: true,
      step2: true,
      step3: true,
      step4: true,
      step5: false,
      lineWidth: "w-[72%]",
    };
  }
  if (p === "at_store" || order?.storeReceivedAt) {
    return {
      statusKey: "at_store",
      stepIndex: 4,
      badgeText: "Reached Dark Store",
      badgeMarathi: "डार्क स्टोअरमध्ये पोहोचले (Reached Dark Store)",
      badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      headline: "ऑर्डर स्थानिक डार्क स्टोअरमध्ये पोहोचली आहे, डिलिव्हरीसाठी सज्ज",
      step1: true,
      step2: true,
      step3: true,
      step4: false,
      step5: false,
      lineWidth: "w-[58%]",
    };
  }
  if (p === "dispatched" || order?.preOrderStage === "forwarded") {
    return {
      statusKey: "dispatched",
      stepIndex: 3,
      badgeText: "In Transit to Dark Store",
      badgeMarathi: "पिकअप मंजूर · डार्क स्टोअरकडे रवाना",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      headline: "संकलन केंद्रातून डार्क स्टोअरकडे रवाना झाली आहे (Pickup Approved)",
      step1: true,
      step2: true,
      step3: true,
      step4: false,
      step5: false,
      lineWidth: "w-[44%]",
    };
  }
  if (p === "preparing" || order?.preOrderStage === "preparing" || order?.preOrderStage === "ready") {
    return {
      statusKey: "preparing",
      stepIndex: 2,
      badgeText: "Collection & Farmer Sourcing",
      badgeMarathi: "संकलन केंद्र व शेतातून ताजी काढणी चालू",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      headline: "शेतकऱ्याकडून ताजी काढणी व संकलन केंद्रात लॅब तपासणी सुरू आहे",
      step1: true,
      step2: true,
      step3: false,
      step4: false,
      step5: false,
      lineWidth: "w-[30%]",
    };
  }
  if (p === "confirmed" || order?.vendorStatus === "confirmed") {
    return {
      statusKey: "confirmed",
      stepIndex: 1,
      badgeText: "Vendor Confirmed",
      badgeMarathi: "व्हेंडरद्वारे कन्फर्म (Vendor Confirmed)",
      badgeColor: "bg-emerald-50 text-[#0a6c38] border-emerald-200",
      headline: "व्हेंडर व उत्पादन व्यवस्थापकाने ऑर्डर स्वीकारली आहे",
      step1: true,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
      lineWidth: "w-[18%]",
    };
  }
  // Default awaiting vendor
  return {
    statusKey: "awaiting_vendor",
    stepIndex: 0,
    badgeText: "Sent to Vendor & Manager",
    badgeMarathi: "व्हेंडरकडे पाठवली (Awaiting Vendor)",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    headline: "ऑर्डर व्हेंडर व उत्पादन व्यवस्थापकाकडे मंजुरीसाठी पाठवली आहे",
    step1: true,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
    lineWidth: "w-[8%]",
  };
}

function getOrderTraceStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  if (s === "delivered") {
    return {
      statusKey: "delivered",
      stepIndex: 4,
      badgeText: "Delivered",
      badgeMarathi: "यशस्वीरीत्या पोहोचली (Delivered)",
      badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
      headline: "ऑर्डर यशस्वीरीत्या पोहोचली आहे (Delivered)",
      step1: true,
      step2: true,
      step3: true,
      step4: true,
      lineWidth: "w-full",
    };
  }
  if (s === "out_for_delivery") {
    return {
      statusKey: "out_for_delivery",
      stepIndex: 3,
      badgeText: "Out for Delivery",
      badgeMarathi: "डिलिव्हरीसाठी बाहेर पडले",
      badgeColor: "bg-emerald-50 text-[#0a6c38] border-emerald-300 ring-1 ring-emerald-400/40",
      headline: "डिलिव्हरी पार्टनर घराकडे निघाला आहे (Out for Delivery)",
      step1: true,
      step2: true,
      step3: true,
      step4: false,
      lineWidth: "w-3/4",
    };
  }
  if (s === "shipping" || s === "shipped") {
    return {
      statusKey: "shipping",
      stepIndex: 2,
      badgeText: "Dispatched",
      badgeMarathi: "रवाना झाले (Dispatched)",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      headline: "ऑर्डर संकलन केंद्रातून रवाना झाली आहे (Dispatched)",
      step1: true,
      step2: true,
      step3: false,
      step4: false,
      lineWidth: "w-1/2",
    };
  }
  if (s === "processing" || s === "packed") {
    return {
      statusKey: "processing",
      stepIndex: 1,
      badgeText: "Packed",
      badgeMarathi: "पॅकिंग व तपासणी पूर्ण (Packed)",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      headline: "ऑर्डरचे पॅकिंग व लॅब तपासणी पूर्ण (Packed)",
      step1: true,
      step2: false,
      step3: false,
      step4: false,
      lineWidth: "w-1/4",
    };
  }
  if (s === "cancelled") {
    return {
      statusKey: "cancelled",
      stepIndex: 0,
      badgeText: "Cancelled",
      badgeMarathi: "रद्द झाले (Cancelled)",
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
      headline: "ही ऑर्डर रद्द करण्यात आली आहे (Cancelled)",
      step1: false,
      step2: false,
      step3: false,
      step4: false,
      lineWidth: "w-0",
    };
  }
  if (s === "return") {
    return {
      statusKey: "return",
      stepIndex: 0,
      badgeText: "Return",
      badgeMarathi: "रिटर्न (Return)",
      badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
      headline: "रिटर्न प्रक्रिया सुरू आहे (Return)",
      step1: true,
      step2: false,
      step3: false,
      step4: false,
      lineWidth: "w-1/4",
    };
  }
  // "confirm" / "confirmed" / "pending" / "order_received"
  return {
    statusKey: "confirmed",
    stepIndex: 1,
    badgeText: "Order Confirmed",
    badgeMarathi: "ऑर्डर कन्फर्म (Confirmed)",
    badgeColor: "bg-emerald-50 text-[#0a6c38] border-emerald-200",
    headline: "ऑर्डर कन्फर्म झाली आहे, शेतातून पॅकिंग व लॅब तपासणी सुरू आहे",
    step1: true,
    step2: false,
    step3: false,
    step4: false,
    lineWidth: "w-[15%]",
  };
}

export function isFarmerTraceabilityEnabled(product) {
  return product?.showFarmerTraceability !== false;
}

function formatRealDateTime(dateStr) {
  if (!dateStr) return "Recently";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Recently";
  return (
    d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
}

export default function ProductFarmerTraceabilitySection({
  product = {},
  specifications = [],
  className = "",
}) {
  const { user, openAuthModal } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      setOrders([]);
      return;
    }
    setLoadingOrders(true);
    getMyOrders()
      .then(({ data }) => {
        if (isMounted) {
          setOrders((data?.data || []).filter(isPlacedOrder));
        }
      })
      .catch(() => {
        if (isMounted) setOrders([]);
      })
      .finally(() => {
        if (isMounted) setLoadingOrders(false);
      });
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Find if user has ordered THIS product
  const matchingOrder = useMemo(() => {
    if (!orders.length || !product?._id) return null;
    const prodIdStr = String(product._id || "").trim();
    const prodNameLower = String(product.name || "").trim().toLowerCase();
    const prodMarathiLower = String(product.marathiName || "").trim().toLowerCase();

    const matchesItem = (it) => {
      if (!it) return false;
      const itId = String(it.product?._id || it.product || it.productId || it._id || "").trim();
      if (prodIdStr && itId && prodIdStr === itId) return true;

      const itName = String(it.name || it.title || "").trim().toLowerCase();
      if (prodNameLower && itName) {
        if (itName === prodNameLower) return true;
        if (itName.length > 3 && (prodNameLower.includes(itName) || itName.includes(prodNameLower))) return true;
      }
      if (prodMarathiLower && itName) {
        if (itName === prodMarathiLower) return true;
        if (itName.length > 3 && (prodMarathiLower.includes(itName) || itName.includes(prodMarathiLower))) return true;
      }
      return false;
    };

    // 1. Try to find an ACTIVE order with this product first (so the customer sees live in-progress delivery status)
    const activeMatch = orders.find((ord) => {
      const s = String(ord.status || "").toLowerCase();
      const isActive = s !== "delivered" && s !== "cancelled" && s !== "return";
      if (!isActive) return false;
      return ord.items?.some(matchesItem);
    });
    if (activeMatch) return activeMatch;

    // 2. Otherwise find the latest placed order containing this product
    return orders.find((ord) => ord.items?.some(matchesItem)) || null;
  }, [orders, product?._id, product?.name, product?.marathiName]);

  const orderedItem = useMemo(() => {
    if (!matchingOrder) return null;
    const prodIdStr = String(product?._id || "").trim();
    const prodNameLower = String(product?.name || "").trim().toLowerCase();
    const prodMarathiLower = String(product?.marathiName || "").trim().toLowerCase();

    const matchesItem = (it) => {
      if (!it) return false;
      const itId = String(it.product?._id || it.product || it.productId || it._id || "").trim();
      if (prodIdStr && itId && prodIdStr === itId) return true;

      const itName = String(it.name || it.title || "").trim().toLowerCase();
      if (prodNameLower && itName) {
        if (itName === prodNameLower) return true;
        if (itName.length > 3 && (prodNameLower.includes(itName) || itName.includes(prodNameLower))) return true;
      }
      if (prodMarathiLower && itName) {
        if (itName === prodMarathiLower) return true;
        if (itName.length > 3 && (prodMarathiLower.includes(itName) || itName.includes(prodMarathiLower))) return true;
      }
      return false;
    };

    return matchingOrder.items?.find(matchesItem) || matchingOrder.items?.[0] || null;
  }, [matchingOrder, product?._id, product?.name, product?.marathiName]);

  const hasOrderedThisProduct = Boolean(matchingOrder);
  const realOrderCode = matchingOrder ? getOrderDisplayCode(matchingOrder) : "";
  const isPreOrderMatch = Boolean(
    matchingOrder?.isPreOrder ||
    matchingOrder?.preOrderSlot ||
    matchingOrder?.preOrderProgress ||
    matchingOrder?.items?.some((it) => it.isPreOrder || it.department === "preorder")
  );
  const realTraceConfig = matchingOrder
    ? (isPreOrderMatch ? getPreOrderTraceStatus(matchingOrder) : getOrderTraceStatus(matchingOrder.status))
    : null;

  const [activeTab, setActiveTab] = useState("details"); // 'details' | 'nutrition' | 'reviews'
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const showFarmerTraceability = isFarmerTraceabilityEnabled(product);

  // Farmer Details extraction from backend product
  const rawFarmerName = String(
    product?.farmerDetails?.name || product?.farmerName || "Vilas Shinde"
  ).trim();
  const farmerName = !rawFarmerName
    ? "श्री. Vilas Shinde"
    : rawFarmerName.startsWith("श्री.") || rawFarmerName.startsWith("श्री ")
    ? rawFarmerName
    : `श्री. ${rawFarmerName}`;

  const farmerLocation = String(
    product?.farmerDetails?.location ||
      product?.farmerLocation ||
      (showFarmerTraceability ? "Shirur, Pune, Maharashtra" : "")
  ).trim();

  const farmerLand = String(
    product?.farmerDetails?.totalArea ||
    product?.farmerDetails?.cultivationArea ||
    product?.farmerDetails?.land ||
    "5 acres"
  ).trim();

  const farmerBio = String(
    product?.farmerDetails?.bio ||
    "Runs a high-density guava orchard and picks fruit at colour break for the best sweetness. Committed to sustainable, residue-tested farming in Shirur, Pune."
  ).trim();

  const farmerExperience = String(
    product?.farmerDetails?.experience || "15+ वर्षे शेतीचा अनुभव"
  ).trim();

  const farmerPhoto =
    product?.farmerImage ||
    product?.farmerDetails?.farmerImage ||
    "";

  const farmerMethod = String(
    product?.farmerDetails?.agricultureMethod || "Pruned high-density orchard, organic mulch (IPM Low Chemical)"
  ).trim();

  const extractVariety = (name = "") => {
    const m = String(name || "").match(/^(?:fresh\s+)?([A-Za-z0-9\s]+?)(?:\s+(?:guava|tomato|onion|banana|apple|mango|potato|peru|chilli|bhindi|okra))/i);
    return m ? m[1].trim() : "";
  };
  const rawVariety = String(
    product?.variety ||
    product?.varietyName ||
    product?.farmerDetails?.variety ||
    product?.farmerDetails?.currentCrop ||
    ""
  ).trim();
  const variety = rawVariety.length > 0
    ? (rawVariety.startsWith("Guava (") ? rawVariety.slice(7, -1) : rawVariety)
    : (extractVariety(product?.name) || "Allahabad Safeda");

  const defaultHarvestDate = matchingOrder?.createdAt
    ? new Date(matchingOrder.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : formatProduceDate("2026-10-25");

  const rawHarvestDate = product?.harvestingDate || product?.farmerDetails?.harvestingDate || "2026-10-25";
  const harvestDate = isProduceDate(rawHarvestDate)
    ? formatProduceDate(rawHarvestDate)
    : formatProduceDate(rawHarvestDate) || defaultHarvestDate;
  const harvestNote = isProduceDate(rawHarvestDate) ? "" : formatProduceDate(rawHarvestDate);

  const rawPackingDate = product?.packingDate || product?.harvestingDate || "2026-10-25";
  const packingDate = isProduceDate(rawPackingDate)
    ? formatProduceDate(rawPackingDate)
    : formatProduceDate(rawPackingDate) || harvestDate;

  const farmerCrops = Array.isArray(product?.farmerDetails?.crops)
    ? product.farmerDetails.crops.filter((item) => item?.name || item?.variety || item?.area)
    : [];
  const primaryCrop = farmerCrops[0]?.name || variety;

  const productNameDisplay =
    String(product?.name || "").trim() ||
    getProductDisplayDetails(product).primaryTitle ||
    "Fresh produce";

  const inStock = product?.stock !== undefined ? product.stock > 0 : product?.inStock !== false;

  const productStatusBadge = inStock
    ? "ताजी आवक · उपलब्ध (In Stock)"
    : "काढणी चालू (Harvesting)";

  const productStatusHeadline = inStock
    ? "शेतातून ताजी आवक · १० मिनिटांत डिलिव्हरी सज्ज"
    : "नवीन ताजी काढणी लवकरच उपलब्ध होईल";

  const productLotCode = `LOT-${String(product?._id || "7849").slice(-5).toUpperCase()}`;

  const savedNutrition = Array.isArray(product?.nutritionFacts)
    ? product.nutritionFacts.filter((item) => item?.label || item?.value)
    : [];
  const nutritionFacts = savedNutrition.length
    ? savedNutrition
    : [
        { label: "Energy", value: "354 kcal" },
        { label: "Carbohydrates", value: "65 g" },
        { label: "Dietary Fiber", value: "21 g" },
        { label: "Protein", value: "7.8 g" },
        { label: "Total Fat", value: "3.2 g" },
        { label: "Curcumin (Active)", value: "4.5% High" },
        { label: "Iron", value: "41.4 mg (230% DV)" },
        { label: "Potassium", value: "2525 mg" },
        { label: "Pesticides / Residue", value: "0.0% (Zero)" },
      ];
  const nutritionNote = String(
    product?.nutritionNote ||
      "* Based on certified farm gate batch laboratory analysis. 100% natural and unadulterated."
  ).trim();

  return (
    <div className={`space-y-4 sm:space-y-5 ${className}`}>
      {showFarmerTraceability ? (
        <>
      {/* ====================================================
          1. MEET YOUR FARMER CARD
          ==================================================== */}
      <div>
        <h3 className="text-[16px] sm:text-[18px] font-bold text-slate-900 tracking-tight mb-2.5">
          Meet Your Farmer
        </h3>

        <div className="@container relative overflow-hidden rounded-2xl border border-[#ddeadb] bg-white p-3 shadow-xs sm:p-4">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-28 opacity-20 @[20rem]:block @[36rem]:w-36">
            <svg viewBox="0 0 100 100" fill="none" className="h-full w-full text-[#15803d]">
              <path
                d="M50 10 C65 25 80 50 65 75 C55 90 40 85 30 70 C20 55 35 25 50 10 Z"
                fill="currentColor"
              />
              <path
                d="M70 30 C80 40 90 60 80 75 C70 85 60 80 55 70"
                fill="currentColor"
              />
            </svg>
          </div>

          <div className="relative z-10 flex min-w-0 flex-col gap-3 @[20rem]:flex-row @[20rem]:items-center @[20rem]:gap-4 @[36rem]:gap-6">
            <div className="aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl border border-emerald-100/80 bg-emerald-50 shadow-xs @[20rem]:aspect-[5/3] @[20rem]:w-[44%] @[20rem]:max-w-[17rem] @[36rem]:w-1/2 @[36rem]:max-w-[24rem]">
              <OptimizedImg
                src={farmerPhoto || "/assets/farmer/mobile_farmer_photo.png"}
                alt=""
                className="h-full w-full object-cover @[20rem]:hidden"
              />
              <OptimizedImg
                src={farmerPhoto || "/assets/farmer/desktop_farmer_photo.png"}
                alt={farmerName}
                className="hidden h-full w-full object-cover @[20rem]:block"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-balance text-[17px] font-black leading-tight tracking-tight text-[#0a6c38] @[24rem]:text-xl @[36rem]:text-[22px]">
                {farmerName}
              </h4>

              <div className="mt-2 space-y-1.5 text-[12px] text-gray-700 @[24rem]:text-[13px]">
                <div className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0a6c38] @[24rem]:h-4 @[24rem]:w-4" />
                  <span className="min-w-0 font-medium text-slate-700">{farmerLocation}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0a6c38] @[24rem]:h-4 @[24rem]:w-4" />
                  <span className="min-w-0 font-medium text-slate-700">{farmerLand}</span>
                </div>
              </div>

              <Link
                to="/farmer-profile"
                state={{
                  farmer: {
                    name: farmerName,
                    location: farmerLocation,
                    land: farmerLand,
                    bio: farmerBio,
                    experience: farmerExperience,
                    method: farmerMethod,
                    farmerImage: farmerPhoto,
                    farmImage: product?.farmerDetails?.farmImage || product?.farmImage || "",
                    soilType: product?.farmerDetails?.soilType || "Red lateritic soil",
                    waterSource: product?.farmerDetails?.waterSource || "Borewell with drip",
                    crops: farmerCrops,
                  },
                }}
                className="mt-2.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#0a6c38] px-3.5 py-1.5 text-[12px] font-bold text-[#0a6c38] shadow-xs transition-all hover:bg-[#0a6c38] hover:text-white active:scale-95 @[24rem]:mt-3.5 @[24rem]:px-5 @[24rem]:text-[13px]"
              >
                <span>View Profile</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================
          2. PRODUCT TRACEABILITY CARD (Only rendered when ordered)
          ==================================================== */}
      {hasOrderedThisProduct && realTraceConfig && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[16px] sm:text-[18px] font-bold text-slate-900 tracking-tight">
              Product Traceability
            </h3>
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black ${realTraceConfig.badgeColor}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <span>Real Order #{realOrderCode} · {realTraceConfig.badgeText}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300 bg-white p-3.5 sm:p-4 shadow-xs relative overflow-hidden transition hover:shadow-sm">
            <div className="flex items-center justify-between gap-3 sm:gap-4 relative z-10">
              {/* Left: QR Code + Real Order Text */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div
                  onClick={() => setShowTraceModal(true)}
                  className="w-[68px] sm:w-[76px] h-[68px] sm:h-[76px] rounded-xl border border-emerald-200 p-1 bg-white shadow-xs shrink-0 flex items-center justify-center cursor-pointer hover:border-emerald-400 transition"
                  title="Click to view real order traceability"
                >
                  <OptimizedImg
                    src="/assets/farmer/traceability_qr_code.png"
                    alt="Product Traceability QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-[14px] sm:text-[15px] text-slate-900 leading-snug">
                      Live Order #{realOrderCode}
                    </h4>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0a6c38] border border-emerald-200/60 truncate max-w-[170px]">
                      {productNameDisplay} × {orderedItem?.quantity || 1}
                    </span>
                  </div>

                  {/* Real Order Live Headline */}
                  <p className="text-[11.5px] sm:text-[12.5px] text-emerald-800 font-bold mt-0.5 leading-snug flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0a6c38] shrink-0" />
                    <span className="truncate">{realTraceConfig.headline}</span>
                  </p>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <Link
                      to={`/orders/${matchingOrder._id}`}
                      className="text-[#0a6c38] font-black text-[12px] sm:text-[13px] inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Track Live Order</span>
                      <span>→</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowTraceModal(true)}
                      className="text-slate-500 font-semibold text-[11px] sm:text-[12px] hover:text-slate-800 cursor-pointer"
                    >
                      (View Traceability Details)
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Journey Path Map */}
              <div
                onClick={() => setShowTraceModal(true)}
                className="hidden md:block shrink-0 h-14 lg:h-16 max-w-[240px] opacity-90 select-none cursor-pointer hover:opacity-100 transition"
              >
                <OptimizedImg
                  src="/assets/farmer/traceability_journey_map.png"
                  alt="Farm to Home Traceability Journey"
                  className="h-full w-auto object-contain"
                />
              </div>
            </div>

            {/* Dynamic Stepper reflecting matchingOrder status (Pre-Order or Standard) */}
            {isPreOrderMatch ? (
              <div className="mt-3 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-[10px] sm:text-[11px] gap-1 overflow-x-auto">
                <div className={`flex items-center gap-1 shrink-0 ${realTraceConfig.stepIndex >= 0 ? "font-bold text-[#0a6c38]" : "text-gray-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${realTraceConfig.stepIndex >= 0 ? "bg-[#0a6c38]" : "bg-gray-300"}`} />
                  <span>1. ऑर्डर/व्हेंडर</span>
                </div>
                <span className="text-gray-300">→</span>
                <div className={`flex items-center gap-1 shrink-0 ${realTraceConfig.stepIndex >= 1 ? "font-bold text-[#0a6c38]" : "text-gray-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${realTraceConfig.stepIndex >= 1 ? "bg-[#0a6c38]" : "bg-gray-300"}`} />
                  <span>2. व्हेंडर कन्फर्म</span>
                </div>
                <span className="text-gray-300">→</span>
                <div className={`flex items-center gap-1 shrink-0 ${realTraceConfig.stepIndex >= 2 ? "font-bold text-[#0a6c38]" : "text-gray-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${realTraceConfig.stepIndex >= 2 ? "bg-[#0a6c38]" : "bg-gray-300"}`} />
                  <span>3. संकलन/शेतकरी</span>
                </div>
                <span className="text-gray-300">→</span>
                <div className={`flex items-center gap-1 shrink-0 ${realTraceConfig.stepIndex >= 4 ? "font-bold text-[#0a6c38]" : "text-gray-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${realTraceConfig.stepIndex >= 4 ? "bg-[#0a6c38]" : "bg-gray-300"}`} />
                  <span>4. डार्क स्टोअर</span>
                </div>
                <span className="text-gray-300">→</span>
                <div
                  className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full border ${
                    realTraceConfig.stepIndex >= 6
                      ? "bg-emerald-50 text-[#0a6c38] border-emerald-200 font-extrabold"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${realTraceConfig.stepIndex >= 6 ? "bg-[#0a6c38]" : "bg-gray-300"}`} />
                  <span>5. {realTraceConfig.stepIndex >= 7 ? "डिलिव्हर झाले" : "डिलिव्हरी"}</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-[10.5px] sm:text-[11.5px] gap-1 overflow-x-auto">
                <div className={`flex items-center gap-1 shrink-0 ${realTraceConfig.step1 ? "font-bold text-[#0a6c38]" : "text-gray-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${realTraceConfig.step1 ? "bg-[#0a6c38]" : "bg-gray-300"}`} />
                  <span>1. काढणी व ऑर्डर</span>
                </div>
                <span className="text-gray-300">→</span>
                <div className={`flex items-center gap-1 shrink-0 ${realTraceConfig.step2 ? "font-bold text-[#0a6c38]" : "text-gray-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${realTraceConfig.step2 ? "bg-[#0a6c38]" : "bg-gray-300"}`} />
                  <span>2. लॅब तपासणी</span>
                </div>
                <span className="text-gray-300">→</span>
                <div className={`flex items-center gap-1 shrink-0 ${realTraceConfig.step3 ? "font-bold text-[#0a6c38]" : "text-gray-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${realTraceConfig.step3 ? "bg-[#0a6c38]" : "bg-gray-300"}`} />
                  <span>3. पॅक / ऑन द वे</span>
                </div>
                <span className="text-gray-300">→</span>
                <div
                  className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full border ${
                    realTraceConfig.step4
                      ? "bg-emerald-50 text-[#0a6c38] border-emerald-200 font-extrabold"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  {realTraceConfig.stepIndex === 3 ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0a6c38] animate-ping" />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${realTraceConfig.step4 ? "bg-[#0a6c38]" : "bg-gray-300"}`} />
                  )}
                  <span>4. {realTraceConfig.step4 ? "डिलिव्हर झाले" : "डिलिव्हरी"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      ) : null}

      {/* ====================================================
          3. TABS CONTAINER (Details, Nutrition, Reviews)
          ==================================================== */}
      <div className="pt-1">
        {/* Pill Tabs Selector */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 rounded-xl bg-slate-100/70 border border-slate-200/60 mb-3.5">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`py-2 px-2 sm:px-4 rounded-lg font-bold text-xs sm:text-[13px] transition-all duration-150 text-center cursor-pointer ${
              activeTab === "details"
                ? "bg-[#ccead7] text-[#0a6c38] shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("nutrition")}
            className={`py-2 px-2 sm:px-4 rounded-lg font-bold text-xs sm:text-[13px] transition-all duration-150 text-center cursor-pointer ${
              activeTab === "nutrition"
                ? "bg-[#ccead7] text-[#0a6c38] shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            Nutrition
          </button>
          <button
            id="product-reviews-tab"
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={`py-2 px-2 sm:px-4 rounded-lg font-bold text-xs sm:text-[13px] transition-all duration-150 text-center cursor-pointer ${
              activeTab === "reviews"
                ? "bg-[#ccead7] text-[#0a6c38] shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            Reviews
          </button>
        </div>

        {/* TAB 1: PRODUCT INFORMATION (Exact match to screenshot) */}
        {activeTab === "details" && (
          <div className="rounded-2xl border border-[#ddeadb] bg-white p-4 sm:p-5 lg:p-6 shadow-xs relative">
            <h3 className="text-[16px] sm:text-[18px] font-bold text-slate-900 mb-4 sm:mb-5">
              Product Information
            </h3>

            <div>
              <div className="space-y-2.5 text-[12.5px] sm:text-[13.5px]">
                {/* Product Name */}
                <div className="grid grid-cols-[105px_15px_1fr] sm:grid-cols-[125px_15px_1fr] items-baseline">
                  <span className="text-slate-500 font-medium">Product Name</span>
                  <span className="text-slate-400">:</span>
                  <span className="font-semibold text-slate-900">{productNameDisplay}</span>
                </div>

                {/* Variety */}
                <div className="grid grid-cols-[105px_15px_1fr] sm:grid-cols-[125px_15px_1fr] items-baseline">
                  <span className="text-slate-500 font-medium">Variety</span>
                  <span className="text-slate-400">:</span>
                  <span className="font-semibold text-slate-900">{variety}</span>
                </div>

                {/* Harvest Date */}
                <div className="grid grid-cols-[105px_15px_1fr] sm:grid-cols-[125px_15px_1fr] items-baseline">
                  <span className="text-slate-500 font-medium">Harvest Date</span>
                  <span className="text-slate-400">:</span>
                  <span className="font-semibold text-slate-900">
                    {harvestDate}
                    {harvestNote ? (
                      <span className="block text-[11px] sm:text-[12px] font-medium text-slate-500">
                        {harvestNote}
                      </span>
                    ) : null}
                  </span>
                </div>

                {/* Packing Date */}
                <div className="grid grid-cols-[105px_15px_1fr] sm:grid-cols-[125px_15px_1fr] items-baseline">
                  <span className="text-slate-500 font-medium">Packing Date</span>
                  <span className="text-slate-400">:</span>
                  <span className="font-semibold text-slate-900">{packingDate}</span>
                </div>

                {farmerLocation ? (
                <div className="grid grid-cols-[105px_15px_1fr] sm:grid-cols-[125px_15px_1fr] items-baseline">
                  <span className="text-slate-500 font-medium">Source</span>
                  <span className="text-slate-400">:</span>
                  <span className="font-semibold text-slate-900">{farmerLocation}</span>
                </div>
                ) : null}

                {/* Status */}
                <div className="grid grid-cols-[105px_15px_1fr] sm:grid-cols-[125px_15px_1fr] items-center">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="text-slate-400">:</span>
                  <div className="flex items-center gap-1.5 font-bold text-[#0a6c38]">
                    <span className="w-2 h-2 rounded-full bg-[#0a6c38] animate-pulse" />
                    <span>
                      {hasOrderedThisProduct && realTraceConfig
                        ? `ऑर्डर: ${realTraceConfig.badgeMarathi || realTraceConfig.badgeText}`
                        : productStatusBadge}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Specifications & Description (if available) */}
            {product?.description && (
              <div className="mt-5 pt-4 border-t border-slate-100 text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                <ProductDescriptionContent
                  description={product.description}
                  features={product.features}
                  fallback={`Fresh ${product.name} sourced directly from verified local farms.`}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NUTRITION */}
        {activeTab === "nutrition" && (
          <div className="rounded-2xl border border-[#ddeadb] bg-white p-4 sm:p-5 shadow-xs">
            <h3 className="text-[16px] sm:text-[18px] font-bold text-slate-900 mb-3">
              Nutritional Facts (Per 100g)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {nutritionFacts.map((n) => (
                <div key={`${n.label}-${n.value}`} className="p-2.5 rounded-xl bg-[#f4faf5] border border-emerald-100/70">
                  <p className="text-[11px] text-gray-500 font-medium">{n.label}</p>
                  <p className="text-[13px] sm:text-sm font-bold text-emerald-800 mt-0.5">{n.value}</p>
                </div>
              ))}
            </div>
            {nutritionNote ? (
              <p className="mt-3 text-[11px] text-slate-400">{nutritionNote}</p>
            ) : null}
          </div>
        )}

        {/* TAB 3: REVIEWS */}
        {activeTab === "reviews" && (
          <div className="rounded-2xl border border-[#ddeadb] bg-white p-4 sm:p-5 shadow-xs">
            <ProductReviews productId={product._id} />
          </div>
        )}
      </div>

      {/* ====================================================
          MODAL 1: FARMER PROFILE MODAL
          ==================================================== */}
      {showFarmerTraceability && showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden">
            {/* Header */}
            <div className="relative h-32 sm:h-36 bg-gradient-to-r from-[#0a6c38] to-[#15803d] flex items-end p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-emerald-50 shrink-0">
                  <OptimizedImg
                    src={farmerPhoto || "/assets/farmer/mobile_farmer_photo.png"}
                    alt={farmerName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-white">
                  <h3 className="font-extrabold text-lg sm:text-xl leading-tight">{farmerName}</h3>
                  <p className="text-xs text-emerald-100 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{farmerLocation}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-[#f4faf5] border border-emerald-150">
                  <p className="text-[11px] text-gray-500 font-medium">शेतीचे क्षेत्र (Farm Size)</p>
                  <p className="text-sm font-bold text-emerald-900 mt-0.5">{farmerLand}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#f4faf5] border border-emerald-150">
                  <p className="text-[11px] text-gray-500 font-medium">शेती पद्धत (Method)</p>
                  <p className="text-sm font-bold text-emerald-900 mt-0.5">{farmerMethod}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#f4faf5] border border-emerald-150">
                  <p className="text-[11px] text-gray-500 font-medium">मुख्य पीक (Primary Crop)</p>
                  <p className="text-sm font-bold text-emerald-900 mt-0.5">{primaryCrop}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#f4faf5] border border-emerald-150">
                  <p className="text-[11px] text-gray-500 font-medium">अनुभव (Experience)</p>
                  <p className="text-sm font-bold text-emerald-900 mt-0.5">{farmerExperience}</p>
                </div>
              </div>

              {farmerCrops.length > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-[#f4faf5] p-3">
                  <h5 className="font-bold text-xs text-slate-800 mb-2">पिके (Crops)</h5>
                  <div className="space-y-2">
                    {farmerCrops.map((crop, idx) => (
                      <div key={`${crop.name}-${idx}`} className="flex items-start justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-emerald-950">{crop.name || crop.variety}</p>
                          {crop.variety ? <p className="text-slate-500">Variety: {crop.variety}</p> : null}
                        </div>
                        <div className="text-right text-slate-600">
                          {crop.area ? <p>{crop.area}</p> : null}
                          {crop.status ? <p className="font-semibold text-emerald-800">{crop.status}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <h5 className="font-bold text-xs text-slate-800 mb-1">शेतकऱ्याचा संदेश (Farmer Note)</h5>
                <p className="text-xs text-slate-600 leading-relaxed">
                  "{farmerBio}"
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold bg-[#eef8f1] p-2.5 rounded-xl border border-emerald-200/60">
                <ShieldCheck className="w-4 h-4 text-[#0a6c38] shrink-0" />
                <span>GreenGrocc प्रमाणित शेतकरी भागीदार (Verified Partner)</span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-gray-50 border-t border-gray-150 flex justify-end">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-5 py-1.5 rounded-full bg-[#0a6c38] text-white font-bold text-xs hover:bg-[#07522a] transition-all cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL 2: PRODUCT TRACEABILITY JOURNEY MODAL (Real Order Only)
          ==================================================== */}
      {showFarmerTraceability && showTraceModal && hasOrderedThisProduct && matchingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-[#0a6c38] to-[#15803d] text-white">
              <div>
                <h4 className="font-extrabold text-base sm:text-lg leading-tight">
                  Live Order Traceability · #{realOrderCode}
                </h4>
                <p className="text-xs text-emerald-100 mt-0.5">
                  {productNameDisplay} चा थेट शेतापासून तुमच्या दारापर्यंतचा प्रवास
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTraceModal(false)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* REAL ORDER BANNER */}
            <div className="p-3 sm:p-4 bg-[#f8fbf9] border-b border-emerald-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {product?.image ? (
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 p-0.5 shrink-0 overflow-hidden">
                    <OptimizedImg src={product.image} alt={productNameDisplay} className="w-full h-full object-cover rounded-lg" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-[#0a6c38] flex items-center justify-center text-xl shrink-0">
                    🥬
                  </div>
                )}
                <div className="min-w-0">
                  <h5 className="font-extrabold text-sm text-slate-900 truncate">
                    {productNameDisplay} × {orderedItem?.quantity || 1}
                  </h5>
                  <p className="text-[11px] text-slate-500 truncate">
                    ऑर्डर दिनांक: {formatRealDateTime(matchingOrder.createdAt)}
                  </p>
                  <p className="text-[10px] text-emerald-700 font-bold font-mono">
                    Order: #{realOrderCode} · ₹{matchingOrder.total}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${realTraceConfig?.badgeColor}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>{realTraceConfig?.badgeText}</span>
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-4 sm:p-5 space-y-4 max-h-[55vh] overflow-y-auto">
              {[
                {
                  step: `1. शेतातील काढणी व ऑर्डर बुकिंग (Harvest & Placed)`,
                  desc: `${farmerName} (${farmerLocation}) यांच्या शेतातून सेंद्रिय पद्धतीने ताजी काढणी करून ऑर्डर बुक झाली.`,
                  date: formatRealDateTime(matchingOrder.createdAt),
                  place: farmerLocation,
                  status: "पूर्ण (Placed)",
                  statusColor: "text-[#0a6c38] bg-emerald-50",
                  icon: "🌱",
                },
                {
                  step: "2. प्रतवारी आणि स्वच्छता (Sorting & Grading)",
                  desc: `Grade-A गुणवत्तेच्या ${productNameDisplay} ची निवड व नैसर्गिक स्वच्छता पूर्ण.`,
                  date: "संकलन केंद्र",
                  place: `${farmerLocation.split(',')[0]} संकलन केंद्र`,
                  status: realTraceConfig?.step2 ? "पूर्ण (Passed)" : "प्रक्रियाधीन",
                  statusColor: realTraceConfig?.step2 ? "text-[#0a6c38] bg-emerald-50" : "text-slate-600 bg-gray-100",
                  icon: "🚜",
                },
                {
                  step: "3. गुणवत्ता व लॅब तपासणी (Quality Lab Tested)",
                  desc: "Zero chemical residues, 100% NPOP सेंद्रिय मानके उत्तीर्ण. FSSAI सुरक्षा प्रमाणित.",
                  date: packingDate,
                  place: "GreenGrocc क्वालिटी लॅब",
                  status: realTraceConfig?.step2 ? "प्रमाणित (Certified)" : "प्रतीक्षेत",
                  statusColor: realTraceConfig?.step2 ? "text-[#0a6c38] bg-emerald-50" : "text-slate-600 bg-gray-100",
                  icon: "🔬",
                },
                {
                  step: "4. सुरक्षित पॅकिंग (Hygienic Eco-Packaging)",
                  desc: "अन्न सुरक्षा मानकांनुसार सीलबंद इको-फ्रेंडली सुरक्षित पॅकिंग.",
                  date: packingDate,
                  place: "सेंट्रल पॅकिंग युनिट",
                  status: realTraceConfig?.step3 ? "सीलबंद (Sealed)" : "प्रतीक्षेत",
                  statusColor: realTraceConfig?.step3 ? "text-[#0a6c38] bg-emerald-50" : "text-slate-600 bg-gray-100",
                  icon: "📦",
                },
                {
                  step: "5. डिलिव्हरी (Doorstep Delivery)",
                  desc: realTraceConfig?.headline,
                  date: "थेट ट्रॅकिंग",
                  place: matchingOrder.deliveryAddress?.city || matchingOrder.deliveryAddress?.addressLine1 || "तुमचा पत्ता",
                  status: realTraceConfig?.badgeText,
                  statusColor: "text-white bg-[#0a6c38]",
                  icon: "🚚",
                },
              ].map((t, idx) => (
                <div key={t.step} className="flex gap-3 relative">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full border text-sm flex items-center justify-center shrink-0 ${
                        idx <= (realTraceConfig?.stepIndex || 0)
                          ? "bg-[#eef8f1] border-emerald-300 text-[#0a6c38]"
                          : "bg-gray-50 border-gray-200 text-gray-400"
                      }`}
                    >
                      {t.icon}
                    </div>
                    {idx < 4 && (
                      <div
                        className={`w-0.5 flex-1 my-1 ${
                          idx < (realTraceConfig?.stepIndex || 0)
                            ? "bg-emerald-300"
                            : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="font-bold text-xs sm:text-sm text-slate-900">{t.step}</h5>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${t.statusColor}`}>
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{t.desc}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 font-medium">
                      <span>📅 {t.date}</span>
                      <span>📍 {t.place}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-gray-50 border-t border-gray-150 flex items-center justify-between gap-2">
              <span className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-[#0a6c38]" />
                100% Farm Verified Traceability
              </span>

              <Link
                to={`/orders/${matchingOrder._id}`}
                className="px-4 py-1.5 rounded-full bg-[#0a6c38] text-white font-bold text-xs hover:bg-[#07522a] transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <span>Track Full Order</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
