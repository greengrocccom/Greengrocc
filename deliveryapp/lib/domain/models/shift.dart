enum ShiftStatus { booked, available, full, cancelled, ended, fewSpotsLeft }

/// A single KM-based earning slab for delivery riders.
/// Example: minKm=2, maxKm=5, riderAmount=50 means ₹50 for any delivery between 2–5 KM.
class DeliveryEarningSlab {
  const DeliveryEarningSlab({
    required this.minKm,
    required this.maxKm,
    required this.riderAmount,
    this.id,
  });

  final String? id;
  final double minKm;
  final double maxKm;
  final double riderAmount;

  String get label => '${_fmt(minKm)} – ${_fmt(maxKm)} KM';
  String get amountLabel => '₹${riderAmount.toStringAsFixed(0)}';

  static String _fmt(double v) =>
      v == v.truncateToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);

  factory DeliveryEarningSlab.fromJson(Map<String, dynamic> json) =>
      DeliveryEarningSlab(
        id: json['id'] as String?,
        minKm: (json['minKm'] as num?)?.toDouble() ?? 0,
        maxKm: (json['maxKm'] as num?)?.toDouble() ?? 0,
        riderAmount: (json['riderAmount'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'minKm': minKm,
        'maxKm': maxKm,
        'riderAmount': riderAmount,
      };
}

class ShiftSlot {
  const ShiftSlot({
    required this.id,
    required this.slotId,
    required this.shiftId,
    required this.startTime,
    required this.endTime,
    required this.capacity,
    required this.bookedCount,
    required this.status,
    this.shiftName,
    this.shiftType,
    this.storeName,
    this.dateString,
    this.isBookedByMe = false,
    this.remainingCapacity = 0,
  });

  final String id;
  final String slotId;
  final String shiftId;
  final String startTime;
  final String endTime;
  final int capacity;
  final int bookedCount;
  final String status; // AVAILABLE, FEW_SPOTS_LEFT, FULL, CANCELLED, ENDED
  final String? shiftName;
  final String? shiftType;
  final String? storeName;
  final String? dateString;
  final bool isBookedByMe;
  final int remainingCapacity;

  bool get isAvailable =>
      status == 'AVAILABLE' || status == 'FEW_SPOTS_LEFT';
  bool get isFull => status == 'FULL';
  bool get isCancelled => status == 'CANCELLED';
  bool get isEnded => status == 'ENDED';

  factory ShiftSlot.fromJson(Map<String, dynamic> json) => ShiftSlot(
        id: json['id'] as String? ?? json['slotId'] as String? ?? '',
        slotId: json['slotId'] as String? ?? json['id'] as String? ?? '',
        shiftId: json['shiftId'] as String? ?? '',
        startTime: json['startTime'] as String? ?? '',
        endTime: json['endTime'] as String? ?? '',
        capacity: json['capacity'] as int? ?? 0,
        bookedCount: json['bookedCount'] as int? ?? 0,
        status: json['status'] as String? ?? 'AVAILABLE',
        shiftName: json['shiftName'] as String?,
        shiftType: json['shiftType'] as String?,
        storeName: json['storeName'] as String?,
        dateString: json['dateString'] as String?,
        isBookedByMe: json['isBookedByMe'] as bool? ?? false,
        remainingCapacity:
            json['remainingCapacity'] as int? ?? json['spotsRemaining'] as int? ?? 0,
      );
}

class Shift {
  const Shift({
    required this.id,
    required this.shiftId,
    required this.name,
    required this.type,
    required this.dateString,
    required this.slots,
    this.deliveryEarningSlabs = const [],
    this.managerId,
    this.storeId,
    this.isCustomized = false,
    this.date,
    // Legacy fields for backward compatibility
    this.dateLabel,
    this.timeRange,
    this.area,
    this.status,
    this.earningPotential,
    this.ordersExpected,
  });

  final String id;
  final String shiftId;
  final String name;
  final String type;
  final String dateString;
  final List<ShiftSlot> slots;
  final List<DeliveryEarningSlab> deliveryEarningSlabs;
  final String? managerId;
  final String? storeId;
  final bool isCustomized;
  final DateTime? date;

  // Legacy/backward-compat fields
  final String? dateLabel;
  final String? timeRange;
  final String? area;
  final ShiftStatus? status;
  final String? earningPotential;
  final int? ordersExpected;

  bool get hasEarningSlabs => deliveryEarningSlabs.isNotEmpty;
  bool get isAvailable =>
      status == ShiftStatus.available || slots.any((s) => s.isAvailable);

  /// Find the earning for a given delivery distance
  DeliveryEarningSlab? slabForDistance(double distanceKm) {
    for (final slab in deliveryEarningSlabs) {
      if (distanceKm >= slab.minKm && distanceKm < slab.maxKm) return slab;
    }
    // If beyond all slabs, return highest slab
    if (deliveryEarningSlabs.isNotEmpty && distanceKm >= deliveryEarningSlabs.last.minKm) {
      return deliveryEarningSlabs.reduce(
          (a, b) => a.maxKm > b.maxKm ? a : b);
    }
    return null;
  }

  factory Shift.fromJson(Map<String, dynamic> json) {
    final slabsList = (json['deliveryEarningSlabs'] as List<dynamic>? ?? [])
        .map((e) => DeliveryEarningSlab.fromJson(e as Map<String, dynamic>))
        .toList();

    final slotsList = (json['slots'] as List<dynamic>? ?? [])
        .map((e) => ShiftSlot.fromJson(e as Map<String, dynamic>))
        .toList();

    return Shift(
      id: json['id'] as String? ?? json['shiftId'] as String? ?? '',
      shiftId: json['shiftId'] as String? ?? json['id'] as String? ?? '',
      name: json['name'] as String? ?? json['shiftName'] as String? ?? '',
      type: json['type'] as String? ?? json['shiftType'] as String? ?? 'morning',
      dateString: json['dateString'] as String? ?? '',
      slots: slotsList,
      deliveryEarningSlabs: slabsList,
      managerId: json['managerId'] as String?,
      storeId: json['storeId'] as String?,
      isCustomized: json['isCustomized'] as bool? ?? false,
      date: json['date'] != null
          ? DateTime.tryParse(json['date'] as String)
          : null,
      // Legacy
      dateLabel: json['dateLabel'] as String?,
      timeRange: json['timeRange'] as String?,
      area: json['area'] as String?,
      earningPotential: json['earningPotential'] as String?,
      ordersExpected: json['ordersExpected'] as int?,
    );
  }
}
