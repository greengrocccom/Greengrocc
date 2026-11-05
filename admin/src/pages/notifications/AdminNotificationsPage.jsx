import { useMemo, useState, useRef } from 'react';
import { useLive } from '../../realtime/useLive';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Play,
  CheckCheck,
  Check,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Calendar,
  AlertTriangle,
  Users,
  Building2,
  CreditCard,
  Clock,
  ExternalLink,
  ChevronRight,
  Trash2,
  Plus,
  X,
  Sliders,
  Sparkles,
  Info,
  ShieldAlert,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import apiClient from '../../api/client';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';
import {
  SOUND_PRESETS,
  getSoundSettings,
  saveSoundSettings,
  playNotificationSound,
} from '../../utils/notificationSound';

const CATEGORIES = [
  { id: 'all', label: 'All Alerts', icon: Bell },
  { id: 'payroll', label: 'Due Payments', icon: DollarSign },
  { id: 'meeting', label: 'Meetings & Interviews', icon: Calendar },
  { id: 'hr', label: 'HR & Leaves', icon: Users },
  { id: 'compliance', label: 'B2B & KYC', icon: Building2 },
  { id: 'payment', label: 'Store & Invoices', icon: CreditCard },
  { id: 'general', label: 'System & Custom', icon: Info },
];

function formatTimeAgo(dateString) {
  if (!dateString) return 'Recent';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Recent';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getPriorityStyles(priority) {
  switch (priority) {
    case 'critical':
      return {
        badge: 'bg-rose-100 text-rose-800 border-rose-200',
        ring: 'ring-rose-500/20',
        border: 'border-l-rose-500',
        dot: 'bg-rose-500',
      };
    case 'high':
      return {
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        ring: 'ring-amber-500/20',
        border: 'border-l-amber-500',
        dot: 'bg-amber-500',
      };
    case 'normal':
    default:
      return {
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        ring: 'ring-blue-500/10',
        border: 'border-l-blue-500',
        dot: 'bg-blue-500',
      };
  }
}

function getCategoryIcon(category) {
  switch (category) {
    case 'payroll':
      return { icon: DollarSign, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'meeting':
      return { icon: Calendar, bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'hr':
      return { icon: Users, bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'compliance':
      return { icon: Building2, bg: 'bg-teal-50 text-teal-700 border-teal-200' };
    case 'payment':
      return { icon: CreditCard, bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    default:
      return { icon: Bell, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export default function AdminNotificationsPage() {
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [searchQuery, setSearchQuery] = useState('');

  // Audio & Sound Settings
  const [soundSettings, setSoundSettings] = useState(getSoundSettings);
  const [isSoundModalOpen, setIsSoundModalOpen] = useState(false);
  const [previewingSound, setPreviewingSound] = useState(false);

  // Custom Alert Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    message: '',
    category: 'general',
    priority: 'normal',
    actionLabel: '',
    actionLink: '',
    playSound: true,
  });
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const prevUnreadCountRef = useRef(null);

  const loadAlerts = async (silent = false, force = true) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get('/admin/notifications/system-alerts', { live: !force });
      const data = res.data?.data || [];
      const newMetrics = res.data?.metrics || null;

      // Detect incoming alerts and play chime if unread increased
      if (
        soundSettings.enabled &&
        prevUnreadCountRef.current !== null &&
        newMetrics &&
        newMetrics.unreadCount > prevUnreadCountRef.current
      ) {
        playNotificationSound(soundSettings.preset, soundSettings.volume);
      }
      prevUnreadCountRef.current = newMetrics?.unreadCount ?? data.filter((a) => !a.isRead).length;

      setAlerts(data);
      setMetrics(newMetrics);
      setError('');
    } catch (err) {
      console.error('Failed to load system alerts:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load notifications');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useLive(({ silent }) => loadAlerts(silent, false));

  const toggleSound = () => {
    const next = { ...soundSettings, enabled: !soundSettings.enabled };
    setSoundSettings(next);
    saveSoundSettings(next);
    if (next.enabled) {
      playNotificationSound(next.preset, next.volume);
    }
  };

  const handleTestSound = (presetToTest = null) => {
    setPreviewingSound(true);
    const targetPreset = presetToTest || soundSettings.preset;
    playNotificationSound(targetPreset, soundSettings.volume);
    setTimeout(() => setPreviewingSound(false), 800);
  };

  const handleSaveSoundSettings = (newPreset, newVolume) => {
    const next = {
      ...soundSettings,
      preset: newPreset,
      volume: typeof newVolume === 'number' ? newVolume : soundSettings.volume,
    };
    setSoundSettings(next);
    saveSoundSettings(next);
  };

  const handleMarkAsRead = async (alert) => {
    try {
      const encodedId = encodeURIComponent(alert.alertKey || alert.id);
      await apiClient.put(`/admin/notifications/system-alerts/${encodedId}/read`);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, isRead: true } : a))
      );
      setMetrics((prev) =>
        prev ? { ...prev, unreadCount: Math.max(0, prev.unreadCount - 1) } : prev
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleDismissAlert = async (alert) => {
    try {
      const encodedId = encodeURIComponent(alert.alertKey || alert.id);
      await apiClient.put(`/admin/notifications/system-alerts/${encodedId}/dismiss`);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalAlerts: Math.max(0, prev.totalAlerts - 1),
          unreadCount: alert.isRead ? prev.unreadCount : Math.max(0, prev.unreadCount - 1),
        };
      });
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setActionBusy(true);
    try {
      const unreadKeys = alerts.filter((a) => !a.isRead).map((a) => a.alertKey || a.id);
      await apiClient.put('/admin/notifications/system-alerts/read-all', {
        alertKeys: unreadKeys,
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
      setMetrics((prev) => (prev ? { ...prev, unreadCount: 0 } : prev));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateCustomAlert = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.message.trim()) {
      alert('Title and message are required');
      return;
    }
    setSubmittingCreate(true);
    try {
      await apiClient.post('/admin/notifications/system-alerts/custom', createForm);
      if (createForm.playSound) {
        playNotificationSound(soundSettings.preset, soundSettings.volume);
      }
      setIsCreateModalOpen(false);
      setCreateForm({
        title: '',
        message: '',
        category: 'general',
        priority: 'normal',
        actionLabel: '',
        actionLink: '',
        playSound: true,
      });
      await loadAlerts();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create alert');
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Category filter
      if (selectedCategory !== 'all' && alert.category !== selectedCategory) {
        return false;
      }
      // Priority filter
      if (selectedPriority !== 'all' && alert.priority !== selectedPriority) {
        return false;
      }
      // Status filter
      if (statusFilter === 'unread' && alert.isRead) return false;
      if (statusFilter === 'read' && !alert.isRead) return false;

      // Query search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = (alert.title || '').toLowerCase().includes(q);
        const inMessage = (alert.message || '').toLowerCase().includes(q);
        const inEmp = (alert.metadata?.name || '').toLowerCase().includes(q);
        if (!inTitle && !inMessage && !inEmp) return false;
      }

      return true;
    });
  }, [alerts, selectedCategory, selectedPriority, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={PAGE_KICKER}>Command Center & Operations Radar</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Live Alerts
            </span>
          </div>
          <h1 className={`${PAGE_TITLE} mt-1 flex items-center gap-2.5`}>
            <div className="relative">
              <Bell className="h-7 w-7 text-emerald-600" />
              {(metrics?.unreadCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white animate-pulse" />
              )}
            </div>
            Notifications & System Alerts
          </h1>
          <p className={`${PAGE_SUB} mt-1`}>
            Track employee salary dues, scheduled meetings, leave approvals, and operations warnings with real-time sound notifications
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition shadow-2xs ${
              soundSettings.enabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            title={soundSettings.enabled ? 'Sound notifications are ON' : 'Sound notifications are MUTED'}
          >
            {soundSettings.enabled ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <VolumeX className="h-4 w-4" />}
            <span>Sound: {soundSettings.enabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Test Sound Button */}
          <button
            type="button"
            onClick={() => handleTestSound()}
            disabled={previewingSound}
            className={`${BTN} gap-1.5 text-xs text-slate-700`}
            title="Preview notification chime"
          >
            <Play className={`h-3.5 w-3.5 text-emerald-600 ${previewingSound ? 'animate-bounce' : ''}`} />
            <span>Test Chime</span>
          </button>

          {/* Sound Settings Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsSoundModalOpen(true)}
            className={`${BTN} p-2 text-slate-600 hover:text-slate-900`}
            title="Configure Sound Tone and Volume"
          >
            <Sliders className="h-4 w-4" />
          </button>

          {/* Mark All as Read */}
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={actionBusy || (metrics?.unreadCount || 0) === 0}
            className={`${BTN} gap-1.5 text-xs text-slate-700 disabled:opacity-50`}
            title="Mark all notifications as read"
          >
            <CheckCheck className="h-4 w-4 text-blue-600" />
            <span className="hidden sm:inline">Mark All Read</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => loadAlerts()}
            disabled={loading}
            className={`${BTN} gap-1.5 text-xs`}
            title="Refresh alerts"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* New Custom Alert */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className={`${BTN_PRIMARY} gap-1.5 text-xs shadow-sm`}
          >
            <Plus className="h-4 w-4" />
            <span>New Alert</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Alerts */}
        <div className={`${PANEL} p-5 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Alerts</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">
                {metrics?.totalAlerts ?? alerts.length}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({metrics?.unreadCount ?? alerts.filter((a) => !a.isRead).length} unread)
                </span>
              </h3>
              <p className="mt-1 text-xs text-slate-500">Aggregated from ERP & HR</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
              <Bell className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Live audio monitoring active</span>
          </div>
        </div>

        {/* Card 2: Due Payments */}
        <div className={`${PANEL} p-5 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Employee Due Payments</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">
                ₹{(metrics?.duePaymentsTotal || 0).toLocaleString('en-IN')}
              </h3>
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {metrics?.duePaymentsCount || 0} salary disbursements pending
              </p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <Link
              to="/hr-management/payroll"
              className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
            >
              Open Payroll Console <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Card 3: Scheduled Meetings & Interviews */}
        <div className={`${PANEL} p-5 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Meetings & Interviews</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">
                {metrics?.meetingsCount || 0}
              </h3>
              <p className="mt-1 text-xs text-purple-600 font-medium">Scheduled syncs & candidate reviews</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <Link
              to="/hr-management/meetings"
              className="text-purple-700 font-semibold hover:underline inline-flex items-center gap-1"
            >
              Manage Meetings <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Card 4: Urgent & Critical Actions */}
        <div className={`${PANEL} p-5 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Urgent Priority</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">
                {metrics?.urgentCount || 0}
              </h3>
              <p className="mt-1 text-xs text-amber-600 font-medium">Requires immediate administrative action</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span className="font-semibold text-slate-700">High priority alerts flagged with audio ring</span>
          </div>
        </div>
      </div>

      {/* Filter and Category Bar */}
      <div className={`${PANEL} p-4 space-y-4`}>
        {/* Category Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 admin-scrollbar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const count =
              cat.id === 'all'
                ? alerts.length
                : alerts.filter((a) => a.category === cat.id).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search and Secondary Select Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alerts by title, employee name, or description..."
              className={`${INPUT} pl-9 text-xs`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical / Overdue</option>
              <option value="high">High Priority</option>
              <option value="normal">Normal</option>
            </select>

            {/* Read Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread Only</option>
              <option value="read">Read Only</option>
            </select>

            {(searchQuery || selectedCategory !== 'all' || selectedPriority !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedPriority('all');
                  setStatusFilter('all');
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-center justify-between">
          <div>
            <p className="font-semibold">Unable to fetch notifications</p>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => loadAlerts()}
            className="rounded-lg bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Notification Alerts Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm font-medium">Scanning live ERP & HR alerts...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className={`${PANEL} p-12 text-center`}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCheck className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">All Clear! No Pending Alerts</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {searchQuery || selectedCategory !== 'all' || selectedPriority !== 'all' || statusFilter !== 'all'
              ? 'No notifications match your current filter criteria.'
              : 'All employee payroll dues, scheduled meetings, and operation compliance tasks are up to date.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => handleTestSound()}
              className={`${BTN} gap-1.5 text-xs`}
            >
              <Play className="h-3.5 w-3.5 text-emerald-600" />
              <span>Test Audio Alert</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className={`${BTN_PRIMARY} gap-1.5 text-xs`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Notification</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const catInfo = getCategoryIcon(alert.category);
            const CatIcon = catInfo.icon;
            const pStyles = getPriorityStyles(alert.priority);

            return (
              <div
                key={alert.id}
                className={`${PANEL} p-4 sm:p-5 transition-all border-l-4 ${pStyles.border} ${
                  alert.isRead ? 'bg-white opacity-85' : 'bg-white shadow-sm ring-1 ring-slate-200/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Left: Icon & Alert Content */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div
                      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${catInfo.bg}`}
                    >
                      <CatIcon className="h-5 w-5" />
                      {!alert.isRead && (
                        <span
                          className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${pStyles.dot} ${alert.priority === 'critical' ? 'admin-emergency-indicator' : ''} ring-2 ring-white`}
                          title={alert.priority === 'critical' ? 'Critical � needs attention' : 'Unread Alert'}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Badge Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pStyles.badge}`}
                        >
                          {alert.badge?.label || alert.priority}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 capitalize">
                          {alert.category}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(alert.timestamp)}
                        </span>
                        {alert.dueDate && (
                          <span className="text-[11px] font-medium text-slate-500">
                            Due by: {alert.dueDate}
                          </span>
                        )}
                      </div>

                      {/* Title & Body */}
                      <h4 className="mt-1.5 text-sm font-bold text-slate-900 leading-snug">
                        {alert.title}
                      </h4>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                        {alert.message}
                      </p>

                      {/* Dynamic Details Chips */}
                      {alert.category === 'payroll' && alert.metadata && (
                        <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50/70 border border-emerald-100 px-3 py-1.5 text-xs text-emerald-900">
                          <span className="font-semibold">
                            Employee: {alert.metadata.name}
                          </span>
                          <span>•</span>
                          <span>Month: {alert.metadata.month}</span>
                          <span>•</span>
                          <span className="font-bold text-emerald-800">
                            Net Payable: ₹{(alert.metadata.net || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}

                      {alert.category === 'meeting' && alert.metadata && (
                        <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-lg bg-purple-50/70 border border-purple-100 px-3 py-1.5 text-xs text-purple-900">
                          {alert.metadata.meetingId && (
                            <span className="font-mono">
                              ID: {alert.metadata.meetingId}
                            </span>
                          )}
                          {alert.metadata.password && (
                            <span>Passcode: {alert.metadata.password}</span>
                          )}
                          {alert.metadata.link && (
                            <a
                              href={alert.metadata.link}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold underline text-purple-700 inline-flex items-center gap-0.5"
                            >
                              Join URL <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="flex items-center gap-1.5">
                      {/* Deep Link Button */}
                      {alert.actionLink && (
                        <Link
                          to={alert.actionLink}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-2xs"
                        >
                          <span>{alert.actionLabel || 'Take Action'}</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}

                      {/* Mark Read Button */}
                      {!alert.isRead ? (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(alert)}
                          className={`${BTN} p-1.5 text-emerald-700 hover:bg-emerald-50`}
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium px-2 py-1">
                          Read
                        </span>
                      )}

                      {/* Dismiss / Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDismissAlert(alert)}
                        className={`${BTN} p-1.5 text-slate-400 hover:text-rose-600 hover:border-rose-200`}
                        title="Dismiss alert"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: CONFIGURE SOUND SETTINGS */}
      {isSoundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                  <Volume2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Notification Sound Settings</h3>
                  <p className="text-xs text-slate-500">Synthesized audio chimes for real-time alerts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSoundModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Sound Enable Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div>
                  <p className="text-sm font-bold text-slate-800">Enable Alert Sounds</p>
                  <p className="text-xs text-slate-500">Play chime whenever new urgent alerts arrive</p>
                </div>
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    soundSettings.enabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      soundSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Volume Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span>Chime Volume</span>
                  <span>{Math.round((soundSettings.volume ?? 0.8) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={soundSettings.volume ?? 0.8}
                  onChange={(e) => handleSaveSoundSettings(soundSettings.preset, parseFloat(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              {/* Presets List */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Chime Tone
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {SOUND_PRESETS.map((preset) => {
                    const isSelected = soundSettings.preset === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                        onClick={() => handleSaveSoundSettings(preset.id, soundSettings.volume)}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="soundPreset"
                            checked={isSelected}
                            onChange={() => handleSaveSoundSettings(preset.id, soundSettings.volume)}
                            className="accent-emerald-600 h-4 w-4"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{preset.label}</p>
                            <p className="text-[11px] text-slate-500">{preset.description}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(preset.id);
                          }}
                          className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100 transition"
                          title="Preview tone"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSoundModalOpen(false)}
                  className={`${BTN_PRIMARY} px-5`}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE CUSTOM ALERT */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Publish System Alert</h3>
                  <p className="text-xs text-slate-500">Dispatch an immediate notification with sound</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomAlert} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Alert Title *</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. Urgent: Emergency Team Meeting / Payment Clearance"
                  className={`${INPUT} mt-1`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Message / Instructions *</label>
                <textarea
                  rows={3}
                  required
                  value={createForm.message}
                  onChange={(e) => setCreateForm({ ...createForm, message: e.target.value })}
                  placeholder="Provide context, required actions, or instructions..."
                  className={`${INPUT} mt-1`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className={`${INPUT} mt-1`}
                  >
                    <option value="general">General Alert</option>
                    <option value="payroll">Due Payment</option>
                    <option value="meeting">Meeting / Interview</option>
                    <option value="hr">HR & Staff</option>
                    <option value="compliance">Compliance & KYC</option>
                    <option value="payment">Cashflow & Payment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Priority Level</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    className={`${INPUT} mt-1`}
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical / Overdue</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Action Button Label</label>
                  <input
                    type="text"
                    value={createForm.actionLabel}
                    onChange={(e) => setCreateForm({ ...createForm, actionLabel: e.target.value })}
                    placeholder="e.g. Disburse Salary / Open Link"
                    className={`${INPUT} mt-1`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Target Route / URL</label>
                  <input
                    type="text"
                    value={createForm.actionLink}
                    onChange={(e) => setCreateForm({ ...createForm, actionLink: e.target.value })}
                    placeholder="e.g. /hr-management/payroll"
                    className={`${INPUT} mt-1`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="playSound"
                  checked={createForm.playSound}
                  onChange={(e) => setCreateForm({ ...createForm, playSound: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="playSound" className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                  Play audio chime immediately upon publishing
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className={`${BTN_PRIMARY} gap-1.5`}
                >
                  {submittingCreate ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                  Publish Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
