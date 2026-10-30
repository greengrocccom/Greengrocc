import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/order_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/charts/chart_utils.dart';
import '../../widgets/charts/trend_line_chart.dart';
import '../../widgets/charts/weekly_bar_chart.dart';
import '../../widgets/common/app_panel.dart';
import '../../widgets/layout/custom_app_bar.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  bool _loading = true;
  int _todayEarnings = 0;
  int _orderCount = 0;
  int _lifetime = 0;
  List<Map<String, dynamic>> _deliveries = const [];
  List<Map<String, dynamic>> _weekDays = const [];
  int _weekTotal = 0;
  int _weekOrders = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      OrderService.instance.fetchEarningsDetail(),
      OrderService.instance.fetchWeeklyEarnings(),
    ]);
    final data = results[0];
    final week = results[1];
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (data != null) {
        _todayEarnings = (data['totalEarnings'] as num?)?.toInt() ??
            (data['todayEarnings'] as num?)?.toInt() ??
            0;
        _orderCount = (data['orderCount'] as num?)?.toInt() ?? 0;
        _lifetime = (data['totalLifetimeEarnings'] as num?)?.toInt() ?? 0;
        _deliveries = (data['deliveries'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
      if (week != null) {
        _weekDays = (week['days'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _weekTotal = (week['weekTotalEarnings'] as num?)?.toInt() ?? 0;
        _weekOrders = (week['weekOrderCount'] as num?)?.toInt() ?? 0;
        final weekLifetime = (week['totalLifetimeEarnings'] as num?)?.toInt();
        if (_lifetime == 0 && weekLifetime != null) _lifetime = weekLifetime;
      }
    });
  }

  String _rupee(num n) => rupeeAmount(n);

  static DateTime? _deliveredAt(Map<String, dynamic> d) =>
      d['deliveredAt'] != null ? DateTime.tryParse(d['deliveredAt'].toString())?.toLocal() : null;

  static String _hhmm(DateTime? t) => t == null
      ? '—'
      : '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(
        title: l10n.earnings,
        subtitle: l10n.trackYourIncome,
        showBackButton: true,
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: _loading ? const PageSkeleton() : _content(l10n),
      ),
    );
  }

  Widget _content(AppLocalizations l10n) {
    final totalKm = _deliveries.fold<double>(
      0,
      (s, d) => s + ((d['deliveryDistanceKm'] as num?)?.toDouble() ?? 0),
    );
    final avgPerOrder = _orderCount > 0 ? _todayEarnings / _orderCount : null;
    final perKm = totalKm > 0 ? _todayEarnings / totalKm : null;

    final timeline = [..._deliveries]
      ..sort((a, b) {
        final ta = _deliveredAt(a);
        final tb = _deliveredAt(b);
        if (ta == null || tb == null) return 0;
        return ta.compareTo(tb);
      });
    final cumulative = <double>[];
    var running = 0.0;
    for (final d in timeline) {
      running += (d['riderDeliveryEarning'] as num?)?.toDouble() ?? 0;
      cumulative.add(running);
    }
    final timelineLabels = [for (final d in timeline) _hhmm(_deliveredAt(d))];

    final activeWeekDays = _weekDays.where((d) => ((d['totalEarnings'] as num?) ?? 0) > 0).length;

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
                  Expanded(
                    child: Text(
                      l10n.todaysEarnings,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                    ),
                    child: const Icon(Icons.trending_up_rounded, color: Colors.white, size: 18),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  _rupee(_todayEarnings),
                  style: GoogleFonts.inter(
                    fontSize: 38,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    height: 1.1,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                l10n.deliveriesUpdatedLive(_orderCount, l10n.updatedLive),
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.85),
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
                    Expanded(child: HeroStat(label: l10n.todayTrips, value: '$_orderCount')),
                    Expanded(child: HeroStat(label: 'Distance', value: '${totalKm.toStringAsFixed(1)} km')),
                    Expanded(
                      child: HeroStat(
                        label: 'Avg / order',
                        value: avgPerOrder == null ? '—' : _rupee(avgPerOrder),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        KpiGrid(
          children: [
            KpiTile(
              label: l10n.lifetimeEarnings,
              value: _rupee(_lifetime),
              icon: Icons.savings_outlined,
              accent: AppColors.info,
            ),
            KpiTile(
              label: 'Earning per km',
              value: perKm == null ? '—' : _rupee(perKm),
              icon: Icons.route_outlined,
              accent: const Color(0xFF8B5CF6),
              caption: 'Today',
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AppPanel(
          title: 'Last 7 days',
          subtitle: '$_weekOrders order${_weekOrders == 1 ? '' : 's'} · '
              '${activeWeekDays > 0 ? '${_rupee(_weekTotal / activeWeekDays)} avg / active day' : 'no earnings yet'}',
          trailing: Text(
            _rupee(_weekTotal),
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
            ),
          ),
          child: WeeklyBarChart(
            emptyMessage: 'Weekly earnings unavailable right now',
            bars: [
              for (final d in _weekDays)
                ChartBar(
                  label: d['dayLabel']?.toString() ?? '',
                  value: (d['totalEarnings'] as num?)?.toDouble() ?? 0,
                  highlight: d['isToday'] == true,
                ),
            ],
            axisLabel: (v) => '₹${compactNumber(v)}',
            tooltipLabel: (i) {
              final d = _weekDays[i];
              final count = (d['orderCount'] as num?)?.toInt() ?? 0;
              return '${d['dayLabel'] ?? ''} · ${d['date'] ?? ''}\n'
                  '${_rupee((d['totalEarnings'] as num?) ?? 0)} · $count order${count == 1 ? '' : 's'}';
            },
          ),
        ),
        if (cumulative.length >= 2)
          AppPanel(
            title: "Today's earnings timeline",
            subtitle: 'Cumulative earnings after each delivery',
            child: TrendLineChart(
              values: cumulative,
              labels: timelineLabels,
              labelEvery: (cumulative.length / 4).ceil(),
              axisLabel: (v) => '₹${compactNumber(v)}',
              tooltipLabel: (i) => '${timelineLabels[i]}\n${_rupee(cumulative[i])} total',
            ),
          ),
        SectionLabel(
          l10n.todaysDeliveries,
          trailing: _deliveries.isEmpty
              ? null
              : Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${_deliveries.length}',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primaryDark,
                    ),
                  ),
                ),
        ),
        if (_deliveries.isEmpty)
          AppPanel(
            child: EmptyPanelMessage(
              message: l10n.noDeliveriesTodayYet,
              icon: Icons.delivery_dining_outlined,
            ),
          )
        else
          AppPanel(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
            child: Column(
              children: [
                for (var i = 0; i < _deliveries.length; i++) ...[
                  if (i > 0) Divider(height: 1, color: AppColors.border),
                  _DeliveryRow(
                    title: l10n.orderNumberHash(_deliveries[i]['orderNumber']?.toString() ?? '—'),
                    subtitle: '${_hhmm(_deliveredAt(_deliveries[i]))} · '
                        '${l10n.distanceKmValue(((_deliveries[i]['deliveryDistanceKm'] as num?)?.toDouble() ?? 0).toStringAsFixed(1))}',
                    amount: _rupee((_deliveries[i]['riderDeliveryEarning'] as num?) ?? 0),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _DeliveryRow extends StatelessWidget {
  const _DeliveryRow({required this.title, required this.subtitle, required this.amount});

  final String title;
  final String subtitle;
  final String amount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.shopping_bag_outlined, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          Text(
            '+$amount',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.success,
            ),
          ),
        ],
      ),
    );
  }
}
