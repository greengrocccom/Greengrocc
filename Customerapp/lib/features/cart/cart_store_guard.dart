import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/providers/location_provider.dart';
import '../../routes/shell_navigator_keys.dart';
import '../auth/auth_controller.dart';
import 'cart_controller.dart';

const _cartStoreKey = 'greengrocc_cart_store_id';

/// Stock and prices belong to one dark store, so when the delivery location
/// moves to an area served by a different store the cart (and with it the
/// checkout) is emptied. Watch once at the app root.
final cartStoreGuardProvider = Provider<void>((ref) {
  String? cartStoreId;
  final restored = SharedPreferences.getInstance().then((prefs) {
    cartStoreId = prefs.getString(_cartStoreKey);
  }).catchError((_) {});

  Future<void> remember(String? storeId) async {
    cartStoreId = storeId;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (storeId == null) {
        await prefs.remove(_cartStoreKey);
      } else {
        await prefs.setString(_cartStoreKey, storeId);
      }
    } catch (_) {}
  }

  ref.listen(authControllerProvider, (previous, next) {
    if (previous?.isLoggedIn == true && !next.isLoggedIn) remember(null);
  });

  ref.listen(nearestStoreProvider, (_, next) async {
    if (next.isLoading || !next.hasValue) return;
    final location = ref.read(deliveryLocationProvider);
    if (location == null || !location.hasLocation) return;
    await restored;

    final storeId = next.value?.store?.id ?? '';
    final previous = cartStoreId;
    if (previous == storeId) return;
    await remember(storeId);
    if (previous == null) return;

    if (ref.read(cartControllerProvider).items.isEmpty) return;
    await ref.read(cartControllerProvider.notifier).clearCart();

    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null || !ctx.mounted) return;
    final storeName = next.value?.store?.storeName.trim() ?? '';
    ScaffoldMessenger.maybeOf(ctx)?.showSnackBar(
      SnackBar(
        content: Text(
          storeName.isEmpty
              ? 'Your cart was cleared because no store delivers to this location yet.'
              : 'Your cart was cleared because this location is served by $storeName.',
        ),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
      ),
    );
  }, fireImmediately: true);
});
