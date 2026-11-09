import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';

class AppPanel extends StatelessWidget {
  const AppPanel({
    super.key,
    required this.child,
    this.title,
    this.subtitle,
    this.trailing,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.margin = const EdgeInsets.only(bottom: AppSpacing.lg),
    this.onTap,
  });

  final Widget child;
  final String? title;
  final String? subtitle;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    Theme.of(context);
    final hasHeader = title != null || trailing != null;
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: padding,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasHeader) ...[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (title != null)
                              Text(
                                title!,
                                style: GoogleFonts.inter(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            if (subtitle != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                subtitle!,
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      if (trailing != null) ...[
                        const SizedBox(width: 8),
                        trailing!,
                      ],
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
                child,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.subtitle, this.trailing});

  final String text;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md, top: AppSpacing.xs),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  text,
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted),
                  ),
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

class KpiTile extends StatelessWidget {
  const KpiTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.accent,
    this.caption,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? accent;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final color = accent ?? AppColors.primary;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
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
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, color: color, size: 19),
          ),
          const SizedBox(height: 12),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          if (caption != null)
            Text(
              caption!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
            ),
        ],
      ),
    );
  }
}

class KpiGrid extends StatelessWidget {
  const KpiGrid({super.key, required this.children, this.columns = 2});

  final List<Widget> children;
  final int columns;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      final slice = children.sublist(i, (i + columns).clamp(0, children.length));
      rows.add(
        Padding(
          padding: EdgeInsets.only(bottom: i + columns < children.length ? AppSpacing.md : 0),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var j = 0; j < columns; j++) ...[
                  if (j > 0) const SizedBox(width: AppSpacing.md),
                  Expanded(child: j < slice.length ? slice[j] : const SizedBox.shrink()),
                ],
              ],
            ),
          ),
        ),
      );
    }
    return Column(children: rows);
  }
}

class HeroStat extends StatelessWidget {
  const HeroStat({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: GoogleFonts.inter(
            fontSize: 11,
            color: Colors.white.withValues(alpha: 0.8),
          ),
        ),
      ],
    );
  }
}

BoxDecoration brandHeroDecoration() {
  final isDark = ThemeController.instance.isDark;
  return BoxDecoration(
    gradient: LinearGradient(
      colors: isDark
          ? const [Color(0xFF064E3B), Color(0xFF0F291E)]
          : const [Color(0xFF0F5A32), Color(0xFF084826)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    borderRadius: BorderRadius.circular(16),
    boxShadow: [
      BoxShadow(
        color: isDark ? Colors.black45 : const Color(0xFF0F5A32).withValues(alpha: 0.22),
        blurRadius: 10,
        offset: const Offset(0, 4),
      ),
    ],
  );
}

class LegendDot extends StatelessWidget {
  const LegendDot({super.key, required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

class ErrorPanel extends StatelessWidget {
  const ErrorPanel({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Center(
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.cloud_off_rounded, color: AppColors.error, size: 30),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              message,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary),
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: Text(AppLocalizations.of(context).uiRetry),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class EmptyPanelMessage extends StatelessWidget {
  const EmptyPanelMessage({
    super.key,
    required this.message,
    this.icon = Icons.inbox_outlined,
  });

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Center(
        child: Column(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle),
              child: Icon(icon, color: AppColors.primary, size: 24),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class SkeletonBox extends StatefulWidget {
  const SkeletonBox({super.key, this.height = 16, this.width, this.radius = 12});

  final double height;
  final double? width;
  final double radius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.45, end: 1).animate(_controller),
      child: Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          color: ThemeController.instance.isDark ? AppColors.border : const Color(0xFFEDF1F5),
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

class PageSkeleton extends StatelessWidget {
  const PageSkeleton({super.key, this.padding = const EdgeInsets.all(AppSpacing.lg)});

  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: padding,
      children: const [
        SkeletonBox(height: 150, radius: 20),
        SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Expanded(child: SkeletonBox(height: 96, radius: 16)),
            SizedBox(width: AppSpacing.md),
            Expanded(child: SkeletonBox(height: 96, radius: 16)),
          ],
        ),
        SizedBox(height: AppSpacing.lg),
        SkeletonBox(height: 230, radius: 18),
        SizedBox(height: AppSpacing.lg),
        SkeletonBox(height: 64, radius: 16),
        SizedBox(height: AppSpacing.md),
        SkeletonBox(height: 64, radius: 16),
      ],
    );
  }
}
