import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/constants/service_locations.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/onboarding_nav.dart';
import '../../../l10n/app_localizations.dart';

class StateSelectionScreen extends StatefulWidget {
  const StateSelectionScreen({super.key});

  @override
  State<StateSelectionScreen> createState() => _StateSelectionScreenState();
}

class _StateSelectionScreenState extends State<StateSelectionScreen> {
  String? _selectedState = 'Maharashtra';
  String _query = '';
  final _searchController = TextEditingController();

  List<String> get _allStates => ServiceLocations.allStates;

  List<String> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _allStates;
    return _allStates.where((s) => s.toLowerCase().contains(q)).toList();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final states = _filtered;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const AppBackButton(fallbackRoute: AppRoutes.login),
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
                    l10n.uiSelectState,
                    style: GoogleFonts.inter(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    l10n.uiSelectStateSubtitle,
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
                      hintText: l10n.uiSearchState,
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

            // State List
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                itemCount: states.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final stateName = states[index];
                  final selected = _selectedState == stateName;
                  return InkWell(
                    onTap: () {
                      setState(() => _selectedState = stateName);
                      Navigator.pushNamed(
                        context,
                        AppRoutes.selectCity,
                        arguments: stateName,
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
                          color: selected ? AppColors.primary : const Color(0xFFE5E7EB),
                          width: selected ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              stateName,
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
          ],
        ),
      ),
    );
  }
}
