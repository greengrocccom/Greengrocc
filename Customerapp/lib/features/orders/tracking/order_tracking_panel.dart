import 'dart:async';
import 'dart:math' as math;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../config/env.dart';
import '../../../config/theme.dart';
import '../../../services/socket_service.dart';
import '../widgets/preorder_progress_steps.dart';
import '../../../models/order.dart';
import 'order_tracking_models.dart';
import 'order_tracking_repository.dart';
import 'polyline_codec.dart';
import 'road_route_service.dart';
import 'tracking_map.dart';
import 'tracking_timeline.dart';
import 'widgets/modern_tracking_view.dart';

const _green = AppColors.primary;

/// Order tracking section of the order details screen.
///
/// Ready to Cook / Instant: live map (bike marker, route, ETA), rider card with
/// call button, status timeline. Pre-order: status timeline + delivery slot only.
/// Both update in real time from the socket (`order_status`, `location_update`).
class OrderTrackingPanel extends ConsumerStatefulWidget {
  const OrderTrackingPanel({
    super.key,
    required this.orderId,
    this.order,
    this.onStatusChanged,
    this.onOrderAgain,
    this.onInvoice,
  });

  final String orderId;
  final Order? order;
  /// Lets the parent reload the full order (bill, OTP, rating…) on status changes.
  final VoidCallback? onStatusChanged;
  final VoidCallback? onOrderAgain;
  final VoidCallback? onInvoice;

  @override
  ConsumerState<OrderTrackingPanel> createState() => _OrderTrackingPanelState();
}

class _OrderTrackingPanelState extends ConsumerState<OrderTrackingPanel> {
  late final SocketService _socket;
  late final OrderTrackingRepository _repository;

  OrderTracking? _tracking;
  List<LatLng> _route = const [];
  bool _loading = true;
  String? _error;
  bool _offline = false;
  bool _socketDown = false;

  LatLng? _driver;
  double? _heading;
  DateTime? _lastFixAt;
  List<LatLng>? _progressRoute;
  int _progressIndex = 0;

  StreamSubscription<Map<String, dynamic>>? _locationSub;
  StreamSubscription<Map<String, dynamic>>? _statusSub;
  StreamSubscription<SocketStatus>? _socketStatusSub;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  Timer? _routeTimer;
  Timer? _statusDebounce;
  bool _fetching = false;
  bool _reloadQueued = false;

  @override
  void initState() {
    super.initState();
    _socket = ref.read(socketServiceProvider);
    _repository = ref.read(orderTrackingRepositoryProvider);

    _socket.joinOrder(widget.orderId);
    _locationSub = _socket.locationUpdates.listen(_onLocation);
    _statusSub = _socket.orderStatusUpdates.listen(_onOrderStatus);
    _socketDown = _socket.status == SocketStatus.disconnected;
    _socketStatusSub = _socket.connectionStatus.listen(_onSocketStatus);
    _connectivitySub = Connectivity().onConnectivityChanged.listen(_onConnectivity);

    _load();
  }

  @override
  void dispose() {
    _routeTimer?.cancel();
    _statusDebounce?.cancel();
    _locationSub?.cancel();
    _statusSub?.cancel();
    _socketStatusSub?.cancel();
    _connectivitySub?.cancel();
    _socket.leaveOrder(widget.orderId);
    super.dispose();
  }

  bool _isThisOrder(Map<String, dynamic> data) {
    final id = data['orderId']?.toString();
    final storeId = data['storeOrderId']?.toString();
    return id == widget.orderId ||
        (id != null && id == _tracking?.orderId) ||
        (storeId != null && (storeId == widget.orderId || storeId == _tracking?.storeOrderId));
  }

  Future<void> _load({bool silent = false}) async {
    if (_fetching) {
      _reloadQueued = true;
      return;
    }
    _fetching = true;
    if (!silent && mounted) {
      setState(() {
        _loading = _tracking == null;
        _error = null;
      });
    }
    try {
      final tracking = await _repository.fetchTracking(widget.orderId);
      if (!mounted) return;
      final fix = tracking.lastLocation;
      final fixIsNewer = fix != null &&
          (_lastFixAt == null || (fix.updatedAt != null && fix.updatedAt!.isAfter(_lastFixAt!)));
      final serverPoints = tracking.routePolyline != null ? decodePolyline(tracking.routePolyline!) : const <LatLng>[];
      setState(() {
        _tracking = tracking;
        _route = serverPoints.length > 2 ? serverPoints : const [];
        _loading = false;
        _error = null;
        if (!tracking.liveTracking || tracking.isClosed) {
          _driver = null;
          _heading = null;
        } else if (_driver == null && fix != null) {
          _driver = fix.position;
          _heading = fix.heading ?? _heading;
          _lastFixAt = fix.updatedAt ?? DateTime.now();
        } else if (fixIsNewer) {
          _driver = fix.position;
          _heading = fix.heading ?? _heading;
          _lastFixAt = fix.updatedAt;
        }
      });
      _scheduleRouteRefresh(tracking);

      // If backend returned straight-line estimate or no route, fetch turn-by-turn road geometry
      if (serverPoints.length <= 2 && tracking.destination != null && !tracking.isClosed) {
        final origin = _driver ?? tracking.storeLocation;
        if (origin != null) {
          unawaited(_resolveRoadRoute(origin, tracking.destination!));
        }
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (_tracking == null) _error = 'Could not load live status';
      });
    } finally {
      _fetching = false;
      if (_reloadQueued && mounted) {
        _reloadQueued = false;
        unawaited(_load(silent: true));
      }
    }
  }

  Future<void> _resolveRoadRoute(LatLng origin, LatLng destination) async {
    final res = await RoadRouteService.fetchRoadRoute(origin: origin, destination: destination);
    if (!mounted || res == null || res.points.length < 2) return;
    setState(() {
      _route = res.points;
      if (_tracking != null) {
        _tracking = _tracking!.withAccurateEta(
          text: res.etaText,
          distanceMeters: res.distanceMeters,
          seconds: res.durationSeconds,
        );
      }
    });
  }

  /// Route + ETA refresh while the order is on its way (live types only).
  void _scheduleRouteRefresh(OrderTracking tracking) {
    _routeTimer?.cancel();
    _routeTimer = null;
    if (!tracking.showLiveMap || tracking.isClosed) return;
    final seconds = tracking.refreshRouteSeconds.clamp(30, 60);
    _routeTimer = Timer.periodic(Duration(seconds: seconds), (_) => _load(silent: true));
  }

  void _onLocation(Map<String, dynamic> data) {
    final tracking = _tracking;
    if (!_isThisOrder(data) || tracking == null || !tracking.showLiveMap || tracking.isClosed) return;
    final lat = (data['lat'] as num?)?.toDouble();
    final lng = (data['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return;
    final heading = (data['heading'] as num?)?.toDouble();
    setState(() {
      _driver = LatLng(lat, lng);
      if (heading != null) _heading = heading;
      _lastFixAt = DateTime.tryParse('${data['updatedAt']}')?.toLocal() ?? DateTime.now();
    });
    // First fix after pickup: pull rider details, route and ETA.
    if (!tracking.liveTracking) {
      _load(silent: true);
    } else if (_route.length <= 2 && tracking.destination != null) {
      unawaited(_resolveRoadRoute(LatLng(lat, lng), tracking.destination!));
    }
  }

  void _onOrderStatus(Map<String, dynamic> data) {
    final tracking = _tracking;
    if (!_isThisOrder(data) || tracking == null) return;
    final status = data['status']?.toString();
    final storeOrderId = data['storeOrderId']?.toString();
    final samePart = storeOrderId == null ||
        tracking.storeOrderId == null ||
        storeOrderId == tracking.storeOrderId;
    if (status != null && samePart) {
      final next = tracking.withStatus(
        status,
        live: data['liveTracking'] == true,
        phase: data['riderPhase']?.toString(),
      );
      if (next.status != tracking.status ||
          next.liveTracking != tracking.liveTracking ||
          next.riderPhase != tracking.riderPhase) {
        setState(() {
          _tracking = next;
          if (next.isClosed || !next.liveTracking) _driver = null;
          if (next.isClosed) _routeTimer?.cancel();
        });
      }
    }
    _statusDebounce?.cancel();
    _statusDebounce = Timer(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      widget.onStatusChanged?.call();
      _load(silent: true);
    });
  }

  /// The route still ahead of the rider and the ETA scaled to it, so both shrink with
  /// every GPS fix between server refreshes. Matching only moves forward along the route.
  ({List<LatLng> route, OrderTracking tracking}) _liveView(OrderTracking tracking) {
    final rider = _driver;
    final route = _route;
    if (rider == null || route.length < 2) return (route: route, tracking: tracking);
    if (!identical(_progressRoute, route)) {
      _progressRoute = route;
      _progressIndex = 0;
    }
    var index = math.min(_progressIndex, route.length - 1);
    var best = _metersBetween(rider, route[index]);
    for (var i = index + 1; i < route.length; i++) {
      final meters = _metersBetween(rider, route[i]);
      if (meters < best) {
        best = meters;
        index = i;
      }
    }
    _progressIndex = index;
    final ahead = [rider, ...route.sublist(index + 1)];
    final eta = tracking.eta;
    final total = _pathMeters(route);
    if (eta == null || eta.seconds <= 0 || total <= 0) return (route: ahead, tracking: tracking);
    final meters = _pathMeters(ahead);
    final live = RoadRouteResult(
      points: ahead,
      distanceMeters: meters.round(),
      durationSeconds: (eta.seconds * math.min(1.0, meters / total)).round(),
    );
    return (
      route: ahead,
      tracking: tracking.withAccurateEta(
        text: live.etaText,
        distanceMeters: live.distanceMeters,
        seconds: live.durationSeconds,
      ),
    );
  }

  void _onSocketStatus(SocketStatus status) {
    final wasDown = _socketDown;
    final down = status == SocketStatus.disconnected;
    if (mounted && down != _socketDown) setState(() => _socketDown = down);
    // Catch up on anything missed while disconnected (rooms are re-joined by the service).
    if (wasDown && status == SocketStatus.connected) _load(silent: true);
  }

  void _onConnectivity(List<ConnectivityResult> results) {
    final offline = results.isEmpty || results.every((r) => r == ConnectivityResult.none);
    if (!mounted || offline == _offline) return;
    setState(() => _offline = offline);
    if (!offline) _load(silent: true);
  }

  Future<void> _callDriver(String phone) async {
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: digits);
    if (!await launchUrl(uri) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not start the call')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tracking = _tracking;

    // Full-screen modern tracking view when order model is provided
    if (widget.order != null) {
      if (_loading && tracking == null) {
        return Scaffold(
          backgroundColor: const Color(0xFFF6F8F6),
          appBar: AppBar(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            title: const Text(
              'Track Your Order',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
          ),
          body: const Center(
            child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 3),
          ),
        );
      }
      if (tracking == null) {
        return Scaffold(
          backgroundColor: const Color(0xFFF6F8F6),
          appBar: AppBar(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            title: const Text(
              'Track Your Order',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
          ),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off_rounded, size: 48, color: Color(0xFF94A3B8)),
                  const SizedBox(height: 12),
                  Text(
                    _error ?? 'Live tracking is currently unavailable.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 15, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _load,
                    style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        );
      }

      // Render the complete modern tracking view matching the exact UI mockup
      final live = _liveView(tracking);
      return ModernTrackingView(
        order: widget.order!,
        tracking: live.tracking,
        route: live.route,
        driver: _driver,
        heading: _heading,
        onBack: () => Navigator.of(context).maybePop(),
        onStatusChanged: widget.onStatusChanged,
        onInvoice: widget.onInvoice,
        onOrderAgain: widget.onOrderAgain,
      );
    }

    if (_loading && tracking == null) {
      return const _Card(
        child: SizedBox(
          height: 120,
          child: Center(child: CircularProgressIndicator(color: _green, strokeWidth: 2.5)),
        ),
      );
    }
    if (tracking == null) {
      return _Card(
        child: Row(
          children: [
            const Icon(Icons.cloud_off_outlined, color: AppColors.textSecondary),
            const SizedBox(width: 10),
            Expanded(child: Text(_error ?? 'Live status unavailable')),
            TextButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if ((_offline || _socketDown) && !tracking.isClosed) _ConnectionBanner(offline: _offline),
        if (tracking.delay != null && !tracking.isClosed) _DelayBanner(delay: tracking.delay!),
        if (tracking.showLiveMap) ..._liveSection(_liveView(tracking)) else ..._preOrderSection(tracking),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Order status',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 14),
              TrackingTimeline(steps: tracking.timeline),
            ],
          ),
        ),
        for (final part in tracking.otherParts) _OtherPartNote(part: part),
      ],
    );
  }

  List<Widget> _liveSection(({List<LatLng> route, OrderTracking tracking}) live) {
    final tracking = live.tracking;
    final eta = tracking.eta;
    final String title;
    final String subtitle;
    if (tracking.isDelivered) {
      title = 'Order delivered';
      subtitle = 'Enjoy your order!';
    } else if (tracking.isCancelled) {
      title = 'Order cancelled';
      subtitle = 'This order will not be delivered';
    } else if (tracking.riderToStore) {
      title = eta != null ? 'Arriving in ${eta.text}' : 'Delivery partner assigned';
      subtitle = '${tracking.driver?.name ?? 'Your delivery partner'} is picking up your order from the store';
    } else if (tracking.liveTracking) {
      title = eta != null ? 'Arriving in ${eta.text}' : 'On the way';
      subtitle = '${tracking.driver?.name ?? 'Your delivery partner'} is on the way';
    } else if (tracking.status == 'packed') {
      title = 'Packed — waiting for pickup';
      subtitle = eta != null ? 'About ${eta.text} after pickup' : 'A delivery partner will pick it up soon';
    } else {
      title = 'Preparing your order';
      subtitle = eta != null ? 'Estimated delivery in ${eta.text} after pickup' : 'We will notify you at every step';
    }

    final showMap = Env.liveMapEnabled &&
        !tracking.isClosed &&
        (tracking.destination != null || tracking.storeLocation != null || _driver != null);

    return [
      _Card(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  tracking.isDelivered
                      ? Icons.check_circle
                      : tracking.isCancelled
                          ? Icons.cancel
                          : Icons.delivery_dining,
                  color: tracking.isCancelled ? Colors.red.shade600 : _green,
                  size: 26,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 2),
                      Text(subtitle, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
                _TypeChip(orderType: tracking.orderType),
              ],
            ),
            if (showMap) ...[
              const SizedBox(height: 14),
              TrackingMap(
                driver: _driver,
                heading: _heading,
                store: tracking.storeLocation,
                destination: tracking.destination,
                route: live.route,
                etaText: tracking.eta?.text,
                distanceMeters: tracking.eta?.distanceMeters,
                liveTracking: tracking.liveTracking,
              ),
            ],
            if (tracking.liveTracking && _lastFixAt != null && !tracking.isClosed) ...[
              const SizedBox(height: 8),
              _LastUpdated(at: _lastFixAt!),
            ],
          ],
        ),
      ),
      if (tracking.driver != null && !tracking.isClosed) _driverCard(tracking),
    ];
  }

  Widget _driverCard(OrderTracking tracking) {
    final driver = tracking.driver!;
    return _Card(
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: _green.withValues(alpha: 0.12),
            child: const Icon(Icons.two_wheeler, color: _green),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  driver.name,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  tracking.riderToStore
                      ? 'Picking up your order from the store'
                      : tracking.liveTracking
                          ? 'Your delivery partner'
                          : 'Assigned delivery partner',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                ),
                if (driver.phone.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    driver.phone,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (driver.phone.isNotEmpty)
            FilledButton.icon(
              onPressed: () => _callDriver(driver.phone),
              icon: const Icon(Icons.call, size: 18),
              label: const Text('Call'),
              style: FilledButton.styleFrom(backgroundColor: _green),
            ),
        ],
      ),
    );
  }

  List<Widget> _preOrderSection(OrderTracking tracking) {
    final slot = tracking.preOrder;
    final title = tracking.isDelivered
        ? 'Pre-order delivered'
        : tracking.isCancelled
            ? 'Pre-order cancelled'
            : 'Scheduled delivery';
    return [
      _Card(
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                tracking.isDelivered ? Icons.check_circle : Icons.event_available,
                color: _green,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _slotLabel(slot),
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            _TypeChip(orderType: tracking.orderType),
          ],
        ),
      ),
      if (slot != null && slot.progress.isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          child: PreOrderProgressSteps(progress: slot.progress, label: slot.progressLabel),
        ),
      if (tracking.driver != null && !tracking.isClosed) _driverCard(tracking),
    ];
  }
}

String _slotLabel(PreOrderSlot? slot) {
  if (slot == null || (slot.date.isEmpty && slot.slot.isEmpty)) {
    return 'We will deliver in your selected slot';
  }
  final date = DateTime.tryParse(slot.date);
  final day = date != null ? DateFormat('EEE, d MMM').format(date) : slot.date;
  return [day, slot.slot].where((s) => s.isNotEmpty).join(' • ');
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.padding = const EdgeInsets.all(16)});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EAED)),
      ),
      child: child,
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({required this.orderType});

  final String orderType;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F8E9),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        OrderTypes.label(orderType),
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _green),
      ),
    );
  }
}

class _ConnectionBanner extends StatelessWidget {
  const _ConnectionBanner({required this.offline});

  final bool offline;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(offline ? Icons.wifi_off : Icons.sync_problem, size: 18, color: Colors.orange.shade800),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              offline ? 'You are offline. Live updates resume when you reconnect.' : 'Reconnecting to live updates…',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Colors.orange.shade900),
            ),
          ),
        ],
      ),
    );
  }
}

class _DelayBanner extends StatelessWidget {
  const _DelayBanner({required this.delay});

  final TrackingDelay delay;

  @override
  Widget build(BuildContext context) {
    final by = delay.expectedBy;
    final byText = by == null ? '' : ' · now expected by ${TimeOfDay.fromDateTime(by).format(context)}';
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3E0),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFCC80)),
      ),
      child: Row(
        children: [
          Icon(Icons.schedule, size: 20, color: Colors.orange.shade800),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Running about ${delay.label} late$byText. Sorry for the wait!',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.orange.shade900),
            ),
          ),
        ],
      ),
    );
  }
}

class _LastUpdated extends StatelessWidget {
  const _LastUpdated({required this.at});

  final DateTime at;

  @override
  Widget build(BuildContext context) {
    final seconds = DateTime.now().difference(at).inSeconds;
    final stale = seconds > 60;
    final label = seconds < 10
        ? 'Live'
        : seconds < 60
            ? 'Updated ${seconds}s ago'
            : 'Updated ${DateFormat('h:mm a').format(at)}';
    return Row(
      children: [
        Icon(Icons.circle, size: 8, color: stale ? Colors.orange : _green),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      ],
    );
  }
}

class _OtherPartNote extends StatelessWidget {
  const _OtherPartNote({required this.part});

  final TrackingPart part;

  @override
  Widget build(BuildContext context) {
    final isPreorder = part.orderType == OrderTypes.preorder;
    final progressLabel = part.preOrder?.progressLabel ?? '';
    final statusText = isPreorder && progressLabel.isNotEmpty ? progressLabel : part.status.replaceAll('_', ' ');
    final text = isPreorder
        ? 'Pre-order items arrive separately: ${_slotLabel(part.preOrder)} ($statusText)'
        : '${OrderTypes.label(part.orderType)} items in this order: $statusText';
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F7FA),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(isPreorder ? Icons.event_note : Icons.local_shipping_outlined, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 12.5, color: AppColors.textPrimary))),
        ],
      ),
    );
  }
}

double _metersBetween(LatLng a, LatLng b) {
  double rad(double deg) => deg * math.pi / 180;
  final dLat = rad(b.latitude - a.latitude);
  final dLng = rad(b.longitude - a.longitude);
  final h = math.pow(math.sin(dLat / 2), 2) +
      math.cos(rad(a.latitude)) * math.cos(rad(b.latitude)) * math.pow(math.sin(dLng / 2), 2);
  return 6371000 * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
}

double _pathMeters(List<LatLng> points) {
  var meters = 0.0;
  for (var i = 1; i < points.length; i++) {
    meters += _metersBetween(points[i - 1], points[i]);
  }
  return meters;
}
