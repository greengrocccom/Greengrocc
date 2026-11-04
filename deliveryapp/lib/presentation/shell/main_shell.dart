import 'package:deliveryapp/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

import '../../core/routes/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../data/services/notification_inbox_service.dart';
import '../../data/services/push_notification_service.dart';
import '../widgets/layout/app_bottom_navigation.dart';
import '../widgets/layout/app_drawer.dart';
import '../widgets/layout/custom_app_bar.dart';
import '../screens/home/home_dashboard_screen.dart';
import '../screens/history/delivery_history_screen.dart';
import '../screens/notifications/notifications_screen.dart';
import '../screens/shifts/my_shifts_screen.dart';
import 'shell_navigation.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  final _tabIndex = ValueNotifier<int>(0);

  @override
  void initState() {
    super.initState();
    ShellNavigation.instance.bind(_tabIndex);
    _tabIndex.addListener(_onTabChanged);
    ThemeController.instance.addListener(_onThemeChanged);
    NotificationInboxService.instance.addListener(_onInboxChanged);
    NotificationInboxService.instance.ensureSocketListeners();
    NotificationInboxService.instance.refreshUnreadOnly();
    PushNotificationService.instance.syncTokenNow();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      PushNotificationService.instance.consumePendingTap();
    });
  }

  @override
  void dispose() {
    NotificationInboxService.instance.removeListener(_onInboxChanged);
    ThemeController.instance.removeListener(_onThemeChanged);
    _tabIndex.removeListener(_onTabChanged);
    ShellNavigation.instance.unbind();
    _tabIndex.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (mounted) setState(() {});
    if (_tabIndex.value == 2) {
      NotificationInboxService.instance.refresh();
    }
  }

  void _onInboxChanged() {
    if (mounted) setState(() {});
  }

  void _onThemeChanged() {
    if (mounted) setState(() {});
  }

  int get _currentIndex => _tabIndex.value;

  String _titleForIndex(AppLocalizations l10n, int index) {
    return switch (index) {
      0 => l10n.dashboard,
      1 => l10n.myShifts,
      2 => l10n.notifications,
      3 => l10n.deliveryHistory,
      _ => l10n.dashboard,
    };
  }

  Widget _buildPage(int index) {
    return switch (index) {
      0 => HomeDashboardScreen(key: ValueKey('home_${ThemeController.instance.isDark}')),
      1 => MyShiftsScreen(
          key: ValueKey('shifts_${ThemeController.instance.isDark}'),
          embedded: true,
        ),
      2 => NotificationsScreen(
          key: ValueKey('notif_${ThemeController.instance.isDark}'),
          embedded: true,
        ),
      3 => DeliveryHistoryScreen(
          key: ValueKey('history_${ThemeController.instance.isDark}'),
          embedded: true,
        ),
      _ => HomeDashboardScreen(
          key: ValueKey('home_${ThemeController.instance.isDark}'),
        ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    Theme.of(context);

    final hideShellAppBar = _currentIndex == 0 || _currentIndex == 2;

    return Scaffold(
      backgroundColor: AppColors.background,
      extendBody: false,
      drawer: const AppDrawer(),
      appBar: hideShellAppBar
          ? null
          : CustomAppBar(
              title: _titleForIndex(l10n, _currentIndex),
              showTitle: true,
              leading: Builder(
                builder: (context) => IconButton(
                  icon: const Icon(Icons.menu),
                  onPressed: () => Scaffold.of(context).openDrawer(),
                ),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.settings_outlined),
                  onPressed: () =>
                      Navigator.pushNamed(context, AppRoutes.settings),
                ),
              ],
            ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        child: KeyedSubtree(
          key: ValueKey('${_currentIndex}_${ThemeController.instance.isDark}'),
          child: _buildPage(_currentIndex),
        ),
      ),
      bottomNavigationBar: AppBottomNavigation(
        currentIndex: _currentIndex,
        notificationBadgeCount: NotificationInboxService.instance.unreadCount,
        onTap: (index) => _tabIndex.value = index,
      ),
    );
  }
}
