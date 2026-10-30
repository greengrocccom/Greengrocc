import { useState } from "react";
import { managerApi } from "../../api/managerApi";
import { DepartmentBadge } from "../products/productDepartments";

const ROUTING_LABELS = {
  within_3km: "Within 3 km",
  same_pincode: "Same pincode",
};

export function isPickupOrder(order) {
  return order?.fulfillmentType === "pickup";
}

/** Home delivery (rider) vs customer collects at this dark store. */
export function FulfillmentBadge({ order }) {
  return isPickupOrder(order) ? (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
      Store pickup
    </span>
  ) : (
    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
      Home delivery
    </span>
  );
}

const SPLIT_PART_LABELS = {
  now: "Split order · quick part",
  preorder: "Split order · pre-order part",
};

/** Department tags (Pre-order / Ready2Cook / Instant), delivery vs pickup, and how the order reached this store. */
export function OrderDepartmentTags({ order }) {
  const departments = order?.departments || [];
  const routing = ROUTING_LABELS[order?.routingReason];
  const splitLabel = SPLIT_PART_LABELS[order?.sourcePart];
  const slot = order?.isPreOrder && order?.preOrderSlot
    ? `${order.preOrderDate ? `${order.preOrderDate} · ` : ""}${order.preOrderSlot}`
    : "";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <FulfillmentBadge order={order} />
      {departments.map((dept) => (
        <DepartmentBadge key={dept} department={dept} />
      ))}
      {slot ? (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
          Slot {slot}
        </span>
      ) : null}
      {splitLabel ? (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
          {splitLabel}
        </span>
      ) : null}
      {routing ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {routing}
        </span>
      ) : null}
    </div>
  );
}

export const STATUS_LABELS = {
  preorder_hold: { text: "WITH VENDOR", className: "text-indigo-700" },
  order_received: { text: "NEW ORDER", className: "text-blue-700" },
  incoming: { text: "NEW ORDER", className: "text-blue-700" },
  packed: { text: "PACKED", className: "text-purple-700" },
  offered: { text: "SEARCHING DRIVER", className: "text-amber-700" },
  assigned: { text: "ASSIGNED", className: "text-teal-700" },
  out_for_delivery: { text: "OUT FOR DELIVERY", className: "text-emerald-700" },
  delivered: { text: "DELIVERED", className: "text-emerald-800" },
  delivery_failed: { text: "DELIVERY FAILED", className: "text-rose-700" },
  cancelled: { text: "CANCELLED", className: "text-rose-700" },
  pickup_verified: { text: "PICKUP VERIFIED", className: "text-sky-700" },
  stock_issue: { text: "STOCK ISSUE", className: "text-rose-700" },
};

const PICKUP_STATUS_LABELS = {
  packed: { text: "READY FOR PICKUP", className: "text-amber-700" },
  delivered: { text: "PICKED UP", className: "text-emerald-800" },
};

const PRE_ORDER_PROGRESS_LABELS = {
  awaiting_vendor: { text: "AWAITING VENDOR", className: "text-orange-700" },
  confirmed: { text: "VENDOR CONFIRMED", className: "text-indigo-700" },
  preparing: { text: "PACKED BY VENDOR", className: "text-indigo-700" },
  dispatched: { text: "INCOMING TO STORE", className: "text-violet-700" },
  at_store: { text: "RECEIVED AT STORE", className: "text-purple-700" },
};

export function OrderStatusText({ status, order }) {
  const preOrderLabel =
    order?.isPreOrder && ["preorder_hold", "packed"].includes(status)
      ? PRE_ORDER_PROGRESS_LABELS[order.preOrderProgress]
      : null;
  const label = preOrderLabel || (isPickupOrder(order) && PICKUP_STATUS_LABELS[status]) || STATUS_LABELS[status] || {
    text: (status || "").toUpperCase().replace(/_/g, " "),
    className: "text-slate-600",
  };

  return (
    <span className={`text-xs font-bold ${label.className}`}>
      {label.text}
    </span>
  );
}

export function formatDelay(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Rider-reported delay, with a button to forward it to the customer app. */
export function DeliveryDelayNotice({ order }) {
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(null);
  const [error, setError] = useState("");
  const delay = order?.deliveryDelay;
  if (!(delay?.minutes > 0)) return null;
  if (["delivered", "cancelled", "delivery_failed"].includes(order.status)) return null;

  const notifiedAt = sentAt || delay.customerNotifiedAt;
  const reportedAt = delay.reportedAt ? new Date(delay.reportedAt) : null;
  const alreadySent =
    notifiedAt && (!reportedAt || new Date(notifiedAt).getTime() >= reportedAt.getTime());

  const send = async (e) => {
    e.stopPropagation();
    const message = window.prompt(
      `Message to the customer for #${order.orderNumber} (leave as is or edit):`,
      `Your order is running about ${formatDelay(delay.minutes)} late. Sorry for the wait — it's on the way.`
    );
    if (message === null) return;
    setBusy(true);
    setError("");
    try {
      await managerApi.notifyCustomerOfDelay(order.id, message.trim());
      setSentAt(new Date().toISOString());
    } catch (err) {
      setError(err.response?.data?.message || "Could not send update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-left">
      <p className="text-[11px] font-bold text-amber-900">
        ⏱ Rider reports {formatDelay(delay.minutes)} delay
        {reportedAt ? ` · ${formatOrderTime(reportedAt)}` : ""}
      </p>
      {delay.reason ? <p className="text-[10px] text-amber-800">{delay.reason}</p> : null}
      {alreadySent ? (
        <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">✓ Customer updated</p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={send}
          className="mt-1 rounded-md bg-amber-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send update to customer"}
        </button>
      )}
      {error ? <p className="mt-0.5 text-[10px] font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

export function DriverAssignmentText({ order, onRiderClick }) {
  if (isPickupOrder(order)) {
    return (
      <p className="text-[11px] font-semibold text-amber-700">
        Customer picks up at store — no rider
      </p>
    );
  }

  const windowEnds = order.routeBatchWindowEndsAt
    ? new Date(order.routeBatchWindowEndsAt)
    : null;
  const windowActive =
    windowEnds && !Number.isNaN(windowEnds.getTime()) && windowEnds.getTime() > Date.now();
  const minsLeft = windowActive
    ? Math.max(0, Math.ceil((windowEnds.getTime() - Date.now()) / 60000))
    : null;
  const secsLeft = windowActive
    ? Math.max(0, Math.floor((windowEnds.getTime() - Date.now()) / 1000))
    : null;
  const clockLeft =
    secsLeft != null
      ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, "0")}`
      : null;

  if (order.assignedRider) {
    return (
      <div>
        {onRiderClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRiderClick(order);
            }}
            className="text-left text-[11px] font-bold text-teal-800 underline decoration-dotted underline-offset-2 hover:text-teal-600"
            title="Live tracking & delivery details"
          >
            {order.assignedRider.name || order.assignedRider.phone} · Track 📍
          </button>
        ) : (
          <p className="text-[11px] font-bold text-teal-800">
            {order.assignedRider.name || order.assignedRider.phone}
          </p>
        )}
        {order.onlinePaymentClaim?.status === "pending" ? (
          <p className="mt-1 text-[10px] font-semibold text-sky-700">Online payment — approve or reject</p>
        ) : null}
        {order.status === "delivery_failed" ? (
          <p className="mt-1 text-[10px] font-semibold text-rose-700">Failed — return or reattempt</p>
        ) : order.pickupProofStatus === "pending" ? (
          <p className="mt-1 text-[10px] font-semibold text-amber-700">Item proof pending approval</p>
        ) : order.pickupVerified ? (
          <p className="mt-1 text-[10px] font-semibold text-emerald-700">Pickup verified</p>
        ) : order.pickupQrScanned ? (
          <p className="mt-1 text-[10px] font-semibold text-violet-700">QR scanned — awaiting item photo</p>
        ) : null}
        {windowActive ? (
          <p className="mt-1 text-[10px] font-semibold text-violet-700">
            Same-route wait · {clockLeft} left
          </p>
        ) : null}
        <DeliveryDelayNotice order={order} />
      </div>
    );
  }

  if (order.offeredRider) {
    return (
      <div>
        <p className="text-[11px] font-bold text-amber-800">
          Offering {order.offeredRider.name || order.offeredRider.phone}
        </p>
        {windowActive ? (
          <p className="mt-1 text-[10px] font-semibold text-violet-700">
            Same-route wait · {clockLeft} left
          </p>
        ) : null}
      </div>
    );
  }

  if (windowActive || order.assignmentStatus === "BATCH_WAITING") {
    return (
      <p className="text-[11px] font-semibold text-violet-700 italic">
        Same-route wait{clockLeft ? ` · ${clockLeft} left` : minsLeft != null ? ` · ~${minsLeft}m left` : ""}
      </p>
    );
  }

  if (order.assignmentStatus === "WAITING_FOR_DRIVER") {
    return (
      <p className="text-[11px] font-semibold text-amber-700 italic">
        Waiting for nearby Delivery Partner…
      </p>
    );
  }

  return <p className="text-[11px] italic text-slate-500">Unassigned</p>;
}

/** @deprecated Use OrderStatusText */
export const STATUS_BADGE = Object.fromEntries(
  Object.entries(STATUS_LABELS).map(([key, value]) => [
    key,
    <span key={key} className={`text-xs font-bold ${value.className}`}>{value.text}</span>,
  ])
);

export const needsManagerAction = (order) =>
  order.status === "delivery_failed" || order.onlinePaymentClaim?.status === "pending";

export const STATUS_TABS = [
  { id: "attention", label: "Needs action" },
  { id: "incoming", label: "Incoming" },
  { id: "ongoing", label: "Ongoing" },
  { id: "pickup", label: "Store pickup" },
  { id: "scheduled", label: "Pre-orders (scheduled)" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

export function matchesTab(order, tab) {
  const s = order.status;
  if (tab === "all") return true;
  if (tab === "attention") return needsManagerAction(order);
  if (tab === "pickup") {
    return isPickupOrder(order) && !["delivered", "cancelled", "delivery_failed"].includes(s);
  }
  if (tab === "scheduled") return s === "preorder_hold";
  // New / pack queue awaiting action
  if (tab === "incoming") {
    return ["incoming", "order_received", "stock_issue", "packed", "offered"].includes(s);
  }
  // Assigned / out for delivery
  if (tab === "ongoing") {
    return ["assigned", "pickup_verified", "out_for_delivery"].includes(s);
  }
  if (tab === "delivered") return s === "delivered";
  if (tab === "cancelled") return s === "cancelled";
  // legacy aliases
  if (tab === "active") {
    return ["incoming", "order_received", "stock_issue", "packed", "offered", "assigned", "out_for_delivery", "pickup_verified"].includes(s);
  }
  if (tab === "packed") return ["packed", "offered"].includes(s);
  if (tab === "out_for_delivery") return ["assigned", "pickup_verified", "out_for_delivery"].includes(s);
  return true;
}

export function countBySummaryBucket(orders = []) {
  return {
    attention: orders.filter((o) => matchesTab(o, "attention")).length,
    incoming: orders.filter((o) => matchesTab(o, "incoming")).length,
    ongoing: orders.filter((o) => matchesTab(o, "ongoing")).length,
    pickup: orders.filter((o) => matchesTab(o, "pickup")).length,
    scheduled: orders.filter((o) => matchesTab(o, "scheduled")).length,
    delivered: orders.filter((o) => matchesTab(o, "delivered")).length,
    cancelled: orders.filter((o) => matchesTab(o, "cancelled")).length,
  };
}

export function formatOrderTime(value) {
  if (!value) return "Just now";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRupee(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatTripDuration(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return "—";
  const m = Math.max(0, Math.round(Number(minutes)));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function paymentMethodLabel(method) {
  const m = String(method || "").toUpperCase();
  if (m === "COD") return "COD (Physical cash)";
  if (m === "ONLINE") return "Online payment";
  if (m === "WALLET") return "Wallet";
  return method ? String(method) : "Not set";
}

export function isCodPayment(method) {
  return String(method || "").toUpperCase() === "COD";
}

export function getOrderItemsTotal(order) {
  if (order?.itemsTotal != null) return Number(order.itemsTotal) || 0;
  return (order?.items || []).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 0),
    0
  );
}

export function getOrderDeliveryFee(order) {
  if (order?.deliveryFee != null) return Number(order.deliveryFee) || 0;
  const amount = Number(order?.amountToCollect) || 0;
  const itemsTotal = getOrderItemsTotal(order);
  return Math.max(0, Math.round(amount - itemsTotal));
}

export function isInitialOrderStatus(status) {
  return ["incoming", "order_received", "stock_issue"].includes(status);
}

export function allItemsAvailable(order) {
  return (order?.items || []).every(
    (item) => item.stockStatus === "available" || item.customerInformed
  );
}

export const actionBtnOutline =
  "rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap";

export const actionBtnPrimary =
  "rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition whitespace-nowrap";

export const actionBtnDanger =
  "rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition whitespace-nowrap";
