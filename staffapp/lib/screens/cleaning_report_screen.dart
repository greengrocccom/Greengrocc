import 'dart:convert';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:intl/intl.dart';
import '../core/api_client.dart';

/// Formats a timestamp in India time so the photo stamp matches the admin panel.
String formatCleaningTimestamp(DateTime time) {
  final ist = time.toUtc().add(const Duration(hours: 5, minutes: 30));
  return '${DateFormat('dd MMM yyyy, hh:mm:ss a').format(ist)} IST';
}

class CapturedCleaningPhoto {
  const CapturedCleaningPhoto(this.bytes, this.capturedAt);
  final Uint8List bytes;
  final DateTime capturedAt;
}

Uint8List stampCleaningPhoto((Uint8List, String) args) {
  final decoded = img.decodeImage(args.$1);
  if (decoded == null) throw StateError('Invalid photo');
  final image = img.bakeOrientation(decoded);
  final font = image.width >= 900 ? img.arial48 : img.arial24;
  final padding = font.lineHeight ~/ 2;
  final boxTop = image.height - font.lineHeight - padding * 2;
  img.fillRect(
    image,
    x1: 0,
    y1: boxTop,
    x2: image.width - 1,
    y2: image.height - 1,
    color: img.ColorRgba8(0, 0, 0, 170),
  );
  img.drawString(
    image,
    args.$2,
    font: font,
    x: padding,
    y: boxTop + padding,
    color: img.ColorRgb8(255, 255, 255),
  );
  return img.encodeJpg(image, quality: 85);
}

class CleaningReportEntry extends StatefulWidget {
  const CleaningReportEntry({super.key});
  @override
  State<CleaningReportEntry> createState() => _CleaningReportEntryState();
}

class _CleaningReportEntryState extends State<CleaningReportEntry> {
  late final Future<dynamic> _reports = ApiClient.get(
    '/api/staff/my/cleaning-reports',
  );
  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: _reports,
    builder: (context, snapshot) {
      if (snapshot.hasError) {
        return ListTile(
          leading: const Icon(Icons.cleaning_services),
          title: const Text('Cleaning reports unavailable'),
          subtitle: const Text('Tap to retry'),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const CleaningReportScreen()),
          ),
        );
      }
      if (snapshot.data?['eligible'] != true) return const SizedBox.shrink();
      return Card(
        child: ListTile(
          leading: const Icon(
            Icons.cleaning_services,
            color: Color(0xFF059669),
          ),
          title: const Text('Daily Cleaning Report'),
          subtitle: const Text(
            "Take today's cleaning photo and add a short note",
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const CleaningReportScreen()),
          ),
        ),
      );
    },
  );
}

class CleaningReportScreen extends StatefulWidget {
  const CleaningReportScreen({super.key});
  @override
  State<CleaningReportScreen> createState() => _CleaningReportScreenState();
}

class _CleaningReportScreenState extends State<CleaningReportScreen> {
  final _note = TextEditingController();
  final _form = GlobalKey<FormState>();
  CapturedCleaningPhoto? _photo;
  bool _busy = false;
  late Future<dynamic> _reports;

  @override
  void initState() {
    super.initState();
    _reports = ApiClient.get('/api/staff/my/cleaning-reports');
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  String _reportTitle(dynamic report) {
    final capturedAt = DateTime.tryParse(report['capturedAt']?.toString() ?? '');
    if (capturedAt != null) return formatCleaningTimestamp(capturedAt);
    return report['date']?.toString() ?? '';
  }

  void _message(String text) {
    if (mounted)
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _capture() async {
    final photo = await Navigator.push<CapturedCleaningPhoto>(
      context,
      MaterialPageRoute(builder: (_) => const CleaningCameraScreen()),
    );
    if (mounted && photo != null) setState(() => _photo = photo);
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_photo == null) {
      _message('Add a cleaning photo first.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ApiClient.post('/api/staff/my/cleaning-reports', {
        'note': _note.text.trim(),
        'photoBase64': base64Encode(_photo!.bytes),
        'source': 'camera',
        'capturedAt': _photo!.capturedAt.toUtc().toIso8601String(),
      });
      if (!mounted) return;
      _note.clear();
      setState(() {
        _photo = null;
        _reports = ApiClient.get('/api/staff/my/cleaning-reports');
      });
      _message('Cleaning report submitted.');
    } catch (error) {
      _message(error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Daily Cleaning Report')),
    body: FutureBuilder<dynamic>(
      future: _reports,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done)
          return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError)
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Could not load cleaning reports.'),
                TextButton(
                  onPressed: () => setState(
                    () => _reports = ApiClient.get(
                      '/api/staff/my/cleaning-reports',
                    ),
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        if (snapshot.data?['eligible'] != true)
          return const Center(
            child: Text('This section is for active cleaner accounts.'),
          );
        final reports = snapshot.data['reports'] as List<dynamic>? ?? [];
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Text(
              'Submit your daily cleaning report',
              style: TextStyle(fontSize: 21, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Take a photo with the camera, then add a note about the areas cleaned. The date and time are added to the photo automatically.',
            ),
            const SizedBox(height: 16),
            if (_photo != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(
                  _photo!.bytes,
                  height: 260,
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Captured: ${formatCleaningTimestamp(_photo!.capturedAt)}',
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
            OutlinedButton.icon(
              onPressed: _busy ? null : _capture,
              icon: const Icon(Icons.camera_alt),
              label: Text(_photo == null ? 'Take photo' : 'Retake'),
            ),
            Form(
              key: _form,
              child: TextFormField(
                controller: _note,
                enabled: !_busy,
                maxLength: 2000,
                minLines: 3,
                maxLines: 6,
                decoration: const InputDecoration(
                  labelText: 'Cleaning note *',
                  hintText: 'Describe the areas cleaned and work completed',
                  border: OutlineInputBorder(),
                ),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'A cleaning note is required'
                    : null,
              ),
            ),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(_busy ? 'Submitting…' : 'Submit report'),
            ),
            const SizedBox(height: 28),
            const Text(
              'Recent reports',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            if (reports.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text('No reports submitted yet.'),
              ),
            for (final report in reports)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.check_circle, color: Colors.green),
                  title: Text(_reportTitle(report)),
                  subtitle: Text(report['note']?.toString() ?? ''),
                  trailing: const Icon(Icons.photo_outlined),
                  onTap: () {
                    final photo = ApiClient.getImage(
                      '/api/staff/cleaning-reports/${report['_id']}/photo',
                    );
                    showDialog<void>(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: Text(
                          _reportTitle(report),
                        ),
                        content: SizedBox(
                          width: 320,
                          height: 360,
                          child: FutureBuilder<Uint8List>(
                            future: photo,
                            builder: (context, image) {
                              if (image.hasError)
                                return const Center(
                                  child: Text(
                                    'Could not load photo. Close and tap the report to retry.',
                                  ),
                                );
                              if (!image.hasData)
                                return const Center(
                                  child: CircularProgressIndicator(),
                                );
                              return InteractiveViewer(
                                child: Image.memory(image.data!),
                              );
                            },
                          ),
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Close'),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
          ],
        );
      },
    ),
  );
}

// Embedded camera capture deliberately provides no file or gallery picker.
class CleaningCameraScreen extends StatefulWidget {
  const CleaningCameraScreen({super.key});
  @override
  State<CleaningCameraScreen> createState() => _CleaningCameraScreenState();
}

class _CleaningCameraScreenState extends State<CleaningCameraScreen>
    with WidgetsBindingObserver {
  CameraController? _camera;
  String? _error;
  bool _taking = false;
  int _generation = 0;
  final _clock = Stream<DateTime>.periodic(
    const Duration(seconds: 1),
    (_) => DateTime.now(),
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initialize();
  }

  @override
  void dispose() {
    _generation++;
    WidgetsBinding.instance.removeObserver(this);
    _camera?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive) {
      _generation++;
      final camera = _camera;
      setState(() => _camera = null);
      camera?.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initialize();
    }
  }

  Future<void> _initialize() async {
    final generation = ++_generation;
    CameraController? camera;
    try {
      final cameras = await availableCameras();
      if (!mounted || generation != _generation) return;
      if (cameras.isEmpty) throw StateError('No camera available');
      final rear = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      camera = CameraController(
        rear,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await camera.initialize();
      if (!mounted || generation != _generation) {
        await camera.dispose();
        return;
      }
      setState(() {
        _camera = camera;
        _error = null;
      });
    } catch (_) {
      await camera?.dispose();
      if (mounted && generation == _generation) {
        setState(
          () => _error =
              'Camera unavailable. Allow camera access in phone settings, then retry.',
        );
      }
    }
  }

  Future<void> _takePhoto() async {
    final camera = _camera;
    if (_taking || camera == null || !camera.value.isInitialized) return;
    setState(() => _taking = true);
    try {
      final file = await camera.takePicture();
      final capturedAt = DateTime.now();
      final raw = await file.readAsBytes();
      final label = formatCleaningTimestamp(capturedAt);
      final bytes = await compute(stampCleaningPhoto, (raw, label));
      if (bytes.length > 5 * 1024 * 1024) throw StateError('Photo too large');
      if (mounted) {
        Navigator.pop(context, CapturedCleaningPhoto(bytes, capturedAt));
      }
    } catch (e, st) {
      debugPrint('[CleaningCamera] Capture failed: $e\n$st');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not take photo. Please try again.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _taking = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Capture cleaning photo')),
    body: _error != null
        ? Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(_error!),
                ),
                TextButton(
                  onPressed: () {
                    setState(() => _error = null);
                    _initialize();
                  },
                  child: const Text('Retry camera'),
                ),
              ],
            ),
          )
        : _camera == null
        ? const Center(child: CircularProgressIndicator())
        : Column(
            children: [
              Expanded(
                child: Center(
                  child: CameraPreview(
                    _camera!,
                    child: Align(
                      alignment: Alignment.bottomLeft,
                      child: Container(
                        width: double.infinity,
                        color: Colors.black54,
                        padding: const EdgeInsets.all(8),
                        child: StreamBuilder<DateTime>(
                          stream: _clock,
                          builder: (context, snapshot) => Text(
                            formatCleaningTimestamp(
                              snapshot.data ?? DateTime.now(),
                            ),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: FilledButton.icon(
                    onPressed: _taking ? null : _takePhoto,
                    icon: const Icon(Icons.camera_alt),
                    label: Text(_taking ? 'Saving photo…' : 'Capture photo'),
                  ),
                ),
              ),
            ],
          ),
  );
}
