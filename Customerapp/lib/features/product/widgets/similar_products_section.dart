import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/product_pricing.dart';
import '../../../features/auth/auth_controller.dart';
import '../../../features/cart/cart_controller.dart';
import '../../../models/cart_item.dart';
import '../../../models/product.dart';
import '../../../widgets/common/skeleton_loaders.dart';
import '../../../widgets/product/deal_product_card.dart';
import '../../../widgets/product/variant_bottom_sheet.dart';
import '../product_providers.dart';

const double _kRailHeight = DealProductCardDimensions.height + 4;

class SimilarProductsSection extends ConsumerWidget {
  const SimilarProductsSection({
    super.key,
    required this.productId,
    this.categoryName = '',
  });

  final String productId;
  final String categoryName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(similarProductsProvider(productId));

    return productsAsync.when(
      loading: () => const _SimilarProductsSkeleton(),
      error: (_, _) => _buildCategoryFallback(context, ref),
      data: (products) {
        final filtered =
            products.where((p) => p.id != productId && p.isActive).toList();
        if (filtered.isNotEmpty) {
          return _SimilarProductsList(products: filtered);
        }
        return _buildCategoryFallback(context, ref);
      },
    );
  }

  Widget _buildCategoryFallback(BuildContext context, WidgetRef ref) {
    final trimmedCategory = categoryName.trim();
    if (trimmedCategory.isEmpty) return const SizedBox.shrink();

    final categoryAsync = ref.watch(
      productListProvider(ProductQuery(categoryName: trimmedCategory)),
    );
    return categoryAsync.when(
      loading: () => const _SimilarProductsSkeleton(),
      error: (_, _) => const SizedBox.shrink(),
      data: (products) {
        final filtered =
            products.where((p) => p.id != productId && p.isActive).toList();
        if (filtered.isEmpty) return const SizedBox.shrink();
        return _SimilarProductsList(products: filtered);
      },
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        'Similar products',
        style: GoogleFonts.plusJakartaSans(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF0F172A),
        ),
      ),
    );
  }
}

class _SimilarProductsList extends StatelessWidget {
  const _SimilarProductsList({required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle(),
        SizedBox(
          height: _kRailHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.zero,
            itemCount: products.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) =>
                _SimilarProductCard(product: products[index]),
          ),
        ),
      ],
    );
  }
}

class _SimilarProductCard extends ConsumerWidget {
  const _SimilarProductCard({required this.product});

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

class _SimilarProductsSkeleton extends StatelessWidget {
  const _SimilarProductsSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle(),
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
