import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const orderSource = await readFile(new URL('../legacy/models/order/Order.js', import.meta.url), 'utf8');
const orderHook = orderSource.split('orderSchema.pre("save", async function preSaveOrder() {')[1].split('\n});')[0];
const save = new AsyncFunction('stampDepartments', 'collectDepartments', 'deriveCustomerOrderType', orderHook);
for (const number of ['123456', 'ORD-LEGACY-123', 'GGC-ORD-2026-00001']) {
  const order = { orderNumber: number, departments: ['instant'], isModified: () => false, constructor: { exists: () => { throw new Error('Existing order consumed a new number'); } } };
  await save.call(order);
  assert.equal(order.orderNumber, number);
}
const newOrder = { departments: ['instant'], isModified: () => false, constructor: { exists: async () => false } };
await save.call(newOrder);
assert.match(newOrder.orderNumber, /^\d{6}$/);
const centreSource = await readFile(new URL('../farmer-manager-service/src/pickupControllers.js', import.meta.url), 'utf8');
const centreBody = centreSource.split('async function ensureCentreBusinessId(centre, locationHint = {}) {')[1].split('\n}')[0];
const ensureCentre = new AsyncFunction('centre', 'locationHint', centreBody);
for (const id of ['centre-old-1', 'GGC-CC-MH-NK-TLK-VIL-001']) {
  const centre = { id, save() { throw new Error('Existing centre was rewritten'); } };
  assert.equal(await ensureCentre(centre, {}), centre);
  assert.equal(centre.id, id);
}
const syncSource = await readFile(new URL('../erp-service/src/services/farmerSync.js', import.meta.url), 'utf8');
const preserve = new Function('sibling', syncSource.match(/if \(!sibling.id\) sibling.id = String\(sibling._id\);/)[0] + 'return sibling.id;');
assert.equal(preserve({ id: 'legacy-row', _id: 'mongo-row' }), 'legacy-row');
assert.equal(preserve({ _id: 'mongo-row' }), 'mongo-row');
console.log('Passed: existing order numbers, legacy centre IDs, farmer-product row IDs stay stable; missing IDs still initialize.');
