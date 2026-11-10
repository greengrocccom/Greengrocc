import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/user.dart';
import '../../routes/app_router.dart';
import 'auth_controller.dart';

bool _isTopRoutePopup(NavigatorState navigator) {
  var isPopup = false;
  navigator.popUntil((route) {
    isPopup = route is PopupRoute;
    return true;
  });
  return isPopup;
}

/// Closes auth UI and lands on the home tab after sign-in / sign-up.
void completeAuthAndGoHome({
  required WidgetRef ref,
  required BuildContext sheetContext,
  required User user,
  required bool isSignup,
}) {
  if (sheetContext.mounted && Navigator.canPop(sheetContext)) {
    Navigator.of(sheetContext).pop();
  } else if (sheetContext.mounted) {
    final nav = Navigator.maybeOf(sheetContext, rootNavigator: true) ??
        Navigator.maybeOf(sheetContext);
    if (nav != null && _isTopRoutePopup(nav)) {
      nav.pop();
    }
  }

  final redirect = ref.read(authControllerProvider).redirectRoute;

  ref.read(authControllerProvider.notifier).closeAuthModal();

  WidgetsBinding.instance.addPostFrameCallback((_) {
    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null || !ctx.mounted) return;

    if (redirect != null && redirect.isNotEmpty) {
      GoRouter.of(ctx).go(redirect);
    }

    final greetingName =
        user.name.trim().isNotEmpty ? user.name.trim() : 'there';
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(
        content: Text(
          isSignup
              ? 'Welcome to GreenGrocc, $greetingName!'
              : 'Welcome back, $greetingName!',
        ),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ),
    );
  });
}
