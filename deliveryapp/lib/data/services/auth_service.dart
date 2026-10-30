import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/api_config.dart';
import '../../core/l10n/locale_controller.dart';
import '../../core/routes/app_routes.dart';
import '../../live/live_storage.dart';
import 'rider_live_service.dart';
import 'live_tracking_service.dart';
import 'location_service.dart';
import 'notification_inbox_service.dart';
import 'push_notification_service.dart';
import 'socket_service.dart';

class DeliveryBoy {
  const DeliveryBoy({
    required this.id,
    required this.phone,
    required this.onboardingComplete,
    required this.onboardingStep,
    this.name = '',
    this.language = 'en',
    this.city = '',
    this.cityId = '',
    this.area = '',
    this.vehicleType = '',
    this.status = 'offline',
    this.verificationStatus = 'pending',
    this.rating = 5.0,
    this.totalRatingsCount = 0,
    this.walletBalance = 0.0,
    this.totalLifetimeEarnings = 0.0,
    this.todayEarnings = 0.0,
    this.fcmToken = '',
    this.activeOrderId,
    this.verifiedAt,
    this.selfieUrl = '',
    this.selfieBase64 = '',
    this.documents = const {},
    this.bankDetails = const {},
    this.employmentType = 'PART_TIME',
    this.pendingCashAmount = 0.0,
  });

  final String id;
  final String phone;
  final String name;
  final String language;
  final String city;
  final String cityId;
  final String area;
  final String vehicleType;
  final String status;
  final bool onboardingComplete;
  final String onboardingStep;
  final String verificationStatus;
  final double rating;
  final int totalRatingsCount;
  final double walletBalance;
  final double totalLifetimeEarnings;
  final double todayEarnings;
  final String fcmToken;
  final String? activeOrderId;
  final DateTime? verifiedAt;
  final String selfieUrl;
  /// Fallback when S3 URL is empty (local / upload-pending).
  final String selfieBase64;
  final Map<String, dynamic> documents;
  final Map<String, dynamic> bankDetails;
  final String employmentType;
  final double pendingCashAmount;

  bool get hasProfilePhoto =>
      selfieUrl.isNotEmpty || selfieBase64.isNotEmpty;

  /// Prefer S3 URL; fall back to stored base64 for local display.
  Object? get profileImageBytesOrUrl {
    if (selfieUrl.isNotEmpty) return selfieUrl;
    if (selfieBase64.isEmpty) return null;
    try {
      final raw = selfieBase64.contains(',')
          ? selfieBase64.split(',').last
          : selfieBase64;
      return base64Decode(raw);
    } catch (_) {
      return null;
    }
  }

  bool get isOnline => status == 'online' || status == 'on_delivery';
  bool get isVerificationPending =>
      verificationStatus != 'approved' && verificationStatus != 'rejected';
  bool get isVerified => verificationStatus == 'approved';
  bool get isFullTime => employmentType == 'FULL_TIME';

  factory DeliveryBoy.fromJson(Map<String, dynamic> json) {
    final selfie = json['selfie'];
    String selfieUrl = '';
    String selfieBase64 = '';
    if (selfie is Map) {
      selfieUrl = selfie['url']?.toString() ?? '';
      selfieBase64 = selfie['imageBase64']?.toString() ?? '';
    }
    Map<String, dynamic> docs = const {};
    if (json['documents'] is Map) {
      docs = Map<String, dynamic>.from(json['documents'] as Map);
    }
    Map<String, dynamic> bank = const {};
    if (json['bankDetails'] is Map) {
      bank = Map<String, dynamic>.from(json['bankDetails'] as Map);
    }
    return DeliveryBoy(
      id: json['id']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      language: json['language']?.toString() ?? 'en',
      city: json['city']?.toString() ?? '',
      cityId: json['cityId']?.toString() ?? '',
      area: json['area']?.toString() ?? '',
      vehicleType: json['vehicleType']?.toString() ?? '',
      status: json['status']?.toString() ?? 'offline',
      onboardingComplete: json['onboardingComplete'] == true,
      onboardingStep: json['onboardingStep']?.toString() ?? 'vehicle',
      verificationStatus: json['verificationStatus']?.toString() ?? 'pending',
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
      totalRatingsCount: (json['totalRatingsCount'] as num?)?.toInt() ?? 0,
      walletBalance: (json['walletBalance'] as num?)?.toDouble() ?? 0.0,
      totalLifetimeEarnings: (json['totalLifetimeEarnings'] as num?)?.toDouble() ?? 0.0,
      todayEarnings: (json['todayEarnings'] as num?)?.toDouble() ?? 0.0,
      fcmToken: json['fcmToken']?.toString() ?? '',
      activeOrderId: json['activeOrderId']?.toString(),
      verifiedAt: json['verifiedAt'] != null
          ? DateTime.tryParse(json['verifiedAt'].toString())
          : null,
      selfieUrl: selfieUrl,
      selfieBase64: selfieBase64,
      documents: docs,
      bankDetails: bank,
      employmentType: json['employmentType']?.toString() ?? 'PART_TIME',
      pendingCashAmount: (json['pendingCashAmount'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'phone': phone,
        'name': name,
        'language': language,
        'city': city,
        'cityId': cityId,
        'area': area,
        'vehicleType': vehicleType,
        'status': status,
        'onboardingComplete': onboardingComplete,
        'onboardingStep': onboardingStep,
        'verificationStatus': verificationStatus,
        'rating': rating,
        'totalRatingsCount': totalRatingsCount,
        'walletBalance': walletBalance,
        'totalLifetimeEarnings': totalLifetimeEarnings,
        'todayEarnings': todayEarnings,
        'pendingCashAmount': pendingCashAmount,
        'fcmToken': fcmToken,
        'activeOrderId': activeOrderId,
        'verifiedAt': verifiedAt?.toIso8601String(),
        'selfie': {
          'url': selfieUrl,
          if (selfieBase64.isNotEmpty) 'imageBase64': selfieBase64,
        },
        'documents': documents,
        'bankDetails': bankDetails,
        'employmentType': employmentType,
      };
}

class AreaManagerInfo {
  const AreaManagerInfo({
    required this.name,
    required this.phone,
    required this.storeName,
    required this.storeAddress,
    this.storeId = '',
    this.email = '',
    this.city = '',
    this.area = '',
    this.pincode = '',
  });

  final String name;
  final String phone;
  final String email;
  final String storeName;
  final String storeAddress;
  final String storeId;
  final String city;
  final String area;
  final String pincode;

  factory AreaManagerInfo.fromJson(Map<String, dynamic> json) {
    return AreaManagerInfo(
      name: json['name']?.toString() ?? 'Delivery Manager',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      storeName: json['storeName']?.toString() ?? '',
      storeAddress: json['storeAddress']?.toString() ?? '',
      storeId: json['storeId']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      area: json['area']?.toString() ?? '',
      pincode: json['pincode']?.toString() ?? '',
    );
  }
}

class AuthResult {
  const AuthResult({required this.token, required this.deliveryBoy});

  final String token;
  final DeliveryBoy deliveryBoy;
}

class AuthApiException implements Exception {
  AuthApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  static const _tokenKey = 'auth_token';
  static const _boyKey = 'delivery_boy';
  static const _lastRouteKey = 'last_active_route';

  String? _token;
  DeliveryBoy? _deliveryBoy;
  final ValueNotifier<DeliveryBoy?> boyNotifier = ValueNotifier<DeliveryBoy?>(null);

  String? get token => _token;
  DeliveryBoy? get deliveryBoy => _deliveryBoy;
  bool get isLoggedIn => _token != null && _token!.isNotEmpty;

  String get _currentLanguage =>
      LocaleController.instance.locale?.languageCode ?? 'en';

  Future<void> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    final raw = prefs.getString(_boyKey);
    if (raw != null) {
      try {
        _deliveryBoy = DeliveryBoy.fromJson(
          jsonDecode(raw) as Map<String, dynamic>,
        );
        boyNotifier.value = _deliveryBoy;
        if (_deliveryBoy != null && _deliveryBoy!.id.isNotEmpty) {
          SocketService.instance.connect(_deliveryBoy!.id);
          PushNotificationService.instance.syncTokenNow();
        }
      } catch (_) {
        _deliveryBoy = null;
        boyNotifier.value = null;
      }
    }
  }

  Future<void> saveLastRoute(String routeName) async {
    // Only save main shell /home as the persistent restart route
    if (routeName != '/home' && routeName != AppRoutes.home) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lastRouteKey, AppRoutes.home);
  }

  Future<String?> getLastRoute() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_lastRouteKey);
  }

  Future<void> _persist(String token, DeliveryBoy boy) async {
    _token = token;
    _deliveryBoy = boy;
    boyNotifier.value = boy;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_boyKey, jsonEncode(boy.toJson()));
    if (boy.id.isNotEmpty) {
      SocketService.instance.connect(boy.id);
    }
    // Keep FCM token registered for Zomato-style pushes when app is closed.
    PushNotificationService.instance.syncTokenNow();
  }

  /// Apply verification from socket event — no timed /me polling.
  Future<void> applyVerificationStatus(String status) async {
    final boy = _deliveryBoy;
    final token = _token;
    if (boy == null || token == null || token.isEmpty) return;
    final next = DeliveryBoy.fromJson({
      ...boy.toJson(),
      'verificationStatus': status,
    });
    await _persist(token, next);
  }

  Future<void> clearSession() async {
    await LiveTrackingService.instance.stop();
    SocketService.instance.disconnect();
    NotificationInboxService.instance.clear();
    _token = null;
    _deliveryBoy = null;
    boyNotifier.value = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_boyKey);
    await prefs.remove(_lastRouteKey);
    await LiveStorage.clear();
  }

  Future<AuthResult> register({
    required String phone,
    required String password,
    String name = '',
  }) async {
    try {
      final res = await apiPost(
        ApiConfig.register,
        body: jsonEncode({
          'phone': phone,
          'password': password,
          'language': _currentLanguage,
          if (name.isNotEmpty) 'name': name,
        }),
      );
      return await _parseAuthResponse(res);
    } on AuthApiException {
      rethrow;
    } catch (e) {
      // Surface the friendly message from api_config (includes URL + fix hint)
      throw AuthApiException(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<AuthResult> login({
    required String phone,
    required String password,
  }) async {
    try {
      final res = await apiPost(
        ApiConfig.login,
        body: jsonEncode({
          'phone': phone,
          'password': password,
          'language': _currentLanguage,
        }),
      );
      return await _parseAuthResponse(res);
    } on AuthApiException {
      rethrow;
    } catch (e) {
      // Surface the friendly message from api_config (includes URL + fix hint)
      throw AuthApiException(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<Map<String, dynamic>> sendOtp({
    required String phone,
    String purpose = 'login',
  }) async {
    try {
      final res = await apiPost(
        ApiConfig.otpSend,
        body: jsonEncode({
          'phone': phone,
          'purpose': purpose,
        }),
      );
      if (res.statusCode != 200) {
        String msg = 'Failed to send OTP (${res.statusCode})';
        try {
          final data = jsonDecode(res.body) as Map<String, dynamic>;
          msg = data['message']?.toString() ?? msg;
        } catch (_) {}
        throw AuthApiException(msg);
      }
      return jsonDecode(res.body) as Map<String, dynamic>;
    } on AuthApiException {
      rethrow;
    } catch (e) {
      throw AuthApiException(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<AuthResult> verifyOtp({
    required String phone,
    required String otp,
    String purpose = 'login',
    String? name,
  }) async {
    try {
      final res = await apiPost(
        ApiConfig.otpVerify,
        body: jsonEncode({
          'phone': phone,
          'otp': otp,
          'purpose': purpose,
          'language': _currentLanguage,
          if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
        }),
      );
      return await _parseAuthResponse(res);
    } on AuthApiException {
      rethrow;
    } catch (e) {
      throw AuthApiException(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<DeliveryBoy?>? _fetchMeInFlight;

  Future<DeliveryBoy?> fetchMe() async {
    if (!isLoggedIn) return null;
    if (_fetchMeInFlight != null) return _fetchMeInFlight;
    _fetchMeInFlight = _fetchMeInternal().whenComplete(() {
      _fetchMeInFlight = null;
    });
    return _fetchMeInFlight;
  }

  Future<DeliveryBoy?> _fetchMeInternal() async {
    try {
      final res = await apiGet(ApiConfig.me, headers: _authHeaders);
      if (res.statusCode != 200) {
        if (res.statusCode == 401) await clearSession();
        return null;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final boy = DeliveryBoy.fromJson(
        body['deliveryBoy'] as Map<String, dynamic>,
      );
      await _persist(_token!, boy);
      return boy;
    } catch (_) {
      return null;
    }
  }

  /// Saves onboarding fields into the same DeliveryBoy document.
  /// Returns true on success. Throws [AuthApiException] on API failure.
  Future<bool> updateOnboarding({
    String? step,
    bool? complete,
    Map<String, dynamic>? data,
    Duration timeout = const Duration(seconds: 60),
  }) async {
    if (!isLoggedIn) {
      throw AuthApiException('Please login again to continue onboarding');
    }
    final Map<String, dynamic> payload = {
      ...?data,
    };
    if (step != null) payload['onboardingStep'] = step;
    if (complete != null) payload['onboardingComplete'] = complete;

    final res = await apiPatch(
      ApiConfig.onboarding,
      headers: _authHeaders,
      body: jsonEncode(payload),
      timeout: timeout,
    );
    if (res.statusCode != 200) {
      String message = 'Could not save onboarding data (${res.statusCode})';
      try {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        message = body['message']?.toString() ?? message;
      } catch (_) {}
      throw AuthApiException(message);
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final boy = DeliveryBoy.fromJson(
      body['deliveryBoy'] as Map<String, dynamic>,
    );
    await _persist(_token!, boy);
    return true;
  }

  /// Immediate online/offline update in DB.
  Future<DeliveryBoy?> updateStatus(String status) async {
    if (!isLoggedIn) return null;
    try {
      final res = await apiPatch(
        ApiConfig.status,
        headers: _authHeaders,
        body: jsonEncode({'status': status}),
      );
      if (res.statusCode != 200) {
        try {
          final body = jsonDecode(res.body) as Map<String, dynamic>;
          throw AuthApiException(
            body['message']?.toString() ?? 'Could not update status',
          );
        } on AuthApiException {
          rethrow;
        } catch (_) {
          return null;
        }
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final boy = DeliveryBoy.fromJson(
        body['deliveryBoy'] as Map<String, dynamic>,
      );
      RiderLiveService.instance.applyStatusResponse(body);
      await _persist(_token!, boy);
      return boy;
    } on AuthApiException {
      rethrow;
    } catch (e) {
      throw AuthApiException(
        'Cannot reach ${ApiConfig.baseUrl}\n$e',
      );
    }
  }

  Future<List<String>> consumeSlotCancellationAlerts() async {
    if (!isLoggedIn) return [];
    try {
      final res = await apiGet(ApiConfig.me, headers: _authHeaders);
      if (res.statusCode != 200) return [];
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final boyMap = body['deliveryBoy'];
      if (boyMap is! Map<String, dynamic>) return [];

      // Keep local session fresh from this same response (avoids an extra /me).
      try {
        final boy = DeliveryBoy.fromJson(boyMap);
        await _persist(_token!, boy);
      } catch (_) {}

      final raw = boyMap['pendingSlotAlerts'];
      final messages = <String>[];
      if (raw is List) {
        for (final item in raw) {
          if (item is Map && item['message'] != null) {
            final msg = item['message'].toString().trim();
            if (msg.isNotEmpty) messages.add(msg);
          } else if (item is String && item.trim().isNotEmpty) {
            messages.add(item);
          }
        }
      }
      if (messages.isNotEmpty) {
        await apiPost(
          ApiConfig.slotAlertsAck,
          headers: _authHeaders,
          body: jsonEncode({}),
        );
      }
      return messages;
    } catch (_) {
      return [];
    }
  }

  Future<AreaManagerInfo?> fetchAreaManager() async {
    if (!isLoggedIn) return null;
    try {
      final res = await apiGet(ApiConfig.areaManager, headers: _authHeaders);
      if (res.statusCode != 200) return null;
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final manager = body['manager'];
      if (manager is! Map<String, dynamic>) return null;
      return AreaManagerInfo.fromJson(manager);
    } catch (_) {
      return null;
    }
  }

  /// Areas in a city where a delivery manager has registered an active hub.
  Future<List<String>> fetchHubAreasForCity({
    required String cityId,
    required String cityName,
  }) async {
    final res = await apiGet(ApiConfig.activeHubs);
    if (res.statusCode != 200) {
      throw AuthApiException('Could not load areas (${res.statusCode})');
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    String norm(Object? v) =>
        (v ?? '').toString().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    final wantId = norm(cityId);
    final wantName = norm(cityName);
    final seen = <String>{};
    final areas = <String>[];
    for (final hub in (body['activeHubs'] as List? ?? const [])) {
      if (hub is! Map) continue;
      final matchesCity = (wantId.isNotEmpty && norm(hub['cityId']) == wantId) ||
          (wantName.isNotEmpty && norm(hub['city']) == wantName);
      final area = (hub['area'] ?? '').toString().trim();
      if (!matchesCity || area.isEmpty) continue;
      if (seen.add(norm(area))) areas.add(area);
    }
    areas.sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
    return areas;
  }

  Future<AreaManagerInfo?> fetchAreaManagerByLocation(String cityId, String area) async {
    final stores = await fetchAreaManagersByLocation(cityId, area);
    return stores.isEmpty ? null : stores.first;
  }

  Future<List<AreaManagerInfo>> fetchAreaManagersByLocation(
    String cityId,
    String area, {
    String? city,
  }) async {
    var path =
        '${ApiConfig.areaManager}?cityId=${Uri.encodeComponent(cityId)}&area=${Uri.encodeComponent(area)}';
    if (city != null && city.isNotEmpty) {
      path += '&city=${Uri.encodeComponent(city)}';
    }
    final res = await apiGet(path, headers: isLoggedIn ? _authHeaders : null);
    if (res.statusCode != 200) return [];
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final list = <AreaManagerInfo>[];
    final managers = body['managers'];
    if (managers is List) {
      for (final item in managers) {
        if (item is Map<String, dynamic>) {
          list.add(AreaManagerInfo.fromJson(item));
        }
      }
    }
    if (list.isEmpty) {
      final manager = body['manager'];
      if (manager is Map<String, dynamic>) {
        list.add(AreaManagerInfo.fromJson(manager));
      }
    }
    return list;
  }

  /// Keep online status live while the partner is working.
  Future<void> sendHeartbeat() async {
    if (!isLoggedIn) return;
    try {
      final pos = await LocationService.instance.getCurrentLocation();
      final payload = <String, dynamic>{};
      if (pos != null) {
        payload['lat'] = pos.latitude;
        payload['lng'] = pos.longitude;
      }
      final res = await apiPost(
        ApiConfig.heartbeat,
        headers: _authHeaders,
        body: jsonEncode(payload),
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        final boy = DeliveryBoy.fromJson(
          body['deliveryBoy'] as Map<String, dynamic>,
        );
        await _persist(_token!, boy);
      }
    } catch (_) {
      // Offline / reverse tunnel dropped — ignore.
    }
  }

  Map<String, String> get authHeaders => _authHeaders;

  Map<String, String> get _authHeaders => {
        'Authorization': 'Bearer $_token',
      };

  Future<AuthResult> _parseAuthResponse(http.Response res) async {
    Map<String, dynamic> body;
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw AuthApiException('Unable to reach server');
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw AuthApiException(
        body['message']?.toString() ?? 'Authentication failed',
      );
    }

    final token = body['token']?.toString() ?? '';
    final boyJson = body['deliveryBoy'] as Map<String, dynamic>?;
    if (token.isEmpty || boyJson == null) {
      throw AuthApiException('Invalid server response');
    }

    final boy = DeliveryBoy.fromJson(boyJson);
    await _persist(token, boy);
    return AuthResult(token: token, deliveryBoy: boy);
  }

  static String routeForStep(
    String step, {
    required bool complete,
    DeliveryBoy? boy,
    String? lastRoute,
  }) {
    final isComplete = complete ||
        (boy != null &&
            (boy.onboardingComplete ||
                boy.onboardingStep == 'home' ||
                boy.verificationStatus == 'approved'));

    if (isComplete) {
      if (lastRoute != null &&
          lastRoute.isNotEmpty &&
          lastRoute != '/' &&
          lastRoute != '/splash') {
        return lastRoute;
      }
      return '/home';
    }

    return switch (step) {
      'city' => '/select-city',
      'area' => '/select-area',
      'documents' => '/upload-documents',
      'selfie' => '/take-selfie',
      'home' => '/home',
      _ => '/select-vehicle',
    };
  }

  static Object? argumentsForStep(DeliveryBoy? boy) {
    if (boy == null) return null;
    if (boy.onboardingStep == 'area') {
      return boy.cityId.isNotEmpty ? boy.cityId : null;
    }
    return null;
  }
}
