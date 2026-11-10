import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/product.dart';
import '../../../routes/route_paths.dart';
import '../home_providers.dart';
import 'home_product_row.dart';

/// One horizontal product row fed by [provider]; hidden when empty or on error.
class _ProviderRow extends ConsumerWidget {
  const _ProviderRow({
    required this.provider,
    required this.title,
    required this.emoji,
    required this.viewAll,
    this.tint,
  });

  final FutureProvider<List<Product>> provider;
  final String title;
  final String emoji;
  final String viewAll;
  final HomeSectionTint? tint;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(provider).when(
          loading: () => HomeProductRow(
            title: title,
            emoji: emoji,
            tint: tint,
            onViewAll: () => context.push(viewAll),
            products: const [],
            loading: true,
          ),
          error: (_, _) => const SizedBox.shrink(),
          data: (products) => HomeProductRow(
            title: title,
            emoji: emoji,
            tint: tint,
            onViewAll: () => context.push(viewAll),
            products: products,
            loading: false,
          ),
        );
  }
}

class MostViewedSection extends StatelessWidget {
  const MostViewedSection({super.key});

  @override
  Widget build(BuildContext context) => _ProviderRow(
        provider: mostViewedProductsProvider,
        title: 'Most viewed',
        emoji: '👀',
        tint: HomeSectionTint.blue,
        viewAll: RoutePaths.product,
      );
}

/// Shown only for signed-in users with past orders (website `BestDeals`).
class PreviouslyBoughtSection extends ConsumerWidget {
  const PreviouslyBoughtSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(previouslyBoughtProvider).value ?? const <Product>[];
    if (products.isEmpty) return const SizedBox.shrink();
    return HomeProductRow(
      title: 'Previously bought',
      emoji: '🔁',
      onViewAll: () => context.go(RoutePaths.orders),
      products: products,
      loading: false,
    );
  }
}

/// Ready2Cook / Instant home row: that department's products only.
class DepartmentSuggestedSection extends ConsumerWidget {
  const DepartmentSuggestedSection({super.key, required this.section});

  final String section;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(departmentProductsProvider(section)).value ?? const <Product>[];
    if (products.isEmpty) return const SizedBox.shrink();
    return HomeProductRow(
      title: section == 'instantorder' ? 'Instant bestsellers' : 'Suggested for you',
      emoji: section == 'instantorder' ? '⚡' : '💚',
      tint: HomeSectionTint.mint,
      onViewAll: () => context.push('${RoutePaths.product}?section=$section'),
      products: products.take(16).toList(),
      loading: false,
    );
  }
}

/// Website "Suggested for You": the list split across two scroll rows.
class SuggestedForYouSection extends ConsumerWidget {
  const SuggestedForYouSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(suggestedProductsProvider).value ?? const <Product>[];
    if (products.isEmpty) return const SizedBox.shrink();
    final half = (products.length / 2).ceil();
    return HomeProductRow(
      title: 'Suggested for You',
      emoji: '💚',
      tint: HomeSectionTint.mint,
      onViewAll: () => context.push(RoutePaths.product),
      products: products.take(half).toList(),
      secondRow: products.skip(half).toList(),
      loading: false,
    );
  }
}
