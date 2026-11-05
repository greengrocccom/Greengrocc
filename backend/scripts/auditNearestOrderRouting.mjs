// Read-only diagnostics. Run without --live for isolated resolver checks.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import DeliveryManager from '../delivery-service/src/models/DeliveryManager.js';
import { resolveDarkStoreForOrder, readCoords, haversineKm } from '../delivery-service/src/services/darkStoreResolver.js';

if (!process.argv.includes('--live')) {
  const original = DeliveryManager.find;
  const near = { _id: 'near', isActive: true, storeName: 'Near Store', area: 'Near Area', city: 'Pune', latitude: 18.501, longitude: 73.8, deliveryRadiusKm: 5 };
  const far = { _id: 'far', isActive: true, storeName: 'Far Store', area: 'Far Area', city: 'Pune', latitude: 18.56, longitude: 73.8, deliveryRadiusKm: 5 };
  DeliveryManager.find = async () => [far, near];
  try {
    for (const [scenario, address] of [
      ['GPS without matching area', { lat: 18.5, lng: 73.8 }],
      ['GPS with farther matching area', { lat: 18.5, lng: 73.8, area: 'Far Area' }],
      ['Missing GPS with matching area', { area: 'Far Area', city: 'Pune' }],
    ]) {
      const result = await resolveDarkStoreForOrder(address);
      console.log(JSON.stringify({ scenario, selected: result.manager?._id, reason: result.reason,
        distanceKm: result.distanceKm, nearestByGps: address.lat ? 'near' : null,
        exceedsSelectedRadius: result.distanceKm != null && result.distanceKm > result.manager.deliveryRadiusKm }));
    }
  } finally { DeliveryManager.find = original; }
} else {
  const cfg = dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true }).parsed || {};
  if (!cfg.MONGODB_PRODUCTION_URI) throw new Error('Production URI not configured');
  const watchdog = setTimeout(() => { console.error('Read-only audit timed out'); process.exit(2); }, 30000);
  let conn;
  try {
    conn = await mongoose.createConnection(cfg.MONGODB_PRODUCTION_URI, {
      dbName: cfg.MONGODB_PRODUCTION_DB_NAME || undefined, autoIndex: false, autoCreate: false,
      serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, socketTimeoutMS: 10000,
    }).asPromise();
    const [stores, vendors, orders] = await Promise.all([
      conn.db.collection('deliverymanagers').find({}, { projection: { storeName: 1, isActive: 1, latitude: 1, longitude: 1, deliveryRadiusKm: 1, vendorId: 1, createdAt: 1 } }).toArray(),
      conn.db.collection('vendors').find({}, { projection: { id: 1, status: 1 } }).toArray(),
      conn.db.collection('orders').find({ status: { $ne: 'attempted' } }, { projection: { orderNumber: 1, status: 1, fulfillmentType: 1, paymentStatus: 1, deliveryAddress: 1, routingError: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(100).toArray(),
    ]);
    const parts = await conn.db.collection('storeorders').find({ sourceOrderId: { $in: orders.map(o => o._id) } }, {
      projection: { sourceOrderId: 1, managerId: 1, status: 1, isPreOrder: 1, routingReason: 1, customerLat: 1, customerLng: 1, distanceKm: 1, createdAt: 1 },
    }).toArray();
    const active = stores.filter(s => s.isActive);
    const byId = new Map(stores.map(s => [String(s._id), s]));
    const vendorById = new Map(vendors.map(v => [v.id, v]));
    const observations = orders.map(order => {
      const routed = parts.filter(p => String(p.sourceOrderId) === String(order._id));
      return { orderNumber: order.orderNumber || String(order._id), status: order.status,
        fulfillmentType: order.fulfillmentType || 'delivery', createdAt: order.createdAt,
        routingError: order.routingError || '', storeParts: routed.map(part => {
          const coords = readCoords({ customerLat: part.customerLat, customerLng: part.customerLng }) || readCoords(order.deliveryAddress || {});
          const ranked = coords ? active.flatMap(store => {
            const loc = readCoords(store); return loc ? [{ id: String(store._id), distanceKm: haversineKm(coords.lat, coords.lng, loc.lat, loc.lng) }] : [];
          }).sort((a, b) => a.distanceKm - b.distanceKm) : [];
          const assigned = byId.get(String(part.managerId));
          const assignedDistanceKm = ranked.find(r => r.id === String(part.managerId))?.distanceKm ?? null;
          return { store: assigned?.storeName || 'Missing store', status: part.status, isPreOrder: part.isPreOrder,
            routingReason: part.routingReason, storedDistanceKm: part.distanceKm,
            assignedDistanceKm, nearestStore: byId.get(ranked[0]?.id)?.storeName || null,
            matchesNearestCurrentlyActive: ranked.length ? ranked[0].id === String(part.managerId) : null,
            parentActive: vendorById.get(assigned?.vendorId)?.status === 'Active' };
        }) };
    });
    console.log(JSON.stringify({ database: conn.name, readOnly: true, checkedAt: new Date(),
      comparisonNote: 'Distances compare current active stores and their current coordinates; historical store availability may differ.',
      stores: stores.map(s => ({ name: s.storeName, active: s.isActive, hasValidGps: Boolean(readCoords(s)), deliveryRadiusKm: s.deliveryRadiusKm,
        vendorId: s.vendorId || '', parentActive: vendorById.get(s.vendorId)?.status === 'Active' })),
      ordersChecked: orders.length, ordersWithStoreParts: observations.filter(o => o.storeParts.length).length,
      confirmedWithoutStoreParts: observations.filter(o => o.status === 'confirm' && !o.storeParts.length).length,
      observations,
    }, null, 2));
  } catch (error) { console.error('Production audit failed: ' + (error.code || error.name)); process.exitCode = 1; }
  finally { if (conn) await conn.close(); clearTimeout(watchdog); }
}
