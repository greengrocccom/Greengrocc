class DarkStore {
  const DarkStore({
    required this.id,
    required this.storeName,
    required this.area,
    required this.city,
    required this.pincode,
    this.isServing = true,
    this.phone = '',
    this.address = '',
    this.latitude,
    this.longitude,
    this.distanceKm,
  });

  final String id;
  final String storeName;
  final String area;
  final String city;
  final String pincode;
  final bool isServing;
  final String phone;
  final String address;
  final double? latitude;
  final double? longitude;
  final double? distanceKm;

  factory DarkStore.fromJson(Map<String, dynamic> json) {
    return DarkStore(
      id: (json['_id'] ?? json['id'])?.toString() ?? '',
      storeName: json['storeName']?.toString() ?? json['name']?.toString() ?? '',
      area: json['area']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      pincode: json['pincode']?.toString() ?? '',
      isServing: json['isServing'] as bool? ?? true,
      phone: json['phone']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      latitude: _toDouble(json['latitude']),
      longitude: _toDouble(json['longitude']),
      distanceKm: _toDouble(json['distanceKm']),
    );
  }

  Map<String, dynamic> toJson() => {
        '_id': id,
        'storeName': storeName,
        'area': area,
        'city': city,
        'pincode': pincode,
        'isServing': isServing,
        'phone': phone,
        'address': address,
        'latitude': latitude,
        'longitude': longitude,
        'distanceKm': distanceKm,
      };
}

double? _toDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '');
}

class NearestStoreResult {
  const NearestStoreResult({
    this.needsLocation = false,
    this.store,
    this.inStockCount = 0,
    this.reason,
  });

  final bool needsLocation;
  final DarkStore? store;
  final int inStockCount;
  final String? reason;

  factory NearestStoreResult.fromJson(Map<String, dynamic> json) {
    final storeJson = json['store'];
    return NearestStoreResult(
      needsLocation: json['needsLocation'] as bool? ?? false,
      store: storeJson is Map<String, dynamic> ? DarkStore.fromJson(storeJson) : null,
      inStockCount: int.tryParse(json['inStockCount']?.toString() ?? '') ?? 0,
      reason: json['reason']?.toString(),
    );
  }
}
