import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/order_service.dart';
import '../../../data/services/socket_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../../utils/map_navigation.dart';
import '../active_delivery/delivery_sheets.dart';
import '../active_delivery/pickup_qr_scan_screen.dart';
import '../fulltime/fulltime_widgets.dart';

/// Every pre-order the Delivery Manager assigned to this rider. The rider scans the QR on
/// each bag at the store to see that customer's address; once an order is delivered its
/// customer phone and address disappear from the list.
class PreOrderDeliveriesScreen extends StatefulWidget {
  const PreOrderDeliveriesScreen({super.key});

  @override
  State<PreOrderDeliveriesScreen> createState() => _PreOrderDeliveriesScreenState();
}

class _PreOrderDeliveriesScreenState extends State<PreOrderDeliveriesScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _store;
  Map<String, dynamic> _summary = const {};
  List<Map<String, dynamic>> _orders = const [];
  StreamSubscription<Map<String, dynamic>>? _deliverySub;
  Timer? _refreshDebounce;

  @override
  void initState() {
    super.initState();
    _load();
    _deliverySub = SocketService.instance.onActiveDeliveryUpdated.listen((_) {
      _refreshDebounce?.cancel();
      _refreshDebounce = Timer(const Duration(milliseconds: 400), () {
        if (mounted) _load(silent: true);
      });
    });
  }

  @override
  void dispose() {
    _deliverySub?.cancel();
    _refreshDebounce?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    final data = await OrderService.instance.fetchPreOrders();
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (data == null) {
        if (!silent) _error = AppLocalizations.of(context).couldNotLoadPreOrders;
        return;
      }
      _error = null;
      _store = data['store'] is Map ? Map<String, dynamic>.from(data['store'] as Map) : null;
      _summary = data['summary'] is Map ? Map<String, dynamic>.from(data['summary'] as Map) : const {};
      _orders = (data['orders'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    });
  }

  Future<void> _reportEmergency(Map<String, dynamic> order) async {
    final id = order['id']?.toString();
    if (id == null || id.isEmpty) return;
    final reason = await showDeliveryFailedSheet(context, emergency: true, pickupStarted: order['scanned'] == true);
    if (!mounted || reason == null || reason.isEmpty) return;
    final result = await OrderService.instance.failDelivery(id, failureReason: reason, emergency: true);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(result.success ? 'Emergency sent to your Delivery Manager.' : result.error ?? 'Could not send emergency report.'),
    ));
    if (result.success) await _load(silent: true);
  }

  Widget _withEmergencyAction(Map<String, dynamic> order, Widget tile) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        tile,
        TextButton.icon(
          onPressed: () => _reportEmergency(order),
          icon: const Icon(Icons.report_problem_outlined, size: 17),
          label: const Text('Report emergency'),
          style: TextButton.styleFrom(foregroundColor: const Color(0xFF9A3412)),
        ),
      ],
    );
  }

  Future<void> _scanBags() async {
    final unlocked = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => const PickupQrScanScreen(orderId: '', orderNumber: '', preOrderBatch: true),
      ),
    );
    if (mounted) {
      await _load(silent: true);
      if (unlocked == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).addressesUnlocked),
            backgroundColor: const Color(0xFF059669),
          ),
        );
      }
    }
  }

  Future<void> _deliver(Map<String, dynamic> order) async {
    await Navigator.pushNamed(context, AppRoutes.activeDelivery, arguments: order['id']?.toString());
    if (mounted) _load(silent: true);
  }

  Future<void> _call(String phone) async {
    if (phone.isEmpty) return;
    await launchUrl(Uri(scheme: 'tel', path: phone));
  }

  Future<void> _navigate(Map<String, dynamic> order) async {
    await openMapsNavigation(
      destLat: (order['customerLat'] as num?)?.toDouble(),
      destLng: (order['customerLng'] as num?)?.toDouble(),
      fallbackAddress: order['customerAddress']?.toString() ?? '',
    );
  }

  int _n(String key) => (_summary[key] as num?)?.toInt() ?? 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: fullTimeAppBar(AppLocalizations.of(context).preOrderDeliveriesTitle, onRefresh: _load),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? FtErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(onRefresh: _load, child: _content()),
    );
  }

  Widget _content() {
    final toScan = _orders.where((o) => o['status'] == 'assigned').toList();
    final onTheWay = _orders
        .where((o) => o['status'] == 'out_for_delivery' || o['status'] == 'pickup_verified')
        .toList();
    final done = _orders.where((o) => o['delivered'] == true || o['failed'] == true).toList();
    final total = _n('total');
    final delivered = _n('delivered');

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 20),
      children: [
        FtSectionCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                total == 0
                    ? l10n.noPreOrdersAssigned
                    : l10n.preOrdersAssignedToYou(total),
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              if (_store != null) ...[
                const SizedBox(height: 2),
                Text(
                  l10n.collectAtStore((_store!['name'] ?? l10n.theDarkStore).toString()) +
                      ((_store!['address'] ?? '').toString().isNotEmpty ? ' · ${_store!['address']}' : ''),
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
              if (total > 0) ...[
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: total == 0 ? 0 : delivered / total,
                    minHeight: 6,
                    backgroundColor: isDark ? const Color(0xFF334155) : AppColors.border,
                    color: isDark ? const Color(0xFF34D399) : AppColors.success,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  l10n.preOrderProgressLine(delivered, _n('outForDelivery'), _n('toScan')) +
                      (_n('failed') > 0 ? ' · ${l10n.failedCount(_n('failed'))}' : ''),
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
              const SizedBox(height: 6),
              Text(
                l10n.preOrdersSalaryBased,
                style: GoogleFonts.inter(fontSize: 10.5, color: AppColors.textMuted),
              ),
            ],
          ),
        ),
        if (toScan.isNotEmpty) ...[
          SizedBox(
            width: double.infinity,
            height: 40,
            child: FilledButton.icon(
              onPressed: _scanBags,
              icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
              label: Text(
                l10n.scanOrderQrsLeft(toScan.length),
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
        if (total == 0)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 36),
            child: Center(
              child: Text(
                l10n.preOrdersEmptyHint,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted),
              ),
            ),
          ),
        if (onTheWay.isNotEmpty) ...[
          _SectionTitle('🛵 ${l10n.outForDelivery} (${onTheWay.length})'),
          ...onTheWay.map(
            (o) => _withEmergencyAction(o, _UnlockedTile(
              order: o,
              onCall: () => _call(o['customerPhone']?.toString() ?? ''),
              onNavigate: () => _navigate(o),
              onDeliver: () => _deliver(o),
            )),
          ),
        ],
        if (toScan.isNotEmpty) ...[
          _SectionTitle('🔒 ${l10n.atStoreScanToSeeAddress} (${toScan.length})'),
          ...toScan.map((o) => _withEmergencyAction(o, _LockedTile(order: o))),
        ],
        if (done.isNotEmpty) ...[
          _SectionTitle('✅ ${l10n.finishedToday} (${done.length})'),
          ...done.map((o) => _DoneTile(order: o)),
        ],
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 6, 2, 6),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}

String _paymentLine(AppLocalizations l10n, Map<String, dynamic> o) {
  final amount = (o['amountToCollect'] as num?) ?? 0;
  if (o['paymentStatus'] == 'paid_online' || amount <= 0) return l10n.paidOnline;
  return l10n.collectCashAmount(formatRupees(amount));
}

class _OrderHeader extends StatelessWidget {
  const _OrderHeader({required this.order, required this.status, required this.statusColor});
  final Map<String, dynamic> order;
  final String status;
  final Color statusColor;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final slot = (order['preOrderSlot'] ?? '').toString();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                '#${order['orderNumber'] ?? ''}',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: isDark ? 0.2 : 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                status,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: statusColor,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 3),
        Text(
          [
            if (slot.isNotEmpty) l10n.slotLabel(slot),
            l10n.itemsCount((order['itemCount'] as num?)?.toInt() ?? 0),
            _paymentLine(l10n, order),
          ].join(' · '),
          style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
        ),
      ],
    );
  }
}

class _LockedTile extends StatelessWidget {
  const _LockedTile({required this.order});
  final Map<String, dynamic> order;

  @override
  Widget build(BuildContext context) {
    return FtSectionCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _OrderHeader(order: order, status: AppLocalizations.of(context).scanQr, statusColor: AppColors.warning),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.lock_outline_rounded, size: 14, color: AppColors.textMuted),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  AppLocalizations.of(context).scanBagQrHint,
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _UnlockedTile extends StatelessWidget {
  const _UnlockedTile({
    required this.order,
    required this.onCall,
    required this.onNavigate,
    required this.onDeliver,
  });
  final Map<String, dynamic> order;
  final VoidCallback onCall;
  final VoidCallback onNavigate;
  final VoidCallback onDeliver;

  @override
  Widget build(BuildContext context) {
    final name = order['customerName']?.toString() ?? '';
    final phone = order['customerPhone']?.toString() ?? '';
    final address = order['customerAddress']?.toString() ?? '';
    return FtSectionCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _OrderHeader(order: order, status: AppLocalizations.of(context).outForDelivery, statusColor: AppColors.primary),
          const SizedBox(height: 8),
          Text(
            name.isEmpty ? AppLocalizations.of(context).customer : name,
            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          if (phone.isNotEmpty)
            Text(phone, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary)),
          if (address.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(address, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary)),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              if (phone.isNotEmpty) ...[
                SizedBox(
                  height: 30,
                  child: OutlinedButton.icon(
                    onPressed: onCall,
                    icon: const Icon(Icons.call_rounded, size: 14),
                    label: Text(AppLocalizations.of(context).callAction, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              SizedBox(
                height: 30,
                child: OutlinedButton.icon(
                  onPressed: onNavigate,
                  icon: const Icon(Icons.navigation_rounded, size: 14),
                  label: Text(AppLocalizations.of(context).map, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const Spacer(),
              SizedBox(
                height: 30,
                child: FilledButton(
                  onPressed: onDeliver,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: Text(AppLocalizations.of(context).deliverAction, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DoneTile extends StatelessWidget {
  const _DoneTile({required this.order});
  final Map<String, dynamic> order;

  @override
  Widget build(BuildContext context) {
    final failed = order['failed'] == true;
    final at = DateTime.tryParse(order['deliveredAt']?.toString() ?? '')?.toLocal();
    final time = at == null
        ? ''
        : ' · ${at.hour % 12 == 0 ? 12 : at.hour % 12}:${at.minute.toString().padLeft(2, '0')} ${at.hour < 12 ? 'AM' : 'PM'}';
    return Opacity(
      opacity: 0.8,
      child: FtSectionCard(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: _OrderHeader(
          order: order,
          status: failed ? AppLocalizations.of(context).failedStatus : '${AppLocalizations.of(context).delivered}$time',
          statusColor: failed ? AppColors.error : AppColors.success,
        ),
      ),
    );
  }
}
