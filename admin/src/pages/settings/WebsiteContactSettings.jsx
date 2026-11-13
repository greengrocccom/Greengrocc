import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN_PRIMARY, INPUT, PAGE_SUB, PANEL } from '../../utils/ui';

const EMPTY_FORM = {
  phone: '',
  whatsapp: '',
  whatsappMessage: '',
  email: '',
  hours: '',
  address: '',
};

const LABEL = 'block text-xs font-semibold text-slate-700';

/** Platform contact details shown on the website Contact Us page, footer and Help & Support. */
export default function WebsiteContactSettings() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let alive = true;
    opsApi
      .get('vendor-support')
      .then((res) => {
        if (!alive) return;
        const config = (res?.data || res)?.defaultConfig || {};
        setForm({
          phone: config.phone || '',
          whatsapp: config.whatsapp || '',
          whatsappMessage: config.whatsappMessage || '',
          email: config.email || '',
          hours: config.hours || '',
          address: config.address || '',
        });
      })
      .catch((err) => {
        if (alive) setError(err.response?.data?.message || 'Failed to load contact details');
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
      await opsApi.update('vendor-support', 'default', form);
      setSuccess('Contact details saved. The website will show them on the next page load.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save contact details');
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
        <h2 className="text-sm font-semibold text-slate-900">Contact Us page</h2>
        <p className={PAGE_SUB}>
          Shown on the website Contact Us page, the footer, and the Help &amp; Support page.
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          Phone *
          <input
            required
            type="tel"
            className={`${INPUT} mt-1.5`}
            value={form.phone}
            onChange={set('phone')}
            placeholder="+91 74002 22233"
          />
        </label>
        <label className={LABEL}>
          WhatsApp number *
          <input
            required
            type="text"
            className={`${INPUT} mt-1.5`}
            value={form.whatsapp}
            onChange={set('whatsapp')}
            placeholder="+91 74002 22233"
          />
        </label>
      </div>

      <label className={LABEL}>
        WhatsApp pre-filled message
        <input
          type="text"
          className={`${INPUT} mt-1.5`}
          value={form.whatsappMessage}
          onChange={set('whatsappMessage')}
          placeholder="Hi, I need support with my GreenGrocc order."
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          Email
          <input
            type="email"
            className={`${INPUT} mt-1.5`}
            value={form.email}
            onChange={set('email')}
            placeholder="greengrocc@gmail.com"
          />
        </label>
        <label className={LABEL}>
          Support hours
          <input
            type="text"
            className={`${INPUT} mt-1.5`}
            value={form.hours}
            onChange={set('hours')}
            placeholder="Mon – Sat · 10 AM – 10 PM"
          />
        </label>
      </div>

      <label className={LABEL}>
        Office address
        <input
          type="text"
          className={`${INPUT} mt-1.5`}
          value={form.address}
          onChange={set('address')}
          placeholder="Mumbai Central, Mumbai, Maharashtra"
        />
      </label>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button type="submit" disabled={saving} className={`${BTN_PRIMARY} gap-1.5`}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save contact details
        </button>
      </div>
    </form>
  );
}
