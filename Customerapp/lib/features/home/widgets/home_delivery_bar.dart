import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/providers/location_provider.dart';
import '../../../core/theme/store_chrome.dart';
import '../../../routes/route_paths.dart';
import '../../../widgets/address/select_delivery_location_sheet.dart';
import '../../auth/auth_controller.dart';
import '../../auth/auth_host.dart';
import '../../orders/orders_controller.dart';
import '../home_providers.dart';
import 'home_header_category_strip.dart';

/// Website `HomeDeliveryBar`: logo, lifetime spend and profile, then the
/// compact PreOrder / Ready2Cook / InstantOrder switcher.
class HomeDeliveryBar extends ConsumerWidget {
  const HomeDeliveryBar({super.key});

  static const double height = 112;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentStore = ref.watch(selectedStoreTabProvider);
    final accent = StoreChrome.forStore(currentStore).tabAccent;

    return SizedBox(
      height: height,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 36,
              child: Row(
                children: [
                  Flexible(
                    child: GestureDetector(
                      onTap: () => context.go(RoutePaths.home),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 130),
                        child: Image.asset(
                          'assets/images/web_logo.png',
                          height: 32,
                          fit: BoxFit.contain,
                          alignment: Alignment.centerLeft,
                        ),
                      ),
                    ),
                  ),
                  const Spacer(),
                  const LifetimeOrderSpend(),
                  const SizedBox(width: 6),
                  _ProfileButton(accent: accent),
                ],
              ),
            ),
            const SizedBox(height: 4),
            const _DeliveryLocationLine(),
            const SizedBox(height: 6),
            Container(
              height: 38,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: const Color(0x0D0F172A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  _StoreTab(
                    label: 'PreOrder',
                    icon: Icons.calendar_month_outlined,
                    selected: currentStore == 'main',
                    accent: StoreChrome.forStore('main').tabAccent,
                    onTap: () => _selectStore(context, ref, 'main'),
                  ),
                  const SizedBox(width: 4),
                  _StoreTab(
                    label: 'Ready2Cook',
                    icon: Icons.soup_kitchen_outlined,
                    selected: currentStore == 'festive',
                    accent: StoreChrome.forStore('festive').tabAccent,
                    onTap: () => _selectStore(context, ref, 'festive'),
                  ),
                  const SizedBox(width: 4),
                  _StoreTab(
                    label: 'InstantOrder',
                    icon: Icons.bolt_outlined,
                    selected: currentStore == 'mall',
                    accent: StoreChrome.forStore('mall').tabAccent,
                    onTap: () => _selectStore(context, ref, 'mall'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _selectStore(BuildContext context, WidgetRef ref, String store) {
    ref.read(selectedStoreTabProvider.notifier).setStore(store);
    ref.read(selectedCategoryHeaderTabProvider.notifier).setCategory('All');
    context.go(RoutePaths.home);
  }
}

/// "📍 Balewadi, Pune ▾" under the logo; opens the delivery location sheet.
class _DeliveryLocationLine extends ConsumerWidget {
  const _DeliveryLocationLine();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = ref.watch(deliveryLocationProvider);
    final place = [location?.area, location?.city]
        .whereType<String>()
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toSet()
        .join(', ');
    final hasLocation = location?.hasLocation ?? false;
    final label = !hasLocation
        ? 'Select delivery location'
        : place.isNotEmpty
            ? place
            : location!.displayAddress;

    return SizedBox(
      height: 20,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => showSelectDeliveryLocationBottomSheet(context, ref),
        child: Row(
          children: [
            const Icon(Icons.location_on_rounded, size: 16, color: Color(0xFF0C831F)),
            const SizedBox(width: 3),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: hasLocation ? const Color(0xFF0F172A) : const Color(0xFF0C831F),
                ),
              ),
            ),
            const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: Color(0xFF0F172A)),
          ],
        ),
      ),
    );
  }
}

/// Website `LifetimeOrderSpend compact`: "ORDERED ₹1,234" for signed-in users.
class LifetimeOrderSpend extends ConsumerWidget {
  const LifetimeOrderSpend({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loggedIn = ref.watch(authControllerProvider.select((s) => s.isLoggedIn));
    final orders = ref.watch(ordersControllerProvider);
    if (!loggedIn || !orders.hasLoaded) return const SizedBox.shrink();

    var spent = 0.0;
    for (final order in orders.orders) {
      final status = order.status.toLowerCase();
      if (status == 'cancelled' || status == 'return' || status == 'attempted') continue;
      spent += order.total;
    }

    return GestureDetector(
      onTap: () => context.go(RoutePaths.orders),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 92),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              'ORDERED',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.45,
                color: const Color(0xFF64748B),
                height: 1.2,
              ),
            ),
            Text(
              '₹${_formatInr(spent)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF0C831F),
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _formatInr(double value) {
    final digits = value.round().toString();
    if (digits.length <= 3) return digits;
    final last3 = digits.substring(digits.length - 3);
    var rest = digits.substring(0, digits.length - 3);
    final parts = <String>[];
    while (rest.length > 2) {
      parts.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) parts.insert(0, rest);
    return '${parts.join(',')},$last3';
  }
}

class _ProfileButton extends ConsumerWidget {
  const _ProfileButton({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () {
        if (ref.read(authControllerProvider).isLoggedIn) {
          context.go(RoutePaths.profile);
        } else {
          showAuthModalBottomSheet(context, ref, redirectRoute: RoutePaths.profile);
        }
      },
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(color: Color(0x140F172A), blurRadius: 3, offset: Offset(0, 1)),
          ],
        ),
        child: Icon(Icons.person_outline_rounded, size: 19, color: accent),
      ),
    );
  }
}

/// One segment of the store switcher — white card with the store accent when active.
class _StoreTab extends StatelessWidget {
  const _StoreTab({
    required this.label,
    required this.icon,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? accent : const Color(0xFF64748B);
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            border: Border.all(
              color: selected ? accent.withValues(alpha: 0.15) : Colors.transparent,
            ),
            boxShadow: selected
                ? const [BoxShadow(color: Color(0x1F0F172A), blurRadius: 3, offset: Offset(0, 1))]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 15, color: fg),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                    color: fg,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
