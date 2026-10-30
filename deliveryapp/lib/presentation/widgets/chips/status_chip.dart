import 'package:flutter/material.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';

enum StatusType { online, offline, success, warning, error, info, pending }

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.type = StatusType.info,
    this.showDot = true,
  });

  final String label;
  final StatusType type;
  final bool showDot;

  Color get _background {
    return switch (type) {
      StatusType.online || StatusType.success => AppColors.primaryLight,
      StatusType.offline => AppColors.surfaceVariant,
      StatusType.warning => const Color(0xFFFEF3C7),
      StatusType.error => const Color(0xFFFEE2E2),
      StatusType.info => const Color(0xFFDBEAFE),
      StatusType.pending => const Color(0xFFF1F5F9),
    };
  }

  Color get _foreground {
    return switch (type) {
      StatusType.online || StatusType.success => AppColors.primaryDark,
      StatusType.offline => AppColors.textSecondary,
      StatusType.warning => const Color(0xFFD97706),
      StatusType.error => AppColors.error,
      StatusType.info => AppColors.info,
      StatusType.pending => AppColors.textSecondary,
    };
  }

  @override
  Widget build(BuildContext context) {
    Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: _background,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showDot) ...[
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: _foreground,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
          ],
          Text(
            label,
            style: TextStyle(
              color: _foreground,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
