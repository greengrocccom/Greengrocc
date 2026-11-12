import mongoose from "mongoose";
import {
  Farmer,
  FarmerManager,
  FarmerOrder,
  Pickup,
  QualityInspection,
  Vendor,
  VendorStockBatch,
} from "../../../farmer-manager-service/src/models.js";
import Product from "../../../legacy/models/Product.js";
import Order from "../../../legacy/models/order/Order.js";
import User from "../../../legacy/models/user.js";
import Payment from "../../../legacy/models/payment/Payment.js";
import StoreOrder from "../../../delivery-service/src/models/StoreOrder.js";
import DeliveryBoy from "../../../delivery-service/src/models/DeliveryBoy.js";
import DeliveryManager from "../../../delivery-service/src/models/DeliveryManager.js";
import OrderFeedback from "../../../delivery-service/src/models/OrderFeedback.js";
import ReturnPickup from "../../../delivery-service/src/models/ReturnPickup.js";
import { InventoryBatch } from "../../../admin-ops-service/src/models.js";

const CUSTOMER_FIELDS = "name email phone role status isActive isBlocked rewardPoints createdAt";
const PRODUCT_FIELDS =
  "name sku productId departmentId brandName category categories subcategory unit price discountedPrice " +
  "productImages section storeType varietyName farmerName farmerLocation farmerImage farmImage " +
  "harvestingDate packingDate certification farmerDetails showFarmerTraceability";
const DARK_STORE_FIELDS =
  "name email phone storeName storeAddress area city state pincode latitude longitude vendorId zoneName isActive";
const RIDER_FIELDS =
  "name phone city area vehicleType vehicleNumber rating status employmentType createdAt";
// Identity documents, bank details and credentials never leave the farmer record.
const FARMER_HIDDEN_FIELDS = "-password -fcmTokens -aadhaarNumber -panNumber -bank";
const FIELD_MANAGER_FIELDS = "id managerCode name mobile email city state location collectionCentreId status";
const VENDOR_FIELDS =
  "id vendorCode vendorName ownerName mobile phone email businessName businessAddress city state pincode vendorType status";

/** How far back a vendor's farmer supply counts as the likely source of an order's produce. */
const VENDOR_SUPPLY_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Store-order timestamps in the order a delivery moves through them. */
const STORE_ORDER_STAGES = [
  ["createdAt", "Received at dark store"],
  ["vendorConfirmedAt", "Vendor confirmed pre-order"],
  ["preparingAt", "Product manager started preparing"],
  ["readyAt", "Pre-order ready"],
  ["forwardedAt", "Forwarded to dark store"],
  ["storeReceivedAt", "Goods received at dark store"],
  ["packedAt", "Packed"],
  ["assignedAt", "Rider assigned"],
  ["pickupQrScannedAt", "Rider scanned pickup QR"],
  ["pickupVerifiedAt", "Pickup verified by store"],
  ["customerOtpVerifiedAt", "Customer OTP verified"],
  ["deliveredAt", "Delivered"],
  ["failedAt", "Delivery failed"],
];

const toId = (value) => (value ? String(value) : "");
const uniq = (values) => [...new Set(values.filter(Boolean).map(String))];
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function addressLine(addr = {}) {
  return [
    addr.shopNo,
    addr.shopName,
    addr.fullAddress,
    addr.landmark,
    addr.area,
    addr.city,
    addr.state,
    addr.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

function event(at, title, detail = "", actor = "") {
  return at ? { at, title, detail, actor } : null;
}

/** A storefront order from its 6-digit number, Mongo id, or a dark-store order number. */
export async function findStorefrontOrder(query) {
  const raw = String(query || "").trim().replace(/^#+/, "");
  if (!raw) return null;
  const digits = raw.match(/^GG[-_]?(\d{6})$/i)?.[1] || raw;

  if (mongoose.isValidObjectId(raw)) {
    const byId = await Order.findById(raw).lean();
    if (byId) return byId;
    const storeOrder = await StoreOrder.findById(raw).select("sourceOrderId").lean();
    if (storeOrder?.sourceOrderId) return Order.findById(storeOrder.sourceOrderId).lean();
  }

  const byNumber = await Order.findOne({ orderNumber: digits }).lean();
  if (byNumber) return byNumber;

  const storeOrder = await StoreOrder.findOne({ orderNumber: raw }).select("sourceOrderId").lean();
  if (storeOrder?.sourceOrderId) return Order.findById(storeOrder.sourceOrderId).lean();
  return null;
}

async function findFarmersByIds(ids) {
  const list = uniq(ids);
  if (!list.length) return [];
  return Farmer.find({
    $or: [{ id: { $in: list } }, { farmerId: { $in: list } }, { farmerCode: { $in: list } }],
    isDeleted: { $ne: true },
  })
    .select(FARMER_HIDDEN_FIELDS)
    .lean();
}

async function findFarmersByNames(names) {
  const list = uniq(names);
  if (!list.length) return [];
  return Farmer.find({
    $or: list.map((name) => ({ name: new RegExp(`^${escapeRegex(name)}$`, "i") })),
    isDeleted: { $ne: true },
  })
    .select(FARMER_HIDDEN_FIELDS)
    .lean();
}

function farmerKey(farmer) {
  return farmer?.id || farmer?.farmerId || toId(farmer?._id);
}

/** Whether a farmer order or stock lot is for this order line (by id, SKU or product name). */
function matchesLine(record, { productId, sku, legacyId, name }) {
  const ids = [
    record.productId,
    record.sku,
    ...(record.products || []).flatMap((p) => [p.productId, p.id]),
  ]
    .filter(Boolean)
    .map(String);
  if (ids.some((id) => id === productId || (sku && id === sku) || (legacyId && id === legacyId))) return true;
  const label = String(record.productName || "").trim().toLowerCase();
  return Boolean(label && name && (name.includes(label) || label.includes(name)));
}

/**
 * Where each line's produce came from, strongest evidence first:
 * a farmer request raised for this exact order, the serving vendor's recent farmer supply and
 * stock lots for the product, the dark store's stock batch for the SKU, then the farmer profile
 * declared on the catalog product.
 */
async function buildSourcing({ order, storeOrders, productsById, vendorIds }) {
  const storeOrderIds = storeOrders.map((so) => toId(so._id));
  const storeOrderNumbers = storeOrders.map((so) => so.orderNumber).filter(Boolean);
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const windowStart = new Date(orderDate.getTime() - VENDOR_SUPPLY_WINDOW_DAYS * DAY_MS);

  const skuByLine = new Map();
  for (const so of storeOrders) {
    for (const item of so.items || []) {
      if (item.productId && item.sku) skuByLine.set(toId(item.productId), item.sku);
    }
  }
  for (const item of order.items || []) {
    const product = productsById.get(toId(item.product));
    if (product?.sku && !skuByLine.has(toId(item.product))) skuByLine.set(toId(item.product), product.sku);
  }
  const skus = uniq([...skuByLine.values()]);
  const productKeys = uniq([
    ...skus,
    ...[...productsById.values()].flatMap((p) => [toId(p._id), p.productId]),
  ]);
  const storeIds = uniq(storeOrders.map((so) => so.managerId)).filter((id) => mongoose.isValidObjectId(id));

  const [directOrders, vendorOrders, vendorBatches, storeBatches, vendors] = await Promise.all([
    storeOrderIds.length
      ? FarmerOrder.find({
          $or: [
            { sourceStoreOrderId: { $in: storeOrderIds } },
            ...(storeOrderNumbers.length ? [{ sourceOrderNumber: { $in: storeOrderNumbers } }] : []),
          ],
        }).lean()
      : [],
    vendorIds.length
      ? FarmerOrder.find({
          vendorId: { $in: vendorIds },
          createdAt: { $gte: windowStart, $lte: orderDate },
        })
          .sort({ createdAt: -1 })
          .limit(200)
          .lean()
      : [],
    vendorIds.length && productKeys.length
      ? VendorStockBatch.find({
          vendorId: { $in: vendorIds },
          $or: [{ sku: { $in: productKeys } }, { productId: { $in: productKeys } }],
          receivedDate: { $lte: orderDate },
        })
          .sort({ receivedDate: -1 })
          .limit(50)
          .lean()
      : [],
    skus.length && storeIds.length
      ? InventoryBatch.find({ sku: { $in: skus }, storeId: { $in: storeIds }, createdAt: { $lte: orderDate } })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean()
      : [],
    vendorIds.length ? Vendor.find({ id: { $in: vendorIds } }).select(VENDOR_FIELDS).lean() : [],
  ]);

  const lineMatch = (item) => {
    const productId = toId(item.product);
    const product = productsById.get(productId) || null;
    return {
      productId,
      sku: skuByLine.get(productId) || product?.sku || "",
      legacyId: product?.productId || "",
      name: String(item.name || product?.name || "").toLowerCase(),
    };
  };
  const lineMatches = (order.items || []).map(lineMatch);

  const directIds = new Set(directOrders.map((fo) => fo.id));
  const supplyOrders = vendorOrders.filter(
    (fo) => !directIds.has(fo.id) && lineMatches.some((match) => matchesLine(fo, match))
  );
  const allFarmerOrders = [...directOrders, ...supplyOrders];

  const farmerOrderIds = uniq(allFarmerOrders.flatMap((fo) => [fo.id, fo.orderId]));
  const [pickups, inspections, idFarmers, nameFarmers] = await Promise.all([
    farmerOrderIds.length ? Pickup.find({ orderId: { $in: farmerOrderIds } }).lean() : [],
    farmerOrderIds.length ? QualityInspection.find({ orderId: { $in: farmerOrderIds } }).lean() : [],
    findFarmersByIds(allFarmerOrders.map((fo) => fo.farmerId)),
    findFarmersByNames(storeBatches.map((b) => b.supplierName)),
  ]);

  const farmerById = new Map();
  for (const f of [...idFarmers, ...nameFarmers]) {
    for (const key of [f.id, f.farmerId, f.farmerCode]) if (key) farmerById.set(String(key), f);
  }
  const farmerByName = new Map(nameFarmers.map((f) => [String(f.name).toLowerCase(), f]));

  const managerIds = uniq([...idFarmers, ...nameFarmers].map((f) => f.managerId));
  const fieldManagers = managerIds.length
    ? await FarmerManager.find({ id: { $in: managerIds } }).select(FIELD_MANAGER_FIELDS).lean()
    : [];
  const managerById = new Map(fieldManagers.map((m) => [m.id, m]));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  const pickupByOrder = new Map(pickups.map((p) => [p.orderId, p]));
  const inspectionByOrder = new Map(inspections.map((q) => [q.orderId, q]));

  const farmerSource = (source, fo) => {
    const farmer = farmerById.get(String(fo.farmerId)) || null;
    return {
      source,
      farmerOrder: fo,
      farmer,
      vendor: vendorById.get(fo.vendorId) || null,
      fieldManager: farmer?.managerId ? managerById.get(farmer.managerId) || null : null,
      pickup: pickupByOrder.get(fo.id) || pickupByOrder.get(fo.orderId) || null,
      quality: inspectionByOrder.get(fo.id) || inspectionByOrder.get(fo.orderId) || null,
    };
  };

  const lines = (order.items || []).map((item, index) => {
    const match = lineMatches[index];
    const { productId, sku } = match;
    const product = productsById.get(productId) || null;

    const declared =
      product?.farmerDetails?.name || product?.farmerName
        ? {
            source: "catalog_profile",
            name: product.farmerDetails?.name || product.farmerName,
            location: product.farmerDetails?.location || product.farmerLocation || "",
            image: product.farmerDetails?.farmerImage || product.farmerImage || "",
            farmImage: product.farmerDetails?.farmImage || product.farmImage || "",
            harvestingDate: product.farmerDetails?.harvestingDate || product.harvestingDate || "",
            packingDate: product.packingDate || "",
            certification: product.certification || "",
            agricultureMethod: product.farmerDetails?.agricultureMethod || "",
            totalArea: product.farmerDetails?.totalArea || "",
            cultivationArea: product.farmerDetails?.cultivationArea || "",
            soilType: product.farmerDetails?.soilType || "",
            waterSource: product.farmerDetails?.waterSource || "",
            experience: product.farmerDetails?.experience || "",
          }
        : null;

    return {
      itemId: toId(item._id),
      productId,
      name: item.name,
      sku,
      departmentId: item.departmentId || product?.departmentId || "",
      department: item.department || "",
      variantName: item.variantName || "",
      quantity: item.quantity,
      price: item.price,
      lineTotal: Math.round((Number(item.price) || 0) * (Number(item.quantity) || 0) * 100) / 100,
      image: item.image || product?.productImages?.[0] || "",
      product,
      farmerRequests: directOrders.filter((fo) => matchesLine(fo, match)).map((fo) => farmerSource("farmer_request", fo)),
      vendorSupply: supplyOrders
        .filter((fo) => matchesLine(fo, match))
        .slice(0, 3)
        .map((fo) => farmerSource("vendor_supply", fo)),
      vendorBatches: vendorBatches
        .filter((b) => matchesLine(b, match))
        .slice(0, 3)
        .map((batch) => ({ source: "vendor_batch", batch, vendor: vendorById.get(batch.vendorId) || null })),
      storeBatches: storeBatches
        .filter((b) => b.sku === sku)
        .slice(0, 3)
        .map((batch) => {
          const farmer = farmerByName.get(String(batch.supplierName || "").toLowerCase()) || null;
          return {
            source: "store_batch",
            batch,
            farmer,
            fieldManager: farmer?.managerId ? managerById.get(farmer.managerId) || null : null,
          };
        }),
      catalogFarmer: declared,
    };
  });

  const farmerSummary = new Map();
  for (const line of lines) {
    for (const src of [...line.farmerRequests, ...line.vendorSupply, ...line.storeBatches]) {
      if (!src.farmer) continue;
      const key = farmerKey(src.farmer);
      const entry = farmerSummary.get(key) || {
        farmer: src.farmer,
        fieldManager: src.fieldManager,
        products: [],
        evidence: new Set(),
      };
      if (!entry.products.includes(line.name)) entry.products.push(line.name);
      entry.evidence.add(src.source);
      farmerSummary.set(key, entry);
    }
  }

  return {
    lines,
    vendors,
    farmers: [...farmerSummary.values()].map((entry) => ({ ...entry, evidence: [...entry.evidence] })),
    farmerOrders: allFarmerOrders,
    pickups,
    inspections,
  };
}

function buildTimeline({ order, storeOrders, riderById, payments, feedback, returns }) {
  const events = [
    event(
      order.createdAt,
      `Order #${order.orderNumber} placed`,
      `${order.items?.length || 0} item(s), ${order.paymentMethod === "cod" ? "Cash on delivery" : "Online payment"}`
    ),
    event(order.codAdvancePaidAt, "10% COD advance paid", order.codAdvanceRazorpayPaymentId || ""),
    event(order.paidAt, "Payment received", order.razorpayPaymentId || ""),
  ];

  for (const payment of payments) {
    events.push(
      event(payment.createdAt, `Payment recorded (${payment.source || payment.paymentMethod})`, `₹${payment.amount} · ${payment.status}`)
    );
    events.push(event(payment.verifiedAt, "Payment verified", payment.razorpayPaymentId || payment.upiTransactionRef || ""));
  }

  for (const so of storeOrders) {
    const store = so.darkStore?.storeName || so.darkStore?.name || "Dark store";
    const part = so.sourcePart ? ` (${so.sourcePart === "preorder" ? "pre-order part" : "instant part"})` : "";
    for (const [field, label] of STORE_ORDER_STAGES) {
      let detail = `${store} · ${so.orderNumber}${part}`;
      let actor = "";
      if (field === "assignedAt" && so.rider) {
        detail = `${so.rider.name} (${so.rider.phone}) · ${so.rider.vehicleType || ""} ${so.rider.vehicleNumber || ""}`.trim();
        actor = so.rider.name;
      }
      if (field === "failedAt") detail = so.failureReason || detail;
      if (field === "deliveredAt" && so.deliveryComment) detail = `${detail} · Rider note: ${so.deliveryComment}`;
      if (field === "forwardedAt") actor = so.forwardedByName || "";
      if (field === "storeReceivedAt") actor = so.storeReceivedByName || "";
      if (field === "vendorConfirmedAt") actor = so.vendorActionByName || "";
      events.push(event(so[field], label, detail, actor));
    }
    if (so.manualCompletion?.at) {
      events.push(
        event(so.manualCompletion.at, "Closed manually", so.manualCompletion.reason || "", so.manualCompletion.byName || so.manualCompletion.byRole || "")
      );
    }
    if (so.failureResolution?.at) {
      events.push(
        event(so.failureResolution.at, `Failed delivery resolved: ${so.failureResolution.status}`, so.failureResolution.note || "", so.failureResolution.byName || "")
      );
    }
  }

  for (const refund of order.refunds || []) {
    events.push(event(refund.createdAt, `Refund due ₹${refund.amount}`, refund.reason || ""));
    events.push(event(refund.refundedAt, `Refunded ₹${refund.amount}`, refund.reason || ""));
  }

  for (const fb of feedback) {
    if (fb.skipped) continue;
    const rider = fb.riderId ? riderById.get(toId(fb.riderId)) : null;
    events.push(
      event(
        fb.createdAt,
        "Customer feedback",
        [fb.riderRating ? `Rider ${fb.riderRating}★${rider ? ` (${rider.name})` : ""}` : "", fb.riderComment]
          .filter(Boolean)
          .join(" · ")
      )
    );
  }

  for (const ret of returns) {
    events.push(event(ret.createdAt, `Return / refund pickup requested (${ret.type})`, ret.reason || ""));
    events.push(event(ret.pickedUpAt, "Return picked up from customer"));
    events.push(event(ret.returnedToStoreAt, "Return received at dark store"));
    events.push(event(ret.successfulAt, "Return completed"));
  }

  return events.filter(Boolean).sort((a, b) => new Date(a.at) - new Date(b.at));
}

/** Every record connected to one storefront order, grouped for the admin traceability view. */
export async function buildStorefrontOrderTrace(order) {
  if (!order?._id) return null;

  const productIds = uniq((order.items || []).map((item) => item.product)).filter((id) =>
    mongoose.isValidObjectId(id)
  );

  const [customer, customerOrderCount, products, storeOrders, payments, feedback, returns] =
    await Promise.all([
      order.user ? User.findById(order.user).select(CUSTOMER_FIELDS).lean() : null,
      order.user ? Order.countDocuments({ user: order.user, status: { $ne: "attempted" } }) : 0,
      productIds.length ? Product.find({ _id: { $in: productIds } }).select(PRODUCT_FIELDS).lean() : [],
      StoreOrder.find({ sourceOrderId: order._id }).sort({ createdAt: 1 }).lean(),
      Payment.find({ order: order._id }).select("-screenshot -items -deliveryAddress").sort({ createdAt: 1 }).lean(),
      OrderFeedback.find({ order: order._id }).sort({ createdAt: 1 }).lean(),
      ReturnPickup.find({ sourceOrderId: order._id }).sort({ createdAt: 1 }).lean(),
    ]);

  const storeIds = uniq(storeOrders.flatMap((so) => [so.managerId, so.darkStoreId]));
  const riderIds = uniq([
    ...storeOrders.flatMap((so) => [so.assignedRiderId, so.failedByRiderId]),
    ...returns.map((r) => r.assignedRiderId),
    ...feedback.map((f) => f.riderId),
  ]);

  const [darkStores, riders] = await Promise.all([
    storeIds.length ? DeliveryManager.find({ _id: { $in: storeIds } }).select(DARK_STORE_FIELDS).lean() : [],
    riderIds.length ? DeliveryBoy.find({ _id: { $in: riderIds } }).select(RIDER_FIELDS).lean() : [],
  ]);
  const storeById = new Map(darkStores.map((s) => [toId(s._id), s]));
  const riderById = new Map(riders.map((r) => [toId(r._id), r]));

  const productsById = new Map(products.map((p) => [toId(p._id), p]));
  const sourcing = await buildSourcing({
    order,
    storeOrders,
    productsById,
    vendorIds: uniq(darkStores.map((s) => s.vendorId)),
  });
  const vendorById = new Map(sourcing.vendors.map((v) => [v.id, v]));

  // The delivery OTP and payment QR are live secrets, so they stay out of the trace.
  const deliveries = storeOrders.map(({ otpCode: _otp, deliveryPaymentQr: _qr, ...so }) => {
    const darkStore = storeById.get(toId(so.managerId)) || storeById.get(toId(so.darkStoreId)) || null;
    return {
      ...so,
      darkStore,
      vendor: darkStore?.vendorId ? vendorById.get(darkStore.vendorId) || null : null,
      rider: riderById.get(toId(so.assignedRiderId)) || null,
      failedByRider: riderById.get(toId(so.failedByRiderId)) || null,
    };
  });

  const addr = order.deliveryAddress || {};
  const customerName = addr.fullName || customer?.name || "";

  return {
    order: {
      _id: toId(order._id),
      orderNumber: order.orderNumber,
      status: order.status,
      orderType: order.orderType,
      fulfillmentType: order.fulfillmentType,
      departments: order.departments || [],
      checkoutMode: order.checkoutMode,
      preOrderSlot: order.preOrderSlot,
      preOrderDate: order.preOrderDate,
      preOrderProgress: order.preOrderProgress,
      message: order.message,
      routingError: order.routingError,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    customer: {
      account: customer,
      totalOrders: customerOrderCount,
      name: customerName,
      phone: addr.number || customer?.phone || "",
      email: addr.email || customer?.email || "",
      address: addressLine(addr),
      deliveryAddress: addr,
    },
    payment: {
      method: order.paymentMethod,
      status: order.paymentStatus,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      razorpayPaidAmount: order.razorpayPaidAmount,
      codAdvanceAmount: order.codAdvanceAmount,
      codAdvancePaidAt: order.codAdvancePaidAt,
      paidAt: order.paidAt,
      records: payments,
      refunds: order.refunds || [],
    },
    pricing: {
      subtotal: order.subtotal,
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount,
      rewardPointsUsed: order.rewardPointsUsed,
      rewardDiscount: order.rewardDiscount,
      rewardPointsEarned: order.rewardPointsEarned,
      giftCardCode: order.giftCardCode,
      giftCardDiscount: order.giftCardDiscount,
      dynamicDiscount: order.dynamicDiscount,
      bundleDiscount: order.bundleDiscount,
      loyaltyDiscount: order.loyaltyDiscount,
      deliveryCharges: order.deliveryCharges,
      packagingFee: order.packagingFee,
      heavyHandlingFee: order.heavyHandlingFee,
      gstAmount: order.gstAmount,
      total: order.total,
    },
    items: sourcing.lines,
    farmers: sourcing.farmers,
    vendors: sourcing.vendors,
    farmerOrders: sourcing.farmerOrders,
    pickups: sourcing.pickups,
    qualityInspections: sourcing.inspections,
    deliveries,
    shipment: order.shipment || null,
    feedback,
    returns: returns.map((r) => ({ ...r, rider: riderById.get(toId(r.assignedRiderId)) || null })),
    timeline: buildTimeline({ order, storeOrders: deliveries, riderById, payments, feedback, returns }),
    // Raw order and customer the shared tax-invoice renderer expects.
    invoiceOrder: order,
    invoiceCustomer: customer
      ? { name: customer.name, email: customer.email, phone: customer.phone }
      : { name: customerName, phone: addr.number || "" },
  };
}
