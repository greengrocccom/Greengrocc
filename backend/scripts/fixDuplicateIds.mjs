/**
 * Finds business IDs that were issued more than once (before the generators
 * were switched to the atomic counter) and optionally repairs them.
 *
 *   node scripts/fixDuplicateIds.mjs          # report only
 *   node scripts/fixDuplicateIds.mjs --apply  # rename duplicates + build unique indexes
 *
 * Run with --apply once after deploying, before the server builds the new
 * unique index on InventoryBatch.batchNumber (it fails while duplicates exist).
 */
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../legacy/models/Product.js";
import { Farmer, Vendor } from "../farmer-manager-service/src/models.js";
import { InventoryBatch, OmniInvoice } from "../admin-ops-service/src/models.js";
import { serialId } from "../shared/ids.js";

const APPLY = process.argv.includes("--apply");

async function findDuplicates(model, field, extraMatch = {}) {
  return model.collection
    .aggregate([
      { $match: { [field]: { $exists: true, $nin: ["", null] }, ...extraMatch } },
      { $sort: { createdAt: 1, _id: 1 } },
      { $group: { _id: `$${field}`, ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
}

function report(label, groups) {
  console.log(`\n${label}: ${groups.length} duplicated value(s)`);
  for (const g of groups.slice(0, 20)) console.log(`  ${g._id} x${g.count}`);
  if (groups.length > 20) console.log(`  ...and ${groups.length - 20} more`);
}

async function renameExtras(model, field, groups, nextValue) {
  let renamed = 0;
  for (const g of groups) {
    const [, ...extras] = g.ids;
    for (let i = 0; i < extras.length; i += 1) {
      const value = await nextValue(g._id, i + 1);
      await model.collection.updateOne({ _id: extras[i] }, { $set: { [field]: value } });
      console.log(`  ${g._id} -> ${value}`);
      renamed += 1;
    }
  }
  return renamed;
}

async function main() {
  mongoose.set("autoIndex", false);
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGODB_URI before running the ID repair.");
  await mongoose.connect(uri);
  console.log(APPLY ? "Mode: APPLY (changes will be written)" : "Mode: DRY RUN (pass --apply to fix)");

  const batchDupes = await findDuplicates(InventoryBatch, "batchNumber");
  const vendorCodeDupes = await findDuplicates(Vendor, "vendorCode");
  const skuDupes = await findDuplicates(Product, "sku");
  const farmerIdDupes = await findDuplicates(Farmer, "farmerId");
  const farmerCodeDupes = await findDuplicates(Farmer, "farmerCode");
  const invoiceDupes = await findDuplicates(OmniInvoice, "invoiceNumber");

  report("Inventory batch numbers", batchDupes);
  report("Vendor codes", vendorCodeDupes);
  report("Product SKUs (manual review: SKUs are linked to store stock)", skuDupes);
  report("Farmer IDs (manual review)", farmerIdDupes);
  report("Farmer codes (manual review)", farmerCodeDupes);
  report("POS invoice numbers (manual review: printed on customer bills)", invoiceDupes);

  if (APPLY) {
    console.log("\nRenaming duplicate inventory batch numbers (oldest keeps the original):");
    const batches = await renameExtras(InventoryBatch, "batchNumber", batchDupes, (v, n) => `${v}-DUP${n}`);

    console.log("\nReassigning duplicate vendor codes (oldest keeps the original):");
    const vendors = await renameExtras(Vendor, "vendorCode", vendorCodeDupes, () => serialId("VND"));

    // Replaces the old non-unique batchNumber index with the unique one.
    await InventoryBatch.syncIndexes();
    console.log(`\nDone. Renamed ${batches} batch(es) and ${vendors} vendor code(s); unique batch index built.`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
