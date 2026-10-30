import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/utils/department_utils.dart';
import '../../models/dark_store.dart';
import '../../models/store_settings.dart';

abstract final class FulfillmentType {
  static const delivery = 'delivery';
  static const pickup = 'pickup';
}

/// Promise shown next to each department group on checkout.
String departmentEtaText(
  String department, {
  required bool pickup,
  String? preOrderSlot,
}) {
  if (department == Department.preorder) {
    final slot = preOrderSlot?.trim() ?? '';
    if (slot.isEmpty) return 'Tomorrow · choose a slot below';
    return pickup ? 'Pick up tomorrow, $slot' : 'Delivered tomorrow, $slot';
  }
  return pickup ? 'Ready for pickup in 10–20 min' : 'Delivered in 10–20 min';
}

class FulfillmentChoice extends StatelessWidget {
  const FulfillmentChoice({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ChoiceCard(
            selected: value == FulfillmentType.delivery,
            icon: Icons.delivery_dining_rounded,
            title: 'Home delivery',
            subtitle: 'Rider brings it to your address',
            onTap: () => onChanged(FulfillmentType.delivery),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ChoiceCard(
            selected: value == FulfillmentType.pickup,
            icon: Icons.storefront_rounded,
            title: 'Store pickup',
            subtitle: 'Collect from the dark store · no delivery fee',
            onTap: () => onChanged(FulfillmentType.pickup),
          ),
        ),
      ],
    );
  }
}

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFECFDF5) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? const Color(0xFF047857) : const Color(0xFFE2E8F0),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  icon,
                  size: 22,
                  color: selected ? const Color(0xFF047857) : const Color(0xFF64748B),
                ),
                const Spacer(),
                Icon(
                  selected ? Icons.radio_button_checked : Icons.radio_button_off,
                  size: 18,
                  color: selected ? const Color(0xFF047857) : const Color(0xFFCBD5E1),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w800,
                fontSize: 13.5,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dark store that fulfils the order, with a tap-to-call number.
class DarkStoreContactCard extends StatelessWidget {
  const DarkStoreContactCard({
    super.key,
    required this.store,
    required this.pickup,
    this.loading = false,
  });

  final DarkStore? store;
  final bool pickup;
  final bool loading;

  Future<void> _call(String phone) async {
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.isEmpty) return;
    await launchUrl(
      Uri.parse('tel:${digits.startsWith('+') ? digits : '+91$digits'}'),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    final s = store;
    if (s == null) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7ED),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFED7AA)),
        ),
        child: Text(
          'No dark store serves this location yet. Change your delivery location to continue.',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF9A3412),
          ),
        ),
      );
    }

    final distance = s.distanceKm != null ? ' · ${s.distanceKm!.toStringAsFixed(1)} km away' : '';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: Color(0xFFDCFCE7),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.storefront_rounded, size: 20, color: Color(0xFF047857)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pickup ? 'Pick up from' : 'Delivered from',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF64748B),
                  ),
                ),
                Text(
                  '${s.storeName}$distance',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                if (s.address.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    s.address,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      color: const Color(0xFF475569),
                      height: 1.35,
                    ),
                  ),
                ],
                if (s.phone.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Store manager: +91 ${s.phone}',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (s.phone.isNotEmpty)
            IconButton.filledTonal(
              tooltip: 'Call store',
              onPressed: () => _call(s.phone),
              icon: const Icon(Icons.call_rounded, size: 20),
            ),
        ],
      ),
    );
  }
}

/// Next-day pre-order slot chooser (slots come from store settings).
class PreOrderSlotPicker extends StatelessWidget {
  const PreOrderSlotPicker({
    super.key,
    required this.slots,
    required this.selected,
    required this.onSelected,
  });

  final List<PreOrderSlot> slots;
  final String? selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) {
      return Text(
        'No pre-order slots are open right now. Please try again later.',
        style: GoogleFonts.plusJakartaSans(fontSize: 12.5, color: const Color(0xFF9A3412)),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Pre-order items are delivered tomorrow. Pick a time slot:',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: const Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final slot in slots)
              ChoiceChip(
                label: Text(slot.label),
                selected: selected == slot.label,
                onSelected: (_) => onSelected(slot.label),
                showCheckmark: true,
                checkmarkColor: const Color(0xFF047857),
                backgroundColor: Colors.white,
                selectedColor: const Color(0xFFECFDF5),
                shape: const StadiumBorder(),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                labelStyle: GoogleFonts.plusJakartaSans(
                  fontSize: 12.5,
                  fontWeight: selected == slot.label ? FontWeight.w700 : FontWeight.w600,
                  color: selected == slot.label ? const Color(0xFF047857) : const Color(0xFF334155),
                ),
                side: BorderSide(
                  color: selected == slot.label ? const Color(0xFF047857) : const Color(0xFFE2E8F0),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Header above each department's items in the order summary.
class DepartmentGroupHeader extends StatelessWidget {
  const DepartmentGroupHeader({
    super.key,
    required this.department,
    required this.itemCount,
    required this.etaText,
  });

  final String department;
  final int itemCount;
  final String etaText;

  @override
  Widget build(BuildContext context) {
    final color = departmentColor(department);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(departmentIcon(department), size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${departmentLabel(department)} · $itemCount item${itemCount == 1 ? '' : 's'}',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
                Text(
                  etaText,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF475569),
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
