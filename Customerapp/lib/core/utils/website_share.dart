import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../config/constants.dart';
import '../../config/env.dart';
import 'network_image_bytes.dart';

class WebsiteShareContent {
  const WebsiteShareContent({
    required this.title,
    required this.text,
    required this.shareUrl,
  });

  final String title;
  final String text;
  final String shareUrl;
}

WebsiteShareContent buildWebsiteShareContent({String? shareUrl}) {
  final url = (shareUrl ?? Env.storeUrl).trim();
  final normalized = url.endsWith('/') ? url : '$url/';
  final text = [
    'GreenGrocc',
    'Fresh groceries delivered fast',
    '',
    normalized,
  ].join('\n');

  return WebsiteShareContent(
    title: 'GreenGrocc',
    text: text,
    shareUrl: normalized,
  );
}

Future<File?> _websiteShareImageFile() async {
  final bytes = await downloadNetworkImageBytes(AppConstants.websiteShareImageUrl);
  if (bytes == null || bytes.isEmpty) return null;

  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/greengrocc-share.jpg');
  await file.writeAsBytes(bytes, flush: true);
  return file;
}

/// Shares the storefront URL (+ logo image when available), matching website
/// `shareWebsite()` behavior.
Future<void> shareWebsite() async {
  final content = buildWebsiteShareContent();
  final imageFile = await _websiteShareImageFile();

  if (imageFile != null) {
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(imageFile.path)],
        text: content.text,
        title: content.title,
      ),
    );
    return;
  }

  await SharePlus.instance.share(
    ShareParams(
      text: content.text,
      title: content.title,
      subject: content.title,
    ),
  );
}
