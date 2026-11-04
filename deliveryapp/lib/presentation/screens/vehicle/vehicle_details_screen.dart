import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/chips/status_chip.dart';
import '../../widgets/layout/custom_app_bar.dart';

class VehicleDetailsScreen extends StatefulWidget {
  const VehicleDetailsScreen({super.key});

  @override
  State<VehicleDetailsScreen> createState() => _VehicleDetailsScreenState();
}

class _VehicleDetailsScreenState extends State<VehicleDetailsScreen> {
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      await AuthService.instance.fetchMe();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

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

  String _formatVehicleType(String type) {
    final t = type.toLowerCase().trim();
    if (t == 'motorcycle') return 'Motorcycle / Bike';
    if (t == 'electric') return 'Electric Vehicle (EV)';
    if (t == 'bicycle') return 'Bicycle / Cycle';
    if (t == 'van') return 'Delivery Van / Auto';
    if (t == 'no_vehicle') return 'Walker / On Foot';
    if (type.isNotEmpty) {
      return type[0].toUpperCase() + type.substring(1);
    }
    return 'Not Specified';
  }

  String _getVehicleEmoji(String type) {
    final t = type.toLowerCase();
    if (t.contains('cycle') || t.contains('bicycle')) return '🚲';
    if (t.contains('van') || t.contains('car') || t.contains('auto')) return '🚐';
    if (t.contains('electric') || t.contains('ev')) return '⚡🛵';
    return '🛵';
  }

  ({String label, StatusType type}) _docStatus(Map<String, dynamic> map, ImageProvider? image) {
    if (image == null) {
      return (label: 'Not Uploaded', type: StatusType.pending);
    }
    final status = map['status']?.toString().toLowerCase() ?? '';
    if (status == 'approved' || status == 'verified') {
      return (label: 'Verified', type: StatusType.success);
    }
    if (status == 'rejected') {
      return (label: 'Rejected', type: StatusType.error);
    }
    return (label: 'Under Review', type: StatusType.warning);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final boy = AuthService.instance.deliveryBoy;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final rawType = boy?.vehicleType ?? '';
    final vehicleType = _formatVehicleType(rawType);
    final vehicleNumber = boy?.vehicleNumber.trim() ?? '';
    final emoji = _getVehicleEmoji(rawType);

    final docs = boy?.documents ?? {};
    final rcMap = docs['rc'] is Map ? Map<String, dynamic>.from(docs['rc'] as Map) : <String, dynamic>{};
    final insuranceMap = docs['insurance'] is Map ? Map<String, dynamic>.from(docs['insurance'] as Map) : <String, dynamic>{};
    final licenseMap = docs['license'] is Map ? Map<String, dynamic>.from(docs['license'] as Map) : <String, dynamic>{};

    final rcImage = _imageFor(rcMap);
    final insuranceImage = _imageFor(insuranceMap);
    final licenseImage = _imageFor(licenseMap);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(
        title: l10n.vehicleDetails,
        subtitle: 'Vehicle information & registered documents',
        showBackButton: true,
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            color: AppColors.primary,
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
            // 1. Vehicle Hero Card with Number Plate
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: isDark
                      ? const [Color(0xFF064E3B), Color(0xFF0F291E)]
                      : const [Color(0xFF0F5A32), Color(0xFF084826)],
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Emoji / Vehicle Icon Badge
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.16),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.3),
                        width: 2,
                      ),
                    ),
                    child: Center(
                      child: Text(emoji, style: const TextStyle(fontSize: 36)),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Vehicle Type
                  Text(
                    vehicleType,
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Vehicle Number Plate (Indian HSRP Style)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E3A8A),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'IND',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          vehicleNumber.isNotEmpty ? vehicleNumber.toUpperCase() : 'NO PLATE NUMBER',
                          style: GoogleFonts.inter(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.5,
                            color: vehicleNumber.isNotEmpty ? const Color(0xFF0F172A) : Colors.black38,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Assigned Delivery Partner Vehicle',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // 2. Vehicle Specifications Summary Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.cardBackground,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.cardBorder),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.shadow,
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(Icons.two_wheeler_rounded, size: 16, color: AppColors.primary),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Vehicle Specifications',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _specRow('Vehicle Type', vehicleType),
                  _specRow('Registration Number', vehicleNumber.isNotEmpty ? vehicleNumber.toUpperCase() : 'Not Assigned'),
                  _specRow(
                    'Propulsion / Category',
                    rawType.toLowerCase().contains('electric')
                        ? 'Electric (EV)'
                        : rawType.toLowerCase().contains('bicycle')
                            ? 'Manual Pedal'
                            : 'Motorized / Petrol',
                  ),
                  _specRow(
                    'Registration Status',
                    rcImage != null ? 'Documents Submitted' : 'Pending Documents',
                    isHighlight: true,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // 3. Vehicle-Related Documents Section
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.folder_shared_rounded, size: 16, color: AppColors.primary),
                ),
                const SizedBox(width: 8),
                Text(
                  'Vehicle Documents',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Government & vehicle verification documents submitted for this vehicle.',
              style: GoogleFonts.inter(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),

            // Document 1: Vehicle RC
            _buildDocCard(
              title: 'Vehicle RC (Registration Certificate)',
              subtitle: 'Official certificate of vehicle registration',
              icon: Icons.description_outlined,
              image: rcImage,
              status: _docStatus(rcMap, rcImage),
              docNumber: rcMap['number']?.toString() ?? vehicleNumber,
            ),
            const SizedBox(height: 12),

            // Document 2: Vehicle Insurance
            _buildDocCard(
              title: 'Vehicle Insurance',
              subtitle: 'Valid motor insurance policy certificate',
              icon: Icons.security_outlined,
              image: insuranceImage,
              status: _docStatus(insuranceMap, insuranceImage),
              docNumber: insuranceMap['number']?.toString(),
            ),
            const SizedBox(height: 12),

            // Document 3: Driving Licence
            _buildDocCard(
              title: 'Driving Licence (DL)',
              subtitle: 'Authorized motor vehicle driving permit',
              icon: Icons.badge_outlined,
              image: licenseImage,
              status: _docStatus(licenseMap, licenseImage),
              docNumber: licenseMap['number']?.toString(),
            ),

            const SizedBox(height: 18),

            // 4. Delivery Manager Notice
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.cardSubBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.cardSubBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.info_outline_rounded,
                    size: 18,
                    color: Color(0xFF64748B),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Vehicle details and verification documents are managed by your Dark Store Delivery Manager. Contact your manager to update or change vehicles.',
                      style: GoogleFonts.inter(
                        fontSize: 11.5,
                        color: AppColors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      if (_loading)
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: LinearProgressIndicator(minHeight: 2),
        ),
    ],
  ),
);
  }

  Widget _specRow(String label, String value, {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12.5,
              color: AppColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: isHighlight ? AppColors.primary : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required ImageProvider? image,
    required ({String label, StatusType type}) status,
    String? docNumber,
  }) {
    final hasImage = image != null;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: hasImage ? () => _preview(title, image) : null,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: hasImage ? AppColors.primarySoft : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        icon,
                        size: 20,
                        color: hasImage ? AppColors.primary : const Color(0xFF64748B),
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
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            subtitle,
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          if (docNumber != null && docNumber.trim().isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text(
                              'Number: ${docNumber.trim().toUpperCase()}',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    StatusChip(
                      label: status.label,
                      type: status.type,
                    ),
                  ],
                ),

                // Document Thumbnail Preview (if uploaded)
                if (hasImage) ...[
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      height: 120,
                      width: double.infinity,
                      color: Colors.black.withValues(alpha: 0.04),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image(
                            image: image,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => const Center(
                              child: Icon(Icons.broken_image_outlined, color: Colors.grey),
                            ),
                          ),
                          Positioned(
                            right: 8,
                            bottom: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.65),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.fullscreen_rounded, size: 14, color: Colors.white),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Tap to preview',
                                    style: GoogleFonts.inter(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
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
        ),
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
        title: Text(
          title,
          style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
        ),
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
