import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/exceptions/api_exception.dart';
import '../../core/utils/validators.dart';
import '../../models/user.dart';
import 'auth_completion.dart';
import 'auth_controller.dart';

const _brand = Color(0xFF075E34);
const _brandDark = Color(0xFF064E2B);

/// Website-style auth: Sign In (OTP or password) and Sign Up (retail / bulk),
/// both verified with an SMS OTP (MSG91 user login / registration templates).
class AuthSheet extends ConsumerStatefulWidget {
  const AuthSheet({super.key, required this.mode});

  final AuthModalMode mode;

  @override
  ConsumerState<AuthSheet> createState() => _AuthSheetState();
}

class _AuthSheetState extends ConsumerState<AuthSheet> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _shopNameController = TextEditingController();
  final _shopAddressController = TextEditingController();
  final _ownerContactController = TextEditingController();
  final _gstNumberController = TextEditingController();
  final _otpController = TextEditingController();
  final _otpFocus = FocusNode();

  late AuthModalMode _currentMode;
  bool _passwordLogin = false;
  bool _otpStep = false;
  String _accountType = 'retail';
  bool _showPassword = false;
  bool _agreedToTerms = true;
  bool _submitting = false;
  String? _error;
  int _resendIn = 0;
  Timer? _timer;

  bool get _isSignup => _currentMode == AuthModalMode.signup;
  bool get _isBulk => _accountType == 'bulk';
  String get _phone => _phoneController.text.replaceAll(RegExp(r'\D'), '');

  @override
  void initState() {
    super.initState();
    _currentMode = widget.mode;
    for (final c in [
      _nameController,
      _phoneController,
      _emailController,
      _passwordController,
      _shopNameController,
      _shopAddressController,
      _ownerContactController,
      _gstNumberController,
      _otpController,
    ]) {
      c.addListener(_clearError);
    }
  }

  @override
  void didUpdateWidget(covariant AuthSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mode != widget.mode) {
      _resetForm();
      setState(() => _currentMode = widget.mode);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _shopNameController.dispose();
    _shopAddressController.dispose();
    _ownerContactController.dispose();
    _gstNumberController.dispose();
    _otpController.dispose();
    _otpFocus.dispose();
    super.dispose();
  }

  void _clearError() {
    if (_error != null) setState(() => _error = null);
  }

  void _resetForm() {
    _timer?.cancel();
    for (final c in [
      _nameController,
      _phoneController,
      _emailController,
      _passwordController,
      _shopNameController,
      _shopAddressController,
      _ownerContactController,
      _gstNumberController,
      _otpController,
    ]) {
      c.clear();
    }
    setState(() {
      _passwordLogin = false;
      _otpStep = false;
      _accountType = 'retail';
      _showPassword = false;
      _submitting = false;
      _error = null;
      _resendIn = 0;
    });
  }

  void _switchMode(AuthModalMode nextMode) {
    if (nextMode == _currentMode) return;
    _resetForm();
    setState(() => _currentMode = nextMode);
    ref.read(authControllerProvider.notifier).setAuthModal(nextMode);
  }

  void _startResendTimer() {
    _timer?.cancel();
    setState(() => _resendIn = 30);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _resendIn = _resendIn > 0 ? _resendIn - 1 : 0);
      if (_resendIn == 0) t.cancel();
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await action();
    } catch (error, stackTrace) {
      debugPrint('Auth error: $error\n$stackTrace');
      if (mounted) setState(() => _error = authErrorMessage(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // ---------------- Validation ----------------

  String? _validateSignup() {
    final name = _nameController.text.trim();
    if (!Validators.isValidName(name)) {
      return _isBulk
          ? 'Owner name must be 1 or 2 words, letters only (e.g. Rahul or John Smith)'
          : 'Please enter your full name (letters only, e.g. Rahul Sharma)';
    }
    if (!Validators.isValidPhone(_phone)) {
      return 'Phone number must be 10 digits starting with 6, 7, 8, or 9';
    }
    final email = _emailController.text.trim();
    if (email.isNotEmpty && !Validators.isValidEmail(email)) {
      return 'Please enter a valid email address';
    }
    final password = _passwordController.text.trim();
    if (password.isNotEmpty && !Validators.isValidPassword(password)) {
      return 'Password must be at least 6 characters';
    }
    if (_isBulk) {
      if (!Validators.isValidShopName(_shopNameController.text.trim())) {
        return 'Please enter your business name (at least 2 characters)';
      }
      if (!Validators.isValidShopAddress(_shopAddressController.text.trim())) {
        return 'Please enter your complete business address';
      }
      final owner = _ownerContactController.text.trim().isEmpty
          ? _phone
          : _ownerContactController.text.trim();
      if (!Validators.isValidPhone(owner)) {
        return 'Owner contact must be 10 digits starting with 6, 7, 8, or 9';
      }
      final gst = _gstNumberController.text.trim().toUpperCase();
      if (gst.isNotEmpty && !Validators.isValidGst(gst)) {
        return 'Please enter a valid 15-character GST number';
      }
    }
    if (!_agreedToTerms) {
      return 'Please agree to the Terms & Conditions and Privacy Policy';
    }
    return null;
  }

  // ---------------- Actions ----------------

  Future<void> _sendOtp() async {
    final error = _isSignup
        ? _validateSignup()
        : (Validators.isValidPhone(_phone)
            ? null
            : 'Please enter a valid 10-digit mobile number');
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    await _run(() async {
      await ref
          .read(authControllerProvider.notifier)
          .sendOtp(_phone, purpose: _isSignup ? 'signup' : 'login');
      if (!mounted) return;
      _otpController.clear();
      setState(() => _otpStep = true);
      _startResendTimer();
      _toast(_isSignup ? 'Registration OTP sent to your phone' : 'OTP sent to your mobile number');
      Future.delayed(const Duration(milliseconds: 150), () {
        if (mounted) _otpFocus.requestFocus();
      });
    });
  }

  Future<void> _resendOtp() async {
    if (_resendIn > 0 || _submitting) return;
    await _run(() async {
      await ref
          .read(authControllerProvider.notifier)
          .resendOtp(_phone, purpose: _isSignup ? 'signup' : 'login');
      if (!mounted) return;
      _startResendTimer();
      _toast('New OTP sent successfully');
    });
  }

  Future<void> _verifyOtp() async {
    final otp = _otpController.text.trim();
    if (otp.length < 4 || otp.length > 6) {
      setState(() => _error = 'Please enter the 6-digit OTP code');
      return;
    }
    await _run(() async {
      final controller = ref.read(authControllerProvider.notifier);
      final result = await controller.verifyOtp(phone: _phone, otp: otp);
      User? user = result.user;
      if (result.needsSignup) {
        if (!_isSignup) {
          throw ApiException('No account found with this number. Please sign up first.');
        }
        user = await controller.completeOtpSignup(_signupPayload());
      }
      if (!mounted || user == null) return;
      _toast(_isSignup
          ? (_isBulk ? 'Business account created successfully!' : 'Account created successfully!')
          : 'Signed in successfully!');
      completeAuthAndGoHome(
        ref: ref,
        sheetContext: context,
        user: user,
        isSignup: _isSignup,
      );
    });
    if (mounted && _error != null) {
      final message = _error;
      _otpController.clear();
      setState(() => _error = message);
      _otpFocus.requestFocus();
    }
  }

  Map<String, dynamic> _signupPayload() {
    final email = _emailController.text.trim().toLowerCase();
    final password = _passwordController.text.trim();
    final gst = _gstNumberController.text.trim().toUpperCase();
    final owner = _ownerContactController.text.trim().isEmpty
        ? _phone
        : _ownerContactController.text.replaceAll(RegExp(r'\D'), '');
    return {
      'name': _nameController.text.trim(),
      'phone': _phone,
      'accountType': _accountType,
      if (email.isNotEmpty) 'email': email,
      if (password.isNotEmpty) 'password': password,
      if (_isBulk) ...{
        'shopName': _shopNameController.text.trim(),
        'shopAddress': _shopAddressController.text.trim(),
        'ownerContact': owner,
        if (gst.isNotEmpty) 'gstNumber': gst,
      },
    };
  }

  Future<void> _passwordSignIn() async {
    if (!Validators.isValidPhone(_phone)) {
      setState(() => _error = 'Please enter a valid 10-digit mobile number');
      return;
    }
    if (!Validators.isValidPassword(_passwordController.text)) {
      setState(() => _error = 'Password must be at least 6 characters');
      return;
    }
    await _run(() async {
      final user = await ref.read(authControllerProvider.notifier).login(
            phone: _phone,
            password: _passwordController.text,
          );
      if (!mounted) return;
      _toast('Signed in successfully!');
      completeAuthAndGoHome(ref: ref, sheetContext: context, user: user, isSignup: false);
    });
  }

  void _toast(String message) {
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  // ---------------- UI ----------------

  TextStyle _font(double size, FontWeight weight, Color color, {double? spacing}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: size,
        fontWeight: weight,
        color: color,
        letterSpacing: spacing,
      );

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.only(
          left: 22,
          right: 22,
          top: 14,
          bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: Material(
                color: Colors.transparent,
                shape: const CircleBorder(),
                child: IconButton(
                  onPressed: () {
                    if (Navigator.of(context).canPop()) Navigator.of(context).pop();
                  },
                  icon: const Icon(Icons.close_rounded, color: Color(0xFF9CA3AF)),
                ),
              ),
            ),
            Center(
              child: Image.asset('assets/images/gg_logo.png', height: 40, fit: BoxFit.contain),
            ),
            if (!_otpStep) ...[
              const SizedBox(height: 14),
              _ModeTabs(
                isSignup: _isSignup,
                onLogin: _submitting ? null : () => _switchMode(AuthModalMode.login),
                onSignup: _submitting ? null : () => _switchMode(AuthModalMode.signup),
              ),
              const SizedBox(height: 12),
              Text(
                _isSignup ? 'Create Account' : 'Welcome Back!',
                textAlign: TextAlign.center,
                style: _font(22, FontWeight.w900, const Color(0xFF111827), spacing: -0.4),
              ),
              const SizedBox(height: 3),
              Text(
                _isSignup
                    ? 'Join GreenGrocc for farm-fresh produce delivered fast'
                    : 'Sign in to continue your fresh & healthy shopping',
                textAlign: TextAlign.center,
                style: _font(12, FontWeight.w500, const Color(0xFF6B7280)),
              ),
            ],
            if (!_isSignup && !_otpStep) ...[
              const SizedBox(height: 12),
              const Divider(height: 1, color: Color(0xFFF3F4F6)),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _MethodTab(
                    label: 'Login with OTP',
                    icon: Icons.smartphone_rounded,
                    active: !_passwordLogin,
                    onTap: () => setState(() {
                      _passwordLogin = false;
                      _error = null;
                    }),
                  ),
                  const SizedBox(width: 18),
                  _MethodTab(
                    label: 'Password Login',
                    icon: Icons.lock_outline_rounded,
                    active: _passwordLogin,
                    onTap: () => setState(() {
                      _passwordLogin = true;
                      _error = null;
                    }),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 14),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Text(_error!, style: _font(12, FontWeight.w500, const Color(0xFFDC2626))),
              ),
              const SizedBox(height: 12),
            ],
            if (_otpStep)
              _buildOtpStep()
            else if (_isSignup)
              _buildSignupForm()
            else if (_passwordLogin)
              _buildPasswordLogin()
            else
              _buildPhoneStep(),
            if (!_otpStep) ...[
            const SizedBox(height: 16),
            Center(
              child: Text.rich(
                TextSpan(
                  text: _isSignup ? 'Already have an account? ' : "Don't have an account? ",
                  style: _font(12.5, FontWeight.w500, const Color(0xFF6B7280)),
                  children: [
                    WidgetSpan(
                      alignment: PlaceholderAlignment.middle,
                      child: GestureDetector(
                        onTap: _submitting
                            ? null
                            : () => _switchMode(
                                _isSignup ? AuthModalMode.login : AuthModalMode.signup),
                        child: Text(
                          _isSignup ? 'Sign In' : 'Sign Up',
                          style: _font(12.5, FontWeight.w700, _brand),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPhoneStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PhoneField(controller: _phoneController, enabled: !_submitting, onSubmitted: _sendOtp),
        const SizedBox(height: 12),
        _PrimaryButton(
          label: _submitting ? 'Sending OTP...' : 'Get OTP',
          busy: _submitting,
          onPressed: _sendOtp,
        ),
      ],
    );
  }

  Widget _buildOtpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 10),
        _OtpBoxes(
          controller: _otpController,
          focusNode: _otpFocus,
          enabled: !_submitting,
          onCompleted: () {
            if (!_submitting) _verifyOtp();
          },
        ),
        const SizedBox(height: 18),
        Center(
          child: _submitting
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: _brand),
                )
              : _resendIn > 0
              ? Text.rich(
                  TextSpan(
                    text: 'Resend OTP in ',
                    style: _font(12, FontWeight.w500, const Color(0xFF6B7280)),
                    children: [
                      TextSpan(
                        text: '${_resendIn}s',
                        style: _font(12, FontWeight.w700, const Color(0xFF1F2937)),
                      ),
                    ],
                  ),
                )
              : GestureDetector(
                  onTap: _resendOtp,
                  child: Text(
                    'Resend OTP',
                    style: _font(13, FontWeight.w700, _brand).copyWith(
                      decoration: TextDecoration.underline,
                      decorationColor: _brand,
                    ),
                  ),
                ),
        ),
        const SizedBox(height: 6),
      ],
    );
  }

  Widget _buildPasswordLogin() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PhoneField(controller: _phoneController, enabled: !_submitting),
        const SizedBox(height: 10),
        _PasswordField(
          controller: _passwordController,
          enabled: !_submitting,
          visible: _showPassword,
          hint: 'Password',
          onToggle: () => setState(() => _showPassword = !_showPassword),
          onSubmitted: _passwordSignIn,
        ),
        const SizedBox(height: 12),
        _PrimaryButton(
          label: _submitting ? 'Signing in...' : 'Sign In with Password',
          busy: _submitting,
          onPressed: _passwordSignIn,
        ),
      ],
    );
  }

  Widget _buildSignupForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: _AccountTypeCard(
                title: 'Retail',
                subtitle: 'Everyday shopping',
                icon: Icons.person_outline_rounded,
                active: !_isBulk,
                onTap: _submitting ? null : () => setState(() => _accountType = 'retail'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _AccountTypeCard(
                title: 'Bulk / Business',
                subtitle: 'Grade A, B & C pricing',
                icon: Icons.storefront_outlined,
                active: _isBulk,
                onTap: _submitting ? null : () => setState(() => _accountType = 'bulk'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _TextInput(
          controller: _nameController,
          enabled: !_submitting,
          hint: _isBulk ? 'Owner Full Name' : 'Full Name',
          icon: Icons.person_outline_rounded,
          capitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 10),
        _PhoneField(controller: _phoneController, enabled: !_submitting),
        if (_isBulk) ...[
          const SizedBox(height: 10),
          _TextInput(
            controller: _shopNameController,
            enabled: !_submitting,
            hint: 'Business / Shop Name',
            icon: Icons.storefront_outlined,
            capitalization: TextCapitalization.words,
          ),
          const SizedBox(height: 10),
          _TextInput(
            controller: _shopAddressController,
            enabled: !_submitting,
            hint: 'Business Address (area, city, pincode)',
            icon: Icons.location_on_outlined,
            maxLines: 2,
          ),
          const SizedBox(height: 10),
          _TextInput(
            controller: _ownerContactController,
            enabled: !_submitting,
            hint: 'Owner Contact (defaults to mobile)',
            icon: Icons.contact_phone_outlined,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            formatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: 10),
          _TextInput(
            controller: _gstNumberController,
            enabled: !_submitting,
            hint: 'GST Number (Optional)',
            icon: Icons.badge_outlined,
            maxLength: 15,
            capitalization: TextCapitalization.characters,
            formatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]')),
              _UpperCaseFormatter(),
            ],
          ),
        ],
        const SizedBox(height: 10),
        _TextInput(
          controller: _emailController,
          enabled: !_submitting,
          hint: 'Email Address (Optional)',
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 10),
        _PasswordField(
          controller: _passwordController,
          enabled: !_submitting,
          visible: _showPassword,
          hint: 'Password (Optional)',
          onToggle: () => setState(() => _showPassword = !_showPassword),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: _submitting ? null : () => setState(() => _agreedToTerms = !_agreedToTerms),
          borderRadius: BorderRadius.circular(8),
          child: Row(
            children: [
              SizedBox(
                width: 28,
                height: 28,
                child: Checkbox(
                  value: _agreedToTerms,
                  activeColor: _brand,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                  onChanged: _submitting
                      ? null
                      : (v) => setState(() => _agreedToTerms = v ?? false),
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'I agree to Terms & Conditions and Privacy Policy',
                  style: _font(11.5, FontWeight.w500, const Color(0xFF4B5563)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _PrimaryButton(
          label: _submitting
              ? 'Sending OTP...'
              : (_isBulk ? 'Register Business & Get OTP' : 'Create Account & Get OTP'),
          busy: _submitting,
          onPressed: _sendOtp,
        ),
      ],
    );
  }
}

/// Six digit boxes backed by one hidden field (system keypad + SMS autofill).
class _OtpBoxes extends StatefulWidget {
  const _OtpBoxes({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.onCompleted,
  });

  static const length = 6;

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final VoidCallback onCompleted;

  @override
  State<_OtpBoxes> createState() => _OtpBoxesState();
}

class _OtpBoxesState extends State<_OtpBoxes> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
    widget.focusNode.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    widget.focusNode.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final code = widget.controller.text;
    final focused = widget.focusNode.hasFocus;
    return GestureDetector(
      onTap: () => widget.focusNode.requestFocus(),
      child: Stack(
        children: [
          Opacity(
            opacity: 0,
            child: SizedBox(
              height: 52,
              child: TextField(
                controller: widget.controller,
                focusNode: widget.focusNode,
                enabled: widget.enabled,
                autofocus: true,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                maxLength: _OtpBoxes.length,
                showCursor: false,
                enableInteractiveSelection: false,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(counterText: '', border: InputBorder.none),
                onChanged: (value) {
                  if (value.length == _OtpBoxes.length) widget.onCompleted();
                },
              ),
            ),
          ),
          IgnorePointer(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(_OtpBoxes.length, (i) {
                final filled = i < code.length;
                final active = focused && i == code.length.clamp(0, _OtpBoxes.length - 1);
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 120),
                  width: 46,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: filled ? const Color(0xFFECFDF5) : const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: active || filled ? _brand : const Color(0xFFE5E7EB),
                      width: active ? 2 : 1.2,
                    ),
                  ),
                  child: Text(
                    filled ? code[i] : '',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF111827),
                    ),
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}

class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) =>
      newValue.copyWith(text: newValue.text.toUpperCase());
}

class _ModeTabs extends StatelessWidget {
  const _ModeTabs({required this.isSignup, required this.onLogin, required this.onSignup});

  final bool isSignup;
  final VoidCallback? onLogin;
  final VoidCallback? onSignup;

  @override
  Widget build(BuildContext context) {
    Widget tab(String label, bool active, VoidCallback? onTap) => Expanded(
          child: GestureDetector(
            onTap: onTap,
            behavior: HitTestBehavior.opaque,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              padding: const EdgeInsets.symmetric(vertical: 7),
              decoration: BoxDecoration(
                color: active ? _brand : Colors.transparent,
                borderRadius: BorderRadius.circular(999),
              ),
              alignment: Alignment.center,
              child: Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: active ? Colors.white : const Color(0xFF4B5563),
                ),
              ),
            ),
          ),
        );

    return Center(
      child: Container(
        width: 260,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            tab('Sign In', !isSignup, onLogin),
            tab('Sign Up', isSignup, onSignup),
          ],
        ),
      ),
    );
  }
}

class _MethodTab extends StatelessWidget {
  const _MethodTab({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? _brand : const Color(0xFF9CA3AF);
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: active ? _brand : Colors.transparent, width: 2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AccountTypeCard extends StatelessWidget {
  const _AccountTypeCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFECFDF5) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: active ? _brand : const Color(0xFFE5E7EB),
            width: active ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: active ? _brand : const Color(0xFF6B7280)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: active ? _brand : const Color(0xFF111827),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10.5,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF6B7280),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldBox extends StatelessWidget {
  const _FieldBox({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: child,
    );
  }
}

InputDecoration _bareDecoration(String hint) => InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.plusJakartaSans(
        fontSize: 13.5,
        fontWeight: FontWeight.w500,
        color: const Color(0xFF9CA3AF),
      ),
      border: InputBorder.none,
      enabledBorder: InputBorder.none,
      focusedBorder: InputBorder.none,
      disabledBorder: InputBorder.none,
      isDense: true,
      counterText: '',
      contentPadding: EdgeInsets.zero,
      filled: false,
    );

TextStyle get _inputStyle => GoogleFonts.plusJakartaSans(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: const Color(0xFF111827),
    );

class _PhoneField extends StatelessWidget {
  const _PhoneField({required this.controller, required this.enabled, this.onSubmitted});

  final TextEditingController controller;
  final bool enabled;
  final VoidCallback? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return _FieldBox(
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.only(right: 8),
            margin: const EdgeInsets.only(right: 8),
            decoration: const BoxDecoration(
              border: Border(right: BorderSide(color: Color(0xFFE5E7EB))),
            ),
            child: Text(
              '+91',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF4B5563),
              ),
            ),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumberNational],
              maxLength: 10,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: _inputStyle,
              decoration: _bareDecoration('Enter 10-digit mobile number'),
              textInputAction: onSubmitted != null ? TextInputAction.done : TextInputAction.next,
              onSubmitted: onSubmitted == null ? null : (_) => onSubmitted!(),
            ),
          ),
        ],
      ),
    );
  }
}

class _TextInput extends StatelessWidget {
  const _TextInput({
    required this.controller,
    required this.enabled,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.maxLength,
    this.maxLines = 1,
    this.formatters,
    this.capitalization = TextCapitalization.none,
  });

  final TextEditingController controller;
  final bool enabled;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final int? maxLength;
  final int maxLines;
  final List<TextInputFormatter>? formatters;
  final TextCapitalization capitalization;

  @override
  Widget build(BuildContext context) {
    return _FieldBox(
      child: Row(
        crossAxisAlignment: maxLines > 1 ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 18, color: const Color(0xFF9CA3AF)),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              keyboardType: keyboardType,
              maxLength: maxLength,
              maxLines: maxLines,
              minLines: 1,
              inputFormatters: formatters,
              textCapitalization: capitalization,
              style: _inputStyle,
              decoration: _bareDecoration(hint),
              textInputAction: TextInputAction.next,
            ),
          ),
        ],
      ),
    );
  }
}

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.controller,
    required this.enabled,
    required this.visible,
    required this.hint,
    required this.onToggle,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool visible;
  final String hint;
  final VoidCallback onToggle;
  final VoidCallback? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return _FieldBox(
      child: Row(
        children: [
          const Icon(Icons.lock_outline_rounded, size: 18, color: Color(0xFF9CA3AF)),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              obscureText: !visible,
              style: _inputStyle,
              decoration: _bareDecoration(hint),
              textInputAction: onSubmitted != null ? TextInputAction.done : TextInputAction.next,
              onSubmitted: onSubmitted == null ? null : (_) => onSubmitted!(),
            ),
          ),
          GestureDetector(
            onTap: onToggle,
            child: Icon(
              visible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              size: 18,
              color: const Color(0xFF9CA3AF),
            ),
          ),
        ],
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({required this.label, required this.busy, required this.onPressed});

  final String label;
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: _brand,
          disabledBackgroundColor: _brand.withValues(alpha: 0.6),
          foregroundColor: Colors.white,
          overlayColor: _brandDark,
          shape: const StadiumBorder(),
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
            if (!busy) ...[
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_rounded, size: 18, color: Colors.white),
            ],
          ],
        ),
      ),
    );
  }
}
