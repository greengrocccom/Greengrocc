import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_controller.dart';
import '../../models/app_notification.dart';
import 'notification_repository.dart';

class NotificationsState {
  const NotificationsState({
    this.items = const [],
    this.unreadCount = 0,
    this.loading = false,
    this.loadingMore = false,
    this.refreshing = false,
    this.error,
    this.page = 1,
    this.totalPages = 1,
    this.hasLoaded = false,
    this.lastFetchedAt,
  });

  final List<AppNotification> items;
  final int unreadCount;
  final bool loading;
  final bool loadingMore;
  final bool refreshing;
  final String? error;
  final int page;
  final int totalPages;
  final bool hasLoaded;
  final DateTime? lastFetchedAt;

  bool get hasMore => page < totalPages;

  NotificationsState copyWith({
    List<AppNotification>? items,
    int? unreadCount,
    bool? loading,
    bool? loadingMore,
    bool? refreshing,
    String? error,
    int? page,
    int? totalPages,
    bool? hasLoaded,
    DateTime? lastFetchedAt,
    bool clearError = false,
  }) {
    return NotificationsState(
      items: items ?? this.items,
      unreadCount: unreadCount ?? this.unreadCount,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      refreshing: refreshing ?? this.refreshing,
      error: clearError ? null : (error ?? this.error),
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      hasLoaded: hasLoaded ?? this.hasLoaded,
      lastFetchedAt: lastFetchedAt ?? this.lastFetchedAt,
    );
  }
}

final notificationsControllerProvider =
    NotifierProvider<NotificationsController, NotificationsState>(
  NotificationsController.new,
);

class NotificationsController extends Notifier<NotificationsState> {
  static const _cacheTtl = Duration(seconds: 45);

  @override
  NotificationsState build() {
    ref.listen(authControllerProvider, (previous, next) {
      if (!next.isLoggedIn) {
        state = const NotificationsState();
        return;
      }
      if (previous?.user?.id != next.user?.id) {
        state = const NotificationsState();
        refreshUnreadCount(force: true);
      } else if (previous?.isLoggedIn != true) {
        refreshUnreadCount(force: true);
      }
    });

    Future.microtask(() {
      if (ref.read(authControllerProvider).isLoggedIn) {
        refreshUnreadCount();
      }
    });

    return const NotificationsState();
  }

  NotificationRepository get _repository =>
      ref.read(notificationRepositoryProvider);

  bool get _isLoggedIn => ref.read(authControllerProvider).isLoggedIn;

  bool _isCacheFresh() {
    final fetchedAt = state.lastFetchedAt;
    if (fetchedAt == null) return false;
    return DateTime.now().difference(fetchedAt) < _cacheTtl;
  }

  Future<void> refreshIfLoggedIn({bool force = false}) async {
    if (!_isLoggedIn) return;
    await refreshUnreadCount(force: force);
    if (force || !state.hasLoaded) {
      await loadNotifications(refresh: true, force: force);
    }
  }

  Future<void> refreshUnreadCount({bool force = false}) async {
    if (!_isLoggedIn) {
      state = state.copyWith(unreadCount: 0);
      return;
    }

    if (!force && _isCacheFresh() && state.unreadCount >= 0) {
      return;
    }

    try {
      final count = await _repository.getUnreadCount();
      state = state.copyWith(
        unreadCount: count,
        lastFetchedAt: DateTime.now(),
        clearError: true,
      );
    } catch (_) {
      // Keep previous unread count on transient failures.
    }
  }

  Future<void> loadNotifications({
    bool refresh = false,
    bool force = false,
  }) async {
    if (!_isLoggedIn) return;

    if (!force && !refresh && state.hasLoaded && _isCacheFresh()) {
      return;
    }

    if (refresh) {
      state = state.copyWith(refreshing: true, clearError: true);
    } else {
      state = state.copyWith(loading: true, clearError: true);
    }

    try {
      final result = await _repository.getNotifications(page: 1);
      state = state.copyWith(
        items: result.items,
        page: result.page,
        totalPages: result.pages,
        loading: false,
        refreshing: false,
        hasLoaded: true,
        lastFetchedAt: DateTime.now(),
        clearError: true,
      );
      await refreshUnreadCount(force: true);
    } catch (_) {
      state = state.copyWith(
        loading: false,
        refreshing: false,
        error: 'Could not load notifications',
      );
    }
  }

  Future<void> loadMore() async {
    if (!_isLoggedIn || state.loadingMore || !state.hasMore) return;

    state = state.copyWith(loadingMore: true, clearError: true);

    try {
      final nextPage = state.page + 1;
      final result = await _repository.getNotifications(page: nextPage);
      state = state.copyWith(
        items: [...state.items, ...result.items],
        page: result.page,
        totalPages: result.pages,
        loadingMore: false,
        lastFetchedAt: DateTime.now(),
        clearError: true,
      );
    } catch (_) {
      state = state.copyWith(
        loadingMore: false,
        error: 'Could not load more notifications',
      );
    }
  }

  Future<void> markRead(String id) async {
    if (!_isLoggedIn) return;

    final index = state.items.indexWhere((item) => item.id == id);
    if (index >= 0 && !state.items[index].isRead) {
      final updated = [...state.items];
      final item = updated[index];
      updated[index] = AppNotification(
        id: item.id,
        title: item.title,
        body: item.body,
        type: item.type,
        orderId: item.orderId,
        orderNumber: item.orderNumber,
        data: item.data,
        isRead: true,
        createdAt: item.createdAt,
      );
      state = state.copyWith(
        items: updated,
        unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
      );
    } else if (state.unreadCount > 0) {
      state = state.copyWith(unreadCount: state.unreadCount - 1);
    }

    try {
      await _repository.markRead(id);
    } catch (_) {
      await refreshUnreadCount(force: true);
    }
  }

  Future<void> markAllRead() async {
    if (!_isLoggedIn) return;

    state = state.copyWith(
      items: state.items
          .map(
            (item) => AppNotification(
              id: item.id,
              title: item.title,
              body: item.body,
              type: item.type,
              orderId: item.orderId,
              orderNumber: item.orderNumber,
              data: item.data,
              isRead: true,
              createdAt: item.createdAt,
            ),
          )
          .toList(),
      unreadCount: 0,
    );

    try {
      await _repository.markAllRead();
    } catch (_) {
      await refreshUnreadCount(force: true);
      await loadNotifications(refresh: true, force: true);
    }
  }

  Future<void> deleteNotification(String id) async {
    if (!_isLoggedIn) return;

    final removed = state.items.where((item) => item.id == id).toList();
    final wasUnread = removed.isNotEmpty && !removed.first.isRead;

    state = state.copyWith(
      items: state.items.where((item) => item.id != id).toList(),
      unreadCount: wasUnread && state.unreadCount > 0
          ? state.unreadCount - 1
          : state.unreadCount,
    );

    try {
      await _repository.deleteNotification(id);
    } catch (_) {
      await loadNotifications(refresh: true, force: true);
    }
  }

  void notifyIncomingPush() {
    refreshUnreadCount(force: true);
    if (state.hasLoaded) {
      loadNotifications(refresh: true, force: true);
    }
  }
}
