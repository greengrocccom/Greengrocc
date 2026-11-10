import 'package:flutter/foundation.dart';
import '../models/market_price_item.dart';
import 'api_service.dart';

class MarketPriceService extends ChangeNotifier {
  static final MarketPriceService _instance = MarketPriceService._internal();
  factory MarketPriceService() => _instance;
  MarketPriceService._internal() {
    fetchMarketPrices();
  }

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _hasLoaded = false;
  bool get hasLoaded => _hasLoaded;

  String _lastError = '';
  String get lastError => _lastError;

  List<MarketPriceItem> _items = [];
  List<MarketPriceItem> get items => _items;

  static String _dayOf(String raw) => raw.length >= 10 ? raw.substring(0, 10) : raw;

  List<String> get availableDates {
    final set = <String>{};
    for (final item in _items) {
      if (item.isActive && item.priceDate.isNotEmpty) {
        set.add(_dayOf(item.priceDate));
      }
    }
    final list = set.toList();
    list.sort((a, b) => b.compareTo(a)); // newest first
    return list;
  }

  String? get latestDate {
    final dates = availableDates;
    return dates.isEmpty ? null : dates.first;
  }

  Future<void>? _inFlight;
  String? _inFlightDate;

  /// Callers asking for the same prices while a request is running share that request.
  Future<void> fetchMarketPrices({String? date}) {
    final key = date ?? '';
    final running = _inFlight;
    if (running != null && _inFlightDate == key) return running;
    _inFlightDate = key;
    late final Future<void> request;
    request = _loadMarketPrices(date).whenComplete(() {
      if (identical(_inFlight, request)) _inFlight = null;
    });
    return _inFlight = request;
  }

  Future<void> _loadMarketPrices(String? date) async {
    _isLoading = true;
    notifyListeners();

    try {
      final uri = (date != null && date.isNotEmpty && date != 'all')
          ? '/api/admin-ops/market-prices/live?date=$date'
          : '/api/admin-ops/market-prices/live';

      final res = await ApiService().get(
        uri,
        timeout: const Duration(seconds: 12),
      );

      if (res != null && res is Map && res['data'] is List) {
        final List list = res['data'];
        final loaded = <MarketPriceItem>[];
        for (final item in list) {
          if (item is! Map) continue;
          try {
            loaded.add(MarketPriceItem.fromJson(Map<String, dynamic>.from(item)));
          } catch (_) {}
        }

        if (date != null && date.isNotEmpty && date != 'all') {
          final dateStr = _dayOf(date);
          final retained = _items.where((i) => !i.priceDate.startsWith(dateStr)).toList();
          _items = [...retained, ...loaded];
        } else {
          _items = loaded;
        }
        _lastError = '';
        _hasLoaded = true;
      } else {
        _lastError = 'Invalid market price response';
      }
    } catch (e) {
      _lastError = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void handleSocketPriceUpdate(Map<String, dynamic> raw) {
    try {
      final item = MarketPriceItem.fromJson(raw);
      if (item.id.isEmpty) {
        fetchMarketPrices();
        return;
      }
      final idx = _items.indexWhere((i) => i.id == item.id);
      if (!item.isActive) {
        if (idx >= 0) _items.removeAt(idx);
      } else if (idx >= 0) {
        _items[idx] = item;
      } else {
        _items.insert(0, item);
      }
      notifyListeners();
    } catch (_) {
      fetchMarketPrices();
    }
  }

  /// Multiplier that converts a price per [unit] into a price per Quintal, or null for non-weight units.
  static double? _perQuintalFactor(String unit) {
    final u = unit.trim().toLowerCase();
    if (u.isEmpty || u == 'quintal' || u == 'qtl' || u == 'क्विंटल') return 1;
    if (u == 'kg' || u == 'kgs' || u == 'किलो') return 100;
    if (u == 'ton' || u == 'tonne' || u == 'टन') return 0.1;
    return null;
  }

  void handleSocketPriceDelete(String id) {
    _items.removeWhere((i) => i.id == id);
    notifyListeners();
  }

  static String _normalizeProductName(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('tomato') || lower.contains('टोमॅटो')) return 'Tomato (टोमॅटो)';
    if (lower.contains('onion') || lower.contains('कांदा')) return 'Onion (कांदा)';
    if (lower.contains('potato') || lower.contains('बटाटा')) return 'Potato (बटाटा)';
    if (lower.contains('chilli') || lower.contains('मिरची')) return 'Green Chilli (हिरवी मिरची)';
    if (lower.contains('pomegranate') || lower.contains('डाळिंब')) return 'Pomegranate (डाळिंब)';
    if (lower.contains('turmeric') || lower.contains('हळद')) return 'Turmeric (हळद)';
    if (lower.contains('soybean') || lower.contains('सोयाबीन')) return 'Soybean (सोयाबीन)';
    if (lower.contains('ginger') || lower.contains('आले')) return 'Ginger (आले)';
    if (lower.contains('garlic') || lower.contains('लसूण')) return 'Garlic (लसूण)';
    if (lower.contains('wheat') || lower.contains('गहू')) return 'Wheat (गहू)';
    if (lower.contains('coriander') || lower.contains('कोथिंबीर')) return 'Coriander (कोथिंबीर)';
    if (lower.contains('fenugreek') || lower.contains('मेथी')) return 'Fenugreek (मेथी)';
    if (lower.contains('cauliflower') || lower.contains('फ्लॉवर')) return 'Cauliflower (फ्लॉवर)';
    if (lower.contains('cabbage') || lower.contains('कोबी')) return 'Cabbage (कोबी)';
    return name;
  }

  static String _getEmojiForProduct(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('tomato') || lower.contains('टोमॅटो')) return '🍅';
    if (lower.contains('onion') || lower.contains('कांदा')) return '🧅';
    if (lower.contains('potato') || lower.contains('बटाटा')) return '🥔';
    if (lower.contains('chilli') || lower.contains('मिरची')) return '🌶️';
    if (lower.contains('pomegranate') || lower.contains('डाळिंब')) return '🍇';
    if (lower.contains('turmeric') || lower.contains('हळद')) return '🟡';
    if (lower.contains('soybean') || lower.contains('सोयाबीन')) return '🌱';
    if (lower.contains('ginger') || lower.contains('आले')) return '🫚';
    if (lower.contains('garlic') || lower.contains('लसूण')) return '🧄';
    if (lower.contains('wheat') || lower.contains('गहू')) return '🌾';
    if (lower.contains('coriander') || lower.contains('कोथिंबीर')) return '🌿';
    if (lower.contains('fenugreek') || lower.contains('मेथी')) return '🌱';
    if (lower.contains('cauliflower') || lower.contains('फ्लॉवर')) return '🥦';
    if (lower.contains('cabbage') || lower.contains('कोबी')) return '🥬';
    return '🌾';
  }

  /// Compares the latest price of each market for the same product.
  /// With [date] only that day's rates are used; without it each market's newest rate is used.
  List<ProductMarketComparison> getComparisons({String? date}) {
    final Map<String, List<MarketPriceItem>> grouped = {};
    final Map<String, String> groupUnit = {};
    final Map<String, String> groupName = {};

    final sourceItems = (date != null && date.isNotEmpty && date != 'all')
        ? _items.where((i) => i.priceDate.startsWith(date)).toList()
        : _items;

    for (final item in sourceItems) {
      if (!item.isActive || item.price <= 0) continue;
      final name = _normalizeProductName(item.productName);
      final factor = _perQuintalFactor(item.unit);
      final unit = factor != null ? 'Quintal' : item.unit;
      final key = factor != null ? name : '$name|${item.unit.toLowerCase()}';
      grouped.putIfAbsent(key, () => []).add(item);
      groupUnit[key] = unit;
      groupName[key] = name;
    }

    final List<ProductMarketComparison> comparisons = [];

    grouped.forEach((groupKey, productItems) {
      if (productItems.isEmpty) return;
      final productKey = groupName[groupKey] ?? groupKey;
      final displayUnit = groupUnit[groupKey] ?? 'Quintal';

      // One quote per market: the newest date wins; the API already lists newest updates first.
      final Map<String, MarketPriceItem> marketMap = {};
      for (final p in productItems) {
        final marketKey = p.marketName.trim().toLowerCase();
        final existing = marketMap[marketKey];
        if (existing == null || _dayOf(p.priceDate).compareTo(_dayOf(existing.priceDate)) > 0) {
          marketMap[marketKey] = p;
        }
      }

      double norm(MarketPriceItem m, double value) => value * (_perQuintalFactor(m.unit) ?? 1);

      final uniqueItems = marketMap.values.toList();
      uniqueItems.sort((a, b) => norm(b, b.price).compareTo(norm(a, a.price))); // highest first

      final prices = uniqueItems.map((e) => norm(e, e.price)).toList();
      final minPrice = prices.reduce((a, b) => a < b ? a : b);
      final maxPrice = prices.first;
      final bestMarket = uniqueItems.first.marketName;
      final avgPrice = prices.fold<double>(0.0, (acc, p) => acc + p) / prices.length;
      final bestAdvantage = uniqueItems.length > 1 && minPrice > 0 ? ((maxPrice - minPrice) / minPrice * 100) : 0.0;

      MarketRateComparison? ggComp;
      final List<MarketRateComparison> rates = uniqueItems.map((m) {
        final price = norm(m, m.price);
        final pctHigher = minPrice > 0 ? ((price - minPrice) / minPrice * 100) : 0.0;
        final c = MarketRateComparison(
          marketName: m.marketName,
          district: m.district,
          price: price,
          minPrice: m.minPrice > 0 ? norm(m, m.minPrice) : price,
          maxPrice: m.maxPrice > 0 ? norm(m, m.maxPrice) : price,
          unit: displayUnit,
          trend: m.trend,
          percentHigher: pctHigher,
          isBest: price >= maxPrice && maxPrice > minPrice,
          arrivalQuantity: m.arrivalQuantity,
          isGreenGroo: m.isGreenGroo,
        );
        if (m.isGreenGroo && (ggComp == null || price > ggComp!.price)) {
          ggComp = c;
        }
        return c;
      }).toList();

      final nonGgPrices = uniqueItems.where((x) => !x.isGreenGroo).map((x) => norm(x, x.price)).toList();
      double ggVsAvgPercent = 0.0;
      double ggDiffAmount = 0.0;
      if (ggComp != null && nonGgPrices.isNotEmpty) {
        final nonGgAvg = nonGgPrices.fold<double>(0.0, (acc, p) => acc + p) / nonGgPrices.length;
        if (nonGgAvg > 0) {
          ggDiffAmount = ggComp!.price - nonGgAvg;
          ggVsAvgPercent = (ggDiffAmount / nonGgAvg) * 100;
        }
      }

      comparisons.add(
        ProductMarketComparison(
          productName: productKey,
          cleanProductName: productKey.replaceAll(RegExp(r'\s*\([^)]*\)'), '').trim(),
          emoji: _getEmojiForProduct(productKey),
          unit: displayUnit,
          minPrice: minPrice,
          maxPrice: maxPrice,
          avgPrice: avgPrice,
          bestMarketName: bestMarket,
          bestAdvantagePercent: bestAdvantage,
          markets: rates,
          greenGroccRate: ggComp,
          greenGroccVsAvgPercent: ggVsAvgPercent,
          greenGroccDiffAmount: ggDiffAmount,
        ),
      );
    });

    // Sort by best advantage percent desc
    comparisons.sort((a, b) => b.bestAdvantagePercent.compareTo(a.bestAdvantagePercent));
    return comparisons;
  }
}
