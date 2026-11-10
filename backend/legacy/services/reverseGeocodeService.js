import axios from "axios";
import { lookupPincode } from "./indiaLocationService.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pincodeData = require("india-pincode-lookup/pincodes.json");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

/** First two PIN digits allowed per Indian state (India Post circles). */
const STATE_PIN_PREFIXES = {
  maharashtra: [40, 41, 42, 43, 44],
  "andhra pradesh": [50, 51, 52, 53],
  telangana: [50, 51, 52, 53],
  karnataka: [56, 57, 58, 59],
  "tamil nadu": [60, 61, 62, 63, 64],
  kerala: [67, 68, 69],
  delhi: [11],
  gujarat: [36, 37, 38, 39],
  rajasthan: [30, 31, 32, 33, 34],
  "uttar pradesh": [20, 21, 22, 23, 24, 25, 26, 27, 28],
  "west bengal": [70, 71, 72, 73, 74],
  punjab: [14, 15, 16],
  haryana: [12, 13],
  goa: [40, 403],
  "madhya pradesh": [45, 46, 47, 48],
  chhattisgarh: [49],
};

function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Build in-memory index of official post offices by district for instant locality resolution
const districtOfficeMap = new Map();
for (const entry of pincodeData) {
  const dist = norm(entry.districtName);
  if (!dist) continue;
  if (!districtOfficeMap.has(dist)) {
    districtOfficeMap.set(dist, []);
  }
  districtOfficeMap.get(dist).push({
    name: norm(entry.officeName),
    cleanName: norm(entry.officeName.replace(/\b(s\.o|b\.o|h\.o|g\.p\.o)\b/gi, "").trim()),
    pincode: String(entry.pincode).padStart(6, "0"),
  });
}

// Well-known locality aliases within major delivery districts (e.g. Pune)
// where India Post office names differ slightly from colloquial/OSM suburb names
const LOCALITY_PIN_ALIASES = {
  pune: {
    balewadi: "411045",
    "balewadi gaon": "411045",
    "balewadi high street": "411045",
    mahalunge: "411045",
    mhalunge: "411045",
    "hinjawadi phase 1": "411057",
    "hinjawadi phase 2": "411057",
    "hinjawadi phase 3": "411057",
    "hinjewadi phase 1": "411057",
    "hinjewadi phase 2": "411057",
    "hinjewadi phase 3": "411057",
    hinjewadi: "411057",
    hinjawadi: "411057",
    baner: "411045",
    "baner gaon": "411045",
    wakad: "411057",
    "wakad gaav": "411057",
    "wakad gaon": "411057",
    aundh: "411007",
    pashan: "411021",
    bavdhan: "411021",
    sus: "411021",
    tathawade: "411033",
    thathawade: "411033",
    punawale: "411033",
    ravet: "412101",
    kiwale: "412101",
    marunji: "411057",
    marunje: "411057",
    "pimple saudagar": "411027",
    "pimple nilakh": "411027",
    "pimple gurav": "411061",
    moshi: "412105",
    chakan: "410501",
    kharadi: "411014",
    viman: "411014",
    "viman nagar": "411014",
    hadapsar: "411028",
    magarpatta: "411028",
    kothrud: "411038",
    warje: "411058",
    dhayari: "411041",
  },
};

function parsePincode(raw) {
  const pin = String(raw || "").replace(/\D/g, "").slice(0, 6);
  return /^\d{6}$/.test(pin) ? pin : "";
}

function pinPrefix(pincode) {
  return parseInt(String(pincode).slice(0, 2), 10);
}

function pincodeValidForState(pincode, state) {
  const pin = parsePincode(pincode);
  if (!pin) return false;

  // Validate against official India Post dataset (rejects fake OSM codes like 411115 / 411405)
  const verified = lookupPincode(pin);
  if (verified.error) return false;

  const prefix = pinPrefix(pin);
  const stateKey = norm(state);

  for (const [key, prefixes] of Object.entries(STATE_PIN_PREFIXES)) {
    if (stateKey.includes(key) || key.includes(stateKey)) {
      return prefixes.includes(prefix);
    }
  }

  return true;
}

function stripAdminSuffix(value) {
  return String(value || "")
    .replace(/\s+(city|district|subdistrict|sub-district|taluka|tehsil|division)\b/gi, "")
    .trim();
}

// In India, Nominatim's `county` is the taluka (e.g. "Mulshi Subdistrict") while
// `state_district` is the district ("Pune District"), which customers know as their city.
function extractCity(addr = {}) {
  if (addr.city) return String(addr.city).trim();
  if (addr.town) return String(addr.town).trim();

  for (const admin of [addr.state_district, addr.county]) {
    const name = stripAdminSuffix(admin);
    if (name.length > 2) return name;
  }

  return String(addr.village || "").trim();
}

function extractArea(addr = {}, addresstype = "") {
  const urban = [
    addr.neighbourhood,
    addr.suburb,
    addr.quarter,
    addr.city_district,
    addr.residential,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  if (urban.length) return urban[0];

  if (addresstype === "suburb" && addr.suburb) {
    return String(addr.suburb).trim();
  }

  return String(addr.village || addr.hamlet || "").trim();
}

function buildLabel(area, city, state) {
  const parts = [area, city].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return state || "Current location";
}

function buildAddressLine(area, city, state, pincode) {
  return [area, city, state, pincode].filter(Boolean).join(", ");
}

export function parseNominatimResult(data, coords = {}) {
  const addr = data?.address || {};
  const state = String(addr.state || "").trim();
  const city = extractCity(addr);
  const area = extractArea(addr, data?.addresstype || "");
  const pincode = parsePincode(addr.postcode);
  const label = buildLabel(area, city, state);
  const address =
    buildAddressLine(area, city, state, pincode) ||
    String(data?.display_name || "").trim();

  return {
    lat: coords.lat,
    lng: coords.lng,
    city,
    state,
    area,
    pincode,
    address,
    label,
    pincodeValid: pincode ? pincodeValidForState(pincode, state) : false,
    source: "nominatim",
    zoom: coords.zoom,
  };
}

async function fetchNominatim(lat, lng, zoom) {
  const params = new URLSearchParams({
    format: "json",
    lat: String(lat),
    lon: String(lng),
    zoom: String(zoom),
    addressdetails: "1",
    "accept-language": "en",
  });

  const { data } = await axios.get(`${NOMINATIM_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "GreenGrocc/1.0 (delivery location lookup)",
    },
    timeout: 12000,
  });

  return data;
}

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const NEARBY_PIN_RADIUS_M = 400;

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * OSM village/area boundaries in India often carry a wrong `postal_code`
 * (e.g. Hinjewadi Phase 2 tagged as 411115 instead of 411057). Buildings and
 * offices around the point carry their own `addr:postcode`, so a distance-weighted
 * vote over them is far more reliable.
 */
async function fetchOverpassElements(url, query) {
  const { data } = await axios.post(url, `data=${encodeURIComponent(query)}`, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "GreenGrocc/1.0 (delivery location lookup)",
    },
    timeout: 6000,
  });
  if (!Array.isArray(data?.elements)) throw new Error("Bad Overpass response");
  return data.elements;
}

async function nearbyPostcodeVote(lat, lng) {
  const query = `[out:json][timeout:6];nwr(around:${NEARBY_PIN_RADIUS_M},${lat},${lng})["addr:postcode"];out tags center 150;`;

  let elements;
  try {
    elements = await Promise.any(OVERPASS_URLS.map((url) => fetchOverpassElements(url, query)));
  } catch {
    return null;
  }

  const scores = new Map();
  let samples = 0;
  for (const el of elements) {
    const pin = parsePincode(el.tags?.["addr:postcode"]);
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (!pin || !Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;
    const weight = 1 / Math.max(distanceMeters(lat, lng, pLat, pLng), 50);
    scores.set(pin, (scores.get(pin) || 0) + weight);
    samples += 1;
  }
  if (!samples) return null;

  const total = [...scores.values()].reduce((s, v) => s + v, 0);
  const [pin, score] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return { pin, share: score / total, samples };
}

/** India Post lookup by locality name, restricted to the same district. */
async function indiaPostPincodeForArea(addr = {}) {
  const district = norm(stripAdminSuffix(addr.state_district || addr.county));
  const names = [];
  for (const raw of [addr.neighbourhood, addr.suburb, addr.quarter, addr.village, addr.city_district]) {
    const name = String(raw || "").trim();
    if (!name) continue;
    names.push(name);
    const firstWord = name.split(/\s+/)[0];
    if (firstWord.length > 3 && firstWord !== name) names.push(firstWord);
  }

  const lookups = [...new Set(names)].slice(0, 4).map(async (name) => {
    try {
      const { data } = await axios.get(
        `https://api.postalpincode.in/postoffice/${encodeURIComponent(name)}`,
        { timeout: 5000 }
      );
      const offices = Array.isArray(data?.[0]?.PostOffice) ? data[0].PostOffice : [];
      const match = offices.find(
        (o) => !district || norm(o.District).includes(district) || district.includes(norm(o.District))
      );
      return parsePincode(match?.Pincode);
    } catch {
      return "";
    }
  });
  const pins = await Promise.all(lookups);
  return pins.find(Boolean) || "";
}

function withDeadline(promise, ms, fallback) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function resolvePincodeForLocality(names, district, state) {
  const distKey = norm(district);

  // 1. Check known locality aliases for the district
  if (LOCALITY_PIN_ALIASES[distKey]) {
    const aliasMap = LOCALITY_PIN_ALIASES[distKey];
    for (const raw of names) {
      const q = norm(raw);
      if (!q) continue;
      if (aliasMap[q]) return aliasMap[q];
      for (const [locName, pin] of Object.entries(aliasMap)) {
        if (q === locName || q.includes(locName) || locName.includes(q)) {
          return pin;
        }
      }
    }
  }

  // 2. Search official India Post offices for this district in pincodeData
  const offices = districtOfficeMap.get(distKey) || [];
  for (const raw of names) {
    const q = norm(raw);
    if (!q || q.length < 3) continue;
    const match = offices.find(
      (o) =>
        o.cleanName === q ||
        o.cleanName.startsWith(q + " ") ||
        o.cleanName.endsWith(" " + q) ||
        o.cleanName.includes(" " + q + " ") ||
        o.name.includes("(" + q + ")") ||
        o.name.includes("(" + q)
    );
    if (match) return match.pincode;
  }

  return null;
}

async function correctedPincode(lat, lng, parsed, rawAddress) {
  const district = norm(stripAdminSuffix(rawAddress.state_district || rawAddress.county || parsed.city));
  const localityNames = [
    parsed.area,
    rawAddress.suburb,
    rawAddress.neighbourhood,
    rawAddress.village,
    rawAddress.quarter,
    rawAddress.city_district,
    rawAddress.residential,
  ].filter(Boolean);

  // 1. Check if the detected locality matches a verified specific sub-office PIN
  const localityPin = resolvePincodeForLocality(localityNames, district, parsed.state);
  if (localityPin && pincodeValidForState(localityPin, parsed.state)) {
    return localityPin;
  }

  // 2. Identify generic city GPO fallback or known OSM tagging errors
  const isGenericGpo = Boolean(parsed.pincode && parsed.pincode.endsWith("001"));
  const isKnownOsmErr = parsed.pincode === "411115" || parsed.pincode === "411405";

  // If Nominatim already returned a valid 6-digit postal code that is neither GPO fallback nor known error, keep it
  if (parsed.pincodeValid && parsed.pincode && !isGenericGpo && !isKnownOsmErr) {
    return parsed.pincode;
  }

  // 3. Fallback to Overpass nearby building votes and India Post lookup
  const [vote, postPin] = await Promise.all([
    withDeadline(nearbyPostcodeVote(lat, lng), 4000, null),
    withDeadline(indiaPostPincodeForArea(rawAddress), 4000, ""),
  ]);
  const validVote = vote && pincodeValidForState(vote.pin, parsed.state) ? vote : null;

  if (validVote && validVote.samples >= 2 && validVote.share >= 0.6) return validVote.pin;
  if (postPin && pincodeValidForState(postPin, parsed.state)) return postPin;
  if (validVote && validVote.share >= 0.5) return validVote.pin;

  // 4. If parsed.pincode is valid in official registry and not a known error, use it
  if (parsed.pincodeValid && !isKnownOsmErr) {
    return parsed.pincode;
  }

  return "";
}

const geocodeCache = new Map();
const GEOCODE_CACHE_MS = 60 * 60 * 1000;

function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Reverse-geocode GPS coordinates with India-aware pincode correction.
 * Uses the most detailed Nominatim result for the area name, then fixes the PIN
 * from nearby addressed buildings / India Post.
 */
export async function reverseGeocodeCoords(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return { error: "Invalid coordinates" };
  }

  const key = cacheKey(latNum, lngNum);
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.at < GEOCODE_CACHE_MS) {
    return { ...cached.value, lat: latNum, lng: lngNum };
  }

  let data = null;
  let parsed = null;
  for (const zoom of [18, 16, 14]) {
    try {
      data = await fetchNominatim(latNum, lngNum, zoom);
      if (!data?.address) continue;
      parsed = parseNominatimResult(data, { lat: latNum, lng: lngNum, zoom });
      break;
    } catch {
      // try next zoom
    }
  }

  if (parsed) {
    const pincode = await correctedPincode(latNum, lngNum, parsed, data.address);
    const result = {
      ...parsed,
      pincode,
      pincodeValid: Boolean(pincode && pincodeValidForState(pincode, parsed.state)),
      address: buildAddressLine(parsed.area, parsed.city, parsed.state, pincode) || parsed.address,
    };
    if (result.pincodeValid) {
      if (geocodeCache.size > 2000) geocodeCache.clear();
      geocodeCache.set(key, { at: Date.now(), value: result });
    }
    return result;
  }

  return {
    lat: latNum,
    lng: lngNum,
    city: "",
    state: "",
    area: "",
    pincode: "",
    address: "",
    label: "Current location",
    pincodeValid: false,
    source: "coords_only",
  };
}

/**
 * Forward-geocode a delivery address string to lat/lng (India-biased).
 */
export async function geocodeAddressString(query) {
  const q = String(query || "").trim();
  if (!q) return null;

  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "1",
    countrycodes: "in",
    addressdetails: "0",
  });

  try {
    const { data } = await axios.get(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "GreenGrocc/1.0 (delivery address geocoding)",
        },
        timeout: 12000,
      }
    );

    if (!Array.isArray(data) || !data.length) return null;

    const hit = data[0];
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}
