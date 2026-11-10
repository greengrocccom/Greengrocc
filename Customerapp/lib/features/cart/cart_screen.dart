import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../config/theme.dart';
import '../../core/exceptions/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/scroll/app_scroll_config.dart';
import '../../core/scroll/tab_scroll_registry.dart';
import '../../core/utils/cart_utils.dart';
import '../../core/utils/currency_formatter.dart';
import '../../features/address/address_controller.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/cart/cart_controller.dart';
import '../../features/settings/store_settings_provider.dart';
import '../../features/wishlist/wishlist_controller.dart';
import '../../models/cart_item.dart';
import '../../models/coupon.dart';
import '../../models/product.dart';
import '../../routes/route_paths.dart';
import '../../models/store_settings.dart';
import '../../widgets/common/app_network_image.dart';
import '../../widgets/common/minimum_order_warning.dart';
import '../../widgets/common/refreshable_body.dart';
import '../../widgets/common/skeleton_loaders.dart';

const _pageBg = Color(0xFFF3F5F9);
const _brand = Color(0xFF0C831F);
const _ink = Color(0xFF0F172A);
const _muted = Color(0xFF64748B);
const _ring = Color(0xB3E2E8F0);

BoxDecoration _cardDecoration() => BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: _ring),
    );

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        text.toUpperCase(),
        style: GoogleFonts.plusJakartaSans(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.9,
          color: _muted,
        ),
      ),
    );
  }
}

class _DashedDivider extends StatelessWidget {
  const _DashedDivider();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dash = 4.0;
        const gap = 3.0;
        final count = (constraints.maxWidth / (dash + gap)).floor();
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(
            count,
            (_) => const SizedBox(
              width: dash,
              height: 1,
              child: ColoredBox(color: Color(0xFFE2E8F0)),
            ),
          ),
        );
      },
    );
  }
}

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  bool _clearing = false;
  final _couponController = TextEditingController();
  AppliedCoupon? _appliedCoupon;
  bool _applyingCoupon = false;
  String _couponError = '';
  late final TabScrollRegistry _tabScrollRegistry;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _tabScrollRegistry = ref.read(tabScrollRegistryProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _tabScrollRegistry.register(ShellTabIndex.cart, _scrollController);
      ref.read(cartControllerProvider.notifier).loadCart(silent: true);
      ref.read(storeSettingsProvider.notifier).refresh();
      final addresses = ref.read(addressControllerProvider);
      if (addresses.addresses.isEmpty && !addresses.loading) {
        ref.read(addressControllerProvider.notifier).loadAddresses();
      }
    });
  }

  @override
  void dispose() {
    _tabScrollRegistry.unregister(ShellTabIndex.cart, _scrollController);
    _scrollController.dispose();
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _applyCoupon(String code) async {
    final trimmed = code.trim().toUpperCase();
    if (trimmed.isEmpty || _applyingCoupon) return;

    final isLoggedIn = ref.read(authControllerProvider).isLoggedIn;
    if (!isLoggedIn) {
      ref.read(authControllerProvider.notifier).openAuthModal();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please log in to apply coupons'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() {
      _applyingCoupon = true;
      _couponError = '';
    });

    try {
      final items = ref.read(cartControllerProvider).items;
      final subtotal = calculateCartSummary(items).subtotal;
      final coupon = await ref.read(apiServiceProvider).validateCoupon(
            code: trimmed,
            subtotal: subtotal,
          );
      if (!mounted) return;
      setState(() {
        _appliedCoupon = coupon;
        _applyingCoupon = false;
        _couponError = '';
        _couponController.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Coupon "${coupon.code}" applied! Saved ₹${coupon.discountAmount.toStringAsFixed(0)}'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFF16A34A),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _applyingCoupon = false;
        _couponError = apiErrorMessage(e, fallback: 'Invalid coupon code');
      });
    }
  }

  void _removeCoupon() {
    setState(() {
      _appliedCoupon = null;
      _couponError = '';
    });
  }

  Future<void> _loadCart() async {
    await ref.read(cartControllerProvider.notifier).loadCart();
  }

  Future<void> _confirmRemoveItem(CartItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove item?', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text('Remove "${item.name}" from your cart?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade600),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    await ref.read(cartControllerProvider.notifier).removeFromCartLine(
          productId: item.id,
          variantName: item.variantName,
          colorName: item.colorName,
        );
  }

  Future<void> _moveToWishlist(CartItem item) async {
    final product = Product(
      id: item.id,
      name: item.name,
      categories: const [],
      subcategory: '',
      brandName: item.brandName,
      price: item.price,
      discountedPrice: item.discountedPrice,
      discountedPercent: 0,
      stock: item.stock,
      productImages: item.productImages,
      pricingType: item.pricingType,
      bulkPricing: item.bulkPricing,
      variantType: item.variantType,
      variants: item.variants,
      minOrderQuantity: item.minOrderQuantity,
      stepByQuantity: item.stepByQuantity,
    );

    await ref.read(wishlistControllerProvider.notifier).toggleWishlist(product);
  }

  Future<void> _clearCart() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear cart?', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Remove all items from your cart?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Clear')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _clearing = true);
    await ref.read(cartControllerProvider.notifier).clearCart();
    if (!mounted) return;
    setState(() => _clearing = false);
  }



  @override
  Widget build(BuildContext context) {
    final isLoggedIn = ref.watch(authControllerProvider.select((s) => s.isLoggedIn));
    final items = ref.watch(cartControllerProvider.select((s) => s.items));
    final loading = ref.watch(cartControllerProvider.select((s) => s.loading));
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    void goBack() => context.canPop() ? context.pop() : context.go(RoutePaths.home);

    if (items.isEmpty) {
      return ColoredBox(
        color: _pageBg,
        child: Column(
          children: [
            _CartTopAppBar(
              topInset: topInset,
              itemCount: 0,
              savings: 0,
              onBack: goBack,
              onClear: null,
            ),
            Expanded(
              child: loading
                  ? const SkeletonCartPage()
                  : RefreshableBody(
                      onRefresh: _loadCart,
                      child: _EmptyCart(onBrowse: () => context.go(RoutePaths.product)),
                    ),
            ),
          ],
        ),
      );
    }

    final storeSettings = ref.watch(storeSettingsProvider).value;
    final summary = calculateCartSummary(items, settings: storeSettings);
    final couponDiscount = _appliedCoupon != null
        ? _appliedCoupon!.discountAmount.clamp(0.0, summary.subtotal).toDouble()
        : 0.0;
    final toPay = applyCouponDiscount(summary, couponDiscount).total;
    final displaySavings = summary.savings + couponDiscount;
    final minimumOrderValue = storeSettings?.minimumOrderValue ?? 0;
    final canCheckout = meetsMinimumOrder(summary.subtotal, minimumOrderValue);

    void proceedToCheckout() {
      if (!isLoggedIn) {
        ref.read(authControllerProvider.notifier).openAuthModal();
        return;
      }
      if (!canCheckout) return;
      final code = _appliedCoupon?.code;
      context.push(
        code == null
            ? RoutePaths.checkout
            : Uri(path: RoutePaths.checkout, queryParameters: {'coupon': code}).toString(),
      );
    }

    return Scaffold(
      backgroundColor: _pageBg,
      body: Column(
        children: [
          _CartTopAppBar(
            topInset: topInset,
            itemCount: summary.itemCount,
            savings: displaySavings,
            onBack: goBack,
            onClear: _clearing || loading ? null : _clearCart,
          ),
          Expanded(
            child: Stack(
              children: [
                RefreshIndicator(
                  color: _brand,
                  onRefresh: _loadCart,
                  child: ListView(
                    controller: _scrollController,
                    physics: AppScrollConfig.listPhysics,
                    padding: EdgeInsets.only(
                      left: 12,
                      right: 12,
                      top: 12,
                      bottom: bottomInset + 100,
                    ),
                    children: [
                      if (displaySavings > 0) ...[
                        _SavingsBanner(savings: displaySavings),
                        const SizedBox(height: 12),
                      ],
                      if (storeSettings != null) ...[
                        _DeliveryNudge(subtotal: summary.subtotal, settings: storeSettings),
                        const SizedBox(height: 12),
                      ],
                      _CartItemsCard(
                        items: items,
                        onAddMore: () => context.go(RoutePaths.product),
                        onRemove: _confirmRemoveItem,
                        onMoveToWishlist: _moveToWishlist,
                        onDecrease: (item) async {
                          final nextQty = getDecreasedCartQuantityForCartItem(item);
                          if (nextQty <= 0) {
                            await _confirmRemoveItem(item);
                          } else {
                            await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
                                  productId: item.id,
                                  quantity: nextQty,
                                  variantName: item.variantName,
                                  colorName: item.colorName,
                                );
                          }
                        },
                        onIncrease: (item) =>
                            ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
                                  productId: item.id,
                                  quantity: item.quantity + item.quantityStep,
                                  variantName: item.variantName,
                                  colorName: item.colorName,
                                ),
                        onTapItem: (item) => context.push('/product/${item.id}'),
                      ),
                      const SizedBox(height: 16),
                      const _SectionLabel('Offers & benefits'),
                      _ApplyCouponCard(
                        controller: _couponController,
                        appliedCoupon: _appliedCoupon,
                        isApplying: _applyingCoupon,
                        errorMessage: _couponError,
                        onApply: _applyCoupon,
                        onRemove: _removeCoupon,
                        onViewAll: () async {
                          final code = await context.push<String>(RoutePaths.coupons);
                          if (code != null && code.isNotEmpty && mounted) {
                            _applyCoupon(code);
                          }
                        },
                      ),
                      const SizedBox(height: 16),
                      const _SectionLabel('Bill details'),
                      _BillDetailsCard(
                        summary: summary,
                        settingsReady: storeSettings != null,
                        appliedCoupon: _appliedCoupon,
                        couponDiscount: couponDiscount,
                        toPay: toPay,
                      ),
                      if (!canCheckout) ...[
                        const SizedBox(height: 12),
                        MinimumOrderWarning(
                          subtotal: summary.subtotal,
                          minimumOrderValue: minimumOrderValue,
                          compact: true,
                        ),
                      ],
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Text(
                          'Review your order before checkout. Prices and availability are confirmed at the next step.',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            height: 1.5,
                            color: _muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: _CartCheckoutBar(
                    total: toPay,
                    savings: displaySavings,
                    enabled: canCheckout,
                    buttonText: isLoggedIn ? 'Proceed to checkout' : 'Login to continue',
                    onProceed: proceedToCheckout,
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

// --- Top App Bar ---
class _CartTopAppBar extends StatelessWidget {
  const _CartTopAppBar({
    required this.topInset,
    required this.itemCount,
    required this.savings,
    required this.onBack,
    required this.onClear,
  });

  final double topInset;
  final int itemCount;
  final double savings;
  final VoidCallback onBack;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56 + topInset,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      padding: EdgeInsets.only(left: 4, right: 4, top: topInset),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Go back',
            icon: const Icon(Icons.chevron_left_rounded, color: _ink, size: 28),
            onPressed: onBack,
          ),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'My Cart',
                  style: GoogleFonts.plusJakartaSans(
                    color: _ink,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                  ),
                ),
                if (itemCount > 0)
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '$itemCount ${itemCount == 1 ? 'item' : 'items'}'),
                        if (savings > 0) ...[
                          const TextSpan(text: ' · '),
                          TextSpan(
                            text: 'Saving ${formatInr(savings)}',
                            style: const TextStyle(color: _brand, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(fontSize: 12, color: _muted),
                  ),
              ],
            ),
          ),
          if (itemCount > 0)
            TextButton(
            onPressed: onClear,
            style: TextButton.styleFrom(
              foregroundColor: _muted,
              disabledForegroundColor: _muted.withValues(alpha: 0.5),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text(
              'Clear all',
              style: GoogleFonts.plusJakartaSans(fontSize: 12.5, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeliveryNudge extends StatelessWidget {
  const _DeliveryNudge({required this.subtotal, required this.settings});

  final double subtotal;
  final StoreSettings settings;

  @override
  Widget build(BuildContext context) {
    final slab = nextCheaperShippingSlab(subtotal, settings);
    final textStyle = GoogleFonts.plusJakartaSans(fontSize: 12.5, color: const Color(0xFF334155));

    if (slab == null) {
      if (shippingChargeFor(subtotal, settings) > 0) return const SizedBox.shrink();
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFD1FAE5)),
        ),
        child: Row(
          children: [
            const Icon(Icons.local_shipping_outlined, color: _brand, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Yay! You get FREE delivery on this order',
                style: textStyle.copyWith(
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF064E3B),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final remaining = (slab.orderAmount - subtotal).clamp(0.0, double.infinity);
    final progress = slab.orderAmount <= 0 ? 1.0 : (subtotal / slab.orderAmount).clamp(0.0, 1.0);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.local_shipping_outlined, color: _brand, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Add '),
                      TextSpan(
                        text: formatInr(remaining),
                        style: const TextStyle(fontWeight: FontWeight.w700, color: _ink),
                      ),
                      const TextSpan(text: ' more for '),
                      TextSpan(
                        text: slab.shippingCharge <= 0
                            ? 'FREE delivery'
                            : '${formatInr(slab.shippingCharge)} delivery',
                        style: const TextStyle(fontWeight: FontWeight.w700, color: _brand),
                      ),
                    ],
                  ),
                  style: textStyle,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: const Color(0xFFF1F5F9),
              color: _brand,
            ),
          ),
        ],
      ),
    );
  }
}

class _BillDetailsCard extends StatelessWidget {
  const _BillDetailsCard({
    required this.summary,
    required this.settingsReady,
    required this.appliedCoupon,
    required this.couponDiscount,
    required this.toPay,
  });

  final CartSummary summary;
  final bool settingsReady;
  final AppliedCoupon? appliedCoupon;
  final double couponDiscount;
  final double toPay;

  @override
  Widget build(BuildContext context) {
    final itemCount = summary.itemCount;
    final mrpTotal = summary.subtotal + summary.savings;
    final rowStyle = GoogleFonts.plusJakartaSans(fontSize: 13, color: const Color(0xFF334155));
    final valueStyle = GoogleFonts.plusJakartaSans(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: _ink,
    );
    final greenStyle = GoogleFonts.plusJakartaSans(
      fontSize: 13,
      fontWeight: FontWeight.w700,
      color: _brand,
    );

    Widget billRow(String label, List<Widget> values, {TextStyle? labelStyle}) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              Expanded(child: Text(label, style: labelStyle ?? rowStyle)),
              ...values,
            ],
          ),
        );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          billRow(
            'Item total ($itemCount ${itemCount == 1 ? 'item' : 'items'})',
            [
              if (mrpTotal > summary.subtotal) ...[
                Text(
                  formatInr(mrpTotal),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: const Color(0xFF94A3B8),
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Text(formatInr(summary.subtotal), style: valueStyle),
            ],
          ),
          if (couponDiscount > 0 && appliedCoupon != null)
            billRow(
              'Coupon (${appliedCoupon!.code})',
              [Text('-${formatInr(couponDiscount)}', style: greenStyle)],
              labelStyle: greenStyle.copyWith(fontWeight: FontWeight.w600),
            ),
          billRow('Delivery fee', [
            if (!settingsReady)
              Text('Calculating…', style: rowStyle.copyWith(color: const Color(0xFF94A3B8)))
            else if (summary.shippingFree)
              Text('FREE', style: greenStyle)
            else
              Text(formatInr(summary.shipping), style: valueStyle),
          ]),
          billRow(
            'Taxes & charges',
            [Text('Included', style: rowStyle.copyWith(color: _muted))],
            labelStyle: rowStyle.copyWith(color: _muted),
          ),
          const _DashedDivider(),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  'To pay',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: _ink,
                  ),
                ),
              ),
              Text(
                formatInr(toPay),
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: _ink,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CartCheckoutBar extends StatelessWidget {
  const _CartCheckoutBar({
    required this.total,
    required this.savings,
    required this.enabled,
    required this.buttonText,
    required this.onProceed,
  });

  final double total;
  final double savings;
  final bool enabled;
  final String buttonText;
  final VoidCallback onProceed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(12, 10, 12, MediaQuery.paddingOf(context).bottom + 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
            color: Color(0x0F0F172A),
            blurRadius: 20,
            offset: Offset(0, -6),
          ),
        ],
      ),
      child: Row(
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                formatInr(total),
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: _ink,
                  height: 1.2,
                ),
              ),
              Text(
                savings > 0 ? 'Saved ${formatInr(savings)}' : 'Total to pay',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: savings > 0 ? _brand : _muted,
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: enabled ? onProceed : null,
                style: FilledButton.styleFrom(
                  backgroundColor: _brand,
                  disabledBackgroundColor: const Color(0xFFCBD5E1),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        buttonText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 2),
                    const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 20),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SavingsBanner extends StatelessWidget {
  const _SavingsBanner({required this.savings});

  final double savings;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFECFDF5), Color(0xFFF0FDFA)]),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFD1FAE5)),
      ),
      child: Row(
        children: [
          const Text('🎉', style: TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: "You're saving "),
                  TextSpan(text: formatInr(savings), style: const TextStyle(color: _brand)),
                  const TextSpan(text: ' on this order'),
                ],
              ),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF064E3B),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// --- 2. Cart Items White Card ---
class _CartItemsCard extends StatelessWidget {
  const _CartItemsCard({
    required this.items,
    required this.onRemove,
    required this.onMoveToWishlist,
    required this.onDecrease,
    required this.onIncrease,
    required this.onTapItem,
    this.onAddMore,
  });

  final List<CartItem> items;
  final ValueChanged<CartItem> onRemove;
  final ValueChanged<CartItem> onMoveToWishlist;
  final ValueChanged<CartItem> onDecrease;
  final ValueChanged<CartItem> onIncrease;
  final ValueChanged<CartItem> onTapItem;
  final VoidCallback? onAddMore;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (int i = 0; i < items.length; i++) ...[
            _BlinkitCartItemRow(
              item: items[i],
              onRemove: () => onRemove(items[i]),
              onMoveToWishlist: () => onMoveToWishlist(items[i]),
              onDecrease: () => onDecrease(items[i]),
              onIncrease: () => onIncrease(items[i]),
              onTap: () => onTapItem(items[i]),
            ),
            if (i < items.length - 1)
              const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),
          ],
          if (onAddMore != null) ...[
            const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),
            InkWell(
              onTap: onAddMore,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    const Icon(Icons.add_rounded, size: 18, color: _brand),
                    const SizedBox(width: 6),
                    Text(
                      'Add more items',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: _brand,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BlinkitCartItemRow extends StatelessWidget {
  const _BlinkitCartItemRow({
    required this.item,
    required this.onRemove,
    required this.onMoveToWishlist,
    required this.onDecrease,
    required this.onIncrease,
    required this.onTap,
  });

  final CartItem item;
  final VoidCallback onRemove;
  final VoidCallback onMoveToWishlist;
  final VoidCallback onDecrease;
  final VoidCallback onIncrease;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final image = item.productImages.isNotEmpty ? item.productImages.first : null;
    final hasDiscount = item.price > item.discountedPrice && item.discountedPrice > 0;
    final offPercent = hasDiscount ? ((item.price - item.discountedPrice) / item.price * 100).round() : 0;
    final meta = [item.variantName, item.colorName].where((s) => s.isNotEmpty).join(' · ');
    final removesOnDecrease = getDecreasedCartQuantityForCartItem(item) <= 0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: onTap,
            child: Container(
              width: 64,
              height: 64,
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: image != null
                    ? AppNetworkImage(
                        imageUrl: image,
                        fit: BoxFit.contain,
                        width: 56,
                        height: 56,
                        errorIcon: Icons.image_outlined,
                      )
                    : const Icon(Icons.image_outlined, color: Color(0xFF94A3B8)),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: onTap,
                  child: Text(
                    item.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w600,
                      fontSize: 13.5,
                      color: _ink,
                      height: 1.3,
                    ),
                  ),
                ),
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    meta,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(fontSize: 12, color: _muted),
                  ),
                ],
                const SizedBox(height: 6),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  children: [
                    Text(
                      formatInr(item.discountedPrice > 0 ? item.discountedPrice : item.price),
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: _ink,
                      ),
                    ),
                    if (hasDiscount) ...[
                      Text(
                        formatInr(item.price),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11.5,
                          color: const Color(0xFF94A3B8),
                          decoration: TextDecoration.lineThrough,
                        ),
                      ),
                      Text(
                        '$offPercent% off',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: _brand,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                GestureDetector(
                  onTap: onMoveToWishlist,
                  child: Text(
                    'Move to wishlist',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: _muted,
                      decoration: TextDecoration.underline,
                      decorationColor: _muted,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                height: 32,
                width: 88,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: _brand,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: const [
                    BoxShadow(color: Color(0x14000000), blurRadius: 2, offset: Offset(0, 1)),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: onDecrease,
                          child: Center(
                            child: Icon(
                              removesOnDecrease ? Icons.delete_outline_rounded : Icons.remove_rounded,
                              size: 15,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      Text(
                        '${item.quantity}',
                        style: GoogleFonts.plusJakartaSans(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Expanded(
                        child: InkWell(
                          onTap: onIncrease,
                          child: const Center(
                            child: Icon(Icons.add_rounded, size: 15, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                formatInr(item.lineTotal),
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: _ink,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// --- 7. Apply Coupon Card ---
class _ApplyCouponCard extends StatelessWidget {
  const _ApplyCouponCard({
    required this.controller,
    required this.appliedCoupon,
    required this.isApplying,
    required this.errorMessage,
    required this.onApply,
    required this.onRemove,
    required this.onViewAll,
  });

  final TextEditingController controller;
  final AppliedCoupon? appliedCoupon;
  final bool isApplying;
  final String errorMessage;
  final ValueChanged<String> onApply;
  final VoidCallback onRemove;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  color: Color(0xFFECFDF5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.local_offer_outlined,
                  color: _brand,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Apply coupon',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: _ink,
                      ),
                    ),
                    Text(
                      'Browse offers available for you',
                      style: GoogleFonts.plusJakartaSans(fontSize: 11.5, color: _muted),
                    ),
                  ],
                ),
              ),
              InkWell(
                onTap: onViewAll,
                borderRadius: BorderRadius.circular(6),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'View',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: _brand,
                        ),
                      ),
                      const SizedBox(width: 2),
                      const Icon(
                        Icons.chevron_right_rounded,
                        size: 16,
                        color: _brand,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (appliedCoupon != null)
            // Applied Coupon Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF86EFAC), width: 1.2),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(5),
                    decoration: const BoxDecoration(
                      color: Color(0xFF16A34A),
                      shape: BoxShape.circle,
                    ),
                    child:
                        const Icon(Icons.check, size: 14, color: Colors.white),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              appliedCoupon!.code,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                                color: const Color(0xFF15803D),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFBBF7D0),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'APPLIED',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF166534),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'You save ₹${appliedCoupon!.discountAmount.toStringAsFixed(0)} on this order',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF166534),
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: onRemove,
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFDC2626),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      'Remove',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else ...[
            // Input Box & Apply Button
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: TextField(
                      controller: controller,
                      textCapitalization: TextCapitalization.characters,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                        color: const Color(0xFF1F2937),
                      ),
                      decoration: InputDecoration(
                        hintText: 'Enter coupon code',
                        hintStyle: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0,
                          color: const Color(0xFF9CA3AF),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide:
                              const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide:
                              const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: _brand,
                            width: 1.5,
                          ),
                        ),
                      ),
                      onSubmitted: onApply,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 44,
                  child: FilledButton(
                    onPressed:
                        isApplying ? null : () => onApply(controller.text),
                    style: FilledButton.styleFrom(
                      backgroundColor: _brand,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    child: isApplying
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            'APPLY',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                  ),
                ),
              ],
            ),
            if (errorMessage.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    size: 15,
                    color: Color(0xFFDC2626),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      errorMessage,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFFDC2626),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart({required this.onBrowse});

  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.remove_shopping_cart_outlined, size: 64, color: AppColors.textMuted),
            const SizedBox(height: 16),
            Text(
              'Your cart is empty',
              style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Explore our fresh products and add items to your cart',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: onBrowse,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              child: const Text('Browse Products'),
            ),
          ],
        ),
      ),
    );
  }
}
