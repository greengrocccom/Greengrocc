import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/product.dart';
import '../../../models/site_banner.dart';
import '../../../routes/route_paths.dart';
import '../../../widgets/common/skeleton_loaders.dart';
import '../../../widgets/product/deal_product_card.dart';
import '../../../features/cart/cart_controller.dart';
import '../home_providers.dart';
import 'home_section_style.dart';
import 'site_banner_widgets.dart';

/// Category rows on home, as a sliver: each row is built — and its products
/// fetched — only when it scrolls near the screen, instead of all at once.
class HomeAllCategoryProducts extends ConsumerWidget {
  const HomeAllCategoryProducts({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);
    final currentStore = ref.watch(selectedStoreTabProvider);

    return categoriesAsync.when(
      loading: () => const SliverToBoxAdapter(child: _CategorySectionSkeleton()),
      error: (err, stack) => const SliverToBoxAdapter(child: SizedBox.shrink()),
      data: (categories) {
        final names = categories
            .where((c) => c.isActive && c.categoryName.trim().isNotEmpty)
            .map((c) => c.categoryName)
            .toList();
        if (names.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());

        return SliverList.builder(
          itemCount: names.length,
          itemBuilder: (context, index) => _CategoryProductSection(
            key: ValueKey('home-cat-${names[index]}-$currentStore'),
            categoryName: names[index],
            currentStore: currentStore,
            // Every other row sits on a coloured wash, cycling through the palette.
            tint: index.isOdd
                ? HomeSectionTint.cycle[(index ~/ 2) % HomeSectionTint.cycle.length]
                : null,
          ),
        );
      },
    );
  }
}

class _CategoryProductSection extends ConsumerWidget {
  const _CategoryProductSection({
    super.key,
    required this.categoryName,
    required this.currentStore,
    this.tint,
  });

  final String categoryName;
  final String currentStore;
  final HomeSectionTint? tint;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(
      categoryPreviewProductsProvider(
        CategoryPreviewParam(
          categoryName: categoryName,
          currentStore: currentStore,
        ),
      ),
    );
    return productsAsync.when(
      loading: () => const _CategorySectionSkeleton(),
      error: (_, _) => const SizedBox.shrink(),
      data: (products) => products.isEmpty
          ? const SizedBox.shrink()
          : _CategoryProductGrid(
              categoryName: categoryName,
              products: products,
              tint: tint,
            ),
    );
  }
}

class _CategorySectionSkeleton extends StatelessWidget {
  const _CategorySectionSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SkeletonBox(width: 150, height: 22, borderRadius: 6),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: DealProductCardDimensions.gridChildAspectRatio,
            children: List.generate(3, (_) => const SkeletonBox(borderRadius: 12)),
          ),
        ],
      ),
    );
  }
}

class _CategoryProductGrid extends ConsumerWidget {
  const _CategoryProductGrid({required this.categoryName, required this.products, this.tint});

  final String categoryName;
  final List<Product> products;
  final HomeSectionTint? tint;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final section = bannerSectionForStore(ref.watch(selectedStoreTabProvider));
    final key = categoryBannerKey(categoryName);
    final banners = key.isEmpty
        ? const <SiteBanner>[]
        : (ref.watch(siteBannersProvider((section: section, placement: 'category'))).value ??
                const <SiteBanner>[])
            .where((b) => b.category == key)
            .toList();

    void viewAll() => context.push(
          '${RoutePaths.product}?categoryName=${Uri.encodeComponent(categoryName)}',
        );

    return HomeStyledSection(
      title: categoryName,
      emoji: categoryEmoji(categoryName),
      tint: tint,
      products: products,
      onViewAll: viewAll,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (banners.isNotEmpty)
            OfferBannerCarousel(
              banners: banners,
              padding: const EdgeInsets.only(bottom: 12),
            ),
          GridView.builder(
            shrinkWrap: true,
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: DealProductCardDimensions.gridChildAspectRatio,
            ),
            itemCount: products.length,
            itemBuilder: (context, index) {
              final product = products[index];
              return _Image2ProductTile(product: product);
            },
          ),
        ],
      ),
    );
  }
}

// =========================================================
// Image 2 Style Product Tile (Same format as Book Your Order)
// =========================================================
class _Image2ProductTile extends ConsumerWidget {
  const _Image2ProductTile({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DealProductCard(
      product: product,
      fillCell: true,
      cartQuantity: ref.watch(cartProductQuantityProvider(product.id)),
      onAdd: (ctx) {
        ref.read(cartControllerProvider.notifier).addToCart(product, 1);
      },
    );
  }
}
