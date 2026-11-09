import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/routes/app_routes.dart';
import '../../l10n/app_localizations.dart';
import '../pickup_driver_service.dart';
import '../pickup_flow.dart';
import '../pickup_push_service.dart';

/// Colours used across the pickup-driver section (same green as vendor portal).
abstract final class PickupColors {
  static const brand = Color(0xFF217346);
  static const brandDark = Color(0xFF1A5C38);
  static const brandSoft = Color(0xFFE8F5E9);
  static const line = Color(0xFFC9E4D3);
  static const page = Color(0xFFF5F7F5);
  static const card = Colors.white;
  static const border = Color(0xFFE5E7EB);
  static const text = Color(0xFF111827);
  static const muted = Color(0xFF6B7280);
  static const faint = Color(0xFF9CA3AF);
  static const blue = Color(0xFF2563EB);
  static const error = Color(0xFFDC2626);
}

final ThemeData _pickupTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: PickupColors.brand,
    brightness: Brightness.light,
  ),
  scaffoldBackgroundColor: PickupColors.page,
  textTheme: GoogleFonts.interTextTheme(),
);

/// The pickup section always renders light, whatever the app theme is.
class PickupTheme extends StatelessWidget {
  const PickupTheme({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      Theme(data: _pickupTheme, child: child);
}

Route<T> pickupRoute<T>(Widget page) =>
    MaterialPageRoute<T>(builder: (_) => PickupTheme(child: page));

TextStyle pickupText(
  double size, {
  FontWeight weight = FontWeight.w500,
  Color color = PickupColors.text,
  double? height,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
    );

void showPickupSnack(BuildContext context, String message,
    {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? PickupColors.error : PickupColors.brand,
    ));
}

String pickupErrorText(Object e) {
  if (e is PickupDriverException) return e.message;
  final s = e.toString();
  return s.startsWith('Exception: ') ? s.substring(11) : s;
}

/// Session expired / revoked → clear and return to login.
Future<bool> handlePickupAuthError(BuildContext context, Object e) async {
  if (e is PickupDriverException && e.isUnauthorized) {
    await PickupPushService.instance.stop();
    await PickupDriverService.instance.logout();
    if (context.mounted) {
      Navigator.of(context)
          .pushNamedAndRemoveUntil(AppRoutes.login, (_) => false);
    }
    return true;
  }
  return false;
}

class PickupCard extends StatelessWidget {
  const PickupCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color = PickupColors.card,
    this.borderColor = PickupColors.border,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: child,
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        text.toUpperCase(),
        style: pickupText(11,
            weight: FontWeight.w800, color: PickupColors.brand),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: PickupColors.brandSoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: pickupText(11,
            weight: FontWeight.w700, color: PickupColors.brand),
      ),
    );
  }
}

/// Monospace ID with a tap-to-copy icon.
class CopyText extends StatelessWidget {
  const CopyText(this.value, {super.key, this.size = 12, this.color});
  final String value;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    if (value.isEmpty) {
      return Text('—', style: pickupText(size, weight: FontWeight.w600));
    }
    return InkWell(
      borderRadius: BorderRadius.circular(6),
      onTap: () {
        Clipboard.setData(ClipboardData(text: value));
        showPickupSnack(
            context, AppLocalizations.of(context).pkCopiedValue(value));
      },
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              value,
              style: GoogleFonts.robotoMono(
                fontSize: size,
                fontWeight: FontWeight.w700,
                color: color ?? PickupColors.brand,
              ),
            ),
          ),
          const SizedBox(width: 4),
          Icon(Icons.copy_rounded,
              size: size + 2, color: color ?? PickupColors.brand),
        ],
      ),
    );
  }
}

class InfoItem {
  const InfoItem(this.label, this.value, {this.copy = false});
  final String label;
  final String value;
  final bool copy;
}

class InfoGrid extends StatelessWidget {
  const InfoGrid(this.items, {super.key});
  final List<InfoItem> items;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final w = (c.maxWidth - 12) / 2;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final item in items)
            SizedBox(
              width: w,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.label.toUpperCase(),
                    style: pickupText(10,
                        weight: FontWeight.w700, color: PickupColors.faint),
                  ),
                  const SizedBox(height: 3),
                  if (item.copy && item.value.isNotEmpty)
                    CopyText(item.value, size: 11.5)
                  else
                    Text(
                      item.value.isEmpty ? '—' : item.value,
                      style: pickupText(13, weight: FontWeight.w600),
                    ),
                ],
              ),
            ),
        ],
      );
    });
  }
}

class PickupStatsGrid extends StatelessWidget {
  const PickupStatsGrid({super.key, required this.stats, this.onTap});

  final Map<String, dynamic> stats;

  /// Called with `assigned`, `progress`, `completed` or `history`.
  final ValueChanged<String>? onTap;

  int _n(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final tiles = [
      (l10n.timelineAssigned, _n(stats['assigned'] ?? stats['pending']),
          'assigned', PickupColors.text),
      (l10n.inProgress, _n(stats['inProgress']), 'progress', PickupColors.blue),
      (l10n.completed, _n(stats['completed']), 'completed', PickupColors.brand),
      (l10n.pkTotal, _n(stats['totalAssigned']), 'history', PickupColors.text),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 2.3,
      children: [
        for (final t in tiles)
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: onTap == null ? null : () => onTap!(t.$3),
            child: PickupCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(t.$1,
                      style: pickupText(12, color: PickupColors.muted)),
                  const SizedBox(height: 2),
                  Text('${t.$2}',
                      style: pickupText(20,
                          weight: FontWeight.w800, color: t.$4)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Vertical step tracker (same steps as vendor `PickupTimeline`).
class PickupTimelineView extends StatelessWidget {
  const PickupTimelineView({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final idx = pickupTimelineIndex(status);
    final steps = pickupTimelineSteps;
    return Column(
      children: [
        for (var i = 0; i < steps.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 20,
                  child: Column(
                    children: [
                      Container(
                        width: 18,
                        height: 18,
                        margin: const EdgeInsets.only(top: 1),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(
                            width: 3,
                            color: idx >= 0 && i <= idx
                                ? PickupColors.brand
                                : PickupColors.line,
                          ),
                        ),
                        child: idx >= 0 && i <= idx
                            ? Center(
                                child: Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(
                                    color: PickupColors.brand,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              )
                            : null,
                      ),
                      if (i < steps.length - 1)
                        Expanded(
                          child: Container(
                            width: 3,
                            color: idx >= 0 && i < idx
                                ? PickupColors.brand
                                : PickupColors.line,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                        bottom: i < steps.length - 1 ? 14 : 0),
                    child: Text(
                      pickupStatusLabel(steps[i]),
                      style: pickupText(13,
                          weight: FontWeight.w600,
                          color: idx >= 0 && i <= idx
                              ? PickupColors.brand
                              : PickupColors.faint),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class PickupButton extends StatelessWidget {
  const PickupButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.outlined = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final bool outlined;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: outlined ? PickupColors.brand : Colors.white,
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18),
                const SizedBox(width: 6),
              ],
              Flexible(
                child: Text(label,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                        fontSize: 13.5, fontWeight: FontWeight.w700)),
              ),
            ],
          );
    final shape =
        RoundedRectangleBorder(borderRadius: BorderRadius.circular(10));
    const size = Size.fromHeight(46);
    if (outlined) {
      return OutlinedButton(
        onPressed: busy ? null : onPressed,
        style: OutlinedButton.styleFrom(
          minimumSize: size,
          foregroundColor: PickupColors.brand,
          side: const BorderSide(color: PickupColors.brand),
          shape: shape,
        ),
        child: child,
      );
    }
    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: FilledButton.styleFrom(
        minimumSize: size,
        backgroundColor: PickupColors.brand,
        disabledBackgroundColor: PickupColors.brand.withValues(alpha: 0.55),
        foregroundColor: Colors.white,
        shape: shape,
      ),
      child: child,
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState(this.message, {super.key, this.icon = Icons.inbox_outlined});
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return PickupCard(
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
      child: Column(
        children: [
          Icon(icon, size: 40, color: PickupColors.faint),
          const SizedBox(height: 10),
          Text(message,
              textAlign: TextAlign.center,
              style: pickupText(14, color: PickupColors.faint)),
        ],
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner(this.message, {super.key});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Text(message,
          style: pickupText(12.5, color: PickupColors.error)),
    );
  }
}

/// Bottom sheet with a scannable QR (order or batch).
Future<void> showPickupQrSheet(
  BuildContext context, {
  required String title,
  required String payload,
  required String caption,
  String facts = '',
  String footer = '',
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.white,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: PickupColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: pickupText(16, weight: FontWeight.w800)),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: Text(AppLocalizations.of(ctx).pkClose),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (payload.isEmpty)
              Container(
                width: 220,
                height: 220,
                alignment: Alignment.center,
                color: PickupColors.page,
                child: Text(AppLocalizations.of(ctx).pkNoQr,
                    style: pickupText(12, color: PickupColors.faint)),
              )
            else
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: PickupColors.border),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: QrImageView(
                  data: payload,
                  size: 240,
                  errorCorrectionLevel: QrErrorCorrectLevel.M,
                  backgroundColor: Colors.white,
                ),
              ),
            const SizedBox(height: 10),
            SelectableText(
              caption,
              textAlign: TextAlign.center,
              style: GoogleFonts.robotoMono(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: PickupColors.muted,
              ),
            ),
            if (facts.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(facts,
                  textAlign: TextAlign.center,
                  style: pickupText(12, color: PickupColors.muted)),
            ],
            if (footer.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(footer,
                  textAlign: TextAlign.center,
                  style: pickupText(11, color: PickupColors.faint)),
            ],
          ],
        ),
      ),
    ),
  );
}

void showOrderQr(BuildContext context, Map<String, dynamic> pickup) {
  final l10n = AppLocalizations.of(context);
  final payload = buildOrderQrPayload(pickup);
  showPickupQrSheet(
    context,
    title: l10n.pkOrderQr,
    payload: payload,
    caption: orderQrLabel(payload),
    facts: orderQrFacts(payload),
    footer: l10n.pkScanToViewOrderDetails,
  );
}

void showBatchQr(
  BuildContext context, {
  required String batchId,
  required Map<String, dynamic> record,
}) {
  final l10n = AppLocalizations.of(context);
  final payload = buildBatchQrPayload(record, batchId);
  showPickupQrSheet(
    context,
    title: l10n.pkBatchQr,
    payload: payload,
    caption: batchQrLabel(payload.isNotEmpty ? payload : batchId),
    facts: batchQrFacts(payload),
    footer: l10n.pkScanToViewBatchDetails,
  );
}
