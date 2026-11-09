import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpDown,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Package,
  Pencil,
  Percent,
  Phone,
  ShieldCheck,
  Sprout,
  Store,
  Trash2,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Warehouse,
  XCircle,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import darkStoreApi from '../../api/darkStoreApi';
import { BTN, BTN_PRIMARY, PANEL } from '../../utils/ui';
import { DOCUMENT_TYPES, StatusPill, formatDate, openVendorDocument } from './multiVendorShared';

function CopyBadge({ label, value, icon: Icon }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Click to copy ${label || value}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
    >
      {Icon && <Icon className="h-3.5 w-3.5 text-slate-500" />}
      {label && <span className="text-slate-500 font-normal">{label}:</span>}
      <span className="font-semibold text-slate-800">{value}</span>
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-400" />}
    </button>
  );
}

function DetailItem({ label, value, icon: Icon, copyable, isLink, href, children }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:bg-slate-50 hover:border-slate-200 transition">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        {label}
      </span>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0 break-words text-sm font-semibold text-slate-800">
          {children ? (
            children
          ) : isLink && href ? (
            <a href={href} className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-semibold">
              {value}
            </a>
          ) : value === 0 ? (
            0
          ) : value ? (
            value
          ) : (
            <span className="text-slate-400 font-normal italic">Not specified</span>
          )}
        </div>
        {copyable && value ? (
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition"
            title="Copy value"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function MultiVendorDetailPage() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [allStores, setAllStores] = useState([]);
  const [vendorNames, setVendorNames] = useState({});
  const [assignId, setAssignId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [products, setProducts] = useState([]);
  const [crops, setCrops] = useState([]);
  const [productRequests, setProductRequests] = useState([]);
  const [requestBusyId, setRequestBusyId] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      const res = await opsApi.get(`vendors/${vendorId}/products`);
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setProducts([]);
    }
  }, [vendorId]);

  const loadCrops = useCallback(async () => {
    try {
      const res = await opsApi.get(`vendors/${vendorId}/crops`);
      setCrops(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCrops([]);
    }
  }, [vendorId]);

  const loadProductRequests = useCallback(async () => {
    try {
      const res = await opsApi.list('vendor-product-requests', { vendorId, status: 'Pending' });
      setProductRequests(Array.isArray(res.data) ? res.data : []);
    } catch {
      setProductRequests([]);
    }
  }, [vendorId]);

  useEffect(() => {
    loadProducts();
    loadCrops();
    loadProductRequests();
  }, [loadProducts, loadCrops, loadProductRequests]);

  const approveProductRequest = async (reqItem) => {
    if (!window.confirm(`Approve and add "${reqItem.productName}" to this vendor's catalog?`)) return;
    setRequestBusyId(reqItem.id);
    try {
      await opsApi.create(`vendor-product-requests/${reqItem.id}/approve`, {});
      await Promise.all([loadProductRequests(), loadProducts()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not approve request');
    } finally {
      setRequestBusyId('');
    }
  };

  const rejectProductRequest = async (reqItem) => {
    const reason = window.prompt(`Reason for rejecting "${reqItem.productName}":`, 'Not suitable for current catalog');
    if (!reason) return;
    setRequestBusyId(reqItem.id);
    try {
      await opsApi.create(`vendor-product-requests/${reqItem.id}/reject`, { remarks: reason });
      await loadProductRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reject request');
    } finally {
      setRequestBusyId('');
    }
  };

  const removeCrop = async (crop) => {
    if (!window.confirm(`Remove "${crop.cropName}" from this collection centre?`)) return;
    try {
      await opsApi.remove(`vendors/${vendorId}/crops`, encodeURIComponent(crop.cropId));
      await loadCrops();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove crop');
    }
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`Remove "${product.name}" from this collection centre?`)) return;
    try {
      await opsApi.remove(`vendors/${vendorId}/products`, product.productId);
      await loadProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove product');
    }
  };

  const loadStores = useCallback(async () => {
    const [storeRes, vendorRes] = await Promise.all([
      darkStoreApi.list().catch(() => ({ stores: [] })),
      opsApi.list('vendors').catch(() => ({ data: [] })),
    ]);
    setAllStores(storeRes.stores || []);
    const names = {};
    (Array.isArray(vendorRes.data) ? vendorRes.data : []).forEach((v) => {
      names[v.id] = v.vendorName || v.ownerName || v.id;
    });
    setVendorNames(names);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    opsApi
      .get(`vendors/${vendorId}`)
      .then((res) => alive && setRow(res.data))
      .catch((err) => alive && setError(err.response?.data?.message || 'Collection centre not found'))
      .finally(() => alive && setLoading(false));
    loadStores();
    return () => {
      alive = false;
    };
  }, [vendorId, loadStores]);

  useEffect(() => {
    if (row?.vendorType === 'seller' && (activeTab === 'collection-centre' || activeTab === 'crops')) {
      setActiveTab('overview');
    }
  }, [row?.vendorType, activeTab]);

  const vendorNameOf = (id) => vendorNames[id] || 'another centre';
  const assignableStores = allStores.filter((store) => store.vendorId !== vendorId);

  const assignStore = async (storeId, targetVendorId) => {
    setAssigning(true);
    setError('');
    try {
      await darkStoreApi.updateLocation(storeId, { vendorId: targetVendorId });
      const res = await opsApi.get(`vendors/${vendorId}`);
      setRow(res.data);
      setAssignId('');
      await loadStores();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update dark store assignment');
    } finally {
      setAssigning(false);
    }
  };

  const viewDocument = async (doc) => {
    try {
      await openVendorDocument(row.id, doc);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open document');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete collection centre "${row.vendorName || row.ownerName}"?`)) return;
    try {
      await opsApi.remove('vendors', row.id);
      navigate('/multi-vendor');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete collection centre');
    }
  };

  const handleEdit = () =>
    navigate('/multi-vendor', { state: { editId: row.id, returnTo: `/multi-vendor/${row.id}` } });

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="text-sm font-medium">Loading vendor profile...</span>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <Link to="/multi-vendor" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Multi Vendor
        </Link>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          <p className="font-semibold">{error || 'Collection centre not found'}</p>
        </div>
      </div>
    );
  }

  const centre = row.collectionCentre;
  const documents = row.documents || [];
  const darkStores = row.darkStores || [];
  const bank = row.bank || {};
  const vendorDisplayName = row.vendorName || row.businessName || row.ownerName || 'Vendor';
  const ccCode = centre?.id || 'GGC-CC-MH-NK-NAS-NAS-001';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/multi-vendor"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Multi Vendor
        </Link>
        <span className="text-xs text-slate-400 font-medium">
          Vendor Management · ID: <span className="font-mono text-slate-600">{row.id}</span>
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Hero Vendor Profile Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Vendor Identity & Avatar */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-700/20">
              <Warehouse className="h-8 w-8 text-white" />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-2xs">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {vendorDisplayName}
                </h1>
                <StatusPill status={row.status} />
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    row.vendorType === 'seller'
                      ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-200'
                      : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                  }`}
                >
                  {row.vendorType === 'seller' ? '🏪 Seller Vendor' : '🌾 Farmer Vendor'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Verified Vendor
                </span>
              </div>

              {row.businessName && row.businessName !== vendorDisplayName ? (
                <p className="text-sm font-medium text-slate-600">Legal Name: {row.businessName}</p>
              ) : null}

              {/* Identification Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <CopyBadge
                  label={row.vendorType === 'seller' ? 'Vendor Code' : 'CC Code'}
                  value={row.vendorType === 'seller' ? (row.vendorCode || row.id) : ccCode}
                  icon={row.vendorType === 'seller' ? Store : Warehouse}
                />
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs">
                  <Percent className="h-3.5 w-3.5 text-slate-400" />
                  Commission: <strong className="text-slate-900">{row.commissionRate != null ? `${row.commissionRate}%` : '—'}</strong>
                </span>
              </div>

              {/* Assigned Zones */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Assigned Zones:
                </span>
                {(row.zones || []).length > 0 ? (
                  (row.zones || []).map((z, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200"
                    >
                      <MapPin className="h-3 w-3 text-emerald-600" />
                      {z}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No zones assigned yet</span>
                )}
              </div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5 self-start shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition shadow-2xs"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Vendor
            </button>
          </div>
        </div>

        {/* Quick Contact & Facility Strip */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 font-medium">Owner</p>
              <p className="font-semibold text-slate-800 truncate">{row.ownerName || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 font-medium">Mobile (Login)</p>
              {row.mobile ? (
                <a href={`tel:${row.mobile}`} className="font-semibold text-emerald-700 hover:underline">
                  +91 {row.mobile}
                </a>
              ) : (
                <p className="font-semibold text-slate-800">—</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 font-medium">Email Address</p>
              {row.email ? (
                <a href={`mailto:${row.email}`} className="font-semibold text-blue-700 hover:underline truncate block">
                  {row.email}
                </a>
              ) : (
                <p className="font-semibold text-slate-800">—</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 font-medium">Primary Hub Location</p>
              <p className="font-semibold text-slate-800 truncate">
                {[row.city, row.state].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className={`grid grid-cols-2 gap-3.5 sm:grid-cols-3 ${row.vendorType === 'seller' ? 'lg:grid-cols-3' : 'lg:grid-cols-5'}`}>
        {/* Approved Products Stat Card */}
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition shadow-2xs hover:border-emerald-500 hover:shadow-sm ${
            activeTab === 'products' ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Products</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <Package className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">{products.length}</span>
            <p className="text-[11px] font-medium text-emerald-700 mt-0.5">Approved in catalog</p>
          </div>
        </button>

        {/* Dark Stores Stat Card */}
        <button
          type="button"
          onClick={() => setActiveTab('dark-stores')}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition shadow-2xs hover:border-blue-500 hover:shadow-sm ${
            activeTab === 'dark-stores' ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Dark Stores</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
              <Store className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">{darkStores.length}</span>
            <p className="text-[11px] font-medium text-blue-700 mt-0.5">Linked distribution hubs</p>
          </div>
        </button>

        {row.vendorType !== 'seller' && (
          <>
            {/* Collection Centre Stat Card */}
            <button
              type="button"
              onClick={() => setActiveTab('collection-centre')}
              className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition shadow-2xs hover:border-purple-500 hover:shadow-sm ${
                activeTab === 'collection-centre' ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-500/20' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Collection Centre</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-800">
                  <Warehouse className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-sm font-bold text-slate-900 truncate block">
                  {centre?.name || 'Main Centre'}
                </span>
                <p className="text-[11px] font-medium text-purple-700 mt-0.5 font-mono truncate">{ccCode}</p>
              </div>
            </button>

            {/* Crops Stat Card */}
            <button
              type="button"
              onClick={() => setActiveTab('crops')}
              className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition shadow-2xs hover:border-amber-500 hover:shadow-sm ${
                activeTab === 'crops' ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-500/20' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Assigned Crops</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                  <Sprout className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-900">{crops.length}</span>
                <p className="text-[11px] font-medium text-amber-700 mt-0.5">Crop procurement varieties</p>
              </div>
            </button>
          </>
        )}

        {/* Documents & KYC Stat Card */}
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition shadow-2xs hover:border-slate-400 hover:shadow-sm ${
            activeTab === 'documents' ? 'border-slate-600 bg-slate-100/50 ring-2 ring-slate-400/20' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">KYC & Compliance</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
              <FileCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">
              {documents.length} <span className="text-sm font-medium text-slate-400">/ {DOCUMENT_TYPES.length}</span>
            </span>
            <p className="text-[11px] font-medium text-slate-600 mt-0.5">
              {documents.length === DOCUMENT_TYPES.length ? 'Fully verified' : 'Pending documents'}
            </p>
          </div>
        </button>
      </div>

      {/* Quick Catalog & Operations Navigation */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Multi-Vendor Operations & Catalog
          </p>
          <span className="text-[11px] font-medium text-emerald-700">Quick Navigation</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {[
            { label: 'Products', href: '/products', icon: Package, color: 'text-emerald-700 bg-emerald-50' },
            { label: 'Market Prices', href: '/market-prices', icon: TrendingUp, color: 'text-blue-700 bg-blue-50' },
            { label: 'Pre-Order Slots', href: '/pre-order-slots', icon: Clock3, color: 'text-amber-700 bg-amber-50' },
            { label: 'Pre-orders', href: '/pre-orders', icon: CalendarDays, color: 'text-purple-700 bg-purple-50' },
            { label: 'Inventory', href: '/inventory', icon: ClipboardList, color: 'text-indigo-700 bg-indigo-50' },
            { label: 'Bulk Import', href: '/bulk-import-export', icon: ArrowUpDown, color: 'text-cyan-700 bg-cyan-50' },
            { label: 'CSV Import', href: '/csv-import-export', icon: FileSpreadsheet, color: 'text-teal-700 bg-teal-50' },
            { label: 'Shipping', href: `/shipping-methods?vendorId=${vendorId}`, icon: Truck, color: 'text-rose-700 bg-rose-50' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                to={item.href}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center hover:bg-white hover:border-slate-300 hover:shadow-xs transition"
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold text-slate-800 truncate w-full">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 bg-white rounded-xl px-2 shadow-2xs">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto py-2">
          {[
            { id: 'overview', label: 'Overview & Profile', icon: Building2 },
            { id: 'products', label: `Products (${products.length})`, icon: Package },
            { id: 'dark-stores', label: `Dark Stores (${darkStores.length})`, icon: Store },
            ...(row.vendorType !== 'seller'
              ? [
                  { id: 'collection-centre', label: 'Collection Centre', icon: Warehouse },
                  { id: 'crops', label: `Crops (${crops.length})`, icon: Sprout },
                ]
              : []),
            { id: 'documents', label: `KYC Documents (${documents.length}/${DOCUMENT_TYPES.length})`, icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: OVERVIEW & PROFILE */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card: Business & Profile Information */}
          <div className={`${PANEL} p-5 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Building2 className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Business & Vendor Info</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                Core Profile
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem
                label={row.vendorType === 'seller' ? 'Seller / Vendor Name' : 'Collection Centre / Vendor Name'}
                value={row.vendorName}
                icon={row.vendorType === 'seller' ? Store : Warehouse}
              />
              <DetailItem label="Legal Business Name" value={row.businessName} icon={Building2} />
              <DetailItem
                label={row.vendorType === 'seller' ? 'Seller / Vendor Code' : 'Collection Centre Code (CC Code)'}
                value={row.vendorType === 'seller' ? (row.vendorCode || row.id) : ccCode}
                icon={row.vendorType === 'seller' ? Store : Warehouse}
                copyable
              />
              <DetailItem label="System ID" value={row.id} icon={Copy} copyable />
              <DetailItem label="Platform Commission" value={row.commissionRate != null ? `${row.commissionRate}%` : '—'} icon={Percent} />
              <DetailItem label="Operational Status" icon={ShieldCheck}>
                <StatusPill status={row.status} />
              </DetailItem>
              <DetailItem label="Registered On" value={formatDate(row.createdAt)} icon={Calendar} />
              <DetailItem label="Last Updated" value={formatDate(row.updatedAt)} icon={Calendar} />
            </div>
          </div>

          {/* Card: Owner & Primary Contact */}
          <div className={`${PANEL} p-5 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Users className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Owner & Contact Details</h3>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                Authorized Personnel
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label="Owner Full Name" value={row.ownerName} icon={UserCheck} />
              <DetailItem label="Account Role" value={row.role || 'VENDOR'} icon={ShieldCheck} />
              <DetailItem label="Login Mobile" value={row.mobile} icon={Phone} copyable isLink href={`tel:${row.mobile}`} />
              <DetailItem label="Email Address" value={row.email} icon={Mail} copyable isLink href={`mailto:${row.email}`} />
            </div>

            {/* Quick Access to Network (Farmer Vendors only) */}
            {row.vendorType !== 'seller' ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-2">
                <span className="text-xs font-bold text-blue-900 block">Farmer Management Shortcuts</span>
                <div className="flex flex-wrap gap-2.5">
                  <Link
                    to={`/collection-farmers?vendorId=${encodeURIComponent(row.id)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200 hover:bg-emerald-50 transition shadow-2xs"
                  >
                    <Users className="h-3.5 w-3.5 text-emerald-600" /> View Associated Farmers →
                  </Link>
                  <Link
                    to={`/collection-farmer-managers?vendorId=${encodeURIComponent(row.id)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 border border-blue-200 hover:bg-blue-50 transition shadow-2xs"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-blue-600" /> View Farmer Managers →
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {/* Card: Registered Address */}
          <div className={`${PANEL} p-5 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <MapPin className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Business & Facility Address</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                Location
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <DetailItem label="Premises / Street Address" value={row.businessAddress} icon={MapPin} />
              </div>
              <DetailItem label="City" value={row.city} icon={Building2} />
              <DetailItem label="State" value={row.state} icon={MapPin} />
              <DetailItem label="Postal Pincode" value={row.pincode} icon={MapPin} copyable />
              <DetailItem
                label="Country / Zone"
                value="India · Western Zone"
                icon={MapPin}
              />
            </div>
          </div>

          {/* Card: Tax Compliance & Bank Details */}
          <div className={`${PANEL} p-5 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                  <CreditCard className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Tax & Bank Information</h3>
              </div>
              <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
                Financials
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label="GST Number" value={row.gstNumber} icon={ShieldCheck} copyable />
              <DetailItem label="PAN Number" value={row.panNumber} icon={ShieldCheck} copyable />
              <DetailItem label="Account Holder" value={bank.accountHolder} icon={UserCheck} />
              <DetailItem label="Bank Name" value={bank.bankName} icon={Building2} />
              <DetailItem label="Account Number" value={bank.accountNumber} icon={CreditCard} copyable />
              <DetailItem label="IFSC Code" value={bank.ifsc} icon={Building2} copyable />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCTS */}
      {activeTab === 'products' && (
        <div className="space-y-5">
          {/* Pending Product Requests Alert if any */}
          {productRequests.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200 text-amber-900">
                    <Package className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">
                      {productRequests.length} Pending Product Request{productRequests.length === 1 ? '' : 's'}
                    </h4>
                    <p className="text-xs text-amber-700">Waiting for Admin Approval</p>
                  </div>
                </div>
                <Link
                  to={`/vendor-product-requests?vendorId=${encodeURIComponent(row.id)}`}
                  className="text-xs font-semibold text-emerald-800 hover:underline inline-flex items-center gap-1"
                >
                  Open Requests Hub <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="divide-y divide-amber-200 rounded-xl border border-amber-200 bg-white overflow-hidden">
                {productRequests.map((reqItem) => {
                  const img = reqItem.productImage || reqItem.catalog?.image;
                  return (
                    <div key={reqItem.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        {img ? (
                          <img src={img} alt={reqItem.productName} className="h-12 w-12 rounded-lg object-cover border border-slate-200" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 font-bold text-base">
                            {String(reqItem.productName || 'P').charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">{reqItem.productName}</span>
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
                              Pending
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {[reqItem.category, reqItem.unit].filter(Boolean).join(' · ')} · Requested {formatDate(reqItem.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={requestBusyId === reqItem.id}
                          onClick={() => rejectProductRequest(reqItem)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                        <button
                          type="button"
                          disabled={requestBusyId === reqItem.id}
                          onClick={() => approveProductRequest(reqItem)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 shadow-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Approved Products Catalog Card */}
          <div className={`${PANEL} p-5 space-y-4`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Approved Vendor Products ({products.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Products approved by admin that this vendor is currently authorized to sell.
                </p>
              </div>
              <Link
                to={`/vendor-product-requests?vendorId=${encodeURIComponent(row.id)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <Package className="h-3.5 w-3.5 text-emerald-700" /> View Product Requests Hub
              </Link>
            </div>

            {products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <Package className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No approved products yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  When the vendor submits product requests from their Vendor Panel, review and approve them to add products here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => {
                  const img = product.image || product.productImage || product.catalog?.image;
                  return (
                    <div
                      key={product.productId}
                      className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 transition"
                    >
                      <div className="flex items-start gap-3">
                        {img ? (
                          <img
                            src={img}
                            alt={product.name}
                            className="h-12 w-12 shrink-0 rounded-lg object-cover border border-slate-100"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 font-bold text-base">
                            {String(product.name || 'P').charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 space-y-1">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{product.name}</h4>
                          <p className="text-xs text-slate-500 truncate">
                            {[product.category, product.unit].filter(Boolean).join(' · ')}
                          </p>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                              Active in Catalog
                            </span>
                            {product.catalogMissing ? (
                              <span className="text-[10px] font-bold text-rose-600">Catalog Inactive</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="text-slate-400">Added {formatDate(product.createdAt)}</span>
                        <button
                          type="button"
                          onClick={() => removeProduct(product)}
                          className="font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DARK STORES */}
      {activeTab === 'dark-stores' && (
        <div className={`${PANEL} p-5 space-y-5`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Linked Dark Stores ({darkStores.length})
              </h3>
              <p className="text-xs text-slate-500">
                Local fulfilment centres supplied and serviced by this collection centre.
              </p>
            </div>
            <Link
              to="/dark-stores"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition shadow-2xs"
            >
              Review Dark Store Requests
            </Link>
          </div>

          {/* Assignment Toolbar */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center">
            <span className="text-xs font-bold text-slate-700 shrink-0">Assign Dark Store:</span>
            <select
              value={assignId}
              onChange={(e) => setAssignId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 sm:w-80 shadow-2xs"
            >
              <option value="">Select a dark store to link...</option>
              {assignableStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.storeName}
                  {store.city ? ` · ${store.city}` : ''}
                  {store.vendorId ? ` (moves from ${vendorNameOf(store.vendorId)})` : ' (unassigned)'}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!assignId || assigning}
              onClick={() => assignStore(assignId, row.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition shadow-2xs"
            >
              {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Assign Store
            </button>
          </div>

          {darkStores.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <Store className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No dark stores linked yet</p>
              <p className="text-xs text-slate-400 mt-1">Use the dropdown above to link existing dark stores to this vendor.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {darkStores.map((store) => (
                <div
                  key={store.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-300 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                          <Store className="h-4 w-4" />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{store.storeName}</h4>
                          <p className="text-xs text-slate-500">
                            {[store.area, store.city, store.state].filter(Boolean).join(', ') || '—'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          store.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {store.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {store.managerName ? (
                      <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-800">Manager: {store.managerName}</p>
                        {store.phone ? (
                          <a href={`tel:${store.phone}`} className="text-blue-700 hover:underline block">
                            📞 {store.phone}
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      disabled={assigning}
                      onClick={() => {
                        if (window.confirm(`Unlink "${store.storeName}" from this collection centre?`)) {
                          assignStore(store.id, '');
                        }
                      }}
                      className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                    >
                      Unlink Store
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COLLECTION CENTRE (Farmer Vendors only) */}
      {activeTab === 'collection-centre' && row.vendorType !== 'seller' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Centre Infrastructure */}
          <div className={`${PANEL} p-5 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                  <Warehouse className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Collection Centre Details</h3>
              </div>
              <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 font-mono">
                {ccCode}
              </span>
            </div>

            {centre ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailItem label="Centre ID Code" value={centre.id} icon={Warehouse} copyable />
                <DetailItem label="Centre Facility Name" value={centre.name} icon={Building2} />
                <DetailItem label="Operational Status" icon={ShieldCheck}>
                  <StatusPill status={centre.status || 'Active'} />
                </DetailItem>
                <DetailItem label="Contact Mobile" value={centre.contactMobile || row.mobile} icon={Phone} copyable />
                <div className="sm:col-span-2">
                  <DetailItem label="Centre Address" value={centre.address || row.businessAddress} icon={MapPin} />
                </div>
                <DetailItem label="Hub City" value={centre.city || row.city} icon={Building2} />
                <DetailItem label="State" value={row.state} icon={MapPin} />
              </div>
            ) : (
              <div className="p-4 text-center text-slate-500 text-sm">
                Collection Centre record is generated automatically when vendor details are saved.
              </div>
            )}
          </div>

          {/* Geographic Location Codes & Network */}
          <div className={`${PANEL} p-5 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <MapPin className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Geographic Hierarchy & Network</h3>
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
                ERP Hierarchy
              </span>
            </div>

            {centre ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">State Code</span>
                  <span className="font-mono text-base font-extrabold text-slate-800">{centre.stateCode || 'MH'}</span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">District Code</span>
                  <span className="font-mono text-base font-extrabold text-slate-800">{centre.districtCode || 'NK'}</span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Taluka Code</span>
                  <span className="font-mono text-base font-extrabold text-slate-800">{centre.talukaCode || 'NAS'}</span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Village Code</span>
                  <span className="font-mono text-base font-extrabold text-slate-800">{centre.villageCode || 'NAS'}</span>
                </div>
              </div>
            ) : null}

            {/* Direct Links */}
            <div className="pt-2 space-y-2.5">
              <span className="text-xs font-bold text-slate-700 block">Linked Personnel & Suppliers</span>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Link
                  to={`/collection-farmers?vendorId=${encodeURIComponent(row.id)}`}
                  className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 hover:bg-emerald-100/60 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="h-4 w-4 text-emerald-700" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Registered Farmers</p>
                      <p className="text-[11px] text-slate-500">Farmers linked to this CC</p>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-emerald-700" />
                </Link>

                <Link
                  to={`/collection-farmer-managers?vendorId=${encodeURIComponent(row.id)}`}
                  className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/50 p-3 hover:bg-blue-100/60 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="h-4 w-4 text-blue-700" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Farmer Managers</p>
                      <p className="text-[11px] text-slate-500">Collection field managers</p>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-blue-700" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CROPS (Farmer Vendors only) */}
      {activeTab === 'crops' && row.vendorType !== 'seller' && (
        <div className={`${PANEL} p-5 space-y-4`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Approved Procurement Crops ({crops.length})
              </h3>
              <p className="text-xs text-slate-500">
                Agricultural crops this collection centre is certified to procure from farmers.
              </p>
            </div>
            <Link
              to="/vendor-crop-requests"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              <Sprout className="h-3.5 w-3.5 text-emerald-700" /> View Crop Requests
            </Link>
          </div>

          {crops.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <Sprout className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No approved crops yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                The centre can request crop varieties from their panel; approve them in{' '}
                <Link to="/vendor-crop-requests" className="font-semibold text-emerald-700 hover:underline">
                  Crop Requests
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {crops.map((crop) => (
                <div
                  key={crop.cropId}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-amber-300 transition"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">
                      {crop.cropName} {crop.variety ? `(${crop.variety})` : ''}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {[crop.category, crop.cropId].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="text-slate-400">Added {formatDate(crop.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => removeCrop(crop)}
                      className="font-semibold text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: DOCUMENTS & KYC */}
      {activeTab === 'documents' && (
        <div className={`${PANEL} p-5 space-y-4`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                KYC & Regulatory Compliance ({documents.length} / {DOCUMENT_TYPES.length})
              </h3>
              <p className="text-xs text-slate-500">
                Verification documents required for operating an active vendor collection centre.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                documents.length === DOCUMENT_TYPES.length
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
              }`}
            >
              {documents.length === DOCUMENT_TYPES.length ? '✓ Fully Verified' : 'Action Required'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DOCUMENT_TYPES.map(({ type, label }) => {
              const doc = documents.find((d) => d.type === type);
              return (
                <div
                  key={type}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition shadow-2xs ${
                    doc ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">{label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          doc ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {doc ? 'Uploaded' : 'Missing'}
                      </span>
                    </div>

                    {doc ? (
                      <p className="text-xs text-slate-600 truncate">
                        File: <span className="font-medium text-slate-800">{doc.fileName}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Not uploaded yet</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100/80 pt-3 text-xs">
                    <span className="text-slate-400">
                      {doc ? `Uploaded ${formatDate(doc.uploadedAt)}` : 'Pending'}
                    </span>
                    {doc ? (
                      <button
                        type="button"
                        onClick={() => viewDocument(doc)}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> View Doc
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
