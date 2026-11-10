import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/utils/optimized_image_url.dart';

/// Clean brand placeholder for missing or loading images:
/// Shows the GreenGrocc brand asset with the cart icon above and logo below (no background color).
class AppImagePlaceholder extends StatelessWidget {
  const AppImagePlaceholder({
    super.key,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
  });

  final double? width;
  final double? height;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final maxH = constraints.maxHeight.isFinite
              ? constraints.maxHeight
              : (height ?? 48.0);
          final cartH = (maxH * 0.40).clamp(10.0, 36.0);
          final logoH = (maxH * 0.32).clamp(8.0, 28.0);
          final spacing = (maxH * 0.04).clamp(1.0, 4.0);

          return Center(
            child: Stack(
              alignment: Alignment.center,
              children: [
                Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Image.asset(
                        'assets/images/cart.png',
                        height: cartH,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) => Icon(
                          Icons.shopping_cart_outlined,
                          color: const Color(0xFF047857),
                          size: cartH,
                        ),
                      ),
                      SizedBox(height: spacing),
                      Image.asset(
                        'assets/images/logo (1).png',
                        height: logoH,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) => Image.asset(
                          'assets/images/logo1.png',
                          height: logoH,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) => Text(
                            'GreenGrocc',
                            style: TextStyle(
                              fontSize: (logoH * 0.5).clamp(8.0, 14.0),
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF047857),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Network image with memory/disk cache sizing — avoids decoding full-res on thumbnails.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.alignment = Alignment.center,
    this.cacheWidth,
    this.cacheHeight,
    this.placeholder,
    this.errorIcon = Icons.image_not_supported_outlined,
    this.errorIconSize = 28,
  });

  final String imageUrl;
  final BoxFit fit;
  final double? width;
  final double? height;
  final Alignment alignment;
  /// Logical px — converted to memCacheWidth using device pixel ratio.
  final int? cacheWidth;
  /// Logical px — converted to memCacheHeight using device pixel ratio.
  final int? cacheHeight;
  final Widget? placeholder;
  final IconData errorIcon;
  final double errorIconSize;

  int? _memDim(BuildContext context, double? logical, int? cacheLogical) {
    final value = cacheLogical?.toDouble() ?? logical;
    if (value == null || !value.isFinite || value <= 0) return null;
    return (value * MediaQuery.devicePixelRatioOf(context)).round();
  }

  @override
  Widget build(BuildContext context) {
    if (imageUrl.trim().isEmpty) {
      return _errorBox();
    }

    final memW = _memDim(context, width, cacheWidth);
    final memH = _memDim(context, height, cacheHeight);

    if (kIsWeb) {
      // Image hosts (S3) send no CORS headers; fall back to an <img> element.
      return Image.network(
        optimizedImageUrl(imageUrl, widthPx: memW, heightPx: memH),
        fit: fit,
        alignment: alignment,
        width: width,
        height: height,
        webHtmlElementStrategy: WebHtmlElementStrategy.fallback,
        loadingBuilder: (context, child, progress) =>
            progress == null ? child : (placeholder ?? _loadingBox()),
        errorBuilder: (_, _, _) => _errorBox(),
      );
    }

    return CachedNetworkImage(
      imageUrl: optimizedImageUrl(imageUrl, widthPx: memW, heightPx: memH),
      fit: fit,
      alignment: alignment,
      width: width,
      height: height,
      memCacheWidth: memW,
      memCacheHeight: memH,
      maxWidthDiskCache: memW != null ? memW.clamp(200, 1200) : 800,
      maxHeightDiskCache: memH?.clamp(200, 1200),
      filterQuality: FilterQuality.medium,
      fadeInDuration: const Duration(milliseconds: 150),
      fadeOutDuration: const Duration(milliseconds: 100),
      placeholder: (_, _) => placeholder ?? _loadingBox(),
      errorWidget: (_, _, _) => _errorBox(),
    );
  }

  Widget _loadingBox() {
    return AppImagePlaceholder(
      width: width,
      height: height,
      fit: fit,
    );
  }

  Widget _errorBox() {
    return AppImagePlaceholder(
      width: width,
      height: height,
      fit: fit,
    );
  }
}
