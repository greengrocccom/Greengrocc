import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/fulltime_service.dart';
import '../../../data/services/socket_service.dart';

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

/// Salary, paid-leave and late-penalty rules of the driver's Full-Time shift.
class PayPolicyCard extends StatelessWidget {
  const PayPolicyCard({super.key, required this.policy, required this.monthlySalary});
  final Map policy;
  final num monthlySalary;

  @override
  Widget build(BuildContext context) {
    final leaveOn = policy['leavePolicyEnabled'] == true;
    final lateOn = policy['latePenaltyEnabled'] == true;
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
            label: 'Paid Leaves',
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
          FtInfoRow(
            icon: Icons.timer_off_outlined,
            label: 'Late Penalty',
            value: lateOn
                ? '${formatRupees(policy['latePenaltyAmount'] as num?)} cut if you go online '
                    '${formatMinutes(policy['lateAfterMinutes'] as num?)} or more after shift start'
                : 'None',
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

/// This month's salary: base, paid / unpaid leaves, late marks, deductions and net.
class PayrollCard extends StatelessWidget {
  const PayrollCard({super.key, required this.payroll, this.title = 'This Month'});
  final Map payroll;
  final String title;

  @override
  Widget build(BuildContext context) {
    final leave = (payroll['leave'] as Map?) ?? const {};
    final late = (payroll['late'] as Map?) ?? const {};
    final leaveOn = leave['enabled'] == true;
    final lateOn = late['enabled'] == true;
    final leaveCut = (leave['deduction'] as num?) ?? 0;
    final lateCut = (late['deduction'] as num?) ?? 0;
    final credited = payroll['credited'] is Map;
    final lateDays = (late['days'] as List? ?? const []).whereType<Map>().toList();

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
              '${leave['taken'] ?? 0}  (paid ${leave['paid'] ?? 0} · unpaid ${leave['unpaid'] ?? 0})',
            ),
            _PayRow('Paid leaves left', '${leave['paidRemaining'] ?? 0} of ${leave['allowedPaid'] ?? 0}'),
            if (leaveCut > 0)
              _PayRow(
                'Unpaid leave cut (${leave['unpaid']} × ${formatRupees(leave['deductionPerDay'] as num?)})',
                '− ${formatRupees(leaveCut)}',
                danger: true,
              ),
          ] else if (((payroll['absentDays'] as num?) ?? 0) > 0)
            _PayRow('Absent days', '${payroll['absentDays']}'),
          if (lateOn) ...[
            _PayRow(
              'Late marks (${formatMinutes(late['afterMinutes'] as num?)}+)',
              '${late['count'] ?? 0}',
            ),
            if (lateCut > 0)
              _PayRow(
                'Late cut (${late['count']} × ${formatRupees(late['penaltyAmount'] as num?)})',
                '− ${formatRupees(lateCut)}',
                danger: true,
              ),
          ],
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
          if (lateDays.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Late days: ${lateDays.map((d) => '${d['date'].toString().substring(8)} (${formatMinutes(d['lateMinutes'] as num?)})').join(', ')}',
              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
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

/// Home dashboard card for Full-Time drivers: today's attendance + assigned orders.
class FullTimeHomeCard extends StatefulWidget {
  const FullTimeHomeCard({super.key});

  @override
  State<FullTimeHomeCard> createState() => FullTimeHomeCardState();
}

class FullTimeHomeCardState extends State<FullTimeHomeCard> {
  bool _loading = true;
  String _status = 'pending';
  String _requiredTime = '';
  String _darkStore = '';
  int _assignedCount = 0;
  StreamSubscription<Map<String, dynamic>>? _assignedSub;

  @override
  void initState() {
    super.initState();
    reload();
    _assignedSub = SocketService.instance.onOrderAssigned.listen((_) => reload());
  }

  @override
  void dispose() {
    _assignedSub?.cancel();
    super.dispose();
  }

  Future<void> reload() async {
    try {
      final results = await Future.wait([
        FullTimeService.instance.fetchAttendanceToday(),
        FullTimeService.instance.fetchAssignedOrders(),
      ]);
      if (!mounted) return;
      final att = results[0];
      final req = att['requirement'] as Map?;
      setState(() {
        _loading = false;
        _status = att['todayStatus']?.toString() ??
            (att['attendance'] as Map?)?['status']?.toString() ??
            'pending';
        _requiredTime = req == null ? '' : '${req['startTime']} – ${req['endTime']}';
        _darkStore = (att['darkStore'] as Map?)?['name']?.toString() ?? '';
        _assignedCount = (results[1]['activeCount'] as num?)?.toInt() ?? 0;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(String route) async {
    await Navigator.pushNamed(context, route);
    if (mounted) reload();
  }

  @override
  Widget build(BuildContext context) {
    return FtSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '🟢 Full-Time',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.success,
                  ),
                ),
              ),
              const Spacer(),
              if (_loading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                AttendanceChip(status: _status),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            "Today's Attendance",
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          if (_requiredTime.isNotEmpty || _darkStore.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                [
                  if (_requiredTime.isNotEmpty) _requiredTime,
                  if (_darkStore.isNotEmpty) _darkStore,
                ].join(' · '),
                style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted),
              ),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _open(AppRoutes.fullTimeAttendance),
                  icon: const Icon(Icons.how_to_reg_outlined, size: 18),
                  label: const Text('Attendance'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: BorderSide(color: AppColors.primary.withValues(alpha: 0.4)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _open(AppRoutes.assignedOrders),
                  icon: const Icon(Icons.assignment_outlined, size: 18),
                  label: Text('Orders ($_assignedCount)'),
                  style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
                ),
              ),
            ],
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => _open(AppRoutes.fullTimeRules),
              child: const Text('My Rules →'),
            ),
          ),
        ],
      ),
    );
  }
}
