import 'package:dio/dio.dart';

import '../exceptions/api_exception.dart';
import '../../config/env.dart';
import '../storage/auth_storage.dart';

import '../providers/location_provider.dart';

class ApiClient {
  ApiClient(this._authStorage, {DeliveryLocation? Function()? locationGetter})
      : _locationGetter = locationGetter {
    _dio = Dio(
      BaseOptions(
        baseUrl: Env.apiUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final hasAuth = options.headers.containsKey('Authorization');
          if (!hasAuth) {
            final token = _authStorage.token;
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }

          options.queryParameters = _withLocation(options.path, options.queryParameters);

          handler.next(options);
        },
        onError: (error, handler) {
          final statusCode = error.response?.statusCode;
          if (statusCode == 401 || statusCode == 403) {
            final data = error.response?.data;
            final message = (data is Map<String, dynamic>
                    ? data['message']?.toString()
                    : null) ??
                '';
            final lower = message.toLowerCase();
            if (lower.contains('blocked')) {
              _authStorage.clear();
            }
          }
          handler.reject(
            DioException(
              requestOptions: error.requestOptions,
              response: error.response,
              type: error.type,
              error: ApiException.fromDio(error),
              message: ApiException.fromDio(error).message,
            ),
          );
        },
      ),
    );
  }

  final AuthStorage _authStorage;
  final DeliveryLocation? Function()? _locationGetter;
  late final Dio _dio;

  Dio get dio => _dio;

  Map<String, dynamic> _withLocation(String path, Map<String, dynamic> params) {
    if (!path.contains('/api/products') &&
        !path.contains('/api/stores') &&
        !path.contains('/api/categories')) {
      return params;
    }
    final locationParams = _locationGetter?.call()?.toQueryParams();
    if (locationParams == null || locationParams.isEmpty) return params;
    return {...locationParams, ...params};
  }

  /// The exact request [path] + [params] resolve to (location included), for caching.
  String cacheKey(String path, [Map<String, dynamic>? params]) {
    final query = _withLocation(path, params ?? const {});
    final keys = query.keys.where((k) => query[k] != null).toList()..sort();
    if (keys.isEmpty) return path;
    return '$path?${keys.map((k) => '$k=${Uri.encodeQueryComponent(query[k].toString())}').join('&')}';
  }
}
