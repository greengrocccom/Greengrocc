import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { vendorApi } from "../../api/vendorApi";
import { useLive } from "../../realtime/useLive";
import StatusBadge from "../../components/ui/StatusBadge";
import CopyId, { isCopyableId } from "../../components/ui/CopyId";
import LoadingState from "../../components/ui/LoadingState";
import EmptyState from "../../components/ui/EmptyState";
import { formatMoney } from "../../utils/orderDisplay";
import { gradeStatementRows, gradeStatementTotals, num } from "../../utils/gradeStatement";
import {
  EXCEL_BTN,
  EXCEL_BTN_PRIMARY,
  EXCEL_INPUT,
  EXCEL_PAGE_SUB,
  EXCEL_PAGE_TITLE,
  EXCEL_PANEL,
  EXCEL_PANEL_HEAD,
} from "../../utils/excelStyles";

const PARAM_FIELDS = [
  { key: "freshness", label: "Freshness" },
  { key: "size", label: "Size" },
  { key: "colour", label: "Colour" },
  { key: "appearance", label: "Appearance" },
  { key: "cleanliness", label: "Cleanliness" },
  { key: "damage", label: "Damage" },
  { key: "moisture", label: "Moisture" },
  { key: "weight", label: "Weight" },
  { key: "overallQuality", label: "Overall Quality" },
];

const GRADE_ROWS = [
  { key: "gradeAQuantity", label: "Grade A" },
  { key: "gradeBQuantity", label: "Grade B" },
  { key: "gradeCQuantity", label: "Grade C" },
];

const GRADE_TONE = {
  "Grade A": "border-[#A7F3D0] bg-[#ECFDF5]",
  "Grade B": "border-[#BFDBFE] bg-[#EFF6FF]",
  "Grade C": "border-[#FDE68A] bg-[#FFFBEB]",
};

function qualityTimelineIndex(status, paymentStatus) {
  const p = String(paymentStatus || "").toUpperCase().trim();
  const isPaid = p === "PAID" || p === "PAYMENT_COMPLETED" || p === "COMPLETED" || p === "PAYMENT RECEIVED";
  if (isPaid) return 4;
  const s = String(status || "").toUpperCase();
  if (s === "GRADE_CONFIRMED" || s === "ORDER_COMPLETED") return 3;
  if (s === "GRADING") return 2;
  if (s === "INSPECTION" || s === "QUALITY_CHECK") return 1;
  return 0;
}

function QualityStatusTimeline({ status, paymentStatus }) {
  const isPaid = ["PAID", "PAYMENT_COMPLETED", "COMPLETED", "PAYMENT RECEIVED"].includes(
    String(paymentStatus || "").toUpperCase().trim()
  );
  const idx = qualityTimelineIndex(status, paymentStatus);
  const steps = [
    { key: "RECEIVED", label: "Received" },
    { key: "QUALITY_CHECK", label: "Quality Check" },
    { key: "GRADING", label: "Grading" },
    { key: "GRADING_COMPLETED", label: "Grading Completed" },
    { key: "PAYMENT", label: isPaid ? "Payment Completed" : "Payment" },
  ];

  return (
    <ol className="flex w-full items-start">
      {steps.map((step, i) => {
        const done = i <= idx;
        const lineDone = i < idx;
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center px-0.5">
            {!last ? (
              <span
                className={`pointer-events-none absolute left-1/2 top-[8px] h-[3px] w-full ${
                  lineDone ? "bg-[#217346]" : "bg-[#C9E4D3]"
                }`}
              />
            ) : null}
            <span
              className={`relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[3px] bg-white ${
                done ? "border-[#217346]" : "border-[#C9E4D3]"
              }`}
            >
              {done ? <span className="h-[6px] w-[6px] rounded-full bg-[#217346]" /> : null}
            </span>
            <p
              className={`mt-2 text-center text-[10px] font-semibold leading-tight sm:text-[11px] ${
                done ? "text-[#217346]" : "text-[#9CA3AF]"
              }`}
            >
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      {isCopyableId(label, value) ? (
        <CopyId
          value={value}
          className="mt-0.5"
          textClassName="break-all font-mono text-xs font-semibold text-[#1F2937]"
          breakAll
        />
      ) : (
        <p className="mt-0.5 text-xs font-semibold text-[#1F2937]">{value ?? "—"}</p>
      )}
    </div>
  );
}

function ReportPhotos({ photos }) {
  const [preview, setPreview] = useState(null);
  const rows = Array.isArray(photos) ? photos.filter((p) => p?.url) : [];
  if (!rows.length) {
    return <p className="text-[11px] text-[#9CA3AF]">No quality photos.</p>;
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {rows.map((p, i) => (
          <button
            key={`${i}-${(p.url || "").slice(-12)}`}
            type="button"
            className="overflow-hidden rounded-lg border border-[#D4D4D4] bg-white p-0.5 text-left"
            onClick={() => setPreview(p)}
          >
            <img src={p.url} alt={p.label || "Quality"} className="h-16 w-full object-cover" />
            <p className="truncate px-0.5 py-0.5 text-[9px] text-[#6B7280]">{p.label || "Photo"}</p>
          </button>
        ))}
      </div>
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-full max-w-3xl bg-white p-3 shadow-xl rounded-md" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-xs font-semibold">{preview.label || "Preview"}</p>
            <img src={preview.url} alt="" className="max-h-[70vh] max-w-full rounded" />
            <button type="button" className={`mt-2 ${EXCEL_BTN}`} onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function qtyLabel(value, unit) {
  const n = num(value);
  return `${n.toLocaleString("en-IN")} ${unit || "Kg"}`;
}

export default function ManagerEarningReportPage() {
  const { orderId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Payment Modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: "Paid",
    paymentMethod: "Bank Transfer",
    transactionId: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const loadReport = () => {
    vendorApi.getQualityReport(orderId)
      .then((res) => {
        setData(res.data);
        setError("");
      })
      .catch(() => {
        return vendorApi.getQuality(orderId).then((res) => {
          setData(res.data);
          setError("");
        });
      })
      .catch((err) => {
        setData(null);
        setError(err.message || "Quality report is available after grading is confirmed");
      })
      .finally(() => setLoading(false));
  };

  useLive(() => loadReport(), [orderId]);

  const unit = data?.unit || "Kg";
  const gq = data?.gradeQuality || {};
  const qualityGrades = useMemo(() => {
    if (!data) return [];
    return GRADE_ROWS.filter((row) => {
      const assigned = num(data[row.key]);
      const statement = (data.finalStatement || []).find((g) => g.label === row.label);
      const ordered = num(statement?.orderedQuantity);
      const rejected = num(gq[row.label]?.rejectedQuantity);
      return assigned > 0 || ordered > 0 || rejected > 0;
    });
  }, [data, gq]);

  const summaryRows = useMemo(() => {
    if (!data) return [];
    return gradeStatementRows({
      ...data.order,
      ...data,
      grades: data.finalStatement?.length ? data.finalStatement : data.grades,
      finalStatement: data.finalStatement,
      orderedGrades: data.orderedGrades,
      gradeQuality: data.gradeQuality,
      gradeAAssigned: data.gradeAAssigned ?? data.order?.gradeAAssigned,
      gradeBAssigned: data.gradeBAssigned ?? data.order?.gradeBAssigned,
      gradeCAssigned: data.gradeCAssigned ?? data.order?.gradeCAssigned,
    });
  }, [data]);
  const totals = useMemo(() => gradeStatementTotals(summaryRows), [summaryRows]);

  const finalPayableAmount = Number(totals.amount || data?.totalAmount || data?.orderValue || data?.finalAmount || 0);
  const currentPaymentStatus = String(data?.paymentStatus || data?.order?.paymentStatus || "Pending");
  const isPaid = currentPaymentStatus.toUpperCase() === "PAID" || currentPaymentStatus.toUpperCase() === "COMPLETED";

  const handleOpenPaymentModal = () => {
    const details = data?.order?.paymentDetails || {};
    setPaymentForm({
      paymentStatus: isPaid ? "Paid" : "Paid",
      paymentMethod: details.paymentMethod || data?.order?.paymentMethod || "Bank Transfer",
      transactionId: details.transactionId || data?.order?.transactionId || `TXN-${Date.now().toString().slice(-6)}`,
      paymentDate: details.paymentDate ? String(details.paymentDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: details.notes || "",
    });
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    setPaymentSaving(true);
    try {
      await vendorApi.updateOrderPayment(orderId, {
        ...paymentForm,
        amount: finalPayableAmount,
      });
      toast.success(`Payment status updated to ${paymentForm.paymentStatus} successfully!`);
      setPaymentModalOpen(false);
      setData((prev) => (prev ? { ...prev, paymentStatus: paymentForm.paymentStatus, order: { ...(prev.order || {}), paymentStatus: paymentForm.paymentStatus, paymentDetails: { ...paymentForm, amount: finalPayableAmount } } } : prev));
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update payment");
    } finally {
      setPaymentSaving(false);
    }
  };

  if (loading) return <LoadingState rows={8} />;
  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <Link to="/vendor/earnings/payments" className="text-xs text-[#6B7280] hover:text-[#217346] font-semibold">
          ← Back to All Payments
        </Link>
        <EmptyState title="Quality report not ready" description={error || "This report is available after Grading Completed."} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6 font-sans text-slate-800">
      <p className="mb-1 break-words text-xs text-[#6B7280] print:hidden">
        <Link to="/vendor/earnings/payments" className="hover:text-[#217346] font-semibold">
          ← Back to All Payments
        </Link>
        <span> › Order #{data.orderDisplayId || orderId}</span>
      </p>

      {/* Quality Status Timeline (Screen Only) */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 print:hidden shadow-sm">
        <QualityStatusTimeline
          status={data.status || data.qualityStatus}
          paymentStatus={currentPaymentStatus}
        />
      </section>

      {/* Unified Invoice Sheet - Strictly 1 Page Fit, No Floating Covers */}
      <div
        id="invoice-print-area"
        className="mx-auto max-w-4xl bg-white p-4 sm:p-6 text-[11px] leading-tight text-slate-900 border border-slate-300 rounded-xl print:m-0 print:w-full print:max-w-none print:rounded-none print:border-none print:p-0 space-y-3 shadow-sm"
      >
        {/* 1. Header Banner */}
        <div className="flex items-start justify-between border-b-2 border-emerald-800 pb-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 text-white text-xl font-bold shadow-sm">
              🌿
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">
                GreenGrocc Agri Network
              </h1>
              <p className="text-[11px] font-bold text-emerald-800 tracking-wide uppercase">
                Payment History & Quality Grading Statement
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Order ID:</span>
              <span className="font-mono text-xs font-extrabold text-slate-900">
                #{data.orderDisplayId || data.orderId}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] text-slate-600">
              <span className="font-bold">Date:</span>
              <span className="font-semibold text-slate-800">
                {data.receivedDate || data.pickupDate || new Date().toISOString().slice(0, 10)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-end">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                  isPaid
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-amber-100 text-amber-900 border border-amber-300"
                }`}
              >
                {isPaid ? "✓ Paid" : "⏳ Pending"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Parties Info (Farmer & Collection Centre) */}
        <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-2.5">
          {/* Farmer Info */}
          <div>
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-1.5">
              <span className="text-xs">👨‍🌾</span>
              <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900">
                Farmer (Supplier / Payee)
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10.5px]">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Farmer Name:</span>
                <span className="font-bold text-slate-900 truncate block">{data.farmerName || data.farmer?.name || "Nitin Nehe"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Farmer ID:</span>
                <span className="font-mono font-semibold text-slate-800 truncate block">{data.farmerId || data.farmer?.id || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Mobile Number:</span>
                <span className="font-semibold text-slate-800 block">{data.farmerMobile || data.farmer?.mobile || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Village / Location:</span>
                <span className="font-semibold text-slate-800 truncate block">{data.farmerAddress || data.farmer?.address || data.farmer?.village || "—"}</span>
              </div>
            </div>
          </div>

          {/* Collection Centre Info */}
          <div className="border-l border-slate-200 pl-4">
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-1.5">
              <span className="text-xs">🏬</span>
              <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900">
                Collection Centre (Received At)
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10.5px]">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Centre Name:</span>
                <span className="font-bold text-slate-900 truncate block">{data.collectionCentre || "Main Collection Centre"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Centre ID:</span>
                <span className="font-mono font-semibold text-slate-800 truncate block">{data.collectionCentreId || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Inspected By:</span>
                <span className="font-semibold text-slate-800 truncate block">{data.inspectorName || data.lastActionBy || "Quality Officer"}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Weighbridge Status:</span>
                <span className="font-semibold text-slate-800 block">{data.weightVerified !== false ? "Verified on Scale" : "Standard Scale"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Produce & Order Specifications */}
        <div className="border-b border-slate-200 pb-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
              Produce & Order Specifications
            </h2>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-mono font-bold text-slate-700">
              Batch: {data.batchId || "—"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[10.5px]">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Produce / Crop</span>
              <span className="font-bold text-slate-900 block">{data.productName || data.product || "Tomato"}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Variety</span>
              <span className="font-semibold text-slate-800 block">{data.variety || "Standard"}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Ordered Quantity</span>
              <span className="font-bold text-slate-900 block">{qtyLabel(data.orderedQuantity, unit)}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Received Quantity</span>
              <span className="font-bold text-emerald-700 block">{qtyLabel(data.receivedQuantity, unit)}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Pickup Date & Time</span>
              <span className="font-semibold text-slate-800 block">
                {data.pickupDate || "—"} {data.pickupTime ? `· ${data.pickupTime}` : ""}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Received Date & Time</span>
              <span className="font-semibold text-slate-800 block">
                {data.receivedDate || "—"} {data.receivedTime ? `· ${data.receivedTime}` : ""}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Quality Status</span>
              <span className="font-bold text-emerald-700 uppercase block">{data.status || data.qualityStatus || "ORDER_COMPLETED"}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Lot / Batch ID</span>
              <span className="font-mono font-semibold text-slate-800 truncate block">{data.batchId || "—"}</span>
            </div>
          </div>
        </div>

        {/* 4. Grade-Wise Quality Settlement & Valuation Table */}
        <div>
          <div className="mb-1">
            <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-800">
              Grade-Wise Quality Settlement & Valuation
            </h2>
          </div>
          <table className="w-full border-collapse text-left text-[10.5px] border border-slate-300">
            <thead>
              <tr className="bg-slate-800 text-[9.5px] font-extrabold uppercase text-white">
                <th className="px-3 py-1.5 border-r border-slate-700">Grade / Item</th>
                <th className="px-3 py-1.5 text-right border-r border-slate-700">Ordered Qty</th>
                <th className="px-3 py-1.5 text-right border-r border-slate-700">Rejected Qty</th>
                <th className="px-3 py-1.5 text-right border-r border-slate-700">Accepted / Final Qty</th>
                <th className="px-3 py-1.5 text-right border-r border-slate-700">Rate / {unit}</th>
                <th className="px-3 py-1.5 text-right">Total Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {summaryRows.length ? (
                summaryRows.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-50/80">
                    <td className="px-3 py-1.5 font-bold text-slate-900 border-r border-slate-200">
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle bg-emerald-600"></span>
                      {row.label}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 border-r border-slate-200">
                      {qtyLabel(row.ordered, unit)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-bold text-red-600 border-r border-slate-200">
                      {num(row.rejected) > 0 ? qtyLabel(row.rejected, unit) : "0 Kg"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-bold text-slate-900 border-r border-slate-200">
                      {qtyLabel(row.finalQty, unit)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-800 font-semibold border-r border-slate-200">
                      {row.rate > 0 ? formatMoney(row.rate) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-emerald-800">
                      {row.amount > 0 ? formatMoney(row.amount) : "₹0"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-3 text-center text-slate-400" colSpan={6}>
                    No grade data available.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-emerald-800 bg-emerald-50/80 font-bold text-[11px]">
                <td className="px-3 py-2 text-slate-900 font-extrabold uppercase border-r border-slate-200">Total Settlement</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-800 border-r border-slate-200">
                  {qtyLabel(totals.ordered || data.orderedQuantity, unit)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600 font-bold border-r border-slate-200">
                  {qtyLabel(totals.rejected, unit)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900 font-extrabold border-r border-slate-200">
                  {qtyLabel(totals.finalQty, unit)}
                </td>
                <td className="px-3 py-2 text-right text-slate-400 border-r border-slate-200">—</td>
                <td className="px-3 py-2 text-right text-xs font-black text-emerald-900 tabular-nums">
                  {formatMoney(finalPayableAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 5. Payment & Settlement Status */}
        <div className="border-b border-slate-200 pb-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-950">
              Payment & Settlement Status
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-600">Status:</span>
              <span className={`text-[10px] font-extrabold ${isPaid ? "text-emerald-800" : "text-amber-800"}`}>
                {currentPaymentStatus}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-[10.5px]">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Net Payable Amount</span>
              <span className="text-sm font-black text-emerald-800 block">
                ₹{finalPayableAmount.toLocaleString("en-IN")}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Payment Method</span>
              <span className="font-semibold text-slate-800 truncate block">
                {(data.paymentDetails || data.order?.paymentDetails)?.paymentMethod || (isPaid ? "Bank Transfer" : "Bank Transfer (Pending)")}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Transaction ID / UTR</span>
              <span className="font-mono font-semibold text-slate-800 truncate block">
                {(data.paymentDetails || data.order?.paymentDetails)?.transactionId || (isPaid ? `TXN-${data.orderDisplayId}` : "—")}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Settlement Date</span>
              <span className="font-semibold text-slate-800 truncate block">
                {(data.paymentDetails || data.order?.paymentDetails)?.paymentDate
                  ? String((data.paymentDetails || data.order?.paymentDetails).paymentDate).slice(0, 10)
                  : (isPaid ? (data.receivedDate || "Today") : "Pending Settlement")}
              </span>
            </div>
          </div>

          {(data.paymentDetails || data.order?.paymentDetails)?.notes ? (
            <div className="mt-1 text-[10px] text-slate-700">
              <span className="font-bold">Notes:</span> {(data.paymentDetails || data.order?.paymentDetails).notes}
            </div>
          ) : null}
        </div>

        {/* 6. Quality Parameters Summary */}
        {qualityGrades.length > 0 ? (
          <div className="border-b border-slate-200 pb-2.5">
            <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 pb-1 mb-1 border-b border-slate-100">
              Quality Inspection Parameters & Quality Remarks
            </h2>
            <div className="grid grid-cols-2 gap-4 text-[10px]">
              {qualityGrades.map((row) => {
                const grade = gq[row.label] || {};
                const params = grade.parameters || {};
                return (
                  <div key={row.label} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900">{row.label} Parameters</span>
                      {num(grade.rejectedQuantity) > 0 ? (
                        <span className="text-[9.5px] font-bold text-red-600">
                          Rejected: {qtyLabel(grade.rejectedQuantity, unit)} ({grade.rejectionReason || "Damaged"})
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-slate-600 text-[9.5px]">
                      <div>Freshness: <span className="font-semibold text-slate-800">{params.freshness || "Excellent"}</span></div>
                      <div>Size: <span className="font-semibold text-slate-800">{params.size || "Uniform"}</span></div>
                      <div>Moisture: <span className="font-semibold text-slate-800">{params.moisture || "Normal"}</span></div>
                      <div>Damage: <span className="font-semibold text-slate-800">{params.damage || "None"}</span></div>
                      <div>Cleanliness: <span className="font-semibold text-slate-800">{params.cleanliness || "Clean"}</span></div>
                      <div>Overall: <span className="font-semibold text-slate-800">{params.overallQuality || "Excellent"}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {data.qualityRemarks ? (
              <p className="text-[9.5px] text-slate-600 pt-1">
                <span className="font-bold">Inspector Remarks:</span> {data.qualityRemarks}
              </p>
            ) : null}
          </div>
        ) : null}

      </div>

      {/* Action Buttons (Screen Only) */}
      <div className="flex flex-col gap-2 print:hidden sm:flex-row">
        <Link to="/vendor/earnings/payments" className={`${EXCEL_BTN} w-full sm:w-auto text-center font-semibold`}>
          ← Back to All Payments
        </Link>
      </div>

      {/* Payment Action Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPaymentModalOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-slate-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-sm font-extrabold text-[#1F2937]">Farmer Payment & Settlement</h2>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                onClick={() => setPaymentModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#374151]">Payable Amount</label>
                <input
                  type="text"
                  readOnly
                  value={`₹${finalPayableAmount.toLocaleString("en-IN")}`}
                  className="mt-1 w-full bg-slate-100 border border-slate-300 rounded px-3 py-2 text-sm font-extrabold text-[#217346]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#374151]">Payment Status</label>
                <select
                  value={paymentForm.paymentStatus}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, paymentStatus: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-xs font-semibold focus:border-[#217346]"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#374151]">Payment Method</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-xs font-semibold focus:border-[#217346]"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT / IMPS / RTGS)</option>
                  <option value="UPI">UPI / Google Pay / PhonePe</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#374151]">Transaction / Ref ID</label>
                <input
                  type="text"
                  value={paymentForm.transactionId}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, transactionId: e.target.value }))}
                  placeholder="e.g. TXN-984210"
                  className={`${EXCEL_INPUT} mt-1 w-full font-mono text-xs`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#374151]">Payment Date</label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))}
                  className={`${EXCEL_INPUT} mt-1 w-full text-xs`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#374151]">Remarks / Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Paid to farmer bank account"
                  className={`${EXCEL_INPUT} mt-1 w-full text-xs`}
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  className={EXCEL_BTN}
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSaving}
                  className={`${EXCEL_BTN_PRIMARY} px-4 py-2 font-bold`}
                >
                  {paymentSaving ? "Saving…" : "Save Payment Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
