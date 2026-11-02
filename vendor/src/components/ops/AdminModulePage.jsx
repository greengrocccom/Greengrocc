import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';

export default function AdminModulePage({
  title,
  description,
  icon: Icon,
  path,
  columns,
  fields,
  defaults = {},
  idKey = '_id',
  searchKeys = [],
  statusFilters = [],
  createLabel = 'Add',
  transformItem,
}) {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaults);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await opsApi.list(path, status !== 'all' ? { status } : {});
      const data = Array.isArray(res.data) ? res.data : [];
      setRows(transformItem ? data.map(transformItem) : data);
      setStats(res.stats || null);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [path, status, title, transformItem]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      searchKeys.some((key) => String(row[key] || '').toLowerCase().includes(q))
    );
  }, [rows, search, searchKeys]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaults);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    const next = { ...defaults };
    fields.forEach((field) => {
      next[field.name] = row[field.name] ?? defaults[field.name] ?? '';
    });
    setForm(next);
    setModalOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await opsApi.update(path, editing[idKey], form);
      } else {
        await opsApi.create(path, form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete this ${title.toLowerCase().replace(/s$/, '')}?`)) return;
    try {
      await opsApi.remove(path, row[idKey]);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={PAGE_TITLE}>{title}</h1>
          <p className={`mt-0.5 ${PAGE_SUB}`}>{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className={`${BTN} gap-1.5 text-xs`}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button type="button" onClick={openCreate} className={`${BTN_PRIMARY} gap-1.5 text-xs`}>
            <Plus className="h-3.5 w-3.5" /> {createLabel}
          </button>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Object.entries(stats)
            .slice(0, 4)
            .map(([key, value]) => (
              <div key={key} className={`${PANEL} px-4 py-3`}>
                <p className="text-xs text-[#6B7280]">{key}</p>
                <p className="mt-1 text-lg font-bold text-[#1F2937]">
                  {typeof value === 'number' ? value.toLocaleString('en-IN') : String(value)}
                </p>
              </div>
            ))}
        </div>
      ) : null}

      <div className={`${PANEL} flex flex-col gap-2 p-3 sm:flex-row sm:items-center`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className={`${INPUT} pl-9`}
          />
        </div>
        {statusFilters.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {['all', ...statusFilters].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize ${
                  status === item
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className={`overflow-hidden ${PANEL}`}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">No records yet. Create the first one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 font-semibold">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row[idKey]} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-slate-700">
                        {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className={`max-h-[90vh] w-full max-w-lg overflow-y-auto ${PANEL} p-5`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editing ? `Edit ${title}` : createLabel}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {fields.map((field) => (
                <label key={field.name} className="block text-xs font-semibold text-slate-600">
                  {field.label}
                  {field.type === 'select' ? (
                    <select
                      value={form[field.name] ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      className={`${INPUT} mt-1`}
                    >
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={form[field.name] ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      className={`${INPUT} mt-1`}
                      rows={3}
                    />
                  ) : field.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(form[field.name])}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.checked }))}
                      className="ml-2 align-middle"
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={form[field.name] ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      className={`${INPUT} mt-1`}
                      required={field.required}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className={BTN}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={`${BTN_PRIMARY} gap-2`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
