import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import 'chart_utils.dart';

class TrendLineChart extends StatelessWidget {
  const TrendLineChart({
    super.key,
    required this.values,
    required this.labels,
    required this.tooltipLabel,
    this.axisLabel,
    this.color,
    this.height = 190,
    this.labelEvery = 1,
    this.emptyMessage,
  });

  final List<double> values;
  final List<String> labels;
  final String Function(int index) tooltipLabel;
  final String Function(double value)? axisLabel;
  final Color? color;
  final double height;
  final int labelEvery;
  final String? emptyMessage;

  @override
  Widget build(BuildContext context) {
    final accent = color ?? AppColors.primary;
    if (values.length < 2) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text(
            emptyMessage ?? AppLocalizations.of(context).ftNotEnoughTrendData,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted),
          ),
        ),
      );
    }
    final maxValue = values.fold<double>(0, (m, v) => v > m ? v : m);
    final maxY = niceMaxY(maxValue);
    final interval = maxY / 4;
    final step = labelEvery < 1 ? 1 : labelEvery;

    return SizedBox(
      height: height,
      child: LineChart(
        LineChartData(
          minX: 0,
          maxX: (values.length - 1).toDouble(),
          minY: 0,
          maxY: maxY,
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
                reservedSize: 40,
                interval: interval,
                getTitlesWidget: (value, meta) {
                  if (value == meta.max) return const SizedBox.shrink();
                  return SideTitleWidget(
                    meta: meta,
                    child: Text(
                      axisLabel!(value),
                      style: GoogleFonts.inter(fontSize: 10, color: AppColors.textMuted),
                    ),
                  );
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 28,
                interval: 1,
                getTitlesWidget: (value, meta) {
                  final i = value.toInt();
                  if (value != i.toDouble() || i < 0 || i >= labels.length) {
                    return const SizedBox.shrink();
                  }
                  final isLast = i == labels.length - 1;
                  if (i % step != 0 && !isLast) return const SizedBox.shrink();
                  if (!isLast && labels.length - 1 - i < step / 2 && i != 0) {
                    return const SizedBox.shrink();
                  }
                  return SideTitleWidget(
                    meta: meta,
                    child: Text(
                      labels[i],
                      style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSecondary),
                    ),
                  );
                },
              ),
            ),
          ),
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              getTooltipColor: (_) => AppColors.textPrimary,
              tooltipBorderRadius: BorderRadius.circular(10),
              tooltipPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              maxContentWidth: 180,
              fitInsideHorizontally: true,
              fitInsideVertically: true,
              getTooltipItems: (spots) => spots
                  .map(
                    (s) => LineTooltipItem(
                      tooltipLabel(s.x.toInt()),
                      GoogleFonts.inter(
                        color: AppColors.surface,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: [
                for (var i = 0; i < values.length; i++)
                  FlSpot(i.toDouble(), values[i] < 0 ? 0 : values[i]),
              ],
              isCurved: true,
              preventCurveOverShooting: true,
              color: accent,
              barWidth: 3,
              isStrokeCapRound: true,
              dotData: FlDotData(
                show: values.length <= 10,
                getDotPainter: (spot, percent, bar, index) => FlDotCirclePainter(
                  radius: 3.5,
                  color: AppColors.surface,
                  strokeWidth: 2.5,
                  strokeColor: accent,
                ),
              ),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [accent.withValues(alpha: 0.25), accent.withValues(alpha: 0.0)],
                ),
              ),
            ),
          ],
        ),
        duration: const Duration(milliseconds: 450),
      ),
    );
  }
}
