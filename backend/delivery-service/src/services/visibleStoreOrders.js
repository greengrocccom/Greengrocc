import StoreOrder from '../models/StoreOrder.js';
import CustomerOrder from '../../../legacy/models/order/Order.js';

/** Hide customer-order copies whose source was deleted, including direct MongoDB deletes.
 * Standalone/manual store orders without a source remain visible.
 * Scope the lookup to the manager or list being read instead of scanning every customer order.
 */
export async function visibleStoreOrderScope(scope = {}) {
  const sourceIds = await StoreOrder.distinct('sourceOrderId', {
    $and: [scope, { sourceOrderId: { $ne: null } }],
  });
  const existing = sourceIds.length
    ? await CustomerOrder.distinct('_id', { _id: { $in: sourceIds } })
    : [];
  return {
    $and: [scope, { $or: [{ sourceOrderId: null }, { sourceOrderId: { $in: existing } }] }],
  };
}
