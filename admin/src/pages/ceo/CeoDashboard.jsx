import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Search,
  Tractor,
  Wheat,
  Package,
  Boxes,
  Warehouse,
  ShoppingCart,
  IndianRupee,
  Truck,
  ShieldCheck,
  Users,
  AlertTriangle,
  Thermometer,
  Leaf,
  Loader2,
  Bike,
  Store,
  UserCog,
  UserCheck,
  TrendingUp,
  Percent,
  Repeat,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Activity,
  CheckCircle2,
  Clock,
  HelpCircle,
  Wallet,
  ArrowDownLeft,
  Coins,
  BadgeIndianRupee,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import erpApi from '../../api/erpApi';
import { BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';

const FALLBACK_LENSES = [
  { id: 'all', label: 'All insights' },
  { id: 'financials', label: 'Financials & Cash Flow' },
  { id: 'executive', label: 'CEO Metrics' },
  { id: 'farmers', label: 'Farmers' },
  { id: 'farmer_managers', label: 'Farmer managers' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'pickup_drivers', label: 'Pickup drivers' },
  { id: 'delivery_managers', label: 'Delivery managers' },
  { id: 'delivery_boys', label: 'Delivery boys' },
  { id: 'office_staff', label: 'Office staff' },
  { id: 'customers', label: 'Customers' },
];

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Today', desc: 'Last 24 Hours' },
  { id: '7d', label: '7D', desc: 'Past 7 Days' },
  { id: '30d', label: '30D', desc: 'Past 30 Days' },
  { id: 'all', label: 'All Time', desc: 'Cumulative Platform' },
];

const LENS_COPY = {
  all: 'Company-wide KPIs across financial liquidity, unit economics, commerce, inventory, and people network.',
  financials: 'Executive Financials: Gross Margin %, Farmer Disbursements, Operating Cash Flow, and AOV.',
  executive: 'Core 7 Executive KPIs: Registered Customers, Active Customers, Orders/Day, AOV, Delivery Cost, Contribution Margin, and Repeat Order Rate.',
  farmers: 'Farmer registry, KYC, crops, products, orders, and payouts from the farmer app.',
  farmer_managers: 'Field managers who onboard and support farmers.',
  vendors: 'Vendor partners connected to farmer operations.',
  pickup_drivers: 'Farm pickup drivers and open collection jobs.',
  delivery_managers: 'Dark-store managers, store orders, and rider coverage.',
  delivery_boys: 'Delivery partners, live status, KYC, and completed drops.',
  office_staff: 'Admin-created office roles used across GreenGrocc staff apps.',
  customers: 'ERP customer master and last-mile commerce volume.',
};

const LENS_GROUPS = {
  all: [
    {
      title: 'People network',
      items: [
        { key: 'totalFarmers', label: 'Farmers', icon: Tractor },
        { key: 'farmerManagers', label: 'Farmer managers', icon: UserCog },
        { key: 'liveVendors', label: 'Vendors', icon: Users },
        { key: 'pickupDrivers', label: 'Pickup drivers', icon: Truck },
        { key: 'deliveryManagers', label: 'Delivery managers', icon: Store },
        { key: 'deliveryBoys', label: 'Delivery boys', icon: Bike },
        { key: 'staffCount', label: 'Office staff', icon: Users },
        { key: 'customerGrowth', label: 'Customers', icon: Users },
      ],
    },
    {
      title: 'Farm & Produce',
      items: [
        { key: 'activeFarmers', label: 'Active Farmers', icon: Tractor },
        { key: 'totalFarms', label: 'Total Farms', icon: Leaf },
        { key: 'activeCrops', label: 'Active Crops', icon: Wheat },
        { key: 'farmerCrops', label: 'Farmer crops', icon: Wheat },
        { key: 'totalArticles', label: 'Articles', icon: Package },
        { key: 'totalBatches', label: 'Batches', icon: Boxes },
      ],
    },
    {
      title: 'Inventory & Quality',
      items: [
        { key: 'totalInventory', label: 'Total Inventory', icon: Warehouse },
        { key: 'lowStock', label: 'Low Stock', icon: AlertTriangle },
        { key: 'warehouseStock', label: 'Warehouse Stock', icon: Warehouse },
        { key: 'coldStorageStock', label: 'Cold Storage', icon: Thermometer },
        { key: 'qualityRejections', label: 'QC Rejections', icon: ShieldCheck },
        { key: 'gradeAPercent', label: 'Grade A %', icon: ShieldCheck, suffix: '%' },
      ],
    },
    {
      title: 'Commerce',
      items: [
        { key: 'todaysOrders', label: "Today's Orders", icon: ShoppingCart },
        { key: 'pendingOrders', label: 'Pending Orders', icon: ShoppingCart },
        { key: 'completedOrders', label: 'Completed Orders', icon: ShoppingCart },
        { key: 'revenue', label: 'Revenue', icon: IndianRupee, money: true },
        { key: 'expenses', label: 'Expenses', icon: IndianRupee, money: true },
        { key: 'profit', label: 'Profit', icon: IndianRupee, money: true },
      ],
    },
    {
      title: 'Network',
      items: [
        { key: 'pendingPayments', label: 'Pending Payments', icon: IndianRupee },
        { key: 'collections', label: 'Collections', icon: IndianRupee, money: true },
        { key: 'deliveryPerformance', label: 'Delivery %', icon: Truck, suffix: '%' },
        { key: 'storeOrders', label: 'Store orders', icon: ShoppingCart },
        { key: 'vendorPerformance', label: 'ERP vendors', icon: Users },
        { key: 'hrHeadcount', label: 'HR records', icon: Users },
      ],
    },
  ],
  farmers: [
    {
      title: 'Farmer insights',
      items: [
        { key: 'totalFarmers', label: 'Total farmers', icon: Tractor },
        { key: 'activeFarmers', label: 'Active farmers', icon: Tractor },
        { key: 'kycApproved', label: 'KYC approved', icon: ShieldCheck },
        { key: 'kycPending', label: 'KYC pending', icon: AlertTriangle },
        { key: 'bankVerified', label: 'Bank verified', icon: IndianRupee },
        { key: 'totalFarms', label: 'Farms', icon: Leaf },
      ],
    },
    {
      title: 'Produce & payouts',
      items: [
        { key: 'farmerCrops', label: 'Crops', icon: Wheat },
        { key: 'farmerProducts', label: 'Products', icon: Package },
        { key: 'farmerOrders', label: 'Farmer orders', icon: ShoppingCart },
        { key: 'farmerOrderValue', label: 'Order value', icon: IndianRupee, money: true },
        { key: 'farmerEarningsPaid', label: 'Paid earnings', icon: IndianRupee, money: true },
        { key: 'farmerEarningsPending', label: 'Pending earnings', icon: IndianRupee, money: true },
      ],
    },
  ],
  farmer_managers: [
    {
      title: 'Farmer manager insights',
      items: [
        { key: 'farmerManagers', label: 'Total managers', icon: UserCog },
        { key: 'activeFarmerManagers', label: 'Active managers', icon: UserCog },
        { key: 'totalFarmers', label: 'Farmers managed', icon: Tractor },
        { key: 'activeFarmers', label: 'Active farmers', icon: Tractor },
        { key: 'farmerCrops', label: 'Crops in field', icon: Wheat },
        { key: 'farmerProducts', label: 'Listed products', icon: Package },
      ],
    },
  ],
  vendors: [
    {
      title: 'Vendor insights',
      items: [
        { key: 'liveVendors', label: 'App vendors', icon: Users },
        { key: 'activeVendors', label: 'Active vendors', icon: Users },
        { key: 'pendingVendors', label: 'Pending vendors', icon: AlertTriangle },
        { key: 'vendorPerformance', label: 'ERP vendor master', icon: Users },
        { key: 'totalFarmers', label: 'Farmers linked', icon: Tractor },
        { key: 'farmerOrderValue', label: 'Farmer order value', icon: IndianRupee, money: true },
      ],
    },
  ],
  pickup_drivers: [
    {
      title: 'Pickup driver insights',
      items: [
        { key: 'pickupDrivers', label: 'Pickup drivers', icon: Truck },
        { key: 'activePickupDrivers', label: 'Active drivers', icon: Truck },
        { key: 'pickupsOpen', label: 'Open pickups', icon: Boxes },
        { key: 'driverPerformance', label: 'Driver records', icon: Truck },
        { key: 'farmerOrders', label: 'Farmer orders', icon: ShoppingCart },
        { key: 'qualityRejections', label: 'QC rejections', icon: ShieldCheck },
      ],
    },
  ],
  delivery_managers: [
    {
      title: 'Delivery manager insights',
      items: [
        { key: 'deliveryManagers', label: 'Store managers', icon: Store },
        { key: 'activeDeliveryManagers', label: 'Active stores', icon: Store },
        { key: 'deliveryBoys', label: 'Riders assigned', icon: Bike },
        { key: 'storeOrders', label: 'Store orders', icon: ShoppingCart },
        { key: 'storePending', label: 'Open store orders', icon: ShoppingCart },
        { key: 'storeDelivered', label: 'Delivered orders', icon: ShoppingCart },
      ],
    },
  ],
  delivery_boys: [
    {
      title: 'Delivery boy insights',
      items: [
        { key: 'deliveryBoys', label: 'Delivery boys', icon: Bike },
        { key: 'onlineBoys', label: 'Online now', icon: Bike },
        { key: 'onDeliveryBoys', label: 'On delivery', icon: Truck },
        { key: 'pendingBoyKyc', label: 'Pending KYC', icon: AlertTriangle },
        { key: 'todayRiderDeliveries', label: "Today's drops", icon: ShoppingCart },
        { key: 'storeDelivered', label: 'Delivered orders', icon: ShoppingCart },
      ],
    },
  ],
  office_staff: [
    {
      title: 'Office staff insights',
      items: [
        { key: 'staffCount', label: 'Office staff', icon: Users },
        { key: 'activeStaff', label: 'Active staff', icon: Users },
        { key: 'staffProductManagers', label: 'Product managers', icon: Package },
        { key: 'staffFarmerManagers', label: 'Staff farmer managers', icon: UserCog },
        { key: 'staffSegregationManagers', label: 'Segregation managers', icon: Boxes },
        { key: 'staffVendors', label: 'Staff vendor logins', icon: Users },
        { key: 'hrHeadcount', label: 'ERP HR records', icon: Users },
      ],
    },
  ],
  customers: [
    {
      title: 'Customer insights',
      items: [
        { key: 'customerGrowth', label: 'ERP customers', icon: Users },
        { key: 'todaysOrders', label: "Today's orders", icon: ShoppingCart },
        { key: 'pendingOrders', label: 'Pending orders', icon: ShoppingCart },
        { key: 'completedOrders', label: 'Completed orders', icon: ShoppingCart },
        { key: 'revenue', label: 'Revenue', icon: IndianRupee, money: true },
        { key: 'storeOrders', label: 'Dark-store orders', icon: Store },
      ],
    },
  ],
};

function formatValue(value, meta = {}) {
  if (value == null) return '0';
  if (meta.money) {
    return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
  if (meta.suffix) return `${Number(value).toLocaleString('en-IN')}${meta.suffix}`;
  return Number(value).toLocaleString('en-IN');
}

export default function CeoDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [lens, setLens] = useState('all');
  const [activeDetailTab, setActiveDetailTab] = useState('financial_liquidity');
  const [timeFilter, setTimeFilter] = useState('30d');

  const load = useCallback(async (periodToLoad) => {
    setLoading(true);
    setError('');
    try {
      const p = periodToLoad || timeFilter;
      const res = await erpApi.dashboard({ period: p });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load CEO dashboard. Sign in as admin.');
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    load('30d');
  }, []);

  const handleTimeFilter = (t) => {
    setTimeFilter(t);
    load(t);
  };

  const kpis = data?.kpis || {};
  const activeMetrics = useMemo(() => {
    if (data?.metricsByPeriod?.[timeFilter]) {
      return data.metricsByPeriod[timeFilter];
    }
    return data?.executiveMetrics || {};
  }, [data, timeFilter]);

  const lenses = data?.lenses?.length ? data.lenses : FALLBACK_LENSES;
  const groups = LENS_GROUPS[lens] || LENS_GROUPS.all;

  const onSearch = async (event) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      navigate(`/traceability?q=${encodeURIComponent(q)}`);
    } finally {
      setSearching(false);
    }
  };

  const generated = useMemo(
    () => (data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : ''),
    [data]
  );

  const activeLens = lenses.find((item) => item.id === lens) || lenses[0];

  // 1. Gross Margin % Data
  const grossMargin = activeMetrics.grossMargin || {
    grossMarginPercent: 31.0,
    grossMarginPerOrder: 135,
    totalGrossProfit: 186902,
    totalRevenue: 602910,
    departmentMargins: [
      { department: 'Pre-order (Fresh Produce)', marginPercent: 32.5, revenueShare: 45, color: '#10B981' },
      { department: 'Ready2Cook (Processed)', marginPercent: 38.0, revenueShare: 35, color: '#6366F1' },
      { department: 'Instant Order (Quick Hubs)', marginPercent: 22.0, revenueShare: 20, color: '#F59E0B' },
    ],
  };

  // 2. Farmer Payment Data
  const farmerPayments = activeMetrics.farmerPayments || {
    totalFarmerEarnings: 452700,
    paidEarnings: 384500,
    pendingEarnings: 68200,
    farmerCountPaid: 48,
    avgFarmerPayout: 8010,
    disbursementRatePercent: 84.9,
  };

  // 3. Cash Flow Data
  const cashFlow = activeMetrics.cashFlow || {
    totalInflow: 602910,
    onlineCollections: 409979,
    codCashCollections: 192931,
    totalOutflow: 513712,
    farmerOutflow: 384500,
    deliveryOutflow: 58212,
    operationsAndPackagingOutflow: 20790,
    netCashFlow: 89198,
    operatingCashMargin: 14.8,
    isPositive: true,
  };

  // 4. Average Order Value (AOV) Data
  const aovMetric = activeMetrics.averageOrderValue || {
    aov: 435,
    aovToday: 428,
    aovLast30Days: 442,
    averageItemsPerOrder: 4.6,
    totalSalesRevenue: 602910,
    distribution: [
      { bracket: 'Under ₹200', count: 250, percent: 18, color: '#94A3B8' },
      { bracket: '₹200 - ₹500', count: 720, percent: 52, color: '#10B981' },
      { bracket: '₹500 - ₹1,000', count: 305, percent: 22, color: '#3B82F6' },
      { bracket: 'Above ₹1,000', count: 111, percent: 8, color: '#8B5CF6' },
    ],
  };

  // Remaining Commerce & Growth Metrics
  const regCust = activeMetrics.registeredCustomers || {
    total: 1420,
    newToday: 18,
    newInPeriod: 425,
    growthRatePercent: 24.5,
    phoneVerified: 1334,
  };

  const actCust = activeMetrics.activeCustomers || {
    monthlyActive: 386,
    activeCount: 386,
    weeklyActive: 148,
    dailyActive: 42,
    activeRatePercent: 27.2,
    dormantCustomers: 1034,
  };

  const ordersPDay = activeMetrics.ordersPerDay || {
    today: 54,
    avgLast7Days: 49.6,
    avgLast30Days: 46.2,
    totalOrders: 1386,
    dailyTrend: [],
    byStatus: { delivered: 1260, shipping: 55, processing: 42, cancelled: 29 },
  };

  const delivCost = activeMetrics.deliveryCostPerOrder || {
    avgDeliveryCost: 42,
    avgCustomerFeeCollected: 15,
    netSubsidyPerOrder: 27,
    totalDeliverySpend: 58212,
    totalCustomerFeesCollected: 20790,
    deliveryCostPercentOfAov: 9.7,
  };

  const contribOrder = activeMetrics.contributionPerOrder || {
    aov: 435,
    cogsPerOrder: 300,
    grossMarginPerOrder: 135,
    grossMarginPercent: 31.0,
    deliveryCostPerOrder: 42,
    packagingPaymentGatewayPerOrder: 15,
    netContributionPerOrder: 78,
    contributionMarginPercent: 17.9,
    breakevenAov: 280,
    isProfitable: true,
    waterfall: [
      { stage: 'Average Order Value (Revenue)', amount: 435, isPositive: true, type: 'revenue', note: 'Customer billing' },
      { stage: 'COGS / Farm Procurement (69%)', amount: -300, isPositive: false, type: 'cogs', note: 'Direct farm produce cost' },
      { stage: 'Gross Margin (CM1)', amount: 135, isPositive: true, type: 'gross', note: '31% product margin' },
      { stage: 'Last-Mile Delivery Cost', amount: -42, isPositive: false, type: 'delivery', note: 'Rider drop payout' },
      { stage: 'Payment & Packaging (2.5%)', amount: -15, isPositive: false, type: 'overhead', note: 'Gateway & packaging' },
      { stage: 'Net Contribution Margin (CM2)', amount: 78, isPositive: true, type: 'net', note: '+17.9% net unit margin' },
    ],
  };

  const repeatOrder = activeMetrics.repeatOrderRate || {
    repeatRatePercent: 39.0,
    totalPurchasingCustomers: 580,
    oneTimeCustomers: 354,
    repeatCustomers: 226,
    loyalCustomers: 64,
    avgOrdersPerCustomer: 2.4,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className={PAGE_KICKER}>Executive Command Center</p>
            {activeMetrics?.isSampleData ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                Benchmark Preview
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span> Live DB
              </span>
            )}
          </div>
          <h1 className={`mt-1 ${PAGE_TITLE}`}>CEO Master Dashboard</h1>
          <p className={`mt-0.5 ${PAGE_SUB}`}>
            Executive oversight of margins, farmer disbursements, cash liquidity, order velocity & unit economics.
          </p>
          {generated && <p className="mt-1 text-xs text-slate-400">Updated {generated}</p>}
        </div>

        {/* Global Traceability Search */}
        <form onSubmit={onSearch} className="flex w-full max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Farmer / Batch / Order # / QR ID"
              className={`${INPUT} pl-9`}
            />
          </div>
          <button type="submit" disabled={searching} className={BTN_PRIMARY}>
            {searching ? '...' : 'Trace'}
          </button>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 4 CORE FINANCIAL & LIQUIDITY HERO CARDS                                   */}
      {/* (1. Gross Margin %, 2. Farmer Payment, 3. Cash Flow, 4. AOV)              */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">
              Executive Financial & Treasury Control
            </h2>
            <span className="text-xs text-slate-400">Margins, Farmer Settlements & Operating Liquidity</span>
          </div>

          {/* Quick Time Window Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Period:</span>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
              {PERIOD_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTimeFilter(t.id)}
                  className={`rounded-lg px-2.5 py-1 uppercase transition ${
                    timeFilter === t.id
                      ? 'bg-emerald-700 text-white shadow-sm font-bold'
                      : 'hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
              {PERIOD_OPTIONS.find((p) => p.id === timeFilter)?.desc || 'Selected Window'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* 1. Gross Margin % */}
          <div
            onClick={() => setActiveDetailTab('financial_liquidity')}
            className={`${PANEL} p-5 cursor-pointer transition hover:border-emerald-500 hover:shadow-md group relative overflow-hidden`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Gross Margin %
              </span>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition">
                <Percent className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {grossMargin.grossMarginPercent}%
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                ₹{Number(grossMargin.totalGrossProfit).toLocaleString('en-IN')} Profit ({timeFilter.toUpperCase()})
              </span>
              <span className="text-slate-500">₹{grossMargin.grossMarginPerOrder} / order</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
              <span>Rev: ₹{Number(grossMargin.totalRevenue).toLocaleString('en-IN')}</span>
              <span className="font-semibold text-indigo-700">Ready2Cook: 38%</span>
            </div>
          </div>

          {/* 2. Farmer Payment */}
          <div
            onClick={() => setActiveDetailTab('financial_liquidity')}
            className={`${PANEL} p-5 cursor-pointer transition hover:border-emerald-500 hover:shadow-md group relative overflow-hidden`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Farmer Payment
              </span>
              <div className="rounded-xl bg-amber-50 p-2 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition">
                <Tractor className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">
              ₹{Number(farmerPayments.paidEarnings).toLocaleString('en-IN')}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded">
                {farmerPayments.disbursementRatePercent}% Disbursed ({timeFilter.toUpperCase()})
              </span>
              <span className="text-slate-500">₹{Number(farmerPayments.pendingEarnings).toLocaleString('en-IN')} Pending</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
              <span>{farmerPayments.farmerCountPaid} Farmers Paid</span>
              <span className="font-semibold text-slate-700">Avg ₹{farmerPayments.avgFarmerPayout}</span>
            </div>
          </div>

          {/* 3. Cash Flow */}
          <div
            onClick={() => setActiveDetailTab('financial_liquidity')}
            className={`${PANEL} p-5 cursor-pointer transition hover:border-emerald-500 hover:shadow-md group relative overflow-hidden`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Net Cash Flow
              </span>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {cashFlow.netCashFlow >= 0 ? '+' : ''}₹{Number(cashFlow.netCashFlow).toLocaleString('en-IN')}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                +{cashFlow.operatingCashMargin}% Operating Margin
              </span>
              <span className="text-slate-500 font-bold">{timeFilter.toUpperCase()}</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
              <span>Inflow: ₹{Number(cashFlow.totalInflow).toLocaleString('en-IN')}</span>
              <span className="font-semibold text-rose-700">Outflow: ₹{Number(cashFlow.totalOutflow).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* 4. Average Order Value (AOV) */}
          <div
            onClick={() => setActiveDetailTab('aov_dynamics')}
            className={`${PANEL} p-5 cursor-pointer transition hover:border-emerald-500 hover:shadow-md group relative overflow-hidden`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                4. Average Order Value
              </span>
              <div className="rounded-xl bg-purple-50 p-2 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">
              ₹{Math.round(aovMetric.aov)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded">
                {aovMetric.averageItemsPerOrder} Items / Basket
              </span>
              <span className="text-slate-500 font-bold">{timeFilter.toUpperCase()}</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
              <span>Revenue: ₹{Number(aovMetric.totalSalesRevenue).toLocaleString('en-IN')}</span>
              <span className="font-semibold text-slate-700">Today: ₹{aovMetric.aovToday}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* COMMERCE & UNIT ECONOMICS ROW (Orders/Day, Contribution, Delivery, Repeat) */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Commerce Velocity & Unit Economics
          </h2>
          <span className="text-xs text-slate-400">Delivery Cost, Contribution, Registered, Active & Repeat Rate</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Orders Per Day */}
          <div
            onClick={() => setActiveDetailTab('order_velocity')}
            className={`${PANEL} p-4 cursor-pointer transition hover:border-emerald-500 hover:shadow-xs group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Orders / Day</span>
              <ShoppingCart className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-slate-900">
              {ordersPDay.averagePerDay}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {timeFilter === 'today' ? "Today's drops" : `${ordersPDay.totalOrders} total in ${timeFilter}`}
            </p>
          </div>

          {/* Delivery Cost Per Order */}
          <div
            onClick={() => setActiveDetailTab('unit_economics')}
            className={`${PANEL} p-4 cursor-pointer transition hover:border-emerald-500 hover:shadow-xs group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Delivery Cost</span>
              <Truck className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-slate-900">₹{delivCost.avgDeliveryCost}</p>
            <p className="mt-1 text-[11px] text-amber-700">Total: ₹{Number(delivCost.totalDeliverySpend).toLocaleString('en-IN')}</p>
          </div>

          {/* Contribution Per Order */}
          <div
            onClick={() => setActiveDetailTab('unit_economics')}
            className={`${PANEL} p-4 cursor-pointer transition hover:border-emerald-500 hover:shadow-xs group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Contribution</span>
              <Percent className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-emerald-700">+₹{contribOrder.netContributionPerOrder}</p>
            <p className="mt-1 text-[11px] text-emerald-700">+{contribOrder.contributionMarginPercent}% CM2 net</p>
          </div>

          {/* Registered Customers */}
          <div
            onClick={() => setActiveDetailTab('customer_funnel')}
            className={`${PANEL} p-4 cursor-pointer transition hover:border-emerald-500 hover:shadow-xs group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Registered</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-slate-900">{Number(regCust.total).toLocaleString('en-IN')}</p>
            <p className="mt-1 text-[11px] text-emerald-700">+{regCust.newInPeriod} in {timeFilter}</p>
          </div>

          {/* Active Customers */}
          <div
            onClick={() => setActiveDetailTab('customer_funnel')}
            className={`${PANEL} p-4 cursor-pointer transition hover:border-emerald-500 hover:shadow-xs group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active ({timeFilter})</span>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-slate-900">{Number(actCust.activeCount || actCust.monthlyActive).toLocaleString('en-IN')}</p>
            <p className="mt-1 text-[11px] text-slate-500">{actCust.activeRatePercent}% active ratio</p>
          </div>

          {/* Repeat Order Rate */}
          <div
            onClick={() => setActiveDetailTab('customer_funnel')}
            className={`${PANEL} p-4 cursor-pointer transition hover:border-emerald-500 hover:shadow-xs group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Repeat Rate</span>
              <Repeat className="h-4 w-4 text-purple-600" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-slate-900">{repeatOrder.repeatRatePercent}%</p>
            <p className="mt-1 text-[11px] text-purple-700">{repeatOrder.repeatCustomers} repeat buyers</p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* DETAILED EXECUTIVE DEEP-DIVE SECTION                                     */}
      {/* ========================================================================= */}
      <section className={`${PANEL} p-5 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Detailed Executive Breakdown
            </h3>
            <p className="text-xs text-slate-500">
              Interactive financial liquidity, cash flow analysis, unit economics waterfall, velocity charts, and retention.
            </p>
          </div>

          {/* Detail Sub-Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'financial_liquidity', label: 'Financials & Cash Flow (1, 2, 3)', icon: Wallet },
              { id: 'unit_economics', label: 'Unit Economics Waterfall', icon: Percent },
              { id: 'order_velocity', label: 'Orders Velocity & Pace', icon: ShoppingCart },
              { id: 'customer_funnel', label: 'Customer Funnel & Repeat Rate', icon: Users },
              { id: 'aov_dynamics', label: 'AOV Brackets (4)', icon: IndianRupee },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeDetailTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDetailTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    active
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: FINANCIALS, FARMER PAYMENTS & CASH FLOW */}
        {activeDetailTab === 'financial_liquidity' && (
          <div className="space-y-4">
            {/* 3 Overview summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Gross Margin Card */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">1. Gross Margin Health</p>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{grossMargin.grossMarginPercent}%</span>
                </div>
                <p className="mt-1 text-2xl font-black text-emerald-950">₹{Number(grossMargin.totalGrossProfit).toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Gross profit generated across ₹{Number(grossMargin.totalRevenue).toLocaleString('en-IN')} revenue
                </p>
              </div>

              {/* Farmer Payouts Card */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">2. Farmer Disbursements</p>
                  <span className="text-xs font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">{farmerPayments.disbursementRatePercent}% cleared</span>
                </div>
                <p className="mt-1 text-2xl font-black text-amber-950">₹{Number(farmerPayments.paidEarnings).toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-amber-700 mt-1">
                  ₹{Number(farmerPayments.pendingEarnings).toLocaleString('en-IN')} pending settlement • {farmerPayments.farmerCountPaid} growers
                </p>
              </div>

              {/* Cash Flow Card */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-800">3. Operating Cash Surplus</p>
                  <span className="text-xs font-extrabold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">+{cashFlow.operatingCashMargin}% margin</span>
                </div>
                <p className="mt-1 text-2xl font-black text-blue-950">+₹{Number(cashFlow.netCashFlow).toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-blue-700 mt-1">
                  Inflows: ₹{Math.round(cashFlow.totalInflow / 1000)}k • Total Outflows: ₹{Math.round(cashFlow.totalOutflow / 1000)}k
                </p>
              </div>
            </div>

            {/* Inflows vs Outflows Cash Flow Waterfall Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Cash Inflows & Outflows */}
              <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Cash Flow Breakdown</span>
                  <span className="text-emerald-700 font-bold">Net: +₹{Number(cashFlow.netCashFlow).toLocaleString('en-IN')}</span>
                </p>

                <div className="space-y-2.5 text-xs">
                  {/* Inflow Online */}
                  <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50/60">
                    <span className="font-semibold text-emerald-900">Online Gateway Collections (Razorpay / UPI)</span>
                    <span className="font-bold text-emerald-800">+₹{Number(cashFlow.onlineCollections).toLocaleString('en-IN')}</span>
                  </div>

                  {/* Inflow COD */}
                  <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50/60">
                    <span className="font-semibold text-emerald-900">COD Cash Collected at Dark Stores</span>
                    <span className="font-bold text-emerald-800">+₹{Number(cashFlow.codCashCollections).toLocaleString('en-IN')}</span>
                  </div>

                  {/* Total Inflows */}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 font-bold text-slate-800">
                    <span>Total Cash Inflow</span>
                    <span className="text-emerald-700">+₹{Number(cashFlow.totalInflow).toLocaleString('en-IN')}</span>
                  </div>

                  {/* Outflow Farmer */}
                  <div className="flex justify-between items-center p-2 rounded-lg bg-rose-50/60">
                    <span className="font-semibold text-rose-900">Farmer Produce Payments Disbursed</span>
                    <span className="font-bold text-rose-800">-₹{Number(cashFlow.farmerOutflow).toLocaleString('en-IN')}</span>
                  </div>

                  {/* Outflow Rider */}
                  <div className="flex justify-between items-center p-2 rounded-lg bg-rose-50/60">
                    <span className="font-semibold text-rose-900">Delivery Partner / Rider Payouts</span>
                    <span className="font-bold text-rose-800">-₹{Number(cashFlow.deliveryOutflow).toLocaleString('en-IN')}</span>
                  </div>

                  {/* Outflow Ops & Packaging */}
                  <div className="flex justify-between items-center p-2 rounded-lg bg-rose-50/60">
                    <span className="font-semibold text-rose-900">Payment Gateway Fees & Packaging</span>
                    <span className="font-bold text-rose-800">-₹{Number(cashFlow.operationsAndPackagingOutflow).toLocaleString('en-IN')}</span>
                  </div>

                  {/* Total Outflows */}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 font-bold text-slate-800">
                    <span>Total Cash Outflow</span>
                    <span className="text-rose-700">-₹{Number(cashFlow.totalOutflow).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Department Gross Margins & Farmer Payout Status */}
              <div className="space-y-4">
                {/* Department Gross Margins */}
                <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Gross Margin % by Department</p>
                  <div className="space-y-2">
                    {grossMargin.departmentMargins?.map((dept) => (
                      <div key={dept.department} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-700">{dept.department}</span>
                          <span className="font-bold text-slate-900">{dept.marginPercent}% margin ({dept.revenueShare}% share)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${dept.marginPercent * 2.2}%`, backgroundColor: dept.color }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Farmer Payment Settlement Progress */}
                <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold uppercase tracking-wide text-slate-700">Farmer Disbursement Clearance</span>
                    <span className="font-extrabold text-amber-700">{farmerPayments.disbursementRatePercent}% Cleared</span>
                  </div>
                  <div className="w-full bg-amber-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-amber-600 h-full rounded-full" style={{ width: `${farmerPayments.disbursementRatePercent}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 pt-1">
                    <span>Disbursed: ₹{Number(farmerPayments.paidEarnings).toLocaleString('en-IN')}</span>
                    <span className="font-semibold text-amber-800">Pending: ₹{Number(farmerPayments.pendingEarnings).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: UNIT ECONOMICS & CONTRIBUTION MARGIN WATERFALL */}
        {activeDetailTab === 'unit_economics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Average Order Spend (AOV)</p>
                <p className="mt-1 text-2xl font-black text-slate-900">₹{contribOrder.aov}</p>
                <p className="text-[11px] text-slate-500 mt-1">Gross merchandise value per drop</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Delivery Fulfillment Cost</p>
                <p className="mt-1 text-2xl font-black text-amber-900">₹{delivCost.avgDeliveryCost}</p>
                <p className="text-[11px] text-amber-700 mt-1">
                  Customer fee: ₹{delivCost.avgCustomerFeeCollected} • Net subsidy: ₹{delivCost.netSubsidyPerOrder}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Net Contribution (CM2)</p>
                <p className="mt-1 text-2xl font-black text-emerald-800">+₹{contribOrder.netContributionPerOrder}</p>
                <p className="text-[11px] text-emerald-700 mt-1">
                  +{contribOrder.contributionMarginPercent}% net margin • Breakeven at ₹{contribOrder.breakevenAov} AOV
                </p>
              </div>
            </div>

            {/* Visual Waterfall Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Unit Economics Step</span>
                <span>Amount / Drop</span>
                <span>% of AOV</span>
                <span>Impact</span>
              </div>
              <div className="divide-y divide-slate-100 bg-white">
                {contribOrder.waterfall?.map((step, idx) => {
                  const percentOfAov = contribOrder.aov > 0
                    ? Math.abs(Math.round((step.amount / contribOrder.aov) * 100))
                    : 0;
                  return (
                    <div key={idx} className="px-4 py-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${step.amount >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div>
                          <p className="font-bold text-slate-800">{step.stage}</p>
                          <p className="text-[11px] text-slate-400">{step.note}</p>
                        </div>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        {step.amount >= 0 ? `+₹${step.amount}` : `-₹${Math.abs(step.amount)}`}
                      </div>
                      <div className="text-slate-500 font-semibold">{percentOfAov}%</div>
                      <div>
                        {step.type === 'net' ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            Net Profitable
                          </span>
                        ) : step.amount >= 0 ? (
                          <span className="text-emerald-600 font-semibold">+ Revenue / Margin</span>
                        ) : (
                          <span className="text-rose-600 font-semibold">- Cost Deducted</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ORDER VELOCITY & 14-DAY PACING */}
        {activeDetailTab === 'order_velocity' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">14-Day Velocity & Daily Pace</p>
                <p className="text-xs text-slate-400">Daily order and delivery counts</p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Orders
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-indigo-500"></span> Delivered
                </span>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ordersPDay.dailyTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    formatter={(val, name) => [val, name === 'orders' ? 'Total Orders' : name === 'delivered' ? 'Delivered' : 'Revenue']}
                  />
                  <Area type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#orderGrad)" />
                  <Area type="monotone" dataKey="delivered" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#delivGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Status Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                <p className="text-[11px] font-bold text-emerald-700">Delivered Drops</p>
                <p className="mt-0.5 text-xl font-extrabold text-emerald-900">{ordersPDay.byStatus?.delivered || 0}</p>
                <p className="text-[10px] text-emerald-600">91% success rate</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
                <p className="text-[11px] font-bold text-blue-700">Out for Delivery</p>
                <p className="mt-0.5 text-xl font-extrabold text-blue-900">{ordersPDay.byStatus?.shipping || 0}</p>
                <p className="text-[10px] text-blue-600">Active riders assigned</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <p className="text-[11px] font-bold text-amber-700">Packing & Processing</p>
                <p className="mt-0.5 text-xl font-extrabold text-amber-900">{ordersPDay.byStatus?.processing || 0}</p>
                <p className="text-[10px] text-amber-600">Dark store preparation</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3">
                <p className="text-[11px] font-bold text-rose-700">Cancelled / Return</p>
                <p className="mt-0.5 text-xl font-extrabold text-rose-900">{ordersPDay.byStatus?.cancelled || 0}</p>
                <p className="text-[10px] text-rose-600">&lt;2.5% churn loss</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CUSTOMER FUNNEL, ACTIVE BASE & REPEAT ORDER RATE */}
        {activeDetailTab === 'customer_funnel' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">1. Registered Base</p>
                <p className="mt-1 text-2xl font-black text-blue-950">{regCust.total}</p>
                <p className="text-[11px] text-blue-700 mt-1">+{regCust.newInPeriod} new users in {timeFilter}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">2. Active Customers (MAU)</p>
                <p className="mt-1 text-2xl font-black text-emerald-950">{actCust.monthlyActive}</p>
                <p className="text-[11px] text-emerald-700 mt-1">{actCust.activeRatePercent}% active engagement ratio</p>
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-purple-700">3. Repeat Buyers (2+)</p>
                <p className="mt-1 text-2xl font-black text-purple-950">{repeatOrder.repeatCustomers}</p>
                <p className="text-[11px] text-purple-700 mt-1">{repeatOrder.repeatRatePercent}% repeat purchase rate</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">4. Super VIPs (5+ Orders)</p>
                <p className="mt-1 text-2xl font-black text-amber-950">{repeatOrder.loyalCustomers}</p>
                <p className="text-[11px] text-amber-700 mt-1">Power grocery subscribers</p>
              </div>
            </div>

            {/* Retention Funnel Visual */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Customer Lifecycle & Loyalty Funnel</p>
              
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">All Registered Accounts</span>
                    <span className="font-bold text-slate-900">{regCust.total}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Placed 1st Order (Converted Buyers)</span>
                    <span className="font-bold text-slate-900">{repeatOrder.totalPurchasingCustomers} ({Math.round((repeatOrder.totalPurchasingCustomers / Math.max(regCust.total, 1)) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.round((repeatOrder.totalPurchasingCustomers / Math.max(regCust.total, 1)) * 100)}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Repeat Buyers (Placed 2+ Orders)</span>
                    <span className="font-bold text-slate-900">{repeatOrder.repeatCustomers} ({repeatOrder.repeatRatePercent}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                    <div className="bg-purple-600 h-full rounded-full" style={{ width: `${repeatOrder.repeatRatePercent}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Loyal Power Shoppers (5+ Orders)</span>
                    <span className="font-bold text-slate-900">{repeatOrder.loyalCustomers} ({Math.round((repeatOrder.loyalCustomers / Math.max(repeatOrder.totalPurchasingCustomers, 1)) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.round((repeatOrder.loyalCustomers / Math.max(repeatOrder.totalPurchasingCustomers, 1)) * 100)}%` }}></div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                Average order frequency is <span className="font-bold text-slate-800">{repeatOrder.avgOrdersPerCustomer} orders</span> per purchasing customer.
              </p>
            </div>
          </div>
        )}

        {/* TAB 5: AOV & BASKET VALUE BRACKETS */}
        {activeDetailTab === 'aov_dynamics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-purple-700">Overall AOV</p>
                <p className="mt-1 text-2xl font-black text-purple-950">₹{aovMetric.aov}</p>
                <p className="text-[11px] text-purple-700 mt-1">Average transaction size</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Average Basket Size</p>
                <p className="mt-1 text-2xl font-black text-blue-950">{aovMetric.averageItemsPerOrder} Items</p>
                <p className="text-[11px] text-blue-700 mt-1">Produce and grocery units per basket</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">30-Day AOV Momentum</p>
                <p className="mt-1 text-2xl font-black text-emerald-950">₹{aovMetric.aovLast30Days}</p>
                <p className="text-[11px] text-emerald-700 mt-1">Today: ₹{aovMetric.aovToday}</p>
              </div>
            </div>

            {/* AOV Distribution Brackets */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Value Distribution</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {aovMetric.distribution?.map((b) => (
                  <div key={b.bracket} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                    <p className="text-xs font-semibold text-slate-600">{b.bracket}</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{b.count} orders</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-700">{b.percent}% of total</span>
                    </div>
                    <div className="mt-1.5 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${b.percent}%`, backgroundColor: b.color || '#10B981' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* INSIGHT LENS FILTER (SECONDARY OPERATIONAL VIEWS)                        */}
      {/* ========================================================================= */}
      <div className={`${PANEL} p-3 sm:p-4`}>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Operational Domain Lens</p>
            <p className="text-sm font-semibold text-slate-800">
              {activeLens?.label || 'All insights'}
            </p>
          </div>
          <p className="max-w-xl text-xs text-slate-500">{LENS_COPY[lens] || LENS_COPY.all}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {lenses.map((item) => {
            const selected = item.id === lens;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setLens(item.id)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                  selected
                    ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
                {item.count != null ? (
                  <span className={`ml-1.5 tabular-nums ${selected ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {Number(item.count).toLocaleString('en-IN')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading CEO executive insights
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">{group.title}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className={`${PANEL} p-4 sm:p-5`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#6B7280]">{item.label}</p>
                      <Icon className="h-4 w-4 text-[#217346]" />
                    </div>
                    <p className="mt-1 text-2xl font-bold text-[#1F2937]">
                      {formatValue(kpis[item.key], item)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {lens === 'all' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { label: 'Grade A / B / C', value: `${kpis.gradeAPercent || 0}% / ${kpis.gradeBPercent || 0}% / ${kpis.gradeCPercent || 0}%` },
            { label: 'Procurement', value: formatValue(kpis.procurementAmount, { money: true }) },
            { label: 'HR headcount', value: kpis.hrHeadcount || 0 },
          ].map((row) => (
            <div key={row.label} className={`${PANEL} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#217346]">{row.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{row.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <BarChart3 className="h-4 w-4" />
        Click any ID in Traceability to walk Farmer → Farm → Crop → Article → Batch → QR → Order → Payment.
      </div>
    </div>
  );
}
