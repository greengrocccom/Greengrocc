import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { managerApi } from "../../api/managerApi";
import { useAuth } from "../../context/AuthContext";
import { PageShell } from "../../components/layout/ManagerLayout";
import { Icon } from "../../components/ui/Icon";
import { useLive } from "../../realtime/useLive";

export default function PendingDriversPage() {
  const { manager } = useAuth();
  const navigate = useNavigate();
  const [riders, setRiders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await managerApi.pendingRiders();
      const list = res.data.riders || [];
      setRiders(list);
      setError("");
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || "Failed to load pending drivers");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useLive(load, [load]);

  const handleRowClick = (riderId) => {
    navigate(`/drivers/pending/${riderId}`);
  };

  const bikeCount = useMemo(() => {
    return riders.filter(
      (r) => !r.vehicleType || r.vehicleType.toLowerCase().includes("motor") || r.vehicleType.toLowerCase().includes("bike")
    ).length;
  }, [riders]);

  const evCount = useMemo(() => {
    return riders.filter(
      (r) => (r.vehicleType || "").toLowerCase().includes("ev") || (r.vehicleType || "").toLowerCase().includes("electric")
    ).length;
  }, [riders]);

  return (
    <PageShell title={null}>
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-600">
          {error}
        </div>
      )}

      {/* 4 TOP SUMMARY BOXES (COMPACT SLEEK HEIGHT) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: TOTAL PENDING APPLICATIONS */}
        <div className="relative overflow-hidden rounded-xl border border-amber-100/90 bg-gradient-to-br from-amber-50/80 via-orange-50/20 to-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Icon name="clipboard" size="sm" className="text-amber-800" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Pending Review</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {loading ? "…" : riders.length}
              </p>
              <p className="text-[10px] font-semibold text-amber-700 leading-tight mt-0.5">
                Awaiting approval
              </p>
            </div>
          </div>
        </div>

        {/* CARD 2: MOTORCYCLE RIDERS */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/80 via-emerald-50/20 to-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <Icon name="bike" size="sm" className="text-emerald-800" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Motorcycles / Bikes</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {loading ? "…" : bikeCount}
              </p>
              <p className="text-[10px] font-semibold text-emerald-700 leading-tight mt-0.5">
                Two-wheelers
              </p>
            </div>
          </div>
        </div>

        {/* CARD 3: ELECTRIC VEHICLES */}
        <div className="relative overflow-hidden rounded-xl border border-blue-100/90 bg-gradient-to-br from-blue-50/80 via-sky-50/20 to-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Icon name="bike" size="sm" className="text-blue-700" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Electric Vehicles</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {loading ? "…" : evCount}
              </p>
              <p className="text-[10px] font-semibold text-blue-600 leading-tight mt-0.5">
                Green fleet
              </p>
            </div>
          </div>
        </div>

        {/* CARD 4: KYC VERIFICATION */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-slate-50/40 to-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
              <Icon name="check" size="sm" className="text-slate-700" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">KYC Status</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {loading ? "…" : riders.length}
              </p>
              <p className="text-[10px] font-semibold text-slate-600 leading-tight mt-0.5">
                Docs pending
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl bg-slate-200/60 animate-pulse" />
      ) : riders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-700">No pending applications</h3>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <table className="w-full text-left text-sm min-w-[850px]">
            <thead className="bg-[#ecfdf5] border-b border-emerald-100 text-[11px] font-bold text-slate-700 tracking-wider">
              <tr>
                <th className="py-3 px-4">Rider Details</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Bank Account Info</th>
                <th className="py-3 px-4">Applied Date</th>
                <th className="py-3 px-4">Hub / Area</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {riders.map((r) => {
                const riderId = r.id || r._id;
                const bank = r.bankDetails || {};
                const accountDisplay = bank.accountNumber
                  ? `${bank.accountNumber}${bank.bankName ? ` (${bank.bankName})` : ""}`
                  : "Not provided";
                const dateDisplay = r.createdAt
                  ? new Date(r.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Recent";

                const selfieSrc =
                  typeof r.selfie === "string"
                    ? r.selfie
                    : r.selfie?.url || r.selfie?.imageBase64 || "";

                return (
                  <tr
                    key={riderId}
                    onClick={() => handleRowClick(riderId)}
                    className="hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    {/* 1. Rider Details: Compact icon, vertically centered name & phone, no phone icon */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-emerald-50 text-emerald-800 text-xs overflow-hidden">
                          {selfieSrc ? (
                            <img
                              src={selfieSrc}
                              alt={r.name || "Rider"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[11px] font-bold">
                              {(r.name || "R").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                          <span className="font-bold text-slate-900 text-xs group-hover:text-emerald-700 transition leading-tight">
                            {r.name || "New Applicant"}
                          </span>
                          <span className="font-medium text-[11px] text-slate-500 mt-0.5 leading-tight">
                            {r.phone || "—"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Vehicle */}
                    <td className="py-3.5 px-4 font-semibold text-slate-700 capitalize whitespace-nowrap">
                      {r.vehicleType || "Motorcycle"}
                    </td>

                    {/* 3. Bank Info */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{accountDisplay}</span>
                        {bank.accountHolderName && (
                          <span className="block text-[11px] text-slate-400">
                            Holder: {bank.accountHolderName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. Applied Date */}
                    <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                      {dateDisplay}
                    </td>

                    {/* 5. Hub / Area */}
                    <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                      {r.area || manager?.area || "Hub"}
                    </td>

                    {/* 6. Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(riderId);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#064e3b] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#053d2e] transition shadow-2xs cursor-pointer"
                      >
                        Review &amp; Verify
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
