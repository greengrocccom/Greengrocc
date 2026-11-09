import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/config/feature_flags.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/l10n/app_l10n.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../l10n/app_localizations.dart';

class EmploymentTypeScreen extends StatefulWidget {
  const EmploymentTypeScreen({super.key});

  @override
  State<EmploymentTypeScreen> createState() => _EmploymentTypeScreenState();
}

class _EmploymentTypeScreenState extends State<EmploymentTypeScreen> {
  String? _selected = kFullTimeSignupEnabled ? null : 'PART_TIME';

  static List<_EmploymentOption> get _options => kFullTimeSignupEnabled
      ? _allOptions
      : _allOptions.where((o) => o.id != 'FULL_TIME').toList();

  static List<_EmploymentOption> get _allOptions => [
        _EmploymentOption(
          id: 'PART_TIME',
          icon: Icons.access_time_outlined,
          title: appL10n.uiPartTime,
          subtitle: appL10n.uiPartTimeSubtitle,
        ),
        _EmploymentOption(
          id: 'FULL_TIME',
          icon: Icons.work_outline,
          title: appL10n.uiFullTime,
          subtitle: appL10n.uiFullTimeSubtitle,
        ),
      ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: const AppBackButton(fallbackRoute: AppRoutes.login),
        title: Text(
          AppLocalizations.of(context).uiEmploymentType,
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: false,
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                itemCount: _options.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final option = _options[index];
                  return _EmploymentCard(
                    title: option.title,
                    subtitle: option.subtitle,
                    icon: option.icon,
                    selected: _selected == option.id,
                    onTap: () => setState(() => _selected = option.id),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
              child: _NextButton(
                enabled: _selected != null,
                onPressed: _selected == null
                    ? null
                    : () => goOnboardingStep(
                          context,
                          step: 'vehicle',
                          route: AppRoutes.selectVehicle,
                          data: {'employmentType': _selected},
                        ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmploymentOption {
  const _EmploymentOption({
    required this.id,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final String id;
  final IconData icon;
  final String title;
  final String subtitle;
}

class _EmploymentCard extends StatelessWidget {
  const _EmploymentCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  static const _footerColor = Color(0xFF2B2B2B);
  static const _imageHeight = 100.0;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? AppColors.primary : Colors.transparent,
              width: 2,
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Column(
              children: [
                Container(
                  width: double.infinity,
                  height: _imageHeight,
                  color: Colors.white,
                  child: Center(
                    child: Icon(
                      icon,
                      size: 64,
                      color: selected ? AppColors.primary : AppColors.textMuted,
                    ),
                  ),
                ),
                Container(
                  width: double.infinity,
                  color: _footerColor,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              subtitle,
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Colors.white.withValues(alpha: 0.65),
                              ),
                            ),
                          ],
                        ),
                      ),
                      _SelectionIndicator(selected: selected),
                    ],
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

class _SelectionIndicator extends StatelessWidget {
  const _SelectionIndicator({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? AppColors.primary : Colors.transparent,
        border: Border.all(
          color: AppColors.primary,
          width: 2,
        ),
      ),
      child: selected
          ? const Icon(Icons.check, size: 13, color: Colors.white)
          : null,
    );
  }
}

class _NextButton extends StatelessWidget {
  const _NextButton({
    required this.enabled,
    required this.onPressed,
  });

  final bool enabled;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.45),
          disabledForegroundColor: Colors.white.withValues(alpha: 0.75),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
          elevation: 0,
        ),
        child: Text(
          l10n.next,
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
