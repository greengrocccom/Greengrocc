import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Order types from the backend. Only ready_to_cook and instant have a live map.
class OrderTypes {
  OrderTypes._();
  static const readyToCook = 'ready_to_cook';
  static const instant = 'instant';
  static const preorder = 'preorder';

  static bool isTrackable(String type) => type == readyToCook || type == instant;

  static String label(String type) {
    switch (type) {
      case readyToCook:
        return 'Ready to Cook';
      case preorder:
        return 'Pre-order';
      default:
        return 'Instant';
    }
  }
}

const trackingStepKeys = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];

double? _toDouble(dynamic value) => value is num ? value.toDouble() : double.tryParse('$value');

LatLng? _latLng(dynamic raw) {
  if (raw is! Map) return null;
  final lat = _toDouble(raw['lat']);
  final lng = _toDouble(raw['lng']);
  if (lat == null || lng == null) return null;
  return LatLng(lat, lng);
}

DateTime? _date(dynamic raw) => raw == null ? null : DateTime.tryParse('$raw')?.toLocal();

class TrackingStep {
  const TrackingStep({
    required this.key,
    required this.label,
    required this.done,
    required this.current,
    this.at,
  });

  final String key;
  final String label;
  final bool done;
  final bool current;
  final DateTime? at;

  factory TrackingStep.fromJson(Map<String, dynamic> json) => TrackingStep(
        key: json['key']?.toString() ?? '',
        label: json['label']?.toString() ?? '',
        done: json['done'] == true,
        current: json['current'] == true,
        at: _date(json['at']),
      );
}

class TrackingDriver {
  const TrackingDriver({
    required this.name,
    required this.phone,
    this.vehicleType = 'Bike',
    this.vehicleNumber = '',
    this.rating = 0.0,
    this.totalDeliveries = 0,
  });

  final String name;
  final String phone;
  final String vehicleType;
  final String vehicleNumber;
  final double rating;
  final int totalDeliveries;

  factory TrackingDriver.fromJson(Map<String, dynamic> json) => TrackingDriver(
        name: json['name']?.toString() ?? '',
        phone: json['phone']?.toString() ?? '',
        vehicleType: json['vehicleType']?.toString().isNotEmpty == true
            ? json['vehicleType'].toString()
            : 'Bike',
        vehicleNumber: json['vehicleNumber']?.toString().isNotEmpty == true
            ? json['vehicleNumber'].toString()
            : '',
        rating: _toDouble(json['rating']) ?? 0.0,
        totalDeliveries: (json['totalDeliveries'] as num?)?.toInt() ?? 0,
      );
}

class DriverFix {
  const DriverFix({required this.position, this.heading, this.updatedAt});

  final LatLng position;
  final double? heading;
  final DateTime? updatedAt;

  static DriverFix? fromJson(dynamic raw) {
    final position = _latLng(raw);
    if (position == null) return null;
    final map = raw as Map;
    return DriverFix(
      position: position,
      heading: _toDouble(map['heading']),
      updatedAt: _date(map['updatedAt']),
    );
  }
}

class TrackingEta {
  const TrackingEta({
    required this.seconds,
    required this.text,
    required this.distanceMeters,
    required this.fromStore,
  });

  final int seconds;
  final String text;
  final int distanceMeters;
  /// Rider hasn't picked up yet; ETA is measured from the dark store.
  final bool fromStore;

  static TrackingEta? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    return TrackingEta(
      seconds: (raw['seconds'] as num?)?.toInt() ?? 0,
      text: raw['text']?.toString() ?? '',
      distanceMeters: (raw['distanceMeters'] as num?)?.toInt() ?? 0,
      fromStore: raw['fromStore'] == true,
    );
  }
}

class PreOrderSlot {
  const PreOrderSlot({
    required this.date,
    required this.slot,
    this.progress = '',
    this.progressLabel = '',
  });

  final String date;
  final String slot;
  /// `awaiting_vendor`, `confirmed`, `preparing`, `dispatched`, `at_store`, `rider_assigned`, …
  final String progress;
  final String progressLabel;

  static PreOrderSlot? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    return PreOrderSlot(
      date: raw['date']?.toString() ?? '',
      slot: raw['slot']?.toString() ?? '',
      progress: raw['progress']?.toString() ?? '',
      progressLabel: raw['progressLabel']?.toString() ?? '',
    );
  }
}

class TrackingPart {
  const TrackingPart({
    required this.part,
    required this.orderType,
    required this.status,
    this.preOrder,
  });

  final String part;
  final String orderType;
  final String status;
  final PreOrderSlot? preOrder;

  factory TrackingPart.fromJson(Map<String, dynamic> json) => TrackingPart(
        part: json['part']?.toString() ?? '',
        orderType: json['orderType']?.toString() ?? OrderTypes.instant,
        status: json['status']?.toString() ?? 'placed',
        preOrder: PreOrderSlot.fromJson(json['preOrder']),
      );
}

class OrderTracking {
  const OrderTracking({
    required this.orderId,
    required this.storeOrderId,
    required this.orderNumber,
    required this.orderType,
    required this.trackingEnabled,
    required this.liveTracking,
    required this.status,
    required this.timeline,
    required this.otherParts,
    required this.refreshRouteSeconds,
    this.riderPhase,
    this.preOrder,
    this.driver,
    this.storeName,
    this.storeLocation,
    this.destination,
    this.lastLocation,
    this.eta,
    this.routePolyline,
    this.delay,
  });

  final String orderId;
  final String? storeOrderId;
  final String orderNumber;
  final String orderType;
  /// Order type allows the live map (ready_to_cook / instant home delivery).
  final bool trackingEnabled;
  /// A rider is assigned and streaming GPS right now.
  final bool liveTracking;
  /// `to_store` while the rider rides to the dark store, `to_customer` once it has the parcel.
  final String? riderPhase;
  /// placed | confirmed | packed | out_for_delivery | delivered | cancelled
  final String status;
  final List<TrackingStep> timeline;
  final List<TrackingPart> otherParts;
  final int refreshRouteSeconds;
  final PreOrderSlot? preOrder;
  final TrackingDriver? driver;
  final String? storeName;
  final LatLng? storeLocation;
  final LatLng? destination;
  final DriverFix? lastLocation;
  final TrackingEta? eta;
  final String? routePolyline;
  /// Delay the store forwarded to the customer (null when on time).
  final TrackingDelay? delay;

  bool get riderToStore => liveTracking && riderPhase == 'to_store';
  bool get isDelivered => status == 'delivered';
  bool get isCancelled => status == 'cancelled';
  bool get isClosed => isDelivered || isCancelled;
  /// Never show a map for pre-orders, even if the backend flag were wrong.
  bool get showLiveMap => trackingEnabled && OrderTypes.isTrackable(orderType);

  factory OrderTracking.fromJson(Map<String, dynamic> json) {
    final store = json['store'];
    final orderType = json['orderType']?.toString() ?? OrderTypes.instant;
    return OrderTracking(
      orderId: json['orderId']?.toString() ?? '',
      storeOrderId: json['storeOrderId']?.toString(),
      orderNumber: json['orderNumber']?.toString() ?? '',
      orderType: orderType,
      trackingEnabled: json['trackingEnabled'] == true && OrderTypes.isTrackable(orderType),
      liveTracking: json['liveTracking'] == true,
      riderPhase: json['riderPhase']?.toString(),
      status: json['status']?.toString() ?? 'placed',
      timeline: (json['timeline'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => TrackingStep.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      otherParts: (json['otherParts'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => TrackingPart.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      refreshRouteSeconds: (json['refreshRouteSeconds'] as num?)?.toInt() ?? 45,
      preOrder: PreOrderSlot.fromJson(json['preOrder']),
      driver: json['driver'] is Map
          ? TrackingDriver.fromJson(Map<String, dynamic>.from(json['driver'] as Map))
          : null,
      storeName: store is Map ? store['name']?.toString() : null,
      storeLocation: _latLng(store),
      destination: _latLng(json['destination']),
      lastLocation: DriverFix.fromJson(json['lastLocation']),
      eta: TrackingEta.fromJson(json['eta']),
      routePolyline: json['route'] is Map ? (json['route'] as Map)['polyline']?.toString() : null,
      delay: TrackingDelay.fromJson(json['delay']),
    );
  }

  /// Apply an `order_status` socket event before the full refetch completes.
  OrderTracking withStatus(String nextStatus, {bool? live, String? phase}) {
    final reached = trackingStepKeys.indexOf(nextStatus);
    final steps = reached < 0
        ? timeline
        : [
            for (var i = 0; i < trackingStepKeys.length; i++)
              TrackingStep(
                key: trackingStepKeys[i],
                label: i < timeline.length ? timeline[i].label : trackingStepKeys[i],
                done: i <= reached,
                current: i == reached,
                at: i < timeline.length && timeline[i].at != null
                    ? timeline[i].at
                    : (i == reached ? DateTime.now() : null),
              ),
          ];
    return OrderTracking(
      orderId: orderId,
      storeOrderId: storeOrderId,
      orderNumber: orderNumber,
      orderType: orderType,
      trackingEnabled: trackingEnabled,
      liveTracking: live ?? liveTracking,
      riderPhase: live == null ? riderPhase : phase,
      status: nextStatus,
      timeline: steps,
      otherParts: otherParts,
      refreshRouteSeconds: refreshRouteSeconds,
      preOrder: preOrder,
      driver: driver,
      storeName: storeName,
      storeLocation: storeLocation,
      destination: destination,
      lastLocation: lastLocation,
      eta: eta,
      routePolyline: routePolyline,
      delay: delay,
    );
  }

  OrderTracking withAccurateEta({
    required String text,
    required int distanceMeters,
    required int seconds,
  }) {
    return OrderTracking(
      orderId: orderId,
      storeOrderId: storeOrderId,
      orderNumber: orderNumber,
      orderType: orderType,
      trackingEnabled: trackingEnabled,
      liveTracking: liveTracking,
      riderPhase: riderPhase,
      status: status,
      timeline: timeline,
      otherParts: otherParts,
      refreshRouteSeconds: refreshRouteSeconds,
      preOrder: preOrder,
      driver: driver,
      storeName: storeName,
      storeLocation: storeLocation,
      destination: destination,
      lastLocation: lastLocation,
      eta: TrackingEta(
        seconds: seconds,
        text: text,
        distanceMeters: distanceMeters,
        fromStore: eta?.fromStore ?? (lastLocation == null),
      ),
      routePolyline: routePolyline,
      delay: delay,
    );
  }
}

class TrackingDelay {
  const TrackingDelay({required this.minutes, this.expectedBy});

  final int minutes;
  final DateTime? expectedBy;

  String get label {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h == 0) return '$m min';
    return m == 0 ? '$h hr' : '$h hr $m min';
  }

  static TrackingDelay? fromJson(dynamic json) {
    if (json is! Map) return null;
    final minutes = (json['minutes'] as num?)?.toInt() ?? 0;
    if (minutes <= 0) return null;
    return TrackingDelay(
      minutes: minutes,
      expectedBy: DateTime.tryParse('${json['expectedBy'] ?? ''}')?.toLocal(),
    );
  }
}
