// Isolated diagnostics of existing behavior. No database connection or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import DeliveryManager from '../delivery-service/src/models/DeliveryManager.js';
import StoreOrder from '../delivery-service/src/models/StoreOrder.js';
import StoreInventory from '../delivery-service/src/models/StoreInventory.js';
import Order from '../legacy/models/order/Order.js';
import { resolveDarkStoreForOrder } from '../delivery-service/src/services/darkStoreResolver.js';
import { addressToSnapshot, completeAttemptedOrder } from '../legacy/utils/orderHelpers.js';
import { dispatchDeliveryOrder } from '../legacy/services/deliveryDispatcher.js';

const original = [];
function stub(target, key, value) { original.push([target, key, target[key]]); target[key] = value; }
const query = value => ({ select() { return this; }, lean: async () => value, then: (yes, no) => Promise.resolve(value).then(yes, no) });
const oid = n => new mongoose.Types.ObjectId(String(n).padStart(24, '0'));
const findings = [];
const customer = { lat: 18.5, lng: 73.8 };
const near = { _id: oid(1), storeName: 'Near store', area: 'Near area', city: 'Pune', latitude: 18.501, longitude: 73.8, deliveryRadiusKm: 5, isActive: true, storeSeededAt: new Date() };
const far = { ...near, _id: oid(2), storeName: 'Far store', area: 'Far area', city: 'Other city', latitude: 18.56 };
try {
  let stores = [far, near];
  stub(DeliveryManager, 'find', async () => stores);
  const wrong = await resolveDarkStoreForOrder({ ...customer, area: 'Far area', city: 'Pune' });
  assert.equal(String(wrong.manager._id), String(far._id));
  assert.ok(wrong.distanceKm > far.deliveryRadiusKm);
  findings.push({ issue: 'Area text overrides nearest GPS, city and service radius', selectedKm: wrong.distanceKm });

  stores = [{ ...near, latitude: 18.52, deliveryRadiusKm: 1 }];
  const radius = await resolveDarkStoreForOrder(customer);
  assert.ok(radius.distanceKm > 1); assert.equal(radius.reason, 'within_3km');
  findings.push({ issue: 'The initial 3 km branch ignores a smaller configured delivery radius', selectedKm: radius.distanceKm });

  stores = [{ ...far, city: 'Pune' }];
  const rejected = await resolveDarkStoreForOrder({ ...customer, city: 'Pune' });
  const advertised = await resolveDarkStoreForOrder({ ...customer, city: 'Pune' }, { allowPincodeFallback: true });
  assert.equal(rejected.manager, null); assert.ok(advertised.manager);
  findings.push({ issue: 'Different fallback options can advertise a store that immediate checkout rejects' });

  stores = [{ ...near, vendorId: '' }];
  const orphan = await resolveDarkStoreForOrder(customer);
  assert.ok(orphan.manager);
  findings.push({ issue: 'Routing accepts an active store with no multivendor owner, although the manager API denies access' });

  const savedAddress = { fullName: 'Customer', fullAddress: 'Saved street', area: 'Saved area', city: 'Pune', location: customer };
  const globalLocation = { area: 'Different area', city: 'Mumbai', lat: 19.1, lng: 72.9 };
  const snapshot = addressToSnapshot(savedAddress, globalLocation);
  assert.equal(snapshot.area, 'Different area'); assert.equal(snapshot.city, 'Mumbai'); assert.equal(snapshot.location.lat, 19.1);
  findings.push({ issue: 'Global customerLocation overwrites the selected saved-address coordinates and locality' });

  const existing = { _id: oid(4), sourceOrderId: oid(5), managerId: oid(999), status: 'order_received' };
  let parts = [existing], createCalls = 0;
  stub(StoreOrder, 'findOne', async () => parts[0] || null);
  stub(StoreOrder, 'create', async data => { createCalls++; return data; });
  const retry = await dispatchDeliveryOrder({ _id: oid(5), status: 'confirm', deliveryAddress: customer }, { forceManagerId: near._id });
  assert.equal(retry, existing); assert.equal(createCalls, 0);
  findings.push({ issue: 'An existing dangling store order stops dispatch even when a different store is explicitly requested' });

  stores = [near]; parts = []; createCalls = 0;
  stub(StoreInventory, 'find', () => query([]));
  stub(Order, 'findById', () => query({ status: 'confirm' }));
  stub(Order, 'findByIdAndUpdate', async () => ({}));
  stub(StoreOrder, 'create', async data => {
    createCalls++;
    if (createCalls === 2) throw new Error('Injected second-part persistence failure');
    const doc = { ...data, _id: oid(7), stockReservedAt: new Date() };
    parts.push(doc); return doc;
  });
  // Capture expected injected errors and socket-uninitialized warnings, not real operational logs.
  stub(console, 'error', () => {}); stub(console, 'warn', () => {}); stub(console, 'log', () => {});
  const mixed = { _id: oid(6), orderNumber: 'AUDIT', status: 'confirm', deliveryAddress: customer,
    paymentMethod: 'cod', total: 20, preOrderSlot: '09:00 AM - 12:00 PM',
    items: [{ name: 'Instant', sku: 'I', price: 10, quantity: 1, department: 'instant' }, { name: 'Preorder', sku: 'P', price: 10, quantity: 1, department: 'preorder' }] };
  assert.equal(await dispatchDeliveryOrder(mixed), null);
  assert.equal(parts.length, 1); assert.equal(parts[0].sourcePart, 'now');
  await dispatchDeliveryOrder(mixed);
  assert.equal(createCalls, 2); assert.equal(parts.length, 1);
  findings.push({ issue: 'Failure creating the second mixed-cart part is never repaired by retry' });

  parts = []; createCalls = 0;
  const withoutSlot = { ...mixed, preOrderSlot: '', items: [mixed.items[1]] };
  await dispatchDeliveryOrder(withoutSlot);
  assert.equal(parts[0].isPreOrder, false); assert.equal(parts[0].status, 'order_received');
  findings.push({ issue: 'A preorder product with an omitted slot is classified as an immediate store order' });

  stub(Order, 'findOne', () => query({ _id: oid(8), status: 'confirm' }));
  const versionError = Object.assign(new Error('Injected cart conflict'), { name: 'VersionError' });
  await assert.rejects(completeAttemptedOrder({ userId: oid(9), attemptedOrderId: oid(8), orderItems: [],
    cart: { items: [], save: async () => { throw versionError; } } }), { name: 'VersionError' });
  findings.push({ issue: 'A cart save error aborts checkout completion for an already persisted customer order' });

  const page = await fs.readFile(new URL('../../DeliveryManager/src/pages/orders/OrdersPage.jsx', import.meta.url), 'utf8');
  const expression = page.match(/const orderMatchesDate = ([\s\S]*?\n\};)/)?.[1];
  assert.ok(expression);
  const matchesDate = Function(`return (${expression.replace(/;$/, '')});`)();
  assert.equal(matchesDate({ isPreOrder: true, preOrderDate: '2026-11-06', createdAt: '2026-11-05T07:00:00Z' }, '2026-11-05'), false);
  findings.push({ issue: 'The current Orders screen hides tomorrow preorders under the default Today date filter' });
} finally {
  for (const [target, key, value] of original.reverse()) target[key] = value;
}
console.log(JSON.stringify({ diagnostic: 'Confirmed existing bugs; no application fixes applied', reproduced: findings.length, findings }, null, 2));
