import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../l10n/app_localizations.dart';
import '../pickup_driver_service.dart';
import '../pickup_flow.dart';
import '../widgets/pickup_ui.dart';
import 'pickup_detail_screen.dart';

/// Lot / batch of pickups on one trip — mirrors vendor `DriverBatchPage`.
class PickupBatchScreen extends StatefulWidget {
  const PickupBatchScreen({
    super.key,
    required this.batchId,
    this.seedPickups = const [],
  });

  final String batchId;
  final List<Map<String, dynamic>> seedPickups;

  @override
  State<PickupBatchScreen> createState() => _PickupBatchScreenState();
}

class _PickupBatchScreenState extends State<PickupBatchScreen> {
  final _svc = PickupDriverService.instance;
  Map<String, dynamic>? _data;
  String _error = '';
  bool _busy = false;
  StreamSubscription<void>? _watch;

  @override
  void initState() {
    super.initState();
    if (widget.seedPickups.isNotEmpty) {
      _data = {'batchId': widget.batchId, 'pickups': widget.seedPickups};
    }
    _load();
    _watch = _svc.watchBatch(widget.batchId).listen((_) {
      if (!_busy) _load();
    });
  }

  @override
  void dispose() {
    _watch?.cancel();
    super.dispose();
  }

  List<Map<String, dynamic>> _orders(Map<String, dynamic>? data) {
    final raw = data?['pickups'];
    if (raw is! List) return [];
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<void> _load() async {
    try {
      final payload = await _svc.getBatch(widget.batchId);
      if (!mounted) return;
      setState(() {
        final prevOrders = _orders(_data);
        final apiOrders = _orders(payload);
        if (apiOrders.length >= prevOrders.length || prevOrders.isEmpty) {
          _data = payload;
        } else {
          _data = {...payload, 'pickups': prevOrders};
        }
        _error = '';
      });
    } catch (e) {
      if (!mounted) return;
      if (await handlePickupAuthError(context, e)) return;
      if (_data == null) setState(() => _error = pickupErrorText(e));
    }
  }

  Future<void> _markArrived(Map<String, dynamic> pickup) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await _svc.arriveCentre(str(pickup['id']));
      await _load();
      if (mounted) {
        showPickupSnack(context, AppLocalizations.of(context).pksAtCollectionCentre);
      }
    } catch (e) {
      if (!mounted) return;
      if (await handlePickupAuthError(context, e)) return;
      setState(() => _error = pickupErrorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openOrder(Map<String, dynamic> p) async {
    await Navigator.of(context)
        .push(pickupRoute<void>(PickupDetailScreen(pickupId: str(p['id']))));
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Scaffold(
      backgroundColor: PickupColors.page,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: Text(AppLocalizations.of(context).pksBatchDetails,
            style: pickupText(16, weight: FontWeight.w800)),
      ),
      body: data == null
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
                children: _content(data),
              ),
            ),
    );
  }

  List<Widget> _content(Map<String, dynamic> data) {
    final l10n = AppLocalizations.of(context);
    final orders = _orders(data);
    final first = orders.isNotEmpty ? orders.first : <String, dynamic>{};
    final driver = first['driver'] is Map
        ? Map<String, dynamic>.from(first['driver'] as Map)
        : <String, dynamic>{};
    String pick(List<dynamic> values) =>
        values.map(str).firstWhere((s) => s.isNotEmpty, orElse: () => '');

    var live = pickupLiveLabel(data);
    if (live.isEmpty) live = pickupLiveLabel(first);
    final batchId = pick(
        [data['batchId'], data['lotId'], first['collectionBatchId'], widget.batchId]);
    final driverId = pick(
        [data['driverId'], first['driverId'], driver['id'], driver['driverId']]);
    final vehicleNumber =
        pick([data['vehicleNumber'], first['vehicleNumber'], driver['vehicleNumber']]);
    final vehicleType = pick([data['vehicleType'], driver['vehicleType']]);
    final vehicleId = formatVehicleId(
      pick([data['vehicleId'], first['vehicleId'], driver['vehicleId']]),
      vehicleNumber,
    );
    List<String> uniq(Iterable<dynamic> v) =>
        v.map(str).where((s) => s.isNotEmpty).toSet().toList();
    final farmers = data['farmers'] is List && (data['farmers'] as List).isNotEmpty
        ? uniq(data['farmers'] as List)
        : uniq(orders.map((p) => p['farmerName']));
    final products =
        data['products'] is List && (data['products'] as List).isNotEmpty
            ? uniq(data['products'] as List)
            : uniq(orders.map((p) => p['productName']));
    final qrPayload = buildBatchQrPayload(data, batchId);
    final arrivePickup = orders
        .where((p) => str(p['status']) == 'IN_TRANSIT')
        .cast<Map<String, dynamic>?>()
        .firstWhere((_) => true, orElse: () => null);

    return [
      if (live.isNotEmpty)
        Align(alignment: Alignment.centerLeft, child: StatusChip(live)),
      if (_error.isNotEmpty) ...[const SizedBox(height: 12), ErrorBanner(_error)],
      const SizedBox(height: 12),
      PickupCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(l10n.pksOverview),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: () =>
                      showBatchQr(context, batchId: batchId, record: data),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      border: Border.all(color: PickupColors.border),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: qrPayload.isEmpty
                        ? SizedBox(
                            width: 120,
                            height: 120,
                            child: Center(child: Text(l10n.pksNoQr)),
                          )
                        : QrImageView(
                            data: qrPayload,
                            size: 120,
                            padding: EdgeInsets.zero,
                            backgroundColor: Colors.white,
                          ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _idLabel(l10n.pksLotBatchId),
                      CopyText(batchId, size: 13),
                      const SizedBox(height: 8),
                      _idLabel(l10n.pksDriverId),
                      CopyText(driverId, size: 11, color: PickupColors.text),
                      const SizedBox(height: 8),
                      _idLabel(l10n.pksVehicleId),
                      CopyText(vehicleId, size: 11, color: PickupColors.text),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(l10n.pksTapQrToEnlarge,
                style: pickupText(11, color: PickupColors.faint)),
            const Divider(height: 24),
            InfoGrid([
              InfoItem(l10n.orders, '${orders.length}'),
              InfoItem(l10n.pksCollectionCentre,
                  pick([data['collectionCentreName'], first['collectionCentreName']])),
              InfoItem(l10n.pksDriver,
                  pick([data['driverName'], first['driverName'], driver['name']])),
              InfoItem(l10n.pksDriverMobile,
                  pick([data['driverMobile'], first['driverMobile'], driver['mobile']])),
              InfoItem(l10n.vehicle,
                  [vehicleNumber, vehicleType].where((s) => s.isNotEmpty).join(' · ')),
              InfoItem(l10n.pksFarmers, farmers.join(', ')),
              InfoItem(l10n.pksProducts, products.join(', ')),
            ]),
          ],
        ),
      ),
      const SizedBox(height: 14),
      PickupCard(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(l10n.pksOrdersInBatchTitle(orders.length.toString())),
            if (orders.isEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(l10n.pksNoOrders,
                    style: pickupText(13, color: PickupColors.faint)),
              ),
            for (final p in orders)
              InkWell(
                onTap: () => _openOrder(p),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: const BoxDecoration(
                    border: Border(
                        top: BorderSide(color: Color(0xFFF1F5F9))),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pickupOrderId(p),
                                style: pickupText(13,
                                    weight: FontWeight.w800,
                                    color: PickupColors.brand)),
                            const SizedBox(height: 2),
                            Text(
                              '${str(p['farmerName'])} · ${str(p['productName'])} · ${pickupQuantity(p)}',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  pickupText(12, color: PickupColors.muted),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 130),
                        child: StatusChip(pickupLiveLabel(p)),
                      ),
                      const Icon(Icons.chevron_right_rounded,
                          color: PickupColors.faint),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
      if (arrivePickup != null) ...[
        const SizedBox(height: 16),
        PickupButton(
          label: l10n.pksReachedCollectionCentre,
          icon: Icons.warehouse_outlined,
          busy: _busy,
          onPressed: () => _markArrived(arrivePickup),
        ),
      ],
    ];
  }

  Widget _idLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 2),
        child: Text(text.toUpperCase(),
            style: pickupText(10,
                weight: FontWeight.w700, color: PickupColors.faint)),
      );
}
