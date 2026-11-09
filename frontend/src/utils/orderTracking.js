export const TRACKING_STEP_KEYS = ["placed", "confirmed", "packed", "out_for_delivery", "delivered"];

const TRACKABLE_TYPES = new Set(["ready_to_cook", "instant"]);
const CLOSED_STATUSES = new Set(["delivered", "cancelled"]);

export const ORDER_TYPE_LABELS = {
  ready_to_cook: "Ready to Cook",
  instant: "Instant",
  preorder: "Pre-order",
};

/** Courier orders track on the carrier's site and pickups have nothing to track. */
export function canTrackOrder(order) {
  if (!order || order.fulfillmentType === "pickup") return false;
  return !String(order.shipment?.trackingNumber || "").trim();
}

function toPoint(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lat = Number(raw.lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

function toDate(raw) {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeTracking(raw = {}) {
  const orderType = raw.orderType || "instant";
  const trackingEnabled = raw.trackingEnabled === true && TRACKABLE_TYPES.has(orderType);
  const delayMinutes = Number(raw.delay?.minutes) || 0;
  const lastLocation = toPoint(raw.lastLocation);

  return {
    orderId: String(raw.orderId || ""),
    storeOrderId: raw.storeOrderId ? String(raw.storeOrderId) : null,
    orderNumber: raw.orderNumber || "",
    orderType,
    trackingEnabled,
    liveTracking: raw.liveTracking === true,
    riderPhase: raw.riderPhase || null,
    status: raw.status || "placed",
    timeline: (Array.isArray(raw.timeline) ? raw.timeline : []).map((step) => ({
      key: String(step?.key || ""),
      label: String(step?.label || ""),
      done: step?.done === true,
      current: step?.current === true,
      at: toDate(step?.at),
    })),
    otherParts: Array.isArray(raw.otherParts) ? raw.otherParts : [],
    refreshRouteSeconds: Math.min(60, Math.max(30, Number(raw.refreshRouteSeconds) || 45)),
    preOrder: raw.preOrder && typeof raw.preOrder === "object" ? raw.preOrder : null,
    driver: raw.driver?.name || raw.driver?.phone
      ? {
          name: raw.driver.name || "Delivery partner",
          phone: String(raw.driver.phone || ""),
          vehicleType: raw.driver.vehicleType || "",
        }
      : null,
    storeName: raw.store?.name || "",
    storeLocation: toPoint(raw.store),
    destination: toPoint(raw.destination),
    lastLocation: lastLocation
      ? { ...lastLocation, heading: Number(raw.lastLocation?.heading) || null, at: toDate(raw.lastLocation?.updatedAt) }
      : null,
    eta: raw.eta?.text
      ? {
          text: String(raw.eta.text),
          seconds: Number(raw.eta.seconds) || 0,
          distanceMeters: Number(raw.eta.distanceMeters) || 0,
          fromStore: raw.eta.fromStore === true,
        }
      : null,
    routePolyline: raw.route?.polyline ? String(raw.route.polyline) : "",
    delay: delayMinutes > 0 ? { minutes: delayMinutes, expectedBy: toDate(raw.delay?.expectedBy) } : null,
  };
}

export function isTrackingClosed(tracking) {
  return CLOSED_STATUSES.has(tracking?.status);
}

export function showsLiveMap(tracking) {
  return Boolean(tracking?.trackingEnabled) && TRACKABLE_TYPES.has(tracking?.orderType);
}

/** Apply an `order_status` socket event before the full refetch lands. */
export function withStatus(tracking, nextStatus, live, riderPhase) {
  const reached = TRACKING_STEP_KEYS.indexOf(nextStatus);
  const timeline =
    reached < 0
      ? tracking.timeline
      : TRACKING_STEP_KEYS.map((key, index) => {
          const previous = tracking.timeline[index];
          return {
            key,
            label: previous?.label || key,
            done: index <= reached,
            current: index === reached,
            at: previous?.at || (index === reached ? new Date() : null),
          };
        });
  return {
    ...tracking,
    status: nextStatus,
    liveTracking: typeof live === "boolean" ? live : tracking.liveTracking,
    riderPhase: riderPhase !== undefined ? riderPhase : tracking.riderPhase,
    timeline,
  };
}

/** Decodes a Google encoded polyline (what the backend and OSRM return). */
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

export function metersBetween(a, b) {
  if (!a || !b) return Infinity;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return "";
  if (meters <= 30) return "Near you";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km away`;
  return `${Math.round(meters)} m away`;
}

/**
 * The part of `route` still ahead of the rider. Matching only moves forward from
 * `fromIndex`, so a route that loops back past the rider is not skipped ahead.
 * Returns the matched index, the points from the rider onward and their length.
 */
export function routeAhead(route, rider, fromIndex = 0) {
  if (!rider || route.length < 2) return null;
  let index = Math.min(fromIndex, route.length - 1);
  let best = metersBetween(rider, route[index]);
  for (let i = index + 1; i < route.length; i += 1) {
    const meters = metersBetween(rider, route[i]);
    if (meters < best) {
      best = meters;
      index = i;
    }
  }
  const points = [rider, ...route.slice(index + 1)];
  return { index, points, meters: routeLength(points) };
}

export function routeLength(points) {
  let meters = 0;
  for (let i = 1; i < points.length; i += 1) meters += metersBetween(points[i - 1], points[i]);
  return meters;
}

export function etaText(seconds) {
  const minutes = Math.min(180, Math.max(1, Math.round(seconds / 60)));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

const roadRouteCache = new Map();

/** Street-level route from OSRM, used when the server only has a straight-line estimate. */
export async function fetchRoadRoute(origin, destination) {
  const key = [origin.lat, origin.lng, destination.lat, destination.lng].map((n) => n.toFixed(4)).join(",");
  if (roadRouteCache.has(key)) return roadRouteCache.get(key);
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const route = data?.code === "Ok" ? data.routes?.[0] : null;
    const points = route?.geometry ? decodePolyline(route.geometry) : [];
    if (points.length < 2) return null;
    const result = {
      points,
      distanceMeters: Math.round(Number(route.distance) || 0),
      seconds: Math.round(Number(route.duration) || 60),
      text: etaText(Number(route.duration) || 60),
    };
    if (roadRouteCache.size > 50) roadRouteCache.delete(roadRouteCache.keys().next().value);
    roadRouteCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}
