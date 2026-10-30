import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/utils/currency_formatter.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/cart/cart_controller.dart';
import '../../models/cart_item.dart';
import '../../models/order.dart';
import '../../models/product.dart';
import '../../widgets/common/app_network_image.dart';

const _brandGreen = Color(0xFF0C831F);
const _slate900 = Color(0xFF0F172A);
const _slate500 = Color(0xFF64748B);
const _slate200 = Color(0xFFE2E8F0);

class BuyAgainCard extends ConsumerWidget {
  const BuyAgainCard({
    super.key,
    required this.item,
    this.order,
    this.width = 136,
  });

  final OrderItem item;
  final Order? order;
  final double width;

  CartItem? _findCartLine(List<CartItem> items) {
    for (final cartItem in items) {
      if (cartItem.id != item.productId) continue;
      if (cartItem.variantName.trim() != item.variantName.trim()) continue;
      if (cartItem.colorName.trim() != item.colorName.trim()) continue;
      return cartItem;
    }
    return null;
  }

  Product _toProduct() {
    return Product(
      id: item.productId,
      name: item.name,
      categories: const [],
      subcategory: '',
      brandName: item.brandName,
      price: item.price,
      discountedPrice: item.price,
      discountedPercent: 0,
      stock: 100,
      productImages: item.image.isNotEmpty ? [item.image] : const [],
    );
  }

  Future<void> _handleAdd(WidgetRef ref, BuildContext context) async {
    final product = _toProduct();
    final result = await ref.read(cartControllerProvider.notifier).addToCart(
          product,
          1,
          variantName: item.variantName,
          colorName: item.colorName,
          flySourceContext: context,
        );
    if (result == AddToCartResult.requiresLogin) {
      ref.read(authControllerProvider.notifier).openAuthModal();
    }
  }

  Future<void> _handleIncrease(WidgetRef ref, BuildContext context) async {
    final cartLine = _findCartLine(ref.read(cartControllerProvider).items);
    if (cartLine != null) {
      await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
            productId: cartLine.id,
            quantity: cartLine.quantity + 1,
            variantName: cartLine.variantName,
            colorName: cartLine.colorName,
          );
      return;
    }
    await _handleAdd(ref, context);
  }

  Future<void> _handleDecrease(WidgetRef ref) async {
    final cartLine = _findCartLine(ref.read(cartControllerProvider).items);
    if (cartLine == null) return;

    if (cartLine.quantity <= 1) {
      await ref.read(cartControllerProvider.notifier).removeFromCartLine(
            productId: cartLine.id,
            variantName: cartLine.variantName,
            colorName: cartLine.colorName,
          );
      return;
    }

    await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
          productId: cartLine.id,
          quantity: cartLine.quantity - 1,
          variantName: cartLine.variantName,
          colorName: cartLine.colorName,
        );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartQuantity = ref.watch(
      cartControllerProvider.select((s) {
        for (final cartItem in s.items) {
          if (cartItem.id != item.productId) continue;
          if (cartItem.variantName.trim() != item.variantName.trim()) continue;
          if (cartItem.colorName.trim() != item.colorName.trim()) continue;
          return cartItem.quantity;
        }
        return 0;
      }),
    );

    final variantText = item.variantName.trim().isNotEmpty
        ? item.variantName.trim()
        : (item.brandName.trim().isNotEmpty ? item.brandName.trim() : '1 unit');
    final openProduct = item.productId.isNotEmpty
        ? () => context.push('/product/${item.productId}')
        : null;

    return SizedBox(
      width: width,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          AspectRatio(
            aspectRatio: 1.0,
            child: Material(
              color: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: _slate200),
              ),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: openProduct,
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: item.image.isNotEmpty
                      ? AppNetworkImage(
                          imageUrl: item.image,
                          fit: BoxFit.contain,
                          cacheWidth: 200,
                        )
                      : const Center(
                          child: Icon(
                            Icons.image_outlined,
                            color: AppColors.textMuted,
                            size: 32,
                          ),
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: openProduct,
            child: Text(
              item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _slate900,
                height: 1.25,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            variantText,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              color: _slate500,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  formatInr(item.price),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Colors.black,
                  ),
                ),
              ),
              if (cartQuantity > 0)
                Container(
                  height: 28,
                  decoration: BoxDecoration(
                    color: _brandGreen,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _CompactQtyButton(
                        icon: Icons.remove,
                        onTap: () => _handleDecrease(ref),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: Text(
                          '$cartQuantity',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      _CompactQtyButton(
                        icon: Icons.add,
                        onTap: () => _handleIncrease(ref, context),
                      ),
                    ],
                  ),
                )
              else
                SizedBox(
                  height: 28,
                  child: OutlinedButton(
                    onPressed: () => _handleAdd(ref, context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _brandGreen,
                      backgroundColor: Colors.white,
                      side: const BorderSide(color: _brandGreen),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'ADD',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          if (order != null && order!.isPreOrder) ...[
            const SizedBox(height: 6),
            SizedBox(
              width: double.infinity,
              height: 28,
              child: OutlinedButton.icon(
                onPressed: () {
                  context.push('/orders/${order!.id}/track?productId=${item.productId}');
                },
                icon: const Icon(Icons.timeline_rounded, size: 13, color: _brandGreen),
                label: const Text(
                  'Track Order',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: _brandGreen,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _brandGreen,
                  backgroundColor: const Color(0xFFF0FDF4),
                  side: const BorderSide(color: Color(0xFF86EFAC), width: 1),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CompactQtyButton extends StatelessWidget {
  const _CompactQtyButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          child: Icon(icon, size: 14, color: Colors.white),
        ),
      ),
    );
  }
}
