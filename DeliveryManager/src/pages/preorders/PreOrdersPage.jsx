import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { useAuth } from "../../context/AuthContext";
import { PageShell } from "../../components/layout/ManagerLayout";
import PickupQrModal from "../../components/PickupQrModal";
import PreOrderQrLabels from "../../components/PreOrderQrLabels";
import OrderTrackingDrawer from "../../components/tracking/OrderTrackingDrawer";
import { useLive } from "../../realtime/useLive";
import {
  DeliveryDelayNotice,
  OrderDepartmentTags,
  OrderStatusText,
  actionBtnDanger,
  actionBtnOutline,
  actionBtnPrimary,
  formatRupee,
  isCodPayment,
  isPickupOrder,
} from "../orders/orderUtils";

const todayIstStr = (() => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
})();

const tomorrowIstStr = (() => {
  try {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch (_) {
    return "";
  }
})();

const TABS = [
  { id: "all", label: "All" },
  { id: "awaiting_vendor", label: "Awaiting Vendor" },
  { id: "with_vendor", label: "Vendor Packing" },
  { id: "incoming", label: "Shipped · Incoming" },
  { id: "to_assign", label: "Received · Assign Rider" },
  { id: "on_the_way", label: "Assigned / On the way" },
  { id: "delivered", label: "Delivered" },
  { id: "closed", label: "Cancelled / Failed" },
];

const STAGE_LABELS = {
  pending: { text: "Confirmed by vendor", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  preparing: { text: "Confirmed by vendor", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  ready: { text: "Packed by vendor", className: "bg-sky-50 text-sky-800 ring-sky-200" },
};

const RIDER_HELD = ["assigned", "pickup_verified"];
const canMarkOutForDelivery = (order) => RIDER_HELD.includes(order.status) && Boolean(order.assignedRider);
const canMarkDelivered = (order) => [...RIDER_HELD, "out_for_delivery"].includes(order.status);

const vendorConfirmed = (order) => order.vendorStatus === "confirmed";
const isReceived = (order) => Boolean(order.storeReceivedAt);

function matchesTab(order, tab) {
  const s = order.status;
  if (tab === "all") return true;
  if (tab === "awaiting_vendor") return s === "preorder_hold" && !vendorConfirmed(order);
  if (tab === "with_vendor") return s === "preorder_hold" && vendorConfirmed(order);
  if (tab === "incoming") return s === "packed" && !isReceived(order);
  if (tab === "to_assign") return (s === "packed" || s === "offered") && isReceived(order);
  if (tab === "on_the_way") return ["assigned", "pickup_verified", "out_for_delivery"].includes(s);
  if (tab === "delivered") return s === "delivered";
  if (tab === "closed") return s === "cancelled" || s === "delivery_failed";
  return true;
}

function formatDayLabel(dateStr, today, tomorrow) {
  if (!dateStr) return "No date";
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function canBulkAssign(order) {
  return order.status === "packed" && !isPickupOrder(order) && isReceived(order);
}

function canReceive(order) {
  return order.status === "packed" && !isReceived(order);
}

function bulkRiderLabel(rider) {
  const load = rider.activeOrderCount ? ` · ${rider.activeOrderCount} active` : "";
  return `${rider.name || rider.phone} · ${rider.vehicleType || "rider"}${load}`;
}

function riderAvailability(rider) {
  if (rider.status === "online" && !rider.activeOrderId) return "available";
  if (rider.status === "online") return "busy";
  return "offline";
}

export default function PreOrdersPage() {
  const { manager } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [meta, setMeta] = useState({ today: "", tomorrow: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [receiveIds, setReceiveIds] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRider, setSelectedRider] = useState({});
  const [bulkIds, setBulkIds] = useState([]);
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [bulkRiderId, setBulkRiderId] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  const [pickupQr, setPickupQr] = useState({ orderId: null, loading: false, error: "", data: null });
  const [qrLabels, setQrLabels] = useState({ open: false, loading: false, riderName: "", labels: [] });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  };

  const load = useCallback(
    async ({ silent = false } = {}) => {
      try {
        const [pre, rid] = await Promise.all([
          managerApi.preOrders(dateFilter ? { date: dateFilter } : {}),
          managerApi.riders(),
        ]);
        setOrders(pre.data.orders || []);
        setMeta({ today: pre.data.today || "", tomorrow: pre.data.tomorrow || "" });
        setRiders(rid.data.riders || []);
        setError("");
      } catch (err) {
        if (!silent) setError(err.response?.data?.message || "Failed to load pre-orders");
      } finally {
        setLoading(false);
      }
    },
    [dateFilter]
  );

  useEffect(() => {
    setLoading(true);
  }, [dateFilter]);

  useLive(load, [load]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /** Active riders grouped by availability; one rider can take several pre-orders. */
  const bulkRiderGroups = useMemo(() => {
    const active = riders.filter((r) => r.isActive !== false);
    const activeCount = new Map();
    for (const o of orders) {
      if (o.assignedRider?.id && ["assigned", "pickup_verified", "out_for_delivery"].includes(o.status)) {
        activeCount.set(o.assignedRider.id, (activeCount.get(o.assignedRider.id) || 0) + 1);
      }
    }
    const withLoad = active.map((r) => ({ ...r, activeOrderCount: activeCount.get(r.id) || 0 }));
    return [
      ["Available now", withLoad.filter((r) => riderAvailability(r) === "available")],
      ["Online · already delivering", withLoad.filter((r) => riderAvailability(r) === "busy")],
      ["Offline (can still take pre-orders)", withLoad.filter((r) => riderAvailability(r) === "offline")],
    ].filter(([, list]) => list.length);
  }, [riders, orders]);
  const bulkRiderCount = bulkRiderGroups.reduce((n, [, list]) => n + list.length, 0);

  /** Assigned pre-orders the rider has not scanned yet, grouped by rider. */
  const riderPickups = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      if (o.status !== "assigned" || o.pickupQrScanned || !o.assignedRider?.id) continue;
      const key = o.assignedRider.id;
      if (!map.has(key)) map.set(key, { rider: o.assignedRider, orders: [] });
      map.get(key).orders.push(o);
    }
    return [...map.values()];
  }, [orders]);

  const openQrLabels = async ({ rider, orders: list }) => {
    const riderName = rider?.name || rider?.phone || "";
    setQrLabels({ open: true, loading: true, riderName, labels: [] });
    const results = await Promise.allSettled(list.map((o) => managerApi.getPickupQr(o.id)));
    const labels = list.map((o, i) => {
      const r = results[i];
      const itemCount = (o.items || []).reduce((n, it) => n + Number(it.quantity || 0), 0);
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        slot: o.preOrderSlot || "",
        itemCount,
        payload: r.status === "fulfilled" ? r.value.data?.pickupQrPayload || null : null,
        error: r.status === "rejected" ? r.reason?.response?.data?.message || "Could not load QR" : "",
      };
    });
    setQrLabels({ open: true, loading: false, riderName, labels });
  };

  useEffect(() => {
    setBulkIds((prev) => {
      const still = prev.filter((id) => orders.some((o) => o.id === id && canBulkAssign(o)));
      return still.length === prev.length ? prev : still;
    });
    setReceiveIds((prev) => {
      const still = prev.filter((id) => orders.some((o) => o.id === id && canReceive(o)));
      return still.length === prev.length ? prev : still;
    });
  }, [orders]);

  const slots = useMemo(
    () => [...new Set(orders.map((o) => o.preOrderSlot).filter(Boolean))].sort(),
    [orders]
  );

  const counts = useMemo(() => {
    const c = { all: orders.length };
    for (const tab of TABS) c[tab.id] = orders.filter((o) => matchesTab(o, tab.id)).length;
    return c;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchesTab(o, activeTab)) return false;
      if (slotFilter && o.preOrderSlot !== slotFilter) return false;
      if (!q) return true;
      return (
        (o.orderNumber || "").toLowerCase().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.customerPhone || "").includes(q) ||
        (o.customerAddress || "").toLowerCase().includes(q)
      );
    });
  }, [orders, activeTab, slotFilter, searchQuery]);

  const ordersByDate = useMemo(() => {
    const map = new Map();
    for (const o of visibleOrders) {
      const dateKey = o.preOrderDate || (o.createdAt ? o.createdAt.slice(0, 10) : "No date");
      if (!map.has(dateKey)) {
        map.set(dateKey, { dateKey, orders: [] });
      }
      map.get(dateKey).orders.push(o);
    }
    return [...map.values()].sort((a, b) => (b.dateKey > a.dateKey ? 1 : b.dateKey < a.dateKey ? -1 : 0));
  }, [visibleOrders]);

  const onAssign = async (order) => {
    const oid = order.id;
    const riderId = selectedRider[oid];
    if (!riderId) return;
    setBusyKey(`assign-${oid}`);
    try {
      const res = await managerApi.assignPreOrders(riderId, [oid]);
      showToast(res.data.message || "Pre-order assigned");
      setSelectedRider((prev) => {
        const next = { ...prev };
        delete next[oid];
        return next;
      });
      await load({ silent: true });
    } catch (err) {
      const skipped = err.response?.data?.skipped || [];
      showToast(skipped[0]?.reason || err.response?.data?.message || "Could not assign rider");
    } finally {
      setBusyKey("");
    }
  };

  const toggleBulk = (oid) =>
    setBulkIds((prev) => (prev.includes(oid) ? prev.filter((id) => id !== oid) : [...prev, oid]));

  const toggleGroupBulk = (groupOrders) => {
    const ids = groupOrders.filter(canBulkAssign).map((o) => o.id);
    const allOn = ids.length > 0 && ids.every((id) => bulkIds.includes(id));
    setBulkIds((prev) =>
      allOn ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    );
  };

  const toggleReceive = (oid) =>
    setReceiveIds((prev) => (prev.includes(oid) ? prev.filter((id) => id !== oid) : [...prev, oid]));

  const toggleGroupReceive = (groupOrders) => {
    const ids = groupOrders.filter(canReceive).map((o) => o.id);
    const allOn = ids.length > 0 && ids.every((id) => receiveIds.includes(id));
    setReceiveIds((prev) =>
      allOn ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    );
  };

  const onReceive = async (ids) => {
    if (!ids.length) return;
    setBusyKey(ids.length === 1 ? `receive-${ids[0]}` : "bulk-receive");
    try {
      const res = await managerApi.receivePreOrders(ids);
      const failed = res.data.failed || [];
      showToast(
        failed.length
          ? `${res.data.message} (${failed[0].message})`
          : res.data.message || "Marked received at the dark store"
      );
      setReceiveIds((prev) => prev.filter((id) => !ids.includes(id)));
      await load({ silent: true });
    } catch (err) {
      showToast(err.response?.data?.message || "Could not mark received");
    } finally {
      setBusyKey("");
    }
  };

  const onBulkAssign = async () => {
    if (!bulkRiderId || !bulkIds.length) return;
    setBusyKey("bulk-assign");
    try {
      const res = await managerApi.assignPreOrders(bulkRiderId, bulkIds);
      const skipped = res.data.skipped || [];
      showToast(
        skipped.length
          ? `${res.data.message} · ${skipped.length} skipped (${skipped[0].reason})`
          : res.data.message || "Pre-orders assigned"
      );
      setBulkIds([]);
      setBulkRiderId("");
      await load({ silent: true });
    } catch (err) {
      const skipped = err.response?.data?.skipped || [];
      showToast(
        skipped.length
          ? `No orders assigned — ${skipped[0].reason}`
          : err.response?.data?.message || "Could not assign pre-orders"
      );
    } finally {
      setBusyKey("");
    }
  };

  const runOrderAction = async (order, { key, call, fallback }) => {
    setBusyKey(`${key}-${order.id}`);
    try {
      const res = await call([order.id]);
      showToast(res.data.message || fallback);
      await load({ silent: true });
    } catch (err) {
      showToast(err.response?.data?.failed?.[0]?.message || err.response?.data?.message || "Could not update pre-order");
    } finally {
      setBusyKey("");
    }
  };

  const onOutForDelivery = (order) =>
    runOrderAction(order, { key: "ofd", call: managerApi.preOrdersOutForDelivery, fallback: "Out for delivery" });

  const onDeliver = (order) => {
    const reason = (
      window.prompt(
        `Mark pre-order #${order.orderNumber} as delivered without the customer's OTP?\n\nReason (required):`
      ) || ""
    ).trim();
    if (!reason) return;
    runOrderAction(order, {
      key: "deliver",
      call: (ids) => managerApi.deliverPreOrders(ids, reason),
      fallback: "Marked delivered",
    });
  };

  const onCancel = async (order) => {
    if (!window.confirm(`Cancel pre-order #${order.orderNumber}? The customer order will also be cancelled.`)) {
      return;
    }
    setBusyKey(`cancel-${order.id}`);
    try {
      const res = await managerApi.cancelOrder(order.id);
      showToast(res.data.message || "Pre-order cancelled");
      await load({ silent: true });
    } catch (err) {
      showToast(err.response?.data?.message || "Could not cancel pre-order");
    } finally {
      setBusyKey("");
    }
  };

  const onHandOverPickup = async (order) => {
    const otp = window.prompt(`Pre-order #${order.orderNumber} — enter the customer's pickup OTP`);
    if (!otp) return;
    setBusyKey(`handover-${order.id}`);
    try {
      const res = await managerApi.handOverPickup(order.id, otp.trim());
      showToast(res.data.message || "Pre-order handed over to the customer");
      await load({ silent: true });
    } catch (err) {
      showToast(err.response?.data?.message || "Could not hand over the pre-order");
    } finally {
      setBusyKey("");
    }
  };

  const onApproveProof = async (order) => {
    setBusyKey(`proof-${order.id}`);
    try {
      const res = await managerApi.approvePickupProof(order.id);
      showToast(res.data.message || "Item proof approved. Address unlocked for rider.");
      await load({ silent: true });
    } catch (err) {
      showToast(err.response?.data?.message || "Could not approve item proof");
    } finally {
      setBusyKey("");
    }
  };

  const openPickupQr = async (orderId) => {
    setPickupQr({ orderId, loading: true, error: "", data: null });
    try {
      const res = await managerApi.getPickupQr(orderId);
      setPickupQr({ orderId, loading: false, error: "", data: res.data });
    } catch (err) {
      setPickupQr({
        orderId,
        loading: false,
        error: err.response?.data?.message || "Could not load pickup QR",
        data: null,
      });
    }
  };

  const summaryCards = [
    {
      id: "all",
      label: "All Pre-Orders",
      accent: "border-slate-200 bg-white",
      countClass: "text-slate-900",
      ring: "ring-slate-400",
    },
    {
      id: "awaiting_vendor",
      label: "Awaiting Vendor",
      accent: "border-slate-200 bg-white",
      countClass: "text-amber-700",
      ring: "ring-amber-400",
    },
    {
      id: "with_vendor",
      label: "Vendor Packing",
      accent: "border-slate-200 bg-white",
      countClass: "text-indigo-700",
      ring: "ring-indigo-400",
    },
    {
      id: "incoming",
      label: "Shipped to Store",
      accent: "border-slate-200 bg-white",
      countClass: "text-violet-700",
      ring: "ring-violet-400",
    },
    {
      id: "to_assign",
      label: "Ready to Assign",
      accent: "border-slate-200 bg-white",
      countClass: "text-emerald-700",
      ring: "ring-emerald-400",
    },
    {
      id: "on_the_way",
      label: "On The Way",
      accent: "border-slate-200 bg-white",
      countClass: "text-blue-700",
      ring: "ring-blue-400",
    },
  ];

  return (
    <PageShell
      title="Pre-Orders"
    >
      {toast && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
          ⚡ {toast}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">{error}</div>
      )}

      {/* Summary boxes with decreased compact height matching Orders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card) => {
          const selected = activeTab === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveTab(card.id)}
              className={`rounded-xl border p-3 text-left transition ${card.accent} ${
                selected ? `ring-2 ${card.ring}` : "hover:border-slate-300"
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
                {card.label}
              </div>
              <div className={`text-2xl font-black mt-0.5 ${card.countClass}`}>
                {counts[card.id] || 0}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order #, customer, phone…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none sm:w-64"
          />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="">All upcoming & open</option>
            {meta.today && <option value={meta.today}>Today ({meta.today})</option>}
            {meta.tomorrow && <option value={meta.tomorrow}>Tomorrow ({meta.tomorrow})</option>}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
          />
          <select
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="">All slots</option>
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-200">
              {bulkRiderCount} rider{bulkRiderCount === 1 ? "" : "s"} can take pre-orders
            </span>
            <button type="button" onClick={() => load()} className={actionBtnOutline}>
              🔄 Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === tab.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {counts[tab.id] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {bulkIds.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 shadow-sm">
          <p className="text-xs font-bold text-emerald-900">
            {bulkIds.length} pre-order{bulkIds.length === 1 ? "" : "s"} selected — assign all to one rider
          </p>
          <select
            value={bulkRiderId}
            onChange={(e) => setBulkRiderId(e.target.value)}
            className="min-w-[200px] rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-[11px] text-slate-800 focus:outline-none"
          >
            <option value="">{bulkRiderCount ? "Choose rider…" : "No active riders"}</option>
            {bulkRiderGroups.map(([label, list]) => (
              <optgroup key={label} label={label}>
                {list.map((r) => (
                  <option key={r.id} value={r.id}>
                    {bulkRiderLabel(r)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            disabled={!bulkRiderId || busyKey === "bulk-assign"}
            onClick={onBulkAssign}
            className={actionBtnPrimary}
          >
            {busyKey === "bulk-assign" ? "Assigning…" : `Assign ${bulkIds.length}`}
          </button>
          <button type="button" onClick={() => setBulkIds([])} className={actionBtnOutline}>
            Clear
          </button>
          <p className="w-full text-[10px] text-emerald-800">
            Assigned directly (no Accept / Decline) — the rider does not need to be online, on a booked slot or near the
            store. One rider can take many pre-orders; they get one notification and a Pre-order deliveries list, and
            scan each order's QR at the store to see that customer's address.
          </p>
        </div>
      )}

      {receiveIds.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 p-3 shadow-sm">
          <p className="text-xs font-bold text-violet-900">
            {receiveIds.length} pre-order{receiveIds.length === 1 ? "" : "s"} selected — goods arrived at the store?
          </p>
          <button
            type="button"
            disabled={busyKey === "bulk-receive"}
            onClick={() => onReceive(receiveIds)}
            className={actionBtnPrimary}
          >
            {busyKey === "bulk-receive" ? "Saving…" : `✓ Mark ${receiveIds.length} received`}
          </button>
          <button type="button" onClick={() => setReceiveIds([])} className={actionBtnOutline}>
            Clear
          </button>
        </div>
      )}

      {riderPickups.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold text-slate-900">Waiting for pickup at the store</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Print one QR label per bag. The rider scans each label to see that customer's address.
          </p>
          <div className="mt-2 divide-y divide-slate-100">
            {riderPickups.map((group) => (
              <div key={group.rider.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <p className="text-xs text-slate-700">
                  <span className="font-bold text-slate-900">{group.rider.name || group.rider.phone}</span>{" "}
                  {group.rider.phone ? <span className="text-slate-500">{group.rider.phone}</span> : null} ·{" "}
                  {group.orders.length} pre-order{group.orders.length === 1 ? "" : "s"} to collect
                </p>
                <button type="button" onClick={() => openQrLabels(group)} className={actionBtnOutline}>
                  Print QR labels ({group.orders.length})
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200/60" />
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <h3 className="text-sm font-bold text-slate-800">No Pre-Orders Found</h3>
          <p className="mt-1 text-xs text-slate-400">
            {searchQuery
              ? "No pre-orders match your search."
              : dateFilter === todayIstStr
                ? "No pre-orders scheduled for today."
                : "Nothing matches the selected filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {visibleOrders.some(canBulkAssign) && (
                      <input
                        type="checkbox"
                        title="Select all ready to assign"
                        className="h-4 w-4 cursor-pointer accent-emerald-600 rounded"
                        checked={visibleOrders.filter(canBulkAssign).every((o) => bulkIds.includes(o.id))}
                        onChange={() => toggleGroupBulk(visibleOrders)}
                      />
                    )}
                    {visibleOrders.some(canReceive) && (
                      <input
                        type="checkbox"
                        title="Select all incoming to receive"
                        className="h-4 w-4 cursor-pointer accent-violet-600 rounded"
                        checked={visibleOrders.filter(canReceive).every((o) => receiveIds.includes(o.id))}
                        onChange={() => toggleGroupReceive(visibleOrders)}
                      />
                    )}
                    <span>Customer ID</span>
                  </div>
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">Order Type</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Booking Date & Time</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Delivery Slot & Date</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Customer Details</th>
                <th className="py-3 px-3.5">Delivery Address</th>
                <th className="py-3 px-3.5">Items (Name & Qty)</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Total Bill</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Assigned Driver</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleOrders.map((order) => {
                const oid = order.id;
                const stage =
                  order.status === "preorder_hold" && vendorConfirmed(order)
                    ? STAGE_LABELS[order.preOrderStage] || null
                    : null;
                const isClosed = ["delivered", "cancelled", "delivery_failed"].includes(order.status);
                const isPickup = isPickupOrder(order);
                const canAssign =
                  !isPickup && isReceived(order) && (order.status === "packed" || order.status === "offered");
                const canHandOver = isPickup && order.status === "packed" && isReceived(order);
                const offerMsLeft =
                  order.status === "offered" && order.offerExpiresAt
                    ? Math.max(0, new Date(order.offerExpiresAt).getTime() - nowTick)
                    : 0;
                const showQr =
                  order.status === "assigned" &&
                  !order.pickupQrScanned &&
                  !order.pickupVerified &&
                  (!order.routeBatchWindowEndsAt ||
                    new Date(order.routeBatchWindowEndsAt).getTime() <= nowTick);

                const itemsTooltip = (order.items || [])
                  .map((i) => `${i.name} (Qty: ${i.quantity})`)
                  .join('\n') + (order.preOrderNote ? `\nNote: ${order.preOrderNote}` : '');

                return (
                  <tr key={oid} className="hover:bg-slate-50/70 transition">
                    {/* 1. Customer ID / Order ID */}
                    <td className="py-3 px-3.5 font-mono text-slate-900 whitespace-nowrap align-top">
                      <div className="flex items-center gap-2">
                        {canBulkAssign(order) && (
                          <input
                            type="checkbox"
                            aria-label={`Select pre-order ${order.orderNumber}`}
                            className="h-4 w-4 cursor-pointer accent-emerald-600 rounded"
                            checked={bulkIds.includes(oid)}
                            onChange={() => toggleBulk(oid)}
                          />
                        )}
                        {canReceive(order) && (
                          <input
                            type="checkbox"
                            aria-label={`Select pre-order ${order.orderNumber} to mark received`}
                            className="h-4 w-4 cursor-pointer accent-violet-600 rounded"
                            checked={receiveIds.includes(oid)}
                            onChange={() => toggleReceive(oid)}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${oid}`, { state: { order } })}
                          className="text-left font-bold text-slate-900 hover:text-emerald-700 hover:underline block text-xs"
                        >
                          #{order.orderNumber}
                        </button>
                      </div>
                    </td>

                    {/* 2. Order Type (Rendered only once) */}
                    <td className="py-3 px-3.5 align-top whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            isPickup
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : "bg-sky-100 text-sky-900 border border-sky-200"
                          }`}
                        >
                          {isPickup ? "Store pickup" : "Home delivery"}
                        </span>
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                          Pre-order
                        </span>
                      </div>
                    </td>

                    {/* 3. Booking Date & Time Column (When order was booked) */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-top font-sans">
                      {order.createdAt ? (
                        <div>
                          <div className="font-bold text-xs text-slate-800">
                            {new Date(order.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* 4. Delivery Slot & Date Column (When order should be delivered) */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-top font-sans">
                      <div className="font-bold text-xs text-slate-800">
                        {order.preOrderDate
                          ? new Date(order.preOrderDate + "T12:00:00+05:30").toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "Scheduled"}
                      </div>
                      {order.preOrderSlot && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          <span>🕒</span>
                          <span>{order.preOrderSlot}</span>
                        </div>
                      )}
                    </td>

                    {/* 4. Customer Details */}
                    <td className="py-3 px-3.5 align-top whitespace-nowrap">
                      <p className="font-bold text-xs text-slate-900">
                        {order.customerName || "Customer"}
                      </p>
                      <div className="text-slate-500 text-[11px] mt-0.5 font-medium">
                        {order.customerPhone || "N/A"}
                      </div>
                    </td>

                    {/* 5. Customer Address (Clamped to 2 lines with ellipsis, hover full address, km below) */}
                    <td className="py-3 px-3.5 text-slate-700 max-w-[210px] align-top">
                      {isPickup ? (
                        <span className="inline-block rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 mb-1">
                          Store Pickup
                        </span>
                      ) : null}
                      <div
                        className="line-clamp-2 text-xs text-slate-700 leading-snug cursor-help"
                        title={order.customerAddress || "Store Pickup"}
                      >
                        {order.customerAddress || "Store Pickup"}
                      </div>
                      {!isPickup && order.distanceKm != null && (
                        <div className="mt-1 inline-block rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                          📍 {Number(order.distanceKm).toFixed(1)} km from dark store
                        </div>
                      )}
                    </td>

                    {/* 6. Items (Name & Quantity) (Clamped to 2 lines with ellipsis, hover full list) */}
                    <td className="py-3 px-3.5 text-xs max-w-[190px] align-top">
                      <p className="font-bold text-slate-800 text-[11px] mb-0.5">
                        {order.items?.length || 0} item{order.items?.length === 1 ? "" : "s"}
                      </p>
                      <div
                        className="line-clamp-2 text-[11px] text-slate-600 leading-snug cursor-help"
                        title={itemsTooltip}
                      >
                        {(order.items || []).map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                      </div>
                      {order.preOrderNote && (
                        <p
                          className="mt-1 truncate text-[10px] font-medium text-amber-900 bg-amber-50 rounded px-1 cursor-help"
                          title={order.preOrderNote}
                        >
                          Note: {order.preOrderNote}
                        </p>
                      )}
                    </td>

                    {/* 7. Total Bill (Price, Paid / Unpaid) */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-top">
                      <div className="font-bold text-xs text-slate-900">
                        {formatRupee(order.orderTotal || order.amountToCollect || 0)}
                      </div>
                      <div className="mt-0.5">
                        {isCodPayment(order.paymentMethod) ? (
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            COD (Unpaid)
                          </span>
                        ) : (
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                            Paid Online
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 8. Status */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-top">
                      <div className="space-y-1">
                        <OrderStatusText status={order.status} order={order} />
                        {stage && (
                          <div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${stage.className}`}>
                              {stage.text}
                            </span>
                          </div>
                        )}
                        {order.status === "preorder_hold" && (
                          <div className="mt-0.5">
                            {vendorConfirmed(order) ? (
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                                Vendor confirmed
                              </span>
                            ) : (
                              <span className="rounded bg-orange-50 border border-orange-200 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">
                                Awaiting vendor
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 9. Assigned Driver */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-top">
                      {isPickup ? (
                        <span className="text-[11px] font-semibold text-amber-700">Store Pickup — no rider</span>
                      ) : order.assignedRider ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => setTrackingOrderId(oid)}
                            className="text-left text-[11px] font-bold text-teal-800 underline decoration-dotted underline-offset-2 hover:text-teal-600 block"
                            title="Delivery details"
                          >
                            {order.assignedRider.name} · Track 📍
                          </button>
                          <div className="text-[10px] text-slate-500 mt-0.5">{order.assignedRider.phone}</div>
                          <DeliveryDelayNotice order={order} />
                        </div>
                      ) : order.status === "offered" ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            Offering {order.offeredRider?.name || "rider"}
                          </span>
                          {offerMsLeft > 0 ? (
                            <p className="text-[10px] text-amber-700">{Math.ceil(offerMsLeft / 1000)}s left</p>
                          ) : null}
                        </div>
                      ) : (
                        /* Bold Red Broad Capital UNASSIGNED Badge */
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 border-2 border-rose-500 px-2.5 py-1 text-xs font-black tracking-wider text-rose-700 uppercase shadow-2xs">
                          <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                          UNASSIGNED
                        </span>
                      )}
                    </td>

                    {/* 10. Actions */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap align-top">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {/* View Detail in Blue Color BG */}
                          <button
                            type="button"
                            onClick={() => navigate(`/orders/${oid}`, { state: { order } })}
                            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 transition shadow-xs"
                          >
                            View Detail
                          </button>

                          {/* Cancel with Light Orange Color BG */}
                          {!isClosed && (
                            <button
                              type="button"
                              disabled={busyKey === `cancel-${oid}`}
                              onClick={() => onCancel(order)}
                              className="rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300 font-bold text-xs px-3 py-1.5 transition shadow-xs disabled:opacity-50"
                            >
                              {busyKey === `cancel-${oid}` ? "Cancelling…" : "Cancel"}
                            </button>
                          )}

                          {canReceive(order) && (
                            <button
                              type="button"
                              disabled={busyKey === `receive-${oid}`}
                              onClick={() => onReceive([oid])}
                              className={actionBtnPrimary}
                            >
                              {busyKey === `receive-${oid}` ? "Saving…" : "✓ Mark received"}
                            </button>
                          )}

                          {canHandOver && (
                            <button
                              type="button"
                              disabled={busyKey === `handover-${oid}`}
                              onClick={() => onHandOverPickup(order)}
                              className={actionBtnPrimary}
                            >
                              {busyKey === `handover-${oid}` ? "Handing over…" : "Hand over (OTP)"}
                            </button>
                          )}

                          {canAssign && (
                            <div className="flex items-center gap-1">
                              <select
                                value={selectedRider[oid] || ""}
                                onChange={(e) => setSelectedRider((prev) => ({ ...prev, [oid]: e.target.value }))}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-800 focus:outline-none"
                              >
                                <option value="">{bulkRiderCount ? "Choose rider…" : "No riders"}</option>
                                {bulkRiderGroups.map(([label, list]) => (
                                  <optgroup key={label} label={label}>
                                    {list.map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {bulkRiderLabel(r)}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!selectedRider[oid] || busyKey === `assign-${oid}`}
                                onClick={() => onAssign(order)}
                                className={actionBtnOutline}
                              >
                                {busyKey === `assign-${oid}` ? "Assigning…" : "Assign"}
                              </button>
                            </div>
                          )}

                          {canMarkOutForDelivery(order) && (
                            <button
                              type="button"
                              disabled={busyKey === `ofd-${oid}`}
                              onClick={() => onOutForDelivery(order)}
                              className={actionBtnPrimary}
                            >
                              {busyKey === `ofd-${oid}` ? "Saving…" : "🚚 Out for delivery"}
                            </button>
                          )}

                          {canMarkDelivered(order) && (
                            <button
                              type="button"
                              disabled={busyKey === `deliver-${oid}`}
                              onClick={() => onDeliver(order)}
                              className={actionBtnOutline}
                            >
                              {busyKey === `deliver-${oid}` ? "Saving…" : "✓ Delivered"}
                            </button>
                          )}

                          {showQr && (
                            <button
                              type="button"
                              onClick={() => openPickupQr(oid)}
                              className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                            >
                              Pickup QR
                            </button>
                          )}
                        </div>

                        {order.pickupProofStatus === "pending" && order.pickupProofImageUrl && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <img
                              src={order.pickupProofImageUrl}
                              alt="Item proof"
                              className="h-8 w-8 rounded border border-slate-200 object-cover"
                            />
                            <button
                              type="button"
                              disabled={busyKey === `proof-${oid}`}
                              onClick={() => onApproveProof(order)}
                              className={actionBtnPrimary}
                            >
                              {busyKey === `proof-${oid}` ? "Approving…" : "Approve proof"}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PickupQrModal
        isOpen={Boolean(pickupQr.orderId)}
        onClose={() => setPickupQr({ orderId: null, loading: false, error: "", data: null })}
        loading={pickupQr.loading}
        error={pickupQr.error}
        orderNumber={pickupQr.data?.orderNumber}
        driverName={pickupQr.data?.driverName}
        pickupQrPayload={pickupQr.data?.pickupQrPayload}
        isPreOrder
      />

      <PreOrderQrLabels
        open={qrLabels.open}
        loading={qrLabels.loading}
        riderName={qrLabels.riderName}
        storeName={manager?.storeName}
        labels={qrLabels.labels}
        onClose={() => setQrLabels({ open: false, loading: false, riderName: "", labels: [] })}
      />

      {trackingOrderId ? (
        <OrderTrackingDrawer orderId={trackingOrderId} onClose={() => setTrackingOrderId(null)} />
      ) : null}
    </PageShell>
  );
}
