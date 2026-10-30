import { useCallback, useEffect, useMemo, useState } from "react";
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

const TABS = [
  { id: "awaiting_vendor", label: "Awaiting Vendor" },
  { id: "with_vendor", label: "Vendor Packing" },
  { id: "incoming", label: "Shipped · Incoming" },
  { id: "to_assign", label: "Received · Assign Rider" },
  { id: "on_the_way", label: "Assigned / On the way" },
  { id: "delivered", label: "Delivered" },
  { id: "closed", label: "Cancelled / Failed" },
  { id: "all", label: "All" },
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
  const [activeTab, setActiveTab] = useState("incoming");
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
    const c = {};
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

  const groups = useMemo(() => {
    const map = new Map();
    for (const o of visibleOrders) {
      const key = `${o.preOrderDate || ""}__${o.preOrderSlot || ""}`;
      if (!map.has(key)) {
        map.set(key, { key, date: o.preOrderDate, slot: o.preOrderSlot, orders: [] });
      }
      map.get(key).orders.push(o);
    }
    return [...map.values()];
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
      id: "awaiting_vendor",
      label: "Awaiting vendor",
      hint: "Vendor has not confirmed yet",
      accent: "border-orange-200 bg-orange-50",
      countClass: "text-orange-800",
      ring: "ring-orange-500",
    },
    {
      id: "with_vendor",
      label: "Vendor packing",
      hint: "Vendor confirmed — packing & shipping",
      accent: "border-indigo-200 bg-indigo-50",
      countClass: "text-indigo-800",
      ring: "ring-indigo-500",
    },
    {
      id: "incoming",
      label: "Shipped to store",
      hint: "Vendor shipped — mark received on arrival",
      accent: "border-violet-200 bg-violet-50",
      countClass: "text-violet-800",
      ring: "ring-violet-500",
    },
    {
      id: "to_assign",
      label: "Ready to assign",
      hint: "Received at store",
      accent: "border-emerald-200 bg-emerald-50",
      countClass: "text-emerald-800",
      ring: "ring-emerald-500",
    },
    {
      id: "on_the_way",
      label: "Assigned / On the way",
      hint: "Rider accepted",
      accent: "border-amber-200 bg-amber-50",
      countClass: "text-amber-800",
      ring: "ring-amber-500",
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setActiveTab(card.id)}
            className={`rounded-2xl border p-4 text-left shadow-xs transition ${card.accent} ${
              activeTab === card.id ? `ring-2 ${card.ring}` : "hover:shadow-sm"
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{card.label}</p>
            <p className={`mt-1 text-3xl font-black ${card.countClass}`}>{counts[card.id] || 0}</p>
            <p className="mt-1 text-[11px] text-slate-500">{card.hint}</p>
          </button>
        ))}
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
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <h3 className="text-sm font-bold text-slate-800">No pre-orders here</h3>
          <p className="mt-1 text-xs text-slate-400">
            {activeTab === "incoming"
              ? "Pre-orders appear here once the vendor ships them."
              : activeTab === "to_assign"
                ? "Mark incoming pre-orders as received to assign riders."
                : "Nothing matches the selected filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <header className="flex flex-wrap items-center justify-between gap-2 bg-black px-4 py-2.5 text-white">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span>{formatDayLabel(group.date, meta.today, meta.tomorrow)}</span>
                  <span className="text-white/40">·</span>
                  <span className="text-emerald-300">{group.slot || "No slot"}</span>
                </div>
                <div className="flex items-center gap-3">
                  {group.orders.some(canReceive) && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-white/80">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-violet-500"
                        checked={group.orders.filter(canReceive).every((o) => receiveIds.includes(o.id))}
                        onChange={() => toggleGroupReceive(group.orders)}
                      />
                      Select all incoming
                    </label>
                  )}
                  {group.orders.some(canBulkAssign) && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-white/80">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-emerald-500"
                        checked={group.orders
                          .filter(canBulkAssign)
                          .every((o) => bulkIds.includes(o.id))}
                        onChange={() => toggleGroupBulk(group.orders)}
                      />
                      Select all ready
                    </label>
                  )}
                  <span className="text-xs font-semibold text-white/70">
                    {group.orders.length} order{group.orders.length === 1 ? "" : "s"}
                  </span>
                </div>
              </header>

              <div className="divide-y divide-slate-100">
                {group.orders.map((order) => {
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

                  return (
                    <div key={oid} className="grid gap-4 p-4 lg:grid-cols-[1.3fr_1fr_1fr]">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {canBulkAssign(order) && (
                            <input
                              type="checkbox"
                              aria-label={`Select pre-order ${order.orderNumber}`}
                              className="h-4 w-4 cursor-pointer accent-emerald-600"
                              checked={bulkIds.includes(oid)}
                              onChange={() => toggleBulk(oid)}
                            />
                          )}
                          {canReceive(order) && (
                            <input
                              type="checkbox"
                              aria-label={`Select pre-order ${order.orderNumber} to mark received`}
                              className="h-4 w-4 cursor-pointer accent-violet-600"
                              checked={receiveIds.includes(oid)}
                              onChange={() => toggleReceive(oid)}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/orders/${oid}`, { state: { order } })}
                            className="font-mono text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                          >
                            #{order.orderNumber}
                          </button>
                          <OrderStatusText status={order.status} order={order} />
                          {stage && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${stage.className}`}>
                              {stage.text}
                            </span>
                          )}
                        </div>
                        <OrderDepartmentTags order={order} />
                        <p className="text-sm font-bold text-slate-900">
                          {order.customerName || "Customer"}{" "}
                          <span className="text-xs font-normal text-slate-500">{order.customerPhone}</span>
                        </p>
                        {isPickup ? (
                          <p className="text-[11px] font-bold text-amber-700">Customer collects at this store in the slot</p>
                        ) : null}
                        <p className="line-clamp-2 text-xs text-slate-600">{order.customerAddress}</p>
                        {!isPickup && order.distanceKm != null && (
                          <p className="text-[10px] font-semibold text-emerald-700">
                            {Number(order.distanceKm).toFixed(1)} km from store
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1.5 text-xs">
                        <p className="font-semibold text-slate-800">
                          {order.items?.length || 0} item{order.items?.length === 1 ? "" : "s"} ·{" "}
                          {isCodPayment(order.paymentMethod)
                            ? `COD ${formatRupee(order.amountToCollect || order.orderTotal)}`
                            : "Paid online"}
                        </p>
                        <p className="line-clamp-3 text-slate-600">
                          {(order.items || []).map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                        </p>
                        {order.vendorConfirmedAt && (
                          <p className="text-[11px] text-slate-500">
                            Vendor confirmed {formatTime(order.vendorConfirmedAt)}
                            {order.vendorActionByName ? ` by ${order.vendorActionByName}` : ""}
                          </p>
                        )}
                        {order.forwardedAt && (
                          <p className="text-[11px] text-slate-500">
                            Shipped {formatTime(order.forwardedAt)}
                            {order.forwardedByName ? ` by ${order.forwardedByName}` : ""}
                          </p>
                        )}
                        {order.storeReceivedAt && (
                          <p className="text-[11px] font-semibold text-violet-700">
                            Received at store {formatTime(order.storeReceivedAt)}
                          </p>
                        )}
                        {order.preOrderNote && (
                          <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900">
                            Note: {order.preOrderNote}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-stretch gap-2 lg:items-end">
                        {order.status === "preorder_hold" &&
                          (vendorConfirmed(order) ? (
                            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-[11px] font-semibold text-indigo-800">
                              {order.preOrderStage === "ready"
                                ? "Packed by the vendor — waiting for the vendor to ship it to this store."
                                : "Confirmed by the vendor — waiting for the vendor to pack & ship."}
                            </p>
                          ) : (
                            <p className="rounded-lg bg-orange-50 px-3 py-2 text-[11px] font-semibold text-orange-800">
                              Waiting for the vendor to confirm this pre-order.
                            </p>
                          ))}

                        {canReceive(order) && (
                          <button
                            type="button"
                            disabled={busyKey === `receive-${oid}`}
                            onClick={() => onReceive([oid])}
                            className={actionBtnPrimary}
                          >
                            {busyKey === `receive-${oid}` ? "Saving…" : "✓ Mark received at store"}
                          </button>
                        )}

                        {canHandOver && (
                          <button
                            type="button"
                            disabled={busyKey === `handover-${oid}`}
                            onClick={() => onHandOverPickup(order)}
                            className={actionBtnPrimary}
                          >
                            {busyKey === `handover-${oid}` ? "Handing over…" : "Hand over to customer (OTP)"}
                          </button>
                        )}

                        {order.status === "offered" && (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
                            Offer sent to {order.offeredRider?.name || "rider"}
                            {offerMsLeft > 0 ? ` · ${Math.ceil(offerMsLeft / 1000)}s` : " · waiting…"}
                          </p>
                        )}

                        {canAssign && (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={selectedRider[oid] || ""}
                              onChange={(e) => setSelectedRider((prev) => ({ ...prev, [oid]: e.target.value }))}
                              className="min-w-[160px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-800 focus:outline-none"
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
                              disabled={!selectedRider[oid] || busyKey === `assign-${oid}`}
                              onClick={() => onAssign(order)}
                              className={actionBtnPrimary}
                            >
                              {busyKey === `assign-${oid}`
                                ? "Assigning…"
                                : order.status === "offered"
                                  ? "Re-assign"
                                  : "Assign"}
                            </button>
                          </div>
                        )}

                        {(canMarkOutForDelivery(order) || canMarkDelivered(order)) && (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {canMarkOutForDelivery(order) && (
                              <button
                                type="button"
                                disabled={busyKey === `ofd-${oid}`}
                                onClick={() => onOutForDelivery(order)}
                                className={actionBtnPrimary}
                              >
                                {busyKey === `ofd-${oid}` ? "Saving…" : "🚚 Mark out for delivery"}
                              </button>
                            )}
                            {canMarkDelivered(order) && (
                              <button
                                type="button"
                                disabled={busyKey === `deliver-${oid}`}
                                onClick={() => onDeliver(order)}
                                className={actionBtnOutline}
                              >
                                {busyKey === `deliver-${oid}` ? "Saving…" : "✓ Mark delivered"}
                              </button>
                            )}
                          </div>
                        )}

                        {order.assignedRider && (
                          <button
                            type="button"
                            onClick={() => setTrackingOrderId(oid)}
                            className="text-left text-[11px] font-bold text-teal-800 underline decoration-dotted underline-offset-2 hover:text-teal-600"
                            title="Delivery details"
                          >
                            Rider: {order.assignedRider.name}{" "}
                            <span className="font-normal text-slate-500">{order.assignedRider.phone}</span> · Details 📍
                          </button>
                        )}
                        <DeliveryDelayNotice order={order} />
                        {order.pickupProofStatus === "pending" && order.pickupProofImageUrl && (
                          <div className="flex items-center gap-2">
                            <img
                              src={order.pickupProofImageUrl}
                              alt="Item proof"
                              className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                            />
                            <button
                              type="button"
                              disabled={busyKey === `proof-${oid}`}
                              onClick={() => onApproveProof(order)}
                              className={actionBtnPrimary}
                            >
                              {busyKey === `proof-${oid}` ? "Approving…" : "✓ Approve item proof"}
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {showQr && (
                            <button
                              type="button"
                              onClick={() => openPickupQr(oid)}
                              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                            >
                              Show Pickup QR
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/orders/${oid}`, { state: { order } })}
                            className={actionBtnOutline}
                          >
                            View Detail
                          </button>
                          {!isClosed && (
                            <button
                              type="button"
                              disabled={busyKey === `cancel-${oid}`}
                              onClick={() => onCancel(order)}
                              className={actionBtnDanger}
                            >
                              {busyKey === `cancel-${oid}` ? "Cancelling…" : "Cancel"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
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
