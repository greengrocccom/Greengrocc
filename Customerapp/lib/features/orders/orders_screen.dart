import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/scroll/app_scroll_config.dart';
import '../../core/scroll/tab_scroll_registry.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/orders/orders_controller.dart';
import '../../models/order.dart';
import '../../routes/route_paths.dart';
import '../../widgets/layout/shell_bottom_insets.dart';
import '../../widgets/common/refreshable_body.dart';
import '../../widgets/common/skeleton_loaders.dart';
import '../../widgets/common/voice_mic_button.dart';
import '../../features/profile/profile_recent_items.dart';
import '../../widgets/product/buy_again_card.dart';
import 'widgets/blinkit_order_card.dart';

const _pageBg = Color(0xFFF3F5F9);
const _brandGreen = Color(0xFF0C831F);
const _slate900 = Color(0xFF0F172A);
const _slate500 = Color(0xFF64748B);
const _slate400 = Color(0xFF94A3B8);
const _slate200 = Color(0xFFE2E8F0);
const _slate50 = Color(0xFFF8FAFC);

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  late final TabScrollRegistry _tabScrollRegistry;
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabScrollRegistry = ref.read(tabScrollRegistryProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _tabScrollRegistry.register(ShellTabIndex.orders, _scrollController);
      _loadOrders();
    });
  }

  @override
  void dispose() {
    _tabScrollRegistry.unregister(ShellTabIndex.orders, _scrollController);
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    await ref.read(ordersControllerProvider.notifier).loadOrders();
  }

  @override
  Widget build(BuildContext context) {
    final isLoggedIn = ref.watch(authControllerProvider.select((s) => s.isLoggedIn));
    final orders = ref.watch(ordersControllerProvider.select((s) => s.orders));
    final loading = ref.watch(ordersControllerProvider.select((s) => s.loading));
    final hasLoaded = ref.watch(ordersControllerProvider.select((s) => s.hasLoaded));
    final error = ref.watch(ordersControllerProvider.select((s) => s.error));

    ref.listen(authControllerProvider.select((s) => s.isLoggedIn), (previous, next) {
      if (next) _loadOrders();
    });

    final canPop = context.canPop();
    final showCount = isLoggedIn && hasLoaded && !loading;

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: 60,
        automaticallyImplyLeading: false,
        titleSpacing: canPop ? 0 : 16,
        leading: canPop
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: _slate900, size: 22),
                onPressed: () => context.pop(),
              )
            : null,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'My Orders',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: _slate900,
                height: 1.2,
              ),
            ),
            if (showCount) ...[
              const SizedBox(height: 2),
              Text(
                '${orders.length} order${orders.length == 1 ? '' : 's'} placed',
                style: const TextStyle(fontSize: 12, color: _slate500, fontWeight: FontWeight.w400),
              ),
            ],
          ],
        ),
      ),
      body: _buildBody(
        context,
        isLoggedIn: isLoggedIn,
        orders: orders,
        loading: loading,
        hasLoaded: hasLoaded,
        error: error,
      ),
    );
  }

  Widget _buildBody(
    BuildContext context, {
    required bool isLoggedIn,
    required List<Order> orders,
    required bool loading,
    required bool hasLoaded,
    required String? error,
  }) {
    if (!isLoggedIn) {
      return RefreshableBody(
        onRefresh: _loadOrders,
        child: _LoginPrompt(
          onLogin: () => ref.read(authControllerProvider.notifier).openAuthModal(
                AuthModalMode.login,
                RoutePaths.orders,
              ),
        ),
      );
    }

    if (loading || !hasLoaded) {
      return const SkeletonOrderList();
    }

    if (error != null && orders.isEmpty) {
      return RefreshableBody(
        onRefresh: _loadOrders,
        child: _OrdersError(
          message: error,
          onRetry: _loadOrders,
        ),
      );
    }

    if (orders.isEmpty) {
      return RefreshableBody(
        onRefresh: _loadOrders,
        child: _EmptyOrders(onBrowse: () => context.go(RoutePaths.home)),
      );
    }

    final query = _searchQuery.trim().toLowerCase();
    final filteredOrders = orders.where((o) {
      if (query.isEmpty) return true;
      if (o.id.toLowerCase().contains(query) || o.orderNumber.toLowerCase().contains(query)) {
        return true;
      }
      for (final item in o.items) {
        if (item.name.toLowerCase().contains(query)) return true;
      }
      return false;
    }).toList();

    final recentProducts = query.isEmpty
        ? extractRecentOrderItemsWithOrder(orders)
        : <RecentOrderItem>[];

    return Column(
      children: [
        Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: _slate200)),
          ),
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Container(
            height: 42,
            decoration: BoxDecoration(
              color: _slate50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _slate200),
            ),
            padding: const EdgeInsets.only(left: 4, right: 4),
            child: Row(
              children: [
                const SizedBox(width: 8),
                const Icon(Icons.search_rounded, color: _slate500, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() => _searchQuery = val),
                    textInputAction: TextInputAction.search,
                    style: const TextStyle(fontSize: 13.5, color: _slate900),
                    decoration: const InputDecoration(
                      hintText: 'Search by item or order ID',
                      hintStyle: TextStyle(color: _slate400, fontSize: 13.5),
                      filled: false,
                      isCollapsed: true,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      disabledBorder: InputBorder.none,
                      errorBorder: InputBorder.none,
                      focusedErrorBorder: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
                if (_searchQuery.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18, color: _slate400),
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _searchQuery = '');
                    },
                  ),
                VoiceMicButton(
                  onTranscript: (text, isFinal) {
                    _searchController.value = TextEditingValue(
                      text: text,
                      selection: TextSelection.collapsed(offset: text.length),
                    );
                    setState(() => _searchQuery = text);
                  },
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: filteredOrders.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.search_off_rounded, size: 40, color: Color(0xFFCBD5E1)),
                        const SizedBox(height: 10),
                        Text(
                          'No orders matching "$_searchQuery"',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: _slate500, fontSize: 13.5),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadOrders,
                  color: _brandGreen,
                  child: ListView.builder(
                    controller: _scrollController,
                    physics: AppScrollConfig.listPhysics,
                    cacheExtent: AppScrollConfig.cacheExtent,
                    padding: ShellBottomInsets.listPadding(context, left: 16, top: 16, right: 16),
                    itemCount: filteredOrders.length + (recentProducts.isNotEmpty ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (recentProducts.isNotEmpty) {
                        if (index == 0) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Buy Again',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: _slate900,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Items from your previous orders',
                                  style: TextStyle(fontSize: 12, color: _slate500),
                                ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  height: recentProducts.any((r) => r.order.isPreOrder) ? 274 : 232,
                                  child: ListView.separated(
                                    scrollDirection: Axis.horizontal,
                                    itemCount: recentProducts.length,
                                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                                    itemBuilder: (context, itemIdx) {
                                      final recent = recentProducts[itemIdx];
                                      return BuyAgainCard(
                                        item: recent.item,
                                        order: recent.order,
                                      );
                                    },
                                  ),
                                ),
                                const SizedBox(height: 20),
                                const Text(
                                  'Past Orders',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: _slate900,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }
                        final order = filteredOrders[index - 1];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: RepaintBoundary(
                            child: BlinkitOrderCard(order: order),
                          ),
                        );
                      }

                      final order = filteredOrders[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: RepaintBoundary(
                          child: BlinkitOrderCard(order: order),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

class _LoginPrompt extends StatelessWidget {
  const _LoginPrompt({required this.onLogin});

  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return _StateView(
      icon: Icons.lock_outline_rounded,
      title: 'Login to view your orders',
      message: 'Track orders and reorder your favourite products in one tap.',
      actionLabel: 'Login / Sign Up',
      onAction: onLogin,
    );
  }
}

class _OrdersError extends StatelessWidget {
  const _OrdersError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return _StateView(
      icon: Icons.cloud_off_outlined,
      title: 'Something went wrong',
      message: message,
      actionLabel: 'Retry',
      onAction: onRetry,
    );
  }
}

class _EmptyOrders extends StatelessWidget {
  const _EmptyOrders({required this.onBrowse});

  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    return _StateView(
      icon: Icons.receipt_long_outlined,
      title: 'No orders yet!',
      message: "You haven't placed any orders yet. Order something fresh today!",
      actionLabel: 'Start shopping',
      onAction: onBrowse,
    );
  }
}

class _StateView extends StatelessWidget {
  const _StateView({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _slate200),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: Color(0xFFECFDF5),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: _brandGreen, size: 30),
              ),
              const SizedBox(height: 14),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: _slate900),
              ),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: _slate500, fontSize: 13, height: 1.45),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: FilledButton(
                  onPressed: onAction,
                  style: FilledButton.styleFrom(
                    backgroundColor: _brandGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  child: Text(
                    actionLabel,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

