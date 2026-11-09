import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../l10n/app_localizations.dart';

const _forest = Color(0xFF126B43);
const _ink = Color(0xFF111827);
const _muted = Color(0xFF6B7280);
const _line = Color(0xFFE5E7EB);
const _danger = Color(0xFFDC2626);

Future<T?> _showSheet<T>(BuildContext context, WidgetBuilder builder, {bool dismissible = true}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: dismissible,
    enableDrag: dismissible,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: builder,
  );
}

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.children,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 10, 20, 16 + insets),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: const Color(0xFFD1D5DB), borderRadius: BorderRadius.circular(99)),
                ),
              ),
              const SizedBox(height: 18),
              Center(
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(color: iconColor.withValues(alpha: 0.12), shape: BoxShape.circle),
                  child: Icon(icon, color: iconColor, size: 28),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                title,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 19, fontWeight: FontWeight.w800, color: _ink),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 13, height: 1.4, color: _muted),
              ),
              const SizedBox(height: 20),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}

class _SheetButton extends StatelessWidget {
  const _SheetButton({
    required this.label,
    required this.onPressed,
    this.color = _forest,
    this.loading = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color color;
  final bool loading;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          disabledBackgroundColor: color.withValues(alpha: 0.45),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: loading
            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
                  Text(label, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800)),
                ],
              ),
      ),
    );
  }
}

class _GhostButton extends StatelessWidget {
  const _GhostButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(minimumSize: const Size.fromHeight(46), foregroundColor: _muted),
      child: Text(label, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700)),
    );
  }
}

class _ChoiceChips extends StatelessWidget {
  const _ChoiceChips({
    required this.options,
    required this.selected,
    required this.onSelected,
    required this.labelOf,
    this.color = _forest,
  });

  /// Stable English values (sent to the backend); [labelOf] gives the on-screen text.
  final List<String> options;
  final String? selected;
  final ValueChanged<String> onSelected;
  final String Function(String option) labelOf;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final option in options)
          ChoiceChip(
            label: Text(labelOf(option)),
            selected: selected == option,
            onSelected: (_) => onSelected(option),
            labelStyle: GoogleFonts.inter(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: selected == option ? Colors.white : _ink,
            ),
            selectedColor: color,
            backgroundColor: const Color(0xFFF3F4F6),
            side: BorderSide(color: selected == option ? color : _line),
            showCheckmark: false,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(99)),
          ),
      ],
    );
  }
}

InputDecoration _fieldDecoration(String hint) => InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF9CA3AF)),
      filled: true,
      fillColor: const Color(0xFFF9FAFB),
      contentPadding: const EdgeInsets.all(14),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _forest, width: 1.6)),
    );

// ─── Customer OTP ────────────────────────────────────────────────────────────

/// Returns true once the backend accepts the OTP. `onVerify` returns an error
/// message, or null on success; wrong codes keep the sheet open.
Future<bool> showCustomerOtpSheet(
  BuildContext context, {
  required String orderNumber,
  required Future<String?> Function(String otp) onVerify,
}) async {
  final ok = await _showSheet<bool>(context, (_) => _OtpSheet(orderNumber: orderNumber, onVerify: onVerify));
  return ok == true;
}

class _OtpSheet extends StatefulWidget {
  const _OtpSheet({required this.orderNumber, required this.onVerify});

  final String orderNumber;
  final Future<String?> Function(String otp) onVerify;

  @override
  State<_OtpSheet> createState() => _OtpSheetState();
}

class _OtpSheetState extends State<_OtpSheet> {
  static const _length = 4;
  final _controller = TextEditingController();
  final _focus = FocusNode();
  bool _verifying = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final otp = _controller.text.trim();
    if (otp.length != _length || _verifying) return;
    setState(() {
      _verifying = true;
      _error = null;
    });
    final error = await widget.onVerify(otp);
    if (!mounted) return;
    if (error == null) {
      HapticFeedback.mediumImpact();
      Navigator.pop(context, true);
      return;
    }
    HapticFeedback.heavyImpact();
    setState(() {
      _verifying = false;
      _error = error;
      _controller.clear();
    });
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final digits = _controller.text;
    final l10n = AppLocalizations.of(context);
    return _SheetFrame(
      icon: Icons.lock_person_rounded,
      iconColor: _forest,
      title: l10n.delEnterDeliveryOtp,
      subtitle: l10n.delAskCustomerOtpForOrder(widget.orderNumber),
      children: [
        GestureDetector(
          onTap: () => _focus.requestFocus(),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Opacity(
                opacity: 0,
                child: TextField(
                  controller: _controller,
                  focusNode: _focus,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  maxLength: _length,
                  enabled: !_verifying,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(counterText: '', border: InputBorder.none),
                  onChanged: (value) {
                    setState(() => _error = null);
                    if (value.length == _length) _submit();
                  },
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      margin: const EdgeInsets.symmetric(horizontal: 7),
                      width: 58,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _error != null ? const Color(0xFFFEF2F2) : const Color(0xFFF9FAFB),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          width: i == digits.length && !_verifying ? 2 : 1.4,
                          color: _error != null
                              ? _danger
                              : i < digits.length || i == digits.length
                                  ? _forest
                                  : _line,
                        ),
                      ),
                      child: Text(
                        i < digits.length ? digits[i] : '',
                        style: GoogleFonts.inter(fontSize: 26, fontWeight: FontWeight.w800, color: _ink),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: _error == null
              ? const SizedBox(height: 18)
              : Row(
                  key: ValueKey(_error),
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline_rounded, size: 16, color: _danger),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w600, color: _danger),
                      ),
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 16),
        _SheetButton(
          label: l10n.delVerifyOtp,
          icon: Icons.verified_rounded,
          loading: _verifying,
          onPressed: digits.length == _length ? _submit : null,
        ),
        _GhostButton(label: l10n.cancel, onPressed: _verifying ? null : () => Navigator.pop(context, false)),
      ],
    );
  }
}

// ─── Payment ─────────────────────────────────────────────────────────────────

/// 'online' | 'cash' | null (cancelled).
Future<String?> showPaymentMethodSheet(
  BuildContext context, {
  required int amount,
  required int itemsTotal,
  required int deliveryFee,
}) {
  return _showSheet<String>(
    context,
    (ctx) {
      final l10n = AppLocalizations.of(ctx);
      return _SheetFrame(
        icon: Icons.account_balance_wallet_rounded,
        iconColor: const Color(0xFFB45309),
        title: l10n.delCollectAmount(amount.toString()),
        subtitle: l10n.delPaymentBreakdownQuestion(itemsTotal.toString(), deliveryFee.toString()),
        children: [
          _PaymentOption(
            icon: Icons.qr_code_2_rounded,
            color: _forest,
            title: l10n.delOnlinePayment,
            subtitle: l10n.delOnlinePaymentSubtitle,
            onTap: () => Navigator.pop(ctx, 'online'),
          ),
          const SizedBox(height: 10),
          _PaymentOption(
            icon: Icons.payments_rounded,
            color: const Color(0xFFB45309),
            title: l10n.delCashOnDelivery,
            subtitle: l10n.delCashOnDeliverySubtitle,
            onTap: () => Navigator.pop(ctx, 'cash'),
          ),
          const SizedBox(height: 6),
          _GhostButton(label: l10n.cancel, onPressed: () => Navigator.pop(ctx)),
        ],
      );
    },
  );
}

class _PaymentOption extends StatelessWidget {
  const _PaymentOption({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _line),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, color: _ink)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: GoogleFonts.inter(fontSize: 12, color: _muted)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: _muted),
            ],
          ),
        ),
      ),
    );
  }
}

Future<bool> showCashCollectedSheet(
  BuildContext context, {
  required int amount,
  required int itemsTotal,
  required int deliveryFee,
}) async {
  final ok = await _showSheet<bool>(
    context,
    dismissible: false,
    (ctx) {
      final l10n = AppLocalizations.of(ctx);
      return _SheetFrame(
        icon: Icons.payments_rounded,
        iconColor: const Color(0xFFB45309),
        title: l10n.delCashCollected,
        subtitle: l10n.delCashCollectedSubtitle,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFFED7AA)),
            ),
            child: Column(
              children: [
                _AmountRow(label: l10n.delItemTotal, value: '₹$itemsTotal'),
                const SizedBox(height: 6),
                _AmountRow(label: l10n.delDeliveryFee, value: '₹$deliveryFee'),
                const Divider(height: 22, color: Color(0xFFFED7AA)),
                _AmountRow(label: l10n.delTotalToSubmit, value: '₹$amount', bold: true),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _SheetButton(
            label: l10n.continueButton,
            icon: Icons.arrow_forward_rounded,
            onPressed: () => Navigator.pop(ctx, true),
          ),
        ],
      );
    },
  );
  return ok == true;
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({required this.label, required this.value, this.bold = false});

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final style = GoogleFonts.inter(
      fontSize: bold ? 16 : 13.5,
      fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
      color: bold ? const Color(0xFF9A3412) : _ink,
    );
    return Row(
      children: [
        Expanded(child: Text(label, style: style)),
        Text(value, style: style),
      ],
    );
  }
}

// ─── Completion note ─────────────────────────────────────────────────────────

/// Returns the (possibly empty) delivery note, or null when the rider backs out.
Future<String?> showDeliveryNoteSheet(BuildContext context) {
  return _showSheet<String>(context, (_) => const _NoteSheet());
}

class _NoteSheet extends StatefulWidget {
  const _NoteSheet();

  @override
  State<_NoteSheet> createState() => _NoteSheetState();
}

class _NoteSheetState extends State<_NoteSheet> {
  static const _quick = ['Handed to customer', 'Left at the door', 'Handed to family member', 'Handed to security'];
  final _controller = TextEditingController();
  String? _selected;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _note {
    final typed = _controller.text.trim();
    return [?_selected, if (typed.isNotEmpty) typed].join(' · ');
  }

  static String _quickLabel(AppLocalizations l10n, String option) => switch (option) {
        'Handed to customer' => l10n.delNoteHandedToCustomer,
        'Left at the door' => l10n.delNoteLeftAtDoor,
        'Handed to family member' => l10n.delNoteHandedToFamily,
        'Handed to security' => l10n.delNoteHandedToSecurity,
        _ => option,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _SheetFrame(
      icon: Icons.task_alt_rounded,
      iconColor: _forest,
      title: l10n.delCompleteDelivery,
      subtitle: l10n.delAddNoteOptional,
      children: [
        _ChoiceChips(
          options: _quick,
          selected: _selected,
          labelOf: (option) => _quickLabel(l10n, option),
          onSelected: (value) => setState(() => _selected = _selected == value ? null : value),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _controller,
          maxLines: 2,
          maxLength: 300,
          style: GoogleFonts.inter(fontSize: 14),
          decoration: _fieldDecoration(l10n.delAnythingElseOptional),
        ),
        const SizedBox(height: 8),
        _SheetButton(
          label: l10n.delMarkAsDelivered,
          icon: Icons.check_circle_rounded,
          onPressed: () => Navigator.pop(context, _note),
        ),
        _GhostButton(label: l10n.delNotYet, onPressed: () => Navigator.pop(context)),
      ],
    );
  }
}

// ─── Delivery delay ──────────────────────────────────────────────────────────

const _amber = Color(0xFFD97706);

/// Returns the delay the rider picked, or null when cancelled.
Future<({int hours, int minutes, String reason})?> showDeliveryDelaySheet(BuildContext context) {
  return _showSheet<({int hours, int minutes, String reason})>(context, (_) => const _DelaySheet());
}

class _DelaySheet extends StatefulWidget {
  const _DelaySheet();

  @override
  State<_DelaySheet> createState() => _DelaySheetState();
}

class _DelaySheetState extends State<_DelaySheet> {
  static const _reasons = ['Heavy traffic', 'Vehicle issue', 'Bad weather', 'Other deliveries first', 'Other'];
  static const _presets = [15, 30, 45, 60, 90, 120];
  final _controller = TextEditingController();
  String? _selected;
  int _hours = 0;
  int _minutes = 30;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  int get _total => _hours * 60 + _minutes;

  String get _reason {
    final typed = _controller.text.trim();
    if (_selected == null || _selected == 'Other') return typed;
    return typed.isEmpty ? _selected! : '$_selected · $typed';
  }

  void _setTotal(int total) => setState(() {
        _hours = total ~/ 60;
        _minutes = total % 60;
      });

  String _label(AppLocalizations l10n, int total) {
    final h = total ~/ 60;
    final m = total % 60;
    if (h == 0) return l10n.delMinutesShort(m.toString());
    return m == 0
        ? l10n.delHoursShort(h.toString())
        : l10n.delHoursMinutesShort(h.toString(), m.toString());
  }

  static String _reasonLabel(AppLocalizations l10n, String option) => switch (option) {
        'Heavy traffic' => l10n.delReasonHeavyTraffic,
        'Vehicle issue' => l10n.delReasonVehicleIssue,
        'Bad weather' => l10n.delReasonBadWeather,
        'Other deliveries first' => l10n.delReasonOtherDeliveriesFirst,
        'Other' => l10n.delReasonOther,
        _ => option,
      };

  @override
  Widget build(BuildContext context) {
    final valid = _total >= 1 && _total <= 12 * 60;
    final l10n = AppLocalizations.of(context);
    return _SheetFrame(
      icon: Icons.schedule_rounded,
      iconColor: _amber,
      title: l10n.delRunningLateTitle,
      subtitle: l10n.delRunningLateSubtitle,
      children: [
        Row(
          children: [
            Expanded(
              child: _Stepper(
                label: l10n.delHours,
                value: _hours,
                onChanged: (v) => setState(() => _hours = v.clamp(0, 12)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _Stepper(
                label: l10n.delMinutes,
                value: _minutes,
                step: 5,
                onChanged: (v) => setState(() => _minutes = v.clamp(0, 55)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in _presets)
              ActionChip(
                label: Text(_label(l10n, p)),
                onPressed: () => _setTotal(p),
                labelStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: _ink),
                backgroundColor: _total == p ? _amber.withValues(alpha: 0.18) : const Color(0xFFF3F4F6),
                side: BorderSide(color: _total == p ? _amber : _line),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(99)),
              ),
          ],
        ),
        const SizedBox(height: 16),
        _ChoiceChips(
          options: _reasons,
          selected: _selected,
          color: _amber,
          labelOf: (option) => _reasonLabel(l10n, option),
          onSelected: (value) => setState(() => _selected = value),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _controller,
          maxLines: 2,
          maxLength: 200,
          onChanged: (_) => setState(() {}),
          style: GoogleFonts.inter(fontSize: 14),
          decoration: _fieldDecoration(l10n.delAddDetailsOptional),
        ),
        const SizedBox(height: 8),
        _SheetButton(
          label: valid ? l10n.delSendDelayWithDuration(_label(l10n, _total)) : l10n.delPickADelay,
          color: _amber,
          icon: Icons.send_rounded,
          onPressed: valid
              ? () => Navigator.pop(context, (hours: _hours, minutes: _minutes, reason: _reason))
              : null,
        ),
        _GhostButton(label: l10n.cancel, onPressed: () => Navigator.pop(context)),
      ],
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.label, required this.value, required this.onChanged, this.step = 1});

  final String label;
  final int value;
  final int step;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _line),
      ),
      child: Column(
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: _muted)),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: value > 0 ? () => onChanged(value - step) : null,
                icon: const Icon(Icons.remove_circle_outline_rounded),
                color: _amber,
              ),
              Text('$value', style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: _ink)),
              IconButton(
                onPressed: () => onChanged(value + step),
                icon: const Icon(Icons.add_circle_outline_rounded),
                color: _amber,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Failed delivery ─────────────────────────────────────────────────────────

/// Returns the failure reason, or null when cancelled.
Future<String?> showDeliveryFailedSheet(BuildContext context, {bool emergency = false, bool pickupStarted = false}) {
  return _showSheet<String>(context, (_) => _FailedSheet(emergency: emergency, pickupStarted: pickupStarted));
}

class _FailedSheet extends StatefulWidget {
  const _FailedSheet({required this.emergency, required this.pickupStarted});

  final bool emergency;
  final bool pickupStarted;

  @override
  State<_FailedSheet> createState() => _FailedSheetState();
}

class _FailedSheetState extends State<_FailedSheet> {
  static const _reasons = [
    'Customer not reachable',
    'Customer not available',
    'Wrong / incomplete address',
    'Customer refused order',
    'Other',
  ];
  static const _emergencyReasons = ['Flat tyre', 'Vehicle breakdown', 'Health emergency', 'Other'];
  final _controller = TextEditingController();
  String? _selected;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _reason {
    final typed = _controller.text.trim();
    if (_selected == null || _selected == 'Other') return typed;
    return typed.isEmpty ? _selected! : '$_selected · $typed';
  }

  static String _reasonLabel(AppLocalizations l10n, String option) => switch (option) {
        'Customer not reachable' => l10n.delReasonCustomerNotReachable,
        'Customer not available' => l10n.delReasonCustomerNotAvailable,
        'Wrong / incomplete address' => l10n.delReasonWrongAddress,
        'Customer refused order' => l10n.delReasonCustomerRefused,
        'Flat tyre' => l10n.delReasonFlatTyre,
        'Vehicle breakdown' => l10n.delReasonVehicleBreakdown,
        'Health emergency' => l10n.delReasonHealthEmergency,
        'Other' => l10n.delReasonOther,
        _ => option,
      };

  @override
  Widget build(BuildContext context) {
    final canSubmit = _reason.isNotEmpty;
    final l10n = AppLocalizations.of(context);
    return _SheetFrame(
      icon: Icons.report_problem_rounded,
      iconColor: _danger,
      title: widget.emergency ? l10n.delReportAnEmergency : l10n.delDeliveryFailedQuestion,
      subtitle: widget.emergency
          ? widget.pickupStarted
              ? l10n.delEmergencyWithParcelHint
              : l10n.delEmergencyNoParcelHint
          : l10n.delFailedDeliveryHint,
      children: [
        _ChoiceChips(
          options: widget.emergency ? _emergencyReasons : _reasons,
          selected: _selected,
          color: _danger,
          labelOf: (option) => _reasonLabel(l10n, option),
          onSelected: (value) => setState(() => _selected = value),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _controller,
          maxLines: 3,
          maxLength: 800,
          onChanged: (_) => setState(() {}),
          style: GoogleFonts.inter(fontSize: 14),
          decoration: _fieldDecoration(
            _selected == 'Other' || _selected == null ? l10n.delDescribeReason : l10n.delAddDetailsOptional,
          ),
        ),
        const SizedBox(height: 8),
        _SheetButton(
          label: widget.emergency ? l10n.delSendToManager : l10n.delSubmitFailedDelivery,
          color: _danger,
          onPressed: canSubmit ? () => Navigator.pop(context, _reason) : null,
        ),
        _GhostButton(label: l10n.cancel, onPressed: () => Navigator.pop(context)),
      ],
    );
  }
}
