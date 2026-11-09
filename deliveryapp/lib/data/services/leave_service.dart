import 'dart:convert';

import '../../core/config/api_config.dart';
import '../../core/l10n/app_l10n.dart';
import 'auth_service.dart';

class LeaveRequestItem {
  const LeaveRequestItem({
    required this.id,
    required this.leaveType,
    required this.reason,
    required this.status,
    required this.dates,
    this.adminNotes,
  });

  final String id;
  final String leaveType;
  final String reason;
  final String status;
  final List<String> dates;
  final String? adminNotes;

  factory LeaveRequestItem.fromJson(Map<String, dynamic> json) {
    final rawDates = json['dates'];
    final dates = rawDates is List
        ? rawDates.map((e) => e.toString()).where((e) => e.isNotEmpty).toList()
        : <String>[
            if ((json['fromDate']?.toString() ?? '').isNotEmpty)
              json['fromDate'].toString(),
          ];
    return LeaveRequestItem(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      leaveType: json['leaveType']?.toString() ?? 'casual',
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString() ?? 'pending',
      dates: dates,
      adminNotes: json['adminNotes']?.toString(),
    );
  }
}

class LeaveService {
  LeaveService._();
  static final LeaveService instance = LeaveService._();

  Map<String, String> get _authHeaders {
    final token = AuthService.instance.token;
    return {
      ...ApiConfig.defaultHeaders,
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Future<List<LeaveRequestItem>> fetchMine() async {
    final res = await apiGet(
      '/api/admin-ops/hr/leaves/mine',
      headers: _authHeaders,
    );
    if (res.statusCode < 200 || res.statusCode >= 300) return [];
    final decoded = jsonDecode(res.body);
    final rows = decoded is Map && decoded['data'] is List
        ? decoded['data'] as List
        : const [];
    return rows
        .whereType<Map>()
        .map((row) => LeaveRequestItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<void> apply({
    required String leaveType,
    required String reason,
    required List<String> dates,
    String? name,
  }) async {
    final boy = AuthService.instance.deliveryBoy;
    final res = await apiPost(
      '/api/admin-ops/hr/leaves/apply',
      headers: _authHeaders,
      body: jsonEncode({
        'leaveType': leaveType,
        'reason': reason,
        'dates': dates,
        'name': name ?? boy?.name ?? '',
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      String message = appL10n.ftCouldNotSubmitLeave;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map && decoded['message'] != null) {
          message = decoded['message'].toString();
        }
      } catch (_) {}
      throw Exception(message);
    }
  }
}
