import 'package:flutter/material.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../buttons/primary_button.dart';
import '../buttons/secondary_button.dart';
import '../cards/dashboard_card.dart';
import '../chips/status_chip.dart';

class OrderCard extends StatelessWidget {
  const OrderCard({
    super.key,
    required this.storeName,
    required this.customerName,
    required this.pickupAddress,
    required this.dropAddress,
    required this.distance,
    required this.estimatedEarnings,
    required this.estimatedTime,
    this.onAccept,
    this.onReject,
    this.showActions = true,
  });

  final String storeName;
  final String customerName;
  final String pickupAddress;
  final String dropAddress;
  final String distance;
  final String estimatedEarnings;
  final String estimatedTime;
  final VoidCallback? onAccept;
  final VoidCallback? onReject;
  final bool showActions;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return DashboardCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      storeName,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      customerName,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              StatusChip(label: l10n.statusNew, type: StatusType.success),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          _AddressRow(
            icon: Icons.storefront_outlined,
            label: l10n.pickup,
            address: pickupAddress,
            color: AppColors.primary,
          ),
          const SizedBox(height: AppSpacing.md),
          _AddressRow(
            icon: Icons.location_on_outlined,
            label: l10n.drop,
            address: dropAddress,
            color: AppColors.error,
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              _MetaChip(icon: Icons.route_outlined, label: distance),
              const SizedBox(width: AppSpacing.sm),
              _MetaChip(icon: Icons.schedule_outlined, label: estimatedTime),
              const Spacer(),
              Text(
                estimatedEarnings,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: AppColors.primary,
                    ),
              ),
            ],
          ),
          if (showActions) ...[
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: [
                Expanded(
                  child: SecondaryButton(
                    label: l10n.reject,
                    onPressed: onReject,
                    color: AppColors.error,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: PrimaryButton(label: l10n.accept, onPressed: onAccept),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _AddressRow extends StatelessWidget {
  const _AddressRow({
    required this.icon,
    required this.label,
    required this.address,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String address;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          ),
          child: Icon(icon, size: 18, color: color),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: color,
                    ),
              ),
              Text(address, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: AppSpacing.xs),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
