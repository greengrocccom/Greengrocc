import StoreInventory, { availableStock, hasAvailableExpr } from "../models/StoreInventory.js";
import StoreOrder from "../models/StoreOrder.js";

/**
 * Store stock follows an order in three steps:
 *   reserve / pack  → units move into heldCount (customers can no longer buy them)
 *   out for delivery → units come off stockCount and heldCount (the physical stock drops)
 *   cancel           → held units are released, or shipped units are put back
 * Orders reserved before heldCount existed (no stockHeldAt) took their units straight off
 * stockCount; they are only marked shipped, and cancelling puts the units back as before.
 */

/** Rows are keyed by SKU and, when linked, by `pid:<productId>`. */
export function buildStockMap(rows = []) {
  const map = new Map();
  for (const row of rows) {
    map.set(row.sku, row);
    if (row.productId) map.set(`pid:${row.productId}`, row);
  }
  return map;
}

export function stockRowFor(item, stockMap) {
  if (item?.productId) {
    const linked = stockMap.get(`pid:${item.productId}`);
    if (linked) return linked;
  }
  return stockMap.get(item?.sku) || null;
}

export async function getStockMap(managerId) {
  const rows = await StoreInventory.find({ managerId, isActive: true });
  return buildStockMap(rows);
}

function rowFilter(managerId, item, row) {
  if (row?._id) return { _id: row._id, managerId };
  if (item.productId) return { managerId, productId: item.productId };
  return { managerId, sku: item.sku };
}

const fulfilableItems = (order) => (order.items || []).filter((item) => !item.customerInformed);

/** Lower a counter by `quantity` without going below zero. */
const decrementClamped = (field, quantity) => ({
  $max: [0, { $subtract: [{ $ifNull: [`$${field}`, 0] }, quantity] }],
});

/** Set counters with an aggregation-pipeline update (needed for the clamped decrements). */
const pipelineUpdate = (filter, set) => StoreInventory.updateOne(filter, [{ $set: set }], { updatePipeline: true });

export function findOrderShortages(order, stockMap) {
  const shortages = [];
  for (const item of fulfilableItems(order)) {
    const available = availableStock(stockRowFor(item, stockMap));
    if (available < item.quantity) {
      shortages.push({
        sku: item.sku,
        name: item.name,
        needed: item.quantity,
        available,
      });
    }
  }
  return shortages;
}

/**
 * Atomically hold available stock for every fulfilable item, or none at all.
 * Returns { taken, shortages, empty }.
 */
async function holdStock(managerId, order) {
  const fulfilable = fulfilableItems(order);
  if (fulfilable.length === 0) {
    return { taken: false, shortages: [], empty: true };
  }

  const stockMap = await getStockMap(managerId);
  const shortages = findOrderShortages(order, stockMap);
  if (shortages.length) {
    return { taken: false, shortages };
  }

  const held = [];
  for (const item of fulfilable) {
    const filter = rowFilter(managerId, item, stockRowFor(item, stockMap));
    const updated = await StoreInventory.findOneAndUpdate(
      { ...filter, ...hasAvailableExpr(item.quantity) },
      { $inc: { heldCount: item.quantity } },
      { returnDocument: "after" }
    );
    if (!updated) {
      for (const done of held) {
        await pipelineUpdate(done.filter, { heldCount: decrementClamped("heldCount", done.quantity) });
      }
      const latest = await StoreInventory.findOne(filter);
      return {
        taken: false,
        shortages: [
          {
            sku: item.sku,
            name: item.name,
            needed: item.quantity,
            available: availableStock(latest),
          },
        ],
      };
    }
    held.push({ filter: { _id: updated._id }, quantity: item.quantity });
  }

  return { taken: true, shortages: [] };
}

/**
 * Hold stock for a new store order so other customers cannot buy the same units.
 * Best effort: if anything is short the order stays unreserved and packing checks again.
 */
export async function reserveOrderStock(managerId, order) {
  if (order.stockReservedAt || order.stockDeductedAt) return { reserved: false, already: true };
  const result = await holdStock(managerId, order);
  if (!result.taken) return { reserved: false, shortages: result.shortages || [] };
  order.stockReservedAt = new Date();
  order.stockHeldAt = order.stockReservedAt;
  await order.save();
  return { reserved: true };
}

/**
 * Confirm this dark store's stock for fulfilable order items at packing. Reserved orders
 * already hold their units; others are held now. The physical stock drops only when the
 * order goes out for delivery (shipOrderStock).
 */
export async function deductOrderStock(managerId, order) {
  if (order.stockDeductedAt) {
    return { deducted: false, alreadyDeducted: true, shortages: [] };
  }

  if (order.stockReservedAt) {
    if (!fulfilableItems(order).length) {
      return { deducted: false, alreadyDeducted: false, shortages: [], empty: true };
    }
    order.stockDeductedAt = new Date();
    await order.save();
    return { deducted: true, alreadyDeducted: false, shortages: [] };
  }

  const result = await holdStock(managerId, order);
  if (result.empty) {
    return { deducted: false, alreadyDeducted: false, shortages: [], empty: true };
  }
  if (!result.taken) {
    return { deducted: false, alreadyDeducted: false, shortages: result.shortages };
  }

  order.stockDeductedAt = new Date();
  order.stockHeldAt = order.stockDeductedAt;
  await order.save();
  return { deducted: true, alreadyDeducted: false, shortages: [] };
}

/**
 * The order left the store (out for delivery, or delivered without that step): take its
 * held units off the physical stock. Runs once per order.
 */
export async function shipOrderStock(order) {
  if (!order?._id || order.stockShippedAt || !(order.stockReservedAt || order.stockDeductedAt)) {
    return { shipped: false };
  }
  const now = new Date();
  const claim = await StoreOrder.updateOne(
    { _id: order._id, stockShippedAt: { $in: [null] } },
    { $set: { stockShippedAt: now } },
    { timestamps: false }
  );
  order.stockShippedAt = now;
  if (!claim.modifiedCount || !order.stockHeldAt) return { shipped: false };

  const stockMap = await getStockMap(order.managerId);
  for (const item of fulfilableItems(order)) {
    await pipelineUpdate(rowFilter(order.managerId, item, stockRowFor(item, stockMap)), {
      stockCount: decrementClamped("stockCount", item.quantity),
      heldCount: decrementClamped("heldCount", item.quantity),
    });
  }
  return { shipped: true };
}

/** Fire-and-forget form of shipOrderStock for status transitions. */
export function shipOrderStockOnDispatch(order) {
  shipOrderStock(order).catch((err) =>
    console.warn(`[storeStock] ship failed for ${order?.orderNumber || order?._id}:`, err.message)
  );
}

/**
 * A failed delivery came back for another attempt: its units are on the shelf again and
 * still promised to this order, so they count as physical stock and stay held.
 */
export async function returnShippedStockToShelf(order) {
  if (!order?.stockShippedAt) return { returned: false };
  if (order.stockHeldAt) {
    const stockMap = await getStockMap(order.managerId);
    for (const item of fulfilableItems(order)) {
      await StoreInventory.updateOne(rowFilter(order.managerId, item, stockRowFor(item, stockMap)), {
        $inc: { stockCount: item.quantity, heldCount: item.quantity },
      });
    }
  }
  order.stockShippedAt = null;
  return { returned: true };
}

/** Release held units, or put shipped units back, when an order is cancelled. */
export async function restoreOrderStock(managerId, order) {
  if (!order?.stockDeductedAt && !order?.stockReservedAt) return { restored: false };
  const stockMap = await getStockMap(managerId);
  const releaseHold = Boolean(order.stockHeldAt) && !order.stockShippedAt;
  for (const item of fulfilableItems(order)) {
    const filter = rowFilter(managerId, item, stockRowFor(item, stockMap));
    if (releaseHold) {
      await pipelineUpdate(filter, { heldCount: decrementClamped("heldCount", item.quantity) });
    } else {
      await StoreInventory.updateOne(filter, { $inc: { stockCount: item.quantity } });
    }
  }
  order.stockDeductedAt = null;
  order.stockReservedAt = null;
  order.stockHeldAt = null;
  order.stockShippedAt = null;
  return { restored: true };
}
