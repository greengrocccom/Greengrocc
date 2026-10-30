import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/exceptions/api_exception.dart';
import '../../core/network/api_response_parser.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/location_provider.dart';
import '../../core/utils/address_utils.dart';
import '../../core/utils/cart_utils.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/department_utils.dart';
import '../../core/utils/payment_utils.dart';
import '../../features/address/address_controller.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/cart/cart_controller.dart';
import '../../features/settings/store_settings_provider.dart';
import '../../features/wishlist/wishlist_controller.dart';
import '../../models/address.dart';
import '../../models/cart_item.dart';
import '../../models/coupon.dart';
import '../../models/product.dart';
import '../../routes/route_paths.dart';
import '../../widgets/address/address_form.dart';
import '../../widgets/address/select_delivery_location_sheet.dart';
import '../../widgets/common/app_network_image.dart';
import '../../widgets/common/minimum_order_warning.dart';
import '../../widgets/common/skeleton_loaders.dart';
import 'checkout_fulfillment_widgets.dart';
import 'payment_method.dart';

const _maxOrderNoteLength = 200;

const _pageBg = Color(0xFFF1F2F6);
const _ink = Color(0xFF0F172A);
const _muted = Color(0xFF64748B);
const _slate700 = Color(0xFF334155);
const _slate400 = Color(0xFF94A3B8);
const _slate300 = Color(0xFFCBD5E1);
const _slate100 = Color(0xFFF1F5F9);
const _accent = Color(0xFF047857);
const _savedBg = Color(0xFFE6F6EC);
const _savedInk = Color(0xFF0B7A3B);

TextStyle _font({
  double size = 13,
  FontWeight weight = FontWeight.w600,
  Color color = _ink,
  TextDecoration? decoration,
  double? letterSpacing,
}) =>
    GoogleFonts.plusJakartaSans(
      fontSize: size,
      fontWeight: weight,
      color: color,
      decoration: decoration,
      decorationColor: color,
      letterSpacing: letterSpacing,
    );

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key, this.initialCouponCode});

  final String? initialCouponCode;

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  String? _selectedAddressId;
  String _message = '';
  String? _lastCheckoutAttemptKey;
  double? _serverShipping;
  String? _serverShippingKey;
  String _fulfillment = FulfillmentType.delivery;
  String? _preOrderSlot;
  PaymentModeOption? _paymentMode;
  bool _showNote = false;

  final _couponController = TextEditingController();
  AppliedCoupon? _appliedCoupon;
  double? _couponValidatedFor;
  bool _applyingCoupon = false;
  String _couponError = '';
  List<Coupon> _coupons = const [];
  String? _couponsKey;

  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      ref.read(storeSettingsProvider.notifier).refresh();
      // Always reload: server cart lines carry each product's department.
      if (!ref.read(cartControllerProvider).loading) {
        ref.read(cartControllerProvider.notifier).loadCart(silent: true);
      }
      final addresses = ref.read(addressControllerProvider);
      if (addresses.addresses.isEmpty && !addresses.loading) {
        ref.read(addressControllerProvider.notifier).loadAddresses();
      }
      final initialCode = widget.initialCouponCode?.trim() ?? '';
      if (initialCode.isNotEmpty) {
        _applyCoupon(initialCode);
      }
      await _loadPaymentMode();
    });
  }

  @override
  void dispose() {
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _loadPaymentMode() async {
    final mode = await loadLastPaymentMode();
    if (mounted) setState(() => _paymentMode = mode);
  }

  Future<void> _applyCoupon(String code) async {
    final trimmed = code.trim().toUpperCase();
    if (trimmed.isEmpty || _applyingCoupon) return;

    setState(() {
      _applyingCoupon = true;
      _couponError = '';
    });

    try {
      var items = ref.read(cartControllerProvider).items;
      if (items.isEmpty) {
        await ref.read(cartControllerProvider.notifier).loadCart(silent: true);
        items = ref.read(cartControllerProvider).items;
      }
      final subtotal = calculateCartSummary(items).subtotal;
      final coupon = await ref
          .read(apiServiceProvider)
          .validateCoupon(code: trimmed, subtotal: subtotal);
      if (!mounted) return;
      setState(() {
        _appliedCoupon = coupon;
        _couponValidatedFor = subtotal;
        _applyingCoupon = false;
        _couponError = '';
        _couponController.clear();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (_appliedCoupon?.code == trimmed) _appliedCoupon = null;
        _applyingCoupon = false;
        _couponError = apiErrorMessage(e, fallback: 'Failed to apply coupon.');
      });
    }
  }

  void _removeCoupon() {
    setState(() {
      _appliedCoupon = null;
      _couponError = '';
    });
  }

  Future<void> _loadCoupons(double subtotal, String key) async {
    try {
      final list = await ref.read(apiServiceProvider).fetchAvailableCoupons(subtotal: subtotal);
      if (mounted && _couponsKey == key) setState(() => _coupons = list);
    } catch (_) {}
  }

  /// Best coupon to suggest: the biggest one already unlocked, otherwise the
  /// one closest to unlocking.
  Coupon? _suggestedCoupon() {
    final applied = _appliedCoupon;
    final candidates = _coupons
        .where((c) => c.code != applied?.code && c.redemptionBlocked.trim().isEmpty)
        .toList();
    final unlocked = candidates.where((c) => c.unlocked && c.discountAmount > 0).toList()
      ..sort((a, b) => b.discountAmount.compareTo(a.discountAmount));
    if (unlocked.isNotEmpty) {
      if (applied != null && applied.discountAmount >= unlocked.first.discountAmount) {
        return null;
      }
      return unlocked.first;
    }
    if (applied != null) return null;
    final locked = candidates.where((c) => !c.unlocked && c.amountNeeded > 0).toList()
      ..sort((a, b) => a.amountNeeded.compareTo(b.amountNeeded));
    return locked.firstOrNull;
  }

  Future<void> _openCoupons() async {
    final code = await context.push<String>(RoutePaths.coupons);
    if (code != null && code.isNotEmpty && mounted) {
      _applyCoupon(code);
    }
  }

  void _syncSelectedAddress(List<Address> addresses) {
    if (addresses.isEmpty) {
      _selectedAddressId = null;
      return;
    }
    if (_selectedAddressId != null &&
        addresses.any((addr) => addr.id == _selectedAddressId)) {
      return;
    }
    final defaultAddr = addresses.where((a) => a.isDefault).firstOrNull ?? addresses.first;
    _selectedAddressId = defaultAddr.id;
  }

  Map<String, dynamic>? _customerLocationPayload() {
    final loc = ref.read(deliveryLocationProvider);
    if (loc == null) return null;
    final map = <String, dynamic>{
      'city': loc.city ?? '',
      'area': loc.area ?? '',
      'state': loc.state ?? '',
      'pincode': loc.pincode ?? '',
      'fullAddress': loc.address ?? loc.displayAddress,
    };
    if (loc.latitude != null && loc.longitude != null) {
      map['lat'] = loc.latitude;
      map['lng'] = loc.longitude;
      map['location'] = {'lat': loc.latitude, 'lng': loc.longitude};
    }
    return map;
  }

  List<Map<String, dynamic>> _checkoutItemsPayload(List<CartItem> items) {
    return items
        .map(
          (item) => {
            'productId': item.id,
            'quantity': item.quantity,
            'variantName': item.variantName,
            'colorName': item.colorName,
          },
        )
        .toList();
  }

  /// Delivery vs store pickup, plus the slot for the cart's pre-order items.
  Map<String, dynamic> _fulfillmentPayload(List<CartItem> items) {
    final hasPreOrder = items.any((item) => item.department == Department.preorder);
    return {
      'fulfillmentType': _fulfillment,
      if (hasPreOrder && _preOrderSlot != null) 'preOrderSlot': _preOrderSlot,
    };
  }

  Future<void> _openPayment({bool autoPay = false}) async {
    final mode = _paymentMode;
    final query = <String, String>{
      if (_selectedAddressId != null) 'addressId': _selectedAddressId!,
      if (_appliedCoupon != null) 'coupon': _appliedCoupon!.code,
      if (_message.trim().isNotEmpty) 'note': _message.trim(),
      'fulfillment': _fulfillment,
      if (_preOrderSlot != null &&
          ref.read(cartControllerProvider).items.any((i) => i.department == Department.preorder))
        'slot': _preOrderSlot!,
      if (mode != null) 'method': mode.name,
      if (autoPay && mode != null) 'autopay': '1',
    };
    await context.push(Uri(path: RoutePaths.payment, queryParameters: query).toString());
    if (mounted) await _loadPaymentMode();
  }

  Future<void> _choosePaymentMode(double total, bool pickup) async {
    final mode = await showModalBottomSheet<PaymentModeOption>(
      context: context,
      backgroundColor: Colors.white,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _PaymentOptionsSheet(
        selected: _paymentMode,
        pickup: pickup,
        total: total,
      ),
    );
    if (mode == null || !mounted) return;
    setState(() => _paymentMode = mode);
    await saveLastPaymentMode(mode);
  }

  String _checkoutAttemptKey(List<CartItem> items) =>
      '${_selectedAddressId ?? ''}|${_appliedCoupon?.code ?? ''}|$_fulfillment|${_preOrderSlot ?? ''}|${items.map((i) => '${i.id}:${i.quantity}').join(',')}';

  /// Records the checkout attempt and reads back the server-priced delivery fee.
  Future<void> _syncCheckoutAttempt(List<CartItem> items) async {
    if (items.isEmpty) return;

    final key = _checkoutAttemptKey(items);
    if (key == _lastCheckoutAttemptKey) return;
    _lastCheckoutAttemptKey = key;

    try {
      final response = await ref.read(apiServiceProvider).createCheckoutAttempt({
        if (_selectedAddressId != null) 'addressId': _selectedAddressId,
        'paymentMethod': PaymentUtils.checkoutPaymentMethod(PaymentPlan.full),
        'checkoutItems': _checkoutItemsPayload(items),
        'checkoutMode': 'cart',
        'customerLocation': _customerLocationPayload(),
        if (_appliedCoupon != null) 'couponCode': _appliedCoupon!.code,
        ..._fulfillmentPayload(items),
      });
      final order = ApiResponseParser.getData(response.data) as Map<String, dynamic>;
      final charges = order['deliveryCharges'];
      if (charges is num && mounted) {
        setState(() {
          _serverShipping = charges.toDouble();
          _serverShippingKey = key;
        });
      }
    } catch (_) {
      // Fee falls back to the store-settings estimate; retry on next change.
      _lastCheckoutAttemptKey = null;
    }
  }

  Future<void> _openLocationSheet() async {
    final id = await showSelectDeliveryLocationBottomSheet(context, ref);
    if (!mounted || id == null || id.isEmpty) return;
    setState(() => _selectedAddressId = id);
  }

  Future<void> _openAddressForm() async {
    final id = await showDeliveryAddressFormSheet(context);
    if (!mounted || id == null || id.isEmpty) return;
    setState(() => _selectedAddressId = id);
  }

  Future<void> _changeQuantity(CartItem item, int quantity) async {
    final ok = await ref.read(cartControllerProvider.notifier).updateCartLineQuantity(
          productId: item.id,
          quantity: quantity,
          variantName: item.variantName,
          colorName: item.colorName,
        );
    if (!ok && mounted) {
      final error = ref.read(cartControllerProvider).errorMessage;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error ?? 'Could not update quantity.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _moveToWishlist(CartItem item) async {
    final wishlist = ref.read(wishlistControllerProvider.notifier);
    if (!wishlist.isWishlisted(item.id)) {
      final added = await wishlist.toggleWishlist(
        Product(
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
        ),
      );
      if (!added) return;
    }
    await ref.read(cartControllerProvider.notifier).removeFromCartLine(
          productId: item.id,
          variantName: item.variantName,
          colorName: item.colorName,
        );
  }

  @override
  Widget build(BuildContext context) {
    final isLoggedIn = ref.watch(authControllerProvider.select((s) => s.isLoggedIn));
    final cartItems = ref.watch(cartControllerProvider.select((s) => s.items));
    final cartLoading = ref.watch(cartControllerProvider.select((s) => s.loading));
    final addressList = ref.watch(addressControllerProvider.select((s) => s.addresses));
    final addressesLoading =
        ref.watch(addressControllerProvider.select((s) => s.loading));

    if (!isLoggedIn) {
      return Scaffold(
        backgroundColor: _pageBg,
        appBar: AppBar(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          foregroundColor: _ink,
          elevation: 0,
          title: Text('Checkout', style: _font(size: 17, weight: FontWeight.w800)),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Please login to proceed with checkout.',
                  textAlign: TextAlign.center,
                  style: _font(weight: FontWeight.w500, color: _muted),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  height: 48,
                  child: FilledButton(
                    onPressed: () => ref.read(authControllerProvider.notifier).openAuthModal(),
                    style: FilledButton.styleFrom(
                      backgroundColor: _accent,
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(
                      'Login / Sign Up',
                      style: _font(size: 14, weight: FontWeight.w700, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    _syncSelectedAddress(addressList);
    final isPickup = _fulfillment == FulfillmentType.pickup;
    final storeSettings = ref.watch(storeSettingsProvider).value;
    final baseSummary = calculateCartSummary(cartItems, settings: storeSettings);
    final couponDiscount = (_appliedCoupon?.discountAmount ?? 0)
        .clamp(0.0, baseSummary.subtotal)
        .toDouble();
    final localSummary = applyStorePickup(
      applyCouponDiscount(baseSummary, couponDiscount),
      pickup: isPickup,
    );
    final serverPriced = !isPickup &&
        _serverShipping != null &&
        _serverShippingKey == _checkoutAttemptKey(cartItems);
    final summary =
        serverPriced ? applyServerShipping(localSummary, _serverShipping!) : localSummary;
    final feeKnown = isPickup || serverPriced || storeSettings != null;

    final groups = groupCartByDepartment(cartItems);
    final hasPreOrder = groups.containsKey(Department.preorder);
    final hasNowItems = groups.keys.any((dept) => dept != Department.preorder);
    final slots = storeSettings?.activePreOrderSlots ?? const [];
    final slotChosen = _preOrderSlot != null && slots.any((s) => s.label == _preOrderSlot);
    final slotReady = !hasPreOrder || slotChosen;
    final minimumOrderValue = storeSettings?.minimumOrderValue ?? 0;
    final minimumOrderMet = meetsMinimumOrder(summary.subtotal, minimumOrderValue);
    final orderShortfall = minimumOrderShortfall(summary.subtotal, minimumOrderValue);
    final selectedAddress = _selectedAddressId == null
        ? null
        : addressList.where((a) => a.id == _selectedAddressId).firstOrNull;
    final storeAsync = ref.watch(checkoutStoreProvider(checkoutStoreQuery(
      hasNowItems: hasNowItems,
      fulfillment: _fulfillment,
      address: selectedAddress,
    )));
    final darkStore = storeAsync.value?.store;

    // Delivery nudge only when the fee follows the store's slabs.
    final cheaperSlab = !isPickup &&
            storeSettings != null &&
            (!serverPriced || summary.shipping == shippingChargeFor(summary.subtotal, storeSettings))
        ? nextCheaperShippingSlab(summary.subtotal, storeSettings)
        : null;
    final totalSaved = summary.savings + couponDiscount;
    final mrpTotal = summary.subtotal + summary.savings;

    if (!cartLoading && cartItems.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go(RoutePaths.cart);
      });
    }

    if (!cartLoading && cartItems.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _syncCheckoutAttempt(cartItems);
      });
      final couponsKey = summary.subtotal.toStringAsFixed(2);
      if (_couponsKey != couponsKey) {
        _couponsKey = couponsKey;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _loadCoupons(summary.subtotal, couponsKey);
        });
      }
      final applied = _appliedCoupon;
      if (applied != null && !_applyingCoupon && _couponValidatedFor != summary.subtotal) {
        _couponValidatedFor = summary.subtotal;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _applyCoupon(applied.code);
        });
      }
    }

    final pickupStoreMissing = isPickup && darkStore == null;
    String? blocker;
    if (!minimumOrderMet) {
      blocker =
          'Add ${formatInr(orderShortfall)} more to reach the minimum order of ${formatInr(minimumOrderValue)}';
    } else if (selectedAddress == null) {
      blocker = 'Add a delivery address to continue';
    } else if (!slotReady) {
      blocker = 'Choose a pre-order slot to continue';
    } else if (pickupStoreMissing) {
      blocker = 'No dark store found for pickup at this location';
    }

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: _CheckoutHeader(
        pickup: isPickup,
        address: selectedAddress,
        fallbackAddress: ref.watch(deliveryLocationProvider)?.displayAddress,
        storeName: darkStore?.storeName,
        loading: addressesLoading && addressList.isEmpty,
        onBack: () => context.canPop() ? context.pop() : context.go(RoutePaths.cart),
        onChangeAddress: addressList.isEmpty ? _openAddressForm : _openLocationSheet,
      ),
      body: cartLoading && cartItems.isEmpty
          ? const SkeletonCheckoutPage()
          : ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                if (totalSaved > 0) _SavedStrip(amount: totalSaved),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (!minimumOrderMet) ...[
                        MinimumOrderWarning(
                          subtotal: summary.subtotal,
                          minimumOrderValue: minimumOrderValue,
                          onAddMore: () => context.go(RoutePaths.product),
                        ),
                        const SizedBox(height: 12),
                      ],
                      _Card(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (final entry in groups.entries) ...[
                              DepartmentGroupHeader(
                                department: entry.key,
                                itemCount: entry.value.length,
                                etaText: departmentEtaText(
                                  entry.key,
                                  pickup: isPickup,
                                  preOrderSlot: slotChosen ? _preOrderSlot : null,
                                ),
                              ),
                              for (final item in entry.value)
                                _CheckoutLine(
                                  item: item,
                                  onDecrease: () => _changeQuantity(
                                    item,
                                    getDecreasedCartQuantityForCartItem(item),
                                  ),
                                  onIncrease: () =>
                                      _changeQuantity(item, item.quantity + item.quantityStep),
                                  onMoveToWishlist: () => _moveToWishlist(item),
                                  onTap: () => context.push('/product/${item.id}'),
                                ),
                              if (entry.key != groups.keys.last) const SizedBox(height: 8),
                            ],
                            if (hasPreOrder && hasNowItems)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Text(
                                  'Pre-order and quick items arrive separately, '
                                  'but you pay once for the whole order.',
                                  style: _font(size: 12, weight: FontWeight.w500, color: _muted),
                                ),
                              ),
                            const Divider(height: 1, thickness: 1, color: _slate100),
                            _ActionRow(
                              icon: Icons.add_rounded,
                              iconSize: 20,
                              label: 'Add more items',
                              onTap: () => context.go(RoutePaths.product),
                            ),
                            const Divider(height: 1, thickness: 1, color: _slate100),
                            _ActionRow(
                              icon: Icons.edit_outlined,
                              label: _message.trim().isEmpty
                                  ? 'Add a note for the store'
                                  : 'Note: ${_message.trim()}',
                              onTap: () => setState(() => _showNote = !_showNote),
                            ),
                            if (_showNote)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: TextFormField(
                                  initialValue: _message,
                                  maxLines: 3,
                                  maxLength: _maxOrderNoteLength,
                                  cursorColor: _accent,
                                  style: _font(size: 14, weight: FontWeight.w500),
                                  decoration: InputDecoration(
                                    hintText: 'Any special instructions for your order...',
                                    hintStyle: _font(size: 14, weight: FontWeight.w500, color: _slate400),
                                    isDense: true,
                                    filled: true,
                                    fillColor: _slate100,
                                    contentPadding:
                                        const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: BorderSide.none,
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: Color(0xFFA7F3D0), width: 2),
                                    ),
                                  ),
                                  onChanged: (value) => setState(() => _message = value),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      _Card(
                        title: 'How do you want your order?',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            FulfillmentChoice(
                              value: _fulfillment,
                              onChanged: (value) => setState(() => _fulfillment = value),
                            ),
                            if (isPickup) ...[
                              const SizedBox(height: 12),
                              DarkStoreContactCard(
                                store: darkStore,
                                pickup: true,
                                loading: storeAsync.isLoading && darkStore == null,
                              ),
                            ],
                          ],
                        ),
                      ),
                      if (hasPreOrder) ...[
                        const SizedBox(height: 16),
                        _Card(
                          title: isPickup ? 'Pre-order pickup slot' : 'Pre-order delivery slot',
                          child: PreOrderSlotPicker(
                            slots: slots,
                            selected: _preOrderSlot,
                            onSelected: (label) => setState(() => _preOrderSlot = label),
                          ),
                        ),
                      ],
                      const _SectionLabel('SAVINGS CORNER'),
                      _Card(child: _buildSavingsCorner()),
                      const _SectionLabel('BILL DETAILS'),
                      _Card(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _BillRow(
                              icon: Icons.receipt_long_outlined,
                              label: 'Item Total',
                              struck: summary.savings > 0 ? formatInr(mrpTotal) : null,
                              value: formatInr(summary.subtotal),
                            ),
                            if (couponDiscount > 0)
                              _BillRow(
                                icon: Icons.local_offer_outlined,
                                label: 'Coupon (${_appliedCoupon!.code})',
                                value: '-${formatInr(couponDiscount)}',
                                valueColor: _savedInk,
                              ),
                            _BillRow(
                              icon: isPickup
                                  ? Icons.storefront_outlined
                                  : Icons.pedal_bike_outlined,
                              label: isPickup ? 'Store pickup' : 'Delivery Fee',
                              value: !feeKnown
                                  ? 'Calculating…'
                                  : summary.shippingFree
                                      ? 'FREE'
                                      : formatInr(summary.shipping),
                              valueColor: feeKnown && summary.shippingFree ? _savedInk : null,
                              note: cheaperSlab == null
                                  ? null
                                  : 'Add ${formatInr(cheaperSlab.orderAmount - summary.subtotal)} more for '
                                      '${cheaperSlab.shippingCharge <= 0 ? 'FREE delivery' : '${formatInr(cheaperSlab.shippingCharge)} delivery'}',
                            ),
                            Padding(
                              padding: const EdgeInsets.only(left: 32),
                              child: Text(
                                'GST included in item prices',
                                style: _font(size: 11, weight: FontWeight.w500, color: _muted),
                              ),
                            ),
                            const _DashedDivider(),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    'To Pay',
                                    style: _font(size: 15, weight: FontWeight.w800),
                                  ),
                                ),
                                if (totalSaved > 0 && feeKnown) ...[
                                  Text(
                                    formatInr(mrpTotal + summary.shipping),
                                    style: _font(
                                      size: 12,
                                      weight: FontWeight.w500,
                                      color: _slate400,
                                      decoration: TextDecoration.lineThrough,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                ],
                                Text(
                                  formatInr(summary.total),
                                  style: _font(size: 15, weight: FontWeight.w800),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      _CancellationNote(onReadPolicy: () => context.push(RoutePaths.terms)),
                    ],
                  ),
                ),
              ],
            ),
      bottomNavigationBar: cartItems.isEmpty
          ? null
          : _PayBar(
              mode: _paymentMode,
              pickup: isPickup,
              total: summary.total,
              feeKnown: feeKnown,
              blocker: blocker,
              minimumOrderMet: minimumOrderMet,
              onChange: () => _choosePaymentMode(summary.total, isPickup),
              onSlid: () => _paymentMode == null
                  ? _choosePaymentMode(summary.total, isPickup)
                  : _openPayment(autoPay: true),
            ),
    );
  }

  Widget _buildSavingsCorner() {
    final applied = _appliedCoupon;
    final suggestion = _suggestedCoupon();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (applied != null)
          _CouponRow(
            title: 'You saved ${formatInr(applied.discountAmount)} with \'${applied.code}\'',
            subtitle: applied.title.trim().isNotEmpty ? applied.title.trim() : 'Coupon applied',
            actionLabel: 'Remove',
            actionColor: Colors.red.shade700,
            onAction: _removeCoupon,
          ),
        if (applied != null && suggestion != null)
          const Divider(height: 24, thickness: 1, color: _slate100),
        if (suggestion != null)
          _CouponRow(
            title: suggestion.unlocked
                ? 'Save ${formatInr(suggestion.discountAmount)} with \'${suggestion.code}\''
                : suggestion.headline,
            subtitle: suggestion.unlocked ? suggestion.headline : suggestion.unlockMessage,
            actionLabel: suggestion.unlocked ? 'Apply' : null,
            onAction: suggestion.unlocked && !_applyingCoupon
                ? () => _applyCoupon(suggestion.code)
                : null,
          ),
        if (applied == null) ...[
          if (suggestion != null) const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _couponController,
                  textCapitalization: TextCapitalization.characters,
                  cursorColor: _accent,
                  style: _font(size: 14, weight: FontWeight.w600),
                  decoration: InputDecoration(
                    hintText: 'Enter coupon code',
                    hintStyle: _font(size: 14, weight: FontWeight.w500, color: _slate400),
                    isDense: true,
                    filled: true,
                    fillColor: _slate100,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFA7F3D0), width: 2),
                    ),
                  ),
                  onSubmitted: _applyCoupon,
                ),
              ),
              const SizedBox(width: 4),
              TextButton(
                onPressed: _applyingCoupon ? null : () => _applyCoupon(_couponController.text),
                style: TextButton.styleFrom(
                  foregroundColor: _accent,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  minimumSize: const Size(0, 40),
                ),
                child: _applyingCoupon
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: _accent),
                      )
                    : Text('APPLY', style: _font(size: 14, weight: FontWeight.w800, color: _accent)),
              ),
            ],
          ),
        ],
        if (_couponError.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            _couponError,
            style: _font(size: 12, weight: FontWeight.w500, color: Colors.red.shade700),
          ),
        ],
        const SizedBox(height: 12),
        const Divider(height: 1, thickness: 1, color: _slate100),
        InkWell(
          onTap: _openCoupons,
          child: Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Row(
              children: [
                Container(
                  width: 20,
                  height: 20,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: _ink, width: 2),
                  ),
                  child: Text('%', style: _font(size: 10, weight: FontWeight.w900)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'View all coupons & offers',
                    style: _font(size: 14, weight: FontWeight.w700),
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, size: 20, color: _slate400),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CheckoutHeader extends StatelessWidget implements PreferredSizeWidget {
  const _CheckoutHeader({
    required this.pickup,
    required this.address,
    required this.fallbackAddress,
    required this.storeName,
    required this.loading,
    required this.onBack,
    required this.onChangeAddress,
  });

  final bool pickup;
  final Address? address;
  final String? fallbackAddress;
  final String? storeName;
  final bool loading;
  final VoidCallback onBack;
  final VoidCallback onChangeAddress;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final addr = address;
    final String title;
    final String line;
    if (pickup) {
      title = 'Pickup from ${storeName?.trim().isNotEmpty == true ? storeName!.trim() : 'dark store'}';
      line = addr != null ? 'Contact: ${getAddressFullName(addr)}' : 'Collect with your order OTP';
    } else if (addr != null) {
      title = addr.shopName.trim().isNotEmpty ? addr.shopName.trim() : getAddressFullName(addr);
      line = formatAddressLine(addr);
    } else {
      title = loading ? 'Loading address…' : 'Add delivery address';
      line = fallbackAddress ?? 'Choose where to deliver your order';
    }

    return AppBar(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      elevation: 0,
      toolbarHeight: 64,
      titleSpacing: 0,
      leadingWidth: 52,
      shape: const Border(bottom: BorderSide(color: Color(0x0F0F172A))),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: _ink),
        tooltip: 'Back',
        onPressed: onBack,
      ),
      title: InkWell(
        onTap: onChangeAddress,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Row(
            children: [
              const Icon(Icons.near_me_rounded, size: 20, color: _accent),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _font(size: 15.5, weight: FontWeight.w800),
                          ),
                        ),
                        const SizedBox(width: 2),
                        const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: _ink),
                      ],
                    ),
                    Text(
                      line,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _font(size: 12, weight: FontWeight.w500, color: _muted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
            ],
          ),
        ),
      ),
    );
  }
}

class _SavedStrip extends StatelessWidget {
  const _SavedStrip({required this.amount});

  final double amount;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _savedBg,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.verified_rounded, size: 16, color: _savedInk),
          const SizedBox(width: 6),
          Text(
            '${formatInr(amount)} saved!',
            style: _font(size: 14, weight: FontWeight.w800, color: _savedInk),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.title});

  final Widget child;
  final String? title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null) ...[
            Text(title!, style: _font(size: 14, weight: FontWeight.w800)),
            const SizedBox(height: 12),
          ],
          child,
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 20, 4, 10),
      child: Text(
        text.toUpperCase(),
        style: _font(size: 12, weight: FontWeight.w800, color: _muted, letterSpacing: 1.4),
      ),
    );
  }
}

class _CheckoutLine extends StatelessWidget {
  const _CheckoutLine({
    required this.item,
    required this.onDecrease,
    required this.onIncrease,
    required this.onMoveToWishlist,
    required this.onTap,
  });

  final CartItem item;
  final VoidCallback onDecrease;
  final VoidCallback onIncrease;
  final VoidCallback onMoveToWishlist;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final image = item.productImages.isNotEmpty ? item.productImages.first : null;
    final mrp = item.price * item.quantity;
    final showMrp = mrp > item.lineTotal + 0.009;
    final details = [
      if (item.variantName.isNotEmpty) item.variantName,
      if (item.colorName.isNotEmpty) item.colorName,
    ].join(' · ');

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: onTap,
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: _slate100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: image != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: AppNetworkImage(
                        imageUrl: image,
                        fit: BoxFit.contain,
                        width: 56,
                        height: 56,
                        cacheWidth: 112,
                        cacheHeight: 112,
                        errorIcon: Icons.image_outlined,
                      ),
                    )
                  : const Icon(Icons.image_outlined, color: _slate400),
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
                    style: _font(size: 13.5, weight: FontWeight.w600),
                  ),
                ),
                if (details.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(details, style: _font(size: 12, weight: FontWeight.w500, color: _muted)),
                ],
                const SizedBox(height: 6),
                GestureDetector(
                  onTap: onMoveToWishlist,
                  child: Text(
                    'Move to wishlist',
                    style: _font(
                      size: 12,
                      weight: FontWeight.w600,
                      color: _muted,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _Stepper(quantity: item.quantity, onDecrease: onDecrease, onIncrease: onIncrease),
              const SizedBox(height: 8),
              if (showMrp)
                Text(
                  formatInr(mrp),
                  style: _font(
                    size: 11.5,
                    weight: FontWeight.w500,
                    color: _slate400,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
              Text(formatInr(item.lineTotal), style: _font(size: 13.5, weight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.quantity,
    required this.onDecrease,
    required this.onIncrease,
  });

  final int quantity;
  final VoidCallback onDecrease;
  final VoidCallback onIncrease;

  @override
  Widget build(BuildContext context) {
    Widget button(IconData icon, VoidCallback onTap) => InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(9),
          child: SizedBox(
            width: 32,
            height: 32,
            child: Icon(icon, size: 16, color: _accent, weight: 700),
          ),
        );

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _slate300),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          button(Icons.remove_rounded, onDecrease),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 22),
            child: Text(
              '$quantity',
              textAlign: TextAlign.center,
              style: _font(size: 14, weight: FontWeight.w800, color: _accent),
            ),
          ),
          button(Icons.add_rounded, onIncrease),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.iconSize = 16,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            SizedBox(
              width: 20,
              child: Icon(icon, size: iconSize, color: _ink),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _font(size: 14, weight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CouponRow extends StatelessWidget {
  const _CouponRow({
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.actionColor = _accent,
    this.onAction,
  });

  final String title;
  final String subtitle;
  final String? actionLabel;
  final Color actionColor;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: const BoxDecoration(color: Color(0xFFFFEDD5), shape: BoxShape.circle),
          child: const Icon(Icons.local_offer_rounded, size: 16, color: Color(0xFFEA580C)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: _font(size: 13.5, weight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(subtitle, style: _font(size: 12, weight: FontWeight.w500, color: _muted)),
            ],
          ),
        ),
        if (actionLabel != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: actionColor,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(0, 36),
            ),
            child: Text(
              actionLabel!,
              style: _font(
                size: 14,
                weight: FontWeight.w800,
                color: onAction == null ? actionColor.withValues(alpha: 0.5) : actionColor,
              ),
            ),
          ),
      ],
    );
  }
}

class _BillRow extends StatelessWidget {
  const _BillRow({
    required this.icon,
    required this.label,
    required this.value,
    this.struck,
    this.valueColor,
    this.note,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? struck;
  final Color? valueColor;
  final String? note;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 20,
                child: Icon(icon, size: 17, color: _muted),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label, style: _font(weight: FontWeight.w500, color: _slate700)),
              ),
              if (struck != null) ...[
                Text(
                  struck!,
                  style: _font(
                    size: 12,
                    weight: FontWeight.w500,
                    color: _slate400,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Text(value, style: _font(weight: FontWeight.w700, color: valueColor ?? _ink)),
            ],
          ),
          if (note != null)
            Padding(
              padding: const EdgeInsets.only(left: 32, top: 2),
              child: Text(
                note!,
                style: _font(size: 11.5, weight: FontWeight.w600, color: _accent),
              ),
            ),
        ],
      ),
    );
  }
}

class _DashedDivider extends StatelessWidget {
  const _DashedDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final count = (constraints.maxWidth / 6).floor();
          return Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(
              count,
              (_) => const SizedBox(
                width: 3,
                height: 1,
                child: ColoredBox(color: _slate300),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _CancellationNote extends StatelessWidget {
  const _CancellationNote({required this.onReadPolicy});

  final VoidCallback onReadPolicy;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('NOTE:', style: _font(size: 12, weight: FontWeight.w800, color: _muted)),
          const SizedBox(height: 4),
          Text(
            'You can cancel this order until the store starts packing it. '
            'Once it is packed, it can no longer be cancelled.',
            style: _font(size: 12, weight: FontWeight.w500, color: _muted).copyWith(height: 1.6),
          ),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: onReadPolicy,
            child: Text(
              'READ CANCELLATION POLICY',
              style: _font(
                size: 12,
                weight: FontWeight.w800,
                color: _accent,
                decoration: TextDecoration.underline,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentOptionsSheet extends StatelessWidget {
  const _PaymentOptionsSheet({
    required this.selected,
    required this.pickup,
    required this.total,
  });

  final PaymentModeOption? selected;
  final bool pickup;
  final double total;

  @override
  Widget build(BuildContext context) {
    final options = [
      (
        mode: PaymentModeOption.cod,
        subtitle: pickup
            ? 'Cash or UPI when you collect your order'
            : 'Cash or UPI when your order arrives',
      ),
      (
        mode: PaymentModeOption.online,
        subtitle: '${formatInr(total, withDecimals: true)} by UPI or card',
      ),
    ];

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Payment Options', style: _font(size: 17, weight: FontWeight.w800)),
            const SizedBox(height: 14),
            for (final option in options) ...[
              _PaymentOptionTile(
                mode: option.mode,
                title: option.mode.title(pickup: pickup),
                subtitle: option.subtitle,
                selected: selected == option.mode,
                onTap: () => Navigator.pop(context, option.mode),
              ),
              const SizedBox(height: 10),
            ],
          ],
        ),
      ),
    );
  }
}

class _PaymentOptionTile extends StatelessWidget {
  const _PaymentOptionTile({
    required this.mode,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final PaymentModeOption mode;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFF0FDF4) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: selected ? _accent : const Color(0xFFE2E8F0)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: selected ? const Color(0xFFD1FAE5) : _slate100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(mode.icon, size: 20, color: selected ? _accent : const Color(0xFF475569)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: _font(size: 14, weight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: _font(size: 12, weight: FontWeight.w500, color: _muted)),
                  ],
                ),
              ),
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? _accent : Colors.transparent,
                  border: Border.all(color: selected ? _accent : _slate300, width: 2),
                ),
                child: selected
                    ? Center(
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                        ),
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PayBar extends StatelessWidget {
  const _PayBar({
    required this.mode,
    required this.pickup,
    required this.total,
    required this.feeKnown,
    required this.blocker,
    required this.minimumOrderMet,
    required this.onChange,
    required this.onSlid,
  });

  final PaymentModeOption? mode;
  final bool pickup;
  final double total;
  final bool feeKnown;
  final String? blocker;
  final bool minimumOrderMet;
  final VoidCallback? onChange;
  final VoidCallback onSlid;

  @override
  Widget build(BuildContext context) {
    final current = mode;
    final ready = blocker == null && feeKnown;

    return Container(
      padding: EdgeInsets.fromLTRB(14, 10, 14, MediaQuery.paddingOf(context).bottom + 10),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 20,
            spreadRadius: -6,
            offset: const Offset(0, -8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (blocker != null) ...[
            Text(
              blocker!,
              textAlign: TextAlign.center,
              style: _font(
                size: 11.5,
                weight: FontWeight.w600,
                color: minimumOrderMet ? _muted : const Color(0xFF9A3412),
              ),
            ),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PAY USING',
                      style: _font(size: 10.5, weight: FontWeight.w700, color: _muted, letterSpacing: 1.0),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (current != null) ...[
                          Icon(current.icon, size: 16, color: _accent),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            current?.label(pickup: pickup) ?? 'Choose payment method',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _font(size: 14, weight: FontWeight.w800),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: onChange,
                style: TextButton.styleFrom(
                  foregroundColor: _accent,
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  minimumSize: const Size(0, 36),
                ),
                child: Text(
                  current == null ? 'Choose' : 'Change',
                  style: _font(
                    size: 14,
                    weight: FontWeight.w800,
                    color: onChange == null ? _slate400 : _accent,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _SlideToPay(
            label: current == null
                ? 'Slide to choose payment'
                : current == PaymentModeOption.cod
                    ? 'Slide to Place Order'
                    : 'Slide to Pay',
            amount: feeKnown ? formatInr(total) : '…',
            enabled: ready,
            onSlid: onSlid,
          ),
        ],
      ),
    );
  }
}

class _SlideToPay extends StatefulWidget {
  const _SlideToPay({
    required this.label,
    required this.amount,
    required this.enabled,
    required this.onSlid,
  });

  final String label;
  final String amount;
  final bool enabled;
  final VoidCallback onSlid;

  @override
  State<_SlideToPay> createState() => _SlideToPayState();
}

class _SlideToPayState extends State<_SlideToPay> {
  static const _height = 56.0;
  static const _knob = 48.0;
  static const _inset = 4.0;

  double _drag = 0;
  bool _done = false;

  void _finish(double max) {
    if (_drag >= max * 0.85) {
      setState(() {
        _drag = max;
        _done = true;
      });
      widget.onSlid();
      Future.delayed(const Duration(milliseconds: 600), () {
        if (mounted) {
          setState(() {
            _drag = 0;
            _done = false;
          });
        }
      });
    } else {
      setState(() => _drag = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.enabled && !_done;

    return Semantics(
      button: true,
      enabled: widget.enabled,
      label: '${widget.label} ${widget.amount}',
      onTap: widget.enabled ? widget.onSlid : null,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final max = (constraints.maxWidth - _knob - _inset * 2).clamp(0.0, double.infinity);
          final progress = max == 0 ? 0.0 : (_drag / max).clamp(0.0, 1.0);

          return AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            height: _height,
            decoration: BoxDecoration(
              color: widget.enabled ? _accent : _slate300,
              borderRadius: BorderRadius.circular(16),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                Positioned.fill(
                  child: Opacity(
                    opacity: 1 - progress,
                    child: Padding(
                      padding: const EdgeInsets.only(left: 56, right: 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text(
                              widget.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: _font(size: 15, weight: FontWeight.w800, color: Colors.white),
                            ),
                          ),
                          Container(
                            width: 1,
                            height: 18,
                            margin: const EdgeInsets.symmetric(horizontal: 10),
                            color: Colors.white.withValues(alpha: 0.5),
                          ),
                          Text(
                            widget.amount,
                            style: _font(size: 15, weight: FontWeight.w800, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                AnimatedPositioned(
                  duration: Duration(milliseconds: _drag == 0 || _done ? 200 : 0),
                  left: _inset + _drag,
                  top: _inset,
                  bottom: _inset,
                  child: GestureDetector(
                    onHorizontalDragUpdate: enabled
                        ? (details) =>
                            setState(() => _drag = (_drag + details.delta.dx).clamp(0.0, max))
                        : null,
                    onHorizontalDragEnd: enabled ? (_) => _finish(max) : null,
                    child: Container(
                      width: _knob,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: Icon(
                        Icons.keyboard_double_arrow_right_rounded,
                        size: 26,
                        color: widget.enabled ? _accent : _slate400,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
