import '../../models/cart_item.dart';
import '../../models/store_settings.dart';
import 'department_utils.dart';

class CartSummary {
  const CartSummary({
    required this.subtotal,
    required this.shipping,
    required this.total,
    required this.itemCount,
    required this.shippingFree,
    required this.savings,
  });

  final double subtotal;
  final double shipping;
  final double total;
  final int itemCount;
  final bool shippingFree;
  final double savings;
}

double calculateCartSavings(List<CartItem> items) {
  return items.fold<double>(0, (sum, item) {
    final original = item.price > 0 ? item.price : item.discountedPrice;
    final diff = (original - item.discountedPrice).clamp(0.0, double.infinity);
    return sum + diff * item.quantity;
  });
}

/// Mirrors backend `calculateShippingCharge`: the highest slab the subtotal
/// reaches wins, otherwise the minimum shipping charge.
double shippingChargeFor(double subtotal, StoreSettings settings) {
  final slabs = [...settings.shippingSlabs]
    ..sort((a, b) => a.orderAmount.compareTo(b.orderAmount));
  var charge = settings.minimumShippingCharge;
  for (final slab in slabs) {
    if (subtotal >= slab.orderAmount) charge = slab.shippingCharge;
  }
  return charge < 0 ? 0 : charge;
}

/// Next slab that lowers the delivery fee, e.g. "add ₹X for FREE delivery".
StoreShippingSlab? nextCheaperShippingSlab(double subtotal, StoreSettings settings) {
  final current = shippingChargeFor(subtotal, settings);
  final slabs = [...settings.shippingSlabs]
    ..sort((a, b) => a.orderAmount.compareTo(b.orderAmount));
  for (final slab in slabs) {
    if (slab.orderAmount > subtotal && slab.shippingCharge < current) return slab;
  }
  return null;
}

/// Order value from which delivery is free, if the store has such a slab.
double? freeDeliveryThreshold(StoreSettings settings) {
  final slabs = settings.shippingSlabs.where((s) => s.shippingCharge <= 0).toList()
    ..sort((a, b) => a.orderAmount.compareTo(b.orderAmount));
  return slabs.isEmpty ? null : slabs.first.orderAmount;
}

/// Without [settings] (still loading) the delivery fee is left at zero and
/// not marked free; callers show it as pending.
CartSummary calculateCartSummary(List<CartItem> items, {StoreSettings? settings}) {
  final itemCount = items.fold<int>(0, (sum, item) => sum + item.quantity);
  final subtotal = items.fold<double>(0, (sum, item) => sum + item.lineTotal);
  final shipping = settings == null ? 0.0 : shippingChargeFor(subtotal, settings);
  final shippingFree = settings != null && shipping <= 0;
  return CartSummary(
    subtotal: subtotal,
    shipping: shipping,
    total: subtotal + shipping,
    itemCount: itemCount,
    shippingFree: shippingFree,
    savings: calculateCartSavings(items),
  );
}

/// Applies a coupon discount to the summary total. Shipping stays based on
/// the pre-coupon subtotal (mirrors backend `computeOrderPricing`).
CartSummary applyCouponDiscount(CartSummary summary, double couponDiscount) {
  final discount = couponDiscount.clamp(0.0, summary.subtotal);
  if (discount <= 0) return summary;
  return CartSummary(
    subtotal: summary.subtotal,
    shipping: summary.shipping,
    total: (summary.subtotal - discount) + summary.shipping,
    itemCount: summary.itemCount,
    shippingFree: summary.shippingFree,
    savings: summary.savings,
  );
}

/// Replaces the local delivery estimate with the fee priced by the server
/// (vendor zone / dark-store shipping rules).
CartSummary applyServerShipping(CartSummary summary, double shipping) {
  final fee = shipping < 0 ? 0.0 : shipping;
  return CartSummary(
    subtotal: summary.subtotal,
    shipping: fee,
    total: summary.total - summary.shipping + fee,
    itemCount: summary.itemCount,
    shippingFree: fee <= 0,
    savings: summary.savings,
  );
}

/// Store pickup has no delivery charge (mirrors backend `computeOrderPricing`).
CartSummary applyStorePickup(CartSummary summary, {required bool pickup}) {
  if (!pickup || summary.shipping <= 0) return summary;
  return CartSummary(
    subtotal: summary.subtotal,
    shipping: 0,
    total: summary.total - summary.shipping,
    itemCount: summary.itemCount,
    shippingFree: true,
    savings: summary.savings,
  );
}

/// Cart lines grouped by department, in Pre-order → Ready2Cook → Instant order.
Map<String, List<CartItem>> groupCartByDepartment(List<CartItem> items) {
  final groups = <String, List<CartItem>>{};
  for (final item in items) {
    groups.putIfAbsent(item.department, () => []).add(item);
  }
  return {
    for (final dept in Department.ordered)
      if (groups.containsKey(dept)) dept: groups[dept]!,
  };
}

bool meetsMinimumOrder(double subtotal, double minimumOrderValue) {
  return subtotal >= minimumOrderValue;
}

double minimumOrderShortfall(double subtotal, double minimumOrderValue) {
  if (meetsMinimumOrder(subtotal, minimumOrderValue)) return 0;
  return minimumOrderValue - subtotal;
}

double minimumOrderProgress(double subtotal, double minimumOrderValue) {
  if (minimumOrderValue <= 0) return 1;
  return (subtotal / minimumOrderValue).clamp(0.0, 1.0);
}
