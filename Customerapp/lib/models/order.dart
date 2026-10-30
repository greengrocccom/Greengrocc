import 'address.dart';
import 'dark_store.dart';
import '../core/utils/json_parsers.dart';

class OrderShipment {
  const OrderShipment({
    this.provider = '',
    this.carrier = '',
    this.service = '',
    this.trackingNumber = '',
    this.trackUrl = '',
    this.labelUrl = '',
    this.status = '',
    this.statusMessage = '',
    this.note = '',
    this.evidenceUrl = '',
    this.evidenceName = '',
    this.manualTracking = const OrderManualTracking(),
  });

  final String provider;
  final String carrier;
  final String service;
  final String trackingNumber;
  final String trackUrl;
  final String labelUrl;
  final String status;
  final String statusMessage;
  final String note;
  final String evidenceUrl;
  final String evidenceName;
  final OrderManualTracking manualTracking;

  bool get hasTracking => trackingNumber.trim().isNotEmpty;

  bool get hasShipmentDetails =>
      manualTracking.hasDetails ||
      note.trim().isNotEmpty ||
      evidenceUrl.trim().isNotEmpty;

  String get displayStatus {
    final value = status.trim().isNotEmpty ? status.trim() : statusMessage.trim();
    return value.isNotEmpty ? value : 'Tracking in progress';
  }

  String? get carrierServiceLabel {
    final parts = [carrier, service].where((part) => part.trim().isNotEmpty).toList();
    if (parts.isEmpty) return null;
    return parts.join(' / ');
  }

  factory OrderShipment.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const OrderShipment();
    return OrderShipment(
      provider: json['provider']?.toString() ?? '',
      carrier: json['carrier']?.toString() ?? '',
      service: json['service']?.toString() ?? '',
      trackingNumber: json['trackingNumber']?.toString() ?? '',
      trackUrl: json['trackUrl']?.toString() ?? '',
      labelUrl: json['labelUrl']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      statusMessage: json['statusMessage']?.toString() ?? '',
      note: json['note']?.toString() ?? '',
      evidenceUrl: json['evidenceUrl']?.toString() ?? '',
      evidenceName: json['evidenceName']?.toString() ?? '',
      manualTracking: json['manualTracking'] is Map<String, dynamic>
          ? OrderManualTracking.fromJson(
              json['manualTracking'] as Map<String, dynamic>,
            )
          : const OrderManualTracking(),
    );
  }
}

class OrderManualTracking {
  const OrderManualTracking({
    this.enabled = false,
    this.note = '',
    this.evidenceUrl = '',
    this.evidenceName = '',
  });

  final bool enabled;
  final String note;
  final String evidenceUrl;
  final String evidenceName;

  bool get hasDetails =>
      enabled && (note.trim().isNotEmpty || evidenceUrl.trim().isNotEmpty);

  factory OrderManualTracking.fromJson(Map<String, dynamic> json) {
    return OrderManualTracking(
      enabled: json['enabled'] == true,
      note: json['note']?.toString() ?? '',
      evidenceUrl: json['evidenceUrl']?.toString() ?? '',
      evidenceName: json['evidenceName']?.toString() ?? '',
    );
  }
}

class OrderItem {
  const OrderItem({
    required this.id,
    required this.productId,
    required this.name,
    required this.brandName,
    required this.price,
    required this.quantity,
    this.image = '',
    this.variantName = '',
    this.colorName = '',
  });

  final String id;
  final String productId;
  final String name;
  final String brandName;
  final double price;
  final int quantity;
  final String image;
  final String variantName;
  final String colorName;

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    final product = json['product'];
    return OrderItem(
      id: parseJsonId(json),
      productId: parseNestedId(product) ?? '',
      name: json['name']?.toString() ?? '',
      brandName: json['brandName']?.toString() ?? '',
      price: _toDouble(json['price']),
      quantity: _toInt(json['quantity']),
      image: json['image']?.toString() ??
          json['productImage']?.toString() ??
          (product is Map<String, dynamic>
              ? (product['productImages'] as List<dynamic>? ?? []).firstOrNull
                  ?.toString() ??
              ''
              : ''),
      variantName: json['variantName']?.toString() ?? '',
      colorName: json['colorName']?.toString() ?? '',
    );
  }
}
class OrderGiftHamper {
  const OrderGiftHamper({
    this.minOrderAmount = 0,
    this.giftName = '',
    this.giftDescription = '',
    this.giftImage = '',
    this.status = '',
  });

  final double minOrderAmount;
  final String giftName;
  final String giftDescription;
  final String giftImage;
  final String status;

  bool get isApproved => status == 'approved';
  bool get isPending => status == 'pending';

  /// Customer sees gift hamper only after admin approval.
  bool get isVisible => giftName.trim().isNotEmpty && isApproved;

  factory OrderGiftHamper.fromJson(Map<String, dynamic> json) {
    final gift = json['gift'];
    return OrderGiftHamper(
      minOrderAmount: _toDouble(json['minOrderAmount']),
      giftName: gift is Map<String, dynamic> ? gift['name']?.toString() ?? '' : '',
      giftDescription:
          gift is Map<String, dynamic> ? gift['description']?.toString() ?? '' : '',
      giftImage: gift is Map<String, dynamic> ? gift['image']?.toString() ?? '' : '',
      status: json['status']?.toString() ?? '',
    );
  }
}

class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.items,
    required this.deliveryAddress,
    required this.paymentMethod,
    required this.subtotal,
    required this.deliveryCharges,
    required this.total,
    required this.status,
    required this.paymentStatus,
    this.message = '',
    this.customerMessage = '',
    this.createdAt,
    this.codAdvancePaidAt,
    this.codAdvanceAmount = 0,
    this.razorpayPaymentId = '',
    this.razorpayOrderId = '',
    this.paidAt,
    this.shipment = const OrderShipment(),
    this.couponCode = '',
    this.couponDiscount = 0,
    this.giftHamper,
    this.deliveryOtp = '',
    this.fulfillmentType = 'delivery',
    this.preOrderSlot = '',
    this.preOrderDate = '',
    this.preOrderProgress = '',
    this.preOrderProgressLabel = '',
    this.preOrderTimeline = const [],
    this.darkStore,
    this.storeParts = const [],
  });

  final String id;
  final String orderNumber;
  final List<OrderItem> items;
  final Address deliveryAddress;
  final String paymentMethod;
  final double subtotal;
  final double deliveryCharges;
  final double total;
  final String status;
  final String paymentStatus;
  final String message;
  final String customerMessage;
  final DateTime? createdAt;
  final DateTime? codAdvancePaidAt;
  final double codAdvanceAmount;
  final String razorpayPaymentId;
  final String razorpayOrderId;
  final DateTime? paidAt;
  final OrderShipment shipment;
  final String couponCode;
  final double couponDiscount;
  final OrderGiftHamper? giftHamper;
  /// 4-digit code customer shares with rider to complete delivery.
  final String deliveryOtp;
  /// "delivery" or "pickup" (customer collects from the dark store)
  final String fulfillmentType;
  final String preOrderSlot;
  final String preOrderDate;
  /// Pre-order journey key (`awaiting_vendor`, `confirmed`, `at_store`, …) and its label.
  final String preOrderProgress;
  final String preOrderProgressLabel;
  /// Complete chronological timeline of preorder stages with real timestamps
  final List<PreOrderTimelineStep> preOrderTimeline;
  /// Dark store fulfilling this order (name, address, manager phone)
  final DarkStore? darkStore;
  /// Store-side parts; a mixed cart has a quick part and a pre-order part.
  final List<OrderStorePart> storeParts;

  bool get isPickup => fulfillmentType == 'pickup';
  bool get isPreOrder =>
      preOrderSlot.isNotEmpty ||
      preOrderProgress.isNotEmpty ||
      storeParts.any((p) => p.isPreOrder);

  List<PreOrderTimelineStep> get effectivePreOrderTimeline {
    if (preOrderTimeline.isNotEmpty) return preOrderTimeline;
    for (final part in storeParts) {
      if (part.isPreOrder && part.preOrderTimeline.isNotEmpty) {
        return part.preOrderTimeline;
      }
    }
    // Fallback chronological stages if backend response has no timeline array
    final key = preOrderProgress.isNotEmpty ? preOrderProgress : 'awaiting_vendor';
    const steps = [
      MapEntry('awaiting_vendor', 'Order Placed · Sent to Vendor & Manager'),
      MapEntry('confirmed', 'Vendor Confirmed'),
      MapEntry('preparing', 'Sourced from Farmer / Collection House'),
      MapEntry('dispatched', 'Pickup Approved · In Transit to Dark Store'),
      MapEntry('at_store', 'Reached Dark Store'),
      MapEntry('rider_assigned', 'Delivery Partner Assigned'),
      MapEntry('out_for_delivery', 'Out for Delivery'),
      MapEntry('delivered', 'Delivered'),
    ];
    final currentIdx = steps.indexWhere((s) => s.key == key);
    return steps.map((s) {
      final idx = steps.indexOf(s);
      final isDelivered = key == 'delivered';
      final done = isDelivered || (currentIdx >= 0 && idx <= currentIdx);
      final active = !isDelivered && idx == currentIdx;
      DateTime? stepTime;
      if (idx == 0) {
        stepTime = createdAt;
      } else if (s.key == 'confirmed') {
        for (final p in storeParts) {
          if (p.vendorConfirmedAt != null) {
            stepTime = p.vendorConfirmedAt;
            break;
          }
        }
      } else if (s.key == 'at_store') {
        for (final p in storeParts) {
          if (p.storeReceivedAt != null) {
            stepTime = p.storeReceivedAt;
            break;
          }
        }
      }
      return PreOrderTimelineStep(
        key: s.key,
        title: s.value.split('·').first.trim(),
        subtitle: s.value.contains('·') ? s.value.split('·').last.trim() : '',
        time: stepTime,
        done: done,
        active: active,
      );
    }).toList();
  }

  factory Order.fromJson(Map<String, dynamic> json) {
    final addressJson = json['deliveryAddress'];
    return Order(
      id: parseJsonId(json),
      orderNumber: json['orderNumber']?.toString() ?? '',
      items: (json['items'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(OrderItem.fromJson)
          .toList(),
      deliveryAddress: addressJson is Map<String, dynamic>
          ? Address.fromJson(addressJson)
          : const Address(
              id: '',
              fullName: '',
              number: '',
              email: '',
              shopNo: '',
              shopName: '',
              fullAddress: '',
              landmark: '',
              city: '',
              state: '',
              pincode: '',
            ),
      paymentMethod: json['paymentMethod']?.toString() ?? '',
      subtotal: _toDouble(json['subtotal']),
      deliveryCharges: _toDouble(json['deliveryCharges']),
      total: _toDouble(json['total']),
      status: json['status']?.toString() ?? '',
      paymentStatus: json['paymentStatus']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      customerMessage: (json['customerMessage'] ??
              json['customerNote'] ??
              json['message'])
          ?.toString() ??
          '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())?.toLocal()
          : null,
      codAdvancePaidAt: json['codAdvancePaidAt'] != null
          ? DateTime.tryParse(json['codAdvancePaidAt'].toString())?.toLocal()
          : null,
      codAdvanceAmount: _toDouble(json['codAdvanceAmount'] ?? json['advancePaidAmount']),
      razorpayPaymentId: json['razorpayPaymentId']?.toString() ?? '',
      razorpayOrderId: json['razorpayOrderId']?.toString() ?? '',
      paidAt: json['paidAt'] != null
          ? DateTime.tryParse(json['paidAt'].toString())?.toLocal()
          : null,
      shipment: json['shipment'] is Map<String, dynamic>
          ? OrderShipment.fromJson(json['shipment'] as Map<String, dynamic>)
          : const OrderShipment(),
      couponCode: json['couponCode']?.toString() ?? '',
      couponDiscount: _toDouble(json['couponDiscount']),
      giftHamper: json['giftHamper'] is Map<String, dynamic>
          ? OrderGiftHamper.fromJson(json['giftHamper'] as Map<String, dynamic>)
          : null,
      deliveryOtp: (json['deliveryOtp'] ?? json['otpCode'])?.toString() ?? '',
      fulfillmentType: json['fulfillmentType']?.toString() == 'pickup' ? 'pickup' : 'delivery',
      preOrderSlot: json['preOrderSlot']?.toString() ?? '',
      preOrderDate: json['preOrderDate']?.toString() ?? '',
      preOrderProgress: json['preOrderProgress']?.toString() ?? '',
      preOrderProgressLabel: json['preOrderProgressLabel']?.toString() ?? '',
      preOrderTimeline: (json['preOrderTimeline'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(PreOrderTimelineStep.fromJson)
          .toList(),
      darkStore: json['darkStore'] is Map<String, dynamic>
          ? DarkStore.fromJson(json['darkStore'] as Map<String, dynamic>)
          : null,
      storeParts: (json['storeParts'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(OrderStorePart.fromJson)
          .toList(),
    );
  }
}

class PreOrderTimelineStep {
  const PreOrderTimelineStep({
    required this.key,
    required this.title,
    this.subtitle = '',
    this.time,
    this.actor = '',
    this.done = false,
    this.active = false,
  });

  final String key;
  final String title;
  final String subtitle;
  final DateTime? time;
  final String actor;
  final bool done;
  final bool active;

  bool get isCompleted => done;
  bool get isCurrent => active;
  DateTime? get timestamp => time;
  String? get actorName => actor.isNotEmpty ? actor : null;

  factory PreOrderTimelineStep.fromJson(Map<String, dynamic> json) {
    return PreOrderTimelineStep(
      key: json['key']?.toString() ?? '',
      title: json['title']?.toString() ?? json['label']?.toString() ?? '',
      subtitle: json['subtitle']?.toString() ?? '',
      time: json['time'] != null
          ? DateTime.tryParse(json['time'].toString())?.toLocal()
          : (json['at'] != null ? DateTime.tryParse(json['at'].toString())?.toLocal() : null),
      actor: json['actor']?.toString() ?? '',
      done: json['done'] == true,
      active: json['active'] == true,
    );
  }
}

class OrderStorePart {
  const OrderStorePart({
    required this.orderNumber,
    required this.status,
    this.isPreOrder = false,
    this.preOrderSlot = '',
    this.preOrderDate = '',
    this.preOrderProgress = '',
    this.preOrderProgressLabel = '',
    this.vendorConfirmedAt,
    this.storeReceivedAt,
    this.preOrderTimeline = const [],
  });

  final String orderNumber;
  final String status;
  final bool isPreOrder;
  final String preOrderSlot;
  final String preOrderDate;
  final String preOrderProgress;
  final String preOrderProgressLabel;
  final DateTime? vendorConfirmedAt;
  final DateTime? storeReceivedAt;
  final List<PreOrderTimelineStep> preOrderTimeline;

  factory OrderStorePart.fromJson(Map<String, dynamic> json) {
    return OrderStorePart(
      orderNumber: json['orderNumber']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      isPreOrder: json['isPreOrder'] == true,
      preOrderSlot: json['preOrderSlot']?.toString() ?? '',
      preOrderDate: json['preOrderDate']?.toString() ?? '',
      preOrderProgress: json['preOrderProgress']?.toString() ?? '',
      preOrderProgressLabel: json['preOrderProgressLabel']?.toString() ?? '',
      vendorConfirmedAt: json['vendorConfirmedAt'] != null
          ? DateTime.tryParse(json['vendorConfirmedAt'].toString())?.toLocal()
          : null,
      storeReceivedAt: json['storeReceivedAt'] != null
          ? DateTime.tryParse(json['storeReceivedAt'].toString())?.toLocal()
          : null,
      preOrderTimeline: (json['preOrderTimeline'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(PreOrderTimelineStep.fromJson)
          .toList(),
    );
  }
}

double _toDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

int _toInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
