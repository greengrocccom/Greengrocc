import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/providers/app_providers.dart';
import '../../core/utils/product_pricing.dart';
import '../../core/utils/product_utils.dart';
import '../../features/home/home_providers.dart';
import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../auth/auth_controller.dart';
import '../../core/utils/ui_sound_effects.dart';
import '../../routes/shell_navigator_keys.dart';
import '../../widgets/cart/fly_product_animator.dart';

enum AddToCartResult { success, requiresLogin, failed }

const _guestCartKey = 'guest_cart_v1';

class PendingCartAction {
  const PendingCartAction({
    required this.product,
    required this.quantity,
    this.buyNow = false,
    this.variantName = '',
    this.colorName = '',
  });

  final Product product;
  final int quantity;
  final bool buyNow;
  final String variantName;
  final String colorName;
}

class CartState {
  const CartState({
    this.items = const [],
    this.loading = false,
    this.toastImage,
    this.navigateToCheckout = false,
    this.errorMessage,
  });

  final List<CartItem> items;
  final bool loading;
  final String? toastImage;
  final bool navigateToCheckout;
  final String? errorMessage;

  int get cartCount => items.fold(0, (sum, item) => sum + item.quantity);

  CartState copyWith({
    List<CartItem>? items,
    bool? loading,
    String? toastImage,
    bool clearToast = false,
    bool navigateToCheckout = false,
    bool clearCheckoutNav = false,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CartState(
      items: items ?? this.items,
      loading: loading ?? this.loading,
      toastImage: clearToast ? null : (toastImage ?? this.toastImage),
      navigateToCheckout: clearCheckoutNav
          ? false
          : (navigateToCheckout || this.navigateToCheckout),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

final cartControllerProvider =
    NotifierProvider<CartController, CartState>(CartController.new);

int cartLineQuantityForProduct(List<CartItem> items, Product product) {
  final defaults = resolveCartDefaults(product);
  final line = findCartLine(
    items,
    product.id,
    defaults.variantName,
    defaults.colorName,
  );
  return line?.quantity ?? 0;
}

/// Rebuilds only when this product's cart quantity changes.
final cartProductQuantityProvider = Provider.family<int, String>((ref, productId) {
  return ref.watch(
    cartControllerProvider.select((state) {
      for (final item in state.items) {
        if (item.id == productId) {
          return item.quantity;
        }
      }
      return 0;
    }),
  );
});

class CartController extends Notifier<CartState> {
  PendingCartAction? _pending;
  Timer? _toastClearTimer;

  @override
  CartState build() {
    ref.onDispose(() => _toastClearTimer?.cancel());
    ref.listen(authControllerProvider, (previous, next) {
      final wasLoggedOut = previous?.isLoggedIn != true;
      final switchedAccount = !wasLoggedOut &&
          next.isLoggedIn &&
          previous?.user?.id != next.user?.id;
      if (switchedAccount) {
        state = const CartState();
        _pending = null;
        _handleLogin();
      } else if (wasLoggedOut && next.isLoggedIn) {
        _handleLogin();
      } else if (!next.isLoggedIn && previous?.isLoggedIn == true) {
        state = const CartState();
        _pending = null;
      }
    });

    // The initial (empty) state is reported late; saving it would erase the stored cart.
    listenSelf((previous, next) {
      if (previous != null && previous.items != next.items) unawaited(_saveGuestCart(next.items));
    });

    final auth = ref.read(authControllerProvider);
    if (auth.isLoggedIn && !auth.loading) {
      Future.microtask(() => loadCart(silent: true));
    } else {
      Future.microtask(_restoreGuestCart);
    }

    return const CartState();
  }

  /// Guests' carts live on the phone so they survive an app restart; once signed
  /// in the server cart is the source of truth and the local copy is dropped.
  Future<void> _saveGuestCart(List<CartItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    if (ref.read(authControllerProvider).isLoggedIn || items.isEmpty) {
      await prefs.remove(_guestCartKey);
      return;
    }
    await prefs.setString(
      _guestCartKey,
      jsonEncode([
        for (final item in items)
          {
            'id': item.id,
            'quantity': item.quantity,
            'variantName': item.variantName,
            'colorName': item.colorName,
            'section': item.section,
            'storeType': item.storeType,
          },
      ]),
    );
  }

  Future<void> _restoreGuestCart() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_guestCartKey);
    if (raw == null) return;
    List<dynamic> lines;
    try {
      lines = jsonDecode(raw) as List<dynamic>;
    } catch (_) {
      await prefs.remove(_guestCartKey);
      return;
    }

    final api = ref.read(apiServiceProvider);
    final restored = <CartItem>[];
    for (final line in lines.whereType<Map<String, dynamic>>()) {
      final id = line['id']?.toString() ?? '';
      final quantity = (line['quantity'] as num?)?.toInt() ?? 0;
      if (id.isEmpty || quantity < 1) continue;
      try {
        final product = await api.fetchProductById(id);
        restored.add(cartItemFromProduct(
          product,
          quantity,
          variantName: line['variantName']?.toString() ?? '',
          colorName: line['colorName']?.toString() ?? '',
          section: line['section']?.toString(),
          storeType: line['storeType']?.toString(),
        ));
      } catch (_) {
        // Product removed or unavailable — drop that line.
      }
    }

    // Signed in or already shopping meanwhile: don't overwrite the live cart.
    if (!ref.mounted || ref.read(authControllerProvider).isLoggedIn || state.items.isNotEmpty) return;
    if (restored.isNotEmpty) state = state.copyWith(items: restored);
  }

  Future<void> _handleLogin() async {
    final localItems = List<CartItem>.from(state.items);
    if (localItems.isNotEmpty) {
      for (final item in localItems) {
        try {
          await ref.read(apiServiceProvider).addToCartItem({
            'productId': item.id,
            'quantity': item.quantity,
            'variantName': item.variantName,
            'colorName': item.colorName,
          });
        } catch (_) {}
      }
    }
    await loadCart();
    final pending = _pending;
    if (pending == null) return;
    _pending = null;

    final result = await addToCart(
      pending.product,
      pending.quantity,
      buyNow: pending.buyNow,
      variantName: pending.variantName,
      colorName: pending.colorName,
    );

    if (result == AddToCartResult.success && pending.buyNow) {
      clearToast();
      state = state.copyWith(navigateToCheckout: true);
    }
  }

  Future<void> loadCart({bool silent = false}) async {
    final auth = ref.read(authControllerProvider);
    if (!auth.isLoggedIn) {
      // Keep local guest cart items intact
      return;
    }

    if (!silent) {
      state = state.copyWith(loading: true);
    }
    try {
      final items = await ref.read(apiServiceProvider).fetchCartItems();
      state = state.copyWith(items: items, loading: false);
    } catch (_) {
      state = state.copyWith(loading: false);
    }
  }

  Future<AddToCartResult> addToCart(
    Product product,
    int quantity, {
    bool buyNow = false,
    String variantName = '',
    String colorName = '',
    BuildContext? flySourceContext,
  }) async {
    if (quantity < 1) return AddToCartResult.failed;

    if (product.id.isEmpty) return AddToCartResult.failed;

    final effectiveVariant = variantName.trim();
    final effectiveColor = colorName.trim();
    final auth = ref.read(authControllerProvider);
    final currentStore = ref.read(selectedStoreTabProvider);

    String effectiveSection = product.section;
    String effectiveStoreType = product.storeType;

    if (effectiveSection.isEmpty && effectiveStoreType.isEmpty) {
      if (currentStore == 'festive' || currentStore == 'ready2cook') {
        effectiveSection = 'ready2cook';
        effectiveStoreType = 'festive';
      } else if (currentStore == 'mall' || currentStore == 'instantorder') {
        effectiveSection = 'instantorder';
        effectiveStoreType = 'mall';
      } else {
        effectiveSection = 'greengrocc';
        effectiveStoreType = 'main';
      }
    }

    try {
      final previousItems = state.items;
      _mergeCartLineLocally(
        product,
        quantity,
        variantName: effectiveVariant,
        colorName: effectiveColor,
        section: effectiveSection,
        storeType: effectiveStoreType,
      );

      final flyContext = (flySourceContext != null && flySourceContext.mounted)
          ? flySourceContext
          : ((rootNavigatorKey.currentContext?.mounted == true)
              ? rootNavigatorKey.currentContext
              : null);

      if (!buyNow && flyContext != null) {
        triggerFlyToCart(
          sourceContext: flyContext,
          imageUrl: product.primaryImage,
        );
      }

      if (auth.isLoggedIn) {
        try {
          await ref.read(apiServiceProvider).addToCartItem({
            'productId': product.id,
            'quantity': quantity,
            'variantName': effectiveVariant,
            'colorName': effectiveColor,
          });
          unawaited(loadCart(silent: true));
        } catch (error) {
          state = state.copyWith(items: previousItems);
          state = state.copyWith(errorMessage: authErrorMessage(error));
          return AddToCartResult.failed;
        }
      }

      if (!buyNow) {
        unawaited(UiSoundEffects.playCartAdd());
        if (flyContext == null) {
          state = state.copyWith(toastImage: product.primaryImage, clearError: true);
          _toastClearTimer?.cancel();
          _toastClearTimer = Timer(const Duration(milliseconds: 2600), () {
            if (ref.mounted) clearToast();
          });
        }
      } else {
        state = state.copyWith(navigateToCheckout: true, clearError: true);
      }

      return AddToCartResult.success;
    } catch (error) {
      state = state.copyWith(errorMessage: authErrorMessage(error));
      return AddToCartResult.failed;
    }
  }

  void clearToast() {
    state = state.copyWith(clearToast: true);
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  void clearCheckoutNavigation() {
    state = state.copyWith(clearCheckoutNav: true);
  }

  Future<void> removeFromCart(String productId) async {
    await removeFromCartLine(productId: productId);
  }

  Future<void> removeFromCartLine({
    required String productId,
    String variantName = '',
    String colorName = '',
  }) async {
    final previous = state.items;
    state = state.copyWith(
      items: previous
          .where(
            (item) => !cartLineMatches(
              item,
              productId,
              variantName,
              colorName,
            ),
          )
          .toList(),
    );

    final auth = ref.read(authControllerProvider);
    if (!auth.isLoggedIn) return;

    try {
      await ref.read(apiServiceProvider).removeFromCartItem(
            productId,
            variantName: variantName,
            colorName: colorName,
          );
    } catch (_) {
      state = state.copyWith(items: previous);
    }
  }

  Future<void> updateQuantity(String productId, int quantity) async {
    await updateCartLineQuantity(productId: productId, quantity: quantity);
  }

  Future<bool> updateCartLineQuantity({
    required String productId,
    required int quantity,
    String variantName = '',
    String colorName = '',
  }) async {
    if (quantity < 1) {
      await removeFromCartLine(
        productId: productId,
        variantName: variantName,
        colorName: colorName,
      );
      return true;
    }

    final previous = state.items;
    state = state.copyWith(
      items: previous
          .map(
            (item) => cartLineMatches(
              item,
              productId,
              variantName,
              colorName,
            )
                ? item.copyWith(quantity: quantity)
                : item,
          )
          .toList(),
      clearError: true,
    );

    final auth = ref.read(authControllerProvider);
    if (!auth.isLoggedIn) return true;

    try {
      await ref.read(apiServiceProvider).updateCartItemQty(
            productId,
            quantity,
            variantName: variantName,
            colorName: colorName,
          );
      await loadCart(silent: true);
      return true;
    } catch (error) {
      state = state.copyWith(
        items: previous,
        errorMessage: authErrorMessage(error),
      );
      return false;
    }
  }

  Future<void> clearCart() async {
    final items = List<CartItem>.from(state.items);
    if (items.isEmpty) return;

    state = state.copyWith(items: const [], clearError: true);

    final auth = ref.read(authControllerProvider);
    if (!auth.isLoggedIn) return;

    try {
      for (final item in items) {
        await ref.read(apiServiceProvider).removeFromCartItem(
              item.id,
              variantName: item.variantName,
              colorName: item.colorName,
            );
      }
      await loadCart(silent: true);
    } catch (error) {
      await loadCart(silent: true);
      if (state.items.isNotEmpty) {
        state = state.copyWith(errorMessage: authErrorMessage(error));
      }
    }
  }

  void _mergeCartLineLocally(
    Product product,
    int quantity, {
    required String variantName,
    required String colorName,
    String? section,
    String? storeType,
  }) {
    final effectiveSection = (section != null && section.isNotEmpty)
        ? section
        : product.section;
    final effectiveStoreType = (storeType != null && storeType.isNotEmpty)
        ? storeType
        : product.storeType;

    final items = List<CartItem>.from(state.items);
    final existing = findCartLine(items, product.id, variantName, colorName);

    if (existing != null) {
      final index = items.indexOf(existing);
      items[index] = existing.copyWith(quantity: existing.quantity + quantity);
    } else {
      items.add(
        cartItemFromProduct(
          product,
          quantity,
          variantName: variantName,
          colorName: colorName,
          section: effectiveSection,
          storeType: effectiveStoreType,
        ),
      );
    }

    state = state.copyWith(items: items, clearError: true);
  }
}
