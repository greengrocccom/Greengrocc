import { useRef, useState } from 'react';
import {
  Bike,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Receipt,
  RotateCcw,
  Sprout,
  Store,
  Truck,
  User,
  X,
} from 'lucide-react';
import TaxInvoiceDocument from '@shared/invoice/TaxInvoiceDocument.jsx';
import { downloadInvoiceFromElement } from '@shared/invoice/downloadInvoiceFromElement.js';
import { getInvoiceFilename } from '@shared/invoice/invoiceHelpers.js';
import { BTN_PRIMARY, PANEL, PANEL_HEAD, TD, TH } from '../../utils/ui';

const ORDER_STATUS = {
  attempted: 'Payment attempted',
  confirm: 'Confirmed',
  processing: 'Processing',
  shipping: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return: 'Returned',
};

const PAYMENT_STATUS = {
  unpaid: 'Unpaid',
  paid_10: '10% advance paid',
  paid: 'Paid',
  refundable: 'Refund due',
  pending_verification: 'Pending verification',
};

const STORE_STATUS = {
  preorder_hold: 'Pre-order on hold',
  incoming: 'Incoming',
  order_received: 'Order received',
  stock_issue: 'Stock issue',
  packed: 'Packed',
  offered: 'Offered to rider',
  assigned: 'Rider assigned',
  pickup_verified: 'Picked up',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  delivery_failed: 'Delivery failed',
  cancelled: 'Cancelled',
};

const EVIDENCE = {
  farmer_request: { label: 'Requested for this order', tone: 'bg-emerald-100 text-emerald-800' },
  vendor_supply: { label: 'Vendor farmer supply (30 days)', tone: 'bg-sky-100 text-sky-800' },
  store_batch: { label: 'Dark store stock batch', tone: 'bg-amber-100 text-amber-800' },
  catalog_profile: { label: 'Catalog farmer profile', tone: 'bg-slate-100 text-slate-700' },
};

function when(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function money(value) {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function joinParts(...parts) {
  return parts.filter(Boolean).join(', ');
}

function Badge({ children, tone = 'bg-slate-100 text-slate-700' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
      {children}
    </span>
  );
}

function Field({ label, children, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
      <dd className={`mt-0.5 break-words text-xs font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>
        {children === undefined || children === null || children === '' ? '—' : children}
      </dd>
    </div>
  );
}

function PhoneLink({ phone }) {
  if (!phone) return '—';
  return (
    <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
      <Phone className="h-3 w-3" />
      {phone}
    </a>
  );
}

function Section({ icon: Icon, title, aside, children }) {
  return (
    <section className={`${PANEL} overflow-hidden rounded-xl`}>
      <div className={`${PANEL_HEAD} flex flex-wrap items-center justify-between gap-2`}>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-emerald-700" />
          {title}
        </span>
        {aside}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">{children}</p>;
}

function PersonCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-emerald-700" />
        {title}
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">{children}</dl>
    </div>
  );
}

function FarmerDetails({ farmer, fieldManager }) {
  const addr = farmer.address || {};
  return (
    <>
      <Field label="Farmer name">{farmer.name}</Field>
      <Field label="Farmer ID" mono>{farmer.farmerId || farmer.farmerCode || farmer.id}</Field>
      <Field label="Mobile"><PhoneLink phone={farmer.mobile} /></Field>
      <Field label="Status">{[farmer.status, farmer.kycStatus && `KYC ${farmer.kycStatus}`].filter(Boolean).join(' · ')}</Field>
      <Field label="Farm">{joinParts(farmer.farmName, farmer.farmArea, farmer.farmType)}</Field>
      <Field label="Village / district">{joinParts(addr.village, addr.taluka, addr.district, addr.state, addr.pincode) || farmer.farmLocation}</Field>
      {fieldManager ? (
        <>
          <Field label="Field manager">{fieldManager.name}</Field>
          <Field label="Field manager phone"><PhoneLink phone={fieldManager.mobile} /></Field>
        </>
      ) : null}
    </>
  );
}

function SourcingCard({ src }) {
  const ev = EVIDENCE[src.source];
  const fo = src.farmerOrder;
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={ev.tone}>{ev.label}</Badge>
        {fo ? <span className="font-mono text-[11px] text-slate-500">Farmer order {fo.orderId || fo.id}</span> : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        {src.farmer ? (
          <FarmerDetails farmer={src.farmer} fieldManager={src.fieldManager} />
        ) : (
          <Field label="Farmer ID" mono>{fo?.farmerId || src.batch?.supplierName}</Field>
        )}
        {fo ? (
          <>
            <Field label="Produce">{joinParts(fo.productName, fo.variety, fo.grade)}</Field>
            <Field label="Quantity / value">{`${fo.totalQuantity || fo.orderedQuantity || 0} ${fo.unit || ''} · ${money(fo.totalAmount || fo.orderValue)}`}</Field>
            <Field label="Harvest / pickup date">{joinParts(fo.harvestDate, fo.pickupDate) || when(fo.createdAt)}</Field>
            <Field label="Farmer order status">{joinParts(fo.status, fo.deliveryStatus)}</Field>
          </>
        ) : null}
        {src.vendor ? <Field label="Vendor / collection centre">{src.vendor.vendorName || src.vendor.businessName || src.vendor.ownerName}</Field> : null}
        {src.pickup ? (
          <>
            <Field label="Farm pickup">{`${src.pickup.pickupId} · ${src.pickup.status}`}</Field>
            <Field label="Pickup driver">{joinParts(src.pickup.driverName, src.pickup.driverMobile, src.pickup.vehicleNumber)}</Field>
          </>
        ) : null}
        {src.quality ? (
          <>
            <Field label="Quality check">{joinParts(src.quality.status, src.quality.qualityParameters?.overallQuality)}</Field>
            <Field label="Grade A / B / C">{`${src.quality.gradeAQuantity || 0} / ${src.quality.gradeBQuantity || 0} / ${src.quality.gradeCQuantity || 0}`}</Field>
            <Field label="Inspector">{src.quality.inspectorName}</Field>
          </>
        ) : null}
        {src.batch ? (
          <>
            <Field label="Batch" mono>{src.batch.batchId || src.batch.batchNumber}</Field>
            <Field label="Received">{when(src.batch.receivedDate || src.batch.createdAt)}</Field>
            <Field label="Grade / source">{joinParts(src.batch.qualityGrade, src.batch.stockSource, src.batch.supplierName)}</Field>
            <Field label="Mfg / expiry">{`${when(src.batch.mfgDate)} → ${when(src.batch.expiryDate)}`}</Field>
          </>
        ) : null}
      </dl>
    </div>
  );
}

function CatalogFarmerCard({ farmer }) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-3">
      <div className="flex items-center gap-3">
        {farmer.image ? <img src={farmer.image} alt={farmer.name} className="h-12 w-12 rounded-full object-cover" /> : null}
        <div>
          <Badge tone={EVIDENCE.catalog_profile.tone}>{EVIDENCE.catalog_profile.label}</Badge>
          <p className="mt-1 text-sm font-bold text-slate-900">{farmer.name}</p>
          <p className="text-xs text-slate-500">{farmer.location}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        <Field label="Harvesting date">{farmer.harvestingDate}</Field>
        <Field label="Packing date">{farmer.packingDate}</Field>
        <Field label="Certification">{farmer.certification}</Field>
        <Field label="Farming method">{farmer.agricultureMethod}</Field>
        <Field label="Farm area">{joinParts(farmer.totalArea, farmer.cultivationArea && `${farmer.cultivationArea} cultivated`)}</Field>
        <Field label="Soil / water">{joinParts(farmer.soilType, farmer.waterSource)}</Field>
      </dl>
      <p className="text-[11px] text-slate-400">
        Declared on the product listing; no farmer supply record is linked to this order yet.
      </p>
    </div>
  );
}

function DeliveryCard({ delivery }) {
  const store = delivery.darkStore;
  const rider = delivery.rider;
  const vendor = delivery.vendor;
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-900">{delivery.orderNumber}</span>
          {delivery.sourcePart ? <Badge>{delivery.sourcePart === 'preorder' ? 'Pre-order part' : 'Instant part'}</Badge> : null}
          <Badge tone={delivery.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : delivery.status === 'delivery_failed' || delivery.status === 'cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}>
            {STORE_STATUS[delivery.status] || delivery.status}
          </Badge>
        </div>
        <span className="text-[11px] text-slate-500">{delivery.fulfillmentType === 'pickup' ? 'Customer pickup' : 'Home delivery'}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <PersonCard title="Dark store & delivery manager" icon={Store}>
          <Field label="Dark store">{store?.storeName}</Field>
          <Field label="Delivery manager">{store?.name}</Field>
          <Field label="Manager phone"><PhoneLink phone={store?.phone} /></Field>
          <Field label="Manager email">{store?.email}</Field>
          <div className="col-span-2">
            <Field label="Store address">{joinParts(store?.storeAddress, store?.area, store?.city, store?.state, store?.pincode)}</Field>
          </div>
        </PersonCard>

        <PersonCard title="Delivery partner (rider)" icon={Bike}>
          {rider ? (
            <>
              <Field label="Rider name">{rider.name}</Field>
              <Field label="Rider phone"><PhoneLink phone={rider.phone} /></Field>
              <Field label="Vehicle">{joinParts(rider.vehicleType, rider.vehicleNumber)}</Field>
              <Field label="Type / rating">{joinParts(rider.employmentType?.replace('_', ' '), rider.rating != null && `${rider.rating}★`)}</Field>
              <Field label="Rider area">{joinParts(rider.area, rider.city)}</Field>
              <Field label="Rider status">{rider.status}</Field>
            </>
          ) : (
            <div className="col-span-2 text-xs text-slate-500">
              {delivery.fulfillmentType === 'pickup' ? 'Collected by the customer at the store.' : 'No rider assigned yet.'}
            </div>
          )}
        </PersonCard>

        <PersonCard title="Supplying vendor" icon={Building2}>
          {vendor ? (
            <>
              <Field label="Vendor">{vendor.vendorName || vendor.businessName}</Field>
              <Field label="Owner">{vendor.ownerName}</Field>
              <Field label="Phone"><PhoneLink phone={vendor.mobile || vendor.phone} /></Field>
              <Field label="Type">{vendor.vendorType}</Field>
              <div className="col-span-2">
                <Field label="Address">{joinParts(vendor.businessAddress, vendor.city, vendor.state)}</Field>
              </div>
            </>
          ) : (
            <div className="col-span-2 text-xs text-slate-500">No vendor linked to this dark store.</div>
          )}
        </PersonCard>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
        <Field label="Received at store">{when(delivery.createdAt)}</Field>
        <Field label="Packed">{when(delivery.packedAt)}</Field>
        <Field label="Rider assigned">{when(delivery.assignedAt)}</Field>
        <Field label="Picked up">{when(delivery.pickupVerifiedAt || delivery.pickupQrScannedAt)}</Field>
        <Field label="Delivered">{when(delivery.deliveredAt)}</Field>
        <Field label="Customer OTP">{delivery.customerOtpVerified ? `Verified ${when(delivery.customerOtpVerifiedAt)}` : 'Not verified'}</Field>
        <Field label="Distance">{delivery.deliveryDistanceKm || delivery.distanceKm ? `${delivery.deliveryDistanceKm || delivery.distanceKm} km` : '—'}</Field>
        <Field label="Rider earning">{delivery.riderDeliveryEarning ? money(delivery.riderDeliveryEarning) : '—'}</Field>
        <Field label="Payment at door">{joinParts(delivery.paymentMethod, delivery.paymentStatus)}</Field>
        <Field label="To collect / collected">{`${money(delivery.amountToCollect)} / ${money(delivery.amountCollected)}`}</Field>
        <Field label="Routing">{delivery.routingReason}</Field>
        <Field label="Attempts">{delivery.deliveryAttempts || 0}</Field>
        {delivery.isPreOrder ? (
          <>
            <Field label="Pre-order slot">{joinParts(delivery.preOrderDate, delivery.preOrderSlot)}</Field>
            <Field label="Pre-order stage">{joinParts(delivery.vendorStatus && `vendor ${delivery.vendorStatus}`, delivery.preOrderStage)}</Field>
          </>
        ) : null}
        {delivery.failureReason ? (
          <div className="col-span-2">
            <Field label="Failure reason">{`${delivery.failureReason}${delivery.failedByRider ? ` (by ${delivery.failedByRider.name})` : ''}`}</Field>
          </div>
        ) : null}
        {delivery.deliveryComment ? (
          <div className="col-span-2">
            <Field label="Rider note">{delivery.deliveryComment}</Field>
          </div>
        ) : null}
      </dl>

      {delivery.pickupProofImageUrl || delivery.deliveryProofImageUrl ? (
        <div className="flex flex-wrap gap-3">
          {[
            ['Pickup proof', delivery.pickupProofImageUrl],
            ['Delivery proof', delivery.deliveryProofImageUrl],
          ]
            .filter(([, url]) => url)
            .map(([label, url]) => (
              <a key={label} href={url} target="_blank" rel="noreferrer" className="text-center text-[11px] font-semibold text-emerald-700">
                <img src={url} alt={label} className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                {label}
              </a>
            ))}
        </div>
      ) : null}

      {delivery.removedItems?.length ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Removed (store could not supply): {delivery.removedItems.map((r) => `${r.name} × ${r.quantity}`).join(', ')}
          {delivery.refundDue ? ` · refund due ${money(delivery.refundDue)} (${delivery.refundStatus || 'pending'})` : ''}
        </p>
      ) : null}
    </div>
  );
}

function InvoiceModal({ trace, onClose }) {
  const ref = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setDownloading(true);
    setError('');
    try {
      await downloadInvoiceFromElement(ref.current, getInvoiceFilename(trace.invoiceOrder), {
        order: trace.invoiceOrder,
        customer: trace.invoiceCustomer,
      });
    } catch {
      setError('Could not generate the invoice PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4">
      <div className="relative my-6 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Receipt className="h-4 w-4 text-emerald-700" />
            Invoice · Order #{trace.order.orderNumber}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={download} disabled={downloading} className={`${BTN_PRIMARY} text-xs`}>
              {downloading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
              Download PDF
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close invoice">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {error ? <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
        <div className="p-4">
          <TaxInvoiceDocument ref={ref} order={trace.invoiceOrder} customer={trace.invoiceCustomer} showAction={false} />
        </div>
      </div>
    </div>
  );
}

export default function OrderTraceView({ trace }) {
  const [showInvoice, setShowInvoice] = useState(false);
  const { order, customer, payment, pricing, items, deliveries, feedback, returns, timeline } = trace;
  const addr = customer.deliveryAddress || {};
  const discounts = [
    ['Coupon', pricing.couponDiscount, pricing.couponCode],
    ['Reward points', pricing.rewardDiscount, pricing.rewardPointsUsed ? `${pricing.rewardPointsUsed} pts` : ''],
    ['Gift card', pricing.giftCardDiscount, pricing.giftCardCode],
    ['Offer discount', pricing.dynamicDiscount],
    ['Bundle discount', pricing.bundleDiscount],
    ['Loyalty discount', pricing.loyaltyDiscount],
  ].filter(([, amount]) => Number(amount) > 0);
  const fees = [
    ['Delivery charges', pricing.deliveryCharges],
    ['Packaging fee', pricing.packagingFee],
    ['Heavy item handling', pricing.heavyHandlingFee],
  ];

  return (
    <div className="space-y-5">
      {/* Order header */}
      <section className={`${PANEL} rounded-xl p-5`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Order #{order.orderNumber}</h2>
              <Badge tone={order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : order.status === 'cancelled' || order.status === 'return' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}>
                {ORDER_STATUS[order.status] || order.status}
              </Badge>
              <Badge tone={payment.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>
                {PAYMENT_STATUS[payment.status] || payment.status}
              </Badge>
              {order.orderType ? <Badge>{order.orderType.replace(/_/g, ' ')}</Badge> : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Placed {when(order.createdAt)} · {order.fulfillmentType === 'pickup' ? 'Store pickup' : 'Home delivery'}
              {order.preOrderSlot ? ` · Pre-order slot ${joinParts(order.preOrderDate, order.preOrderSlot)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] text-slate-400">Order total</p>
              <p className="text-xl font-extrabold text-slate-900">{money(pricing.total)}</p>
            </div>
            <button type="button" onClick={() => setShowInvoice(true)} className={`${BTN_PRIMARY} text-xs`}>
              <FileText className="mr-1.5 h-4 w-4" />
              View / Download Invoice
            </button>
          </div>
        </div>
        {order.message ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Customer note: {order.message}
          </p>
        ) : null}
        {order.routingError ? (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">Routing issue: {order.routingError}</p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Customer */}
        <Section icon={User} title="Customer details" aside={<span className="text-[11px] text-slate-500">{customer.totalOrders} order(s) placed</span>}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Field label="Name">{customer.name}</Field>
            <Field label="Phone"><PhoneLink phone={customer.phone} /></Field>
            <Field label="Email">{customer.email}</Field>
            <Field label="Account name">{customer.account?.name}</Field>
            <Field label="Account phone">{customer.account?.phone}</Field>
            <Field label="Customer since">{when(customer.account?.createdAt)}</Field>
            <Field label="Reward points">{customer.account?.rewardPoints ?? '—'}</Field>
            <Field label="Account status">{customer.account ? (customer.account.isBlocked ? 'Blocked' : customer.account.status || 'Active') : 'Not found'}</Field>
            <Field label="Address type">{addr.addressType}</Field>
            <div className="col-span-2 sm:col-span-3">
              <Field label="Delivery address">
                <span className="inline-flex items-start gap-1">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {customer.address}
                  {addr.location?.lat && addr.location?.lng ? (
                    <a
                      href={`https://www.google.com/maps?q=${addr.location.lat},${addr.location.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 text-emerald-700 hover:underline"
                    >
                      (map)
                    </a>
                  ) : null}
                </span>
              </Field>
            </div>
          </dl>
        </Section>

        {/* Payment */}
        <Section icon={CreditCard} title="Payment details">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Field label="Method">{payment.method === 'cod' ? 'Cash on delivery' : 'Online (Razorpay)'}</Field>
            <Field label="Status">{PAYMENT_STATUS[payment.status] || payment.status}</Field>
            <Field label="Paid at">{when(payment.paidAt)}</Field>
            <Field label="Razorpay order" mono>{payment.razorpayOrderId}</Field>
            <Field label="Razorpay payment" mono>{payment.razorpayPaymentId}</Field>
            <Field label="Paid online">{payment.razorpayPaidAmount ? money(payment.razorpayPaidAmount) : '—'}</Field>
            {payment.codAdvanceAmount ? (
              <>
                <Field label="COD advance">{money(payment.codAdvanceAmount)}</Field>
                <Field label="Advance paid at">{when(payment.codAdvancePaidAt)}</Field>
              </>
            ) : null}
          </dl>
          {payment.records.length ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50">
                  <tr>{['Recorded', 'Source', 'Type', 'Amount', 'Status', 'Reference'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payment.records.map((p) => (
                    <tr key={p._id}>
                      <td className={TD}>{when(p.createdAt)}</td>
                      <td className={TD}>{p.source || p.paymentMethod}</td>
                      <td className={TD}>{p.paymentType}</td>
                      <td className={TD}>{money(p.amount)}</td>
                      <td className={TD}>{p.status}</td>
                      <td className={`${TD} font-mono`}>{p.razorpayPaymentId || p.upiTransactionRef || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {payment.refunds.length ? (
            <div className="mt-3 space-y-1">
              {payment.refunds.map((r) => (
                <p key={r._id} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Refund {money(r.amount)} · {r.status} · {r.reason || 'Items not supplied'} · {when(r.refundedAt || r.createdAt)}
                </p>
              ))}
            </div>
          ) : null}
        </Section>
      </div>

      {/* Items & pricing */}
      <Section icon={Package} title={`Order items (${items.length})`}>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50">
              <tr>{['Product', 'SKU / ID', 'Variant', 'Qty', 'Rate', 'Amount'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((line) => (
                <tr key={line.itemId}>
                  <td className={TD}>
                    <div className="flex items-center gap-2">
                      {line.image ? <img src={line.image} alt="" className="h-9 w-9 rounded border border-slate-100 object-contain" /> : null}
                      <span className="font-semibold text-slate-900">{line.name}</span>
                    </div>
                  </td>
                  <td className={`${TD} font-mono text-[11px]`}>{joinParts(line.sku, line.departmentId) || '—'}</td>
                  <td className={TD}>{line.variantName || '—'}</td>
                  <td className={TD}>{line.quantity}</td>
                  <td className={TD}>{money(line.price)}</td>
                  <td className={`${TD} font-semibold`}>{money(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-3 max-w-sm space-y-1.5 text-xs">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="font-semibold">{money(pricing.subtotal)}</dd></div>
          {discounts.map(([label, amount, note]) => (
            <div key={label} className="flex justify-between text-emerald-700">
              <dt>{label}{note ? ` (${note})` : ''}</dt>
              <dd>-{money(amount)}</dd>
            </div>
          ))}
          {fees.map(([label, amount]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-slate-500">{label}</dt>
              <dd>{Number(amount) > 0 ? money(amount) : 'Free'}</dd>
            </div>
          ))}
          {Number(pricing.gstAmount) > 0 ? (
            <div className="flex justify-between"><dt className="text-slate-500">GST</dt><dd>{money(pricing.gstAmount)}</dd></div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold">
            <dt>Total</dt>
            <dd>{money(pricing.total)}</dd>
          </div>
          {pricing.rewardPointsEarned ? (
            <p className="text-right text-[11px] text-slate-500">{pricing.rewardPointsEarned} reward points earned</p>
          ) : null}
        </dl>
      </Section>

      {/* Farmer sourcing */}
      <Section icon={Sprout} title="Farmer & source of each product">
        <div className="space-y-4">
          {items.map((line) => {
            const sources = [...line.farmerRequests, ...line.vendorSupply, ...line.vendorBatches, ...line.storeBatches];
            return (
              <div key={line.itemId} className="space-y-2">
                <p className="text-xs font-bold text-slate-900">
                  {line.name} <span className="font-normal text-slate-500">× {line.quantity}</span>
                </p>
                {sources.map((src, idx) => (
                  <SourcingCard key={`${src.source}-${idx}`} src={src} />
                ))}
                {line.catalogFarmer ? <CatalogFarmerCard farmer={line.catalogFarmer} /> : null}
                {!sources.length && !line.catalogFarmer ? (
                  <Empty>No farmer supply or farmer profile is recorded for this product yet.</Empty>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Delivery */}
      <Section icon={Truck} title="Delivery details">
        {deliveries.length ? (
          <div className="space-y-4">
            {deliveries.map((d) => <DeliveryCard key={d._id} delivery={d} />)}
          </div>
        ) : (
          <Empty>This order has not been routed to a dark store yet.</Empty>
        )}
        {trace.shipment?.trackingNumber ? (
          <p className="mt-3 text-xs text-slate-600">
            Courier: {joinParts(trace.shipment.carrier, trace.shipment.service)} · Tracking {trace.shipment.trackingNumber} · {trace.shipment.status}
          </p>
        ) : null}
      </Section>

      {/* Feedback & returns */}
      {feedback.length || returns.length ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Section icon={MessageSquare} title="Customer feedback">
            {feedback.filter((f) => !f.skipped).length ? (
              <div className="space-y-2">
                {feedback.filter((f) => !f.skipped).map((f) => (
                  <div key={f._id} className="rounded-lg border border-slate-200 p-3 text-xs">
                    <p className="font-semibold text-slate-900">
                      Rider rating: {f.riderRating ? `${f.riderRating}★` : '—'} {f.riderTags?.length ? `· ${f.riderTags.join(', ')}` : ''}
                    </p>
                    {f.riderComment ? <p className="mt-1 text-slate-600">{f.riderComment}</p> : null}
                    {f.products?.map((p) => (
                      <p key={String(p.product)} className="mt-1 text-slate-600">{p.name}: {p.rating}★ {p.comment}</p>
                    ))}
                    <p className="mt-1 text-[11px] text-slate-400">{when(f.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No feedback submitted.</Empty>
            )}
          </Section>
          <Section icon={RotateCcw} title="Returns & refund pickups">
            {returns.length ? (
              <div className="space-y-2">
                {returns.map((r) => (
                  <dl key={r.id || r._id} className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-slate-200 p-3">
                    <Field label="Type / status">{joinParts(r.type, r.status)}</Field>
                    <Field label="Amount">{money(r.amount)}</Field>
                    <Field label="Reason">{r.reason}</Field>
                    <Field label="Pickup rider">{r.rider ? `${r.rider.name} (${r.rider.phone})` : '—'}</Field>
                    <Field label="Picked up">{when(r.pickedUpAt)}</Field>
                    <Field label="Completed">{when(r.successfulAt)}</Field>
                  </dl>
                ))}
              </div>
            ) : (
              <Empty>No returns.</Empty>
            )}
          </Section>
        </div>
      ) : null}

      {/* Timeline */}
      <Section icon={Clock} title="Order timeline">
        {timeline.length ? (
          <ol className="relative ml-2 space-y-3 border-l border-emerald-200">
            {timeline.map((ev, idx) => (
              <li key={`${ev.title}-${idx}`} className="ml-5">
                <span className="absolute -left-[7px] mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 ring-4 ring-white">
                  <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">{ev.title}</p>
                  <span className="text-[11px] text-slate-400">{when(ev.at)}</span>
                </div>
                {ev.detail ? <p className="text-[11px] text-slate-600">{ev.detail}</p> : null}
                {ev.actor ? <p className="text-[11px] text-slate-400">By {ev.actor}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <Empty>No events recorded.</Empty>
        )}
      </Section>

      {showInvoice ? <InvoiceModal trace={trace} onClose={() => setShowInvoice(false)} /> : null}
    </div>
  );
}
