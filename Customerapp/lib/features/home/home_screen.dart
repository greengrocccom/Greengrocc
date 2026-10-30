import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/location_provider.dart';
import '../../core/refresh/app_refresh.dart';
import '../../core/theme/store_chrome.dart';
import '../../core/scroll/app_scroll_config.dart';
import '../../core/scroll/tab_scroll_registry.dart';
import '../../core/scroll/vertical_scroll_pause_scope.dart';
import '../../widgets/address/select_delivery_location_sheet.dart';
import '../../widgets/layout/shell_bottom_insets.dart';
import 'home_providers.dart';
import 'widgets/category_pills_section.dart';
import 'widgets/home_all_category_products.dart';
import 'widgets/home_delivery_bar.dart';
import 'widgets/home_feed_sections.dart';
import 'widgets/home_footer.dart';
import 'widgets/home_header_category_strip.dart';
import 'widgets/hero_feature_cards.dart';
import 'widgets/home_search_bar.dart';
import 'widgets/home_trust_sections.dart';
import 'widgets/hot_selling_section.dart';
import 'widgets/just_arrived_section.dart';
import 'widgets/site_banner_widgets.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  late final TabScrollRegistry _tabScrollRegistry;
  final _scrollController = ScrollController();
  final _verticalScrolling = ValueNotifier<bool>(false);

  bool _scrollActivityAttached = false;

  @override
  void initState() {
    super.initState();
    _tabScrollRegistry = ref.read(tabScrollRegistryProvider);
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _tabScrollRegistry.register(ShellTabIndex.home, _scrollController);
      _attachVerticalScrollActivityListener();
      unawaited(_promptLocationIfMissing());
    });
  }

  /// Once per app run: products are stocked per dark store, so ask for a location first.
  static bool _locationPrompted = false;

  Future<void> _promptLocationIfMissing() async {
    if (_locationPrompted) return;
    await ref.read(deliveryLocationProvider.notifier).restored;
    if (!mounted || _locationPrompted) return;
    if (ref.read(deliveryLocationProvider)?.hasLocation == true) return;
    _locationPrompted = true;
    await showSelectDeliveryLocationBottomSheet(context, ref);
  }

  void _attachVerticalScrollActivityListener() {
    if (_scrollActivityAttached || !_scrollController.hasClients) return;
    _scrollActivityAttached = true;
    _scrollController.position.isScrollingNotifier
        .addListener(_onVerticalScrollActivity);
    _onVerticalScrollActivity();
  }

  void _onVerticalScrollActivity() {
    if (!_scrollController.hasClients) return;
    final scrolling = _scrollController.position.isScrollingNotifier.value;
    if (_verticalScrolling.value != scrolling) {
      _verticalScrolling.value = scrolling;
    }
  }

  void _onScroll() {
    _attachVerticalScrollActivityListener();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    if (_scrollActivityAttached && _scrollController.hasClients) {
      _scrollController.position.isScrollingNotifier
          .removeListener(_onVerticalScrollActivity);
    }
    _verticalScrolling.dispose();
    _tabScrollRegistry.unregister(ShellTabIndex.home, _scrollController);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomContentSpacer = ShellBottomInsets.of(context) + 56;
    final currentStore = ref.watch(selectedStoreTabProvider);
    final isMain = currentStore == 'main';
    final bannerSection = bannerSectionForStore(currentStore);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent),
      child: VerticalScrollPauseScope(
        isScrolling: _verticalScrolling,
        child: ColoredBox(
          color: Colors.white,
          child: RefreshIndicator(
            color: const Color(0xFF0C831F),
            onRefresh: () => refreshHomeData(ref),
            child: CustomScrollView(
              controller: _scrollController,
              physics: AppScrollConfig.listPhysics,
              cacheExtent: AppScrollConfig.cacheExtent,
              slivers: [
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _StickyHeaderDelegate(
                    topInset: topInset,
                    currentStore: currentStore,
                  ),
                ),

                SliverToBoxAdapter(
                  child: SiteBannerCarousel(
                    key: ValueKey('hero-$bannerSection'),
                    slot: (section: bannerSection, placement: 'hero'),
                  ),
                ),

                if (isMain) const SliverToBoxAdapter(child: HeroFeatureCards()),

                const SliverToBoxAdapter(child: CategoryPillsSection()),

                // SliverList children are built — and their products fetched —
                // only within the screen plus [AppScrollConfig.cacheExtent].
                SliverList.list(
                  children: [
                    if (isMain) ...[
                      const StoriesDualBanners(section: 'preorder'),
                      const RepaintBoundary(child: HotSellingSection()),
                      const RepaintBoundary(child: JustArrivedSection()),
                      const RepaintBoundary(child: MostViewedSection()),
                      const RepaintBoundary(child: PreviouslyBoughtSection()),
                    ],
                    SiteBannerCarousel(
                      key: ValueKey('mid-$bannerSection'),
                      slot: (section: bannerSection, placement: 'mid'),
                      padding: kHomeSectionPadding,
                      radius: 12,
                      interval: const Duration(seconds: 4),
                      fallbackAspect: 16 / 7,
                    ),
                    RepaintBoundary(
                      child: isMain
                          ? const SuggestedForYouSection()
                          : DepartmentSuggestedSection(section: bannerSection),
                    ),
                    TopOffersSection(section: bannerSection),
                  ],
                ),

                const HomeAllCategoryProducts(),

                SliverList.list(
                  children: [
                    if (isMain) ...[
                      const FarmerTestimonials(),
                      const FarmerGrowthBanner(),
                      const WhatMakesUsDifferent(),
                    ],
                    const MaharashtraPrideBanner(),
                    const HomeFooter(),
                    ColoredBox(
                      color: footerGreen,
                      child: SizedBox(height: bottomContentSpacer),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Website mobile header: logo/profile row and store switcher scroll away,
/// then the search bar and category strip stay pinned (strip icons hidden).
class _StickyHeaderDelegate extends SliverPersistentHeaderDelegate {
  _StickyHeaderDelegate({
    required this.topInset,
    required this.currentStore,
  });

  final double topInset;
  final String currentStore;

  static const double _topBlock = HomeDeliveryBar.height;
  static const double _searchRow = 48;
  static const double _stripCollapse =
      HomeHeaderCategoryStrip.expandedHeight - HomeHeaderCategoryStrip.collapsedHeight;

  @override
  double get minExtent =>
      topInset + _searchRow + HomeHeaderCategoryStrip.collapsedHeight;

  @override
  double get maxExtent =>
      topInset + _topBlock + _searchRow + HomeHeaderCategoryStrip.expandedHeight;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final topHeight = (_topBlock - shrinkOffset).clamp(0.0, _topBlock);
    final topOpacity = (topHeight / _topBlock).clamp(0.0, 1.0);
    final stripShrink = (shrinkOffset - _topBlock).clamp(0.0, _stripCollapse);
    final iconProgress = 1 - stripShrink / _stripCollapse;
    final pinned = shrinkOffset >= _topBlock;

    return Container(
      color: StoreChrome.forStore(currentStore).header,
      foregroundDecoration: pinned
          ? const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0x0D000000))),
            )
          : null,
      padding: EdgeInsets.only(top: topInset),
      child: ClipRect(
        child: Column(
          children: [
            SizedBox(
              height: topHeight,
              child: ClipRect(
                child: OverflowBox(
                  alignment: Alignment.bottomCenter,
                  minHeight: _topBlock,
                  maxHeight: _topBlock,
                  child: Opacity(opacity: topOpacity, child: const HomeDeliveryBar()),
                ),
              ),
            ),
            const HomeSearchBar(isLightBg: true),
            HomeHeaderCategoryStrip(isLightBg: true, iconProgress: iconProgress),
          ],
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _StickyHeaderDelegate oldDelegate) =>
      oldDelegate.topInset != topInset || oldDelegate.currentStore != currentStore;
}
