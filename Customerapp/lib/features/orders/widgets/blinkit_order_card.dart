import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/order_utils.dart';
import '../../../models/order.dart';
import '../../../routes/app_router.dart';
import '../../../widgets/common/product_3d_image.dart';
import '../delivery_rating_controller.dart';
import '../feedback/order_feedback_sheet.dart';

const _brandGreen = Color(0xFF0C831F);
const _slate900 = Color(0xFF0F172A);
const _slate700 = Color(0xFF334155);
const _slate500 = Color(0xFF64748B);
const _slate400 = Color(0xFF94A3B8);
const _slate200 = Color(0xFFE2E8F0);
const _slate100 = Color(0xFFF1F5F9);
const _slate50 = Color(0xFFF8FAFC);
const _activeRing = Color(0xFFA7F3D0);
const _maxThumbs = 4;
const _progressSteps = ['Placed', 'Packed', 'On the way', 'Delivered'];

bool _isActiveStatus(String status) =>
    status != 'delivered' && status != 'cancelled' && status != 'return';

int _progressIndex(String status) {
  switch (status) {
    case 'processing':
      return 1;
    case 'shipping':
    case 'shipped':
      return 2;
    case 'delivered':
      return 3;
    default:
      return 0;
  }
}

class _StatusStyle {
  const _StatusStyle(this.icon, this.fg, this.bg);
  final IconData icon;
  final Color fg;
  final Color bg;
}

_StatusStyle _statusStyle(String status) {
  switch (status) {
    case 'delivered':
      return const _StatusStyle(Icons.check_circle_outline_rounded, Color(0xFF047857), Color(0xFFECFDF5));
    case 'shipping':
    case 'shipped':
      return const _StatusStyle(Icons.pedal_bike_rounded, Color(0xFF4338CA), Color(0xFFEEF2FF));
    case 'processing':
      return const _StatusStyle(Icons.inventory_2_outlined, Color(0xFFB45309), Color(0xFFFFFBEB));
    case 'cancelled':
      return const _StatusStyle(Icons.cancel_outlined, Color(0xFFBE123C), Color(0xFFFFF1F2));
    case 'return':
      return const _StatusStyle(Icons.replay_rounded, Color(0xFFC2410C), Color(0xFFFFF7ED));
    default:
      return const _StatusStyle(Icons.schedule_rounded, Color(0xFF0369A1), Color(0xFFF0F9FF));
  }
}

String _orderDisplayCode(Order order) {
  if (order.orderNumber.trim().isNotEmpty) return order.orderNumber.trim();
  final id = order.id;
  return (id.length > 6 ? id.substring(id.length - 6) : id).toUpperCase();
}

class BlinkitOrderCard extends ConsumerWidget {
  const BlinkitOrderCard({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deliveryRating = ref.watch(deliveryRatingProvider(order.id));
    final isDelivered = order.status == 'delivered';
    final isActive = _isActiveStatus(order.status);
    final productId = getPrimaryProductId(order);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isActive ? _activeRing : _slate200),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 2,
            offset: Offset(0, 1),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: () => context.push('/orders/${order.id}'),
              onLongPress: () => _showOrderMenu(context, order, productId),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _OrderHeader(order: order),
                    if (order.preOrderSlot.isNotEmpty && order.preOrderProgressLabel.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _PreOrderChip(label: order.preOrderProgressLabel),
                    ],
                    if (order.items.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _ProductThumbnailRow(items: order.items),
                      const SizedBox(height: 8),
                      _ItemsSummary(items: order.items),
                    ],
                    if (isActive) ...[
                      const SizedBox(height: 12),
                      _ProgressTrack(activeIndex: _progressIndex(order.status)),
                    ],
                  ],
                ),
              ),
            ),
            const Divider(height: 1, thickness: 1, color: _slate100),
            _OrderFooter(
              isActive: isActive,
              isDelivered: isDelivered,
              isPreOrder: order.isPreOrder,
              rating: deliveryRating,
              onTrack: () => context.push('/orders/${order.id}/track'),
              onRate: () => _showRatingSheet(context, ref, order.id),
              onDownloadInvoice: () => context.push('/orders/${order.id}/invoice'),
              onReorder: () => _handleOrderAgain(context, order, productId),
            ),
          ],
        ),
      ),
    );
  }

  void _handleOrderAgain(BuildContext context, Order order, String? productId) {
    if (order.items.length > 1) {
      context.push('/orders/${order.id}');
      return;
    }
    if (productId != null) {
      context.push('/product/$productId');
      return;
    }
    context.push('/orders/${order.id}');
  }

  void _showRatingSheet(BuildContext context, WidgetRef ref, String orderId) {
    final rootContext = rootNavigatorKey.currentContext ?? context;
    showOrderFeedbackSheet(rootContext, ref, orderId);
  }

  void _showOrderMenu(BuildContext context, Order order, String? productId) {
    final rootContext = rootNavigatorKey.currentContext ?? context;
    showDialog<void>(
      context: rootContext,
      builder: (dialogContext) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.receipt_long_outlined),
                title: const Text('View order details'),
                onTap: () {
                  Navigator.pop(dialogContext);
                  context.push('/orders/${order.id}');
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.description_outlined),
                title: const Text('Download invoice'),
                onTap: () {
                  Navigator.pop(dialogContext);
                  context.push('/orders/${order.id}/invoice');
                },
              ),
              if (productId != null) ...[
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.shopping_bag_outlined),
                  title: const Text('Reorder'),
                  onTap: () {
                    Navigator.pop(dialogContext);
                    context.push('/product/$productId');
                  },
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _OrderHeader extends StatelessWidget {
  const _OrderHeader({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final style = _statusStyle(order.status);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: style.bg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(style.icon, size: 20, color: style.fg),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                getBlinkitStatusLabel(order.status),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: _slate900,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${formatOrderHistoryDateTime(order.createdAt)} · #${_orderDisplayCode(order)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: _slate500,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                formatInr(order.total, withDecimals: false),
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: _slate900,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 2),
              const Icon(Icons.chevron_right_rounded, size: 18, color: _slate400),
            ],
          ),
        ),
      ],
    );
  }
}

class _PreOrderChip extends StatelessWidget {
  const _PreOrderChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.event_available_outlined, size: 14, color: Color(0xFF065F46)),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                'Pre-order: $label',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF065F46),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductThumbnailRow extends StatelessWidget {
  const _ProductThumbnailRow({required this.items});

  final List<OrderItem> items;

  @override
  Widget build(BuildContext context) {
    final visible = items.take(_maxThumbs).toList();
    final extra = items.length - visible.length;

    return Row(
      children: [
        for (final item in visible) ...[
          Container(
            width: 48,
            height: 48,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: _slate50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _slate100),
            ),
            child: item.image.isNotEmpty
                ? Product3DImage(imageUrl: item.image, size: 40)
                : const Icon(Icons.inventory_2_outlined, size: 20, color: Color(0xFFCBD5E1)),
          ),
          const SizedBox(width: 8),
        ],
        if (extra > 0)
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _slate100,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '+$extra',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF475569),
              ),
            ),
          ),
      ],
    );
  }
}

class _ItemsSummary extends StatelessWidget {
  const _ItemsSummary({required this.items});

  final List<OrderItem> items;

  @override
  Widget build(BuildContext context) {
    final totalQty = items.fold<int>(0, (sum, item) => sum + item.quantity);
    final names = items.map((i) => i.name).where((n) => n.trim().isNotEmpty).toList();
    final summary = names.length > 2
        ? '${names.take(2).join(', ')} & ${names.length - 2} more'
        : names.join(' & ');

    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '$totalQty item${totalQty == 1 ? '' : 's'}',
            style: const TextStyle(fontWeight: FontWeight.w600, color: _slate700),
          ),
          if (summary.isNotEmpty) TextSpan(text: ' · $summary'),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(fontSize: 12, color: _slate500),
    );
  }
}

class _ProgressTrack extends StatelessWidget {
  const _ProgressTrack({required this.activeIndex});

  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            for (var i = 0; i < _progressSteps.length; i++) ...[
              if (i > 0) const SizedBox(width: 4),
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: i <= activeIndex ? _brandGreen : _slate200,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            for (var i = 0; i < _progressSteps.length; i++)
              Text(
                _progressSteps[i],
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w500,
                  color: i <= activeIndex ? const Color(0xFF1E293B) : _slate400,
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _OrderFooter extends StatelessWidget {
  const _OrderFooter({
    required this.isActive,
    required this.isDelivered,
    this.isPreOrder = false,
    required this.rating,
    required this.onTrack,
    required this.onRate,
    required this.onDownloadInvoice,
    required this.onReorder,
  });

  final bool isActive;
  final bool isDelivered;
  final bool isPreOrder;
  final int? rating;
  final VoidCallback onTrack;
  final VoidCallback onRate;
  final VoidCallback onDownloadInvoice;
  final VoidCallback onReorder;

  @override
  Widget build(BuildContext context) {
    final buttons = <Widget>[
      if (isActive || isPreOrder)
        _FooterActionButton(
          icon: isPreOrder ? Icons.timeline_rounded : Icons.pedal_bike_rounded,
          label: 'Track order',
          onTap: onTrack,
        ),
      _FooterActionButton(icon: Icons.replay_rounded, label: 'Order again', onTap: onReorder),
      _FooterActionButton(icon: Icons.description_outlined, label: 'Invoice', onTap: onDownloadInvoice),
      if (isDelivered)
        rating != null
            ? _RatedButton(rating: rating!, onTap: onRate)
            : _FooterActionButton(icon: Icons.star_outline_rounded, label: 'Rate order', onTap: onRate),
    ];

    return SizedBox(
      height: 44,
      child: Row(
        children: [
          for (var i = 0; i < buttons.length; i++) ...[
            if (i > 0) const VerticalDivider(width: 1, thickness: 1, color: _slate100),
            Expanded(child: buttons[i]),
          ],
        ],
      ),
    );
  }
}

class _FooterActionButton extends StatelessWidget {
  const _FooterActionButton({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Center(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: _brandGreen),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: _brandGreen,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RatedButton extends StatelessWidget {
  const _RatedButton({required this.rating, required this.onTap});

  final int rating;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(5, (index) {
          return Icon(
            index < rating ? Icons.star_rounded : Icons.star_outline_rounded,
            size: 15,
            color: index < rating ? const Color(0xFFFBBF24) : const Color(0xFFCBD5E1),
          );
        }),
      ),
    );
  }
}
