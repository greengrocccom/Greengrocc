import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/l10n/app_l10n.dart';
import 'pickup_driver_service.dart';
import 'pickup_flow.dart';

const _assignedStatuses = {'DRIVER_ASSIGNED', 'PICKUP_SCHEDULED'};

/// Push + inbox for pickup drivers. Background/closed-app notifications are
/// shown by Android from the FCM `notification` payload; this class registers
/// the device, shows foreground alerts and tracks the unread count.
///
/// The app also alerts on newly assigned pickups it finds while polling, so
/// the driver is told even when the server that handled the assignment could
/// not send a push.
class PickupPushService extends ChangeNotifier {
  PickupPushService._();
  static final PickupPushService instance = PickupPushService._();

  final _svc = PickupDriverService.instance;
  final _local = FlutterLocalNotificationsPlugin();

  final List<StreamSubscription<dynamic>> _subs = [];
  bool _started = false;
  bool _tokenSynced = false;
  String? _token;
  int _unread = 0;
  Set<String>? _seenAssigned;

  /// Pickup id from a tapped notification, consumed by the shell.
  final ValueNotifier<String?> openPickupRequest = ValueNotifier(null);

  /// Bumped on every incoming pickup notification so open lists refresh.
  final ValueNotifier<int> refreshTick = ValueNotifier(0);

  /// Latest newly assigned pickup found while the app is open (in-app banner).
  final ValueNotifier<Map<String, dynamic>?> newAssignment =
      ValueNotifier(null);

  int get unread => _unread;

  static bool _isPickupMessage(RemoteMessage m) =>
      m.data['audience'] == 'pickup_driver';

  String get _seenKey {
    final d = _svc.driver ?? const {};
    final id = str(d['id']).isNotEmpty ? str(d['id']) : str(d['mobile']);
    return 'pickup_seen_assigned_$id';
  }

  Future<void> start() async {
    if (_started || !_svc.isLoggedIn) return;
    _started = true;
    unawaited(refreshUnread());
    try {
      final messaging = FirebaseMessaging.instance;
      _subs.add(messaging.onTokenRefresh.listen((t) {
        _token = t;
        _tokenSynced = false;
        unawaited(_syncToken());
      }));
      _subs.add(FirebaseMessaging.onMessage.listen(_onForeground));
      _subs.add(FirebaseMessaging.onMessageOpenedApp.listen(_onOpened));

      await messaging.requestPermission(alert: true, badge: true, sound: true);
      final initial = await messaging.getInitialMessage();
      if (initial != null && _isPickupMessage(initial)) _onOpened(initial);
    } catch (e) {
      debugPrint('PickupPushService.start failed: $e');
    }
    await _syncToken();
  }

  /// Registers this phone for the driver's pushes; retried on every refresh
  /// until the server accepts it.
  Future<void> _syncToken() async {
    if (_tokenSynced || !_svc.isLoggedIn) return;
    try {
      _token ??= await FirebaseMessaging.instance.getToken();
      if (_token == null) return;
      await _svc.registerPushToken(_token!);
      _tokenSynced = true;
    } catch (e) {
      debugPrint('Pickup push token not registered yet: $e');
    }
  }

  /// Call before logout so the phone stops receiving this driver's alerts.
  Future<void> stop() async {
    for (final s in _subs) {
      await s.cancel();
    }
    _subs.clear();
    _started = false;
    _tokenSynced = false;
    _seenAssigned = null;
    _unread = 0;
    newAssignment.value = null;
    final token = _token ?? await FirebaseMessaging.instance.getToken();
    if (token != null && _svc.isLoggedIn) {
      try {
        await _svc.removePushToken(token);
      } catch (_) {}
    }
    notifyListeners();
  }

  Future<void> refreshUnread() async {
    if (!_svc.isLoggedIn) return;
    unawaited(_syncToken());
    try {
      final res = await _svc.notifications();
      _unread = res.unread;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    _unread = 0;
    notifyListeners();
    try {
      await _svc.readAllNotifications();
    } catch (_) {}
  }

  /// Compares the driver's pickups with the ones already seen on this phone
  /// and alerts once for each new assignment. The first run only records.
  Future<void> checkNewAssignments(List<Map<String, dynamic>> pickups) async {
    if (!_svc.isLoggedIn) return;
    final prefs = await SharedPreferences.getInstance();
    final key = _seenKey;
    final firstRun = _seenAssigned == null && !prefs.containsKey(key);
    final seen = _seenAssigned ??= (prefs.getStringList(key) ?? []).toSet();

    final assigned = pickups
        .where((p) => _assignedStatuses.contains(str(p['status'])))
        .where((p) => str(p['id']).isNotEmpty)
        .toList();
    final fresh = assigned.where((p) => !seen.contains(str(p['id']))).toList();
    if (fresh.isEmpty && !firstRun) return;

    seen.addAll(fresh.map((p) => str(p['id'])));
    final ids = seen.toList();
    await prefs.setStringList(
        key, ids.length > 300 ? ids.sublist(ids.length - 300) : ids);
    if (firstRun || fresh.isEmpty) return;

    newAssignment.value = fresh.first;
    final pushed =
        _tokenSynced ? await _pushedAssignmentIds() : const <String>{};
    unawaited(refreshUnread());
    for (final p in fresh.where((p) => !pushed.contains(str(p['id'])))) {
      final farmer = str(p['farmerName']);
      final product = str(p['productName']);
      await _showLocal(
        id: str(p['id']).hashCode & 0x7fffffff,
        title: appL10n.pkNewPickupAssigned,
        body: [
          pickupOrderId(p),
          if (farmer.isNotEmpty) farmer,
          if (product.isNotEmpty) product,
        ].join(' · '),
      );
    }
  }

  /// Pickups the server already pushed an "assigned" alert for.
  Future<Set<String>> _pushedAssignmentIds() async {
    try {
      final res = await _svc.notifications();
      return res.items
          .map((n) => n['data'])
          .whereType<Map>()
          .where((d) => d['event'] == 'PICKUP_ASSIGNED')
          .map((d) => str(d['pickupId']))
          .where((id) => id.isNotEmpty)
          .toSet();
    } catch (_) {
      return const {};
    }
  }

  void _markSeen(String pickupId) {
    if (pickupId.isEmpty) return;
    final seen = _seenAssigned;
    if (seen == null || !seen.add(pickupId)) return;
    SharedPreferences.getInstance()
        .then((prefs) => prefs.setStringList(_seenKey, seen.toList()));
  }

  Future<void> _showLocal({
    required int id,
    required String title,
    required String body,
  }) async {
    try {
      await _local.show(
        id: id,
        title: title,
        body: body,
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            'high_importance_channel',
            'High Importance Notifications',
            importance: Importance.high,
            priority: Priority.high,
          ),
        ),
      );
    } catch (e) {
      debugPrint('Pickup local notification failed: $e');
    }
  }

  Future<void> _onForeground(RemoteMessage m) async {
    if (!_isPickupMessage(m)) return;
    final pickupId = m.data['pickupId']?.toString() ?? '';
    final assigned = m.data['event'] == 'PICKUP_ASSIGNED';
    if (assigned) _markSeen(pickupId);
    refreshTick.value++;
    _unread++;
    notifyListeners();
    final title = m.notification?.title ?? m.data['title']?.toString() ?? '';
    final body = m.notification?.body ?? m.data['body']?.toString() ?? '';
    if (title.isEmpty) return;
    await _showLocal(
      id: pickupId.isNotEmpty
          ? pickupId.hashCode & 0x7fffffff
          : m.hashCode & 0x7fffffff,
      title: title,
      body: body,
    );
  }

  void _onOpened(RemoteMessage m) {
    if (!_isPickupMessage(m)) return;
    refreshTick.value++;
    final pickupId = m.data['pickupId']?.toString() ?? '';
    if (m.data['event'] == 'PICKUP_ASSIGNED') _markSeen(pickupId);
    openPickupRequest.value = pickupId.isNotEmpty ? pickupId : '';
  }
}
