import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../pickup_driver_service.dart';
import '../pickup_flow.dart';
import '../pickup_push_service.dart';
import '../widgets/pickup_ui.dart';
import 'pickup_detail_screen.dart';

/// Notifications sent to this pickup driver (assignments, centre receipts,
/// account changes made by the vendor / farmer manager).
class PickupNotificationsScreen extends StatefulWidget {
  const PickupNotificationsScreen({super.key});

  @override
  State<PickupNotificationsScreen> createState() =>
      _PickupNotificationsScreenState();
}

class _PickupNotificationsScreenState extends State<PickupNotificationsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
    PickupPushService.instance.refreshTick.addListener(_load);
  }

  @override
  void dispose() {
    PickupPushService.instance.refreshTick.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await PickupDriverService.instance.notifications();
      if (!mounted) return;
      setState(() {
        _items = res.items;
        _loading = false;
        _error = '';
      });
      if (res.unread > 0) await PickupPushService.instance.markAllRead();
    } catch (e) {
      if (!mounted) return;
      if (await handlePickupAuthError(context, e)) return;
      setState(() {
        _loading = false;
        _error = pickupErrorText(e);
      });
    }
  }

  String _ago(String iso) {
    final at = DateTime.tryParse(iso)?.toLocal();
    if (at == null) return '';
    final l10n = AppLocalizations.of(context);
    final diff = DateTime.now().difference(at);
    if (diff.inMinutes < 1) return l10n.pkJustNow;
    if (diff.inMinutes < 60) return l10n.pkMinutesAgo('${diff.inMinutes}');
    if (diff.inHours < 24) return l10n.pkHoursAgo('${diff.inHours}');
    return '${at.day.toString().padLeft(2, '0')}/${at.month.toString().padLeft(2, '0')}/${at.year}';
  }

  IconData _icon(Map<String, dynamic> n) {
    final event = str((n['data'] is Map ? n['data']['event'] : null) ?? '');
    if (event == 'PICKUP_RECEIVED') return Icons.warehouse_outlined;
    if (event == 'PICKUP_UNASSIGNED') return Icons.swap_horiz_rounded;
    if (str(n['type']) == 'ACCOUNT') return Icons.person_outline_rounded;
    return Icons.local_shipping_outlined;
  }

  Future<void> _open(Map<String, dynamic> n) async {
    final data = n['data'] is Map ? Map<String, dynamic>.from(n['data'] as Map) : {};
    final pickupId = str(data['pickupId']);
    if (pickupId.isEmpty || str(data['event']) == 'PICKUP_UNASSIGNED') return;
    await Navigator.of(context)
        .push(pickupRoute<void>(PickupDetailScreen(pickupId: pickupId)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PickupColors.page,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: Text(AppLocalizations.of(context).notifications,
            style: pickupText(17, weight: FontWeight.w800)),
      ),
      body: RefreshIndicator(
        color: PickupColors.brand,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
          children: [
            if (_error.isNotEmpty) ...[ErrorBanner(_error), const SizedBox(height: 12)],
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 40),
                child: Center(
                    child: CircularProgressIndicator(color: PickupColors.brand)),
              )
            else if (_items.isEmpty)
              EmptyState(
                AppLocalizations.of(context).pkNotificationsEmpty,
                icon: Icons.notifications_none_rounded,
              )
            else
              for (final n in _items) ...[
                InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => _open(n),
                  child: PickupCard(
                    color: n['read'] == true
                        ? PickupColors.card
                        : PickupColors.brandSoft,
                    borderColor: n['read'] == true
                        ? PickupColors.border
                        : PickupColors.line,
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: Colors.white,
                          child: Icon(_icon(n),
                              size: 20, color: PickupColors.brand),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(str(n['title']),
                                  style: pickupText(14,
                                      weight: FontWeight.w800)),
                              if (str(n['body']).isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Text(str(n['body']),
                                    style: pickupText(12.5,
                                        color: PickupColors.muted)),
                              ],
                              const SizedBox(height: 4),
                              Text(_ago(str(n['createdAt'])),
                                  style: pickupText(11,
                                      color: PickupColors.faint)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }
}
