import 'package:flutter/material.dart';
import '../screens/announcements_screen.dart';
import '../screens/meetings_screen.dart';
import '../screens/leave_screen.dart';
import '../screens/shift_roster_screen.dart';
import '../screens/salary_screen.dart';
import '../screens/holidays_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/password_request_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

class NotificationNavigator {
  NotificationNavigator._();

  /// Routes to the respective screen based on notification type / category
  static void navigateByType(
    BuildContext? context, {
    required String type,
    Map<String, dynamic>? data,
  }) {
    final navState = rootNavigatorKey.currentState;
    final navContext = context ?? navState?.context;
    if (navContext == null) return;

    final cleanType = type.toLowerCase().trim();
    Widget targetScreen;

    switch (cleanType) {
      case 'announcement':
      case 'announcements':
        targetScreen = AnnouncementsScreen(highlightId: data?['id']?.toString());
        break;
      case 'meeting':
      case 'meetings':
        targetScreen = const MeetingsScreen();
        break;
      case 'leave':
      case 'leaves':
        targetScreen = const LeaveScreen();
        break;
      case 'shift':
      case 'shifts':
      case 'roster':
        targetScreen = const ShiftRosterScreen();
        break;
      case 'salary':
      case 'payroll':
        targetScreen = const SalaryScreen();
        break;
      case 'holiday':
      case 'holidays':
        targetScreen = const HolidaysScreen();
        break;
      case 'password_request':
        targetScreen = const PasswordRequestScreen();
        break;
      default:
        targetScreen = const NotificationsScreen();
        break;
    }

    if (context != null) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => targetScreen),
      );
    } else {
      navState?.push(
        MaterialPageRoute(builder: (_) => targetScreen),
      );
    }
  }
}
