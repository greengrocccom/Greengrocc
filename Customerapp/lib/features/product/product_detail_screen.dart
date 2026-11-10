import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../config/theme.dart';
import '../../core/scroll/app_scroll_config.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/product_pricing.dart';
import '../../core/utils/product_utils.dart';
import '../../core/utils/recently_viewed.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/cart/cart_controller.dart';
import '../../features/home/home_providers.dart';
import '../../models/cart_item.dart';
import '../../features/product/product_providers.dart';
import 'widgets/farmer_traceability_card.dart';
import 'widgets/similar_products_section.dart';
import 'widgets/top_category_products_section.dart';
import '../../models/product.dart';
import '../../routes/route_paths.dart';
import '../../widgets/cart/floating_cart_bar.dart';
import '../../widgets/common/app_network_image.dart';
import '../../widgets/common/skeleton_loaders.dart';
import '../../widgets/product/product_share_sheet.dart';
import '../../widgets/product/wishlist_button.dart';
import '../../widgets/product/product_video_player.dart';

@immutable
class ProductDetailCartKey {
  const ProductDetailCartKey({
    required this.productId,
    required this.variantName,
    required this.colorName,
  });

  final String productId;
  final String variantName;
  final String colorName;

  @override
  bool operator ==(Object other) {
    return other is ProductDetailCartKey &&
        productId == other.productId &&
        variantName == other.variantName &&
        colorName == other.colorName;
  }

  @override
  int get hashCode => Object.hash(productId, variantName, colorName);
}

final productDetailCartQuantityProvider =
    Provider.family<int?, ProductDetailCartKey>((ref, key) {
  return ref.watch(
    cartControllerProvider.select((state) {
      for (final item in state.items) {
        if (item.id != key.productId) continue;
        if (item.variantName.trim() != key.variantName.trim()) continue;
        if (item.colorName.trim() != key.colorName.trim()) continue;
        return item.quantity;
      }
      return null;
    }),
  );
});

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.productId});

  final String productId;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  int _quantity = defaultSingleMoq;
  String _selectedVariant = '';
  String _selectedColor = '';
  String? _quantitySyncedKey;
  Timer? _recentlyViewedDebounce;
  late final ScrollController _scrollController;
  final ValueNotifier<double> _scrollProgress = ValueNotifier<double>(0.0);
  final GlobalKey _quantitySectionKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final offset = _scrollController.offset;
    final progress = ((offset - 40) / 140.0).clamp(0.0, 1.0);
    if ((progress - _scrollProgress.value).abs() > 0.005) {
      _scrollProgress.value = progress;
    }
  }

  @override
  void didUpdateWidget(covariant ProductDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.productId != widget.productId) {
      _quantitySyncedKey = null;
      _selectedVariant = '';
      _selectedColor = '';
      _quantity = defaultSingleMoq;
      _scrollProgress.value = 0.0;
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(0);
      }
    }
  }

  void _syncQuantityForProduct(
    Product product,
    String activeVariantName,
    int? cartLineQuantity,
  ) {
    final key =
        '${widget.productId}|$activeVariantName|$_selectedColor|${cartLineQuantity ?? 'local'}';
    if (_quantitySyncedKey == key) return;
    _quantitySyncedKey = key;

    final minOrderQuantity = getMinOrderQuantity(product, activeVariantName);
    final maxQuantity = getMaxOrderQuantity(product, activeVariantName);
    final nextQuantity = cartLineQuantity ?? minOrderQuantity;
    final clamped = nextQuantity.clamp(minOrderQuantity, maxQuantity);

    if (_quantity != clamped) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() => _quantity = clamped);
      });
    }
  }

  void _handleVariantChange(Product product, String variantName) {
    setState(() {
      _selectedVariant = variantName;
      _quantitySyncedKey = null;
      final minOrderQuantity = getMinOrderQuantity(product, variantName);
      _quantity = minOrderQuantity;
      final colors = getAvailableColors(product, variantName);
      _selectedColor = colors.isNotEmpty ? colors.first.name : '';
    });
  }

  void _initSelectionsForProduct(Product product) {
    if (!mounted) return;

    var changed = false;
    if (isMultiVariant(product) && _selectedVariant.isEmpty) {
      _selectedVariant = product.variants.first.name;
      changed = true;
    }

    final activeVariant = resolveActiveVariantName(product, _selectedVariant);
    final colors = getAvailableColors(product, activeVariant);
    if (_selectedColor.isEmpty && colors.isNotEmpty) {
      _selectedColor = colors.first.name;
      changed = true;
    }

    if (changed) setState(() {});
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _scrollProgress.dispose();
    _recentlyViewedDebounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(productDetailProvider(widget.productId));

    ref.listen(productDetailProvider(widget.productId), (previous, next) {
      next.whenData((product) {
        if (!mounted) return;
        _initSelectionsForProduct(product);
        _recentlyViewedDebounce?.cancel();
        _recentlyViewedDebounce = Timer(const Duration(seconds: 2), () {
          RecentlyViewedStore.add(product.id).then((_) {
            if (!mounted) return;
            ref.invalidate(recentlyViewedProductsProvider);
          });
        });
      });
    });

    return productAsync.when(
      loading: () => Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => _handleBackNavigation(context),
          ),
          title: const Text('Product Details'),
        ),
        body: const SkeletonProductDetail(),
      ),
      error: (_, _) => Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => _handleBackNavigation(context),
          ),
          title: const Text('Product Details'),
        ),
        body: _ErrorView(onBack: () => context.go(RoutePaths.product)),
      ),
      data: (product) => _buildScaffold(context, product),
    );
  }

  void _handleBackNavigation(BuildContext context) {
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
    } else if (context.canPop()) {
      context.pop();
    } else {
      context.go(RoutePaths.home);
    }
  }

  Widget _buildScaffold(BuildContext context, Product product) {
    final activeVariantName =
        resolveActiveVariantName(product, _selectedVariant);
    final selectionColor =
        resolveSelectionColor(product, activeVariantName, _selectedColor);
    final cartKey = ProductDetailCartKey(
      productId: product.id,
      variantName: activeVariantName,
      colorName: selectionColor,
    );

    ref.listen<int?>(productDetailCartQuantityProvider(cartKey),
        (previous, next) {
      _syncQuantityForProduct(product, activeVariantName, next);
    });

    final inStock = isProductInStock(product, activeVariantName);
    final minOrderQuantity = getMinOrderQuantity(product, activeVariantName);
    final maxQuantity = getMaxOrderQuantity(product, activeVariantName);

    // Active variant price resolution
    double currentPrice = product.effectivePrice;
    double mrpPrice = product.price;
    int discountPercent = product.discountedPercent.round();

    if (isMultiVariant(product)) {
      final v = getVariant(product, activeVariantName);
      if (v != null) {
        currentPrice = v.discountedPrice > 0 ? v.discountedPrice : v.price;
        mrpPrice = v.price;
        if (v.discountedPrice > 0 && v.price > v.discountedPrice) {
          discountPercent =
              ((v.price - v.discountedPrice) / v.price * 100).round();
        } else {
          discountPercent = 0;
        }
      }
    }

    final hasDiscount = mrpPrice > currentPrice && discountPercent > 0;
    final displayUnit = activeVariantName.isNotEmpty
        ? activeVariantName
        : (product.weightUnit.isNotEmpty ? product.weightUnit : '1 unit');
    final perUnitPrice = _calculatePerUnitPrice(currentPrice, displayUnit);


    final images =
        product.productImages.where((i) => i.trim().isNotEmpty).toList();

    final category = product.categories.isNotEmpty
        ? product.categories.first.trim()
        : product.subcategory.trim();
    final shortDescription = _shortDescription(product);
    final showVariants = isMultiVariant(product);
    final hasBrandOrWarranty = product.brandName.trim().isNotEmpty ||
        product.warranty.trim().isNotEmpty;

    final infoBlocks = <Widget>[
      _buildTitleBlock(
        product: product,
        category: category,
        displayUnit: displayUnit,
        inStock: inStock,
        showVariants: showVariants,
        shortDescription: shortDescription,
      ),
      _buildPriceCard(
        displayUnit: displayUnit,
        currentPrice: currentPrice,
        mrpPrice: mrpPrice,
        hasDiscount: hasDiscount,
        discountPercent: discountPercent,
        perUnitPrice: perUnitPrice,
      ),
      if (showVariants) _buildQuantitySelector(product, activeVariantName),
      _buildHighlightsRow(context, product, activeVariantName),
      if (hasBrandOrWarranty) _buildBrandAndWarranty(context, product),
      if (product.showFarmerTraceability || !product.farmer.isEmpty)
        FarmerTraceabilityCard(product: product),
    ];

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          _handleBackNavigation(context);
        }
      },
      child: _withJakartaSans(
        context,
        Scaffold(
          backgroundColor: Colors.white,
          body: Column(
            children: [
              Expanded(
                child: Stack(
                  children: [
                    MediaQuery.removePadding(
                      context: context,
                      removeTop: true,
                      child: ListView(
                        controller: _scrollController,
                        padding: EdgeInsets.zero,
                        cacheExtent: AppScrollConfig.cacheExtent,
                        children: [
                          _ProductImageGallery(
                            images: images,
                            product: product,
                            videoUrl: product.videoUrl,
                            statusBarHeight:
                                MediaQuery.paddingOf(context).top,
                          ),
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                for (var i = 0; i < infoBlocks.length; i++) ...[
                                  if (i > 0) const SizedBox(height: 20),
                                  infoBlocks[i],
                                ],
                              ],
                            ),
                          ),
                          _SectionDivider(
                            child: SimilarProductsSection(
                              productId: product.id,
                              categoryName: product.categories.isNotEmpty
                                  ? product.categories.first
                                  : product.subcategory,
                            ),
                          ),
                          _SectionDivider(
                            child: TopCategoryProductsSection(product: product),
                          ),
                          SizedBox(
                            height: MediaQuery.paddingOf(context).bottom +
                                24 +
                                floatingCartBarHeight,
                          ),
                        ],
                      ),
                    ),
                    const Positioned(
                      left: 12,
                      right: 12,
                      bottom: 8,
                      child: _DetailFloatingCartBar(),
                    ),
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      child: _buildStickyTopBar(
                        context,
                        product,
                        activeVariantName,
                      ),
                    ),
                  ],
                ),
              ),
              _ProductDetailBottomBar(
                product: product,
                cartKey: cartKey,
                activeVariantName: activeVariantName,
                selectionColor: selectionColor,
                inStock: inStock,
                minOrderQuantity: minOrderQuantity,
                maxQuantity: maxQuantity,
                currentPrice: currentPrice,
                mrpPrice: mrpPrice,
                hasDiscount: hasDiscount,
                displayUnit: displayUnit,
                onAddToCart: _addToCart,
                onQuantityDecrease: _handleQuantityDecrease,
                onQuantityIncrease: _handleQuantityIncrease,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _scrollToQuantitySelector() {
    final sectionContext = _quantitySectionKey.currentContext;
    if (sectionContext == null) return;
    Scrollable.ensureVisible(
      sectionContext,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      alignment: 0.3,
    );
  }

  Widget _buildTitleBlock({
    required Product product,
    required String category,
    required String displayUnit,
    required bool inStock,
    required bool showVariants,
    required String shortDescription,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (category.isNotEmpty) ...[
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: category),
                const TextSpan(text: '  ›  '),
                TextSpan(
                  text: product.name,
                  style: const TextStyle(color: _kSlate800),
                ),
              ],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: _kSlate500,
            ),
          ),
          const SizedBox(height: 8),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                product.name,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  height: 1.3,
                  letterSpacing: -0.3,
                  color: _kInk,
                ),
              ),
            ),
            if (product.ratings > 0) ...[
              const SizedBox(width: 12),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: _RatingPill(rating: product.ratings),
              ),
            ],
          ],
        ),
        const SizedBox(height: 6),
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 10,
          runSpacing: 6,
          children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: showVariants ? _scrollToQuantitySelector : null,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    displayUnit,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _kSlate800,
                    ),
                  ),
                  if (showVariants) ...[
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 20,
                      color: Color(0xFF334155),
                    ),
                  ],
                ],
              ),
            ),
            if (inStock && product.stock > 0 && product.stock <= 10)
              _StatusChip(
                label: '${product.stock} left',
                icon: Icons.battery_3_bar_rounded,
                foreground: const Color(0xFFB45309),
                background: const Color(0xFFFFFBEB),
                border: const Color(0xFFFEF3C7),
              )
            else if (!inStock)
              const _StatusChip(
                label: 'Out of stock',
                foreground: Color(0xFFDC2626),
                background: Color(0xFFFEF2F2),
                border: Color(0xFFFEE2E2),
              ),
          ],
        ),
        if (shortDescription.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            shortDescription,
            style: const TextStyle(
              fontSize: 13,
              height: 1.55,
              color: _kSlate600,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPriceCard({
    required String displayUnit,
    required double currentPrice,
    required double mrpPrice,
    required bool hasDiscount,
    required int discountPercent,
    required String? perUnitPrice,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC).withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kHairline),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  displayUnit,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _kSlate600,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    Text(
                      formatInr(currentPrice),
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        height: 1.0,
                        color: _kInk,
                      ),
                    ),
                    if (mrpPrice > currentPrice)
                      Text(
                        formatInr(mrpPrice),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: _kSlate400,
                          decoration: TextDecoration.lineThrough,
                          decorationColor: _kSlate400,
                        ),
                      ),
                    if (hasDiscount) _DiscountChip(percent: discountPercent),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  perUnitPrice != null
                      ? '$perUnitPrice  ·  (Inclusive of all taxes)'
                      : '(Inclusive of all taxes)',
                  style: const TextStyle(
                    fontSize: 11,
                    color: _kSlate500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuantitySelector(Product product, String activeVariantName) {
    return Column(
      key: _quantitySectionKey,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select quantity',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
            color: _kInk,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: _QuantityOptionCard.height,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            itemCount: product.variants.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final variant = product.variants[index];
              final vHasDiscount = variant.discountedPrice > 0 &&
                  variant.price > variant.discountedPrice;
              return _QuantityOptionCard(
                label: variant.name,
                imageUrl: product.primaryImage,
                salePrice: variant.discountedPrice > 0
                    ? variant.discountedPrice
                    : variant.price,
                originalPrice: variant.price,
                discountPercent: vHasDiscount
                    ? ((variant.price - variant.discountedPrice) /
                            variant.price *
                            100)
                        .round()
                    : 0,
                selected: activeVariantName == variant.name,
                onTap: () => _handleVariantChange(product, variant.name),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildBrandAndWarranty(BuildContext context, Product product) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (product.brandName.trim().isNotEmpty)
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: () => context.push(
                '${RoutePaths.product}?brandName=${Uri.encodeComponent(product.brandName)}',
              ),
              borderRadius: BorderRadius.circular(12),
              child: Ink(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kCardBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        product.brandName.substring(0, 1).toUpperCase(),
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                          color: _kEmerald700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            product.brandName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: _kInk,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Explore all products',
                            style: TextStyle(
                              fontSize: 12,
                              color: _kSlate500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: _kSlate400,
                      size: 22,
                    ),
                  ],
                ),
              ),
            ),
          ),
        if (product.brandName.trim().isNotEmpty &&
            product.warranty.trim().isNotEmpty)
          const SizedBox(height: 10),
        if (product.warranty.trim().isNotEmpty)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kCardBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.published_with_changes_outlined,
                    color: _kSlate800,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    product.warranty,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: _kInk,
                    ),
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: _kSlate400,
                  size: 22,
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildStickyTopBar(
    BuildContext context,
    Product product,
    String activeVariantName,
  ) {
    final topPadding = MediaQuery.paddingOf(context).top;

    return ValueListenableBuilder<double>(
      valueListenable: _scrollProgress,
      builder: (context, progress, _) {
        return Container(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: progress),
            border: Border(
              bottom: BorderSide(
                color: _kHairline.withValues(alpha: progress),
              ),
            ),
            boxShadow: progress > 0
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04 * progress),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          padding: EdgeInsets.fromLTRB(12, topPadding + 12, 12, 10),
          child: Row(
            children: [
              _CircleIconButton(
                icon: Icons.chevron_left_rounded,
                iconSize: 24,
                tooltip: 'Go back',
                onTap: () => _handleBackNavigation(context),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: IgnorePointer(
                  ignoring: progress < 0.2,
                  child: Opacity(
                    opacity: progress,
                    child: Text(
                      product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: _kInk,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              _CircleWishlistButton(product: product),
              const SizedBox(width: 8),
              _CircleIconButton(
                icon: Icons.share_outlined,
                iconSize: 18,
                tooltip: 'Share',
                onTap: () => shareProductWithCard(
                  context,
                  product,
                  variantName: activeVariantName,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHighlightsRow(
    BuildContext context,
    Product product,
    String activeVariantName,
  ) {
    final highlights = _extractHighlights(product);

    return SizedBox(
      height: 56,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (highlights.isNotEmpty) ...[
            ...highlights.take(2).map(
                  (h) => Expanded(
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _kHairline),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            h.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              color: _kSlate500,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            h.value,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: _kInk,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
          ] else ...[
            const Spacer(),
          ],
          Material(
            color: const Color(0xFFECFDF5),
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: () => _showProductDetailsModal(
                context,
                product,
                activeVariantName,
              ),
              borderRadius: BorderRadius.circular(12),
              child: Ink(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: const Center(
                  child: Text(
                    'View\ndetails',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _kEmerald700,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                      height: 1.2,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showProductDetailsModal(
    BuildContext context,
    Product product,
    String activeVariantName,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalContext) => _withJakartaSans(
        modalContext,
        _ProductDetailsSheet(
          productId: product.id,
          initialActiveVariantName: activeVariantName,
          onAddToCart: _addToCart,
          onQuantityDecrease: _handleQuantityDecrease,
          onQuantityIncrease: _handleQuantityIncrease,
        ),
      ),
    );
  }

  CartItem? _resolveCartLine(
    Product product,
    String activeVariantName,
    String selectionColor,
  ) {
    final items = ref.read(cartControllerProvider).items;
    return findCartLineForProductDetail(
      items,
      product,
      activeVariantName,
      selectionColor,
    );
  }

  void _showQuantityMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _handleQuantityDecrease(
    Product product,
    String activeVariantName,
    String selectionColor,
  ) async {
    final minOrderQuantity = getMinOrderQuantity(product, activeVariantName);
    final quantityStep = getCartAdjustStep(product, activeVariantName);
    final line = _resolveCartLine(product, activeVariantName, selectionColor);

    if (line != null) {
      final nextQty = getDecreasedCartQuantityForProduct(
        product,
        line.quantity,
        line.variantName,
      );
      if (nextQty <= 0) {
        await ref.read(cartControllerProvider.notifier).removeFromCartLine(
              productId: line.id,
              variantName: line.variantName,
              colorName: line.colorName,
            );
      } else {
        final ok = await ref
            .read(cartControllerProvider.notifier)
            .updateCartLineQuantity(
              productId: line.id,
              quantity: nextQty,
              variantName: line.variantName,
              colorName: line.colorName,
            );
        if (!ok) {
          _showQuantityMessage(
            ref.read(cartControllerProvider).errorMessage ??
                'Could not update quantity',
          );
        }
      }
      return;
    }

    setState(() {
      _quantity = (_quantity - quantityStep).clamp(minOrderQuantity, _quantity);
    });
  }

  Future<void> _handleQuantityIncrease(
    Product product,
    String activeVariantName,
    String selectionColor,
  ) async {
    final minOrderQuantity = getMinOrderQuantity(product, activeVariantName);
    final quantityStep = getCartAdjustStep(product, activeVariantName);
    final maxQuantity = getMaxOrderQuantity(product, activeVariantName);
    var line = _resolveCartLine(product, activeVariantName, selectionColor);

    if (line != null) {
      final nextQty = getNextCartQuantityForProduct(
        product,
        line.quantity,
        line.variantName,
      );
      if (nextQty <= line.quantity) {
        _showQuantityMessage(
          maxQuantity <= line.quantity
              ? 'Maximum $maxQuantity units available'
              : 'Cannot increase quantity further',
        );
        return;
      }

      final ok = await ref
          .read(cartControllerProvider.notifier)
          .updateCartLineQuantity(
            productId: line.id,
            quantity: nextQty,
            variantName: line.variantName,
            colorName: line.colorName,
          );
      if (!ok) {
        _showQuantityMessage(
          ref.read(cartControllerProvider).errorMessage ??
              'Could not update quantity',
        );
      }
      return;
    }

    await ref.read(cartControllerProvider.notifier).loadCart(silent: true);
    line = _resolveCartLine(product, activeVariantName, selectionColor);
    if (line != null) {
      await _handleQuantityIncrease(
        product,
        activeVariantName,
        selectionColor,
      );
      return;
    }

    setState(() {
      _quantity =
          (_quantity + quantityStep).clamp(minOrderQuantity, maxQuantity);
    });
  }

  Future<void> _addToCart(
    Product product,
    String activeVariantName,
    String selectionColor,
    BuildContext flySourceContext,
  ) async {
    final availableColors = getAvailableColors(product, activeVariantName);
    if (availableColors.isNotEmpty && selectionColor.isEmpty) return;

    final existingLine = findCartLineForProductDetail(
      ref.read(cartControllerProvider).items,
      product,
      activeVariantName,
      selectionColor,
    );
    if (existingLine != null) {
      await _handleQuantityIncrease(
        product,
        activeVariantName,
        selectionColor,
      );
      return;
    }

    final result = await ref.read(cartControllerProvider.notifier).addToCart(
          product,
          _quantity,
          variantName: activeVariantName,
          colorName: selectionColor,
          flySourceContext: flySourceContext,
        );
    if (result == AddToCartResult.requiresLogin && mounted) {
      ref.read(authControllerProvider.notifier).openAuthModal();
    } else if (result == AddToCartResult.success) {
      setState(() => _quantitySyncedKey = null);
    }
  }
}

// ---------------------------------------------------------------------------
// Bottom Sheet Modal ("View product details >") - Image 3 Layout
// ---------------------------------------------------------------------------

class _ProductDetailsSheet extends ConsumerWidget {
  const _ProductDetailsSheet({
    required this.productId,
    required this.initialActiveVariantName,
    required this.onAddToCart,
    required this.onQuantityDecrease,
    required this.onQuantityIncrease,
  });

  final String productId;
  final String initialActiveVariantName;
  final Future<void> Function(
    Product product,
    String activeVariantName,
    String selectionColor,
    BuildContext flySourceContext,
  ) onAddToCart;
  final Future<void> Function(
    Product product,
    String activeVariantName,
    String selectionColor,
  ) onQuantityDecrease;
  final Future<void> Function(
    Product product,
    String activeVariantName,
    String selectionColor,
  ) onQuantityIncrease;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productAsync = ref.watch(productDetailProvider(productId));

    return productAsync.when(
      loading: () => const SizedBox(
        height: 300,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (product) => _buildSheetBody(context, ref, product),
    );
  }

  Widget _buildSheetBody(BuildContext context, WidgetRef ref, Product product) {
    final activeVariantName =
        resolveActiveVariantName(product, initialActiveVariantName);
    final selectionColor =
        resolveSelectionColor(product, activeVariantName, '');
    final cartKey = ProductDetailCartKey(
      productId: product.id,
      variantName: activeVariantName,
      colorName: selectionColor,
    );

    final cartLineQuantity =
        ref.watch(productDetailCartQuantityProvider(cartKey));
    final inCart = cartLineQuantity != null;
    final inStock = isProductInStock(product, activeVariantName);
    final minOrderQuantity = getMinOrderQuantity(product, activeVariantName);
    final maxQuantity = getMaxOrderQuantity(product, activeVariantName);

    double currentPrice = product.effectivePrice;
    double mrpPrice = product.price;
    int discountPercent = product.discountedPercent.round();

    if (isMultiVariant(product)) {
      final v = getVariant(product, activeVariantName);
      if (v != null) {
        currentPrice = v.discountedPrice > 0 ? v.discountedPrice : v.price;
        mrpPrice = v.price;
        if (v.discountedPrice > 0 && v.price > v.discountedPrice) {
          discountPercent =
              ((v.price - v.discountedPrice) / v.price * 100).round();
        } else {
          discountPercent = 0;
        }
      }
    }

    final hasDiscount = mrpPrice > currentPrice && discountPercent > 0;
    final displayUnit = activeVariantName.isNotEmpty
        ? activeVariantName
        : (product.weightUnit.isNotEmpty ? product.weightUnit : '1 unit');

    final highlights = _extractHighlights(product);
    final keyInfoItems = <_DetailRowItem>[];
    final nutritionalItems = <_DetailRowItem>[];

    for (final spec in product.specifications) {
      final name = spec.name.trim();
      final val = spec.value.trim();
      if (name.isEmpty || val.isEmpty) continue;
      if (_isNutritionalSpec(name)) {
        nutritionalItems.add(_DetailRowItem(label: name, value: val));
      } else {
        keyInfoItems.add(_DetailRowItem(label: name, value: val));
      }
    }

    // Backend metadata rows (only if available)
    if (product.brandName.trim().isNotEmpty &&
        !keyInfoItems.any((i) => i.label.toLowerCase() == 'brand')) {
      keyInfoItems.add(
          _DetailRowItem(label: 'Brand', value: product.brandName.trim()));
    }
    if (product.categories.isNotEmpty &&
        !keyInfoItems.any((i) => i.label.toLowerCase() == 'category')) {
      keyInfoItems.add(_DetailRowItem(
          label: 'Category', value: product.categories.join(', ')));
    }
    if (product.subcategory.trim().isNotEmpty &&
        !keyInfoItems.any((i) => i.label.toLowerCase() == 'subcategory')) {
      keyInfoItems.add(_DetailRowItem(
          label: 'Subcategory', value: product.subcategory.trim()));
    }
    if (product.warranty.trim().isNotEmpty &&
        !keyInfoItems.any((i) =>
            i.label.toLowerCase().contains('warranty') ||
            i.label.toLowerCase().contains('replacement'))) {
      keyInfoItems.add(_DetailRowItem(
          label: 'Return / Replacement', value: product.warranty.trim()));
    }

    final hasDescription = product.description.trim().isNotEmpty;
    final hasFeatures = product.features.isNotEmpty;

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Circular 'X' close button above modal (as shown in Image 3)
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 36,
              height: 36,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xCC000000),
              ),
              child: const Icon(Icons.close, color: Colors.white, size: 20),
            ),
          ),

          // Modal Sheet Card
          Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.82,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              children: [
                // Modal Header: Product Thumbnail + Title
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: (product.primaryImage != null && product.primaryImage!.trim().isNotEmpty)
                            ? AppNetworkImage(
                                imageUrl: product.primaryImage!,
                                fit: BoxFit.contain,
                              )
                            : const AppImagePlaceholder(fit: BoxFit.contain),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          product.name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFE5E7EB)),

                // Scrollable Content: Highlights & All details
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Highlights Section
                      if (highlights.isNotEmpty) ...[
                        const Text(
                          'Highlights',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: highlights.map((h) {
                            return Container(
                              constraints: const BoxConstraints(minWidth: 110),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF3F4F6),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    h.label,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    h.value,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // All Details Section
                      if (keyInfoItems.isNotEmpty ||
                          nutritionalItems.isNotEmpty ||
                          hasDescription ||
                          hasFeatures) ...[
                        const Text(
                          'All details',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Key Information Card
                        if (keyInfoItems.isNotEmpty)
                          _ExpandableDetailCard(
                            title: 'Key Information',
                            initiallyExpanded: true,
                            child: _buildDetailRows(keyInfoItems),
                          ),

                        // Nutritional Information Card
                        if (nutritionalItems.isNotEmpty)
                          _ExpandableDetailCard(
                            title: 'Nutritional Information',
                            initiallyExpanded: true,
                            child: _buildDetailRows(nutritionalItems),
                          ),

                        // Description Card (Only if backend description exists)
                        if (hasDescription)
                          _ExpandableDetailCard(
                            title: 'Description',
                            initiallyExpanded: false,
                            child: Text(
                              product.description.trim(),
                              style: const TextStyle(
                                fontSize: 13,
                                height: 1.5,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),

                        // Features Card (Only if backend features exist)
                        if (hasFeatures)
                          _ExpandableDetailCard(
                            title: 'Features',
                            initiallyExpanded: false,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: product.features
                                  .where((f) => f.trim().isNotEmpty)
                                  .map(
                                    (feature) => Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 6),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text('• ',
                                              style: TextStyle(
                                                  fontWeight: FontWeight.bold)),
                                          Expanded(
                                            child: Text(
                                              feature.trim(),
                                              style: const TextStyle(
                                                fontSize: 13,
                                                height: 1.4,
                                                color: AppColors.textPrimary,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ),
                      ],
                    ],
                  ),
                ),

                // Sticky Bottom Bar inside Bottom Sheet
                Container(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              displayUnit,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Text(
                                  formatInr(currentPrice),
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                if (hasDiscount) ...[
                                  const SizedBox(width: 6),
                                  Text(
                                    'MRP ${formatInr(mrpPrice)}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textMuted,
                                      decoration: TextDecoration.lineThrough,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const Text(
                              'Inclusive of all taxes',
                              style: TextStyle(
                                fontSize: 10,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      inCart
                          ? _CartActionQuantity(
                              quantity: cartLineQuantity,
                              min: minOrderQuantity,
                              max: maxQuantity,
                              disabled: !inStock,
                              onDecrease: () => onQuantityDecrease(
                                product,
                                activeVariantName,
                                selectionColor,
                              ),
                              onIncrease: () => onQuantityIncrease(
                                product,
                                activeVariantName,
                                selectionColor,
                              ),
                            )
                          : _AddToCartButton(
                              inStock: inStock,
                              onPressed: () => onAddToCart(
                                product,
                                activeVariantName,
                                selectionColor,
                                context,
                              ),
                            ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Expandable Detail Card (Accordion)
// ---------------------------------------------------------------------------

class _ExpandableDetailCard extends StatefulWidget {
  const _ExpandableDetailCard({
    required this.title,
    required this.child,
    this.initiallyExpanded = true,
  });

  final String title;
  final Widget child;
  final bool initiallyExpanded;

  @override
  State<_ExpandableDetailCard> createState() => _ExpandableDetailCardState();
}

class _ExpandableDetailCardState extends State<_ExpandableDetailCard> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: const Color(0xFF6B7280),
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            const Divider(height: 1, color: Color(0xFFE5E7EB)),
            Padding(
              padding: const EdgeInsets.all(14),
              child: widget.child,
            ),
          ],
        ],
      ),
    );
  }
}

class _DetailRowItem {
  const _DetailRowItem({required this.label, required this.value});
  final String label;
  final String value;
}

Widget _buildDetailRows(List<_DetailRowItem> items) {
  return Column(
    children: items.map((item) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 140,
              child: Text(
                item.label,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  height: 1.3,
                ),
              ),
            ),
            Expanded(
              child: Text(
                item.value,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w500,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      );
    }).toList(),
  );
}

class _HighlightChipItem {
  const _HighlightChipItem({required this.label, required this.value});
  final String label;
  final String value;
}

bool _isNutritionalSpec(String name) {
  final lower = name.toLowerCase();
  return lower.contains('nutri') ||
      lower.contains('protein') ||
      lower.contains('carb') ||
      lower.contains('calorie') ||
      lower.contains('fat') ||
      lower.contains('sugar') ||
      lower.contains('energy') ||
      lower.contains('sodium') ||
      lower.contains('fiber') ||
      lower.contains('cholesterol');
}

bool _isHighlightSpec(String name) {
  final lower = name.toLowerCase();
  return lower.contains('shelf') ||
      lower.contains('life') ||
      lower.contains('type') ||
      lower.contains('form') ||
      lower.contains('diet') ||
      lower.contains('origin');
}

List<_HighlightChipItem> _extractHighlights(Product product) {
  final chips = <_HighlightChipItem>[];

  for (final spec in product.specifications) {
    final name = spec.name.trim();
    final val = spec.value.trim();
    if (name.isEmpty || val.isEmpty) continue;
    if (_isHighlightSpec(name)) {
      chips.add(_HighlightChipItem(label: name, value: val));
    }
  }

  if (chips.indexWhere((c) => c.label.toLowerCase().contains('type')) == -1 &&
      product.subcategory.trim().isNotEmpty) {
    chips.add(_HighlightChipItem(
      label: 'Type',
      value: product.subcategory.trim(),
    ));
  }

  if (chips.length < 2) {
    for (final spec in product.specifications) {
      final name = spec.name.trim();
      final val = spec.value.trim();
      if (name.isEmpty || val.isEmpty) continue;
      if (!_isNutritionalSpec(name) &&
          !chips.any((c) => c.label.toLowerCase() == name.toLowerCase())) {
        chips.add(_HighlightChipItem(label: name, value: val));
        if (chips.length >= 2) break;
      }
    }
  }

  if (chips.length < 2 && product.categories.isNotEmpty) {
    chips.add(_HighlightChipItem(
      label: 'Category',
      value: product.categories.first.trim(),
    ));
  }

  return chips;
}

String? _calculatePerUnitPrice(double price, String unit) {
  final match = RegExp(
          r'^(\d+(?:\.\d+)?)\s*(kg|g|l|ml|ltr|pc|piece)s?$',
          caseSensitive: false)
      .firstMatch(unit.trim());
  if (match == null) return null;
  final qty = double.tryParse(match.group(1) ?? '');
  final u = match.group(2)?.toLowerCase() ?? '';
  if (qty == null || qty <= 0) return null;

  if (u == 'kg' || u == 'l' || u == 'ltr') {
    final perUnit = price / qty;
    return '₹${perUnit.toStringAsFixed(perUnit.truncateToDouble() == perUnit ? 0 : 1)}/${u == 'ltr' ? 'l' : u}';
  } else if (u == 'g' && qty >= 50) {
    final perKg = (price / qty) * 1000;
    return '₹${perKg.toStringAsFixed(perKg.truncateToDouble() == perKg ? 0 : 1)}/kg';
  } else if (u == 'ml' && qty >= 50) {
    final perL = (price / qty) * 1000;
    return '₹${perL.toStringAsFixed(perL.truncateToDouble() == perL ? 0 : 1)}/l';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Style tokens (website mobile product detail)
// ---------------------------------------------------------------------------

const _kInk = Color(0xFF0F172A);
const _kSlate800 = Color(0xFF1E293B);
const _kSlate600 = Color(0xFF475569);
const _kSlate500 = Color(0xFF64748B);
const _kSlate400 = Color(0xFF94A3B8);
const _kHairline = Color(0xFFF1F5F9);
const _kCardBorder = Color(0xFFE2E8F0);
const _kCircleBorder = Color(0xFFE5E5E5);
const _kEmerald700 = Color(0xFF047857);
const _kStepperGreen = Color(0xFF22C55E);
const _kActiveThumb = Color(0xFF0C831F);

Widget _withJakartaSans(BuildContext context, Widget child) {
  final theme = Theme.of(context);
  return Theme(
    data: theme.copyWith(
      textTheme: GoogleFonts.plusJakartaSansTextTheme(theme.textTheme),
    ),
    child: DefaultTextStyle.merge(
      style: GoogleFonts.plusJakartaSans(),
      child: child,
    ),
  );
}

String _shortDescription(Product product) {
  final plain = product.description
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  if (plain.length <= 140) return plain;
  return '${plain.substring(0, 140)}…';
}

class _SectionDivider extends StatelessWidget {
  const _SectionDivider({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: _kHairline)),
      ),
      child: child,
    );
  }
}

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.onTap,
    this.iconSize = 20,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback onTap;
  final double iconSize;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: Colors.white.withValues(alpha: 0.95),
      shape: const CircleBorder(side: BorderSide(color: _kCircleBorder)),
      elevation: 1,
      shadowColor: Colors.black26,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(icon, size: iconSize, color: const Color(0xFF1A1A1A)),
        ),
      ),
    );
    if (tooltip == null) return button;
    return Tooltip(message: tooltip!, child: button);
  }
}

class _CircleWishlistButton extends StatelessWidget {
  const _CircleWishlistButton({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      position: DecorationPosition.foreground,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: _kCircleBorder),
      ),
      child: WishlistButton(product: product, size: 36),
    );
  }
}

class _RatingPill extends StatelessWidget {
  const _RatingPill({required this.rating});

  final double rating;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFFEF3C7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star_rounded, size: 16, color: Color(0xFFFBBF24)),
          const SizedBox(width: 4),
          Text(
            rating.toStringAsFixed(1),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _kSlate800,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.foreground,
    required this.background,
    required this.border,
    this.icon,
  });

  final String label;
  final IconData? icon;
  final Color foreground;
  final Color background;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: foreground),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: foreground,
            ),
          ),
        ],
      ),
    );
  }
}

class _DiscountChip extends StatelessWidget {
  const _DiscountChip({required this.percent});

  final int percent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        '$percent% OFF',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _AddToCartButton extends StatelessWidget {
  const _AddToCartButton({required this.inStock, required this.onPressed});

  final bool inStock;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 104, minHeight: 38),
      child: ElevatedButton(
        onPressed: inStock ? onPressed : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: _kEmerald700,
          foregroundColor: Colors.white,
          disabledBackgroundColor: _kEmerald700.withValues(alpha: 0.5),
          disabledForegroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size(104, 38),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: Text(
          inStock ? 'Add to cart' : 'Out of Stock',
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

class _QuantityOptionCard extends StatelessWidget {
  const _QuantityOptionCard({
    required this.label,
    required this.imageUrl,
    required this.salePrice,
    required this.originalPrice,
    required this.discountPercent,
    required this.selected,
    required this.onTap,
  });

  static const double height = 140;
  static const double _imageHeight = 84;

  final String label;
  final String? imageUrl;
  final double salePrice;
  final double originalPrice;
  final int discountPercent;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final image = imageUrl?.trim() ?? '';
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 140,
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFE7F3D4) : const Color(0xFFF4F8EA),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xFF059669) : const Color(0xFFE4EDD6),
            width: selected ? 1.5 : 1,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 3,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: _imageHeight,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ColoredBox(
                    color: Colors.white,
                    child: image.isNotEmpty
                        ? AppNetworkImage(
                            imageUrl: image,
                            fit: BoxFit.cover,
                            cacheWidth: 300,
                            cacheHeight: 300,
                          )
                        : const SizedBox.shrink(),
                  ),
                  if (discountPercent > 0)
                    Positioned(
                      left: 0,
                      top: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 2,
                        ),
                        decoration: const BoxDecoration(
                          color: Color(0xFF2563EB),
                          borderRadius: BorderRadius.only(
                            bottomRight: Radius.circular(8),
                          ),
                        ),
                        child: Text(
                          '$discountPercent% OFF',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        height: 1.25,
                        color: _kInk,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        formatInr(salePrice),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          height: 1.25,
                          color: _kInk,
                        ),
                      ),
                      if (originalPrice > salePrice)
                        Text(
                          formatInr(originalPrice),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            height: 1.25,
                            color: _kSlate400,
                            decoration: TextDecoration.lineThrough,
                            decorationColor: _kSlate400,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Sticky Bottom Bar
// ---------------------------------------------------------------------------

class _DetailFloatingCartBar extends ConsumerWidget {
  const _DetailFloatingCartBar();

  /// Guests see their cart too; signing in is asked for at checkout.
  void _openCart(BuildContext context) => context.go(RoutePaths.cart);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartCount =
        ref.watch(cartControllerProvider.select((s) => s.cartCount));
    if (cartCount <= 0) return const SizedBox.shrink();
    return FloatingCartBar(onOpenCart: () => _openCart(context));
  }
}

class _ProductDetailBottomBar extends ConsumerWidget {
  const _ProductDetailBottomBar({
    required this.product,
    required this.cartKey,
    required this.activeVariantName,
    required this.selectionColor,
    required this.inStock,
    required this.minOrderQuantity,
    required this.maxQuantity,
    required this.currentPrice,
    required this.mrpPrice,
    required this.hasDiscount,
    required this.displayUnit,
    required this.onAddToCart,
    required this.onQuantityDecrease,
    required this.onQuantityIncrease,
  });

  final Product product;
  final ProductDetailCartKey cartKey;
  final String activeVariantName;
  final String selectionColor;
  final bool inStock;
  final int minOrderQuantity;
  final int maxQuantity;
  final double currentPrice;
  final double mrpPrice;
  final bool hasDiscount;
  final String displayUnit;
  final Future<void> Function(
    Product product,
    String activeVariantName,
    String selectionColor,
    BuildContext flySourceContext,
  ) onAddToCart;
  final Future<void> Function(
    Product product,
    String activeVariantName,
    String selectionColor,
  ) onQuantityDecrease;
  final Future<void> Function(
    Product product,
    String activeVariantName,
    String selectionColor,
  ) onQuantityIncrease;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartLineQuantity =
        ref.watch(productDetailCartQuantityProvider(cartKey));
    final inCart = cartLineQuantity != null;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + bottomInset),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: _kHairline)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  displayUnit,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: _kSlate600,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      formatInr(currentPrice),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: _kInk,
                      ),
                    ),
                    if (hasDiscount) ...[
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'MRP ${formatInr(mrpPrice)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: _kSlate400,
                            decoration: TextDecoration.lineThrough,
                            decorationColor: _kSlate400,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const Text(
                  '(Inclusive of all taxes)',
                  style: TextStyle(
                    fontSize: 10,
                    color: _kSlate500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          inCart
              ? _CartActionQuantity(
                  quantity: cartLineQuantity,
                  min: minOrderQuantity,
                  max: maxQuantity,
                  disabled: !inStock,
                  onDecrease: () => onQuantityDecrease(
                    product,
                    activeVariantName,
                    selectionColor,
                  ),
                  onIncrease: () => onQuantityIncrease(
                    product,
                    activeVariantName,
                    selectionColor,
                  ),
                )
              : _AddToCartButton(
                  inStock: inStock,
                  onPressed: () => onAddToCart(
                    product,
                    activeVariantName,
                    selectionColor,
                    context,
                  ),
                ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Quantity Stepper (website CartActionQuantity)
// ---------------------------------------------------------------------------

class _CartActionQuantity extends StatelessWidget {
  const _CartActionQuantity({
    required this.quantity,
    required this.min,
    required this.max,
    required this.disabled,
    required this.onDecrease,
    required this.onIncrease,
  });

  final int quantity;
  final int min;
  final int max;
  final bool disabled;
  final VoidCallback onDecrease;
  final VoidCallback onIncrease;

  @override
  Widget build(BuildContext context) {
    final canIncrease = !disabled && quantity < max;
    return Container(
      width: 108,
      height: 38,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _kStepperGreen, width: 1.5),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          InkWell(
            onTap: disabled ? null : onDecrease,
            borderRadius:
                const BorderRadius.horizontal(left: Radius.circular(8)),
            child: SizedBox(
              width: 34,
              height: 35,
              child: Icon(
                Icons.remove_rounded,
                size: 18,
                color: disabled
                    ? _kStepperGreen.withValues(alpha: 0.4)
                    : const Color(0xFF16A34A),
              ),
            ),
          ),
          Text(
            '$quantity',
            style: const TextStyle(
              color: _kInk,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
          InkWell(
            onTap: canIncrease ? onIncrease : null,
            borderRadius:
                const BorderRadius.horizontal(right: Radius.circular(8)),
            child: SizedBox(
              width: 34,
              height: 35,
              child: Icon(
                Icons.add_rounded,
                size: 18,
                color: canIncrease
                    ? const Color(0xFF16A34A)
                    : _kStepperGreen.withValues(alpha: 0.4),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Product Image Gallery + Thumbnails
// ---------------------------------------------------------------------------

class _ProductImageGallery extends StatefulWidget {
  const _ProductImageGallery({
    required this.images,
    required this.product,
    required this.videoUrl,
    required this.statusBarHeight,
  });

  final List<String> images;
  final Product product;
  final String videoUrl;
  final double statusBarHeight;

  @override
  State<_ProductImageGallery> createState() => _ProductImageGalleryState();
}

class _GalleryItem {
  const _GalleryItem({required this.type, required this.url});

  final String type;
  final String url;
}

class _ProductImageGalleryState extends State<_ProductImageGallery> {
  int _activeMedia = 0;
  late final PageController _pageController;

  List<_GalleryItem> get _items {
    final items = widget.images
        .map((url) => _GalleryItem(type: 'image', url: url))
        .toList();
    final video = widget.videoUrl.trim();
    if (video.isNotEmpty) {
      items.add(_GalleryItem(type: 'video', url: video));
    }
    return items;
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _selectMedia(int index) {
    setState(() => _activeMedia = index);
    if (_pageController.hasClients) {
      _pageController.animateToPage(
        index,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    final screen = MediaQuery.sizeOf(context);
    final imageHeight = math.min(
      screen.width,
      math.min(screen.height * 0.7, 520.0),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: EdgeInsets.only(top: widget.statusBarHeight),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: _kHairline)),
          ),
          child: SizedBox(
            height: imageHeight,
            child: Stack(
              children: [
                Positioned.fill(
                  child: items.isEmpty
                      ? const Center(
                          child: AppImagePlaceholder(fit: BoxFit.contain),
                        )
                      : PageView.builder(
                          controller: _pageController,
                          itemCount: items.length,
                          onPageChanged: (index) =>
                              setState(() => _activeMedia = index),
                          itemBuilder: (context, index) {
                            final item = items[index];
                            if (item.type == 'video') {
                              return ProductVideoPlayer(
                                url: item.url,
                                embedded: true,
                              );
                            }
                            return AppNetworkImage(
                              imageUrl: item.url,
                              fit: BoxFit.contain,
                              width: double.infinity,
                              height: double.infinity,
                              cacheWidth: 1000,
                              cacheHeight: 1000,
                              errorIcon: Icons.image_outlined,
                              errorIconSize: 64,
                            );
                          },
                        ),
                ),
                Positioned(
                  left: 12,
                  bottom: 12,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: _kCircleBorder),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.bolt_rounded,
                          color: _kEmerald700,
                          size: 13,
                        ),
                        SizedBox(width: 3),
                        Text(
                          '10 MINS',
                          style: TextStyle(
                            color: _kSlate800,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (items.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: SizedBox(
              height: 72,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final item = items[index];
                  final active = index == _activeMedia;
                  return GestureDetector(
                    onTap: () => _selectMedia(index),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: active ? _kActiveThumb : _kCircleBorder,
                          width: active ? 1.5 : 1,
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: item.type == 'video'
                          ? const ColoredBox(
                              color: Color(0xFF171717),
                              child: Center(
                                child: Icon(
                                  Icons.play_arrow_rounded,
                                  color: Colors.white,
                                  size: 28,
                                ),
                              ),
                            )
                          : Padding(
                              padding: const EdgeInsets.all(4),
                              child: AppNetworkImage(
                                imageUrl: item.url,
                                fit: BoxFit.contain,
                                cacheWidth: 200,
                                cacheHeight: 200,
                              ),
                            ),
                    ),
                  );
                },
              ),
            ),
          ),
      ],
    );
  }
}


class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Product not found.'),
          const SizedBox(height: 12),
          TextButton(onPressed: onBack, child: const Text('Back to products')),
        ],
      ),
    );
  }
}
