import { useEffect, useState } from 'react';
import { Pencil, Trash2, RefreshCw, X } from 'lucide-react';
import { opsApi } from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PANEL, PAGE_TITLE, PAGE_SUB } from '../../utils/ui';

const TYPES = [
  ['vendor', 'Multivendors'], ['farmer', 'Farmers'], ['farmer_manager', 'Farmer Managers'],
  ['pickup_driver', 'Pickup Drivers'], ['delivery_manager', 'Dark Store / Delivery Managers'],
  ['delivery_boy', 'Delivery Partners'], ['staff', 'Staff: all roles'],
  ['user', 'Customers & Legacy Accounts'], ['admin', 'Admin Accounts'],
];
const label = role => String(role).replaceAll('_', ' ');
export default function LoginAccountsPage() {
  const [type, setType] = useState('vendor');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, pages: 0, roles: [] });
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({});
  const [vendors, setVendors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const data = await opsApi.list(`login-accounts/${type}`, { search, page });
        if (!cancelled) {
          if (page > 1 && page > data.pages) setPage(Math.max(1, data.pages));
          else setResult(data);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load accounts');
      } finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [type, search, page, revision]);

  const openEdit = async row => {
    setEditing(row); setForm({ ...row, password: '' }); setModalError(''); setVendors([]);
    if (type === 'delivery_manager') {
      try { const data = await opsApi.list('vendors'); setVendors((data.data || []).filter(v => v.status === 'Active')); }
      catch { setModalError('Could not load multivendors. Close this form and try again.'); }
    }
  };
  const save = async event => {
    event.preventDefault(); setBusy(true); setModalError('');
    const payload = {};
    for (const field of ['name', 'email', 'phone', 'role', 'vendorName', 'storeName', 'vendorId']) {
      if (form[field] !== editing[field]) payload[field] = form[field];
    }
    if (form.password) payload.password = form.password;
    try {
      await opsApi.update(`login-accounts/${type}`, editing.id, payload);
      setEditing(null); setNotice('Account updated'); setRevision(v => v + 1);
    } catch (err) { setModalError(err.response?.data?.message || 'Could not update account'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setModalError('');
    try {
      const data = await opsApi.remove(`login-accounts/${type}`, deleting.id);
      setDeleting(null); setNotice(data.message || 'Account deleted'); setRevision(v => v + 1);
    } catch (err) { setModalError(err.response?.data?.message || 'Could not delete account'); }
    finally { setBusy(false); }
  };
  const close = () => { if (!busy) { setEditing(null); setDeleting(null); setModalError(''); } };
  const field = (key, title, inputType = 'text') => <label className="block text-sm font-medium text-slate-700">
    {title}<input className={`${INPUT} mt-1 w-full`} type={inputType} value={form[key] || ''}
      autoComplete={key === 'password' ? 'new-password' : 'off'}
      minLength={key === 'password' ? 6 : undefined} required={key === 'name' || key === 'phone'}
      onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} />
  </label>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className={PAGE_TITLE}>All Login Accounts</h1><p className={PAGE_SUB}>Edit account details, reset passwords and delete logins across every role.</p></div>
      <button className={BTN} onClick={() => setRevision(v => v + 1)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</button>
    </div>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className={`${PANEL} flex flex-wrap gap-3 p-4`}>
      <label className="min-w-56 flex-1 text-xs font-semibold text-slate-600">Account type
        <select className={`${INPUT} mt-1 w-full`} value={type} onChange={e => { setType(e.target.value); setPage(1); setNotice(''); }}>
          {TYPES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
        </select>
      </label>
      <label className="min-w-56 flex-1 text-xs font-semibold text-slate-600">Search accounts
        <input className={`${INPUT} mt-1 w-full`} type="search" placeholder="Name, mobile, email or role" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </label>
    </div>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p> :
      <div className={`${PANEL} overflow-x-auto`}>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Account', 'Role', 'Mobile', 'Email', 'Actions'].map(h => <th className="p-4" key={h}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td className="p-8 text-center" colSpan={5}>Loading accounts…</td></tr> : result.data.length === 0 ? <tr><td className="p-8 text-center text-slate-500" colSpan={5}>No accounts found.</td></tr> : result.data.map(row => <tr key={row.id}>
              <td className="p-4"><div className="font-semibold text-slate-900">{row.name || row.storeName || row.vendorName || 'Unnamed account'}</div><div className="text-xs text-slate-500">{row.vendorName || row.storeName || row.businessId}</div></td>
              <td className="p-4 capitalize">{label(row.role)}</td><td className="p-4">{row.phone || '—'}</td><td className="p-4">{row.email || '—'}</td>
              <td className="p-4"><div className="flex gap-2">
                <button className={BTN} onClick={() => openEdit(row)} aria-label={`Edit ${row.name || row.phone}`}><Pencil className="mr-1 h-4 w-4" />Edit</button>
                <button className={`${BTN} text-red-700`} onClick={() => { setDeleting(row); setModalError(''); }} aria-label={`Delete ${row.name || row.phone}`}><Trash2 className="mr-1 h-4 w-4" />Delete</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
        <div className="flex items-center justify-between gap-3 border-t p-4 text-sm text-slate-500">
          <span>{loading ? 'Loading…' : `${result.total} accounts · Page ${page} of ${Math.max(1, result.pages)}`}</span>
          <div className="flex gap-2"><button className={BTN} disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><button className={BTN} disabled={loading || page >= result.pages} onClick={() => setPage(p => p + 1)}>Next</button></div>
        </div>
      </div>}
    {(editing || deleting) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h2 id="account-dialog-title" className="text-lg font-bold">{editing ? 'Edit login account' : 'Delete login account?'}</h2><button className={BTN} disabled={busy} onClick={close} aria-label="Close"><X className="h-4 w-4" /></button></div>
        {modalError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{modalError}</p>}
        {editing ? <form onSubmit={save} className="space-y-4">
          {field('name', type === 'vendor' ? 'Owner name' : 'Name')}{field('phone', 'Mobile number', 'tel')}
          {type !== 'delivery_boy' && type !== 'pickup_driver' && field('email', 'Email', 'email')}
          {type === 'vendor' && field('vendorName', 'Multivendor name')}
          {type === 'delivery_manager' && <>{field('storeName', 'Dark store name')}<label className="block text-sm font-medium text-slate-700">Multivendor owner<select className={`${INPUT} mt-1 w-full`} value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}><option value={editing.vendorId}>{editing.vendorId || 'Unassigned'}</option>{vendors.filter(v => v.id !== editing.vendorId).map(v => <option key={v.id} value={v.id}>{v.vendorName || v.ownerName}</option>)}</select></label></>}
          {type === 'staff' ? <label className="block text-sm font-medium text-slate-700">Role<select className={`${INPUT} mt-1 w-full`} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>{[...new Set([editing.role, ...result.roles])].map(r => <option key={r} value={r}>{label(r)}</option>)}</select></label> : <p className="text-sm capitalize text-slate-500">Role: {label(editing.role)}</p>}
          {field('password', 'New password (leave empty to keep current)', 'password')}
          <div className="flex justify-end gap-2"><button type="button" className={BTN} disabled={busy} onClick={close}>Cancel</button><button className={BTN_PRIMARY} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
        </form> : <div className="space-y-4"><p className="text-sm text-slate-600">Delete the login for <strong>{deleting.name || deleting.phone}</strong> ({label(deleting.role)})? This removes the account. Historical orders and financial records remain.</p>{type === 'vendor' && <p className="text-sm text-red-700">Linked dark stores will lose multivendor access until assigned to another active multivendor.</p>}<div className="flex justify-end gap-2"><button className={BTN} disabled={busy} onClick={close}>Cancel</button><button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete account'}</button></div></div>}
      </section>
    </div>}
  </div>;
}
