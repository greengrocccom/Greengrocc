import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/config/api_config.dart';
import '../../../core/config/cached_get.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/l10n/app_l10n.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/charts/donut_chart.dart';
import '../../widgets/charts/progress_ring.dart';
import '../../widgets/common/app_panel.dart';
import '../../widgets/layout/custom_app_bar.dart';

class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _data;

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
        ApiConfig.performance,
        headers: AuthService.instance.authHeaders,
        onData: (body) {
          if (!mounted) return;
          setState(() {
            _loading = false;
            _data = body;
          });
        },
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = appL10n.ftCouldNotLoadPerformance;
      });
    }
  }

  double? _pct(String key) => (_data?[key] as num?)?.toDouble();

  int _count(Map<String, dynamic>? counts, String key) =>
      (counts?[key] as num?)?.toInt() ?? 0;

  String _rateText(double? v) {
    if (v == null) return '—';
    return '${v % 1 == 0 ? v.toInt() : v.toStringAsFixed(1)}%';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(
        title: l10n.performance,
        subtitle: l10n.deliveryMetrics,
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
                : _content(l10n),
      ),
    );
  }

  Widget _content(AppLocalizations l10n) {
    final rating = _data?['customerRating'] as Map<String, dynamic>?;
    final avg = (rating?['average'] as num?)?.toDouble();
    final ratingCount = (rating?['count'] as num?)?.toInt() ?? 0;
    final counts = _data?['counts'] as Map<String, dynamic>?;
    final since = DateTime.tryParse(_data?['since']?.toString() ?? '')?.toLocal();

    final offered = _count(counts, 'offered');
    final accepted = _count(counts, 'accepted');
    final declined = _count(counts, 'declined');
    final timeout = _count(counts, 'timeout');
    final pending = (offered - accepted - declined - timeout).clamp(0, offered);
    final delivered = _count(counts, 'delivered');
    final cancelled = _count(counts, 'cancelled');
    final failed = _count(counts, 'failed');
    final onTime = _count(counts, 'onTime');

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxxl),
      children: [
        _RatingHero(
          title: l10n.customerRating,
          average: avg,
          count: ratingCount,
          since: since,
        ),
        const SizedBox(height: AppSpacing.lg),
        AppPanel(
          title: l10n.ftKeyRates,
          subtitle: l10n.ftSinceVerification,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ProgressRing(
                  percent: _pct('acceptanceRate'),
                  label: l10n.acceptanceRate,
                  color: AppColors.primary,
                  size: 84,
                ),
              ),
              Expanded(
                child: ProgressRing(
                  percent: _pct('onTimeDeliveryRate'),
                  label: l10n.onTimeDelivery,
                  color: AppColors.info,
                  size: 84,
                ),
              ),
              Expanded(
                child: ProgressRing(
                  percent: _pct('declineRate'),
                  label: l10n.ftDeclineRate,
                  color: AppColors.warning,
                  size: 84,
                ),
              ),
            ],
          ),
        ),
        AppPanel(
          title: l10n.ftOrderOffers,
          subtitle: l10n.ftHowYouRespondedOffers,
          child: offered == 0
              ? EmptyPanelMessage(
                  message: l10n.ftNoOrderOffersYet,
                  icon: Icons.notifications_none_rounded,
                )
              : DonutChart(
                  centerTitle: '$offered',
                  centerSubtitle: l10n.ftOffersLower,
                  segments: [
                    DonutSegment(label: l10n.ftAccepted, value: accepted.toDouble(), color: AppColors.primary),
                    DonutSegment(label: l10n.ftDeclined, value: declined.toDouble(), color: AppColors.warning),
                    DonutSegment(label: l10n.ftMissed, value: timeout.toDouble(), color: AppColors.error),
                    if (pending > 0)
                      DonutSegment(label: l10n.pending, value: pending.toDouble(), color: AppColors.textMuted),
                  ],
                ),
        ),
        AppPanel(
          title: l10n.ftTripOutcomes,
          subtitle: l10n.ftDeliveredVsCancelledVsFailed,
          child: delivered + cancelled + failed == 0
              ? EmptyPanelMessage(
                  message: l10n.ftTripOutcomesEmpty,
                  icon: Icons.delivery_dining_outlined,
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SegmentBar(
                      height: 12,
                      segments: [
                        (delivered.toDouble(), AppColors.primary),
                        (cancelled.toDouble(), AppColors.warning),
                        (failed.toDouble(), AppColors.error),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        Expanded(child: _OutcomeStat(label: l10n.delivered, value: delivered, color: AppColors.primary)),
                        Expanded(child: _OutcomeStat(label: l10n.ftCancelled, value: cancelled, color: AppColors.warning)),
                        Expanded(child: _OutcomeStat(label: l10n.failedStatus, value: failed, color: AppColors.error)),
                      ],
                    ),
                    if (delivered > 0) ...[
                      const Divider(height: 28),
                      Row(
                        children: [
                          Icon(Icons.timer_outlined, size: 18, color: AppColors.info),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              l10n.ftOnTimeDeliveries,
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                          Text(
                            l10n.ftCountOfTotal('$onTime', '$delivered'),
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      SegmentBar(
                        height: 8,
                        segments: [
                          (onTime.toDouble(), AppColors.info),
                          ((delivered - onTime).clamp(0, delivered).toDouble(), AppColors.border),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        l10n.ftDeliveredWithin60Min,
                        style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
                      ),
                    ],
                  ],
                ),
        ),
        KpiGrid(
          children: [
            KpiTile(
              label: l10n.ftTripsDelivered,
              value: '$delivered',
              icon: Icons.check_circle_outline_rounded,
            ),
            KpiTile(
              label: l10n.ftOffersReceived,
              value: '$offered',
              icon: Icons.notifications_active_outlined,
              accent: AppColors.info,
            ),
            KpiTile(
              label: l10n.ftCancellationRate,
              value: _rateText(_pct('cancellationRate')),
              icon: Icons.cancel_outlined,
              accent: AppColors.warning,
            ),
            KpiTile(
              label: l10n.ftMissedOffers,
              value: '$timeout',
              icon: Icons.timer_off_outlined,
              accent: AppColors.error,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xl),
        Text(
          ratingCount == 0
              ? l10n.ftRatingsAppearAfter
              : l10n.ftBasedOnDeliveriesSinceVerification,
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted),
        ),
      ],
    );
  }
}

class _RatingHero extends StatelessWidget {
  const _RatingHero({
    required this.title,
    required this.average,
    required this.count,
    required this.since,
  });

  final String title;
  final double? average;
  final int count;
  final DateTime? since;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final hasRating = count > 0 && average != null;
    final value = hasRating ? average! : 0.0;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: brandHeroDecoration(),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      hasRating ? value.toStringAsFixed(1) : '—',
                      style: GoogleFonts.inter(
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1,
                      ),
                    ),
                    if (hasRating)
                      Padding(
                        padding: const EdgeInsets.only(left: 4, bottom: 2),
                        child: Text(
                          '/ 5',
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.white.withValues(alpha: 0.75),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: List.generate(5, (i) {
                    final fill = (value - i).clamp(0.0, 1.0);
                    return Icon(
                      fill >= 0.75
                          ? Icons.star_rounded
                          : fill >= 0.25
                              ? Icons.star_half_rounded
                              : Icons.star_outline_rounded,
                      color: const Color(0xFFFCD34D),
                      size: 18,
                    );
                  }),
                ),
                const SizedBox(height: 6),
                Text(
                  hasRating
                      ? [
                          count == 1 ? l10n.ftRatingCountOne(count.toString()) : l10n.ratingsCount(count),
                          if (since != null) l10n.ftSinceDate(localizedDateFormat('d MMM yyyy').format(since!)),
                        ].join(' · ')
                      : l10n.ftNoRatingsYet,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 28),
          ),
        ],
      ),
    );
  }
}

class _OutcomeStat extends StatelessWidget {
  const _OutcomeStat({required this.label, required this.value, required this.color});

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LegendDot(color: color, label: label),
        const SizedBox(height: 4),
        Text(
          '$value',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
