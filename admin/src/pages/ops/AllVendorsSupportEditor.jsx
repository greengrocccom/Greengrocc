import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Headset,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Smartphone,
  Store,
  User,
  X,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TD, TH } from '../../utils/ui';

export default function AllVendorsSupportEditor() {
  const [vendors, setVendors] = useState([]);
  const [defaultConfig, setDefaultConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'configured' | 'unconfigured'

  // Edit Modal State
  const [editingVendor, setEditingVendor] = useState(null); // null or vendor object
  const [editForm, setEditForm] = useState({
    phone: '',
    whatsapp: '',
    whatsappMessage: 'Hi, I need support with my GreenGrocc order.',
    email: '',
    hours: 'Mon – Sat · 9 AM – 9 PM',
    isActive: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Default Support Modal State
  const [editingDefault, setEditingDefault] = useState(false);
  const [defaultForm, setDefaultForm] = useState({
    phone: '+91 74002 22233',
    whatsapp: '+91 74002 22233',
    whatsappMessage: 'Hi, I need support with my GreenGrocc order.',
    email: 'greengrocc@gmail.com',
    hours: 'Mon – Sat · 10 AM – 10 PM',
    address: 'Mumbai Central, Mumbai, Maharashtra',
  });
  const [savingDefault, setSavingDefault] = useState(false);

  // Fetch all vendors support data
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    opsApi
      .get('vendor-support')
      .then((res) => {
        if (!alive) return;
        const data = res?.data || res;
        setVendors(data?.vendors || []);
        if (data?.defaultConfig) {
          setDefaultConfig(data.defaultConfig);
          setDefaultForm(data.defaultConfig);
        }
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.response?.data?.message || err.message || 'Failed to load vendors support data');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [refreshKey]);

  // Filter vendors
  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      const matchSearch =
        !q ||
        [v.vendorName, v.ownerName, v.mobile, v.city, v.id, ...(v.zones || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);

      if (!matchSearch) return false;

      const hasCustom = Boolean(v.support?.phone || v.support?.whatsapp);
      if (filterMode === 'configured') return hasCustom;
      if (filterMode === 'unconfigured') return !hasCustom;
      return true;
    });
  }, [vendors, search, filterMode]);

  // Open edit modal for vendor
  const handleOpenEdit = (vendor) => {
    setEditingVendor(vendor);
    setEditForm({
      phone: vendor.support?.phone || vendor.mobile || vendor.phone || '',
      whatsapp: vendor.support?.whatsapp || vendor.mobile || vendor.phone || '',
      whatsappMessage: vendor.support?.whatsappMessage || 'Hi, I need support with my GreenGrocc order.',
      email: vendor.support?.email || vendor.email || '',
      hours: vendor.support?.hours || 'Mon – Sat · 9 AM – 9 PM',
      isActive: vendor.support?.isActive !== false,
    });
    setEditError('');
    setEditSuccess('');
  };

  // Submit vendor support update
  const handleSaveVendorSupport = async (e) => {
    e.preventDefault();
    if (!editingVendor) return;
    setSavingEdit(true);
    setEditError('');
    setEditSuccess('');

    try {
      await opsApi.update('vendor-support', editingVendor.id || editingVendor._id, editForm);
      setEditSuccess('Support configuration saved successfully!');
      // Update local state
      setVendors((prev) =>
        prev.map((v) =>
          (v.id === editingVendor.id || v._id === editingVendor._id)
            ? { ...v, support: { ...editForm } }
            : v
        )
      );
      setTimeout(() => {
        setEditingVendor(null);
      }, 700);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update support configuration');
    } finally {
      setSavingEdit(false);
    }
  };

  // Submit global default update
  const handleSaveDefaultSupport = async (e) => {
    e.preventDefault();
    setSavingDefault(true);
    try {
      const res = await opsApi.update('vendor-support', 'default', defaultForm);
      setDefaultConfig(res?.data || defaultForm);
      setEditingDefault(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update platform default support');
    } finally {
      setSavingDefault(false);
    }
  };

  // Stats
  const configuredCount = vendors.filter((v) => v.support?.phone || v.support?.whatsapp).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={PAGE_KICKER}>Multi-Vendor Operations</p>
          <h1 className={PAGE_TITLE}>All Vendors Support Editor</h1>
          <p className={PAGE_SUB}>
            Configure touch-to-call phone numbers and direct WhatsApp redirect channels for all vendors and collection centres.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingDefault(true)}
            className={`${BTN} gap-1.5 text-xs font-semibold`}
          >
            <Settings2 className="h-4 w-4 text-emerald-700" />
            Platform Default Channels
          </button>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className={`${BTN} gap-1.5 text-xs font-semibold`}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Platform Default Channels Card */}
      {defaultConfig && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Headset className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Platform Default Fallback Channels
                  </p>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    Auto-Fallback
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                  <span className="flex items-center gap-1 font-semibold">
                    <Phone className="h-3.5 w-3.5 text-emerald-700" />
                    Touch-To-Call: <strong>{defaultConfig.phone}</strong>
                  </span>
                  <span className="flex items-center gap-1 font-semibold">
                    <MessageSquare className="h-3.5 w-3.5 text-[#25D366]" />
                    Direct WhatsApp: <strong>{defaultConfig.whatsapp}</strong>
                  </span>
                  <span className="hidden sm:inline-block text-slate-400">&bull;</span>
                  <span className="text-slate-500">{defaultConfig.hours}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingDefault(true)}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
            >
              Configure Default &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${PANEL} flex items-center gap-3 px-4 py-3`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#217346]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Vendors</p>
            <p className="text-lg font-bold text-slate-900">{vendors.length}</p>
          </div>
        </div>
        <div className={`${PANEL} flex items-center gap-3 px-4 py-3`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#217346]">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Custom Channels Set</p>
            <p className="text-lg font-bold text-slate-900">{configuredCount}</p>
          </div>
        </div>
        <div className={`${PANEL} flex items-center gap-3 px-4 py-3`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Headset className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Using Platform Fallback</p>
            <p className="text-lg font-bold text-slate-900">{vendors.length - configuredCount}</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${INPUT} pl-9 text-xs`}
            placeholder="Search vendor by name, owner, city, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filterMode === 'all' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({vendors.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('configured')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filterMode === 'configured' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Custom Configured ({configuredCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('unconfigured')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filterMode === 'unconfigured' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Default Fallback ({vendors.length - configuredCount})
          </button>
        </div>
      </div>

      {/* Vendors Table */}
      <div className={`overflow-hidden ${PANEL}`}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> Loading vendors support directory...
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-12 text-center">
            <Headset className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-800">No vendors found</p>
            <p className="mt-0.5 text-xs text-slate-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className={TH}>Vendor / Centre</th>
                  <th className={TH}>Location</th>
                  <th className={TH}>Touch-To-Call Phone</th>
                  <th className={TH}>Direct WhatsApp</th>
                  <th className={TH}>Operating Hours</th>
                  <th className={TH}>Channel Status</th>
                  <th className={`${TH} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVendors.map((v) => {
                  const s = v.support || {};
                  const effectivePhone = s.phone || defaultConfig?.phone || v.mobile || '—';
                  const effectiveWhatsapp = s.whatsapp || defaultConfig?.whatsapp || v.mobile || '—';
                  const isCustom = Boolean(s.phone || s.whatsapp);

                  const rawPhone = effectivePhone.replace(/[^\d+]/g, '');
                  const rawWhatsapp = effectiveWhatsapp.replace(/\D/g, '');
                  const fullWhatsapp = rawWhatsapp.length === 10 ? '91' + rawWhatsapp : rawWhatsapp;
                  const waLink = `https://wa.me/${fullWhatsapp}?text=${encodeURIComponent(
                    s.whatsappMessage || 'Hi, I need support with my GreenGrocc order.'
                  )}`;

                  return (
                    <tr key={v.id || v._id} className="transition hover:bg-slate-50/80">
                      <td className={TD}>
                        <div className="font-bold text-slate-900">{v.vendorName}</div>
                        <div className="text-[11px] text-slate-500">
                          {v.ownerName} &bull; ID: {v.id}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="text-slate-700">{v.city || '—'}</div>
                        {v.zones && v.zones.length > 0 && (
                          <div className="text-[10px] text-slate-400">
                            {v.zones.slice(0, 2).join(', ')}
                            {v.zones.length > 2 ? ` +${v.zones.length - 2}` : ''}
                          </div>
                        )}
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-emerald-700" />
                          <span className="font-semibold text-slate-900">{effectivePhone}</span>
                          <a
                            href={`tel:${rawPhone}`}
                            className="rounded p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                            title="Test Touch to Call"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {s.phone ? 'Custom vendor direct line' : 'Using platform default'}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-[#25D366]" />
                          <span className="font-semibold text-slate-900">{effectiveWhatsapp}</span>
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-slate-400 hover:bg-green-50 hover:text-green-600"
                            title="Test WhatsApp Redirect"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                          Msg: &quot;{s.whatsappMessage || 'Default starter message'}&quot;
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="text-slate-700">{s.hours || defaultConfig?.hours || 'Mon – Sat · 9 AM – 9 PM'}</div>
                        {s.email && <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{s.email}</div>}
                      </td>
                      <td className={TD}>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            s.isActive !== false
                              ? isCustom
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {s.isActive !== false ? (isCustom ? 'Custom Active' : 'Default Active') : 'Disabled'}
                        </span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(v)}
                          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                          Edit Support &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT VENDOR SUPPORT MODAL */}
      {editingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Support Channels: {editingVendor.vendorName}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingVendor.ownerName} &bull; Mobile: {editingVendor.mobile} &bull; City: {editingVendor.city}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingVendor(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {editError}
              </div>
            )}
            {editSuccess && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                {editSuccess}
              </div>
            )}

            <form onSubmit={handleSaveVendorSupport} className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">Customer Support Channel Status</p>
                  <p className="text-[11px] text-slate-500">
                    If disabled, users will automatically see the GreenGrocc platform default support.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{editForm.isActive ? 'Active' : 'Disabled'}</span>
                </label>
              </div>

              {/* Touch to Call Phone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Touch-to-Call Phone Number *
                </label>
                <p className="mb-1 text-[11px] text-slate-400">
                  Phone number dialed when customer taps &quot;Touch to Call&quot; in website or mobile app.
                </p>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="tel"
                    className={`${INPUT} pl-9 text-xs font-semibold`}
                    placeholder="e.g. +91 98765 43210"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>

              {/* Direct WhatsApp Redirect */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Direct WhatsApp Number *
                </label>
                <p className="mb-1 text-[11px] text-slate-400">
                  WhatsApp contact number (include country code without + e.g. 919876543210).
                </p>
                <div className="relative">
                  <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="text"
                    className={`${INPUT} pl-9 text-xs font-semibold`}
                    placeholder="e.g. 919876543210"
                    value={editForm.whatsapp}
                    onChange={(e) => setEditForm((p) => ({ ...p, whatsapp: e.target.value }))}
                  />
                </div>
              </div>

              {/* WhatsApp Message */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  WhatsApp Pre-filled Message
                </label>
                <textarea
                  rows={2}
                  className={`${INPUT} text-xs font-medium`}
                  placeholder="e.g. Hi, I need support with my GreenGrocc order."
                  value={editForm.whatsappMessage}
                  onChange={(e) => setEditForm((p) => ({ ...p, whatsappMessage: e.target.value }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Support Email
                  </label>
                  <input
                    type="email"
                    className={`${INPUT} text-xs`}
                    placeholder="support@centre.com"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    className={`${INPUT} text-xs`}
                    placeholder="e.g. Mon – Sat · 9 AM – 9 PM"
                    value={editForm.hours}
                    onChange={(e) => setEditForm((p) => ({ ...p, hours: e.target.value }))}
                  />
                </div>
              </div>

              {/* Live Preview Buttons in Modal */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Customer Button Preview
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl bg-[#25D366] px-3 py-2 text-white shadow-sm">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-xs font-bold">Direct WhatsApp</span>
                    </div>
                    <span className="text-[10px] font-semibold bg-white/20 px-1.5 py-0.5 rounded">wa.me</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-emerald-800 px-3 py-2 text-white shadow-sm">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      <span className="text-xs font-bold">Touch to Call</span>
                    </div>
                    <span className="text-[10px] font-semibold bg-white/20 px-1.5 py-0.5 rounded">tel:</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingVendor(null)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className={`${BTN_PRIMARY} gap-1.5`}
                >
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Vendor Support
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT GLOBAL DEFAULT MODAL */}
      {editingDefault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Platform Default Support Channels
                </h3>
                <p className="text-xs text-slate-500">
                  These fallback channels are used when a vendor has not specified custom support channels.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDefault(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDefaultSupport} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Default Touch-To-Call Phone *
                </label>
                <input
                  required
                  type="tel"
                  className={`${INPUT} text-xs font-semibold`}
                  value={defaultForm.phone}
                  onChange={(e) => setDefaultForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Default Direct WhatsApp Number *
                </label>
                <input
                  required
                  type="text"
                  className={`${INPUT} text-xs font-semibold`}
                  value={defaultForm.whatsapp}
                  onChange={(e) => setDefaultForm((p) => ({ ...p, whatsapp: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Default WhatsApp Message
                </label>
                <textarea
                  rows={2}
                  className={`${INPUT} text-xs`}
                  value={defaultForm.whatsappMessage}
                  onChange={(e) => setDefaultForm((p) => ({ ...p, whatsappMessage: e.target.value }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Default Email
                  </label>
                  <input
                    type="email"
                    className={`${INPUT} text-xs`}
                    value={defaultForm.email}
                    onChange={(e) => setDefaultForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    className={`${INPUT} text-xs`}
                    value={defaultForm.hours}
                    onChange={(e) => setDefaultForm((p) => ({ ...p, hours: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Office Address
                </label>
                <input
                  type="text"
                  className={`${INPUT} text-xs`}
                  value={defaultForm.address || ''}
                  onChange={(e) => setDefaultForm((p) => ({ ...p, address: e.target.value }))}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Phone, WhatsApp, email, hours and address are shown on the website Contact Us page and footer.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingDefault(false)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDefault}
                  className={`${BTN_PRIMARY} gap-1.5`}
                >
                  {savingDefault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Platform Default
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

