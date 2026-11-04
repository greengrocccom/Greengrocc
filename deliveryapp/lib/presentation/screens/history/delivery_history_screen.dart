import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../../core/config/api_config.dart';
import '../../../core/config/cached_get.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/online_duration.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/common/app_panel.dart';
import '../../widgets/layout/custom_app_bar.dart';

class DeliveryHistoryScreen extends StatefulWidget {
  const DeliveryHistoryScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<DeliveryHistoryScreen> createState() => _DeliveryHistoryScreenState();
}

class _DeliveryHistoryScreenState extends State<DeliveryHistoryScreen> {
  String _range = 'day';
  bool _loading = true;
  String? _error;
  List<_DayBox> _days = const [];
  _ActivityMetrics _totals = _ActivityMetrics.empty;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final range = _range;
    try {
      await cachedApiGet(
        ApiConfig.activityHistory(range: range),
        headers: AuthService.instance.authHeaders,
        onData: (body) {
          if (body['success'] != true || body['data'] is! Map) {
            throw Exception('Invalid response');
          }
          final data = Map<String, dynamic>.from(body['data'] as Map);
          final daysRaw = (data['days'] as List?) ?? const [];
          final totalsRaw = (data['totals'] as Map?)?.cast<String, dynamic>() ?? {};
          if (!mounted || range != _range) return;
          setState(() {
            _days = daysRaw
                .whereType<Map>()
                .map((e) => _DayBox.fromJson(Map<String, dynamic>.from(e)))
                .where((day) => range != 'day' || day.isToday)
                .toList();
            _totals = _ActivityMetrics.fromJson(totalsRaw);
            _loading = false;
          });
        },
      );
    } catch (e) {
      if (range != _range) return;
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
        _days = const [];
        _totals = _ActivityMetrics.empty;
      });
    }
  }

  void _setRange(String range) {
    if (_range == range) return;
    setState(() => _range = range);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final body = Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.sm,
          ),
          child: _RangeChips(
            range: _range,
            dayLabel: l10n.today,
            weekLabel: l10n.week,
            monthLabel: l10n.month,
            onChanged: _setRange,
          ),
        ),
        Expanded(child: _buildBody(l10n)),
      ],
    );

    if (widget.embedded) {
      return ColoredBox(color: AppColors.background, child: body);
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(
        title: l10n.deliveryHistory,
        showBackButton: true,
      ),
      body: body,
    );
  }

  static const _listPadding = EdgeInsets.fromLTRB(
    AppSpacing.lg,
    AppSpacing.sm,
    AppSpacing.lg,
    AppSpacing.xl,
  );

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading) {
      return const PageSkeleton(padding: _listPadding);
    }
    if (_error != null) {
      return RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: _listPadding,
          children: [
            AppPanel(
              child: Column(
                children: [
                  EmptyPanelMessage(
                    message: l10n.couldNotLoadHistory,
                    icon: Icons.cloud_off_rounded,
                  ),
                  TextButton(onPressed: _load, child: Text(l10n.tryAgain)),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: _listPadding,
        children: [
          if (_range != 'day' && _days.isNotEmpty) ...[
            AppPanel(
              title: _range == 'week' ? l10n.week : l10n.month,
              child: _ActivityChips(metrics: _totals),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          if (_days.isEmpty)
            AppPanel(
              child: EmptyPanelMessage(
                message: l10n.noActivityInPeriod,
                icon: Icons.history_rounded,
              ),
            )
          else ...[
            for (var i = 0; i < _days.length; i++) ...[
              if (i > 0) const SizedBox(height: AppSpacing.md),
              _DayHistoryCard(day: _days[i]),
            ],
          ],
        ],
      ),
    );
  }
}

class _RangeChips extends StatelessWidget {
  const _RangeChips({
    required this.range,
    required this.dayLabel,
    required this.weekLabel,
    required this.monthLabel,
    required this.onChanged,
  });

  final String range;
  final String dayLabel;
  final String weekLabel;
  final String monthLabel;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final options = [
      ('day', dayLabel),
      ('week', weekLabel),
      ('month', monthLabel),
    ];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: options.map((opt) {
          final selected = range == opt.$1;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(opt.$1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: selected
                      ? (isDark ? const Color(0xFF0F172A) : Colors.white)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: selected
                      ? [
                          BoxShadow(
                            color: isDark ? Colors.black26 : Colors.black12,
                            blurRadius: 4,
                            offset: const Offset(0, 1.5),
                          ),
                        ]
                      : null,
                ),
                child: Text(
                  opt.$2,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: selected
                        ? (isDark ? const Color(0xFF34D399) : AppColors.primary)
                        : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _DayHistoryCard extends StatelessWidget {
  const _DayHistoryCard({required this.day});

  final _DayBox day;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dateParts = day.date.split('-');
    final dateShort = dateParts.length == 3
        ? '${dateParts[2]}/${dateParts[1]}'
        : day.date;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: day.isToday
              ? (isDark ? const Color(0xFF10B981) : AppColors.primary)
              : AppColors.cardBorder,
          width: day.isToday ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                _localDayLabel(context, day),
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                dateShort,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              if (day.isToday) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF064E3B) : const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    l10n.today,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: isDark ? const Color(0xFF6EE7B7) : const Color(0xFF15803D),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          _ActivityChips(metrics: day.metrics),
        ],
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({
    required this.emoji,
    required this.label,
    required this.value,
  });

  final String emoji;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.cardSubBg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.cardSubBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 11)),
          const SizedBox(width: 4),
          Text(
            AppLocalizations.of(context).labelWithColon(label),
            style: GoogleFonts.inter(
              fontSize: 10.5,
              color: AppColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

String _localDayLabel(BuildContext context, _DayBox d) {
  final locale = Localizations.localeOf(context).toLanguageTag();
  final parts = d.date.split('-').map(int.tryParse).toList();
  if (parts.any((p) => p == null)) return d.dayLabel;
  try {
    if (parts.length == 3) {
      return DateFormat.E(locale).format(DateTime(parts[0]!, parts[1]!, parts[2]!));
    }
  } catch (_) {}
  return d.dayLabel;
}

class _DayBox {
  const _DayBox({
    required this.date,
    required this.dayLabel,
    required this.isToday,
    required this.metrics,
  });

  final String date;
  final String dayLabel;
  final bool isToday;
  final _ActivityMetrics metrics;

  factory _DayBox.fromJson(Map<String, dynamic> json) {
    return _DayBox(
      date: json['date']?.toString() ?? '',
      dayLabel: json['dayLabel']?.toString() ?? '',
      isToday: json['isToday'] == true,
      metrics: _ActivityMetrics.fromJson(json),
    );
  }
}

class _ActivityMetrics {
  const _ActivityMetrics({
    this.onlineMinutes = 0,
    this.shiftsBooked = 0,
    this.shiftsCompleted = 0,
    this.trips = 0,
    this.totalDistanceKm,
  });

  final int onlineMinutes;
  final int shiftsBooked;
  final int shiftsCompleted;
  final int trips;
  final double? totalDistanceKm;

  static const empty = _ActivityMetrics();

  factory _ActivityMetrics.fromJson(Map<String, dynamic> json) {
    return _ActivityMetrics(
      onlineMinutes: (json['onlineMinutes'] as num?)?.toInt() ?? 0,
      shiftsBooked: (json['shiftsBooked'] as num?)?.toInt() ?? 0,
      shiftsCompleted: (json['shiftsCompleted'] as num?)?.toInt() ?? 0,
      trips: (json['trips'] as num?)?.toInt() ?? 0,
      totalDistanceKm: (json['totalDistanceKm'] as num?)?.toDouble(),
    );
  }
}

class _ActivityChips extends StatelessWidget {
  const _ActivityChips({required this.metrics});

  final _ActivityMetrics metrics;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final distance = metrics.totalDistanceKm;
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        _MetricChip(emoji: '📅', label: l10n.shiftsBookedLabel, value: metrics.shiftsBooked.toString()),
        _MetricChip(emoji: '✅', label: l10n.completedShiftsLabel, value: metrics.shiftsCompleted.toString()),
        _MetricChip(emoji: '⏱️', label: l10n.onlineTime, value: formatOnlineDuration(metrics.onlineMinutes)),
        _MetricChip(
          emoji: '📍',
          label: l10n.distance,
          value: distance == null ? '—' : l10n.distanceKmValue(distance.toStringAsFixed(1)),
        ),
        _MetricChip(emoji: '🛵', label: l10n.tripsCompletedLabel, value: metrics.trips.toString()),
      ],
    );
  }
}
