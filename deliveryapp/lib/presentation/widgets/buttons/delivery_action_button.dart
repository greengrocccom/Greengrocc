import 'package:flutter/material.dart';

import 'package:google_fonts/google_fonts.dart';



import '../../../core/theme/app_colors.dart';



enum DeliveryActionStyle { primary, outline, accent }



class DeliveryActionButton extends StatelessWidget {

  const DeliveryActionButton({

    super.key,

    required this.label,

    required this.icon,

    this.subtitle,

    this.onPressed,

    this.style = DeliveryActionStyle.primary,

    this.loading = false,

    this.showChevron = true,

  });



  final String label;

  final String? subtitle;

  final IconData icon;

  final VoidCallback? onPressed;

  final DeliveryActionStyle style;

  final bool loading;

  final bool showChevron;



  @override

  Widget build(BuildContext context) {

    final radius = BorderRadius.circular(14);

    final hasSubtitle = subtitle != null && subtitle!.trim().isNotEmpty;



    Widget content() {

      return Padding(

        padding: EdgeInsets.symmetric(horizontal: 12, vertical: hasSubtitle ? 8 : 0),

        child: Row(

          crossAxisAlignment: CrossAxisAlignment.center,

          children: [

            Container(

              width: 34,

              height: 34,

              decoration: BoxDecoration(

                color: style == DeliveryActionStyle.accent

                    ? Colors.white.withValues(alpha: 0.16)

                    : AppColors.primaryLight.withValues(alpha: 0.65),

                borderRadius: BorderRadius.circular(10),

              ),

              child: loading

                  ? const Padding(

                      padding: EdgeInsets.all(8),

                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),

                    )

                  : Icon(

                      icon,

                      size: 18,

                      color: style == DeliveryActionStyle.accent

                          ? Colors.white

                          : AppColors.primary,

                    ),

            ),

            const SizedBox(width: 10),

            Expanded(

              child: Column(

                crossAxisAlignment: CrossAxisAlignment.start,

                mainAxisSize: MainAxisSize.min,

                children: [

                  Text(

                    label,

                    maxLines: 1,

                    overflow: TextOverflow.ellipsis,

                    style: GoogleFonts.inter(

                      fontSize: 13,

                      fontWeight: FontWeight.w700,

                      letterSpacing: 0.1,

                      color: style == DeliveryActionStyle.accent

                          ? Colors.white

                          : AppColors.primary,

                    ),

                  ),

                  if (hasSubtitle) ...[

                    const SizedBox(height: 1),

                    Text(

                      subtitle!,

                      maxLines: 2,

                      overflow: TextOverflow.ellipsis,

                      style: GoogleFonts.inter(

                        fontSize: 10,

                        fontWeight: FontWeight.w500,

                        height: 1.2,

                        color: style == DeliveryActionStyle.accent

                            ? Colors.white.withValues(alpha: 0.88)

                            : AppColors.textSecondary,

                      ),

                    ),

                  ],

                ],

              ),

            ),

            if (showChevron && !loading)

              Icon(

                Icons.chevron_right_rounded,

                size: 20,

                color: style == DeliveryActionStyle.accent

                    ? Colors.white

                    : AppColors.primary,

              ),

          ],

        ),

      );

    }



    switch (style) {

      case DeliveryActionStyle.outline:

        return SizedBox(

          width: double.infinity,

          child: OutlinedButton(

            onPressed: loading ? null : onPressed,

            style: OutlinedButton.styleFrom(

              foregroundColor: AppColors.primary,

              side: BorderSide(color: AppColors.primary.withValues(alpha: 0.35)),

              shape: RoundedRectangleBorder(borderRadius: radius),

              backgroundColor: Colors.white,

              padding: EdgeInsets.zero,

              minimumSize: Size(double.infinity, hasSubtitle ? 58 : 46),

            ),

            child: content(),

          ),

        );

      case DeliveryActionStyle.accent:

        return SizedBox(

          width: double.infinity,

          child: DecoratedBox(

            decoration: BoxDecoration(

              gradient: const LinearGradient(

                colors: [Color(0xFF065F46), Color(0xFF059669)],

              ),

              borderRadius: radius,

              boxShadow: [

                BoxShadow(

                  color: AppColors.primary.withValues(alpha: 0.18),

                  blurRadius: 10,

                  offset: const Offset(0, 4),

                ),

              ],

            ),

            child: Material(

              color: Colors.transparent,

              child: InkWell(

                onTap: loading ? null : onPressed,

                borderRadius: radius,

                child: ConstrainedBox(

                  constraints: BoxConstraints(

                    minWidth: double.infinity,

                    minHeight: hasSubtitle ? 58 : 46,

                  ),

                  child: content(),

                ),

              ),

            ),

          ),

        );

      case DeliveryActionStyle.primary:

        return SizedBox(

          width: double.infinity,

          child: FilledButton(

            onPressed: loading ? null : onPressed,

            style: FilledButton.styleFrom(

              backgroundColor: AppColors.primary,

              foregroundColor: Colors.white,

              shape: RoundedRectangleBorder(borderRadius: radius),

              elevation: 0,

              padding: EdgeInsets.zero,

              minimumSize: Size(double.infinity, hasSubtitle ? 58 : 46),

            ),

            child: content(),

          ),

        );

    }

  }

}


