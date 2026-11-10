import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/app_colors.dart';
import '../core/session_manager.dart';
import '../core/push_notification_service.dart';
import 'login_screen.dart';
import 'main_navigation_shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeIn);
    _animController.forward();
    _navigateNext();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _navigateNext() async {
    await Future.delayed(const Duration(milliseconds: 2200));
    String? token;
    try {
      token = await SessionManager.getToken().timeout(const Duration(seconds: 5));
    } catch (e) {
      debugPrint('[Splash] Could not read saved session: $e');
    }
    if (!mounted) return;

    if (token != null && token.isNotEmpty) {
      PushNotificationService.instance.syncTokenWithBackend();
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainNavigationShell()),
      );
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // Subtle organic background watermark shapes (light mint/green)
          Positioned(
            top: -60,
            right: -60,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFF0FDF4).withValues(alpha: 0.8),
              ),
            ),
          ),
          Positioned(
            bottom: 40,
            left: -80,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFEFF6FF).withValues(alpha: 0.7),
              ),
            ),
          ),

          // Main Center Content
          FadeTransition(
            opacity: _fadeAnim,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // GreenGroo Leaf Logo
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brandGreen.withValues(alpha: 0.12),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Icon(
                            Icons.eco_rounded,
                            size: 64,
                            color: AppColors.brandGreen,
                          ),
                          Positioned(
                            right: 18,
                            top: 20,
                            child: Container(
                              width: 14,
                              height: 14,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: Color(0xFF1A56DB),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Brand Title
                  Text(
                    'GreenGroo',
                    style: GoogleFonts.outfit(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF1E3A8A),
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),

                  // Slogan
                  Text(
                    'Grow Together',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom Fixed Staff App Subtitle
          Positioned(
            left: 0,
            right: 0,
            bottom: 48,
            child: Column(
              children: [
                Text(
                  'Staff App',
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Your HR • Your Team • Your Growth',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
