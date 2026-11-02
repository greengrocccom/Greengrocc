/**
 * ShiftEarningService
 *
 * Responsibilities:
 *  - Fetch the applicable Shift for a rider's active booking
 *  - Read deliveryEarningSlabs from that Shift
 *  - Calculate delivery distance using Haversine (GPS coordinates only)
 *  - Find the matching KM slab
 *  - Return the rider earning amount
 *
 * The backend is the ONLY source of truth for rider earnings.
 * Flutter must never submit an earning amount directly.
 */

import Shift from "../models/Shift.js";
import { haversineKm } from "./darkStoreResolver.js";

const istDateString = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

/**
 * Validate earning slabs array for the API layer.
 * Returns { valid: boolean, message: string }
 *
 * @param {Array} slabs
 * @returns {{ valid: boolean, message: string }}
 */
export function validateEarningSlabs(slabs) {
  if (!Array.isArray(slabs)) return { valid: true, message: "" };

  for (let i = 0; i < slabs.length; i++) {
    const s = slabs[i];
    if (s.minKm == null || isNaN(Number(s.minKm)) || Number(s.minKm) < 0) {
      return { valid: false, message: `Slab ${i + 1}: minKm must be >= 0` };
    }
    const minKm = Number(s.minKm);
    const maxKm = Number(s.maxKm);
    if (s.maxKm == null || isNaN(maxKm) || maxKm <= minKm) {
      return { valid: false, message: `Slab ${i + 1}: maxKm (${s.maxKm}) must be greater than minKm (${s.minKm})` };
    }
    if (s.riderAmount == null || isNaN(Number(s.riderAmount)) || Number(s.riderAmount) < 0) {
      return { valid: false, message: `Slab ${i + 1}: riderAmount must be >= 0` };
    }
    // Overlap check
    for (let j = 0; j < i; j++) {
      const a = slabs[j];
      const aMin = Number(a.minKm);
      const aMax = Number(a.maxKm);
      if (minKm < aMax && maxKm > aMin) {
        return {
          valid: false,
          message: `Slabs ${j + 1} (${a.minKm}–${a.maxKm} KM) and ${i + 1} (${s.minKm}–${s.maxKm} KM) overlap`,
        };
      }
    }
  }
  return { valid: true, message: "" };
}

/**
 * Calculate straight-line delivery distance in km between two GPS points.
 * @param {number} lat1 - Pickup/dark store latitude
 * @param {number} lng1 - Pickup/dark store longitude
 * @param {number} lat2 - Customer latitude
 * @param {number} lng2 - Customer longitude
 * @returns {number} Distance in km, rounded to 2 decimal places
 */
export function calculateDeliveryDistanceKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return 0;
  const dist = haversineKm(lat1, lng1, lat2, lng2);
  return Math.round(dist * 100) / 100; // 2dp
}

/**
 * Given a list of earning slabs and a distance in KM,
 * find the slab for that distance.
 * Contiguous bands (0–1, 1–2, 2–3): first band is [min, max], later bands are (min, max].
 * Distance above the highest maxKm uses the last (highest) slab.
 *
 * @param {Array<{minKm: number, maxKm: number, riderAmount: number}>} slabs
 * @param {number} distanceKm
 * @returns {{ minKm: number, maxKm: number, riderAmount: number } | null}
 */
export function findMatchingSlab(slabs, distanceKm) {
  if (!slabs || slabs.length === 0) return null;
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return null;

  const sorted = [...slabs]
    .map((s) => ({
      minKm: Number(s.minKm),
      maxKm: Number(s.maxKm),
      riderAmount: Number(s.riderAmount) || 0,
    }))
    .sort((a, b) => a.minKm - b.minKm || a.maxKm - b.maxKm);

  for (let i = 0; i < sorted.length; i++) {
    const slab = sorted[i];
    const isFirst = i === 0;
    // Till 1 KM → first slab (incl. exactly 1). Next band starts after that point.
    const inRange = isFirst
      ? d >= slab.minKm && d <= slab.maxKm
      : d > slab.minKm && d <= slab.maxKm;
    if (inRange) {
      return {
        minKm: slab.minKm,
        maxKm: slab.maxKm,
        riderAmount: slab.riderAmount,
      };
    }
  }

  const last = sorted[sorted.length - 1];
  if (d > last.maxKm) {
    return {
      minKm: last.minKm,
      maxKm: last.maxKm,
      riderAmount: last.riderAmount,
    };
  }
  return null;
}

/**
 * Resolve the shift whose deliveryEarningSlabs should apply.
 * Prefer explicit shiftId; otherwise find the rider's booked shift that day;
 * finally fall back to any manager shift with slabs.
 */
export async function resolveShiftForEarning({
  shiftId,
  managerId,
  riderId,
  atDate = new Date(),
}) {
  if (shiftId) {
    try {
      const byId = await Shift.findById(shiftId).lean();
      if (byId?.deliveryEarningSlabs?.length) return byId;
      if (byId) return byId; // may still be useful even without slabs
    } catch (_) {}
  }

  const dateString = istDateString(atDate);
  if (managerId && riderId) {
    const booked = await Shift.findOne({
      managerId,
      dateString,
      "slots.bookings.deliveryPartnerId": riderId,
    }).lean();
    if (booked) return booked;
  }

  if (managerId) {
    const sameDay = await Shift.findOne({
      managerId,
      dateString,
    }).lean();
    if (sameDay) return sameDay;

    const recent = await Shift.findOne({
      managerId,
    })
      .sort({ dateString: -1 })
      .lean();
    if (recent) return recent;
  }

  return null;
}

/**
 * Core earning calculation for one delivery.
 *
 * @param {object} params
 * @param {string|ObjectId|null} params.shiftId
 * @param {string|ObjectId|null} [params.managerId]
 * @param {string|ObjectId|null} [params.riderId]
 * @param {Date|string|null} [params.atDate]
 * @param {number} params.storeLat
 * @param {number} params.storeLng
 * @param {number} params.customerLat
 * @param {number} params.customerLng
 */
export async function calculateRiderEarning({
  shiftId,
  managerId = null,
  riderId = null,
  atDate = null,
  storeLat,
  storeLng,
  customerLat,
  customerLng,
}) {
  const distanceKm = calculateDeliveryDistanceKm(storeLat, storeLng, customerLat, customerLng);

  const shift = await resolveShiftForEarning({
    shiftId,
    managerId,
    riderId,
    atDate: atDate ? new Date(atDate) : new Date(),
  });

  // Rate per KM (shift-configured commission rate, fallback to default 10)
  const ratePerKm = shift && Number(shift.ratePerKm) > 0 ? Number(shift.ratePerKm) : 10;

  // Commission is calculated as distance (darkstore to customer) * rate
  // Example: 5 km * ₹10 = ₹50
  let riderEarning = 0;
  let slab = null;

  if (distanceKm > 0) {
    riderEarning = Math.round(distanceKm * ratePerKm * 100) / 100;
  } else if (shift?.deliveryEarningSlabs?.length) {
    slab = findMatchingSlab(shift.deliveryEarningSlabs, distanceKm);
    riderEarning = slab ? Number(slab.riderAmount) || 0 : 0;
  }

  return {
    riderEarning,
    distanceKm,
    ratePerKm,
    earningSlab: slab,
    shift,
    hasSlabs: Boolean(shift?.deliveryEarningSlabs?.length),
    /** Explicit: distance is ALWAYS dark-store → customer (never rider GPS). */
    distanceBasis: "dark_store_to_customer",
    sourceLat: storeLat,
    sourceLng: storeLng,
    customerLat,
    customerLng,
  };
}

/**
 * Persist immutable earning snapshot on the order (store→customer × manager slabs).
 */
export function applyEarningSnapshot(order, darkStore, earningResult, now = new Date()) {
  const slab = earningResult?.earningSlab || null;
  const distanceKm = Number(earningResult?.distanceKm || 0);
  const riderEarning = Number(earningResult?.riderEarning || 0);

  order.deliveryDistanceKm = distanceKm;
  order.riderDeliveryEarning = riderEarning;
  if (slab) {
    order.earningSlab = {
      minKm: slab.minKm,
      maxKm: slab.maxKm,
      riderAmount: slab.riderAmount,
    };
  }
  order.earningCalculatedAt = now;
  order.earningSnapshot = {
    darkStoreId: String(darkStore?._id || order.managerId || ""),
    sourceLat: darkStore?.latitude ?? earningResult?.sourceLat ?? null,
    sourceLng: darkStore?.longitude ?? earningResult?.sourceLng ?? null,
    sourceAddress:
      darkStore?.storeAddress ||
      [darkStore?.area, darkStore?.city].filter(Boolean).join(", ") ||
      "",
    customerLat: order.customerLat ?? earningResult?.customerLat ?? null,
    customerLng: order.customerLng ?? earningResult?.customerLng ?? null,
    customerAddress: order.customerAddress || "",
    distanceKm,
    ratePerKm: earningResult?.ratePerKm || 10,
    slabMinKm: slab?.minKm ?? 0,
    slabMaxKm: slab?.maxKm ?? 0,
    slabRiderAmount: slab?.riderAmount ?? riderEarning,
    shiftId: earningResult?.shift?._id
      ? String(earningResult.shift._id)
      : order.shiftId
        ? String(order.shiftId)
        : "",
    riderEarning,
    calculatedAt: now,
  };
  return order;
}

/**
 * Estimate what to show on the driver offer popup ("Earn up to ₹X").
 * Uses the highest riderAmount from the shift's deliveryEarningSlabs
 * (what the manager set when creating the shift).
 */
export async function estimateOfferEarning({
  shiftId,
  managerId = null,
  riderId = null,
  storeLat,
  storeLng,
  customerLat,
  customerLng,
}) {
  const result = await calculateRiderEarning({
    shiftId,
    managerId,
    riderId,
    storeLat,
    storeLng,
    customerLat,
    customerLng,
  });

  const slabs = result.shift?.deliveryEarningSlabs || [];
  if (slabs.length > 0) {
    const earnUpTo = Math.max(
      ...slabs.map((s) => Number(s.riderAmount) || 0),
      0
    );
    // Prefer exact matched slab when known; popup still shows "up to" max.
    const matched = result.riderEarning > 0 ? result.riderEarning : earnUpTo;
    return {
      estimatedEarnings: matched,
      earnUpTo,
      distanceKm: result.distanceKm,
      hasSlabs: true,
    };
  }

  if (result.riderEarning > 0) {
    return {
      estimatedEarnings: result.riderEarning,
      earnUpTo: result.riderEarning,
      distanceKm: result.distanceKm,
      ratePerKm: result.ratePerKm,
      hasSlabs: result.hasSlabs,
    };
  }

  return {
    estimatedEarnings: 0,
    earnUpTo: 0,
    distanceKm: result.distanceKm || 0,
    hasSlabs: false,
  };
}
