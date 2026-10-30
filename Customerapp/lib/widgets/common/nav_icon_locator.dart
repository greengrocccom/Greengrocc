import 'package:flutter/rendering.dart';

/// Tracks on-screen bounds for fly-to-cart / fly-to-wishlist animations
/// without a shared [GlobalKey] on the widget tree.
abstract final class NavIconLocator {
  /// Several cart targets can be mounted at once (shell bar + bottom sheet);
  /// the most recently mounted one that is still attached wins.
  static final List<RenderBox> _cartBoxes = [];
  static RenderBox? wishlistIconBox;

  static RenderBox? get cartIconBox {
    _cartBoxes.removeWhere((box) => !box.attached);
    return _cartBoxes.isEmpty ? null : _cartBoxes.last;
  }

  static void reportCart(RenderBox? box) {
    if (box == null || _cartBoxes.contains(box)) return;
    _cartBoxes.add(box);
  }

  static void reportWishlist(RenderBox? box) {
    wishlistIconBox = box;
  }

  static void clearCart() {
    _cartBoxes.removeWhere((box) => !box.attached);
  }

  static void clearWishlist() {
    wishlistIconBox = null;
  }
}
