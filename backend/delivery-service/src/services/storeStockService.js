import StoreInventory from "../models/StoreInventory.js";

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

export function findOrderShortages(order, stockMap) {
  const shortages = [];
  for (const item of order.items || []) {
    if (item.customerInformed) continue;
    const stock = stockRowFor(item, stockMap);
    const available = stock ? stock.stockCount : 0;
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
 * Atomically take stock for every fulfilable item, or none at all.
 * Returns { taken, shortages, empty }.
 */
async function takeStock(managerId, order) {
  const fulfilable = (order.items || []).filter((item) => !item.customerInformed);
  if (fulfilable.length === 0) {
    return { taken: false, shortages: [], empty: true };
  }

  const stockMap = await getStockMap(managerId);
  const shortages = findOrderShortages(order, stockMap);
  if (shortages.length) {
    return { taken: false, shortages };
  }

  const deducted = [];
  for (const item of fulfilable) {
    const filter = rowFilter(managerId, item, stockRowFor(item, stockMap));
    const updated = await StoreInventory.findOneAndUpdate(
      { ...filter, stockCount: { $gte: item.quantity } },
      { $inc: { stockCount: -item.quantity } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      for (const done of deducted) {
        await StoreInventory.findOneAndUpdate(done.filter, {
          $inc: { stockCount: done.quantity },
        });
      }
      const latest = await StoreInventory.findOne(filter);
      return {
        taken: false,
        shortages: [
          {
            sku: item.sku,
            name: item.name,
            needed: item.quantity,
            available: latest?.stockCount || 0,
          },
        ],
      };
    }
    deducted.push({ filter: { _id: updated._id }, quantity: item.quantity });
  }

  return { taken: true, shortages: [] };
}

/**
 * Hold stock for a new store order so other customers cannot buy the same units.
 * Best effort: if anything is short the order stays unreserved and packing checks again.
 */
export async function reserveOrderStock(managerId, order) {
  if (order.stockReservedAt || order.stockDeductedAt) return { reserved: false, already: true };
  const result = await takeStock(managerId, order);
  if (!result.taken) return { reserved: false, shortages: result.shortages || [] };
  order.stockReservedAt = new Date();
  await order.save();
  return { reserved: true };
}

/**
 * Deduct this dark store's inventory for fulfilable order items at packing.
 * Reserved orders already hold their stock, so packing only confirms it.
 */
export async function deductOrderStock(managerId, order) {
  if (order.stockDeductedAt) {
    return { deducted: false, alreadyDeducted: true, shortages: [] };
  }

  if (order.stockReservedAt) {
    if (!(order.items || []).some((item) => !item.customerInformed)) {
      return { deducted: false, alreadyDeducted: false, shortages: [], empty: true };
    }
    order.stockDeductedAt = new Date();
    await order.save();
    return { deducted: true, alreadyDeducted: false, shortages: [] };
  }

  const result = await takeStock(managerId, order);
  if (result.empty) {
    return { deducted: false, alreadyDeducted: false, shortages: [], empty: true };
  }
  if (!result.taken) {
    return { deducted: false, alreadyDeducted: false, shortages: result.shortages };
  }

  order.stockDeductedAt = new Date();
  await order.save();
  return { deducted: true, alreadyDeducted: false, shortages: [] };
}

/** Put reserved or deducted units back when an order is cancelled. */
export async function restoreOrderStock(managerId, order) {
  if (!order?.stockDeductedAt && !order?.stockReservedAt) return { restored: false };
  const stockMap = await getStockMap(managerId);
  const fulfilable = (order.items || []).filter((item) => !item.customerInformed);
  for (const item of fulfilable) {
    await StoreInventory.findOneAndUpdate(
      rowFilter(managerId, item, stockRowFor(item, stockMap)),
      { $inc: { stockCount: item.quantity } }
    );
  }
  order.stockDeductedAt = null;
  order.stockReservedAt = null;
  return { restored: true };
}
