import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/config/api_config.dart';
import '../../../core/config/cached_get.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/charts/weekly_bar_chart.dart';
import '../../widgets/common/app_panel.dart';
import '../../widgets/layout/custom_app_bar.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _loading = true;
  String? _error;
  String _todayDate = '';
  String _online = '0h 0m';
  int _trips = 0;
  int _shiftsBooked = 0;
  int _shiftsCompleted = 0;
  List<_DayBox> _days = const [];
  bool _showTrips = false;

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
    try {
      await cachedApiGet(
        ApiConfig.attendanceToday,
        headers: AuthService.instance.authHeaders,
        onData: (body) {
          final daysRaw = (body['calendarDays'] as List?) ?? const [];
          if (!mounted) return;
          setState(() {
            _loading = false;
            _todayDate = body['date']?.toString() ?? '';
            _online = body['totalOnlineFormatted']?.toString() ?? '0h 0m';
            _trips = (body['totalTrips'] as num?)?.toInt() ?? 0;
            _shiftsBooked = (body['shiftsBooked'] as num?)?.toInt() ?? 0;
            _shiftsCompleted = (body['shiftsCompleted'] as num?)?.toInt() ?? 0;
            _days = daysRaw
                .whereType<Map>()
                .map((e) => _DayBox.fromJson(Map<String, dynamic>.from(e)))
                .toList();
          });
        },
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load attendance. Pull to retry.';
      });
    }
  }

  static String _fmtMinutes(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h == 0) return '${m}m';
    return '${h}h ${m}m';
  }

  void _showDayDetails(_DayBox day) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '${day.dayLabel} · ${day.date}',
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _DetailTile(
                      icon: Icons.schedule_outlined,
                      label: 'Online time',
                      value: day.onlineTime,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _DetailTile(
                      icon: Icons.delivery_dining_outlined,
                      label: 'Total trips',
                      value: '${day.trips}',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _DetailTile(
                      icon: Icons.event_available_outlined,
                      label: 'Shifts booked',
                      value: '${day.shiftsBooked}',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _DetailTile(
                      icon: Icons.check_circle_outline,
                      label: 'Completed',
                      value: '${day.shiftsCompleted}',
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(
        title: l10n.attendance,
        subtitle: _todayDate.isEmpty
            ? l10n.trackWorkingHours
            : 'Today · $_todayDate',
        showBackButton: true,
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: _loading
            ? const PageSkeleton()
            : _error != null
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    children: [ErrorPanel(message: _error!, onRetry: _load)],
                  )
                : _content(),
      ),
    );
  }

  Widget _content() {
    final weekMinutes = _days.fold<int>(0, (s, d) => s + d.onlineMinutes);
    final weekTrips = _days.fold<int>(0, (s, d) => s + d.trips);
    final activeDays = _days.where((d) => d.onlineMinutes > 0 || d.trips > 0).length;
    final weekShiftsBooked = _days.fold<int>(0, (s, d) => s + d.shiftsBooked);
    final weekShiftsDone = _days.fold<int>(0, (s, d) => s + d.shiftsCompleted);

    final bars = [
      for (final d in _days)
        ChartBar(
          label: d.dayLabel.length > 3 ? d.dayLabel.substring(0, 3) : d.dayLabel,
          value: _showTrips ? d.trips.toDouble() : d.onlineMinutes / 60,
          highlight: d.isToday,
        ),
    ];

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxxl),
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.xl),
          decoration: brandHeroDecoration(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Today’s progress',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Icon(Icons.timer_outlined, color: Colors.white.withValues(alpha: 0.9)),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'Online time',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                _online,
                style: GoogleFonts.inter(
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Expanded(child: HeroStat(label: 'Trips', value: '$_trips')),
                    Expanded(child: HeroStat(label: 'Shifts booked', value: '$_shiftsBooked')),
                    Expanded(child: HeroStat(label: 'Completed', value: '$_shiftsCompleted')),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        const SectionLabel('This week', subtitle: 'Last 7 days'),
        KpiGrid(
          children: [
            KpiTile(
              label: 'Online hours',
              value: _fmtMinutes(weekMinutes),
              icon: Icons.schedule_rounded,
            ),
            KpiTile(
              label: 'Trips delivered',
              value: '$weekTrips',
              icon: Icons.delivery_dining_rounded,
              accent: AppColors.info,
            ),
            KpiTile(
              label: 'Active days',
              value: '$activeDays / ${_days.length}',
              icon: Icons.event_available_rounded,
              accent: const Color(0xFF8B5CF6),
            ),
            KpiTile(
              label: 'Shifts completed',
              value: '$weekShiftsDone / $weekShiftsBooked',
              icon: Icons.task_alt_rounded,
              accent: AppColors.warning,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AppPanel(
          title: _showTrips ? 'Trips per day' : 'Online hours per day',
          subtitle: 'Tap a bar for day details',
          trailing: _MetricToggle(
            showTrips: _showTrips,
            onChanged: (v) => setState(() => _showTrips = v),
          ),
          child: WeeklyBarChart(
            bars: bars,
            color: _showTrips ? AppColors.info : AppColors.primary,
            emptyMessage: 'No activity recorded this week',
            axisLabel: (v) {
              final s = v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(1);
              return _showTrips ? s : '${s}h';
            },
            tooltipLabel: (i) {
              final d = _days[i];
              return '${d.dayLabel}\n${d.onlineTime} · ${d.trips} trip${d.trips == 1 ? '' : 's'}';
            },
            onBarTap: (i) {
              if (i >= 0 && i < _days.length) _showDayDetails(_days[i]);
            },
          ),
        ),
        AppPanel(
          title: 'Week calendar',
          subtitle: 'Tap a day to see online time and trips',
          child: _days.isEmpty
              ? const EmptyPanelMessage(message: 'No days to show yet.', icon: Icons.calendar_today_outlined)
              : Column(
                  children: [
                    Row(
                      children: [
                        for (final d in _days)
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 3),
                              child: _DayPill(day: d, onTap: () => _showDayDetails(d)),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Wrap(
                      spacing: 14,
                      runSpacing: 6,
                      children: [
                        LegendDot(color: AppColors.primary, label: 'Active'),
                        LegendDot(color: AppColors.border, label: 'No activity'),
                      ],
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _MetricToggle extends StatelessWidget {
  const _MetricToggle({required this.showTrips, required this.onChanged});

  final bool showTrips;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget chip(String label, bool selected, VoidCallback onTap) {
      return GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? AppColors.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: selected
                ? [BoxShadow(color: AppColors.shadow, blurRadius: 4, offset: const Offset(0, 1))]
                : null,
          ),
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: selected ? AppColors.textPrimary : AppColors.textMuted,
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.cardSubBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.cardSubBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          chip('Hours', !showTrips, () => onChanged(false)),
          chip('Trips', showTrips, () => onChanged(true)),
        ],
      ),
    );
  }
}

class _DayPill extends StatelessWidget {
  const _DayPill({required this.day, required this.onTap});

  final _DayBox day;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final active = day.onlineMinutes > 0 || day.trips > 0;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: day.isToday ? AppColors.primary : AppColors.cardSubBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: day.isToday ? AppColors.primary : AppColors.cardSubBorder,
          ),
        ),
        child: Column(
          children: [
            Text(
              day.dayLabel.length > 3 ? day.dayLabel.substring(0, 3) : day.dayLabel,
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: day.isToday ? Colors.white.withValues(alpha: 0.85) : AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              day.dayNum,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: day.isToday ? Colors.white : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: active
                    ? (day.isToday ? Colors.white : AppColors.primary)
                    : (day.isToday ? Colors.white.withValues(alpha: 0.4) : AppColors.border),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailTile extends StatelessWidget {
  const _DetailTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardSubBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.cardSubBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(height: 8),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _DayBox {
  const _DayBox({
    required this.date,
    required this.dayLabel,
    required this.dayNum,
    required this.isToday,
    required this.onlineTime,
    required this.onlineMinutes,
    required this.trips,
    required this.shiftsBooked,
    required this.shiftsCompleted,
  });

  final String date;
  final String dayLabel;
  final String dayNum;
  final bool isToday;
  final String onlineTime;
  final int onlineMinutes;
  final int trips;
  final int shiftsBooked;
  final int shiftsCompleted;

  factory _DayBox.fromJson(Map<String, dynamic> json) {
    final date = json['date']?.toString() ?? '';
    return _DayBox(
      date: date,
      dayLabel: json['dayLabel']?.toString() ?? '',
      dayNum: json['dayNum']?.toString() ??
          (date.contains('-') ? date.split('-').last : date),
      isToday: json['isToday'] == true,
      onlineTime: json['totalOnlineFormatted']?.toString() ?? '0m',
      onlineMinutes: (json['totalOnlineMinutes'] as num?)?.round() ?? 0,
      trips: (json['totalTrips'] as num?)?.toInt() ?? 0,
      shiftsBooked: (json['shiftsBooked'] as num?)?.toInt() ?? 0,
      shiftsCompleted: (json['shiftsCompleted'] as num?)?.toInt() ?? 0,
    );
  }
}
