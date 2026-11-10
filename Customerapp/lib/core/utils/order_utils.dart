import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/order.dart';

typedef OrderBillLine = ({String label, double amount});

/// Discounts and fees saved on an order besides item total, coupon, reward
/// points and delivery. Any gap to `order.total` (orders saved before offer
/// discounts were recorded) shows as "Other discount" so the bill adds up.
List<OrderBillLine> orderBillAdjustments(Order order) {
  final lines = <OrderBillLine>[
    if (order.giftCardDiscount > 0)
      (
        label: 'Gift card (${order.giftCardCode.isEmpty ? 'Applied' : order.giftCardCode})',
        amount: -order.giftCardDiscount,
      ),
    if (order.dynamicDiscount > 0) (label: 'Offer discount', amount: -order.dynamicDiscount),
    if (order.heavyHandlingFee > 0) (label: 'Heavy item handling', amount: order.heavyHandlingFee),
    if (order.packagingFee > 0) (label: 'Packaging fee', amount: order.packagingFee),
  ];
  final expected = order.subtotal -
      order.couponDiscount -
      order.rewardDiscount +
      order.deliveryCharges +
      lines.fold<double>(0, (sum, line) => sum + line.amount);
  final gap = ((order.total - expected) * 100).round() / 100;
  if (gap <= -0.5) lines.add((label: 'Other discount', amount: gap));
  if (gap >= 0.5) lines.add((label: 'Other charges', amount: gap));
  return lines;
}

const orderStatusLabels = <String, String>{
  'attempted': 'Attempted',
  'confirm': 'Confirm',
  'processing': 'Processing',
  'shipping': 'Shipping',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'return': 'Return',
  'pending': 'Confirm',
  'confirmed': 'Confirm',
  'shipped': 'Shipping',
};

const paymentStatusLabels = <String, String>{
  'paid': 'Paid',
  'paid_10': 'Paid 10%',
  'unpaid': 'Unpaid',
  'refundable': 'Refundable',
  'pending_verification': 'Payment verification pending',
};

const orderSteps = [
  'Confirm',
  'Processing',
  'Shipping',
  'Delivered',
  'Cancelled',
  'Return',
];

const orderStatusStepIndex = <String, int>{
  'attempted': -1,
  'confirm': 0,
  'processing': 1,
  'shipping': 2,
  'delivered': 3,
  'cancelled': 4,
  'return': 5,
  'pending': 0,
  'confirmed': 0,
  'shipped': 2,
};

String getOrderStatusLabel(String status) {
  return orderStatusLabels[status] ?? status;
}

String getOrderPaymentStatus(Order order) {
  return order.paymentStatus.isNotEmpty ? order.paymentStatus : 'unpaid';
}

String getOrderPaymentLabel(Order order) {
  final status = getOrderPaymentStatus(order);
  return paymentStatusLabels[status] ?? status;
}

bool showOrderPaymentBadge(Order order) {
  final status = getOrderPaymentStatus(order);
  return status != 'unpaid' || order.paymentStatus == 'pending_verification';
}

Color getOrderStatusColor(String status) {
  switch (status) {
    case 'attempted':
      return Colors.amber.shade700;
    case 'processing':
      return Colors.purple;
    case 'shipping':
    case 'shipped':
      return Colors.indigo;
    case 'delivered':
      return Colors.green;
    case 'cancelled':
      return Colors.red;
    case 'return':
      return Colors.amber.shade700;
    default:
      return Colors.blue;
  }
}

Color getOrderPaymentColor(Order order) {
  final status = getOrderPaymentStatus(order);
  if (status == 'paid_10') return Colors.lightGreen.shade800;
  if (status == 'paid') return Colors.green;
  if (status == 'refundable') return Colors.orange;
  if (status == 'pending_verification') return Colors.amber.shade800;
  return Colors.amber;
}

String formatOrderDate(DateTime? date) {
  if (date == null) return '—';
  return DateFormat('d MMM y').format(date);
}

String formatOrderDateTime(DateTime? date) {
  if (date == null) return '—';
  return DateFormat('d MMM y, hh:mm a').format(date);
}

String formatPlacedAtLabel(DateTime? date) {
  if (date == null) return 'Placed recently';
  final day = date.day;
  final suffix = _ordinalSuffix(day);
  final monthYearTime = DateFormat('MMM y, hh:mm a').format(date);
  return 'Placed at $day$suffix $monthYearTime';
}

String getBlinkitStatusLabel(String status) {
  switch (status) {
    case 'delivered':
      return 'Order delivered';
    case 'shipping':
    case 'shipped':
      return 'Order on the way';
    case 'processing':
      return 'Order being prepared';
    case 'cancelled':
      return 'Order cancelled';
    case 'return':
      return 'Order returned';
    default:
      return 'Order confirmed';
  }
}

String _ordinalSuffix(int day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

String formatOrderHistoryDateTime(DateTime? date) {
  if (date == null) return '—';
  final formatted = DateFormat('dd MMM, h:mm a').format(date);
  // Convert AM/PM to lowercase am/pm like screenshot
  return formatted.replaceAll('AM', 'am').replaceAll('PM', 'pm');
}

String formatOrderPlacedDetailDateTime(DateTime? date) {
  if (date == null) return '—';
  final formatted = DateFormat("E, d MMM''yy, h:mm a").format(date);
  return 'placed on $formatted';
}

String getOrderMessage(Order order) {
  final text = (order.customerMessage.isNotEmpty
          ? order.customerMessage
          : order.message)
      .trim();
  return text.isEmpty ? '—' : text;
}

String? getPrimaryProductId(Order order) {
  if (order.items.isEmpty) return null;
  final id = order.items.first.productId;
  return id.isEmpty ? null : id;
}
