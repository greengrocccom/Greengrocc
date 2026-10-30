import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/config/api_config.dart';

import '../../../core/constants/service_locations.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../data/services/auth_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../widgets/buttons/primary_button.dart';

class AreaSelectionScreen extends StatefulWidget {
  const AreaSelectionScreen({super.key, required this.cityId});

  final String cityId;

  @override
  State<AreaSelectionScreen> createState() => _AreaSelectionScreenState();
}

class _AreaSelectionScreenState extends State<AreaSelectionScreen> {
  String? _selectedArea;
  String _query = '';
  final _searchController = TextEditingController();
  List<AreaManagerInfo> _darkStores = [];
  String? _lookupError;
  bool _loadingStore = false;

  ServiceCity? get _city {
    if (widget.cityId.isNotEmpty) {
      final found = ServiceLocations.byId(widget.cityId);
      if (found != null) return found;
    }
    return ServiceLocations.byId('pune');
  }

  List<String> _hubAreas = const [];
  bool _loadingAreas = true;
  String? _areasError;

  List<String> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _hubAreas;
    return _hubAreas.where((a) => a.toLowerCase().contains(q)).toList();
  }

  @override
  void initState() {
    super.initState();
    _loadHubAreas();
  }

  Future<void> _loadHubAreas() async {
    final city = _city;
    setState(() {
      _loadingAreas = true;
      _areasError = null;
    });
    try {
      final areas = await AuthService.instance.fetchHubAreasForCity(
        cityId: city?.id ?? widget.cityId,
        cityName: city?.name ?? '',
      );
      if (!mounted) return;
      setState(() {
        _hubAreas = areas;
        _loadingAreas = false;
        if (_selectedArea != null && !areas.contains(_selectedArea)) {
          _selectedArea = null;
        }
      });
      if (areas.length == 1) _onAreaSelect(areas.first);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _areasError = e.toString().replaceFirst('Exception: ', '');
        _loadingAreas = false;
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _onAreaSelect(String area) async {
    setState(() {
      _selectedArea = area;
      _loadingStore = true;
      _darkStores = [];
      _lookupError = null;
    });

    try {
      final stores = await AuthService.instance.fetchAreaManagersByLocation(
        widget.cityId.isNotEmpty ? widget.cityId : 'pune',
        area,
        city: _city?.name,
      );
      if (!mounted) return;
      setState(() {
        _darkStores = stores;
        _loadingStore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _lookupError = e.toString();
        _loadingStore = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final city = _city;
    final areas = _filtered;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const AppBackButton(fallbackRoute: AppRoutes.selectCity),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text(
                    'Select Area',
                    style: GoogleFonts.inter(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    city != null
                        ? 'Please select your area in ${city.name}'
                        : 'Please select your area',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Search Bar
                  TextField(
                    controller: _searchController,
                    onChanged: (v) => setState(() => _query = v),
                    style: GoogleFonts.inter(fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Search area',
                      prefixIcon: const Icon(
                        Icons.search_rounded,
                        color: Color(0xFF9CA3AF),
                        size: 20,
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide(
                          color: AppColors.primary,
                          width: 1.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Area List
            Expanded(
              child: _loadingAreas
                  ? const Center(child: CircularProgressIndicator())
                  : _areasError != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _areasError!,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 12),
                            OutlinedButton.icon(
                              onPressed: _loadHubAreas,
                              icon: const Icon(Icons.refresh_rounded),
                              label: Text(
                                MaterialLocalizations.of(context)
                                    .refreshIndicatorSemanticLabel,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : areas.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.storefront_outlined,
                              size: 40,
                              color: Color(0xFF9CA3AF),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              _hubAreas.isEmpty
                                  ? AppLocalizations.of(context).noAreasInCity
                                  : 'No areas found',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 8,
                      ),
                      itemCount: areas.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final areaName = areas[index];
                        final selected = _selectedArea == areaName;
                        return InkWell(
                          onTap: () => _onAreaSelect(areaName),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 14,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: selected
                                    ? AppColors.primary
                                    : const Color(0xFFE5E7EB),
                                width: selected ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    areaName,
                                    style: GoogleFonts.inter(
                                      fontSize: 15,
                                      fontWeight: selected
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ),
                                Container(
                                  width: 22,
                                  height: 22,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: selected
                                        ? AppColors.primary
                                        : Colors.transparent,
                                    border: Border.all(
                                      color: selected
                                          ? AppColors.primary
                                          : AppColors.textMuted,
                                      width: 1.5,
                                    ),
                                  ),
                                  child: selected
                                      ? const Icon(
                                          Icons.check,
                                          size: 14,
                                          color: Colors.white,
                                        )
                                      : null,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),

            // DARK STORE ADDRESS & MANAGER INFO CARD
            if (_selectedArea != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _darkStores.isNotEmpty
                      ? const Color(0xFFF0FDF4)
                      : const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _darkStores.isNotEmpty
                        ? const Color(0xFFBBF7D0)
                        : const Color(0xFFFDE68A),
                  ),
                ),
                child: _loadingStore
                    ? const Row(
                        children: [
                          SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF059669),
                            ),
                          ),
                          SizedBox(width: 12),
                          Text(
                            'Fetching Dark Store location details...',
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF065F46),
                            ),
                          ),
                        ],
                      )
                    : _lookupError != null
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.wifi_off_rounded,
                                    color: Color(0xFFD97706),
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Could not check dark stores',
                                      style: GoogleFonts.inter(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF92400E),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                kDebugMode
                                    ? 'API: ${ApiConfig.baseUrl}'
                                    : 'Check your connection and try again.',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: const Color(0xFFB45309),
                                ),
                              ),
                            ],
                          )
                    : _darkStores.isNotEmpty
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.storefront_rounded,
                                    color: Color(0xFF059669),
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _darkStores.first.storeName,
                                      style: GoogleFonts.inter(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF064E3B),
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFDCFCE7),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Text(
                                      'ACTIVE HUB',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF047857),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(
                                    Icons.location_on_outlined,
                                    color: Color(0xFF047857),
                                    size: 16,
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      _darkStores.first.storeAddress,
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: const Color(0xFF065F46),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (_darkStores.first.pincode.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'PIN ${_darkStores.first.pincode}',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFF047857),
                                  ),
                                ),
                              ],
                              if (_darkStores.first.phone.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.phone_outlined,
                                      color: Color(0xFF047857),
                                      size: 16,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Store Manager Contact: ${_darkStores.first.phone}',
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFF047857),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.warning_amber_rounded,
                                    color: Color(0xFFD97706),
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'No Dark Store Registered',
                                      style: GoogleFonts.inter(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF92400E),
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFEF3C7),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Text(
                                      'NO HUB REGISTERED',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFFB45309),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'No delivery manager has registered a dark store hub in $_selectedArea yet.',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: const Color(0xFFB45309),
                                ),
                              ),
                            ],
                          ),
              ),

            Padding(
              padding: const EdgeInsets.all(24),
              child: PrimaryButton(
                label: 'Continue',
                onPressed: _selectedArea == null || city == null
                    ? null
                    : () => goOnboardingStep(
                          context,
                          step: 'documents',
                          route: AppRoutes.uploadDocuments,
                          data: {
                            'city': city.name,
                            'cityId': city.id,
                            'area': _selectedArea,
                          },
                        ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
