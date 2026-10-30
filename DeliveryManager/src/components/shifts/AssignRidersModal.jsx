import { useEffect, useMemo, useState } from "react";

/**
 * Assign a slot to all or selected delivery partners.
 * `loadRiders()` → axios response with { riders }, `assign(body)` → axios response.
 */
export default function AssignRidersModal({ slot, loadRiders, assign, onClose, onAssigned }) {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const alreadyAssigned = useMemo(
    () => new Set((slot?.assignedRiderIds || []).map(String)),
    [slot]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadRiders();
        if (!cancelled) setRiders(res.data?.riders || res.data?.data?.riders || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load delivery partners");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRiders]);

  const filtered = riders.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${r.name} ${r.phone}`.toLowerCase().includes(q);
  });
  const selectable = filtered.filter((r) => !alreadyAssigned.has(String(r.id)));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (body) => {
    setSaving(true);
    setError("");
    try {
      const res = await assign(body);
      onAssigned?.(res.data?.message || "Slot assigned");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to assign slot");
    } finally {
      setSaving(false);
    }
  };

  const incentiveText =
    slot?.incentiveMode === "per_km"
      ? `₹${slot.incentiveRate}/km incentive${slot.incentiveAfterKm > 0 ? ` after ${slot.incentiveAfterKm} km` : ""}`
      : slot?.incentiveMode === "per_hour"
        ? `₹${slot.incentiveRate}/hr incentive`
        : "No incentive";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Assign delivery partners</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {slot?.dateString} · {slot?.startTime} – {slot?.endTime} · {incentiveText}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={saving || loading}
          onClick={() => submit({ all: true })}
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Assign to all delivery partners ({riders.length})
        </button>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone"
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
          />
          <button
            type="button"
            onClick={() =>
              setSelected((prev) =>
                prev.size === selectable.length ? new Set() : new Set(selectable.map((r) => String(r.id)))
              )
            }
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            {selected.size && selected.size === selectable.length ? "Clear" : "Select all"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50 min-h-[160px]">
          {loading ? (
            <p className="py-10 text-center text-xs text-slate-400 font-semibold">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400 font-semibold">
              No delivery partners under this Delivery Manager.
            </p>
          ) : (
            filtered.map((r) => {
              const id = String(r.id);
              const assigned = alreadyAssigned.has(id);
              return (
                <label
                  key={id}
                  className={`flex items-center gap-3 px-3 py-2.5 text-xs ${
                    assigned ? "opacity-50" : "cursor-pointer hover:bg-emerald-50/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={assigned}
                    checked={assigned || selected.has(id)}
                    onChange={() => toggle(id)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-500">{r.phone}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    {assigned ? "Assigned" : r.status}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || selected.size === 0}
            onClick={() => submit({ riderIds: [...selected] })}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Assigning…" : `Assign selected (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
