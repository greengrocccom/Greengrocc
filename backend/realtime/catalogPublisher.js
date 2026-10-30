import mongoose from "mongoose";
import { changeFeed } from "../shared/realtime/changeFeed.js";
import Product from "../legacy/models/Product.js";
import StoreInventory from "../delivery-service/src/models/StoreInventory.js";
import DeliveryManager from "../delivery-service/src/models/DeliveryManager.js";
import {
  attachStoreAvailability,
  loadStoreInventory,
  matchProductToItem,
  mongoMatchForInventory,
  storePublicPayload,
} from "../delivery-service/src/services/nearestStoreCatalog.js";
import { attachQuantityDiscounts } from "../admin-ops-service/src/pricingAttach.js";
import { getPurchaseCountsByProductIds } from "../legacy/controllers/productController.js";

/**
 * Customer catalog push. Storefront sockets join `catalog:<darkStoreId>`
 * (or `catalog:none`). When a product or a dark store's stock changes, the
 * product is re-decorated exactly like GET /api/products does for that
 * store and pushed as:
 *   { type: "product_updated", entity: "product", id, data, storeId }
 */

const PRODUCTS = Product.collection.collectionName.toLowerCase();
const INVENTORY = StoreInventory.collection.collectionName.toLowerCase();
const PUBLIC_ENTITIES = {
  greengrocccategories: "category",
  greengroccsections: "section",
  herobanners: "hero_banner",
  offerbanners: "offer_banner",
  greengroccbanners: "banner",
};

const FLUSH_MS = 200;

function catalogRooms(io) {
  return [...io.sockets.adapter.rooms.keys()].filter((room) => room.startsWith("catalog:"));
}

async function catalogForStore(storeId) {
  if (storeId === "none" || !mongoose.isValidObjectId(storeId)) {
    return { requested: true, manager: null, store: null, items: [] };
  }
  const [manager, items] = await Promise.all([
    DeliveryManager.findById(storeId).lean(),
    loadStoreInventory(storeId),
  ]);
  if (!manager) return { requested: true, manager: null, store: null, items: [] };
  return { requested: true, manager, store: storePublicPayload(manager), items };
}

async function decorate(products, catalog) {
  const counts = await getPurchaseCountsByProductIds(products.map((p) => p._id));
  return attachQuantityDiscounts(
    attachStoreAvailability(
      products.map((p) => ({ ...p.toObject(), purchaseCount: counts.get(String(p._id)) || 0 })),
      catalog
    )
  );
}

function emitProducts(io, room, storeId, decorated, removedIds, createdIds) {
  decorated.forEach((data) => {
    const id = String(data._id);
    const action = createdIds.has(id) ? "created" : "updated";
    io.to(room).emit("sync", { type: `product_${action}`, entity: "product", action, id, data, storeId });
  });
  removedIds.forEach((id) => {
    io.to(room).emit("sync", { type: "product_deleted", entity: "product", action: "deleted", id, storeId });
  });
}

export function startCatalogPublisher(io) {
  const pendingProducts = new Map();
  const pendingInventory = new Map();
  let timer = null;

  const flush = async () => {
    timer = null;
    const productChanges = new Map(pendingProducts);
    const inventoryChanges = new Map(pendingInventory);
    pendingProducts.clear();
    pendingInventory.clear();

    const rooms = catalogRooms(io);
    if (!rooms.length) return;

    try {
      if (productChanges.size) {
        const ids = [...productChanges.keys()].filter((id) => mongoose.isValidObjectId(id));
        const docs = await Product.find({ _id: { $in: ids } });
        const active = docs.filter((doc) => doc.isActive !== false);
        const activeIds = new Set(active.map((doc) => String(doc._id)));
        const removedIds = ids.filter((id) => !activeIds.has(id));
        const createdIds = new Set(ids.filter((id) => productChanges.get(id) === "insert"));

        for (const room of rooms) {
          const storeId = room.slice("catalog:".length);
          const visible = active.filter(
            (doc) => !doc.ownerManagerId || String(doc.ownerManagerId) === storeId
          );
          const decorated = visible.length ? await decorate(visible, await catalogForStore(storeId)) : [];
          emitProducts(io, room, storeId, decorated, removedIds, createdIds);
        }
      }

      for (const [storeId, rows] of inventoryChanges) {
        const room = `catalog:${storeId}`;
        if (!rooms.includes(room) || !rows.length) continue;
        const candidates = await Product.find({ isActive: true, ...mongoMatchForInventory(rows) }).limit(200);
        const affected = candidates.filter(
          (product) =>
            (!product.ownerManagerId || String(product.ownerManagerId) === storeId) &&
            matchProductToItem(product, rows)
        );
        if (!affected.length) continue;
        const decorated = await decorate(affected, await catalogForStore(storeId));
        emitProducts(io, room, storeId, decorated, [], new Set());
      }
    } catch (err) {
      console.warn("[realtime] catalog publish failed:", err.message);
    }
  };

  const queue = () => {
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  };

  changeFeed.on("change", (change) => {
    const coll = change.coll.toLowerCase();

    if (coll === PRODUCTS && change.id) {
      pendingProducts.set(change.id, pendingProducts.get(change.id) === "insert" ? "insert" : change.op);
      queue();
      return;
    }

    if (coll === INVENTORY && change.doc?.managerId) {
      const storeId = String(change.doc.managerId);
      const rows = pendingInventory.get(storeId) || [];
      rows.push(change.doc);
      pendingInventory.set(storeId, rows);
      queue();
      return;
    }

    const entity = PUBLIC_ENTITIES[coll];
    if (entity && change.id) {
      const action = change.op === "delete" ? "deleted" : change.op === "insert" ? "created" : "updated";
      io.to("public").emit("sync", {
        type: `${entity}_${action}`,
        entity,
        action,
        id: change.id,
        data: change.doc || undefined,
      });
    }
  });
}
