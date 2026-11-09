import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/app_localizations.dart';
import 'pickup_push_service.dart';
import 'screens/pickup_detail_screen.dart';
import 'screens/pickup_home_screen.dart';
import 'screens/pickup_notifications_screen.dart';
import 'screens/pickup_leave_screen.dart';
import 'screens/pickup_list_screen.dart';
import 'screens/pickup_profile_screen.dart';
import 'widgets/pickup_ui.dart';

/// Root of the pickup-driver app (vendor-created drivers: farm → collection
/// centre). Dark-store delivery partners use `MainShell` instead.
class PickupDriverShell extends StatefulWidget {
  const PickupDriverShell({super.key});

  @override
  State<PickupDriverShell> createState() => _PickupDriverShellState();
}

class _PickupDriverShellState extends State<PickupDriverShell> {
  final _listKey = GlobalKey<PickupListScreenState>();
  final _push = PickupPushService.instance;
  int _index = 0;
  String _pendingFilter = 'assigned';

  @override
  void initState() {
    super.initState();
    _push.openPickupRequest.addListener(_openFromNotification);
    _push.start();
    WidgetsBinding.instance.addPostFrameCallback((_) => _openFromNotification());
  }

  @override
  void dispose() {
    _push.openPickupRequest.removeListener(_openFromNotification);
    super.dispose();
  }

  void _openFromNotification() {
    final pickupId = _push.openPickupRequest.value;
    if (pickupId == null || !mounted) return;
    _push.openPickupRequest.value = null;
    Navigator.of(context).push(pickupRoute<void>(
      pickupId.isEmpty
          ? const PickupNotificationsScreen()
          : PickupDetailScreen(pickupId: pickupId),
    ));
  }

  void _openFilter(String filter) {
    setState(() {
      _index = 1;
      _pendingFilter = filter;
    });
    _listKey.currentState?.showFilter(filter);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: PopScope(
        canPop: _index == 0,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) setState(() => _index = 0);
        },
        child: Scaffold(
          body: IndexedStack(
            index: _index,
            children: [
              PickupHomeScreen(onOpenFilter: _openFilter),
              PickupListScreen(key: _listKey, initialFilter: _pendingFilter),
              const PickupLeaveScreen(),
              const PickupProfileScreen(),
            ],
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _index,
            backgroundColor: Colors.white,
            indicatorColor: PickupColors.brandSoft,
            onDestinationSelected: (i) => setState(() => _index = i),
            destinations: [
              NavigationDestination(
                icon: const Icon(Icons.home_outlined),
                selectedIcon:
                    const Icon(Icons.home_rounded, color: PickupColors.brand),
                label: l10n.home,
              ),
              NavigationDestination(
                icon: const Icon(Icons.local_shipping_outlined),
                selectedIcon: const Icon(Icons.local_shipping_rounded,
                    color: PickupColors.brand),
                label: l10n.pkPickups,
              ),
              NavigationDestination(
                icon: const Icon(Icons.event_busy_outlined),
                selectedIcon: const Icon(Icons.event_busy_rounded,
                    color: PickupColors.brand),
                label: l10n.pkLeave,
              ),
              NavigationDestination(
                icon: const Icon(Icons.person_outline_rounded),
                selectedIcon:
                    const Icon(Icons.person_rounded, color: PickupColors.brand),
                label: l10n.profile,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
