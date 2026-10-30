import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class Env {
  Env._();

  static Future<void> load() async {
    await dotenv.load(fileName: '.env');
  }

  static const productionApiUrl = 'https://api.greengrocc.com';

  /// Release builds always use the live API. Debug builds use API_BASE_URL
  /// (this PC on the LAN) unless USE_LIVE_API=true.
  static String get apiUrl {
    final local = dotenv.env['API_BASE_URL']?.trim() ?? '';
    final live = dotenv.env['API_LIVE_URL']?.trim() ?? '';
    final useLive = dotenv.env['USE_LIVE_API']?.trim().toLowerCase() == 'true';
    final url = kReleaseMode || useLive || local.isEmpty
        ? (live.isNotEmpty ? live : productionApiUrl)
        : local;
    return url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  /// Live order tracking map (Google Maps SDK). Set to false when no Maps key is
  /// configured in the native projects; tracking then shows ETA + timeline only.
  static bool get liveMapEnabled =>
      dotenv.env['LIVE_MAP_ENABLED']?.trim().toLowerCase() != 'false';

  /// `google` (default) = Google Maps SDK. `osm` = OpenStreetMap tiles.
  static bool get useGoogleMaps =>
      dotenv.env['MAP_PROVIDER']?.trim().toLowerCase() != 'osm';

  static String get merchantUpiId => dotenv.env['MERCHANT_UPI_ID']?.trim() ?? '';

  static String get merchantUpiName =>
      dotenv.env['MERCHANT_UPI_NAME']?.trim() ?? 'GreenGrocc';

  /// Public storefront URL used in product share links (must match live website).
  static String get storeUrl {
    final raw = dotenv.env['STORE_URL']?.trim();
    final url = raw != null && raw.isNotEmpty
        ? raw
        : 'https://www.greengrocc.in';
    return url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  /// Website that serves its own static assets (e.g. `/categories/*.jpg`),
  /// which the API returns as site-relative paths.
  static String get websiteAssetUrl {
    final raw =
        dotenv.isInitialized ? dotenv.env['WEBSITE_ASSET_URL']?.trim() : null;
    final url = raw != null && raw.isNotEmpty ? raw : 'https://greengrocc.com';
    return url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  /// Turns a site-relative image path into a loadable absolute URL.
  static String resolveAssetUrl(String raw) {
    final value = raw.trim();
    if (value.isEmpty ||
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('data:')) {
      return value;
    }
    if (value.startsWith('//')) return 'https:$value';
    return '$websiteAssetUrl${value.startsWith('/') ? '' : '/'}$value';
  }

  /// Warnings for misconfigured `.env` (logged at startup in debug).
  static List<String> validate() {
    final issues = <String>[];

    if (merchantUpiId.isEmpty) {
      issues.add('MERCHANT_UPI_ID is empty — UPI QR checkout will not work.');
    }

    return issues;
  }
}
