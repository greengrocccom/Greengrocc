import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  Award,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Users,
  Check,
  X,
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Loader2,
  Info,
  BookOpen,
  Calculator,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  DollarSign,
  GripVertical,
} from 'lucide-react';
import rewardApi from '../api/rewardApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../utils/ui';

const DEFAULT_TERMS = [
  "Earn 10 Reward Points for every ₹100 spent on successful orders.",
  "1 Reward Point is equivalent to ₹1.00 discount on future orders.",
  "A minimum of 10 points is required to start redeeming.",
  "You can pay up to 50% of your cart subtotal using reward points per order.",
  "Reward points are credited automatically once your order is confirmed.",
  "If an order is cancelled or refunded, any reward points used will be restored, and points earned on that order will be revoked.",
  "Reward points are non-transferable and cannot be exchanged for cash.",
  "GreenGrocc reserves the right to modify or terminate the reward points program terms at any time.",
];

export default function RewardPoints() {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'terms' | 'ledger'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    activeLiabilityPoints: 0,
    totalUsersWithPoints: 0,
  });

  // Settings state
  const [settings, setSettings] = useState({
    enabled: true,
    earningRate: { spendAmount: 100, pointsEarned: 10 },
    minOrderAmountToEarn: 0,
    pointValueInRupees: 1.0,
    minPointsToRedeem: 10,
    maxRedemptionPercent: 50,
    maxPointsPerOrder: 1000,
    minOrderAmountToRedeem: 100,
    termsAndConditions: DEFAULT_TERMS,
    welcomeBonusPoints: 0,
  });

  const [initialSettings, setInitialSettings] = useState(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [saveErrorMessage, setSaveErrorMessage] = useState('');

  // Simulator state
  const [simSpend, setSimSpend] = useState(1000);
  const [simPointsToUse, setSimPointsToUse] = useState(100);

  // Terms manager state
  const [editingTermIndex, setEditingTermIndex] = useState(null);
  const [editingTermText, setEditingTermText] = useState('');
  const [newTermText, setNewTermText] = useState('');

  // Ledger state
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Adjust Modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState('');
  const [adjustSuccess, setAdjustSuccess] = useState('');

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    setSaveErrorMessage('');
    try {
      const [settingsRes, statsRes] = await Promise.all([
        rewardApi.getAdminSettings(),
        rewardApi.getAdminStats(),
      ]);

      if (settingsRes.data) {
        setSettings({
          enabled: settingsRes.data.enabled !== false,
          earningRate: settingsRes.data.earningRate || { spendAmount: 100, pointsEarned: 10 },
          minOrderAmountToEarn: settingsRes.data.minOrderAmountToEarn ?? 0,
          pointValueInRupees: settingsRes.data.pointValueInRupees ?? 1.0,
          minPointsToRedeem: settingsRes.data.minPointsToRedeem ?? 10,
          maxRedemptionPercent: settingsRes.data.maxRedemptionPercent ?? 50,
          maxPointsPerOrder: settingsRes.data.maxPointsPerOrder ?? 1000,
          minOrderAmountToRedeem: settingsRes.data.minOrderAmountToRedeem ?? 100,
          termsAndConditions: settingsRes.data.termsAndConditions?.length
            ? settingsRes.data.termsAndConditions
            : DEFAULT_TERMS,
          welcomeBonusPoints: settingsRes.data.welcomeBonusPoints ?? 0,
        });
        setInitialSettings(JSON.stringify(settingsRes.data));
      }

      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      setSaveErrorMessage(err.response?.data?.message || 'Failed to load reward settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch ledger transactions
  const loadTransactions = async (page = 1) => {
    setTransactionsLoading(true);
    try {
      const res = await rewardApi.getAdminTransactions({
        page,
        limit: 15,
        type: typeFilter,
        search: searchQuery,
      });
      setTransactions(res.data || []);
      setLedgerPage(res.page || 1);
      setLedgerTotalPages(res.totalPages || 1);
      setLedgerTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ledger') {
      loadTransactions(ledgerPage);
    }
  }, [activeTab, ledgerPage, typeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setLedgerPage(1);
    loadTransactions(1);
  };

  // Has unsaved changes
  const hasChanges = useMemo(() => {
    if (!initialSettings) return false;
    try {
      const parsed = JSON.parse(initialSettings);
      return (
        parsed.enabled !== settings.enabled ||
        parsed.earningRate?.spendAmount !== settings.earningRate.spendAmount ||
        parsed.earningRate?.pointsEarned !== settings.earningRate.pointsEarned ||
        parsed.minOrderAmountToEarn !== settings.minOrderAmountToEarn ||
        parsed.pointValueInRupees !== settings.pointValueInRupees ||
        parsed.minPointsToRedeem !== settings.minPointsToRedeem ||
        parsed.maxRedemptionPercent !== settings.maxRedemptionPercent ||
        parsed.maxPointsPerOrder !== settings.maxPointsPerOrder ||
        parsed.minOrderAmountToRedeem !== settings.minOrderAmountToRedeem ||
        JSON.stringify(parsed.termsAndConditions) !== JSON.stringify(settings.termsAndConditions)
      );
    } catch {
      return false;
    }
  }, [settings, initialSettings]);

  // Save settings
  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccessMessage('');
    setSaveErrorMessage('');

    try {
      const res = await rewardApi.updateAdminSettings(settings);
      setSaveSuccessMessage('Reward settings and Terms & Conditions saved successfully!');
      setInitialSettings(JSON.stringify(res.data));
      setTimeout(() => setSaveSuccessMessage(''), 4000);
    } catch (err) {
      setSaveErrorMessage(err.response?.data?.message || 'Failed to save reward settings');
    } finally {
      setSaving(false);
    }
  };

  // Terms & Conditions Actions
  const handleAddTerm = () => {
    if (!newTermText.trim()) return;
    setSettings((prev) => ({
      ...prev,
      termsAndConditions: [...prev.termsAndConditions, newTermText.trim()],
    }));
    setNewTermText('');
  };

  const handleRemoveTerm = (index) => {
    setSettings((prev) => ({
      ...prev,
      termsAndConditions: prev.termsAndConditions.filter((_, i) => i !== index),
    }));
  };

  const handleStartEditTerm = (index) => {
    setEditingTermIndex(index);
    setEditingTermText(settings.termsAndConditions[index] || '');
  };

  const handleSaveEditTerm = (index) => {
    if (!editingTermText.trim()) return;
    const updated = [...settings.termsAndConditions];
    updated[index] = editingTermText.trim();
    setSettings((prev) => ({
      ...prev,
      termsAndConditions: updated,
    }));
    setEditingTermIndex(null);
    setEditingTermText('');
  };

  const handleResetDefaultTerms = () => {
    if (window.confirm('Reset Terms & Conditions to recommended default rules?')) {
      setSettings((prev) => ({
        ...prev,
        termsAndConditions: [...DEFAULT_TERMS],
      }));
    }
  };

  const handleMoveTerm = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= settings.termsAndConditions.length) return;
    const updated = [...settings.termsAndConditions];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setSettings((prev) => ({
      ...prev,
      termsAndConditions: updated,
    }));
  };

  // Adjust User Points Modal
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setAdjustSubmitting(true);
    setAdjustError('');
    setAdjustSuccess('');

    try {
      const res = await rewardApi.adjustUserPoints({
        userId: adjustUserId.trim(),
        points: Number(adjustPoints),
        reason: adjustReason.trim(),
      });
      setAdjustSuccess(res.message || 'Points adjusted successfully');
      setAdjustUserId('');
      setAdjustPoints('');
      setAdjustReason('');
      // Reload stats & ledger
      loadTransactions(1);
      const statsRes = await rewardApi.getAdminStats();
      if (statsRes.data) setStats(statsRes.data);
      setTimeout(() => {
        setShowAdjustModal(false);
        setAdjustSuccess('');
      }, 1500);
    } catch (err) {
      setAdjustError(err.response?.data?.message || 'Failed to adjust user points');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Simulator Calculations
  const simulatedPointsEarned = useMemo(() => {
    if (!settings.enabled || simSpend < settings.minOrderAmountToEarn) return 0;
    const spend = settings.earningRate.spendAmount || 100;
    const rate = settings.earningRate.pointsEarned || 10;
    return Math.floor((simSpend / spend) * rate);
  }, [simSpend, settings]);

  const simulatedDiscount = useMemo(() => {
    const maxDiscountAllowed = (simSpend * settings.maxRedemptionPercent) / 100;
    const maxPointsAllowed = Math.floor(maxDiscountAllowed / (settings.pointValueInRupees || 1.0));
    const effectivePoints = Math.min(simPointsToUse, maxPointsAllowed);
    return (effectivePoints * (settings.pointValueInRupees || 1.0)).toFixed(2);
  }, [simSpend, simPointsToUse, settings]);

  if (loading) {
    return (
      <div className={`${PANEL} flex h-96 items-center justify-center`}>
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
          <p className="text-sm font-medium">Loading Reward Points configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={PAGE_KICKER}>Promotions</p>
          <h1 className={PAGE_TITLE}>Reward Points</h1>
          <p className={PAGE_SUB}>
            Configure earning rules, redemption rates, caps, and Terms & Conditions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
              settings.enabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                settings.enabled ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            {settings.enabled ? 'Program Active' : 'Program Paused'}
          </div>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving || !hasChanges}
            className={BTN_PRIMARY}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-4 w-4" />
            )}
            {hasChanges ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {saveSuccessMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {saveErrorMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{saveErrorMessage}</span>
          </div>
          {saveErrorMessage.toLowerCase().includes('token') ||
          saveErrorMessage.toLowerCase().includes('login') ||
          saveErrorMessage.toLowerCase().includes('authorized') ? (
            <a href="/login" className={`${BTN_PRIMARY} h-8 min-h-0 shrink-0 px-3 text-xs`}>
              Sign In Again
            </a>
          ) : null}
        </div>
      )}

      {/* Analytics Stats Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${PANEL} p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Total Points Issued</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {Number(stats.totalPointsIssued).toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Total rewards credited on purchases</p>
        </div>

        <div className={`${PANEL} p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Total Points Redeemed</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {Number(stats.totalPointsRedeemed).toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            ₹{(Number(stats.totalPointsRedeemed) * (settings.pointValueInRupees || 1)).toLocaleString('en-IN')} saved at checkout
          </p>
        </div>

        <div className={`${PANEL} p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Active Liability Balance</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {Number(stats.activeLiabilityPoints).toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            ₹{(Number(stats.activeLiabilityPoints) * (settings.pointValueInRupees || 1)).toLocaleString('en-IN')} in customer wallets
          </p>
        </div>

        <div className={`${PANEL} p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Enrolled Customers</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {Number(stats.totalUsersWithPoints).toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Users holding positive point balances</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            activeTab === 'rules'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Earning & Redemption Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('terms')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            activeTab === 'terms'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          Terms & Conditions
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            activeTab === 'ledger'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Ledger & Adjustments
        </button>
      </div>

      {/* Tab 1: Rules & Conversion Settings */}
      {activeTab === 'rules' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left 2 Cols: Rule Configuration */}
          <div className="space-y-5 lg:col-span-2">
            {/* Master Toggle Card */}
            <div className={`${PANEL} p-5`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-800">
                      Reward Points Service Status
                    </h3>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                        settings.enabled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {settings.enabled ? 'Active / Visible' : 'Disabled / Hidden'}
                    </span>
                  </div>
                  <p className="mt-1 max-w-xl text-xs text-slate-500">
                    {settings.enabled
                      ? 'Reward points are active. Customers can view their wallet balance, check history, and apply discounts during checkout.'
                      : 'Reward points are disabled. The rewards wallet card, passbook link, and checkout redemption options are completely hidden from all users.'}
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-7 w-13 rounded-full bg-slate-200 after:absolute after:left-[4px] after:top-0.5 after:h-6 after:w-6 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-700 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                </label>
              </div>
            </div>

            {/* Earning Rules Card */}
            <div className={`${PANEL} space-y-4 p-5`}>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sparkles className="h-5 w-5 text-emerald-700" />
                <h3 className="text-base font-semibold text-slate-800">Purchase Earning Rules</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Spend Threshold (₹)
                  </label>
                  <p className="mb-1.5 text-[11px] text-slate-400">For every ₹ amount spent</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={settings.earningRate.spendAmount}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          earningRate: {
                            ...prev.earningRate,
                            spendAmount: Math.max(1, Number(e.target.value)),
                          },
                        }))
                      }
                      className={`${INPUT} pl-8`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Points Earned</label>
                  <p className="mb-1.5 text-[11px] text-slate-400">Points awarded per spend unit</p>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={settings.earningRate.pointsEarned}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          earningRate: {
                            ...prev.earningRate,
                            pointsEarned: Math.max(0, Number(e.target.value)),
                          },
                        }))
                      }
                      className={`${INPUT} pr-12`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-700">
                      pts
                    </span>
                  </div>
                </div>
              </div>

              {/* Effective Earning Highlight */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <Coins className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span>
                    Current Rule: Customer earns{' '}
                    <strong className="font-bold">{settings.earningRate.pointsEarned} points</strong> for every{' '}
                    <strong className="font-bold">₹{settings.earningRate.spendAmount}</strong> purchase
                    (Equivalent to {((settings.earningRate.pointsEarned * (settings.pointValueInRupees || 1) / (settings.earningRate.spendAmount || 1)) * 100).toFixed(1)}% reward back value)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Minimum Order Value to Earn Points (₹)
                </label>
                <p className="mb-1.5 text-[11px] text-slate-400">
                  Orders below this amount will not earn points (set 0 for all orders)
                </p>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={settings.minOrderAmountToEarn}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        minOrderAmountToEarn: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className={`${INPUT} pl-8`}
                  />
                </div>
              </div>
            </div>

            {/* Redemption Rules Card */}
            <div className={`${PANEL} space-y-4 p-5`}>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                <h3 className="text-base font-semibold text-slate-800">
                  Redemption & Conversion Rules
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Point Value (1 Point = ₹ ?)
                  </label>
                  <p className="mb-1.5 text-[11px] text-slate-400">Rupee value per 1 reward point</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.01"
                      value={settings.pointValueInRupees}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          pointValueInRupees: Math.max(0.01, Number(e.target.value)),
                        }))
                      }
                      className={`${INPUT} pl-8`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Minimum Points to Redeem
                  </label>
                  <p className="mb-1.5 text-[11px] text-slate-400">Minimum balance before redeeming</p>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={settings.minPointsToRedeem}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          minPointsToRedeem: Math.max(0, Number(e.target.value)),
                        }))
                      }
                      className={`${INPUT} pr-12`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      pts
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Max Subtotal Discount %
                  </label>
                  <p className="mb-1.5 text-[11px] text-slate-400">Max % of cart payable via points</p>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxRedemptionPercent}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxRedemptionPercent: Math.min(100, Math.max(1, Number(e.target.value))),
                        }))
                      }
                      className={`${INPUT} pr-10`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Max Points Cap Per Order
                  </label>
                  <p className="mb-1.5 text-[11px] text-slate-400">Upper point limit per order (0 = no cap)</p>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={settings.maxPointsPerOrder}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxPointsPerOrder: Math.max(0, Number(e.target.value)),
                        }))
                      }
                      className={`${INPUT} pr-12`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      pts
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Minimum Order Value to Redeem (₹)
                </label>
                <p className="mb-1.5 text-[11px] text-slate-400">
                  Cart subtotal required before points can be applied
                </p>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={settings.minOrderAmountToRedeem}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        minOrderAmountToRedeem: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className={`${INPUT} pl-8`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Live Interactive Rule Simulator */}
          <div className="space-y-5">
            <div className={`${PANEL} p-5`}>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Calculator className="h-5 w-5 text-emerald-700" />
                <h3 className="text-base font-semibold text-slate-800">Live Rule Simulator</h3>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Test how your earning & redemption rules calculate for real customer orders
              </p>

              <div className="mt-4 space-y-4">
                {/* Spend input slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Sample Order Amount</span>
                    <span className="font-bold text-emerald-700">₹{simSpend}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="10000"
                    step="50"
                    value={simSpend}
                    onChange={(e) => setSimSpend(Number(e.target.value))}
                    className="mt-2 w-full accent-emerald-700"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>₹100</span>
                    <span>₹5,000</span>
                    <span>₹10,000</span>
                  </div>
                </div>

                {/* Points to redeem slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Sample Points in Customer Wallet</span>
                    <span className="font-bold text-emerald-700">{simPointsToUse} pts</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    step="10"
                    value={simPointsToUse}
                    onChange={(e) => setSimPointsToUse(Number(e.target.value))}
                    className="mt-2 w-full accent-emerald-700"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0 pts</span>
                    <span>1,000 pts</span>
                    <span>2,000 pts</span>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Points Earned on this Order:</span>
                    <span className="flex items-center gap-1 font-bold text-emerald-700">
                      <Sparkles className="h-3.5 w-3.5" />+{simulatedPointsEarned} pts
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Max Discount Cap ({settings.maxRedemptionPercent}%):
                    </span>
                    <span className="font-semibold text-slate-700">
                      ₹{((simSpend * settings.maxRedemptionPercent) / 100).toFixed(0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    <span className="font-semibold text-slate-800">Applied Points Discount:</span>
                    <span className="text-sm font-bold text-emerald-700">-₹{simulatedDiscount}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    <span className="font-bold text-slate-900">Customer Final Pay:</span>
                    <span className="text-base font-extrabold text-slate-900">
                      ₹{Math.max(0, simSpend - Number(simulatedDiscount)).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-900">Recommended Settings</h4>
                  <p className="text-[11px] leading-relaxed text-emerald-700">
                    • 10 points per ₹100 gives a healthy 10% loyalty incentive.
                    <br />• A 50% max order cap ensures healthy gross margins per basket.
                    <br />• Real-time points redemption increases repeat order retention by over 30%.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Terms & Conditions Manager */}
      {activeTab === 'terms' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left 2 cols: List of editable terms */}
          <div className="space-y-4 lg:col-span-2">
            <div className={`${PANEL} space-y-4 p-5`}>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    Program Terms & Conditions
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Add, edit, remove, and reorder Terms and Conditions shown in the customer app
                  </p>
                </div>

                <button type="button" onClick={handleResetDefaultTerms} className={BTN}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Reset to Default
                </button>
              </div>

              {/* Add new term box */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a new term or policy rule (e.g. Points expire in 1 year)..."
                  value={newTermText}
                  onChange={(e) => setNewTermText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTerm()}
                  className={`flex-1 ${INPUT}`}
                />
                <button type="button" onClick={handleAddTerm} className={BTN_PRIMARY}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Rule
                </button>
              </div>

              {/* List of current terms */}
              <div className="space-y-2.5 pt-2">
                {settings.termsAndConditions.map((term, index) => (
                  <div
                    key={index}
                    className="group relative flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 transition hover:border-emerald-300"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
                      {index + 1}
                    </span>

                    {editingTermIndex === index ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          value={editingTermText}
                          onChange={(e) => setEditingTermText(e.target.value)}
                          className={`flex-1 ${INPUT} border-emerald-600`}
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEditTerm(index)}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditTerm(index)}
                          className="rounded-lg bg-emerald-700 p-1.5 text-white hover:bg-emerald-800"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTermIndex(null)}
                          className="rounded-lg bg-slate-200 p-1.5 text-slate-600 hover:bg-slate-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-between gap-4">
                        <p className="text-sm font-medium leading-relaxed text-slate-800">{term}</p>
                        <div className="flex shrink-0 items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleMoveTerm(index, -1)}
                            disabled={index === 0}
                            title="Move Up"
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveTerm(index, 1)}
                            disabled={index === settings.termsAndConditions.length - 1}
                            title="Move Down"
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditTerm(index)}
                            title="Edit"
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTerm(index)}
                            title="Delete"
                            className="rounded-md p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col: Customer Mobile UI Mockup Preview */}
          <div>
            <div className="sticky top-6 rounded-3xl border-4 border-slate-700 bg-slate-800 p-3 shadow-xl">
              <div className="mx-auto mb-3 h-4 w-24 rounded-full bg-slate-700" />
              <div className="min-h-[480px] space-y-3 rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-900">Reward Points & T&C</span>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                    Live Customer Preview
                  </span>
                </div>

                <div className="rounded-xl bg-emerald-700 p-3.5 text-white shadow-sm">
                  <p className="text-[10px] font-semibold opacity-90">GreenGrocc Rewards Balance</p>
                  <p className="mt-0.5 text-xl font-black">250 Points</p>
                  <p className="mt-1 text-[10px] font-medium opacity-90">
                    Worth ₹250.00 discount on your orders
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Program Terms
                  </p>
                  <ul className="space-y-2 text-[11px] leading-relaxed text-slate-600">
                    {settings.termsAndConditions.map((term, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="font-bold text-emerald-600">•</span>
                        <span>{term}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Ledger & Manual Adjustments */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Controls row */}
          <div className={`${PANEL} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
            <form onSubmit={handleSearchSubmit} className="flex max-w-md flex-1 items-center gap-2">
              <input
                type="text"
                placeholder="Search user name, phone, or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={INPUT}
              />
              <button type="submit" className={BTN}>
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setLedgerPage(1);
                }}
                className={`${INPUT} w-auto`}
              >
                <option value="all">All Transaction Types</option>
                <option value="earned">Earned (+)</option>
                <option value="redeemed">Redeemed (-)</option>
                <option value="refunded">Refunded (+)</option>
                <option value="reversal">Reversal (-)</option>
                <option value="admin_adjustment">Admin Adjustments</option>
              </select>

              <button
                type="button"
                onClick={() => setShowAdjustModal(true)}
                className={BTN_PRIMARY}
              >
                <UserCheck className="mr-1.5 h-4 w-4" />
                Manual Point Adjustment
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className={`${PANEL} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-100 bg-slate-50/80">
                  <tr>
                    <th className={TH}>Customer</th>
                    <th className={TH}>Type</th>
                    <th className={TH}>Points</th>
                    <th className={TH}>Balance After</th>
                    <th className={TH}>Description</th>
                    <th className={TH}>Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactionsLoading ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
                        <span className="mt-2 block text-xs">Loading ledger entries...</span>
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-sm text-slate-400">
                        No points transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const isPositive = tx.points > 0;
                      return (
                        <tr key={tx._id} className="transition-colors hover:bg-slate-50/50">
                          <td className="px-3 py-2.5">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {tx.user?.name || 'Customer'}
                              </p>
                              <p className="text-xs text-slate-500">{tx.user?.phone || 'No phone'}</p>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${
                                tx.type === 'earned'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : tx.type === 'redeemed'
                                  ? 'bg-slate-100 text-slate-700'
                                  : tx.type === 'refunded'
                                  ? 'bg-emerald-50/80 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {tx.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`flex items-center gap-0.5 font-bold ${
                                isPositive ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="h-4 w-4" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" />
                              )}
                              {isPositive ? `+${tx.points}` : tx.points} pts
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-slate-900">{tx.balanceAfter} pts</span>
                          </td>
                          <td className="max-w-xs truncate px-3 py-2.5 text-xs text-slate-600">
                            {tx.description}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3">
              <span className="text-xs text-slate-500">
                Total {ledgerTotal} transactions recorded
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={ledgerPage <= 1}
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  className={BTN}
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-slate-600">
                  Page {ledgerPage} of {ledgerTotalPages}
                </span>
                <button
                  type="button"
                  disabled={ledgerPage >= ledgerTotalPages}
                  onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))}
                  className={BTN}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Point Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className={`relative w-full max-w-md ${PANEL} p-5 shadow-xl sm:p-6`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Award className="h-5 w-5 text-emerald-700" />
                Manual Point Adjustment
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAdjustModal(false);
                  setAdjustError('');
                  setAdjustSuccess('');
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {adjustSuccess && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                {adjustSuccess}
              </div>
            )}

            {adjustError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">User ID</label>
                <input
                  type="text"
                  required
                  placeholder="Paste User Mongo _id"
                  value={adjustUserId}
                  onChange={(e) => setAdjustUserId(e.target.value)}
                  className={`mt-1 ${INPUT}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Points Adjustment (+ to Credit, - to Debit)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 50 or -20"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  className={`mt-1 ${INPUT}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Reason / Audit Note
                </label>
                <textarea
                  rows="2"
                  required
                  placeholder="e.g. Loyalty compensation for delayed delivery"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className={`mt-1 ${INPUT}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdjustModal(false)} className={BTN}>
                  Cancel
                </button>
                <button type="submit" disabled={adjustSubmitting} className={BTN_PRIMARY}>
                  {adjustSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}