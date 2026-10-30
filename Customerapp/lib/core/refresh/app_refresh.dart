import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/home/home_providers.dart';

Future<void> refreshHomeData(WidgetRef ref) async {
  ref.invalidate(siteBannersProvider);
  ref.invalidate(categoriesProvider);
  ref.invalidate(departmentCategoriesProvider);
  ref.invalidate(brandsProvider);
  ref.invalidate(justArrivedProvider);
  ref.invalidate(hotSellingProvider);
  ref.invalidate(recentlyViewedProductsProvider);
  ref.invalidate(mostViewedProductsProvider);
  ref.invalidate(previouslyBoughtProvider);
  ref.invalidate(suggestedProductsProvider);
  ref.invalidate(categoryPreviewProductsProvider);

  await Future.wait([
    ref.read(categoriesProvider.future),
    ref.read(justArrivedProvider.future),
    ref.read(hotSellingProvider.future),
  ]);
}
