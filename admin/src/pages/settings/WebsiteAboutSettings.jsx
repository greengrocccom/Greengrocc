import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN_PRIMARY, INPUT, PAGE_SUB, PANEL } from '../../utils/ui';

const LABEL = 'block text-xs font-semibold text-slate-700';

/** Website About Us text, stored as the customer policy with pageKey "about". */
export default function WebsiteAboutSettings() {
  const [policyId, setPolicyId] = useState(null);
  const [form, setForm] = useState({ title: 'About GreenGrocc', body: '', status: 'draft' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let alive = true;
    opsApi
      .list('policies', { roleKey: 'customer' })
      .then((res) => {
        if (!alive) return;
        const row = (res?.data || []).find((p) => p.pageKey === 'about');
        if (row) {
          setPolicyId(row._id);
          setForm({
            title: row.title || 'About GreenGrocc',
            body: row.body || '',
            status: row.status || 'draft',
          });
        }
      })
      .catch((err) => {
        if (alive) setError(err.response?.data?.message || 'Failed to load About Us content');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const set = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setSuccess('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = { ...form, pageKey: 'about', roleKey: 'customer' };
      if (policyId) {
        await opsApi.update('policies', policyId, payload);
      } else {
        const res = await opsApi.create('policies', payload);
        setPolicyId(res?.data?._id || res?.data?.id || null);
      }
      setSuccess(
        form.status === 'published'
          ? 'Saved and published. The website About Us page now shows this text.'
          : 'Saved as draft. The website keeps showing the built-in About Us page.'
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save About Us content');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`${PANEL} flex justify-center py-16 text-slate-400`}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className={`${PANEL} space-y-4 p-5 sm:p-6`}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">About Us page</h2>
        <p className={PAGE_SUB}>
          While this is a draft, the website shows its built-in designed About Us page. Publish it to show
          this text instead.
        </p>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {success}
        </div>
      ) : null}

      <label className={LABEL}>
        Page title *
        <input
          required
          type="text"
          className={`${INPUT} mt-1.5`}
          value={form.title}
          onChange={set('title')}
        />
      </label>

      <label className={LABEL}>
        Content *
        <textarea
          required
          rows={18}
          className={`${INPUT} mt-1.5 font-mono text-[13px]`}
          value={form.body}
          onChange={set('body')}
          placeholder="Write about GreenGrocc…"
        />
        <span className="mt-1 block text-[11px] font-normal text-slate-400">
          Formatting: start a line with <code>## </code> for a heading, <code>- </code> for a bullet, or{' '}
          <code>1. </code> for a numbered step. Other lines show as paragraphs.
        </span>
      </label>

      <label className={LABEL}>
        Status
        <select className={`${INPUT} mt-1.5`} value={form.status} onChange={set('status')}>
          <option value="published">Published (website shows this text)</option>
          <option value="draft">Draft (website shows the built-in page)</option>
        </select>
      </label>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button type="submit" disabled={saving} className={`${BTN_PRIMARY} gap-1.5`}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save About Us
        </button>
      </div>
    </form>
  );
}
