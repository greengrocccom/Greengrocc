import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routes/route_paths.dart';
import '../home_providers.dart';
import 'home_product_row.dart';

class JustArrivedSection extends ConsumerWidget {
  const JustArrivedSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(justArrivedProvider);

    return productsAsync.when(
      loading: () => HomeProductRow(
        title: 'Just Arrived',
        emoji: '✨',
        onViewAll: () => context.push(RoutePaths.justArrived),
        products: const [],
        loading: true,
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (products) => HomeProductRow(
        title: 'Just Arrived',
        emoji: '✨',
        onViewAll: () => context.push(RoutePaths.justArrived),
        products: products,
        loading: false,
      ),
    );
  }
}
