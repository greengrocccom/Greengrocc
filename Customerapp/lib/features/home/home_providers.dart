import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/location_provider.dart';
import '../../core/utils/department_utils.dart';
import '../../core/utils/recently_viewed.dart';
import '../../models/category.dart';
import '../../models/product.dart';
import '../../models/site_banner.dart';
import '../auth/auth_controller.dart';

const homeProductLimit = 12;

class SelectedStoreTabNotifier extends Notifier<String> {
  @override
  String build() => 'main';

  void setStore(String key) => state = key;
}

final selectedStoreTabProvider =
    NotifierProvider<SelectedStoreTabNotifier, String>(SelectedStoreTabNotifier.new);

List<Category> _shopCategories(List<Category> categories) => categories
    .where(
      (category) =>
          category.isActive &&
          category.categoryName.toLowerCase() != 'most purchase',
    )
    .toList();

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  ref.watch(deliveryLocationKeyProvider);
  final currentStore = ref.watch(selectedStoreTabProvider);
  String sectionParam;
  if (currentStore == 'festive' || currentStore == 'ready2cook') {
    sectionParam = 'ready2cook';
  } else if (currentStore == 'mall' || currentStore == 'instantorder') {
    sectionParam = 'instantorder';
  } else {
    sectionParam = 'preorder';
  }

  final categories =
      await ref.read(apiServiceProvider).fetchCategories(section: sectionParam, live: ref);
  return _shopCategories(categories);
});

/// Categories for one department ('preorder' | 'ready2cook' | 'instantorder').
/// With a delivery location, the backend returns only what the nearest dark
/// store has products in.
final departmentCategoriesProvider =
    FutureProvider.family<List<Category>, String>((ref, section) async {
  ref.watch(deliveryLocationKeyProvider);
  final categories = await ref.read(apiServiceProvider).fetchCategories(section: section, live: ref);
  return _shopCategories(categories);
});

class CategoryPreviewParam {
  const CategoryPreviewParam({
    required this.categoryName,
    required this.currentStore,
  });

  final String categoryName;
  final String currentStore;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CategoryPreviewParam &&
          runtimeType == other.runtimeType &&
          categoryName == other.categoryName &&
          currentStore == other.currentStore;

  @override
  int get hashCode => Object.hash(categoryName, currentStore);
}

/// Six-product preview for one category row on home. Cached per category and department.
final categoryPreviewProductsProvider =
    FutureProvider.family<List<Product>, CategoryPreviewParam>((ref, param) async {
  ref.watch(deliveryLocationKeyProvider);
  String sectionParam;
  if (param.currentStore == 'festive' || param.currentStore == 'ready2cook') {
    sectionParam = 'ready2cook';
  } else if (param.currentStore == 'mall' || param.currentStore == 'instantorder') {
    sectionParam = 'instantorder';
  } else {
    sectionParam = 'preorder';
  }

  final products = await ref.read(apiServiceProvider).fetchProducts({
    'categoryName': param.categoryName,
    'section': sectionParam,
    'limit': 12,
  }, ref);

  final activeDept = departmentForSection(sectionParam);
  return products
      .where((p) => p.isActive && p.department == activeDept)
      .take(6)
      .toList();
});

final brandsProvider = FutureProvider((ref) async {
  final brands = await ref.read(apiServiceProvider).fetchBrands();
  return brands.where((brand) => brand.isActive).toList();
});

final testimonialsProvider = FutureProvider((ref) async {
  final items = await ref.read(apiServiceProvider).fetchTestimonials();
  return items.where((item) => item.isActive).toList();
});

/// Website banner section for a store tab (`bannerSectionFor`).
String bannerSectionForStore(String store) {
  if (store == 'festive' || store == 'ready2cook') return 'ready2cook';
  if (store == 'mall' || store == 'instantorder') return 'instantorder';
  return 'preorder';
}

typedef BannerSlot = ({String section, String placement});

/// Admin → Banners for one section + placement (hero, stories, mid, offer, category).
final siteBannersProvider =
    FutureProvider.family<List<SiteBanner>, BannerSlot>((ref, slot) async {
  return ref
      .read(apiServiceProvider)
      .fetchSiteBanners(section: slot.section, placement: slot.placement, live: ref);
});

/// Main-tab rows show PreOrder products only.
List<Product> _mergeUnique(List<List<Product>> lists, int limit) {
  final seen = <String>{};
  final out = <Product>[];
  for (final list in lists) {
    for (final p in list) {
      if (!p.isActive || p.department != Department.preorder || !seen.add(p.id)) continue;
      out.add(p);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/// Website: `justArrived=true&limit=16`, topped up with the newest products.
final justArrivedProvider = FutureProvider<List<Product>>((ref) async {
  ref.watch(deliveryLocationKeyProvider);
  const limit = 16;
  final api = ref.read(apiServiceProvider);
  final arrived = await api.fetchProducts(
    {'justArrived': true, 'section': 'preorder', 'limit': limit},
    ref,
  );
  if (_mergeUnique([arrived], limit).length >= limit) {
    return _mergeUnique([arrived], limit);
  }
  final newest =
      await api.fetchProducts({'sort': 'newest', 'section': 'preorder', 'limit': 32}, ref);
  return _mergeUnique([arrived, newest], limit);
});

/// Website "Most viewed": viewed products first, then hot-selling, then newest.
final mostViewedProductsProvider = FutureProvider<List<Product>>((ref) async {
  ref.watch(deliveryLocationKeyProvider);
  const limit = 16;
  final api = ref.read(apiServiceProvider);
  final ids = (await RecentlyViewedStore.getIds()).take(limit).toList();
  var viewed = <Product>[];
  if (ids.isNotEmpty) {
    final fetched = await api.fetchProducts({'ids': ids.join(','), 'limit': limit}, ref);
    final byId = {for (final p in fetched) p.id: p};
    viewed = ids.map((id) => byId[id]).whereType<Product>().toList();
  }
  if (_mergeUnique([viewed], limit).length >= limit) return _mergeUnique([viewed], limit);
  final hot = await api.fetchProducts(
    {'hotSelling': true, 'sort': 'newest', 'section': 'preorder', 'limit': 32},
    ref,
  );
  final merged = _mergeUnique([viewed, hot], limit);
  if (merged.length >= limit) return merged;
  final newest =
      await api.fetchProducts({'sort': 'newest', 'section': 'preorder', 'limit': 32}, ref);
  return _mergeUnique([viewed, hot, newest], limit);
});

/// Website "Previously bought": products from the user's recent orders.
final previouslyBoughtProvider = FutureProvider<List<Product>>((ref) async {
  final isLoggedIn = ref.watch(authControllerProvider.select((s) => s.isLoggedIn));
  ref.watch(authControllerProvider.select((s) => s.user?.id));
  if (!isLoggedIn) return const [];
  final api = ref.read(apiServiceProvider);
  final orders = await api.fetchMyOrders();
  orders.sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));
  final ids = <String>[];
  for (final order in orders) {
    final status = order.status.toLowerCase();
    if (status == 'cancelled' || status == 'attempted' || status == 'return') continue;
    for (final item in order.items) {
      if (item.productId.isNotEmpty && !ids.contains(item.productId)) ids.add(item.productId);
      if (ids.length >= 12) break;
    }
    if (ids.length >= 12) break;
  }
  if (ids.isEmpty) return const [];
  final fetched = await api.fetchProducts({'ids': ids.join(','), 'limit': 12}, ref);
  final byId = {for (final p in _mergeUnique([fetched], 12)) p.id: p};
  return ids.map((id) => byId[id]).whereType<Product>().take(8).toList();
});

/// Website "Suggested for You": catalog default order (`limit=12`).
final suggestedProductsProvider = FutureProvider<List<Product>>((ref) async {
  ref.watch(deliveryLocationKeyProvider);
  final products =
      await ref.read(apiServiceProvider).fetchProducts({'section': 'preorder', 'limit': 12}, ref);
  return _mergeUnique([products], 12);
});

/// Ready2Cook / Instant home: the department's products (website FestiveStoreSection).
final departmentProductsProvider =
    FutureProvider.family<List<Product>, String>((ref, section) async {
  ref.watch(deliveryLocationKeyProvider);
  final products =
      await ref.read(apiServiceProvider).fetchProducts({'section': section, 'limit': 40}, ref);
  final dept = departmentForSection(section);
  return products.where((p) => p.isActive && p.department == dept).toList();
});

final hotSellingProvider = FutureProvider<List<Product>>((ref) async {
  ref.watch(deliveryLocationKeyProvider);
  final products = await ref.read(apiServiceProvider).fetchProducts({
    'hotSelling': true,
    'section': 'preorder',
    'limit': homeProductLimit,
  }, ref);
  return products
      .where((product) => product.isActive && product.department == Department.preorder)
      .take(homeProductLimit)
      .toList();
});

final recentlyViewedProductsProvider = FutureProvider<List<Product>>((ref) async {
  ref.watch(deliveryLocationKeyProvider);
  final ids = (await RecentlyViewedStore.getIds()).take(homeProductLimit).toList();
  if (ids.isEmpty) return const [];

  final products = await ref.read(apiServiceProvider).fetchProducts({
    'ids': ids.join(','),
    'limit': homeProductLimit,
  }, ref);
  final active = products.where((product) => product.isActive).toList();
  final byId = {for (final product in active) product.id: product};

  return ids.map((id) => byId[id]).whereType<Product>().toList();
});

enum FeaturedProductFilter { justArrived, hotSelling }
