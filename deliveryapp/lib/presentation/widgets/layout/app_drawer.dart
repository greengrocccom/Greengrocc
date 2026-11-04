import 'package:flutter/material.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../data/services/auth_service.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    Theme.of(context);
    final isFullTime = AuthService.instance.deliveryBoy?.isFullTime ?? false;

    return Drawer(
      backgroundColor: AppColors.background,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    child: Icon(
                      Icons.local_shipping_rounded,
                      color: AppColors.primary,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.brandName,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        Text(
                          l10n.deliveryPartner,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                children: [
                  _DrawerItem(
                    icon: Icons.dashboard_outlined,
                    label: l10n.dashboard,
                    onTap: () => _nav(context, AppRoutes.home),
                  ),
                  _DrawerItem(
                    icon: Icons.event_available_outlined,
                    label: 'Pre-order deliveries',
                    onTap: () => _nav(context, AppRoutes.preOrderDeliveries),
                  ),
                  if (isFullTime) ...[
                    _DrawerItem(
                      icon: Icons.assignment_outlined,
                      label: 'Assigned Orders',
                      onTap: () => _nav(context, AppRoutes.assignedOrders),
                    ),
                    _DrawerItem(
                      icon: Icons.rule_outlined,
                      label: 'My Rules',
                      onTap: () => _nav(context, AppRoutes.fullTimeRules),
                    ),
                  ],
                  _DrawerItem(
                    icon: Icons.schedule_outlined,
                    label: l10n.myShifts,
                    onTap: () => _nav(context, AppRoutes.myShifts),
                  ),
                  _DrawerItem(
                    icon: Icons.history_outlined,
                    label: l10n.history,
                    onTap: () => _nav(context, AppRoutes.deliveryHistory),
                  ),
                  if (!isFullTime)
                    _DrawerItem(
                      icon: Icons.calendar_month_outlined,
                      label: l10n.attendance,
                      onTap: () => _nav(context, AppRoutes.attendance),
                    ),
                  _DrawerItem(
                    icon: Icons.event_busy_outlined,
                    label: 'Apply Leave',
                    onTap: () => _nav(context, AppRoutes.leave),
                  ),
                  _DrawerItem(
                    icon: Icons.insights_outlined,
                    label: l10n.performance,
                    onTap: () => _nav(context, AppRoutes.performance),
                  ),
                  _DrawerItem(
                    icon: Icons.notifications_outlined,
                    label: l10n.notifications,
                    onTap: () => _nav(context, AppRoutes.notifications),
                  ),
                  _DrawerItem(
                    icon: Icons.person_outline,
                    label: l10n.profile,
                    onTap: () => _nav(context, AppRoutes.profile),
                  ),
                  _DrawerItem(
                    icon: Icons.description_outlined,
                    label: l10n.documents,
                    onTap: () => _nav(context, AppRoutes.documents),
                  ),
                  _DrawerItem(
                    icon: Icons.two_wheeler_outlined,
                    label: l10n.vehicle,
                    onTap: () => _nav(context, AppRoutes.vehicle),
                  ),
                  _DrawerItem(
                    icon: Icons.account_balance_outlined,
                    label: 'Bank details',
                    onTap: () => _nav(context, AppRoutes.bankDetails),
                  ),
                  _DrawerItem(
                    icon: Icons.support_agent_outlined,
                    label: l10n.support,
                    onTap: () => _nav(context, AppRoutes.support),
                  ),
                  _DrawerItem(
                    icon: Icons.settings_outlined,
                    label: l10n.settings,
                    onTap: () => _nav(context, AppRoutes.settings),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.logout, color: AppColors.error),
              title: Text(
                l10n.logout,
                style: TextStyle(
                  color: AppColors.error,
                  fontWeight: FontWeight.w600,
                ),
              ),
              onTap: () => logoutAndGoLogin(context),
            ),
          ],
        ),
      ),
    );
  }

  void _nav(BuildContext context, String route) {
    Navigator.pop(context);
    Navigator.pushNamed(context, route);
  }
}

class _DrawerItem extends StatelessWidget {
  const _DrawerItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary),
      title: Text(
        label,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 15),
      ),
      onTap: onTap,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xs,
      ),
    );
  }
}
