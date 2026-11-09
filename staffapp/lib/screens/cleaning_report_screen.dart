import 'dart:convert';
import 'dart:typed_data';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import '../core/api_client.dart';

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
            'Required: take a photo and add a cleaning note',
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
  Uint8List? _photo;
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

  void _message(String text) {
    if (mounted)
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _capture() async {
    final bytes = await Navigator.push<Uint8List>(
      context,
      MaterialPageRoute(builder: (_) => const CleaningCameraScreen()),
    );
    if (mounted && bytes != null) setState(() => _photo = bytes);
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_photo == null) {
      _message('Take a photo with the camera first.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ApiClient.post('/api/staff/my/cleaning-reports', {
        'note': _note.text.trim(),
        'photoBase64': base64Encode(_photo!),
        'source': 'camera',
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
              'A fresh camera photo and a note are required. Gallery images cannot be selected.',
            ),
            const SizedBox(height: 16),
            if (_photo != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(_photo!, height: 220, fit: BoxFit.cover),
              ),
            OutlinedButton.icon(
              onPressed: _busy ? null : _capture,
              icon: const Icon(Icons.camera_alt),
              label: Text(
                _photo == null ? 'Take required photo' : 'Retake photo',
              ),
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
                  title: Text(report['date']?.toString() ?? ''),
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
                          report['date']?.toString() ?? 'Cleaning photo',
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
      final bytes = await file.readAsBytes();
      if (bytes.length > 5 * 1024 * 1024) throw StateError('Photo too large');
      if (mounted) Navigator.pop(context, bytes);
    } catch (_) {
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
              Expanded(child: Center(child: CameraPreview(_camera!))),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: FilledButton.icon(
                    onPressed: _taking ? null : _takePhoto,
                    icon: const Icon(Icons.camera_alt),
                    label: Text(_taking ? 'Capturing…' : 'Capture photo'),
                  ),
                ),
              ),
            ],
          ),
  );
}
