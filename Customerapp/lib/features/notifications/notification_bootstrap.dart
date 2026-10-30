import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import 'notification_navigator.dart';
import 'notification_repository.dart';
import '../../models/push_notification_payload.dart';
import '../../routes/app_router.dart';
import '../../services/notification_service.dart';

/// Wires FCM to the phone system notification tray only (no in-app notification UI).
class NotificationBootstrap extends ConsumerStatefulWidget {
  const NotificationBootstrap({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<NotificationBootstrap> createState() =>
      _NotificationBootstrapState();
}

class _NotificationBootstrapState extends ConsumerState<NotificationBootstrap>
    with WidgetsBindingObserver {
  String? _syncedToken;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _wireHandlers());
  }

  void _wireHandlers() {
    final service = NotificationService.instance;
    service.tokenSyncHandler = _syncToken;
    service.onNotificationOpened = _onNotificationOpened;
    // Foreground pushes are shown in the Android notification shade only.
    service.onForegroundMessage = null;

    unawaited(_syncTokenIfReady());
    unawaited(NotificationNavigator.flushPending(context, ref));
  }

  Future<void> _syncTokenIfReady() async {
    final auth = ref.read(authControllerProvider);
    if (!auth.isLoggedIn || auth.loading) return;

    await NotificationService.instance.requestPermission();
    await NotificationService.instance.dispatchCachedToken();
  }

  Future<void> _syncToken(String token) async {
    if (!ref.read(authControllerProvider).isLoggedIn) return;
    if (token == _syncedToken) return;

    try {
      await ref.read(notificationRepositoryProvider).registerToken(token);
      _syncedToken = token;
      debugPrint('NotificationService: FCM token saved to backend');
    } catch (error) {
      debugPrint('NotificationService: FCM token sync failed — $error');
    }
  }

  Future<void> _onNotificationOpened(PushNotificationPayload payload) async {
    if (!ref.read(authControllerProvider).isLoggedIn) {
      NotificationPendingNavigation.store(payload);
      ref.read(authControllerProvider.notifier).openAuthModal();
      return;
    }

    final rootContext = rootNavigatorKey.currentContext ?? context;
    if (!rootContext.mounted) {
      NotificationPendingNavigation.store(payload);
      return;
    }

    await NotificationNavigator.openFromPayload(
      rootContext,
      ref,
      payload,
      notificationId: payload.notificationId,
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;

    unawaited(_syncTokenIfReady());
    unawaited(NotificationNavigator.flushPending(context, ref));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    final service = NotificationService.instance;
    service.tokenSyncHandler = null;
    service.onNotificationOpened = null;
    service.onForegroundMessage = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (previous, next) {
      final becameLoggedIn =
          next.isLoggedIn && !next.loading && previous?.isLoggedIn != true;
      final sessionReady =
          next.isLoggedIn && !next.loading && previous?.loading == true;

      if (!next.isLoggedIn) _syncedToken = null;
      if (becameLoggedIn || sessionReady) {
        if (becameLoggedIn) _syncedToken = null;
        unawaited(_syncTokenIfReady());
        unawaited(NotificationNavigator.flushPending(context, ref));
      }
    });

    return widget.child;
  }
}
