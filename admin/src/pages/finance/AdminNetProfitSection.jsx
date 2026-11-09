import React, { useCallback, useEffect, useState } from 'react';
import { Landmark, Plus, Trash2, Pencil, Check, X, Minus } from 'lucide-react';
import adminFinanceApi from '../../api/adminFinanceApi';

const formatInr = (val) => `₹${Math.round(Number(val || 0)).toLocaleString('en-IN')}`;

const todayIso = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const blankRow = () => ({ key: `${Date.now()}-${Math.random()}`, category: '', amount: '', date: todayIso(), note: '' });

const toPayload = ({ category, amount, date, note }) => {
  const type = category.trim();
  return {
    title: note.trim() || type,
    category: type,
    amount: Number(amount),
    date,
    notes: note.trim(),
  };
};

const INPUT =
  'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none';

/**
 * Admin Net Profit = commission earned from vendors + delivered sales of the admin's own
 * vendors − GreenGrocc's own expenses (Finance → Expense Transactions; any type can be added).
 */
export default function AdminNetProfitSection({ dateParams }) {
  const [data, setData] = useState({
    commission: 0,
    ownVendorDelivered: 0,
    ownVendorNames: [],
    totalExpenses: 0,
    byCategory: [],
    entries: [],
    categories: [],
    netProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([blankRow()]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const paramsKey = JSON.stringify(dateParams);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFinanceApi.getAdminNetProfit(JSON.parse(paramsKey));
      setData({
        commission: Number(res?.commission || 0),
        ownVendorDelivered: Number(res?.ownVendorDelivered || 0),
        ownVendorNames: res?.ownVendorNames || [],
        totalExpenses: Number(res?.totalExpenses || 0),
        byCategory: res?.byCategory || [],
        entries: res?.entries || [],
        categories: res?.categories || [],
        netProfit: Number(res?.netProfit || 0),
      });
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load admin net profit');
    } finally {
      setLoading(false);
    }
  }, [paramsKey]);

  useEffect(() => {
    load();
  }, [load]);

  const { commission, ownVendorDelivered: ownSales, ownVendorNames, netProfit } = data;

  const filledRows = rows.filter((r) => r.category.trim() || r.amount !== '');
  const rowsValid =
    filledRows.length > 0 &&
    filledRows.every((r) => r.category.trim() && Number(r.amount) > 0 && r.date);
  const newTotal = filledRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const updateRow = (key, field, value) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const saveRows = async () => {
    if (!rowsValid) {
      setError('Each expense needs a type, an amount above 0 and a date');
      return;
    }
    setSaving(true);
    setError('');
    try {
      for (const row of filledRows) {
        await adminFinanceApi.addPlatformExpense(toPayload(row));
      }
      setRows([blankRow()]);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save expenses');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing.category.trim() || !(Number(editing.amount) > 0) || !editing.date) {
      setError('Each expense needs a type, an amount above 0 and a date');
      return;
    }
    try {
      await adminFinanceApi.updatePlatformExpense(editing.id, toPayload(editing));
      setEditing(null);
      setError('');
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update expense');
    }
  };

  const remove = async (entry) => {
    if (!window.confirm(`Delete expense "${entry.title}" (${formatInr(entry.amount)})?`)) return;
    try {
      await adminFinanceApi.deletePlatformExpense(entry._id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete expense');
    }
  };

  return (
    <div className="rounded-xl border border-teal-300 bg-white p-4 shadow-xs space-y-4">
      <datalist id="admin-expense-types">
        {data.categories.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div className="flex items-start gap-2 border-b border-slate-100 pb-3">
        <span className="rounded-lg bg-teal-50 p-1.5 text-teal-700">
          <Landmark className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">ADMIN NET PROFIT (आपला नफा)</h3>
          <p className="text-[11px] text-slate-500">
            Vendors' commission + delivered product sales of your own vendor − expenses you add, for the selected date
            filter.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Calculation */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm">
          <div className="flex items-center justify-between py-1.5">
            <span className="font-semibold text-slate-700">Vendors' commission</span>
            <span className="font-bold tabular-nums text-indigo-700">
              {loading ? '...' : `+ ${formatInr(commission)}`}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="font-semibold text-slate-700">
              Delivered products of admin's vendor
              {ownVendorNames.length ? (
                <span className="ml-1 text-[10px] font-normal text-slate-400">({ownVendorNames.join(', ')})</span>
              ) : null}
            </span>
            <span className="font-bold tabular-nums text-emerald-700">
              {loading ? '...' : `+ ${formatInr(ownSales)}`}
            </span>
          </div>
          {!loading && !ownVendorNames.length ? (
            <p className="pb-1.5 text-[10px] text-amber-700">
              No vendor is marked as the admin's own yet. Tick "Admin's own vendor" when editing that vendor in Vendors.
            </p>
          ) : null}
          <div className="my-1 border-t border-dashed border-slate-300" />

          {loading ? (
            <p className="py-2 text-xs text-slate-400">Loading expenses…</p>
          ) : data.byCategory.length === 0 ? (
            <p className="py-2 text-xs text-slate-400">No expenses in this period. Add them on the right.</p>
          ) : (
            data.byCategory.map((group) => (
              <div key={group.category} className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">
                  {group.category}
                  <span className="ml-1 text-[10px] text-slate-400">({group.count})</span>
                </span>
                <span className="font-semibold tabular-nums text-rose-600">− {formatInr(group.total)}</span>
              </div>
            ))
          )}

          <div className="mt-2 flex items-center justify-between border-t-2 border-slate-300 pt-2">
            <span className="font-bold text-slate-900">= Admin Net Profit</span>
            <span
              className={`text-xl font-bold tabular-nums ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
            >
              {loading ? '...' : formatInr(netProfit)}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            {formatInr(commission)} + {formatInr(ownSales)} − {formatInr(data.totalExpenses)} expenses
          </p>
        </div>

        {/* Add expenses */}
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Add expenses (minus from profit)</p>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="grid grid-cols-12 gap-1.5">
                <input
                  list="admin-expense-types"
                  placeholder="Expense type"
                  value={row.category}
                  onChange={(e) => updateRow(row.key, 'category', e.target.value)}
                  className={`${INPUT} col-span-4`}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="₹ Amount"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, 'amount', e.target.value)}
                  className={`${INPUT} col-span-2`}
                />
                <input
                  type="date"
                  value={row.date}
                  onChange={(e) => updateRow(row.key, 'date', e.target.value)}
                  className={`${INPUT} col-span-3`}
                />
                <input
                  placeholder="Note"
                  value={row.note}
                  onChange={(e) => updateRow(row.key, 'note', e.target.value)}
                  className={`${INPUT} col-span-2`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== row.key) : [blankRow()]))
                  }
                  className="col-span-1 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  title="Remove row"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, blankRow()])}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add another expense
            </button>
            <button
              type="button"
              onClick={saveRows}
              disabled={saving || !filledRows.length}
              className="rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : `Save ${filledRows.length || ''} expense${filledRows.length === 1 ? '' : 's'} (− ${formatInr(newTotal)})`}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            Type any expense name; every type you save is offered in the list next time.
          </p>
        </div>
      </div>

      {/* Expense entries */}
      {data.entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.entries.map((entry) =>
                editing?.id === entry._id ? (
                  <tr key={entry._id} className="bg-teal-50/40">
                    <td className="px-3 py-1.5">
                      <input
                        type="date"
                        value={editing.date}
                        onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                        className={INPUT}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        list="admin-expense-types"
                        value={editing.category}
                        onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                        className={INPUT}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={editing.note}
                        onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                        className={INPUT}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={editing.amount}
                        onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                        className={`${INPUT} w-24 text-right`}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <button type="button" onClick={saveEdit} className="rounded p-1 text-emerald-700 hover:bg-emerald-50" title="Save">
                        <Check className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Cancel">
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={entry._id}>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{entry.category || 'Other'}</td>
                    <td className="px-3 py-2 text-slate-500">{entry.notes || (entry.title !== entry.category ? entry.title : '') || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-600">− {formatInr(entry.amount)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            id: entry._id,
                            category: entry.category || '',
                            amount: String(entry.amount ?? ''),
                            date: entry.date ? String(entry.date).slice(0, 10) : todayIso(),
                            note: entry.notes || (entry.title !== entry.category ? entry.title : '') || '',
                          })
                        }
                        className="rounded p-1 text-slate-500 hover:bg-slate-100"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(entry)}
                        className="rounded p-1 text-rose-500 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
