// Read-only: uses the native database handle; never registers models or creates indexes.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const report = { generatedAt: new Date().toISOString(), readOnly: true, collections: [], errors: [] };
try {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Set MONGODB_URI before running the audit.');
  await mongoose.connect(uri, {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
    ...(process.env.MONGODB_DB_NAME ? { dbName: process.env.MONGODB_DB_NAME } : {}),
  });
  const db = mongoose.connection.db;
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (name.startsWith('system.')) continue;
    const collection = db.collection(name);
    const entry = { name, duplicates: [] };
    try {
      // Business fields can intentionally repeat across child records; report candidates,
      // not automatic deletions. Only database _id is universally unique.
      for (const field of ['id', 'orderNumber', 'invoiceNumber', 'sku', 'farmerId', 'productId', 'cropId']) {
        const groups = await collection.aggregate([
          { $match: { [field]: { $exists: true, $nin: [null, ''] } } },
          { $group: { _id: `$${field}`, count: { $sum: 1 }, firstRecord: { $first: '$_id' }, lastRecord: { $last: '$_id' } } },
          { $match: { count: { $gt: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 100 },
        ], { maxTimeMS: 30000, allowDiskUse: true }).toArray();
        if (groups.length) entry.duplicates.push({ field, classification: field === 'id' ? 'duplicate-row-id' : 'review-scope-and-references', sampleLimit: 100, groups });
      }
      entry.indexes = await collection.listIndexes().toArray();
    } catch (error) { entry.error = error.codeName || error.name; }
    report.collections.push(entry);
  }
  const names = new Set(report.collections.map((entry) => entry.name));
  report.brokenReferences = [];
  for (const [from, field, target] of [
    ['storeorders', 'sourceOrderId', 'orders'],
    ['storeinventories', 'productId', 'GreenGroccproducts'],
    ['storeinventories', 'managerId', 'deliverymanagers'],
  ]) {
    if (!names.has(from) || !names.has(target)) continue;
    const rows = await db.collection(from).aggregate([
      { $match: { [field]: { $exists: true, $nin: [null, ''] } } },
      { $lookup: { from: target, localField: field, foreignField: '_id', as: 'resolved' } },
      { $match: { resolved: { $size: 0 } } },
      { $project: { _id: 1, [field]: 1 } },
      { $limit: 100 },
    ], { maxTimeMS: 30000 }).toArray();
    if (rows.length) report.brokenReferences.push({ from, field, target, sampleLimit: 100, rows });
  }
} catch (error) {
  // Avoid exposing credentials/connection strings embedded in driver messages.
  report.errors.push({ type: error.name, code: error.codeName || error.code || null });
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  const output = new URL('../id-audit-results.json', import.meta.url);
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(`ID audit: ${report.collections.length} collections; ${report.errors.length} connection errors. Report: backend/id-audit-results.json`);
}
