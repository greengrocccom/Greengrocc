import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/camera_image_utils.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../domain/models/liveness_challenge.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/buttons/primary_button.dart';

class LivenessCheckScreen extends StatefulWidget {
  const LivenessCheckScreen({super.key, this.selfiePath});

  final String? selfiePath;

  @override
  State<LivenessCheckScreen> createState() => _LivenessCheckScreenState();
}

class _LivenessCheckScreenState extends State<LivenessCheckScreen> {
  static const _challenges = LivenessChallenge.values;
  static const _holdDuration = Duration(milliseconds: 450);

  CameraController? _camera;
  FaceDetector? _faceDetector;
  bool _isProcessing = false;
  bool _cameraReady = false;
  String? _cameraError;

  int _currentStep = 0;
  bool _allComplete = false;
  bool _blinkPrimed = false;
  DateTime? _holdStartedAt;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
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
            ? ImageFormatGroup.nv21
            : ImageFormatGroup.bgra8888,
      );

      _faceDetector = FaceDetector(
        options: FaceDetectorOptions(
          enableClassification: true,
          enableTracking: true,
          performanceMode: FaceDetectorMode.fast,
          minFaceSize: 0.15,
        ),
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

      await controller.startImageStream(_onCameraFrame);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _cameraError = AppLocalizations.of(context).cameraAccessError;
      });
    }
  }

  Future<void> _onCameraFrame(CameraImage image) async {
    if (_isProcessing || _allComplete || _camera == null || _faceDetector == null) {
      return;
    }

    _isProcessing = true;
    try {
      final input = cameraImageToInputImage(image, _camera!.description);
      if (input == null) return;

      final faces = await _faceDetector!.processImage(input);
      if (!mounted || faces.isEmpty) {
        _holdStartedAt = null;
        return;
      }

      final face = faces.first;
      final challenge = _challenges[_currentStep];
      final passed = _evaluateChallenge(challenge, face);

      if (passed) {
        if (challenge == LivenessChallenge.blink) {
          _advanceStep();
        } else {
          _holdStartedAt ??= DateTime.now();
          if (DateTime.now().difference(_holdStartedAt!) >= _holdDuration) {
            _advanceStep();
          }
        }
      } else {
        _holdStartedAt = null;
        if (challenge == LivenessChallenge.blink && _eyesOpen(face)) {
          _blinkPrimed = true;
        }
      }
    } catch (_) {
      // Skip frame on transient ML Kit errors.
    } finally {
      _isProcessing = false;
    }
  }

  bool _eyesOpen(Face face) {
    final left = face.leftEyeOpenProbability;
    final right = face.rightEyeOpenProbability;
    if (left == null || right == null) return false;
    return left > 0.55 && right > 0.55;
  }

  bool _eyesClosed(Face face) {
    final left = face.leftEyeOpenProbability;
    final right = face.rightEyeOpenProbability;
    if (left == null || right == null) return false;
    return left < 0.35 && right < 0.35;
  }

  bool _evaluateChallenge(LivenessChallenge challenge, Face face) {
    final yaw = face.headEulerAngleY ?? 0;
    final pitch = face.headEulerAngleX ?? 0;

    return switch (challenge) {
      LivenessChallenge.centerFace =>
        yaw.abs() < 14 && pitch.abs() < 14,
      LivenessChallenge.blink =>
        _blinkPrimed && _eyesClosed(face),
      LivenessChallenge.lookLeft => yaw > 18,
      LivenessChallenge.lookRight => yaw < -18,
      LivenessChallenge.lookUp => pitch > 14,
    };
  }

  void _advanceStep() {
    _holdStartedAt = null;
    _blinkPrimed = false;

    if (_currentStep >= _challenges.length - 1) {
      setState(() => _allComplete = true);
      _stopCamera();
      return;
    }

    setState(() => _currentStep++);
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
    _faceDetector?.close();
    unawaited(_stopCamera());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final size = MediaQuery.sizeOf(context);
    final challenge = _allComplete
        ? null
        : _challenges[_currentStep.clamp(0, _challenges.length - 1)];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const AppBackButton(fallbackRoute: AppRoutes.takeSelfie),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 20),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  _allComplete ? l10n.verificationComplete : l10n.faceVerification,
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
                  _allComplete
                      ? l10n.livenessSuccessMessage
                      : l10n.livenessFollowPrompts,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              _StepIndicator(
                total: _challenges.length,
                current: _allComplete ? _challenges.length : _currentStep,
                complete: _allComplete,
              ),
              const Spacer(),
              _CameraPreview(
                size: size.width * 0.72,
                camera: _camera,
                ready: _cameraReady,
                error: _cameraError,
                complete: _allComplete,
                challenge: challenge,
              ),
              const SizedBox(height: 20),
              if (_cameraError != null)
                Text(
                  _cameraError!,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppColors.error,
                  ),
                )
              else if (_allComplete)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.check_circle_rounded, color: AppColors.success),
                    const SizedBox(width: 8),
                    Text(
                      l10n.allChecksPassed,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.success,
                      ),
                    ),
                  ],
                )
              else if (challenge != null)
                _ChallengeHint(challenge: challenge),
              const Spacer(),
              if (_allComplete)
                PrimaryButton(
                  label: l10n.continueToApp,
                  onPressed: () => completeOnboarding(context),
                )
              else if (_cameraError != null)
                PrimaryButton(
                  label: l10n.tryAgain,
                  icon: Icons.refresh_rounded,
                  onPressed: () {
                    setState(() {
                      _cameraError = null;
                      _currentStep = 0;
                      _allComplete = false;
                      _blinkPrimed = false;
                    });
                    _initCamera();
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({
    required this.total,
    required this.current,
    required this.complete,
  });

  final int total;
  final int current;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(total, (index) {
        final done = complete || index < current;
        final active = !complete && index == current;
        return Expanded(
          child: Container(
            height: 4,
            margin: EdgeInsets.only(right: index < total - 1 ? 6 : 0),
            decoration: BoxDecoration(
              color: done
                  ? AppColors.primary
                  : active
                      ? AppColors.primarySoft
                      : AppColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        );
      }),
    );
  }
}

class _CameraPreview extends StatelessWidget {
  const _CameraPreview({
    required this.size,
    required this.camera,
    required this.ready,
    required this.error,
    required this.complete,
    required this.challenge,
  });

  final double size;
  final CameraController? camera;
  final bool ready;
  final String? error;
  final bool complete;
  final LivenessChallenge? challenge;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.primaryLight,
        border: Border.all(
          color: complete ? AppColors.success : AppColors.primary,
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
      child: complete
          ? ColoredBox(
              color: AppColors.primaryLight,
              child: Icon(
                Icons.verified_rounded,
                size: 72,
                color: AppColors.success,
              ),
            )
          : error != null
              ? Icon(Icons.videocam_off_rounded, size: 56, color: AppColors.error)
              : !ready || camera == null
                  ? const Center(child: CircularProgressIndicator())
                  : ClipOval(
                      child: FittedBox(
                        fit: BoxFit.cover,
                        child: SizedBox(
                          width: camera!.value.previewSize?.height ?? size,
                          height: camera!.value.previewSize?.width ?? size,
                          child: CameraPreview(camera!),
                        ),
                      ),
                    ),
    );
  }
}

class _ChallengeHint extends StatelessWidget {
  const _ChallengeHint({required this.challenge});

  final LivenessChallenge challenge;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.primaryLight,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(challenge.hintIcon, color: AppColors.primary, size: 22),
              const SizedBox(width: 10),
              Text(
                challenge.instruction(l10n),
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          l10n.keepFaceInCircle,
          style: GoogleFonts.inter(
            fontSize: 13,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}
