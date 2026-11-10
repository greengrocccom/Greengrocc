import 'dart:async';
import 'dart:convert';

import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

import './app_language.dart';
import 'location_directory.dart';
/// A chosen farm location with geocoded address details.
class FarmGeoLocation {
  final double latitude;
  final double longitude;
  final String village;
  final String taluka;
  final String district;
  final String state;
  final String pincode;
  final String formattedAddress;

  const FarmGeoLocation({
    required this.latitude,
    required this.longitude,
    this.village = '',
    this.taluka = '',
    this.district = '',
    this.state = 'Maharashtra',
    this.pincode = '',
    this.formattedAddress = '',
  });

  bool get hasAddress => village.isNotEmpty || district.isNotEmpty || formattedAddress.isNotEmpty;

  String get shortLabel {
    final parts = [village, taluka, district].where((s) => s.isNotEmpty).toList();
    if (parts.isNotEmpty) return parts.join(', ');
    return '${latitude.toStringAsFixed(5)}°, ${longitude.toStringAsFixed(5)}°';
  }

  FarmGeoLocation copyWith({
    double? latitude,
    double? longitude,
    String? village,
    String? taluka,
    String? district,
    String? state,
    String? pincode,
    String? formattedAddress,
  }) =>
      FarmGeoLocation(
        latitude: latitude ?? this.latitude,
        longitude: longitude ?? this.longitude,
        village: village ?? this.village,
        taluka: taluka ?? this.taluka,
        district: district ?? this.district,
        state: state ?? this.state,
        pincode: pincode ?? this.pincode,
        formattedAddress: formattedAddress ?? this.formattedAddress,
      );

  FarmGeoLocation withCoordinates(double lat, double lng) => copyWith(latitude: lat, longitude: lng);
}

enum LocationFailureKind { serviceDisabled, denied, deniedForever, timeout, unknown }

class LocationFailure implements Exception {
  final LocationFailureKind kind;
  final String message;
  const LocationFailure(this.kind, this.message);

  bool get canOpenSettings =>
      kind == LocationFailureKind.serviceDisabled || kind == LocationFailureKind.deniedForever;

  Future<void> openSettings() async {
    if (kind == LocationFailureKind.serviceDisabled) {
      await Geolocator.openLocationSettings();
    } else {
      await Geolocator.openAppSettings();
    }
  }

  @override
  String toString() => message;
}

class FarmLocationService {
  FarmLocationService._();

  /// Nominatim's usage policy requires an identifying User-Agent and at most ~1 request/second,
  /// so callers debounce reverse lookups while the map is moving.
  static const String _userAgent = 'GreenGroccFarmerApp/1.0 (com.greengroo.farmerapp; info@greengrocc.com)';
  static const String _nominatim = 'https://nominatim.openstreetmap.org';

  /// Current device position, asking for permission when needed.
  static Future<Position> currentPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw LocationFailure(
        LocationFailureKind.serviceDisabled,
        AppLanguage().tr(mr: 'फोनचे लोकेशन (GPS) बंद आहे. कृपया चालू करा.', en: 'Location is turned off. Please turn on GPS.'),
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw LocationFailure(
        LocationFailureKind.denied,
        AppLanguage().tr(mr: 'लोकेशन परवानगी नाकारली. पुन्हा प्रयत्न करा.', en: 'Location permission denied. Please try again.'),
      );
    }
    if (permission == LocationPermission.deniedForever) {
      throw LocationFailure(
        LocationFailureKind.deniedForever,
        AppLanguage().tr(mr: 'लोकेशन परवानगी बंद आहे. सेटिंग्जमध्ये जाऊन परवानगी द्या.', en: 'Location permission is blocked. Allow it in Settings.'),
      );
    }

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          timeLimit: Duration(seconds: 20),
        ),
      );
    } on TimeoutException {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) return last;
      throw LocationFailure(
        LocationFailureKind.timeout,
        AppLanguage().tr(mr: 'GPS सिग्नल मिळाला नाही. मोकळ्या जागेत जाऊन पुन्हा प्रयत्न करा.', en: 'Could not get a GPS fix. Try again in the open.'),
      );
    } catch (e) {
      if (e is LocationFailure) rethrow;
      throw LocationFailure(LocationFailureKind.unknown, AppLanguage().tr(mr: 'लोकेशन मिळाले नाही: $e', en: 'Could not get location: $e'));
    }
  }

  static Future<FarmGeoLocation?> reverseGeocode(double lat, double lng) async {
    FarmGeoLocation? loc;

    // 1. Query ESRI World Geocoder first (has official Indian revenue village & locality boundaries)
    try {
      final esriUri = Uri.parse(
        'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=$lng,$lat&f=json',
      );
      final res = await http.get(esriUri, headers: const {'User-Agent': _userAgent}).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map<String, dynamic> && data['address'] != null) {
          loc = _fromEsri(data, lat, lng);
        }
      }
    } catch (_) {}

    // 2. Query Nominatim (OpenStreetMap) if ESRI returned no village or failed
    if (loc == null || loc.village.isEmpty) {
      try {
        final uri = Uri.parse(
          '$_nominatim/reverse?format=jsonv2&lat=$lat&lon=$lng&zoom=18&addressdetails=1&accept-language=en',
        );
        final res = await http.get(uri, headers: const {'User-Agent': _userAgent}).timeout(const Duration(seconds: 6));
        if (res.statusCode == 200) {
          final data = jsonDecode(res.body);
          if (data is Map<String, dynamic> && data['error'] == null) {
            final nomLoc = _fromNominatim(data, lat, lng);
            if (loc == null) {
              loc = nomLoc;
            } else {
              loc = loc.copyWith(
                village: nomLoc.village.isNotEmpty ? nomLoc.village : loc.village,
                taluka: loc.taluka.isNotEmpty ? loc.taluka : nomLoc.taluka,
                district: loc.district.isNotEmpty ? loc.district : nomLoc.district,
                pincode: loc.pincode.isNotEmpty ? loc.pincode : nomLoc.pincode,
                formattedAddress: loc.formattedAddress.isNotEmpty ? loc.formattedAddress : nomLoc.formattedAddress,
              );
            }
          }
        }
      } catch (_) {}
    }

    try {
      loc ??= FarmGeoLocation(latitude: lat, longitude: lng);

      // Filter out road names or highway numbers (e.g. MDR25, SH10)
      if (_isRoadOrHighway(loc.village)) {
        loc = loc.copyWith(village: '');
      }

      // Try to match or normalize the village against our official taluka directory
      if (loc.taluka.isNotEmpty && loc.village.isNotEmpty) {
        final match = await LocationDirectory.findMatchingVillage(loc.taluka, loc.village, districtName: loc.district);
        if (match != null) {
          loc = loc.copyWith(
            village: match.name,
            pincode: (loc.pincode.isEmpty || loc.pincode.length != 6) ? match.pincode : loc.pincode,
          );
        }
      }

      // If pincode is available but taluka or district is missing, enrich from directory
      final pin = loc.pincode.trim();
      if (pin.length == 6 && (loc.taluka.isEmpty || loc.district.isEmpty)) {
        final localData = await LocationDirectory.findLocationByPincode(pin);
        if (localData != null) {
          loc = loc.copyWith(
            taluka: loc.taluka.isNotEmpty ? loc.taluka : (localData['taluka'] ?? ''),
            district: loc.district.isNotEmpty ? loc.district : (localData['district'] ?? ''),
            state: loc.state.isNotEmpty ? loc.state : (localData['state'] ?? 'Maharashtra'),
          );
        }
      }

      // If formattedAddress starts with a highway code (e.g. "MDR25..."), clean it
      if (_isRoadOrHighway(loc.formattedAddress.split(',').firstOrNull ?? '')) {
        final cleanParts = [loc.village, loc.taluka, loc.district, 'Maharashtra, India']
            .where((s) => s.isNotEmpty && !_isRoadOrHighway(s))
            .toList();
        if (cleanParts.isNotEmpty) {
          loc = loc.copyWith(formattedAddress: cleanParts.join(', '));
        }
      }
    } catch (_) {}

    return loc ?? FarmGeoLocation(latitude: lat, longitude: lng);
  }

  static bool _isRoadOrHighway(String text) {
    final s = text.trim();
    if (s.isEmpty) return true;
    if (s.toLowerCase().contains('unnamed')) return true;
    // Highway / road codes: MDR25, MDR-25, SH10, NH60, ODR5, VR12, etc.
    if (RegExp(r'^(MDR|SH|NH|ODR|VR|RR|NE)\s*-?\s*\d+', caseSensitive: false).hasMatch(s)) return true;
    // Common road suffixes or keywords
    if (RegExp(r'\b(road|rd|highway|expressway|lane|street|marg|path|toll|bypass|flyover)\b', caseSensitive: false).hasMatch(s)) return true;
    // Digits only
    if (RegExp(r'^\d+$').hasMatch(s)) return true;
    return false;
  }

  static FarmGeoLocation? _fromEsri(Map<String, dynamic> data, double lat, double lng) {
    final addr = (data['address'] as Map?)?.cast<String, dynamic>();
    if (addr == null) return null;

    String clean(dynamic val) => (val?.toString() ?? '').trim();

    final rawTaluka = _stripSuffix(clean(addr['City']));
    final rawDistrict = _stripSuffix(clean(addr['Subregion']));
    final state = clean(addr['Region']);
    final postal = clean(addr['Postal']);
    final matchAddr = clean(addr['Match_addr']);

    // In ESRI India data:
    // 'District' or 'PlaceName' or 'Neighborhood' contains the rural revenue village
    // 'City' contains the Taluka/Tehsil
    // 'Subregion' contains the District
    String villageCandidate = '';
    final placeName = clean(addr['PlaceName']);
    final districtField = clean(addr['District']);
    final neighborhood = clean(addr['Neighborhood']);

    if (!_isRoadOrHighway(placeName) &&
        placeName.toLowerCase() != rawTaluka.toLowerCase() &&
        placeName.toLowerCase() != rawDistrict.toLowerCase()) {
      villageCandidate = placeName;
    } else if (!_isRoadOrHighway(districtField) &&
        districtField.toLowerCase() != rawTaluka.toLowerCase() &&
        districtField.toLowerCase() != rawDistrict.toLowerCase()) {
      villageCandidate = districtField;
    } else if (!_isRoadOrHighway(neighborhood) &&
        neighborhood.toLowerCase() != rawTaluka.toLowerCase() &&
        neighborhood.toLowerCase() != rawDistrict.toLowerCase()) {
      villageCandidate = neighborhood;
    }

    if (villageCandidate.isEmpty && rawTaluka.isEmpty && rawDistrict.isEmpty) {
      return null;
    }

    return FarmGeoLocation(
      latitude: lat,
      longitude: lng,
      village: villageCandidate,
      taluka: rawTaluka,
      district: rawDistrict,
      state: state.isNotEmpty ? state : 'Maharashtra',
      pincode: postal,
      formattedAddress: matchAddr.isNotEmpty ? matchAddr : clean(data['address']?['LongLabel']),
    );
  }

  static Future<List<FarmGeoLocation>> search(String query) async {
    final q = query.trim();
    if (q.length < 2) return const [];
    try {
      final uri = Uri.parse(
        '$_nominatim/search?format=jsonv2&q=${Uri.encodeComponent(q)}&addressdetails=1&countrycodes=in&limit=6&accept-language=en',
      );
      final res = await http.get(uri, headers: const {'User-Agent': _userAgent}).timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return const [];
      final list = jsonDecode(res.body);
      if (list is! List) return const [];
      return list.whereType<Map<String, dynamic>>().map((item) {
        final lat = double.tryParse('${item['lat']}') ?? 0;
        final lng = double.tryParse('${item['lon']}') ?? 0;
        return _fromNominatim(item, lat, lng);
      }).where((g) => g.latitude != 0 || g.longitude != 0).toList();
    } catch (_) {
      return const [];
    }
  }

  static FarmGeoLocation _fromNominatim(Map<String, dynamic> data, double lat, double lng) {
    final addr = (data['address'] as Map?)?.cast<String, dynamic>() ?? const {};
    String pick(List<String> keys) {
      for (final k in keys) {
        final v = addr[k]?.toString().trim() ?? '';
        if (v.isNotEmpty) return v;
      }
      return '';
    }

    final rawTaluka = _stripSuffix(pick(['county', 'subdistrict', 'district_subdivision', 'tehsil', 'tahsil', 'taluk', 'taluka', 'municipality', 'city_district', 'state_district']));
    final rawDistrict = _stripSuffix(pick(['state_district', 'district', 'city']));

    // 1. Prioritize real village / rural settlement tags
    String rawVillage = pick(['village', 'hamlet', 'isolated_dwelling', 'farm', 'croft', 'allotments', 'locality']);
    if (_isRoadOrHighway(rawVillage)) rawVillage = '';

    // 2. If empty, check suburb / neighbourhood / residential, making sure it doesn't duplicate taluka or district or road
    if (rawVillage.isEmpty) {
      final candidate = pick(['neighbourhood', 'suburb', 'residential', 'town']);
      if (candidate.isNotEmpty && !_isRoadOrHighway(candidate)) {
        final cLower = candidate.toLowerCase();
        final tLower = rawTaluka.toLowerCase();
        final dLower = rawDistrict.toLowerCase();
        if (cLower != tLower && !cLower.contains(tLower) && !tLower.contains(cLower) && cLower != dLower) {
          rawVillage = candidate;
        }
      }
    }

    // 2b. Check if road name has a village name: e.g. "Sawargaon Tal Rd" -> "Sawargaon Tal"
    if (rawVillage.isEmpty) {
      final road = pick(['road']);
      if (road.isNotEmpty && !_isRoadOrHighway(road)) {
        final stripped = road.replaceAll(RegExp(r'\b(road|rd|highway|expressway|lane|street|marg|path|toll|bypass|flyover)\b', caseSensitive: false), '').trim();
        if (stripped.isNotEmpty && !_isRoadOrHighway(stripped)) {
          rawVillage = stripped;
        }
      }
    }

    // 3. Fallback: Parse display_name tokens for village name, strictly skipping any roads/highways
    if (rawVillage.isEmpty) {
      final disp = (data['display_name'] ?? '').toString();
      final tokens = disp.split(',').map((s) => s.trim()).toList();
      for (final token in tokens) {
        final tLower = token.toLowerCase();
        if (_isRoadOrHighway(token) ||
            tLower.contains(rawTaluka.toLowerCase()) ||
            tLower.contains(rawDistrict.toLowerCase()) ||
            tLower.contains('maharashtra') ||
            tLower.contains('india')) {
          continue;
        }
        rawVillage = token;
        break;
      }
    }

    return FarmGeoLocation(
      latitude: lat,
      longitude: lng,
      village: rawVillage,
      taluka: rawTaluka,
      district: rawDistrict,
      state: pick(['state']).isNotEmpty ? pick(['state']) : 'Maharashtra',
      pincode: pick(['postcode', 'postal_code']).replaceAll(' ', ''),
      formattedAddress: (data['display_name'] ?? '').toString(),
    );
  }

  static String _stripSuffix(String value) => value
      .replaceAll(RegExp(r'\s+(Taluka|Tahsil|Tehsil|Subdistrict|District|City)$', caseSensitive: false), '')
      .trim();
}
