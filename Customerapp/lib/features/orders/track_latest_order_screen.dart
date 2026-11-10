import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/app_providers.dart';
import '../../routes/route_paths.dart';
import '../auth/auth_controller.dart';

/// Website `TrackLatestOrder.jsx`: opens the newest active order's live
/// tracking, or the order list.
class TrackLatestOrderScreen extends ConsumerStatefulWidget {
  const TrackLatestOrderScreen({super.key});

  @override
  ConsumerState<TrackLatestOrderScreen> createState() => _TrackLatestOrderScreenState();
}

class _TrackLatestOrderScreenState extends ConsumerState<TrackLatestOrderScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolve());
  }

  Future<void> _resolve() async {
    var target = RoutePaths.orders;
    if (ref.read(authControllerProvider).isLoggedIn) {
      try {
        final orders = await ref.read(apiServiceProvider).fetchMyOrders();
        final trackable = orders.where((o) {
          final status = o.status.toLowerCase();
          return status != 'attempted' &&
              !const ['delivered', 'cancelled', 'return'].contains(status) &&
              !o.isPickup &&
              !o.shipment.hasTracking;
        }).toList()
          ..sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));
        if (trackable.isNotEmpty) target = '/orders/${trackable.first.id}/track';
      } catch (_) {}
    }
    if (mounted) context.go(target);
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: SizedBox(
          width: 36,
          height: 36,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            color: Color(0xFF0C831F),
            backgroundColor: Color(0xFFD1FAE5),
          ),
        ),
      ),
    );
  }
}
