import 'package:flutter/material.dart';

import '../../../../core/constants/app_assets.dart';

/// Delivery scooter — faces right and rides left → right.
class SplashScooter extends StatelessWidget {
  const SplashScooter({
    super.key,
    required this.width,
    required this.height,
  });

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: Image.asset(
        AppAssets.deliveryScooter,
        width: width,
        height: height,
        fit: BoxFit.contain,
        alignment: Alignment.bottomCenter,
        filterQuality: FilterQuality.high,
        gaplessPlayback: true,
        // Image already faces right — do not flip.
        errorBuilder: (context, error, stackTrace) {
          // Fallback so motion is still visible if asset fails to load.
          return Image.asset(
            AppAssets.motorcycle,
            width: width,
            height: height,
            fit: BoxFit.contain,
            alignment: Alignment.bottomCenter,
            errorBuilder: (_, _, _) => Icon(
              Icons.delivery_dining_rounded,
              size: width * 0.5,
              color: const Color(0xFF0C831F),
            ),
          );
        },
      ),
    );
  }
}
