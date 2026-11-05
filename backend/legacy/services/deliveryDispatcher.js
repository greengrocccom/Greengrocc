import mongoose from "mongoose";
import StoreOrder from "../../delivery-service/src/models/StoreOrder.js";
import StoreInventory from "../../delivery-service/src/models/StoreInventory.js";
import {
  readCoords,
  resolveDarkStoreForOrder,
} from "../../delivery-service/src/services/darkStoreResolver.js";
import { seedManagerStore } from "../../delivery-service/src/services/seedManagerStore.js";
import { inventorySkuForProduct } from "../../delivery-service/src/services/catalogStoreInventory.js";
import {
  buildStockMap,
  reserveOrderStock,
  stockRowFor,
} from "../../delivery-service/src/services/storeStockService.js";
import { getIO } from "../../socket.js";
import Product from "../models/Product.js";
import { geocodeAddressString } from "./reverseGeocodeService.js";
import { computePreOrderDate, normalizePreOrderSlot } from "../utils/preOrderHelpers.js";
import {
  collectDepartments,
  normalizeFulfillmentType,
  sectionToDepartment,
} from "../utils/departmentHelpers.js";

function formatCustomerAddress(address = {}) {
  const parts = [];
  if (address.shopNo) parts.push(address.shopNo);
  if (address.shopName) parts.push(address.shopName);
  if (address.fullAddress) parts.push(address.fullAddress);
  if (address.landmark) parts.push(address.landmark);
  if (address.area) parts.push(address.area);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.pincode) parts.push(address.pincode);
  return parts.join(", ");
}

const ROUTING_FAILURE_TEXT = {
  no_active_stores: "No dark store is active",
  no_store_in_city: "No dark store in this city",
  no_store_within_radius: "No dark store delivers to this location",
  no_store_in_area: "No dark store matches this area",
  store_inactive: "The chosen dark store is inactive or missing",
};

/**
 * The dark store that would fulfil these items at this address — the same rule
 * the dispatcher uses, so checkout and routing never disagree.
 */
export async function findStoreForOrder({ address = {}, items = [], fulfillmentType, forceManagerId } = {}) {
  const itemDepartments = await resolveItemDepartments(items);
  const departments = collectDepartments(itemDepartments);
  const allowPincodeFallback =
    departments.length > 0 && departments.every((dept) => dept === "preorder");

  let customerCoords = readCoords(address);
  const text = formatCustomerAddress(address);
  if (!customerCoords && text) {
    customerCoords = await geocodeAddressString(text).catch(() => null);
  }

  let result;
  if (forceManagerId) {
    const DeliveryManager = (await import("../../delivery-service/src/models/DeliveryManager.js")).default;
    const forced = mongoose.Types.ObjectId.isValid(forceManagerId)
      ? await DeliveryManager.findOne({ _id: forceManagerId, isActive: true })
      : null;
    result = forced
      ? { manager: forced, reason: "admin_rerouted", distanceKm: null }
      : { manager: null, reason: "store_inactive", distanceKm: null };
  } else {
    result = await resolveDarkStoreForOrder(
      { ...address, ...(customerCoords ? { lat: customerCoords.lat, lng: customerCoords.lng } : {}) },
      { allowPincodeFallback, anyDistance: normalizeFulfillmentType(fulfillmentType) === "pickup" }
    );
  }

  const message = result.manager
    ? ""
    : ROUTING_FAILURE_TEXT[result.reason] || "No dark store found";
  return { ...result, itemDepartments, departments, customerCoords, allowPincodeFallback, message };
}

/**
 * Ready2Cook / Instant lines this store cannot cover right now. Pre-order lines are
 * supplied by the vendor for the slot, so they are not checked against store stock.
 */
export async function findStoreShortages({ managerId, items = [], itemDepartments = [] }) {
  const lines = await mapItemsToStoreCatalog(managerId, items, itemDepartments);
  const rows = await StoreInventory.find({ managerId, isActive: true }).lean();
  const stockMap = buildStockMap(rows);

  const needed = new Map();
  for (const line of lines) {
    if (line.department === "preorder") continue;
    const row = stockRowFor(line, stockMap);
    const key = row ? String(row._id) : `missing:${line.productId || line.sku}`;
    const entry = needed.get(key) || { name: line.name, quantity: 0, available: row ? Number(row.stockCount) || 0 : 0 };
    entry.quantity += Number(line.quantity) || 0;
    needed.set(key, entry);
  }

  return [...needed.values()]
    .filter((entry) => entry.available < entry.quantity)
    .map(({ name, quantity, available }) => ({ name, needed: quantity, available }));
}

/** Remember why an order could not be routed (cleared once it is). */
async function recordRoutingResult(orderId, error) {
  if (!orderId) return;
  const Order = (await import("../models/order/Order.js")).default;
  await Order.updateOne(
    { _id: orderId },
    { $set: { routingError: error || "", routingAttemptedAt: new Date() } }
  ).catch(() => {});
}

async function customerOrderCancelled(orderId) {
  if (!orderId) return false;
  const Order = (await import("../models/order/Order.js")).default;
  const row = await Order.findById(orderId).select("status").lean().catch(() => null);
  return row?.status === "cancelled";
}

/** Department + department-wise id per order line. */
async function resolveItemDepartments(ecommerceItems = []) {
  const productIds = ecommerceItems
    .map((item) => item.product?._id || item.product)
    .filter(Boolean);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select("section storeType departmentId")
        .lean()
    : [];
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  return ecommerceItems.map((item) => {
    const product = productById.get(String(item.product?._id || item.product || ""));
    return {
      department: item.department || sectionToDepartment(product?.section, product?.storeType),
      departmentId: item.departmentId || product?.departmentId || "",
    };
  });
}

async function mapItemsToStoreCatalog(managerId, ecommerceItems = [], itemDepartments = []) {
  const inventory = await StoreInventory.find({ managerId, isActive: true });
  const productIds = ecommerceItems
    .map((item) => item.product?._id || item.product)
    .filter(Boolean);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select("sku name")
    : [];
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  const byProductId = new Map(
    inventory.filter((row) => row.productId).map((row) => [String(row.productId), row])
  );
  const bySku = new Map(inventory.map((row) => [String(row.sku).toLowerCase(), row]));

  const mapped = ecommerceItems.map((item, index) => {
    const productId = String(item.product?._id || item.product || "");
    const product = productById.get(productId);
    const productSku = String(
      product?.sku || item.sku || (productId ? inventorySkuForProduct({ _id: productId }) : "")
    ).trim();
    const productName = item.name || product?.name || "Item";

    let match = productId ? byProductId.get(productId) : null;
    if (!match && productSku) {
      const skuRow = bySku.get(productSku.toLowerCase());
      if (skuRow && (!skuRow.productId || String(skuRow.productId) === productId)) {
        match = skuRow;
      }
    }

    return {
      productId: productId && mongoose.Types.ObjectId.isValid(productId) ? productId : null,
      linkRowId: match && !match.productId && productId ? match._id : null,
      sku: match?.sku || productSku || (productId ? `P-${productId.slice(-8)}` : `ITEM-${Date.now()}`),
      name: match?.name || productName,
      quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
      unit: match?.unit || "pcs",
      price: Number(item.price || match?.price || 0),
      department: itemDepartments[index]?.department || "",
      departmentId: itemDepartments[index]?.departmentId || "",
    };
  });

  const links = mapped.filter((line) => line.linkRowId);
  if (links.length) {
    await StoreInventory.bulkWrite(
      links.map((line) => ({
        updateOne: {
          filter: { _id: line.linkRowId, productId: null },
          update: { $set: { productId: line.productId } },
        },
      })),
      { ordered: false }
    ).catch((err) => console.warn("[deliveryDispatcher] stock link failed:", err.message));
  }

  return mapped.map(({ linkRowId, ...line }) => line);
}

/**
 * Route a confirmed customer order to the dark store that covers that address.
 * Creates a StoreOrder so the correct Delivery Manager can confirm, deduct stock, and dispatch.
 * Pre-orders are held (status "preorder_hold") for the Product Manager to prepare and forward.
 * A mixed cart with a slot becomes two StoreOrders: Ready2Cook / Instant now, pre-order items at the slot.
 */
export async function dispatchDeliveryOrder(ecommerceOrder, options = {}) {
  try {
    if (ecommerceOrder?.status === "attempted") {
      return null;
    }

    // A Mongoose subdocument loses its fields when spread, so work with a plain copy.
    const rawAddress = ecommerceOrder.deliveryAddress;
    const address = typeof rawAddress?.toObject === "function" ? rawAddress.toObject() : rawAddress;
    if (!address) {
      console.error("[deliveryDispatcher] No delivery address found for order", ecommerceOrder._id);
      return null;
    }

    if (ecommerceOrder._id) {
      const alreadyRouted = await StoreOrder.findOne({ sourceOrderId: ecommerceOrder._id });
      if (alreadyRouted) {
        return alreadyRouted;
      }
    }

    const preOrderSlot = normalizePreOrderSlot(ecommerceOrder.preOrderSlot);
    const fulfillmentType = normalizeFulfillmentType(ecommerceOrder.fulfillmentType);
    const customerAddress = formatCustomerAddress(address) || "Customer address";
    const routing = await findStoreForOrder({
      address,
      items: ecommerceOrder.items || [],
      fulfillmentType,
      forceManagerId: options.forceManagerId,
    });
    const { itemDepartments, departments, customerCoords, manager, reason, distanceKm } = routing;
    if (!manager) {
      const message = routing.message;
      console.warn(`[deliveryDispatcher] ${message}`, ecommerceOrder._id, {
        city: address.city,
        area: address.area,
        pincode: address.pincode,
        departments,
        reason,
      });
      await recordRoutingResult(ecommerceOrder._id, message);
      return null;
    }

    await seedManagerStore(manager);

    const items = await mapItemsToStoreCatalog(
      manager._id,
      ecommerceOrder.items || [],
      itemDepartments
    );
    if (!items.length) {
      console.warn("[deliveryDispatcher] Order has no items", ecommerceOrder._id);
      return null;
    }

    const orderNum = ecommerceOrder.orderNumber
      ? `CUST-${ecommerceOrder.orderNumber}`
      : `CUST-${String(ecommerceOrder._id).slice(-8).toUpperCase()}`;

    const roundedDistance =
      distanceKm != null ? Math.round(distanceKm * 10) / 10 : null;

    // One OTP per customer order: it unlocks the rider delivery or the store-counter handover of every part.
    const otpCode = String(Math.floor(1000 + Math.random() * 9000));
    const lineTotal = (list) =>
      list.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const itemsTotal = lineTotal(items);
    const deliveryCharges = Number(ecommerceOrder.deliveryCharges || 0);
    const orderTotal = Number(ecommerceOrder.total || itemsTotal + deliveryCharges);
    const ecommercePayMethod = String(ecommerceOrder.paymentMethod || "").toLowerCase();
    const isOnlinePaid =
      ecommercePayMethod === "online" &&
      String(ecommerceOrder.paymentStatus || "").toLowerCase() === "paid";
    const storePaymentMethod =
      ecommercePayMethod === "cod" || ecommercePayMethod === "COD" ? "COD" : ecommercePayMethod === "online" ? "online" : "COD";

    // The slot applies to pre-order lines only; Ready2Cook / Instant lines go out right away.
    const preItems = preOrderSlot ? items.filter((item) => item.department === "preorder") : [];
    const nowItems = preOrderSlot ? items.filter((item) => item.department !== "preorder") : items;
    const isMixed = preItems.length > 0 && nowItems.length > 0;
    const parts = [];
    if (nowItems.length) parts.push({ key: isMixed ? "now" : "", items: nowItems, isPreOrder: false });
    if (preItems.length) parts.push({ key: isMixed ? "preorder" : "", items: preItems, isPreOrder: true });

    // Delivery charges ride with the first part; the rest of the bill is shared by item value.
    const goodsTotal = Math.max(0, orderTotal - deliveryCharges);
    let remaining = Math.round(orderTotal);
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        part.amount = remaining;
        return;
      }
      const share = itemsTotal > 0 ? lineTotal(part.items) / itemsTotal : 1 / parts.length;
      part.amount = Math.round(goodsTotal * share + (index === 0 ? deliveryCharges : 0));
      remaining -= part.amount;
    });

    const hasPreOrderPart = preItems.length > 0;
    const preOrderDate = hasPreOrderPart
      ? ecommerceOrder.preOrderDate || computePreOrderDate(ecommerceOrder.createdAt || new Date())
      : "";

    if (await customerOrderCancelled(ecommerceOrder._id)) {
      console.log("[deliveryDispatcher] Customer cancelled before routing", ecommerceOrder._id);
      return null;
    }

    const created = [];
    for (const part of parts) {
      const partDepartments = collectDepartments(part.items);
      const storeOrder = await StoreOrder.create({
        orderNumber: part.key === "preorder" ? `${orderNum}-PR` : orderNum,
        managerId: manager._id,
        darkStoreId: manager._id,
        sourceOrderId: ecommerceOrder._id || null,
        sourcePart: part.key,
        fulfillmentType,
        city: manager.city || address.city || "",
        cityId: manager.cityId || "",
        area: address.area || manager.area || "",
        customerName: address.fullName || "Customer",
        customerPhone: address.number || "",
        customerAddress,
        customerLat: customerCoords?.lat ?? null,
        customerLng: customerCoords?.lng ?? null,
        distanceKm: roundedDistance,
        items: part.items,
        status: part.isPreOrder ? "preorder_hold" : "order_received",
        isPreOrder: part.isPreOrder,
        preOrderSlot: part.isPreOrder ? preOrderSlot : "",
        preOrderDate: part.isPreOrder ? preOrderDate : "",
        preOrderStage: part.isPreOrder ? "pending" : "",
        vendorStatus: part.isPreOrder ? "pending" : "",
        departments: partDepartments,
        routingReason: reason || "",
        darkStoreQrCode: `DARKSTORE_${manager._id}`,
        otpCode,
        paymentMethod: storePaymentMethod,
        paymentStatus: isOnlinePaid ? "paid_online" : "pending",
        amountToCollect: isOnlinePaid ? 0 : part.amount,
        partTotal: part.amount,
        notes: `Customer order ${ecommerceOrder.orderNumber || ecommerceOrder._id} routed by ${reason}${
          roundedDistance != null ? ` (${roundedDistance} km)` : ""
        }${fulfillmentType === "pickup" ? " · customer pickup at store" : ""}${
          isMixed ? ` · ${part.isPreOrder ? "pre-order part" : "Ready2Cook / Instant part"}` : ""
        }`,
      });
      created.push(storeOrder);

      if (!part.isPreOrder) {
        const reservation = await reserveOrderStock(manager._id, storeOrder).catch((err) => {
          console.warn("[deliveryDispatcher] stock reservation failed:", err.message);
          return { reserved: false };
        });
        if (!reservation.reserved && reservation.shortages?.length) {
          console.warn(
            `[deliveryDispatcher] ${storeOrder.orderNumber} not reserved — short:`,
            reservation.shortages.map((s) => `${s.name} ${s.available}/${s.needed}`).join(", ")
          );
        }
      }

      console.log(
        `[deliveryDispatcher] ${part.isPreOrder ? `Pre-order (${preOrderDate} ${preOrderSlot})` : "Order"} ${storeOrder.orderNumber} → ${manager.storeName || manager.area} (${reason}, ${fulfillmentType})`
      );

      try {
        const payload = {
          orderId: storeOrder._id.toString(),
          orderNumber: storeOrder.orderNumber,
          customerName: storeOrder.customerName,
          customerPhone: storeOrder.customerPhone,
          itemsCount: storeOrder.items.length,
          storeName: manager.storeName || `${manager.area} Store`,
          departments: partDepartments,
          fulfillmentType,
          ...(part.isPreOrder ? { preOrderSlot, preOrderDate } : {}),
        };
        const io = getIO();
        io.to(`store_${manager._id}`).emit(
          part.isPreOrder ? "new_preorder_received" : "new_order_received",
          payload
        );
        if (part.isPreOrder) {
          io.to(manager.vendorId ? `vendor_${manager.vendorId}` : "role:vendor").emit("new_preorder_received", payload);
        }
      } catch (err) {
        console.warn("[deliveryDispatcher] socket emit failed:", err.message);
      }
    }

    // Persist OTP on customer Order so frontend/userapp can show it to the customer
    if (ecommerceOrder._id) {
      try {
        const Order = (await import("../models/order/Order.js")).default;
        await Order.findByIdAndUpdate(ecommerceOrder._id, {
          deliveryOtp: otpCode,
          routingError: "",
          routingAttemptedAt: new Date(),
          ...(hasPreOrderPart && !ecommerceOrder.preOrderDate ? { preOrderDate } : {}),
          ...(hasPreOrderPart ? { preOrderProgress: "awaiting_vendor" } : {}),
        });
      } catch (err) {
        console.warn("[deliveryDispatcher] failed to save deliveryOtp on Order:", err.message);
      }
    }

    // The customer may have cancelled while the parts were being created.
    if (await customerOrderCancelled(ecommerceOrder._id)) {
      const { applyStoreOrderStatus } = await import(
        "../../delivery-service/src/services/storeOrderLifecycle.js"
      );
      for (const storeOrder of created) {
        await applyStoreOrderStatus({ storeOrderId: storeOrder._id, status: "cancelled" });
      }
      return null;
    }

    return created[0];
  } catch (error) {
    if (error?.code === 11000 && ecommerceOrder?._id) {
      return StoreOrder.findOne({ sourceOrderId: ecommerceOrder._id });
    }
    console.error("[deliveryDispatcher] Failed to dispatch order", error);
    return null;
  }
}

/**
 * Re-dispatch confirmed customer orders that never got a StoreOrder (e.g. after a deploy bug).
 */
export async function reconcileMissedDispatches({ sinceHours = 72 } = {}) {
  const Order = (await import("../models/order/Order.js")).default;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const orders = await Order.find({
    status: "confirm",
    updatedAt: { $gte: since },
  }).select("_id");

  let created = 0;
  for (const row of orders) {
    const full = await Order.findById(row._id);
    if (!full) continue;
    const existing = await StoreOrder.findOne({ sourceOrderId: full._id });
    if (existing) continue;
    const result = await dispatchDeliveryOrder(full);
    if (result) created += 1;
  }
  if (created) {
    console.log(`[deliveryDispatcher] Reconciled ${created} missed store order(s).`);
  }
  return created;
}
