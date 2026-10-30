import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/config/api_config.dart';
import '../../../core/config/cached_get.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/buttons/primary_button.dart';
import '../../widgets/charts/chart_utils.dart';
import '../../widgets/charts/trend_line_chart.dart';
import '../../widgets/charts/weekly_bar_chart.dart';
import '../../widgets/common/app_panel.dart';
import '../../widgets/layout/custom_app_bar.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  bool _loading = true;
  String? _error;
  int _total = 0;
  int _today = 0;
  int _todayDeliveries = 0;
  int _totalDeliveries = 0;
  int _weekTotal = 0;
  DateTime? _verifiedAt;
  List<Map<String, dynamic>> _weekDays = const [];
  List<Map<String, dynamic>> _history = const [];
  String _withdrawNote = '';
  bool _canWithdraw = false;
  bool _withdrawEnabled = false;
  Map<String, dynamic>? _fullTime;
  Map<String, dynamic>? _salary;
  VoidCallback? _boyListener;

  @override
  void initState() {
    super.initState();
    _load();
    _boyListener = () {
      if (mounted) _load();
    };
    AuthService.instance.boyNotifier.addListener(_boyListener!);
  }

  @override
  void dispose() {
    if (_boyListener != null) {
      AuthService.instance.boyNotifier.removeListener(_boyListener!);
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await cachedApiGet(
        ApiConfig.walletSummary,
        headers: AuthService.instance.authHeaders,
        onData: _apply,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load wallet. Pull to retry.';
      });
    }
  }

  void _apply(Map<String, dynamic> body) {
    if (!mounted) return;
    setState(() {
      _loading = false;
      _total = (body['totalEarnings'] as num?)?.toInt() ?? 0;
      _today = (body['todayEarnings'] as num?)?.toInt() ?? 0;
      _todayDeliveries = (body['todayDeliveries'] as num?)?.toInt() ?? 0;
      _totalDeliveries = (body['totalDeliveries'] as num?)?.toInt() ?? 0;
      _weekTotal = (body['weekTotalEarnings'] as num?)?.toInt() ?? 0;
      _verifiedAt = DateTime.tryParse(body['verificationDate']?.toString() ?? '');
      _weekDays = (body['weekDays'] as List<dynamic>? ?? [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      _history = (body['dailyHistory'] as List<dynamic>? ?? [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      _withdrawNote = body['withdrawNote']?.toString() ??
          'Withdraw stays inactive until Admin activates it for your account.';
      _canWithdraw = body['canWithdraw'] == true;
      _withdrawEnabled = body['withdrawEnabled'] == true;
      _fullTime = body['fullTime'] is Map
          ? Map<String, dynamic>.from(body['fullTime'] as Map)
          : null;
      _salary = body['salary'] is Map
          ? Map<String, dynamic>.from(body['salary'] as Map)
          : null;
    });
  }

  String _rupee(num n) => rupeeAmount(n);

  num get _todayIncentive => (_salary?['todayIncentives'] as num?) ?? 0;

  num? get _salaryValue {
    final v = (_salary?['salaryAmount'] as num?) ??
        (_salary?['monthlySalary'] as num?) ??
        (_fullTime?['monthlySalary'] as num?);
    return v != null && v > 0 ? v : null;
  }

  String _salaryPeriodLabel(AppLocalizations l10n) {
    switch (_salary?['salaryPeriod']?.toString()) {
      case 'day':
        return l10n.perDay;
      case 'week':
        return l10n.perWeek;
      default:
        return l10n.perMonth;
    }
  }

  static String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  ({List<double> values, List<String> labels, List<String> dates, List<int> orders}) _trend() {
    final byDate = <String, Map<String, dynamic>>{
      for (final h in _history)
        if (h['date'] != null) h['date'].toString(): h,
    };
    final nowIst = DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30));
    final today = DateTime(nowIst.year, nowIst.month, nowIst.day);
    var start = today.subtract(const Duration(days: 29));
    final verified = _verifiedAt?.toUtc().add(const Duration(hours: 5, minutes: 30));
    if (verified != null) {
      final vDay = DateTime(verified.year, verified.month, verified.day);
      if (vDay.isAfter(start)) start = vDay;
    }
    final values = <double>[];
    final labels = <String>[];
    final dates = <String>[];
    final orders = <int>[];
    for (var d = start; !d.isAfter(today); d = DateTime(d.year, d.month, d.day + 1)) {
      final key = _iso(d);
      final row = byDate[key];
      values.add((row?['totalEarnings'] as num?)?.toDouble() ?? 0);
      orders.add((row?['orderCount'] as num?)?.toInt() ?? 0);
      labels.add('${d.day} ${_months[d.month - 1]}');
      dates.add(key);
    }
    return (values: values, labels: labels, dates: dates, orders: orders);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final body = RefreshIndicator(
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
              : _content(l10n),
    );

    if (widget.embedded) return body;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(title: l10n.wallet, showBackButton: true),
      body: body,
    );
  }

  Widget _content(AppLocalizations l10n) {
    final trend = _trend();
    final activeDays = trend.values.where((v) => v > 0).length;
    final trendTotal = trend.values.fold<double>(0, (s, v) => s + v);
    final bestValue = trend.values.fold<double>(0, (m, v) => v > m ? v : m);
    final bestIndex = bestValue > 0 ? trend.values.indexOf(bestValue) : -1;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxxl),
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: brandHeroDecoration(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _HeroBlock(
                icon: Icons.bolt_rounded,
                label: l10n.todaysIncentive,
                value: _rupee(_todayIncentive),
              ),
              const SizedBox(height: 12),
              _HeroBlock(
                icon: Icons.payments_outlined,
                label: _salaryValue == null
                    ? l10n.salaryLabel
                    : '${l10n.salaryLabel} · ${_salaryPeriodLabel(l10n)}',
                value: _salaryValue == null ? l10n.salaryNotSet : _rupee(_salaryValue!),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(child: HeroStat(label: 'Today', value: _rupee(_today))),
                    Expanded(child: HeroStat(label: 'This week', value: _rupee(_weekTotal))),
                    Expanded(child: HeroStat(label: 'Deliveries', value: '$_totalDeliveries')),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (_fullTime != null) ...[
          const SizedBox(height: AppSpacing.lg),
          _FullTimeSalaryCard(data: _fullTime!),
        ],
        const SizedBox(height: AppSpacing.lg),
        PrimaryButton(
          label: l10n.withdraw,
          icon: Icons.account_balance_outlined,
          // Stays inactive until Admin sets withdrawEnabled on the rider.
          onPressed: _canWithdraw
              ? () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Withdraw request will be handled by Admin payout policy.',
                      ),
                    ),
                  );
                }
              : null,
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(
                _withdrawEnabled ? Icons.verified_outlined : Icons.lock_outline_rounded,
                size: 14,
                color: _withdrawEnabled ? AppColors.primary : AppColors.textMuted,
              ),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                _withdrawNote,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: _withdrawEnabled ? AppColors.primary : AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
        if (!_withdrawEnabled) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Earnings keep updating — only Withdraw is locked.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        KpiGrid(
          children: [
            KpiTile(
              label: "Today's earnings",
              value: _rupee(_today),
              icon: Icons.today_rounded,
              caption: '$_todayDeliveries deliver${_todayDeliveries == 1 ? 'y' : 'ies'}',
            ),
            KpiTile(
              label: 'Avg per delivery',
              value: _totalDeliveries > 0 && _fullTime == null
                  ? _rupee(_total / _totalDeliveries)
                  : '—',
              icon: Icons.insights_rounded,
              accent: AppColors.info,
              caption: 'Lifetime',
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AppPanel(
          title: 'This week',
          subtitle: 'Daily earnings · last 7 days',
          trailing: Text(
            _rupee(_weekTotal),
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
            ),
          ),
          child: WeeklyBarChart(
            emptyMessage: 'No earnings yet.',
            bars: [
              for (final d in _weekDays)
                ChartBar(
                  label: d['dayLabel']?.toString() ?? '',
                  value: d['beforeVerification'] == true
                      ? 0
                      : (d['totalEarnings'] as num?)?.toDouble() ?? 0,
                  highlight: d['isToday'] == true,
                  muted: d['beforeVerification'] == true,
                ),
            ],
            axisLabel: (v) => '₹${compactNumber(v)}',
            tooltipLabel: (i) {
              final d = _weekDays[i];
              if (d['beforeVerification'] == true) {
                return '${d['dayFull'] ?? d['dayLabel'] ?? ''}\nBefore verification';
              }
              final count = (d['orderCount'] as num?)?.toInt() ?? 0;
              return '${d['dayFull'] ?? d['dayLabel'] ?? ''}\n'
                  '${_rupee((d['totalEarnings'] as num?) ?? 0)} · $count order${count == 1 ? '' : 's'}';
            },
          ),
        ),
        if (_history.isNotEmpty)
          AppPanel(
            title: 'Earnings trend',
            subtitle: 'Last ${trend.values.length} days',
            trailing: Text(
              _rupee(trendTotal),
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            child: Column(
              children: [
                TrendLineChart(
                  values: trend.values,
                  labels: trend.labels,
                  labelEvery: (trend.values.length / 5).ceil(),
                  axisLabel: (v) => '₹${compactNumber(v)}',
                  tooltipLabel: (i) {
                    final count = trend.orders[i];
                    return '${trend.labels[i]}\n${_rupee(trend.values[i])} · $count order${count == 1 ? '' : 's'}';
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: _TrendStat(
                        label: 'Best day',
                        value: bestIndex >= 0 ? _rupee(bestValue) : '—',
                        caption: bestIndex >= 0 ? trend.labels[bestIndex] : null,
                      ),
                    ),
                    Expanded(
                      child: _TrendStat(
                        label: 'Active days',
                        value: '$activeDays',
                        caption: 'of ${trend.values.length}',
                      ),
                    ),
                    Expanded(
                      child: _TrendStat(
                        label: 'Avg / active day',
                        value: activeDays > 0 ? _rupee(trendTotal / activeDays) : '—',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        const SectionLabel('Daily earning history'),
        if (_history.isEmpty)
          const AppPanel(
            child: EmptyPanelMessage(
              message: 'No earnings yet.',
              icon: Icons.receipt_long_outlined,
            ),
          )
        else
          AppPanel(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
            child: Column(
              children: [
                for (var i = 0; i < _history.length; i++) ...[
                  if (i > 0) Divider(height: 1, color: AppColors.border),
                  _HistoryRow(
                    date: _history[i]['displayDate']?.toString() ?? _history[i]['date']?.toString() ?? '',
                    dayLabel: _history[i]['dayLabel']?.toString() ?? '',
                    orders: (_history[i]['orderCount'] as num?)?.toInt() ?? 0,
                    amount: _rupee((_history[i]['totalEarnings'] as num?) ?? 0),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _TrendStat extends StatelessWidget {
  const _TrendStat({required this.label, required this.value, this.caption});

  final String label;
  final String value;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted)),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        if (caption != null)
          Text(caption!, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary)),
      ],
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({
    required this.date,
    required this.dayLabel,
    required this.orders,
    required this.amount,
  });

  final String date;
  final String dayLabel;
  final int orders;
  final String amount;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF064E3B) : AppColors.primaryLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.south_west_rounded,
              color: isDark ? const Color(0xFF34D399) : AppColors.primary,
              size: 18,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  date,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  '$dayLabel · $orders deliver${orders == 1 ? 'y' : 'ies'}',
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          Text(
            '+$amount',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: isDark ? const Color(0xFF34D399) : AppColors.success,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroBlock extends StatelessWidget {
  const _HeroBlock({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: Colors.white.withValues(alpha: 0.9)),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}

class _FullTimeSalaryCard extends StatelessWidget {
  const _FullTimeSalaryCard({required this.data});

  final Map<String, dynamic> data;

  static String _deductedLabel(dynamic breakdown) {
    if (breakdown is! Map) return '';
    final cut = ((breakdown['leaveDeduction'] as num?) ?? 0) +
        ((breakdown['lateDeduction'] as num?) ?? 0);
    return cut > 0 ? '  (−₹${cut.toInt()})' : '';
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final salary = (data['monthlySalary'] as num?)?.toInt() ?? 0;
    final credited = data['currentMonthCredited'] == true;
    final credits = (data['salaryCredits'] as List? ?? const [])
        .whereType<Map>()
        .take(3)
        .toList();
    final payroll = data['currentMonthPayroll'] as Map?;
    final leave = (payroll?['leave'] as Map?) ?? const {};
    final late = (payroll?['late'] as Map?) ?? const {};
    final leaveCut = (leave['deduction'] as num?)?.toInt() ?? 0;
    final lateCut = (late['deduction'] as num?)?.toInt() ?? 0;
    final showPayroll = payroll != null &&
        !credited &&
        (leave['enabled'] == true || late['enabled'] == true);

    return AppPanel(
      margin: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.badge_outlined, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Monthly Salary',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Text(
                rupeeAmount(salary),
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: (credited ? AppColors.success : AppColors.warning).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  credited ? Icons.check_circle_rounded : Icons.hourglass_top_rounded,
                  size: 14,
                  color: credited ? AppColors.success : AppColors.warning,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    credited
                        ? '${data['currentMonth']} salary credited to your wallet'
                        : '${data['currentMonth']} salary will be credited by your Delivery Manager',
                    style: textTheme.bodySmall?.copyWith(
                      color: credited ? AppColors.success : AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Full-Time: fixed monthly salary, no per-KM earnings.',
            style: textTheme.bodySmall?.copyWith(color: AppColors.textMuted, fontSize: 11),
          ),
          if (showPayroll) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('This month (estimated)', style: textTheme.bodySmall),
                Text(
                  '₹${(payroll['netSalary'] as num?)?.toInt() ?? 0}',
                  style: textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
            if (leave['enabled'] == true)
              Text(
                'Leaves: ${leave['taken'] ?? 0} taken · ${leave['paid'] ?? 0} paid · '
                '${leave['unpaid'] ?? 0} unpaid${leaveCut > 0 ? ' (−₹$leaveCut)' : ''}',
                style: textTheme.bodySmall?.copyWith(
                  color: leaveCut > 0 ? AppColors.error : AppColors.textSecondary,
                  fontSize: 11,
                ),
              ),
            if (late['enabled'] == true)
              Text(
                'Late marks: ${late['count'] ?? 0}${lateCut > 0 ? ' (−₹$lateCut)' : ''}',
                style: textTheme.bodySmall?.copyWith(
                  color: lateCut > 0 ? AppColors.error : AppColors.textSecondary,
                  fontSize: 11,
                ),
              ),
          ],
          if (credits.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              'Recent credits',
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
              ),
            ),
            ...credits.map(
              (c) => Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  children: [
                    Icon(Icons.south_west_rounded, size: 14, color: AppColors.success),
                    const SizedBox(width: 6),
                    Expanded(child: Text(c['month']?.toString() ?? '', style: textTheme.bodySmall)),
                    Text(
                      '₹${(c['amount'] as num?)?.toInt() ?? 0}${_deductedLabel(c['breakdown'])}',
                      style: textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
