import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/location_provider.dart';
import '../../core/utils/department_utils.dart';
import '../../core/utils/product_pricing.dart';
import '../../core/utils/product_utils.dart';
import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../../routes/route_paths.dart';
import '../../widgets/address/select_delivery_location_sheet.dart';
import '../../widgets/common/app_network_image.dart';
import '../../widgets/layout/shell_bottom_insets.dart';
import '../../widgets/product/deal_product_card.dart';
import '../../widgets/product/product_filter_sheet.dart';
import '../../widgets/product/product_filters_bar.dart';
import '../auth/auth_controller.dart';
import '../cart/cart_controller.dart';
import '../home/home_providers.dart';
import '../home/widgets/category_pills_section.dart';
import 'product_providers.dart';

typedef CatalogKey = ({String category, String section});

final catalogProductsProvider =
    FutureProvider.autoDispose.family<List<Product>, CatalogKey>((ref, key) async {
  ref.watch(deliveryLocationKeyProvider);
  final products = await ref.read(apiServiceProvider).fetchProducts({
    'categoryName': key.category,
    'section': key.section,
    'limit': 200,
  }, ref);
  final dept = departmentForSection(key.section);
  return products.where((p) => p.isActive && p.department == dept).toList();
});

String _sectionForStore(String store) {
  if (store == 'festive' || store == 'ready2cook') return 'ready2cook';
  if (store == 'mall' || store == 'instantorder') return 'instantorder';
  return 'preorder';
}

String catalogUrl(String categoryName, {String baseId = ''}) {
  final params = <String, String>{'categoryName': categoryName};
  if (baseId.isNotEmpty) {
    params['base'] = baseId;
    params['view'] = 'products';
  }
  return Uri(path: RoutePaths.product, queryParameters: params).toString();
}

class BaseCard {
  const BaseCard({
    required this.id,
    required this.title,
    required this.image,
    required this.discount,
    required this.items,
  });

  final String id;
  final String title;
  final String image;
  final int discount;
  final List<Product> items;

  int get count => items.length;
}

String _baseGroupKey(Product p) {
  final baseName = p.baseProductName.trim();
  if (baseName.isNotEmpty) {
    final id = p.baseProductId.trim().isNotEmpty ? p.baseProductId : baseName;
    return 'base:${id.trim().toLowerCase()}';
  }
  final group = p.varietyGroupId.trim();
  if (group.isNotEmpty) return 'group:$group';
  return 'product:${p.id}';
}

String _cleanName(String name) => name
    .replaceAll(RegExp(r'\s*\([^)]*\)'), '')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

String _sharedTitle(List<Product> items) {
  if (items.length == 1) return items.first.name.isEmpty ? 'Product' : items.first.name;
  final parts = items
      .map((p) => _cleanName(p.name).split(' ').where((w) => w.isNotEmpty).toList())
      .toList();
  final shortest = parts.map((w) => w.length).reduce(math.min);
  final suffix = <String>[];
  for (var i = 1; i <= shortest; i++) {
    final word = parts.first[parts.first.length - i];
    final matches = parts.every((w) => w[w.length - i].toLowerCase() == word.toLowerCase());
    if (!matches) break;
    suffix.insert(0, word);
  }
  return suffix.isNotEmpty ? suffix.join(' ') : items.first.name;
}

int _percentOff(double price, double sale, double percent) {
  final computed =
      price > 0 && sale > 0 && sale < price ? ((price - sale) / price * 100).round() : 0;
  return math.max(percent.round(), computed);
}

int _productDiscount(Product p) {
  var best = _percentOff(p.price, p.discountedPrice, p.discountedPercent);
  for (final v in p.variants) {
    best = math.max(best, _percentOff(v.price, v.discountedPrice, 0));
  }
  return best;
}

/// Category → base products, ported from website `groupBaseProducts`.
List<BaseCard> groupBaseProducts(List<Product> products) {
  final groups = <String, List<Product>>{};
  for (final p in products) {
    groups.putIfAbsent(_baseGroupKey(p), () => []).add(p);
  }
  final cards = groups.values.map((items) {
    final lead = items.firstWhere((p) => p.hotSelling, orElse: () => items.first);
    final baseName = items
        .map((p) => p.baseProductName.trim())
        .firstWhere((s) => s.isNotEmpty, orElse: () => '');
    final baseImage = items
        .map((p) => p.baseProductImage.trim())
        .firstWhere((s) => s.isNotEmpty, orElse: () => '');
    final firstImage = items
        .map((p) => p.primaryImage ?? '')
        .firstWhere((s) => s.isNotEmpty, orElse: () => '');
    return BaseCard(
      id: _baseGroupKey(lead),
      title: baseName.isNotEmpty ? baseName : _sharedTitle(items),
      image: baseImage.isNotEmpty ? baseImage : firstImage,
      discount: items.map(_productDiscount).fold(0, math.max),
      items: items,
    );
  }).toList()
    ..sort((a, b) {
      final byCount = b.count.compareTo(a.count);
      return byCount != 0 ? byCount : a.title.compareTo(b.title);
    });
  return cards;
}

final _organicRe = RegExp('organic', caseSensitive: false);

bool _isOrganic(Product p) => _organicRe
    .hasMatch('${p.name} ${p.badge} ${p.certification} ${p.categories.join(' ')}');

bool _matchesBaseFilter(BaseCard card, String filter) {
  switch (filter) {
    case 'seasonal':
      return card.items.any((p) => p.justArrived);
    case 'organic':
      return card.items.any(_isOrganic);
    case 'popular':
      return card.items.any((p) => p.hotSelling || p.badge.isNotEmpty);
  }
  return true;
}

String _productTier(Product p) {
  final blob = '${p.name} ${p.varietyName} ${p.badge}'.toLowerCase();
  if (p.hotSelling || RegExp('bestseller|best seller').hasMatch(blob)) return 'bestseller';
  if (RegExp('premium|royal|alphonso|kesar|special').hasMatch(blob)) return 'premium';
  return 'regular';
}

String _heroTagline(List<Product> items) {
  final raw = items
      .map((p) => p.description)
      .firstWhere((d) => d.isNotEmpty, orElse: () => '')
      .replaceAll(RegExp(r'<[^>]+>'), '');
  final sentence = raw.split('.').first.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (sentence.length > 8 && sentence.length <= 42) return sentence;
  return 'Fresh, juicy, naturally yours';
}

({String title, String kicker}) _bannerCopy(String categoryName) {
  const kicker = 'Premium | Organic | Farm Fresh';
  final key = categoryName.toLowerCase();
  if (key.contains('fruit')) return (title: "Nature's Sweetness\nin Every Bite", kicker: kicker);
  if (key.contains('veg')) return (title: 'Farm Fresh Greens\nin Every Basket', kicker: kicker);
  return (title: categoryName.isEmpty ? 'Shop' : categoryName, kicker: kicker);
}

const _baseFilters = [
  ('all', 'All'),
  ('seasonal', 'Seasonal'),
  ('organic', 'Organic'),
  ('popular', 'Popular'),
];

const _productFilters = [
  ('all', 'All'),
  ('regular', 'Regular'),
  ('premium', 'Premium'),
  ('bestseller', 'Bestseller'),
];

const _brandGreen = Color(0xFF1F6B3A);
const _slate900 = Color(0xFF0F172A);
const _slate400 = Color(0xFF94A3B8);

/// Website `CatalogFlow`: category → base products → products → details.
class CatalogFlowScreen extends ConsumerStatefulWidget {
  const CatalogFlowScreen({super.key, required this.categoryName, this.baseId = ''});

  final String categoryName;
  final String baseId;

  @override
  ConsumerState<CatalogFlowScreen> createState() => _CatalogFlowScreenState();
}

class _CatalogFlowScreenState extends ConsumerState<CatalogFlowScreen> {
  final _searchController = TextEditingController();
  bool _searchOpen = false;
  String _filter = 'all';

  ProductSortOption _sort = ProductSortOption.listingDefault;
  String? _selectedBrand;
  String? _selectedMinDiscount;
  String? _selectedWeightSize;
  String? _selectedPincode;
  String? _selectedMinPrice;
  String? _selectedMaxPrice;
  bool _inStockOnly = false;

  bool get _hasActiveFilters =>
      _sort != ProductSortOption.listingDefault ||
      (_selectedBrand != null && _selectedBrand!.isNotEmpty) ||
      (_selectedMinDiscount != null && _selectedMinDiscount!.isNotEmpty) ||
      (_selectedWeightSize != null && _selectedWeightSize!.isNotEmpty) ||
      (_selectedPincode != null && _selectedPincode!.isNotEmpty) ||
      (_selectedMinPrice != null && _selectedMinPrice!.isNotEmpty) ||
      (_selectedMaxPrice != null && _selectedMaxPrice!.isNotEmpty) ||
      _inStockOnly;

  int get _activeFilterCount {
    int count = 0;
    if (_sort != ProductSortOption.listingDefault) count++;
    if (_selectedBrand?.isNotEmpty ?? false) count++;
    if (_selectedMinDiscount?.isNotEmpty ?? false) count++;
    if (_selectedWeightSize?.isNotEmpty ?? false) count++;
    if (_selectedPincode?.isNotEmpty ?? false) count++;
    if (_selectedMinPrice?.isNotEmpty ?? false) count++;
    if (_selectedMaxPrice?.isNotEmpty ?? false) count++;
    if (_inStockOnly) count++;
    return count;
  }

  void _clearListingFilters() {
    setState(() {
      _sort = ProductSortOption.listingDefault;
      _selectedBrand = null;
      _selectedMinDiscount = null;
      _selectedWeightSize = null;
      _selectedPincode = null;
      _selectedMinPrice = null;
      _selectedMaxPrice = null;
      _inStockOnly = false;
    });
  }

  void _openFilterSheet(List<Product> products) {
    final allBrands = <String>{
      ...extractBrands(products),
      ...(ref.read(brandsProvider).value?.map((b) => b.brandName) ?? const <String>[]),
    }.where((b) => b.isNotEmpty).toList();
    allBrands.sort();

    showProductFilterBottomSheet(
      context: context,
      brands: allBrands,
      currentBrand: _selectedBrand,
      currentSort: _sort,
      currentMinPrice: _selectedMinPrice,
      currentMaxPrice: _selectedMaxPrice,
      currentMinDiscount: _selectedMinDiscount,
      currentPincode: _selectedPincode ?? ref.read(deliveryLocationProvider)?.pincode,
      currentWeightSize: _selectedWeightSize,
      weightsSizes: extractWeightsAndSizes(products),
      currentInStockOnly: _inStockOnly,
      currentSearch: _needle.isNotEmpty ? _needle : null,
      onApply: ({
        brand,
        sort,
        minPrice,
        maxPrice,
        minDiscount,
        pincode,
        weightSize,
        inStockOnly = false,
        searchQuery,
      }) {
        setState(() {
          if (sort != null) _sort = sort;
          _selectedBrand = brand;
          _selectedMinPrice = minPrice;
          _selectedMaxPrice = maxPrice;
          _selectedMinDiscount = minDiscount;
          _selectedPincode = pincode;
          _selectedWeightSize = weightSize;
          _inStockOnly = inStockOnly;
          if (searchQuery != null && searchQuery.isNotEmpty) {
            _searchController.text = searchQuery;
            _searchOpen = true;
          }
        });
        if (pincode != null && pincode.isNotEmpty) {
          final cur = ref.read(deliveryLocationProvider);
          if (cur == null || cur.pincode != pincode) {
            ref.read(deliveryLocationProvider.notifier).setLocation(
              DeliveryLocation(
                pincode: pincode,
                area: cur?.area ?? '',
                city: cur?.city ?? '',
                state: cur?.state ?? '',
                address: cur?.address ?? '',
                label: 'Pin: $pincode',
              ),
            );
          }
        }
      },
      onClear: _clearListingFilters,
    );
  }

  void _openPincodePicker() {
    showSelectDeliveryLocationBottomSheet(context, ref).then((_) {
      if (mounted) {
        final loc = ref.read(deliveryLocationProvider);
        if (loc?.pincode != null && loc!.pincode!.isNotEmpty) {
          setState(() {
            _selectedPincode = loc.pincode;
          });
        }
      }
    });
  }

  @override
  void didUpdateWidget(CatalogFlowScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.categoryName != widget.categoryName || oldWidget.baseId != widget.baseId) {
      _searchController.clear();
      _searchOpen = false;
      _filter = 'all';
      _clearListingFilters();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String get _needle => _searchController.text.trim().toLowerCase();

  void _toggleSearch() => setState(() {
        _searchOpen = !_searchOpen;
        if (!_searchOpen) _searchController.clear();
      });

  void _back(String fallback) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(fallback);
    }
  }

  String get _categoryImage {
    final name = widget.categoryName.toLowerCase();
    final doc = ref.watch(categoriesProvider).value?.where(
          (c) => c.categoryName.toLowerCase() == name,
        );
    if (doc != null && doc.isNotEmpty && doc.first.categoryImage.isNotEmpty) {
      return doc.first.categoryImage;
    }
    for (final item in shopByCategoryItems) {
      if (item.name.toLowerCase() == name || item.filter.toLowerCase() == name) {
        return 'assets/website/${item.image}';
      }
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final store = ref.watch(selectedStoreTabProvider);
    final key = (category: widget.categoryName, section: _sectionForStore(store));
    final async = ref.watch(catalogProductsProvider(key));
    final cards = groupBaseProducts(async.value ?? const []);
    final loading = async.isLoading && !async.hasValue;

    if (widget.baseId.isNotEmpty) {
      final active = cards.where((c) => c.id == widget.baseId).firstOrNull;
      return _buildProducts(active, loading);
    }
    return _buildCategory(cards, loading, async.hasError, () => ref.invalidate(catalogProductsProvider(key)));
  }

  Widget _icon(IconData icon, VoidCallback onTap, {Color color = const Color(0xFF1E293B)}) {
    return SizedBox(
      width: 36,
      height: 36,
      child: IconButton(
        padding: EdgeInsets.zero,
        onPressed: onTap,
        icon: Icon(icon, size: 21, color: color),
      ),
    );
  }

  Widget _chips(List<(String, String)> filters, Color inactive) {
    return SizedBox(
      height: 32,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: filters.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final (id, label) = filters[i];
          final active = _filter == id;
          return GestureDetector(
            onTap: () => setState(() => _filter = id),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? _brandGreen : inactive,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: active ? Colors.white : const Color(0xFF334155),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _searchField(String hint, Color fill) {
    return TextField(
      controller: _searchController,
      autofocus: true,
      onChanged: (_) => setState(() {}),
      style: GoogleFonts.plusJakartaSans(fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        isDense: true,
        filled: true,
        fillColor: fill,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: const BorderSide(color: Color(0xFF059669)),
        ),
      ),
    );
  }

  Widget _message(String text) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 40),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: GoogleFonts.plusJakartaSans(fontSize: 14, color: _slate400),
        ),
      );

  // ── Category level: header, banner, base filters, base-product grid ──
  Widget _buildCategory(List<BaseCard> all, bool loading, bool failed, VoidCallback retry) {
    final topInset = MediaQuery.paddingOf(context).top;
    final banner = _bannerCopy(widget.categoryName);
    final image = _categoryImage;
    final needle = _needle;
    final cards = all
        .where((c) => _matchesBaseFilter(c, _filter))
        .where((c) => needle.isEmpty || c.title.toLowerCase().contains(needle))
        .toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF7F6F2),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: EdgeInsets.fromLTRB(12, topInset + 6, 12, 8),
            child: Column(
              children: [
                Row(
                  children: [
                    _icon(Icons.arrow_back_rounded, () => _back(RoutePaths.home)),
                    Expanded(
                      child: Text(
                        widget.categoryName,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: _slate900,
                        ),
                      ),
                    ),
                    _icon(Icons.search_rounded, _toggleSearch),
                  ],
                ),
                if (_searchOpen)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: _searchField('Search in ${widget.categoryName}', const Color(0xFFF8FAFC)),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => retry(),
              child: CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    sliver: SliverToBoxAdapter(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _CategoryBanner(image: image, title: banner.title, kicker: banner.kicker),
                          const SizedBox(height: 12),
                          _chips(_baseFilters, const Color(0xFFEEF1EE)),
                          const SizedBox(height: 4),
                        ],
                      ),
                    ),
                  ),
                  if (loading)
                    SliverToBoxAdapter(child: _message('Loading ${widget.categoryName}…'))
                  else if (failed && all.isEmpty)
                    SliverToBoxAdapter(
                      child: Column(
                        children: [
                          _message('Could not load ${widget.categoryName}'),
                          TextButton(onPressed: retry, child: const Text('Retry')),
                        ],
                      ),
                    )
                  else if (cards.isEmpty)
                    SliverToBoxAdapter(
                      child: _message('No base products in ${widget.categoryName} yet.'),
                    )
                  else
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(12, 8, 12, ShellBottomInsets.of(context)),
                      sliver: SliverGrid(
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.78,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (context, i) => _BaseProductCard(
                            card: cards[i],
                            onTap: () => context.push(
                              catalogUrl(widget.categoryName, baseId: cards[i].id),
                            ),
                          ),
                          childCount: cards.length,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Base level: hero, tier filters, 3-column product grid ──
  Widget _buildProducts(BaseCard? active, bool loading) {
    final source = active?.items ?? const <Product>[];
    final needle = _needle;

    final allBrands = <String>{
      ...extractBrands(source),
      ...(ref.watch(brandsProvider).value?.map((b) => b.brandName) ?? const <String>[]),
    }.where((b) => b.isNotEmpty).toList()
      ..sort();

    final tierFiltered = source.where((p) {
      if (_filter != 'all' && _productTier(p) != _filter) return false;
      return true;
    }).toList();

    final items = filterAndSortProducts(
      products: tierFiltered,
      searchQuery: needle.isNotEmpty ? needle : null,
      brand: _selectedBrand,
      minPrice: _selectedMinPrice,
      maxPrice: _selectedMaxPrice,
      minDiscount: _selectedMinDiscount,
      weightSize: _selectedWeightSize,
      inStockOnly: _inStockOnly,
      sort: _sort,
    );
    final heroImage = (active?.image.isNotEmpty ?? false) ? active!.image : _categoryImage;
    final topInset = MediaQuery.paddingOf(context).top;
    const bg = Color(0xFFF4F6F3);

    return Scaffold(
      backgroundColor: bg,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: SizedBox(
              height: 230 + topInset,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  const ColoredBox(color: Color(0xFFE2E8F0)),
                  if (heroImage.isNotEmpty) _CatalogImage(src: heroImage),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [Color(0xB3000000), Color(0x26000000), Color(0x40000000)],
                      ),
                    ),
                  ),
                  Positioned(
                    top: topInset + 6,
                    left: 8,
                    right: 8,
                    child: Row(
                      children: [
                        _icon(
                          Icons.arrow_back_rounded,
                          () => _back(catalogUrl(widget.categoryName)),
                          color: Colors.white,
                        ),
                        const Spacer(),
                        _icon(Icons.search_rounded, _toggleSearch, color: Colors.white),
                      ],
                    ),
                  ),
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 36,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          active?.title ?? 'Products',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 28,
                            height: 1,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _heroTagline(source),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 24,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: bg,
                        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_searchOpen) ...[
                    _searchField('Search products', Colors.white),
                    const SizedBox(height: 10),
                  ],
                  _chips(_productFilters, const Color(0xFFE7F0E8)),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: ProductFiltersBar(
                backgroundColor: Colors.transparent,
                brands: allBrands,
                selectedBrand: _selectedBrand ?? '',
                sortBy: _sort,
                selectedMinDiscount: _selectedMinDiscount,
                selectedPincode: _selectedPincode ?? ref.watch(deliveryLocationProvider)?.pincode,
                selectedWeightSize: _selectedWeightSize,
                weightsSizes: extractWeightsAndSizes(source),
                inStockOnly: _inStockOnly,
                onBrandChange: (b) => setState(() => _selectedBrand = b.trim().isEmpty ? null : b.trim()),
                onSortChange: (s) => setState(() => _sort = s),
                onDiscountChange: (d) => setState(() => _selectedMinDiscount = d),
                onPincodeTap: _openPincodePicker,
                onWeightSizeChange: (w) => setState(() => _selectedWeightSize = w),
                onInStockOnlyChange: (stock) => setState(() => _inStockOnly = stock),
                onOpenFilterSheet: () => _openFilterSheet(source),
                hasActiveFilters: _hasActiveFilters,
                activeFiltersCount: _activeFilterCount,
                onClear: _clearListingFilters,
              ),
            ),
          ),
          if (loading && items.isEmpty)
            SliverToBoxAdapter(child: _message('Loading products…'))
          else if (items.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.search_off_rounded, size: 48, color: _slate400),
                    const SizedBox(height: 12),
                    Text(
                      _hasActiveFilters || _filter != 'all' || needle.isNotEmpty
                          ? 'No products match your selected filters.'
                          : 'No products in this list yet.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    if (_hasActiveFilters || _filter != 'all' || needle.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      TextButton.icon(
                        onPressed: () {
                          setState(() {
                            _filter = 'all';
                            _searchController.clear();
                          });
                          _clearListingFilters();
                        },
                        icon: const Icon(Icons.refresh_rounded, size: 16),
                        label: const Text('Reset all filters'),
                        style: TextButton.styleFrom(
                          foregroundColor: _brandGreen,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            )
          else
            SliverPadding(
              padding: EdgeInsets.fromLTRB(12, 0, 12, ShellBottomInsets.of(context)),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: DealProductCardDimensions.gridChildAspectRatio,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, i) => CatalogProductCard(product: items[i]),
                  childCount: items.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CatalogImage extends StatelessWidget {
  const _CatalogImage({required this.src});

  final String src;

  @override
  Widget build(BuildContext context) {
    if (src.startsWith('assets/')) return Image.asset(src, fit: BoxFit.cover);
    return AppNetworkImage(imageUrl: src);
  }
}

class _CategoryBanner extends StatelessWidget {
  const _CategoryBanner({required this.image, required this.title, required this.kicker});

  final String image;
  final String title;
  final String kicker;

  @override
  Widget build(BuildContext context) {
    const cream = Color(0xFFF3ECDC);
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: ColoredBox(
        color: cream,
        child: Stack(
          children: [
            if (image.isNotEmpty)
              Positioned.fill(
                child: FractionallySizedBox(
                  alignment: Alignment.centerRight,
                  widthFactor: 0.58,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _CatalogImage(src: image),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [cream, Color(0x59F3ECDC), Color(0x00F3ECDC)],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            FractionallySizedBox(
              widthFactor: 0.62,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.playfairDisplay(
                        fontSize: 26,
                        height: 1.05,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF163528),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      kicker,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.3,
                        color: const Color(0xFF3E6B4F),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BaseProductCard extends StatelessWidget {
  const _BaseProductCard({required this.card, required this.onTap});

  final BaseCard card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: const [
            BoxShadow(color: Color(0x0F0F172A), blurRadius: 10, offset: Offset(0, 2)),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  const ColoredBox(color: Color(0xFFF8FAFC)),
                  if (card.image.isNotEmpty) _CatalogImage(src: card.image),
                  if (card.discount > 0)
                    Positioned(
                      left: 0,
                      top: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: const BoxDecoration(
                          color: Color(0xFF2F6FE4),
                          borderRadius: BorderRadius.only(bottomRight: Radius.circular(12)),
                        ),
                        child: Text(
                          '${card.discount}%\nOFF',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            height: 1.05,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            card.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 15,
                              height: 1.2,
                              fontWeight: FontWeight.w600,
                              color: _slate900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${card.count} ${card.count == 1 ? 'Type' : 'Types'}',
                            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: _slate400),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 28,
                      height: 28,
                      decoration: const BoxDecoration(
                        color: Color(0xFFEEF6EF),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.chevron_right_rounded, size: 18, color: _brandGreen),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CatalogProductCard extends ConsumerWidget {
  const CatalogProductCard({super.key, required this.product});

  final Product product;

  CartItem? _line(List<CartItem> items) {
    final defaults = resolveCartDefaults(product);
    for (final item in items) {
      if (item.id == product.id &&
          item.variantName.trim() == defaults.variantName.trim() &&
          item.colorName.trim() == defaults.colorName.trim()) {
        return item;
      }
    }
    for (final item in items) {
      if (item.id == product.id) return item;
    }
    return null;
  }

  Future<void> _add(WidgetRef ref, BuildContext context) async {
    final defaults = resolveCartDefaults(product);
    final result = await ref.read(cartControllerProvider.notifier).addToCart(
          product,
          defaults.quantity,
          variantName: defaults.variantName,
          colorName: defaults.colorName,
          flySourceContext: context,
        );
    if (result == AddToCartResult.requiresLogin) {
      ref.read(authControllerProvider.notifier).openAuthModal();
    }
  }

  Future<void> _increase(WidgetRef ref, BuildContext context) async {
    final line = _line(ref.read(cartControllerProvider).items);
    if (line == null) return _add(ref, context);
    await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
          productId: product.id,
          quantity: line.quantity + getCartStepForProduct(product, line.variantName),
          variantName: line.variantName,
          colorName: line.colorName,
        );
  }

  Future<void> _decrease(WidgetRef ref) async {
    final line = _line(ref.read(cartControllerProvider).items);
    if (line == null) return;
    final next = getDecreasedCartQuantityForProduct(product, line.quantity, line.variantName);
    final cart = ref.read(cartControllerProvider.notifier);
    if (next <= 0) {
      await cart.removeFromCartLine(
        productId: product.id,
        variantName: line.variantName,
        colorName: line.colorName,
      );
      return;
    }
    await cart.updateCartLineQuantity(
      productId: product.id,
      quantity: next,
      variantName: line.variantName,
      colorName: line.colorName,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DealProductCard(
      product: product,
      fillCell: true,
      cartQuantity: ref.watch(cartProductQuantityProvider(product.id)),
      onAdd: (ctx) => _add(ref, ctx),
      onIncrease: () => _increase(ref, context),
      onDecrease: () => _decrease(ref),
    );
  }
}
