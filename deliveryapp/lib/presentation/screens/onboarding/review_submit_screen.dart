import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/buttons/primary_button.dart';

class ReviewSubmitScreen extends StatefulWidget {
  const ReviewSubmitScreen({super.key});

  @override
  State<ReviewSubmitScreen> createState() => _ReviewSubmitScreenState();
}

class _ReviewSubmitScreenState extends State<ReviewSubmitScreen> {
  bool _confirmed = true;

  List<_DocBadge> _docBadges(AppLocalizations l10n) => [
        _DocBadge(title: l10n.docAadhaar, icon: Icons.badge_outlined),
        _DocBadge(title: l10n.panCard, icon: Icons.credit_card_outlined),
        _DocBadge(title: l10n.uiDocDl, icon: Icons.subtitles_outlined),
        _DocBadge(title: l10n.uiDocRc, icon: Icons.description_outlined),
        _DocBadge(title: l10n.insurance, icon: Icons.verified_user_outlined),
        _DocBadge(title: l10n.policeVerification, icon: Icons.local_police_outlined),
      ];

  void _submit() {
    if (!_confirmed) return;
    Navigator.pushReplacementNamed(context, AppRoutes.registrationSuccess);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const AppBackButton(fallbackRoute: AppRoutes.profileDetails),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),
                    Text(
                      l10n.uiReviewSubmit,
                      style: GoogleFonts.inter(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      l10n.uiReviewSubmitSubtitle,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Section 1: Personal Details Card
                    _buildSummaryCard(
                      title: l10n.personalDetails,
                      children: [
                        _buildDetailText('Rahul Sharma', isTitle: true),
                        const SizedBox(height: 4),
                        _buildDetailText('9876543210'),
                        const SizedBox(height: 4),
                        _buildDetailText('rahulsharma@gmail.com'),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Section 2: Location Card
                    _buildSummaryCard(
                      title: l10n.uiLocation,
                      children: [
                        _buildDetailText('Maharashtra, Pune, Kothrud'),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Section 3: Documents Summary Card
                    _buildSummaryCard(
                      title: l10n.documents,
                      children: [
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              for (final doc in _docBadges(l10n)) ...[
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Column(
                                    children: [
                                      Stack(
                                        children: [
                                          Icon(
                                            doc.icon,
                                            size: 24,
                                            color: const Color(0xFF64748B),
                                          ),
                                          Positioned(
                                            right: 0,
                                            bottom: 0,
                                            child: Icon(
                                              Icons.check_circle,
                                              size: 10,
                                              color: AppColors.primary,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        doc.title,
                                        style: GoogleFonts.inter(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Checkbox Confirmation
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: Checkbox(
                            value: _confirmed,
                            onChanged: (v) => setState(() => _confirmed = v ?? false),
                            activeColor: AppColors.primary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            l10n.uiConfirmDetailsCorrect,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: AppColors.textPrimary,
                              height: 1.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // Submit Button
            Padding(
              padding: const EdgeInsets.all(24),
              child: PrimaryButton(
                label: l10n.uiSubmit,
                onPressed: _confirmed ? _submit : null,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard({
    required String title,
    required List<Widget> children,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }

  Widget _buildDetailText(String text, {bool isTitle = false}) {
    return Text(
      text,
      style: GoogleFonts.inter(
        fontSize: isTitle ? 15 : 14,
        fontWeight: isTitle ? FontWeight.w700 : FontWeight.w500,
        color: AppColors.textPrimary,
      ),
    );
  }
}

class _DocBadge {
  const _DocBadge({required this.title, required this.icon});

  final String title;
  final IconData icon;
}
