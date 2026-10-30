import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { useAuth } from "../../context/AuthContext";
import { PageShell } from "../../components/layout/ManagerLayout";
import { useLive } from "../../realtime/useLive";
import { subscribeToSocketEvent } from "../../services/socket";

const CHECK_ITEMS = [
  { key: "aadhaar", label: "Aadhaar card", type: "doc" },
  { key: "pan", label: "PAN card", type: "doc" },
  { key: "passport", label: "Passport / ID", type: "doc" },
  { key: "license", label: "Driving license", type: "doc" },
  { key: "rc", label: "Vehicle RC", type: "doc" },
  { key: "insurance", label: "Insurance", type: "doc" },
  { key: "selfie", label: "Selfie Photo", type: "selfie" },
  { key: "bankDetails", label: "Bank details", type: "bank" },
  { key: "liveness", label: "Liveness check", type: "liveness" },
];

function docMeta(rider, key) {
  if (!rider) return {};
  if (key === "selfie") return rider.selfie || {};
  return rider.documents?.[key] || {};
}

function docStatus(rider, key) {
  if (!rider) return "pending";
  if (key === "selfie") return rider.selfie?.status || "pending";
  if (key === "liveness") return rider.livenessPassed ? "passed" : "pending";
  if (key === "bankDetails") {
    const b = rider.bankDetails || {};
    const filled = b.accountNumber || b.upiId || b.ifscCode;
    return filled ? "submitted" : "missing";
  }
  return rider.documents?.[key]?.status || "pending";
}

function imageSrc(rider, key) {
  if (!rider) return "";
  if (key === "selfie") return rider.selfie?.url || rider.selfie?.imageBase64 || "";
  return rider.documents?.[key]?.url || rider.documents?.[key]?.imageBase64 || "";
}

export default function PendingDriverDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { manager } = useAuth();

  const [rider, setRider] = useState(null);
  const [checks, setChecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [preview, setPreview] = useState(null);

  const loadRider = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await managerApi.pendingRiders();
      const list = res.data.riders || [];
      const found = list.find((r) => String(r.id || r._id) === String(id));
      if (found) {
        setRider(found);
        setChecks((prev) => (prev[found.id] ? prev : { [found.id]: {} }));
        setError("");
      } else if (!silent) {
        setError("Driver application not found or already verified.");
      } else {
        // Rider left pending queue (approved/rejected) — event-driven
        setRider((prev) =>
          prev
            ? { ...prev, verificationStatus: "approved" }
            : prev
        );
        setToast("Verification updated — this application is no longer pending.");
      }
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || "Failed to load driver details");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useLive(loadRider, [loadRider]);

  useEffect(() => {
    return subscribeToSocketEvent("rider_document_updated", (payload = {}) => {
      if (String(payload.riderId) !== String(id)) return;
      if (payload.verificationStatus === "approved") {
        setToast("Driver verified — docs approved.");
        setRider((prev) =>
          prev ? { ...prev, verificationStatus: "approved" } : prev
        );
      } else {
        loadRider({ silent: true });
      }
    });
  }, [id, loadRider]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const toggleCheck = (riderId, key) => {
    setChecks((prev) => ({
      ...prev,
      [riderId]: {
        ...(prev[riderId] || {}),
        [key]: !prev[riderId]?.[key],
      },
    }));
  };

  const allChecked = (riderId) =>
    CHECK_ITEMS.every((item) => checks[riderId]?.[item.key]);

  const onVerify = async (decision) => {
    if (!rider) return;
    const riderId = rider.id || rider._id;
    if (decision === "approved" && !allChecked(riderId)) {
      showToast("Please check and verify all document checkboxes before approving");
      return;
    }

    setBusyAction(decision);
    try {
      const checkedItems = CHECK_ITEMS.filter((i) => checks[riderId]?.[i.key]).map(
        (i) => i.key
      );
      const res = await managerApi.verifyRider(riderId, {
        decision,
        checkedItems,
      });
      const msg =
        decision === "approved"
          ? "Driver verified successfully! Account is now active."
          : res.data.message || `Driver application ${decision}`;
      showToast(msg);
      setTimeout(() => {
        navigate("/drivers/pending");
      }, 1200);
    } catch (err) {
      showToast(err.response?.data?.message || "Verification failed");
      setBusyAction("");
    }
  };

  const joiningDateFormatted = rider?.createdAt
    ? new Date(rider.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Recent";

  return (
    <PageShell>
      {toast && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 shadow-xs flex items-center gap-3">
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-slate-800 space-y-3">
          <p className="text-sm font-semibold text-rose-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/drivers/pending")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Return to Pending Applications Queue
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-96 rounded-2xl bg-slate-200/60 animate-pulse" />
      ) : rider ? (
        <div className="space-y-6">
          {/* Driver Card Header */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {rider.name || "New Applicant"}
                    </h3>
                    <span className="rounded-full bg-amber-100 px-3 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                      Pending Approval
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                    <span>Phone: {rider.phone}</span>
                    <span>•</span>
                    <span>Vehicle: <strong className="text-slate-800">{rider.vehicleType || "N/A"}</strong></span>
                    <span>•</span>
                    <span>Hub / Area: <strong className="text-slate-800">{rider.area || manager?.area || "N/A"}</strong></span>
                    <span>•</span>
                    <span>Joined: <strong className="text-slate-800">{joiningDateFormatted}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!!busyAction || !allChecked(rider.id || rider._id)}
                  onClick={() => onVerify("approved")}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-40 transition active:scale-95 cursor-pointer"
                >
                  {busyAction === "approved" ? "Approving…" : "Approve & Activate"}
                </button>
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={() => onVerify("rejected")}
                  className="rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition cursor-pointer"
                >
                  {busyAction === "rejected" ? "Rejecting…" : "Reject Application"}
                </button>
              </div>
            </div>

            {/* Bank Account Details Card */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Bank Payout Details
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Account Holder</p>
                  <p className="font-bold text-slate-900">{rider.bankDetails?.accountHolderName || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Account Number</p>
                  <p className="font-bold text-slate-900 font-mono">{rider.bankDetails?.accountNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">IFSC Code</p>
                  <p className="font-bold text-slate-900 font-mono">{rider.bankDetails?.ifscCode || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Bank Name</p>
                  <p className="font-bold text-slate-900">{rider.bankDetails?.bankName || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">UPI ID</p>
                  <p className="font-bold text-slate-900 font-mono">{rider.bankDetails?.upiId || "—"}</p>
                </div>
              </div>
            </div>

            {/* KYC Documents & Verification Checklist */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  KYC Documents & Verification Checklist
                </p>
                <span className="text-xs text-slate-500">
                  Checked: <strong className="text-emerald-700">{CHECK_ITEMS.filter((i) => checks[rider.id || rider._id]?.[i.key]).length}</strong> / {CHECK_ITEMS.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CHECK_ITEMS.map((item) => {
                  const riderId = rider.id || rider._id;
                  const status = docStatus(rider, item.key);
                  const checked = !!checks[riderId]?.[item.key];
                  const src = imageSrc(rider, item.key);
                  const meta = docMeta(rider, item.key);

                  return (
                    <div
                      key={item.key}
                      className={`rounded-xl border p-3.5 transition ${
                        checked
                          ? "border-emerald-500 bg-emerald-50/40 shadow-xs"
                          : "border-slate-200/80 bg-slate-50/50"
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheck(riderId, item.key)}
                          className="mt-0.5 h-4 w-4 rounded-md accent-emerald-600 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-slate-900">
                            {item.label}
                          </span>
                          <span className="text-[10px] text-slate-500 capitalize">
                            Status: <strong className="text-slate-700">{status}</strong>
                          </span>
                        </div>
                      </label>

                      {item.type === "liveness" ? (
                        <div className="mt-3 rounded-lg bg-white p-3 text-center text-xs font-semibold text-slate-600 border border-slate-100">
                          {rider.livenessPassed
                            ? `Liveness passed ${rider.livenessPassedAt ? `on ${new Date(rider.livenessPassedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : "on device"}`
                            : "Liveness incomplete"}
                        </div>
                      ) : src ? (
                        <button
                          type="button"
                          className="mt-3 group relative block w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                          onClick={() => setPreview({ src, title: item.label, fileName: meta.fileName })}
                        >
                          <img src={src} alt={item.label} className="h-32 w-full object-cover group-hover:scale-105 transition" />
                          <span className="block bg-slate-900/80 py-1 text-[10px] font-bold text-white text-center">
                            Tap to Enlarge Photo
                          </span>
                        </button>
                      ) : item.type !== "bank" ? (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-100/60 py-5 text-center text-[11px] text-slate-400">
                          No image uploaded yet
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Image Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="font-bold text-slate-900 text-sm">{preview.title}</p>
                {preview.fileName && <p className="text-xs text-slate-400 font-mono">{preview.fileName}</p>}
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                onClick={() => setPreview(null)}
              >
                Close ✕
              </button>
            </div>
            <img src={preview.src} alt={preview.title} className="max-h-[70vh] w-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </PageShell>
  );
}
