import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/image_upload_utils.dart';
import '../../../data/services/order_service.dart';
import '../../../l10n/app_localizations.dart';

/// Capture delivery proof photo at customer location before OTP.
class DeliveryProofCaptureScreen extends StatefulWidget {
  const DeliveryProofCaptureScreen({
    super.key,
    required this.orderId,
    required this.orderNumber,
  });

  final String orderId;
  final String orderNumber;

  @override
  State<DeliveryProofCaptureScreen> createState() =>
      _DeliveryProofCaptureScreenState();
}

class _DeliveryProofCaptureScreenState extends State<DeliveryProofCaptureScreen> {
  final _picker = ImagePicker();
  XFile? _photo;
  bool _submitting = false;

  Future<void> _capturePhoto() async {
    final file = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 75,
      maxWidth: 1600,
    );
    if (file != null && mounted) {
      setState(() => _photo = file);
    }
  }

  Future<void> _submit() async {
    if (_photo == null || _submitting) return;
    setState(() => _submitting = true);

    final dataUrl = await imageFileToBase64DataUrl(_photo!);
    final result = await OrderService.instance.uploadDeliveryProof(
      widget.orderId,
      dataUrl,
    );

    if (!mounted) return;
    setState(() => _submitting = false);

    if (result.success) {
      Navigator.pop(context, true);
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result.error ?? AppLocalizations.of(context).delCouldNotUploadDeliveryPhoto),
        backgroundColor: Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFFF3F6F4),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF3F6F4),
        elevation: 0,
        foregroundColor: AppColors.textPrimary,
        title: Column(
          children: [
            Text(
              l10n.delDeliveryProof,
              style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            Text(
              l10n.orderNumberHash(widget.orderNumber),
              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.photo_camera_outlined, color: Color(0xFF059669), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      l10n.delDeliveryProofHint,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF065F46),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: GestureDetector(
                onTap: _capturePhoto,
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: _photo == null
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                color: AppColors.primaryLight.withValues(alpha: 0.5),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.camera_alt_rounded, color: AppColors.primary, size: 34),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              l10n.delTapToCaptureDeliveryPhoto,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        )
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(17),
                          child: Image.file(
                            File(_photo!.path),
                            fit: BoxFit.cover,
                            width: double.infinity,
                            height: double.infinity,
                          ),
                        ),
                ),
              ),
            ),
            if (_photo != null) ...[
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: _submitting ? null : _capturePhoto,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: Text(l10n.retakePhoto),
              ),
            ],
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton(
                onPressed: _photo == null || _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(
                        l10n.delUploadAndContinueToOtp,
                        style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
