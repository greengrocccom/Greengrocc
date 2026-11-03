import mongoose from "mongoose";
import { MODULES, todayYmd } from "../config/idRegistry.js";

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: "erp_id_counters" }
);

export const ErpCounter =
  mongoose.models.ErpCounter || mongoose.model("ErpCounter", counterSchema);

/**
 * Atomically increment a named counter. Sequences never go backwards.
 * Deleted records do not reuse IDs because the counter is independent of documents.
 */
export async function nextSequence(key, session) {
  const options = { returnDocument: 'after', upsert: true };
  if (session) options.session = session;
  const doc = await ErpCounter.findOneAndUpdate(
    { key },
    { $inc: { sequence: 1 } },
    options
  );
  return doc.sequence;
}

/**
 * Central ID generator. Never call from the frontend.
 *
 * generateId({ module: "FR", state: "MH", district: "NK", taluka: "SIN" })
 *   → GGC-FR-MH-NK-SIN-00001
 */
export async function generateId(input = {}, session) {
  const module = String(input.module || "").toUpperCase();
  const spec = MODULES[module];
  if (!spec) {
    throw new Error(`Unknown ID module "${input.module}"`);
  }

  const parts = {
    ...input,
    date: input.date || todayYmd(),
  };

  if (typeof spec.generate === "function" && !spec.counterKey) {
    return spec.generate(parts);
  }

  const key = spec.counterKey(parts);
  const seq = await nextSequence(key, session);
  return spec.generate(parts, seq);
}

export async function generateIds(module, count, parts = {}, session) {
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(await generateId({ ...parts, module }, session));
  }
  return ids;
}
