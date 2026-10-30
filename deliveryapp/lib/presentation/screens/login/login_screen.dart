import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../../pickup_driver/pickup_driver_service.dart';
import '../../widgets/buttons/primary_button.dart';
import 'widgets/auth_brand_header.dart';
import 'widgets/auth_screen_background.dart';
import 'widgets/auth_text_field.dart';

/// Phone-only login / register. The OTP is sent here and verified on
/// [AppRoutes.otpVerification].
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  bool _isRegister = false;
  bool _agreedTerms = false;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map && args['mode'] == 'register') {
        setState(() => _isRegister = true);
      }
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  void _switchMode(bool register) {
    if (_isRegister == register) return;
    setState(() {
      _isRegister = register;
      _agreedTerms = false;
    });
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final phone = _phoneController.text.trim();
    final name = _nameController.text.replaceAll(RegExp(r'\s+'), ' ').trim();

    if (_isRegister && name.length < 2) {
      _showError(l10n.enterNameError);
      return;
    }
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(phone)) {
      _showError(l10n.mobileNumberHint);
      return;
    }
    if (_isRegister && !_agreedTerms) {
      _showError(l10n.agreeTermsError);
      return;
    }

    setState(() => _loading = true);
    try {
      await AuthService.instance.sendOtp(
        phone: phone,
        purpose: _isRegister ? 'register' : 'login',
      );
      if (!mounted) return;
      Navigator.pushNamed(
        context,
        AppRoutes.otpVerification,
        arguments: {
          'phone': phone,
          'isRegister': _isRegister,
          if (_isRegister) 'name': name,
        },
      );
    } on AuthApiException catch (e) {
      if (mounted) _showError(e.message);
    } catch (_) {
      if (mounted) _showError(l10n.authError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Vendor-created pickup drivers (farm → collection centre) still sign in
  /// with the password their vendor gave them.
  Future<void> _pickupDriverLogin() async {
    final l10n = AppLocalizations.of(context);
    final phoneCtrl = TextEditingController(text: _phoneController.text.trim());
    final passCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.pickupDriverLogin),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: phoneCtrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(labelText: l10n.mobileNumber),
            ),
            TextField(
              controller: passCtrl,
              obscureText: true,
              decoration: InputDecoration(labelText: l10n.password),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.login),
          ),
        ],
      ),
    );
    final phone = phoneCtrl.text.trim();
    final password = passCtrl.text;
    phoneCtrl.dispose();
    passCtrl.dispose();
    if (ok != true || phone.length != 10 || password.isEmpty) return;

    setState(() => _loading = true);
    try {
      await PickupDriverService.instance.login(mobile: phone, password: password);
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.pickupDriverHome,
        (_) => false,
      );
    } on PickupDriverException catch (e) {
      if (mounted) _showError(e.message);
    } catch (_) {
      if (mounted) _showError(l10n.authError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.error),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: Colors.white,
      body: AuthScreenBackground(
        child: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: AppBackButton(
                  fallbackRoute: AppRoutes.selectLanguage,
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
                  child: Column(
                    children: [
                      const AuthBrandHeader(),
                      const SizedBox(height: 28),
                      Text(
                        _isRegister ? l10n.createAccount : l10n.welcomeBack,
                        style: GoogleFonts.inter(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _isRegister
                            ? l10n.registerOtpSubtitle
                            : l10n.loginOtpSubtitle,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 28),
                      if (_isRegister) ...[
                        AuthTextField(
                          label: l10n.fullName,
                          hint: l10n.fullNameHint,
                          icon: Icons.person_rounded,
                          controller: _nameController,
                          keyboardType: TextInputType.name,
                          textCapitalization: TextCapitalization.words,
                          maxLength: 60,
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r"[\p{L}\p{M} .'-]", unicode: true),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                      ],
                      AuthTextField(
                        label: l10n.mobileNumber,
                        hint: '00000 00000',
                        icon: Icons.smartphone_rounded,
                        controller: _phoneController,
                        prefixText: '+91  ',
                        keyboardType: TextInputType.phone,
                        maxLength: 10,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      ),
                      if (_isRegister) ...[
                        const SizedBox(height: 14),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 24,
                              height: 24,
                              child: Checkbox(
                                value: _agreedTerms,
                                activeColor: AppColors.primary,
                                side: const BorderSide(color: Color(0xFFD1D5DB)),
                                onChanged: (v) => setState(
                                  () => _agreedTerms = v ?? false,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text.rich(
                                  TextSpan(
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      color: AppColors.textSecondary,
                                      height: 1.4,
                                    ),
                                    children: [
                                      TextSpan(text: l10n.agreeTermsPrefix),
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
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 22),
                      PrimaryButton(
                        label: _loading ? '...' : l10n.sendOtp,
                        onPressed: _loading ? null : _submit,
                      ),
                      const SizedBox(height: 24),
                      GestureDetector(
                        onTap: _loading
                            ? null
                            : () => _switchMode(!_isRegister),
                        child: Text.rich(
                          textAlign: TextAlign.center,
                          TextSpan(
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: AppColors.textSecondary,
                            ),
                            children: [
                              TextSpan(
                                text: _isRegister
                                    ? l10n.haveAccountPrompt
                                    : l10n.noAccountPrompt,
                              ),
                              TextSpan(
                                text: _isRegister ? l10n.login : l10n.registerNow,
                                style: TextStyle(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (!_isRegister) ...[
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: _loading ? null : _pickupDriverLogin,
                          child: Text(
                            l10n.pickupDriverLogin,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
