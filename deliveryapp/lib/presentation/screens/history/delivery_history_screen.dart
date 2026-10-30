import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../../core/config/api_config.dart';
import '../../../core/config/cached_get.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/charts/chart_utils.dart';
import '../../widgets/charts/weekly_bar_chart.dart';
import '../../widgets/common/app_panel.dart';
import '../../widgets/layout/custom_app_bar.dart';

class DeliveryHistoryScreen extends StatefulWidget {
  const DeliveryHistoryScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<DeliveryHistoryScreen> createState() => _DeliveryHistoryScreenState();
}

class _DeliveryHistoryScreenState extends State<DeliveryHistoryScreen> {
  String _range = 'week';
  bool _loading = true;
  String? _error;
  List<_DayBox> _days = const [];
  _HistoryTotals _totals = _HistoryTotals.empty;

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
                .toList();
            _totals = _HistoryTotals.fromJson(totalsRaw);
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
        _totals = _HistoryTotals.empty;
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
            weekLabel: l10n.week,
            monthLabel: l10n.month,
            yearLabel: l10n.year,
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

  String _barLabel(_DayBox d) {
    if (_range == 'month') {
      final parts = d.date.split('-');
      return parts.length == 3 ? '${int.tryParse(parts[2]) ?? parts[2]}' : _localDayLabel(context, d);
    }
    if (_range == 'year') return _localDayLabel(context, d, monthOnly: true);
    return _localDayLabel(context, d);
  }

  String _barTooltip(_DayBox d) {
    final l10n = AppLocalizations.of(context);
    final label = _localDayLabel(context, d);
    final title = _range == 'year' ? label : '$label · ${d.date}';
    return '$title\n${rupeeAmount(d.earnings)} · ${l10n.tripsCount(d.trips)}\n${l10n.onlineDuration(d.onlineTime)}';
  }

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

    final chronological = _days.reversed.toList();
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: _listPadding,
        children: [
          _TotalsBar(totals: _totals),
          const SizedBox(height: AppSpacing.lg),
          if (_days.isEmpty)
            AppPanel(
              child: EmptyPanelMessage(
                message: l10n.noActivityInPeriod,
                icon: Icons.history_rounded,
              ),
            )
          else ...[
            AppPanel(
              title: l10n.earnings,
              subtitle: _range == 'year' ? l10n.monthlyEarnings : l10n.dailyEarnings,
              child: WeeklyBarChart(
                bars: [
                  for (final d in chronological)
                    ChartBar(
                      label: _barLabel(d),
                      value: d.earnings.toDouble(),
                      highlight: d.isToday,
                    ),
                ],
                labelEvery: _range == 'month' ? 5 : 1,
                axisLabel: (v) => '₹${compactNumber(v)}',
                tooltipLabel: (i) => _barTooltip(chronological[i]),
              ),
            ),
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
    required this.weekLabel,
    required this.monthLabel,
    required this.yearLabel,
    required this.onChanged,
  });

  final String range;
  final String weekLabel;
  final String monthLabel;
  final String yearLabel;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final options = [
      ('week', weekLabel),
      ('month', monthLabel),
      ('year', yearLabel),
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

class _TotalsBar extends StatelessWidget {
  const _TotalsBar({required this.totals});

  final _HistoryTotals totals;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: brandHeroDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.earnings,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
          const SizedBox(height: 1),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              rupeeAmount(totals.earnings),
              style: GoogleFonts.inter(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(child: HeroStat(label: l10n.trips, value: '${totals.trips}')),
                Expanded(child: HeroStat(label: l10n.online, value: totals.onlineTime)),
              ],
            ),
          ),
        ],
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
              const Spacer(),
              Text(
                rupeeAmount(day.total),
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: isDark ? const Color(0xFF34D399) : AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _MetricChip(
                emoji: '💰',
                label: l10n.earnShort,
                value: '₹${day.earnings}',
              ),
              _MetricChip(
                emoji: '⏱️',
                label: l10n.online,
                value: day.onlineTime,
              ),
              _MetricChip(
                emoji: '📅',
                label: l10n.shifts,
                value: l10n.shiftsBookedValue(day.shiftsBooked),
              ),
              _MetricChip(
                emoji: '✅',
                label: l10n.doneShort,
                value: l10n.shiftsDoneValue(day.shiftsCompleted),
              ),
              _MetricChip(
                emoji: '🛵',
                label: l10n.trips,
                value: '${day.trips}',
              ),
            ],
          ),
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

String _localDayLabel(BuildContext context, _DayBox d, {bool monthOnly = false}) {
  final locale = Localizations.localeOf(context).toLanguageTag();
  final parts = d.date.split('-').map(int.tryParse).toList();
  if (parts.any((p) => p == null)) return d.dayLabel;
  try {
    if (parts.length == 2) {
      final date = DateTime(parts[0]!, parts[1]!);
      return monthOnly ? DateFormat.MMM(locale).format(date) : DateFormat.yMMM(locale).format(date);
    }
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
    required this.earnings,
    required this.onlineMinutes,
    required this.onlineTime,
    required this.shiftsBooked,
    required this.shiftsCompleted,
    required this.trips,
    required this.total,
  });

  final String date;
  final String dayLabel;
  final bool isToday;
  final int earnings;
  final int onlineMinutes;
  final String onlineTime;
  final int shiftsBooked;
  final int shiftsCompleted;
  final int trips;
  final int total;

  factory _DayBox.fromJson(Map<String, dynamic> json) {
    final mins = (json['onlineMinutes'] as num?)?.toInt() ?? 0;
    return _DayBox(
      date: json['date']?.toString() ?? '',
      dayLabel: json['dayLabel']?.toString() ?? '',
      isToday: json['isToday'] == true,
      earnings: (json['earnings'] as num?)?.toInt() ?? 0,
      onlineMinutes: mins,
      onlineTime: json['onlineTime']?.toString() ?? '${mins ~/ 60}h ${mins % 60}m',
      shiftsBooked: (json['shiftsBooked'] as num?)?.toInt() ?? 0,
      shiftsCompleted: (json['shiftsCompleted'] as num?)?.toInt() ?? 0,
      trips: (json['trips'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ??
          (json['earnings'] as num?)?.toInt() ??
          0,
    );
  }
}

class _HistoryTotals {
  const _HistoryTotals({
    required this.earnings,
    required this.onlineTime,
    required this.trips,
  });

  final int earnings;
  final String onlineTime;
  final int trips;

  static const empty = _HistoryTotals(earnings: 0, onlineTime: '0m', trips: 0);

  factory _HistoryTotals.fromJson(Map<String, dynamic> json) {
    return _HistoryTotals(
      earnings: (json['earnings'] as num?)?.toInt() ??
          (json['total'] as num?)?.toInt() ??
          0,
      onlineTime: json['onlineTime']?.toString() ?? '0m',
      trips: (json['trips'] as num?)?.toInt() ?? 0,
    );
  }
}
