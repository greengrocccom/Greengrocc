import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/fulltime_service.dart';
import '../../../l10n/app_localizations.dart';
import 'fulltime_widgets.dart';

class AssignedOrdersScreen extends StatefulWidget {
  const AssignedOrdersScreen({super.key});

  @override
  State<AssignedOrdersScreen> createState() => _AssignedOrdersScreenState();
}

class _AssignedOrdersScreenState extends State<AssignedOrdersScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _active = const [];
  List<Map<String, dynamic>> _delivered = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  List<Map<String, dynamic>> _rows(dynamic raw) => (raw as List? ?? const [])
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await FullTimeService.instance.fetchAssignedOrders();
      if (!mounted) return;
      setState(() {
        _active = _rows(data['orders']);
        _delivered = _rows(data['deliveredToday']);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is FullTimeApiException ? e.message : AppLocalizations.of(context).delCouldNotLoadAssignedOrders;
        _loading = false;
      });
    }
  }

  Future<void> _openDelivery() async {
    await Navigator.pushNamed(context, AppRoutes.activeDelivery);
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: fullTimeAppBar(AppLocalizations.of(context).delAssignedOrders, onRefresh: _load),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? FtErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(onRefresh: _load, child: _content()),
    );
  }

  Widget _content() {
    final startedAny = _active.any((o) => o['pickupQrScanned'] == true || o['status'] != 'assigned');
    final l10n = AppLocalizations.of(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        FtSectionCard(
          child: Row(
            children: [
              Icon(Icons.assignment_outlined, color: AppColors.primary, size: 30),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _active.length == 1
                          ? l10n.delOrderAssignedCountOne(_active.length.toString())
                          : l10n.delOrdersAssignedCount(_active.length.toString()),
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      l10n.delDeliveredTodayAssignedByManager(_delivered.length.toString()),
                      style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (_active.isNotEmpty) ...[
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton.icon(
              onPressed: _openDelivery,
              icon: const Icon(Icons.delivery_dining_rounded),
              label: Text(startedAny ? l10n.continueDelivery : l10n.delStartDelivery),
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            ),
          ),
          const SizedBox(height: 14),
          ..._active.map((o) => _OrderTile(order: o)),
        ] else
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 36),
            child: Center(
              child: Text(
                l10n.delNoOrdersAssignedHint,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 14, color: AppColors.textMuted),
              ),
            ),
          ),
        if (_delivered.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            l10n.delDeliveredToday,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          ..._delivered.map((o) => _OrderTile(order: o)),
        ],
      ],
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order});
  final Map<String, dynamic> order;

  String _statusLabel(AppLocalizations l10n) => switch (order['status']?.toString()) {
        'assigned' => order['pickupQrScanned'] == true ? l10n.pickedUp : l10n.delReadyForPickup,
        'pickup_verified' => l10n.delPickupVerified,
        'out_for_delivery' => l10n.outForDelivery,
        'delivered' => l10n.delivered,
        final s => (s ?? '').replaceAll('_', ' '),
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isPreOrder = order['isPreOrder'] == true;
    final address = order['customerAddress']?.toString() ?? '';
    final amount = (order['amountToCollect'] as num?) ?? 0;
    final rawPayment = order['paymentMethod']?.toString().toUpperCase() ?? '';
    final payment = rawPayment == 'ONLINE' ? l10n.online : rawPayment;
    final delivered = order['status'] == 'delivered';

    return FtSectionCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '#${order['orderNumber'] ?? ''}',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Text(
                _statusLabel(l10n),
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: delivered ? AppColors.success : AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              if (isPreOrder)
                _Tag(
                  text: '${l10n.delPreOrder}${(order['preOrderSlot'] ?? '').toString().isNotEmpty ? ' · ${order['preOrderSlot']}' : ''}',
                  color: AppColors.warning,
                ),
              _Tag(text: l10n.itemsCount((order['itemCount'] as num?)?.toInt() ?? 0), color: AppColors.textMuted),
              if (amount > 0) _Tag(text: '${formatRupees(amount)} $payment', color: AppColors.textMuted),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            address.isNotEmpty
                ? address
                : delivered
                    ? (order['area']?.toString() ?? '')
                    : l10n.delAddressUnlocksAfterPickupVerification,
            style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        text,
        style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
