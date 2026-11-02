import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BellRing,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Filter,
  Loader2,
  MapPin,
  MapPinned,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserCheck,
  Users,
  UserRound,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function accountLabel(type) {
  return String(type || '').toLowerCase() === 'bulk' ? 'Bulk user' : 'Normal user';
}

function normalizeType(type) {
  const raw = String(type || '').toLowerCase();
  return raw === 'bulk' ? 'bulk' : 'retail';
}

function Breadcrumb({ items }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-300" /> : null}
            {item.to && !isLast ? (
              <Link to={item.to} className="font-medium text-slate-600 transition hover:text-emerald-700">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-semibold text-slate-800' : ''}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className={`${PANEL} flex items-center gap-3 px-4 py-3`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#217346]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className={`${PANEL} px-6 py-14 text-center`}>
      <p className="text-base font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

export function UserStatusBadge({ isActive, isBlocked, blockReason }) {
  const active = isActive !== false && !isBlocked;
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
      title={blockReason ? `Blocked: ${blockReason}` : 'Account Deactivated'}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      Blocked
    </span>
  );
}

export function ToggleUserStatusModal({ user, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;
  const isCurrentlyActive = user.isActive !== false && !user.isBlocked;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const targetUserId = user.userId || user._id;
      const payload = {
        isActive: !isCurrentlyActive,
        isBlocked: isCurrentlyActive,
        reason: reason.trim(),
      };
      let res;
      try {
        res = await opsApi.patch(`user-management/users/${targetUserId}/status`, payload);
      } catch (err1) {
        // Fallback to PUT if PATCH fails or is intercepted
        res = await opsApi.patch(`user-management/users/${targetUserId}/status`, payload);
      }
      onSuccess?.(res?.data || res);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isCurrentlyActive ? 'Deactivate / Block User' : 'Activate / Unblock User'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Manage account status for <strong className="text-slate-800">{user.name}</strong> ({user.phone}).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {isCurrentlyActive ? (
            <div>
              <p className="text-xs text-slate-600">
                Deactivating this user will prevent them from signing in, submitting OTPs, or placing new orders.
              </p>
              <label className="mt-3 block text-xs font-semibold text-slate-700">
                Reason for blocking / deactivation (optional)
              </label>
              <textarea
                rows={3}
                className={`${INPUT} mt-1 text-xs`}
                placeholder="e.g. Suspicious activity, fraudulent orders, policy violation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Activating this user will restore their account access immediately. They will be able to log in and order again.
              </p>
              {user.blockReason && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                  <span className="font-semibold">Previous reason:</span> {user.blockReason}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className={BTN}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={
                isCurrentlyActive
                  ? 'inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-60'
                  : 'inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60'
              }
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : isCurrentlyActive ? (
                <UserX className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isCurrentlyActive ? 'Confirm Deactivate' : 'Confirm Activate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReviewUnblockRequestModal({ request, action, onClose, onSuccess }) {
  const [adminNotes, setAdminNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!request || !action) return null;
  const isApprove = action === 'approve';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await opsApi.patch(`user-management/unblock-requests/${request.id}/review`, {
        action,
        adminNotes: adminNotes.trim(),
      });
      onSuccess?.(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to review request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isApprove ? 'Approve & Unblock Customer' : 'Reject Unblock Appeal'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Appeal submitted by <strong className="text-slate-800">{request.name}</strong> ({request.phone}).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900 mb-0.5">Customer Appeal Statement:</p>
          <p className="italic text-slate-600">"{request.reason}"</p>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Admin Notes ({isApprove ? 'Optional' : 'Recommended'})
            </label>
            <textarea
              rows={3}
              className={`${INPUT} text-xs`}
              placeholder={
                isApprove
                  ? 'e.g. Identity verified; account access restored.'
                  : 'e.g. Repeated violation of policy; appeal denied.'
              }
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className={BTN}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={
                isApprove
                  ? 'inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60'
                  : 'inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-60'
              }
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : isApprove ? (
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isApprove ? 'Approve & Reactivate User' : 'Reject Appeal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AllUsersDirectoryView() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState('');
  const [userGroup, setUserGroup] = useState('all');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('all');
  const [popularPincodes, setPopularPincodes] = useState([]);
  const [popularCities, setPopularCities] = useState([]);
  const [targetUserForStatus, setTargetUserForStatus] = useState(null);

  const fetchUsers = (targetPage = page, customPincode = pincode, customCity = city) => {
    setLoading(true);
    setError('');
    const effectivePin = customPincode != null ? customPincode : pincode;
    const effectiveCity = customCity != null ? customCity : city;
    opsApi
      .list('user-management/all-users', {
        search: search.trim() || undefined,
        accountType: accountType || undefined,
        userGroup: userGroup !== 'all' ? userGroup : undefined,
        pincode: effectivePin.trim() || undefined,
        city: effectiveCity.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        page: targetPage,
        limit: 25,
      })
      .then((res) => {
        setUsers(res.data || []);
        setTotal(res.total || 0);
        setPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
        if (Array.isArray(res.popularPincodes)) {
          setPopularPincodes(res.popularPincodes);
        }
        if (Array.isArray(res.popularCities)) {
          setPopularCities(res.popularCities);
        }
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load user directory'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType, status, userGroup]);

  const handlePincodePillClick = (pin) => {
    const nextPin = pincode === pin ? '' : pin;
    setPincode(nextPin);
    fetchUsers(1, nextPin);
  };

  const handleCityPillClick = (c) => {
    const nextCity = city.toLowerCase() === c.toLowerCase() ? '' : c;
    setCity(nextCity);
    fetchUsers(1, undefined, nextCity);
  };

  const handleReset = () => {
    setSearch('');
    setAccountType('');
    setUserGroup('all');
    setPincode('');
    setCity('');
    setStatus('all');
    fetchUsers(1, '');
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header Box */}
      <div className={`${PANEL} p-4 space-y-3.5`}>
        {/* Main Row */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Search Directory</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={`${INPUT} pl-9 text-xs`}
                placeholder="Search by customer name, phone, email, or shop..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
              />
            </div>
          </div>

          {/* User Group Filter (by Account/Activity) */}
          <div className="w-44">
            <label className="mb-1 block text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-emerald-600" /> User Group
            </label>
            <select
              className={`${INPUT} text-xs`}
              value={userGroup}
              onChange={(e) => {
                setUserGroup(e.target.value);
              }}
            >
              <option value="all">All User Groups</option>
              <option value="retail">Normal / Retail Users</option>
              <option value="bulk">Bulk / B2B Users</option>
              <option value="with_orders">Active Buyers (Has Orders)</option>
              <option value="frequent_orders">⭐ Frequent Buyers (3+ Orders)</option>
              <option value="no_orders">New Signups (0 Orders)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-36">
            <label className="mb-1 block text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-emerald-600" /> Status
            </label>
            <select
              className={`${INPUT} text-xs`}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="blocked">Blocked / Inactive</option>
            </select>
          </div>

          {/* Filter by Pincode */}
          <div className="w-36">
            <label className="mb-1 block text-xs font-semibold text-slate-600 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Pincode
            </label>
            <div className="relative">
              <input
                className={`${INPUT} text-xs font-mono pr-6`}
                placeholder="e.g. 411057"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
              />
              {pincode ? (
                <button
                  type="button"
                  onClick={() => {
                    setPincode('');
                    fetchUsers(1, '');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Filter by City */}
          <div className="w-32">
            <label className="mb-1 block text-xs font-semibold text-slate-600">City</label>
            <input
              className={`${INPUT} text-xs`}
              placeholder="e.g. Pune"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
            />
          </div>

          <button
            type="button"
            className={`${BTN_PRIMARY} text-xs`}
            onClick={() => fetchUsers(1)}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
            Filter
          </button>
          <button
            type="button"
            className={`${BTN} text-xs`}
            onClick={handleReset}
          >
            Reset
          </button>
        </div>

        {/* Quick Same-Pincode & City Groups Bar */}
        {(popularPincodes.length > 0 || popularCities.length > 0) && (
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 text-xs">
            {popularPincodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <MapPin className="h-3 w-3 text-emerald-600" />
                  Same Pincode Groups:
                </span>
                {popularPincodes.slice(0, 8).map((p) => {
                  const isSelected = pincode === p.pincode;
                  return (
                    <button
                      key={p.pincode}
                      type="button"
                      onClick={() => handlePincodePillClick(p.pincode)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        isSelected
                          ? 'bg-emerald-700 text-white shadow-xs font-bold'
                          : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/70'
                      }`}
                    >
                      <span>{p.pincode}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {p.count}
                      </span>
                    </button>
                  );
                })}
                {pincode && (
                  <button
                    type="button"
                    onClick={() => {
                      setPincode('');
                      fetchUsers(1, '');
                    }}
                    className="text-xs text-rose-600 hover:underline font-semibold ml-2 inline-flex items-center gap-0.5"
                  >
                    <X className="h-3 w-3" /> Clear pin
                  </button>
                )}
              </div>
            )}

            {popularCities.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Building2 className="h-3 w-3 text-sky-600" />
                  Popular Cities:
                </span>
                {popularCities.slice(0, 6).map((c) => {
                  const isSelected = city.toLowerCase() === c.city.toLowerCase();
                  return (
                    <button
                      key={c.city}
                      type="button"
                      onClick={() => handleCityPillClick(c.city)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        isSelected
                          ? 'bg-sky-700 text-white shadow-xs font-bold'
                          : 'bg-slate-100 text-slate-700 hover:bg-sky-50 hover:text-sky-800 border border-slate-200/70'
                      }`}
                    >
                      <span>{c.city}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-sky-900 text-sky-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {c.count}
                      </span>
                    </button>
                  );
                })}
                {city && (
                  <button
                    type="button"
                    onClick={() => {
                      setCity('');
                      fetchUsers(1, undefined, '');
                    }}
                    className="text-xs text-rose-600 hover:underline font-semibold ml-2 inline-flex items-center gap-0.5"
                  >
                    <X className="h-3 w-3" /> Clear city
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Directory Count / Active Filter Indicators */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-2">
        <div className="flex items-center gap-2">
          <p>
            Showing <strong className="text-slate-800">{users.length}</strong> of{' '}
            <strong className="text-slate-800">{total}</strong> users
          </p>
          {(status !== 'all' || userGroup !== 'all' || pincode || city || search) && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              Filtered ({[
                status !== 'all' ? `Status: ${status}` : null,
                userGroup !== 'all' ? `Group: ${userGroup}` : null,
                pincode ? `Pin: ${pincode}` : null,
                city ? `City: ${city}` : null,
                search ? `Search: ${search}` : null,
              ].filter(Boolean).join(', ')})
            </span>
          )}
        </div>
        <p>Page {page} of {totalPages || 1}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-emerald-600" /> Loading users directory…
        </div>
      ) : error ? (
        <EmptyState title="Could not load users" subtitle={error} />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" subtitle="Try clearing or adjusting your group, pincode, or status filters." />
      ) : (
        <div className={`${PANEL} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Phone</th>
                  <th className={TH}>User Group</th>
                  <th className={TH}>Address &amp; Pincode</th>
                  <th className={TH}>Shop Details</th>
                  <th className={TH}>Joined On</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Authority Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isUserActive = user.isActive !== false && !user.isBlocked;
                  const hasOrders = (user.orderCount || 0) > 0;
                  return (
                    <tr key={user.userId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{user.name}</p>
                        {user.email ? <p className="text-xs text-slate-500">{user.email}</p> : null}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-slate-800">{user.phone || '—'}</td>
                      
                      {/* User Group Badge & Order Stats */}
                      <td className="px-3 py-3 text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            user.accountType === 'bulk'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {user.accountType === 'bulk' ? 'Bulk / B2B' : 'Normal / Retail'}
                          </span>
                          <span className={`text-[10px] font-medium ${
                            hasOrders ? 'text-emerald-700' : 'text-slate-400'
                          }`}>
                            {hasOrders ? `${user.orderCount} order${user.orderCount > 1 ? 's' : ''}` : 'No orders yet'}
                          </span>
                        </div>
                      </td>

                      {/* Address & Pincode Group Column */}
                      <td className="px-3 py-3 text-xs">
                        {user.pincode || user.city ? (
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {user.pincode ? (
                                <button
                                  type="button"
                                  onClick={() => handlePincodePillClick(user.pincode)}
                                  title="Filter users in this same pincode"
                                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                                    pincode === user.pincode
                                      ? 'bg-emerald-700 text-white'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                  }`}
                                >
                                  <MapPin className="h-3 w-3" />
                                  {user.pincode}
                                </button>
                              ) : null}
                              {user.city ? (
                                <button
                                  type="button"
                                  onClick={() => handleCityPillClick(user.city)}
                                  title="Filter users in this city"
                                  className={`font-semibold transition ${
                                    city.toLowerCase() === user.city.toLowerCase()
                                      ? 'text-sky-700 underline'
                                      : 'text-slate-700 hover:text-sky-700 hover:underline'
                                  }`}
                                >
                                  {user.city}
                                </button>
                              ) : null}
                            </div>
                            {user.address?.area && (
                              <p className="text-[11px] text-slate-500 line-clamp-1">{user.address.area}</p>
                            )}
                          </div>
                        ) : user.shopAddress ? (
                          <p className="text-[11px] text-slate-500 line-clamp-1">{user.shopAddress}</p>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-xs text-slate-600">
                        {user.shopName ? (
                          <div>
                            <p className="font-medium text-slate-800">{user.shopName}</p>
                            {user.gstNumber && <p className="text-[11px] text-slate-400">GST: {user.gstNumber}</p>}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatDateTime(user.createdAt)}</td>
                      <td className="px-3 py-3">
                        <UserStatusBadge
                          isActive={isUserActive}
                          isBlocked={!isUserActive}
                          blockReason={user.blockReason}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setTargetUserForStatus(user)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            isUserActive
                              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {isUserActive ? (
                            <>
                              <UserX className="h-3 w-3" />
                              Deactivate / Block
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" />
                              Activate / Unblock
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs">
              <button
                type="button"
                className={BTN}
                disabled={page <= 1 || loading}
                onClick={() => fetchUsers(page - 1)}
              >
                Previous
              </button>
              <span className="font-medium text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={BTN}
                disabled={page >= totalPages || loading}
                onClick={() => fetchUsers(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {targetUserForStatus && (
        <ToggleUserStatusModal
          user={targetUserForStatus}
          onClose={() => setTargetUserForStatus(null)}
          onSuccess={(updated) => {
            setUsers((prev) =>
              prev.map((u) =>
                (u.userId === updated.userId || u._id === updated.userId)
                  ? { ...u, ...updated }
                  : u
              )
            );
          }}
        />
      )}
    </div>
  );
}

export function UnblockRequestsView({ onPendingCountChange }) {
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusTab, setStatusTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetReview, setTargetReview] = useState(null);

  const fetchRequests = () => {
    setLoading(true);
    setError('');
    opsApi
      .list('user-management/unblock-requests', {
        status: statusTab !== 'all' ? statusTab : undefined,
        search: search.trim() || undefined,
      })
      .then((res) => {
        setRequests(res.data || []);
        const count = res.pendingCount ?? 0;
        setPendingCount(count);
        onPendingCountChange?.(count);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load unblock requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {['pending', 'approved', 'rejected', 'all'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusTab(tab)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                statusTab === tab
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab === 'pending' ? `Pending (${pendingCount})` : tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 max-w-xs flex-1">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              className={`${INPUT} pl-8 text-xs`}
              placeholder="Search appeals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchRequests()}
            />
          </div>
          <button type="button" className={BTN} onClick={fetchRequests}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading appeals…
        </div>
      ) : error ? (
        <EmptyState title="Could not load unblock requests" subtitle={error} />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No unblock requests found"
          subtitle={
            statusTab === 'pending'
              ? 'There are currently no pending unblock appeals from blocked users.'
              : 'No requests match this filter.'
          }
        />
      ) : (
        <div className={`${PANEL} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Phone</th>
                  <th className={TH}>Submitted At</th>
                  <th className={TH}>Appeal Reason</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Admin Review</th>
                  <th className={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{item.accountType} user</p>
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-slate-800">{item.phone}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{formatDateTime(item.createdAt)}</td>
                    <td className="px-3 py-3 text-xs max-w-sm">
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 text-slate-700 italic">
                        "{item.reason}"
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          item.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {item.adminNotes ? (
                        <div>
                          <p className="font-medium text-slate-800">{item.adminNotes}</p>
                          <p className="text-[11px] text-slate-400">{formatDateTime(item.reviewedAt)}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">Pending review</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {item.status === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTargetReview({ request: item, action: 'approve' })}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                          >
                            <Check className="h-3 w-3" />
                            Approve & Unblock
                          </button>
                          <button
                            type="button"
                            onClick={() => setTargetReview({ request: item, action: 'reject' })}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                          >
                            <X className="h-3 w-3" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {targetReview && (
        <ReviewUnblockRequestModal
          request={targetReview.request}
          action={targetReview.action}
          onClose={() => setTargetReview(null)}
          onSuccess={(updated) => {
            setRequests((prev) =>
              prev.map((r) =>
                (r.id === updated._id || r.id === updated.id)
                  ? { ...r, status: updated.status, adminNotes: updated.adminNotes, reviewedAt: updated.reviewedAt }
                  : r
              )
            );
            if (targetReview.action === 'approve') {
              setPendingCount((c) => Math.max(0, c - 1));
              onPendingCountChange?.(Math.max(0, pendingCount - 1));
            }
          }}
        />
      )}
    </div>
  );
}

/** Step 1 — User Management Dashboard (Store Browse, All Users, Unblock Appeals) */
export function UserManagementTypePage() {
  const [activeTab, setActiveTab] = useState('stores');
  const [pendingAppealsCount, setPendingAppealsCount] = useState(0);

  useEffect(() => {
    opsApi
      .list('user-management/unblock-requests', { status: 'pending' })
      .then((res) => {
        setPendingAppealsCount(res.pendingCount ?? res.data?.length ?? 0);
      })
      .catch(() => {});
  }, []);

  const cards = [
    {
      type: 'retail',
      title: 'Normal user',
      description: 'Retail customers who place regular grocery orders.',
      icon: UserRound,
    },
    {
      type: 'bulk',
      title: 'Bulk user',
      description: 'B2B / wholesale accounts with shop and GST details.',
      icon: Package,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={PAGE_KICKER}>Operations</p>
          <h1 className={PAGE_TITLE}>User management</h1>
          <p className={PAGE_SUB}>Manage user access, toggle active/blocked status, and review customer unblock appeals.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('stores')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'stores'
              ? 'bg-[#217346] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Store className="h-4 w-4" />
          Browse by Dark Store
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('all-users')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'all-users'
              ? 'bg-[#217346] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          All Users Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('unblock-requests')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'unblock-requests'
              ? 'bg-[#217346] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Unblock Requests
          {pendingAppealsCount > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === 'unblock-requests' ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
              }`}
            >
              {pendingAppealsCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'stores' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.type}
                className={`${PANEL} group flex flex-col gap-4 p-5 transition hover:border-emerald-300 hover:shadow-md`}
              >
                <Link to={`/user-management/${card.type}`} className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#217346] transition group-hover:bg-emerald-100">
                      <Icon className="h-6 w-6" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{card.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{card.description}</p>
                  </div>
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/user-management/${card.type}`} className="text-sm font-semibold text-[#217346]">
                    View zones →
                  </Link>
                  <Link to={`/user-management/${card.type}/notifications`} className={BTN}>
                    <BellRing className="mr-1.5 h-4 w-4" />
                    Send notification
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'all-users' && <AllUsersDirectoryView />}

      {activeTab === 'unblock-requests' && (
        <UnblockRequestsView onPendingCountChange={setPendingAppealsCount} />
      )}
    </div>
  );
}

/** Step 2 — Zones (cities) */
export function UserManagementZonesPage() {
  const { accountType: rawType } = useParams();
  const accountType = normalizeType(rawType);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    opsApi
      .list('user-management/zones')
      .then((res) => {
        if (!alive) return;
        setZones(res.data || []);
      })
      .catch((err) => alive && setError(err.response?.data?.message || 'Failed to load zones'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return zones;
    return zones.filter((z) => [z.name, z.city, z.cityId].join(' ').toLowerCase().includes(needle));
  }, [zones, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: 'User management', to: '/user-management' },
              { label: accountLabel(accountType) },
            ]}
          />
          <h1 className={PAGE_TITLE}>Zones</h1>
          <p className={PAGE_SUB}>
            Select a city zone to see dark stores for {accountLabel(accountType).toLowerCase()}s.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/user-management/${accountType}/notifications`} className={BTN_PRIMARY}>
            <BellRing className="mr-1.5 h-4 w-4" />
            Send notification
          </Link>
          <Link to="/user-management" className={BTN}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Zones" value={zones.length} icon={MapPinned} />
        <StatCard
          label="Dark stores"
          value={zones.reduce((s, z) => s + (z.storeCount || 0), 0)}
          icon={Store}
        />
        <StatCard label="User type" value={accountLabel(accountType)} icon={Users} />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${INPUT} pl-9`}
          placeholder="Search zone (e.g. Mumbai, Pune)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading zones…
        </div>
      ) : error ? (
        <EmptyState title="Could not load zones" subtitle={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No zones found" subtitle="Add dark stores with a city to populate zones." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((zone) => (
            <Link
              key={zone.zoneKey}
              to={`/user-management/${accountType}/zones/${encodeURIComponent(zone.zoneKey)}`}
              className={`${PANEL} group flex items-center gap-4 p-4 transition hover:border-emerald-300 hover:shadow-md`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-slate-900">{zone.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {zone.storeCount} store{zone.storeCount === 1 ? '' : 's'}
                  {zone.areaCount ? ` · ${zone.areaCount} areas` : ''}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-emerald-600" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Step 3 — Dark stores in zone */
export function UserManagementStoresPage() {
  const { accountType: rawType, zoneKey } = useParams();
  const accountType = normalizeType(rawType);
  const decodedZone = decodeURIComponent(zoneKey || '');
  const [stores, setStores] = useState([]);
  const [zone, setZone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    opsApi
      .list(`user-management/zones/${encodeURIComponent(decodedZone)}/stores`)
      .then((res) => {
        if (!alive) return;
        setStores(res.data || []);
        setZone(res.zone || { name: decodedZone, zoneKey: decodedZone });
      })
      .catch((err) => alive && setError(err.response?.data?.message || 'Failed to load stores'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [decodedZone]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stores;
    return stores.filter((s) =>
      [s.storeName, s.name, s.area, s.phone, s.email].join(' ').toLowerCase().includes(needle)
    );
  }, [stores, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: 'User management', to: '/user-management' },
              { label: accountLabel(accountType), to: `/user-management/${accountType}` },
              { label: zone?.name || decodedZone },
            ]}
          />
          <h1 className={PAGE_TITLE}>Dark stores</h1>
          <p className={PAGE_SUB}>
            Stores in {zone?.name || decodedZone}. Open a store to see {accountLabel(accountType).toLowerCase()}s who ordered there.
          </p>
        </div>
        <Link to={`/user-management/${accountType}`} className={BTN}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Zones
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Stores" value={stores.length} icon={Store} />
        <StatCard
          label="Orders (all)"
          value={stores.reduce((s, row) => s + (row.orderCount || 0), 0)}
          icon={Package}
        />
        <StatCard
          label="Customers (phones)"
          value={stores.reduce((s, row) => s + (row.customerCount || 0), 0)}
          icon={Users}
        />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${INPUT} pl-9`}
          placeholder="Search store, area, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading stores…
        </div>
      ) : error ? (
        <EmptyState title="Could not load stores" subtitle={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No dark stores in this zone" subtitle="Try another zone or add stores in Dark Stores." />
      ) : (
        <div className={`${PANEL} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  <th className={TH}>Store</th>
                  <th className={TH}>Area</th>
                  <th className={TH}>Contact</th>
                  <th className={TH}>Orders</th>
                  <th className={TH}>Status</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((store) => (
                  <tr key={store.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{store.storeName}</p>
                      <p className="text-xs text-slate-500">{store.name}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-700">{store.area || '—'}</td>
                    <td className="px-3 py-3 text-sm text-slate-700">
                      <p>{store.phone || '—'}</p>
                      <p className="text-xs text-slate-500">{store.email || ''}</p>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-800">{store.orderCount || 0}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          store.isActive ? 'bg-emerald-50 text-[#217346]' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {store.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        to={`/user-management/${accountType}/zones/${encodeURIComponent(decodedZone)}/stores/${store.id}`}
                        className={`${BTN_PRIMARY} !min-h-9 !px-3 !text-xs`}
                      >
                        View users
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Step 4 — Users who ordered from store */
export function UserManagementUsersPage() {
  const { accountType: rawType, zoneKey, storeId } = useParams();
  const accountType = normalizeType(rawType);
  const decodedZone = decodeURIComponent(zoneKey || '');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [store, setStore] = useState(null);
  const [areas, setAreas] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetUserForStatus, setTargetUserForStatus] = useState(null);

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [area, setArea] = useState(searchParams.get('area') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [minOrders, setMinOrders] = useState(searchParams.get('minOrders') || '');
  const [maxOrders, setMaxOrders] = useState(searchParams.get('maxOrders') || '');
  const [minQty, setMinQty] = useState(searchParams.get('minQty') || '');
  const [maxQty, setMaxQty] = useState(searchParams.get('maxQty') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'lastOrderAt');

  const load = (overrides = {}) => {
    setLoading(true);
    setError('');
    const nextSearch = overrides.search ?? search;
    const nextArea = overrides.area ?? area;
    const nextDateFrom = overrides.dateFrom ?? dateFrom;
    const nextDateTo = overrides.dateTo ?? dateTo;
    const nextMinOrders = overrides.minOrders ?? minOrders;
    const nextMaxOrders = overrides.maxOrders ?? maxOrders;
    const nextMinQty = overrides.minQty ?? minQty;
    const nextMaxQty = overrides.maxQty ?? maxQty;
    const nextSort = overrides.sort ?? sort;

    const params = {
      accountType,
      search: String(nextSearch || '').trim() || undefined,
      area: nextArea || undefined,
      dateFrom: nextDateFrom || undefined,
      dateTo: nextDateTo || undefined,
      minOrders: nextMinOrders || undefined,
      maxOrders: nextMaxOrders || undefined,
      minQty: nextMinQty || undefined,
      maxQty: nextMaxQty || undefined,
      sort: nextSort,
      sortDir: 'desc',
    };
    Object.keys(params).forEach((key) => params[key] == null && delete params[key]);

    const next = new URLSearchParams();
    if (String(nextSearch || '').trim()) next.set('q', String(nextSearch).trim());
    if (nextArea) next.set('area', nextArea);
    if (nextDateFrom) next.set('dateFrom', nextDateFrom);
    if (nextDateTo) next.set('dateTo', nextDateTo);
    if (nextMinOrders) next.set('minOrders', nextMinOrders);
    if (nextMaxOrders) next.set('maxOrders', nextMaxOrders);
    if (nextMinQty) next.set('minQty', nextMinQty);
    if (nextMaxQty) next.set('maxQty', nextMaxQty);
    if (nextSort && nextSort !== 'lastOrderAt') next.set('sort', nextSort);
    setSearchParams(next, { replace: true });

    opsApi
      .list(`user-management/stores/${storeId}/users`, params)
      .then((res) => {
        setUsers(res.data || []);
        setStore(res.store || null);
        setAreas(res.filters?.areas || []);
        setStats(res.stats || null);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, accountType]);

  const clearFilters = () => {
    setSearch('');
    setArea('');
    setDateFrom('');
    setDateTo('');
    setMinOrders('');
    setMaxOrders('');
    setMinQty('');
    setMaxQty('');
    setSort('lastOrderAt');
    load({
      search: '',
      area: '',
      dateFrom: '',
      dateTo: '',
      minOrders: '',
      maxOrders: '',
      minQty: '',
      maxQty: '',
      sort: 'lastOrderAt',
    });
  };

  const [togglingId, setTogglingId] = useState(null);

  const toggleBlock = async (user) => {
    const nextBlocked = !user.isBlocked;
    const confirmMsg = nextBlocked
      ? `Are you sure you want to block ${user.name || user.phone}? They will NOT be able to log in to the Customer app.`
      : `Are you sure you want to unblock ${user.name || user.phone}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setTogglingId(user.userId);
      await opsApi.patch(`user-management/users/${user.userId}/toggle-block`, {
        isBlocked: nextBlocked,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === user.userId
            ? {
                ...u,
                isBlocked: nextBlocked,
                isActive: !nextBlocked,
                status: nextBlocked ? 'blocked' : 'active',
              }
            : u
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: 'User management', to: '/user-management' },
              { label: accountLabel(accountType), to: `/user-management/${accountType}` },
              {
                label: store?.city || decodedZone,
                to: `/user-management/${accountType}/zones/${encodeURIComponent(decodedZone)}`,
              },
              { label: store?.storeName || 'Store users' },
            ]}
          />
          <h1 className={PAGE_TITLE}>{store?.storeName || 'Store users'}</h1>
          <p className={PAGE_SUB}>
            {accountLabel(accountType)}s who ordered from this dark store
            {store?.area ? ` · ${store.area}` : ''}.
          </p>
        </div>
        <button
          type="button"
          className={BTN}
          onClick={() =>
            navigate(`/user-management/${accountType}/zones/${encodeURIComponent(decodedZone)}`)
          }
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Stores
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={stats?.userCount ?? users.length} icon={Users} />
        <StatCard label="Orders" value={stats?.orderCount ?? 0} icon={Package} />
        <StatCard label="Total qty" value={stats?.totalQuantity ?? 0} icon={Package} />
        <StatCard label="Order value" value={money(stats?.totalAmount)} icon={Store} />
      </div>

      <div className={`${PANEL} space-y-3 p-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={`${INPUT} pl-9`}
                placeholder="Name, phone, or order ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
              />
            </div>
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Area</label>
            <select className={INPUT} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-semibold text-slate-500">From date</label>
            <input type="date" className={INPUT} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-semibold text-slate-500">To date</label>
            <input type="date" className={INPUT} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Min orders</label>
            <input type="number" min="0" className={INPUT} value={minOrders} onChange={(e) => setMinOrders(e.target.value)} />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Max orders</label>
            <input type="number" min="0" className={INPUT} value={maxOrders} onChange={(e) => setMaxOrders(e.target.value)} />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Min qty</label>
            <input type="number" min="0" className={INPUT} value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Max qty</label>
            <input type="number" min="0" className={INPUT} value={maxQty} onChange={(e) => setMaxQty(e.target.value)} />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Sort by</label>
            <select className={INPUT} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="lastOrderAt">Last order time</option>
              <option value="orderCount">Order count</option>
              <option value="totalQuantity">Total quantity</option>
              <option value="totalAmount">Order value</option>
              <option value="name">Name</option>
            </select>
          </div>
          <button type="button" className={BTN_PRIMARY} onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Apply filters
          </button>
          <button type="button" className={BTN} onClick={clearFilters}>
            Reset
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
        </div>
      ) : error ? (
        <EmptyState title="Could not load users" subtitle={error} />
      ) : users.length === 0 ? (
        <EmptyState
          title="No matching users"
          subtitle="Try clearing filters, or check that orders are linked to this dark store."
        />
      ) : (
        <div className={`${PANEL} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Phone</th>
                  {accountType === 'bulk' ? <th className={TH}>Shop</th> : null}
                  <th className={TH}>Status</th>
                  <th className={TH}>Area</th>
                  <th className={TH}>Orders</th>
                  <th className={TH}>Qty</th>
                  <th className={TH}>Value</th>
                  <th className={TH}>Last order</th>
                  <th className={TH}>Order ID</th>
                  <th className={TH}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isUserActive = user.isActive !== false && !user.isBlocked;
                  return (
                    <tr key={user.userId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{user.name}</p>
                        {user.email ? <p className="text-xs text-slate-500">{user.email}</p> : null}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-slate-800">{user.phone || '—'}</td>
                      {accountType === 'bulk' ? (
                        <td className="px-3 py-3 text-sm text-slate-700">
                          <p className="font-medium">{user.shopName || '—'}</p>
                          {user.gstNumber ? <p className="text-xs text-slate-500">{user.gstNumber}</p> : null}
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <UserStatusBadge
                          isActive={isUserActive}
                          isBlocked={!isUserActive}
                          blockReason={user.blockReason}
                        />
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-700">
                        {user.lastArea || user.areas?.[0] || '—'}
                        {user.areas?.length > 1 ? (
                          <span className="ml-1 text-xs text-slate-400">+{user.areas.length - 1}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900">{user.orderCount}</td>
                      <td className="px-3 py-3 text-sm text-slate-800">{user.totalQuantity}</td>
                      <td className="px-3 py-3 text-sm font-medium text-slate-800">{money(user.totalAmount)}</td>
                      <td className="px-3 py-3 text-sm text-slate-700">{formatDateTime(user.lastOrderAt)}</td>
                      <td className="px-3 py-3 text-sm font-mono text-slate-700">{user.lastOrderNumber || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTargetUserForStatus(user)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                              isUserActive
                                ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {isUserActive ? (
                              <>
                                <UserX className="h-3 w-3" />
                                Deactivate / Block
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3 w-3" />
                                Activate / Unblock
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={togglingId === user.userId}
                            onClick={() => toggleBlock(user)}
                            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                              user.isBlocked
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            } disabled:opacity-50`}
                          >
                            {togglingId === user.userId ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : null}
                            {user.isBlocked ? 'Unblock' : 'Block'}
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

      {targetUserForStatus && (
        <ToggleUserStatusModal
          user={targetUserForStatus}
          onClose={() => setTargetUserForStatus(null)}
          onSuccess={(updated) => {
            setUsers((prev) =>
              prev.map((u) =>
                u.userId === updated.userId
                  ? {
                      ...u,
                      ...updated,
                      isActive: updated.isActive,
                      isBlocked: updated.isBlocked,
                      status: updated.status,
                      blockReason: updated.blockReason,
                    }
                  : u
              )
            );
          }}
        />
      )}
    </div>
  );
}
