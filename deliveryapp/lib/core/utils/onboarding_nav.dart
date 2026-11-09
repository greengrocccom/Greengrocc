import 'package:flutter/material.dart';

import '../routes/app_routes.dart';
import '../theme/app_colors.dart';
import '../../data/services/auth_service.dart' show AuthApiException, AuthService;
import '../../l10n/app_localizations.dart';

/// Shared app-bar back button. Pops if possible, otherwise goes to [fallbackRoute].
class AppBackButton extends StatelessWidget {
  const AppBackButton({super.key, this.fallbackRoute});

  final String? fallbackRoute;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
      color: AppColors.textPrimary,
      onPressed: () => goBack(context, fallbackRoute: fallbackRoute),
    );
  }
}

void goBack(BuildContext context, {String? fallbackRoute}) {
  if (Navigator.of(context).canPop()) {
    Navigator.of(context).pop();
    return;
  }
  if (fallbackRoute != null) {
    Navigator.of(context).pushReplacementNamed(fallbackRoute);
  }
}

/// Saves onboarding progress (+ optional profile fields) then navigates.
/// Returns false (and shows a snackbar) if the API save fails.
Future<bool> goOnboardingStep(
  BuildContext context, {
  required String step,
  required String route,
  bool replace = false,
  Object? arguments,
  Map<String, dynamic>? data,
}) async {
  try {
    await AuthService.instance.updateOnboarding(step: step, data: data);
  } catch (e) {
    if (!context.mounted) return false;
    final msg = e is AuthApiException
        ? e.message
        : AppLocalizations.of(context).somethingWentWrong;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: AppColors.error,
      ),
    );
    return false;
  }
  if (!context.mounted) return false;
  if (replace) {
    Navigator.pushReplacementNamed(context, route, arguments: arguments);
  } else {
    Navigator.pushNamed(context, route, arguments: arguments);
  }
  return true;
}

Future<void> completeOnboarding(BuildContext context) async {
  try {
    await AuthService.instance.updateOnboarding(
      step: 'home',
      complete: true,
    );
  } catch (e) {
    if (!context.mounted) return;
    final msg = e is AuthApiException
        ? e.message
        : AppLocalizations.of(context).somethingWentWrong;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: AppColors.error,
      ),
    );
    return;
  }
  if (!context.mounted) return;
  Navigator.pushNamedAndRemoveUntil(
    context,
    AppRoutes.home,
    (route) => false,
  );
}

Future<void> logoutAndGoLogin(BuildContext context) async {
  if (AuthService.instance.isLoggedIn) {
    try {
      await AuthService.instance.updateStatus('offline');
    } catch (_) {}
  }
  await AuthService.instance.clearSession();
  if (!context.mounted) return;
  Navigator.pushNamedAndRemoveUntil(
    context,
    AppRoutes.login,
    (route) => false,
  );
}
