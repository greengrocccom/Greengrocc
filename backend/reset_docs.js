import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const uri = process.env.MONGODB_URI;

async function run() {
  if (!uri) throw new Error("Set MONGODB_URI before running the reset script.");
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME });
  const col = mongoose.connection.collection("farmerdocuments");
  await col.deleteMany({});
  console.log("Deleted all old farmer documents from MongoDB");
  process.exit(0);
}

run().catch(console.error);
