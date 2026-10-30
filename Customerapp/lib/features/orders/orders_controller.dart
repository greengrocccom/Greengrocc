import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_isolate_parsers.dart';
import '../../core/providers/live_providers.dart';
import '../../models/order.dart';
import '../../features/auth/auth_controller.dart';

class OrdersState {
  const OrdersState({
    this.orders = const [],
    this.loading = false,
    this.hasLoaded = false,
    this.error,
  });

  final List<Order> orders;
  final bool loading;
  final bool hasLoaded;
  final String? error;

  OrdersState copyWith({
    List<Order>? orders,
    bool? loading,
    bool? hasLoaded,
    String? error,
    bool clearError = false,
  }) {
    return OrdersState(
      orders: orders ?? this.orders,
      loading: loading ?? this.loading,
      hasLoaded: hasLoaded ?? this.hasLoaded,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

final ordersControllerProvider =
    NotifierProvider<OrdersController, OrdersState>(OrdersController.new);

class OrdersController extends Notifier<OrdersState> {
  static const _path = '/api/orders';

  StreamSubscription<dynamic>? _watch;
  int _seq = 0;

  @override
  OrdersState build() {
    ref.onDispose(_stopWatching);
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.token != next.token) {
        _stopWatching();
        ref.read(liveCacheProvider).onAuthChanged();
      }
      if (!next.isLoggedIn) {
        state = const OrdersState();
      } else if (previous?.isLoggedIn != true || previous?.user?.id != next.user?.id) {
        state = const OrdersState();
        loadOrders();
      }
    });

    Future.microtask(() {
      if (ref.read(authControllerProvider).isLoggedIn && !state.hasLoaded) {
        loadOrders();
      }
    });

    return const OrdersState();
  }

  void _stopWatching() {
    _watch?.cancel();
    _watch = null;
  }

  /// Shows the orders saved on this device at once, then keeps them current:
  /// the server pushes only the orders that changed. Calling again (pull to
  /// refresh) just re-syncs the live subscription.
  Future<void> loadOrders() async {
    final auth = ref.read(authControllerProvider);
    if (!auth.isLoggedIn) {
      _stopWatching();
      state = const OrdersState();
      return;
    }
    final live = ref.read(liveCacheProvider);
    if (_watch != null) return live.refresh(_path);

    state = state.copyWith(loading: true, clearError: true);
    final firstValue = Completer<void>();
    void settle() {
      if (!firstValue.isCompleted) firstValue.complete();
    }

    _watch = live.watch(_path).listen((body) async {
      final seq = ++_seq;
      try {
        final orders = await parseOnBackground(parseOrdersResponse, body);
        if (seq == _seq) state = OrdersState(orders: orders, loading: false, hasLoaded: true);
      } catch (_) {}
      settle();
    }, onError: (_) {
      if (!state.hasLoaded) {
        state = const OrdersState(
          orders: [],
          loading: false,
          hasLoaded: true,
          error: 'Failed to load orders',
        );
      }
      settle();
    });
    return firstValue.future;
  }

  void upsertOrder(Order order) {
    final index = state.orders.indexWhere((o) => o.id == order.id);
    if (index == -1) {
      state = state.copyWith(orders: [order, ...state.orders]);
      return;
    }
    final updated = List<Order>.from(state.orders);
    updated[index] = order;
    state = state.copyWith(orders: updated);
  }
}
