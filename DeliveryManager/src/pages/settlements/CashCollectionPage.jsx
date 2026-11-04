import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { PageShell } from "../../components/layout/ManagerLayout";
import { subscribeToSocketEvent } from "../../services/socket";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const money = (amount) => rupees.format(amount || 0);
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const receiptStates = { PENDING: "Awaiting receipt", SUBMITTED: "Submitted", COMPLETED: "Received", DISPUTED: "Under review" };
const canReceive = (record) => record.status === "PENDING" || record.status === "SUBMITTED";

export default function CashCollectionPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [saving, setSaving] = useState(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const res = await managerApi.getCashCollection();
      if (id !== request.current) return;
      setData(res.data);
      setError("");
    } catch (err) {
      if (id === request.current) setError(err.response?.data?.message || "Could not load cash collections.");
    }
  }, []);

  useEffect(() => {
    load();
    const offCash = subscribeToSocketEvent("store_cash_updated", load);
    const offConnect = subscribeToSocketEvent("connect", load);
    return () => {
      request.current++;
      offCash();
      offConnect();
    };
  }, [load]);

  const confirm = async () => {
    if (!receipt || saving) return;
    setSaving(true);
    setError("");
    try {
      const { rider, records } = receipt;
      const res = rider.riderId
        ? await managerApi.confirmCashCollection(rider.riderId, records.map((record) => record.id))
        : await managerApi.confirmOrderCash(records[0].orderId);
      setNotice(res.data.message || "Cash receipt recorded.");
      setReceipt(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm receipt.");
    } finally {
      setSaving(false);
    }
  };

  const totals = data?.totals;
  return (
    <PageShell title="Cash Collection" meta="Physical cash collected on COD orders" actions={
      <button type="button" onClick={load} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
    }>
      {error && !receipt && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {!data && !error && <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading cash collections…</p>}
      {totals && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["Collected today", money(totals.collected), "Physical COD cash recorded today"],
              ["Received today", money(totals.received), "Receipts confirmed today, including older collections"],
              ["Awaiting receipt", money(totals.pending), "Outstanding cash across all dates"],
              ["Riders", totals.riderCount, "Riders with cash activity or an outstanding balance"],
            ].map(([label, value, description]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-semibold text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{description}</p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">Cash by rider</h2>
              <p className="mt-1 text-xs text-slate-500">{data.date} IST · Expand a rider to see their orders and record receipts.</p>
            </div>
            {!data.riders.length && <p className="p-6 text-sm text-slate-500">No cash activity today and no outstanding collections.</p>}
            {data.riders.map((rider) => {
              const receivable = rider.settlements.filter(canReceive);
              return (
                <details key={rider.riderId || "store"} className="border-b border-slate-100 last:border-b-0">
                  <summary className="cursor-pointer px-4 py-3 hover:bg-slate-50">
                    <span className="inline-grid w-[calc(100%-1.5rem)] grid-cols-2 gap-3 align-middle sm:grid-cols-4">
                      <span className="text-sm font-semibold text-slate-900">{rider.name}<span className="block text-xs font-normal text-slate-500">{rider.phone}</span></span>
                      <Amount label="Collected today" amount={rider.collected} />
                      <Amount label="Received today" amount={rider.received} />
                      <Amount label="Awaiting receipt" amount={rider.pending} />
                    </span>
                  </summary>
                  <div className="overflow-x-auto border-t border-slate-100 px-4 pb-4">
                    {rider.riderId && receivable.length > 1 && (
                      <button type="button" onClick={() => setReceipt({ rider, records: receivable })} className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Mark all eligible cash received</button>
                    )}
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className="text-slate-500"><tr>{["Order", "Collected at", "Amount", "Receipt status", "Action"].map((label) => <th key={label} scope="col" className="py-3 pr-3">{label}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {rider.settlements.map((record) => (
                          <tr key={record.id} className="text-slate-700">
                            <td className="py-2.5 pr-3"><Link to={`/orders/${record.orderId}`} className="font-semibold text-emerald-800 hover:underline">#{record.orderNumber || record.orderId.slice(-6)}</Link></td>
                            <td className="py-2.5 pr-3">{record.collectedAt ? dateTime.format(new Date(record.collectedAt)) : "—"}</td>
                            <td className="py-2.5 pr-3 font-semibold tabular-nums">{money(record.amount)}</td>
                            <td className="py-2.5 pr-3">{receiptStates[record.status]}{record.confirmedAt && <span className="block text-slate-500">{dateTime.format(new Date(record.confirmedAt))}</span>}</td>
                            <td className="py-2.5">{canReceive(record) ? (
                              <button type="button" onClick={() => setReceipt({ rider, records: [record] })} className="rounded-md border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50">Mark received</button>
                            ) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </section>
        </>
      )}
      {receipt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cash-receipt-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="cash-receipt-title" className="text-lg font-bold text-slate-900">Confirm physical cash receipt</h2>
            <p className="mt-2 text-sm text-slate-700">Confirm you physically received <strong>{money(receipt.records.reduce((sum, record) => sum + record.amount, 0))}</strong> for {receipt.records.length} {receipt.records.length === 1 ? "order" : "orders"}{receipt.rider.riderId ? ` from ${receipt.rider.name}` : ""}.</p>
            {error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => { setReceipt(null); setError(""); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="button" disabled={saving} onClick={confirm} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Confirm receipt"}</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Amount({ label, amount }) {
  return <span className="text-sm font-semibold tabular-nums text-slate-900">{money(amount)}<span className="block text-xs font-normal text-slate-500">{label}</span></span>;
}
