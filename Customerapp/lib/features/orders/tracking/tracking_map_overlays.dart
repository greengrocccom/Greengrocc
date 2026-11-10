import 'package:flutter/material.dart';

import '../../../config/theme.dart';

/// Floating ETA pill (bottom-left of the tracking map).
class TrackingEtaPill extends StatelessWidget {
  const TrackingEtaPill({super.key, this.etaText, this.distanceMeters});

  final String? etaText;
  final int? distanceMeters;

  String get _distanceLabel {
    final meters = distanceMeters;
    if (meters == null || meters <= 0) return '';
    if (meters <= 30) return 'Near you';
    if (meters >= 1000) return '${(meters / 1000).toStringAsFixed(1)} km away';
    return '$meters m away';
  }

  @override
  Widget build(BuildContext context) {
    final eta = etaText?.trim() ?? '';
    final distance = _distanceLabel;
    final label = eta.isNotEmpty ? 'ETA $eta' : 'Calculating ETA';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4.5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.10),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 13.5),
          const SizedBox(width: 4),
          Text(
            '$label${distance.isNotEmpty ? ' • $distance' : ''}',
            style: const TextStyle(
              color: Color(0xFF0F172A),
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.1,
            ),
          ),
          const SizedBox(width: 4),
          const Icon(Icons.access_time_rounded, color: Color(0xFF64748B), size: 11.5),
        ],
      ),
    );
  }
}

/// Floating re-center button (top-right of the tracking map).
class TrackingRecenterButton extends StatelessWidget {
  const TrackingRecenterButton({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 2.5,
      shadowColor: Colors.black.withValues(alpha: 0.18),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: const SizedBox(
          width: 32,
          height: 32,
          child: Icon(Icons.my_location_rounded, color: Color(0xFF475569), size: 16),
        ),
      ),
    );
  }
}
