import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../config/theme.dart';
import '../../core/utils/product_pricing.dart';
import '../../features/cart/cart_controller.dart';
import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../../models/product_pricing_models.dart';
import '../common/app_network_image.dart';

const _green = Color(0xFF0C831F);

/// Bottom sheet listing a product's varieties.
Future<void> showVariantBottomSheet(BuildContext context, Product product) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => VariantBottomSheet(product: product),
  );
}

class VariantBottomSheet extends ConsumerWidget {
  const VariantBottomSheet({super.key, required this.product});

  final Product product;

  CartItem? _lineForVariant(List<CartItem> items, String variantName) {
    for (final item in items) {
      if (item.id != product.id) continue;
      if (item.variantName.trim().toLowerCase() != variantName.trim().toLowerCase()) continue;
      return item;
    }
    return null;
  }

  String _resolveColorName(ProductVariant variant, String variantName) {
    final variantColor = variant.colors.isNotEmpty ? variant.colors.first.name.trim() : '';
    if (variantColor.isNotEmpty) return variantColor;
    final colors = getAvailableColors(product, variantName);
    return colors.isNotEmpty ? colors.first.name : '';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartItems = ref.watch(cartControllerProvider.select((s) => s.items));
    final notifier = ref.read(cartControllerProvider.notifier);
    final variants = product.variants;
    final maxSheetHeight = MediaQuery.sizeOf(context).height * 0.78;

    return Container(
      constraints: BoxConstraints(maxHeight: maxSheetHeight),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 38,
                height: 4.5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 4, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF1C1C1C),
                        height: 1.2,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF6B7280)),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1, color: Color(0xFFF3F4F6)),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                itemCount: variants.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (itemCtx, index) {
                  final variant = variants[index];
                  final variantName = variant.name.trim();
                  final cartLine = _lineForVariant(cartItems, variantName);
                  final quantity = cartLine?.quantity ?? 0;
                  final inStock = isProductInStock(product, variantName);
                  final colorName = cartLine?.colorName ?? _resolveColorName(variant, variantName);
                  final minQty = getMinOrderQuantity(product, variantName);
                  final step = getCartStepForProduct(product, variantName);
                  final price = variant.discountedPrice > 0 ? variant.discountedPrice : variant.price;

                  Future<void> decrease() async {
                    final next = getDecreasedCartQuantityForProduct(product, quantity, variantName);
                    if (next <= 0) {
                      await notifier.removeFromCartLine(
                        productId: product.id,
                        variantName: variantName,
                        colorName: colorName,
                      );
                    } else {
                      await notifier.updateCartLineQuantity(
                        productId: product.id,
                        quantity: next,
                        variantName: variantName,
                        colorName: colorName,
                      );
                    }
                  }

                  return Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF9FAFB),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: product.primaryImage != null
                              ? AppNetworkImage(
                                  imageUrl: product.primaryImage!,
                                  fit: BoxFit.contain,
                                  cacheWidth: 120,
                                  cacheHeight: 120,
                                )
                              : const Icon(Icons.image_outlined,
                                  color: AppColors.textMuted, size: 26),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                variantName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF1F2937),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '₹${price.toInt()}',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF111827),
                                ),
                              ),
                              if (!inStock)
                                Padding(
                                  padding: const EdgeInsets.only(top: 3),
                                  child: Text(
                                    'Out of stock',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10.5,
                                      color: Colors.red.shade600,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (quantity > 0)
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _StepButton(symbol: '−', onTap: decrease),
                              SizedBox(
                                width: 28,
                                child: Text(
                                  '$quantity',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 13,
                                    color: const Color(0xFF111827),
                                  ),
                                ),
                              ),
                              Builder(
                                builder: (plusCtx) => _StepButton(
                                  symbol: '+',
                                  onTap: inStock
                                      ? () => notifier.addToCart(
                                            product,
                                            step,
                                            variantName: variantName,
                                            colorName: colorName,
                                            flySourceContext: plusCtx,
                                          )
                                      : null,
                                ),
                              ),
                            ],
                          )
                        else
                          Builder(
                            builder: (addCtx) => SizedBox(
                              height: 32,
                              child: OutlinedButton(
                                onPressed: inStock
                                    ? () => notifier.addToCart(
                                          product,
                                          minQty,
                                          variantName: variantName,
                                          colorName: colorName,
                                          flySourceContext: addCtx,
                                        )
                                    : null,
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 18),
                                  side: BorderSide(
                                    color: inStock ? _green : const Color(0xFFD1D5DB),
                                    width: 1.2,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ),
                                child: Text(
                                  inStock ? 'ADD' : 'OUT',
                                  style: GoogleFonts.plusJakartaSans(
                                    color: inStock ? _green : const Color(0xFF9CA3AF),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.symbol, required this.onTap});

  final String symbol;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: _green, width: 1.2),
        ),
        child: Text(
          symbol,
          style: const TextStyle(
            fontSize: 16,
            height: 1,
            fontWeight: FontWeight.w800,
            color: _green,
          ),
        ),
      ),
    );
  }
}
