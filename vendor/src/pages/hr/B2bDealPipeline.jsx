import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Building2,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Layers,
  LayoutGrid,
  List,
  AlertCircle,
  HelpCircle,
  Flame,
  Check,
  History,
  MoveRight,
  ArrowUp,
  ArrowDown,
  User,
} from 'lucide-react';
import apiClient from '../../api/client';
import { BTN, BTN_PRIMARY, INPUT, PANEL, TH } from '../../utils/ui';
import { inr } from './hrShared';

const STAGE_COLORS = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', ring: 'ring-blue-400' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-400' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', ring: 'ring-purple-400' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', ring: 'ring-indigo-400' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', ring: 'ring-amber-400' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500', ring: 'ring-teal-400' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500', ring: 'ring-cyan-400' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', ring: 'ring-rose-400' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500', ring: 'ring-slate-400' },
};

function getStageColorStyles(colorKey) {
  return STAGE_COLORS[colorKey] || STAGE_COLORS.emerald;
}

const PRIORITY_BADGES = {
  urgent: { label: 'Urgent', bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: Flame },
  high: { label: 'High', bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertCircle },
  medium: { label: 'Medium', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: null },
  low: { label: 'Low', bg: 'bg-slate-100 text-slate-600 border-slate-200', icon: null },
};

const emptyDealForm = {
  title: '',
  clientId: '',
  dealValue: 0,
  stageKey: 'qualification',
  probability: 50,
  expectedCloseDate: '',
  priority: 'medium',
  assignedTo: '',
  notes: '',
};

const emptyStageForm = {
  name: '',
  color: 'emerald',
  probability: 50,
  description: '',
  isWon: false,
  isLost: false,
};

export default function B2bDealPipeline({ clients = [], initialClientFilter = 'all', onQuickViewClient }) {
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'

  // Filters & Search
  const [query, setQuery] = useState('');
  const [clientFilter, setClientFilter] = useState(initialClientFilter || 'all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (initialClientFilter) {
      setClientFilter(initialClientFilter);
    }
  }, [initialClientFilter]);

  // Modals
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState(null);
  const [dealForm, setDealForm] = useState(emptyDealForm);
  const [submittingDeal, setSubmittingDeal] = useState(false);

  // Stage Customization Modal
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState(null);
  const [stageForm, setStageForm] = useState(emptyStageForm);
  const [submittingStage, setSubmittingStage] = useState(false);

  // Deal History Modal
  const [activeHistoryDeal, setActiveHistoryDeal] = useState(null);

  // Load Stages & Deals
  const loadPipelineData = async () => {
    setLoading(true);
    try {
      const [stagesRes, dealsRes] = await Promise.all([
        apiClient.get('/admin-ops/hr/b2b-deal-stages'),
        apiClient.get('/admin-ops/hr/b2b-deals', {
          params: {
            clientId: clientFilter,
            priority: priorityFilter,
            status: statusFilter,
            search: query,
          },
        }),
      ]);

      if (stagesRes.data?.success) {
        setStages(stagesRes.data.data || []);
      }
      if (dealsRes.data?.success) {
        setDeals(dealsRes.data.data || []);
        setMetrics(dealsRes.data.metrics || null);
      }
    } catch (err) {
      console.error('Failed to load deal pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelineData();
  }, [clientFilter, priorityFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadPipelineData();
  };

  // Group deals by stage
  const dealsByStageMap = useMemo(() => {
    const map = {};
    stages.forEach((st) => {
      map[st.key] = [];
    });
    deals.forEach((deal) => {
      const k = deal.stageKey || 'qualification';
      if (!map[k]) map[k] = [];
      map[k].push(deal);
    });
    return map;
  }, [stages, deals]);

  // Deal Creation & Edit Handlers
  const openCreateDealModal = (preselectedClientId = '', preselectedStageKey = '') => {
    setEditingDealId(null);
    const defaultStage = stages.find((s) => s.key === preselectedStageKey) || stages[0];
    setDealForm({
      ...emptyDealForm,
      clientId: preselectedClientId || (clients[0]?._id || ''),
      stageKey: defaultStage?.key || 'qualification',
      probability: defaultStage?.probability ?? 50,
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    setIsDealModalOpen(true);
  };

  const openEditDealModal = (deal) => {
    setEditingDealId(deal._id);
    setDealForm({
      title: deal.title || '',
      clientId: deal.clientId || '',
      dealValue: deal.dealValue || 0,
      stageKey: deal.stageKey || 'qualification',
      probability: deal.probability ?? 50,
      expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : '',
      priority: deal.priority || 'medium',
      assignedTo: deal.assignedTo || '',
      notes: deal.notes || '',
    });
    setIsDealModalOpen(true);
  };

  const handleSaveDeal = async (e) => {
    e.preventDefault();
    if (!dealForm.title.trim()) {
      alert('Deal title is required');
      return;
    }
    if (!dealForm.clientId) {
      alert('Please select a B2B client company');
      return;
    }

    setSubmittingDeal(true);
    try {
      const selectedStage = stages.find((s) => s.key === dealForm.stageKey);
      const payload = {
        ...dealForm,
        stageId: selectedStage?._id || null,
        stageName: selectedStage?.name || '',
      };

      if (editingDealId) {
        await apiClient.put(`/admin-ops/hr/b2b-deals/${editingDealId}`, payload);
      } else {
        await apiClient.post('/admin-ops/hr/b2b-deals', payload);
      }
      setIsDealModalOpen(false);
      await loadPipelineData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save deal');
    } finally {
      setSubmittingDeal(false);
    }
  };

  const handleMoveDealStage = async (dealId, targetStageKey) => {
    try {
      await apiClient.patch(`/admin-ops/hr/b2b-deals/${dealId}/stage`, {
        stageKey: targetStageKey,
      });
      await loadPipelineData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to move deal stage');
    }
  };

  const handleDeleteDeal = async (dealId, dealTitle) => {
    if (!window.confirm(`Are you sure you want to delete deal "${dealTitle}"?`)) return;
    try {
      await apiClient.delete(`/admin-ops/hr/b2b-deals/${dealId}`);
      await loadPipelineData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete deal');
    }
  };

  // Stage Customization Handlers
  const openAddStage = () => {
    setEditingStageId(null);
    setStageForm({
      ...emptyStageForm,
      probability: 50,
    });
  };

  const openEditStage = (stage) => {
    setEditingStageId(stage._id);
    setStageForm({
      name: stage.name || '',
      color: stage.color || 'emerald',
      probability: stage.probability ?? 50,
      description: stage.description || '',
      isWon: Boolean(stage.isWon),
      isLost: Boolean(stage.isLost),
    });
  };

  const handleSaveStage = async (e) => {
    e.preventDefault();
    if (!stageForm.name.trim()) {
      alert('Stage name is required');
      return;
    }
    setSubmittingStage(true);
    try {
      if (editingStageId) {
        await apiClient.put(`/admin-ops/hr/b2b-deal-stages/${editingStageId}`, stageForm);
      } else {
        await apiClient.post('/admin-ops/hr/b2b-deal-stages', stageForm);
      }
      setEditingStageId(null);
      setStageForm(emptyStageForm);
      await loadPipelineData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save deal stage');
    } finally {
      setSubmittingStage(false);
    }
  };

  const handleDeleteStage = async (stageId, stageName) => {
    if (!window.confirm(`Are you sure you want to delete stage "${stageName}"?`)) return;
    try {
      await apiClient.delete(`/admin-ops/hr/b2b-deal-stages/${stageId}`);
      await loadPipelineData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete deal stage');
    }
  };

  const handleMoveStageOrder = async (stageIndex, direction) => {
    const targetIndex = direction === 'up' ? stageIndex - 1 : stageIndex + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const reordered = [...stages];
    const temp = reordered[stageIndex];
    reordered[stageIndex] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const payload = reordered.map((st, idx) => ({
      id: st._id,
      order: idx + 1,
    }));

    try {
      await apiClient.post('/admin-ops/hr/b2b-deal-stages/reorder', { stageOrders: payload });
      await loadPipelineData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to reorder stages');
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${PANEL} p-5 relative overflow-hidden border-slate-200`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Pipeline Value</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{inr(metrics?.totalPipelineValue || 0)}</h3>
              <p className="mt-1 text-xs text-emerald-600 font-medium">
                {metrics?.openDealsCount || 0} active negotiated indents
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 border border-emerald-100">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <span>Projected potential contract volume</span>
          </div>
        </div>

        <div className={`${PANEL} p-5 relative overflow-hidden border-slate-200`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deals In Progress</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{metrics?.openDealsCount || 0}</h3>
              <p className="mt-1 text-xs text-blue-600 font-medium">Across {stages.length} customizable stages</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600 border border-blue-100">
              <Layers className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <Clock className="h-3.5 w-3.5 text-blue-500" />
            <span>Tracked from initial lead to active indents</span>
          </div>
        </div>

        <div className={`${PANEL} p-5 relative overflow-hidden border-slate-200`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Won & Closed Value</p>
              <h3 className="mt-1 text-2xl font-bold text-emerald-700">{inr(metrics?.wonDealsValue || 0)}</h3>
              <p className="mt-1 text-xs text-slate-500 font-medium">{metrics?.wonDealsCount || 0} accounts won</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span className="font-semibold text-slate-800">{metrics?.lostDealsCount || 0}</span> lost / dropped deals
          </div>
        </div>

        <div className={`${PANEL} p-5 relative overflow-hidden border-slate-200`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Win Conversion Rate</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{metrics?.winRate ?? 0}%</h3>
              <p className="mt-1 text-xs text-slate-500 font-medium">Historical win probability</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 text-purple-600 border border-purple-100">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-purple-600 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, metrics?.winRate || 0))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className={`${PANEL} p-4 border-slate-200`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search deals, company name, assigned rep, notes..."
              className={`${INPUT} pl-9 text-sm`}
            />
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>Filters:</span>
            </div>

            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.companyName}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">All Statuses</option>
              <option value="open">Active / Open</option>
              <option value="won">Closed Won</option>
              <option value="lost">Closed Lost</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  viewMode === 'kanban'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Kanban Pipeline Board"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Data Table View"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsStageModalOpen(true)}
              className={`${BTN} gap-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700 border-slate-200 hover:border-emerald-300`}
              title="Customize Deal Stages"
            >
              <Sliders className="h-3.5 w-3.5 text-emerald-600" />
              Customize Stages
            </button>

            <button
              type="button"
              onClick={() => openCreateDealModal()}
              className={`${BTN_PRIMARY} gap-1.5 text-xs shadow-xs`}
            >
              <Plus className="h-3.5 w-3.5" />
              New Deal
            </button>
          </div>
        </div>
      </div>

      {/* Main Pipeline Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm font-medium">Loading deal pipeline & customized stages...</p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN PIPELINE BOARD VIEW */
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1200px] items-start">
            {stages.map((stage) => {
              const stageDeals = dealsByStageMap[stage.key] || [];
              const stageTotalVal = stageDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0);
              const colorStyle = getStageColorStyles(stage.color);

              return (
                <div
                  key={stage._id || stage.key}
                  className="flex flex-col w-80 shrink-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-2xs"
                >
                  {/* Column Header */}
                  <div className="pb-3 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${colorStyle.dot}`} />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 truncate" title={stage.name}>
                          {stage.name}
                        </h4>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200 shadow-2xs">
                        {stageDeals.length}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{inr(stageTotalVal)}</span>
                      <span className="font-medium text-slate-500">{stage.probability}% win probability</span>
                    </div>
                  </div>

                  {/* Deals Stack */}
                  <div className="mt-3 space-y-3 min-h-[140px] flex-1">
                    {stageDeals.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-slate-200 text-center p-3">
                        <p className="text-xs text-slate-400 font-medium">No deals in this stage</p>
                        <button
                          type="button"
                          onClick={() => openCreateDealModal('', stage.key)}
                          className="mt-2 text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add deal here
                        </button>
                      </div>
                    ) : (
                      stageDeals.map((deal) => {
                        const prio = PRIORITY_BADGES[deal.priority] || PRIORITY_BADGES.medium;
                        const PrioIcon = prio.icon;

                        return (
                          <div
                            key={deal._id}
                            className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:shadow-sm hover:border-slate-300 transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase border ${prio.bg}`}
                              >
                                {PrioIcon && <PrioIcon className="h-2.5 w-2.5" />}
                                {prio.label}
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setActiveHistoryDeal(deal)}
                                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  title="View Stage History"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditDealModal(deal)}
                                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  title="Edit Deal"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDeal(deal._id, deal.title)}
                                  className="rounded-md p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                                  title="Delete Deal"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            <h5 className="mt-2 text-sm font-bold text-slate-900 leading-snug">{deal.title}</h5>

                            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="truncate font-medium">{deal.clientName}</span>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                              <span className="text-sm font-extrabold text-slate-900">{inr(deal.dealValue)}</span>
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                {deal.probability ?? stage.probability}% prob
                              </span>
                            </div>

                            {deal.expectedCloseDate && (
                              <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                <span>Target: {new Date(deal.expectedCloseDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                            )}

                            {deal.assignedTo && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                                <User className="h-3 w-3 text-slate-400" />
                                <span>Lead: {deal.assignedTo}</span>
                              </div>
                            )}

                            {/* Quick Move Stage Dropdown */}
                            <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between gap-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Move to:</span>
                              <select
                                value={deal.stageKey}
                                onChange={(e) => handleMoveDealStage(deal._id, e.target.value)}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none hover:bg-slate-100 focus:border-emerald-600"
                              >
                                {stages.map((s) => (
                                  <option key={s.key} value={s.key}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Deal Button at bottom of column */}
                  <button
                    type="button"
                    onClick={() => openCreateDealModal('', stage.key)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-500 hover:bg-white hover:text-emerald-700 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Deal
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* DATA TABLE VIEW */
        <div className={`${PANEL} overflow-hidden border-slate-200`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={TH}>Deal Title</th>
                  <th className={TH}>Client Company</th>
                  <th className={TH}>Current Stage</th>
                  <th className={TH}>Deal Value</th>
                  <th className={TH}>Probability</th>
                  <th className={TH}>Priority</th>
                  <th className={TH}>Target Close</th>
                  <th className={TH}>Assigned Rep</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No deals match the selected criteria. Click "New Deal" to create one.
                    </td>
                  </tr>
                ) : (
                  deals.map((deal) => {
                    const stage = stages.find((s) => s.key === deal.stageKey);
                    const colorStyle = getStageColorStyles(stage?.color || 'emerald');
                    const prio = PRIORITY_BADGES[deal.priority] || PRIORITY_BADGES.medium;

                    return (
                      <tr key={deal._id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-bold text-slate-900">{deal.title}</td>
                        <td className="p-3.5 text-slate-700 font-medium">{deal.clientName}</td>
                        <td className="p-3.5">
                          <select
                            value={deal.stageKey}
                            onChange={(e) => handleMoveDealStage(deal._id, e.target.value)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}
                          >
                            {stages.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">{inr(deal.dealValue)}</td>
                        <td className="p-3.5 font-medium text-slate-600">{deal.probability}%</td>
                        <td className="p-3.5">
                          <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold border ${prio.bg}`}>
                            {prio.label}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {deal.expectedCloseDate
                            ? new Date(deal.expectedCloseDate).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="p-3.5 text-slate-600">{deal.assignedTo || '—'}</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setActiveHistoryDeal(deal)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Stage History"
                            >
                              <History className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditDealModal(deal)}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              title="Edit Deal"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDeal(deal._id, deal.title)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Delete Deal"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT DEAL */}
      {isDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingDealId ? 'Edit B2B Deal' : 'New B2B Indent / Deal'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDealModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDeal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Deal / Contract Title *</label>
                <input
                  type="text"
                  required
                  value={dealForm.title}
                  onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
                  placeholder="e.g. Q4 Fresh Produce Master Supply"
                  className={`${INPUT} mt-1`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Client Company *</label>
                <select
                  required
                  value={dealForm.clientId}
                  onChange={(e) => setDealForm({ ...dealForm, clientId: e.target.value })}
                  className={`${INPUT} mt-1`}
                >
                  <option value="">-- Select Client Profile --</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.companyName} ({c.companyCode || 'B2B'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Estimated Deal Value (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={dealForm.dealValue}
                    onChange={(e) => setDealForm({ ...dealForm, dealValue: Number(e.target.value) })}
                    className={`${INPUT} mt-1`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Pipeline Stage</label>
                  <select
                    value={dealForm.stageKey}
                    onChange={(e) => {
                      const st = stages.find((s) => s.key === e.target.value);
                      setDealForm({
                        ...dealForm,
                        stageKey: e.target.value,
                        probability: st?.probability ?? dealForm.probability,
                      });
                    }}
                    className={`${INPUT} mt-1`}
                  >
                    {stages.map((st) => (
                      <option key={st.key} value={st.key}>
                        {st.name} ({st.probability}% prob)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={dealForm.probability}
                    onChange={(e) => setDealForm({ ...dealForm, probability: Number(e.target.value) })}
                    className={`${INPUT} mt-1`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Priority</label>
                  <select
                    value={dealForm.priority}
                    onChange={(e) => setDealForm({ ...dealForm, priority: e.target.value })}
                    className={`${INPUT} mt-1`}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Target Close Date</label>
                  <input
                    type="date"
                    value={dealForm.expectedCloseDate}
                    onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })}
                    className={`${INPUT} mt-1`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Assigned Deal Representative</label>
                <input
                  type="text"
                  value={dealForm.assignedTo}
                  onChange={(e) => setDealForm({ ...dealForm, assignedTo: e.target.value })}
                  placeholder="e.g. Sales Director / Key Account Manager"
                  className={`${INPUT} mt-1`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Deal Notes & Specifications</label>
                <textarea
                  rows={3}
                  value={dealForm.notes}
                  onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })}
                  placeholder="Indent details, delivery window constraints, product grade requirements..."
                  className={`${INPUT} mt-1`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDealModalOpen(false)}
                  className={BTN}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDeal}
                  className={`${BTN_PRIMARY} gap-1`}
                >
                  {submittingDeal ? 'Saving...' : editingDealId ? 'Update Deal' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CUSTOMIZE DEAL STAGES */}
      {isStageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Customizable Deal Stages</h3>
                  <p className="text-xs text-slate-500">
                    Define and reorder pipeline stages to match your exact B2B qualification and contract closing process
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStageModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Existing Stages List with Reordering */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                  Current Pipeline Stages ({stages.length})
                </h4>
                <div className="mt-3 space-y-2">
                  {stages.map((stage, idx) => {
                    const colorStyle = getStageColorStyles(stage.color);
                    return (
                      <div
                        key={stage._id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-slate-300 transition"
                      >
                        <div className="flex items-center gap-3">
                          {/* Reorder Buttons */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveStageOrder(idx, 'up')}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                              title="Move stage earlier in pipeline"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === stages.length - 1}
                              onClick={() => handleMoveStageOrder(idx, 'down')}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                              title="Move stage later in pipeline"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>

                          <span className="font-mono text-xs font-bold text-slate-400 w-5">#{idx + 1}</span>

                          <span className={`h-3 w-3 rounded-full ${colorStyle.dot}`} />

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">{stage.name}</span>
                              {stage.isWon && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Won Stage
                                </span>
                              )}
                              {stage.isLost && (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                  Lost Stage
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {stage.probability}% win probability {stage.description ? `· ${stage.description}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditStage(stage)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Edit Stage Details"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStage(stage._id, stage.name)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete Custom Stage"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add / Edit Stage Form */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Plus className="h-4 w-4" />
                  {editingStageId ? 'Edit Stage' : 'Add New Custom Stage'}
                </h4>

                <form onSubmit={handleSaveStage} className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">Stage Name *</label>
                      <input
                        type="text"
                        required
                        value={stageForm.name}
                        onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                        placeholder="e.g. Executive Chef Audit"
                        className={`${INPUT} mt-1 text-xs`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">Stage Color Tag</label>
                      <select
                        value={stageForm.color}
                        onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })}
                        className={`${INPUT} mt-1 text-xs`}
                      >
                        <option value="emerald">Emerald Green</option>
                        <option value="blue">Blue</option>
                        <option value="purple">Purple</option>
                        <option value="indigo">Indigo</option>
                        <option value="amber">Amber / Orange</option>
                        <option value="teal">Teal</option>
                        <option value="cyan">Cyan</option>
                        <option value="rose">Rose Red</option>
                        <option value="slate">Slate Gray</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">Win Probability (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={stageForm.probability}
                        onChange={(e) => setStageForm({ ...stageForm, probability: Number(e.target.value) })}
                        className={`${INPUT} mt-1 text-xs`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">Stage Type Flag</label>
                      <div className="mt-2 flex items-center gap-4 text-xs">
                        <label className="inline-flex items-center gap-1.5 text-slate-700">
                          <input
                            type="checkbox"
                            checked={stageForm.isWon}
                            onChange={(e) => setStageForm({ ...stageForm, isWon: e.target.checked, isLost: false })}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Closed Won
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-slate-700">
                          <input
                            type="checkbox"
                            checked={stageForm.isLost}
                            onChange={(e) => setStageForm({ ...stageForm, isLost: e.target.checked, isWon: false })}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          Closed Lost
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700">Stage Description / Milestone</label>
                    <input
                      type="text"
                      value={stageForm.description}
                      onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })}
                      placeholder="e.g. Client verifies organic certificates and signs daily delivery docket SLA"
                      className={`${INPUT} mt-1 text-xs`}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    {editingStageId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStageId(null);
                          setStageForm(emptyStageForm);
                        }}
                        className={BTN}
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={submittingStage}
                      className={`${BTN_PRIMARY} text-xs py-1.5 px-3`}
                    >
                      {submittingStage ? 'Saving...' : editingStageId ? 'Update Stage' : 'Save Stage to Pipeline'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsStageModalOpen(false)}
                className={`${BTN} text-xs`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: STAGE HISTORY / TIMELINE */}
      {activeHistoryDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Stage History</h3>
                  <p className="text-xs text-slate-500 truncate">{activeHistoryDeal.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveHistoryDeal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 max-h-96 overflow-y-auto">
              {!activeHistoryDeal.stageHistory || activeHistoryDeal.stageHistory.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-6">No historical stage transitions recorded.</p>
              ) : (
                <div className="relative border-l-2 border-emerald-200 ml-3 space-y-4 py-2">
                  {activeHistoryDeal.stageHistory.map((item, idx) => (
                    <div key={idx} className="relative pl-6">
                      <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-600 shadow-2xs" />
                      <p className="text-xs font-bold text-slate-900">{item.stageName}</p>
                      <p className="text-[11px] text-slate-500">
                        {item.movedAt
                          ? new Date(item.movedAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-5 py-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveHistoryDeal(null)}
                className={`${BTN} text-xs`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
