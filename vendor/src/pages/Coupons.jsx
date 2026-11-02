import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  Tag,
  Percent,
  Calendar,
  Clock,
  Sparkles,
  LayoutGrid,
  List,
  ArrowUpDown,
  Copy,
  Check,
  X,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Gift,
  Coins,
  Ticket,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Users,
  Loader2,
} from 'lucide-react';
import couponApi from '../api/couponApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../utils/ui';

const PRESET_TEMPLATES = [
  {
    name: 'Welcome 20% OFF',
    code: 'WELCOME20',
    title: '20% OFF on First Order',
    discountType: 'percentage',
    discountValue: 20,
    minOrderAmount: 299,
    maxRedemptionsPerUser: 1,
    maxTotalRedemptions: 1000,
    daysValid: 90,
    badge: 'New User',
  },
  {
    name: 'Flat ₹50 OFF',
    code: 'FRESH50',
    title: 'Flat ₹50 OFF on Ready2Cook & Produce',
    discountType: 'fixed',
    discountValue: 50,
    minOrderAmount: 399,
    maxRedemptionsPerUser: null,
    maxTotalRedemptions: 500,
    daysValid: 30,
    badge: 'Popular',
  },
  {
    name: 'Mega ₹100 OFF',
    code: 'SUPER100',
    title: 'Flat ₹100 OFF on SuperMall Pantry',
    discountType: 'fixed',
    discountValue: 100,
    minOrderAmount: 699,
    maxRedemptionsPerUser: null,
    maxTotalRedemptions: 500,
    daysValid: 30,
    badge: 'High Value',
  },
  {
    name: 'Festive 15% OFF',
    code: 'FESTIVE15',
    title: '15% Instant Savings on Festive Baskets',
    discountType: 'percentage',
    discountValue: 15,
    minOrderAmount: 499,
    maxRedemptionsPerUser: 3,
    maxTotalRedemptions: 2000,
    daysValid: 15,
    badge: 'Festive',
  },
];

const formatDateInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDisplayDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getStatusInfo = (coupon) => {
  if (!coupon.isActive) {
    return {
      status: 'inactive',
      label: 'Inactive',
      color: 'bg-slate-100 text-slate-600 border-slate-200',
    };
  }
  const now = new Date();
  const start = new Date(coupon.startDate);
  const end = new Date(coupon.endDate);

  if (now < start) {
    return {
      status: 'scheduled',
      label: 'Scheduled',
      color: 'bg-slate-50 text-slate-700 border-slate-200',
    };
  }
  if (now > end) {
    return {
      status: 'expired',
      label: 'Expired',
      color: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }
  return {
    status: 'active',
    label: 'Active',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
};

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, scheduled, expired, inactive
  const [typeFilter, setTypeFilter] = useState('all'); // all, percentage, fixed
  const [sortBy, setSortBy] = useState('newest'); // newest, expiring, discount, redemptions
  const [viewMode, setViewMode] = useState('grid'); // grid, table

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [deletingCoupon, setDeletingCoupon] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 199,
    startDate: '',
    endDate: '',
    isActive: true,
    maxRedemptionsPerUser: '',
    maxTotalRedemptions: '',
    isTotalUnlimited: true,
    isUserUnlimited: true,
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = (text, label = 'Coupon code') => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} "${text}" to clipboard!`);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await couponApi.getAllCoupons({ limit: 200 });
      if (res.success && Array.isArray(res.data)) {
        setCoupons(res.data);
      } else if (Array.isArray(res)) {
        setCoupons(res);
      }
    } catch (err) {
      console.error('Failed to load coupons:', err);
      showToast('Could not load coupons from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Metrics
  const metrics = useMemo(() => {
    const total = coupons.length;
    let active = 0;
    let scheduled = 0;
    let expired = 0;
    let inactive = 0;
    let totalRedemptions = 0;

    const now = new Date();
    coupons.forEach((c) => {
      totalRedemptions += Number(c.totalRedemptions || 0);
      if (!c.isActive) {
        inactive += 1;
      } else {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        if (now < start) scheduled += 1;
        else if (now > end) expired += 1;
        else active += 1;
      }
    });

    return { total, active, scheduled, expired, inactive, totalRedemptions };
  }, [coupons]);

  // Filtered & Sorted Coupons
  const filteredCoupons = useMemo(() => {
    let result = coupons.filter((c) => {
      const matchSearch =
        !searchTerm ||
        c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.title?.toLowerCase().includes(searchTerm.toLowerCase());

      const statusInfo = getStatusInfo(c);
      const matchStatus =
        statusFilter === 'all' ? true : statusInfo.status === statusFilter;

      const matchType =
        typeFilter === 'all' ? true : c.discountType === typeFilter;

      return matchSearch && matchStatus && matchType;
    });

    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (sortBy === 'expiring') {
        return new Date(a.endDate || 0) - new Date(b.endDate || 0);
      }
      if (sortBy === 'discount') {
        return Number(b.discountValue || 0) - Number(a.discountValue || 0);
      }
      if (sortBy === 'redemptions') {
        return Number(b.totalRedemptions || 0) - Number(a.totalRedemptions || 0);
      }
      return 0;
    });

    return result;
  }, [coupons, searchTerm, statusFilter, typeFilter, sortBy]);

  // Modal Handlers
  const handleOpenCreateModal = (preset = null) => {
    setEditingCoupon(null);
    const now = new Date();
    const defaultEnd = new Date(now.getTime() + (preset?.daysValid || 30) * 24 * 60 * 60 * 1000);

    setFormData({
      code: preset ? preset.code : '',
      title: preset ? preset.title : '',
      discountType: preset ? preset.discountType : 'percentage',
      discountValue: preset ? preset.discountValue : 10,
      minOrderAmount: preset ? preset.minOrderAmount : 199,
      startDate: formatDateInput(now),
      endDate: formatDateInput(defaultEnd),
      isActive: true,
      maxRedemptionsPerUser: preset?.maxRedemptionsPerUser || '',
      maxTotalRedemptions: preset?.maxTotalRedemptions || '',
      isTotalUnlimited: !preset?.maxTotalRedemptions,
      isUserUnlimited: !preset?.maxRedemptionsPerUser,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code || '',
      title: coupon.title || '',
      discountType: coupon.discountType || 'percentage',
      discountValue: coupon.discountValue || 0,
      minOrderAmount: coupon.minOrderAmount || 0,
      startDate: formatDateInput(coupon.startDate),
      endDate: formatDateInput(coupon.endDate),
      isActive: coupon.isActive !== undefined ? coupon.isActive : true,
      maxRedemptionsPerUser: coupon.maxRedemptionsPerUser || '',
      maxTotalRedemptions: coupon.maxTotalRedemptions || '',
      isTotalUnlimited: coupon.maxTotalRedemptions === null || coupon.maxTotalRedemptions === undefined,
      isUserUnlimited: coupon.maxRedemptionsPerUser === null || coupon.maxRedemptionsPerUser === undefined,
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (coupon) => {
    try {
      const updatedStatus = !coupon.isActive;
      const res = await couponApi.updateCoupon(coupon._id, { isActive: updatedStatus });
      if (res.success) {
        showToast(`Coupon ${coupon.code} ${updatedStatus ? 'Activated' : 'Disabled'}`);
        setCoupons((prev) =>
          prev.map((c) => (c._id === coupon._id ? { ...c, isActive: updatedStatus } : c))
        );
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = formData.code.trim().toUpperCase();
    if (!cleanCode) {
      showToast('Coupon code is required', 'error');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      showToast('Start and end dates are required', 'error');
      return;
    }
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      showToast('End date must be after start date', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        code: cleanCode,
        title: formData.title.trim(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue) || 0,
        minOrderAmount: Number(formData.minOrderAmount) || 0,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        isActive: Boolean(formData.isActive),
        maxRedemptionsPerUser: formData.isUserUnlimited ? null : Number(formData.maxRedemptionsPerUser) || 1,
        maxTotalRedemptions: formData.isTotalUnlimited ? null : Number(formData.maxTotalRedemptions) || 100,
      };

      if (editingCoupon) {
        const res = await couponApi.updateCoupon(editingCoupon._id, payload);
        if (res.success) {
          showToast(`Updated coupon "${cleanCode}"`);
          setIsModalOpen(false);
          loadData();
        } else {
          showToast(res.message || 'Update failed', 'error');
        }
      } else {
        const res = await couponApi.createCoupon(payload);
        if (res.success) {
          showToast(`Created coupon "${cleanCode}"`);
          setIsModalOpen(false);
          loadData();
        } else {
          showToast(res.message || 'Creation failed', 'error');
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Action failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCoupon) return;
    try {
      setIsSubmitting(true);
      const res = await couponApi.deleteCoupon(deletingCoupon._id);
      if (res.success) {
        showToast(`Deleted coupon "${deletingCoupon.code}"`);
        setDeletingCoupon(null);
        loadData();
      } else {
        showToast(res.message || 'Delete failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setIsSubmitting(true);
      const res = await couponApi.seedDefaultCoupons();
      if (res.success) {
        showToast('Seeded default promo coupons successfully!');
        loadData();
      } else {
        showToast(res.message || 'Seeding failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Seeding failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={PAGE_KICKER}>Promotions</p>
          <h1 className={PAGE_TITLE}>Coupons & Offers</h1>
          <p className={PAGE_SUB}>
            Create, schedule, and monitor discount codes for customer campaigns
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={isSubmitting}
            className={BTN}
            title="Seed starter promo coupons"
          >
            <Sparkles className="mr-1.5 h-4 w-4 text-emerald-600" />
            Seed Defaults
          </button>
          <button type="button" onClick={() => handleOpenCreateModal()} className={BTN_PRIMARY}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Coupon
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total coupons', value: metrics.total, hint: 'All campaigns' },
          { label: 'Active', value: metrics.active, hint: 'Live in storefront' },
          { label: 'Scheduled', value: metrics.scheduled, hint: 'Starts later' },
          { label: 'Redemptions', value: metrics.totalRedemptions, hint: 'Orders redeemed' },
        ].map((item) => (
          <div key={item.label} className={`${PANEL} p-4`}>
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{item.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className={`${PANEL} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-emerald-700" />
            <h3 className="text-sm font-semibold text-slate-800">Quick promo presets</h3>
          </div>
          <span className="text-[11px] text-slate-400">Click to load a template</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {PRESET_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.code}
              type="button"
              onClick={() => handleOpenCreateModal(tmpl)}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50"
            >
              <div>
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="rounded-md border border-emerald-100 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                    {tmpl.badge}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {tmpl.discountType === 'percentage'
                      ? `${tmpl.discountValue}% OFF`
                      : `₹${tmpl.discountValue} OFF`}
                  </span>
                </div>
                <p className="truncate text-xs font-bold text-slate-900">{tmpl.code}</p>
                <p className="mt-0.5 truncate text-[10.5px] text-slate-500">
                  Min ₹{tmpl.minOrderAmount} · {tmpl.daysValid} Days
                </p>
              </div>
              <span className="mt-2 flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 transition group-hover:translate-x-0.5">
                Use template →
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={`${PANEL} p-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Catalog coupons</h2>
            <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {filteredCoupons.length} items
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search code or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${INPUT} py-2 pl-9 pr-8 text-xs`}
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-600">
              <ArrowUpDown className="h-3 w-3 shrink-0 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="cursor-pointer bg-transparent text-xs focus:outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="expiring">Expiring Soon</option>
                <option value="discount">Highest Discount</option>
                <option value="redemptions">Most Redeemed</option>
              </select>
            </div>

            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {['all', 'percentage', 'fixed'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTypeFilter(key)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition ${
                    typeFilter === key
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {key === 'all' ? 'All types' : key}
                </button>
              ))}
            </div>

            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {['all', 'active', 'scheduled', 'expired', 'inactive'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition ${
                    statusFilter === status
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`rounded-lg p-1.5 transition ${
                  viewMode === 'grid'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-lg p-1.5 transition ${
                  viewMode === 'table'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Table View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`${PANEL} flex justify-center py-20 text-slate-400`}>
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className={`${PANEL} px-6 py-16 text-center`}>
          <Ticket className="mx-auto h-10 w-10 text-emerald-600/30" />
          <h3 className="mt-3 text-base font-semibold text-slate-800">No coupons found</h3>
          <p className="mt-1 text-sm text-slate-400">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No coupons match your search or filters.'
              : 'Get started by creating your first promotional coupon.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button type="button" onClick={() => handleOpenCreateModal()} className={BTN_PRIMARY}>
              Create Coupon
            </button>
            <button type="button" onClick={handleSeedDefaults} className={BTN}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              Seed Defaults
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCoupons.map((coupon) => {
            const statusInfo = getStatusInfo(coupon);
            const isPercentage = coupon.discountType === 'percentage';

            return (
              <article
                key={coupon._id || coupon.code}
                className={`${PANEL} flex flex-col justify-between overflow-hidden transition hover:border-emerald-300 ${
                  coupon.isActive ? '' : 'opacity-65'
                }`}
              >
                <div
                  className={`flex items-start justify-between gap-3 border-b border-dashed border-slate-200 p-4 ${
                    isPercentage ? 'bg-emerald-50/50' : 'bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-wider text-slate-900 sm:text-base">
                        {coupon.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(coupon.code)}
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Copy code"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-slate-600">
                      {coupon.title ||
                        (isPercentage
                          ? `${coupon.discountValue}% Discount`
                          : `₹${coupon.discountValue} OFF`)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold ${statusInfo.color}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    <span>{statusInfo.label}</span>
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-between space-y-3 p-4">
                  <div className="space-y-2 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-medium text-slate-500">Discount value</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {isPercentage
                          ? `${coupon.discountValue}% OFF`
                          : `₹${coupon.discountValue} FLAT OFF`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">Min. order</span>
                      <span className="font-semibold text-slate-800">
                        {coupon.minOrderAmount > 0 ? `₹${coupon.minOrderAmount}` : 'No Minimum'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">Validity</span>
                      <span className="text-[11px] font-medium text-slate-700">
                        {formatDisplayDate(coupon.startDate)} – {formatDisplayDate(coupon.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-[11px]">
                      <span className="text-slate-500">Redemptions</span>
                      <span className="font-semibold text-slate-900">
                        {coupon.totalRedemptions || 0}
                        {coupon.maxTotalRedemptions
                          ? ` / ${coupon.maxTotalRedemptions}`
                          : ' (Unlimited)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(coupon)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                        coupon.isActive
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {coupon.isActive ? 'Active ✓' : 'Disabled'}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(coupon)}
                        className={`${BTN} h-8 min-h-0 px-2`}
                        title="Edit Coupon"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCoupon(coupon)}
                        className={`${BTN} h-8 min-h-0 px-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}
                        title="Delete Coupon"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={`${PANEL} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className={TH}>Code & Campaign</th>
                  <th className={TH}>Discount</th>
                  <th className={TH}>Min Order</th>
                  <th className={TH}>Validity</th>
                  <th className={`${TH} text-center`}>Uses</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCoupons.map((coupon) => {
                  const statusInfo = getStatusInfo(coupon);
                  const isPercentage = coupon.discountType === 'percentage';

                  return (
                    <tr
                      key={coupon._id || coupon.code}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{coupon.code}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(coupon.code)}
                            className="text-slate-400 hover:text-slate-700"
                            title="Copy code"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        {coupon.title ? (
                          <p className="max-w-xs truncate text-[11px] text-slate-500">{coupon.title}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 font-semibold text-emerald-700">
                        {isPercentage
                          ? `${coupon.discountValue}% OFF`
                          : `₹${coupon.discountValue} FLAT`}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">
                        {coupon.minOrderAmount > 0 ? `₹${coupon.minOrderAmount}` : 'None'}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-slate-500">
                        {formatDisplayDate(coupon.startDate)} – {formatDisplayDate(coupon.endDate)}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold tabular-nums">
                        {coupon.totalRedemptions || 0}
                        {coupon.maxTotalRedemptions ? ` / ${coupon.maxTotalRedemptions}` : ''}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(coupon)}
                            className={`rounded-lg border p-1.5 text-xs font-semibold transition ${
                              coupon.isActive
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                            title="Toggle Status"
                          >
                            {coupon.isActive ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(coupon)}
                            className={`${BTN} h-8 min-h-0 px-2`}
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCoupon(coupon)}
                            className={`${BTN} h-8 min-h-0 px-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div
            className={`relative max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto ${PANEL} p-5 shadow-xl sm:p-6`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className={PAGE_KICKER}>Coupon</p>
                <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                  {editingCoupon
                    ? `Edit Coupon: ${editingCoupon.code}`
                    : 'Create New Promotional Coupon'}
                </h3>
                <p className="text-xs text-slate-400">
                  Configure discount code, limits, and validity dates
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-slate-50/70 p-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Coupon Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GREEN20"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                        }))
                      }
                      className={`${INPUT} font-mono font-bold uppercase`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Campaign Title / Tagline
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flat 20% OFF on Organic Produce"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      className={INPUT}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-slate-50/70 p-3.5">
                <label className="block text-xs font-semibold text-slate-800">
                  Discount Calculation Structure
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setFormData((p) => ({ ...p, discountType: 'percentage' }))}
                    className={`cursor-pointer rounded-xl border p-3 transition ${
                      formData.discountType === 'percentage'
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-emerald-700" />
                      <span className="text-xs font-bold">Percentage (%)</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Deducts % discount from cart subtotal
                    </p>
                  </div>
                  <div
                    onClick={() => setFormData((p) => ({ ...p, discountType: 'fixed' }))}
                    className={`cursor-pointer rounded-xl border p-3 transition ${
                      formData.discountType === 'fixed'
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-emerald-700" />
                      <span className="text-xs font-bold">Fixed Flat (₹)</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Deducts fixed rupee value from subtotal
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Discount Value ({formData.discountType === 'percentage' ? '%' : '₹'}){' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={formData.discountType === 'percentage' ? 100 : 10000}
                      value={formData.discountValue}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, discountValue: e.target.value }))
                      }
                      className={`${INPUT} font-semibold`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Minimum Order Value (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0 for no minimum"
                      value={formData.minOrderAmount}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, minOrderAmount: e.target.value }))
                      }
                      className={`${INPUT} font-semibold`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-slate-50/70 p-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Start Date & Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      End Date / Expiry <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                      className={INPUT}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">Total Uses Limit</label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            isTotalUnlimited: !p.isTotalUnlimited,
                            maxTotalRedemptions: !p.isTotalUnlimited ? '' : 500,
                          }))
                        }
                        className="cursor-pointer text-[10px] font-semibold text-emerald-700 hover:underline"
                      >
                        {formData.isTotalUnlimited ? 'Set Limit' : 'Make Unlimited'}
                      </button>
                    </div>
                    {formData.isTotalUnlimited ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-400">
                        Unlimited Total Uses
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 500"
                        value={formData.maxTotalRedemptions}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            maxTotalRedemptions: e.target.value,
                          }))
                        }
                        className={`${INPUT} font-semibold`}
                      />
                    )}
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        Uses Per Customer
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            isUserUnlimited: !p.isUserUnlimited,
                            maxRedemptionsPerUser: !p.isUserUnlimited ? '' : 1,
                          }))
                        }
                        className="cursor-pointer text-[10px] font-semibold text-emerald-700 hover:underline"
                      >
                        {formData.isUserUnlimited ? 'Set Limit' : 'Make Unlimited'}
                      </button>
                    </div>
                    {formData.isUserUnlimited ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-400">
                        Unlimited Per Customer
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 1 (First order only)"
                        value={formData.maxRedemptionsPerUser}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            maxRedemptionsPerUser: e.target.value,
                          }))
                        }
                        className={`${INPUT} font-semibold`}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Active in Storefront</p>
                    <p className="text-[10px] text-slate-400">
                      Allow customers to claim and apply this coupon immediately
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-10 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-700 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className={BTN}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className={BTN_PRIMARY}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      {editingCoupon ? 'Update Coupon' : 'Publish Coupon'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm space-y-3 p-5 text-center shadow-xl ${PANEL}`}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Delete Coupon &quot;{deletingCoupon.code}&quot;?
            </h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to permanently delete this coupon? Customers will no longer be
              able to apply it at checkout.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button type="button" onClick={() => setDeletingCoupon(null)} className={BTN}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-600 bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
