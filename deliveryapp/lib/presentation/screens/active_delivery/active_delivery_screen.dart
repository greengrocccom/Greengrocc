import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/l10n/app_l10n.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/services/secure_screen.dart';
import '../../../core/utils/image_upload_utils.dart';
import '../../../data/services/order_service.dart';
import '../../../data/services/socket_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../../utils/map_navigation.dart';
import '../../shell/shell_navigation.dart';
import '../../widgets/buttons/primary_button.dart';
import '../../widgets/dialogs/status_dialog.dart';
import 'delivery_sheets.dart';
import 'pickup_qr_scan_screen.dart';
import 'order_items_screen.dart';

class ActiveDeliveryScreen extends StatefulWidget {
  const ActiveDeliveryScreen({super.key, this.initialOrderId});

  /// Opens on this order when the rider has several stops (e.g. picked from the pre-order list).
  final String? initialOrderId;

  @override
  State<ActiveDeliveryScreen> createState() => _ActiveDeliveryScreenState();
}

class _ActiveDeliveryScreenState extends State<ActiveDeliveryScreen> with WidgetsBindingObserver {
  ActiveDeliveryData? _delivery;
  List<ActiveDeliveryData> _deliveries = const [];
  bool _isLoading = true;
  bool _customerNavStarted = false;
  Timer? _tickTimer;
  Timer? _refreshDebounce;
  StreamSubscription<Map<String, dynamic>>? _deliverySub;
  StreamSubscription<bool>? _connectionSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadDelivery();
    // Refresh only when the server reports a change, on reconnect, or on resume — no polling.
    _deliverySub = SocketService.instance.onActiveDeliveryUpdated.listen((_) => _scheduleRefresh());
    _connectionSub = SocketService.instance.onConnectionChanged.listen((connected) {
      if (connected) _scheduleRefresh();
    });
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final d = _delivery;
      if (d != null && !d.pickupQrUnlocked && !d.pickupQrScanned) {
        setState(() {});
        if (d.routeBatchWindowEndsAt != null &&
            !d.routeBatchWindowEndsAt!.isAfter(DateTime.now())) {
          _loadDelivery();
        }
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tickTimer?.cancel();
    _refreshDebounce?.cancel();
    _deliverySub?.cancel();
    _connectionSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _scheduleRefresh();
  }

  void _scheduleRefresh() {
    _refreshDebounce?.cancel();
    _refreshDebounce = Timer(const Duration(milliseconds: 400), () {
      if (mounted) _loadDelivery();
    });
  }

  Future<void> _loadDelivery() async {
    final data = await OrderService.instance.fetchActiveDelivery();
    if (mounted) {
      final list = OrderService.instance.activeDeliveries;
      ActiveDeliveryData? selected = data;
      final wantedId = _delivery?.id ?? widget.initialOrderId;
      if (wantedId != null && list.isNotEmpty) {
        selected = list.cast<ActiveDeliveryData?>().firstWhere(
              (d) => d?.id == wantedId,
              orElse: () => list.first,
            );
      }
      setState(() {
        _deliveries = list;
        _delivery = selected ?? data;
        _isLoading = false;
      });
    }
  }

  Future<void> _openPickupQrScanner() async {
    if (_delivery == null) return;
    final verified = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => PickupQrScanScreen(
          orderId: _delivery!.id,
          orderNumber: _delivery!.orderNumber,
        ),
      ),
    );
    if (verified == true && mounted) {
      final isPreOrder = _delivery!.isPreOrder;
      final l10n = AppLocalizations.of(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isPreOrder
                ? l10n.delQrScannedAddressUnlocked
                : l10n.delQrScannedCaptureItemPhoto,
          ),
          backgroundColor: const Color(0xFF059669),
        ),
      );
      await _loadDelivery();
    }
  }

  Future<void> _openItemProofCapture() async {
    if (_delivery == null) return;
    final photo = await _pickCameraPhoto();
    if (photo == null || !mounted) return;

    final l10n = AppLocalizations.of(context);
    final sent = await _showPhotoSendSheet(
      photo: photo,
      title: l10n.delItemProof,
      subtitle: l10n.delItemProofSendSubtitle,
      sendLabel: l10n.delSendToManager,
      onSend: (dataUrl) => OrderService.instance.submitPickupProof(_delivery!.id, dataUrl),
    );
    if (sent == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).delItemPhotoSentWaiting),
          backgroundColor: const Color(0xFF059669),
        ),
      );
      await _loadDelivery();
    }
  }

  Future<void> _startCompleteFlow() async {
    if (_delivery == null) return;

    final hasProof = (_delivery!.deliveryProofImageUrl).trim().isNotEmpty;
    if (!hasProof) {
      final uploaded = await _captureAndUploadDeliveryProof();
      if (uploaded != true || !mounted) return;
      await _loadDelivery();
      if (!mounted) return;
    }

    if (!OrderService.instance.isOtpVerified(_delivery!)) {
      final otpOk = await _askCustomerOtp();
      if (!otpOk || !mounted) return;
      await _loadDelivery();
      if (!mounted || _delivery == null) return;
    }

    if (_delivery!.isPaidOnline ||
        _delivery!.isCashCollected ||
        _delivery!.amountToCollect <= 0) {
      await _askOptionalCommentThenFinish();
      return;
    }

    await _askPaymentMethodAndFinish();
  }

  Future<void> _onNavigateCustomerTap() async {
    if (_delivery == null) return;
    setState(() => _customerNavStarted = true);
    await _navigateToCustomer(_delivery!);
  }

  Future<void> _captureDeliveryProofThenOtp() async {
    final uploaded = await _captureAndUploadDeliveryProof();
    if (uploaded != true || !mounted) return;
    await _loadDelivery();
    if (!mounted) return;
    await _startCompleteFlow();
  }

  Future<XFile?> _pickCameraPhoto() async {
    try {
      return await ImagePicker().pickImage(
        source: ImageSource.camera,
        imageQuality: 75,
        maxWidth: 1600,
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context).delCameraOpenFailed)),
        );
      }
      return null;
    }
  }

  Future<bool?> _captureAndUploadDeliveryProof() async {
    if (_delivery == null) return false;
    final photo = await _pickCameraPhoto();
    if (photo == null || !mounted) return false;

    final l10n = AppLocalizations.of(context);
    return _showPhotoSendSheet(
      photo: photo,
      title: l10n.delDeliveryProof,
      subtitle: l10n.delDeliveryProofSendSubtitle,
      sendLabel: l10n.delSendPhoto,
      onSend: (dataUrl) async {
        final result = await OrderService.instance.uploadDeliveryProof(_delivery!.id, dataUrl);
        return result.success;
      },
    );
  }

  Future<bool?> _showPhotoSendSheet({
    required XFile photo,
    required String title,
    required String subtitle,
    required String sendLabel,
    required Future<bool> Function(String dataUrl) onSend,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        var submitting = false;
        XFile current = photo;
        return StatefulBuilder(
          builder: (context, setModal) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFFD1D5DB),
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      title,
                      style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      subtitle,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF6B7280)),
                    ),
                    const SizedBox(height: 14),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Image.file(
                        File(current.path),
                        height: 220,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: submitting
                                ? null
                                : () async {
                                    final next = await _pickCameraPhoto();
                                    if (next != null) setModal(() => current = next);
                                  },
                            child: Text(AppLocalizations.of(context).delRetake),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 2,
                          child: FilledButton(
                            onPressed: submitting
                                ? null
                                : () async {
                                    setModal(() => submitting = true);
                                    final dataUrl = await imageFileToBase64DataUrl(current);
                                    final ok = await onSend(dataUrl);
                                    if (!context.mounted) return;
                                    if (ok) {
                                      Navigator.pop(context, true);
                                    } else {
                                      setModal(() => submitting = false);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text(AppLocalizations.of(context).delPhotoSendFailed),
                                          backgroundColor: Colors.red,
                                        ),
                                      );
                                    }
                                  },
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF126B43),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: submitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(sendLabel),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _askOptionalCommentThenFinish() async {
    final note = await showDeliveryNoteSheet(context);
    if (note == null || !mounted) return;
    await _finishDelivery(otpAlreadyVerified: true, deliveryComment: note);
  }

  Future<void> _markDeliveryFailed({bool emergency = false}) async {
    final order = _delivery;
    if (order == null) return;
    final reason = await showDeliveryFailedSheet(context, emergency: emergency, pickupStarted: order.pickupQrScanned);
    if (reason == null || reason.isEmpty || !mounted) return;

    final result = await OrderService.instance.failDelivery(
      order.id,
      failureReason: reason,
      emergency: emergency,
    );
    if (!mounted) return;
    final l10n = AppLocalizations.of(context);
    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(emergency ? l10n.delEmergencySent : l10n.delMarkedFailedNotified),
          backgroundColor: const Color(0xFFB45309),
        ),
      );
      final remaining = OrderService.instance.activeDeliveries;
      if (remaining.isEmpty) {
        Navigator.pop(context);
      } else {
        await _loadDelivery();
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.error ?? l10n.delCouldNotMarkFailed),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _reportDelay() async {
    final d = _delivery;
    if (d == null) return;
    final picked = await showDeliveryDelaySheet(context);
    if (picked == null || !mounted) return;

    final result = await OrderService.instance.reportDelay(
      d.id,
      hours: picked.hours,
      minutes: picked.minutes,
      reason: picked.reason,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result.success
              ? AppLocalizations.of(context).delDelaySent
              : (result.error ?? AppLocalizations.of(context).delCouldNotSendDelay),
        ),
        backgroundColor: result.success ? const Color(0xFFB45309) : Colors.red,
      ),
    );
    if (result.success) await _loadDelivery();
  }

  Future<bool> _askCustomerOtp() async {
    final d = _delivery!;
    final incorrectOtp = AppLocalizations.of(context).delIncorrectOtp;
    return showCustomerOtpSheet(
      context,
      orderNumber: d.orderNumber,
      onVerify: (otp) async {
        final result = await OrderService.instance.verifyCustomerOtp(d.id, otp);
        return result.success ? null : (result.error ?? incorrectOtp);
      },
    );
  }

  Future<void> _askPaymentMethodAndFinish() async {
    final d = _delivery!;
    final choice = await showPaymentMethodSheet(
      context,
      amount: d.amountToCollect,
      itemsTotal: d.itemsTotal,
      deliveryFee: d.deliveryFee,
    );

    if (choice == null || !mounted) return;

    if (choice == 'online') {
      if (await _showDeliveryPaymentQr(d.id) && mounted) {
        await _askOptionalCommentThenFinish();
      }
      return;
    }
    // Physical cash
    final cash = await OrderService.instance.confirmCashCollection(d.id);
    if (!cash.success) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(cash.error ?? AppLocalizations.of(context).delCashConfirmFailed),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    if (!mounted) return;
    final proceed = await showCashCollectedSheet(
      context,
      amount: d.amountToCollect,
      itemsTotal: d.itemsTotal,
      deliveryFee: d.deliveryFee,
    );

    if (proceed && mounted) {
      await _askOptionalCommentThenFinish();
    }
  }

  Future<bool> _showDeliveryPaymentQr(String orderId) async {
    final service = OrderService.instance;
    final result = await service.deliveryPaymentQr(orderId, 'create');
    if (!mounted) return false;
    if (result['paymentStatus'] == 'paid_online') return true;
    final l10n = AppLocalizations.of(context);

    if (result['closed'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(l10n.delPreviousQrExpired),
      ));
      return false;
    }
    if (result['amount'] is! num) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(result['message'] as String? ?? l10n.delUnableToOpenPaymentQr),
      ));
      return false;
    }

    final amount = (result['amount'] as num).toStringAsFixed(2);
    final qrContent = (result['qrContent'] as String?) ?? '';
    final notice = result['notice'] as String?;
    var busy = false;
    String? message;
    return await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          Future<void> updatePayment(String action) async {
            setDialogState(() {
              busy = true;
              message = null;
            });
            final updated = await service.deliveryPaymentQr(orderId, action);
            if (!dialogContext.mounted) return;
            if (updated['paymentStatus'] == 'paid_online') {
              Navigator.of(dialogContext).pop(true);
            } else if (updated['closed'] == true) {
              Navigator.of(dialogContext).pop(false);
            } else {
              setDialogState(() {
                busy = false;
                message = updated['message'] as String? ?? l10n.delPleaseTryAgain;
              });
            }
          }

          return AlertDialog(
            title: Text(l10n.delScanToPayUpi, textAlign: TextAlign.center),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '₹$amount',
                    style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 12),
                  if (qrContent.isNotEmpty)
                    Container(
                      color: Colors.white,
                      padding: const EdgeInsets.all(8),
                      child: QrImageView(
                        data: qrContent,
                        size: 240,
                        backgroundColor: Colors.white,
                        errorCorrectionLevel: QrErrorCorrectLevel.M,
                      ),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        border: Border.all(color: Colors.amber.shade300),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(notice ?? l10n.delPaymentQrUnavailable, textAlign: TextAlign.center),
                    ),
                  const SizedBox(height: 12),
                  if (busy) const LinearProgressIndicator(),
                  if (message != null) Text(message!),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => updatePayment('close'),
                child: Text(l10n.delCloseQr),
              ),
              FilledButton(
                onPressed: busy ? null : () => updatePayment('check'),
                child: Text(l10n.delCheckPayment),
              ),
            ],
          );
        },
      ),
    ) ?? false;
  }

  Future<void> _finishDelivery({
    required bool otpAlreadyVerified,
    String? deliveryComment,
  }) async {
    if (_delivery == null) return;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    final l10n = AppLocalizations.of(context);
    final orderNumber = _delivery!.orderNumber;
    final wasPreOrder = _delivery!.isPreOrder;

    final result = await OrderService.instance.completeDelivery(
      _delivery!.id,
      'VERIFIED',
      deliveryComment: deliveryComment,
    );

    if (result.success) {
      if (!mounted) return;
      final remaining = OrderService.instance.activeDeliveries;
      // Pre-orders are run from the pre-order list, which shows this one as delivered.
      final backToPreOrders = wasPreOrder && nav.canPop();
      await showStatusDialog(
        context,
        success: true,
        title: l10n.orderDeliveredTitle,
        message: l10n.orderDeliveredBody(orderNumber),
        buttonLabel: backToPreOrders
            ? l10n.delBackToPreOrders
            : remaining.isEmpty ? l10n.goToHome : l10n.nextDelivery,
      );
      if (!mounted) return;
      if (backToPreOrders) {
        nav.pop(true);
      } else if (remaining.isEmpty) {
        if (nav.canPop()) {
          nav.popUntil((route) => route.isFirst);
          ShellNavigation.instance.goToTab(0);
        } else {
          nav.pushReplacementNamed(AppRoutes.home);
        }
      } else {
        await _loadDelivery();
      }
    } else {
      messenger.showSnackBar(
        SnackBar(
          content: Text(result.error ?? l10n.delCouldNotCompleteDelivery),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _navigateToCustomer(ActiveDeliveryData d) async {
    final ok = await openMapsNavigation(
      destLat: d.customerLat,
      destLng: d.customerLng,
      fallbackAddress: d.customerAddress,
      preferAddress: true,
    );
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context).delCouldNotOpenMaps)),
      );
    }
  }

  Future<void> _callStore(String? phone) =>
      _callNumber(phone, AppLocalizations.of(context).delStorePhoneUnavailable);

  Future<void> _callNumber(String? phone, String unavailableMessage) async {
    if (phone == null || phone.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(unavailableMessage)),
      );
      return;
    }
    final uri = Uri.parse('tel:${phone.replaceAll(RegExp(r'[^\d+]'), '')}');
    if (!await launchUrl(uri)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context).delCouldNotOpenDialer)),
        );
      }
    }
  }

  int _totalItemCount(ActiveDeliveryData d) {
    return d.items.fold<int>(0, (sum, item) {
      final qty = item is Map ? (item['quantity'] as num?)?.toInt() ?? 0 : 0;
      return sum + qty;
    });
  }

  static const _kForest = Color(0xFF126B43);
  static const _kPageBg = Color(0xFFF3F6F4);

  String _fmtCountdown(DateTime? ends) {
    final left = ends?.difference(DateTime.now());
    if (left == null || left.isNegative) return '0:00';
    return '${left.inMinutes}:${(left.inSeconds % 60).toString().padLeft(2, '0')}';
  }

  String _fmtClock([DateTime? t]) {
    final local = (t ?? DateTime.now()).toLocal();
    return localizedDateFormat('h:mm a').format(local);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: _kPageBg,
        body: Center(child: CircularProgressIndicator(color: _kForest)),
      );
    }

    if (_delivery == null) {
      return Scaffold(
        backgroundColor: _kPageBg,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.local_shipping_outlined, size: 64, color: Colors.grey),
                const SizedBox(height: 16),
                Text(
                  l10n.delNoActiveDelivery,
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  l10n.delNoActiveDeliveryHint,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(color: Colors.grey),
                ),
                const SizedBox(height: 24),
                PrimaryButton(
                  label: l10n.delCheckForOrders,
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final d = _delivery!;
    final isUnlocked = d.customerAddressUnlocked;
    final qrScanned = d.pickupQrScanned;
    final proofPending = d.pickupProofStatus == 'pending';
    final needsProof = qrScanned && d.pickupProofStatus == 'none';
    final totalItems = _totalItemCount(d);
    final pickupQrReady = d.pickupQrUnlocked || qrScanned;
    final windowEnds = d.routeBatchWindowEndsAt;
    final searching = !pickupQrReady && !qrScanned;
    final countdown = _fmtCountdown(windowEnds);
    final itemsTotal = d.itemsTotal > 0
        ? d.itemsTotal
        : d.items.fold<int>(0, (s, raw) {
            final item = raw is Map ? raw : <String, dynamic>{};
            final qty = (item['quantity'] as num?)?.toInt() ?? 0;
            final price = (item['price'] as num?)?.toInt() ?? 0;
            return s + qty * price;
          });

    String headerStatus;
    if (isUnlocked) {
      headerStatus = l10n.delOutForDelivery;
    } else if (proofPending) {
      headerStatus = l10n.delAwaitingApproval;
    } else if (qrScanned) {
      headerStatus = l10n.delItemProof;
    } else if (searching) {
      headerStatus = l10n.delWaitingForPickup;
    } else {
      headerStatus = l10n.delWaitingForPickup;
    }

    return SecureScreen(
      child: Scaffold(
        backgroundColor: _kPageBg,
        body: Column(
          children: [
            _OrderDetailsHeader(
              orderNumber: d.orderNumber,
              statusLabel: headerStatus,
              onBack: () => Navigator.pop(context),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
                child: Column(
                  children: [
                    if (_deliveries.length > 1) ...[
                      _MultiStopBanner(
                        stops: _deliveries,
                        selectedId: d.id,
                        onSelect: (id) {
                          final next = _deliveries.firstWhere((e) => e.id == id);
                          setState(() => _delivery = next);
                        },
                      ),
                      const SizedBox(height: 12),
                    ],
                    _StoreInfoCard(
                      storeName: d.darkStoreName,
                      address: d.darkStoreAddress,
                      onCall: () => _callStore(d.darkStorePhone),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => _markDeliveryFailed(emergency: true),
                        icon: const Icon(Icons.report_problem_outlined, size: 19),
                        label: Text(l10n.delReportEmergency),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF9A3412),
                          backgroundColor: const Color(0xFFFFF7ED),
                          side: const BorderSide(color: Color(0xFFFED7AA)),
                          minimumSize: const Size.fromHeight(44),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (d.expectedDeliveryAt != null) ...[
                      _DeliveryEtaCard(expectedAt: d.expectedDeliveryAt!),
                      const SizedBox(height: 12),
                    ],
                    _OrderQrCard(
                      searching: searching,
                      countdown: countdown,
                      qrScanned: qrScanned,
                      proofPending: proofPending,
                      isUnlocked: isUnlocked,
                      onScanQr: () {
                        if (!pickupQrReady || searching) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(l10n.delPickupQrUnlocksIn(countdown)),
                            ),
                          );
                          return;
                        }
                        _openPickupQrScanner();
                      },
                    ),
                    const SizedBox(height: 12),
                    for (final item in (_deliveries.isNotEmpty ? _deliveries : [d])) ...[
                      _CustomerAddressCard(
                        orderNumber: item.orderNumber,
                        customerName: item.customerName,
                        address: item.customerAddressUnlocked
                            ? item.customerAddress
                            : l10n.delAddressUnlocksAfterPickup,
                        phone: item.customerAddressUnlocked ? item.customerPhone : '',
                        isUnlocked: item.customerAddressUnlocked,
                        onViewMap: () => _navigateToCustomer(item),
                        onCall: () => _callNumber(item.customerPhone, l10n.delCustomerPhoneUnavailable),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (d.canReportDelay) ...[
                      _DelayCard(delivery: d, onReport: _reportDelay),
                      const SizedBox(height: 12),
                    ],
                  _OrderItemsSummaryCard(
                    totalItems: totalItems,
                    itemsTotal: itemsTotal,
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => OrderItemsScreen(
                            orderNumber: d.orderNumber,
                            items: d.items,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  _OrderTimelineCard(
                    assignedTime: _fmtClock(),
                    waitingTime: searching || !qrScanned ? _fmtClock() : _fmtClock(),
                    pickedUp: qrScanned || isUnlocked,
                    delivered: false,
                  ),
                ],
              ),
            ),
          ),
          if (!isUnlocked && !proofPending && !(needsProof || qrScanned))
            // Scan QR lives on the Pickup QR row — no duplicate bottom button.
            const SizedBox.shrink()
          else
            _BottomActions(
              isUnlocked: isUnlocked,
              proofPending: proofPending,
              customerNavStarted: _customerNavStarted,
              otpVerified: OrderService.instance.isOtpVerified(d),
              onItemProof: _openItemProofCapture,
              onNavigateCustomer: _onNavigateCustomerTap,
              onCaptureProof: _captureDeliveryProofThenOtp,
              onComplete: _startCompleteFlow,
              onFailed: isUnlocked ? _markDeliveryFailed : null,
              hasDeliveryProof: d.deliveryProofImageUrl.trim().isNotEmpty,
            ),
        ],
      ),
    ));
  }
}

class _DeliveryEtaCard extends StatelessWidget {
  const _DeliveryEtaCard({required this.expectedAt});

  final DateTime expectedAt;

  @override
  Widget build(BuildContext context) {
    final time = TimeOfDay.fromDateTime(expectedAt.toLocal()).format(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF8F1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFC8E8D0)),
      ),
      child: Row(
        children: [
          const Icon(Icons.schedule, color: Color(0xFF087A45)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              AppLocalizations.of(context).delDeliverOrderBy(time),
              style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF14532D)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Design-matched UI ───────────────────────────────────────────────────────

class _OrderDetailsHeader extends StatelessWidget {
  const _OrderDetailsHeader({
    required this.orderNumber,
    required this.statusLabel,
    required this.onBack,
  });

  final String orderNumber;
  final String statusLabel;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(8, top + 6, 16, 20),
      decoration: const BoxDecoration(
        color: Color(0xFF126B43),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(22)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconButton(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 10),
                Text(
                  AppLocalizations.of(context).delOrderDetails,
                  style: GoogleFonts.inter(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '#$orderNumber',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.schedule_rounded, size: 14, color: Color(0xFF126B43)),
                const SizedBox(width: 5),
                Text(
                  statusLabel,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF126B43),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StoreInfoCard extends StatelessWidget {
  const _StoreInfoCard({
    required this.storeName,
    required this.address,
    required this.onCall,
  });

  final String storeName;
  final String address;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    return _WhiteCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    AppLocalizations.of(context).delPickupDarkStore,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                      color: const Color(0xFF126B43),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  storeName,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  address,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    height: 1.35,
                    color: const Color(0xFF6B7280),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 1,
            height: 52,
            margin: const EdgeInsets.only(left: 6, right: 12),
            color: const Color(0xFFE5E7EB),
          ),
          InkWell(
            onTap: onCall,
            borderRadius: BorderRadius.circular(12),
            child: Column(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFBBF7D0)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                  child: const Icon(Icons.phone_rounded, color: Color(0xFF126B43), size: 19),
                ),
                const SizedBox(height: 4),
                Text(
                  AppLocalizations.of(context).delCallStore,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF126B43),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderQrCard extends StatelessWidget {
  const _OrderQrCard({
    required this.searching,
    required this.countdown,
    required this.qrScanned,
    required this.proofPending,
    required this.isUnlocked,
    required this.onScanQr,
  });

  final bool searching;
  final String countdown;
  final bool qrScanned;
  final bool proofPending;
  final bool isUnlocked;
  final VoidCallback onScanQr;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final pickupStatus = isUnlocked
        ? l10n.delPickupVerifiedAddressUnlocked
        : proofPending
            ? l10n.delItemPhotoSentWaitingManager
            : qrScanned
                ? l10n.delQrScannedTakeItemProof
                : l10n.delScanQrAtStoreToStart;

    return _WhiteCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              qrScanned || isUnlocked
                  ? Icons.check_circle_outline_rounded
                  : Icons.inventory_2_outlined,
              color: const Color(0xFF126B43),
              size: 20,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    Text(
                      l10n.delPickupQr,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF111827),
                      ),
                    ),
                    if (searching)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF5F3FF),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.search_rounded, size: 12, color: Color(0xFF7C3AED)),
                            const SizedBox(width: 3),
                            Text(
                              l10n.delSameRouteSearch(countdown),
                              style: GoogleFonts.inter(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF7C3AED),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  pickupStatus,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: const Color(0xFF6B7280),
                  ),
                ),
              ],
            ),
          ),
          if (!qrScanned && !isUnlocked) ...[
            const SizedBox(width: 8),
            _ScanQrPillButton(onTap: onScanQr),
          ],
        ],
      ),
    );
  }
}

/// Compact forest-green Scan QR control matching the Order Details mockup.
class _ScanQrPillButton extends StatelessWidget {
  const _ScanQrPillButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF126B43),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.qr_code_2_rounded, color: Colors.white, size: 18),
              const SizedBox(width: 6),
              Text(
                AppLocalizations.of(context).scanQr,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _PrimaryActionBtn extends StatelessWidget {
  const _PrimaryActionBtn({
    required this.label,
    required this.icon,
    required this.enabled,
    required this.onTap,
    this.showChevron = false,
  });

  final String label;
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: enabled ? onTap : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF126B43),
          disabledBackgroundColor: const Color(0xFF9CA3AF),
          foregroundColor: Colors.white,
          disabledForegroundColor: Colors.white70,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20),
            const SizedBox(width: 8),
            Text(
              label,
              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800),
            ),
            if (showChevron) ...[
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right_rounded, size: 22),
            ],
          ],
        ),
      ),
    );
  }
}

class _CustomerAddressCard extends StatelessWidget {
  const _CustomerAddressCard({
    required this.orderNumber,
    required this.customerName,
    required this.address,
    required this.phone,
    required this.isUnlocked,
    required this.onViewMap,
    required this.onCall,
  });

  final String orderNumber;
  final String customerName;
  final String address;
  final String phone;
  final bool isUnlocked;
  final VoidCallback onViewMap;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (!isUnlocked) {
      return _WhiteCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: Color(0xFFDBEAFE),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.location_on_rounded, color: Color(0xFF2563EB), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    orderNumber.isNotEmpty
                        ? l10n.delOrderCustomerAddress(orderNumber)
                        : l10n.delCustomerAddress,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    address,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      height: 1.4,
                      color: const Color(0xFF6B7280),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton.icon(
              onPressed: null,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF126B43),
                side: const BorderSide(color: Color(0xFFE5E7EB)),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              icon: const Icon(Icons.map_outlined, size: 16),
              label: Text(
                l10n.delViewOnMap,
                style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
    }

    return _WhiteCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '#$orderNumber  •  ${customerName.isNotEmpty ? customerName : l10n.customer}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 14.5,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            address,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 12,
              height: 1.35,
              color: const Color(0xFF4B5563),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              OutlinedButton(
                onPressed: onViewMap,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF126B43),
                  side: const BorderSide(color: Color(0xFF86EFAC)),
                  backgroundColor: const Color(0xFFF0FDF4),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                child: Text(
                  l10n.delViewOnMap,
                  style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w700),
                ),
              ),
              if (phone.isNotEmpty) ...[
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: onCall,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF126B43),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  icon: const Icon(Icons.call_rounded, size: 14),
                  label: Text(
                    l10n.callAction,
                    style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}


class _DelayCard extends StatelessWidget {
  const _DelayCard({required this.delivery, required this.onReport});

  final ActiveDeliveryData delivery;
  final VoidCallback onReport;

  static String _late(AppLocalizations l10n, int total) {
    final h = total ~/ 60;
    final m = total % 60;
    if (h == 0) return l10n.delMinutesShort(m.toString());
    return m == 0
        ? l10n.delHoursShort(h.toString())
        : l10n.delHoursMinutesShort(h.toString(), m.toString());
  }

  @override
  Widget build(BuildContext context) {
    const amber = Color(0xFFB45309);
    final l10n = AppLocalizations.of(context);
    final reported = delivery.delayMinutes > 0;
    final status = !reported
        ? l10n.delDelayPrompt
        : delivery.delayCustomerNotifiedAt != null
            ? l10n.delReportedLateCustomerUpdated(_late(l10n, delivery.delayMinutes))
            : l10n.delReportedLateWaitingManager(_late(l10n, delivery.delayMinutes));
    return _WhiteCard(
      child: Row(
        children: [
          const Icon(Icons.schedule_rounded, color: amber, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              status,
              style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w600, color: const Color(0xFF374151)),
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: onReport,
            style: OutlinedButton.styleFrom(
              foregroundColor: amber,
              side: const BorderSide(color: amber),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            ),
            child: Text(
              reported ? l10n.delUpdate : l10n.delReportDelay,
              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderItemsSummaryCard extends StatelessWidget {
  const _OrderItemsSummaryCard({
    required this.totalItems,
    required this.itemsTotal,
    required this.onTap,
  });

  final int totalItems;
  final int itemsTotal;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: _WhiteCard(
          child: Column(
            children: [
              Row(
                children: [
                  const Icon(Icons.format_list_bulleted_rounded, size: 18, color: Color(0xFF126B43)),
                  const SizedBox(width: 8),
                  Text(
                    l10n.delOrderItems,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF111827),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    l10n.itemsCount(totalItems),
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF126B43),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 52,
                      height: 52,
                      color: const Color(0xFFF3F4F6),
                      child: const Icon(Icons.shopping_bag_rounded, color: Color(0xFF6B7280), size: 26),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.delGroceryPack,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF111827),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          l10n.delItemsAndTotal(totalItems.toString(), itemsTotal.toString()),
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: const Color(0xFF6B7280),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: Color(0xFF9CA3AF)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderTimelineCard extends StatelessWidget {
  const _OrderTimelineCard({
    required this.assignedTime,
    required this.waitingTime,
    required this.pickedUp,
    required this.delivered,
  });

  final String assignedTime;
  final String waitingTime;
  final bool pickedUp;
  final bool delivered;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _WhiteCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.schedule_rounded, size: 18, color: Color(0xFF126B43)),
              const SizedBox(width: 8),
              Text(
                l10n.delOrderTimeline,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _TimelineStep(
            title: l10n.delOrderAssigned,
            subtitle: l10n.delOrderAssignedSubtitle,
            trailing: assignedTime,
            done: true,
            active: false,
            isLast: false,
          ),
          _TimelineStep(
            title: l10n.delWaitingForPickup,
            subtitle: l10n.delGoToStoreScanPickupQr,
            trailing: waitingTime,
            done: pickedUp,
            active: !pickedUp,
            isLast: false,
          ),
          _TimelineStep(
            title: l10n.pickedUp,
            subtitle: null,
            trailing: pickedUp ? waitingTime : l10n.pending,
            done: false,
            active: false,
            isLast: false,
            pending: !pickedUp,
          ),
          _TimelineStep(
            title: l10n.delivered,
            subtitle: null,
            trailing: l10n.pending,
            done: delivered,
            active: false,
            isLast: true,
            pending: true,
          ),
        ],
      ),
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.title,
    required this.trailing,
    required this.done,
    required this.active,
    required this.isLast,
    this.subtitle,
    this.pending = false,
  });

  final String title;
  final String? subtitle;
  final String trailing;
  final bool done;
  final bool active;
  final bool isLast;
  final bool pending;

  @override
  Widget build(BuildContext context) {
    final green = const Color(0xFF126B43);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 24,
            child: Column(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: done || active ? green : Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: done || active ? green : const Color(0xFFD1D5DB),
                      width: 2,
                    ),
                  ),
                  child: done
                      ? const Icon(Icons.check, size: 14, color: Colors.white)
                      : null,
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: done ? green : const Color(0xFFE5E7EB),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: pending ? const Color(0xFF9CA3AF) : const Color(0xFF111827),
                          ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            subtitle!,
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Text(
                    trailing,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: pending ? const Color(0xFF9CA3AF) : const Color(0xFF374151),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MultiStopBanner extends StatelessWidget {
  const _MultiStopBanner({
    required this.stops,
    required this.selectedId,
    required this.onSelect,
  });

  final List<ActiveDeliveryData> stops;
  final String selectedId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _WhiteCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.delSuggestedRoute(stops.length.toString()),
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 10),
          ...List.generate(stops.length, (i) {
            final s = stops[i];
            final selected = s.id == selectedId;
            final dist = s.distanceKm != null
                ? l10n.distanceKmValue(s.distanceKm!.toStringAsFixed(1))
                : '—';
            return Padding(
              padding: EdgeInsets.only(bottom: i == stops.length - 1 ? 0 : 8),
              child: InkWell(
                onTap: () => onSelect(s.id),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: selected ? const Color(0xFFDCFCE7) : const Color(0xFFF8FAF9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: selected ? const Color(0xFF126B43) : const Color(0xFFE5E7EB),
                    ),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor:
                            selected ? const Color(0xFF126B43) : const Color(0xFF94A3B8),
                        child: Text(
                          '${i + 1}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '#${s.orderNumber} · ${s.customerName}',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            if (s.preOrderTag.isNotEmpty)
                              Text(
                                s.preOrderTag,
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF047857),
                                ),
                              ),
                          ],
                        ),
                      ),
                      Text(
                        dist,
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _BottomActions extends StatelessWidget {
  const _BottomActions({
    required this.isUnlocked,
    required this.proofPending,
    required this.customerNavStarted,
    required this.otpVerified,
    required this.onItemProof,
    required this.onNavigateCustomer,
    required this.onCaptureProof,
    required this.onComplete,
    this.onFailed,
    this.hasDeliveryProof = false,
  });

  final bool isUnlocked;
  final bool proofPending;
  final bool customerNavStarted;
  final bool otpVerified;
  final VoidCallback onItemProof;
  final VoidCallback onNavigateCustomer;
  final VoidCallback onCaptureProof;
  final VoidCallback onComplete;
  final VoidCallback? onFailed;
  final bool hasDeliveryProof;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final l10n = AppLocalizations.of(context);
    String label;
    IconData icon;
    VoidCallback? onTap;
    if (!isUnlocked) {
      if (proofPending) {
        label = l10n.delWaitingForManager;
        icon = Icons.hourglass_top_rounded;
        onTap = null;
      } else {
        label = l10n.delTakeItemProof;
        icon = Icons.camera_alt_rounded;
        onTap = onItemProof;
      }
    } else if (!hasDeliveryProof) {
      label = l10n.delCaptureDeliveryProof;
      icon = Icons.photo_camera_outlined;
      onTap = onCaptureProof;
    } else if (!otpVerified) {
      label = l10n.delEnterOtpAndComplete;
      icon = Icons.pin_outlined;
      onTap = onComplete;
    } else {
      label = l10n.delCompleteDelivery;
      icon = Icons.check_circle_outline_rounded;
      onTap = onComplete;
    }

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottom),
      color: Colors.white,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _PrimaryActionBtn(
            label: label,
            icon: icon,
            enabled: onTap != null,
            onTap: onTap ?? () {},
            showChevron: true,
          ),
          if (isUnlocked && onFailed != null) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: onFailed,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFDC2626),
                  side: const BorderSide(color: Color(0xFFFECACA)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(
                  l10n.delDeliveryFailed,
                  style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}


class _WhiteCard extends StatelessWidget {
  const _WhiteCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: child,
    );
  }
}
