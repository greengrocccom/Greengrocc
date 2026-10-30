import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/config/feature_flags.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../../pickup_driver/pickup_driver_service.dart';

class OtpVerificationScreen extends StatefulWidget {
  const OtpVerificationScreen({super.key});

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  String _phone = '';
  String _name = '';
  bool _isRegister = false;
  String _otp = '';
  int _resendSeconds = 25;
  Timer? _timer;
  final _otpController = TextEditingController();
  final _otpFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _startTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map) {
        setState(() {
          if (args['phone'] != null) _phone = args['phone'];
          if (args['isRegister'] != null) _isRegister = args['isRegister'];
          if (args['name'] != null) _name = args['name'].toString();
        });
      }
      _otpFocus.requestFocus();
    });
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _resendSeconds = 25);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_resendSeconds > 0) {
        setState(() => _resendSeconds--);
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _otpController.dispose();
    _otpFocus.dispose();
    super.dispose();
  }

  void _onOtpChanged(String value) {
    setState(() => _otp = value);
    if (value.length == 6) {
      _otpFocus.unfocus();
      _verifyOtp();
    }
  }

  void _clearOtp() {
    _otpController.clear();
    setState(() => _otp = '');
    _otpFocus.requestFocus();
  }

  bool _verifying = false;

  Future<void> _verifyOtp() async {
    if (_verifying) return;
    setState(() => _verifying = true);
    try {
      final result = await AuthService.instance.verifyOtp(
        phone: _phone,
        otp: _otp,
        purpose: _isRegister ? 'register' : 'login',
        name: _isRegister ? _name : null,
      );
      if (!mounted) return;
      if (PickupDriverService.instance.isLoggedIn) {
        await PickupDriverService.instance.logout();
        if (!mounted) return;
      }

      final boy = result.deliveryBoy;
      var route = AuthService.routeForStep(
        boy.onboardingStep,
        complete: boy.onboardingComplete,
        boy: boy,
      );
      // New registrations choose Part-Time / Full-Time before vehicle selection.
      if (kFullTimeSignupEnabled &&
          _isRegister &&
          route == AppRoutes.selectVehicle) {
        route = AppRoutes.selectEmploymentType;
      }
      Navigator.pushNamedAndRemoveUntil(
        context,
        route,
        (_) => false,
        arguments: AuthService.argumentsForStep(boy),
      );
    } on AuthApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red.shade700),
      );
      _clearOtp();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red.shade700,
        ),
      );
      _clearOtp();
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _resendOtp() async {
    _startTimer();
    try {
      await AuthService.instance.sendOtp(
        phone: _phone,
        purpose: _isRegister ? 'register' : 'login',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).otpResent),
          backgroundColor: AppColors.primary,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final timerString = '00:${_resendSeconds.toString().padLeft(2, '0')}';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const AppBackButton(fallbackRoute: AppRoutes.login),
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
                    const SizedBox(height: 12),
                    Text(
                      l10n.enterOtp,
                      style: GoogleFonts.inter(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      l10n.otpSentTo(_phone),
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 32),

                    Stack(
                      children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(6, (index) {
                        final char = index < _otp.length ? _otp[index] : '';
                        final active = _otpFocus.hasFocus && index == _otp.length;
                        return Container(
                          width: 48,
                          height: 52,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: active
                                  ? AppColors.primary
                                  : (char.isNotEmpty
                                      ? AppColors.primary
                                      : const Color(0xFFE5E7EB)),
                              width: active || char.isNotEmpty ? 1.5 : 1,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              char,
                              style: GoogleFonts.inter(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                        Positioned.fill(
                          child: Opacity(
                            opacity: 0,
                            child: TextField(
                              controller: _otpController,
                              focusNode: _otpFocus,
                              enabled: !_verifying,
                              keyboardType: TextInputType.number,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [AutofillHints.oneTimeCode],
                              maxLength: 6,
                              showCursor: false,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(6),
                              ],
                              decoration: const InputDecoration(
                                counterText: '',
                                border: InputBorder.none,
                              ),
                              onChanged: _onOtpChanged,
                              onTap: () => setState(() {}),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Center(
                      child: GestureDetector(
                        onTap: _resendSeconds == 0 ? _resendOtp : null,
                        child: RichText(
                          text: TextSpan(
                            style: GoogleFonts.inter(fontSize: 13),
                            children: [
                              if (_resendSeconds > 0)
                                TextSpan(
                                  text: l10n.resendOtpIn,
                                  style: TextStyle(color: AppColors.textSecondary),
                                ),
                              TextSpan(
                                text: _resendSeconds > 0 ? timerString : l10n.resendNow,
                                style: TextStyle(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
