import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/theme.dart';
import '../../../core/utils/product_pricing.dart';
import '../../../features/auth/auth_controller.dart';
import '../../../features/cart/cart_controller.dart';
import '../../../models/cart_item.dart';
import '../../../models/product.dart';
import '../../../widgets/product/deal_product_card.dart';
import 'home_section_style.dart';

export 'home_section_style.dart' show HomeSectionTint;

class HomeProductRow extends ConsumerWidget {
  const HomeProductRow({
    super.key,
    required this.title,
    required this.onViewAll,
    required this.products,
    required this.loading,
    this.emoji = '',
    this.tint,
    this.secondRow = const [],
  });

  final String title;
  final String emoji;
  final VoidCallback onViewAll;
  final List<Product> products;
  final bool loading;

  /// Coloured wavy background; null keeps the plain page background.
  final HomeSectionTint? tint;

  /// Optional second scroll row shown under the first, inside the same section.
  final List<Product> secondRow;

  CartItem? _cartLine(List<CartItem> items, Product product) {
    final defaults = resolveCartDefaults(product);
    for (final item in items) {
      if (item.id != product.id) continue;
      if (item.variantName.trim() != defaults.variantName.trim()) continue;
      if (item.colorName.trim() != defaults.colorName.trim()) continue;
      return item;
    }
    return null;
  }

  Future<void> _handleAdd(WidgetRef ref, Product product, BuildContext context) async {
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

  Future<void> _handleIncrease(
    WidgetRef ref,
    Product product,
    BuildContext context,
  ) async {
    final cartItems = ref.read(cartControllerProvider).items;
    final line = _cartLine(cartItems, product);
    if (line == null) {
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
      return;
    }

    final step = getCartStepForProduct(product, line.variantName);
    await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
          productId: product.id,
          quantity: line.quantity + step,
          variantName: line.variantName,
          colorName: line.colorName,
        );
  }

  Future<void> _handleDecrease(WidgetRef ref, Product product) async {
    final cartItems = ref.read(cartControllerProvider).items;
    final line = _cartLine(cartItems, product);
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
    if (!loading && products.isEmpty) {
      return const SizedBox.shrink();
    }

    return HomeStyledSection(
      title: title,
      emoji: emoji,
      tint: tint,
      products: products,
      onViewAll: onViewAll,
      child: Column(
        children: [
          _scrollRow(ref, products),
          if (!loading && secondRow.isNotEmpty) ...[
            const SizedBox(height: 12),
            _scrollRow(ref, secondRow),
          ],
        ],
      ),
    );
  }

  Widget _scrollRow(WidgetRef ref, List<Product> rowProducts) {
    return SizedBox(
      height: DealProductCardDimensions.height,
      child: loading
          ? ListView.separated(
              scrollDirection: Axis.horizontal,
              cacheExtent: 240,
              itemCount: 6,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (_, _) => Container(
                width: DealProductCardDimensions.width,
                decoration: BoxDecoration(
                  color: AppColors.mobileSurface,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            )
          : ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              cacheExtent: 240,
              itemCount: rowProducts.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final product = rowProducts[index];
                return _HomeDealProductCard(
                  product: product,
                  onAdd: (ctx) => _handleAdd(ref, product, ctx),
                  onIncrease: () => _handleIncrease(ref, product, context),
                  onDecrease: () => _handleDecrease(ref, product),
                );
              },
            ),
    );
  }
}

/// Isolates cart rebuilds to the single card whose quantity changed.
class _HomeDealProductCard extends ConsumerWidget {
  const _HomeDealProductCard({
    required this.product,
    required this.onAdd,
    required this.onIncrease,
    required this.onDecrease,
  });

  final Product product;
  final void Function(BuildContext context) onAdd;
  final VoidCallback onIncrease;
  final VoidCallback onDecrease;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final qty = ref.watch(cartProductQuantityProvider(product.id));

    return DealProductCard(
      product: product,
      cartQuantity: qty,
      onAdd: onAdd,
      onIncrease: onIncrease,
      onDecrease: onDecrease,
    );
  }
}
