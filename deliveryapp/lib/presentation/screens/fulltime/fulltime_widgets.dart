import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_colors.dart';

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
  final parts = [if (h > 0) '${h}h', if (m > 0) '${m}m'];
  return parts.isEmpty ? '0m' : parts.join(' ');
}

const _weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

String formatWorkingDays(List<dynamic>? days) {
  final list = (days ?? const []).whereType<num>().map((d) => d.toInt()).toList();
  if (list.isEmpty) return '—';
  if (list.length == 7) return 'Every day';
  return list.where((d) => d >= 0 && d < 7).map((d) => _weekDays[d]).join(', ');
}

({String label, Color color}) attendanceStyle(String status) => switch (status) {
      'present' => (label: 'Present', color: AppColors.success),
      'absent' => (label: 'Absent', color: AppColors.error),
      'off_day' => (label: 'Off Day', color: AppColors.textMuted),
      'not_required' => (label: 'Not Required', color: AppColors.textMuted),
      _ => (label: 'Pending', color: AppColors.warning),
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
              label: const Text('Retry'),
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
    return FtSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Salary & Leave Policy',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          FtInfoRow(
            icon: Icons.payments_outlined,
            label: 'Monthly Salary',
            value: '${formatRupees(monthlySalary)} / month',
          ),
          FtInfoRow(
            icon: Icons.beach_access_outlined,
            label: 'Leave days before deduction',
            value: leaveOn ? '$paid per month' : 'No leave policy',
          ),
          if (leaveOn)
            FtInfoRow(
              icon: Icons.money_off_outlined,
              label: 'Extra Leave',
              value: perDay != null
                  ? '${formatRupees(perDay)} cut per unpaid leave'
                  : '1 day salary cut per unpaid leave',
            ),
          if (leaveOn)
            Text(
              'Not going online during a scheduled shift counts as a leave.',
              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
            ),
        ],
      ),
    );
  }
}

/// This month's salary: base, leave deductions and net.
class PayrollCard extends StatelessWidget {
  const PayrollCard({super.key, required this.payroll, this.title = 'This Month'});
  final Map payroll;
  final String title;

  @override
  Widget build(BuildContext context) {
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
                  '$title · ${payroll['month'] ?? ''}',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              if (credited)
                Text(
                  'Credited',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.success,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          _PayRow('Base salary', formatRupees(payroll['baseSalary'] as num?)),
          _PayRow(
            'Present days',
            '${payroll['presentDays'] ?? 0} of ${payroll['scheduledWorkingDays'] ?? 0} working days',
          ),
          if (leaveOn) ...[
            _PayRow(
              'Leaves taken',
              '${leave['taken'] ?? 0}  (${leave['paid'] ?? 0} within allowance · ${leave['unpaid'] ?? 0} extra)',
            ),
            _PayRow('Leave allowance left', '${leave['paidRemaining'] ?? 0} of ${leave['allowedPaid'] ?? 0}'),
            if (leaveCut > 0)
              _PayRow(
                'Unpaid leave cut (${leave['unpaid']} × ${formatRupees(leave['deductionPerDay'] as num?)})',
                '− ${formatRupees(leaveCut)}',
                danger: true,
              ),
          ] else if (((payroll['absentDays'] as num?) ?? 0) > 0)
            _PayRow('Absent days', '${payroll['absentDays']}'),
          const Divider(height: 18),
          Row(
            children: [
              Expanded(
                child: Text(
                  credited ? 'Net salary' : 'Estimated net salary',
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
                'Updates daily — ${payroll['remainingDays']} working days left this month.',
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
          tooltip: 'Refresh',
        ),
    ],
  );
}
