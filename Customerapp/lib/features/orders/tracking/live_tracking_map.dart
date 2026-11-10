import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../config/theme.dart';
import 'road_route_service.dart';
import 'tracking_map_overlays.dart';
import 'tracking_markers.dart';

/// Map with the rider's bike marker gliding between GPS fixes (≈1 s), rotated by
/// heading, plus the route polyline, dark store and delivery location.
class LiveTrackingMap extends StatefulWidget {
  const LiveTrackingMap({
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
  State<LiveTrackingMap> createState() => _LiveTrackingMapState();
}

class _LiveTrackingMapState extends State<LiveTrackingMap> with SingleTickerProviderStateMixin {
  late final AnimationController _move = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..addListener(_onTick);

  GoogleMapController? _map;
  BitmapDescriptor? _riderIcon;
  BitmapDescriptor? _destIcon;
  bool _iconsRequested = false;
  bool _userMoved = false;

  LatLng? _shown;
  LatLng? _from;
  LatLng? _to;
  double _shownHeading = 0;
  double _fromHeading = 0;
  double _toHeading = 0;

  List<LatLng>? _roadRoute;
  String? _roadEtaText;
  int? _roadDistanceMeters;

  @override
  void initState() {
    super.initState();
    _shown = widget.driver;
    _shownHeading = widget.heading ?? 0;
    _ensureRoadRoute();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_iconsRequested) return;
    _iconsRequested = true;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    TrackingMarkers.riderMarker(dpr).then((icon) {
      if (mounted) setState(() => _riderIcon = icon);
    });
    TrackingMarkers.destinationMarker(dpr).then((icon) {
      if (mounted) setState(() => _destIcon = icon);
    });
  }

  bool _initialCameraFitted = false;

  @override
  void didUpdateWidget(covariant LiveTrackingMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.driver;
    if (next != null && next != oldWidget.driver) {
      _animateTo(next, widget.heading);
    } else if (next == null && oldWidget.driver != null) {
      _move.stop();
      setState(() => _shown = null);
    } else if (widget.destination != oldWidget.destination ||
        widget.store != oldWidget.store) {
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

  void _ensureRoadRoute() {
    // If we already have a real multi-point turn-by-turn road route from props, use it
    if (widget.route.length > 2) {
      if (_roadRoute != null) setState(() => _roadRoute = null);
      return;
    }
    // If road route already resolved, do not re-fetch on every GPS coordinate tick
    if (_roadRoute != null && _roadRoute!.length > 2) {
      return;
    }
    final origin = _shown ?? widget.store;
    final dest = widget.destination;
    if (origin == null || dest == null) return;
    if (_metersBetween(origin, dest) < 20) return;

    RoadRouteService.fetchRoadRoute(origin: origin, destination: dest).then((res) {
      if (!mounted || res == null || res.points.length < 2) return;
      setState(() {
        _roadRoute = res.points;
        _roadEtaText = res.etaText;
        _roadDistanceMeters = res.distanceMeters;
      });
      if (!_initialCameraFitted) {
        _fitCamera();
      }
    });
  }

  @override
  void dispose() {
    _move.dispose();
    _map?.dispose();
    super.dispose();
  }

  void _animateTo(LatLng target, double? heading) {
    final current = _shown;
    if (current == null) {
      setState(() {
        _shown = target;
        _shownHeading = heading ?? _shownHeading;
      });
      if (!_initialCameraFitted) {
        _fitCamera();
      }
      return;
    }
    _from = current;
    _to = target;
    _fromHeading = _shownHeading;
    _toHeading = heading ?? (_metersBetween(current, target) > 3 ? _bearing(current, target) : _shownHeading);
    // Smoothly animate the rider marker along the route without moving/zooming the camera
    _move.forward(from: 0);
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
    final map = _map;
    if (map == null || _userMoved) return;
    _initialCameraFitted = true;
    final scooty = include ?? _shown;
    final routePoints = (_roadRoute != null && _roadRoute!.length > 2) ? _roadRoute! : widget.route;
    final dest = widget.destination;
    final store = widget.store;
    final points = <LatLng>[
      ?scooty,
      ?dest,
      if (scooty == null && store != null) store,
      ...routePoints,
    ];
    if (points.isEmpty) return;
    if (points.length == 1) {
      map.animateCamera(CameraUpdate.newLatLngZoom(points.first, 15));
      return;
    }
    var south = points.first.latitude, north = south;
    var west = points.first.longitude, east = west;
    for (final p in points) {
      south = math.min(south, p.latitude);
      north = math.max(north, p.latitude);
      west = math.min(west, p.longitude);
      east = math.max(east, p.longitude);
    }
    final latSpan = (north - south).abs();
    final lngSpan = (east - west).abs();
    if (latSpan < 0.0006 && lngSpan < 0.0006) {
      final mid = LatLng((north + south) / 2, (east + west) / 2);
      map.animateCamera(CameraUpdate.newLatLngZoom(mid, 17.5));
      return;
    }
    map.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(southwest: LatLng(south, west), northeast: LatLng(north, east)),
        60,
      ),
    );
  }

  void _recenter() {
    setState(() => _userMoved = false);
    _fitCamera();
  }

  Set<Marker> _markers() {
    return {
      if (widget.store != null)
        Marker(
          markerId: const MarkerId('store'),
          position: widget.store!,
          consumeTapEvents: true,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        ),
      if (widget.destination != null)
        Marker(
          markerId: const MarkerId('destination'),
          position: widget.destination!,
          consumeTapEvents: true,
          anchor: const Offset(0.5, 0.5),
          icon: _destIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        ),
      if (_shown != null)
        Marker(
          markerId: const MarkerId('driver'),
          position: _shown!,
          consumeTapEvents: true,
          flat: false,
          anchor: const Offset(0.5, 0.65),
          zIndexInt: 3,
          icon: _riderIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final initialTarget = _shown ?? widget.store ?? widget.destination ?? const LatLng(20.5937, 78.9629);

    final scootyPos = _shown ?? widget.store;
    final destPos = widget.destination;

    // Use real street road route if client resolved or if props has multi-point road
    final baseRoute = (_roadRoute != null && _roadRoute!.length > 2)
        ? _roadRoute!
        : (widget.route.length > 2 ? widget.route : const <LatLng>[]);

    // Connect path from scooty to destination along the road
    final activeRoute = <LatLng>[
      if (baseRoute.length > 2) ...[
        if (scootyPos != null && _metersBetween(scootyPos, baseRoute.first) > 10) scootyPos,
        ...baseRoute,
        if (destPos != null && _metersBetween(destPos, baseRoute.last) > 10) destPos,
      ],
    ];

    // The panel's ETA follows the rider; the map's own road route is a one-off
    // store → home estimate, so it only fills in when the panel has none.
    final hasLiveEta = widget.etaText?.trim().isNotEmpty == true;
    final effectiveEta = hasLiveEta ? widget.etaText : _roadEtaText;
    final effectiveMeters = hasLiveEta ? widget.distanceMeters : _roadDistanceMeters;

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: widget.height,
        child: Stack(
          children: [
            Listener(
              onPointerDown: (_) {
                if (!_userMoved) setState(() => _userMoved = true);
              },
              child: GoogleMap(
                initialCameraPosition: CameraPosition(target: initialTarget, zoom: 14),
                markers: _markers(),
                circles: {
                  if (destPos != null)
                    Circle(
                      circleId: const CircleId('dest_halo'),
                      center: destPos,
                      radius: 35,
                      fillColor: AppColors.primary.withValues(alpha: 0.15),
                      strokeColor: AppColors.primaryLight,
                      strokeWidth: 2,
                    ),
                },
                polylines: {
                  if (activeRoute.length > 2) ...[
                    // Layer 1: Subtle background guide line
                    Polyline(
                      polylineId: const PolylineId('route_base'),
                      points: activeRoute,
                      color: AppColors.primary.withValues(alpha: 0.18),
                      width: 5,
                      startCap: Cap.roundCap,
                      endCap: Cap.roundCap,
                      jointType: JointType.round,
                    ),
                    // Layer 2: Dotted route line
                    Polyline(
                      polylineId: const PolylineId('route_dotted'),
                      points: activeRoute,
                      color: AppColors.primary,
                      width: 6,
                      patterns: <PatternItem>[
                        PatternItem.dot,
                        PatternItem.gap(10),
                      ],
                      startCap: Cap.roundCap,
                      endCap: Cap.roundCap,
                      jointType: JointType.round,
                    ),
                  ],
                },
                myLocationButtonEnabled: false,
                zoomControlsEnabled: false,
                mapToolbarEnabled: false,
                compassEnabled: false,
                tiltGesturesEnabled: false,
                rotateGesturesEnabled: false,
                onCameraMoveStarted: () => _userMoved = true,
                padding: const EdgeInsets.only(bottom: 12, left: 12),
                gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
                  Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer()),
                },
                onMapCreated: (controller) {
                  _map = controller;
                  WidgetsBinding.instance.addPostFrameCallback((_) => _fitCamera());
                },
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

double _metersBetween(LatLng a, LatLng b) {
  const r = 6371000.0;
  final dLat = _rad(b.latitude - a.latitude);
  final dLng = _rad(b.longitude - a.longitude);
  final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(_rad(a.latitude)) * math.cos(_rad(b.latitude)) * math.sin(dLng / 2) * math.sin(dLng / 2);
  return 2 * r * math.asin(math.min(1, math.sqrt(h)));
}

double _bearing(LatLng from, LatLng to) {
  final y = math.sin(_rad(to.longitude - from.longitude)) * math.cos(_rad(to.latitude));
  final x = math.cos(_rad(from.latitude)) * math.sin(_rad(to.latitude)) -
      math.sin(_rad(from.latitude)) * math.cos(_rad(to.latitude)) * math.cos(_rad(to.longitude - from.longitude));
  return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
}

double _rad(double deg) => deg * math.pi / 180;
