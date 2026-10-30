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
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.navigationShell, this.location = ''});

  final StatefulNavigationShell navigationShell;
  final String location;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  static const _tabs = <FlipkartNavItem>[
    FlipkartNavItem(
      label: 'Home',
      icon: Icons.home_outlined,
      activeIcon: Icons.home_rounded,
      assetIcon: 'assets/images/homeIcon.png',
    ),
    FlipkartNavItem(
      label: 'Order Again',
      icon: Icons.receipt_long_outlined,
      activeIcon: Icons.receipt_long_rounded,
      assetIcon: 'assets/images/orderAgainIcon.png',
    ),
    FlipkartNavItem(
      label: 'Categories',
      icon: Icons.widgets_outlined,
      activeIcon: Icons.widgets_rounded,
      assetIcon: 'assets/images/categoriesIcon (1).png',
      iconSize: 22,
    ),
    FlipkartNavItem(
      label: 'Shop',
      icon: Icons.storefront_outlined,
      activeIcon: Icons.storefront_rounded,
      assetIcon: 'assets/images/cart.png',
      iconSize: 28,
    ),
    FlipkartNavItem(
      label: 'Account',
      icon: Icons.account_circle_outlined,
      activeIcon: Icons.account_circle_rounded,
      assetIcon: 'assets/images/profileIcon.png',
    ),
  ];

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
    final accountInitial = ref.watch(
      authControllerProvider.select((s) {
        final name = s.user?.name;
        if (name == null || name.trim().isEmpty) return null;
        return name.trim()[0].toUpperCase();
      }),
    );

    final isKeyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    // Like the website, the cart page has its own checkout bar and no bottom nav.
    final hideBottomNav = isKeyboardOpen || widget.location.startsWith(RoutePaths.cart);
    final visualIndex = _visualIndex(widget.navigationShell.currentIndex);
    final chrome = StoreChrome.forStore(ref.watch(selectedStoreTabProvider));
    // The cart screen has its own checkout bar.
    final branch = widget.navigationShell.currentIndex;
    final showCartBar = !hideBottomNav &&
        cartCount > 0 &&
        branch != 4 &&
        !widget.location.startsWith(RoutePaths.cart);
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
                if (!hideBottomNav)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: FlipkartBottomNav(
                      currentIndex: visualIndex,
                      items: _tabs,
                      cartBadgeCount: cartCount,
                      accountInitial: accountInitial,
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

  Future<void> _checkAndPromptFlow() async {
    if (!mounted || _promptActive) return;

    // Wait until delivery location is restored from persistent storage
    final locationNotifier = ref.read(deliveryLocationProvider.notifier);
    await locationNotifier.restored;
    if (!mounted) return;

    final currentLoc = ref.read(deliveryLocationProvider);
    final hasLocation = currentLoc != null && currentLoc.hasLocation;

    // If no delivery location is set (e.g. new user), show the select delivery location sheet
    if (!hasLocation && mounted) {
      _promptActive = true;
      await showSelectDeliveryLocationBottomSheet(context, ref);
      _promptActive = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.isLoggedIn != true && next.isLoggedIn) {
        unawaited(bootstrapUserSession(ref));
        _promptActive = false;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _checkAndPromptFlow();
        });
      } else if (previous?.authModal != null && next.authModal == null) {
        _promptActive = false;
      }
    });

    ref.listen(deliveryLocationProvider, (previous, next) {
      if (next != null && next.hasLocation) {
        _promptActive = false;
      }
    });

    return const SizedBox.shrink();
  }
}
