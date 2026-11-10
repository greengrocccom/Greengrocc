class MarketPriceItem {
  final String id;
  final String marketName;
  final String productName;
  final String variety;
  final double price;
  final double minPrice;
  final double maxPrice;
  final String unit;
  final String priceDate;
  final String district;
  final String state;
  final String trend; // 'up', 'stable', 'down'
  final double arrivalQuantity;
  final String arrivalUnit;
  final String notes;
  final bool isActive;
  final bool isGreenGroo;

  const MarketPriceItem({
    required this.id,
    required this.marketName,
    required this.productName,
    required this.variety,
    required this.price,
    required this.minPrice,
    required this.maxPrice,
    this.unit = 'Quintal',
    required this.priceDate,
    this.district = 'Pune',
    this.state = 'Maharashtra',
    this.trend = 'stable',
    this.arrivalQuantity = 0,
    this.arrivalUnit = 'Quintal',
    this.notes = '',
    this.isActive = true,
    this.isGreenGroo = false,
  });

  factory MarketPriceItem.fromJson(Map<String, dynamic> json) {
    final mName = json['marketName']?.toString() ?? '';
    final isGg = json['isGreenGroo'] == true ||
        mName.toLowerCase().contains('greengro') ||
        mName.contains('ग्रीनग्र');

    return MarketPriceItem(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      marketName: mName,
      productName: json['productName']?.toString() ?? '',
      variety: json['variety']?.toString() ?? 'Standard',
      price: (json['price'] is num) ? (json['price'] as num).toDouble() : double.tryParse(json['price']?.toString() ?? '0') ?? 0.0,
      minPrice: (json['minPrice'] is num) ? (json['minPrice'] as num).toDouble() : double.tryParse(json['minPrice']?.toString() ?? '0') ?? 0.0,
      maxPrice: (json['maxPrice'] is num) ? (json['maxPrice'] as num).toDouble() : double.tryParse(json['maxPrice']?.toString() ?? '0') ?? 0.0,
      unit: json['unit']?.toString() ?? 'Quintal',
      priceDate: json['priceDate']?.toString() ?? '',
      district: json['district']?.toString() ?? '',
      state: json['state']?.toString() ?? 'Maharashtra',
      trend: json['trend']?.toString() ?? 'stable',
      arrivalQuantity: (json['arrivalQuantity'] is num) ? (json['arrivalQuantity'] as num).toDouble() : double.tryParse(json['arrivalQuantity']?.toString() ?? '0') ?? 0.0,
      arrivalUnit: json['arrivalUnit']?.toString() ?? 'Quintal',
      notes: json['notes']?.toString() ?? '',
      isActive: json['isActive'] != false,
      isGreenGroo: isGg,
    );
  }
}

class MarketRateComparison {
  final String marketName;
  final String district;
  final double price;
  final double minPrice;
  final double maxPrice;
  final String unit;
  final String trend;
  final double percentHigher;
  final bool isBest;
  final double arrivalQuantity;
  final bool isGreenGroo;

  const MarketRateComparison({
    required this.marketName,
    required this.district,
    required this.price,
    required this.minPrice,
    required this.maxPrice,
    required this.unit,
    required this.trend,
    required this.percentHigher,
    required this.isBest,
    this.arrivalQuantity = 0,
    this.isGreenGroo = false,
  });
}

class ProductMarketComparison {
  final String productName;
  final String cleanProductName;
  final String emoji;
  final String unit;
  final double minPrice;
  final double maxPrice;
  final double avgPrice;
  final String bestMarketName;
  final double bestAdvantagePercent;
  final List<MarketRateComparison> markets;
  final MarketRateComparison? greenGroccRate;
  final double greenGroccVsAvgPercent; // positive if GreenGrocc is higher, negative if lower
  final double greenGroccDiffAmount;

  const ProductMarketComparison({
    required this.productName,
    required this.cleanProductName,
    required this.emoji,
    required this.unit,
    required this.minPrice,
    required this.maxPrice,
    required this.avgPrice,
    required this.bestMarketName,
    required this.bestAdvantagePercent,
    required this.markets,
    this.greenGroccRate,
    this.greenGroccVsAvgPercent = 0.0,
    this.greenGroccDiffAmount = 0.0,
  });

  bool get hasGreenGrocc => greenGroccRate != null;
}
