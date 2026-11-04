import 'dart:ui' show PlatformDispatcher;

import '../../config/env.dart';

final _ownBucketHost = RegExp(r'^greengrocc[\w.-]*\.s3[.-][\w.-]*amazonaws\.com$');

/// Same buckets as the backend `/api/img`, so nearby sizes share one cached file.
const _sizes = [96, 160, 240, 320, 480, 640, 800, 1080, 1440, 1920];
const _maxDevicePx = 1920;

int _snap(int px) => _sizes.firstWhere((s) => s >= px, orElse: () => _maxDevicePx);

/// Rewrites [url] so the server sends an image that still covers a
/// [widthPx]×[heightPx] box (device pixels) as visually lossless WebP. With no
/// size it targets the full screen width. Never asks for fewer pixels than are
/// displayed, so quality on screen is unchanged.
String optimizedImageUrl(String url, {int? widthPx, int? heightPx}) {
  final raw = url.trim();
  if (raw.isEmpty) return raw;
  final uri = Uri.tryParse(raw);
  if (uri == null || !uri.hasScheme || !uri.scheme.startsWith('http')) return raw;

  final h = heightPx == null ? null : _snap(heightPx);
  final rawW = widthPx ?? (h == null ? _screenDevicePx() : null);
  final w = rawW == null ? null : _snap(rawW);
  final host = uri.host.toLowerCase();

  if (_ownBucketHost.hasMatch(host) || host == 'res.cloudinary.com') {
    final size = [if (w != null) 'w=$w', if (h != null) 'h=$h'].join('&');
    return '${Env.apiUrl}/api/img?$size&url=${Uri.encodeQueryComponent(raw)}';
  }
  if (host == 'images.unsplash.com') {
    final existing = int.tryParse(uri.queryParameters['w'] ?? '');
    final params = Map<String, String>.from(uri.queryParameters)
      ..remove('w')
      ..remove('h')
      ..addAll({'q': '85', 'fm': 'webp'});
    if (w != null && h != null) {
      // Unsplash has no "cover the box" resize; double the longer side so a
      // cover-cropped slot is filled even by a 2:1 image.
      final side = _snap((w > h ? w : h) * 2);
      params.addAll({'w': '$side', 'fit': 'max'});
    } else if (w != null) {
      params.addAll({'w': '${existing != null && existing < w ? existing : w}', 'fit': 'max'});
    } else {
      params.addAll({'h': '$h', 'fit': 'max'});
    }
    return uri.replace(queryParameters: params).toString();
  }
  return raw;
}

int _screenDevicePx() {
  final views = PlatformDispatcher.instance.views;
  if (views.isEmpty) return 1080;
  final px = views.first.physicalSize.width;
  return px > 0 ? px.round() : 1080;
}
