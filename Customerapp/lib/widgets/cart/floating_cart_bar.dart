import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/providers/app_providers.dart';
import '../../core/utils/cart_utils.dart';
import '../../core/utils/currency_formatter.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/cart/cart_controller.dart';
import '../../features/settings/store_settings_provider.dart';
import '../../models/coupon.dart';
import '../../routes/route_paths.dart';
import '../common/fly_target_anchor.dart';
import '../common/nav_icon_locator.dart';

const _panelColor = Color(0xFF2B303A);
const _cartColor = Color(0xFF065F46);
const _offerInk = Color(0xFF065F46);

/// Height of the bar including the "Offers" tab that sits on its top edge.
const double floatingCartBarHeight = 64;

/// Floating "unlock offer + Cart" bar shown above the shell bottom nav.
class FloatingCartBar extends ConsumerStatefulWidget {
  const FloatingCartBar({super.key, required this.onOpenCart});

  final VoidCallback onOpenCart;

  @override
  ConsumerState<FloatingCartBar> createState() => _FloatingCartBarState();
}

class _FloatingCartBarState extends ConsumerState<FloatingCartBar> {
  List<Coupon> _coupons = const [];
  String? _couponsKey;

  Future<void> _loadCoupons(double subtotal, String key) async {
    try {
      final list = await ref.read(apiServiceProvider).fetchAvailableCoupons(subtotal: subtotal);
      if (mounted && _couponsKey == key) setState(() => _coupons = list);
    } catch (_) {
      if (mounted && _couponsKey == key) setState(() => _coupons = const []);
    }
  }

  _Nudge? _nudge(double subtotal) {
    final usable = _coupons.where((c) => c.redemptionBlocked.trim().isEmpty).toList();

    final locked = usable.where((c) => !c.unlocked && c.amountNeeded > 0).toList()
      ..sort((a, b) => a.amountNeeded.compareTo(b.amountNeeded));
    if (locked.isNotEmpty) {
      final coupon = locked.first;
      final off = coupon.isPercentage
          ? '${coupon.discountValue.toStringAsFixed(coupon.discountValue % 1 == 0 ? 0 : 1)}%'
          : formatInr(coupon.discountValue);
      return _Nudge(
        title: 'Unlock extra $off OFF',
        prefix: 'Shop for ',
        amount: formatInr(coupon.amountNeeded),
        suffix: ' more',
        progress: subtotal / (subtotal + coupon.amountNeeded),
      );
    }

    final unlocked = usable.where((c) => c.unlocked && c.discountAmount > 0).toList()
      ..sort((a, b) => b.discountAmount.compareTo(a.discountAmount));
    if (unlocked.isNotEmpty) {
      final coupon = unlocked.first;
      return _Nudge(
        title: '${formatInr(coupon.discountAmount)} OFF unlocked!',
        prefix: 'Use code ',
        amount: coupon.code,
        suffix: ' at checkout',
        progress: 1,
      );
    }

    final settings = ref.read(storeSettingsProvider).value;
    if (settings != null) {
      final slab = nextCheaperShippingSlab(subtotal, settings);
      if (slab != null) {
        return _Nudge(
          title: slab.shippingCharge <= 0
              ? 'Unlock FREE delivery'
              : 'Unlock ${formatInr(slab.shippingCharge)} delivery',
          prefix: 'Shop for ',
          amount: formatInr(slab.orderAmount - subtotal),
          suffix: ' more',
          progress: subtotal / slab.orderAmount,
        );
      }
      final shortfall = minimumOrderShortfall(subtotal, settings.minimumOrderValue);
      if (shortfall > 0) {
        return _Nudge(
          title: 'Minimum order ${formatInr(settings.minimumOrderValue)}',
          prefix: 'Shop for ',
          amount: formatInr(shortfall),
          suffix: ' more',
          progress: minimumOrderProgress(subtotal, settings.minimumOrderValue),
        );
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final items = ref.watch(cartControllerProvider.select((s) => s.items));
    final cartCount = ref.watch(cartControllerProvider.select((s) => s.cartCount));
    final isLoggedIn = ref.watch(authControllerProvider.select((s) => s.isLoggedIn));
    final settings = ref.watch(storeSettingsProvider).value;
    final subtotal = calculateCartSummary(items, settings: settings).subtotal;

    final key = '$isLoggedIn|${subtotal.toStringAsFixed(2)}';
    if (_couponsKey != key) {
      _couponsKey = key;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadCoupons(subtotal, key);
      });
    }

    final nudge = _nudge(subtotal);

    return SizedBox(
      height: floatingCartBarHeight,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: 50,
            child: Row(
              children: [
                Expanded(
                  child: _OfferPanel(
                    nudge: nudge,
                    subtotal: subtotal,
                    onTap: () => context.push(RoutePaths.coupons),
                  ),
                ),
                const SizedBox(width: 8),
                FlyTargetAnchor(
                  onReport: NavIconLocator.reportCart,
                  onClear: NavIconLocator.clearCart,
                  child: _CartButton(count: cartCount, onTap: widget.onOpenCart),
                ),
              ],
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Row(
              children: [
                Expanded(
                  child: Center(
                    child: _OffersTab(onTap: () => context.push(RoutePaths.coupons)),
                  ),
                ),
                const SizedBox(width: 8 + _CartButton.width),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Nudge {
  const _Nudge({
    required this.title,
    required this.prefix,
    required this.amount,
    required this.suffix,
    required this.progress,
  });

  final String title;
  final String prefix;
  final String amount;
  final String suffix;
  final double progress;
}

class _OfferPanel extends StatelessWidget {
  const _OfferPanel({required this.nudge, required this.subtotal, required this.onTap});

  final _Nudge? nudge;
  final double subtotal;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final n = nudge;
    final title = n?.title ?? 'Item total ${formatInr(subtotal)}';

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [
          BoxShadow(color: Color(0x38000000), blurRadius: 16, offset: Offset(0, 6)),
        ],
      ),
      child: Material(
        color: _panelColor,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              children: [
                SizedBox(
                  width: 32,
                  height: 32,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox.expand(
                        child: CircularProgressIndicator(
                          value: (n?.progress ?? 1).clamp(0.0, 1.0),
                          strokeWidth: 2.6,
                          backgroundColor: Colors.white.withValues(alpha: 0.18),
                          color: Colors.white,
                          strokeCap: StrokeCap.round,
                        ),
                      ),
                      Container(
                        width: 20,
                        height: 20,
                        decoration: const BoxDecoration(
                          color: Color(0xFF4B5563),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.percent_rounded, size: 11, color: Colors.white),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          height: 1.25,
                        ),
                      ),
                      Text.rich(
                        TextSpan(
                          children: n == null
                              ? const [TextSpan(text: 'View offers for your cart')]
                              : [
                                  TextSpan(text: n.prefix),
                                  TextSpan(
                                    text: n.amount,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white.withValues(alpha: 0.9),
                                    ),
                                  ),
                                  TextSpan(text: n.suffix),
                                ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Colors.white70,
                          height: 1.25,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OffersTab extends StatelessWidget {
  const _OffersTab({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 1),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xFFA7F3D0)),
          boxShadow: const [
            BoxShadow(color: Color(0x1F000000), blurRadius: 6, offset: Offset(0, 2)),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Offers',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: _offerInk,
              ),
            ),
            const SizedBox(width: 2),
            const Icon(Icons.keyboard_arrow_up_rounded, size: 13, color: _offerInk),
          ],
        ),
      ),
    );
  }
}

class _CartButton extends StatelessWidget {
  const _CartButton({required this.count, required this.onTap});

  static const double width = 96;

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [
          BoxShadow(color: Color(0x4D065F46), blurRadius: 16, offset: Offset(0, 6)),
        ],
      ),
      child: Material(
        color: _cartColor,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              children: [
                const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 20),
                const SizedBox(width: 6),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Cart',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          height: 1.25,
                        ),
                      ),
                      Text(
                        '$count ${count == 1 ? 'item' : 'items'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withValues(alpha: 0.85),
                          height: 1.25,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
