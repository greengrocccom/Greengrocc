import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/contact.dart';
import '../../core/exceptions/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../widgets/layout/storefront_header.dart';
import '../../widgets/layout/storefront_page.dart';
import 'info_page_screen.dart';
import 'static_content.dart';

void _launch(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

BoxDecoration _card({double radius = 16}) => BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: kWebBorder),
      boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 2, offset: Offset(0, 1))],
    );

InputDecoration _webInput(String hint) => InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.plusJakartaSans(fontSize: 16, color: const Color(0x99666666)),
      filled: true,
      fillColor: Colors.white,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
        borderSide: const BorderSide(color: kWebPrimary),
      ),
    );

/// Website `pages/About.jsx` layout.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final intro = aboutPage.sections.first.body;
    final mission = aboutPage.sections[1];
    final serve = aboutPage.sections[2];
    final offer = aboutPage.sections[3];

    Widget card(InfoSection section) => Container(
          width: double.infinity,
          padding: const EdgeInsets.all(32),
          decoration: _card(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(section.title, style: webH2()),
              const SizedBox(height: 12),
              if (section.body.isNotEmpty) Text(section.body, style: webBody()),
              if (section.bullets != null)
                for (final b in section.bullets!)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text('· $b', style: webBody()),
                  ),
            ],
          ),
        );

    return StorefrontPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(aboutPage.title, style: webPageTitle()),
                const SizedBox(height: 16),
                Text(intro, style: webBody(size: 18)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 40),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kWebBorder))),
            child: Column(
              children: [card(mission), const SizedBox(height: 40), card(serve)],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 24, 12, 64),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(offer.title, style: webH2(size: 24)),
                const SizedBox(height: 24),
                for (final item in offer.bullets!) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFAFAFA),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: kWebBorder),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('✓', style: webBody(color: kWebPrimary)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(item, style: webBody())),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Website `pages/Contact.jsx` layout.
class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key});

  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  final _name = TextEditingController();
  final _note = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _message = TextEditingController();

  @override
  void dispose() {
    for (final c in [_name, _note, _phone, _email, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (_name.text.trim().isEmpty || _phone.text.trim().isEmpty || _message.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in your name, phone and message.')),
      );
      return;
    }
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: const Text('Thank you! Our support team will get in touch with you shortly.'),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))],
      ),
    );
    for (final c in [_name, _note, _phone, _email, _message]) {
      c.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget info(String label, Widget value) => Padding(
          padding: const EdgeInsets.only(bottom: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              value,
            ],
          ),
        );

    Widget link(String text, String href) => GestureDetector(
          onTap: () => _launch(href),
          child: Text(text, style: webBody(color: kWebPrimary)),
        );

    return StorefrontPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(12, 24, 12, 40),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFE5E7EB)))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Contact Us', style: webPageTitle()),
                const SizedBox(height: 16),
                Text(
                  'Have questions or need help with your order? We respond to every message within one business day.',
                  style: webBody(),
                ),
                const SizedBox(height: 32),
                info('Phone / WhatsApp', link(ContactConfig.contactPhoneDisplay, ContactConfig.contactPhoneTel)),
                info('Email', link(ContactConfig.contactEmail, 'mailto:${ContactConfig.contactEmail}')),
                info('Office Hours', Text('Mon – Sat · 10:00 AM – 7:00 PM IST', style: webBody())),
                info('Address', Text(ContactConfig.contactAddress, style: webBody())),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: _card(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Send us a message', style: webH2()),
                      const SizedBox(height: 24),
                      TextField(controller: _name, decoration: _webInput('Your name *')),
                      const SizedBox(height: 16),
                      TextField(controller: _note, decoration: _webInput('Order ID (optional)')),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        decoration: _webInput('Phone / WhatsApp *'),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        decoration: _webInput('Email'),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _message,
                        maxLines: 4,
                        decoration: _webInput('How can we help you? *'),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 48,
                        child: FilledButton(
                          onPressed: _submit,
                          style: FilledButton.styleFrom(
                            backgroundColor: kWebPrimary,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: Text(
                            'Send Message',
                            style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 32, 12, 64),
            child: Text.rich(
              TextSpan(
                style: webBody(),
                children: [
                  const TextSpan(text: 'Prefer WhatsApp? Message us at '),
                  WidgetSpan(
                    alignment: PlaceholderAlignment.baseline,
                    baseline: TextBaseline.alphabetic,
                    child: link(ContactConfig.contactPhoneDisplay, ContactConfig.contactWhatsAppUrl),
                  ),
                  const TextSpan(text: ' for the fastest help.'),
                ],
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

/// Website `pages/Blog.jsx` layout (dark page).
class BlogScreen extends StatelessWidget {
  const BlogScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return StorefrontPage(
      child: ColoredBox(
        color: Colors.black,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(12, 24, 12, 40),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: Color(0xFF262626))),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Blog', style: webPageTitle(color: Colors.white)),
                  const SizedBox(height: 16),
                  Text(
                    'Tips, trends, and fresh recipes for home cooking and daily grocery essentials across India.',
                    style: webBody(size: 18, color: const Color(0xFFA3A3A3)),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 40, 12, 40),
              child: Column(
                children: [
                  for (final post in blogPosts) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: const Color(0xFF171717),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF262626)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            post.date,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: kWebPrimary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            post.title,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(post.excerpt, style: webBody(color: const Color(0xFFA3A3A3))),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Website `pages/RolePolicies.jsx`.
class PoliciesScreen extends ConsumerStatefulWidget {
  const PoliciesScreen({super.key});

  @override
  ConsumerState<PoliciesScreen> createState() => _PoliciesScreenState();
}

class _PoliciesScreenState extends ConsumerState<PoliciesScreen> {
  String _openId = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(livePoliciesProvider);
    const slate = Color(0xFF64748B);

    return StorefrontPage(
      padding: const EdgeInsets.fromLTRB(16, 32, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Policies',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Policies for GreenGrocc users. Managed from Admin → Policy Management → Users.',
            style: GoogleFonts.plusJakartaSans(fontSize: 14, color: slate),
          ),
          if (async.hasError) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF1F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFECDD3)),
              ),
              child: Text(
                apiErrorMessage(async.error!, fallback: 'Failed to load policies'),
                style: GoogleFonts.plusJakartaSans(fontSize: 14, color: const Color(0xFFBE123C)),
              ),
            ),
          ],
          const SizedBox(height: 24),
          if (async.isLoading)
            Text('Loading policies…', style: GoogleFonts.plusJakartaSans(fontSize: 14, color: slate))
          else if ((async.value ?? const []).isEmpty)
            Container(
              padding: const EdgeInsets.all(40),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Text(
                'No customer policies published yet.',
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, color: slate),
              ),
            )
          else
            for (final row in async.value!) ...[
              _policyTile(row),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }

  Widget _policyTile(Map<String, dynamic> row) {
    final id = (row['id'] ?? row['_id'] ?? '').toString();
    final open = _openId == id;
    final updated = DateTime.tryParse(row['updatedAt']?.toString() ?? '');
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 2, offset: Offset(0, 1))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _openId = open ? '' : id),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          row['title']?.toString() ?? '',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Updated ${updated == null ? '—' : DateFormat('d/M/y').format(updated.toLocal())}',
                          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: const Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    open ? '▲' : '▼',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (open)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
              ),
              child: (row['body']?.toString().trim().isNotEmpty ?? false)
                  ? PolicyBodyView(text: row['body'].toString(), fontSize: 14, color: const Color(0xFF334155))
                  : Text('—', style: GoogleFonts.plusJakartaSans(fontSize: 14, color: const Color(0xFF334155))),
            ),
        ],
      ),
    );
  }
}

final openVacanciesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.read(apiServiceProvider).fetchOpenVacancies();
});

String _prettyRole(String value) => value
    .replaceAll('_', ' ')
    .split(' ')
    .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
    .join(' ');

String _formatDate(String? value) {
  final date = DateTime.tryParse(value ?? '');
  return date == null ? '' : DateFormat('d MMM y').format(date.toLocal());
}

/// Website `pages/Careers.jsx`: open roles list, role detail and application form.
class CareersScreen extends ConsumerStatefulWidget {
  const CareersScreen({super.key});

  @override
  ConsumerState<CareersScreen> createState() => _CareersScreenState();
}

class _CareersScreenState extends ConsumerState<CareersScreen> {
  static const _fields = [
    'name',
    'email',
    'phone',
    'city',
    'experience',
    'address',
    'education',
    'currentCompany',
    'expectedCtc',
    'noticePeriod',
    'linkedin',
    'coverLetter',
    'resumeUrl',
  ];

  final _controllers = {for (final f in _fields) f: TextEditingController()};
  Map<String, dynamic>? _selected;
  String _error = '';
  String _success = '';
  bool _submitting = false;
  String _resumeName = '';
  String _resumeData = '';

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _openJob(Map<String, dynamic>? job) {
    setState(() {
      _selected = job;
      _error = '';
      _success = '';
      _resumeName = '';
      _resumeData = '';
      for (final c in _controllers.values) {
        c.clear();
      }
    });
  }

  Future<void> _pickResume() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    if (bytes.length > 1500000) {
      setState(() => _error = 'Resume file must be under 1.5 MB');
      return;
    }
    final mime = file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    setState(() {
      _resumeName = file.name;
      _resumeData = 'data:$mime;base64,${base64Encode(bytes)}';
      _error = '';
    });
  }

  Future<void> _submit() async {
    final job = _selected;
    if (job == null) return;
    String v(String key) => _controllers[key]!.text.trim();
    if (v('name').isEmpty) {
      setState(() => _error = 'Please enter your full name.');
      return;
    }
    if (v('email').isEmpty && v('phone').isEmpty) {
      setState(() => _error = 'Provide at least one of email or phone.');
      return;
    }
    if (_resumeData.isEmpty && v('resumeUrl').isEmpty) {
      setState(() => _error = 'Upload a resume or provide a resume URL.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = '';
      _success = '';
    });
    try {
      await ref.read(apiServiceProvider).applyForVacancy({
        for (final f in _fields) f: v(f),
        'resumeName': _resumeName,
        'resumeData': _resumeData,
        'vacancyId': job['_id'],
        'roleKey': job['roleKey'],
      });
      if (!mounted) return;
      setState(() {
        _success = 'Application submitted. Our HR team will review it shortly.';
        _resumeName = '';
        _resumeData = '';
        for (final c in _controllers.values) {
          c.clear();
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, fallback: 'Could not submit application'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(openVacanciesProvider);
    final selected = _selected;

    return StorefrontPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (selected != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: GestureDetector(
                      onTap: () => _openJob(null),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.arrow_back, size: 16, color: kWebPrimary),
                          const SizedBox(width: 6),
                          Text(
                            'All open roles',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: kWebPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                Text(
                  selected?['title']?.toString() ?? 'Careers at GreenGrocc',
                  style: webPageTitle(),
                ),
                const SizedBox(height: 16),
                Text(
                  selected != null
                      ? 'Review the role details and submit your application with your resume.'
                      : 'Browse open roles posted by our HR team and apply with your profile and resume.',
                  style: webBody(size: 18),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 64),
            child: async.isLoading
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 80),
                    child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                : selected == null
                    ? _list(async)
                    : _detail(selected),
          ),
        ],
      ),
    );
  }

  Widget _list(AsyncValue<List<Map<String, dynamic>>> async) {
    final jobs = async.value ?? const [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (async.hasError)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _banner(apiErrorMessage(async.error!, fallback: 'Could not load open roles'), error: true),
          ),
        if (jobs.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 64),
            decoration: _card(),
            child: Column(
              children: [
                Icon(Icons.work_outline_rounded, size: 40, color: kWebPrimary.withValues(alpha: 0.4)),
                const SizedBox(height: 16),
                Text(
                  'No open roles right now',
                  style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  'Check back soon — new vacancies appear here when HR posts them.',
                  textAlign: TextAlign.center,
                  style: webBody(size: 14),
                ),
              ],
            ),
          )
        else
          for (final job in jobs) ...[
            Container(
              padding: const EdgeInsets.all(20),
              decoration: _card(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(job['title']?.toString() ?? '', style: webH2(size: 18)),
                            const SizedBox(height: 4),
                            Text(
                              job['roleLabel']?.toString() ?? _prettyRole(job['roleKey']?.toString() ?? ''),
                              style: webBody(size: 14),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'Open',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: kWebPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _meta(job),
                  const SizedBox(height: 12),
                  Text(
                    (job['description']?.toString().trim().isNotEmpty ?? false)
                        ? job['description'].toString()
                        : 'No description provided.',
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: webBody(size: 14),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => _openJob(job),
                    style: FilledButton.styleFrom(
                      backgroundColor: kWebPrimary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('View & apply'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
      ],
    );
  }

  Widget _meta(Map<String, dynamic> job) {
    final openings = int.tryParse('${job['openings'] ?? 0}') ?? 0;
    final style = GoogleFonts.plusJakartaSans(fontSize: 12, color: kWebTextMuted);
    return Wrap(
      spacing: 12,
      runSpacing: 6,
      children: [
        if ((job['location']?.toString() ?? '').isNotEmpty)
          Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.location_on_outlined, size: 14, color: kWebTextMuted),
            const SizedBox(width: 4),
            Text(job['location'].toString(), style: style),
          ]),
        Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.people_outline, size: 14, color: kWebTextMuted),
          const SizedBox(width: 4),
          Text('$openings opening${openings == 1 ? '' : 's'}', style: style),
        ]),
        if (_formatDate(job['createdAt']?.toString()).isNotEmpty)
          Text('Posted ${_formatDate(job['createdAt']?.toString())}', style: style),
      ],
    );
  }

  Widget _banner(String text, {bool error = false}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: error ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: error ? const Color(0xFFFECACA) : const Color(0xFFA7F3D0)),
        ),
        child: Text(
          text,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            color: error ? const Color(0xFFB91C1C) : const Color(0xFF065F46),
          ),
        ),
      );

  Widget _field(String label, String key, {String? hint, int maxLines = 1}) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            TextField(
              controller: _controllers[key],
              maxLines: maxLines,
              style: GoogleFonts.plusJakartaSans(fontSize: 14),
              decoration: _webInput(hint ?? '').copyWith(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: kWebBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: kWebBorder),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
          ],
        ),
      );

  Widget _detail(Map<String, dynamic> job) {
    final openings = int.tryParse('${job['openings'] ?? 0}') ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: _card(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(job['title']?.toString() ?? '', style: webH2()),
              const SizedBox(height: 4),
              Text(
                job['roleLabel']?.toString() ?? _prettyRole(job['roleKey']?.toString() ?? ''),
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w500, color: kWebPrimary),
              ),
              const SizedBox(height: 16),
              if ((job['location']?.toString() ?? '').isNotEmpty)
                Text('📍 ${job['location']}', style: webBody(size: 14)),
              Text('$openings opening${openings == 1 ? '' : 's'}', style: webBody(size: 14)),
              if (_formatDate(job['createdAt']?.toString()).isNotEmpty)
                Text('Posted ${_formatDate(job['createdAt']?.toString())}', style: webBody(size: 14)),
              const Divider(height: 32, color: kWebBorder),
              Text(
                'ROLE DETAILS',
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: 0.4),
              ),
              const SizedBox(height: 8),
              Text(
                (job['description']?.toString().trim().isNotEmpty ?? false)
                    ? job['description'].toString()
                    : 'No description provided for this role.',
                style: webBody(size: 14),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: _card(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Apply for this role', style: webH2(size: 18)),
              const SizedBox(height: 4),
              Text(
                'Fill in your details and upload your resume. Fields marked * are required.',
                style: webBody(size: 14),
              ),
              const SizedBox(height: 16),
              if (_error.isNotEmpty) ...[_banner(_error, error: true), const SizedBox(height: 16)],
              if (_success.isNotEmpty) ...[_banner(_success), const SizedBox(height: 16)],
              _field('Full name *', 'name'),
              _field('Email', 'email'),
              _field('Phone', 'phone'),
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  'Provide at least one of email or phone.',
                  style: GoogleFonts.plusJakartaSans(fontSize: 12, color: kWebTextMuted),
                ),
              ),
              _field('City', 'city'),
              _field('Experience', 'experience', hint: 'e.g. 2 years'),
              _field('Address', 'address'),
              _field('Education', 'education'),
              _field('Current company', 'currentCompany'),
              _field('Expected CTC', 'expectedCtc'),
              _field('Notice period', 'noticePeriod'),
              _field('LinkedIn / portfolio URL', 'linkedin'),
              _field("Cover letter / why you're a fit", 'coverLetter', maxLines: 4),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0x66DCFCE7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: kWebPrimary.withValues(alpha: 0.4)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Resume *', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(
                      'Upload JPG/PNG (max 1.5 MB), or paste a public resume URL.',
                      style: GoogleFonts.plusJakartaSans(fontSize: 12, color: kWebTextMuted),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _pickResume,
                      icon: const Icon(Icons.upload_rounded, size: 16, color: kWebPrimary),
                      label: Text(_resumeName.isEmpty ? 'Choose file' : _resumeName),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black,
                        side: const BorderSide(color: kWebBorder),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _field('Or resume URL', 'resumeUrl', hint: 'https://...'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 48,
                child: FilledButton(
                  onPressed: _submitting ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: kWebPrimary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    _submitting ? 'Submitting…' : 'Submit application',
                    style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
