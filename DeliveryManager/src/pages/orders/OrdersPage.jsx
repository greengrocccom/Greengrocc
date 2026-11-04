import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import PickupQrModal from "../../components/PickupQrModal";
import OrderTrackingDrawer from "../../components/tracking/OrderTrackingDrawer";
import { useLive } from "../../realtime/useLive";
import { mapsLink, useRiderLiveLocations } from "../../hooks/useRiderLiveLocations";
import { subscribeToSocketEvent } from "../../services/socket";
import { STATUS_TABS, matchesTab, countBySummaryBucket, OrderStatusText, OrderDepartmentTags, DriverAssignmentText, isInitialOrderStatus, allItemsAvailable, actionBtnOutline, actionBtnPrimary, actionBtnDanger, isCodPayment, isPickupOrder, formatRupee } from "./orderUtils";


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

const yesterdayIstStr = (() => {
  try {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
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

const orderMatchesDate = (order, dateFilter) => {
  if (!dateFilter) return true;
  const dStr = (order.isPreOrder && order.preOrderDate)
    ? `${order.preOrderDate}T12:00:00+05:30`
    : (order.createdAt || order.orderDate || order.deliveredAt);
  if (!dStr) return true;
  try {
    const d = new Date(dStr);
    if (Number.isNaN(d.getTime())) return true;
    const orderDateIst = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    return orderDateIst === dateFilter;
  } catch (_) {
    return true;
  }
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [onlineRiders, setOnlineRiders] = useState([]);
  const [selectedRider, setSelectedRider] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState(todayIstStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [pickupQrOrderId, setPickupQrOrderId] = useState(null);
  const [pickupQrLoading, setPickupQrLoading] = useState(false);
  const [pickupQrError, setPickupQrError] = useState("");
  const [pickupQrData, setPickupQrData] = useState(null);
  const [routeSuggestions, setRouteSuggestions] = useState([]);
  const [openWindowOrders, setOpenWindowOrders] = useState([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const openTracking = useCallback((order) => setTrackingOrderId(order.id || order._id), []);
  const closeTracking = useCallback(() => setTrackingOrderId(null), []);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const [ord, rid, sug] = await Promise.all([
        managerApi.orders({
          status:
            "preorder_hold,incoming,order_received,stock_issue,packed,offered,assigned,pickup_verified,out_for_delivery,delivered,delivery_failed,cancelled",
          preOrder: "include",
        }),
        managerApi.riders(),
        managerApi.routeSuggestions().catch(() => ({ data: { suggestions: [], openWindowOrders: [] } })),
      ]);
      setOrders(ord.data.orders || []);
      setOnlineRiders((rid.data.riders || []).filter((r) => r.status === "online" || r.status === "on_delivery"));
      setRouteSuggestions(sug.data?.suggestions || []);
      setOpenWindowOrders(sug.data?.openWindowOrders || []);
      setError("");
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || "Failed to load orders");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useLive(load, [load]);

  // Countdown tick for same-route window banners (1s so timer feels live)
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Instant UI patches + toasts from store events
  useEffect(() => {
    const patchOrder = (orderId, patch) => {
      if (!orderId) return;
      setOrders((prev) =>
        prev.map((o) =>
          String(o.id || o._id) === String(orderId) ? { ...o, ...patch } : o
        )
      );
    };

    const riderPatch = (p = {}) => {
      const rider = p.assignedRider || p.offeredRider || null;
      const patch = {
        status: p.status,
        assignmentStatus: p.assignmentStatus,
        failureReason: p.failureReason,
        routeBatchWindowEndsAt: p.routeBatchWindowEndsAt,
      };
      if (p.assignedRiderId) patch.assignedRiderId = p.assignedRiderId;
      if (rider) {
        patch.assignedRider = rider;
        patch.assignedRiderId = rider.id || rider._id || p.assignedRiderId;
      }
      if (p.offeredRider) {
        patch.offeredRider = p.offeredRider;
        patch.offeredRiderId = p.offeredRider.id || p.offeredRider._id;
      }
      return patch;
    };

    const unsubs = [
      subscribeToSocketEvent("new_order_received", (p = {}) => {
        showToast(p.fulfillmentType === "pickup" ? "New store-pickup order received" : "New order received");
        load({ silent: true });
      }),
      subscribeToSocketEvent("new_preorder_received", (p = {}) => {
        showToast(`New pre-order${p.preOrderSlot ? ` · slot ${p.preOrderSlot}` : ""}`);
        load({ silent: true });
      }),
      subscribeToSocketEvent("order_status_update", () => {
        load({ silent: true });
      }),
      subscribeToSocketEvent("order_packed", (p = {}) => {
        patchOrder(p.orderId, {
          status: p.status || "packed",
          assignmentStatus: p.assignmentStatus,
          routeBatchWindowEndsAt: p.routeBatchWindowEndsAt,
        });
        if (p.routeBatchWindowEndsAt) {
          setOpenWindowOrders((prev) => {
            const id = String(p.orderId);
            const next = prev.filter((o) => String(o.id || o._id) !== id);
            return [
              {
                id: p.orderId,
                orderNumber: p.orderNumber,
                routeBatchWindowEndsAt: p.routeBatchWindowEndsAt,
                status: p.status || "packed",
              },
              ...next,
            ];
          });
          showToast("Same-route 5 min wait started");
        } else if (p.autoSameRouteAttached) {
          showToast("Packed & auto-assigned to same-route rider");
        }
        load({ silent: true });
      }),
      subscribeToSocketEvent("same_route_window_started", (p = {}) => {
        patchOrder(p.orderId, {
          routeBatchWindowEndsAt: p.routeBatchWindowEndsAt,
          assignedRiderId: p.assignedRiderId,
          ...(p.assignedRiderId ? { status: "assigned" } : {}),
        });
        if (p.routeBatchWindowEndsAt) {
          setOpenWindowOrders((prev) => {
            const id = String(p.orderId);
            const next = prev.filter((o) => String(o.id || o._id) !== id);
            return [
              {
                id: p.orderId,
                orderNumber: p.orderNumber,
                routeBatchWindowEndsAt: p.routeBatchWindowEndsAt,
                assignedRiderId: p.assignedRiderId,
              },
              ...next,
            ];
          });
        }
        showToast(`Same-route wait · #${p.orderNumber || ""} · 5:00`);
        load({ silent: true });
      }),
      subscribeToSocketEvent("same_route_suggestion", (p = {}) => {
        if (p?.orderA && p?.orderB) {
          setRouteSuggestions((prev) => {
            const key = [p.orderA.id, p.orderB.id].sort().join(":");
            if (prev.some((s) => [s.orderA?.id, s.orderB?.id].sort().join(":") === key)) {
              return prev;
            }
            return [p, ...prev];
          });
          showToast("Possible same-route order found");
        }
        load({ silent: true });
      }),
      subscribeToSocketEvent("same_route_assigned", (p = {}) => {
        showToast(
          p?.riderName
            ? `Same-route: both orders → ${p.riderName}`
            : "Same-route orders assigned to one rider"
        );
        load({ silent: true });
      }),
      subscribeToSocketEvent("order_batch_window_ended", (p = {}) => {
        patchOrder(p.orderId, {
          routeBatchWindowEndsAt: null,
          pickupQrUnlocked: p.pickupQrUnlocked !== false,
        });
        setOpenWindowOrders((prev) =>
          prev.filter((o) => String(o.id || o._id) !== String(p.orderId))
        );
        if (p.pickupQrUnlocked !== false) {
          showToast(`Pickup QR unlocked · #${p.orderNumber || ""}`);
        }
        load({ silent: true });
      }),
      subscribeToSocketEvent("pickup_qr_unlocked", (p = {}) => {
        patchOrder(p.orderId, {
          pickupQrUnlocked: true,
          routeBatchWindowEndsAt: null,
        });
        if (p.companionOrderId) {
          patchOrder(p.companionOrderId, {
            pickupQrUnlocked: true,
            routeBatchWindowEndsAt: null,
          });
        }
        setOpenWindowOrders((prev) =>
          prev.filter(
            (o) =>
              String(o.id || o._id) !== String(p.orderId) &&
              String(o.id || o._id) !== String(p.companionOrderId || "")
          )
        );
        showToast(
          p.reason === "same_route_batched"
            ? "Same-route batch ready — Show Pickup QR for both"
            : `Pickup QR unlocked · #${p.orderNumber || ""}`
        );
        load({ silent: true });
      }),
      subscribeToSocketEvent("pickup_qr_scanned", (p = {}) => {
        patchOrder(p.orderId, {
          pickupQrScanned: true,
          pickupQrScannedAt: p.scannedAt || new Date().toISOString(),
          routeBatchWindowEndsAt: null,
          pickupQrUnlocked: true,
        });
        showToast("Pickup QR scanned");
        load({ silent: true });
      }),
      subscribeToSocketEvent("pickup_proof_submitted", (p = {}) => {
        patchOrder(p.orderId, {
          pickupProofStatus: "pending",
          pickupProofImageUrl: p.pickupProofImageUrl || "",
          pickupProofSubmittedAt:
            p.pickupProofSubmittedAt || new Date().toISOString(),
        });
        showToast("Item proof uploaded — review needed");
        load({ silent: true });
      }),
      subscribeToSocketEvent("pickup_verified", (p = {}) => {
        patchOrder(p.orderId, {
          pickupProofStatus: "approved",
          pickupVerified: true,
          customerAddressUnlocked: true,
          status: p.status || "out_for_delivery",
        });
        showToast("Item proof approved — address unlocked");
        load({ silent: true });
      }),
      subscribeToSocketEvent("driver_assigned", (p = {}) => {
        patchOrder(p.orderId, riderPatch(p));
        load({ silent: true });
      }),
      subscribeToSocketEvent("order_status_updated", (p = {}) => {
        if (p.orderId) {
          patchOrder(p.orderId, riderPatch(p));
        }
        load({ silent: true });
      }),
      subscribeToSocketEvent("order_delivery_failed", (p = {}) => {
        patchOrder(p.orderId, {
          status: "delivery_failed",
          failureReason: p.failureReason,
          failureKind: p.failureKind,
          failedAt: p.failedAt,
        });
        showToast(`${p.failureKind === "rider_emergency" ? "Rider emergency" : "Delivery failed"}: #${p.orderNumber || ""}`);
        load({ silent: true });
      }),
      subscribeToSocketEvent("order_delivered", (p = {}) => {
        patchOrder(p.orderId, { status: "delivered", deliveredAt: p.deliveredAt });
        load({ silent: true });
      }),
      subscribeToSocketEvent("rider_cash_updated", () => {
        load({ silent: true });
      }),
      subscribeToSocketEvent("online_payment_claim", (p = {}) => {
        showToast(`Online payment to approve · #${p.orderNumber || ""}`);
        load({ silent: true });
      }),
      subscribeToSocketEvent("otp_lockout_alert", (p = {}) => {
        showToast(`OTP locked after repeated wrong attempts · #${p.orderNumber || ""}`);
      }),
    ];
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  // Live GPS only for riders on active trips / assignable online
  const trackRiderIds = useMemo(() => {
    const ids = new Set();
    for (const o of orders) {
      if (
        ["assigned", "pickup_verified", "out_for_delivery", "offered", "packed"].includes(
          o.status
        )
      ) {
        const id = o.assignedRiderId || o.assignedRider?.id || o.assignedRider?._id;
        if (id) ids.add(String(id));
      }
    }
    for (const r of onlineRiders) {
      const id = r.id || r._id;
      if (id) ids.add(String(id));
    }
    return [...ids];
  }, [orders, onlineRiders]);

  const liveLocations = useRiderLiveLocations(
    trackRiderIds,
    trackRiderIds.length > 0
  );

  const openPickupQr = async (orderId) => {
    setPickupQrOrderId(orderId);
    setPickupQrLoading(true);
    setPickupQrError("");
    setPickupQrData(null);
    try {
      const res = await managerApi.getPickupQr(orderId);
      setPickupQrData(res.data);
    } catch (err) {
      setPickupQrError(err.response?.data?.message || "Could not load pickup QR");
    } finally {
      setPickupQrLoading(false);
    }
  };

  const closePickupQr = () => {
    setPickupQrOrderId(null);
    setPickupQrData(null);
    setPickupQrError("");
  };

  const formatShortages = (shortages) =>
    (shortages || [])
      .map((s) => `${s.name} (need ${s.needed}, have ${s.available})`)
      .join("; ");

  const onPackOrder = async (orderId) => {
    const key = `pack-${orderId}`;
    setBusyKey(key);
    try {
      const res = await managerApi.packOrder(orderId);
      showToast(res.data.message || "Order confirmed — stock deducted from this dark store.");
      await load();
    } catch (err) {
      const shortages = formatShortages(err.response?.data?.shortages);
      showToast(
        shortages
          ? `Cannot confirm: ${shortages}. Request inventory or inform the customer.`
          : err.response?.data?.message || "Confirm order failed"
      );
    } finally {
      setBusyKey("");
    }
  };

  const onApprovePickupProof = async (orderId) => {
    const key = `approve-proof-${orderId}`;
    setBusyKey(key);
    try {
      const res = await managerApi.approvePickupProof(orderId);
      showToast(res.data.message || "Item proof approved. Driver address unlocked.");
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not approve item proof");
    } finally {
      setBusyKey("");
    }
  };

  const onManualAssign = async (orderId) => {
    const riderId = selectedRider[orderId];
    if (!riderId) return;
    const key = `assign-${orderId}`;
    setBusyKey(key);
    try {
      const res = await managerApi.assignOrder(orderId, riderId);
      showToast(res.data.message || "Offer sent — rider must Accept / Decline");
      setSelectedRider((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
      await load();
    } catch (err) {
      const shortages = formatShortages(err.response?.data?.shortages);
      showToast(
        shortages
          ? `Cannot assign: ${shortages}`
          : err.response?.data?.message || "Assignment failed"
      );
    } finally {
      setBusyKey("");
    }
  };

  const onDispatchNow = async (orderId) => {
    const key = `dispatch-${orderId}`;
    setBusyKey(key);
    try {
      const res = await managerApi.dispatchOrderNow(orderId);
      showToast(res.data.message || "Searching for a new rider…");
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Dispatch failed");
    } finally {
      setBusyKey("");
    }
  };

  const onAssignSameRoute = async (suggestion) => {
    const primaryId = suggestion.orderA?.id;
    const companionId = suggestion.orderB?.id;
    const riderId =
      suggestion.recommendedRiderId ||
      selectedRider[primaryId] ||
      selectedRider[companionId] ||
      onlineRiders[0]?.id ||
      onlineRiders[0]?._id;
    if (!primaryId || !companionId) return;
    if (!riderId) {
      showToast("Select or ensure an online rider is available first");
      return;
    }
    const key = `same-${primaryId}-${companionId}`;
    setBusyKey(key);
    try {
      const res = await managerApi.assignSameRoute({
        primaryOrderId: primaryId,
        companionOrderId: companionId,
        riderId,
      });
      showToast(res.data.message || "Both orders assigned to same rider");
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Same-route assign failed");
    } finally {
      setBusyKey("");
    }
  };

  const onHandOverPickup = async (orderId, orderNumber) => {
    const otp = window.prompt(`Order #${orderNumber || ""} — enter the customer's 4-digit pickup OTP`);
    if (!otp) return;
    const key = `handover-${orderId}`;
    setBusyKey(key);
    try {
      const res = await managerApi.handOverPickup(orderId, otp.trim());
      showToast(res.data.message || "Order handed over to the customer");
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not hand over the order");
    } finally {
      setBusyKey("");
    }
  };

  const onCancelOrder = async (orderId, orderNumber) => {
    if (!window.confirm(`Cancel order #${orderNumber || ""}? The customer order will also be cancelled.`)) return;
    const key = `cancel-${orderId}`;
    setBusyKey(key);
    try {
      const res = await managerApi.cancelOrder(orderId);
      showToast(res.data.message || "Order cancelled");
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not cancel order");
    } finally {
      setBusyKey("");
    }
  };

  const onCreateDemoOrder = async () => {
    setBusyKey("create-demo");
    try {
      const res = await managerApi.createDemoOrder();
      showToast(res.data.message || "Incoming order generated! Review & click 'Mark Packed' when ready.");
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to generate incoming order");
    } finally {
      setBusyKey("");
    }
  };

  const onConfirmCashReceived = async (orderId, orderNumber) => {
    const key = `confirm-cash-${orderId}`;
    setBusyKey(key);
    try {
      const res = await managerApi.confirmOrderCash(orderId);
      showToast(res.data?.message || `Cash received from delivery partner for Order #${orderNumber || ""}.`);
      await load({ silent: true });
    } catch (err) {
      showToast(err.response?.data?.message || "Could not confirm cash receipt");
    } finally {
      setBusyKey("");
    }
  };

  const pendingCodOrders = useMemo(
    () => orders.filter((o) => Boolean(o.collectFromDriver)),
    [orders]
  );

  const totalPendingCodAmount = useMemo(
    () =>
      pendingCodOrders.reduce(
        (sum, o) => sum + (Number(o.collectFromDriver?.amount) || 0),
        0
      ),
    [pendingCodOrders]
  );

  const dateFilteredOrders = useMemo(() => {
    return orders.filter((o) => orderMatchesDate(o, dateFilter));
  }, [orders, dateFilter]);

  const summary = useMemo(() => countBySummaryBucket(dateFilteredOrders), [dateFilteredOrders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return dateFilteredOrders.filter((o) => {
      const matchSearch =
        !q ||
        (o.orderNumber || "").toLowerCase().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.customerPhone || "").includes(q) ||
        (o.customerAddress || "").toLowerCase().includes(q);
      return matchSearch && matchesTab(o, activeTab);
    });
  }, [dateFilteredOrders, searchQuery, activeTab]);

  const ordersByDate = useMemo(() => {
    const groups = {};
    for (const order of filteredOrders) {
      const dStr = (order.isPreOrder && order.preOrderDate)
        ? `${order.preOrderDate}T12:00:00+05:30`
        : (order.createdAt || order.orderDate || order.deliveredAt);
      let key = "No date";
      if (dStr) {
        try {
          const d = new Date(dStr);
          if (!Number.isNaN(d.getTime())) {
            key = new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Kolkata",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(d);
          }
        } catch (_) {}
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    }
    const sortedKeys = Object.keys(groups).sort((a, b) => (b > a ? 1 : b < a ? -1 : 0));
    return sortedKeys.map((dateKey) => ({
      dateKey,
      orders: groups[dateKey],
    }));
  }, [filteredOrders]);

  const summaryCards = [
    { id: "all", label: "All orders", count: dateFilteredOrders.length, countClass: "text-slate-900", ring: "ring-slate-400" },
    { id: "attention", label: "Needs action", count: summary.attention, countClass: "text-rose-700", ring: "ring-rose-400" },
    { id: "incoming", label: "Incoming", count: summary.incoming, countClass: "text-blue-700", ring: "ring-blue-400" },
    { id: "ongoing", label: "Ongoing", count: summary.ongoing, countClass: "text-amber-700", ring: "ring-amber-400" },
    { id: "delivered", label: "Delivered", count: summary.delivered, countClass: "text-emerald-700", ring: "ring-emerald-400" },
    { id: "cancelled", label: "Cancelled", count: summary.cancelled || 0, countClass: "text-slate-600", ring: "ring-slate-400" },
  ].map((c) => ({ ...c, accent: "border-slate-200 bg-white" }));

  return (
    <PageShell
      title="Orders"
    >
      {toast && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 p-3 text-sm font-bold text-emerald-800 flex items-center gap-2 animate-fade-in">
          ⚡ {toast}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      {/* COD Cash Collection Warning for Dark Store Manager */}
      {pendingCodOrders.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-amber-950">
              Cash to collect · {formatRupee(totalPendingCodAmount)}
            </h3>
            <span className="badge border border-amber-300 bg-white text-amber-900">
              {pendingCodOrders.length} {pendingCodOrders.length === 1 ? "order" : "orders"}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pendingCodOrders.map((o) => {
              const oid = o.id || o._id;
              const driverName =
                o.collectFromDriver?.driverName || o.assignedRider?.name || "Delivery Partner";
              const amount = o.collectFromDriver?.amount || o.totalAmount || 0;
              return (
                <div
                  key={oid}
                  className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white p-3 shadow-xs"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      Collect <span className="text-amber-800 font-extrabold">{formatRupee(amount)}</span>
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">
                      From: <span className="font-semibold text-slate-800">{driverName}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">Order #{o.orderNumber}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busyKey === `confirm-cash-${oid}`}
                    onClick={() => onConfirmCashReceived(oid, o.orderNumber)}
                    className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 transition shadow-xs disabled:opacity-50"
                  >
                    {busyKey === `confirm-cash-${oid}` ? "Confirming…" : "✓ Received"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* Summary boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card) => {
          const selected = activeTab === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveTab(card.id)}
              className={`rounded-xl border p-4 text-left transition ${card.accent} ${
                selected ? `ring-2 ${card.ring}` : "hover:border-slate-300"
              }`}
            >
              <p className="stat-label">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${card.countClass}`}>{card.count}</p>
            </button>
          );
        })}
      </div>

      {(() => {
        const fromOrders = orders.filter(
          (o) =>
            o.routeBatchWindowEndsAt &&
            new Date(o.routeBatchWindowEndsAt).getTime() > nowTick &&
            !o.pickupQrScanned
        );
        const byId = new Map();
        for (const o of [...openWindowOrders, ...fromOrders]) {
          byId.set(String(o.id || o._id), o);
        }
        const windowOrders = [...byId.values()];
        if (!windowOrders.length) return null;
        return (
          <div className="rounded-xl border border-violet-300 bg-violet-50 p-4">
            <h3 className="text-sm font-bold text-violet-900">Same-route wait · pickup QR locked</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {windowOrders.map((o) => {
                const ends = o.routeBatchWindowEndsAt
                  ? new Date(o.routeBatchWindowEndsAt).getTime()
                  : 0;
                const msLeft = ends ? Math.max(0, ends - nowTick) : 0;
                const mins = Math.floor(msLeft / 60000);
                const secs = Math.floor((msLeft % 60000) / 1000);
                return (
                  <span
                    key={o.id || o._id}
                    className="inline-flex items-center gap-2 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-900"
                  >
                    #{o.orderNumber}
                    <span className="font-extrabold text-violet-700 tabular-nums text-sm">
                      {mins}:{String(secs).padStart(2, "0")}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      {routeSuggestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">Possible Same Route Orders</h3>
          {routeSuggestions.map((s) => {
            const key = `${s.orderA?.id}-${s.orderB?.id}`;
            const riderHint =
              onlineRiders.find(
                (r) => String(r.id || r._id) === String(s.recommendedRiderId || "")
              ) || onlineRiders[0];
            return (
              <div
                key={key}
                className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-2 sm:grid-cols-2 flex-1">
                    <div className="rounded-xl bg-white border border-violet-100 p-3">
                      <p className="text-[10px] font-bold uppercase text-violet-700">Order A</p>
                      <p className="font-extrabold text-slate-900">#{s.orderA?.orderNumber}</p>
                      <p className="text-xs text-slate-600">{s.orderA?.customerName}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{s.orderA?.customerAddress}</p>
                      <p className="mt-1 text-xs font-bold text-emerald-700">
                        {s.orderA?.distanceKm != null
                          ? `${Number(s.orderA.distanceKm).toFixed(1)} km`
                          : s.storeToAKm != null
                            ? `${s.storeToAKm} km`
                            : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-violet-100 p-3">
                      <p className="text-[10px] font-bold uppercase text-violet-700">Order B</p>
                      <p className="font-extrabold text-slate-900">#{s.orderB?.orderNumber}</p>
                      <p className="text-xs text-slate-600">{s.orderB?.customerName}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{s.orderB?.customerAddress}</p>
                      <p className="mt-1 text-xs font-bold text-emerald-700">
                        {s.orderB?.distanceKm != null
                          ? `${Number(s.orderB.distanceKm).toFixed(1)} km`
                          : s.storeToBKm != null
                            ? `${s.storeToBKm} km`
                            : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-2 min-w-[160px]">
                    <p className="text-xs font-bold text-violet-800">Route: Compatible</p>
                    <p className="text-[11px] text-slate-600">
                      Recommended: {riderHint?.name || riderHint?.phone || "Select rider"}
                    </p>
                    <button
                      type="button"
                      disabled={busyKey === `same-${s.orderA?.id}-${s.orderB?.id}`}
                      onClick={() => onAssignSameRoute(s)}
                      className={actionBtnPrimary}
                    >
                      Assign to Same Rider
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === `dispatch-${s.orderB?.id}`}
                      onClick={() => onDispatchNow(s.orderB?.id)}
                      className={actionBtnOutline}
                    >
                      Assign New Rider
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Online Riders Bar — updates on online/shift events; live map link from GPS socket */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="stat-label">Online riders</span>
        {onlineRiders.length === 0 ? (
          <span className="text-xs text-slate-400">No riders online</span>
        ) : (
          onlineRiders.map((r) => {
            const rid = String(r.id || r._id);
            const live = liveLocations[rid] || r.currentLocation;
            const pin =
              live?.lat != null && live?.lng != null
                ? mapsLink(live.lat, live.lng)
                : null;
            return (
              <span
                key={rid}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {r.name || r.phone}
                {pin ? (
                  <a
                    href={pin}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-[10px] font-bold text-sky-700 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    live map
                  </a>
                ) : null}
              </span>
            );
          })
        )}
        <span className="ml-auto text-xs text-slate-400">{onlineRiders.length} online</span>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, customer, phone…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600">✕</button>
            )}
          </div>

          {/* Just Calendar with Today's Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">📅 Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.id === "all"
                ? dateFilteredOrders.length
                : summary[tab.id] ?? dateFilteredOrders.filter((o) => matchesTab(o, tab.id)).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-slate-200/60 animate-pulse" />
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <h3 className="text-sm font-bold text-slate-800">No Orders Found</h3>
          <p className="mt-1 text-xs text-slate-400">
            {searchQuery ? "No orders match your search." : "No orders in this category right now."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 whitespace-nowrap">Order #</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Date & Time</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Customer Details</th>
                <th className="py-3 px-3.5">Delivery Address</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Assigned Driver</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => {
                      const oid = order.id || order._id;
                const isInitial = isInitialOrderStatus(order.status);
                const isPacked = order.status === "packed";
                const isPickup = isPickupOrder(order);
                const allAvailable = allItemsAvailable(order);

                return (
                  <tr key={oid} className="hover:bg-slate-50/70 transition">
                    {/* 1. Order # */}
                    <td className="py-3 px-3.5 font-mono text-slate-900 whitespace-nowrap align-top">
                      <button
                        type="button"
                        onClick={() => navigate(`/orders/${oid}`, { state: { order } })}
                        className="text-left font-bold text-slate-900 hover:text-emerald-700 hover:underline block text-xs"
                      >
                        #{order.orderNumber}
                      </button>
                      <div className="font-sans mt-1">
                        <OrderDepartmentTags order={order} hideSlot={true} />
                      </div>
                    </td>

                    {/* 2. Date & Time */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-top font-sans">
                      <div className="font-bold text-xs text-slate-800">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "Today"}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : "Just now"}
                      </div>
                      {order.isPreOrder && order.preOrderSlot ? (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          <span>🕒</span>
                          <span>Slot: {order.preOrderDate ? `${order.preOrderDate} ` : ""}{order.preOrderSlot}</span>
                        </div>
                      ) : null}
                    </td>

                    {/* 3. Customer Details */}
                    <td className="py-3 px-3.5 align-top">
                      <button
                        type="button"
                        onClick={() => navigate(`/orders/${oid}`, { state: { order } })}
                        className="text-left font-bold text-slate-900 hover:text-emerald-700 hover:underline block text-xs"
                      >
                        {order.customerName || "Customer"}
                      </button>
                      <div className="text-slate-500 text-[11px] mt-0.5">{order.customerPhone || "N/A"}</div>
                      {order.status === "delivered" && isCodPayment(order.paymentMethod) && order.collectFromDriver && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                          <span>⚠️</span> Collect {formatRupee(order.collectFromDriver.amount)} from driver
                        </div>
                      )}
                    </td>

                    {/* 4. Delivery Address */}
                    <td className="py-3 px-3.5 text-slate-700 max-w-xs align-top">
                      {isPickup ? (
                        <span className="inline-block rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 mb-1">
                          Store Pickup
                        </span>
                      ) : null}
                      <div className="truncate text-xs font-normal text-slate-700" title={order.customerAddress}>
                        {order.customerAddress || "Store Pickup"}
                      </div>
                      {!isPickup && order.distanceKm != null && (
                        <div className="mt-1 inline-block rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {Number(order.distanceKm).toFixed(1)} km from store
                        </div>
                      )}
                    </td>

                    {/* 5. Status */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-top">
                      <OrderStatusText status={order.status} order={order} />
                      {order.status === "delivery_failed" && order.failureKind === "rider_emergency" && (
                        <span className="mt-1 block text-xs font-semibold text-rose-700">Rider emergency</span>
                      )}
                    </td>

                    {/* 6. Assigned Driver */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-top">
                      <DriverAssignmentText order={order} onRiderClick={openTracking} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/orders/${oid}`, { state: { order } })}
                            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 transition shadow-xs"
                          >
                            View Detail
                          </button>
                          {order.collectFromDriver && (
                            <button
                              type="button"
                              disabled={busyKey === `confirm-cash-${oid}`}
                              onClick={() => onConfirmCashReceived(oid, order.orderNumber)}
                              className="rounded-xl border border-amber-400 bg-amber-100 px-3 py-1.5 text-[11px] font-extrabold text-amber-900 hover:bg-amber-200 transition disabled:opacity-50 shadow-xs"
                            >
                              {busyKey === `confirm-cash-${oid}`
                                ? "Confirming…"
                                : `✓ Received Cash (${formatRupee(order.collectFromDriver.amount)})`}
                            </button>
                          )}
                          {isInitial && (
                            <button
                              type="button"
                              disabled={!allAvailable || busyKey === `pack-${oid}`}
                              onClick={() => onPackOrder(oid)}
                              className={actionBtnPrimary}
                            >
                              {busyKey === `pack-${oid}` ? "Confirming…" : "Confirm & Pack"}
                            </button>
                          )}
                          {isPickup && isPacked && (
                            <button
                              type="button"
                              disabled={busyKey === `handover-${oid}`}
                              onClick={() => onHandOverPickup(oid, order.orderNumber)}
                              className={actionBtnPrimary}
                            >
                              {busyKey === `handover-${oid}` ? "Handing over…" : "Hand over (OTP)"}
                            </button>
                          )}
                          {order.status !== "delivered" && order.status !== "cancelled" && (
                            <button
                              type="button"
                              disabled={busyKey === `cancel-${oid}`}
                              onClick={() => onCancelOrder(oid, order.orderNumber)}
                              className="rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300 font-bold text-xs px-3 py-1.5 transition shadow-xs disabled:opacity-50"
                            >
                              {busyKey === `cancel-${oid}` ? "Cancelling…" : "Cancel"}
                            </button>
                          )}
                        </div>
                        {isInitial && !allAvailable && (
                          <p className="text-[10px] text-rose-600 font-semibold max-w-[220px] text-right">
                            Out of stock — request inventory first
                          </p>
                        )}
                        {order.routeBatchWindowEndsAt &&
                          new Date(order.routeBatchWindowEndsAt).getTime() > Date.now() && (
                          <span className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-800">
                            Same-route window open
                          </span>
                        )}
                        {order.status === "packed" &&
                          !isPickup &&
                          !order.isPreOrder &&
                          !order.assignedRiderId &&
                          !order.currentOfferDriverId && (
                          <button
                            type="button"
                            disabled={busyKey === `dispatch-${oid}`}
                            onClick={() => onDispatchNow(oid)}
                            className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                          >
                            {busyKey === `dispatch-${oid}` ? "Dispatching…" : "Assign New Rider now"}
                          </button>
                        )}
                        {(() => {
                          if (
                            order.status !== "assigned" ||
                            order.pickupQrScanned ||
                            order.pickupVerified
                          ) {
                            return null;
                          }
                          const windowEnds = order.routeBatchWindowEndsAt
                            ? new Date(order.routeBatchWindowEndsAt).getTime()
                            : 0;
                          const isWaiting =
                            windowEnds > nowTick && order.pickupQrUnlocked !== true;
                          if (isWaiting) {
                            const msLeft = Math.max(0, windowEnds - nowTick);
                            const mins = Math.floor(msLeft / 60000);
                            const secs = Math.floor((msLeft % 60000) / 1000);
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900 shadow-xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                QR locked · matching {mins}:{String(secs).padStart(2, "0")}
                              </span>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => openPickupQr(oid)}
                              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                            >
                              Show Pickup QR
                            </button>
                          );
                        })()}
                        {order.pickupProofStatus === "pending" && order.pickupProofImageUrl && (
                          <div className="flex flex-col items-end gap-2 max-w-[180px]">
                            <img
                              src={order.pickupProofImageUrl}
                              alt="Item proof"
                              className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                            />
                            <button
                              type="button"
                              disabled={busyKey === `approve-proof-${oid}`}
                              onClick={() => onApprovePickupProof(oid)}
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busyKey === `approve-proof-${oid}` ? "Approving…" : "✓ Approve Item Proof"}
                            </button>
                          </div>
                        )}
                        {(isInitial || isPacked) && !isPickup && (
                          <div className="flex items-center gap-1">
                            <select
                              value={selectedRider[oid] || ""}
                              onChange={(e) =>
                                setSelectedRider((prev) => ({ ...prev, [oid]: e.target.value }))
                              }
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-800 focus:outline-none"
                            >
                              <option value="">Rider…</option>
                              {onlineRiders.map((r) => (
                                <option key={r.id || r._id} value={r.id || r._id}>
                                  {r.name || r.phone}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!selectedRider[oid] || busyKey === `assign-${oid}`}
                              onClick={() => onManualAssign(oid)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                            >
                              Assign
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
        isOpen={Boolean(pickupQrOrderId)}
        onClose={closePickupQr}
        loading={pickupQrLoading}
        error={pickupQrError}
        orderNumber={pickupQrData?.orderNumber}
        driverName={pickupQrData?.driverName}
        pickupQrPayload={pickupQrData?.pickupQrPayload}
      />

      {trackingOrderId ? (
        <OrderTrackingDrawer orderId={trackingOrderId} onClose={closeTracking} />
      ) : null}
    </PageShell>
  );
}
