import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Store,
  Trash2,
  Upload,
  Warehouse,
  X,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import apiClient from '../../api/client';
import { BTN, BTN_PRIMARY, INPUT, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';
import {
  DOCUMENT_TYPES,
  DOC_SHORT,
  PendingDarkStoreRequestsBanner,
  PendingProductRequestsBanner,
  StatusPill,
  openVendorDocument,
} from './multiVendorShared';

const STATUS_OPTIONS = ['Pending', 'Active', 'Inactive', 'Suspended'];
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

const DEFAULTS = {
  vendorType: 'farmer',
  vendorName: '',
  ownerName: '',
  mobile: '',
  email: '',
  businessAddress: '',
  village: '',
  taluka: '',
  district: '',
  city: '',
  state: 'Maharashtra',
  gstNumber: '',
  commissionRate: 10,
  status: 'Active',
  password: 'vendor123',
  zones: [],
};

const STAT_LABELS = {
  total: 'Total collection centres',
  active: 'Active',
  pending: 'Pending approval',
  inactive: 'Inactive / Suspended',
};

function Field({ label, required, className = '', children }) {
  return (
    <label className={`block text-xs font-semibold text-slate-600 ${className}`}>
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function MultiVendor() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [docFiles, setDocFiles] = useState({});
  const [docError, setDocError] = useState('');
  const [zoneInput, setZoneInput] = useState('');
  const [availableSystemZones, setAvailableSystemZones] = useState([]);

  // Mobile OTP Verification State (9. GreenGrocc Common OTP)
  const [mobileVerified, setMobileVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpMsg, setOtpMsg] = useState('');
  const [otpError, setOtpError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const pendingEdit = useRef(location.state?.editId ? location.state : null);

  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  // All Products Catalog State
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [productPage, setProductPage] = useState(1);
  const PRODUCTS_PER_PAGE = 12;

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await apiClient.get('/products/all', { params: { limit: 500 } });
      const pData = res.data;
      const list = pData?.data && Array.isArray(pData.data) ? pData.data : Array.isArray(pData) ? pData : [];
      setCatalogProducts(list);
    } catch (err) {
      console.error('Failed to load catalog products:', err);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await opsApi.list('vendors', status !== 'all' ? { status } : {});
      setRows(Array.isArray(res.data) ? res.data : []);
      setStats(res.stats || null);
      opsApi.list('zone-requests', { status: 'all' })
        .then((zRes) => {
          const list = Array.isArray(zRes.data) ? zRes.data : [];
          const distinct = [...new Set(list.map((z) => String(z.name || '').trim()).filter(Boolean))];
          setAvailableSystemZones(distinct);
        })
        .catch(() => {});
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load collection centres');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.vendorName,
        row.businessName,
        row.ownerName,
        row.mobile,
        row.email,
        row.city,
        row.vendorCode,
        row.collectionCentre?.id,
        ...(row.darkStores || []).map((store) => store.storeName),
        ...(row.zones || []),
      ].some((value) => String(value || '').toLowerCase().includes(q))
    );
  }, [rows, search]);

  const categoriesList = useMemo(() => {
    const set = new Set();
    catalogProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [catalogProducts]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return catalogProducts.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.productId && p.productId.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(q)) ||
        (p.varietyName && p.varietyName.toLowerCase().includes(q))
      );
    });
  }, [catalogProducts, productSearch, selectedCategory]);

  const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (productPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filteredProducts, productPage]);

  const setField = (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }));

  const openCreate = (type = 'farmer') => {
    setForm({ ...DEFAULTS, vendorType: type });
    setDocFiles({});
    setDocError('');
    setMobileVerified(false);
    setOtpSent(false);
    setOtpValue('');
    setSendingOtp(false);
    setVerifyingOtp(false);
    setOtpTimer(0);
    setOtpMsg('');
    setOtpError('');
    setZoneInput('');
    setModal({ mode: 'create' });
  };

  const handleAddZone = (zoneName) => {
    const raw = typeof zoneName === 'string' ? zoneName : zoneInput;
    if (!raw || !raw.trim()) return;
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setForm((prev) => {
      const existing = prev.zones || [];
      const nextZones = [...existing];
      parts.forEach((p) => {
        if (!nextZones.some((z) => z.toLowerCase() === p.toLowerCase())) {
          nextZones.push(p);
        }
      });
      return { ...prev, zones: nextZones };
    });
    setZoneInput('');
  };

  const handleRemoveZone = (zoneToRemove) => {
    setForm((prev) => ({
      ...prev,
      zones: (prev.zones || []).filter((z) => z.toLowerCase() !== zoneToRemove.toLowerCase()),
    }));
  };

  const handleMobileChange = (e) => {
    const raw = e.target.value;
    const clean = raw.replace(/\D/g, '').slice(0, 10);
    setForm((prev) => ({ ...prev, mobile: clean }));
    if (mobileVerified) {
      setMobileVerified(false);
      setOtpSent(false);
      setOtpValue('');
      setOtpMsg('');
    }
  };

  const handleSendMobileOtp = async () => {
    const cleanMobile = String(form.mobile || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setOtpError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setSendingOtp(true);
    setOtpError('');
    setOtpMsg('');
    try {
      const res = await apiClient.post('/admin-ops/vendors/otp/send', { mobile: cleanMobile });
      setOtpSent(true);
      setOtpTimer(30);
      setOtpMsg(res.data?.message || 'OTP sent successfully via GreenGrocc Common OTP (GREGRC_Common_OTP)');
      if (res.data?.code) {
        setOtpMsg(`OTP sent via GreenGrocc Common OTP (GREGRC_Common_OTP) (Dev: ${res.data.code})`);
      }
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyMobileOtp = async () => {
    const cleanMobile = String(form.mobile || '').replace(/\D/g, '').slice(-10);
    const cleanOtp = String(otpValue || '').trim();
    if (!cleanOtp) {
      setOtpError('Please enter the OTP');
      return;
    }
    setVerifyingOtp(true);
    setOtpError('');
    setOtpMsg('');
    try {
      const res = await apiClient.post('/admin-ops/vendors/otp/verify', { mobile: cleanMobile, otp: cleanOtp });
      if (res.data?.verified) {
        setMobileVerified(true);
        setOtpMsg('Mobile verified successfully via GreenGrocc Common OTP (GREGRC_Common_OTP)');
      }
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const openEdit = useCallback((row, returnTo = null) => {
    const next = { ...DEFAULTS, vendorType: row.vendorType || 'farmer', password: '', zones: row.zones || [] };
    Object.keys(next).forEach((key) => {
      if (row[key] !== undefined && key !== 'password') next[key] = row[key];
    });
    const cc = row.collectionCentre || {};
    if (!next.village && cc.villageCode) next.village = cc.villageCode;
    if (!next.taluka && cc.talukaCode) next.taluka = cc.talukaCode;
    if (!next.district && cc.districtCode) next.district = cc.districtCode;
    setForm(next);
    setZoneInput('');
    setDocFiles({});
    setDocError('');
    setMobileVerified(true);
    setOtpSent(false);
    setOtpValue('');
    setOtpError('');
    setOtpMsg('');
    setModal({ mode: 'edit', row, returnTo });
  }, []);

  useEffect(() => {
    const request = pendingEdit.current;
    if (!request || loading) return;
    pendingEdit.current = null;
    navigate(location.pathname, { replace: true, state: null });
    const row = rows.find((r) => r.id === request.editId);
    if (row) openEdit(row, request.returnTo);
  }, [rows, loading, openEdit, navigate, location.pathname]);

  const closeModal = () => {
    const returnTo = modal?.returnTo;
    setModal(null);
    if (returnTo) navigate(returnTo);
  };

  const pickDocument = async (type, file) => {
    setDocError('');
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setDocError('Only image or PDF files are allowed.');
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setDocError(`${file.name} is larger than 5 MB.`);
      return;
    }
    try {
      const fileUrl = await readAsDataUrl(file);
      setDocFiles((prev) => ({ ...prev, [type]: { type, fileName: file.name, fileUrl } }));
    } catch (err) {
      setDocError(err.message);
    }
  };

  const clearDocument = (type) =>
    setDocFiles((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });

  const viewDocument = async (row, doc) => {
    try {
      await openVendorDocument(row.id, doc);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open document');
    }
  };

  const deleteDocument = async (row, doc) => {
    if (!window.confirm(`Remove ${doc.name}?`)) return;
    try {
      await opsApi.remove(`vendors/${row.id}/documents`, doc.id);
      setModal((prev) =>
        prev?.row ? { ...prev, row: { ...prev.row, documents: prev.row.documents.filter((d) => d.id !== doc.id) } } : prev
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove document');
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (isCreate && !mobileVerified) {
      setError('Please verify the vendor mobile number with GreenGrocc Common OTP (GREGRC_Common_OTP) before registering.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, documents: Object.values(docFiles) };
      if (modal.mode === 'edit') {
        await opsApi.update('vendors', modal.row.id, payload);
      } else {
        await opsApi.create('vendors', payload);
      }
      if (modal.returnTo) {
        navigate(modal.returnTo);
        return;
      }
      setModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save collection centre');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete collection centre "${row.vendorName || row.ownerName}"?`)) return;
    try {
      await opsApi.remove('vendors', row.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete collection centre');
    }
  };

  const isCreate = modal?.mode === 'create';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={PAGE_TITLE}>Multi Vendor / Collection Centre</h1>
          <p className={`mt-0.5 ${PAGE_SUB}`}>
            Every vendor is a collection centre. Add new centres and manage all of them here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className={`${BTN} gap-1.5 text-xs`}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button type="button" onClick={openCreate} className={`${BTN_PRIMARY} gap-1.5 text-xs`}>
            <Plus className="h-3.5 w-3.5" /> Register Multi Vendor
          </button>
        </div>
      </div>

      <PendingProductRequestsBanner />
      <PendingDarkStoreRequestsBanner />

      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Object.entries(STAT_LABELS).map(([key, label]) => (
            <div key={key} className={`${PANEL} px-4 py-3`}>
              <p className="text-xs text-[#6B7280]">{label}</p>
              <p className="mt-1 text-lg font-bold text-[#1F2937]">
                {Number(stats[key] || 0).toLocaleString('en-IN')}
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
            placeholder="Search centre name, owner, mobile, city or ID..."
            className={`${INPUT} pl-9`}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {['all', ...STATUS_OPTIONS].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize ${
                status === item ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
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
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No collection centres yet. Click “Add Multi Vendor” to create the first one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Collection centre</th>
                  <th className="px-4 py-3 font-semibold">Owner / Contact</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Dark stores</th>
                  <th className="px-4 py-3 font-semibold">Documents</th>
                  <th className="px-4 py-3 font-semibold">Commission</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/multi-vendor/${row.id}`)}
                    className="cursor-pointer border-b border-slate-100 align-top last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {row.vendorType === 'seller' ? (
                          <Store className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                        ) : (
                          <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-slate-900">
                              {row.vendorName || row.businessName || row.ownerName}
                            </p>
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                row.vendorType === 'seller'
                                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              }`}
                            >
                              {row.vendorType === 'seller' ? 'Seller Vendor' : 'Farmer Vendor'}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-500">{row.collectionCentre?.id || row.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{row.ownerName || '—'}</p>
                      <p className="text-[11px] text-slate-500">{row.mobile}</p>
                      {row.email ? <p className="text-[11px] text-slate-500">{row.email}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.businessAddress || row.city || row.state ? (
                        <p className="flex items-start gap-1 text-xs">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                          {[row.businessAddress, row.city, row.state].filter(Boolean).join(', ')}
                        </p>
                      ) : (
                        '—'
                      )}
                      {(row.zones || []).length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {row.zones.map((z, zi) => (
                            <span
                              key={zi}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                            >
                              <MapPin className="h-2.5 w-2.5 text-emerald-600" />
                              {z}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[10px] text-slate-400 italic">No zones assigned</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(row.darkStores || []).length === 0 ? (
                        <span className="text-xs text-slate-400">None</span>
                      ) : (
                        <div className="space-y-0.5">
                          {row.darkStores.map((store) => (
                            <p key={store.id} className="flex items-center gap-1 text-xs text-slate-700">
                              <Store className="h-3 w-3 shrink-0 text-emerald-700" />
                              {store.storeName}
                              {store.city ? <span className="text-slate-400">· {store.city}</span> : null}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(row.documents || []).length === 0 ? (
                        <span className="text-xs text-slate-400">Not uploaded</span>
                      ) : (
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {row.documents.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                viewDocument(row, doc);
                              }}
                              title={`${doc.name} — ${doc.fileName}`}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
                            >
                              <FileText className="h-3 w-3" />
                              {DOC_SHORT[doc.type] || doc.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        {(row.documents || []).length}/{DOCUMENT_TYPES.length} uploaded
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.commissionRate ?? 10}%</td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/vendor-product-requests?vendorId=${encodeURIComponent(row.id)}`)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            row.pendingRequestsCount > 0
                              ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 hover:bg-amber-200'
                              : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                          title="View this vendor's products and requests"
                        >
                          <Package className="h-3.5 w-3.5" />
                          <span>{row.productCount || 0} Products</span>
                          {row.pendingRequestsCount > 0 ? (
                            <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
                              {row.pendingRequestsCount} new
                            </span>
                          ) : null}
                        </button>
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

      {/* ALL PRODUCTS SECTION */}
      <div className="space-y-4 pt-6 border-t border-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <Package className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                All Products ({filteredProducts.length})
              </h2>
              {catalogProducts.length > 0 ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  {catalogProducts.length} total in catalog
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              All catalog products available across collection centres and multi vendors.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadProducts}
              className={`${BTN} gap-1.5 text-xs`}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Products
            </button>
            <Link
              to="/products"
              className={`${BTN_PRIMARY} gap-1.5 text-xs`}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Full Catalog
            </Link>
          </div>
        </div>

        {/* Product Filters Bar */}
        <div className={`${PANEL} flex flex-col gap-2 p-3 sm:flex-row sm:items-center`}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setProductPage(1);
              }}
              placeholder="Search product name, SKU, category, variety..."
              className={`${INPUT} pl-9`}
            />
            {productSearch ? (
              <button
                type="button"
                onClick={() => {
                  setProductSearch('');
                  setProductPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setProductPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
            >
              <option value="all">All Categories ({catalogProducts.length})</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Table */}
        <div className={`overflow-hidden ${PANEL}`}>
          {productsLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : paginatedProducts.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              {productSearch || selectedCategory !== 'all'
                ? 'No products matched your search or category filter.'
                : 'No catalog products found.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Product ID / SKU</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Unit</th>
                      <th className="px-4 py-3 font-semibold">Price</th>
                      <th className="px-4 py-3 font-semibold">Stock</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedProducts.map((p) => {
                      const img =
                        p.mainImage ||
                        p.image ||
                        (Array.isArray(p.images) && p.images[0]) ||
                        p.farmerDetails?.cropPhoto ||
                        '';
                      const mrp = p.mrp || p.price;
                      const sellPrice = p.discountedPrice || p.price;
                      const inStock = p.inStock ?? (Number(p.stock) > 0);

                      return (
                        <tr key={p._id || p.id || p.productId} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {img ? (
                                <img
                                  src={img}
                                  alt={p.name}
                                  className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 font-bold text-sm">
                                  {String(p.name || 'P').charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate max-w-xs">{p.name}</p>
                                {p.varietyName ? (
                                  <p className="text-[11px] text-slate-500 truncate">Variety: {p.varietyName}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {p.productId || p.sku || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {[p.category, p.subcategory].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{p.unit || p.unitType || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900 text-xs">
                              ₹{Number(sellPrice || 0).toLocaleString('en-IN')}
                            </span>
                            {Number(mrp) > Number(sellPrice) ? (
                              <span className="ml-1.5 text-[10px] text-slate-400 line-through">
                                ₹{Number(mrp).toLocaleString('en-IN')}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                            {p.stock != null ? Number(p.stock).toLocaleString('en-IN') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                inStock
                                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                  : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                              }`}
                            >
                              {inStock ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalProductPages > 1 ? (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                  <span>
                    Showing {(productPage - 1) * PRODUCTS_PER_PAGE + 1} to{' '}
                    {Math.min(productPage * PRODUCTS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={productPage <= 1}
                      onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                      className="rounded-md border border-slate-200 p-1 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 font-medium">
                      Page {productPage} of {totalProductPages}
                    </span>
                    <button
                      type="button"
                      disabled={productPage >= totalProductPages}
                      onClick={() => setProductPage((p) => Math.min(totalProductPages, p + 1))}
                      className="rounded-md border border-slate-200 p-1 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleSave} className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto ${PANEL} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isCreate
                    ? form.vendorType === 'seller'
                      ? 'Register Seller Vendor'
                      : 'Multi Vendor Registration / Collection Centre'
                    : form.vendorType === 'seller'
                    ? 'Edit Seller Vendor'
                    : 'Edit Collection Centre'}
                </h2>
                {isCreate ? (
                  <p className="text-xs text-slate-500">
                    {form.vendorType === 'seller'
                      ? 'Register a new commercial seller vendor. Mobile number OTP verification is required via GreenGrocc Common OTP (GREGRC_Common_OTP).'
                      : 'Register a new multi vendor collection centre. Mobile number OTP verification is required via GreenGrocc Common OTP (GREGRC_Common_OTP).'}
                  </p>
                ) : null}
              </div>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Vendor Type Selection: 2 options (Farmer Vendor vs Seller Vendor) */}
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Vendor Type / प्रकार निवडा
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, vendorType: 'farmer' }))}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                    form.vendorType === 'farmer'
                      ? 'bg-emerald-700 text-white shadow-xs ring-1 ring-emerald-700'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>🌾</span>
                  <span>Farmer Vendor (Collection Centre)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, vendorType: 'seller' }))}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                    form.vendorType === 'seller'
                      ? 'bg-emerald-700 text-white shadow-xs ring-1 ring-emerald-700'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>🏪</span>
                  <span>Seller Vendor (Commercial Seller)</span>
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={form.vendorType === 'seller' ? 'Seller / Vendor name' : 'Collection centre / Vendor name'}
                required
                className="sm:col-span-2"
              >
                <input
                  value={form.vendorName}
                  onChange={setField('vendorName')}
                  className={INPUT}
                  placeholder={form.vendorType === 'seller' ? 'e.g. Fresh Mart Organics' : 'e.g. Nashik Agri Collection Centre'}
                  required
                />
              </Field>
              <Field label="Owner name" required>
                <input value={form.ownerName} onChange={setField('ownerName')} className={INPUT} required />
              </Field>
              <Field label="Mobile" required>
                <input
                  type="tel"
                  maxLength={10}
                  value={form.mobile}
                  onChange={isCreate ? handleMobileChange : setField('mobile')}
                  placeholder="10-digit mobile number"
                  className={INPUT}
                  required
                />
                {isCreate ? (
                  <div className="mt-2">
                    {mobileVerified ? (
                      <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Verified via GreenGrocc Common OTP (GREGRC_Common_OTP)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileVerified(false);
                            setOtpSent(false);
                            setOtpValue('');
                            setOtpMsg('');
                          }}
                          className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {!otpSent ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-amber-700">
                              Verify via GreenGrocc Common OTP (GREGRC_Common_OTP)
                            </span>
                            <button
                              type="button"
                              disabled={form.mobile.replace(/\D/g, '').length !== 10 || sendingOtp || otpTimer > 0}
                              onClick={handleSendMobileOtp}
                              className="flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                            >
                              {sendingOtp ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                              Send OTP
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
                            <div className="flex items-center justify-between text-[11px] font-medium text-emerald-800">
                              <span>Enter GreenGrocc Common OTP (GREGRC_Common_OTP)</span>
                              {otpTimer > 0 ? (
                                <span className="text-slate-500">Resend in {otpTimer}s</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={sendingOtp}
                                  onClick={handleSendMobileOtp}
                                  className="font-semibold text-emerald-700 hover:underline"
                                >
                                  Resend OTP
                                </button>
                              )}
                            </div>
                            <div className="mt-1.5 flex gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="6-digit OTP"
                                value={otpValue}
                                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold tracking-widest text-slate-900 outline-none focus:border-emerald-500"
                              />
                              <button
                                type="button"
                                disabled={verifyingOtp || otpValue.length < 4}
                                onClick={handleVerifyMobileOtp}
                                className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {verifyingOtp ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Verify
                              </button>
                            </div>
                          </div>
                        )}
                        {otpError ? <p className="text-[11px] font-medium text-rose-600">{otpError}</p> : null}
                        {otpMsg ? <p className="text-[11px] font-medium text-emerald-700">{otpMsg}</p> : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={setField('email')} className={INPUT} />
              </Field>
              <Field label="GST number">
                <input value={form.gstNumber} onChange={setField('gstNumber')} className={INPUT} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <textarea value={form.businessAddress} onChange={setField('businessAddress')} className={INPUT} rows={2} />
              </Field>
              {form.vendorType !== 'seller' ? (
                <>
                  <Field label="Village">
                    <input value={form.village} onChange={setField('village')} className={INPUT} />
                  </Field>
                  <Field label="Taluka">
                    <input value={form.taluka} onChange={setField('taluka')} className={INPUT} />
                  </Field>
                  <Field label="District">
                    <input value={form.district} onChange={setField('district')} className={INPUT} />
                  </Field>
                </>
              ) : null}
              <Field label="City">
                <input value={form.city} onChange={setField('city')} className={INPUT} />
              </Field>
              <Field label="State">
                <input value={form.state} onChange={setField('state')} className={INPUT} />
              </Field>
              <Field label="Commission %">
                <input type="number" value={form.commissionRate} onChange={setField('commissionRate')} className={INPUT} />
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={setField('status')} className={INPUT}>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={isCreate ? 'Login password' : 'New password (leave blank to keep)'}>
                <input value={form.password} onChange={setField('password')} className={INPUT} />
              </Field>

              {/* Multi-Zone Assignment Section */}
              <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-emerald-700" />
                      Assigned Zones
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Add zones manually using the text box below. You can assign multiple zones to this {form.vendorType === 'seller' ? 'seller vendor' : 'collection centre / multivendor'}.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full ring-1 ring-emerald-300">
                    {(form.zones || []).length} {(form.zones || []).length === 1 ? 'Zone' : 'Zones'} assigned
                  </span>
                </div>

                {/* Manual Text Box to Add Zones */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zoneInput}
                    onChange={(e) => setZoneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddZone();
                      }
                    }}
                    placeholder="Type zone name manually (e.g. Pune, Mumbai, Nashik) and click Add or press Enter"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddZone()}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition"
                  >
                    <Plus className="h-4 w-4" />
                    Add Zone
                  </button>
                </div>

                {/* Active Zone Badges */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(form.zones || []).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      No zones assigned yet. Type a zone name above and click "Add Zone".
                    </p>
                  ) : (
                    (form.zones || []).map((zoneName, zIdx) => (
                      <span
                        key={zIdx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-xs"
                      >
                        <MapPin className="h-3 w-3 text-emerald-600" />
                        {zoneName}
                        <button
                          type="button"
                          onClick={() => handleRemoveZone(zoneName)}
                          className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition"
                          title={`Remove ${zoneName}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Quick Add Suggestions from System Zones */}
                {availableSystemZones.filter((sz) => !(form.zones || []).some((fz) => fz.toLowerCase() === sz.toLowerCase())).length > 0 ? (
                  <div className="mt-3 pt-2.5 border-t border-emerald-200/60">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Suggested system zones (click to add):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSystemZones
                        .filter((sz) => !(form.zones || []).some((fz) => fz.toLowerCase() === sz.toLowerCase()))
                        .slice(0, 15)
                        .map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => handleAddZone(sz)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 transition"
                          >
                            <Plus className="h-3 w-3 text-emerald-600" /> {sz}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Documents</p>
              <p className="mb-2 text-[11px] text-slate-500">Image or PDF, up to 5 MB each.</p>
              <div className="space-y-2">
                {DOCUMENT_TYPES.map(({ type, label }) => {
                  const picked = docFiles[type];
                  const existing = modal.row?.documents?.find((d) => d.type === type);
                  return (
                    <div
                      key={type}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-2 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700">{label}</p>
                        {picked ? (
                          <p className="flex items-center gap-1 truncate text-[11px] text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 shrink-0" /> {picked.fileName}
                          </p>
                        ) : existing ? (
                          <p className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="truncate">Uploaded: {existing.fileName}</span>
                            <button
                              type="button"
                              onClick={() => viewDocument(modal.row, existing)}
                              className="font-semibold text-emerald-700 hover:underline"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDocument(modal.row, existing)}
                              className="font-semibold text-rose-600 hover:underline"
                            >
                              Remove
                            </button>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">Not uploaded</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {picked ? (
                          <button type="button" onClick={() => clearDocument(type)} className="text-slate-400 hover:text-rose-600">
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                        <label className={`${BTN} cursor-pointer gap-1.5 text-xs`}>
                          <Upload className="h-3.5 w-3.5" />
                          {picked || existing ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              pickDocument(type, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              {docError ? <p className="mt-2 text-xs text-rose-600">{docError}</p> : null}
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className={BTN}>
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
