import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/app_colors.dart';
import '../core/api_client.dart';
import '../core/session_manager.dart';
import 'login_screen.dart';
import 'password_request_screen.dart';
import 'salary_screen.dart';

class ProfileScreen extends StatefulWidget {
  final bool showBackButton;
  const ProfileScreen({super.key, this.showBackButton = true});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic> _staff = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final s = await SessionManager.getStaff();
    if (mounted && s != null) {
      setState(() {
        _staff = s;
        _isLoading = false;
      });
    }

    try {
      final res = await ApiClient.get('/api/staff/my/overview');
      if (res != null && res['profile'] != null && mounted) {
        final profile = res['profile'] as Map<String, dynamic>;
        setState(() {
          _staff = profile;
          _isLoading = false;
        });
        await SessionManager.saveStaff(profile);
      }
    } catch (_) {}

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Log Out', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text('Are you sure you want to log out of your staff account?', style: GoogleFonts.inter()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: GoogleFonts.inter(color: const Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Log Out', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await SessionManager.clearSession();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = (_staff['name'] ?? '').toString().trim();
    final email = (_staff['email'] ?? '').toString().trim();
    final phone = (_staff['phone'] ?? '').toString().trim();
    final role = (_staff['roleLabel'] ?? _staff['designation'] ?? _staff['roleTitle'] ?? _staff['role'] ?? '')
        .toString()
        .trim();
    final department = (_staff['department'] ?? '').toString().trim();
    final joiningDate = (_staff['joiningDate'] ?? '').toString().trim();
    final isActive = _staff['isActive'] != false;

    final displayName = name.isNotEmpty ? name : (email.isNotEmpty ? email : 'Staff Member');
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'S';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFD),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A56DB),
        elevation: 0,
        centerTitle: false,
        automaticallyImplyLeading: widget.showBackButton,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          'Profile',
          style: GoogleFonts.outfit(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              onRefresh: _loadProfile,
              color: AppColors.primary,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 1. Staff Header Profile Card
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFFDBEAFE),
                              border: Border.all(color: const Color(0xFFBFDBFE), width: 1.5),
                            ),
                            child: Center(
                              child: Text(
                                initial,
                                style: GoogleFonts.outfit(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF1A56DB),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  displayName,
                                  style: GoogleFonts.inter(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: const Color(0xFF0F172A),
                                  ),
                                ),
                                if (role.isNotEmpty) ...[
                                  const SizedBox(height: 3),
                                  Text(
                                    role,
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: const Color(0xFF475569),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        isActive ? 'Active Staff' : 'Inactive',
                                        style: GoogleFonts.inter(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: isActive ? const Color(0xFF15803D) : const Color(0xFFB91C1C),
                                        ),
                                      ),
                                    ),
                                    if (department.isNotEmpty) ...[
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFEFF6FF),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          department,
                                          style: GoogleFonts.inter(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFF1A56DB),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 18),

                    // 2. Personal & Employment Information Card (Only Available Data)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Account Details',
                            style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 14),

                          if (name.isNotEmpty) _buildDetailRow('Full Name', name),
                          if (role.isNotEmpty) _buildDetailRow('Designation / Role', role),
                          if (department.isNotEmpty) _buildDetailRow('Department', department),
                          if (email.isNotEmpty) _buildDetailRow('Email Address', email),
                          if (phone.isNotEmpty) _buildDetailRow('Phone Number', phone),
                          if (joiningDate.isNotEmpty) _buildDetailRow('Joining Date', joiningDate),
                          _buildDetailRow('Account Status', isActive ? 'Active' : 'Inactive'),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // 3. Navigation Links (Real destinations)
                    _buildActionCard(
                      icon: Icons.account_balance_wallet_outlined,
                      title: 'Salary & Compensation',
                      subtitle: 'View monthly pay slips, salary breakdown & bank details',
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const SalaryScreen()));
                      },
                    ),

                    const SizedBox(height: 10),

                    _buildActionCard(
                      icon: Icons.lock_outline_rounded,
                      title: 'Change Password',
                      subtitle: 'Ask admin to set a new password and see their reply',
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PasswordRequestScreen()),
                        );
                      },
                    ),

                    const SizedBox(height: 24),

                    // 4. Logout Button
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _handleLogout,
                        icon: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 18),
                        label: Text(
                          'Logout',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFFDC2626),
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          side: const BorderSide(color: Color(0xFFFCA5A5)),
                          backgroundColor: const Color(0xFFFEF2F2),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF0F172A),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: AppColors.primary, size: 20),
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
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
