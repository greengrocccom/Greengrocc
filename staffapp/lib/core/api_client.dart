import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'session_manager.dart';
import 'user_friendly_error.dart';

class ApiClient {
  static Future<Uint8List> getImage(String endpoint) async {
    final base = await getBaseUrl();
    final response = await http.get(Uri.parse('$base$endpoint'), headers: await _headers())
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      _handleResponse(response);
      throw Exception('Could not load photo');
    }
    return response.bodyBytes;
  }
  static const String defaultBaseUrl = 'https://api.greengrocc.com';

  static Future<String> getBaseUrl() async {
    final custom = await SessionManager.getCustomBaseUrl();
    if (custom != null && custom.trim().isNotEmpty) {
      final clean = custom.trim().replaceAll(RegExp(r'/+$'), '');
      // If user had previous local IP saved, prefer production unless explicitly testing
      if (!clean.contains('192.168.1.34') && !clean.contains('localhost:5001')) {
        return clean;
      }
    }
    return defaultBaseUrl;
  }

  static Future<Map<String, String>> _headers({bool needsAuth = true}) async {
    final map = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (needsAuth) {
      final token = await SessionManager.getToken();
      if (token != null && token.isNotEmpty) {
        map['Authorization'] = 'Bearer $token';
      }
    }
    return map;
  }

  static Future<dynamic> get(String endpoint, {bool needsAuth = true}) async {
    try {
      final base = await getBaseUrl();
      final url = Uri.parse('$base$endpoint');
      final headers = await _headers(needsAuth: needsAuth);

      final res = await http.get(url, headers: headers).timeout(const Duration(seconds: 15));
      return _handleResponse(res);
    } catch (e) {
      throw Exception(UserFriendlyError.toHumanMessage(e));
    }
  }

  static Future<dynamic> post(
    String endpoint, [
    dynamic bodyOrOptions,
    dynamic maybeOptions,
  ]) async {
    try {
      final base = await getBaseUrl();
      final url = Uri.parse('$base$endpoint');

      Map<String, dynamic> body = {};
      bool needsAuth = true;

      if (bodyOrOptions is Map<String, dynamic>) {
        body = bodyOrOptions;
        if (maybeOptions is bool) needsAuth = maybeOptions;
      }

      final headers = await _headers(needsAuth: needsAuth);
      final res = await http.post(url, headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 15));
      return _handleResponse(res);
    } catch (e) {
      throw Exception(UserFriendlyError.toHumanMessage(e));
    }
  }

  static Future<dynamic> put(String endpoint, Map<String, dynamic> body, {bool needsAuth = true}) async {
    try {
      final base = await getBaseUrl();
      final url = Uri.parse('$base$endpoint');
      final headers = await _headers(needsAuth: needsAuth);

      final res = await http.put(url, headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 15));
      return _handleResponse(res);
    } catch (e) {
      throw Exception(UserFriendlyError.toHumanMessage(e));
    }
  }

  static Future<dynamic> delete(String endpoint, {bool needsAuth = true}) async {
    try {
      final base = await getBaseUrl();
      final url = Uri.parse('$base$endpoint');
      final headers = await _headers(needsAuth: needsAuth);

      final res = await http.delete(url, headers: headers).timeout(const Duration(seconds: 15));
      return _handleResponse(res);
    } catch (e) {
      throw Exception(UserFriendlyError.toHumanMessage(e));
    }
  }

  static dynamic _handleResponse(http.Response res) {
    dynamic jsonBody;
    try {
      jsonBody = jsonDecode(res.body);
    } catch (_) {
      jsonBody = null;
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (jsonBody is Map<String, dynamic> && jsonBody.containsKey('data')) {
        return jsonBody['data'];
      }
      return jsonBody;
    }

    final rawMessage = jsonBody is Map<String, dynamic> && jsonBody['message'] != null
        ? jsonBody['message'].toString()
        : 'status ${res.statusCode}';
    throw Exception(UserFriendlyError.toHumanMessage(rawMessage));
  }
}
