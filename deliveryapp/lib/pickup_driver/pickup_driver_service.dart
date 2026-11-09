import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../core/config/api_config.dart';
import '../core/l10n/app_l10n.dart';
import '../live/live_cache.dart';

/// Error from the vendor pickup-driver API (farmer → collection centre).
class PickupDriverException implements Exception {
  PickupDriverException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => message;
}

/// Result of `GET /api/vendor/driver-desk/pickups`.
class PickupListResult {
  const PickupListResult({required this.stats, required this.pickups});

  final Map<String, dynamic> stats;
  final List<Map<String, dynamic>> pickups;

  static const empty = PickupListResult(stats: {}, pickups: []);
}

/// Session + API client for vendor-created pickup drivers.
///
/// Kept separate from [AuthService] (dark-store delivery boys): different
/// backend (`/api/vendor/...`), different token and different storage keys.
class PickupDriverService {
  PickupDriverService._() {
    _live.configure(
      baseUrl: () => ApiConfig.baseUrl,
      token: () => _token,
      fetch: _get,
    );
  }
  static final PickupDriverService instance = PickupDriverService._();

  /// Pickup lists/details cached on the device and patched by server pushes.
  final LiveCache _live = LiveCache();

  static const _tokenKey = 'pickup_driver_token';
  static const _driverKey = 'pickup_driver';

  static const _authBase = '/api/vendor/auth/driver';
  static const _deskBase = '/api/vendor/driver-desk';

  String? _token;
  Map<String, dynamic>? _driver;
  bool _loaded = false;

  String? get token => _token;
  Map<String, dynamic>? get driver => _driver;
  bool get isLoggedIn => _token != null && _token!.isNotEmpty;

  String get driverName {
    final name = _nameOrMobile;
    return name.isNotEmpty ? name : appL10n.pkDriver;
  }

  String get _nameOrMobile {
    final d = _driver ?? const {};
    final name = '${d['name'] ?? ''}'.trim();
    if (name.isNotEmpty) return name;
    return '${d['mobile'] ?? ''}'.trim();
  }

  Map<String, String> get _headers => {
        if (isLoggedIn) 'Authorization': 'Bearer $_token',
      };

  Future<void> loadSession() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    final raw = prefs.getString(_driverKey);
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) _driver = Map<String, dynamic>.from(decoded);
      } catch (_) {}
    }
    _loaded = true;
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    if (_token == null) {
      await prefs.remove(_tokenKey);
    } else {
      await prefs.setString(_tokenKey, _token!);
    }
    if (_driver == null) {
      await prefs.remove(_driverKey);
    } else {
      await prefs.setString(_driverKey, jsonEncode(_driver));
    }
  }

  Future<void> logout() async {
    _token = null;
    _driver = null;
    _loaded = true;
    await _persist();
    await _live.onAuthChanged();
  }

  /// Login with the mobile + password the vendor created for this driver.
  Future<Map<String, dynamic>> login({
    required String mobile,
    required String password,
  }) async {
    final res = await apiPost(
      '$_authBase/login',
      body: jsonEncode({'mobile': mobile.trim(), 'password': password}),
    );
    final data = _decodeMap(res);
    final token = '${data['token'] ?? ''}';
    if (token.isEmpty) {
      throw PickupDriverException(appL10n.pkLoginFailed,
          statusCode: res.statusCode);
    }
    _token = token;
    final driver = data['driver'];
    _driver = driver is Map ? Map<String, dynamic>.from(driver) : {};
    _loaded = true;
    await _persist();
    await _live.onAuthChanged();
    return _driver!;
  }

  Future<Map<String, dynamic>> fetchMe() async {
    final data = await _get('$_authBase/me');
    _driver = data;
    await _persist();
    return data;
  }

  // ── Pickups ──────────────────────────────────────────────────────────────

  /// [filter] is one of `assigned`, `progress`, `completed`, `history`, `all`.
  Future<PickupListResult> listPickups(String filter) async {
    final data = await _getLive(_pickupsPath(filter));
    final stats = data['stats'];
    return PickupListResult(
      stats: stats is Map ? Map<String, dynamic>.from(stats) : const {},
      pickups: _mapList(data['pickups']),
    );
  }

  Future<Map<String, dynamic>> getPickup(String id) => _getLive(_pickupPath(id));

  Future<Map<String, dynamic>> getBatch(String batchId) => _getLive(_batchPath(batchId));

  /// Emits whenever the server pushes a change to that list / pickup / batch;
  /// re-read it with [listPickups] / [getPickup] / [getBatch] (served from memory).
  Stream<void> watchPickups(String filter) => _watch(_pickupsPath(filter));
  Stream<void> watchPickup(String id) => _watch(_pickupPath(id));
  Stream<void> watchBatch(String batchId) => _watch(_batchPath(batchId));

  static String _pickupsPath(String filter) =>
      '$_deskBase/pickups?filter=${Uri.encodeQueryComponent(filter)}';
  static String _pickupPath(String id) => '$_deskBase/pickups/${Uri.encodeComponent(id)}';
  static String _batchPath(String batchId) => '$_deskBase/batches/${Uri.encodeComponent(batchId)}';

  /// Skips the first value (the screen's own initial load) and errors (the
  /// screen's next load reports them).
  Stream<void> _watch(String path) {
    var first = true;
    return _live
        .watch(path)
        .handleError((_) {})
        .where((_) {
          if (!first) return true;
          first = false;
          return false;
        })
        .map((_) {});
  }

  Future<Map<String, dynamic>> accept(String id) => _step(id, 'accept');

  /// Sends the pickup back to the vendor for another driver.
  Future<Map<String, dynamic>> reject(String id, {String reason = ''}) =>
      _step(id, 'reject', body: {'reason': reason});

  Future<Map<String, dynamic>> start(String id) => _step(id, 'start');
  Future<Map<String, dynamic>> arrive(String id) => _step(id, 'arrive');
  Future<Map<String, dynamic>> checkOrder(String id) => _step(id, 'check-order');
  Future<Map<String, dynamic>> transit(String id) => _step(id, 'transit');
  Future<Map<String, dynamic>> arriveCentre(String id) =>
      _step(id, 'arrive-centre');

  Future<Map<String, dynamic>> verifyQr(String id, String qrPayload) =>
      _step(id, 'verify-qr', body: {'qrPayload': qrPayload});

  /// [photos] are `data:image/jpeg;base64,...` strings (1–4, each < 2.5 MB).
  Future<Map<String, dynamic>> confirm(String id, List<String> photos) => _step(
        id,
        'confirm',
        body: {'photos': photos},
        timeout: const Duration(seconds: 60),
      );

  Future<Map<String, dynamic>> _step(
    String id,
    String action, {
    Map<String, dynamic>? body,
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final res = await apiPost(
      '$_deskBase/pickups/${Uri.encodeComponent(id)}/$action',
      headers: _headers,
      body: jsonEncode(body ?? const {}),
      timeout: timeout,
    );
    return _decodeMap(res);
  }

  // ── Notifications (sent by the vendor / centre side) ────────────────────

  Future<void> registerPushToken(String token) async {
    final res = await apiPost(
      '$_authBase/push-token',
      headers: _headers,
      body: jsonEncode({'token': token, 'platform': 'android'}),
    );
    _decodeMap(res);
  }

  Future<void> removePushToken(String token) async {
    final req = http.Request(
      'DELETE',
      Uri.parse('${ApiConfig.baseUrl}$_authBase/push-token'),
    )
      ..headers.addAll({...ApiConfig.defaultHeaders, ..._headers})
      ..body = jsonEncode({'token': token});
    await req.send().timeout(const Duration(seconds: 10));
  }

  Future<({int unread, List<Map<String, dynamic>> items})>
      notifications() async {
    final data = await _get('$_deskBase/notifications?limit=50');
    final unread = data['unread'];
    return (
      unread: unread is num ? unread.toInt() : 0,
      items: _mapList(data['data']),
    );
  }

  Future<void> readAllNotifications() async {
    final res = await apiPost(
      '$_deskBase/notifications/read-all',
      headers: _headers,
      body: '{}',
    );
    _decodeMap(res);
  }

  // ── HR: leave, policies, announcements ──────────────────────────────────

  Future<List<Map<String, dynamic>>> liveAnnouncements() async {
    final data =
        await _get('/api/admin-ops/hr/announcements/live?role=pickup_driver');
    return _mapList(data['data']);
  }

  Future<List<Map<String, dynamic>>> livePolicies() async {
    final data = await _get('/api/admin-ops/policies/live?role=pickup_driver');
    return _mapList(data['data']);
  }

  Future<List<Map<String, dynamic>>> myLeaves() async {
    final data = await _get('/api/admin-ops/hr/leaves/mine');
    return _mapList(data['data']);
  }

  Future<void> applyLeave({
    required String leaveType,
    required String reason,
    required List<String> dates,
  }) async {
    final res = await apiPost(
      '/api/admin-ops/hr/leaves/apply',
      headers: _headers,
      body: jsonEncode({
        'leaveType': leaveType,
        'reason': reason,
        'dates': dates,
        'name': _nameOrMobile.isNotEmpty ? _nameOrMobile : 'Driver',
      }),
    );
    _decodeMap(res);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await apiGet(
      path,
      headers: _headers,
      timeout: const Duration(seconds: 20),
    );
    return _decodeMap(res);
  }

  Future<Map<String, dynamic>> _getLive(String path) async {
    final dynamic body;
    try {
      body = await _live.get(path);
    } on LiveCacheException catch (e) {
      throw PickupDriverException(
        e.status == 401
            ? appL10n.pkSessionExpired
            : appL10n.pkRequestFailed('${e.status}'),
        statusCode: e.status,
      );
    }
    if (body is Map) return Map<String, dynamic>.from(body);
    if (body is List) return {'data': body};
    return {};
  }

  Map<String, dynamic> _decodeMap(http.Response res) {
    dynamic body;
    try {
      body = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      body = null;
    }
    if (res.statusCode >= 400) {
      final msg = body is Map ? '${body['message'] ?? body['error'] ?? ''}' : '';
      throw PickupDriverException(
        msg.isNotEmpty ? msg : appL10n.pkRequestFailed('${res.statusCode}'),
        statusCode: res.statusCode,
      );
    }
    if (body is Map) return Map<String, dynamic>.from(body);
    if (body is List) return {'data': body};
    return {};
  }

  static List<Map<String, dynamic>> _mapList(dynamic raw) {
    if (raw is! List) return [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
