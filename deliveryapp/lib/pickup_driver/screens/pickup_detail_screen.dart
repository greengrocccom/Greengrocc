import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/app_localizations.dart';
import '../pickup_driver_service.dart';
import '../pickup_flow.dart';
import '../pickup_push_service.dart';
import '../widgets/pickup_items.dart';
import '../widgets/pickup_ui.dart';
import 'farmer_qr_scan_screen.dart';
import 'pickup_batch_screen.dart';

const _maxPhotos = 4;
const _maxPhotoChars = 2500000;

/// One pickup order, step by step — mirrors vendor `DriverPickupPage`.
class PickupDetailScreen extends StatefulWidget {
  const PickupDetailScreen({super.key, required this.pickupId, this.initialQr});

  final String pickupId;

  /// Farmer QR already scanned from the home screen; verified once loaded.
  final String? initialQr;

  @override
  State<PickupDetailScreen> createState() => _PickupDetailScreenState();
}

class _PickupDetailScreenState extends State<PickupDetailScreen> {
  final _svc = PickupDriverService.instance;
  final _qrController = TextEditingController();

  Map<String, dynamic>? _pickup;
  String _error = '';
  bool _busy = false;
  StreamSubscription<void>? _watch;

  @override
  void initState() {
    super.initState();
    _load().then((_) {
      final qr = widget.initialQr?.trim() ?? '';
      if (qr.isNotEmpty && mounted && _pickup != null) _verifyQr(qr);
    });
    _watch = _svc.watchPickup(widget.pickupId).listen((_) => _onPush());
    PickupPushService.instance.refreshTick.addListener(_onPush);
  }

  void _onPush() {
    if (!_busy) _load(silent: true);
  }

  @override
  void dispose() {
    _watch?.cancel();
    PickupPushService.instance.refreshTick.removeListener(_onPush);
    _qrController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final p = await _svc.getPickup(widget.pickupId);
      if (!mounted) return;
      setState(() {
        _pickup = p;
        if (!silent) _error = '';
      });
    } catch (e) {
      if (!mounted) return;
      if (await handlePickupAuthError(context, e)) return;
      if (!silent || _pickup == null) {
        setState(() => _error = pickupErrorText(e));
      }
    }
  }

  Future<bool> _run(
    Future<Map<String, dynamic>> Function() fn,
    String okMessage,
  ) async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      final payload = await fn();
      if (!mounted) return false;
      final next = payload['status'] != null
          ? payload
          : (payload['pickup'] is Map
              ? Map<String, dynamic>.from(payload['pickup'] as Map)
              : payload);
      setState(() => _pickup = next.isEmpty ? _pickup : next);
      showPickupSnack(context, okMessage);
      return true;
    } catch (e) {
      if (!mounted) return false;
      if (await handlePickupAuthError(context, e)) return false;
      setState(() => _error = pickupErrorText(e));
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String get _id => str(_pickup?['id']).isNotEmpty
      ? str(_pickup!['id'])
      : widget.pickupId;

  Future<void> _reject() async {
    final l10n = AppLocalizations.of(context);
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(l10n.pksRejectPickupTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.pksRejectPickupBody,
              style: pickupText(13, color: PickupColors.muted),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              maxLength: 300,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: l10n.pksReasonOptional,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.reject,
                style: const TextStyle(color: Color(0xFFDC2626))),
          ),
        ],
      ),
    );
    final reason = reasonCtrl.text.trim();
    reasonCtrl.dispose();
    if (confirmed != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await _svc.reject(_id, reason: reason);
      if (!mounted) return;
      showPickupSnack(context, l10n.pksPickupRejectedSent);
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      if (await handlePickupAuthError(context, e)) return;
      setState(() {
        _busy = false;
        _error = pickupErrorText(e);
      });
    }
  }

  Future<void> _verifyQr(String value) async {
    final v = value.trim();
    if (v.isEmpty) return;
    final l10n = AppLocalizations.of(context);
    if (needsAcceptance(_pickup)) {
      final ok = await _run(() => _svc.accept(_id), l10n.pksPickupAccepted);
      if (!ok || !mounted) return;
    }
    final steps = <String, (String, String)>{
      'DRIVER_ASSIGNED': ('start', l10n.pksLeftForPickup),
      'PICKUP_SCHEDULED': ('start', l10n.pksLeftForPickup),
      'DISPATCHED': ('arrive', l10n.pksReachedFarmDone),
      'DRIVER_ARRIVED': ('check', l10n.pksOrderChecked),
    };
    for (var i = 0; i < 3; i++) {
      final before = str(_pickup?['status']);
      final step = steps[before];
      if (step == null) break;
      final ok = await _run(
        () => switch (step.$1) {
          'start' => _svc.start(_id),
          'arrive' => _svc.arrive(_id),
          _ => _svc.checkOrder(_id),
        },
        step.$2,
      );
      if (!ok || !mounted) return;
      if (str(_pickup?['status']) == before) break;
    }
    final ok = await _run(
        () => _svc.verifyQr(_id, v), l10n.pksQrVerifiedSuccess);
    if (!ok || !mounted) return;
    _qrController.clear();
    await _showVerifiedItems();
  }

  Future<void> _showVerifiedItems() async {
    final p = _pickup;
    if (p == null) return;
    final l10n = AppLocalizations.of(context);
    final confirm = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(ctx).height * 0.85),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Icon(Icons.verified_rounded,
                        color: PickupColors.brand, size: 28),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(l10n.pksQrVerifiedCheckItems,
                          style: pickupText(17, weight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${pickupOrderId(p)} · ${str(p['farmerName'])}\n${l10n.pksMatchItemsBeforeConfirm}',
                  style: pickupText(12.5, color: PickupColors.muted),
                ),
                const SizedBox(height: 12),
                PickupItemsTable(pickup: p),
                const SizedBox(height: 16),
                PickupButton(
                  label: l10n.pksItemsMatchConfirm,
                  icon: Icons.photo_camera_outlined,
                  onPressed: () => Navigator.pop(ctx, true),
                ),
                const SizedBox(height: 8),
                PickupButton(
                  label: l10n.pksLater,
                  outlined: true,
                  onPressed: () => Navigator.pop(ctx, false),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (confirm == true && mounted) await _openConfirm();
  }

  Future<void> _scanQr() async {
    final value = await Navigator.of(context).push(pickupRoute<String>(
      FarmerQrScanScreen(orderLabel: pickupOrderId(_pickup ?? const {})),
    ));
    if (value != null && value.isNotEmpty && mounted) await _verifyQr(value);
  }

  Future<void> _openConfirm() async {
    final p = _pickup!;
    final l10n = AppLocalizations.of(context);
    final photos = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ConfirmPickupSheet(pickup: p),
    );
    if (photos == null || photos.isEmpty || !mounted) return;
    await _run(() => _svc.confirm(_id, photos), l10n.pksPickupConfirmedStatus);
  }

  Future<void> _call(String mobile) async {
    final uri = Uri(scheme: 'tel', path: mobile);
    if (!await launchUrl(uri) && mounted) {
      showPickupSnack(context, AppLocalizations.of(context).pksCouldNotOpenDialer,
          error: true);
    }
  }

  Future<void> _openMap(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null ||
        !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        showPickupSnack(context, AppLocalizations.of(context).pksCouldNotOpenMap,
            error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _pickup;
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: PickupColors.page,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: Text(
          p == null ? l10n.pickup : l10n.pksOrderTitle(pickupOrderId(p)),
          style: pickupText(16, weight: FontWeight.w800),
        ),
      ),
      body: p == null
          ? Center(
              child: _error.isNotEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(20),
                      child: ErrorBanner(_error),
                    )
                  : const CircularProgressIndicator(
                      color: PickupColors.brand),
            )
          : RefreshIndicator(
              color: PickupColors.brand,
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
                children: _content(p),
              ),
            ),
    );
  }

  List<Widget> _content(Map<String, dynamic> p) {
    final l10n = AppLocalizations.of(context);
    final status = str(p['status']);
    final mustDecide = needsAcceptance(p);
    final canStart = !mustDecide &&
        (status == 'DRIVER_ASSIGNED' || status == 'PICKUP_SCHEDULED');
    final canArrive = status == 'DISPATCHED';
    final canCheck = status == 'DRIVER_ARRIVED';
    final canScan = !mustDecide && farmScanStatuses.contains(status);
    final canConfirm = status == 'QR_VERIFIED' &&
        p['qrVerified'] == true &&
        p['pickupConfirmed'] != true;
    final transit = canTransit(p);
    final canArriveCentre = status == 'IN_TRANSIT';
    final live = pickupLiveLabel(p);
    final next = driverNextStep(p);
    final batchId = str(p['collectionBatchId']);
    final mobile = str(p['farmerMobile']);
    final mapsUrl = str(p['mapsUrl']);
    final unit = str(p['unit']);
    final photos = (p['confirmationPhotos'] is List)
        ? (p['confirmationPhotos'] as List).map(str).where((s) => s.isNotEmpty).toList()
        : <String>[];
    const gap = SizedBox(height: 14);

    return [
      Align(alignment: Alignment.centerLeft, child: StatusChip(live)),
      const SizedBox(height: 8),
      Text(
        '${str(p['farmerName'])} · ${str(p['productName'])}',
        style: pickupText(14, color: PickupColors.muted),
      ),
      if (_error.isNotEmpty) ...[gap, ErrorBanner(_error)],
      if (mustDecide) ...[
        gap,
        PickupCard(
          color: const Color(0xFFFFF7ED),
          borderColor: const Color(0xFFFB923C),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.pksNewPickupAssignedToYou,
                  style: pickupText(16, weight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(
                l10n.pksAcceptOrRejectHint,
                style: pickupText(12.5, color: PickupColors.muted),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: PickupButton(
                      label: l10n.reject,
                      icon: Icons.close_rounded,
                      outlined: true,
                      onPressed: _busy ? null : _reject,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PickupButton(
                      label: l10n.accept,
                      icon: Icons.check_rounded,
                      busy: _busy,
                      onPressed: () => _run(() => _svc.accept(_id),
                          l10n.pksPickupAcceptedHint),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
      gap,
      PickupCard(
        color: PickupColors.brandSoft,
        borderColor: PickupColors.brand,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.pksYourCurrentStatus,
                style: pickupText(10,
                    weight: FontWeight.w800, color: PickupColors.brand)),
            const SizedBox(height: 4),
            Text(live, style: pickupText(17, weight: FontWeight.w800)),
            if (next != null) ...[
              const SizedBox(height: 4),
              Text(l10n.pksNextStep(next.label),
                  style: pickupText(12.5,
                      weight: FontWeight.w700, color: PickupColors.brand)),
            ],
            const SizedBox(height: 4),
            Text(
              l10n.pksUpdateStepHint,
              style: pickupText(12, color: PickupColors.muted),
            ),
            const SizedBox(height: 12),
            if (batchId.isNotEmpty) ...[
              Row(
                children: [
                  Text('${l10n.pksLotBatchId}  ',
                      style: pickupText(11.5, color: PickupColors.muted)),
                  Expanded(
                    child: InkWell(
                      onTap: () => Navigator.of(context).push(
                        pickupRoute<void>(PickupBatchScreen(batchId: batchId)),
                      ),
                      child: Text(
                        batchId,
                        overflow: TextOverflow.ellipsis,
                        style: pickupText(12.5,
                            weight: FontWeight.w800,
                            color: PickupColors.brand),
                      ),
                    ),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.copy_rounded,
                        size: 18, color: PickupColors.brand),
                    onPressed: () => _copy(batchId),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              PickupButton(
                label: l10n.pksShowBatchQr,
                icon: Icons.qr_code_2_rounded,
                onPressed: () =>
                    showBatchQr(context, batchId: batchId, record: p),
              ),
              const SizedBox(height: 8),
            ],
            PickupButton(
              label: l10n.pksShowOrderQr,
              icon: Icons.qr_code_rounded,
              outlined: true,
              onPressed: () => showOrderQr(context, p),
            ),
          ],
        ),
      ),
      gap,
      PickupCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(l10n.pksPickupProgress),
            PickupTimelineView(status: status),
          ],
        ),
      ),
      gap,
      PickupCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(l10n.pksPickupDetails),
            InfoGrid([
              InfoItem(l10n.pksOrderId, pickupOrderId(p), copy: true),
              InfoItem(l10n.pksFarmerName, str(p['farmerName'])),
              InfoItem(l10n.pksFarmerLocation, str(p['farmerLocation'])),
              InfoItem(l10n.pksProduct, str(p['productName'])),
              InfoItem(l10n.pksQuantity, pickupQuantity(p)),
              InfoItem(l10n.pksPackageCount, str(p['packageCount'])),
              InfoItem(l10n.pksPickupDateTime, pickupWhenText(p)),
              InfoItem(
                l10n.pksPickupInstructions,
                str(p['pickupInstructions']).isNotEmpty
                    ? str(p['pickupInstructions'])
                    : l10n.pksDefaultPickupInstructions,
              ),
            ]),
            if (mobile.isNotEmpty || mapsUrl.isNotEmpty) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  if (mobile.isNotEmpty)
                    Expanded(
                      child: PickupButton(
                        label: l10n.pksCallFarmer,
                        icon: Icons.call_rounded,
                        outlined: true,
                        onPressed: () => _call(mobile),
                      ),
                    ),
                  if (mobile.isNotEmpty && mapsUrl.isNotEmpty)
                    const SizedBox(width: 10),
                  if (mapsUrl.isNotEmpty)
                    Expanded(
                      child: PickupButton(
                        label: l10n.pksViewLocation,
                        icon: Icons.map_outlined,
                        outlined: true,
                        onPressed: () => _openMap(mapsUrl),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
      gap,
      PickupCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(l10n.pksItemsToCollect),
            if (canScan) ...[
              Text(
                l10n.pksCheckItemsThenScan,
                style: pickupText(12, color: PickupColors.muted),
              ),
              const SizedBox(height: 8),
            ],
            PickupItemsTable(pickup: p),
          ],
        ),
      ),
      if (canStart) ...[
        gap,
        PickupButton(
          label: l10n.pksLeftForPickupOnTheWay,
          icon: Icons.local_shipping_outlined,
          busy: _busy,
          onPressed: () => _run(() => _svc.start(_id),
              l10n.pksLeftForPickupStatus),
        ),
      ],
      if (canArrive) ...[
        gap,
        PickupButton(
          label: l10n.pksReachedFarmButton,
          icon: Icons.agriculture_outlined,
          busy: _busy,
          onPressed: () =>
              _run(() => _svc.arrive(_id), l10n.pksReachedFarmDone),
        ),
      ],
      if (status == 'DRIVER_ARRIVED' ||
          status == 'ORDER_VERIFIED' ||
          status == 'QR_VERIFIED') ...[
        gap,
        Text(l10n.pksDriverArrivedAtPickup,
            style: pickupText(13.5,
                weight: FontWeight.w700, color: PickupColors.brand)),
      ],
      if (canCheck ||
          const {
            'ORDER_VERIFIED',
            'QR_VERIFIED',
            'PICKED_UP',
            'IN_TRANSIT',
            'ARRIVED_AT_CENTRE'
          }.contains(status)) ...[
        gap,
        PickupCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionTitle(l10n.pksOrderVerification),
              InfoGrid([
                InfoItem(l10n.pksOrderId, pickupOrderId(p), copy: true),
                InfoItem(l10n.pksFarmerName, str(p['farmerName'])),
                InfoItem(l10n.pksProductName, str(p['productName'])),
                InfoItem(l10n.pksVariety, str(p['variety'])),
                InfoItem(l10n.pksGrade, str(p['grade'])),
                InfoItem(l10n.pksOrderedQuantity,
                    '${str(p['orderedQuantity'])} $unit'.trim()),
                InfoItem(l10n.pksPackedQuantity,
                    '${str(p['packedQuantity'])} $unit'.trim()),
                InfoItem(l10n.pksPackageCount, str(p['packageCount'])),
                InfoItem(l10n.pksPickupLocation, str(p['farmerLocation'])),
              ]),
              if (canCheck) ...[
                const SizedBox(height: 14),
                PickupButton(
                  label: l10n.pksCheckOrder,
                  icon: Icons.fact_check_outlined,
                  busy: _busy,
                  onPressed: () => _run(() => _svc.checkOrder(_id),
                      l10n.pksOrderCheckedScanNext),
                ),
              ],
            ],
          ),
        ),
      ],
      if (canScan) ...[
        gap,
        PickupCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionTitle(l10n.pksScanFarmerQr),
              Text(
                status == 'ORDER_VERIFIED'
                    ? l10n.pksScanQrToVerifyOrder
                    : l10n.pksAtFarmScanHint,
                style: pickupText(12, color: PickupColors.muted),
              ),
              const SizedBox(height: 10),
              PickupButton(
                label: l10n.pksOpenCameraAndScan,
                icon: Icons.qr_code_scanner_rounded,
                busy: _busy,
                onPressed: _scanQr,
              ),
              const SizedBox(height: 12),
              Text(l10n.pksOrPasteFarmerQr,
                  style: pickupText(12, color: PickupColors.muted)),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _qrController,
                      enabled: !_busy,
                      decoration: InputDecoration(
                        isDense: true,
                        hintText: l10n.pksPasteFarmerQr,
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 100,
                    child: PickupButton(
                      label: l10n.pksVerify,
                      busy: _busy,
                      onPressed: () => _verifyQr(_qrController.text),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
      if (const {'QR_VERIFIED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_CENTRE'}
          .contains(status)) ...[
        gap,
        PickupCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionTitle(l10n.pksOrderSummary),
              InfoGrid([
                InfoItem(l10n.pksOrderId, pickupOrderId(p), copy: true),
                InfoItem(l10n.pksFarmer, str(p['farmerName'])),
                InfoItem(l10n.pksProduct, str(p['productName'])),
                InfoItem(l10n.pksQuantity, pickupQuantity(p)),
                InfoItem(l10n.pksPackageCount, str(p['packageCount'])),
                InfoItem(l10n.pksDriver, str(p['driverName'])),
                InfoItem(l10n.pksVehicleNumber, str(p['vehicleNumber'])),
                if (batchId.isNotEmpty)
                  InfoItem(l10n.pksLotBatchId, batchId, copy: true),
              ]),
              if (canConfirm) ...[
                const SizedBox(height: 14),
                PickupButton(
                  label: l10n.pksConfirmOrderPickup,
                  icon: Icons.photo_camera_outlined,
                  busy: _busy,
                  onPressed: _openConfirm,
                ),
              ],
              if (p['pickupConfirmed'] == true) ...[
                const SizedBox(height: 12),
                Text(l10n.pksPickupConfirmedFromFarmer,
                    style: pickupText(13.5,
                        weight: FontWeight.w700, color: PickupColors.brand)),
              ],
              if (photos.isNotEmpty) ...[
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 6,
                  crossAxisSpacing: 6,
                  children: [for (final src in photos) PhotoThumb(src)],
                ),
              ],
            ],
          ),
        ),
      ],
      if (transit) ...[
        gap,
        PickupButton(
          label: l10n.pksOnTheWayToCentre,
          icon: Icons.local_shipping_outlined,
          busy: _busy,
          onPressed: () =>
              _run(() => _svc.transit(_id), l10n.pksOnTheWayToCentreDone),
        ),
      ],
      if (canArriveCentre) ...[
        gap,
        PickupButton(
          label: l10n.pksReachedCollectionCentre,
          icon: Icons.warehouse_outlined,
          busy: _busy,
          onPressed: () =>
              _run(() => _svc.arriveCentre(_id), l10n.pksAtCollectionCentre),
        ),
      ],
      if (status == 'ARRIVED_AT_CENTRE') ...[
        gap,
        Text(l10n.pksWaitingForCentreReceiving,
            style: pickupText(13.5,
                weight: FontWeight.w700, color: PickupColors.brand)),
      ],
      if (isPickupFinished(p)) ...[
        gap,
        Text(l10n.pksReceivedAtCentre,
            style: pickupText(13.5,
                weight: FontWeight.w700, color: PickupColors.brand)),
      ],
    ];
  }

  void _copy(String value) {
    Clipboard.setData(ClipboardData(text: value));
    showPickupSnack(context, AppLocalizations.of(context).pksCopiedValue(value));
  }
}

/// Thumbnail for a data-URL or http photo.
class PhotoThumb extends StatelessWidget {
  const PhotoThumb(this.src, {super.key, this.onRemove});

  final String src;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    Widget image;
    if (src.startsWith('data:image/')) {
      final comma = src.indexOf(',');
      try {
        image = Image.memory(base64Decode(src.substring(comma + 1)),
            fit: BoxFit.cover);
      } catch (_) {
        image = const ColoredBox(color: PickupColors.page);
      }
    } else {
      image = Image.network(src,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) =>
              const ColoredBox(color: PickupColors.page));
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Stack(
        fit: StackFit.expand,
        children: [
          image,
          if (onRemove != null)
            Positioned(
              top: 2,
              right: 2,
              child: InkWell(
                onTap: onRemove,
                child: Container(
                  decoration: const BoxDecoration(
                    color: Colors.black54,
                    shape: BoxShape.circle,
                  ),
                  padding: const EdgeInsets.all(3),
                  child: const Icon(Icons.close, size: 14, color: Colors.white),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// "Confirm Pickup" sheet: summary + 1–4 photos. Pops with data-URL photos.
class _ConfirmPickupSheet extends StatefulWidget {
  const _ConfirmPickupSheet({required this.pickup});
  final Map<String, dynamic> pickup;

  @override
  State<_ConfirmPickupSheet> createState() => _ConfirmPickupSheetState();
}

class _ConfirmPickupSheetState extends State<_ConfirmPickupSheet> {
  final _picker = ImagePicker();
  final List<String> _photos = [];
  bool _picking = false;

  Future<void> _add(ImageSource source) async {
    if (_photos.length >= _maxPhotos || _picking) return;
    setState(() => _picking = true);
    try {
      final file = await _picker.pickImage(
        source: source,
        imageQuality: 72,
        maxWidth: 1280,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final lower = file.name.toLowerCase();
      final mime = file.mimeType ??
          (lower.endsWith('.png')
              ? 'image/png'
              : lower.endsWith('.webp')
                  ? 'image/webp'
                  : 'image/jpeg');
      final dataUrl = 'data:$mime;base64,${base64Encode(bytes)}';
      if (dataUrl.length >= _maxPhotoChars) {
        if (mounted) {
          showPickupSnack(context, AppLocalizations.of(context).pksPhotoTooLarge,
              error: true);
        }
        return;
      }
      if (mounted) setState(() => _photos.add(dataUrl));
    } catch (e) {
      if (mounted) {
        showPickupSnack(context,
            AppLocalizations.of(context).pksCouldNotGetPhoto(pickupErrorText(e)),
            error: true);
      }
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.pickup;
    final full = _photos.length >= _maxPhotos;
    final l10n = AppLocalizations.of(context);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 16, 20, 16 + MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(l10n.pksConfirmPickup,
                  style: pickupText(17, weight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(l10n.pksConfirmReceivedQuestion,
                  style: pickupText(13, color: PickupColors.muted)),
              const SizedBox(height: 14),
              InfoGrid([
                InfoItem(l10n.pksOrderId, pickupOrderId(p)),
                InfoItem(l10n.pksFarmer, str(p['farmerName'])),
                InfoItem(l10n.pksProduct, str(p['productName'])),
                InfoItem(l10n.pksQuantity,
                    '${str(p['packedQuantity'])} ${str(p['unit'])}'.trim()),
                InfoItem(l10n.pksPackageCount, str(p['packageCount'])),
                InfoItem(l10n.pksDriver, str(p['driverName'])),
                InfoItem(l10n.pksVehicleNumber, str(p['vehicleNumber'])),
              ]),
              const SizedBox(height: 16),
              Text(
                  l10n.pksPickupPhotosCount(
                      _photos.length.toString(), _maxPhotos.toString()),
                  style: pickupText(13, weight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(l10n.pksTakeLivePhotoHint,
                  style: pickupText(12, color: PickupColors.muted)),
              const SizedBox(height: 10),
              if (_photos.isNotEmpty) ...[
                GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 6,
                  crossAxisSpacing: 6,
                  children: [
                    for (var i = 0; i < _photos.length; i++)
                      PhotoThumb(
                        _photos[i],
                        onRemove: () => setState(() => _photos.removeAt(i)),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
              ],
              Row(
                children: [
                  Expanded(
                    child: PickupButton(
                      label: l10n.takePhoto,
                      icon: Icons.photo_camera_outlined,
                      outlined: true,
                      busy: _picking,
                      onPressed: full ? null : () => _add(ImageSource.camera),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PickupButton(
                      label: l10n.pksGallery,
                      icon: Icons.photo_library_outlined,
                      outlined: true,
                      onPressed: full || _picking
                          ? null
                          : () => _add(ImageSource.gallery),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: PickupButton(
                      label: l10n.cancel,
                      outlined: true,
                      onPressed: () => Navigator.pop(context),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PickupButton(
                      label: l10n.pksConfirmPickup,
                      onPressed: _photos.isEmpty
                          ? null
                          : () => Navigator.pop(context, List<String>.from(_photos)),
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
