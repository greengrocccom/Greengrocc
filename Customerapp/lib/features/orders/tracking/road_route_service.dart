import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'polyline_codec.dart';

class RoadRouteResult {
  const RoadRouteResult({
    required this.points,
    required this.distanceMeters,
    required this.durationSeconds,
  });

  final List<LatLng> points;
  final int distanceMeters;
  final int durationSeconds;

  String get etaText {
    final minutes = (durationSeconds / 60).round().clamp(1, 180);
    if (minutes < 60) return '$minutes min';
    final hours = minutes ~/ 60;
    final rest = minutes % 60;
    return rest > 0 ? '$hours hr $rest min' : '$hours hr';
  }
}

/// Fetches real street turn-by-turn road driving geometry from OSRM.
/// Ensures the customer app always displays actual road routes rather than
/// straight lines, even when the live server fallback estimate is received.
class RoadRouteService {
  RoadRouteService._();

  static final Map<String, RoadRouteResult> _cache = {};
  static final HttpClient _client = HttpClient()..connectionTimeout = const Duration(seconds: 5);

  static Future<RoadRouteResult?> fetchRoadRoute({
    required LatLng origin,
    required LatLng destination,
  }) async {
    final key = '${origin.latitude.toStringAsFixed(4)},${origin.longitude.toStringAsFixed(4)}-'
        '${destination.latitude.toStringAsFixed(4)},${destination.longitude.toStringAsFixed(4)}';
    final cached = _cache[key];
    if (cached != null) return cached;

    // Android and iOS block cleartext by default, so plain http only works as a fallback.
    final endpoints = [
      'https://router.project-osrm.org/route/v1/driving/'
          '${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}'
          '?overview=full&geometries=polyline',
      'http://router.project-osrm.org/route/v1/driving/'
          '${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}'
          '?overview=full&geometries=polyline',
    ];

    for (final url in endpoints) {
      try {
        final uri = Uri.parse(url);
        final req = await _client.getUrl(uri);
        req.headers.set('User-Agent', 'GreenGroccCustomerApp/1.0');
        final res = await req.close();
        if (res.statusCode != 200) continue;

        final body = await res.transform(utf8.decoder).join();
        final data = jsonDecode(body);
        if (data is! Map || data['code'] != 'Ok') continue;

        final routes = data['routes'] as List?;
        if (routes == null || routes.isEmpty) continue;

        final route = routes.first as Map;
        final geometry = route['geometry']?.toString() ?? '';
        if (geometry.isEmpty) continue;

        final points = decodePolyline(geometry);
        if (points.length < 2) continue;

        final distanceMeters = (route['distance'] as num?)?.round() ?? 0;
        final durationSeconds = (route['duration'] as num?)?.round() ?? 60;

        final result = RoadRouteResult(
          points: points,
          distanceMeters: distanceMeters,
          durationSeconds: durationSeconds,
        );

        if (_cache.length > 50) _cache.remove(_cache.keys.first);
        _cache[key] = result;
        return result;
      } catch (e) {
        debugPrint('[RoadRouteService] attempt on $url failed: $e');
      }
    }
    return null;
  }
}
