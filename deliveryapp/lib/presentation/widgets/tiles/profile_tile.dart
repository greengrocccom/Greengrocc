import 'package:flutter/material.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';

class ProfileTile extends StatelessWidget {
  const ProfileTile({
    super.key,
    required this.title,
    this.subtitle,
    this.icon = Icons.chevron_right,
    this.leadingIcon,
    this.onTap,
    this.showDivider = true,
  });

  final String title;
  final String? subtitle;
  final IconData icon;
  final IconData? leadingIcon;
  final VoidCallback? onTap;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    Theme.of(context);
    return Column(
      children: [
        ListTile(
          onTap: onTap,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.xs,
          ),
          leading: leadingIcon != null
              ? Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  ),
                  child: Icon(leadingIcon, color: AppColors.primary, size: 22),
                )
              : null,
          title: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 15)),
          subtitle: subtitle != null
              ? Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium)
              : null,
          trailing: Icon(icon, color: AppColors.textMuted, size: 20),
        ),
        if (showDivider)
          const Divider(
            height: 1,
            indent: AppSpacing.lg,
            endIndent: AppSpacing.lg,
          ),
      ],
    );
  }
}
