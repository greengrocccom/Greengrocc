import 'dart:convert';

import '../core/l10n/app_l10n.dart';

/// Pickup status flow, labels and QR payloads — mirrors the vendor web
/// driver portal (`vendor/src/utils/driverFlow.js`, `orderQr.js`, `batchQr.js`,
/// `components/pickup/PickupTimeline.jsx`) so both show the same thing.

const pickupTimelineSteps = <String>[
  'READY_FOR_PICKUP',
  'DRIVER_ASSIGNED',
  'DISPATCHED',
  'DRIVER_ARRIVED',
  'ORDER_VERIFIED',
  'QR_VERIFIED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED_AT_CENTRE',
  'COLLECTION_CENTRE_RECEIVED',
];

const _statusAlias = <String, String>{
  'PICKUP_SCHEDULED': 'DRIVER_ASSIGNED',
  'ARRIVED': 'DRIVER_ARRIVED',
  'COMPLETED': 'PICKED_UP',
  'PICKUP_CONFIRMED': 'PICKED_UP',
  'RECEIVED_AT_COLLECTION_CENTRE': 'COLLECTION_CENTRE_RECEIVED',
};

/// Display label for a pickup status code, in the rider's language.
String? _statusLabelFor(String code) {
  final l10n = appL10n;
  return switch (code) {
    'READY_FOR_PICKUP' => l10n.pkStatusReadyForPickup,
    'DRIVER_ASSIGNED' || 'PICKUP_SCHEDULED' => l10n.timelineAssigned,
    'DISPATCHED' => l10n.pkStatusOnTheWayToFarm,
    'DRIVER_ARRIVED' || 'ARRIVED' => l10n.pkStatusReachedFarm,
    'ORDER_VERIFIED' => l10n.pkStatusOrderChecked,
    'QR_VERIFIED' => l10n.pkStatusQrVerified,
    'PICKED_UP' || 'PICKUP_CONFIRMED' => l10n.pkStatusPickupConfirmed,
    'IN_TRANSIT' => l10n.pkStatusOnTheWayToCentre,
    'ARRIVED_AT_CENTRE' => l10n.pkStatusAtCollectionCentre,
    'COLLECTION_CENTRE_RECEIVED' ||
    'RECEIVED_AT_COLLECTION_CENTRE' =>
      l10n.pkStatusReceived,
    _ => null,
  };
}

/// English live-status texts sent by the server → status code.
const _liveStatusCodes = <String, String>{
  'Ready for pickup': 'READY_FOR_PICKUP',
  'Assigned': 'DRIVER_ASSIGNED',
  'Assigned — waiting to leave': 'DRIVER_ASSIGNED',
  'On the way to farm': 'DISPATCHED',
  'Reached the farm': 'DRIVER_ARRIVED',
  'Order checked': 'ORDER_VERIFIED',
  'Checking the order': 'ORDER_VERIFIED',
  'QR verified': 'QR_VERIFIED',
  'QR verified — confirm pickup': 'QR_VERIFIED',
  'Pickup confirmed': 'PICKED_UP',
  'On the way to centre': 'IN_TRANSIT',
  'On the way to collection centre': 'IN_TRANSIT',
  'Incoming': 'IN_TRANSIT',
  'At collection centre': 'ARRIVED_AT_CENTRE',
  'Received': 'COLLECTION_CENTRE_RECEIVED',
  'Delivered at collection centre': 'COLLECTION_CENTRE_RECEIVED',
};

const _afterTransitStatuses = <String>{
  'IN_TRANSIT',
  'ARRIVED_AT_CENTRE',
  'COLLECTION_CENTRE_RECEIVED',
  'RECEIVED_AT_COLLECTION_CENTRE',
};

String str(dynamic v) => v == null ? '' : '$v'.trim();

String pickupStatusLabel(dynamic status) {
  final key = str(status);
  if (key.isEmpty) return '';
  final label =
      _statusLabelFor(key) ?? _statusLabelFor(_liveStatusCodes[key] ?? '');
  if (label != null) return label;
  return key.replaceAll('_', ' ');
}

String pickupLiveLabel(Map<String, dynamic>? pickup) {
  if (pickup == null) return '';
  final key = str(pickup['status']);
  final label = _statusLabelFor(key);
  if (label != null) return label;
  final live = str(pickup['liveStatus']);
  return pickupStatusLabel(live.isNotEmpty ? live : key);
}

/// Index of [status] in [pickupTimelineSteps] (after aliasing), or -1.
int pickupTimelineIndex(dynamic status) {
  final key = str(status);
  return pickupTimelineSteps.indexOf(_statusAlias[key] ?? key);
}

bool isPickupFinished(Map<String, dynamic> p) {
  final s = str(p['status']);
  return s == 'COLLECTION_CENTRE_RECEIVED' ||
      s == 'RECEIVED_AT_COLLECTION_CENTRE';
}

class PickupStep {
  const PickupStep(this.key, this.label, this.hint);

  final String key;
  final String label;
  final String hint;

  /// Steps that can run straight from a list card (others need the detail page).
  bool get runsFromList =>
      key == 'start' ||
      key == 'arrive' ||
      key == 'transit' ||
      key == 'arriveCentre';
}

/// Newly assigned and the driver has not accepted or rejected it yet.
bool needsAcceptance(Map<String, dynamic>? p) {
  if (p == null) return false;
  final status = str(p['status']);
  return (status == 'DRIVER_ASSIGNED' || status == 'PICKUP_SCHEDULED') &&
      str(p['driverStatus']) != 'DRIVER_ACCEPTED';
}

PickupStep? driverNextStep(Map<String, dynamic>? pickup) {
  if (pickup == null) return null;
  final status = str(pickup['status']);
  final l10n = appL10n;
  if (needsAcceptance(pickup)) {
    return PickupStep(
        'accept', l10n.pkStepAcceptOrReject, l10n.pkHintOpenToAcceptOrReject);
  }
  if (status == 'DRIVER_ASSIGNED' || status == 'PICKUP_SCHEDULED') {
    return PickupStep('start', l10n.pkStepLeftForPickup,
        l10n.pkHintStatusWillBecome(l10n.pkStatusOnTheWayToFarm));
  }
  if (status == 'DISPATCHED') {
    return PickupStep('arrive', l10n.pkStatusReachedFarm,
        l10n.pkHintStatusWillBecome(l10n.pkStatusReachedFarm));
  }
  if (status == 'DRIVER_ARRIVED') {
    return PickupStep(
        'check', l10n.pkStepCheckOrder, l10n.pkHintOpenToVerifyOrder);
  }
  if (status == 'ORDER_VERIFIED') {
    return PickupStep(
        'scan', l10n.pkStepScanFarmerQr, l10n.pkHintOpenToScanQr);
  }
  if (status == 'QR_VERIFIED') {
    return PickupStep(
        'confirm', l10n.pkStepConfirmPickup, l10n.pkHintOpenToConfirmWithPhoto);
  }
  if (status == 'IN_TRANSIT') {
    return PickupStep('arriveCentre', l10n.pkStepReachedCollectionCentre,
        l10n.pkHintStatusWillBecome(l10n.pkStatusAtCollectionCentre));
  }
  if (status == 'PICKED_UP' ||
      status == 'PICKUP_CONFIRMED' ||
      (pickup['pickupConfirmed'] == true &&
          status != 'IN_TRANSIT' &&
          status != 'ARRIVED_AT_CENTRE')) {
    if (_afterTransitStatuses.contains(status)) return null;
    return PickupStep('transit', l10n.pkStatusOnTheWayToCentre,
        l10n.pkHintStatusWillBecome(l10n.pkStatusOnTheWayToCentre));
  }
  return null;
}

/// Statuses where the driver is at (or heading to) the farm and may scan.
const farmScanStatuses = <String>{
  'DRIVER_ASSIGNED',
  'PICKUP_SCHEDULED',
  'DISPATCHED',
  'DRIVER_ARRIVED',
  'ORDER_VERIFIED',
};

/// Finds which of the driver's [pickups] a scanned Farmer QR belongs to.
/// The server still checks the QR; this only picks the pickup to open.
Map<String, dynamic>? matchPickupForQr(
    String raw, List<Map<String, dynamic>> pickups) {
  final value = raw.trim();
  if (value.isEmpty) return null;
  final open = pickups
      .where((p) => farmScanStatuses.contains(str(p['status'])))
      .toList();

  final ids = <String>{};
  try {
    final json = jsonDecode(value);
    if (json is Map) {
      for (final k in const ['id', 'orderId', 'pickupId']) {
        if (str(json[k]).isNotEmpty) ids.add(str(json[k]));
      }
    }
  } catch (_) {}
  for (final re in [
    RegExp(r'GGC-ORD-[A-Za-z0-9-]+', caseSensitive: false),
    RegExp(r'(?:greengro(?:o|cc):order:|ggp\.order\.)([A-Za-z0-9_-]+)',
        caseSensitive: false),
  ]) {
    final m = re.firstMatch(value);
    if (m != null) ids.add(m.groupCount > 0 ? m.group(1)! : m.group(0)!);
  }

  bool matches(Map<String, dynamic> p) {
    final keys = [p['id'], p['pickupId'], p['orderId'], p['orderDisplayId']]
        .map(str)
        .where((k) => k.isNotEmpty);
    return keys.any((k) => ids.contains(k) || (k.length >= 6 && value.contains(k)));
  }

  final hit = open.where(matches).toList();
  if (hit.isNotEmpty) return hit.first;
  final atFarm = open
      .where((p) => const {'DRIVER_ARRIVED', 'ORDER_VERIFIED'}
          .contains(str(p['status'])))
      .toList();
  return atFarm.length == 1 ? atFarm.first : null;
}

bool canTransit(Map<String, dynamic> p) {
  final s = str(p['status']);
  return (s == 'PICKED_UP' ||
          s == 'PICKUP_CONFIRMED' ||
          p['pickupConfirmed'] == true) &&
      !_afterTransitStatuses.contains(s);
}

// ── Formatting helpers ─────────────────────────────────────────────────────

String pickupOrderId(Map<String, dynamic> p) {
  final display = str(p['orderDisplayId']);
  if (display.isNotEmpty) return display;
  final order = str(p['orderId']);
  return order.isNotEmpty ? order : str(p['id']);
}

/// Common units in the rider's language; anything else is shown as sent.
String pickupUnitText(String unit) {
  final l10n = appL10n;
  if (l10n.localeName.startsWith('en')) return unit;
  return switch (unit.trim().toLowerCase()) {
    'kg' || 'kgs' || 'kilo' || 'kilos' || 'kilogram' || 'kilograms' =>
      l10n.pkUnitKg,
    'g' || 'gm' || 'gms' || 'gram' || 'grams' => l10n.pkUnitGram,
    'quintal' || 'quintals' || 'qtl' => l10n.pkUnitQuintal,
    'ton' || 'tons' || 'tonne' || 'tonnes' => l10n.pkUnitTon,
    'crate' || 'crates' => l10n.pkUnitCrate,
    'box' || 'boxes' => l10n.pkUnitBox,
    'bag' || 'bags' => l10n.pkUnitBag,
    'piece' || 'pieces' || 'pc' || 'pcs' || 'nos' => l10n.pkUnitPiece,
    'dozen' || 'dozens' => l10n.pkUnitDozen,
    'bunch' || 'bunches' => l10n.pkUnitBunch,
    _ => unit,
  };
}

String pickupQuantity(Map<String, dynamic> p, {bool ordered = false}) {
  final unit = pickupUnitText(str(p['unit']).isEmpty ? 'Kg' : str(p['unit']));
  final raw = ordered
      ? p['orderedQuantity']
      : (_nonZero(p['packedQuantity']) ?? p['expectedQuantity']);
  final qty = raw == null || str(raw).isEmpty ? '0' : str(raw);
  return '$qty $unit';
}

dynamic _nonZero(dynamic v) {
  if (v == null) return null;
  final n = num.tryParse('$v');
  if (n == null || n == 0) return null;
  return v;
}

String pickupWhenText(Map<String, dynamic> p) {
  final date = str(p['pickupDate']).isNotEmpty
      ? str(p['pickupDate'])
      : str(p['scheduledDate']);
  final time = str(p['pickupTime']).isNotEmpty
      ? str(p['pickupTime'])
      : str(p['scheduledTime']);
  return '$date $time'.trim();
}

int pickupUpdatedMillis(Map<String, dynamic> p) {
  for (final key in const [
    'updatedAt',
    'pickupConfirmedAt',
    'assignedAt',
    'createdAt'
  ]) {
    final dt = DateTime.tryParse(str(p[key]));
    if (dt != null) return dt.millisecondsSinceEpoch;
  }
  return 0;
}

String formatVehicleId(dynamic vehicleId, dynamic vehicleNumber) {
  final id = str(vehicleId);
  if (id.isNotEmpty) return id;
  return str(vehicleNumber);
}

// ── Items in the order (what the driver checks at the farm) ────────────────

class PickupItem {
  const PickupItem({
    required this.name,
    required this.grade,
    required this.quantity,
    required this.unit,
    required this.price,
    required this.total,
  });

  final String name;
  final String grade;
  final num quantity;
  final String unit;
  final num price;
  final num total;
}

num _num(dynamic v) => v is num ? v : num.tryParse(str(v)) ?? 0;

String _gradeText(dynamic v) {
  final s = str(v);
  if (s.isEmpty) return '';
  final grade = s.toLowerCase().startsWith('grade') ? s.substring(5).trim() : s;
  return grade.isEmpty ? s : appL10n.pkGradeValue(grade);
}

List<PickupItem> pickupItems(Map<String, dynamic> p) {
  final unit = pickupUnitText(str(p['unit']).isEmpty ? 'Kg' : str(p['unit']));
  final productName = [str(p['productName']), str(p['variety'])]
      .where((s) => s.isNotEmpty)
      .join(' · ');
  final items = <PickupItem>[];

  final products = p['products'];
  if (products is List) {
    for (final raw in products.whereType<Map>()) {
      final row = Map<String, dynamic>.from(raw);
      final qty = _num(row['quantity'] ?? row['qty']);
      final price = _num(row['price'] ?? row['pricePerKg']);
      final total = _num(row['total']);
      items.add(PickupItem(
        name: str(row['name']).isNotEmpty ? str(row['name']) : productName,
        grade: _gradeText(row['grade']),
        quantity: qty,
        unit: str(row['unit']).isEmpty ? unit : pickupUnitText(str(row['unit'])),
        price: price,
        total: total > 0 ? total : qty * price,
      ));
    }
  }

  if (items.isEmpty && p['grades'] is List) {
    for (final raw in (p['grades'] as List).whereType<Map>()) {
      final row = Map<String, dynamic>.from(raw);
      final qty = _num(row['quantity'] ?? row['qty'] ?? row['orderedQuantity']);
      if (qty <= 0) continue;
      final price = _num(row['price'] ?? row['pricePerKg']);
      final total = _num(row['total'] ?? row['amount']);
      items.add(PickupItem(
        name: productName,
        grade: _gradeText(row['label'] ?? row['grade'] ?? row['name']),
        quantity: qty,
        unit: unit,
        price: price,
        total: total > 0 ? total : qty * price,
      ));
    }
  }

  if (items.isEmpty) {
    final qty = _num(p['orderedQuantity']) > 0
        ? _num(p['orderedQuantity'])
        : _num(p['expectedQuantity']);
    final price = _num(p['price']);
    final value = _num(p['orderValue']);
    items.add(PickupItem(
      name: productName.isEmpty ? appL10n.pkProduce : productName,
      grade: _gradeText(p['grade']),
      quantity: qty,
      unit: unit,
      price: price,
      total: value > 0 ? value : qty * price,
    ));
  }
  return items;
}

String formatQty(num v) {
  if (v == v.roundToDouble()) return v.toInt().toString();
  return v.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '');
}

String formatRupees(num v) {
  if (v <= 0) return '—';
  final whole = v.round().toString();
  if (whole.length <= 3) return '₹$whole';
  final last3 = whole.substring(whole.length - 3);
  var rest = whole.substring(0, whole.length - 3);
  final groups = <String>[];
  while (rest.length > 2) {
    groups.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) groups.insert(0, rest);
  return '₹${groups.join(',')},$last3';
}

// ── QR payloads ────────────────────────────────────────────────────────────

Map<String, dynamic> _compact(Map<String, dynamic> obj) {
  final out = <String, dynamic>{};
  obj.forEach((key, value) {
    if (value == null) return;
    if (value is String && value.isEmpty) return;
    if (value is List && value.isEmpty) return;
    out[key] = value;
  });
  return out;
}

Map<String, dynamic>? parseQrJson(dynamic payload) {
  final raw = str(payload);
  if (!raw.startsWith('{')) return null;
  try {
    final parsed = jsonDecode(raw);
    if (parsed is Map) return Map<String, dynamic>.from(parsed);
  } catch (_) {}
  return null;
}

String _first(List<dynamic> values) {
  for (final v in values) {
    final s = str(v);
    if (s.isNotEmpty) return s;
  }
  return '';
}

String parseOrderQrPayload(dynamic payload) {
  final json = parseQrJson(payload);
  if (json != null) {
    if (json['t'] == 'batch') return '';
    return _first([json['id'], json['orderId']]);
  }
  final raw = str(payload);
  if (raw.isEmpty) return '';
  final uri = Uri.tryParse(raw);
  if (uri != null && uri.hasScheme && uri.host.isNotEmpty) {
    final scan = RegExp(r'/scan/([^/]+)', caseSensitive: false)
        .firstMatch(uri.path);
    if (scan != null) {
      return parseOrderQrPayload(Uri.decodeComponent(scan.group(1)!));
    }
    final q = uri.queryParameters['q'] ??
        uri.queryParameters['order'] ??
        uri.queryParameters['code'];
    if (q != null && q.isNotEmpty) return parseOrderQrPayload(q);
  }
  final biz =
      RegExp(r'(GGC-ORD-[A-Za-z0-9-]+)', caseSensitive: false).firstMatch(raw);
  if (biz != null) return biz.group(1)!;
  final tagged = RegExp(r'(?:greengro(?:o|cc):order:|ggp\.order\.)([A-Za-z0-9_-]+)',
          caseSensitive: false)
      .firstMatch(raw);
  if (tagged != null) return tagged.group(1)!;
  return raw.replaceFirst(RegExp(r'^order[:#\s]+', caseSensitive: false), '').trim();
}

/// Same compact JSON the vendor web encodes in "Show order QR".
String buildOrderQrPayload(Map<String, dynamic> record) {
  final existing = parseQrJson(record['qrPayload']);
  final pickup = record['pickup'] is Map
      ? Map<String, dynamic>.from(record['pickup'] as Map)
      : <String, dynamic>{};
  var id = parseOrderQrPayload(_first([
    record['qrPayload'],
    record['orderDisplayId'],
    record['orderId'],
    record['id'],
    pickup['orderId'],
  ]));
  if (id.isEmpty) {
    id = _first([record['orderDisplayId'], record['orderId'], record['id']]);
  }
  if (id.isEmpty) return existing != null ? jsonEncode(existing) : '';

  num? qty;
  for (final v in [
    record['packedQuantity'],
    pickup['packedQuantity'],
    record['expectedQuantity'],
    record['orderedQuantity'],
    record['quantity'],
    existing?['qty'],
  ]) {
    if (v != null) {
      qty = num.tryParse('$v');
      break;
    }
  }
  final pkgs = num.tryParse(_first([
    record['packageCount'],
    pickup['packageCount'],
    existing?['pkgs'],
  ]));
  final loc = _first([
    record['pickupLocation'],
    record['farmerLocation'],
    record['farmLocation'],
    pickup['pickupLocation'],
    existing?['loc'],
  ]);

  return jsonEncode(_compact({
    'v': 1,
    't': 'order',
    'id': id,
    'pickupId': _first([
      record['pickupId'],
      pickup['id'],
      pickup['pickupId'],
      existing?['pickupId'],
    ]),
    'batchId': _first([
      record['collectionBatchId'],
      record['lotId'],
      record['batchId'],
      pickup['collectionBatchId'],
      existing?['batchId'],
    ]),
    'farmerId': _first([record['farmerId'], existing?['farmerId']]),
    'farmer': _first([record['farmerName'], existing?['farmer']]),
    'mobile': _first(
        [record['farmerMobile'], pickup['farmerMobile'], existing?['mobile']]),
    'loc': loc.length > 100 ? loc.substring(0, 100) : loc,
    'product': _first(
        [record['productName'], record['name'], existing?['product']]),
    'productId': _first([record['productId'], existing?['productId']]),
    'variety': _first([record['variety'], existing?['variety']]),
    'grade': _first([record['grade'], existing?['grade']]),
    'qty': qty != null && qty > 0 ? qty : null,
    'pkgs': pkgs != null && pkgs != 0 ? pkgs : null,
    'unit': _first([record['unit'], existing?['unit']]),
    'date': _first([
      record['orderDate'],
      record['scheduledDate'],
      record['pickupDate'],
      record['harvestDate'],
      pickup['pickupDate'],
      existing?['date'],
    ]),
    'time': _first([
      record['scheduledTime'],
      record['pickupTime'],
      pickup['pickupTime'],
      existing?['time'],
    ]),
    'centre': _first([
      record['collectionCentreName'],
      record['collectionCentre'],
      pickup['collectionCentreName'],
      existing?['centre'],
    ]),
    'driverId':
        _first([record['driverId'], pickup['driverId'], existing?['driverId']]),
    'driver': _first(
        [record['driverName'], pickup['driverName'], existing?['driver']]),
    'vehicle': _first([
      record['vehicleNumber'],
      pickup['vehicleNumber'],
      existing?['vehicle'],
    ]),
    'vehicleId': _first(
        [record['vehicleId'], pickup['vehicleId'], existing?['vehicleId']]),
  }));
}

String parseBatchQrPayload(dynamic payload) {
  final json = parseQrJson(payload);
  if (json != null) {
    if (json['t'] == 'order') return str(json['batchId']);
    return _first([json['id'], json['batchId'], json['lotId']]);
  }
  final raw = str(payload);
  if (raw.isEmpty) return '';
  final uri = Uri.tryParse(raw);
  if (uri != null && uri.hasScheme && uri.host.isNotEmpty) {
    final batch = RegExp(r'/batches/([^/]+)', caseSensitive: false)
        .firstMatch(uri.path);
    if (batch != null) return Uri.decodeComponent(batch.group(1)!);
    final q = uri.queryParameters['q'] ??
        uri.queryParameters['batch'] ??
        uri.queryParameters['code'];
    if (q != null && q.isNotEmpty) return parseBatchQrPayload(q);
  }
  final biz =
      RegExp(r'(GGC-BAT-[A-Za-z0-9-]+)', caseSensitive: false).firstMatch(raw);
  if (biz != null) return biz.group(1)!;
  final tagged = RegExp(r'(?:greengro(?:o|cc):batch:|ggp\.batch\.)([A-Za-z0-9_-]+)',
          caseSensitive: false)
      .firstMatch(raw);
  if (tagged != null) return tagged.group(1)!;
  return raw.replaceFirst(RegExp(r'^batch[:#\s]+', caseSensitive: false), '').trim();
}

/// Same compact JSON the vendor web encodes in "Show batch QR".
String buildBatchQrPayload(Map<String, dynamic> record, [String batchId = '']) {
  final existing = parseQrJson(record['qrPayload']);
  var id = parseBatchQrPayload(_first([
    record['qrPayload'],
    record['batchId'],
    record['lotId'],
    record['collectionBatchId'],
    batchId,
  ]));
  if (id.isEmpty) {
    id = _first([
      batchId,
      record['batchId'],
      record['lotId'],
      record['collectionBatchId'],
    ]);
  }
  if (id.isEmpty) return existing != null ? jsonEncode(existing) : '';

  final pickups = record['pickups'] is List
      ? (record['pickups'] as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList()
      : <Map<String, dynamic>>[];
  List<String> uniq(Iterable<dynamic> values) =>
      values.map(str).where((s) => s.isNotEmpty).toSet().toList();

  final farmers = record['farmers'] is List && (record['farmers'] as List).isNotEmpty
      ? uniq(record['farmers'] as List)
      : uniq(pickups.map((p) => p['farmerName']));
  final products =
      record['products'] is List && (record['products'] as List).isNotEmpty
          ? uniq(record['products'] as List)
          : uniq(pickups.map((p) => p['productName']));
  final first = pickups.isNotEmpty ? pickups.first : record;
  final driver = first['driver'] is Map
      ? Map<String, dynamic>.from(first['driver'] as Map)
      : <String, dynamic>{};
  final orderIds = uniq([
    if (record['orderIds'] is List) ...(record['orderIds'] as List),
    ...pickups.map((p) => _first([p['orderDisplayId'], p['orderId']])),
  ]);
  final orderCount = pickups.isNotEmpty
      ? pickups.length
      : (record['orderCount'] ?? existing?['orders']);

  return jsonEncode(_compact({
    'v': 1,
    't': 'batch',
    'id': id,
    'orders': orderCount,
    'orderIds': orderIds.take(20).toList(),
    'farmers': farmers.isNotEmpty ? farmers : existing?['farmers'],
    'products': products.isNotEmpty ? products : existing?['products'],
    'driverId': _first([
      record['driverId'],
      first['driverId'],
      driver['id'],
      driver['driverId'],
      existing?['driverId'],
    ]),
    'driver': _first([
      record['driverName'],
      first['driverName'],
      driver['name'],
      existing?['driver'],
    ]),
    'vehicleId': _first([
      record['vehicleId'],
      first['vehicleId'],
      driver['vehicleId'],
      existing?['vehicleId'],
    ]),
    'vehicle': _first([
      record['vehicleNumber'],
      first['vehicleNumber'],
      driver['vehicleNumber'],
      existing?['vehicle'],
    ]),
    'centre': _first([
      record['collectionCentreName'],
      first['collectionCentreName'],
      existing?['centre'],
    ]),
  }));
}

String orderQrLabel(String payload) {
  final id = parseOrderQrPayload(payload);
  return id.isNotEmpty ? 'greengrocc:order:$id' : payload;
}

String batchQrLabel(String payload) {
  final id = parseBatchQrPayload(payload);
  return id.isNotEmpty ? 'greengrocc:batch:$id' : payload;
}

String orderQrFacts(String payload) {
  final json = parseQrJson(payload);
  if (json == null || json['t'] == 'batch') return '';
  final qty = json['qty'] != null
      ? '${json['qty']}${str(json['unit']).isNotEmpty ? ' ${pickupUnitText(str(json['unit']))}' : ''}'
      : '';
  return [json['farmer'], json['product'], json['variety'], qty, json['centre']]
      .map(str)
      .where((s) => s.isNotEmpty)
      .join(' · ');
}

String batchQrFacts(String payload) {
  final json = parseQrJson(payload);
  if (json == null || json['t'] == 'order') return '';
  String joined(dynamic v) => v is List ? v.map(str).join(', ') : str(v);
  return [
    joined(json['farmers']),
    joined(json['products']),
    json['orders'] != null ? appL10n.pkOrdersCount(str(json['orders'])) : '',
    str(json['driver']),
    str(json['vehicle']),
  ].where((s) => s.isNotEmpty).join(' · ');
}
