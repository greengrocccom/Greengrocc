export function customerLocation(order) {
  const address = order.sourceAddress || {};
  const clean = (value) => String(value || '').trim().replace(/\s+/g, ' ');
  const area = clean(address.area || address.locality) || 'Unknown area';
  const pincode = clean(address.pincode);
  const city = clean(address.city);
  return { area, pincode, city, areaKey: JSON.stringify([area.toLowerCase(), pincode, city.toLowerCase()]) };
}
export function buildOrderManagement(rows, stores, query = {}) {
  const storeMap = new Map(stores.map((store) => [String(store._id), store]));
  const orders = rows.map((row) => ({
    ...row, id: String(row._id), storeId: String(row.managerId),
    storeName: storeMap.get(String(row.managerId))?.storeName || storeMap.get(String(row.managerId))?.name || 'Dark store',
    ...customerLocation(row),
    amount: Math.max(0, Number(row.partTotal ?? (row.items || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0)) || 0),
  })).filter((row) => storeMap.has(row.storeId) && !row.deleted && !row.isDeleted && !['deleted', 'attempted'].includes(String(row.status).toLowerCase()));
  const search = String(query.search || '').trim().toLowerCase();
  const scoped = orders.filter((row) =>
    (!query.status || query.status === 'all' || row.status === query.status) &&
    (!query.payment || query.payment === 'all' || String(row.paymentMethod).toLowerCase() === String(query.payment).toLowerCase()) &&
    (!query.fulfillment || query.fulfillment === 'all' || row.fulfillmentType === query.fulfillment) &&
    (!search || [row.orderNumber, row.customerName, row.customerPhone, row.area, row.pincode, row.storeName].some((value) => String(value || '').toLowerCase().includes(search)))
  );
  const areas = new Map(), statusCounts = {}, unique = new Set();
  let sales = 0, pending = 0, cancelled = 0;
  const failed = (status) => ['cancelled', 'delivery_failed', 'returned', 'return', 'refunded'].includes(status);
  for (const row of scoped) {
    const identity = String(row.sourceOrderId || row.id);
    unique.add(identity);
    statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    if (row.status === 'delivered') sales += row.amount;
    else if (failed(row.status)) cancelled++;
    else pending++;
    // Store-pickup orders are not evidence of delivery demand in an area.
    if (row.fulfillmentType === 'pickup') continue;
    const key = `${row.storeId}:${row.areaKey}`;
    if (!areas.has(key)) areas.set(key, { key, storeId: row.storeId, storeName: row.storeName, areaKey: row.areaKey, area: row.area, pincode: row.pincode, city: row.city, orders: new Set(), delivered: new Set(), sales: 0 });
    const metric = areas.get(key);
    metric.orders.add(identity);
    if (row.status === 'delivered') { metric.delivered.add(identity); metric.sales += row.amount; }
  }
  const storeTotals = new Map();
  for (const row of scoped.filter((row) => row.fulfillmentType !== 'pickup')) {
    if (!storeTotals.has(row.storeId)) storeTotals.set(row.storeId, new Set());
    storeTotals.get(row.storeId).add(String(row.sourceOrderId || row.id));
  }
  const areaDemand = [...areas.values()].map((row) => ({ ...row, orders: row.orders.size, delivered: row.delivered.size, share: Math.round(row.orders.size / storeTotals.get(row.storeId).size * 1000) / 10, sales: Math.round(row.sales * 100) / 100 })).sort((a, b) => b.orders - a.orders || b.sales - a.sales || a.area.localeCompare(b.area));
  const filtered = scoped.filter((row) => !query.areaKey || (row.fulfillmentType !== 'pickup' && row.areaKey === query.areaKey)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const pageSize = 30;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(query.page) || 1)));
  return { summary: { customerOrders: unique.size, orderParts: scoped.length, sales: Math.round(sales * 100) / 100, pending, cancelled }, statusCounts, areaDemand, orders: filtered.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pages, pageSize, total: filtered.length }, statusOptions: [...new Set(orders.map((row) => row.status))].sort() };
}
