import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/l10n/app_l10n.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/fulltime_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/charts/progress_ring.dart';
import '../../widgets/common/app_panel.dart';
import 'fulltime_widgets.dart';

class FullTimeAttendanceScreen extends StatefulWidget {
  const FullTimeAttendanceScreen({super.key});

  @override
  State<FullTimeAttendanceScreen> createState() => _FullTimeAttendanceScreenState();
}

class _FullTimeAttendanceScreenState extends State<FullTimeAttendanceScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _data = const {};

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
      final data = await FullTimeService.instance.fetchAttendanceToday();
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is FullTimeApiException ? e.message : appL10n.ftCouldNotLoadAttendanceRetry;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: fullTimeAppBar(AppLocalizations.of(context).attendance, onRefresh: _load),
      body: _loading
          ? const PageSkeleton()
          : _error != null
              ? FtErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: _content(),
                ),
    );
  }

  static String _clock(DateTime t) => localizedDateFormat('h:mm a').format(t);

  Widget _content() {
    final l10n = AppLocalizations.of(context);
    final attendance = (_data['attendance'] as Map?) ?? const {};
    final requirement = _data['requirement'] as Map?;
    final darkStore = _data['darkStore'] as Map?;
    final month = _data['month'] as Map?;
    final status = _data['todayStatus']?.toString() ?? attendance['status']?.toString() ?? 'pending';
    final markedAt = DateTime.tryParse(attendance['markedAt']?.toString() ?? '')?.toLocal();
    final distance = attendance['distanceFromStoreMeters'] as num?;
    final lateMinutes = (attendance['lateMinutes'] as num?) ?? 0;
    final payroll = _data['payroll'] as Map?;

    String hint = '';
    if (status == 'present' && markedAt != null) {
      hint = [
        l10n.ftMarkedAt(_clock(markedAt)),
        if (distance != null) l10n.ftMetersFromStore('${distance.round()}'),
        if (lateMinutes > 0) l10n.ftLateAfterCheckIn(formatMinutes(lateMinutes)),
      ].join(' · ');
    } else if (status == 'off_day') {
      hint = l10n.ftTodayNotWorkingDay;
    } else if (status == 'not_required') {
      hint = l10n.ftAttendanceNotRequired;
    } else if (status == 'absent') {
      hint = l10n.ftNoAttendanceRecorded;
    } else if (status == 'pending' && requirement?['requireLocationValidation'] == true) {
      hint = l10n.ftAttendanceAutoWithinRadius('${requirement?['attendanceRadiusMeters'] ?? 200}');
    } else if (status == 'pending') {
      hint = l10n.ftAttendanceAuto;
    }
    final style = attendanceStyle(status);
    final statusIcon = switch (status) {
      'present' => Icons.verified_rounded,
      'absent' => Icons.event_busy_rounded,
      'off_day' => Icons.weekend_rounded,
      'not_required' => Icons.do_not_disturb_on_outlined,
      _ => Icons.fingerprint_rounded,
    };

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        AppPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: style.color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(statusIcon, color: style.color, size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.ftTodaysAttendance,
                          style: GoogleFonts.inter(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _data['today']?.toString() ?? '',
                          style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  AttendanceChip(status: status),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _CheckTile(
                      icon: Icons.login_rounded,
                      label: l10n.ftCheckIn,
                      value: markedAt != null ? _clock(markedAt) : '—',
                      accent: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _CheckTile(
                      icon: Icons.location_on_outlined,
                      label: l10n.ftStoreRadius,
                      value: requirement == null
                          ? '—'
                          : l10n.ftMetersValue('${requirement['attendanceRadiusMeters'] ?? 200}'),
                      accent: AppColors.info,
                    ),
                  ),
                ],
              ),
              if (status == 'present' && (distance != null || lateMinutes > 0)) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _CheckTile(
                        icon: Icons.near_me_outlined,
                        label: l10n.ftFromStore,
                        value: distance != null ? l10n.ftMetersValue('${distance.round()}') : '—',
                        accent: const Color(0xFF8B5CF6),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _CheckTile(
                        icon: Icons.timer_outlined,
                        label: l10n.ftLateBy,
                        value: lateMinutes > 0 ? formatMinutes(lateMinutes) : l10n.ftOnTime,
                        accent: AppColors.warning,
                      ),
                    ),
                  ],
                ),
              ],
              if (hint.isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.cardSubBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.cardSubBorder),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline_rounded, size: 16, color: AppColors.textMuted),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          hint,
                          style: GoogleFonts.inter(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        if (payroll != null || month != null)
          _MonthSummary(
            payroll: payroll,
            month: month,
            requirement: requirement,
            today: _data['today']?.toString() ?? '',
            todayStatus: status,
          ),
        AppPanel(
          title: l10n.ftWorkRules,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FtInfoRow(
                icon: Icons.storefront_outlined,
                label: l10n.ftDarkStore,
                value: darkStore?['name']?.toString() ?? '—',
              ),
              if (requirement?['requireLocationValidation'] == true)
                FtInfoRow(
                  icon: Icons.location_on_outlined,
                  label: l10n.ftLocation,
                  value: l10n.ftWithinMetersOfStore('${requirement?['attendanceRadiusMeters'] ?? 200}'),
                ),
              if (month != null)
                FtInfoRow(
                  icon: Icons.calendar_month_outlined,
                  label: l10n.ftThisMonth,
                  value: l10n.ftDaysPresent('${month['presentDays'] ?? 0}'),
                ),
            ],
          ),
        ),
        if (payroll != null && ((payroll['baseSalary'] as num?) ?? 0) > 0)
          PayrollCard(payroll: payroll),
      ],
    );
  }
}

class _CheckTile extends StatelessWidget {
  const _CheckTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: accent),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
                ),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

enum _DayState { present, absent, late, offDay, today, upcoming, unknown }

class _MonthSummary extends StatelessWidget {
  const _MonthSummary({
    required this.payroll,
    required this.month,
    required this.requirement,
    required this.today,
    required this.todayStatus,
  });

  final Map? payroll;
  final Map? month;
  final Map? requirement;
  final String today;
  final String todayStatus;

  static String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final p = payroll;
    final present = ((p?['presentDays'] ?? month?['presentDays']) as num?)?.toInt() ?? 0;
    final absent = (p?['absentDays'] as num?)?.toInt() ?? 0;
    final remaining = (p?['remainingDays'] as num?)?.toInt() ?? 0;
    final scheduled = (p?['scheduledWorkingDays'] as num?)?.toInt() ??
        (month?['daysInMonth'] as num?)?.toInt() ??
        0;
    final leave = (p?['leave'] as Map?) ?? const {};
    final leaveCount = (leave['taken'] as num?)?.toInt() ?? 0;
    final percent = scheduled > 0 ? present / scheduled * 100 : null;

    final monthKey = (p?['month'] ?? month?['month'])?.toString() ?? '';
    final parts = monthKey.split('-');
    final year = parts.length == 2 ? int.tryParse(parts[0]) : null;
    final mon = parts.length == 2 ? int.tryParse(parts[1]) : null;
    final validMonth = year != null && mon != null && mon >= 1 && mon <= 12;

    return AppPanel(
      title: validMonth ? localizedDateFormat('MMMM y').format(DateTime(year, mon)) : l10n.ftThisMonthLower,
      subtitle: l10n.ftMonthlyAttendanceSummary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ProgressRing(
                percent: percent,
                label: l10n.ftPresent,
                centerText: '$present/$scheduled',
                size: 96,
                caption: null,
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(child: _MiniStat(label: l10n.ftPresent, value: present, color: AppColors.success)),
                        Expanded(child: _MiniStat(label: l10n.ftAbsent, value: absent, color: AppColors.error)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _MiniStat(
                            label: l10n.ftLeave,
                            value: leaveCount,
                            color: AppColors.warning,
                          ),
                        ),
                        Expanded(child: _MiniStat(label: l10n.ftRemaining, value: remaining, color: AppColors.info)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (present + absent + remaining > 0) ...[
            const SizedBox(height: 16),
            SegmentBar(
              segments: [
                (present.toDouble(), AppColors.success),
                (absent.toDouble(), AppColors.error),
                (remaining.toDouble(), AppColors.info.withValues(alpha: 0.35)),
              ],
            ),
          ],
          if (validMonth) ...[
            const SizedBox(height: 18),
            _calendar(l10n, year, mon),
          ],
        ],
      ),
    );
  }

  Widget _calendar(AppLocalizations l10n, int year, int mon) {
    final p = payroll;
    final workingDays = (requirement?['workingDays'] as List? ?? const [])
        .whereType<num>()
        .map((d) => d.toInt())
        .toSet();
    final absentSet = ((p?['leave'] as Map?)?['dates'] as List? ?? const [])
        .map((e) => e.toString())
        .toSet();
    final lateSet = ((p?['late'] as Map?)?['days'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => e['date']?.toString() ?? '')
        .where((e) => e.isNotEmpty)
        .toSet();
    final tracked = p?['attendanceTracked'] == true;
    final presentCount = (p?['presentDays'] as num?)?.toInt() ?? -1;

    final daysInMonth = DateTime(year, mon + 1, 0).day;
    final dates = [for (var d = 1; d <= daysInMonth; d++) DateTime(year, mon, d)];
    bool isWorking(DateTime d) => workingDays.isEmpty || workingDays.contains(d.weekday % 7);

    final presentCandidates = <String>{
      for (final d in dates)
        if (isWorking(d) && !absentSet.contains(_iso(d)) && (_iso(d).compareTo(today) < 0 || (_iso(d) == today && todayStatus == 'present')))
          _iso(d),
    };
    final inferPresent = tracked && presentCandidates.length == presentCount;

    _DayState stateFor(DateTime d) {
      final key = _iso(d);
      if (key == today && todayStatus == 'present') {
        return lateSet.contains(key) ? _DayState.late : _DayState.present;
      }
      if (lateSet.contains(key)) return _DayState.late;
      if (absentSet.contains(key)) return _DayState.absent;
      if (!isWorking(d)) return _DayState.offDay;
      if (key == today) return _DayState.today;
      if (key.compareTo(today) > 0) return _DayState.upcoming;
      if (inferPresent && presentCandidates.contains(key)) return _DayState.present;
      return _DayState.unknown;
    }

    final leading = dates.first.weekday % 7;
    final cells = <Widget>[
      for (var i = 0; i < leading; i++) const SizedBox.shrink(),
      for (final d in dates) _CalendarCell(day: d.day, state: stateFor(d), isToday: _iso(d) == today),
    ];

    final headers = [
      l10n.daySun,
      l10n.dayMon,
      l10n.dayTue,
      l10n.dayWed,
      l10n.dayThu,
      l10n.dayFri,
      l10n.daySat,
    ];
    return Column(
      children: [
        Row(
          children: [
            for (final h in headers)
              Expanded(
                child: Center(
                  child: Text(
                    h,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textMuted,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 6,
          crossAxisSpacing: 6,
          children: cells,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 14,
          runSpacing: 6,
          children: [
            LegendDot(color: AppColors.success, label: l10n.ftPresent),
            LegendDot(color: AppColors.warning, label: l10n.ftLate),
            LegendDot(color: AppColors.error, label: l10n.ftAbsent),
            LegendDot(color: AppColors.border, label: l10n.ftOffDayLegend),
          ],
        ),
      ],
    );
  }
}

class _CalendarCell extends StatelessWidget {
  const _CalendarCell({required this.day, required this.state, required this.isToday});

  final int day;
  final _DayState state;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (state) {
      _DayState.present => (AppColors.success, Colors.white),
      _DayState.late => (AppColors.warning, Colors.white),
      _DayState.absent => (AppColors.error.withValues(alpha: 0.14), AppColors.error),
      _DayState.offDay => (AppColors.cardSubBg, AppColors.textMuted),
      _ => (Colors.transparent, AppColors.textPrimary),
    };
    return Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: isToday
            ? Border.all(color: AppColors.primary, width: 2)
            : state == _DayState.upcoming || state == _DayState.unknown || state == _DayState.today
                ? Border.all(color: AppColors.cardSubBorder)
                : null,
      ),
      child: Text(
        '$day',
        style: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value, required this.color});

  final String label;
  final int? value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LegendDot(color: color, label: label),
        const SizedBox(height: 4),
        Text(
          value == null ? '—' : '$value',
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
