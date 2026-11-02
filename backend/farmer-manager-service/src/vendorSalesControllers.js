import DeliveryManager from '../../delivery-service/src/models/DeliveryManager.js';
import StoreOrder from '../../delivery-service/src/models/StoreOrder.js';
import Order from '../../legacy/models/order/Order.js';
import { salesRange, summarizeSales, indiaDay } from './vendorSalesSummary.js';

export async function getVendorSales(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    if (!vendorId) return res.status(403).json({ message: 'Vendor identity required.' });
    let period;
    try { period = salesRange(req.query); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    const active = { isDeleted: { $ne: true }, deleted: { $ne: true }, status: { $nin: ['deleted', 'DELETED'] } };
    const allStores = await DeliveryManager.find({ vendorId, ...active }).select('_id storeName name city').lean();
    const selectedId = String(req.query.storeId || 'all');
    const stores = selectedId === 'all' ? allStores : allStores.filter((store) => String(store._id) === selectedId);
    if (selectedId !== 'all' && !stores.length) return res.status(404).json({ message: 'Dark store not found.' });
    const rows = stores.length ? await StoreOrder.aggregate([
      { $match: { managerId: { $in: stores.map((store) => store._id) }, createdAt: { $gte: period.from, $lt: period.to }, ...active } },
      { $lookup: { from: Order.collection.name, localField: 'sourceOrderId', foreignField: '_id', as: 'source' } },
      { $match: { $or: [{ sourceOrderId: null }, { source: { $elemMatch: { ...active, status: { $nin: ['attempted', 'deleted', 'DELETED'] } } } }] } },
      { $project: { managerId: 1, status: 1, partTotal: 1, items: 1, createdAt: 1 } },
    ]) : [];
    res.json({ ...summarizeSales(rows, stores, period), filterOptions: allStores.map((store) => ({ id: String(store._id), name: store.storeName || store.name || 'Dark store' })), filters: { range: period.range, groupBy: period.groupBy, startDate: indiaDay(period.from), endDate: indiaDay(new Date(period.to.getTime() - 1)), storeId: selectedId }, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[vendor sales]', error);
    res.status(500).json({ message: 'Failed to load sales summary.' });
  }
}
