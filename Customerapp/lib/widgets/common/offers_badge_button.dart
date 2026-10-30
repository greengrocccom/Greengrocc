import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../routes/route_paths.dart';

/// "Offers" chip shown beside the search bar (website mobile header style).
class OffersBadgeButton extends StatelessWidget {
  const OffersBadgeButton({
    super.key,
    this.height = 36,
    this.discountText = '50%',
  });

  final double height;
  final String discountText;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      child: InkWell(
        onTap: () => context.push(RoutePaths.coupons),
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          height: height,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.local_offer_outlined, size: 14, color: Color(0xFF0C831F)),
                const SizedBox(width: 4),
                Text(
                  'Offers',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0C831F),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
