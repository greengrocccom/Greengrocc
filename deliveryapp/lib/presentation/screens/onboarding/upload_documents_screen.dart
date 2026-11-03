import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/image_upload_utils.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/buttons/primary_button.dart';

class UploadDocumentsScreen extends StatefulWidget {
  const UploadDocumentsScreen({super.key});

  @override
  State<UploadDocumentsScreen> createState() => _UploadDocumentsScreenState();
}

class _UploadDocumentsScreenState extends State<UploadDocumentsScreen> {
  final _picker = ImagePicker();
  final _files = <String, XFile?>{};

  final _accountHolder = TextEditingController();
  final _accountNumber = TextEditingController();
  final _ifsc = TextEditingController();
  final _bankName = TextEditingController();
  final _upiId = TextEditingController();

  static const _docKeys = [
    'aadhaar',
    'pan',
    'passport',
    'license',
    'rc',
    'insurance',
    'policeVerification',
  ];

  bool _submitting = false;

  bool get _docsReady => _docKeys.every((k) => _files[k] != null);

  bool get _bankReady =>
      _accountHolder.text.trim().isNotEmpty &&
      _accountNumber.text.trim().isNotEmpty &&
      _ifsc.text.trim().isNotEmpty &&
      _bankName.text.trim().isNotEmpty &&
      _upiId.text.trim().isNotEmpty;

  bool get _canContinue => _docsReady && _bankReady;

  @override
  void initState() {
    super.initState();
    for (final c in [
      _accountHolder,
      _accountNumber,
      _ifsc,
      _bankName,
      _upiId,
    ]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _accountHolder.dispose();
    _accountNumber.dispose();
    _ifsc.dispose();
    _bankName.dispose();
    _upiId.dispose();
    super.dispose();
  }

  Future<void> _pick(String type) async {
    final l10n = AppLocalizations.of(context);
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                l10n.uploadDocumentSheetTitle,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Icon(
                  Icons.camera_alt_outlined,
                  color: AppColors.primary,
                ),
                title: Text(l10n.takePhoto),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
              ListTile(
                leading: Icon(
                  Icons.photo_library_outlined,
                  color: AppColors.primary,
                ),
                title: Text(l10n.chooseFromGallery),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source == null) return;

    // Keep each photo small so bank + docs can reach the API (one request used to
    // send 6 full camera images and silently fail — bank/docs never saved).
    final file = await _picker.pickImage(
      source: source,
      maxWidth: 1280,
      maxHeight: 1280,
      imageQuality: 55,
    );
    if (file == null || !mounted) return;

    setState(() => _files[type] = file);
  }

  Future<void> _uploadAndContinue() async {
    setState(() => _submitting = true);
    try {
      final auth = AuthService.instance;
      // 1) Bank first (small payload) — must succeed before leaving this screen.
      await auth.updateOnboarding(
        data: {
          'bankDetails': {
            'accountHolderName': _accountHolder.text.trim(),
            'accountNumber': _accountNumber.text.trim(),
            'ifscCode': _ifsc.text.trim(),
            'bankName': _bankName.text.trim(),
            'upiId': _upiId.text.trim(),
          },
        },
      );
      // 2) One document per request so S3 / body size / timeouts don't wipe everything.
      for (final key in _docKeys) {
        final payload = await documentPayload(_files[key]);
        await auth.updateOnboarding(
          data: {
            'documents': {key: payload},
          },
        );
      }
      if (!mounted) return;
      await goOnboardingStep(
        context,
        step: 'selfie',
        route: AppRoutes.takeSelfie,
      );
    } catch (e) {
      if (!mounted) return;
      final msg = e is AuthApiException ? e.message : e.toString();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: AppColors.error),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const AppBackButton(fallbackRoute: AppRoutes.selectArea),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                children: [
                  const SizedBox(height: 8),
                  Text(
                    l10n.uploadDocuments,
                    style: GoogleFonts.inter(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    l10n.uploadDocumentsSubtitle,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // IDENTITY DOCUMENTS
                  _SectionTitle(title: l10n.identityDocuments),
                  const SizedBox(height: 10),
                  _DocumentUploadCard(
                    title: l10n.aadhaarCard,
                    subtitle: l10n.aadhaarCardSubtitle,
                    icon: Icons.badge_outlined,
                    file: _files['aadhaar'],
                    onTap: () => _pick('aadhaar'),
                  ),
                  const SizedBox(height: 10),
                  _DocumentUploadCard(
                    title: l10n.panCard,
                    subtitle: l10n.panCardSubtitle,
                    icon: Icons.credit_card_outlined,
                    file: _files['pan'],
                    onTap: () => _pick('pan'),
                  ),
                  const SizedBox(height: 10),
                  _DocumentUploadCard(
                    title: l10n.passportSizePhoto,
                    subtitle: l10n.passportSizePhotoSubtitle,
                    icon: Icons.account_box_outlined,
                    file: _files['passport'],
                    onTap: () => _pick('passport'),
                  ),
                  const SizedBox(height: 10),
                  _DocumentUploadCard(
                    title: l10n.drivingLicense,
                    subtitle: l10n.drivingLicenseSubtitle,
                    icon: Icons.subtitles_outlined,
                    file: _files['license'],
                    onTap: () => _pick('license'),
                  ),
                  const SizedBox(height: 24),

                  // VEHICLE DOCUMENTS
                  _SectionTitle(title: l10n.vehicleDocuments),
                  const SizedBox(height: 10),
                  _DocumentUploadCard(
                    title: l10n.vehicleRc,
                    subtitle: l10n.vehicleRcSubtitle,
                    icon: Icons.description_outlined,
                    file: _files['rc'],
                    onTap: () => _pick('rc'),
                  ),
                  const SizedBox(height: 10),
                  _DocumentUploadCard(
                    title: l10n.insurance,
                    subtitle: l10n.insuranceSubtitle,
                    icon: Icons.verified_user_outlined,
                    file: _files['insurance'],
                    onTap: () => _pick('insurance'),
                  ),
                  const SizedBox(height: 10),
                  _DocumentUploadCard(
                    title: l10n.policeVerification,
                    subtitle: l10n.policeVerificationSubtitle,
                    icon: Icons.local_police_outlined,
                    file: _files['policeVerification'],
                    onTap: () => _pick('policeVerification'),
                  ),
                  const SizedBox(height: 24),

                  // BANK DETAILS
                  _SectionTitle(title: l10n.bankDetails),
                  const SizedBox(height: 10),
                  _InputField(
                    controller: _accountHolder,
                    label: l10n.accountHolderName,
                    hint: l10n.accountHolderNameHint,
                    icon: Icons.person_outline,
                  ),
                  const SizedBox(height: 10),
                  _InputField(
                    controller: _bankName,
                    label: l10n.bankName,
                    hint: l10n.bankNameHint,
                    icon: Icons.account_balance_outlined,
                  ),
                  const SizedBox(height: 10),
                  _InputField(
                    controller: _accountNumber,
                    label: l10n.accountNumber,
                    hint: l10n.accountNumberHint,
                    icon: Icons.numbers_outlined,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 10),
                  _InputField(
                    controller: _ifsc,
                    label: l10n.ifscCode,
                    hint: l10n.ifscCodeHint,
                    icon: Icons.qr_code_outlined,
                    textCapitalization: TextCapitalization.characters,
                  ),
                  const SizedBox(height: 24),

                  // UPI ID
                  _SectionTitle(title: l10n.upiId),
                  const SizedBox(height: 10),
                  _InputField(
                    controller: _upiId,
                    label: l10n.upiId,
                    hint: l10n.upiIdHint,
                    icon: Icons.payment_outlined,
                  ),

                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.lock_outline,
                        size: 16,
                        color: Color(0xFF6B7280),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Your documents are safe and secure with us.',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: const Color(0xFF6B7280),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: PrimaryButton(
                label: _submitting ? 'Uploading…' : l10n.next,
                onPressed: _canContinue && !_submitting
                    ? _uploadAndContinue
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: AppColors.primary,
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  const _InputField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          textCapitalization: textCapitalization,
          style: GoogleFonts.inter(fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, color: const Color(0xFF9CA3AF), size: 20),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(
                color: AppColors.primary,
                width: 1.5,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _DocumentUploadCard extends StatelessWidget {
  const _DocumentUploadCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.file,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final XFile? file;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final uploaded = file != null;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: uploaded ? AppColors.primary : const Color(0xFFE5E7EB),
          width: uploaded ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: uploaded
                ? Image.file(
                    File(file!.path),
                    width: 48,
                    height: 48,
                    fit: BoxFit.cover,
                  )
                : Container(
                    width: 48,
                    height: 48,
                    color: const Color(0xFFDCFCE7),
                    child: Icon(icon, color: AppColors.primary, size: 24),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  uploaded ? l10n.uploadedTapToChange : subtitle,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: uploaded
                        ? AppColors.primary
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: uploaded ? const Color(0xFFDCFCE7) : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.primary,
                  width: 1.5,
                ),
              ),
              child: Text(
                uploaded ? 'Uploaded' : 'Upload',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
