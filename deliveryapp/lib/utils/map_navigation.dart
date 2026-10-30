import 'package:url_launcher/url_launcher.dart';

Future<bool> _tryLaunchExternal(Uri uri) async {
  try {
    return await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}

Future<bool> openGoogleMapsNavigation({
  required double destLat,
  required double destLng,
  double? originLat,
  double? originLng,
}) async {
  final destination = '$destLat,$destLng';
  final origin =
      originLat != null && originLng != null ? '&origin=$originLat,$originLng' : '';

  final candidates = <Uri>[
    Uri.parse('google.navigation:q=$destination'),
    Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$destination$origin&travelmode=driving',
    ),
    Uri.parse('geo:$destination?q=$destination'),
    Uri.parse('https://maps.google.com/maps?q=$destination'),
  ];

  for (final uri in candidates) {
    if (await _tryLaunchExternal(uri)) {
      return true;
    }
  }
  return false;
}

Future<bool> openGoogleMapsToAddress(String address) async {
  final trimmed = address.trim();
  if (trimmed.isEmpty) return false;

  final encoded = Uri.encodeComponent(trimmed);
  final candidates = <Uri>[
    Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$encoded&travelmode=driving',
    ),
    Uri.parse('geo:0,0?q=$encoded'),
    Uri.parse('https://maps.google.com/maps?q=$encoded'),
  ];

  for (final uri in candidates) {
    if (await _tryLaunchExternal(uri)) {
      return true;
    }
  }
  return false;
}

bool _isPlaceholderAddress(String address) {
  final lower = address.toLowerCase();
  return lower.contains('locked') ||
      lower.contains('scan store qr') ||
      lower.contains('scan pickup') ||
      lower.contains('unlocks after');
}

Future<bool> openMapsNavigation({
  required double? destLat,
  required double? destLng,
  required String fallbackAddress,
  bool preferAddress = false,
}) async {
  final trimmed = fallbackAddress.trim();
  final hasUsableAddress = trimmed.isNotEmpty && !_isPlaceholderAddress(trimmed);

  if (preferAddress && hasUsableAddress) {
    final ok = await openGoogleMapsToAddress(trimmed);
    if (ok) return true;
  }

  if (destLat != null && destLng != null) {
    final ok = await openGoogleMapsNavigation(destLat: destLat, destLng: destLng);
    if (ok) return true;
  }

  if (hasUsableAddress) {
    return openGoogleMapsToAddress(trimmed);
  }
  return false;
}
