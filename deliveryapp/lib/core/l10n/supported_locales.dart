import 'package:flutter/material.dart';

/// Central registry of supported app locales.
/// Translations live in the JSON (ARB) files under lib/l10n/app_<code>.arb.
abstract final class SupportedLocales {
  static const locales = [
    Locale('en'),
    Locale('mr'),
    Locale('hi'),
  ];

  static const codes = ['en', 'mr', 'hi'];

  static bool isSupported(String code) => codes.contains(code);

  /// English fallback names — used on the language picker before locale is set.
  static const displayNames = {
    'en': 'English',
    'mr': 'Marathi',
    'hi': 'Hindi',
  };

  static const nativeNames = {
    'en': 'English',
    'mr': 'मराठी',
    'hi': 'हिन्दी',
  };

  static String displayName(String code) => displayNames[code] ?? code;

  static String nativeName(String code) => nativeNames[code] ?? code;
}
