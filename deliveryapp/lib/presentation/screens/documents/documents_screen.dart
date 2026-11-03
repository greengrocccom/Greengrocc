import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/cards/dashboard_card.dart';
import '../../widgets/chips/status_chip.dart';
import '../../widgets/layout/custom_app_bar.dart';

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  @override
  void initState() {
    super.initState();
    AuthService.instance.fetchMe().then((_) {
      if (mounted) setState(() {});
    });
  }

  static const _keys = [
    ('license', 'Driving Licence', Icons.credit_card_outlined),
    ('aadhaar', 'Aadhaar', Icons.fingerprint_outlined),
    ('pan', 'PAN', Icons.description_outlined),
    ('rc', 'Vehicle RC', Icons.two_wheeler_outlined),
    ('insurance', 'Insurance', Icons.security_outlined),
    ('passport', 'Passport', Icons.badge_outlined),
    ('policeVerification', 'Police Verification', Icons.local_police_outlined),
  ];

  ImageProvider? _imageFor(Map<String, dynamic> map) {
    final url = map['url']?.toString() ?? '';
    if (url.isNotEmpty) return NetworkImage(url);
    final b64 = map['imageBase64']?.toString() ?? '';
    if (b64.isEmpty) return null;
    try {
      final raw = b64.contains(',') ? b64.split(',').last : b64;
      return MemoryImage(base64Decode(raw));
    } catch (_) {
      return null;
    }
  }

  void _preview(String title, ImageProvider image) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _DocPreviewPage(title: title, image: image),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final docs = AuthService.instance.deliveryBoy?.documents ?? {};
    final uploaded = <({String key, String title, IconData icon, Map<String, dynamic> map, ImageProvider? image})>[];
    final missing = <({String key, String title, IconData icon})>[];

    for (final entry in _keys) {
      final raw = docs[entry.$1];
      final map = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
      final image = _imageFor(map);
      final hasFile = image != null;
      if (hasFile) {
        uploaded.add((
          key: entry.$1,
          title: entry.$2,
          icon: entry.$3,
          map: map,
          image: image,
        ));
      } else {
        missing.add((key: entry.$1, title: entry.$2, icon: entry.$3));
      }
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(
        title: l10n.documents,
        subtitle: 'Tap a photo to view full size',
        showBackButton: true,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
        children: [
          DashboardCard(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                const Text('📑', style: TextStyle(fontSize: 18)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Documents are view-only. Contact your Delivery Manager to update them.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (uploaded.isNotEmpty) ...[
            Text(
              'Uploaded documents',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: uploaded.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.05,
              ),
              itemBuilder: (context, index) {
                final item = uploaded[index];
                final status = item.map['status']?.toString() ?? 'uploaded';
                return InkWell(
                  onTap: item.image == null
                      ? null
                      : () => _preview(item.title, item.image!),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.cardBackground,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.cardBorder),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.shadow,
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: item.image != null
                              ? Image(
                                  image: item.image!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) => Container(
                                    color: AppColors.primaryLight,
                                    child: Icon(item.icon, color: AppColors.primary),
                                  ),
                                )
                              : Container(
                                  color: AppColors.primaryLight,
                                  child: Icon(item.icon, color: AppColors.primary),
                                ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.title,
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 3),
                              StatusChip(
                                label: status.replaceAll('_', ' '),
                                type: status == 'approved'
                                    ? StatusType.success
                                    : status == 'rejected'
                                        ? StatusType.error
                                        : StatusType.warning,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
          if (missing.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'Not uploaded',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            ...missing.map((item) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: DashboardCard(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(item.icon, color: AppColors.primary, size: 18),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          item.title,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      const StatusChip(
                        label: 'not uploaded',
                        type: StatusType.warning,
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _DocPreviewPage extends StatelessWidget {
  const _DocPreviewPage({required this.title, required this.image});

  final String title;
  final ImageProvider image;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(title),
      ),
      body: Center(
        child: InteractiveViewer(
          minScale: 0.8,
          maxScale: 4,
          child: Image(
            image: image,
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) => const Icon(
              Icons.broken_image_outlined,
              color: Colors.white54,
              size: 64,
            ),
          ),
        ),
      ),
    );
  }
}
