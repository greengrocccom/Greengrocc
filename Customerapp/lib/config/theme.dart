import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// GreenGrocc storefront theme — matches React frontend (`#0C831F` / fresh organic green).
class AppColors {
  AppColors._();

  /// Primary CTA / brand green (frontend `#0C831F`).
  static const Color primary = Color(0xFF0C831F);
  static const Color primaryDark = Color(0xFF097019);
  static const Color primaryLight = Color(0xFF22C55E);

  /// Storefront header — emerald gradient (main store).
  static const Color headerPrimary = Color(0xFF047857);
  static const Color headerPrimaryLight = Color(0xFF059669);
  static const Color headerSearchBg = Color(0xFFD1FAE5);
  static const Color headerFadeBg = Color(0xFFECFDF5);

  static const Color pageBackground = Color(0xFFF8F8F8);
  static const Color mobileBg = Color(0xFFFFFFFF);
  static const Color mobileSurface = Color(0xFFF8F8F8);
  static const Color textPrimary = Color(0xFF000000);
  static const Color textSecondary = Color(0xFF666666);
  static const Color textMuted = Color(0xFF999999);
  static const Color borderLight = Color(0xFFE5E5E5);

  /// Bottom nav — selected tab uses brand green.
  static const Color navSelected = Color(0xFF0C831F);
  static const Color navUnselected = Color(0xFF878787);
  static const Color navBorder = Color(0xFFE0E0E0);
  static const Color navBadge = Color(0xFFFF4343);
}

class AppTheme {
  AppTheme._();

  static const SystemUiOverlayStyle storefrontHeaderOverlay =
      SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
  );

  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.mobileBg,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        surface: AppColors.mobileSurface,
      ),
      dividerColor: AppColors.borderLight,
    );

    return base.copyWith(
      textTheme: GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
        bodyColor: AppColors.textPrimary,
        displayColor: AppColors.textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.mobileBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.mobileBg,
        selectedItemColor: AppColors.navSelected,
        unselectedItemColor: AppColors.navUnselected,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.mobileSurface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}
