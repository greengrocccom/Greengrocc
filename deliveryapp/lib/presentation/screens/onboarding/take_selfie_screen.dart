import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/image_upload_utils.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/buttons/primary_button.dart';
import '../../widgets/buttons/secondary_button.dart';

class TakeSelfieScreen extends StatefulWidget {
  const TakeSelfieScreen({super.key});

  @override
  State<TakeSelfieScreen> createState() => _TakeSelfieScreenState();
}

class _TakeSelfieScreenState extends State<TakeSelfieScreen> {
  CameraController? _camera;
  bool _cameraReady = false;
  String? _cameraError;
  String? _capturedPath;
  bool _submitting = false;
  bool _capturing = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    setState(() {
      _cameraError = null;
      _cameraReady = false;
      _capturedPath = null;
    });

    var status = await Permission.camera.status;
    if (!status.isGranted) {
      status = await Permission.camera.request();
    }
    if (!status.isGranted) {
      if (!mounted) return;
      setState(() {
        _cameraError = AppLocalizations.of(context).cameraAccessError;
      });
      return;
    }

    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        front,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid
            ? ImageFormatGroup.jpeg
            : ImageFormatGroup.bgra8888,
      );

      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }

      setState(() {
        _camera = controller;
        _cameraReady = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _cameraError = AppLocalizations.of(context).cameraAccessError;
      });
    }
  }

  Future<void> _capture() async {
    final camera = _camera;
    if (camera == null || !camera.value.isInitialized || _capturing) return;

    setState(() => _capturing = true);
    try {
      final file = await camera.takePicture();
      await _stopCamera();
      if (!mounted) return;
      setState(() {
        _capturedPath = file.path;
        _cameraReady = false;
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).cameraAccessError),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  Future<void> _retake() async {
    await _stopCamera();
    if (!mounted) return;
    setState(() => _capturedPath = null);
    await _initCamera();
  }

  Future<void> _stopCamera() async {
    final camera = _camera;
    if (camera == null) return;
    if (camera.value.isStreamingImages) {
      await camera.stopImageStream();
    }
    await camera.dispose();
    _camera = null;
  }

  @override
  void dispose() {
    unawaited(_stopCamera());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final size = MediaQuery.sizeOf(context);
    final circleSize = size.width * 0.72;
    final hasPhoto = _capturedPath != null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const AppBackButton(fallbackRoute: AppRoutes.uploadDocuments),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 20),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  l10n.takeRecentPhoto,
                  style: GoogleFonts.inter(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  l10n.selfieCaptureSubtitle,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              const Spacer(),
              _CircularFaceFrame(
                size: circleSize,
                camera: _camera,
                ready: _cameraReady,
                error: _cameraError,
                capturedPath: _capturedPath,
                capturing: _capturing,
              ),
              const SizedBox(height: 20),
              Text(
                hasPhoto
                    ? l10n.selfieNextStepHint
                    : l10n.keepFaceInCircle,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
              const Spacer(),
              if (_cameraError != null)
                PrimaryButton(
                  label: l10n.tryAgain,
                  icon: Icons.refresh_rounded,
                  onPressed: _initCamera,
                )
              else if (!hasPhoto)
                PrimaryButton(
                  label: _capturing ? '...' : l10n.takePhoto,
                  icon: Icons.camera_alt_rounded,
                  onPressed: (!_cameraReady || _capturing) ? null : _capture,
                )
              else ...[
                PrimaryButton(
                  label: _submitting
                      ? 'Uploading…'
                      : l10n.continueToVerification,
                  icon: Icons.verified_user_rounded,
                  onPressed: _submitting
                      ? null
                      : () async {
                          final path = _capturedPath;
                          if (path == null) return;
                          setState(() => _submitting = true);
                          try {
                            final selfie = await documentPayload(XFile(path));
                            if (!mounted) return;
                            await AuthService.instance.updateOnboarding(
                              step: 'selfie',
                              data: {'selfie': selfie},
                            );
                            if (!mounted) return;
                            await completeOnboarding(context);
                          } catch (e) {
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(e is AuthApiException
                                    ? e.message
                                    : e.toString()),
                                backgroundColor: AppColors.error,
                              ),
                            );
                          } finally {
                            if (mounted) setState(() => _submitting = false);
                          }
                        },
                ),
                const SizedBox(height: 12),
                SecondaryButton(
                  label: l10n.retakePhoto,
                  icon: Icons.refresh_rounded,
                  onPressed: _submitting ? null : _retake,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CircularFaceFrame extends StatelessWidget {
  const _CircularFaceFrame({
    required this.size,
    required this.camera,
    required this.ready,
    required this.error,
    required this.capturedPath,
    required this.capturing,
  });

  final double size;
  final CameraController? camera;
  final bool ready;
  final String? error;
  final String? capturedPath;
  final bool capturing;

  @override
  Widget build(BuildContext context) {
    final hasPhoto = capturedPath != null;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.primaryLight,
        border: Border.all(
          color: hasPhoto ? AppColors.primary : AppColors.primary,
          width: 3,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: hasPhoto
          ? Image.file(File(capturedPath!), fit: BoxFit.cover)
          : error != null
              ? Icon(Icons.videocam_off_rounded, size: 56, color: AppColors.error)
              : !ready || camera == null
                  ? const Center(child: CircularProgressIndicator())
                  : Stack(
                      fit: StackFit.expand,
                      children: [
                        ClipOval(
                          child: FittedBox(
                            fit: BoxFit.cover,
                            child: SizedBox(
                              width: camera!.value.previewSize?.height ?? size,
                              height: camera!.value.previewSize?.width ?? size,
                              child: CameraPreview(camera!),
                            ),
                          ),
                        ),
                        if (capturing)
                          ColoredBox(
                            color: Colors.black.withValues(alpha: 0.25),
                            child: const Center(
                              child: CircularProgressIndicator(
                                color: Colors.white,
                              ),
                            ),
                          ),
                      ],
                    ),
    );
  }
}
