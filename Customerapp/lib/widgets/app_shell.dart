import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:customer_app/core/bootstrap/app_bootstrap.dart';
import 'package:customer_app/core/providers/location_provider.dart';
import 'package:customer_app/core/scroll/tab_scroll_registry.dart';
import 'package:customer_app/core/theme/store_chrome.dart';
import 'package:customer_app/features/auth/auth_controller.dart';
import 'package:customer_app/features/auth/auth_host.dart';
import 'package:customer_app/features/cart/cart_controller.dart';
import 'package:customer_app/features/home/home_providers.dart';
import 'package:customer_app/routes/route_paths.dart';
import 'address/select_delivery_location_sheet.dart';
import 'app_back_binding.dart';
import 'cart/floating_cart_bar.dart';
import 'common/offline_banner.dart';
import 'layout/flipkart_bottom_nav.dart';
import 'layout/mobile_header.dart';
import 'layout/storefront_page.dart';
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.navigationShell, this.location = ''});

  final StatefulNavigationShell navigationShell;
  final String location;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  static const _tabs = storefrontNavItems;

  /// Visual tab order maps onto the existing shell branches.
  /// The Shop branch also hosts the cart screen, opened from the floating cart bar.
  static const _shellForVisual = [0, 2, 1, 3, 4];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future<void>.delayed(const Duration(milliseconds: 800), () {
        if (mounted) _maybeBootstrap();
      });
    });
  }

  void _maybeBootstrap() {
    unawaited(bootstrapUserSession(ref));
  }

  int _visualIndex(int shellIndex) {
    switch (shellIndex) {
      case 0:
        return 0;
      case 2:
        return 1;
      case 1:
        return 2;
      case 3:
        return 3;
      case 4:
        return 4;
      default:
        return 0;
    }
  }

  Future<void> _openCart() async {
    if (!ref.read(authControllerProvider).isLoggedIn) {
      await showAuthModalBottomSheet(
        context,
        ref,
        mode: AuthModalMode.login,
        redirectRoute: RoutePaths.cart,
      );
      return;
    }
    if (mounted) context.go(RoutePaths.cart);
  }

  Future<void> _onTap(int visualIndex) async {
    final isOrderAgainTab = visualIndex == 1;
    final isAccountTab = visualIndex == 4;
    final isProtectedTab = isOrderAgainTab || isAccountTab;

    if (isProtectedTab && !ref.read(authControllerProvider).isLoggedIn) {
      final targetRoute = isAccountTab ? RoutePaths.profile : RoutePaths.orders;
      await showAuthModalBottomSheet(
        context,
        ref,
        mode: AuthModalMode.login,
        redirectRoute: targetRoute,
      );
      return;
    }

    final shellIndex = _shellForVisual[visualIndex];
    final currentVisual = _visualIndex(widget.navigationShell.currentIndex);
    final isCurrentTab = visualIndex == currentVisual;

    if (isCurrentTab) {
      await ref.read(tabScrollRegistryProvider).scrollToTop(shellIndex);
    }
    if (!mounted) return;

    widget.navigationShell.goBranch(
      shellIndex,
      initialLocation: isCurrentTab,
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.isLoggedIn != true && next.isLoggedIn) {
        final redirect = next.redirectRoute;
        if (redirect != null && redirect.isNotEmpty) {
          ref.read(authControllerProvider.notifier).clearRedirect();
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              if (redirect == RoutePaths.profile) {
                // Shell branch 4 corresponds to Account / Profile tab
                widget.navigationShell.goBranch(4);
              } else if (redirect == RoutePaths.orders) {
                // Shell branch 2 corresponds to Order Again tab
                widget.navigationShell.goBranch(2);
              } else {
                context.go(redirect);
              }
            }
          });
        }
      }
    });

    final cartCount = ref.watch(
      cartControllerProvider.select((s) => s.cartCount),
    );
    final isKeyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    // Like the website, the cart page has its own checkout bar and no bottom nav.
    final hideBottomNav = isKeyboardOpen || widget.location.startsWith(RoutePaths.cart);
    final visualIndex = _visualIndex(widget.navigationShell.currentIndex);
    final chrome = StoreChrome.forStore(ref.watch(selectedStoreTabProvider));
    // The cart screen has its own checkout bar.
    // Website shows the floating cart bar only on home and categories.
    final showCartBar = !hideBottomNav &&
        cartCount > 0 &&
        (widget.location == RoutePaths.home || widget.location == RoutePaths.categories);
    final cartBarLift = showCartBar ? floatingCartBarHeight + 8 : 0.0;
    final mediaQuery = MediaQuery.of(context);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        AppBackBinding.instance.handleBack();
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          systemNavigationBarColor: Colors.transparent,
          systemNavigationBarDividerColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.dark,
        ),
        child: Scaffold(
          resizeToAvoidBottomInset: false,
          extendBody: true,
          backgroundColor: const Color(0xFFF4F5F7),
          body: OfflineBannerHost(
            child: Stack(
              children: [
                Column(
                  children: [
                    MobileHeader(
                      key: ValueKey(widget.navigationShell.currentIndex),
                      isHomeTab: widget.navigationShell.currentIndex == 0 ||
                          widget.navigationShell.currentIndex == 1,
                    ),
                    Expanded(
                      // Lists pad by ShellBottomInsets, which reads this inset.
                      child: MediaQuery(
                        data: showCartBar
                            ? mediaQuery.copyWith(
                                padding: mediaQuery.padding.copyWith(
                                  bottom: mediaQuery.padding.bottom + floatingCartBarHeight,
                                ),
                              )
                            : mediaQuery,
                        child: widget.navigationShell,
                      ),
                    ),
                  ],
                ),
                if (showCartBar)
                  Positioned(
                    left: 12,
                    right: 12,
                    bottom: mediaQuery.padding.bottom + FlipkartBottomNav.barHeight + 8,
                    child: FloatingCartBar(onOpenCart: _openCart),
                  ),
                // On Shop the bubble covers the product cards' cart buttons.
                if (!hideBottomNav && !widget.location.startsWith(RoutePaths.shop))
                  Positioned(
                    right: 12,
                    bottom: mediaQuery.padding.bottom + FlipkartBottomNav.barHeight + 17 + cartBarLift,
                    child: const SupportBubble(),
                  ),
                if (!hideBottomNav)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: FlipkartBottomNav(
                      currentIndex: visualIndex,
                      items: _tabs,
                      cartBadgeCount: cartCount,
                      activeColor: chrome.accent,
                      activeBackground: chrome.activeNavBg,
                      onTap: _onTap,
                    ),
                  ),
                if (widget.navigationShell.currentIndex == 0)
                  const Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: SizedBox.shrink(),
                  ),
                const _ShellSideEffects(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Side-effect listeners isolated so cart/auth updates don't rebuild the shell tree.
class _ShellSideEffects extends ConsumerStatefulWidget {
  const _ShellSideEffects();

  @override
  ConsumerState<_ShellSideEffects> createState() => _ShellSideEffectsState();
}

class _ShellSideEffectsState extends ConsumerState<_ShellSideEffects> {
  bool _promptActive = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future<void>.delayed(const Duration(milliseconds: 1000), () {
        if (mounted) _checkAndPromptFlow();
      });
    });
  }

  /// First open: sign in, then pick a delivery location (its nearest dark
  /// store decides the catalogue). Neither sheet can be skipped.
  Future<void> _checkAndPromptFlow() async {
    if (!mounted || _promptActive) return;
    _promptActive = true;
    try {
      await ref.read(deliveryLocationProvider.notifier).restored;
      if (!mounted) return;

      if (!ref.read(authControllerProvider).isLoggedIn) {
        await showAuthModalBottomSheet(context, ref, mode: AuthModalMode.login, mandatory: true);
        if (!mounted || !ref.read(authControllerProvider).isLoggedIn) return;
      }

      final location = ref.read(deliveryLocationProvider);
      if (location == null || !location.hasLocation) {
        await showSelectDeliveryLocationBottomSheet(context, ref, mandatory: true);
      }
    } finally {
      _promptActive = false;
    }
  }

  void _scheduleCheck() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _checkAndPromptFlow();
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.isLoggedIn != true && next.isLoggedIn) {
        unawaited(bootstrapUserSession(ref));
        _scheduleCheck();
      } else if (previous?.isLoggedIn == true && !next.isLoggedIn) {
        // The saved location belongs to the previous account's addresses.
        unawaited(ref.read(deliveryLocationProvider.notifier).clearLocation());
        _scheduleCheck();
      } else if (previous?.authModal != null && next.authModal == null && !next.isLoggedIn) {
        // A dismissible login sheet (e.g. from a /login link) was closed without signing in.
        _scheduleCheck();
      }
    });

    return const SizedBox.shrink();
  }
}
