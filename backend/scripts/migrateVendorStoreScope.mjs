/**
 * Cut-over for "a dark store sells only the products approved for its vendor".
 * Never deletes anything. Dry run by default; pass --apply to write.
 *
 *   node scripts/migrateVendorStoreScope.mjs            # report only
 *   node scripts/migrateVendorStoreScope.mjs --apply    # write
 *
 * 1. vendorproducts.productId stored as text → ObjectId.
 * 2. GreenGroccproducts.ownerVendorId missing/null → "".
 * 3. For every dark store with a vendor: a VendorProduct for each active catalog product
 *    the store currently lists, so existing stores keep selling after the deploy.
 * 4. Duplicate check, then the unique indexes products.productId and
 *    storeinventories (managerId, productId).
 */
import dns from "node:dns";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { resolveMongoConfig } from "../shared/db/config.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // keep system resolvers
}
const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(dir, "..", ".env"), quiet: true });

const APPLY = process.argv.includes("--apply");
const { uri, dbName } = resolveMongoConfig();
await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 20000 });
const db = mongoose.connection.db;
const products = db.collection("GreenGroccproducts");
const vendorProducts = db.collection("vendorproducts");
const inventory = db.collection("storeinventories");
const managers = db.collection("deliverymanagers");

console.log(`Database: ${db.databaseName} — ${APPLY ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);
const isHex24 = (v) => typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);

// 1. VendorProduct.productId text → ObjectId
const textIds = await vendorProducts.find({ productId: { $type: "string" } }).project({ productId: 1 }).toArray();
const convertible = textIds.filter((row) => isHex24(row.productId));
console.log(`\n[1] vendorproducts with text productId: ${textIds.length} (convertible: ${convertible.length})`);
for (const bad of textIds.filter((row) => !isHex24(row.productId))) {
  console.log(`    NOT a product id, left as is: _id=${bad._id} productId=${bad.productId}`);
}
if (APPLY) {
  for (const row of convertible) {
    await vendorProducts.updateOne({ _id: row._id }, { $set: { productId: new mongoose.Types.ObjectId(row.productId) } });
  }
}

// 2. ownerVendorId consistent
const missingOwner = await products.countDocuments({ $or: [{ ownerVendorId: { $exists: false } }, { ownerVendorId: null }] });
console.log(`\n[2] products with missing/null ownerVendorId: ${missingOwner}`);
if (APPLY && missingOwner) {
  await products.updateMany({ $or: [{ ownerVendorId: { $exists: false } }, { ownerVendorId: null }] }, { $set: { ownerVendorId: "" } });
}

// 3. Backfill vendor approvals from what each store already lists
console.log("\n[3] vendor approvals backfill");
const stores = await managers.find({ vendorId: { $nin: ["", null] } }).project({ storeName: 1, vendorId: 1 }).toArray();
for (const store of stores) {
  const rowIds = await inventory.distinct("productId", { managerId: store._id, isActive: true, productId: { $type: "objectId" } });
  const listed = await products
    .find({ _id: { $in: rowIds }, isActive: true, ownerManagerId: null, ownerVendorId: { $in: ["", null, store.vendorId] } })
    .project({ name: 1, productImages: 1, categories: 1, unit: 1 })
    .toArray();
  const already = new Set(
    (await vendorProducts.find({ vendorId: store.vendorId }).project({ productId: 1 }).toArray()).map((r) => String(r.productId))
  );
  const missing = listed.filter((p) => !already.has(String(p._id)));
  console.log(`    ${store.storeName} (vendor ${store.vendorId}): lists ${listed.length} catalog products, ${missing.length} need a VendorProduct`);
  if (APPLY && missing.length) {
    const now = new Date();
    await vendorProducts.insertMany(
      missing.map((p) => ({
        id: `vp-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        vendorId: store.vendorId,
        productId: p._id,
        productName: p.name || "",
        productImage: p.productImages?.[0] || "",
        category: p.categories?.[0] || "",
        unit: p.unit || "",
        requestId: "",
        addedBy: "migration-store-scope",
        price: null,
        discountedPrice: null,
        stock: null,
        purchaseCost: 0,
        customDescription: "",
        customUnit: "",
        customInStock: null,
        overrides: null,
        pricingUpdatedAt: null,
        createdAt: now,
        updatedAt: now,
      })),
      { ordered: false }
    );
  }
}

// 4. Unique indexes
console.log("\n[4] unique indexes");
const dupProductIds = await products
  .aggregate([
    { $match: { productId: { $type: "string", $gt: "" } } },
    { $group: { _id: "$productId", n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ])
  .toArray();
const dupRows = await inventory
  .aggregate([
    { $match: { productId: { $type: "objectId" } } },
    { $group: { _id: { m: "$managerId", p: "$productId" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ])
  .toArray();
console.log(`    duplicate products.productId: ${dupProductIds.length}`, dupProductIds.slice(0, 10));
console.log(`    duplicate storeinventories (managerId, productId): ${dupRows.length}`, dupRows.slice(0, 10));
if (APPLY) {
  if (!dupProductIds.length) {
    await products.createIndex(
      { productId: 1 },
      { name: "productId_unique", unique: true, partialFilterExpression: { productId: { $type: "string", $gt: "" } } }
    );
    console.log("    created products.productId_unique");
  }
  if (!dupRows.length) {
    await inventory.createIndex(
      { managerId: 1, productId: 1 },
      { name: "managerId_productId_unique", unique: true, partialFilterExpression: { productId: { $type: "objectId" } } }
    );
    console.log("    created storeinventories.managerId_productId_unique");
  }
  console.log("    The older non-unique indexes productId_1 / managerId_1_productId_1 are left in place (nothing is dropped).");
}

await mongoose.disconnect();
console.log(`\nDone (${APPLY ? "applied" : "dry run — re-run with --apply to write"}).`);
