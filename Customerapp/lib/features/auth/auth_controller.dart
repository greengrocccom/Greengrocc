import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/exceptions/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../models/user.dart';
import '../../services/notification_service.dart';
import 'auth_state.dart';

export 'auth_state.dart';

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

class OtpVerifyResult {
  const OtpVerifyResult({
    this.needsSignup = false,
    this.phone,
    this.user,
  });

  final bool needsSignup;
  final String? phone;
  final User? user;
}

class AuthController extends Notifier<AuthState> {
  /// Bumped on every login/logout so a slow startup restore can't overwrite
  /// a newer session with the previously cached user.
  int _sessionEpoch = 0;

  @override
  AuthState build() {
    final storage = ref.read(authStorageProvider);
    final savedToken = storage.token;
    final rawSession = storage.session;

    User? cachedUser;
    if (rawSession != null && rawSession['user'] is Map) {
      try {
        cachedUser =
            User.fromJson(Map<String, dynamic>.from(rawSession['user'] as Map));
        if (cachedUser.isBlocked) {
          cachedUser = null;
          storage.clear();
        }
      } catch (_) {}
    }

    if (savedToken != null && savedToken.isNotEmpty) {
      // Synchronously restore state on startup frame 0 so the user is never logged out
      Future.microtask(_restoreSession);
      return AuthState(user: cachedUser, token: savedToken, loading: false);
    }

    Future.microtask(_restoreSession);
    return const AuthState(loading: false);
  }

  void _assertCustomerUser(User user) {
    if (user.isBlocked) {
      throw ApiException(user.blockedMessage);
    }
  }

  Future<void> _restoreSession() async {
    final epoch = _sessionEpoch;
    final storage = ref.read(authStorageProvider);
    final savedToken = storage.token;

    if (savedToken == null || savedToken.isEmpty) {
      if (state.token != null) {
        state = const AuthState(loading: false);
      }
      return;
    }

    final rawSession = storage.session;
    User? cachedUser;
    if (rawSession != null && rawSession['user'] is Map) {
      try {
        cachedUser =
            User.fromJson(Map<String, dynamic>.from(rawSession['user'] as Map));
        if (cachedUser.isBlocked) {
          await storage.clear();
          state = const AuthState(loading: false);
          return;
        }
      } catch (_) {}
    }

    // Immediately reflect cached session so user stays logged in
    if (cachedUser != null && (state.user == null || state.token != savedToken)) {
      state = AuthState(user: cachedUser, token: savedToken, loading: false);
    }

    try {
      final user = await ref.read(apiServiceProvider).fetchMe();
      if (epoch != _sessionEpoch) return;
      if (user.isBlocked) {
        await storage.clear();
        state = const AuthState(loading: false);
        return;
      }

      await storage.saveSession(user: user.toJson(), token: savedToken);
      state = AuthState(user: user, token: savedToken, loading: false);
    } on DioException catch (dioError) {
      if (epoch != _sessionEpoch) return;
      final statusCode = dioError.response?.statusCode;
      if (statusCode == 401) {
        final data = dioError.response?.data;
        final msg = (data is Map ? data['message']?.toString() : '') ?? '';
        final lower = msg.toLowerCase();
        if (lower.contains('invalid') || lower.contains('expired') || lower.contains('no longer exists')) {
          await storage.clear();
          state = const AuthState(loading: false);
          return;
        }
      } else if (statusCode == 403) {
        await storage.clear();
        state = const AuthState(loading: false);
        return;
      }

      // On connection errors / timeouts / transient drops: preserve the session!
      if (cachedUser != null) {
        state = AuthState(user: cachedUser, token: savedToken, loading: false);
      }
    } catch (_) {
      if (epoch != _sessionEpoch) return;
      if (cachedUser != null) {
        state = AuthState(user: cachedUser, token: savedToken, loading: false);
      } else if (savedToken.isNotEmpty) {
        state = AuthState(token: savedToken, loading: false);
      }
    }
  }

  void openAuthModal([
    AuthModalMode mode = AuthModalMode.login,
    String? redirectRoute,
  ]) {
    state = state.copyWith(
      authModal: mode,
      redirectRoute: redirectRoute,
    );
  }

  void closeAuthModal() {
    state = state.copyWith(
      clearAuthModal: true,
      clearRedirectRoute: true,
    );
  }

  void clearRedirect() {
    state = state.copyWith(clearRedirectRoute: true);
  }

  void setAuthModal(AuthModalMode mode) {
    state = state.copyWith(authModal: mode);
  }

  Future<User> login({
    required String phone,
    required String password,
  }) async {
    final session = await ref.read(apiServiceProvider).loginWithPhone(
          phone: phone,
          password: password,
        );
    _assertCustomerUser(session.user);
    await _persistSession(session);
    return session.user;
  }

  Future<User> signup({
    required String name,
    required String phone,
    required String password,
    String accountType = 'retail',
    String? shopName,
    String? shopAddress,
    String? ownerContact,
    String? gstNumber,
  }) async {
    final session = await ref.read(apiServiceProvider).signup(
          name: name,
          phone: phone,
          password: password,
          accountType: accountType,
          shopName: shopName,
          shopAddress: shopAddress,
          ownerContact: ownerContact,
          gstNumber: gstNumber,
        );
    _assertCustomerUser(session.user);
    await _persistSession(session);
    return session.user;
  }

  Future<void> sendOtp(String phone, {String purpose = 'login'}) async {
    await ref.read(apiServiceProvider).sendOtp(
          phone.trim(),
          purpose: purpose,
        );
  }

  Future<OtpVerifyResult> verifyOtp({
    required String phone,
    required String otp,
    String? name,
    String? shopName,
    String? shopAddress,
    String? gstNumber,
  }) async {
    final payload = <String, dynamic>{
      'phone': phone.trim(),
      'otp': otp.trim(),
    };
    final trimmedName = name?.trim();
    if (trimmedName != null && trimmedName.isNotEmpty) {
      payload['name'] = trimmedName;
    }
    final trimmedShopName = shopName?.trim();
    if (trimmedShopName != null && trimmedShopName.isNotEmpty) {
      payload['shopName'] = trimmedShopName;
    }
    final trimmedShopAddress = shopAddress?.trim();
    if (trimmedShopAddress != null && trimmedShopAddress.isNotEmpty) {
      payload['shopAddress'] = trimmedShopAddress;
    }
    final trimmedGst = gstNumber?.trim().toUpperCase();
    if (trimmedGst != null && trimmedGst.isNotEmpty) {
      payload['gstNumber'] = trimmedGst;
    }

    final body = await ref.read(apiServiceProvider).verifyOtp(payload);

    if (body['needsSignup'] == true) {
      return OtpVerifyResult(
        needsSignup: true,
        phone: body['phone']?.toString() ?? phone.trim(),
      );
    }

    final session = AuthSession(
      user: User.fromJson(body['user'] as Map<String, dynamic>),
      token: body['token']?.toString() ?? '',
    );

    _assertCustomerUser(session.user);
    await _persistSession(session);
    return OtpVerifyResult(user: session.user);
  }

  Future<void> resendOtp(String phone, {String purpose = 'login'}) async {
    await ref.read(apiServiceProvider).resendOtp(phone.trim(), purpose: purpose);
  }

  /// Website signup: OTP already verified via [verifyOtp] (needsSignup), then
  /// create the retail or bulk account with the collected details.
  Future<User> completeOtpSignup(Map<String, dynamic> payload) async {
    final session =
        await ref.read(apiServiceProvider).completeOtpSignupProfile(payload);
    _assertCustomerUser(session.user);
    await _persistSession(session);
    return session.user;
  }

  Future<User> completeOtpSignupProfile({
    required String phone,
    required String name,
    required String shopName,
    required String shopAddress,
    String? gstNumber,
  }) async {
    final payload = <String, dynamic>{
      'phone': phone.trim(),
      'name': name.trim(),
      'shopName': shopName.trim(),
      'shopAddress': shopAddress.trim(),
    };
    final trimmedGst = gstNumber?.trim().toUpperCase();
    if (trimmedGst != null && trimmedGst.isNotEmpty) {
      payload['gstNumber'] = trimmedGst;
    }

    final session =
        await ref.read(apiServiceProvider).completeOtpSignupProfile(payload);

    _assertCustomerUser(session.user);
    await _persistSession(session);
    return session.user;
  }

  Future<void> logout() async {
    try {
      final token = await NotificationService.instance
          .getToken()
          .timeout(const Duration(seconds: 3), onTimeout: () => null);
      await ref
          .read(apiServiceProvider)
          .deleteFcmToken(token: token)
          .timeout(const Duration(seconds: 5));
    } catch (_) {
      // Best effort: the next login on this phone reassigns the token anyway.
    }
    _sessionEpoch++;
    await ref.read(authStorageProvider).clear();
    state = const AuthState(loading: false);
  }

  Future<String?> updateProfile(Map<String, dynamic> data) async {
    if (state.user == null) return 'Not signed in';

    try {
      final user = await ref.read(apiServiceProvider).updateProfile(data);
      if (user.isAdmin || user.isBlocked) {
        await logout();
        return user.blockedMessage;
      }
      await ref.read(authStorageProvider).saveSession(
            user: user.toJson(),
            token: state.token ?? '',
          );
      state = state.copyWith(user: user);
      return null;
    } catch (e) {
      return authErrorMessage(e);
    }
  }

  Future<void> _persistSession(AuthSession session) async {
    _assertCustomerUser(session.user);
    _sessionEpoch++;
    await ref.read(authStorageProvider).saveSession(
          user: session.user.toJson(),
          token: session.token,
        );
    state = state.copyWith(
      user: session.user,
      token: session.token,
      loading: false,
      clearAuthModal: true,
    );
  }
}

String authErrorMessage(Object error) => apiErrorMessage(error);
