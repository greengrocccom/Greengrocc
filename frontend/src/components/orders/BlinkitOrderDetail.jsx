import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatAddressLine, getAddressFullName } from "../../utils/addressDisplay";
import { getDeliveryRating } from "../../utils/deliveryRatings";
import {
  formatOrderDateTime,
  formatOrderPrice,
  getBlinkitShipmentStatusLabel,
  getOrderBillAdjustments,
  getOrderDisplayCode,
  getPrimaryProductId,
  splitOrderShipments,
  formatPreOrderSlot,
} from "../../utils/orderUtils";
import Product3DImage from "./Product3DImage";
import OrderGiftHamperSection from "./OrderGiftHamperSection";
import ShipmentExtraDetails from "./ShipmentExtraDetails";
import ShipmentTrackingBanner from "./ShipmentTrackingBanner";
import DeliveryOtpBanner from "./DeliveryOtpBanner";
import TrackOrderBanner from "./TrackOrderBanner";
import ReturnOrderSection from "./ReturnOrderSection";
import PreOrderProgress from "./PreOrderProgress";
import PreOrderSlotCard from "./PreOrderSlotCard";

const ACTION_PINK = "#E23744";

function BlinkitOrderDetail({
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
  const shipments = useMemo(() => splitOrderShipments(order.items || []), [order.items]);
  const [shipmentIndex, setShipmentIndex] = useState(0);
  const shipmentItems = shipments[shipmentIndex] || [];
  const totalItems = (order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
  const orderCode = getOrderDisplayCode(order);
  const deliveryRating = getDeliveryRating(order._id);
  const productId = getPrimaryProductId(order);
  const addr = order.deliveryAddress;
  const deliveryFree = order.deliveryCharges === 0;
  const shipment = order.shipment || {};

  const handleOrderAgain = () => {
    if (productId && (order.items || []).length === 1) {
      navigate(`/product/${productId}`);
    }
  };

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderCode);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-8">
      <div className="border-b border-border-light px-3 pb-3 pt-3 sm:px-4">
        <div className="mx-auto flex max-w-3xl items-start gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/orders")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-light"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-extrabold text-text-primary">Order #{orderCode}</h1>
            <p className="text-xs text-text-secondary">{totalItems} item{totalItems === 1 ? "" : "s"}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border px-2.5 py-2 text-xs font-bold"
            style={{ borderColor: ACTION_PINK, color: ACTION_PINK }}
          >
            Get Help
          </button>
        </div>

        {shipments.length > 1 ? (
          <div className="mx-auto mt-3 flex max-w-3xl gap-2.5 px-1">
            {shipments.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setShipmentIndex(index)}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${
                  shipmentIndex === index
                    ? "bg-[#EEF0F4] text-text-primary"
                    : "text-text-secondary"
                }`}
              >
                Shipment {index + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-3xl px-4 py-4">
        {shipment.trackUrl ? (
          <div className="mb-4">
            <ShipmentTrackingBanner shipment={shipment} className="w-full" />
          </div>
        ) : null}

        <TrackOrderBanner order={order} className="mb-4" />

        <div className="mb-4">
          <DeliveryOtpBanner order={order} />
        </div>

        {order.status === "delivered" && deliveryRating ? (
          <div className="mb-4 rounded-[10px] border border-[#FFD6DC] bg-[#FFF0F2] px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">You rated:</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <svg
                    key={i}
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill={i < deliveryRating ? ACTION_PINK : "none"}
                    stroke={ACTION_PINK}
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-3">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white ${
              order.status === "delivered" ? "bg-[#2E7D32]" : "bg-[#2874F0]"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-text-muted">
              SHIPMENT {shipmentIndex + 1} &gt;
            </p>
            <p className="text-[26px] font-extrabold leading-tight text-text-primary">
              {getBlinkitShipmentStatusLabel(order.status)}
            </p>
          </div>
        </div>

        <h2 className="mt-5 text-base font-extrabold text-text-primary">
          {shipmentItems.length} item{shipmentItems.length === 1 ? "" : "s"} in shipment
        </h2>

        <div className="mt-3 space-y-4">
          {shipmentItems.map((item) => (
            <div key={item._id || item.name} className="flex items-start gap-3">
              <Product3DImage src={item.image || item.productImage} alt={item.name} size={56} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold text-text-primary">{item.name}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {item.quantity} item{item.quantity === 1 ? "" : "s"} · {item.quantity} unit
                  {item.quantity === 1 ? "" : "s"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-extrabold text-text-primary">
                {formatOrderPrice(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        {order.giftHamper ? (
          <div className="mt-6">
            <OrderGiftHamperSection giftHamper={order.giftHamper} />
          </div>
        ) : null}

        <div className="mt-6 rounded-xl bg-[#F8F8F8] p-4">
          <div className="flex items-center gap-2">
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <h3 className="text-base font-extrabold">Bill Summary</h3>
          </div>
          <div className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Item total</span>
              <span className="font-semibold text-text-primary">
                {formatOrderPrice(order.subtotal)}
              </span>
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
          <div className="my-3.5 border-t border-border-light" />
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-extrabold">Total Bill</span>
            <span className="text-lg font-extrabold">{formatOrderPrice(order.total, { withDecimals: false })}</span>
          </div>
        </div>

        <Link
          to={`/orders/${order._id}/invoice`}
          className="mt-4 block rounded-[10px] bg-[#F3EEFF] py-3.5 text-center text-sm font-bold text-[#5B4FCF]"
        >
          Download Invoice / Credit Note
        </Link>

        <div className="mt-6 space-y-4">
          <h3 className="text-base font-extrabold">Order Details</h3>
          <DetailField
            label="Order ID"
            value={orderCode}
            action={
              <button type="button" onClick={copyOrderId} className="text-text-secondary" aria-label="Copy order ID">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 011.927-.184" />
                </svg>
              </button>
            }
          />
          <DetailField
            label="Receiver details"
            value={[getAddressFullName(addr), addr?.number ? `+91 ${addr.number}` : ""].filter(Boolean).join(", ")}
          />
          <DetailField label="Delivery Address" value={formatAddressLine(addr)} />
          <DetailField label="Order placed at" value={formatOrderDateTime(order.createdAt)} />
          {order.preOrderSlot && (
            <DetailField label="Pre-order delivery" value={formatPreOrderSlot(order)} />
          )}
          <ShipmentExtraDetails shipment={shipment} />
          {order.status === "delivered"
            ? shipments.map((_, index) => (
                <DetailField
                  key={index}
                  label={`Shipment ${index + 1} arrived at`}
                  value={formatOrderDateTime(order.createdAt)}
                />
              ))
            : null}
        </div>

        <PreOrderSlotCard order={order} onChanged={onPreOrderChanged} className="mt-4" />

        <PreOrderProgress order={order} className="mt-4" />

        {order.status === "confirm" ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="w-full rounded-lg border border-red-200 py-3 text-sm font-semibold text-red-600 disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel order"}
            </button>
            {cancelError ? <p className="mt-2 text-xs text-red-600">{cancelError}</p> : null}
          </div>
        ) : null}

        <ReturnOrderSection
          order={order}
          onSubmit={onReturn}
          returning={returning}
          returnError={returnError}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border-light bg-white p-4 lg:static lg:mx-auto lg:mt-6 lg:max-w-3xl lg:border-0 lg:p-0">
        <button
          type="button"
          onClick={handleOrderAgain}
          className="w-full rounded-[10px] py-3.5 text-base font-extrabold text-white"
          style={{ backgroundColor: ACTION_PINK }}
        >
          Order Again
        </button>
      </div>
    </div>
  );
}

function DetailField({ label, value, action = null }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-text-primary">{value}</p>
        {action}
      </div>
    </div>
  );
}

export default BlinkitOrderDetail;
