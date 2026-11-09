import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/config/api_config.dart';
import '../../../core/l10n/app_l10n.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import 'fulltime_widgets.dart';

class FullTimeRulesScreen extends StatefulWidget {
  const FullTimeRulesScreen({super.key});

  @override
  State<FullTimeRulesScreen> createState() => _FullTimeRulesScreenState();
}

class _FullTimeRulesScreenState extends State<FullTimeRulesScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _rules = [];
  double _monthlySalary = 0;
  String _darkStoreName = '';
  Map<String, dynamic>? _shift;
  Map<String, dynamic>? _requirement;
  List<dynamic> _customRules = [];
  String _assignmentMode = 'manual';
  Map<String, dynamic>? _payPolicy;
  Map<String, dynamic>? _payroll;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await apiGet(
        ApiConfig.fullTimeRules,
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        setState(() {
          _rules = (body['rules'] as List?) ?? [];
          _monthlySalary = (body['monthlySalary'] as num?)?.toDouble() ?? 0;
          _darkStoreName = body['darkStoreName']?.toString() ?? '';
          _shift = body['shift'] is Map ? Map<String, dynamic>.from(body['shift'] as Map) : null;
          _requirement = body['requirement'] is Map ? Map<String, dynamic>.from(body['requirement'] as Map) : null;
          _customRules = (body['customRules'] as List?) ?? [];
          _assignmentMode = body['orderAssignmentMode']?.toString() ?? 'manual';
          _payPolicy = body['payPolicy'] is Map ? Map<String, dynamic>.from(body['payPolicy'] as Map) : null;
          _payroll = body['payroll'] is Map ? Map<String, dynamic>.from(body['payroll'] as Map) : null;
          _loading = false;
        });
      } else {
        Map<String, dynamic> body = {};
        try {
          body = jsonDecode(res.body) as Map<String, dynamic>;
        } catch (_) {}
        setState(() {
          _error = body['message']?.toString() ?? appL10n.ftFailedToLoadRules('${res.statusCode}');
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = appL10n.ftCouldNotConnectServer;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: fullTimeAppBar(AppLocalizations.of(context).ftFullTimeRulesPay, onRefresh: _fetch),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? FtErrorView(message: _error!, onRetry: _fetch)
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _fetch,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    children: [
                      // 1. Hero Card: Monthly Salary & Dark Store
                      _buildSalaryHero(),
                      const SizedBox(height: 14),

                      // 2. Quick Highlight Pills Bar
                      _buildKeyMetricsRow(),
                      const SizedBox(height: 16),

                      // 3. Shift Details Card (if assigned)
                      if (_shift != null) ...[
                        _buildShiftCard(),
                        const SizedBox(height: 16),
                      ],

                      // 4. Payroll / Earnings Summary Card
                      if (_payroll != null && _monthlySalary > 0) ...[
                        _buildPayrollCard(),
                        const SizedBox(height: 16),
                      ],

                      // 5. Attendance & Geofencing Rules Card
                      _buildAttendanceRulesCard(),
                      const SizedBox(height: 16),

                      // 6. Leave & Salary Policy Card
                      if (_payPolicy != null) ...[
                        _buildLeavePolicyCard(),
                        const SizedBox(height: 16),
                      ],

                      // 7. Order Assignment Mode Card
                      _buildAssignmentCard(),
                      const SizedBox(height: 16),

                      // 8. Store Guidelines / Custom Rules
                      if (_customRules.isNotEmpty) ...[
                        _buildCustomRulesCard(),
                        const SizedBox(height: 16),
                      ],

                      // 9. Support / Manager Contact Banner
                      _buildSupportBanner(),
                    ],
                  ),
                ),
    );
  }

  // --- WIDGET BUILDERS ---

  Widget _buildSalaryHero() {
    final l10n = AppLocalizations.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.primaryDark,
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.25),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.verified_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      l10n.ftFullTimePartnerBadge,
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ],
                ),
              ),
              if (_darkStoreName.isNotEmpty)
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.storefront_rounded,
                          size: 13,
                          color: Colors.white70,
                        ),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            _darkStoreName,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            l10n.ftFixedBaseSalary,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.78),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                formatRupees(_monthlySalary),
                style: GoogleFonts.inter(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                l10n.ftPerMonthSuffix,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withValues(alpha: 0.82),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.account_balance_wallet_outlined,
                  size: 15,
                  color: Colors.white,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    l10n.ftDirectMonthlyPayout,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withValues(alpha: 0.95),
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

  Widget _buildKeyMetricsRow() {
    final radius = _requirement?['attendanceRadiusMeters'] ?? 200;
    final leaveOn = _payPolicy?['leavePolicyEnabled'] == true;
    final paidLeaves = (_payPolicy?['paidLeavesPerMonth'] as num?)?.toInt() ?? 0;
    final l10n = AppLocalizations.of(context);

    return Row(
      children: [
        Expanded(
          child: _metricBox(
            icon: Icons.my_location_rounded,
            iconColor: const Color(0xFF0F5A32),
            iconBg: const Color(0xFFE8F5E9),
            label: l10n.ftGeoRadius,
            value: l10n.ftMetersCompact('$radius'),
            sub: l10n.ftStorePunchIn,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _metricBox(
            icon: Icons.beach_access_rounded,
            iconColor: const Color(0xFF2563EB),
            iconBg: const Color(0xFFEFF6FF),
            label: l10n.ftPaidLeaves,
            value: leaveOn ? l10n.ftDaysCount(paidLeaves.toString()) : l10n.ftStandard,
            sub: l10n.ftPerMonthLabel,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _metricBox(
            icon: Icons.assignment_turned_in_rounded,
            iconColor: const Color(0xFFD97706),
            iconBg: const Color(0xFFFFFBEB),
            label: l10n.ftDispatch,
            value: l10n.ftManager,
            sub: l10n.ftDirectAssign,
          ),
        ),
      ],
    );
  }

  Widget _metricBox({
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String label,
    required String value,
    required String sub,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: iconColor),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          Text(
            sub,
            style: GoogleFonts.inter(
              fontSize: 10,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShiftCard() {
    final l10n = AppLocalizations.of(context);
    final shiftName = _shift!['name']?.toString() ?? _shift!['slotName']?.toString() ?? l10n.ftAssignedShift;
    final startTime = _shift!['startTime']?.toString() ?? '';
    final endTime = _shift!['endTime']?.toString() ?? '';
    final workingDays = _shift!['workingDays'] as List<dynamic>?;

    return _cardWrapper(
      title: l10n.ftAssignedRosterTiming,
      icon: Icons.schedule_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      shiftName,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (startTime.isNotEmpty && endTime.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.access_time_rounded, size: 14, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            '$startTime – $endTime',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                ),
                child: Text(
                  l10n.ftFixedShift,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          if (workingDays != null && workingDays.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              l10n.ftWorkingDaysList(formatWorkingDays(workingDays)),
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPayrollCard() {
    final payroll = _payroll!;
    final leave = (payroll['leave'] as Map?) ?? const {};
    final leaveOn = leave['enabled'] == true;
    final leaveCut = (leave['deduction'] as num?) ?? 0;
    final credited = payroll['credited'] is Map;
    final l10n = AppLocalizations.of(context);

    return _cardWrapper(
      title: l10n.ftCurrentMonthPayroll,
      icon: Icons.payments_rounded,
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: credited
              ? AppColors.success.withValues(alpha: 0.12)
              : AppColors.warning.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: credited
                ? AppColors.success.withValues(alpha: 0.3)
                : AppColors.warning.withValues(alpha: 0.3),
          ),
        ),
        child: Text(
          credited ? l10n.ftCreditedBadge : l10n.ftInProgressBadge,
          style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: credited ? AppColors.success : AppColors.warning,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            payroll['month']?.toString() ?? l10n.ftCurrentCycle,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 12),
          _detailRow(
            l10n.ftBaseMonthlySalary,
            formatRupees(payroll['baseSalary'] as num? ?? _monthlySalary),
          ),
          _detailRow(
            l10n.ftPresentDaysTitle,
            l10n.ftPresentOfDays(
              '${payroll['presentDays'] ?? 0}',
              '${payroll['scheduledWorkingDays'] ?? 0}',
            ),
          ),
          if (leaveOn) ...[
            _detailRow(
              l10n.ftLeavesTakenTitle,
              l10n.ftLeavesTakenDaysBreakdown(
                '${leave['taken'] ?? 0}',
                '${leave['paid'] ?? 0}',
                '${leave['unpaid'] ?? 0}',
              ),
            ),
            _detailRow(
              l10n.ftRemainingPaidLeaves,
              l10n.ftCountOfTotalLeft('${leave['paidRemaining'] ?? 0}', '${leave['allowedPaid'] ?? 0}'),
            ),
            if (leaveCut > 0)
              _detailRow(
                l10n.ftLeaveDeductionCalc(
                  '${leave['unpaid']}',
                  formatRupees(leave['deductionPerDay'] as num?),
                ),
                '− ${formatRupees(leaveCut)}',
                isNegative: true,
              ),
          ] else if (((payroll['absentDays'] as num?) ?? 0) > 0)
            _detailRow(l10n.ftUnexcusedAbsentDays, '${payroll['absentDays']}'),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Divider(height: 1),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                credited ? l10n.ftFinalCreditedAmount : l10n.ftEstimatedNetPayout,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                formatRupees(payroll['netSalary'] as num?),
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          if (!credited && ((payroll['remainingDays'] as num?) ?? 0) > 0) ...[
            const SizedBox(height: 6),
            Text(
              l10n.ftUpdatedDailyShiftsLeft('${payroll['remainingDays']}'),
              style: GoogleFonts.inter(
                fontSize: 11,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAttendanceRulesCard() {
    final radius = _requirement?['attendanceRadiusMeters'] ?? 200;
    final l10n = AppLocalizations.of(context);

    return _cardWrapper(
      title: l10n.ftDailyAttendanceGeofencing,
      icon: Icons.fingerprint_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _policyPoint(
            number: '1',
            title: l10n.ftDarkStoreGeofenceCheck,
            description: l10n.ftGeofenceCheckDesc('$radius'),
          ),
          const SizedBox(height: 12),
          _policyPoint(
            number: '2',
            title: l10n.ftGpsLocationVerification,
            description: l10n.ftGpsVerificationDesc,
          ),
          const SizedBox(height: 12),
          _policyPoint(
            number: '3',
            title: l10n.ftAutoCheckInOnline,
            description: l10n.ftAutoCheckInDesc,
          ),
          if (_rules.isNotEmpty) ...[
            for (int i = 0; i < _rules.length; i++) ...[
              if (_rules[i] is Map && _rules[i]['notes'] != null && _rules[i]['notes'].toString().isNotEmpty) ...[
                const SizedBox(height: 12),
                _policyPoint(
                  number: '${i + 4}',
                  title: _rules[i]['ruleName']?.toString() ?? l10n.ftStoreAttendanceGuideline,
                  description: _rules[i]['notes'].toString(),
                ),
              ],
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildLeavePolicyCard() {
    final policy = _payPolicy!;
    final leaveOn = policy['leavePolicyEnabled'] == true;
    final paid = (policy['paidLeavesPerMonth'] as num?)?.toInt() ?? 0;
    final perDay = policy['unpaidLeaveDeductionPerDay'] as num?;
    final l10n = AppLocalizations.of(context);

    return _cardWrapper(
      title: l10n.ftLeaveTermsAbsencePolicy,
      icon: Icons.beach_access_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _policyPoint(
            number: 'A',
            title: leaveOn ? l10n.ftPaidLeaveAllowance : l10n.ftLeavePolicy,
            description: leaveOn
                ? l10n.ftPaidLeaveEntitlementDesc(paid.toString())
                : l10n.ftLeavesNeedApprovalDesc,
          ),
          const SizedBox(height: 12),
          _policyPoint(
            number: 'B',
            title: l10n.ftUnpaidAbsenceDeductions,
            description: leaveOn
                ? (perDay != null
                    ? l10n.ftAmountDeductedPerLeaveDay(formatRupees(perDay))
                    : l10n.ftProratedSalaryDeductedDesc)
                : l10n.ftUnapprovedAbsenceDeductedDesc,
          ),
          const SizedBox(height: 12),
          _policyPoint(
            number: 'C',
            title: l10n.ftShiftAttendanceRule,
            description: l10n.ftShiftAttendanceRuleDesc,
          ),
        ],
      ),
    );
  }

  Widget _buildAssignmentCard() {
    final l10n = AppLocalizations.of(context);
    return _cardWrapper(
      title: l10n.ftOrderDispatchAssignment,
      icon: Icons.local_shipping_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.person_pin_circle_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.ftDedicatedManagerDispatch,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _assignmentMode == 'manual'
                          ? l10n.ftManualAssignmentDesc
                          : l10n.ftAssignmentModeValue(_assignmentMode),
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCustomRulesCard() {
    final l10n = AppLocalizations.of(context);
    return _cardWrapper(
      title: l10n.ftStoreOperationalGuidelines,
      icon: Icons.checklist_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ..._customRules.whereType<Map>().map((c) {
            final title = c['title']?.toString() ?? l10n.ftStoreRule;
            final desc = c['description']?.toString() ?? '';
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(
                      Icons.check_circle_rounded,
                      size: 16,
                      color: Color(0xFF0F5A32),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (desc.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            desc,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildSupportBanner() {
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardSubBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardSubBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.blue.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.support_agent_rounded,
              color: Color(0xFF2563EB),
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.ftNeedAssistanceRulesPay,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _darkStoreName.isNotEmpty
                      ? l10n.ftReachOutStoreManagerAt(_darkStoreName)
                      : l10n.ftSpeakWithStoreManager,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- REUSABLE CARD COMPONENTS ---

  Widget _cardWrapper({
    required String title,
    required IconData icon,
    required Widget child,
    Widget? trailing,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, size: 16, color: AppColors.primary),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value, {bool isNegative = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isNegative ? AppColors.error : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _policyPoint({
    required String number,
    required String title,
    required String description,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 22,
          height: 22,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            shape: BoxShape.circle,
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.25),
            ),
          ),
          child: Text(
            number,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
