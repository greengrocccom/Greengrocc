import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, UserPlus, X } from 'lucide-react';
import apiClient from '../../api/client';
import { PANEL, TH } from '../../utils/ui';

const todayIst = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const INCENTIVE_OPTIONS = [
  { id: 'none', label: 'No incentive' },
  { id: 'per_km', label: '₹ per KM delivered' },
  { id: 'per_hour', label: '₹ per hour online' },
];

const incentiveLabel = (slot) =>
  slot?.incentiveMode === 'per_km' && slot.incentiveRate > 0
    ? `₹${slot.incentiveRate} / km${slot.incentiveAfterKm > 0 ? ` after ${slot.incentiveAfterKm} km` : ''}`
    : slot?.incentiveMode === 'per_hour' && slot.incentiveRate > 0
      ? `₹${slot.incentiveRate} / hr`
      : '—';

const blankSlot = () => ({ startTime: '09:00 AM', endTime: '01:00 PM', capacity: 10, incentiveMode: 'none', incentiveRate: '', incentiveAfterKm: '' });

const input = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800';

/** Admin view of a dark store's delivery slots: create with incentive, assign riders, remove riders. */
export default function AdminSlotsPanel({ managerId }) {
  const base = `/admin-ops/delivery/managers/${managerId}`;
  const [date, setDate] = useState(todayIst());
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [assignSlot, setAssignSlot] = useState(null);
  const [detail, setDetail] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`${base}/shifts`, { params: { date, filter: 'all' } });
      setShifts(res.data?.shifts || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load slots');
    } finally {
      setLoading(false);
    }
  }, [base, date]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () =>
      shifts.flatMap((shift) =>
        (shift.slots || []).map((slot) => ({ shift, slot }))
      ),
    [shifts]
  );

  const openDetail = async (slotId) => {
    try {
      const res = await apiClient.get(`${base}/shifts/slots/${slotId}/details`);
      setDetail(res.data);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to load slot');
    }
  };

  const removeRider = async (rider) => {
    if (!detail?.slotId || !window.confirm(`Remove ${rider.deliveryPartnerName} from this slot?`)) return;
    try {
      const res = await apiClient.delete(`${base}/shifts/slots/${detail.slotId}/assign/${rider.deliveryPartnerId}`);
      flash(res.data?.message || 'Removed');
      await Promise.all([openDetail(detail.slotId), load()]);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to remove');
    }
  };

  const deleteSlot = async (slotId) => {
    if (!window.confirm('Delete this slot for this date? Assigned riders will be told it was cancelled.')) return;
    try {
      const res = await apiClient.delete(`${base}/shifts/slots/${slotId}`, { data: { scope: 'this_date' } });
      flash(res.data?.message || 'Slot deleted');
      await load();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to delete slot');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} w-auto`} />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          <Plus className="h-3.5 w-3.5" /> Create slots
        </button>
      </div>

      {toast ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{toast}</p> : null}
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}

      <div className={PANEL}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F2F2F2]">
              <tr>
                {['Shift', 'Time', 'Status', 'Assigned', 'Incentive', ''].map((h) => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading slots
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">No slots for this date</td>
                </tr>
              ) : (
                rows.map(({ shift, slot }) => {
                  const expired = slot.isExpired || slot.lifecycle === 'past';
                  return (
                    <tr key={slot.id} className="border-b border-slate-100 last:border-0 hover:bg-[#F9F9F9]">
                      <td className="px-3 py-2.5 font-semibold">{shift.name}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold">{slot.startTime} – {slot.endTime}</td>
                      <td className="px-3 py-2.5 text-xs">{slot.statusLabel || (expired ? 'Expired' : slot.status)}</td>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => openDetail(slot.id)} className="text-xs font-semibold text-[#217346] hover:underline">
                          {slot.bookedCount || 0} assigned · View
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-amber-700">{incentiveLabel(slot)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {!expired && slot.status !== 'CANCELLED' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setAssignSlot({
                                ...slot,
                                dateString: shift.dateString,
                                assignedRiderIds: (slot.bookings || [])
                                  .filter((b) => b.status !== 'CANCELLED')
                                  .map((b) => b.deliveryPartnerId),
                              })
                            }
                            className="mr-2 inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Assign
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => deleteSlot(slot.id)}
                          className="inline-flex items-center rounded-lg border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                          title="Delete slot"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating ? (
        <CreateSlotsModal
          base={base}
          defaultDate={date}
          onClose={() => setCreating(false)}
          onCreated={async (msg) => {
            setCreating(false);
            flash(msg);
            await load();
          }}
        />
      ) : null}

      {assignSlot ? (
        <AssignModal
          base={base}
          slot={assignSlot}
          onClose={() => setAssignSlot(null)}
          onAssigned={async (msg) => {
            setAssignSlot(null);
            flash(msg);
            await load();
          }}
        />
      ) : null}

      {detail ? (
        <Modal title={`${detail.shiftName || 'Slot'} · ${detail.startTime} – ${detail.endTime}`} onClose={() => setDetail(null)}>
          <p className="text-xs text-slate-500">
            {detail.dateString} · {detail.statusLabel} · Incentive {incentiveLabel(detail)}
          </p>
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
            {(detail.deliveryPartners || []).length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">No delivery partners assigned yet</p>
            ) : (
              detail.deliveryPartners.map((r) => (
                <div key={r.bookingId} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{r.deliveryPartnerName}</p>
                    <p className="text-slate-500">
                      {r.deliveryPartnerPhone} · {r.status} · Done {r.ordersCompleted ?? 0}
                    </p>
                  </div>
                  {!r.notBookedOnSlot && !detail.isExpired && r.status !== 'COMPLETED' ? (
                    <button type="button" onClick={() => removeRider(r)} className="font-semibold text-rose-600 hover:underline">
                      Remove
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className={`flex max-h-[90vh] w-full flex-col rounded-2xl bg-white p-5 shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function CreateSlotsModal({ base, defaultDate, onClose, onCreated }) {
  const [name, setName] = useState('Custom Shift');
  const [recurrenceMode, setRecurrenceMode] = useState('single_day');
  const [targetDate, setTargetDate] = useState(defaultDate);
  const [slots, setSlots] = useState([blankSlot()]);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState('month');
  const [riders, setRiders] = useState([]);
  const [ridersLoading, setRidersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    apiClient
      .get(`${base}/assignable-riders`)
      .then((res) => alive && setRiders(res.data?.riders || []))
      .catch(() => alive && setRiders([]))
      .finally(() => alive && setRidersLoading(false));
    return () => {
      alive = false;
    };
  }, [base]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter((r) => (r.name || '').toLowerCase().includes(q) || String(r.phone || '').includes(q));
  }, [riders, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const toggleRider = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((r) => (allFilteredSelected ? next.delete(r.id) : next.add(r.id)));
      return next;
    });

  const update = (idx, field, value) =>
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(salaryAmount) > 0)) {
      setError('Enter the salary (₹) for this slot');
      return;
    }
    if (selected.size === 0) {
      setError('Select at least one driver for this slot');
      return;
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.incentiveMode !== 'none' && !(Number(s.incentiveRate) > 0)) {
        setError(`Slot ${i + 1}: enter the incentive amount or choose "No incentive"`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.post(`${base}/shifts`, {
        name,
        type: 'custom',
        recurrenceMode,
        targetDate,
        customSlots: slots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          capacity: parseInt(s.capacity, 10) || 10,
          incentiveMode: s.incentiveMode,
          incentiveRate: s.incentiveMode === 'none' ? 0 : Number(s.incentiveRate) || 0,
          incentiveAfterKm: s.incentiveMode === 'per_km' ? Number(s.incentiveAfterKm) || 0 : 0,
        })),
        salaryAmount: Math.round(Number(salaryAmount)),
        salaryPeriod,
        riderIds: [...selected],
      });
      onCreated(res.data?.message || 'Slots created');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create slots');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Create delivery slots" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-500">
            Shift name
            <input value={name} onChange={(e) => setName(e.target.value)} required className={`${input} mt-1`} />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Repeat
            <select value={recurrenceMode} onChange={(e) => setRecurrenceMode(e.target.value)} className={`${input} mt-1`}>
              <option value="single_day">Single day</option>
              <option value="full_week">Next 7 days</option>
              <option value="full_month">Whole month</option>
            </select>
          </label>
          {recurrenceMode === 'single_day' ? (
            <label className="text-xs font-semibold text-slate-500">
              Date
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={`${input} mt-1`} />
            </label>
          ) : null}
        </div>

        <div className="space-y-2">
          {slots.map((s, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-7">
              <input value={s.startTime} onChange={(e) => update(idx, 'startTime', e.target.value)} placeholder="06:00 AM" className={input} />
              <input value={s.endTime} onChange={(e) => update(idx, 'endTime', e.target.value)} placeholder="10:00 AM" className={input} />
              <input type="number" min="1" value={s.capacity} onChange={(e) => update(idx, 'capacity', e.target.value)} placeholder="Capacity" className={input} />
              <select value={s.incentiveMode} onChange={(e) => update(idx, 'incentiveMode', e.target.value)} className={input}>
                {INCENTIVE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.5"
                disabled={s.incentiveMode === 'none'}
                value={s.incentiveRate}
                onChange={(e) => update(idx, 'incentiveRate', e.target.value)}
                placeholder={s.incentiveMode === 'per_hour' ? '₹ / hour' : '₹ / km'}
                className={`${input} disabled:opacity-40`}
              />
              <input
                type="number"
                min="0"
                step="0.5"
                disabled={s.incentiveMode !== 'per_km'}
                value={s.incentiveMode === 'per_km' ? s.incentiveAfterKm : ''}
                onChange={(e) => update(idx, 'incentiveAfterKm', e.target.value)}
                placeholder="Pay after km"
                title="Km the rider must deliver in this slot before each further km is paid"
                className={`${input} disabled:opacity-40`}
              />
              <button
                type="button"
                disabled={slots.length <= 1}
                onClick={() => setSlots((prev) => prev.filter((_, i) => i !== idx))}
                className="rounded-lg border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSlots((prev) => [...prev, blankSlot()])}
            className="text-xs font-semibold text-[#217346] hover:underline"
          >
            + Add time slot
          </button>
          <p className="text-[11px] text-slate-400">Times like 06:00 AM / 02:30 PM. Capacity grows automatically if you assign more riders.</p>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Salary (₹)
          <div className="mt-1 flex max-w-sm gap-2">
            <input
              type="number"
              min="0"
              step="any"
              required
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              placeholder={salaryPeriod === 'day' ? 'e.g. 500' : salaryPeriod === 'week' ? 'e.g. 3500' : 'e.g. 15000'}
              className={input}
            />
            <select value={salaryPeriod} onChange={(e) => setSalaryPeriod(e.target.value)} className={`${input} w-32`}>
              <option value="day">Per day</option>
              <option value="week">Per week</option>
              <option value="month">Per month</option>
            </select>
          </div>
          <span className="mt-1 block text-[11px] font-normal text-slate-400">
            Fixed pay for drivers on this slot. Hour / KM incentives are credited on top, instantly.
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-500">Assign drivers</p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {selected.size} selected
            </span>
          </div>
          <div className="flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" className={input} />
            <button
              type="button"
              onClick={toggleAllFiltered}
              disabled={filtered.length === 0}
              className="shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              {allFilteredSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {ridersLoading ? (
              <p className="py-6 text-center text-xs text-slate-400">Loading drivers…</p>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                {riders.length === 0 ? 'No active drivers under this manager' : 'No driver matches your search'}
              </p>
            ) : (
              filtered.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-xs ${selected.has(r.id) ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                >
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRider(r.id)} className="h-4 w-4 accent-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{r.name || 'Unnamed driver'}</p>
                    <p className="text-slate-500">{r.phone || '—'}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {saving ? 'Creating…' : 'Create slots'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignModal({ base, slot, onClose, onAssigned }) {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const assigned = useMemo(() => new Set((slot.assignedRiderIds || []).map(String)), [slot]);

  useEffect(() => {
    let alive = true;
    apiClient
      .get(`${base}/assignable-riders`)
      .then((res) => alive && setRiders(res.data?.riders || []))
      .catch((err) => alive && setError(err.response?.data?.message || 'Failed to load delivery partners'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [base]);

  const submit = async (body) => {
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.post(`${base}/shifts/slots/${slot.id}/assign`, body);
      onAssigned(res.data?.message || 'Assigned');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal title={`Assign · ${slot.dateString} · ${slot.startTime} – ${slot.endTime}`} onClose={onClose}>
      {error ? <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
      <button
        type="button"
        disabled={saving || loading}
        onClick={() => submit({ all: true })}
        className="mb-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        Assign to all delivery partners of this store ({riders.length})
      </button>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
        {loading ? (
          <p className="py-8 text-center text-xs text-slate-400">Loading…</p>
        ) : riders.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">No delivery partners under this Delivery Manager</p>
        ) : (
          riders.map((r) => {
            const id = String(r.id);
            const isAssigned = assigned.has(id);
            return (
              <label key={id} className={`flex items-center gap-3 px-3 py-2 text-xs ${isAssigned ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                <input type="checkbox" disabled={isAssigned} checked={isAssigned || selected.has(id)} onChange={() => toggle(id)} />
                <span className="flex-1">
                  <span className="font-semibold text-slate-800">{r.name}</span>
                  <span className="ml-2 text-slate-500">{r.phone}</span>
                </span>
                <span className="text-[10px] font-semibold uppercase text-slate-400">{isAssigned ? 'Assigned' : r.status}</span>
              </label>
            );
          })
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || selected.size === 0}
          onClick={() => submit({ riderIds: [...selected] })}
          className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Assigning…' : `Assign selected (${selected.size})`}
        </button>
      </div>
    </Modal>
  );
}
