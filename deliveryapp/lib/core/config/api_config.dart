import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;

import 'platform_api_host.dart';

/// Backend API config — debug uses LAN/local `.env` URL; release uses live API.
abstract final class ApiConfig {
  static String get baseUrl {
    final local = dotenv.env['API_BASE_URL']?.trim() ?? '';
    final live =
        dotenv.env['API_LIVE_URL']?.trim() ?? 'https://api.greengrocc.com';
    final useLive =
        dotenv.env['USE_LIVE_API']?.trim().toLowerCase() == 'true';
    String url;
    if (kReleaseMode || useLive) {
      url = live.isNotEmpty ? live : 'https://api.greengrocc.com';
    } else {
      url = local.isNotEmpty ? local : 'https://api.greengrocc.com';
    }

    if (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }

    return getPlatformApiHost(url);
  }

  static Map<String, String> get defaultHeaders => {
        'Content-Type': 'application/json',
        'User-Agent': 'GreenGrocDelivery/1.0',
      };

  static const register = '/api/delivery-boys/register';
  static const login = '/api/delivery-boys/login';
  static const otpSend = '/api/delivery-boys/otp/send';
  static const otpVerify = '/api/delivery-boys/otp/verify';
  static const me = '/api/delivery-boys/me';
  static const slotAlertsAck = '/api/delivery-boys/slot-alerts/ack';
  static const onboarding = '/api/delivery-boys/onboarding';
  static const status = '/api/delivery-boys/status';
  static const heartbeat = '/api/delivery-boys/heartbeat';
  static const fcmToken = '/api/delivery-boys/fcm-token';
  static const notifications = '/api/delivery-boys/notifications';
  static const notificationsUnreadCount =
      '/api/delivery-boys/notifications/unread-count';
  static const notificationsReadAll =
      '/api/delivery-boys/notifications/read-all';
  static String notificationRead(String id) =>
      '/api/delivery-boys/notifications/$id/read';
  static String notificationDelete(String id) =>
      '/api/delivery-boys/notifications/$id';
  static const areaManager = '/api/delivery-boys/area-manager';
  static const activeHubs = '/api/delivery-boys/active-hubs';
  static const homeProgress = '/api/delivery-boys/home/progress';
  static String activityHistory({String range = 'week'}) =>
      '/api/delivery-boys/activity-history?range=$range';
  static const shifts = '/api/shifts';
  static const shiftBooking = '/api/delivery-boys/shift-booking';
  static const availableSlots = '/api/delivery-boys/available-slots';
  static const shiftBookings = '/api/delivery-boys/shift-bookings';
  static const goOnline = '/api/delivery-boys/go-online';
  static const goOffline = '/api/delivery-boys/go-offline';
  static const loginHours = '/api/delivery-boys/login-hours';
  static const peakHours = '/api/peak-hours';
  static const gigs = '/api/delivery-boys/gigs';

  // Rider Order Workflow Endpoints
  static const offer = '/api/delivery-boys/offer';
  static const activeDelivery = '/api/delivery-boys/active-delivery';
  static const riderPreOrders = '/api/delivery-boys/preorders';
  static String acceptOffer(String id) => '/api/delivery-boys/orders/$id/accept';
  static String declineOffer(String id) => '/api/delivery-boys/orders/$id/decline';
  static String scanStoreQr(String id) => '/api/delivery-boys/orders/$id/scan-store-qr';
  static String scanPickupQr(String id) => '/api/delivery-boys/orders/$id/scan-pickup-qr';
  static String submitPickupProof(String id) => '/api/delivery-boys/orders/$id/pickup-proof';
  static String completeDelivery(String id) => '/api/delivery-boys/orders/$id/complete';
  static String failDelivery(String id) => '/api/delivery-boys/orders/$id/fail';
  static String reportDelay(String id) => '/api/delivery-boys/orders/$id/delay';
  static String pickupQr(String id) => '/api/delivery-boys/orders/$id/pickup-qr';

  // Return / warranty pickup (admin-accepted claims)
  static const returnPickups = '/api/delivery-boys/return-pickups';
  static const scanReturnPickupQr = '/api/delivery-boys/return-pickups/scan-qr';
  static String submitReturnPickupProof(String id) =>
      '/api/delivery-boys/return-pickups/$id/pickup-proof';
  static String returnPickupToStore(String id) =>
      '/api/delivery-boys/return-pickups/$id/return-to-store';

  // Extended delivery completion flow
  static String uploadDeliveryProof(String id) => '/api/delivery-boys/orders/$id/delivery-proof';
  static String verifyCustomerOtp(String id) => '/api/delivery-boys/orders/$id/verify-otp';
  static String collectCash(String id) => '/api/delivery-boys/orders/$id/collect-cash';
  static String confirmCashCollection(String id) =>
      '/api/delivery-boys/orders/$id/collect-cash';
  static String confirmOnlinePayment(String id) => '/api/delivery-boys/orders/$id/confirm-online-payment';
  static String orderPaymentStatus(String id) => '/api/delivery-boys/orders/$id/payment-status';

  // Cash liability
  static const riderPendingCash = '/api/delivery-boys/cash/pending';
  static const riderSubmitCash = '/api/delivery-boys/cash/submit';

  // Earnings
  static String earningsDetail({String? date, String? range}) {
    final params = <String>[];
    if (range != null && range.isNotEmpty) params.add('range=$range');
    if (date != null && date.isNotEmpty) params.add('date=$date');
    final qs = params.isEmpty ? '' : '?${params.join('&')}';
    return '/api/delivery-boys/earnings/detail$qs';
  }

  static const walletSummary = '/api/delivery-boys/wallet/summary';
  static const attendanceToday = '/api/delivery-boys/attendance/today';
  static const performance = '/api/delivery-boys/performance';
  static const fullTimeAttendanceMark = '/api/delivery-boys/attendance/mark';
  static const fullTimeAttendanceToday = '/api/delivery-boys/attendance/fulltime-today';
  static const fullTimeRules = '/api/delivery-boys/fulltime-rules';
  static const fullTimeAssignedOrders = '/api/delivery-boys/fulltime/assigned-orders';

  // Shift earning slabs (rider reads from shift screen)
  static String shiftEarningSlabs(String shiftId) =>
      '/api/delivery-managers/shifts/$shiftId/earning-slabs';

  // Manager cash settlement
  static const managerCashOverview = '/api/delivery-managers/cash';
  static const managerConfirmCash = '/api/delivery-managers/cash/confirm';
  static String managerRiderCashHistory(String riderId) =>
      '/api/delivery-managers/cash/rider/$riderId';
}

/// User-facing network error; debug builds include URL hints for developers.
String _timeoutMessage(String url) {
  if (kReleaseMode) {
    return 'Could not connect to the server. '
        'Check your internet connection and try again.';
  }
  return 'Could not connect to server.\n\nURL tried: $url\n\n'
      'Fix: Make sure your phone and PC are on the same WiFi, '
      'then update API_BASE_URL in deliveryapp/.env to your PC\'s ipconfig IPv4 '
      '(e.g. http://192.168.1.56:5001).\n'
      'For emulators use: http://10.0.2.2:5001';
}

// Incoming live API uses 20s; stashed local speed uses 6s.
const Duration _kDefaultTimeout = kReleaseMode
    ? Duration(seconds: 20)
    : Duration(seconds: 6);

Future<http.Response> apiPost(
  String path, {
  Object? body,
  Map<String, String>? headers,
  Duration timeout = _kDefaultTimeout,
}) async {
  final url = '${ApiConfig.baseUrl}$path';
  try {
    return await http
        .post(
          Uri.parse(url),
          headers: {...ApiConfig.defaultHeaders, ...?headers},
          body: body,
        )
        .timeout(timeout);
  } on Exception catch (e) {
    final msg = e.toString();
    if (msg.contains('TimeoutException') || msg.contains('SocketException')) {
      throw Exception(_timeoutMessage(url));
    }
    rethrow;
  }
}

Future<http.Response> apiGet(
  String path, {
  Map<String, String>? headers,
  Duration timeout = _kDefaultTimeout,
}) async {
  final url = '${ApiConfig.baseUrl}$path';
  try {
    return await http
        .get(
          Uri.parse(url),
          headers: {...ApiConfig.defaultHeaders, ...?headers},
        )
        .timeout(timeout);
  } on Exception catch (e) {
    final msg = e.toString();
    if (msg.contains('TimeoutException') || msg.contains('SocketException')) {
      throw Exception(_timeoutMessage(url));
    }
    rethrow;
  }
}

Future<http.Response> apiPatch(
  String path, {
  Object? body,
  Map<String, String>? headers,
  Duration timeout = _kDefaultTimeout,
}) async {
  final url = '${ApiConfig.baseUrl}$path';
  try {
    return await http
        .patch(
          Uri.parse(url),
          headers: {...ApiConfig.defaultHeaders, ...?headers},
          body: body,
        )
        .timeout(timeout);
  } on Exception catch (e) {
    final msg = e.toString();
    if (msg.contains('TimeoutException') || msg.contains('SocketException')) {
      throw Exception(_timeoutMessage(url));
    }
    rethrow;
  }
}

Future<http.Response> apiDelete(
  String path, {
  Map<String, String>? headers,
  Duration timeout = _kDefaultTimeout,
}) async {
  final url = '${ApiConfig.baseUrl}$path';
  try {
    return await http
        .delete(
          Uri.parse(url),
          headers: {...ApiConfig.defaultHeaders, ...?headers},
        )
        .timeout(timeout);
  } on Exception catch (e) {
    final msg = e.toString();
    if (msg.contains('TimeoutException') || msg.contains('SocketException')) {
      throw Exception(_timeoutMessage(url));
    }
    rethrow;
  }
}
