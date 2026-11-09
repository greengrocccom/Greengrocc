import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

import '../../l10n/app_localizations.dart';
import 'locale_controller.dart';
import 'supported_locales.dart';

/// Strings for the rider's chosen language outside the widget tree (services, models,
/// notifications). Widgets should keep using `AppLocalizations.of(context)`.
AppLocalizations get appL10n => lookupAppLocalizations(currentAppLocale);

Locale get currentAppLocale {
  final chosen = LocaleController.instance.locale;
  if (chosen != null && SupportedLocales.isSupported(chosen.languageCode)) return chosen;
  final device = WidgetsBinding.instance.platformDispatcher.locale;
  return SupportedLocales.isSupported(device.languageCode) ? Locale(device.languageCode) : const Locale('en');
}

/// Dates in the rider's language (month / weekday names) but always with 0-9 digits.
DateFormat localizedDateFormat(String pattern) => DateFormat(pattern, currentAppLocale.languageCode);

/// Marathi / Hindi date formats default to Devanagari digits; the app shows numbers as 0-9.
void useLatinDigitsForDates() {
  for (final code in SupportedLocales.codes) {
    DateFormat.useNativeDigitsByDefaultFor(code, false);
  }
}
