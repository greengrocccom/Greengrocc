import 'dart:typed_data';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import 'package:latlong2/latlong.dart';

import '../../../config/theme.dart';
import 'road_route_service.dart';
import 'tracking_map_overlays.dart';
import 'tracking_markers.dart';

/// Key-free live tracking map (OpenStreetMap data, CARTO Voyager tiles) styled
/// like [LiveTrackingMap]: same rider / home markers, dotted green route, ETA
/// pill and re-center button. The rider glides between GPS fixes (≈1 s).
class OsmTrackingMap extends StatefulWidget {
  const OsmTrackingMap({
    super.key,
    this.driver,
    this.heading,
    this.store,
    this.destination,
    this.route = const [],
    this.etaText,
    this.distanceMeters,
    this.height = 270,
  });

  final gm.LatLng? driver;
  final double? heading;
  final gm.LatLng? store;
  final gm.LatLng? destination;
  final List<gm.LatLng> route;
  final String? etaText;
  final int? distanceMeters;
  final double height;

  @override
  State<OsmTrackingMap> createState() => _OsmTrackingMapState();
}

LatLng _ll(gm.LatLng p) => LatLng(p.latitude, p.longitude);

class _OsmTrackingMapState extends State<OsmTrackingMap> with SingleTickerProviderStateMixin {
  final MapController _map = MapController();
  late final AnimationController _move = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..addListener(_onTick);

  bool _mapReady = false;
  bool _userMoved = false;
  bool _iconsRequested = false;
  Uint8List? _riderPng;
  Uint8List? _destPng;

  LatLng? _shown;
  LatLng? _from;
  LatLng? _to;

  List<LatLng>? _roadRoute;
  String? _roadEtaText;
  int? _roadDistanceMeters;

  @override
  void initState() {
    super.initState();
    _shown = widget.driver != null ? _ll(widget.driver!) : null;
    _ensureRoadRoute();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_iconsRequested) return;
    _iconsRequested = true;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    TrackingMarkers.riderMarkerPng(dpr).then((png) {
      if (mounted) setState(() => _riderPng = png);
    });
    TrackingMarkers.destinationMarkerPng(dpr).then((png) {
      if (mounted) setState(() => _destPng = png);
    });
  }

  @override
  void didUpdateWidget(covariant OsmTrackingMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.driver;
    if (next != null && next != oldWidget.driver) {
      _animateTo(_ll(next));
    } else if (next == null && oldWidget.driver != null) {
      _move.stop();
      setState(() => _shown = null);
    } else if (widget.destination != oldWidget.destination || widget.store != oldWidget.store) {
      _roadRoute = null;
      _ensureRoadRoute();
      _fitCamera();
    }
    if (widget.route != oldWidget.route && widget.route.length > 2) {
      if (_roadRoute != null) setState(() => _roadRoute = null);
    } else if (_roadRoute == null && widget.route.length <= 2) {
      _ensureRoadRoute();
    }
  }

  @override
  void dispose() {
    _move.dispose();
    _map.dispose();
    super.dispose();
  }

  void _ensureRoadRoute() {
    if (widget.route.length > 2) return;
    if (_roadRoute != null && _roadRoute!.length > 2) return;
    final origin = widget.driver ?? widget.store;
    final dest = widget.destination;
    if (origin == null || dest == null) return;
    if (const Distance().as(LengthUnit.Meter, _ll(origin), _ll(dest)) < 20) return;

    RoadRouteService.fetchRoadRoute(origin: origin, destination: dest).then((res) {
      if (!mounted || res == null || res.points.length < 2) return;
      setState(() {
        _roadRoute = res.points.map(_ll).toList();
        _roadEtaText = res.etaText;
        _roadDistanceMeters = res.distanceMeters;
      });
      _fitCamera();
    });
  }

  List<LatLng> get _baseRoute {
    if (_roadRoute != null && _roadRoute!.length > 2) return _roadRoute!;
    if (widget.route.length > 2) return widget.route.map(_ll).toList();
    return const [];
  }

  void _animateTo(LatLng target) {
    final current = _shown;
    if (current == null) {
      setState(() => _shown = target);
      _fitCamera();
      return;
    }
    _from = current;
    _to = target;
    _move.forward(from: 0);
  }

  void _onTick() {
    final from = _from;
    final to = _to;
    if (from == null || to == null) return;
    final t = _move.value;
    setState(() {
      _shown = LatLng(
        from.latitude + (to.latitude - from.latitude) * t,
        from.longitude + (to.longitude - from.longitude) * t,
      );
    });
  }

  void _fitCamera() {
    if (!_mapReady || _userMoved) return;
    final scooty = _shown;
    final store = widget.store;
    final points = <LatLng>[
      ?scooty,
      if (widget.destination != null) _ll(widget.destination!),
      if (scooty == null && store != null) _ll(store),
      ..._baseRoute,
    ];
    if (points.isEmpty) return;
    if (points.length == 1) {
      _map.move(points.first, 15);
      return;
    }
    final bounds = LatLngBounds.fromPoints(points);
    if ((bounds.north - bounds.south).abs() < 0.0006 && (bounds.east - bounds.west).abs() < 0.0006) {
      _map.move(bounds.center, 17.5);
      return;
    }
    _map.fitCamera(CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(60), maxZoom: 18));
  }

  void _recenter() {
    setState(() => _userMoved = false);
    _fitCamera();
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.store != null ? _ll(widget.store!) : null;
    final destination = widget.destination != null ? _ll(widget.destination!) : null;
    final initial = _shown ?? store ?? destination ?? const LatLng(20.5937, 78.9629);

    final scootyPos = _shown ?? store;
    final baseRoute = _baseRoute;
    const distance = Distance();
    final activeRoute = <LatLng>[
      if (baseRoute.length > 2) ...[
        if (scootyPos != null && distance.as(LengthUnit.Meter, scootyPos, baseRoute.first) > 10) scootyPos,
        ...baseRoute,
        if (destination != null && distance.as(LengthUnit.Meter, destination, baseRoute.last) > 10) destination,
      ],
    ];

    final hasLiveEta = widget.etaText?.trim().isNotEmpty == true;
    final effectiveEta = hasLiveEta ? widget.etaText : _roadEtaText;
    final effectiveMeters = hasLiveEta ? widget.distanceMeters : _roadDistanceMeters;

    const riderSize = TrackingMarkers.riderSize;
    const riderAnchor = TrackingMarkers.riderAnchor;

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: widget.height,
        child: Stack(
          children: [
            RawGestureDetector(
              gestures: {
                EagerGestureRecognizer: GestureRecognizerFactoryWithHandlers<EagerGestureRecognizer>(
                  EagerGestureRecognizer.new,
                  (_) {},
                ),
              },
              child: FlutterMap(
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
                    urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                    subdomains: const ['a', 'b', 'c', 'd'],
                    retinaMode: RetinaMode.isHighDensity(context),
                    userAgentPackageName: 'com.greengrocc.userapp',
                    maxZoom: 20,
                  ),
                  if (destination != null)
                    CircleLayer(
                      circles: [
                        CircleMarker(
                          point: destination,
                          radius: 35,
                          useRadiusInMeter: true,
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderColor: AppColors.primaryLight,
                          borderStrokeWidth: 2,
                        ),
                      ],
                    ),
                  if (activeRoute.length > 2)
                    PolylineLayer(
                      polylines: [
                        Polyline(
                          points: activeRoute,
                          color: AppColors.primary.withValues(alpha: 0.18),
                          strokeWidth: 5,
                        ),
                        Polyline(
                          points: activeRoute,
                          color: AppColors.primary,
                          strokeWidth: 6,
                          pattern: const StrokePattern.dotted(spacingFactor: 2.5),
                        ),
                      ],
                    ),
                  MarkerLayer(
                    markers: [
                      if (store != null)
                        Marker(
                          point: store,
                          width: 40,
                          height: 40,
                          alignment: Alignment.topCenter,
                          child: const Icon(Icons.location_on, color: Color(0xFF16A34A), size: 40),
                        ),
                      if (destination != null)
                        Marker(
                          point: destination,
                          width: TrackingMarkers.destinationSize,
                          height: TrackingMarkers.destinationSize,
                          child: _destPng != null
                              ? Image.memory(_destPng!, gaplessPlayback: true)
                              : const Icon(Icons.location_on, color: Color(0xFFD32F2F), size: 40),
                        ),
                      if (_shown != null)
                        Marker(
                          point: _shown!,
                          width: riderSize.width,
                          height: riderSize.height,
                          // flutter_map places the widget relative to the point, so an
                          // anchor fraction f becomes alignment 1 - 2f.
                          alignment: Alignment(
                            1 - riderAnchor.dx * 2,
                            1 - riderAnchor.dy * 2,
                          ),
                          child: _riderPng != null
                              ? Image.memory(_riderPng!, gaplessPlayback: true)
                              : const Icon(Icons.delivery_dining, color: AppColors.primary, size: 36),
                        ),
                    ],
                  ),
                  const Align(
                    alignment: Alignment.bottomRight,
                    child: Padding(
                      padding: EdgeInsets.only(right: 6, bottom: 4),
                      child: Text(
                        '© OpenStreetMap © CARTO',
                        style: TextStyle(fontSize: 8.5, color: Color(0xFF64748B)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              bottom: 10,
              left: 10,
              child: TrackingEtaPill(etaText: effectiveEta, distanceMeters: effectiveMeters),
            ),
            Positioned(
              top: 10,
              right: 10,
              child: TrackingRecenterButton(onTap: _recenter),
            ),
          ],
        ),
      ),
    );
  }
}
