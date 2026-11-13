import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';

function RoleListScreen() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await opsApi.list('policies/roles');
      setRoles(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className={PAGE_TITLE}>Policy Management</h1>
          <p className={PAGE_SUB}>
            Choose a role to manage policies. <strong>Users (Frontend site)</strong> controls
            what customers see on the website (/policies, Privacy, Terms). Other roles update
            their staff panels.
          </p>
        </div>
        <button type="button" onClick={load} className={BTN}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className={PANEL}>
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => {
              const isUsers = role.roleKey === 'customer';
              return (
              <button
                key={role.roleKey}
                type="button"
                onClick={() => navigate(`/policy-management/${role.roleKey}`)}
                className={`group flex items-start justify-between gap-3 rounded-2xl border bg-white p-4 text-left transition hover:shadow-sm ${
                  isUsers
                    ? 'border-emerald-300 ring-1 ring-emerald-100 hover:border-emerald-400'
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900 group-hover:text-emerald-800">
                    {role.label}
                  </p>
                  {isUsers ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                      Customer website · frontend
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {role.total} polic{role.total === 1 ? 'y' : 'ies'} · {role.published} published
                    {role.draft ? ` · ${role.draft} draft` : ''}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Updated{' '}
                    {role.updatedAt
                      ? new Date(role.updatedAt).toLocaleDateString('en-IN')
                      : '—'}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 group-hover:text-emerald-600" />
              </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RolePoliciesScreen({ roleKey }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [roleLabel, setRoleLabel] = useState(roleKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', status: 'published', pageKey: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await opsApi.list('policies', { roleKey });
      setRows(res.data || []);
      if (res.role?.label) setRoleLabel(res.role.label);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [roleKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', body: '', status: 'published', pageKey: '' });
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      title: row.title || '',
      body: row.body || '',
      status: row.status || 'published',
      pageKey: row.pageKey || '',
    });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, roleKey };
      if (editing?._id) {
        await opsApi.update('policies', editing._id, payload);
      } else {
        await opsApi.create('policies', payload);
      }
      setOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save policy');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete policy "${row.title}"?`)) return;
    try {
      await opsApi.remove('policies', row._id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete policy');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate('/policy-management')}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            All roles
          </button>
          <h1 className={PAGE_TITLE}>{roleLabel} policies</h1>
          <p className={PAGE_SUB}>
            {roleKey === 'customer'
              ? 'Published policies appear on the Users website: /policies, Privacy Policy, and Terms & Conditions. Publish the "About Us page" entry to replace the website About Us content.'
              : `Add, edit, or delete policies for this role. Published items show in the ${roleLabel} panel.`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className={BTN}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </button>
          <button type="button" onClick={openCreate} className={BTN_PRIMARY}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add policy
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className={PANEL}>
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F2F2F2]">
                <tr>
                  {['Title', 'Status', 'Updated', ''].map((h) => (
                    <th key={h || 'actions'} className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-slate-400">
                      No policies for this role yet. Click Add policy to create one.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row._id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900">{row.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 whitespace-pre-wrap">
                          {row.body || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">
                        {row.updatedAt
                          ? new Date(row.updatedAt).toLocaleDateString('en-IN')
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            className={`${BTN} h-8 min-h-0 px-2.5 text-xs`}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${BTN} h-8 min-h-0 px-2.5 text-xs text-rose-600 hover:bg-rose-50`}
                            onClick={() => remove(row)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={save} className={`max-h-[92vh] w-full max-w-2xl overflow-y-auto ${PANEL} p-5`}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-bold">
                {editing ? 'Edit policy' : `Add policy · ${roleLabel}`}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                Title
                <input
                  required
                  autoFocus
                  className={`${INPUT} mt-1.5`}
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Privacy Policy"
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">
                  Editable anytime — this heading is shown on the site / role panel.
                </span>
              </label>
              {roleKey === 'customer' ? (
                <label className="block text-xs font-semibold text-slate-600">
                  Website page (optional)
                  <select
                    className={`${INPUT} mt-1.5`}
                    value={form.pageKey || ''}
                    onChange={(e) => setForm((p) => ({ ...p, pageKey: e.target.value }))}
                  >
                    <option value="">General (/policies list only)</option>
                    <option value="terms">Terms &amp; Conditions page</option>
                    <option value="privacy">Privacy Policy page</option>
                    <option value="refund">Return &amp; Refund Policy page</option>
                    <option value="shipping">Shipping &amp; Delivery page</option>
                    <option value="about">About Us page</option>
                  </select>
                  <span className="mt-1 block text-[11px] font-normal text-slate-400">
                    Keeps the page linked even if you rename the title.
                  </span>
                </label>
              ) : null}
              <label className="block text-xs font-semibold text-slate-600">
                Policy content
                <textarea
                  required
                  rows={12}
                  className={`${INPUT} mt-1.5 font-mono text-[13px]`}
                  value={form.body}
                  onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  placeholder="Write the full policy text…"
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">
                  Formatting: start a line with <code>## </code> for a heading, <code>- </code> for a bullet,
                  or <code>1. </code> for a numbered step. Other lines show as paragraphs.
                </span>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Status
                <select
                  className={`${INPUT} mt-1.5`}
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="published">
                    Published (visible on site / panel)
                  </option>
                  <option value="draft">Draft (hidden)</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Saving…' : editing ? 'Update policy' : 'Create policy'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function PolicyManagement() {
  const { roleKey } = useParams();
  if (roleKey) {
    return <RolePoliciesScreen roleKey={roleKey} />;
  }
  return <RoleListScreen />;
}
