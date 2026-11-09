import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import StoreOrder from '../delivery-service/src/models/StoreOrder.js';
import CustomerOrder from '../legacy/models/order/Order.js';
import { visibleStoreOrderScope } from '../delivery-service/src/services/visibleStoreOrders.js';
import { LIVE_ROUTES } from '../realtime/liveRoutes.js';

const id = suffix => new mongoose.Types.ObjectId(suffix.padStart(24, '0'));
const managerId = id('a'), otherManagerId = id('b');
const existingId = id('1'), deletedId = id('2');
let rows = [
  { managerId, sourceOrderId: existingId, status: 'order_received' },
  { managerId, sourceOrderId: deletedId, status: 'preorder_hold' },
  { managerId, sourceOrderId: null, status: 'order_received' },
  { managerId, status: 'order_received' },
  { managerId: otherManagerId, sourceOrderId: existingId, status: 'order_received' },
];
let existing = [existingId], customerQueries = 0;
const equal = (a, b) => a == null && b == null || String(a) === String(b);
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$and') return value.every(part => matches(row, part));
    if (key === '$or') return value.some(part => matches(row, part));
    if (value && typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId)) {
      if ('$in' in value) return value.$in.some(candidate => equal(row[key], candidate));
      if ('$ne' in value) return !equal(row[key], value.$ne);
    }
    return equal(row[key], value);
  });
}
const originalStore = StoreOrder.distinct, originalCustomer = CustomerOrder.distinct;
try {
  StoreOrder.distinct = async (field, scope) => {
    assert.equal(field, 'sourceOrderId');
    return rows.filter(row => matches(row, scope)).map(row => row.sourceOrderId);
  };
  CustomerOrder.distinct = async (field, scope) => {
    customerQueries++; assert.equal(field, '_id');
    return existing.filter(_id => scope._id.$in.some(candidate => equal(candidate, _id)));
  };
  const base = { managerId };
  const filter = await visibleStoreOrderScope(base);
  const visible = rows.filter(row => matches(row, filter));
  assert.equal(visible.length, 3, 'Keep valid customer, standalone null-source and legacy manual orders');
  assert.ok(!visible.some(row => equal(row.sourceOrderId, deletedId)));
  assert.ok(!visible.some(row => equal(row.managerId, otherManagerId)));
  assert.deepEqual(base, { managerId }, 'Do not mutate caller filters');

  existing = []; // Simulate directly deleting the remaining order in MongoDB.
  // Compute a fresh scope just as a live view refresh does.
  const refreshed = await visibleStoreOrderScope({ managerId });
  assert.equal(rows.filter(row => matches(row, refreshed)).length, 2);
  assert.equal(rows.filter(row => matches(row, { ...refreshed, status: 'preorder_hold' })).length, 0);

  rows = rows.filter(row => row.sourceOrderId == null && equal(row.managerId, managerId));
  const previousQueries = customerQueries;
  await visibleStoreOrderScope({ managerId });
  assert.equal(customerQueries, previousQueries, 'No source lookup is needed for standalone orders');

  for (const path of ['/api/delivery-managers', '/api/staff/preorders']) {
    assert.ok(LIVE_ROUTES.find(route => route.path === path).deps.includes('orders'), `${path} must refresh on direct source deletion`);
  }
  console.log('PASS: deleted customer copies hidden; valid/manual orders preserved; manager scoping, counts and live deletion dependencies verified. No database connection or writes.');
} finally {
  StoreOrder.distinct = originalStore; CustomerOrder.distinct = originalCustomer;
}
