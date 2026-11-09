import 'package:flutter/material.dart';

import '../../core/routes/app_routes.dart';
import '../../l10n/app_localizations.dart';
import '../pickup_driver_service.dart';
import '../pickup_flow.dart';
import '../pickup_push_service.dart';
import '../widgets/pickup_ui.dart';

/// Driver profile, live policies and logout.
class PickupProfileScreen extends StatefulWidget {
  const PickupProfileScreen({super.key});

  @override
  State<PickupProfileScreen> createState() => _PickupProfileScreenState();
}

class _PickupProfileScreenState extends State<PickupProfileScreen> {
  final _svc = PickupDriverService.instance;
  List<Map<String, dynamic>> _policies = [];
  bool _loadingPolicies = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      await _svc.fetchMe();
      if (mounted) setState(() {});
    } catch (e) {
      if (!mounted) return;
      if (await handlePickupAuthError(context, e)) return;
    }
    try {
      final rows = await _svc.livePolicies();
      if (mounted) setState(() => _policies = rows);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingPolicies = false);
    }
  }

  Future<void> _logout() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.pksLogOutTitle),
        content: Text(l10n.pksLogOutBody),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l10n.cancel)),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: PickupColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.pksLogOut),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await PickupPushService.instance.stop();
    await _svc.logout();
    if (!mounted) return;
    Navigator.of(context)
        .pushNamedAndRemoveUntil(AppRoutes.login, (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final d = _svc.driver ?? const <String, dynamic>{};
    final name = _svc.driverName;
    final vehicle = [str(d['vehicleNumber']), str(d['vehicleType'])]
        .where((s) => s.isNotEmpty)
        .join(' · ');
    final l10n = AppLocalizations.of(context);
    final status = str(d['status']);
    final statusLabel = switch (status.toLowerCase()) {
      'active' => l10n.active,
      'inactive' => l10n.pksStatusInactive,
      _ => status,
    };

    return Scaffold(
      backgroundColor: PickupColors.page,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: Text(l10n.profile, style: pickupText(17, weight: FontWeight.w800)),
      ),
      body: RefreshIndicator(
        color: PickupColors.brand,
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
          children: [
            PickupCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: PickupColors.brandSoft,
                    child: Text(
                      name.isEmpty ? '?' : name[0].toUpperCase(),
                      style: pickupText(22,
                          weight: FontWeight.w800, color: PickupColors.brand),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            style: pickupText(17, weight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text(l10n.pksProfileRole,
                            style:
                                pickupText(12.5, color: PickupColors.muted)),
                        if (status.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          StatusChip(statusLabel),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            PickupCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SectionTitle(l10n.detailsAction),
                  InfoGrid([
                    InfoItem(l10n.pksMobile, str(d['mobile'])),
                    InfoItem(l10n.pksDriverId,
                        str(d['driverId']).isNotEmpty ? str(d['driverId']) : str(d['id']),
                        copy: true),
                    InfoItem(l10n.vehicle, vehicle),
                    InfoItem(
                        l10n.pksVehicleId,
                        formatVehicleId(d['vehicleId'], d['vehicleNumber']),
                        copy: true),
                    if (str(d['licenseNumber']).isNotEmpty)
                      InfoItem(l10n.license, str(d['licenseNumber'])),
                    if (str(d['assignedArea']).isNotEmpty)
                      InfoItem(l10n.pksArea, str(d['assignedArea'])),
                  ]),
                ],
              ),
            ),
            const SizedBox(height: 14),
            PickupCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SectionTitle(l10n.pksPolicies),
                  if (_loadingPolicies)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(
                            color: PickupColors.brand),
                      ),
                    )
                  else if (_policies.isEmpty)
                    Text(l10n.pksNoPolicies,
                        style: pickupText(13, color: PickupColors.faint))
                  else
                    for (final p in _policies)
                      Theme(
                        data: Theme.of(context)
                            .copyWith(dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          childrenPadding:
                              const EdgeInsets.only(bottom: 12),
                          title: Text(
                            str(p['title']).isEmpty ? l10n.pksPolicy : str(p['title']),
                            style: pickupText(14, weight: FontWeight.w700),
                          ),
                          expandedCrossAxisAlignment:
                              CrossAxisAlignment.start,
                          children: [
                            Text(str(p['body']),
                                style: pickupText(13,
                                    color: PickupColors.muted, height: 1.45)),
                          ],
                        ),
                      ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: _logout,
              icon: const Icon(Icons.logout_rounded),
              label: Text(l10n.pksLogOut),
              style: OutlinedButton.styleFrom(
                foregroundColor: PickupColors.error,
                side: const BorderSide(color: PickupColors.error),
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
