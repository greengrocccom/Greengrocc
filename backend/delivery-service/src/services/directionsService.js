import { haversineKm } from "./darkStoreResolver.js";

const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";
const REQUEST_TIMEOUT_MS = 5000;
/** Reuse a route while the rider is still near the origin it was computed from. */
const CACHE_TTL_MS = 30_000;
const REUSE_RADIUS_KM = 0.075;
const MAX_CACHE_ENTRIES = 500;
/** Used when Google is not configured or fails: straight line × road factor at city speed. */
const FALLBACK_ROAD_FACTOR = 1.3;
const FALLBACK_SPEED_KMPH = 22;

const cache = new Map();

export function toPoint(value) {
  if (!value) return null;
  // If wrapped in location or point object
  if (value.location && typeof value.location === "object") return toPoint(value.location);
  if (value.point && typeof value.point === "object") return toPoint(value.point);

  // GeoJSON coordinates [longitude, latitude]
  if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
    const lng = Number(value.coordinates[0]);
    const lat = Number(value.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) {
      return { lat, lng };
    }
  }

  const lat = Number(value.lat ?? value.latitude);
  const lng = Number(value.lng ?? value.longitude);
  if (value.lat == null && value.latitude == null) return null;
  if (value.lng == null && value.longitude == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

export function formatEta(seconds) {
  const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** Google encoded-polyline format, so the app decodes Google and fallback routes the same way. */
export function encodePolyline(points = []) {
  let lastLat = 0;
  let lastLng = 0;
  let out = "";
  const encodeValue = (value) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return chunk + String.fromCharCode(v + 63);
  };
  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);
    out += encodeValue(lat - lastLat) + encodeValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

export function decodePolyline(encoded = "") {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    if (index >= encoded.length) break;
    lng += next();
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function estimateRoute(origin, destination) {
  const km = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng) * FALLBACK_ROAD_FACTOR;
  const seconds = Math.max(60, Math.round((km / FALLBACK_SPEED_KMPH) * 3600));
  return {
    polyline: encodePolyline([origin, destination]),
    distanceMeters: Math.round(km * 1000),
    etaSeconds: seconds,
    etaText: formatEta(seconds),
    source: "estimate",
  };
}

async function fetchGoogleRoutesV2(origin, destination, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 100)}`);
    }
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route || !route.polyline?.encodedPolyline) throw new Error("No route found in Routes v2 response");
    const seconds = Math.max(60, parseInt(route.duration, 10) || 0);
    const distanceMeters = Number(route.distanceMeters || 0);
    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters,
      etaSeconds: seconds,
      etaText: formatEta(seconds),
      source: "google_v2",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGoogleRoute(origin, destination, apiKey) {
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode: "driving",
    departure_time: "now",
    key: apiKey,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${DIRECTIONS_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== "OK" || !data.routes?.length) {
      throw new Error(`${data.status || "NO_ROUTE"} ${data.error_message || ""}`.trim());
    }
    const route = data.routes[0];
    const leg = route.legs?.[0] || {};
    const seconds = Number(leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0);
    return {
      polyline: route.overview_polyline?.points || encodePolyline([origin, destination]),
      distanceMeters: Number(leg.distance?.value || 0),
      etaSeconds: seconds,
      etaText: formatEta(seconds),
      source: "google",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOsrmRoute(origin, destination) {
  const url = `http://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error(`OSRM code: ${data.code}`);
    }
    const route = data.routes[0];
    const distanceMeters = Math.round(route.distance || 0);
    const seconds = Math.max(60, Math.round(route.duration || 0));
    return {
      polyline: route.geometry,
      distanceMeters,
      etaSeconds: seconds,
      etaText: formatEta(seconds),
      source: "osrm",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Route polyline + ETA from origin to destination.
 * Order of resolution:
 * 1. Google Routes API v2 (if GOOGLE_MAPS_API_KEY is configured and permitted)
 * 2. Legacy Google Directions API
 * 3. OSRM driving route (free turn-by-turn road geometry & realistic street ETA)
 * 4. Fallback straight-line road estimate
 * Cached per `cacheKey` for 30 s as long as the origin moved less than 75 m.
 */
export async function getRouteAndEta({ cacheKey = "", origin, destination }) {
  const from = toPoint(origin);
  const to = toPoint(destination);
  if (!from || !to) return null;

  const cached = cacheKey ? cache.get(cacheKey) : null;
  if (
    cached &&
    Date.now() - cached.at < CACHE_TTL_MS &&
    haversineKm(cached.origin.lat, cached.origin.lng, from.lat, from.lng) < REUSE_RADIUS_KM &&
    cached.destination.lat === to.lat &&
    cached.destination.lng === to.lng
  ) {
    return cached.result;
  }

  let result = null;
  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();

  // 1. Try Google Routes API v2
  if (apiKey) {
    try {
      result = await fetchGoogleRoutesV2(from, to, apiKey);
    } catch (err) {
      // 2. Try legacy Google Directions API
      try {
        result = await fetchGoogleRoute(from, to, apiKey);
      } catch (errLegacy) {
        // Fall through to OSRM
      }
    }
  }

  // 3. Try OSRM (turn-by-turn road polyline without requiring GCP billing/credentials)
  if (!result) {
    try {
      result = await fetchOsrmRoute(from, to);
    } catch (errOsrm) {
      console.warn("[directions] OSRM route fetch failed:", errOsrm.message);
    }
  }

  // 4. Final fallback straight line estimate
  if (!result) {
    result = estimateRoute(from, to);
  }

  if (cacheKey) {
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { at: Date.now(), origin: from, destination: to, result });
  }
  return result;
}

/**
 * Route origin → stop → destination (rider → dark store → customer): both legs' ETA and
 * distance summed and their polylines joined. `stopEtaSeconds` is the first leg alone.
 */
export async function getRouteViaStop({ cacheKey = "", origin, stop, destination }) {
  const [toStop, fromStop] = await Promise.all([
    getRouteAndEta({ cacheKey: cacheKey && `${cacheKey}:to_stop`, origin, destination: stop }),
    getRouteAndEta({ cacheKey: cacheKey && `${cacheKey}:from_stop`, origin: stop, destination }),
  ]);
  if (!toStop || !fromStop) return null;
  const seconds = toStop.etaSeconds + fromStop.etaSeconds;
  return {
    polyline: encodePolyline([...decodePolyline(toStop.polyline), ...decodePolyline(fromStop.polyline)]),
    distanceMeters: (toStop.distanceMeters || 0) + (fromStop.distanceMeters || 0),
    etaSeconds: seconds,
    etaText: formatEta(seconds),
    stopEtaSeconds: toStop.etaSeconds,
    source: toStop.source === fromStop.source ? toStop.source : `${toStop.source}+${fromStop.source}`,
  };
}

export function clearRouteCache(cacheKey) {
  if (!cacheKey) return;
  for (const key of [cacheKey, `${cacheKey}:to_stop`, `${cacheKey}:from_stop`]) cache.delete(key);
}
