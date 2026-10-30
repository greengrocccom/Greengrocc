import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../../models/product_pricing_models.dart';
import 'product_pricing.dart';

class BulkTier {
  const BulkTier({required this.qtyLabel, required this.price});

  final String qtyLabel;
  final double price;
}

List<BulkTier> getBulkTiers(double basePrice) {
  return [
    BulkTier(qtyLabel: '10 - 49', price: basePrice),
    BulkTier(
      qtyLabel: '50 - 99',
      price: (basePrice * 0.94 * 100).round() / 100,
    ),
    BulkTier(
      qtyLabel: '100+',
      price: (basePrice * 0.88 * 100).round() / 100,
    ),
  ];
}

const int defaultReviewCount = 128;

int getDecreasedCartQuantity(
  int currentQty,
  int step, {
  int? minOrderQuantity,
}) {
  final safeStep = step < 1 ? 1 : step;
  final floor = minOrderQuantity != null && minOrderQuantity > 0
      ? minOrderQuantity
      : safeStep;
  if (currentQty <= floor) return 0;
  final next = currentQty - safeStep;
  return next < floor ? floor : next;
}

CartItem? findCartLine(
  List<CartItem> items,
  String productId,
  String variantName,
  String colorName,
) {
  for (final item in items) {
    if (cartLineMatches(item, productId, variantName, colorName)) {
      return item;
    }
  }
  return null;
}

bool cartLineMatches(
  CartItem item,
  String productId,
  String variantName,
  String colorName,
) {
  if (item.id != productId) return false;
  if (item.variantName.trim().toLowerCase() !=
      variantName.trim().toLowerCase()) {
    return false;
  }
  if (item.colorName.trim().toLowerCase() != colorName.trim().toLowerCase()) {
    return false;
  }
  return true;
}

/// Product detail — exact match first, then best single-line fallback.
CartItem? findCartLineForProductDetail(
  List<CartItem> items,
  Product product,
  String variantName,
  String colorName,
) {
  final exact = findCartLine(items, product.id, variantName, colorName);
  if (exact != null) return exact;

  final productLines =
      items.where((item) => item.id == product.id).toList(growable: false);
  if (productLines.isEmpty) return null;
  if (productLines.length == 1) return productLines.first;

  final variant = variantName.trim().toLowerCase();
  if (variant.isNotEmpty) {
    final byVariant = productLines
        .where((item) => item.variantName.trim().toLowerCase() == variant)
        .toList(growable: false);
    if (byVariant.length == 1) return byVariant.first;
  }

  final color = colorName.trim().toLowerCase();
  if (color.isNotEmpty) {
    final byColor = productLines
        .where((item) => item.colorName.trim().toLowerCase() == color)
        .toList(growable: false);
    if (byColor.length == 1) return byColor.first;
  }

  return null;
}

CartItem cartItemFromProduct(
  Product product,
  int quantity, {
  String variantName = '',
  String colorName = '',
  String? section,
  String? storeType,
}) {
  return CartItem.fromProduct(
    product,
    quantity: quantity,
    variantName: variantName,
    colorName: colorName,
    section: section,
    storeType: storeType,
  );
}

/// Resolves the color used for cart line matching and API calls.
String resolveSelectionColor(
  Product product,
  String activeVariantName,
  String selectedColor,
) {
  final trimmed = selectedColor.trim();
  if (trimmed.isNotEmpty) return trimmed;
  final colors = getAvailableColors(product, activeVariantName);
  return colors.isNotEmpty ? colors.first.name : '';
}

List<ProductSpecification> getResolvedSpecifications(Product product) {
  final specs = product.specifications
      .where((spec) => spec.name.isNotEmpty && spec.value.isNotEmpty)
      .toList();
  if (specs.isNotEmpty) return specs;

  final fallback = <ProductSpecification>[];
  if (product.brandName.isNotEmpty) {
    fallback.add(ProductSpecification(name: 'Brand', value: product.brandName));
  }
  if (product.categories.isNotEmpty) {
    fallback.add(
      ProductSpecification(name: 'Category', value: product.categories.first),
    );
  }
  if (product.subcategory.isNotEmpty) {
    fallback.add(
      ProductSpecification(name: 'Subcategory', value: product.subcategory),
    );
  }
  if (product.warranty.isNotEmpty) {
    fallback.add(ProductSpecification(name: 'Warranty', value: product.warranty));
  }
  for (var i = 0; i < product.features.length; i++) {
    final feature = product.features[i].trim();
    if (feature.isNotEmpty) {
      fallback.add(ProductSpecification(name: 'Feature ${i + 1}', value: feature));
    }
  }
  return fallback;
}

String productSku(Product product) {
  final code = (product.subcategory.isNotEmpty
          ? product.subcategory
          : product.brandName)
      .replaceAll(RegExp(r'\s+'), '-')
      .toUpperCase();
  return 'GG-$code';
}

enum ProductSortOption {
  newest('newest', 'Newest'),
  priceAsc('price-asc', 'Price: Low to High'),
  priceDesc('price-desc', 'Price: High to Low'),
  oldest('oldest', 'Oldest'),
  weightAsc('weight-asc', 'Weight: Low to High'),
  weightDesc('weight-desc', 'Weight: High to Low'),
  discountAsc('discount-asc', 'Discount: Low to High'),
  discountDesc('discount-desc', 'Discount: High to Low'),
  name('name', 'Name A-Z'),
  brand('brand', 'Brand'),
  defaultOrder('default', 'Default');

  const ProductSortOption(this.id, this.label);

  final String id;
  final String label;

  /// Website product listing defaults to newest when no sort is set.
  static const ProductSortOption listingDefault = newest;

  static ProductSortOption? fromId(String? id) {
    if (id == null || id.isEmpty) return listingDefault;
    for (final option in ProductSortOption.values) {
      if (option.id == id) return option;
    }
    return listingDefault;
  }

  /// Compact filter-bar options that match the website ProductFiltersBar.
  static const List<ProductSortOption> listingOptions = [
    newest,
    priceAsc,
    priceDesc,
    discountDesc,
    discountAsc,
    oldest,
    weightAsc,
    weightDesc,
    name,
    brand,
  ];
}

double parseProductWeightGrams(Product product) {
  final text = '${product.variants.isNotEmpty ? product.variants.first.name : ''} ${product.subcategory} ${product.name}';
  final kgMatch = RegExp(r'(\d+(?:\.\d+)?)\s*(?:kg|kilo)', caseSensitive: false).firstMatch(text);
  if (kgMatch != null) {
    return (double.tryParse(kgMatch.group(1) ?? '') ?? 0) * 1000;
  }
  final gMatch = RegExp(r'(\d+(?:\.\d+)?)\s*(?:g|gm|gms)\b', caseSensitive: false).firstMatch(text);
  if (gMatch != null) {
    return double.tryParse(gMatch.group(1) ?? '') ?? 0;
  }
  final lMatch = RegExp(r'(\d+(?:\.\d+)?)\s*(?:l|ltr|litre)\b', caseSensitive: false).firstMatch(text);
  if (lMatch != null) {
    return (double.tryParse(lMatch.group(1) ?? '') ?? 0) * 1000;
  }
  final mlMatch = RegExp(r'(\d+(?:\.\d+)?)\s*ml\b', caseSensitive: false).firstMatch(text);
  if (mlMatch != null) {
    return double.tryParse(mlMatch.group(1) ?? '') ?? 0;
  }
  final pcMatch = RegExp(r'(\d+)\s*(?:pc|pcs|piece|pieces|pack)\b', caseSensitive: false).firstMatch(text);
  if (pcMatch != null) {
    return (double.tryParse(pcMatch.group(1) ?? '') ?? 0) * 100;
  }
  return 0;
}

List<String> extractWeightsAndSizes(List<Product> products) {
  final weights = <String>{};
  final regex = RegExp(r'\b(\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|ml|l|ltr|litre|pc|pcs|pack))\b', caseSensitive: false);
  for (final p in products) {
    for (final v in p.variants) {
      if (v.name.trim().isNotEmpty) {
        weights.add(v.name.trim());
      }
    }
    if (p.subcategory.trim().isNotEmpty && regex.hasMatch(p.subcategory)) {
      weights.add(p.subcategory.trim());
    }
    for (final m in regex.allMatches(p.name)) {
      final str = m.group(1)?.trim();
      if (str != null && str.isNotEmpty) {
        weights.add(str);
      }
    }
  }
  final list = weights.toList();
  list.sort((a, b) {
    final aNum = double.tryParse(RegExp(r'\d+(?:\.\d+)?').firstMatch(a)?.group(0) ?? '') ?? 0;
    final bNum = double.tryParse(RegExp(r'\d+(?:\.\d+)?').firstMatch(b)?.group(0) ?? '') ?? 0;
    return aNum.compareTo(bNum);
  });
  return list;
}

List<Product> filterAndSortProducts({
  required List<Product> products,
  String? searchQuery,
  String? subcategory,
  String? brand,
  String? minPrice,
  String? maxPrice,
  String? minDiscount,
  String? weightSize,
  bool inStockOnly = false,
  ProductSortOption sort = ProductSortOption.listingDefault,
}) {
  final query = searchQuery?.trim().toLowerCase() ?? '';

  var list = products.where((product) {
    if (query.isNotEmpty) {
      final nameMatch = product.name.toLowerCase().contains(query);
      final catMatch = product.categories
          .any((c) => c.toLowerCase().contains(query));
      final subMatch = product.subcategory.toLowerCase().contains(query);
      final brandMatch = product.brandName.toLowerCase().contains(query);
      final descMatch = product.description.toLowerCase().contains(query);
      final featureMatch = product.features
          .any((f) => f.toLowerCase().contains(query));

      bool deptMatch = false;
      if (query.contains('ready') || query.contains('cook')) {
        deptMatch = product.categories.any((c) =>
            c.toLowerCase().contains('ready') ||
            c.toLowerCase().contains('cook'));
      } else if (query.contains('instant')) {
        deptMatch = product.categories.any((c) =>
            c.toLowerCase().contains('instant'));
      } else if (query.contains('preorder') || query.contains('pre order')) {
        deptMatch = true;
      }

      if (!nameMatch &&
          !catMatch &&
          !subMatch &&
          !brandMatch &&
          !descMatch &&
          !featureMatch &&
          !deptMatch) {
        return false;
      }
    }

    if (subcategory != null &&
        subcategory.isNotEmpty &&
        product.subcategory.toLowerCase() != subcategory.toLowerCase()) {
      return false;
    }
    if (brand != null &&
        brand.isNotEmpty &&
        product.brandName.toLowerCase() != brand.toLowerCase()) {
      return false;
    }
    final price = product.discountedPrice;
    final min = double.tryParse(minPrice ?? '');
    final max = double.tryParse(maxPrice ?? '');
    if (min != null && price < min) return false;
    if (max != null && price > max) return false;

    final minDisc = double.tryParse(minDiscount ?? '');
    if (minDisc != null && minDisc > 0 && product.discountedPercent < minDisc) {
      return false;
    }

    if (weightSize != null && weightSize.trim().isNotEmpty) {
      final wLower = weightSize.toLowerCase().trim();
      final inVariants = product.variants.any((v) => v.name.toLowerCase().contains(wLower));
      final inName = product.name.toLowerCase().contains(wLower);
      final inSub = product.subcategory.toLowerCase().contains(wLower);
      if (!inVariants && !inName && !inSub) return false;
    }

    if (inStockOnly && !product.isAvailable) {
      return false;
    }

    return true;
  }).toList();

  list = [...list];
  switch (sort) {
    case ProductSortOption.priceAsc:
      list.sort((a, b) => a.discountedPrice.compareTo(b.discountedPrice));
    case ProductSortOption.priceDesc:
      list.sort((a, b) => b.discountedPrice.compareTo(a.discountedPrice));
    case ProductSortOption.newest:
      list.sort((a, b) => _compareCreatedAt(b, a));
    case ProductSortOption.oldest:
      list.sort((a, b) => _compareCreatedAt(a, b));
    case ProductSortOption.weightAsc:
      list.sort((a, b) => parseProductWeightGrams(a).compareTo(parseProductWeightGrams(b)));
    case ProductSortOption.weightDesc:
      list.sort((a, b) => parseProductWeightGrams(b).compareTo(parseProductWeightGrams(a)));
    case ProductSortOption.discountAsc:
      list.sort((a, b) => a.discountedPercent.compareTo(b.discountedPercent));
    case ProductSortOption.discountDesc:
      list.sort((a, b) => b.discountedPercent.compareTo(a.discountedPercent));
    case ProductSortOption.name:
      list.sort((a, b) => a.name.compareTo(b.name));
    case ProductSortOption.brand:
      list.sort((a, b) => a.brandName.compareTo(b.brandName));
    case ProductSortOption.defaultOrder:
      break;
  }
  return list;
}

int _compareCreatedAt(Product a, Product b) {
  final aDate = a.createdAt;
  final bDate = b.createdAt;
  if (aDate == null && bDate == null) return a.id.compareTo(b.id);
  if (aDate == null) return 1;
  if (bDate == null) return -1;
  final byDate = aDate.compareTo(bDate);
  if (byDate != 0) return byDate;
  return a.id.compareTo(b.id);
}

List<String> extractBrands(List<Product> products) {
  final brands = products.map((p) => p.brandName).where((b) => b.isNotEmpty).toSet().toList();
  brands.sort();
  return brands;
}
