import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Initializes Firebase using native Android config ([google-services.json]).
///
/// Safe no-op when Firebase is not configured yet (missing google-services.json).
Future<void> ensureFirebaseInitialized() async {
  if (Firebase.apps.isNotEmpty) {
    return;
  }

  if (kIsWeb) {
    return;
  }

  if (!Platform.isAndroid) {
    if (kDebugMode) {
      debugPrint(
        'Firebase: push notifications are configured for Android only. '
        'Add google-services.json / flutterfire configure for other platforms.',
      );
    }
    return;
  }

  try {
    await Firebase.initializeApp();
  } catch (e) {
    if (kDebugMode) {
      debugPrint(
        'Firebase not initialized ($e). '
        'Add android/app/google-services.json to enable push.',
      );
    }
  }
}
