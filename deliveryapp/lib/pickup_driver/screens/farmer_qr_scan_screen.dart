import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../l10n/app_localizations.dart';
import '../widgets/pickup_ui.dart';

/// Scans the Farmer QR and pops with the raw value (verification happens
/// on the pickup screen so errors show there).
class FarmerQrScanScreen extends StatefulWidget {
  const FarmerQrScanScreen({super.key, required this.orderLabel});

  final String orderLabel;

  @override
  State<FarmerQrScanScreen> createState() => _FarmerQrScanScreenState();
}

class _FarmerQrScanScreenState extends State<FarmerQrScanScreen> {
  MobileScannerController? _controller;
  bool _handled = false;
  bool _permissionDenied = false;
  bool _starting = true;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    setState(() {
      _starting = true;
      _permissionDenied = false;
    });
    var status = await Permission.camera.status;
    if (!status.isGranted) status = await Permission.camera.request();
    if (!status.isGranted) {
      if (mounted) {
        setState(() {
          _starting = false;
          _permissionDenied = true;
        });
      }
      return;
    }
    final controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
    );
    if (!mounted) {
      await controller.dispose();
      return;
    }
    setState(() {
      _controller = controller;
      _starting = false;
    });
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value == null || value.isEmpty) continue;
      _handled = true;
      await _controller?.stop();
      if (mounted) Navigator.pop(context, value);
      return;
    }
  }

  Widget _message(String title, String body, Widget action) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.no_photography_outlined,
                size: 44, color: Colors.white70),
            const SizedBox(height: 14),
            Text(title,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(body,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(color: Colors.white70, fontSize: 14)),
            const SizedBox(height: 20),
            action,
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scanSize =
        (MediaQuery.sizeOf(context).width * 0.72).clamp(220.0, 300.0);
    final l10n = AppLocalizations.of(context);
    final retry = FilledButton(
      onPressed: _initCamera,
      style: FilledButton.styleFrom(backgroundColor: PickupColors.brand),
      child: Text(l10n.pksTryAgain),
    );

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        centerTitle: true,
        title: Column(
          children: [
            Text(l10n.pksScanFarmerQr,
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700, fontSize: 16)),
            Text(l10n.pksOrderTitle(widget.orderLabel),
                style: GoogleFonts.inter(fontSize: 12, color: Colors.white70)),
          ],
        ),
        actions: [
          if (_controller != null)
            IconButton(
              icon: ValueListenableBuilder(
                valueListenable: _controller!,
                builder: (context, state, _) => Icon(
                  state.torchState == TorchState.on
                      ? Icons.flash_on_rounded
                      : Icons.flash_off_rounded,
                ),
              ),
              onPressed: () => _controller?.toggleTorch(),
            ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (_controller != null)
            MobileScanner(
              controller: _controller!,
              onDetect: _onDetect,
              errorBuilder: (context, error) => _message(
                l10n.pksCameraUnavailable,
                error.errorDetails?.message ?? l10n.pksCameraStartFailed,
                retry,
              ),
            )
          else if (_starting)
            const Center(
                child: CircularProgressIndicator(color: PickupColors.brand))
          else if (_permissionDenied)
            _message(
              l10n.pksCameraPermissionNeeded,
              l10n.pksAllowCameraToScan,
              Column(
                children: [
                  retry,
                  TextButton(
                    onPressed: openAppSettings,
                    child: Text(l10n.pksOpenAppSettings,
                        style: const TextStyle(color: Colors.white70)),
                  ),
                ],
              ),
            ),
          if (_controller != null)
            IgnorePointer(
              child: Center(
                child: Container(
                  width: scanSize,
                  height: scanSize,
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFF4ADE80), width: 3),
                    borderRadius: BorderRadius.circular(24),
                  ),
                ),
              ),
            ),
          Positioned(
            left: 20,
            right: 20,
            bottom: MediaQuery.paddingOf(context).bottom + 24,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  const Icon(Icons.qr_code_scanner,
                      color: PickupColors.brand),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      l10n.pksPointCameraHint,
                      style: pickupText(13, weight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
