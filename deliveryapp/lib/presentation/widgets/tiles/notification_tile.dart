import 'package:flutter/material.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../cards/dashboard_card.dart';

enum NotificationType {
  verificationCompleted,
  shiftStarted,
  shiftReminder,
  orderReceived,
  orderCompleted,
  walletCredited,
  newGig,
  announcement,
  support,
  query,
  system,
  // legacy
  order,
  payment,
  wallet,
  gig,
  incentive,
}

class NotificationTile extends StatelessWidget {
  const NotificationTile({
    super.key,
    required this.title,
    required this.message,
    required this.time,
    required this.type,
    this.onTap,
    this.isUnread = false,
    this.badge = '',
    this.amount,
  });

  final String title;
  final String message;
  final String time;
  final NotificationType type;
  final VoidCallback? onTap;
  final bool isUnread;
  final String badge;
  final double? amount;

  static NotificationType typeFromString(String? raw) {
    return switch ((raw ?? '').toUpperCase()) {
      'VERIFICATION_COMPLETED' => NotificationType.verificationCompleted,
      'SHIFT_STARTED' => NotificationType.shiftStarted,
      'SHIFT_REMINDER' => NotificationType.shiftReminder,
      'ORDER_RECEIVED' || 'ORDER_ASSIGNED' => NotificationType.orderReceived,
      'ORDER_COMPLETED' => NotificationType.orderCompleted,
      'WALLET_CREDITED' => NotificationType.walletCredited,
      'NEW_GIG' => NotificationType.newGig,
      'ANNOUNCEMENT' => NotificationType.announcement,
      'SUPPORT' => NotificationType.support,
      'QUERY' => NotificationType.query,
      'ORDER' => NotificationType.order,
      'PAYMENT' => NotificationType.payment,
      'WALLET' => NotificationType.wallet,
      'GIG' => NotificationType.gig,
      'INCENTIVE' => NotificationType.incentive,
      _ => NotificationType.system,
    };
  }

  IconData get _icon {
    return switch (type) {
      NotificationType.verificationCompleted => Icons.verified_outlined,
      NotificationType.shiftStarted ||
      NotificationType.shiftReminder =>
        Icons.schedule_outlined,
      NotificationType.orderReceived ||
      NotificationType.order =>
        Icons.local_shipping_outlined,
      NotificationType.orderCompleted => Icons.check_circle_outline,
      NotificationType.walletCredited ||
      NotificationType.payment ||
      NotificationType.wallet =>
        Icons.account_balance_wallet_outlined,
      NotificationType.newGig ||
      NotificationType.gig ||
      NotificationType.incentive =>
        Icons.bolt_outlined,
      NotificationType.announcement => Icons.campaign_outlined,
      NotificationType.support || NotificationType.query =>
        Icons.support_agent_outlined,
      NotificationType.system => Icons.notifications_outlined,
    };
  }

  Color get _color {
    return switch (type) {
      NotificationType.verificationCompleted => AppColors.primary,
      NotificationType.shiftStarted => const Color(0xFF059669),
      NotificationType.orderReceived || NotificationType.order => AppColors.primary,
      NotificationType.orderCompleted ||
      NotificationType.walletCredited ||
      NotificationType.payment ||
      NotificationType.wallet =>
        AppColors.info,
      NotificationType.newGig ||
      NotificationType.gig ||
      NotificationType.incentive ||
      NotificationType.shiftReminder =>
        AppColors.warning,
      NotificationType.announcement => AppColors.primaryDark,
      _ => AppColors.textSecondary,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return DashboardCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: _color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: Icon(_icon, color: _color, size: 22),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontSize: 15,
                              fontWeight:
                                  isUnread ? FontWeight.w800 : FontWeight.w600,
                            ),
                      ),
                    ),
                    if (badge == 'online')
                      _Pill(label: l10n.online, color: const Color(0xFF059669))
                    else if (badge == 'new' || isUnread)
                      _Pill(
                        label: badge == 'new' ? l10n.statusNew : l10n.uiUnread,
                        color: AppColors.primary,
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(message, style: Theme.of(context).textTheme.bodyMedium),
                if (amount != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    '₹${amount!.toStringAsFixed(0)}',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                Text(time, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(left: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
