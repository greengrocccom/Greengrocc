import assert from 'node:assert/strict';
import DeliveryManager from '../delivery-service/src/models/DeliveryManager.js';
import { Vendor } from '../farmer-manager-service/src/models.js';
import { resolveDarkStoreForOrder, resolveDarkStoreForAddress, readCoords } from '../delivery-service/src/services/darkStoreResolver.js';
import { addressToSnapshot } from '../legacy/utils/orderHelpers.js';
import { login } from '../delivery-service/src/controllers/managerAuthController.js';

const original = [];
function stub(target, name, value) { original.push([target, name, target[name]]); target[name] = value; }
const customer = { lat: 18.5, lng: 73.8, city: 'Pune', pincode: '411057' };
const near = { _id: 'near', isActive: true, vendorId: 'active-vendor', storeName: 'Near Store', area: 'Near Area', city: 'Pune', latitude: 18.501, longitude: 73.8, deliveryRadiusKm: 5, pincode: '411057', storeSeededAt: new Date() };
const far = { ...near, _id: 'far', area: 'Far Area', latitude: 18.56 };
let stores = [], passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS: ${name}`); };
try {
  stub(DeliveryManager, 'find', async filter => { assert.deepEqual(filter, { isActive: true }); return stores.filter(s => s.isActive); });
  stub(Vendor, 'find', filter => ({ select() { return this; }, lean: async () => {
    assert.equal(filter.status, 'Active');
    return filter.id.$in.includes('active-vendor') ? [{ id: 'active-vendor' }] : [];
  } }));
  await check('Instant and Ready2Cook select nearest GPS despite farther area name', async () => {
    stores = [far, near];
    const result = await resolveDarkStoreForOrder({ ...customer, area: 'Far Area' });
    assert.equal(result.manager._id, 'near'); assert.ok(result.distanceKm < 0.12);
    assert.equal((await resolveDarkStoreForAddress({ ...customer, area: 'Far Area' })).manager._id, 'near');
  });
  await check('Configured 5 km service radius is honored beyond 3 km', async () => {
    stores = [{ ...near, latitude: 18.54 }];
    assert.equal((await resolveDarkStoreForOrder(customer)).reason, 'within_store_radius');
  });
  await check('A configured 1 km radius is not bypassed by the old 3 km rule', async () => {
    stores = [{ ...near, latitude: 18.52, deliveryRadiusKm: 1 }];
    assert.equal((await resolveDarkStoreForOrder(customer)).manager, null);
  });
  await check('Immediate orders cannot use distant same-PIN or same-city stores', async () => {
    stores = [far]; assert.equal((await resolveDarkStoreForOrder(customer)).manager, null);
  });
  await check('Preorders use the nearest serviceable store before PIN fallback', async () => {
    stores = [far, { ...near, pincode: '411045' }];
    assert.equal((await resolveDarkStoreForOrder(customer, { allowPincodeFallback: true })).manager._id, 'near');
  });
  await check('Preorders fall back to a registered same-PIN store outside the immediate radius', async () => {
    stores = [far]; const result = await resolveDarkStoreForOrder(customer, { allowPincodeFallback: true });
    assert.equal(result.manager._id, 'far'); assert.equal(result.reason, 'same_pincode');
  });
  await check('Same city alone does not satisfy a preorder fallback', async () => {
    stores = [{ ...far, pincode: '411045' }];
    assert.equal((await resolveDarkStoreForOrder(customer, { allowPincodeFallback: true })).manager, null);
  });
  await check('Missing customer GPS requires exact PIN fallback for preorders', async () => {
    stores = [near]; const address = { city: 'Pune', area: 'Near Area', pincode: '411057' };
    assert.equal((await resolveDarkStoreForOrder(address)).manager, null);
    assert.equal((await resolveDarkStoreForOrder(address, { allowPincodeFallback: true })).reason, 'same_pincode');
  });
  await check('Inactive stores and stores without active multivendors are excluded', async () => {
    stores = [{ ...near, vendorId: '' }, { ...near, _id: 'suspended', vendorId: 'suspended-vendor' }, { ...far, isActive: false }];
    assert.equal((await resolveDarkStoreForOrder(customer, { allowPincodeFallback: true })).manager, null);
  });
  await check('Pickup can choose the nearest store beyond the delivery radius', async () => {
    stores = [far]; assert.equal((await resolveDarkStoreForOrder(customer, { anyDistance: true })).reason, 'nearest_for_pickup');
  });
  await check('Missing store GPS does not masquerade as a nearby location', async () => {
    stores = [{ ...near, latitude: '', longitude: '' }];
    assert.equal(readCoords({ latitude: '', longitude: '' }), null);
    assert.equal((await resolveDarkStoreForOrder(customer)).manager, null);
    assert.equal((await resolveDarkStoreForOrder(customer, { allowPincodeFallback: true })).reason, 'same_pincode');
  });
  await check('Selected saved address is preserved when global location differs', async () => {
    const result = addressToSnapshot({ fullName: 'Customer', fullAddress: 'Saved address', area: 'Near Area', city: 'Pune', pincode: '411057', location: customer },
      { fullAddress: 'Other address', area: 'Other Area', city: 'Mumbai', pincode: '400001', lat: 19.1, lng: 72.9 });
    assert.equal(result.city, 'Pune'); assert.equal(result.fullAddress, 'Saved address'); assert.equal(result.location.lat, customer.lat); assert.equal(result.pincode, '411057');
  });
  await check('Manager login never moves the fixed dark-store GPS pin', async () => {
    const manager = { ...near, email: 'manager@example.com', comparePassword: async () => true, toSafeJSON: () => ({ id: 'near' }) };
    stub(DeliveryManager, 'findOne', () => ({ select: async () => manager }));
    stub(Vendor, 'exists', async () => ({ id: 'active-vendor' }));
    stub(DeliveryManager, 'updateOne', async () => { throw new Error('Login must not update store location'); });
    const oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'isolated-test-only';
    try {
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await login({ body: { email: 'manager@example.com', password: 'correct', latitude: 19.1, longitude: 72.9 } }, res, error => { throw error; });
      assert.equal(res.body.success, true); assert.equal(manager.latitude, near.latitude); assert.equal(manager.longitude, near.longitude);
    } finally { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; }
  });
} finally { for (const [target, name, value] of original.reverse()) target[name] = value; }
console.log(`${passed} routing and address checks passed. No database connection or writes.`);
