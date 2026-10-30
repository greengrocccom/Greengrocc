import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/exceptions/api_exception.dart';
import '../core/network/api_client.dart';
import '../core/network/catalog_cache.dart';
import '../core/network/api_isolate_parsers.dart';
import '../core/network/api_response_parser.dart';
import '../core/utils/upload_folders.dart';
import '../models/address.dart';
import '../models/app_notification.dart';
import '../models/brand.dart';
import '../models/cart_item.dart';
import '../models/category.dart';
import '../models/coupon.dart';
import '../models/dark_store.dart';
import '../models/hero_banner.dart';
import '../models/offer_banner.dart';
import '../models/order.dart';
import '../models/product.dart';
import '../models/site_banner.dart';
import '../models/store_settings.dart';
import '../models/testimonial.dart';
import '../models/user.dart';

/// Mirrors `frontend/src/api/api.js` — same backend endpoints.
class ApiService {
  ApiService(this._client);

  final ApiClient _client;

  Dio get _dio => _client.dio;

  /// Catalog GET through [CatalogCache]: instant from memory / this device,
  /// revalidated in the background; [live] is rebuilt only if it changed.
  Future<dynamic> _catalogGet(String path, Map<String, dynamic>? params, Ref? live) {
    return CatalogCache.instance.get(
      _client.cacheKey(path, params),
      () async => (await _dio.get(path, queryParameters: params)).data,
      ref: live,
    );
  }

  Future<Response<dynamic>> getHeroBanners({String device = 'mobile'}) =>
      _dio.get('/api/herobanners', queryParameters: {'device': device});

  Future<Response<dynamic>> getOfferBanners({String device = 'mobile'}) =>
      _dio.get('/api/offerbanners', queryParameters: {'device': device});

  Future<Response<dynamic>> getCategories([Map<String, dynamic>? params]) =>
      _dio.get('/api/categories', queryParameters: params);

  Future<Response<dynamic>> getCategoryById(String id) =>
      _dio.get('/api/categories/$id');

  Future<Response<dynamic>> getSections([Map<String, dynamic>? params]) =>
      _dio.get('/api/sections', queryParameters: params);

  Future<Response<dynamic>> getNearestStore([Map<String, dynamic>? params]) =>
      _dio.get('/api/stores/nearest', queryParameters: params);

  Future<Response<dynamic>> getBrands() => _dio.get('/api/brands');

  Future<Response<dynamic>> getTestimonials() => _dio.get('/api/testimonials');

  Future<Response<dynamic>> getStoreSettings() => _dio.get('/api/settings');

  Future<Response<dynamic>> getProducts([Map<String, dynamic>? params]) =>
      _dio.get('/api/products', queryParameters: params);

  Future<Response<dynamic>> getProductById(String id) =>
      _dio.get('/api/products/$id');

  Future<Response<dynamic>> getSimilarProducts(String id, {int? limit}) =>
      _dio.get(
        '/api/products/$id/similar',
        queryParameters: limit == null ? null : {'limit': limit},
      );

  Future<Response<dynamic>> getCart() => _dio.get('/api/cart');

  Future<Response<dynamic>> addToCartItem(Map<String, dynamic> data) =>
      _dio.post('/api/cart', data: data);

  Future<Response<dynamic>> removeFromCartItem(
    String productId, {
    String variantName = '',
    String colorName = '',
  }) =>
      _dio.delete(
        '/api/cart/$productId',
        queryParameters: {
          'variantName': variantName,
          'colorName': colorName,
        },
      );

  Future<Response<dynamic>> updateCartItemQty(
    String productId,
    int quantity, {
    String variantName = '',
    String colorName = '',
  }) =>
      _dio.put(
        '/api/cart/$productId',
        data: {
          'quantity': quantity,
          'variantName': variantName,
          'colorName': colorName,
        },
      );

  Future<Response<dynamic>> getWishlist() => _dio.get('/api/wishlist');

  Future<Response<dynamic>> toggleWishlistItem(String productId) =>
      _dio.post('/api/wishlist/toggle', data: {'productId': productId});

  Future<Response<dynamic>> removeFromWishlistItem(String productId) =>
      _dio.delete('/api/wishlist/$productId');

  Future<Response<dynamic>> signupUser(Map<String, dynamic> data) =>
      _dio.post('/api/users/signup', data: data);

  Future<Response<dynamic>> loginUser(Map<String, dynamic> data) =>
      _dio.post('/api/users/login', data: data);

  Future<Response<dynamic>> loginWithPhoneApi(Map<String, dynamic> data) =>
      _dio.post('/api/users/login/phone', data: data);

  Future<Response<dynamic>> sendOtpLogin(Map<String, dynamic> data) =>
      _dio.post('/api/users/otp/send', data: data);

  Future<Response<dynamic>> resendOtpLogin(Map<String, dynamic> data) =>
      _dio.post('/api/users/otp/resend', data: data);

  Future<Response<dynamic>> verifyOtpLogin(Map<String, dynamic> data) =>
      _dio.post('/api/users/otp/verify', data: data);

  Future<Response<dynamic>> completeOtpSignup(Map<String, dynamic> data) =>
      _dio.post('/api/users/otp/complete-signup', data: data);

  Future<Response<dynamic>> resetPasswordWithPhoneOtp(Map<String, dynamic> data) =>
      _dio.post('/api/users/password/reset', data: data);

  Future<Response<dynamic>> getAvailableCoupons({double subtotal = 0}) =>
      _dio.get('/api/coupons/available', queryParameters: {'subtotal': subtotal});

  Future<Response<dynamic>> postValidateCoupon(Map<String, dynamic> data) =>
      _dio.post('/api/coupons/validate', data: data);

  Future<Response<dynamic>> getMe() => _dio.get('/api/users/me');

  Future<Response<dynamic>> updateMe(Map<String, dynamic> data) =>
      _dio.patch('/api/users/me', data: data);

  Future<Response<dynamic>> postFcmToken(
    String token, {
    String deviceType = 'android',
  }) =>
      _dio.post(
        '/api/users/fcm-token',
        data: {
          'token': token,
          'deviceType': deviceType,
        },
      );

  Future<Response<dynamic>> deleteFcmToken({String? token}) => _dio.delete(
        '/api/users/fcm-token',
        data: {if (token != null && token.isNotEmpty) 'token': token},
      );

  Future<Response<dynamic>> getNotifications({
    int page = 1,
    int limit = 20,
  }) =>
      _dio.get(
        '/api/notifications',
        queryParameters: {
          'page': page,
          'limit': limit,
        },
      );

  Future<Response<dynamic>> getUnreadNotificationCount() =>
      _dio.get('/api/notifications/unread-count');

  Future<Response<dynamic>> putNotificationRead(String id) =>
      _dio.put('/api/notifications/$id/read');

  Future<Response<dynamic>> putNotificationsReadAll() =>
      _dio.put('/api/notifications/read-all');

  Future<Response<dynamic>> deleteNotificationById(String id) =>
      _dio.delete('/api/notifications/$id');

  Future<Response<dynamic>> getAddresses() => _dio.get('/api/addresses');

  Future<Response<dynamic>> addAddress(Map<String, dynamic> data) =>
      _dio.post('/api/addresses', data: _buildAddressPayload(data));

  Future<Response<dynamic>> updateAddress(
    String id,
    Map<String, dynamic> data,
  ) =>
      _dio.put('/api/addresses/$id', data: _buildAddressPayload(data));

  Future<Response<dynamic>> deleteAddress(String id) =>
      _dio.delete('/api/addresses/$id');

  Future<List<String>> fetchLocationStates({String q = ''}) async {
    final response = await _dio.get('/api/location/states', queryParameters: {'q': q});
    return _parseStringList(response.data);
  }

  Future<List<String>> fetchLocationCities({
    required String state,
    String q = '',
  }) async {
    final response = await _dio.get(
      '/api/location/cities',
      queryParameters: {'state': state, 'q': q},
    );
    return _parseStringList(response.data);
  }

  Future<List<String>> fetchLocationPincodes({
    required String state,
    required String city,
    String q = '',
  }) async {
    final response = await _dio.get(
      '/api/location/pincodes',
      queryParameters: {'state': state, 'city': city, 'q': q, 'limit': 250},
    );
    return _parseStringList(response.data);
  }

  Future<Map<String, dynamic>?> reverseGeocode({
    required double lat,
    required double lng,
  }) async {
    final response = await _dio.get(
      '/api/location/reverse',
      queryParameters: {'lat': lat, 'lng': lng},
    );
    final data = response.data;
    if (data is! Map) return null;
    final payload = data['data'];
    if (payload is! Map) return null;
    return Map<String, dynamic>.from(payload);
  }

  Future<Map<String, String>?> fetchLocationByPincode(String pincode) async {
    final response = await _dio.get('/api/location/pincode/$pincode');
    final data = response.data;
    if (data is! Map<String, dynamic>) return null;
    final payload = data['data'];
    if (payload is! Map<String, dynamic>) return null;
    return {
      'pincode': payload['pincode']?.toString() ?? pincode,
      'city': payload['city']?.toString() ?? '',
      'state': payload['state']?.toString() ?? '',
    };
  }

  List<String> _parseStringList(dynamic data) {
    if (data is! Map<String, dynamic>) return const [];
    final items = data['data'];
    if (items is! List) return const [];
    return items.map((item) => item.toString()).toList();
  }

  Future<Response<dynamic>> placeOrder(Map<String, dynamic> data) =>
      _dio.post('/api/orders', data: data);

  Future<Response<dynamic>> createCheckoutAttempt(Map<String, dynamic> data) =>
      _dio.post('/api/orders/checkout-attempt', data: data);

  Future<Response<dynamic>> createRazorpayOrder(Map<String, dynamic> data) =>
      _dio.post('/api/payments/create-order', data: data);

  Future<Response<dynamic>> verifyRazorpayPayment(Map<String, dynamic> data) =>
      _dio.post('/api/payments/verify', data: data);

  Future<Response<dynamic>> submitUpiPaymentProof(Map<String, dynamic> data) =>
      _dio.post('/api/payments/submit-upi-proof', data: data);

  Future<Response<dynamic>> getMyOrders() => _dio.get('/api/orders');

  Future<Response<dynamic>> getOrderById(String id) =>
      _dio.get('/api/orders/$id');

  Future<Response<dynamic>> cancelOrder(String id) =>
      _dio.patch('/api/orders/$id/cancel');

  /// SMS the delivery OTP (MSG91 delivery-verify template) to the customer again.
  Future<Response<dynamic>> resendDeliveryOtp(String id) =>
      _dio.post('/api/orders/$id/resend-delivery-otp');

  Future<Response<dynamic>> reschedulePreOrder(String id, String slot) =>
      _dio.patch('/api/orders/$id/preorder-slot', data: {'slot': slot});

  Future<Response<dynamic>> submitSupportMessage(Map<String, dynamic> data) =>
      _dio.post('/api/support', data: data);

  /// Uploads via presigned S3 URL (same flow as admin panel).
  Future<String> uploadImageFile(String filePath, String folder) async {
    final file = File(filePath);
    if (!await file.exists()) {
      throw ApiException('Image file not found');
    }

    final bytes = await file.readAsBytes();
    if (bytes.length > 5 * 1024 * 1024) {
      throw ApiException('Image must be under 5 MB');
    }

    final fileName = _fileNameFromPath(filePath);
    final mimeType = _mimeTypeFromPath(filePath);

    final presignRes = await _dio.post(
      '/api/upload/presign',
      data: {
        'folder': folder,
        'mimeType': mimeType,
        'filename': fileName,
      },
    );

    final data = ApiResponseParser.getData(presignRes.data);
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Invalid presign response');
    }

    final uploadUrl = data['uploadUrl']?.toString();
    final cloudFrontUrl = data['cloudFrontUrl']?.toString();
    if (uploadUrl == null ||
        uploadUrl.isEmpty ||
        cloudFrontUrl == null ||
        cloudFrontUrl.isEmpty) {
      throw const FormatException('Presign response missing URLs');
    }

    final s3Dio = Dio(
      BaseOptions(
        sendTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 60),
      ),
    );

    final putRes = await s3Dio.put<List<int>>(
      uploadUrl,
      data: bytes,
      options: Options(
        headers: {'Content-Type': mimeType},
        responseType: ResponseType.bytes,
        validateStatus: (status) => status != null && status < 500,
      ),
    );

    final status = putRes.statusCode ?? 0;
    if (status < 200 || status >= 300) {
      throw ApiException(
        'Failed to upload image to storage ($status)',
        statusCode: status,
      );
    }

    return cloudFrontUrl;
  }

  static String _fileNameFromPath(String path) {
    final normalized = path.replaceAll('\\', '/');
    final index = normalized.lastIndexOf('/');
    return index >= 0 ? normalized.substring(index + 1) : normalized;
  }

  static String _mimeTypeFromPath(String path) {
    final ext = path.split('.').last.toLowerCase();
    return switch (ext) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      _ => 'image/jpeg',
    };
  }

  /// `GET /api/banners?section=&placement=` — mobile banners only, admin order.
  Future<List<SiteBanner>> fetchSiteBanners({
    required String section,
    required String placement,
    Ref? live,
  }) async {
    final body = await _catalogGet('/api/banners', {'section': section, 'placement': placement}, live);
    final raw = ApiResponseParser.getData(body);
    if (raw is! List) return const [];
    final banners = raw
        .whereType<Map>()
        .map((e) => SiteBanner.fromJson(Map<String, dynamic>.from(e)))
        .where((b) => b.imageUrl.isNotEmpty && b.device == 'mobile')
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));
    return banners;
  }

  Future<List<HeroBanner>> fetchHeroBanners({String device = 'mobile'}) async {
    final response = await getHeroBanners(device: device);
    return parseOnBackground(parseHeroBannersResponse, response.data);
  }

  Future<List<OfferBanner>> fetchOfferBanners({String device = 'mobile'}) async {
    final response = await getOfferBanners(device: device);
    return parseOnBackground(parseOfferBannersResponse, response.data);
  }

  Future<List<Category>> fetchCategories({String? section, Ref? live}) async {
    final body = await _catalogGet(
      '/api/categories',
      section != null && section.isNotEmpty ? {'section': section} : null,
      live,
    );
    return parseOnBackground(parseCategoriesResponse, body);
  }

  Future<NearestStoreResult> fetchNearestStore([Map<String, dynamic>? params]) async {
    try {
      final response = await getNearestStore(params);
      final body = response.data;
      final data = body is Map<String, dynamic> && body['data'] is Map<String, dynamic>
          ? body['data']
          : body;
      if (data is Map<String, dynamic>) {
        return NearestStoreResult.fromJson(data);
      }
      return const NearestStoreResult(needsLocation: true);
    } catch (_) {
      return const NearestStoreResult(needsLocation: true);
    }
  }

  Future<List<Map<String, dynamic>>> fetchSections([Map<String, dynamic>? params, Ref? live]) async {
    try {
      final data = ApiResponseParser.getData(await _catalogGet('/api/sections', params, live));
      if (data is List) {
        return data.whereType<Map<String, dynamic>>().toList();
      }
      return const [];
    } catch (_) {
      return const [];
    }
  }

  Future<List<Brand>> fetchBrands() async {
    final response = await getBrands();
    return parseOnBackground(parseBrandsResponse, response.data);
  }

  Future<List<Testimonial>> fetchTestimonials() async {
    final response = await getTestimonials();
    return parseOnBackground(parseTestimonialsResponse, response.data);
  }

  Future<StoreSettings> fetchStoreSettings({Ref? live}) async {
    final body = await _catalogGet('/api/settings', null, live);
    return parseOnBackground(parseStoreSettingsResponse, body);
  }

  Future<List<Product>> fetchProducts([Map<String, dynamic>? params, Ref? live]) async {
    final body = await _catalogGet('/api/products', params, live);
    return parseOnBackground(parseProductsResponse, body);
  }

  /// One page of `/api/products`; `hasMore` comes from the server's pagination block.
  Future<({List<Product> items, bool hasMore})> fetchProductsPage(
    Map<String, dynamic> params, {
    required int page,
    int limit = 20,
  }) async {
    final response = await getProducts({...params, 'page': page, 'limit': limit});
    final items = await parseOnBackground(parseProductsResponse, response.data);
    final data = response.data;
    final pagination = data is Map ? data['pagination'] : null;
    final totalPages = pagination is Map
        ? int.tryParse(pagination['totalPages']?.toString() ?? '')
        : null;
    final hasMore = totalPages != null ? page < totalPages : items.length >= limit;
    return (items: items, hasMore: hasMore);
  }

  Future<Product> fetchProductById(String id, {Ref? live}) async {
    final body = await _catalogGet('/api/products/$id', null, live);
    return parseOnBackground(parseProductResponse, body);
  }

  Future<List<Product>> fetchSimilarProducts(String id, {int? limit}) async {
    final response = await getSimilarProducts(id, limit: limit);
    return parseOnBackground(parseProductsResponse, response.data);
  }

  Future<List<CartItem>> fetchCartItems() async {
    final response = await getCart();
    return parseOnBackground(parseCartItemsResponse, response.data);
  }

  Future<List<Coupon>> fetchAvailableCoupons({double subtotal = 0}) async {
    final response = await getAvailableCoupons(subtotal: subtotal);
    final data = ApiResponseParser.getData(response.data);
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().map(Coupon.fromJson).toList();
    }
    return const [];
  }

  Future<AppliedCoupon> validateCoupon({
    required String code,
    required double subtotal,
  }) async {
    final response = await postValidateCoupon({
      'code': code.trim().toUpperCase(),
      'subtotal': subtotal,
    });
    final data = ApiResponseParser.getData(response.data);
    if (data is Map<String, dynamic>) {
      return AppliedCoupon.fromJson(data);
    }
    throw ApiException(
      ApiResponseParser.getMessage(response.data) ?? 'Invalid coupon code',
    );
  }

  void _assertCustomerUser(User user) {
    if (user.isAdmin || user.isBlocked) {
      throw ApiException(user.blockedMessage);
    }
  }

  Future<AuthSession> loginWithPhone({
    required String phone,
    required String password,
  }) async {
    final response = await loginWithPhoneApi({
      'phone': phone.trim(),
      'password': password,
    });
    final raw = response.data;
    if (raw is Map && raw['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(raw) ?? 'Sign in failed',
      );
    }
    final rawData = ApiResponseParser.getData(raw);
    final data = rawData is Map ? Map<String, dynamic>.from(rawData) : <String, dynamic>{};
    final userRaw = data['user'];
    if (userRaw is! Map) {
      throw ApiException('User data missing in response');
    }
    final user = User.fromJson(Map<String, dynamic>.from(userRaw));
    _assertCustomerUser(user);
    return AuthSession(
      user: user,
      token: data['token']?.toString() ?? '',
    );
  }

  Future<AuthSession> login({
    String? email,
    String? phone,
    required String password,
  }) async {
    final payload = <String, dynamic>{'password': password};
    final trimmedPhone = phone?.trim();
    final trimmedEmail = email?.trim();
    if (trimmedPhone != null && trimmedPhone.isNotEmpty) {
      payload['phone'] = trimmedPhone;
    } else if (trimmedEmail != null && trimmedEmail.isNotEmpty) {
      payload['email'] = trimmedEmail;
    }
    final response = await loginUser(payload);
    final raw = response.data;
    if (raw is Map && raw['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(raw) ?? 'Sign in failed',
      );
    }
    final rawData = ApiResponseParser.getData(raw);
    final data = rawData is Map ? Map<String, dynamic>.from(rawData) : <String, dynamic>{};
    final userRaw = data['user'];
    if (userRaw is! Map) {
      throw ApiException('User data missing in response');
    }
    final user = User.fromJson(Map<String, dynamic>.from(userRaw));
    _assertCustomerUser(user);
    return AuthSession(
      user: user,
      token: data['token']?.toString() ?? '',
    );
  }

  Future<void> sendOtp(String phone, {String purpose = 'login'}) async {
    final response = await sendOtpLogin({
      'phone': phone.trim(),
      'purpose': purpose,
    });
    if (response.data is Map<String, dynamic>) {
      final success = response.data['success'];
      if (success == false) {
        throw ApiException(
          ApiResponseParser.getMessage(response.data) ?? 'Failed to send OTP',
          statusCode: response.statusCode,
        );
      }
    }
  }

  Future<void> resendOtp(String phone, {String purpose = 'login'}) async {
    final response = await resendOtpLogin({
      'phone': phone.trim(),
      'purpose': purpose,
    });
    final raw = response.data;
    if (raw is Map<String, dynamic> && raw['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(raw) ?? 'Failed to resend OTP',
        statusCode: response.statusCode,
      );
    }
  }

  Future<Map<String, dynamic>> verifyOtp(Map<String, dynamic> data) async {
    final response = await verifyOtpLogin(data);
    final raw = response.data;
    if (raw is Map<String, dynamic> && raw['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(raw) ?? 'OTP verification failed',
      );
    }
    final body = ApiResponseParser.getData(raw);
    if (body is! Map<String, dynamic>) {
      throw ApiException('Invalid OTP verification response');
    }
    return body;
  }

  Future<AuthSession> completeOtpSignupProfile(Map<String, dynamic> data) async {
    final response = await completeOtpSignup(data);
    final raw = response.data;
    if (raw is Map<String, dynamic> && raw['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(raw) ?? 'Could not complete sign up',
      );
    }
    final body = ApiResponseParser.getData(raw);
    if (body is! Map<String, dynamic>) {
      throw ApiException('Invalid signup response');
    }
    final user = User.fromJson(body['user'] as Map<String, dynamic>);
    _assertCustomerUser(user);
    return AuthSession(
      user: user,
      token: body['token']?.toString() ?? '',
    );
  }

  Future<AuthSession> resetPasswordWithOtp({
    required String phone,
    required String otp,
    required String newPassword,
  }) async {
    final response = await resetPasswordWithPhoneOtp({
      'phone': phone.trim(),
      'otp': otp.trim(),
      'newPassword': newPassword,
    });
    final raw = response.data;
    if (raw is Map<String, dynamic> && raw['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(raw) ?? 'Could not reset password',
      );
    }
    final body = ApiResponseParser.getData(raw);
    if (body is! Map<String, dynamic>) {
      throw ApiException('Invalid password reset response');
    }
    final user = User.fromJson(body['user'] as Map<String, dynamic>);
    _assertCustomerUser(user);
    return AuthSession(
      user: user,
      token: body['token']?.toString() ?? '',
    );
  }

  Future<AuthSession> signup({
    required String name,
    required String phone,
    required String password,
    String accountType = 'retail',
    String? shopName,
    String? shopAddress,
    String? ownerContact,
    String? gstNumber,
    String? email,
  }) async {
    final payload = <String, dynamic>{
      'name': name.trim(),
      'phone': phone.trim(),
      'password': password,
      'accountType': accountType,
    };
    if (accountType == 'bulk') {
      if (shopName != null && shopName.trim().isNotEmpty) {
        payload['shopName'] = shopName.trim();
      }
      if (shopAddress != null && shopAddress.trim().isNotEmpty) {
        payload['shopAddress'] = shopAddress.trim();
      }
      if (ownerContact != null && ownerContact.trim().isNotEmpty) {
        payload['ownerContact'] = ownerContact.trim();
      }
      if (gstNumber != null && gstNumber.trim().isNotEmpty) {
        payload['gstNumber'] = gstNumber.trim().toUpperCase();
      }
    } else {
      if (shopName != null && shopName.trim().isNotEmpty) {
        payload['shopName'] = shopName.trim();
      }
      if (shopAddress != null && shopAddress.trim().isNotEmpty) {
        payload['shopAddress'] = shopAddress.trim();
      }
      if (gstNumber != null && gstNumber.trim().isNotEmpty) {
        payload['gstNumber'] = gstNumber.trim().toUpperCase();
      }
    }
    final trimmedEmail = email?.trim();
    if (trimmedEmail != null && trimmedEmail.isNotEmpty) {
      payload['email'] = trimmedEmail;
    }
    final response = await signupUser(payload);
    final raw = response.data;
    if (raw is Map && raw['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(raw) ?? 'Registration failed',
      );
    }
    final rawData = ApiResponseParser.getData(raw);
    final data = rawData is Map ? Map<String, dynamic>.from(rawData) : <String, dynamic>{};
    final userRaw = data['user'];
    if (userRaw is! Map) {
      throw ApiException('User data missing in response');
    }
    final user = User.fromJson(Map<String, dynamic>.from(userRaw));
    _assertCustomerUser(user);
    return AuthSession(
      user: user,
      token: data['token']?.toString() ?? '',
    );
  }

  Future<User> fetchMe() async {
    final response = await getMe();
    final user = await parseOnBackground(parseUserResponse, response.data);
    _assertCustomerUser(user);
    return user;
  }

  Future<User> updateProfile(Map<String, dynamic> data) async {
    final response = await updateMe(data);
    final user = await parseOnBackground(parseUserResponse, response.data);
    _assertCustomerUser(user);
    return user;
  }

  Future<List<Address>> fetchAddresses() async {
    final response = await getAddresses();
    return parseOnBackground(parseAddressesResponse, response.data);
  }

  Future<Address> createAddress(Map<String, dynamic> data) async {
    final response = await addAddress(data);
    return ApiResponseParser.parseObject(response.data, Address.fromJson);
  }

  Future<Address> editAddress(String id, Map<String, dynamic> data) async {
    final response = await updateAddress(id, data);
    return ApiResponseParser.parseObject(response.data, Address.fromJson);
  }

  Future<void> removeAddress(String id) async {
    await deleteAddress(id);
  }

  Future<String> uploadPaymentProofImage(String filePath) =>
      uploadImageFile(filePath, UploadFolders.paymentProofs);

  Future<String> uploadSupportAttachment(String filePath) =>
      uploadImageFile(filePath, UploadFolders.support);

  Future<List<Order>> fetchMyOrders() async {
    final response = await getMyOrders();
    return parseOnBackground(parseOrdersResponse, response.data);
  }

  Future<Order> fetchOrderById(String id) async {
    final response = await getOrderById(id);
    return parseOnBackground(parseOrderResponse, response.data);
  }

  Future<Order> cancelOrderById(String id) async {
    final response = await cancelOrder(id);
    return parseOnBackground(parseOrderResponse, response.data);
  }

  Future<String> submitSupportTicket(Map<String, dynamic> data) async {
    final response = await submitSupportMessage(data);
    return ApiResponseParser.getMessage(response.data) ??
        'Your support request has been submitted.';
  }

  Future<List<Product>> fetchWishlistProducts() async {
    final response = await getWishlist();
    return parseOnBackground(parseWishlistProductsResponse, response.data);
  }

  Future<void> registerFcmToken(
    String token, {
    String deviceType = 'android',
  }) async {
    final response = await postFcmToken(token, deviceType: deviceType);
    if (response.data is Map<String, dynamic> &&
        response.data['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(response.data) ??
            'Failed to register FCM token',
      );
    }
  }

  Future<NotificationsPageResult> fetchNotifications({
    int page = 1,
    int limit = 20,
  }) async {
    final response = await getNotifications(page: page, limit: limit);
    final raw = response.data;
    final items = ApiResponseParser.parseList(
      raw,
      AppNotification.fromJson,
    );

    int parsedPage = page;
    int parsedLimit = limit;
    int parsedTotal = items.length;
    int parsedPages = 1;

    if (raw is Map<String, dynamic>) {
      final pagination = raw['pagination'];
      if (pagination is Map<String, dynamic>) {
        parsedPage = int.tryParse(pagination['page']?.toString() ?? '') ?? page;
        parsedLimit =
            int.tryParse(pagination['limit']?.toString() ?? '') ?? limit;
        parsedTotal =
            int.tryParse(pagination['total']?.toString() ?? '') ?? items.length;
        parsedPages =
            int.tryParse(pagination['pages']?.toString() ?? '') ?? 1;
      }
    }

    return NotificationsPageResult(
      items: items,
      page: parsedPage,
      limit: parsedLimit,
      total: parsedTotal,
      pages: parsedPages,
    );
  }

  Future<int> fetchUnreadNotificationCount() async {
    final response = await getUnreadNotificationCount();
    final data = ApiResponseParser.getData(response.data);
    if (data is Map<String, dynamic>) {
      return int.tryParse(data['count']?.toString() ?? '') ?? 0;
    }
    return 0;
  }

  Future<void> markNotificationRead(String id) async {
    final response = await putNotificationRead(id);
    if (response.data is Map<String, dynamic> &&
        response.data['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(response.data) ??
            'Failed to mark notification as read',
      );
    }
  }

  Future<void> markAllNotificationsRead() async {
    final response = await putNotificationsReadAll();
    if (response.data is Map<String, dynamic> &&
        response.data['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(response.data) ??
            'Failed to mark notifications as read',
      );
    }
  }

  Future<void> deleteNotification(String id) async {
    final response = await deleteNotificationById(id);
    if (response.data is Map<String, dynamic> &&
        response.data['success'] == false) {
      throw ApiException(
        ApiResponseParser.getMessage(response.data) ??
            'Failed to delete notification',
      );
    }
  }

  Map<String, dynamic> _buildAddressPayload(Map<String, dynamic> data) {
    final rawFullName =
        (data['fullName'] ?? data['name'] ?? '').toString().trim();
    final rawNumber =
        (data['number'] ?? data['phone'] ?? '').toString().trim();
    final rawEmail = (data['email'] ?? '').toString().trim();
    final rawShopNo = (data['shopNo'] ?? '').toString().trim();
    final rawShopName = (data['shopName'] ?? '').toString().trim();
    final rawFullAddress =
        (data['fullAddress'] ?? data['streetArea'] ?? '').toString().trim();
    final rawLandmark = (data['landmark'] ?? '').toString().trim();
    final rawCity = (data['city'] ?? '').toString().trim();
    final rawState = (data['state'] ?? '').toString().trim();
    final rawPincode = (data['pincode'] ?? '').toString().trim();
    final rawArea = (data['area'] ?? '').toString().trim();
    final lat = double.tryParse(
      (data['lat'] ?? (data['location'] is Map ? data['location']['lat'] : null) ?? '')
          .toString(),
    );
    final lng = double.tryParse(
      (data['lng'] ?? (data['location'] is Map ? data['location']['lng'] : null) ?? '')
          .toString(),
    );

    final fullName = rawFullName.isEmpty ? 'Customer' : rawFullName;
    final number = rawNumber.isEmpty ? '9876543210' : rawNumber;
    final email = rawEmail.isEmpty ? 'customer@greengrocc.com' : rawEmail;
    final shopNo = rawShopNo.isEmpty ? 'Main' : rawShopNo;
    final shopName = rawShopName.isEmpty ? 'Home/Work' : rawShopName;
    final fullAddress =
        rawFullAddress.isEmpty ? 'Main Address' : rawFullAddress;
    final landmark = rawLandmark.isEmpty ? 'Near Location' : rawLandmark;
    final city = rawCity.isEmpty ? 'City' : rawCity;
    final state = rawState.isEmpty ? 'State' : rawState;
    final pincode = rawPincode.isEmpty ? '110001' : rawPincode;

    return {
      'fullName': fullName,
      'number': number,
      'email': email,
      'shopNo': shopNo,
      'shopName': shopName,
      'fullAddress': fullAddress,
      'landmark': landmark,
      'city': city,
      'state': state,
      'pincode': pincode,
      if (rawArea.isNotEmpty) 'area': rawArea,
      if (lat != null && lng != null) 'location': {'lat': lat, 'lng': lng},
      'isDefault': data['isDefault'] ?? false,
      'name': fullName,
      'phone': number,
      'streetArea': fullAddress,
    };
  }
}
