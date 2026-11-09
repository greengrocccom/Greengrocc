import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../data/services/order_service.dart';
import '../../../l10n/app_localizations.dart';

/// Time-limited offer without customer details.
class OrderDispatchDialog extends StatefulWidget {
  const OrderDispatchDialog({
    super.key,
    required this.offer,
    required this.onAccept,
    required this.onDecline,
  });

  final OrderOffer offer;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  static Future<void> show(
    BuildContext context, {
    required OrderOffer offer,
    required VoidCallback onAccept,
    required VoidCallback onDecline,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: AppLocalizations.of(context).delOrderOffer,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      transitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (ctx, _, _) => OrderDispatchDialog(
        offer: offer,
        onAccept: onAccept,
        onDecline: onDecline,
      ),
      transitionBuilder: (ctx, anim, _, child) {
        final curved = CurvedAnimation(parent: anim, curve: Curves.easeOutCubic);
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.08),
            end: Offset.zero,
          ).animate(curved),
          child: FadeTransition(opacity: curved, child: child),
        );
      },
    );
  }

  @override
  State<OrderDispatchDialog> createState() => _OrderDispatchDialogState();
}

class _OrderDispatchDialogState extends State<OrderDispatchDialog> {
  late int _remainingSeconds;
  Timer? _timer;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.offer.remainingSeconds > 0
        ? widget.offer.remainingSeconds
        : (widget.offer.timeoutSeconds > 0 ? widget.offer.timeoutSeconds : 20);
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      if (_remainingSeconds <= 1) {
        t.cancel();
        // Client timer only closes UI — do NOT call decline.
        // Backend timeout rotates to next driver
        Navigator.of(context, rootNavigator: true).pop();
      } else {
        setState(() => _remainingSeconds--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _handleAccept() async {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);
    _timer?.cancel();
    Navigator.of(context, rootNavigator: true).pop();
    widget.onAccept();
  }

  void _handleDecline() {
    if (_isProcessing) return;
    _timer?.cancel();
    Navigator.of(context, rootNavigator: true).pop();
    widget.onDecline();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 400),
          margin: const EdgeInsets.symmetric(horizontal: 24),
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.18),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(Icons.inventory_2_outlined, size: 26, color: Color(0xFF047857)),
              ),
              const SizedBox(height: 14),
              Text(l10n.delNewDeliveryOffer, textAlign: TextAlign.center, style: GoogleFonts.inter(
                fontSize: 23, fontWeight: FontWeight.w800, color: colors.onSurface,
              )),
              if (widget.offer.orderNumber.isNotEmpty) ...[
                const SizedBox(height: 5),
                Text(l10n.orderNumberHash(widget.offer.orderNumber), style: GoogleFonts.inter(
                  fontSize: 13, fontWeight: FontWeight.w500, color: colors.onSurfaceVariant,
                )),
              ],
              const SizedBox(height: 16),

              // 2. BELOW IT: Timer pill (e.g. 20s countdown)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: const Color(0xFF059669),
                    width: 1.5,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.access_time_rounded,
                      size: 16,
                      color: Color(0xFF059669),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      l10n.delSecondsToRespond(_remainingSeconds.toString()),
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF059669),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // 3. BELOW IT: Accept & Decline buttons side-by-side
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isProcessing ? null : _handleDecline,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(
                          color: Color(0xFF059669),
                          width: 1.5,
                        ),
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF059669),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        l10n.declineShort,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF059669),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isProcessing ? null : _handleAccept,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _isProcessing
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              l10n.acceptShort,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
