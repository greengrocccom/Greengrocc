import DeliveryManager from "../models/DeliveryManager.js";
import { Vendor } from "../../../farmer-manager-service/src/models.js";

export const DEFAULT_DELIVERY_RADIUS_KM = 5;
export const ORDER_ROUTING_RADIUS_KM = 3;
const toNumber = value => {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
export function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = degrees => degrees * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export function readCoords(source = {}) {
  const lat = toNumber(source.location?.lat ?? source.lat ?? source.latitude ?? source.customerLat);
  const lng = toNumber(source.location?.lng ?? source.lng ?? source.longitude ?? source.customerLng);
  return lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180 ? null : { lat, lng };
}
const pincodeOf = value => /^\d{6}$/.test(String(value || '').trim()) ? String(value).trim() : '';
const radiusOf = store => toNumber(store.deliveryRadiusKm) > 0 ? Number(store.deliveryRadiusKm) : DEFAULT_DELIVERY_RADIUS_KM;

/** Instant/Ready2Cook: nearest serviceable store. Preorders may fall back to the same PIN. */
export async function resolveDarkStoreForOrder(address = {}, { allowPincodeFallback = false, anyDistance = false } = {}) {
  const city = String(address.city || '').trim();
  const coords = readCoords(address);
  const active = await DeliveryManager.find({ isActive: true });
  const vendorIds = [...new Set(active.map(store => String(store.vendorId || '')).filter(Boolean))];
  const vendors = vendorIds.length ? await Vendor.find({ id: { $in: vendorIds }, status: 'Active' }).select('id').lean() : [];
  const eligibleIds = new Set(vendors.map(vendor => vendor.id));
  const stores = active.filter(store => eligibleIds.has(String(store.vendorId || '')));
  const empty = reason => ({ manager: null, reason, city, distanceKm: null });
  if (!stores.length) return empty('no_active_stores');
  const rows = stores.map(manager => {
    const pin = readCoords(manager);
    return { manager, distanceKm: coords && pin ? haversineKm(coords.lat, coords.lng, pin.lat, pin.lng) : null };
  });
  const nearest = candidates => [...candidates].sort((a, b) =>
    (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || String(a.manager._id).localeCompare(String(b.manager._id)))[0];
  const result = (row, reason) => ({ ...row, reason, city });
  const reachable = nearest(rows.filter(row => row.distanceKm != null && (anyDistance || row.distanceKm <= radiusOf(row.manager))));
  if (reachable) return result(reachable, anyDistance ? 'nearest_for_pickup' : reachable.distanceKm <= ORDER_ROUTING_RADIUS_KM ? 'within_3km' : 'within_store_radius');
  if (allowPincodeFallback || anyDistance) {
    const pincode = pincodeOf(address.pincode);
    const samePin = pincode ? nearest(rows.filter(row => pincodeOf(row.manager.pincode) === pincode)) : null;
    if (samePin) return result(samePin, 'same_pincode');
  }
  return empty(coords ? 'no_store_within_radius' : 'no_store_in_area');
}

/** Address-only callers follow the same nearest-store serviceability rules. */
export function resolveDarkStoreForAddress(address = {}) {
  return resolveDarkStoreForOrder(address);
}
