import DeliveryManager from "../models/DeliveryManager.js";

/** Customer orders route to a dark store only if it is inside this radius. */
export const DEFAULT_DELIVERY_RADIUS_KM = 5;

/** Department-wise routing: dark store must be within this distance of the customer. */
export const ORDER_ROUTING_RADIUS_KM = 3;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const norm = (value) => String(value || "").trim().toLowerCase();

const citySlug = (value) =>
  norm(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function readCoords(source = {}) {
  const lat = toNumber(
    source.location?.lat ??
      source.lat ??
      source.latitude ??
      source.customerLat
  );
  const lng = toNumber(
    source.location?.lng ??
      source.lng ??
      source.longitude ??
      source.customerLng
  );
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function storeRadiusKm(manager) {
  const custom = toNumber(manager?.deliveryRadiusKm);
  return custom != null && custom > 0 ? custom : DEFAULT_DELIVERY_RADIUS_KM;
}

function addressHaystack(address = {}) {
  return [
    address.area,
    address.streetArea,
    address.landmark,
    address.address,
    address.fullAddress,
    address.label,
    address.shopName,
    address.shopNo,
  ]
    .map(norm)
    .filter(Boolean)
    .join(" ");
}

function matchesCity(manager, city) {
  if (!city) return false;
  const wanted = norm(city);
  const slug = citySlug(city);
  return (
    norm(manager.city) === wanted ||
    (manager.cityId && citySlug(manager.cityId) === slug)
  );
}

function matchesArea(manager, address) {
  const area = norm(manager.area);
  const storeName = norm(manager.storeName);
  const name = norm(manager.name);

  const explicitArea = norm(address.area || address.streetArea);
  if (explicitArea) {
    if (area && (explicitArea === area || explicitArea.includes(area) || area.includes(explicitArea))) return true;
    if (storeName && (explicitArea.includes(storeName) || storeName.includes(explicitArea))) return true;
  }

  const haystack = addressHaystack(address);
  if (!haystack) return false;
  if (area && haystack.includes(area)) return true;
  if (storeName && haystack.includes(storeName)) return true;
  if (name && haystack.includes(name)) return true;
  return false;
}

function withDistance(manager, coords) {
  const store = readCoords(manager);
  if (!coords || !store) return { manager, distanceKm: null };
  return {
    manager,
    distanceKm: haversineKm(coords.lat, coords.lng, store.lat, store.lng),
  };
}

function pickNearest(rows) {
  return [...rows].sort((a, b) => {
    const da = a.distanceKm == null ? Number.POSITIVE_INFINITY : a.distanceKm;
    const db = b.distanceKm == null ? Number.POSITIVE_INFINITY : b.distanceKm;
    return da - db;
  })[0] || null;
}

/**
 * Pick the dark store that should fulfil this customer address.
 *
 * Area (primary when set): the manager registered for that area — each area
 *   has its own inventory on the customer site.
 * GPS (when no area match): nearest active store within delivery radius.
 */
export async function resolveDarkStoreForAddress(address = {}) {
  const city = String(address.city || "").trim();
  const coords = readCoords(address);
  const explicitArea = norm(address.area);

  const active = await DeliveryManager.find({ isActive: true });
  if (!active.length) {
    return { manager: null, reason: "no_active_stores", city, distanceKm: null };
  }

  const pickFromAreaMatches = (pool) => {
    const inArea = pool.filter((m) => matchesArea(m, address));
    if (!inArea.length) return null;
    const picked = pickNearest(inArea.map((manager) => withDistance(manager, coords)));
    return {
      manager: picked?.manager || inArea[0],
      reason: explicitArea ? "area_match" : city ? "city_area" : "area",
      city,
      distanceKm: picked?.distanceKm ?? null,
    };
  };

  // 1. Area-first — show that area's delivery manager inventory on the frontend
  if (explicitArea) {
    let candidates = active;
    if (city) {
      const inCity = active.filter((m) => matchesCity(m, city));
      if (inCity.length) candidates = inCity;
    }
    const areaMatch = pickFromAreaMatches(candidates);
    if (areaMatch) return areaMatch;
  }

  // 2. GPS — nearest store within delivery radius
  if (coords) {
    const inRadius = active
      .map((manager) => withDistance(manager, coords))
      .filter(
        (row) =>
          row.distanceKm != null && row.distanceKm <= storeRadiusKm(row.manager)
      );

    const nearest = pickNearest(inRadius);
    if (nearest) {
      return {
        manager: nearest.manager,
        reason: "within_radius",
        city,
        distanceKm: nearest.distanceKm,
      };
    }
  }

  // 3. City + area text fallback
  let candidates = active;
  if (city) {
    const inCity = active.filter((m) => matchesCity(m, city));
    if (!inCity.length && !coords) {
      return { manager: null, reason: "no_store_in_city", city, distanceKm: null };
    }
    if (inCity.length) candidates = inCity;
  }

  const areaMatch = pickFromAreaMatches(candidates);
  if (areaMatch) return areaMatch;

  return {
    manager: null,
    reason: coords ? "no_store_within_radius" : "no_store_in_area",
    city,
    distanceKm: null,
  };
}

const normPincode = (value) => String(value || "").replace(/\D/g, "").slice(0, 6);

/**
 * Pick the dark store for a customer order / catalog, department-wise:
 *  1. Nearest active dark store within ORDER_ROUTING_RADIUS_KM (all departments).
 *  2. Pre-order only (`allowPincodeFallback`): a dark store registered under the same pincode.
 *  3. No GPS for the address: fall back to area / city matching so the order is not dropped.
 */
/**
 * `anyDistance` (store pickup): the customer travels to the store, so the nearest
 * active store wins even beyond the delivery radius.
 */
export async function resolveDarkStoreForOrder(
  address = {},
  { allowPincodeFallback = false, anyDistance = false } = {}
) {
  const city = String(address.city || "").trim();
  const coords = readCoords(address);

  const active = await DeliveryManager.find({ isActive: true });
  if (!active.length) {
    return { manager: null, reason: "no_active_stores", city, distanceKm: null };
  }

  // 1. Explicit Area / Address match FIRST:
  // If the customer specifically selected or entered an area/address (e.g. Kothrud),
  // route to that area's dark store so the customer sees that store's catalog even
  // if their browser's physical GPS is elsewhere.
  const areaMatches = active.filter((m) => matchesArea(m, address));
  if (areaMatches.length > 0) {
    const picked = pickNearest(areaMatches.map((manager) => withDistance(manager, coords)));
    return {
      manager: picked?.manager || areaMatches[0],
      reason: "area_match",
      city: picked?.manager?.city || city,
      distanceKm: picked?.distanceKm ?? null,
    };
  }

  if (coords) {
    const withDistances = active
      .map((manager) => withDistance(manager, coords))
      .filter((row) => row.distanceKm != null);
    const nearest = pickNearest(
      withDistances.filter((row) => row.distanceKm <= ORDER_ROUTING_RADIUS_KM)
    );
    if (nearest) {
      return {
        manager: nearest.manager,
        reason: `within_${ORDER_ROUTING_RADIUS_KM}km`,
        city,
        distanceKm: nearest.distanceKm,
      };
    }

    // 2. Check within each dark store's configured delivery radius (e.g. 5km - 10km)
    const inStoreRadius = withDistances.filter(
      (row) => row.distanceKm <= storeRadiusKm(row.manager)
    );
    const nearestInRadius = pickNearest(inStoreRadius);
    if (nearestInRadius) {
      return {
        manager: nearestInRadius.manager,
        reason: "within_store_radius",
        city,
        distanceKm: nearestInRadius.distanceKm,
      };
    }

    if (anyDistance) {
      const nearestAny = pickNearest(withDistances);
      if (nearestAny) {
        return {
          manager: nearestAny.manager,
          reason: "nearest_for_pickup",
          city,
          distanceKm: nearestAny.distanceKm,
        };
      }
    }
  }

  if (anyDistance) allowPincodeFallback = true;

  if (allowPincodeFallback) {
    const pincode = normPincode(address.pincode);
    if (pincode.length === 6) {
      const samePincode = active.filter((m) => normPincode(m.pincode) === pincode);
      if (samePincode.length) {
        const picked = pickNearest(samePincode.map((manager) => withDistance(manager, coords)));
        return {
          manager: picked?.manager || samePincode[0],
          reason: "same_pincode",
          city,
          distanceKm: picked?.distanceKm ?? null,
        };
      }
    }

    const cityKey = city.toLowerCase();
    const sameCity = cityKey
      ? active.filter((m) => String(m.city || "").trim().toLowerCase() === cityKey)
      : [];
    if (sameCity.length) {
      const picked = pickNearest(sameCity.map((manager) => withDistance(manager, coords)));
      return {
        manager: picked?.manager || sameCity[0],
        reason: "same_city",
        city,
        distanceKm: picked?.distanceKm ?? null,
      };
    }
  }

  // Fall back to city matching so an explicitly chosen city is served by a dark store in that city
  const cityResolved = await resolveDarkStoreForAddress(address);
  if (cityResolved?.manager) {
    return cityResolved;
  }

  return {
    manager: null,
    reason: coords
      ? `no_store_within_radius`
      : `no_store_in_area`,
    city,
    distanceKm: null,
  };
}
