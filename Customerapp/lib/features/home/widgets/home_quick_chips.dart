import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/app_decorations.dart';
import '../../../config/theme.dart';
import '../../../core/utils/cart_utils.dart';
import '../../settings/store_settings_provider.dart';

class HomeQuickChips extends ConsumerWidget {
  const HomeQuickChips({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(storeSettingsProvider).value;
    final freeShipFrom = settings == null ? null : freeDeliveryThreshold(settings);
    final minimumOrder = settings?.minimumOrderValue ?? 0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: SingleChildScrollView(
        primary: false,
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            if (minimumOrder > 0) ...[
              _Chip(
                icon: Icons.shopping_bag_outlined,
                label: 'Min order ₹${minimumOrder.toInt()}',
              ),
              const SizedBox(width: 8),
            ],
            if (freeShipFrom != null) ...[
              _Chip(
                icon: Icons.local_shipping_outlined,
                label: 'Free ship ₹${freeShipFrom.toInt()}+',
              ),
              const SizedBox(width: 8),
            ],
            _Chip(
              icon: Icons.verified_outlined,
              label: '100% Genuine',
            ),
            const SizedBox(width: 8),
            _Chip(
              icon: Icons.storefront_outlined,
              label: 'Best Prices',
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: AppDecorations.pill(),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
