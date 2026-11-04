import {
  Farmer,
  FarmerCrop,
  FarmerProduct,
  FarmerOrder,
  FarmerEarning,
  FarmerManager,
  Pickup,
  PickupDriver,
  Vendor,
} from "../../../farmer-manager-service/src/models.js";
import DeliveryManager from "../../../delivery-service/src/models/DeliveryManager.js";
import DeliveryBoy from "../../../delivery-service/src/models/DeliveryBoy.js";
import StoreOrder from "../../../delivery-service/src/models/StoreOrder.js";
import Staff from "../../../staff-service/src/models/Staff.js";
import Order from "../../../legacy/models/order/Order.js";
import User from "../../../legacy/models/user.js";
import {
  Farm,
  Crop,
  Article,
  Batch,
  Warehouse,
  ColdStorage,
  Inventory,
  Procurement,
  CustomerOrder,
  Delivery,
  QualityCheck,
  Employee,
  Customer,
  VendorMaster,
  ErpPayment,
} from "../models/index.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateLabel(dateObj) {
  const d = new Date(dateObj);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

const ORDER_VALUE_BRACKETS = [
  { bracket: "Under ₹200", color: "#94A3B8" },
  { bracket: "₹200 – ₹499", color: "#10B981" },
  { bracket: "₹500 – ₹999", color: "#3B82F6" },
  { bracket: "₹1,000 and above", color: "#8B5CF6" },
];

const percent = (value, total) => total > 0 ? Number((value * 100 / total).toFixed(1)) : 0;
const average = (value, count) => count > 0 ? Number((value / count).toFixed(1)) : 0;

async function computeExecutiveMetrics(today, selectedPeriod = "30d") {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const windows = [
    ["today", "Today", today, 1],
    ["7d", "Last 7 Days", new Date(now - 7 * dayMs), 7],
    ["30d", "Last 30 Days", new Date(now - 30 * dayMs), 30],
    ["all", "All Time", null, null],
  ];
  const customerFilter = { role: "user" };
  const orderFilter = {
    isDeleted: { $ne: true },
    deleted: { $ne: true },
    status: { $nin: ["attempted", "deleted", "DELETED"] },
  };
  const validOrders = { $match: { status: { $ne: "cancelled" } } };
  const total = { $ifNull: ["$total", 0] };
  const day = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } };
  const registeredCount = await User.countDocuments(customerFilter);

  const entries = await Promise.all(windows.map(async ([periodKey, periodLabel, since, days]) => {
    const dateFilter = since ? { createdAt: { $gte: since } } : {};
    const [orderResults, earnings, newInPeriod] = await Promise.all([
      Order.aggregate([
        { $match: { ...orderFilter, ...dateFilter } },
        { $facet: {
          status: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          sales: [validOrders, { $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: total },
            items: { $sum: { $size: { $ifNull: ["$items", []] } } },
            firstOrder: { $min: "$createdAt" },
          } }],
          buyers: [validOrders, { $match: { user: { $ne: null } } }, { $group: { _id: "$user", count: { $sum: 1 } } }],
          brackets: [validOrders, { $bucket: { groupBy: total, boundaries: [0, 200, 500, 1000], default: "other" } }],
          trend: [
            { $match: { createdAt: { $gte: new Date(now - 14 * dayMs) } } },
            { $group: {
              _id: day,
              orders: { $sum: 1 },
              delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
            } },
            { $sort: { _id: 1 } },
          ],
        } },
      ]),
      FarmerEarning.aggregate([
        { $match: { ...dateFilter, status: { $in: ["Paid", "Pending", "Available"] } } },
        { $group: { _id: { status: "$status", farmer: "$farmerId" }, amount: { $sum: "$netEarnings" } } },
      ]),
      since ? User.countDocuments({ ...customerFilter, ...dateFilter }) : registeredCount,
    ]);
    const { status = [], sales = [], buyers = [], brackets = [], trend = [] } = orderResults[0] || {};
    const { count = 0, revenue = 0, items = 0, firstOrder } = sales[0] || {};
    const statusCounts = Object.fromEntries(status.map(row => [row._id, row.count]));
    const totalOrders = status.reduce((sum, row) => sum + row.count, 0);
    const span = days ?? (firstOrder ? Math.max(1, Math.ceil((now - firstOrder) / dayMs)) : 1);
    const paid = earnings.filter(row => row._id.status === "Paid");
    const paidEarnings = paid.reduce((sum, row) => sum + row.amount, 0);
    const pendingEarnings = earnings.filter(row => row._id.status !== "Paid").reduce((sum, row) => sum + row.amount, 0);
    const farmerCountPaid = new Set(paid.map(row => row._id.farmer).filter(Boolean)).size;
    const repeatCustomers = buyers.filter(row => row.count > 1).length;
    const bracketCounts = Object.fromEntries(brackets.map(row => [row._id, row.count]));

    return [periodKey, {
      source: "database",
      periodKey,
      periodLabel,
      registeredCustomers: { total: registeredCount, newInPeriod },
      activeCustomers: { monthlyActive: buyers.length, activeCount: buyers.length, activeRatePercent: percent(buyers.length, registeredCount) },
      ordersPerDay: {
        totalOrders,
        averagePerDay: average(totalOrders, span),
        dailyTrend: trend.map(row => ({ date: row._id, label: formatDateLabel(new Date(row._id + "T12:00:00Z")), orders: row.orders, delivered: row.delivered })),
        byStatus: {
          delivered: statusCounts.delivered ?? 0,
          shipping: statusCounts.shipping ?? 0,
          processing: (statusCounts.confirm ?? 0) + (statusCounts.processing ?? 0),
          cancelled: statusCounts.cancelled ?? 0,
        },
      },
      averageOrderValue: {
        aov: average(revenue, count),
        averageItemsPerOrder: average(items, count),
        totalSalesRevenue: revenue,
        distribution: ORDER_VALUE_BRACKETS.map((entry, i) => {
          const orders = bracketCounts[[0, 200, 500, "other"][i]] ?? 0;
          return { ...entry, count: orders, percent: percent(orders, count) };
        }),
      },
      repeatOrderRate: {
        repeatRatePercent: percent(repeatCustomers, buyers.length),
        totalPurchasingCustomers: buyers.length,
        oneTimeCustomers: buyers.length - repeatCustomers,
        repeatCustomers,
        loyalCustomers: buyers.filter(row => row.count >= 5).length,
        avgOrdersPerCustomer: average(buyers.reduce((sum, row) => sum + row.count, 0), buyers.length),
      },
      farmerPayments: {
        paidEarnings, pendingEarnings, farmerCountPaid,
        avgFarmerPayout: average(paidEarnings, farmerCountPaid),
        disbursementRatePercent: percent(paidEarnings, paidEarnings + pendingEarnings),
      },
    }];
  }));
  const metricsByPeriod = Object.fromEntries(entries);
  for (const metrics of Object.values(metricsByPeriod)) {
    metrics.averageOrderValue.aovToday = metricsByPeriod.today.averageOrderValue.aov;
    metrics.averageOrderValue.aovLast30Days = metricsByPeriod["30d"].averageOrderValue.aov;
    metrics.ordersPerDay.today = metricsByPeriod.today.ordersPerDay.totalOrders;
    metrics.ordersPerDay.avgLast7Days = metricsByPeriod["7d"].ordersPerDay.averagePerDay;
    metrics.ordersPerDay.avgLast30Days = metricsByPeriod["30d"].ordersPerDay.averagePerDay;
  }
  return { executiveMetrics: metricsByPeriod[selectedPeriod] || metricsByPeriod["30d"], metricsByPeriod };
}

export async function getCeoDashboard(period = "30d") {
  const today = startOfToday();
  const [
    totalFarmers,
    activeFarmers,
    totalFarms,
    activeCrops,
    totalArticles,
    totalBatches,
    inventoryAgg,
    lowStock,
    procurementAgg,
    todaysOrders,
    pendingOrders,
    completedOrders,
    salesAgg,
    expenseAgg,
    pendingPayments,
    collectionsAgg,
    warehouseStock,
    coldStock,
    deliveries,
    delivered,
    quality,
    customers,
    vendors,
    drivers,
    employees,
    farmerManagers,
    activeFarmerManagers,
    kycPending,
    kycApproved,
    bankVerified,
    farmerProducts,
    farmerOrders,
    farmerOrderValue,
    farmerEarningsPaid,
    farmerEarningsPending,
    liveVendors,
    activeVendors,
    pendingVendors,
    pickupDrivers,
    activePickupDrivers,
    pickupsOpen,
    deliveryManagers,
    activeDeliveryManagers,
    deliveryBoys,
    onlineBoys,
    onDeliveryBoys,
    pendingBoyKyc,
    todayRiderDeliveries,
    storeOrders,
    storeDelivered,
    storePending,
    staffCount,
    activeStaff,
    staffRoles,
    farmerCrops,
  ] = await Promise.all([
    Farmer.countDocuments({}),
    Farmer.countDocuments({ status: { $in: ["Active", "ACTIVE"] } }),
    Farm.countDocuments({ isDeleted: { $ne: true } }),
    Crop.countDocuments({ isDeleted: { $ne: true }, status: { $nin: ["INACTIVE", "CLOSED"] } }),
    Article.countDocuments({ isDeleted: { $ne: true } }),
    Batch.countDocuments({ isDeleted: { $ne: true } }),
    Inventory.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: null, stock: { $sum: "$availableStock" }, value: { $sum: "$totalValue" } } },
    ]),
    Inventory.countDocuments({ isDeleted: { $ne: true }, lowStockAlert: true }),
    Procurement.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: null, qty: { $sum: "$quantity" }, amount: { $sum: "$purchaseAmount" } } },
    ]),
    CustomerOrder.countDocuments({ createdAt: { $gte: today }, isDeleted: { $ne: true } }),
    CustomerOrder.countDocuments({ isDeleted: { $ne: true }, status: { $nin: ["COMPLETED", "DELIVERED", "CANCELLED"] } }),
    CustomerOrder.countDocuments({ isDeleted: { $ne: true }, status: { $in: ["COMPLETED", "DELIVERED"] } }),
    CustomerOrder.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Procurement.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: null, amount: { $sum: "$purchaseAmount" } } },
    ]),
    ErpPayment.countDocuments({ isDeleted: { $ne: true }, paymentStatus: { $in: ["PENDING", "UNPAID"] } }),
    ErpPayment.aggregate([
      { $match: { isDeleted: { $ne: true }, paymentStatus: { $in: ["PAID", "SETTLED", "SUCCESS"] } } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    Warehouse.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: null, stock: { $sum: "$currentStock" } } }]),
    ColdStorage.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: null, occupied: { $sum: "$occupiedCapacity" } } }]),
    Delivery.countDocuments({ isDeleted: { $ne: true } }),
    Delivery.countDocuments({ isDeleted: { $ne: true }, deliveryStatus: "DELIVERED" }),
    QualityCheck.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: "$grade",
          count: { $sum: 1 },
          rejected: { $sum: "$rejectedQuantity" },
        },
      },
    ]),
    Customer.countDocuments({ isDeleted: { $ne: true } }),
    VendorMaster.countDocuments({ isDeleted: { $ne: true } }),
    PickupDriver.countDocuments({}),
    Employee.countDocuments({ isDeleted: { $ne: true } }),
    FarmerManager.countDocuments({}),
    FarmerManager.countDocuments({ status: "Active" }),
    Farmer.countDocuments({ isDeleted: { $ne: true }, kycStatus: { $in: ["PENDING", "SUBMITTED"] } }),
    Farmer.countDocuments({ isDeleted: { $ne: true }, kycStatus: "APPROVED" }),
    Farmer.countDocuments({ isDeleted: { $ne: true }, bankVerificationStatus: "VERIFIED" }),
    FarmerProduct.countDocuments({}),
    FarmerOrder.countDocuments({}),
    FarmerOrder.aggregate([{ $group: { _id: null, amount: { $sum: "$totalAmount" } } }]),
    FarmerEarning.aggregate([
      { $match: { status: "Paid" } },
      { $group: { _id: null, amount: { $sum: "$netEarnings" } } },
    ]),
    FarmerEarning.aggregate([
      { $match: { status: { $in: ["Pending", "Available"] } } },
      { $group: { _id: null, amount: { $sum: "$netEarnings" } } },
    ]),
    Vendor.countDocuments({}),
    Vendor.countDocuments({ status: "Active" }),
    Vendor.countDocuments({ status: "Pending" }),
    PickupDriver.countDocuments({}),
    PickupDriver.countDocuments({ status: "Active" }),
    Pickup.countDocuments({ status: { $nin: ["COMPLETED", "DELIVERED", "CANCELLED"] } }),
    DeliveryManager.countDocuments({}),
    DeliveryManager.countDocuments({ isActive: { $ne: false } }),
    DeliveryBoy.countDocuments({}),
    DeliveryBoy.countDocuments({ status: "online" }),
    DeliveryBoy.countDocuments({ status: "on_delivery" }),
    DeliveryBoy.countDocuments({ verificationStatus: "pending" }),
    DeliveryBoy.aggregate([{ $group: { _id: null, qty: { $sum: "$todayCompletedOrders" } } }]),
    StoreOrder.countDocuments({}),
    StoreOrder.countDocuments({ status: "delivered" }),
    StoreOrder.countDocuments({ status: { $nin: ["delivered", "cancelled"] } }),
    Staff.countDocuments({}),
    Staff.countDocuments({ isActive: { $ne: false } }),
    Staff.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    FarmerCrop.countDocuments({}),
  ]);

  const gradeMap = Object.fromEntries((quality || []).map((g) => [g._id || "NONE", g]));
  const gradeTotal = (quality || []).reduce((s, g) => s + (g.count || 0), 0) || 1;
  const revenue = salesAgg[0]?.amount || 0;
  const expenses = expenseAgg[0]?.amount || 0;
  const staffRoleCounts = Object.fromEntries((staffRoles || []).map((row) => [row._id, row.count]));

  const kpis = {
    totalFarmers,
    activeFarmers,
    totalFarms,
    activeCrops,
    totalArticles,
    totalBatches,
    totalInventory: inventoryAgg[0]?.stock || 0,
    inventoryValue: inventoryAgg[0]?.value || 0,
    lowStock,
    procurementQuantity: procurementAgg[0]?.qty || 0,
    procurementAmount: procurementAgg[0]?.amount || 0,
    todaysOrders,
    pendingOrders,
    completedOrders,
    sales: salesAgg[0]?.count || 0,
    revenue,
    expenses,
    profit: revenue - expenses,
    pendingPayments,
    collections: collectionsAgg[0]?.amount || 0,
    warehouseStock: warehouseStock[0]?.stock || 0,
    coldStorageStock: coldStock[0]?.occupied || 0,
    deliveryPerformance: deliveries ? Math.round((delivered / deliveries) * 100) : 0,
    qualityRejections: (quality || []).reduce((s, g) => s + (g.rejected || 0), 0),
    gradeAPercent: Math.round(((gradeMap.A?.count || 0) / gradeTotal) * 100),
    gradeBPercent: Math.round(((gradeMap.B?.count || 0) / gradeTotal) * 100),
    gradeCPercent: Math.round(((gradeMap.C?.count || 0) / gradeTotal) * 100),
    customerGrowth: customers,
    vendorPerformance: vendors,
    driverPerformance: drivers,
    hrHeadcount: employees,
    farmerCrops,
    farmerManagers,
    activeFarmerManagers,
    kycPending,
    kycApproved,
    bankVerified,
    farmerProducts,
    farmerOrders,
    farmerOrderValue: farmerOrderValue[0]?.amount || 0,
    farmerEarningsPaid: farmerEarningsPaid[0]?.amount || 0,
    farmerEarningsPending: farmerEarningsPending[0]?.amount || 0,
    liveVendors,
    activeVendors,
    pendingVendors,
    pickupDrivers,
    activePickupDrivers,
    pickupsOpen,
    deliveryManagers,
    activeDeliveryManagers,
    deliveryBoys,
    onlineBoys,
    onDeliveryBoys,
    pendingBoyKyc,
    todayRiderDeliveries: todayRiderDeliveries[0]?.qty || 0,
    storeOrders,
    storeDelivered,
    storePending,
    staffCount,
    activeStaff,
    staffProductManagers: staffRoleCounts.product_manager || 0,
    staffFarmerManagers: staffRoleCounts.farmer_manager || 0,
    staffSegregationManagers: staffRoleCounts.segregation_manager || 0,
    staffVendors: staffRoleCounts.vendor || 0,
  };

  const { executiveMetrics, metricsByPeriod } = await computeExecutiveMetrics(today, period);

  // Merge executive metrics into kpis for backward-compatibility
  kpis.registeredCustomers = executiveMetrics.registeredCustomers.total;
  kpis.activeCustomers = executiveMetrics.activeCustomers.monthlyActive;
  kpis.ordersPerDay = executiveMetrics.ordersPerDay.averagePerDay;
  kpis.averageOrderValue = executiveMetrics.averageOrderValue.aov;
  kpis.deliveryCostPerOrder = null;
  kpis.contributionPerOrder = null;
  kpis.repeatOrderRate = executiveMetrics.repeatOrderRate.repeatRatePercent;
  kpis.grossMarginPercent = null;
  kpis.farmerEarningsPaid = executiveMetrics.farmerPayments.paidEarnings;
  kpis.farmerEarningsPending = executiveMetrics.farmerPayments.pendingEarnings;
  kpis.netCashFlow = null;

  return {
    generatedAt: new Date(),
    period,
    executiveMetrics,
    metricsByPeriod,
    kpis,
    lenses: [
      { id: "all", label: "All insights", count: totalFarmers + farmerManagers + liveVendors + pickupDrivers + deliveryManagers + deliveryBoys + staffCount + customers },
      { id: "executive", label: "CEO Metrics" },
      { id: "farmers", label: "Farmers", count: totalFarmers },
      { id: "farmer_managers", label: "Farmer managers", count: farmerManagers },
      { id: "vendors", label: "Vendors", count: liveVendors },
      { id: "pickup_drivers", label: "Pickup drivers", count: pickupDrivers },
      { id: "delivery_managers", label: "Delivery managers", count: deliveryManagers },
      { id: "delivery_boys", label: "Delivery boys", count: deliveryBoys },
      { id: "office_staff", label: "Office staff", count: staffCount },
      { id: "customers", label: "Customers", count: customers },
    ],
    modules: [
      "Farmer",
      "Procurement",
      "Inventory",
      "Orders",
      "Sales",
      "Revenue",
      "Expense",
      "Profit",
      "Customers",
      "Delivery",
      "Warehouse",
      "Quality",
      "Wastage",
      "HR",
      "Vendor",
      "Finance",
      "Audit",
      "Analytics",
    ],
  };
}
