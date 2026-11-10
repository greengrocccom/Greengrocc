import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config/theme.dart';
import 'core/providers/live_providers.dart';
import 'features/auth/auth_host.dart';
import 'features/cart/cart_store_guard.dart';
import 'features/notifications/notification_bootstrap.dart';
import 'routes/app_router.dart';
import 'widgets/app_back_binding.dart';
import 'widgets/cart/cart_feedback_overlay.dart';
import 'widgets/common/opening_splash_overlay.dart';
import 'widgets/deep_link_listener.dart';

class GreenGroccApp extends ConsumerWidget {
  const GreenGroccApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    ref.watch(catalogSyncProvider);
    ref.watch(cartStoreGuardProvider);

    return DeepLinkListener(
      child: NotificationBootstrap(
        child: MaterialApp.router(
          title: 'GreenGrocc',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          routerConfig: router,
          // Predictive back: always claim Flutter handles back so Android
          // does not finish the Activity on shell tab roots.
          onNavigationNotification: (notification) {
            AppBackBinding.instance.claimFrameworkHandlesBack();
            return true;
          },
          builder: (context, child) {
            return OpeningSplashHost(
              child: AuthHost(
                child: CartFeedbackOverlay(
                  child: child ?? const SizedBox.shrink(),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
