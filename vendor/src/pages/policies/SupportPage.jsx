import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Headset,
  HelpCircle,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { vendorApi } from '../../api/vendorApi'
import { useVendorAuth } from '../../context/VendorAuthContext'

const ISSUE_TYPES = [
  { value: 'order', label: 'Order / pickup' },
  { value: 'payment', label: 'Payment' },
  { value: 'other', label: 'Other' },
]

export default function SupportPage() {
  const { vendor } = useVendorAuth()
  const [activeTab, setActiveTab] = useState('customer-channels') // 'customer-channels' | 'admin-helpdesk'

  // ----------------------------------------------------
  // TAB 1: CUSTOMER SUPPORT (WHATSAPP & CALL) SETTINGS
  // ----------------------------------------------------
  const [supportConfig, setSupportConfig] = useState({
    phone: '',
    whatsapp: '',
    whatsappMessage: 'Hi, I need support with my GreenGrocc order.',
    email: '',
    hours: 'Mon – Sat · 9 AM – 9 PM',
    isActive: true,
  })
  const [globalDefaults, setGlobalDefaults] = useState(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMsg, setConfigMsg] = useState({ type: '', text: '' })

  const loadSupportConfig = async () => {
    setLoadingConfig(true)
    setConfigMsg({ type: '', text: '' })
    try {
      const res = await vendorApi.getCustomerSupport()
      if (res?.support) {
        setSupportConfig({
          phone: res.support.phone || vendor?.mobile || vendor?.phone || '',
          whatsapp: res.support.whatsapp || vendor?.mobile || vendor?.phone || '',
          whatsappMessage: res.support.whatsappMessage || 'Hi, I need support with my GreenGrocc order.',
          email: res.support.email || vendor?.email || '',
          hours: res.support.hours || 'Mon – Sat · 9 AM – 9 PM',
          isActive: res.support.isActive !== false,
        })
      }
      if (res?.globalDefaults) {
        setGlobalDefaults(res.globalDefaults)
      }
    } catch (err) {
      setConfigMsg({ type: 'error', text: err.response?.data?.message || 'Failed to load support configuration' })
    } finally {
      setLoadingConfig(false)
    }
  }

  useEffect(() => {
    loadSupportConfig()
  }, [])

  const handleSaveSupportConfig = async (e) => {
    e.preventDefault()
    setSavingConfig(true)
    setConfigMsg({ type: '', text: '' })
    try {
      const res = await vendorApi.updateCustomerSupport(supportConfig)
      setConfigMsg({ type: 'success', text: res?.message || 'Customer support channels updated successfully!' })
    } catch (err) {
      setConfigMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update support configuration' })
    } finally {
      setSavingConfig(false)
    }
  }

  // Raw WhatsApp link for simulator
  const rawWhatsapp = (supportConfig.whatsapp || globalDefaults?.whatsapp || '').replace(/\D/g, '')
  const fullWhatsapp = rawWhatsapp.length === 10 ? '91' + rawWhatsapp : rawWhatsapp
  const whatsappPreviewUrl = `https://wa.me/${fullWhatsapp}?text=${encodeURIComponent(
    supportConfig.whatsappMessage || 'Hi, I need support with my order.'
  )}`
  const phonePreviewTel = `tel:${(supportConfig.phone || globalDefaults?.phone || '').replace(/[^\d+]/g, '')}`

  // ----------------------------------------------------
  // TAB 2: PLATFORM HELPDESK (TICKET TO ADMIN)
  // ----------------------------------------------------
  const [ticketForm, setTicketForm] = useState({
    name: vendor?.ownerName || vendor?.name || '',
    email: vendor?.email || '',
    phone: vendor?.mobile || vendor?.phone || '',
    orderId: '',
    issueType: 'other',
    message: '',
  })
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [ticketMsg, setTicketMsg] = useState({ type: '', text: '' })

  const onTicketChange = (key) => (e) => setTicketForm((p) => ({ ...p, [key]: e.target.value }))

  const onSubmitTicket = async (e) => {
    e.preventDefault()
    setTicketMsg({ type: '', text: '' })
    setSubmittingTicket(true)
    try {
      await vendorApi.submitSupport({ ...ticketForm, roleKey: 'vendor' })
      setTicketMsg({ type: 'success', text: 'Support request submitted. Admin will review it shortly.' })
      setTicketForm((p) => ({ ...p, orderId: '', message: '', issueType: 'other' }))
    } catch (err) {
      setTicketMsg({ type: 'error', text: err.response?.data?.message || 'Failed to submit support request' })
    } finally {
      setSubmittingTicket(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support Hub</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure direct Touch-to-Call and WhatsApp redirect for customers ordering from your collection centre, or contact platform admin.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('customer-channels')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition sm:text-sm ${activeTab === 'customer-channels'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Smartphone className="h-4 w-4" />
          Customer Channels (WhatsApp & Call)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('admin-helpdesk')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition sm:text-sm ${activeTab === 'admin-helpdesk'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Headset className="h-4 w-4" />
          Admin Helpdesk (Ticket)
        </button>
      </div>

      {/* TAB 1: CUSTOMER SUPPORT CHANNELS */}
      {activeTab === 'customer-channels' && (
        <div className="space-y-6">
          {configMsg.text && (
            <div
              className={`rounded-2xl border p-4 text-sm font-semibold ${configMsg.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
            >
              {configMsg.text}
            </div>
          )}

          {loadingConfig ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
              {/* Form Card */}
              <form
                onSubmit={handleSaveSupportConfig}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Direct Support Channels</h2>
                    <p className="text-xs text-slate-500">
                      Numbers shown on the website and mobile app for direct touch-to-call and WhatsApp chat.
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={supportConfig.isActive}
                      onChange={(e) => setSupportConfig((p) => ({ ...p, isActive: e.target.checked }))}
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{supportConfig.isActive ? 'Active' : 'Disabled'}</span>
                  </label>
                </div>

                {/* Touch to Call Phone */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Touch-To-Call Phone Number *
                  </label>
                  <p className="mb-1.5 text-[11px] text-slate-400">
                    When a customer taps &quot;Touch to Call&quot;, their phone dials this number directly.
                  </p>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="tel"
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-medium outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                      placeholder="e.g. +91 98765 43210"
                      value={supportConfig.phone}
                      onChange={(e) => setSupportConfig((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Direct WhatsApp Number */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Direct WhatsApp Number *
                  </label>
                  <p className="mb-1.5 text-[11px] text-slate-400">
                    When a customer taps &quot;Chat on WhatsApp&quot;, WhatsApp opens a conversation with this number.
                  </p>
                  <div className="relative">
                    <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="text"
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-medium outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                      placeholder="e.g. 919876543210 (with country code)"
                      value={supportConfig.whatsapp}
                      onChange={(e) => setSupportConfig((p) => ({ ...p, whatsapp: e.target.value }))}
                    />
                  </div>
                </div>

                {/* WhatsApp Pre-filled Starter Message */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    WhatsApp Pre-filled Message
                  </label>
                  <p className="mb-1.5 text-[11px] text-slate-400">
                    The starting text loaded in the chat input when the customer lands on WhatsApp.
                  </p>
                  <textarea
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-medium outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                    placeholder="e.g. Hi, I need support with my order from your store."
                    value={supportConfig.whatsappMessage}
                    onChange={(e) => setSupportConfig((p) => ({ ...p, whatsappMessage: e.target.value }))}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Support Email */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Support Email
                    </label>
                    <div className="relative mt-1">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-600"
                        placeholder="support@centre.com"
                        value={supportConfig.email}
                        onChange={(e) => setSupportConfig((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Operating Hours */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Support Hours
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-600"
                      placeholder="e.g. Mon – Sat · 9 AM – 9 PM"
                      value={supportConfig.hours}
                      onChange={(e) => setSupportConfig((p) => ({ ...p, hours: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Customer Support Channels
                  </button>
                </div>
              </form>

              {/* Customer View Simulator */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                    <Smartphone className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Customer Experience Live Preview
                    </h3>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    This is how users in the web frontend and mobile app will see and tap your support buttons:
                  </p>

                  <div className="mt-4 space-y-3">
                    {/* Simulator Direct WhatsApp Button */}
                    <div className="rounded-2xl bg-[#25D366] p-3.5 text-white shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                            <MessageSquare className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">
                              Direct WhatsApp Chat
                            </p>
                            <p className="text-sm font-bold">
                              {supportConfig.whatsapp || globalDefaults?.whatsapp || '+91 74002 22233'}
                            </p>
                            <p className="text-[11px] text-white/80 truncate max-w-[200px]">
                              &quot;{supportConfig.whatsappMessage || 'Hi, I need support'}&quot;
                            </p>
                          </div>
                        </div>
                        <a
                          href={whatsappPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-white/20 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white hover:text-[#25D366] transition"
                        >
                          Test &rarr;
                        </a>
                      </div>
                    </div>

                    {/* Simulator Touch to Call Button */}
                    <div className="rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 p-3.5 text-white shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                            <PhoneCall className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                              Touch to Call
                            </p>
                            <p className="text-sm font-bold">
                              {supportConfig.phone || globalDefaults?.phone || '+91 74002 22233'}
                            </p>
                            <p className="text-[11px] text-emerald-200">Tap to dial customer care</p>
                          </div>
                        </div>
                        <a
                          href={phonePreviewTel}
                          className="rounded-lg bg-white/20 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white hover:text-emerald-900 transition"
                        >
                          Test &rarr;
                        </a>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 space-y-1">
                      <p>
                        <strong>Email:</strong> {supportConfig.email || globalDefaults?.email || 'greengrocc@gmail.com'}
                      </p>
                      <p>
                        <strong>Hours:</strong> {supportConfig.hours || 'Mon – Sat · 9 AM – 9 PM'}
                      </p>
                      <p className="text-[11px] text-slate-400 pt-1">
                        Status:{' '}
                        <span className={`font-bold ${supportConfig.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {supportConfig.isActive ? 'Active on customer storefront' : 'Disabled (using platform defaults)'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PLATFORM HELPDESK (TICKET TO ADMIN) */}
      {activeTab === 'admin-helpdesk' && (
        <div className="mx-auto max-w-xl space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Send Ticket to GreenGrocc Admin</h2>
            <p className="mt-1 text-xs text-slate-500">
              Submit an internal ticket to GreenGrocc admin. It will appear under your collection centre in Store Support.
            </p>

            {ticketMsg.text && (
              <div
                className={`mt-4 rounded-xl border p-3 text-xs font-semibold ${ticketMsg.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
              >
                {ticketMsg.text}
              </div>
            )}

            <form onSubmit={onSubmitTicket} className="mt-4 space-y-3">
              {['name', 'email', 'phone'].map((key) => (
                <label key={key} className="block text-xs font-semibold capitalize text-slate-600">
                  {key}
                  <input
                    required
                    type={key === 'email' ? 'email' : 'text'}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                    value={ticketForm[key]}
                    onChange={onTicketChange(key)}
                  />
                </label>
              ))}

              <label className="block text-xs font-semibold text-slate-600">
                Related ref (optional)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  value={ticketForm.orderId}
                  onChange={onTicketChange('orderId')}
                />
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Issue type
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  value={ticketForm.issueType}
                  onChange={onTicketChange('issueType')}
                >
                  {ISSUE_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Message
                <textarea
                  required
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  value={ticketForm.message}
                  onChange={onTicketChange('message')}
                />
              </label>

              <button
                type="submit"
                disabled={submittingTicket}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {submittingTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Support Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
