import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';

import '../../core/config/api_config.dart';
import 'auth_service.dart';
import 'live_tracking_service.dart';

class OrderOffer {
  const OrderOffer({
    required this.orderId,
    required this.orderNumber,
    required this.darkStoreName,
    required this.darkStoreAddress,
    required this.itemCount,
    required this.itemsSummary,
    required this.estimatedEarnings,
    required this.distanceKm,
    required this.remainingSeconds,
    this.timeoutSeconds = 20,
  });

  final String orderId;
  final String orderNumber;
  final String darkStoreName;
  final String darkStoreAddress;
  final int itemCount;
  final String itemsSummary;
  final int estimatedEarnings;
  final String distanceKm;
  final int remainingSeconds;
  final int timeoutSeconds;

  factory OrderOffer.fromJson(Map<String, dynamic> json) => OrderOffer(
        orderId: json['orderId'] as String? ?? '',
        orderNumber: json['orderNumber'] as String? ?? '',
        darkStoreName: json['darkStoreName'] as String? ?? 'Dark Store',
        darkStoreAddress: json['darkStoreAddress'] as String? ?? '',
        itemCount: json['itemCount'] as int? ?? 1,
        itemsSummary: json['itemsSummary'] as String? ?? '',
        estimatedEarnings: (json['estimatedEarnings'] as num?)?.toInt() ??
            (json['earnUpTo'] as num?)?.toInt() ??
            50,
        distanceKm: json['distanceKm'] as String? ?? 'nearby',
        remainingSeconds: (json['remainingSeconds'] as num?)?.toInt() ?? 20,
        timeoutSeconds: (json['timeoutSeconds'] as num?)?.toInt() ?? 20,
      );
}

class ActiveDeliveryData {
  const ActiveDeliveryData({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.darkStoreName,
    required this.darkStoreAddress,
    required this.darkStoreQrCode,
    this.darkStorePhone,
    required this.items,
    required this.isCustomerLocationLocked,
    required this.customerAddressUnlocked,
    required this.pickupQrScanned,
    required this.pickupProofStatus,
    required this.customerName,
    required this.customerPhone,
    required this.customerAddress,
    this.pickupQrPayload,
    this.darkStoreLat,
    this.darkStoreLng,
    this.customerLat,
    this.customerLng,
    this.otpCode,
    // Payment
    this.paymentMethod = '',
    this.paymentStatus = 'pending',
    this.amountToCollect = 0,
    this.amountCollected = 0,
    this.itemsTotal = 0,
    this.deliveryFee = 0,
    // Delivery proof & OTP
    this.deliveryProofImageUrl = '',
    this.customerOtpVerified = false,
    // Earning (read-only — set by backend on delivery completion)
    this.deliveryDistanceKm = 0.0,
    this.riderDeliveryEarning = 0,
    this.batchId = '',
    this.batchSequence = 0,
    this.distanceKm,
    this.deliveryComment = '',
    this.pickupQrUnlocked = true,
    this.routeBatchWindowEndsAt,
    this.orderType = 'instant',
    this.trackingEnabled = false,
    this.sourceOrderId,
    this.delayMinutes = 0,
    this.delayReportedAt,
    this.delayCustomerNotifiedAt,
    this.preOrderSlot = '',
    this.preOrderDate = '',
    this.expectedDeliveryAt,
  });

  final String id;
  final String orderNumber;
  final String status;
  final String darkStoreName;
  final String darkStoreAddress;
  final String darkStoreQrCode;
  final String? darkStorePhone;
  final List<dynamic> items;
  final bool isCustomerLocationLocked;
  final bool customerAddressUnlocked;
  final bool pickupQrScanned;
  final String pickupProofStatus;
  final String customerName;
  final String customerPhone;
  final String customerAddress;
  final String? pickupQrPayload;
  final double? darkStoreLat;
  final double? darkStoreLng;
  final double? customerLat;
  final double? customerLng;
  final String? otpCode;
  // Payment
  final String paymentMethod;
  final String paymentStatus;
  final int amountToCollect;
  final int amountCollected;
  final int itemsTotal;
  final int deliveryFee;
  // Delivery proof & OTP
  final String deliveryProofImageUrl;
  final bool customerOtpVerified;
  // Earning (backend-calculated, read-only)
  final double deliveryDistanceKm;
  final int riderDeliveryEarning;
  final String batchId;
  final int batchSequence;
  final double? distanceKm;
  final String deliveryComment;
  final bool pickupQrUnlocked;
  final DateTime? routeBatchWindowEndsAt;
  /// ready_to_cook | instant | preorder (from the backend)
  final String orderType;
  /// Backend says live GPS may be shared for this order type (never for preorder).
  final bool trackingEnabled;
  final String? sourceOrderId;
  /// Delay this rider last reported to the Delivery Manager (0 = none).
  final int delayMinutes;
  final DateTime? delayReportedAt;
  final DateTime? delayCustomerNotifiedAt;
  /// Customer's chosen pre-order slot, e.g. "09:00 - 11:00", and date (YYYY-MM-DD).
  final String preOrderSlot;
  final String preOrderDate;
  final DateTime? expectedDeliveryAt;

  bool get isPreOrder => orderType == 'preorder';

  /// "Pre-order · 2026-10-08 · 09:00 - 11:00" (empty for other order types).
  String get preOrderTag => isPreOrder
      ? ['Pre-order', preOrderDate, preOrderSlot].where((s) => s.isNotEmpty).join(' · ')
      : '';

  bool get canReportDelay =>
      status == 'assigned' || status == 'pickup_verified' || status == 'out_for_delivery';

  bool get hasCustomerPhone =>
      customerAddressUnlocked &&
      RegExp(r'\d{6,}').hasMatch(customerPhone.replaceAll(RegExp(r'\D'), ''));

  /// Rider has the parcel and the customer can follow them on the map.
  bool get shouldStreamLocation =>
      trackingEnabled &&
      !isPreOrder &&
      (status == 'pickup_verified' || status == 'out_for_delivery');

  /// True if payment is already settled online — rider must NOT collect cash
  bool get isPaidOnline => paymentStatus == 'paid_online';

  /// True if cash has been collected for this order
  bool get isCashCollected => paymentStatus == 'collected';

  /// True if payment is pending (customer needs to pay)
  bool get isPaymentPending => paymentStatus == 'pending';

  factory ActiveDeliveryData.fromJson(Map<String, dynamic> json) => ActiveDeliveryData(
        id: json['id'] as String? ?? '',
        orderNumber: json['orderNumber'] as String? ?? '',
        status: json['status'] as String? ?? 'assigned',
        darkStoreName: json['darkStoreName'] as String? ?? 'Dark Store',
        darkStoreAddress: json['darkStoreAddress'] as String? ?? '',
        darkStorePhone: json['darkStorePhone'] as String?,
        darkStoreQrCode: json['darkStoreQrCode'] as String? ?? '',
        items: json['items'] as List<dynamic>? ?? const [],
        isCustomerLocationLocked: json['isCustomerLocationLocked'] as bool? ?? true,
        customerAddressUnlocked: json['customerAddressUnlocked'] as bool? ?? false,
        pickupQrScanned: json['pickupQrScanned'] as bool? ?? false,
        pickupProofStatus: json['pickupProofStatus'] as String? ?? 'none',
        customerName: json['customerName'] as String? ?? 'Customer',
        customerPhone: json['customerPhone'] as String? ?? '',
        customerAddress: json['customerAddress'] as String? ?? 'Scan Store QR to Unlock',
        pickupQrPayload: json['pickupQrPayload'] as String?,
        darkStoreLat: json['darkStoreLat'] != null ? (json['darkStoreLat'] as num).toDouble() : null,
        darkStoreLng: json['darkStoreLng'] != null ? (json['darkStoreLng'] as num).toDouble() : null,
        customerLat: json['customerLat'] != null ? (json['customerLat'] as num).toDouble() : null,
        customerLng: json['customerLng'] != null ? (json['customerLng'] as num).toDouble() : null,
        // Payment
        paymentMethod: json['paymentMethod'] as String? ?? '',
        paymentStatus: json['paymentStatus'] as String? ?? 'pending',
        amountToCollect: (json['amountToCollect'] as num?)?.toInt() ?? 0,
        amountCollected: (json['amountCollected'] as num?)?.toInt() ?? 0,
        itemsTotal: (json['itemsTotal'] as num?)?.toInt() ?? 0,
        deliveryFee: (json['deliveryFee'] as num?)?.toInt() ?? 0,
        // Delivery proof & OTP
        deliveryProofImageUrl: json['deliveryProofImageUrl'] as String? ?? '',
        customerOtpVerified: json['customerOtpVerified'] as bool? ?? false,
        // Earning
        deliveryDistanceKm: (json['deliveryDistanceKm'] as num?)?.toDouble() ?? 0.0,
        riderDeliveryEarning: (json['riderDeliveryEarning'] as num?)?.toInt() ?? 0,
        otpCode: json['otpCode'] as String?,
        batchId: json['batchId'] as String? ?? '',
        batchSequence: (json['batchSequence'] as num?)?.toInt() ?? 0,
        distanceKm: json['distanceKm'] != null ? (json['distanceKm'] as num).toDouble() : null,
        deliveryComment: json['deliveryComment'] as String? ?? '',
        pickupQrUnlocked: json['pickupQrUnlocked'] as bool? ?? true,
        routeBatchWindowEndsAt: json['routeBatchWindowEndsAt'] != null
            ? DateTime.tryParse(json['routeBatchWindowEndsAt'].toString())
            : null,
        orderType: json['orderType'] as String? ?? 'instant',
        trackingEnabled: json['trackingEnabled'] as bool? ?? false,
        sourceOrderId: json['sourceOrderId'] as String?,
        delayMinutes: ((json['deliveryDelay'] as Map?)?['minutes'] as num?)?.toInt() ?? 0,
        delayReportedAt:
            DateTime.tryParse('${(json['deliveryDelay'] as Map?)?['reportedAt'] ?? ''}'),
        delayCustomerNotifiedAt:
            DateTime.tryParse('${(json['deliveryDelay'] as Map?)?['customerNotifiedAt'] ?? ''}'),
        preOrderSlot: json['preOrderSlot']?.toString() ?? '',
        preOrderDate: json['preOrderDate']?.toString() ?? '',
        expectedDeliveryAt: DateTime.tryParse('${(json['dispatchEta'] as Map?)?['expectedAt'] ?? ''}'),
      );
}

class OfferCheckResult {
  const OfferCheckResult({
    this.offer,
    this.reason,
    this.message,
  });

  final OrderOffer? offer;
  final String? reason;
  final String? message;
}

class OrderService extends ChangeNotifier {
  OrderService._();
  static final instance = OrderService._();

  OrderOffer? _currentOffer;
  ActiveDeliveryData? _activeDelivery;
  List<ActiveDeliveryData> _activeDeliveries = const [];
  final Set<String> _otpVerifiedIds = {};

  /// The server flag can lag behind a just-verified OTP; remember it locally so
  /// the rider is never asked for the same order's OTP twice.
  bool isOtpVerified(ActiveDeliveryData delivery) =>
      delivery.customerOtpVerified || _otpVerifiedIds.contains(delivery.id);

  OrderOffer? get currentOffer => _currentOffer;
  ActiveDeliveryData? get activeDelivery => _activeDelivery;
  List<ActiveDeliveryData> get activeDeliveries => _activeDeliveries;

  Future<OrderOffer?> checkForOffer({String? orderId}) async {
    final detailed = await checkForOfferDetailed(orderId: orderId);
    return detailed.offer;
  }

  Future<OfferCheckResult> checkForOfferDetailed({String? orderId}) async {
    if (!AuthService.instance.isLoggedIn) {
      return const OfferCheckResult(reason: 'not_logged_in');
    }
    try {
      final path = (orderId != null && orderId.isNotEmpty)
          ? '${ApiConfig.offer}?orderId=${Uri.encodeComponent(orderId)}'
          : ApiConfig.offer;
      final res = await apiGet(
        path,
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode != 200) {
        return const OfferCheckResult(reason: 'http_error');
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (body['offer'] != null) {
        _currentOffer = OrderOffer.fromJson(body['offer'] as Map<String, dynamic>);
        notifyListeners();
        return OfferCheckResult(offer: _currentOffer);
      }
      _currentOffer = null;
      notifyListeners();
      return OfferCheckResult(
        reason: body['reason'] as String? ?? 'none',
        message: body['message'] as String?,
      );
    } catch (_) {
      return const OfferCheckResult(reason: 'network_error');
    }
  }

  Future<bool> acceptOffer(String orderId) async {
    try {
      final res = await apiPost(
        ApiConfig.acceptOffer(orderId),
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode == 200) {
        _currentOffer = null;
        await fetchActiveDelivery();
        notifyListeners();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> declineOffer(String orderId) async {
    try {
      final res = await apiPost(
        ApiConfig.declineOffer(orderId),
        headers: AuthService.instance.authHeaders,
      );
      _currentOffer = null;
      notifyListeners();
      return res.statusCode == 200;
    } catch (_) {
      _currentOffer = null;
      notifyListeners();
      return false;
    }
  }

  /// Start / stop background GPS streaming to match the current deliveries.
  void _syncLiveTracking() {
    unawaited(LiveTrackingService.instance.syncWithDeliveries(_activeDeliveries));
  }

  Future<ActiveDeliveryData?> fetchActiveDelivery() async {
    if (!AuthService.instance.isLoggedIn) return null;
    try {
      final res = await apiGet(
        ApiConfig.activeDelivery,
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode != 200) return null;
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final listRaw = body['activeDeliveries'];
      if (listRaw is List && listRaw.isNotEmpty) {
        _activeDeliveries = listRaw
            .whereType<Map>()
            .map((e) => ActiveDeliveryData.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        _activeDelivery = _activeDeliveries.first;
        _syncLiveTracking();
        notifyListeners();
        return _activeDelivery;
      }
      if (body['activeDelivery'] != null) {
        _activeDelivery = ActiveDeliveryData.fromJson(
          body['activeDelivery'] as Map<String, dynamic>,
        );
        _activeDeliveries = [_activeDelivery!];
        _syncLiveTracking();
        notifyListeners();
        return _activeDelivery;
      }
      _activeDelivery = null;
      _activeDeliveries = const [];
      _syncLiveTracking();
      notifyListeners();
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<bool> scanPickupQr(String orderId, String qrPayload) async {
    try {
      final res = await apiPost(
        ApiConfig.scanPickupQr(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({'qrPayload': qrPayload}),
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        final unlocked = body['activeDelivery'] as Map<String, dynamic>?;
        if (unlocked != null && _activeDelivery != null) {
          _activeDelivery = ActiveDeliveryData(
            id: _activeDelivery!.id,
            orderNumber: unlocked['orderNumber'] as String? ?? _activeDelivery!.orderNumber,
            status: unlocked['status'] as String? ?? _activeDelivery!.status,
            darkStoreName: _activeDelivery!.darkStoreName,
            darkStoreAddress: _activeDelivery!.darkStoreAddress,
            darkStoreQrCode: _activeDelivery!.darkStoreQrCode,
            darkStorePhone: _activeDelivery!.darkStorePhone,
            items: _activeDelivery!.items,
            isCustomerLocationLocked: unlocked['isCustomerLocationLocked'] as bool? ?? true,
            customerAddressUnlocked: unlocked['customerAddressUnlocked'] as bool? ?? false,
            pickupQrScanned: unlocked['pickupQrScanned'] as bool? ?? _activeDelivery!.pickupQrScanned,
            pickupProofStatus: unlocked['pickupProofStatus'] as String? ?? _activeDelivery!.pickupProofStatus,
            customerName: unlocked['customerName'] as String? ?? _activeDelivery!.customerName,
            customerPhone: unlocked['customerPhone'] as String? ?? _activeDelivery!.customerPhone,
            customerAddress: unlocked['customerAddress'] as String? ?? _activeDelivery!.customerAddress,
            pickupQrPayload: null,
            darkStoreLat: _activeDelivery!.darkStoreLat,
            darkStoreLng: _activeDelivery!.darkStoreLng,
            customerLat: unlocked['customerLat'] != null
                ? (unlocked['customerLat'] as num).toDouble()
                : _activeDelivery!.customerLat,
            customerLng: unlocked['customerLng'] != null
                ? (unlocked['customerLng'] as num).toDouble()
                : _activeDelivery!.customerLng,
            otpCode: unlocked['otpCode'] as String? ?? _activeDelivery!.otpCode,
            pickupQrUnlocked: true,
            routeBatchWindowEndsAt: null,
            orderType: _activeDelivery!.orderType,
            trackingEnabled: _activeDelivery!.trackingEnabled,
            sourceOrderId: _activeDelivery!.sourceOrderId,
            preOrderSlot: _activeDelivery!.preOrderSlot,
            preOrderDate: _activeDelivery!.preOrderDate,
          );
        }
        await fetchActiveDelivery();
        notifyListeners();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Pre-orders assigned to this rider: still to deliver plus finished today.
  Future<Map<String, dynamic>?> fetchPreOrders() async {
    if (!AuthService.instance.isLoggedIn) return null;
    try {
      final res = await apiGet(
        ApiConfig.riderPreOrders,
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode != 200) return null;
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  /// Scans any pre-order's pickup QR (`PICKUP:<orderId>:<token>`); unlocks that customer's address.
  Future<({bool success, String message})> scanPreOrderQr(String qrPayload) async {
    final parts = qrPayload.split(':');
    final orderId = parts.length > 1 ? parts[1] : '';
    if (orderId.isEmpty) {
      return (success: false, message: 'This is not a pickup QR');
    }
    try {
      final res = await apiPost(
        ApiConfig.scanPickupQr(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({'qrPayload': qrPayload}),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final message = body['message'] as String? ?? '';
      if (res.statusCode == 200) {
        unawaited(fetchActiveDelivery());
        return (success: true, message: message.isEmpty ? 'Order unlocked' : message);
      }
      return (success: false, message: message.isEmpty ? 'Could not verify this QR' : message);
    } catch (_) {
      return (success: false, message: 'Network error — try again');
    }
  }

  Future<bool> submitPickupProof(String orderId, String imageBase64) async {
    try {
      final res = await apiPost(
        ApiConfig.submitPickupProof(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({'imageBase64': imageBase64}),
      );
      if (res.statusCode == 200) {
        await fetchActiveDelivery();
        notifyListeners();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> scanStoreQr(String orderId, String qrCode) async {
    try {
      final res = await apiPost(
        ApiConfig.scanStoreQr(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({'qrCode': qrCode}),
      );
      if (res.statusCode == 200) {
        await fetchActiveDelivery();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<({bool success, String? error})> completeDelivery(
    String orderId,
    String otp, {
    String? deliveryComment,
  }) async {
    try {
      final res = await apiPost(
        ApiConfig.completeDelivery(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({
          'otp': otp,
          if (deliveryComment != null && deliveryComment.trim().isNotEmpty)
            'deliveryComment': deliveryComment.trim(),
        }),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final msg = (body['message'] as String? ?? '').toLowerCase();
      if (res.statusCode == 200 || body['alreadyDelivered'] == true || msg.contains('already delivered')) {
        _otpVerifiedIds.remove(orderId);
        await fetchActiveDelivery();
        notifyListeners();
        return (success: true, error: null);
      }
      return (
        success: false,
        error: body['message'] as String? ?? 'Incorrect OTP. Ask the customer for their order OTP.',
      );
    } catch (_) {
      return (success: false, error: 'Network error. Please try again.');
    }
  }

  Future<({bool success, String? error})> failDelivery(
    String orderId, {
    required String failureReason,
    bool emergency = false,
  }) async {
    try {
      final res = await apiPost(
        ApiConfig.failDelivery(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({'failureReason': failureReason.trim(), if (emergency) 'emergency': true}),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        await fetchActiveDelivery();
        notifyListeners();
        return (success: true, error: null);
      }
      return (
        success: false,
        error: body['message'] as String? ?? 'Could not mark delivery as failed.',
      );
    } catch (_) {
      return (success: false, error: 'Network error. Please try again.');
    }
  }

  Future<({bool success, String? error})> reportDelay(
    String orderId, {
    required int hours,
    required int minutes,
    String reason = '',
  }) async {
    try {
      final res = await apiPost(
        ApiConfig.reportDelay(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({'hours': hours, 'minutes': minutes, 'reason': reason.trim()}),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        await fetchActiveDelivery();
        notifyListeners();
        return (success: true, error: null);
      }
      return (
        success: false,
        error: body['message'] as String? ?? 'Could not send the delay.',
      );
    } catch (_) {
      return (success: false, error: 'Network error. Please try again.');
    }
  }

  /// Upload delivery proof photo (base64 data URL or plain base64).
  Future<({bool success, String? error})> uploadDeliveryProof(
    String orderId,
    String imageBase64,
  ) async {
    try {
      final res = await apiPost(
        ApiConfig.uploadDeliveryProof(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({'imageBase64': imageBase64}),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        await fetchActiveDelivery();
        notifyListeners();
        return (success: true, error: null);
      }
      return (
        success: false,
        error: body['message'] as String? ?? 'Could not upload delivery photo.',
      );
    } catch (_) {
      return (success: false, error: 'Network error. Please try again.');
    }
  }

  /// Verify customer OTP on the backend.
  Future<({bool success, String? error})> verifyCustomerOtp(
    String orderId,
    String otp,
  ) async {
    try {
      final res = await apiPost(
        ApiConfig.verifyCustomerOtp(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({'otp': otp}),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        _otpVerifiedIds.add(orderId);
        await fetchActiveDelivery();
        notifyListeners();
        return (success: true, error: null);
      }
      return (success: false, error: body['message'] as String? ?? 'OTP verification failed');
    } catch (_) {
      return (success: false, error: 'Network error. Please try again.');
    }
  }

  /// Confirm cash collection from the customer.
  Future<({bool success, String? error, int? amountCollected})> confirmCashCollection(String orderId) async {
    try {
      final res = await apiPost(
        ApiConfig.confirmCashCollection(orderId),
        headers: AuthService.instance.authHeaders,
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        await fetchActiveDelivery();
        await AuthService.instance.fetchMe();
        notifyListeners();
        return (
          success: true,
          error: null,
          amountCollected: (body['amountCollected'] as num?)?.toInt(),
        );
      }
      return (
        success: false,
        error: body['message'] as String? ?? 'Cash confirmation failed',
        amountCollected: null,
      );
    } catch (_) {
      return (success: false, error: 'Network error. Please try again.', amountCollected: null);
    }
  }

  /// Create, verify, or close the order's Razorpay QR.
  Future<Map<String, dynamic>> deliveryPaymentQr(String orderId, String action) async {
    try {
      final res = await apiPost(
        ApiConfig.confirmOnlinePayment(orderId),
        headers: AuthService.instance.authHeaders,
        body: jsonEncode({'qrAction': action}),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200 && body['paymentStatus'] == 'paid_online') {
        await fetchActiveDelivery();
        notifyListeners();
      }
      return body;
    } catch (_) {
      return {'message': 'Could not check Razorpay. Please try again.'};
    }
  }

  /// Get rider's pending cash liability.
  Future<Map<String, dynamic>?> fetchPendingCash() async {
    try {
      final res = await apiGet(
        ApiConfig.riderPendingCash,
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Get per-order delivery earnings detail (today by default).
  Future<Map<String, dynamic>?> fetchEarningsDetail({String? date}) async {
    try {
      final res = await apiGet(
        ApiConfig.earningsDetail(date: date),
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Last 7 days earnings summary for wallet.
  Future<Map<String, dynamic>?> fetchWeeklyEarnings() async {
    try {
      final res = await apiGet(
        ApiConfig.earningsDetail(range: 'week'),
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Admin-accepted return / warranty pickups assigned to this rider.
  Future<List<Map<String, dynamic>>> fetchReturnPickups() async {
    try {
      final res = await apiGet(
        ApiConfig.returnPickups,
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode != 200) return [];
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final data = body['data'];
      if (data is List) {
        return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<({bool success, String? error})> scanReturnPickupQr(String qrPayload) async {
    try {
      final res = await apiPost(
        ApiConfig.scanReturnPickupQr,
        headers: AuthService.instance.authHeaders,
        body: {'qrPayload': qrPayload},
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        return (success: true, error: null);
      }
      return (
        success: false,
        error: body['message'] as String? ?? 'Invalid return QR',
      );
    } catch (_) {
      return (success: false, error: 'Network error. Please try again.');
    }
  }

  Future<({bool success, String? error})> submitReturnPickupProof(
    String returnPickupId,
    String imageBase64,
  ) async {
    try {
      final res = await apiPost(
        ApiConfig.submitReturnPickupProof(returnPickupId),
        headers: AuthService.instance.authHeaders,
        body: {'imageBase64': imageBase64},
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        return (success: true, error: null);
      }
      return (
        success: false,
        error: body['message'] as String? ?? 'Photo upload failed',
      );
    } catch (_) {
      return (success: false, error: 'Network error. Please try again.');
    }
  }

  Future<({bool success, String? error})> markReturnPickupToStore(
    String returnPickupId,
  ) async {
    try {
      final res = await apiPost(
        ApiConfig.returnPickupToStore(returnPickupId),
        headers: AuthService.instance.authHeaders,
        body: {},
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        return (success: true, error: null);
      }
      return (
        success: false,
        error: body['message'] as String? ?? 'Could not mark returned to store',
      );
    } catch (_) {
      return (success: false, error: 'Network error. Please try again.');
    }
  }
}
