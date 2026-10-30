import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/location_provider.dart';
import '../../core/utils/address_utils.dart';
import '../../core/utils/detect_current_location.dart';
import '../../features/address/address_controller.dart';
import '../../features/auth/auth_controller.dart';
import 'location_autocomplete_field.dart';
import 'map_location_picker_sheet.dart';

const addressFormDefaults = <String, String>{
  'fullName': '',
  'number': '',
  'email': '',
  'shopNo': '',
  'shopName': '',
  'fullAddress': '',
  'landmark': '',
  'area': '',
  'city': '',
  'state': '',
  'pincode': '',
};

class AddressForm extends ConsumerStatefulWidget {
  const AddressForm({
    super.key,
    this.initial,
    required this.onSubmit,
    required this.onCancel,
    this.submitting = false,
    this.plain = false,
  });

  final Map<String, String>? initial;
  final ValueChanged<Map<String, String>> onSubmit;
  final VoidCallback onCancel;
  final bool submitting;
  final bool plain;

  @override
  ConsumerState<AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends ConsumerState<AddressForm> {
  late final Map<String, TextEditingController> _controllers;
  String? _validationError;
  int _detectLocationSeq = 0;
  bool _isDetecting = false;
  Map<String, dynamic>? _detectedLocation;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial ?? addressFormDefaults;
    _controllers = {
      for (final key in addressFormDefaults.keys)
        key: TextEditingController(text: initial[key] ?? ''),
    };
    _controllers['pincode']!.addListener(_onPincodeChanged);
    final lat = double.tryParse(initial['lat'] ?? '');
    final lng = double.tryParse(initial['lng'] ?? '');
    if (lat != null && lng != null) {
      _detectedLocation = {'lat': lat, 'lng': lng};
    }
  }

  void _onPincodeChanged() {
    final pincode = _controllers['pincode']!.text.trim();
    if (pincode.length == 6) {
      _handlePincodeSelected(pincode);
    }
  }

  @override
  void dispose() {
    _controllers['pincode']!.removeListener(_onPincodeChanged);
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Map<String, String> _currentForm() {
    return {
      for (final entry in _controllers.entries)
        entry.key: entry.value.text.trim(),
    };
  }

  void _clearCityAndPincode() {
    _controllers['city']!.text = '';
    _controllers['pincode']!.text = '';
  }

  void _clearPincode() {
    _controllers['pincode']!.text = '';
  }

  Future<void> _handlePincodeSelected(String value) async {
    final pincode = value.replaceAll(RegExp(r'\D'), '').substring(
          0,
          value.length.clamp(0, 6),
        );
    _controllers['pincode']!.text = pincode;

    if (pincode.length != 6) return;

    try {
      final result =
          await ref.read(apiServiceProvider).fetchLocationByPincode(pincode);
      if (!mounted || result == null) return;
      if ((result['state'] ?? '').isNotEmpty) {
        _controllers['state']!.text = result['state']!;
      }
      if ((result['city'] ?? '').isNotEmpty) {
        _controllers['city']!.text = result['city']!;
      }
    } catch (_) {
      // keep typed pincode if lookup fails
    }
  }

  Future<void> _handleDetectLocation() async {
    final seq = ++_detectLocationSeq;
    setState(() => _isDetecting = true);
    try {
      final detected = await detectPhoneLocation(ref.read(apiServiceProvider));
      if (!mounted || seq != _detectLocationSeq) return;
      await ref.read(deliveryLocationProvider.notifier).setLocation(
            detected.toDeliveryLocation(),
          );
      if (!mounted || seq != _detectLocationSeq) return;
      setState(() {
        _applyDetected(detected);
        _isDetecting = false;
        _validationError = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Location detected: ${detected.displayLine}'),
          backgroundColor: const Color(0xFF047857),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    } on PhoneLocationException catch (error) {
      if (!mounted || seq != _detectLocationSeq) return;
      setState(() => _isDetecting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted || seq != _detectLocationSeq) return;
      setState(() => _isDetecting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not detect your phone location.')),
      );
    }
  }

  void _applyDetected(PhoneLocation detected) {
    if (detected.city.isNotEmpty) _controllers['city']!.text = detected.city;
    if (detected.state.isNotEmpty) _controllers['state']!.text = detected.state;
    if (detected.pincode.isNotEmpty) {
      _controllers['pincode']!.text = detected.pincode;
    }
    if (detected.area.isNotEmpty) _controllers['area']!.text = detected.area;
    if (detected.area.isNotEmpty && _controllers['landmark']!.text.isEmpty) {
      _controllers['landmark']!.text = detected.area;
    }
    if (detected.address.isNotEmpty) {
      _controllers['fullAddress']!.text = detected.address;
    }
    _detectedLocation = {
      'lat': detected.latitude,
      'lng': detected.longitude,
    };
  }

  Future<void> _handleChooseOnMap() async {
    _detectLocationSeq++;
    final result = await showMapLocationPickerSheet(
      context,
      ref,
      initialLocation: _detectedLocation ?? {
        if (_controllers['city']!.text.isNotEmpty) 'city': _controllers['city']!.text,
        if (_controllers['state']!.text.isNotEmpty) 'state': _controllers['state']!.text,
        if (_controllers['pincode']!.text.isNotEmpty) 'pincode': _controllers['pincode']!.text,
        if (_controllers['area']!.text.isNotEmpty) 'area': _controllers['area']!.text,
        if (_controllers['fullAddress']!.text.isNotEmpty) 'address': _controllers['fullAddress']!.text,
      },
    );
    if (result == null || !mounted) return;

    final city = result['city']?.toString() ?? '';
    final state = result['state']?.toString() ?? '';
    final pincode = result['pincode']?.toString() ?? '';
    final area = result['area']?.toString() ?? '';
    final landmark = result['landmark']?.toString() ?? area;
    final address = result['address']?.toString() ?? '';

    setState(() {
      if (city.isNotEmpty) _controllers['city']!.text = city;
      if (state.isNotEmpty) _controllers['state']!.text = state;
      if (pincode.isNotEmpty) _controllers['pincode']!.text = pincode;
      if (area.isNotEmpty) _controllers['area']!.text = area;
      if (landmark.isNotEmpty) _controllers['landmark']!.text = landmark;
      if (address.isNotEmpty) _controllers['fullAddress']!.text = address;

      final lat = result['lat'] is num ? (result['lat'] as num).toDouble() : double.tryParse('${result['lat']}');
      final lng = result['lng'] is num ? (result['lng'] as num).toDouble() : double.tryParse('${result['lng']}');
      if (lat != null && lng != null) {
        _detectedLocation = {
          'lat': lat,
          'lng': lng,
        };
      }
      _validationError = null;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white, size: 18),
              SizedBox(width: 8),
              Text('Location selected from map!'),
            ],
          ),
          backgroundColor: const Color(0xFF2563EB),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _handleSubmit() {
    final form = _currentForm();
    final error = validateAddressForm(form);
    if (error != null) {
      setState(() => _validationError = error);
      return;
    }

    final landmark = form['landmark']!.trim();
    final area = form['area']!.trim();
    final finalLandmark = landmark.isNotEmpty ? landmark : area;
    final finalArea = area.isNotEmpty ? area : landmark;

    final submission = {
      'fullName': form['fullName']!.trim(),
      'number': form['number']!.trim(),
      'email': form['email']!.trim(),
      'shopNo': form['shopNo']!.trim(),
      'shopName': form['shopName']!.trim(),
      'fullAddress': form['fullAddress']!.trim(),
      'landmark': finalLandmark,
      'area': finalArea,
      'city': form['city']!.trim(),
      'state': form['state']!.trim(),
      'pincode': form['pincode']!.trim(),
      if (_detectedLocation?['lat'] != null)
        'lat': _detectedLocation!['lat'].toString(),
      if (_detectedLocation?['lng'] != null)
        'lng': _detectedLocation!['lng'].toString(),
    };

    widget.onSubmit(submission);
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.read(apiServiceProvider);
    final stateValue = _controllers['state']!.text.trim();
    final cityValue = _controllers['city']!.text.trim();

    final formContent = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_validationError != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Text(
              _validationError!,
              style: TextStyle(color: Colors.red.shade700, fontSize: 13, fontWeight: FontWeight.w500),
            ),
          ),
          const SizedBox(height: 12),
        ],

        // Action Buttons: Detect Live Location & Choose on Map
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _isDetecting ? null : _handleDetectLocation,
                icon: _isDetecting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF047857)),
                      )
                    : const Icon(Icons.my_location_rounded, size: 18, color: Color(0xFF047857)),
                label: Text(
                  _isDetecting ? 'Detecting...' : 'Detect Live Location',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF047857),
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  backgroundColor: const Color(0xFFF0FDF4),
                  side: const BorderSide(color: Color(0xFFBBF7D0)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _handleChooseOnMap,
                icon: const Icon(Icons.map_outlined, size: 18, color: Color(0xFF2563EB)),
                label: const Text(
                  'Choose on Map',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2563EB),
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  backgroundColor: const Color(0xFFEFF6FF),
                  side: const BorderSide(color: Color(0xFFBFDBFE)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Full Name & Number
        Row(
          children: [
            Expanded(child: _field('fullName', 'Full name')),
            const SizedBox(width: 12),
            Expanded(
              child: _field(
                'number',
                'Number',
                keyboardType: TextInputType.phone,
                maxLength: 10,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // House / flat no. & Building / society
        Row(
          children: [
            Expanded(child: _field('shopNo', 'House / flat no.')),
            const SizedBox(width: 12),
            Expanded(child: _field('shopName', 'Building / society')),
          ],
        ),
        const SizedBox(height: 12),

        // Street address
        _field('fullAddress', 'Street address', maxLines: 2),
        const SizedBox(height: 12),

        Row(
          children: [
            Expanded(child: _field('area', 'Area / locality')),
            const SizedBox(width: 12),
            Expanded(child: _field('landmark', 'Landmark (optional)')),
          ],
        ),
        const SizedBox(height: 12),

        Row(
          children: [
            Expanded(
              child: LocationAutocompleteField(
                controller: _controllers['state']!,
                hint: 'State',
                fetchSuggestions: (query) => api.fetchLocationStates(q: query),
                onSelected: (_) => setState(_clearCityAndPincode),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: LocationAutocompleteField(
                controller: _controllers['city']!,
                hint: stateValue.isEmpty ? 'Select state first' : 'City',
                enabled: stateValue.isNotEmpty,
                fetchSuggestions: (query) => api.fetchLocationCities(
                  state: _controllers['state']!.text.trim(),
                  q: query,
                ),
                onSelected: (_) => setState(_clearPincode),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: LocationAutocompleteField(
                controller: _controllers['pincode']!,
                hint: cityValue.isEmpty ? 'Select city first' : 'Pincode',
                enabled: stateValue.isNotEmpty && cityValue.isNotEmpty,
                keyboardType: TextInputType.number,
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                fetchSuggestions: (query) => api.fetchLocationPincodes(
                  state: _controllers['state']!.text.trim(),
                  city: _controllers['city']!.text.trim(),
                  q: query,
                ),
                onSelected: _handlePincodeSelected,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            TextButton(
              onPressed: widget.onCancel,
              child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: widget.submitting ? null : _handleSubmit,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text(widget.submitting ? 'Saving...' : 'Save Address'),
            ),
          ],
        ),
      ],
    );

    if (widget.plain) return formContent;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: formContent,
    );
  }

  Widget _field(
    String name,
    String hint, {
    TextInputType? keyboardType,
    int maxLines = 1,
    int? maxLength,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return TextField(
      controller: _controllers[name],
      keyboardType: keyboardType,
      maxLines: maxLines,
      maxLength: maxLength,
      inputFormatters: inputFormatters,
      decoration: InputDecoration(
        hintText: hint,
        counterText: '',
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary),
        ),
      ),
      onChanged: (_) {
        if (_validationError != null) {
          setState(() => _validationError = null);
        }
      },
    );
  }
}

Future<String?> showDeliveryAddressFormSheet(
  BuildContext context, {
  Map<String, String>? initial,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (sheetContext) {
      return Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheetContext).bottom),
        child: SizedBox(
          height: MediaQuery.sizeOf(sheetContext).height * 0.92,
          child: _DeliveryAddressFormSheet(initial: initial),
        ),
      );
    },
  );
}

class _DeliveryAddressFormSheet extends ConsumerStatefulWidget {
  const _DeliveryAddressFormSheet({this.initial});

  final Map<String, String>? initial;

  @override
  ConsumerState<_DeliveryAddressFormSheet> createState() =>
      _DeliveryAddressFormSheetState();
}

class _DeliveryAddressFormSheetState extends ConsumerState<_DeliveryAddressFormSheet> {
  bool _saving = false;
  String _error = '';

  Map<String, String> _initialValues() {
    if (widget.initial != null) return widget.initial!;
    final user = ref.read(authControllerProvider).user;
    return {
      ...addressFormDefaults,
      'fullName': user?.name ?? '',
      'number': _tenDigitPhone(user?.phone) ?? '',
      'email': user?.email ?? '',
    };
  }

  Future<void> _save(Map<String, String> form) async {
    setState(() {
      _saving = true;
      _error = '';
    });
    final error = await ref.read(addressControllerProvider.notifier).saveAddress(
          form,
          makeDefault: true,
        );
    if (!mounted) return;
    if (error != null) {
      setState(() {
        _saving = false;
        _error = error;
      });
      return;
    }
    final addresses = ref.read(addressControllerProvider).addresses;
    Navigator.of(context).pop(addresses.isNotEmpty ? addresses.first.id : null);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Delivery Address',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              if (_error.isNotEmpty) ...[
                Text(_error, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                const SizedBox(height: 8),
              ],
              AddressForm(
                plain: true,
                initial: _initialValues(),
                submitting: _saving,
                onCancel: () => Navigator.of(context).pop(),
                onSubmit: _save,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

String? _tenDigitPhone(String? raw) {
  final digits = (raw ?? '').replaceAll(RegExp(r'\D'), '');
  if (digits.length < 10) return null;
  final last = digits.substring(digits.length - 10);
  if (RegExp(r'^[6789]\d{9}$').hasMatch(last)) return last;
  return null;
}

Map<String, String> addressFormFromPhoneLocation(
  PhoneLocation location, {
  String name = '',
  String phone = '',
  String email = '',
}) {
  return {
    'fullName': name,
    'number': _tenDigitPhone(phone) ?? '',
    'email': email,
    'shopNo': '',
    'shopName': '',
    'fullAddress': location.address,
    'landmark': location.area,
    'area': location.area,
    'city': location.city,
    'state': location.state,
    'pincode': location.pincode,
    'lat': location.latitude.toString(),
    'lng': location.longitude.toString(),
  };
}
