import { QRCodeSVG } from "qrcode.react";

export default function PickupQrModal({
  isOpen,
  onClose,
  loading,
  error,
  orderNumber,
  driverName,
  pickupQrPayload,
  isPreOrder = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Pickup QR Code</h3>
            <p className="mt-1 text-xs text-slate-500">
              Order {orderNumber || "—"}
              {driverName ? ` · ${driverName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center">
          {loading ? (
            <div className="flex h-52 w-52 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
              Loading QR…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : pickupQrPayload ? (
            <>
              <div className="rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-sm">
                <QRCodeSVG value={pickupQrPayload} size={180} level="M" includeMargin />
              </div>
              <p className="mt-4 text-center text-xs leading-relaxed text-slate-600">
                {isPreOrder ? (
                  <>
                    Ask the delivery partner to scan this QR in <strong>Pre-order deliveries</strong>. The customer's
                    address unlocks for this order straight away.
                  </>
                ) : (
                  <>
                    Ask the delivery partner to tap <strong>Scan Pickup QR</strong>, then capture an{" "}
                    <strong>item proof photo</strong>. You must approve the photo to unlock the customer address.
                  </>
                )}
              </p>
            </>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
