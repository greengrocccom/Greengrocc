import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../config/env.dart';
import 'live_tracking_map.dart';
import 'osm_tracking_map.dart';

/// Google Maps only renders when the native project has an SDK key
/// (MAPS_API_KEY); without one its tiles stay grey, so use OpenStreetMap.
class TrackingMapSupport {
  TrackingMapSupport._();

  static const _channel = MethodChannel('com.greengrocc.app/maps');
  static Future<bool>? _google;

  static Future<bool> useGoogleMaps() => _google ??= _check();

  static Future<bool> _check() async {
    if (kIsWeb || !Env.useGoogleMaps) return false;
    try {
      return await _channel.invokeMethod<bool>('hasGoogleMapsKey') ?? false;
    } catch (_) {
      return false;
    }
  }
}

/// Live order map: Google Maps when available, otherwise the same view on OpenStreetMap.
class TrackingMap extends StatelessWidget {
  const TrackingMap({
    super.key,
    this.driver,
    this.heading,
    this.store,
    this.destination,
    this.route = const [],
    this.etaText,
    this.distanceMeters,
    this.liveTracking = false,
    this.height = 270,
  });

  final LatLng? driver;
  final double? heading;
  final LatLng? store;
  final LatLng? destination;
  final List<LatLng> route;
  final String? etaText;
  final int? distanceMeters;
  final bool liveTracking;
  final double height;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: TrackingMapSupport.useGoogleMaps(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Container(height: height, color: const Color(0xFFE8EEF0)),
          );
        }
        if (snapshot.data!) {
          return LiveTrackingMap(
            driver: driver,
            heading: heading,
            store: store,
            destination: destination,
            route: route,
            etaText: etaText,
            distanceMeters: distanceMeters,
            liveTracking: liveTracking,
            height: height,
          );
        }
        return OsmTrackingMap(
          driver: driver,
          heading: heading,
          store: store,
          destination: destination,
          route: route,
          etaText: etaText,
          distanceMeters: distanceMeters,
          height: height,
        );
      },
    );
  }
}
