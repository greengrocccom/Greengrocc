import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import 'package:latlong2/latlong.dart';

import 'bike_marker.dart';

const _routeGreen = Color(0xFF2E7D32);

/// OpenStreetMap version of the live map (no API key). Same behaviour as
/// [LiveTrackingMap]: the bike glides between GPS fixes (≈1 s) and turns with heading.
class OsmLiveTrackingMap extends StatefulWidget {
  const OsmLiveTrackingMap({
    super.key,
    this.driver,
    this.heading,
    this.store,
    this.destination,
    this.route = const [],
    this.height = 300,
  });

  final gm.LatLng? driver;
  final double? heading;
  final gm.LatLng? store;
  final gm.LatLng? destination;
  final List<gm.LatLng> route;
  final double height;

  @override
  State<OsmLiveTrackingMap> createState() => _OsmLiveTrackingMapState();
}

LatLng? _ll(gm.LatLng? p) => p == null ? null : LatLng(p.latitude, p.longitude);

class _OsmLiveTrackingMapState extends State<OsmLiveTrackingMap> with SingleTickerProviderStateMixin {
  late final AnimationController _move = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..addListener(_onTick);

  final MapController _map = MapController();
  bool _mapReady = false;
  bool _userMoved = false;

  LatLng? _shown;
  LatLng? _from;
  LatLng? _to;
  double _shownHeading = 0;
  double _fromHeading = 0;
  double _toHeading = 0;

  @override
  void initState() {
    super.initState();
    _shown = _ll(widget.driver);
    _shownHeading = widget.heading ?? 0;
  }

  @override
  void didUpdateWidget(covariant OsmLiveTrackingMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = _ll(widget.driver);
    if (next != null && widget.driver != oldWidget.driver) {
      _animateTo(next, widget.heading);
    } else if (next == null && oldWidget.driver != null) {
      _move.stop();
      setState(() => _shown = null);
    } else if (widget.destination != oldWidget.destination || widget.store != oldWidget.store) {
      _fitCamera();
    }
  }

  @override
  void dispose() {
    _move.dispose();
    _map.dispose();
    super.dispose();
  }

  void _animateTo(LatLng target, double? heading) {
    final current = _shown;
    if (current == null) {
      setState(() {
        _shown = target;
        _shownHeading = heading ?? _shownHeading;
      });
      _fitCamera();
      return;
    }
    _from = current;
    _to = target;
    _fromHeading = _shownHeading;
    final moved = const Distance().as(LengthUnit.Meter, current, target);
    _toHeading = heading ?? (moved > 3 ? _bearing(current, target) : _shownHeading);
    _move.forward(from: 0);
    _fitCamera(include: target);
  }

  void _onTick() {
    final from = _from;
    final to = _to;
    if (from == null || to == null) return;
    final t = _move.value;
    final delta = ((_toHeading - _fromHeading + 540) % 360) - 180;
    setState(() {
      _shown = LatLng(
        from.latitude + (to.latitude - from.latitude) * t,
        from.longitude + (to.longitude - from.longitude) * t,
      );
      _shownHeading = (_fromHeading + delta * t + 360) % 360;
    });
  }

  void _fitCamera({LatLng? include}) {
    if (!_mapReady || _userMoved) return;
    final destination = _ll(widget.destination);
    final store = _ll(widget.store);
    final points = <LatLng>[
      if (include != null) include else if (_shown != null) _shown!,
      ?destination,
      if (_shown == null && include == null && store != null) store,
    ];
    if (points.isEmpty) return;
    final bounds = LatLngBounds.fromPoints(points);
    final tiny = (bounds.north - bounds.south).abs() < 0.0005 && (bounds.east - bounds.west).abs() < 0.0005;
    if (points.length == 1 || tiny) {
      _map.move(points.first, 16);
      return;
    }
    _map.fitCamera(CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(56), maxZoom: 17));
  }

  void _recenter() {
    setState(() => _userMoved = false);
    _fitCamera();
  }

  @override
  Widget build(BuildContext context) {
    final store = _ll(widget.store);
    final destination = _ll(widget.destination);
    final route = widget.route.map((p) => LatLng(p.latitude, p.longitude)).toList();
    final initial = _shown ?? store ?? destination ?? const LatLng(20.5937, 78.9629);

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: widget.height,
        child: Stack(
          children: [
            FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: initial,
                initialZoom: 14,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                ),
                onMapReady: () {
                  _mapReady = true;
                  _fitCamera();
                },
                onPositionChanged: (_, hasGesture) {
                  if (hasGesture && !_userMoved) setState(() => _userMoved = true);
                },
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.greengrocc.app',
                ),
                if (route.length >= 2)
                  PolylineLayer(
                    polylines: [
                      Polyline(points: route, color: _routeGreen, strokeWidth: 5),
                    ],
                  ),
                MarkerLayer(
                  markers: [
                    if (store != null && _shown == null)
                      Marker(
                        point: store,
                        width: 40,
                        height: 40,
                        alignment: Alignment.topCenter,
                        child: const Icon(Icons.storefront, color: _routeGreen, size: 34),
                      ),
                    if (destination != null)
                      Marker(
                        point: destination,
                        width: 40,
                        height: 40,
                        alignment: Alignment.topCenter,
                        child: const Icon(Icons.location_on, color: Color(0xFFD32F2F), size: 40),
                      ),
                    if (_shown != null)
                      Marker(
                        point: _shown!,
                        width: BikeMarker.logicalSize,
                        height: BikeMarker.logicalSize,
                        child: Transform.rotate(
                          angle: _shownHeading * math.pi / 180,
                          child: const BikeIcon(),
                        ),
                      ),
                  ],
                ),
                const SimpleAttributionWidget(source: Text('OpenStreetMap contributors')),
              ],
            ),
            if (_userMoved)
              Positioned(
                right: 10,
                bottom: 34,
                child: Material(
                  color: Colors.white,
                  shape: const CircleBorder(),
                  elevation: 3,
                  child: IconButton(
                    tooltip: 'Re-center',
                    icon: const Icon(Icons.my_location, color: _routeGreen),
                    onPressed: _recenter,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

double _bearing(LatLng from, LatLng to) {
  double rad(double d) => d * math.pi / 180;
  final y = math.sin(rad(to.longitude - from.longitude)) * math.cos(rad(to.latitude));
  final x = math.cos(rad(from.latitude)) * math.sin(rad(to.latitude)) -
      math.sin(rad(from.latitude)) * math.cos(rad(to.latitude)) * math.cos(rad(to.longitude - from.longitude));
  return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
}
