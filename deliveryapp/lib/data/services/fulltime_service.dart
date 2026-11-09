import 'dart:convert';

import '../../core/config/api_config.dart';
import '../../core/l10n/app_l10n.dart';
import 'auth_service.dart';

class FullTimeApiException implements Exception {
  FullTimeApiException(this.message, {this.code});
  final String message;
  final String? code;

  @override
  String toString() => message;
}

/// Full-Time driver APIs: attendance, rules, manually assigned orders.
class FullTimeService {
  FullTimeService._();
  static final FullTimeService instance = FullTimeService._();

  Map<String, dynamic> _decode(String body) {
    try {
      final v = jsonDecode(body);
      return v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await apiGet(path, headers: AuthService.instance.authHeaders);
    final body = _decode(res.body);
    if (res.statusCode != 200 || body['success'] == false) {
      throw FullTimeApiException(
        body['message']?.toString() ?? appL10n.ftRequestFailed('${res.statusCode}'),
        code: body['code']?.toString(),
      );
    }
    return body;
  }

  Future<Map<String, dynamic>> fetchAttendanceToday() =>
      _get(ApiConfig.fullTimeAttendanceToday);

  Future<Map<String, dynamic>> fetchRules() => _get(ApiConfig.fullTimeRules);

  Future<Map<String, dynamic>> fetchAssignedOrders() =>
      _get(ApiConfig.fullTimeAssignedOrders);

  Future<Map<String, dynamic>> markAttendance({double? lat, double? lng}) async {
    final res = await apiPost(
      ApiConfig.fullTimeAttendanceMark,
      headers: AuthService.instance.authHeaders,
      body: jsonEncode({
        'lat': ?lat,
        'lng': ?lng,
      }),
    );
    final body = _decode(res.body);
    if (res.statusCode != 200 || body['success'] != true) {
      throw FullTimeApiException(
        body['message']?.toString() ?? appL10n.ftCouldNotMarkAttendance,
        code: body['code']?.toString(),
      );
    }
    return body;
  }
}
