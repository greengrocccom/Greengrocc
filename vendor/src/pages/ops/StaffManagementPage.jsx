import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Plus,
  Send,
  Bell,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Lock,
  Trash2,
  Megaphone,
  Calendar,
  DollarSign,
  Award,
  FileText,
  Loader2,
  X,
  ExternalLink,
  ChevronRight,
  Smartphone,
  AlertTriangle,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';

export default function StaffManagementPage() {
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'roles' | 'notifications' | 'hr-hub'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Staff state
  const [staffList, setStaffList] = useState([]);
  const [rolesData, setRolesData] = useState({ all: [], standard: [], custom: [] });
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [openStaffModal, setOpenStaffModal] = useState(false);
  const [openRoleModal, setOpenRoleModal] = useState(false);
  const [openPasswordModal, setOpenPasswordModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    password: 'Staff@123',
    department: '',
    monthlySalary: '',
    notes: '',
  });

  const [roleForm, setRoleForm] = useState({
    displayName: '',
    roleKey: '',
    department: 'Operations',
    description: '',
  });

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notifForm, setNotifForm] = useState({
    title: '',
    message: '',
    targetType: 'all', // 'all' | 'role' | 'staff'
    targetRole: '',
    targetStaffId: '',
    priority: 'normal', // 'normal' | 'important' | 'urgent'
    category: 'general',
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [staffRes, rolesRes, notifRes] = await Promise.all([
        opsApi.list('staff-management/staff'),
        opsApi.list('staff-management/roles'),
        opsApi.list('staff-management/notifications').catch(() => ({ data: [] })),
      ]);

      setStaffList(staffRes.data || []);
      const rData = rolesRes.data || { all: [], standard: [], custom: [] };
      setRolesData(rData);
      setNotifications(notifRes.data || []);

      if (rData.all?.[0] && !staffForm.role) {
        setStaffForm((prev) => ({ ...prev, role: rData.all[0].value }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load staff management data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Staff creation
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await opsApi.create('staff-management/staff', staffForm);
      showNotification(`Staff login created for ${staffForm.name}!`);
      setOpenStaffModal(false);
      setStaffForm({
        name: '',
        email: '',
        phone: '',
        role: rolesData.all?.[0]?.value || '',
        password: 'Staff@123',
        department: '',
        monthlySalary: '',
        notes: '',
      });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create staff account');
    } finally {
      setSubmitting(false);
    }
  };

  // Custom role creation
  const handleCreateRole = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await opsApi.create('staff-management/roles', roleForm);
      showNotification(`Custom role '${roleForm.displayName}' created! It is now available in HR Management.`);
      setOpenRoleModal(false);
      setRoleForm({ displayName: '', roleKey: '', department: 'Operations', description: '' });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create custom role');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete custom role
  const handleDeleteRole = async (id, displayName) => {
    if (!window.confirm(`Are you sure you want to delete custom role '${displayName}'?`)) return;
    try {
      await opsApi.remove('staff-management/roles', id);
      showNotification(`Role '${displayName}' deleted`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete role');
    }
  };

  // Toggle active status
  const handleToggleStatus = async (staff) => {
    try {
      await opsApi.update('staff-management/staff', `${staff.id}/status`, {});
      await loadData();
      showNotification(`${staff.name} is now ${staff.isActive ? 'Inactive' : 'Active'}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  // Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      await opsApi.update('staff-management/staff', `${selectedStaff.id}/password`, { password: newPassword });
      showNotification(`Password updated for ${selectedStaff.name}`);
      setOpenPasswordModal(false);
      setSelectedStaff(null);
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  // Send custom notification
  const handleSendNotification = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await opsApi.create('staff-management/notifications', notifForm);
      showNotification('Custom notification sent to staff app successfully!');
      setNotifForm({
        title: '',
        message: '',
        targetType: 'all',
        targetRole: '',
        targetStaffId: '',
        priority: 'normal',
        category: 'general',
      });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send notification');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id) => {
    try {
      await opsApi.remove('staff-management/notifications', id);
      showNotification('Notification removed');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete notification');
    }
  };

  // Filtered staff
  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffList.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.roleLabel.toLowerCase().includes(q)
      );
    });
  }, [staffList, roleFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className={PAGE_KICKER}>Operations & Staff App</p>
          <h1 className={PAGE_TITLE}>Staff Management</h1>
          <p className={PAGE_SUB}>
            Manage staff accounts, dynamic custom roles that sync into HR, and broadcast staff app notifications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className={`${BTN} text-slate-600 hover:text-slate-900`}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setOpenRoleModal(true)}
            className={`${BTN} border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold`}
          >
            <Sparkles className="mr-1.5 h-4 w-4 text-emerald-700" />
            + New Custom Role
          </button>
          <button
            type="button"
            onClick={() => setOpenStaffModal(true)}
            className={`${BTN_PRIMARY} bg-emerald-700 hover:bg-emerald-800 text-white`}
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Create Staff Login
          </button>
        </div>
      </div>

      {/* Success & Error alerts */}
      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className={`${PANEL} p-4 border-l-4 border-l-emerald-600`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Staff Accounts</p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{staffList.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Across all roles</p>
        </div>
        <div className={`${PANEL} p-4 border-l-4 border-l-blue-600`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Custom Roles</p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{rolesData.custom?.length || 0}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Active in HR Management</p>
        </div>
        <div className={`${PANEL} p-4 border-l-4 border-l-amber-500`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Staff</p>
          <p className="mt-1.5 text-2xl font-black text-emerald-700">
            {staffList.filter((s) => s.isActive).length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ready to log into mobile app</p>
        </div>
        <div className={`${PANEL} p-4 border-l-4 border-l-purple-600`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Broadcast Alerts</p>
          <p className="mt-1.5 text-2xl font-black text-purple-700">{notifications.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Sent to staff devices</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'staff'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="h-4 w-4" />
          Staff Logins ({staffList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'roles'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Custom Roles ({rolesData.custom?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'notifications'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Bell className="h-4 w-4" />
          Send Custom Notifications ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('hr-hub')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'hr-hub'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Smartphone className="h-4 w-4" />
          Staff App & HR Hub
        </button>
      </div>

      {/* TAB 1: STAFF LOGINS */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${INPUT} pl-9`}
                  placeholder="Search staff by name, email, phone, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className={`${INPUT} w-auto min-w-[160px]`}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <optgroup label="Standard Roles">
                  {rolesData.standard?.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
                {rolesData.custom?.length > 0 && (
                  <optgroup label="Custom Roles">
                    {rolesData.custom.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label} (Custom)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <p className="text-xs font-medium text-slate-500">
              Showing {filteredStaff.length} of {staffList.length} staff
            </p>
          </div>

          {/* Table */}
          <div className={PANEL}>
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading staff accounts...</span>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Users className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-3 text-sm font-semibold text-slate-800">No staff members found</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {searchQuery || roleFilter !== 'all'
                    ? 'Try adjusting your search query or role filter.'
                    : 'Get started by creating staff logins or custom roles.'}
                </p>
                <button
                  type="button"
                  onClick={() => setOpenStaffModal(true)}
                  className={`${BTN_PRIMARY} mt-4 mx-auto`}
                >
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Create Staff Login
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] border-b border-slate-200">
                    <tr>
                      <th className={TH}>Staff Member</th>
                      <th className={TH}>Role & Department</th>
                      <th className={TH}>Contact</th>
                      <th className={TH}>Status</th>
                      <th className={`${TH} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map((staff) => (
                      <tr key={staff.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs uppercase shadow-sm">
                              {staff.name.slice(0, 2)}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-900">{staff.name}</p>
                              <p className="text-[11px] text-slate-400">
                                Created {new Date(staff.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                                staff.isCustomRole
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {staff.roleLabel}
                              {staff.isCustomRole && <span className="ml-1 text-[10px] opacity-75">★</span>}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{staff.department}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <p className="font-medium text-slate-800">{staff.phone}</p>
                          <p className="text-slate-400">{staff.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(staff)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition ${
                              staff.isActive
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title="Click to toggle active status"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${staff.isActive ? 'bg-emerald-600' : 'bg-slate-400'}`}
                            />
                            {staff.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStaff(staff);
                              setOpenPasswordModal(true);
                            }}
                            className={`${BTN} text-xs py-1 px-2 text-slate-600 hover:text-slate-900 mr-2`}
                            title="Reset password"
                          >
                            <Lock className="h-3.5 w-3.5 mr-1 text-slate-400" />
                            Password
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM ROLES MANAGER */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
            <Sparkles className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-blue-950">How Custom Roles Work</p>
              <p className="mt-0.5">
                Any custom role created here is immediately registered system-wide. When you open{' '}
                <Link to="/hr-management/employees" className="underline font-semibold hover:text-blue-800">
                  HR Management &gt; Employees
                </Link>
                , these custom roles will automatically appear in the Role dropdown for employee assignment and will
                seamlessly work in the mobile Staff App.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Custom Defined Roles</h2>
              <p className="text-xs text-slate-500">Create specialized designations for your organization.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpenRoleModal(true)}
              className={`${BTN_PRIMARY} bg-emerald-700 hover:bg-emerald-800 text-white`}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Custom Role
            </button>
          </div>

          {rolesData.custom?.length === 0 ? (
            <div className={`${PANEL} text-center py-16 px-4`}>
              <Sparkles className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-800">No custom roles created yet</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                Need roles like <em>Quality Inspector</em>, <em>Cold Storage Incharge</em>, or <em>Accountant</em>?
                Define them here and assign staff to them!
              </p>
              <button
                type="button"
                onClick={() => setOpenRoleModal(true)}
                className={`${BTN_PRIMARY} mt-4 mx-auto`}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create First Custom Role
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rolesData.custom.map((role) => (
                <div key={role.id || role.value} className={`${PANEL} p-5 flex flex-col justify-between hover:shadow-md transition`}>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-800 border border-purple-200">
                        {role.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(role.id, role.label)}
                        className="text-slate-400 hover:text-rose-600 transition p-1"
                        title="Delete Role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-400 mt-2">slug: {role.value}</p>
                    <p className="text-xs font-semibold text-slate-700 mt-1">Department: {role.department}</p>
                    {role.description && (
                      <p className="text-xs text-slate-500 mt-2 italic">{role.description}</p>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      <strong>{role.count}</strong> staff assigned
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium">Visible in HR ✓</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Standard Roles Reference */}
          <div className="mt-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Standard System Roles (Built-in)
            </h3>
            <div className="flex flex-wrap gap-2">
              {rolesData.standard?.map((sr) => (
                <span
                  key={sr.value}
                  className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs text-slate-700 font-medium"
                >
                  {sr.label} <span className="text-slate-400 font-normal">({sr.count} staff)</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOM NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Send Form */}
          <div className="lg:col-span-5">
            <div className={`${PANEL} p-5`}>
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-emerald-700" />
                <h2 className="text-base font-bold text-slate-900">Send Notification to Staff</h2>
              </div>
              <form onSubmit={handleSendNotification} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notification Title *
                  </label>
                  <input
                    className={INPUT}
                    placeholder="e.g., Diwali Bonus Credited / Tomorrow Shift Update"
                    required
                    value={notifForm.title}
                    onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Message *</label>
                  <textarea
                    className={`${INPUT} min-h-[90px]`}
                    placeholder="Enter detailed message to appear in the staff mobile app..."
                    required
                    value={notifForm.message}
                    onChange={(e) => setNotifForm({ ...notifForm, message: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                    <select
                      className={INPUT}
                      value={notifForm.category}
                      onChange={(e) => setNotifForm({ ...notifForm, category: e.target.value })}
                    >
                      <option value="general">General</option>
                      <option value="salary">Salary Alert</option>
                      <option value="meeting">Meeting Notice</option>
                      <option value="shift">Shift Update</option>
                      <option value="holiday">Holiday Notice</option>
                      <option value="policy">Policy Memo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                    <select
                      className={INPUT}
                      value={notifForm.priority}
                      onChange={(e) => setNotifForm({ ...notifForm, priority: e.target.value })}
                    >
                      <option value="normal">Normal</option>
                      <option value="important">Important</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Audience</label>
                  <select
                    className={INPUT}
                    value={notifForm.targetType}
                    onChange={(e) => setNotifForm({ ...notifForm, targetType: e.target.value })}
                  >
                    <option value="all">All Staff Members</option>
                    <option value="role">Specific Role</option>
                    <option value="staff">Specific Individual Staff Member</option>
                  </select>
                </div>

                {notifForm.targetType === 'role' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Select Role *</label>
                    <select
                      className={INPUT}
                      required
                      value={notifForm.targetRole}
                      onChange={(e) => setNotifForm({ ...notifForm, targetRole: e.target.value })}
                    >
                      <option value="">-- Choose Role --</option>
                      {rolesData.all?.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label} {r.isCustom ? '(Custom)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {notifForm.targetType === 'staff' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Staff Member *
                    </label>
                    <select
                      className={INPUT}
                      required
                      value={notifForm.targetStaffId}
                      onChange={(e) => setNotifForm({ ...notifForm, targetStaffId: e.target.value })}
                    >
                      <option value="">-- Choose Staff Member --</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.roleLabel})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className={`${BTN_PRIMARY} w-full justify-center bg-emerald-700 hover:bg-emerald-800 text-white mt-2`}
                >
                  <Send className="mr-1.5 h-4 w-4" />
                  {submitting ? 'Sending...' : 'Send Notification'}
                </button>
              </form>
            </div>
          </div>

          {/* Sent Notifications List */}
          <div className="lg:col-span-7">
            <div className={PANEL}>
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Recent Sent Notifications</h3>
                  <p className="text-xs text-slate-500">Live alerts received on staff mobile apps</p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold">
                  {notifications.length} Total
                </span>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <Bell className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-600">No custom notifications sent yet</p>
                  <p className="text-xs text-slate-400">Use the form on the left to broadcast to staff.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n._id} className="p-4 hover:bg-slate-50 transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900">{n.title}</h4>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                n.priority === 'urgent'
                                  ? 'bg-rose-100 text-rose-800'
                                  : n.priority === 'important'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {n.priority}
                            </span>
                            <span className="rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 text-[10px] font-semibold">
                              {n.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                          <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-400">
                            <span>Target: {n.targetType === 'all' ? 'All Staff' : n.targetRole || 'Individual'}</span>
                            <span>•</span>
                            <span>{new Date(n.createdAt).toLocaleString()}</span>
                            <span>•</span>
                            <span>{(n.readBy || []).length} Read</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteNotification(n._id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STAFF APP & HR HUB */}
      {activeTab === 'hr-hub' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 text-emerald-950">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-700" />
              GreenGroo Mobile Staff App Integration
            </h2>
            <p className="text-xs text-emerald-800 mt-1 max-w-2xl">
              The Flutter Staff App located in <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono">/staffapp</code> dynamically pulls data from GreenGroo HR Management modules.
              Staff members log in with credentials created on this page, and their role automatically unlocks their customized views:
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/hr-management/announcements"
              className={`${PANEL} p-5 hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between group`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <Megaphone className="h-6 w-6 text-emerald-700" />
                  <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-emerald-700 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mt-3">Announcements & Feed</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Draft and publish company-wide or role-wise announcements that display on staff app feed.
                </p>
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-4 flex items-center">
                Manage Announcements <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </p>
            </Link>

            <Link
              to="/hr-management/calendar"
              className={`${PANEL} p-5 hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between group`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <Calendar className="h-6 w-6 text-blue-700" />
                  <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-700 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mt-3">Holidays & Calendar</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure national, regional, and festival holidays shown in the staff app calendar.
                </p>
              </div>
              <p className="text-xs font-semibold text-blue-700 mt-4 flex items-center">
                Manage Holidays <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </p>
            </Link>

            <Link
              to="/hr-management/attendance"
              className={`${PANEL} p-5 hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between group`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <Clock className="h-6 w-6 text-amber-700" />
                  <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-amber-700 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mt-3">Attendance & Shifts</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Monitor live Punch In / Out logs from the staff app and schedule role-specific shift rosters.
                </p>
              </div>
              <p className="text-xs font-semibold text-amber-700 mt-4 flex items-center">
                View Attendance Logs <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </p>
            </Link>

            <Link
              to="/hr-management/leave"
              className={`${PANEL} p-5 hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between group`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <FileText className="h-6 w-6 text-purple-700" />
                  <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-purple-700 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mt-3">Leave Management</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Review and approve leave requests submitted by staff members from their phones.
                </p>
              </div>
              <p className="text-xs font-semibold text-purple-700 mt-4 flex items-center">
                Review Leave Requests <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </p>
            </Link>

            <Link
              to="/hr-management/payroll"
              className={`${PANEL} p-5 hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between group`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <DollarSign className="h-6 w-6 text-emerald-700" />
                  <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-emerald-700 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mt-3">Salary & Incentives</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Process monthly payruns, generate pay slips, and calculate performance incentives.
                </p>
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-4 flex items-center">
                Open Payroll & Pay Slips <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </p>
            </Link>

            <Link
              to="/hr-management/meetings"
              className={`${PANEL} p-5 hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between group`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <Users className="h-6 w-6 text-indigo-700" />
                  <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-indigo-700 transition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mt-3">Meetings & Video Links</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Schedule Google Meet or Zoom calls for staff roles with 1-click launch from the app.
                </p>
              </div>
              <p className="text-xs font-semibold text-indigo-700 mt-4 flex items-center">
                Schedule Staff Meetings <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* CREATE STAFF MODAL */}
      {openStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateStaff}
            className={`w-full max-w-xl max-h-[90vh] overflow-y-auto ${PANEL} p-6 shadow-2xl`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Staff Login</h3>
                <p className="text-xs text-slate-500">
                  Assign to any standard or custom role. Credentials can be used in the mobile staff app.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenStaffModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  className={INPUT}
                  required
                  placeholder="e.g. Ramesh Patil"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  className={INPUT}
                  required
                  placeholder="ramesh@greengroo.com"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone (10 digits) *</label>
                <input
                  type="tel"
                  className={INPUT}
                  required
                  placeholder="9876543210"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role *</label>
                <select
                  className={INPUT}
                  required
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                >
                  <optgroup label="Standard Roles">
                    {rolesData.standard?.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </optgroup>
                  {rolesData.custom?.length > 0 && (
                    <optgroup label="Custom Roles">
                      {rolesData.custom.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label} (Custom)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password *</label>
                <input
                  type="text"
                  className={INPUT}
                  required
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <input
                  className={INPUT}
                  placeholder="e.g. Operations / Quality"
                  value={staffForm.department}
                  onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Salary (₹)</label>
                <input
                  type="number"
                  className={INPUT}
                  placeholder="25000"
                  value={staffForm.monthlySalary}
                  onChange={(e) => setStaffForm({ ...staffForm, monthlySalary: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setOpenStaffModal(false)}
                className={BTN}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`${BTN_PRIMARY} bg-emerald-700 hover:bg-emerald-800 text-white`}
              >
                {submitting ? 'Creating...' : 'Create Login'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE CUSTOM ROLE MODAL */}
      {openRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateRole}
            className={`w-full max-w-lg ${PANEL} p-6 shadow-2xl`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Custom Role</h3>
                <p className="text-xs text-slate-500">
                  This role will be visible in HR Management when creating staff.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenRoleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Display Name *
                </label>
                <input
                  className={INPUT}
                  required
                  placeholder="e.g. Quality Inspector, Field Officer, Accountant"
                  value={roleForm.displayName}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
                    setRoleForm({ ...roleForm, displayName: name, roleKey: slug });
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Key (Slug identifier) *
                </label>
                <input
                  className={`${INPUT} font-mono text-xs`}
                  required
                  placeholder="e.g. quality_inspector"
                  value={roleForm.roleKey}
                  onChange={(e) => setRoleForm({ ...roleForm, roleKey: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Unique internal code used by staff logins and mobile app permissions.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <input
                  className={INPUT}
                  placeholder="e.g. Operations, Quality Assurance, Finance"
                  value={roleForm.department}
                  onChange={(e) => setRoleForm({ ...roleForm, department: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Responsibilities
                </label>
                <textarea
                  className={`${INPUT} min-h-[70px]`}
                  placeholder="Brief note on what this staff role is responsible for..."
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setOpenRoleModal(false)}
                className={BTN}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`${BTN_PRIMARY} bg-emerald-700 hover:bg-emerald-800 text-white`}
              >
                {submitting ? 'Creating...' : 'Create Role'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {openPasswordModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleResetPassword}
            className={`w-full max-w-sm ${PANEL} p-6 shadow-2xl`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Reset Password</h3>
              <button
                type="button"
                onClick={() => setOpenPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3">
              Set new password for <strong>{selectedStaff.name}</strong> ({selectedStaff.phone}):
            </p>

            <div className="mt-3">
              <input
                type="password"
                className={INPUT}
                required
                placeholder="New Password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setOpenPasswordModal(false)} className={BTN}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className={BTN_PRIMARY}>
                {submitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
