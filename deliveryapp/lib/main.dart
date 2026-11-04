import 'dart:async';
import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/config/api_config.dart';
import 'core/l10n/locale_controller.dart';
import 'core/routes/app_router.dart';
import 'core/routes/app_routes.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'data/services/auth_service.dart';
import 'data/services/push_notification_service.dart';
import 'firebase_options.dart';
import 'l10n/app_localizations.dart';
import 'pickup_driver/pickup_driver_service.dart';
import 'presentation/screens/splash/splash_screen.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background isolate — load env before Firebase options.
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {}
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  debugPrint('FCM background message: ${message.messageId}');
  debugPrint('FCM background data: ${message.data}');
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load .env first so Firebase options are not hardcoded in source.
  await dotenv.load(fileName: '.env');

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(highImportanceChannel);

  const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
  const initSettings = InitializationSettings(android: androidInit);
  await flutterLocalNotificationsPlugin.initialize(
    settings: initSettings,
    onDidReceiveNotificationResponse: (response) {
      final payload = response.payload;
      if (payload != null && payload.isNotEmpty) {
        try {
          final data = jsonDecode(payload) as Map<String, dynamic>;
          PushNotificationService.instance.handleNotificationTap(data);
        } catch (_) {}
      }
    },
  );

  debugPrint('GreenGroc API base URL: ${ApiConfig.baseUrl}');
  await LocaleController.instance.loadSavedLocale();
  await ThemeController.instance.loadSavedTheme();
  await AuthService.instance.loadSession();
  await PushNotificationService.instance.init();
  runApp(const GreenGrocDeliveryApp());
}

class GreenGrocDeliveryApp extends StatefulWidget {
  const GreenGrocDeliveryApp({super.key});

  @override
  State<GreenGrocDeliveryApp> createState() => _GreenGrocDeliveryAppState();
}

class _GreenGrocDeliveryAppState extends State<GreenGrocDeliveryApp> with WidgetsBindingObserver {
  Timer? _sessionTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    AuthService.instance.sessionInvalidations.addListener(_onSessionInvalidated);
    _startSessionChecks();
  }

  void _startSessionChecks() {
    _sessionTimer?.cancel();
    _sessionTimer = Timer.periodic(const Duration(minutes: 1), (_) => _checkRiderSession());
  }

  void _checkRiderSession() {
    if (!PickupDriverService.instance.isLoggedIn) {
      unawaited(AuthService.instance.validateSession());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkRiderSession();
      _startSessionChecks();
    } else {
      _sessionTimer?.cancel();
    }
  }

  void _onSessionInvalidated() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || AuthService.instance.isLoggedIn || PickupDriverService.instance.isLoggedIn) return;
      notificationNavigatorKey.currentState?.pushNamedAndRemoveUntil(AppRoutes.login, (_) => false);
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    AuthService.instance.sessionInvalidations.removeListener(_onSessionInvalidated);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([
        ThemeController.instance,
        LocaleController.instance,
      ]),
      builder: (context, _) {
        final isDark = ThemeController.instance.isDark;
        SystemChrome.setSystemUIOverlayStyle(
          SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
            systemNavigationBarColor: ThemeController.instance.palette.background,
            systemNavigationBarIconBrightness:
                isDark ? Brightness.light : Brightness.dark,
          ),
        );

        return MaterialApp(
          navigatorKey: notificationNavigatorKey,
          onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: ThemeController.instance.mode,
          locale: LocaleController.instance.locale,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: const SplashScreen(),
          onGenerateRoute: AppRouter.onGenerateRoute,
        );
      },
    );
  }
}
