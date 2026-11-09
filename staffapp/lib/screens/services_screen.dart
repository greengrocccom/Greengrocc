import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'attendance_screen.dart';
import 'shift_roster_screen.dart';
import 'leave_screen.dart';
import 'salary_screen.dart';
import 'holidays_screen.dart';
import 'announcements_screen.dart';
import 'meetings_screen.dart';
import 'notifications_screen.dart';
import 'profile_screen.dart';
import 'cleaning_report_screen.dart';

class ServicesScreen extends StatelessWidget {
  final VoidCallback? onSwitchToAttendance;

  const ServicesScreen({
    super.key,
    this.onSwitchToAttendance,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFD),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A56DB),
        elevation: 0,
        centerTitle: false,
        automaticallyImplyLeading: false,
        title: Text(
          'Services & Operations',
          style: GoogleFonts.outfit(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CleaningReportEntry(),
            // Banner / Introduction
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1A56DB), Color(0xFF2563EB)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1A56DB).withValues(alpha: 0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Staff Operations Hub',
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Access all HR tools, daily logs, shifts, leave requests, and payroll.',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.9),
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.apps_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 22),

            // Section 1: Work & Schedule
            _buildSectionHeader('Work & Schedule'),
            const SizedBox(height: 10),

            _buildServiceCard(
              context: context,
              title: 'Attendance & Punch',
              subtitle: 'Mark daily attendance, punch in/out & view monthly punch history',
              icon: Icons.access_time_filled_rounded,
              iconColor: const Color(0xFF1A56DB),
              iconBgColor: const Color(0xFFEFF6FF),
              onTap: () {
                if (onSwitchToAttendance != null) {
                  onSwitchToAttendance!();
                } else {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AttendanceScreen(showBackButton: true)),
                  );
                }
              },
            ),
            const SizedBox(height: 10),

            _buildServiceCard(
              context: context,
              title: 'Shift Roster',
              subtitle: 'View scheduled shifts, timing details & weekly work timetable',
              icon: Icons.calendar_month_rounded,
              iconColor: const Color(0xFFD97706),
              iconBgColor: const Color(0xFFFEF3C7),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ShiftRosterScreen()),
                );
              },
            ),
            const SizedBox(height: 10),

            _buildServiceCard(
              context: context,
              title: 'Leave Management',
              subtitle: 'Apply for leaves, view CL/SL/EL leave balances & approval status',
              icon: Icons.event_available_rounded,
              iconColor: const Color(0xFF059669),
              iconBgColor: const Color(0xFFECFDF5),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const LeaveScreen()),
                );
              },
            ),

            const SizedBox(height: 22),

            // Section 2: Payroll & Company Calendar
            _buildSectionHeader('Finance & Holidays'),
            const SizedBox(height: 10),

            _buildServiceCard(
              context: context,
              title: 'Salary & Compensation',
              subtitle: 'Admin-entered monthly salary breakdown, taxes, deductions & bank details',
              icon: Icons.account_balance_wallet_rounded,
              iconColor: const Color(0xFF4F46E5),
              iconBgColor: const Color(0xFFEEF2FF),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SalaryScreen()),
                );
              },
            ),
            const SizedBox(height: 10),

            _buildServiceCard(
              context: context,
              title: 'Holiday Calendar',
              subtitle: 'Current month official company holidays, off-days & annual calendar',
              icon: Icons.celebration_rounded,
              iconColor: const Color(0xFFDC2626),
              iconBgColor: const Color(0xFFFEF2F2),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const HolidaysScreen()),
                );
              },
            ),

            const SizedBox(height: 22),

            // Section 3: Communication & Team
            _buildSectionHeader('Communication & Notice'),
            const SizedBox(height: 10),

            _buildServiceCard(
              context: context,
              title: 'Announcements',
              subtitle: 'Company bulletins, official notices & management broadcasts',
              icon: Icons.campaign_rounded,
              iconColor: const Color(0xFF7C3AED),
              iconBgColor: const Color(0xFFF5F3FF),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AnnouncementsScreen()),
                );
              },
            ),
            const SizedBox(height: 10),

            _buildServiceCard(
              context: context,
              title: 'Team Meetings',
              subtitle: 'Scheduled syncs, conference agendas & direct video links',
              icon: Icons.groups_rounded,
              iconColor: const Color(0xFF0D9488),
              iconBgColor: const Color(0xFFF0FDFA),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const MeetingsScreen()),
                );
              },
            ),
            const SizedBox(height: 10),

            _buildServiceCard(
              context: context,
              title: 'Notifications & Alerts',
              subtitle: 'Shift updates, leave status notifications & priority alerts',
              icon: Icons.notifications_rounded,
              iconColor: const Color(0xFF0284C7),
              iconBgColor: const Color(0xFFF0F9FF),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                );
              },
            ),
            const SizedBox(height: 10),

            _buildServiceCard(
              context: context,
              title: 'My Profile',
              subtitle: 'Account details, designation, department & security',
              icon: Icons.person_rounded,
              iconColor: const Color(0xFF475569),
              iconBgColor: const Color(0xFFF1F5F9),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ProfileScreen(showBackButton: true)),
                );
              },
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: GoogleFonts.outfit(
        fontSize: 14,
        fontWeight: FontWeight.bold,
        color: const Color(0xFF334155),
        letterSpacing: 0.2,
      ),
    );
  }

  Widget _buildServiceCard({
    required BuildContext context,
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: iconBgColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: const Color(0xFF64748B),
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.arrow_forward_ios_rounded,
                  color: Color(0xFFCBD5E1),
                  size: 14,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
