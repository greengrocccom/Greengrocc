import 'package:flutter/material.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/cards/order_card.dart';
import '../../widgets/layout/custom_app_bar.dart';

class NewOrdersScreen extends StatelessWidget {
  const NewOrdersScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final body = ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        OrderCard(
          storeName: l10n.placeholderStoreName,
          customerName: l10n.placeholderCustomerName,
          pickupAddress: l10n.placeholderPickupAddressLine,
          dropAddress: l10n.placeholderDropAddressLine,
          distance: l10n.placeholderDistanceKm,
          estimatedEarnings: l10n.placeholderEarnings,
          estimatedTime: l10n.placeholderTimeMin,
        ),
        const SizedBox(height: AppSpacing.md),
        OrderCard(
          storeName: l10n.placeholderStoreName,
          customerName: l10n.placeholderCustomerName,
          pickupAddress: l10n.placeholderPickupAddressLine,
          dropAddress: l10n.placeholderDropAddressLine,
          distance: l10n.placeholderDistanceKm,
          estimatedEarnings: l10n.placeholderEarnings,
          estimatedTime: l10n.placeholderTimeMin,
        ),
        const SizedBox(height: AppSpacing.md),
        OrderCard(
          storeName: l10n.placeholderStoreName,
          customerName: l10n.placeholderCustomerName,
          pickupAddress: l10n.placeholderPickupAddressLine,
          dropAddress: l10n.placeholderDropAddressLine,
          distance: l10n.placeholderDistanceKm,
          estimatedEarnings: l10n.placeholderEarnings,
          estimatedTime: l10n.placeholderTimeMin,
        ),
      ],
    );

    if (embedded) return body;

    return Scaffold(
      appBar: CustomAppBar(
        title: l10n.newOrders,
        subtitle: l10n.newOrdersSubtitle,
        showBackButton: true,
      ),
      body: body,
    );
  }
}
