import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:google_fonts/google_fonts.dart';

import '../../core/exceptions/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../features/auth/auth_controller.dart';
import '../../routes/route_paths.dart';
import '../../widgets/common/image_source_sheet.dart';
import '../../widgets/layout/storefront_header.dart';
import '../../widgets/layout/storefront_page.dart';
import 'support_constants.dart';

const _maxAttachmentBytes = 5 * 1024 * 1024;
const _maxMessageLength = 1000;

class SupportScreen extends ConsumerStatefulWidget {
  const SupportScreen({super.key});

  @override
  ConsumerState<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends ConsumerState<SupportScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _orderIdController = TextEditingController();
  final _messageController = TextEditingController();
  final _picker = ImagePicker();

  String? _issueType;
  String? _attachmentUrl;
  String? _attachmentLocalPath;
  String? _attachmentName;
  bool _submitting = false;
  bool _uploadingAttachment = false;
  String? _error;
  String? _success;
  int? _openFaq;
  String _phone = supportContactPhone;
  String _phoneTel = supportContactPhoneHref;
  String _whatsapp = supportContactPhone;
  String _whatsappHref = supportWhatsAppHref;
  String _email = supportContactEmail;
  String _hours = 'Mon – Sat · 10 AM – 10 PM';
  String _vendorName = '';
  bool _isVendorSpecific = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _prefillUser();
      _loadSupportContact();
    });
  }

  Future<void> _loadSupportContact() async {
    try {
      final data = await ref.read(apiServiceProvider).fetchSupportContact();
      if (!mounted || data.isEmpty) return;
      setState(() {
        if (data['phone'] != null) _phone = data['phone'] as String;
        if (data['phoneTel'] != null) _phoneTel = data['phoneTel'] as String;
        if (data['whatsapp'] != null) _whatsapp = data['whatsapp'] as String;
        if (data['whatsappHref'] != null) _whatsappHref = data['whatsappHref'] as String;
        if (data['email'] != null) _email = data['email'] as String;
        if (data['hours'] != null) _hours = data['hours'] as String;
        if (data['vendorName'] != null) _vendorName = data['vendorName'] as String;
        _isVendorSpecific = data['isVendorSpecific'] == true;
      });
    } catch (_) {}
  }

  void _prefillUser() {
    final user = ref.read(authControllerProvider).user;
    if (user == null) return;
    if (_nameController.text.isEmpty) _nameController.text = user.name;
    if (_emailController.text.isEmpty) _emailController.text = user.email;
    if (_phoneController.text.isEmpty) _phoneController.text = user.phone;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _orderIdController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _pickAttachment() async {
    final source = await showImageSourceSheet(context, useRootNavigator: true);
    if (source == null) return;

    XFile? picked;
    try {
      // Gallery uses Android Photo Picker / iOS PHPicker (no broad media permission).
      // Camera still requires the platform CAMERA / NSCamera permission.
      picked = await _picker.pickImage(source: source, imageQuality: 92);
    } on PlatformException {
      if (!mounted) return;
      final needsCamera = source == ImageSource.camera;
      setState(() {
        _error = needsCamera
            ? 'Unable to open camera. Please allow camera permission.'
            : 'Unable to open photo picker. Please try again.';
      });
      return;
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Unable to pick image. Please try again.');
      return;
    }
    if (picked == null) return;

    final bytes = await File(picked.path).length();
    if (bytes > _maxAttachmentBytes) {
      setState(() => _error = 'Image must be under 5 MB');
      return;
    }

    setState(() {
      _uploadingAttachment = true;
      _error = null;
      _attachmentLocalPath = picked!.path;
      _attachmentUrl = null;
      _attachmentName = null;
    });

    try {
      final url = await ref.read(apiServiceProvider).uploadSupportAttachment(picked.path);
      if (!mounted) return;
      setState(() {
        _attachmentUrl = url;
        _attachmentName = picked!.name;
        _uploadingAttachment = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _uploadingAttachment = false;
        _error = e is ApiException
            ? e.message
            : 'Failed to upload attachment. Please try again.';
        _attachmentUrl = null;
        _attachmentLocalPath = null;
        _attachmentName = null;
      });
    }
  }

  Future<void> _submit() async {
    if (_issueType == null || _issueType!.isEmpty) {
      setState(() => _error = 'Please select an issue type');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });

    try {
      final message = await ref.read(apiServiceProvider).submitSupportTicket({
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'phone': _phoneController.text.trim(),
        'orderId': _orderIdController.text.trim(),
        'issueType': _issueType,
        'roleKey': 'customer',
        'message': _messageController.text.trim(),
        'attachment': _attachmentUrl ?? '',
        'attachmentName': _attachmentName ?? '',
      });

      if (!mounted) return;
      setState(() {
        _submitting = false;
        _success = message;
        _messageController.clear();
        _orderIdController.clear();
        _issueType = null;
        _attachmentUrl = null;
        _attachmentLocalPath = null;
        _attachmentName = null;
      });
      _prefillUser();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Failed to submit support request';
      });
    }
  }

  Future<void> _launch(String url) async {
    final uri = Uri.parse(url);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  static const _primary = kWebPrimary;

  TextStyle _t(double size, {FontWeight weight = FontWeight.w400, Color color = Colors.black, double? height}) =>
      GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

  InputDecoration _input(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: _t(14, color: const Color(0x99666666)),
        filled: true,
        fillColor: Colors.white,
        isDense: true,
        counterText: '',
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: kWebBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: kWebBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: _primary),
        ),
      );

  Widget _label(String text, {bool required = true, bool optional = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text.rich(
          TextSpan(
            text: text,
            style: _t(14, weight: FontWeight.w600),
            children: [
              if (required) TextSpan(text: ' *', style: _t(14, weight: FontWeight.w600, color: _primary)),
              if (optional)
                TextSpan(text: ' (Optional)', style: _t(14, color: kWebTextSecondary)),
            ],
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return StorefrontPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    GestureDetector(
                      onTap: () => context.go(RoutePaths.home),
                      child: Text('Home', style: _t(12, color: kWebTextSecondary)),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text('›', style: _t(12, color: kWebTextSecondary)),
                    ),
                    Text('Support', style: _t(12)),
                  ],
                ),
                const SizedBox(height: 16),
                Text('How can we help you?', style: _t(18, weight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  "Our support team is here to help you. We'll get back to you as soon as possible.",
                  style: _t(12, color: kWebTextSecondary, height: 1.625),
                ),
                const SizedBox(height: 24),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _contactCard(
                        icon: Icons.phone_outlined,
                        iconBg: const Color(0xFFFFEDD5),
                        iconColor: _primary,
                        title: 'Phone',
                        lines: [Text(_phone, textAlign: TextAlign.center, style: _t(12, weight: FontWeight.w600, color: _primary))],
                        href: _phoneTel,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _contactCard(
                        icon: Icons.chat_rounded,
                        iconBg: const Color(0xFFDCFCE7),
                        iconColor: const Color(0xFF16A34A),
                        title: 'WhatsApp',
                        lines: [
                          Text(
                            _whatsapp,
                            textAlign: TextAlign.center,
                            style: _t(12, weight: FontWeight.w600, color: const Color(0xFF16A34A)),
                          ),
                        ],
                        href: _whatsappHref,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _contactCard(
                        icon: Icons.mail_outline_rounded,
                        iconBg: const Color(0xFFFFEDD5),
                        iconColor: _primary,
                        title: 'Email',
                        lines: [
                          Text(_email, textAlign: TextAlign.center, style: _t(12, weight: FontWeight.w600, color: _primary)),
                        ],
                        href: 'mailto:$_email',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _contactCard(
                        icon: Icons.schedule_rounded,
                        iconBg: const Color(0xFFDBEAFE),
                        iconColor: const Color(0xFF2563EB),
                        title: _isVendorSpecific && _vendorName.isNotEmpty ? _vendorName : 'Office Hours',
                        lines: [
                          Text('Mon – Sat', textAlign: TextAlign.center, style: _t(11, color: kWebTextSecondary, height: 1.375)),
                          Text(_hours, textAlign: TextAlign.center, style: _t(11, color: kWebTextSecondary, height: 1.375)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _form(),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(8, 20, 8, 20),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: kWebBorder)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                _TrustBadge(icon: Icons.verified_user_outlined, title: '100% Original Products', desc: 'Genuine & trusted'),
                _TrustBadge(icon: Icons.lock_outline, title: 'Secure Payments', desc: '100% safe & secure'),
                _TrustBadge(icon: Icons.undo_rounded, title: 'Easy Returns', desc: 'Hassle-free returns'),
                _TrustBadge(icon: Icons.local_shipping_outlined, title: 'Fast Delivery', desc: 'Pan India delivery'),
                _TrustBadge(icon: Icons.forum_outlined, title: 'Dedicated Support', desc: "We're here to help"),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _form() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kWebBorder),
        boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 2, offset: Offset(0, 1))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[_banner(_error!, error: true), const SizedBox(height: 16)],
          _label('Name'),
          TextField(controller: _nameController, style: _t(14), decoration: _input('Enter your name')),
          const SizedBox(height: 16),
          _label('Email'),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: _t(14),
            decoration: _input('Enter your email'),
          ),
          const SizedBox(height: 16),
          _label('Phone'),
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            style: _t(14),
            decoration: _input('Enter your phone number'),
          ),
          const SizedBox(height: 16),
          _label('Order ID', required: false, optional: true),
          TextField(controller: _orderIdController, style: _t(14), decoration: _input('Enter your order ID')),
          const SizedBox(height: 16),
          _label('Issue Type'),
          DropdownButtonFormField<String>(
            initialValue: _issueType,
            isExpanded: true,
            style: _t(14),
            decoration: _input('Select issue type'),
            items: [
              for (final option in supportIssueOptions)
                DropdownMenuItem(value: option.value, child: Text(option.label)),
            ],
            onChanged: (value) => setState(() {
              _issueType = value;
              _error = null;
            }),
          ),
          const SizedBox(height: 16),
          _label('Message'),
          Stack(
            children: [
              TextField(
                controller: _messageController,
                maxLines: 5,
                maxLength: _maxMessageLength,
                style: _t(14),
                onChanged: (_) => setState(() {}),
                decoration: _input('Describe your issue in detail...').copyWith(
                  contentPadding: const EdgeInsets.fromLTRB(16, 13, 16, 32),
                ),
              ),
              Positioned(
                right: 12,
                bottom: 12,
                child: Text(
                  '${_messageController.text.length}/$_maxMessageLength',
                  style: _t(12, color: kWebTextMuted),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _label('Upload Attachment', required: false, optional: true),
          _attachmentBox(),
          if (_success != null) ...[const SizedBox(height: 16), _banner(_success!)],
          const SizedBox(height: 16),
          SizedBox(
            height: 48,
            child: FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: _primary,
                disabledBackgroundColor: _primary.withValues(alpha: 0.6),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              icon: const Icon(Icons.send_rounded, size: 16, color: Colors.white),
              label: Text(
                _submitting ? 'Submitting...' : 'Submit Ticket',
                style: _t(14, weight: FontWeight.w700, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _attachmentBox() {
    final hasAttachment = _attachmentLocalPath != null || _attachmentUrl != null;
    return GestureDetector(
      onTap: hasAttachment || _submitting || _uploadingAttachment ? null : _pickAttachment,
      child: CustomPaint(
        painter: _DashedBorderPainter(),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0x4DF8F8F8),
            borderRadius: BorderRadius.circular(12),
          ),
          child: !hasAttachment
              ? Column(
                  children: [
                    const Icon(Icons.file_upload_outlined, size: 40, color: kWebTextMuted),
                    const SizedBox(height: 8),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: _uploadingAttachment ? 'Uploading...' : 'Click to upload',
                            style: _t(14, weight: FontWeight.w600, color: _primary),
                          ),
                          TextSpan(text: ' or drag and drop', style: _t(14, color: kWebTextSecondary)),
                        ],
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text('PNG, JPG up to 2MB', style: _t(12, color: kWebTextMuted)),
                  ],
                )
              : Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: SizedBox(
                        width: 64,
                        height: 64,
                        child: _attachmentLocalPath != null
                            ? Image.file(File(_attachmentLocalPath!), fit: BoxFit.cover)
                            : CachedNetworkImage(imageUrl: _attachmentUrl!, fit: BoxFit.cover),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _uploadingAttachment ? 'Uploading attachment...' : (_attachmentName ?? 'Attachment'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _t(14, weight: FontWeight.w500),
                          ),
                          const SizedBox(height: 4),
                          GestureDetector(
                            onTap: _submitting || _uploadingAttachment
                                ? null
                                : () => setState(() {
                                      _attachmentUrl = null;
                                      _attachmentLocalPath = null;
                                      _attachmentName = null;
                                    }),
                            child: Text(
                              'Remove',
                              style: _t(12, weight: FontWeight.w600, color: const Color(0xFFDC2626)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _banner(String text, {bool error = false}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: error ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: error ? const Color(0xFFFECACA) : const Color(0xFFBBF7D0)),
      ),
      child: Text(
        text,
        style: _t(14, color: error ? const Color(0xFFB91C1C) : const Color(0xFF15803D)),
      ),
    );
  }

  Widget _contactCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required List<Widget> lines,
    String? href,
  }) {
    return GestureDetector(
      onTap: href == null ? null : () => _launch(href),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: kWebBorder),
          boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 2, offset: Offset(0, 1))],
        ),
        child: Column(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, size: 20, color: iconColor),
            ),
            const SizedBox(height: 8),
            Text(title, textAlign: TextAlign.center, style: _t(12, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            ...lines,
          ],
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = kWebBorder
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(12)));
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + 6), paint);
        distance += 10;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _TrustBadge extends StatelessWidget {
  const _TrustBadge({required this.icon, required this.title, required this.desc});

  final IconData icon;
  final String title;
  final String desc;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Column(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: kWebPrimary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 18, color: kWebPrimary),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(fontSize: 9, fontWeight: FontWeight.w700, height: 1.25),
            ),
            const SizedBox(height: 2),
            Text(
              desc,
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(fontSize: 8, color: kWebTextSecondary, height: 1.25),
            ),
          ],
        ),
      ),
    );
  }
}

