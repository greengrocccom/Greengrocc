import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isPreOrder
                ? 'QR scanned! Customer address unlocked.'
                : 'QR scanned! Now capture item photo for manager approval.',
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

    final sent = await _showPhotoSendSheet(
      photo: photo,
      title: 'Item Proof',
      subtitle: 'Send this photo to the manager for approval.',
      sendLabel: 'Send to Manager',
      onSend: (dataUrl) => OrderService.instance.submitPickupProof(_delivery!.id, dataUrl),
    );
    if (sent == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Item photo sent. Waiting for manager approval.'),
          backgroundColor: Color(0xFF059669),
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
          const SnackBar(content: Text('Could not open camera. Check permissions.')),
        );
      }
      return null;
    }
  }

  Future<bool?> _captureAndUploadDeliveryProof() async {
    if (_delivery == null) return false;
    final photo = await _pickCameraPhoto();
    if (photo == null || !mounted) return false;

    return _showPhotoSendSheet(
      photo: photo,
      title: 'Delivery Proof',
      subtitle: 'Send this photo, then enter the customer OTP.',
      sendLabel: 'Send Photo',
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
                            child: const Text('Retake'),
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
                                        const SnackBar(
                                          content: Text('Could not send photo. Try again.'),
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
    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(emergency ? 'Emergency sent to your Delivery Manager.' : 'Delivery marked as failed. Manager has been notified.'),
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
          content: Text(result.error ?? 'Could not mark failed.'),
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
              ? 'Delay sent to your Delivery Manager.'
              : (result.error ?? 'Could not send the delay.'),
        ),
        backgroundColor: result.success ? const Color(0xFFB45309) : Colors.red,
      ),
    );
    if (result.success) await _loadDelivery();
  }

  Future<bool> _askCustomerOtp() async {
    final d = _delivery!;
    return showCustomerOtpSheet(
      context,
      orderNumber: d.orderNumber,
      onVerify: (otp) async {
        final result = await OrderService.instance.verifyCustomerOtp(d.id, otp);
        return result.success ? null : (result.error ?? 'Incorrect OTP');
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
      final pay = await OrderService.instance.confirmOnlinePayment(d.id);
      if (!pay.success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(pay.error ?? 'Online payment failed'), backgroundColor: Colors.red),
          );
        }
        return;
      }
      await _askOptionalCommentThenFinish();
      return;
    }

    // Physical cash
    final cash = await OrderService.instance.confirmCashCollection(d.id);
    if (!cash.success) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(cash.error ?? 'Cash confirmation failed'), backgroundColor: Colors.red),
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

  Future<void> _finishDelivery({
    required bool otpAlreadyVerified,
    String? deliveryComment,
  }) async {
    if (_delivery == null) return;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    final l10n = AppLocalizations.of(context);
    final orderNumber = _delivery!.orderNumber;

    final result = await OrderService.instance.completeDelivery(
      _delivery!.id,
      'VERIFIED',
      deliveryComment: deliveryComment,
    );

    if (result.success) {
      if (!mounted) return;
      final remaining = OrderService.instance.activeDeliveries;
      await showStatusDialog(
        context,
        success: true,
        title: l10n.orderDeliveredTitle,
        message: l10n.orderDeliveredBody(orderNumber),
        buttonLabel: remaining.isEmpty ? l10n.goToHome : l10n.nextDelivery,
      );
      if (!mounted) return;
      if (remaining.isEmpty) {
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
          content: Text(result.error ?? 'Could not complete delivery.'),
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
        const SnackBar(content: Text('Could not open Google Maps. Install Maps or try again.')),
      );
    }
  }

  Future<void> _callStore(String? phone) => _callNumber(phone, 'Store');

  Future<void> _callNumber(String? phone, String who) async {
    if (phone == null || phone.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$who phone number not available.')),
      );
      return;
    }
    final uri = Uri.parse('tel:${phone.replaceAll(RegExp(r'[^\d+]'), '')}');
    if (!await launchUrl(uri)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open phone dialer.')),
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
    final h = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final m = local.minute.toString().padLeft(2, '0');
    final ap = local.hour >= 12 ? 'PM' : 'AM';
    return '$h:$m $ap';
  }

  @override
  Widget build(BuildContext context) {
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
                  'No Active Delivery',
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Stay online on the home screen to receive automated round-robin order assignments.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(color: Colors.grey),
                ),
                const SizedBox(height: 24),
                PrimaryButton(
                  label: 'Check For Orders',
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
      headerStatus = 'Out for Delivery';
    } else if (proofPending) {
      headerStatus = 'Awaiting Approval';
    } else if (qrScanned) {
      headerStatus = 'Item Proof';
    } else if (searching) {
      headerStatus = 'Waiting for Pickup';
    } else {
      headerStatus = 'Waiting for Pickup';
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
                        label: const Text('Report emergency'),
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
                              content: Text(
                                'Pickup QR unlocks in $countdown — go to the dark store meanwhile.',
                              ),
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
                            : 'Address unlocks after dark store pickup QR is verified',
                        phone: item.customerAddressUnlocked ? item.customerPhone : '',
                        isUnlocked: item.customerAddressUnlocked,
                        onViewMap: () => _navigateToCustomer(item),
                        onCall: () => _callNumber(item.customerPhone, 'Customer'),
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
              'Deliver this order by $time',
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
                  'Order Details',
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
                    'PICKUP DARK STORE',
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
                  'Call Store',
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
    final pickupStatus = isUnlocked
        ? 'Pickup verified — customer address unlocked'
        : proofPending
            ? 'Item photo sent — waiting for manager'
            : qrScanned
                ? 'QR scanned — take item proof below'
                : 'Scan QR at the store to start';

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
                      'Pickup QR',
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
                              'Same-route search · $countdown',
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
                'Scan QR',
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
                    orderNumber.isNotEmpty ? '#$orderNumber · Customer Address' : 'Customer Address',
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
                'View on Map',
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
            '#$orderNumber  •  ${customerName.isNotEmpty ? customerName : "Customer"}',
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
                  'View on Map',
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
                    'Call',
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

  static String _late(int total) {
    final h = total ~/ 60;
    final m = total % 60;
    if (h == 0) return '$m min';
    return m == 0 ? '$h hr' : '$h hr $m min';
  }

  @override
  Widget build(BuildContext context) {
    const amber = Color(0xFFB45309);
    final reported = delivery.delayMinutes > 0;
    final status = !reported
        ? 'Stuck or running late? Let your manager know.'
        : delivery.delayCustomerNotifiedAt != null
            ? 'Reported ${_late(delivery.delayMinutes)} late · manager updated the customer'
            : 'Reported ${_late(delivery.delayMinutes)} late · waiting for manager';
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
              reported ? 'Update' : 'Report delay',
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
                    'Order Items',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF111827),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '$totalItems Items',
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
                          'Grocery Pack',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF111827),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$totalItems items • ₹$itemsTotal',
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
    return _WhiteCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.schedule_rounded, size: 18, color: Color(0xFF126B43)),
              const SizedBox(width: 8),
              Text(
                'Order Timeline',
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
            title: 'Order Assigned',
            subtitle: 'You have been assigned a new order',
            trailing: assignedTime,
            done: true,
            active: false,
            isLast: false,
          ),
          _TimelineStep(
            title: 'Waiting for Pickup',
            subtitle: 'Go to the store and scan the pickup QR.',
            trailing: waitingTime,
            done: pickedUp,
            active: !pickedUp,
            isLast: false,
          ),
          _TimelineStep(
            title: 'Picked Up',
            subtitle: null,
            trailing: pickedUp ? waitingTime : 'Pending',
            done: false,
            active: false,
            isLast: false,
            pending: !pickedUp,
          ),
          _TimelineStep(
            title: 'Delivered',
            subtitle: null,
            trailing: 'Pending',
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
    return _WhiteCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Suggested route · ${stops.length} deliveries',
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
                ? '${s.distanceKm!.toStringAsFixed(1)} km'
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
    String label;
    IconData icon;
    VoidCallback? onTap;
    if (!isUnlocked) {
      if (proofPending) {
        label = 'Waiting for Manager';
        icon = Icons.hourglass_top_rounded;
        onTap = null;
      } else {
        label = 'Take Item Proof';
        icon = Icons.camera_alt_rounded;
        onTap = onItemProof;
      }
    } else if (!hasDeliveryProof) {
      label = 'Capture Delivery Proof';
      icon = Icons.photo_camera_outlined;
      onTap = onCaptureProof;
    } else if (!otpVerified) {
      label = 'Enter OTP & Complete';
      icon = Icons.pin_outlined;
      onTap = onComplete;
    } else {
      label = 'Complete Delivery';
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
                  'Delivery Failed',
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
