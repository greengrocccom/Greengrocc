import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { ACCOUNT_TYPES, requireAccountAdmin, updateLoginAccount, deleteLoginAccount, listLoginAccounts } from '../admin-ops-service/src/loginAccountControllers.js';

const id = '507f1f77bcf86cd799439011';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const next = error => { if (error) throw error; };
for (const role of ['vendor', 'VENDOR', 'farmer', 'delivery_manager', undefined]) {
  const res = response(); let called = false;
  requireAccountAdmin({ user: { role } }, res, () => { called = true; });
  assert.equal(res.code, 403); assert.equal(called, false);
}
let allowed = false;
requireAccountAdmin({ user: { role: 'admin' } }, response(), () => { allowed = true; });
assert.equal(allowed, true);

for (const [type, config] of Object.entries(ACCOUNT_TYPES)) {
  const original = config.model.findById;
  let saved = false, deleted = false;
  const doc = { _id: id, id: `business-${type}`, role: type === 'staff' ? 'product_manager' : type,
    [config.name || 'name']: 'Existing name', [config.phone || 'phone']: '9876543210',
    save: async () => { saved = true; }, deleteOne: async () => { deleted = true; } };
  config.model.findById = async () => doc;
  try {
    const res = response();
    await updateLoginAccount({ params: { type, id }, body: { name: 'Updated name', phone: '9876543211', password: 'newpass123', isActive: false, role: doc.role } }, res, next);
    assert.equal(res.code, 200); assert.equal(saved, true);
    assert.equal(doc[config.name || 'name'], 'Updated name');
    assert.equal(doc.isActive, undefined); // Arbitrary fields cannot be assigned.
    if (config.hash) assert.equal(await bcrypt.compare('newpass123', doc.password), true);
    else assert.equal(doc.password, 'newpass123'); // The model's save hook hashes this once.
    assert.equal(res.body.data.password, undefined);
    const self = response();
    await deleteLoginAccount({ params: { type, id }, user: { id } }, self, next);
    assert.equal(self.code, 400); assert.equal(deleted, false);
    if (type !== 'vendor') {
      const deletion = response();
      await deleteLoginAccount({ params: { type, id }, user: { id: 'another-admin' } }, deletion, next);
      assert.equal(deletion.code, 200); assert.equal(deleted, true);
    }
  } finally { config.model.findById = original; }
}
for (const handler of [updateLoginAccount, deleteLoginAccount, listLoginAccounts]) {
  const res = response(); await handler({ params: { type: '__proto__', id }, query: {} }, res, next);
  assert.equal(res.code, 400);
}
console.log('PASS: admin-only access, account edits, password handling, field allowlists, deletion and self-deletion protection.');
