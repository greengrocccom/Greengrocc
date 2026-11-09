import 'dart:async';

import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../pickup_driver_service.dart';
import '../pickup_flow.dart';
import '../pickup_push_service.dart';
import '../widgets/pickup_ui.dart';
import 'farmer_qr_scan_screen.dart';
import 'pickup_detail_screen.dart';
import 'pickup_notifications_screen.dart';

/// Pickup driver dashboard — mirrors vendor `DriverHomePage`.
class PickupHomeScreen extends StatefulWidget {
  const PickupHomeScreen({super.key, required this.onOpenFilter});

  /// Jump to the Pickups tab with `assigned` / `progress` / `completed` / `history`.
  final ValueChanged<String> onOpenFilter;

  @override
  State<PickupHomeScreen> createState() => _PickupHomeScreenState();
}

class _PickupHomeScreenState extends State<PickupHomeScreen> {
  final _svc = PickupDriverService.instance;
  PickupListResult _data = PickupListResult.empty;
  List<Map<String, dynamic>> _announcements = [];
  bool _loading = true;
  StreamSubscription<void>? _watch;

  @override
  void initState() {
    super.initState();
    _load();
    _loadAnnouncements();
    _watch = _svc.watchPickups('all').listen((_) => _load());
    PickupPushService.instance.refreshTick.addListener(_load);
  }

  @override
  void dispose() {
    _watch?.cancel();
    PickupPushService.instance.refreshTick.removeListener(_load);
    super.dispose();
  }

  Future<void> _openNotifications() async {
    await Navigator.of(context)
        .push(pickupRoute<void>(const PickupNotificationsScreen()));
    if (mounted) PickupPushService.instance.refreshUnread();
  }

  Future<void> _load() async {
    try {
      final data = await _svc.listPickups('all');
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
      unawaited(PickupPushService.instance.checkNewAssignments(data.pickups));
    } catch (e) {
      if (!mounted) return;
      if (await handlePickupAuthError(context, e)) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _loadAnnouncements() async {
    try {
      final rows = await _svc.liveAnnouncements();
      if (mounted) setState(() => _announcements = rows);
    } catch (_) {}
  }

  Future<void> _refresh() async {
    await Future.wait([
      _load(),
      _loadAnnouncements(),
      PickupPushService.instance.refreshUnread(),
    ]);
  }

  Future<void> _open(Map<String, dynamic> p, {String? qr}) async {
    PickupPushService.instance.newAssignment.value = null;
    await Navigator.of(context).push(pickupRoute<void>(
        PickupDetailScreen(pickupId: str(p['id']), initialQr: qr)));
    if (mounted) _load();
  }

  /// At the farm: scan the Farmer QR and open the pickup it belongs to.
  Future<void> _scanAtFarm() async {
    final l10n = AppLocalizations.of(context);
    final value = await Navigator.of(context).push(pickupRoute<String>(
      FarmerQrScanScreen(orderLabel: l10n.pksScanQrShownByFarmer),
    ));
    if (value == null || value.trim().isEmpty || !mounted) return;
    var match = matchPickupForQr(value, _data.pickups);
    if (match == null) {
      await _load();
      if (!mounted) return;
      match = matchPickupForQr(value, _data.pickups);
    }
    if (match == null) {
      showPickupSnack(context, l10n.pksQrNoMatch, error: true);
      return;
    }
    await _open(match, qr: value);
  }

  @override
  Widget build(BuildContext context) {
    final recent = [..._data.pickups]
      ..sort((a, b) => pickupUpdatedMillis(b).compareTo(pickupUpdatedMillis(a)));
    final latest = recent.take(10).toList();
    final active = _data.pickups.where((p) {
      final step = driverNextStep(p);
      return step != null;
    }).toList();
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: PickupColors.page,
      body: SafeArea(
        child: RefreshIndicator(
          color: PickupColors.brand,
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.pksPickupDriverUpper,
                            style: pickupText(11,
                                weight: FontWeight.w800,
                                color: PickupColors.brand)),
                        const SizedBox(height: 2),
                        Text(_svc.driverName,
                            style: pickupText(22, weight: FontWeight.w800)),
                      ],
                    ),
                  ),
                  ListenableBuilder(
                    listenable: PickupPushService.instance,
                    builder: (context, _) {
                      final unread = PickupPushService.instance.unread;
                      return IconButton(
                        tooltip: l10n.notifications,
                        onPressed: _openNotifications,
                        icon: Badge(
                          isLabelVisible: unread > 0,
                          label: Text(unread > 99 ? '99+' : '$unread'),
                          child: const Icon(Icons.notifications_none_rounded,
                              size: 28, color: PickupColors.text),
                        ),
                      );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(l10n.pksHomeSubtitle,
                  style: pickupText(13, color: PickupColors.muted)),
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                      child:
                          CircularProgressIndicator(color: PickupColors.brand)),
                )
              else ...[
                ValueListenableBuilder<Map<String, dynamic>?>(
                  valueListenable: PickupPushService.instance.newAssignment,
                  builder: (context, fresh, _) => fresh == null
                      ? const SizedBox.shrink()
                      : Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: _NewAssignmentBanner(
                            pickup: fresh,
                            onOpen: () => _open(fresh),
                            onDismiss: () => PickupPushService
                                .instance.newAssignment.value = null,
                          ),
                        ),
                ),
                PickupStatsGrid(
                    stats: _data.stats, onTap: widget.onOpenFilter),
                if (_data.pickups.any(
                    (p) => farmScanStatuses.contains(str(p['status'])))) ...[
                  const SizedBox(height: 14),
                  PickupButton(
                    label: l10n.pksScanFarmerQr,
                    icon: Icons.qr_code_scanner_rounded,
                    onPressed: _scanAtFarm,
                  ),
                ],
                if (active.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  _NextUpCard(pickup: active.first, onOpen: _open),
                ],
              ],
              for (final a in _announcements.take(3)) ...[
                const SizedBox(height: 12),
                _AnnouncementCard(a),
              ],
              const SizedBox(height: 16),
              PickupCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 8, 6),
                      child: Row(
                        children: [
                          Text(l10n.recentOrders,
                              style: pickupText(14.5, weight: FontWeight.w800)),
                          const SizedBox(width: 8),
                          Text(l10n.pksLatestCount('10'),
                              style: pickupText(11.5,
                                  color: PickupColors.muted)),
                          const Spacer(),
                          TextButton(
                            onPressed: () => widget.onOpenFilter('history'),
                            child: Text(l10n.pksViewAll,
                                style: const TextStyle(color: PickupColors.brand)),
                          ),
                        ],
                      ),
                    ),
                    if (!_loading && latest.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 28),
                        child: Text(l10n.pksNoRecentPickups,
                            style: pickupText(13, color: PickupColors.faint)),
                      ),
                    for (final p in latest)
                      InkWell(
                        onTap: () => _open(p),
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          decoration: const BoxDecoration(
                            border: Border(
                                top: BorderSide(color: Color(0xFFF1F5F9))),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(pickupOrderId(p),
                                        style: pickupText(12,
                                            weight: FontWeight.w800,
                                            color: PickupColors.brand)),
                                  ),
                                  ConstrainedBox(
                                    constraints:
                                        const BoxConstraints(maxWidth: 150),
                                    child: StatusChip(pickupLiveLabel(p)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 5),
                              Text(
                                '${str(p['farmerName']).isEmpty ? '—' : str(p['farmerName'])} · ${str(p['productName']).isEmpty ? '—' : str(p['productName'])}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: pickupText(13.5,
                                    weight: FontWeight.w700),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${pickupQuantity(p)}${str(p['collectionBatchId']).isNotEmpty ? ' · ${str(p['collectionBatchId'])}' : ''}',
                                style: pickupText(11.5,
                                    color: PickupColors.muted),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NextUpCard extends StatelessWidget {
  const _NextUpCard({required this.pickup, required this.onOpen});

  final Map<String, dynamic> pickup;
  final ValueChanged<Map<String, dynamic>> onOpen;

  @override
  Widget build(BuildContext context) {
    final step = driverNextStep(pickup)!;
    final l10n = AppLocalizations.of(context);
    return PickupCard(
      color: PickupColors.brandSoft,
      borderColor: PickupColors.brand,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.pksNextUp,
              style: pickupText(10,
                  weight: FontWeight.w800, color: PickupColors.brand)),
          const SizedBox(height: 4),
          Text(
            '${pickupOrderId(pickup)} · ${str(pickup['farmerName'])}',
            style: pickupText(14.5, weight: FontWeight.w800),
          ),
          const SizedBox(height: 2),
          Text(
            '${pickupLiveLabel(pickup)} → ${step.label}',
            style: pickupText(12.5, color: PickupColors.muted),
          ),
          const SizedBox(height: 12),
          PickupButton(
            label: l10n.pksOpenPickup,
            icon: Icons.arrow_forward_rounded,
            onPressed: () => onOpen(pickup),
          ),
        ],
      ),
    );
  }
}

class _NewAssignmentBanner extends StatelessWidget {
  const _NewAssignmentBanner({
    required this.pickup,
    required this.onOpen,
    required this.onDismiss,
  });

  final Map<String, dynamic> pickup;
  final VoidCallback onOpen;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final farmer = str(pickup['farmerName']);
    final product = str(pickup['productName']);
    final when = pickupWhenText(pickup);
    final l10n = AppLocalizations.of(context);
    return PickupCard(
      color: const Color(0xFFFFF7ED),
      borderColor: const Color(0xFFFB923C),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.notifications_active_rounded,
                  color: Color(0xFFEA580C)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(l10n.pksNewPickupAssigned,
                    style: pickupText(15, weight: FontWeight.w800)),
              ),
              IconButton(
                tooltip: l10n.pksDismiss,
                visualDensity: VisualDensity.compact,
                onPressed: onDismiss,
                icon: const Icon(Icons.close_rounded, size: 20),
              ),
            ],
          ),
          Text(
            [
              pickupOrderId(pickup),
              if (farmer.isNotEmpty) farmer,
              if (product.isNotEmpty) product,
              pickupQuantity(pickup),
            ].join(' · '),
            style: pickupText(13, weight: FontWeight.w700),
          ),
          if (when.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(l10n.pksPickupWhen(when),
                style: pickupText(12, color: PickupColors.muted)),
          ],
          const SizedBox(height: 10),
          PickupButton(
            label: l10n.pksOpenPickup,
            icon: Icons.arrow_forward_rounded,
            onPressed: onOpen,
          ),
        ],
      ),
    );
  }
}

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard(this.row);
  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final title = str(row['title']);
    final body = str(row['message']).isNotEmpty
        ? str(row['message'])
        : str(row['body']).isNotEmpty
            ? str(row['body'])
            : str(row['content']);
    return PickupCard(
      color: const Color(0xFFFFFBEB),
      borderColor: const Color(0xFFFDE68A),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.campaign_outlined, color: Color(0xFFB45309)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title.isNotEmpty)
                  Text(title, style: pickupText(13.5, weight: FontWeight.w800)),
                if (body.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(body,
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                      style: pickupText(12.5, color: PickupColors.muted)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
