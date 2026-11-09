import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../pickup_flow.dart';
import 'pickup_ui.dart';

/// Every item in the order — name, grade, weight, rate and amount — plus
/// packed weight and package count, for checking goods with the farmer.
class PickupItemsTable extends StatelessWidget {
  const PickupItemsTable({super.key, required this.pickup});

  final Map<String, dynamic> pickup;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final p = pickup;
    final items = pickupItems(p);
    final unit = pickupUnitText(str(p['unit']).isEmpty ? 'Kg' : str(p['unit']));
    final totalQty = items.fold<num>(0, (s, i) => s + i.quantity);
    final itemsTotal = items.fold<num>(0, (s, i) => s + i.total);
    final orderValue = num.tryParse(str(p['orderValue'])) ?? 0;
    final totalValue = itemsTotal > 0 ? itemsTotal : orderValue;
    final packed = num.tryParse(str(p['packedQuantity'])) ?? 0;
    final pkgs = str(p['packageCount']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < items.length; i++)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              border: i == 0
                  ? null
                  : const Border(top: BorderSide(color: Color(0xFFF1F5F9))),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: PickupColors.brandSoft,
                    shape: BoxShape.circle,
                  ),
                  child: Text('${i + 1}',
                      style: pickupText(12,
                          weight: FontWeight.w800, color: PickupColors.brand)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(items[i].name,
                          style: pickupText(14, weight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(
                        [
                          if (items[i].grade.isNotEmpty) items[i].grade,
                          if (items[i].price > 0)
                            '${formatRupees(items[i].price)}/${items[i].unit}',
                        ].join(' · ').ifEmpty('—'),
                        style: pickupText(12, color: PickupColors.muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${formatQty(items[i].quantity)} ${items[i].unit}',
                        style: pickupText(14, weight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(formatRupees(items[i].total),
                        style: pickupText(12, color: PickupColors.muted)),
                  ],
                ),
              ],
            ),
          ),
        const Divider(height: 18),
        _totalRow(l10n.pkTotalWeightOrdered, '${formatQty(totalQty)} $unit'),
        if (packed > 0)
          _totalRow(l10n.pkPackedWeight, '${formatQty(packed)} $unit'),
        if (pkgs.isNotEmpty && pkgs != '0') _totalRow(l10n.pkPackages, pkgs),
        _totalRow(l10n.pkOrderValue, formatRupees(totalValue), bold: true),
      ],
    );
  }

  Widget _totalRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: pickupText(12.5, color: PickupColors.muted)),
          ),
          Text(value,
              style: pickupText(bold ? 15 : 13,
                  weight: bold ? FontWeight.w800 : FontWeight.w700,
                  color: bold ? PickupColors.brand : PickupColors.text)),
        ],
      ),
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
