import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/auth_controller.dart';
import '../../features/auth/auth_host.dart';
import '../../features/home/widgets/home_footer.dart';
import '../../routes/route_paths.dart';
import 'flipkart_bottom_nav.dart';
import 'storefront_header.dart';

/// Bottom nav tabs, in the website's visual order.
const storefrontNavItems = <FlipkartNavItem>[
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

const _tabRoutes = [
  RoutePaths.home,
  RoutePaths.orders,
  RoutePaths.categories,
  RoutePaths.shop,
  RoutePaths.profile,
];

/// Navigates to a bottom-nav tab from a full-screen page, asking guests to
/// log in for Order Again / Account like the website.
Future<void> goToStorefrontTab(BuildContext context, WidgetRef ref, int index) async {
  final route = _tabRoutes[index];
  final needsLogin = index == 1 || index == 4;
  if (needsLogin && !ref.read(authControllerProvider).isLoggedIn) {
    await showAuthModalBottomSheet(context, ref, redirectRoute: route);
    return;
  }
  if (context.mounted) context.go(route);
}

/// Website support shortcut floating above the bottom nav.
class SupportBubble extends StatelessWidget {
  const SupportBubble({super.key});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push(RoutePaths.support),
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFE8F7EA), Colors.white],
          ),
          border: Border.all(color: kWebGreen, width: 2),
          boxShadow: const [
            BoxShadow(color: Color(0x590C831F), blurRadius: 16, offset: Offset(0, 6)),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        alignment: Alignment.bottomCenter,
        child: Image.asset(
          'assets/images/support_agent.png',
          width: 52,
          height: 52,
          fit: BoxFit.contain,
          alignment: Alignment.bottomCenter,
        ),
      ),
    );
  }
}

/// Website `MobileLayout` for full-screen routes: header, page content,
/// footer, bottom nav and support bubble.
class StorefrontPage extends ConsumerWidget {
  const StorefrontPage({
    super.key,
    required this.child,
    this.header,
    this.showHeader = true,
    this.showFooter = true,
    this.activeTab = -1,
    this.background = Colors.white,
    this.padding = EdgeInsets.zero,
    this.controller,
  });

  final Widget child;

  /// Replaces the default [StorefrontHeader].
  final Widget? header;
  final bool showHeader;
  final bool showFooter;
  final int activeTab;
  final Color background;
  final EdgeInsets padding;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final navHeight = FlipkartBottomNav.barHeight + bottomInset;
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;

    return Scaffold(
      backgroundColor: background,
      body: Stack(
        children: [
          Column(
            children: [
              if (header != null) header! else if (showHeader) const StorefrontHeader(),
              if (header == null && !showHeader) SizedBox(height: MediaQuery.paddingOf(context).top),
              Expanded(
                child: MediaQuery.removePadding(
                  context: context,
                  removeTop: true,
                  child: SingleChildScrollView(
                    controller: controller,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(padding: padding, child: child),
                        if (showFooter) const StorefrontFooter() else SizedBox(height: navHeight + 24),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (!keyboardOpen)
            Positioned(
              right: 12,
              bottom: navHeight + 17,
              child: const SupportBubble(),
            ),
          if (!keyboardOpen)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: FlipkartBottomNav(
                currentIndex: activeTab,
                items: storefrontNavItems,
                onTap: (index) => goToStorefrontTab(context, ref, index),
              ),
            ),
        ],
      ),
    );
  }
}
