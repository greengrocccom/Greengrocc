import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/l10n/app_l10n.dart';
import 'order_service.dart';
import 'socket_service.dart';

/// Streams the rider's GPS to customers over the socket for a ready-to-cook /
/// instant order from assignment (riding to the store) until delivery.
/// Pre-orders never stream (status updates only).
///
/// Runs as an Android foreground service (persistent notification) and with iOS
/// background location updates, so it keeps going when the app is minimised.
class LiveTrackingService extends ChangeNotifier {
  LiveTrackingService._();
  static final instance = LiveTrackingService._();

  static const int _distanceFilterMeters = 10;
  static const Duration _platformInterval = Duration(seconds: 4);
  /// Never emit more often than this, even if fixes arrive faster.
  static const Duration _minEmitGap = Duration(seconds: 3);
  /// Re-send the last fix this often while standing still (distance filter quiet).
  static const Duration _heartbeatEvery = Duration(seconds: 5);

  /// Server acks that mean "stop sending for this order".
  static const _terminalCodes = {'ORDER_CLOSED', 'NOT_TRACKABLE', 'NOT_ASSIGNED', 'FORBIDDEN'};

  final Set<String> _orderIds = {};
  final Set<String> _rejectedOrderIds = {};
  StreamSubscription<Position>? _positionSub;
  Timer? _heartbeat;
  Position? _lastPosition;
  DateTime? _lastEmitAt;
  bool _starting = false;
  String? _lastError;

  bool get isActive => _positionSub != null;
  Set<String> get trackedOrderIds => Set.unmodifiable(_orderIds);
  String? get lastError => _lastError;

  /// Called whenever the rider's active deliveries are refreshed.
  Future<void> syncWithDeliveries(List<ActiveDeliveryData> deliveries) async {
    final activeIds = deliveries.map((d) => d.id).toSet();
    _rejectedOrderIds.removeWhere((id) => !activeIds.contains(id));

    final wanted = deliveries
        .where((d) => d.shouldStreamLocation && !_rejectedOrderIds.contains(d.id))
        .map((d) => d.id)
        .toSet();
    if (setEquals(wanted, _orderIds) && (wanted.isEmpty || isActive || _starting)) return;

    final added = wanted.difference(_orderIds).isNotEmpty;
    _orderIds
      ..clear()
      ..addAll(wanted);

    if (_orderIds.isEmpty) {
      await _stopStream();
    } else if (!isActive) {
      await _startStream();
    } else if (added) {
      _emit(force: true);
    }
    notifyListeners();
  }

  /// Logout / app reset.
  Future<void> stop() async {
    _orderIds.clear();
    _rejectedOrderIds.clear();
    await _stopStream();
    notifyListeners();
  }

  Future<bool> _ensurePermissions() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      _lastError = appL10n.delTurnOnLocationForTracking;
      return false;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      _lastError = appL10n.delLocationPermissionForTracking;
      return false;
    }
    if (!kIsWeb && Platform.isAndroid) {
      // The foreground-service notification needs POST_NOTIFICATIONS on Android 13+.
      final notification = await Permission.notification.status;
      if (notification.isDenied) await Permission.notification.request();
    }
    return true;
  }

  LocationSettings _locationSettings() {
    if (!kIsWeb && Platform.isAndroid) {
      final l10n = appL10n;
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: _distanceFilterMeters,
        intervalDuration: _platformInterval,
        foregroundNotificationConfig: ForegroundNotificationConfig(
          notificationTitle: l10n.delTrackingNotificationTitle,
          notificationText: l10n.delTrackingNotificationText,
          notificationChannelName: l10n.delTrackingChannelName,
          enableWakeLock: true,
          setOngoing: true,
        ),
      );
    }
    if (!kIsWeb && Platform.isIOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        activityType: ActivityType.automotiveNavigation,
        distanceFilter: _distanceFilterMeters,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
        allowBackgroundLocationUpdates: true,
      );
    }
    return const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: _distanceFilterMeters,
    );
  }

  Future<void> _startStream() async {
    if (_starting || isActive) return;
    _starting = true;
    try {
      if (!await _ensurePermissions()) {
        debugPrint('[LiveTracking] not started: $_lastError');
        return;
      }
      if (_orderIds.isEmpty) return;
      _lastError = null;
      _positionSub = Geolocator.getPositionStream(locationSettings: _locationSettings()).listen(
        _onPosition,
        onError: (Object error) {
          _lastError = error.toString();
          debugPrint('[LiveTracking] position stream error: $error');
        },
      );
      _heartbeat = Timer.periodic(_heartbeatEvery, (_) => _emit());
      debugPrint('[LiveTracking] started for $_orderIds');
      try {
        final first = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
        );
        _onPosition(first);
      } catch (_) {
        // The stream delivers the first fix soon anyway.
      }
    } catch (error) {
      _lastError = error.toString();
      debugPrint('[LiveTracking] start failed: $error');
      await _stopStream();
    } finally {
      _starting = false;
    }
  }

  Future<void> _stopStream() async {
    _heartbeat?.cancel();
    _heartbeat = null;
    final sub = _positionSub;
    _positionSub = null;
    _lastPosition = null;
    _lastEmitAt = null;
    if (sub != null) {
      await sub.cancel();
      debugPrint('[LiveTracking] stopped');
    }
  }

  void _onPosition(Position position) {
    _lastPosition = position;
    _emit();
  }

  void _emit({bool force = false}) {
    final position = _lastPosition;
    if (position == null || _orderIds.isEmpty) return;
    final now = DateTime.now();
    if (!force && _lastEmitAt != null && now.difference(_lastEmitAt!) < _minEmitGap) return;
    _lastEmitAt = now;

    final moving = position.speed > 0.5;
    final heading = moving && position.heading >= 0 ? position.heading : null;
    final speed = position.speed >= 0 ? position.speed : null;

    for (final orderId in _orderIds.toList()) {
      SocketService.instance
          .emitDriverLocation(
            orderId: orderId,
            lat: position.latitude,
            lng: position.longitude,
            heading: heading,
            speed: speed,
          )
          .then((ack) => _handleAck(orderId, ack));
    }
  }

  void _handleAck(String orderId, Map<String, dynamic>? ack) {
    if (ack == null || ack['ok'] == true) return;
    final code = ack['code']?.toString() ?? '';
    debugPrint('[LiveTracking] $orderId rejected: $code ${ack['message'] ?? ''}');
    if (!_terminalCodes.contains(code)) return;
    _orderIds.remove(orderId);
    _rejectedOrderIds.add(orderId);
    if (_orderIds.isEmpty) unawaited(_stopStream());
    notifyListeners();
  }
}
