import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Cart from '../legacy/models/Cart.js';
import Product from '../legacy/models/Product.js';
import { removeFromCart } from '../legacy/controllers/cartController.js';

const oid = suffix => new mongoose.Types.ObjectId(suffix.padStart(24, '0'));
const user = oid('10'), productA = oid('a'), productB = oid('b'), productC = oid('c');
const originalUpdate = Cart.collection.findOneAndUpdate;
const originalFind = Product.collection.find;
const originalSave = Cart.prototype.save;
let state, calls = 0;
const copy = value => structuredClone(value);
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const line = (product, variantName = '', colorName = '', preOrderSlot = '') => ({ _id: oid(String(Math.floor(Math.random() * 100000) + 100)), product, quantity: 1, variantName, colorName, preOrderSlot });
const matches = (item, criteria) => Object.entries(criteria).every(([key, value]) => {
  if (value && typeof value === 'object' && '$in' in value) return value.$in.some(v => v == null ? item[key] == null : item[key] === v);
  return String(item[key]) === String(value);
});
const request = (productId, query = {}) => ({ params: { productId: String(productId) }, query, user: { _id: user } });
async function remove(productId, query = {}) {
  const res = response(); await removeFromCart(request(productId, query), res); return res;
}
try {
  Cart.prototype.save = async () => { throw new Error('Removal must never save a cart snapshot'); };
  Product.collection.find = () => ({ toArray: async () => [productA, productB, productC].map(_id => ({ _id, name: 'Product', isActive: true })) });
  Cart.collection.findOneAndUpdate = async (filter, update, options) => {
    calls += 1;
    assert.equal(String(filter.user), String(user));
    assert.equal(options.returnDocument, 'after');
    assert.equal(update.$inc.__v, 1);
    assert.ok(update.$pull.items.product instanceof mongoose.Types.ObjectId, 'Mongoose must cast the product ID');
    assert.equal(update.$set?.items, undefined, 'Do not overwrite the items array');
    await new Promise(resolve => setImmediate(resolve));
    if (!state) return null;
    state.items = state.items.filter(item => !matches(item, update.$pull.items));
    state.__v += 1;
    // Return a new snapshot as MongoDB does; do not share mutable arrays between queries.
    return { ...state, items: state.items.map(item => ({ ...item })) };
  };
  state = { _id: oid('11'), user, __v: 93, items: [line(productA), line(productB), line(productC)] };
  const concurrent = await Promise.all(Array.from({ length: 20 }, (_, i) => remove(i % 2 ? productA : productB)));
  assert.ok(concurrent.every(res => res.code === 200));
  assert.deepEqual(state.items.map(item => String(item.product)), [String(productC)]);
  assert.equal(state.__v, 113);

  state.items = [line(productA, 'Large', 'Red', 'Morning'), line(productA, 'Large', 'Red', 'Evening'), line(productA, 'Small', 'Red', 'Morning'), line(productA, 'Large', 'Blue', 'Morning')];
  const scoped = await remove(productA, { variantName: ' Large ', colorName: 'Red', preOrderSlot: 'Morning' });
  assert.equal(scoped.code, 200); assert.equal(state.items.length, 3);
  assert.ok(state.items.some(item => item.preOrderSlot === 'Evening'));
  assert.ok(state.items.some(item => item.variantName === 'Small'));
  assert.ok(state.items.some(item => item.colorName === 'Blue'));

  state.items = [{ _id: oid('20'), product: productA, quantity: 1 }, line(productB)];
  await remove(productA); assert.equal(state.items.length, 1, 'Legacy lines missing optional fields can be removed');
  await remove(productA); assert.equal(state.items.length, 1, 'Repeated removal is idempotent');
  const before = calls; const invalid = await remove('not-an-id');
  assert.equal(invalid.code, 400); assert.equal(calls, before);
  state = null; const missing = await remove(productA); assert.equal(missing.code, 404);
  console.log('PASS: overlapping removals, version increments, line identity, legacy fields, idempotency and invalid/missing carts. No database connection or writes.');
} finally {
  Cart.collection.findOneAndUpdate = originalUpdate;
  Product.collection.find = originalFind;
  Cart.prototype.save = originalSave;
}
