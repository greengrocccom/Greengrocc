import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/config/api_config.dart';
import 'auth_service.dart';
import 'push_notification_service.dart';
import 'socket_service.dart';

class RiderNotification {
  const RiderNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
    this.amount,
    this.orderId,
    this.gigId,
    this.priority = 'normal',
    this.data = const {},
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final bool isRead;
  final DateTime? createdAt;
  final double? amount;
  final String? orderId;
  final String? gigId;
  final String priority;
  final Map<String, dynamic> data;

  String get badge {
    final b = data['badge']?.toString().toLowerCase();
    if (b == 'online' || b == 'new') return b!;
    if (!isRead &&
        (type == 'ORDER_RECEIVED' ||
            type == 'ORDER_ASSIGNED' ||
            type == 'NEW_GIG' ||
            type == 'VERIFICATION_COMPLETED' ||
            type == 'ANNOUNCEMENT')) {
      return 'new';
    }
    if (type == 'SHIFT_STARTED') return 'online';
    return '';
  }

  String get screen => data['screen']?.toString() ?? '';

  factory RiderNotification.fromJson(Map<String, dynamic> json) {
    final message = json['message']?.toString() ?? json['body']?.toString() ?? '';
    return RiderNotification(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? 'SYSTEM',
      title: json['title']?.toString() ?? '',
      body: message,
      isRead: json['isRead'] == true,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      amount: (json['amount'] as num?)?.toDouble(),
      orderId: json['orderId']?.toString(),
      gigId: json['gigId']?.toString(),
      priority: json['priority']?.toString() ?? 'normal',
      data: json['data'] is Map
          ? Map<String, dynamic>.from(json['data'] as Map)
          : const {},
    );
  }

  RiderNotification copyWith({bool? isRead}) {
    return RiderNotification(
      id: id,
      type: type,
      title: title,
      body: body,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
      amount: amount,
      orderId: orderId,
      gigId: gigId,
      priority: priority,
      data: data,
    );
  }
}

/// In-app notification inbox + unread badge (single source of truth with backend).
class NotificationInboxService extends ChangeNotifier {
  NotificationInboxService._();
  static final NotificationInboxService instance = NotificationInboxService._();

  final List<RiderNotification> _items = [];
  final Set<String> _seenIds = {};
  int _unreadCount = 0;
  bool _loading = false;
  bool _listening = false;

  List<RiderNotification> get items => List.unmodifiable(_items);
  int get unreadCount => _unreadCount;
  bool get loading => _loading;
  bool get hasUnread => _unreadCount > 0;

  Map<String, String>? get _headers {
    final token = AuthService.instance.token;
    if (token == null || token.isEmpty) return null;
    return {
      ...ApiConfig.defaultHeaders,
      'Authorization': 'Bearer $token',
    };
  }

  void ensureSocketListeners() {
    if (_listening) return;
    _listening = true;
    SocketService.instance.onRiderNotification.listen((data) {
      try {
        final n = RiderNotification.fromJson(data);
        upsertLocal(n);
        PushNotificationService.instance.showLocalNotification(
          title: n.title.isNotEmpty ? n.title : 'GreenGroc Alert',
          body: n.body,
          data: {
            ...n.data,
            'notificationId': n.id,
            'type': n.type,
            'screen': n.screen,
            'orderId': n.orderId ?? (n.data['orderId'] ?? '').toString(),
          },
        );
      } catch (_) {}
    });
    // The server emits a badge event per socket room, so deltas would double count;
    // always re-read the real unread count instead.
    SocketService.instance.onNotificationBadge.listen((data) {
      if (data['unreadCount'] != null) {
        _unreadCount = (data['unreadCount'] as num?)?.toInt() ?? _unreadCount;
        notifyListeners();
      } else {
        _syncUnreadSoon();
      }
    });
  }

  Timer? _unreadSyncTimer;

  void _syncUnreadSoon() {
    _unreadSyncTimer?.cancel();
    _unreadSyncTimer = Timer(const Duration(milliseconds: 600), refreshUnreadOnly);
  }

  /// Deduped insert for socket + FCM foreground refresh.
  void upsertLocal(RiderNotification n) {
    if (n.id.isEmpty) return;
    if (_seenIds.contains(n.id) || _items.any((e) => e.id == n.id)) {
      _items.removeWhere((e) => e.id == n.id);
      _items.insert(0, n);
      notifyListeners();
      return;
    }
    _seenIds.add(n.id);
    _items.insert(0, n);
    notifyListeners();
    if (!n.isRead) _syncUnreadSoon();
  }

  Future<void> refresh() async {
    if (_headers == null) return;
    _loading = true;
    notifyListeners();
    try {
      final res = await apiGet(ApiConfig.notifications, headers: _headers);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        final list = (body['notifications'] as List? ?? [])
            .whereType<Map>()
            .map((e) => RiderNotification.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        _items
          ..clear()
          ..addAll(list);
        _seenIds
          ..clear()
          ..addAll(list.map((e) => e.id));
        _unreadCount = (body['unreadCount'] as num?)?.toInt() ??
            list.where((e) => !e.isRead).length;
      }
    } catch (e) {
      debugPrint('NotificationInboxService.refresh failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshUnreadOnly() async {
    if (_headers == null) return;
    try {
      final res =
          await apiGet(ApiConfig.notificationsUnreadCount, headers: _headers);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        _unreadCount = (body['unreadCount'] as num?)?.toInt() ?? _unreadCount;
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> markRead(String id) async {
    if (id.isEmpty || _headers == null) return;
    final idx = _items.indexWhere((e) => e.id == id);
    if (idx >= 0 && !_items[idx].isRead) {
      _items[idx] = _items[idx].copyWith(isRead: true);
      _unreadCount = (_unreadCount - 1).clamp(0, 9999);
      notifyListeners();
    }
    try {
      final res =
          await apiPatch(ApiConfig.notificationRead(id), headers: _headers);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        if (body['unreadCount'] != null) {
          _unreadCount = (body['unreadCount'] as num?)?.toInt() ?? _unreadCount;
          notifyListeners();
        }
      }
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    final updated = _items.map((e) => e.copyWith(isRead: true)).toList();
    _items
      ..clear()
      ..addAll(updated);
    _unreadCount = 0;
    notifyListeners();
    try {
      await apiPost(ApiConfig.notificationsReadAll, headers: _headers);
    } catch (_) {}
    await refreshUnreadOnly();
  }

  Future<void> clearAll() async {
    final ids = _items.map((e) => e.id).where((id) => id.isNotEmpty).toList();
    _items.clear();
    _seenIds.clear();
    _unreadCount = 0;
    notifyListeners();
    // Also covers older notifications that were never loaded into the list.
    try {
      await apiPost(ApiConfig.notificationsReadAll, headers: _headers);
    } catch (_) {}
    await Future.wait(ids.map((id) async {
      try {
        await apiDelete(ApiConfig.notificationDelete(id), headers: _headers);
      } catch (_) {}
    }));
    await refreshUnreadOnly();
  }

  Future<void> deleteOne(String id) async {
    if (id.isEmpty || _headers == null) return;
    final idx = _items.indexWhere((e) => e.id == id);
    if (idx >= 0) {
      final wasUnread = !_items[idx].isRead;
      _items.removeAt(idx);
      _seenIds.remove(id);
      if (wasUnread) _unreadCount = (_unreadCount - 1).clamp(0, 9999);
      notifyListeners();
    }
    try {
      await apiDelete(
        ApiConfig.notificationDelete(id),
        headers: _headers,
      );
    } catch (_) {}
    await refreshUnreadOnly();
  }

  void clear() {
    _items.clear();
    _seenIds.clear();
    _unreadCount = 0;
    notifyListeners();
  }
}
