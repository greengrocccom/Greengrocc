const DAY = 86400000;
const OFFSET = 19800000;
export const indiaDay = (value) => new Date(new Date(value).getTime() + OFFSET).toISOString().slice(0, 10);
const midnight = (day) => new Date(`${day}T00:00:00+05:30`);
export function salesRange(query = {}, now = new Date()) {
  const today = indiaDay(now);
  const base = midnight(today);
  let from = new Date(base), to = new Date(base.getTime() + DAY);
  const range = query.range || 'month';
  const local = new Date(base.getTime() + OFFSET);
  if (range === 'yesterday') { from = new Date(base.getTime() - DAY); to = base; }
  else if (range === 'week') from = new Date(base.getTime() - ((local.getUTCDay() + 6) % 7) * DAY);
  else if (range === '7d' || range === '30d') from = new Date(base.getTime() - (range === '7d' ? 6 : 29) * DAY);
  else if (range === 'month') from = midnight(`${today.slice(0, 7)}-01`);
  else if (range === 'last_month') {
    to = midnight(`${today.slice(0, 7)}-01`);
    const previous = new Date(to.getTime() - DAY);
    from = midnight(`${indiaDay(previous).slice(0, 7)}-01`);
  } else if (range === 'year') from = midnight(`${today.slice(0, 4)}-01-01`);
  else if (range === 'custom') {
    for (const key of ['startDate', 'endDate']) {
      const value = query[key];
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(midnight(value).getTime()) || indiaDay(midnight(value)) !== value) throw new Error('Enter valid start and end dates.');
    }
    from = midnight(query.startDate);
    to = new Date(midnight(query.endDate).getTime() + DAY);
  } else if (range !== 'today') throw new Error('Invalid sales range.');
  if (to <= from || to - from > 366 * DAY) throw new Error('Choose an ordered date range of up to 366 days.');
  const groupBy = query.groupBy || 'day';
  if (!['day', 'week', 'month'].includes(groupBy)) throw new Error('Invalid sales grouping.');
  return { from, to, range, groupBy };
}
function bucketKey(value, groupBy) {
  const day = indiaDay(value);
  if (groupBy === 'month') return day.slice(0, 7);
  if (groupBy === 'week') {
    const date = midnight(day);
    const weekday = new Date(date.getTime() + OFFSET).getUTCDay();
    return indiaDay(new Date(date.getTime() - ((weekday + 6) % 7) * DAY));
  }
  return day;
}
export function summarizeSales(rows, stores, period) {
  const empty = () => ({ orders: 0, delivered: 0, cancelled: 0, sales: 0, pendingValue: 0 });
  const totals = empty(), timeline = new Map();
  const byStore = new Map(stores.map((store) => [String(store._id), { id: String(store._id), name: store.storeName || store.name || 'Dark store', city: store.city, ...empty() }]));
  for (let date = period.from.getTime(); date < period.to.getTime(); date += DAY) {
    const key = bucketKey(new Date(date), period.groupBy);
    if (!timeline.has(key)) timeline.set(key, { key, ...empty() });
  }
  for (const row of rows) {
    if (row.isDeleted || row.deleted || ['deleted', 'attempted'].includes(String(row.status).toLowerCase())) continue;
    const date = new Date(row.createdAt);
    const store = byStore.get(String(row.managerId));
    if (!store || date < period.from || date >= period.to || !Number.isFinite(date.getTime())) continue;
    const bucket = timeline.get(bucketKey(date, period.groupBy));
    const status = String(row.status).toLowerCase();
    const cancelled = ['cancelled', 'delivery_failed', 'returned', 'return', 'refunded'].includes(status);
    const amount = Math.max(0, Number(row.partTotal ?? (row.items || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0)) || 0);
    for (const metric of [totals, store, bucket]) {
      metric.orders++;
      if (cancelled) metric.cancelled++;
      else if (status === 'delivered') { metric.delivered++; metric.sales += amount; }
      else metric.pendingValue += amount;
    }
  }
  const rounded = (metric) => ({ ...metric, sales: Math.round(metric.sales * 100) / 100, pendingValue: Math.round(metric.pendingValue * 100) / 100, aov: metric.delivered ? Math.round(metric.sales / metric.delivered * 100) / 100 : 0 });
  return { totals: rounded(totals), timeline: [...timeline.values()].map(rounded), stores: [...byStore.values()].map(rounded).sort((a, b) => b.sales - a.sales) };
}
