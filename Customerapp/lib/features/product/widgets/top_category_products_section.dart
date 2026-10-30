import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/product_pricing.dart';
import '../../../features/auth/auth_controller.dart';
import '../../../features/cart/cart_controller.dart';
import '../../../models/cart_item.dart';
import '../../../models/product.dart';
import '../../../routes/route_paths.dart';
import '../../../widgets/common/skeleton_loaders.dart';
import '../../../widgets/product/deal_product_card.dart';
import '../../../widgets/product/variant_bottom_sheet.dart';
import '../product_providers.dart';

const double _kRailHeight = DealProductCardDimensions.height + 4;

class TopCategoryProductsSection extends ConsumerWidget {
  const TopCategoryProductsSection({
    super.key,
    required this.product,
    this.sectionTitle,
  });

  final Product product;
  final String? sectionTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catName = product.categories.isNotEmpty
        ? product.categories.first.trim()
        : product.subcategory.trim();

    final query = catName.isNotEmpty
        ? ProductQuery(categoryName: catName)
        : const ProductQuery(hotSelling: true);

    final categoryAsync = ref.watch(productListProvider(query));

    return categoryAsync.when(
      loading: () => const _TopCategorySkeleton(),
      error: (_, _) => _buildFallback(context, ref, catName),
      data: (products) {
        final filtered =
            products.where((p) => p.id != product.id && p.isActive).toList();
        if (filtered.isNotEmpty) {
          final displayTitle = sectionTitle ??
              (catName.isNotEmpty
                  ? 'Top $catName Products'
                  : 'Top Category Products');
          return _TopCategoryProductsList(
            title: displayTitle,
            categoryName: catName.isNotEmpty ? catName : 'All Products',
            products: filtered,
          );
        }
        return _buildFallback(context, ref, catName);
      },
    );
  }

  Widget _buildFallback(
    BuildContext context,
    WidgetRef ref,
    String primaryCategory,
  ) {
    // Fallback 1: query hot selling or general products
    final fallbackAsync = ref.watch(
      productListProvider(const ProductQuery()),
    );

    return fallbackAsync.when(
      loading: () => const _TopCategorySkeleton(),
      error: (_, _) => const SizedBox.shrink(),
      data: (products) {
        final filtered =
            products.where((p) => p.id != product.id && p.isActive).toList();
        if (filtered.isEmpty) return const SizedBox.shrink();

        final displayTitle = sectionTitle ??
            (primaryCategory.isNotEmpty
                ? 'More in $primaryCategory'
                : 'Top Category Products');

        return _TopCategoryProductsList(
          title: displayTitle,
          categoryName:
              primaryCategory.isNotEmpty ? primaryCategory : 'Products',
          products: filtered.take(10).toList(),
        );
      },
    );
  }
}

class _TopCategoryProductsList extends StatelessWidget {
  const _TopCategoryProductsList({
    required this.title,
    required this.categoryName,
    required this.products,
  });

  final String title;
  final String categoryName;
  final List<Product> products;

  void _navigateToCategory(BuildContext context) {
    if (categoryName.isNotEmpty &&
        categoryName != 'Products' &&
        categoryName != 'All Products') {
      context.push(
        '${RoutePaths.product}?categoryName=${Uri.encodeComponent(categoryName)}',
      );
    } else {
      context.push(RoutePaths.product);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Explore popular products in $categoryName',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () => _navigateToCategory(context),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'See all',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF047857),
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        size: 18,
                        color: Color(0xFF047857),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: _kRailHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.zero,
            itemCount: products.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) =>
                _TopCategoryProductCard(product: products[index]),
          ),
        ),
      ],
    );
  }
}

class _TopCategoryProductCard extends ConsumerWidget {
  const _TopCategoryProductCard({required this.product});

  final Product product;

  CartItem? _cartLine(List<CartItem> items) {
    final defaults = resolveCartDefaults(product);
    for (final item in items) {
      if (item.id != product.id) continue;
      if (item.variantName.trim() != defaults.variantName.trim()) continue;
      if (item.colorName.trim() != defaults.colorName.trim()) continue;
      return item;
    }
    return null;
  }

  Future<void> _handleAdd(WidgetRef ref, BuildContext context) async {
    if (isMultiVariant(product)) {
      showVariantBottomSheet(context, product);
      return;
    }
    final defaults = resolveCartDefaults(product);
    final result = await ref.read(cartControllerProvider.notifier).addToCart(
          product,
          defaults.quantity,
          variantName: defaults.variantName,
          colorName: defaults.colorName,
          flySourceContext: context,
        );
    if (result == AddToCartResult.requiresLogin) {
      ref.read(authControllerProvider.notifier).openAuthModal();
    }
  }

  Future<void> _handleIncrease(WidgetRef ref, BuildContext context) async {
    if (isMultiVariant(product)) {
      showVariantBottomSheet(context, product);
      return;
    }
    final cartItems = ref.read(cartControllerProvider).items;
    final line = _cartLine(cartItems);
    if (line == null) {
      return _handleAdd(ref, context);
    }

    final step = getCartStepForProduct(product, line.variantName);
    await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
          productId: product.id,
          quantity: line.quantity + step,
          variantName: line.variantName,
          colorName: line.colorName,
        );
  }

  Future<void> _handleDecrease(WidgetRef ref) async {
    final cartItems = ref.read(cartControllerProvider).items;
    final line = _cartLine(cartItems);
    if (line == null) return;

    final nextQty = getDecreasedCartQuantityForProduct(
      product,
      line.quantity,
      line.variantName,
    );
    if (nextQty <= 0) {
      await ref.read(cartControllerProvider.notifier).removeFromCartLine(
            productId: product.id,
            variantName: line.variantName,
            colorName: line.colorName,
          );
      return;
    }

    await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
          productId: product.id,
          quantity: nextQty,
          variantName: line.variantName,
          colorName: line.colorName,
        );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartQty = ref.watch(cartProductQuantityProvider(product.id));

    return DealProductCard(
      product: product,
      cartQuantity: cartQty,
      onAdd: (sourceContext) => _handleAdd(ref, sourceContext),
      onIncrease: () => _handleIncrease(ref, context),
      onDecrease: () => _handleDecrease(ref),
    );
  }
}

class _TopCategorySkeleton extends StatelessWidget {
  const _TopCategorySkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              SkeletonBox(width: 160, height: 20, borderRadius: 6),
              SkeletonBox(width: 60, height: 16, borderRadius: 4),
            ],
          ),
        ),
        SizedBox(
          height: _kRailHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.zero,
            itemCount: 4,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (_, _) => const SizedBox(
              width: DealProductCardDimensions.width,
              child: SkeletonBox(borderRadius: 12),
            ),
          ),
        ),
      ],
    );
  }
}
