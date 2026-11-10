import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/app_providers.dart';
import '../../widgets/layout/storefront_header.dart';
import '../../widgets/layout/storefront_page.dart';
import 'static_content.dart';

const kPageText = Color(0xFF666666);

/// Website `.page-title`.
TextStyle webPageTitle({Color color = Colors.black}) => GoogleFonts.plusJakartaSans(
      fontSize: 30,
      fontWeight: FontWeight.w700,
      height: 1.2,
      letterSpacing: -0.6,
      color: color,
    );

TextStyle webBody({double size = 16, Color color = kPageText}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, height: 1.625, color: color);

TextStyle webH2({double size = 20}) => GoogleFonts.plusJakartaSans(
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: Colors.black,
      height: 1.4,
    );

/// Live customer policies from Admin → Policy Management (refetched each time a page opens).
final livePoliciesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(apiServiceProvider).fetchLivePolicies();
});

/// Title fallbacks for policies saved before they were linked to a page.
final _policyTitlePatterns = <String, RegExp>{
  'privacy': RegExp(r'privacy\s*policy|^privacy\b', caseSensitive: false),
  'terms': RegExp('terms', caseSensitive: false),
  'refund': RegExp('refund|return', caseSensitive: false),
  'shipping': RegExp(r'shipping|delivery\s*policy', caseSensitive: false),
};

Map<String, dynamic>? findLivePolicy(List<Map<String, dynamic>> rows, String key) {
  for (final r in rows) {
    if (r['pageKey'] == key) return r;
  }
  final pattern = _policyTitlePatterns[key];
  if (pattern == null) return null;
  for (final r in rows) {
    final pageKey = r['pageKey']?.toString() ?? '';
    if (pageKey.isEmpty && pattern.hasMatch(r['title']?.toString() ?? '')) return r;
  }
  return null;
}

/// Website `legal-page` layout (Privacy, Terms, Return & Refund, Shipping).
class InfoPageScreen extends ConsumerWidget {
  const InfoPageScreen({super.key, required this.content, this.policyKey});

  final StaticPageContent content;

  /// `privacy` / `terms` / `refund` / `shipping`: prefer the admin-published policy text.
  final String? policyKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Map<String, dynamic>? policy;
    var loading = false;
    if (policyKey != null) {
      final async = ref.watch(livePoliciesProvider);
      loading = async.isLoading;
      policy = async.value == null ? null : findLivePolicy(async.value!, policyKey!);
    }

    final title = (policy?['title']?.toString().trim().isNotEmpty ?? false)
        ? policy!['title'].toString()
        : content.title;
    final updatedAt = DateTime.tryParse(policy?['updatedAt']?.toString() ?? '');
    final subtitle = updatedAt != null
        ? 'Last updated: ${DateFormat('d MMMM y').format(updatedAt.toLocal())}'
        : content.subtitle;
    final liveBody = policy?['body']?.toString().trim() ?? '';
    final body = liveBody.isNotEmpty ? liveBody : (content.body ?? '');

    return StorefrontPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: webPageTitle()),
                if (subtitle != null && !loading) ...[
                  const SizedBox(height: 16),
                  Text(subtitle, style: webBody()),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 64),
            child: loading
                ? Text('Loading ${content.title.toLowerCase()}…', style: webBody())
                : body.isNotEmpty
                    ? PolicyBodyView(text: body)
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final section in content.sections) ...[
                            LegalSection(section: section),
                            const SizedBox(height: 32),
                          ],
                        ],
                      ),
          ),
        ],
      ),
    );
  }
}

enum _PolicyBlockKind { heading, paragraph, list }

class _PolicyBlock {
  _PolicyBlock(this.kind, {this.text = '', this.ordered = false, this.start = 1});

  final _PolicyBlockKind kind;
  final String text;
  final bool ordered;
  final int start;
  final List<String> items = [];
}

final _headingLine = RegExp(r'^#{1,3}\s+(.+)$');
final _bulletLine = RegExp(r'^[-*•]\s+(.+)$');
final _numberedLine = RegExp(r'^(\d+)[.)]\s+(.+)$');
final _linkPattern = RegExp(r'([\w.+-]+@[\w-]+\.[\w.]+|https?://[^\s)]+|\+91[\s\d]{9,13}\d)');

/// Same rules as the website's `PolicyBody`: "## Heading", "- bullet", "1. step", other lines = paragraphs.
List<_PolicyBlock> _parsePolicyBody(String text) {
  final blocks = <_PolicyBlock>[];
  _PolicyBlock? list;
  for (final raw in text.split(RegExp(r'\r?\n'))) {
    final line = raw.trim();
    if (line.isEmpty) {
      list = null;
      continue;
    }
    final heading = _headingLine.firstMatch(line);
    if (heading != null) {
      list = null;
      blocks.add(_PolicyBlock(_PolicyBlockKind.heading, text: heading.group(1)!));
      continue;
    }
    final bullet = _bulletLine.firstMatch(line);
    final numbered = _numberedLine.firstMatch(line);
    if (bullet != null || numbered != null) {
      final ordered = numbered != null;
      if (list == null || list.ordered != ordered) {
        list = _PolicyBlock(
          _PolicyBlockKind.list,
          ordered: ordered,
          start: ordered ? int.parse(numbered.group(1)!) : 1,
        );
        blocks.add(list);
      }
      list.items.add(bullet != null ? bullet.group(1)! : numbered!.group(2)!);
      continue;
    }
    list = null;
    blocks.add(_PolicyBlock(_PolicyBlockKind.paragraph, text: line));
  }
  return blocks;
}

Widget _linkedText(String text, TextStyle style) {
  final spans = <InlineSpan>[];
  var last = 0;
  for (final match in _linkPattern.allMatches(text)) {
    if (match.start > last) spans.add(TextSpan(text: text.substring(last, match.start)));
    final value = match.group(0)!;
    final Uri uri;
    if (value.startsWith('http')) {
      uri = Uri.parse(value);
    } else if (value.contains('@')) {
      uri = Uri(scheme: 'mailto', path: value);
    } else {
      uri = Uri(scheme: 'tel', path: value.replaceAll(RegExp(r'\s+'), ''));
    }
    spans.add(
      WidgetSpan(
        alignment: PlaceholderAlignment.baseline,
        baseline: TextBaseline.alphabetic,
        child: GestureDetector(
          onTap: () => launchUrl(uri, mode: LaunchMode.externalApplication),
          child: Text(value, style: style.copyWith(color: kWebGreen, fontWeight: FontWeight.w600)),
        ),
      ),
    );
    last = match.end;
  }
  if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
  return Text.rich(TextSpan(style: style, children: spans));
}

/// Renders admin policy text with headings, bullets, numbered steps and tappable email / phone.
class PolicyBodyView extends StatelessWidget {
  const PolicyBodyView({super.key, required this.text, this.fontSize = 16, this.color = kPageText});

  final String text;
  final double fontSize;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final style = webBody(size: fontSize, color: color);
    final blocks = _parsePolicyBody(text);
    final children = <Widget>[];
    for (var i = 0; i < blocks.length; i++) {
      final block = blocks[i];
      switch (block.kind) {
        case _PolicyBlockKind.heading:
          children.add(Padding(
            padding: EdgeInsets.only(top: i == 0 ? 0 : 24, bottom: 4),
            child: Text(block.text, style: webH2(size: fontSize + 4)),
          ));
        case _PolicyBlockKind.paragraph:
          children.add(Padding(
            padding: const EdgeInsets.only(top: 8),
            child: _linkedText(block.text, style),
          ));
        case _PolicyBlockKind.list:
          for (var j = 0; j < block.items.length; j++) {
            children.add(Padding(
              padding: const EdgeInsets.only(top: 8, left: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: block.ordered ? 24 : 16,
                    child: Text(block.ordered ? '${block.start + j}.' : '•', style: style),
                  ),
                  Expanded(child: _linkedText(block.items[j], style)),
                ],
              ),
            ));
          }
      }
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: children);
  }
}

class LegalSection extends StatelessWidget {
  const LegalSection({super.key, required this.section});

  final InfoSection section;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (section.title.isNotEmpty) ...[
          Text(section.title, style: webH2()),
          const SizedBox(height: 12),
        ],
        if (section.body.isNotEmpty) Text(section.body, style: webBody()),
        if (section.bullets != null)
          for (final item in section.bullets!)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: webBody()),
                  Expanded(child: Text(item, style: webBody())),
                ],
              ),
            ),
      ],
    );
  }
}
