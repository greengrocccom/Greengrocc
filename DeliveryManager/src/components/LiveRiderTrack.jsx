import { Suspense, lazy } from "react";
import { useAuth } from "../context/AuthContext";
import { mapsLink } from "../hooks/useRiderLiveLocations";

const DeliveryTrackingMap = lazy(() => import("./tracking/DeliveryTrackingMap"));

/**
 * Live tracking card — only while order is in progress (not delivered): the dark store,
 * the customer's drop pin and the rider moving on one map.
 */
export default function LiveRiderTrack({
  riderName,
  riderPhone,
  location,
  customerLat,
  customerLng,
  statusLabel,
}) {
  const { manager } = useAuth();
  const lat = location?.lat;
  const lng = location?.lng;
  const hasRider = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const store =
    manager?.latitude != null && manager?.longitude != null
      ? { lat: manager.latitude, lng: manager.longitude, name: manager.storeName }
      : null;
  const destination = customerLat != null && customerLng != null ? { lat: customerLat, lng: customerLng } : null;
  const riderMaps = hasRider ? mapsLink(Number(lat), Number(lng)) : null;
  const customerMaps =
    customerLat != null && customerLng != null
      ? mapsLink(Number(customerLat), Number(customerLng))
      : null;

  const updated =
    location?.updatedAt &&
    new Date(location.updatedAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
            Live delivery tracking
          </p>
          <p className="mt-1 text-sm font-extrabold text-slate-900">
            {riderName || "Assigned rider"}
            {riderPhone ? (
              <span className="ml-2 text-xs font-semibold text-slate-500">{riderPhone}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-sky-800">
            {statusLabel || "In progress"} · rider moves live on the map
          </p>
        </div>
        {updated ? (
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-sky-700 border border-sky-200">
            Last ping {updated}
          </span>
        ) : (
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-500 border border-slate-200">
            Waiting for GPS…
          </span>
        )}
      </div>

      {hasRider || store || destination ? (
        <div className="mt-4">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-sky-100" />}>
            <DeliveryTrackingMap store={store} destination={destination} rider={hasRider ? location : null} className="h-64" />
          </Suspense>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-slate-500">
            <span>🏪 Store</span>
            <span>🏠 Customer</span>
            <span>🛵 Rider {hasRider ? "(live)" : "(waiting for GPS)"}</span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-600">
          Map appears when the delivery partner shares location (online / on trip).
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {riderMaps ? (
          <a
            href={riderMaps}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700"
          >
            Open rider on Maps
          </a>
        ) : null}
        {customerMaps ? (
          <a
            href={customerMaps}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
          >
            Customer drop pin
          </a>
        ) : null}
        {hasRider ? (
          <span className="rounded-xl bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
            {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
