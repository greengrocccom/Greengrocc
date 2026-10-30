import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../core/exceptions/api_exception.dart';
import '../../core/network/api_response_parser.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/location_provider.dart';
import '../../core/utils/address_utils.dart';
import '../../core/utils/cart_utils.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/payment_utils.dart';
import '../../core/utils/razorpay_error_message.dart';
import '../../features/address/address_controller.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/cart/cart_controller.dart';
import '../../core/utils/department_utils.dart';
import '../../models/address.dart';
import '../../models/dark_store.dart';
import '../../models/cart_item.dart';
import '../../models/coupon.dart';
import '../../routes/route_paths.dart';
import '../../widgets/address/select_delivery_location_sheet.dart';
import '../../features/settings/store_settings_provider.dart';
import 'checkout_fulfillment_widgets.dart';
import 'payment_method.dart';

const _pageBg = Color(0xFFF1F2F6);
const _ink = Color(0xFF0F172A);
const _muted = Color(0xFF64748B);
const _slate700 = Color(0xFF334155);
const _slate200 = Color(0xFFE2E8F0);
const _slate100 = Color(0xFFF1F5F9);
const _accent = Color(0xFF047857);

class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({
    super.key,
    this.selectedAddressId,
    this.appliedCouponCode,
    this.customerMessage,
    this.fulfillmentType = 'delivery',
    this.preOrderSlot,
    this.initialMode,
    this.autoPay = false,
  });

  final String? selectedAddressId;
  final String? appliedCouponCode;
  final String? customerMessage;
  /// "delivery" or "pickup" (customer collects from the dark store)
  final String fulfillmentType;
  /// Chosen next-day slot for the cart's pre-order items
  final String? preOrderSlot;
  /// Method picked on checkout; falls back to the last one used.
  final PaymentModeOption? initialMode;
  /// Start paying with [initialMode] as soon as the screen is ready
  /// (checkout's "Slide to Pay").
  final bool autoPay;

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  late final Razorpay _razorpay;

  PaymentModeOption _selectedMode = PaymentModeOption.cod;
  final String _paymentPlan = PaymentPlan.full;
  bool _placingOrder = false;
  bool _orderPlaced = false;
  String _errorMessage = '';
  String _orderSuccessNote = '';
  String? _attemptedOrderId;
  String? _lastAttemptKey;
  AppliedCoupon? _appliedCoupon;
  DarkStore? _orderStore;
  CheckoutStoreQuery? _storeQuery;
  double? _serverShipping;
  String? _serverShippingKey;
  String? _pricingRequestedKey;
  bool _autoPayPending = false;
  bool _setupDone = false;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handleRazorpaySuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handleRazorpayError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);

    final initial = widget.initialMode;
    if (initial != null) _selectedMode = initial;
    _autoPayPending = widget.autoPay && initial != null;

    Future.microtask(() async {
      ref.read(addressControllerProvider.notifier).loadAddresses();
      final code = widget.appliedCouponCode?.trim();
      final couponFuture =
          code != null && code.isNotEmpty ? _fetchCoupon(code) : Future<void>.value();
      if (initial == null) {
        final last = await loadLastPaymentMode();
        if (last != null && mounted) setState(() => _selectedMode = last);
      }
      // Auto-pay must include the coupon the customer saw on checkout.
      await couponFuture;
      if (mounted) setState(() => _setupDone = true);
    });
  }

  void _selectMode(PaymentModeOption mode) {
    setState(() => _selectedMode = mode);
    saveLastPaymentMode(mode);
  }

  String _pricingKey(List<CartItem> items, String? addressId) =>
      '${_resolveAddressId(addressId) ?? ''}|${_appliedCoupon?.code ?? ''}|${widget.fulfillmentType}|${widget.preOrderSlot ?? ''}|${items.map((i) => '${i.id}:${i.quantity}').join(',')}';

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _fetchCoupon(String code) async {
    try {
      final cartItems = ref.read(cartControllerProvider).items;
      final subtotal = calculateCartSummary(cartItems).subtotal;
      final coupon = await ref
          .read(apiServiceProvider)
          .validateCoupon(code: code, subtotal: subtotal);
      if (mounted) {
        setState(() {
          _appliedCoupon = coupon;
        });
      }
    } catch (_) {}
  }

  List<Map<String, dynamic>> _checkoutItemsPayload(List<CartItem> items) {
    return items
        .map(
          (item) => {
            'productId': item.id,
            'quantity': item.quantity,
            'variantName': item.variantName,
            'colorName': item.colorName,
            'name': item.name,
            'price': item.price,
            'discountedPrice': item.discountedPrice,
            'brandName': item.brandName,
            'image': item.productImages.isNotEmpty ? item.productImages.first : '',
          },
        )
        .toList();
  }

  bool get _isPickup => widget.fulfillmentType == FulfillmentType.pickup;

  Map<String, dynamic> _fulfillmentPayload() {
    final slot = widget.preOrderSlot?.trim() ?? '';
    return {
      'fulfillmentType': widget.fulfillmentType,
      if (slot.isNotEmpty) 'preOrderSlot': slot,
    };
  }

  String? _resolveAddressId(String? id) {
    if (id == null ||
        id.trim().isEmpty ||
        id == 'default_address' ||
        id == 'defult_address') {
      return null;
    }
    return id;
  }

  Map<String, dynamic>? _customerLocationPayload({Address? address}) {
    Address? target = address;
    if (target == null && widget.selectedAddressId != null) {
      final addresses = ref.read(addressControllerProvider).addresses;
      target = addresses.where((a) => a.id == widget.selectedAddressId).firstOrNull;
    }
    if (target != null) {
      final loc = target.location;
      final lat = loc?['lat'];
      final lng = loc?['lng'];
      final latNum = lat is num ? lat.toDouble() : double.tryParse('$lat');
      final lngNum = lng is num ? lng.toDouble() : double.tryParse('$lng');
      return {
        'city': target.city,
        'area': target.area,
        'state': target.state,
        'pincode': target.pincode,
        'fullAddress': target.fullAddress,
        if (latNum != null && lngNum != null) ...{
          'lat': latNum,
          'lng': lngNum,
          'location': {'lat': latNum, 'lng': lngNum},
        },
      };
    }
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

  Future<String?> _syncCheckoutAttempt(
    List<CartItem> items,
    String addressId, {
    bool force = false,
  }) async {
    if (_orderPlaced || items.isEmpty) return _attemptedOrderId;

    final resolvedId = _resolveAddressId(addressId);
    final key =
        '${resolvedId ?? ''}|$_paymentPlan|${_appliedCoupon?.code ?? ''}|${widget.fulfillmentType}|${widget.preOrderSlot ?? ''}|${items.map((i) => '${i.id}:${i.quantity}').join(',')}';
    if (!force && key == _lastAttemptKey && _attemptedOrderId != null) {
      return _attemptedOrderId;
    }

    try {
      final response = await ref.read(apiServiceProvider).createCheckoutAttempt({
        if (resolvedId != null) 'addressId': resolvedId,
        'paymentMethod': _selectedMode == PaymentModeOption.cod ? 'cod' : 'online',
        'checkoutItems': _checkoutItemsPayload(items),
        'checkoutMode': 'cart',
        'customerLocation': _customerLocationPayload(),
        if (_appliedCoupon != null) 'couponCode': _appliedCoupon!.code,
        ..._fulfillmentPayload(),
      });
      final order = ApiResponseParser.getData(response.data) as Map<String, dynamic>;
      final charges = order['deliveryCharges'];
      if (charges is num && mounted) {
        setState(() {
          _serverShipping = charges.toDouble();
          _serverShippingKey = _pricingKey(items, addressId);
        });
      }
      final orderId = order['_id']?.toString();
      if (orderId != null && orderId.isNotEmpty) {
        _attemptedOrderId = orderId;
        _lastAttemptKey = key;
        return orderId;
      }
    } catch (_) {}

    return _attemptedOrderId;
  }

  Future<void> _processPayment(Address address) async {
    if (_placingOrder) return;

    final auth = ref.read(authControllerProvider);
    if (!auth.isLoggedIn || auth.user == null) {
      ref.read(authControllerProvider.notifier).openAuthModal(AuthModalMode.login);
      return;
    }

    setState(() => _errorMessage = '');

    final cartItems = ref.read(cartControllerProvider).items;
    if (cartItems.isEmpty) {
      setState(() => _errorMessage = 'Your cart is empty.');
      return;
    }

    saveLastPaymentMode(_selectedMode);
    await _syncCheckoutAttempt(cartItems, address.id, force: true);

    if (_selectedMode == PaymentModeOption.cod) {
      await _placeCodOrder(address);
    } else {
      await _startRazorpayPayment(address);
    }
  }

  Future<void> _startRazorpayPayment(Address address) async {
    setState(() {
      _placingOrder = true;
      _errorMessage = '';
    });

    try {
      final cartItems = ref.read(cartControllerProvider).items;
      final resolvedId = _resolveAddressId(address.id);
      final response = await ref.read(apiServiceProvider).createRazorpayOrder({
        if (resolvedId != null) 'addressId': resolvedId,
        'paymentMode': _paymentPlan,
        'checkoutItems': _checkoutItemsPayload(cartItems),
        'checkoutMode': 'cart',
        'customerLocation': _customerLocationPayload(address: address),
        if (_appliedCoupon != null) 'couponCode': _appliedCoupon!.code,
        ..._fulfillmentPayload(),
      });
      final body = ApiResponseParser.getData(response.data);
      if (body is! Map<String, dynamic>) {
        throw ApiException(
          ApiResponseParser.getMessage(response.data) ??
              'Invalid payment response from server.',
        );
      }

      final attemptedId = body['attemptedOrderId']?.toString();
      if (attemptedId != null && attemptedId.isNotEmpty) {
        _attemptedOrderId = attemptedId;
      }

      final keyId = body['keyId']?.toString() ?? '';
      final razorpayOrderId = body['razorpayOrderId']?.toString() ?? '';
      final amountRaw = body['amount'];
      final amountPaise = amountRaw is int
          ? amountRaw
          : int.tryParse(amountRaw?.toString() ?? '');

      if (keyId.isEmpty || razorpayOrderId.isEmpty) {
        throw ApiException(
          ApiResponseParser.getMessage(response.data) ??
              'Online payment is not configured. Please contact support.',
        );
      }
      if (amountPaise == null || amountPaise <= 0) {
        throw ApiException('Invalid payment amount.');
      }

      setState(() => _placingOrder = false);

      final user = ref.read(authControllerProvider).user!;
      final options = <String, dynamic>{
        'key': keyId,
        'amount': amountPaise,
        'order_id': razorpayOrderId,
        'name': 'GreenGrocc',
        'description': 'Order payment',
        'prefill': {
          'contact': user.phone,
          'email': user.email,
          'name': user.name,
        },
        'theme': {'color': '#047857'},
      };

      _razorpay.open(options);
    } catch (e) {
      final msg = apiErrorMessage(e, fallback: 'Failed to start payment. Try again.');
      setState(() {
        _placingOrder = false;
        _errorMessage = msg;
      });
    }
  }

  Future<void> _handleRazorpaySuccess(PaymentSuccessResponse response) async {
    setState(() {
      _placingOrder = true;
      _errorMessage = '';
    });

    try {
      final cartItems = ref.read(cartControllerProvider).items;
      final addresses = ref.read(addressControllerProvider.select((s) => s.addresses));
      final defaultAddr = addresses.where((a) => a.isDefault).firstOrNull ?? addresses.firstOrNull;
      final rawId = widget.selectedAddressId ?? defaultAddr?.id;
      final resolvedId = _resolveAddressId(rawId);

      await ref.read(apiServiceProvider).verifyRazorpayPayment({
        if (resolvedId != null) 'addressId': resolvedId,
        'paymentMode': _paymentPlan,
        'customerMessage': widget.customerMessage?.trim() ?? '',
        'checkoutItems': _checkoutItemsPayload(cartItems),
        'checkoutMode': 'cart',
        'customerLocation': _customerLocationPayload(address: defaultAddr),
        if (_appliedCoupon != null) 'couponCode': _appliedCoupon!.code,
        if (_attemptedOrderId != null) 'attemptedOrderId': _attemptedOrderId,
        'razorpay_order_id': response.orderId,
        'razorpay_payment_id': response.paymentId,
        'razorpay_signature': response.signature,
        ..._fulfillmentPayload(),
      });

      await _completeOrderSuccess('Order placed and payment confirmed via Razorpay!');
    } catch (e) {
      setState(() {
        _errorMessage = apiErrorMessage(
          e,
          fallback: 'Payment verified but order creation failed. Contact support.',
        );
        _placingOrder = false;
      });
    }
  }

  void _handleRazorpayError(PaymentFailureResponse response) {
    final msg = razorpayErrorMessage(response);
    setState(() {
      _placingOrder = false;
      _errorMessage = msg;
    });
  }

  void _handleExternalWallet(ExternalWalletResponse response) {}

  Future<void> _placeCodOrder(Address address) async {
    setState(() {
      _placingOrder = true;
      _errorMessage = '';
    });

    try {
      final cartItems = ref.read(cartControllerProvider).items;
      final resolvedId = _resolveAddressId(address.id);
      final response = await ref.read(apiServiceProvider).placeOrder({
        if (resolvedId != null) 'addressId': resolvedId,
        'paymentMethod': 'cod',
        'customerMessage': widget.customerMessage?.trim() ?? '',
        'checkoutItems': _checkoutItemsPayload(cartItems),
        'checkoutMode': 'cart',
        'customerLocation': _customerLocationPayload(address: address),
        if (_appliedCoupon != null) 'couponCode': _appliedCoupon!.code,
        ..._fulfillmentPayload(),
      });

      final body = ApiResponseParser.getData(response.data);
      if (body is! Map<String, dynamic>) {
        throw ApiException(
          ApiResponseParser.getMessage(response.data) ??
              'Failed to create COD order.',
        );
      }

      await _completeOrderSuccess(
        _isPickup
            ? 'Order placed! Pay when you collect it at the dark store.'
            : 'Order placed successfully with Cash on Delivery! Pay when your order arrives.',
      );
    } catch (e) {
      setState(() {
        _placingOrder = false;
        _errorMessage = apiErrorMessage(e, fallback: 'Failed to place COD order.');
      });
    }
  }

  Future<void> _completeOrderSuccess(String note) async {
    final query = _storeQuery;
    final store = query == null ? null : ref.read(checkoutStoreProvider(query)).value?.store;
    setState(() {
      _orderPlaced = true;
      _placingOrder = false;
      _orderSuccessNote = note;
      _orderStore = store;
    });
    await ref.read(cartControllerProvider.notifier).loadCart();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    if (!auth.isLoggedIn) {
      return Scaffold(
        backgroundColor: _pageBg,
        appBar: AppBar(
          backgroundColor: Colors.white,
          foregroundColor: _ink,
          elevation: 0,
          title: Text(
            'Payment',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_outline_rounded, size: 56, color: _muted),
                const SizedBox(height: 16),
                Text(
                  'Please login to complete your payment and place this order.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _slate700,
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  height: 48,
                  child: FilledButton(
                    onPressed: () => ref.read(authControllerProvider.notifier).openAuthModal(AuthModalMode.login),
                    style: FilledButton.styleFrom(
                      backgroundColor: _accent,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Login / Sign Up', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final cartItems = ref.watch(cartControllerProvider.select((s) => s.items));
    final addressList = ref.watch(addressControllerProvider.select((s) => s.addresses));
    final deliveryLoc = ref.watch(deliveryLocationProvider);

    final selectedAddress = widget.selectedAddressId != null
        ? addressList.where((a) => a.id == widget.selectedAddressId).firstOrNull
        : (addressList.where((a) => a.isDefault).firstOrNull ?? addressList.firstOrNull);

    final Address effectiveAddress = selectedAddress ??
        Address(
          id: widget.selectedAddressId ?? 'default_address',
          fullName: 'Customer',
          number: '',
          email: '',
          shopNo: '',
          shopName: '',
          fullAddress: deliveryLoc?.displayAddress ?? 'Default Delivery Location',
          landmark: '',
          city: deliveryLoc?.city ?? 'City',
          state: 'State',
          pincode: '000000',
          isDefault: true,
        );

    final storeSettings = ref.watch(storeSettingsProvider).value;
    final baseSummary = calculateCartSummary(cartItems, settings: storeSettings);
    final couponDiscount = (_appliedCoupon?.discountAmount ?? 0)
        .clamp(0.0, baseSummary.subtotal)
        .toDouble();
    final localSummary = applyStorePickup(
      applyCouponDiscount(baseSummary, couponDiscount),
      pickup: _isPickup,
    );
    final serverPriced = !_isPickup &&
        _serverShipping != null &&
        _serverShippingKey == _pricingKey(cartItems, effectiveAddress.id);

    final summary = serverPriced
        ? applyServerShipping(localSummary, _serverShipping!)
        : localSummary;

    final pricingKey = _pricingKey(cartItems, effectiveAddress.id);
    if (cartItems.isNotEmpty && !_orderPlaced && _pricingRequestedKey != pricingKey) {
      _pricingRequestedKey = pricingKey;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _syncCheckoutAttempt(cartItems, effectiveAddress.id);
      });
    }
    if (_autoPayPending &&
        _setupDone &&
        selectedAddress != null &&
        cartItems.isNotEmpty &&
        !_placingOrder) {
      _autoPayPending = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _processPayment(effectiveAddress);
      });
    }
    final hasPreOrder = cartItems.any((item) => item.department == Department.preorder);
    final hasNowItems = cartItems.any((item) => item.department != Department.preorder);
    if (!_orderPlaced) {
      _storeQuery = checkoutStoreQuery(
        hasNowItems: hasNowItems,
        fulfillment: widget.fulfillmentType,
        address: selectedAddress,
      );
    }
    final storeAsync = ref.watch(checkoutStoreProvider(_storeQuery!));
    final darkStore = storeAsync.value?.store;
    final slot = widget.preOrderSlot?.trim() ?? '';

    final payableNow = PaymentUtils.payableAmount(summary.total, _paymentPlan);
    final itemCount = summary.itemCount;
    final etaLines = [
      if (hasNowItems) departmentEtaText(Department.instant, pickup: _isPickup),
      if (hasPreOrder)
        'Pre-order · ${departmentEtaText(Department.preorder, pickup: _isPickup, preOrderSlot: slot)}',
    ];
    final amountText = formatInr(payableNow, withDecimals: true);

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        foregroundColor: _ink,
        elevation: 0,
        toolbarHeight: 60,
        titleSpacing: 0,
        shape: const Border(bottom: BorderSide(color: Color(0x0F0F172A))),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Payment Options',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: _ink,
              ),
            ),
            Text(
              '$itemCount ${itemCount == 1 ? 'item' : 'items'}. Total: $amountText',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: _muted,
              ),
            ),
          ],
        ),
      ),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.only(bottom: 32),
            children: [
              _DeliveryRouteCard(
                storeName: (darkStore?.storeName.trim().isNotEmpty ?? false)
                    ? darkStore!.storeName
                    : 'GreenGroo',
                addressTitle: _isPickup
                    ? 'Store pickup'
                    : ((selectedAddress?.fullName.trim().isNotEmpty ?? false)
                        ? selectedAddress!.fullName
                        : 'Deliver to'),
                addressLine: selectedAddress != null
                    ? formatAddressLine(selectedAddress)
                    : (deliveryLoc?.displayAddress ?? 'Select delivery location'),
                etaLines: etaLines,
                onChangeAddress: () => showSelectDeliveryLocationBottomSheet(context, ref),
              ),
              if (_isPickup)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                  child: DarkStoreContactCard(
                    store: darkStore,
                    pickup: true,
                    loading: storeAsync.isLoading && darkStore == null,
                  ),
                ),
              if (summary.savings > 0)
                _NoticeBanner(
                  icon: Icons.local_offer_rounded,
                  title: 'You are saving ${formatInr(summary.savings)} on this order',
                  color: const Color(0xFFE6F6EC),
                  borderColor: const Color(0xFFE6F6EC),
                  iconColor: const Color(0xFF0B7A3B),
                  textColor: const Color(0xFF0B7A3B),
                ),
              if (_errorMessage.isNotEmpty)
                _NoticeBanner(
                  icon: Icons.error_outline_rounded,
                  title: _errorMessage,
                  color: const Color(0xFFFEF2F2),
                  borderColor: const Color(0xFFFEE2E2),
                  iconColor: const Color(0xFFDC2626),
                  textColor: const Color(0xFFB91C1C),
                ),

              const _SectionTitle('Payment Options'),
              _MethodGroup(
                children: [
                  _methodTile(
                    mode: PaymentModeOption.cod,
                    title: PaymentModeOption.cod.title(pickup: _isPickup),
                    subtitle: _isPickup
                        ? 'Cash or UPI when you collect your order'
                        : 'Cash or UPI when your order arrives',
                    leading: const Icon(Icons.payments_outlined, color: _accent, size: 22),
                    payLabel: 'Place Order',
                    address: effectiveAddress,
                  ),
                  _methodTile(
                    mode: PaymentModeOption.online,
                    title: PaymentModeOption.online.title(),
                    subtitle: '$amountText by UPI or card',
                    leading: const Icon(Icons.credit_card_rounded, color: _accent, size: 22),
                    payLabel: 'Pay $amountText',
                    address: effectiveAddress,
                  ),
                ],
              ),
            ],
          ),

          if (_placingOrder)
            Container(
              color: Colors.black45,
              child: Center(
                child: Card(
                  elevation: 8,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircularProgressIndicator(color: Color(0xFF047857)),
                        const SizedBox(height: 16),
                        Text(
                          'Processing order payment...',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          if (_orderPlaced)
            Container(
              color: Colors.black54,
              child: Center(
                child: Card(
                  margin: const EdgeInsets.all(24),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: const BoxDecoration(
                            color: Color(0xFFDCFCE7),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.check_rounded,
                            color: Color(0xFF047857),
                            size: 38,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Order Placed Successfully!',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _orderSuccessNote,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                        if (_isPickup && (_orderStore ?? darkStore) != null) ...[
                          const SizedBox(height: 16),
                          DarkStoreContactCard(store: _orderStore ?? darkStore, pickup: true),
                          const SizedBox(height: 8),
                          Text(
                            'Show the OTP from My Orders at the store counter to collect your order.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF047857),
                            ),
                          ),
                        ],
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: FilledButton(
                            onPressed: () {
                              setState(() => _orderPlaced = false);
                              context.go(RoutePaths.orders);
                            },
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF047857),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: Text(
                              'View My Orders',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _methodTile({
    required PaymentModeOption mode,
    required String title,
    String? subtitle,
    required Widget leading,
    required String payLabel,
    required Address address,
  }) {
    return _MethodTile(
      title: title,
      subtitle: subtitle,
      leading: leading,
      selected: _selectedMode == mode,
      payLabel: payLabel,
      onTap: () => _selectMode(mode),
      onPay: _placingOrder ? null : () => _processPayment(address),
    );
  }
}

/// Store â†’ customer route with the promised delivery time.
class _DeliveryRouteCard extends StatelessWidget {
  const _DeliveryRouteCard({
    required this.storeName,
    required this.addressTitle,
    required this.addressLine,
    required this.etaLines,
    required this.onChangeAddress,
  });

  final String storeName;
  final String addressTitle;
  final String addressLine;
  final List<String> etaLines;
  final VoidCallback onChangeAddress;

  @override
  Widget build(BuildContext context) {
    final headline = etaLines.isNotEmpty ? etaLines.first : '';
    final strong = GoogleFonts.plusJakartaSans(
      fontSize: 14,
      fontWeight: FontWeight.w800,
      color: _ink,
    );
    final soft = GoogleFonts.plusJakartaSans(
      fontSize: 12.5,
      fontWeight: FontWeight.w500,
      color: _muted,
    );

    Widget dot() => Container(
          width: 11,
          height: 11,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: _accent, width: 2.2),
          ),
        );

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Column(
                  children: [
                    dot(),
                    Container(width: 2, height: 22, color: _accent),
                    dot(),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: storeName, style: strong),
                          if (headline.isNotEmpty) ...[
                            TextSpan(text: '  |  ', style: soft),
                            TextSpan(text: headline, style: soft),
                          ],
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 12),
                    InkWell(
                      onTap: onChangeAddress,
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: addressTitle, style: strong),
                            TextSpan(text: '  |  ', style: soft),
                            TextSpan(text: addressLine, style: soft),
                          ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (etaLines.isNotEmpty) ...[
            const SizedBox(height: 12),
            for (final line in etaLines)
              Padding(
                padding: const EdgeInsets.only(left: 25, top: 2),
                child: Text(
                  line,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: _accent,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _NoticeBanner extends StatelessWidget {
  const _NoticeBanner({
    required this.icon,
    required this.title,
    required this.color,
    required this.borderColor,
    required this.iconColor,
    this.textColor = _ink,
  });

  final IconData icon;
  final String title;
  final Color color;
  final Color borderColor;
  final Color iconColor;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          Icon(icon, color: iconColor, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: textColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
      child: Text(
        title.toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: GoogleFonts.plusJakartaSans(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.4,
          color: _muted,
        ),
      ),
    );
  }
}

class _MethodGroup extends StatelessWidget {
  const _MethodGroup({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0)
              const Divider(height: 1, thickness: 1, indent: 14, endIndent: 14, color: _slate100),
            children[i],
          ],
        ],
      ),
    );
  }
}

class _MethodTile extends StatelessWidget {
  const _MethodTile({
    required this.title,
    required this.leading,
    required this.selected,
    required this.payLabel,
    required this.onTap,
    required this.onPay,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget leading;
  final bool selected;
  final String payLabel;
  final VoidCallback onTap;
  final VoidCallback? onPay;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selected ? const Color(0xFFECFDF5) : Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: selected ? const Color(0xFFA7F3D0) : _slate200),
                  ),
                  child: leading,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 14,
                          fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
                          color: _ink,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle!,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: _muted,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                _SelectionMark(selected: selected),
              ],
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              child: selected
                  ? Padding(
                      padding: const EdgeInsets.only(left: 52, top: 12),
                      child: SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: FilledButton(
                          onPressed: onPay,
                          style: FilledButton.styleFrom(
                            backgroundColor: _accent,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: const Color(0xFFCBD5E1),
                            disabledForegroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: Text(
                            payLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    )
                  : const SizedBox(width: double.infinity),
            ),
          ],
        ),
      ),
    );
  }
}

class _SelectionMark extends StatelessWidget {
  const _SelectionMark({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? _accent : Colors.white,
        border: Border.all(
          color: selected ? _accent : const Color(0xFFCBD5E1),
          width: 1.6,
        ),
      ),
      child: selected
          ? const Icon(Icons.check_rounded, size: 15, color: Colors.white)
          : null,
    );
  }
}
