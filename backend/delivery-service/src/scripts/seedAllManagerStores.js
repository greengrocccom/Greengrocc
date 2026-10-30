import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "@greengrocc/shared";
import DeliveryManager from "../models/DeliveryManager.js";
import { seedManagerStore } from "../services/seedManagerStore.js";

async function main() {
  await connectDB("seed-manager-stores");
  const managers = await DeliveryManager.find({});
  if (managers.length === 0) {
    console.log(
      "No delivery managers found. Register one from the Delivery web app first."
    );
    await mongoose.disconnect();
    return;
  }

  for (const manager of managers) {
    const result = await seedManagerStore(manager);
    console.log(
      `${manager.email} (${manager.area}): +${result.productsCreated} products, +${result.inventoryCreated} inventory rows`
    );
  }

  await mongoose.disconnect();
  console.log("Done.");
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
