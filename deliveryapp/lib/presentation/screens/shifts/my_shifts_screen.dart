import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/auth_service.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/shift_service.dart';
import '../../../data/services/socket_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/dialogs/status_dialog.dart';
import '../../widgets/layout/custom_app_bar.dart';

/// Slots assigned by Admin / Delivery Manager. Riders can no longer book or cancel slots.
class MyShiftsScreen extends StatefulWidget {
  const MyShiftsScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<MyShiftsScreen> createState() => _MyShiftsScreenState();
}

class _MyShiftsScreenState extends State<MyShiftsScreen> {
  bool _loading = true;
  List<ShiftBookingInfo> _todayBookings = const [];
  List<ShiftBookingInfo> _upcomingBookings = const [];
  StreamSubscription<Map<String, dynamic>>? _deliverySub;
  StreamSubscription<Map<String, dynamic>>? _notificationSub;
  Timer? _phaseTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _phaseTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) _load(silent: true);
    });
    _deliverySub = SocketService.instance.onActiveDeliveryUpdated.listen((event) {
      final reason = event['reason']?.toString() ?? '';
      if (reason.startsWith('shift_')) _load(silent: true);
    });
    _notificationSub = SocketService.instance.onRiderNotification.listen((event) {
      if (event['type']?.toString() == 'SHIFT_ASSIGNED') _load(silent: true);
    });
  }

  @override
  void dispose() {
    _phaseTimer?.cancel();
    _deliverySub?.cancel();
    _notificationSub?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    final res = await ShiftService.instance.fetchMyBookings();
    if (!mounted) return;
    setState(() {
      _todayBookings = (res['todayBookings'] as List<ShiftBookingInfo>?) ?? const [];
      _upcomingBookings = (res['upcomingBookings'] as List<ShiftBookingInfo>?) ?? const [];
      _loading = false;
    });
    final msgs = await AuthService.instance.consumeSlotCancellationAlerts();
    if (!mounted || msgs.isEmpty) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msgs.join('\n')),
        duration: const Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _goOnlineWithLocation() async {
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.detectingLocation), duration: const Duration(seconds: 2)),
    );

    final position = await LocationService.instance.getCurrentLocation();
    if (!mounted) return;
    if (position == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.locationUnavailable), backgroundColor: AppColors.error),
      );
      return;
    }

    final result = await ShiftService.instance.goOnlineWithLocation(position.latitude, position.longitude);
    if (!mounted) return;
    await showStatusDialog(
      context,
      success: result.success,
      title: result.success ? l10n.locationVerified : l10n.locationCheckFailed,
      message: result.message,
      buttonLabel: l10n.ok,
    );
    if (result.success) _load(silent: true);
  }

  String _num(double v) => v % 1 == 0 ? v.toStringAsFixed(0) : v.toStringAsFixed(1);

  String _incentiveText(AppLocalizations l10n, ShiftBookingInfo b) {
    final rate = _num(b.incentiveRate);
    if (b.incentiveMode == 'per_hour') return l10n.incentivePerHour(rate);
    if (b.incentiveAfterKm > 0) {
      final text = l10n.incentivePerKmAfter(rate, _num(b.incentiveAfterKm));
      if (b.isCompleted || b.kmDelivered <= 0) return text;
      return '$text · ${l10n.kmDoneInSlot(_num(b.kmDelivered), _num(b.incentiveAfterKm))}';
    }
    return l10n.incentivePerKm(rate);
  }

  String _dateLabel(String dateString) {
    final d = DateTime.tryParse(dateString);
    if (d == null) return dateString;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${days[d.weekday - 1]}, ${d.day} ${months[d.month - 1]}';
  }

  Widget _sectionTitle(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(
          text,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: AppColors.textSecondary,
            letterSpacing: 1.2,
          ),
        ),
      );

  Widget _slotCard(AppLocalizations l10n, ShiftBookingInfo b, {bool today = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final green = isDark ? const Color(0xFF6EE7B7) : const Color(0xFF0F5A32);
    const grey = Color(0xFF64748B);
    final badgeColor = b.isCompleted
        ? grey
        : b.isRunning
            ? green
            : (isDark ? const Color(0xFF93C5FD) : const Color(0xFF1D4ED8));
    final badgeText = b.isCompleted
        ? l10n.completed
        : b.isRunning
            ? l10n.shiftRunning
            : l10n.shiftUpcoming;
    final highlight = today && b.isRunning;
    return Opacity(
      opacity: b.isCompleted ? 0.7 : 1,
      child: Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: highlight ? green : AppColors.cardBorder,
          width: highlight ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${b.startTime} – ${b.endTime}',
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (b.isCompleted) ...[
                      Icon(Icons.check_circle_rounded, size: 12, color: badgeColor),
                      const SizedBox(width: 3),
                    ],
                    Text(
                      badgeText,
                      style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w800, color: badgeColor),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (!today) ...[
            const SizedBox(height: 2),
            Text(_dateLabel(b.dateString),
                style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.storefront_rounded, size: 14, color: AppColors.primary),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  b.storeName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
                ),
              ),
            ],
          ),
          if (b.hasIncentive) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.local_fire_department_rounded, size: 14, color: Color(0xFFC2410C)),
                  const SizedBox(width: 4),
                  Text(
                    _incentiveText(l10n, b),
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFFC2410C)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    Widget content;
    if (_loading) {
      content = const Center(child: CircularProgressIndicator());
    } else {
      content = RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline_rounded, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      l10n.slotsAssignedByManager,
                      style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            _sectionTitle(l10n.todaysSlots),
            if (_todayBookings.isEmpty)
              _emptyCard(l10n.noSlotAssignedToday)
            else ...[
              for (final b in _todayBookings) ...[
                _slotCard(l10n, b, today: true),
                const SizedBox(height: 8),
              ],
              if (_todayBookings.any((b) => !b.isCompleted)) ...[
                const SizedBox(height: 4),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    onPressed: _goOnlineWithLocation,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text(
                      l10n.verifyLocationAndGoOnline,
                      style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ],
            const SizedBox(height: 28),
            _sectionTitle(l10n.upcomingShiftsTitle),
            if (_upcomingBookings.isEmpty)
              _emptyCard(l10n.noUpcomingSlotsAssigned)
            else
              for (final b in _upcomingBookings) ...[
                _slotCard(l10n, b),
                const SizedBox(height: 8),
              ],
          ],
        ),
      );
    }

    if (widget.embedded) return content;

    return Scaffold(
      appBar: CustomAppBar(
        title: l10n.myShifts,
        subtitle: l10n.myShiftsSubtitle,
        showBackButton: true,
      ),
      body: content,
    );
  }

  Widget _emptyCard(String text) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        decoration: BoxDecoration(
          color: AppColors.cardBackground,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Column(
          children: [
            const Icon(Icons.event_busy_rounded, color: Colors.orange, size: 36),
            const SizedBox(height: 8),
            Text(
              text,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
}
