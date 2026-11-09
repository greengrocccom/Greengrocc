import 'dart:convert';
import 'package:flutter/foundation.dart';

import '../../core/config/api_config.dart';
import '../../core/l10n/app_l10n.dart';
import 'auth_service.dart';

class ShiftSlotInfo {
  final String id;
  final String shiftId;
  final String shiftName;
  final String shiftType;
  final String startTime;
  final String endTime;
  final int capacity;
  final int bookedCount;
  final int remainingCapacity;
  final String status;
  final bool isBookedByMe;

  const ShiftSlotInfo({
    required this.id,
    required this.shiftId,
    required this.shiftName,
    required this.shiftType,
    required this.startTime,
    required this.endTime,
    required this.capacity,
    required this.bookedCount,
    required this.remainingCapacity,
    required this.status,
    required this.isBookedByMe,
  });

  factory ShiftSlotInfo.fromJson(Map<String, dynamic> json) {
    return ShiftSlotInfo(
      id: json['id']?.toString() ?? '',
      shiftId: json['shiftId']?.toString() ?? '',
      shiftName: json['shiftName']?.toString() ?? appL10n.kindShift,
      shiftType: json['shiftType']?.toString() ?? 'morning',
      startTime: json['startTime']?.toString() ?? '',
      endTime: json['endTime']?.toString() ?? '',
      capacity: (json['capacity'] as num?)?.toInt() ?? 10,
      bookedCount: (json['bookedCount'] as num?)?.toInt() ?? 0,
      remainingCapacity: (json['remainingCapacity'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? 'AVAILABLE',
      isBookedByMe: json['isBookedByMe'] == true,
    );
  }
}

class ShiftBookingInfo {
  final String shiftType;
  final String shiftName;
  final String id;
  final String slotId;
  final String dateString;
  final String startTime;
  final String endTime;
  final String status;
  final String storeName;
  final String storeAddress;
  final bool notificationEnabled;
  final int notificationTimeMinutes;
  final DateTime? bookedAt;
  final String assignedBy;

  /// none | per_km | per_hour
  final String incentiveMode;
  final double incentiveRate;

  /// per_km: km to deliver in the slot before each further km is paid.
  final double incentiveAfterKm;
  final double kmDelivered;

  /// completed | running | upcoming (computed by the server in IST)
  final String phase;

  const ShiftBookingInfo({
    this.shiftType = '',
    this.shiftName = '',
    required this.id,
    required this.slotId,
    required this.dateString,
    required this.startTime,
    required this.endTime,
    required this.status,
    required this.storeName,
    required this.storeAddress,
    required this.notificationEnabled,
    required this.notificationTimeMinutes,
    this.bookedAt,
    this.assignedBy = 'rider',
    this.incentiveMode = 'none',
    this.incentiveRate = 0,
    this.incentiveAfterKm = 0,
    this.kmDelivered = 0,
    this.phase = 'upcoming',
  });

  bool get hasIncentive => incentiveMode != 'none' && incentiveRate > 0;
  bool get isCompleted => phase == 'completed';
  bool get isRunning => phase == 'running';

  static int _minutesOf(String time) {
    final s = time.trim().toUpperCase();
    final isPm = s.contains('PM');
    final isAm = s.contains('AM');
    final parts = s.replaceAll(RegExp(r'AM|PM'), '').trim().split(':');
    var h = int.tryParse(parts.first.trim()) ?? 0;
    final m = parts.length > 1 ? int.tryParse(parts[1].trim()) ?? 0 : 0;
    if (isPm && h < 12) h += 12;
    if (isAm && h == 12) h = 0;
    return h * 60 + m;
  }

  /// Fallback when the server did not send a phase.
  static String _localPhase(
    String dateString,
    String start,
    String end,
    String status,
  ) {
    if (status == 'COMPLETED') return 'completed';
    final day = DateTime.tryParse(dateString);
    if (day == null) return 'upcoming';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(day.year, day.month, day.day);
    if (d.isAfter(today)) return 'upcoming';
    if (d.isBefore(today)) return 'completed';
    final nowMin = now.hour * 60 + now.minute;
    final s = _minutesOf(start);
    final e = _minutesOf(end);
    if (nowMin < s) return 'upcoming';
    if (e > s && nowMin >= e) return 'completed';
    return 'running';
  }

  factory ShiftBookingInfo.fromJson(Map<String, dynamic> json) {
    return ShiftBookingInfo(
      shiftType: json['shiftType']?.toString() ?? '',
      shiftName: json['shiftName']?.toString() ?? '',
      id: json['id']?.toString() ?? '',
      slotId: json['slotId']?.toString() ?? '',
      dateString: json['dateString']?.toString() ?? '',
      startTime: json['startTime']?.toString() ?? '',
      endTime: json['endTime']?.toString() ?? '',
      status: json['status']?.toString() ?? 'UPCOMING',
      storeName: json['storeName']?.toString() ?? appL10n.svcDarkStore,
      storeAddress: json['storeAddress']?.toString() ?? '',
      notificationEnabled: json['notificationEnabled'] == true,
      notificationTimeMinutes:
          (json['notificationTimeMinutes'] as num?)?.toInt() ?? 15,
      bookedAt: json['bookedAt'] != null
          ? DateTime.tryParse(json['bookedAt'].toString())
          : null,
      assignedBy: json['assignedBy']?.toString() ?? 'rider',
      incentiveMode: json['incentiveMode']?.toString() ?? 'none',
      incentiveRate: (json['incentiveRate'] as num?)?.toDouble() ?? 0,
      incentiveAfterKm: (json['incentiveAfterKm'] as num?)?.toDouble() ?? 0,
      kmDelivered: (json['kmDelivered'] as num?)?.toDouble() ?? 0,
      phase: const ['completed', 'running', 'upcoming'].contains(json['phase'])
          ? json['phase'] as String
          : _localPhase(
              json['dateString']?.toString() ?? '',
              json['startTime']?.toString() ?? '',
              json['endTime']?.toString() ?? '',
              json['status']?.toString() ?? '',
            ),
    );
  }
}

class AvailableSlotsResponse {
  final String serverTime;
  final String serverTimeIST;
  final String serverDateString;
  final String date;
  final String storeName;
  final String storeAddress;
  final List<ShiftSlotInfo> slots;
  final bool userHasBookingForDate;
  final ShiftBookingInfo? activeBooking;

  const AvailableSlotsResponse({
    required this.serverTime,
    this.serverTimeIST = '',
    required this.serverDateString,
    required this.date,
    required this.storeName,
    required this.storeAddress,
    required this.slots,
    required this.userHasBookingForDate,
    this.activeBooking,
  });
}

class GoOnlineResult {
  final bool success;
  final String message;
  final String? code;
  final int? distanceMeters;
  final int? allowedRadius;
  final int? minutesUntilStart;
  final String? startTime;
  final String? endTime;

  const GoOnlineResult({
    required this.success,
    required this.message,
    this.code,
    this.distanceMeters,
    this.allowedRadius,
    this.minutesUntilStart,
    this.startTime,
    this.endTime,
  });
}

class ShiftService {
  ShiftService._();
  static final instance = ShiftService._();

  static const String earningsToday = '\u20B9750';
  static const String ordersToday = '12';

  Map<String, String>? get _headers => AuthService.instance.authHeaders;

  Future<AvailableSlotsResponse?> fetchAvailableSlots(String date) async {
    try {
      final path =
          '${ApiConfig.availableSlots}?date=${Uri.encodeComponent(date)}';
      final res = await apiGet(path, headers: _headers);
      if (res.statusCode != 200) return null;

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final rawSlots = body['slots'] as List? ?? [];
      final slotsList = rawSlots
          .map((s) => ShiftSlotInfo.fromJson(s as Map<String, dynamic>))
          .where((s) => s.status.toUpperCase() != 'CANCELLED')
          .toList();

      final activeBookingJson = body['activeBooking'] as Map<String, dynamic>?;

      return AvailableSlotsResponse(
        serverTime: body['serverTime']?.toString() ?? '',
        serverTimeIST: body['serverTimeIST']?.toString() ?? '',
        serverDateString: body['serverDateString']?.toString() ?? '',
        date: body['date']?.toString() ?? date,
        storeName: body['storeName']?.toString() ?? appL10n.svcDarkStore,
        storeAddress: body['storeAddress']?.toString() ?? '',
        slots: slotsList,
        userHasBookingForDate: body['userHasBookingForDate'] == true,
        activeBooking: activeBookingJson != null
            ? ShiftBookingInfo.fromJson(activeBookingJson)
            : null,
      );
    } catch (e) {
      debugPrint('[ShiftService] fetchAvailableSlots error: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>> fetchMyBookings() async {
    try {
      final res = await apiGet(
        ApiConfig.shiftBookings + '/my',
        headers: _headers,
      );
      if (res.statusCode != 200) return {};

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final todayBookingJson = body['todayBooking'] as Map<String, dynamic>?;
      final rawUpcoming = body['upcomingBookings'] as List? ?? [];

      // Client-side guard: never treat a past date as "today"
      final todayStr = _todayDateStringLocal();
      ShiftBookingInfo? todayBooking;
      if (todayBookingJson != null) {
        final parsed = ShiftBookingInfo.fromJson(todayBookingJson);
        if (parsed.dateString.isEmpty || parsed.dateString == todayStr) {
          todayBooking = parsed;
        }
      }

      final upcoming = rawUpcoming
          .map((b) => ShiftBookingInfo.fromJson(b as Map<String, dynamic>))
          .where(
            (b) => b.dateString.isEmpty || b.dateString.compareTo(todayStr) > 0,
          )
          .toList();

      final todayList = (body['todayBookings'] as List? ?? [])
          .map((b) => ShiftBookingInfo.fromJson(b as Map<String, dynamic>))
          .where((b) => b.dateString.isEmpty || b.dateString == todayStr)
          .toList();
      if (todayList.isEmpty && todayBooking != null)
        todayList.add(todayBooking);

      return {
        'todayBooking': todayBooking,
        'todayBookings': todayList,
        'upcomingBookings': upcoming,
      };
    } catch (e) {
      debugPrint('[ShiftService] fetchMyBookings error: $e');
      return {};
    }
  }

  String _todayDateStringLocal() {
    final now = DateTime.now();
    final y = now.year.toString().padLeft(4, '0');
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  Future<bool> toggleNotification(
    String bookingId,
    bool enabled,
    int minutes,
  ) async {
    try {
      final path = '${ApiConfig.shiftBookings}/$bookingId/notify';
      final res = await apiPost(
        path,
        headers: _headers,
        body: jsonEncode({
          'notificationEnabled': enabled,
          'notificationTimeMinutes': minutes,
        }),
      );
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<GoOnlineResult> goOnlineWithLocation(
    double latitude,
    double longitude,
  ) async {
    try {
      final res = await apiPost(
        ApiConfig.goOnline,
        headers: _headers,
        body: jsonEncode({'latitude': latitude, 'longitude': longitude}),
      );

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final isSuccess = res.statusCode == 200 && body['success'] == true;

      return GoOnlineResult(
        success: isSuccess,
        message:
            body['message']?.toString() ?? appL10n.svcLocationVerificationComplete,
        code: body['code']?.toString(),
        distanceMeters: (body['distanceMeters'] as num?)?.toInt(),
        allowedRadius: (body['allowedRadius'] as num?)?.toInt(),
        minutesUntilStart: (body['minutesUntilStart'] as num?)?.toInt(),
        startTime: body['startTime']?.toString(),
        endTime: body['endTime']?.toString(),
      );
    } catch (e) {
      return GoOnlineResult(
        success: false,
        message: appL10n.svcCannotVerifyLocation,
      );
    }
  }

  Future<bool> goOffline() async {
    try {
      final res = await apiPost(ApiConfig.goOffline, headers: _headers);
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<List<GigInfo>> fetchGigs({String? date}) async {
    try {
      final queryDate = date ?? DateTime.now().toIso8601String().split('T')[0];
      final path = '${ApiConfig.gigs}?date=$queryDate';
      final res = await apiGet(path, headers: _headers);
      if (res.statusCode != 200) return [];
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final list = body['gigs'] as List? ?? [];
      return list
          .map((g) => GigInfo.fromJson(g as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }
}

class GigTierInfo {
  final int minTarget;
  final int bonusAmount;

  const GigTierInfo({required this.minTarget, required this.bonusAmount});

  factory GigTierInfo.fromJson(Map<String, dynamic> json) {
    return GigTierInfo(
      minTarget: (json['minTarget'] as num?)?.toInt() ?? 0,
      bonusAmount: (json['bonusAmount'] as num?)?.toInt() ?? 0,
    );
  }
}

class GigInfo {
  final String id;
  final String title;
  final String type;
  final String dateString;
  final String startTime;
  final String endTime;
  final int targetHours;
  final int targetEarnings;
  final int bonusAmount;
  final List<GigTierInfo> tiers;
  final String description;
  final bool isActive;

  const GigInfo({
    required this.id,
    required this.title,
    required this.type,
    required this.dateString,
    required this.startTime,
    required this.endTime,
    required this.targetHours,
    required this.targetEarnings,
    required this.bonusAmount,
    required this.tiers,
    required this.description,
    required this.isActive,
  });

  factory GigInfo.fromJson(Map<String, dynamic> json) {
    final rawTiers = json['tiers'] as List? ?? [];
    final tiersList = rawTiers
        .map((t) => GigTierInfo.fromJson(t as Map<String, dynamic>))
        .toList();

    return GigInfo(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? appL10n.svcStoreGig,
      type: json['type']?.toString() ?? 'hours_bonus',
      dateString: json['dateString']?.toString() ?? '',
      startTime: json['startTime']?.toString() ?? '06:00 PM',
      endTime: json['endTime']?.toString() ?? '10:00 PM',
      targetHours: (json['targetHours'] as num?)?.toInt() ?? 3,
      targetEarnings: (json['targetEarnings'] as num?)?.toInt() ?? 500,
      bonusAmount: (json['bonusAmount'] as num?)?.toInt() ?? 100,
      tiers: tiersList,
      description: json['description']?.toString() ?? '',
      isActive: json['isActive'] == true,
    );
  }

  /// True when this gig is happening right now (today + within start/end).
  bool get isLiveNow {
    final now = DateTime.now();
    final today =
        '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    if (dateString.isNotEmpty && dateString != today) return false;
    final start = _timeToMinutes(startTime);
    final end = _timeToMinutes(endTime);
    if (start == null || end == null) {
      return dateString.isEmpty || dateString == today;
    }
    final nowMin = now.hour * 60 + now.minute;
    if (end > start) return nowMin >= start && nowMin < end;
    return nowMin >= start || nowMin < end;
  }
}

int? _timeToMinutes(String time) {
  final t = time.trim();
  final ampm = RegExp(r'^(\d{1,2}):(\d{2})\s*(AM|PM)$', caseSensitive: false);
  final m1 = ampm.firstMatch(t);
  if (m1 != null) {
    var h = int.parse(m1.group(1)!);
    final min = int.parse(m1.group(2)!);
    final ap = m1.group(3)!.toUpperCase();
    if (ap == 'PM' && h != 12) h += 12;
    if (ap == 'AM' && h == 12) h = 0;
    return h * 60 + min;
  }
  final m2 = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(t);
  if (m2 != null) {
    return int.parse(m2.group(1)!) * 60 + int.parse(m2.group(2)!);
  }
  return null;
}
