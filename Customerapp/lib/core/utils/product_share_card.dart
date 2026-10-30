import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';

import 'network_image_bytes.dart';

const _cardWidth = 400.0;
const _outerPadding = 16.0;
const _imageAreaHeight = 280.0;
const _bodyPaddingH = 16.0;
const _bodyPaddingTop = 14.0;
const _bodyPaddingBottom = 16.0;

Future<ui.Image?> _loadNetworkImage(String url) async {
  final bytes = await compute(downloadNetworkImageBytes, url);
  if (bytes == null) return null;

  try {
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    return frame.image;
  } catch (_) {
    return null;
  }
}

double _measureTextHeight({
  required String text,
  required TextStyle style,
  required double maxWidth,
  int maxLines = 2,
}) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
    maxLines: maxLines,
    ellipsis: '…',
  )..layout(maxWidth: maxWidth);
  return painter.height;
}

void _paintText({
  required Canvas canvas,
  required String text,
  required Offset offset,
  required TextStyle style,
  required double maxWidth,
  int maxLines = 2,
}) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
    maxLines: maxLines,
    ellipsis: '…',
  )..layout(maxWidth: maxWidth);
  painter.paint(canvas, offset);
}

/// Fills [dest] using center-cropped cover (like CSS object-fit: cover).
void _paintImageCover(Canvas canvas, ui.Image image, Rect dest) {
  if (dest.width <= 0 || dest.height <= 0) return;

  final imageAspect = image.width / image.height;
  final destAspect = dest.width / dest.height;
  final Rect src;

  if (imageAspect > destAspect) {
    final srcHeight = image.height.toDouble();
    final srcWidth = srcHeight * destAspect;
    final sx = (image.width - srcWidth) / 2;
    src = Rect.fromLTWH(sx, 0, srcWidth, srcHeight);
  } else {
    final srcWidth = image.width.toDouble();
    final srcHeight = srcWidth / destAspect;
    final sy = (image.height - srcHeight) / 2;
    src = Rect.fromLTWH(0, sy, srcWidth, srcHeight);
  }

  canvas.save();
  canvas.clipRect(dest);
  canvas.drawImageRect(
    image,
    src,
    dest,
    Paint()..filterQuality = FilterQuality.high,
  );
  canvas.restore();
}

/// Builds a WhatsApp-style product share card (image + price + brand).
Future<Uint8List?> createProductShareCardPng({
  required String imageUrl,
  required String productName,
  required String priceLabel,
  required String brandName,
  double pixelRatio = 2.0,
}) async {
  final innerWidth = _cardWidth - _outerPadding * 2;
  final textMaxWidth = innerWidth - _bodyPaddingH * 2;
  final productImage = await _loadNetworkImage(imageUrl);

  final brandStyle = const TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.4,
    color: Color(0xFF666666),
    height: 1.2,
  );
  final titleStyle = const TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w700,
    color: Color(0xFF000000),
    height: 1.35,
  );
  final priceStyle = const TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: Color(0xFF0C831F),
    height: 1.1,
  );
  final storeStyle = const TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: Color(0xFF999999),
    height: 1.2,
  );

  final displayBrand =
      brandName.trim().isNotEmpty ? brandName.trim() : 'GreenGrocc';
  final displayName = productName.trim().isNotEmpty ? productName.trim() : 'Product';

  final brandHeight = _measureTextHeight(
    text: displayBrand.toUpperCase(),
    style: brandStyle,
    maxWidth: textMaxWidth,
    maxLines: 1,
  );
  final titleHeight = _measureTextHeight(
    text: displayName,
    style: titleStyle,
    maxWidth: textMaxWidth,
    maxLines: 2,
  );
  final priceHeight = _measureTextHeight(
    text: priceLabel,
    style: priceStyle,
    maxWidth: textMaxWidth,
    maxLines: 1,
  );
  final storeHeight = _measureTextHeight(
    text: 'greengrocc.com',
    style: storeStyle,
    maxWidth: textMaxWidth,
    maxLines: 1,
  );

  final imageBoxWidth = innerWidth;
  const imageBoxHeight = _imageAreaHeight;

  final bodyHeight = _bodyPaddingTop +
      brandHeight +
      6 +
      titleHeight +
      10 +
      priceHeight +
      8 +
      storeHeight +
      _bodyPaddingBottom;

  final cardHeight = imageBoxHeight + bodyHeight;
  final totalHeight = cardHeight + _outerPadding * 2;

  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final paint = Paint();

  canvas.drawRect(
    Rect.fromLTWH(0, 0, _cardWidth, totalHeight),
    paint..color = const Color(0xFFFFFFFF),
  );

  final cardRect = RRect.fromRectAndRadius(
    Rect.fromLTWH(_outerPadding, _outerPadding, innerWidth, cardHeight),
    const Radius.circular(12),
  );
  paint.color = const Color(0xFFFFFFFF);
  canvas.drawRRect(cardRect, paint);
  paint
    ..color = const Color(0xFFE5E5E5)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1;
  canvas.drawRRect(cardRect, paint);
  paint.style = PaintingStyle.fill;

  final imageTop = _outerPadding;
  final imageRect = Rect.fromLTWH(_outerPadding, imageTop, imageBoxWidth, imageBoxHeight);
  final imageClip = RRect.fromRectAndCorners(
    imageRect,
    topLeft: const Radius.circular(12),
    topRight: const Radius.circular(12),
  );

  paint.color = const Color(0xFFF8F8F8);
  canvas.save();
  canvas.clipRRect(imageClip);
  canvas.drawRect(imageRect, paint);

  if (productImage != null) {
    _paintImageCover(canvas, productImage, imageRect);
    productImage.dispose();
  }
  canvas.restore();

  var textY = imageTop + imageBoxHeight + _bodyPaddingTop;
  final textX = _outerPadding + _bodyPaddingH;

  _paintText(
    canvas: canvas,
    text: displayBrand.toUpperCase(),
    offset: Offset(textX, textY),
    style: brandStyle,
    maxWidth: textMaxWidth,
    maxLines: 1,
  );
  textY += brandHeight + 6;

  _paintText(
    canvas: canvas,
    text: displayName,
    offset: Offset(textX, textY),
    style: titleStyle,
    maxWidth: textMaxWidth,
    maxLines: 2,
  );
  textY += titleHeight + 10;

  _paintText(
    canvas: canvas,
    text: priceLabel,
    offset: Offset(textX, textY),
    style: priceStyle,
    maxWidth: textMaxWidth,
    maxLines: 1,
  );
  textY += priceHeight + 8;

  _paintText(
    canvas: canvas,
    text: 'greengrocc.in',
    offset: Offset(textX, textY),
    style: storeStyle,
    maxWidth: textMaxWidth,
    maxLines: 1,
  );

  final picture = recorder.endRecording();
  final image = await picture.toImage(
    (_cardWidth * pixelRatio).round(),
    (totalHeight * pixelRatio).round(),
  );
  final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  return byteData?.buffer.asUint8List();
}

Future<File?> createProductShareCardFile({
  required String productId,
  required String imageUrl,
  required String productName,
  required String priceLabel,
  required String brandName,
}) async {
  final bytes = await createProductShareCardPng(
    imageUrl: imageUrl,
    productName: productName,
    priceLabel: priceLabel,
    brandName: brandName,
  );
  if (bytes == null) return null;

  final dir = await getTemporaryDirectory();
  final safeId = productId.replaceAll(RegExp(r'[^\w-]'), '');
  final file = File('${dir.path}/product-share-$safeId.png');
  await file.writeAsBytes(bytes, flush: true);
  return file;
}
