import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_colors.dart';
import 'chart_utils.dart';

class ChartBar {
  const ChartBar({
    required this.label,
    required this.value,
    this.highlight = false,
    this.muted = false,
  });

  final String label;
  final double value;
  final bool highlight;
  final bool muted;
}

class WeeklyBarChart extends StatelessWidget {
  const WeeklyBarChart({
    super.key,
    required this.bars,
    required this.tooltipLabel,
    this.axisLabel,
    this.color,
    this.height = 190,
    this.onBarTap,
    this.emptyMessage = 'No data yet',
    this.labelEvery = 1,
  });

  final List<ChartBar> bars;
  final String Function(int index) tooltipLabel;
  final String Function(double value)? axisLabel;
  final Color? color;
  final double height;
  final ValueChanged<int>? onBarTap;
  final String emptyMessage;
  final int labelEvery;

  @override
  Widget build(BuildContext context) {
    final accent = color ?? AppColors.primary;
    if (bars.isEmpty) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text(
            emptyMessage,
            style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted),
          ),
        ),
      );
    }
    final maxValue = bars.fold<double>(0, (m, b) => b.value > m ? b.value : m);
    final maxY = niceMaxY(maxValue);
    final interval = maxY / 4;
    final barWidth = bars.length <= 7 ? 20.0 : (bars.length <= 14 ? 12.0 : 7.0);

    return SizedBox(
      height: height,
      child: BarChart(
        BarChartData(
          minY: 0,
          maxY: maxY,
          alignment: BarChartAlignment.spaceAround,
          borderData: FlBorderData(show: false),
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: interval,
            getDrawingHorizontalLine: (_) => FlLine(
              color: AppColors.border,
              strokeWidth: 1,
              dashArray: const [4, 4],
            ),
          ),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: axisLabel != null,
                reservedSize: axisLabel != null ? 34 : 0,
                interval: interval,
                getTitlesWidget: (value, meta) {
                  if (value == meta.max) return const SizedBox.shrink();
                  return SideTitleWidget(
                    meta: meta,
                    child: Text(
                      axisLabel!(value),
                      style: GoogleFonts.inter(fontSize: 9, color: AppColors.textMuted),
                    ),
                  );
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 28,
                getTitlesWidget: (value, meta) {
                  final i = value.toInt();
                  if (i < 0 || i >= bars.length) return const SizedBox.shrink();
                  final bar = bars[i];
                  final step = labelEvery < 1 ? 1 : labelEvery;
                  if (!bar.highlight && (bars.length - 1 - i) % step != 0) {
                    return const SizedBox.shrink();
                  }
                  return SideTitleWidget(
                    meta: meta,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        bar.label,
                        maxLines: 1,
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: bar.highlight ? FontWeight.w800 : FontWeight.w500,
                          color: bar.highlight ? accent : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          barTouchData: BarTouchData(
            touchCallback: onBarTap == null
                ? null
                : (event, response) {
                    final spot = response?.spot;
                    if (event is FlTapUpEvent && spot != null) {
                      onBarTap!(spot.touchedBarGroupIndex);
                    }
                  },
            touchTooltipData: BarTouchTooltipData(
              getTooltipColor: (_) => AppColors.textPrimary,
              tooltipBorderRadius: BorderRadius.circular(10),
              tooltipPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              tooltipMargin: 8,
              maxContentWidth: 180,
              fitInsideHorizontally: true,
              fitInsideVertically: true,
              getTooltipItem: (group, groupIndex, rod, rodIndex) => BarTooltipItem(
                tooltipLabel(groupIndex),
                GoogleFonts.inter(
                  color: AppColors.surface,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          barGroups: [
            for (var i = 0; i < bars.length; i++)
              BarChartGroupData(
                x: i,
                barRods: [
                  BarChartRodData(
                    toY: bars[i].value < 0 ? 0 : bars[i].value,
                    width: barWidth,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                    gradient: bars[i].muted
                        ? null
                        : LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: bars[i].highlight
                                ? [accent, accent.withValues(alpha: 0.8)]
                                : [accent.withValues(alpha: 0.55), accent.withValues(alpha: 0.35)],
                          ),
                    color: bars[i].muted ? AppColors.border : null,
                    backDrawRodData: BackgroundBarChartRodData(
                      show: true,
                      toY: maxY,
                      color: AppColors.surfaceVariant,
                    ),
                  ),
                ],
              ),
          ],
        ),
        duration: const Duration(milliseconds: 450),
      ),
    );
  }
}
