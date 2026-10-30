import 'package:flutter/material.dart';

import '../../presentation/screens/active_delivery/active_delivery_screen.dart';
import '../../presentation/screens/attendance/attendance_screen.dart';
import '../../presentation/screens/leave/apply_leave_screen.dart';
import '../../presentation/screens/documents/documents_screen.dart';
import '../../presentation/screens/earnings/earnings_screen.dart';
import '../../presentation/screens/gigs/all_gigs_screen.dart';
import '../../presentation/screens/history/delivery_history_screen.dart';
import '../../presentation/screens/login/login_screen.dart';
import '../../presentation/screens/login/otp_verification_screen.dart';
import '../../presentation/screens/login/welcome_screen.dart';
import '../../presentation/screens/navigation/live_navigation_screen.dart';
import '../../presentation/screens/notifications/notifications_screen.dart';
import '../../presentation/screens/onboarding/area_selection_screen.dart';
import '../../presentation/screens/onboarding/city_selection_screen.dart';
import '../../presentation/screens/onboarding/language_selection_screen.dart';
import '../../presentation/screens/onboarding/liveness_check_screen.dart';
import '../../presentation/screens/onboarding/profile_details_screen.dart';
import '../../presentation/screens/onboarding/registration_success_screen.dart';
import '../../presentation/screens/onboarding/review_submit_screen.dart';
import '../../presentation/screens/onboarding/state_selection_screen.dart';
import '../../presentation/screens/onboarding/take_selfie_screen.dart';
import '../../presentation/screens/onboarding/upload_documents_screen.dart';
import '../../presentation/screens/onboarding/vehicle_selection_screen.dart';
import '../../presentation/screens/orders/new_orders_screen.dart';
import '../../presentation/screens/onboarding/employment_type_screen.dart';
import '../../presentation/screens/fulltime/fulltime_rules_screen.dart';
import '../../presentation/screens/fulltime/fulltime_attendance_screen.dart';
import '../../presentation/screens/fulltime/assigned_orders_screen.dart';
import '../../presentation/screens/preorders/preorder_deliveries_screen.dart';
import '../../presentation/screens/shifts/my_shifts_screen.dart';
import '../../presentation/screens/performance/performance_screen.dart';
import '../../presentation/screens/profile/profile_screen.dart';
import '../../presentation/screens/settings/settings_screen.dart';
import '../../presentation/screens/splash/splash_screen.dart';
import '../../presentation/screens/support/support_screen.dart';
import '../../presentation/screens/vehicle/vehicle_details_screen.dart';
import '../../presentation/screens/profile/bank_details_screen.dart';
import '../../presentation/screens/wallet/wallet_screen.dart';
import '../../presentation/shell/main_shell.dart';
import '../../pickup_driver/pickup_driver_shell.dart';
import '../../pickup_driver/widgets/pickup_ui.dart';
import '../services/secure_screen.dart';
import '../../core/theme/theme_rebuild.dart';
import '../../data/services/auth_service.dart';
import 'app_routes.dart';

class AppRouter {
  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    if (settings.name != null && settings.name!.isNotEmpty) {
      AuthService.instance.saveLastRoute(settings.name!);
    }

    return MaterialPageRoute(
      settings: settings,
      builder: (context) => ThemeRebuild(
        builder: (context) => switch (settings.name) {
          AppRoutes.splash => const SplashScreen(),
          AppRoutes.selectLanguage => LanguageSelectionScreen(
            fromSettings: settings.arguments == true,
          ),
          AppRoutes.welcome => const WelcomeScreen(),
          AppRoutes.login => const LoginScreen(),
          AppRoutes.otpVerification => const OtpVerificationScreen(),
          AppRoutes.selectVehicle => const VehicleSelectionScreen(),
          AppRoutes.selectState => const StateSelectionScreen(),
          AppRoutes.selectCity => const CitySelectionScreen(),
          AppRoutes.selectArea => AreaSelectionScreen(
              cityId: (settings.arguments as String?) ?? '',
            ),
          AppRoutes.uploadDocuments => const UploadDocumentsScreen(),
          AppRoutes.profileDetails => const ProfileDetailsScreen(),
          AppRoutes.reviewSubmit => const ReviewSubmitScreen(),
          AppRoutes.registrationSuccess => const RegistrationSuccessScreen(),
          AppRoutes.takeSelfie => const TakeSelfieScreen(),
          AppRoutes.livenessCheck => LivenessCheckScreen(
              selfiePath: settings.arguments as String?,
            ),
          AppRoutes.home => const MainShell(),
          AppRoutes.myShifts => const MyShiftsScreen(),
          AppRoutes.newOrders => const NewOrdersScreen(),
          AppRoutes.activeDelivery => SecureScreen(
              child: ActiveDeliveryScreen(initialOrderId: settings.arguments as String?),
            ),
          AppRoutes.liveNavigation => const LiveNavigationScreen(),
          AppRoutes.deliveryHistory => const DeliveryHistoryScreen(),
          AppRoutes.earnings => const EarningsScreen(),
          AppRoutes.wallet => const WalletScreen(),
          AppRoutes.gigs => const AllGigsScreen(),
          AppRoutes.attendance => AuthService.instance.deliveryBoy?.isFullTime == true
              ? const FullTimeAttendanceScreen()
              : const AttendanceScreen(),
          AppRoutes.leave => const ApplyLeaveScreen(),
          AppRoutes.performance => const PerformanceScreen(),
          AppRoutes.notifications => const NotificationsScreen(),
          AppRoutes.profile => const ProfileScreen(),
          AppRoutes.documents => const DocumentsScreen(),
          AppRoutes.vehicle => const VehicleDetailsScreen(),
          AppRoutes.bankDetails => const BankDetailsScreen(),
          AppRoutes.support => const SupportScreen(),
          AppRoutes.settings => const SettingsScreen(),
          AppRoutes.selectEmploymentType => const EmploymentTypeScreen(),
          AppRoutes.fullTimeRules => const FullTimeRulesScreen(),
          AppRoutes.fullTimeAttendance => const FullTimeAttendanceScreen(),
          AppRoutes.assignedOrders => const SecureScreen(child: AssignedOrdersScreen()),
          AppRoutes.preOrderDeliveries => const SecureScreen(child: PreOrderDeliveriesScreen()),
          AppRoutes.pickupDriverHome =>
            const PickupTheme(child: PickupDriverShell()),
          _ => const SplashScreen(),
        },
      ),
    );
  }
}
