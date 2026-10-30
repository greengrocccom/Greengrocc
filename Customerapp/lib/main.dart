import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app.dart';
import 'config/env.dart';
import 'core/bootstrap/photo_picker_bootstrap.dart';
import 'core/providers/app_providers.dart';
import 'core/storage/auth_storage.dart';
import 'services/notification_service.dart';
import 'widgets/app_back_binding.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService.handleBackgroundMessage(message);
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Register before runApp so we receive Android back before the app exits.
  AppBackBinding.instance.install();

  // Keep decoded images bounded on low-RAM devices (3–6 GB class hardware).
  PaintingBinding.instance.imageCache.maximumSize = 60;
  PaintingBinding.instance.imageCache.maximumSizeBytes = 32 << 20;

  // Gallery picks use the system Photo Picker — no READ_MEDIA_* permissions.
  configureAndroidPhotoPicker();

  await Env.load();

  if (kDebugMode) {
    for (final issue in Env.validate()) {
      debugPrint('Env warning: $issue');
    }
  }

  try {
    await NotificationService.ensureFirebaseReady();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    await NotificationService.instance.initialize();
  } catch (e) {
    if (kDebugMode) {
      debugPrint('Push notifications disabled: $e');
    }
  }

  final authStorage = await AuthStorage.create();

  runApp(
    ProviderScope(
      overrides: [
        authStorageProvider.overrideWithValue(authStorage),
      ],
      child: const GreenGroccApp(),
    ),
  );

  // Font fetch after first frame — never block runApp.
  WidgetsBinding.instance.addPostFrameCallback((_) {
    GoogleFonts.pendingFonts([GoogleFonts.plusJakartaSans()]);
  });
}
