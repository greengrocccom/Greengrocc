import 'package:flutter/material.dart';

/// Header, search, and bottom-nav colors for Preorder, Ready to Cook, and Instant.
/// Mirrors the website's mobile `homeHeaderThemes.js` and `BottomNav.jsx`.
class StoreChrome {
  const StoreChrome({
    required this.header,
    required this.accent,
    required this.activeNavBg,
    required this.searchHint,
    required this.locationColor,
    required this.stripIndicator,
    required this.tabAccent,
  });

  final Color header;

  /// Bottom nav active color.
  final Color accent;
  final Color activeNavBg;
  final String searchHint;
  final Color locationColor;
  final Color stripIndicator;

  /// Store switcher / profile accent (`STORE_ACCENT` on the website).
  final Color tabAccent;

  static StoreChrome forStore(String store) {
    switch (store) {
      case 'festive':
      case 'ready2cook':
        return const StoreChrome(
          header: Color(0xFFFFF8DB),
          accent: Color(0xFFB45309),
          activeNavBg: Color(0x26F59E0B),
          searchHint: 'Search "Chopped", "Mixes", "Herbs"...',
          locationColor: Color(0xFF92400E),
          stripIndicator: Color(0xFFCA8A04),
          tabAccent: Color(0xFFB45309),
        );
      case 'mall':
      case 'instantorder':
        return const StoreChrome(
          header: Colors.white,
          accent: Color(0xFF2563EB),
          activeNavBg: Color(0x262563EB),
          searchHint: 'Search for "Fruits", "Vegetables"...',
          locationColor: Color(0xFF047857),
          stripIndicator: Color(0xFF0C831F),
          tabAccent: Color(0xFF0C831F),
        );
      default:
        return const StoreChrome(
          header: Colors.white,
          accent: Color(0xFF0C831F),
          activeNavBg: Color(0x260C831F),
          searchHint: 'Search for "Fruits", "Vegetables"...',
          locationColor: Color(0xFF047857),
          stripIndicator: Color(0xFF0C831F),
          tabAccent: Color(0xFF0C831F),
        );
    }
  }
}
