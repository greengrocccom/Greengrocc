import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Award,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  TrendingUp,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import {
  BTN,
  BTN_PRIMARY,
  INPUT,
  PAGE_KICKER,
  PAGE_SUB,
  PAGE_TITLE,
  PANEL,
  TH,
} from '../../utils/ui';
import { HrBackButtons, inr, personKey, Pill, pretty } from './hrShared';

const APPRAISAL_CYCLES = [
  'Annual Appraisal',
  'Mid-Year Review',
  'Probation Clearance',
  'Merit / Out-of-turn',
  'Market Adjustment',
  'Promotion Hike',
  'Other',
];

const PROMOTION_STATUSES = [
  { value: 'effective', label: 'Effective', tone: 'green' },
  { value: 'approved', label: 'Approved', tone: 'emerald' },
  { value: 'pending', label: 'Pending', tone: 'amber' },
  { value: 'rejected', label: 'Rejected', tone: 'rose' },
];

const INCREMENT_STATUSES = [
  { value: 'processed', label: 'Processed', tone: 'green' },
  { value: 'approved', label: 'Approved', tone: 'emerald' },
  { value: 'pending', label: 'Pending', tone: 'amber' },
  { value: 'rejected', label: 'Rejected', tone: 'rose' },
];

const DEFAULT_KPIS = [
  { metric: 'Quality & Accuracy of Work', score: 5, maxScore: 5, comments: '' },
  { metric: 'Punctuality & Attendance', score: 5, maxScore: 5, comments: '' },
  { metric: 'Job Knowledge & Technical Skill', score: 5, maxScore: 5, comments: '' },
  { metric: 'Teamwork & Collaboration', score: 5, maxScore: 5, comments: '' },
  { metric: 'Initiative & Problem Solving', score: 4, maxScore: 5, comments: '' },
];

export default function HrPerformancePage() {
  const [params, setParams] = useSearchParams();
  const currentTab = params.get('tab') || 'promotions';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Data lists
  const [people, setPeople] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [promotionStats, setPromotionStats] = useState({});
  const [increments, setIncrements] = useState([]);
  const [incrementStats, setIncrementStats] = useState({});
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({});

  // Modals state
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showIncrModal, setShowIncrModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [promoForm, setPromoForm] = useState({
    employeeKey: '',
    previousRole: '',
    newRole: '',
    previousDesignation: '',
    newDesignation: '',
    previousDepartment: '',
    newDepartment: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: '',
    approvedBy: 'Admin HR',
    status: 'effective',
  });

  const [incrForm, setIncrForm] = useState({
    employeeKey: '',
    previousSalary: 0,
    newSalary: 0,
    hikePercentage: 10,
    effectiveDate: new Date().toISOString().slice(0, 10),
    cycle: 'Annual Appraisal',
    reason: '',
    approvedBy: 'Admin HR',
    status: 'processed',
  });

  const [reviewForm, setReviewForm] = useState({
    employeeKey: '',
    reviewPeriod: `${new Date().getFullYear()} Annual Review`,
    rating: 4.5,
    kpis: DEFAULT_KPIS,
    achievements: '',
    improvementAreas: '',
    feedback: '',
    goals: '',
    reviewedBy: 'HR Appraiser',
    reviewDate: new Date().toISOString().slice(0, 10),
    status: 'finalized',
  });

  const setTab = (tab) => {
    setParams({ tab });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [peopleRes, promoRes, incrRes, reviewRes] = await Promise.all([
        opsApi.list('hr').catch(() => ({ data: [] })),
        opsApi.list('hr/promotions').catch(() => ({ data: [], stats: {} })),
        opsApi.list('hr/increments').catch(() => ({ data: [], stats: {} })),
        opsApi.list('hr/performance').catch(() => ({ data: [], stats: {} })),
      ]);

      const loadedPeople = peopleRes.data || [];
      setPeople(loadedPeople);
      setPromotions(promoRes.data || []);
      setPromotionStats(promoRes.stats || {});
      setIncrements(incrRes.data || []);
      setIncrementStats(incrRes.stats || {});
      setReviews(reviewRes.data || []);
      setReviewStats(reviewRes.stats || {});
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load career data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle employee selection in promotion modal
  const handleSelectPromoEmployee = (key) => {
    const selected = people.find((p) => personKey(p) === key);
    if (!selected) {
      setPromoForm((prev) => ({ ...prev, employeeKey: '' }));
      return;
    }
    setPromoForm((prev) => ({
      ...prev,
      employeeKey: key,
      previousRole: selected.role || selected.roleKey || '',
      newRole: selected.role || selected.roleKey || '',
      previousDesignation: selected.designation || selected.role || '',
      newDesignation: prev.newDesignation || selected.designation || '',
      previousDepartment: selected.department || '',
      newDepartment: prev.newDepartment || selected.department || '',
    }));
  };

  // Handle employee selection in increment modal
  const handleSelectIncrEmployee = (key) => {
    const selected = people.find((p) => personKey(p) === key);
    if (!selected) {
      setIncrForm((prev) => ({ ...prev, employeeKey: '', previousSalary: 0, newSalary: 0 }));
      return;
    }
    const currentSal = Number(selected.monthlySalary || 0);
    const hike = Number(incrForm.hikePercentage || 10);
    const newSal = Math.round(currentSal * (1 + hike / 100));
    setIncrForm((prev) => ({
      ...prev,
      employeeKey: key,
      previousSalary: currentSal,
      newSalary: newSal,
    }));
  };

  const handleIncrSalaryChange = (newSal) => {
    const prev = Number(incrForm.previousSalary || 0);
    const n = Number(newSal || 0);
    const pct = prev > 0 ? Number((((n - prev) / prev) * 100).toFixed(1)) : 0;
    setIncrForm((f) => ({ ...f, newSalary: n, hikePercentage: pct }));
  };

  const handleIncrPctChange = (pct) => {
    const prev = Number(incrForm.previousSalary || 0);
    const p = Number(pct || 0);
    const newSal = Math.round(prev * (1 + p / 100));
    setIncrForm((f) => ({ ...f, hikePercentage: p, newSalary: newSal }));
  };

  // Submit Promotion
  const handleCreatePromotion = async (e) => {
    e.preventDefault();
    const selected = people.find((p) => personKey(p) === promoForm.employeeKey);
    if (!selected) {
      alert('Please select an employee');
      return;
    }
    if (!promoForm.newDesignation.trim()) {
      alert('Please enter new designation');
      return;
    }
    setSubmitting(true);
    try {
      await opsApi.create('hr/promotions', {
        employeeId: selected.id,
        employeeType: selected.employeeType,
        name: selected.name,
        previousRole: promoForm.previousRole,
        newRole: promoForm.newRole,
        previousDesignation: promoForm.previousDesignation,
        newDesignation: promoForm.newDesignation.trim(),
        previousDepartment: promoForm.previousDepartment,
        newDepartment: promoForm.newDepartment.trim(),
        effectiveDate: promoForm.effectiveDate,
        reason: promoForm.reason.trim(),
        approvedBy: promoForm.approvedBy.trim(),
        status: promoForm.status,
      });
      setShowPromoModal(false);
      setPromoForm({
        employeeKey: '',
        previousRole: '',
        newRole: '',
        previousDesignation: '',
        newDesignation: '',
        previousDepartment: '',
        newDepartment: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: '',
        approvedBy: 'Admin HR',
        status: 'effective',
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record promotion');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Increment
  const handleCreateIncrement = async (e) => {
    e.preventDefault();
    const selected = people.find((p) => personKey(p) === incrForm.employeeKey);
    if (!selected) {
      alert('Please select an employee');
      return;
    }
    if (Number(incrForm.newSalary) <= 0) {
      alert('New monthly salary must be greater than 0');
      return;
    }
    setSubmitting(true);
    try {
      await opsApi.create('hr/increments', {
        employeeId: selected.id,
        employeeType: selected.employeeType,
        name: selected.name,
        previousSalary: Number(incrForm.previousSalary || 0),
        newSalary: Number(incrForm.newSalary),
        effectiveDate: incrForm.effectiveDate,
        cycle: incrForm.cycle,
        reason: incrForm.reason.trim(),
        approvedBy: incrForm.approvedBy.trim(),
        status: incrForm.status,
      });
      setShowIncrModal(false);
      setIncrForm({
        employeeKey: '',
        previousSalary: 0,
        newSalary: 0,
        hikePercentage: 10,
        effectiveDate: new Date().toISOString().slice(0, 10),
        cycle: 'Annual Appraisal',
        reason: '',
        approvedBy: 'Admin HR',
        status: 'processed',
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record increment');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Performance Review
  const handleCreateReview = async (e) => {
    e.preventDefault();
    const selected = people.find((p) => personKey(p) === reviewForm.employeeKey);
    if (!selected) {
      alert('Please select an employee');
      return;
    }
    setSubmitting(true);
    try {
      await opsApi.create('hr/performance', {
        employeeId: selected.id,
        employeeType: selected.employeeType,
        name: selected.name,
        reviewPeriod: reviewForm.reviewPeriod.trim(),
        rating: Number(reviewForm.rating),
        kpis: reviewForm.kpis,
        achievements: reviewForm.achievements.trim(),
        improvementAreas: reviewForm.improvementAreas.trim(),
        feedback: reviewForm.feedback.trim(),
        goals: reviewForm.goals.trim(),
        reviewedBy: reviewForm.reviewedBy.trim(),
        reviewDate: reviewForm.reviewDate,
        status: reviewForm.status,
      });
      setShowReviewModal(false);
      setReviewForm({
        employeeKey: '',
        reviewPeriod: `${new Date().getFullYear()} Annual Review`,
        rating: 4.5,
        kpis: DEFAULT_KPIS,
        achievements: '',
        improvementAreas: '',
        feedback: '',
        goals: '',
        reviewedBy: 'HR Appraiser',
        reviewDate: new Date().toISOString().slice(0, 10),
        status: 'finalized',
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record performance review');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete records
  const handleDeletePromotion = async (id) => {
    if (!window.confirm('Delete this promotion entry?')) return;
    try {
      await opsApi.delete(`hr/promotions/${id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete promotion');
    }
  };

  const handleDeleteIncrement = async (id) => {
    if (!window.confirm('Delete this increment entry?')) return;
    try {
      await opsApi.delete(`hr/increments/${id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete increment');
    }
  };

  const handleDeleteReview = async (id) => {
    if (!window.confirm('Delete this performance review?')) return;
    try {
      await opsApi.delete(`hr/performance/${id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete review');
    }
  };

  // Filtered rows
  const filteredPromotions = useMemo(() => {
    if (!search.trim()) return promotions;
    const q = search.toLowerCase();
    return promotions.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.newDesignation?.toLowerCase().includes(q) ||
        p.newDepartment?.toLowerCase().includes(q)
    );
  }, [promotions, search]);

  const filteredIncrements = useMemo(() => {
    if (!search.trim()) return increments;
    const q = search.toLowerCase();
    return increments.filter(
      (i) =>
        i.name?.toLowerCase().includes(q) ||
        i.cycle?.toLowerCase().includes(q) ||
        i.reason?.toLowerCase().includes(q)
    );
  }, [increments, search]);

  const filteredReviews = useMemo(() => {
    if (!search.trim()) return reviews;
    const q = search.toLowerCase();
    return reviews.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.reviewPeriod?.toLowerCase().includes(q) ||
        r.feedback?.toLowerCase().includes(q)
    );
  }, [reviews, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <HrBackButtons fallback="/hr-management" />
          <p className={PAGE_KICKER}>HR Management</p>
          <h1 className={PAGE_TITLE}>Career & Appraisals</h1>
          <p className={PAGE_SUB}>
            Manage employee promotions, salary revisions, and annual performance appraisals in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className={BTN}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowPromoModal(true)}
            className={`${BTN_PRIMARY} bg-emerald-600 hover:bg-emerald-700`}
          >
            <TrendingUp className="mr-1.5 h-4 w-4" />
            + Log Promotion
          </button>
          <button
            type="button"
            onClick={() => setShowIncrModal(true)}
            className={`${BTN_PRIMARY} bg-sky-600 hover:bg-sky-700`}
          >
            <Wallet className="mr-1.5 h-4 w-4" />
            + Add Increment
          </button>
          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className={`${BTN_PRIMARY} bg-violet-600 hover:bg-violet-700`}
          >
            <Award className="mr-1.5 h-4 w-4" />
            + Record Review
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* KPI / Metric Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${PANEL} p-4`}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Promotions</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{promotionStats.total ?? promotions.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="font-semibold text-emerald-600">{promotionStats.thisYear ?? 0}</span> this year
          </p>
        </div>

        <div className={`${PANEL} p-4`}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Increments Given</span>
            <Wallet className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{incrementStats.total ?? increments.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Avg hike: <span className="font-semibold text-sky-600">+{incrementStats.avgPercentage ?? 0}%</span>
          </p>
        </div>

        <div className={`${PANEL} p-4`}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Appraisals Logged</span>
            <Award className="h-4 w-4 text-violet-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{reviewStats.total ?? reviews.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Avg rating:{' '}
            <span className="font-semibold text-amber-600">
              {reviewStats.avgRating ? `★ ${reviewStats.avgRating}` : '—'}
            </span>
          </p>
        </div>

        <div className={`${PANEL} p-4`}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Top Performers</span>
            <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{reviewStats.highPerformers ?? 0}</p>
          <p className="mt-0.5 text-xs text-slate-500">Rating ≥ 4.0 / 5.0</p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6">
          <button
            type="button"
            onClick={() => setTab('promotions')}
            className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${
              currentTab === 'promotions'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Promotions ({promotions.length})
          </button>

          <button
            type="button"
            onClick={() => setTab('increments')}
            className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${
              currentTab === 'increments'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="h-4 w-4" />
            Salary Increments ({increments.length})
          </button>

          <button
            type="button"
            onClick={() => setTab('performance')}
            className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${
              currentTab === 'performance'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="h-4 w-4" />
            Performance Reviews ({reviews.length})
          </button>
        </div>
      </div>

      {/* Search & filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[260px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            className={`${INPUT} pl-9`}
            placeholder={`Search ${currentTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tab 1: Promotions */}
      {currentTab === 'promotions' && (
        <div className={PANEL}>
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Promotion History & Career Progression</h2>
            <button
              type="button"
              onClick={() => setShowPromoModal(true)}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              + Log Promotion
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F8F9FA]">
                <tr>
                  <th className={TH}>Employee</th>
                  <th className={TH}>Role / Transition</th>
                  <th className={TH}>New Designation</th>
                  <th className={TH}>Department</th>
                  <th className={TH}>Effective Date</th>
                  <th className={TH}>Approved By</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPromotions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                      No promotions logged yet. Click "+ Log Promotion" to record title upgrades and role changes.
                    </td>
                  </tr>
                ) : (
                  filteredPromotions.map((row) => (
                    <tr key={row._id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500 capitalize">{pretty(row.employeeType)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {row.previousDesignation ? (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <span className="line-through text-slate-400">{row.previousDesignation}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-semibold text-emerald-700">{row.newDesignation}</span>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-800">{row.newDesignation}</span>
                        )}
                        {row.reason ? <p className="text-[11px] text-slate-500 mt-0.5">{row.reason}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          {row.newDesignation}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.newDepartment || row.previousDepartment || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.effectiveDate || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.approvedBy || 'Admin HR'}</td>
                      <td className="px-4 py-3 text-xs">
                        <Pill tone={row.status === 'effective' || row.status === 'approved' ? 'green' : 'amber'}>
                          {row.status}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <button
                          type="button"
                          onClick={() => handleDeletePromotion(row._id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Delete promotion record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Salary Increments */}
      {currentTab === 'increments' && (
        <div className={PANEL}>
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Salary Revisions & Appraisal Cycles</h2>
            <button
              type="button"
              onClick={() => setShowIncrModal(true)}
              className="text-xs font-semibold text-sky-700 hover:underline"
            >
              + Add Increment
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F8F9FA]">
                <tr>
                  <th className={TH}>Employee</th>
                  <th className={TH}>Appraisal Cycle</th>
                  <th className={TH}>Previous Salary</th>
                  <th className={TH}>New Monthly Salary</th>
                  <th className={TH}>Increment Amount / Hike</th>
                  <th className={TH}>Effective Date</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIncrements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                      No salary increments recorded yet. Click "+ Add Increment" to log salary hikes and pay revisions.
                    </td>
                  </tr>
                ) : (
                  filteredIncrements.map((row) => (
                    <tr key={row._id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500 capitalize">{pretty(row.employeeType)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-medium text-slate-800">{row.cycle || 'Annual Appraisal'}</span>
                        {row.reason ? <p className="text-[11px] text-slate-500 mt-0.5">{row.reason}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{inr(row.previousSalary)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-900">{inr(row.newSalary)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          +{inr(row.incrementAmount)} ({row.incrementPercentage > 0 ? `+${row.incrementPercentage}%` : '0%'})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.effectiveDate || '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        <Pill tone={row.status === 'processed' || row.status === 'approved' ? 'green' : 'amber'}>
                          {row.status}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <button
                          type="button"
                          onClick={() => handleDeleteIncrement(row._id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Delete increment record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Performance Reviews */}
      {currentTab === 'performance' && (
        <div className={PANEL}>
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Periodic Performance Reviews & Scorecards</h2>
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="text-xs font-semibold text-violet-700 hover:underline"
            >
              + Record Review
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredReviews.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                No performance reviews recorded yet. Click "+ Record Review" to log KPI ratings, feedback, and appraisal notes.
              </div>
            ) : (
              filteredReviews.map((row) => (
                <div key={row._id} className="p-4 sm:p-5 hover:bg-slate-50/60 transition">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">{row.name}</h3>
                        <span className="rounded-full bg-violet-100 text-violet-800 text-[11px] font-semibold px-2.5 py-0.5">
                          {row.reviewPeriod}
                        </span>
                        <Pill tone={row.status === 'finalized' ? 'green' : 'blue'}>{row.status}</Pill>
                      </div>
                      <p className="text-xs text-slate-500">
                        Reviewed by <span className="font-medium text-slate-700">{row.reviewedBy || 'HR'}</span> on{' '}
                        {row.reviewDate || '—'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Rating Stars & Badge */}
                      <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5">
                        <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                        <span className="text-lg font-bold text-amber-900">{Number(row.rating).toFixed(1)}</span>
                        <span className="text-xs text-amber-700">/ 5.0</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(row._id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Delete review"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* KPI breakdown tags */}
                  {row.kpis?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.kpis.map((kpi, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                        >
                          <span className="text-slate-600">{kpi.metric}:</span>
                          <span className="font-bold text-slate-900">{kpi.score}/{kpi.maxScore || 5}★</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Achievements & Feedback grid */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                    {row.achievements ? (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
                        <p className="font-semibold text-emerald-800">Key Achievements</p>
                        <p className="mt-1 text-slate-700 leading-relaxed">{row.achievements}</p>
                      </div>
                    ) : null}

                    {row.improvementAreas ? (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5">
                        <p className="font-semibold text-amber-800">Areas for Improvement / Goals</p>
                        <p className="mt-1 text-slate-700 leading-relaxed">{row.improvementAreas}</p>
                      </div>
                    ) : null}
                  </div>

                  {row.feedback ? (
                    <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <span className="font-semibold text-slate-700">Feedback: </span>
                      {row.feedback}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Log Promotion */}
      {/* ========================================================================= */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900">Log Employee Promotion</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPromoModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePromotion} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Employee *
                </label>
                <select
                  required
                  className={INPUT}
                  value={promoForm.employeeKey}
                  onChange={(e) => handleSelectPromoEmployee(e.target.value)}
                >
                  <option value="">-- Choose employee --</option>
                  {people.map((p) => (
                    <option key={personKey(p)} value={personKey(p)}>
                      {p.name} ({pretty(p.role || p.roleKey)} · {p.department || 'Operations'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Previous Designation
                  </label>
                  <input
                    type="text"
                    className={`${INPUT} bg-slate-50`}
                    readOnly
                    value={promoForm.previousDesignation}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Designation *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Operations Lead"
                    className={INPUT}
                    value={promoForm.newDesignation}
                    onChange={(e) => setPromoForm((f) => ({ ...f, newDesignation: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Quality Assurance"
                    className={INPUT}
                    value={promoForm.newDepartment}
                    onChange={(e) => setPromoForm((f) => ({ ...f, newDepartment: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    required
                    className={INPUT}
                    value={promoForm.effectiveDate}
                    onChange={(e) => setPromoForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Promotion Justification
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Excellent leadership in hub operations and consistent target achievement"
                  className={INPUT}
                  value={promoForm.reason}
                  onChange={(e) => setPromoForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approved By
                  </label>
                  <input
                    type="text"
                    className={INPUT}
                    value={promoForm.approvedBy}
                    onChange={(e) => setPromoForm((f) => ({ ...f, approvedBy: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    className={INPUT}
                    value={promoForm.status}
                    onChange={(e) => setPromoForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {PROMOTION_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPromoModal(false)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`${BTN_PRIMARY} bg-emerald-600 hover:bg-emerald-700`}
                >
                  {submitting ? 'Saving…' : 'Record Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Add Increment */}
      {/* ========================================================================= */}
      {showIncrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-sky-700">
                <Wallet className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900">Record Salary Increment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIncrModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncrement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Employee *
                </label>
                <select
                  required
                  className={INPUT}
                  value={incrForm.employeeKey}
                  onChange={(e) => handleSelectIncrEmployee(e.target.value)}
                >
                  <option value="">-- Choose employee --</option>
                  {people.map((p) => (
                    <option key={personKey(p)} value={personKey(p)}>
                      {p.name} (Current: {inr(p.monthlySalary || 0)}/mo · {pretty(p.role || p.roleKey)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Previous Monthly Salary
                  </label>
                  <input
                    type="text"
                    className={`${INPUT} bg-slate-50 font-medium`}
                    readOnly
                    value={inr(incrForm.previousSalary)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hike Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className={INPUT}
                    value={incrForm.hikePercentage}
                    onChange={(e) => handleIncrPctChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Monthly Salary (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    className={`${INPUT} font-bold text-emerald-800`}
                    value={incrForm.newSalary}
                    onChange={(e) => handleIncrSalaryChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    required
                    className={INPUT}
                    value={incrForm.effectiveDate}
                    onChange={(e) => setIncrForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs flex items-center justify-between">
                <span className="text-sky-900 font-medium">Monthly Hike Delta:</span>
                <span className="font-bold text-sky-800">
                  +{inr(Math.max(0, incrForm.newSalary - incrForm.previousSalary))} / month
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Appraisal Cycle
                  </label>
                  <select
                    className={INPUT}
                    value={incrForm.cycle}
                    onChange={(e) => setIncrForm((f) => ({ ...f, cycle: e.target.value }))}
                  >
                    {APPRAISAL_CYCLES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approved By
                  </label>
                  <input
                    type="text"
                    className={INPUT}
                    value={incrForm.approvedBy}
                    onChange={(e) => setIncrForm((f) => ({ ...f, approvedBy: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Annual merit hike based on top tier rating in Q4"
                  className={INPUT}
                  value={incrForm.reason}
                  onChange={(e) => setIncrForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowIncrModal(false)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`${BTN_PRIMARY} bg-sky-600 hover:bg-sky-700`}
                >
                  {submitting ? 'Saving…' : 'Record Increment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Record Performance Review */}
      {/* ========================================================================= */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-violet-700">
                <Award className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900">Record Performance Review</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee *
                  </label>
                  <select
                    required
                    className={INPUT}
                    value={reviewForm.employeeKey}
                    onChange={(e) => setReviewForm((f) => ({ ...f, employeeKey: e.target.value }))}
                  >
                    <option value="">-- Choose employee --</option>
                    {people.map((p) => (
                      <option key={personKey(p)} value={personKey(p)}>
                        {p.name} ({pretty(p.role || p.roleKey)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Review Period *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annual 2026 / Q1 2026"
                    className={INPUT}
                    value={reviewForm.reviewPeriod}
                    onChange={(e) => setReviewForm((f) => ({ ...f, reviewPeriod: e.target.value }))}
                  />
                </div>
              </div>

              {/* Overall Rating */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-900">Overall Rating (1.0 to 5.0)</label>
                  <span className="text-base font-bold text-amber-900">★ {reviewForm.rating} / 5.0</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  className="w-full mt-2 accent-amber-500 cursor-pointer"
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm((f) => ({ ...f, rating: Number(e.target.value) }))}
                />
              </div>

              {/* KPI Breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">KPI Breakdown (Score 1 to 5):</p>
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  {reviewForm.kpis.map((kpi, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-700 font-medium flex-1">{kpi.metric}</span>
                      <select
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold"
                        value={kpi.score}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setReviewForm((f) => {
                            const updated = [...f.kpis];
                            updated[idx] = { ...updated[idx], score: val };
                            return { ...f, kpis: updated };
                          });
                        }}
                      >
                        {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1].map((s) => (
                          <option key={s} value={s}>
                            {s} ★
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Key Achievements & Highlights
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Exceeded delivery speed SLA by 12% across dark store zones"
                  className={INPUT}
                  value={reviewForm.achievements}
                  onChange={(e) => setReviewForm((f) => ({ ...f, achievements: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Areas of Improvement & Development Goals
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Focus on inventory audit accuracy and team mentorship"
                  className={INPUT}
                  value={reviewForm.improvementAreas}
                  onChange={(e) => setReviewForm((f) => ({ ...f, improvementAreas: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reviewed By
                  </label>
                  <input
                    type="text"
                    className={INPUT}
                    value={reviewForm.reviewedBy}
                    onChange={(e) => setReviewForm((f) => ({ ...f, reviewedBy: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Review Date
                  </label>
                  <input
                    type="date"
                    required
                    className={INPUT}
                    value={reviewForm.reviewDate}
                    onChange={(e) => setReviewForm((f) => ({ ...f, reviewDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`${BTN_PRIMARY} bg-violet-600 hover:bg-violet-700`}
                >
                  {submitting ? 'Saving…' : 'Record Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
