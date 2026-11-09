import { useEffect, useRef, useState } from "react";
import { Clock, LocateFixed, MapPin, MapPinOff } from "lucide-react";
import { loadGoogleMaps } from "../../../utils/googleMapsLoader";
import { formatDistance, metersBetween } from "../../../utils/orderTracking";

const GREEN = "#0C831F";
const GREEN_DARK = "#065F16";
const GREEN_LIGHT = "#22C55E";
const MOVE_MS = 1000;

const svgUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const RIDER_ICON = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="21" fill="${GREEN}" stroke="#fff" stroke-width="4"/>
    <g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" transform="translate(12 12)">
      <circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/>
      <path d="M8 17h7l3-6h-5l-2-4H8"/><path d="M15 6h3l1 5"/>
    </g>
  </svg>`
);

const HOME_ICON = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="17" fill="#fff" stroke="${GREEN}" stroke-width="3"/>
    <path d="M12 19.5 20 13l8 6.5V28h-5.5v-5h-5v5H12z" fill="${GREEN}"/>
  </svg>`
);

const STORE_ICON = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="15" fill="${GREEN_DARK}" stroke="#fff" stroke-width="3"/>
    <path d="M11 15h14l-1.2-4H12.2zM12 16.5h12V25H12z" fill="#fff"/>
  </svg>`
);

function markerIcon(maps, url, size) {
  return {
    url,
    scaledSize: new maps.Size(size, size),
    anchor: new maps.Point(size / 2, size / 2),
  };
}

function LiveTrackingMap({ driver, store, destination, route = [], etaText, distanceMeters, className = "h-[270px]" }) {
  const containerRef = useRef(null);
  const mapsRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef({});
  const shownRef = useRef(null);
  const animationRef = useRef(0);
  const userMovedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        const center = driver || store || destination || { lat: 20.5937, lng: 78.9629 };
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
        map.addListener("dragstart", () => {
          userMovedRef.current = true;
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationRef.current);
      Object.values(overlaysRef.current).flat().forEach((overlay) => overlay?.setMap?.(null));
      overlaysRef.current = {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fitCamera = () => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map || userMovedRef.current) return;
    const rider = shownRef.current;
    const points = [rider, destination, rider ? null : store, ...route].filter(Boolean);
    if (!points.length) return;
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(15);
      return;
    }
    const bounds = new maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    const span = bounds.toSpan();
    if (span.lat() < 0.0006 && span.lng() < 0.0006) {
      map.setCenter(bounds.getCenter());
      map.setZoom(17);
      return;
    }
    map.fitBounds(bounds, 48);
  };

  const setMarker = (key, position, url, size, zIndex) => {
    const maps = mapsRef.current;
    const existing = overlaysRef.current[key];
    if (!position) {
      existing?.setMap(null);
      delete overlaysRef.current[key];
      return null;
    }
    if (existing) {
      existing.setPosition(position);
      return existing;
    }
    const marker = new maps.Marker({
      map: mapRef.current,
      position,
      icon: markerIcon(maps, url, size),
      zIndex,
      clickable: false,
    });
    overlaysRef.current[key] = marker;
    return marker;
  };

  useEffect(() => {
    if (!ready) return;
    const maps = mapsRef.current;
    setMarker("store", store, STORE_ICON, 32, 1);
    setMarker("destination", destination, HOME_ICON, 36, 2);

    overlaysRef.current.halo?.setMap(null);
    overlaysRef.current.halo = destination
      ? new maps.Circle({
          map: mapRef.current,
          center: destination,
          radius: 35,
          fillColor: GREEN,
          fillOpacity: 0.15,
          strokeColor: GREEN_LIGHT,
          strokeWeight: 2,
          clickable: false,
        })
      : null;

    const origin = shownRef.current || driver || store;
    const path = route.length > 1 ? [...route] : [];
    if (path.length && origin && metersBetween(origin, path[0]) > 10) path.unshift(origin);
    if (path.length && destination && metersBetween(destination, path[path.length - 1]) > 10) path.push(destination);
    const lines = overlaysRef.current.route || [];
    if (path.length > 1 && lines.length) {
      lines.forEach((line) => line.setPath(path));
    } else {
      lines.forEach((line) => line.setMap(null));
      overlaysRef.current.route = path.length > 1
        ? [
            { color: GREEN_LIGHT, opacity: 0.25, weight: 12 },
            { color: GREEN_DARK, opacity: 1, weight: 7 },
            { color: GREEN_LIGHT, opacity: 1, weight: 3.5 },
          ].map(
            (style, index) =>
              new maps.Polyline({
                map: mapRef.current,
                path,
                strokeColor: style.color,
                strokeOpacity: style.opacity,
                strokeWeight: style.weight,
                zIndex: index,
                clickable: false,
              })
          )
        : [];
    }
  }, [ready, store, destination, route]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready) fitCamera();
  }, [ready, store, destination, route.length > 1]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    cancelAnimationFrame(animationRef.current);
    const from = shownRef.current;

    if (!driver) {
      shownRef.current = null;
      setMarker("rider", null);
      return;
    }

    if (!from || metersBetween(from, driver) > 2000) {
      shownRef.current = driver;
      setMarker("rider", driver, RIDER_ICON, 44, 3);
      fitCamera();
      return;
    }

    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / MOVE_MS);
      const position = {
        lat: from.lat + (driver.lat - from.lat) * t,
        lng: from.lng + (driver.lng - from.lng) * t,
      };
      shownRef.current = position;
      setMarker("rider", position, RIDER_ICON, 44, 3);
      if (t < 1) animationRef.current = requestAnimationFrame(step);
      else if (!mapRef.current.getBounds()?.contains(position)) fitCamera();
    };
    animationRef.current = requestAnimationFrame(step);
  }, [ready, driver?.lat, driver?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const recenter = () => {
    userMovedRef.current = false;
    fitCamera();
  };

  const distanceLabel = formatDistance(distanceMeters);

  return (
    <div className={`relative w-full overflow-hidden bg-[#E8EEE9] ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />

      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
          <MapPinOff className="h-8 w-8" />
          <p className="text-[13px] font-medium">Map is unavailable right now</p>
        </div>
      ) : null}

      {!failed && (etaText || distanceLabel) ? (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.15)] ring-1 ring-slate-200">
          <MapPin className="h-3.5 w-3.5 text-[#0C831F]" />
          {[etaText ? `ETA ${etaText}` : "", distanceLabel].filter(Boolean).join(" · ")}
          <Clock className="h-3 w-3 text-slate-400" />
        </div>
      ) : null}

      {ready ? (
        <button
          type="button"
          onClick={recenter}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-[0_2px_8px_rgba(15,23,42,0.18)] transition hover:text-[#0C831F]"
          aria-label="Recenter map"
        >
          <LocateFixed className="h-[18px] w-[18px]" />
        </button>
      ) : null}
    </div>
  );
}

export default LiveTrackingMap;
