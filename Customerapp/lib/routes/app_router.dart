import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_controller.dart';
import '../features/auth/auth_state.dart';
import '../features/cart/cart_screen.dart';
import '../features/orders/track_latest_order_screen.dart';
import '../features/categories/categories_screen.dart';
import '../features/checkout/checkout_screen.dart';
import '../features/checkout/payment_method.dart';
import '../features/checkout/payment_screen.dart';
import '../features/coupons/coupons_screen.dart';
import '../features/home/home_providers.dart';
import '../features/home/home_screen.dart';
import '../features/location/location_screen.dart';
import '../features/product/catalog_flow_screen.dart';
import '../features/product/featured_products_screen.dart';
import '../features/product/farmer_profile_screen.dart';
import '../features/product/product_detail_screen.dart';
import '../features/product/product_list_screen.dart';
import '../models/farmer_trace.dart';
import '../features/shop/shop_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/wishlist/wishlist_screen.dart';
import '../features/orders/order_detail_screen.dart';
import '../features/orders/order_invoice_screen.dart';
import '../features/orders/order_tracking_screen.dart';
import '../features/orders/orders_screen.dart';
import '../features/static/info_page_screen.dart';
import '../features/static/static_content.dart';
import '../features/static/static_screens.dart';
import '../features/support/support_screen.dart';
import '../widgets/app_back_binding.dart';
import '../widgets/app_shell.dart';
import '../widgets/layout/tab_swipe_shell.dart';
import 'route_paths.dart';
import 'shell_navigator_keys.dart';

export 'shell_navigator_keys.dart';

/// Website `/login` and `/signup` render the home page with the auth modal open.
String _openAuthAndGoHome(Ref ref, AuthModalMode mode) {
  Future.microtask(() {
    if (!ref.read(authControllerProvider).isLoggedIn) {
      ref.read(authControllerProvider.notifier).openAuthModal(mode, null);
    }
  });
  return RoutePaths.home;
}

final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: RoutePaths.home,
    routes: [
      StatefulShellRoute(
        builder: (context, state, navigationShell) {
          return AppShell(navigationShell: navigationShell, location: state.uri.path);
        },
        navigatorContainerBuilder: (context, navigationShell, children) {
          return TabSwipeShell(
            navigationShell: navigationShell,
            branchNavigatorKeys: shellBranchNavigatorKeys,
            children: children,
          );
        },
        branches: [
          StatefulShellBranch(
            observers: [shellBranchNavigatorObservers[0]],
            navigatorKey: shellBranchNavigatorKeys[0],
            routes: [
              GoRoute(
                path: RoutePaths.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            observers: [shellBranchNavigatorObservers[1]],
            navigatorKey: shellBranchNavigatorKeys[1],
            routes: [
              GoRoute(
                path: RoutePaths.categories,
                builder: (context, state) => const CategoriesScreen(),
              ),
              GoRoute(
                path: RoutePaths.product,
                builder: (context, state) {
                  final params = state.uri.queryParameters;
                  final categoryName = params['categoryName']?.trim() ?? '';
                  final isPlainCategory = categoryName.isNotEmpty &&
                      (params['q'] ?? '').isEmpty &&
                      (params['brandName'] ?? params['brand'] ?? '').isEmpty;
                  if (isPlainCategory) {
                    return CatalogFlowScreen(
                      categoryName: categoryName,
                      baseId: params['view'] == 'products' ? params['base'] ?? '' : '',
                    );
                  }
                  return ProductListScreen(
                    searchQuery: params['q'],
                    categoryName: params['categoryName'],
                    subcategory: params['subcategory'],
                    brand: params['brandName'] ?? params['brand'],
                    minPrice: params['minPrice'],
                    maxPrice: params['maxPrice'],
                    sortId: params['sort'],
                    minDiscount: params['minDiscount'] ?? params['discount'],
                    pincode: params['pincode'],
                    weightSize: params['weightSize'] ?? params['weight'],
                    inStockOnly: params['inStock'] == 'true' || params['inStockOnly'] == 'true',
                  );
                },
              ),
            ],
          ),
          StatefulShellBranch(
            observers: [shellBranchNavigatorObservers[2]],
            navigatorKey: shellBranchNavigatorKeys[2],
            routes: [
              GoRoute(
                path: RoutePaths.orders,
                builder: (context, state) => const OrdersScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            observers: [shellBranchNavigatorObservers[3]],
            navigatorKey: shellBranchNavigatorKeys[3],
            routes: [
              GoRoute(
                path: RoutePaths.shop,
                builder: (context, state) => const ShopScreen(),
              ),
              GoRoute(
                path: RoutePaths.cart,
                builder: (context, state) => const CartScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            observers: [shellBranchNavigatorObservers[4]],
            navigatorKey: shellBranchNavigatorKeys[4],
            routes: [
              GoRoute(
                path: RoutePaths.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: RoutePaths.checkout,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => CheckoutScreen(
          initialCouponCode: state.uri.queryParameters['coupon'],
        ),
      ),
      GoRoute(
        path: RoutePaths.payment,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) {
          final params = state.uri.queryParameters;
          return PaymentScreen(
            selectedAddressId: params['addressId'],
            appliedCouponCode: params['coupon'],
            customerMessage: params['note'],
            fulfillmentType: params['fulfillment'] == 'pickup' ? 'pickup' : 'delivery',
            preOrderSlot: params['slot'],
            initialMode: paymentModeFromName(params['method']),
            autoPay: params['autopay'] == '1',
          );
        },
      ),
      GoRoute(
        path: RoutePaths.coupons,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const CouponsScreen(),
      ),
      GoRoute(
        path: '/orders/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => OrderDetailScreen(
          orderId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/orders/:id/track',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => OrderTrackingScreen(
          orderId: state.pathParameters['id']!,
          selectedProductId: state.uri.queryParameters['productId'],
        ),
      ),
      GoRoute(
        path: '/orders/:id/invoice',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => OrderInvoiceScreen(
          orderId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: RoutePaths.support,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const SupportScreen(),
      ),
      GoRoute(
        path: RoutePaths.about,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const AboutScreen(),
      ),
      GoRoute(
        path: RoutePaths.careers,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const CareersScreen(),
      ),
      GoRoute(
        path: RoutePaths.policies,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const PoliciesScreen(),
      ),
      GoRoute(
        path: RoutePaths.trackOrder,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const TrackLatestOrderScreen(),
      ),
      GoRoute(
        path: RoutePaths.login,
        redirect: (context, state) => _openAuthAndGoHome(ref, AuthModalMode.login),
      ),
      GoRoute(
        path: RoutePaths.signup,
        redirect: (context, state) => _openAuthAndGoHome(ref, AuthModalMode.signup),
      ),
      GoRoute(path: '/signin', redirect: (context, state) => RoutePaths.login),
      GoRoute(path: '/register', redirect: (context, state) => RoutePaths.signup),
      GoRoute(
        path: RoutePaths.contact,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const ContactScreen(),
      ),
      GoRoute(
        path: RoutePaths.blog,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const BlogScreen(),
      ),
      GoRoute(
        path: RoutePaths.privacyPolicy,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) =>
            const InfoPageScreen(content: privacyPolicyPage, policyKey: 'privacy'),
      ),
      GoRoute(
        path: RoutePaths.terms,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const InfoPageScreen(content: termsPage, policyKey: 'terms'),
      ),
      GoRoute(
        path: RoutePaths.shippingDetails,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) =>
            const InfoPageScreen(content: shippingDetailsPage, policyKey: 'shipping'),
      ),
      GoRoute(
        path: RoutePaths.refundPolicy,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) =>
            const InfoPageScreen(content: refundPolicyPage, policyKey: 'refund'),
      ),
      GoRoute(
        path: RoutePaths.location,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const LocationScreen(),
      ),
      GoRoute(
        path: RoutePaths.wishlist,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const WishlistScreen(),
      ),
      GoRoute(
        path: RoutePaths.justArrived,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const FeaturedProductsScreen(
          title: 'Just Arrived',
          filter: FeaturedProductFilter.justArrived,
          emptyMessage: 'No just arrived products yet.',
        ),
      ),
      GoRoute(
        path: RoutePaths.hotSelling,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const FeaturedProductsScreen(
          title: 'Hot Selling Products',
          filter: FeaturedProductFilter.hotSelling,
          emptyMessage: 'No hot selling products yet.',
        ),
      ),
      GoRoute(
        path: '/product/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => ProductDetailScreen(
          productId: state.pathParameters['id']!,
        ),
      ),
      for (final path in [RoutePaths.farmerProfile, RoutePaths.farmers, RoutePaths.farmerById])
        GoRoute(
          path: path,
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) {
            final extra = state.extra;
            final farmer = extra is FarmerTrace ? extra : null;
            return FarmerProfileScreen(farmer: farmer);
          },
        ),
    ],
  );

  AppBackBinding.instance.bindRouter(router);
  ref.onDispose(() => AppBackBinding.instance.unbindRouter(router));
  return router;
});
