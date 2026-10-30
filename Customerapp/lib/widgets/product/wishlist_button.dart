import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../models/product.dart';
import '../../features/wishlist/wishlist_controller.dart';

class WishlistButton extends ConsumerWidget {
  const WishlistButton({
    super.key,
    required this.product,
    this.size = 32,
  });

  final Product product;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (product.id.length < 10) return const SizedBox.shrink();

    final active = ref.watch(
      wishlistIdsProvider.select((ids) => ids.contains(product.id)),
    );

    return Material(
      color: Colors.white.withValues(alpha: 0.95),
      shape: const CircleBorder(),
      elevation: 1,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => ref.read(wishlistControllerProvider.notifier).toggleWishlist(
              product,
              flySourceContext: context,
            ),
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(
            active ? Icons.favorite : Icons.favorite_border,
            size: size * 0.5,
            color: active ? AppColors.primary : Colors.grey.shade600,
          ),
        ),
      ),
    );
  }
}
