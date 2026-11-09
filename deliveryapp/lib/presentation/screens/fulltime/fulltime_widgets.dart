import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/l10n/app_l10n.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';

String formatRupees(num? value) {
  final n = (value ?? 0).round().toString();
  final grouped = n.replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  );
  return '₹$grouped';
}

/// 135 → "2h 15m"
String formatMinutes(num? minutes) {
  final n = (minutes ?? 0).round();
  final h = n ~/ 60;
  final m = n % 60;
  final parts = [
    if (h > 0) appL10n.ftDurationHours(h.toString()),
    if (m > 0) appL10n.ftDurationMinutes(m.toString()),
  ];
  return parts.isEmpty ? appL10n.ftDurationMinutes('0') : parts.join(' ');
}

/// 0 = Sunday … 6 = Saturday (1 Jan 2023 was a Sunday).
String _weekDayShort(int d) => localizedDateFormat('EEE').format(DateTime(2023, 1, 1 + d));

String formatWorkingDays(List<dynamic>? days) {
  final list = (days ?? const []).whereType<num>().map((d) => d.toInt()).toList();
  if (list.isEmpty) return '—';
  if (list.length == 7) return appL10n.ftEveryDay;
  return list.where((d) => d >= 0 && d < 7).map(_weekDayShort).join(', ');
}

({String label, Color color}) attendanceStyle(String status) => switch (status) {
      'present' => (label: appL10n.ftPresent, color: AppColors.success),
      'absent' => (label: appL10n.ftAbsent, color: AppColors.error),
      'off_day' => (label: appL10n.ftOffDay, color: AppColors.textMuted),
      'not_required' => (label: appL10n.ftNotRequired, color: AppColors.textMuted),
      _ => (label: appL10n.pending, color: AppColors.warning),
    };

class AttendanceChip extends StatelessWidget {
  const AttendanceChip({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final s = attendanceStyle(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: s.color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: s.color.withValues(alpha: 0.35)),
      ),
      child: Text(
        s.label,
        style: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: s.color,
        ),
      ),
    );
  }
}

class FtSectionCard extends StatelessWidget {
  const FtSectionCard({super.key, required this.child, this.padding});
  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: child,
    );
  }
}

class FtInfoRow extends StatelessWidget {
  const FtInfoRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(width: 8),
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textMuted,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class FtErrorView extends StatelessWidget {
  const FtErrorView({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 14),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: Text(AppLocalizations.of(context).ftRetry),
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            ),
          ],
        ),
      ),
    );
  }
}

/// Salary and leave deduction policy for a Full-Time rider.
class PayPolicyCard extends StatelessWidget {
  const PayPolicyCard({super.key, required this.policy, required this.monthlySalary});
  final Map policy;
  final num monthlySalary;

  @override
  Widget build(BuildContext context) {
    final leaveOn = policy['leavePolicyEnabled'] == true;
    final paid = (policy['paidLeavesPerMonth'] as num?)?.toInt() ?? 0;
    final perDay = policy['unpaidLeaveDeductionPerDay'] as num?;
    final l10n = AppLocalizations.of(context);
    return FtSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.ftSalaryLeavePolicy,
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          FtInfoRow(
            icon: Icons.payments_outlined,
            label: l10n.ftMonthlySalary,
            value: l10n.ftAmountPerMonth(formatRupees(monthlySalary)),
          ),
          FtInfoRow(
            icon: Icons.beach_access_outlined,
            label: l10n.ftLeaveDaysBeforeDeduction,
            value: leaveOn ? l10n.ftCountPerMonth(paid.toString()) : l10n.ftNoLeavePolicy,
          ),
          if (leaveOn)
            FtInfoRow(
              icon: Icons.money_off_outlined,
              label: l10n.ftExtraLeave,
              value: perDay != null
                  ? l10n.ftAmountCutPerUnpaidLeave(formatRupees(perDay))
                  : l10n.ftOneDaySalaryCutPerUnpaidLeave,
            ),
          if (leaveOn)
            Text(
              l10n.ftOfflineDuringShiftCountsAsLeave,
              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
            ),
        ],
      ),
    );
  }
}

/// This month's salary: base, leave deductions and net.
class PayrollCard extends StatelessWidget {
  const PayrollCard({super.key, required this.payroll, this.title});
  final Map payroll;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final heading = title ?? l10n.ftThisMonth;
    final leave = (payroll['leave'] as Map?) ?? const {};
    final leaveOn = leave['enabled'] == true;
    final leaveCut = (leave['deduction'] as num?) ?? 0;
    final credited = payroll['credited'] is Map;

    return FtSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '$heading · ${payroll['month'] ?? ''}',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              if (credited)
                Text(
                  l10n.ftCredited,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.success,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          _PayRow(l10n.ftBaseSalary, formatRupees(payroll['baseSalary'] as num?)),
          _PayRow(
            l10n.ftPresentDays,
            l10n.ftPresentOfWorkingDays(
              '${payroll['presentDays'] ?? 0}',
              '${payroll['scheduledWorkingDays'] ?? 0}',
            ),
          ),
          if (leaveOn) ...[
            _PayRow(
              l10n.ftLeavesTaken,
              l10n.ftLeavesTakenBreakdown(
                '${leave['taken'] ?? 0}',
                '${leave['paid'] ?? 0}',
                '${leave['unpaid'] ?? 0}',
              ),
            ),
            _PayRow(
              l10n.ftLeaveAllowanceLeft,
              l10n.ftCountOfTotal('${leave['paidRemaining'] ?? 0}', '${leave['allowedPaid'] ?? 0}'),
            ),
            if (leaveCut > 0)
              _PayRow(
                l10n.ftUnpaidLeaveCut(
                  '${leave['unpaid']}',
                  formatRupees(leave['deductionPerDay'] as num?),
                ),
                '− ${formatRupees(leaveCut)}',
                danger: true,
              ),
          ] else if (((payroll['absentDays'] as num?) ?? 0) > 0)
            _PayRow(l10n.ftAbsentDays, '${payroll['absentDays']}'),
          const Divider(height: 18),
          Row(
            children: [
              Expanded(
                child: Text(
                  credited ? l10n.ftNetSalary : l10n.ftEstimatedNetSalary,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Text(
                formatRupees(payroll['netSalary'] as num?),
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          if (!credited && ((payroll['remainingDays'] as num?) ?? 0) > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                l10n.ftUpdatesDailyWorkingDaysLeft('${payroll['remainingDays']}'),
                style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
              ),
            ),
        ],
      ),
    );
  }
}

class _PayRow extends StatelessWidget {
  const _PayRow(this.label, this.value, {this.danger = false});
  final String label;
  final String value;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: danger ? AppColors.error : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

AppBar fullTimeAppBar(String title, {VoidCallback? onRefresh}) {
  return AppBar(
    backgroundColor: AppColors.background,
    elevation: 0,
    scrolledUnderElevation: 0,
    centerTitle: false,
    title: Text(
      title,
      style: GoogleFonts.inter(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
    ),
    actions: [
      if (onRefresh != null)
        IconButton(
          icon: const Icon(Icons.refresh),
          color: AppColors.textPrimary,
          onPressed: onRefresh,
          tooltip: appL10n.ftRefresh,
        ),
    ],
  );
}
