import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/api_config.dart';

class HrAnnouncement {
  const HrAnnouncement({
    required this.id,
    required this.title,
    required this.body,
    this.publishedAt,
    this.kind = 'announcement',
    this.status = 'published',
    this.date,
  });

  final String id;
  final String title;
  final String body;
  final DateTime? publishedAt;
  final String kind;
  final String status;
  final String? date;

  factory HrAnnouncement.fromJson(Map<String, dynamic> json) {
    final kind = json['kind']?.toString() ??
        json['category']?.toString() ??
        'announcement';
    return HrAnnouncement(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      publishedAt: json['publishedAt'] != null
          ? DateTime.tryParse(json['publishedAt'].toString())
          : null,
      kind: kind,
      status: json['status']?.toString() ?? 'published',
      date: (json['date'] ?? json['scheduledAt'] ?? json['publishedAt'])
          ?.toString()
          .split('T')
          .first,
    );
  }
}

class AnnouncementService {
  AnnouncementService._();
  static final AnnouncementService instance = AnnouncementService._();

  static const _readIdsKey = 'read_announcement_ids';

  Future<Set<String>> _readIds() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_readIdsKey) ?? const []).toSet();
  }

  /// Read announcements leave the home page; they stay in Notifications.
  Future<void> markRead(String id) async {
    if (id.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final ids = (prefs.getStringList(_readIdsKey) ?? <String>[]).toList();
    if (ids.contains(id)) return;
    ids.add(id);
    // Keep the list bounded — old announcements expire server-side anyway.
    final trimmed = ids.length > 200 ? ids.sublist(ids.length - 200) : ids;
    await prefs.setStringList(_readIdsKey, trimmed);
  }

  Future<List<HrAnnouncement>> fetchLive() async {
    final results = await Future.wait([
      _getList('/api/admin-ops/hr/announcements/live?role=delivery_boy'),
      _getList('/api/admin-ops/hr/calendar/live?role=delivery_boy'),
    ]);
    final readIds = await _readIds();
    final announcements = results[0]
        .map(HrAnnouncement.fromJson)
        .where((item) => item.title.isNotEmpty)
        .toList();
    final seen = announcements.map((item) => item.id).toSet();
    final calendarExtras = results[1]
        .map(HrAnnouncement.fromJson)
        .where((item) {
          if (item.title.isEmpty || item.id.isEmpty) return false;
          if (seen.contains(item.id)) return false;
          if (item.status == 'published' &&
              (item.kind == 'announcement' ||
                  item.kind == 'holiday' ||
                  item.kind == 'note')) {
            return false;
          }
          return true;
        });
    return [...announcements, ...calendarExtras]
        .where((item) => !readIds.contains(item.id))
        .take(5)
        .toList();
  }

  Future<List<Map<String, dynamic>>> _getList(String path) async {
    final res = await apiGet(path);
    if (res.statusCode < 200 || res.statusCode >= 300) return const [];
    final decoded = jsonDecode(res.body);
    final rows = decoded is Map && decoded['data'] is List
        ? decoded['data'] as List
        : const [];
    return rows
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }
}
