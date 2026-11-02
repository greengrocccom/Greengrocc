import DeliveryManager from '../../delivery-service/src/models/DeliveryManager.js';
import StoreOrder from '../../delivery-service/src/models/StoreOrder.js';
import Order from '../../legacy/models/order/Order.js';
import { salesRange, indiaDay } from './vendorSalesSummary.js';
import { buildOrderManagement } from './vendorOrderSummary.js';

export async function getVendorOrderManagement(req, res) {
  try {
    const vendorId = req.user?.vendorId || req.user?.id;
    if (!vendorId) return res.status(403).json({ message: 'Vendor identity required.' });
    let period;
    try { period = salesRange({ ...req.query, groupBy: 'day' }); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    const active = { isDeleted: { $ne: true }, deleted: { $ne: true }, status: { $nin: ['deleted', 'DELETED', 'attempted'] } };
    const allStores = await DeliveryManager.find({ vendorId, ...active }).select('_id storeName name city area pincode').lean();
    const storeId = String(req.query.storeId || 'all');
    const stores = storeId === 'all' ? allStores : allStores.filter((store) => String(store._id) === storeId);
    if (storeId !== 'all' && !stores.length) return res.status(404).json({ message: 'Dark store not found.' });
    const rows = stores.length ? await StoreOrder.aggregate([
      { $match: { ...active, managerId: { $in: stores.map((store) => store._id) }, createdAt: { $gte: period.from, $lt: period.to } } },
      { $lookup: { from: Order.collection.name, localField: 'sourceOrderId', foreignField: '_id', as: 'source' } },
      { $match: { $or: [{ sourceOrderId: null }, { source: { $elemMatch: active } }] } },
      { $project: { orderNumber: 1, managerId: 1, sourceOrderId: 1, sourceAddress: { $arrayElemAt: ['$source.deliveryAddress', 0] }, customerName: 1, customerPhone: 1, customerAddress: 1, status: 1, assignmentStatus: 1, fulfillmentType: 1, isPreOrder: 1, preOrderSlot: 1, paymentMethod: 1, paymentStatus: 1, partTotal: 1, amountToCollect: 1, amountCollected: 1, items: 1, createdAt: 1, packedAt: 1, assignedAt: 1, deliveredAt: 1, failureReason: 1, notes: 1, distanceKm: 1 } },
    ]) : [];
    const result = buildOrderManagement(rows, stores, req.query);
    // Address snapshot was needed for location resolution, not for the response.
    result.orders = result.orders.map(({ sourceAddress, ...row }) => row);
    res.json({ ...result, stores: allStores.map((store) => ({ id: String(store._id), name: store.storeName || store.name, location: [store.area, store.city, store.pincode].filter(Boolean).join(', ') })), filters: { startDate: indiaDay(period.from), endDate: indiaDay(new Date(period.to.getTime() - 1)) } });
  } catch (error) {
    console.error('[vendor orders]', error);
    res.status(500).json({ message: 'Unable to load order management.' });
  }
}
