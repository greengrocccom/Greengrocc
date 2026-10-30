import 'product.dart';
import 'product_pricing_models.dart';
import '../core/utils/department_utils.dart';
import '../core/utils/json_parsers.dart';
import '../core/utils/product_pricing.dart';

class CartItem {
  const CartItem({
    required this.id,
    required this.name,
    required this.brandName,
    required this.price,
    required this.discountedPrice,
    required this.productImages,
    required this.stock,
    required this.quantity,
    this.variantName = '',
    this.colorName = '',
    this.pricingType = 'single',
    this.bulkPricing = const BulkPricing(),
    this.variantType = 'single',
    this.variants = const [],
    this.minOrderQuantity,
    this.stepByQuantity,
    this.section = '',
    this.storeType = '',
  });

  final String id;
  final String name;
  final String brandName;
  final double price;
  final double discountedPrice;
  final List<String> productImages;
  final int stock;
  final int quantity;
  final String variantName;
  final String colorName;
  final String pricingType;
  final BulkPricing bulkPricing;
  final String variantType;
  final List<ProductVariant> variants;
  final int? minOrderQuantity;
  final int? stepByQuantity;
  final String section;
  final String storeType;

  double get unitPrice => discountedPrice > 0 ? discountedPrice : price;
  double get lineTotal => unitPrice * quantity;

  /// preorder | ready2cook | instant
  String get department => departmentForSection(section, storeType);

  int get quantityStep => getCartStepForCartItem(this);

  CartItem copyWith({
    int? quantity,
    double? price,
    double? discountedPrice,
    int? stock,
  }) {
    return CartItem(
      id: id,
      name: name,
      brandName: brandName,
      price: price ?? this.price,
      discountedPrice: discountedPrice ?? this.discountedPrice,
      productImages: productImages,
      stock: stock ?? this.stock,
      quantity: quantity ?? this.quantity,
      variantName: variantName,
      colorName: colorName,
      pricingType: pricingType,
      bulkPricing: bulkPricing,
      variantType: variantType,
      variants: variants,
      minOrderQuantity: minOrderQuantity,
      stepByQuantity: stepByQuantity,
      section: section,
      storeType: storeType,
    );
  }

  factory CartItem.fromProduct(
    Product product, {
    required int quantity,
    String variantName = '',
    String colorName = '',
    String? section,
    String? storeType,
  }) {
    double price = product.price;
    double discountedPrice =
        product.discountedPrice > 0 ? product.discountedPrice : product.price;
    int stock = product.stock;

    final trimmedVariant = variantName.trim();
    if (trimmedVariant.isNotEmpty) {
      final target = trimmedVariant.toLowerCase();
      ProductVariant? matching;
      for (final v in product.variants) {
        if (v.name.trim().toLowerCase() == target) {
          matching = v;
          break;
        }
      }
      if (matching != null) {
        if (matching.price > 0) {
          price = matching.price;
        }
        if (matching.discountedPrice > 0) {
          discountedPrice = matching.discountedPrice;
        } else if (matching.price > 0) {
          discountedPrice = matching.price;
        }
        if (matching.stock > 0) {
          stock = matching.stock;
        }
      }
    }

    final effectiveSection = (section != null && section.isNotEmpty)
        ? section
        : product.section;
    final effectiveStoreType = (storeType != null && storeType.isNotEmpty)
        ? storeType
        : product.storeType;

    return CartItem(
      id: product.id,
      name: product.name,
      brandName: product.brandName,
      price: price,
      discountedPrice: discountedPrice,
      productImages: product.productImages,
      stock: stock,
      quantity: quantity,
      variantName: trimmedVariant,
      colorName: colorName.trim(),
      pricingType: product.pricingType,
      bulkPricing: product.bulkPricing,
      variantType: product.variantType,
      variants: product.variants,
      minOrderQuantity: product.minOrderQuantity,
      stepByQuantity: product.stepByQuantity,
      section: effectiveSection,
      storeType: effectiveStoreType,
    );
  }

  factory CartItem.fromApiItem(Map<String, dynamic> json) {
    final product = json['product'];
    if (product is! Map<String, dynamic>) {
      throw const FormatException('Cart item missing product');
    }

    final legacyBulk = product['bulkPricing'];
    final variantName = json['variantName']?.toString().trim() ?? '';
    final colorName = json['colorName']?.toString().trim() ?? '';

    final parsedVariants = (product['variants'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(ProductVariant.fromJson)
        .toList();

    double basePrice = _toDouble(product['price']);
    double baseDiscounted = _toDouble(product['discountedPrice']);
    if (baseDiscounted <= 0) baseDiscounted = basePrice;
    int stock = _toInt(product['stock']);

    if (variantName.isNotEmpty) {
      final target = variantName.toLowerCase();
      ProductVariant? matching;
      for (final v in parsedVariants) {
        if (v.name.trim().toLowerCase() == target) {
          matching = v;
          break;
        }
      }
      if (matching != null) {
        if (matching.price > 0) basePrice = matching.price;
        if (matching.discountedPrice > 0) {
          baseDiscounted = matching.discountedPrice;
        } else if (matching.price > 0) {
          baseDiscounted = matching.price;
        }
        if (matching.stock > 0) stock = matching.stock;
      }
    }

    if (json['price'] != null && _toDouble(json['price']) > 0) {
      basePrice = _toDouble(json['price']);
    }
    if (json['discountedPrice'] != null &&
        _toDouble(json['discountedPrice']) > 0) {
      baseDiscounted = _toDouble(json['discountedPrice']);
    }

    return CartItem(
      id: parseJsonId(product),
      name: product['name']?.toString() ?? '',
      brandName: product['brandName']?.toString() ?? '',
      price: basePrice,
      discountedPrice: baseDiscounted,
      productImages: (product['productImages'] as List<dynamic>? ?? [])
          .map((item) => item.toString())
          .toList(),
      stock: stock,
      quantity: _toInt(json['quantity']),
      variantName: variantName,
      colorName: colorName,
      pricingType: product['pricingType']?.toString() ?? 'single',
      bulkPricing: BulkPricing.fromJson(legacyBulk),
      variantType: product['variantType']?.toString() ?? 'single',
      variants: parsedVariants,
      minOrderQuantity: _parseOptionalQuantity(
        product['minOrderQuantity'],
        legacyBulk is Map<String, dynamic>
            ? legacyBulk['minOrderQuantity']
            : null,
      ),
      stepByQuantity: _parseOptionalQuantity(
        product['stepByQuantity'],
        legacyBulk is Map<String, dynamic>
            ? legacyBulk['stepByQuantity']
            : null,
      ),
      section: product['section']?.toString() ?? '',
      storeType: product['storeType']?.toString() ?? '',
    );
  }
}

Product _productFromCartItem(CartItem item) {
  return Product(
    id: item.id,
    name: item.name,
    categories: const [],
    subcategory: '',
    brandName: item.brandName,
    price: item.price,
    discountedPrice: item.discountedPrice,
    discountedPercent: 0,
    stock: item.stock,
    productImages: item.productImages,
    pricingType: item.pricingType,
    bulkPricing: item.bulkPricing,
    variantType: item.variantType,
    variants: item.variants,
    minOrderQuantity: item.minOrderQuantity,
    stepByQuantity: item.stepByQuantity,
    section: item.section,
    storeType: item.storeType,
  );
}

int getCartStepForCartItem(CartItem item) {
  return getCartAdjustStep(_productFromCartItem(item), item.variantName);
}

int getDecreasedCartQuantityForCartItem(CartItem item) {
  return getDecreasedCartQuantityForProduct(
    _productFromCartItem(item),
    item.quantity,
    item.variantName,
  );
}

double _toDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

int _toInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

int? _parseOptionalQuantity(dynamic primary, dynamic legacy) {
  final value = primary ?? legacy;
  if (value == null) return null;
  final parsed = _toInt(value);
  return parsed > 0 ? parsed : null;
}
