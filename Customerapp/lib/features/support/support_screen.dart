import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/theme.dart';
import '../../core/exceptions/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../features/auth/auth_controller.dart';
import '../../widgets/common/image_source_sheet.dart';
import 'support_constants.dart';
import '../../routes/route_paths.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go(RoutePaths.home),
        ),
        title: const Text('Support'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const Text(
            'How can we help you?',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          const Text(
            'Our support team is here to help. Send us a message and we will get back to you soon.',
            style: TextStyle(color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _contactCard(Icons.phone, 'Phone', supportContactPhone, supportContactPhoneHref)),
              const SizedBox(width: 10),
              Expanded(child: _contactCard(Icons.chat, 'WhatsApp', supportContactPhone, supportWhatsAppHref)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _contactCard(
                  Icons.email_outlined,
                  'Email',
                  _email,
                  'mailto:$_email',
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: _HoursCard(),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text('FAQs', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...supportFaqs.asMap().entries.map((entry) {
            final index = entry.key;
            final faq = entry.value;
            final isOpen = _openFaq == index;
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.borderLight),
                borderRadius: BorderRadius.circular(8),
                color: Colors.white,
              ),
              child: Column(
                children: [
                  ListTile(
                    dense: true,
                    title: Text(faq['question']!, style: const TextStyle(fontSize: 14)),
                    trailing: Icon(isOpen ? Icons.remove : Icons.add, size: 18),
                    onTap: () => setState(() => _openFaq = isOpen ? null : index),
                  ),
                  if (isOpen)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          faq['answer']!,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
                        ),
                      ),
                    ),
                ],
              ),
            );
          }),
          TextButton(
            onPressed: () => context.push(RoutePaths.shippingDetails),
            child: const Text('View shipping & delivery FAQs →'),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Send us a message', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                if (_error != null)
                  _banner(_error!, Colors.red),
                if (_success != null)
                  _banner(_success!, Colors.green),
                TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Name *')),
                const SizedBox(height: 10),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email *'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Phone *'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _orderIdController,
                  decoration: const InputDecoration(labelText: 'Order ID (optional)'),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _issueType,
                  decoration: const InputDecoration(labelText: 'Issue Type *'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Select issue type')),
                    ...supportIssueOptions.map(
                      (option) => DropdownMenuItem(
                        value: option.value,
                        child: Text(option.label),
                      ),
                    ),
                  ],
                  onChanged: (value) => setState(() => _issueType = value),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _messageController,
                  maxLines: 5,
                  maxLength: _maxMessageLength,
                  decoration: const InputDecoration(
                    labelText: 'Message *',
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 10),
                const Text('Upload Attachment (optional)', style: TextStyle(fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                if (_attachmentLocalPath != null || _attachmentUrl != null)
                  Column(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: _attachmentLocalPath != null
                            ? Image.file(
                                File(_attachmentLocalPath!),
                                height: 120,
                                width: double.infinity,
                                fit: BoxFit.contain,
                              )
                            : CachedNetworkImage(
                                imageUrl: _attachmentUrl!,
                                height: 120,
                                width: double.infinity,
                                fit: BoxFit.contain,
                                memCacheWidth: 480,
                                memCacheHeight: 240,
                                filterQuality: FilterQuality.medium,
                              ),
                      ),
                      if (_uploadingAttachment)
                        const Padding(
                          padding: EdgeInsets.only(top: 6),
                          child: Text(
                            'Uploading attachment...',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      TextButton(
                        onPressed: _submitting || _uploadingAttachment
                            ? null
                            : () => setState(() {
                                  _attachmentUrl = null;
                                  _attachmentLocalPath = null;
                                  _attachmentName = null;
                                }),
                        child: const Text('Remove', style: TextStyle(color: Colors.red)),
                      ),
                    ],
                  )
                else
                  OutlinedButton.icon(
                    onPressed: _submitting || _uploadingAttachment ? null : _pickAttachment,
                    icon: const Icon(Icons.upload_file),
                    label: Text(_uploadingAttachment ? 'Uploading...' : 'Choose image'),
                  ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: Text(_submitting ? 'Submitting...' : 'Submit Ticket'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Wrap(
            alignment: WrapAlignment.spaceAround,
            spacing: 8,
            runSpacing: 12,
            children: const [
              _TrustBadge(icon: Icons.verified_user_outlined, title: '100% Original', desc: 'Genuine & trusted'),
              _TrustBadge(icon: Icons.lock_outline, title: 'Secure Payments', desc: '100% safe'),
              _TrustBadge(icon: Icons.replay_outlined, title: 'Easy Returns', desc: 'Hassle-free'),
              _TrustBadge(icon: Icons.local_shipping_outlined, title: 'Fast Delivery', desc: 'Pan India'),
              _TrustBadge(icon: Icons.support_agent_outlined, title: 'Dedicated Support', desc: "We're here"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _banner(String text, MaterialColor color) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.shade200),
      ),
      child: Text(text, style: TextStyle(color: color.shade800, fontSize: 13)),
    );
  }

  Widget _contactCard(IconData icon, String title, String value, String href) {
    return InkWell(
      onTap: () => _launch(href),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: AppColors.primary, size: 20),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 11, color: AppColors.primary)),
          ],
        ),
      ),
    );
  }
}

class _HoursCard extends StatelessWidget {
  const _HoursCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.schedule, color: Colors.blue, size: 20),
          SizedBox(height: 8),
          Text('Office Hours', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          SizedBox(height: 4),
          Text('Mon – Sat', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          Text('10 AM – 7 PM', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _TrustBadge extends StatelessWidget {
  const _TrustBadge({
    required this.icon,
    required this.title,
    required this.desc,
  });

  final IconData icon;
  final String title;
  final String desc;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 90,
      child: Column(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
            child: Icon(icon, color: AppColors.primary, size: 20),
          ),
          const SizedBox(height: 6),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
          Text(desc, textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}
