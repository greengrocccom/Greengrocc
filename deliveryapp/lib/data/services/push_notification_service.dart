import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/api_config.dart';
import '../../core/routes/app_routes.dart';
import '../../presentation/shell/shell_navigation.dart';
import 'auth_service.dart';
import 'notification_inbox_service.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

const AndroidNotificationChannel highImportanceChannel =
    AndroidNotificationChannel(
  'high_importance_channel',
  'High Importance Notifications',
  description: 'Used for important delivery partner alerts.',
  importance: Importance.high,
);

/// Global navigator key for FCM tap deep-links.
final GlobalKey<NavigatorState> notificationNavigatorKey =
    GlobalKey<NavigatorState>();

class PushNotificationService {
  PushNotificationService._();
  static final PushNotificationService instance = PushNotificationService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  bool _initialized = false;
  Map<String, dynamic>? _pendingTap;

  static const _shownKeysPref = 'shown_notification_keys';
  static const _maxShownKeys = 300;
  List<String>? _shownKeys;

  static int _idForKey(String key) => key.hashCode & 0x7fffffff;

  /// One key per real-world event, so the socket copy, the FCM copy and any
  /// extra socket event for the same thing collapse into a single banner.
  static String _keyFor(String title, String body, Map<String, dynamic>? data) {
    final d = data ?? const {};
    String v(String k) => (d[k] ?? '').toString();
    final type = v('type').toUpperCase();
    final orderId = v('orderId');
    if ((type == 'ORDER_RECEIVED' || type == 'SAME_ROUTE_ORDER') && orderId.isNotEmpty) {
      return 'offer:$orderId';
    }
    if (type == 'ORDER_ASSIGNED' && v('orderIds').isNotEmpty) return 'assigned:${v('orderIds')}';
    if (type == 'ORDER_ASSIGNED' && orderId.isNotEmpty) return 'assigned:$orderId';
    if (type == 'VERIFICATION_COMPLETED') return 'verified';
    final notificationId = v('notificationId').isNotEmpty ? v('notificationId') : v('id');
    if (notificationId.isNotEmpty) return 'n:$notificationId';
    return 't:$type:$title:$body';
  }

  Future<bool> _claimKey(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final keys = _shownKeys ??= prefs.getStringList(_shownKeysPref) ?? <String>[];
    if (keys.contains(key)) return false;
    keys.add(key);
    if (keys.length > _maxShownKeys) keys.removeRange(0, keys.length - _maxShownKeys);
    await prefs.setStringList(_shownKeysPref, keys);
    return true;
  }

  /// Removes the tray banner for an order offer/assignment once it is handled.
  Future<void> cancelForOrder(String orderId) async {
    if (orderId.isEmpty) return;
    try {
      await flutterLocalNotificationsPlugin.cancel(id: _idForKey('offer:$orderId'));
      await flutterLocalNotificationsPlugin.cancel(id: _idForKey('assigned:$orderId'));
    } catch (_) {}
  }

  /// Shows a banner at most once per event, and only while the app is in the
  /// foreground — in the background Android already shows the FCM banner.
  Future<void> showLocalNotification({
    required String title,
    required String body,
    Map<String, dynamic>? data,
    String? dedupeKey,
  }) async {
    final state = WidgetsBinding.instance.lifecycleState;
    if (state != null && state != AppLifecycleState.resumed) return;
    final key = dedupeKey ?? _keyFor(title, body, data);
    if (!await _claimKey(key)) return;
    try {
      final androidDetails = AndroidNotificationDetails(
        highImportanceChannel.id,
        highImportanceChannel.name,
        channelDescription: highImportanceChannel.description,
        importance: Importance.max,
        priority: Priority.high,
        showWhen: true,
        playSound: true,
        enableVibration: true,
        icon: '@mipmap/ic_launcher',
      );
      final details = NotificationDetails(android: androidDetails);
      await flutterLocalNotificationsPlugin.show(
        id: _idForKey(key),
        title: title,
        body: body,
        notificationDetails: details,
        payload: data != null ? jsonEncode(data) : null,
      );
    } catch (e) {
      debugPrint('showLocalNotification error: $e');
    }
  }

  void handleNotificationTap(Map<String, dynamic> data) {
    _queueNotificationTap(data);
  }

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    try {
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      debugPrint('FCM permission: ${settings.authorizationStatus}');

      final token = await _messaging.getToken();
      debugPrint('FCM token: $token');
      await _syncTokenToBackend(token);

      _messaging.onTokenRefresh.listen((newToken) {
        debugPrint('FCM token refreshed: $newToken');
        _syncTokenToBackend(newToken);
      });

      // App open: show heads-up banner with sound & vibration + apply verification instantly if needed
      FirebaseMessaging.onMessage.listen((message) async {
        debugPrint('FCM foreground message: ${message.messageId}');
        final type = message.data['type']?.toString() ?? '';
        final title = message.notification?.title ??
            message.data['title']?.toString() ??
            'GreenGroc Delivery';
        final body = message.notification?.body ??
            message.data['body']?.toString() ??
            message.data['message']?.toString() ??
            '';

        if (title.isNotEmpty || body.isNotEmpty) {
          await showLocalNotification(
            title: title,
            body: body,
            data: message.data,
          );
        }

        if (type == 'VERIFICATION_COMPLETED') {
          await AuthService.instance.applyVerificationStatus('approved');
          await AuthService.instance.fetchMe();
        }
        if (type == 'ORDER_RECEIVED') {
          final orderId = message.data['orderId']?.toString() ?? '';
          ShellNavigation.instance.requestOfferRecovery(
            orderId: orderId,
            reason: 'ORDER_RECEIVED_FOREGROUND',
          );
        }
        final id = message.data['notificationId']?.toString();
        if (id != null && id.isNotEmpty) {
          await NotificationInboxService.instance.refreshUnreadOnly();
        } else {
          await NotificationInboxService.instance.refresh();
        }
      });

      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        debugPrint('FCM opened from background: ${message.messageId}');
        _queueNotificationTap(message.data);
        NotificationInboxService.instance.refresh();
      });

      final initial = await _messaging.getInitialMessage();
      if (initial != null) {
        debugPrint('FCM opened from terminated: ${initial.messageId}');
        _queueNotificationTap(initial.data);
      }

      NotificationInboxService.instance.ensureSocketListeners();
      await NotificationInboxService.instance.refreshUnreadOnly();
    } catch (e, st) {
      debugPrint('PushNotificationService.init failed: $e');
      debugPrint('$st');
      _initialized = false;
    }
  }

  /// Call when MainShell is ready so deep-links work after cold start.
  void consumePendingTap() {
    final pending = _pendingTap;
    if (pending == null) return;
    _pendingTap = null;
    _applyNotificationTap(pending);
  }

  void _queueNotificationTap(Map<String, dynamic> data) {
    _pendingTap = Map<String, dynamic>.from(data);
    // Apply immediately if shell is already up; otherwise MainShell will consume.
    if (ShellNavigation.instance.tabNotifier != null) {
      consumePendingTap();
    } else {
      // Retry a few times while splash → home finishes.
      var attempts = 0;
      void retry() {
        attempts++;
        if (_pendingTap == null) return;
        if (ShellNavigation.instance.tabNotifier != null) {
          consumePendingTap();
          return;
        }
        if (attempts < 40) {
          Future.delayed(const Duration(milliseconds: 250), retry);
        }
      }

      Future.delayed(const Duration(milliseconds: 400), retry);
    }
  }

  void _applyNotificationTap(Map<String, dynamic> data) {
    final screen = (data['screen'] ?? '').toString().toLowerCase();
    final type = (data['type'] ?? '').toString().toUpperCase();
    final nav = notificationNavigatorKey.currentState;
    final shell = ShellNavigation.instance;
    final orderId = (data['orderId'] ?? '').toString();

    void goTab(int i) => shell.goToTab(i);

    if (screen == 'preorder_deliveries') {
      goTab(0);
      nav?.pushNamed(AppRoutes.preOrderDeliveries);
      return;
    }
    if (screen == 'assigned_orders' || type == 'ORDER_ASSIGNED') {
      goTab(0);
      nav?.pushNamed(AppRoutes.assignedOrders);
      return;
    }
    if (screen == 'wallet' ||
        type == 'ORDER_COMPLETED' ||
        type == 'WALLET_CREDITED') {
      goTab(3);
      nav?.pushNamed(AppRoutes.wallet);
      return;
    }
    if (screen == 'shifts' ||
        type == 'SHIFT_STARTED' ||
        type == 'SHIFT_REMINDER') {
      goTab(1);
      return;
    }
    if (screen == 'gigs' || type == 'NEW_GIG') {
      nav?.pushNamed(AppRoutes.gigs);
      return;
    }
    if (type == 'ORDER_RECEIVED' ||
        type == 'SAME_ROUTE_ORDER' ||
        screen == 'home' ||
        screen == 'orders') {
      goTab(0);
      // Cold-start / background: fetch pending offer from API and show Accept/Decline.
      shell.requestOfferRecovery(orderId: orderId, reason: type);
      return;
    }
    goTab(2); // notifications tab (center)
  }

  Future<void> syncTokenNow() async {
    try {
      final token = await _messaging.getToken();
      await _syncTokenToBackend(token);
    } catch (e) {
      debugPrint('syncTokenNow failed: $e');
    }
  }

  Future<void> _syncTokenToBackend(String? token) async {
    if (token == null || token.isEmpty) return;
    final auth = AuthService.instance;
    if (auth.token == null || auth.token!.isEmpty) {
      debugPrint('FCM token ready but user not logged in yet');
      return;
    }
    try {
      final res = await apiPost(
        ApiConfig.fcmToken,
        headers: {
          ...ApiConfig.defaultHeaders,
          'Authorization': 'Bearer ${auth.token}',
        },
        body: jsonEncode({'fcmToken': token}),
      );
      debugPrint('FCM token sync status: ${res.statusCode}');
    } catch (e) {
      debugPrint('FCM token sync failed: $e');
    }
  }
}
