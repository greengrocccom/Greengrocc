import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatAddressLine, getAddressFullName } from "../../utils/addressDisplay";
import { getDeliveryRating } from "../../utils/deliveryRatings";
import {
  formatOrderDateTime,
  formatOrderPrice,
  getMiniTrackerIndex,
  getOrderBillAdjustments,
  getOrderDisplayCode,
  getOrderPaymentLabel,
  getOrderStatusColor,
  getOrderStatusHeadline,
  getOrderStatusLabel,
  getPrimaryProductId,
  MINI_TRACKER_LABELS,
  showOrderPaymentBadge,
  splitOrderShipments,
  formatPreOrderSlot,
} from "../../utils/orderUtils";
import OrderItemImage from "./OrderItemImage";
import OrderGiftHamperSection from "./OrderGiftHamperSection";
import ShipmentExtraDetails from "./ShipmentExtraDetails";
import ShipmentTrackingBanner from "./ShipmentTrackingBanner";
import DeliveryOtpBanner from "./DeliveryOtpBanner";
import TrackOrderBanner from "./TrackOrderBanner";
import ReturnOrderSection from "./ReturnOrderSection";
import PreOrderProgress from "./PreOrderProgress";
import PreOrderSlotCard from "./PreOrderSlotCard";

function StatusBadge({ status }) {
  const color = getOrderStatusColor(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
      style={{ color, backgroundColor: `${color}18` }}
    >
      {getOrderStatusLabel(status)}
    </span>
  );
}

function MiniTracker({ activeIndex, isCancelled, isReturn }) {
  if (isCancelled) {
    return <p className="text-sm font-semibold text-red-600">This order was cancelled</p>;
  }
  if (isReturn) {
    return <p className="text-sm font-semibold text-amber-600">This order was returned</p>;
  }

  return (
    <div className="flex items-start">
      {MINI_TRACKER_LABELS.map((label, step) => {
        const done = step <= activeIndex;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {step > 0 ? (
                <div
                  className="h-0.5 flex-1"
                  style={{ backgroundColor: step <= activeIndex ? "#2874F0" : "#e5e5e5" }}
                />
              ) : (
                <div className="flex-1" />
              )}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                style={{
                  backgroundColor: done ? "#2874F0" : "#fff",
                  borderColor: done ? "#2874F0" : "#e5e5e5",
                  color: done ? "#fff" : "#999",
                }}
              >
                {done ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step + 1
                )}
              </div>
              {step < MINI_TRACKER_LABELS.length - 1 ? (
                <div
                  className="h-0.5 flex-1"
                  style={{ backgroundColor: step < activeIndex ? "#2874F0" : "#e5e5e5" }}
                />
              ) : (
                <div className="flex-1" />
              )}
            </div>
            <p
              className="mt-2 text-center text-[11px] font-semibold"
              style={{ color: done ? "#2874F0" : "#999" }}
            >
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value, action = null }) {
  return (
    <div className="border-b border-border-light py-3 last:border-0">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-text-primary">{value}</p>
        {action}
      </div>
    </div>
  );
}

function DesktopOrderDetail({
  order,
  onCancel,
  cancelling,
  cancelError,
  onReturn,
  returning,
  returnError,
  onPreOrderChanged,
}) {
  const navigate = useNavigate();
  const items = order.items || [];
  const shipments = useMemo(() => splitOrderShipments(items), [items]);
  const [shipmentIndex, setShipmentIndex] = useState(0);
  const shipmentItems = shipments[shipmentIndex] || [];
  const orderCode = getOrderDisplayCode(order);
  const productId = getPrimaryProductId(order);
  const deliveryRating = getDeliveryRating(order._id);
  const addr = order.deliveryAddress;
  const city = addr?.city?.trim() || "";
  const paymentMode = order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment";
  const deliveryFree = order.deliveryCharges === 0;
  const activeIndex = getMiniTrackerIndex(order.status);
  const isCancelled = order.status === "cancelled";
  const isReturn = order.status === "return";
  const statusColor = getOrderStatusColor(order.status);
  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const shipment = order.shipment || {};

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderCode);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] px-4 pb-8 pt-4 lg:px-6 lg:pt-6">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2874F0] hover:underline"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to My Orders
        </Link>

        {/* Header */}
        <div
          className="mt-4 overflow-hidden rounded-xl border border-border-light bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
          style={{
            background: `linear-gradient(90deg, ${statusColor}10, white 40%)`,
            borderLeft: `4px solid ${statusColor}`,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-text-primary">Order #{orderCode}</h1>
                <StatusBadge status={order.status} />
              </div>
              <p className="mt-1.5 text-sm text-text-secondary">
                Placed on {formatOrderDateTime(order.createdAt)}
                {city ? ` · Deliver to ${city}` : ""}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {items.length} product{items.length === 1 ? "" : "s"} · {totalQty} pcs · {paymentMode}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Order total</p>
              <p className="text-2xl font-extrabold text-text-primary">
                {formatOrderPrice(order.total, { withDecimals: false })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border-light bg-[#FAFAFA] px-6 py-3">
            <Link
              to={`/orders/${order._id}/invoice`}
              className="rounded-lg bg-[#2874F0] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
            >
              Download invoice
            </Link>
            {shipment.trackUrl ? <ShipmentTrackingBanner shipment={shipment} /> : null}
            {productId ? (
              <button
                type="button"
                onClick={() => navigate(`/product/${productId}`)}
                className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/10"
              >
                Order again
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-border-light bg-white px-5 py-2.5 text-sm font-bold text-text-primary transition hover:border-[#2874F0] hover:text-[#2874F0]"
            >
              Get help
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main column */}
          <div className="space-y-4">
            <TrackOrderBanner order={order} />

            {/* Progress */}
            <section className="rounded-xl border border-border-light bg-white p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Order progress</p>
              <p className="mt-2 text-lg font-extrabold text-text-primary">
                {getOrderStatusHeadline(order.status)}
              </p>
              <div className="mt-5">
                <MiniTracker activeIndex={activeIndex} isCancelled={isCancelled} isReturn={isReturn} />
              </div>
            </section>

            <DeliveryOtpBanner order={order} />

            {order.status === "delivered" && deliveryRating ? (
              <section className="rounded-xl border border-[#FFD6DC] bg-[#FFF0F2] px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">You rated this delivery:</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg
                        key={i}
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill={i < deliveryRating ? "#E23744" : "none"}
                        stroke="#E23744"
                        strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {/* Items */}
            <section className="overflow-hidden rounded-xl border border-border-light bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-light px-6 py-4">
                <h2 className="text-base font-extrabold text-text-primary">
                  Items in this order
                  {shipments.length > 1 ? ` · Shipment ${shipmentIndex + 1}` : ""}
                </h2>
                {shipments.length > 1 ? (
                  <div className="flex gap-2">
                    {shipments.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setShipmentIndex(index)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                          shipmentIndex === index
                            ? "bg-[#2874F0]/10 text-[#2874F0]"
                            : "text-text-secondary hover:bg-mobile-surface"
                        }`}
                      >
                        Shipment {index + 1}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="hidden border-b border-border-light bg-[#FAFAFA] px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_80px_100px]">
                <span>Product</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Price</span>
              </div>

              <div className="divide-y divide-border-light">
                {shipmentItems.map((item) => (
                  <div
                    key={item._id || item.name}
                    className="grid gap-3 px-6 py-4 sm:grid-cols-[minmax(0,1fr)_80px_100px] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-white to-[#F2F2F2] p-1.5">
                        <OrderItemImage
                          image={item.image}
                          fallbackImage={item.productImage}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-bold text-text-primary">{item.name}</p>
                        {item.brandName ? (
                          <p className="mt-0.5 text-xs text-text-muted">{item.brandName}</p>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-text-secondary sm:text-center">
                      {item.quantity} pcs
                    </p>
                    <p className="text-sm font-extrabold text-text-primary sm:text-right">
                      {formatOrderPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {order.giftHamper ? (
              <OrderGiftHamperSection giftHamper={order.giftHamper} />
            ) : null}
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
              <h3 className="text-base font-extrabold text-text-primary">Bill summary</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <span>Item total</span>
                  <span className="font-semibold text-text-primary">{formatOrderPrice(order.subtotal)}</span>
                </div>
                {order.couponDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>Coupon discount ({order.couponCode || "Applied"})</span>
                    <span className="font-bold">-{formatOrderPrice(order.couponDiscount)}</span>
                  </div>
                ) : null}
                {order.rewardDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>Reward points discount ({order.rewardPointsUsed} pts)</span>
                    <span className="font-bold">-{formatOrderPrice(order.rewardDiscount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-text-secondary">
                  <span>Delivery fee</span>
                  <div className="flex items-center gap-2">
                    {deliveryFree ? (
                      <span className="text-xs text-text-muted line-through">₹30</span>
                    ) : null}
                    <span className={`font-bold ${deliveryFree ? "text-[#2E7D32]" : "text-text-primary"}`}>
                      {deliveryFree ? "FREE" : formatOrderPrice(order.deliveryCharges)}
                    </span>
                  </div>
                </div>
                {getOrderBillAdjustments(order).map((line) => (
                  <div
                    key={line.label}
                    className={`flex justify-between ${line.amount < 0 ? "text-emerald-700" : "text-text-secondary"}`}
                  >
                    <span>{line.label}</span>
                    <span className={`font-bold ${line.amount < 0 ? "" : "text-text-primary"}`}>
                      {line.amount < 0 ? "-" : ""}
                      {formatOrderPrice(Math.abs(line.amount))}
                    </span>
                  </div>
                ))}
                {order.rewardPointsEarned > 0 ? (
                  <div className="flex justify-between text-amber-800 bg-amber-50/80 p-2 rounded-lg text-xs font-semibold">
                    <span>Points earned on this order</span>
                    <span className="font-bold">+{order.rewardPointsEarned} pts</span>
                  </div>
                ) : null}
              </div>
              <div className="my-4 border-t border-border-light" />
              <div className="flex items-center justify-between">
                <span className="text-base font-extrabold text-text-primary">Total</span>
                <span className="text-lg font-extrabold text-text-primary">
                  {formatOrderPrice(order.total, { withDecimals: false })}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-md bg-mobile-surface px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  {paymentMode}
                </span>
                {showOrderPaymentBadge(order) ? (
                  <span className="rounded-md bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                    {getOrderPaymentLabel(order)}
                  </span>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
              <h3 className="text-base font-extrabold text-text-primary">Delivery details</h3>
              <div className="mt-3">
                <DetailRow
                  label="Receiver"
                  value={[getAddressFullName(addr), addr?.number ? `+91 ${addr.number}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                />
                <DetailRow label="Address" value={formatAddressLine(addr)} />
              </div>
            </section>

            <section className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
              <h3 className="text-base font-extrabold text-text-primary">Order info</h3>
              <div className="mt-3">
                <DetailRow
                  label="Order ID"
                  value={orderCode}
                  action={
                    <button
                      type="button"
                      onClick={copyOrderId}
                      className="shrink-0 text-text-secondary hover:text-[#2874F0]"
                      aria-label="Copy order ID"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 011.927-.184" />
                      </svg>
                    </button>
                  }
                />
                <DetailRow label="Order placed" value={formatOrderDateTime(order.createdAt)} />
                {order.preOrderSlot && (
                  <DetailRow label="Pre-order delivery" value={formatPreOrderSlot(order)} />
                )}
                <ShipmentExtraDetails shipment={shipment} />
              </div>
            </section>

            <PreOrderSlotCard order={order} onChanged={onPreOrderChanged} />

            <PreOrderProgress order={order} className="shadow-sm" />

            {order.status === "confirm" ? (
              <section className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={cancelling}
                  className="w-full rounded-lg border border-red-200 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {cancelling ? "Cancelling..." : "Cancel order"}
                </button>
                {cancelError ? <p className="mt-2 text-xs text-red-600">{cancelError}</p> : null}
              </section>
            ) : null}

            <ReturnOrderSection
              order={order}
              onSubmit={onReturn}
              returning={returning}
              returnError={returnError}
              variant="desktop"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DesktopOrderDetail;
