import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../config/theme.dart';

/// Generates crisp vector custom markers matching the live tracking UI mockup.
/// The PNG bytes are shared by the Google map and the OpenStreetMap fallback.
class TrackingMarkers {
  TrackingMarkers._();

  static const riderSize = Size(84, 96);
  /// Where the rider marker touches the map, as a fraction of [riderSize].
  static const riderAnchor = Offset(0.5, 0.65);
  static const destinationSize = 58.0;

  static final Map<String, BitmapDescriptor> _cache = {};
  static final Map<String, Uint8List> _pngCache = {};

  /// Circular delivery boy marker with green helmet + "On the way" speech badge.
  static Future<BitmapDescriptor> riderMarker(
    double dpr, {
    String badgeText = 'On the way',
  }) async {
    final key = 'rider_${badgeText}_$dpr';
    final cached = _cache[key];
    if (cached != null) return cached;
    final descriptor = BitmapDescriptor.bytes(
      await riderMarkerPng(dpr, badgeText: badgeText),
      imagePixelRatio: dpr,
      width: riderSize.width,
      height: riderSize.height,
    );
    _cache[key] = descriptor;
    return descriptor;
  }

  /// Circular destination marker with house icon and soft blue pulse ring.
  static Future<BitmapDescriptor> destinationMarker(double dpr) async {
    final key = 'destination_$dpr';
    final cached = _cache[key];
    if (cached != null) return cached;
    final descriptor = BitmapDescriptor.bytes(
      await destinationMarkerPng(dpr),
      imagePixelRatio: dpr,
      width: destinationSize,
      height: destinationSize,
    );
    _cache[key] = descriptor;
    return descriptor;
  }

  static Future<Uint8List> riderMarkerPng(
    double dpr, {
    String badgeText = 'On the way',
  }) async {
    final key = 'rider_${badgeText}_$dpr';
    final cached = _pngCache[key];
    if (cached != null) return cached;

    const logicalW = 84.0;
    const logicalH = 96.0;
    final pxW = (logicalW * dpr).round();
    final pxH = (logicalH * dpr).round();

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.scale(dpr);

    // 1. Draw "On the way" dark green pill badge at the top
    const badgeW = 76.0;
    const badgeH = 24.0;
    const badgeLeft = (logicalW - badgeW) / 2;
    const badgeTop = 2.0;
    final badgeRRect = RRect.fromRectAndRadius(
      const Rect.fromLTWH(badgeLeft, badgeTop, badgeW, badgeH),
      const Radius.circular(12),
    );

    // Badge shadow
    canvas.drawRRect(
      badgeRRect.shift(const Offset(0, 2)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.2)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
    );

    // Badge background
    canvas.drawRRect(
      badgeRRect,
      Paint()..color = AppColors.primary,
    );

    // Badge pointer arrow pointing down
    final pointer = Path()
      ..moveTo(logicalW / 2 - 5, badgeTop + badgeH - 0.5)
      ..lineTo(logicalW / 2, badgeTop + badgeH + 4.5)
      ..lineTo(logicalW / 2 + 5, badgeTop + badgeH - 0.5)
      ..close();
    canvas.drawPath(pointer, Paint()..color = AppColors.primary);

    // Badge text
    final textPainter = TextPainter(
      text: TextSpan(
        text: badgeText,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    textPainter.paint(
      canvas,
      Offset(
        (logicalW - textPainter.width) / 2,
        badgeTop + (badgeH - textPainter.height) / 2,
      ),
    );

    // 2. Rider circular avatar
    const avatarCenterX = logicalW / 2;
    const avatarCenterY = 62.0;
    const avatarRadius = 26.0;

    // Drop shadow
    canvas.drawCircle(
      const Offset(avatarCenterX, avatarCenterY + 3),
      avatarRadius + 1,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.22)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );

    // White outer border
    canvas.drawCircle(
      const Offset(avatarCenterX, avatarCenterY),
      avatarRadius,
      Paint()..color = Colors.white,
    );

    // Emerald green ring
    canvas.drawCircle(
      const Offset(avatarCenterX, avatarCenterY),
      avatarRadius - 2.5,
      Paint()
        ..color = AppColors.primaryLight
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );

    // Soft mint background
    canvas.drawCircle(
      const Offset(avatarCenterX, avatarCenterY),
      avatarRadius - 4,
      Paint()..color = AppColors.headerFadeBg,
    );

    // Clip to inner circle to paint illustrated rider
    canvas.save();
    final clipPath = Path()
      ..addOval(Rect.fromCircle(
        center: const Offset(avatarCenterX, avatarCenterY),
        radius: avatarRadius - 4,
      ));
    canvas.clipPath(clipPath);

    // Courier shoulders / green polo
    final shirtPaint = Paint()..color = AppColors.primary;
    canvas.drawOval(
      Rect.fromCenter(
        center: const Offset(avatarCenterX, avatarCenterY + 20),
        width: 32,
        height: 18,
      ),
      shirtPaint,
    );

    // Neck
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: const Offset(avatarCenterX, avatarCenterY + 10),
          width: 8,
          height: 10,
        ),
        const Radius.circular(3),
      ),
      Paint()..color = const Color(0xFFFFD1A4),
    );

    // Face / head
    canvas.drawOval(
      Rect.fromCenter(
        center: const Offset(avatarCenterX, avatarCenterY + 3),
        width: 17,
        height: 19,
      ),
      Paint()..color = const Color(0xFFFFD1A4),
    );

    // Smiling face features
    final eyePaint = Paint()..color = const Color(0xFF2C3E50);
    canvas.drawCircle(const Offset(avatarCenterX - 3.5, avatarCenterY + 2), 1.3, eyePaint);
    canvas.drawCircle(const Offset(avatarCenterX + 3.5, avatarCenterY + 2), 1.3, eyePaint);

    final smilePaint = Paint()
      ..color = const Color(0xFFC0392B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCenter(
        center: const Offset(avatarCenterX, avatarCenterY + 4),
        width: 6,
        height: 5,
      ),
      0.1,
      math.pi - 0.2,
      false,
      smilePaint,
    );

    // Green helmet
    final helmetPaint = Paint()..color = AppColors.primaryLight;
    canvas.drawArc(
      Rect.fromCenter(
        center: const Offset(avatarCenterX, avatarCenterY - 1),
        width: 21,
        height: 18,
      ),
      math.pi,
      math.pi,
      true,
      helmetPaint,
    );
    // Helmet visor strip
    canvas.drawArc(
      Rect.fromCenter(
        center: const Offset(avatarCenterX, avatarCenterY - 1),
        width: 18,
        height: 6,
      ),
      0,
      math.pi,
      false,
      Paint()
        ..color = AppColors.primaryDark
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    // Scooter handlebar & headlight at the bottom
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: const Offset(avatarCenterX, avatarCenterY + 21),
          width: 22,
          height: 6,
        ),
        const Radius.circular(3),
      ),
      Paint()..color = AppColors.primary,
    );
    canvas.drawCircle(
      const Offset(avatarCenterX, avatarCenterY + 20),
      3,
      Paint()..color = const Color(0xFFFFF9C4),
    );

    canvas.restore();

    final image = await recorder.endRecording().toImage(pxW, pxH);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();

    final png = bytes!.buffer.asUint8List();
    _pngCache[key] = png;
    return png;
  }

  static Future<Uint8List> destinationMarkerPng(double dpr) async {
    final key = 'destination_$dpr';
    final cached = _pngCache[key];
    if (cached != null) return cached;

    const logicalSize = destinationSize;
    final px = (logicalSize * dpr).round();

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.scale(dpr);

    const center = Offset(logicalSize / 2, logicalSize / 2);

    // 1. Blue outer pulse ring
    canvas.drawCircle(
      center,
      27,
      Paint()..color = const Color(0x334285F4),
    );
    canvas.drawCircle(
      center,
      22,
      Paint()..color = const Color(0x554285F4),
    );

    // 2. Drop shadow
    canvas.drawCircle(
      center.translate(0, 2),
      17,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.25)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );

    // 3. White outer border
    canvas.drawCircle(center, 17, Paint()..color = Colors.white);

    // 4. Emerald green inner circle
    canvas.drawCircle(center, 14, Paint()..color = AppColors.primary);

    // 5. White house icon
    final housePath = Path()
      // Roof
      ..moveTo(center.dx, center.dy - 7)
      ..lineTo(center.dx + 7, center.dy - 1)
      ..lineTo(center.dx + 5.5, center.dy - 1)
      ..lineTo(center.dx + 5.5, center.dy + 6)
      ..lineTo(center.dx - 5.5, center.dy + 6)
      ..lineTo(center.dx - 5.5, center.dy - 1)
      ..lineTo(center.dx - 7, center.dy - 1)
      ..close()
      // Door cutout
      ..addRect(Rect.fromLTWH(center.dx - 2, center.dy + 1, 4, 5));

    canvas.drawPath(
      housePath,
      Paint()..color = Colors.white,
    );

    final image = await recorder.endRecording().toImage(px, px);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();

    final png = bytes!.buffer.asUint8List();
    _pngCache[key] = png;
    return png;
  }
}
