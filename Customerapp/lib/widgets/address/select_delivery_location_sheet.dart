import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/location_provider.dart';
import '../../core/utils/detect_current_location.dart';
import '../../features/address/address_controller.dart';
import '../../features/auth/auth_controller.dart';
import '../../models/address.dart';
import 'address_form.dart';

Future<String?> showSelectDeliveryLocationBottomSheet(BuildContext context, WidgetRef ref) {
  ref.read(addressControllerProvider.notifier).loadAddresses();

  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => const SelectDeliveryLocationSheetContent(),
  );
}

class SelectDeliveryLocationSheetContent extends ConsumerStatefulWidget {
  const SelectDeliveryLocationSheetContent({super.key});

  @override
  ConsumerState<SelectDeliveryLocationSheetContent> createState() =>
      _SelectDeliveryLocationSheetContentState();
}

class _SelectDeliveryLocationSheetContentState
    extends ConsumerState<SelectDeliveryLocationSheetContent> {
  int _detectionSeq = 0;
  bool _isDetectingLocation = false;
  PhoneLocation? _detected;
  bool _isAddAddressExpanded = false;
  bool _savingAddress = false;
  String? _addressFormError;

  @override
  void initState() {
    super.initState();
    // Do NOT automatically detect location or request GPS permissions on open.
    // Permissions are only requested when the user taps "Use current location".
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _detectLiveLocation({required bool closeAfterSave}) async {
    final seq = ++_detectionSeq;
    setState(() => _isDetectingLocation = true);
    try {
      final detected = await detectPhoneLocation(ref.read(apiServiceProvider));
      if (!mounted || seq != _detectionSeq) return;
      await ref.read(deliveryLocationProvider.notifier).setLocation(
            detected.toDeliveryLocation(),
          );
      ref.invalidate(nearestStoreProvider);
      if (!mounted || seq != _detectionSeq) return;
      setState(() {
        _detected = detected;
        _isDetectingLocation = false;
      });

      if (!closeAfterSave) return;

      final user = ref.read(authControllerProvider).user;
      if (user == null) {
        if (!mounted || seq != _detectionSeq) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Delivery location set to ${detected.area.isNotEmpty ? detected.area : (detected.city.isNotEmpty ? detected.city : 'Current location')}',
              style: GoogleFonts.plusJakartaSans(fontSize: 13),
            ),
            backgroundColor: const Color(0xFF047857),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            duration: const Duration(seconds: 2),
          ),
        );
        Navigator.of(context).pop();
        return;
      }

      final addressId = await _saveDetectedAddress(detected);
      if (!mounted || seq != _detectionSeq) return;
      if (addressId != null) {
        Navigator.of(context).pop(addressId);
        return;
      }

      final savedId = await showDeliveryAddressFormSheet(
        context,
        initial: addressFormFromPhoneLocation(
          detected,
          name: user.name,
          phone: user.phone,
          email: user.email,
        ),
      );
      if (!mounted || seq != _detectionSeq) return;
      if (savedId != null) Navigator.of(context).pop(savedId);
    } on PhoneLocationException catch (error) {
      if (!mounted || seq != _detectionSeq) return;
      setState(() => _isDetectingLocation = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted || seq != _detectionSeq) return;
      setState(() => _isDetectingLocation = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not detect your phone location.')),
      );
    }
  }

  Future<String?> _saveDetectedAddress(PhoneLocation location) async {
    final user = ref.read(authControllerProvider).user;
    final phone = _tenDigitPhone(user?.phone);
    final pin = location.pincode.replaceAll(RegExp(r'\D'), '');
    if (phone == null || pin.length != 6 || location.city.isEmpty || location.state.isEmpty) {
      return null;
    }

    final existing = ref.read(addressControllerProvider).addresses;
    for (final addr in existing) {
      final lat = addr.location?['lat'];
      final lng = addr.location?['lng'];
      if (lat is num && lng is num) {
        if ((lat - location.latitude).abs() < 0.0008 &&
            (lng - location.longitude).abs() < 0.0008) {
          return addr.id;
        }
      }
    }

    final error = await ref.read(addressControllerProvider.notifier).saveAddress({
      'fullName': (user?.name.trim().isNotEmpty ?? false) ? user!.name.trim() : 'Current location',
      'number': phone,
      'email': user?.email ?? '',
      'shopNo': location.area.isNotEmpty ? location.area : 'Current',
      'shopName': 'Current location',
      'fullAddress': location.address.isNotEmpty ? location.address : location.displayLine,
      'landmark': location.area.isNotEmpty ? location.area : location.label,
      'area': location.area,
      'city': location.city,
      'state': location.state,
      'pincode': pin,
      'lat': location.latitude.toString(),
      'lng': location.longitude.toString(),
    });
    if (error != null) return null;
    final addresses = ref.read(addressControllerProvider).addresses;
    return addresses.isNotEmpty ? addresses.first.id : null;
  }

  String? _tenDigitPhone(String? raw) {
    final digits = (raw ?? '').replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) return null;
    final last = digits.substring(digits.length - 10);
    if (RegExp(r'^[6789]\d{9}$').hasMatch(last)) return last;
    return null;
  }

  Future<void> _selectAddress(DeliveryLocation loc, {String? addressId}) async {
    _detectionSeq++; // Prevent in-flight GPS detection from overwriting manual address selection
    await ref.read(deliveryLocationProvider.notifier).setLocation(loc);
    ref.invalidate(nearestStoreProvider);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Delivery location updated to ${loc.area ?? loc.city ?? 'current location'}',
            style: GoogleFonts.plusJakartaSans(fontSize: 13),
          ),
          backgroundColor: const Color(0xFF047857),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 2),
        ),
      );
      Navigator.of(context).pop(addressId);
    }
  }

  bool _isAddressSelected(Address addr, DeliveryLocation? current) {
    if (current == null) return false;
    final lat = addr.location?['lat'];
    final lng = addr.location?['lng'];
    if (current.latitude != null && current.longitude != null && lat is num && lng is num) {
      return (current.latitude! - lat.toDouble()).abs() < 0.0008 &&
          (current.longitude! - lng.toDouble()).abs() < 0.0008;
    }
    if (current.address != null && current.address!.isNotEmpty && addr.fullAddress.isNotEmpty) {
      return current.address!.contains(addr.fullAddress);
    }
    return false;
  }

  Future<void> _handleSaveAddressFromSheet(Map<String, String> form) async {
    setState(() {
      _savingAddress = true;
      _addressFormError = null;
    });

    final error = await ref.read(addressControllerProvider.notifier).saveAddress(
          form,
          makeDefault: ref.read(addressControllerProvider).addresses.isEmpty,
        );

    if (!mounted) return;

    if (error != null) {
      setState(() {
        _savingAddress = false;
        _addressFormError = error;
      });
      return;
    }

    setState(() {
      _savingAddress = false;
      _isAddAddressExpanded = false;
    });

    final addresses = ref.read(addressControllerProvider).addresses;
    final created = addresses.isNotEmpty ? addresses.first : null;

    if (created != null) {
      await _selectAddress(
        DeliveryLocation(
          latitude: created.location?['lat'] is num
              ? (created.location!['lat'] as num).toDouble()
              : null,
          longitude: created.location?['lng'] is num
              ? (created.location!['lng'] as num).toDouble()
              : null,
          pincode: created.pincode,
          city: created.city,
          state: created.state,
          area: created.area.isNotEmpty ? created.area : created.fullAddress,
          address:
              '${created.shopNo} ${created.shopName}, ${created.fullAddress}, ${created.city}, ${created.state} - ${created.pincode}',
          label:
              '${created.shopName.isNotEmpty ? created.shopName : created.fullAddress}, ${created.city}',
        ),
        addressId: created.id,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentLocation = ref.watch(deliveryLocationProvider);
    final savedAddresses = ref.watch(addressControllerProvider.select((s) => s.addresses));

    final mediaQuery = MediaQuery.of(context);
    final maxSheetHeight = mediaQuery.size.height * 0.88;

    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        // Floating X Close Button
        Positioned(
          top: -50,
          child: GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: Color(0xFF1E293B),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black26,
                    blurRadius: 8,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(Icons.close_rounded, color: Colors.white, size: 22),
            ),
          ),
        ),

        // Main Sheet Body
        Container(
          constraints: BoxConstraints(maxHeight: maxSheetHeight),
          decoration: const BoxDecoration(
            color: Color(0xFFF8FAFC),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Drag Handle & Title
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    Text(
                      'Select delivery location',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),

              // Scrollable Options & Saved Addresses List
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  children: [
                    // 1. Use Current Location Card
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFF1F5F9)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: InkWell(
                        onTap: _isDetectingLocation
                            ? null
                            : () => _detectLiveLocation(closeAfterSave: true),
                        borderRadius: BorderRadius.circular(16),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFF0FDF4),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.my_location_rounded,
                                  color: Color(0xFF047857),
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Use current location',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 14.5,
                                        fontWeight: FontWeight.w800,
                                        color: const Color(0xFF047857),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _isDetectingLocation
                                          ? 'Detecting your phone location...'
                                          : (_detected?.displayLine ??
                                              currentLocation?.displayAddress ??
                                              'Tap to detect and deliver to current location'),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11.5,
                                        color: const Color(0xFF64748B),
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (_isDetectingLocation)
                                const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Color(0xFF047857),
                                  ),
                                )
                              else
                                const Icon(
                                  Icons.chevron_right_rounded,
                                  color: Color(0xFF94A3B8),
                                  size: 22,
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // 2. Add New Address Card with Expandable Dropdown Form
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: _isAddAddressExpanded
                              ? const Color(0xFF10B981)
                              : const Color(0xFFF1F5F9),
                          width: _isAddAddressExpanded ? 1.5 : 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          InkWell(
                            onTap: () {
                              final auth = ref.read(authControllerProvider);
                              if (!auth.isLoggedIn) {
                                ref
                                    .read(authControllerProvider.notifier)
                                    .openAuthModal(AuthModalMode.login);
                                return;
                              }
                              setState(() {
                                _isAddAddressExpanded = !_isAddAddressExpanded;
                                _addressFormError = null;
                              });
                            },
                            borderRadius: BorderRadius.vertical(
                              top: const Radius.circular(16),
                              bottom: Radius.circular(_isAddAddressExpanded ? 0 : 16),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFF0FDF4),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      _isAddAddressExpanded
                                          ? Icons.location_on_outlined
                                          : Icons.add_rounded,
                                      color: const Color(0xFF047857),
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Add new address',
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 14.5,
                                            fontWeight: FontWeight.w800,
                                            color: const Color(0xFF047857),
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          _isAddAddressExpanded
                                              ? 'Fill in the details below to save'
                                              : 'Enter house, street & area details',
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 11.5,
                                            color: const Color(0xFF64748B),
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Icon(
                                    _isAddAddressExpanded
                                        ? Icons.keyboard_arrow_up_rounded
                                        : Icons.keyboard_arrow_down_rounded,
                                    color: const Color(0xFF047857),
                                    size: 24,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          if (_isAddAddressExpanded) ...[
                            const Divider(height: 1, color: Color(0xFFF1F5F9)),
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  if (_addressFormError != null) ...[
                                    Container(
                                      padding: const EdgeInsets.all(10),
                                      margin: const EdgeInsets.only(bottom: 12),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEF2F2),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: const Color(0xFFFCA5A5)),
                                      ),
                                      child: Text(
                                        _addressFormError!,
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 12.5,
                                          color: const Color(0xFFB91C1C),
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                  AddressForm(
                                    plain: true,
                                    initial: _detected == null
                                        ? (ref.read(authControllerProvider).user != null
                                            ? {
                                                'fullName': ref.read(authControllerProvider).user!.name,
                                                'number': ref.read(authControllerProvider).user!.phone,
                                                'email': ref.read(authControllerProvider).user!.email,
                                              }
                                            : null)
                                        : addressFormFromPhoneLocation(
                                            _detected!,
                                            name: ref.read(authControllerProvider).user?.name ?? '',
                                            phone: ref.read(authControllerProvider).user?.phone ?? '',
                                            email: ref.read(authControllerProvider).user?.email ?? '',
                                          ),
                                    submitting: _savingAddress,
                                    onCancel: () =>
                                        setState(() => _isAddAddressExpanded = false),
                                    onSubmit: _handleSaveAddressFromSheet,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Saved Addresses Section Header
                    Text(
                      'Your saved addresses',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF64748B),
                      ),
                    ),

                    const SizedBox(height: 10),

                    // Render Saved Addresses List
                    if (savedAddresses.isNotEmpty)
                      ...savedAddresses.map((addr) => _SavedAddressCardItem(
                            address: addr,
                            isCurrent: _isAddressSelected(addr, currentLocation),
                            onSelect: () => _selectAddress(
                              DeliveryLocation(
                                latitude: addr.location?['lat'] is num
                                    ? (addr.location!['lat'] as num).toDouble()
                                    : null,
                                longitude: addr.location?['lng'] is num
                                    ? (addr.location!['lng'] as num).toDouble()
                                    : null,
                                pincode: addr.pincode,
                                city: addr.city,
                                state: addr.state,
                                area: addr.area.isNotEmpty ? addr.area : addr.fullAddress,
                                address: '${addr.shopNo} ${addr.shopName}, ${addr.fullAddress}, ${addr.city}, ${addr.state} - ${addr.pincode}',
                                label: '${addr.shopName.isNotEmpty ? addr.shopName : addr.fullAddress}, ${addr.city}',
                              ),
                              addressId: addr.id,
                            ),
                          ))
                    else
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          'No saved addresses yet. Use your current location or add a new address.',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                      ),

                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SavedAddressCardItem extends StatelessWidget {
  const _SavedAddressCardItem({
    required this.address,
    required this.onSelect,
    this.isCurrent = false,
  });

  final Address address;
  final VoidCallback onSelect;
  final bool isCurrent;

  @override
  Widget build(BuildContext context) {
    final title = address.fullName.isNotEmpty ? address.fullName : 'Saved Address';
    final isWork = title.toLowerCase().contains('work') || title.toLowerCase().contains('office');

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isCurrent ? const Color(0xFF10B981) : const Color(0xFFF1F5F9),
            width: isCurrent ? 1.5 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            InkWell(
              onTap: onSelect,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Icon Badge (Work/Home/Other) with "You're here" overlay if current
                    Column(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: isWork ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            isWork ? Icons.apartment_rounded : Icons.location_on_rounded,
                            color: isWork ? const Color(0xFFD97706) : const Color(0xFF047857),
                            size: 24,
                          ),
                        ),
                        if (isCurrent) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFA7F3D0)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.check_circle_rounded, color: Color(0xFF047857), size: 10),
                                const SizedBox(width: 2),
                                Text(
                                  "You're here",
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF047857),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),

                    const SizedBox(width: 12),

                    // Address Info Details
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                title,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                              const Spacer(),
                              const Icon(
                                Icons.push_pin_outlined,
                                size: 16,
                                color: Color(0xFF94A3B8),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${address.shopNo.isNotEmpty ? "${address.shopNo}, " : ""}${address.shopName.isNotEmpty ? "${address.shopName}, " : ""}${address.fullAddress}, ${address.city}',
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 12,
                              height: 1.35,
                              color: const Color(0xFF475569),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          if (address.number.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Phone number: ${address.number}',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF334155),
                              ),
                            ),
                          ],
                          const SizedBox(height: 8),

                          // Option Buttons row (... & Share)
                          Row(
                            children: [
                              InkWell(
                                onTap: () {},
                                borderRadius: BorderRadius.circular(20),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: const Icon(Icons.more_horiz_rounded, size: 16, color: Color(0xFF64748B)),
                                ),
                              ),
                              const SizedBox(width: 8),
                              InkWell(
                                onTap: () {
                                  Share.share(
                                    'Delivery address (${address.fullName}): ${address.fullAddress}, ${address.city} - ${address.pincode}',
                                  );
                                },
                                borderRadius: BorderRadius.circular(20),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: const Icon(Icons.ios_share_rounded, size: 14, color: Color(0xFF047857)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            if (isCurrent) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: const BoxDecoration(
                  color: Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(16)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.ios_share_rounded, size: 15, color: Color(0xFF047857)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Now share your addresses with friends and family',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF92400E),
                        ),
                      ),
                    ),
                    const Icon(Icons.close_rounded, size: 16, color: Color(0xFFB45309)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
