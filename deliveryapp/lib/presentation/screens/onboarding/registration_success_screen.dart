import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/buttons/primary_button.dart';

class RegistrationSuccessScreen extends StatelessWidget {
  const RegistrationSuccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Column(
            children: [
              const Spacer(),

              // Celebration Success Icon with dots
              Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  // Decorative confetti dots
                  Positioned(
                    top: -24,
                    left: -20,
                    child: _dot(const Color(0xFFEF4444), 6),
                  ),
                  Positioned(
                    top: -12,
                    right: -16,
                    child: _dot(const Color(0xFFF59E0B), 8),
                  ),
                  Positioned(
                    bottom: -16,
                    left: -10,
                    child: _dot(const Color(0xFF3B82F6), 7),
                  ),
                  Positioned(
                    bottom: -20,
                    right: -24,
                    child: _dot(const Color(0xFF10B981), 6),
                  ),
                  Positioned(
                    top: 20,
                    right: -36,
                    child: _dot(const Color(0xFFEC4899), 5),
                  ),

                  // Main Green Success Checkmark Badge
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.25),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      size: 54,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 36),

              Text(
                l10n.uiRegistrationSuccessful,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                l10n.uiRegistrationSuccessBody,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
              const Spacer(),

              // Go to Home Button
              PrimaryButton(
                label: l10n.goToHome,
                onPressed: () {
                  Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.home,
                    (route) => false,
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _dot(Color color, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
    );
  }
}
