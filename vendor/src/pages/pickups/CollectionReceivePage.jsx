import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { vendorApi } from "../../api/vendorApi";
import { pickupLiveLabel } from "../../components/pickup/PickupTimeline";
import ConfirmPickupPhotos from "../../components/pickup/ConfirmPickupPhotos";
import QrScanModal from "../../components/pickup/QrScanModal";
import CopyId, { isCopyableId } from "../../components/ui/CopyId";

const UNITS = ["Kg", "Quintal", "Ton"];
const DEFAULT_GRADES = ["Grade A", "Grade B", "Grade C"];

function orderGradeQty(pickup) {
  const map = {};
  (Array.isArray(pickup?.grades) ? pickup.grades : []).forEach((g) => {
    const label = String(g.label || g.name || "").trim();
    if (!label) return;
    map[label] = (map[label] || 0) + Number(g.quantity || 0);
  });
  if (!Object.keys(map).length) {
    map["Grade A"] = Number(pickup?.confirmedQuantity || pickup?.packedQuantity || pickup?.expectedQuantity || 0);
  }
  return map;
}

function weightGradeRows(pickup, previous = []) {
  const qty = orderGradeQty(pickup);
  const saved = {};
  (Array.isArray(pickup?.receiving?.grades) ? pickup.receiving.grades : []).forEach((g) => {
    const label = String(g.label || "").trim();
    if (label) saved[label] = g;
  });
  const prev = {};
  previous.forEach((g) => {
    const label = String(g.label || "").trim();
    if (label) prev[label] = g;
  });
  const labels = new Set(DEFAULT_GRADES);
  Object.keys(qty).forEach((label) => labels.add(label));
  Object.keys(saved).forEach((label) => labels.add(label));
  const extras = Array.from(labels).filter((g) => !DEFAULT_GRADES.includes(g)).sort();
  return [...DEFAULT_GRADES, ...extras].map((label) => {
    const fromSave = saved[label];
    const fromPrev = prev[label];
    const expected = fromSave?.expectedWeight != null && fromSave.expectedWeight !== ""
      ? fromSave.expectedWeight
      : qty[label] || 0;
    return {
      label,
      expectedWeight: expected,
      acceptedWeight: fromSave?.acceptedWeight ?? fromPrev?.acceptedWeight ?? "",
    };
  });
}

function num(value) {
  return Number(value || 0);
}

function toKg(value, unit) {
  const n = Number(value || 0);
  if (unit === "Quintal") return n * 100;
  if (unit === "Ton") return n * 1000;
  return n;
}

function fromKg(kg, unit) {
  if (unit === "Quintal") return kg / 100;
  if (unit === "Ton") return kg / 1000;
  return kg;
}

function Info({ label, value, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      {isCopyableId(label, value) ? (
        <CopyId value={value} className="mt-0.5" textClassName="break-all font-mono text-xs font-semibold text-gray-900" breakAll />
      ) : (
        <p className="mt-0.5 break-words text-xs font-semibold leading-snug text-gray-900">{value || "—"}</p>
      )}
    </div>
  );
}

export default function CollectionReceivePage() {
  const { pickupId } = useParams();
  const [pickup, setPickup] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [form, setForm] = useState({
    receivingStatus: "ARRIVED",
    weightUnit: "Kg",
    grades: [],
    packageCount: "",
    photos: [],
    qr: "",
  });

  const load = () => {
    vendorApi
      .getPickup(pickupId)
      .then((r) => {
        const p = r.data?.pickup || r.data;
        setPickup(p);
        const unit = p.receiving?.weightUnit || p.unit || "Kg";
        setForm((f) => ({
          ...f,
          receivingStatus: p.receiving?.status || "ARRIVED",
          weightUnit: unit,
          grades: weightGradeRows(p, f.grades),
          packageCount: p.packageCount || "",
          photos: p.receiving?.photos || [],
        }));
      })
      .catch((err) => setError(err?.response?.data?.message || "Pickup not found"));
  };

  useEffect(() => {
    load();
  }, [pickupId]);

  const totals = useMemo(() => {
    const expected = (form.grades || []).reduce((s, g) => s + num(g.expectedWeight), 0);
    const accepted = (form.grades || []).reduce((s, g) => s + num(g.acceptedWeight), 0);
    return { expected, accepted, difference: accepted - expected };
  }, [form.grades]);

  const converted = useMemo(() => {
    return {
      expectedKg: toKg(totals.expected, form.weightUnit),
      acceptedKg: toKg(totals.accepted, form.weightUnit),
    };
  }, [form.weightUnit, totals]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setGrade = (label, patch) => {
    setForm((f) => ({
      ...f,
      grades: (f.grades || []).map((g) => (g.label === label ? { ...g, ...patch } : g)),
    }));
  };

  const changeUnit = (next) => {
    setForm((f) => ({
      ...f,
      weightUnit: next,
      grades: (f.grades || []).map((g) => ({
        ...g,
        expectedWeight: fromKg(toKg(g.expectedWeight, f.weightUnit), next),
        acceptedWeight: g.acceptedWeight === "" ? "" : fromKg(toKg(g.acceptedWeight, f.weightUnit), next),
      })),
    }));
  };

  const save = async (status) => {
    if (totals.expected < 0 || totals.accepted < 0) {
      setError("Weight values cannot be negative");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await vendorApi.receivePickup(pickup.id, {
        ...form,
        receivingStatus: status || form.receivingStatus,
        expectedWeight: totals.expected,
        actualWeight: totals.accepted,
        acceptedWeight: totals.accepted,
        difference: totals.difference,
        grades: (form.grades || []).map((g) => ({
          label: g.label,
          expectedWeight: num(g.expectedWeight),
          actualWeight: num(g.acceptedWeight),
          acceptedWeight: num(g.acceptedWeight),
          difference: num(g.acceptedWeight) - num(g.expectedWeight),
        })),
      });
      setPickup(res.data);
      if ((status || form.receivingStatus) === "RECEIVED") {
        const rec = await vendorApi.getPickupReceipt(pickup.id);
        setReceipt(rec.data);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save receiving");
    } finally {
      setBusy(false);
    }
  };

  const printReceipt = () => window.print();

  if (!pickup && !error) return <p className="p-6 text-xs text-gray-400">Loading…</p>;
  if (!pickup) return <p className="p-6 text-xs text-red-500">{error}</p>;

  const qrRaw = form.qr.trim();
  const qrOk = Boolean(
    qrRaw &&
      (qrRaw === pickup.qrPayload ||
        qrRaw.includes(pickup.orderDisplayId) ||
        qrRaw.includes(pickup.orderId) ||
        (pickup.collectionBatchId && qrRaw.includes(pickup.collectionBatchId)))
  );

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center gap-2 text-xs text-gray-400 print:hidden">
        <Link to="/vendor/pickups/centre" className="hover:text-[#217346]">Pickups at Centre</Link>
        <span>›</span>
        <CopyId value={pickup.orderDisplayId} textClassName="font-semibold text-gray-700" />
      </div>

      <span className="inline-flex max-w-full rounded-full bg-[#E8F5E9] px-2.5 py-1 text-[11px] font-semibold text-[#217346]">
        {pickupLiveLabel(pickup)}
      </span>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Collection Centre Receiving</h1>
        <p className="text-sm text-gray-500">Order {pickup.orderDisplayId} · {pickup.farmerName}</p>
      </div>
      {error ? <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 print:hidden">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2 print:col-span-3">
          <div className="border border-gray-200 bg-white p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#217346]">Order</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 lg:grid-cols-3">
              <Info label="Order ID" value={pickup.orderDisplayId} className="col-span-2 lg:col-span-1" />
              <Info label="Farmer" value={pickup.farmerName} />
              <Info label="Product" value={pickup.productName} />
              <Info label="Expected Quantity" value={`${pickup.confirmedQuantity || pickup.packedQuantity || pickup.expectedQuantity} ${pickup.unit}`} />
              <Info label="Packages" value={pickup.packageCount} />
              <Info label="Pickup ID" value={pickup.pickupId} className="col-span-2 lg:col-span-1" />
              <Info label="Driver" value={pickup.driverName || "—"} />
              <Info label="Vehicle" value={pickup.vehicleNumber || "—"} />
              <Info
                label="Lot / Batch ID"
                className="col-span-2 lg:col-span-1"
                value={
                  pickup.collectionBatchId ? (
                    <Link to={`/vendor/batches/${encodeURIComponent(pickup.collectionBatchId)}`} className="break-all text-[#217346]">
                      {pickup.collectionBatchId}
                    </Link>
                  ) : "—"
                }
              />
              <Info
                label="Pickup Date"
                className="col-span-2 lg:col-span-1"
                value={pickup.pickupConfirmedAt ? new Date(pickup.pickupConfirmedAt).toLocaleString("en-IN") : pickup.scheduledDate}
              />
            </div>
          </div>

          <div className="border border-gray-200 bg-white p-5 print:hidden">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#217346]">1. Scan QR & verify</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="w-full flex-1 border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                placeholder="Paste greengrocc:order:… or greengrocc:batch:…"
                value={form.qr}
                onChange={(e) => set("qr", e.target.value)}
              />
              <button
                type="button"
                className="shrink-0 bg-[#217346] px-4 py-1.5 text-xs font-semibold text-white sm:min-w-[7.5rem]"
                onClick={() => setScanOpen(true)}
              >
                Scan QR
              </button>
            </div>
            <p className={`mt-2 text-[11px] ${form.qr ? (qrOk ? "text-green-700" : "text-red-600") : "text-gray-500"}`}>
              {form.qr ? (qrOk ? "QR matches this order." : "QR does not match this order.") : pickup.orderDisplayId ? `Scan order QR for ${pickup.orderDisplayId}` : "Scan or paste the order QR from the driver."}
            </p>
          </div>

          <div className="border border-gray-200 bg-white p-5 print:hidden">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#217346]">2. Weight verification</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => changeUnit(u)}
                  className={`px-3 py-1 text-xs ${form.weightUnit === u ? "bg-[#217346] text-white" : "border border-gray-200"}`}
                >
                  {u}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left text-[10px] md:min-w-[420px] md:table-auto md:text-xs">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[24%]" />
                  <col className="w-[28%]" />
                  <col className="w-[26%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 text-[9px] font-bold uppercase tracking-wide text-gray-500 md:text-[10px]">
                    <th className="border border-gray-200 px-1 py-1.5 md:px-2 md:py-2">Grade</th>
                    <th className="border border-gray-200 px-1 py-1.5 md:px-2 md:py-2">Expected</th>
                    <th className="border border-gray-200 px-1 py-1.5 md:px-2 md:py-2">Accepted</th>
                    <th className="border border-gray-200 px-1 py-1.5 md:px-2 md:py-2">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {(form.grades || []).map((g) => {
                    const diff = num(g.acceptedWeight) - num(g.expectedWeight);
                    return (
                      <tr key={g.label}>
                        <td className="border border-gray-200 px-1 py-1 font-semibold leading-tight text-gray-900 md:px-2 md:py-1.5">{g.label}</td>
                        <td className="border border-gray-200 px-1 py-1 tabular-nums md:px-2 md:py-1.5">
                          {num(g.expectedWeight)}
                          <span className="hidden md:inline"> {form.weightUnit}</span>
                        </td>
                        <td className="border border-gray-200 p-0.5 md:px-1 md:py-1">
                          <input
                            className="w-full border border-gray-200 px-1 py-1.5 text-[11px] md:px-2 md:text-xs"
                            type="number"
                            min="0"
                            step="0.001"
                            inputMode="decimal"
                            value={g.acceptedWeight}
                            onChange={(e) => setGrade(g.label, { acceptedWeight: e.target.value })}
                          />
                        </td>
                        <td className={`border border-gray-200 px-1 py-1 font-semibold tabular-nums md:px-2 md:py-1.5 ${diff < 0 ? "text-red-600" : "text-gray-900"}`}>
                          {diff > 0 ? "+" : ""}
                          {diff}
                          <span className="hidden md:inline"> {form.weightUnit}</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-bold">
                    <td className="border border-gray-200 px-1 py-1.5 md:px-2 md:py-2">Total</td>
                    <td className="border border-gray-200 px-1 py-1.5 tabular-nums md:px-2 md:py-2">
                      {totals.expected}
                      <span className="hidden md:inline"> {form.weightUnit}</span>
                    </td>
                    <td className="border border-gray-200 px-1 py-1.5 tabular-nums md:px-2 md:py-2">
                      {totals.accepted}
                      <span className="hidden md:inline"> {form.weightUnit}</span>
                    </td>
                    <td className={`border border-gray-200 px-1 py-1.5 tabular-nums md:px-2 md:py-2 ${totals.difference < 0 ? "text-red-600" : "text-gray-900"}`}>
                      {totals.difference > 0 ? "+" : ""}
                      {totals.difference}
                      <span className="hidden md:inline"> {form.weightUnit}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              Difference = Accepted − Expected. Base: {converted.expectedKg} Kg expected / {converted.acceptedKg} Kg accepted.
            </p>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold">Package count</label>
              <input className="w-40 border border-gray-200 px-3 py-1.5 text-xs" type="number" value={form.packageCount} onChange={(e) => set("packageCount", e.target.value)} />
            </div>
          </div>

          <div className="border border-gray-200 bg-white p-5 print:hidden">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#217346]">3. Photos</p>
            <ConfirmPickupPhotos
              photos={form.photos}
              onChange={(photos) => set("photos", photos)}
              disabled={pickup.receiving?.status === "RECEIVED"}
            />
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" disabled={busy || !qrOk} className="bg-[#217346] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60" onClick={() => save("RECEIVED")}>
              Confirm Received
            </button>
            {pickup.receiving?.receiptId ? (
              <button type="button" className="border border-gray-200 px-3 py-1.5 text-xs" onClick={printReceipt}>
                Print Receipt
              </button>
            ) : null}
          </div>
        </div>

        <div className="border border-gray-200 bg-white p-5" id="receipt">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#217346]">Receiving Receipt</p>
          <Info label="Receipt ID" value={pickup.receiving?.receiptId || receipt?.receiptId || "Generated on confirm"} />
          <div className="mt-2"><Info label="Order" value={pickup.orderDisplayId} /></div>
          <div className="mt-2"><Info label="Farmer" value={pickup.farmerName} /></div>
          <div className="mt-2"><Info label="Product" value={pickup.productName} /></div>
          <div className="mt-2"><Info label="Expected" value={`${totals.expected || "—"} ${form.weightUnit}`} /></div>
          <div className="mt-2"><Info label="Accepted" value={`${totals.accepted || "—"} ${form.weightUnit}`} /></div>
          <div className="mt-2"><Info label="Difference" value={`${totals.difference} ${form.weightUnit}`} /></div>
          {(form.grades || []).map((g) => (
            <div key={g.label} className="mt-2">
              <Info
                label={g.label}
                value={`Exp ${num(g.expectedWeight)} · Acc ${num(g.acceptedWeight)} ${form.weightUnit}`}
              />
            </div>
          ))}
          <div className="mt-2"><Info label="Packages" value={form.packageCount} /></div>
          <div className="mt-2"><Info label="Driver" value={`${pickup.driverName} · ${pickup.vehicleNumber}`} /></div>
          <p className="mt-4 text-[10px] text-gray-400">Next: Quality Check & Grading.</p>
          {pickup.receiving?.status === "RECEIVED" ? (
            <Link
              to={`/vendor/quality/${pickup.orderId || pickup.orderDisplayId}`}
              className="mt-3 inline-block bg-[#217346] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Start Quality Check
            </Link>
          ) : null}
        </div>
      </div>

      <QrScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan order QR"
        hint="Align the order QR inside the frame"
        onScan={(value) => {
          set("qr", String(value || "").trim());
          setScanOpen(false);
        }}
      />
    </div>
  );
}
