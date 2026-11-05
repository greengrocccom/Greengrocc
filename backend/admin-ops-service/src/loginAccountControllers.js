import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Staff from '../../staff-service/src/models/Staff.js';
import CustomRole from '../../staff-service/src/models/CustomRole.js';
import { STAFF_ROLES } from '../../staff-service/src/constants/roles.js';
import { Vendor, Farmer, FarmerManager, PickupDriver } from '../../farmer-manager-service/src/models.js';
import DeliveryManager from '../../delivery-service/src/models/DeliveryManager.js';
import DeliveryBoy from '../../delivery-service/src/models/DeliveryBoy.js';
import User from '../../legacy/models/user.js';
import Admin from '../../legacy/models/admin.js';
import { deleteVendorAdmin } from './opsControllers.js';

export const ACCOUNT_TYPES = {
  vendor: { model: Vendor, name: 'ownerName', phone: 'mobile', hash: true },
  farmer: { model: Farmer, phone: 'mobile', hash: true },
  farmer_manager: { model: FarmerManager, phone: 'mobile', hash: true },
  pickup_driver: { model: PickupDriver, phone: 'mobile', hash: true },
  delivery_manager: { model: DeliveryManager },
  delivery_boy: { model: DeliveryBoy },
  staff: { model: Staff },
  user: { model: User },
  admin: { model: Admin },
};
const fail = (res, code, message) => res.status(code).json({ success: false, message });
export function requireAccountAdmin(req, res, next) {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') return fail(res, 403, 'Admin access required');
  next();
}
const account = (type, doc) => ({
  id: String(doc._id), businessId: doc.id || '', type,
  name: doc[ACCOUNT_TYPES[type].name || 'name'] || '', email: doc.email || '',
  phone: doc[ACCOUNT_TYPES[type].phone || 'phone'] || '', role: doc.role || type,
  vendorName: doc.vendorName || '', storeName: doc.storeName || '',
  vendorId: doc.vendorId || '', createdAt: doc.createdAt,
});
function definition(req, res) {
  const config = Object.hasOwn(ACCOUNT_TYPES, req.params.type) ? ACCOUNT_TYPES[req.params.type] : null;
  if (!config) { fail(res, 400, 'Unknown account type'); return null; }
  return config;
}
export async function listLoginAccounts(req, res, next) {
  try {
    const config = definition(req, res); if (!config) return;
    const filter = req.params.type === 'farmer' ? { isDeleted: { $ne: true } } : {};
    const search = String(req.query.search || '').trim().slice(0, 100);
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = ['name', 'ownerName', 'vendorName', 'storeName', 'email', 'phone', 'mobile', 'id', 'role']
        .filter(k => config.model.schema.path(k)).map(k => ({ [k]: regex }));
    }
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1)); const limit = 30;
    const [docs, total] = await Promise.all([
      config.model.find(filter).select('_id id name ownerName vendorName storeName email phone mobile role vendorId createdAt')
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      config.model.countDocuments(filter),
    ]);
    const roles = req.params.type === 'staff' ? [...new Set([...STAFF_ROLES,
      ...(await CustomRole.find({ isActive: true }).select('roleKey').lean()).map(r => r.roleKey)])] : [];
    return res.json({ success: true, data: docs.map(d => account(req.params.type, d)), total, page, pages: Math.ceil(total / limit), roles });
  } catch (error) { next(error); }
}
export async function updateLoginAccount(req, res, next) {
  try {
    const config = definition(req, res); if (!config) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, 'Invalid account ID');
    const doc = await config.model.findById(req.params.id); if (!doc) return fail(res, 404, 'Account not found');
    const body = req.body || {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2 || name.length > 100) return fail(res, 400, 'Name must contain 2 to 100 characters');
      doc[config.name || 'name'] = name;
    }
    if (body.email !== undefined && config.model.schema.path('email')) {
      const email = String(body.email).trim().toLowerCase();
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, 'Enter a valid email');
      doc.email = email;
    }
    if (body.phone !== undefined) {
      const phone = String(body.phone).replace(/\D/g, '').slice(-10);
      if (!/^[6-9]\d{9}$/.test(phone)) return fail(res, 400, 'Enter a valid 10-digit Indian mobile number');
      doc[config.phone || 'phone'] = phone;
      if (req.params.type === 'vendor') doc.phone = phone;
    }
    if (body.role !== undefined && body.role !== doc.role) {
      if (req.params.type !== 'staff') return fail(res, 400, 'This account uses a dedicated role. Edit its account details here.');
      const role = String(body.role).trim();
      if (!STAFF_ROLES.includes(role) && !await CustomRole.exists({ roleKey: role, isActive: true })) return fail(res, 400, 'Select a valid staff role');
      doc.role = role;
    }
    for (const field of ['vendorName', 'storeName']) {
      if (body[field] !== undefined && config.model.schema.path(field)) doc[field] = String(body[field]).trim();
    }
    if (body.vendorId !== undefined && req.params.type === 'delivery_manager') {
      const vendorId = String(body.vendorId).trim();
      if (!await Vendor.exists({ id: vendorId, status: 'Active' })) return fail(res, 400, 'Select an active multivendor owner');
      doc.vendorId = vendorId;
    }
    if (body.password) {
      const password = String(body.password);
      if (password.length < 6) return fail(res, 400, 'Password must contain at least 6 characters');
      doc.password = config.hash ? await bcrypt.hash(password, 10) : password;
    }
    await doc.save();
    return res.json({ success: true, data: account(req.params.type, doc), message: 'Account updated' });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, 'Email or mobile number is already registered');
    if (error.name === 'ValidationError') return fail(res, 400, error.message);
    next(error);
  }
}
export async function deleteLoginAccount(req, res, next) {
  try {
    const config = definition(req, res); if (!config) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, 'Invalid account ID');
    if (String(req.user.id) === req.params.id) return fail(res, 400, 'You cannot delete the account you are currently using');
    const doc = await config.model.findById(req.params.id); if (!doc) return fail(res, 404, 'Account not found');
    if (req.params.type === 'vendor') return deleteVendorAdmin(req, res, next);
    await doc.deleteOne();
    return res.json({ success: true, message: 'Login account deleted. Historical orders and financial records are retained.' });
  } catch (error) { next(error); }
}
