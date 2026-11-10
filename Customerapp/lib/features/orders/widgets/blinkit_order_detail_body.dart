import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../config/theme.dart';
import '../../../core/utils/address_utils.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/external_link.dart';
import '../../../core/utils/order_number.dart';
import '../../../core/utils/order_utils.dart';
import '../../../models/order.dart';
import '../../../widgets/common/app_network_image.dart';
import '../../../widgets/common/product_3d_image.dart';
import '../../checkout/checkout_fulfillment_widgets.dart';
import '../delivery_rating_controller.dart';
import '../feedback/order_feedback_sheet.dart';
import 'delivery_otp_resend_button.dart';
import 'preorder_manage_card.dart';

const _themeGreen = Color(0xFF2E7D32);
const _billBg = Color(0xFFFFFFFF);
const _tabSelectedBg = Color(0xFFEEF0F4);

/// Dark-store home deliveries get the live tracking panel (map for Ready to Cook /
/// Instant, timeline only for pre-orders). Courier and pickup orders keep the old tracker.
bool _usesDarkStoreTracking(Order order) {
  if (order.isPickup || order.shipment.hasTracking) return false;
  return order.darkStore != null || order.storeParts.isNotEmpty;
}

List<List<OrderItem>> splitOrderShipments(List<OrderItem> items) {
  if (items.length <= 6) return [items];
  final mid = (items.length / 2).ceil();
  return [items.sublist(0, mid), items.sublist(mid)];
}

String getOrderDisplayCode(Order order) {
  final number = order.orderNumber.trim();
  if (number.isNotEmpty) return number;
  return getOrderNumber(order);
}

/// Home deliveries show the OTP once out for delivery (when it is SMSed);
/// store pickups show it while the order is active.
bool _shouldShowDeliveryOtp(Order order) {
  final otp = order.deliveryOtp.trim();
  if (otp.isEmpty) return false;
  if (order.isPickup) {
    return const {'confirm', 'processing', 'shipping'}.contains(order.status);
  }
  return order.status == 'shipping';
}

class _DeliveryOtpBanner extends StatelessWidget {
  const _DeliveryOtpBanner({required this.otp, required this.orderId, this.pickup = false});

  final String otp;
  final String orderId;
  final bool pickup;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
        decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFA7F3D0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              pickup ? 'PICKUP OTP' : 'DELIVERY OTP',
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
                color: Color(0xFF065F46),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              pickup
                  ? 'Show this code at the dark store counter to collect your order.'
                  : 'Your order is out for delivery. We sent this code to your phone by SMS — '
                      'share it with the delivery partner to receive your items.',
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF047857),
              ),
            ),
            const SizedBox(height: 4),
            SelectableText(
              otp,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                letterSpacing: 4,
                color: Color(0xFF064E3B),
                fontFamily: 'monospace',
              ),
            ),
            const SizedBox(height: 2),
            Row(
              children: [
                TextButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: otp));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Delivery OTP copied')),
                    );
                  },
                  icon: const Icon(Icons.copy_rounded, size: 16),
                  label: const Text('Copy OTP'),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF065F46),
                    padding: EdgeInsets.zero,
                  ),
                ),
                const Spacer(),
                if (!pickup) DeliveryOtpResendButton(orderId: orderId),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _pickupStatusLabel(String status) {
  switch (status) {
    case 'delivered':
      return 'Picked up';
    case 'shipping':
    case 'shipped':
      return 'Ready for pickup';
    case 'processing':
      return 'Preparing';
    case 'cancelled':
      return 'Cancelled';
    case 'return':
      return 'Return';
    default:
      return 'Confirmed';
  }
}

String _storePartStatusLabel(String status, {bool pickup = false}) {
  if (pickup) {
    if (status == 'packed') return 'Ready for pickup';
    if (status == 'delivered') return 'Picked up';
  }
  switch (status) {
    case 'preorder_hold':
      return 'Scheduled';
    case 'order_received':
    case 'incoming':
      return 'Received by store';
    case 'packed':
      return 'Packed';
    case 'offered':
    case 'assigned':
    case 'pickup_verified':
      return 'Rider assigned';
    case 'out_for_delivery':
      return 'Out for delivery';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status.replaceAll('_', ' ');
  }
}

/// Dark store contact, delivery vs pickup, and the separate parts of a mixed cart.
class _FulfillmentInfo extends StatelessWidget {
  const _FulfillmentInfo({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final parts = order.storeParts;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                order.isPickup ? Icons.storefront_rounded : Icons.delivery_dining_rounded,
                size: 18,
                color: _themeGreen,
              ),
              const SizedBox(width: 6),
              Text(
                order.isPickup ? 'Store pickup' : 'Home delivery',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (order.isPickup && order.darkStore != null)
            DarkStoreContactCard(store: order.darkStore, pickup: true),
          if (parts.length > 1) ...[
            const SizedBox(height: 8),
            for (final part in parts)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Icon(
                      part.isPreOrder ? Icons.event_available_rounded : Icons.bolt_rounded,
                      size: 16,
                      color: part.isPreOrder ? const Color(0xFF047857) : const Color(0xFF7C3AED),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        part.isPreOrder
                            ? 'Pre-order · ${part.preOrderDate} ${part.preOrderSlot}'.trim()
                            : 'Ready2Cook / Instant · 10–20 min',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                      ),
                    ),
                    Text(
                      part.isPreOrder && part.preOrderProgressLabel.isNotEmpty
                          ? part.preOrderProgressLabel
                          : _storePartStatusLabel(part.status, pickup: order.isPickup),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class BlinkitOrderDetailBody extends ConsumerStatefulWidget {
  const BlinkitOrderDetailBody({
    super.key,
    required this.order,
    required this.onInvoice,
    required this.onOrderAgain,
    this.onTrackingStatusChanged,
  });

  final Order order;
  final VoidCallback onInvoice;
  final VoidCallback onOrderAgain;
  final VoidCallback? onTrackingStatusChanged;

  @override
  ConsumerState<BlinkitOrderDetailBody> createState() =>
      _BlinkitOrderDetailBodyState();
}

class _BlinkitOrderDetailBodyState extends ConsumerState<BlinkitOrderDetailBody> {
  int _selectedShipment = 0;

  @override
  void initState() {
    super.initState();
    _promptFeedbackIfDelivered();
  }

  @override
  void didUpdateWidget(covariant BlinkitOrderDetailBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.order.status != widget.order.status) _promptFeedbackIfDelivered();
  }

  void _promptFeedbackIfDelivered() {
    if (widget.order.status != 'delivered') return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) maybePromptOrderFeedback(context, ref, widget.order.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;

    final shipments = splitOrderShipments(order.items);
    final shipmentItems = shipments[_selectedShipment.clamp(0, shipments.length - 1)];
    final deliveryRating = ref.watch(deliveryRatingProvider(order.id));
    final orderCode = getOrderDisplayCode(order);
    final statusLabel = order.isPickup
        ? _pickupStatusLabel(order.status)
        : getBlinkitShipmentStatusLabel(
            order.status,
            shipmentStatus: order.shipment.displayStatus,
            hasTracking: order.shipment.hasTracking,
          );

    return Column(
      children: [
        _DetailHeader(
          onBack: () => context.pop(),
          onDelete: () => _showDeleteConfirmation(context),
        ),
        if (shipments.length > 1)
          _ShipmentTabs(
            count: shipments.length,
            selected: _selectedShipment,
            onSelected: (index) => setState(() => _selectedShipment = index),
          ),
        Expanded(
          child: ColoredBox(
            color: const Color(0xFFF8F9FA),
            child: ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                if (order.shipment.hasTracking && order.shipment.trackUrl.trim().isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => openExternalUrl(
                          order.shipment.trackUrl,
                          context: context,
                          errorMessage: 'Could not open tracking link.',
                        ),
                        icon: const Icon(Icons.open_in_new_rounded, size: 18),
                        label: const Text('Open live tracking'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _themeGreen,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ),
                ],
                if (order.status == 'delivered')
                  _RatingBanner(
                    rating: deliveryRating,
                    onRateNow: () => showOrderFeedbackSheet(context, ref, order.id),
                  ),
                if (_shouldShowDeliveryOtp(order))
                  _DeliveryOtpBanner(
                    otp: order.deliveryOtp,
                    orderId: order.id,
                    pickup: order.isPickup,
                  ),
                if (order.darkStore != null || order.storeParts.length > 1)
                  _FulfillmentInfo(order: order),
                if (PreOrderManageCard.appliesTo(order))
                  PreOrderManageCard(
                    order: order,
                    onChanged: () => widget.onTrackingStatusChanged?.call(),
                  ),
                _ShipmentStatusBlock(
                  shipmentNumber: _selectedShipment + 1,
                  statusLabel: statusLabel,
                  isDelivered: order.status == 'delivered',
                ),
                if (_usesDarkStoreTracking(order) &&
                    order.status != 'delivered' &&
                    order.status != 'cancelled' &&
                    order.status != 'return') ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF047857), Color(0xFF065F46)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF047857).withValues(alpha: 0.2),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: () => context.push('/orders/${order.id}/track'),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.2),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.pedal_bike_rounded,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: const [
                                      Text(
                                        'Track Order Live',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      SizedBox(height: 2),
                                      Text(
                                        'View real-time delivery status & map',
                                        style: TextStyle(
                                          color: Color(0xFFD1FAE5),
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(
                                  Icons.arrow_forward_ios_rounded,
                                  color: Colors.white,
                                  size: 15,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                  child: _OrderStatusTracker(status: order.status, pickup: order.isPickup),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                  child: Text(
                    '${shipmentItems.length} item${shipmentItems.length == 1 ? '' : 's'} in shipment',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                ...shipmentItems.map(
                  (item) => _ShipmentItemRow(item: item),
                ),
                const SizedBox(height: 12),
                _BillSummary(order: order),
                if (order.giftHamper?.isVisible == true) ...[
                  const SizedBox(height: 16),
                  _GiftHamperSection(giftHamper: order.giftHamper!),
                ],
                const SizedBox(height: 16),
                _OrderDetailsSection(order: order, orderCode: orderCode),
                const SizedBox(height: 16),
                _NeedHelpSection(),
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _DownloadInvoiceButton(onTap: widget.onInvoice),
                ),
              ],
            ),
          ),
        ),
        _BottomOrderAgain(onTap: widget.onOrderAgain),
      ],
    );
  }

  void _showDeleteConfirmation(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Clear Order History?'),
        content: const Text('This will remove this order entry from your recent view.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              context.pop();
            },
            child: const Text('Remove', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

}

class _DetailHeader extends StatelessWidget {
  const _DetailHeader({
    required this.onBack,
    required this.onDelete,
  });

  final VoidCallback onBack;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Container(
        color: Colors.white,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onBack,
                borderRadius: BorderRadius.circular(24),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFE0E0E0)),
                  ),
                  child: const Icon(Icons.arrow_back, size: 20, color: AppColors.textPrimary),
                ),
              ),
            ),
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onDelete,
                borderRadius: BorderRadius.circular(24),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFE0E0E0)),
                  ),
                  child: const Icon(Icons.delete_outline, size: 20, color: AppColors.textPrimary),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShipmentTabs extends StatelessWidget {
  const _ShipmentTabs({
    required this.count,
    required this.selected,
    required this.onSelected,
  });

  final int count;
  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        children: List.generate(count, (index) {
          final isSelected = selected == index;
          return Padding(
            padding: EdgeInsets.only(right: index < count - 1 ? 10 : 0),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => onSelected(index),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? _tabSelectedBg : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Shipment ${index + 1}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected
                          ? AppColors.textPrimary
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _RatingBanner extends StatelessWidget {
  const _RatingBanner({
    required this.rating,
    required this.onRateNow,
  });

  final int? rating;
  final VoidCallback onRateNow;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEEEEEE)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8E1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              Icons.star_rounded,
              color: Colors.amber.shade700,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Rate your delivery & items',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: onRateNow,
            style: FilledButton.styleFrom(
              backgroundColor: _themeGreen,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              minimumSize: const Size(0, 36),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: Text(
              rating != null ? 'Rated $rating★' : 'Rate now',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Schema path: confirm → processing (packed) → shipping → delivered.
/// Cancelled and return are terminal and are not marked done in green.
int _trackerStepIndex(String status) {
  switch (status) {
    case 'confirm':
    case 'pending':
    case 'confirmed':
      return 0;
    case 'processing':
      return 1;
    case 'shipping':
    case 'shipped':
      return 2;
    case 'delivered':
      return 3;
    default:
      return -1;
  }
}

class _OrderStatusTracker extends StatelessWidget {
  const _OrderStatusTracker({required this.status, this.pickup = false});

  final String status;
  final bool pickup;

  static const _deliverySteps = ['Confirm', 'Packed', 'Shipped', 'Delivery'];
  static const _pickupSteps = ['Confirm', 'Packed', 'Ready', 'Picked up'];
  List<String> get _steps => pickup ? _pickupSteps : _deliverySteps;
  static const _done = Color(0xFF16A34A);
  static const _idle = Color(0xFFE5E5E5);
  static const _muted = Color(0xFF999999);

  @override
  Widget build(BuildContext context) {
    if (status == 'cancelled') {
      return const Text(
        'This order was cancelled',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: Color(0xFFDC2626),
        ),
      );
    }
    if (status == 'return') {
      return const Text(
        'This order was returned',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: Color(0xFFD97706),
        ),
      );
    }

    final active = _trackerStepIndex(status);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var step = 0; step < _steps.length; step++)
          Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 2,
                        color: step == 0
                            ? Colors.transparent
                            : (step <= active ? _done : _idle),
                      ),
                    ),
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: step <= active ? _done : Colors.white,
                        border: Border.all(
                          color: step <= active ? _done : _idle,
                          width: 2,
                        ),
                      ),
                      child: step <= active
                          ? const Icon(Icons.check, size: 14, color: Colors.white)
                          : Center(
                              child: Text(
                                '${step + 1}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: _muted,
                                ),
                              ),
                            ),
                    ),
                    Expanded(
                      child: Container(
                        height: 2,
                        color: step == _steps.length - 1
                            ? Colors.transparent
                            : (step < active ? _done : _idle),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  _steps[step],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: step <= active ? _done : _muted,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _ShipmentStatusBlock extends StatelessWidget {
  const _ShipmentStatusBlock({
    required this.shipmentNumber,
    required this.statusLabel,
    required this.isDelivered,
  });

  final int shipmentNumber;
  final String statusLabel;
  final bool isDelivered;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: isDelivered ? _themeGreen : AppColors.navSelected,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(
              isDelivered ? Icons.check : Icons.local_shipping_outlined,
              size: 16,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SHIPMENT $shipmentNumber >',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textMuted,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  statusLabel,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ShipmentItemRow extends StatelessWidget {
  const _ShipmentItemRow({required this.item});

  final OrderItem item;

  @override
  Widget build(BuildContext context) {
    final lineTotal = item.price * item.quantity;
    final unitLabel = item.quantity == 1 ? '1 unit' : '${item.quantity} units';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEEEEEE)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Product3DImage(imageUrl: item.image, size: 52),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${item.quantity} item${item.quantity == 1 ? '' : 's'} · $unitLabel',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatInr(lineTotal, withDecimals: false),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _BillSummary extends StatelessWidget {
  const _BillSummary({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final deliveryFree = order.deliveryCharges == 0;
    final adjustments = orderBillAdjustments(order);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _billBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEEEEEE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Bill details',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 14),
          _BillRow(
            label: 'Item total',
            value: formatInrExact(order.subtotal),
          ),
          if (order.couponDiscount > 0) ...[
            const SizedBox(height: 10),
            _BillRow(
              label: 'Coupon discount (${order.couponCode.isEmpty ? 'Applied' : order.couponCode})',
              value: '-${formatInrExact(order.couponDiscount)}',
              valueColor: _themeGreen,
            ),
          ],
          if (order.rewardDiscount > 0) ...[
            const SizedBox(height: 10),
            _BillRow(
              label: 'Reward points discount (${order.rewardPointsUsed} pts)',
              value: '-${formatInrExact(order.rewardDiscount)}',
              valueColor: _themeGreen,
            ),
          ],
          const SizedBox(height: 10),
          _BillRow(
            label: order.isPickup ? 'Store pickup' : 'Delivery fee',
            value: deliveryFree || order.isPickup ? 'FREE' : formatInrExact(order.deliveryCharges),
            valueColor: deliveryFree || order.isPickup ? _themeGreen : null,
          ),
          for (final line in adjustments) ...[
            const SizedBox(height: 10),
            _BillRow(
              label: line.label,
              value: '${line.amount < 0 ? '-' : ''}${formatInrExact(line.amount.abs())}',
              valueColor: line.amount < 0 ? _themeGreen : null,
            ),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: Color(0xFFEEEEEE)),
          ),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Bill total',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Text(
                formatInr(order.total, withDecimals: false),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BillRow extends StatelessWidget {
  const _BillRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: valueColor ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _GiftHamperSection extends StatelessWidget {
  const _GiftHamperSection({required this.giftHamper});

  final OrderGiftHamper giftHamper;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8F0),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF5D0A8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Row(
              children: [
                const Text('🎁', style: TextStyle(fontSize: 18)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Gift Hamper',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'This complimentary gift is included with your order.',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0x0D000000)),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFF5D0A8)),
                  ),
                  child: giftHamper.giftImage.trim().isNotEmpty
                      ? AppNetworkImage(
                          imageUrl: giftHamper.giftImage,
                          fit: BoxFit.contain,
                          width: 56,
                          height: 56,
                        )
                      : const Center(
                          child: Text('🎁', style: TextStyle(fontSize: 24)),
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        giftHamper.giftName,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (giftHamper.giftDescription.trim().isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          giftHamper.giftDescription,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderDetailsSection extends StatelessWidget {
  const _OrderDetailsSection({
    required this.order,
    required this.orderCode,
  });

  final Order order;
  final String orderCode;

  @override
  Widget build(BuildContext context) {
    final addr = order.deliveryAddress;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEEEEEE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Order details',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          _DetailField(
            label: 'Order id',
            value: orderCode,
            trailing: InkWell(
              onTap: () {
                Clipboard.setData(ClipboardData(text: orderCode));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Order ID copied'),
                    behavior: SnackBarBehavior.floating,
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: const Padding(
                padding: EdgeInsets.only(left: 6),
                child: Icon(Icons.copy_rounded, size: 16, color: AppColors.textSecondary),
              ),
            ),
          ),
          _DetailField(
            label: 'Payment',
            value: order.paymentMethod == 'cod'
                ? (order.isPickup ? 'Pay at store' : 'Cash on Delivery')
                : 'Paid Online',
          ),
          if (order.isPickup) ...[
            _DetailField(
              label: 'Pick up from',
              value: [
                order.darkStore?.storeName ?? 'Dark store',
                if ((order.darkStore?.address ?? '').isNotEmpty) order.darkStore!.address,
              ].join('\n'),
            ),
            if ((order.darkStore?.phone ?? '').isNotEmpty)
              _DetailField(
                label: 'Store manager',
                value: '+91 ${order.darkStore!.phone}',
              ),
          ] else
            _DetailField(
              label: 'Deliver to',
              value: formatAddressLine(addr),
            ),
          _DetailField(
            label: 'Order placed',
            value: formatOrderPlacedDetailDateTime(order.createdAt),
          ),
        ],
      ),
    );
  }
}

class _DetailField extends StatelessWidget {
  const _DetailField({
    required this.label,
    required this.value,
    this.trailing,
  });

  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                    height: 1.35,
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
        ],
      ),
    );
  }
}

class _NeedHelpSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEEEEEE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Need help with your order?',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 14),
          InkWell(
            onTap: () {
              showModalBottomSheet<void>(
                context: context,
                builder: (ctx) => Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.support_agent_rounded, size: 48, color: _themeGreen),
                      const SizedBox(height: 12),
                      const Text(
                        'Support & Help',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Our customer support team is available 24/7 to assist you with your order.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: () => Navigator.pop(ctx),
                          style: FilledButton.styleFrom(backgroundColor: _themeGreen),
                          child: const Text('Close'),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
            borderRadius: BorderRadius.circular(10),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: Color(0xFFF2F4F7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.chat_bubble_outline_rounded,
                    color: AppColors.textPrimary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Chat with us',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'About any issues related to your order',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DownloadInvoiceButton extends StatelessWidget {
  const _DownloadInvoiceButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF3EEFF),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: const Padding(
          padding: EdgeInsets.symmetric(vertical: 14),
          child: Center(
            child: Text(
              'Download Invoice / Credit Note',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF5B4FCF),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BottomOrderAgain extends StatelessWidget {
  const _BottomOrderAgain({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.borderLight)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: double.infinity,
          height: 54,
          child: FilledButton(
            onPressed: onTap,
            style: FilledButton.styleFrom(
              backgroundColor: _themeGreen,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              elevation: 0,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Text(
                  'Repeat Order',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'VIEW CART ON NEXT STEP',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.8,
                    color: Colors.white70,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String getBlinkitShipmentStatusLabel(
  String status, {
  String shipmentStatus = '',
  bool hasTracking = false,
}) {
  if (hasTracking && shipmentStatus.trim().isNotEmpty) {
    return shipmentStatus.trim();
  }

  switch (status) {
    case 'delivered':
      return 'Delivered';
    case 'shipping':
    case 'shipped':
      return 'On the way';
    case 'processing':
      return 'Preparing';
    case 'cancelled':
      return 'Cancelled';
    case 'return':
      return 'Return';
    default:
      return 'Confirmed';
  }
}
