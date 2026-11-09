import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../../data/services/auth_service.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/shift_service.dart';

const _kRupee = '\u20B9';

class AllGigsScreen extends StatefulWidget {
  const AllGigsScreen({super.key});

  @override
  State<AllGigsScreen> createState() => _AllGigsScreenState();
}

class _AllGigsScreenState extends State<AllGigsScreen> {
  bool _loading = true;
  bool _goingOnline = false;
  List<GigInfo> _gigs = [];

  bool get _isOnline => AuthService.instance.deliveryBoy?.isOnline ?? false;

  Future<void> _goOnline() async {
    if (_isOnline || _goingOnline) return;
    setState(() => _goingOnline = true);
    try {
      final pos = await LocationService.instance.getCurrentLocation();
      final lat = pos?.latitude ?? 18.559;
      final lng = pos?.longitude ?? 73.7868;
      final res = await ShiftService.instance.goOnlineWithLocation(lat, lng);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            res.success
                ? res.message
                : (res.code == 'SHIFT_REQUIRED' || res.code == 'NO_SHIFT_BOOKED')
                    ? AppLocalizations.of(context).ftGigsNoBookingNeeded
                    : res.message,
          ),
        ),
      );
      setState(() {});
    } finally {
      if (mounted) setState(() => _goingOnline = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _loadGigs();
  }

  Future<void> _loadGigs() async {
    setState(() => _loading = true);
    try {
      final list = await ShiftService.instance.fetchGigs();
      if (mounted) {
        setState(() {
          _gigs = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.cardBackground,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            } else {
              Navigator.pushReplacementNamed(context, AppRoutes.home);
            }
          },
        ),
        title: Text(
          AppLocalizations.of(context).gigsAndIncentives,
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: false,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF047857)))
          : RefreshIndicator(
              onRefresh: _loadGigs,
              color: AppColors.primary,
              child: _gigs.isEmpty
                  ? Center(
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text('🎯', style: TextStyle(fontSize: 48)),
                            const SizedBox(height: 12),
                            Text(
                              AppLocalizations.of(context).noActiveGigsTitle,
                              style: GoogleFonts.inter(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              AppLocalizations.of(context).noActiveGigsSubtitle,
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      physics: const BouncingScrollPhysics(),
                      itemCount: _gigs.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        return _GigDetailCard(
                          gig: _gigs[index],
                          isOnline: _isOnline,
                          goingOnline: _goingOnline,
                          onGoOnline: _goOnline,
                        );
                      },
                    ),
            ),
    );
  }
}

class _GigDetailCard extends StatelessWidget {
  const _GigDetailCard({
    required this.gig,
    required this.isOnline,
    required this.goingOnline,
    required this.onGoOnline,
  });

  final GigInfo gig;
  final bool isOnline;
  final bool goingOnline;
  final VoidCallback onGoOnline;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final rawTitle = gig.title.isNotEmpty ? gig.title : 'Lunch Incentive';
    final title = rawTitle.toLowerCase().contains('lunch')
        ? l10n.lunchIncentive
        : rawTitle.toLowerCase().contains('dinner')
            ? l10n.dinnerIncentive
            : rawTitle;
    final timeStr = '${gig.startTime} - ${gig.endTime}';
    final bonus = gig.bonusAmount;
    final desc = gig.description.isNotEmpty
        ? gig.description
        : l10n.specialGigDesc;
    final tiers = gig.tiers;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: Color(0xFF047857),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Icon(Icons.star_rounded, color: Color(0xFFFACC15), size: 26),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(
                          Icons.access_time_outlined,
                          size: 16,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          timeStr,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      l10n.earnUpToExtra('$_kRupee$bonus'),
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF047857),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      desc,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          Text(
            l10n.incentiveSlabsBonusLevels,
            style: GoogleFonts.inter(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 8),

          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: tiers.isNotEmpty
                  ? tiers.asMap().entries.map((e) {
                      final isFirst = e.key == 0;
                      return _SlabCard(
                        amount: '$_kRupee${e.value.minTarget}',
                        bonus: '+$_kRupee${e.value.bonusAmount}',
                        isSelected: isFirst,
                        isLocked: !isFirst,
                      );
                    }).toList()
                  : [
                      const _SlabCard(amount: '₹200', bonus: '+₹18', isSelected: true, isLocked: false),
                      const _SlabCard(amount: '₹400', bonus: '+₹60', isSelected: false, isLocked: true),
                      const _SlabCard(amount: '₹600', bonus: '+₹100', isSelected: false, isLocked: true),
                      const _SlabCard(amount: '₹800', bonus: '+₹140', isSelected: false, isLocked: true),
                      const _SlabCard(amount: '₹1000', bonus: '+₹180', isSelected: false, isLocked: true),
                    ],
            ),
          ),
          const SizedBox(height: 16),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF047857),
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: isOnline || goingOnline ? null : onGoOnline,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    isOnline ? l10n.youreOnline : l10n.goOnline,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Icon(Icons.chevron_right_rounded, size: 20, color: Colors.white),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SlabCard extends StatelessWidget {
  const _SlabCard({
    required this.amount,
    required this.bonus,
    required this.isSelected,
    this.isLocked = true,
  });

  final String amount;
  final String bonus;
  final bool isSelected;
  final bool isLocked;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isSelected
            ? (ThemeController.instance.isDark ? const Color(0xFF064E3B) : const Color(0xFFF0FDF4))
            : (isLocked ? AppColors.cardSubBg : AppColors.cardBackground),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isSelected
              ? (ThemeController.instance.isDark ? const Color(0xFF10B981) : const Color(0xFF059669))
              : AppColors.cardSubBorder,
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isLocked) ...[
                const Icon(
                  Icons.lock_rounded,
                  size: 11,
                  color: Color(0xFF94A3B8),
                ),
                const SizedBox(width: 3),
              ],
              Text(
                amount,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: isLocked ? const Color(0xFF64748B) : AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            bonus,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isLocked ? const Color(0xFF059669).withValues(alpha: 0.7) : const Color(0xFF059669),
            ),
          ),
        ],
      ),
    );
  }
}
