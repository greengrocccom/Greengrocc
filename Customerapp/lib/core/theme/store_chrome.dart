import 'package:flutter/material.dart';

/// Header, search, and bottom-nav colors for Preorder, Ready to Cook, and Instant.
/// Mirrors the website's mobile `homeHeaderThemes.js`.
class StoreChrome {
  const StoreChrome({
    required this.header,
    required this.accent,
    required this.activeNavBg,
    required this.searchHint,
    required this.locationColor,
    required this.stripIndicator,
  });

  final Color header;
  final Color accent;
  final Color activeNavBg;
  final String searchHint;
  final Color locationColor;
  final Color stripIndicator;

  static StoreChrome forStore(String store) {
    switch (store) {
      case 'festive':
      case 'ready2cook':
        return const StoreChrome(
          header: Color(0xFFFFF8DB),
          accent: Color(0xFFB45309),
          activeNavBg: Color(0x26B45309),
          searchHint: 'Search "Chopped", "Mixes", "Herbs"...',
          locationColor: Color(0xFF92400E),
          stripIndicator: Color(0xFFCA8A04),
        );
      case 'mall':
      case 'instantorder':
        return const StoreChrome(
          header: Color(0xFFE8F1FF),
          accent: Color(0xFF2563EB),
          activeNavBg: Color(0x262563EB),
          searchHint: 'Search "Snacks", "Dairy", "Essentials"...',
          locationColor: Color(0xFF1E3A8A),
          stripIndicator: Color(0xFF2563EB),
        );
      default:
        return const StoreChrome(
          header: Colors.white,
          accent: Color(0xFF0C831F),
          activeNavBg: Color(0x260C831F),
          searchHint: 'Search for "Fruits", "Vegetables"...',
          locationColor: Color(0xFF047857),
          stripIndicator: Color(0xFF0C831F),
        );
    }
  }
}
