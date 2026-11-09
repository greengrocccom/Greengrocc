import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/constants/service_locations.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../l10n/app_localizations.dart';

class CitySelectionScreen extends StatefulWidget {
  const CitySelectionScreen({super.key});

  @override
  State<CitySelectionScreen> createState() => _CitySelectionScreenState();
}

class _CitySelectionScreenState extends State<CitySelectionScreen> {
  String? _selectedCityId;
  String _query = '';
  String? _selectedState;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is String && args.isNotEmpty) {
        setState(() => _selectedState = args);
      } else if (args is Map && args['state'] != null) {
        setState(() => _selectedState = args['state'] as String);
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<ServiceCity> get _filteredCities {
    return ServiceLocations.search(_query, state: _selectedState);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final cities = _filteredCities;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const AppBackButton(fallbackRoute: AppRoutes.selectState),
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
                    l10n.selectCity,
                    style: GoogleFonts.inter(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _selectedState != null
                        ? l10n.uiSelectCityIn(_selectedState!)
                        : l10n.uiSelectCitySubtitle,
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
                      hintText: l10n.searchCity,
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

            // City List
            Expanded(
              child: cities.isEmpty
                  ? Center(
                      child: Text(
                        l10n.uiNoCitiesFound,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 8,
                      ),
                      itemCount: cities.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final city = cities[index];
                        final selected = _selectedCityId == city.id ||
                            (_selectedCityId == null && index == 0 && _selectedState == 'Maharashtra' && city.name == 'Pune');
                        return InkWell(
                          onTap: () {
                            setState(() => _selectedCityId = city.id);
                            goOnboardingStep(
                              context,
                              step: 'area',
                              route: AppRoutes.selectArea,
                              arguments: city.id,
                              data: {
                                'city': city.name,
                                'cityId': city.id,
                                'state': city.state,
                              },
                            );
                          },
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
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        city.name,
                                        style: GoogleFonts.inter(
                                          fontSize: 15,
                                          fontWeight: selected
                                              ? FontWeight.w700
                                              : FontWeight.w500,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      Text(
                                        city.state,
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ],
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
          ],
        ),
      ),
    );
  }
}
