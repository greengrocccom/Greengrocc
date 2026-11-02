import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Phone,
  ShieldCheck,
  Briefcase,
  Star,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  FileText,
  BadgeCheck,
  Store,
  DollarSign,
  UserPlus,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import apiClient from '../../api/client';
import darkStoreApi from '../../api/darkStoreApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';
import { HrBackButtons, inr } from './hrShared';
import B2bDealPipeline from './B2bDealPipeline';

const CATEGORIES = [
  'Hospitality & HoReCa',
  'Modern Retail & Supermarkets',
  'Corporate Canteen & Catering',
  'Food Processing & Cloud Kitchen',
  'Institutional & Healthcare',
  'Export & Distribution',
  'Other',
];

const CLIENT_TYPES = [
  { value: 'client', label: 'Commercial Client' },
  { value: 'partner', label: 'Strategic Partner' },
  { value: 'enterprise_buyer', label: 'Enterprise Buyer' },
  { value: 'institutional', label: 'Institutional / Healthcare' },
];

const ROLE_TAGS = [
  { value: 'authorized_signatory', label: 'Authorized Signatory', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'procurement_lead', label: 'Procurement Lead', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'finance_lead', label: 'Finance & Accounts', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'receiving_dock', label: 'Receiving Dock Lead', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'store_manager', label: 'Operations & Store Manager', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'general_contact', label: 'General Corporate Contact', color: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const PRICING_TIERS = ['Standard B2B', 'Tier-1 Wholesale', 'Enterprise Bulk', 'Strategic Partner'];

const emptyCompanyForm = {
  companyCode: '',
  companyName: '',
  tradeName: '',
  clientType: 'client',
  category: 'Hospitality & HoReCa',
  registrationNumber: '',
  gstin: '',
  pan: '',
  status: 'active',
  creditLimit: 0,
  creditDays: 30,
  assignedDarkStore: '',
  darkStoreId: '',
  billingAddress: { street: '', city: '', state: '', pincode: '', country: 'India' },
  shippingAddress: { street: '', city: '', state: '', pincode: '' },
  contractDetails: {
    contractNumber: '',
    startDate: '',
    endDate: '',
    contractStatus: 'active',
    pricingTier: 'Standard B2B',
    slaTerms: '',
  },
  notes: '',
  representatives: [
    {
      name: '',
      email: '',
      phone: '',
      designation: '',
      department: '',
      roleTag: 'procurement_lead',
      isPrimary: true,
      portalAccess: true,
      status: 'active',
      notes: '',
    },
  ],
};

const emptyRepForm = {
  name: '',
  email: '',
  phone: '',
  designation: '',
  department: '',
  roleTag: 'procurement_lead',
  isPrimary: false,
  portalAccess: true,
  status: 'active',
  notes: '',
};

export default function HrB2bUsersPage() {
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedClients, setExpandedClients] = useState({});
  const [mainTab, setMainTab] = useState('pipeline'); // 'pipeline' | 'clients'
  const [selectedDealClientId, setSelectedDealClientId] = useState('all');

  // Dynamic Metadata State
  const [darkStores, setDarkStores] = useState([]);
  const [bulkUsers, setBulkUsers] = useState([]);

  // Company Modal State
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [submittingCompany, setSubmittingCompany] = useState(false);

  // Representative Modal State
  const [isRepModalOpen, setIsRepModalOpen] = useState(false);
  const [targetCompany, setTargetCompany] = useState(null);
  const [editingRepId, setEditingRepId] = useState(null);
  const [repForm, setRepForm] = useState(emptyRepForm);
  const [submittingRep, setSubmittingRep] = useState(false);

  // Delete Confirmation Modal
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await opsApi.list('hr/b2b-clients', {
        search: query,
        category: categoryFilter,
        status: statusFilter,
        clientType: typeFilter,
      });
      setClients(res.data || []);
      setStats(res.stats || null);
      setError('');
    } catch (err) {
      console.error('Failed to load B2B clients:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load B2B clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [categoryFilter, statusFilter, typeFilter]);

  // Load real dark stores and registered bulk users
  useEffect(() => {
    let mounted = true;
    async function loadMeta() {
      try {
        const [storesRes, usersRes] = await Promise.allSettled([
          darkStoreApi.list(),
          apiClient.get('/admin-ops/hr/b2b-clients/registered-users'),
        ]);

        if (mounted && storesRes.status === 'fulfilled') {
          const list =
            storesRes.value?.stores ||
            storesRes.value?.data ||
            (Array.isArray(storesRes.value) ? storesRes.value : []);
          setDarkStores(list);
        }

        if (mounted && usersRes.status === 'fulfilled') {
          const usersList = usersRes.value?.data?.data || [];
          setBulkUsers(Array.isArray(usersList) ? usersList : []);
        }
      } catch (err) {
        console.warn('Failed to load metadata for B2B user management:', err);
      }
    }
    loadMeta();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectBulkUser = (userId) => {
    if (!userId) return;
    const u = bulkUsers.find((user) => user._id === userId);
    if (!u) return;

    setCompanyForm((prev) => ({
      ...prev,
      companyName: u.shopName || u.name || prev.companyName,
      tradeName: u.shopName ? u.name : prev.tradeName,
      gstin: u.gstNumber || prev.gstin,
      billingAddress: {
        ...prev.billingAddress,
        street: u.shopAddress || prev.billingAddress.street,
      },
      representatives: [
        {
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          designation: u.shopName ? 'Proprietor / Store Manager' : 'Business Owner',
          department: 'Executive Management',
          roleTag: 'authorized_signatory',
          isPrimary: true,
          portalAccess: true,
          status: 'active',
          notes: `Linked from registered ${u.accountType || 'bulk'} account`,
        },
      ],
    }));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadClients();
  };

  const toggleExpand = (id) => {
    setExpandedClients((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const openCreateCompanyModal = () => {
    setEditingCompanyId(null);
    setCompanyForm({
      ...emptyCompanyForm,
      companyCode: '',
      representatives: [
        {
          name: '',
          email: '',
          phone: '',
          designation: '',
          department: '',
          roleTag: 'procurement_lead',
          isPrimary: true,
          portalAccess: true,
          status: 'active',
          notes: '',
        },
      ],
    });
    setIsCompanyModalOpen(true);
  };

  const openEditCompanyModal = (client) => {
    setEditingCompanyId(client._id);
    setCompanyForm({
      companyCode: client.companyCode || '',
      companyName: client.companyName || '',
      tradeName: client.tradeName || '',
      clientType: client.clientType || 'client',
      category: client.category || 'Hospitality & HoReCa',
      registrationNumber: client.registrationNumber || '',
      gstin: client.gstin || '',
      pan: client.pan || '',
      status: client.status || 'active',
      creditLimit: client.creditLimit ?? 0,
      creditDays: client.creditDays ?? 30,
      assignedDarkStore: client.assignedDarkStore || '',
      darkStoreId: client.darkStoreId || '',
      billingAddress: {
        street: client.billingAddress?.street || '',
        city: client.billingAddress?.city || '',
        state: client.billingAddress?.state || '',
        pincode: client.billingAddress?.pincode || '',
        country: client.billingAddress?.country || 'India',
      },
      shippingAddress: {
        street: client.shippingAddress?.street || '',
        city: client.shippingAddress?.city || '',
        state: client.shippingAddress?.state || '',
        pincode: client.shippingAddress?.pincode || '',
      },
      contractDetails: {
        contractNumber: client.contractDetails?.contractNumber || '',
        startDate: client.contractDetails?.startDate ? client.contractDetails.startDate.slice(0, 10) : '',
        endDate: client.contractDetails?.endDate ? client.contractDetails.endDate.slice(0, 10) : '',
        contractStatus: client.contractDetails?.contractStatus || 'active',
        pricingTier: client.contractDetails?.pricingTier || 'Standard B2B',
        slaTerms: client.contractDetails?.slaTerms || '',
      },
      notes: client.notes || '',
      representatives: client.representatives && client.representatives.length ? client.representatives : [],
    });
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!companyForm.companyName.trim()) {
      alert('Company Name is required');
      return;
    }
    setSubmittingCompany(true);
    try {
      if (editingCompanyId) {
        await opsApi.update('hr/b2b-clients', editingCompanyId, companyForm);
      } else {
        await opsApi.create('hr/b2b-clients', companyForm);
      }
      setIsCompanyModalOpen(false);
      await loadClients();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save company profile');
    } finally {
      setSubmittingCompany(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteConfirmation) return;
    try {
      await opsApi.remove('hr/b2b-clients', deleteConfirmation.id);
      setDeleteConfirmation(null);
      await loadClients();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete company profile');
    }
  };

  // Add/Edit Representative
  const openAddRepModal = (client) => {
    setTargetCompany(client);
    setEditingRepId(null);
    setRepForm({
      ...emptyRepForm,
      isPrimary: !client.representatives || client.representatives.length === 0,
    });
    setIsRepModalOpen(true);
  };

  const openEditRepModal = (client, rep) => {
    setTargetCompany(client);
    setEditingRepId(rep._id);
    setRepForm({
      name: rep.name || '',
      email: rep.email || '',
      phone: rep.phone || '',
      designation: rep.designation || '',
      department: rep.department || '',
      roleTag: rep.roleTag || 'procurement_lead',
      isPrimary: Boolean(rep.isPrimary),
      portalAccess: rep.portalAccess !== false,
      status: rep.status || 'active',
      notes: rep.notes || '',
    });
    setIsRepModalOpen(true);
  };

  const handleSaveRepresentative = async (e) => {
    e.preventDefault();
    if (!repForm.name.trim() || !repForm.email.trim()) {
      alert('Representative Name and Corporate Email are required');
      return;
    }
    setSubmittingRep(true);
    try {
      if (editingRepId) {
        await apiClient.put(`/admin-ops/hr/b2b-clients/${targetCompany._id}/representatives/${editingRepId}`, repForm);
      } else {
        await apiClient.post(`/admin-ops/hr/b2b-clients/${targetCompany._id}/representatives`, repForm);
      }
      setIsRepModalOpen(false);
      await loadClients();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save representative');
    } finally {
      setSubmittingRep(false);
    }
  };

  const handleDeleteRepresentative = async (companyId, repId) => {
    if (!window.confirm('Are you sure you want to remove this representative from the company profile?')) return;
    try {
      await apiClient.delete(`/admin-ops/hr/b2b-clients/${companyId}/representatives/${repId}`);
      await loadClients();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete representative');
    }
  };

  const addRepToCompanyForm = () => {
    setCompanyForm((prev) => ({
      ...prev,
      representatives: [
        ...prev.representatives,
        {
          name: '',
          email: '',
          phone: '',
          designation: '',
          department: '',
          roleTag: 'procurement_lead',
          isPrimary: false,
          portalAccess: true,
          status: 'active',
          notes: '',
        },
      ],
    }));
  };

  const removeRepFromCompanyForm = (index) => {
    setCompanyForm((prev) => ({
      ...prev,
      representatives: prev.representatives.filter((_, i) => i !== index),
    }));
  };

  const updateRepInCompanyForm = (index, field, value) => {
    setCompanyForm((prev) => {
      const nextReps = [...prev.representatives];
      nextReps[index] = { ...nextReps[index], [field]: value };
      if (field === 'isPrimary' && value === true) {
        nextReps.forEach((r, idx) => {
          if (idx !== index) r.isPrimary = false;
        });
      }
      return { ...prev, representatives: nextReps };
    });
  };

  const getRoleTagBadge = (roleTagKey) => {
    const found = ROLE_TAGS.find((r) => r.value === roleTagKey);
    return found || { label: roleTagKey || 'Contact', color: 'bg-slate-50 text-slate-700 border-slate-200' };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3 w-3" /> Active</span>;
      case 'pending_verification':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200"><AlertCircle className="h-3 w-3" /> Pending Verification</span>;
      case 'under_review':
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200"><BadgeCheck className="h-3 w-3" /> Under Review</span>;
      case 'suspended':
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200"><X className="h-3 w-3" /> Suspended</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Breadcrumb & HR Navigation */}
      <HrBackButtons current="B2B User Management" />

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={PAGE_KICKER}>Corporate Workforce & Client Relations</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">HR Module</span>
          </div>
          <h1 className={`${PAGE_TITLE} mt-1 flex items-center gap-2`}>
            <Building2 className="h-7 w-7 text-emerald-600" />
            B2B User Management
          </h1>
          <p className={`${PAGE_SUB} mt-1`}>
            Manage business clients, partners, and company profiles with multiple representatives
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mainTab === 'clients' ? (
            <>
              <button
                type="button"
                onClick={loadClients}
                disabled={loading}
                className={`${BTN} gap-1.5`}
                title="Refresh Directory"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={openCreateCompanyModal}
                className={`${BTN_PRIMARY} gap-1.5 shadow-sm`}
              >
                <Plus className="h-4 w-4" />
                Add B2B Client Profile
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelectedDealClientId('all');
                setMainTab('clients');
              }}
              className={`${BTN} gap-1.5`}
            >
              <Building2 className="h-4 w-4 text-emerald-600" />
              Manage Companies ({clients.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setMainTab('pipeline')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
              mainTab === 'pipeline'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Deal Stages & Pipeline</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Customizable
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDealClientId('all');
              setMainTab('clients');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
              mainTab === 'clients'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Client Companies Directory</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {clients.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Content: Deal Stages Pipeline */}
      {mainTab === 'pipeline' && (
        <B2bDealPipeline
          clients={clients}
          initialClientFilter={selectedDealClientId}
          onQuickViewClient={(clientId) => {
            setMainTab('clients');
            setExpandedClients({ [clientId]: true });
          }}
        />
      )}

      {/* Tab Content: Client Companies Directory */}
      {mainTab === 'clients' && (
        <>
          {/* KPI Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${PANEL} p-5 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total B2B Clients</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{stats?.totalClients ?? clients.length}</h3>
              <p className="mt-1 text-xs text-emerald-600 font-medium">Enterprise & HoReCa partners</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2 truncate">
            {stats?.categoriesCount && Object.keys(stats.categoriesCount).length > 0 ? (
              Object.entries(stats.categoriesCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([cat, count]) => (
                  <span key={cat} className="truncate">
                    <span className="font-semibold text-slate-700">{count}</span> {cat}
                  </span>
                ))
            ) : (
              <span>Active business clients</span>
            )}
          </div>
        </div>

        <div className={`${PANEL} p-5 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Corporate Representatives</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{stats?.totalReps ?? 0}</h3>
              <p className="mt-1 text-xs text-blue-600 font-medium">Signatories, Procurement, Finance</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
            <span>Multi-stakeholder authorization enabled</span>
          </div>
        </div>

        <div className={`${PANEL} p-5 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Credit Volume Sanctioned</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{inr(stats?.activeCreditVolume ?? 0)}</h3>
              <p className="mt-1 text-xs text-slate-500 font-medium">Utilized: {inr(stats?.totalCreditUsed ?? 0)}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-purple-600 h-1.5 rounded-full"
              style={{
                width: `${Math.min(100, Math.round(((stats?.totalCreditUsed || 0) / (stats?.activeCreditVolume || 1)) * 100))}%`,
              }}
            />
          </div>
        </div>

        <div className={`${PANEL} p-5 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Verification Pipeline</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">
                {stats?.pendingVerifications ?? 0}
                <span className="text-xs font-normal text-slate-500 ml-1.5">Action required</span>
              </h3>
              <p className="mt-1 text-xs text-amber-600 font-medium">GSTIN & Pan KYC in review</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <BadgeCheck className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>{Math.max(0, (stats?.totalClients || 0) - (stats?.pendingVerifications || 0))} fully onboarded</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`${PANEL} p-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies, GSTIN, PAN, representative name, designation, email, or phone..."
              className={`${INPUT} pl-9 text-sm`}
            />
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>Filters:</span>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">All Industries</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="under_review">Under Review</option>
              <option value="suspended">Suspended</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">All Relationship Types</option>
              {CLIENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {(query || categoryFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">Unable to fetch B2B clients</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Client List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm font-medium">Loading B2B business profiles & representatives...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className={`${PANEL} p-12 text-center`}>
          <Building2 className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-base font-semibold text-slate-800">No B2B Client Profiles Found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {query || categoryFilter !== 'all'
              ? 'No business companies match the current search and filter criteria.'
              : 'Add your first enterprise B2B client, hotel, supermarket, or institutional buyer profile.'}
          </p>
          <button
            type="button"
            onClick={openCreateCompanyModal}
            className={`${BTN_PRIMARY} mt-4 gap-1.5`}
          >
            <Plus className="h-4 w-4" />
            Add First B2B Client
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => {
            const isExpanded = expandedClients[client._id] !== false; // default open
            const reps = client.representatives || [];
            const primaryRep = reps.find((r) => r.isPrimary) || reps[0];
            const creditPct = Math.min(100, Math.round(((client.creditUsed || 0) / (client.creditLimit || 1)) * 100));

            return (
              <div key={client._id} className={`${PANEL} overflow-hidden transition-all duration-200 border-slate-200 hover:border-slate-300`}>
                {/* Company Header Row */}
                <div className="p-5 bg-gradient-to-r from-slate-50/50 to-white border-b border-slate-100">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3.5">
                      <div className="rounded-xl bg-emerald-700/10 p-3 text-emerald-700 border border-emerald-700/20 shrink-0">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-slate-900">{client.companyName}</h2>
                          {client.tradeName && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              DBA: {client.tradeName}
                            </span>
                          )}
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-600">
                            {client.companyCode || 'B2B'}
                          </span>
                          {getStatusBadge(client.status)}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
                            {client.category}
                          </span>
                          {client.gstin && (
                            <span className="font-mono text-slate-600">
                              GSTIN: <span className="font-semibold text-slate-800">{client.gstin}</span>
                            </span>
                          )}
                          {client.pan && (
                            <span className="font-mono text-slate-600">
                              PAN: <span className="font-semibold text-slate-800">{client.pan}</span>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Store className="h-3.5 w-3.5 text-slate-400" />
                            {client.assignedDarkStore || 'Unassigned Store'}
                          </span>
                          {client.billingAddress?.city && (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {client.billingAddress.city}
                              {client.billingAddress.state ? `, ${client.billingAddress.state}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Commercial summary and Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-right">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Credit Limit & Terms</p>
                        <p className="text-sm font-bold text-slate-900">{inr(client.creditLimit)}</p>
                        <p className="text-[11px] text-slate-500">
                          Net {client.creditDays || 0} Days
                          {client.contractDetails?.pricingTier ? ` · ${client.contractDetails.pricingTier}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDealClientId(client._id);
                            setMainTab('pipeline');
                          }}
                          className={`${BTN} gap-1 text-xs text-blue-700 border-blue-200 hover:bg-blue-50`}
                          title="View and track deals for this client"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Deals</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openAddRepModal(client)}
                          className={`${BTN} gap-1 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50`}
                          title="Add new representative to this company"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Add Rep</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCompanyModal(client)}
                          className={`${BTN} p-2 text-slate-600 hover:text-slate-900`}
                          title="Edit Company Profile"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmation({ id: client._id, name: client.companyName })}
                          className={`${BTN} p-2 text-slate-400 hover:text-rose-600 hover:border-rose-200`}
                          title="Delete Company Profile"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExpand(client._id)}
                          className={`${BTN} p-2 text-slate-500 hover:text-slate-800`}
                          title={isExpanded ? 'Collapse Representatives' : 'Expand Representatives'}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Section: Representatives & Commercial Terms */}
                {isExpanded && (
                  <div className="p-5 space-y-4 bg-white">
                    {/* Representatives Section */}
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Authorized Representatives ({reps.length})
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            Point-of-contacts for orders, billing, and receiving
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openAddRepModal(client)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Representative
                        </button>
                      </div>

                      {reps.length === 0 ? (
                        <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                          No representatives added yet for this business profile.
                          <button
                            type="button"
                            onClick={() => openAddRepModal(client)}
                            className="ml-2 font-semibold text-emerald-700 hover:underline"
                          >
                            Add authorized contact now
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {reps.map((rep) => {
                            const badge = getRoleTagBadge(rep.roleTag);
                            return (
                              <div
                                key={rep._id || rep.email}
                                className={`rounded-xl border p-3.5 transition-all relative ${
                                  rep.isPrimary
                                    ? 'border-emerald-300 bg-emerald-50/20 shadow-xs'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                {rep.isPrimary && (
                                  <span className="absolute top-3 right-3 flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                    <Star className="h-2.5 w-2.5 fill-emerald-700 text-emerald-700" /> Primary
                                  </span>
                                )}

                                <div className="pr-16">
                                  <h5 className="text-sm font-bold text-slate-900">{rep.name}</h5>
                                  <p className="text-xs text-slate-600 font-medium">{rep.designation || 'Representative'}</p>
                                  <p className="text-[11px] text-slate-500">{rep.department || 'Operations'}</p>
                                </div>

                                <div className="mt-2.5">
                                  <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
                                    {badge.label}
                                  </span>
                                </div>

                                <div className="mt-3 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                                  <div className="flex items-center gap-2 truncate">
                                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <a
                                      href={`mailto:${rep.email}`}
                                      className="truncate hover:text-emerald-700 hover:underline"
                                    >
                                      {rep.email}
                                    </a>
                                  </div>
                                  {rep.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                      <a
                                        href={`tel:${rep.phone}`}
                                        className="hover:text-emerald-700 hover:underline"
                                      >
                                        {rep.phone}
                                      </a>
                                    </div>
                                  )}
                                  {rep.notes && (
                                    <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                                      "{rep.notes}"
                                    </p>
                                  )}
                                </div>

                                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                                  <span className="flex items-center gap-1 text-slate-500">
                                    <span
                                      className={`h-2 w-2 rounded-full ${
                                        rep.portalAccess !== false ? 'bg-emerald-500' : 'bg-slate-300'
                                      }`}
                                    />
                                    {rep.portalAccess !== false ? 'Portal Access Enabled' : 'No Web Access'}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditRepModal(client, rep)}
                                      className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                      title="Edit Representative"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRepresentative(client._id, rep._id)}
                                      className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                      title="Remove Representative"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Operational Details Footer */}
                    <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">Billing Address:</span>
                          <span>
                            {client.billingAddress?.street || 'N/A'}
                            {client.billingAddress?.city ? `, ${client.billingAddress.city}` : ''}
                            {client.billingAddress?.pincode ? ` - ${client.billingAddress.pincode}` : ''}
                          </span>
                        </div>
                        {client.contractDetails?.slaTerms && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">SLA Terms:</span>
                            <span className="text-slate-600">{client.contractDetails.slaTerms}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {client.totalOrdersCount > 0 && (
                          <span className="rounded-md bg-white px-2.5 py-1 font-semibold text-slate-700 border border-slate-200">
                            {client.totalOrdersCount} Lifetime Orders · {inr(client.totalLifetimeSpend)}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          Profile ID: {client._id}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  )}

      {/* MODAL 1: ADD / EDIT COMPANY PROFILE */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-700/10 p-2 text-emerald-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingCompanyId ? 'Edit B2B Client Profile' : 'New B2B Client Profile'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manage company corporate account, tax identifiers, and multiple representatives
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveCompany} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Optional: Link registered bulk user */}
              {!editingCompanyId && bulkUsers.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                    <div>
                      <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-emerald-700" />
                        Autofill from Registered Bulk Customer
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Choose a registered user with bulk account or shop details to automatically prefill company info
                      </p>
                    </div>
                    <select
                      onChange={(e) => handleSelectBulkUser(e.target.value)}
                      defaultValue=""
                      className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    >
                      <option value="">-- Select Registered User --</option>
                      {bulkUsers.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.shopName ? `${u.shopName} (${u.name})` : u.name} · {u.phone}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Section 1: Company Overview */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Building2 className="h-3.5 w-3.5" /> 1. Company Legal & Trade Identity
                </h4>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700">Legal Company Name *</label>
                    <input
                      type="text"
                      required
                      value={companyForm.companyName}
                      onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                      placeholder="e.g. Enterprise Client / Company Name"
                      className={`${INPUT} mt-1`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Brand / Trade Name (DBA)</label>
                    <input
                      type="text"
                      value={companyForm.tradeName}
                      onChange={(e) => setCompanyForm({ ...companyForm, tradeName: e.target.value })}
                      placeholder="e.g. Brand or Trade Name"
                      className={`${INPUT} mt-1`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Company Code</label>
                    <input
                      type="text"
                      value={companyForm.companyCode}
                      onChange={(e) => setCompanyForm({ ...companyForm, companyCode: e.target.value.toUpperCase() })}
                      placeholder="Auto-generated if empty"
                      className={`${INPUT} mt-1 font-mono uppercase`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Industry Category</label>
                    <select
                      value={companyForm.category}
                      onChange={(e) => setCompanyForm({ ...companyForm, category: e.target.value })}
                      className={`${INPUT} mt-1`}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Client Relationship Type</label>
                    <select
                      value={companyForm.clientType}
                      onChange={(e) => setCompanyForm({ ...companyForm, clientType: e.target.value })}
                      className={`${INPUT} mt-1`}
                    >
                      {CLIENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Account Status</label>
                    <select
                      value={companyForm.status}
                      onChange={(e) => setCompanyForm({ ...companyForm, status: e.target.value })}
                      className={`${INPUT} mt-1`}
                    >
                      <option value="active">Active</option>
                      <option value="pending_verification">Pending Verification</option>
                      <option value="under_review">Under Review</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Tax & Identifiers */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <BadgeCheck className="h-3.5 w-3.5" /> 2. Tax Identification & Registration
                </h4>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">GSTIN Number</label>
                    <input
                      type="text"
                      value={companyForm.gstin}
                      onChange={(e) => setCompanyForm({ ...companyForm, gstin: e.target.value.toUpperCase() })}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      className={`${INPUT} mt-1 font-mono uppercase`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">PAN Number</label>
                    <input
                      type="text"
                      value={companyForm.pan}
                      onChange={(e) => setCompanyForm({ ...companyForm, pan: e.target.value.toUpperCase() })}
                      placeholder="e.g. AAAAA0000A"
                      className={`${INPUT} mt-1 font-mono uppercase`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">CIN / LLP Registration ID</label>
                    <input
                      type="text"
                      value={companyForm.registrationNumber}
                      onChange={(e) => setCompanyForm({ ...companyForm, registrationNumber: e.target.value })}
                      placeholder="Registration Number / CIN"
                      className={`${INPUT} mt-1`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Commercial Terms & Dark Store Fulfillment */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <CreditCard className="h-3.5 w-3.5" /> 3. Commercial Terms & Dark Store Hub
                </h4>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Credit Limit (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={companyForm.creditLimit}
                      onChange={(e) => setCompanyForm({ ...companyForm, creditLimit: Number(e.target.value) })}
                      className={`${INPUT} mt-1`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Credit Terms (Days)</label>
                    <select
                      value={companyForm.creditDays}
                      onChange={(e) => setCompanyForm({ ...companyForm, creditDays: Number(e.target.value) })}
                      className={`${INPUT} mt-1`}
                    >
                      <option value="0">Immediate / Advance</option>
                      <option value="7">Net 7 Days</option>
                      <option value="15">Net 15 Days</option>
                      <option value="30">Net 30 Days</option>
                      <option value="45">Net 45 Days</option>
                      <option value="60">Net 60 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Pricing Tier</label>
                    <select
                      value={companyForm.contractDetails?.pricingTier}
                      onChange={(e) =>
                        setCompanyForm({
                          ...companyForm,
                          contractDetails: { ...companyForm.contractDetails, pricingTier: e.target.value },
                        })
                      }
                      className={`${INPUT} mt-1`}
                    >
                      {PRICING_TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {tier}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Assigned Dark Store Hub</label>
                    <select
                      value={companyForm.assignedDarkStore}
                      onChange={(e) => {
                        const val = e.target.value;
                        const store = darkStores.find((s) => (s.storeName || s.name) === val);
                        setCompanyForm({
                          ...companyForm,
                          assignedDarkStore: val,
                          darkStoreId: store?._id || '',
                        });
                      }}
                      className={`${INPUT} mt-1`}
                    >
                      <option value="">-- Select Fulfillment Hub --</option>
                      {darkStores.map((s) => (
                        <option key={s._id} value={s.storeName || s.name}>
                          {s.storeName || s.name} {s.city ? `(${s.city}${s.area ? ` - ${s.area}` : ''})` : ''}
                        </option>
                      ))}
                      {companyForm.assignedDarkStore &&
                        !darkStores.some((s) => (s.storeName || s.name) === companyForm.assignedDarkStore) && (
                          <option value={companyForm.assignedDarkStore}>{companyForm.assignedDarkStore}</option>
                        )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Address */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <MapPin className="h-3.5 w-3.5" /> 4. Registered Office & Billing Address
                </h4>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700">Street Address</label>
                    <input
                      type="text"
                      value={companyForm.billingAddress?.street}
                      onChange={(e) =>
                        setCompanyForm({
                          ...companyForm,
                          billingAddress: { ...companyForm.billingAddress, street: e.target.value },
                        })
                      }
                      placeholder="Building, street, commercial park"
                      className={`${INPUT} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">City</label>
                    <input
                      type="text"
                      value={companyForm.billingAddress?.city}
                      onChange={(e) =>
                        setCompanyForm({
                          ...companyForm,
                          billingAddress: { ...companyForm.billingAddress, city: e.target.value },
                        })
                      }
                      placeholder="City"
                      className={`${INPUT} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Pincode</label>
                    <input
                      type="text"
                      value={companyForm.billingAddress?.pincode}
                      onChange={(e) =>
                        setCompanyForm({
                          ...companyForm,
                          billingAddress: { ...companyForm.billingAddress, pincode: e.target.value },
                        })
                      }
                      placeholder="Pincode"
                      className={`${INPUT} mt-1`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Representatives Roster */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> 5. Multiple Representatives & Authorized Contacts (
                    {companyForm.representatives.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addRepToCompanyForm}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Another Representative
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {companyForm.representatives.map((rep, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Representative #{idx + 1}</span>
                        {companyForm.representatives.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRepFromCompanyForm(idx)}
                            className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-0.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Full Name *</label>
                          <input
                            type="text"
                            required
                            value={rep.name}
                            onChange={(e) => updateRepInCompanyForm(idx, 'name', e.target.value)}
                            placeholder="e.g. Authorized Contact Name"
                            className={`${INPUT} mt-0.5 py-1.5 text-xs`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Corporate Email *</label>
                          <input
                            type="email"
                            required
                            value={rep.email}
                            onChange={(e) => updateRepInCompanyForm(idx, 'email', e.target.value)}
                            placeholder="contact@company.com"
                            className={`${INPUT} mt-0.5 py-1.5 text-xs`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Direct Phone</label>
                          <input
                            type="text"
                            value={rep.phone}
                            onChange={(e) => updateRepInCompanyForm(idx, 'phone', e.target.value)}
                            placeholder="+91 98000 00000"
                            className={`${INPUT} mt-0.5 py-1.5 text-xs`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Designation</label>
                          <input
                            type="text"
                            value={rep.designation}
                            onChange={(e) => updateRepInCompanyForm(idx, 'designation', e.target.value)}
                            placeholder="e.g. Procurement Lead"
                            className={`${INPUT} mt-0.5 py-1.5 text-xs`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Role Authority</label>
                          <select
                            value={rep.roleTag}
                            onChange={(e) => updateRepInCompanyForm(idx, 'roleTag', e.target.value)}
                            className={`${INPUT} mt-0.5 py-1.5 text-xs`}
                          >
                            {ROLE_TAGS.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-4 pt-4">
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rep.isPrimary}
                              onChange={(e) => updateRepInCompanyForm(idx, 'isPrimary', e.target.checked)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            Primary Rep
                          </label>
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rep.portalAccess !== false}
                              onChange={(e) => updateRepInCompanyForm(idx, 'portalAccess', e.target.checked)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            Portal Access
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 6: Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Internal Operational Notes</label>
                <textarea
                  rows="2"
                  value={companyForm.notes}
                  onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
                  placeholder="Special SLA guidelines, preferred dark store dispatch schedule, cold chain specs..."
                  className={`${INPUT} mt-1`}
                />
              </div>

              {/* Modal Footer inside form */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCompany}
                  className={`${BTN_PRIMARY} min-w-32`}
                >
                  {submittingCompany ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : editingCompanyId ? (
                    'Update Company Profile'
                  ) : (
                    'Create B2B Profile'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT SINGLE REPRESENTATIVE */}
      {isRepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingRepId ? 'Edit Representative' : 'Add Representative'}
                  </h3>
                  <p className="text-xs text-slate-500">For {targetCompany?.companyName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRepModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRepresentative} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={repForm.name}
                  onChange={(e) => setRepForm({ ...repForm, name: e.target.value })}
                  placeholder="e.g. Authorized Representative Name"
                  className={`${INPUT} mt-1`}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Corporate Email *</label>
                  <input
                    type="email"
                    required
                    value={repForm.email}
                    onChange={(e) => setRepForm({ ...repForm, email: e.target.value })}
                    placeholder="name@company.com"
                    className={`${INPUT} mt-1`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Direct Phone</label>
                  <input
                    type="text"
                    value={repForm.phone}
                    onChange={(e) => setRepForm({ ...repForm, phone: e.target.value })}
                    placeholder="+91 98000 00000"
                    className={`${INPUT} mt-1`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Designation</label>
                  <input
                    type="text"
                    value={repForm.designation}
                    onChange={(e) => setRepForm({ ...repForm, designation: e.target.value })}
                    placeholder="e.g. Procurement Lead"
                    className={`${INPUT} mt-1`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Department</label>
                  <input
                    type="text"
                    value={repForm.department}
                    onChange={(e) => setRepForm({ ...repForm, department: e.target.value })}
                    placeholder="e.g. Supply Chain & SCM"
                    className={`${INPUT} mt-1`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Role & Authority Tag</label>
                <select
                  value={repForm.roleTag}
                  onChange={(e) => setRepForm({ ...repForm, roleTag: e.target.value })}
                  className={`${INPUT} mt-1`}
                >
                  {ROLE_TAGS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repForm.isPrimary}
                    onChange={(e) => setRepForm({ ...repForm, isPrimary: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  Primary Business Representative
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repForm.portalAccess}
                    onChange={(e) => setRepForm({ ...repForm, portalAccess: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  Enable Portal Access
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Notes & Authorization Scope</label>
                <input
                  type="text"
                  value={repForm.notes}
                  onChange={(e) => setRepForm({ ...repForm, notes: e.target.value })}
                  placeholder="Special approval authority, dock receiver, etc."
                  className={`${INPUT} mt-1`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRepModalOpen(false)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRep}
                  className={`${BTN_PRIMARY} min-w-28`}
                >
                  {submittingRep ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save Representative'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900">Delete B2B Profile?</h3>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-semibold text-slate-800">{deleteConfirmation.name}</span>?
              All associated representatives, billing profiles, and assigned credit allocations will be removed.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className={BTN}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCompany}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Yes, Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
