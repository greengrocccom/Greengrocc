import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/buttons/primary_button.dart';
import '../../widgets/buttons/secondary_button.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            children: [
              const Spacer(),
              // Scooter graphic
              Container(
                width: 140,
                height: 140,
                decoration: const BoxDecoration(
                  color: Color(0xFFDCFCE7),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Icon(
                    Icons.two_wheeler_rounded,
                    size: 72,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              Text(
                l10n.uiWelcomeTitle,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                l10n.uiWelcomeSubtitle,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 15,
                  color: AppColors.textSecondary,
                  height: 1.35,
                ),
              ),
              const Spacer(),
              PrimaryButton(
                label: l10n.register,
                onPressed: () {
                  Navigator.pushNamed(
                    context,
                    AppRoutes.login,
                    arguments: {'mode': 'register'},
                  );
                },
              ),
              const SizedBox(height: 12),
              SecondaryButton(
                label: l10n.login,
                onPressed: () {
                  Navigator.pushNamed(
                    context,
                    AppRoutes.login,
                    arguments: {'mode': 'login'},
                  );
                },
              ),
              const SizedBox(height: 24),
              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppColors.textMuted,
                    height: 1.4,
                  ),
                  children: [
                    TextSpan(text: l10n.uiByContinuingAgreePrefix),
                    TextSpan(
                      text: l10n.termsAndConditions,
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    TextSpan(text: l10n.andWord),
                    TextSpan(
                      text: l10n.privacyPolicy,
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    TextSpan(text: l10n.uiByContinuingAgreeSuffix),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
