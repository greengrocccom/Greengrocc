import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../routes/route_paths.dart';
import '../routes/shell_navigator_keys.dart';

/// Android/iOS back handling for go_router shell tabs.
///
/// On Android 13+ with predictive back (`enableOnBackInvokedCallback`), the
/// system finishes the Activity when Flutter reports it cannot pop — without
/// calling [didPopRoute]. We force [SystemNavigator.setFrameworkHandlesBack]
/// and also listen via a native [MethodChannel] from [MainActivity].
class AppBackBinding with WidgetsBindingObserver {
  AppBackBinding._();
  static final AppBackBinding instance = AppBackBinding._();

  static const _exitWindow = Duration(seconds: 2);
  static const _channel = MethodChannel('com.greengrocc.app/back');

  GoRouter? router;
  DateTime? _lastHomeBackAt;
  bool _installed = false;
  VoidCallback? _routeListener;

  static const _overlayPaths = <String>{
    RoutePaths.wishlist,
    RoutePaths.checkout,
    RoutePaths.coupons,
    RoutePaths.support,
    RoutePaths.about,
    RoutePaths.contact,
    RoutePaths.blog,
    RoutePaths.privacyPolicy,
    RoutePaths.terms,
    RoutePaths.shippingDetails,
    RoutePaths.justArrived,
    RoutePaths.hotSelling,
  };

  void install() {
    if (_installed) return;
    _installed = true;
    WidgetsBinding.instance.addObserver(this);
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onBack') {
        return handleBack();
      }
      return null;
    });
    claimFrameworkHandlesBack();
  }

  /// Tell Android predictive-back that Flutter will handle the next back.
  void claimFrameworkHandlesBack() {
    if (kIsWeb) return;
    SystemNavigator.setFrameworkHandlesBack(true);
  }

  void bindRouter(GoRouter value) {
    _detachRouteListener();
    router = value;
    void listener() => claimFrameworkHandlesBack();
    _routeListener = listener;
    value.routerDelegate.addListener(listener);
    claimFrameworkHandlesBack();
  }

  void unbindRouter(GoRouter value) {
    if (!identical(router, value)) return;
    _detachRouteListener();
    router = null;
  }

  void _detachRouteListener() {
    final r = router;
    final listener = _routeListener;
    if (r != null && listener != null) {
      r.routerDelegate.removeListener(listener);
    }
    _routeListener = null;
  }

  @override
  Future<bool> didPopRoute() async {
    claimFrameworkHandlesBack();
    final result = handleBack();
    // "exit" / false → allow framework to finish; true → we handled.
    return result == true;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      claimFrameworkHandlesBack();
    }
  }

  bool _isFullScreenOverlay(String path) {
    if (_overlayPaths.contains(path)) return true;
    if (path.startsWith('/product/') && path != RoutePaths.product) return true;
    if (path.startsWith('/orders/') && path != RoutePaths.orders) return true;
    if (path.startsWith('/notifications')) return true;
    return false;
  }

  bool _isTopRoutePopup(NavigatorState navigator) {
    var isPopup = false;
    navigator.popUntil((route) {
      isPopup = route is PopupRoute;
      return true;
    });
    return isPopup;
  }

  void _showExitHint() {
    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null) return;
    final messenger = ScaffoldMessenger.maybeOf(ctx);
    messenger?.hideCurrentSnackBar();
    messenger?.showSnackBar(
      const SnackBar(
        content: Text('Press back again to exit'),
        duration: _exitWindow,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  /// true = consumed in Flutter; false = let platform decide;
  /// `"exit"` = finish the Android Activity (double-back on Home).
  Object handleBack() {
    claimFrameworkHandlesBack();

    final r = router ??
        (rootNavigatorKey.currentContext != null
            ? GoRouter.maybeOf(rootNavigatorKey.currentContext!)
            : null);
    if (r == null) return false;

    final path = r.state.uri.path;

    // 1) Sheets / dialogs
    final rootNav = rootNavigatorKey.currentState;
    if (rootNav != null && _isTopRoutePopup(rootNav)) {
      // maybePop honours PopScope, so mandatory sheets (login, location) stay open.
      rootNav.maybePop();
      return true;
    }

    // 2) Full-screen overlays
    if (_isFullScreenOverlay(path)) {
      if (r.canPop()) {
        r.pop();
      } else {
        r.go(RoutePaths.home);
      }
      return true;
    }

    // 3) Cart / Orders / Categories / product list / Profile → Home
    if (path != RoutePaths.home) {
      _lastHomeBackAt = null;
      r.go(RoutePaths.home);
      return true;
    }

    // 4) Home → double-back to exit
    final now = DateTime.now();
    final last = _lastHomeBackAt;
    if (last != null && now.difference(last) <= _exitWindow) {
      _lastHomeBackAt = null;
      // Native MainActivity finishes the Activity on "exit".
      SystemNavigator.pop();
      return 'exit';
    }

    _lastHomeBackAt = now;
    _showExitHint();
    return true;
  }
}
