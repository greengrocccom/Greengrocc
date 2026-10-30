import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/scroll/app_scroll_config.dart';
import '../../core/scroll/tab_scroll_registry.dart';
import '../../core/theme/store_chrome.dart';
import '../../core/utils/product_pricing.dart';
import '../../core/utils/product_search.dart';
import '../../core/utils/product_utils.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/cart/cart_controller.dart';
import '../../features/home/home_providers.dart';
import '../../features/home/widgets/home_search_bar.dart';
import '../../features/product/product_providers.dart';
import '../../models/cart_item.dart';
import '../../models/category.dart';
import '../../core/providers/location_provider.dart';
import '../../models/product.dart';
import '../../widgets/address/select_delivery_location_sheet.dart';
import '../../widgets/common/api_error_view.dart';
import '../../widgets/common/app_network_image.dart';
import '../../widgets/product/deal_product_card.dart';
import '../../widgets/layout/shell_bottom_insets.dart';
import '../../widgets/product/product_filter_sheet.dart';
import '../../widgets/product/product_filters_bar.dart';

class ProductListScreen extends ConsumerStatefulWidget {
  const ProductListScreen({
    super.key,
    this.searchQuery,
    this.categoryName,
    this.subcategory,
    this.brand,
    this.minPrice,
    this.maxPrice,
    this.sortId,
    this.minDiscount,
    this.pincode,
    this.weightSize,
    this.inStockOnly = false,
  });

  final String? searchQuery;
  final String? categoryName;
  final String? subcategory;
  final String? brand;
  final String? minPrice;
  final String? maxPrice;
  final String? sortId;
  final String? minDiscount;
  final String? pincode;
  final String? weightSize;
  final bool inStockOnly;

  @override
  ConsumerState<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends ConsumerState<ProductListScreen> {
  late ProductSortOption _sort;
  late final TabScrollRegistry _tabScrollRegistry;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _tabScrollRegistry = ref.read(tabScrollRegistryProvider);
    _sort =
        ProductSortOption.fromId(widget.sortId) ?? ProductSortOption.listingDefault;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _tabScrollRegistry.register(ShellTabIndex.categories, _scrollController);
    });
  }

  @override
  void dispose() {
    _tabScrollRegistry.unregister(ShellTabIndex.categories, _scrollController);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(ProductListScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sortId != widget.sortId) {
      _sort = ProductSortOption.fromId(widget.sortId) ??
          ProductSortOption.listingDefault;
    }
    if (oldWidget.subcategory != widget.subcategory ||
        oldWidget.categoryName != widget.categoryName) {
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(0);
      }
    }
  }

  ProductQuery get _query {
    final currentStore = ref.watch(selectedStoreTabProvider);
    String section;
    if (currentStore == 'festive' || currentStore == 'ready2cook') {
      section = 'ready2cook';
    } else if (currentStore == 'mall' || currentStore == 'instantorder') {
      section = 'instantorder';
    } else {
      section = 'preorder';
    }

    final activePincode =
        widget.pincode ?? ref.watch(deliveryLocationProvider)?.pincode;

    return ProductQuery(
      categoryName: widget.categoryName,
      search: widget.searchQuery,
      brandName: widget.brand,
      subcategory: widget.subcategory,
      minPrice: widget.minPrice,
      maxPrice: widget.maxPrice,
      sort: _sort.id,
      minDiscount: widget.minDiscount,
      pincode: activePincode,
      weightSize: widget.weightSize,
      inStockOnly: widget.inStockOnly,
      section: section,
    );
  }

  void _updateSort(ProductSortOption option) {
    setState(() => _sort = option);
    _applyFilters(sort: option);
  }

  void _updateBrand(String brand) {
    _applyFilters(
      brand: brand.trim().isEmpty ? null : brand.trim(),
    );
  }

  void _applySubcategory(String? subcategory) {
    final path = ProductSearch.buildPath(
      query: widget.searchQuery ?? '',
      categoryName: widget.categoryName ?? '',
      subcategory: subcategory ?? '',
      brand: widget.brand ?? '',
      minPrice: widget.minPrice ?? '',
      maxPrice: widget.maxPrice ?? '',
      minDiscount: widget.minDiscount ?? '',
      pincode: widget.pincode ?? '',
      weightSize: widget.weightSize ?? '',
      inStockOnly: widget.inStockOnly,
      sort: widget.sortId ?? _sort.id,
    );
    context.go(path);
  }

  void _clearListingFilters() {
    setState(() => _sort = ProductSortOption.listingDefault);
    final path = ProductSearch.buildPath(
      query: widget.searchQuery ?? '',
      categoryName: widget.categoryName ?? '',
      subcategory: widget.subcategory ?? '',
      sort: ProductSortOption.listingDefault.id,
    );
    context.go(path);
  }

  Future<void> _handleAdd(Product product, BuildContext context) async {
    final defaults = resolveCartDefaults(product);
    final result =
        await ref.read(cartControllerProvider.notifier).addToCart(
              product,
              defaults.quantity,
              variantName: defaults.variantName,
              colorName: defaults.colorName,
              flySourceContext: context,
            );
    if (result == AddToCartResult.requiresLogin && mounted) {
      ref.read(authControllerProvider.notifier).openAuthModal();
    }
  }

  void _applyFilters({
    String? brand,
    String? minPrice,
    String? maxPrice,
    String? minDiscount,
    String? pincode,
    String? weightSize,
    bool? inStockOnly,
    ProductSortOption? sort,
    String? searchQuery,
  }) {
    final path = ProductSearch.buildPath(
      query: searchQuery ?? widget.searchQuery ?? '',
      categoryName: widget.categoryName ?? '',
      subcategory: widget.subcategory ?? '',
      brand: brand ?? widget.brand ?? '',
      minPrice: minPrice ?? widget.minPrice ?? '',
      maxPrice: maxPrice ?? widget.maxPrice ?? '',
      minDiscount: minDiscount ?? widget.minDiscount ?? '',
      pincode: pincode ?? widget.pincode ?? '',
      weightSize: weightSize ?? widget.weightSize ?? '',
      inStockOnly: inStockOnly ?? widget.inStockOnly,
      sort: (sort ?? _sort).id,
    );
    context.go(path);
  }

  bool get _hasActiveFilters =>
      (widget.brand?.isNotEmpty ?? false) ||
      (widget.minPrice?.isNotEmpty ?? false) ||
      (widget.maxPrice?.isNotEmpty ?? false) ||
      (widget.minDiscount?.isNotEmpty ?? false) ||
      (widget.pincode?.isNotEmpty ?? false) ||
      (widget.weightSize?.isNotEmpty ?? false) ||
      widget.inStockOnly ||
      (_sort != ProductSortOption.listingDefault &&
          _sort.id != ProductSortOption.listingDefault.id);

  int get _activeFilterCount {
    int count = 0;
    if (widget.brand?.isNotEmpty ?? false) count++;
    if ((widget.minPrice?.isNotEmpty ?? false) ||
        (widget.maxPrice?.isNotEmpty ?? false)) {
      count++;
    }
    if (widget.minDiscount?.isNotEmpty ?? false) count++;
    if (widget.pincode?.isNotEmpty ?? false) count++;
    if (widget.weightSize?.isNotEmpty ?? false) count++;
    if (widget.inStockOnly) count++;
    if (_sort != ProductSortOption.listingDefault &&
        _sort.id != ProductSortOption.listingDefault.id) {
      count++;
    }
    return count;
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
      currentBrand: widget.brand,
      currentSort: _sort,
      currentMinPrice: widget.minPrice,
      currentMaxPrice: widget.maxPrice,
      currentMinDiscount: widget.minDiscount,
      currentPincode: widget.pincode ?? ref.read(deliveryLocationProvider)?.pincode,
      currentWeightSize: widget.weightSize,
      weightsSizes: extractWeightsAndSizes(products),
      currentInStockOnly: widget.inStockOnly,
      currentSearch: widget.searchQuery,
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
        if (sort != null) setState(() => _sort = sort);
        _applyFilters(
          brand: brand,
          minPrice: minPrice,
          maxPrice: maxPrice,
          minDiscount: minDiscount,
          pincode: pincode,
          weightSize: weightSize,
          inStockOnly: inStockOnly,
          sort: sort,
          searchQuery: searchQuery,
        );
      },
      onClear: _clearListingFilters,
    );
  }

  void _openPincodePicker() {
    showSelectDeliveryLocationBottomSheet(context, ref).then((_) {
      if (mounted) {
        final loc = ref.read(deliveryLocationProvider);
        if (loc?.pincode != null && loc!.pincode!.isNotEmpty) {
          _applyFilters(pincode: loc.pincode);
        }
      }
    });
  }

  Future<void> _refreshProducts() =>
      ref.read(pagedProductsProvider(_query).notifier).refresh();

  @override
  Widget build(BuildContext context) {
    final query = _query;
    final paged = ref.watch(pagedProductsProvider(query));
    final showLeftSidebar =
        widget.categoryName != null && widget.categoryName!.isNotEmpty;
    final topInset = MediaQuery.paddingOf(context).top;

    final currentStore = ref.watch(selectedStoreTabProvider);
    final headerBgColor = StoreChrome.forStore(currentStore).header;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          // Sticky top header: Search bar + Offers button (and back button)
          Container(
            decoration: BoxDecoration(
              color: headerBgColor,
              border: const Border(
                bottom: BorderSide(color: Color(0xFFF3F4F6)),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            padding: EdgeInsets.only(top: topInset + 6, bottom: 8),
            child: HomeSearchBar(
              isLightBg: true,
              showBackButton: true,
              initialQuery: widget.searchQuery,
              onSubmitted: (q) => _applyFilters(searchQuery: q),
            ),
          ),
          // Content Area: Left Subcategories & Right Products
          Expanded(
            child: Builder(
              builder: (context) {
                final products = paged.items;
                final allBrands = <String>{
                  ...extractBrands(products),
                  ...(ref.watch(brandsProvider).value?.map((b) => b.brandName) ?? const <String>[]),
                }.where((b) => b.isNotEmpty).toList();
                allBrands.sort();

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (showLeftSidebar)
                      _LeftSubcategorySidebar(
                        activeCategory: widget.categoryName!,
                        activeSubcategory: widget.subcategory,
                        products: products,
                        onSelectSubcategory: _applySubcategory,
                      ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ProductFiltersBar(
                            brands: allBrands,
                            selectedBrand: widget.brand ?? '',
                            sortBy: _sort,
                            selectedMinDiscount: widget.minDiscount,
                            selectedPincode: widget.pincode ??
                                ref.watch(deliveryLocationProvider)?.pincode,
                            selectedWeightSize: widget.weightSize,
                            weightsSizes: extractWeightsAndSizes(products),
                            inStockOnly: widget.inStockOnly,
                            onBrandChange: _updateBrand,
                            onSortChange: _updateSort,
                            onDiscountChange: (discount) =>
                                _applyFilters(minDiscount: discount),
                            onPincodeTap: _openPincodePicker,
                            onWeightSizeChange: (weight) =>
                                _applyFilters(weightSize: weight),
                            onInStockOnlyChange: (inStock) =>
                                _applyFilters(inStockOnly: inStock),
                            onOpenFilterSheet: () => _openFilterSheet(products),
                            hasActiveFilters: _hasActiveFilters,
                            activeFiltersCount: _activeFilterCount,
                            onClear: _clearListingFilters,
                          ),
                          Expanded(
                            child: Builder(
                              builder: (context) {
                                if (paged.loadingFirst) {
                                  return Center(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const SizedBox(
                                          width: 32,
                                          height: 32,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            color: Color(0xFF0C831F),
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        Text(
                                          'Updating products...',
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w600,
                                            color: const Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }
                                if (paged.error != null && paged.items.isEmpty) {
                                  return ApiErrorView(
                                    message: 'Could not load products',
                                    onRetry: _refreshProducts,
                                  );
                                }
                                return RefreshIndicator(
                                  onRefresh: _refreshProducts,
                                  child: _ProductResultsView(
                                    scrollController: _scrollController,
                                    products: products,
                                    searchQuery: widget.searchQuery,
                                    categoryName: widget.categoryName,
                                    subcategory: widget.subcategory,
                                    brand: widget.brand,
                                    minPrice: widget.minPrice,
                                    maxPrice: widget.maxPrice,
                                    minDiscount: widget.minDiscount,
                                    pincode: widget.pincode,
                                    weightSize: widget.weightSize,
                                    inStockOnly: widget.inStockOnly,
                                    sort: _sort,
                                    onAdd: _handleAdd,
                                    hasMore: paged.hasMore,
                                    loadingMore: paged.loadingMore,
                                    loadMoreFailed: paged.error != null,
                                    onLoadMore: () =>
                                        ref.read(pagedProductsProvider(query).notifier).loadMore(),
                                    onClearFilters: _clearListingFilters,
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SubcategoryItem {
  final String name;
  final String? imageUrl;
  _SubcategoryItem({required this.name, this.imageUrl});
}

class _LeftSubcategorySidebar extends ConsumerStatefulWidget {
  const _LeftSubcategorySidebar({
    required this.activeCategory,
    required this.activeSubcategory,
    required this.products,
    required this.onSelectSubcategory,
  });

  final String activeCategory;
  final String? activeSubcategory;
  final List<Product> products;
  final ValueChanged<String?> onSelectSubcategory;

  @override
  ConsumerState<_LeftSubcategorySidebar> createState() =>
      _LeftSubcategorySidebarState();
}

class _LeftSubcategorySidebarState
    extends ConsumerState<_LeftSubcategorySidebar> {
  final _sidebarScrollController = ScrollController();

  @override
  void dispose() {
    _sidebarScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories =
        ref.watch(categoriesProvider).value ?? const <Category>[];
    Category? activeCat;
    for (final c in categories) {
      if (c.categoryName.toLowerCase().trim() ==
          widget.activeCategory.toLowerCase().trim()) {
        activeCat = c;
        break;
      }
    }

    // Products arrive page by page (and filtered by the selected subcategory), so
    // list every subcategory the category defines, then any extra ones seen on products.
    String key(String value) => value.toLowerCase().trim();
    final productSubs = <String, String>{
      for (final p in widget.products)
        if (p.subcategory.trim().isNotEmpty) key(p.subcategory): p.subcategory.trim(),
    };
    final subcategoryNames = <String>[];
    for (final sub in activeCat?.subcategories ?? const <String>[]) {
      if (sub.trim().isEmpty) continue;
      productSubs.remove(key(sub));
      subcategoryNames.add(sub);
    }
    subcategoryNames.addAll(productSubs.values);
    final active = widget.activeSubcategory?.trim() ?? '';
    if (active.isNotEmpty && !subcategoryNames.any((s) => key(s) == key(active))) {
      subcategoryNames.add(active);
    }

    final subItems = <_SubcategoryItem>[
      _SubcategoryItem(
        name: 'All',
        imageUrl:
            (activeCat != null && activeCat.categoryImage.trim().isNotEmpty)
                ? activeCat.categoryImage.trim()
                : null,
      ),
    ];

    for (final sub in subcategoryNames) {
      String? img;
      for (final p in widget.products) {
        if (p.subcategory.toLowerCase().trim() == sub.toLowerCase().trim() &&
            p.productImages.isNotEmpty &&
            p.productImages.first.trim().isNotEmpty) {
          img = p.productImages.first.trim();
          break;
        }
      }
      subItems.add(_SubcategoryItem(name: sub, imageUrl: img));
    }

    const brandGreen = Color(0xFF0C831F);

    return Container(
      width: 78,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          right: BorderSide(color: Color(0xFFF3F4F6), width: 1),
        ),
      ),
      child: ListView.separated(
        controller: _sidebarScrollController,
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        padding: EdgeInsets.fromLTRB(
          6,
          10,
          6,
          ShellBottomInsets.of(context) + 12,
        ),
        itemCount: subItems.length,
        separatorBuilder: (context, index) => const SizedBox(height: 4),
        itemBuilder: (context, index) {
          final item = subItems[index];
          final isAll = index == 0;
          final isSelected = isAll
              ? (widget.activeSubcategory == null ||
                  widget.activeSubcategory!.isEmpty)
              : (widget.activeSubcategory?.toLowerCase().trim() ==
                  item.name.toLowerCase().trim());

          return Material(
            color: isSelected
                ? brandGreen.withValues(alpha: 0.10)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: () => widget.onSelectSubcategory(isAll ? null : item.name),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF9FAFB),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? brandGreen.withValues(alpha: 0.35)
                              : const Color(0xFFF3F4F6),
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: (isAll || item.imageUrl == null || item.imageUrl!.trim().isEmpty)
                            ? const AppImagePlaceholder(fit: BoxFit.contain)
                            : AppNetworkImage(
                                imageUrl: item.imageUrl!,
                                fit: BoxFit.cover,
                                errorIcon: Icons.category_rounded,
                                errorIconSize: 18,
                              ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 10,
                        height: 1.15,
                        letterSpacing: -0.1,
                        fontWeight:
                            isSelected ? FontWeight.w700 : FontWeight.w600,
                        color: isSelected
                            ? brandGreen
                            : const Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ProductResultsView extends ConsumerStatefulWidget {
  const _ProductResultsView({
    this.scrollController,
    required this.products,
    required this.searchQuery,
    required this.categoryName,
    required this.subcategory,
    required this.brand,
    required this.minPrice,
    required this.maxPrice,
    this.minDiscount,
    this.pincode,
    this.weightSize,
    this.inStockOnly = false,
    required this.sort,
    required this.onAdd,
    required this.hasMore,
    required this.loadingMore,
    required this.loadMoreFailed,
    required this.onLoadMore,
    this.onClearFilters,
  });

  final ScrollController? scrollController;
  final List<Product> products;
  final String? searchQuery;
  final String? categoryName;
  final String? subcategory;
  final String? brand;
  final String? minPrice;
  final String? maxPrice;
  final String? minDiscount;
  final String? pincode;
  final String? weightSize;
  final bool inStockOnly;
  final ProductSortOption sort;
  final Future<void> Function(Product, BuildContext) onAdd;
  final bool hasMore;
  final bool loadingMore;
  final bool loadMoreFailed;
  final VoidCallback onLoadMore;
  final VoidCallback? onClearFilters;

  @override
  ConsumerState<_ProductResultsView> createState() =>
      _ProductResultsViewState();
}

class _ProductResultsViewState extends ConsumerState<_ProductResultsView> {
  late List<Product> _filtered;

  @override
  void initState() {
    super.initState();
    _filtered = _computeFiltered();
  }

  @override
  void didUpdateWidget(_ProductResultsView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.products != widget.products ||
        oldWidget.searchQuery != widget.searchQuery ||
        oldWidget.categoryName != widget.categoryName ||
        oldWidget.subcategory != widget.subcategory ||
        oldWidget.brand != widget.brand ||
        oldWidget.minPrice != widget.minPrice ||
        oldWidget.maxPrice != widget.maxPrice ||
        oldWidget.minDiscount != widget.minDiscount ||
        oldWidget.pincode != widget.pincode ||
        oldWidget.weightSize != widget.weightSize ||
        oldWidget.inStockOnly != widget.inStockOnly ||
        oldWidget.sort != widget.sort) {
      _filtered = _computeFiltered();
    }
  }

  List<Product> _computeFiltered() {
    return filterAndSortProducts(
      products: widget.products,
      searchQuery: widget.searchQuery,
      subcategory: widget.subcategory,
      brand: widget.brand,
      minPrice: widget.minPrice,
      maxPrice: widget.maxPrice,
      minDiscount: widget.minDiscount,
      weightSize: widget.weightSize,
      inStockOnly: widget.inStockOnly,
      sort: widget.sort,
    );
  }

  CartItem? _cartLineForProduct(List<CartItem> cartItems, Product product) {
    final defaults = resolveCartDefaults(product);
    for (final item in cartItems) {
      if (item.id == product.id &&
          item.variantName.trim() == defaults.variantName.trim() &&
          item.colorName.trim() == defaults.colorName.trim()) {
        return item;
      }
    }
    for (final item in cartItems) {
      if (item.id == product.id) {
        return item;
      }
    }
    return null;
  }

  Future<void> _handleIncrease(Product product) async {
    final cartItems = ref.read(cartControllerProvider).items;
    final line = _cartLineForProduct(cartItems, product);
    if (line == null) {
      final defaults = resolveCartDefaults(product);
      final result = await ref.read(cartControllerProvider.notifier).addToCart(
            product,
            defaults.quantity,
            variantName: defaults.variantName,
            colorName: defaults.colorName,
            flySourceContext: context,
          );
      if (result == AddToCartResult.requiresLogin && mounted) {
        ref.read(authControllerProvider.notifier).openAuthModal();
      }
      return;
    }

    final step = getCartStepForProduct(product, line.variantName);
    await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
          productId: product.id,
          quantity: line.quantity + step,
          variantName: line.variantName,
          colorName: line.colorName,
        );
  }

  Future<void> _handleDecrease(Product product) async {
    final cartItems = ref.read(cartControllerProvider).items;
    final line = _cartLineForProduct(cartItems, product);
    if (line == null) return;

    final nextQty = getDecreasedCartQuantityForProduct(
      product,
      line.quantity,
      line.variantName,
    );
    if (nextQty <= 0) {
      await ref.read(cartControllerProvider.notifier).removeFromCartLine(
            productId: product.id,
            variantName: line.variantName,
            colorName: line.colorName,
          );
      return;
    }

    await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
          productId: product.id,
          quantity: nextQty,
          variantName: line.variantName,
          colorName: line.colorName,
        );
  }

  /// Fetch the next page once the user is within ~1.5 screens of the end
  /// (also fires on layout, so a short first page tops itself up).
  bool _maybeLoadMore(ScrollMetrics metrics) {
    if (widget.hasMore && !widget.loadingMore && !widget.loadMoreFailed &&
        metrics.extentAfter < metrics.viewportDimension * 1.5) {
      widget.onLoadMore();
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    if (_filtered.isEmpty && widget.hasMore) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !widget.loadingMore && !widget.loadMoreFailed) widget.onLoadMore();
      });
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }
    if (_filtered.isEmpty) {
      final hasActive = (widget.brand?.isNotEmpty ?? false) ||
          (widget.minPrice?.isNotEmpty ?? false) ||
          (widget.maxPrice?.isNotEmpty ?? false) ||
          (widget.minDiscount?.isNotEmpty ?? false) ||
          (widget.pincode?.isNotEmpty ?? false) ||
          widget.inStockOnly ||
          (widget.searchQuery?.isNotEmpty ?? false);

      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: const BoxDecoration(
                  color: Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.filter_alt_off_outlined,
                  size: 28,
                  color: Color(0xFF94A3B8),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'No products found',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                hasActive
                    ? 'No products matched your active filters. Try adjusting or clearing your filters.'
                    : widget.searchQuery != null
                        ? 'No products found for "${widget.searchQuery}".'
                        : 'No products available in this section yet.',
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  color: const Color(0xFF64748B),
                ),
              ),
              if (hasActive && widget.onClearFilters != null) ...[
                const SizedBox(height: 14),
                FilledButton.tonal(
                  onPressed: widget.onClearFilters,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0C831F).withValues(alpha: 0.10),
                    foregroundColor: const Color(0xFF0C831F),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Text(
                    'Clear all filters',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => _maybeLoadMore(n.metrics),
      child: NotificationListener<ScrollUpdateNotification>(
        onNotification: (n) => _maybeLoadMore(n.metrics),
        child: _buildGrid(context),
      ),
    );
  }

  Widget _buildGrid(BuildContext context) {
    final bottomPadding = ShellBottomInsets.listPadding(
      context,
      left: 12,
      top: 8,
      right: 12,
    );
    return CustomScrollView(
      controller: widget.scrollController,
      physics: AppScrollConfig.listPhysics,
      cacheExtent: AppScrollConfig.cacheExtent,
      slivers: [
        SliverPadding(
          padding: widget.hasMore || widget.loadMoreFailed
              ? bottomPadding.copyWith(bottom: 0)
              : bottomPadding,
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: DealProductCardDimensions.twoColumnChildAspectRatio,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final product = _filtered[index];
                return _ThreeColumnProductCard(
                  product: product,
                  cartQuantity:
                      ref.watch(cartProductQuantityProvider(product.id)),
                  onAdd: (ctx) => widget.onAdd(product, ctx),
                  onIncrease: () => _handleIncrease(product),
                  onDecrease: () => _handleDecrease(product),
                );
              },
              childCount: _filtered.length,
            ),
          ),
        ),
        if (widget.hasMore || widget.loadMoreFailed)
          SliverPadding(
            padding: EdgeInsets.only(top: 12, bottom: bottomPadding.bottom),
            sliver: SliverToBoxAdapter(
              child: Center(
                child: widget.loadMoreFailed
                    ? TextButton.icon(
                        onPressed: widget.onLoadMore,
                        icon: const Icon(Icons.refresh_rounded, size: 18),
                        label: const Text('Couldn\'t load more · Retry'),
                      )
                    : const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
              ),
            ),
          ),
      ],
    );
  }
}

class _ThreeColumnProductCard extends ConsumerWidget {
  const _ThreeColumnProductCard({
    required this.product,
    required this.cartQuantity,
    required this.onAdd,
    required this.onIncrease,
    required this.onDecrease,
  });

  final Product product;
  final int cartQuantity;
  final void Function(BuildContext context) onAdd;
  final VoidCallback onIncrease;
  final VoidCallback onDecrease;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DealProductCard(
      product: product,
      fillCell: true,
      cartQuantity: cartQuantity,
      onAdd: onAdd,
      onIncrease: onIncrease,
      onDecrease: onDecrease,
    );
  }
}
