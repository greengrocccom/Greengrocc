import 'package:flutter/foundation.dart';

/// Lets child screens switch the main shell bottom tab.
class ShellNavigation {
  ShellNavigation._();
  static final instance = ShellNavigation._();

  ValueNotifier<int>? tabNotifier;

  /// Fired when FCM tap / cold-start needs Accept–Decline recovery.
  /// Payload may include orderId from the notification.
  final ValueNotifier<Map<String, dynamic>?> pendingOfferRecovery =
      ValueNotifier<Map<String, dynamic>?>(null);

  void bind(ValueNotifier<int> notifier) {
    tabNotifier = notifier;
  }

  void unbind() {
    tabNotifier = null;
  }

  void goToTab(int index) {
    tabNotifier?.value = index;
  }

  void requestOfferRecovery({String? orderId, String? reason}) {
    pendingOfferRecovery.value = {
      'orderId': orderId ?? '',
      'reason': reason ?? 'notification_tap',
      'at': DateTime.now().millisecondsSinceEpoch,
    };
  }
}
