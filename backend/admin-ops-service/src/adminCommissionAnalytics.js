import { VendorCommissionPayment } from "./models.js";
import { VendorZone } from "../../farmer-manager-service/src/models.js";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import StoreOrder from "../../delivery-service/src/models/StoreOrder.js";
import { calculateAllVendorsCommission } from "./adminCommissionService.js";

const TIMEZONE = "Asia/Kolkata";
const UNASSIGNED_ZONE = "__unassigned__";
const RATE_BANDS = [
  { key: "0-5", label: "Below 5%", min: 0, max: 5 },
  { key: "5-10", label: "5–10%", min: 5, max: 10 },
  { key: "10-15", label: "10–15%", min: 10, max: 15 },
  { key: "15-20", label: "15–20%", min: 15, max: 20 },
  { key: "20+", label: "20% and above", min: 20, max: Infinity },
];

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const pct = (part, whole) => (whole > 0 ? round2((part / whole) * 100) : 0);

// Same sale definition as calculateVendorAdminCommission: non-cancelled item value + delivery charges.
const ITEMS_SUM = {
  $sum: {
    $map: {
      input: { $ifNull: ["$items", []] },
      as: "it",
      in: { $multiply: [{ $ifNull: ["$$it.price", 0] }, { $ifNull: ["$$it.quantity", 0] }] },
    },
  },
};
const PAID = {
  $cond: [{ $gt: [{ $ifNull: ["$partTotal", 0] }, 0] }, "$partTotal", { $ifNull: ["$amountToCollect", 0] }],
};
const NOT_CANCELLED = { $ne: ["$status", "cancelled"] };
const SALE_EXPR = {
  $cond: [
    NOT_CANCELLED,
    { $add: [ITEMS_SUM, { $max: [0, { $subtract: [PAID, ITEMS_SUM] }] }] },
    0,
  ],
};

function bucketFormat(dateFilter) {
  if (!dateFilter?.$gte) return { format: "%Y-%m", unit: "month" };
  const end = dateFilter.$lte ? new Date(dateFilter.$lte) : new Date();
  const days = (end - new Date(dateFilter.$gte)) / 86_400_000;
  return days > 92 ? { format: "%Y-%m", unit: "month" } : { format: "%Y-%m-%d", unit: "day" };
}

const istKey = (date, unit) => {
  const ist = new Date(date.getTime() + 5.5 * 3_600_000);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  if (unit === "month") return `${y}-${m}`;
  return `${y}-${m}-${String(ist.getUTCDate()).padStart(2, "0")}`;
};

/** Continuous bucket keys between two keys (inclusive), capped to keep charts readable. */
function fillKeys(firstKey, lastKey, unit, cap = 400) {
  if (!firstKey || !lastKey) return [];
  const keys = [];
  if (unit === "month") {
    let [y, m] = firstKey.split("-").map(Number);
    const [ly, lm] = lastKey.split("-").map(Number);
    while ((y < ly || (y === ly && m <= lm)) && keys.length < cap) {
      keys.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return keys;
  }
  const cursor = new Date(`${firstKey}T00:00:00Z`);
  const last = new Date(`${lastKey}T00:00:00Z`);
  while (cursor <= last && keys.length < cap) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/**
 * Commission analytics across all vendors for one period: vendor leaderboard, zone-wise
 * commission (attributed through each dark store's zone), trend, rate bands, status/type splits.
 * Vendor totals come from calculateAllVendorsCommission so they match the commission table.
 */
export async function getVendorCommissionAnalytics(dateFilter = null) {
  const { vendors: calcs, totals } = await calculateAllVendorsCommission(dateFilter);

  const calcByVendorKey = new Map();
  for (const c of calcs) {
    calcByVendorKey.set(c.vendor.id, c);
    calcByVendorKey.set(String(c.vendor._id), c);
  }
  const primary = calcByVendorKey.get("vendor-1") || null;

  const [stores, zoneDocs] = await Promise.all([
    DeliveryManager.find({ isDeleted: { $ne: true } })
      .select("_id storeName area city vendorId zoneId zoneName isActive")
      .lean(),
    VendorZone.find({ status: "Approved" }).select("id name state vendorId cities").lean(),
  ]);
  const zoneById = new Map(zoneDocs.map((z) => [z.id, z]));

  const storeInfo = new Map();
  for (const s of stores) {
    const vendorKey = String(s.vendorId || "").trim();
    const calc = vendorKey ? calcByVendorKey.get(vendorKey) : primary;
    if (!calc) continue;
    const zoneDoc = s.zoneId ? zoneById.get(s.zoneId) : null;
    const zoneName = zoneDoc?.name || s.zoneName || "";
    storeInfo.set(String(s._id), {
      store: s,
      calc,
      zoneKey: zoneDoc?.id || (zoneName ? `name:${zoneName.toLowerCase()}` : UNASSIGNED_ZONE),
      zoneName: zoneName || "No zone assigned",
      zoneState: zoneDoc?.state || "",
    });
  }
  const storeIds = stores.filter((s) => storeInfo.has(String(s._id))).map((s) => s._id);

  const orderMatch = { managerId: { $in: storeIds }, isDeleted: { $ne: true } };
  if (dateFilter) orderMatch.createdAt = dateFilter;
  const { format, unit } = bucketFormat(dateFilter);
  const paymentMatch = dateFilter ? { paidAt: dateFilter } : {};

  const [perStore, perStoreBucket, paymentBuckets, paymentMethods] = await Promise.all([
    StoreOrder.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: "$managerId",
          orders: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          sales: { $sum: SALE_EXPR },
        },
      },
    ]),
    StoreOrder.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: {
            store: "$managerId",
            bucket: { $dateToString: { format, date: "$createdAt", timezone: TIMEZONE } },
          },
          sales: { $sum: SALE_EXPR },
          orders: { $sum: 1 },
        },
      },
    ]),
    VendorCommissionPayment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: { $dateToString: { format, date: "$paidAt", timezone: TIMEZONE } },
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    VendorCommissionPayment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: { $ifNull: ["$method", ""] }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]),
  ]);

  // ---- zones ----
  const zones = new Map();
  const vendorZoneNames = new Map();
  const ensureZone = (key, name, state) => {
    if (!zones.has(key)) {
      zones.set(key, {
        zoneKey: key,
        zoneName: name,
        state,
        stores: 0,
        activeStores: 0,
        orders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        sales: 0,
        commission: 0,
        vendors: new Map(),
      });
    }
    return zones.get(key);
  };
  const addVendorZone = (vendorId, zoneName) => {
    if (!zoneName) return;
    if (!vendorZoneNames.has(vendorId)) vendorZoneNames.set(vendorId, new Set());
    vendorZoneNames.get(vendorId).add(zoneName);
  };

  for (const z of zoneDocs) {
    ensureZone(z.id, z.name, z.state || "");
    const owner = calcByVendorKey.get(z.vendorId);
    if (owner) addVendorZone(owner.vendor.id, z.name);
  }
  for (const c of calcs) for (const name of c.vendor.zones || []) addVendorZone(c.vendor.id, name);

  const storeStats = new Map(perStore.map((row) => [String(row._id), row]));
  for (const [storeId, info] of storeInfo) {
    const zone = ensureZone(info.zoneKey, info.zoneName, info.zoneState);
    zone.stores += 1;
    if (info.store.isActive !== false) zone.activeStores += 1;
    if (info.zoneKey !== UNASSIGNED_ZONE) addVendorZone(info.calc.vendor.id, info.zoneName);

    const stat = storeStats.get(storeId) || { orders: 0, delivered: 0, cancelled: 0, sales: 0 };
    const rate = Number(info.calc.commissionRate || 0);
    const commission = Math.round((Number(stat.sales || 0) * rate) / 100);
    zone.orders += stat.orders;
    zone.deliveredOrders += stat.delivered;
    zone.cancelledOrders += stat.cancelled;
    zone.sales += Number(stat.sales || 0);
    zone.commission += commission;

    const vid = info.calc.vendor.id;
    const entry = zone.vendors.get(vid) || {
      vendorId: vid,
      vendorName: info.calc.vendor.name,
      commissionRate: rate,
      stores: 0,
      orders: 0,
      sales: 0,
      commission: 0,
    };
    entry.stores += 1;
    entry.orders += stat.orders;
    entry.sales += Number(stat.sales || 0);
    entry.commission += commission;
    zone.vendors.set(vid, entry);
  }

  const totalCommission = Number(totals.totalAdminCommission || 0);
  const zoneList = [...zones.values()]
    .map((z) => ({
      ...z,
      sales: Math.round(z.sales),
      vendorCount: z.vendors.size,
      effectiveRate: pct(z.commission, z.sales),
      shareOfCommission: pct(z.commission, totalCommission),
      vendors: [...z.vendors.values()]
        .map((v) => ({ ...v, sales: Math.round(v.sales), shareOfZone: pct(v.commission, z.commission) }))
        .sort((a, b) => b.commission - a.commission),
    }))
    .sort((a, b) => b.commission - a.commission || a.zoneName.localeCompare(b.zoneName));

  // ---- vendors ----
  const vendorList = calcs
    .map((c) => {
      const commission = Number(c.totalAdminCommission || 0);
      return {
        vendorId: c.vendor.id,
        vendorName: c.vendor.name,
        ownerName: c.vendor.ownerName || "",
        vendorType: c.vendor.vendorType || "farmer",
        city: c.vendor.city || "",
        state: c.vendor.state || "",
        zones: [...(vendorZoneNames.get(c.vendor.id) || [])].sort(),
        darkStoresCount: c.darkStoresCount || 0,
        commissionRate: Number(c.commissionRate || 0),
        orders: c.totalOrders || 0,
        deliveredOrders: c.completedOrders || 0,
        cancelledOrders: c.cancelledOrders || 0,
        sales: Math.round(c.eligibleCommissionSales || 0),
        commission,
        received: Number(c.commissionPaid || 0),
        pending: Number(c.pendingCommission || 0),
        status: c.commissionStatus,
        collectionRate: commission > 0 ? pct(c.commissionPaid, commission) : 100,
        shareOfCommission: pct(commission, totalCommission),
        lastPaymentDate: c.lastPaymentDate || null,
      };
    })
    .sort((a, b) => b.commission - a.commission || b.commissionRate - a.commissionRate);

  // ---- trend ----
  const trendMap = new Map();
  const bump = (key) => {
    if (!trendMap.has(key)) trendMap.set(key, { period: key, sales: 0, commission: 0, received: 0, orders: 0 });
    return trendMap.get(key);
  };
  for (const row of perStoreBucket) {
    const info = storeInfo.get(String(row._id.store));
    if (!info) continue;
    const point = bump(row._id.bucket);
    point.sales += Number(row.sales || 0);
    point.orders += row.orders;
    point.commission += (Number(row.sales || 0) * Number(info.calc.commissionRate || 0)) / 100;
  }
  for (const row of paymentBuckets) if (row._id) bump(row._id).received += Number(row.amount || 0);

  const seenKeys = [...trendMap.keys()].sort();
  const firstKey = dateFilter?.$gte ? istKey(new Date(dateFilter.$gte), unit) : seenKeys[0];
  const lastKey = dateFilter?.$lte ? istKey(new Date(dateFilter.$lte), unit) : seenKeys[seenKeys.length - 1] || istKey(new Date(), unit);
  const trend = (fillKeys(firstKey, lastKey, unit).length ? fillKeys(firstKey, lastKey, unit) : seenKeys).map((key) => {
    const p = trendMap.get(key) || { period: key, sales: 0, commission: 0, received: 0, orders: 0 };
    return { ...p, sales: Math.round(p.sales), commission: Math.round(p.commission), received: Math.round(p.received) };
  });

  // ---- distributions ----
  const rateBands = RATE_BANDS.map((band) => {
    const inBand = vendorList.filter((v) => v.commissionRate >= band.min && v.commissionRate < band.max);
    return {
      band: band.key,
      label: band.label,
      vendors: inBand.length,
      commission: inBand.reduce((s, v) => s + v.commission, 0),
    };
  });

  const statusBreakdown = ["Paid", "Partially Paid", "Pending"].map((status) => {
    const rows = vendorList.filter((v) => v.status === status);
    return {
      status,
      vendors: rows.length,
      commission: rows.reduce((s, v) => s + v.commission, 0),
      pending: rows.reduce((s, v) => s + v.pending, 0),
    };
  });

  const typeBreakdown = ["seller", "farmer"].map((type) => {
    const rows = vendorList.filter((v) => (v.vendorType === "seller" ? "seller" : "farmer") === type);
    return {
      type,
      label: type === "seller" ? "Seller vendors" : "Farmer vendors",
      vendors: rows.length,
      sales: rows.reduce((s, v) => s + v.sales, 0),
      commission: rows.reduce((s, v) => s + v.commission, 0),
    };
  });

  const eligibleSales = Number(totals.totalEligibleCommissionSales || 0);
  const received = Number(totals.totalCommissionReceived || 0);
  const vendorsWithSales = vendorList.filter((v) => v.sales > 0);
  const rates = vendorList.map((v) => v.commissionRate).sort((a, b) => a - b);
  const median = rates.length
    ? rates.length % 2
      ? rates[(rates.length - 1) / 2]
      : (rates[rates.length / 2 - 1] + rates[rates.length / 2]) / 2
    : 0;

  return {
    period: { unit, from: dateFilter?.$gte || null, to: dateFilter?.$lte || null },
    kpis: {
      totalCommission,
      received,
      pending: Number(totals.totalPendingCommission || 0),
      eligibleSales,
      orders: Number(totals.totalOrders || 0),
      effectiveRate: pct(totalCommission, eligibleSales),
      averageRate: rates.length ? round2(rates.reduce((s, r) => s + r, 0) / rates.length) : 0,
      medianRate: round2(median),
      highestRate: rates.length ? rates[rates.length - 1] : 0,
      lowestRate: rates.length ? rates[0] : 0,
      collectionRate: totalCommission > 0 ? pct(received, totalCommission) : 0,
      totalVendors: vendorList.length,
      vendorsWithSales: vendorsWithSales.length,
      vendorsWithPending: vendorList.filter((v) => v.pending > 0).length,
      zonesWithStores: zoneList.filter((z) => z.stores > 0 && z.zoneKey !== UNASSIGNED_ZONE).length,
      totalZones: zoneList.filter((z) => z.zoneKey !== UNASSIGNED_ZONE).length,
      darkStores: storeInfo.size,
      topVendorShare: vendorList[0]?.shareOfCommission || 0,
      top5Share: round2(vendorList.slice(0, 5).reduce((s, v) => s + v.shareOfCommission, 0)),
    },
    vendors: vendorList,
    zones: zoneList,
    trend,
    rateBands,
    statusBreakdown,
    typeBreakdown,
    paymentMethods: paymentMethods.map((m) => ({
      method: m._id || "Not specified",
      amount: Math.round(m.amount),
      count: m.count,
    })),
  };
}
