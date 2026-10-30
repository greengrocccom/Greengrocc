import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../data/services/order_service.dart';

class PickupQrScanScreen extends StatefulWidget {
  const PickupQrScanScreen({
    super.key,
    required this.orderId,
    required this.orderNumber,
    this.preOrderBatch = false,
  });

  final String orderId;
  final String orderNumber;

  /// Pre-order mode: scan the QR on each bag one after another; each scan unlocks that
  /// customer's address. Pops `true` if at least one order was unlocked.
  final bool preOrderBatch;

  @override
  State<PickupQrScanScreen> createState() => _PickupQrScanScreenState();
}

class _PickupQrScanScreenState extends State<PickupQrScanScreen> {
  MobileScannerController? _controller;
  bool _processing = false;
  bool _handled = false;
  bool _permissionDenied = false;
  bool _starting = true;
  String? _errorMessage;
  int _unlockedCount = 0;
  String? _lastResult;
  bool _lastResultOk = true;
  final Set<String> _unlockedPayloads = {};
  String? _lastFailedPayload;
  DateTime _lastFailedAt = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    setState(() {
      _starting = true;
      _permissionDenied = false;
      _errorMessage = null;
    });

    var status = await Permission.camera.status;
    if (!status.isGranted) {
      status = await Permission.camera.request();
    }

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
      detectionSpeed: widget.preOrderBatch ? DetectionSpeed.normal : DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      torchEnabled: false,
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

  Future<void> _onPreOrderDetect(String value) async {
    // The camera reports the same bag many times a second: skip bags already unlocked,
    // and give a failed code a short pause before retrying it.
    if (_unlockedPayloads.contains(value)) return;
    if (value == _lastFailedPayload &&
        DateTime.now().difference(_lastFailedAt) < const Duration(seconds: 3)) {
      return;
    }
    setState(() => _processing = true);
    final result = await OrderService.instance.scanPreOrderQr(value);
    if (!mounted) return;
    setState(() {
      _processing = false;
      _lastResultOk = result.success;
      _lastResult = result.message;
      if (result.success) {
        _unlockedPayloads.add(value);
        _unlockedCount++;
      } else {
        _lastFailedPayload = value;
        _lastFailedAt = DateTime.now();
      }
    });
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing || _handled || _controller == null) return;

    if (widget.preOrderBatch) {
      for (final barcode in capture.barcodes) {
        final value = barcode.rawValue?.trim();
        if (value == null || !value.startsWith('PICKUP:')) continue;
        await _onPreOrderDetect(value);
        return;
      }
      return;
    }

    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value == null || value.isEmpty || !value.startsWith('PICKUP:')) continue;

      setState(() {
        _processing = true;
        _handled = true;
      });

      await _controller?.stop();

      final success = await OrderService.instance.scanPickupQr(widget.orderId, value);
      if (!mounted) return;

      if (success) {
        Navigator.pop(context, true);
        return;
      }

      setState(() {
        _processing = false;
        _handled = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invalid pickup QR. Scan the code shown on the manager screen.'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }
  }

  Widget _messageCard({
    required IconData icon,
    required String title,
    required String message,
    Widget? action,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFF059669).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 36, color: const Color(0xFF10B981)),
            ),
            const SizedBox(height: 18),
            Text(
              title,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                color: Colors.white70,
                fontSize: 14,
                height: 1.45,
              ),
            ),
            if (action != null) ...[
              const SizedBox(height: 22),
              action,
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scanSize = (MediaQuery.sizeOf(context).width * 0.72).clamp(220.0, 300.0);
    final batch = widget.preOrderBatch;

    return PopScope(
      canPop: !batch,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _unlockedCount > 0);
      },
      child: Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        title: Column(
          children: [
            Text(
              batch ? 'Scan pre-order QRs' : 'Scan Pickup QR',
              style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            Text(
              batch ? '$_unlockedCount unlocked' : 'Order #${widget.orderNumber}',
              style: GoogleFonts.inter(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
        actions: [
          if (_controller != null)
            IconButton(
              icon: ValueListenableBuilder(
                valueListenable: _controller!,
                builder: (context, state, child) {
                  final torch = state.torchState;
                  return Icon(
                    torch == TorchState.on ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                    color: Colors.white,
                  );
                },
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
              errorBuilder: (context, error) {
                return _messageCard(
                  icon: Icons.videocam_off_outlined,
                  title: 'Camera unavailable',
                  message: error.errorDetails?.message ?? 'Unable to start the camera.',
                  action: FilledButton(
                    onPressed: _initCamera,
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669)),
                    child: const Text('Try again'),
                  ),
                );
              },
            )
          else if (_starting)
            const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)))
          else if (_permissionDenied)
            _messageCard(
              icon: Icons.no_photography_outlined,
              title: 'Camera permission needed',
              message: 'Allow camera access to scan the Pickup QR from the manager screen.',
              action: Column(
                children: [
                  FilledButton(
                    onPressed: _initCamera,
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669)),
                    child: const Text('Allow camera'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: openAppSettings,
                    child: const Text('Open app settings', style: TextStyle(color: Colors.white70)),
                  ),
                ],
              ),
            )
          else
            _messageCard(
              icon: Icons.error_outline,
              title: 'Scanner not ready',
              message: _errorMessage ?? 'Something went wrong while opening the camera.',
              action: FilledButton(
                onPressed: _initCamera,
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669)),
                child: const Text('Try again'),
              ),
            ),
          if (_controller != null)
            IgnorePointer(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(color: Colors.black.withValues(alpha: 0.35)),
                  Center(
                    child: Container(
                      width: scanSize,
                      height: scanSize,
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFF10B981), width: 2),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: CustomPaint(
                        painter: _ScannerFramePainter(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          Positioned(
            left: 20,
            right: 20,
            bottom: MediaQuery.paddingOf(context).bottom + 24,
            child: Container(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.qr_code_scanner, color: Color(0xFF059669)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _processing
                          ? 'Verifying pickup…'
                          : batch && _lastResult != null
                              ? _lastResult!
                              : batch
                                  ? 'Scan the QR on each bag, one by one. Each scan shows that customer\'s address.'
                                  : 'Align the QR inside the frame. The manager shows it under Show Pickup QR.',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: batch && _lastResult != null && !_processing
                            ? (_lastResultOk ? const Color(0xFF047857) : const Color(0xFFB91C1C))
                            : const Color(0xFF334155),
                        height: 1.35,
                      ),
                    ),
                  ),
                  if (batch) ...[
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () => Navigator.pop(context, _unlockedCount > 0),
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669)),
                      child: const Text('Done'),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (_processing)
            ColoredBox(
              color: Colors.black.withValues(alpha: 0.45),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: Color(0xFF059669)),
                      const SizedBox(height: 14),
                      Text(
                        'Verifying pickup…',
                        style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      ),
    );
  }
}

class _ScannerFramePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF10B981)
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const len = 28.0;
    const inset = 8.0;

    void corner(Offset start, Offset hEnd, Offset vEnd) {
      canvas.drawLine(start, hEnd, paint);
      canvas.drawLine(start, vEnd, paint);
    }

    corner(Offset(inset, inset), Offset(inset + len, inset), Offset(inset, inset + len));
    corner(
      Offset(size.width - inset, inset),
      Offset(size.width - inset - len, inset),
      Offset(size.width - inset, inset + len),
    );
    corner(
      Offset(inset, size.height - inset),
      Offset(inset + len, size.height - inset),
      Offset(inset, size.height - inset - len),
    );
    corner(
      Offset(size.width - inset, size.height - inset),
      Offset(size.width - inset - len, size.height - inset),
      Offset(size.width - inset, size.height - inset - len),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
