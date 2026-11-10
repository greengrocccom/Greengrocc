import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/api_client.dart';
import '../core/session_manager.dart';
import '../core/user_friendly_error.dart';
import 'attendance_screen.dart';
import 'shift_roster_screen.dart';
import 'leave_screen.dart';
import 'salary_screen.dart';
import 'announcements_screen.dart';
import 'holidays_screen.dart';
import 'meetings_screen.dart';
import 'notifications_screen.dart';
import 'profile_screen.dart';
import 'cleaning_report_screen.dart';

class DashboardScreen extends StatefulWidget {
  final VoidCallback? onSwitchToAttendance;
  final VoidCallback? onSwitchToLeave;
  final VoidCallback? onSwitchToProfile;

  const DashboardScreen({
    super.key,
    this.onSwitchToAttendance,
    this.onSwitchToLeave,
    this.onSwitchToProfile,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic> _profile = {};
  Map<String, dynamic> _shift = {};
  Map<String, dynamic>? _latestFeed;

  bool _isPunching = false;
  bool _isOnDuty = false;
  int _unreadNotifications = 0;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    final localStaff = await SessionManager.getStaff();
    if (mounted && localStaff != null) {
      setState(() => _profile = localStaff);
    }

    try {
      final res = await ApiClient.get('/api/staff/my/overview');
      if (res != null && mounted) {
        final profile = res['profile'] as Map<String, dynamic>?;
        final today = res['today'] as Map<String, dynamic>?;
        final shift = res['shift'] as Map<String, dynamic>?;
        final feed = res['latestFeed'] as Map<String, dynamic>?;

        setState(() {
          if (profile != null) _profile = profile;
          if (today != null) _isOnDuty = today['isClockedIn'] == true;
          if (shift != null) _shift = shift;
          _latestFeed = feed;
          _unreadNotifications = res['unreadNotificationsCount'] ?? 0;
        });
      }
    } catch (_) {}
  }

  Future<void> _togglePunch() async {
    setState(() => _isPunching = true);
    final action = _isOnDuty ? 'out' : 'in';

    try {
      await ApiClient.post('/api/staff/my/attendance/punch', {'action': action});
      if (mounted) {
        setState(() {
          _isOnDuty = !_isOnDuty;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: _isOnDuty ? const Color(0xFF15803D) : const Color(0xFF1A56DB),
            content: Text(_isOnDuty ? 'Punched in successfully!' : 'Punched out successfully!'),
          ),
        );
        _loadDashboardData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFEF4444),
            content: Text(UserFriendlyError.toHumanMessage(e, defaultMessage: 'Unable to record attendance. Please try again.')),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isPunching = false);
    }
  }

  bool get _isCleaner {
    if (_profile['isCleaner'] == true) return true;
    final text = '${_profile['role'] ?? ''} ${_profile['roleLabel'] ?? ''}'
        .toLowerCase()
        .replaceAll(RegExp(r'[_-]+'), ' ');
    return RegExp(r'\bclean(?:er|ers|ing)?\b').hasMatch(text);
  }

  @override
  Widget build(BuildContext context) {
    final staffName = _profile['name'] ?? 'Staff Member';
    final staffRole = _profile['roleLabel'] ?? _profile['role'] ?? 'Operations';
    final shiftName = _shift['name'] ?? 'Regular Shift';
    final shiftStart = _shift['startTime'] ?? '09:00 AM';
    final shiftEnd = _shift['endTime'] ?? '06:00 PM';
    final department = _profile['department'] ?? 'Warehouse - Pune';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFD),
      body: RefreshIndicator(
        onRefresh: _loadDashboardData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Section: Blue Header Background with Flow-based Greeting & Today's Shift Card
              Stack(
                children: [
                  // 1. Curved Blue Header Background
                  Container(
                    height: 180,
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      color: Color(0xFF1A56DB),
                      borderRadius: BorderRadius.only(
                        bottomLeft: Radius.circular(24),
                        bottomRight: Radius.circular(24),
                      ),
                    ),
                  ),

                  // 2. Natural Flow: Greeting Row + Today's Shift Card
                  SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 12),

                          // Greeting Bar (Inside Blue area)
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              // User Avatar
                              GestureDetector(
                                onTap: () {
                                  if (widget.onSwitchToProfile != null) {
                                    widget.onSwitchToProfile!();
                                  } else {
                                    Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()));
                                  }
                                },
                                child: Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.white,
                                    border: Border.all(color: Colors.white, width: 2),
                                  ),
                                  child: ClipOval(
                                    child: Container(
                                      color: const Color(0xFFDBEAFE),
                                      child: Center(
                                        child: Text(
                                          staffName.isNotEmpty ? staffName[0].toUpperCase() : 'S',
                                          style: GoogleFonts.outfit(
                                            fontSize: 20,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFF1A56DB),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),

                              // Greetings & Name
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      'Good Morning,',
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: const Color(0xFFBFDBFE),
                                        fontWeight: FontWeight.w400,
                                      ),
                                    ),
                                    Text(
                                      staffName,
                                      style: GoogleFonts.outfit(
                                        fontSize: 17,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                    Text(
                                      staffRole,
                                      style: GoogleFonts.inter(
                                        fontSize: 11,
                                        color: const Color(0xFFDBEAFE),
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              // Bell Notification Icon with Badge
                              Stack(
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 24),
                                    onPressed: () {
                                      Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()));
                                    },
                                  ),
                                  if (_unreadNotifications > 0)
                                    Positioned(
                                      right: 8,
                                      top: 8,
                                      child: Container(
                                        width: 8,
                                        height: 8,
                                        decoration: const BoxDecoration(
                                          color: Color(0xFFEF4444),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),

                          const SizedBox(height: 18),

                          // "Today's Shift" Card
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 16,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Row 1: Shift Title & On Duty Status
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      shiftName,
                                      style: GoogleFonts.inter(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF1E293B),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: _isOnDuty ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        _isOnDuty ? 'On Duty' : 'Off Duty',
                                        style: GoogleFonts.inter(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _isOnDuty ? const Color(0xFF15803D) : const Color(0xFF64748B),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),

                                // Row 2: Timing
                                Row(
                                  children: [
                                    const Icon(Icons.access_time_rounded, size: 14, color: Color(0xFF64748B)),
                                    const SizedBox(width: 6),
                                    Text(
                                      '$shiftStart - $shiftEnd',
                                      style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),

                                // Row 3: Department / Location
                                Row(
                                  children: [
                                    const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF64748B)),
                                    const SizedBox(width: 6),
                                    Text(
                                      department,
                                      style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),

                                // Punch Out / In Button
                                SizedBox(
                                  width: double.infinity,
                                  height: 40,
                                  child: ElevatedButton.icon(
                                    onPressed: _isPunching ? null : _togglePunch,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF1A56DB),
                                      foregroundColor: Colors.white,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    icon: _isPunching
                                        ? const SizedBox(
                                            width: 16,
                                            height: 16,
                                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                          )
                                        : Icon(
                                            _isOnDuty ? Icons.logout_rounded : Icons.login_rounded,
                                            size: 16,
                                          ),
                                    label: Text(
                                      _isOnDuty ? 'Punch Out' : 'Punch In',
                                      style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              if (_isCleaner) ...[
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Material(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const CleaningReportScreen()),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: const Color(0xFFECFDF5),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.add_a_photo_rounded, color: Color(0xFF059669)),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Daily cleaning photo',
                                    style: GoogleFonts.outfit(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF064E3B),
                                    ),
                                  ),
                                  Text(
                                    "Take today's photo of the cleaned area",
                                    style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF047857)),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: Color(0xFF059669)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 20),

              // Quick Action Grid (2 rows of 4)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 10,
                  childAspectRatio: 0.95,
                  children: [
                    _buildQuickAction(
                      icon: Icons.access_time_filled_rounded,
                      label: 'Attendance',
                      onTap: () {
                        if (widget.onSwitchToAttendance != null) {
                          widget.onSwitchToAttendance!();
                        } else {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const AttendanceScreen()));
                        }
                      },
                    ),
                    _buildQuickAction(
                      icon: Icons.calendar_month_rounded,
                      label: 'Shifts',
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const ShiftRosterScreen()));
                      },
                    ),
                    _buildQuickAction(
                      icon: Icons.event_available_rounded,
                      label: 'Leave',
                      onTap: () {
                        if (widget.onSwitchToLeave != null) {
                          widget.onSwitchToLeave!();
                        } else {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const LeaveScreen()));
                        }
                      },
                    ),
                    _buildQuickAction(
                      icon: Icons.receipt_long_rounded,
                      label: 'Payslip',
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const SalaryScreen()));
                      },
                    ),
                    _buildQuickAction(
                      icon: Icons.campaign_rounded,
                      label: 'Announcements',
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const AnnouncementsScreen()));
                      },
                    ),
                    _buildQuickAction(
                      icon: Icons.celebration_rounded,
                      label: 'Holidays',
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const HolidaysScreen()));
                      },
                    ),
                    _buildQuickAction(
                      icon: Icons.groups_rounded,
                      label: 'Meetings',
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const MeetingsScreen()));
                      },
                    ),
                    _buildQuickAction(
                      icon: Icons.grid_view_rounded,
                      label: 'More',
                      onTap: () {
                        if (widget.onSwitchToProfile != null) {
                          widget.onSwitchToProfile!();
                        } else {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()));
                        }
                      },
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Latest Announcement Card (Dynamically loaded from backend)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Latest Announcement',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 8),

                    GestureDetector(
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const AnnouncementsScreen()));
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.description_outlined, color: Color(0xFF1A56DB), size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _latestFeed?['title'] ?? 'No announcements published',
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _latestFeed != null
                                        ? '${_latestFeed!['category'] ?? "HR"} • Recent'
                                        : 'All caught up',
                                    style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8)),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded, color: Color(0xFFCBD5E1), size: 20),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickAction({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFEFF6FF),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: const Color(0xFF1A56DB), size: 20),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF334155),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
