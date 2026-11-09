import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Bike,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock,
  CloudOff,
  Copy,
  FileText,
  Headset,
  House,
  Lock,
  MessageCircle,
  Package,
  Phone,
  Repeat,
  WifiOff,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getOrderById, getOrderTracking } from "../api/api";
import { useLive } from "../realtime/useLive";
import { getSocket, onRealtimeConnect } from "../realtime/liveClient";
import LiveTrackingMap from "../components/orders/tracking/LiveTrackingMap";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "../config/contact";
import { formatOrderPrice, formatPreOrderSlot, getOrderDisplayCode, getPrimaryProductId } from "../utils/orderUtils";
import {
  ORDER_TYPE_LABELS,
  decodePolyline,
  etaText as formatEtaText,
  fetchRoadRoute,
  isTrackingClosed,
  normalizeTracking,
  routeAhead,
  routeLength,
  showsLiveMap,
  withStatus,
} from "../utils/orderTracking";
import OptimizedImg from "../components/common/OptimizedImg";
import { useResendDeliveryOtp } from "../hooks/useResendDeliveryOtp";

const GREEN = "#0C831F";
const SUPPORT_WHATSAPP_URL = "https://wa.me/917400222233?text=Hi%20GreenGrocc%2C%20I%20need%20help%20with%20my%20order";

const STEPS = [
  { key: "placed", title: "Placed", Icon: ClipboardCheck },
  { key: "confirmed", title: "Confirmed", Icon: Check },
  { key: "packed", title: "Packed", Icon: Package },
  { key: "out_for_delivery", title: "On the way", Icon: Bike },
  { key: "delivered", title: "Delivered", Icon: House },
];

const STATUS_CHIP = {
  placed: "Order placed",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

function headerSubtitle(tracking) {
  if (!tracking) return "Fetching live status";
  if (tracking.status === "delivered") return "Your order has been delivered";
  if (tracking.status === "cancelled") return "This order was cancelled";
  if (tracking.riderPhase === "to_store") return "Your delivery partner is heading to the store";
  if (tracking.riderPhase === "to_customer" || tracking.status === "out_for_delivery") return "Your order is on the way";
  if (tracking.status === "packed") return "Packed and waiting for pickup";
  if (tracking.status === "confirmed") return "Your order has been confirmed";
  return "We're preparing your order";
}

function Card({ children, className = "" }) {
  return (
    <section
      className={`min-w-0 rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70 ${className}`}
    >
      {children}
    </section>
  );
}

function Banner({ tone, Icon, children }) {
  const tones = {
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    orange: "bg-orange-50 text-orange-900 ring-orange-200",
  };
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold ring-1 ${tones[tone]}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function SummaryCard({ order, tracking, etaText }) {
  const closed = isTrackingClosed(tracking);
  const cancelled = tracking.status === "cancelled";
  const itemCount = (order?.items || []).length;
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#0C831F]">
        <Package className="h-6 w-6" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-slate-900">Order #{getOrderDisplayCode(order)}</p>
        <p className="mt-0.5 text-[12px] text-slate-500">
          {itemCount} item{itemCount === 1 ? "" : "s"} · {formatOrderPrice(order?.total || 0, { withDecimals: false })}
        </p>
        <span
          className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            cancelled ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-[#0C831F]"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cancelled ? "bg-rose-500" : "bg-emerald-500"}`} />
          {STATUS_CHIP[tracking.status] || "In progress"}
        </span>
      </div>
      {closed ? (
        <span className={cancelled ? "text-rose-600" : "text-[#0C831F]"}>
          {cancelled ? <CircleX className="h-8 w-8" /> : <CircleCheck className="h-8 w-8" />}
        </span>
      ) : etaText ? (
        <div className="flex shrink-0 flex-col items-center border-l border-slate-200 pl-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ETA</span>
          <span className="text-[16px] font-extrabold leading-tight tracking-tight text-[#0C831F]">{etaText}</span>
          <Clock className="mt-0.5 h-3.5 w-3.5 text-[#0C831F]" />
        </div>
      ) : null}
    </Card>
  );
}

const DRIVER_PHASE_TEXT = {
  to_store: "Picking up your order from the store",
  to_customer: "Your delivery partner",
};

function DriverCard({ driver, phase }) {
  const tel = driver.phone.replace(/[^0-9+]/g, "");
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#0C831F]">
        <Bike className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-slate-900">{driver.name}</p>
        <p className="mt-0.5 text-[12px] text-slate-500">
          {DRIVER_PHASE_TEXT[phase] || "Assigned delivery partner"}
          {driver.vehicleType ? ` · ${driver.vehicleType}` : ""}
        </p>
      </div>
      {tel ? (
        <a
          href={`tel:${tel}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition active:scale-95"
          style={{ backgroundColor: GREEN }}
          aria-label={`Call ${driver.name}`}
        >
          <Phone className="h-[18px] w-[18px]" />
        </a>
      ) : null}
    </Card>
  );
}

function StatusStepper({ tracking }) {
  if (tracking.status === "cancelled") {
    return (
      <Card className="flex items-center gap-3 p-3.5">
        <CircleX className="h-6 w-6 shrink-0 text-rose-600" />
        <div>
          <p className="text-[14px] font-bold text-slate-900">Order cancelled</p>
          <p className="text-[12px] text-slate-500">This order will not be delivered.</p>
        </div>
      </Card>
    );
  }
  const byKey = new Map(tracking.timeline.map((step) => [step.key, step]));
  const reached = Math.max(STEPS.findIndex((step) => step.key === tracking.status), 0);
  const delivered = tracking.status === "delivered";

  return (
    <Card className="p-3.5">
      <h2 className="text-[13.5px] font-bold text-slate-900">Order status</h2>
      <ol className="mt-3.5 flex">
        {STEPS.map(({ key, title, Icon }, index) => {
          const done = index < reached || delivered || byKey.get(key)?.done;
          const active = index === reached && !delivered;
          const lit = done || active;
          const at = byKey.get(key)?.at;
          return (
            <li key={key} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {index > 0 ? (
                <span
                  className={`absolute right-1/2 top-[13px] h-[2px] w-full ${
                    index <= reached || delivered ? "bg-[#0C831F]" : "bg-slate-200"
                  }`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full ${
                  lit ? "bg-[#0C831F] text-white" : "bg-slate-200 text-slate-400"
                } ${active ? "ring-4 ring-emerald-100" : ""}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
              </span>
              <span
                className={`mt-1.5 text-[10.5px] leading-tight ${lit ? "font-bold text-slate-900" : "font-medium text-slate-500"}`}
              >
                {title}
              </span>
              <span className="mt-0.5 text-[9.5px] text-slate-400">{at && lit ? timeFormat.format(at) : "—"}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function ScheduledCard({ tracking, order }) {
  const slot = tracking.preOrder;
  const slotText = order?.preOrderSlot ? formatPreOrderSlot(order) : [slot?.date, slot?.slot].filter(Boolean).join(" · ");
  const title =
    tracking.status === "delivered"
      ? "Pre-order delivered"
      : tracking.status === "cancelled"
        ? "Pre-order cancelled"
        : "Scheduled delivery";
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#0C831F]">
        <CalendarClock className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[12px] text-slate-500">{slotText || "We'll deliver in your selected slot"}</p>
        {slot?.progressLabel ? (
          <p className="mt-1 text-[11.5px] font-semibold text-[#0C831F]">{slot.progressLabel}</p>
        ) : null}
      </div>
      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10.5px] font-bold text-[#0C831F]">
        {ORDER_TYPE_LABELS[tracking.orderType] || "Instant"}
      </span>
    </Card>
  );
}

function OtherPartNote({ part }) {
  const isPreorder = part.orderType === "preorder";
  const status = (isPreorder && part.preOrder?.progressLabel) || String(part.status || "").replace(/_/g, " ");
  const slot = [part.preOrder?.date, part.preOrder?.slot].filter(Boolean).join(" · ");
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-slate-100/80 px-3.5 py-2.5 text-[12.5px] text-slate-700">
      {isPreorder ? <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" /> : <Package className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>
        {isPreorder
          ? `Pre-order items arrive separately${slot ? `: ${slot}` : ""} (${status})`
          : `${ORDER_TYPE_LABELS[part.orderType] || "Other"} items in this order: ${status}`}
      </span>
    </div>
  );
}

function HelpSheet({ onClose }) {
  const options = [
    { href: SUPPORT_WHATSAPP_URL, Icon: MessageCircle, title: "Chat with us on WhatsApp", text: "Quick answers and order updates", external: true },
    { href: CONTACT_PHONE_TEL, Icon: Phone, title: "Call customer care", text: CONTACT_PHONE_DISPLAY },
  ];
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-6 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Headset className="h-6 w-6 text-[#0C831F]" />
          <h3 className="flex-1 text-[17px] font-bold text-slate-900">GreenGrocc Support</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-[13px] text-slate-500">Having an issue with this order? We're here to help.</p>
        <div className="mt-4 space-y-2">
          {options.map(({ href, Icon, title, text, external }) => (
            <a
              key={title}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-[#0C831F]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-slate-900">{title}</span>
                <span className="block text-[12px] text-slate-500">{text}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ItemsCard({ items }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
        aria-expanded={open}
      >
        <FileText className="h-4 w-4 text-slate-500" />
        <span className="flex-1 text-[13px] font-bold text-slate-900">
          {items.length} item{items.length === 1 ? "" : "s"} in this order
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {items.map((item, index) => {
            const image = item.image || item.productImage;
            return (
              <li key={item._id || `${item.name}-${index}`} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-100">
                  {image ? <OptimizedImg src={image} alt="" className="h-full w-full object-contain p-0.5" /> : <Package className="h-4 w-4 text-slate-300" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-800">
                  <span className="font-semibold">{item.quantity}×</span> {item.name}
                </span>
                <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-slate-900">
                  {formatOrderPrice((Number(item.price) || 0) * (Number(item.quantity) || 0), { withDecimals: false })}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}

function TrackOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const otpSms = useResendDeliveryOtp(order?._id || id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [driver, setDriver] = useState(null);
  const [route, setRoute] = useState([]);
  const [roadEta, setRoadEta] = useState(null);
  const [lastFixAt, setLastFixAt] = useState(null);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const [socketDown, setSocketDown] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const trackingRef = useRef(null);
  const fetchingRef = useRef(false);
  const queuedRef = useRef(false);
  const statusTimerRef = useRef(0);

  useEffect(() => {
    trackingRef.current = tracking;
  }, [tracking]);

  const loadOrder = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getOrderById(id);
      setOrder(data?.data || null);
    } catch {
      // The tracking request surfaces errors for the page.
    }
  }, [id, user]);

  useLive(loadOrder, [loadOrder]);

  const loadTracking = useCallback(async () => {
    if (!user) return;
    if (fetchingRef.current) {
      queuedRef.current = true;
      return;
    }
    fetchingRef.current = true;
    do {
      queuedRef.current = false;
      try {
        const { data } = await getOrderTracking(id);
        const next = normalizeTracking(data?.tracking);
        setTracking(next);
        setError("");
        const serverRoute = next.routePolyline ? decodePolyline(next.routePolyline) : [];
        setRoute((current) => (serverRoute.length > 2 ? serverRoute : current.length > 2 ? current : []));
        if (!next.liveTracking || isTrackingClosed(next)) {
          setDriver(null);
        } else if (next.lastLocation) {
          setDriver((current) => {
            if (current && next.lastLocation.at && current.at && next.lastLocation.at <= current.at) return current;
            return next.lastLocation;
          });
          setLastFixAt((current) => current || next.lastLocation.at || new Date());
        }
      } catch (err) {
        if (!trackingRef.current) {
          setError(err?.response?.data?.message || "Live tracking is unavailable right now.");
        }
      }
    } while (queuedRef.current);
    fetchingRef.current = false;
    setLoading(false);
  }, [id, user]);

  useLive(loadTracking, [loadTracking]);

  useEffect(() => {
    if (!user) return undefined;
    const socket = getSocket();
    const isThisOrder = (payload) => {
      const current = trackingRef.current;
      const orderId = payload?.orderId ? String(payload.orderId) : "";
      const storeOrderId = payload?.storeOrderId ? String(payload.storeOrderId) : "";
      return (
        orderId === id ||
        (orderId && orderId === current?.orderId) ||
        (storeOrderId && (storeOrderId === id || storeOrderId === current?.storeOrderId))
      );
    };
    const join = () => socket.emit("join_order", { orderId: id }, () => {});

    const onLocation = (payload) => {
      const current = trackingRef.current;
      if (!isThisOrder(payload) || !current || !showsLiveMap(current) || isTrackingClosed(current)) return;
      const lat = Number(payload.lat);
      const lng = Number(payload.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const at = payload.updatedAt ? new Date(payload.updatedAt) : new Date();
      setDriver({ lat, lng, heading: Number(payload.heading) || null, at });
      setLastFixAt(at);
      if (!current.liveTracking) loadTracking();
    };

    const onStatus = (payload) => {
      const current = trackingRef.current;
      if (!isThisOrder(payload) || !current) return;
      const status = payload?.status ? String(payload.status) : "";
      const storeOrderId = payload?.storeOrderId ? String(payload.storeOrderId) : "";
      const samePart = !storeOrderId || !current.storeOrderId || storeOrderId === current.storeOrderId;
      if (status && samePart) {
        const next = withStatus(current, status, payload.liveTracking === true, payload.riderPhase ?? null);
        if (
          next.status !== current.status ||
          next.liveTracking !== current.liveTracking ||
          next.riderPhase !== current.riderPhase
        ) {
          setTracking(next);
          if (isTrackingClosed(next) || !next.liveTracking) setDriver(null);
        }
      }
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => {
        loadTracking();
        loadOrder();
      }, 800);
    };

    const onDisconnect = () => setSocketDown(true);
    const onConnect = () => setSocketDown(false);

    if (socket.connected) join();
    const stopConnect = onRealtimeConnect(({ reconnect }) => {
      join();
      if (reconnect) loadTracking();
    });
    socket.on("location_update", onLocation);
    socket.on("order_status", onStatus);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);

    return () => {
      clearTimeout(statusTimerRef.current);
      stopConnect();
      socket.off("location_update", onLocation);
      socket.off("order_status", onStatus);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
      socket.emit("leave_order", { orderId: id });
    };
  }, [id, user, loadTracking, loadOrder]);

  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      loadTracking();
    };
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [loadTracking]);

  const liveMap = Boolean(tracking) && showsLiveMap(tracking) && !isTrackingClosed(tracking);
  const refreshSeconds = tracking?.refreshRouteSeconds || 45;

  useEffect(() => {
    if (!liveMap) return undefined;
    const timer = setInterval(loadTracking, refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [liveMap, refreshSeconds, loadTracking]);

  const destination = tracking?.destination || null;
  const origin = driver || tracking?.storeLocation || null;
  const needsRoadRoute = liveMap && route.length <= 2 && Boolean(destination) && Boolean(origin);
  const originKey = origin ? `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}` : "";

  useEffect(() => {
    if (!needsRoadRoute) return undefined;
    let cancelled = false;
    fetchRoadRoute(origin, destination).then((result) => {
      if (cancelled || !result) return;
      setRoute(result.points);
      setRoadEta(result);
    });
    return () => {
      cancelled = true;
    };
  }, [needsRoadRoute, originKey, destination?.lat, destination?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(`/orders/${id}`);
  };

  const orderAgain = () => {
    const items = order?.items || [];
    const productId = order ? getPrimaryProductId(order) : null;
    navigate(items.length === 1 && productId ? `/product/${productId}` : `/orders/${id}`);
  };

  const copyOtp = async (otp) => {
    try {
      await navigator.clipboard.writeText(otp);
      toast.success("Delivery OTP copied");
    } catch {
      toast.error("Couldn't copy the OTP");
    }
  };

  // Between server refreshes, shrink the route and ETA as the rider moves along it.
  const progressRef = useRef({ route: null, index: 0 });
  const ahead = useMemo(() => {
    if (progressRef.current.route !== route) progressRef.current = { route, index: 0 };
    const result = routeAhead(route, driver, progressRef.current.index);
    if (result) progressRef.current.index = result.index;
    return result;
  }, [route, driver]);
  const routeMeters = useMemo(() => routeLength(route), [route]);
  const baseEta = tracking?.eta || roadEta;
  const liveEtaSeconds =
    ahead && baseEta?.seconds && routeMeters > 0 ? baseEta.seconds * Math.min(1, ahead.meters / routeMeters) : null;
  const etaText = liveEtaSeconds != null ? formatEtaText(liveEtaSeconds) : baseEta?.text || "";
  const etaMeters = ahead ? ahead.meters : baseEta?.distanceMeters || 0;
  const closed = tracking ? isTrackingClosed(tracking) : false;
  const otp = String(order?.deliveryOtp || "").trim();
  const outForDelivery = order?.status === "shipping" || tracking?.status === "out_for_delivery";
  const showMap = liveMap && Boolean(destination || tracking?.storeLocation || driver);
  const orderCode = order ? getOrderDisplayCode(order) : tracking?.orderNumber || "";

  let body;
  if (authLoading || (user && loading)) {
    body = (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-100 border-t-[#0C831F]" />
      </div>
    );
  } else if (!user) {
    body = (
      <Card className="mx-auto mt-8 max-w-sm p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-[#0C831F]" />
        <p className="mt-3 text-[15px] font-bold text-slate-900">Log in to track your order</p>
        <button
          type="button"
          onClick={() => openAuthModal("login")}
          className="mt-4 h-11 w-full rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: GREEN }}
        >
          Log in / Sign up
        </button>
      </Card>
    );
  } else if (!tracking) {
    body = (
      <Card className="mx-auto mt-8 max-w-sm p-6 text-center">
        <CloudOff className="mx-auto h-9 w-9 text-slate-400" />
        <p className="mt-3 text-[14px] text-slate-600">{error || "Live tracking is unavailable right now."}</p>
        <div className="mt-4 flex gap-2">
          <Link
            to={`/orders/${id}`}
            className="flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-bold text-[#0C831F] ring-1 ring-emerald-200"
          >
            Order details
          </Link>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadTracking();
            }}
            className="h-11 flex-1 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: GREEN }}
          >
            Retry
          </button>
        </div>
      </Card>
    );
  } else {
    body = (
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-5 lg:px-4 lg:pt-5">
        {showMap ? (
          <div className="lg:sticky lg:top-24 lg:overflow-hidden lg:rounded-2xl lg:ring-1 lg:ring-slate-200">
            <LiveTrackingMap
              driver={driver}
              store={tracking.storeLocation}
              destination={destination}
              route={ahead?.points || route}
              etaText={etaText}
              distanceMeters={etaMeters}
              className="h-[270px] lg:h-[560px]"
            />
          </div>
        ) : null}

        <div className={`min-w-0 space-y-2.5 px-3 pb-8 pt-3 lg:px-0 lg:pt-0 ${showMap ? "" : "lg:col-span-2 lg:mx-auto lg:w-full lg:max-w-xl"}`}>
          {(offline || socketDown) && !closed ? (
            <Banner tone="amber" Icon={WifiOff}>
              {offline ? "You're offline. Live updates resume when you reconnect." : "Reconnecting to live updates…"}
            </Banner>
          ) : null}
          {tracking.delay && !closed ? (
            <Banner tone="orange" Icon={CircleAlert}>
              Running about {tracking.delay.minutes} min late
              {tracking.delay.expectedBy ? ` · now expected by ${timeFormat.format(tracking.delay.expectedBy)}` : ""}.
              Sorry for the wait!
            </Banner>
          ) : null}

          <SummaryCard order={order} tracking={tracking} etaText={etaText} />

          {tracking.liveTracking && lastFixAt && !closed ? (
            <p className="flex items-center gap-1.5 px-1 text-[11.5px] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live location · updated {timeFormat.format(lastFixAt)}
            </p>
          ) : null}

          {tracking.driver && !closed ? <DriverCard driver={tracking.driver} phase={tracking.riderPhase} /> : null}

          {!showsLiveMap(tracking) ? <ScheduledCard tracking={tracking} order={order} /> : null}

          <StatusStepper tracking={tracking} />

          {tracking.otherParts.map((part, index) => (
            <OtherPartNote key={part.storeOrderId || index} part={part} />
          ))}

          {otp && outForDelivery && !closed ? (
            <Card className="px-3.5 py-3 ring-emerald-300">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 shrink-0 text-[#0C831F]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-500">Delivery OTP · share only with your delivery partner</p>
                  <p className="text-[18px] font-extrabold tracking-[0.2em] text-[#0C831F]">{otp}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyOtp(otp)}
                  className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-[#0C831F] ring-1 ring-emerald-200 transition hover:bg-emerald-50"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-emerald-100 pt-2">
                <p className="text-[11.5px] text-slate-500">Sent to your phone by SMS</p>
                <button
                  type="button"
                  onClick={otpSms.resend}
                  disabled={otpSms.sending || otpSms.cooldown > 0}
                  className="text-[12px] font-bold text-[#0C831F] disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {otpSms.sending ? "Sending…" : otpSms.cooldown > 0 ? `Resend in ${otpSms.cooldown}s` : "Resend SMS"}
                </button>
              </div>
            </Card>
          ) : null}

          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-3.5 py-3 ring-1 ring-emerald-100">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: GREEN }}>
              <MessageCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-slate-900">Need help?</p>
              <p className="text-[11.5px] text-slate-500">Contact our support team</p>
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="flex h-8 items-center gap-0.5 rounded-full bg-white px-3 text-[12px] font-bold text-[#0C831F] ring-1 ring-[#0C831F]"
            >
              Get help <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <ItemsCard items={order?.items || []} />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              to={`/orders/${id}`}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-[13px] font-bold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" /> Order details
            </Link>
            <button
              type="button"
              onClick={orderAgain}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition active:scale-[0.99]"
              style={{ backgroundColor: GREEN }}
            >
              <Repeat className="h-4 w-4" /> Repeat order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#F3F5F9] text-slate-900">
      <header className="sticky top-0 z-30 bg-gradient-to-br from-[#0C831F] to-[#15803D] text-white lg:static">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 sm:px-4">
          <button
            type="button"
            onClick={goBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-extrabold leading-tight">Track your order</h1>
            <p className="truncate text-[11.5px] font-medium text-emerald-100">{headerSubtitle(tracking)}</p>
          </div>
          {orderCode ? (
            <div className="shrink-0 rounded-xl bg-black/15 px-2.5 py-1 text-right ring-1 ring-white/20">
              <p className="text-[9.5px] font-semibold text-emerald-100">Order ID</p>
              <p className="text-[11.5px] font-extrabold">#{orderCode}</p>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl">{body}</main>

      {helpOpen ? <HelpSheet onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}

export default TrackOrder;
