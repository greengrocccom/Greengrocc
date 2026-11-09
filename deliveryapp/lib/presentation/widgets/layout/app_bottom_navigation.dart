import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';

/// Flat bottom navigation bar: Home · My Shifts · Notifications · Wallet · History
/// Matches the exact UI from Image 1 with active green indicator and notification red dot.
class AppBottomNavigation extends StatelessWidget {
  const AppBottomNavigation({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.notificationBadgeCount = 0,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final int notificationBadgeCount;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.only(bottom: bottomPad),
      decoration: BoxDecoration(
        color: ThemeController.instance.isDark ? AppColors.surface : Colors.white,
        border: Border(
          top: BorderSide(
            color: ThemeController.instance.isDark
                ? AppColors.cardBorder
                : const Color(0xFFE5E7EB),
            width: 1,
          ),
        ),
      ),
      child: SizedBox(
        height: 60,
        child: Row(
          children: [
            _tab(0, Icons.home_outlined, Icons.home_rounded, l10n.home),
            _tab(1, Icons.schedule_outlined, Icons.schedule_rounded, l10n.myShifts),
            _tab(
              2,
              Icons.notifications_none_rounded,
              Icons.notifications_rounded,
              l10n.notifications,
              isNotification: true,
            ),
            _tab(
              3,
              Icons.history_rounded,
              Icons.history_rounded,
              l10n.history,
            ),
          ],
        ),
      ),
    );
  }

  Widget _tab(
    int index,
    IconData icon,
    IconData activeIcon,
    String label, {
    bool isNotification = false,
  }) {
    final isActive = currentIndex == index;
    final primaryGreen = const Color(0xFF047857);
    final inactiveColor = ThemeController.instance.isDark
        ? const Color(0xFF94A3B8)
        : const Color(0xFF6B7280);
    final color = isActive ? primaryGreen : inactiveColor;

    return Expanded(
      child: InkWell(
        onTap: () => onTap(index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  isActive ? activeIcon : icon,
                  size: 24,
                  color: color,
                ),
                if (isNotification && notificationBadgeCount > 0)
                  Positioned(
                    top: -6,
                    right: -10,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 18),
                      height: 18,
                      padding: const EdgeInsets.symmetric(horizontal: 5),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(
                          color: ThemeController.instance.isDark ? AppColors.surface : Colors.white,
                          width: 1.5,
                        ),
                      ),
                      child: Text(
                        notificationBadgeCount > 99 ? '99+' : '$notificationBadgeCount',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          height: 1,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
            const SizedBox(height: 3),
            Container(
              width: isActive ? 22 : 0,
              height: 2.5,
              decoration: BoxDecoration(
                color: isActive ? primaryGreen : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

