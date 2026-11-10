import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../routes/app_router.dart';
import 'auth_controller.dart';
import 'auth_sheet.dart';

/// Directly displays the login / sign-up modal bottom sheet and manages modal state.
/// A [mandatory] sheet can only be closed by signing in.
Future<void> showAuthModalBottomSheet(
  BuildContext context,
  WidgetRef ref, {
  AuthModalMode mode = AuthModalMode.login,
  String? redirectRoute,
  bool mandatory = false,
}) async {
  if (_AuthHostState.isSheetOpen) return;
  _AuthHostState.isSheetOpen = true;

  ref.read(authControllerProvider.notifier).openAuthModal(mode, redirectRoute);

  try {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      useRootNavigator: true,
      isDismissible: !mandatory,
      enableDrag: !mandatory,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => PopScope(
        canPop: !mandatory,
        child: AuthSheet(mode: mode, mandatory: mandatory),
      ),
    );
  } finally {
    _AuthHostState.isSheetOpen = false;
    ref.read(authControllerProvider.notifier).closeAuthModal();
  }
}

class AuthHost extends ConsumerStatefulWidget {
  const AuthHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AuthHost> createState() => _AuthHostState();
}

class _AuthHostState extends ConsumerState<AuthHost> {
  static bool isSheetOpen = false;
  AuthModalMode? _visibleMode;

  void _showAuthSheet(AuthModalMode mode) {
    if (isSheetOpen) return;
    final navState = rootNavigatorKey.currentState;
    final navContext =
        navState?.overlay?.context ?? rootNavigatorKey.currentContext;
    if (!mounted || navContext == null || !navContext.mounted) return;

    isSheetOpen = true;
    _visibleMode = mode;
    try {
      showModalBottomSheet<void>(
        context: navContext,
        isScrollControlled: true,
        useSafeArea: true,
        useRootNavigator: true,
        isDismissible: true,
        enableDrag: true,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (context) => AuthSheet(mode: mode),
      ).catchError((dynamic err) {
        debugPrint('AuthSheet display error: $err');
      }).whenComplete(() {
        isSheetOpen = false;
        _visibleMode = null;
        ref.read(authControllerProvider.notifier).closeAuthModal();
      });
    } catch (err) {
      debugPrint('AuthSheet synchronous error: $err');
      isSheetOpen = false;
      _visibleMode = null;
      ref.read(authControllerProvider.notifier).closeAuthModal();
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authControllerProvider, (previous, next) {
      final mode = next.authModal;
      if (mode != null && !isSheetOpen) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _showAuthSheet(mode);
        });
      } else if (mode == null && _visibleMode != null && isSheetOpen) {
        final navContext = rootNavigatorKey.currentContext;
        if (navContext != null && navContext.mounted) {
          final navigator = Navigator.maybeOf(navContext, rootNavigator: true);
          if (navigator != null && navigator.canPop()) {
            navigator.pop();
          }
        }
      }
    });

    return widget.child;
  }
}
