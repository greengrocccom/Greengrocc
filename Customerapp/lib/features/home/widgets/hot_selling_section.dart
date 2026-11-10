import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routes/route_paths.dart';
import '../home_providers.dart';
import 'home_product_row.dart';

class HotSellingSection extends ConsumerWidget {
  const HotSellingSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(hotSellingProvider);

    return productsAsync.when(
      loading: () => HomeProductRow(
        title: 'Hot Selling Products',
        emoji: '🔥',
        tint: HomeSectionTint.pink,
        onViewAll: () => context.push(RoutePaths.hotSelling),
        products: const [],
        loading: true,
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (products) => HomeProductRow(
        title: 'Hot Selling Products',
        emoji: '🔥',
        tint: HomeSectionTint.pink,
        onViewAll: () => context.push(RoutePaths.hotSelling),
        products: products,
        loading: false,
      ),
    );
  }
}
