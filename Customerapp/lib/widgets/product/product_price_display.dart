import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/product_pricing.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/auth_state.dart';
import '../../features/home/home_providers.dart';
import '../../models/brand.dart';
import '../../models/product.dart';

enum ProductPriceSize { sm, md, lg }

bool brandRequiresLoginForPrice(List<Brand> brands, String brandName) {
  final name = brandName.trim().toLowerCase();
  if (name.isEmpty) return false;
  return brands.any(
    (brand) =>
        brand.priceRequiresLogin &&
        brand.brandName.trim().toLowerCase() == name,
  );
}

class ProductPriceDisplay extends ConsumerWidget {
  const ProductPriceDisplay({
    super.key,
    required this.product,
    this.variantName = '',
    this.quantity,
    this.size = ProductPriceSize.md,
  });

  final Product product;
  final String variantName;
  final int? quantity;
  final ProductPriceSize size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isLoggedIn = ref.watch(authControllerProvider.select((s) => s.isLoggedIn));
    final brands = ref.watch(brandsProvider).value ?? const <Brand>[];
    final canViewPrice =
        isLoggedIn || !brandRequiresLoginForPrice(brands, product.brandName);

    if (!canViewPrice) {
      final style = switch (size) {
        ProductPriceSize.sm => const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppColors.primary,
            height: 1.1,
          ),
        ProductPriceSize.md => const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.primary,
            height: 1.1,
          ),
        ProductPriceSize.lg => const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.primary,
            height: 1.1,
          ),
      };

      return GestureDetector(
        onTap: () => ref.read(authControllerProvider.notifier).openAuthModal(AuthModalMode.login),
        child: Text(
          'Login to see price',
          style: style,
        ),
      );
    }

    final info = getProductListPriceInfo(product, variantName, quantity);
    if (info.salePrice <= 0) {
      return const SizedBox.shrink();
    }

    final originalStyle = switch (size) {
      ProductPriceSize.sm => const TextStyle(
          fontSize: 11,
          color: AppColors.textMuted,
          decoration: TextDecoration.lineThrough,
          height: 1.1,
        ),
      ProductPriceSize.md => const TextStyle(
          fontSize: 12,
          color: AppColors.textMuted,
          decoration: TextDecoration.lineThrough,
          height: 1.1,
        ),
      ProductPriceSize.lg => const TextStyle(
          fontSize: 14,
          color: AppColors.textMuted,
          decoration: TextDecoration.lineThrough,
          height: 1.1,
        ),
    };

    final saleStyle = switch (size) {
      ProductPriceSize.sm => const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
          height: 1.1,
        ),
      ProductPriceSize.md => const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
          height: 1.1,
        ),
      ProductPriceSize.lg => const TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
          height: 1.1,
        ),
    };

    final saleLabel = formatInr(info.salePrice, withDecimals: true);

    if (size == ProductPriceSize.sm) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (info.hasDiscount) ...[
            Flexible(
              child: Text(
                formatInr(info.originalPrice, withDecimals: true),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: originalStyle,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              saleLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: saleStyle,
            ),
          ),
        ],
      );
    }

    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 2,
      children: [
        if (info.hasDiscount)
          Text(
            formatInr(info.originalPrice, withDecimals: true),
            style: originalStyle,
          ),
        Text(saleLabel, style: saleStyle),
      ],
    );
  }
}
