import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/address.dart';
import '../../models/dark_store.dart';
import 'app_providers.dart';

class DeliveryLocation {
  const DeliveryLocation({
    this.latitude,
    this.longitude,
    this.state,
    this.city,
    this.area,
    this.pincode,
    this.address,
    this.label,
    this.addressId,
  });

  /// Location taken from one of the customer's saved addresses; checkout
  /// delivers to that same address.
  factory DeliveryLocation.fromAddress(Address addr) {
    final location = addr.location;
    return DeliveryLocation(
      latitude: _coord(location, const ['lat', 'latitude']),
      longitude: _coord(location, const ['lng', 'longitude']),
      pincode: addr.pincode,
      city: addr.city,
      state: addr.state,
      area: addr.area.isNotEmpty ? addr.area : addr.fullAddress,
      address: '${addr.shopNo} ${addr.shopName}, ${addr.fullAddress}, ${addr.city}, ${addr.state} - ${addr.pincode}',
      label: '${addr.shopName.isNotEmpty ? addr.shopName : addr.fullAddress}, ${addr.city}',
      addressId: addr.id,
    );
  }

  final double? latitude;
  final double? longitude;
  final String? state;
  final String? city;
  final String? area;
  final String? pincode;
  final String? address;
  final String? label;
  /// Saved address this location was picked from, if any.
  final String? addressId;

  bool get hasLocation =>
      (latitude != null && longitude != null) ||
      (pincode != null && pincode!.isNotEmpty) ||
      (city != null && city!.isNotEmpty);

  String get displayAddress {
    if (address != null && address!.isNotEmpty) return address!;
    final parts = <String>[];
    if (area != null && area!.isNotEmpty) parts.add(area!);
    if (city != null && city!.isNotEmpty) parts.add(city!);
    if (pincode != null && pincode!.isNotEmpty) parts.add(pincode!);
    if (parts.isNotEmpty) return parts.join(', ');
    return label ?? 'Select location to see nearby stock';
  }

  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{};
    if (latitude != null) params['lat'] = latitude;
    if (longitude != null) params['lng'] = longitude;
    if (city != null && city!.isNotEmpty) params['city'] = city;
    if (area != null && area!.isNotEmpty) params['area'] = area;
    if (pincode != null && pincode!.isNotEmpty) params['pincode'] = pincode;
    if (address != null && address!.isNotEmpty) params['address'] = address;
    return params;
  }

  String get locationKey {
    return [
      latitude?.toString() ?? '',
      longitude?.toString() ?? '',
      city ?? '',
      area ?? '',
      pincode ?? '',
    ].where((e) => e.isNotEmpty).join('|');
  }

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'city': city,
        'state': state,
        'area': area,
        'pincode': pincode,
        'address': address,
        'label': label,
        'addressId': addressId,
      };

  factory DeliveryLocation.fromJson(Map<String, dynamic> json) {
    return DeliveryLocation(
      latitude: (json['latitude'] ?? json['lat']) != null
          ? double.tryParse((json['latitude'] ?? json['lat']).toString())
          : null,
      longitude: (json['longitude'] ?? json['lng']) != null
          ? double.tryParse((json['longitude'] ?? json['lng']).toString())
          : null,
      city: json['city']?.toString(),
      state: json['state']?.toString(),
      area: json['area']?.toString(),
      pincode: json['pincode']?.toString(),
      address: json['address']?.toString(),
      label: json['label']?.toString(),
      addressId: json['addressId']?.toString(),
    );
  }
}

/// Whether [addr] is the place [location] points at (same saved address, or
/// the same spot for locations saved before addresses were linked).
bool addressMatchesLocation(Address addr, DeliveryLocation? location) {
  if (location == null) return false;
  final id = location.addressId;
  if (id != null && id.isNotEmpty) return id == addr.id;
  final lat = _coord(addr.location, const ['lat', 'latitude']);
  final lng = _coord(addr.location, const ['lng', 'longitude']);
  if (location.latitude != null && location.longitude != null && lat != null && lng != null) {
    return (location.latitude! - lat).abs() < 0.0008 && (location.longitude! - lng).abs() < 0.0008;
  }
  final text = location.address ?? '';
  return text.isNotEmpty && addr.fullAddress.isNotEmpty && text.contains(addr.fullAddress);
}

/// The saved address checkout should deliver to for [location].
Address? addressForLocation(List<Address> addresses, DeliveryLocation? location) {
  for (final addr in addresses) {
    if (addressMatchesLocation(addr, location)) return addr;
  }
  return null;
}

const _storageKey = 'greengrocc_delivery_location';

class LocationNotifier extends Notifier<DeliveryLocation?> {
  late Future<void> _restored;

  /// Completes once the saved location (if any) has been read from storage.
  Future<void> get restored => _restored;

  @override
  DeliveryLocation? build() {
    _restored = _loadFromStorage();
    return null;
  }

  Future<void> _loadFromStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty && state == null) {
        state = DeliveryLocation.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {}
  }

  Future<void> setLocation(DeliveryLocation location) async {
    state = location;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, jsonEncode(location.toJson()));
    } catch (_) {}
  }

  Future<void> clearLocation() async {
    state = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_storageKey);
    } catch (_) {}
  }
}

final deliveryLocationProvider =
    NotifierProvider<LocationNotifier, DeliveryLocation?>(LocationNotifier.new);

/// Changes whenever the delivery location changes. Store-scoped providers
/// (categories, products) watch it so they refetch for the new dark store.
final deliveryLocationKeyProvider = Provider<String>(
  (ref) => ref.watch(deliveryLocationProvider)?.locationKey ?? '',
);

final nearestStoreProvider = FutureProvider<NearestStoreResult>((ref) async {
  final location = ref.watch(deliveryLocationProvider);
  final api = ref.watch(apiServiceProvider);
  return api.fetchNearestStore(location?.toQueryParams());
});

/// Lookup key for [checkoutStoreProvider]. A record of primitives, so equal
/// queries share one request.
typedef CheckoutStoreQuery = ({
  String section,
  String fulfillment,
  double? lat,
  double? lng,
  String city,
  String area,
  String pincode,
  String address,
});

double? _coord(Map<String, dynamic>? location, List<String> keys) {
  if (location == null) return null;
  for (final key in keys) {
    final value = double.tryParse(location[key]?.toString() ?? '');
    if (value != null) return value;
  }
  return null;
}

/// Store lookup for the customer's chosen address (falls back to the header
/// location when no address is saved yet).
CheckoutStoreQuery checkoutStoreQuery({
  required bool hasNowItems,
  required String fulfillment,
  Address? address,
}) {
  final text = address == null
      ? ''
      : [address.shopNo, address.fullAddress, address.landmark, address.area, address.city, address.state, address.pincode]
          .where((part) => part.trim().isNotEmpty)
          .join(', ');
  return (
    section: hasNowItems ? 'instantorder' : 'preorder',
    fulfillment: fulfillment,
    lat: _coord(address?.location, const ['lat', 'latitude']),
    lng: _coord(address?.location, const ['lng', 'longitude']),
    city: address?.city ?? '',
    area: address?.area ?? '',
    pincode: address?.pincode ?? '',
    address: text,
  );
}

/// Dark store that will fulfil the cart: a pure pre-order cart may use a same-pincode
/// store, Ready2Cook / Instant need one within 3 km, and store pickup takes the nearest.
final checkoutStoreProvider =
    FutureProvider.family<NearestStoreResult, CheckoutStoreQuery>((ref, query) async {
  final api = ref.watch(apiServiceProvider);
  final hasAddress = query.address.isNotEmpty || query.lat != null;
  final params = hasAddress
      ? <String, dynamic>{
          if (query.lat != null) 'lat': query.lat,
          if (query.lng != null) 'lng': query.lng,
          if (query.city.isNotEmpty) 'city': query.city,
          if (query.area.isNotEmpty) 'area': query.area,
          if (query.pincode.isNotEmpty) 'pincode': query.pincode,
          if (query.address.isNotEmpty) 'address': query.address,
        }
      : {...?ref.watch(deliveryLocationProvider)?.toQueryParams()};
  return api.fetchNearestStore({
    ...params,
    'section': query.section,
    'fulfillment': query.fulfillment,
  });
});
