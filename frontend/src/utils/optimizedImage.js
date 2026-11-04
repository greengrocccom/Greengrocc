const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5001").trim().replace(/\/+$/, "");

const OWN_BUCKET_HOST = /^greengrocc[\w.-]*\.s3[.-][\w.-]*amazonaws\.com$/i;
// Same buckets as the backend, so URLs (and caches) stay stable as boxes resize.
const SIZES = [96, 160, 240, 320, 480, 640, 800, 1080, 1440, 1920];
const MAX_PX = SIZES[SIZES.length - 1];

const clampPx = (px) => SIZES.find((size) => size >= px) ?? MAX_PX;

/**
 * Rewrites a remote image URL so the server returns it sized to cover a
 * widthPx × heightPx box (device pixels) as visually lossless WebP. Never asks
 * for fewer pixels than are displayed. Local/unknown URLs are returned as-is.
 */
export function optimizedImageUrl(src, { widthPx, heightPx } = {}) {
  const raw = typeof src === "string" ? src.trim() : "";
  if (!/^https?:\/\//i.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  const h = heightPx > 0 ? clampPx(heightPx) : null;
  const w = widthPx > 0 ? clampPx(widthPx) : h ? null : clampPx(screenWidthPx());
  const host = url.hostname.toLowerCase();

  if (OWN_BUCKET_HOST.test(host) || host === "res.cloudinary.com") {
    const params = new URLSearchParams();
    if (w) params.set("w", String(w));
    if (h) params.set("h", String(h));
    params.set("url", raw);
    return `${API_URL}/api/img?${params}`;
  }

  if (host === "images.unsplash.com") {
    url.searchParams.delete("h");
    url.searchParams.set("q", "85");
    url.searchParams.set("fm", "webp");
    url.searchParams.set("fit", "max");
    // Unsplash can't "cover" a box; double the longer side so cropped slots stay sharp.
    const side = w && h ? clampPx(Math.max(w, h) * 2) : w;
    if (side) url.searchParams.set("w", String(side));
    else url.searchParams.set("h", String(h));
    return url.toString();
  }

  return raw;
}

function screenWidthPx() {
  if (typeof window === "undefined") return 1080;
  return (window.innerWidth || 1080) * (window.devicePixelRatio || 1);
}
