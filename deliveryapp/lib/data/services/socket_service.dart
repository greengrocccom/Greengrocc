import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../../core/config/api_config.dart';
import 'auth_service.dart';
import 'push_notification_service.dart';

class SocketService {
  SocketService._();
  static final SocketService instance = SocketService._();

  IO.Socket? _socket;
  String? _riderId;
  bool _isConnected = false;

  bool get isConnected => _isConnected;

  final StreamController<Map<String, dynamic>> _orderAssignedController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _orderOfferController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _orderOfferExpiredController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _documentReviewController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _peakHoursController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _pickupVerifiedController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _riderNotificationController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _notificationBadgeController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _forcedOfflineController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _deliveryUpdatedController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<bool> _connectionController = StreamController<bool>.broadcast();
  final StreamController<Map<String, dynamic>> _walletUpdatedController =
      StreamController<Map<String, dynamic>>.broadcast();

  /// Wallet credited (order earning, slot incentive, salary) — wallet screens refresh on this.
  Stream<Map<String, dynamic>> get onWalletUpdated => _walletUpdatedController.stream;

  /// Any server-side change to this rider's deliveries (assignment, pickup
  /// approval, status change, cancellation…). Screens refresh on this instead of polling.
  Stream<Map<String, dynamic>> get onActiveDeliveryUpdated => _deliveryUpdatedController.stream;

  /// true on every (re)connect — a cue to catch up on anything missed while offline.
  Stream<bool> get onConnectionChanged => _connectionController.stream;

  Stream<Map<String, dynamic>> get onOrderAssigned =>
      _orderAssignedController.stream;
  Stream<Map<String, dynamic>> get onOrderOfferReceived =>
      _orderOfferController.stream;
  Stream<Map<String, dynamic>> get onOrderOfferExpired =>
      _orderOfferExpiredController.stream;
  Stream<Map<String, dynamic>> get onDocumentReviewUpdate =>
      _documentReviewController.stream;
  Stream<Map<String, dynamic>> get onPeakHoursActive =>
      _peakHoursController.stream;
  Stream<Map<String, dynamic>> get onPickupVerified =>
      _pickupVerifiedController.stream;
  Stream<Map<String, dynamic>> get onRiderNotification =>
      _riderNotificationController.stream;
  Stream<Map<String, dynamic>> get onNotificationBadge =>
      _notificationBadgeController.stream;
  Stream<Map<String, dynamic>> get onForcedOffline =>
      _forcedOfflineController.stream;

  void connect(String riderId) {
    if (riderId.isEmpty) return;
    final sameRider = _riderId == riderId;
    _riderId = riderId;

    // A live or reconnecting socket for this rider is reused; never stack a second one.
    if (_socket != null && sameRider) {
      if (_socket!.connected) _joinRoom();
      return;
    }
    if (_socket != null) {
      _socket!.dispose();
      _socket = null;
    }

    final serverUrl = ApiConfig.baseUrl;
    debugPrint('[Socket] Connecting to $serverUrl for rider $riderId');

    final token = AuthService.instance.token;
    _socket = IO.io(
      serverUrl,
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({if (token != null && token.isNotEmpty) 'token': token})
          .enableForceNew()
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(99999)
          .setReconnectionDelay(2000)
          .build(),
    );

    _socket!.onConnect((_) {
      _isConnected = true;
      debugPrint('[Socket] Connected to server: ${_socket!.id}');
      _joinRoom();
      _connectionController.add(true);
    });

    _socket!.onDisconnect((reason) {
      _isConnected = false;
      debugPrint('[Socket] Disconnected: $reason');
      _connectionController.add(false);
    });

    for (final event in const [
      'active_delivery_updated',
      'new_order_assigned',
      'pickup_qr_unlocked',
      'same_route_window_started',
      'pickup_verified',
      'customer_address_unlocked',
      'return_pickup_assigned',
    ]) {
      _socket!.on(event, (data) {
        _deliveryUpdatedController.add({
          'event': event,
          if (data is Map) ...Map<String, dynamic>.from(data),
        });
      });
    }

    _socket!.onConnectError((err) {
      debugPrint('[Socket] Connection Error: $err');
    });

    _socket!.on('new_order_assigned', (data) {
      debugPrint('[Socket] Event new_order_assigned: $data');
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        _orderAssignedController.add(map);
        PushNotificationService.instance.cancelForOrder(map['orderId']?.toString() ?? '');
      }
    });

    void handleOrderOffer(dynamic data) {
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        _orderOfferController.add(map);
        final num = map['orderNumber']?.toString() ?? '';
        final earn = map['estimatedEarnings'] ?? map['earnUpTo'] ?? '';
        final earnTxt = earn.toString().isNotEmpty ? ' · Earn ₹$earn' : '';
        final idStr = map['orderId']?.toString() ?? '';
        PushNotificationService.instance.showLocalNotification(
          title: 'New Delivery Offer!$earnTxt',
          body: num.isNotEmpty
              ? 'New delivery offer for Order #$num. Tap to review and accept!'
              : 'New delivery offer available. Tap to review and accept!',
          data: {
            'screen': 'home',
            'type': 'ORDER_RECEIVED',
            'orderId': idStr,
          },
        );
      }
    }

    _socket!.on('order_offer_received', (data) {
      debugPrint('[Socket] Event order_offer_received: $data');
      handleOrderOffer(data);
    });

    _socket!.on('driver_order_offer', (data) {
      debugPrint('[Socket] Event driver_order_offer: $data');
      handleOrderOffer(data);
    });

    _socket!.on('pickup_verified', (data) {
      debugPrint('[Socket] Event pickup_verified: $data');
      if (data is Map) {
        _pickupVerifiedController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('customer_address_unlocked', (data) {
      debugPrint('[Socket] Event customer_address_unlocked: $data');
      if (data is Map) {
        _pickupVerifiedController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('order_offer_expired', (data) {
      debugPrint('[Socket] Event order_offer_expired: $data');
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        _orderOfferExpiredController.add(map);
        PushNotificationService.instance.cancelForOrder(map['orderId']?.toString() ?? '');
      }
    });

    _socket!.on('document_review_update', (data) {
      debugPrint('[Socket] Event document_review_update: $data');
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        _documentReviewController.add(map);
        final status = (map['verificationStatus'] ?? '').toString().toLowerCase();
        if (status == 'approved' || status == 'verified') {
          AuthService.instance.applyVerificationStatus('approved');
          AuthService.instance.fetchMe();
          PushNotificationService.instance.showLocalNotification(
            title: "You're Verified!",
            body: 'Your profile has been verified! You can now go online and receive orders.',
            data: {'screen': 'home', 'type': 'VERIFICATION_COMPLETED'},
          );
        } else if (status == 'rejected') {
          AuthService.instance.applyVerificationStatus('rejected');
          PushNotificationService.instance.showLocalNotification(
            title: 'Verification Status Update',
            body: map['remarks']?.toString() ?? 'Please review your verification details in the app.',
            data: {'screen': 'home', 'type': 'DOCUMENT_REJECTED'},
          );
        }
      }
    });

    _socket!.on('peak_hours_active', (data) {
      debugPrint('[Socket] Event peak_hours_active: $data');
      if (data is Map) {
        _peakHoursController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('rider_notification', (data) {
      debugPrint('[Socket] Event rider_notification: $data');
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        _riderNotificationController.add(map);
        final type = map['type']?.toString() ?? '';
        if (type.endsWith('_CREDITED')) AuthService.instance.fetchMe();
      }
    });

    void handleWalletCredit(dynamic data) {
      debugPrint('[Socket] Event wallet credit: $data');
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        _walletUpdatedController.add(map);
        AuthService.instance.fetchMe();
      }
    }

    _socket!.on('wallet_updated', handleWalletCredit);
    _socket!.on('rider_wallet_credited', handleWalletCredit);

    _socket!.on('rider_cash_updated', (data) {
      debugPrint('[Socket] Event rider_cash_updated: $data');
      AuthService.instance.fetchMe();
    });

    _socket!.on('notification_badge', (data) {
      debugPrint('[Socket] Event notification_badge: $data');
      if (data is Map) {
        _notificationBadgeController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('forced_offline', (data) {
      debugPrint('[Socket] Event forced_offline: $data');
      if (data is Map) {
        _forcedOfflineController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('status_updated', (data) {
      debugPrint('[Socket] Event status_updated: $data');
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        if (map['status']?.toString() == 'offline' ||
            map['reason']?.toString() == 'shift_ended' ||
            map['reason']?.toString() == 'gig_ended') {
          _forcedOfflineController.add(map);
        }
      }
    });
  }

  /// Live GPS for one delivery. The server only accepts it for assigned
  /// ready-to-cook / instant orders after pickup; the ack says why if not.
  Future<Map<String, dynamic>?> emitDriverLocation({
    required String orderId,
    required double lat,
    required double lng,
    double? heading,
    double? speed,
    Duration timeout = const Duration(seconds: 5),
  }) {
    final socket = _socket;
    if (socket == null || !socket.connected) return Future.value(null);
    final completer = Completer<Map<String, dynamic>?>();
    socket.emitWithAck(
      'driver_location',
      {
        'orderId': orderId,
        'lat': lat,
        'lng': lng,
        'heading': ?heading,
        'speed': ?speed,
      },
      ack: (dynamic data) {
        if (completer.isCompleted) return;
        completer.complete(data is Map ? Map<String, dynamic>.from(data) : null);
      },
    );
    return completer.future.timeout(timeout, onTimeout: () => null);
  }

  void _joinRoom() {
    if (_riderId != null && _riderId!.isNotEmpty && _socket != null) {
      _socket!.emit('join_rider_room', {'riderId': _riderId});
      debugPrint('[Socket] Emitted join_rider_room for riderId: $_riderId');
    }
  }

  void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _isConnected = false;
    _riderId = null;
    debugPrint('[Socket] Disconnected and disposed.');
  }
}
