import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "@greengrocc/shared";
import DeliveryManager from "../models/DeliveryManager.js";
import { addVendorCatalogToStore } from "../services/catalogStoreInventory.js";

/** One-off backfill: list every product approved for a store's vendor in that store at 0 stock. */
async function main() {
  await connectDB("sync-catalog-to-stores");
  const stores = await DeliveryManager.find({ isActive: true }).select("_id vendorId storeName email area").lean();

  let total = 0;
  for (const store of stores) {
    const added = await addVendorCatalogToStore(store);
    total += added;
    console.log(`${store.storeName || store.email} (${store.area || "-"}): +${added} products at 0 stock`);
  }

  await mongoose.disconnect();
  console.log(`Done. ${total} inventory rows added across ${stores.length} stores.`);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
