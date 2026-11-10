import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getManagerPickups } from "../../api/farmerApi";
import StatusBadge from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import { parseOrderQrPayload } from "../../utils/orderQr";
import {
  EXCEL_BTN_PRIMARY,
  EXCEL_INPUT,
  EXCEL_PAGE_SUB,
  EXCEL_PAGE_TITLE,
  EXCEL_PANEL,
  EXCEL_CELL,
  EXCEL_HEAD,
  EXCEL_TABLE,
  EXCEL_WRAP,
} from "../../utils/excelStyles";

export default function ManagerQrVerifyPage() {
  const navigate = useNavigate();
  const [pickups, setPickups] = useState([]);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getManagerPickups({ filter: "requests" })
      .then((data) => {
        const rows = (data?.pickups || []).filter((p) =>
          ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "QR_VERIFIED"].includes(p.status)
        );
        setPickups(rows);
      })
      .catch(() => setPickups([]))
      .finally(() => setLoading(false));
  }, []);

  const match = pickups.find((p) => {
    const value = qr.trim();
    if (!value) return false;
    const parsed = parseOrderQrPayload(value);
    return (
      p.qrPayload === value ||
      p.orderDisplayId === value ||
      p.orderId === value ||
      p.orderDisplayId === parsed ||
      p.orderId === parsed ||
      value.includes(p.orderDisplayId) ||
      (parsed && value.includes(parsed))
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className={EXCEL_PAGE_TITLE}>QR Verification</h1>
        <p className={EXCEL_PAGE_SUB}>Scan or paste the driver QR. You will verify and confirm pickup on the next screen.</p>
      </div>

      <div className={EXCEL_PANEL + " p-4"}>
        <label className="mb-1 block text-xs font-semibold">Scanned QR / Order ID</label>
        <div className="flex flex-wrap gap-2">
          <input className={`${EXCEL_INPUT} max-w-md`} value={qr} onChange={(e) => setQr(e.target.value)} placeholder="greengrocc:order:…" />
          <button
            type="button"
            disabled={!match}
            className={EXCEL_BTN_PRIMARY}
            onClick={() => match && navigate(`/manager/pickups/${match.id}`)}
          >
            Open Pickup
          </button>
        </div>
        {qr && !match ? <p className="mt-2 text-[11px] text-red-600">No matching pickup for your assigned farmers.</p> : null}
        {match ? <p className="mt-2 text-[11px] text-[#217346]">Matched order {match.orderDisplayId} · {match.farmerName}</p> : null}
      </div>

      {loading ? (
        <p className="text-xs text-[#6B7280]">Loading…</p>
      ) : pickups.length === 0 ? (
        <EmptyState title="Nothing to verify" description="Assigned pickups waiting for QR verification will appear here." />
      ) : (
        <div className={EXCEL_WRAP}>
          <table className={EXCEL_TABLE}>
            <thead>
              <tr>
                {["Order", "Farmer", "Product", "Driver", "Status", ""].map((h) => (
                  <th key={h} className={EXCEL_HEAD}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pickups.map((p) => (
                <tr key={p.id}>
                  <td className={EXCEL_CELL}>{p.orderDisplayId}</td>
                  <td className={EXCEL_CELL}>{p.farmerName}</td>
                  <td className={EXCEL_CELL}>{p.productName}</td>
                  <td className={EXCEL_CELL}>{p.driverName || "—"}</td>
                  <td className={EXCEL_CELL}><StatusBadge status={p.status} /></td>
                  <td className={EXCEL_CELL}>
                    <button type="button" className={EXCEL_BTN_PRIMARY} onClick={() => navigate(`/manager/pickups/${p.id}`)}>
                      Verify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
