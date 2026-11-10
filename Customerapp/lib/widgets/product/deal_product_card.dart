import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/product_pricing.dart';
import '../../features/cart/cart_controller.dart';
import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../common/app_network_image.dart';
import 'variant_bottom_sheet.dart';

/// Dimensions so every product card is identical in grids and carousels.
class DealProductCardDimensions {
  const DealProductCardDimensions._();

  static const double width = 100;
  static const double height = 196;
  static const double gridChildAspectRatio = 0.555;
  static const double twoColumnChildAspectRatio = 0.64;
  static const double homeDealsGridAspectRatio = 0.555;
}

class DealProductCard extends ConsumerWidget {
  const DealProductCard({
    super.key,
    required this.product,
    required this.onAdd,
    this.flat = false,
    this.fillCell = false,
    this.cartQuantity = 0,
    this.onIncrease,
    this.onDecrease,
  });

  final Product product;
  final void Function(BuildContext context) onAdd;
  final bool flat;
  final bool fillCell;
  final int cartQuantity;
  final VoidCallback? onIncrease;
  final VoidCallback? onDecrease;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final discount = product.discountedPercent > 0
        ? product.discountedPercent.round()
        : (product.price > 0
            ? (((product.price - product.discountedPrice) / product.price) * 100)
                .round()
            : 0);
    final hasVariants = isMultiVariant(product);
    final effectiveCartQuantity = hasVariants
        ? ref.watch(
            cartControllerProvider.select(
              (state) => state.items
                  .where((item) => item.id == product.id)
                  .fold<int>(0, (sum, item) => sum + item.quantity),
            ),
          )
        : cartQuantity;

    if (fillCell) {
      return LayoutBuilder(
        builder: (context, constraints) {
          return SizedBox(
            width: constraints.maxWidth,
            height: constraints.maxHeight,
            child: _buildCardShell(
              context,
              discount,
              ref: ref,
              effectiveCartQuantity: effectiveCartQuantity,
            ),
          );
        },
      );
    }

    return SizedBox(
      width: DealProductCardDimensions.width,
      height: DealProductCardDimensions.height,
      child: _buildCardShell(
        context,
        discount,
        ref: ref,
        effectiveCartQuantity: effectiveCartQuantity,
      ),
    );
  }

  Widget _buildCardShell(
    BuildContext context,
    int discount, {
    required WidgetRef ref,
    required int effectiveCartQuantity,
    EdgeInsets outerPadding = EdgeInsets.zero,
  }) {
    final inStock = product.stock > 0;
    final salePrice = product.discountedPrice > 0 ? product.discountedPrice : product.price;
    final originalPrice = product.price;
    final hasDiscount = discount > 0 && originalPrice > salePrice;

    String unitText = '1 pc';
    if (product.variants.isNotEmpty && product.variants.first.name.isNotEmpty) {
      unitText = product.variants.first.name;
    } else if (product.unit.trim().isNotEmpty) {
      unitText = product.unit.trim();
    }

    final card = Container(
      color: Colors.transparent, // No outer border box
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. IMAGE BOX ONLY has the border and rounded corners
          AspectRatio(
            aspectRatio: 1.0,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  GestureDetector(
                    onTap: product.id.length > 10
                        ? () => context.push('/product/${product.id}')
                        : null,
                    child: ColoredBox(
                      color: Colors.white,
                      child: (product.primaryImage != null && product.primaryImage!.trim().isNotEmpty)
                          ? AppNetworkImage(
                              imageUrl: product.primaryImage!,
                              fit: BoxFit.cover,
                              errorIcon: Icons.image_outlined,
                            )
                          : const AppImagePlaceholder(fit: BoxFit.contain),
                    ),
                  ),

                  if (!inStock)
                    Container(
                      color: Colors.white.withValues(alpha: 0.8),
                      alignment: Alignment.center,
                      child: const Text(
                        'OUT OF STOCK',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF374151),
                        ),
                      ),
                    ),

                  // Blue Discount Ribbon Badge (Top Left of Image Box)
                  if (hasDiscount)
                    Positioned(
                      left: 0,
                      top: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                        decoration: const BoxDecoration(
                          color: Color(0xFF2874F0),
                          borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(12),
                            bottomRight: Radius.circular(8),
                          ),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '$discount%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                height: 1.0,
                              ),
                            ),
                            const Text(
                              'OFF',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.w900,
                                height: 1.0,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                ],
              ),
            ),
          ),

          // 2. DETAILS SECTION BELOW IMAGE CONTAINER (Flexible Column preventing overflow)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 6.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      GestureDetector(
                        onTap: product.id.length > 10
                            ? () => context.push('/product/${product.id}')
                            : null,
                        child: Text(
                          product.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 12.0,
                            color: Color(0xFF1C1C1C),
                            height: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        unitText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 11.0,
                          color: Color(0xFF0A6C38),
                          height: 1.2,
                        ),
                      ),
                      if (product.ratings > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              const Icon(Icons.star_rounded, size: 13, color: Color(0xFF0C831F)),
                              const SizedBox(width: 2),
                              Text(
                                product.ratings.toStringAsFixed(1),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11,
                                  color: Color(0xFF0C831F),
                                  height: 1.0,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),

                  // Bottom Row: Price & ADD Button (Price centered vertically with ADD button)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Left: Price Column
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '₹${salePrice.toInt()}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                color: Color(0xFF1C1C1C),
                                height: 1.0,
                              ),
                            ),
                            if (hasDiscount) ...[
                              const SizedBox(height: 2),
                              Text(
                                '₹${originalPrice.toInt()}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w500,
                                  fontSize: 10,
                                  color: Color(0xFF9CA3AF),
                                  decoration: TextDecoration.lineThrough,
                                  height: 1.0,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),

                      // Right: ADD Button / Stepper
                      _buildCartAction(
                        context,
                        ref,
                        inStock,
                        effectiveCartQuantity,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );

    if (outerPadding == EdgeInsets.zero) {
      return card;
    }

    return Padding(
      padding: outerPadding,
      child: card,
    );
  }

  Widget _buildCartAction(
    BuildContext context,
    WidgetRef ref,
    bool inStock,
    int effectiveCartQuantity,
  ) {
    final hasVariants = isMultiVariant(product);
    if (hasVariants) {
      void openVariants() => _openVariantPicker(context);
      if (effectiveCartQuantity > 0) {
        return Container(
          height: 30,
          decoration: BoxDecoration(
            color: const Color(0xFF0C831F),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              InkWell(
                onTap: openVariants,
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6),
                  child: Text(
                    '−',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              Text(
                '$effectiveCartQuantity',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 11,
                  color: Colors.white,
                ),
              ),
              InkWell(
                onTap: inStock ? openVariants : null,
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6),
                  child: Text(
                    '+',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      }
      return SizedBox(
        height: 30,
        child: OutlinedButton(
          onPressed: inStock ? openVariants : null,
          style: OutlinedButton.styleFrom(
            elevation: 0,
            minimumSize: const Size(54, 30),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            side: BorderSide(
              color: inStock ? const Color(0xFF0C831F) : const Color(0xFFD1D5DB),
              width: 1,
            ),
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: Text(
            inStock ? 'ADD' : 'OUT',
            style: TextStyle(
              color: inStock ? const Color(0xFF0C831F) : const Color(0xFF9CA3AF),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.3,
            ),
          ),
        ),
      );
    }

    final VoidCallback handleDecrease = onDecrease ??
        () {
          final items = ref.read(cartControllerProvider).items;
          CartItem? match;
          for (final i in items) {
            if (i.id == product.id) {
              match = i;
              break;
            }
          }
          if (match != null) {
            if (match.quantity > 1) {
              ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
                    productId: product.id,
                    quantity: match.quantity - 1,
                    variantName: match.variantName,
                    colorName: match.colorName,
                  );
            } else {
              ref.read(cartControllerProvider.notifier).removeFromCartLine(
                    productId: product.id,
                    variantName: match.variantName,
                    colorName: match.colorName,
                  );
            }
          }
        };

    final VoidCallback handleIncrease = onIncrease ??
        () {
          final items = ref.read(cartControllerProvider).items;
          CartItem? match;
          for (final i in items) {
            if (i.id == product.id) {
              match = i;
              break;
            }
          }
          if (match != null) {
            ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
                  productId: product.id,
                  quantity: match.quantity + 1,
                  variantName: match.variantName,
                  colorName: match.colorName,
                );
          } else {
            onAdd(context);
          }
        };

    if (effectiveCartQuantity > 0) {
      return Container(
        height: 30,
        decoration: BoxDecoration(
          color: const Color(0xFF0C831F),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            InkWell(
              onTap: handleDecrease,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(8),
                bottomLeft: Radius.circular(8),
              ),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Text(
                  '−',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Text(
                '$effectiveCartQuantity',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 11,
                  color: Colors.white,
                ),
              ),
            ),
            InkWell(
              onTap: inStock ? handleIncrease : null,
              borderRadius: const BorderRadius.only(
                topRight: Radius.circular(8),
                bottomRight: Radius.circular(8),
              ),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Text(
                  '+',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return SizedBox(
      height: 30,
      child: Builder(
        builder: (buttonContext) => OutlinedButton(
          onPressed: inStock ? () => onAdd(buttonContext) : null,
          style: OutlinedButton.styleFrom(
            elevation: 0,
            minimumSize: const Size(54, 30),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            side: BorderSide(
              color: inStock ? const Color(0xFF0C831F) : const Color(0xFFD1D5DB),
              width: 1,
            ),
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: Text(
            inStock ? 'ADD' : 'OUT',
            style: TextStyle(
              color: inStock ? const Color(0xFF0C831F) : const Color(0xFF9CA3AF),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.3,
            ),
          ),
        ),
      ),
    );
  }

  void _openVariantPicker(BuildContext context) {
    showVariantBottomSheet(context, product);
  }
}

