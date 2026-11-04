import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/cards/dashboard_card.dart';
import '../../widgets/common/app_panel.dart';
import '../../widgets/layout/custom_app_bar.dart';
import '../../widgets/tiles/profile_tile.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _busy = false;

  DeliveryBoy? get _boy => AuthService.instance.deliveryBoy;

  ImageProvider? get _avatarImage {
    final raw = _boy?.profileImageBytesOrUrl;
    if (raw is String && raw.isNotEmpty) return NetworkImage(raw);
    if (raw is Uint8List && raw.isNotEmpty) return MemoryImage(raw);
    return null;
  }

  Future<void> _editName() async {
    final controller = TextEditingController(text: _boy?.name ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppLocalizations.of(context).editName),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(labelText: AppLocalizations.of(context).fullName),
          textCapitalization: TextCapitalization.words,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(AppLocalizations.of(context).cancel)),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(AppLocalizations.of(context).saveAction)),
        ],
      ),
    );
    if (ok != true) return;
    final name = controller.text.trim();
    if (name.isEmpty) return;
    setState(() => _busy = true);
    try {
      await AuthService.instance.updateOnboarding(data: {'name': name});
      await AuthService.instance.fetchMe();
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changeAvatar() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
      imageQuality: 85,
    );
    if (file == null) return;
    setState(() => _busy = true);
    try {
      final bytes = await File(file.path).readAsBytes();
      final b64 = base64Encode(bytes);
      final mime = file.path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      await AuthService.instance.updateOnboarding(
        data: {
          'selfie': {
            'imageBase64': 'data:$mime;base64,$b64',
            'status': 'uploaded',
          },
        },
      );
      await AuthService.instance.fetchMe();
      if (mounted) {
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context).profilePhotoSaved)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final boy = _boy;
    final avatar = _avatarImage;

    final hasRating = (boy?.totalRatingsCount ?? 0) > 0;
    final empLower = (boy?.employmentType ?? '').toLowerCase().trim();
    final isFullTime = empLower == 'full_time' || (boy?.isFullTime ?? false);
    final employmentTag = isFullTime ? 'Full Time' : 'Part Time';

    final body = ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        if (widget.embedded) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Text(
              l10n.profile,
              style: GoogleFonts.inter(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],

        // --- Green Profile Box (WhatsApp Style) ---
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
          decoration: brandHeroDecoration(),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // 1. Big Profile Picture in Middle with Tag & Camera Button
              Center(
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    // Big Circular Profile Image
                    GestureDetector(
                      onTap: _busy ? null : _changeAvatar,
                      child: Container(
                        padding: const EdgeInsets.all(3.5),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.25),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.55),
                            width: 2,
                          ),
                        ),
                        child: CircleAvatar(
                          radius: 52,
                          backgroundColor: AppColors.primaryLight,
                          backgroundImage: avatar,
                          child: avatar == null
                              ? Icon(Icons.person, size: 52, color: AppColors.primary)
                              : null,
                        ),
                      ),
                    ),

                    // Top-Right Tag: Full Time or Part Time
                    Positioned(
                      top: 0,
                      right: -10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: isFullTime ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.25),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isFullTime ? Icons.verified_rounded : Icons.schedule_rounded,
                              size: 11,
                              color: Colors.white,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              employmentTag,
                              style: GoogleFonts.inter(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Bottom-Right Camera Icon Button (WhatsApp style photo update)
                    Positioned(
                      right: 0,
                      bottom: 2,
                      child: GestureDetector(
                        onTap: _busy ? null : _changeAvatar,
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.primary, width: 2),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.2),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.camera_alt_rounded,
                            size: 15,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // 2. Rider Name with Edit Button
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Text(
                      boy?.name.isNotEmpty == true ? boy!.name : l10n.deliveryPartner,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: -0.3,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: _busy ? null : _editName,
                    child: Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.edit_outlined,
                        color: Colors.white,
                        size: 15,
                      ),
                    ),
                  ),
                ],
              ),

              // 3. Phone Number
              if (boy?.phone.isNotEmpty == true) ...[
                const SizedBox(height: 4),
                Text(
                  boy!.phone,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 16.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: 0.4,
                  ),
                ),
              ],

              const SizedBox(height: 10),

              // 4. Vehicle Type Pill
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, AppRoutes.vehicle),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.two_wheeler_rounded,
                        size: 14,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        boy?.vehicleType.isNotEmpty == true ? boy!.vehicleType : l10n.vehicle,
                        style: GoogleFonts.inter(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      if (hasRating) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 3,
                          height: 3,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.6),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(Icons.star_rounded, size: 14, color: Color(0xFFFBBF24)),
                        const SizedBox(width: 3),
                        Text(
                          boy!.rating.toStringAsFixed(1),
                          style: GoogleFonts.inter(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 8),
              Text(
                l10n.tapPhotoToUpdate,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: Colors.white.withValues(alpha: 0.72),
                ),
              ),
            ],
          ),
        ),

        // --- After Green Box: Exactly whatever was already there (no extra) ---
        const SizedBox(height: AppSpacing.xl),
        SectionLabel(l10n.accountDetails),
        DashboardCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              ProfileTile(
                title: l10n.vehicleInformation,
                subtitle: [
                  if (boy?.vehicleType.isNotEmpty == true) boy!.vehicleType,
                  if (boy?.vehicleNumber.isNotEmpty == true) boy!.vehicleNumber,
                ].isNotEmpty
                    ? [
                        if (boy?.vehicleType.isNotEmpty == true) boy!.vehicleType,
                        if (boy?.vehicleNumber.isNotEmpty == true) boy!.vehicleNumber,
                      ].join(' · ')
                    : l10n.bikeDetails,
                leadingIcon: Icons.two_wheeler_outlined,
                onTap: () => Navigator.pushNamed(context, AppRoutes.vehicle),
              ),
              ProfileTile(
                title: l10n.documents,
                subtitle: l10n.verificationDocuments,
                leadingIcon: Icons.folder_outlined,
                onTap: () => Navigator.pushNamed(context, AppRoutes.documents),
              ),
              ProfileTile(
                title: l10n.bankDetails,
                subtitle: l10n.bankViewOnlyManaged,
                leadingIcon: Icons.account_balance_outlined,
                onTap: () => Navigator.pushNamed(context, AppRoutes.bankDetails),
                showDivider: false,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          l10n.detailsUpdatedByManager,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
        ),
      ],
    );

    if (widget.embedded) return body;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(title: l10n.profile, showBackButton: true),
      body: Stack(
        children: [
          body,
          if (_busy)
            const Positioned.fill(
              child: ColoredBox(
                color: Color(0x33000000),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
        ],
      ),
    );
  }
}
